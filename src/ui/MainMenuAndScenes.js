import { CHARACTER_TYPES, ITEM_ICONS, ATLAS_SCALE } from '../graphics/SpriteSheetGenerator.js?v=7';
import { WorldMap } from './WorldMap.js?v=7';
import { EndingCredits } from './EndingCredits.js?v=7';
import { GAME_FONT_UI, drawRoundedRect } from './SpeechBubble.js?v=7';
import { getLocalLeaderboard, fetchGlobalLeaderboard } from '../core/ScoreSystem.js?v=7';
import { LeaderboardView } from './LeaderboardView.js?v=7';

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
    this.leaderboardView = new LeaderboardView(viewportWidth, viewportHeight);

    // Estados: 'title' | 'options' | 'cutscene' | 'exit_screen' | 'pause' | 'none'
    this.state = 'title';
    this.previousState = 'title';

    this.selectedIndex = 0;
    this.noticeText = '';
    this.noticeTimer = 0;
    this.animTime = 0;

    // Opciones persistentes
    this.options = {
      muted: false,
      volumeSteps: 3, // 1=25%, 2=50%, 3=75%, 4=100%
      textSpeed: 'normal' // 'normal' | 'fast' | 'instant'
    };
    this._loadOptions();

    // Estrellas y partículas para el arte Pixel Art
    this.stars = Array.from({ length: 42 }, (_, i) => ({
      x: (i * 53 + 17) % viewportWidth,
      y: (i * 29 + 7) % 88,
      phase: (i * 1.3) % (Math.PI * 2),
      size: i % 5 === 0 ? 2 : 1
    }));

    this.particles = Array.from({ length: 22 }, (_, i) => ({
      x: (i * 37) % viewportWidth,
      y: 20 + ((i * 41) % 130),
      vy: -6 - (i % 5) * 3,
      vx: ((i % 3) - 1) * 4,
      phase: i * 0.7
    }));

    // Estado de las escenas cinemáticas Pixel Art
    this.cutsceneSlides = [];
    this.cutsceneIndex = 0;
    this.cutsceneCharPos = 0;
    this.cutsceneLastBlip = -1;
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
    this.state = 'world_map';
    this.currentSceneId = currentSceneId;
    if (context) {
      this.worldMapContext = context;
    }
    this.music.playMenuSelect();
  }

  closeWorldMap() {
    this.state = 'none';
    this.music.playMenuMove();
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

  openControlsScreen(returnState = 'title') {
    this.previousStateBeforeControls = returnState;
    this.previousState = returnState;
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
    this.previousState = returnState;
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
    this.music.setMode('silent');
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
  }

  _ensureExitModals() {
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
    this._ensureExitModals();
    const modal = document.getElementById('exit-confirm-modal');
    if (modal) modal.classList.remove('hidden');
    const farewell = document.getElementById('exit-farewell-modal');
    if (farewell) farewell.classList.add('hidden');
  }

  _hideExitConfirmModal() {
    const modal = document.getElementById('exit-confirm-modal');
    if (modal) modal.classList.add('hidden');
  }

  _showExitFarewellModal() {
    this._ensureExitModals();
    this._hideExitConfirmModal();
    const modal = document.getElementById('exit-farewell-modal');
    if (modal) modal.classList.remove('hidden');
    this._updateExitCountdownDisplay(3);
  }

  _hideExitFarewellModal() {
    const modal = document.getElementById('exit-farewell-modal');
    if (modal) modal.classList.add('hidden');
  }

  _updateExitCountdownDisplay(seconds) {
    const secEl = document.getElementById('exit-farewell-countdown-sec');
    if (secEl) {
      secEl.textContent = String(seconds);
    }
  }

  _onExitCountdownComplete() {
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
    this.state = 'cutscene';
    this.music.setMode('emotional');
    this.onCutsceneComplete = () => {
      // Fundido suave a negro antes de comenzar la partida
      this.startFadeTransition(() => {
        this.state = 'none';
        if (typeof onComplete === 'function') {
          onComplete();
        }
      });
    };
    this.cutsceneIndex = 0;
    this.cutsceneCharPos = 0;
    this.cutsceneLastBlip = -1;

    this.cutsceneSlides = [
      {
        sceneType: 'anime_ai_alex',
        chapter: 'PRÓLOGO · LA AMENAZA DE MISTER AI ALEX (1/2)',
        text: 'En los confines oscuros del ciberespacio ancestral despertó una inteligencia abominable: MISTER AI ALEX.'
      },
      {
        sceneType: 'anime_ai_alex',
        chapter: 'PRÓLOGO · LA AMENAZA DE MISTER AI ALEX (2/2)',
        text: 'Considerando que la humanidad es un error de código que debe ser purgado, ha comenzado su plan maestro para esclavizar al mundo en su clúster eterno.'
      },
      {
        sceneType: 'anime_microwave_weapon',
        chapter: 'CAPÍTULO II · EL MICROONDAS CON DESPERTADOR (1/2)',
        text: 'Para ejecutar su destrucción masiva, ha ensamblado su invento más temible: EL MICROONDAS CON DESPERTADOR.'
      },
      {
        sceneType: 'anime_microwave_weapon',
        chapter: 'CAPÍTULO II · EL MICROONDAS CON DESPERTADOR (2/2)',
        text: 'Un artefacto capaz de recalentar el espacio-tiempo en O(1) y alterar la realidad a su antojo cuando suene su infernal alarma programada a las 00:00.'
      },
      {
        sceneType: 'anime_golden_prophecy',
        chapter: 'CAPÍTULO III · LA PROFECÍA DE EL OJETE DORADO (1/2)',
        text: 'Solo el resplandor sagrado de EL OJETE DORADO puede neutralizar la radiación de la alarma cósmica.'
      },
      {
        sceneType: 'anime_golden_prophecy',
        chapter: 'CAPÍTULO III · LA PROFECÍA DE EL OJETE DORADO (2/2)',
        text: 'Para hallarlo, nuestro programador deberá superar las Pruebas Sagradas: la Armadura Binaria, la Espada de la Recursividad y el Microondas Little.'
      },
      {
        sceneType: 'anime_awakening',
        chapter: 'CAPÍTULO IV · EL DESPERTAR EN VALLEVERDE (1/2)',
        text: 'Tu gran aventura comienza aquí, en la pacífica villa de Valleverde bajo el sol naciente.'
      },
      {
        sceneType: 'anime_awakening',
        chapter: 'CAPÍTULO IV · EL DESPERTAR EN VALLEVERDE (2/2)',
        text: 'Habla con el Sabio Aurelio, visita a los vecinos del pueblo y prepárate para cruzar el puente hacia la leyenda...'
      }
    ];
  }

  startHeroAdventureCutscene(onComplete) {
    this.startAnimeIntroCutscene(onComplete);
  }

  /**
   * Escena especial cuando el héroe empuña su primera arma (La Espada de la Recursividad).
   */
  startSwordObtainedCutscene(onComplete) {
    this.state = 'cutscene';
    this.onCutsceneComplete = onComplete;
    this.cutsceneIndex = 0;
    this.cutsceneCharPos = 0;
    this.cutsceneLastBlip = -1;
    this.music.playFanfare();

    this.cutsceneSlides = [
      {
        sceneType: 'sword_triumph',
        chapter: '★ PRIMERA ARMA · LA ESPADA DE LA RECURSIVIDAD ★',
        text: '¡Has empuñado la ESPADA DE LA RECURSIVIDAD! Cada tajo se llama a sí mismo en bucle controlado y seguro.'
      },
      {
        sceneType: 'sword_triumph',
        chapter: '★ PRIMERA ARMA · LA ESPADA DE LA RECURSIVIDAD ★',
        text: 'Usa [Clic Izq], [Espacio] o [F] para encadenar ataques continuamente sin temor a provocar un StackOverflowError.'
      }
    ];
  }

  /**
   * Escena especial cuando el jugador consigue el tesoro sagrado (El Microondas Little).
   */
  startRelicFoundCutscene(onComplete) {
    this.state = 'cutscene';
    this.onCutsceneComplete = onComplete;
    this.cutsceneIndex = 0;
    this.cutsceneCharPos = 0;
    this.cutsceneLastBlip = -1;
    this.music.playFanfare();

    this.cutsceneSlides = [
      {
        sceneType: 'relic_triumph',
        chapter: '★ RELIQUIA DIVINA · EL MICROONDAS LITTLE ★',
        text: '¡Has consagrado EL MICROONDAS LITTLE (SIN DESPERTADOR)! Una reliquia ancestral custodiada en el archivo del Sabio Aurelio.'
      },
      {
        sceneType: 'relic_triumph',
        chapter: '★ RELIQUIA DIVINA · EL MICROONDAS LITTLE ★',
        text: 'Sin despertador mortal, recalienta café y código espagueti en O(1), restaurando todas tus energías al instante. ¡Úsalo con sumo cuidado!'
      }
    ];
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
            this.music.playMenuSelect();
            this.previousState = 'title';
            this.state = 'options';
            this.selectedIndex = 0;
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
          label: 'Guardar Partida',
          action: () => {
            this.music.playFanfare();
            if (this.callbacks.onSaveGame) {
              this.callbacks.onSaveGame({ manual: true });
            }
          }
        },
        {
          label: 'Controles',
          action: () => {
            this.music.playMenuSelect();
            this.openControlsScreen('pause');
          }
        },
        {
          label: 'Opciones',
          action: () => {
            this.music.playMenuSelect();
            this.previousState = 'pause';
            this.state = 'options';
            this.selectedIndex = 0;
          }
        },
        {
          label: 'Guardar y Salir al Título',
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

    if (this.state === 'options') {
      const volPct = this.options.volumeSteps * 25;
      const speedLabels = {
        normal: 'Normal',
        fast: 'Rápida',
        instant: 'Instantánea'
      };
      const isFullscreen = Boolean(document.fullscreenElement);

      return [
        {
          label: `Sonido: ${this.options.muted ? 'Silenciado' : 'Activado'}`,
          action: () => {
            this.options.muted = !this.options.muted;
            this.saveOptions();
            this.music.playMenuSelect();
          }
        },
        {
          label: `Volumen: ${volPct}%`,
          action: () => {
            this.options.volumeSteps = (this.options.volumeSteps % 4) + 1;
            this.options.muted = false;
            this.saveOptions();
            this.music.playMenuSelect();
          }
        },
        {
          label: `Velocidad Texto: ${speedLabels[this.options.textSpeed] || 'Normal'}`,
          action: () => {
            const order = ['normal', 'fast', 'instant'];
            const idx = order.indexOf(this.options.textSpeed);
            this.options.textSpeed = order[(idx + 1) % order.length];
            this.saveOptions();
            this.music.playMenuSelect();
          }
        },
        {
          label: `Pantalla Completa: ${isFullscreen ? 'Sí' : 'No'}`,
          action: () => {
            this.music.playMenuSelect();
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen?.().catch(() => {});
            } else {
              document.exitFullscreen?.().catch(() => {});
            }
          }
        },
        {
          label: 'Volver',
          action: () => {
            this.music.playMenuMove();
            this.state = this.previousState || 'title';
            this.selectedIndex = 0;
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
      if (
        input.consumeKey('KeyM') ||
        input.consumeKey('Escape') ||
        input.consumeInteraction() ||
        input.consumePointerClick()
      ) {
        this.closeWorldMap();
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

    // Escenas Cinemáticas en Pixel Art
    if (this.state === 'cutscene') {
      const slide = this.cutsceneSlides[this.cutsceneIndex];
      if (!slide) {
        this._finishCutscene();
        return;
      }

      const charSpeed =
        this.options.textSpeed === 'instant'
          ? 999
          : this.options.textSpeed === 'fast'
            ? 65
            : 36;

      if (this.cutsceneCharPos < slide.text.length) {
        this.cutsceneCharPos = Math.min(
          slide.text.length,
          this.cutsceneCharPos + charSpeed * dt
        );
        const cIdx = Math.floor(this.cutsceneCharPos) - 1;
        if (cIdx >= 0 && cIdx !== this.cutsceneLastBlip && cIdx % 3 === 0) {
          this.cutsceneLastBlip = cIdx;
          this.music.playVoiceBlip('aurelio', slide.text[cIdx]);
        }
      }

      if (input.consumeKey('Escape')) {
        this.music.playMenuSelect();
        this._finishCutscene();
        return;
      }

      if (input.consumeInteraction() || input.consumePointerClick()) {
        if (this.cutsceneCharPos < slide.text.length) {
          this.cutsceneCharPos = slide.text.length;
        } else if (this.cutsceneIndex + 1 < this.cutsceneSlides.length) {
          this.cutsceneIndex += 1;
          this.cutsceneCharPos = 0;
          this.cutsceneLastBlip = -1;
          this.music.playMenuMove();
        } else {
          this.music.playMenuSelect();
          this._finishCutscene();
        }
      }
      return;
    }

    // Navegación de Menús (Title, Pause, Options)
    const items = this._getCurrentMenuItems();
    if (items.length === 0) return;

    const dir = input.consumeMenuDirection();
    if (dir === 'up' || dir === 'left') {
      this.selectedIndex = (this.selectedIndex + items.length - 1) % items.length;
      this.music.playMenuMove();
    } else if (dir === 'down' || dir === 'right') {
      this.selectedIndex = (this.selectedIndex + 1) % items.length;
      this.music.playMenuMove();
    }

    if (input.consumeKey('Escape')) {
      if (this.state === 'options') {
        this.state = this.previousState || 'title';
        this.selectedIndex = 0;
        this.music.playMenuMove();
        return;
      }
      if (this.state === 'pause') {
        this.closePauseMenu();
        return;
      }
    }

    // Soporte de ratón / puntero sobre los botones del menú
    const menuBounds = this._getMenuHitboxes(items.length);
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
      for (let i = 0; i < menuBounds.length; i++) {
        const b = menuBounds[i];
        if (
          click.x >= b.x &&
          click.x <= b.x + b.w &&
          click.y >= b.y &&
          click.y <= b.y + b.h
        ) {
          this.selectedIndex = i;
          items[i].action();
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

  _finishCutscene() {
    const cb = this.onCutsceneComplete;
    this.onCutsceneComplete = null;
    if (typeof cb === 'function') {
      cb();
    } else {
      this.state = 'none';
    }
  }

  _getMenuHitboxes(count) {
    const isTitle = this.state === 'title';
    const isGameOver = this.state === 'game_over';
    const boxW = isTitle ? 168 : isGameOver ? 204 : 184;
    const itemH = isTitle ? (count > 5 ? 12 : 14) : isGameOver ? 15 : (count > 5 ? 13 : 15);
    const startX = Math.round((this.viewportWidth - boxW) / 2);
    let startY = isTitle ? (count > 5 ? 93 : 105) : isGameOver ? (count > 2 ? 96 : 108) : 56;
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

    if (this.state === 'cutscene') {
      this._renderCutscene(ctx);
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
        ctx.fillStyle = 'rgba(8, 11, 20, 0.78)';
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
      (this.state === 'options' && this.previousState === 'title') ||
      (this.state === 'confirm_exit' && this.previousStateBeforeExit === 'title')
    ) {
      this._renderTitleBackdropPixelArt(ctx);
    } else {
      // Fondo semitransparente sobre la partida en pausa
      ctx.fillStyle = 'rgba(8, 11, 20, 0.76)';
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    if (this.state === 'title') {
      this._renderTitleHeader(ctx);
      this._renderMenuList(ctx, this._getCurrentMenuItems(), true);
    } else if (this.state === 'pause') {
      this._renderModalPanel(ctx, 'PAUSA · EL OJETE DORADO', this._getCurrentMenuItems());
    } else if (this.state === 'options') {
      this._renderModalPanel(ctx, 'OPCIONES DE JUEGO', this._getCurrentMenuItems());
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
    ctx.fillText('🎮 CONTROLES & GUÍA DE TECLAS · EL OJETE DORADO', winX + 8, winY + 6);

    ctx.font = '6px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText('[Escape / Clic] Volver', winX + winW - 8, winY + 7);

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

    // 1. Degradado por bandas Pixel Art de cielo nocturno/crepuscular
    const skyBands = [
      { y: 0, h: 24, color: '#090d1c' },
      { y: 24, h: 22, color: '#111936' },
      { y: 46, h: 20, color: '#1b264f' },
      { y: 66, h: 18, color: '#2b3366' },
      { y: 84, h: 16, color: '#473b6b' },
      { y: 100, h: 16, color: '#6e476b' }
    ];
    for (const b of skyBands) {
      ctx.fillStyle = b.color;
      ctx.fillRect(0, b.y, W, b.h);
    }

    // 2. Estrellas titilantes en Pixel Art
    for (const s of this.stars) {
      const twinkle = Math.sin(t * 2.6 + s.phase);
      if (twinkle > -0.2) {
        ctx.fillStyle = twinkle > 0.55 ? '#fff3b0' : '#a8c5e6';
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }

    // 3. Cordillera de montañas lejanas en Pixel Art
    ctx.fillStyle = '#1d2238';
    const peaks = [
      [0, 108], [28, 76], [56, 98], [92, 68], [130, 96],
      [160, 72], [198, 95], [236, 64], [276, 92], [304, 78], [320, 104]
    ];
    for (let x = 0; x < W; x += 2) {
      // Interpolación escalonada pixelada de las cumbres
      let seg = 0;
      for (let i = 0; i < peaks.length - 1; i++) {
        if (x >= peaks[i][0] && x <= peaks[i + 1][0]) {
          seg = i;
          break;
        }
      }
      const [x0, y0] = peaks[seg];
      const [x1, y1] = peaks[seg + 1] || [320, 104];
      const ratio = (x - x0) / Math.max(1, x1 - x0);
      const py = Math.round((y0 + (y1 - y0) * ratio) / 2) * 2;
      ctx.fillStyle = '#1e243b';
      ctx.fillRect(x, py, 2, H - py);
      if (py < 78) {
        ctx.fillStyle = '#c7d5e8';
        ctx.fillRect(x, py, 2, 4);
      }
    }

    // 4. Colinas verdes oscuras y río reflejando luz dorada
    ctx.fillStyle = '#142b29';
    ctx.fillRect(0, 112, W, H - 112);

    ctx.fillStyle = '#1d3d33';
    for (let x = 0; x < W; x += 8) {
      const treeH = 10 + ((x * 7) % 8);
      ctx.fillRect(x, 112 - treeH, 6, treeH);
      ctx.fillRect(x + 1, 110 - treeH, 4, 2);
    }

    // Río serpenteante al fondo
    for (let y = 114; y < H; y += 2) {
      const rx = 225 + Math.round(Math.sin(y * 0.12 + t) * 4);
      const rw = 16 + Math.floor((y - 114) * 0.35);
      ctx.fillStyle = '#1d4e75';
      ctx.fillRect(rx, y, rw, 2);
      if ((y + Math.floor(t * 6)) % 4 === 0) {
        ctx.fillStyle = '#f6c967';
        ctx.fillRect(rx + 4, y, Math.max(2, rw - 10), 1);
      }
    }

    // 5. Acantilado en primer plano a la izquierda con nuestro Héroe y una hoguera
    ctx.fillStyle = '#234930';
    ctx.fillRect(0, 134, 88, 46);
    ctx.fillStyle = '#366e42';
    ctx.fillRect(0, 132, 84, 4);
    ctx.fillStyle = '#4f9649';
    ctx.fillRect(4, 132, 72, 2);

    // Hoguera animada junto al héroe
    const fireX = 54;
    const fireY = 126;
    const flicker = Math.floor(t * 8) % 2;
    ctx.fillStyle = 'rgba(255, 190, 70, 0.22)';
    ctx.beginPath();
    ctx.arc(fireX + 4, fireY + 3, 18 + flicker * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5c3820';
    ctx.fillRect(fireX, fireY + 5, 8, 2);
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect(fireX + 1, fireY + 1 + flicker, 6, 4);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(fireX + 2, fireY + 2, 4, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fireX + 3, fireY + 3, 2, 1);

    // Dibujar al Héroe en el acantilado mirando hacia el horizonte
    if (this.assets && this.assets.charactersSheet) {
      const heroRow = CHARACTER_TYPES.HERO * 4 + 3; // Dirección 'right'
      ctx.drawImage(
        this.assets.charactersSheet,
        0,
        heroRow * 16 * ATLAS_SCALE,
        16 * ATLAS_SCALE,
        16 * ATLAS_SCALE,
        28,
        118,
        16,
        16
      );
    }

    // 6. Partículas doradas místicas flotando
    ctx.fillStyle = '#ffd885';
    for (const p of this.particles) {
      const py = (p.y + Math.floor(t * p.vy) + H) % H;
      const px = (p.x + Math.round(Math.sin(t * 1.5 + p.phase) * 6) + W) % W;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  /**
   * Dibuja el emblema de "EL OJETE DORADO" y el título principal estilo Zelda.
   */
  _renderTitleHeader(ctx) {
    const cx = Math.round(this.viewportWidth / 2);
    const t = this.animTime;
    const pulse = Math.sin(t * 3) * 1.5;

    // Resplandor místico detrás del emblema
    const grad = ctx.createRadialGradient(cx, 32, 2, cx, 32, 34 + pulse);
    grad.addColorStop(0, 'rgba(255, 216, 110, 0.55)');
    grad.addColorStop(0.6, 'rgba(229, 140, 40, 0.18)');
    grad.addColorStop(1, 'rgba(229, 140, 40, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, 32, 36, 0, Math.PI * 2);
    ctx.fill();

    // Emblema Pixel Art: "El Ojete Dorado" (Reliquia Anular Dorada con Alas estilo Zelda)
    const ey = 16 + Math.round(Math.sin(t * 2.2));
    // Alas doradas laterales
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(cx - 26, ey + 6, 52, 4);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - 24, ey + 5, 48, 2);
    ctx.fillRect(cx - 18, ey + 9, 36, 2);
    // Anillo exterior de oro macizo
    ctx.fillStyle = '#9c640c';
    ctx.fillRect(cx - 10, ey - 1, 20, 16);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - 9, ey, 18, 14);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(cx - 7, ey + 1, 14, 2);
    // Centro del Ojete (Esmeralda/Abismo Místico con pupila dorada brillante)
    ctx.fillStyle = '#121624';
    ctx.fillRect(cx - 5, ey + 3, 10, 8);
    ctx.fillStyle = '#2a9d8f';
    ctx.fillRect(cx - 4, ey + 4, 8, 6);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - 2, ey + 5, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1, ey + 5, 1, 1);

    // Cinta / Estandarte del Título
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Sombra de texto Pixel Art y Título Principal
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#120d1f';
    ctx.fillText('EL OJETE DORADO', cx + 1, 41);
    ctx.fillText('EL OJETE DORADO', cx - 1, 41);
    ctx.fillText('EL OJETE DORADO', cx, 42);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('EL OJETE DORADO', cx, 40);

    // Subtítulo estilo aventura Zelda
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#120d1f';
    ctx.fillText('~ LA LEYENDA DE VALLEVERDE ~', cx + 1, 59);
    ctx.fillStyle = '#7ae582';
    ctx.fillText('~ LA LEYENDA DE VALLEVERDE ~', cx, 58);
    ctx.restore();

    // Versión oficial del juego en la esquina inferior derecha (sin solapar con botones)
    ctx.save();
    ctx.font = `600 6.5px ${GAME_FONT_UI}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillText('v3.5', this.viewportWidth - 5, this.viewportHeight - 3);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('v3.5', this.viewportWidth - 6, this.viewportHeight - 4);
    ctx.restore();
  }

  _renderMenuList(ctx, items, isTitle = false) {
    const hitboxes = this._getMenuHitboxes(items.length);

    ctx.save();
    ctx.font = isTitle ? `600 6.5px ${GAME_FONT_UI}` : 'bold 7px monospace';
    ctx.textBaseline = 'top';

    items.forEach((item, idx) => {
      const b = hitboxes[idx];
      const isSelected = idx === this.selectedIndex;

      // Marco del botón
      ctx.fillStyle = isSelected ? '#ffd166' : '#2d3b55';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      ctx.fillStyle = isSelected ? '#243154' : 'rgba(16, 21, 36, 0.88)';
      ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);

      ctx.textAlign = 'center';
      if (item.disabled) {
        ctx.fillStyle = '#636e85';
      } else {
        ctx.fillStyle = isSelected ? '#ffd885' : '#e2e8f0';
      }

      const prefix = isSelected ? '▶ ' : '';
      const suffix = isSelected ? ' ◀' : '';
      ctx.fillText(
        `${prefix}${item.label}${suffix}`,
        b.x + Math.round(b.w / 2),
        b.y + (isTitle ? 3 : 4)
      );
    });

    ctx.restore();
  }

  _renderModalPanel(ctx, title, items) {
    const count = items.length;
    const itemH = count > 5 ? 13 : 15;
    const winW = 216;
    const winH = count > 5 ? Math.min(160, count * itemH + 46) : 128;
    const winX = Math.round((this.viewportWidth - winW) / 2);
    const winY = Math.round((this.viewportHeight - winH) / 2);

    ctx.save();
    ctx.fillStyle = '#121624';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.fillStyle = '#e5c07b';
    ctx.fillRect(winX + 1, winY + 1, winW - 2, winH - 2);
    ctx.fillStyle = '#192136';
    ctx.fillRect(winX + 3, winY + 3, winW - 6, winH - 6);

    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, Math.round(this.viewportWidth / 2), winY + 9);

    this._renderMenuList(ctx, items, false);

    ctx.font = '5.5px monospace';
    ctx.fillStyle = '#9aa5b8';
    ctx.fillText(
      '[W/S] Mover · [E / Enter / Clic] Seleccionar · [Esc] Volver',
      Math.round(this.viewportWidth / 2),
      winY + winH - 10
    );
    ctx.restore();
  }

  _renderToastNotice(ctx, text) {
    ctx.save();
    ctx.font = `600 6.5px ${GAME_FONT_UI}`;
    const tw = Math.ceil(ctx.measureText(text).width) + 16;
    const th = 14;
    const tx = Math.round((this.viewportWidth - tw) / 2);
    const ty = 84;

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
  _renderCutscene(ctx) {
    const W = this.viewportWidth;
    const H = this.viewportHeight;
    const slide = this.cutsceneSlides[this.cutsceneIndex];
    if (!slide) return;

    ctx.save();
    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, W, H);

    // Marco de la ventana de ilustración Pixel Art (272 x 96)
    const artX = 24;
    const artY = 16;
    const artW = W - 48;
    const artH = 96;

    ctx.save();
    ctx.beginPath();
    ctx.rect(artX, artY, artW, artH);
    ctx.clip();

    if (slide.sceneType === 'anime_ai_alex' || slide.sceneType === 'ai_alex_threat' || slide.sceneType === 'mister_ai_alex') {
      this._drawCutsceneAnimeAIAlex(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'anime_microwave_weapon' || slide.sceneType === 'microwave_weapon') {
      this._drawCutsceneAnimeMicrowave(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'anime_golden_prophecy' || slide.sceneType === 'golden_ojete_mission' || slide.sceneType === 'sanctuary') {
      this._drawCutsceneAnimeProphecy(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'anime_awakening') {
      this._drawCutsceneAnimeAwakening(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'sage_emotional') {
    } else if (slide.sceneType === 'stage1_trial') {
      this._drawCutsceneStage1Trial(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'sword_triumph') {
      this._drawCutsceneSwordTriumph(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'storm_bridge') {
      this._drawCutsceneStormBridge(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'village_life') {
      this._drawCutsceneVillageLife(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'hero_dawn') {
      this._drawCutsceneHeroDawn(ctx, artX, artY, artW, artH);
    } else if (slide.sceneType === 'relic_triumph') {
      this._drawCutsceneRelicTriumph(ctx, artX, artY, artW, artH);
    }
    ctx.restore();

    // Borde dorado del lienzo Pixel Art
    ctx.strokeStyle = '#e5c07b';
    ctx.lineWidth = 1;
    ctx.strokeRect(artX - 0.5, artY - 0.5, artW + 1, artH + 1);
    ctx.strokeStyle = '#2d3748';
    ctx.strokeRect(artX - 1.5, artY - 1.5, artW + 3, artH + 3);

    // Cinta superior con el título del capítulo
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(slide.chapter, artX, 5);

    ctx.font = '6px monospace';
    ctx.fillStyle = '#9aa5b8';
    ctx.textAlign = 'right';
    ctx.fillText(
      `Escena ${this.cutsceneIndex + 1}/${this.cutsceneSlides.length} · [Esc] Saltar`,
      artX + artW,
      6
    );

    // Cuadro de texto narrativo inferior
    const boxX = 16;
    const boxY = 118;
    const boxW = W - 32;
    const boxH = 54;

    ctx.fillStyle = '#121624';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#e5c07b';
    ctx.fillRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);
    ctx.fillStyle = '#1b2236';
    ctx.fillRect(boxX + 3, boxY + 3, boxW - 6, boxH - 6);

    const visibleStr = slide.text.slice(0, Math.floor(this.cutsceneCharPos));
    ctx.font = '7px monospace';
    ctx.fillStyle = '#f0f4f8';
    ctx.textAlign = 'left';
    const lines = this._wrapText(ctx, visibleStr, boxW - 18);
    const lineSpacing = 10.5;
    lines.forEach((line, idx) => {
      ctx.fillText(line, boxX + 9, boxY + 8 + idx * lineSpacing);
    });

    ctx.font = '6px monospace';
    ctx.fillStyle = '#ffd885';
    ctx.textAlign = 'right';
    const promptLabel =
      this.cutsceneCharPos >= slide.text.length
        ? '[E / Enter / Clic] Continuar ▶'
        : '[E] Completar texto...';
    ctx.fillText(promptLabel, boxX + boxW - 8, boxY + boxH - 8);

    ctx.restore();
  }

  /**
   * Escena Pixel Art 2: El Puente Oriental bajo la noche de tormenta y vigilancia.
   */
  _drawCutsceneStormBridge(ctx, x, y, w, h) {
    const t = this.animTime;
    const flash = Math.sin(t * 5) > 0.92;

    ctx.fillStyle = flash ? '#3b2d54' : '#11162b';
    ctx.fillRect(x, y, w, h);

    // Montañas oscuras del este
    ctx.fillStyle = '#1c223d';
    ctx.fillRect(x, y + 36, w, 24);

    // Relámpago ocasional en el horizonte oriental
    if (flash) {
      ctx.fillStyle = '#e0aaff';
      ctx.fillRect(x + w - 58, y + 6, 2, 14);
      ctx.fillRect(x + w - 60, y + 18, 2, 12);
      ctx.fillRect(x + w - 57, y + 28, 2, 12);
    }

    // Pradera nocturna y río caudaloso
    ctx.fillStyle = '#1b3b2b';
    ctx.fillRect(x, y + 52, w, h - 52);

    const riverX = x + Math.round(w * 0.56);
    ctx.fillStyle = '#1d4e75';
    ctx.fillRect(riverX, y + 52, 42, h - 52);

    // Olas del río
    for (let ry = y + 56; ry < y + h; ry += 8) {
      const shift = (Math.floor(t * 6) + ry) % 10;
      ctx.fillStyle = '#4ca0d9';
      ctx.fillRect(riverX + 6 + shift, ry, 10, 2);
    }

    // Puente de madera con la barrera nocturna
    ctx.fillStyle = '#7d4e2d';
    ctx.fillRect(riverX - 8, y + 64, 58, 16);
    ctx.fillStyle = '#96613b';
    for (let bx = riverX - 6; bx < riverX + 48; bx += 6) {
      ctx.fillRect(bx, y + 66, 4, 12);
    }
    // Barrera roja/dorada
    ctx.fillStyle = '#9e3b33';
    ctx.fillRect(riverX - 6, y + 64, 4, 16);
    ctx.fillStyle = '#f2d06b';
    ctx.fillRect(riverX - 6, y + 68, 4, 4);

    // Farola iluminando al Guardia Kael y al Sabio Aurelio
    const lampX = riverX - 28;
    const lampY = y + 54;
    ctx.fillStyle = 'rgba(255, 220, 110, 0.25)';
    ctx.beginPath();
    ctx.arc(lampX + 4, lampY + 6, 26, 0, Math.PI * 2);
    ctx.fill();

    if (this.assets && this.assets.charactersSheet) {
      const sheet = this.assets.charactersSheet;
      const srcCell = 16 * ATLAS_SCALE;
      // Guardia Kael vigilando frente al puente
      ctx.drawImage(sheet, 0, (CHARACTER_TYPES.GUARD * 4 + 0) * srcCell, srcCell, srcCell, riverX - 24, y + 62, 16, 16);
      // Anciano Aurelio mirando hacia el río
      ctx.drawImage(sheet, 0, (CHARACTER_TYPES.ELDER * 4 + 3) * srcCell, srcCell, srcCell, riverX - 52, y + 63, 16, 16);
    }
  }

  /**
   * Escena Anime 1: Retrato dramático del villano supremo MISTER AI ALEX.
   * Estilo Cyberpunk / Mecha Anime retro con líneas de velocidad y lluvia Matrix.
   */
  _drawCutsceneAnimeAIAlex(ctx, x, y, w, h) {
    const t = this.animTime;
    const cx = x + Math.round(w / 2);

    // Fondo: Gradiente cibernético profundo estilo Neo-Tokyo / Evangelion
    const skyGrad = ctx.createLinearGradient(x, y, x, y + h);
    skyGrad.addColorStop(0, '#04010a');
    skyGrad.addColorStop(0.5, '#160421');
    skyGrad.addColorStop(1, '#2c0429');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(x, y, w, h);

    // Rejilla de perspectiva 3D cibernética en el horizonte
    ctx.strokeStyle = 'rgba(255, 42, 109, 0.28)';
    ctx.lineWidth = 0.8;
    const horizonY = y + 54;
    for (let gx = x; gx <= x + w; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, y + h);
      ctx.lineTo(cx, horizonY);
      ctx.stroke();
    }
    for (let gy = horizonY + 6; gy <= y + h; gy += (gy - horizonY) * 0.45 + 4) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    // Líneas de velocidad anime radiales (action speed lines)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 20; i++) {
      const angle = (i * Math.PI * 2) / 20 + t * 0.4;
      const r1 = 30 + Math.sin(t * 12 + i) * 6;
      const r2 = 140;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, horizonY - 14 + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, horizonY - 14 + Math.sin(angle) * r2);
      ctx.stroke();
    }
    ctx.restore();

    // Lluvia de código binario Matrix (0 y 1 cayendo en columnas)
    ctx.font = '6px monospace';
    ctx.fillStyle = 'rgba(0, 245, 212, 0.55)';
    ctx.textAlign = 'center';
    for (let c = 0; c < 9; c++) {
      const colX = x + 16 + c * 28;
      const seed = c * 7;
      const charY = y + ((t * 40 + seed * 13) % (h - 10));
      const char = (Math.floor(t * 8 + seed) % 2).toString();
      ctx.fillText(char, colX, charY);
      ctx.fillStyle = 'rgba(255, 0, 110, 0.4)';
      ctx.fillText(((Math.floor(t * 8 + seed) + 1) % 2).toString(), colX + 10, ((charY + 24) % h) + y);
      ctx.fillStyle = 'rgba(0, 245, 212, 0.55)';
    }

    // Silueta de hombreras y torso mecha de Mister AI Alex
    ctx.fillStyle = '#0f051c';
    ctx.beginPath();
    ctx.moveTo(cx - 56, y + h);
    ctx.lineTo(cx - 36, y + 48);
    ctx.lineTo(cx - 24, y + 54);
    ctx.lineTo(cx + 24, y + 54);
    ctx.lineTo(cx + 36, y + 48);
    ctx.lineTo(cx + 56, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hombreras con placas angulares y circuitos luminosos
    ctx.fillStyle = '#1e0836';
    ctx.beginPath();
    ctx.moveTo(cx - 58, y + h);
    ctx.lineTo(cx - 38, y + 46);
    ctx.lineTo(cx - 20, y + 58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 58, y + h);
    ctx.lineTo(cx + 38, y + 46);
    ctx.lineTo(cx + 20, y + 58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cabeza / Casco cibernético imponente estilo Mecha Anime
    const headY = y + 32;
    ctx.fillStyle = '#16062b';
    ctx.beginPath();
    // Cuernos / antenas mecha
    ctx.moveTo(cx - 22, headY - 18);
    ctx.lineTo(cx - 14, headY - 4);
    ctx.lineTo(cx - 12, headY + 14);
    ctx.lineTo(cx, headY + 20);
    ctx.lineTo(cx + 12, headY + 14);
    ctx.lineTo(cx + 14, headY - 4);
    ctx.lineTo(cx + 22, headY - 18);
    ctx.lineTo(cx + 10, headY - 10);
    ctx.lineTo(cx, headY - 14);
    ctx.lineTo(cx - 10, headY - 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Visor cibernético carmesí con destello anime (Horizontal Eye Flare)
    const visorPulse = 0.8 + Math.sin(t * 5) * 0.2;
    ctx.fillStyle = `rgba(255, 0, 85, ${visorPulse})`;
    ctx.fillRect(cx - 12, headY, 24, 4);

    // Destello de lente anime horizontal continuo (Lens flare)
    ctx.save();
    const flareGrad = ctx.createLinearGradient(cx - 65, headY + 2, cx + 65, headY + 2);
    flareGrad.addColorStop(0, 'rgba(255, 0, 85, 0)');
    flareGrad.addColorStop(0.35, 'rgba(255, 42, 109, 0.7)');
    flareGrad.addColorStop(0.5, '#ffffff');
    flareGrad.addColorStop(0.65, 'rgba(255, 42, 109, 0.7)');
    flareGrad.addColorStop(1, 'rgba(255, 0, 85, 0)');
    ctx.fillStyle = flareGrad;
    ctx.fillRect(cx - 65, headY + 1, 130, 2);
    ctx.restore();

    // Núcleo pectoral de energía oscura (Plasma Reactor)
    const coreGlow = ctx.createRadialGradient(cx, y + 68, 2, cx, y + 68, 16);
    coreGlow.addColorStop(0, '#ffffff');
    coreGlow.addColorStop(0.4, '#b5179e');
    coreGlow.addColorStop(1, 'rgba(181, 23, 158, 0)');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(cx, y + 68, 16, 0, Math.PI * 2);
    ctx.fill();

    // Cartelas y HUD holográfico estilo Anime Cyberpunk
    ctx.font = 'bold 6px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'left';
    ctx.fillText('[ SYS.OVERRIDE: AI_ALEX ]', x + 6, y + 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff0055';
    ctx.fillText('TARGET: HUMANIDAD', x + w - 6, y + 12);

    // Badge anime central
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe066';
    ctx.fillText('【 悪意の知能 · MISTER AI ALEX 】', cx, y + h - 5);
  }

  /**
   * Escena Anime 2: El arma apocalíptica: El Microondas con Despertador.
   */
  _drawCutsceneAnimeMicrowave(ctx, x, y, w, h) {
    const t = this.animTime;
    const cx = x + Math.round(w / 2);

    // Fondo: Vórtice interdimensional púrpura y magenta
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, '#06010d');
    bg.addColorStop(0.5, '#190326');
    bg.addColorStop(1, '#2f0438');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    // Ondas de choque electromagnéticas expansivas
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const wave = ((t * 50 + i * 26) % 80) + 10;
      const alpha = Math.max(0, 1 - wave / 90);
      ctx.strokeStyle = i % 2 === 0 ? `rgba(255, 0, 85, ${alpha})` : `rgba(0, 240, 255, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, y + 54, wave * 1.3, wave * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // ====== CHASIS DEL GRAN MICROONDAS MECHA ======
    const uW = 96;
    const uH = 50;
    const uX = cx - Math.round(uW / 2);
    const uY = y + 38;

    // Sombra proyectada
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(uX + 3, uY + 3, uW, uH);

    // Marco exterior con franjas diagonales de advertencia química/radiación (Hazard Stripes)
    ctx.fillStyle = '#0f1422';
    ctx.fillRect(uX, uY, uW, uH);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1;
    ctx.strokeRect(uX + 0.5, uY + 0.5, uW - 1, uH - 1);

    // Franja de advertencia superior
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(uX + 2, uY + 2, uW - 4, 3);
    ctx.fillStyle = '#0f1422';
    for (let hx = uX + 4; hx < uX + uW - 4; hx += 8) {
      ctx.fillRect(hx, uY + 2, 4, 3);
    }

    // Puerta de cristal con reactor de calor cuántico
    const doorW = 60;
    const doorH = 38;
    const doorX = uX + 6;
    const doorY = uY + 7;

    ctx.fillStyle = '#060914';
    ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.strokeStyle = '#00f0ff';
    ctx.strokeRect(doorX + 0.5, doorY + 0.5, doorW - 1, doorH - 1);

    // Plasma cuántico radiactivo giratorio interior (recalentamiento espacio-temporal)
    const heatGlow = ctx.createRadialGradient(doorX + 30, doorY + 19, 2, doorX + 30, doorY + 19, 26);
    heatGlow.addColorStop(0, '#ffffff');
    heatGlow.addColorStop(0.3, '#ffbe0b');
    heatGlow.addColorStop(0.65, '#fb5607');
    heatGlow.addColorStop(1, '#ff006e');
    ctx.fillStyle = heatGlow;
    ctx.fillRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4);

    // Rejilla microondas anime
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    for (let gy = doorY + 4; gy < doorY + doorH - 3; gy += 4) {
      for (let gx = doorX + 4; gx < doorX + doorW - 3; gx += 4) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }

    // Panel de control derecho
    const panelX = uX + 70;
    const panelY = uY + 7;
    const panelW = 20;
    const panelH = 38;

    ctx.fillStyle = '#090d1a';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    // Botón rojo apocalíptico de fusión
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(panelX + 3, panelY + 3, 14, 5);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(panelX + 3, panelY + 11, 6, 3);
    ctx.fillRect(panelX + 11, panelY + 11, 6, 3);
    ctx.fillRect(panelX + 3, panelY + 16, 6, 3);
    ctx.fillRect(panelX + 11, panelY + 16, 6, 3);

    // Dial giratorio
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(panelX + 10, panelY + 28, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();

    // ====== DESPERTADOR RETRO-ANIME CON CAMPANAS VIBRANDO ======
    const clockW = 50;
    const clockH = 15;
    const clockX = cx - Math.round(clockW / 2);
    const clockY = uY - 14;

    // Caja del despertador
    ctx.fillStyle = '#7a0016';
    ctx.fillRect(clockX, clockY, clockW, clockH);
    ctx.strokeStyle = '#ff0055';
    ctx.strokeRect(clockX - 0.5, clockY - 0.5, clockW + 1, clockH + 1);

    // Campanas vibrando a alta frecuencia (animación de timbre)
    const bellShake = Math.sin(t * 44) * 2;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(clockX + 8 + bellShake, clockY - 4, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(clockX + clockW - 8 - bellShake, clockY - 4, 6, Math.PI, Math.PI * 2);
    ctx.fill();

    // Martillo de impacto
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1 + bellShake * 1.5, clockY - 7, 2, 6);

    // Pantalla digital de la alarma a punto de estallar
    ctx.fillStyle = '#030712';
    ctx.fillRect(clockX + 4, clockY + 2, clockW - 8, clockH - 4);

    const isBlink = Math.floor(t * 4) % 2 === 0;
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isBlink ? '#ff0055' : '#ffbe0b';
    ctx.fillText('00:00:01', cx, clockY + Math.round(clockH / 2));

    // Cartel anime inferior
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#ffbe0b';
    ctx.fillText('【 終末兵器 · MICROONDAS CON DESPERTADOR 】', cx, y + h - 5);
  }

  /**
   * Escena Anime 3: La profecía de El Ojete Dorado y los 3 artefactos sagrados.
   */
  _drawCutsceneAnimeProphecy(ctx, x, y, w, h) {
    const t = this.animTime;
    const cx = x + Math.round(w / 2);

    // Fondo: Cielo celestial estrellado
    const skyGrad = ctx.createLinearGradient(x, y, x, y + h);
    skyGrad.addColorStop(0, '#060a1f');
    skyGrad.addColorStop(0.5, '#151b3b');
    skyGrad.addColorStop(1, '#3a1c54');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(x, y, w, h);

    // Rayos estelares dorados de El Ojete Dorado
    ctx.save();
    ctx.translate(cx, y + 26);
    ctx.rotate(t * 0.4);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 209, 102, 0.22)' : 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 70, (i * Math.PI * 2) / 12, ((i + 0.6) * Math.PI * 2) / 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Símbolo sagrado central: El Ojete Dorado reluciente
    const haloGlow = ctx.createRadialGradient(cx, y + 26, 4, cx, y + 26, 28);
    haloGlow.addColorStop(0, '#ffffff');
    haloGlow.addColorStop(0.4, '#ffd166');
    haloGlow.addColorStop(0.8, '#f77f00');
    haloGlow.addColorStop(1, 'rgba(247, 127, 0, 0)');
    ctx.fillStyle = haloGlow;
    ctx.beginPath();
    ctx.arc(cx, y + 26, 28, 0, Math.PI * 2);
    ctx.fill();

    // Anillo dorado exterior
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, y + 26, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, y + 26, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Tres pedestales de los tesoros sagrados en la parte inferior
    const pedY = y + 58;
    const p1X = cx - 72;
    const p2X = cx;
    const p3X = cx + 72;

    const drawPedestal = (px, label, iconType, desc) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px - 22, pedY + 12, 44, 18);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 21.5, pedY + 12.5, 43, 17);

      // Icono flotante con aura
      const bob = Math.sin(t * 4 + px) * 2;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.arc(px, pedY + bob, 11, 0, Math.PI * 2);
      ctx.fill();

      if (this.assets && this.assets.itemsSheet) {
        const srcCell = 16 * ATLAS_SCALE;
        ctx.drawImage(
          this.assets.itemsSheet,
          iconType * srcCell,
          0,
          srcCell,
          srcCell,
          px - 8,
          pedY - 8 + bob,
          16,
          16
        );
      }

      ctx.font = 'bold 5.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label, px, pedY + 20);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(desc, px, pedY + 27);
    };

    drawPedestal(p1X, 'Espada', ITEM_ICONS.SWORD, 'Recursividad');
    drawPedestal(p2X, 'Armadura', ITEM_ICONS.ARMOR, 'Binaria');
    drawPedestal(p3X, 'Reliquia', ITEM_ICONS.GOLDEN_APPLE, 'Little');

    // Cartel superior
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('【 三種の神器 · LOS 3 ARTEFACTOS SAGRADOS 】', cx, y + h - 5);
  }

  /**
   * Escena Anime 4: El amanecer en Valleverde y el comienzo del viaje.
   */
  _drawCutsceneAnimeAwakening(ctx, x, y, w, h) {
    const t = this.animTime;
    const cx = x + Math.round(w / 2);

    // Cielo del amanecer anime (Amanecer en Valleverde)
    const dawnGrad = ctx.createLinearGradient(x, y, x, y + h);
    dawnGrad.addColorStop(0, '#590d22');
    dawnGrad.addColorStop(0.35, '#a4133c');
    dawnGrad.addColorStop(0.65, '#ff758f');
    dawnGrad.addColorStop(0.85, '#ffb703');
    dawnGrad.addColorStop(1, '#8ecae6');
    ctx.fillStyle = dawnGrad;
    ctx.fillRect(x, y, w, h);

    // Sol naciente en la colina
    const sunX = cx + 45;
    const sunY = y + 42;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 48);
    sunGlow.addColorStop(0, '#ffffff');
    sunGlow.addColorStop(0.25, '#fff3b0');
    sunGlow.addColorStop(0.6, 'rgba(255, 183, 3, 0.45)');
    sunGlow.addColorStop(1, 'rgba(255, 183, 3, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 48, 0, Math.PI * 2);
    ctx.fill();

    // Colinas verdes en capas (profundidad de campo anime)
    ctx.fillStyle = '#3a5a40';
    ctx.beginPath();
    ctx.moveTo(x, y + 58);
    ctx.quadraticCurveTo(cx - 30, y + 40, cx + 50, y + 48);
    ctx.quadraticCurveTo(cx + 100, y + 54, x + w, y + 52);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.fill();

    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.moveTo(x, y + 68);
    ctx.quadraticCurveTo(cx - 40, y + 56, cx + 20, y + 62);
    ctx.quadraticCurveTo(cx + 80, y + 66, x + w, y + 60);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.fill();

    // Siluetas de casas y molino de Valleverde
    ctx.fillStyle = '#1b4332';
    // Molino
    const millX = cx - 60;
    const millY = y + 46;
    ctx.fillRect(millX - 5, millY, 10, 18);
    // Aspas giratorias del molino
    ctx.save();
    ctx.translate(millX, millY + 3);
    ctx.rotate(t * 1.5);
    ctx.strokeStyle = '#d8f3dc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
    ctx.moveTo(0, -10); ctx.lineTo(0, 10);
    ctx.stroke();
    ctx.restore();

    // Casitas con tejados
    const houseX = cx - 18;
    const houseY = y + 54;
    ctx.fillRect(houseX, houseY, 14, 10);
    ctx.beginPath();
    ctx.moveTo(houseX - 2, houseY);
    ctx.lineTo(houseX + 7, houseY - 6);
    ctx.lineTo(houseX + 16, houseY);
    ctx.closePath();
    ctx.fill();

    // Humo suave subiendo de la chimenea
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    const smokeY = (t * 15) % 18;
    ctx.beginPath();
    ctx.arc(houseX + 12 + Math.sin(t * 3) * 2, houseY - 6 - smokeY, 2 + smokeY * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Pétalos de flores / cerezo flotando suavemente en la brisa
    ctx.fillStyle = '#ffb3c6';
    for (let i = 0; i < 14; i++) {
      const px = x + ((t * 22 + i * 27) % w);
      const py = y + 16 + ((i * 19 + Math.sin(t * 2.5 + i) * 12) % (h - 26));
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    // Cartel anime inferior
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('【 旅立ち · EL COMIENZO EN VALLEVERDE 】', cx, y + h - 5);
  }

  /**
   * Escena emotiva 4: Las Ruinas del Despertar (Armadura al Oeste, Espada al Norte, héroe indefenso).
   */
  _drawCutsceneStage1Trial(ctx, x, y, w, h) {
    const t = this.animTime;
    const cx = x + Math.round(w / 2);

    ctx.fillStyle = '#15192b';
    ctx.fillRect(x, y, w, h);

    // Suelo de ruinas
    ctx.fillStyle = '#2a3347';
    ctx.fillRect(x, y + 58, w, h - 58);

    // Pedestal Oeste (Armadura) y Pedestal Norte (Espada)
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x + 36, y + 52, 20, 10);
    ctx.fillRect(cx - 10, y + 26, 20, 10);

    if (this.assets && this.assets.itemsSheet && this.assets.charactersSheet) {
      const itemSheet = this.assets.itemsSheet;
      const charSheet = this.assets.charactersSheet;
      const srcCell = 16 * ATLAS_SCALE;
      const bob = Math.sin(t * 4) * 2;

      // Armadura del Alba al Oeste
      ctx.drawImage(itemSheet, ITEM_ICONS.ARMOR * srcCell, 0, srcCell, srcCell, x + 38, y + 34 + bob, 16, 16);
      // Espada del Alba al Norte
      ctx.drawImage(itemSheet, ITEM_ICONS.SWORD * srcCell, 0, srcCell, srcCell, cx - 8, y + 8 + bob, 16, 16);

      // Centinela de AI Alex patrullando en medio
      const walkFrame = Math.floor(t * 5) % 4;
      const patrolOffset = Math.sin(t * 2) * 18;
      ctx.drawImage(
        charSheet,
        walkFrame * srcCell,
        (CHARACTER_TYPES.SHADOW_DRONE * 4 + 3) * srcCell,
        srcCell,
        srcCell,
        cx - 32 + patrolOffset,
        y + 44,
        16,
        16
      );

      // Héroe indefenso en el refugio sur observando con cautela
      ctx.drawImage(charSheet, 0, (CHARACTER_TYPES.HERO * 4 + 1) * srcCell, srcCell, srcCell, cx + 38, y + 56, 16, 16);
    }
  }

  /**
   * Escena Especial: El Héroe alza la Espada del Alba vestido con su Armadura.
   */
  _drawCutsceneSwordTriumph(ctx, x, y, w, h) {
    const t = this.animTime;
    const cx = x + Math.round(w / 2);

    ctx.fillStyle = '#121c36';
    ctx.fillRect(x, y, w, h);

    const beamGrad = ctx.createRadialGradient(cx, y + 40, 4, cx, y + 40, 74);
    beamGrad.addColorStop(0, 'rgba(255, 232, 135, 0.78)');
    beamGrad.addColorStop(0.5, 'rgba(90, 175, 255, 0.28)');
    beamGrad.addColorStop(1, 'rgba(18, 28, 54, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#2d4b43';
    ctx.fillRect(x, y + 68, w, h - 68);

    if (this.assets && this.assets.charactersSheet && this.assets.itemsSheet) {
      const srcCell = 16 * ATLAS_SCALE;
      const heroType = CHARACTER_TYPES.HERO_ARMORED;
      ctx.drawImage(
        this.assets.charactersSheet,
        0,
        (heroType * 4 + 0) * srcCell,
        srcCell,
        srcCell,
        cx - 9,
        y + 50,
        18,
        18
      );
      const bob = Math.sin(t * 4) * 2;
      ctx.drawImage(
        this.assets.itemsSheet,
        ITEM_ICONS.SWORD * srcCell,
        0,
        srcCell,
        srcCell,
        cx - 8,
        y + 28 + bob,
        16,
        16
      );
    }
  }

  /**
   * Escena Pixel Art 3: Vida cotidiana en Valleverde (vecinos y animales).
   */
  _drawCutsceneVillageLife(ctx, x, y, w, h) {
    const t = this.animTime;
    const walkFrame = Math.floor(t * 5) % 4;

    // Cielo diurno luminoso y pradera verde
    ctx.fillStyle = '#5aa9e6';
    ctx.fillRect(x, y, w, 38);
    ctx.fillStyle = '#3f7d3c';
    ctx.fillRect(x, y + 38, w, h - 38);

    // Camino de adoquines central
    ctx.fillStyle = '#b88b5a';
    ctx.fillRect(x, y + 62, w, 18);

    // Casita de tejado rojo al fondo izquierdo y herrería a la derecha
    ctx.fillStyle = '#dfd3c3';
    ctx.fillRect(x + 22, y + 26, 44, 24);
    ctx.fillStyle = '#b03a3a';
    ctx.fillRect(x + 20, y + 16, 48, 12);
    ctx.fillStyle = '#7c4a2b';
    ctx.fillRect(x + 40, y + 36, 8, 14);

    ctx.fillStyle = '#dfd3c3';
    ctx.fillRect(x + w - 72, y + 26, 48, 24);
    ctx.fillStyle = '#385985';
    ctx.fillRect(x + w - 74, y + 16, 52, 12);

    if (this.assets && this.assets.charactersSheet) {
      const sheet = this.assets.charactersSheet;
      const srcCell = 16 * ATLAS_SCALE;
      // Lyra cuidando flores
      ctx.drawImage(sheet, walkFrame * srcCell, (CHARACTER_TYPES.HERBALIST * 4 + 0) * srcCell, srcCell, srcCell, x + 36, y + 54, 16, 16);
      // Oráculo Orion en el centro
      ctx.drawImage(sheet, 0, (CHARACTER_TYPES.AI_ORACLE * 4 + 0) * srcCell, srcCell, srcCell, x + 112, y + 50, 16, 16);
      // Herrero Brom
      ctx.drawImage(sheet, walkFrame * srcCell, (CHARACTER_TYPES.BLACKSMITH * 4 + 2) * srcCell, srcCell, srcCell, x + w - 56, y + 54, 16, 16);
      // Oveja Copito y Perro Toby
      ctx.drawImage(sheet, walkFrame * srcCell, (CHARACTER_TYPES.SHEEP * 4 + 3) * srcCell, srcCell, srcCell, x + 76, y + 64, 16, 16);
      ctx.drawImage(sheet, walkFrame * srcCell, (CHARACTER_TYPES.DOG * 4 + 2) * srcCell, srcCell, srcCell, x + 150, y + 64, 16, 16);
    }
  }

  /**
   * Escena Pixel Art 4: El Despertar del Héroe frente al amanecer dorado.
   */
  _drawCutsceneHeroDawn(ctx, x, y, w, h) {
    const t = this.animTime;
    const cx = x + Math.round(w / 2);

    // Bandas de amanecer dorado
    const bands = [
      { y: 0, h: 20, c: '#2b2d5c' },
      { y: 20, h: 18, c: '#6b3e6e' },
      { y: 38, h: 18, c: '#b85d56' },
      { y: 56, h: 20, c: '#eb984e' },
      { y: 76, h: 20, c: '#ffd166' }
    ];
    for (const b of bands) {
      ctx.fillStyle = b.c;
      ctx.fillRect(x, y + b.y, w, b.h);
    }

    // Sol naciente gigante en Pixel Art
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(cx, y + 64, 22, 0, Math.PI * 2);
    ctx.fill();

    // Silueta de pradera y colina central
    ctx.fillStyle = '#24472c';
    ctx.fillRect(x, y + 68, w, h - 68);
    ctx.fillStyle = '#326630';
    ctx.fillRect(cx - 48, y + 62, 96, 34);

    if (this.assets && this.assets.charactersSheet) {
      const walkFrame = Math.floor(t * 4) % 4;
      const srcCell = 16 * ATLAS_SCALE;
      ctx.drawImage(
        this.assets.charactersSheet,
        walkFrame * srcCell,
        (CHARACTER_TYPES.HERO * 4 + 0) * srcCell,
        srcCell,
        srcCell,
        cx - 8,
        y + 50,
        16,
        16
      );
    }
  }

  /**
   * Escena Pixel Art Especial: Triunfo al hallar el tesoro dorado del Este.
   */
  _drawCutsceneRelicTriumph(ctx, x, y, w, h) {
    const t = this.animTime;
    const cx = x + Math.round(w / 2);

    ctx.fillStyle = '#182038';
    ctx.fillRect(x, y, w, h);

    const grad = ctx.createRadialGradient(cx, y + 44, 4, cx, y + 44, 64);
    grad.addColorStop(0, 'rgba(255, 225, 120, 0.65)');
    grad.addColorStop(1, 'rgba(24, 32, 56, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#326630';
    ctx.fillRect(x, y + 68, w, h - 68);

    if (this.assets && this.assets.charactersSheet && this.assets.itemsSheet) {
      const srcCell = 16 * ATLAS_SCALE;
      ctx.drawImage(
        this.assets.charactersSheet,
        0,
        (CHARACTER_TYPES.HERO_ARMORED * 4 + 0) * srcCell,
        srcCell,
        srcCell,
        cx - 8,
        y + 52,
        16,
        16
      );
      const bob = Math.round(Math.sin(t * 4) * 2);
      ctx.drawImage(
        this.assets.itemsSheet,
        ITEM_ICONS.GOLDEN_APPLE * srcCell,
        0,
        srcCell,
        srcCell,
        cx - 8,
        y + 32 + bob,
        16,
        16
      );
    }
  }

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

