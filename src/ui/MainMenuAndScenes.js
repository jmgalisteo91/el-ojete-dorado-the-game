import { CHARACTER_TYPES, ITEM_ICONS, ATLAS_SCALE } from '../graphics/SpriteSheetGenerator.js?v=8';
import { WorldMap } from './WorldMap.js?v=8';
import { EndingCredits } from './EndingCredits.js?v=8';
import { GAME_FONT_UI, drawRoundedRect } from './SpeechBubble.js?v=8';
import { getLocalLeaderboard, fetchGlobalLeaderboard } from '../core/ScoreSystem.js?v=8';
import { LeaderboardView } from './LeaderboardView.js?v=8';
import { UILayout, GAME_VERSION } from './UILayout.js?v=8';
import { EXPANSION_INFO, EXPANSION_UNLOCK_KEY } from '../expansion/ExpansionData.js?v=8';

/**
 * Sistema de Menú de Inicio, Pausa, Guardado/Carga, Opciones y Escenas Cinemáticas en Pixel Art
 * para "El Ojete Dorado" (Aventura RPG estilo Zelda).
 */
export class MainMenuAndScenes {
  constructor(viewportWidth, viewportHeight, assets, music, callbacks) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.assets = assets;
    this.music = music;
    this.callbacks = callbacks; // { onNewGame, onLoadGame, getSaveSummary, onSaveGame, onApplyOptions }

    this.worldMap = new WorldMap(this);
    this.worldMapContext = null;
    // (FIX M3.6) Contexto táctil: guía de controles y tutorial de 3 pasos
    this.isTouchDevice = false;
    this.touchTutorialStep = 0;
    this.touchTutorialDone = false;
    this._touchTutorialCooldown = 0;
    this.leaderboardView = new LeaderboardView(viewportWidth, viewportHeight);

    // Estados: 'title' | 'options' | 'exit_screen' | 'pause' | 'none'
    this.state = 'title';
    this.previousState = 'title';
    this.previousStateBeforeOptions = 'title';
    this.previousStateBeforeControls = 'title';
    this.previousStateBeforeLeaderboard = 'title';
    // (FIX B6) Mientras la despedida está en pantalla, el modal absorbe el input
    this.exitFarewellActive = false;
    this._exitFallbackApplied = false;
    this._lastPointerX = -1;
    this._lastPointerY = -1;

    this.selectedIndex = 0;
    this.noticeText = '';
    this.noticeTimer = 0;
    this.animTime = 0;
    this.expansionTeaserOpen = false;
    this._modalPopStart = -1;

    // Opciones persistentes
    this.options = {
      muted: false,
      volumeSteps: 3, // 1=25%, 2=50%, 3=75%, 4=100%
      textSpeed: 'normal', // 'normal' | 'fast' | 'instant'
      visualEffects: true // bloom, scanlines, partículas y parallax
    };
    this._loadOptions();

    // Estrellas y partículas para el arte Pixel Art
    this.stars = Array.from({ length: 36 }, (_, i) => ({
      x: (i * 53 + 17) % viewportWidth,
      y: (i * 29 + 7) % 88,
      phase: (i * 1.3) % (Math.PI * 2),
      size: i % 5 === 0 ? 2 : 1
    }));

    this.particles = Array.from({ length: 18 }, (_, i) => ({
      x: (i * 37) % viewportWidth,
      y: 20 + ((i * 41) % 130),
      vy: -6 - (i % 5) * 3,
      vx: ((i % 3) - 1) * 4,
      phase: i * 0.7
    }));

    // Luciérnagas del título (aparecen/desaparecen cerca del suelo).
    this.fireflies = Array.from({ length: 8 }, (_, i) => ({
      x: 24 + ((i * 37) % (viewportWidth - 48)),
      y: viewportHeight - 48 + ((i * 11) % 34),
      phase: i * 1.7,
      color: i % 2 === 0 ? '#b6f36b' : '#ffe066'
    }));

    // Estado de las escenas cinemáticas Pixel Art
    this.onCutsceneComplete = null;
    this.exitCountdown = 0;
    this._exitCloseTriggered = false;
    this.previousStateBeforeExit = 'title';

    // Sistema de fundido suave (Fade to Black / Fade in)
    this.fadeAlpha = 0;
    this.fadeDirection = 0;
    this.fadeSpeed = 2.4;
    this.fadeMidpointCallback = null;

    // Gestor de Cinemáticas Anime Retro (Novela Visual)
    this.animeCutscenes = null;
  }

  setAnimeCutsceneManager(animeManager) {
    this.animeCutscenes = animeManager;
  }

  _loadOptions() {
    try {
      const raw = localStorage.getItem('el_ojete_dorado_options_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.options = { ...this.options, ...parsed };
      }
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  saveOptions() {
    try {
      localStorage.setItem('el_ojete_dorado_options_v1', JSON.stringify(this.options));
    } catch {
      // Ignorar
    }
    if (this.callbacks.onApplyOptions) {
      this.callbacks.onApplyOptions(this.options);
    }
  }

  startFadeTransition(onMidpoint) {
    this.fadeAlpha = 0;
    this.fadeDirection = 1; // 1 = oscurecer hacia negro
    this.fadeSpeed = 2.4;
    this.fadeMidpointCallback = onMidpoint;
  }

  isBlockingGameplay() {
    return this.state !== 'none' || this.fadeAlpha > 0;
  }

  openTitleScreen() {
    this._hideExitConfirmModal();
    this._hideExitFarewellModal();
    this.state = 'title';
    this.selectedIndex = 0;
    this.noticeText = '';
    this.music.setMode('title');
  }

  openPauseMenu() {
    this._modalPopStart = this.animTime;
    this.state = 'pause';
    this.selectedIndex = 0;
    this.noticeText = '';
    this.music.playMenuSelect();
  }

  closePauseMenu() {
    this.state = 'none';
    this.music.playMenuMove();
  }

  openGameOverScreen(wasDefenseless = false, reason = null) {
    this.state = 'game_over';
    this.selectedIndex = 0;
    this.gameOverWasDefenseless = wasDefenseless;
    this.gameOverReason = reason;
    this.music.setMode('game_over');
    this.music.playGameOver();
  }

  openWorldMap(currentSceneId = 'first_stage', context = null) {
    if (this.state !== 'world_map') {
      this.previousStateBeforeMap = this.state === 'pause' ? 'pause' : 'none';
    }
    this.state = 'world_map';
    if (this.worldMap) {
      this.worldMap.isTouchDevice = this.isTouchDevice;
      this.worldMap.resetView();
    }
    this.currentSceneId = currentSceneId;
    if (context) {
      this.worldMapContext = context;
    }
    this.music.playMenuSelect();
  }

  closeWorldMap() {
    this.state = this.previousStateBeforeMap || 'none';
    this.previousStateBeforeMap = 'none';
    this.music.playMenuMove();
  }

  /** Avanza el temporizador de avisos cuando el menú no se está actualizando (juego en curso). */
  updateNotice(dt) {
    if (this.noticeTimer > 0) {
      this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    }
  }

  /**
   * Inicia la pantalla de Créditos Finales con scroll vertical y estrellas retro.
   */
  startEndingCredits(playerRecord = {}, onFinish = null) {
    this.state = 'credits';
    this.endingCredits = new EndingCredits(
      this.viewportWidth,
      this.viewportHeight,
      playerRecord,
      () => {
        if (typeof onFinish === 'function') {
          onFinish();
        } else {
          this.openTitleScreen();
        }
      }
    );
  }

  showNotice(text, duration = 2.6) {
    this.noticeText = text;
    this.noticeTimer = duration;
  }

  openOptionsScreen(returnState = 'title') {
    this._modalPopStart = this.animTime;
    this.previousStateBeforeOptions = returnState === 'pause' ? 'pause' : 'title';
    this.previousState = this.previousStateBeforeOptions;
    this.state = 'options';
    this.selectedIndex = 0;
    this.noticeText = '';
    this.music.playMenuSelect();
  }

  closeOptionsScreen() {
    this.music.playMenuMove();
    const returnTo = this.previousStateBeforeOptions === 'pause' ? 'pause' : 'title';
    this.state = returnTo;
    this.previousState = returnTo;
    this.selectedIndex = returnTo === 'pause' ? 3 : 4;
  }

  openControlsScreen(returnState = 'title') {
    this.previousStateBeforeControls = returnState;
    this.state = 'controls';
    this.selectedIndex = 0;
    this.music.playMenuSelect();
  }

  closeControlsScreen() {
    this.state = this.previousStateBeforeControls || 'title';
    this.music.playMenuMove();
  }

  openLeaderboardScreen(returnState = 'title') {
    this.previousStateBeforeLeaderboard = returnState;
    this.state = 'leaderboard';
    this.leaderboardScroll = 0;
    this.leaderboardTab = 'global';
    this.localLeaderboardList = getLocalLeaderboard();
    this.leaderboardList = this.globalLeaderboardList || this.localLeaderboardList;
    this.leaderboardStatus = 'Conectando con Vercel...';
    this.selectedIndex = 0;
    this.music.playMenuSelect();

    if (this.leaderboardView) {
      this.leaderboardView.isOpen = true;
      this.leaderboardView.loading = true;
      this.leaderboardView.scrollOffset = 0;
      this.leaderboardView.entries = this.leaderboardView._normalizeEntries(this.leaderboardList || []);
    }

    this.isFetchingGlobal = true;
    fetchGlobalLeaderboard().then((res) => {
      this.isFetchingGlobal = false;
      if (res && Array.isArray(res.leaderboard)) {
        this.globalLeaderboardList = res.leaderboard;
        this.leaderboardStatus = res.source === 'cloud' ? '🌐 Nube Conectada' : '💾 Servidor Vercel (Modo Base)';
        if (this.leaderboardTab === 'global') {
          this.leaderboardList = this.globalLeaderboardList;
        }
        if (this.leaderboardView) {
          this.leaderboardView.loading = false;
          this.leaderboardView.source = res.source || 'cloud';
          this.leaderboardView.entries = this.leaderboardView._normalizeEntries(this.leaderboardList);
        }
      }
    }).catch(() => {
      this.isFetchingGlobal = false;
      this.leaderboardStatus = '💾 Modo Local';
      if (this.leaderboardView) {
        this.leaderboardView.loading = false;
        this.leaderboardView.source = 'offline_local';
        this.leaderboardView.errorMsg = 'Sin conexión a Vercel KV · Mostrando caché local';
        this.leaderboardView.entries = this.leaderboardView._normalizeEntries(this.localLeaderboardList || []);
      }
    });
  }

  setLeaderboardTab(tab) {
    if (this.leaderboardTab === tab) return;
    this.leaderboardTab = tab;
    this.leaderboardScroll = 0;
    if (tab === 'global') {
      this.leaderboardList = this.globalLeaderboardList || this.localLeaderboardList;
    } else {
      this.localLeaderboardList = getLocalLeaderboard();
      this.leaderboardList = this.localLeaderboardList;
    }
    if (this.leaderboardView) {
      this.leaderboardView.scrollOffset = 0;
      this.leaderboardView.source = tab === 'global' ? 'cloud' : 'local';
      this.leaderboardView.entries = this.leaderboardView._normalizeEntries(this.leaderboardList || []);
    }
    this.music.playMenuMove();
  }

  closeLeaderboardScreen() {
    if (this.leaderboardView) {
      this.leaderboardView.close();
    }
    this.state = this.previousStateBeforeLeaderboard || 'title';
    this.music.playMenuMove();
  }

  /**
   * Abre la ventana modal para preguntar al jugador si desea abandonar el juego.
   */
  promptExitConfirmation() {
    this.previousStateBeforeExit = this.state;
    this.state = 'confirm_exit';
    this.selectedIndex = 0;
    this.music.playMenuSelect();
    this._showExitConfirmModal();
  }

  cancelExitConfirmation() {
    this._hideExitConfirmModal();
    this.music.playMenuMove();
    this.state = this.previousStateBeforeExit || 'title';
    this.selectedIndex = 0;
  }

  confirmExitGame() {
    this._hideExitConfirmModal();
    if (this.callbacks.onSaveGame && this.previousStateBeforeExit === 'pause') {
      try {
        this.callbacks.onSaveGame();
      } catch {}
    }
    this.executeExitWithFarewell();
  }

  /**
   * Muestra la pantalla de agradecimiento y despedida durante 3 segundos
   * antes de intentar cerrar la ventana del navegador.
   */
  executeExitWithFarewell() {
    this.state = 'exit_screen';
    this.exitCountdown = 3.0;
    this._exitCloseTriggered = false;
    this._exitFallbackApplied = false;
    this.music.setMode('silent');
    this.music.playMenuSelect();
    try {
      document.title = '¡Gracias por jugar! · El Ojete Dorado';
    } catch {}

    this._showExitFarewellModal();
  }

  // Alias para mantener compatibilidad
  triggerExitGame() {
    this.promptExitConfirmation();
  }

  _tryCloseBrowserWindow() {
    try {
      window.close();
    } catch {}
    try {
      window.open('', '_self', '');
      window.close();
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage('close-game', '*');
      }
    } catch {}

    // (FIX EXIT) Si el navegador bloquea el cierre, dejamos el juego en un estado
    // terminal y seguro: sin loop, sin audio, canvas oculto y mensaje de despedida.
    this._applyExitFallback();
  }

  /**
   * (FIX EXIT) Fallback cuando window.close() está bloqueado por el navegador.
   * Detiene el juego, silencia el audio, oculta el canvas y actualiza el modal
   * de despedida con el mensaje de cierre seguro.
   */
  _applyExitFallback() {
    if (this._exitFallbackApplied) return;
    this._exitFallbackApplied = true;
    this.exitCountdown = 0;
    this._exitCloseTriggered = true;
    this.state = 'exit_screen';
    this.exitFarewellActive = true;

    try {
      this.callbacks?.onExit?.();
    } catch {}

    if (typeof document === 'undefined') return;
    const modal = document.getElementById('exit-farewell-modal');
    if (modal) modal.classList.remove('hidden');

    const header = modal && modal.querySelector('.exit-modal-header span');
    if (header) header.textContent = '✨ SESIÓN FINALIZADA ✨';
    const title = modal && modal.querySelector('.exit-farewell-title');
    if (title) title.textContent = 'El juego se ha cerrado';
    const body = modal && modal.querySelector('.exit-farewell-body');
    if (body) {
      body.textContent = 'El juego se ha cerrado. Ya puedes cerrar esta pestaña de forma segura.';
    }
    const slogan = modal && modal.querySelector('.exit-farewell-slogan');
    if (slogan) slogan.textContent = '¡¡¡GRACIAS POR JUGAR!!!';
    const countdownText = document.getElementById('exit-farewell-countdown-text');
    if (countdownText) countdownText.textContent = 'Sesión finalizada.';
    const hint = document.getElementById('exit-farewell-hint');
    if (hint) {
      hint.textContent = 'Gracias por jugar a El Ojete Dorado. Puedes cerrar esta pestaña manualmente.';
    }
    const returnBtn = document.getElementById('exit-farewell-return-btn');
    if (returnBtn) returnBtn.style.display = 'none';
    const closeBtn = document.getElementById('exit-farewell-close-btn');
    if (closeBtn) closeBtn.textContent = '✕ Cerrar Pestaña';
  }

  _ensureExitModals() {
    if (typeof document === 'undefined') return { confirmModal: null, farewellModal: null };
    // 1. Modal de Confirmación
    let confirmModal = document.getElementById('exit-confirm-modal');
    if (!confirmModal) {
      confirmModal = document.createElement('div');
      confirmModal.id = 'exit-confirm-modal';
      confirmModal.className = 'exit-modal-backdrop hidden';
      confirmModal.innerHTML = `
        <div class="exit-confirm-card">
          <div class="exit-modal-header">
            <span>⚔ ¿ABANDONAR LA AVENTURA? ⚔</span>
          </div>
          <h2 class="exit-confirm-title">¿Seguro que quieres salir de El Ojete Dorado?</h2>
          <p class="exit-confirm-body">
            Tu progreso guardado se mantendrá a salvo para tu próxima partida.
          </p>
          <div class="exit-modal-actions">
            <button id="exit-confirm-yes-btn" type="button" class="btn-confirm-yes">✓ Sí, salir del juego</button>
            <button id="exit-confirm-no-btn" type="button" class="btn-confirm-no">✕ No, seguir jugando</button>
          </div>
        </div>
      `;
      const wrapper = document.querySelector('.viewport-wrapper') || document.body;
      wrapper.appendChild(confirmModal);
    }

    const yesBtn = document.getElementById('exit-confirm-yes-btn');
    if (yesBtn && !yesBtn._hasConfirmHandler) {
      yesBtn._hasConfirmHandler = true;
      yesBtn.onclick = () => {
        this.confirmExitGame();
      };
    }
    const noBtn = document.getElementById('exit-confirm-no-btn');
    if (noBtn && !noBtn._hasConfirmHandler) {
      noBtn._hasConfirmHandler = true;
      noBtn.onclick = () => {
        this.cancelExitConfirmation();
      };
    }

    // 2. Modal de Despedida (Farewell) con timeout de 3 segundos
    let farewellModal = document.getElementById('exit-farewell-modal');
    if (!farewellModal) {
      farewellModal = document.createElement('div');
      farewellModal.id = 'exit-farewell-modal';
      farewellModal.className = 'exit-modal-backdrop hidden';
      farewellModal.innerHTML = `
        <div class="exit-farewell-card">
          <div class="exit-modal-header">
            <span>✨ ¡GRACIAS POR JUGAR! ✨</span>
          </div>
          <h2 class="exit-farewell-title">¡Gracias por jugar y probar el juego!</h2>
          <p class="exit-farewell-body">
            Mantente alerta, que a nuestro personaje le quedan muchas aventuras por superar...
          </p>
          <div class="exit-farewell-slogan">¡¡¡POR EL OJETEEEEEEEEE!!!</div>
          <div class="exit-countdown-container">
            <p id="exit-farewell-countdown-text" class="exit-countdown-text">
              Cerrando ventana en <span id="exit-farewell-countdown-sec">3</span> segundos...
            </p>
          </div>
          <p id="exit-farewell-hint" class="exit-farewell-hint">
            Si tu navegador no permite el cierre automático por seguridad, ya puedes cerrar esta pestaña manualmente.
          </p>
          <div id="exit-farewell-actions" class="exit-modal-actions">
            <button id="exit-farewell-close-btn" type="button" class="btn-confirm-yes">✕ Cerrar Pestaña Ahora</button>
            <button id="exit-farewell-return-btn" type="button" class="btn-confirm-no">↺ Volver al Menú</button>
          </div>
        </div>
      `;
      const wrapper = document.querySelector('.viewport-wrapper') || document.body;
      wrapper.appendChild(farewellModal);
    }

    const closeBtn = document.getElementById('exit-farewell-close-btn');
    if (closeBtn && !closeBtn._hasFarewellHandler) {
      closeBtn._hasFarewellHandler = true;
      closeBtn.onclick = () => {
        this._tryCloseBrowserWindow();
      };
    }
    const returnBtn = document.getElementById('exit-farewell-return-btn');
    if (returnBtn && !returnBtn._hasFarewellHandler) {
      returnBtn._hasFarewellHandler = true;
      returnBtn.onclick = () => {
        this._hideExitFarewellModal();
        this.openTitleScreen();
      };
    }

    return { confirmModal, farewellModal };
  }

  _showExitConfirmModal() {
    if (typeof document === 'undefined') return;
    this._ensureExitModals();
    const modal = document.getElementById('exit-confirm-modal');
    if (modal) modal.classList.remove('hidden');
    const farewell = document.getElementById('exit-farewell-modal');
    if (farewell) farewell.classList.add('hidden');
  }

  _hideExitConfirmModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('exit-confirm-modal');
    if (modal) modal.classList.add('hidden');
  }

  _showExitFarewellModal() {
    if (typeof document === 'undefined') return;
    this._ensureExitModals();
    this._hideExitConfirmModal();
    const modal = document.getElementById('exit-farewell-modal');
    if (modal) modal.classList.remove('hidden');
    this.exitFarewellActive = true;
    this._updateExitCountdownDisplay(3);
  }

  _hideExitFarewellModal() {
    this.exitFarewellActive = false;
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('exit-farewell-modal');
    if (modal) modal.classList.add('hidden');
  }

  _updateExitCountdownDisplay(seconds) {
    if (typeof document === 'undefined') return;
    const secEl = document.getElementById('exit-farewell-countdown-sec');
    if (secEl) {
      secEl.textContent = String(seconds);
    }
  }

  _onExitCountdownComplete() {
    if (this._exitFallbackApplied) return;
    if (typeof document === 'undefined') return;
    const textEl = document.getElementById('exit-farewell-countdown-text');
    if (textEl) {
      textEl.innerHTML = '¡Tiempo completado! Cerrando ventana...';
    }
    const hintEl = document.getElementById('exit-farewell-hint');
    if (hintEl) {
      hintEl.textContent = 'Ventana finalizada. Si tu navegador bloquea el cierre automático, ya puedes cerrar esta pestaña manualmente o volver al menú.';
    }
  }

  /**
   * Cinemática Anime de Presentación del Villano y Prólogo de Historia:
   * Presenta a Mister AI Alex, su arma apocalíptica (El Microondas con Despertador),
   * la profecía de El Ojete Dorado y la transición suave al pueblo de Valleverde.
   */
  startAnimeIntroCutscene(onComplete) {
    // (FIX CINEMÁTICAS) La intro del prólogo se ejecuta in-engine desde main._startNewGame().
    if (typeof onComplete === 'function') onComplete();
  }

  startHeroAdventureCutscene(onComplete) {
    this.startAnimeIntroCutscene(onComplete);
  }

  startSwordObtainedCutscene(onComplete) {
    if (this.animeCutscenes) this.animeCutscenes.playItemCutscene('sword', onComplete);
    else if (typeof onComplete === 'function') onComplete();
  }

  startRelicFoundCutscene(onComplete) {
    if (this.animeCutscenes) this.animeCutscenes.playItemCutscene('relic', onComplete);
    else if (typeof onComplete === 'function') onComplete();
  }

  _hasVictoryTrophy() {
    try {
      return typeof localStorage !== 'undefined' &&
        Boolean(localStorage.getItem(EXPANSION_UNLOCK_KEY));
    } catch {
      return false;
    }
  }

  _getCurrentMenuItems() {
    if (this.state === 'title') {
      const saveInfo = this.callbacks.getSaveSummary ? this.callbacks.getSaveSummary() : null;
      return [
        {
          label: 'Nueva Partida',
          action: () => {
            this.music.playMenuSelect();
            if (typeof this.music.stopTitleMusic === 'function') {
              this.music.stopTitleMusic(350);
            }
            this.startAnimeIntroCutscene(() => {
              if (this.callbacks.onNewGame) this.callbacks.onNewGame();
            });
          }
        },
        {
          label: saveInfo ? `Cargar Partida (${saveInfo})` : 'Cargar Partida',
          disabled: !saveInfo,
          action: () => {
            if (!saveInfo) {
              this.music.playCaughtSkipSound();
              this.showNotice('No hay ninguna partida guardada todavía.');
              return;
            }
            this.music.playMenuSelect();
            if (typeof this.music.stopTitleMusic === 'function') {
              this.music.stopTitleMusic(350);
            }
            const ok = this.callbacks.onLoadGame ? this.callbacks.onLoadGame() : false;
            if (ok) {
              this.state = 'none';
            } else {
              this.showNotice('No se pudo cargar la partida guardada.');
            }
          }
        },
        {
          label: EXPANSION_INFO.title,
          subtext: EXPANSION_INFO.teaser,
          expansion: true,
          locked: !this._hasVictoryTrophy(),
          action: () => {
            if (!this._hasVictoryTrophy()) {
              this.music.playCaughtSkipSound();
              this.showNotice('Debes completar el juego base para desbloquear esto.');
              return;
            }
            this.music.playMenuSelect();
            this.expansionTeaserOpen = true;
          }
        },
        {
          label: '🏆 Salón de la Fama',
          action: () => {
            this.music.playMenuSelect();
            this.openLeaderboardScreen('title');
          }
        },
        {
          label: '☁ Cargar de la Nube',
          action: () => {
            this.music.playMenuSelect();
            if (this.callbacks.onOpenCloudLoad) {
              this.callbacks.onOpenCloudLoad();
            }
          }
        },
        {
          label: 'Controles',
          action: () => {
            this.music.playMenuSelect();
            this.openControlsScreen('title');
          }
        },
        {
          label: 'Opciones',
          action: () => {
            this.openOptionsScreen('title');
          }
        },
        {
          label: 'Salir',
          action: () => {
            this.triggerExitGame();
          }
        }
      ];
    }

    if (this.state === 'pause') {
      return [
        {
          label: 'Continuar Aventura',
          action: () => this.closePauseMenu()
        },
        {
          label: 'Guardar / Nube',
          action: () => {
            this.music.playMenuSelect();
            this.previousState = 'pause';
            this.state = 'pause_cloud';
            this.selectedIndex = 0;
          }
        },
        {
          label: 'Salón de la Fama [Récords]',
          action: () => {
            this.music.playMenuSelect();
            this.openLeaderboardScreen('pause');
          }
        },
        {
          label: 'Ajustes y Sonido',
          action: () => {
            this.openOptionsScreen('pause');
          }
        },
        {
          label: 'Guardar y Salir al Menú Principal',
          action: () => {
            if (this.callbacks.onSaveGame) {
              this.callbacks.onSaveGame();
            }
            this.music.playMenuSelect();
            this.openTitleScreen();
          }
        }
      ];
    }

    if (this.state === 'pause_cloud') {
      // (FIX B2) Se lee el código real de la nube; si no existe, no se inventa una ranura
      const cloudCode = this.callbacks.getCloudCode ? this.callbacks.getCloudCode() : null;
      const slotLabel = cloudCode ? `[${cloudCode}]` : '[Sin código]';
      return [
        {
          label: 'Guardar Partida [Nube + Respaldo]',
          action: () => {
            this.music.playFanfare();
            if (this.callbacks.onSaveGame) {
              this.callbacks.onSaveGame({ manual: true, cloud: true });
            }
            this.showNotice('✓ Partida sincronizada en la nube');
          }
        },
        {
          label: `Ver Código en la Nube ${slotLabel}`,
          action: () => {
            this.music.playMenuSelect();
            if (!cloudCode) {
              this.showNotice('Aún no hay código: guarda primero en la nube');
              return;
            }
            this.showNotice(`Código de Ranura: ${cloudCode}`);
          }
        },
        {
          label: 'Cargar de la Nube (con Código)',
          action: () => {
            this.music.playMenuSelect();
            if (this.callbacks.onLoadGame) {
              this.callbacks.onLoadGame();
            } else {
              this.showNotice('Carga remota iniciada...');
            }
          }
        },
        {
          label: 'Volver',
          action: () => {
            this.music.playMenuSelect();
            this.state = 'pause';
            this.selectedIndex = 1;
          }
        }
      ];
    }

    if (this.state === 'game_over') {
      return [
        {
          label: 'Cargar desde el último autoguardado',
          action: () => {
            this.music.playMenuSelect();
            const loaded = this.callbacks.onLoadGame ? this.callbacks.onLoadGame() : false;
            if (!loaded && this.callbacks.onNewGame) {
              this.callbacks.onNewGame();
            }
            this.state = 'none';
          }
        },
        {
          label: 'Salir al Menú Principal',
          action: () => {
            this.music.playMenuSelect();
            this.openTitleScreen();
          }
        },
        {
          label: 'Salir del Juego',
          action: () => {
            this.triggerExitGame();
          }
        }
      ];
    }

    if (this.state === 'options' || this.state === 'pause_sound') {
      const masterVol = typeof this.music.getMasterVolume === 'function' ? this.music.getMasterVolume() : 1.0;
      const musicVol = typeof this.music.getMusicVolume === 'function' ? this.music.getMusicVolume() : 0.8;
      const sfxVol = typeof this.music.getSfxVolume === 'function' ? this.music.getSfxVolume() : 1.0;
      const masterMuted = typeof this.music.isMasterMuted === 'function' ? this.music.isMasterMuted() : false;
      const musicMuted = typeof this.music.isMusicMuted === 'function' ? this.music.isMusicMuted() : false;
      const sfxMuted = typeof this.music.isSfxMuted === 'function' ? this.music.isSfxMuted() : false;

      return [
        {
          label: `Volumen General: [◄ ${Math.round(masterVol * 100)}% ►]${masterMuted ? ' (MUTE)' : ''}`,
          onAdjust: (dir) => {
            const next = Math.max(0, Math.min(1, Math.round((masterVol + dir * 0.1) * 10) / 10));
            if (typeof this.music.setMasterVolume === 'function') this.music.setMasterVolume(next);
            this.music.playMenuMove();
          },
          action: () => {
            if (typeof this.music.toggleMasterMute === 'function') this.music.toggleMasterMute();
            this.music.playMenuSelect();
          }
        },
        {
          label: `Música (BGM): [◄ ${Math.round(musicVol * 100)}% ►]${musicMuted ? ' (MUTE)' : ''}`,
          onAdjust: (dir) => {
            const next = Math.max(0, Math.min(1, Math.round((musicVol + dir * 0.1) * 10) / 10));
            if (typeof this.music.setMusicVolume === 'function') this.music.setMusicVolume(next);
            this.music.playMenuMove();
          },
          action: () => {
            if (typeof this.music.toggleMusicMute === 'function') this.music.toggleMusicMute();
            this.music.playMenuSelect();
          }
        },
        {
          label: `Efectos (SFX): [◄ ${Math.round(sfxVol * 100)}% ►]${sfxMuted ? ' (MUTE)' : ''}`,
          onAdjust: (dir) => {
            const next = Math.max(0, Math.min(1, Math.round((sfxVol + dir * 0.1) * 10) / 10));
            if (typeof this.music.setSfxVolume === 'function') {
              this.music.setSfxVolume(next);
              if (typeof this.music.playTestBeep === 'function') this.music.playTestBeep();
            } else {
              this.music.playMenuMove();
            }
          },
          action: () => {
            if (typeof this.music.toggleSfxMute === 'function') {
              this.music.toggleSfxMute();
              if (typeof this.music.playTestBeep === 'function') this.music.playTestBeep();
            }
          }
        },
        {
          label: `Efectos Visuales: [◄ ${this.options.visualEffects !== false ? 'ON' : 'OFF'} ►]`,
          onAdjust: () => {
            this.options.visualEffects = this.options.visualEffects === false;
            this.saveOptions();
            this.music.playMenuMove();
          },
          action: () => {
            this.options.visualEffects = this.options.visualEffects === false;
            this.saveOptions();
            this.music.playMenuSelect();
          }
        },
        {
          label: 'Controles / Guía de Teclas',
          action: () => {
            this.music.playMenuSelect();
            this.openControlsScreen(this.state);
          }
        },
        {
          label: 'Volver',
          action: () => {
            this.closeOptionsScreen();
          }
        }
      ];
    }

    if (this.state === 'confirm_exit') {
      return [
        {
          label: '✕ Continuar jugando',
          action: () => this.cancelExitConfirmation()
        },
        {
          label: '✓ Sí, salir del juego',
          action: () => this.confirmExitGame()
        }
      ];
    }

    return [];
  }

  update(dt, input) {
    this.animTime += dt;
    if (this.noticeTimer > 0) {
      this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    }
    if (input) {
      this._lastPointerX = input.pointerX;
      this._lastPointerY = input.pointerY;
      this._lastPointerDown = Boolean(input.isPointerDown);
    }

    // Actualización del fundido suave (Fade to Black / Fade in)
    if (this.fadeDirection !== 0) {
      this.fadeAlpha += this.fadeDirection * this.fadeSpeed * dt;
      if (this.fadeDirection === 1 && this.fadeAlpha >= 1) {
        this.fadeAlpha = 1;
        this.fadeDirection = -1; // Comienza a aclararse
        if (this.fadeMidpointCallback) {
          const cb = this.fadeMidpointCallback;
          this.fadeMidpointCallback = null;
          cb();
        }
      } else if (this.fadeDirection === -1 && this.fadeAlpha <= 0) {
        this.fadeAlpha = 0;
        this.fadeDirection = 0;
      }
    }

    if (this.state === 'none') return;

    // (EXPANSIÓN) Modal del teaser: se cierra con E/Enter/Espacio/Esc o clic.
    if (this.state === 'title' && this.expansionTeaserOpen) {
      if (
        input.consumeKey('Escape') ||
        input.consumeKey('Enter') ||
        input.consumeKey('KeyE') ||
        input.consumeKey('Space') ||
        input.pointerJustClicked
      ) {
        this.expansionTeaserOpen = false;
        this.music.playMenuMove();
      }
      return;
    }

    // Modal de confirmación para abandonar el juego
    if (this.state === 'confirm_exit') {
      if (input.consumeKey('Escape')) {
        this.cancelExitConfirmation();
        return;
      }
      const items = this._getCurrentMenuItems();
      const dir = input.consumeMenuDirection();
      if (dir === 'up' || dir === 'left') {
        this.selectedIndex = (this.selectedIndex + items.length - 1) % items.length;
        this.music.playMenuMove();
      } else if (dir === 'down' || dir === 'right') {
        this.selectedIndex = (this.selectedIndex + 1) % items.length;
        this.music.playMenuMove();
      }

      if (input.consumeInteraction()) {
        const chosen = items[this.selectedIndex];
        if (chosen && chosen.action) {
          chosen.action();
        }
        return;
      }
      return;
    }

    // Pantalla de Despedida / Salida con cuenta atrás de 3 segundos
    if (this.state === 'exit_screen') {
      if (this.exitCountdown > 0) {
        this.exitCountdown = Math.max(0, this.exitCountdown - dt);
        const secDisplay = Math.max(1, Math.ceil(this.exitCountdown));
        this._updateExitCountdownDisplay(secDisplay);

        if (this.exitCountdown <= 0 && !this._exitCloseTriggered) {
          this._exitCloseTriggered = true;
          this._tryCloseBrowserWindow();
          this._onExitCountdownComplete();
        }
        return;
      }

      // (FIX B6) La despedida es un modal real: ni clics ni teclas de juego la cierran
      // por accidente (el InputHandler escucha en window y el modal no los absorbía).
      // Solo Escape, como cierre explícito, o los botones del DOM.
      if (this.exitFarewellActive) {
        if (input.consumeKey('Escape')) {
          this.music.playMenuSelect();
          this._hideExitFarewellModal();
          this.openTitleScreen();
        }
        return;
      }

      if (
        input.consumeInteraction() ||
        input.consumeKey('Escape') ||
        input.consumePointerClick()
      ) {
        this.music.playMenuSelect();
        this._hideExitFarewellModal();
        this.openTitleScreen();
      }
      return;
    }

    // Pantalla de Créditos Finales y Expediente de Compilación
    if (this.state === 'credits') {
      if (this.endingCredits) {
        this.endingCredits.update(dt, input);
      }
      return;
    }

    // Mapa del Reino del Gran Ojal
    if (this.state === 'world_map') {
      // (FIX M3.3) Pan/zoom/pinch y botones; el clic ya no cierra el mapa
      if (this.worldMap) {
        this.worldMap.updateInput(input);
        if (this.worldMap.consumeCloseRequest()) {
          this.closeWorldMap();
          return;
        }
      }
      if (input.consumeKey('KeyM') || input.consumeKey('Escape')) {
        this.closeWorldMap();
      }
      return;
    }

    // (FIX M3.6) Tutorial táctil de 3 pasos
    if (this.state === 'touch_tutorial') {
      if (this._touchTutorialCooldown > 0) {
        this._touchTutorialCooldown = Math.max(0, this._touchTutorialCooldown - dt);
        return;
      }
      const advance =
        input.pointerJustClicked ||
        input.consumeInteraction() ||
        input.consumeKey('Enter') ||
        input.consumeKey('Space') ||
        input.consumeKey('Escape');
      if (advance) {
        this.touchTutorialStep += 1;
        if (this.touchTutorialStep >= 3) {
          this.finishTouchTutorial();
        }
      }
      return;
    }

    // Pantalla de Mapeo de Controles & Guía de Teclas
    if (this.state === 'controls') {
      if (
        input.consumeKey('Escape') ||
        input.consumeKey('KeyC') ||
        input.consumeInteraction() ||
        input.consumePointerClick()
      ) {
        this.closeControlsScreen();
      }
      return;
    }

    // Pantalla de Salón de la Fama / Leaderboard de Speedrun
    if (this.state === 'leaderboard') {
      const dir = input.consumeMenuDirection();
      if (dir === 'up') {
        this.leaderboardScroll = Math.max(0, (this.leaderboardScroll || 0) - 1);
        this.music.playMenuMove();
      } else if (dir === 'down') {
        const maxScroll = Math.max(0, (this.leaderboardList?.length || 0) - 6);
        this.leaderboardScroll = Math.min(maxScroll, (this.leaderboardScroll || 0) + 1);
        this.music.playMenuMove();
      }

      // Atajos de teclado para alternar pestañas: Tab, KeyT, Digit1, Digit2
      if (input.consumeKey('Tab') || input.consumeKey('KeyT')) {
        this.setLeaderboardTab(this.leaderboardTab === 'global' ? 'local' : 'global');
        return;
      }
      if (input.consumeKey('Digit1')) {
        this.setLeaderboardTab('global');
        return;
      }
      if (input.consumeKey('Digit2')) {
        this.setLeaderboardTab('local');
        return;
      }

      // Clic del ratón en las pestañas o en el botón de retorno
      if (input.pointerJustClicked) {
        const winW = 300;
        const winX = Math.round((this.viewportWidth - winW) / 2);
        const winY = Math.round((this.viewportHeight - 166) / 2);
        const tabY = winY + 15;
        const tabW = 95;
        const tabH = 11;
        const tab1X = winX + 16;
        const tab2X = winX + 116;

        const px = input.pointerX;
        const py = input.pointerY;

        // Clic en Pestaña Global
        if (px >= tab1X && px <= tab1X + tabW && py >= tabY && py <= tabY + tabH) {
          input.consumePointerClick();
          this.setLeaderboardTab('global');
          return;
        }

        // Clic en Pestaña Local
        if (px >= tab2X && px <= tab2X + tabW && py >= tabY && py <= tabY + tabH) {
          input.consumePointerClick();
          this.setLeaderboardTab('local');
          return;
        }

        // Clic en botón "Volver al Menú"
        const btnW = 140;
        const btnH = 13;
        const btnX = Math.round(winX + (winW - btnW) / 2);
        const btnY = winY + 166 - 15;
        if (px >= btnX && px <= btnX + btnW && py >= btnY && py <= btnY + btnH) {
          input.consumePointerClick();
          this.closeLeaderboardScreen();
          return;
        }
      }

      if (
        input.consumeKey('Escape') ||
        input.consumeKey('KeyL') ||
        input.consumeInteraction()
      ) {
        this.closeLeaderboardScreen();
      }
      return;
    }

    // Navegación de Menús (Title, Pause, Options)
    const items = this._getCurrentMenuItems();
    if (items.length === 0) return;

    const dir = input.consumeMenuDirection();
    const currentItem = items[this.selectedIndex];

    if (dir === 'left' && currentItem && typeof currentItem.onAdjust === 'function') {
      currentItem.onAdjust(-1);
    } else if (dir === 'right' && currentItem && typeof currentItem.onAdjust === 'function') {
      currentItem.onAdjust(1);
    } else if (dir === 'up' || dir === 'left') {
      this.selectedIndex = (this.selectedIndex + items.length - 1) % items.length;
      this.music.playMenuMove();
    } else if (dir === 'down' || dir === 'right') {
      this.selectedIndex = (this.selectedIndex + 1) % items.length;
      this.music.playMenuMove();
    }

    if (input.consumeKey('Escape')) {
      if (this.state === 'pause_cloud') {
        this.state = 'pause';
        this.selectedIndex = 1;
        this.music.playMenuMove();
        return;
      }
      if (this.state === 'options' || this.state === 'pause_sound') {
        this.closeOptionsScreen();
        return;
      }
      if (this.state === 'pause') {
        this.closePauseMenu();
        return;
      }
    }

    // Soporte de ratón / puntero sobre los botones del menú y botón de cierre modal
    const isPauseModal =
      this.state === 'pause' ||
      this.state === 'pause_cloud' ||
      this.state === 'options' ||
      this.state === 'pause_sound';
    const closeBtn = isPauseModal ? this._getModalCloseButtonBounds(isPauseModal) : null;

    const menuBounds = this._getMenuHitboxes(items.length, items);
    if (input.pointerX >= 0 && input.pointerY >= 0) {
      for (let i = 0; i < menuBounds.length; i++) {
        const b = menuBounds[i];
        if (
          input.pointerX >= b.x &&
          input.pointerX <= b.x + b.w &&
          input.pointerY >= b.y &&
          input.pointerY <= b.y + b.h
        ) {
          if (this.selectedIndex !== i) {
            this.selectedIndex = i;
          }
          break;
        }
      }
    }

    const click = input.consumePointerClick();
    if (click) {
      if (
        closeBtn &&
        click.x >= closeBtn.x &&
        click.x <= closeBtn.x + closeBtn.w &&
        click.y >= closeBtn.y &&
        click.y <= closeBtn.y + closeBtn.h
      ) {
        if (this.state === 'options' || this.state === 'pause_sound') {
          this.closeOptionsScreen();
        } else if (this.state === 'pause_cloud') {
          this.state = 'pause';
          this.selectedIndex = 1;
          this.music.playMenuMove();
        } else if (this.state === 'pause') {
          this.closePauseMenu();
        }
        return;
      }

      for (let i = 0; i < menuBounds.length; i++) {
        const b = menuBounds[i];
        if (
          click.x >= b.x &&
          click.x <= b.x + b.w &&
          click.y >= b.y &&
          click.y <= b.y + b.h
        ) {
          this.selectedIndex = i;
          const targetItem = items[i];
          if (targetItem) {
            if (typeof targetItem.onAdjust === 'function') {
              if (click.x < b.x + b.w * 0.38) {
                targetItem.onAdjust(-1);
              } else if (click.x > b.x + b.w * 0.62) {
                targetItem.onAdjust(1);
              } else if (targetItem.action) {
                targetItem.action();
              }
            } else if (targetItem.action) {
              targetItem.action();
            }
          }
          return;
        }
      }
    }

    if (input.consumeInteraction()) {
      const chosen = items[this.selectedIndex];
      if (chosen && chosen.action) {
        chosen.action();
      }
    }
  }

  _getModalCloseButtonBounds(isPauseModal = true) {
    const winW = isPauseModal ? 240 : 216;
    const winH = isPauseModal ? 150 : 128;
    const winX = Math.round((this.viewportWidth - winW) / 2);
    const winY = Math.round((this.viewportHeight - winH) / 2);
    return {
      x: winX + winW - 56,
      y: winY + 4,
      w: 50,
      h: 13
    };
  }

  _getMenuHitboxes(count, items = null) {
    const isTitle = this.state === 'title';
    const isGameOver = this.state === 'game_over';
    const isPauseModal =
      this.state === 'pause' ||
      this.state === 'pause_cloud' ||
      this.state === 'options' ||
      this.state === 'pause_sound';

    if (isPauseModal) {
      const boxW = 208;
      const itemH = 17;
      const gap = 3;
      const totalH = count * itemH + (count - 1) * gap;
      const winH = 150;
      const winY = Math.round((this.viewportHeight - winH) / 2);
      const startX = Math.round((this.viewportWidth - boxW) / 2);
      // Centrado verticalmente dentro de la ventana modal de 150px
      const startY = winY + 24 + Math.round((winH - 32 - totalH) / 2);

      const boxes = [];
      for (let i = 0; i < count; i++) {
        boxes.push({
          x: startX,
          y: startY + i * (itemH + gap),
          w: boxW,
          h: itemH
        });
      }
      return boxes;
    }

    const boxW = isTitle ? 168 : isGameOver ? 204 : 184;
    const itemH = isTitle ? 9 : isGameOver ? 15 : (count > 5 ? 13 : 15);
    const startX = Math.round((this.viewportWidth - boxW) / 2);
    let startY = isTitle ? 80 : isGameOver ? (count > 2 ? 96 : 108) : 56;

    if (isTitle) {
      // (EXPANSIÓN) La fila del teaser necesita altura extra para el subtexto.
      const boxes = [];
      let y = startY;
      for (let i = 0; i < count; i++) {
        const hasSub = Boolean(items && items[i] && items[i].subtext);
        const h = hasSub ? 20 : 9;
        boxes.push({ x: startX, y, w: boxW, h });
        y += h + (hasSub ? 2 : 0);
      }
      return boxes;
    }
    if (!isTitle && !isGameOver && count > 5) {
      const totalH = count * itemH;
      const winH = Math.min(160, totalH + 46);
      const winY = Math.round((this.viewportHeight - winH) / 2);
      startY = winY + 26;
    }

    const boxes = [];
    for (let i = 0; i < count; i++) {
      boxes.push({
        x: startX,
        y: startY + i * itemH,
        w: boxW,
        h: itemH - 1
      });
    }
    return boxes;
  }

  render(ctx) {
    if (this.state === 'none') {
      if (this.noticeTimer > 0 && this.noticeText) {
        this._renderToastNotice(ctx, this.noticeText, 26);
      }
      if (this.fadeAlpha > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, Math.max(0, this.fadeAlpha))})`;
        ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
        ctx.restore();
      }
      return;
    }

    if (this.state === 'credits') {
      if (this.endingCredits) {
        this.endingCredits.render(ctx);
      }
      return;
    }

    if (this.state === 'game_over') {
      this._renderGameOver(ctx);
      return;
    }

    if (this.state === 'world_map') {
      this._renderWorldMap(ctx);
      return;
    }

    if (this.state === 'touch_tutorial') {
      this._renderTouchTutorial(ctx);
      return;
    }

    if (this.state === 'controls') {
      if (this.previousStateBeforeControls === 'title') {
        this._renderTitleBackdropPixelArt(ctx);
      } else {
        ctx.fillStyle = 'rgba(8, 11, 20, 0.78)';
        ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
      }
      this._renderControlsScreen(ctx);
      return;
    }

    if (this.state === 'leaderboard') {
      if (this.previousStateBeforeLeaderboard === 'title') {
        this._renderTitleBackdropPixelArt(ctx);
      } else {
        // (FIX B5) Fondo opaco: el mundo ya no se dibuja por debajo del Salón de la Fama
        ctx.fillStyle = '#080b14';
        ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
      }
      this._renderLeaderboardScreen(ctx);
      return;
    }

    if (this.state === 'exit_screen') {
      this._renderExitScreen(ctx);
      return;
    }

    if (
      this.state === 'title' ||
      ((this.state === 'options' || this.state === 'pause_sound') && this.previousStateBeforeOptions === 'title') ||
      (this.state === 'confirm_exit' && this.previousStateBeforeExit === 'title')
    ) {
      this._renderTitleBackdropPixelArt(ctx);
    } else {
      // Fondo semitransparente sobre la partida en pausa
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    if (this.state === 'title') {
      this._renderTitleHeader(ctx);
      this._renderMenuList(ctx, this._getCurrentMenuItems(), true);
      this._renderExpansionTeaser(ctx);
    } else if (this.state === 'pause') {
      this._renderModalPanel(ctx, 'PAUSA · EL OJETE DORADO', this._getCurrentMenuItems());
    } else if (this.state === 'options' || this.state === 'pause_sound') {
      this._renderModalPanel(ctx, 'AJUSTES Y SONIDO', this._getCurrentMenuItems());
    } else if (this.state === 'pause_cloud') {
      this._renderModalPanel(ctx, 'GUARDADO Y NUBE · VERCEL', this._getCurrentMenuItems());
    } else if (this.state === 'confirm_exit') {
      this._renderModalPanel(ctx, '¿ABANDONAR LA AVENTURA?', this._getCurrentMenuItems());
    }

    if (this.noticeTimer > 0 && this.noticeText) {
      this._renderToastNotice(ctx, this.noticeText);
    }

    if (this.fadeAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, Math.max(0, this.fadeAlpha))})`;
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
      ctx.restore();
    }
  }

  /**
   * Pantalla de Mapeo de Controles & Guía de Teclas.
   * Muestra de forma limpia e intuitiva todos los controles distribuidos por categorías.
   */
  _renderControlsScreen(ctx) {
    const W = this.viewportWidth;
    const H = this.viewportHeight;
    const winW = 296;
    const winH = 168;
    const winX = Math.round((W - winW) / 2);
    const winY = Math.round((H - winH) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Fondo oscurecido
    ctx.fillStyle = 'rgba(5, 8, 15, 0.88)';
    ctx.fillRect(0, 0, W, H);

    // Marco exterior con doble borde dorado y cian
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.fillStyle = '#e5c07b';
    ctx.fillRect(winX + 1, winY + 1, winW - 2, winH - 2);
    ctx.fillStyle = '#101728';
    ctx.fillRect(winX + 2.5, winY + 2.5, winW - 5, winH - 5);

    // Cantoneras doradas
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(winX + 3, winY + 3, 5, 2);
    ctx.fillRect(winX + 3, winY + 3, 2, 5);
    ctx.fillRect(winX + winW - 8, winY + 3, 5, 2);
    ctx.fillRect(winX + winW - 5, winY + 3, 2, 5);
    ctx.fillRect(winX + 3, winY + winH - 5, 5, 2);
    ctx.fillRect(winX + 3, winY + winH - 8, 2, 5);
    ctx.fillRect(winX + winW - 8, winY + winH - 5, 5, 2);
    ctx.fillRect(winX + winW - 5, winY + winH - 8, 2, 5);

    // Cabecera superior
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(
      this.isTouchDevice ? '📱 CONTROLES TÁCTILES · EL OJETE DORADO' : '🎮 CONTROLES & GUÍA DE TECLAS · EL OJETE DORADO',
      winX + 8,
      winY + 6
    );

    ctx.font = '6px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(this.isTouchDevice ? '[Toca] Volver' : '[Escape / Clic] Volver', winX + winW - 8, winY + 7);

    // (FIX M3.6) En móvil se muestra el diagrama táctil en lugar de la tabla de teclas
    if (this.isTouchDevice) {
      this._renderTouchControlsGuide(ctx, winX, winY, winW, winH);
      ctx.restore();
      return;
    }

    // Helper para dibujar categorías
    const drawCategoryBox = (bx, by, bw, bh, title, titleColor, items) => {
      ctx.fillStyle = '#080d18';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#23304a';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = titleColor;
      ctx.textAlign = 'left';
      ctx.fillText(title, bx + 5, by + 4);

      items.forEach((it, idx) => {
        const iy = by + 14 + idx * 10;
        ctx.font = '5px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(it.label, bx + 5, iy);

        ctx.font = 'bold 5px monospace';
        ctx.fillStyle = it.keyColor || '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(it.keys, bx + bw - 5, iy);
        ctx.textAlign = 'left';

        if (it.note) {
          ctx.font = '4.5px monospace';
          ctx.fillStyle = '#64748b';
          ctx.fillText(it.note, bx + 5, iy + 5.5);
        }
      });
    };

    // Columna Izquierda (Ancho 136px)
    const col1X = winX + 8;
    const col1W = 136;

    // 1. Movimiento y Exploración
    drawCategoryBox(col1X, winY + 18, col1W, 56, '🧭 MOVIMIENTO Y EXPLORACIÓN', '#38bdf8', [
      { label: 'Moverse por el reino:', keys: 'W A S D / Flechas', keyColor: '#ffd885' },
      { label: 'Interactuar / Hablar:', keys: '[E]', keyColor: '#34d399' },
      { label: 'Correr (Sprint rápido):', keys: 'Mantener [Shift]', keyColor: '#38bdf8' },
      { label: 'Entrar en casas / puertas:', keys: '[E] / Caminar', keyColor: '#94a3b8' }
    ]);

    // 2. Menús y Pantallas
    drawCategoryBox(col1X, winY + 76, col1W, 68, '📜 MENÚS Y PANTALLAS', '#ffd885', [
      { label: 'Mochila de Objetos:', keys: '[I] / [Tab]', keyColor: '#fde047' },
      { label: 'Ficha y Trofeos:', keys: '[C]', keyColor: '#38bdf8' },
      { label: 'Diario de Misiones:', keys: '[L]', keyColor: '#fbbf24' },
      { label: 'Cartografía Sagrada:', keys: '[M]', keyColor: '#34d399' },
      { label: 'Pausa / Cerrar ventana:', keys: '[Escape]', keyColor: '#f87171' }
    ]);

    // Columna Derecha (Ancho 140px)
    const col2X = winX + 148;
    const col2W = 140;

    // 3. Combate y Habilidades de Jefes
    drawCategoryBox(col2X, winY + 18, col2W, 88, '⚔️ COMBATE Y HABILIDADES', '#f43f5e', [
      { label: 'Atacar con Espada:', keys: 'Clic Izq / Espacio', keyColor: '#ffd885' },
      { label: 'Dash Asíncrono:', keys: 'Shift + Dir', keyColor: '#10b981', note: '*(0.2s invuln. · Garbage Collector)*' },
      { label: 'Corte en Cascada (x3):', keys: 'Mantener Clic / Espacio', keyColor: '#38bdf8', note: '*(Tajo radial 360° · Guardián Stack)*' },
      { label: 'Barrera de Tipado:', keys: '[Q]', keyColor: '#f59e0b', note: '*(Escudo anti-balas · Microondas)*' },
      { label: 'Ranura Rápida:', keys: '[R] / [1]', keyColor: '#38bdf8', note: '*(Consumible directo)*' }
    ]);

    // 4. Gestión de Mochila
    drawCategoryBox(col2X, winY + 110, col2W, 32, '🎒 GESTIÓN DE MOCHILA', '#10b981', [
      { label: 'Usar objeto seleccionado:', keys: '[E]', keyColor: '#34d399' },
      { label: 'Tirar objeto al suelo:', keys: '[X]', keyColor: '#f87171' }
    ]);

    // Botón de Volver
    const btnW = 92;
    const btnH = 13;
    const btnX = Math.round(winX + (winW - btnW) / 2);
    const btnY = winY + winH - 18;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);

    ctx.font = 'bold 6px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀ VOLVER [Escape / Clic]', btnX + btnW / 2, btnY + btnH / 2);

    ctx.restore();
  }

  /**
   * (FIX M3.6) Diagrama de controles táctiles (joystick + A/B/C + ☰/🎒).
   */
  _renderTouchControlsGuide(ctx, winX, winY, winW, winH) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const drawPad = (cx, cy, r, icon, color, label) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 24, 0.9)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `bold ${Math.round(r * 0.9)}px monospace`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, cx, cy + 0.5);
      if (label) {
        ctx.font = '4.6px monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.textBaseline = 'top';
        ctx.fillText(label, cx, cy + r + 3);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    };

    // Joystick (inferior izquierda)
    const jx = winX + 52;
    const jy = winY + 108;
    ctx.beginPath();
    ctx.arc(jx, jy, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(jx, jy, 11, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲', jx, jy - 17);
    ctx.fillText('▼', jx, jy + 17);
    ctx.fillText('◀', jx - 17, jy);
    ctx.fillText('▶', jx + 17, jy);
    ctx.font = 'bold 5.5px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.fillText('MOVERSE', jx, jy + 34);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Botones de acción (inferior derecha)
    drawPad(winX + 238, winY + 116, 18, 'A', '#fde047', 'ATACAR / HABLAR');
    drawPad(winX + 200, winY + 104, 13, 'B', '#38bdf8', 'DASH');
    drawPad(winX + 238, winY + 88, 13, 'C', '#c084fc', 'PARRY');

    // Esquinas superiores
    drawPad(winX + 24, winY + 30, 9, '🎒', '#e2e8f0', 'MOCHILA');
    drawPad(winX + winW - 24, winY + 30, 9, '☰', '#e2e8f0', 'PAUSA');

    // Lista de equivalencias
    const lines = [
      ['🕹️', 'Joystick: moverte'],
      ['⚔️', 'A: atacar / interactuar'],
      ['⚡', 'B: dash'],
      ['🛡️', 'C: barrera / parry'],
      ['🎒', 'Bolsa: inventario'],
      ['☰', 'Pausa'],
      ['✕', 'Cierra paneles abiertos']
    ];
    const lx = winX + 92;
    let ly = winY + 24;
    ctx.font = '5.5px monospace';
    for (const [icon, text] of lines) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(icon, lx, ly);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(text, lx + 12, ly);
      ly += 11;
    }

    ctx.font = 'bold 5.5px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText('Toca en cualquier sitio para volver', winX + winW / 2, winY + winH - 14);
    ctx.textAlign = 'left';
  }

  /**
   * (FIX M3.6) Tutorial táctil de 3 pasos la primera vez que se juega en móvil.
   */
  startTouchTutorial() {
    this.state = 'touch_tutorial';
    this.touchTutorialStep = 0;
    this.touchTutorialDone = false;
    this._touchTutorialCooldown = 0.35;
    if (this.music && typeof this.music.playMenuSelect === 'function') this.music.playMenuSelect();
  }

  finishTouchTutorial() {
    this.state = 'none';
    this.touchTutorialDone = true;
    try {
      localStorage.setItem('ojete_touch_tutorial_done', '1');
    } catch (_) {
      /* localStorage no disponible */
    }
  }

  _renderTouchTutorial(ctx) {
    const W = this.viewportWidth;
    const H = this.viewportHeight;
    const steps = [
      { icon: '🕹️', title: 'MUEVE CON EL JOYSTICK', body: 'Arrastra el dedo en la esquina inferior izquierda. El pulgar sigue tu dedo.' },
      { icon: '⚔️', title: 'ATACA CON A', body: 'El botón A ataca. Si hay alguien cerca, habla o interactúa automáticamente.' },
      { icon: '☰', title: 'PAUSA CON ☰', body: 'Arriba a la derecha. Con 🎒 abres la mochila y con ✕ cierras los paneles.' }
    ];
    const step = steps[Math.max(0, Math.min(2, this.touchTutorialStep))];

    ctx.save();
    ctx.fillStyle = 'rgba(3, 5, 10, 0.88)';
    ctx.fillRect(0, 0, W, H);

    const cardW = 250;
    const cardH = 108;
    const cardX = Math.round((W - cardW) / 2);
    const cardY = Math.round((H - cardH) / 2);

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = '#e5c07b';
    ctx.fillRect(cardX + 1, cardY + 1, cardW - 2, cardH - 2);
    ctx.fillStyle = '#101728';
    ctx.fillRect(cardX + 2.5, cardY + 2.5, cardW - 5, cardH - 5);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '28px monospace';
    ctx.fillText(step.icon, W / 2, cardY + 12);

    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.fillText(step.title, W / 2, cardY + 40);

    ctx.font = '5.5px monospace';
    ctx.fillStyle = '#cbd5e1';
    const bodyLines = UILayout.wrapText(ctx, step.body, cardW - 30);
    bodyLines.slice(0, 3).forEach((line, idx) => {
      ctx.fillText(line, W / 2, cardY + 54 + idx * 9);
    });

    ctx.font = 'bold 5.5px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${this.touchTutorialStep + 1}/3 · TOCA PARA CONTINUAR`, W / 2, cardY + cardH - 14);
    ctx.restore();
  }

  /**
   * Pantalla de Salón de la Fama y Clasificación Global de Speedrun (Rango S a C)
   * Renderizada dentro del contenedor unificado de 290×150 px mediante LeaderboardView.
   */
  _renderLeaderboardScreen(ctx) {
    if (this.leaderboardView) {
      this.leaderboardView.scrollOffset = this.leaderboardScroll || 0;
      if (!this.leaderboardView.entries || this.leaderboardView.entries.length === 0) {
        this.leaderboardView.entries = this.leaderboardView._normalizeEntries(this.leaderboardList || []);
      }
      this.leaderboardView.render(ctx, {
        forceRender: true,
        closeLabel: '[Esc] Volver',
        backdropAlpha: 0.78
      });
    }
  }

  /**
   * Pantalla dramática de Game Over: "Se acabó la aventura".
   * Opciones: Cargar desde el último autoguardado o Salir al Menú Principal.
   */
  _renderGameOver(ctx) {
    const W = this.viewportWidth;
    const H = this.viewportHeight;
    const t = this.animTime;
    const cx = Math.round(W / 2);

    // Fondo abisal con pulso carmesí
    ctx.fillStyle = '#0a030c';
    ctx.fillRect(0, 0, W, H);

    const pulse = Math.sin(t * 3.2) * 12;
    const redGlow = ctx.createRadialGradient(cx, 46, 4, cx, 46, 88 + pulse);
    redGlow.addColorStop(0, 'rgba(215, 38, 56, 0.45)');
    redGlow.addColorStop(0.65, 'rgba(85, 12, 28, 0.22)');
    redGlow.addColorStop(1, 'rgba(10, 3, 12, 0)');
    ctx.fillStyle = redGlow;
    ctx.fillRect(0, 0, W, H);

    // Partículas de ceniza roja flotando hacia arriba
    ctx.fillStyle = 'rgba(255, 75, 95, 0.45)';
    for (let i = 0; i < 16; i++) {
      const px = (cx - 100 + ((i * 37 + Math.floor(t * 22)) % 200) + 200) % 200 + (cx - 100);
      const py = (H - ((t * 18 + i * 23) % H));
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    // Icono pixel art: Corazón quebrado en tinieblas
    const heartY = 20;
    ctx.fillStyle = '#ff2a55';
    // Lado izquierdo del corazón roto
    ctx.fillRect(cx - 12, heartY + 4, 8, 8);
    ctx.fillRect(cx - 10, heartY + 2, 6, 4);
    ctx.fillRect(cx - 8, heartY + 12, 4, 4);
    ctx.fillRect(cx - 6, heartY + 16, 2, 2);
    // Grieta negra
    ctx.fillStyle = '#0a030c';
    ctx.fillRect(cx - 3, heartY + 2, 3, 18);
    ctx.fillRect(cx - 1, heartY + 6, 3, 14);
    // Lado derecho del corazón roto
    ctx.fillStyle = '#b31238';
    ctx.fillRect(cx + 4, heartY + 5, 8, 8);
    ctx.fillRect(cx + 4, heartY + 3, 6, 4);
    ctx.fillRect(cx + 4, heartY + 13, 4, 4);
    ctx.fillRect(cx + 4, heartY + 17, 2, 2);

    // Si el Game Over es por desacato y cadena perpetua en la cárcel, dibujar barrotes de celda
    if (this.gameOverReason === 'jail_disrespect') {
      ctx.fillStyle = '#94a3b8';
      for (let bx = cx - 14; bx <= cx + 14; bx += 6) {
        ctx.fillRect(bx, heartY, 2, 22);
      }
      ctx.fillRect(cx - 16, heartY + 4, 32, 2);
      ctx.fillRect(cx - 16, heartY + 16, 32, 2);
    }

    // Título Principal
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#18040a';
    const mainTitle =
      this.gameOverReason === 'jail_disrespect'
        ? '⚔ CONDENA PERPETUA · GAME OVER ⚔'
        : '⚔ SE ACABÓ LA AVENTURA ⚔';
    ctx.fillText(mainTitle, cx + 1, 49);
    ctx.fillText(mainTitle, cx - 1, 49);
    ctx.fillStyle = '#ff4d6d';
    ctx.fillText(mainTitle, cx, 48);

    // Subtítulo contextual
    ctx.font = 'bold 6.5px monospace';
    ctx.fillStyle = '#ffb3c1';
    if (this.gameOverReason === 'jail_disrespect') {
      ctx.fillText('Has aceptado tu condena por faltar al respeto al Carcelero.', cx, 66);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('Tus provocaciones agotaron la paciencia de la guardia. La celda sella tu destino.', cx, 78);
    } else if (this.gameOverWasDefenseless) {
      ctx.fillText('¡Caíste indefenso! Sin la Armadura del Alba, cualquier golpe apaga tu vida.', cx, 66);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('Esquiva a los centinelas hacia el Templo de la Armadura para protegerte.', cx, 78);
    } else {
      ctx.fillText('Has sucumbido ante el poder de las sombras de Mister AI Alex.', cx, 66);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('La esperanza de la humanidad descansa en que vuelvas a alzarte.', cx, 78);
    }

    // Lista de botones
    const items = this._getCurrentMenuItems();
    this._renderMenuList(ctx, items, false);

    ctx.font = '6px monospace';
    ctx.fillStyle = '#7a8599';
    ctx.fillText('[W/S] Elegir · [E / Enter / Clic] Confirmar', cx, 168);

    ctx.restore();
  }

  /**
   * Pantalla del Mapa del Reino del Gran Ojal.
   * Delega el renderizado paisajístico y la ruta de progresión a WorldMap.js.
   */
  _renderWorldMap(ctx) {
    const gameState = this.callbacks?.getGameState ? this.callbacks.getGameState() : {};
    const player = this.worldMapContext?.player || gameState.player || null;
    const enemies = this.worldMapContext?.enemies || gameState.enemies || null;
    this.worldMap.render(ctx, this.currentSceneId, player, enemies);
  }

  /**
   * Dibuja el paisaje Pixel Art animado del Menú de Inicio (estilo Zelda 16-bits):
   * Cielo estrellado crepuscular, montañas nevadas, bosque, río brillante,
   * el Héroe junto a una hoguera en la colina y el emblema místico de EL OJETE DORADO.
   */
  _renderTitleBackdropPixelArt(ctx) {
    const W = this.viewportWidth;
    const H = this.viewportHeight;
    const t = this.animTime;

    // 1. Cielo cinematográfico: azul profundo → naranja oscuro de atardecer.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0a0a2a');
    sky.addColorStop(0.48, '#171331');
    sky.addColorStop(0.76, '#2e1c26');
    sky.addColorStop(1, '#4a2a0a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 2. Parallax sutil con el ratón (10% para las montañas).
    const mouseX = this._lastPointerX >= 0 ? this._lastPointerX : W / 2;
    const parallax = (mouseX - W / 2) * 0.1;

    // 3. Estrellas titilantes (36) con un parallax mínimo.
    for (const s of this.stars) {
      const twinkle = Math.sin(t * 2.2 + s.phase);
      const alpha = 0.35 + 0.65 * (0.5 + 0.5 * twinkle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = twinkle > 0.55 ? '#fff3b0' : '#a8c5e6';
      ctx.fillRect(Math.round(s.x + parallax * 0.25), s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // 4. Cordilleras lejanas y cercanas con siluetas pixeladas.
    this._drawTitleRidge(ctx, W, H, parallax * 0.5, 104, '#151a2e', 11, 20);
    this._drawTitleRidge(ctx, W, H, parallax, 121, '#0b1020', 15, 16);

    // 5. Valle y reflejo dorado del horizonte.
    ctx.fillStyle = '#07100e';
    ctx.fillRect(0, 139, W, H - 139);
    const glow = ctx.createLinearGradient(0, 132, 0, 158);
    glow.addColorStop(0, 'rgba(255, 160, 60, 0.16)');
    glow.addColorStop(1, 'rgba(255, 160, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 132, W, 26);

    // 6. Silueta del héroe de espaldas, respirando.
    this._renderTitleSilhouette(ctx, W, H, t);

    // 7. Luciérnagas verdes/amarillas cerca del suelo.
    for (const f of this.fireflies) {
      const fx = f.x + Math.sin(t * 0.4 + f.phase) * 10;
      const fy = f.y + Math.sin(t * 0.9 + f.phase) * 6;
      const a = 0.18 + 0.82 * (0.5 + 0.5 * Math.sin(t * 1.7 + f.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 5);
      fg.addColorStop(0, `rgba(190, 255, 120, ${(0.22 * a).toFixed(3)})`);
      fg.addColorStop(1, 'rgba(190, 255, 120, 0)');
      ctx.fillStyle = fg;
      ctx.fillRect(fx - 5, fy - 5, 10, 10);
    }
    ctx.globalAlpha = 1;

    // 8. Polvo dorado flotante (18 partículas sinusoidales).
    ctx.fillStyle = '#ffd885';
    for (const p of this.particles) {
      const py = (p.y + Math.floor(t * p.vy) + H) % H;
      const px = (p.x + Math.round(Math.sin(t * 1.5 + p.phase) * 6) + W) % W;
      ctx.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.2 + p.phase));
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  _drawTitleRidge(ctx, W, H, offset, baseY, color, amp, step) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-20, H);
    for (let x = -20; x <= W + 20; x += step) {
      const y =
        baseY +
        Math.sin((x + offset) * 0.034) * amp +
        Math.sin((x + offset) * 0.011) * amp * 0.6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 20, H);
    ctx.closePath();
    ctx.fill();
  }

  _renderTitleSilhouette(ctx, W, H, t) {
    const cx = Math.round(W / 2);
    const breathe = Math.sin(t * 1.5) * 0.8;
    const x = cx - 11;
    const y = Math.round(H - 38 + breathe);

    ctx.save();
    // Capa y torso oscuro.
    ctx.fillStyle = '#04060c';
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 22);
    ctx.lineTo(x + 20, y + 22);
    ctx.lineTo(x + 24, y + 34);
    ctx.lineTo(x - 2, y + 34);
    ctx.closePath();
    ctx.fill();
    // Piernas.
    ctx.fillRect(x + 5, y + 28, 5, 8);
    ctx.fillRect(x + 13, y + 28, 5, 8);
    // Cuerpo y hombros.
    ctx.fillRect(x + 4, y + 11, 16, 18);
    ctx.fillRect(x + 2, y + 12, 2, 6);
    ctx.fillRect(x + 20, y + 12, 2, 6);
    // Cabeza y pelo de espaldas.
    ctx.fillRect(x + 8, y + 3, 10, 9);
    ctx.fillRect(x + 7, y + 2, 12, 3);
    // Empuñadura de espada a la espalda.
    ctx.fillStyle = '#1b1b24';
    ctx.fillRect(x + 21, y + 8, 2, 15);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(x + 20, y + 7, 4, 2);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(x + 21, y + 8, 1, 1);
    // Borde de luz cálida en el lado derecho.
    ctx.fillStyle = 'rgba(255, 200, 90, 0.35)';
    ctx.fillRect(x + 21, y + 11, 1, 18);
    ctx.fillStyle = 'rgba(255, 200, 90, 0.22)';
    ctx.fillRect(x + 18, y + 2, 1, 10);
    ctx.restore();
  }

  _renderTitleHeader(ctx) {
    const W = this.viewportWidth;
    const cx = Math.round(W / 2);
    const t = this.animTime;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = false;

    // 1. Título con degradado dorado→naranja, sombra de 2 px y parpadeo sutil.
    const titleGrad = ctx.createLinearGradient(0, 8, 0, 26);
    titleGrad.addColorStop(0, '#ffd700');
    titleGrad.addColorStop(0.55, '#ffb300');
    titleGrad.addColorStop(1, '#ff8c00');
    const flicker = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.5));
    ctx.globalAlpha = flicker;
    ctx.font = `bold 15px ${GAME_FONT_UI}`;
    ctx.fillStyle = '#05030a';
    ctx.fillText('EL OJETE DORADO', cx + 2, 9);
    ctx.fillStyle = titleGrad;
    ctx.fillText('EL OJETE DORADO', cx, 7);
    ctx.globalAlpha = 1;

    ctx.font = `600 6px ${GAME_FONT_UI}`;
    ctx.fillStyle = '#05030a';
    ctx.fillText('~ LA LEYENDA DE VALLEVERDE ~', cx + 1, 28);
    ctx.fillStyle = '#7ae582';
    ctx.fillText('~ LA LEYENDA DE VALLEVERDE ~', cx, 27);

    // 2. Artefacto central flotante.
    const ax = cx;
    const ay = 50 + Math.sin(t * 2) * 5;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);

    // Halo radial dorado (lo realza el bloom).
    const halo = ctx.createRadialGradient(ax, ay, 2, ax, ay, 32 + pulse * 4);
    halo.addColorStop(0, `rgba(255, 225, 130, ${(0.5 + pulse * 0.15).toFixed(3)})`);
    halo.addColorStop(0.45, 'rgba(255, 176, 50, 0.2)');
    halo.addColorStop(1, 'rgba(255, 176, 50, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = halo;
    ctx.fillRect(ax - 40, ay - 40, 80, 80);
    ctx.restore();

    // Anillo exterior, anillo interior y brillo central.
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ax, ay, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(ax, ay, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.arc(ax, ay, 4, 0, Math.PI * 2);
    ctx.fill();
    // Pupila/ojete central.
    ctx.fillStyle = '#16120a';
    ctx.beginPath();
    ctx.arc(ax, ay, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(ax - 1, ay - 2, 1, 1);

    // 3. Partículas orbitando el artefacto.
    for (let i = 0; i < 8; i++) {
      const angle = t * 0.8 + (i * Math.PI) / 4;
      const radius = 18 + Math.sin(t * 2 + i) * 1.5;
      const px = ax + Math.cos(angle) * radius;
      const py = ay + Math.sin(angle) * radius * 0.72;
      ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3 + i));
      ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#fff3b0';
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
    ctx.globalAlpha = 1;

    // 4. Versión oficial.
    ctx.font = `600 6.5px ${GAME_FONT_UI}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillText(GAME_VERSION, W - 5, this.viewportHeight - 3);
    ctx.fillStyle = '#ffd885';
    ctx.fillText(GAME_VERSION, W - 6, this.viewportHeight - 4);
    ctx.restore();
  }

  _renderMenuList(ctx, items, isTitle = false) {
    const hitboxes = this._getMenuHitboxes(items.length, items);

    ctx.save();
    if (isTitle) {
      this._renderTitleMenu(ctx, items, hitboxes);
      ctx.restore();
      return;
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const pointerX = this._lastPointerX;
    const pointerY = this._lastPointerY;

    items.forEach((item, idx) => {
      const b = hitboxes[idx];
      const isSelected = idx === this.selectedIndex;
      const isHover = pointerX >= b.x && pointerX <= b.x + b.w && pointerY >= b.y && pointerY <= b.y + b.h;
      const isPressed = isHover && this._lastPointerDown;
      const sink = isPressed ? 1 : 0;
      const cy = b.y + b.h / 2 + sink;

      // Fila glass: gradiente dorado en seleccionada, brillo suave al hover.
      if (isSelected || isHover) {
        const strength = isSelected ? 0.24 : 0.12;
        const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y);
        grad.addColorStop(0, `rgba(253, 224, 71, ${strength})`);
        grad.addColorStop(0.6, `rgba(253, 224, 71, ${strength * 0.35})`);
        grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = isSelected ? 'rgba(253, 224, 71, 0.55)' : 'rgba(253, 224, 71, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }

      const iconColor = isSelected ? '#ffd700' : (isHover ? '#ffd885' : '#94a3b8');
      UILayout.drawIcon(ctx, this._menuIcon(item.label), b.x + 12, cy, 10, iconColor);

      const scale = isSelected ? 1.1 : (isHover ? 1.05 : 1);
      ctx.save();
      ctx.translate(b.x + 19, cy);
      ctx.scale(scale, scale);
      ctx.font = 'bold 7px monospace';
      const color = item.disabled ? '#636e85' : (isSelected || isHover ? '#ffd700' : '#e2e8f0');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(item.label, 1, 1);
      ctx.fillStyle = color;
      ctx.fillText(item.label, 0, 0);
      ctx.restore();
    });

    ctx.restore();
  }

  _menuIcon(label) {
    const l = String(label).toLowerCase();
    if (l.includes('continuar')) return 'play';
    if (l.includes('guardar') || l.includes('nube') || l.includes('cargar')) return 'save';
    if (l.includes('salón') || l.includes('récord')) return 'trophy';
    if (l.includes('ajuste') || l.includes('opciones')) return 'gear';
    if (l.includes('volumen') || l.includes('efectos')) return 'sound';
    if (l.includes('música')) return 'music';
    if (l.includes('control')) return 'gamepad';
    if (l.includes('volver') || l.includes('salir')) return 'back';
    if (l.includes('nueva')) return 'spark';
    if (l.includes('equipo')) return 'shield';
    if (l.includes('habilidad')) return 'sword';
    return 'star4';
  }

  _renderExpansionTeaser(ctx) {
    if (!this.expansionTeaserOpen) return;
    const frame = UILayout.drawModalFrame(ctx, {
      title: EXPANSION_INFO.title,
      icon: '✦',
      badge: `${EXPANSION_INFO.version} · ${EXPANSION_INFO.subtitle}`,
      closeLabel: '[E / Esc] Cerrar'
    });
    const { content } = frame;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    UILayout.drawText(ctx, EXPANSION_INFO.message, content.x + 5, content.y + 8, {
      font: 'bold 6px monospace',
      color: '#ffd700',
      shadow: true,
      maxWidth: content.w - 10
    });
    UILayout.drawText(ctx, EXPANSION_INFO.teaser, content.x + 5, content.y + 40, {
      font: '5px monospace',
      color: '#cbd5e1',
      shadow: true,
      maxWidth: content.w - 10
    });
    UILayout.drawText(ctx, '— FASE 1 · TEASER —', content.x + content.w / 2, content.y + content.h - 10, {
      font: 'bold 4px monospace',
      color: '#94a3b8',
      align: 'center',
      shadow: true
    });
    ctx.restore();
  }

  _renderTitleMenu(ctx, items, hitboxes) {
    const t = this.animTime;
    const panelX = 70;
    const panelY = 74;
    const panelW = 180;
    const lastBox = hitboxes[hitboxes.length - 1];
    const panelH = Math.max(72, (lastBox ? lastBox.y + lastBox.h : panelY + 72) - panelY + 8);

    // (DIRECTRIZ UI) Panel glass con sombra, borde dorado 2 px y brillo interior.
    ctx.save();
    UILayout.drawShadow(ctx, panelX, panelY, panelW, panelH, 0.4);
    const glass = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
    glass.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    glass.addColorStop(1, 'rgba(8, 13, 24, 0.9)');
    ctx.fillStyle = glass;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 1, panelY + 1, panelW - 2, panelH - 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 4.5, panelY + 4.5, panelW - 9, panelH - 9);

    ctx.font = `600 6.5px ${GAME_FONT_UI}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    items.forEach((item, idx) => {
      const b = hitboxes[idx];
      const selected = idx === this.selectedIndex;
      const pointerX = this._lastPointerX;
      const pointerY = this._lastPointerY;
      const isHover = pointerX >= b.x && pointerX <= b.x + b.w && pointerY >= b.y && pointerY <= b.y + b.h;
      const hasSubtext = Boolean(item.subtext);
      const cx = b.x + 20;
      const sink = (isHover && this._lastPointerDown) ? 1 : 0;
      const cy = (hasSubtext ? b.y + 7 : b.y + b.h / 2) + sink;
      const scale = selected ? 1.1 : (isHover ? 1.05 : 1);
      const label = UILayout.fitText(ctx, item.label, b.w - 28);
      const locked = Boolean(item.locked);

      if (selected || isHover) {
        const row = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
        row.addColorStop(0, `rgba(253, 224, 71, ${selected ? 0.2 : 0.09})`);
        row.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = row;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }

      UILayout.drawIcon(
        ctx,
        locked ? 'lock' : this._menuIcon(item.label),
        b.x + 10,
        b.y + b.h / 2,
        9,
        locked ? '#64748b' : (selected ? '#ffd700' : (isHover ? '#ffd885' : '#94a3b8'))
      );

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillText(label, 1, 1);
      if (item.disabled || locked) {
        ctx.fillStyle = '#64748b';
      } else if (item.expansion) {
        ctx.fillStyle = selected ? '#ffd700' : (isHover ? '#fde68a' : '#fbbf24');
      } else {
        ctx.fillStyle = selected ? '#ffd700' : (isHover ? '#ffd885' : '#f8fafc');
      }
      ctx.fillText(label, 0, 0);
      ctx.restore();

      if (hasSubtext) {
        ctx.save();
        ctx.font = '3.1px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = locked ? '#475569' : (selected ? '#fde68a' : '#cbd5e1');
        const subLines = UILayout.wrapText(ctx, item.subtext, b.w - 30).slice(0, 2);
        subLines.forEach((line, li) => {
          ctx.fillText(UILayout.fitText(ctx, line, b.w - 30), b.x + 20, b.y + 12 + sink + li * 4);
        });
        ctx.restore();
      }

      // Puntero dorado animado a la izquierda de la opción seleccionada.
      if (selected) {
        const pointerX = b.x - 10 + Math.sin(t * 5) * 2;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(pointerX, cy - 3);
        ctx.lineTo(pointerX + 5, cy);
        ctx.lineTo(pointerX, cy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(pointerX + 1, cy - 1, 1, 1);
      }
    });

    ctx.restore();
  }

  _renderModalPanel(ctx, title, items) {
    const isPauseModal =
      this.state === 'pause' ||
      this.state === 'pause_cloud' ||
      this.state === 'options' ||
      this.state === 'pause_sound';

    // Dimensiones estrictas de 240x150 px para los paneles de pausa y ajustes
    const winW = isPauseModal ? 240 : 216;
    const winH = isPauseModal ? 150 : (items.length > 5 ? Math.min(160, items.length * 13 + 46) : 128);
    const winX = Math.round((this.viewportWidth - winW) / 2);
    const winY = Math.round((this.viewportHeight - winH) / 2);

    ctx.save();
    // (BLOQUE 2.3) Pop de apertura 0.8 → 1.0 en 200 ms.
    const popElapsed = Math.max(0, this.animTime - (this._modalPopStart >= 0 ? this._modalPopStart : this.animTime - 0.2));
    const popT = Math.min(1, popElapsed / 0.2);
    const popScale = 0.8 + 0.2 * (1 - Math.pow(1 - popT, 3));
    const pivotX = this.viewportWidth / 2;
    const pivotY = this.viewportHeight / 2;
    ctx.translate(pivotX, pivotY);
    ctx.scale(popScale, popScale);
    ctx.translate(-pivotX, -pivotY);

    // Glassmorphism azul noche + borde dorado 2 px.
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 2;
    ctx.strokeRect(winX + 1, winY + 1, winW - 2, winH - 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(winX + 4.5, winY + 4.5, winW - 9, winH - 9);

    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, Math.round(this.viewportWidth / 2), winY + 8);

    // Botón superior derecho interactivo [✕ Volver]
    const closeBtn = this._getModalCloseButtonBounds(isPauseModal);
    const mx = this._lastPointerX ?? -1;
    const my = this._lastPointerY ?? -1;
    const isHoverClose = mx >= closeBtn.x && mx <= closeBtn.x + closeBtn.w && my >= closeBtn.y && my <= closeBtn.y + closeBtn.h;

    ctx.save();
    ctx.font = 'bold 5.5px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    if (isHoverClose) {
      ctx.fillStyle = '#ffd885';
      ctx.fillRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h);
      ctx.fillStyle = '#121624';
      ctx.fillText('✕ Volver [Esc]', winX + winW - 8, winY + 7);
    } else {
      ctx.fillStyle = '#2d3b55';
      ctx.fillRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h);
      ctx.fillStyle = '#192136';
      ctx.fillRect(closeBtn.x + 1, closeBtn.y + 1, closeBtn.w - 2, closeBtn.h - 2);
      ctx.fillStyle = '#9aa5b8';
      ctx.fillText('✕ Volver [Esc]', winX + winW - 8, winY + 7);
    }
    ctx.restore();

    this._renderMenuList(ctx, items, false);

    // Si NO es un modal de pausa ni opciones, renderizar la ayuda de pie de página
    if (!isPauseModal) {
      ctx.font = '5.5px monospace';
      ctx.fillStyle = '#9aa5b8';
      ctx.textAlign = 'center';
      ctx.fillText(
        '[W/S] Mover · [E / Enter / Clic] Seleccionar · [Esc] Volver',
        Math.round(this.viewportWidth / 2),
        winY + winH - 10
      );
    }
    ctx.restore();
  }

  _renderToastNotice(ctx, text, ty = 84) {
    ctx.save();
    ctx.font = `600 6.5px ${GAME_FONT_UI}`;
    const tw = Math.ceil(ctx.measureText(text).width) + 16;
    const th = 14;
    const tx = Math.round((this.viewportWidth - tw) / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    drawRoundedRect(ctx, tx + 1, ty + 1.5, tw, th, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(18, 22, 36, 0.95)';
    drawRoundedRect(ctx, tx, ty, tw, th, 4);
    ctx.fill();
    ctx.strokeStyle = '#7ae582';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#7ae582';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, Math.round(this.viewportWidth / 2), ty + th / 2);
    ctx.restore();
  }

  _renderExitScreen(ctx) {
    this._renderTitleBackdropPixelArt(ctx);
    ctx.fillStyle = 'rgba(8, 10, 18, 0.92)';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    const boxW = 286;
    const boxH = 118;
    const boxX = Math.round((this.viewportWidth - boxW) / 2);
    const boxY = Math.round((this.viewportHeight - boxH) / 2);

    ctx.save();
    // Borde exterior dorado
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4);
    // Fondo oscuro
    ctx.fillStyle = '#121624';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#263352';
    ctx.fillRect(boxX + 2, boxY + 2, boxW - 4, boxH - 4);
    ctx.fillStyle = '#0f1422';
    ctx.fillRect(boxX + 4, boxY + 4, boxW - 8, boxH - 8);

    const cx = Math.round(this.viewportWidth / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Título principal
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.fillText('¡GRACIAS POR JUGAR Y PROBAR EL JUEGO!', cx, boxY + 14);

    // Mensaje narrativo
    ctx.font = '7.5px monospace';
    ctx.fillStyle = '#f0f4f8';
    ctx.fillText('Mantente alerta, que a nuestro personaje le quedan', cx, boxY + 34);
    ctx.fillText('muchas aventuras por superar...', cx, boxY + 46);

    // Grito de guerra
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#5eead4';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 6;
    ctx.fillText('¡¡¡POR EL OJETEEEEEEEEE!!!', cx, boxY + 64);
    ctx.shadowBlur = 0;

    const sec = Math.max(1, Math.ceil(this.exitCountdown));
    if (this.exitCountdown > 0) {
      ctx.fillStyle = '#ffd885';
      ctx.font = 'bold 7px monospace';
      ctx.fillText(`Cerrando ventana en ${sec} segundo${sec > 1 ? 's' : ''}...`, cx, boxY + 84);
      ctx.font = '5.5px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('[Espera un instante mientras se completa la salida]', cx, boxY + 98);
    } else {
      ctx.font = '6px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Ventana finalizada. Ya puedes cerrar esta pestaña.', cx, boxY + 84);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('[Pulsa Esc, Enter o haz clic para volver al Menú Principal]', cx, boxY + 98);
    }
    ctx.restore();
  }

  /**
   * Renderiza las escenas cinemáticas en Pixel Art con ilustración animada arriba
   * y cuadro narrativo debajo.
   */
  _wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
}

