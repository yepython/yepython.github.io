/**
 * csv.js — окремий модуль csv для Skulpt.
 *
 * Реалізує підмножину стандартного Python-модуля csv:
 *   csv.reader(csvfile, dialect='excel', **fmtparams)
 *   csv.writer(csvfile, dialect='excel', **fmtparams)
 *   csv.DictReader(csvfile, fieldnames=None, restkey=None, restval=None, dialect='excel', **kwds)
 *   csv.DictWriter(csvfile, fieldnames, restval='', extrasaction='raise', dialect='excel', **kwds)
 *   csv.register_dialect(name, dialect=None, **fmtparams)
 *   csv.unregister_dialect(name)
 *   csv.get_dialect(name)
 *   csv.list_dialects()
 *   csv.field_size_limit(new_limit=None)  — заглушка, повертає 131072
 *   csv.QUOTE_MINIMAL / QUOTE_ALL / QUOTE_NONNUMERIC / QUOTE_NONE
 *   csv.Error
 *
 * Підтримувані діалекти "з коробки": 'excel' (за замовч.), 'excel-tab', 'unix'.
 * Параметри форматування (fmtparams): delimiter, quotechar, escapechar,
 * doublequote, skipinitialspace, lineterminator, quoting.
 *
 * csvfile для reader()/DictReader() може бути:
 *   — об'єктом з методом .read() (напр. Sk.builtin.file з customfile.js —
 *     читання йде з поточної позиції self.pos$ і до кінця файлу),
 *   — будь-яким ітерованим об'єктом рядків (список рядків файлу тощо).
 * csvfile для writer()/DictWriter() має мати метод .write(str) — файл,
 * відкритий у режимі "w"/"a" (сумісно з customfile.js).
 *
 * Відома спрощена поведінка (відмінність від CPython):
 *   — повністю порожній рядок у вхідних даних розбирається як [''] замість [].
 *   — csv.get_dialect() повертає dict з параметрами діалекту, а не
 *     справжній об'єкт-клас Dialect.
 *
 * v1.1 — виправлено: writerow()/DictWriter.writerow() падали з
 * "TypeError: can't access property tp$getattr, obj is undefined" на
 * не-рядкових полях (int/float/bool). Причина: конвертація у рядок йшла
 * через Sk.misceval.callsimArray(Sk.builtin.str, [v]), що виявилось
 * несумісним із цим Skulpt-оточенням для не-str типів. Тепер int/float/
 * bool/None конвертуються напряму через Sk.ffi.remapToJs, без виклику
 * конструктора Sk.builtin.str — виклик через callsimArray лишився лише
 * як запасний варіант для інших (напр. користувацьких) типів, обгорнутий
 * у try/catch.
 *
 * v1.2 — виправлено: csv.writer(f)/csv.reader(f)/DictReader(f)/
 * DictWriter(f, fieldnames)/register_dialect(name) без ключових
 * аргументів падали з "TypeError: can't access property tp$getattr,
 * obj is undefined" на рядку 5 (writerow всередині). Причина: усі ці
 * функції оголошені з co_kwargs=true й очікують, що Skulpt завжди
 * підставляє масив kwa першим аргументом — але в даному оточенні Skulpt
 * цей слот іноді не підставляється при виклику без ключових аргументів,
 * тож перший реальний аргумент (файл) потрапляв у слот kwa, а сам файл
 * (csvfile) лишався undefined. Додано self-detecting розбір аргументів
 * (_splitArgs): якщо kwa — не масив і не undefined/null, він трактується
 * як зсунутий перший позиційний аргумент. Також додано явні перевірки
 * в _getFullText()/_writeToFile(), які кидають зрозумілу Python
 * TypeError замість криптичного JS-крашу, якщо файл все ж відсутній.
 */
var $builtinmodule = function (name) {
    "use strict";

    var mod = {};

    // ─── Константи режимів квотування ──────────────────────────────────────
    mod.QUOTE_MINIMAL = Sk.ffi.remapToPy(0);
    mod.QUOTE_ALL = Sk.ffi.remapToPy(1);
    mod.QUOTE_NONNUMERIC = Sk.ffi.remapToPy(2);
    mod.QUOTE_NONE = Sk.ffi.remapToPy(3);

    // ─── csv.Error ──────────────────────────────────────────────────────────
    mod.Error = function Error_(args) {
        if (!(this instanceof mod.Error)) {
            return new mod.Error(args);
        }
        Sk.builtin.Exception.apply(this, arguments);
        return this;
    };
    Sk.abstr.setUpInheritance("Error", mod.Error, Sk.builtin.Exception);
    Sk.abstr.setUpBuiltinMro(mod.Error);

    // ─── внутрішні хелпери ──────────────────────────────────────────────────

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
     * Самодетектуючий розбір аргументів для co_kwargs-функцій.
     *
     * За контрактом Skulpt, функція з co_kwargs=true повинна отримувати
     * першим аргументом масив `kwa` (список ключових аргументів у форматі
     * [ключ1, знач1, ключ2, знач2, ...]) або undefined/null, якщо ключових
     * аргументів не було. Але в деяких оточеннях Skulpt цей слот іноді не
     * підставляється взагалі, коли викликають без ключових аргументів
     * (напр. csv.writer(f)) — тоді перший позиційний аргумент (f) потрапляє
     * у слот, призначений для kwa, а решта параметрів зсувається на одну
     * позицію й лишається undefined.
     *
     * Ця функція визначає, який із двох випадків стався: якщо `kwa` —
     * масив або відсутній, все як очікувалось. Якщо ж `kwa` — щось інше
     * (об'єкт файлу, рядок і т.п.), значить стався зсув, і ми повертаємо
     * `kwa` назад на початок списку позиційних аргументів.
     */
    function _splitArgs(kwa, positional) {
        if (kwa === undefined || kwa === null || Array.isArray(kwa)) {
            return { kwargs: Array.isArray(kwa) ? _kwaToObj(kwa) : {}, args: positional };
        }
        return { kwargs: {}, args: [kwa].concat(positional) };
    }

    function _cloneDialect(d) {
        var c = {};
        var k;
        for (k in d) {
            if (Object.prototype.hasOwnProperty.call(d, k)) {
                c[k] = d[k];
            }
        }
        return c;
    }

    var _customDialects = {};

    function _resolveDialect(dialectArg, kwargs) {
        var base = {
            delimiter: ",",
            quotechar: "\"",
            escapechar: null,
            doublequote: true,
            skipinitialspace: false,
            lineterminator: "\r\n",
            quoting: 0
        };

        if (dialectArg !== undefined && dialectArg !== Sk.builtin.none.none$) {
            if (dialectArg instanceof Sk.builtin.str) {
                var dname = Sk.ffi.remapToJs(dialectArg);
                if (_customDialects[dname]) {
                    base = _cloneDialect(_customDialects[dname]);
                } else if (dname === "excel-tab") {
                    base.delimiter = "\t";
                } else if (dname === "unix") {
                    base.lineterminator = "\n";
                    base.quoting = 1;
                }
                // "excel" - лишається дефолтним набором
            }
        }

        var key;
        var overridable = {
            delimiter: true, quotechar: true, escapechar: true, doublequote: true,
            skipinitialspace: true, lineterminator: true, quoting: true
        };
        for (key in kwargs) {
            if (overridable[key] && kwargs[key] !== undefined) {
                var v = kwargs[key];
                if (key === "doublequote" || key === "skipinitialspace") {
                    base[key] = Sk.misceval.isTrue(v);
                } else if (key === "quoting") {
                    base[key] = Sk.ffi.remapToJs(v);
                } else if (v === Sk.builtin.none.none$) {
                    base[key] = null;
                } else {
                    base[key] = Sk.ffi.remapToJs(v);
                }
            }
        }
        return base;
    }

    /**
     * Отримує повний текстовий вміст з csvfile: або через .read(),
     * якщо такий метод є (наприклад, у Sk.builtin.file), або шляхом
     * ітерування (рядок за рядком) для будь-якого ітерованого об'єкта.
     */
    function _getFullText(csvfile) {
        if (csvfile === undefined || csvfile === null) {
            throw new Sk.builtin.TypeError("csv: відсутній обов'язковий аргумент csvfile");
        }
        if (csvfile instanceof Sk.builtin.str) {
            return Sk.ffi.remapToJs(csvfile);
        }
        var readFn;
        try {
            readFn = Sk.abstr.gattr(csvfile, new Sk.builtin.str("read"), true);
        } catch (e) {
            readFn = undefined;
        }
        if (readFn) {
            var result = Sk.misceval.callsimArray(readFn, []);
            return Sk.ffi.remapToJs(result);
        }

        var parts = [];
        var it = Sk.abstr.iter(csvfile);
        var v;
        for (v = it.tp$iternext(); v !== undefined; v = it.tp$iternext()) {
            parts.push(Sk.ffi.remapToJs(v));
        }
        return parts.join("");
    }

    function _writeToFile(csvfile, text) {
        if (csvfile === undefined || csvfile === null) {
            throw new Sk.builtin.TypeError("csv: відсутній обов'язковий аргумент csvfile (файл для запису)");
        }
        var writeFn = Sk.abstr.gattr(csvfile, new Sk.builtin.str("write"), true);
        Sk.misceval.callsimArray(writeFn, [new Sk.builtin.str(text)]);
    }

    function _pyFieldToStr(v) {
        if (v === undefined || v === Sk.builtin.none.none$) {
            return "";
        }
        if (v instanceof Sk.builtin.str) {
            return v.v;
        }
        if (v instanceof Sk.builtin.bool) {
            return Sk.misceval.isTrue(v) ? "True" : "False";
        }
        if (v instanceof Sk.builtin.int_) {
            return String(Sk.ffi.remapToJs(v));
        }
        if (v instanceof Sk.builtin.float_) {
            var jsNum = Sk.ffi.remapToJs(v);
            // Python-репрезентація float для цілих значень містить ".0"
            if (typeof jsNum === "number" && isFinite(jsNum) && Math.floor(jsNum) === jsNum) {
                return jsNum.toFixed(1);
            }
            return String(jsNum);
        }
        // Запасний варіант для інших типів (напр. об'єктів з власним __str__)
        try {
            var s = Sk.misceval.callsimArray(Sk.builtin.str, [v]);
            return Sk.ffi.remapToJs(s);
        } catch (e) {
            var js = Sk.ffi.remapToJs(v);
            return (js === null || js === undefined) ? "" : String(js);
        }
    }

    function _dictGet(d, key) {
        try {
            return d.mp$subscript(key);
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Розбирає повний текст CSV на масив рядків (кожен рядок — масив
     * JS-рядків). Підтримує лапки з екрануванням, багаторядкові поля
     * (переноси всередині лапок) та власний escapechar.
     *
     * Примітка: повністю порожній рядок повертається як [""] (а не як []
     * у CPython) — це свідома спрощена поведінка.
     */
    function _parseCSV(text, d) {
        var delimiter = d.delimiter;
        var quotechar = d.quotechar;
        var escapechar = d.escapechar;
        var doublequote = d.doublequote;
        var skipinitialspace = d.skipinitialspace;

        var rows = [];
        var row = [];
        var field = "";
        var inQuotes = false;
        var justStarted = true;
        var i = 0;
        var n = text.length;
        var ch;

        function endField() {
            row.push(field);
            field = "";
            justStarted = true;
        }
        function endRow() {
            endField();
            rows.push(row);
            row = [];
        }

        while (i < n) {
            ch = text[i];

            if (inQuotes) {
                if (escapechar && ch === escapechar && i + 1 < n) {
                    field += text[i + 1];
                    i += 2;
                    continue;
                }
                if (ch === quotechar) {
                    if (doublequote && text[i + 1] === quotechar) {
                        field += quotechar;
                        i += 2;
                        continue;
                    }
                    inQuotes = false;
                    i += 1;
                    continue;
                }
                field += ch;
                i += 1;
                continue;
            }

            if (escapechar && ch === escapechar && i + 1 < n) {
                field += text[i + 1];
                i += 2;
                justStarted = false;
                continue;
            }
            if (ch === quotechar && justStarted) {
                inQuotes = true;
                justStarted = false;
                i += 1;
                continue;
            }
            if (ch === delimiter) {
                endField();
                i += 1;
                continue;
            }
            if (ch === "\r") {
                if (text[i + 1] === "\n") {
                    i += 1;
                }
                endRow();
                i += 1;
                continue;
            }
            if (ch === "\n") {
                endRow();
                i += 1;
                continue;
            }
            if (skipinitialspace && justStarted && ch === " ") {
                i += 1;
                continue;
            }
            field += ch;
            justStarted = false;
            i += 1;
        }

        if (field !== "" || row.length > 0) {
            endRow();
        }

        return rows;
    }

    function _quoteField(field, d) {
        if (d.quoting === 3) {
            // QUOTE_NONE — без лапок, лише екранування escapechar-ом
            if (d.escapechar) {
                field = field.split(d.escapechar).join(d.escapechar + d.escapechar);
                field = field.split(d.delimiter).join(d.escapechar + d.delimiter);
                field = field.split(d.quotechar).join(d.escapechar + d.quotechar);
            }
            return field;
        }

        var needsQuote =
            d.quoting === 1 ||
            field.indexOf(d.delimiter) !== -1 ||
            field.indexOf(d.quotechar) !== -1 ||
            field.indexOf("\n") !== -1 ||
            field.indexOf("\r") !== -1;

        if (!needsQuote) {
            return field;
        }

        var escaped = d.doublequote
            ? field.split(d.quotechar).join(d.quotechar + d.quotechar)
            : field;
        return d.quotechar + escaped + d.quotechar;
    }

    function _formatRow(d, jsFields) {
        var parts = jsFields.map(function (f) {
            return _quoteField(f, d);
        });
        return parts.join(d.delimiter) + d.lineterminator;
    }

    // ─── reader ─────────────────────────────────────────────────────────────

    var CSVReader = function (rows, dialectParams) {
        if (!(this instanceof CSVReader)) {
            return new CSVReader(rows, dialectParams);
        }
        this.rows$ = rows;
        this.idx$ = 0;
        this.line_num = 0;
        this.dialect = dialectParams;
        return this;
    };
    Sk.abstr.setUpInheritance("reader", CSVReader, Sk.builtin.object);
    Sk.abstr.setUpBuiltinMro(CSVReader);

    CSVReader.prototype.tp$iter = function () {
        return this;
    };
    CSVReader.prototype.tp$iternext = function () {
        if (this.idx$ >= this.rows$.length) {
            return undefined;
        }
        var row = this.rows$[this.idx$];
        this.idx$ += 1;
        this.line_num += 1;
        var pyRow = row.map(function (f) {
            return new Sk.builtin.str(f);
        });
        return new Sk.builtin.list(pyRow);
    };
    Sk.abstr.setUpSlots(CSVReader);

    mod.reader = new Sk.builtin.func(function reader(kwa, csvfile, dialect) {
        var split = _splitArgs(kwa, [csvfile, dialect]);
        var kwargs = split.kwargs;
        csvfile = split.args[0];
        dialect = split.args[1];
        if (dialect === undefined) {
            dialect = kwargs.dialect;
        }
        var dialectParams = _resolveDialect(dialect, kwargs);
        var text = _getFullText(csvfile);
        var rows = _parseCSV(text, dialectParams);
        return new CSVReader(rows, dialectParams);
    });
    mod.reader.co_kwargs = true;

    // ─── writer ─────────────────────────────────────────────────────────────

    var CSVWriter = function (csvfile, dialectParams) {
        if (!(this instanceof CSVWriter)) {
            return new CSVWriter(csvfile, dialectParams);
        }
        this.csvfile$ = csvfile;
        this.dialect = dialectParams;
        return this;
    };
    Sk.abstr.setUpInheritance("writer", CSVWriter, Sk.builtin.object);
    Sk.abstr.setUpBuiltinMro(CSVWriter);

    CSVWriter.prototype["writerow"] = new Sk.builtin.func(function writerow(self, row) {
        var arr = Sk.misceval.arrayFromIterable(row, true);
        var jsFields = arr.map(_pyFieldToStr);
        var line = _formatRow(self.dialect, jsFields);
        _writeToFile(self.csvfile$, line);
        return Sk.builtin.none.none$;
    });

    CSVWriter.prototype["writerows"] = new Sk.builtin.func(function writerows(self, rows) {
        var arr = Sk.misceval.arrayFromIterable(rows, true);
        var i;
        for (i = 0; i < arr.length; i += 1) {
            Sk.misceval.callsimArray(CSVWriter.prototype["writerow"], [self, arr[i]]);
        }
        return Sk.builtin.none.none$;
    });
    Sk.abstr.setUpSlots(CSVWriter);

    mod.writer = new Sk.builtin.func(function writer(kwa, csvfile, dialect) {
        var split = _splitArgs(kwa, [csvfile, dialect]);
        var kwargs = split.kwargs;
        csvfile = split.args[0];
        dialect = split.args[1];
        if (dialect === undefined) {
            dialect = kwargs.dialect;
        }
        var dialectParams = _resolveDialect(dialect, kwargs);
        return new CSVWriter(csvfile, dialectParams);
    });
    mod.writer.co_kwargs = true;

    // ─── DictReader ─────────────────────────────────────────────────────────

    var DictReader = function (csvfile, fieldnames, restkey, restval, dialectParams) {
        if (!(this instanceof DictReader)) {
            return new DictReader(csvfile, fieldnames, restkey, restval, dialectParams);
        }
        var text = _getFullText(csvfile);
        var rows = _parseCSV(text, dialectParams);

        this.restkey = restkey === undefined ? Sk.builtin.none.none$ : restkey;
        this.restval = restval === undefined ? Sk.builtin.none.none$ : restval;

        if (fieldnames) {
            this.fieldnames$ = fieldnames;
            this.rows$ = rows;
        } else {
            this.fieldnames$ = rows.length ? rows[0] : [];
            this.rows$ = rows.slice(1);
        }
        this.idx$ = 0;
        this.line_num = 0;
        return this;
    };
    Sk.abstr.setUpInheritance("DictReader", DictReader, Sk.builtin.object);
    Sk.abstr.setUpBuiltinMro(DictReader);

    DictReader.prototype.tp$iter = function () {
        return this;
    };
    DictReader.prototype.tp$iternext = function () {
        if (this.idx$ >= this.rows$.length) {
            return undefined;
        }
        var row = this.rows$[this.idx$];
        this.idx$ += 1;
        this.line_num += 1;

        var d = new Sk.builtin.dict([]);
        var fn = this.fieldnames$;
        var i;
        for (i = 0; i < fn.length; i += 1) {
            var val = i < row.length ? new Sk.builtin.str(row[i]) : this.restval;
            d.mp$ass_subscript(new Sk.builtin.str(fn[i]), val);
        }
        if (row.length > fn.length) {
            var extra = row.slice(fn.length).map(function (s) {
                return new Sk.builtin.str(s);
            });
            d.mp$ass_subscript(this.restkey, new Sk.builtin.list(extra));
        }
        return d;
    };
    Sk.abstr.setUpSlots(DictReader);

    mod.DictReader = new Sk.builtin.func(function DictReaderCtor(kwa, csvfile, fieldnames, restkey, restval, dialect) {
        var split = _splitArgs(kwa, [csvfile, fieldnames, restkey, restval, dialect]);
        var kwargs = split.kwargs;
        csvfile = split.args[0];
        fieldnames = split.args[1];
        restkey = split.args[2];
        restval = split.args[3];
        dialect = split.args[4];
        if (fieldnames === undefined) {
            fieldnames = kwargs.fieldnames;
        }
        if (restkey === undefined) {
            restkey = kwargs.restkey;
        }
        if (restval === undefined) {
            restval = kwargs.restval;
        }
        if (dialect === undefined) {
            dialect = kwargs.dialect;
        }
        var dialectParams = _resolveDialect(dialect, kwargs);

        var fnJs = null;
        if (fieldnames !== undefined && fieldnames !== Sk.builtin.none.none$) {
            var fnArr = Sk.misceval.arrayFromIterable(fieldnames, true);
            fnJs = fnArr.map(function (s) {
                return Sk.ffi.remapToJs(s);
            });
        }
        return new DictReader(csvfile, fnJs, restkey, restval, dialectParams);
    });
    mod.DictReader.co_kwargs = true;

    // ─── DictWriter ─────────────────────────────────────────────────────────

    var DictWriter = function (csvfile, fieldnames, restval, extrasaction, dialectParams) {
        if (!(this instanceof DictWriter)) {
            return new DictWriter(csvfile, fieldnames, restval, extrasaction, dialectParams);
        }
        this.csvfile$ = csvfile;
        this.fieldnames$ = fieldnames;
        this.restval$ = restval === undefined ? "" : _pyFieldToStr(restval);
        this.extrasaction = extrasaction || "raise";
        this.dialect = dialectParams;
        return this;
    };
    Sk.abstr.setUpInheritance("DictWriter", DictWriter, Sk.builtin.object);
    Sk.abstr.setUpBuiltinMro(DictWriter);

    DictWriter.prototype["writeheader"] = new Sk.builtin.func(function writeheader(self) {
        var line = _formatRow(self.dialect, self.fieldnames$.slice());
        _writeToFile(self.csvfile$, line);
        return Sk.builtin.none.none$;
    });

    DictWriter.prototype["writerow"] = new Sk.builtin.func(function writerow(self, rowDict) {
        var i;
        if (self.extrasaction === "raise") {
            var keysFn = Sk.abstr.gattr(rowDict, new Sk.builtin.str("keys"), true);
            var keysList = Sk.misceval.arrayFromIterable(Sk.misceval.callsimArray(keysFn, []), true);
            var fieldSet = {};
            for (i = 0; i < self.fieldnames$.length; i += 1) {
                fieldSet[self.fieldnames$[i]] = true;
            }
            for (i = 0; i < keysList.length; i += 1) {
                var kJs = Sk.ffi.remapToJs(keysList[i]);
                if (!fieldSet[kJs]) {
                    throw new Sk.builtin.ValueError("dict contains fields not in fieldnames: " + kJs);
                }
            }
        }

        var values = [];
        for (i = 0; i < self.fieldnames$.length; i += 1) {
            var key = new Sk.builtin.str(self.fieldnames$[i]);
            var val = _dictGet(rowDict, key);
            values.push(val === undefined ? self.restval$ : _pyFieldToStr(val));
        }
        var line = _formatRow(self.dialect, values);
        _writeToFile(self.csvfile$, line);
        return Sk.builtin.none.none$;
    });

    DictWriter.prototype["writerows"] = new Sk.builtin.func(function writerows(self, rows) {
        var arr = Sk.misceval.arrayFromIterable(rows, true);
        var i;
        for (i = 0; i < arr.length; i += 1) {
            Sk.misceval.callsimArray(DictWriter.prototype["writerow"], [self, arr[i]]);
        }
        return Sk.builtin.none.none$;
    });
    Sk.abstr.setUpSlots(DictWriter);

    mod.DictWriter = new Sk.builtin.func(function DictWriterCtor(kwa, csvfile, fieldnames, restval, extrasaction, dialect) {
        var split = _splitArgs(kwa, [csvfile, fieldnames, restval, extrasaction, dialect]);
        var kwargs = split.kwargs;
        csvfile = split.args[0];
        fieldnames = split.args[1];
        restval = split.args[2];
        extrasaction = split.args[3];
        dialect = split.args[4];
        if (fieldnames === undefined) {
            fieldnames = kwargs.fieldnames;
        }
        if (restval === undefined) {
            restval = kwargs.restval;
        }
        if (extrasaction === undefined) {
            extrasaction = kwargs.extrasaction;
        }
        if (dialect === undefined) {
            dialect = kwargs.dialect;
        }
        if (fieldnames === undefined) {
            throw new Sk.builtin.TypeError("DictWriter() missing required argument: 'fieldnames'");
        }
        var dialectParams = _resolveDialect(dialect, kwargs);
        var fnArr = Sk.misceval.arrayFromIterable(fieldnames, true);
        var fnJs = fnArr.map(function (s) {
            return Sk.ffi.remapToJs(s);
        });
        var extraJs = extrasaction === undefined ? "raise" : Sk.ffi.remapToJs(extrasaction);
        return new DictWriter(csvfile, fnJs, restval, extraJs, dialectParams);
    });
    mod.DictWriter.co_kwargs = true;

    // ─── діалекти ───────────────────────────────────────────────────────────

    mod.register_dialect = new Sk.builtin.func(function register_dialect(kwa, dname, dialect) {
        var split = _splitArgs(kwa, [dname, dialect]);
        var kwargs = split.kwargs;
        dname = split.args[0];
        dialect = split.args[1];
        if (dialect === undefined) {
            dialect = kwargs.dialect;
        }
        var nameJs = Sk.ffi.remapToJs(dname);
        _customDialects[nameJs] = _resolveDialect(dialect, kwargs);
        return Sk.builtin.none.none$;
    });
    mod.register_dialect.co_kwargs = true;

    mod.unregister_dialect = new Sk.builtin.func(function unregister_dialect(dname) {
        var nameJs = Sk.ffi.remapToJs(dname);
        delete _customDialects[nameJs];
        return Sk.builtin.none.none$;
    });

    mod.list_dialects = new Sk.builtin.func(function list_dialects() {
        var names = ["excel", "excel-tab", "unix"].concat(Object.keys(_customDialects));
        return new Sk.builtin.list(names.map(function (n) {
            return new Sk.builtin.str(n);
        }));
    });

    mod.get_dialect = new Sk.builtin.func(function get_dialect(dname) {
        var d = _resolveDialect(dname, {});
        var pyd = new Sk.builtin.dict([]);
        var k;
        for (k in d) {
            if (Object.prototype.hasOwnProperty.call(d, k)) {
                pyd.mp$ass_subscript(new Sk.builtin.str(k), Sk.ffi.remapToPy(d[k]));
            }
        }
        return pyd;
    });

    mod.field_size_limit = new Sk.builtin.func(function field_size_limit(new_limit) {
        return Sk.ffi.remapToPy(131072);
    });

    return mod;
};
