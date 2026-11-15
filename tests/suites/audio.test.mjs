import { DialogueBox } from '../../src/ui/DialogueBox.js';
import { GAME_VERSION } from '../../src/ui/UILayout.js';
import { AudioManager, BGM_TRACKS, BGM_MAX_VOLUME, registerExpansionMusic } from '../../src/audio/AudioManager.js?v=8';
import { AmbientMusic } from '../../src/audio/AmbientMusic.js';
import { MainMenuAndScenes } from '../../src/ui/MainMenuAndScenes.js';
import { EXPANSION_NPCS, EXPANSION_BGM, getExpansionDialogueSfx } from '../../src/expansion/ExpansionData.js';

export async function run(test, assert) {
  test('AudioManager: unlock idempotente y diccionario de pistas reutilizable', () => {
    const audio = new AudioManager();
    assert.equal(audio.isUnlocked, false);
    assert.equal(audio.musicTracks, audio._bgmAudio);
    assert.equal(audio.currentMusic, null);
    assert.equal(audio.fadeInterval, null);
    audio.unlockAndStart();
    assert.equal(audio.isUnlocked, true);
    assert.doesNotThrow(() => audio.unlockAndStart());
    assert.equal(audio.isUnlocked, true);
  });

  test('AudioManager: buffers SFX polifónicos, preload y fallback sintetizado', () => {
    const audio = new AudioManager();
    assert.deepEqual(audio.sfxBuffers, {}, 'Los buffers empiezan vacíos');
    assert.equal(typeof audio.preloadSFX, 'function');
    assert.equal(audio.playSFX('sword_slash'), false, 'Sin buffer debe devolver false para el fallback');
    assert.doesNotThrow(() => audio.playSwordSlash());
    assert.doesNotThrow(() => audio.playFootstep('stone'));
    assert.doesNotThrow(() => audio.playCoin());
  });

  test('AudioManager: Grafo de 3 buses, 4 canales, calibrador SFX y persistencia de ajustes', () => {
    const destination = { id: 'destination' };
    class MockGainNode {
      constructor() {
        this.gain = {
          value: 1,
          cancelScheduledValues: () => {},
          setValueAtTime: (v) => { this.gain.value = v; },
          linearRampToValueAtTime: (v) => { this.gain.value = v; },
          exponentialRampToValueAtTime: (v) => { this.gain.value = v; }
        };
        this.connectedTo = null;
      }
      connect(dest) {
        this.connectedTo = dest;
      }
      disconnect() {
        this.connectedTo = null;
      }
    }

    class MockAudioContext {
      constructor() {
        this.currentTime = 0;
        this.state = 'running';
        this.destination = destination;
        this.sampleRate = 44100;
      }
      createGain() { return new MockGainNode(); }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          connect: () => {},
          start: () => {},
          stop: () => {},
          disconnect: () => {}
        };
      }
      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          Q: { setValueAtTime: () => {} },
          connect: () => {},
          disconnect: () => {}
        };
      }
      createBuffer(channels, length, rate) {
        return {
          getChannelData: () => new Float32Array(length)
        };
      }
      createBufferSource() {
        return {
          buffer: null,
          connect: () => {},
          start: () => {},
          stop: () => {},
          disconnect: () => {}
        };
      }
    }

    const audio = new AudioManager();
    audio.ctx = new MockAudioContext();
    audio.masterGainNode = audio.ctx.createGain();
    audio.masterGainNode.connect(audio.ctx.destination);
    audio.musicGainNode = audio.ctx.createGain();
    audio.musicGainNode.connect(audio.masterGainNode);
    audio.sfxGainNode = audio.ctx.createGain();
    audio.sfxGainNode.connect(audio.masterGainNode);

    // Verificación de los 3 buses
    assert.equal(audio.masterGainNode.connectedTo, destination);
    assert.equal(audio.musicGainNode.connectedTo, audio.masterGainNode);
    assert.equal(audio.sfxGainNode.connectedTo, audio.masterGainNode);

    // Verificación de controles de ganancia y clamping
    audio.setMasterVolume(0.5);
    assert.equal(audio.getMasterVolume(), 0.5);
    audio.setMusicVolume(0.7);
    assert.equal(audio.getMusicVolume(), 0.7);
    // (BLOQUE 7) La BGM efectiva nunca supera 0.35; el bus SFX sigue a 1.0.
    assert.ok(audio._bgmBaseVolume() <= 0.35, 'La BGM debe tener un techo de 0.35');
    assert.ok(audio._bgmBaseVolume() > 0, 'La BGM debe escucharse con volumen positivo');
    audio.setSfxVolume(1.5); // Clamped a 1.0
    assert.equal(audio.getSfxVolume(), 1.0);

    // Ducking: baja a 0.1 y se puede limpiar sin dejar timers vivos.
    audio._bgmCurrentAudio = { volume: 0.35, paused: false };
    audio.duckMusic(500, 0.1);
    assert.ok(audio._bgmCurrentAudio.volume <= 0.1 + 1e-9, 'El ducking debe bajar la BGM a 0.1');
    audio._clearBgmDuck();
    audio._bgmCurrentAudio = null;

    // Verificación de mute toggles
    audio.toggleMasterMute();
    assert.equal(audio.isMasterMuted(), true);
    audio.toggleMasterMute();
    assert.equal(audio.isMasterMuted(), false);

    // Verificación de calibrador playTestBeep sin excepciones
    assert.doesNotThrow(() => audio.playTestBeep());

    // Verificación de herencia y compatibilidad con AmbientMusic
    const ambient = new AmbientMusic();
    assert.ok(ambient instanceof AudioManager);

    // Verificación de patrones polifónicos de 4 canales
    assert.ok(audio.villagePattern.length >= 16);
    assert.ok(audio.dungeonPattern.length >= 16);
    assert.ok(audio.combatPattern.length >= 16);
    for (const step of audio.villagePattern) {
      assert.ok('melody' in step && 'harmony' in step && 'bass' in step && 'drum' in step);
    }
  });

  test('Desbloqueo de Menú de Audio y Opciones sin Bloqueo de Estado y Versión Oficial Dinámica (v3.8.2)', () => {
    // 1. Verificación de Versión Oficial Centralizada
    assert.equal(GAME_VERSION, 'v3.8.2', 'La versión centralizada debe ser v3.8.2');

    const fakeMusic = {
      setMode: () => {},
      playMenuSelect: () => {},
      playMenuMove: () => {},
      getMasterVolume: () => 1.0,
      getMusicVolume: () => 0.8,
      getSfxVolume: () => 1.0,
      isMasterMuted: () => false,
      isMusicMuted: () => false,
      isSfxMuted: () => false
    };

    const menu = new MainMenuAndScenes(320, 180, {}, fakeMusic, {});

    // 2. Transición Pausa -> Ajustes y Sonido -> Volver (vía opción Volver)
    menu.openPauseMenu();
    assert.equal(menu.state, 'pause');
    const pauseItems = menu._getCurrentMenuItems();
    assert.equal(pauseItems[3].label, 'Ajustes y Sonido');
    pauseItems[3].action();
    assert.equal(menu.state, 'options', 'Debe entrar al menú de opciones desde pausa');
    assert.equal(menu.previousStateBeforeOptions, 'pause');

    const optionItems = menu._getCurrentMenuItems();
    const backItem = optionItems.find((it) => it.label === 'Volver');
    assert.ok(backItem, 'Debe existir la opción Volver');
    backItem.action();
    assert.equal(menu.state, 'pause', 'Volver desde opciones debe regresar al menú de pausa');
    assert.equal(menu.selectedIndex, 3, 'El cursor debe colocarse sobre Ajustes y Sonido');

    // 3. Cadena Pausa -> Opciones -> Controles -> Cerrar Controles -> Volver Opciones (sin bucle infinito)
    menu.openOptionsScreen('pause');
    assert.equal(menu.state, 'options');
    menu.openControlsScreen('options');
    assert.equal(menu.state, 'controls');
    menu.closeControlsScreen();
    assert.equal(menu.state, 'options', 'Cerrar controles debe devolver a opciones');
    assert.equal(menu.previousStateBeforeOptions, 'pause', 'El estado previo a opciones debe seguir siendo pause intacto');
    menu.closeOptionsScreen();
    assert.equal(menu.state, 'pause', 'Cerrar opciones no debe quedar en bucle infinito');

    // 4. Retorno con tecla Escape desde Ajustes y Sonido
    menu.openOptionsScreen('pause');
    const mockInput = {
      pointerX: -1,
      pointerY: -1,
      consumeKey: (k) => k === 'Escape',
      consumeMenuDirection: () => null,
      consumeInteraction: () => false,
      consumePointerClick: () => null
    };
    menu.update(0.016, mockInput);
    assert.equal(menu.state, 'pause', 'Pulsar Escape en opciones debe regresar a pausa');

    // 5. Opciones desde Pantalla de Título -> Volver a Título
    menu.openTitleScreen();
    menu.openOptionsScreen('title');
    assert.equal(menu.state, 'options');
    menu.closeOptionsScreen();
    assert.equal(menu.state, 'title', 'Volver desde opciones abiertas en título debe regresar a título');

    // 6. Botón de Cierre Superior Derecho del Modal [✕ Volver]
    const closeBtn = menu._getModalCloseButtonBounds(true);
    assert.ok(closeBtn, 'Debe existir hitbox para el botón de cierre');
    assert.ok(closeBtn.x > 200, 'El botón debe ubicarse a la derecha');
    assert.ok(closeBtn.w >= 40 && closeBtn.h >= 10, 'Dimensiones clickeables cómodas');

    menu.openOptionsScreen('pause');
    const mockClickInput = {
      pointerX: closeBtn.x + 5,
      pointerY: closeBtn.y + 5,
      consumeKey: () => false,
      consumeMenuDirection: () => null,
      consumeInteraction: () => false,
      consumePointerClick: () => ({ x: closeBtn.x + 5, y: closeBtn.y + 5 })
    };
    menu.update(0.016, mockClickInput);
    assert.equal(menu.state, 'pause', 'Hacer clic sobre el botón ✕ Volver debe cerrar el menú de opciones');
  });

  test('Expansión v2.0: BGM/SFX nuevos y hooks de audio en diálogos', () => {
    // Pistas de la expansión, volumen global y crossfade compartido.
    // La expansión ya NO contamina el registro base.
    for (const key of Object.keys(EXPANSION_BGM)) {
      assert.equal(BGM_TRACKS[key], undefined, `La pista de expansión ${key} no debe cargarse en base`);
    }
    registerExpansionMusic();
    for (const [key, path] of Object.entries(EXPANSION_BGM)) {
      assert.equal(BGM_TRACKS[key], path, `Falta la pista ${key}`);
      delete BGM_TRACKS[key];
    }
    assert.equal(BGM_MAX_VOLUME, 0.35, 'La BGM debe mantenerse al 35%');

    const sfxMethods = [
      'playGlitch', 'playConsoleLog', 'playHologram', 'playError',
      'playKeyboard', 'playShock', 'playCoffee', 'playAirlock'
    ];
    for (const method of sfxMethods) {
      assert.equal(typeof AudioManager.prototype[method], 'function', `Falta ${method}()`);
    }

    // Datos de voz y helper de expansión.
    assert.equal(EXPANSION_NPCS.cepedita_tieso.talkSfx, 'hologram_on');
    assert.equal(getExpansionDialogueSfx('cepedita_tieso'), 'hologram_on');
    assert.ok(['coffee_sip', 'keyboard_type'].includes(getExpansionDialogueSfx('inakito')));
    assert.ok(['ui_glitch', 'error_buzz'].includes(
      getExpansionDialogueSfx(null, 'ERROR: glitch en el sistema')
    ));

    // Hook real del DialogueBox.
    const calls = [];
    const fakeSound = {
      playSFX: (name) => calls.push(name),
      playGlitch: () => calls.push('playGlitch'),
      playConsoleLog: () => calls.push('playConsoleLog'),
      playHologram: () => calls.push('playHologram'),
      playError: () => calls.push('playError'),
      playKeyboard: () => calls.push('playKeyboard'),
      playShock: () => calls.push('playShock'),
      playCoffee: () => calls.push('playCoffee'),
      playAirlock: () => calls.push('playAirlock')
    };
    const box = new DialogueBox(320, 180, fakeSound);
    box.start({ name: 'Cepedita 2.0', talkSfx: 'hologram_on' }, ['Cepedita el Tieso requiere el impreso A-38 bis.']);
    assert.ok(calls.includes('playHologram'), 'Cepedita debe sonar como holograma');

    calls.length = 0;
    box.start({ name: 'Iñakito 2.0', talkSfx: 'coffee_sip' }, ['¡Pero si el jefe me dijo que esto era un ascenso!']);
    assert.ok(calls.includes('playCoffee'), 'Iñakito debe sonar a café');

    calls.length = 0;
    box.start(null, ['ERROR: glitch detectado en el sistema.']);
    assert.ok(
      calls.includes('playGlitch') || calls.includes('playError'),
      'Un texto de error/glitch debe disparar playGlitch/playError'
    );
  });
}
