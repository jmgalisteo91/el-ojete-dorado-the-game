/**
 * PremiumEffectsManager.js
 *
 * Capa transparente de efectos visuales PixiJS v8 superpuesta sobre #game-canvas
 * (sin modificar el motor 2D). Gestiona partículas ambientales por bioma mediante
 * PIXI.ParticleContainer y shaders GLSL 3.0 sutiles para calor (Forja) y agua (Valleverde).
 *
 * En entornos headless (tests Node sin DOM/WebGL) se degrada de forma segura a no-op.
 */

import { getEnvironmentTheme, resolveEnvironmentBiome } from '../data/EnvironmentData.js';

const DEFAULT_LOGICAL_WIDTH = 320;
const DEFAULT_LOGICAL_HEIGHT = 180;
const DEFAULT_DISPLAY_WIDTH = 1280;
const DEFAULT_DISPLAY_HEIGHT = 720;

const QUALITY_SCALE = {
  low: 0.45,
  normal: 1,
  high: 1.2
};

// Mismos IDs de agua que SpriteSheetGenerator.TILES (evita importar módulos Canvas en Node puro)
const TILE_WATER_1 = 4;
const TILE_WATER_2 = 5;

const HEAT_FRAGMENT_SHADER = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform heatUniforms {
  float uTime;
  float uIntensity;
};

void main(void) {
  vec4 base = texture(uTexture, vTextureCoord);
  float vPos = clamp(vTextureCoord.y * 2.2, 0.0, 1.0);
  float fade = smoothstep(0.0, 0.85, vPos);
  float waveA = sin(vTextureCoord.y * 42.0 - uTime * 5.2 + sin(vTextureCoord.x * 16.0 + uTime * 2.1) * 1.4);
  float waveB = cos(vTextureCoord.x * 24.0 + uTime * 3.1 - vTextureCoord.y * 18.0);
  float shimmer = max(0.0, waveA * 0.55 + waveB * 0.45);
  float alpha = shimmer * fade * 0.14 * uIntensity * base.a;
  vec3 tint = mix(vec3(1.0, 0.46, 0.12), vec3(1.0, 0.82, 0.36), fade);
  finalColor = vec4(tint * alpha, alpha);
}
`;

const WATER_FRAGMENT_SHADER = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform waterUniforms {
  float uTime;
  float uIntensity;
};

void main(void) {
  vec4 base = texture(uTexture, vTextureCoord);
  float edgeX = smoothstep(0.0, 0.12, vTextureCoord.x) * (1.0 - smoothstep(0.88, 1.0, vTextureCoord.x));
  float edgeY = smoothstep(0.0, 0.18, vTextureCoord.y) * (1.0 - smoothstep(0.82, 1.0, vTextureCoord.y));
  float mask = edgeX * edgeY;
  float ripple = sin(vTextureCoord.x * 36.0 + uTime * 2.4 + sin(vTextureCoord.y * 24.0 - uTime * 1.8));
  float crest = smoothstep(0.55, 0.98, ripple);
  float alpha = crest * mask * 0.16 * uIntensity * base.a;
  vec3 tint = vec3(0.56, 0.91, 1.0);
  finalColor = vec4(tint * alpha, alpha);
}
`;

export const BIOME_PRESETS = Object.freeze({
  valleverde: {
    id: 'valleverde',
    maxParticles: 50,
    types: ['leaf'],
    shader: 'water'
  },
  cloacas: {
    id: 'cloacas',
    maxParticles: 40,
    types: ['drip', 'fly'],
    shader: 'none'
  },
  forja: {
    id: 'forja',
    maxParticles: 50,
    types: ['spark'],
    shader: 'heat'
  },
  templos: {
    id: 'templos',
    maxParticles: 34,
    types: ['dust'],
    shader: 'none'
  },
  ciudadela: {
    id: 'ciudadela',
    maxParticles: 50,
    types: ['bit0', 'bit1', 'glitch'],
    shader: 'none'
  },
  interior: {
    id: 'interior',
    maxParticles: 0,
    types: [],
    shader: 'none'
  }
});

/**
 * Clasifica un sceneId del juego en uno de los biomas de efectos PixiJS.
 */
export function resolveSceneBiome(sceneId) {
  if (!sceneId) return 'interior';
  return resolveEnvironmentBiome(sceneId);
}

function buildAtlasCanvas(doc) {
  const canvas = doc.createElement('canvas');
  canvas.width = 96;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, frames: {} };

  const frames = {
    leaf: { x: 2, y: 2, w: 8, h: 6 },
    pollen: { x: 14, y: 2, w: 4, h: 4 },
    drip: { x: 22, y: 2, w: 4, h: 10 },
    fly: { x: 30, y: 2, w: 5, h: 5 },
    spark: { x: 40, y: 2, w: 5, h: 6 },
    smoke: { x: 48, y: 2, w: 14, h: 14 },
    dust: { x: 66, y: 2, w: 6, h: 6 },
    bit0: { x: 4, y: 22, w: 10, h: 12 },
    bit1: { x: 18, y: 22, w: 10, h: 12 },
    glitch: { x: 32, y: 24, w: 20, h: 4 }
  };

  // Hoja verde
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(3, 4, 6, 3);
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(4, 3, 4, 2);

  // Polen dorado claro
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(15, 3, 2, 2);

  // Gota vertical de agua (Cloacas)
  ctx.fillStyle = '#67e8f9';
  ctx.fillRect(23, 3, 2, 8);
  ctx.fillStyle = '#ecfeff';
  ctx.fillRect(23, 9, 2, 2);

  // Mosca zumbando
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(31, 4, 3, 2);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(31, 2, 1, 2);
  ctx.fillRect(33, 2, 1, 2);

  // Chispa naranja
  ctx.fillStyle = '#f97316';
  ctx.fillRect(41, 3, 3, 4);
  ctx.fillStyle = '#fde047';
  ctx.fillRect(42, 4, 1, 2);

  // Humo suave (radial)
  const smokeGrad = ctx.createRadialGradient(55, 9, 1, 55, 9, 6);
  smokeGrad.addColorStop(0, 'rgba(203, 213, 225, 0.75)');
  smokeGrad.addColorStop(1, 'rgba(100, 116, 139, 0)');
  ctx.fillStyle = smokeGrad;
  ctx.beginPath();
  ctx.arc(55, 9, 6, 0, Math.PI * 2);
  ctx.fill();

  // Polvo dorado (Templos)
  const dustGrad = ctx.createRadialGradient(69, 5, 0.5, 69, 5, 3);
  dustGrad.addColorStop(0, 'rgba(254, 240, 138, 1)');
  dustGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = dustGrad;
  ctx.fillRect(66, 2, 6, 6);

  // Código binario '0' y '1' (Ciudadela / Expansión)
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#4ade80';
  ctx.fillText('0', 9, 28);
  ctx.fillStyle = '#22d3ee';
  ctx.fillText('1', 23, 28);

  // Barra de estática / glitch
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(32, 24, 20, 2);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(35, 26, 14, 1);

  return { canvas, frames };
}

const PARTICLE_COLORS = Object.freeze({
  leaf: 0x4ade80,
  pollen: 0xfef3c7,
  firefly: 0xfde047,
  drip: 0x38bdf8,
  fly: 0x0f172a,
  spark: 0xf97316,
  smoke: 0x94a3b8,
  dust: 0xfde047,
  bit0: 0x4ade80,
  bit1: 0x22d3ee,
  glitch: 0xef4444,
  glitchDark: 0x0f172a
});

export class PremiumEffectsManager {
  constructor(gameCanvas = null, options = {}) {
    this.gameCanvas = gameCanvas;
    this.width = options.width || DEFAULT_DISPLAY_WIDTH;
    this.height = options.height || DEFAULT_DISPLAY_HEIGHT;
    this.resolution = options.resolution || 1;
    this.quality = QUALITY_SCALE[options.quality] ? options.quality : 'normal';
    this.particleQuality = options.particleQuality === 'low' ? 'low' : 'high';
    this.particlesEnabled = this.particleQuality !== 'low';
    this.enabled = options.enabled !== false;
    this.visible = true;

    this._pixiOverride = options.pixi || null;
    this.pixiApp = null;
    this.app = null;
    this.overlayCanvas = null;
    this.shaderContainer = null;
    this.particleContainer = null;
    this.chimneyContainer = null;
    this.heatSprite = null;
    this.waterSprite = null;
    this.heatUniforms = null;
    this.waterUniforms = null;
    this.textures = {};
    this.baseTexture = null;

    this.sceneId = null;
    this.biome = 'interior';
    this.theme = getEnvironmentTheme('interior');
    this.particles = [];
    this.chimneys = [];
    this.chimneySmoke = [];
    this._chimneyCamX = 0;
    this._chimneyCamY = 0;
    this._chimneySpawnTimer = 0;
    this.time = 0;
    this.ready = false;
    this._destroyed = false;
    this._initPromise = null;
    this._resizeObserver = null;
    this._onResize = null;
    this._rafId = null;
    this._lastRafTs = 0;
    this._useRaf = options.useRaf !== false;
    this._waterState = { visible: false, x: 0, y: 0, w: 0, h: 0, alpha: 0 };

    if (options.autoInit !== false && this.gameCanvas) {
      this._initPromise = this.init(this.gameCanvas);
    }
  }

  _getPixi() {
    if (this._pixiOverride) return this._pixiOverride;
    if (typeof globalThis !== 'undefined' && globalThis.PIXI) return globalThis.PIXI;
    if (typeof window !== 'undefined' && window.PIXI) return window.PIXI;
    return null;
  }

  async init(gameCanvas = this.gameCanvas) {
    if (this._initPromise && this._initStarted) return this._initPromise;
    this._initStarted = true;
    this.gameCanvas = gameCanvas || this.gameCanvas;

    const run = async () => {
      const pixi = this._getPixi();
      if (this._destroyed || typeof document === 'undefined' || !this.gameCanvas) {
        return false;
      }
      if (!pixi) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[PremiumEffectsManager] Error de inicialización: PIXI is not defined.');
        }
        return false;
      }

      try {
        const appOpts = {
          width: this.width,
          height: this.height,
          backgroundAlpha: 0,
          antialias: false,
          resolution: this.resolution,
          autoDensity: false,
          autoStart: false,
          clearBeforeRender: true
        };
        const hasV8Init = typeof pixi.Application?.prototype?.init === 'function';
        const app = hasV8Init ? new pixi.Application() : new pixi.Application(appOpts);
        if (typeof app.init === 'function') {
          await app.init(appOpts);
        }
        if (this._destroyed) {
          if (typeof app.destroy === 'function') app.destroy(true);
          return false;
        }
        if (app.ticker && typeof app.ticker.stop === 'function') {
          app.ticker.stop();
        }

        this.app = app;
        this.pixiApp = app;
        this.overlayCanvas = app.canvas || app.view || null;
        this._attachOverlayCanvas();
        this._buildTextures(pixi);
        this._buildContainers(pixi);
        this._buildShaders(pixi);
        this.ready = true;

        if (this.sceneId) {
          this._rebuildParticlesForBiome(this.biome);
        }
        this._syncVisibility();
        if (this._useRaf && typeof requestAnimationFrame === 'function') {
          this._startRafLoop();
        }
        return true;
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[PremiumEffectsManager] Error al inicializar PixiJS:', err?.message || err);
        }
        this.ready = false;
        return false;
      }
    };

    this._initPromise = run();
    return this._initPromise;
  }

  _attachOverlayCanvas() {
    const canvas = this.overlayCanvas;
    const target = this.gameCanvas;
    if (!canvas || !target) return;

    canvas.id = 'pixi-effects-canvas';
    if (typeof canvas.setAttribute === 'function') {
      canvas.setAttribute('aria-hidden', 'true');
    }
    if (canvas.style) {
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '10';
      canvas.style.background = 'transparent';
      canvas.style.userSelect = 'none';
      canvas.style.imageRendering = 'pixelated';
    }

    const parent = target.parentNode || (typeof document !== 'undefined' ? document.body : null);
    if (parent && typeof parent.insertBefore === 'function' && canvas.parentNode !== parent) {
      parent.insertBefore(canvas, target.nextSibling || null);
    } else if (parent && typeof parent.appendChild === 'function' && canvas.parentNode !== parent) {
      parent.appendChild(canvas);
    }

    this.syncLayout();

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._onResize = () => this.syncLayout();
      window.addEventListener('resize', this._onResize);
    }
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(() => this.syncLayout());
      this._resizeObserver.observe(target);
    }
  }

  syncLayout() {
    const canvas = this.overlayCanvas;
    const target = this.gameCanvas;
    if (!canvas || !canvas.style || !target) return;

    const left = (target.offsetLeft || 0) + (target.clientLeft || 0);
    const top = (target.offsetTop || 0) + (target.clientTop || 0);
    const width = target.clientWidth || DEFAULT_DISPLAY_WIDTH;
    const height = target.clientHeight || DEFAULT_DISPLAY_HEIGHT;

    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  _buildTextures(pixi) {
    if (typeof document === 'undefined' || !pixi.Texture) return;
    const { canvas, frames } = buildAtlasCanvas(document);
    const base = pixi.Texture.from(canvas);
    this.baseTexture = base;

    for (const [key, f] of Object.entries(frames)) {
      if (pixi.Rectangle && base?.source) {
        this.textures[key] = new pixi.Texture({
          source: base.source,
          frame: new pixi.Rectangle(f.x, f.y, f.w, f.h)
        });
      } else {
        this.textures[key] = base;
      }
    }
  }

  _buildContainers(pixi) {
    this.shaderContainer = new pixi.Container();
    this.app.stage.addChild(this.shaderContainer);

    // En PixiJS real preferimos Container + Graphics para garantizar compatibilidad v7/v8 y color sólido nitido.
    if (typeof pixi.Graphics === 'function') {
      this.particleContainer = new pixi.Container();
    } else if (typeof pixi.ParticleContainer === 'function') {
      try {
        this.particleContainer = new pixi.ParticleContainer({
          dynamicProperties: {
            position: true,
            rotation: true,
            scale: true,
            color: true,
            uvs: true
          }
        });
      } catch (_) {
        this.particleContainer = new pixi.Container();
      }
    } else {
      this.particleContainer = new pixi.Container();
    }
    this.app.stage.addChild(this.particleContainer);

    this.chimneyContainer = new pixi.Container();
    this.app.stage.addChild(this.chimneyContainer);
  }

  _buildShaders(pixi) {
    if (!this.shaderContainer || !pixi.Sprite || !pixi.Texture?.WHITE) return;

    const makeFilter = (fragment, resourceName, uniformsObj) => {
      if (!pixi.Filter || !pixi.GlProgram || !pixi.UniformGroup) return null;
      try {
        const glOpts = pixi.defaultFilterVert
          ? { vertex: pixi.defaultFilterVert, fragment }
          : { fragment };
        const glProgram = pixi.GlProgram.from(glOpts);
        const uniformGroup = new pixi.UniformGroup(uniformsObj);
        const filter = new pixi.Filter({
          glProgram,
          resources: { [resourceName]: uniformGroup }
        });
        return { filter, uniformGroup };
      } catch (_) {
        return null;
      }
    };

    // Forja: distorsión térmica sutil en la franja inferior de la pantalla
    const heat = new pixi.Sprite(pixi.Texture.WHITE);
    heat.x = 0;
    heat.y = Math.round(this.height * 0.54);
    heat.width = this.width;
    heat.height = this.height - heat.y;
    heat.visible = false;
    heat.alpha = 0;
    const heatBundle = makeFilter(HEAT_FRAGMENT_SHADER, 'heatUniforms', {
      uTime: { value: 0, type: 'f32' },
      uIntensity: { value: 1, type: 'f32' }
    });
    if (heatBundle) {
      heat.filters = [heatBundle.filter];
      this.heatUniforms = heatBundle.uniformGroup;
      heat.alpha = 1;
    } else {
      // Fallback sutil si GlProgram no compila
      heat.tint = 0xf97316;
      heat.alpha = 0.05;
    }
    this.heatSprite = heat;
    this.shaderContainer.addChild(heat);

    // Agua (Valleverde): ondas tenues sobre regiones con agua visible
    const water = new pixi.Sprite(pixi.Texture.WHITE);
    water.x = 0;
    water.y = 0;
    water.width = 64;
    water.height = 64;
    water.visible = false;
    water.alpha = 0;
    const waterBundle = makeFilter(WATER_FRAGMENT_SHADER, 'waterUniforms', {
      uTime: { value: 0, type: 'f32' },
      uIntensity: { value: 1, type: 'f32' }
    });
    if (waterBundle) {
      water.filters = [waterBundle.filter];
      this.waterUniforms = waterBundle.uniformGroup;
      water.alpha = 1;
    } else {
      water.tint = 0x38bdf8;
      water.alpha = 0.05;
    }
    this.waterSprite = water;
    this.shaderContainer.addChild(water);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this._syncVisibility();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this._syncVisibility();
  }

  setQuality(profile) {
    const next = QUALITY_SCALE[profile] ? profile : 'normal';
    if (next === this.quality) return;
    this.quality = next;
    if (this.ready) {
      this._rebuildParticlesForBiome(this.biome);
    }
  }

  setParticleQuality(quality) {
    const next = quality === 'low' ? 'low' : 'high';
    this.particleQuality = next;
    this.particlesEnabled = next !== 'low';
    if (!this.particlesEnabled) {
      this._clearParticles();
      if (this.particleContainer) this.particleContainer.visible = false;
    } else {
      if (this.particleContainer) this.particleContainer.visible = true;
      if (this.ready && this.particles.length === 0) {
        this._rebuildParticlesForBiome(this.biome);
      }
    }
    this._syncVisibility();
  }

  _syncVisibility() {
    const hasChimneys = this.chimneys.length > 0;
    const active = this.enabled && this.visible && (this.biome !== 'interior' || hasChimneys);
    if (this.overlayCanvas && this.overlayCanvas.style) {
      this.overlayCanvas.style.display = active ? 'block' : 'none';
    }
    if (this.app && this.app.stage) {
      this.app.stage.visible = active;
    }
    if (this.particleContainer) {
      this.particleContainer.visible = this.enabled && this.visible && this.biome !== 'interior' && this.particlesEnabled;
    }
    if (this.chimneyContainer) {
      this.chimneyContainer.visible = this.enabled && this.visible && hasChimneys && this.particlesEnabled;
    }
  }

  _clearChimneySmoke() {
    for (let i = 0; i < this.chimneySmoke.length; i++) {
      const obj = this.chimneySmoke[i]?.obj;
      if (obj && typeof obj.destroy === 'function') {
        try {
          obj.destroy();
        } catch (_) {}
      }
    }
    if (this.chimneyContainer && typeof this.chimneyContainer.removeChildren === 'function') {
      this.chimneyContainer.removeChildren();
    }
    this.chimneySmoke.length = 0;
  }

  setScene(sceneId) {
    const nextId = sceneId ? String(sceneId) : null;
    const nextTheme = nextId ? getEnvironmentTheme(nextId) : getEnvironmentTheme('interior');
    const nextBiome = nextId ? nextTheme.biomeId : 'interior';
    const prevThemeId = this.theme?.id;
    const sceneChanged = nextId !== this.sceneId;
    const biomeChanged = nextBiome !== this.biome || nextTheme.id !== prevThemeId;
    this.sceneId = nextId;
    this.biome = nextBiome;
    this.theme = nextTheme;
    if (sceneChanged) {
      this.chimneys = [];
      this._clearChimneySmoke();
    }
    this._syncVisibility();

    if ((biomeChanged || sceneChanged) && this.ready) {
      this._rebuildParticlesForBiome(nextBiome);
    }
    return this.biome;
  }

  /**
   * Genera/reinicia las partículas visibles para la escena actual y limpia las anteriores.
   */
  spawnParticles(sceneId, chimneys = null) {
    const targetScene = sceneId !== undefined ? sceneId : this.sceneId;
    this.sceneId = targetScene ? String(targetScene) : this.sceneId;
    this.theme = this.sceneId ? getEnvironmentTheme(this.sceneId) : getEnvironmentTheme('interior');
    this.biome = this.sceneId ? this.theme.biomeId : 'interior';
    this._clearParticles();
    this._clearChimneySmoke();
    if (Array.isArray(chimneys)) {
      this.chimneys = chimneys;
    } else if (sceneId !== undefined) {
      this.chimneys = [];
    }
    this._syncVisibility();
    if (this.ready) {
      this._rebuildParticlesForBiome(this.biome);
      if (this._useRaf && typeof requestAnimationFrame === 'function') {
        this._startRafLoop();
      }
      this.render();
    }
    return this.particles.length;
  }

  _clearParticles() {
    for (let i = 0; i < this.particles.length; i++) {
      const obj = this.particles[i]?.obj;
      if (obj && typeof obj.destroy === 'function') {
        try {
          obj.destroy();
        } catch (_) {}
      }
    }
    if (this.particleContainer) {
      if (typeof this.particleContainer.removeParticles === 'function') {
        this.particleContainer.removeParticles();
      } else if (typeof this.particleContainer.removeChildren === 'function') {
        this.particleContainer.removeChildren();
      }
    }
    this.particles.length = 0;
  }

  _createParticleGraphic(pixi, pType, index = 0) {
    const color = pType === 'glitch'
      ? (index % 2 === 0 ? PARTICLE_COLORS.glitch : PARTICLE_COLORS.glitchDark)
      : (PARTICLE_COLORS[pType] ?? 0xffffff);

    // Código binario ('0' / '1') con Sprite de atlas o PIXI.Text para legibilidad nítida
    if ((pType === 'bit0' || pType === 'bit1')) {
      const tex = this.textures[pType];
      if (tex && typeof pixi.Sprite === 'function' && typeof this.particleContainer.addChild === 'function') {
        const sprite = new pixi.Sprite(tex);
        if (sprite.anchor && typeof sprite.anchor.set === 'function') {
          sprite.anchor.set(0.5);
        }
        sprite.fillColor = color;
        this.particleContainer.addChild(sprite);
        return sprite;
      }
      if (typeof pixi.Text === 'function' && typeof this.particleContainer.addChild === 'function') {
        const glyph = pType === 'bit0' ? '0' : '1';
        const txt = new pixi.Text({
          text: glyph,
          style: { fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: color }
        });
        if (txt.anchor && typeof txt.anchor.set === 'function') {
          txt.anchor.set(0.5);
        }
        txt.fillColor = color;
        this.particleContainer.addChild(txt);
        return txt;
      }
    }

    if (typeof pixi.Graphics === 'function' && typeof this.particleContainer.addChild === 'function') {
      const g = new pixi.Graphics();
      const sizeW = pType === 'glitch'
        ? (index % 3 === 0 ? 12 : 6)
        : pType === 'drip'
          ? 2
          : pType === 'fly'
            ? 3
            : 4;
      const sizeH = pType === 'glitch'
        ? (index % 3 === 0 ? 3 : 6)
        : pType === 'drip'
          ? 9
          : pType === 'fly'
            ? 3
            : 4;
      if (typeof g.rect === 'function' && typeof g.fill === 'function') {
        g.rect(-sizeW / 2, -sizeH / 2, sizeW, sizeH).fill(color);
      } else if (typeof g.beginFill === 'function' && typeof g.drawRect === 'function') {
        g.beginFill(color);
        g.drawRect(-sizeW / 2, -sizeH / 2, sizeW, sizeH);
        g.endFill();
      }
      g.fillColor = color;
      this.particleContainer.addChild(g);
      return g;
    }

    const tex = this.textures[pType] || this.baseTexture || pixi.Texture?.WHITE;
    if (typeof pixi.Particle === 'function' && typeof this.particleContainer.addParticle === 'function') {
      const pObj = new pixi.Particle({
        texture: tex,
        x: 0,
        y: 0,
        anchorX: 0.5,
        anchorY: 0.5
      });
      pObj.fillColor = color;
      this.particleContainer.addParticle(pObj);
      return pObj;
    }
    const sprite = new pixi.Sprite(tex);
    if (sprite.anchor && typeof sprite.anchor.set === 'function') {
      sprite.anchor.set(0.5);
    }
    sprite.fillColor = color;
    this.particleContainer.addChild(sprite);
    return sprite;
  }

  _rebuildParticlesForBiome(biomeId) {
    this._clearParticles();
    if (!this.particlesEnabled) return;
    const pixi = this._getPixi();
    const theme = this.sceneId ? getEnvironmentTheme(this.sceneId) : null;
    const preset = BIOME_PRESETS[biomeId] || BIOME_PRESETS.interior;
    const types = theme && theme.particles && theme.particles.types ? theme.particles.types : preset.types;
    const maxParticles = theme && theme.particles ? theme.particles.count : preset.maxParticles;
    if (!maxParticles || !types.length || !pixi || !this.particleContainer) {
      return;
    }

    const qScale = QUALITY_SCALE[this.quality] || 1;
    const isExact50Scene = (biomeId === 'valleverde' || biomeId === 'forja') && maxParticles === 50;
    const count = isExact50Scene ? maxParticles : Math.max(4, Math.round(maxParticles * qScale));
    for (let i = 0; i < count; i++) {
      const pType = types[i % types.length];
      const displayObj = this._createParticleGraphic(pixi, pType, i);

      const record = {
        type: pType,
        obj: displayObj,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        phase: Math.random() * Math.PI * 2,
        rotSpeed: 0,
        baseAlpha: 0.92,
        scale: 1
      };
      this._resetParticle(record, true);
      this.particles.push(record);
    }
  }

  _resetParticle(p, prefill = false) {
    const w = this.width;
    const h = this.height;
    const dimScale = Math.max(1, w / DEFAULT_LOGICAL_WIDTH);
    const gScale = dimScale > 1 ? 1.25 + Math.random() * 0.65 : 0.75 + Math.random() * 0.4;
    p.phase = Math.random() * Math.PI * 2;
    p.obj.rotation = 0;

    switch (p.type) {
      case 'leaf':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : -8;
        p.vx = (6 + Math.random() * 9) * dimScale;
        p.vy = (14 + Math.random() * 12) * dimScale;
        p.rotSpeed = (Math.random() - 0.5) * 3.0;
        p.scale = gScale;
        p.baseAlpha = 0.92;
        p.maxLife = 6 + Math.random() * 3;
        break;
      case 'pollen':
      case 'firefly':
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.vx = (3 + Math.random() * 4) * dimScale;
        p.vy = (-1 + Math.random() * 3) * dimScale;
        p.rotSpeed = 0;
        p.scale = gScale * (p.type === 'firefly' ? 0.95 : 0.8);
        p.baseAlpha = p.type === 'firefly' ? 0.92 : 0.75;
        p.maxLife = 4 + Math.random() * 3;
        break;
      case 'drip':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : -8;
        p.vx = 0;
        p.vy = (78 + Math.random() * 45) * dimScale;
        p.rotSpeed = 0;
        p.scale = gScale * 0.85;
        p.baseAlpha = 0.82;
        p.maxLife = 2.4;
        break;
      case 'fly':
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.vx = (Math.random() - 0.5) * 24 * dimScale;
        p.vy = (Math.random() - 0.5) * 16 * dimScale;
        p.rotSpeed = 0;
        p.scale = gScale * 0.85;
        p.baseAlpha = 0.85;
        p.maxLife = 2.5 + Math.random() * 2;
        break;
      case 'spark':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : h + 8;
        p.vx = (Math.random() - 0.5) * 18 * dimScale;
        p.vy = -(28 + Math.random() * 26) * dimScale;
        p.rotSpeed = (Math.random() - 0.5) * 2.5;
        p.scale = gScale;
        p.baseAlpha = 0.96;
        p.maxLife = 2.0 + Math.random() * 1.6;
        break;
      case 'smoke':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : h + 8;
        p.vx = (Math.random() - 0.5) * 8 * dimScale;
        p.vy = -(9 + Math.random() * 9) * dimScale;
        p.rotSpeed = (Math.random() - 0.5) * 0.6;
        p.scale = gScale * 1.4;
        p.baseAlpha = 0.35;
        p.maxLife = 3.2 + Math.random() * 2.2;
        break;
      case 'dust':
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.vx = (1.8 + Math.random() * 2.6) * dimScale;
        p.vy = (-0.8 + Math.random() * 1.6) * dimScale;
        p.rotSpeed = 0;
        p.scale = gScale * 0.85;
        p.baseAlpha = 0.78;
        p.maxLife = 4 + Math.random() * 3;
        break;
      case 'bit0':
      case 'bit1':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : -8;
        p.vx = 0;
        p.vy = (20 + Math.random() * 18) * dimScale;
        p.rotSpeed = 0;
        p.scale = gScale * 0.9;
        p.baseAlpha = 0.78;
        p.maxLife = 4.2 + Math.random() * 2.5;
        break;
      case 'glitch':
      default:
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.vx = 0;
        p.vy = 0;
        p.rotSpeed = 0;
        p.scale = gScale;
        p.baseAlpha = 0.58;
        p.maxLife = 0.14 + Math.random() * 0.22;
        break;
    }

    p.life = prefill ? p.maxLife * Math.random() : p.maxLife;
    this._syncParticleTransform(p);
  }

  _syncParticleTransform(p) {
    const obj = p.obj;
    if (!obj) return;
    obj.x = p.x;
    obj.y = p.y;
    if ('scaleX' in obj) {
      obj.scaleX = p.scale;
      obj.scaleY = p.scale;
    } else if (obj.scale && typeof obj.scale.set === 'function') {
      obj.scale.set(p.scale);
    }
    const lifeRatio = Math.max(0, Math.min(1, p.life / Math.max(0.01, p.maxLife)));
    const fade = lifeRatio < 0.2 ? lifeRatio / 0.2 : lifeRatio > 0.85 ? (1 - lifeRatio) / 0.15 : 1;
    obj.alpha = p.baseAlpha * Math.max(0.05, fade);
  }

  _updateWaterBounds(tilemap, camera) {
    if (!this.waterSprite) return;
    if (this.biome !== 'valleverde' || !tilemap || !tilemap.layers || !tilemap.layers.ground) {
      this.waterSprite.visible = false;
      return;
    }

    const ground = tilemap.layers.ground;
    const ts = tilemap.tileSize || 16;
    const camX = camera ? (camera.renderX ?? camera.x ?? 0) : 0;
    const camY = camera ? (camera.renderY ?? camera.y ?? 0) : 0;
    const startCol = Math.max(0, Math.floor(camX / ts));
    const endCol = Math.min((tilemap.cols || 0) - 1, Math.ceil((camX + this.width) / ts));
    const startRow = Math.max(0, Math.floor(camY / ts));
    const endRow = Math.min((tilemap.rows || 0) - 1, Math.ceil((camY + this.height) / ts));

    let minC = Infinity;
    let maxC = -Infinity;
    let minR = Infinity;
    let maxR = -Infinity;
    let found = false;

    for (let r = startRow; r <= endRow; r++) {
      const row = ground[r];
      if (!row) continue;
      for (let c = startCol; c <= endCol; c++) {
        const t = row[c];
        if (t === TILE_WATER_1 || t === TILE_WATER_2) {
          found = true;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
        }
      }
    }

    if (!found) {
      this.waterSprite.visible = false;
      this._waterState.visible = false;
      return;
    }

    const sx = Math.max(0, minC * ts - camX);
    const sy = Math.max(0, minR * ts - camY);
    const ex = Math.min(this.width, (maxC + 1) * ts - camX);
    const ey = Math.min(this.height, (maxR + 1) * ts - camY);
    const sw = Math.max(0, ex - sx);
    const sh = Math.max(0, ey - sy);

    if (sw < 4 || sh < 4) {
      this.waterSprite.visible = false;
      this._waterState.visible = false;
      return;
    }

    this.waterSprite.x = sx;
    this.waterSprite.y = sy;
    this.waterSprite.width = sw;
    this.waterSprite.height = sh;
    this.waterSprite.visible = true;
    this._waterState = { visible: true, x: sx, y: sy, w: sw, h: sh };
  }

  _updateShaders(dt, context) {
    const preset = BIOME_PRESETS[this.biome] || BIOME_PRESETS.interior;
    const shaderKind = preset.shader;

    if (this.heatSprite) {
      const heatOn = shaderKind === 'heat' && this.quality !== 'low';
      this.heatSprite.visible = heatOn;
      if (heatOn && this.heatUniforms?.uniforms) {
        this.heatUniforms.uniforms.uTime = this.time;
        this.heatUniforms.uniforms.uIntensity = this.quality === 'high' ? 1.15 : 1.0;
      }
    }

    if (this.waterSprite) {
      if (shaderKind === 'water' && this.quality !== 'low') {
        this._updateWaterBounds(context.tilemap, context.camera);
        if (this.waterSprite.visible && this.waterUniforms?.uniforms) {
          this.waterUniforms.uniforms.uTime = this.time;
          this.waterUniforms.uniforms.uIntensity = this.quality === 'high' ? 1.1 : 1.0;
        }
      } else {
        this.waterSprite.visible = false;
        this._waterState.visible = false;
      }
    }
    void dt;
  }

  _spawnChimneySmokePuff(chimney) {
    const pixi = this._getPixi();
    if (!pixi || !this.chimneyContainer || !chimney) return;
    const scaleX = this.width / DEFAULT_LOGICAL_WIDTH;
    const scaleY = this.height / DEFAULT_LOGICAL_HEIGHT;
    const sx = (chimney.x - this._chimneyCamX) * scaleX;
    const sy = (chimney.y - this._chimneyCamY) * scaleY;
    if (sx < -32 || sx > this.width + 32 || sy < -32 || sy > this.height + 32) return;

    const shade = Math.random() < 0.5 ? 0xe2e8f0 : 0xcbd5e1;
    let obj;
    if (typeof pixi.Graphics === 'function' && typeof this.chimneyContainer.addChild === 'function') {
      obj = new pixi.Graphics();
      if (typeof obj.rect === 'function' && typeof obj.fill === 'function') {
        obj.rect(-3, -3, 6, 6).fill(shade);
      } else if (typeof obj.beginFill === 'function' && typeof obj.drawRect === 'function') {
        obj.beginFill(shade);
        obj.drawRect(-3, -3, 6, 6);
        obj.endFill();
      }
      this.chimneyContainer.addChild(obj);
    } else if (pixi.Sprite && pixi.Texture?.WHITE && typeof this.chimneyContainer.addChild === 'function') {
      obj = new pixi.Sprite(pixi.Texture.WHITE);
      obj.tint = shade;
      obj.width = 6;
      obj.height = 6;
      this.chimneyContainer.addChild(obj);
    }
    if (!obj) return;

    const puff = {
      obj,
      x: sx + (Math.random() - 0.5) * 4 * scaleX,
      y: sy,
      vx: (3 + Math.random() * 5) * scaleX,
      vy: -(12 + Math.random() * 8) * scaleY,
      life: 1.5 + Math.random() * 0.7,
      maxLife: 2.0,
      scale: Math.max(0.85, scaleX * 0.45),
      phase: Math.random() * Math.PI * 2
    };
    puff.maxLife = puff.life;
    obj.x = puff.x;
    obj.y = puff.y;
    obj.alpha = 0.65;
    this.chimneySmoke.push(puff);
  }

  _stepChimneySmoke(safeDt) {
    if (!this.ready || !this.particlesEnabled) return;
    if (this.chimneys.length > 0 && this.chimneySmoke.length < 72) {
      this._chimneySpawnTimer -= safeDt;
      if (this._chimneySpawnTimer <= 0) {
        this._chimneySpawnTimer = 0.22;
        for (let i = 0; i < this.chimneys.length; i++) {
          this._spawnChimneySmokePuff(this.chimneys[i]);
        }
      }
    }

    const scaleX = Math.max(1, this.width / DEFAULT_LOGICAL_WIDTH);
    for (let i = this.chimneySmoke.length - 1; i >= 0; i--) {
      const p = this.chimneySmoke[i];
      p.life -= safeDt;
      if (p.life <= 0) {
        if (this.chimneyContainer && typeof this.chimneyContainer.removeChild === 'function') {
          try {
            this.chimneyContainer.removeChild(p.obj);
          } catch (_) {}
        }
        if (p.obj && typeof p.obj.destroy === 'function') {
          try {
            p.obj.destroy();
          } catch (_) {}
        }
        this.chimneySmoke.splice(i, 1);
        continue;
      }

      p.x += (p.vx + Math.sin(this.time * 2.2 + p.phase) * 4 * scaleX) * safeDt;
      p.y += p.vy * safeDt;
      p.scale += 0.42 * safeDt;
      const ratio = Math.max(0, p.life / Math.max(0.01, p.maxLife));
      p.obj.x = p.x;
      p.obj.y = p.y;
      p.obj.alpha = 0.62 * ratio;
      if (p.obj.scale && typeof p.obj.scale.set === 'function') {
        p.obj.scale.set(p.scale);
      }
    }
  }

  _startRafLoop() {
    if (this._rafId !== null || this._destroyed || typeof requestAnimationFrame !== 'function') return;
    this._lastRafTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const tick = (now) => {
      if (this._destroyed) {
        this._rafId = null;
        return;
      }
      const cur = typeof now === 'number' ? now : (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const dt = Math.min(Math.max((cur - this._lastRafTs) / 1000, 0), 0.1);
      this._lastRafTs = cur;
      const hasActiveOverlay = this.enabled && this.visible && (this.biome !== 'interior' || this.chimneys.length > 0);
      if (hasActiveOverlay && this.ready) {
        this._stepParticles(dt);
        this._stepChimneySmoke(dt);
        this.render();
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stepParticles(safeDt) {
    this.time += safeDt;
    const swayScale = Math.max(1, this.width / DEFAULT_LOGICAL_WIDTH);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= safeDt;
      if (p.life <= 0) {
        this._resetParticle(p, false);
        continue;
      }

      if (p.type === 'leaf') {
        p.x += (p.vx + Math.sin(this.time * 2.4 + p.phase) * 9 * swayScale) * safeDt;
        p.y += p.vy * safeDt;
        p.obj.rotation += p.rotSpeed * safeDt;
      } else if (p.type === 'fly') {
        p.vx += (Math.random() - 0.5) * 60 * swayScale * safeDt;
        p.vy += (Math.random() - 0.5) * 50 * swayScale * safeDt;
        p.vx = Math.max(-42 * swayScale, Math.min(42 * swayScale, p.vx));
        p.vy = Math.max(-34 * swayScale, Math.min(34 * swayScale, p.vy));
        p.x += (p.vx + Math.cos(this.time * 11 + p.phase) * 20 * swayScale) * safeDt;
        p.y += (p.vy + Math.sin(this.time * 13 + p.phase) * 18 * swayScale) * safeDt;
      } else if (p.type === 'pollen' || p.type === 'dust' || p.type === 'firefly') {
        p.x += (p.vx + Math.sin(this.time * 1.3 + p.phase) * 2.5 * swayScale) * safeDt;
        p.y += (p.vy + Math.cos(this.time * 1.1 + p.phase) * 1.8 * swayScale) * safeDt;
      } else if (p.type === 'glitch') {
        p.x += (Math.random() - 0.5) * 14 * swayScale;
        p.y += 42 * swayScale * safeDt;
      } else {
        p.x += p.vx * safeDt;
        p.y += p.vy * safeDt;
        if (p.rotSpeed) p.obj.rotation += p.rotSpeed * safeDt;
      }

      if (p.x < -12) p.x = this.width + 8;
      else if (p.x > this.width + 12) p.x = -8;
      if (p.y < -12 || p.y > this.height + 12) {
        this._resetParticle(p, false);
        continue;
      }

      this._syncParticleTransform(p);
    }
  }

  update(dt, context = {}) {
    if (this._destroyed) return;
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);

    if (context.sceneId !== undefined && context.sceneId !== this.sceneId) {
      this.setScene(context.sceneId);
    }
    if (Array.isArray(context.chimneys)) {
      const prevLen = this.chimneys.length;
      this.chimneys = context.chimneys;
      if (prevLen !== this.chimneys.length) {
        this._syncVisibility();
      }
    } else if (Array.isArray(context.tilemap?.chimneys)) {
      const prevLen = this.chimneys.length;
      this.chimneys = context.tilemap.chimneys;
      if (prevLen !== this.chimneys.length) {
        this._syncVisibility();
      }
    }
    if (context.camera) {
      this._chimneyCamX = context.camera.renderX ?? context.camera.x ?? 0;
      this._chimneyCamY = context.camera.renderY ?? context.camera.y ?? 0;
    }
    if (context.visible !== undefined) {
      this.setVisible(context.visible);
    }

    const hasChimneys = this.chimneys.length > 0;
    if (!this.enabled || !this.visible || (this.biome === 'interior' && !hasChimneys) || !this.ready) {
      return;
    }
    if (context.paused) return;

    if (this._rafId === null) {
      this._stepParticles(safeDt);
      this._stepChimneySmoke(safeDt);
    }

    if (this.biome !== 'interior') {
      this._updateShaders(safeDt, context);
    }
  }

  render() {
    if (this._destroyed || !this.ready || !this.app) return;
    if (!this.enabled || !this.visible || (this.biome === 'interior' && this.chimneys.length === 0)) return;
    this.syncLayout();
    if (typeof this.app.render === 'function') {
      try {
        this.app.render();
      } catch (err) {
        // Si un filtro GLSL personalizado falla al compilar en WebGL2, desactivar los filtros y mantener las partículas vivas
        if (this.heatSprite && this.heatSprite.filters) this.heatSprite.filters = null;
        if (this.waterSprite && this.waterSprite.filters) this.waterSprite.filters = null;
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[PremiumEffectsManager] Fallo en render PixiJS (filtros desactivados):', err?.message || err);
        }
        try {
          this.app.render();
        } catch (_) {}
      }
    }
  }

  destroy() {
    this._destroyed = true;
    this.ready = false;
    if (this._rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
    this._clearParticles();
    this._clearChimneySmoke();

    if (typeof window !== 'undefined' && this._onResize) {
      window.removeEventListener('resize', this._onResize);
    }
    this._onResize = null;
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this.overlayCanvas && this.overlayCanvas.parentNode) {
      this.overlayCanvas.parentNode.removeChild(this.overlayCanvas);
    }
    if (this.app && typeof this.app.destroy === 'function') {
      try {
        this.app.destroy(true);
      } catch (_) {}
    }
    this.app = null;
    this.pixiApp = null;
    this.overlayCanvas = null;
  }
}
