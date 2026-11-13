/**
 * AnimeCutsceneManager.js
 * 
 * Subsistema de cinemáticas tipo Novela Visual / Anime Retro (estilo PC-98 / Yuppie Psycho).
 * Diseñado para momentos clave: encuentros con Mister AI Alex, arrestos carcelarios,
 * revelaciones del Sabio y redenciones en los Reinos Condenados.
 * 
 * Características principales:
 * - Renderizado basado en IMÁGENES REALES (soporta rutas locales y strings Base64 / Data-URIs).
 * - Renderizado en Canvas con ctx.drawImage() y imageSmoothingEnabled = false para pixel art.
 * - Barras cinematográficas (Letterbox) superior e inferior.
 * - Caja de diálogo retro con bordes neón/dorados y tipografía monoespaciada pixel art.
 * - Efecto Typewriter (máquina de escribir) con avance rápido [Espacio/E] y salto [Escape].
 * - Efectos visuales de impacto: cameraShake (sacudida de pantalla) y flash (destellos de color).
 */

import {
  CUTSCENE_IMAGES,
  renderFallbackToContext,
  getCutsceneImage
} from '../assets/CutsceneImages.js?v=8';
import {
  SCENE_AI_ALEX_WARNING,
  SCENE_AI_ALEX_PREBATTLE,
  SCENE_ENDING_VICTORY
} from '../assets/VillainDialogues.js?v=8';

export class AnimeCutsceneManager {
  constructor(viewportWidth = 320, viewportHeight = 180, music = null) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.music = music;

    this.isActive = false;
    this.currentScene = null;
    this.currentSlideIndex = 0;
    this.onComplete = null;
    this.previousMusicMode = null;

    // Caché de imágenes cargadas (Map<src, HTMLImageElement>)
    this.imageCache = new Map();

    // Typewriter
    this.visibleChars = 0;
    this.charSpeed = 44; // caracteres por segundo
    this.textFinished = false;
    this.timeSinceTextFinished = 0;
    this.lastVoiceCharIdx = -1;

    // Efectos de cámara y pantalla
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.shakeOffset = { x: 0, y: 0 };

    // (BLOQUE 3) Cámara viva, partículas y transiciones.
    this.cameraZoom = 1;
    this.cameraPan = { x: 0, y: 0 };
    this.slideElapsed = 0;
    this.cutsceneParticles = [];
    this.cutsceneParticleType = 'dust';
    this.particleSpawnAccumulator = 0;
    this.transitionAlpha = 0;
    this.transitionPhase = 'idle';
    this.transitionTimer = 0;
    this.pendingAdvance = null;
    this.effectsEnabled = true;

    this.flashColor = '#ffffff';
    this.flashAlpha = 0;
    this.flashSpeed = 4.0;

    // Tiempo acumulado para animaciones de interfaz
    this.animTimer = 0;

    // Dimensiones letterbox (barras negras cinematográficas)
    this.letterboxHeight = 14;
  }

  /**
   * Obtiene o precarga un objeto de imagen a partir de una ruta o Data-URI Base64.
   * @param {string} src Ruta o Data-URI
   * @returns {HTMLImageElement|null}
   */
  getImage(src) {
    if (!src || typeof src !== 'string') return null;

    if (this.imageCache.has(src)) {
      return this.imageCache.get(src);
    }

    if (typeof Image === 'undefined') {
      // Entorno headless/Node (para pruebas unitarias)
      return null;
    }

    const img = new Image();
    img.src = src;
    this.imageCache.set(src, img);
    return img;
  }

  /**
   * Inicia la reproducción de una cinemática.
   * @param {Object} cutsceneData Objeto con { id, title, musicMode, slides: [...] }
   * @param {Function} onComplete Callback invocado al terminar o saltar la cinemática
   */
  playCutscene(cutsceneData, onComplete = null) {
    if (Array.isArray(cutsceneData)) {
      cutsceneData = {
        id: cutsceneData.id || 'cutscene_dialogue',
        title: cutsceneData.title || 'Cinemática',
        musicMode: cutsceneData.musicMode || null,
        slides: cutsceneData
      };
    }

    if (!cutsceneData || !Array.isArray(cutsceneData.slides) || cutsceneData.slides.length === 0) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    // Paginación automática en diapositivas ([1/2], [2/2]) si el texto excede el alto disponible
    const paginatedSlides = [];
    const maxCharsPerLine = 44;
    const maxLinesPerSlide = 3;

    for (const slide of cutsceneData.slides) {
      const fullText = slide.dialogue || slide.text || '';
      const wrapped = this._wrapText(fullText, maxCharsPerLine);
      if (wrapped.length <= maxLinesPerSlide) {
        paginatedSlides.push({ ...slide, text: fullText, dialogue: fullText });
      } else {
        const totalSub = Math.ceil(wrapped.length / maxLinesPerSlide);
        for (let i = 0; i < wrapped.length; i += maxLinesPerSlide) {
          const subIdx = Math.floor(i / maxLinesPerSlide) + 1;
          const subText = wrapped.slice(i, i + maxLinesPerSlide).join(' ');
          paginatedSlides.push({
            ...slide,
            text: subText,
            dialogue: subText,
            speakerTitle: slide.speakerTitle
              ? `${slide.speakerTitle} [${subIdx}/${totalSub}]`
              : `[${subIdx}/${totalSub}]`
          });
        }
      }
    }

    const processedScene = {
      ...cutsceneData,
      slides: paginatedSlides
    };

    this.isActive = true;
    this.currentScene = processedScene;
    this.currentSlideIndex = 0;
    this.onComplete = typeof onComplete === 'function' ? onComplete : null;
    this.slideLockTimer = 0.16;
    this.cutsceneParticles = [];
    this.transitionPhase = 'in';
    this.transitionTimer = 0;
    this.transitionAlpha = 1;
    this.pendingAdvance = null;
    this.cameraZoom = 1;
    this.cameraPan = { x: 0, y: 0 };
    this.slideElapsed = 0;

    this.previousMusicMode = this.music && this.music.mode ? this.music.mode : null;

    if (processedScene.musicMode && this.music) {
      this.music.setMode(processedScene.musicMode);
    }

    // Precargar imágenes de la escena
    for (const slide of processedScene.slides) {
      const src = this._resolveSlideImageSrc(slide);
      if (src) {
        this.getImage(src);
      }
    }

    this._setupSlide(this.currentSlideIndex);
  }

  /**
   * Finaliza la cinemática actual y devuelve el control al juego.
   */
  endCutscene(skipped = false) {
    if (!this.isActive) return;

    this.isActive = false;
    this.shakeTimer = 0;
    this.shakeOffset = { x: 0, y: 0 };
    this.flashAlpha = 0;
    this.slideLockTimer = 0;
    this.cutsceneParticles = [];
    this.transitionAlpha = 0;
    this.transitionPhase = 'idle';
    this.pendingAdvance = null;

    const prevMusic = this.previousMusicMode;
    const hadSceneMusic = Boolean(this.currentScene && this.currentScene.musicMode);
    this.previousMusicMode = null;

    const cb = this.onComplete;
    this.onComplete = null;
    this.currentScene = null;

    if (this.music && prevMusic && hadSceneMusic) {
      this.music.setMode(prevMusic, 0);
    }

    if (typeof cb === 'function') {
      cb(skipped);
    }
  }

  _resolveSlideImageSrc(slide) {
    if (!slide) return null;
    if (slide.imageSrc) return slide.imageSrc;
    if (slide.imageKey) {
      if (CUTSCENE_IMAGES && CUTSCENE_IMAGES[slide.imageKey]) {
        return CUTSCENE_IMAGES[slide.imageKey];
      }
      return getCutsceneImage(slide.imageKey, slide.speaker, slide.theme);
    }
    if (slide.artType && CUTSCENE_IMAGES && CUTSCENE_IMAGES[slide.artType]) {
      return CUTSCENE_IMAGES[slide.artType];
    }
    return null;
  }

  _setupSlide(index) {
    const slide = this.currentScene.slides[index];
    if (!slide) {
      this.endCutscene(false);
      return;
    }

    this.visibleChars = 0;
    this.textFinished = false;
    this.timeSinceTextFinished = 0;
    this.lastVoiceCharIdx = -1;
    this.slideLockTimer = 0.14;
    this.slideElapsed = 0;
    this.cutsceneParticles = [];
    this.particleSpawnAccumulator = 0;
    this.cutsceneParticleType = this._resolveCutsceneParticles(slide);
    this.transitionAlpha = this.effectsEnabled ? 1 : 0;
    this.transitionTimer = 0;
    this.cameraZoom = Number.isFinite(slide.cameraZoom) ? slide.cameraZoom : 1;
    this.cameraPan = { x: 0, y: 0 };

    // Efecto de sacudida opcional al entrar a la diapositiva (shake o cameraShake)
    const shakeParam = slide.cameraShake !== undefined ? slide.cameraShake : slide.shake;
    if (shakeParam) {
      const intensity = typeof shakeParam === 'object' ? (shakeParam.intensity || 3.5) : 3.8;
      const duration = typeof shakeParam === 'object' ? (shakeParam.duration || 0.28) : 0.28;
      this.cameraShake(intensity, duration);
    }

    // Efecto de destello de color al entrar
    const flashParam = slide.flash;
    if (flashParam) {
      const color = typeof flashParam === 'object' ? (flashParam.color || '#ffffff') : '#ffffff';
      const duration = typeof flashParam === 'object' ? (flashParam.duration || 0.22) : 0.22;
      this.flash(color, duration);
    }

    // Efecto sonoro temático
    if (slide.sfx && this.music) {
      if (slide.sfx === 'hurt' && typeof this.music.playPlayerHurt === 'function') {
        this.music.playPlayerHurt();
      } else if (slide.sfx === 'fanfare' && typeof this.music.playFanfare === 'function') {
        this.music.playFanfare();
      } else if (slide.sfx === 'select' && typeof this.music.playMenuSelect === 'function') {
        this.music.playMenuSelect();
      }
    }

    if (typeof slide.onEnter === 'function') {
      slide.onEnter(this);
    }
  }

  /** Solicita un fundido a negro y luego avanza/termina la cinemática. */
  _requestSlideAdvance() {
    if (!this.currentScene || this.transitionPhase === 'out') return;
    this.transitionPhase = 'out';
    this.transitionTimer = 0;
    this.pendingAdvance = this.currentSlideIndex + 1 < this.currentScene.slides.length ? 'next' : 'end';
  }

  _resolveCutsceneParticles(slide) {
    const explicit = slide && (slide.particles || slide.ambient);
    if (typeof explicit === 'string') return explicit;
    if (Array.isArray(explicit) && explicit.length) return explicit[0];
    const id = String((this.currentScene && this.currentScene.id) || '').toLowerCase();
    const theme = String((slide && slide.theme) || '').toLowerCase();
    if (theme === 'jail') return 'dust';
    if (theme === 'divine') return 'sparks';
    if (id.includes('alex')) return id.includes('prebattle') ? 'rain' : 'glitch';
    if (id.includes('ending') || id.includes('victory') || theme === 'ending') return 'sparks';
    return 'dust';
  }

  _makeCutsceneParticle(W, H) {
    const artY = this.letterboxHeight;
    const artH = H - this.letterboxHeight * 2;
    const type = this.cutsceneParticleType;
    const p = {
      type, x: Math.random() * W, y: artY + Math.random() * artH,
      vx: 0, vy: 0, life: 1, maxLife: 1, size: 1, color: '#cbd5e1',
      phase: Math.random() * Math.PI * 2, w: 2, h: 1
    };
    if (type === 'rain') {
      p.x = Math.random() * W;
      p.y = artY - 8 - Math.random() * 20;
      p.vx = -14; p.vy = 150 + Math.random() * 50;
      p.life = p.maxLife = 1.0; p.color = '#7dd3fc'; p.size = 1;
    } else if (type === 'snow') {
      p.x = Math.random() * W; p.y = artY + Math.random() * artH;
      p.vx = (Math.random() - 0.5) * 6; p.vy = 14 + Math.random() * 10;
      p.life = p.maxLife = 3.5 + Math.random() * 2; p.color = '#e2e8f0'; p.size = 1;
    } else if (type === 'sparks') {
      p.x = Math.random() * W; p.y = artY + artH - Math.random() * 12;
      p.vx = (Math.random() - 0.5) * 20; p.vy = -28 - Math.random() * 34;
      p.life = p.maxLife = 0.8 + Math.random() * 0.8;
      p.color = Math.random() < 0.5 ? '#fde047' : '#f97316'; p.size = 1;
    } else if (type === 'glitch') {
      p.x = Math.random() * W; p.y = artY + Math.random() * artH;
      p.vx = 0; p.vy = 0; p.life = p.maxLife = 0.1 + Math.random() * 0.22;
      p.w = 2 + Math.random() * 22; p.h = 1 + Math.random() * 2;
      p.color = Math.random() < 0.5 ? '#22d3ee' : '#c084fc';
    } else {
      p.x = Math.random() * W; p.y = artY + Math.random() * artH;
      p.vx = (Math.random() - 0.5) * 8; p.vy = -3 - Math.random() * 5;
      p.life = p.maxLife = 2.5 + Math.random() * 2.5; p.color = '#94a3b8'; p.size = 1;
    }
    return p;
  }

  _updateCutsceneParticles(dt, slide) {
    if (!this.effectsEnabled) {
      this.cutsceneParticles = [];
      return;
    }
    const W = this.viewportWidth;
    const H = this.viewportHeight;
    const artY = this.letterboxHeight;
    const artH = H - this.letterboxHeight * 2;
    const rate = { rain: 70, snow: 24, sparks: 28, glitch: 20, dust: 9 }[this.cutsceneParticleType] || 8;
    this.particleSpawnAccumulator += dt * rate;
    let guard = 0;
    while (this.particleSpawnAccumulator >= 1 && this.cutsceneParticles.length < 52 && guard++ < 6) {
      this.particleSpawnAccumulator -= 1;
      this.cutsceneParticles.push(this._makeCutsceneParticle(W, H));
    }
    const t = this.animTimer;
    for (let i = this.cutsceneParticles.length - 1; i >= 0; i--) {
      const p = this.cutsceneParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.cutsceneParticles.splice(i, 1);
        continue;
      }
      if (p.type === 'rain') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.type === 'snow') {
        p.x += p.vx * dt + Math.sin(t * 1.5 + p.phase) * 6 * dt;
        p.y += p.vy * dt;
      } else if (p.type === 'sparks') {
        p.vy += 30 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.type === 'dust') {
        p.x += p.vx * dt + Math.sin(t + p.phase) * 2 * dt;
        p.y += p.vy * dt;
      }
      if (p.x < -10 || p.x > W + 10 || p.y > artY + artH + 12 || p.y < artY - 24) {
        this.cutsceneParticles.splice(i, 1);
      }
    }
  }

  _renderCutsceneParticles(ctx, W, H) {
    if (!this.effectsEnabled || !this.cutsceneParticles.length) return;
    const artY = this.letterboxHeight;
    const artH = H - this.letterboxHeight * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, artY, W, artH);
    ctx.clip();
    for (const p of this.cutsceneParticles) {
      const alpha = Math.max(0, Math.min(1, p.life / Math.max(0.01, p.maxLife)));
      if (p.type === 'rain') {
        ctx.globalAlpha = 0.25 + alpha * 0.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 1.5, p.y + 5);
        ctx.stroke();
      } else if (p.type === 'snow') {
        ctx.globalAlpha = 0.3 + alpha * 0.6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'sparks') {
        ctx.globalAlpha = 0.35 + alpha * 0.65;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 1, 2);
      } else if (p.type === 'glitch') {
        ctx.globalAlpha = 0.25 + Math.random() * 0.45;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.w, p.h);
      } else {
        ctx.globalAlpha = 0.15 + alpha * 0.35;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 1, 1);
      }
    }
    ctx.restore();
  }

  cameraShake(intensity = 3.5, duration = 0.25) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  flash(color = '#ffffff', duration = 0.2) {
    this.flashColor = color;
    this.flashAlpha = 1.0;
    this.flashSpeed = 1.0 / Math.max(0.05, duration);
  }

  update(dt, input) {
    if (!this.isActive || !this.currentScene) return;

    this.animTimer += dt;
    if (this.slideLockTimer > 0) {
      this.slideLockTimer = Math.max(0, this.slideLockTimer - dt);
    }

    // Actualización de temblor de cámara
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      this.shakeOffset.x = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeOffset.y = (Math.random() - 0.5) * 2 * this.shakeIntensity;
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }

    // Actualización de destello en pantalla
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * this.flashSpeed);
    }

    const slide = this.currentScene.slides[this.currentSlideIndex];
    if (!slide) return;

    // (BLOQUE 3.1/3.3/3.4) Ken Burns + respiración de cámara + partículas.
    this.slideElapsed += dt;
    if (this.effectsEnabled) {
      const baseZoom = Number.isFinite(slide.cameraZoom) ? slide.cameraZoom : 1;
      const ken = slide.kenBurns === false ? 0 : Math.min(0.06, this.slideElapsed * 0.005);
      this.cameraZoom = baseZoom + ken + Math.sin(this.animTimer * 0.7) * 0.006;
      const pan = slide.cameraPan || {};
      this.cameraPan.x = (pan.x || 0) + Math.sin(this.animTimer * 0.5) * 2;
      this.cameraPan.y = (pan.y || 0) + Math.cos(this.animTimer * 0.4) * 1.4;
    } else {
      this.cameraZoom = 1;
      this.cameraPan.x = 0;
      this.cameraPan.y = 0;
    }
    this._updateCutsceneParticles(dt, slide);

    // (BLOQUE 3.2) Fundido a negro entre diapositivas.
    if (this.transitionPhase === 'out') {
      this.transitionTimer += dt;
      this.transitionAlpha = Math.min(1, this.transitionTimer / 0.18);
      if (this.transitionTimer >= 0.18) {
        if (this.pendingAdvance === 'end') {
          this.endCutscene(false);
          return;
        }
        this.currentSlideIndex += 1;
        this._setupSlide(this.currentSlideIndex);
        this.transitionPhase = 'in';
        this.transitionTimer = 0;
        this.pendingAdvance = null;
      }
      return;
    }
    this.transitionAlpha = Math.max(0, this.transitionAlpha - dt / 0.35);
    if (this.transitionPhase === 'in' && this.transitionAlpha <= 0) {
      this.transitionPhase = 'idle';
    }

    const fullText = slide.dialogue || slide.text || '';

    // Avance del efecto Typewriter
    if (!this.textFinished) {
      this.visibleChars = Math.min(fullText.length, this.visibleChars + this.charSpeed * dt);
      const curIdx = Math.floor(this.visibleChars);
      if (
        this.music &&
        curIdx > this.lastVoiceCharIdx &&
        curIdx < fullText.length &&
        fullText[curIdx] !== ' ' &&
        curIdx % 2 === 0
      ) {
        this.lastVoiceCharIdx = curIdx;
        if (typeof this.music.playVoiceBlip === 'function') {
          this.music.playVoiceBlip(slide.speaker || '', fullText[curIdx]);
        }
      }

      if (this.visibleChars >= fullText.length) {
        this.textFinished = true;
        this.timeSinceTextFinished = 0;
      }
    } else {
      this.timeSinceTextFinished += dt;
      // Auto-avance de seguridad tras 4.2 segundos con el texto completado
      if (this.timeSinceTextFinished >= 4.2) {
        if (input) {
          input.consumeInteraction();
          input.consumePointerClick();
        }
        this._requestSlideAdvance();
        return;
      }
    }

    // Manejo de entradas
    if (input) {
      // Omitir cinemática completa con [Escape]
      if (input.consumeKey('Escape')) {
        this.endCutscene(true);
        return;
      }

      // Interactuar con [E], [Espacio], [Enter] o Clic
      const interacted = input.consumeInteraction() || input.consumePointerClick();
      if (interacted && this.slideLockTimer <= 0) {
        if (!this.textFinished) {
          // Si el texto aún se escribe, completarlo de inmediato
          this.visibleChars = fullText.length;
          this.textFinished = true;
          this.timeSinceTextFinished = 0;
          this.slideLockTimer = 0.12;
          if (this.music && typeof this.music.playMenuMove === 'function') {
            this.music.playMenuMove();
          }
        } else {
          // Si ya está completo, avanzar a la siguiente diapositiva
          if (this.music && typeof this.music.playMenuSelect === 'function') {
            this.music.playMenuSelect();
          }
          this._requestSlideAdvance();
        }
      }
    }
  }

  render(ctx) {
    if (!this.isActive || !this.currentScene) return;

    const W = this.viewportWidth;
    const H = this.viewportHeight;
    const t = this.animTimer;
    const slide = this.currentScene.slides[this.currentSlideIndex] || {};

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Aplicar temblor de cámara si existe
    if (this.shakeTimer > 0) {
      ctx.translate(Math.round(this.shakeOffset.x), Math.round(this.shakeOffset.y));
    }

    // 1. Ilustración de fondo de la escena (renderizada a partir de imagen real)
    this._renderSceneIllustration(ctx, slide, W, H);

    // 1b. Partículas cinematográficas sobre la ilustración
    this._renderCutsceneParticles(ctx, W, H);

    // 2. Barras negras cinematográficas (Letterbox) superior e inferior
    this._renderLetterboxBars(ctx, W, H);

    // 3. Caja de Diálogo Retro (Typewriter Visual Novel Box)
    this._renderVisualNovelBox(ctx, slide, t, W);

    // 4. Destello de pantalla (Flash)
    if (this.flashAlpha > 0) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = Math.min(1, Math.max(0, this.flashAlpha));
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1.0;
    }

    // (BLOQUE 3.2) Fundido/entrada desde negro.
    if (this.transitionAlpha > 0) {
      ctx.globalAlpha = Math.min(1, this.transitionAlpha);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }

  /**
   * Renderiza la imagen real de la diapositiva en el canvas.
   * Sin formas geométricas ni trazados procedurales.
   */
  _renderSceneIllustration(ctx, slide, W, H) {
    const artY = this.letterboxHeight;
    const artH = H - this.letterboxHeight * 2;

    const src = this._resolveSlideImageSrc(slide);
    const img = src ? this.getImage(src) : null;
    const zoom = this.effectsEnabled ? this.cameraZoom : 1;
    const panX = this.effectsEnabled ? this.cameraPan.x : 0;
    const panY = this.effectsEnabled ? this.cameraPan.y : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, artY, W, artH);
    ctx.clip();
    ctx.translate(W / 2 + panX, artY + artH / 2 + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -(artY + artH / 2));

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, artY, W, artH);
    } else {
      // Fallback procedural nítido de alta definición (Canvas Synthwave 3D Grid)
      ctx.beginPath();
      ctx.rect(0, artY, W, artH);
      ctx.clip();
      renderFallbackToContext(
        ctx,
        W,
        H,
        slide.speaker || 'SYSTEM ARCHIVE',
        'CONECTANDO TERMINAL RETRO...',
        slide.theme || 'cyber'
      );
    }
    ctx.restore();
  }

  _renderLetterboxBars(ctx, W, H) {
    const barH = this.letterboxHeight;

    ctx.fillStyle = '#05070d';
    // Barra superior
    ctx.fillRect(0, 0, W, barH);
    // Barra inferior
    ctx.fillRect(0, H - barH, W, barH);

    // Borde delimitador sutil
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barH - 0.5);
    ctx.lineTo(W, barH - 0.5);
    ctx.moveTo(0, H - barH + 0.5);
    ctx.lineTo(W, H - barH + 0.5);
    ctx.stroke();

    // Indicadores retro en la barra superior
    ctx.save();
    ctx.font = 'bold 5.5px monospace';
    ctx.textBaseline = 'middle';

    // Badge "● REC · VISUAL NOVEL" con pulso rojo
    const recPulse = Math.sin(this.animTimer * 5) > 0 ? '#ef4444' : '#7f1d1d';
    ctx.fillStyle = recPulse;
    ctx.fillRect(8, Math.round(barH / 2) - 2.5, 4, 4);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText('ANIME ARCHIVE // SYSTEM MEMORY', 16, Math.round(barH / 2));

    // Contador de diapositivas y botón de omitir
    const slideInfo = `${this.currentSlideIndex + 1}/${this.currentScene.slides.length}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`[ESC] OMITIR · (${slideInfo})`, W - 8, Math.round(barH / 2));
    ctx.restore();
  }

  _renderVisualNovelBox(ctx, slide, t, W) {
    const boxX = 12;
    const boxY = 112;
    const boxW = W - 24;
    const boxH = 50;

    const theme = slide.theme || 'cyber';
    let borderColor = '#38bdf8';
    let cornerAccent = '#0284c7';
    let nameBg = '#0f172a';
    let nameTextColor = '#38bdf8';

    if (theme === 'jail') {
      borderColor = '#f59e0b';
      cornerAccent = '#b45309';
      nameBg = '#1c1917';
      nameTextColor = '#fbbf24';
    } else if (theme === 'divine') {
      borderColor = '#fde047';
      cornerAccent = '#ca8a04';
      nameBg = '#1e1b4b';
      nameTextColor = '#fef08a';
    } else if (theme === 'danger' || theme === 'threat') {
      borderColor = '#f43f5e';
      cornerAccent = '#9f1239';
      nameBg = '#18040a';
      nameTextColor = '#fb7185';
    }

    if (slide.speakerColor) {
      nameTextColor = slide.speakerColor;
    }

    // Fondo del cuadro con transparencia y tinte oscuro
    ctx.save();
    ctx.fillStyle = 'rgba(7, 10, 20, 0.94)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Borde exterior
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

    // Pequeñas muescas angulares en las 4 esquinas (estilo interfaz PC-98)
    ctx.fillStyle = cornerAccent;
    ctx.fillRect(boxX, boxY, 3, 3);
    ctx.fillRect(boxX + boxW - 3, boxY, 3, 3);
    ctx.fillRect(boxX, boxY + boxH - 3, 3, 3);
    ctx.fillRect(boxX + boxW - 3, boxY + boxH - 3, 3, 3);

    // Badge con el nombre del personaje y su título
    const speakerName = slide.speaker || '';
    const speakerTitle = slide.speakerTitle ? ` · ${slide.speakerTitle}` : '';
    const fullSpeakerText = speakerName ? `${speakerName}${speakerTitle}` : '';
    if (fullSpeakerText) {
      ctx.font = 'bold 6px monospace';
      const textW = Math.ceil(ctx.measureText(fullSpeakerText).width);
      const tagW = textW + 12;
      const tagH = 11;
      const tagX = boxX + 8;
      const tagY = boxY - 6;

      ctx.fillStyle = nameBg;
      ctx.fillRect(tagX, tagY, tagW, tagH);
      ctx.strokeStyle = borderColor;
      ctx.strokeRect(tagX + 0.5, tagY + 0.5, tagW - 1, tagH - 1);

      ctx.fillStyle = nameTextColor;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(fullSpeakerText, tagX + 6, tagY + tagH / 2);
    }

    // Renderizado del texto con Typewriter (soporta tanto dialogue como text)
    const rawText = slide.dialogue || slide.text || '';
    const visibleCount = Math.floor(this.visibleChars);
    const visibleString = rawText.substring(0, visibleCount);

    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const maxLineChars = 46;
    const lines = this._wrapText(visibleString, maxLineChars);
    const lineSpacing = 9.5;
    const startTextX = boxX + 10;
    const startTextY = boxY + 9;

    for (let i = 0; i < lines.length && i < 4; i++) {
      ctx.fillText(lines[i], startTextX, startTextY + i * lineSpacing);
    }

    // Indicador de avance interactivo
    if (this.textFinished) {
      const bob = Math.sin(t * 6) * 1.5;
      ctx.fillStyle = borderColor;
      ctx.font = 'bold 6.5px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('▼ [E / Espacio / Clic]', boxX + boxW - 8, boxY + boxH - 10 + bob);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '5.5px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('[E / Espacio] Rápido', boxX + boxW - 8, boxY + boxH - 9);
    }

    ctx.restore();
  }

  _wrapText(text, maxChars) {
    if (!text) return [];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const w of words) {
      if ((currentLine + (currentLine ? ' ' : '') + w).length <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + w;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}

// =========================================================================
// CATÁLOGO DE LAS 4 ESCENAS MAESTRAS (Novela Visual / Anime Retro)
// =========================================================================

// Re-exportamos las cinemáticas maestras de Mister AI Alex desde VillainDialogues.js
export {
  SCENE_AI_ALEX_WARNING,
  SCENE_AI_ALEX_PREBATTLE,
  SCENE_ENDING_VICTORY
};

/**
 * 2. SCENE_JAIL_ARREST: Sentencia Definitiva y Cadena Perpetua por el Carcelero Real
 */
export const SCENE_JAIL_ARREST = {
  id: 'scene_jail_arrest',
  title: 'Sentencia Definitiva en el Calabozo',
  musicMode: 'game_over',
  slides: [
    {
      speaker: 'CARCELERO REAL · VIGILANTE DEL CALABOZO',
      speakerColor: '#f59e0b',
      theme: 'jail',
      imageKey: 'JAIL_ARREST_1',
      imageSrc: CUTSCENE_IMAGES.JAIL_ARREST_1,
      text: '¡¡SE ACABÓ LA TONTERÍA!! ¡Tus provocaciones y desplantes han colmado el último ciclo de reloj de mi paciencia!',
      shake: { intensity: 4, duration: 0.35 },
      flash: { color: '#ffffff', duration: 0.2 },
      sfx: 'hurt'
    },
    {
      speaker: 'CARCELERO REAL',
      speakerColor: '#f59e0b',
      theme: 'jail',
      imageKey: 'JAIL_ARREST_2',
      imageSrc: CUTSCENE_IMAGES.JAIL_ARREST_2,
      text: '¡He lanzado la llave maestra a las cloacas del abismo! A partir de este instante no existe fianza, ni apelación, ni sobornos con pan.',
      shake: { intensity: 2.5, duration: 0.25 }
    },
    {
      speaker: 'TRIBUNAL DE LA GUARDIA DEL BINARIO',
      speakerColor: '#ef4444',
      theme: 'danger',
      imageKey: 'JAIL_ARREST_3',
      imageSrc: CUTSCENE_IMAGES.JAIL_ARREST_3,
      text: 'CONDENA PERPETUA CONFIRMADA: Tu aventura termina aquí, entre muros de piedra fría y barrotes oxidados. Acepta tu condena...',
      shake: { intensity: 5, duration: 0.4 },
      flash: { color: '#ef4444', duration: 0.3 }
    }
  ]
};

/**
 * 3. SCENE_DEUS_PURIFICATION: Audiencia de Purificación con el Dios Supremo en Reinos Condenados
 */
export const SCENE_DEUS_PURIFICATION = {
  id: 'scene_deus_purification',
  title: 'El Juicio del Dios Supremo en los Reinos Condenados',
  musicMode: 'village',
  slides: [
    {
      speaker: 'DIOS SUPREMO · DEIDAD DE LA REDENCIÓN',
      speakerColor: '#fde047',
      theme: 'divine',
      imageKey: 'DEUS_PURIFICATION_1',
      imageSrc: CUTSCENE_IMAGES.DEUS_PURIFICATION_1,
      text: 'Mortal... Has descendido al abismo de los Reinos Condenados portando la marca del desacato y la fractura del alma.',
      flash: { color: '#fde047', duration: 0.25 }
    },
    {
      speaker: 'DIOS SUPREMO',
      speakerColor: '#fde047',
      theme: 'divine',
      imageKey: 'DEUS_PURIFICATION_2',
      imageSrc: CUTSCENE_IMAGES.DEUS_PURIFICATION_2,
      text: 'Que el resplandor cósmico del compilador sagrado suelde tu corazón roto. Tu expediente penal queda purificado.',
      shake: { intensity: 3, duration: 0.3 },
      flash: { color: '#ffffff', duration: 0.35 },
      sfx: 'fanfare'
    },
    {
      speaker: 'DIOS SUPREMO · BENDICIÓN CELESTIAL',
      speakerColor: '#38bdf8',
      theme: 'divine',
      imageKey: 'DEUS_PURIFICATION_3',
      imageSrc: CUTSCENE_IMAGES.DEUS_PURIFICATION_3,
      text: 'Regresa al plano terrenal por el portal del mediodía. Camina con cautela y honra tu destino ante el Ojete Dorado.',
      flash: { color: '#38bdf8', duration: 0.2 }
    }
  ]
};

/**
 * Alias retrocompatible
 */
export { SCENE_VICTORY_CREDITS } from '../assets/VillainDialogues.js?v=8';

export {
  SCENE_INTRO_GARBAGE_COLLECTOR,
  SCENE_INTRO_STACK_OVERFLOW,
  SCENE_INTRO_PROTOTYPE_MICROWAVE,
  BOSS_CUTSCENES,
  getBossIntroCutscene
} from '../assets/BossCutscenes.js?v=8';
