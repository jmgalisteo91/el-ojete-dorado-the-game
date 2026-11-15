/**
 * PremiumEffectsManager.js
 *
 * Capa transparente de efectos visuales PixiJS v8 superpuesta sobre #game-canvas
 * (sin modificar el motor 2D). Gestiona partículas ambientales por bioma mediante
 * PIXI.ParticleContainer y shaders GLSL 3.0 sutiles para calor (Forja) y agua (Valleverde).
 *
 * En entornos headless (tests Node sin DOM/WebGL) se degrada de forma segura a no-op.
 */

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
    maxParticles: 42,
    types: ['leaf', 'pollen'],
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
    maxParticles: 52,
    types: ['spark', 'smoke'],
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
    maxParticles: 54,
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
  const id = String(sceneId || '').toLowerCase();
  if (!id) return 'interior';
  if (/^(house|shop|inn|jail|rosa_bar)/.test(id) || id.endsWith('_house')) {
    return 'interior';
  }
  if (/^sewers/.test(id)) return 'cloacas';
  if (/^(forge|ai_fortress_gate)/.test(id)) return 'forja';
  if (/temple/.test(id) || /^mines/.test(id)) return 'templos';
  if (/^(ai_|quantum|condemned|citadel|valleverde_corp|inakito_office|vertedero|kernel_arena)/.test(id)) {
    return 'ciudadela';
  }
  if (/^(overworld|first_stage|valley|north_peaks|south_swamp|west_wastes)/.test(id)) {
    return 'valleverde';
  }
  return 'interior';
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

export class PremiumEffectsManager {
  constructor(gameCanvas = null, options = {}) {
    this.gameCanvas = gameCanvas;
    this.width = options.width || DEFAULT_LOGICAL_WIDTH;
    this.height = options.height || DEFAULT_LOGICAL_HEIGHT;
    this.resolution = options.resolution || 2;
    this.quality = QUALITY_SCALE[options.quality] ? options.quality : 'normal';
    this.enabled = options.enabled !== false;
    this.visible = true;

    this._pixiOverride = options.pixi || null;
    this.app = null;
    this.overlayCanvas = null;
    this.shaderContainer = null;
    this.particleContainer = null;
    this.heatSprite = null;
    this.waterSprite = null;
    this.heatUniforms = null;
    this.waterUniforms = null;
    this.textures = {};
    this.baseTexture = null;

    this.sceneId = null;
    this.biome = 'interior';
    this.particles = [];
    this.time = 0;
    this.ready = false;
    this._destroyed = false;
    this._initPromise = null;
    this._resizeObserver = null;
    this._onResize = null;
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
      if (this._destroyed || !pixi || typeof document === 'undefined' || !this.gameCanvas) {
        return false;
      }

      try {
        const app = new pixi.Application();
        await app.init({
          width: this.width,
          height: this.height,
          backgroundAlpha: 0,
          antialias: false,
          resolution: this.resolution,
          autoDensity: false,
          autoStart: false,
          clearBeforeRender: true
        });
        if (this._destroyed) {
          if (typeof app.destroy === 'function') app.destroy(true);
          return false;
        }
        if (app.ticker && typeof app.ticker.stop === 'function') {
          app.ticker.stop();
        }

        this.app = app;
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
        return true;
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[PremiumEffectsManager] PixiJS desactivado (fallback Canvas 2D):', err?.message || err);
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
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '2';
      canvas.style.background = 'transparent';
      canvas.style.userSelect = 'none';
      canvas.style.imageRendering = 'pixelated';
    }

    const parent = target.parentNode;
    if (parent && typeof parent.insertBefore === 'function' && canvas.parentNode !== parent) {
      parent.insertBefore(canvas, target.nextSibling || null);
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

    if (typeof pixi.ParticleContainer === 'function') {
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

  _syncVisibility() {
    const active = this.enabled && this.visible && this.biome !== 'interior';
    if (this.overlayCanvas && this.overlayCanvas.style) {
      this.overlayCanvas.style.display = active ? 'block' : 'none';
    }
    if (this.app && this.app.stage) {
      this.app.stage.visible = active;
    }
  }

  setScene(sceneId) {
    const nextId = sceneId ? String(sceneId) : null;
    const nextBiome = resolveSceneBiome(nextId);
    const biomeChanged = nextBiome !== this.biome;
    this.sceneId = nextId;
    this.biome = nextBiome;
    this._syncVisibility();

    if (biomeChanged && this.ready) {
      this._rebuildParticlesForBiome(nextBiome);
    }
    return this.biome;
  }

  _clearParticles() {
    if (this.particleContainer) {
      if (typeof this.particleContainer.removeParticles === 'function') {
        this.particleContainer.removeParticles();
      } else if (typeof this.particleContainer.removeChildren === 'function') {
        this.particleContainer.removeChildren();
      }
    }
    this.particles.length = 0;
  }

  _rebuildParticlesForBiome(biomeId) {
    this._clearParticles();
    const pixi = this._getPixi();
    const preset = BIOME_PRESETS[biomeId] || BIOME_PRESETS.interior;
    if (!preset.maxParticles || !preset.types.length || !pixi || !this.particleContainer) {
      return;
    }

    const qScale = QUALITY_SCALE[this.quality] || 1;
    const count = Math.max(4, Math.round(preset.maxParticles * qScale));
    for (let i = 0; i < count; i++) {
      const pType = preset.types[i % preset.types.length];
      const tex = this.textures[pType] || this.baseTexture || pixi.Texture?.WHITE;
      let displayObj;
      if (typeof pixi.Particle === 'function' && typeof this.particleContainer.addParticle === 'function') {
        displayObj = new pixi.Particle({
          texture: tex,
          x: 0,
          y: 0,
          anchorX: 0.5,
          anchorY: 0.5
        });
        this.particleContainer.addParticle(displayObj);
      } else {
        displayObj = new pixi.Sprite(tex);
        if (displayObj.anchor && typeof displayObj.anchor.set === 'function') {
          displayObj.anchor.set(0.5);
        }
        this.particleContainer.addChild(displayObj);
      }

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
        baseAlpha: 0.8,
        scale: 1
      };
      this._resetParticle(record, true);
      this.particles.push(record);
    }
  }

  _resetParticle(p, prefill = false) {
    const w = this.width;
    const h = this.height;
    p.phase = Math.random() * Math.PI * 2;
    p.obj.rotation = 0;

    switch (p.type) {
      case 'leaf':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : -6;
        p.vx = 7 + Math.random() * 10;
        p.vy = 11 + Math.random() * 9;
        p.rotSpeed = (Math.random() - 0.5) * 3.2;
        p.scale = 0.65 + Math.random() * 0.45;
        p.baseAlpha = 0.85;
        p.maxLife = 6 + Math.random() * 3;
        break;
      case 'pollen':
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.vx = 3 + Math.random() * 4;
        p.vy = -1 + Math.random() * 3;
        p.rotSpeed = 0;
        p.scale = 0.55 + Math.random() * 0.45;
        p.baseAlpha = 0.7;
        p.maxLife = 4 + Math.random() * 3;
        break;
      case 'drip':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : -8;
        p.vx = 0;
        p.vy = 78 + Math.random() * 45;
        p.rotSpeed = 0;
        p.scale = 0.65 + Math.random() * 0.35;
        p.baseAlpha = 0.72;
        p.maxLife = 2.4;
        break;
      case 'fly':
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.vx = (Math.random() - 0.5) * 24;
        p.vy = (Math.random() - 0.5) * 16;
        p.rotSpeed = 0;
        p.scale = 0.7 + Math.random() * 0.35;
        p.baseAlpha = 0.85;
        p.maxLife = 2.5 + Math.random() * 2;
        break;
      case 'spark':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : h + 4;
        p.vx = (Math.random() - 0.5) * 20;
        p.vy = -(28 + Math.random() * 26);
        p.rotSpeed = (Math.random() - 0.5) * 2;
        p.scale = 0.6 + Math.random() * 0.5;
        p.baseAlpha = 0.95;
        p.maxLife = 1.4 + Math.random() * 1.2;
        break;
      case 'smoke':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : h + 8;
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = -(9 + Math.random() * 9);
        p.rotSpeed = (Math.random() - 0.5) * 0.6;
        p.scale = 0.9 + Math.random() * 0.9;
        p.baseAlpha = 0.28;
        p.maxLife = 3.2 + Math.random() * 2.2;
        break;
      case 'dust':
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.vx = 1.8 + Math.random() * 2.6;
        p.vy = -0.8 + Math.random() * 1.6;
        p.rotSpeed = 0;
        p.scale = 0.55 + Math.random() * 0.55;
        p.baseAlpha = 0.72;
        p.maxLife = 4 + Math.random() * 3;
        break;
      case 'bit0':
      case 'bit1':
        p.x = Math.random() * w;
        p.y = prefill ? Math.random() * h : -8;
        p.vx = 0;
        p.vy = 20 + Math.random() * 18;
        p.rotSpeed = 0;
        p.scale = 0.42 + Math.random() * 0.25;
        p.baseAlpha = 0.62;
        p.maxLife = 4.2 + Math.random() * 2.5;
        break;
      case 'glitch':
      default:
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.vx = 0;
        p.vy = 0;
        p.rotSpeed = 0;
        p.scale = 0.6 + Math.random() * 0.9;
        p.baseAlpha = 0.5;
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

  update(dt, context = {}) {
    if (this._destroyed) return;
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);

    if (context.sceneId !== undefined && context.sceneId !== this.sceneId) {
      this.setScene(context.sceneId);
    }
    if (context.visible !== undefined) {
      this.setVisible(context.visible);
    }

    if (!this.enabled || !this.visible || this.biome === 'interior' || !this.ready) {
      return;
    }
    if (context.paused) return;

    this.time += safeDt;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= safeDt;
      if (p.life <= 0) {
        this._resetParticle(p, false);
        continue;
      }

      if (p.type === 'leaf') {
        p.x += (p.vx + Math.sin(this.time * 2.4 + p.phase) * 9) * safeDt;
        p.y += p.vy * safeDt;
        p.obj.rotation += p.rotSpeed * safeDt;
      } else if (p.type === 'fly') {
        p.x += (p.vx + Math.cos(this.time * 9 + p.phase) * 16) * safeDt;
        p.y += (p.vy + Math.sin(this.time * 11 + p.phase) * 14) * safeDt;
      } else if (p.type === 'pollen' || p.type === 'dust') {
        p.x += (p.vx + Math.sin(this.time * 1.3 + p.phase) * 2.5) * safeDt;
        p.y += (p.vy + Math.cos(this.time * 1.1 + p.phase) * 1.8) * safeDt;
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

    this._updateShaders(safeDt, context);
  }

  render() {
    if (this._destroyed || !this.ready || !this.app) return;
    if (!this.enabled || !this.visible || this.biome === 'interior') return;
    if (typeof this.app.render === 'function') {
      this.app.render();
    }
  }

  destroy() {
    this._destroyed = true;
    this.ready = false;
    this._clearParticles();

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
    this.overlayCanvas = null;
  }
}
