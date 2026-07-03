/*
 * PIL (Pillow) для Skulpt — емуляція через HTML5 Canvas
 * Версія 2026
 *
 * Архітектура аналогічна pygame-for-Skulpt:
 *  - один $builtinmodule на верхньому рівні (PIL)
 *  - підмодулі реєструються через Sk.sysmodules (PIL.Image, PIL.ImageDraw, ...)
 *  - кожне Image зберігає offscreen <canvas> + 2d context як джерело пікселів
 *
 * Підтримані підмодулі:
 *   PIL.Image        — Image.new/open/fromarray, методи екземпляра
 *   PIL.ImageDraw     — Draw(im) -> ImageDraw object (line, rectangle, ellipse,
 *                        polygon, point, text, arc, chord, pieslice, multiline_text)
 *   PIL.ImageFont     — load_default, truetype (через CSS @font-face/web fonts, best-effort)
 *   PIL.ImageColor    — getrgb, getcolor
 *   PIL.ImageOps      — grayscale, invert, mirror, flip, autocontrast, expand, fit
 *   PIL.ImageFilter   — BLUR, CONTOUR, DETAIL, EDGE_ENHANCE, SMOOTH, SHARPEN, GaussianBlur
 *   PIL.ImageEnhance  — Brightness, Contrast, Color, Sharpness
 *   PIL.ImageChops    — add, subtract, multiply, screen, difference, lighter, darker
 *   PIL.ImageTk       — PhotoImage, BitmapImage, getimage (міст до tkinter-модуля
 *                        цього ж проєкту: tkinter скрізь вставляє `image=...`
 *                        напряму в `<img src="...">` або `el.src = ...`, що
 *                        неявно викликає toString()/valueOf() значення —
 *                        тож PhotoImage сам віддає себе як PNG data-URL і
 *                        працює без жодних правок у коді tkinter)
 *
 * Обмеження емуляції:
 *  - Це наближена емуляція для навчальних/демонстраційних цілей у браузері,
 *    а не побітово ідентична реалізація Pillow.
 *  - Image.open приймає URL/data-URL і вантажиться асинхронно (await/Promise через Skulpt suspensions).
 *  - Шрифти: truetype приймає назву шрифта (CSS font-family) замість шляху до .ttf,
 *    або data URL з @font-face, якщо такий є в DOM.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PILLib — глобальний простір стану
// ─────────────────────────────────────────────────────────────────────────────
var PILLib = {
    ImageType: null,
    ImageDrawType: null,
    ImageFontType: null,
    FontDefault: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Утиліти
// ─────────────────────────────────────────────────────────────────────────────

function jsStr(x) {
    if (x === undefined || x === null) return x;
    return typeof x === 'string' ? x : Sk.ffi.remapToJs(x);
}

function jsNum(x) {
    if (x === undefined || x === null) return x;
    return typeof x === 'number' ? x : Sk.ffi.remapToJs(x);
}

function pyNone() { return Sk.builtin.none.none$; }

// Перетворює довільне Python значення кольору на [r,g,b,a] (0-255 кожен)
PILLib.toRGBA = function (color, defaultMode) {
    if (color === undefined || color === null || color === pyNone()) {
        return [0, 0, 0, 255];
    }
    var t = Sk.abstr.typeName(color);
    if (t === 'int' || t === 'float') {
        var v = jsNum(color);
        return [v, v, v, 255];
    }
    if (t === 'str') {
        return PILLib.colorFromName(jsStr(color));
    }
    if (t === 'tuple' || t === 'list') {
        var arr = Sk.ffi.remapToJs(color);
        if (arr.length === 1) return [arr[0], arr[0], arr[0], 255];
        if (arr.length === 3) return [arr[0], arr[1], arr[2], 255];
        if (arr.length === 4) return [arr[0], arr[1], arr[2], arr[3]];
        if (arr.length === 2) return [arr[0], arr[0], arr[0], arr[1]]; // LA
    }
    // вже JS-масив (внутрішнє використання)
    if (Array.isArray(color)) {
        if (color.length === 3) return [color[0], color[1], color[2], 255];
        return color;
    }
    if (typeof color === 'number') return [color, color, color, 255];
    return [0, 0, 0, 255];
};

PILLib.colorFromName = function (name) {
    name = name.trim();
    if (name[0] === '#') {
        var hex = name.slice(1);
        if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        var a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) : 255;
        return [r, g, b, a];
    }
    var m = /^rgba?\(([^)]+)\)$/i.exec(name);
    if (m) {
        var parts = m[1].split(',').map(function (s) { return parseFloat(s); });
        var a2 = parts.length === 4 ? Math.round(parts[3] * 255) : 255;
        return [parts[0], parts[1], parts[2], a2];
    }
    // резолвимо через canvas (підтримує всі CSS-кольори: 'red', 'cornflowerblue', ...)
    var ctx = PILLib._resolveCtx();
    ctx.fillStyle = '#000';
    try { ctx.fillStyle = name; } catch (e) {}
    var resolved = ctx.fillStyle;
    if (resolved[0] === '#') {
        return PILLib.colorFromName(resolved);
    }
    var m2 = /rgba?\(([^)]+)\)/.exec(resolved);
    if (m2) {
        var p2 = m2[1].split(',').map(function (s) { return parseFloat(s); });
        return [p2[0], p2[1], p2[2], p2.length === 4 ? Math.round(p2[3] * 255) : 255];
    }
    return [0, 0, 0, 255];
};

PILLib._resolveCtx = function () {
    if (!PILLib._tmpCanvas) {
        PILLib._tmpCanvas = document.createElement('canvas');
        PILLib._tmpCanvas.width = 1;
        PILLib._tmpCanvas.height = 1;
    }
    return PILLib._tmpCanvas.getContext('2d');
};

PILLib.cssRGBA = function (c) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (c[3] / 255) + ')';
};

// Захист від "TypeError: can't access property '_w', self is undefined":
// якщо self не є коректно ініціалізованим Image, кидаємо ЗРОЗУМІЛУ
// Python-помилку замість сирого крашу JS.
//
// Розрізняємо два випадки:
//  1) self взагалі не схожий на Image (typeof/структура не ті) — це
//     звичайна програмна помилка (не той аргумент, не той тип), а не
//     проблема з файлом, тож кидаємо звичайний TypeError.
//  2) self схожий на Image, але без даних (canvas не заповнено) — це
//     власне ситуація "зображення не вдалося завантажити", кидаємо
//     ValueError із коротким поясненням, без внутрішньої діагностики
//     (справжня причина відсутності файлу вже повідомляється окремо,
//     безпосередньо в Image.open, де вона й виникає).
PILLib.ensureImage = function (self, where) {
    if (self && self._w !== undefined && self._h !== undefined && self._canvas) {
        return;
    }
    var looksLikeImage = !!(self && (self._canvas !== undefined || self._w !== undefined || self._h !== undefined));
    if (!looksLikeImage) {
        throw new Sk.builtin.TypeError(
            (where ? where + ': ' : '') + 'очікувався об\'єкт PIL.Image.Image'
        );
    }
    throw new Sk.builtin.ValueError(
        'PIL.Image: зображення не завантажено' + (where ? (' (' + where + ')') : '') + '.'
    );
};

// tkinter.js (photoImageSrc) читає готовий data-URL напряму з властивості
// $dataUrl на екземплярі PhotoImage/BitmapImage — а не через toString()/
// valueOf() чи Python __str__(). Тому щоразу, коли міняється self._canvas
// (ініціалізація, завантаження зображення, paste()), треба перераховувати
// й оновлювати саме self.$dataUrl, інакше tkinter побачить порожній рядок
// (або, у резервній гілці, текст __repr__) і картинка не відобразиться.
PILLib.refreshDataUrl = function (self, who) {
    // tkinter.js (photoImageSize) виставляє Label/Button/Canvas.create_image
    // ТОЧНИЙ піксельний розмір картинки через self.$width/self.$height —
    // якщо їх немає, він падає на резервний max-width:100%, який у
    // вкладених flex-контейнерах з невизначеною шириною класично
    // схлопується в 0 або дає "дивний" розмір/позицію. self._w/self._h —
    // внутрішні поля САМЕ цього PIL-модуля; tkinter.js про них не знає й
    // очікує $width/$height. Синхронізуємо їх тут-таки, за фактичним
    // розміром canvas, щоб жодна точка зміни self._canvas (init,
    // loadFromImage, PhotoImage(size=...), paste()) не забула це зробити.
    if (self._canvas) {
        self.$width = self._canvas.width;
        self.$height = self._canvas.height;
    }
    try {
        self.$dataUrl = self._canvas.toDataURL('image/png');
    } catch (e) {
        // Найчастіша причина: canvas "tainted" через завантаження
        // зображення з іншого джерела без CORS-заголовків
        // (Image.open по URL без Access-Control-Allow-Origin).
        if (typeof console !== 'undefined' && console.warn) {
            console.warn((who || 'ImageTk') + ': toDataURL() не вдався (ймовірно, tainted canvas через CORS):', e);
        }
        self.$dataUrl = '';
    }
    return self.$dataUrl;
};

function unpackKWA(kwa) {
    var result = {};
    if (!kwa) return result;
    if (Array.isArray(kwa)) {
        for (var i = 0; i < kwa.length; i += 2) {
            var key = jsStr(kwa[i]);
            result[key] = kwa[i + 1];
        }
    }
    return result;
}

// Отримати позиційний або keyword-аргумент
function arg(args, kwa, idx, name, dflt) {
    if (args && args.length > idx && args[idx] !== undefined) return args[idx];
    if (kwa && kwa.hasOwnProperty(name)) return kwa[name];
    return dflt;
}

// ─────────────────────────────────────────────────────────────────────────────
// Внутрішнє представлення зображення: { canvas, ctx, mode, width, height }
// ─────────────────────────────────────────────────────────────────────────────

function makeBackingCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
}

function newImageData(mode, size, color) {
    var w = size[0], h = size[1];
    var canvas = makeBackingCanvas(w, h);
    var ctx = canvas.getContext('2d');
    var rgba = PILLib.toRGBA(color);
    if (mode === '1' || mode === 'L' || mode === 'I') {
        // grayscale fill
        if (Array.isArray(rgba) === false) rgba = [0, 0, 0, 255];
    }
    if (color !== undefined && color !== null) {
        ctx.fillStyle = PILLib.cssRGBA(rgba);
        ctx.fillRect(0, 0, w, h);
    } else if (mode !== 'RGBA' && mode !== 'LA' && mode !== 'P') {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(0, 0, w, h);
    }
    return { canvas: canvas, ctx: ctx, mode: mode, width: canvas.width, height: canvas.height };
}

// ─────────────────────────────────────────────────────────────────────────────
// Клас Image (PIL.Image.Image)
// ─────────────────────────────────────────────────────────────────────────────

function image_class($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function (self) {
        // Звичайно створюється фабричними функціями (new/open), а не напряму
        self._mode = 'RGB';
        self._w = 0;
        self._h = 0;
        self._canvas = makeBackingCanvas(1, 1);
        self._ctx = self._canvas.getContext('2d');
        self._info = new Sk.builtin.dict([]);
        self._format = pyNone();
        return pyNone();
    });

    self_initFromData = function (self, data) {
        self._canvas = data.canvas;
        self._ctx = data.ctx;
        self._mode = data.mode;
        self._w = data.canvas.width;
        self._h = data.canvas.height;
        if (!self._info) self._info = new Sk.builtin.dict([]);
        if (self._format === undefined) self._format = pyNone();
    };
    PILLib._initFromData = self_initFromData;

    // ПРИМІТКА: на момент виконання image_class() значення PILLib.ImageType
    // ще дорівнює null — Sk.misceval.buildClass викликає цю функцію щоб
    // заповнити тіло класу ДО того, як сам тип буде створено й присвоєно.
    // Якщо передати тут PILLib.ImageType, getset_descriptor назавжди
    // запам'ятає null як тип-власника, і будь-яке звернення до атрибута
    // (img.size, img.mode, ...) впаде з "TypeError: invalid 'instanceof'
    // operand", бо Skulpt робить `obj instanceof null`.
    // Sk.builtin.object — це базовий клас, яким є будь-який Python-об'єкт,
    // тож перевірка instanceof завжди валідна, і вже існує на цей момент.
    $loc.width = new Sk.builtin.getset_descriptor(Sk.builtin.object, {
        $get: function (self) { self = self || this; PILLib.ensureImage(self, 'width'); return Sk.ffi.remapToPy(self._w); }
    });
    $loc.height = new Sk.builtin.getset_descriptor(Sk.builtin.object, {
        $get: function (self) { self = self || this; PILLib.ensureImage(self, 'height'); return Sk.ffi.remapToPy(self._h); }
    });
    $loc.mode = new Sk.builtin.getset_descriptor(Sk.builtin.object, {
        $get: function (self) { self = self || this; PILLib.ensureImage(self, 'mode'); return Sk.ffi.remapToPy(self._mode); }
    });
    $loc.size = new Sk.builtin.getset_descriptor(Sk.builtin.object, {
        $get: function (self) {
            self = self || this;
            PILLib.ensureImage(self, 'size');
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(self._w), Sk.ffi.remapToPy(self._h)]);
        }
    });
    $loc.format = new Sk.builtin.getset_descriptor(Sk.builtin.object, {
        $get: function (self) { self = self || this; return self._format !== undefined ? self._format : pyNone(); },
        $set: function (value) { this._format = value; }
    });
    $loc.info = new Sk.builtin.getset_descriptor(Sk.builtin.object, {
        $get: function (self) { self = self || this; return self._info || (self._info = new Sk.builtin.dict([])); }
    });

    $loc.__repr__ = new Sk.builtin.func(function (self) {
        return new Sk.builtin.str('<PIL.Image mode=' + self._mode + ' size=' + self._w + 'x' + self._h + '>');
    });
    $loc.__str__ = $loc.__repr__;

    $loc.copy = new Sk.builtin.func(function (self) {
        var c = makeBackingCanvas(self._w, self._h);
        c.getContext('2d').drawImage(self._canvas, 0, 0);
        return PILLib.wrapImage({ canvas: c, ctx: c.getContext('2d'), mode: self._mode });
    });

    $loc.resize = new Sk.builtin.func(function (kwa, self, size, resample) {
        kwa = unpackKWA(kwa);
        size = arg([size], kwa, 0, 'size', size);
        resample = arg([resample], kwa, 1, 'resample', resample);
        var s = Sk.ffi.remapToJs(size);
        var w = Math.round(s[0]), h = Math.round(s[1]);
        var out = makeBackingCanvas(w, h);
        var octx = out.getContext('2d');
        octx.imageSmoothingEnabled = true;
        octx.drawImage(self._canvas, 0, 0, self._w, self._h, 0, 0, w, h);
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: self._mode });
    });
    $loc.resize.func_code.co_kwargs = true;

    $loc.thumbnail = new Sk.builtin.func(function (self, size) {
        var s = Sk.ffi.remapToJs(size);
        var maxW = s[0], maxH = s[1];
        var ratio = Math.min(maxW / self._w, maxH / self._h, 1);
        var w = Math.max(1, Math.round(self._w * ratio));
        var h = Math.max(1, Math.round(self._h * ratio));
        var out = makeBackingCanvas(w, h);
        var octx = out.getContext('2d');
        octx.drawImage(self._canvas, 0, 0, self._w, self._h, 0, 0, w, h);
        self_initFromData(self, { canvas: out, ctx: octx, mode: self._mode });
        return pyNone();
    });

    $loc.crop = new Sk.builtin.func(function (self, box) {
        var b = box ? Sk.ffi.remapToJs(box) : [0, 0, self._w, self._h];
        var x0 = b[0], y0 = b[1], x1 = b[2], y1 = b[3];
        var w = x1 - x0, h = y1 - y0;
        var out = makeBackingCanvas(w, h);
        var octx = out.getContext('2d');
        octx.drawImage(self._canvas, x0, y0, w, h, 0, 0, w, h);
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: self._mode });
    });
//
  function parseKwargs(args, numPos) {
    args = Array.prototype.slice.call(args);
    var pos = args.slice(0, numPos);
    var kw  = {};
    for (var i = numPos; i + 1 < args.length; i += 2) {
      if (args[i] instanceof Sk.builtin.str) {
        kw[args[i].v] = args[i + 1];
      }kwGet
    }
    return { pos: pos, kw: kw };
  }

  function kwGet(kw, name, def_) {
    return kw.hasOwnProperty(name) ? py2js(kw[name]) : def_;
  }

  // Build a Skulpt-callable function that correctly receives (args, kwargs).
  // handler(args, kwargs) where:
  //   args   = JS array of positional py-values
  //   kwargs = plain JS object { "key": pyValue }
  function kwFunc(handler) {
    var f = new Sk.builtin.func(function() {});
    f.tp$call = function(args, kwargs) {
      var kw = {};
      if (kwargs) {
        for (var i = 0; i + 1 < kwargs.length; i += 2) {
          kw[kwargs[i]] = kwargs[i + 1];   // kwargs is ["key", pyVal, ...]
        }
      }
      return handler(args || [], kw);
    };
    return f;
  }
    // Convert a JS value → Skulpt Python value
  function js2py(v) {
    if (v === null || v === undefined) return Sk.builtin.none.none$;
    if (typeof v === "boolean") return new Sk.builtin.bool(v);
    if (typeof v === "number") {
      return Number.isInteger(v) ? new Sk.builtin.int_(v) : new Sk.builtin.float_(v);
    }
    if (typeof v === "string") return new Sk.builtin.str(v);
    if (Array.isArray(v)) {
      return new Sk.builtin.list(v.map(js2py));
    }
    if (v instanceof window.dfd.DataFrame) return wrapDataFrame(v);
    if (v instanceof window.dfd.Series)   return wrapSeries(v);
    return new Sk.builtin.str(String(v));
  }

  // Convert Skulpt Python value → JS value
  function py2js(v) {
    if (v === undefined || v === Sk.builtin.none.none$) return null;
    if (v instanceof Sk.builtin.bool)   return v.v;
    if (v instanceof Sk.builtin.int_)   return v.v;
    if (v instanceof Sk.builtin.float_) return v.v;
    if (v instanceof Sk.builtin.str)    return v.v;
    if (v instanceof Sk.builtin.list)   return v.v.map(py2js);
    if (v instanceof Sk.builtin.tuple)  return v.v.map(py2js);
    if (v instanceof Sk.builtin.dict) {
      var obj = {};
      // Skulpt dict internal layout differs by version:
      //   newer : v.$d  = { hash: { lhs: pyKey, rhs: pyVal } }
      //   older : v.entries = [ [pyKey, pyVal], ... ]
      //   fallback: use the public mp$keys() / mp$subscript() API
      if (v.$d && typeof v.$d === "object") {
        // newer Skulpt (1.x+)
        var internalKeys = Object.keys(v.$d);
        for (var i = 0; i < internalKeys.length; i++) {
          var entry = v.$d[internalKeys[i]];
          if (entry && entry.lhs !== undefined) {
            obj[py2js(entry.lhs)] = py2js(entry.rhs);
          }
        }
      } else if (v.entries && Array.isArray(v.entries)) {
        // some builds store as array of [key, val] pairs
        for (var i = 0; i < v.entries.length; i++) {
          obj[py2js(v.entries[i][0])] = py2js(v.entries[i][1]);
        }
      } else {
        // safest fallback: iterate via Skulpt's own iterator API
        var iter = Sk.abstr.iter(v);
        for (;;) {
          var pyKey;
          try { pyKey = Sk.abstr.iternext(iter); } catch(e) { break; }
          if (pyKey === undefined) break;
          obj[py2js(pyKey)] = py2js(v.mp$subscript(pyKey));
        }
      }
      return obj;
    }
    // DataFrame / Series wrappers
    if (v.__dfd_df) return v.__dfd_df;
    if (v.__dfd_sr) return v.__dfd_sr;
    return v;
  }
    // rotate з підтримкою keyword arguments через tp$call
    $loc.rotate = kwFunc(function (args, kw) {
        var self = args[0];
        var angle = args[1];
        
        var deg = jsNum(angle);
        var doExpand = kwGet(kw, "expand", false);

        var rad = deg * Math.PI / 180;
        var w = self._w, h = self._h;
        var nw = w, nh = h;

        if (doExpand) {
            nw = Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)));
            nh = Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)));
        }

        var out = makeBackingCanvas(nw, nh);
        var octx = out.getContext('2d');
        octx.translate(nw / 2, nh / 2);
        octx.rotate(-rad);
        octx.drawImage(self._canvas, -w / 2, -h / 2);

        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: self._mode });
    });
    $loc.transpose = new Sk.builtin.func(function (self, method) {
        var m = jsNum(method);
        var w = self._w, h = self._h;
        var out, octx, nw = w, nh = h;
        // 0=FLIP_LEFT_RIGHT 1=FLIP_TOP_BOTTOM 2=ROTATE_90 3=ROTATE_180 4=ROTATE_270
        if (m === 2 || m === 4) { nw = h; nh = w; }
        out = makeBackingCanvas(nw, nh);
        octx = out.getContext('2d');
        octx.save();
        if (m === 0) { octx.translate(w, 0); octx.scale(-1, 1); octx.drawImage(self._canvas, 0, 0); }
        else if (m === 1) { octx.translate(0, h); octx.scale(1, -1); octx.drawImage(self._canvas, 0, 0); }
        else if (m === 2) { octx.translate(nw, 0); octx.rotate(Math.PI / 2); octx.drawImage(self._canvas, 0, 0); }
        else if (m === 3) { octx.translate(nw, nh); octx.rotate(Math.PI); octx.drawImage(self._canvas, 0, 0); }
        else if (m === 4) { octx.translate(0, nh); octx.rotate(-Math.PI / 2); octx.drawImage(self._canvas, 0, 0); }
        else { octx.drawImage(self._canvas, 0, 0); }
        octx.restore();
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: self._mode });
    });

    $loc.paste = new Sk.builtin.func(function (self, im, box, mask) {
        var dx = 0, dy = 0;
        if (box) {
            var b = Sk.ffi.remapToJs(box);
            dx = b[0]; dy = b[1];
        }
        var srcCanvas;
        var srcColor = null;
        if (Sk.abstr.typeName(im) === 'Image') {
            srcCanvas = im.v ? im.v._canvas : im._canvas;
        } else {
            // im — це колір, заповнюємо box цим кольором (потребує box)
            srcColor = PILLib.toRGBA(im);
        }
        if (srcColor) {
            var b2 = box ? Sk.ffi.remapToJs(box) : [0, 0, self._w, self._h];
            self._ctx.save();
            if (mask) {
                self._ctx.globalAlpha = 1;
            }
            self._ctx.fillStyle = PILLib.cssRGBA(srcColor);
            self._ctx.fillRect(b2[0], b2[1], b2[2] - b2[0], b2[3] - b2[1]);
            self._ctx.restore();
            return pyNone();
        }
        if (mask && mask !== pyNone()) {
            // спрощено: рендеримо джерело через alpha-маску
            var maskCanvas = (mask.v ? mask.v._canvas : mask._canvas);
            var tmp = makeBackingCanvas(srcCanvas.width, srcCanvas.height);
            var tctx = tmp.getContext('2d');
            tctx.drawImage(srcCanvas, 0, 0);
            tctx.globalCompositeOperation = 'destination-in';
            tctx.drawImage(maskCanvas, 0, 0, srcCanvas.width, srcCanvas.height);
            self._ctx.drawImage(tmp, dx, dy);
        } else {
            self._ctx.drawImage(srcCanvas, dx, dy);
        }
        return pyNone();
    });

    $loc.putpixel = new Sk.builtin.func(function (self, xy, color) {
        var p = Sk.ffi.remapToJs(xy);
        var c = PILLib.toRGBA(color);
        self._ctx.fillStyle = PILLib.cssRGBA(c);
        self._ctx.fillRect(p[0], p[1], 1, 1);
        return pyNone();
    });

    $loc.getpixel = new Sk.builtin.func(function (self, xy) {
        var p = Sk.ffi.remapToJs(xy);
        var d = self._ctx.getImageData(p[0], p[1], 1, 1).data;
        if (self._mode === 'L') return Sk.ffi.remapToPy(d[0]);
        if (self._mode === 'RGB') return new Sk.builtin.tuple([Sk.ffi.remapToPy(d[0]), Sk.ffi.remapToPy(d[1]), Sk.ffi.remapToPy(d[2])]);
        return new Sk.builtin.tuple([Sk.ffi.remapToPy(d[0]), Sk.ffi.remapToPy(d[1]), Sk.ffi.remapToPy(d[2]), Sk.ffi.remapToPy(d[3])]);
    });

    $loc.convert = new Sk.builtin.func(function (self, mode) {
        var m = jsStr(mode);
        var out = makeBackingCanvas(self._w, self._h);
        var octx = out.getContext('2d');
        octx.drawImage(self._canvas, 0, 0);
        if (m === 'L' || m === '1') {
            var id = octx.getImageData(0, 0, self._w, self._h);
            var d = id.data;
            for (var i = 0; i < d.length; i += 4) {
                var gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                if (m === '1') gray = gray > 127 ? 255 : 0;
                d[i] = d[i + 1] = d[i + 2] = gray;
            }
            octx.putImageData(id, 0, 0);
        }
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: m });
    });

    $loc.save = new Sk.builtin.func(function (self, fp, format) {
        var name = jsStr(fp);
        var dataUrl = self._canvas.toDataURL('image/png');
        // У браузерному середовищі Skulpt немає файлової системи — пропонуємо завантаження
        try {
            var a = document.createElement('a');
            a.href = dataUrl;
            a.download = name || 'image.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) { /* немає DOM, ігноруємо */ }
        self.info.mp$ass_subscript ? null : null;
        if (!self._savedData) self._savedData = {};
        self._savedData[name] = dataUrl;
        return pyNone();
    });

    $loc.tobytes = new Sk.builtin.func(function (self) {
        var id = self._ctx.getImageData(0, 0, self._w, self._h).data;
        var arr = [];
        for (var i = 0; i < id.length; i++) arr.push(String.fromCharCode(id[i]));
        return new Sk.builtin.bytes(arr.join(''));
    });

    $loc.split = new Sk.builtin.func(function (self) {
        var id = self._ctx.getImageData(0, 0, self._w, self._h);
        var channels = self._mode === 'L' ? 1 : (self._mode === 'RGBA' ? 4 : 3);
        var outs = [];
        for (var ch = 0; ch < channels; ch++) {
            var c = makeBackingCanvas(self._w, self._h);
            var cctx = c.getContext('2d');
            var cid = cctx.createImageData(self._w, self._h);
            for (var i = 0; i < id.data.length; i += 4) {
                var v = id.data[i + ch] !== undefined ? id.data[i + ch] : 0;
                cid.data[i] = v; cid.data[i + 1] = v; cid.data[i + 2] = v; cid.data[i + 3] = 255;
            }
            cctx.putImageData(cid, 0, 0);
            outs.push(PILLib.wrapImage({ canvas: c, ctx: cctx, mode: 'L' }));
        }
        return new Sk.builtin.tuple(outs);
    });

    $loc.show = new Sk.builtin.func(function (self) {
        try {
            var w = window.open('', '_blank');
            var img = document.createElement('img');
            img.src = self._canvas.toDataURL('image/png');
            w.document.body.appendChild(img);
        } catch (e) {}
        return pyNone();
    });

    $loc.close = new Sk.builtin.func(function (self) { return pyNone(); });

    $loc.__enter__ = new Sk.builtin.func(function (self) {
        PILLib.ensureImage(self, '__enter__ / оператор with');
        return self;
    });
    $loc.__exit__ = new Sk.builtin.func(function (self, excType, excVal, excTb) {
        return Sk.builtin.bool.false$;
    });

    $loc.filter = new Sk.builtin.func(function (self, filt) {
        var kind = (filt && filt._kind) ? filt._kind : 'BLUR';
        var radius = (filt && filt._radius) ? filt._radius : 2;
        var out = makeBackingCanvas(self._w, self._h);
        var octx = out.getContext('2d');
        if (kind === 'BLUR' || kind === 'GAUSSIAN' || kind === 'SMOOTH') {
            octx.filter = 'blur(' + radius + 'px)';
        } else if (kind === 'SHARPEN' || kind === 'DETAIL' || kind === 'EDGE_ENHANCE') {
            octx.filter = 'contrast(1.3) saturate(1.1)';
        } else if (kind === 'CONTOUR') {
            octx.filter = 'invert(1) grayscale(1)';
        }
        octx.drawImage(self._canvas, 0, 0);
        octx.filter = 'none';
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: self._mode });
    });

    $loc.getbbox = new Sk.builtin.func(function (self) {
        return new Sk.builtin.tuple([Sk.ffi.remapToPy(0), Sk.ffi.remapToPy(0), Sk.ffi.remapToPy(self._w), Sk.ffi.remapToPy(self._h)]);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Допоміжна обгортка: створити Python-екземпляр Image із внутрішніх даних
// ─────────────────────────────────────────────────────────────────────────────
PILLib.wrapImage = function (data) {
    var inst = Sk.misceval.callsim(PILLib.ImageType);
    PILLib._initFromData(inst, data);
    return inst;
};

// ─────────────────────────────────────────────────────────────────────────────
// Завантаження зображень із віртуальної файлової системи ЄPython
// ─────────────────────────────────────────────────────────────────────────────
function tryLoadFromVFS(key) {
    // Реальна файлова система ЄPython — Sk.__jsfs (екземпляр window.FileSystem("epythonfs")),
    // ініціалізується лениво так само, як у Sk.builtin.jsfswrite в index.html.
    if (typeof Sk === "undefined" || typeof window === "undefined" || !window.FileSystem) return null;
    if (!Sk.__jsfs) {
        try {
            Sk.__jsfs = new window.FileSystem("epythonfs");
        } catch (e) {
            return null;
        }
    }
    try {
        var fileData = Sk.__jsfs.read(key);
        if (!fileData) return null;
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload  = function () { resolve(img); };
            img.onerror = function () { reject(new Error("Cannot load VFS asset: " + key)); };
            if (typeof fileData === "string") {
                img.src = fileData.indexOf("data:") === 0
                    ? fileData
                    : "data:image/png;base64," + fileData;
            } else {
                if (typeof Blob === 'undefined' || typeof FileReader === 'undefined') {
                    reject(new Error("Blob/FileReader недоступні в цьому контексті виконання — неможливо завантажити зображення з VFS: " + key));
                    return;
                }
                var blob   = (fileData instanceof Blob) ? fileData : new Blob([fileData]);
                var reader = new FileReader();
                reader.onload  = function (e) { img.src = e.target.result; };
                reader.onerror = function ()  { reject(new Error("Cannot read VFS asset: " + key)); };
                reader.readAsDataURL(blob);
            }
        });
    } catch (e) {
        return null; // файл не знайдено
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.Image — функції модуля (new, open, fromarray, alpha_composite, blend, merge)
// ─────────────────────────────────────────────────────────────────────────────
function makeImageModule() {
    var m = {};

    m.new_ = new Sk.builtin.func(function (mode, size, color) {
        var modeJs = jsStr(mode);
        var sizeJs = Sk.ffi.remapToJs(size);
        var data = newImageData(modeJs, sizeJs, color);
        return PILLib.wrapImage(data);
    });
    // ВАЖЛИВО: 'new' — зарезервоване слово JS. Skulpt при пошуку Python-атрибута
    // мангейлить такі імена через Sk.fixReserved('new') -> 'new_$rw$' (див.
    // Sk.builtin.module.tp$getattr: this.$d[pyName.$mangled]). Якщо покласти
    // значення просто під ключем 'new', dir(Image) його побачить (dir читає
    // ключі $d напряму), але Image.new(...) впаде з AttributeError, бо
    // реальний пошук атрибута йде за мангейленим ключем.
    m[Sk.fixReserved('new')] = m.new_;

    // open: підтримує шлях у віртуальній ФС ЄPython (Sk.__jsfs) та URL/data-URL.
    // Повертає suspension, що очікує завантаження зображення.
    m.open = new Sk.builtin.func(function (fp) {
        var path = jsStr(fp);
        var extMatch = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(path);
        var ext = extMatch ? extMatch[1].toUpperCase() : null;
        var formatMap = { JPG: 'JPEG', JPEG: 'JPEG', PNG: 'PNG', GIF: 'GIF', BMP: 'BMP', WEBP: 'WEBP' };
        var detectedFormat = (ext && formatMap[ext]) ? formatMap[ext] : null;

        function fromImg(img) {
            try {
                var c = makeBackingCanvas(img.naturalWidth, img.naturalHeight);
                c.getContext('2d').drawImage(img, 0, 0);
                var wrapped = PILLib.wrapImage({ canvas: c, ctx: c.getContext('2d'), mode: 'RGBA' });
                if (detectedFormat) {
                    wrapped._format = new Sk.builtin.str(detectedFormat);
                }
                // Підстраховка: переконуємось, що дані дійсно застосувались
                // (наприклад, якщо wrapImage/_initFromData з якихось причин
                // не виконались, краще впасти тут із зрозумілою помилкою,
                // ніж повернути "порожній" Image, який зламається пізніше
                // на img.size з незрозумілим JS-крашем).
                PILLib.ensureImage(wrapped, 'Image.open результат');
                return wrapped;
            } catch (e) {
                throw new Sk.builtin.IOError(
                    'не вдалося обробити зображення "' + path + '": ' + (e && e.message ? e.message : e)
                );
            }
        }

        // PythonIDE.runAsync створює suspension типу "Sk.promise", який
        // Skulpt вміє резюмити вбудовано (так само, як це робить turtle/tkinter
        // у цьому ж проєкті) — на відміну від кастомного типу 'Skulpt'.
        return PythonIDE.runAsync(function (resolve, reject) {
            function loadFromUrl() {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function () {
                    try {
                        resolve(fromImg(img));
                    } catch (e) {
                        reject(e);
                    }
                };
                img.onerror = function () {
                    reject(new Sk.builtin.IOError('cannot load image file ' + path));
                };
                img.src = path;
            }

            var vfsPromise = tryLoadFromVFS(path);
            if (vfsPromise) {
                vfsPromise.then(function (img) {
                    try {
                        resolve(fromImg(img));
                    } catch (e) {
                        reject(e);
                    }
                }).catch(function () {
                    // у VFS немає такого файлу — пробуємо як URL/data-URL
                    loadFromUrl();
                });
            } else {
                loadFromUrl();
            }
        });
    });

    m.alpha_composite = new Sk.builtin.func(function (im1, im2) {
        var a = im1.v ? im1.v : im1, b = im2.v ? im2.v : im2;
        var out = makeBackingCanvas(a._w, a._h);
        var octx = out.getContext('2d');
        octx.drawImage(a._canvas, 0, 0);
        octx.drawImage(b._canvas, 0, 0);
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: 'RGBA' });
    });

    m.blend = new Sk.builtin.func(function (im1, im2, alpha) {
        var a = jsNum(alpha);
        var out = makeBackingCanvas(im1._w, im1._h);
        var octx = out.getContext('2d');
        octx.globalAlpha = 1 - a;
        octx.drawImage(im1._canvas, 0, 0);
        octx.globalAlpha = a;
        octx.drawImage(im2._canvas, 0, 0);
        octx.globalAlpha = 1;
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: im1._mode });
    });

    m.merge = new Sk.builtin.func(function (mode, bands) {
        var modeJs = jsStr(mode);
        // ВАЖЛИВО: bands — це кортеж/список PIL.Image.Image об'єктів, а не
        // примітивів. Sk.ffi.remapToJs() вміє розпаковувати лише примітивні
        // Python-типи (числа, рядки, вкладені списки з них) — для "непрозорих"
        // екземплярів кастомних класів він повертає undefined, через що
        // елементи масиву ставали undefined. Тому дістаємо сирі Python-об'єкти
        // напряму з .v — це внутрішній JS-масив елементів tuple/list у Skulpt
        // (так само, як Image.split() формує кортеж через new Sk.builtin.tuple(outs)).
        var bandList = (bands && Array.isArray(bands.v)) ? bands.v : [];
        var imgs = bandList.map(function (b) { return (b && b.v) ? b.v : b; });
        var w = imgs[0]._w, h = imgs[0]._h;
        var out = makeBackingCanvas(w, h);
        var octx = out.getContext('2d');
        var outId = octx.createImageData(w, h);
        var datas = imgs.map(function (im) { return im._ctx.getImageData(0, 0, w, h).data; });
        for (var i = 0; i < outId.data.length; i += 4) {
            outId.data[i] = datas[0][i];
            outId.data[i + 1] = datas[1] ? datas[1][i] : 0;
            outId.data[i + 2] = datas[2] ? datas[2][i] : 0;
            outId.data[i + 3] = datas[3] ? datas[3][i] : 255;
        }
        octx.putImageData(outId, 0, 0);
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: modeJs });
    });

    // Константи режимів зміни розміру / transpose, очікувані користувацьким кодом
    m.NEAREST = Sk.ffi.remapToPy(0);
    m.LANCZOS = Sk.ffi.remapToPy(1);
    m.BILINEAR = Sk.ffi.remapToPy(2);
    m.BICUBIC = Sk.ffi.remapToPy(3);
    m.BOX = Sk.ffi.remapToPy(4);
    m.HAMMING = Sk.ffi.remapToPy(5);
    m.ANTIALIAS = m.LANCZOS;

    m.FLIP_LEFT_RIGHT = Sk.ffi.remapToPy(0);
    m.FLIP_TOP_BOTTOM = Sk.ffi.remapToPy(1);
    m.ROTATE_90 = Sk.ffi.remapToPy(2);
    m.ROTATE_180 = Sk.ffi.remapToPy(3);
    m.ROTATE_270 = Sk.ffi.remapToPy(4);
    m.TRANSPOSE = Sk.ffi.remapToPy(5);
    m.TRANSVERSE = Sk.ffi.remapToPy(6);

    m.Image = PILLib.ImageType;

    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.ImageDraw
// ─────────────────────────────────────────────────────────────────────────────
function imagedraw_class($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function (self, im, mode) {
        self._im = im.v ? im.v : im;
        self._ctx = self._im._ctx;
        return pyNone();
    });

    function applyOutlineFill(ctx, outline, fill, width) {
        if (fill !== undefined && fill !== null && fill !== pyNone()) {
            ctx.fillStyle = PILLib.cssRGBA(PILLib.toRGBA(fill));
        }
        if (outline !== undefined && outline !== null && outline !== pyNone()) {
            ctx.strokeStyle = PILLib.cssRGBA(PILLib.toRGBA(outline));
        }
        ctx.lineWidth = width || 1;
    }

    $loc.line = new Sk.builtin.func(function (kwa, self, xy, fill, width) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        fill = arg([fill], kwa, 1, 'fill', fill);
        width = arg([width], kwa, 2, 'width', width);
        var pts = Sk.ffi.remapToJs(xy);
        if (!Array.isArray(pts[0])) {
            // flat list [x0,y0,x1,y1,...]
            var p2 = [];
            for (var i = 0; i < pts.length; i += 2) p2.push([pts[i], pts[i + 1]]);
            pts = p2;
        }
        var ctx = self._ctx;
        ctx.strokeStyle = PILLib.cssRGBA(PILLib.toRGBA(fill));
        ctx.lineWidth = width ? jsNum(width) : 1;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] + 0.5, pts[0][1] + 0.5);
        for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0] + 0.5, pts[j][1] + 0.5);
        ctx.stroke();
        return pyNone();
    });
    $loc.line.func_code.co_kwargs = true;

    $loc.point = new Sk.builtin.func(function (kwa, self, xy, fill) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        fill = arg([fill], kwa, 1, 'fill', fill);
        var pts = Sk.ffi.remapToJs(xy);
        if (!Array.isArray(pts[0])) pts = [pts];
        var ctx = self._ctx;
        ctx.fillStyle = PILLib.cssRGBA(PILLib.toRGBA(fill));
        pts.forEach(function (p) { ctx.fillRect(p[0], p[1], 1, 1); });
        return pyNone();
    });
    $loc.point.func_code.co_kwargs = true;

    $loc.rectangle = new Sk.builtin.func(function (kwa, self, xy, fill, outline, width) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        fill = arg([fill], kwa, 1, 'fill', fill);
        outline = arg([outline], kwa, 2, 'outline', outline);
        width = arg([width], kwa, 3, 'width', width);
        var b = Sk.ffi.remapToJs(xy);
        var x0 = b[0], y0 = b[1], x1 = b[2], y1 = b[3];
        var ctx = self._ctx;
        applyOutlineFill(ctx, outline, fill, width ? jsNum(width) : 1);
        if (fill !== undefined && fill !== null && fill !== pyNone()) ctx.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        if (outline !== undefined && outline !== null && outline !== pyNone()) ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0);
        return pyNone();
    });
    $loc.rectangle.func_code.co_kwargs = true;

    $loc.ellipse = new Sk.builtin.func(function (kwa, self, xy, fill, outline, width) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        fill = arg([fill], kwa, 1, 'fill', fill);
        outline = arg([outline], kwa, 2, 'outline', outline);
        width = arg([width], kwa, 3, 'width', width);
        var b = Sk.ffi.remapToJs(xy);
        var x0 = b[0], y0 = b[1], x1 = b[2], y1 = b[3];
        var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        var rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
        var ctx = self._ctx;
        applyOutlineFill(ctx, outline, fill, width ? jsNum(width) : 1);
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 0), Math.max(ry, 0), 0, 0, Math.PI * 2);
        if (fill !== undefined && fill !== null && fill !== pyNone()) ctx.fill();
        if (outline !== undefined && outline !== null && outline !== pyNone()) ctx.stroke();
        return pyNone();
    });
    $loc.ellipse.func_code.co_kwargs = true;

    $loc.circle = new Sk.builtin.func(function (kwa, self, center, radius, fill, outline, width) {
        kwa = unpackKWA(kwa);
        center = arg([center], kwa, 0, 'center', center);
        radius = arg([radius], kwa, 1, 'radius', radius);
        fill = arg([fill], kwa, 2, 'fill', fill);
        outline = arg([outline], kwa, 3, 'outline', outline);
        width = arg([width], kwa, 4, 'width', width);
        var c = Sk.ffi.remapToJs(center);
        var r = jsNum(radius);
        var ctx = self._ctx;
        applyOutlineFill(ctx, outline, fill, width ? jsNum(width) : 1);
        ctx.beginPath();
        ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
        if (fill !== undefined && fill !== null && fill !== pyNone()) ctx.fill();
        if (outline !== undefined && outline !== null && outline !== pyNone()) ctx.stroke();
        return pyNone();
    });
    $loc.circle.func_code.co_kwargs = true;

    $loc.polygon = new Sk.builtin.func(function (kwa, self, xy, fill, outline, width) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        fill = arg([fill], kwa, 1, 'fill', fill);
        outline = arg([outline], kwa, 2, 'outline', outline);
        width = arg([width], kwa, 3, 'width', width);
        var pts = Sk.ffi.remapToJs(xy);
        if (!Array.isArray(pts[0])) {
            var p2 = [];
            for (var i = 0; i < pts.length; i += 2) p2.push([pts[i], pts[i + 1]]);
            pts = p2;
        }
        var ctx = self._ctx;
        applyOutlineFill(ctx, outline, fill, width ? jsNum(width) : 1);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.closePath();
        if (fill !== undefined && fill !== null && fill !== pyNone()) ctx.fill();
        if (outline !== undefined && outline !== null && outline !== pyNone()) ctx.stroke();
        return pyNone();
    });
    $loc.polygon.func_code.co_kwargs = true;

    $loc.arc = new Sk.builtin.func(function (kwa, self, xy, start, end, fill, width) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        start = arg([start], kwa, 1, 'start', start);
        end = arg([end], kwa, 2, 'end', end);
        fill = arg([fill], kwa, 3, 'fill', fill);
        width = arg([width], kwa, 4, 'width', width);
        var b = Sk.ffi.remapToJs(xy);
        var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
        var rx = (b[2] - b[0]) / 2, ry = (b[3] - b[1]) / 2;
        var ctx = self._ctx;
        ctx.strokeStyle = PILLib.cssRGBA(PILLib.toRGBA(fill));
        ctx.lineWidth = width ? jsNum(width) : 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, jsNum(start) * Math.PI / 180, jsNum(end) * Math.PI / 180);
        ctx.stroke();
        return pyNone();
    });
    $loc.arc.func_code.co_kwargs = true;

    $loc.chord = new Sk.builtin.func(function (kwa, self, xy, start, end, fill, outline, width) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        start = arg([start], kwa, 1, 'start', start);
        end = arg([end], kwa, 2, 'end', end);
        fill = arg([fill], kwa, 3, 'fill', fill);
        outline = arg([outline], kwa, 4, 'outline', outline);
        width = arg([width], kwa, 5, 'width', width);
        var b = Sk.ffi.remapToJs(xy);
        var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
        var rx = (b[2] - b[0]) / 2, ry = (b[3] - b[1]) / 2;
        var ctx = self._ctx;
        applyOutlineFill(ctx, outline, fill, width ? jsNum(width) : 1);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, jsNum(start) * Math.PI / 180, jsNum(end) * Math.PI / 180);
        ctx.closePath();
        if (fill !== undefined && fill !== null && fill !== pyNone()) ctx.fill();
        if (outline !== undefined && outline !== null && outline !== pyNone()) ctx.stroke();
        return pyNone();
    });
    $loc.chord.func_code.co_kwargs = true;

    $loc.pieslice = new Sk.builtin.func(function (kwa, self, xy, start, end, fill, outline, width) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        start = arg([start], kwa, 1, 'start', start);
        end = arg([end], kwa, 2, 'end', end);
        fill = arg([fill], kwa, 3, 'fill', fill);
        outline = arg([outline], kwa, 4, 'outline', outline);
        width = arg([width], kwa, 5, 'width', width);
        var b = Sk.ffi.remapToJs(xy);
        var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
        var rx = (b[2] - b[0]) / 2, ry = (b[3] - b[1]) / 2;
        var ctx = self._ctx;
        applyOutlineFill(ctx, outline, fill, width ? jsNum(width) : 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.ellipse(cx, cy, rx, ry, 0, jsNum(start) * Math.PI / 180, jsNum(end) * Math.PI / 180);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        if (fill !== undefined && fill !== null && fill !== pyNone()) ctx.fill();
        if (outline !== undefined && outline !== null && outline !== pyNone()) ctx.stroke();
        return pyNone();
    });
    $loc.pieslice.func_code.co_kwargs = true;

    function setupFont(ctx, font) {
        if (font && font._cssFont) {
            ctx.font = font._cssFont;
        } else {
            ctx.font = '16px sans-serif';
        }
    }

    $loc.text = new Sk.builtin.func(function (kwa, self, xy, text, fill, font) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        text = arg([text], kwa, 1, 'text', text);
        fill = arg([fill], kwa, 2, 'fill', fill);
        font = arg([font], kwa, 3, 'font', font);
        var p = Sk.ffi.remapToJs(xy);
        var ctx = self._ctx;
        setupFont(ctx, font);
        ctx.fillStyle = PILLib.cssRGBA(PILLib.toRGBA(fill !== undefined ? fill : [0, 0, 0]));
        ctx.textBaseline = 'top';
        ctx.fillText(jsStr(text), p[0], p[1]);
        return pyNone();
    });
    $loc.text.func_code.co_kwargs = true;

	$loc.multiline_text = new Sk.builtin.func(function (kwa, self, xy, text, fill, font, spacing) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        text = arg([text], kwa, 1, 'text', text);
        fill = arg([fill], kwa, 2, 'fill', fill);
        font = arg([font], kwa, 3, 'font', font);
        spacing = arg([spacing], kwa, 4, 'spacing', spacing);

        var p = Sk.ffi.remapToJs(xy);
        var ctx = self._ctx;
        setupFont(ctx, font);
        ctx.fillStyle = PILLib.cssRGBA(PILLib.toRGBA(fill !== undefined ? fill : [0, 0, 0]));
        ctx.textBaseline = 'top';
        var lines = jsStr(text).split('\n');
        var lh = spacing !== undefined ? jsNum(spacing) : 4;
        var fontSize = parseInt(ctx.font, 10) || 16;
        for (var i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], p[0], p[1] + i * (fontSize + lh));
        }
        return pyNone();
    });
    $loc.multiline_text.func_code.co_kwargs = true;

    $loc.textlength = new Sk.builtin.func(function (kwa, self, text, font) {
        kwa = unpackKWA(kwa);
        text = arg([text], kwa, 0, 'text', text);
        font = arg([font], kwa, 1, 'font', font);
        var ctx = self._ctx;
        setupFont(ctx, font);
        var w = ctx.measureText(jsStr(text)).width;
        return Sk.ffi.remapToPy(w);
    });
    $loc.textlength.func_code.co_kwargs = true;

    $loc.textsize = new Sk.builtin.func(function (kwa, self, text, font) {
        kwa = unpackKWA(kwa);
        text = arg([text], kwa, 0, 'text', text);
        font = arg([font], kwa, 1, 'font', font);
        var ctx = self._ctx;
        setupFont(ctx, font);
        var w = ctx.measureText(jsStr(text)).width;
        var fontSize = parseInt(ctx.font, 10) || 16;
        return new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(fontSize)]);
    });
    $loc.textsize.func_code.co_kwargs = true;

	$loc.textbbox = new Sk.builtin.func(function (kwa, self, xy, text, font) {
        kwa = unpackKWA(kwa);
        xy = arg([xy], kwa, 0, 'xy', xy);
        text = arg([text], kwa, 1, 'text', text);
        font = arg([font], kwa, 2, 'font', font);

        var p = Sk.ffi.remapToJs(xy);
        var ctx = self._ctx;
        setupFont(ctx, font);
        var w = ctx.measureText(jsStr(text)).width;
        var fontSize = parseInt(ctx.font, 10) || 16;
        return new Sk.builtin.tuple([
            Sk.ffi.remapToPy(p[0]), Sk.ffi.remapToPy(p[1]),
            Sk.ffi.remapToPy(p[0] + w), Sk.ffi.remapToPy(p[1] + fontSize)
        ]);
    });
    $loc.textbbox.func_code.co_kwargs = true;
}

function makeImageDrawModule() {
    var m = {};
    m.Draw = new Sk.builtin.func(function (im, mode) {
        return Sk.misceval.callsim(PILLib.ImageDrawType, im, mode);
    });
    m.ImageDraw = PILLib.ImageDrawType;
    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.ImageFont
// ─────────────────────────────────────────────────────────────────────────────
function imagefont_class($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function (self, family, size) {
        self._family = family ? jsStr(family) : 'sans-serif';
        self._size = size ? jsNum(size) : 10;
        self._cssFont = self._size + 'px ' + self._family;
        return pyNone();
    });
    $loc.getsize = new Sk.builtin.func(function (self, text) {
        var ctx = PILLib._resolveCtx();
        ctx.font = self._cssFont;
        var w = ctx.measureText(jsStr(text)).width;
        return new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(self._size)]);
    });
}

function makeImageFontModule() {
    var m = {};
    m.truetype = new Sk.builtin.func(function (font, size) {
        var fam = jsStr(font);
        // якщо передано шлях типу "Arial.ttf", беремо ім'я файлу без розширення як family
        fam = fam.replace(/\.(ttf|otf|woff2?)$/i, '').split('/').pop();
        return Sk.misceval.callsim(PILLib.ImageFontType, new Sk.builtin.str(fam), size);
    });
    m.load_default = new Sk.builtin.func(function () {
        return Sk.misceval.callsim(PILLib.ImageFontType, new Sk.builtin.str('sans-serif'), Sk.ffi.remapToPy(11));
    });
    m.ImageFont = PILLib.ImageFontType;
    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.ImageColor
// ─────────────────────────────────────────────────────────────────────────────
function makeImageColorModule() {
    var m = {};
    m.getrgb = new Sk.builtin.func(function (color) {
        var c = PILLib.colorFromName(jsStr(color));
        return new Sk.builtin.tuple([Sk.ffi.remapToPy(c[0]), Sk.ffi.remapToPy(c[1]), Sk.ffi.remapToPy(c[2])]);
    });
    m.getcolor = new Sk.builtin.func(function (color, mode) {
        var c = PILLib.colorFromName(jsStr(color));
        var modeJs = mode ? jsStr(mode) : 'RGB';
        if (modeJs === 'L') return Sk.ffi.remapToPy(Math.round(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]));
        if (modeJs === 'RGBA') return new Sk.builtin.tuple(c.map(Sk.ffi.remapToPy));
        return new Sk.builtin.tuple([Sk.ffi.remapToPy(c[0]), Sk.ffi.remapToPy(c[1]), Sk.ffi.remapToPy(c[2])]);
    });
    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.ImageOps
// ─────────────────────────────────────────────────────────────────────────────
function applyPixelFn(self, fn) {
    var im = self.v ? self.v : self;
    var out = makeBackingCanvas(im._w, im._h);
    var octx = out.getContext('2d');
    var id = im._ctx.getImageData(0, 0, im._w, im._h);
    fn(id.data);
    octx.putImageData(id, 0, 0);
    return PILLib.wrapImage({ canvas: out, ctx: octx, mode: im._mode });
}

function makeImageOpsModule() {
    var m = {};
    m.grayscale = new Sk.builtin.func(function (im) {
        return applyPixelFn(im, function (d) {
            for (var i = 0; i < d.length; i += 4) {
                var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                d[i] = d[i + 1] = d[i + 2] = g;
            }
        });
    });
    m.invert = new Sk.builtin.func(function (im) {
        return applyPixelFn(im, function (d) {
            for (var i = 0; i < d.length; i += 4) {
                d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
            }
        });
    });
    m.mirror = new Sk.builtin.func(function (im) {
        var i = im.v ? im.v : im;
        return Sk.misceval.callsim(i.tp$getattr(new Sk.builtin.str('transpose')), Sk.ffi.remapToPy(0));
    });
    m.flip = new Sk.builtin.func(function (im) {
        var i = im.v ? im.v : im;
        return Sk.misceval.callsim(i.tp$getattr(new Sk.builtin.str('transpose')), Sk.ffi.remapToPy(1));
    });
    m.autocontrast = new Sk.builtin.func(function (im) {
        return applyPixelFn(im, function (d) {
            var min = 255, max = 0;
            for (var i = 0; i < d.length; i += 4) {
                for (var k = 0; k < 3; k++) { min = Math.min(min, d[i + k]); max = Math.max(max, d[i + k]); }
            }
            var range = Math.max(1, max - min);
            for (var j = 0; j < d.length; j += 4) {
                for (var c = 0; c < 3; c++) d[j + c] = Math.round((d[j + c] - min) * 255 / range);
            }
        });
    });
    m.expand = new Sk.builtin.func(function (kwa, im, border, fill) {
        kwa = unpackKWA(kwa);
        im = arg([im], kwa, 0, 'image', im);
        border = arg([border], kwa, 1, 'border', border);
        fill = arg([fill], kwa, 2, 'fill', fill);
        var i = im.v ? im.v : im;
        var b = jsNum(border) || 0;
        var w = i._w + b * 2, h = i._h + b * 2;
        var out = makeBackingCanvas(w, h);
        var octx = out.getContext('2d');
        octx.fillStyle = PILLib.cssRGBA(PILLib.toRGBA(fill !== undefined ? fill : [0, 0, 0]));
        octx.fillRect(0, 0, w, h);
        octx.drawImage(i._canvas, b, b);
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: i._mode });
    });
    m.expand.func_code.co_kwargs = true;
    m.fit = new Sk.builtin.func(function (kwa, im, size) {
        kwa = unpackKWA(kwa);
        im = arg([im], kwa, 0, 'image', im);
        size = arg([size], kwa, 1, 'size', size);
        var i = im.v ? im.v : im;
        var s = Sk.ffi.remapToJs(size);
        var targetW = s[0], targetH = s[1];
        var scale = Math.max(targetW / i._w, targetH / i._h);
        var sw = targetW / scale, sh = targetH / scale;
        var sx = (i._w - sw) / 2, sy = (i._h - sh) / 2;
        var out = makeBackingCanvas(targetW, targetH);
        var octx = out.getContext('2d');
        octx.drawImage(i._canvas, sx, sy, sw, sh, 0, 0, targetW, targetH);
        return PILLib.wrapImage({ canvas: out, ctx: octx, mode: i._mode });
    });
    m.fit.func_code.co_kwargs = true;
    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.ImageFilter
// ─────────────────────────────────────────────────────────────────────────────
function makeFilterObj(kind, radius) {
    return { _kind: kind, _radius: radius || 2 };
}
function makeImageFilterModule() {
    var m = {};
    ['BLUR', 'CONTOUR', 'DETAIL', 'EDGE_ENHANCE', 'EDGE_ENHANCE_MORE',
     'EMBOSS', 'FIND_EDGES', 'SMOOTH', 'SMOOTH_MORE', 'SHARPEN'].forEach(function (name) {
        m[name] = makeFilterObj(name);
    });
    m.GaussianBlur = new Sk.builtin.func(function (radius) {
        return makeFilterObj('GAUSSIAN', radius ? jsNum(radius) : 2);
    });
    m.BoxBlur = new Sk.builtin.func(function (radius) {
        return makeFilterObj('BLUR', radius ? jsNum(radius) : 2);
    });
    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.ImageEnhance
// ─────────────────────────────────────────────────────────────────────────────
function makeEnhanceClass(cssFilterFn) {
    return function ($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function (self, im) {
            self._im = im.v ? im.v : im;
            return pyNone();
        });
        $loc.enhance = new Sk.builtin.func(function (self, factor) {
            var f = jsNum(factor);
            var im = self._im;
            var out = makeBackingCanvas(im._w, im._h);
            var octx = out.getContext('2d');
            octx.filter = cssFilterFn(f);
            octx.drawImage(im._canvas, 0, 0);
            octx.filter = 'none';
            return PILLib.wrapImage({ canvas: out, ctx: octx, mode: im._mode });
        });
    };
}

function makeImageEnhanceModule() {
    var m = {};
    var BrightnessType = Sk.misceval.buildClass(m, makeEnhanceClass(function (f) { return 'brightness(' + f + ')'; }), 'Brightness', []);
    var ContrastType = Sk.misceval.buildClass(m, makeEnhanceClass(function (f) { return 'contrast(' + f + ')'; }), 'Contrast', []);
    var ColorType = Sk.misceval.buildClass(m, makeEnhanceClass(function (f) { return 'saturate(' + f + ')'; }), 'Color', []);
    var SharpnessType = Sk.misceval.buildClass(m, makeEnhanceClass(function (f) { return 'contrast(' + (1 + (f - 1) * 0.3) + ')'; }), 'Sharpness', []);
    m.Brightness = BrightnessType;
    m.Contrast = ContrastType;
    m.Color = ColorType;
    m.Sharpness = SharpnessType;
    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.ImageChops
// ─────────────────────────────────────────────────────────────────────────────
function chopOp(im1, im2, op) {
    var a = im1.v ? im1.v : im1, b = im2.v ? im2.v : im2;
    var w = a._w, h = a._h;
    var out = makeBackingCanvas(w, h);
    var octx = out.getContext('2d');
    var ad = a._ctx.getImageData(0, 0, w, h).data;
    var bd = b._ctx.getImageData(0, 0, w, h).data;
    var od = octx.createImageData(w, h);
    for (var i = 0; i < ad.length; i += 4) {
        for (var c = 0; c < 3; c++) {
            od.data[i + c] = op(ad[i + c], bd[i + c]);
        }
        od.data[i + 3] = 255;
    }
    octx.putImageData(od, 0, 0);
    return PILLib.wrapImage({ canvas: out, ctx: octx, mode: a._mode });
}

function makeImageChopsModule() {
    var m = {};
    m.add = new Sk.builtin.func(function (im1, im2, scale, offset) {
        var sc = scale ? jsNum(scale) : 1, off = offset ? jsNum(offset) : 0;
        return chopOp(im1, im2, function (x, y) { return Math.min(255, Math.max(0, (x + y) / sc + off)); });
    });
    m.subtract = new Sk.builtin.func(function (im1, im2, scale, offset) {
        var sc = scale ? jsNum(scale) : 1, off = offset ? jsNum(offset) : 0;
        return chopOp(im1, im2, function (x, y) { return Math.min(255, Math.max(0, (x - y) / sc + off)); });
    });
    m.multiply = new Sk.builtin.func(function (im1, im2) {
        return chopOp(im1, im2, function (x, y) { return (x * y) / 255; });
    });
    m.screen = new Sk.builtin.func(function (im1, im2) {
        return chopOp(im1, im2, function (x, y) { return 255 - ((255 - x) * (255 - y)) / 255; });
    });
    m.difference = new Sk.builtin.func(function (im1, im2) {
        return chopOp(im1, im2, function (x, y) { return Math.abs(x - y); });
    });
    m.lighter = new Sk.builtin.func(function (im1, im2) {
        return chopOp(im1, im2, function (x, y) { return Math.max(x, y); });
    });
    m.darker = new Sk.builtin.func(function (im1, im2) {
        return chopOp(im1, im2, function (x, y) { return Math.min(x, y); });
    });
    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIL.ImageTk — міст до Tkinter
// ─────────────────────────────────────────────────────────────────────────────
//
// Справжній PIL.ImageTk.PhotoImage обгортає C-рівневий Tk PhotoImage.
// У браузерній емуляції такого об'єкта немає — натомість PhotoImage носить
// власний offscreen <canvas> з пікселями.
//
// Перевірено за кодом tkinter-модуля цього проєкту: будь-де, де є kwarg
// `image=...` (Canvas.create_image, Label, Button тощо), значення або
// підставляється напряму в HTML-рядок (`'<img src="' + props.image + '"/>'`),
// або присвоюється `el.src = props.image` — в обох випадках JS неявно
// викликає valueOf()/toString() об'єкта (так само працює і вбудований
// `tkinter.PhotoImage(file=...)`, що повертає Sk.builtin.str — той теж
// перетворюється на рядок неявно). Тому власних правок у tkinter.js
// НЕ потрібно: PhotoImage/BitmapImage самі віддають себе як PNG data-URL
// через `toString`/`valueOf`, обчислені "на льоту" з self._canvas — це
// автоматично підхоплює зміни після paste().

function photoimage_class($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function (kwa, self, image) {
        kwa = unpackKWA(kwa);
        image = arg([image], kwa, 0, 'image', image);
        self._tkPhotoImage = true;
        self._canvas = makeBackingCanvas(1, 1);
        self._ctx = self._canvas.getContext('2d');
        self._w = 1;
        self._h = 1;

        // ВАЖЛИВО: tkinter.js (photoImageSrc) читає готовий data-URL
        // напряму з self.$dataUrl, а НЕ через toString()/valueOf() чи
        // Python __str__(). Тому self.$dataUrl треба виставляти й
        // оновлювати щоразу, коли міняється self._canvas.
        PILLib.refreshDataUrl(self, 'ImageTk.PhotoImage');
        // Лишаємо toString/valueOf як другорядну сумісність (на випадок
        // прямого приведення до рядка деінде), але вони більше не є
        // основним каналом передачі даних у tkinter.
        self.toString = function () { return PILLib.refreshDataUrl(self, 'ImageTk.PhotoImage'); };
        self.valueOf = self.toString;

        function loadFromImage(im) {
            var i = im.v ? im.v : im;
            PILLib.ensureImage(i, 'ImageTk.PhotoImage');
            var c = makeBackingCanvas(i._w, i._h);
            c.getContext('2d').drawImage(i._canvas, 0, 0);
            self._canvas = c;
            self._ctx = c.getContext('2d');
            self._w = c.width;
            self._h = c.height;
            PILLib.refreshDataUrl(self, 'ImageTk.PhotoImage');
        }

        // PhotoImage(image=<PIL.Image>) — найпоширеніший випадок
        if (image !== undefined && image !== pyNone() && Sk.abstr.typeName(image) === 'Image') {
            loadFromImage(image);
            return pyNone();
        }

        var file = arg([], kwa, 0, 'file', undefined);
        if (file !== undefined && file !== pyNone()) {
            // PhotoImage(file="...") — завантаження асинхронне, так само,
            // як PIL.Image.open, тож резюмимо через ту саму машинерію suspension.
            var path = jsStr(file);
            var imageMod = Sk.sysmodules.mp$subscript(Sk.ffi.remapToPy('PIL.Image'));
            var openFn = imageMod && imageMod.$d ? imageMod.$d['open'] : undefined;
            if (!openFn) {
                throw new Sk.builtin.IOError('ImageTk.PhotoImage: не вдалося знайти PIL.Image.open');
            }
            return PythonIDE.runAsync(function (resolve, reject) {
                var opened = Sk.misceval.callsim(openFn, new Sk.builtin.str(path));
                Sk.misceval.asyncToPromise(function () { return opened; }).then(function (im) {
                    try {
                        loadFromImage(im);
                        resolve(pyNone());
                    } catch (e) {
                        reject(e);
                    }
                }, reject);
            });
        }

        var size = arg([], kwa, 0, 'size', undefined);
        if (size !== undefined && size !== pyNone()) {
            var s = Sk.ffi.remapToJs(size);
            self._canvas = makeBackingCanvas(s[0], s[1]);
            self._ctx = self._canvas.getContext('2d');
            self._w = self._canvas.width;
            self._h = self._canvas.height;
        }

        PILLib.refreshDataUrl(self, 'ImageTk.PhotoImage');
        return pyNone();
    });
    $loc.__init__.func_code.co_kwargs = true;

    $loc.width = new Sk.builtin.func(function (self) { return Sk.ffi.remapToPy(self._w); });
    $loc.height = new Sk.builtin.func(function (self) { return Sk.ffi.remapToPy(self._h); });

    $loc.paste = new Sk.builtin.func(function (self, im, box) {
        var i = im.v ? im.v : im;
        PILLib.ensureImage(i, 'ImageTk.PhotoImage.paste');
        var dx = 0, dy = 0;
        if (box && box !== pyNone()) {
            var b = Sk.ffi.remapToJs(box);
            dx = b[0]; dy = b[1];
        }
        self._ctx.clearRect(dx, dy, i._w, i._h);
        self._ctx.drawImage(i._canvas, dx, dy);
        PILLib.refreshDataUrl(self, 'ImageTk.PhotoImage.paste');
        return pyNone();
    });

    $loc.__repr__ = new Sk.builtin.func(function (self) {
        return new Sk.builtin.str('<PIL.ImageTk.PhotoImage size=' + self._w + 'x' + self._h + '>');
    });
    $loc.__str__ = $loc.__repr__;
}

function bitmapimage_class($gbl, $loc) {
    // BitmapImage — спрощений аналог: у справжньому PIL це 1-бітна маска,
    // тут зведено до того ж canvas-носія, що й PhotoImage.
    $loc.__init__ = new Sk.builtin.func(function (kwa, self, image) {
        kwa = unpackKWA(kwa);
        image = arg([image], kwa, 0, 'image', image);
        self._tkPhotoImage = true;
        self._canvas = makeBackingCanvas(1, 1);
        self._ctx = self._canvas.getContext('2d');
        self._w = 1;
        self._h = 1;

        // Та сама сумісність із tkinter, що й у PhotoImage (див. коментар там).
        PILLib.refreshDataUrl(self, 'ImageTk.BitmapImage');
        self.toString = function () { return PILLib.refreshDataUrl(self, 'ImageTk.BitmapImage'); };
        self.valueOf = self.toString;
        if (image !== undefined && image !== pyNone() && Sk.abstr.typeName(image) === 'Image') {
            var i = image.v ? image.v : image;
            PILLib.ensureImage(i, 'ImageTk.BitmapImage');
            var c = makeBackingCanvas(i._w, i._h);
            c.getContext('2d').drawImage(i._canvas, 0, 0);
            self._canvas = c;
            self._ctx = c.getContext('2d');
            self._w = c.width;
            self._h = c.height;
            PILLib.refreshDataUrl(self, 'ImageTk.BitmapImage');
        }
        return pyNone();
    });
    $loc.__init__.func_code.co_kwargs = true;
    $loc.width = new Sk.builtin.func(function (self) { return Sk.ffi.remapToPy(self._w); });
    $loc.height = new Sk.builtin.func(function (self) { return Sk.ffi.remapToPy(self._h); });
}

function makeImageTkModule() {
    var m = {};
    m.PhotoImage = PILLib.PhotoImageType;
    m.BitmapImage = PILLib.BitmapImageType;

    m.getimage = new Sk.builtin.func(function (photo) {
        var p = photo.v ? photo.v : photo;
        if (!p || !p._canvas) {
            throw new Sk.builtin.ValueError('ImageTk.getimage: очікується PhotoImage/BitmapImage');
        }
        var c = makeBackingCanvas(p._w, p._h);
        c.getContext('2d').drawImage(p._canvas, 0, 0);
        return PILLib.wrapImage({ canvas: c, ctx: c.getContext('2d'), mode: 'RGBA' });
    });

    return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Реєстрація типів і підмодулів у Sk.builtinFiles (для надійного резолву import)
// ─────────────────────────────────────────────────────────────────────────────
if (!Sk.builtinFiles) Sk.builtinFiles = { files: {} };
if (!Sk.builtinFiles.files) Sk.builtinFiles.files = {};

var _submodules = {
    'PIL/Image.js':        makeImageModule,
    'PIL/ImageDraw.js':     makeImageDrawModule,
    'PIL/ImageFont.js':     makeImageFontModule,
    'PIL/ImageColor.js':    makeImageColorModule,
    'PIL/ImageOps.js':      makeImageOpsModule,
    'PIL/ImageFilter.js':   makeImageFilterModule,
    'PIL/ImageEnhance.js':  makeImageEnhanceModule,
    'PIL/ImageChops.js':    makeImageChopsModule,
    'PIL/ImageTk.js':       makeImageTkModule,
};

// ─────────────────────────────────────────────────────────────────────────────
// Головний $builtinmodule для PIL
// ─────────────────────────────────────────────────────────────────────────────
var $builtinmodule = function (name) {
    var mod = {};

    // Типи (мають бути визначені перед побудовою підмодулів)
    mod.Image = Sk.misceval.buildClass(mod, image_class, 'Image', []);
    PILLib.ImageType = mod.Image;

    mod.ImageDraw = Sk.misceval.buildClass(mod, imagedraw_class, 'ImageDraw', []);
    PILLib.ImageDrawType = mod.ImageDraw;

    mod.ImageFont = Sk.misceval.buildClass(mod, imagefont_class, 'ImageFont', []);
    PILLib.ImageFontType = mod.ImageFont;

    mod.PhotoImage = Sk.misceval.buildClass(mod, photoimage_class, 'PhotoImage', []);
    PILLib.PhotoImageType = mod.PhotoImage;

    mod.BitmapImage = Sk.misceval.buildClass(mod, bitmapimage_class, 'BitmapImage', []);
    PILLib.BitmapImageType = mod.BitmapImage;

    var submap = {
        'Image':        makeImageModule,
        'ImageDraw':     makeImageDrawModule,
        'ImageFont':     makeImageFontModule,
        'ImageColor':    makeImageColorModule,
        'ImageOps':      makeImageOpsModule,
        'ImageFilter':   makeImageFilterModule,
        'ImageEnhance':  makeImageEnhanceModule,
        'ImageChops':    makeImageChopsModule,
        'ImageTk':       makeImageTkModule,
    };

    for (var shortName in submap) {
        var makeFn = submap[shortName];
        var submodDict = makeFn();

        var submod = new Sk.builtin.module();
        submod.tp$name = 'PIL.' + shortName;
        submod.$d = {};
        for (var attr in submodDict) {
            if (Object.prototype.hasOwnProperty.call(submodDict, attr)) {
                submod.$d[attr] = submodDict[attr];
            }
        }
        submod.$d['__name__'] = new Sk.builtin.str('PIL.' + shortName);
        Sk.sysmodules.mp$ass_subscript(Sk.ffi.remapToPy('PIL.' + shortName), submod);
        mod[shortName] = submod;
    }

    mod.__version__ = new Sk.builtin.str('11.0.0-skulpt');

    return mod;
};
