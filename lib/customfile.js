/**
 * @constructor
 * @param {Sk.builtin.str} name
 * @param {Sk.builtin.str} mode
 * @param {Object} buffering
 *
 * @todo - adjust this to be more inline with cpython implementation and use new api
 *
 * Патч підтримує три джерела файлів (пріоритет при читанні):
 *   1. PythonIDE.files[name]  — вкладки/модулі IDE (read-only, не змінюються при записі)
 *   2. DOM-елемент #name      — прихований <div> у body (синхронізується з jsfs при записі)
 *   3. fsToBrowse (jsfs)      — віртуальна ФС у localStorage
 *
 * При відкритті на запис ("w" / "a") та при кожному write():
 *   — дані записуються у jsfs через fsToBrowse.write() / fsToBrowse.append()
 *   — DOM-елемент #name синхронно оновлюється (або створюється)
 *   PythonIDE.files при цьому не змінюється.
 */

// ─── внутрішні хелпери ───────────────────────────────────────────────────────

/**
 * Записує content у fsToBrowse (jsfs / localStorage).
 *
 * @param {string}  name    — ім'я файлу (JS-рядок)
 * @param {string}  content — фрагмент або повний вміст
 * @param {boolean} append  — true → fsToBrowse.append, false → fsToBrowse.write
 */
function _writeJsfs(name, content, append) {
    if (typeof fsToBrowse === "undefined") return;
    try {
        if (append) {
            fsToBrowse.append(name, content);
        } else {
            fsToBrowse.write(name, content);
        }
    } catch (e) {
        console.warn("[customfile] jsfs write error:", e);
    }
}

/**
 * Оновлює або створює DOM-елемент #name з вказаним вмістом.
 * Використовується лише коли Sk.filewrite відсутній або при ініціалізації файлу.
 *
 * @param {string}  name    — ім'я файлу (JS-рядок)
 * @param {string}  content — фрагмент або повний вміст
 * @param {boolean} append  — true → дозаписати, false → перезаписати
 */
function _writeDom(name, content, append) {
    var existing = document.getElementById(name);
    if (existing) {
        if (existing.nodeName.toLowerCase() === "textarea") {
            existing.value = append ? (existing.value + content) : content;
        } else {
            existing.textContent = append ? (existing.textContent + content) : content;
        }
    } else {
        var div = document.createElement("div");
        div.id = name;
        div.textContent = content;
        div.style.display = "none";
        document.body.appendChild(div);
    }
}

/**
 * Синхронний подвійний запис: jsfs + DOM.
 * Викликається ТІЛЬКИ коли Sk.filewrite відсутній.
 * Якщо Sk.filewrite є — він сам оновлює DOM; ми оновлюємо лише jsfs.
 */
function _syncWriteBoth(name, content, append) {
    _writeJsfs(name, content, append);
    _writeDom(name, content, append);
}

// ─── конструктор ─────────────────────────────────────────────────────────────

Sk.builtin.file = function (name, mode, buffering) {
    var i;
    var elem;
    var lsfs;

    if (!(this instanceof Sk.builtin.file)) {
        return new Sk.builtin.file(name, mode, buffering);
    }

    this.mode = Sk.ffi.remapToJs(mode);
    this.name = Sk.ffi.remapToJs(name);
    this.closed = false;

    if (this.name === "/dev/stdout") {
        this.data$ = Sk.builtin.none.none$;
        this.fileno = 1;
    } else if (this.name === "/dev/stdin") {
        this.fileno = 0;
    } else if (this.name === "/dev/stderr") {
        this.fileno = 2;
    } else {
        if (Sk.inBrowser) {
            this.fileno = 10;
            lsfs = false;

            // ── Рівень 1: PythonIDE.files (вкладки/модулі IDE) ──────────────
            // Лише читання — не змінюємо PythonIDE.files при записі.
            // Якщо є вкладка з таким ім'ям — підкладаємо її у DOM.
            if (PythonIDE.files[name.v] != undefined) {
                if (document.getElementById(name.v)) {
                    document.getElementById(name.v).remove();
                }
                var divFile = document.createElement("div");
                divFile.id = name.v;
                divFile.textContent = PythonIDE.files[name.v];
                divFile.style.display = "none";
                document.body.appendChild(divFile);
            }

            // ── Рівень 2: DOM-елемент ────────────────────────────────────────
            elem = document.getElementById(name.v);

            // ── Рівень 3: jsfs (fsToBrowse) ─────────────────────────────────
            if (elem == null) {
                try {
                    console.log("Read");
                    this.data$ = fsToBrowse.read(this.name);
                    lsfs = true;
                } catch (err) {
                    lsfs = false;
                }
            }

            console.log("this DATA:", this.data$);

            // ── Визначення початкового вмісту ────────────────────────────────
            if (elem == null && lsfs === false) {
                // Файл не знайдено жодним способом
                if (mode.v === "w" || mode.v === "a") {
                    // Новий файл: створюємо порожній запис у jsfs.
                    // DOM не чіпаємо тут — Sk.filewrite оновить його при першому write(),
                    // або _syncWriteBoth зробить це якщо Sk.filewrite відсутній.
                    this.data$ = "";
                    _writeJsfs(this.name, "", false);
                } else {
                    throw new Sk.builtin.IOError(
                        "[Errno 2] No such file or directory: '" + name.v + "'"
                    );
                }
            } else {
                if (lsfs === false) {
                    // Дані прийшли з DOM (рівень 1 або 2)
                    if (elem.nodeName.toLowerCase() === "textarea") {
                        this.data$ = elem.value;
                    } else {
                        this.data$ = elem.textContent;
                    }
                }
                // lsfs === true → this.data$ вже встановлено вище через fsToBrowse.read()

                // При відкритті на запис ("w") — очищаємо буфер і jsfs.
                // DOM не чіпаємо тут — щоб Sk.filewrite (якщо він є) не дублював вміст.
                // Якщо Sk.filewrite відсутній — DOM оновиться при першому write().
                if (mode.v === "w") {
                    this.data$ = "";
                    _writeJsfs(this.name, "", false);
                }
                // При "a" — нічого не очищаємо, data$ вже містить поточний вміст
            }
        } else {
            this.fileno = 11;
            this.data$ = Sk.read(name.v);
        }

        this.lineList = this.data$.split("\n");
        // split("\n") додає порожній елемент в кінці масиву ТІЛЬКИ якщо
        // файл дійсно закінчується символом "\n" — цей "хвіст" прибираємо.
        // Якщо ж останній рядок не мав "\n" (типовий випадок для файлів,
        // введених у вкладках IDE), він лишається у lineList і нижче
        // отримує "\n" автоматично — так само, як і всі інші рядки.
        if (this.lineList.length && this.lineList[this.lineList.length - 1] === "") {
            this.lineList.pop();
        }

        for (i = 0; i < this.lineList.length; i++) {
            this.lineList[i] = this.lineList[i] + "\n";
        }
        this.currentLine = 0;
    }
    this.pos$ = 0;

    if (Sk.fileopen && this.fileno >= 10) {
        Sk.fileopen(this);
    }

    return this;
};

Sk.abstr.setUpInheritance("file", Sk.builtin.file, Sk.builtin.object);
Sk.abstr.setUpBuiltinMro(Sk.builtin.file);

Sk.builtin.file.prototype["$r"] = function () {
    return new Sk.builtin.str("<" +
        (this.closed ? "closed" : "open") +
        "file '" +
        this.name +
        "', mode '" +
        Sk.ffi.remapToJs(this.mode) +
        "'>");
};

Sk.builtin.file.prototype.tp$iter = function () {
    var allLines = this.lineList;
    var currentLine = this.currentLine;

    var ret = {
        tp$iter: function () { return ret; },
        $obj: this,
        $index: currentLine,
        $lines: allLines,
        tp$iternext: function () {
            if (ret.$obj.closed) {
                throw new Sk.builtin.ValueError("I/O operation on closed file");
            }
            if (ret.$index >= ret.$lines.length) { return undefined; }
            return new Sk.builtin.str(ret.$lines[ret.$index++]);
        }
    };
    return ret;
};

Sk.abstr.setUpSlots(Sk.builtin.file);

Sk.builtin.file.prototype["__enter__"] = new Sk.builtin.func(function __enter__(self) {
    return self;
});

Sk.builtin.file.prototype["__exit__"] = new Sk.builtin.func(function __exit__(self) {
    return Sk.misceval.callsimArray(Sk.builtin.file.prototype["close"], [self]);
});

Sk.builtin.file.prototype["close"] = new Sk.builtin.func(function close(self) {
    self.closed = true;
    return Sk.builtin.none.none$;
});

Sk.builtin.file.prototype["flush"] = new Sk.builtin.func(function flush(self) {
});

Sk.builtin.file.prototype["fileno"] = new Sk.builtin.func(function fileno(self) {
    return this.fileno;
}); // > 0, not 1/2/3

Sk.builtin.file.prototype["isatty"] = new Sk.builtin.func(function isatty(self) {
    return false;
});

Sk.builtin.file.prototype["read"] = new Sk.builtin.func(function read(self, size) {
    var ret;
    var len = self.data$.length;
    var l_size;
    if (self.closed) {
        throw new Sk.builtin.ValueError("I/O operation on closed file");
    }

    if (size === undefined) {
        l_size = len;
    } else {
        l_size = Sk.ffi.remapToJs(size);
    }

    ret = new Sk.builtin.str(self.data$.substr(self.pos$, l_size));
    if (size === undefined) {
        self.pos$ = len;
    } else {
        self.pos$ += Sk.ffi.remapToJs(size);
    }
    if (self.pos$ >= len) {
        self.pos$ = len;
    }

    return ret;
});

Sk.builtin.file.$readline = function (self, size, prompt) {
    if (self.closed) {
        throw new Sk.builtin.ValueError("I/O operation on closed file");
    }

    if (self.fileno === 0) {
        var x, susp;

        var lprompt = Sk.ffi.remapToJs(prompt);
        lprompt = lprompt ? lprompt : "";

        x = Sk.inputfun(lprompt);

        if (x instanceof Promise || (x && typeof x.then === "function")) {
            susp = new Sk.misceval.Suspension();

            susp.resume = function () {
                if (susp.data.error) { throw susp.data.error; }
                return new Sk.builtin.str(susp.data.result);
            };

            susp.data = {
                type: "Sk.promise",
                promise: x
            };

            return susp;
        } else {
            return new Sk.builtin.str(x);
        }
    } else {
        var line = "";
        if (self.currentLine < self.lineList.length) {
            line = self.lineList[self.currentLine];
            self.currentLine++;
        }
        return new Sk.builtin.str(line);
    }
};

Sk.builtin.file.prototype["readline"] = new Sk.builtin.func(function readline(self, size) {
    return Sk.builtin.file.$readline(self, size, undefined);
});

Sk.builtin.file.prototype["readlines"] = new Sk.builtin.func(function readlines(self, sizehint) {
    if (self.closed) {
        throw new Sk.builtin.ValueError("I/O operation on closed file");
    }

    if (self.fileno === 0) {
        return new Sk.builtin.NotImplementedError(
            "readlines isn't implemented because the web doesn't support Ctrl+D"
        );
    }

    var i;
    var arr = [];
    for (i = self.currentLine; i < self.lineList.length; i++) {
        arr.push(new Sk.builtin.str(self.lineList[i]));
    }
    return new Sk.builtin.list(arr);
});

Sk.builtin.file.prototype["seek"] = new Sk.builtin.func(function seek(self, offset, whence) {
    var l_offset = Sk.ffi.remapToJs(offset);

    if (whence === undefined) { whence = 0; }
    if (whence === 0) {
        self.pos$ = l_offset;
    } else if (whence == 1) {
        self.pos$ = self.data$.length + l_offset;
    } else if (whence == 2) {
        self.pos$ = self.data$.length + l_offset;
    }

    return Sk.builtin.none.none$;
});

Sk.builtin.file.prototype["tell"] = new Sk.builtin.func(function tell(self) {
    return Sk.ffi.remapToPy(self.pos$);
});

Sk.builtin.file.prototype["truncate"] = new Sk.builtin.func(function truncate(self, size) {
    Sk.asserts.fail();
});

/**
 * write(str) — запис рядка у файл.
 *
 * Для fileno === 1 (/dev/stdout): поведінка незмінна.
 * Для решти файлів ("w" / "a"):
 *   — якщо є Sk.filewrite — викликаємо його (зовнішній хук IDE)
 *   — після цього (або замість Sk.asserts.fail) синхронно пишемо у jsfs і DOM.
 *
 * Внутрішній буфер self.data$ також оновлюється, щоб подальші read() бачили
 * актуальні дані в рамках одного сеансу відкритого файлу.
 */
Sk.builtin.file.prototype["write"] = new Sk.builtin.func(function write(self, str) {
    var mode = Sk.ffi.remapToJs(self.mode);

    if (mode === "w" || mode === "wb" || mode === "a" || mode === "ab") {
        if (self.closed) {
            throw new Sk.builtin.ValueError("I/O operation on closed file");
        }

        var jsStr = Sk.ffi.remapToJs(str);

        if (self.fileno === 1) {
            // stdout — виводимо у консоль IDE, нічого не зберігаємо
            Sk.output(jsStr);
        } else {
            var isAppend = (mode === "a" || mode === "ab");

            if (Sk.filewrite) {
                // ── Sk.filewrite є (PythonIDE.writeFile) ────────────────────
                // Він сам:
                //   • оновлює self.data$ (append фрагменту)
                //   • оновлює self.pos$
                //   • зберігає у PythonIDE.files (вкладка IDE / DOM)
                // Нам залишається лише продублювати результат у jsfs.
                Sk.filewrite(self, str);
                // self.data$ вже оновлений всередині Sk.filewrite — пишемо його у jsfs
                _writeJsfs(self.name, self.data$, false);
            } else {
                // ── Sk.filewrite відсутній — робимо все самостійно ───────────
                if (isAppend) {
                    self.data$ = (self.data$ || "") + jsStr;
                } else {
                    var before = self.data$.substr(0, self.pos$);
                    var after  = self.data$.substr(self.pos$ + jsStr.length);
                    self.data$ = before + jsStr + after;
                }
                self.pos$ += jsStr.length;
                // Пишемо повний self.data$ у jsfs і DOM
                _writeJsfs(self.name, self.data$, false);
                _writeDom(self.name, self.data$, false);
            }
        }
    } else {
        throw new Sk.builtin.IOError("File not open for writing");
    }

    return Sk.builtin.none.none$;
});


Sk.exportSymbol("Sk.builtin.file", Sk.builtin.file);

// ─── Патч open(): підтримка keyword-аргументів ──────────────────────────────
// Стандартний Skulpt-builtin open() приймає лише позиційні (file, mode,
// buffering) і кидає "TypeError: open() takes no keyword arguments" на будь-
// який keyword, хоча справжній Python open() підтримує encoding=, errors=,
// newline=, closefd=, opener=. Ми не змінюємо кодування вручну (рядки в
// Skulpt і так JS-рядки/UTF-16) — ці keyword-и приймаються лише заради
// сумісності з кодом, який їх передає, і ігноруються.
var _patchedOpen = function (kwa, file, mode, buffering) {
    var kwargs = {};
    if (kwa && kwa.length) {
        for (var i = 0; i < kwa.length; i += 2) {
            kwargs[Sk.ffi.remapToJs(kwa[i])] = kwa[i + 1];
        }
    }

    if (file === undefined) { file = kwargs["file"]; }
    if (mode === undefined) { mode = kwargs["mode"]; }
    if (buffering === undefined) { buffering = kwargs["buffering"]; }
    // encoding / errors / newline / closefd / opener навмисно ігноруються

    if (mode === undefined) {
        mode = new Sk.builtin.str("r");
    }

    return new Sk.builtin.file(file, mode, buffering);
};
_patchedOpen.co_kwargs = true;

Sk.builtin.open = new Sk.builtin.func(_patchedOpen);
Sk.exportSymbol("Sk.builtin.open", Sk.builtin.open);

// Реєстр вбудованих імен буває під різними ключами залежно від збірки Skulpt —
// оновлюємо всі, де вони існують, щоб патч гарантовано підхопився.
if (typeof Sk.builtins === "object" && Sk.builtins !== null) {
    Sk.builtins["open"] = Sk.builtin.open;
}
if (Sk.builtin.globals && typeof Sk.builtin.globals === "object") {
    Sk.builtin.globals["open"] = Sk.builtin.open;
}
