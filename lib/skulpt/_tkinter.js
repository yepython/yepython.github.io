// Skulpt module `_tkinter`: the real CPython tkinter package talks to Tk only
// through this module, so exposing the JS Tk engine here makes
// `import tkinter` work under Skulpt unchanged.
//
// This is a classic Skulpt builtin script (defines $builtinmodule). Load
// tk-engine.js first so it sets window.TkEngine before any Python code
// imports _tkinter:
//
//   <script src="tk-engine.js"></script>
//   <script src="tk-window-system.js"></script>
//
// The engine's suspension protocol (susp.chain / susp.suspend) is bridged to
// Skulpt's Suspension machinery here, so mainloop(), after() and tkwait()
// suspend the Python program until the page delivers events.

var $builtinmodule = function (name) {
  "use strict";

  var engine =
    (typeof window !== "undefined" && window.TkEngine) ||
    (typeof globalThis !== "undefined" && globalThis.TkEngine);
  if (!engine) {
    throw new Error(`_tkinter: window.TkEngine is missing (the Tk engine must load before import tkinter)`);
  }

  // ---- віртуальна ФС: engine.hooks.fs <-> jsfs (fsToBrowse) --------------------------------
  // Без цього hooks.fs — це заглушки движка: canvas.postscript / PhotoImage.write
  // нічого не зберігають, а діалоги файлів показують порожній список.
  (function wireJsfs() {
    var hooks = engine.hooks;
    if (!hooks) return;
    function J() {
      var j = (typeof fsToBrowse !== `undefined` && fsToBrowse) || globalThis.fsToBrowse;
      if (!j) throw new Error(`віртуальна файлова система jsfs недоступна`);
      return j;
    }
    function norm(p) {
      var parts = [];
      String(p).split(`/`).forEach(function (s) {
        if (s === `` || s === `.`) return;
        if (s === `..`) parts.pop();
        else parts.push(s);
      });
      return `/` + parts.join(`/`);
    }
    function isDir(p) {
      p = norm(p);
      return p === `/` || J().type(p) === `folder`;
    }
    function toStr(data) {
      if (typeof data === `string`) return data;
      if (data instanceof Uint8Array) {
        var s = ``;
        for (var i = 0; i < data.length; i++) s += String.fromCharCode(data[i]);
        return s;
      }
      return String(data);
    }
    var fs = hooks.fs;
    fs.program_dir = `/`;
    fs.program_files = [];
    fs.sep = `/`;
    fs.normpath = norm;
    fs.is_dir = isDir;
    fs.relpath = function (path, start) {
      var a = norm(path).split(`/`).filter(Boolean);
      var b = norm(start || `/`).split(`/`).filter(Boolean);
      var i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      var out = b.slice(i).map(function () { return `..`; }).concat(a.slice(i));
      return out.length ? out.join(`/`) : `.`;
    };
    fs.size = function (path) {
      var n = J().size(norm(path));
      if (n === -1) throw new Error(`No such file`);
      return n;
    };
    fs.walk = function* (root, keep) {
      root = norm(root);
      var dirs = J().ls(root, `folders`).filter(function (d) { return !keep || keep(d); });
      var files = J().ls(root, `files`);
      yield { top: root, dirs: dirs, files: files };
      for (var i = 0; i < dirs.length; i++) {
        yield* fs.walk(root === `/` ? `/` + dirs[i] : root + `/` + dirs[i], keep);
      }
    };
    fs.makedirs = function (p) {
      if (p && norm(p) !== `/`) J().mkdir(norm(p));
    };
    fs.write = function (path, data) {
      path = norm(path);
      var cut = path.lastIndexOf(`/`);
      if (cut > 0) J().mkdir(path.slice(0, cut));
      if (J().write(path, toStr(data)) === false) {
        throw new Error(`недостатньо місця у сховищі`);
      }
    };
    hooks.apply_uploads = function (uploads, root) {
      /* Файли, завантажені з комп'ютера у діалозі: пишемо їх у jsfs. */
      (uploads || []).forEach(function (u) {
        var path = norm((root || `/`) + `/` + u.path);
        var binary = /\.(png|gif|jpe?g|webp|bmp|ico)$/i.test(path);
        fetch(u.url)
          .then(function (r) { return binary ? r.blob() : r.text(); })
          .then(function (body) {
            if (!binary) return fs.write(path, body);
            return new Promise(function (resolve) {
              var reader = new FileReader();
              reader.onload = function () { fs.write(path, reader.result); resolve(); };
              reader.readAsDataURL(body);
            });
          })
          .catch(function (e) { console.warn(`_tkinter: не вдалося записати`, path, e); });
      });
    };
  })();

  // ---- прибирання попередніх вікон ------------------------------------------------------
  // Модуль _tkinter імпортується під час `import tkinter`, тож у цей момент
  // усі вікна, створені попереднім запуском програми, знищуються — інакше
  // вони лишалися б на екрані поверх нових.
  if (typeof engine.destroyAllWindows === `function`) {
    try {
      engine.destroyAllWindows();
    } catch (e) {
      if (typeof console !== `undefined`) console.warn(`_tkinter: не вдалося знищити попередні вікна`, e);
    }
  }

  // ---- engine TclError -> Python TclError ---------------------------------------------

  var TclError = Sk.abstr.buildNativeClass(`TclError`, {
    constructor: function TclError(message) {
      Sk.asserts.assert(this instanceof TclError, `TclError must be called with new`);
      var msg = message === undefined || message === null ? `` : String(message);
      this.args = new Sk.builtin.tuple(msg === `` ? [] : [new Sk.builtin.str(msg)]);
      this.traceback = [];
      this.cause = null;
      this.context = null;
      this.$d = new Sk.builtin.dict();
    },
    base: Sk.builtin.Exception,
    proto: {
      toString: function () {
        return `TclError: ` + (this.args.v.length ? this.args.v[0].v : ``);
      },
    },
  });

  function fromJsError(e) {
    if (e instanceof engine.TclError) return new TclError(e.message);
    if (e && e.name === `TclError`) return new TclError(e.message);
    return e;
  }

  function boundary(fn) {
    /* Runs an engine call, converting TclErrors into Python TclErrors
       both synchronously and after a suspension resumes. */
    return Sk.misceval.tryCatch(fn, function (e) {
      throw fromJsError(e);
    });
  }

  // ---- value conversion ----------------------------------------------------------------

  function pyToStr(v) {
    var s;
    if (typeof v.tp$str === "function") s = v.tp$str();
    else s = Sk.misceval.objectRepr(v);
    return s instanceof Sk.builtin.str ? s.v : String(s);
  }

  var pilImageNames = new Map();

  function toJs(v, app) {
    // Mirrors CPython _tkinter's AsObj: scalars pass through, sequences
    // convert recursively, and any other object falls back to str() (which
    // is how Variable instances become their Tcl names in widget options).
    if (v === undefined || v === null) return null;
    if (v instanceof Sk.builtin.bool) return v.v;
    if (v instanceof Sk.builtin.str) return v.v;
    if (v instanceof Sk.builtin.int_) return Number(v.v);
    if (v instanceof Sk.builtin.float_) {
      var n = Number(v.v);
      // Tcl keeps the ".0" of a whole double ("1.0"); JS prints "1", which
      // breaks Tcl index parsing (e.g. the text index "1.0").
      return Number.isInteger(n) ? `${n}.0` : n;
    }
    if (v instanceof Sk.builtin.none) return null;
    if (v instanceof Sk.builtin.tuple || v instanceof Sk.builtin.list) {
      var arr = [];
      var iter = v.tp$iter();
      var item = iter.tp$iternext();
      while (item !== undefined) {
        arr.push(toJs(item, app));
        item = iter.tp$iternext();
      }
      return arr;
    }
    // PIL.ImageTk.PhotoImage/BitmapImage — це не Tk-зображення, а об'єкт PIL.
    // Переносимо його data-URL у реєстр зображень рухія («живе» зображення:
    // оновлюється після paste()) і віддаємо ім'я.
    if (app && v instanceof Sk.builtin.object && v.$dataUrl !== undefined) {
      var url = String(v.$dataUrl);
      if (url.indexOf("data:image/") === 0) {
        // Один і той самий об'єкт PIL реєструємо лише раз.
        if (!pilImageNames.has(v)) {
          pilImageNames.set(v, app.images.register_provider(function () {
            return String(v.$dataUrl);
          }));
        }
        return pilImageNames.get(v);
      }
    }
    if (v instanceof Sk.builtin.dict) return Sk.ffi.remapToJs(v);
    if (v instanceof Sk.builtin.object) return pyToStr(v);
    return Sk.ffi.remapToJs(v);
  }

  function numberToPy(v) {
    // Skulpt numberToPy є не в усіх збірках — робимо це вручну.
    return Number.isInteger(v) ? new Sk.builtin.int_(v) : new Sk.builtin.float_(v);
  }

  function fromJs(v) {
    if (v === null || v === undefined) return Sk.builtin.none.none$;
    if (typeof v === `string`) return new Sk.builtin.str(v);
    if (typeof v === `number`) return numberToPy(v);
    if (typeof v === `boolean`) return new Sk.builtin.bool(v);
    if (Array.isArray(v)) return new Sk.builtin.list(v.map(fromJs));
    if (v instanceof Sk.builtin.object) return v;
    return Sk.ffi.remapToPy(v);
  }

  // ---- bridge the engine suspension protocol to Skulpt ----------------------------------

  engine.set_susp({
    is_sync: false,
    is_suspension: function (v) {
      return v instanceof Sk.misceval.Suspension;
    },
    chain: function (v, f, g) {
      if (g === undefined) return Sk.misceval.chain(v, f);
      var wrap = function (fn) {
        return function (x) {
          try {
            return fn(x);
          } catch (e) {
            if (g) return g(e);
            throw e;
          }
        };
      };
      if (v instanceof Sk.misceval.Suspension) {
        // tryCatch also routes errors thrown when the suspension resumes to g.
        v = Sk.misceval.tryCatch(
          function () {
            return v;
          },
          function (e) {
            return g(e);
          }
        );
      }
      return Sk.misceval.chain(v, wrap(f));
    },
    suspend: function (reg) {
      return Sk.misceval.promiseToSuspension(
        new Promise(function (resolve) {
          reg(function (x) {
            resolve(x);
          });
        })
      );
    },
  });

  // ---- TkappType -------------------------------------------------------------------------

  var TkappType = Sk.abstr.buildNativeClass(`TkappType`, {
    constructor: function TkappType(app) {
      this.app = app;
    },
    slots: {
      tp$repr: function () {
        return new Sk.builtin.str(`<tkinter.TkappType object>`);
      },
    },
    methods: {
      call: {
        $meth: function () {
          var self = this;
          var jsArgs = Array.prototype.map.call(arguments, function (v) {
            return toJs(v, self.app);
          });
          return boundary(function () {
            var r = self.app.call.apply(self.app, jsArgs);
            if (engine.susp.is_suspension(r)) {
              return engine.susp.chain(r, fromJs);
            }
            return fromJs(r);
          });
        },
        $flags: { MinArgs: 1 },
      },
      eval: {
        $meth: function (script) {
          var self = this;
          return boundary(function () {
            var r = self.app.eval(toJs(script));
            if (engine.susp.is_suspension(r)) {
              return engine.susp.chain(r, fromJs);
            }
            return fromJs(r);
          });
        },
        $flags: { OneArg: true },
      },
      createcommand: {
        $meth: function (cname, func) {
          var self = this;
          return boundary(function () {
            self.app.createcommand(toJs(cname), wrapCallable(func));
            return Sk.builtin.none.none$;
          });
        },
        $flags: { MinArgs: 2, MaxArgs: 2 },
      },
      deletecommand: {
        $meth: function (cname) {
          var self = this;
          return boundary(function () {
            self.app.deletecommand(toJs(cname));
            return Sk.builtin.none.none$;
          });
        },
        $flags: { MinArgs: 1, MaxArgs: 1 },
      },
      getvar: {
        $meth: function (vname) {
          var self = this;
          return boundary(function () {
            return fromJs(self.app.getvar(toJs(vname)));
          });
        },
        $flags: { OneArg: true },
      },
      globalgetvar: {
        $meth: function (vname) {
          var self = this;
          return boundary(function () {
            return fromJs(self.app.globalgetvar(toJs(vname)));
          });
        },
        $flags: { OneArg: true },
      },
      setvar: {
        $meth: function (vname, value) {
          var self = this;
          return boundary(function () {
            return fromJs(self.app.setvar(toJs(vname), toJs(value)));
          });
        },
        $flags: { MinArgs: 2, MaxArgs: 2 },
      },
      globalsetvar: {
        $meth: function (vname, value) {
          var self = this;
          return boundary(function () {
            return fromJs(self.app.globalsetvar(toJs(vname), toJs(value)));
          });
        },
        $flags: { MinArgs: 2, MaxArgs: 2 },
      },
      globalunsetvar: {
        $meth: function (vname) {
          var self = this;
          return boundary(function () {
            return fromJs(self.app.globalunsetvar(toJs(vname)));
          });
        },
        $flags: { MinArgs: 1, MaxArgs: 1 },
      },
      getint: {
        $meth: function (value) {
          var self = this;
          return boundary(function () {
            return new Sk.builtin.int_(self.app.getint(toJs(value)));
          });
        },
        $flags: { OneArg: true },
      },
      getdouble: {
        $meth: function (value) {
          var self = this;
          return boundary(function () {
            return new Sk.builtin.float_(self.app.getdouble(toJs(value)));
          });
        },
        $flags: { OneArg: true },
      },
      getboolean: {
        $meth: function (value) {
          var self = this;
          return boundary(function () {
            return new Sk.builtin.bool(self.app.getboolean(toJs(value)));
          });
        },
        $flags: { OneArg: true },
      },
      splitlist: {
        $meth: function (value) {
          var self = this;
          return boundary(function () {
            return new Sk.builtin.list(self.app.splitlist(toJs(value)).map(fromJs));
          });
        },
        $flags: { OneArg: true },
      },
      mainloop: {
        $meth: function (threshold) {
          var self = this;
          return boundary(function () {
            var r = self.app.mainloop(threshold === undefined ? 0 : toJs(threshold));
            if (r instanceof Sk.misceval.Suspension) return r;
            return Sk.builtin.none.none$;
          });
        },
        $flags: { MinArgs: 0, MaxArgs: 1 },
      },
      dooneevent: {
        $meth: function (flags) {
          var self = this;
          return boundary(function () {
            var r = self.app.dooneevent(flags === undefined ? 0 : toJs(flags));
            if (r instanceof Sk.misceval.Suspension) return r;
            return new Sk.builtin.bool(Boolean(r));
          });
        },
        $flags: { MinArgs: 0, MaxArgs: 1 },
      },
      quit: {
        $meth: function () {
          this.app.quit();
          return Sk.builtin.none.none$;
        },
        $flags: { NoArgs: true },
      },
      loadtk: {
        $meth: function () {
          var self = this;
          return boundary(function () {
            var r = self.app.loadtk();
            if (r instanceof Sk.misceval.Suspension) return r;
            return Sk.builtin.none.none$;
          });
        },
        $flags: { NoArgs: true },
      },
      settrace: {
        $meth: function (func) {
          var self = this;
          self.app.settrace(wrapCallable(func));
          return Sk.builtin.none.none$;
        },
        $flags: { OneArg: true },
      },
      gettrace: {
        $meth: function () {
          return Sk.builtin.none.none$;
        },
        $flags: { NoArgs: true },
      },
    },
  });

  function wrapCallable(func) {
    /* Wraps a Python callable as a JS function the engine can invoke
       with Tcl string arguments; returns the result as a JS value. */
    return function () {
      var pyArgs = Array.prototype.map.call(arguments, function (a) {
        return new Sk.builtin.str(String(a));
      });
      var r = Sk.misceval.applyOrSuspend(func, null, null, null, pyArgs);
      if (r instanceof Sk.misceval.Suspension) return Sk.misceval.chain(r, toJs);
      return toJs(r);
    };
  }

  // ---- module surface --------------------------------------------------------------------

  // Skulpt манглить «reserved»-імена Python: "call" -> "call_$rw$", "eval" -> "eval_$rw$".
  // Атрибут шукається за мангленим іменем, тому реєструємо методи під обома
  // іменами (так модуль працює і в старих, і в нових збірках Skulpt).
  ["call", "eval"].forEach(function (name) {
    var mangled = new Sk.builtin.str(name).$mangled;
    if (mangled !== name && TkappType.prototype[name] !== undefined && TkappType.prototype[mangled] === undefined) {
      TkappType.prototype[mangled] = TkappType.prototype[name];
    }
  });

  var mod = {};

  mod.TclError = TclError;
  mod.TkappType = TkappType;
  mod.Tcl_Obj = Sk.abstr.buildNativeClass(`Tcl_Obj`, {
    constructor: function Tcl_Obj() {},
    slots: { tp$doc: `placeholder: values are returned as plain Python objects` },
  });

  mod.TK_VERSION = new Sk.builtin.str(`8.6`);
  mod.TCL_VERSION = new Sk.builtin.str(`8.6`);
  mod.READABLE = new Sk.builtin.int_(2);
  mod.WRITABLE = new Sk.builtin.int_(4);
  mod.EXCEPTION = new Sk.builtin.int_(8);
  mod.DONT_WAIT = new Sk.builtin.int_(2);
  mod.WINDOW_EVENTS = new Sk.builtin.int_(4);
  mod.FILE_EVENTS = new Sk.builtin.int_(8);
  mod.TIMER_EVENTS = new Sk.builtin.int_(16);
  mod.IDLE_EVENTS = new Sk.builtin.int_(32);
  mod.ALL_EVENTS = new Sk.builtin.int_(-3);

  mod.create = new Sk.builtin.func(function (screenName, baseName, className, interactive, wantobjects, wantTk, sync, use) {
    Sk.builtin.pyCheckArgsLen(`create`, arguments.length, 0, 8);
    var cls = className === undefined ? `Tk` : toJs(className);
    var inter = interactive === undefined ? false : Boolean(toJs(interactive));
    var want = wantobjects === undefined ? true : Boolean(toJs(wantobjects));
    return boundary(function () {
      return new TkappType(new engine.TkApp(cls, inter, want));
    });
  });

  var busywait = 20;
  mod.setbusywaitinterval = new Sk.builtin.func(function (ms) {
    Sk.builtin.pyCheckArgsLen(`setbusywaitinterval`, arguments.length, 1, 1);
    busywait = Math.trunc(toJs(ms));
    return Sk.builtin.none.none$;
  });
  mod.getbusywaitinterval = new Sk.builtin.func(function () {
    Sk.builtin.pyCheckArgsLen(`getbusywaitinterval`, arguments.length, 0, 0);
    return new Sk.builtin.int_(busywait);
  });

  mod._flatten = new Sk.builtin.func(function (seq) {
    Sk.builtin.pyCheckArgsLen(`_flatten`, arguments.length, 1, 1);
    var out = [];
    var walk = function (v) {
      if (v instanceof Sk.builtin.tuple || v instanceof Sk.builtin.list) {
        v.v.forEach(walk);
        return;
      }
      if (v instanceof Sk.builtin.none || v === null || v === undefined) return;
      out.push(v);
    };
    walk(seq);
    return new Sk.builtin.tuple(out);
  });

  // Host helpers (the page drives events/timers like PyThonny's tk_pump).
  mod.deliver = new Sk.builtin.func(function (events) {
    Sk.builtin.pyCheckArgsLen(`deliver`, arguments.length, 1, 1);
    engine.deliver(String(toJs(events)));
    return Sk.builtin.none.none$;
  });
  mod.pump = new Sk.builtin.func(function () {
    Sk.builtin.pyCheckArgsLen(`pump`, arguments.length, 0, 0);
    var r = engine.pump();
    if (r instanceof Sk.misceval.Suspension) return r;
    return numberToPy(r);
  });

  return mod;
};
