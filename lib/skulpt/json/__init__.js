/**
 * json.js — окремий модуль json для Skulpt.
 *
 * Реалізує підмножину стандартного Python-модуля json:
 *   json.dumps(obj, *, skipkeys=False, ensure_ascii=True, check_circular=True,
 *              allow_nan=True, cls=None, indent=None, separators=None,
 *              default=None, sort_keys=False)
 *   json.dump(obj, fp, *, той самий набір параметрів, що й dumps)
 *   json.loads(s, *, cls=None, object_hook=None, parse_float=None,
 *              parse_int=None, parse_constant=None, object_pairs_hook=None)
 *   json.load(fp, *, той самий набір параметрів, що й loads)
 *   json.JSONEncoder(...) — клас з методами .encode(obj) та .default(obj)
 *     (можна успадкувати й перевизначити default() для власних типів)
 *   json.JSONDecoder(...) — клас з методами .decode(s) та .raw_decode(s, idx=0)
 *   json.JSONDecodeError — виняток (підклас ValueError) з атрибутами
 *     msg, doc, pos, lineno, colno
 *
 * fp для load() має мати метод .read() (сумісно з customfile.js).
 * fp для dump() має мати метод .write(str).
 *
 * Відома спрощена поведінка (відмінність від CPython):
 *   — параметр cls (у dumps/dump/loads/load) приймається, але ігнорується:
 *     завжди використовується вбудована логіка кодування/декодування;
 *     для власного default() слід або передати default=..., або
 *     створити json.JSONEncoder і викликати його .encode() напряму.
 *   — порядок ключів словника при кодуванні відповідає порядку ітерування
 *     Sk.builtin.dict у цьому оточенні Skulpt (як правило — порядку
 *     додавання, як у CPython 3.7+, але це залежить від реалізації).
 *   — числа з плаваючою комою форматуються наближено до Python (напр.
 *     "1.0" замість "1"), але для екзотичних значень можливі незначні
 *     розбіжності у представленні (наприклад, у показниках степеня).
 *   — параметр strict у JSONDecoder не підтримується окремо: рядки завжди
 *     розбираються у "суворому" режимі (сирі керуючі символи в рядкових
 *     літералах заборонені), як і за замовчуванням у CPython.
 *
 * v1.0 — перша версія, побудована за зразком csv.js: використовує той
 * самий self-detecting розбір аргументів (_splitArgs) для обходу
 * особливості цього оточення Skulpt, коли co_kwargs-функції іноді
 * викликаються без підстановки масиву kwa першим аргументом.
 */
var $builtinmodule = function (name) {
    "use strict";

    var mod = {};

    // ─── json.JSONDecodeError ───────────────────────────────────────────────

    function _lineCol(text, pos) {
        var pre = text.slice(0, pos);
        var lines = pre.split("\n");
        var lineno = lines.length;
        var colno = lines[lines.length - 1].length + 1;
        return [lineno, colno];
    }

    mod.JSONDecodeError = function JSONDecodeError_(msg, doc, pos) {
        if (!(this instanceof mod.JSONDecodeError)) {
            return new mod.JSONDecodeError(msg, doc, pos);
        }
        var lc = _lineCol(doc, pos);
        var lineno = lc[0];
        var colno = lc[1];
        var fullMsg = msg + ": line " + lineno + " column " + colno + " (char " + pos + ")";
        Sk.builtin.ValueError.call(this, fullMsg);
        this.tp$setattr(new Sk.builtin.str("msg"), new Sk.builtin.str(msg));
        this.tp$setattr(new Sk.builtin.str("doc"), new Sk.builtin.str(doc));
        this.tp$setattr(new Sk.builtin.str("pos"), Sk.ffi.remapToPy(pos));
        this.tp$setattr(new Sk.builtin.str("lineno"), Sk.ffi.remapToPy(lineno));
        this.tp$setattr(new Sk.builtin.str("colno"), Sk.ffi.remapToPy(colno));
        return this;
    };
    Sk.abstr.setUpInheritance("JSONDecodeError", mod.JSONDecodeError, Sk.builtin.ValueError);
    Sk.abstr.setUpBuiltinMro(mod.JSONDecodeError);

    // ─── внутрішні хелпери (аргументи) ──────────────────────────────────────

    function _kwaToObj(kwa) {
        var o = {};
        var i;
        if (kwa && kwa.length) {
            for (i = 0; i < kwa.length; i += 2) {
                o[Sk.ffi.remapToJs(kwa[i])] = kwa[i + 1];
            }
        }
        return o;
    }

    /**
     * Самодетектуючий розбір аргументів для co_kwargs-функцій — той самий
     * прийом, що й у csv.js, потрібний через особливість цього оточення
     * Skulpt (masив kwa не завжди підставляється при виклику без
     * ключових аргументів).
     */
    function _splitArgs(kwa, positional) {
        if (kwa === undefined || kwa === null || Array.isArray(kwa)) {
            return { kwargs: Array.isArray(kwa) ? _kwaToObj(kwa) : {}, args: positional };
        }
        return { kwargs: {}, args: [kwa].concat(positional) };
    }

    function _cloneOpts(o) {
        var c = {};
        var k;
        for (k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
                c[k] = o[k];
            }
        }
        return c;
    }

    function _readAll(fp) {
        if (fp === undefined || fp === null) {
            throw new Sk.builtin.TypeError("json: відсутній обов'язковий аргумент fp");
        }
        var readFn;
        try {
            readFn = Sk.abstr.gattr(fp, new Sk.builtin.str("read"), true);
        } catch (e) {
            readFn = undefined;
        }
        if (!readFn) {
            throw new Sk.builtin.TypeError("json: об'єкт fp не має методу read()");
        }
        var result = Sk.misceval.callsimArray(readFn, []);
        return Sk.ffi.remapToJs(result);
    }

    function _writeAll(fp, text) {
        if (fp === undefined || fp === null) {
            throw new Sk.builtin.TypeError("json: відсутній обов'язковий аргумент fp");
        }
        var writeFn = Sk.abstr.gattr(fp, new Sk.builtin.str("write"), true);
        Sk.misceval.callsimArray(writeFn, [new Sk.builtin.str(text)]);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Кодування (dumps / dump)
    // ═══════════════════════════════════════════════════════════════════════

    function _floatToJSON(num, allowNan) {
        if (Number.isNaN(num)) {
            if (!allowNan) {
                throw new Sk.builtin.ValueError("Out of range float values are not JSON compliant");
            }
            return "NaN";
        }
        if (num === Infinity) {
            if (!allowNan) {
                throw new Sk.builtin.ValueError("Out of range float values are not JSON compliant");
            }
            return "Infinity";
        }
        if (num === -Infinity) {
            if (!allowNan) {
                throw new Sk.builtin.ValueError("Out of range float values are not JSON compliant");
            }
            return "-Infinity";
        }
        if (Object.is(num, -0)) {
            return "-0.0";
        }
        if (Number.isInteger(num)) {
            return num.toFixed(1);
        }
        return String(num);
    }

    function _encodeString(s, ensureAscii) {
        var out = "\"";
        var i;
        var ch;
        var code;
        for (i = 0; i < s.length; i += 1) {
            ch = s[i];
            code = s.charCodeAt(i);
            if (ch === "\"") {
                out += "\\\"";
                continue;
            }
            if (ch === "\\") {
                out += "\\\\";
                continue;
            }
            if (ch === "\b") {
                out += "\\b";
                continue;
            }
            if (ch === "\f") {
                out += "\\f";
                continue;
            }
            if (ch === "\n") {
                out += "\\n";
                continue;
            }
            if (ch === "\r") {
                out += "\\r";
                continue;
            }
            if (ch === "\t") {
                out += "\\t";
                continue;
            }
            if (code < 0x20 || (ensureAscii && code > 0x7e)) {
                out += "\\u" + ("0000" + code.toString(16)).slice(-4);
                continue;
            }
            out += ch;
        }
        out += "\"";
        return out;
    }

    function _keyToJSONString(keyObj, opts) {
        if (keyObj instanceof Sk.builtin.str) {
            return Sk.ffi.remapToJs(keyObj);
        }
        if (keyObj instanceof Sk.builtin.bool) {
            return Sk.misceval.isTrue(keyObj) ? "true" : "false";
        }
        if (keyObj === Sk.builtin.none.none$) {
            return "null";
        }
        if (keyObj instanceof Sk.builtin.int_) {
            return keyObj.tp$str().v;
        }
        if (keyObj instanceof Sk.builtin.float_) {
            return _floatToJSON(Sk.ffi.remapToJs(keyObj), opts.allow_nan);
        }
        var tname = (keyObj && keyObj.tp$name) ? keyObj.tp$name : "object";
        throw new Sk.builtin.TypeError("keys must be str, int, float, bool or None, not " + tname);
    }

    function _wrapContainer(open, close, parts, opts, level) {
        if (parts.length === 0) {
            return open + close;
        }
        if (opts.indent !== null) {
            var pad = opts.indentStr.repeat(level + 1);
            var padEnd = opts.indentStr.repeat(level);
            var sep = opts.item_separator + "\n" + pad;
            return open + "\n" + pad + parts.join(sep) + "\n" + padEnd + close;
        }
        return open + parts.join(opts.item_separator) + close;
    }

    function _encodeArray(value, opts, level, stack) {
        var newStack = stack;
        if (opts.check_circular) {
            if (stack.indexOf(value) !== -1) {
                throw new Sk.builtin.ValueError("Circular reference detected");
            }
            newStack = stack.concat([value]);
        }
        var arr = Sk.misceval.arrayFromIterable(value, true);
        var parts = arr.map(function (item) {
            return _encodeValue(item, opts, level + 1, newStack);
        });
        return _wrapContainer("[", "]", parts, opts, level);
    }

    function _encodeObject(value, opts, level, stack) {
        var newStack = stack;
        if (opts.check_circular) {
            if (stack.indexOf(value) !== -1) {
                throw new Sk.builtin.ValueError("Circular reference detected");
            }
            newStack = stack.concat([value]);
        }
        var it = Sk.abstr.iter(value);
        var entries = [];
        var k;
        for (k = it.tp$iternext(); k !== undefined; k = it.tp$iternext()) {
            var val = value.mp$subscript(k);
            var keyStr;
            try {
                keyStr = _keyToJSONString(k, opts);
            } catch (e) {
                if (opts.skipkeys) {
                    continue;
                }
                throw e;
            }
            entries.push({ keyStr: keyStr, val: val });
        }
        if (opts.sort_keys) {
            entries.sort(function (a, b) {
                if (a.keyStr < b.keyStr) {
                    return -1;
                }
                if (a.keyStr > b.keyStr) {
                    return 1;
                }
                return 0;
            });
        }
        var parts = entries.map(function (e) {
            return _encodeString(e.keyStr, opts.ensure_ascii) + opts.key_separator +
                _encodeValue(e.val, opts, level + 1, newStack);
        });
        return _wrapContainer("{", "}", parts, opts, level);
    }

    function _encodeValue(value, opts, level, stack) {
        if (value === undefined || value === Sk.builtin.none.none$) {
            return "null";
        }
        if (value instanceof Sk.builtin.bool) {
            return Sk.misceval.isTrue(value) ? "true" : "false";
        }
        if (value instanceof Sk.builtin.int_) {
            return value.tp$str().v;
        }
        if (value instanceof Sk.builtin.float_) {
            return _floatToJSON(Sk.ffi.remapToJs(value), opts.allow_nan);
        }
        if (value instanceof Sk.builtin.str) {
            return _encodeString(Sk.ffi.remapToJs(value), opts.ensure_ascii);
        }
        if (value instanceof Sk.builtin.list || value instanceof Sk.builtin.tuple) {
            return _encodeArray(value, opts, level, stack);
        }
        if (value instanceof Sk.builtin.dict) {
            return _encodeObject(value, opts, level, stack);
        }
        if (opts.default) {
            var replaced = Sk.misceval.callsimArray(opts.default, [value]);
            return _encodeValue(replaced, opts, level, stack);
        }
        var tname = (value && value.tp$name) ? value.tp$name : "object";
        throw new Sk.builtin.TypeError("Object of type " + tname + " is not JSON serializable");
    }

    function _resolveDumpOptions(kwargs) {
        var opts = {
            skipkeys: false,
            ensure_ascii: true,
            check_circular: true,
            allow_nan: true,
            indent: null,
            indentStr: "",
            item_separator: ", ",
            key_separator: ": ",
            default: null,
            sort_keys: false
        };
        if (kwargs.skipkeys !== undefined) {
            opts.skipkeys = Sk.misceval.isTrue(kwargs.skipkeys);
        }
        if (kwargs.ensure_ascii !== undefined) {
            opts.ensure_ascii = Sk.misceval.isTrue(kwargs.ensure_ascii);
        }
        if (kwargs.check_circular !== undefined) {
            opts.check_circular = Sk.misceval.isTrue(kwargs.check_circular);
        }
        if (kwargs.allow_nan !== undefined) {
            opts.allow_nan = Sk.misceval.isTrue(kwargs.allow_nan);
        }
        if (kwargs.sort_keys !== undefined) {
            opts.sort_keys = Sk.misceval.isTrue(kwargs.sort_keys);
        }
        if (kwargs.default !== undefined && kwargs.default !== Sk.builtin.none.none$) {
            opts.default = kwargs.default;
        }
        if (kwargs.indent !== undefined && kwargs.indent !== Sk.builtin.none.none$) {
            if (kwargs.indent instanceof Sk.builtin.str) {
                opts.indentStr = Sk.ffi.remapToJs(kwargs.indent);
            } else {
                var n = Sk.ffi.remapToJs(kwargs.indent);
                if (typeof n !== "number" || n < 0) {
                    n = n < 0 ? 0 : n;
                }
                opts.indentStr = " ".repeat(n);
            }
            opts.indent = opts.indentStr;
            opts.item_separator = ",";
            opts.key_separator = ": ";
        }
        if (kwargs.separators !== undefined && kwargs.separators !== Sk.builtin.none.none$) {
            var sepArr = Sk.misceval.arrayFromIterable(kwargs.separators, true);
            opts.item_separator = Sk.ffi.remapToJs(sepArr[0]);
            opts.key_separator = Sk.ffi.remapToJs(sepArr[1]);
        }
        return opts;
    }

    function _dumpsImpl(kwa, obj) {
        var split = _splitArgs(kwa, [obj]);
        var kwargs = split.kwargs;
        obj = split.args[0];
        if (obj === undefined) {
            obj = kwargs.obj;
        }
        if (obj === undefined) {
            throw new Sk.builtin.TypeError("dumps() missing required argument: 'obj'");
        }
        var opts = _resolveDumpOptions(kwargs);
        var text = _encodeValue(obj, opts, 0, []);
        return new Sk.builtin.str(text);
    }
    // co_kwargs МАЄ бути на самій "сирій" JS-функції (func_code), а не лише
    // на обгортці Sk.builtin.func — інакше виклик з ключовими аргументами
    // падає з "TypeError: dumps() takes no keyword arguments". Встановлюємо
    // на обох, про всяк випадок.
    _dumpsImpl.co_kwargs = true;
    mod.dumps = new Sk.builtin.func(_dumpsImpl);
    mod.dumps.co_kwargs = true;

    function _dumpImpl(kwa, obj, fp) {
        var split = _splitArgs(kwa, [obj, fp]);
        var kwargs = split.kwargs;
        obj = split.args[0];
        fp = split.args[1];
        if (obj === undefined) {
            obj = kwargs.obj;
        }
        if (fp === undefined) {
            fp = kwargs.fp;
        }
        if (obj === undefined) {
            throw new Sk.builtin.TypeError("dump() missing required argument: 'obj'");
        }
        if (fp === undefined) {
            throw new Sk.builtin.TypeError("dump() missing required argument: 'fp'");
        }
        var opts = _resolveDumpOptions(kwargs);
        var text = _encodeValue(obj, opts, 0, []);
        _writeAll(fp, text);
        return Sk.builtin.none.none$;
    }
    _dumpImpl.co_kwargs = true;
    mod.dump = new Sk.builtin.func(_dumpImpl);
    mod.dump.co_kwargs = true;


    // ═══════════════════════════════════════════════════════════════════════
    // Декодування (loads / load)
    // ═══════════════════════════════════════════════════════════════════════

    function _err(text, state, msg) {
        throw new mod.JSONDecodeError(msg, text, state.pos);
    }

    function _skipWs(text, state) {
        var c;
        while (state.pos < text.length) {
            c = text[state.pos];
            if (c === " " || c === "\t" || c === "\n" || c === "\r") {
                state.pos += 1;
            } else {
                break;
            }
        }
    }

    function _parseConstant(nameJs, opts) {
        if (opts.parse_constant) {
            return Sk.misceval.callsimArray(opts.parse_constant, [new Sk.builtin.str(nameJs)]);
        }
        if (nameJs === "NaN") {
            return new Sk.builtin.float_(NaN);
        }
        if (nameJs === "Infinity") {
            return new Sk.builtin.float_(Infinity);
        }
        return new Sk.builtin.float_(-Infinity);
    }

    function _makeIntFromString(numStr) {
        try {
            return new Sk.builtin.int_(numStr);
        } catch (e) {
            return new Sk.builtin.int_(parseInt(numStr, 10));
        }
    }

    function _parseString(text, state) {
        // припущення: text[state.pos] === '"'
        state.pos += 1;
        var out = "";
        var ch;
        var esc;
        var hex;
        var code1;
        var hex2;
        var code2;
        while (true) {
            if (state.pos >= text.length) {
                _err(text, state, "Unterminated string starting at");
            }
            ch = text[state.pos];
            if (ch === "\"") {
                state.pos += 1;
                break;
            }
            if (ch === "\\") {
                state.pos += 1;
                if (state.pos >= text.length) {
                    _err(text, state, "Unterminated string starting at");
                }
                esc = text[state.pos];
                if (esc === "\"") {
                    out += "\"";
                    state.pos += 1;
                } else if (esc === "\\") {
                    out += "\\";
                    state.pos += 1;
                } else if (esc === "/") {
                    out += "/";
                    state.pos += 1;
                } else if (esc === "b") {
                    out += "\b";
                    state.pos += 1;
                } else if (esc === "f") {
                    out += "\f";
                    state.pos += 1;
                } else if (esc === "n") {
                    out += "\n";
                    state.pos += 1;
                } else if (esc === "r") {
                    out += "\r";
                    state.pos += 1;
                } else if (esc === "t") {
                    out += "\t";
                    state.pos += 1;
                } else if (esc === "u") {
                    state.pos += 1;
                    hex = text.substr(state.pos, 4);
                    if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
                        _err(text, state, "Invalid \\uXXXX escape");
                    }
                    code1 = parseInt(hex, 16);
                    state.pos += 4;
                    if (code1 >= 0xd800 && code1 <= 0xdbff &&
                            text[state.pos] === "\\" && text[state.pos + 1] === "u") {
                        hex2 = text.substr(state.pos + 2, 4);
                        if (/^[0-9a-fA-F]{4}$/.test(hex2)) {
                            code2 = parseInt(hex2, 16);
                            if (code2 >= 0xdc00 && code2 <= 0xdfff) {
                                out += String.fromCharCode(code1, code2);
                                state.pos += 6;
                                continue;
                            }
                        }
                    }
                    out += String.fromCharCode(code1);
                } else {
                    _err(text, state, "Invalid \\escape");
                }
            } else if (ch.charCodeAt(0) < 0x20) {
                _err(text, state, "Invalid control character");
            } else {
                out += ch;
                state.pos += 1;
            }
        }
        return out;
    }

    function _parseArray(text, state, opts) {
        state.pos += 1;
        var items = [];
        _skipWs(text, state);
        if (text[state.pos] === "]") {
            state.pos += 1;
            return new Sk.builtin.list(items);
        }
        var c;
        while (true) {
            items.push(_parseValue(text, state, opts));
            _skipWs(text, state);
            c = text[state.pos];
            if (c === ",") {
                state.pos += 1;
                _skipWs(text, state);
                continue;
            }
            if (c === "]") {
                state.pos += 1;
                break;
            }
            _err(text, state, "Expecting ',' delimiter");
        }
        return new Sk.builtin.list(items);
    }

    function _parseObject(text, state, opts) {
        state.pos += 1;
        var pairs = [];
        _skipWs(text, state);
        var c;
        var key;
        var val;
        if (text[state.pos] === "}") {
            state.pos += 1;
        } else {
            while (true) {
                _skipWs(text, state);
                if (text[state.pos] !== "\"") {
                    _err(text, state, "Expecting property name enclosed in double quotes");
                }
                key = _parseString(text, state);
                _skipWs(text, state);
                if (text[state.pos] !== ":") {
                    _err(text, state, "Expecting ':' delimiter");
                }
                state.pos += 1;
                _skipWs(text, state);
                val = _parseValue(text, state, opts);
                pairs.push([key, val]);
                _skipWs(text, state);
                c = text[state.pos];
                if (c === ",") {
                    state.pos += 1;
                    continue;
                }
                if (c === "}") {
                    state.pos += 1;
                    break;
                }
                _err(text, state, "Expecting ',' delimiter");
            }
        }

        if (opts.object_pairs_hook) {
            var pyPairs = pairs.map(function (p) {
                return new Sk.builtin.tuple([new Sk.builtin.str(p[0]), p[1]]);
            });
            return Sk.misceval.callsimArray(opts.object_pairs_hook, [new Sk.builtin.list(pyPairs)]);
        }

        var d = new Sk.builtin.dict([]);
        var i;
        for (i = 0; i < pairs.length; i += 1) {
            d.mp$ass_subscript(new Sk.builtin.str(pairs[i][0]), pairs[i][1]);
        }
        if (opts.object_hook) {
            return Sk.misceval.callsimArray(opts.object_hook, [d]);
        }
        return d;
    }

    function _parseValue(text, state, opts) {
        _skipWs(text, state);
        if (state.pos >= text.length) {
            _err(text, state, "Expecting value");
        }
        var ch = text[state.pos];
        if (ch === "{") {
            return _parseObject(text, state, opts);
        }
        if (ch === "[") {
            return _parseArray(text, state, opts);
        }
        if (ch === "\"") {
            return new Sk.builtin.str(_parseString(text, state));
        }
        if (text.substr(state.pos, 4) === "true") {
            state.pos += 4;
            return Sk.ffi.remapToPy(true);
        }
        if (text.substr(state.pos, 5) === "false") {
            state.pos += 5;
            return Sk.ffi.remapToPy(false);
        }
        if (text.substr(state.pos, 4) === "null") {
            state.pos += 4;
            return Sk.builtin.none.none$;
        }
        if (text.substr(state.pos, 3) === "NaN") {
            state.pos += 3;
            return _parseConstant("NaN", opts);
        }
        if (text.substr(state.pos, 8) === "Infinity") {
            state.pos += 8;
            return _parseConstant("Infinity", opts);
        }
        if (text.substr(state.pos, 9) === "-Infinity") {
            state.pos += 9;
            return _parseConstant("-Infinity", opts);
        }
        var m = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(state.pos));
        if (m && m[0].length > 0) {
            var numStr = m[0];
            state.pos += numStr.length;
            var isFloat = numStr.indexOf(".") !== -1 || numStr.indexOf("e") !== -1 || numStr.indexOf("E") !== -1;
            if (isFloat) {
                if (opts.parse_float) {
                    return Sk.misceval.callsimArray(opts.parse_float, [new Sk.builtin.str(numStr)]);
                }
                return new Sk.builtin.float_(parseFloat(numStr));
            }
            if (opts.parse_int) {
                return Sk.misceval.callsimArray(opts.parse_int, [new Sk.builtin.str(numStr)]);
            }
            return _makeIntFromString(numStr);
        }
        _err(text, state, "Expecting value");
    }

    function _resolveLoadOptions(kwargs) {
        var opts = {
            object_hook: null,
            object_pairs_hook: null,
            parse_float: null,
            parse_int: null,
            parse_constant: null
        };
        if (kwargs.object_hook !== undefined && kwargs.object_hook !== Sk.builtin.none.none$) {
            opts.object_hook = kwargs.object_hook;
        }
        if (kwargs.object_pairs_hook !== undefined && kwargs.object_pairs_hook !== Sk.builtin.none.none$) {
            opts.object_pairs_hook = kwargs.object_pairs_hook;
        }
        if (kwargs.parse_float !== undefined && kwargs.parse_float !== Sk.builtin.none.none$) {
            opts.parse_float = kwargs.parse_float;
        }
        if (kwargs.parse_int !== undefined && kwargs.parse_int !== Sk.builtin.none.none$) {
            opts.parse_int = kwargs.parse_int;
        }
        if (kwargs.parse_constant !== undefined && kwargs.parse_constant !== Sk.builtin.none.none$) {
            opts.parse_constant = kwargs.parse_constant;
        }
        return opts;
    }

    function _decodeFull(text, opts) {
        var state = { pos: 0 };
        var value = _parseValue(text, state, opts);
        _skipWs(text, state);
        if (state.pos !== text.length) {
            _err(text, state, "Extra data");
        }
        return value;
    }

    function _loadsImpl(kwa, s) {
        var split = _splitArgs(kwa, [s]);
        var kwargs = split.kwargs;
        s = split.args[0];
        if (s === undefined) {
            s = kwargs.s;
        }
        if (s === undefined) {
            throw new Sk.builtin.TypeError("loads() missing required argument: 's'");
        }
        var text = Sk.ffi.remapToJs(s);
        var opts = _resolveLoadOptions(kwargs);
        return _decodeFull(text, opts);
    }
    _loadsImpl.co_kwargs = true;
    mod.loads = new Sk.builtin.func(_loadsImpl);
    mod.loads.co_kwargs = true;

    function _loadImpl(kwa, fp) {
        var split = _splitArgs(kwa, [fp]);
        var kwargs = split.kwargs;
        fp = split.args[0];
        if (fp === undefined) {
            fp = kwargs.fp;
        }
        if (fp === undefined) {
            throw new Sk.builtin.TypeError("load() missing required argument: 'fp'");
        }
        var text = _readAll(fp);
        var opts = _resolveLoadOptions(kwargs);
        return _decodeFull(text, opts);
    }
    _loadImpl.co_kwargs = true;
    mod.load = new Sk.builtin.func(_loadImpl);
    mod.load.co_kwargs = true;

    // ═══════════════════════════════════════════════════════════════════════
    // json.JSONEncoder / json.JSONDecoder
    // ═══════════════════════════════════════════════════════════════════════

    var JSONEncoder = function JSONEncoder_(kwa) {
        if (!(this instanceof JSONEncoder)) {
            return new JSONEncoder(kwa);
        }
        var positional = Array.prototype.slice.call(arguments, 1);
        var split = _splitArgs(kwa, positional);
        this.opts$ = _resolveDumpOptions(split.kwargs);
        return this;
    };
    JSONEncoder.co_kwargs = true;
    Sk.abstr.setUpInheritance("JSONEncoder", JSONEncoder, Sk.builtin.object);
    Sk.abstr.setUpBuiltinMro(JSONEncoder);

    JSONEncoder.prototype["default"] = new Sk.builtin.func(function default_(self, o) {
        var tname = (o && o.tp$name) ? o.tp$name : "object";
        throw new Sk.builtin.TypeError("Object of type " + tname + " is not JSON serializable");
    });

    JSONEncoder.prototype["encode"] = new Sk.builtin.func(function encode(self, o) {
        var opts = _cloneOpts(self.opts$);
        if (!opts.default) {
            opts.default = new Sk.builtin.func(function (obj) {
                var defaultMethod = Sk.abstr.gattr(self, new Sk.builtin.str("default"), true);
                return Sk.misceval.callsimArray(defaultMethod, [obj]);
            });
        }
        return new Sk.builtin.str(_encodeValue(o, opts, 0, []));
    });
    Sk.abstr.setUpSlots(JSONEncoder);
    mod.JSONEncoder = JSONEncoder;

    var JSONDecoder = function JSONDecoder_(kwa) {
        if (!(this instanceof JSONDecoder)) {
            return new JSONDecoder(kwa);
        }
        var positional = Array.prototype.slice.call(arguments, 1);
        var split = _splitArgs(kwa, positional);
        this.opts$ = _resolveLoadOptions(split.kwargs);
        return this;
    };
    JSONDecoder.co_kwargs = true;
    Sk.abstr.setUpInheritance("JSONDecoder", JSONDecoder, Sk.builtin.object);
    Sk.abstr.setUpBuiltinMro(JSONDecoder);

    JSONDecoder.prototype["decode"] = new Sk.builtin.func(function decode(self, s) {
        var text = Sk.ffi.remapToJs(s);
        return _decodeFull(text, self.opts$);
    });

    JSONDecoder.prototype["raw_decode"] = new Sk.builtin.func(function raw_decode(self, s, idx) {
        var text = Sk.ffi.remapToJs(s);
        var startIdx = (idx === undefined || idx === Sk.builtin.none.none$) ? 0 : Sk.ffi.remapToJs(idx);
        var state = { pos: startIdx };
        var value = _parseValue(text, state, self.opts$);
        return new Sk.builtin.tuple([value, Sk.ffi.remapToPy(state.pos)]);
    });
    Sk.abstr.setUpSlots(JSONDecoder);
    mod.JSONDecoder = JSONDecoder;

    return mod;
};
