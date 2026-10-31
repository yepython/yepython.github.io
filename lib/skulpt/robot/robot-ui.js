/*
 * robot-ui.js - integration of robot module into YEPython (Skulpt).
 * Вікно робота створюється ЛИШЕ після імпорту бібліотеки robot
 * (виклик RM.createMapWindow() з _robot.js).
 */

(function (global) {
  "use strict";

  var RM = global.RMApp = global.RMApp || {};

  var SPEED = { step: 400, grip: 1200 };
  var speedLevel = 5;

  function speedDelays(v) {
    var step = 40 + Math.round(4.6 * (10 - v) * (10 - v));
    return { step: step, grip: step * 3 };
  }

  function setSpeedLevel(v) {
    v = Math.round(Number(v));
    if (!isFinite(v)) v = 5;
    speedLevel = Math.max(0, Math.min(10, v));
    SPEED = speedDelays(speedLevel);
    return speedLevel;
  }

  var state = {
    timers: [],
    world: null,
    renderer: null,
    mode: "idle",
    stepWaiters: [],
    skins: {},
    maps: [],
    currentMap: null,
    worldArchive: null,   // імпортований світ { list, maps, url, title }
    worldError: "",       // причина, чому світ не завантажився
    windowCreated: false,
  };

  RM.stopped = false;
  RM.isReady = false;
  RM.ready = Promise.resolve();

  function wait(ms) {
    return new Promise(function (resolve) {
      var entry = { id: null, resolve: resolve };
      entry.id = setTimeout(function () {
        var i = state.timers.indexOf(entry);
        if (i >= 0) state.timers.splice(i, 1);
        resolve();
      }, ms);
      state.timers.push(entry);
    });
  }

  function cancelTimers() {
    var list = state.timers;
    state.timers = [];
    list.forEach(function (entry) { clearTimeout(entry.id); entry.resolve(); });
  }

  RM.stopAll = function () {
    RM.stopped = true;
    var waiters = state.stepWaiters;
    state.stepWaiters = [];
    waiters.forEach(function (res) { res(); });
    cancelTimers();
  };

  // Перемальовує поле: стан світу змінюється в моделі миттєво, а на екрані
  // робот з'являється лише після repaint() — тому викликаємо його на кожному кроці.
  function repaint() {
    if (state.renderer) state.renderer.paint();
  }

  RM.gate = function () {
    repaint();
    if (RM.stopped) return Promise.resolve();
    if (state.mode === "step") return Promise.resolve();
    return wait(SPEED.step);
  };

  RM.gripperGate = function () {
    repaint();
    if (RM.stopped) return Promise.resolve();
    if (state.mode === "step") return Promise.resolve();
    return wait(SPEED.grip);
  };

  RM.commandGate = function () {
    if (state.mode !== "step") return Promise.resolve();
    return new Promise(function (res) { state.stepWaiters.push(res); });
  };

  RM.setSpeed = function (v) { return setSpeedLevel(v); };
  RM.getSpeed = function () { return speedLevel; };

  RM.onRobotCommand = function () { repaint(); };
  RM.onCollect = function (c, t) {
    if (t > 0 && c >= t) {
      var el = global.document.getElementById("congrats");
      if (el) el.hidden = false;
    }
  };

  RM.DIRS = { NORTH: 0, EAST: 1, SOUTH: 2, WEST: 3 };

  RM.getWorld = function () { return state.world; };
  RM.getRenderer = function () { return state.renderer; };
  RM.setWorld = function (text) {
    state.world = new RM.World(text);
    if (state.renderer) state.renderer.render(state.world);
    return state.world;
  };

  // ---- скіни -------------------------------------------------------------

  var ROBOT_DIR = "lib/skulpt/robot/";
  var SKIN_DIR = ROBOT_DIR + "skins/";
  var MAP_DIR = ROBOT_DIR + "maps/";
  var ALIASES = {
    grass: "grassSkin", desert: "dessertSkin", dessert: "dessertSkin",
    mind: "starMindSkin", starmind: "starMindSkin", lego: "legoSkin",
    "default": "defaultSkin"
  };

  // Регістронезалежний пошук ключа скіну (виправляє dessertskin -> dessertSkin).
  function skinKey(name) {
    var n = String(name || "default");
    var k = ALIASES[n.toLowerCase()] || n;
    var skins = state.skins || {};
    for (var s in skins) {
      if (s.toLowerCase() === k.toLowerCase()) return s;
    }
    return k;
  }

  RM.getSkinPath = function (name) { return SKIN_DIR + skinKey(name) + "/"; };

  RM.setSkin = function (name) {
    var key = skinKey(name);
    var skin = (state.skins || {})[key];
    if (state.renderer) {
      state.renderer.setSkin(SKIN_DIR + key + "/", (skin && skin.files) || []);
    }
    return key;
  };

  function loadSkins() {
    return fetch(SKIN_DIR + "skins.json")
      .then(function (r) { if (!r.ok) throw new Error("skins " + r.status); return r.json(); })
      .then(function (s) { state.skins = s; })
      .catch(function (e) { console.error("skins.json:", e); state.skins = {}; });
  }

  // ---- карти та світи ----------------------------------------------------

  // Світ — ZIP-архів (.world) із картами та maps.json зі списком назв. Якщо в
  // адресі є параметр ?world=URL, карти беруться з архіву замість теки maps/.
  // Значення ?world=file означає «вибрати архів із локального файлу».

  var MAX_WORLD_BYTES = 32 * 1024 * 1024;   // захист від надто великих архівів

  // Повідомлення внизу вікна карти (помилки світу, назва завантаженого світу).
  var statusTimer = null;
  function setMapStatus(text, kind, autoHide) {
    var el = global.document.getElementById("map-status");
    if (!el) return;
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    el.textContent = text || "";
    el.hidden = !text;
    el.className = "map-status" + (kind ? " " + kind : "");
    if (text && autoHide) {
      statusTimer = setTimeout(function () {
        el.hidden = true;
        el.textContent = "";
      }, 6000);
    }
  }
  RM.setMapStatus = setMapStatus;

  /** Значення параметра ?world= (порожній рядок, якщо параметра немає). */
  function getWorldParam() {
    try {
      return String(new URL(global.location.href).searchParams.get("world") || "").trim();
    } catch (e) {
      return "";
    }
  }

  /** ?world=file — світ береться з локального файлу користувача. */
  function isWorldPickParam(raw) {
    return String(raw || "").trim().toLowerCase() === "file";
  }

  /**
   * Адреса світу для fetch: без схеми дописуємо https:// (як у прикладі
   * ?world=ed_info.github.io/mymaps.world). Шляхи від сторінки (/x, ./x, ../x)
   * лишаємо як є.
   */
  function worldUrl(raw) {
    var value = String(raw || "").trim();
    if (!value) return "";
    if (/^[a-z][a-z0-9+.\-]*:/i.test(value) || value.indexOf("//") === 0) return value;
    if (value.charAt(0) === "/" || value.charAt(0) === ".") return value;
    return "https://" + value;
  }

  // ---- читання ZIP (лише те, що потрібно для .world) ---------------------

  var ZIP_EOCD = 0x06054b50;
  var ZIP_CENTRAL = 0x02014b50;
  var ZIP_LOCAL = 0x04034b50;

  function zipU16(bytes, at) {
    return bytes[at] | (bytes[at + 1] << 8);
  }

  function zipU32(bytes, at) {
    return (bytes[at] | (bytes[at + 1] << 8) |
      (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
  }

  function decodeText(bytes) {
    return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  }

  /** Позиція кінцевого запису ZIP (EOCD); -1 — це не ZIP-архів. */
  function findZipEnd(bytes) {
    var min = Math.max(0, bytes.length - 22 - 65535);
    var fallback = -1;
    for (var i = bytes.length - 22; i >= min; i--) {
      if (zipU32(bytes, i) !== ZIP_EOCD) continue;
      // Справжній EOCD — той, після якого рівно стільки байтів, скільки
      // вказано в довжині коментаря (захист від сигнатури всередині коментаря).
      if (i + 22 + zipU16(bytes, i + 20) === bytes.length) return i;
      if (fallback < 0) fallback = i;
    }
    return fallback;
  }

  /** Каталог архіву: імена, метод стиснення, розміри та зсуви даних. */
  function zipEntries(bytes) {
    var end = findZipEnd(bytes);
    if (end < 0) throw new Error("це не ZIP-архів");

    var count = zipU16(bytes, end + 10);
    var size = zipU32(bytes, end + 12);
    var offset = zipU32(bytes, end + 16);
    if (count === 0xffff || offset === 0xffffffff || size === 0xffffffff) {
      throw new Error("ZIP64 не підтримується");
    }
    if (offset + size > bytes.length || offset > bytes.length) {
      throw new Error("пошкоджений ZIP-архів");
    }

    var entries = [];
    var at = offset;
    for (var i = 0; i < count; i++) {
      if (at + 46 > bytes.length || zipU32(bytes, at) !== ZIP_CENTRAL) {
        throw new Error("пошкоджений каталог ZIP-архіву");
      }
      var nameLen = zipU16(bytes, at + 28);
      var extraLen = zipU16(bytes, at + 30);
      var commentLen = zipU16(bytes, at + 32);
      if (at + 46 + nameLen > bytes.length) {
        throw new Error("пошкоджений каталог ZIP-архіву");
      }
      entries.push({
        name: decodeText(bytes.subarray(at + 46, at + 46 + nameLen))
          .replace(/\\/g, "/").replace(/^\.\//, ""),
        flags: zipU16(bytes, at + 8),
        method: zipU16(bytes, at + 10),
        compSize: zipU32(bytes, at + 20),
        size: zipU32(bytes, at + 24),
        offset: zipU32(bytes, at + 42),
      });
      at += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  function inflateRaw(data) {
    if (typeof global.DecompressionStream !== "function") {
      return Promise.reject(new Error("браузер не вміє розпаковувати ZIP-архів"));
    }
    var stream = new global.Blob([data]).stream()
      .pipeThrough(new global.DecompressionStream("deflate-raw"));
    return new global.Response(stream).arrayBuffer()
      .then(function (buffer) { return new Uint8Array(buffer); });
  }

  function entryData(bytes, entry) {
    if (entry.flags & 0x1) throw new Error("ZIP-архів зашифровано");
    if (entry.compSize === 0xffffffff || entry.size === 0xffffffff) {
      throw new Error("ZIP64 не підтримується");
    }
    var at = entry.offset;
    if (at + 30 > bytes.length || zipU32(bytes, at) !== ZIP_LOCAL) {
      throw new Error("пошкоджений ZIP-архів");
    }
    var start = at + 30 + zipU16(bytes, at + 26) + zipU16(bytes, at + 28);
    var stop = start + entry.compSize;
    if (stop > bytes.length) throw new Error("пошкоджений ZIP-архів");

    var raw = bytes.subarray(start, stop);
    if (entry.method === 0) return Promise.resolve(raw);
    if (entry.method === 8) return inflateRaw(raw);
    throw new Error("стиснення ZIP не підтримується (метод " + entry.method + ")");
  }

  // Запасний варіант для старих браузерів без DecompressionStream, якщо на
  // сторінці вже є JSZip (він підключається в index.html для інших модулів).
  function unzipWithJsZip(bytes) {
    if (!global.JSZip || typeof global.JSZip.loadAsync !== "function") {
      return Promise.reject(new Error("браузер не підтримує розпакування ZIP-архіву"));
    }
    return global.JSZip.loadAsync(bytes).then(function (zip) {
      var jobs = [];
      zip.forEach(function (path, file) {
        if (file.dir) return;
        jobs.push(file.async("uint8array").then(function (data) {
          return { name: path, data: data };
        }));
      });
      return Promise.all(jobs);
    });
  }

  /** Розпаковує архів у список { name, data }. */
  function unzip(bytes) {
    var entries = zipEntries(bytes).filter(function (entry) {
      return entry.name.charAt(entry.name.length - 1) !== "/";
    });
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += entries[i].size;
    if (total > MAX_WORLD_BYTES) {
      return Promise.reject(new Error("світ завеликий (понад 32 МБ)"));
    }

    var deflated = false;
    for (i = 0; i < entries.length; i++) {
      if (entries[i].method === 8) { deflated = true; break; }
    }
    if (deflated && typeof global.DecompressionStream !== "function") {
      return unzipWithJsZip(bytes);
    }

    return Promise.all(entries.map(function (entry) {
      return entryData(bytes, entry).then(function (data) {
        return { name: entry.name, data: data };
      });
    }));
  }

  /**
   * Складає світ із вмісту архіву: список карт береться з maps.json, а якщо
   * його немає — з усіх файлів .map. Повертає { list, maps: { name: text } }.
   */
  function buildWorld(files) {
    var dataByName = {};
    var nameByLower = {};
    files.forEach(function (file) {
      var name = file.name;
      if (!name || name.charAt(name.length - 1) === "/") return;
      dataByName[name] = file.data;
      nameByLower[name.toLowerCase()] = name;
    });

    function findName(value) {
      var key = String(value == null ? "" : value).trim()
        .replace(/\\/g, "/").replace(/^\.\//, "");
      if (!key) return "";
      if (Object.prototype.hasOwnProperty.call(dataByName, key)) return key;
      return nameByLower[key.toLowerCase()] || "";
    }

    var listed = [];
    var manifest = findName("maps.json");

    if (manifest) {
      var parsed;
      try {
        parsed = JSON.parse(decodeText(dataByName[manifest]));
      } catch (e) {
        throw new Error("файл maps.json пошкоджено");
      }
      if (!Array.isArray(parsed)) {
        throw new Error("maps.json має містити список назв карт");
      }

      var missing = [];
      parsed.forEach(function (item) {
        if (typeof item !== "string") return;
        var name = findName(item);
        if (!name) { missing.push(String(item).trim()); return; }
        if (listed.indexOf(name) < 0) listed.push(name);
      });
      if (missing.length) {
        throw new Error("у архіві немає карт: " + missing.join(", "));
      }
    } else {
      Object.keys(dataByName).sort(function (a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      }).forEach(function (name) {
        if (/\.map$/i.test(name)) listed.push(name);
      });
    }

    if (!listed.length) throw new Error("у світі немає карт (.map)");

    var maps = {};
    listed.forEach(function (name) { maps[name] = decodeText(dataByName[name]); });
    return { list: listed, maps: maps };
  }

  function fetchWorldBytes(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    });
  }

  /** Завантажує архів; для адреси без схеми пробує також шлях від сторінки. */
  function loadWorldBytes(raw, url) {
    var relative = url !== raw && !/^[a-z][a-z0-9+.\-]*:/i.test(raw) ? raw : "";
    return fetchWorldBytes(url).catch(function (error) {
      if (!relative) throw error;
      return fetchWorldBytes(relative).catch(function () { throw error; });
    });
  }

  function worldTitle(url) {
    var value = String(url || "").split(/[?#]/)[0];
    var name = value.slice(value.lastIndexOf("/") + 1);
    try { name = decodeURIComponent(name); } catch (e) { /* лишаємо як є */ }
    return name || value;
  }

  /** Імпортує світ за параметром ?world=; помилку показує у вікні карти. */
  function importWorld(raw) {
    var url = worldUrl(raw);
    setMapStatus("Завантаження світу…", "info");
    return loadWorldBytes(raw, url)
      .then(function (buffer) {
        return unzip(new Uint8Array(buffer));
      })
      .then(function (files) {
        var world = buildWorld(files);
        world.url = url;
        world.title = worldTitle(url);
        state.worldArchive = world;
        state.worldError = "";
        state.maps = world.list;
        setMapStatus("Світ: " + world.title + " — карт: " + world.list.length, "info", true);
        return world;
      })
      .catch(function (e) {
        var message = String(e && e.message || e);
        state.worldArchive = null;
        state.worldError = message;
        state.maps = [];
        // Підказка про CORS доречна лише для мережевих помилок.
        var hint = /^HTTP |Failed to fetch|NetworkError|Load failed/i.test(message)
          ? ". Перевірте адресу та доступ до файлу (CORS)." : "";
        setMapStatus("Не вдалося завантажити світ " + raw + ": " + message + hint, "error");
        console.error("world:", e);
        return null;
      });
  }

  // ---- локальний файл світу (?world=file) --------------------------------

  /** Читає локальний файл у ArrayBuffer (FileReader — запасний варіант). */
  function readFileBytes(file) {
    if (file && typeof file.arrayBuffer === "function") {
      return file.arrayBuffer();
    }
    return new Promise(function (resolve, reject) {
      var reader = new global.FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () {
        reject(reader.error || new Error("не вдалося прочитати файл"));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /** Розпаковує вибраний локальний архів і робить його поточним світом. */
  function importWorldFile(file) {
    if (!file) return Promise.reject(new Error("файл не вибрано"));
    if (file.size > MAX_WORLD_BYTES) {
      return Promise.reject(new Error("файл завеликий (максимум " +
        Math.round(MAX_WORLD_BYTES / (1024 * 1024)) + " МБ)"));
    }
    return readFileBytes(file)
      .then(function (buffer) {
        return unzip(new Uint8Array(buffer));
      })
      .then(function (files) {
        var world = buildWorld(files);
        world.url = "";
        world.title = String(file.name || "світ");
        state.worldArchive = world;
        state.worldError = "";
        state.maps = world.list;
        setMapStatus("Світ: " + world.title + " — карт: " + world.list.length, "info", true);
        return world;
      });
  }

  var worldPicker = null;   // незавершене вікно вибору локального світу

  /**
   * Вікно вибору локального архіву .world. Повертає Promise зі світом або
   * null, якщо користувач скасував вибір.
   */
  function pickWorldFile() {
    if (worldPicker) return worldPicker;
    setMapStatus("Виберіть файл світу (.world)…", "info");

    worldPicker = new Promise(function (resolve) {
      var host = global.document.getElementById("map-panel") || global.document.body;
      var box = global.document.createElement("div");
      box.className = "world-picker";
      box.id = "world-picker";
      box.innerHTML =
        '<div class="world-picker-box" role="dialog" aria-modal="true" ' +
        'aria-labelledby="world-picker-title">' +
          '<div class="world-picker-icon" aria-hidden="true">📂</div>' +
          '<h2 id="world-picker-title">Світ із файлу</h2>' +
          "<p>Виберіть архів <code>.world</code> із картами для завдань. " +
          "Такий архів створюється в редакторі карт.</p>" +
          '<p class="world-picker-note">Файл читається у браузері — ' +
          "нічого не надсилається в інтернет.</p>" +
          '<div class="world-picker-actions">' +
            '<button type="button" class="btn primary" ' +
            'id="world-picker-choose">Обрати файл…</button>' +
            '<button type="button" class="btn" ' +
            'id="world-picker-cancel">Скасувати</button>' +
          "</div>" +
          '<p class="world-picker-error" id="world-picker-error" ' +
          'role="alert" hidden></p>' +
        "</div>";

      var input = global.document.createElement("input");
      input.type = "file";
      input.accept = ".world,application/zip,application/octet-stream";
      input.hidden = true;
      box.appendChild(input);
      host.appendChild(box);

      var choose = box.querySelector("#world-picker-choose");
      var cancel = box.querySelector("#world-picker-cancel");
      var error = box.querySelector("#world-picker-error");

      function close(world) {
        worldPicker = null;
        global.document.removeEventListener("keydown", onKey, true);
        if (box.parentNode) box.parentNode.removeChild(box);
        resolve(world);
      }

      function showError(message) {
        error.textContent = "Не вдалося відкрити світ: " + message;
        error.hidden = false;
        choose.disabled = false;
        cancel.disabled = false;
        choose.focus();
        setMapStatus("Не вдалося відкрити світ: " + message, "error");
      }

      function onKey(event) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        close(null);
      }

      choose.addEventListener("click", function () { input.click(); });
      cancel.addEventListener("click", function () { close(null); });

      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        error.hidden = true;
        choose.disabled = true;
        cancel.disabled = true;
        importWorldFile(file).then(function (world) {
          close(world);
        }).catch(function (e) {
          input.value = "";
          showError(String(e && e.message || e));
        });
      });

      global.document.addEventListener("keydown", onKey, true);
      choose.focus();
      // Пробуємо відкрити вибір файлу одразу. Браузер може вимагати
      // натискання користувача — тоді лишається кнопка «Обрати файл…».
      try { input.click(); } catch (e) { /* потрібен клік по кнопці */ }
    });

    return worldPicker;
  }

  // maps/maps.json = ["map1.map","map2.map",...]; якщо файлу немає — лише map1.map
  function loadMapList() {
    return fetch(MAP_DIR + "maps.json")
      .then(function (r) { if (!r.ok) throw new Error("maps.json " + r.status); return r.json(); })
      .catch(function () { return ["map1.map"]; })
      .then(function (list) { state.maps = list; });
  }

  /** Список карт: зі світу (?world=URL або ?world=file) чи з теки maps/. */
  function loadMapSource() {
    var raw = getWorldParam();
    if (!raw) return loadMapList();
    if (isWorldPickParam(raw)) {
      return pickWorldFile().then(function (world) {
        if (world) return world;
        setMapStatus("Світ не вибрано — показано стандартні карти", "info", true);
        return loadMapList();
      });
    }
    return importWorld(raw);
  }

  /** Застосовує скін, указаний у карті (секція skin:), якщо він відомий. */
  function applyMapSkin(name) {
    if (!name) return;
    var key = skinKey(name);
    var known = state.skins || {};
    var listed = Object.keys(known).length > 0;
    if (listed && !known[key]) {
      console.warn("Невідомий скін карти:", name);
      return;
    }
    RM.setSkin(key);
  }

  /**
   * Передає обмеження кількості рядків коду головному редактору ЄPython.
   * 0 (карта без секції codelimit) знімає попереднє обмеження.
   */
  function applyCodeLimit(limit) {
    var n = parseInt(limit, 10);
    if (!isFinite(n) || n <= 0) n = 0;
    if (global.PythonIDE && typeof global.PythonIDE.setCodeLimit === "function") {
      global.PythonIDE.setCodeLimit(n || null);
    }
  }

  var PAGE = 10;   // кнопок карт на сторінку

  function renderMapPages() {
    var maps = state.maps || [];
    var pages = Math.max(1, Math.ceil(maps.length / PAGE));
    var idx = maps.indexOf(state.currentMap);
    if (state.page === undefined && idx >= 0) state.page = Math.floor(idx / PAGE);
    state.page = Math.max(0, Math.min(pages - 1, state.page || 0));
    var $p = $("#map-pages").empty();
    maps.slice(state.page * PAGE, (state.page + 1) * PAGE).forEach(function (f, i) {
      $("<button type='button' class='map-btn'>").text(state.page * PAGE + i + 1)
        .attr("title", f)
        .toggleClass("active", f === state.currentMap)
        .on("click", function () { RM.loadMap(f); })
        .appendTo($p);
    });
    $("#map-prev").prop("disabled", state.page <= 0);
    $("#map-next").prop("disabled", state.page >= pages - 1);
    $("#map-panel-name").text(state.currentMap || "");
  }

  /** Читає текст карти з імпортованого світу або з теки maps/. */
  function readMapText(name) {
    if (state.worldArchive) {
      if (Object.prototype.hasOwnProperty.call(state.worldArchive.maps, name)) {
        return Promise.resolve(state.worldArchive.maps[name]);
      }
      return Promise.reject(new Error("у світі немає карти " + name));
    }
    if (state.worldError) {
      return Promise.reject(new Error("світ не завантажено: " + state.worldError));
    }
    return fetch(MAP_DIR + name)
      .then(function (r) { if (!r.ok) throw new Error("map " + r.status); return r.text(); });
  }

  RM.loadMap = function (file) {
    RM.isReady = false;
    state.page = undefined;
    state.currentMap = file || state.currentMap || (state.maps && state.maps[0]) || "map1.map";
    return readMapText(state.currentMap)
      .then(function (text) {
        var world = RM.setWorld(text);
        applyMapSkin(world && world.skin);
        applyCodeLimit(world && world.codeLimit);
        renderMapPages();
      })
      .then(function () { RM.loadError = null; })
      .catch(function (e) {
        RM.loadError = String(e && e.message || e);
        renderMapPages();
        var failMsg = (window.ROBOT_I18N && window.ROBOT_I18N.t && window.ROBOT_I18N.t.map_load_failed) ? window.ROBOT_I18N.t.map_load_failed : "Не вдалося завантажити карту";
        console.error(failMsg + ":", e);
      })
      .then(function () { RM.isReady = true; });
  };
  RM.reloadMap = function () { return RM.loadMap(state.currentMap); };

  // ---- вікно -------------------------------------------------------------

  function bindButtons() {
    $("#btn-run").on("click", function () {
      // Код довший за codelimit не запускається (підказка в hintBar).
      if (PythonIDE.codeLimitExceeded && PythonIDE.codeLimitExceeded()) return;
      state.pendingMode = "run";
      PythonIDE.runCode("normal");
    });
    $("#btn-step").on("click", function () {
      if (PythonIDE.running && state.mode === "step") {
        var w = state.stepWaiters.shift(); if (w) w();
      } else {
        if (PythonIDE.codeLimitExceeded && PythonIDE.codeLimitExceeded()) return;
        state.pendingMode = "step";
        PythonIDE.runCode("normal");
      }
    });
    $("#btn-stop").on("click", function () { state.mode = "idle"; RM.stopAll(); });
    $("#btn-reset").on("click", function () { RM.reloadMap(); });
    $("#btn-close-map").on("click", function () { RM.closeMap(); });
    $("#btn-min-map").on("click", function () { RM.toggleCollapse(); });
    // «Чудово»: закриваємо вітання й завантажуємо наступну карту (після останньої — першу).
    $("#btn-congrats-ok").on("click", function () {
      $("#congrats").prop("hidden", true);
      var l = state.maps || [];
      if (!l.length) return;
      var i = l.indexOf(state.currentMap);
      RM.loadMap(l[(i + 1) % l.length]);
    });
    function turn(d) { state.page = (state.page || 0) + d; renderMapPages(); }
    $("#map-prev").on("click", function () { turn(-1); });
    $("#map-next").on("click", function () { turn(1); });
  }

  // ---- плаваюча панель (без jQuery UI) -----------------------------------

  var zTop = 3000;
  var animTimer = null;   // таймер анімації Energon (один на весь застосунок)

  var MOBILE_MQ = "(max-width: 640px), (max-height: 500px)";
  function isMobile() {
    return !!(global.matchMedia && global.matchMedia(MOBILE_MQ).matches);
  }

  // Панель по центру вікна браузера (розмір задає CSS, обмежений розміром вікна).
  function centerPanel(p) {
    var r = p.getBoundingClientRect();
    var vw = global.innerWidth, vh = global.innerHeight;
    p.style.left = Math.max(0, (vw - r.width) / 2) + "px";
    p.style.top = Math.max(0, (vh - r.height) / 2) + "px";
  }

  function keepInViewport(p) {
    var r = p.getBoundingClientRect();
    var vw = global.innerWidth, vh = global.innerHeight;
    var left = Math.min(Math.max(0, r.left), Math.max(0, vw - 80));
    var top = Math.min(Math.max(0, r.top), Math.max(0, vh - 40));
    p.style.left = left + "px";
    p.style.top = top + "px";
  }

  // Перетягування за заголовок (мишею та пальцем); кнопки не перетягують.
  function makeDraggable(p) {
    var head = p.querySelector("#map-panel-head");
    p.style.display = "none";

    p.addEventListener("pointerdown", function () { p.style.zIndex = ++zTop; });

    var drag = null;
    head.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      var r = p.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      head.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    head.addEventListener("pointermove", function (e) {
      if (!drag) return;
      state.moved = true;
      p.style.left = (e.clientX - drag.dx) + "px";
      p.style.top = (e.clientY - drag.dy) + "px";
    });
    function end(e) {
      if (!drag) return;
      drag = null;
      try { head.releasePointerCapture(e.pointerId); } catch (x) {}
      keepInViewport(p);
    }
    head.addEventListener("pointerup", end);
    head.addEventListener("pointercancel", end);
  }

  // Висота панелі на мобільних — не більше 500px. Задаємо й напряму (inline),
  // щоб обмеження діяло навіть із закешованим robot.css.
  function applySize(p) {
    var collapsed = p.classList.contains("collapsed");
    if (isMobile()) {
      p.style.maxHeight = "500px";
      p.style.height = collapsed ? "auto" : Math.min(Math.round(global.innerHeight * 0.92), 500) + "px";
    } else {
      p.style.maxHeight = "";
      p.style.height = collapsed ? "auto" : "";
    }
  }

  function onViewportChange() {
    var p = global.document.getElementById("map-panel");
    if (!p || p.style.display === "none") return;
    applySize(p);
    // Згортання існує лише в мобільному вигляді.
    if (!isMobile() && p.classList.contains("collapsed")) RM.toggleCollapse(false);
    if (!state.moved) centerPanel(p);
    else keepInViewport(p);
    if (state.renderer) state.renderer.paint();
  }

  // Створюється ЛИШЕ коли робот імпортується (викликається з _robot.js).
  RM.createMapWindow = function () {
    if (state.windowCreated) { RM.openMap(); return RM.ready; }
    state.windowCreated = true;
    RM.buildMapMarkup();   // розмітка з world.js
    makeDraggable(document.getElementById("map-panel"));
    global.addEventListener("resize", onViewportChange);
    global.addEventListener("orientationchange", onViewportChange);
    state.renderer = new RM.Renderer(
      document.getElementById("field"), SKIN_DIR + "defaultSkin/",
      { files: [], wrap: document.getElementById("field-wrap"),
        sizer: document.getElementById("field-sizer") });
    state.renderer.preload();
    // Клік по карті вмикає/вимикає напівпрозору сітку клітинок.
    document.getElementById("field").addEventListener("click", function () {
      state.renderer.toggleGrid();
    });
    bindButtons();
    RM.openMap();   // відкриваємо одразу: працює навіть зі старою версією _robot.js
    RM.animate();
    RM.ready = Promise.all([loadSkins(), loadMapSource()]).then(function () {
      RM.setSkin("defaultSkin");
      return RM.loadMap();
    });
    return RM.ready;
  };

  // Згортає/розгортає панель (на мобільних): лишається лише верхня частина з кнопками.
  RM.toggleCollapse = function (force) {
    var p = global.document.getElementById("map-panel");
    if (!p) return false;
    var wrap = global.document.getElementById("field-wrap");
    var collapsed = typeof force === "boolean" ? force : !p.classList.contains("collapsed");
    p.classList.toggle("collapsed", collapsed);
    // Стилі задаємо й напряму (а не лише через CSS-клас), щоб згортання
    // працювало незалежно від кешу robot.css.
    if (wrap) wrap.style.display = collapsed ? "none" : "";
    applySize(p);
    var b = global.document.getElementById("btn-min-map");
    if (b) {
      b.textContent = "\u2726";   // ✦
      b.title = collapsed ? "Розгорнути" : "Згорнути";
      b.setAttribute("aria-label", b.title);
    }
    if (state.moved) {
      // Панель вже перетягували — лишаємо де є, але так, щоб вона вміщалась на екрані.
      var r = p.getBoundingClientRect();
      var top = Math.max(0, Math.min(r.top, global.innerHeight - r.height));
      p.style.top = top + "px";
      keepInViewport(p);
    } else {
      centerPanel(p);
    }
    if (!collapsed && state.renderer) state.renderer.paint();
    return collapsed;
  };

  RM.openMap = function () {
    var p = global.document.getElementById("map-panel");
    if (!p) return p;
    p.style.display = "flex";
    RM.toggleCollapse(false);
    RM.animate();
    state.moved = false;
    centerPanel(p);
    if (state.renderer) state.renderer.paint();
    // Повторне відкриття вікна: повертаємо обмеження рядків поточної карти
    // (під час першого відкриття карти ще немає — ліміт виставить loadMap).
    applyCodeLimit(state.world && state.world.codeLimit);
    return p;
  };

  RM.closeMap = function () {
    var p = global.document.getElementById("map-panel");
    if (p) p.style.display = "none";
    RM.stopAnimate();
    // Обмеження рядків (codelimit) при закритті вікна НЕ знімаємо: інакше код
    // можна дописати без обмежень і потім запустити. Ліміт змінюється лише
    // при завантаженні іншої карти (loadMap).
    return p;
  };

  RM.isOpen = function () {
    var p = global.document.getElementById("map-panel");
    return !!p && p.style.display !== "none";
  };

  // Викликається на початку кожного запуску (при імпорті robot) і знищує
  // усе, що лишилося від попереднього запуску: таймери пауз, очікування кроків,
  // відкладене перемальовування, цикл анімації.
  RM.resetRunState = function () {
    RM.stopped = false;
    // режим: «звичайний», якщо запуск не з кнопок RUN/STEP вікна карти
    state.mode = state.pendingMode || "idle";
    state.pendingMode = null;
    var waiters = state.stepWaiters;       // відпускаємо старі очікування кроку,
    state.stepWaiters = [];                // щоб стара програма не лишилась висіти
    waiters.forEach(function (res) { res(); });
    cancelTimers();
    if (state.renderer && state.renderer.cancelPending) state.renderer.cancelPending();
    RM.stopAnimate();
    if (RM.isOpen()) RM.animate();
  };

  // Діагностика: скільки «живих» таймерів/очікувань зараз є (має бути 0/0 між запусками).
  RM.debugInfo = function () {
    return {
      pauseTimers: state.timers.length,
      stepWaiters: state.stepWaiters.length,
      animLoop: !!animTimer,
      renderPending: !!(state.renderer && state.renderer.pending),
      mode: state.mode
    };
  };

  // Енергони «блимають» раз на секунду: перемальовуємо лише коли панель відкрита,
  // вкладка видима і на карті є що анімувати. Інакше таймер нічого не робить.
  function animTick() {
    if (!RM.isOpen() || global.document.hidden || !state.renderer) return;
    var w = state.world;
    if (!w || !w.energons || !w.energons.length) return;
    var f = Math.floor(Date.now() / 1000) % 2;
    if (state.animFrame !== f) {
      state.animFrame = f;
      state.renderer.paint();
    }
  }
  RM.animate = function () {
    if (!animTimer) animTimer = setInterval(animTick, 400);
  };
  RM.stopAnimate = function () {
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
  };
  // Автозапуску init() більше немає.

})(typeof window !== "undefined" ? window : this);
