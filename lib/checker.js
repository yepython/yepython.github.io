// lib/checker.js — браузерна перевірка учнівського коду (Skulpt).
// Порт логіки checker/core.py + checker/checker.py на JavaScript.
// GUI-обв'язка (tkinter) завантажується з lib/checker_gui.py під час виконання.

(function () {
  "use strict";

  var Checker = window.Checker = window.Checker || {};

  // Переклад повідомлень (читає window.translations, запасний — angлійська/українська)
  function tr(key, fallback) {
    var lang = (typeof selectedLang !== "undefined") ? selectedLang : "en";
    var tr = (window.translations && (window.translations[lang] || window.translations.en)) || {};
    if (tr[key]) return tr[key];
    if (window.translations && window.translations.en && window.translations.en[key]) return window.translations.en[key];
    return fallback || key;
  }

  // ---------- Skulpt-конфіг: збереження/відновлення ----------
  function saveSk() {
    return {
      output: Sk.output,
      inputfun: Sk.inputfun,
      inputfunTakesPrompt: Sk.inputfunTakesPrompt,
      read: Sk.read,
      execLimit: Sk.execLimit,
      execStart: Sk.execStart,
      killableWhile: Sk.killableWhile,
      dateSet: Sk.dateSet
    };
  }
  function restoreSk(s) {
    if (!s) return;
    Sk.configure({ output: s.output, inputfun: s.inputfun, inputfunTakesPrompt: s.inputfunTakesPrompt, read: s.read, killableWhile: s.killableWhile });
    Sk.execLimit = s.execLimit;
    Sk.execStart = s.execStart;
    Sk.dateSet = s.dateSet;
    Sk.inputfun = s.inputfun;
    Sk.inputfunTakesPrompt = s.inputfunTakesPrompt;
  }

  // ---------- драйвер суспензій Skulpt ----------
  function drive(r) {
    return new Promise(function (resolve, reject) {
      function step(r) {
        try {
          while (r && r.$isSuspension) {
            if (r.data && r.data.promise) {
              r.data.promise.then(function (x) {
                r.data.result = x;
                try { step(r.resume()); } catch (e) { reject(e); }
              }, function (err) {
                r.data.error = err;
                try { step(r.resume()); } catch (e) { reject(e); }
              });
              return;
            }
            r = r.resume();
          }
          resolve(r);
        } catch (e) { reject(e); }
      }
      step(r);
    });
  }

  function skExcInfo(e) {
    var type = (e && (e.tp$name || (e.constructor && e.constructor.name))) || "Error";
    // message
    var msg = "";
    try {
      var args = e.args;
      var v = (args && args.v) ? args.v : (Array.isArray(args) ? args : null);
      if (v && v.length) {
        var remapped = v.map(function (a) { try { return Sk.ffi.remapToJs(a); } catch (x) { return String(a); } });
        if (remapped.length === 1 && typeof remapped[0] === "string") msg = remapped[0];
        else msg = remapped.map(function (a) { return (a === null || a === undefined) ? String(a) : (typeof a === "object" ? JSON.stringify(a) : String(a)); }).join(", ");
      }
    } catch (x) { /* ignore */ }
    if (!msg) {
      msg = String(e).replace(/^[^:]*:\s*/, "").replace(/\s+on line \d+.*$/, "");
    }
    return { type: type, message: msg };
  }

  function isSystemExit(e) {
    var t = e && (e.tp$name || (e.constructor && e.constructor.name));
    return t === "SystemExit";
  }

  function exitCodeFrom(e) {
    var args = e.args;
    var v = (args && args.v) ? args.v : (Array.isArray(args) ? args : []);
    if (!v || !v.length) return 0;
    var first = v[0];
    var js;
    try { js = Sk.ffi.remapToJs(first); } catch (x) { js = first; }
    if (typeof js === "number") return js;
    if (typeof js === "boolean") return js ? 1 : 0;
    if (js === null || js === undefined) return 0;
    return 1;
  }

  var GUI_PRELUDE = `
# -*- coding: utf-8 -*-
# GUI-обв'язка для браузерної перевірки учнівських робіт (Skulpt + емулятор Tkinter).
#
# Це порт робочої частини checker/core.py (worker_main, _ser, _snap, _do_action,
# _session, _install_patches), адаптований до середовища Skulpt: без модулів
# builtins/ast/io/traceback, які у Skulpt недоступні.
#
# Використання (з lib/checker.js):
#   1) у просторі імен створюється scope з __name__/__file__;
#   2) у scope підкладається змінна _ACTIONS (список словників-дій);
#   3) компілюється й виконується цей файл (прелюдія);
#   4) у тому ж scope компілюється й виконується код учня/еталона;
#   5) викликається _fallback() (якщо mainloop() не спрацював);
#   6) зі scope читається _W:
#        _W = {"steps": [ {label, tree, dialogs, errors, stdout, action_error}, ... ],
#              "error": None|str, "done": bool}
#
# ВАЖЛИВО: _ACTIONS має бути визначена ДО виконання коду учня.

import sys
import tkinter as _ytk
try:
    _ytk._default_root = None
except BaseException:
    pass
from tkinter import messagebox as _ymb
from tkinter import simpledialog as _ysd
from tkinter import filedialog as _yfd

ENTRY_CLASSES = {"Entry", "TEntry", "Spinbox", "TSpinbox", "TCombobox"}
TYPE_CLASSES = {"Entry", "TEntry", "Spinbox", "TSpinbox", "Text"}

if "_ACTIONS" not in globals():
    _ACTIONS = []

if "_LBL_INITIAL" not in globals():
    _LBL_INITIAL = "Початковий стан"

if "_MSG" not in globals():
    _MSG = {
        "entry": "поле введення",
        "not_found": "не знайдено %s (№%d, всього знайдено %d)",
        "no_widget_text": "не знайдено віджет з текстом %r (№%d)",
        "no_menu_item": "немає пункту меню %r",
        "unknown_action": "невідома дія %r",
        "mainloop_no_window": "mainloop() викликано без створеного вікна",
        "no_tk_window": "Не знайдено вікно tkinter (ні mainloop, ні root, ні create_app()).",
    }

_W = {"steps": [], "error": None, "done": False}


class _Cap(object):
    """Простий накопичувач виводу (заміна io.StringIO)."""

    def __init__(self):
        self.parts = []

    def write(self, s):
        s = str(s)
        self.parts.append(s)
        return len(s)

    def writelines(self, lines):
        for ln in lines:
            self.write(ln)

    def flush(self):
        pass

    def getvalue(self):
        return "".join(self.parts)

    def truncate(self, *a):
        self.parts = []

    def seek(self, *a):
        pass


_W["stdout"] = _Cap()
sys.stdout = _W["stdout"]
sys.stderr = _W["stdout"]


# ---------------------------------------------------------------- серіалізація
def _cget(w, key):
    try:
        return w.cget(key)
    except BaseException:
        return None


def _class_of(w):
    if isinstance(w, _ytk.Tk):
        return "Tk"
    try:
        return w.winfo_class()
    except BaseException:
        return "?"


def _text_of(w, cls):
    if cls in ENTRY_CLASSES or cls == "Text":
        return None
    t = _cget(w, "text")
    if t in (None, ""):
        tv = _cget(w, "textvariable")
        if tv:
            try:
                t = w.getvar(str(tv))
            except BaseException:
                pass
    return None if t is None else str(t)


def _state_of(w):
    try:
        if hasattr(w, "instate"):
            if w.instate(["disabled"]):
                return "disabled"
            if w.instate(["readonly"]):
                return "readonly"
            return "normal"
    except BaseException:
        pass
    st = _cget(w, "state")
    return None if st is None else str(st)


def _value_of(w, cls):
    try:
        if cls in ENTRY_CLASSES:
            return w.get()
        if cls == "Text":
            return w.get("1.0", "end-1c")
        if cls == "Listbox":
            return list(w.get(0, "end"))
        if cls in ("Scale", "TScale"):
            return round(float(w.get()), 4)
        if cls == "TProgressbar":
            return round(float(w.cget("value")), 4)
    except BaseException:
        pass
    return None


def _s(v):
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, (list, tuple)):
        return [_s(x) for x in v]
    return str(v)


def _norm_color(w, c):
    try:
        r, g, b = w.winfo_rgb(c)
        return "#%02x%02x%02x" % (r >> 8, g >> 8, b >> 8)
    except BaseException:
        return str(c)


def _norm_font(w, f):
    try:
        from tkinter import font as tkfont
        a = tkfont.Font(root=w, font=f).actual()
        return "%s,%s,%s,%s" % (a["family"], a["size"], a["weight"], a["slant"])
    except BaseException:
        return str(f)


def _style_of(w):
    d = {}
    for key, opt in (("bg", "background"), ("fg", "foreground"), ("font", "font"),
                     ("width", "width"), ("height", "height"), ("relief", "relief"),
                     ("anchor", "anchor"), ("justify", "justify"),
                     ("padx", "padx"), ("pady", "pady"), ("bd", "borderwidth")):
        v = _cget(w, opt)
        if v in (None, ""):
            continue
        if key in ("bg", "fg"):
            v = _norm_color(w, v)
        elif key == "font":
            v = _norm_font(w, v)
        d[key] = str(v)
    if isinstance(w, (_ytk.Tk, _ytk.Toplevel)):
        try:
            d["size"] = w.geometry().split("+")[0]
            d["resizable"] = str(list(w.resizable()))
        except BaseException:
            pass
    return d


def _layout_of(w):
    try:
        m = w.winfo_manager()
        if m == "grid":
            i = w.grid_info()
            return {"m": "grid", "row": str(i.get("row")), "column": str(i.get("column")),
                    "rowspan": str(i.get("rowspan")), "columnspan": str(i.get("columnspan")),
                    "sticky": "".join(sorted(str(i.get("sticky", ""))))}
        if m == "pack":
            i = w.pack_info()
            return {"m": "pack", "side": str(i.get("side")), "fill": str(i.get("fill")),
                    "expand": str(int(bool(int(i.get("expand", 0))))), "anchor": str(i.get("anchor"))}
        if m == "place":
            i = w.place_info()
            d = {"m": "place"}
            for k in ("x", "y", "relx", "rely", "width", "height",
                      "relwidth", "relheight", "anchor"):
                d[k] = str(i.get(k))
            return d
        return {"m": m or ""}
    except BaseException:
        return {}


def _tree_rows(w, parent="", depth=0):
    out = []
    try:
        children = w.get_children(parent)
    except BaseException:
        return out
    for iid in children:
        it = w.item(iid)
        out.append([depth, str(it.get("text", "")), [str(v) for v in (it.get("values") or [])]])
        out += _tree_rows(w, iid, depth + 1)
    return out


def _ser(w, depth=0):
    cls = _class_of(w)
    info = {
        "class": cls,
        "text": _text_of(w, cls),
        "state": _state_of(w),
        "value": _s(_value_of(w, cls)),
    }
    try:
        if cls in ("Checkbutton", "Radiobutton"):
            try:
                cur = w.getvar(str(w.cget("variable")))
                target = w.cget("onvalue") if cls == "Checkbutton" else w.cget("value")
                info["selected"] = str(cur) == str(target)
            except BaseException:
                info["selected"] = False
        elif cls in ("TCheckbutton", "TRadiobutton"):
            info["selected"] = bool(w.instate(["selected"]))
        if cls in ("TCombobox", "Spinbox", "TSpinbox"):
            vals = _cget(w, "values")
            if vals:
                info["values"] = list(w._ytk.splitlist(vals))
        if cls == "Listbox":
            info["curselection"] = list(w.curselection())
        if cls == "TNotebook":
            info["tabs"] = [str(w.tab(t, "text")) for t in w.tabs()]
            try:
                info["tab_selected"] = w.index("current")
            except BaseException:
                pass
        if cls == "Treeview":
            info["rows"] = _tree_rows(w)
            try:
                cols = list(w.cget("columns"))
                info["columns"] = [str(w.heading(c, "text")) for c in cols]
            except BaseException:
                pass
        if cls == "Menu":
            ents = []
            end = w.index("end")
            if isinstance(end, int):
                for i in range(end + 1):
                    t = w.type(i)
                    if t == "tearoff":
                        continue
                    ents.append("---" if t == "separator" else "%s:%s" % (t, w.entrycget(i, "label")))
            info["entries"] = ents
        if cls == "Canvas":
            items = []
            for i in w.find_all():
                t = w.type(i)
                items.append("%s:%s" % (t, w.itemcget(i, "text")) if t == "text" else t)
            info["items"] = sorted(items)
        if isinstance(w, (_ytk.Tk, _ytk.Toplevel)):
            info["title"] = w.title()
    except BaseException:
        pass
    for key in ("show", "orient", "from", "to"):
        v = _cget(w, key)
        if v not in (None, ""):
            info[key] = str(v)
    img = _cget(w, "image")
    if img:
        info["has_image"] = True
    info["style"] = _style_of(w)
    info["layout"] = _layout_of(w)
    kids = []
    try:
        for c in w.winfo_children():
            if "popdown" in str(c):
                continue
            kids.append(_ser(c, depth + 1))
    except BaseException as e:
        _W["errors"].append("ser children fail on %s: %s" % (_class_of(w), str(e)))
    info["children"] = kids
    return info


def _snap(root):
    try:
        if not root.winfo_exists():
            return {"closed": True}
        return _ser(root)
    except BaseException:
        return {"closed": True}


def _pump(root, n=3):
    for _ in range(n):
        try:
            root.update_idletasks()
            root.update()
        except BaseException:
            break


def _walk(w):
    stack = [w]
    while stack:
        cur = stack.pop()
        yield cur
        try:
            stack.extend(cur.winfo_children())
        except BaseException:
            pass


def _pos(w):
    try:
        return (w.winfo_rooty(), w.winfo_rootx())
    except BaseException:
        return (0, 0)


def _nth(root, pred, nth, what):
    found = sorted((w for w in _walk(root) if pred(w)), key=_pos)
    if len(found) < nth:
        raise RuntimeError(_MSG["not_found"] % (what, nth, len(found)))
    return found[nth - 1]


# ---------------------------------------------------------------- дії
def _do_action(root, act):
    kind = act["type"]
    arg = act.get("arg", "")
    nth = int(act.get("nth", 1))
    try:
        root.update_idletasks()
    except BaseException:
        pass

    def cls(w):
        try:
            return _class_of(w)
        except BaseException:
            return ""

    if kind == "click":
        def match(w, loose):
            if cls(w) == "Menu":
                return False
            t = _text_of(w, cls(w))
            if t is None:
                return False
            return t.strip().lower() == arg.strip().lower() if loose else t == arg
        for loose in (False, True):
            for need_invoke in (True, False):
                found = sorted((w for w in _walk(root)
                                if match(w, loose) and hasattr(w, "invoke") == need_invoke), key=_pos)
                if len(found) >= nth:
                    w = found[nth - 1]
                    if _state_of(w) == "disabled":
                        return
                    if hasattr(w, "invoke"):
                        w.invoke()
                    else:
                        w.event_generate("<Button-1>", x=2, y=2)
                        w.event_generate("<ButtonRelease-1>", x=2, y=2)
                    return
        raise RuntimeError(_MSG["no_widget_text"] % (arg, nth))

    if kind in ("type", "append"):
        w = _nth(root, lambda x: cls(x) in TYPE_CLASSES, nth, _MSG["entry"])
        if _state_of(w) in ("disabled", "readonly"):
            return
        if cls(w) == "Text":
            if kind == "type":
                w.delete("1.0", "end")
            w.insert("end", arg)
        else:
            if kind == "type":
                w.delete(0, "end")
            w.insert("end", arg)
        try:
            w.focus_force()
            w.event_generate("<KeyRelease>")
        except BaseException:
            pass
        return

    if kind == "select":
        w = _nth(root, lambda x: cls(x) == "Listbox", nth, "Listbox")
        idx = int(arg or 0)
        w.selection_clear(0, "end")
        w.selection_set(idx)
        w.activate(idx)
        w.event_generate("<<ListboxSelect>>")
        return

    if kind == "combo":
        w = _nth(root, lambda x: cls(x) == "TCombobox", nth, "Combobox")
        if arg.lstrip("-").isdigit():
            w.current(int(arg))
        else:
            w.set(arg)
        w.event_generate("<<ComboboxSelected>>")
        return

    if kind == "scale":
        w = _nth(root, lambda x: cls(x) in ("Scale", "TScale"), nth, "Scale")
        w.set(float(arg))
        return

    if kind == "key":
        w = _nth(root, lambda x: cls(x) in TYPE_CLASSES, nth, _MSG["entry"])
        try:
            w.focus_force()
        except BaseException:
            pass
        w.event_generate("<KeyPress>", keysym=arg)
        w.event_generate("<KeyRelease>", keysym=arg)
        return

    if kind == "menu":
        menu = root.nametowidget(str(root.cget("menu")))
        parts = [p.strip() for p in arg.split("/") if p.strip()]
        for k, part in enumerate(parts):
            end = menu.index("end")
            idx = None
            for i in range(end + 1 if isinstance(end, int) else 0):
                if menu.type(i) in ("separator", "tearoff"):
                    continue
                if str(menu.entrycget(i, "label")).strip().lower() == part.lower():
                    idx = i
                    break
            if idx is None:
                raise RuntimeError(_MSG["no_menu_item"] % (part,))
            if k == len(parts) - 1:
                menu.invoke(idx)
            else:
                menu = menu.nametowidget(str(menu.entrycget(idx, "menu")))
        return

    if kind == "wait":
        # У браузері «чекати» нічого — просто оновлюємо чергу подій.
        _pump(root, 1)
        return

    raise RuntimeError(_MSG["unknown_action"] % (kind,))


def _session(root):
    steps = []

    def take(label, action_error=None):
        try:
            _pump(root)
        except BaseException as e:
            _W["errors"].append("pump: " + str(e))
        try:
            tree = _snap(root)
        except BaseException as e:
            tree = {"closed": True}
            _W["errors"].append("snap: " + str(e))
        try:
            dialogs = list(_W["dialogs"])
        except BaseException as e:
            dialogs = []
            _W["errors"].append("dialogs: " + str(e))
        try:
            errors = list(_W["errors"])
        except BaseException as e:
            errors = []
        try:
            stdout = _W["stdout"].getvalue()
        except BaseException as e:
            stdout = ""
            _W["errors"].append("stdout: " + str(e))
        steps.append({
            "label": label,
            "tree": tree,
            "dialogs": dialogs,
            "errors": errors,
            "stdout": stdout,
            "action_error": action_error,
        })
        try:
            _W["dialogs"] = []
            _W["errors"] = []
            _W["stdout"].truncate(0)
        except BaseException as e:
            pass

    take(_LBL_INITIAL)
    for i, act in enumerate(_ACTIONS, 1):
        err = None
        try:
            _do_action(root, act)
        except BaseException as e:
            err = str(e)
        take("%d. %s" % (i, act.get("raw", act["type"])), err)
    return steps


def _install_patches():
    _W["dialogs"] = []
    _W["errors"] = []

    def mk(kind, ret):
        def f(title=None, message=None, *a, **k):
            _W["dialogs"].append({"kind": kind, "title": str(title or ""),
                                  "message": str(message if message is not None else "")})
            return ret
        return f

    for name, ret in {"showinfo": "ok", "showwarning": "ok", "showerror": "ok",
                      "askquestion": "yes", "askokcancel": True, "askyesno": True,
                      "askyesnocancel": True, "askretrycancel": True}.items():
        try:
            setattr(_ymb, name, mk(name, ret))
        except BaseException:
            pass
    for name in ("askstring", "askinteger", "askfloat"):
        try:
            setattr(_ysd, name, mk(name, None))
        except BaseException:
            pass
    for name, ret in {"askopenfilename": "", "asksaveasfilename": "", "askdirectory": "",
                      "askopenfilenames": (), "askopenfile": None, "asksaveasfile": None}.items():
        try:
            setattr(_yfd, name, mk(name, ret))
        except BaseException:
            pass

    def rce(self, exc, val, tb):
        _W["errors"].append("%s: %s" % (getattr(exc, "__name__", str(exc)), str(val)))

    try:
        _ytk.Misc.report_callback_exception = rce
    except BaseException:
        pass
    try:
        _ytk.Tk.report_callback_exception = rce
    except BaseException:
        pass

    for klass in (_ytk.Tk, _ytk.Toplevel):
        try:
            orig = klass.__init__

            def make(orig):
                def init(self, *a, **k):
                    orig(self, *a, **k)
                    try:
                        self.geometry("+10000+10000")
                    except BaseException:
                        pass
                return init
            klass.__init__ = make(orig)
        except BaseException:
            pass

    def nowait(self, *a, **k):
        _pump(self._root(), 2)

    for meth in ("wait_window", "wait_variable", "wait_visibility"):
        try:
            setattr(_ytk.Misc, meth, nowait)
        except BaseException:
            pass

    try:
        _orig_grab = _ytk.Misc.grab_set

        def safe_grab(self):
            try:
                _orig_grab(self)
            except BaseException:
                pass
        _ytk.Misc.grab_set = safe_grab
    except BaseException:
        pass


def _run(root):
    try:
        _W["steps"] = _session(root)
    finally:
        _W["done"] = True


def _fake_misc_mainloop(self, n=0):
    _run(self._root())


def _fake_mainloop(n=0):
    root = getattr(_ytk, "_default_root", None)
    if root is None:
        _W["error"] = _MSG["mainloop_no_window"]
        _W["done"] = True
    else:
        _run(root)


def _fallback():
    """Запускає сеанс, якщо код учня/еталона не викликав mainloop()."""
    if _W.get("done"):
        return
    root = getattr(_ytk, "_default_root", None)
    g = globals()
    if root is None:
        for fn in ("create_app", "create_window", "build_ui", "create_gui",
                   "setup", "main", "run", "start"):
            f = g.get(fn)
            if callable(f):
                try:
                    res = f()
                    if isinstance(res, (_ytk.Tk, _ytk.Toplevel)):
                        root = res
                        break
                except BaseException:
                    pass
                root = getattr(_ytk, "_default_root", None)
                if root is not None:
                    break
    if root is None:
        for obj in list(g.values()):
            if isinstance(obj, (_ytk.Tk, _ytk.Toplevel)):
                root = obj
                break
    if root is None:
        _W["error"] = _MSG["no_tk_window"]
        _W["done"] = True
        return
    _run(root)


_install_patches()

_ytk.Misc.mainloop = _fake_misc_mainloop
_ytk.mainloop = _fake_mainloop
`;
  // ---------- GUI-обв'язка (кеш) ----------
  var _preludeCache = null;
  async function getPrelude() {
    if (_preludeCache) return _preludeCache;
    _preludeCache = GUI_PRELUDE;
    return _preludeCache;
  }

  // ---------- EOFError ----------
  // У стандартному Skulpt класу EOFError немає: тоді input() без даних тихо повертав "",
  // і ні «неповні тести», ні генерація тестів у teacher_app (вона шукає EOFError) не працювали.
  // На сторінці teacher_app Skulpt ще ніхто не налаштував (немає Sk.read) — налаштовуємо як IDE.
  function prepareSk() {
    if (!Sk.read && window.PythonIDE && typeof PythonIDE.configSkulpt === "function") {
      try { PythonIDE.configSkulpt("normal", false); } catch (e) { /* ignore */ }
    }
  }
  var _eofCls = null;
  async function ensureEOF() {
    if (Sk.builtins.EOFError) { _eofCls = Sk.builtins.EOFError; return; }
    if (_eofCls) { Sk.builtins.EOFError = _eofCls; return; }
    for (var attempt = 0; attempt < 2 && !_eofCls; attempt++) {
      try {
        // перша спроба може не вдатися на ще не налаштованому Skulpt — налаштовуємо й повторюємо
        if (attempt) Sk.configure({ killableWhile: true });
        var m = await Sk.misceval.asyncToPromise(function () {
          return Sk.importModuleInternal_("yep_eof", false, "yep_eof", "class EOFError(Exception):\n    pass\n", undefined, false, true);
        });
        _eofCls = m.$d.EOFError;
        Sk.builtins.EOFError = _eofCls;
      } catch (e) {
        if (window.console && console.debug) console.debug("ensureEOF attempt " + attempt + " failed:", e && (e.message || String(e)));
      }
    }
  }
  function eofError(msg) {
    var cls = Sk.builtins.EOFError;
    if (!cls) return new Sk.builtin.Exception(msg);
    var call = Sk.misceval.callsimArray || function (f, a) { return Sk.misceval.callsim.apply(null, [f].concat(a)); };
    return call(cls, [new Sk.builtin.str(msg)]);
  }

  // ---------- виконання коду ----------

  function seedPrefix(runtime) {
    var parts = [];
    if (runtime && runtime.random_seed != null && runtime.random_seed !== "") {
      parts.push("try:\n    import random\n    random.seed(" + parseInt(runtime.random_seed, 10) + ")\nexcept Exception:\n    pass");
    }
    return parts.join("\n") + (parts.length ? "\n" : "");
  }

  async function runConsoleProgram(source, name, stdinText, timeout, promptsInStdout, guiSafe, files, runtime) {
    var $compiledmod;
    prepareSk();
    await ensureEOF();
    var saved = saveSk();
    var out = [];
    var prompts = [];
    var exitCode = 0;
    var exception = null;
    try {
      if (guiSafe && window.TkEngine && typeof window.TkEngine.destroyAllWindows === "function") {
        try { window.TkEngine.destroyAllWindows(); } catch (e) {}
      }
      Sk.configure({ killableWhile: true });
      Sk.execLimit = Math.max(1000, (timeout || 20) * 1000);
      Sk.execStart = Date.now();
      Sk.dateSet = true;

      // підготовка stdin
      var raw = stdinText || "";
      var all = raw.split("\n");
      if (raw.endsWith("\n") && all.length > 0) all.pop();
      var queue = raw === "" ? [] : all.slice();

      function inputfun(prompt) {
        var p = (prompt === undefined || prompt === null) ? "" : String(prompt);
        prompts.push(p);
        if (promptsInStdout) out.push(p);
        if (!queue.length) throw eofError("EOF when reading a line");
        return queue.shift();
      }

      var codeToRun = source;
      if (guiSafe) {
        codeToRun = "try:\n    import tkinter as _tk\n    _tk.Misc.mainloop = lambda self, n=0: None\n    _tk.mainloop = lambda n=0: None\nexcept Exception:\n    pass\n" + codeToRun;
      }
      codeToRun = "try:\n    import sys\n    sys.stdout = open('/dev/stdout', 'w')\n    sys.stderr = open('/dev/stderr', 'w')\nexcept Exception:\n    pass\n" + seedPrefix(runtime) + codeToRun;

      Sk.configure({
        output: function (t) { out.push(t); },
        inputfun: inputfun,
        inputfunTakesPrompt: true,
        read: Sk.read,
        killableWhile: true
      });
      Sk.inputfun = inputfun;
      Sk.inputfunTakesPrompt = true;

      var scope = { __name__: "__main__", __file__: name || "program.py" };
      try {
        await drive(eval(Sk.compile(codeToRun, name || "program.py", "exec", true).code)(scope));
      } catch (e) {
        if (isSystemExit(e)) {
          exitCode = exitCodeFrom(e);
        } else {
          exception = skExcInfo(e);
          exitCode = 1;
        }
      }
    } catch (e) {
      exception = skExcInfo(e);
      exitCode = 1;
    } finally {
      restoreSk(saved);
      if (guiSafe && window.TkEngine && typeof window.TkEngine.destroyAllWindows === "function") {
        try { window.TkEngine.destroyAllWindows(); } catch (e) {}
      }
    }
    return { stdout: out.join(""), stderr: "", exit_code: exitCode, exception: exception, prompts: prompts };
  }

  function typeOf(v) {
    try { return Sk.abstr.typeName(v); } catch (e) { return (v && v.tp$name) || (v && v.constructor && v.constructor.name) || "object"; }
  }
  function reprOf(v) {
    try { return Sk.ffi.remapToJs(Sk.builtin.repr(v)); } catch (e) { try { return String(v); } catch (x) { return "<repr failed>"; } }
  }

  function splitStatements(s) {
    var parts = [], cur = "", depth = 0, i = 0;
    while (i < s.length) {
      var c = s.charAt(i);
      if (c === "#") break;
      if (c === '"' || c === "'") {
        var Q = s.substr(i, 3) === c + c + c ? c + c + c : c;
        cur += Q; i += Q.length;
        while (i < s.length) {
          if (s.charAt(i) === "\\") { cur += s.substr(i, 2); i += 2; continue; }
          if (s.substr(i, Q.length) === Q) { cur += Q; i += Q.length; break; }
          cur += s.charAt(i++);
        }
        continue;
      }
      if ("([{".indexOf(c) >= 0) depth++;
      else if (")]}".indexOf(c) >= 0) depth--;
      if (c === ";" && depth === 0) { parts.push(cur.trim()); cur = ""; i++; continue; }
      cur += c; i++;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.filter(function (p) { return p; });
  }

  async function runFunctionProgram(source, name, exprs, timeout, caseTimeout, files, runtime) {
    var $compiledmod;
    prepareSk();
    await ensureEOF();
    var saved = saveSk();
    var moduleOut = [];
    var loadError = null;
    var ns = { __name__: "student_module", __file__: name || "module.py" };
    try {
      Sk.configure({ killableWhile: true });
      Sk.execLimit = Math.max(1000, (timeout || 20) * 1000);
      Sk.execStart = Date.now();
      Sk.dateSet = true;

      var codeToRun = "try:\n    import sys\n    sys.stdout = open('/dev/stdout', 'w')\n    sys.stderr = open('/dev/stderr', 'w')\nexcept Exception:\n    pass\n" + seedPrefix(runtime) + source;
      Sk.configure({
        output: function (t) { moduleOut.push(t); },
        inputfun: function () { throw eofError(tr("chk_input_unavailable", "input() недоступний у режимі перевірки функцій")); },
        inputfunTakesPrompt: true,
        read: Sk.read,
        killableWhile: true
      });
      try {
        await drive(eval(Sk.compile(codeToRun, name || "module.py", "exec", true).code)(ns));
      } catch (e) {
        if (isSystemExit(e)) { /* ignore */ }
        else { loadError = skExcInfo(e); }
      }
    } catch (e) {
      loadError = skExcInfo(e);
    }
    var moduleStdout = moduleOut.join("");

    var cases = [];
    var ct = caseTimeout || 3;
    for (var ei = 0; ei < (exprs || []).length; ei++) {
      var expr = exprs[ei];
      var buf = [];
      var savedOut2 = Sk.output;
      Sk.configure({ output: function (t) { buf.push(t); } });
      var local = {};
      for (var k in ns) local[k] = ns[k];
      var res = { expr: expr, repr: null, type: null, stdout: "", exception: null };
      Sk.execLimit = Math.max(1000, ct * 1000);
      Sk.execStart = Date.now();
      try {
        var parts = splitStatements(String(expr));
        for (var pi = 0; pi < parts.length - 1; pi++) {
          var p = parts[pi];
          await drive(eval(Sk.compile(p, tr("chk_call_file", "<виклик>"), "exec", true).code)(local));
        }
        var last = (parts[parts.length - 1] || "").trim();
        if (last) {
          // try to capture the value of the last expression
          var wrapped = "__func_result__ = (" + last + ")";
          var c2 = null;
          try { c2 = Sk.compile(wrapped, tr("chk_call_file", "<виклик>"), "exec", true); } catch (e) { c2 = null; }
          if (c2) {
            delete local.__func_result__;
            await drive(eval(c2.code)(local));
            if (Object.prototype.hasOwnProperty.call(local, "__func_result__")) {
              res.repr = reprOf(local.__func_result__);
              res.type = typeOf(local.__func_result__);
            }
          } else {
            await drive(eval(Sk.compile(last, tr("chk_call_file", "<виклик>"), "exec", true).code)(local));
            res.repr = null;
            res.type = null;
          }
        }
      } catch (e) {
        if (isSystemExit(e)) {
          res.exception = { type: "SystemExit", message: "" };
        } else {
          res.exception = skExcInfo(e);
        }
      } finally {
        Sk.configure({ output: savedOut2 });
      }
      res.stdout = buf.join("");
      cases.push(res);
    }
    restoreSk(saved);
    return { load_error: loadError, cases: cases, stdout: moduleStdout.slice(0, 2000) };
  }

  async function runGuiProgram(source, name, actions, timeout, files, runtime) {
    var $compiledmod;
    prepareSk();
    var saved = saveSk();
    var scope = { __name__: "__main__", __file__: name || "program.py" };
    try {
      if (window.TkEngine && typeof window.TkEngine.destroyAllWindows === "function") {
        try { window.TkEngine.destroyAllWindows(); } catch (e) {}
      }
      Sk.configure({ killableWhile: true });
      Sk.execLimit = Math.max(1000, (timeout || 20) * 1000);
      Sk.execStart = Date.now();
      Sk.dateSet = true;

      var prelude = await getPrelude();
      Sk.configure({
        output: function (t) { /* captured by prelude's _Cap via sys.stdout */ },
        inputfun: function () { return ""; },
        inputfunTakesPrompt: true,
        read: Sk.read,
        killableWhile: true
      });
      // prelude expects _ACTIONS in scope (Python list, not JS array)
      try { scope._ACTIONS = Sk.ffi.remapToPy(actions || []); }
      catch (e) { scope._ACTIONS = actions || []; }
      // localized label for the initial-state step (prelude reads _LBL_INITIAL)
      try { scope._LBL_INITIAL = Sk.ffi.remapToPy(tr("chk_initial_state", "Початковий стан")); }
      catch (e) { scope._LBL_INITIAL = tr("chk_initial_state", "Початковий стан"); }
      // localized prelude messages (prelude reads _MSG)
      try {
        scope._MSG = Sk.ffi.remapToPy({
          entry: tr("chk_msg_entry", "поле введення"),
          not_found: tr("chk_msg_not_found", "не знайдено %s (№%d, всього знайдено %d)"),
          no_widget_text: tr("chk_msg_no_widget_text", "не знайдено віджет з текстом %r (№%d)"),
          no_menu_item: tr("chk_msg_no_menu_item", "немає пункту меню %r"),
          unknown_action: tr("chk_msg_unknown_action", "невідома дія %r"),
          mainloop_no_window: tr("chk_msg_mainloop_no_window", "mainloop() викликано без створеного вікна"),
          no_tk_window: tr("chk_msg_no_tk_window", "Не знайдено вікно tkinter (ні mainloop, ні root, ні create_app()).")
        });
      } catch (e) {}
      // run prelude
      var preludeFn = eval(Sk.compile(prelude, "checker_prelude.py", "exec", true).code);
      await drive(preludeFn(scope));
      // seed
      var codeToRun = seedPrefix(runtime) + source;
      await drive(eval(Sk.compile(codeToRun, name || "program.py", "exec", true).code)(scope));
      // fallback
      if (typeof scope._fallback === "function") {
        await drive(eval(Sk.compile("_fallback()", "fb.py", "exec", true).code)(scope));
      }
      var W = Sk.ffi.remapToJs(scope._W);
      return { steps: W.steps || [], error: W.error || null, done: !!W.done };
    } catch (e) {
      return { steps: [], error: String(e && e.stack || e), done: true };
    } finally {
      restoreSk(saved);
      if (window.TkEngine && typeof window.TkEngine.destroyAllWindows === "function") {
        try { window.TkEngine.destroyAllWindows(); } catch (e) {}
      }
    }
  }

  // ---------- парсери ----------
  function _weightOf(name) {
    var m = String(name).match(/\[x(\d+)\]\s*$/i);
    return m ? Math.max(1, parseInt(m[1], 10)) : 1;
  }

  function parseConsoleCases(text) {
    var cases = [];
    var cur = null;
    (text || "").split("\n").forEach(function (line) {
      if (line.indexOf("===") === 0) {
        if (cur) cases.push(cur);
        cur = { name: line.replace(/^=+/, "").trim() || (tr("chk_test_word", "Тест ") + (cases.length + 1)), lines: [] };
        return;
      }
      var stripped = line.trim();
      if (!stripped || stripped.charAt(0) === "#") return;
      if (!cur) cur = { name: tr("chk_test_word", "Тест ") + "1", lines: [] };
      // decode
      var s = line.replace(/\r$/, "");
      var low = s.trim().toLowerCase();
      if (low === "<порожньо>" || low === "<empty>") s = "";
      if (s.length > 1 && s.charAt(0) === "\\" && "#<=\\".indexOf(s.charAt(1)) >= 0) s = s.slice(1);
      cur.lines.push(s);
    });
    if (cur) cases.push(cur);
    var out = cases.map(function (c) {
      var lines = c.lines;
      return { name: c.name, lines: lines, stdin: lines.length ? (lines.join("\n") + "\n") : "" };
    });
    if (!out.length) out = [{ name: tr("chk_no_input_data", "Без вхідних даних"), lines: [], stdin: "" }];
    return out;
  }

  function parseFunctionCases(text) {
    var out = [];
    (text || "").split("\n").forEach(function (line) {
      var t = line.trim();
      if (!t || t.charAt(0) === "#") return;
      var w = 1;
      var m = t.match(/^\[x(\d+)\]\s*(.+)$/i);
      if (m) { w = Math.max(1, parseInt(m[1], 10)); t = m[2].trim(); }
      out.push({ expr: t, weight: w });
    });
    return out;
  }

  var _REQ_VERBS = { require: "require", "вимагати": "require", forbid: "forbid", "заборонити": "forbid" };
  var _REQ_NOARG = { for: 1, while: 1, if: 1, try: 1, with: 1, lambda: 1, comprehension: 1, global: 1 };
  var _REQ_OPTARG = { def: 1, class: 1, recursion: 1 };
  var _REQ_ARG = { import: 1, call: 1 };

  function parseRequirements(text) {
    var rules = [];
    var errors = [];
    (text || "").split("\n").forEach(function (line, idx) {
      var t = line.split("#", 1)[0].trim();
      if (!t) return;
      var parts = t.split(/\s+/);
      var verb = _REQ_VERBS[(parts[0] || "").toLowerCase()];
      var kind = (parts[1] || "").toLowerCase();
      kind = (kind === "comp") ? "comprehension" : kind;
      var arg = parts[2] || "";
      var ln = idx + 1;
      if (!verb) errors.push(tr("chk_line", "рядок ") + ln + tr("chk_req_expected_verb", ": очікується require/forbid (вимагати/заборонити), а не «") + parts[0] + "»");
      else if (!(_REQ_NOARG[kind] || _REQ_OPTARG[kind] || _REQ_ARG[kind])) errors.push(tr("chk_line", "рядок ") + ln + tr("chk_req_unknown_kind", ": невідомий вид «") + kind + "»");
      else if (_REQ_ARG[kind] && !arg) errors.push(tr("chk_line", "рядок ") + ln + tr("chk_req_for", ": для «") + kind + tr("chk_req_name_needed", "» потрібна назва"));
      else rules.push({ verb: verb, kind: kind, arg: arg });
    });
    return { rules: rules, errors: errors };
  }

  function parseActions(text) {
    var actions = [];
    (text || "").split("\n").forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === "#") return;
      var m = line.match(/^(\w+)(?:\[(\d+)\])?(?:\s+(.*))?$/);
      if (!m) return;
      var arg = (m[3] || "").trim();
      if (arg.length >= 2 && arg.charAt(0) === arg.charAt(arg.length - 1) && "\"'".indexOf(arg.charAt(0)) >= 0) arg = arg.slice(1, -1);
      actions.push({ type: m[1].toLowerCase(), nth: parseInt(m[2] || "1", 10), arg: arg, raw: line });
    });
    return actions;
  }

  function detectMode(source) {
    return /\b[Tt]kinter\b/.test(source || "") ? "gui" : "console";
  }

  // ---------- SequenceMatcher (difflib) ----------
  function findLongestMatch(a, b, alo, ahi, blo, bhi) {
    var besti = alo, bestj = blo, bestsize = 0;
    var j2len = {};
    for (var i = alo; i < ahi; i++) {
      var newj2len = {};
      for (var j = blo; j < bhi; j++) {
        if (a[i] === b[j]) {
          var k = (j2len[j - 1] || 0) + 1;
          newj2len[j] = k;
          if (k > bestsize) { bestsize = k; besti = i - k + 1; bestj = j - k + 1; }
        }
      }
      j2len = newj2len;
    }
    return { i: besti, j: bestj, size: bestsize };
  }
  function getOpcodes(a, b) {
    var opcodes = [];
    function recurse(alo, ahi, blo, bhi) {
      var x = findLongestMatch(a, b, alo, ahi, blo, bhi);
      if (x.size === 0) {
        if (alo < ahi && blo < bhi) opcodes.push(["replace", alo, ahi, blo, bhi]);
        else if (alo < ahi) opcodes.push(["delete", alo, ahi, blo, blo]);
        else if (blo < bhi) opcodes.push(["insert", alo, alo, blo, bhi]);
        return;
      }
      var k = x.i, l = x.j, size = x.size;
      if (alo < k || blo < l) recurse(alo, k, blo, l);
      if (size > 0) opcodes.push(["equal", k, k + size, l, l + size]);
      if (k + size < ahi || l + size < bhi) recurse(k + size, ahi, l + size, bhi);
    }
    recurse(0, a.length, 0, b.length);
    // merge adjacent same-tag
    var merged = [];
    opcodes.forEach(function (op) {
      if (merged.length && merged[merged.length - 1][0] === op[0] &&
          merged[merged.length - 1][2] === op[1] && merged[merged.length - 1][4] === op[3]) {
        var last = merged[merged.length - 1];
        last[2] = op[2];
        last[4] = op[4];
      } else {
        merged.push([op[0], op[1], op[2], op[3], op[4]]);
      }
    });
    return merged;
  }

  // ---------- console comparison ----------
  function _consoleLines(text, opts) {
    opts = opts || {};
    var lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (opts.console_ignore_ws !== false) {
      var out = [];
      lines.forEach(function (l) { if (l.trim()) out.push(l.trim().replace(/\s+/g, " ")); });
      lines = out;
    } else {
      lines = lines.map(function (l) { return l.replace(/\s+$/g, ""); });
      while (lines.length && !lines[lines.length - 1]) lines.pop();
    }
    if (opts.console_ignore_case) lines = lines.map(function (l) { return l.toLowerCase(); });
    return lines;
  }

  function _canonToken(tok, nd) {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(tok)) return tok;
    var x = parseFloat(tok);
    if (!isFinite(x)) return tok;
    var s = x.toFixed(nd);
    s = s.replace(/0+$/, "").replace(/\.$/, "");
    if (s === "-0" || s === "") s = "0";
    return s;
  }

  function compareOutput(a, b, opts, maxShow) {
    opts = opts || {};
    maxShow = maxShow || 8;
    var la = _consoleLines(a, opts);
    var lb = _consoleLines(b, opts);
    var tol = parseFloat(opts.console_float_tol || 0);
    var ca = la, cb = lb;
    if (tol > 0) {
      var nd = Math.max(0, Math.round(-Math.log10(tol)));
      ca = la.map(function (l) { return l.split(/\s+/).map(function (t) { return _canonToken(t, nd); }).join(" "); });
      cb = lb.map(function (l) { return l.split(/\s+/).map(function (t) { return _canonToken(t, nd); }).join(" "); });
    }
    var diffs = [];
    var ops = getOpcodes(ca, cb);
    ops.forEach(function (op) {
      if (op[0] === "equal") return;
      var i1 = op[1], i2 = op[2], j1 = op[3], j2 = op[4];
      var n = Math.max(i2 - i1, j2 - j1);
      for (var k = 0; k < n; k++) {
        var i = i1 + k, j = j1 + k;
        var sa = (i < i2) ? la[i] : null;
        var sb = (j < j2) ? lb[j] : null;
        if (sa !== null && sb !== null) diffs.push(tr("chk_line", "рядок ") + (i + 1) + ": " + tr("chk_sample", "зразок=") + JSON.stringify(sa) + ", " + tr("chk_student", "учень=") + JSON.stringify(sb));
        else if (sa !== null) diffs.push(tr("chk_line", "рядок ") + (i + 1) + ": " + tr("chk_missing_in_student", "у учня відсутній ") + JSON.stringify(sa));
        else diffs.push(tr("chk_line", "рядок ") + (j + 1) + " " + tr("chk_student_word", "учня: зайвий ") + JSON.stringify(sb));
      }
    });
    if (diffs.length > maxShow) {
      var extra = diffs.length - maxShow;
      diffs = diffs.slice(0, maxShow).concat([tr("chk_more_plain", "… ще ") + extra + tr("chk_output_diffs", " відмінностей виводу")]);
    }
    return diffs;
  }

  // ---------- tagged literal eval ----------
  function literalEval(src) {
    // returns {ok: bool, value: tagged}
    src = String(src || "").trim();
    if (!src) return { ok: false, value: null };
    try {
      // use a recursive descent parser
      var p = { s: src, i: 0 };
      function skipWs() { while (p.i < p.s.length && /\s/.test(p.s.charAt(p.i))) p.i++; }
      function parse() {
        skipWs();
        var v = parseValue();
        skipWs();
        if (p.i !== p.s.length) throw new Error("trailing");
        return v;
      }
      function parseValue() {
        skipWs();
        if (p.i >= p.s.length) throw new Error("unexpected end");
        var c = p.s.charAt(p.i);
        if (c === "[" ) return parseList();
        if (c === "(" ) return parseTuple();
        if (c === "{" ) return parseDict();
        if (c === "'" || c === '"') return parseStr();
        // bool / None
        if (p.s.substr(p.i, 4) === "True") { p.i += 4; return { t: "bool", v: true }; }
        if (p.s.substr(p.i, 5) === "False") { p.i += 5; return { t: "bool", v: false }; }
        if (p.s.substr(p.i, 4) === "None") { p.i += 4; return { t: "none" }; }
        // number
        var m = p.s.slice(p.i).match(/^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/);
        if (m) {
          p.i += m[0].length;
          var num = parseFloat(m[0]);
          var isInt = m[0].indexOf(".") < 0 && m[0].indexOf("e") < 0 && m[0].indexOf("E") < 0;
          return { t: "num", v: num, int: isInt };
        }
        throw new Error("unexpected char " + c);
      }
      function parseStr() {
        var quote = p.s.charAt(p.i);
        p.i++;
        var out = "";
        while (p.i < p.s.length && p.s.charAt(p.i) !== quote) {
          if (p.s.charAt(p.i) === "\\") {
            p.i++;
            var e = p.s.charAt(p.i);
            var map = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"', "0": "\0" };
            out += (map[e] !== undefined) ? map[e] : e;
            p.i++;
          } else {
            out += p.s.charAt(p.i);
            p.i++;
          }
        }
        if (p.i >= p.s.length) throw new Error("unterminated string");
        p.i++; // closing quote
        return { t: "str", v: out };
      }
      function parseList() {
        p.i++; // [
        skipWs();
        var items = [];
        if (p.s.charAt(p.i) === "]") { p.i++; return { t: "list", v: items }; }
        while (true) {
          items.push(parseValue());
          skipWs();
          if (p.s.charAt(p.i) === ",") { p.i++; skipWs(); if (p.s.charAt(p.i) === "]") { p.i++; break; } continue; }
          if (p.s.charAt(p.i) === "]") { p.i++; break; }
          throw new Error("expected , or ]");
        }
        return { t: "list", v: items };
      }
      function parseTuple() {
        p.i++; // (
        skipWs();
        var items = [];
        if (p.s.charAt(p.i) === ")") { p.i++; return { t: "tuple", v: items }; }
        while (true) {
          items.push(parseValue());
          skipWs();
          if (p.s.charAt(p.i) === ",") { p.i++; skipWs(); if (p.s.charAt(p.i) === ")") { p.i++; break; } continue; }
          if (p.s.charAt(p.i) === ")") { p.i++; break; }
          throw new Error("expected , or )");
        }
        return { t: "tuple", v: items };
      }
      function parseDict() {
        p.i++; // {
        skipWs();
        var pairs = [];
        if (p.s.charAt(p.i) === "}") { p.i++; return { t: "dict", v: pairs }; }
        while (true) {
          var key = parseValue();
          skipWs();
          if (p.s.charAt(p.i) !== ":") throw new Error("expected :");
          p.i++;
          var val = parseValue();
          pairs.push([key, val]);
          skipWs();
          if (p.s.charAt(p.i) === ",") { p.i++; skipWs(); if (p.s.charAt(p.i) === "}") { p.i++; break; } continue; }
          if (p.s.charAt(p.i) === "}") { p.i++; break; }
          throw new Error("expected , or }");
        }
        return { t: "dict", v: pairs };
      }
      var value = parse();
      return { ok: true, value: value };
    } catch (e) {
      return { ok: false, value: null };
    }
  }

  function valuesEqual(a, b, tol) {
    if (!a || !b) {
      // handle null/undefined (none)
      if (a === b) return true;
      if (a && a.t === "none" && b && b.t === "none") return true;
      return false;
    }
    if (a.t === "bool" || b.t === "bool") {
      return a.t === "bool" && b.t === "bool" && a.v === b.v;
    }
    if (a.t === "num" && b.t === "num") {
      if (a.v === b.v) return true;
      if (isNaN(a.v) && isNaN(b.v)) return true;
      if (tol > 0) {
        var d = Math.abs(a.v - b.v);
        return d <= tol || d <= tol * Math.max(Math.abs(a.v), Math.abs(b.v));
      }
      return false;
    }
    if (a.t === "str" && b.t === "str") return a.v === b.v;
    if (a.t === "none" && b.t === "none") return true;
    if (a.t === "list" && b.t === "list") {
      if (a.v.length !== b.v.length) return false;
      for (var i = 0; i < a.v.length; i++) if (!valuesEqual(a.v[i], b.v[i], tol)) return false;
      return true;
    }
    if (a.t === "tuple" && b.t === "tuple") {
      if (a.v.length !== b.v.length) return false;
      for (var i = 0; i < a.v.length; i++) if (!valuesEqual(a.v[i], b.v[i], tol)) return false;
      return true;
    }
    if (a.t === "dict" && b.t === "dict") {
      if (a.v.length !== b.v.length) return false;
      // keys
      var ka = a.v.map(function (p) { return JSON.stringify(p[0]); }).sort();
      var kb = b.v.map(function (p) { return JSON.stringify(p[0]); }).sort();
      if (ka.join("|") !== kb.join("|")) return false;
      for (var i = 0; i < a.v.length; i++) {
        // find matching key in b
        var found = false;
        for (var j = 0; j < b.v.length; j++) {
          if (JSON.stringify(a.v[i][0]) === JSON.stringify(b.v[j][0])) {
            if (!valuesEqual(a.v[i][1], b.v[j][1], tol)) return false;
            found = true; break;
          }
        }
        if (!found) return false;
      }
      return true;
    }
    return false;
  }

  // ---------- AST-based requirements ----------
  function codeFacts(source) {
    var facts = { defs: new Set(), classes: new Set(), imports: new Set(), calls: new Set(), recursive: new Set(), counts: {} };
    var mod;
    try {
      var parsed = Sk.parse("req.py", source);
      mod = Sk.astFromParse(parsed.cst, "req.py", parsed.flags);
    } catch (e) { return null; }
    var A = Sk.astnodes || {};
    // _astname надійний і в мінімізованій збірці Skulpt (constructor.name там спотворюється)
    function kind(n) {
      if (!n || typeof n !== "object") return undefined;
      if (typeof n._astname === "string") return n._astname;
      var cn = n.constructor && n.constructor.name;
      return (cn && Object.prototype.hasOwnProperty.call(A, cn)) ? cn : undefined;
    }
    function nm(v) { try { return Sk.ffi.remapToJs(v); } catch (e) { return String(v); } }
    function walk(node, cb) {
      var stack = [node], seen = new Set();
      while (stack.length) {
        var n = stack.pop();
        if (!n || typeof n !== "object" || seen.has(n)) continue;
        seen.add(n);
        if (kind(n)) cb(n);
        for (var k in n) {
          if (k.charAt(0) === "$" || k.charAt(0) === "_" || k === "parent" || k === "lineno" || k === "col_offset" || k === "end_lineno" || k === "end_col_offset") continue;
          var v = n[k];
          if (kind(v)) stack.push(v);
          else if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) if (kind(v[i])) stack.push(v[i]); }
        }
      }
    }
    function dotted(f) {
      var parts = [], cur = f;
      while (cur && kind(cur) === "Attribute") { parts.unshift(nm(cur.attr)); cur = cur.value; }
      if (cur && kind(cur) === "Name") { parts.unshift(nm(cur.id)); return parts.join("."); }
      return null;
    }
    function bump(k) { facts.counts[k] = (facts.counts[k] || 0) + 1; }
    walk(mod, function (n) {
      var t = kind(n);
      if (t === "FunctionDef" || t === "AsyncFunctionDef") {
        var name = nm(n.name);
        facts.defs.add(name);
        walk(n, function (sub) {
          if (kind(sub) === "Call" && sub.func && kind(sub.func) === "Name" && nm(sub.func.id) === name) facts.recursive.add(name);
        });
      } else if (t === "ClassDef") {
        facts.classes.add(nm(n.name));
      } else if (t === "Import") {
        (n.names || []).forEach(function (al) { var x = nm(al.name); facts.imports.add(x); facts.imports.add(x.split(".")[0]); });
      } else if (t === "ImportFrom") {
        if (n.module) { var x = nm(n.module); facts.imports.add(x); facts.imports.add(x.split(".")[0]); }
      } else if (t === "Call") {
        if (n.func && kind(n.func) === "Name") facts.calls.add(nm(n.func.id));
        else if (n.func && kind(n.func) === "Attribute") {
          facts.calls.add(nm(n.func.attr));
          var d = dotted(n.func);
          if (d) facts.calls.add(d);
        }
      } else if (t === "For" || t === "AsyncFor") bump("for");
      else if (t === "While") bump("while");
      else if (t === "If" || t === "IfExp") { if (t === "If") bump("if"); }
      else if (t === "Try" || t === "TryExcept" || t === "TryFinally") bump("try");
      else if (t === "With" || t === "AsyncWith") bump("with");
      else if (t === "Lambda") bump("lambda");
      else if (t === "ListComp" || t === "SetComp" || t === "DictComp" || t === "GeneratorExp") bump("comprehension");
      else if (t === "Global") bump("global");
    });
    return facts;
  }

  function checkRequirements(source, rules) {
    if (!rules || !rules.length) return [];
    var facts = codeFacts(source);
    if (!facts) {
      try { Sk.parse("req.py", source); } catch (e) { return [tr("chk_syntax_error", "синтаксична помилка: ") + String(e)]; }
      return [];
    }
    var problems = [];
    rules.forEach(function (r) {
      var kind = r.kind, arg = r.arg;
      var present = false;
      if (kind === "def") present = arg ? facts.defs.has(arg) : facts.defs.size > 0;
      else if (kind === "class") present = arg ? facts.classes.has(arg) : facts.classes.size > 0;
      else if (kind === "recursion") present = arg ? facts.recursive.has(arg) : facts.recursive.size > 0;
      else if (kind === "import") present = facts.imports.has(arg);
      else if (kind === "call") present = facts.calls.has(arg);
      else present = (facts.counts[kind] || 0) > 0;
      var what = reqDescribe(kind, arg);
      if (r.verb === "require" && !present) problems.push(tr("chk_missing", "відсутнє: ") + what);
      else if (r.verb === "forbid" && present) problems.push(tr("chk_forbidden", "заборонено, але є: ") + what);
    });
    return problems;
  }

  function reqDescribe(kind, arg) {
    if (kind === "def") return arg ? (tr("chk_kind_function", "функція ") + arg + "()") : tr("chk_kind_function_decl", "оголошення функції");
    if (kind === "class") return arg ? (tr("chk_kind_class", "клас ") + arg) : tr("chk_kind_class_decl", "оголошення класу");
    if (kind === "recursion") return arg ? (tr("chk_kind_recursion", "рекурсія у ") + arg + "()") : tr("chk_kind_recursion_plain", "рекурсія");
    if (kind === "import") return tr("chk_kind_import", "імпорт ") + arg;
    if (kind === "call") return tr("chk_kind_call", "виклик ") + arg + "()";
    var names = { for: tr("chk_kind_for", "цикл for"), while: tr("chk_kind_while", "цикл while"), if: tr("chk_kind_if", "умовний оператор if"), try: tr("chk_kind_try", "try/except"), with: tr("chk_kind_with", "оператор with"), lambda: tr("chk_kind_lambda", "lambda-вираз"), comprehension: tr("chk_kind_comprehension", "включення (comprehension)"), global: tr("chk_kind_global", "оператор global") };
    return names[kind] || kind;
  }

  // ---------- GUI tree comparison ----------
  var CORE_KEYS = ["class", "text", "state", "value", "selected", "values", "curselection", "show", "orient", "from", "to", "title", "entries", "rows", "columns", "tabs", "tab_selected", "items", "has_image"];
  var KEY_UA = { class: tr("chk_key_class", "клас"), text: tr("chk_key_text", "текст"), state: tr("chk_key_state", "стан"), value: tr("chk_key_value", "значення"), selected: tr("chk_key_selected", "вибрано"), values: tr("chk_key_values", "список значень"), curselection: tr("chk_key_curselection", "виділення"), show: "show", orient: "orient", from: "from", to: "to", title: tr("chk_key_title", "заголовок вікна"), entries: tr("chk_key_entries", "пункти меню"), rows: tr("chk_key_rows", "рядки таблиці"), columns: tr("chk_key_columns", "стовпці"), tabs: tr("chk_key_tabs", "вкладки"), tab_selected: tr("chk_key_tab_selected", "активна вкладка"), items: tr("chk_key_items", "елементи Canvas"), has_image: tr("chk_key_has_image", "зображення") };
  var TTK_PLAIN = { Button: 1, Entry: 1, Frame: 1, Label: 1, Checkbutton: 1, Radiobutton: 1, Scale: 1, Labelframe: 1, Scrollbar: 1, Progressbar: 1, Notebook: 1, Panedwindow: 1, Spinbox: 1, Separator: 1, Sizegrip: 1, Menubutton: 1 };
  var TEXT_KEYS = { text: 1, value: 1, values: 1, selected: 1, title: 1, entries: 1, rows: 1, columns: 1, tabs: 1, tab_selected: 1 };

  function _empty(v) { return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0); }

  function _normText(v, opts) {
    if (typeof v === "string") {
      if (opts.gui_ignore_ws !== false) v = v.split(/\s+/).filter(function (x) { return x; }).join(" ");
      if (opts.gui_ignore_punct) v = v.replace(/^[\s\t:;.,!?…\-–—]+|[\s\t:;.,!?…\-–—]+$/g, "");
      if (opts.gui_ignore_case) v = v.toLowerCase();
      return v;
    }
    if (Array.isArray(v)) return v.map(function (x) { return _normText(x, opts); });
    if (v && typeof v === "object") {
      var o = {};
      Object.keys(v).forEach(function (k) { o[k] = _normText(v[k], opts); });
      return o;
    }
    return v;
  }

  function _cls(n, opts) {
    var c = n["class"] || "";
    if (opts.loose_ttk && c.charAt(0) === "T" && TTK_PLAIN[c.slice(1)]) return c.slice(1);
    return c;
  }

  function _flat(n, opts) {
    var out = {};
    CORE_KEYS.forEach(function (k) {
      if (k === "text" && opts.gui_ignore_text) return;
      var v = n[k];
      if (TEXT_KEYS[k]) v = _normText(v, opts);
      if (!_empty(v)) out[k] = v;
    });
    out["class"] = _cls(n, opts);
    if (opts.style) {
      var st = n.style || {};
      Object.keys(st).forEach(function (k) {
        if (opts.loose_ttk && (k === "bg" || k === "fg" || k === "font" || k === "relief" || k === "bd" || k === "padx" || k === "pady")) return;
        out[tr("chk_key_style", "стиль.") + k] = st[k];
      });
    }
    if (opts.layout) {
      var ly = n.layout || {};
      Object.keys(ly).forEach(function (k) { out[tr("chk_key_layout", "розташування.") + k] = ly[k]; });
    }
    return out;
  }

  function _label(n, opts) {
    var t = n.text;
    var c = _cls(n, opts);
    return (t ? (c + " «" + String(t).slice(0, 30) + "»") : c);
  }

  function _sig(n, opts) {
    var kids = (n.children || []).map(function (c) { return _sig(c, opts); }).sort().join(",");
    var txt = opts.gui_ignore_text ? "" : (n.text || "");
    return _cls(n, opts) + "|" + _normText(txt, opts) + "|" + _normText(n.value || "", opts) + "|[" + kids + "]";
  }

  function compareTrees(s, t, opts, path) {
    path = path || _label(s, opts);
    var diffs = [];
    var sn = _flat(s, opts), tn = _flat(t, opts);
    var keys = Object.keys(sn).concat(Object.keys(tn));
    var seen = {};
    var sortedKeys = Array.from(new Set(keys)).sort(function (x, y) {
      var ax = CORE_KEYS.indexOf(x) < 0 ? 1 : 0;
      var ay = CORE_KEYS.indexOf(y) < 0 ? 1 : 0;
      if (ax !== ay) return ax - ay;
      return x < y ? -1 : (x > y ? 1 : 0);
    });
    sortedKeys.forEach(function (k) {
      if (sn[k] !== tn[k] && !(sn[k] === undefined && tn[k] === undefined)) {
        // compare with JSON
        if (JSON.stringify(sn[k]) !== JSON.stringify(tn[k])) {
          diffs.push(path + ": " + (KEY_UA[k] || k) + " (" + tr("chk_sample", "зразок=") + JSON.stringify(sn[k]) + ", " + tr("chk_student", "учень=") + JSON.stringify(tn[k]) + ")");
        }
      }
    });
    var sCh = s.children || [], tCh = t.children || [];
    if (!opts.ignore_order) {
      var mn = Math.min(sCh.length, tCh.length);
      for (var i = 0; i < mn; i++) diffs = diffs.concat(compareTrees(sCh[i], tCh[i], opts, path + " › " + _label(sCh[i], opts)));
      for (var i = sCh.length; i < tCh.length; i++) {} // no
      for (var i = mn; i < sCh.length; i++) diffs.push(path + tr("chk_missing_widget", ": відсутній віджет ") + _label(sCh[i], opts));
      for (var j = mn; j < tCh.length; j++) diffs.push(path + tr("chk_extra_widget", ": зайвий віджет ") + _label(tCh[j], opts));
      return diffs;
    }
    // ignore_order
    var usedT = new Set();
    var pairs = [];
    var restS = [];
    var tSigs = tCh.map(function (c) { return _sig(c, opts); });
    sCh.forEach(function (sc, i) {
      var ss = _sig(sc, opts);
      var found = false;
      tSigs.forEach(function (ts, j) {
        if (!found && !usedT.has(j) && ts === ss) { usedT.add(j); pairs.push([i, j]); found = true; }
      });
      if (!found) restS.push(i);
    });
    // cand
    var cand = [];
    restS.forEach(function (i) {
      tCh.forEach(function (tc, j) {
        if (!usedT.has(j) && _cls(sCh[i], opts) === _cls(tc, opts)) {
          cand.push([compareTrees(sCh[i], tc, opts).length, i, j]);
        }
      });
    });
    cand.sort(function (a, b) { return a[0] - b[0]; });
    var doneS = new Set();
    cand.forEach(function (c) {
      var i = c[1], j = c[2];
      if (doneS.has(i) || usedT.has(j)) return;
      doneS.add(i); usedT.add(j); pairs.push([i, j]);
    });
    pairs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    pairs.forEach(function (pr) {
      diffs = diffs.concat(compareTrees(sCh[pr[0]], tCh[pr[1]], opts, path + " › " + _label(sCh[pr[0]], opts)));
    });
    var pairedS = new Set(pairs.map(function (p) { return p[0]; }));
    sCh.forEach(function (sc, i) {
      if (!pairedS.has(i)) diffs.push(path + tr("chk_missing_widget", ": відсутній віджет ") + _label(sc, opts));
    });
    tCh.forEach(function (tc, j) {
      if (!usedT.has(j)) diffs.push(path + tr("chk_extra_widget", ": зайвий віджет ") + _label(tc, opts));
    });
    return diffs;
  }

  // ---------- compare runs ----------
  function compareRuns(sample, student, opts) {
    opts = Object.assign({}, DEFAULT_OPTS, opts || {});
    var rep = { fatal: [], warnings: [], steps: [], ndiffs: 0, ok: false };
    if (sample && sample.error) rep.fatal.push(tr("chk_sample_crash", "Зразок не запускається:\n") + sample.error);
    if (student && student.error) rep.fatal.push(tr("chk_student_crash", "Код учня не запускається:\n") + student.error);
    if (rep.fatal.length) { rep.ndiffs = rep.fatal.length; return rep; }
    var seen = new Set();
    var ss = sample.steps || [], st = student.steps || [];
    var n = Math.min(ss.length, st.length);
    for (var i = 0; i < n; i++) {
      var sStep = ss[i], tStep = st[i];
      var diffs = [];
      if (sStep.action_error) rep.warnings.push(tr("chk_sample_step", "[зразок] крок «") + sStep.label + "»: " + sStep.action_error);
      else if (tStep.action_error) diffs.push(tr("chk_action_failed_student", "дію не вдалося виконати в учня: ") + tStep.action_error);
      var a = sStep.tree, b = tStep.tree;
      var ac = !!(a && a.closed), bc = !!(b && b.closed);
      if (ac !== bc) diffs.push(tr("chk_window", "вікно ") + (ac ? tr("chk_closed_sample", "закрито в зразку") : tr("chk_closed_student", "закрито в учня")));
      else if (!ac && a && b) diffs = diffs.concat(compareTrees(a, b, opts));
      if (opts.dialogs) {
        var da = (sStep.dialogs || []).map(function (d) { return d.kind + ": " + _normText((d.message || "").trim(), opts); });
        var db = (tStep.dialogs || []).map(function (d) { return d.kind + ": " + _normText((d.message || "").trim(), opts); });
        if (JSON.stringify(da) !== JSON.stringify(db)) diffs.push(tr("chk_dialogs", "діалоги: зразок=") + JSON.stringify(da) + ", " + tr("chk_student", "учень=") + JSON.stringify(db));
      }
      var ea = sStep.errors || [], eb = tStep.errors || [];
      if (JSON.stringify(ea) !== JSON.stringify(eb)) diffs.push(tr("chk_callback_exc", "винятки в callback: зразок=") + JSON.stringify(ea) + ", " + tr("chk_student", "учень=") + JSON.stringify(eb));
      if (opts.stdout) {
        var xa = _normText(String(sStep.stdout || "").trim(), opts);
        var xb = _normText(String(tStep.stdout || "").trim(), opts);
        if (xa !== xb) diffs.push(tr("chk_print", "print: зразок=") + JSON.stringify(xa) + ", " + tr("chk_student", "учень=") + JSON.stringify(xb));
      }
      var newD = diffs.filter(function (d) { return !seen.has(d); });
      var repeated = diffs.length - newD.length;
      diffs.forEach(function (d) { seen.add(d); });
      rep.steps.push({ label: sStep.label, diffs: newD, repeated: repeated, weight: 1 });
      rep.ndiffs += newD.length;
    }
    rep.ok = rep.ndiffs === 0;
    return rep;
  }

  function compareConsoleRuns(sampleCases, studentCases, opts) {
    opts = Object.assign({}, DEFAULT_OPTS, opts || {});
    var rep = { fatal: [], warnings: [], steps: [], ndiffs: 0, ok: false, mode: "console" };
    // sample errors
    for (var i = 0; i < sampleCases.length; i++) {
      var s = sampleCases[i][1];
      if (s && s.error) rep.fatal.push(tr("chk_sample_fail_test", "Зразок не виконується (тест «") + sampleCases[i][0] + tr("chk_sample_fail_test2", "»):\n") + s.error);
    }
    if (rep.fatal.length) { rep.ndiffs = rep.fatal.length; return rep; }
    // incomplete check
    sampleCases.forEach(function (sc) {
      var s = sc[1];
      if (s.exception && s.exception.type === "EOFError") {
        rep.incomplete = true;
        rep.warnings.push(tr("chk_incomplete_warn", "[зразок] тест «") + sc[0] + tr("chk_incomplete_warn2", "»: input() не отримав даних (EOFError) — вхідних рядків менше, ніж читає програма. Перевірка цього тесту НЕПОВНА: додайте рядки у вхідні дані."));
      }
    });
    for (var i = 0; i < sampleCases.length; i++) {
      var name = sampleCases[i][0];
      var s = sampleCases[i][1];
      var t = studentCases[i][1];
      var diffs = [];
      if (t && t.error) {
        diffs.push(tr("chk_program_failed", "програма не завершилась коректно: ") + String(t.error).split("\n")[0]);
      } else {
        diffs = diffs.concat(compareOutput(s.stdout, t.stdout, opts));
        var se = s.exception, te = t.exception;
        if ((se && se.type) !== (te && te.type)) diffs.push(tr("chk_exception", "виняток: зразок=") + JSON.stringify(_excStr(s)) + ", " + tr("chk_student", "учень=") + JSON.stringify(_excStr(t)));
        if (s.exit_code !== t.exit_code) diffs.push(tr("chk_exit_code", "код завершення: зразок=") + s.exit_code + ", " + tr("chk_student", "учень=") + t.exit_code);
      }
      rep.steps.push({ label: tr("chk_test", "Test: ") + name, diffs: diffs, repeated: 0, weight: _weightOf(name), sample_out: String(s.stdout || "").slice(0, 20000), student_out: (t && t.error ? "" : String(t.stdout || "")).slice(0, 20000) });
      rep.ndiffs += diffs.length;
    }
    rep.ok = rep.ndiffs === 0;
    return rep;
  }

  function _excStr(run) {
    var e = run.exception;
    return e ? (e.type + ": " + e.message) : null;
  }

  function compareFunctionRuns(sample, student, cases, opts) {
    opts = Object.assign({}, DEFAULT_OPTS, opts || {});
    var rep = { fatal: [], warnings: [], steps: [], ndiffs: 0, ok: false, mode: "functions" };
    if (sample && sample.error) rep.fatal.push(tr("chk_sample_crash", "Зразок не запускається:\n") + sample.error);
    if (student && student.error) rep.fatal.push(tr("chk_student_crash", "Код учня не запускається:\n") + student.error);
    if (rep.fatal.length) { rep.ndiffs = rep.fatal.length; return rep; }
    var sl = sample.load_error, tl = student.load_error;
    if (sl) rep.warnings.push(tr("chk_module_load_warn", "[зразок] модуль завантажується з помилкою ") + sl.type + ": " + sl.message);
    if (tl && (!sl || sl.type !== tl.type)) {
      rep.steps.push({ label: tr("chk_load_module", "Завантаження модуля"), weight: 1, repeated: 0, diffs: [tr("chk_module_error", "помилка під час виконання модуля: ") + tl.type + ": " + tl.message] });
      rep.ndiffs += 1;
    }
    var tol = parseFloat(opts.console_float_tol || 0);
    var sc = sample.cases || [], tc = student.cases || [];
    cases.forEach(function (case_, ci) {
      var s_ = sc[ci] || {}, t_ = tc[ci] || {};
      var diffs = [];
      var se = s_.exception, te = t_.exception;
      if (se && te) {
        if (se.type !== te.type) diffs.push(tr("chk_exception", "виняток: зразок=") + se.type + ", " + tr("chk_student", "учень=") + te.type);
      } else if (se) {
        diffs.push(tr("chk_exception", "виняток: зразок=") + se.type + ": " + se.message + tr("chk_student_returned", ", учень повернув ") + (t_.repr));
      } else if (te) {
        diffs.push(tr("chk_result", "результат: зразок=") + (s_.repr) + tr("chk_student_exception", ", учень: виняток ") + te.type + ": " + te.message);
      } else {
        var ra = s_.repr, rb = t_.repr;
        if (ra !== rb) {
          var pa = literalEval(ra), pb = literalEval(rb);
          if (!(pa.ok && pb.ok && valuesEqual(pa.value, pb.value, tol))) {
            diffs.push(tr("chk_result", "результат: зразок=") + ra + ", " + tr("chk_student", "учень=") + rb);
          }
        }
      }
      if (opts.stdout && ((s_.stdout || "") || (t_.stdout || ""))) {
        compareOutput(s_.stdout || "", t_.stdout || "", opts).forEach(function (d) { diffs.push(tr("chk_print_word", "print: ") + d); });
      }
      rep.steps.push({ label: tr("chk_call", "Виклик: ") + case_.expr, diffs: diffs, repeated: 0, weight: case_.weight || 1 });
      rep.ndiffs += diffs.length;
    });
    rep.ok = rep.ndiffs === 0;
    return rep;
  }

  var DEFAULT_OPTS = {
    ignore_order: true, style: false, layout: false, stdout: false, dialogs: true, loose_ttk: false,
    console_ignore_ws: true, console_ignore_case: false, console_prompts: false, console_float_tol: 1e-6,
    gui_ignore_ws: true, gui_ignore_case: false, gui_ignore_punct: false, gui_ignore_text: false,
    random_seed: 12345, limit_output_kb: 1024, limit_memory_mb: 1024, func_case_timeout: 3.0,
    similarity_threshold: 0.9
  };

  function mergeReports(parts) {
    var rep = { fatal: [], warnings: [], steps: [], ndiffs: 0, ok: false, mode: "both" };
    parts.forEach(function (pt) {
      var tag = pt[0], r = pt[1];
      rep.fatal = rep.fatal.concat((r.fatal || []).map(function (f) { return "[" + tag + "] " + f; }));
      rep.warnings = rep.warnings.concat((r.warnings || []).map(function (w) { return w.charAt(0) === "[" ? w : "[" + tag + "] " + w; }));
      (r.steps || []).forEach(function (st) { rep.steps.push(Object.assign({}, st, { label: "[" + tag + "] " + st.label })); });
      rep.ndiffs += r.ndiffs || 0;
      if (r.incomplete) rep.incomplete = true;
    });
    rep.ok = parts.every(function (pt) { return pt[1].ok; });
    return rep;
  }

  function _addStatic(rep, problems, rulesExist) {
    if (!rulesExist) return;
    if (rep.fatal && rep.fatal.length) {
      rep.fatal = rep.fatal.concat(problems.map(function (p) { return tr("chk_req_prefix", "Вимоги до коду: ") + p; }));
      return;
    }
    rep.steps.unshift({ label: tr("chk_req_title", "Вимоги до коду"), diffs: problems, repeated: 0, weight: 1 });
    rep.ndiffs += problems.length;
    rep.ok = rep.ok && !problems.length;
  }

  function _finalize(rep, expectedTotal) {
    var steps = rep.steps || [];
    var total = steps.reduce(function (a, s) { return a + (s.weight || 1); }, 0);
    var earned = steps.reduce(function (a, s) { return a + ((s.diffs && s.diffs.length) ? 0 : (s.weight || 1)); }, 0);
    if (rep.fatal && rep.fatal.length) {
      earned = 0; total = Math.max(expectedTotal || 0, total, 1);
    } else if (total === 0) {
      earned = rep.ok ? 1 : 0; total = 1;
    }
    rep.earned = earned;
    rep.total = total;
    rep.percent = Math.round(100 * earned / total);
  }

  function formatReport(rep, maxPerStep) {
    maxPerStep = maxPerStep || 40;
    var out = [];
    if (rep.fatal && rep.fatal.length) {
      out.push({ tag: "err", text: tr("chk_crash", "💥 Не вдалося виконати програму") });
      if (rep.total !== undefined) out.push({ tag: "head", text: tr("chk_score", "Рівень: ") + rep.earned + tr("chk_of", " з ") + rep.total + " (" + rep.percent + "%)" });
      if (rep.similar) {
        var sim = rep.similar.slice(0, 5).map(function (r) { return r[0] + " (" + Math.round(r[1] * 100) + "%)"; }).join(", ");
        out.push({ tag: "warn", text: tr("chk_similar", "⚠ Схожа за структурою коду на: ") + sim });
      }
      (rep.fatal || []).forEach(function (f) { out.push({ tag: "", text: f }); });
      return out;
    }
    if (rep.ok) out.push({ tag: "ok", text: tr("chk_all_match_full", "✅ УСЕ ВІДПОВІДАЄ ЗРАЗКУ") });
    else out.push({ tag: "err", text: tr("chk_diffs", "❌ Проблем: ") + rep.ndiffs });
    if (rep.total !== undefined) out.push({ tag: "head", text: tr("chk_score", "Рівень: ") + rep.earned + tr("chk_of", " з ") + rep.total + " (" + rep.percent + "%)" });
    if (rep.similar) {
      var sim = rep.similar.slice(0, 5).map(function (r) { return r[0] + " (" + Math.round(r[1] * 100) + "%)"; }).join(", ");
      out.push({ tag: "warn", text: tr("chk_similar", "⚠ Схожа за структурою коду на: ") + sim });
    }
    if (rep.incomplete) out.push({ tag: "warn", text: tr("chk_incomplete", "⚠ Тести неповні: еталон прочитав менше рядків, ніж вимагає input(). Результат ненадійний — доповніть вхідні дані у завданні.") });
    (rep.warnings || []).forEach(function (w) {
      if (w.indexOf("EOFError") >= 0) out.push({ tag: "dim", text: "ℹ " + w });
      else out.push({ tag: "warn", text: "⚠ " + w });
    });
    (rep.steps || []).forEach(function (st) {
      out.push({ tag: "", text: "" });
      out.push({ tag: "head", text: "—— " + st.label + " ——" });
      if (!st.diffs || !st.diffs.length) {
        if (st.repeated) out.push({ tag: "dim", text: tr("chk_no_new_diffs", "  (нових відмінностей немає; ") + st.repeated + tr("chk_prev_remain", " попередніх лишаються)") });
        else out.push({ tag: "ok", text: tr("chk_step_match", "  ✅ збігається") });
        return;
      }
      st.diffs.slice(0, maxPerStep).forEach(function (d) { out.push({ tag: "err", text: "  • " + d }); });
      if (st.diffs.length > maxPerStep) out.push({ tag: "dim", text: tr("chk_more", "  … ще ") + (st.diffs.length - maxPerStep) });
      if (st.repeated) out.push({ tag: "dim", text: tr("chk_prev_not_repeated", "  (+") + st.repeated + tr("chk_prev_not_repeated2", " попередніх відмінностей не повторюються)") });
    });
    return out;
  }

  // ---------- оркестратор ----------
  async function checkTask(task, code) {
    var opts = Object.assign({}, DEFAULT_OPTS, task.options || {});
    var mode = task.mode || "auto";
    if (mode === "auto") mode = detectMode(task.reference_code || "");
    var referenceCode = decodeRefCode(task.reference_code || "");
    var actions = parseActions(task.actions_text || "");
    var cases = parseConsoleCases(task.console_cases_text || "");
    var exprs = parseFunctionCases(task.function_cases_text || "");
    var reqParsed = parseRequirements(task.requirements_text || "");
    var rules = reqParsed.rules;
    var timeout = parseFloat(task.timeout || 20);
    var files = task.files || {};
    var runtime = { random_seed: (opts.random_seed != null ? opts.random_seed : DEFAULT_OPTS.random_seed) };

    var runFunc = mode === "functions";
    var runConsole = mode === "console" || (mode === "both" && /\binput\s*\(/.test(referenceCode));
    var runGui = !runFunc && mode !== "console";

    // reference runs
    var sampleConsole = null, sampleGui = null, sampleFunc = null;
    if (runConsole) {
      sampleConsole = [];
      for (var i = 0; i < cases.length; i++) {
        var c = cases[i];
        var r = await runConsoleProgram(referenceCode, "sample.py", c.stdin, timeout, !!opts.console_prompts, mode === "both", files, runtime);
        sampleConsole.push([c.name, r]);
      }
    }
    if (runGui) {
      sampleGui = await runGuiProgram(referenceCode, "sample.py", actions, timeout, files, runtime);
    }
    if (runFunc) {
      sampleFunc = await runFunctionProgram(referenceCode, "sample.py", exprs.map(function (e) { return e.expr; }), timeout, parseFloat(opts.func_case_timeout || 3), files, runtime);
    }

    // student runs
    var studentConsole = null, studentGui = null, studentFunc = null;
    if (runConsole) {
      studentConsole = [];
      for (var i = 0; i < cases.length; i++) {
        var c = cases[i];
        var r = await runConsoleProgram(code, "student.py", c.stdin, timeout, !!opts.console_prompts, mode === "both", files, runtime);
        studentConsole.push([c.name, r]);
      }
    }
    if (runGui) {
      studentGui = await runGuiProgram(code, "student.py", actions, timeout, files, runtime);
    }
    if (runFunc) {
      studentFunc = await runFunctionProgram(code, "student.py", exprs.map(function (e) { return e.expr; }), timeout, parseFloat(opts.func_case_timeout || 3), files, runtime);
    }

    // build report
    var parts = [];
    if (runConsole) {
      var repC = compareConsoleRuns(sampleConsole, studentConsole, opts);
      parts.push([tr("chk_console", "Console"), repC]);
    }
    if (runGui) {
      var repG = compareRuns(sampleGui, studentGui, opts);
      parts.push([tr("chk_gui", "GUI"), repG]);
    }
    if (runFunc) {
      var repF = compareFunctionRuns(sampleFunc, studentFunc, exprs, opts);
      parts.push([tr("chk_functions", "Функції"), repF]);
    }
    var rep;
    if (parts.length === 1) rep = parts[0][1];
    else rep = mergeReports(parts);

    // static requirements
    var rprob = checkRequirements(code, rules);
    _addStatic(rep, rprob, rules.length > 0);

    // expected total
    var expected = 0;
    if (runConsole) expected += cases.reduce(function (a, c) { return a + _weightOf(c.name); }, 0);
    if (runGui) expected += (sampleGui && sampleGui.steps ? sampleGui.steps.length : 0) || 1;
    if (runFunc) expected += exprs.reduce(function (a, c) { return a + (c.weight || 1); }, 0);
    if (rules.length) expected += 1;
    _finalize(rep, expected);

    return rep;
  }

  Checker.checkTask = checkTask;
  Checker.formatReport = formatReport;
  Checker.runConsoleProgram = runConsoleProgram;
  Checker.runFunctionProgram = runFunctionProgram;
  Checker.runGuiProgram = runGuiProgram;
  Checker.parseConsoleCases = parseConsoleCases;
  Checker.parseFunctionCases = parseFunctionCases;
  Checker.parseRequirements = parseRequirements;
  Checker.parseActions = parseActions;
  Checker.detectMode = detectMode;

  // ---------- Кодування/розкодування reference_code (XOR + Base64) ----------
  var TASK_KEY = "YepythonRefCode2026";
  function encodeRefCode(code) {
    if (!code) return code;
    var xored = "";
    for (var i = 0; i < code.length; i++) {
      xored += String.fromCharCode(code.charCodeAt(i) ^ TASK_KEY.charCodeAt(i % TASK_KEY.length));
    }
    return "ENC:" + btoa(unescape(encodeURIComponent(xored)));
  }
  function decodeRefCode(code) {
    if (!code || String(code).indexOf("ENC:") !== 0) return code;
    try {
      var b64 = String(code).slice(4);
      var xored = decodeURIComponent(escape(atob(b64)));
      var dec = "";
      for (var i = 0; i < xored.length; i++) {
        dec += String.fromCharCode(xored.charCodeAt(i) ^ TASK_KEY.charCodeAt(i % TASK_KEY.length));
      }
      return dec;
    } catch (e) {
      return code;
    }
  }

  // ---------- UI ----------
  var taskData = null;
  var taskUrl = null;

  // Сигнал для index.html, що checker.js завантажено
  window.__checkerLoaded = true;

  // ---------- Облік виконання завдання ----------
  var taskStarted = false;
  var taskStartTime = 0;
  var keystrokeCount = 0;
  var pasteCount = 0;
  var pastedChars = 0;
  var checkCount = 0;
  var lastCheckResult = null;
  var userIP = "";

  async function fetchUserIP() {
    if (userIP) return userIP;
    var services = ["https://api.ipify.org?format=json", "https://ipapi.co/json/"];
    for (var i = 0; i < services.length; i++) {
      try {
        var resp = await fetch(services[i], { mode: "cors" });
        if (!resp.ok) continue;
        var data = await resp.json();
        userIP = data.ip || data.IP || "";
        if (userIP) return userIP;
      } catch (e) {}
    }
    // fallback: try text endpoint
    try {
      var resp = await fetch("https://api.ipify.org", { mode: "cors" });
      userIP = (await resp.text()).trim();
    } catch (e) {}
    return userIP;
  }

  function resetTaskStats() {
    taskStarted = true;
    taskStartTime = Date.now();
    keystrokeCount = 0;
    pasteCount = 0;
    pastedChars = 0;
    checkCount = 0;
    lastCheckResult = null;
  }

  function formatDuration(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + " " + tr("exam_min_short", "хв") + " " + s + " " + tr("exam_sec_short", "с");
  }

  function saveSubmitImage() {
    var container = document.getElementById("exam_qr_container");
    if (!container) return;
    var qrCanvas = container.querySelector("canvas");
    var qrImg = container.querySelector("img");
    // Build a composite canvas
    var W = 760, H = 420;
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(tr("exam_submit_dialog_title", "Submit"), 20, 30);
    // draw table text (re-read from dialog)
    var dialog = document.getElementById("exam_submit_dialog");
    var rows = dialog ? dialog.querySelectorAll("tr") : [];
    var y = 60;
    rows.forEach(function (tr) {
      var cells = tr.querySelectorAll("td");
      if (cells.length >= 2) {
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(cells[0].textContent, 20, y);
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#000";
        ctx.fillText(cells[1].textContent, 260, y);
        y += 22;
      }
    });
    // draw QR code to the right
    var qrX = 500, qrY = 50, qrSize = 160;
    // red border
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
    } else if (qrImg && qrImg.src) {
      var img = new Image();
      img.onload = function () {
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
        downloadCanvas(canvas);
      };
      img.src = qrImg.src;
      return;
    }
    downloadCanvas(canvas);
  }

  function downloadCanvas(canvas) {
    var url = canvas.toDataURL("image/png");
    var a = document.createElement("a");
    a.href = url;
    a.download = "submit_result.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function getParam(name) {
    try { return new URL(window.location.href).searchParams.get(name); } catch (e) { return null; }
  }

  async function loadTask() {
    if (taskData) return taskData;
    var param = taskUrl || getParam("task");
    if (!param) return null;
    taskUrl = param;
    if (param.toLowerCase() === "file") {
      // Вибір локального файлу завдання (як ?world=file у robot)
      return await pickTaskFile();
    }
    if (param.toLowerCase() === "test") {
      // Пробний запуск з teacher_app: завдання передано через localStorage
      try {
        var raw = localStorage.getItem("yepython_test_task");
        if (raw) {
          taskData = JSON.parse(raw);
          return taskData;
        }
      } catch (e) {}
      alert(tr("exam_trial_not_found", "Не знайдено завдання для пробного запуску. Спочатку збережіть його в teacher_app."));
      return null;
    }
    var resp = await fetch(param);
    taskData = await resp.json();
    return taskData;
  }

  function pickTaskFile() {
    return new Promise(function (resolve) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,.task.json,application/json";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) { resolve(null); cleanup(); return; }
        var reader = new FileReader();
        reader.onload = function () {
          try {
            taskData = JSON.parse(reader.result);
          } catch (e) {
            alert(tr("exam_file_read_error", "Помилка читання файлу: ") + (e && e.message));
            taskData = null;
          }
          cleanup();
          resolve(taskData);
        };
        reader.onerror = function () {
          alert(tr("exam_file_read_failed", "Не вдалося прочитати файл."));
          cleanup();
          resolve(null);
        };
        reader.readAsText(file);
      });
      function cleanup() {
        if (input.parentNode) input.parentNode.removeChild(input);
      }
      // Браузер може вимагати клік користувача — показуємо підказку
      try { input.click(); } catch (e) { /* потрібен клік */ }
    });
  }

  function showDialog(id, htmlContent) {
    var $d = $("#" + id);
    if (!$d.length) return;
    $d.html(htmlContent);
    if ($d.dialog("instance")) {
      $d.dialog("open");
    } else {
      $d.dialog({ modal: true, width: 600, maxHeight: 500 });
    }
  }

  // override exam hooks
  if (!window.PythonIDE) window.PythonIDE = {};
  if (!PythonIDE.exam) PythonIDE.exam = {};
  PythonIDE.exam.onTask = async function () {
    try {
      var task = await loadTask();
      if (!task) {
        alert(tr("exam_no_task", "Task URL is missing (?task=...)"));
        return;
      }
      var html = "<h3>" + escapeHtml(task.title || "") + "</h3><div style='white-space:pre-wrap;'>" + escapeHtml(task.description || "") + "</div>" +
        "<div style='margin-top:16px;text-align:right;'><button type='button' id='btn_exam_start'>" + escapeHtml(taskStarted ? tr("exam_close_btn", "Закрити") : tr("exam_start_btn", "Розпочати")) + "</button></div>";
      showDialog("exam_task_dialog", html);
      // bind start button
      setTimeout(function () {
        var btn = document.getElementById("btn_exam_start");
        if (btn) {
          btn.onclick = function () {
            if (!taskStarted) resetTaskStats();
            $("#exam_task_dialog").dialog("close");
          };
        }
      }, 0);
    } catch (e) {
      alert("Error loading task: " + (e && e.message || e));
    }
  };
  var checking = false;
  PythonIDE.exam.onTest = async function () {
    if (checking) return;
    checking = true;
    try {
      var task = await loadTask();
      if (!task) {
        alert(tr("exam_no_task", "Task URL is missing (?task=...)"));
        return;
      }
      var code = "";
      try { code = PythonIDE.editor.getValue(); } catch (e) { code = ""; }
      if (PythonIDE.currentFile && PythonIDE.files && PythonIDE.files[PythonIDE.currentFile] !== undefined && !code) {
        code = PythonIDE.files[PythonIDE.currentFile] || "";
      }
      var $d = $("#exam_check_dialog");
      if (PythonIDE.running) {
        $d.html("<p>" + escapeHtml(tr("exam_check_busy", "Спочатку зупиніть виконання програми, потім натисніть перевірку ще раз.")) + "</p>");
        if ($d.dialog("instance")) $d.dialog("open"); else $d.dialog({ modal: true, width: 700, maxHeight: 560 });
        return;
      }
      $d.html("<p>" + escapeHtml(tr("exam_check_running", "Перевірка…")) + "</p>");
      if ($d.dialog("instance")) $d.dialog("open"); else $d.dialog({ modal: true, width: 700, maxHeight: 560 });
      var rep = await checkTask(task, code);
      checkCount += 1;
      lastCheckResult = rep;
      var lines = formatReport(rep);
      var html = lines.map(function (l) {
        var cls = l.tag || "";
        return "<div class='chk-" + cls + "'>" + escapeHtml(l.text) + "</div>";
      }).join("");
      $d.html(html);
    } catch (e) {
      $("#exam_check_dialog").html("<pre>" + escapeHtml(String(e && e.stack || e)) + "</pre>");
    } finally {
      checking = false;
    }
  };
  PythonIDE.exam.onSubmit = async function () {
    var elapsed = taskStarted ? (Date.now() - taskStartTime) : 0;
    var _ct = new Date();
    var completionTime = _ct.getFullYear() + "-" + String(_ct.getMonth() + 1).padStart(2, "0") + "-" + String(_ct.getDate()).padStart(2, "0") + " " + String(_ct.getHours()).padStart(2, "0") + ":" + String(_ct.getMinutes()).padStart(2, "0") + ":" + String(_ct.getSeconds()).padStart(2, "0");
    var ip = await fetchUserIP();
    var lastScore = (lastCheckResult && lastCheckResult.total) ? (lastCheckResult.earned + " / " + lastCheckResult.total + " (" + lastCheckResult.percent + "%)") : tr("exam_no_checks", "—");
    var lastStatus = lastCheckResult ? (lastCheckResult.ok ? tr("exam_status_ok", "✅ Усе відповідає") : ("❌ " + lastCheckResult.ndiffs + tr("exam_diffs_word", " відмінностей"))) : tr("exam_no_checks", "перевірок ще не було");
    var qrStatus = lastCheckResult ? (lastCheckResult.ok ? "OK" : ("FAIL:" + lastCheckResult.ndiffs)) : "NONE";
    // Кількість символів у вікні редактора коду
    var codeText = "";
    try { codeText = PythonIDE.editor.getValue(); } catch (e) { codeText = ""; }
    if (!codeText && PythonIDE.currentFile && PythonIDE.files && PythonIDE.files[PythonIDE.currentFile] !== undefined) codeText = PythonIDE.files[PythonIDE.currentFile] || "";
    var codeChars = codeText.length;
    var qrPlain = "T=" + Math.floor(elapsed / 1000) + "s;K=" + keystrokeCount + ";L=" + codeChars + ";P=" + pasteCount + "(" + pastedChars + ");C=" + checkCount + ";R=" + qrStatus + ";" + lastScore + ";FINISH=" + completionTime + ";IP=" + (ip || "unknown");
    // Шифрування XOR + Base64 (щоб учень не міг підмінити результати)
    var qrKey = "YepythonExam2026";
    var xored = "";
    for (var xi = 0; xi < qrPlain.length; xi++) {
      xored += String.fromCharCode(qrPlain.charCodeAt(xi) ^ qrKey.charCodeAt(xi % qrKey.length));
    }
    var qrText = "ENC:" + btoa(unescape(encodeURIComponent(xored)));
    var html = "<div style='display:flex;gap:16px;align-items:flex-start;'>" +
      "<div style='flex:1;'>" +
      (taskStarted ? "" : "<p style='color:#b36b00;'>" + escapeHtml(tr("exam_not_started", "Завдання ще не розпочато (натисніть «Розпочати» у вікні умови).")) + "</p>") +
      "<table style='width:100%;border-collapse:collapse;'>" +
      "<tr><td style='padding:4px;font-weight:600;'>" + escapeHtml(tr("exam_submit_time", "Час виконання")) + "</td><td style='padding:4px;'>" + formatDuration(elapsed) + "</td></tr>" +
      "<tr><td style='padding:4px;font-weight:600;'>" + escapeHtml(tr("exam_submit_keystrokes", "Натиснуто символів")) + "</td><td style='padding:4px;'>" + keystrokeCount + "</td></tr>" +
      "<tr><td style='padding:4px;font-weight:600;'>" + escapeHtml(tr("exam_submit_code_chars", "Символів у коді")) + "</td><td style='padding:4px;'>" + codeChars + "</td></tr>" +
      "<tr><td style='padding:4px;font-weight:600;'>" + escapeHtml(tr("exam_submit_pastes", "Вставок з буфера")) + "</td><td style='padding:4px;'>" + pasteCount + " (" + pastedChars + " " + escapeHtml(tr("exam_submit_chars", "симв.")) + ")</td></tr>" +
      "<tr><td style='padding:4px;font-weight:600;'>" + escapeHtml(tr("exam_submit_checks", "Перевірок (Check)")) + "</td><td style='padding:4px;'>" + checkCount + "</td></tr>" +
      "<tr><td style='padding:4px;font-weight:600;'>" + escapeHtml(tr("exam_submit_lastresult", "Останній результат")) + "</td><td style='padding:4px;'>" + escapeHtml(lastStatus) + " — " + escapeHtml(lastScore) + "</td></tr>" +
      "<tr><td style='padding:4px;font-weight:600;'>" + escapeHtml(tr("exam_submit_ip", "IP комп'ютера")) + "</td><td style='padding:4px;'>" + escapeHtml(ip || "—") + "</td></tr>" +
      "</table>" +
      "<div style='margin-top:12px;'><button type='button' id='btn_exam_save'>" + escapeHtml(tr("exam_save_btn", "Зберегти")) + "</button></div>" +
      "</div>" +
      "<div id='exam_qr_container' style='flex-shrink:0;width:160px;height:160px;border:2px solid #ff0000;padding:2px;'></div>" +
      "</div>";
    var $d = $("#exam_submit_dialog");
    $d.html(html);
    if ($d.dialog("instance")) $d.dialog("open"); else $d.dialog({ modal: true, width: 740, maxHeight: 520, title: tr("exam_submit_dialog_title", "Submit") });
    // render QR code
    setTimeout(function () {
      var container = document.getElementById("exam_qr_container");
      if (!container) return;
      container.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        try {
          new QRCode(container, { text: qrText, width: 150, height: 150, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.L });
        } catch (e) {
          container.textContent = "QR: " + e.message;
        }
      } else {
        container.textContent = tr("exam_qr_offline", "QR недоступний (офлайн)");
      }
      // bind save button
      var saveBtn = document.getElementById("btn_exam_save");
      if (saveBtn) {
        saveBtn.onclick = function () { saveSubmitImage(); };
      }
    }, 50);
  };

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function injectCss() {
    if (document.getElementById("chk_css")) return;
    var st = document.createElement("style");
    st.id = "chk_css";
    st.textContent =
      "#exam_check_dialog div{white-space:pre-wrap;word-break:break-word;line-height:1.45}" +
      "#exam_check_dialog .chk-ok{color:#2e9e44}" +
      "#exam_check_dialog .chk-err{color:#c0392b}" +
      "#exam_check_dialog .chk-warn{color:#b36b00}" +
      "#exam_check_dialog .chk-head{font-weight:700;margin-top:4px}" +
      "#exam_check_dialog .chk-dim{opacity:.65}";
    document.head.appendChild(st);
  }

  // init dialogs on ready
  $(function () {
    injectCss();
    if ($("#exam_task_dialog").length && !$("#exam_task_dialog").dialog("instance")) {
      $("#exam_task_dialog").dialog({ autoOpen: false, modal: true, width: 600, maxHeight: 500, title: tr("exam_task_title_dialog", "Task") });
    }
    if ($("#exam_check_dialog").length && !$("#exam_check_dialog").dialog("instance")) {
      $("#exam_check_dialog").dialog({ autoOpen: false, modal: true, width: 720, maxHeight: 560, title: tr("exam_check_title", "Check result") });
    }
    if ($("#exam_submit_dialog").length && !$("#exam_submit_dialog").dialog("instance")) {
      $("#exam_submit_dialog").dialog({ autoOpen: false, modal: true, width: 520, maxHeight: 500, title: tr("exam_submit_dialog_title", "Submit") });
    }

    // Облік натискань клавіш та вставок у редакторі (лише після "Розпочати")
    var hooked = false;
    function hookEditor() {
      if (hooked || !(window.PythonIDE && PythonIDE.editor)) return !!hooked;
      hooked = true;
      PythonIDE.editor.on("change", function (cm, change) {
        if (!taskStarted) return;
        if (!change || !change.origin) return;
        if (change.origin === "setValue" || change.origin === "undo" || change.origin === "redo") return;
        var inserted = 0;
        if (change.text) {
          change.text.forEach(function (line) { inserted += line.length; });
          if (change.text.length > 1) inserted += change.text.length - 1; // newlines
        }
        if (change.origin === "paste") {
          pasteCount += 1;
          pastedChars += inserted;
        } else if (change.origin === "+input" || change.origin === "*compose") {
          keystrokeCount += inserted;
        }
      });
      return true;
    }
    var tries = 0;
    (function waitEditor() { if (!hookEditor() && tries++ < 100) setTimeout(waitEditor, 300); })();
  });

})();
