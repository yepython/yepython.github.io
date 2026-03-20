/**
* turtle.js — Skulpt stdlib implementation of Python's turtle module
* Modified to use jQuery UI Dialog for canvas container
* Based on skulpt-stdlib.js, fully formatted and extended to match Python 3.14 turtle API.
*/
var $builtinmodule = function () {
"use strict";

/* ------------------------------------------------------------------ */
/*  Helpers / math aliases                                              */
/* ------------------------------------------------------------------ */
var round  = Math.round;
var max    = Math.max;
var sqrt   = Math.sqrt;
var min    = Math.min;
var abs    = Math.abs;
var PI     = Math.PI;
var atan2  = Math.atan2;
var sin    = Math.sin;
var cos    = Math.cos;

/* ------------------------------------------------------------------ */
/*  jQuery Dialog Configuration                                        */
/* ------------------------------------------------------------------ */
// Спочатку визначаємо геттери (вже є в оригінальному коді):
function getTarget()       { return targetEl; }
function getScreen()       { return screenInstance || (screenInstance = new Screen()); }
function getMouseHandler() { return mouseHandlerInstance || (mouseHandlerInstance = new MouseHandler()); }
function getWidth()        { return 0 | (screenInstance && screenInstance._width  || cfg.width  || getTarget().clientWidth  || 400); }
function getHeight()       { return 0 | (screenInstance && screenInstance._height || cfg.height || getTarget().clientHeight || 400); }

// Тільки ПОСЛЯ геттерів додаємо функції для jQuery Dialog:
var dialogInstance = null;
var canvasContainer = null;

// Підняті у зовнішній scope, щоб updateDialogSize мала до них доступ
var screenInstance;
var mouseHandlerInstance;
var anonymousTurtle;
var moduleCounter = 0;
// Посилання на FrameManager, заповнюється після ініціалізації модуля
var frameManagerRef = null;
// Посилання на applyWorld, заповнюється після ініціалізації модуля
var applyWorldRef = null;
// Посилання на drawTurtle, заповнюється після ініціалізації модуля
var drawTurtleRef = null;

function updateDialogSize(width, height) {
    if (typeof $ !== "undefined" && $.fn && $.fn.dialog && dialogInstance) {
        var $dialog = dialogInstance.parent();
        var titlebarHeight = $dialog.find(".ui-dialog-titlebar").outerHeight() || 0;

        var contentHeight = height;
        var dialogHeight  = height + titlebarHeight;

        // 1. Оновлюємо параметри діалогу
        dialogInstance.dialog("option", "width",  width);
        dialogInstance.dialog("option", "height", dialogHeight);

        var targetEl = getTarget();
        if (targetEl) {
            targetEl.style.width = width + "px";
            targetEl.style.height = contentHeight + "px";

            var turtles = frameManagerRef ? frameManagerRef.turtles() : [];

            // КРОК 1: Зберігаємо вміст ліній (paper) та фону
            var savedImages = [];
            function saveLayer(ctx) {
                if (!ctx || !ctx.canvas) return;
                var tmp = document.createElement("canvas");
                tmp.width  = ctx.canvas.width;
                tmp.height = ctx.canvas.height;
                tmp.getContext("2d").drawImage(ctx.canvas, 0, 0);
                savedImages.push({ ctx: ctx, image: tmp, srcW: tmp.width, srcH: tmp.height });
            }

            if (screenInstance && screenInstance._background) saveLayer(screenInstance._background);
            for (var i = 0; i < turtles.length; i++) {
                if (turtles[i]._paper) saveLayer(turtles[i]._paper);
            }

            // КРОК 2: Оновлюємо внутрішні розміри Screen
            if (screenInstance) {
                screenInstance._width  = width;
                screenInstance._height = contentHeight;
                screenInstance.setUpWorld(-width / 2, -contentHeight / 2, width / 2, contentHeight / 2);
            }

            // КРОК 3: Фізично змінюємо розмір усіх Canvas
            // Спочатку для фону та ліній
            for (var i = 0; i < savedImages.length; i++) {
                var saved = savedImages[i];
                var ctx   = saved.ctx;

                // Змінюємо розмір canvas (скидає трансформацію до identity)
                ctx.canvas.width  = width;
                ctx.canvas.height = contentHeight;

                // Встановлюємо правильну трансформацію координатної системи
                // (0,0 в центрі). applyWorld також заповнює фон якщо потрібно,
                // тому окремо fillRect не потрібен.
                if (typeof applyWorldRef === "function") {
                    applyWorldRef(screenInstance, ctx);
                }

                // Відновлюємо збережені пікселі в піксельних координатах,
                // центруючи старий малюнок відносно нового розміру canvas.
                var dx = (width    - saved.srcW) / 2;
                var dy = (contentHeight - saved.srcH) / 2;
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(saved.image, dx, dy);
                ctx.restore();
            }

            // КРОК 4: Окремо обробляємо шар спрайтів —
            // лише змінюємо розмір canvas, БЕЗ виклику applyWorld,
            // бо applyWorld очищує canvas і виставляє трансформацію,
            // після чого черепашки потрібно одразу малювати синхронно.
            if (screenInstance && screenInstance._sprites) {
                var sCtx = screenInstance._sprites;
                sCtx.canvas.width  = width;
                sCtx.canvas.height = contentHeight;
            }

            // КРОК 5: ПРИМУСОВЕ ПЕРЕМАЛЬОВУВАННЯ ЧЕРЕПАШОК
            // Малюємо черепашок одразу синхронно — canvas вже змінений.
            // Використовуємо requestAnimationFrame лише щоб потрапити
            // ПІСЛЯ поточного paint-циклу браузера (canvas точно готовий).
            requestAnimationFrame(function() {
                var fm = frameManagerRef;
                var scr = screenInstance;
                if (!fm || !scr) return;

                var sprites = scr._sprites;
                if (!sprites) return;

                // Встановлюємо трансформацію координатної системи
                // (0,0 в центрі) — applyWorld також очищує canvas, що нам потрібно
                if (typeof applyWorldRef === "function") {
                    applyWorldRef(scr, sprites);
                }

                // Малюємо кожну видиму черепашку через єдиний правильний шлях —
                // глобальну функцію drawTurtle (t.draw() не існує в Turtle.prototype)
                var currentTurtles = fm.turtles();
                for (var i = 0; i < currentTurtles.length; i++) {
                    var t = currentTurtles[i];
                    if (t.getState().shown) {
                        drawTurtleRef(t.getState(), sprites);
                    }
                }
            });
        }
    }
}

function createjQueryDialog(width, height) {
    // Remove existing dialog if present
    if (dialogInstance) {
        dialogInstance.dialog("destroy");
        dialogInstance.remove();
    }

    // Create container div
    canvasContainer = document.createElement("div");
    canvasContainer.id = "turtle-dialog-" + Date.now();
    canvasContainer.title = "Turtle Graphics";
    document.body.appendChild(canvasContainer);

    // Create jQuery UI dialog
    dialogInstance = $(canvasContainer).dialog({
        width: width,
        height: height,
        modal: false,
        resizable: false,
        draggable: true,
        closeOnEscape: false,

        open: function () {
            var $dialog = $(this).parent();

            // прибираємо внутрішні відступи
            $(this).css({
                padding: "0",
                margin: "0",
                overflow: "hidden"
            });

            $dialog.find(".ui-dialog-content").css({
                padding: "0",
                margin: "0",
                overflow: "hidden"
            });

            // одразу коригуємо розмір canvas
            updateDialogSize(width, height);
        },

        resize: function (event, ui) {
            var $dialog = $(this).parent();
            var titlebarHeight = $dialog.find(".ui-dialog-titlebar").outerHeight() || 0;

            var contentHeight = ui.size.height - titlebarHeight;

            var targetEl = getTarget();
            if (targetEl) {
                targetEl.style.width = ui.size.width + "px";
                targetEl.style.height = contentHeight + "px";

                if (screenInstance) {
                    screenInstance._width = ui.size.width;
                    screenInstance._height = contentHeight;

                    screenInstance.setUpWorld(
                        -ui.size.width / 2,
                        -contentHeight / 2,
                        ui.size.width / 2,
                        contentHeight / 2
                    );
                }
            }
        },

        close: function () {
            // Optional
        }
    });

    // Create target element inside dialog
    var targetEl = document.createElement("div");
    targetEl.id = "turtle-canvas-container";

    targetEl.style.width = width + "px";
    targetEl.style.height = height + "px";
    targetEl.style.position = "relative";
    targetEl.style.display = "block";
    targetEl.style.margin = "0";
    targetEl.style.padding = "0";
    targetEl.style.overflow = "hidden";
    targetEl.style.boxSizing = "border-box";

    canvasContainer.appendChild(targetEl);

    return targetEl;
}

/* ------------------------------------------------------------------ */
/*  Target canvas container                                             */
/* ------------------------------------------------------------------ */
var targetEl = (function getConfiguredTarget() {
    var el, target;
    target = (Sk.TurtleGraphics && Sk.TurtleGraphics.target) || "turtle";
    
    // Check if jQuery and jQuery UI are available
    if (typeof $ !== "undefined" && $.fn && $.fn.dialog) {
        // Create jQuery dialog automatically
        var width = (Sk.TurtleGraphics && Sk.TurtleGraphics.width) || 400;
        var height = (Sk.TurtleGraphics && Sk.TurtleGraphics.height) || 400;
        el = createjQueryDialog(width, height);
        
        // Чекаємо створення screenInstance перед оновленням розміру
        //setTimeout(function() {
           // try {
                var scr = screenInstance;
                if (scr) {
                    updateDialogSize(width, height);
                }
           // } catch(e) {}
       // }, 0);
    } else {
        // Fallback to existing element
        el = typeof target === "string" ? document.getElementById(target) : target;
        if (!el) {
            el = document.createElement("div");
            el.id = "turtle";
            document.body.appendChild(el);
        }
        while (el.firstChild) el.removeChild(el.firstChild);
    }
    
    return el;
}());

if (targetEl.turtleInstance) {
    return targetEl.turtleInstance.reset();
}

targetEl.turtleInstance = (function generateTurtleModule(targetEl) {
    /* ---------------------------------------------------------------- */
    /*  Asset loader                                                     */
    /* ---------------------------------------------------------------- */
    function getAsset(name) {
        var assets = cfg.assets;
        var res    = (typeof assets === "function") ? assets(name) : assets[name];
        if (typeof res === "string") {
            return new Promise(function (resolve, reject) {
                var img    = new Image();
                img.onload  = function () { cfg.assets[name] = this; resolve(img); };
                img.onerror = function () { reject(new Error("Missing asset: " + res)); };
                img.src     = res;
            });
        }
        return new InstantPromise(undefined, res);
    }
    
    /* ---------------------------------------------------------------- */
    /*  InstantPromise — synchronous promise-like for speed=0            */
    /* ---------------------------------------------------------------- */
    function InstantPromise(err, val) {
        this.lastResult = val;
        this.lastError  = err;
    }
    InstantPromise.prototype.then = function (fn) {
        if (this.lastError) return this;
        try {
            this.lastResult = fn(this.lastResult);
        } catch (e) {
            this.lastResult = undefined;
            this.lastError  = e;
        }
        return (this.lastResult instanceof Promise) ? this.lastResult : this;
    };
    InstantPromise.prototype.catch = function (fn) {
        if (this.lastError) {
            try {
                this.lastResult = fn(this.lastError);
                this.lastError = undefined;
            } catch (e) {
                this.lastResult = undefined;
                this.lastError = e;
            }
        }
        return (this.lastResult instanceof Promise) ? this.lastResult : this;
    };
    
    /* ---------------------------------------------------------------- */
    /*  FrameManager                                                     */
    /* ---------------------------------------------------------------- */
    function FrameManager() { this.reset(); }
    var frameManagerInstance;
    function getFrameManager() {
        if (!frameManagerInstance) frameManagerInstance = new FrameManager();
        frameManagerRef = frameManagerInstance; // зберігаємо у зовнішньому scope
        return frameManagerInstance;
    }
    (function (proto) {
        var rafHandle, timeoutHandle;
        function animationFrame(interval) {
            var raf = window.requestAnimationFrame || window.mozRequestAnimationFrame;
            var rafRef;
            if (cfg.animate) {
                if (!interval && raf) {
                    return function (cb) { rafHandle = raf(cb); return rafHandle; };
                }
                return function (cb) {
                    timeoutHandle = window.setTimeout(cb, interval || DEFAULT_DELAY);
                    return timeoutHandle;
                };
            }
            return function (cb) { cb(); };
        }
        proto.willRenderNext = function () {
            return !!(this._buffer && this._frameCount + 1 === this.frameBuffer());
        };
        proto.turtles    = function () { return this._turtles; };
        proto.addTurtle  = function (t) { this._turtles.push(t); };
        proto.reset = function () {
            if (this._turtles) {
                for (var i = this._turtles.length; 0 <= --i;) this._turtles[i].reset();
            }
            this._turtles    = [];
            this._frames     = [];
            this._frameCount = 0;
            this._buffer     = 1;
            this._rate       = 0;
            this._animationFrame = animationFrame();
            if (rafHandle)     { (window.cancelAnimationFrame || window.mozCancelAnimationFrame)(rafHandle); rafHandle = undefined; }
            if (timeoutHandle) { window.clearTimeout(timeoutHandle); timeoutHandle = undefined; }
        };
        proto.addFrame = function (fn, doUpdate, arg) {
            if (arg !== undefined && doUpdate !== false) this._frameCount += 1;
            this.frames().push(fn);
            var flush = !cfg.animate || (this._buffer && this._frameCount === this.frameBuffer());
            return flush ? this.update() : new InstantPromise();
        };
        proto.frames      = function () { return this._frames; };
        proto.frameBuffer = function (n) {
            if (typeof n === "number") {
                this._buffer = 0 | n;
                if (n && n <= this._frameCount) return this.update();
            }
            return this._buffer;
        };
        proto.refreshInterval = function (n) {
            if (typeof n === "number") {
                this._rate = 0 | n;
                this._animationFrame = animationFrame(n);
            }
            return this._rate;
        };
        proto.update = function () {
            return (this._frames && this._frames.length) ? this.requestAnimationFrame() : new InstantPromise();
        };
        proto.requestAnimationFrame = function () {
            var frames   = this._frames;
            var animate  = this._animationFrame;
            var turtles  = this._turtles;
            var sprites  = getScreen().spriteLayer();
            this._frames     = [];
            this._frameCount = 0;
            return new Promise(function (resolve) {
                animate(function paint() {
                    for (var i = 0; i < frames.length; i++) { if (frames[i]) frames[i](); }
                    clearLayer(sprites);
                    for (var j = 0; j < turtles.length; j++) {
                        if (turtles[j].getState().shown) drawTurtle(turtles[j].getState(), sprites);
                    }
                    resolve();
                });
            });
        };
    }(FrameManager.prototype));
    
    /* ---------------------------------------------------------------- */
    /*  MouseHandler                                                     */
    /* ---------------------------------------------------------------- */
    function MouseHandler() {
        var self = this;
        this._target   = getTarget();
        this._managers = {};
        this._handlers = {
            mousedown : function (e) { self.onEvent("mousedown", e); },
            mouseup   : function (e) { self.onEvent("mouseup",   e); },
            mousemove : function (e) { self.onEvent("mousemove", e); }
        };
        for (var type in this._handlers) {
            this._target.addEventListener(type, this._handlers[type]);
        }
    }
    (function (proto) {
        proto.onEvent = function (type, evt) {
            var ex, ey, wx, wy, computed = false;
            var managers = this._managers[type];
            var moveM    = this._managers.mousemove;
            function computeCoords() {
                if (!computed) {
                    var scr   = getScreen();
                    var rect  = scr.spriteLayer().canvas.getBoundingClientRect();
                    ex = 0 | evt.clientX - rect.left;
                    ey = 0 | evt.clientY - rect.top;
                    wx = ex * scr.xScale + scr.llx;
                    wy = ey * scr.yScale + scr.ury;
                    computed = true;
                }
            }
            if ((type === "mousedown" || type === "mouseup") && moveM && moveM.length) {
                computeCoords();
                for (var i = moveM.length; 0 <= --i;) {
                    moveM[i].test(ex, ey, wx, wy) && moveM[i].canMove(type === "mousedown");
                }
            }
            if (managers && managers.length) {
                computeCoords();
                for (var j = managers.length; 0 <= --j;) {
                    if (type === "mousemove" && managers[j].canMove() && managers[j].test(ex, ey, wx, wy)) {
                        managers[j].trigger([wx, wy]);
                    } else if (type === "mousedown" && managers[j].test(ex, ey, wx, wy)) {
                        managers[j].trigger([wx, wy]);
                    }
                }
            }
        };
        proto.reset = function () { this._managers = {}; };
        proto.addManager = function (type, mgr) {
            if (!this._managers[type]) this._managers[type] = [];
            this._managers[type].push(mgr);
        };
    }(MouseHandler.prototype));
    
    /* ---------------------------------------------------------------- */
    /*  EventManager                                                     */
    /* ---------------------------------------------------------------- */
    function EventManager(type, tgt) {
        this._type     = type;
        this._target   = tgt;
        this._handlers = undefined;
        getMouseHandler().addManager(type, this);
    }
    (function (proto) {
        proto.reset    = function () { this._handlers = undefined; };
        proto.canMove  = function (set) {
            if (!this._target || !this._target.hitTest) return false;
            if (set !== undefined) this._target.hitTest.hit = set;
            return this._target.hitTest.hit;
        };
        proto.test    = function (ex, ey, wx, wy) {
            return this._target && this._target.hitTest
                ? this._target.hitTest(ex, ey, wx, wy)
                : !!this._target;
        };
        proto.trigger = function (args) {
            var handlers = this._handlers;
            if (handlers && handlers.length) {
                for (var i = 0; i < handlers.length; i++) handlers[i].apply({}, args);
            }
        };
        proto.addHandler = function (fn, replace) {
            var handlers = this._handlers;
            if (!replace && handlers && handlers.length) {
                while (handlers.shift()) { /* clear */ }
            }
            if (typeof fn === "function") {
                if (!handlers) handlers = this._handlers = [];
                handlers.push(fn);
            } else if (handlers && !handlers.length) {
                this.reset();
            }
        };
    }(EventManager.prototype));
    
    /* ---------------------------------------------------------------- */
    /*  Turtle constructor                                               */
    /* ---------------------------------------------------------------- */
    Turtle.RADIANS = 2 * PI;
    function Turtle(shape) {
        getFrameManager().addTurtle(this);
        this._screen   = getScreen();
        this._managers = {};
        this._shape    = shape.v;
        if (!shapes.hasOwnProperty(this._shape)) {
            throw new Sk.builtin.ValueError(
                "Shape:'" + this._shape + "' not in default shape, please check shape again!"
            );
        }
        this.reset();
    }
    
    /* ---------------------------------------------------------------- */
    /*  Screen constructor                                               */
    /* ---------------------------------------------------------------- */
    function Screen() {
        var hw, hh;
        this._frames    = 1;
        this._delay     = undefined;
        this._bgcolor   = "none";
        this._mode      = "standard";
        this._managers  = {};
        this._keyLogger = {};
        hw = (cfg.worldWidth  || cfg.width  || getWidth())  / 2;
        hh = (cfg.worldHeight || cfg.height || getHeight()) / 2;
        this.setUpWorld(-hw, -hh, hw, hh);
    }
    
    /* ---------------------------------------------------------------- */
    /*  Module-level state                                               */
    /* ---------------------------------------------------------------- */
    var rafHandle, timeoutHandle;
    // screenInstance, mouseHandlerInstance, anonymousTurtle, moduleCounter
    // визначені у зовнішньому scope для доступу з updateDialogSize
    var keyboardFocused = true;
    var DEFAULT_DELAY   = 1000 / 30;
    var shapes = {};
    var typeConverters = {};
    var moduleObj = { __name__: new Sk.builtin.str("turtle") };
    var DEFAULTS = {
        target      : "turtle",
        width       : 400,
        height      : 400,
        worldWidth  : 0,
        worldHeight : 0,
        animate     : true,
        bufferSize  : 0,
        allowUndo   : true,
        assets      : {}
    };
    /* canvas used only for text measurement */
    var _measureCtx = document.createElement("canvas").getContext("2d");
    /* image used for undo restoration */
    var _undoImg    = new Image();
    targetEl.hasAttribute("tabindex") || targetEl.setAttribute("tabindex", 0);
    
    /* ---- type converters ---- */
    typeConverters.FLOAT = function (v) { return new Sk.builtin.float_(v); };
    typeConverters.COLOR = function (v) {
        if (typeof v === "string") return new Sk.builtin.str(v);
        for (var i = 0; i < 3; i++) v[i] = Sk.builtin.assk$(v[i]);
        if (v.length === 4) v[3] = new Sk.builtin.float_(v[3]);
        return new Sk.builtin.tuple(v);
    };
    typeConverters.TURTLE_LIST = function (arr) {
        var out = [];
        for (var i = 0; i < arr.length; i++) out.push(arr[i].skInstance);
        return new Sk.builtin.tuple(out);
    };
    
    /* ---- default shapes ---- */
    shapes.arrow    = [[-10,0],[10,0],[0,10]];
    shapes.square   = [[10,-10],[10,10],[-10,10],[-10,-10]];
    shapes.triangle = [[10,-5.77],[0,11.55],[-10,-5.77]];
    shapes.classic  = [[0,0],[-5,-9],[0,-7],[5,-9]];
    shapes.turtle   = [[0,16],[-2,14],[-1,10],[-4,7],[-7,9],[-9,8],[-6,5],[-7,1],[-5,-3],[-8,-6],[-6,-8],[-4,-5],[0,-7],[4,-5],[6,-8],[8,-6],[5,-3],[7,1],[6,5],[9,8],[7,9],[4,7],[1,10],[2,14]];
    shapes.circle   = [[10,0],[9.51,3.09],[8.09,5.88],[5.88,8.09],[3.09,9.51],[0,10],[-3.09,9.51],[-5.88,8.09],[-8.09,5.88],[-9.51,3.09],[-10,0],[-9.51,-3.09],[-8.09,-5.88],[-5.88,-8.09],[-3.09,-9.51],[-0,-10],[3.09,-9.51],[5.88,-8.09],[8.09,-5.88],[9.51,-3.09]];
    
    /* ---- merge user config ---- */
    var cfg = (function () {
        Sk.TurtleGraphics || (Sk.TurtleGraphics = {});
        for (var k in DEFAULTS) {
            if (!Sk.TurtleGraphics.hasOwnProperty(k)) Sk.TurtleGraphics[k] = DEFAULTS[k];
        }
        return Sk.TurtleGraphics;
    }());
    
    /* ---------------------------------------------------------------- */
    /*  Getters                                                          */
    /* ---------------------------------------------------------------- */
    function getTarget()       { return targetEl; }
    function getScreen()       { return screenInstance || (screenInstance = new Screen()); }
    function getMouseHandler() { return mouseHandlerInstance || (mouseHandlerInstance = new MouseHandler()); }
    function getWidth()        { return 0 | (screenInstance && screenInstance._width  || cfg.width  || getTarget().clientWidth  || 400); }
    function getHeight()       { return 0 | (screenInstance && screenInstance._height || cfg.height || getTarget().clientHeight || 400); }
    
    /* ---------------------------------------------------------------- */
    /*  Canvas layer management                                          */
    /* ---------------------------------------------------------------- */
    function createLayer(zIndex, hidden) {
        var canvas    = document.createElement("canvas");
        var w         = getWidth();
        var h         = getHeight();
        var container = getTarget();
        canvas.width  = w;
        canvas.height = h;
        canvas.style.position = "absolute";
        canvas.style.left     = "0";
        canvas.style.top      = "0";
        canvas.style.display  = hidden ? "none" : "block";
        canvas.style.setProperty("z-index", zIndex);
        if (container.style.position !== "relative" &&
            container.style.position !== "absolute") {
            container.style.position = "relative";
        }
        if (!container.style.width)  container.style.width  = w + "px";
        if (!container.style.height) container.style.height = h + "px";
        container.appendChild(canvas);
        var ctx      = canvas.getContext("2d");
        ctx.lineCap  = "round";
        ctx.lineJoin = "round";
        applyWorld(getScreen(), ctx);
        return ctx;
    }
    
    function removeLayer(ctx) {
        if (ctx && ctx.canvas && ctx.canvas.parentNode) {
            ctx.canvas.parentNode.removeChild(ctx.canvas);
        }
    }
    
    function clearLayer(ctx, fillColor, imgSrc) {
        if (!ctx) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        } else {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        if (imgSrc) ctx.drawImage(imgSrc, 0, 0);
        ctx.restore();
    }
    
    function applyWorld(scr, ctx) {
        if (!ctx) return;
        var fillColor = (scr && ctx === scr._background && scr._bgcolor && scr._bgcolor !== "none")
            ? scr._bgcolor : undefined;
        clearLayer(ctx, fillColor);
        ctx.restore();
        ctx.save();
        ctx.scale(1 / scr.xScale, 1 / scr.yScale);
        ctx.translate(-scr.llx, -scr.ury);
    }
    applyWorldRef = applyWorld; // зберігаємо у зовнішньому scope для updateDialogSize
    drawTurtleRef = drawTurtle; // зберігаємо у зовнішньому scope для updateDialogSize
    
    /* ---------------------------------------------------------------- */
    /*  cancelAnimationFrame helper                                      */
    /* ---------------------------------------------------------------- */
    function cancelRaf() {
        if (rafHandle)     { (window.cancelAnimationFrame || window.mozCancelAnimationFrame)(rafHandle); rafHandle = undefined; }
        if (timeoutHandle) { window.clearTimeout(timeoutHandle); timeoutHandle = undefined; }
    }
    
    /* ---------------------------------------------------------------- */
    /*  Undo support                                                     */
    /* ---------------------------------------------------------------- */
    function pushUndo(turtle) {
        if (!cfg.allowUndo || !turtle._bufferSize) return;
        turtle._undoBuffer || (turtle._undoBuffer = []);
        while (turtle._undoBuffer.length > turtle._bufferSize) turtle._undoBuffer.shift();
        var snapshot = {};
        var props    = ["x","y","angle","radians","color","fill","down","filling","shown","shape","size"];
        for (var i = 0; i < props.length; i++) snapshot[props[i]] = turtle["_" + props[i]];
        turtle._undoBuffer.push(snapshot);
        return turtle.addUpdate(function () {
            snapshot.fillBuffer = this.fillBuffer ? this.fillBuffer.slice() : undefined;
            if (turtle._paper && turtle._paper.canvas) snapshot.image = turtle._paper.canvas.toDataURL();
        }, false);
    }
    
    function popUndo(turtle) {
        if (!turtle._bufferSize || !turtle._undoBuffer) return;
        var snapshot = turtle._undoBuffer.pop();
        if (!snapshot) return;
        for (var k in snapshot) {
            if (k !== "image" && k !== "fillBuffer") turtle["_" + k] = snapshot[k];
        }
        return turtle.addUpdate(function () {
            if (snapshot.image) { _undoImg.src = snapshot.image; }
            clearLayer(this.context(), false, snapshot.image ? _undoImg : undefined);
            delete snapshot.image;
        }, true, snapshot);
    }
    
    /* ---------------------------------------------------------------- */
    /*  Drawing primitives                                               */
    /* ---------------------------------------------------------------- */
    function drawTurtle(state, ctx) {
        if (!ctx) return;
        var shape = shapes[state.shape];
        var scr   = getScreen();
        var xS    = scr.xScale;
        var yS    = scr.yScale;
        var dx    = cos(state.radians) / xS;
        var dy    = sin(state.radians) / yS;
        var headingAngle = atan2(dy, dx) - PI / 2;
        var tilt    = (state.tiltAngle || 0) * PI / 180;
        var sw      = state.stretchFactor ? state.stretchFactor[0] : 1;
        var sl      = state.stretchFactor ? state.stretchFactor[1] : 1;
        var sh      = state.shearFactor   || 0;
        var outline = state.size          || 1;
        ctx.save();
        ctx.translate(state.x, state.y);
        ctx.scale(xS, yS);
        if (shape && shape.nodeName) {
            var nw = shape.naturalWidth, nh = shape.naturalHeight;
            ctx.rotate(headingAngle);
            ctx.drawImage(shape, 0, 0, nw, nh, -nw / 2, -nh / 2, nw, nh);
        } else if (shape instanceof Shape && shape._type === "compound") {
            ctx.rotate(headingAngle + tilt);
            ctx.transform(sl, 0, sh * sl, sw, 0, 0);
            for (var ci = 0; ci < shape._components.length; ci++) {
                var comp = shape._components[ci];
                ctx.beginPath();
                ctx.lineWidth   = outline;
                ctx.strokeStyle = comp.outline || state.color;
                ctx.fillStyle   = comp.fill    || state.fill;
                ctx.moveTo(comp.poly[0][0], comp.poly[0][1]);
                for (var pi = 1; pi < comp.poly.length; pi++) ctx.lineTo(comp.poly[pi][0], comp.poly[pi][1]);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        } else if (Array.isArray(shape)) {
            ctx.rotate(headingAngle + tilt);
            ctx.transform(sl, 0, sh * sl, sw, 0, 0);
            ctx.beginPath();
            ctx.lineWidth   = outline;
            ctx.strokeStyle = state.color;
            ctx.fillStyle   = state.fill;
            ctx.moveTo(-shape[0][0], shape[0][1]);
            for (var i = 1; i < shape.length; i++) ctx.lineTo(-shape[i][0], shape[i][1]);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }
    
    function drawDot(size, color) {
        var ctx = this.context();
        var scr = getScreen();
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        size *= min(abs(scr.xScale), abs(scr.yScale));
        ctx.arc(this.x, this.y, size / 2, 0, Turtle.RADIANS);
        ctx.closePath();
        ctx.fillStyle = color || this.color;
        ctx.fill();
    }
    
    function measureText(txt, font) {
        if (font) _measureCtx.font = font;
        return _measureCtx.measureText(txt).width;
    }
    
    function drawText(txt, align, font) {
        var ctx = this.context();
        if (!ctx) return;
        ctx.save();
        if (font)  ctx.font      = font;
        if (align && align.match(/^(left|right|center)$/)) ctx.textAlign = align;
        ctx.scale(1, -1);
        ctx.fillStyle = this.fill;
        ctx.fillText(txt, this.x, -this.y);
        ctx.restore();
    }
    
    function drawLine(target, isStart) {
        var ctx = this.context();
        if (!ctx) return;
        if (isStart) { ctx.beginPath(); ctx.moveTo(this.x, this.y); }
        ctx.lineWidth   = this.size * getScreen().lineScale;
        ctx.strokeStyle = this.color;
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
    }
    
    function drawFill() {
        var ctx = this.context();
        var buf = this.fillBuffer;
        if (!ctx || !buf || !buf.length) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(buf[0].x, buf[0].y);
        for (var i = 1; i < buf.length; i++) ctx.lineTo(buf[i].x, buf[i].y);
        ctx.closePath();
        ctx.fillStyle = this.fill;
        ctx.fill();
        for (var j = 1; j < buf.length; j++) {
            if (buf[j].stroke) {
                ctx.beginPath();
                ctx.moveTo(buf[j - 1].x, buf[j - 1].y);
                ctx.lineWidth   = buf[j].size * getScreen().lineScale;
                ctx.strokeStyle = buf[j].color;
                ctx.lineTo(buf[j].x, buf[j].y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
    
    /* ---------------------------------------------------------------- */
    /*  Motion helpers                                                   */
    /* ---------------------------------------------------------------- */
    function partialTranslate(turtle, tx, ty, isStart, doUpdate) {
        return function () {
            return turtle.addUpdate(function (target) {
                if (this.down) drawLine.call(this, target, isStart);
            }, doUpdate, { x: tx, y: ty }, isStart);
        };
    }
    
    function translate(turtle, fromX, fromY, dx, dy, isStart, instant) {
        var speed  = turtle._computed_speed;
        var scr    = getScreen();
        var xS     = abs(scr.xScale);
        var yS     = abs(scr.yScale);
        var dist   = sqrt(dx * dx * xS + dy * dy * yS);
        var steps  = speed ? round(max(1, dist / speed)) : 1;
        var cx     = fromX, cy = fromY;
        var chain  = getFrameManager().willRenderNext() ? Promise.resolve() : new InstantPromise();
        turtle.addUpdate(function () {
            if (this.filling) this.fillBuffer.push({ x: this.x, y: this.y, stroke: this.down, color: this.color, size: this.size });
        }, false);
        var isFirst = true;
        for (var i = 0; i < steps; i++) {
            cx = fromX + dx / steps * (i + 1);
            cy = fromY + dy / steps * (i + 1);
            chain = chain.then(partialTranslate(turtle, cx, cy, isStart, speed || !instant));
            isStart = false;
            isFirst = false;
        }
        return chain.then(function () { return [fromX + dx, fromY + dy]; });
    }
    
    function partialRotate(turtle, angle, radians, doUpdate) {
        return function () {
            return turtle.addUpdate(undefined, doUpdate, { angle: angle, radians: radians });
        };
    }
    
    function rotate(turtle, fromAngle, delta, instant) {
        var speed  = turtle._computed_speed;
        var degs   = 360 * (delta / turtle._fullCircle);
        var steps  = speed ? round(max(1, abs(degs) / speed)) : 1;
        var chain  = getFrameManager().willRenderNext() ? Promise.resolve() : new InstantPromise();
        var tmp    = {};
        for (var i = 0; i < steps; i++) {
            calculateHeading(turtle, fromAngle + delta / steps * (i + 1), tmp);
            chain = chain.then(partialRotate(turtle, tmp.angle, tmp.radians, speed || !instant));
        }
        return chain.then(function () { return calculateHeading(turtle, fromAngle + delta); });
    }
    
    function getCoordinates(x, y) {
        if (y === undefined) {
            y = (x && (x.y || x._y || x[1])) || 0;
            x = (x && (x.x || x._x || x[0])) || 0;
        }
        return { x: x, y: y };
    }
    
    /* ---------------------------------------------------------------- */
    /*  Colour utilities                                                 */
    /* ---------------------------------------------------------------- */
    function hexToRGB(hex) {
        var m;
        if ((m = /^rgba?\((\d+),(\d+),(\d+)(?:,([.\d]+))?\)$/.exec(hex))) {
            var arr = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
            if (m[4]) arr.push(parseFloat(m[4]));
            return arr;
        }
        if (/^#?[a-f\d]{3}|[a-f\d]{6}$/i.exec(hex)) {
            if (hex.length === 4) hex = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, function (_, r, g, b) { return r+r+g+g+b+b; });
            var r2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return [parseInt(r2[1], 16), parseInt(r2[2], 16), parseInt(r2[3], 16)];
        }
        return hex;
    }
    
    function createColor(mode, c, g, b, a) {
        if (g !== undefined) c = [c, g, b, a];
        if (Array.isArray(c) && c.length) {
            for (var i = 0; i < 3; i++) {
                if (typeof c[i] !== "number") throw new Sk.builtin.ValueError("bad color sequence");
                if (mode === 255) {
                    c[i] = max(0, min(255, parseInt(c[i])));
                } else {
                    if (c[i] > 1) throw new Sk.builtin.ValueError("bad color sequence");
                    c[i] = max(0, min(255, parseInt(255 * c[i])));
                }
            }
            if (typeof c[3] === "number") {
                c[3] = max(0, min(1, c[3]));
                c = "rgba(" + c.join(",") + ")";
            } else {
                c = "rgb(" + c.slice(0, 3).join(",") + ")";
            }
        } else if (typeof c === "string" && !c.match(/\s*url\s*\(/i)) {
            c = c.replace(/\s+/g, "");
        } else {
            return "black";
        }
        return c;
    }
    
    function calculateHeading(turtle, target, out) {
        out || (out = {});
        if (typeof target === "number") {
            if (turtle._isRadians) {
                out.angle = out.radians = target % Turtle.RADIANS;
            } else if (turtle._fullCircle) {
                out.angle   = target % turtle._fullCircle;
                out.radians = out.angle / turtle._fullCircle * Turtle.RADIANS;
            } else {
                out.angle = out.radians = 0;
            }
            if (out.angle < 0) { out.angle += turtle._fullCircle; out.radians += Turtle.RADIANS; }
        } else {
            out.angle   = turtle._angle   || 0;
            out.radians = turtle._radians || 0;
        }
        return out;
    }
    
    /* ---------------------------------------------------------------- */
    /*  Python ↔ JS function bridge                                      */
    /* ---------------------------------------------------------------- */
    function pyToJsFn(pyFn, self) {
        return function () {
            var args = Array.prototype.slice.call(arguments).map(function (a) { return Sk.ffi.remapToPy(a); });
            if (self !== undefined) args.unshift(self);
            return Sk.misceval.applyAsync(undefined, pyFn, undefined, undefined, undefined, args)
                .catch(Sk.uncaughtException);
        };
    }
    
    /* ---------------------------------------------------------------- */
    /*  addModuleMethod — exposes a Turtle/Screen method to Python       */
    /* ---------------------------------------------------------------- */
    function addModuleMethod(Cls, target, methodName, getInst) {
        var cleanName   = methodName.replace(/^\$/, "");
        var publicName  = cleanName.replace(/_\$[a-z]+\$$/i, "");
        var proto       = Cls.prototype[methodName];
        var maxArgs     = proto.length;
        var minArgs     = proto.minArgs !== undefined ? proto.minArgs : maxArgs;
        var varnames    = proto.co_varnames || [];
        var retType     = proto.returnType;
        var isSk        = proto.isSk;
        var wrapper = function () {
            var allArgs = Array.prototype.slice.call(arguments, 0);
            var inst    = getInst ? getInst() : allArgs.shift().instance;
            if (allArgs.length < minArgs || allArgs.length > maxArgs) {
                var expected = minArgs === maxArgs ? "exactly " + maxArgs : "between " + minArgs + " and " + maxArgs;
                throw new Sk.builtin.TypeError(publicName + "() takes " + expected + " positional argument(s) (" + allArgs.length + " given)");
            }
            for (var i = allArgs.length; 0 <= --i;) {
                if (allArgs[i] === undefined) continue;
                if      (allArgs[i] instanceof Sk.builtin.func)   allArgs[i] = pyToJsFn(allArgs[i]);
                else if (allArgs[i] instanceof Sk.builtin.method)  allArgs[i] = pyToJsFn(allArgs[i].im_func, allArgs[i].im_self);
                else if (allArgs[i] && allArgs[i].$d instanceof Sk.builtin.dict && allArgs[i].instance) allArgs[i] = allArgs[i].instance;
                else allArgs[i] = Sk.ffi.remapToJs(allArgs[i]);
            }
            var stripped = allArgs.slice();
            var cleaned  = [];
            for (var j = stripped.length; 0 <= j; --j) {
                if (stripped[j] !== null) cleaned[j] = stripped[j];
            }
            var result;
            try {
                result = inst[methodName].apply(inst, cleaned);
            } catch (err) {
                if (window && window.console) { window.console.log("wrapped method failed"); window.console.log(err.stack); }
                throw err;
            }
            if (result instanceof InstantPromise) result = result.lastResult;
            if (result instanceof Promise) {
                var suspension  = new Sk.misceval.Suspension();
                var resolvedVal;
                suspension.resume = function () {
                    if (resolvedVal === undefined) return Sk.builtin.none.none$;
                    if (isSk) return resolvedVal;
                    if (typeof retType === "function") return retType(resolvedVal);
                    return Sk.ffi.remapToPy(resolvedVal);
                };
                suspension.data = {
                    type    : "Sk.promise",
                    promise : result.then(function (v) { resolvedVal = v; return v; })
                        .catch(function (e) { if (window && window.console) window.console.log(e.stack); throw e; })
                };
                return suspension;
            }
            if (result === undefined) return Sk.builtin.none.none$;
            if (isSk) return result;
            if (typeof retType === "function") return retType(result);
            return Sk.ffi.remapToPy(result);
        };
        wrapper.co_name      = new Sk.builtin.str(publicName);
        wrapper.co_varnames  = varnames.slice();
        wrapper.$defaults    = [];
        for (var d = minArgs; d < varnames.length; d++) wrapper.$defaults.push(Sk.builtin.none.none$);
        if (!getInst) wrapper.co_varnames.unshift("self");
        target[cleanName] = new Sk.builtin.func(wrapper);
        if (publicName !== cleanName) {
            target[publicName] = target[cleanName];
        }
    }
    
    /* ---------------------------------------------------------------- */
    /*  Turtle prototype methods                                         */
    /* ---------------------------------------------------------------- */
    (function (proto) {
        proto.hitTest = function (ex, ey) {
            var hitCtx = getScreen().hitTestLayer();
            clearLayer(hitCtx);
            drawTurtle(this.getState(), hitCtx);
            var px = hitCtx.getImageData(ex, ey, 1, 1).data;
            return px[3] || px[0] || px[1] || px[2];
        };
        
        var RENDER_SENTINEL = {};
        proto.addUpdate = function (fn, doUpdate, stateUpdate) {
            var self  = this;
            var state = this.getState();
            var extra = Array.prototype.slice.call(arguments, stateUpdate ? 2 : 3);
            var frameArg = stateUpdate !== undefined ? stateUpdate : (doUpdate !== false ? RENDER_SENTINEL : undefined);
            return getFrameManager().addFrame(function () {
                if (fn) fn.apply(state, extra);
                if (stateUpdate && stateUpdate !== RENDER_SENTINEL) {
                    for (var k in stateUpdate) state[k] = stateUpdate[k];
                }
            }, doUpdate, frameArg);
        };
        
        proto.getState = function () {
            var self = this;
            if (!this._state) {
                this._state = {
                    x: this._x, y: this._y, angle: this._angle, radians: this._radians,
                    shape: this._shape, color: this._color, fill: this._fill,
                    filling: this._filling, size: this._size, speed: this._computed_speed,
                    down: this._down, shown: this._shown, colorMode: this._colorMode,
                    tiltAngle    : this._tiltAngle    || 0,
                    stretchFactor: this._stretchFactor || [1, 1],
                    shearFactor  : this._shearFactor   || 0,
                    context: function () { return self.getPaper(); }
                };
            }
            return this._state;
        };
        
        proto.translate = function (fromX, fromY, dx, dy, instant) {
            var self = this;
            return translate(this, fromX, fromY, dx, dy, true, instant).then(function (pos) {
                self._x = pos[0]; self._y = pos[1];
                if (self._polyRecording && self._polyVertices) {
                    self._polyVertices.push({ x: self._x, y: self._y });
                }
            });
        };
        
        proto.rotate = function (fromAngle, delta, instant) {
            var self = this;
            return rotate(this, fromAngle, delta, instant).then(function (h) {
                self._angle = h.angle; self._radians = h.radians;
            });
        };
        
        proto.queueMoveBy = function (fromX, fromY, radians, dist) {
            var dx = cos(radians) * dist;
            var dy = sin(radians) * dist;
            return this.translate(fromX, fromY, dx, dy, true);
        };
        
        proto.queueTurnTo = function (fromAngle, targetAngle) {
            targetAngle %= this._fullCircle;
            if (targetAngle < 0) targetAngle += this._fullCircle;
            return this.rotate(fromAngle, targetAngle - fromAngle);
        };
        
        proto.getManager = function (type) {
            if (!this._managers[type]) this._managers[type] = new EventManager(type, this);
            return this._managers[type];
        };
        
        proto.getPaper = function () {
            if (!this._paper) this._paper = createLayer(2);
            return this._paper;
        };
        
        proto.reset = function () {
            this._x              = 0;
            this._y              = 0;
            this._radians        = 0;
            this._angle          = 0;
            this._shown          = true;
            this._down           = true;
            this._color          = "black";
            this._fill           = "black";
            this._size           = 1;
            this._filling        = false;
            this._undoBuffer     = [];
            this._speed          = 3;
            this._computed_speed = 5;
            this._colorMode      = 1;
            this._state          = undefined;
            this._tiltAngle      = 0;
            this._resizeMode     = "noresize";
            this._stretchFactor  = [1, 1];
            this._shearFactor    = 0;
            this._stampId        = 0;
            this._stamps         = {};
            this._polyRecording  = false;
            this._polyVertices   = undefined;
            this._lastPoly       = undefined;
            for (var k in this._managers) this._managers[k].reset();
            this._isRadians   = false;
            this._fullCircle  = 360;
            this._bufferSize  = typeof cfg.bufferSize === "number" ? cfg.bufferSize : 0;
            removeLayer(this._paper);
            this._paper = undefined;
        };
        
        /* ================================================================
        *  NAVIGATION / MOTION
        * ================================================================ */
        proto.$forward = proto.$fd = function (dist) {
            pushUndo(this);
            return this.queueMoveBy(this._x, this._y, this._radians, dist);
        };
        proto.$forward.co_varnames = proto.$fd.co_varnames = ["distance"];
        
        proto.$backward = proto.$back = proto.$bk = function (dist) {
            pushUndo(this);
            return this.queueMoveBy(this._x, this._y, this._radians, -dist);
        };
        proto.$backward.co_varnames = proto.$back.co_varnames = proto.$bk.co_varnames = ["distance"];
        
        proto.$right = proto.$rt = function (angle) {
            pushUndo(this);
            return this.rotate(this._angle, -angle);
        };
        proto.$right.co_varnames = proto.$rt.co_varnames = ["angle"];
        
        proto.$left = proto.$lt = function (angle) {
            pushUndo(this);
            return this.rotate(this._angle, angle);
        };
        proto.$left.co_varnames = proto.$lt.co_varnames = ["angle"];
        
        proto.$goto_$rw$ = proto.$setpos = proto.$setposition = function (x, y) {
            var c = getCoordinates(x, y);
            pushUndo(this);
            return this.translate(this._x, this._y, c.x - this._x, c.y - this._y, true);
        };
        proto.$goto_$rw$.co_varnames =
        proto.$setpos.co_varnames    =
        proto.$setposition.co_varnames = ["x", "y"];
        proto.$goto_$rw$.minArgs =
        proto.$setpos.minArgs    =
        proto.$setposition.minArgs = 1;
        
        proto.$setx = function (x) { return this.translate(this._x, this._y, x - this._x, 0, true); };
        proto.$setx.co_varnames = ["x"];
        
        proto.$sety = function (y) { return this.translate(this._x, this._y, 0, y - this._y, true); };
        proto.$sety.co_varnames = ["y"];
        
        proto.$home = function () {
            var self  = this;
            var angle = this._angle;
            pushUndo(this);
            return self.translate(self._x, self._y, -self._x, -self._y, true)
                .then(function () { return self.queueTurnTo(self._angle, 0); })
                .then(function () {});
        };
        
        proto.$setheading = proto.$seth = function (angle) {
            pushUndo(this);
            return this.queueTurnTo(this._angle, angle);
        };
        proto.$setheading.co_varnames = proto.$seth.co_varnames = ["angle"];
        
        proto.$teleport = function (x, y, fillGap) {
            var c       = getCoordinates(x, y);
            var wasDown = this._down;
            var self    = this;
            var wasFilling = this._filling;
            if (wasFilling && !fillGap) {
                this.$end_fill();
            }
            this._down = fillGap ? this._down : false;
            return this.translate(this._x, this._y, c.x - this._x, c.y - this._y, true)
                .then(function () {
                    self._down = wasDown;
                    if (wasFilling && !fillGap) {
                        self.$begin_fill();
                    }
                });
        };
        proto.$teleport.co_varnames = ["x", "y", "fill_gap"];
        proto.$teleport.minArgs     = 1;
        
        /* ---- circle ---- */
        proto.$circle = function (radius, extent, steps) {
            var self       = this;
            var fromX      = this._x, fromY = this._y;
            var fromAngle  = this._angle;
            var heading    = {};
            var lineScale  = 1 / getScreen().lineScale;
            var isFirst    = true;
            pushUndo(this);
            if (extent === undefined) extent = self._fullCircle;
            if (steps  === undefined) {
                var ratio = abs(extent) / self._fullCircle;
                steps = 1 + (0 | min(11 + abs(radius * lineScale) / 6, 59) * ratio);
            }
            var segAngle   = extent / steps;
            var half       = 0.5 * segAngle;
            var chordLen   = 2 * radius * sin(segAngle * PI / self._fullCircle);
            var finalAngle = (radius < 0) ? fromAngle - extent : fromAngle + extent;
            if (radius < 0) { chordLen = -chordLen; segAngle = -segAngle; half = -half; }
            var chain = getFrameManager().willRenderNext() ? Promise.resolve() : new InstantPromise();
            var cx    = fromX, cy = fromY;
            var curA  = fromAngle + half;
            function circleRotate(a, r) { return function () { return self.addUpdate(undefined, false, { angle: a, radians: r }); }; }
            function circleStep(sx, sy, dx, dy, first) {
                return function () { return self.translate(sx, sy, dx, dy, first); };
            }
            for (var i = 0; i < steps; i++) {
                calculateHeading(self, curA + segAngle * i, heading);
                var dx = cos(heading.radians) * chordLen;
                var dy = sin(heading.radians) * chordLen;
                chain  = chain.then(circleRotate(heading.angle, heading.radians))
                    .then(circleStep(cx, cy, dx, dy, isFirst));
                cx    += dx;
                cy    += dy;
                isFirst = false;
            }
            return chain.then(function () {
                calculateHeading(self, finalAngle, heading);
                self._angle   = heading.angle;
                self._radians = heading.radians;
                return self.addUpdate(undefined, true, heading);
            });
        };
        proto.$circle.co_varnames = ["radius", "extent", "steps"];
        proto.$circle.minArgs     = 1;
        
        /* ================================================================
        *  QUERY / STATE
        * ================================================================ */
        proto.$position = proto.$pos = function () { return [this.$xcor(), this.$ycor()]; };
        proto.$position.returnType = function (v) { return new Sk.builtin.tuple([new Sk.builtin.float_(v[0]), new Sk.builtin.float_(v[1])]); };
        proto.$xcor = function () { return abs(this._x) < 1e-13 ? 0 : this._x; };
        proto.$xcor.returnType = typeConverters.FLOAT;
        proto.$ycor = function () { return abs(this._y) < 1e-13 ? 0 : this._y; };
        proto.$ycor.returnType = typeConverters.FLOAT;
        proto.$heading = function () { return abs(this._angle) < 1e-13 ? 0 : this._angle; };
        proto.$heading.returnType = typeConverters.FLOAT;
        
        proto.$towards = function (x, y) {
            var c   = getCoordinates(x, y);
            var ang = PI + atan2(this._y - c.y, this._x - c.x);
            return ang * (this._fullCircle / Turtle.RADIANS);
        };
        proto.$towards.co_varnames = ["x", "y"];
        proto.$towards.minArgs     = 1;
        proto.$towards.returnType  = typeConverters.FLOAT;
        
        proto.$distance = function (x, y) {
            var c = getCoordinates(x, y);
            var dx = c.x - this._x, dy = c.y - this._y;
            return sqrt(dx * dx + dy * dy);
        };
        proto.$distance.co_varnames = ["x", "y"];
        proto.$distance.minArgs     = 1;
        proto.$distance.returnType  = typeConverters.FLOAT;
        
        /* ================================================================
        *  PEN CONTROL
        * ================================================================ */
        proto.$pendown = proto.$down = proto.$pd = function () {
            this._down = true;
            return this.addUpdate(undefined, false, { down: true });
        };
        
        proto.$penup = proto.$up = proto.$pu = function () {
            this._down = false;
            return this.addUpdate(undefined, false, { down: false });
        };
        
        proto.$isdown = function () { return this._down; };
        
        proto.$pensize = proto.$width = function (w) {
            if (w === undefined) return this._size;
            this._size = w;
            return this.addUpdate(undefined, this._shown, { size: w });
        };
        proto.$pensize.minArgs = proto.$width.minArgs = 0;
        proto.$pensize.co_varnames = proto.$width.co_varnames = ["width"];
        
        proto.$pen = function (pendict) {
            if (pendict === undefined) {
                return {
                    shown        : this._shown,
                    pendown      : this._down,
                    pencolor     : this._color,
                    fillcolor    : this._fill,
                    pensize      : this._size,
                    speed        : this._speed,
                    resizemode   : this._resizeMode,
                    stretchfactor: this._stretchFactor ? [this._stretchFactor[0], this._stretchFactor[1]] : [1, 1],
                    shearfactor  : this._shearFactor || 0,
                    outline      : this._size,
                    tilt         : this._tiltAngle || 0
                };
            }
            if (pendict.pendown      !== undefined) this._down          = pendict.pendown;
            if (pendict.pencolor     !== undefined) this._color         = pendict.pencolor;
            if (pendict.fillcolor    !== undefined) this._fill          = pendict.fillcolor;
            if (pendict.pensize      !== undefined) this._size          = pendict.pensize;
            if (pendict.outline      !== undefined) this._size          = pendict.outline;
            if (pendict.speed        !== undefined) this.$speed(pendict.speed);
            if (pendict.shown        !== undefined) this._shown         = pendict.shown;
            if (pendict.resizemode   !== undefined) this._resizeMode    = pendict.resizemode;
            if (pendict.stretchfactor !== undefined) this._stretchFactor = pendict.stretchfactor;
            if (pendict.shearfactor  !== undefined) this._shearFactor   = pendict.shearfactor;
            if (pendict.tilt         !== undefined) this._tiltAngle     = pendict.tilt;
            return this.addUpdate(undefined, this._shown, {
                down         : this._down,
                color        : this._color,
                fill         : this._fill,
                size         : this._size,
                shown        : this._shown,
                tiltAngle    : this._tiltAngle,
                stretchFactor: this._stretchFactor,
                shearFactor  : this._shearFactor
            });
        };
        proto.$pen.minArgs     = 0;
        proto.$pen.co_varnames = ["pen", "pendict"];
        
        /* ================================================================
        *  COLOUR
        * ================================================================ */
        proto.$pencolor = function (r, g, b, a) {
            if (r === undefined) return hexToRGB(this._color);
            this._color = createColor(this._colorMode, r, g, b, a);
            return this.addUpdate(undefined, this._shown, { color: this._color });
        };
        proto.$pencolor.co_varnames = ["r", "g", "b", "a"];
        proto.$pencolor.minArgs     = 0;
        proto.$pencolor.returnType  = typeConverters.COLOR;
        
        proto.$fillcolor = function (r, g, b, a) {
            if (r === undefined) return hexToRGB(this._fill);
            this._fill = createColor(this._colorMode, r, g, b, a);
            return this.addUpdate(undefined, this._shown, { fill: this._fill });
        };
        proto.$fillcolor.co_varnames = ["r", "g", "b", "a"];
        proto.$fillcolor.minArgs     = 0;
        proto.$fillcolor.returnType  = typeConverters.COLOR;
        
        proto.$color = function (c, f, b, a) {
            if (c === undefined) return [this.$pencolor(), this.$fillcolor()];
            if (f !== undefined && b === undefined && a === undefined) {
                this._color = createColor(this._colorMode, c);
                this._fill  = createColor(this._colorMode, f);
            } else {
                this._color = this._fill = createColor(this._colorMode, c, f, b, a);
            }
            return this.addUpdate(undefined, this._shown, { color: this._color, fill: this._fill });
        };
        proto.$color.minArgs     = 0;
        proto.$color.co_varnames = ["color", "fill", "b", "a"];
        proto.$color.returnType  = function (v) { return new Sk.builtin.tuple([typeConverters.COLOR(v[0]), typeConverters.COLOR(v[1])]); };
        
        proto.$colormode = function (cmode) {
            if (cmode === undefined) return this._colorMode;
            this._colorMode = (cmode === 255) ? 255 : 1;
            return this.addUpdate(undefined, this._shown, { colorMode: this._colorMode });
        };
        proto.$colormode.minArgs     = 0;
        proto.$colormode.co_varnames = ["cmode"];
        proto.$colormode.returnType  = function (v) { return v === 255 ? new Sk.builtin.int_(255) : new Sk.builtin.float_(1); };
        
        /* ================================================================
        *  FILL
        * ================================================================ */
        proto.$fill = function (flag) {
            if (flag === undefined) return this._filling;
            flag = !!flag;
            if (flag === this._filling) return;
            this._filling = flag;
            if (flag) {
                pushUndo(this);
                return this.addUpdate(undefined, false, { filling: true, fillBuffer: [{ x: this._x, y: this._y }] });
            } else {
                pushUndo(this);
                return this.addUpdate(function () {
                    this.fillBuffer.push(this);
                    drawFill.call(this);
                }, true, { filling: false, fillBuffer: undefined });
            }
        };
        proto.$fill.co_varnames = ["flag"];
        proto.$fill.minArgs     = 0;
        proto.$begin_fill = function () { return this.$fill(true);  };
        proto.$end_fill   = function () { return this.$fill(false); };
        proto.$filling = function () { return this._filling; };
        
        /* ================================================================
        *  STAMP / DOT / WRITE
        * ================================================================ */
        proto.$stamp = function () {
            var self = this;
            var id   = ++self._stampId;
            pushUndo(this);
            var p = this.addUpdate(function () {
                drawTurtle(this, this.context());
                self._stamps[id] = { x: this.x, y: this.y };
            }, true);
            if (p instanceof Promise) {
                return p.then(function () { return id; });
            }
            return id;
        };
        proto.$stamp.returnType = function (v) {
            return new Sk.builtin.int_(v || 0);
        };
        
        proto.$clearstamp = function (stampId) {
            var self = this;
            delete self._stamps[stampId];
            return this.addUpdate(function () {
                clearLayer(this.context());
            }, true);
        };
        proto.$clearstamp.co_varnames = ["stampid"];
        
        proto.$clearstamps = function (n) {
            var self = this;
            if (n === undefined || n === null) {
                self._stamps = {};
            } else {
                var ids = Object.keys(self._stamps).map(Number);
                if (n > 0) ids = ids.slice(0, n);
                else       ids = ids.slice(ids.length + n);
                for (var i = 0; i < ids.length; i++) delete self._stamps[ids[i]];
            }
            return this.addUpdate(function () {
                clearLayer(this.context());
            }, true);
        };
        proto.$clearstamps.co_varnames = ["n"];
        proto.$clearstamps.minArgs     = 0;
        
        proto.$dot = function (size, color, g, b, a) {
            pushUndo(this);
            size  = Sk.builtin.asnum$(size);
            size  = (typeof size === "number") ? max(1, 0 | abs(size)) : max(this._size + 4, 2 * this._size);
            color = (color === undefined) ? this._color : createColor(this._colorMode, color, g, b, a);
            return this.addUpdate(drawDot, true, undefined, size, color);
        };
        proto.$dot.co_varnames = ["size", "color", "g", "b", "a"];
        proto.$dot.minArgs     = 0;
        
        proto.$write = function (text, move, align, font) {
            var self = this;
            pushUndo(this);
            text += "";
            if (font && Array.isArray(font)) {
                function unwrap(v) { return (v && v.v !== undefined) ? v.v : v; }
                var fontFamily = unwrap(font[0]);
                var fontSize   = unwrap(font[1]);
                var fontAttrib = unwrap(font[2]);
                if (typeof fontFamily !== "string" || !fontFamily) fontFamily = "Arial";
                if (fontSize === undefined || fontSize === null)   fontSize   = 12;
                if (typeof fontAttrib !== "string" || !fontAttrib) fontAttrib = "normal";
                if (typeof fontSize === "number") fontSize = fontSize + "px";
                var fontStyle  = fontAttrib.indexOf("italic") !== -1 ? "italic" : "";
                var fontWeight = fontAttrib.indexOf("bold")   !== -1 ? "bold"   : "";
                font = [fontStyle, fontWeight, fontSize, fontFamily].filter(Boolean).join(" ");
            }
            align || (align = "left");
            var chain = this.addUpdate(drawText, true, undefined, text, align, font);
            if (move && (align === "left" || align === "center")) {
                var w = measureText(text, font);
                if (align === "center") w /= 2;
                chain = chain.then(function () {
                    var s = self.getState();
                    return self.translate(s.x, s.y, w, 0, true);
                });
            }
            return chain;
        };
        proto.$write.co_varnames = ["message", "move", "align", "font"];
        proto.$write.minArgs     = 1;
        
        /* ================================================================
        *  SPEED
        * ================================================================ */
        var SPEED_NAMES = { fastest: 0, fast: 10, normal: 6, slow: 3, slowest: 1 };
        proto.$speed = function (speed) {
            if (speed === undefined) return this._speed;
            if (typeof speed === "string") speed = SPEED_NAMES[speed.toLowerCase()] !== undefined ? SPEED_NAMES[speed.toLowerCase()] : 6;
            speed = +speed;
            if (speed > 10 || speed < 0.5) speed = 0;
            speed = 0 | speed;
            this._speed          = speed;
            this._computed_speed = max(0, 2 * speed - 1);
            return this.addUpdate(undefined, false, { speed: this._computed_speed });
        };
        proto.$speed.minArgs     = 0;
        proto.$speed.co_varnames = ["speed"];
        
        /* ================================================================
        *  VISIBILITY / SHAPE
        * ================================================================ */
        proto.$showturtle = proto.$st = function () {
            this._shown = true;
            return this.addUpdate(undefined, true, { shown: true });
        };
        
        proto.$hideturtle = proto.$ht = function () {
            this._shown = false;
            return this.addUpdate(undefined, true, { shown: false });
        };
        
        proto.$isvisible = function () { return this._shown; };
        
        proto.$shape = function (name) {
            if (name && shapes[name]) {
                this._shape = name;
                return this.addUpdate(undefined, this._shown, { shape: name });
            }
            return this._shape;
        };
        proto.$shape.minArgs     = 0;
        proto.$shape.co_varnames = ["name"];
        
        proto.$shapesize = proto.$turtlesize = function (stretchWid, stretchLen, outline) {
            if (stretchWid === undefined) {
                return [this._stretchFactor[0], this._stretchFactor[1], this._size];
            }
            if (stretchLen === undefined) stretchLen = stretchWid;
            this._stretchFactor = [stretchWid, stretchLen];
            if (outline !== undefined) this._size = outline;
            this._resizeMode = "user";
            return this.addUpdate(undefined, this._shown, {
                stretchFactor: this._stretchFactor,
                size         : this._size
            });
        };
        proto.$shapesize.minArgs = proto.$turtlesize.minArgs = 0;
        proto.$shapesize.co_varnames = proto.$turtlesize.co_varnames = ["stretch_wid", "stretch_len", "outline"];
        
        proto.$resizemode = function (rmode) {
            if (rmode === undefined) return this._resizeMode;
            this._resizeMode = rmode;
            return this.addUpdate(undefined, this._shown, { resizeMode: this._resizeMode });
        };
        proto.$resizemode.minArgs     = 0;
        proto.$resizemode.co_varnames = ["rmode"];
        
        proto.$tilt = function (angle) {
            this._tiltAngle = (this._tiltAngle || 0) + angle;
            return this.addUpdate(undefined, this._shown, { tiltAngle: this._tiltAngle });
        };
        proto.$tilt.co_varnames = ["angle"];
        
        proto.$settiltangle = function (angle) {
            this._tiltAngle = angle;
            return this.addUpdate(undefined, this._shown, { tiltAngle: this._tiltAngle });
        };
        proto.$settiltangle.co_varnames = ["angle"];
        
        proto.$tiltangle = function (angle) {
            if (angle === undefined) return this._tiltAngle || 0;
            this._tiltAngle = angle;
            return this.addUpdate(undefined, this._shown, { tiltAngle: this._tiltAngle });
        };
        proto.$tiltangle.minArgs     = 0;
        proto.$tiltangle.co_varnames = ["angle"];
        proto.$tiltangle.returnType  = typeConverters.FLOAT;
        
        proto.$shapetransform = function (t11, t12, t21, t22) {
            if (t11 === undefined) {
                var sw = this._stretchFactor ? this._stretchFactor[0] : 1;
                var sl = this._stretchFactor ? this._stretchFactor[1] : 1;
                var sh = this._shearFactor   || 0;
                var ta = (this._tiltAngle    || 0) * PI / 180;
                var c  = cos(ta), s = sin(ta);
                return [sl * c - sh * sw * s,
                    sl * s + sh * sw * c,
                    -sw * s,
                    sw * c];
            }
            var det = t11 * t22 - t12 * t21;
            if (abs(det) < 1e-10) {
                throw new Sk.builtin.ValueError("shapetransform: matrix determinant must not be zero");
            }
            var sl2 = sqrt(t11 * t11 + t12 * t12);
            var sw2 = sqrt(t21 * t21 + t22 * t22);
            this._stretchFactor = [sw2, sl2];
            this._tiltAngle  = atan2(t12, t11) * 180 / PI;
            this._shearFactor = (t11 * t21 + t12 * t22) / (sl2 * sl2);
            return this.addUpdate(undefined, this._shown, {
                tiltAngle    : this._tiltAngle,
                stretchFactor: this._stretchFactor,
                shearFactor  : this._shearFactor
            });
        };
        proto.$shapetransform.minArgs     = 0;
        proto.$shapetransform.co_varnames = ["t11", "t12", "t21", "t22"];
        
        proto.$get_shapepoly = function () {
            var s = shapes[this._shape];
            if (!s || !Array.isArray(s)) return null;
            return s.map(function (pt) { return [pt[0], pt[1]]; });
        };
        
        proto.$shearfactor = function (shear) {
            if (shear === undefined) return this._shearFactor || 0;
            this._shearFactor = shear;
            return this.addUpdate(undefined, this._shown, { shearFactor: this._shearFactor });
        };
        proto.$shearfactor.minArgs     = 0;
        proto.$shearfactor.co_varnames = ["shear"];
        proto.$shearfactor.returnType  = typeConverters.FLOAT;
        
        /* ================================================================
        *  POLYGON RECORDING
        * ================================================================ */
        proto.$begin_poly = function () {
            this._polyRecording = true;
            this._polyVertices  = [{ x: this._x, y: this._y }];
        };
        
        proto.$end_poly = function () {
            this._polyRecording = false;
            if (this._polyVertices && this._polyVertices.length) {
                this._lastPoly = this._polyVertices.slice();
            }
            this._polyVertices = undefined;
        };
        
        proto.$get_poly = function () {
            if (!this._lastPoly) return null;
            return this._lastPoly.map(function (v) { return [v.x, v.y]; });
        };
        
        /* ================================================================
        *  UNIT SYSTEM
        * ================================================================ */
        proto.$degrees = function (fullcircle) {
            fullcircle = (typeof fullcircle === "number") ? abs(fullcircle) : 360;
            this._isRadians = false;
            this._angle     = fullcircle && this._fullCircle
                ? this._angle / this._fullCircle * fullcircle
                : (this._radians = 0);
            this._fullCircle = fullcircle;
            return this.addUpdate(undefined, false, { angle: this._angle, radians: this._radians });
        };
        proto.$degrees.minArgs     = 0;
        proto.$degrees.co_varnames = ["fullcircle"];
        proto.$degrees.returnType  = typeConverters.FLOAT;
        
        proto.$radians = function () {
            if (!this._isRadians) {
                this._isRadians  = true;
                this._angle      = this._radians;
                this._fullCircle = Turtle.RADIANS;
            }
            return this._angle;
        };
        proto.$radians.returnType = typeConverters.FLOAT;
        
        /* ================================================================
        *  UNDO
        * ================================================================ */
        proto.$undo = function () { popUndo(this); };
        proto.$undobufferentries = function () { return this._undoBuffer ? this._undoBuffer.length : 0; };
        proto.$setundobuffer = function (size) {
            this._bufferSize = (typeof size === "number") ? min(abs(size), 1000) : 0;
        };
        proto.$setundobuffer.co_varnames = ["size"];
        
        /* ================================================================
        *  SCREEN DELEGATION
        * ================================================================ */
        proto.$window_width  = function () { return this._screen.$window_width(); };
        proto.$window_height = function () { return this._screen.$window_height(); };
        proto.$tracer = function (n, delay) { return this._screen.$tracer(n, delay); };
        proto.$tracer.minArgs     = 0;
        proto.$tracer.co_varnames = ["n", "delay"];
        proto.$update = function () { return this._screen.$update(); };
        proto.$delay = function (d) { return this._screen.$delay(d); };
        proto.$delay.minArgs     = 0;
        proto.$delay.co_varnames = ["delay"];
        proto.$mainloop = proto.$done = function () { return this._screen.$mainloop(); };
        proto.$reset = function () { this.reset(); return this.$clear(); };
        proto.$clear = function () {
            return this.addUpdate(function () { clearLayer(this.context()); }, true);
        };
        
        /* ================================================================
        *  EVENTS
        * ================================================================ */
        proto.$onclick = function (fn, btn, add) {
            this.getManager("mousedown").addHandler(fn, add);
        };
        proto.$onclick.minArgs     = 1;
        proto.$onclick.co_varnames = ["method", "btn", "add"];
        
        proto.$onrelease = function (fn, btn, add) {
            this.getManager("mouseup").addHandler(fn, add);
        };
        proto.$onrelease.minArgs     = 1;
        proto.$onrelease.co_varnames = ["method", "btn", "add"];
        
        proto.$ondrag = function (fn, btn, add) {
            this.getManager("mousemove").addHandler(fn, add);
        };
        proto.$ondrag.minArgs     = 1;
        proto.$ondrag.co_varnames = ["method", "btn", "add"];
        
        /* ================================================================
        *  MISC
        * ================================================================ */
        proto.$getscreen = function () {
            return Sk.misceval.callsimArray(moduleObj.Screen);
        };
        proto.$getscreen.isSk = true;
        
        proto.$getturtle = proto.$getpen = function () { return this.skInstance; };
        proto.$getturtle.isSk = true;
        
        proto.$clone = function () {
            var newSk = Sk.misceval.callsimOrSuspendArray(moduleObj.Turtle);
            var src   = this;
            var dst   = newSk.instance;
            ["_x","_y","_angle","_radians","_shape","_color","_fill","_filling",
                "_size","_computed_speed","_down","_shown","_colorMode","_isRadians",
                "_fullCircle","_bufferSize","_undoBuffer",
                "_tiltAngle","_resizeMode","_shearFactor","_stretchFactor",
                "_stampId","_stamps"].forEach(function (k) {
                    dst[k] = Array.isArray(src[k]) ? src[k].slice() : src[k];
                });
            newSk._clonedFrom = src;
            return newSk;
        };
        proto.$clone.returnType = function (v) { return v; };
    }(Turtle.prototype));
    
    /* ---------------------------------------------------------------- */
    /*  Screen prototype methods                                         */
    /* ---------------------------------------------------------------- */
    (function (proto) {
        proto.spriteLayer   = function () { return this._sprites    || (this._sprites    = createLayer(3)); };
        proto.bgLayer       = function () { return this._background || (this._background = createLayer(1)); };
        proto.hitTestLayer  = function () { return this._hitTest    || (this._hitTest    = createLayer(0, true)); };
        
        proto.getManager = function (type) {
            if (!this._managers[type]) this._managers[type] = new EventManager(type, this);
            return this._managers[type];
        };
        
        proto.reset = function () {
            for (var k in this._keyLogger) {
                window.clearInterval(this._keyLogger[k]);
                window.clearTimeout(this._keyLogger[k]);
                delete this._keyLogger[k];
            }
            if (this._keyDownListener) { getTarget().removeEventListener("keydown", this._keyDownListener); this._keyDownListener = undefined; }
            if (this._keyUpListener)   { getTarget().removeEventListener("keyup",   this._keyUpListener);   this._keyUpListener   = undefined; }
            if (this._timer) { window.clearTimeout(this._timer); this._timer = undefined; }
            for (var m in this._managers) this._managers[m].reset();
            this._mode = "standard";
            removeLayer(this._sprites);    this._sprites    = undefined;
            removeLayer(this._background); this._background = undefined;
        };
        
        proto.setUpWorld = function (llx, lly, urx, ury) {
            this.llx       = llx;
            this.lly       = lly;
            this.urx       = urx;
            this.ury       = ury;
            this.xScale    = (urx - llx) / getWidth();
            this.yScale    = -1 * (ury - lly) / getHeight();
            this.lineScale = min(abs(this.xScale), abs(this.yScale));
        };
        
        /* ---- setup ---- */
        proto.$setup = function (w, h, startx, starty) {
            if (isNaN(parseFloat(w))) w = getWidth();
            if (isNaN(parseFloat(h))) h = getHeight();
            if (w <= 1) w = getWidth()  * w;
            if (h <= 1) h = getHeight() * h;
            this._width   = w;
            this._height  = h;
            this._xOffset = (startx === undefined || isNaN(parseInt(startx))) ? 0 : parseInt(startx);
            this._yOffset = (starty === undefined || isNaN(parseInt(starty))) ? 0 : parseInt(starty);

            // updateDialogSize: змінює розмір діалогу, контейнера і canvas,
            // зберігає/відновлює намальований вміст і оновлює setUpWorld.
            // Після цього _setworldcoordinates вже не потрібна — координатний
            // світ вже налаштований правильно.
            if (typeof $ !== "undefined" && $.fn && $.fn.dialog && dialogInstance) {
                updateDialogSize(w, h);
                return;
            }

            // Fallback (без jQuery UI діалогу)
            if (this._mode === "world") return this._setworldcoordinates(this.llx, this.lly, this.urx, this.ury);
            return this._setworldcoordinates(-w / 2, -h / 2, w / 2, h / 2);
        };
        proto.$setup.minArgs     = 0;
        proto.$setup.co_varnames = ["width", "height", "startx", "starty"];
        
        /* ---- screensize ---- */
        proto.$screensize = function (canvwidth, canvheight, bg) {
            if (canvwidth === undefined) return [getWidth(), getHeight()];
            cfg.width  = canvwidth;
            cfg.height = canvheight;
            
            // Update jQuery dialog size
            updateDialogSize(canvwidth, canvheight);
            
            if (bg !== undefined) this.$bgcolor(bg);
            return undefined;
        };
        proto.$screensize.minArgs     = 0;
        proto.$screensize.co_varnames = ["canvwidth", "canvheight", "bg"];
        
        /* ---- mode ---- */
        proto.$mode = function (mode) {
            if (mode === undefined) return this._mode;
            var prev = this._mode;
            this._mode = mode;
            var turtles = getFrameManager().turtles();
            for (var i = 0; i < turtles.length; i++) {
                var t = turtles[i];
                t._angle   = 0;
                t._radians = 0;
                t._state   = undefined;
            }
            return this.$resetscreen();
        };
        proto.$mode.minArgs     = 0;
        proto.$mode.co_varnames = ["mode"];
        
        /* ---- shapes ---- */
        proto.$register_shape = proto.$addshape = function (name, poly) {
            if (poly === undefined || poly === null) {
                return getAsset(name).then(function (img) { shapes[name] = img; });
            }
            if (poly instanceof Shape) {
                shapes[name] = poly;
            } else if (typeof poly === "string") {
                return getAsset(poly).then(function (img) { shapes[name] = img; });
            } else {
                shapes[name] = poly;
            }
        };
        proto.$register_shape.minArgs     = 1;
        proto.$register_shape.co_varnames = ["name", "shape"];
        
        proto.$getshapes = function () { return Object.keys(shapes); };
        
        /* ---- tracer / delay ---- */
        proto.$tracer = function (n, delay) {
            if (n === undefined && delay === undefined) return this._frames;
            if (typeof delay === "number") {
                this._delay = delay;
                getFrameManager().refreshInterval(delay);
            }
            if (typeof n === "number") {
                this._frames = n;
                getFrameManager().frameBuffer(n);
            }
        };
        proto.$tracer.co_varnames = ["frames", "delay"];
        proto.$tracer.minArgs     = 0;
        
        proto.$delay = function (d) {
            if (d === undefined) return (this._delay === undefined) ? DEFAULT_DELAY : this._delay;
            return this.$tracer(undefined, d);
        };
        proto.$delay.co_varnames = ["delay"];
        proto.$delay.minArgs     = 0;
        
        /* ---- world coordinates ---- */
        proto._setworldcoordinates = function (llx, lly, urx, ury) {
            this.setUpWorld(llx, lly, urx, ury);

            // _sprites (шар черепашок): скидаємо трансформацію і одразу
            // перемальовуємо всіх черепашок — нового кадру може не бути.
            if (this._sprites) {
                applyWorld(this, this._sprites);
                var sprites = this._sprites;
                var allTurtles = getFrameManager().turtles();
                for (var j = 0; j < allTurtles.length; j++) {
                    if (allTurtles[j].getState().shown) drawTurtle(allTurtles[j].getState(), sprites);
                }
            }

            // _background і _paper містять намальований вміст — зберігаємо
            // пікселі перед очищенням і відновлюємо 1:1 з центруванням.
            // Canvas має координатну систему з (0,0) в центрі, тому при зміні
            // розміру зміщуємо зображення так, щоб старий центр збігся з новим.
            var self = this;
            var oldW = self._background && self._background.canvas ? self._background.canvas.width  : getWidth();
            var oldH = self._background && self._background.canvas ? self._background.canvas.height : getHeight();
            function resizeAndPreserve(ctx) {
                if (!ctx || !ctx.canvas) return;
                var tmp = document.createElement("canvas");
                tmp.width  = ctx.canvas.width;
                tmp.height = ctx.canvas.height;
                tmp.getContext("2d").drawImage(ctx.canvas, 0, 0);
                // applyWorld очищує canvas і встановлює нову трансформацію
                applyWorld(self, ctx);
                // відновлюємо 1:1, зміщуючи так щоб центри збіглись
                var newW = ctx.canvas.width;
                var newH = ctx.canvas.height;
                var dx = (newW - oldW) / 2;
                var dy = (newH - oldH) / 2;
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(tmp, dx, dy);
                ctx.restore();
            }

            if (this._background) resizeAndPreserve(this._background);
            var turtles = getFrameManager().turtles();
            for (var i = 0; i < turtles.length; i++) {
                if (turtles[i]._paper) resizeAndPreserve(turtles[i]._paper);
            }
        };
        
        proto.$setworldcoordinates = function (llx, lly, urx, ury) {
            this._mode = "world";
            return this._setworldcoordinates(llx, lly, urx, ury);
        };
        proto.$setworldcoordinates.co_varnames = ["llx", "lly", "urx", "ury"];
        proto.$setworldcoordinates.minArgs     = 4;
        
        /* ---- clear / reset ---- */
        proto.$clearscreen = function () { this.reset(); return this.$resetscreen(); };
        proto.$clearscreen.minArgs = 0;
        
        proto.$update = function () { return getFrameManager().update(); };
        
        proto.$resetscreen = function () {
            var self    = this;
            var turtles = getFrameManager().turtles();
            return getFrameManager().addFrame(function () {
                applyWorld(self, self._sprites);
                applyWorld(self, self._background);
                for (var i = 0; i < turtles.length; i++) {
                    turtles[i].reset();
                    applyWorld(self, turtles[i]._paper);
                }
            }, true);
        };
        proto.$resetscreen.minArgs = 0;
        
        /* ---- size queries ---- */
        proto.$window_width  = function () { return getWidth(); };
        proto.$window_height = function () { return getHeight(); };
        
        /* ---- turtles list ---- */
        proto.$turtles = function () { return getFrameManager().turtles(); };
        proto.$turtles.returnType = typeConverters.TURTLE_LIST;
        
        /* ---- background ---- */
        proto.$bgcolor = function (color, g, b, a) {
            if (color === undefined) return hexToRGB(this._bgcolor);
            this._bgcolor = createColor(this._colorMode || 1, color, g, b, a);
            clearLayer(this.bgLayer(), this._bgcolor);
        };
        proto.$bgcolor.minArgs     = 0;
        proto.$bgcolor.co_varnames = ["color", "g", "b", "a"];
        proto.$bgcolor.returnType  = typeConverters.COLOR;
        
        proto.$bgpic = function (name) {
            var self = this;
            if (!name) return this._bgpic;
            return getAsset(name).then(function (img) { clearLayer(self.bgLayer(), undefined, img); });
        };
        proto.$bgpic.minArgs     = 0;
        proto.$bgpic.co_varnames = ["name"];
        
        /* ---- colormode ---- */
        proto.$colormode = function (cmode) {
            if (cmode === undefined) return this._colorMode || 1;
            this._colorMode = (cmode === 255) ? 255 : 1;
        };
        proto.$colormode.minArgs     = 0;
        proto.$colormode.co_varnames = ["cmode"];
        proto.$colormode.returnType  = function (v) { return v === 255 ? new Sk.builtin.int_(255) : new Sk.builtin.float_(1); };
        
        /* ---- canvas access ---- */
        proto.$getcanvas = function () {
            return this.spriteLayer().canvas;
        };
        proto.$getcanvas.isSk = false;
        
        /* ---- title ---- */
        proto.$title = function (t) {
            if (typeof $ !== "undefined" && $.fn && $.fn.dialog && dialogInstance) {
                dialogInstance.dialog("option", "title", t);
            } else {
                document.title = t;
            }
        };
        proto.$title.minArgs     = 1;
        proto.$title.co_varnames = ["title"];
        
        /* ---- mainloop / bye / exitonclick ---- */
        proto.$mainloop = proto.$done = function () {};
        
        proto.$bye = function () { 
            Sk.TurtleGraphics && Sk.TurtleGraphics.reset && Sk.TurtleGraphics.reset(); 
            if (dialogInstance) {
                dialogInstance.dialog("close");
            }
        };
        
        proto.$exitonclick = function () {
            this._exitOnClick = true;
            this.getManager("mousedown").addHandler(function () { resetTurtle(); }, false);
        };
        
        proto.$no_animation = function () {
            var self = this;
            var prevFrames = self._frames;
            var prevDelay  = self._delay;
            self.$tracer(0, 0);
            var cm = {
                __enter__ : function () {},
                __exit__  : function () {
                    self._frames = prevFrames;
                    self._delay  = prevDelay;
                    getFrameManager().frameBuffer(prevFrames || 1);
                    getFrameManager().refreshInterval(prevDelay || 0);
                    getFrameManager().update();
                }
            };
            return cm;
        };
        proto.$no_animation.minArgs = 0;
        
        proto.$save = function (filename, overwrite) {
            filename = filename || "turtle_drawing.png";
            var w      = getWidth();
            var h      = getHeight();
            var offCtx = document.createElement("canvas");
            offCtx.width  = w;
            offCtx.height = h;
            var ctx    = offCtx.getContext("2d");
            var layers = [];
            if (this._background) layers.push(this._background.canvas);
            var turtles = getFrameManager().turtles();
            for (var i = 0; i < turtles.length; i++) {
                if (turtles[i]._paper) layers.push(turtles[i]._paper.canvas);
            }
            if (this._sprites) layers.push(this._sprites.canvas);
            for (var j = 0; j < layers.length; j++) {
                try { ctx.drawImage(layers[j], 0, 0); } catch (e) { /* ignore cross-origin */ }
            }
            var link    = document.createElement("a");
            link.href   = offCtx.toDataURL("image/png");
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        proto.$save.co_varnames = ["filename", "overwrite"];
        proto.$save.minArgs     = 1;
        
        /* ---- screen click ---- */
        proto.$onclick = function (fn, btn, add) {
            if (!this._exitOnClick) this.getManager("mousedown").addHandler(fn, add);
        };
        proto.$onclick.minArgs     = 1;
        proto.$onclick.co_varnames = ["method", "btn", "add"];
        
        proto.$onscreenclick = function (fn, btn, add) {
            this.getManager("mousedown").addHandler(fn, add);
        };
        proto.$onscreenclick.minArgs     = 1;
        proto.$onscreenclick.co_varnames = ["method", "btn", "add"];
        
        /* ---- timer ---- */
        proto.$ontimer = function (fn, interval) {
            if (this._timer) { window.clearTimeout(this._timer); this._timer = undefined; }
            if (fn && typeof interval === "number") {
                this._timer = window.setTimeout(fn, max(0, 0 | interval));
            }
        };
        proto.$ontimer.minArgs     = 0;
        proto.$ontimer.co_varnames = ["method", "interval"];
        
        /* ---- keyboard ---- */
        var KEY_CODES = {
            8:/^back(space)?$/i, 9:/^tab$/i, 13:/^(enter|return)$/i,
            16:/^shift$/i, 17:/^(ctrl|control)$/i, 18:/^alt$/i,
            27:/^esc(ape)?$/i,   32:/^space$/i,
            33:/^page[\s\-]?up$/i,  34:/^page[\s\-]?down$/i,
            35:/^end$/i, 36:/^home$/i,
            37:/^left([\s\-]?arrow)?$/i, 38:/^up([\s\-]?arrow)?$/i,
            39:/^right([\s\-]?arrow)?$/i, 40:/^down([\s\-]?arrow)?$/i,
            45:/^insert$/i, 46:/^del(ete)?$/i
        };
        
        proto._createKeyRepeater = function (key, code) {
            var self = this;
            self._keyLogger[code] = window.setTimeout(function () {
                self._keyListeners[key]();
                self._keyLogger[code] = window.setInterval(function () {
                    self._keyListeners[key]();
                }, 50);
            }, 333);
        };
        
        proto._createKeyDownListener = function () {
            var self = this;
            if (self._keyDownListener) return;
            self._keyDownListener = function (evt) {
                if (!focusTurtle()) return;
                var code = evt.charCode || evt.keyCode;
                var ch   = String.fromCharCode(code).toLowerCase();
                if (self._keyLogger[code]) return;
                for (var key in self._keyListeners) {
                    var match = (key.length > 1 && KEY_CODES[code] && KEY_CODES[code].test(key)) || key === ch;
                    if (match) {
                        self._keyListeners[key]();
                        self._createKeyRepeater(key, code);
                        evt.preventDefault();
                        break;
                    }
                }
            };
            getTarget().addEventListener("keydown", self._keyDownListener);
        };
        
        proto._createKeyUpListener = function () {
            var self = this;
            if (self._keyUpListener) return;
            self._keyUpListener = function (evt) {
                var code  = evt.charCode || evt.keyCode;
                var timer = self._keyLogger[code];
                if (timer !== undefined) {
                    evt.preventDefault();
                    window.clearInterval(timer);
                    window.clearTimeout(timer);
                    delete self._keyLogger[code];
                }
            };
            getTarget().addEventListener("keyup", self._keyUpListener);
        };
        
        proto.$listen = function (xdummy, ydummy) {
            this._createKeyUpListener();
            this._createKeyDownListener();
        };
        proto.$listen.minArgs     = 0;
        proto.$listen.co_varnames = ["xdummy", "ydummy"];
        
        proto.$onkey = function (fn, keyValue) {
            if (typeof keyValue === "function") { var tmp = fn; fn = keyValue; keyValue = tmp; }
            keyValue = (keyValue + "").toLowerCase();
            if (fn && typeof fn === "function") {
                this._keyListeners || (this._keyListeners = {});
                this._keyListeners[keyValue] = fn;
            } else {
                delete this._keyListeners[keyValue];
            }
        };
        proto.$onkey.minArgs     = 2;
        proto.$onkey.co_varnames = ["method", "keyValue"];
        
        proto.$onkeypress = function (fn, keyValue) {
            return this.$onkey(fn, keyValue);
        };
        proto.$onkeypress.minArgs     = 1;
        proto.$onkeypress.co_varnames = ["method", "key"];
        
        proto.$onkeyrelease = function (fn, keyValue) {
            var self = this;
            if (typeof keyValue === "function") { var tmp = fn; fn = keyValue; keyValue = tmp; }
            keyValue = (keyValue + "").toLowerCase();
            this._keyReleaseListeners || (this._keyReleaseListeners = {});
            if (fn && typeof fn === "function") {
                this._keyReleaseListeners[keyValue] = fn;
                if (!this._keyReleaseListener) {
                    this._keyReleaseListener = function (evt) {
                        if (!focusTurtle()) return;
                        var code = evt.charCode || evt.keyCode;
                        var ch   = String.fromCharCode(code).toLowerCase();
                        for (var key in self._keyReleaseListeners) {
                            var match = (key.length > 1 && KEY_CODES[code] && KEY_CODES[code].test(key)) || key === ch;
                            if (match) { self._keyReleaseListeners[key](); evt.preventDefault(); break; }
                        }
                    };
                    getTarget().addEventListener("keyup", this._keyReleaseListener);
                }
            } else {
                delete this._keyReleaseListeners[keyValue];
            }
        };
        proto.$onkeyrelease.minArgs     = 1;
        proto.$onkeyrelease.co_varnames = ["method", "key"];
        
        /* ---- numinput / textinput ---- */
        proto.$numinput = function (title, prompt, defaultValue, minval, maxval) {
            var raw = window.prompt((title || "") + "\n" + (prompt || ""), defaultValue !== undefined ? defaultValue : "");
            if (raw === null) return null;
            var n = parseFloat(raw);
            if (isNaN(n)) return null;
            if (minval !== undefined && n < minval) n = minval;
            if (maxval !== undefined && n > maxval) n = maxval;
            return n;
        };
        proto.$numinput.minArgs     = 2;
        proto.$numinput.co_varnames = ["title", "prompt", "default", "minval", "maxval"];
        proto.$numinput.returnType  = typeConverters.FLOAT;
        
        proto.$textinput = function (title, prompt) {
            var raw = window.prompt((title || "") + "\n" + (prompt || ""), "");
            return raw;
        };
        proto.$textinput.co_varnames = ["title", "prompt"];
    }(Screen.prototype));
    
    /* ---------------------------------------------------------------- */
    /*  Module-level turtle helpers                                     */
    /* ---------------------------------------------------------------- */
    function ensureAnonymous() {
        if (!anonymousTurtle) anonymousTurtle = Sk.misceval.callsimArray(moduleObj.Turtle);
        return anonymousTurtle.instance;
    }
    
    Turtle.prototype.$numinput = Screen.prototype.$numinput;
    Turtle.prototype.$textinput = Screen.prototype.$textinput;
    
    /* ---------------------------------------------------------------- */
    /*  reset / stop / focus                                            */
    /* ---------------------------------------------------------------- */
    function resetTurtle() {
        cancelRaf();
        getScreen().reset();
        getFrameManager().reset();
        while (targetEl.firstChild) targetEl.removeChild(targetEl.firstChild);
        if (mouseHandlerInstance) mouseHandlerInstance.reset();
        moduleCounter      = 0;
        screenInstance     = undefined;
        anonymousTurtle    = undefined;
        mouseHandlerInstance = undefined;
    }
    
    function stopTurtle() {
        cancelRaf();
        if (mouseHandlerInstance) mouseHandlerInstance.reset();
        moduleCounter       = 0;
        screenInstance      = undefined;
        anonymousTurtle     = undefined;
        mouseHandlerInstance = undefined;
    }
    
    function focusTurtle(state) {
        if (state !== undefined) {
            keyboardFocused = !!state;
            keyboardFocused ? getTarget().focus() : getTarget().blur();
        }
        return keyboardFocused;
    }
    
    /* ---------------------------------------------------------------- */
    /*  Vec2D class                                                     */
    /* ---------------------------------------------------------------- */
    function Vec2D(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    Vec2D.prototype.add      = function (v) { return new Vec2D(this.x + v.x, this.y + v.y); };
    Vec2D.prototype.sub      = function (v) { return new Vec2D(this.x - v.x, this.y - v.y); };
    Vec2D.prototype.mul      = function (k) {
        if (k instanceof Vec2D) return this.x * k.x + this.y * k.y;
        return new Vec2D(this.x * k, this.y * k);
    };
    Vec2D.prototype.abs      = function ()  { return sqrt(this.x * this.x + this.y * this.y); };
    Vec2D.prototype.rotate   = function (angle) {
        var rad = angle * PI / 180;
        var c   = cos(rad), s = sin(rad);
        return new Vec2D(this.x * c - this.y * s, this.x * s + this.y * c);
    };
    Vec2D.prototype.toString = function () { return "(" + this.x.toFixed(2) + "," + this.y.toFixed(2) + ")"; };
    
    /* ---------------------------------------------------------------- */
    /*  Shape class                                                     */
    /* ---------------------------------------------------------------- */
    function Shape(type_, data) {
        this._type       = type_;
        this._data       = data;
        this._components = [];
    }
    Shape.prototype.addcomponent = function (poly, fill, outline) {
        if (this._type !== "compound") throw new Error("Shape.addcomponent: not a compound shape");
        this._components.push({ poly: poly, fill: fill, outline: outline || fill });
    };
    
    /* ---------------------------------------------------------------- */
    /*  Build Python classes                                            */
    /* ---------------------------------------------------------------- */
    function initTurtle(self, shape) {
        Sk.builtin.pyCheckArgs("__init__", arguments, 2, 3, false, false);
        self.instance          = new Turtle(shape || new Sk.builtin.str("classic"));
        self.instance.skInstance = self;
    }
    initTurtle.co_varnames  = ["self", "shape"];
    initTurtle.co_name      = new Sk.builtin.str("Turtle");
    initTurtle.co_argcount  = 2;
    initTurtle.$defaults    = [Sk.builtin.none.none$, new Sk.builtin.str("classic")];
    
    /* ---------------------------------------------------------------- */
    /*  Module-level function registration                              */
    /* ---------------------------------------------------------------- */
    for (var tKey in Turtle.prototype) {
        if (/^\$[a-z_]+/.test(tKey)) addModuleMethod(Turtle, moduleObj, tKey, ensureAnonymous);
    }
    
    for (var sKey in Screen.prototype) {
        if (/^\$[a-z_]+/.test(sKey)) addModuleMethod(Screen, moduleObj, sKey, getScreen);
    }
    
    addModuleMethod(Turtle,  moduleObj, "$onclick",      ensureAnonymous);
    addModuleMethod(Screen,  moduleObj, "$onscreenclick",getScreen);
    addModuleMethod(Turtle,  moduleObj, "$filling",      ensureAnonymous);
    
    moduleObj.Turtle = Sk.misceval.buildClass(moduleObj, function TurtleWrapper(globals, attrs) {
        attrs.__init__ = new Sk.builtin.func(initTurtle);
        for (var k in Turtle.prototype) {
            if (/^\$[a-z_]+/.test(k)) addModuleMethod(Turtle, attrs, k);
        }
    }, "Turtle", []);
    
    moduleObj.Screen = Sk.misceval.buildClass(moduleObj, function ScreenWrapper(globals, attrs) {
        attrs.__init__ = new Sk.builtin.func(function (self) { self.instance = getScreen(); });
        for (var k in Screen.prototype) {
            if (/^\$[a-z_]+/.test(k)) addModuleMethod(Screen, attrs, k);
        }
    }, "Screen", []);
    
    /* ---------------------------------------------------------------- */
    /*  Vec2D Python class                                              */
    /* ---------------------------------------------------------------- */
    moduleObj.Vec2D = Sk.misceval.buildClass(moduleObj, function Vec2DWrapper(globals, attrs) {
        attrs.__init__ = new Sk.builtin.func(function (self, x, y) {
            self.instance = new Vec2D(Sk.ffi.remapToJs(x) || 0, Sk.ffi.remapToJs(y) || 0);
        });
        attrs.__repr__ = new Sk.builtin.func(function (self) {
            return new Sk.builtin.str(self.instance.toString());
        });
        attrs.__str__  = attrs.__repr__;
        attrs.__add__  = new Sk.builtin.func(function (self, other) {
            var r = self.instance.add(other.instance);
            return Sk.misceval.callsimArray(moduleObj.Vec2D, [new Sk.builtin.float_(r.x), new Sk.builtin.float_(r.y)]);
        });
        attrs.__sub__  = new Sk.builtin.func(function (self, other) {
            var r = self.instance.sub(other.instance);
            return Sk.misceval.callsimArray(moduleObj.Vec2D, [new Sk.builtin.float_(r.x), new Sk.builtin.float_(r.y)]);
        });
        attrs.__mul__  = new Sk.builtin.func(function (self, other) {
            if (other.instance instanceof Vec2D) return new Sk.builtin.float_(self.instance.mul(other.instance));
            return Sk.misceval.callsimArray(moduleObj.Vec2D, [new Sk.builtin.float_(self.instance.x * Sk.ffi.remapToJs(other)), new Sk.builtin.float_(self.instance.y * Sk.ffi.remapToJs(other))]);
        });
        attrs.__rmul__ = attrs.__mul__;
        attrs.__abs__  = new Sk.builtin.func(function (self) { return new Sk.builtin.float_(self.instance.abs()); });
        attrs.rotate   = new Sk.builtin.func(function (self, angle) {
            var r = self.instance.rotate(Sk.ffi.remapToJs(angle));
            return Sk.misceval.callsimArray(moduleObj.Vec2D, [new Sk.builtin.float_(r.x), new Sk.builtin.float_(r.y)]);
        });
    }, "Vec2D", []);
    
    /* ---------------------------------------------------------------- */
    /*  Shape Python class                                              */
    /* ---------------------------------------------------------------- */
    moduleObj.Shape = Sk.misceval.buildClass(moduleObj, function ShapeWrapper(globals, attrs) {
        attrs.__init__ = new Sk.builtin.func(function (self, type_, data) {
            var t = Sk.ffi.remapToJs(type_);
            var d = (data !== undefined && data !== Sk.builtin.none.none$) ? Sk.ffi.remapToJs(data) : null;
            self.instance = new Shape(t, d);
        });
        attrs.addcomponent = new Sk.builtin.func(function (self, poly, fill, outline) {
            var p = Sk.ffi.remapToJs(poly);
            var f = Sk.ffi.remapToJs(fill);
            var o = (outline && outline !== Sk.builtin.none.none$) ? Sk.ffi.remapToJs(outline) : undefined;
            self.instance.addcomponent(p, f, o);
            return Sk.builtin.none.none$;
        });
    }, "Shape", []);
    
    /* ---------------------------------------------------------------- */
    /*  Return module & control API                                     */
    /* ---------------------------------------------------------------- */
    return {
        skModule : moduleObj,
        reset    : resetTurtle,
        stop     : stopTurtle,
        focus    : focusTurtle,
        Turtle   : Turtle,
        Screen   : Screen
    };
}(targetEl));

Sk.TurtleGraphics.module = targetEl.turtleInstance.skModule;
Sk.TurtleGraphics.reset  = targetEl.turtleInstance.reset;
Sk.TurtleGraphics.stop   = targetEl.turtleInstance.stop;
Sk.TurtleGraphics.focus  = targetEl.turtleInstance.focus;
Sk.TurtleGraphics.raw    = {
    Turtle : targetEl.turtleInstance.Turtle,
    Screen : targetEl.turtleInstance.Screen
};
return targetEl.turtleInstance.skModule;
};
