/**
 * os — повноцінна реалізація стандартної бібліотеки os для Skulpt
 * Використовує віртуальну файлову систему jsfs (window.FileSystem / Sk.__jsfs)
 *
 * Підтримувані функції та атрибути:
 *   os.sep, os.curdir, os.pardir, os.linesep, os.name
 *   os.getcwd(), os.chdir(path)
 *   os.listdir(path?)
 *   os.mkdir(path), os.makedirs(path)
 *   os.rmdir(path), os.removedirs(path)
 *   os.remove(path) / os.unlink(path)
 *   os.rename(src, dst)
 *   os.path.join(*parts), os.path.split(path), os.path.splitext(path)
 *   os.path.basename(path), os.path.dirname(path)
 *   os.path.exists(path), os.path.isfile(path), os.path.isdir(path)
 *   os.path.abspath(path)
 *   os.stat(path) → stat_result (st_size, st_mode)
 *   os.getenv(key, default?) / os.environ
 *   os.urandom(n) → bytes
 */

var $builtinmodule = function (name) {

    // ─── helpers ────────────────────────────────────────────────────────────

    /** Повертає ініціалізовану файлову систему */
    function getFS() {
        if (!Sk.__jsfs) {
            Sk.__jsfs = new window.FileSystem("epythonfs");
        }
        return Sk.__jsfs;
    }

    /** Перекидає JS-рядок або Python-рядок у JS-рядок */
    function jsStr(pyObj) {
        if (typeof pyObj === 'string') return pyObj;
        if (pyObj && pyObj.v !== undefined) return String(pyObj.v);
        return String(Sk.ffi.remapToJs(pyObj));
    }

    /** OSError — будуємо як підклас IOError (Skulpt 1.3) */
    var OSError = Sk.misceval.buildClass(
        Sk.builtins,
        function($gbl, $loc) {
            $loc.__init__ = new Sk.builtin.func(function(self, msg) {
                self.args = new Sk.builtin.tuple([msg !== undefined ? msg : new Sk.builtin.str('')]);
                self.msg  = msg !== undefined ? msg : new Sk.builtin.str('');
            });
            $loc.__str__ = new Sk.builtin.func(function(self) {
                return self.msg instanceof Sk.builtin.str ? self.msg : new Sk.builtin.str(String(self.msg));
            });
        },
        'OSError',
        [Sk.builtin.IOError]
    );

    function osError(msg) {
        throw Sk.misceval.callsim(OSError, new Sk.builtin.str(msg));
    }

    /** Нормалізує шлях: прибирає зайві '/', вирішує '..' та '.' */
    function normpath(p) {
        if (!p || p === '') return '.';
        var fs = getFS();
        // використовуємо внутрішній toCanonicalPath через separate
        // але окремо — просто власна реалізація для читабельності
        var abs = (p[0] === '/');
        var parts = p.split('/').filter(Boolean);
        var stack = [];
        for (var i = 0; i < parts.length; i++) {
            var s = parts[i];
            if (s === '.') continue;
            if (s === '..') { if (stack.length) stack.pop(); }
            else stack.push(s);
        }
        var result = stack.join('/');
        if (abs) result = '/' + result;
        return result || (abs ? '/' : '.');
    }

    /** Перетворює відносний шлях у абсолютний відносно cwd */
    function toAbsolute(p) {
        if (!p || p === '.') return getFS().getCwd();
        if (p[0] === '/') return normpath(p);
        return normpath(getFS().getCwd() + '/' + p);
    }

    // ─── stat_result ────────────────────────────────────────────────────────

    /**
     * Мінімальна реалізація os.stat_result
     * Повертає Skulpt-об'єкт з атрибутами st_size, st_mode, st_ino тощо
     */
    function makeStat(size, isDir) {
        var S_IFDIR = 0o040000;
        var S_IFREG = 0o100000;
        var S_IRWXU = 0o0700;
        var mode = (isDir ? S_IFDIR : S_IFREG) | S_IRWXU;
        var obj = new Sk.builtin.object();
        obj.tp$name = 'os.stat_result';
        obj.st_mode  = new Sk.builtin.int_(mode);
        obj.st_ino   = new Sk.builtin.int_(0);
        obj.st_dev   = new Sk.builtin.int_(0);
        obj.st_nlink = new Sk.builtin.int_(1);
        obj.st_uid   = new Sk.builtin.int_(0);
        obj.st_gid   = new Sk.builtin.int_(0);
        obj.st_size  = new Sk.builtin.int_(size >= 0 ? size : 0);
        obj.st_atime = new Sk.builtin.float_(0);
        obj.st_mtime = new Sk.builtin.float_(0);
        obj.st_ctime = new Sk.builtin.float_(0);
        obj['$d'] = {
            st_mode:  obj.st_mode,
            st_ino:   obj.st_ino,
            st_dev:   obj.st_dev,
            st_nlink: obj.st_nlink,
            st_uid:   obj.st_uid,
            st_gid:   obj.st_gid,
            st_size:  obj.st_size,
            st_atime: obj.st_atime,
            st_mtime: obj.st_mtime,
            st_ctime: obj.st_ctime,
        };
        return obj;
    }

    // ─── os.path module ─────────────────────────────────────────────────────

    // ─── os.path як Sk.builtin.module ──────────────────────────────────────────
    var path_module = new Sk.builtin.module();
    path_module.$d = {
        __name__: new Sk.builtin.str('posixpath'),
        sep:      new Sk.builtin.str('/'),
        curdir:   new Sk.builtin.str('.'),
        pardir:   new Sk.builtin.str('..'),

        join: new Sk.builtin.func(function () {
            var args = Array.prototype.slice.call(arguments);
            if (args.length === 0) return new Sk.builtin.str('');
            var parts = args.map(jsStr);
            var result = parts[0];
            for (var i = 1; i < parts.length; i++) {
                var p = parts[i];
                if (p[0] === '/') { result = p; }
                else if (result === '' || result[result.length - 1] === '/') { result = result + p; }
                else { result = result + '/' + p; }
            }
            return new Sk.builtin.str(result);
        }),

        split: new Sk.builtin.func(function (pyPath) {
            var p = jsStr(pyPath);
            var idx = p.lastIndexOf('/');
            if (idx === -1) return new Sk.builtin.tuple([new Sk.builtin.str(''), new Sk.builtin.str(p)]);
            var head = p.slice(0, idx) || '/';
            var tail = p.slice(idx + 1);
            return new Sk.builtin.tuple([new Sk.builtin.str(head), new Sk.builtin.str(tail)]);
        }),

        splitext: new Sk.builtin.func(function (pyPath) {
            var p = jsStr(pyPath);
            var base = p.lastIndexOf('/') >= 0 ? p.slice(p.lastIndexOf('/') + 1) : p;
            var dot = base.lastIndexOf('.');
            if (dot <= 0) return new Sk.builtin.tuple([new Sk.builtin.str(p), new Sk.builtin.str('')]);
            var extStart = p.length - (base.length - dot);
            return new Sk.builtin.tuple([
                new Sk.builtin.str(p.slice(0, extStart)),
                new Sk.builtin.str(p.slice(extStart))
            ]);
        }),

        basename: new Sk.builtin.func(function (pyPath) {
            var p = jsStr(pyPath);
            var idx = p.lastIndexOf('/');
            return new Sk.builtin.str(idx === -1 ? p : p.slice(idx + 1));
        }),

        dirname: new Sk.builtin.func(function (pyPath) {
            var p = jsStr(pyPath);
            var idx = p.lastIndexOf('/');
            if (idx === -1) return new Sk.builtin.str('');
            return new Sk.builtin.str(idx === 0 ? '/' : p.slice(0, idx));
        }),

        abspath: new Sk.builtin.func(function (pyPath) {
            return new Sk.builtin.str(toAbsolute(jsStr(pyPath)));
        }),

        normpath: new Sk.builtin.func(function (pyPath) {
            return new Sk.builtin.str(normpath(jsStr(pyPath)));
        }),

        exists: new Sk.builtin.func(function (pyPath) {
            var t = getFS().type(jsStr(pyPath));
            return new Sk.builtin.bool(t !== null);
        }),

        isfile: new Sk.builtin.func(function (pyPath) {
            return new Sk.builtin.bool(getFS().type(jsStr(pyPath)) === 'file');
        }),

        isdir: new Sk.builtin.func(function (pyPath) {
            var p = jsStr(pyPath);
            if (p === '/' || p === '') return Sk.builtin.bool.true$;
            return new Sk.builtin.bool(getFS().type(p) === 'folder');
        }),

        isabs: new Sk.builtin.func(function (pyPath) {
            return new Sk.builtin.bool(jsStr(pyPath)[0] === '/');
        }),

        getsize: new Sk.builtin.func(function (pyPath) {
            var p = jsStr(pyPath);
            var sz = getFS().size(p);
            if (sz < 0) osError("No such file: " + p);
            return new Sk.builtin.int_(sz);
        }),

        realpath: new Sk.builtin.func(function (pyPath) {
            return new Sk.builtin.str(toAbsolute(jsStr(pyPath)));
        }),

        commonpath: new Sk.builtin.func(function (pyPaths) {
            var paths = Sk.ffi.remapToJs(pyPaths).map(function(p) { return normpath(p); });
            if (!paths.length) osError("commonpath() arg is an empty sequence");
            var parts = paths.map(function(p) { return p.split('/').filter(Boolean); });
            var common = parts[0];
            for (var i = 1; i < parts.length; i++) {
                var newCommon = [];
                for (var j = 0; j < Math.min(common.length, parts[i].length); j++) {
                    if (common[j] === parts[i][j]) newCommon.push(common[j]);
                    else break;
                }
                common = newCommon;
            }
            return new Sk.builtin.str('/' + common.join('/'));
        }),
    };

    // ─── os.environ ─────────────────────────────────────────────────────────

    // Імітація словника середовища
    var _environ = {};
    var environ_obj = new Sk.builtin.dict([]);
    // Кілька типових змінних
    var _defaultEnv = { PATH: '/usr/bin:/bin', HOME: '/', LANG: 'uk_UA.UTF-8' };
    for (var _k in _defaultEnv) {
        environ_obj.mp$ass_subscript(new Sk.builtin.str(_k), new Sk.builtin.str(_defaultEnv[_k]));
    }

    // ─── головний модуль ────────────────────────────────────────────────────

    var mod = {};

    // Константи
    mod.sep     = new Sk.builtin.str('/');
    mod.altsep  = Sk.builtin.none.none$;
    mod.curdir  = new Sk.builtin.str('.');
    mod.pardir  = new Sk.builtin.str('..');
    mod.extsep  = new Sk.builtin.str('.');
    mod.linesep = new Sk.builtin.str('\n');
    Object.defineProperty(mod, 'name', {
        value: new Sk.builtin.str('posix'),
        writable: true, enumerable: true, configurable: true
    });
    mod.environ = environ_obj;
    mod.path    = path_module;

    // ── os.getcwd() ─────────────────────────────────────────────────────────
    mod.getcwd = new Sk.builtin.func(function () {
        return new Sk.builtin.str(getFS().getCwd());
    });

    mod.getcwdb = mod.getcwd; // bytes variant — повертаємо str для простоти

    // ── os.chdir(path) ──────────────────────────────────────────────────────
    mod.chdir = new Sk.builtin.func(function (pyPath) {
        var p = jsStr(pyPath);
        var fs = getFS();
        var result = fs.cd(p);
        if (result === undefined) {
            osError("No such file or directory: '" + p + "'");
        }
        return Sk.builtin.none.none$;
    });

    // ── os.listdir(path='.') ────────────────────────────────────────────────
    mod.listdir = new Sk.builtin.func(function (pyPath) {
        var p = pyPath ? jsStr(pyPath) : '.';
        var fs = getFS();
        var entries;
        try {
            entries = fs.ls(p, 'all');
        } catch (e) {
            osError("No such file or directory: '" + p + "'");
        }
        var pyList = entries.map(function (n) { return new Sk.builtin.str(n); });
        return new Sk.builtin.list(pyList);
    });

    // ── os.mkdir(path) ──────────────────────────────────────────────────────
    mod.mkdir = new Sk.builtin.func(function (pyPath, pyMode) {
        var p = jsStr(pyPath);
        var fs = getFS();
        // Перевіримо, чи батьківська директорія існує
        var parent = p.lastIndexOf('/') > 0 ? p.slice(0, p.lastIndexOf('/')) : '/';
        if (fs.type(parent) !== 'folder' && parent !== '/') {
            osError("No such file or directory: '" + p + "'");
        }
        if (fs.type(p) !== null) {
            osError("File exists: '" + p + "'");
        }
        var ok = fs.mkdir(p);
        if (!ok) osError("Cannot create directory: '" + p + "'");
        return Sk.builtin.none.none$;
    });

    // ── os.makedirs(path) ───────────────────────────────────────────────────
    mod.makedirs = new Sk.builtin.func(function (pyPath, pyMode, pyExistOk) {
        var p = jsStr(pyPath);
        var existOk = pyExistOk ? Sk.misceval.isTrue(pyExistOk) : false;
        var fs = getFS();
        if (fs.type(p) === 'folder') {
            if (!existOk) osError("File exists: '" + p + "'");
            return Sk.builtin.none.none$;
        }
        // mkdir рекурсивно створює всі рівні
        fs.mkdir(p);
        return Sk.builtin.none.none$;
    });

    // ── os.rmdir(path) ──────────────────────────────────────────────────────
    mod.rmdir = new Sk.builtin.func(function (pyPath) {
        var p = jsStr(pyPath);
        var fs = getFS();
        if (fs.type(p) !== 'folder') {
            osError("No such file or directory: '" + p + "'");
        }
        // Перевіримо, що директорія порожня
        var entries = fs.ls(p, 'all');
        if (entries.length > 0) {
            osError("Directory not empty: '" + p + "'");
        }
        var ok = fs.rm(p);
        if (!ok) osError("Cannot remove directory: '" + p + "'");
        return Sk.builtin.none.none$;
    });

    // ── os.removedirs(path) — видаляє порожні директорії рекурсивно вгору ──
    mod.removedirs = new Sk.builtin.func(function (pyPath) {
        var p = jsStr(pyPath);
        var fs = getFS();
        // Видаляємо саму директорію і потім батьківські, доки вони порожні
        var current = normpath(p);
        while (current && current !== '/' && current !== '.') {
            if (fs.type(current) !== 'folder') break;
            var entries = fs.ls(current, 'all');
            if (entries.length > 0) break;
            fs.rm(current);
            var idx = current.lastIndexOf('/');
            current = idx > 0 ? current.slice(0, idx) : '/';
        }
        return Sk.builtin.none.none$;
    });

    // ── os.remove(path) / os.unlink(path) ───────────────────────────────────
    var _remove = new Sk.builtin.func(function (pyPath) {
        var p = jsStr(pyPath);
        var fs = getFS();
        if (fs.type(p) !== 'file') {
            osError("No such file or directory: '" + p + "'");
        }
        var ok = fs.rm(p);
        if (!ok) osError("Cannot remove file: '" + p + "'");
        return Sk.builtin.none.none$;
    });
    mod.remove = _remove;
    mod.unlink = _remove;

    // ── os.rename(src, dst) ─────────────────────────────────────────────────
    mod.rename = new Sk.builtin.func(function (pySrc, pyDst) {
        var src = jsStr(pySrc);
        var dst = jsStr(pyDst);
        var fs = getFS();
        if (fs.type(src) === null) {
            osError("No such file or directory: '" + src + "'");
        }
        try {
            fs.mv(src, dst);
        } catch (e) {
            osError(e.message || "rename failed");
        }
        return Sk.builtin.none.none$;
    });

    // ── os.replace(src, dst) — alias для rename (перезаписує dst) ───────────
    mod.replace = mod.rename;

    // ── os.stat(path) ───────────────────────────────────────────────────────
    mod.stat = new Sk.builtin.func(function (pyPath) {
        var p = jsStr(pyPath);
        var fs = getFS();
        var t = fs.type(p);
        if (t === null) {
            osError("No such file or directory: '" + p + "'");
        }
        var isDir = (t === 'folder');
        var size = isDir ? 0 : fs.size(p);
        return makeStat(size, isDir);
    });

    // ── os.lstat — те ж саме (симлінків немає у jsfs) ───────────────────────
    mod.lstat = mod.stat;

    // ── os.getenv(key, default=None) ────────────────────────────────────────
    mod.getenv = new Sk.builtin.func(function (pyKey, pyDefault) {
        var key = jsStr(pyKey);
        var envVal = environ_obj.mp$subscript(new Sk.builtin.str(key));
        if (envVal !== undefined) return envVal;
        return pyDefault !== undefined ? pyDefault : Sk.builtin.none.none$;
    });

    // ── os.putenv(key, value) ────────────────────────────────────────────────
    mod.putenv = new Sk.builtin.func(function (pyKey, pyVal) {
        environ_obj.mp$ass_subscript(pyKey, pyVal);
        return Sk.builtin.none.none$;
    });

    // ── os.urandom(n) → bytes ────────────────────────────────────────────────
    mod.urandom = new Sk.builtin.func(function (pyN) {
        var n = Sk.ffi.remapToJs(pyN);
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            var buf = new Uint8Array(n);
            window.crypto.getRandomValues(buf);
            return new Sk.builtin.bytes(Array.from(buf));
        }
        // fallback
        var arr = [];
        for (var i = 0; i < n; i++) arr.push(Math.floor(Math.random() * 256));
        return new Sk.builtin.bytes(arr);
    });

    // ── os.strerror(code) ────────────────────────────────────────────────────
    mod.strerror = new Sk.builtin.func(function (pyCode) {
        var code = Sk.ffi.remapToJs(pyCode);
        var table = { 1:'Operation not permitted', 2:'No such file or directory',
                      13:'Permission denied', 17:'File exists', 20:'Not a directory',
                      21:'Is a directory', 22:'Invalid argument', 28:'No space left on device' };
        return new Sk.builtin.str(table[code] || 'Unknown error ' + code);
    });

    // ── os.cpu_count() ───────────────────────────────────────────────────────
    mod.cpu_count = new Sk.builtin.func(function () {
        var n = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 1;
        return new Sk.builtin.int_(n);
    });

    // ── os.getpid() ──────────────────────────────────────────────────────────
    mod.getpid = new Sk.builtin.func(function () {
        return new Sk.builtin.int_(1);
    });

    // ── os.getlogin() ────────────────────────────────────────────────────────
    mod.getlogin = new Sk.builtin.func(function () {
        return new Sk.builtin.str('user');
    });

    // ── os.system(cmd) — заглушка ────────────────────────────────────────────
    mod.system = new Sk.builtin.func(function (pyCmd) {
        console.warn('[os.system] not supported in browser:', jsStr(pyCmd));
        return new Sk.builtin.int_(1);
    });

    // ── os.walk(top, topdown=True) ───────────────────────────────────────────
    // Генераторна семантика через список (Skulpt не підтримує справжні генератори тут)
    mod.walk = new Sk.builtin.func(function (pyTop, pyTopdown) {
        var top = jsStr(pyTop);
        var topdown = (pyTopdown === undefined) ? true : Sk.misceval.isTrue(pyTopdown);
        var fs = getFS();
        var results = [];

        function _walk(dirPath) {
            var entries;
            try { entries = fs.ls(dirPath, 'all'); } catch (e) { return; }
            var dirs = [], files = [];
            entries.forEach(function (e) {
                var full = (dirPath === '/' ? '' : dirPath) + '/' + e;
                var t = fs.type(full);
                if (t === 'folder') dirs.push(e);
                else if (t === 'file') files.push(e);
            });
            var pyDirs  = new Sk.builtin.list(dirs.map(function (d) { return new Sk.builtin.str(d); }));
            var pyFiles = new Sk.builtin.list(files.map(function (f) { return new Sk.builtin.str(f); }));
            var triple = new Sk.builtin.tuple([new Sk.builtin.str(dirPath), pyDirs, pyFiles]);
            if (topdown) results.push(triple);
            dirs.forEach(function (d) {
                _walk((dirPath === '/' ? '' : dirPath) + '/' + d);
            });
            if (!topdown) results.push(triple);
        }

        _walk(normpath(top));
        return new Sk.builtin.list(results);
    });

    // ── DirEntry та ScandirIterator через Sk.misceval.buildClass ────────────

    var DirEntryClass = Sk.misceval.buildClass({}, function($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function(self, name, fullPath, entryType, fs) {
            self._name     = Sk.ffi.remapToJs(name);
            self._path     = Sk.ffi.remapToJs(fullPath);
            self._type     = Sk.ffi.remapToJs(entryType);
            self._fs       = fs;  // передаємо як JS-значення через tp$name
        });
        $loc.__repr__ = new Sk.builtin.func(function(self) {
            return new Sk.builtin.str("<DirEntry " + self._name + ">");
        });
        $loc.__str__ = $loc.__repr__;
        $loc.name = new Sk.builtin.property(new Sk.builtin.func(function(self) {
            return new Sk.builtin.str(self._name);
        }));
        $loc.path = new Sk.builtin.property(new Sk.builtin.func(function(self) {
            return new Sk.builtin.str(self._path);
        }));
        $loc.is_file = new Sk.builtin.func(function(self) {
            return new Sk.builtin.bool(self._type === 'file');
        });
        $loc.is_dir = new Sk.builtin.func(function(self) {
            return new Sk.builtin.bool(self._type === 'folder');
        });
        $loc.is_symlink = new Sk.builtin.func(function(self) {
            return Sk.builtin.bool.false$;
        });
        $loc.stat = new Sk.builtin.func(function(self) {
            var sz = self._type === 'file' ? self._fs.size(self._path) : 0;
            return makeStat(sz, self._type === 'folder');
        });
    }, 'DirEntry', []);

    function makeDirEntry(name, fullPath, entryType, fs) {
        var obj = Sk.misceval.callsim(DirEntryClass,
            new Sk.builtin.str(name),
            new Sk.builtin.str(fullPath),
            new Sk.builtin.str(entryType),
            Sk.builtin.none.none$  // placeholder
        );
        // fs не можна передати через Skulpt — зберігаємо напряму
        obj._fs = fs;
        obj._name = name;
        obj._path = fullPath;
        obj._type = entryType;
        return obj;
    }

    var ScandirIterClass = Sk.misceval.buildClass({}, function($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function(self) {
            self._index  = 0;
            self._closed = false;
            // _entries встановлюється ззовні після callsim
        });
        $loc.__enter__ = new Sk.builtin.func(function(self) {
            return self;
        });
        $loc.__exit__ = new Sk.builtin.func(function(self, exc_type, exc_val, exc_tb) {
            self._closed = true;
            return Sk.builtin.bool.false$;
        });
        $loc.close = new Sk.builtin.func(function(self) {
            self._closed = true;
            return Sk.builtin.none.none$;
        });
        $loc.__iter__ = new Sk.builtin.func(function(self) {
            return self;
        });
        $loc.__next__ = new Sk.builtin.func(function(self) {
            if (self._closed || self._index >= self._entries.length) {
                throw new Sk.builtin.StopIteration();
            }
            return self._entries[self._index++];
        });
    }, 'ScandirIterator', []);

    // ── os.scandir(path='.') ─────────────────────────────────────────────────
    mod.scandir = new Sk.builtin.func(function (pyPath) {
        var p = pyPath ? jsStr(pyPath) : '.';
        var fs = getFS();
        var entries;
        try { entries = fs.ls(p, 'all'); } catch (e) {
            osError("No such file or directory: '" + p + "'");
        }
        var base = normpath(p);
        var dirEntries = entries.map(function (name) {
            var full = (base === '/' ? '' : base) + '/' + name;
            var t = fs.type(full) || 'file';
            return makeDirEntry(name, full, t, fs);
        });
        var iter = Sk.misceval.callsim(ScandirIterClass);
        iter._entries = dirEntries;
        return iter;
    });

    // ── os.SEEK_SET / SEEK_CUR / SEEK_END ────────────────────────────────────
    mod.SEEK_SET = new Sk.builtin.int_(0);
    mod.SEEK_CUR = new Sk.builtin.int_(1);
    mod.SEEK_END = new Sk.builtin.int_(2);

    // ── os.error → OSError alias ─────────────────────────────────────────────
    mod.error   = OSError;
    mod.OSError = OSError;

    return mod;
};
