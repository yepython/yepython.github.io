/* tkinter window system (classic script, no ES modules). Exposes global TkWindowSystem. */

// ============================================================
// icons.js
// ============================================================

(function (ns) {
  "use strict";
  /** Вбудовані SVG-іконки (вміст <svg>, viewBox 16×16), потрібні файловому діалогу. */
  const ICONS = {
    "up": "<path d=\"M8 14V3M3.5 7.5L8 3l4.5 4.5\" fill=\"none\" stroke=\"#2a56b0\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
    "folder": "<path d=\"M1.5 13.5v-11h4.5l1.5 1.5h7v9.5z\" fill=\"#f3c74e\" stroke=\"#b08320\" stroke-linejoin=\"round\"/><path d=\"M1.5 5.5h13\" stroke=\"#fbe39a\"/>",
    "file": "<path d=\"M3.5 1.5h6l3 3v10h-9z\" fill=\"#ffffff\" stroke=\"#7d8793\"/><path d=\"M9.5 1.5v3h3\" fill=\"#eef1f5\" stroke=\"#7d8793\" stroke-linejoin=\"round\"/>"
  };

  ns.ICONS = ICONS;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// i18n.js
// ============================================================

(function (ns) {
  "use strict";
  /** Підмножина рядків інтерфейсу, потрібна віконній системі (en та uk). */
  const MESSAGES = {
    "en": {
      "files.title": "Files",
      "files.root": "File system",
      "files.bad.empty": "Enter a name.",
      "files.bad.chars": "\"{name}\": a name cannot contain / \\ : * ? \" < > |",
      "files.bad.hidden": "\"{name}\": a name cannot start with a dot or be __pycache__.",
      "gamepad.space": "Space",
      "gamepad.label": "On-screen keys",
      "dialog.open": "Open",
      "dialog.saveAs": "Save As",
      "dialog.save": "Save",
      "dialog.cancel": "Cancel",
      "dialog.chooseFolder": "Select Folder",
      "dialog.fileName": "File name:",
      "dialog.folderName": "Folder:",
      "dialog.name": "Name",
      "dialog.size": "Size",
      "dialog.upload": "From computer…",
      "dialog.saveHint": "The file will be saved in the internal file system.",
      "dialog.empty": "No files here yet. Add some with \"From computer…\".",
      "dialog.replace": "{name} already exists.\nDo you want to replace it?",
      "dialog.confirmSave": "Confirm Save As",
      "dialog.notFound": "{name}\nFile not found.\nCheck the file name and try again.",
      "color.title": "Color",
      "color.basic": "Basic colors:",
      "color.custom": "Custom colors:",
      "color.define": "Define Custom Colors >>",
      "color.solid": "Color|Solid",
      "color.hue": "Hue:",
      "color.sat": "Sat:",
      "color.lum": "Lum:",
      "color.red": "Red:",
      "color.green": "Green:",
      "color.blue": "Blue:",
      "color.add": "Add to Custom Colors"
    },
    "uk": {
      "files.title": "Файли",
      "files.root": "Файлова система",
      "files.bad.empty": "Введіть назву.",
      "files.bad.chars": "«{name}»: у назві не може бути / \\ : * ? \" < > |",
      "files.bad.hidden": "«{name}»: назва не може починатися з крапки чи бути __pycache__.",
      "gamepad.space": "Пробіл",
      "gamepad.label": "Екранні клавіші",
      "dialog.open": "Відкрити",
      "dialog.saveAs": "Зберегти як",
      "dialog.save": "Зберегти",
      "dialog.cancel": "Скасувати",
      "dialog.chooseFolder": "Вибрати папку",
      "dialog.fileName": "Ім’я файлу:",
      "dialog.folderName": "Папка:",
      "dialog.name": "Ім’я",
      "dialog.size": "Розмір",
      "dialog.upload": "З комп’ютера…",
      "dialog.saveHint": "Файл буде збережено у внутрішній файловій системі.",
      "dialog.empty": "Тут поки немає файлів. Додайте їх кнопкою «З комп’ютера…».",
      "dialog.replace": "{name} уже існує.\nЗамінити його?",
      "dialog.confirmSave": "Підтвердження збереження",
      "dialog.notFound": "{name}\nФайл не знайдено.\nПеревірте ім’я файлу та повторіть спробу.",
      "color.title": "Колір",
      "color.basic": "Основні кольори:",
      "color.custom": "Додаткові кольори:",
      "color.define": "Визначити колір >>",
      "color.solid": "Колір|Заливка",
      "color.hue": "Відтінок:",
      "color.sat": "Контраст:",
      "color.lum": "Яскравість:",
      "color.red": "Червоний:",
      "color.green": "Зелений:",
      "color.blue": "Синій:",
      "color.add": "Додати до набору"
    }
  };

  ns.MESSAGES = MESSAGES;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// colors.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Розбір CSS-кольорів і розрахунок рельєфних рамок (raised, sunken, groove, ridge, solid) у стилі Tk.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const colorProbeContext = document.createElement(`canvas`).getContext(`2d`);

  const colorCache = new Map();

  function parseColorToRgb(color) {
    let rgb = colorCache.get(color);
    if (!rgb) {
      ((colorProbeContext.fillStyle = `#000000`), (colorProbeContext.fillStyle = color));
      let normalized = colorProbeContext.fillStyle;
      ((rgb = normalized.startsWith(`#`)
        ? [parseInt(normalized.slice(1, 3), 16), parseInt(normalized.slice(3, 5), 16), parseInt(normalized.slice(5, 7), 16)]
        : [0, 0, 0]),
        colorCache.set(color, rgb));
    }
    return rgb;
  }

  const rgbToCss = ([red, green, blue]) => `rgb(${red},${green},${blue})`;

  function reliefPalette(color) {
    let [red, green, blue] = parseColorToRgb(color);
    if ((red === 240 && green === 240 && blue === 240) || (red === 255 && green === 255 && blue === 255))
      return {
        light: `#ffffff`,
        dark: `#a0a0a0`,
        light2: `#e3e3e3`,
        dark2: `#696969`,
      };
    let shadowRgb =
        red * 0.5 * red + green * green + blue * 0.28 * blue < 3251.25
          ? [((255 + 3 * red) / 4) | 0, ((255 + 3 * green) / 4) | 0, ((255 + 3 * blue) / 4) | 0]
          : [((60 * red) / 100) | 0, ((60 * green) / 100) | 0, ((60 * blue) / 100) | 0],
      blend = (value) => Math.max(Math.min(((14 * value) / 10) | 0, 255), ((255 + value) / 2) | 0);
    return {
      light: rgbToCss(
        green > 242.25
          ? [((90 * red) / 100) | 0, ((90 * green) / 100) | 0, ((90 * blue) / 100) | 0]
          : [blend(red), blend(green), blend(blue)],
      ),
      dark: rgbToCss(shadowRgb),
      light2: rgbToCss([red, green, blue]),
      dark2: `#000000`,
    };
  }

  function reliefBorderStyle(relief, borderWidth, background, focusWidth = 0) {
    if (!borderWidth || borderWidth <= 0)
      return {
        borderWidth: `0`,
        borderStyle: `none`,
        boxShadow: focusWidth ? `0 0 0 ${focusWidth}px ${background}` : `none`,
      };
    let palette = reliefPalette(background),
      topLeft = background,
      topRight = background,
      bottomLeft = background,
      bottomRight = background;
    switch (relief) {
      case `raised`:
        [topLeft, topRight, bottomLeft, bottomRight] = [palette.light, palette.light2, palette.dark, palette.dark2];
        break;
      case `sunken`:
        [topLeft, topRight, bottomLeft, bottomRight] = [palette.dark, palette.dark2, palette.light2, palette.light];
        break;
      case `ridge`:
        [topLeft, topRight, bottomLeft, bottomRight] = [palette.light, palette.dark, palette.light, palette.dark];
        break;
      case `groove`:
        [topLeft, topRight, bottomLeft, bottomRight] = [palette.dark, palette.light, palette.dark, palette.light];
        break;
      case `solid`:
        topLeft = topRight = bottomLeft = bottomRight = `#000000`;
    }
    let halfWidth = Math.ceil(borderWidth / 2),
      restWidth = borderWidth - halfWidth,
      shadows = [];
    return (
      restWidth > 0 && shadows.push(`inset ${restWidth}px ${restWidth}px 0 0 ${topRight}`, `inset -${restWidth}px -${restWidth}px 0 0 ${bottomLeft}`),
      focusWidth > 0 && shadows.push(`0 0 0 ${focusWidth}px ${background}`),
      {
        borderStyle: `solid`,
        borderWidth: `${halfWidth}px`,
        borderColor: `${topLeft} ${bottomRight} ${bottomRight} ${topLeft}`,
        boxShadow: shadows.length ? shadows.join(`, `) : `none`,
      }
    );
  }

  ns.reliefBorderStyle = reliefBorderStyle;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// keys.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Перетворення клавіатурних подій браузера в події Tk (keysym, char, keycode, стан модифікаторів).
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const KEYSYM_BY_KEY = {
    Enter: `Return`,
    Backspace: `BackSpace`,
    Tab: `Tab`,
    Escape: `Escape`,
    Delete: `Delete`,
    ArrowLeft: `Left`,
    ArrowRight: `Right`,
    ArrowUp: `Up`,
    ArrowDown: `Down`,
    Home: `Home`,
    End: `End`,
    PageUp: `Prior`,
    PageDown: `Next`,
    Insert: `Insert`,
    Shift: `Shift_L`,
    Control: `Control_L`,
    Alt: `Alt_L`,
    Meta: `Win_L`,
    CapsLock: `Caps_Lock`,
    NumLock: `Num_Lock`,
    ScrollLock: `Scroll_Lock`,
    Pause: `Pause`,
    ContextMenu: `App`,
    PrintScreen: `Print`,
  };

  const KEYSYM_BY_CHAR = {
    " ": `space`,
    "!": `exclam`,
    '"': `quotedbl`,
    "#": `numbersign`,
    $: `dollar`,
    "%": `percent`,
    "&": `ampersand`,
    "'": `apostrophe`,
    "(": `parenleft`,
    ")": `parenright`,
    "*": `asterisk`,
    "+": `plus`,
    ",": `comma`,
    "-": `minus`,
    ".": `period`,
    "/": `slash`,
    ":": `colon`,
    ";": `semicolon`,
    "<": `less`,
    "=": `equal`,
    ">": `greater`,
    "?": `question`,
    "@": `at`,
    "[": `bracketleft`,
    "\\": `backslash`,
    "]": `bracketright`,
    "^": `asciicircum`,
    _: `underscore`,
    "`": `grave`,
    "{": `braceleft`,
    "|": `bar`,
    "}": `braceright`,
    "~": `asciitilde`,
  };

  const CHAR_BY_KEYSYM = {
    Return: `\r`,
    BackSpace: `\b`,
    Tab: `	`,
    Escape: `\x1B`,
    Delete: ``,
  };

  function keyEventToTk(event) {
    let keysym,
      char = ``;
    (event.key.length === 1
      ? ((keysym = KEYSYM_BY_CHAR[event.key] ?? event.key), (char = event.key))
      : /^F\d{1,2}$/.test(event.key)
        ? (keysym = event.key)
        : ((keysym = KEYSYM_BY_KEY[event.key] ?? event.key), (char = CHAR_BY_KEYSYM[keysym] ?? ``)),
      event.ctrlKey &&
        char.length === 1 &&
        /[a-z]/i.test(char) &&
        (char = String.fromCharCode(char.toUpperCase().charCodeAt(0) - 64)));
    let modifiers = 0;
    return (
      event.shiftKey && (modifiers |= 1),
      event.getModifierState(`CapsLock`) && (modifiers |= 2),
      event.ctrlKey && (modifiers |= 4),
      event.altKey && (modifiers |= 131072),
      {
        keysym: keysym,
        char: char,
        code: event.keyCode,
        s: modifiers,
      }
    );
  }

  function keyModifierState(event) {
    let modifiers = 0;
    return (
      event.shiftKey && (modifiers |= 1),
      event.getModifierState?.(`CapsLock`) && (modifiers |= 2),
      event.ctrlKey && (modifiers |= 4),
      event.altKey && (modifiers |= 131072),
      modifiers
    );
  }

  ns.keyEventToTk = keyEventToTk;
  ns.keyModifierState = keyModifierState;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// dom.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Невеличкий DOM-хелпер.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  function createElementWithClass(tagName, className, text) {
    let element = document.createElement(tagName);
    return ((element.className = className), text !== void 0 && (element.textContent = text), element);
  }

  ns.createElementWithClass = createElementWithClass;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// host.js
// ============================================================

(function (ns) {
  "use strict";
  var MESSAGES = ns.MESSAGES;
  var ICONS = ns.ICONS;

  /**
   * Адаптер до середовища сторінки: переклад, мова, іконки.
   * У PyThonny ці функції (Z, sv, _v) належать до основного застосунку; тут вони винесені,
   * щоб віконна система була самодостатньою. Замініть реалізацію, якщо потрібна інша локалізація.
   */

  const STORAGE_KEY = "pythonny.lang";
  let language = detectLanguage();

  function detectLanguage() {
    try {
      const fromUrl = new URLSearchParams(location.search).get("lang");
      if (fromUrl && fromUrl in MESSAGES) {
        localStorage.setItem(STORAGE_KEY, fromUrl);
        return fromUrl;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored in MESSAGES) return stored;
    } catch {}
    return "uk";
  }

  function getLanguage() {
    return language;
  }

  /** Задати мову програмно ("uk" або "en"). */
  function setLanguage(lang) {
    if (lang in MESSAGES) language = lang;
  }

  /** Переклад за ключем із підстановкою {name}. */
  function translate(key, params) {
    let text = MESSAGES[language]?.[key] ?? MESSAGES.en[key] ?? key;
    if (params)
      for (const [name, value] of Object.entries(params))
        text = text.split("{" + name + "}").join(String(value));
    return text;
  }

  const iconCache = new Map();
  function iconUrl(name) {
    let url = iconCache.get(name);
    if (!url) {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
        ICONS[name] +
        "</svg>";
      url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      iconCache.set(name, url);
    }
    return url;
  }

  /** <img class="icon"> із вбудованою SVG-іконкою (використовує діалог файлів). */
  function icon(name, className = "icon") {
    const img = document.createElement("img");
    img.className = className;
    img.src = iconUrl(name);
    img.alt = "";
    img.draggable = false;
    return img;
  }

  ns.getLanguage = getLanguage;
  ns.setLanguage = setLanguage;
  ns.translate = translate;
  ns.icon = icon;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// audio.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Аудіо: звуки, музика, генерація тонів (WebAudio) для pygame / pgzero.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const TONE_GAIN = 0.25;

  function base64ToArrayBuffer(base64) {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;
  }

  class AudioEngine {
    context = null;
    sounds = new Map();
    playing = new Map();
    tracks = new Map();
    music = null;
    tones = new Set();
    musicVolume = 1;
    track = null;
    audio() {
      return (
        (this.context ??= new AudioContext()),
        this.context.state === `suspended` && this.context.resume(),
        this.context
      );
    }
    decode(base64) {
      return this.audio()
        .decodeAudioData(base64ToArrayBuffer(base64))
        .catch(() => null);
    }
    start(buffer, loops, volume, maxTime = 0, offset = 0) {
      let context = this.audio(),
        source = context.createBufferSource(),
        gain = context.createGain();
      ((source.buffer = buffer), (gain.gain.value = volume), source.connect(gain).connect(context.destination));
      let duration = loops < 0 ? 1 / 0 : buffer.duration * (loops + 1) - offset;
      return (
        maxTime > 0 && (duration = Math.min(duration, maxTime / 1e3)),
        (source.loop = loops !== 0),
        source.start(0, offset),
        Number.isFinite(duration) && source.stop(context.currentTime + duration),
        {
          source: source,
          gain: gain,
        }
      );
    }
    fadeStop(voice, fadeMs) {
      if (this.context) {
        if (fadeMs > 0) {
          let now = this.context.currentTime;
          (voice.gain.gain.setValueAtTime(voice.gain.gain.value, now),
            voice.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1e3),
            voice.source.stop(now + fadeMs / 1e3));
        } else voice.source.stop();
      }
    }
    handle(op) {
      switch (op.op) {
        case `sound_load`:
          this.sounds.set(op.id, this.decode(op.data));
          break;
        case `sound_play`: {
          let soundId = op.id;
          this.sounds.get(soundId)?.then((buffer) => {
            if (!buffer) return;
            let voice = this.start(buffer, op.loops, op.volume, op.maxtime),
              playing = this.playing.get(soundId);
            (playing || this.playing.set(soundId, (playing = new Set())),
              playing.add(voice),
              (voice.source.onended = () => playing.delete(voice)));
          });
          break;
        }
        case `sound_stop`:
          for (let soundId of this.playing.get(op.id) ?? []) this.fadeStop(soundId, op.fade ?? 0);
          break;
        case `music_play`: {
          let musicKey = op.key;
          (op.data && this.tracks.set(musicKey, this.decode(op.data)),
            (this.musicVolume = op.volume),
            this.stopMusic(0),
            this.tracks.get(musicKey)?.then((buffer) => {
              if (!buffer) return;
              let loops = op.loops;
              ((this.music = this.start(buffer, loops, this.musicVolume)),
                (this.track = {
                  buffer: buffer,
                  loops: loops,
                  startedAt: this.audio().currentTime,
                  pausedAt: null,
                }));
            }));
          break;
        }
        case `music_stop`:
          this.stopMusic(op.fade ?? 0);
          break;
        case `music_pause`:
          this.track &&
            this.music &&
            this.track.pausedAt === null &&
            ((this.track.pausedAt = this.audio().currentTime),
            this.music.source.stop(),
            (this.music = null));
          break;
        case `music_unpause`:
          if (this.track && this.track.pausedAt !== null) {
            let { buffer: buffer, loops: loops, startedAt: startedAt, pausedAt: pausedAt } = this.track,
              offset = (pausedAt - startedAt) % buffer.duration;
            ((this.music = this.start(buffer, loops < 0 ? -1 : 0, this.musicVolume, 0, offset)),
              (this.track.startedAt = this.audio().currentTime - offset),
              (this.track.pausedAt = null));
          }
          break;
        case `music_volume`:
          ((this.musicVolume = op.volume),
            this.music && (this.music.gain.gain.value = this.musicVolume));
          break;
        case `audio_stop`:
          this.stopAll();
          break;
        case `tones`:
          this.playTones(op.notes, !!op.chime);
      }
    }
    stopMusic(fadeMs) {
      (this.music && this.fadeStop(this.music, fadeMs), (this.music = null), (this.track = null));
    }
    stopAll() {
      for (let voices of this.playing.values()) for (let voice of voices) voice.source.stop();
      this.playing.clear();
      for (let tones of this.tones) tones.stop();
      (this.tones.clear(), this.stopMusic(0));
    }
    playTones(notes, chime) {
      let context = this.audio(),
        startTime = context.currentTime;
      for (let [frequency, durationMs] of notes) {
        let durationMs2 = durationMs / 1e3,
          attack = Math.min(0.005, durationMs2 / 4),
          oscillator = context.createOscillator(),
          gain = context.createGain();
        ((oscillator.frequency.value = frequency),
          gain.gain.setValueAtTime(0, startTime),
          gain.gain.linearRampToValueAtTime(TONE_GAIN, startTime + attack),
          chime
            ? gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationMs2)
            : (gain.gain.setValueAtTime(TONE_GAIN, startTime + durationMs2 - attack), gain.gain.linearRampToValueAtTime(0, startTime + durationMs2)),
          oscillator.connect(gain).connect(context.destination),
          oscillator.start(startTime),
          oscillator.stop(startTime + durationMs2),
          this.tones.add(oscillator),
          (oscillator.onended = () => this.tones.delete(oscillator)),
          (startTime += durationMs2));
      }
    }
    reset() {
      (this.stopAll(), this.sounds.clear(), this.tracks.clear());
    }
  }

  ns.AudioEngine = AudioEngine;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// gamepad.js
// ============================================================

(function (ns) {
  "use strict";
  var translate = ns.translate;

  /**
   * Віртуальний геймпад на сенсорних екранах (D-pad і кнопки) для Pygame Zero.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const GAMEPAD_KEYS = {
    Up: [38, ``],
    Left: [37, ``],
    Down: [40, ``],
    Right: [39, ``],
    space: [32, ` `],
    Return: [13, `\r`],
    Escape: [27, `\x1B`],
    Tab: [9, `	`],
    BackSpace: [8, `\b`],
  };

  function gamepadKeyEvent(key) {
    let entry = GAMEPAD_KEYS[key];
    return entry
      ? {
          keysym: key,
          char: entry[1],
          code: entry[0],
          s: 0,
        }
      : {
          keysym: key,
          char: key,
          code: key.toUpperCase().charCodeAt(0),
          s: 0,
        };
  }

  function gamepadKeyLabel(key) {
    switch (key) {
      case `space`:
        return translate(`gamepad.space`);
      case `Return`:
        return `Enter`;
      case `Escape`:
        return `Esc`;
      case `BackSpace`:
        return `⌫`;
      default:
        return key.length === 1 ? key.toUpperCase() : key;
    }
  }

  function isCoarsePointer() {
    return window.matchMedia(`(pointer: coarse)`).matches;
  }

  const DPAD_DIRECTIONS = [`up`, `left`, `down`, `right`];

  const DPAD_THRESHOLD = 0.25;

  const DPAD_DOMINANCE = 0.5;

  class Gamepad {
    keys;
    press;
    element;
    held = new Map();
    constructor(config, press) {
      if (
        ((this.keys = config),
        (this.press = press),
        (this.element = document.createElement(`div`)),
        (this.element.className = `tk-gamepad`),
        this.element.setAttribute(`role`, `group`),
        this.element.setAttribute(`aria-label`, translate(`gamepad.label`)),
        this.element.addEventListener(`contextmenu`, (event) => event.preventDefault()),
        config.dpad?.some(Boolean) && this.element.append(this.dpad(config.dpad)),
        config.buttons.length)
      ) {
        let buttonsBox = document.createElement(`div`);
        buttonsBox.className = `tk-gamepad-buttons`;
        for (let button of config.buttons) buttonsBox.append(this.button(button));
        this.element.append(buttonsBox);
      }
    }
    releaseAll() {
      for (let key of [...this.held.keys()]) this.release(key);
    }
    hold(key, pointerId) {
      this.held.has(key) ||
        (this.held.set(key, pointerId),
        this.element.querySelector(`[data-key="${CSS.escape(key)}"]`)?.classList.add(`pressed`),
        this.press(key, !0));
    }
    release(key) {
      this.held.delete(key) &&
        (this.element.querySelector(`[data-key="${CSS.escape(key)}"]`)?.classList.remove(`pressed`),
        this.press(key, !1));
    }
    releasePointer(pointerId) {
      for (let [key, id] of [...this.held]) id === pointerId && this.release(key);
    }
    button(key) {
      let element = document.createElement(`div`);
      ((element.className = `tk-gamepad-btn`),
        (element.dataset.key = key),
        (element.textContent = gamepadKeyLabel(key)),
        element.addEventListener(`pointerdown`, (event) => {
          (event.preventDefault(), element.setPointerCapture(event.pointerId), this.hold(key, event.pointerId));
        }));
      let onUp = (onUp2) => {
        this.held.get(key) === onUp2.pointerId && this.release(key);
      };
      return (
        element.addEventListener(`pointerup`, onUp),
        element.addEventListener(`pointercancel`, onUp),
        element.addEventListener(`lostpointercapture`, onUp),
        element
      );
    }
    dpad(dpadConfig) {
      let element = document.createElement(`div`);
      element.className = `tk-gamepad-dpad`;
      let keys = Object.fromEntries(DPAD_DIRECTIONS.map((direction, index) => [direction, dpadConfig[index] ?? null]));
      for (let direction of DPAD_DIRECTIONS) {
        let key = keys[direction],
          arrow = document.createElement(`div`);
        ((arrow.className = `tk-gamepad-arrow tk-gamepad-${direction}`),
          key ? (arrow.dataset.key = key) : (arrow.hidden = !0),
          element.append(arrow));
      }
      let horizontal = !!(keys.left || keys.right),
        vertical = !!(keys.up || keys.down),
        activePointerId = null,
        update = (event) => {
          let rect = element.getBoundingClientRect(),
            dx = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2),
            dy = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2),
            absDx = horizontal ? Math.abs(dx) : 0,
            absDy = vertical ? Math.abs(dy) : 0,
            pressed = new Set(),
            press = (key) => {
              key && pressed.add(key);
            };
          (absDx > DPAD_THRESHOLD && absDx >= DPAD_DOMINANCE * absDy && press(dx < 0 ? keys.left : keys.right),
            absDy > DPAD_THRESHOLD && absDy >= DPAD_DOMINANCE * absDx && press(dy < 0 ? keys.up : keys.down));
          for (let [key, pointerId] of [...this.held]) pointerId === event.pointerId && !pressed.has(key) && this.release(key);
          for (let key of pressed) this.hold(key, event.pointerId);
        };
      (element.addEventListener(`pointerdown`, (event) => {
        (event.preventDefault(),
          activePointerId === null && ((activePointerId = event.pointerId), element.setPointerCapture(event.pointerId), update(event)));
      }),
        element.addEventListener(`pointermove`, (event) => {
          event.pointerId === activePointerId && update(event);
        }));
      let onUp = (event) => {
        event.pointerId === activePointerId && ((activePointerId = null), this.releasePointer(event.pointerId));
      };
      return (
        element.addEventListener(`pointerup`, onUp),
        element.addEventListener(`pointercancel`, onUp),
        element.addEventListener(`lostpointercapture`, onUp),
        element
      );
    }
  }

  ns.gamepadKeyEvent = gamepadKeyEvent;
  ns.isCoarsePointer = isCoarsePointer;
  ns.Gamepad = Gamepad;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// menus.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Меню Tk: рядок меню вікна, випадні та каскадні панелі, позиціювання, закриття.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  let openMenuRoot = null;

  let menuCleanups = [];

  function closeAllMenus() {
    (openMenuRoot?.remove(), (openMenuRoot = null));
    for (let cleanup of menuCleanups) cleanup();
    menuCleanups = [];
  }

  function createMenuLabel(entry) {
    let element = document.createElement(`span`);
    element.className = `tk-menu-label`;
    let label = entry.label ?? ``,
      underline = entry.underline ?? -1;
    return (
      underline >= 0 && underline < label.length
        ? element.append(
            label.slice(0, underline),
            Object.assign(document.createElement(`u`), {
              textContent: label[underline],
            }),
            label.slice(underline + 1),
          )
        : (element.textContent = label),
      element
    );
  }

  function buildMenuPanel(menuPath, entries, font, onSelect, layer) {
    let panel = document.createElement(`div`);
    ((panel.className = `tk-menu`), (panel.style.font = font));
    let submenu = null;
    for (let entry of entries) {
      let item = document.createElement(`div`);
      if (entry.type === `separator`) {
        ((item.className = `tk-menu-separator`), panel.append(item));
        continue;
      }
      if (entry.type === `tearoff`) {
        ((item.className = `tk-menu-tearoff`), panel.append(item));
        continue;
      }
      item.className = `tk-menu-item` + (entry.disabled ? ` disabled` : ``);
      let checkMark = document.createElement(`span`);
      ((checkMark.className = `tk-menu-check`),
        entry.checked && (checkMark.textContent = entry.type === `radiobutton` ? `●` : `✓`));
      let accelerator = document.createElement(`span`);
      ((accelerator.className = `tk-menu-accel`), (accelerator.textContent = entry.accel ?? ``));
      let arrow = document.createElement(`span`);
      ((arrow.className = `tk-menu-arrow`),
        entry.type === `cascade` && (arrow.textContent = `›`),
        item.append(checkMark, createMenuLabel(entry), accelerator, arrow),
        item.addEventListener(`pointerenter`, () => {
          if ((submenu?.remove(), (submenu = null), entry.type === `cascade` && entry.entries && !entry.disabled)) {
            let submenuPath = buildMenuPanel(entry.menu ?? ``, entry.entries, font, onSelect, layer);
            layer.append(submenuPath);
            let rect = item.getBoundingClientRect();
            (positionMenuPanel(submenuPath, rect.right - 3, rect.top - 3, rect.left), (submenu = submenuPath));
          }
        }),
        item.addEventListener(`pointerup`, (event) => {
          (event.stopPropagation(),
            !(entry.disabled || entry.type === `cascade`) && (closeAllMenus(), onSelect(menuPath, entry.index)));
        }),
        panel.append(item));
    }
    return panel;
  }

  function positionMenuPanel(panel, x, y, maxLeft) {
    let width = panel.offsetWidth,
      height = panel.offsetHeight,
      left = x;
    left + width > window.innerWidth && (left = maxLeft === void 0 ? window.innerWidth - width : maxLeft - width + 3);
    let top = y;
    (top + height > window.innerHeight && (top = Math.max(0, window.innerHeight - height)),
      (panel.style.left = `${Math.max(0, left)}px`),
      (panel.style.top = `${top}px`));
  }

  function postMenu(menuPath, entries, font, x, y, onSelect, cleanup) {
    closeAllMenus();
    let layer = document.createElement(`div`);
    ((layer.className = `tk-menu-layer`),
      document.body.append(layer),
      (openMenuRoot = layer),
      cleanup && menuCleanups.push(cleanup));
    let panel = buildMenuPanel(menuPath, entries, font, onSelect, layer);
    (layer.append(panel),
      positionMenuPanel(panel, x, y),
      setTimeout(() => {
        let event = (event2) => {
            layer.contains(event2.target) || closeAllMenus();
          },
          onKey = (event2) => {
            event2.key === `Escape` && closeAllMenus();
          };
        (document.addEventListener(`pointerdown`, event, !0),
          document.addEventListener(`keydown`, onKey, !0),
          menuCleanups.push(() => {
            (document.removeEventListener(`pointerdown`, event, !0),
              document.removeEventListener(`keydown`, onKey, !0));
          }));
      }));
  }

  function renderMenubar(element, props, onSelect) {
    ((element.hidden = !props),
      props &&
        ((element.style.font = props.font),
        element.replaceChildren(
          ...props.entries.map((entry) => {
            let item = document.createElement(`div`);
            return (
              (item.className = `tk-menubar-item` + (entry.disabled ? ` disabled` : ``)),
              item.append(createMenuLabel(entry)),
              item.addEventListener(`pointerdown`, (event) => {
                if ((event.preventDefault(), event.stopPropagation(), !entry.disabled)) {
                  if (entry.type === `cascade` && entry.entries) {
                    let rect = item.getBoundingClientRect();
                    (item.classList.add(`open`),
                      postMenu(entry.menu ?? ``, entry.entries, props.font, rect.left, rect.bottom, onSelect, () =>
                        item.classList.remove(`open`),
                      ));
                  } else entry.type !== `separator` && onSelect(props.menu, entry.index);
                }
              }),
              item
            );
          }),
        )));
  }

  ns.closeAllMenus = closeAllMenus;
  ns.postMenu = postMenu;
  ns.renderMenubar = renderMenubar;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// msgbox.js
// ============================================================

(function (ns) {
  "use strict";
  var getLanguage = ns.getLanguage;

  /**
   * Модальні діалоги: tkinter.messagebox та загальна рамка діалогових вікон.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const MESSAGE_BUTTON_LABELS = {
    en: {
      ok: `OK`,
      cancel: `Cancel`,
      yes: `Yes`,
      no: `No`,
      retry: `Retry`,
      abort: `Abort`,
      ignore: `Ignore`,
    },
    uk: {
      ok: `OK`,
      cancel: `Скасувати`,
      yes: `Так`,
      no: `Ні`,
      retry: `Повторити`,
      abort: `Перервати`,
      ignore: `Пропустити`,
    },
  };

  const MESSAGE_ICONS = {
    info: `<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#1e74d6"/><rect x="14.5" y="13" width="3" height="11" fill="#fff"/><circle cx="16" cy="9" r="1.9" fill="#fff"/></svg>`,
    question: `<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#1e74d6"/><path d="M11.5 12.5a4.5 4.5 0 1 1 6.6 4c-1.3.7-2.1 1.5-2.1 3V21" fill="none" stroke="#fff" stroke-width="3"/><circle cx="16" cy="25" r="1.9" fill="#fff"/></svg>`,
    warning: `<svg width="32" height="32" viewBox="0 0 32 32"><path d="M16 2L31 29H1z" fill="#fcd116" stroke="#9c7b00" stroke-width="1"/><rect x="14.5" y="11" width="3" height="10" fill="#000"/><circle cx="16" cy="24.5" r="1.8" fill="#000"/></svg>`,
    error: `<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#e81123"/><path d="M10.5 10.5l11 11M21.5 10.5l-11 11" stroke="#fff" stroke-width="3"/></svg>`,
  };

  const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

  function linkifyEmails(container, text) {
    let offset = 0;
    for (let match of text.matchAll(EMAIL_PATTERN)) {
      let link = document.createElement(`a`);
      ((link.href = `mailto:${match[0]}`),
        (link.textContent = match[0]),
        container.append(text.slice(offset, match.index), link),
        (offset = match.index + match[0].length));
    }
    container.append(text.slice(offset));
  }

  function showMessageBox(parent, options, anchorRect, onResult) {
    let buttonLabels = MESSAGE_BUTTON_LABELS[getLanguage()] ?? MESSAGE_BUTTON_LABELS.en,
      box = document.createElement(`div`);
    ((box.className = `tkw tkw-active tk-msgbox`), (box.tabIndex = -1));
    let title = document.createElement(`div`);
    title.className = `tkw-title`;
    let titleText = document.createElement(`span`);
    ((titleText.className = `tkw-text`), (titleText.textContent = options.title));
    let hasCancel = options.buttons.includes(`cancel`) || options.buttons.length === 1,
      closeButton = document.createElement(`button`);
    ((closeButton.type = `button`),
      (closeButton.className = `tkw-btn tkw-close`),
      (closeButton.disabled = !hasCancel),
      (closeButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor"/></svg>`),
      title.append(titleText, closeButton));
    let body = document.createElement(`div`);
    body.className = `tk-msgbox-body`;
    let icon = document.createElement(`div`);
    ((icon.className = `tk-msgbox-icon`), (icon.innerHTML = MESSAGE_ICONS[options.icon] ?? MESSAGE_ICONS.info));
    let text = document.createElement(`div`);
    text.className = `tk-msgbox-text`;
    let message = options.detail ? `${options.message}\n\n${options.detail}` : options.message;
    (options.links ? linkifyEmails(text, message) : (text.textContent = message), body.append(icon, text));
    let buttons = document.createElement(`div`);
    buttons.className = `tk-msgbox-buttons`;
    let close = (buttonName) => {
        (box.remove(), parent.classList.remove(`tk-modal`), onResult(buttonName));
      },
      defaultButton = null;
    for (let buttonName of options.buttons) {
      let button = document.createElement(`button`);
      ((button.type = `button`),
        (button.className = `tk-msgbox-button`),
        (button.dataset.button = buttonName),
        (button.textContent = buttonLabels[buttonName] ?? buttonName),
        button.addEventListener(`click`, () => close(buttonName)),
        buttonName === options.default && (button.classList.add(`default`), (defaultButton = button)),
        buttons.append(button));
    }
    let escapeButton = options.buttons.includes(`cancel`) ? `cancel` : options.buttons.length === 1 ? options.buttons[0] : null;
    (closeButton.addEventListener(`click`, () => escapeButton && close(escapeButton)),
      box.addEventListener(`keydown`, (event) => {
        if ((event.stopPropagation(), event.key === `Escape` && escapeButton)) close(escapeButton);
        else if (event.key === `Enter`) {
          event.preventDefault();
          let active = document.activeElement;
          close(active?.dataset.button ?? options.default);
        }
      }),
      box.append(title, body, buttons),
      parent.append(box),
      parent.classList.add(`tk-modal`));
    let width = box.offsetWidth,
      height = box.offsetHeight;
    ((box.style.left = `${Math.max(0, Math.round(anchorRect.left + anchorRect.width / 2 - width / 2))}px`),
      (box.style.top = `${Math.max(0, Math.round(anchorRect.top + anchorRect.height / 2 - height / 2))}px`),
      (box.style.zIndex = `1000000`),
      (defaultButton ?? box).focus({
        preventScroll: !0,
      }));
  }

  function createDialogFrame(parent, title, className, onClose) {
    let dialog = document.createElement(`div`);
    ((dialog.className = `tkw tkw-active tk-msgbox tk-dialog ${className}`), (dialog.tabIndex = -1));
    let titleBar = document.createElement(`div`);
    titleBar.className = `tkw-title`;
    let titleText = document.createElement(`span`);
    ((titleText.className = `tkw-text`), (titleText.textContent = title));
    let closeButton = document.createElement(`button`);
    ((closeButton.type = `button`),
      (closeButton.className = `tkw-btn tkw-close`),
      (closeButton.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor"/></svg>`),
      closeButton.addEventListener(`click`, onClose),
      titleBar.append(titleText, closeButton));
    let body = document.createElement(`div`);
    return (
      (body.className = `tk-dialog-body`),
      dialog.append(titleBar, body),
      dialog.addEventListener(`keydown`, (event) => event.stopPropagation()),
      {
        dialog: dialog,
        body: body,
        close() {
          (dialog.remove(), parent.classList.remove(`tk-modal`));
        },
        show(anchorRect, focusTarget) {
          (parent.append(dialog), parent.classList.add(`tk-modal`));
          let width = dialog.offsetWidth,
            height = dialog.offsetHeight,
            left = Math.round(anchorRect.left + anchorRect.width / 2 - width / 2),
            top = Math.round(anchorRect.top + anchorRect.height / 2 - height / 2);
          ((dialog.style.left = `${Math.max(0, Math.min(left, innerWidth - width))}px`),
            (dialog.style.top = `${Math.max(0, Math.min(top, innerHeight - height))}px`),
            (dialog.style.zIndex = `1000000`),
            focusTarget.focus({
              preventScroll: !0,
            }));
        },
      }
    );
  }

  function createMessageButton(label, onClick, className = ``) {
    let button = document.createElement(`button`);
    return (
      (button.type = `button`),
      (button.className = `tk-msgbox-button ${className}`.trim()),
      (button.textContent = label),
      button.addEventListener(`click`, onClick),
      button
    );
  }

  function showSimpleMessage(parent, anchorRect, title, message, icon, buttons) {
    return new Promise((resolve) => {
      showMessageBox(
        parent,
        {
          app: 0,
          mid: 0,
          title: title,
          message: message,
          detail: ``,
          icon: icon,
          buttons: buttons,
          default: buttons[0],
        },
        anchorRect,
        (onResult) => {
          (parent.classList.add(`tk-modal`), resolve(onResult));
        },
      );
    });
  }

  ns.showMessageBox = showMessageBox;
  ns.createDialogFrame = createDialogFrame;
  ns.createMessageButton = createMessageButton;
  ns.showSimpleMessage = showSimpleMessage;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// ttk.js
// ============================================================

(function (ns) {
  "use strict";
  var reliefBorderStyle = ns.reliefBorderStyle;

  /**
   * Віджети ttk (теми, стани, повзунки, прогрес, combobox зі списком, spinbox, notebook тощо) і прив'язка їхніх подій.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const TEXT_INPUT_KINDS = new Set([`entry`, `combobox`, `spinbox`]);

  function getElementScale(element) {
    return element.offsetWidth ? element.getBoundingClientRect().width / element.offsetWidth : 1;
  }

  function setUnderlinedText(element, text, underline) {
    underline >= 0 && underline < text.length
      ? element.replaceChildren(
          text.slice(0, underline),
          Object.assign(document.createElement(`u`), {
            textContent: text[underline],
          }),
          text.slice(underline + 1),
        )
      : (element.textContent !== text || element.children.length) && (element.textContent = text);
  }

  function applyTtkStyle(element, part, offset, theme) {
    element.className =
      `ttk-p ` +
      part.c
        .split(` `)
        .map((className) => `ttk-${className}`)
        .join(` `);
    let style = element.style;
    (part.ix === void 0 ? delete element.dataset.ix : (element.dataset.ix = String(part.ix)));
    if (
      ((style.cssText = ``),
      Object.assign(style, {
        left: `${part.x - offset}px`,
        top: `${part.y - offset}px`,
        width: `${Math.max(0, part.w)}px`,
        height: `${Math.max(0, part.h)}px`,
      }),
      part.bg && (style.background = part.bg),
      part.bc && (style.borderColor = part.bc),
      part.fg && (style.color = part.fg),
      part.c === `border` &&
        theme !== `vista` &&
        Object.assign(style, reliefBorderStyle(part.relief ?? `groove`, part.bw ?? 2, part.bg ?? `#d9d9d9`)),
      part.img)
    ) {
      let image = element.querySelector(`img`);
      (image ||
        ((image = document.createElement(`img`)), (image.draggable = !1), (image.alt = ``), element.replaceChildren(image)),
        image.src !== part.img && (image.src = part.img));
    } else
      part.t === void 0
        ? element.firstChild && element.replaceChildren()
        : (setUnderlinedText(element, part.t, part.u ?? -1),
          Object.assign(style, {
            font: part.f ?? ``,
            lineHeight: `${part.lh ?? part.h}px`,
            textAlign: part.al ?? `left`,
            paddingLeft: part.px ? `${part.px}px` : ``,
            paddingRight: part.px ? `${part.px}px` : ``,
          }));
  }

  function renderTtkWidget(element, props, desktop, renderEntry) {
    let kind = String(props.ttk),
      theme = String(props.theme),
      stateClasses = String(props.st ?? ``)
        .split(` `)
        .filter(Boolean)
        .map((state) => `is-${state}`);
    ((element.className = [`tk`, `tk-ttk`, `ttk-${theme}`, `ttk-${kind}`, ...stateClasses].join(` `)),
      element.classList.toggle(`ttk-default`, !!props.def),
      element.classList.toggle(`ttk-vertical`, !!props.vertical),
      TEXT_INPUT_KINDS.has(kind) && element.classList.add(`tk-entry`));
    let partsBox = element.querySelector(`:scope > .ttk-parts`);
    partsBox || ((partsBox = document.createElement(`div`)), (partsBox.className = `ttk-parts`), element.prepend(partsBox));
    let borderOffset = (props.bd ?? 0) + (props.hl ?? 0),
      parts = props.parts ?? [];
    for (; partsBox.children.length > parts.length;) partsBox.lastElementChild.remove();
    for (; partsBox.children.length < parts.length;) partsBox.append(document.createElement(`div`));
    if ((parts.forEach((part, index) => applyTtkStyle(partsBox.children[index], part, borderOffset, theme)), TEXT_INPUT_KINDS.has(kind))) {
      renderEntry(element, {
        ...props,
        bg: props.fbg,
      });
      let input = element.querySelector(`:scope > input`),
        [inputX, inputY, inputWidth, inputHeight] = props.ib;
      (Object.assign(input.style, {
        position: `absolute`,
        left: `${inputX - borderOffset}px`,
        top: `${inputY - borderOffset}px`,
        width: `${inputWidth}px`,
        height: `${inputHeight}px`,
        paddingRight: `${props.padr ?? 0}px`,
      }),
        (input.style.cursor = kind === `combobox` && props.state === `readonly` ? `default` : ``));
    }
    element.dataset.wired || ((element.dataset.wired = `1`), attachTtkInteractions(element, kind, desktop));
  }

  function sendWidgetEvent(desktop, element, event) {
    desktop.desktop.send({
      ...event,
      app: desktop.app,
      w: element.dataset.tkid,
    });
  }

  function attachTtkInteractions(element, kind, desktop) {
    if (kind === `notebook`) {
      element.addEventListener(`pointerdown`, (event) => {
        let tab = event.target.closest && event.target.closest(`.ttk-tab`);
        if (!tab || !element.contains(tab) || event.button !== 0 || tab.dataset.ix === void 0) return;
        sendWidgetEvent(desktop, element, {
          t: `tab`,
          ix: Number(tab.dataset.ix),
        });
      });
      return;
    }
    kind === `scale`
      ? element.addEventListener(`pointerdown`, (event) => {
          let slider = element.querySelector(`.ttk-slider`);
          if (!slider || event.button !== 0 || element.classList.contains(`is-disabled`)) return;
          let vertical = element.classList.contains(`ttk-vertical`),
            scale = getElementScale(element),
            pointerPosition = (event2) => {
              let rect = element.getBoundingClientRect();
              return (vertical ? event2.clientY - rect.top : event2.clientX - rect.left) / scale;
            },
            sliderRect = slider.getBoundingClientRect();
          if (event.target === slider) {
            (event.stopPropagation(), element.setPointerCapture(event.pointerId));
            let rect = element.getBoundingClientRect(),
              sliderCenter = (vertical ? sliderRect.top + sliderRect.height / 2 - rect.top : sliderRect.left + sliderRect.width / 2 - rect.left) / scale,
              offset = pointerPosition(event) - sliderCenter,
              onMove = (event2) =>
                sendWidgetEvent(desktop, element, {
                  t: `scale`,
                  pos: pointerPosition(event2) - offset,
                }),
              onUp = () => {
                (element.removeEventListener(`pointermove`, onMove), element.removeEventListener(`pointerup`, onUp));
              };
            (element.addEventListener(`pointermove`, onMove), element.addEventListener(`pointerup`, onUp));
            return;
          }
          let direction = vertical ? event.clientY < sliderRect.top : event.clientX < sliderRect.left;
          repeatWhileHeld(element, event, () =>
            sendWidgetEvent(desktop, element, {
              t: `scale_step`,
              dir: direction ? -1 : 1,
            }),
          );
        })
      : kind === `spinbox`
        ? element.addEventListener(`pointerdown`, (event) => {
            let target = event.target;
            event.button !== 0 ||
              element.classList.contains(`is-disabled`) ||
              (target.classList.contains(`ttk-up`)
                ? repeatWhileHeld(target, event, () =>
                    sendWidgetEvent(desktop, element, {
                      t: `spin`,
                      dir: 1,
                    }),
                  )
                : target.classList.contains(`ttk-down`) &&
                  repeatWhileHeld(target, event, () =>
                    sendWidgetEvent(desktop, element, {
                      t: `spin`,
                      dir: -1,
                    }),
                  ));
          })
        : kind === `sizegrip` &&
          element.addEventListener(`pointerdown`, (event) => {
            event.button === 0 && desktop.startResize && desktop.startResize(event, `se`);
          });
  }

  function repeatWhileHeld(element, event, action) {
    (event.preventDefault(),
      event.stopPropagation(),
      element.setPointerCapture(event.pointerId),
      element.classList.add(`held`),
      action());
    let timer = window.setTimeout(function tick() {
        (action(), (timer = window.setTimeout(tick, 50)));
      }, 300),
      stop = () => {
        (window.clearTimeout(timer),
          element.classList.remove(`held`),
          element.removeEventListener(`pointerup`, stop),
          element.removeEventListener(`pointercancel`, stop));
      };
    (element.addEventListener(`pointerup`, stop), element.addEventListener(`pointercancel`, stop));
  }

  let comboPopup = null;

  function closeComboPopup() {
    comboPopup?.close();
  }

  function showComboList(element, props, onSelect) {
    closeComboPopup();
    let scale = getElementScale(element),
      rect = element.getBoundingClientRect(),
      list = document.createElement(`div`);
    ((list.className = `tk-combo-list`),
      (list.style.font = props.font),
      (list.style.width = `${element.offsetWidth}px`),
      (list.style.maxHeight = `${props.rows * props.rowh + 2}px`),
      (list.style.transform = scale === 1 ? `` : `scale(${scale})`),
      props.values.forEach((value, index) => {
        let row = document.createElement(`div`);
        ((row.className = `tk-combo-row` + (index === props.current ? ` current` : ``)),
          (row.textContent = value || `\xA0`),
          (row.style.height = `${props.rowh}px`),
          (row.style.lineHeight = `${props.rowh}px`),
          row.addEventListener(`pointerenter`, () => {
            (list.querySelector(`.current`)?.classList.remove(`current`), row.classList.add(`current`));
          }),
          row.addEventListener(`pointerup`, (event) => {
            (event.stopPropagation(), close(), onSelect(index));
          }),
          list.append(row));
      }),
      document.body.append(list));
    let listHeight = list.offsetHeight * scale,
      below = rect.bottom + listHeight <= window.innerHeight || rect.top < listHeight;
    ((list.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - rect.width))}px`),
      (list.style.top = `${below ? rect.bottom : rect.top - listHeight}px`),
      list.querySelector(`.current`)?.scrollIntoView({
        block: `nearest`,
      }));
    let onPointerDown = (event) => {
        list.contains(event.target) || close();
      },
      onKeyDown = (event) => {
        let rows = [...list.children],
          currentIndex = rows.findIndex((event2) => event2.classList.contains(`current`));
        if (event.key === `Escape`) close();
        else if (event.key === `Enter` && currentIndex >= 0) (close(), onSelect(currentIndex));
        else if (event.key === `ArrowDown` || event.key === `ArrowUp`) {
          let nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + (event.key === `ArrowDown` ? 1 : -1)));
          (rows[currentIndex]?.classList.remove(`current`),
            rows[nextIndex]?.classList.add(`current`),
            rows[nextIndex]?.scrollIntoView({
              block: `nearest`,
            }));
        } else return;
        (event.preventDefault(), event.stopPropagation());
      };
    function close() {
      (list.remove(),
        document.removeEventListener(`pointerdown`, onPointerDown, !0),
        document.removeEventListener(`keydown`, onKeyDown, !0),
        (comboPopup = null));
    }
    (setTimeout(() => {
      list.isConnected &&
        (document.addEventListener(`pointerdown`, onPointerDown, !0),
        document.addEventListener(`keydown`, onKeyDown, !0));
    }),
      (comboPopup = {
        close: close,
      }));
  }

  ns.renderTtkWidget = renderTtkWidget;
  ns.closeComboPopup = closeComboPopup;
  ns.showComboList = showComboList;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// widgets-misc.js
// ============================================================

(function (ns) {
  "use strict";
  var reliefBorderStyle = ns.reliefBorderStyle;

  /**
   * Відображення складніших Tk-віджетів: Panedwindow, Labelframe, Listbox, Scrollbar, Scale, кнопки Spinbox.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  function getOrCreateChild(parent, className, tagName = `div`) {
    let child = parent.querySelector(`:scope > .${className}`);
    return (child || ((child = document.createElement(tagName)), (child.className = className), parent.append(child)), child);
  }

  function repeatWhilePressed(element, event, action, delay = 300, interval = 50) {
    (event.preventDefault(), event.stopPropagation(), element.setPointerCapture(event.pointerId), action());
    let timer = window.setTimeout(function tick() {
        (action(), (timer = window.setTimeout(tick, interval)));
      }, delay),
      stop = () => {
        (window.clearTimeout(timer),
          element.removeEventListener(`pointerup`, stop),
          element.removeEventListener(`pointercancel`, stop));
      };
    (element.addEventListener(`pointerup`, stop), element.addEventListener(`pointercancel`, stop));
  }

  function renderPanedWindow(element, props) {
    element.classList.toggle(`vertical`, !props.horizontal);
    let sashes = props.sashes ?? [],
      handles = props.handles ?? [],
      parts = [
        ...sashes.map(([x, y, width, height]) => ({
          cls: `tk-sash`,
          x: x,
          y: y,
          w: width,
          h: height,
          relief: String(props.sashrelief),
          bd: 2,
        })),
        ...handles.map(([x, size, y]) => ({
          cls: `tk-sash-handle`,
          x: x,
          y: size,
          w: y,
          h: y,
          relief: `raised`,
          bd: 2,
        })),
      ],
      existing = [...element.querySelectorAll(`:scope > .tk-sash, :scope > .tk-sash-handle`)];
    (existing.slice(parts.length).forEach((element2) => element2.remove()),
      parts.forEach((part, index) => {
        let element2 = existing[index] ?? element.appendChild(document.createElement(`div`));
        ((element2.className = part.cls),
          Object.assign(element2.style, {
            left: `${part.x}px`,
            top: `${part.y}px`,
            width: `${part.w}px`,
            height: `${part.h}px`,
            background: props.bg,
            ...reliefBorderStyle(
              part.relief,
              part.relief === `flat` ? 0 : Math.min(part.bd, Math.floor(Math.min(part.w, part.h) / 2)),
              props.bg,
            ),
          }));
      }));
  }

  function renderLabelFrame(element, props) {
    let borderWidth = props.bd ?? 0,
      labelHeight = props.lh || 0;
    Object.assign(element.style, {
      border: `none`,
      boxShadow: (props.hl ?? 0) > 0 ? `0 0 0 ${props.hl}px ${props.bg}` : `none`,
    });
    let border = getOrCreateChild(element, `tk-lf-border`),
      labelTop = labelHeight ? Math.max(0, Math.floor((labelHeight - borderWidth) / 2)) : 0;
    Object.assign(border.style, {
      top: `${labelTop}px`,
      ...reliefBorderStyle(props.relief, borderWidth, props.bg),
    });
    let label = getOrCreateChild(element, `tk-lf-label`);
    ((label.textContent = String(props.label ?? ``)),
      (label.hidden = !props.label),
      Object.assign(label.style, {
        left: `${props.lx - (props.hl ?? 0)}px`,
        top: `0px`,
        font: props.font,
        color: props.fg,
        background: props.bg,
        lineHeight: `${props.linespace}px`,
      }));
  }

  function renderListbox(element, props) {
    element.tabIndex = -1;
    let rowsBox = getOrCreateChild(element, `tk-lb-rows`),
      items = props.items ?? [],
      selected = new Set(props.selected ?? []),
      rowHeight = props.rowh;
    for (
      rowsBox.style.top = `${-props.top * rowHeight}px`, rowsBox.style.font = props.font, rowsBox.style.textAlign = props.justify;
      rowsBox.children.length > items.length;
    )
      rowsBox.lastElementChild.remove();
    for (; rowsBox.children.length < items.length;) rowsBox.append(document.createElement(`div`));
    items.forEach((item, index) => {
      let row = rowsBox.children[index];
      row.textContent !== item.t && (row.textContent = item.t);
      let isSelected = selected.has(index);
      ((row.className = `tk-lb-row` + (isSelected ? ` selected` : ``)),
        (row.style.height = `${rowHeight}px`),
        (row.style.lineHeight = `${rowHeight - 1}px`),
        (row.style.background = isSelected ? (item.sbg ?? props.selectbg) : (item.bg ?? ``)),
        (row.style.color = isSelected ? (item.sfg ?? props.selectfg) : (item.fg ?? props.fg)),
        row.classList.toggle(`active`, index === props.active && !!props.focused && props.activestyle === `dotbox`),
        row.classList.toggle(
          `active-underline`,
          index === props.active && !!props.focused && props.activestyle === `underline`,
        ));
    });
  }

  function getCssScale(element) {
    return element.offsetWidth ? element.getBoundingClientRect().width / element.offsetWidth : 1;
  }

  function renderScrollbar(element, props, desktop) {
    let vertical = !!props.vertical,
      arrowWidth = props.arrow;
    (element.classList.toggle(`vertical`, vertical), element.classList.toggle(`horizontal`, !vertical));
    let trackLength = (vertical ? props.h : props.w) - 2 * arrowWidth,
      first = props.first,
      last = props.last,
      disabled = first <= 0 && last >= 1;
    element.classList.toggle(`disabled`, disabled);
    let widgetId = element.dataset.tkid,
      onScroll = (args) =>
        desktop.desktop.send({
          t: `scroll`,
          app: desktop.app,
          w: widgetId,
          args: args.map(String),
        }),
      upButton = getOrCreateChild(element, `tk-sb-up`),
      downButton = getOrCreateChild(element, `tk-sb-down`),
      thumb = getOrCreateChild(element, `tk-sb-thumb`);
    (element.dataset.wired ||
      ((element.dataset.wired = `1`),
      upButton.addEventListener(`pointerdown`, (event) =>
        repeatWhilePressed(upButton, event, () => onScroll([`scroll`, -1, `units`])),
      ),
      downButton.addEventListener(`pointerdown`, (event) =>
        repeatWhilePressed(downButton, event, () => onScroll([`scroll`, 1, `units`])),
      ),
      element.addEventListener(`pointerdown`, (event) => {
        if (event.target !== element || element.classList.contains(`disabled`)) return;
        let thumbRect = thumb.getBoundingClientRect(),
          beforeThumb = vertical ? event.clientY < thumbRect.top : event.clientX < thumbRect.left;
        repeatWhilePressed(element, event, () => onScroll([`scroll`, beforeThumb ? -1 : 1, `pages`]));
      }),
      thumb.addEventListener(`pointerdown`, (event) => {
        (event.preventDefault(),
          event.stopPropagation(),
          thumb.setPointerCapture(event.pointerId),
          thumb.classList.add(`dragging`));
        let thumbRect = thumb.getBoundingClientRect(),
          scale = getCssScale(element),
          grabOffset = (vertical ? event.clientY - thumbRect.top : event.clientX - thumbRect.left) / scale,
          trackSize = (event2) => {
            let elementRect = element.getBoundingClientRect(),
              trackSize2 = (vertical ? element.offsetHeight : element.offsetWidth) - 2 * Number(element.dataset.arrow),
              thumbSize3 = vertical ? thumb.offsetHeight : thumb.offsetWidth,
              visibleRange2 = Number(element.dataset.last) - Number(element.dataset.first),
              fraction =
                (((vertical ? event2.clientY - elementRect.top : event2.clientX - elementRect.left) / scale - Number(element.dataset.arrow) - grabOffset) /
                  Math.max(trackSize2 - thumbSize3, 1)) *
                (1 - visibleRange2);
            onScroll([`moveto`, Math.max(0, Math.min(1 - visibleRange2, fraction)).toFixed(6)]);
          },
          thumbSize2 = () => {
            (thumb.classList.remove(`dragging`),
              thumb.removeEventListener(`pointermove`, trackSize),
              thumb.removeEventListener(`pointerup`, thumbSize2));
          };
        (thumb.addEventListener(`pointermove`, trackSize), thumb.addEventListener(`pointerup`, thumbSize2));
      })),
      (element.dataset.arrow = String(arrowWidth)),
      (element.dataset.first = String(first)),
      (element.dataset.last = String(last)));
    let mainAxis = vertical ? `top` : `left`,
      crossSize = vertical ? `height` : `width`,
      otherSize = vertical ? `width` : `height`;
    for (let [button, offset] of [
      [upButton, 0],
      [downButton, (vertical ? props.h : props.w) - arrowWidth],
    ])
      Object.assign(button.style, {
        [mainAxis]: `${offset}px`,
        [crossSize]: `${arrowWidth}px`,
        [otherSize]: `100%`,
      });
    ((upButton.className = `tk-sb-up tk-sb-arrow ${vertical ? `dir-up` : `dir-left`}`),
      (downButton.className = `tk-sb-down tk-sb-arrow ${vertical ? `dir-down` : `dir-right`}`),
      (thumb.hidden = disabled));
    let visibleRange = last - first,
      thumbSize = Math.min(trackLength, Math.max(Math.round(visibleRange * trackLength), 17)),
      thumbFraction = visibleRange < 1 ? first / (1 - visibleRange) : 0,
      thumbOffset = arrowWidth + Math.round(thumbFraction * (trackLength - thumbSize));
    Object.assign(thumb.style, {
      [mainAxis]: `${thumbOffset}px`,
      [crossSize]: `${thumbSize}px`,
      [otherSize]: `100%`,
    });
  }

  function renderScale(element, props, desktop) {
    let highlight = props.hl ?? 0,
      horizontal = !!props.horizontal,
      widgetId = element.dataset.tkid,
      inset = (value) => value - highlight,
      trough = getOrCreateChild(element, `tk-scale-trough`),
      troughBorder = props.tbd;
    Object.assign(trough.style, {
      left: `${inset(props.tx)}px`,
      top: `${inset(props.ty)}px`,
      width: `${horizontal ? props.tl : props.tw}px`,
      height: `${horizontal ? props.tw : props.tl}px`,
      background: props.trough,
      ...reliefBorderStyle(`sunken`, troughBorder, props.bg),
    });
    let slider = getOrCreateChild(element, `tk-scale-slider`),
      sliderWidth = props.slider,
      sliderHeight = props.tw - 2 * troughBorder,
      sliderCenter = inset(props.center);
    (Object.assign(
      slider.style,
      horizontal
        ? {
            left: `${sliderCenter - sliderWidth / 2}px`,
            top: `${inset(props.ty) + troughBorder}px`,
            width: `${sliderWidth}px`,
            height: `${sliderHeight}px`,
          }
        : {
            left: `${inset(props.tx) + troughBorder}px`,
            top: `${sliderCenter - sliderWidth / 2}px`,
            width: `${sliderHeight}px`,
            height: `${sliderWidth}px`,
          },
    ),
      Object.assign(slider.style, {
        background: props.bg,
        ...reliefBorderStyle(props.sliderrelief, 2, props.bg),
      }),
      slider.classList.toggle(`horizontal`, horizontal));
    let valueBox = getOrCreateChild(element, `tk-scale-value`);
    ((valueBox.textContent = String(props.value ?? ``)), (valueBox.hidden = !props.value));
    let font = props.font;
    (Object.assign(valueBox.style, {
      font: font,
      color: props.fg,
      lineHeight: `${props.lh}px`,
    }),
      horizontal
        ? Object.assign(valueBox.style, {
            left: `${sliderCenter}px`,
            top: `${inset(props.value_y)}px`,
            transform: `translateX(-50%)`,
          })
        : Object.assign(valueBox.style, {
            left: `${inset(props.value_x)}px`,
            top: `${sliderCenter}px`,
            transform: `translateY(-50%)`,
          }));
    let labelBox = getOrCreateChild(element, `tk-scale-label`);
    ((labelBox.textContent = String(props.label ?? ``)),
      (labelBox.hidden = !props.label),
      Object.assign(
        labelBox.style,
        horizontal
          ? {
              font: font,
              color: props.fg,
              left: `0px`,
              top: `${inset(props.label_y ?? highlight)}px`,
            }
          : {
              font: font,
              color: props.fg,
              left: `${inset(props.label_x)}px`,
              top: `0px`,
            },
      ),
      getOrCreateChild(element, `tk-scale-ticks`).replaceChildren(
        ...(props.ticks ?? []).map(([x, y]) => {
          let tick = document.createElement(`div`);
          return (
            (tick.className = `tk-scale-tick`),
            (tick.textContent = y),
            Object.assign(
              tick.style,
              horizontal
                ? {
                    left: `${inset(x)}px`,
                    top: `${inset(props.tick_y)}px`,
                    transform: `translateX(-50%)`,
                  }
                : {
                    left: `${inset(props.tick_x)}px`,
                    top: `${inset(x)}px`,
                    transform: `translateY(-50%)`,
                  },
            ),
            Object.assign(tick.style, {
              font: font,
              color: props.fg,
            }),
            tick
          );
        }),
      ),
      element.dataset.wired ||
        ((element.dataset.wired = `1`),
        slider.addEventListener(`pointerdown`, (event) => {
          if (element.classList.contains(`disabled`)) return;
          (event.preventDefault(), event.stopPropagation(), slider.setPointerCapture(event.pointerId));
          let sliderRect = slider.getBoundingClientRect(),
            horizontal2 = element.classList.contains(`horizontal`),
            scale = getCssScale(element),
            grabOffset = (horizontal2 ? event.clientX - (sliderRect.left + sliderRect.width / 2) : event.clientY - (sliderRect.top + sliderRect.height / 2)) / scale,
            position = (event2) => {
              let elementRect = element.getBoundingClientRect(),
                position2 = (horizontal2 ? event2.clientX - elementRect.left : event2.clientY - elementRect.top) / scale - grabOffset + Number(element.dataset.hl);
              desktop.desktop.send({
                t: `scale`,
                app: desktop.app,
                w: widgetId,
                pos: position2,
              });
            },
            offset = () => {
              (slider.removeEventListener(`pointermove`, position), slider.removeEventListener(`pointerup`, offset));
            };
          (slider.addEventListener(`pointermove`, position), slider.addEventListener(`pointerup`, offset));
        }),
        trough.addEventListener(`pointerdown`, (event) => {
          if (event.target !== trough || element.classList.contains(`disabled`)) return;
          let sliderRect = slider.getBoundingClientRect(),
            before = element.classList.contains(`horizontal`) ? event.clientX < sliderRect.left : event.clientY < sliderRect.top;
          repeatWhilePressed(trough, event, () =>
            desktop.desktop.send({
              t: `scale_step`,
              app: desktop.app,
              w: widgetId,
              dir: before ? -1 : 1,
            }),
          );
        })),
      (element.dataset.hl = String(highlight)),
      element.classList.toggle(`horizontal`, horizontal),
      element.classList.toggle(`disabled`, !!props.disabled));
  }

  function renderSpinboxButtons(element, props, desktop) {
    let buttonWidth = props.bw,
      buttonsBox = getOrCreateChild(element, `tk-spin-buttons`);
    buttonsBox.style.width = `${buttonWidth}px`;
    let input = element.querySelector(`:scope > input`);
    if ((input && (input.style.width = `calc(100% - ${buttonWidth}px)`), !buttonsBox.childElementCount))
      for (let direction of [1, -1]) {
        let button = document.createElement(`div`);
        ((button.className = `tk-spin-button ${direction > 0 ? `up` : `down`}`),
          button.addEventListener(`pointerdown`, (event) => {
            element.classList.contains(`disabled`) ||
              (button.classList.add(`pressed`),
              repeatWhilePressed(button, event, () =>
                desktop.desktop.send({
                  t: `spin`,
                  app: desktop.app,
                  w: element.dataset.tkid,
                  dir: direction,
                }),
              ),
              button.addEventListener(`pointerup`, () => button.classList.remove(`pressed`), {
                once: !0,
              }));
          }),
          buttonsBox.append(button));
      }
    for (let button of buttonsBox.children)
      Object.assign(button.style, {
        background: props.buttonbg,
        ...reliefBorderStyle(`raised`, 2, props.buttonbg),
      });
    element.classList.toggle(`disabled`, props.state === `disabled`);
  }

  ns.renderPanedWindow = renderPanedWindow;
  ns.renderLabelFrame = renderLabelFrame;
  ns.renderListbox = renderListbox;
  ns.renderScrollbar = renderScrollbar;
  ns.renderScale = renderScale;
  ns.renderSpinboxButtons = renderSpinboxButtons;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// text-widget.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Віджет Text: редактор на contenteditable, виділення, перетворення зміщень DOM ↔ індекси, text_see / text_scroll.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  function collectTextNodes(root) {
    let nodes = [],
      walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
    return nodes;
  }

  function domPointToOffset(root, node, offset) {
    let offset2 = 0;
    for (let textNode of collectTextNodes(root)) {
      if (textNode === node) return offset2 + offset;
      offset2 += textNode.data.length;
    }
    if (node === root) {
      let offset3 = 0;
      for (let index = 0; index < offset && index < root.childNodes.length; index++)
        offset3 += root.childNodes[index].textContent?.length ?? 0;
      return offset3;
    }
    return offset2;
  }

  function offsetToDomPoint(root, offset) {
    let nodes = offset,
      textNodes = collectTextNodes(root);
    for (let textNode of textNodes) {
      if (nodes <= textNode.data.length) return [textNode, nodes];
      nodes -= textNode.data.length;
    }
    let lastNode = textNodes[textNodes.length - 1];
    return lastNode ? [lastNode, lastNode.data.length] : [root, 0];
  }

  function getEditorSelection(root) {
    let selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null;
    let range = selection.getRangeAt(0),
      end = domPointToOffset(root, range.startContainer, range.startOffset),
      start = domPointToOffset(root, range.endContainer, range.endOffset);
    return {
      cursor: domPointToOffset(root, selection.focusNode, selection.focusOffset),
      sel: [end, start],
    };
  }

  function offsetFromPoint(root, y, x) {
    let document = document,
      caretPosition = document.caretPositionFromPoint?.(y, x);
    if (caretPosition && root.contains(caretPosition.offsetNode)) return domPointToOffset(root, caretPosition.offsetNode, caretPosition.offset);
    let caretRange = document.caretRangeFromPoint?.(y, x);
    if (caretRange && root.contains(caretRange.startContainer))
      return domPointToOffset(root, caretRange.startContainer, caretRange.startOffset);
  }

  function renderTextWidget(element, props, desktop) {
    let editor = element.querySelector(`:scope > .tk-text-editor`),
      widgetId = element.dataset.tkid;
    if (!editor) {
      ((editor = document.createElement(`div`)), (editor.className = `tk-text-editor`), (editor.spellcheck = !1));
      let editor2 = editor;
      (editor2.addEventListener(`input`, () => {
        let selection = getEditorSelection(editor2) ?? {
          cursor: 0,
          sel: [0, 0],
        };
        desktop.desktop.send({
          t: `text`,
          app: desktop.app,
          w: widgetId,
          value: editor2.textContent ?? ``,
          ...selection,
        });
      }),
        editor2.addEventListener(`keydown`, (event) => {
          event.key === `Tab` &&
            editor2.isContentEditable &&
            (event.preventDefault(), document.execCommand(`insertText`, !1, `	`));
        }),
        editor2.addEventListener(`focus`, () =>
          desktop.desktop.send({
            t: `focus`,
            app: desktop.app,
            w: widgetId,
          }),
        ),
        editor2.addEventListener(`scroll`, () => {
          let firstFraction = editor2.scrollTop / Math.max(editor2.scrollHeight, 1),
            lastFraction = (editor2.scrollTop + editor2.clientHeight) / Math.max(editor2.scrollHeight, 1);
          desktop.desktop.send({
            t: `textview`,
            app: desktop.app,
            w: widgetId,
            first: firstFraction.toFixed(6),
            last: Math.min(1, lastFraction).toFixed(6),
          });
        }),
        document.addEventListener(`selectionchange`, () => {
          if (document.activeElement !== editor2) return;
          let selection = getEditorSelection(editor2);
          selection &&
            desktop.desktop.send({
              t: `textsel`,
              app: desktop.app,
              w: widgetId,
              ...selection,
            });
        }),
        element.append(editor));
    }
    let text = String(props.value ?? ``),
      runs = props.runs ?? [],
      styles = props.styles ?? [],
      signature = JSON.stringify([runs, styles]);
    if (editor.textContent !== text || editor.dataset.sig !== signature) {
      let selection = document.activeElement === editor ? getEditorSelection(editor) : null,
        nodes = [],
        offset = 0;
      for (let [length, styleIndex] of runs) {
        let chunk = text.slice(offset, offset + length);
        offset += length;
        let style = styles[styleIndex] ?? {};
        if (Object.keys(style).length === 0) {
          nodes.push(document.createTextNode(chunk));
          continue;
        }
        let span = document.createElement(`span`);
        ((span.textContent = chunk),
          style.fg && (span.style.color = String(style.fg)),
          style.bg && (span.style.background = String(style.bg)),
          style.font && (span.style.font = String(style.font)));
        let decoration = [style.underline ? `underline` : ``, style.overstrike ? `line-through` : ``]
          .filter(Boolean)
          .join(` `);
        (decoration && (span.style.textDecoration = decoration), style.elide && (span.style.display = `none`), nodes.push(span));
      }
      if (
        (offset < text.length && nodes.push(document.createTextNode(text.slice(offset))),
        editor.replaceChildren(...nodes),
        (editor.dataset.sig = signature),
        selection)
      ) {
        let selection2 = window.getSelection(),
          [startNode, startOffset] = offsetToDomPoint(editor, Math.min(selection.sel[0], text.length)),
          [endNode, endOffset] = offsetToDomPoint(editor, Math.min(selection.sel[1], text.length)),
          range = document.createRange();
        (range.setStart(startNode, startOffset), range.setEnd(endNode, endOffset), selection2.removeAllRanges(), selection2.addRange(range));
      }
    }
    (props.state === `disabled`
      ? (editor.contentEditable = `false`)
      : ((editor.contentEditable = `plaintext-only`),
        editor.contentEditable !== `plaintext-only` && (editor.contentEditable = `true`)),
      Object.assign(editor.style, {
        font: props.font,
        lineHeight: `${props.lh}px`,
        color: props.fg,
        padding: `${props.pady}px ${props.padx}px`,
        caretColor: props.insertcolor,
        whiteSpace: props.wrap === `none` ? `pre` : `pre-wrap`,
        overflowWrap: props.wrap === `word` ? `break-word` : `anywhere`,
        wordBreak: props.wrap === `char` ? `break-all` : `normal`,
      }),
      editor.style.setProperty(`--tk-selectbg`, props.selectbg),
      editor.style.setProperty(`--tk-selectfg`, props.selectfg));
  }

  function handleTextScrollOp(element, op) {
    let editor = element.querySelector(`:scope > .tk-text-editor`);
    if (editor) {
      if (op.op === `text_see`) {
        let [node, offset] = offsetToDomPoint(editor, op.offset),
          range = document.createRange();
        (range.setStart(node, offset), range.setEnd(node, offset));
        let rangeRect = range.getBoundingClientRect(),
          editorRect = editor.getBoundingClientRect();
        rangeRect.height &&
          (rangeRect.top < editorRect.top || rangeRect.bottom > editorRect.bottom) &&
          (editor.scrollTop += rangeRect.top - editorRect.top - editorRect.height / 2);
      } else if (op.op === `text_scroll`) {
        let lineHeight = parseFloat(editor.style.lineHeight) || 16;
        op.kind === `moveto`
          ? (editor.scrollTop = op.amount * editor.scrollHeight)
          : op.what === `pages`
            ? (editor.scrollTop += op.amount * editor.clientHeight * 0.9)
            : op.what === `pixels`
              ? (editor.scrollTop += op.amount)
              : (editor.scrollTop += op.amount * lineHeight);
      }
    }
  }

  ns.offsetFromPoint = offsetFromPoint;
  ns.renderTextWidget = renderTextWidget;
  ns.handleTextScrollOp = handleTextScrollOp;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// canvas-widget.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Віджет Canvas: SVG-відображення елементів (лінії, прямокутники, овали, полігони, текст, зображення), згладжені криві та дуги.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const SVG_NS = `http://www.w3.org/2000/svg`;

  function createSvgElement(tagName, attributes) {
    let element = document.createElementNS(SVG_NS, tagName);
    for (let [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
    return element;
  }

  function pairUpCoords(coords) {
    let points = [];
    for (let index = 0; index + 1 < coords.length; index += 2) points.push([coords[index], coords[index + 1]]);
    return points;
  }

  function buildSmoothPath(coords, closed) {
    let points = pairUpCoords(coords);
    if (points.length < 3) return `M${points.map((point) => point.join(`,`)).join(`L`)}`;
    let midpoint = (first, second) => `${(first[0] + second[0]) / 2},${(first[1] + second[1]) / 2}`;
    if (closed) {
      let path2 = `M${midpoint(points[points.length - 1], points[0])}`;
      for (let index = 0; index < points.length; index++) path2 += `Q${points[index].join(`,`)} ${midpoint(points[index], points[(index + 1) % points.length])}`;
      return path2 + `Z`;
    }
    let path = `M${points[0].join(`,`)}`;
    for (let index = 1; index < points.length - 1; index++) {
      let control = index === points.length - 2 ? points[points.length - 1].join(`,`) : midpoint(points[index], points[index + 1]);
      path += `Q${points[index].join(`,`)} ${control}`;
    }
    return path;
  }

  function buildArcPath(coords, style, start, extent) {
    let [x1, centerX, y1, y2] = coords,
      extent2 = (x1 + y1) / 2,
      centerY = (centerX + y2) / 2,
      radiusX = Math.abs(y1 - x1) / 2,
      radiusY = Math.abs(y2 - centerX) / 2,
      startRad = Math.max(-359.99, Math.min(359.99, start)),
      x2 = (-style * Math.PI) / 180,
      angleMid = (-(style + startRad) * Math.PI) / 180,
      startPointX = extent2 + radiusX * Math.cos(x2),
      endRad = centerY + radiusY * Math.sin(x2),
      angleStart = extent2 + radiusX * Math.cos(angleMid),
      angleEnd = centerY + radiusY * Math.sin(angleMid),
      endPointY = `A${radiusX},${radiusY} 0 ${+(Math.abs(startRad) > 180)} ${startRad > 0 ? 0 : 1} ${angleStart},${angleEnd}`;
    return extent === `pieslice`
      ? `M${extent2},${centerY}L${startPointX},${endRad}${endPointY}Z`
      : extent === `chord`
        ? `M${startPointX},${endRad}${endPointY}Z`
        : `M${startPointX},${endRad}${endPointY}`;
  }

  function renderCanvasItem(itemId, props) {
    let group = createSvgElement(`g`, {
        "data-item": itemId,
      }),
      stroke = props.stroke || `none`,
      fill = props.fill || `none`,
      attributes = {
        stroke: stroke,
        "stroke-width": Math.max(Number(props.width ?? 1), 0) || 1,
      };
    props.dash && (attributes[`stroke-dasharray`] = props.dash);
    let points = props.points ?? [];
    switch (props.type) {
      case `line`: {
        let key = {
          ...attributes,
          fill: `none`,
          "stroke-linecap": props.cap,
          "stroke-linejoin": props.join,
        };
        props.smooth
          ? group.append(
              createSvgElement(`path`, {
                ...key,
                d: buildSmoothPath(points, !1),
              }),
            )
          : group.append(
              createSvgElement(`polyline`, {
                ...key,
                points: pairUpCoords(points)
                  .map((points2) => points2.join(`,`))
                  .join(` `),
              }),
            );
        for (let arrow of props.arrows ?? [])
          group.append(
            createSvgElement(`polygon`, {
              fill: stroke,
              stroke: `none`,
              points: pairUpCoords(arrow)
                .map((points2) => points2.join(`,`))
                .join(` `),
            }),
          );
        break;
      }
      case `rectangle`: {
        let [x1, y1, x2, y2] = points;
        group.append(
          createSvgElement(`rect`, {
            ...attributes,
            fill: fill,
            stroke: props.stroke ? stroke : `none`,
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
          }),
        );
        break;
      }
      case `oval`: {
        let [x1, y1, x2, y2] = points;
        group.append(
          createSvgElement(`ellipse`, {
            ...attributes,
            fill: fill,
            stroke: props.stroke ? stroke : `none`,
            cx: (x1 + x2) / 2,
            cy: (y1 + y2) / 2,
            rx: Math.abs(x2 - x1) / 2,
            ry: Math.abs(y2 - y1) / 2,
          }),
        );
        break;
      }
      case `polygon`: {
        let attributes2 = {
          ...attributes,
          fill: fill,
          stroke: props.stroke ? stroke : `none`,
          "stroke-linejoin": props.join ?? `round`,
          "fill-rule": `evenodd`,
        };
        props.smooth
          ? group.append(
              createSvgElement(`path`, {
                ...attributes2,
                d: buildSmoothPath(points, !0),
              }),
            )
          : group.append(
              createSvgElement(`polygon`, {
                ...attributes2,
                points: pairUpCoords(points)
                  .map((points2) => points2.join(`,`))
                  .join(` `),
              }),
            );
        break;
      }
      case `arc`:
        group.append(
          createSvgElement(`path`, {
            ...attributes,
            fill: props.style === `arc` ? `none` : fill,
            stroke: props.stroke ? stroke : `none`,
            d: buildArcPath(points, Number(props.start), Number(props.extent), String(props.style)),
          }),
        );
        break;
      case `image`:
        if (props.url) {
          let style = createSvgElement(`image`, {
            href: props.url,
            x: props.x,
            y: props.y,
            width: props.w,
            height: props.h,
            preserveAspectRatio: `none`,
          });
          ((style.style.imageRendering = `pixelated`), group.append(style));
        }
        break;
      case `text`: {
        let lines = props.lines ?? [],
          justify = props.justify,
          width = props.w,
          anchorX = props.x + (justify === `center` ? width / 2 : justify === `right` ? width : 0),
          text = createSvgElement(`text`, {
            x: anchorX,
            y: props.y,
            fill: fill,
            "text-anchor": justify === `center` ? `middle` : justify === `right` ? `end` : `start`,
          });
        ((text.style.font = props.font),
          props.underline && text.setAttribute(`text-decoration`, `underline`),
          lines.forEach((line, index) => {
            let span = createSvgElement(`tspan`, {
              x: anchorX,
              y: props.y + index * props.lh,
            });
            ((span.textContent = line), text.append(span));
          }),
          props.angle && text.setAttribute(`transform`, `rotate(${-props.angle} ${props.ax} ${props.ay})`),
          group.append(text));
        break;
      }
    }
    return (props.state === `hidden` && group.setAttribute(`display`, `none`), group);
  }

  function getCanvasSvg(element) {
    let svg = element.querySelector(`:scope > svg`);
    return (
      svg ||
        ((svg = createSvgElement(`svg`, {
          class: `tk-canvas-svg`,
        })),
        svg.append(
          createSvgElement(`g`, {
            class: `tk-canvas-items`,
          }),
        ),
        element.append(svg)),
      svg.querySelector(`.tk-canvas-items`)
    );
  }

  function renderCanvasWidget(element, props) {
    getCanvasSvg(element).setAttribute(`transform`, `translate(${-props.ox} ${-props.oy})`);
  }

  function updateCanvasItems(element, props) {
    let itemsGroup = getCanvasSvg(element);
    props.reset && itemsGroup.replaceChildren();
    let findItem = (itemId) => itemsGroup.querySelector(`:scope > [data-item="${itemId}"]`);
    for (let itemId of props.deleted ?? []) findItem(itemId)?.remove();
    for (let [itemId, itemProps] of props.items ?? []) {
      let newItem = renderCanvasItem(itemId, itemProps),
        existingItem = findItem(itemId);
      existingItem ? existingItem.replaceWith(newItem) : itemsGroup.append(newItem);
    }
    for (let [position, itemId, afterId] of props.order ?? []) {
      let itemProps = findItem(itemId);
      if (itemProps) {
        if (position === `top`) itemsGroup.append(itemProps);
        else if (position === `bottom`) itemsGroup.prepend(itemProps);
        else {
          let sibling = afterId === void 0 ? null : findItem(afterId);
          if (!sibling) continue;
          position === `after` ? sibling.after(itemProps) : sibling.before(itemProps);
        }
      }
    }
  }

  ns.renderCanvasWidget = renderCanvasWidget;
  ns.updateCanvasItems = updateCanvasItems;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// widgets.js
// ============================================================

(function (ns) {
  "use strict";
  var reliefBorderStyle = ns.reliefBorderStyle;
  var renderTtkWidget = ns.renderTtkWidget;
  var renderLabelFrame = ns.renderLabelFrame;
  var renderListbox = ns.renderListbox;
  var renderPanedWindow = ns.renderPanedWindow;
  var renderScale = ns.renderScale;
  var renderScrollbar = ns.renderScrollbar;
  var renderSpinboxButtons = ns.renderSpinboxButtons;
  var renderTextWidget = ns.renderTextWidget;
  var renderCanvasWidget = ns.renderCanvasWidget;

  /**
   * Відображення базових віджетів tkinter у DOM (Label, Button, Checkbutton, Radiobutton, Menubutton, Entry, Pixels) і диспетчер applyWidgetProps за видом віджета.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  function renderTextLabel(element, props) {
    let textBox = element.querySelector(`:scope > .tk-text`);
    textBox || ((textBox = document.createElement(`div`)), (textBox.className = `tk-text`), element.append(textBox));
    let lines = props.lines ?? [],
      underline = props.underline,
      text = lines.join(`
  `);
    underline >= 0 && underline < text.length
      ? textBox.replaceChildren(
          text.slice(0, underline),
          Object.assign(document.createElement(`u`), {
            textContent: text[underline],
          }),
          text.slice(underline + 1),
        )
      : (textBox.textContent = text);
    let border = props.bd + props.hl;
    Object.assign(textBox.style, {
      left: `${props.tx - border}px`,
      top: `${props.ty - border}px`,
      width: `${props.tw}px`,
      font: props.font,
      lineHeight: `${props.lh}px`,
      color: props.fg,
      textAlign: props.justify,
      textDecoration: props.underline_font ? `underline` : ``,
    });
  }

  function renderImage(element, props) {
    let image = element.querySelector(`:scope > .tk-img`);
    if (!props.img) {
      image?.remove();
      return;
    }
    (image ||
      ((image = document.createElement(`img`)),
      (image.className = `tk-img`),
      (image.draggable = !1),
      (image.alt = ``),
      element.append(image)),
      image.src !== props.img && (image.src = props.img));
    let border = props.bd + props.hl;
    Object.assign(image.style, {
      left: `${props.ix_img - border}px`,
      top: `${props.iy_img - border}px`,
      width: `${props.iw_img}px`,
      height: `${props.ih_img}px`,
    });
  }

  function renderMenubuttonIndicator(element, props) {
    let indicator = element.querySelector(`:scope > .tk-mb-indicator`);
    if (!props.indicator) {
      indicator?.remove();
      return;
    }
    indicator || ((indicator = document.createElement(`div`)), (indicator.className = `tk-mb-indicator`), element.append(indicator));
    let border = props.bd + props.hl;
    Object.assign(indicator.style, {
      width: `${props.iw}px`,
      height: `${props.ih}px`,
      right: `${6 + 0 * border}px`,
      top: `${Math.round((props.h - 2 * border) / 2 - props.ih / 2)}px`,
      ...reliefBorderStyle(`raised`, 2, props.bg),
    });
  }

  function renderToggleIndicator(element, props) {
    let indicator = element.querySelector(`:scope > .tk-indicator`);
    if (!props.indicator) {
      indicator?.remove();
      return;
    }
    indicator || ((indicator = document.createElement(`div`)), (indicator.className = `tk-indicator`), element.append(indicator));
    let border = props.bd + props.hl;
    ((indicator.className = `tk-indicator tk-indicator-${props.kind}`),
      indicator.classList.toggle(`selected`, !!props.selected),
      indicator.classList.toggle(`pressed`, !!props.pressed),
      indicator.classList.toggle(`disabled`, !!props.disabled),
      (indicator.style.left = `${props.ix - border}px`),
      (indicator.style.top = `${props.iy - border}px`),
      indicator.style.setProperty(`--tk-select`, props.selectcolor));
  }

  function renderEntry(element, props, desktop) {
    let input = element.querySelector(`:scope > input`);
    input ||
      ((input = document.createElement(`input`)),
      (input.spellcheck = !1),
      (input.autocomplete = `off`),
      input.addEventListener(`input`, () => sendEntryValue(input, element, desktop, !1)),
      input.addEventListener(`select`, () => sendEntryValue(input, element, desktop, !0)),
      input.addEventListener(`focus`, () =>
        desktop.desktop.send({
          t: `focus`,
          app: desktop.app,
          w: element.dataset.tkid,
        }),
      ),
      element.append(input));
    let text = String(props.value ?? ``);
    if (input.dataset.python !== text && ((input.dataset.python = text), input.value !== text)) {
      let isFocused = document.activeElement === input;
      if (((input.value = text), isFocused)) {
        let cursor = Math.min(Number(props.cursor ?? text.length), text.length);
        input.setSelectionRange(cursor, cursor);
      }
    }
    ((input.type = props.show ? `password` : `text`),
      (input.disabled = props.state === `disabled`),
      (input.readOnly = props.state === `readonly`),
      Object.assign(input.style, {
        font: props.font,
        color: props.fg,
        background: props.bg,
        textAlign: props.justify,
        padding: `0 ${props.pad}px`,
        caretColor: props.insertcolor,
      }),
      input.style.setProperty(`--tk-selectbg`, props.selectbg),
      input.style.setProperty(`--tk-selectfg`, props.selectfg));
  }

  function sendEntryValue(input, selectionOnly, desktop, element) {
    desktop.desktop.send({
      t: `entry`,
      app: desktop.app,
      w: selectionOnly.dataset.tkid,
      ...(element
        ? {
            selonly: 1,
          }
        : {}),
      value: input.value,
      cursor: input.selectionEnd ?? input.value.length,
      sel: [input.selectionStart ?? 0, input.selectionEnd ?? 0],
    });
  }

  function ensurePixelsCanvas(element) {
    let canvas = element.querySelector(`canvas`);
    return (
      canvas || ((canvas = document.createElement(`canvas`)), (canvas.className = `tk-pixels-canvas`), element.append(canvas)),
      canvas
    );
  }

  function applyWidgetProps(element, props, desktop) {
    let highlight = props.hl ?? 0;
    switch (
      (Object.assign(element.style, {
        left: `${props.x + highlight}px`,
        top: `${props.y + highlight}px`,
        width: `${Math.max(0, props.w - 2 * highlight)}px`,
        height: `${Math.max(0, props.h - 2 * highlight)}px`,
        background: props.bg,
      }),
      Object.assign(element.style, reliefBorderStyle(props.relief, props.bd, props.bg, highlight)),
      (element.style.clipPath = props.clip
        ? `inset(${Math.max(0, props.clip[1])}px ${Math.max(0, Math.max(0, props.w - 2 * highlight) - props.clip[2])}px ${Math.max(0, Math.max(0, props.h - 2 * highlight) - props.clip[3])}px ${Math.max(0, props.clip[0])}px)`
        : ``),
      (element.dataset.hl = String(highlight)),
      props.kind)
    ) {
      case `label`:
      case `button`:
        (renderTextLabel(element, props), renderImage(element, props));
        break;
      case `menubutton`:
        (renderTextLabel(element, props), renderImage(element, props), renderMenubuttonIndicator(element, props));
        break;
      case `check`:
      case `radio`:
        (renderTextLabel(element, props), renderImage(element, props), renderToggleIndicator(element, props));
        break;
      case `entry`:
        renderEntry(element, props, desktop);
        break;
      case `pixels`:
        ensurePixelsCanvas(element);
        break;
      case `spinbox`:
        (renderEntry(element, props, desktop), renderSpinboxButtons(element, props, desktop));
        break;
      case `labelframe`:
        renderLabelFrame(element, props);
        break;
      case `paned`:
        renderPanedWindow(element, props);
        break;
      case `listbox`:
        renderListbox(element, props);
        break;
      case `scrollbar`:
        renderScrollbar(element, props, desktop);
        break;
      case `scale`:
        renderScale(element, props, desktop);
        break;
      case `text`:
        renderTextWidget(element, props, desktop);
        break;
      case `canvas`:
        renderCanvasWidget(element, props);
        break;
      case `ttk`:
        renderTtkWidget(element, props, desktop, (element2, props2) => renderEntry(element2, props2, desktop));
    }
  }

  ns.ensurePixelsCanvas = ensurePixelsCanvas;
  ns.applyWidgetProps = applyWidgetProps;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// color-chooser.js
// ============================================================

(function (ns) {
  "use strict";
  var translate = ns.translate;
  var createDialogFrame = ns.createDialogFrame;
  var createMessageButton = ns.createMessageButton;
  var createElementWithClass = ns.createElementWithClass;

  /**
   * Діалог вибору кольору tkinter.colorchooser (палітра, спектр, HSL, RGB).
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const BASIC_COLORS =
    `#ff8080.#ffff80.#80ff80.#00ff80.#80ffff.#0080ff.#ff80c0.#ff80ff.#ff0000.#ffff00.#80ff00.#00ff40.#00ffff.#0080c0.#8080c0.#ff00ff.#804040.#ff8040.#00ff00.#008080.#004080.#8080ff.#800040.#ff0080.#800000.#ff8000.#008000.#008040.#0000ff.#0000a0.#800080.#8000ff.#400000.#804000.#004000.#004040.#000080.#000040.#400040.#400080.#000000.#808000.#808040.#808080.#408080.#c0c0c0.#400040.#ffffff`.split(
      `.`,
    );

  const HSL_SCALE = 240;

  const SPECTRUM_WIDTH = 175;

  const SPECTRUM_HEIGHT = 187;

  const customColors = Array(16).fill(`#ffffff`);

  let lastChosenColor = `#000000`;

  function hexToRgb(hex) {
    return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  }

  function rgbToHex([red, blue, green]) {
    return `#${[red, blue, green].map((channel) => Math.round(channel).toString(16).padStart(2, `0`)).join(``)}`;
  }

  function cssColorToHex(color) {
    let context = document.createElement(`canvas`).getContext(`2d`);
    if (!context || !color) return null;
    ((context.fillStyle = `#010203`), (context.fillStyle = color));
    let normalized = String(context.fillStyle);
    if (normalized === `#010203` && color.toLowerCase() !== `#010203`) return null;
    if (normalized.startsWith(`#`)) return normalized;
    let channels = normalized.match(/\d+(\.\d+)?/g);
    return channels ? rgbToHex(channels.slice(0, 3).map(Number)) : null;
  }

  function rgbToHsl([red, blue, green]) {
    let [red2, green2, blue2] = [red / 255, blue / 255, green / 255],
      max = Math.max(red2, green2, blue2),
      min = Math.min(red2, green2, blue2),
      chroma = (max + min) / 2;
    if (max === min) return [160, Math.round(chroma * HSL_SCALE), 0];
    let lightness = max - min,
      saturation = chroma <= 0.5 ? lightness / (max + min) : lightness / (2 - max - min),
      hue = max === red2 ? (green2 - blue2) / lightness : max === green2 ? 2 + (blue2 - red2) / lightness : 4 + (red2 - green2) / lightness;
    return (
      (hue = (hue / 6 + 1) % 1),
      [Math.round(hue * HSL_SCALE) % HSL_SCALE, Math.round(chroma * HSL_SCALE), Math.round(saturation * HSL_SCALE)]
    );
  }

  function hslToRgb(hue, lightness, saturation) {
    let hue2 = hue / HSL_SCALE,
      saturation2 = lightness / HSL_SCALE,
      lightness2 = saturation / HSL_SCALE;
    if (lightness2 === 0) return [saturation2 * 255, saturation2 * 255, saturation2 * 255];
    let chroma = saturation2 < 0.5 ? saturation2 * (1 + lightness2) : saturation2 + lightness2 - saturation2 * lightness2,
      second = 2 * saturation2 - chroma,
      hueToRgb = (hue3) => {
        let hue4 = (hue3 + 1) % 1;
        return hue4 < 1 / 6
          ? second + (chroma - second) * 6 * hue4
          : hue4 < 1 / 2
            ? chroma
            : hue4 < 2 / 3
              ? second + (chroma - second) * (2 / 3 - hue4) * 6
              : second;
      };
    return [hueToRgb(hue2 + 1 / 3) * 255, hueToRgb(hue2) * 255, hueToRgb(hue2 - 1 / 3) * 255].map(Math.round);
  }

  function showColorChooser(parent, options, anchorRect, onResult) {
    let rgb = hexToRgb(cssColorToHex(options.initial) ?? lastChosenColor),
      [hue, saturation, lightness] = rgbToHsl(rgb),
      selectedSlot = 0,
      close = (color) => {
        (dialog.close(), color && (lastChosenColor = color), onResult(color));
      },
      dialog = createDialogFrame(parent, options.title || translate(`color.title`), `tk-colorbox`, () => close(``)),
      leftColumn = createElementWithClass(`div`, `tk-color-left`),
      basicGrid = createElementWithClass(`div`, `tk-color-grid`),
      customGrid = createElementWithClass(`div`, `tk-color-grid`),
      swatch = (color, onClick) => {
        let swatch2 = createElementWithClass(`button`, `tk-color-swatch`);
        return (
          (swatch2.type = `button`),
          (swatch2.style.background = color),
          (swatch2.dataset.color = color),
          swatch2.addEventListener(`click`, onClick),
          swatch2
        );
      };
    for (let color of BASIC_COLORS) basicGrid.append(swatch(color, () => setColor(hexToRgb(color))));
    let refreshCustom = () => {
      customGrid.replaceChildren(
        ...customColors.map((color, slotIndex) => {
          let swatch2 = swatch(color, () => {
            ((selectedSlot = slotIndex), setColor(hexToRgb(color)));
          });
          return (swatch2.classList.toggle(`slot`, slotIndex === selectedSlot), swatch2);
        }),
      );
    };
    refreshCustom();
    let defineButton = createMessageButton(translate(`color.define`), () => void 0);
    ((defineButton.disabled = !0),
      leftColumn.append(
        createElementWithClass(`div`, `tk-color-label`, translate(`color.basic`)),
        basicGrid,
        createElementWithClass(`div`, `tk-color-label`, translate(`color.custom`)),
        customGrid,
        defineButton,
      ));
    let rightColumn = createElementWithClass(`div`, `tk-color-right`),
      picker = createElementWithClass(`div`, `tk-color-picker`),
      spectrumCanvas = document.createElement(`canvas`);
    ((spectrumCanvas.className = `tk-color-spectrum`), (spectrumCanvas.width = SPECTRUM_WIDTH), (spectrumCanvas.height = SPECTRUM_HEIGHT));
    let crosshair = createElementWithClass(`div`, `tk-color-cross`),
      spectrumBox = createElementWithClass(`div`, `tk-color-spectrum-box`);
    spectrumBox.append(spectrumCanvas, crosshair);
    let luminanceCanvas = document.createElement(`canvas`);
    ((luminanceCanvas.className = `tk-color-lum`), (luminanceCanvas.width = 1), (luminanceCanvas.height = SPECTRUM_HEIGHT));
    let luminanceArrow = createElementWithClass(`div`, `tk-color-arrow`),
      luminanceBox = createElementWithClass(`div`, `tk-color-lum-box`);
    (luminanceBox.append(luminanceCanvas, luminanceArrow), picker.append(spectrumBox, luminanceBox));
    let preview = createElementWithClass(`div`, `tk-color-preview`),
      previewLabel = createElementWithClass(`div`, `tk-color-preview-label`, translate(`color.solid`)),
      fieldInputs = {},
      fieldsBox = createElementWithClass(`div`, `tk-color-fields`),
      addField = (field, max, label) => {
        let input = document.createElement(`input`);
        ((input.className = `tk-color-field`),
          (input.inputMode = `numeric`),
          (input.maxLength = 3),
          (input.dataset.field = field),
          (input.dataset.max = String(label)),
          input.addEventListener(`input`, () => fieldChanged(field)),
          (fieldInputs[field] = input));
        let row = createElementWithClass(`label`, `tk-color-row`);
        (row.append(createElementWithClass(`span`, ``, max), input), fieldsBox.append(row));
      };
    (addField(`hue`, translate(`color.hue`), 239),
      addField(`red`, translate(`color.red`), 255),
      addField(`sat`, translate(`color.sat`), HSL_SCALE),
      addField(`green`, translate(`color.green`), 255),
      addField(`lum`, translate(`color.lum`), HSL_SCALE),
      addField(`blue`, translate(`color.blue`), 255));
    let previewRow = createElementWithClass(`div`, `tk-color-preview-row`);
    (previewRow.append(createElementWithClass(`div`, `tk-color-preview-box`), fieldsBox),
      previewRow.firstElementChild.append(preview, previewLabel));
    let addButton = createMessageButton(translate(`color.add`), () => {
      ((customColors[selectedSlot] = rgbToHex(rgb)), (selectedSlot = (selectedSlot + 1) % customColors.length), refreshCustom());
    });
    rightColumn.append(picker, previewRow, addButton);
    let columns = createElementWithClass(`div`, `tk-color-columns`);
    columns.append(leftColumn, rightColumn);
    let okButton = createMessageButton(`OK`, () => close(rgbToHex(rgb)), `default`),
      cancelButton = createMessageButton(translate(`dialog.cancel`), () => close(``)),
      buttonsBox = createElementWithClass(`div`, `tk-msgbox-buttons tk-color-buttons`);
    (buttonsBox.append(okButton, cancelButton), dialog.body.append(columns, buttonsBox));
    let drawSpectrum = () => {
        let context = spectrumCanvas.getContext(`2d`);
        if (!context) return;
        let imageData = context.createImageData(SPECTRUM_WIDTH, SPECTRUM_HEIGHT);
        for (let y2 = 0; y2 < SPECTRUM_HEIGHT; y2++) {
          let lum = HSL_SCALE - (y2 * HSL_SCALE) / 186;
          for (let x2 = 0; x2 < SPECTRUM_WIDTH; x2++) {
            let [red, green, blue] = hslToRgb((x2 * 239) / 174, HSL_SCALE / 2, lum),
              offset = (y2 * SPECTRUM_WIDTH + x2) * 4;
            ((imageData.data[offset] = red), (imageData.data[offset + 1] = green), (imageData.data[offset + 2] = blue), (imageData.data[offset + 3] = 255));
          }
        }
        context.putImageData(imageData, 0, 0);
      },
      drawLuminance = () => {
        let context = luminanceCanvas.getContext(`2d`);
        if (context)
          for (let y2 = 0; y2 < SPECTRUM_HEIGHT; y2++)
            ((context.fillStyle = rgbToHex(hslToRgb(hue, HSL_SCALE - (y2 * HSL_SCALE) / 186, lightness))),
              context.fillRect(0, y2, 1, 1));
      },
      refresh = (field) => {
        let hex = rgbToHex(rgb);
        ((preview.style.background = hex),
          (crosshair.style.left = `${Math.round((hue * 174) / 239)}px`),
          (crosshair.style.top = `${Math.round(((HSL_SCALE - lightness) * 186) / HSL_SCALE)}px`),
          (luminanceArrow.style.top = `${Math.round(((HSL_SCALE - saturation) * 186) / HSL_SCALE)}px`));
        let values = {
          hue: hue,
          sat: lightness,
          lum: saturation,
          red: rgb[0],
          green: rgb[1],
          blue: rgb[2],
        };
        for (let [field2, value] of Object.entries(fieldInputs)) field2 !== field && (value.value = String(values[field2]));
        for (let swatch2 of leftColumn.querySelectorAll(`.tk-color-swatch`))
          swatch2.classList.toggle(`selected`, swatch2.dataset.color === hex && swatch2.parentElement === basicGrid);
        drawLuminance();
      },
      setColor = (rgb2, field) => {
        ((rgb = rgb2), ([hue, saturation, lightness] = rgbToHsl(rgb)), refresh(field));
      },
      setHsl = (hue2, field, saturation2, lightness2) => {
        (([hue, saturation, lightness] = [hue2, field, saturation2]), (rgb = hslToRgb(hue, saturation, lightness)), refresh(lightness2));
      },
      fieldChanged = (field) => {
        let input = (field2) => {
          let input2 = fieldInputs[field2];
          return Math.min(Number(input2.dataset.max), Math.max(0, parseInt(input2.value, 10) || 0));
        };
        field === `red` || field === `green` || field === `blue`
          ? setColor([input(`red`), input(`green`), input(`blue`)], field)
          : setHsl(input(`hue`), input(`lum`), input(`sat`), field);
      },
      bindDrag = (element, onPick) => {
        element.addEventListener(`pointerdown`, (event) => {
          (event.preventDefault(), element.setPointerCapture(event.pointerId));
          let rect = (event2) => {
            let rect2 = element.getBoundingClientRect(),
              scale = rect2.height / SPECTRUM_HEIGHT || 1;
            onPick(
              Math.max(0, Math.min(174, (event2.clientX - rect2.left) / scale)),
              Math.max(0, Math.min(186, (event2.clientY - rect2.top) / scale)),
            );
          };
          rect(event);
          let stop = () => {
            (element.removeEventListener(`pointermove`, rect), element.removeEventListener(`pointerup`, stop));
          };
          (element.addEventListener(`pointermove`, rect), element.addEventListener(`pointerup`, stop));
        });
      };
    (bindDrag(spectrumBox, (x2, y2) => {
      let lum = saturation === 0 || saturation === HSL_SCALE ? HSL_SCALE / 2 : saturation;
      setHsl(Math.round((x2 * 239) / 174), lum, Math.round(HSL_SCALE - (y2 * HSL_SCALE) / 186));
    }),
      bindDrag(luminanceBox, (x2, y2) => setHsl(hue, Math.round(HSL_SCALE - (y2 * HSL_SCALE) / 186), lightness)),
      dialog.dialog.addEventListener(`keydown`, (event) => {
        event.key === `Escape`
          ? close(``)
          : event.key === `Enter` &&
            (event.preventDefault(), document.activeElement === cancelButton ? close(``) : close(rgbToHex(rgb)));
      }),
      drawSpectrum(),
      refresh(),
      dialog.show(anchorRect, okButton));
  }

  ns.showColorChooser = showColorChooser;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// file-dialog.js
// ============================================================

(function (ns) {
  "use strict";
  var icon = ns.icon;
  var translate = ns.translate;
  var createDialogFrame = ns.createDialogFrame;
  var createMessageButton = ns.createMessageButton;
  var showSimpleMessage = ns.showSimpleMessage;
  var createElementWithClass = ns.createElementWithClass;

  /**
   * Діалоги відкриття/збереження файлів і вибору теки tkinter.filedialog над віртуальною файловою системою.
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  function validateFileName(name) {
    return name.trim()
      ? /[/\\:*?"<>|\u0000-\u001f]/.test(name) || name === `.` || name === `..`
        ? `chars`
        : name.startsWith(`.`) || name === `__pycache__`
          ? `hidden`
          : null
      : `empty`;
  }

  function formatFileSize(size) {
    return size < 1024
      ? `${size} B`
      : size < 1048576
        ? `${(size / 1024).toFixed(+(size < 10240))} KB`
        : `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function pickFilesFromComputer() {
    return new Promise((resolve) => {
      let input = document.createElement(`input`);
      ((input.type = `file`),
        (input.multiple = !0),
        input.addEventListener(`change`, () => resolve([...(input.files ?? [])])),
        input.addEventListener(`cancel`, () => resolve([])),
        input.click());
    });
  }

  function parentDir(path) {
    let trimmed = path.endsWith(`/`) ? path.slice(0, -1) : path;
    return trimmed.slice(0, trimmed.lastIndexOf(`/`) + 1);
  }

  function baseName(path) {
    let trimmed = path.endsWith(`/`) ? path.slice(0, -1) : path;
    return trimmed.slice(trimmed.lastIndexOf(`/`) + 1);
  }

  function matchesFileTypes(name, patterns) {
    return patterns.some((pattern) => {
      if (pattern === `*` || pattern === `*.*` || pattern === ``) return !0;
      let suffix = pattern.replace(/^\*/, ``).toLowerCase();
      return name.toLowerCase().endsWith(suffix);
    });
  }

  function defaultExtension(patterns) {
    let extension = patterns?.find((pattern) => /^\*?\.[^*?]+$/.test(pattern));
    return extension ? extension.replace(/^\*/, ``) : ``;
  }

  function parseTclStringList(text) {
    let items = [...text.matchAll(/"([^"]+)"/g)].map((matches) => matches[1]);
    return items.length ? items : text.trim() ? [text.trim()] : [];
  }

  function showFileDialog(parent, options, anchorRect, onResult, onUpload) {
    let sizes = new Map(options.entries.map((path) => [path.path, path.size])),
      uploads = [],
      currentDir = options.dir && sizes.has(options.dir) ? options.dir : ``,
      selected = new Set(),
      lastSelected = null,
      types = options.types.length ? options.types : [],
      typeIndex = Math.min(options.type, Math.max(types.length - 1, 0)),
      titles = {
        open: translate(`dialog.open`),
        save: translate(`dialog.saveAs`),
        dir: translate(`dialog.chooseFolder`),
      },
      closeDialog = (paths) => {
        (dialog.close(),
          setTimeout(() => uploads.forEach((upload) => URL.revokeObjectURL(upload.url)), 6e4),
          paths === null && uploads.length === 0
            ? onUpload(null)
            : onUpload({
                paths: paths ?? [],
                type: types[typeIndex]?.[0],
                uploads: uploads,
              }));
      },
      dialog = createDialogFrame(parent, options.title || titles[options.kind], `tk-filebox tk-filebox-${options.kind}`, () =>
        closeDialog(null),
      ),
      crumbs = createElementWithClass(`div`, `tk-file-address`),
      upButton = document.createElement(`button`);
    ((upButton.type = `button`),
      (upButton.className = `tk-file-up`),
      (upButton.title = `..`),
      upButton.append(icon(`up`)),
      upButton.addEventListener(`click`, () => changeDir(parentDir(currentDir))));
    let crumbs2 = createElementWithClass(`div`, `tk-file-crumbs`);
    crumbs.append(upButton, crumbs2);
    let list = createElementWithClass(`div`, `tk-file-list`);
    list.tabIndex = 0;
    let header = createElementWithClass(`div`, `tk-file-row tk-file-header`);
    header.append(
      createElementWithClass(`span`, `tk-file-name`, translate(`dialog.name`)),
      createElementWithClass(`span`, `tk-file-size`, translate(`dialog.size`)),
    );
    let rowsBox = createElementWithClass(`div`, `tk-file-rows`),
      emptyBox = createElementWithClass(`div`, `tk-file-empty`);
    list.append(header, rowsBox, emptyBox);
    let bottom = createElementWithClass(`div`, `tk-file-bottom`),
      nameLabel = createElementWithClass(
        `label`,
        `tk-file-label`,
        options.kind === `dir` ? translate(`dialog.folderName`) : translate(`dialog.fileName`),
      ),
      nameInput = document.createElement(`input`);
    ((nameInput.className = `tk-file-input`),
      (nameInput.value = options.kind === `dir` ? `` : options.name),
      (nameInput.spellcheck = !1),
      nameLabel.append(nameInput));
    let typeSelect = document.createElement(`select`);
    ((typeSelect.className = `tk-file-type`),
      types.forEach(([label, label2], patterns) => {
        let option = document.createElement(`option`);
        ((option.value = String(patterns)), (option.textContent = `${label} (${label2.join(`;`)})`), typeSelect.append(option));
      }),
      (typeSelect.value = String(typeIndex)),
      (typeSelect.hidden = types.length === 0 || options.kind === `dir`),
      typeSelect.addEventListener(`change`, () => {
        ((typeIndex = Number(typeSelect.value)), renderList());
      }));
    let fields = createElementWithClass(`div`, `tk-file-fields`);
    fields.append(nameLabel, typeSelect);
    let uploadButton = createMessageButton(
      translate(`dialog.upload`),
      () => void pickFilesFromComputer().then(uploadFiles),
      `tk-file-upload`,
    );
    uploadButton.hidden = options.kind === `save`;
    let okButton = createMessageButton(
        options.kind === `open`
          ? translate(`dialog.open`)
          : options.kind === `save`
            ? translate(`dialog.save`)
            : translate(`dialog.chooseFolder`),
        () => void accept(),
        `default`,
      ),
      cancelButton = createMessageButton(translate(`dialog.cancel`), () => closeDialog(null)),
      buttonsBox = createElementWithClass(`div`, `tk-msgbox-buttons tk-file-buttons`);
    (buttonsBox.append(uploadButton, createElementWithClass(`span`, `tk-file-spacer`), okButton, cancelButton),
      bottom.append(fields),
      options.kind === `save` &&
        bottom.append(createElementWithClass(`div`, `tk-file-hint`, translate(`dialog.saveHint`))),
      dialog.body.append(crumbs, list, bottom, buttonsBox));
    function listEntries() {
      let patterns = types[typeIndex]?.[1];
      return [...sizes.keys()]
        .filter((path) => path !== currentDir && parentDir(path) === currentDir)
        .filter((suffix) => suffix.endsWith(`/`) || (options.kind !== `dir` && (!patterns || matchesFileTypes(suffix, patterns))))
        .sort(
          (path, suffix) =>
            Number(suffix.endsWith(`/`)) - Number(path.endsWith(`/`)) ||
            baseName(path).localeCompare(baseName(suffix)),
        );
    }
    function renderList() {
      let crumbs3 = [],
        rootCrumb = createElementWithClass(`button`, `tk-file-crumb`, translate(`files.root`));
      (rootCrumb.addEventListener(`click`, () => changeDir(``)), crumbs3.push(rootCrumb));
      let prefix = ``;
      for (let part of currentDir.split(`/`).filter(Boolean)) {
        prefix += `${part}/`;
        let entries2 = prefix,
          crumb = createElementWithClass(`button`, `tk-file-crumb`, part);
        (crumb.addEventListener(`click`, () => changeDir(entries2)),
          crumbs3.push(createElementWithClass(`span`, `tk-file-crumb-sep`, `›`), crumb));
      }
      (crumbs2.replaceChildren(...crumbs3), (upButton.disabled = currentDir === ``));
      let entries = listEntries();
      (rowsBox.replaceChildren(
        ...entries.map((path) => {
          let row = createElementWithClass(`div`, `tk-file-row`);
          ((row.dataset.path = path), row.classList.toggle(`selected`, selected.has(path)));
          let nameCell = createElementWithClass(`span`, `tk-file-name`);
          return (
            nameCell.append(icon(path.endsWith(`/`) ? `folder` : `file`), baseName(path)),
            row.append(
              nameCell,
              createElementWithClass(
                `span`,
                `tk-file-size`,
                path.endsWith(`/`) ? `` : formatFileSize(sizes.get(path) ?? 0),
              ),
            ),
            row.addEventListener(`click`, (event) => selectPath(path, event)),
            row.addEventListener(`dblclick`, () => {
              path.endsWith(`/`) ? changeDir(path) : accept([path]);
            }),
            row
          );
        }),
      ),
        (emptyBox.textContent = entries.length ? `` : translate(`dialog.empty`)));
    }
    function changeDir(dir) {
      ((currentDir = dir), (selected = new Set()), (lastSelected = null), options.kind === `dir` && (nameInput.value = ``), renderList());
    }
    function selectPath(path, event) {
      let entries = listEntries();
      if (options.multiple && event?.shiftKey && lastSelected && entries.includes(lastSelected)) {
        let [firstIndex, last] = [entries.indexOf(lastSelected), entries.indexOf(path)].sort((first, secondIndex) => first - secondIndex);
        selected = new Set(entries.slice(firstIndex, last + 1).filter((path2) => !path2.endsWith(`/`)));
      } else
        options.multiple && (event?.ctrlKey || event?.metaKey)
          ? (selected.has(path) ? selected.delete(path) : selected.add(path), (lastSelected = path))
          : ((selected = new Set([path])), (lastSelected = path));
      let selected2 = [...selected].filter((path2) => !path2.endsWith(`/`));
      options.kind === `dir`
        ? (nameInput.value = path.endsWith(`/`) ? baseName(path) : ``)
        : selected2.length === 1
          ? (nameInput.value = baseName(selected2[0]))
          : selected2.length > 1 && (nameInput.value = selected2.map((path2) => `"${baseName(path2)}"`).join(` `));
      for (let row of rowsBox.querySelectorAll(`.tk-file-row`))
        row.classList.toggle(`selected`, selected.has(row.dataset.path));
      rowsBox.querySelector(`.tk-file-row[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({
        block: `nearest`,
      });
    }
    async function uploadFiles(files) {
      let uploaded = [];
      for (let file of files) {
        let problem = validateFileName(file.name);
        if (problem) {
          await showSimpleMessage(
            parent,
            dialog.dialog.getBoundingClientRect(),
            translate(`files.title`),
            translate(`files.bad.${problem}`, {
              name: file.name,
            }),
            `error`,
            [`ok`],
          );
          continue;
        }
        let path = currentDir + file.name,
          bytes = new Uint8Array(await file.arrayBuffer());
        (onResult(path, bytes),
          sizes.set(path, bytes.length),
          uploads.push({
            path: path,
            url: URL.createObjectURL(new Blob([bytes])),
          }),
          uploaded.push(path));
      }
      if (uploaded.length === 0) return;
      if (types.length && !uploaded.every((paths) => matchesFileTypes(paths, types[typeIndex][1]))) {
        let index = types.findIndex(([, patterns]) => patterns.some((patterns2) => patterns2 === `*` || patterns2 === `*.*`));
        index >= 0 && (typeSelect.value = String((typeIndex = index)));
      }
      let lastPath = uploaded[uploaded.length - 1];
      (options.kind === `open` &&
        ((selected = new Set(options.multiple ? uploaded : [lastPath])),
        (lastSelected = lastPath),
        (nameInput.value = selected.size > 1 ? uploaded.map((paths) => `"${baseName(paths)}"`).join(` `) : baseName(lastPath))),
        renderList(),
        nameInput.focus());
    }
    async function accept(paths) {
      let dialogRect = dialog.dialog.getBoundingClientRect();
      if (options.kind === `dir`) {
        let folderName = nameInput.value.trim(),
          name2 = folderName ? `${currentDir}${folderName}/` : currentDir;
        if (folderName && !sizes.has(name2)) {
          await showSimpleMessage(
            parent,
            dialogRect,
            titles.dir,
            translate(`dialog.notFound`, {
              name: folderName,
            }),
            `warning`,
            [`ok`],
          );
          return;
        }
        closeDialog([name2]);
        return;
      }
      let names = paths ? paths.map(baseName) : parseTclStringList(nameInput.value);
      if (names.length === 0) return;
      if (names.length === 1 && sizes.has(`${currentDir}${names[0]}/`)) {
        (changeDir(`${currentDir}${names[0]}/`), (nameInput.value = ``));
        return;
      }
      if (options.kind === `open`) {
        let missing = names.find((name2) => !sizes.has(currentDir + name2));
        if (missing) {
          await showSimpleMessage(
            parent,
            dialogRect,
            titles.open,
            translate(`dialog.notFound`, {
              name: missing,
            }),
            `warning`,
            [`ok`],
          );
          return;
        }
        closeDialog(names.map((name2) => currentDir + name2));
        return;
      }
      let name = names[0],
        problem = validateFileName(name);
      if (problem)
        await showSimpleMessage(
          parent,
          dialogRect,
          titles.save,
          translate(`files.bad.${problem}`, {
            name: name,
          }),
          `error`,
          [`ok`],
        );
      else {
        if (!name.includes(`.`)) {
          let extension = defaultExtension(types[typeIndex]?.[1]) || options.defaultext;
          extension && (name += extension.startsWith(`.`) ? extension : `.${extension}`);
        }
        (options.confirm &&
          sizes.has(currentDir + name) &&
          (await showSimpleMessage(
            parent,
            dialogRect,
            translate(`dialog.confirmSave`),
            translate(`dialog.replace`, {
              name: name,
            }),
            `warning`,
            [`yes`, `no`],
          )) !== `yes`) ||
          closeDialog([currentDir + name]);
      }
    }
    if (
      (list.addEventListener(`keydown`, (event) => {
        let index = listEntries(),
          entries = lastSelected ? index.indexOf(lastSelected) : -1;
        if (event.key === `ArrowDown` || event.key === `ArrowUp`) {
          event.preventDefault();
          let path = index[Math.max(0, Math.min(index.length - 1, entries + (event.key === `ArrowDown` ? 1 : -1)))];
          path && selectPath(path);
        } else
          event.key === `Backspace`
            ? changeDir(parentDir(currentDir))
            : event.key === `Enter` &&
              lastSelected?.endsWith(`/`) &&
              (event.preventDefault(), event.stopPropagation(), changeDir(lastSelected));
      }),
      dialog.dialog.addEventListener(`keydown`, (event) => {
        event.key === `Escape`
          ? closeDialog(null)
          : event.key === `Enter` &&
            !(event.target instanceof HTMLButtonElement) &&
            !(event.target instanceof HTMLSelectElement) &&
            (event.preventDefault(), accept());
      }),
      list.addEventListener(`dragover`, (event) => {
        options.kind !== `save` &&
          event.dataTransfer?.types.includes(`Files`) &&
          (event.preventDefault(), (event.dataTransfer.dropEffect = `copy`));
      }),
      list.addEventListener(`drop`, (event) => {
        options.kind !== `save` &&
          event.dataTransfer?.files.length &&
          (event.preventDefault(), uploadFiles([...event.dataTransfer.files]));
      }),
      renderList(),
      dialog.show(anchorRect, options.kind === `dir` ? list : nameInput),
      options.kind !== `dir` && nameInput.value)
    ) {
      let dotIndex = nameInput.value.lastIndexOf(`.`);
      nameInput.setSelectionRange(0, dotIndex > 0 ? dotIndex : nameInput.value.length);
    }
  }

  ns.showFileDialog = showFileDialog;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// desktop.js
// ============================================================

(function (ns) {
  "use strict";
  var closeAllMenus = ns.closeAllMenus;
  var postMenu = ns.postMenu;
  var renderMenubar = ns.renderMenubar;
  var keyEventToTk = ns.keyEventToTk;
  var keyModifierState = ns.keyModifierState;
  var Gamepad = ns.Gamepad;
  var gamepadKeyEvent = ns.gamepadKeyEvent;
  var isCoarsePointer = ns.isCoarsePointer;
  var handleTextScrollOp = ns.handleTextScrollOp;
  var offsetFromPoint = ns.offsetFromPoint;
  var applyWidgetProps = ns.applyWidgetProps;
  var ensurePixelsCanvas = ns.ensurePixelsCanvas;
  var AudioEngine = ns.AudioEngine;
  var closeComboPopup = ns.closeComboPopup;
  var showComboList = ns.showComboList;
  var updateCanvasItems = ns.updateCanvasItems;
  var showMessageBox = ns.showMessageBox;
  var showColorChooser = ns.showColorChooser;
  var showFileDialog = ns.showFileDialog;

  /**
   * «Робочий стіл» tkinter у браузері: клас TkDesktop (менеджер вікон, панель завдань, обробка пакетів операцій від Python-воркера) і TkWindow (одне вікно Toplevel з рамкою, заголовком, меню, масштабуванням, перетягуванням, подіями миші).
   *
   * Витягнуто з main-CftmujTZ.js (PyThonny).
   */

  const TITLEBAR_HEIGHT = 30;

  const MULTI_CLICK_MS = 500;

  const MAX_CONTENT_SCALE = 2;

  let zIndexCounter = 1;

  let cascadeIndex = 0;

  function captionIcon(path, size = 10) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 10 10" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
  }

  const WINDOW_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 1.5C8 2.5 4.5 6.5 3.5 12l1 .5C6 8.5 9 5 13.5 1.5z" fill="#3a6fb5"/><path d="M13.5 1.5C11 6 8 9.5 4.5 12.5" stroke="#1d3f73" stroke-width=".8" fill="none"/><path d="M3.5 12L2 14.5" stroke="#1d3f73" stroke-width="1.1"/></svg>`;

  class TkWindow {
    desktop;
    app;
    id;
    frame;
    client;
    menubar;
    titleBar;
    titleText;
    maxButton;
    widgets = new Map();
    op;
    x = 0;
    y = 0;
    scale = 1;
    maximized = null;
    userSize = null;
    pressed = null;
    hovered = null;
    lastClick = {
      id: ``,
      time: 0,
      button: 0,
      count: 0,
    };
    pressedItem = {};
    hoveredItem = null;
    gamepad = null;
    constructor(desktop, windowId, appId) {
      ((this.desktop = desktop),
        (this.app = windowId),
        (this.id = appId),
        (this.frame = document.createElement(`div`)),
        (this.frame.className = `tkw`),
        (this.frame.tabIndex = -1),
        (this.frame.dataset.app = String(windowId)),
        (this.frame.dataset.win = appId));
      let titleBar = document.createElement(`div`);
      ((titleBar.className = `tkw-title`), (this.titleBar = titleBar));
      let icon = document.createElement(`span`);
      ((icon.className = `tkw-icon`),
        (icon.innerHTML = WINDOW_ICON_SVG),
        (this.titleText = document.createElement(`span`)),
        (this.titleText.className = `tkw-text`));
      let minimizeButton = this.captionButton(`tkw-min`, captionIcon(`M0 5.5h10`), () => this.minimize());
      this.maxButton = this.captionButton(`tkw-max`, captionIcon(`M.5 .5h9v9h-9z`), () =>
        this.toggleMaximize(),
      );
      let closeButton = this.captionButton(`tkw-close`, captionIcon(`M0 0l10 10M10 0L0 10`), () =>
        this.desktop.send({
          t: `close`,
          app: this.app,
          win: this.id,
        }),
      );
      (titleBar.append(icon, this.titleText, minimizeButton, this.maxButton, closeButton),
        (this.menubar = document.createElement(`div`)),
        (this.menubar.className = `tk-menubar`),
        (this.menubar.hidden = !0),
        (this.client = document.createElement(`div`)),
        (this.client.className = `tkw-client`),
        this.frame.append(titleBar, this.menubar, this.client));
      for (let corner of [`e`, `s`, `se`]) {
        let handle = document.createElement(`div`);
        ((handle.className = `tkw-resize tkw-resize-${corner}`),
          handle.addEventListener(`pointerdown`, (corner2) => this.startResize(corner2, corner)),
          this.frame.append(handle));
      }
      (titleBar.addEventListener(`pointerdown`, (event) => this.startMove(event)),
        titleBar.addEventListener(`dblclick`, (event) => {
          event.target.closest(`.tkw-btn`) || this.toggleMaximize();
        }),
        this.frame.addEventListener(`pointerdown`, () => this.desktop.activate(this), !0),
        this.client.addEventListener(`pointerdown`, (event) => this.onPointerDown(event)),
        this.client.addEventListener(`pointermove`, (event) => this.onPointerMove(event)),
        this.client.addEventListener(`pointerup`, (event) => this.onPointerUp(event)),
        this.client.addEventListener(`pointerleave`, () => this.setHovered(null, 0, 0)),
        this.client.addEventListener(`wheel`, (event) => this.onWheel(event), {
          passive: !1,
        }),
        this.client.addEventListener(`contextmenu`, (event) => event.preventDefault()),
        this.frame.addEventListener(`keydown`, (event) => this.onKey(event, `key`)),
        this.frame.addEventListener(`keyup`, (event) => this.onKey(event, `keyup`)));
    }
    captionButton(className, onClick, iconClass) {
      let button = document.createElement(`button`);
      return (
        (button.type = `button`),
        (button.className = `tkw-btn ${className}`),
        (button.innerHTML = onClick),
        (button.tabIndex = -1),
        button.addEventListener(`pointerdown`, (event) => event.stopPropagation()),
        button.addEventListener(`click`, iconClass),
        button
      );
    }
    applyWindow(props) {
      let firstTime = !this.op,
        sizeChanged =
          !firstTime &&
          (props.w !== this.op.w || props.h !== this.op.h) &&
          (props.w !== this.userSize?.[0] || props.h !== this.userSize[1]);
      if (
        ((this.op = props),
        (this.titleText.textContent = props.title),
        this.frame.style.setProperty(`--tk-bg`, props.bg),
        (this.client.style.background = props.bg),
        (this.client.style.width = `${props.w}px`),
        (this.client.style.height = `${props.h}px`),
        (this.frame.style.opacity = String(props.alpha)),
        this.frame.classList.toggle(`tkw-fixed`, !props.resizable[0] && !props.resizable[1]),
        (this.maxButton.disabled = !props.resizable[0] && !props.resizable[1]),
        (this.frame.hidden = props.state === `withdrawn` || props.state === `iconic`),
        this.updateGamepad(props.gamepad),
        this.frame.classList.toggle(`tkw-has-menubar`, !!props.menubar),
        renderMenubar(this.menubar, props.menubar, (menu, index) =>
          this.desktop.send({
            t: `menu`,
            app: this.app,
            menu: menu,
            index: index,
          }),
        ),
        props.state === `zoomed` && !this.maximized && !this.desktop.compact() && this.toggleMaximize(),
        props.pos)
      ) {
        let needMove = firstTime || sizeChanged || props.pos[0] !== this.x || props.pos[1] !== this.y;
        ((this.x = props.pos[0]), (this.y = props.pos[1]), needMove && this.keepOnScreen(props));
      } else if (firstTime) {
        let area = this.desktop.area(),
          area2 = (cascadeIndex++ % 8) * 26;
        ((this.x = Math.round(area.left + 60 + area2)),
          (this.y = Math.round(area.top + 40 + area2)),
          this.desktop.send({
            t: `configure`,
            app: this.app,
            win: this.id,
            x: this.x,
            y: this.y,
            w: props.w,
            h: props.h,
          }));
      }
      (this.layout(), firstTime && this.desktop.activate(this), this.desktop.updateTaskbar());
    }
    keepOnScreen(props) {
      if (this.desktop.compact()) return;
      let neededWidth = props.w + 2,
        neededHeight = props.h + TITLEBAR_HEIGHT + 2,
        size = document.documentElement,
        maxTop = Math.max(0, Math.min(this.x, size.clientWidth - neededWidth)),
        maxLeft = Math.max(0, Math.min(this.y, size.clientHeight - neededHeight));
      (maxTop !== this.x || maxLeft !== this.y) &&
        ((this.x = maxTop),
        (this.y = maxLeft),
        this.desktop.send({
          t: `configure`,
          app: this.app,
          win: this.id,
          x: maxTop,
          y: maxLeft,
        }));
    }
    updateGamepad(config) {
      let gamepadConfig = config && isCoarsePointer() ? config : null;
      (this.gamepad &&
        JSON.stringify(this.gamepad.keys) !== JSON.stringify(gamepadConfig) &&
        (this.gamepad.releaseAll(), this.gamepad.element.remove(), (this.gamepad = null)),
        gamepadConfig &&
          !this.gamepad &&
          ((this.gamepad = new Gamepad(gamepadConfig, (key, pressed) =>
            this.desktop.send({
              t: pressed ? `key` : `keyup`,
              app: this.app,
              w: this.id,
              ...gamepadKeyEvent(key),
            }),
          )),
          this.frame.append(this.gamepad.element)),
        this.frame.hidden && this.gamepad?.releaseAll());
    }
    place() {
      ((this.frame.style.left = `${this.x}px`), (this.frame.style.top = `${this.y}px`));
    }
    layout() {
      let compact = this.desktop.compact();
      if ((this.frame.classList.toggle(`tkw-mobile`, compact), this.place(), !compact)) {
        (this.gamepad?.element.classList.remove(`tk-gamepad-below`),
          (this.scale = 1),
          (this.client.style.transform = ``),
          (this.client.style.marginLeft = ``));
        return;
      }
      if (this.frame.hidden) return;
      let menubarHeight = this.frame.clientWidth,
        availableHeight =
          this.frame.clientHeight -
          this.titleBar.offsetHeight -
          (this.menubar.hidden ? 0 : this.menubar.offsetHeight),
        titleBarHeight = this.gamepad?.element,
        gamepadBelow = titleBarHeight !== void 0 && menubarHeight < availableHeight;
      (titleBarHeight?.classList.toggle(`tk-gamepad-below`, gamepadBelow), gamepadBelow && (availableHeight -= titleBarHeight.offsetHeight));
      let scale = Math.min(menubarHeight / this.op.w, availableHeight / this.op.h, MAX_CONTENT_SCALE);
      ((this.scale = Number.isFinite(scale) && scale > 0 ? scale : 1),
        (this.client.style.transform = `scale(${this.scale})`),
        (this.client.style.marginLeft = `${Math.max(0, (menubarHeight - this.op.w * this.scale) / 2)}px`));
    }
    setActive(active) {
      (this.frame.classList.toggle(`tkw-active`, active),
        active && (this.frame.style.zIndex = String(++zIndexCounter + (this.op?.topmost ? 1e5 : 0))));
    }
    minimize() {
      ((this.frame.hidden = !0),
        this.gamepad?.releaseAll(),
        this.desktop.send({
          t: `configure`,
          app: this.app,
          win: this.id,
          x: this.x,
          y: this.y,
          state: `iconic`,
        }),
        this.desktop.updateTaskbar());
    }
    restore() {
      ((this.frame.hidden = !1),
        this.desktop.activate(this),
        this.desktop.send({
          t: `configure`,
          app: this.app,
          win: this.id,
          x: this.x,
          y: this.y,
          state: `normal`,
        }),
        this.desktop.updateTaskbar());
    }
    toggleMaximize() {
      if (!this.desktop.compact() && (this.op.resizable[0] !== 0 || this.op.resizable[1] !== 0)) {
        if (this.maximized) {
          let saved = this.maximized;
          ((this.maximized = null), (this.x = saved.x), (this.y = saved.y), this.resizeTo(saved.w, saved.h));
        } else {
          this.maximized = {
            x: this.x,
            y: this.y,
            w: this.op.w,
            h: this.op.h,
          };
          let area = this.desktop.area();
          ((this.x = area.left),
            (this.y = area.top),
            this.resizeTo(area.width - 2, area.height - TITLEBAR_HEIGHT - 2));
        }
        (this.frame.classList.toggle(`tkw-maximized`, this.maximized !== null), this.place());
      }
    }
    resizeTo(width, height) {
      ((width = Math.max(40, Math.round(width))),
        (height = Math.max(1, Math.round(height))),
        (this.userSize = [width, height]),
        (this.client.style.width = `${width}px`),
        (this.client.style.height = `${height}px`),
        this.desktop.send({
          t: `configure`,
          app: this.app,
          win: this.id,
          x: this.x,
          y: this.y,
          w: width,
          h: height,
          resized: !0,
        }));
    }
    startMove(event) {
      if (event.target.closest(`.tkw-btn`) || event.button !== 0 || this.desktop.compact()) return;
      event.preventDefault();
      let offsetX = event.clientX - this.x,
        offsetY = event.clientY - this.y,
        handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      let onMove = (event2) => {
          ((this.x = Math.round(event2.clientX - offsetX)),
            (this.y = Math.round(Math.max(0, event2.clientY - offsetY))),
            this.place());
        },
        onUp = () => {
          (handle.removeEventListener(`pointermove`, onMove),
            handle.removeEventListener(`pointerup`, onUp),
            this.desktop.send({
              t: `configure`,
              app: this.app,
              win: this.id,
              x: this.x,
              y: this.y,
            }));
        };
      (handle.addEventListener(`pointermove`, onMove), handle.addEventListener(`pointerup`, onUp));
    }
    startResize(event, corners) {
      if (event.button !== 0) return;
      (event.preventDefault(), event.stopPropagation());
      let handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      let frame = this.client.offsetWidth,
        startX = this.client.offsetHeight,
        startWidth = event.clientX,
        frame2 = event.clientY,
        onUp = 0,
        startHeight = (event2) => {
          let centerY = corners.includes(`e`) && this.op.resizable[0] ? frame + event2.clientX - startWidth : frame,
            centerX = corners.includes(`s`) && this.op.resizable[1] ? startX + event2.clientY - frame2 : startX;
          (cancelAnimationFrame(onUp), (onUp = requestAnimationFrame(() => this.resizeTo(centerY, centerX))));
        },
        onResize = () => {
          (handle.removeEventListener(`pointermove`, startHeight), handle.removeEventListener(`pointerup`, onResize));
        };
      (handle.addEventListener(`pointermove`, startHeight), handle.addEventListener(`pointerup`, onResize));
    }
    applyWidget(props) {
      let widget = this.widgets.get(props.id);
      if (!widget || props.new) {
        widget?.el.remove();
        let element = document.createElement(`div`);
        ((element.className = `tk tk-${props.kind}`),
          (element.dataset.tkid = props.id),
          (widget = {
            el: element,
            props: {},
          }),
          this.widgets.set(props.id, widget));
      }
      let mergedProps = Object.assign(widget.props, props);
      (widget.el.parentElement !== this.client && this.client.append(widget.el),
        applyWidgetProps(widget.el, mergedProps, this));
    }
    removeWidget(widgetId) {
      (this.widgets.get(widgetId)?.el.remove(),
        this.widgets.delete(widgetId),
        this.hovered === widgetId && (this.hovered = null));
    }
    widgetAt(target) {
      let element = target?.closest(`[data-tkid]`);
      return element && this.client.contains(element)
        ? {
            id: element.dataset.tkid,
            el: element,
          }
        : null;
    }
    coords(event, element) {
      let rect = element.getBoundingClientRect(),
        highlight = Number(element.dataset.hl ?? 0);
      return {
        x: Math.round((event.clientX - rect.left) / this.scale + highlight),
        y: Math.round((event.clientY - rect.top) / this.scale + highlight),
        rx: Math.round(event.clientX),
        ry: Math.round(event.clientY),
        s: keyModifierState(event),
      };
    }
    target(event) {
      return (
        this.widgetAt(event.target) ?? {
          id: this.id,
          el: this.client,
        }
      );
    }
    detail(event, widgetId) {
      let widget = this.widgets.get(widgetId);
      if (!widget) return {};
      if (widget.props.kind === `canvas`) {
        let itemId = event.target.closest?.(`[data-item]`)?.getAttribute(`data-item`);
        return itemId
          ? {
              item: Number(itemId),
            }
          : {};
      }
      if (widget.props.kind === `text`) {
        let editor = widget.el.querySelector(`.tk-text-editor`),
          editor2 = editor ? offsetFromPoint(editor, event.clientX, event.clientY) : void 0;
        return editor2 === void 0
          ? {}
          : {
              offset: editor2,
            };
      }
      return {};
    }
    onPointerDown(event) {
      let target = this.target(event),
        target2 = !!event.target.closest(`input, .tk-text-editor`);
      target2 ||
        (event.preventDefault(),
        this.frame.focus({
          preventScroll: !0,
        }));
      let button = event.button === 1 ? 2 : event.button === 2 ? 3 : 1,
        time = performance.now(),
        clickCount =
          this.lastClick.id === target.id &&
          this.lastClick.button === button &&
          time - this.lastClick.time < MULTI_CLICK_MS
            ? this.lastClick.count + 1
            : 1;
      ((this.lastClick = {
        id: target.id,
        time: time,
        button: button,
        count: clickCount,
      }),
        target2 || event.currentTarget.setPointerCapture(event.pointerId),
        (this.pressed = {
          id: target.id,
          el: target.el,
          button: button,
          inside: !0,
        }),
        (this.pressedItem = this.detail(event, target.id)),
        this.desktop.send({
          t: `press`,
          app: this.app,
          w: target.id,
          b: button,
          n: clickCount,
          ...this.coords(event, target.el),
          ...this.pressedItem,
        }));
    }
    onPointerMove(event) {
      if (this.pressed) {
        let pressed = this.pressed,
          rect = pressed.el.getBoundingClientRect(),
          inside =
            event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom;
        (inside !== pressed.inside &&
          ((pressed.inside = inside),
          this.desktop.send({
            t: inside ? `enter` : `leave`,
            app: this.app,
            w: pressed.id,
            ...this.coords(event, pressed.el),
          })),
          (this.wantsMotion(pressed.id) || this.itemsBound(pressed.id)) &&
            this.desktop.sendMotion({
              t: `motion`,
              app: this.app,
              w: pressed.id,
              ...this.coords(event, pressed.el),
              ...this.pressedItem,
              s: keyModifierState(event) | (256 << (pressed.button - 1)),
            }));
        return;
      }
      let target = this.target(event);
      (this.setHovered(target.id, event.clientX, event.clientY, event),
        this.updateHoveredItem(event, target.id, target.el),
        (this.wantsMotion(target.id) || this.itemsBound(target.id)) &&
          this.desktop.sendMotion({
            t: `motion`,
            app: this.app,
            w: target.id,
            ...this.coords(event, target.el),
            ...this.detail(event, target.id),
          }));
    }
    itemsBound(widgetId) {
      return !!this.widgets.get(widgetId)?.props.items_bound;
    }
    updateHoveredItem(event, element, widgetId) {
      let itemId = this.itemsBound(element) ? this.detail(event, element).item : void 0,
        hoveredItem = this.hoveredItem;
      (hoveredItem &&
        (hoveredItem.id !== element || hoveredItem.item !== itemId) &&
        (this.desktop.send({
          t: `leave`,
          app: this.app,
          w: hoveredItem.id,
          item: hoveredItem.item,
          itemonly: 1,
          ...this.coords(event, widgetId),
        }),
        (this.hoveredItem = null)),
        itemId !== void 0 &&
          (!hoveredItem || hoveredItem.id !== element || hoveredItem.item !== itemId) &&
          ((this.hoveredItem = {
            id: element,
            item: itemId,
          }),
          this.desktop.send({
            t: `enter`,
            app: this.app,
            w: element,
            item: itemId,
            itemonly: 1,
            ...this.coords(event, widgetId),
          })));
    }
    wantsMotion(widgetId) {
      return widgetId === this.id ? !!this.op?.motion : !!this.widgets.get(widgetId)?.props.motion;
    }
    setHovered(widgetId, event, x, y) {
      if (!(widgetId === this.hovered || this.pressed)) {
        if (this.hovered) {
          let widget = this.widgets.get(this.hovered);
          this.desktop.send({
            t: `leave`,
            app: this.app,
            w: this.hovered,
            ...(y && widget ? this.coords(y, widget.el) : {}),
          });
        }
        if (((this.hovered = widgetId), widgetId && y)) {
          let element = widgetId === this.id ? this.client : this.widgets.get(widgetId)?.el;
          element &&
            this.desktop.send({
              t: `enter`,
              app: this.app,
              w: widgetId,
              ...this.coords(y, element),
            });
        }
      }
    }
    onPointerUp(event) {
      let pressed = this.pressed;
      if (
        pressed &&
        ((this.pressed = null),
        this.desktop.flushMotion(),
        this.desktop.send({
          t: `release`,
          app: this.app,
          w: pressed.id,
          b: pressed.button,
          ...this.coords(event, pressed.el),
          ...this.pressedItem,
        }),
        !pressed.inside)
      ) {
        this.hovered = pressed.id;
        let widgetId = this.widgetAt(document.elementFromPoint(event.clientX, event.clientY));
        this.setHovered(widgetId?.id ?? null, event.clientX, event.clientY, event);
      }
    }
    onWheel(event) {
      event.target.closest(`.tk-text-editor`) || event.preventDefault();
      let target = this.target(event),
        delta = event.deltaY === 0 ? 0 : event.deltaY > 0 ? -120 : 120;
      this.desktop.send({
        t: `wheel`,
        app: this.app,
        w: target.id,
        delta: delta,
        ...this.coords(event, target.el),
      });
    }
    onKey(event, kind) {
      if (event.ctrlKey && (event.key === `F2` || event.key === `F5`)) return;
      let keyEvent = keyEventToTk(event),
        target = event.target,
        isInput = target.tagName === `INPUT` || target.isContentEditable,
        widgetId = isInput ? (target.closest(`[data-tkid]`)?.dataset.tkid ?? this.id) : this.id;
      (this.desktop.send({
        t: kind,
        app: this.app,
        w: widgetId,
        ...keyEvent,
      }),
        event.stopPropagation(),
        !isInput && (event.key === ` ` || event.key.startsWith(`Arrow`) || event.key === `Tab`) && event.preventDefault());
    }
    remove() {
      this.frame.remove();
    }
  }

  function downloadBase64File(name, data, mime) {
    let bytes = Uint8Array.from(atob(mime), (char) => char.charCodeAt(0)),
      link = document.createElement(`a`);
    ((link.href = URL.createObjectURL(
      new Blob([bytes], {
        type: data,
      }),
    )),
      (link.download = name),
      link.click(),
      setTimeout(() => URL.revokeObjectURL(link.href), 6e4));
  }

  class TkDesktop {
    sendEvent;
    area;
    compact;
    onWindowsChange;
    addFile;
    element;
    taskbar;
    windows = new Map();
    active = null;
    audio = new AudioEngine();
    pendingMotion = null;
    motionFrame = 0;
    constructor(sendEvent, getArea, onWindowsChange = () => !1, addFile = () => void 0, isCompact = () => void 0) {
      ((this.sendEvent = sendEvent),
        (this.area = getArea),
        (this.compact = onWindowsChange),
        (this.onWindowsChange = addFile),
        (this.addFile = isCompact),
        (this.element = document.createElement(`div`)),
        (this.element.className = `tk-desktop`),
        (this.taskbar = document.createElement(`div`)),
        (this.taskbar.className = `tk-taskbar`),
        this.element.append(this.taskbar),
        window.addEventListener(`resize`, () => this.relayout()));
    }
    relayout() {
      for (let window of this.windows.values()) window.op && window.layout();
    }
    hasVisibleWindows() {
      return [...this.windows.values()].some((window) => !window.frame.hidden);
    }
    closeTop() {
      let windows = [...this.windows.values()].filter((window) => !window.frame.hidden),
        target = this.active && !this.active.frame.hidden ? this.active : windows.at(-1);
      target &&
        this.send({
          t: `close`,
          app: target.app,
          win: target.id,
        });
    }
    send(event) {
      (this.flushMotion(), this.sendEvent(event));
    }
    sendMotion(event) {
      ((this.pendingMotion = event),
        (this.motionFrame ||= requestAnimationFrame(() => this.flushMotion())));
    }
    flushMotion() {
      if ((cancelAnimationFrame(this.motionFrame), (this.motionFrame = 0), this.pendingMotion)) {
        let motion = this.pendingMotion;
        ((this.pendingMotion = null), this.sendEvent(motion));
      }
    }
    frame(appId, height, windowId, width, widgetId) {
      for (let window of this.windows.values()) {
        if (window.app !== appId) continue;
        let element = window.widgets.get(height);
        if (!element) continue;
        let canvas = ensurePixelsCanvas(element.el);
        (canvas.width !== windowId && (canvas.width = windowId), canvas.height !== width && (canvas.height = width));
        let context = canvas.getContext(`2d`);
        widgetId instanceof ArrayBuffer
          ? context?.putImageData(new ImageData(new Uint8ClampedArray(widgetId), windowId, width), 0, 0)
          : ((canvas.style.imageRendering = `auto`), context?.drawImage(widgetId, 0, 0), widgetId.close());
        return;
      }
      widgetId instanceof ArrayBuffer || widgetId.close();
    }
    apply(payload) {
      let ops = JSON.parse(payload);
      for (let op of ops) {
        let windowKey = `${op.app}:${op.win ?? op.id}`;
        switch (op.op) {
          case `download`:
            downloadBase64File(op.name, op.mime, op.data);
            break;
          case `sound_load`:
          case `sound_play`:
          case `sound_stop`:
          case `music_play`:
          case `music_stop`:
          case `music_pause`:
          case `music_unpause`:
          case `music_volume`:
          case `audio_stop`:
          case `tones`:
            this.audio.handle(op);
            break;
          case `window`: {
            let window = this.windows.get(windowKey);
            (window ||
              ((window = new TkWindow(this, op.app, op.id)),
              this.windows.set(windowKey, window),
              this.element.append(window.frame)),
              window.applyWindow(op));
            break;
          }
          case `widget`:
            this.windows.get(windowKey)?.applyWidget(op);
            break;
          case `remove`:
            for (let widgetId of this.windows.values()) widgetId.app === op.app && widgetId.removeWidget(op.id);
            break;
          case `close`:
            (this.windows.get(windowKey)?.remove(), this.windows.delete(windowKey), this.updateTaskbar());
            break;
          case `focus`: {
            let window = this.windows.get(windowKey);
            (window?.widgets.get(op.id)?.el?.querySelector(`input, .tk-text-editor`) ?? window?.frame)?.focus({
              preventScroll: !0,
            });
            break;
          }
          case `canvas`: {
            let element = this.windows.get(windowKey)?.widgets.get(op.id)?.el;
            element && updateCanvasItems(element, op);
            break;
          }
          case `text_see`:
          case `text_scroll`: {
            let element = this.windows.get(windowKey)?.widgets.get(op.id)?.el;
            element && handleTextScrollOp(element, op);
            break;
          }
          case `menu_post`: {
            let above = op.x,
              below = op.y,
              below2 = op.below;
            if (below2) {
              let element = this.windows.get(`${op.app}:${below2.win}`)?.widgets.get(below2.id)?.el;
              if (element) {
                let rect = element.getBoundingClientRect();
                ((above = rect.left), (below = rect.bottom));
              }
            }
            postMenu(op.menu, op.entries, op.font, above, below, (rect, window) =>
              this.send({
                t: `menu`,
                app: op.app,
                menu: rect,
                index: window,
              }),
            );
            break;
          }
          case `menu_unpost`:
            closeAllMenus();
            break;
          case `combo_post`: {
            let element = this.windows.get(windowKey)?.widgets.get(op.id)?.el;
            element &&
              showComboList(element, op, (index) =>
                this.send({
                  t: `combo`,
                  app: op.app,
                  w: op.id,
                  index: index,
                }),
              );
            break;
          }
          case `msgbox`:
          case `colorbox`:
          case `filebox`: {
            let parent = this.windows.get(`${op.app}:${op.parent}`),
              window = parent && !parent.frame.hidden ? parent.frame.getBoundingClientRect() : this.area(),
              rect = (rect2) =>
                this.send({
                  t: `msgbox`,
                  app: op.app,
                  mid: op.mid,
                  value: rect2,
                });
            op.op === `colorbox`
              ? showColorChooser(this.element, op, window, rect)
              : op.op === `filebox`
                ? showFileDialog(this.element, op, window, this.addFile, rect)
                : showMessageBox(this.element, op, window, rect);
            break;
          }
          case `raise`: {
            let window = this.windows.get(windowKey);
            window && this.activate(window);
            break;
          }
          case `clipboard`:
            navigator.clipboard?.writeText(String(op.text)).catch(() => void 0);
        }
      }
    }
    activate(window) {
      (this.active && this.active !== window && this.active.setActive(!1),
        (this.active = window),
        window.setActive(!0));
    }
    updateTaskbar() {
      let hiddenWindows = [...this.windows.values()].filter((window) => window.frame.hidden && window.op?.state !== `withdrawn`);
      (this.taskbar.replaceChildren(
        ...hiddenWindows.map((window) => {
          let button = document.createElement(`button`);
          return (
            (button.type = `button`),
            (button.className = `tk-taskbar-item`),
            (button.innerHTML = WINDOW_ICON_SVG),
            button.append(window.op.title),
            button.addEventListener(`click`, () => window.restore()),
            button
          );
        }),
      ),
        (this.taskbar.hidden = hiddenWindows.length === 0),
        this.onWindowsChange());
    }
    get windowCount() {
      return this.windows.size;
    }
    reset() {
      (this.audio.reset(), closeAllMenus(), closeComboPopup());
      for (let window of this.windows.values()) window.remove();
      (this.windows.clear(), (this.active = null), (cascadeIndex = 0), this.updateTaskbar());
    }
  }

  ns.TkDesktop = TkDesktop;
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});

// ============================================================
// index.js
// ============================================================

(function (ns) {
  "use strict";
  /** Точка входу: віконна система tkinter для браузера. */
  globalThis.TkWindowSystem = {
    TkDesktop: ns.TkDesktop,
    setLanguage: ns.setLanguage,
    getLanguage: ns.getLanguage,
    translate: ns.translate,
  };
})(globalThis.__TkWSNS = globalThis.__TkWSNS || {});
