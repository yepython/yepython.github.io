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
    mind: "starMindSkin", lego: "legoSkin", "default": "defaultSkin"
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

  // ---- карти -------------------------------------------------------------

  // maps/maps.json = ["map1.map","map2.map",...]; якщо файлу немає — лише map1.map
  function loadMapList() {
    return fetch(MAP_DIR + "maps.json")
      .then(function (r) { if (!r.ok) throw new Error("maps.json " + r.status); return r.json(); })
      .catch(function () { return ["map1.map"]; })
      .then(function (list) { state.maps = list; });
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

  RM.loadMap = function (file) {
    RM.isReady = false;
    state.page = undefined;
    state.currentMap = file || state.currentMap || (state.maps && state.maps[0]) || "map1.map";
    return fetch(MAP_DIR + state.currentMap)
      .then(function (r) { if (!r.ok) throw new Error("map " + r.status); return r.text(); })
      .then(function (text) { RM.setWorld(text); renderMapPages(); })
      .then(function () { RM.loadError = null; })
      .catch(function (e) {
        RM.loadError = String(e && e.message || e);
        console.error("Не вдалося завантажити карту:", e);
      })
      .then(function () { RM.isReady = true; });
  };
  RM.reloadMap = function () { return RM.loadMap(state.currentMap); };

  // ---- вікно -------------------------------------------------------------

  function bindButtons() {
    $("#btn-run").on("click", function () {
      state.pendingMode = "run";
      PythonIDE.runCode("normal");
    });
    $("#btn-step").on("click", function () {
      if (PythonIDE.running && state.mode === "step") {
        var w = state.stepWaiters.shift(); if (w) w();
      } else {
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
    RM.ready = Promise.all([loadSkins(), loadMapList()]).then(function () {
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
    return p;
  };

  RM.closeMap = function () {
    var p = global.document.getElementById("map-panel");
    if (p) p.style.display = "none";
    RM.stopAnimate();
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
