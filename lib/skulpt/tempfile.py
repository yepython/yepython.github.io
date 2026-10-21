"""tempfile — створення тимчасових файлів і каталогів.

Обмежена реалізація для Skulpt/IDE. Тимчасові файли живуть у віртуальній
файловій системі IDE (jsfs) і не потрапляють у список файлів проєкту.
Файли, створені з delete=True (типово), видаляються після close().

Підтримуваний API (як у CPython):
    NamedTemporaryFile, TemporaryFile, SpooledTemporaryFile,
    mkstemp, mkdtemp, mktemp, gettempdir, gettempprefix, tempdir, TMP_MAX
"""

import os

__all__ = [
    "NamedTemporaryFile",
    "TemporaryFile",
    "SpooledTemporaryFile",
    "mkstemp",
    "mkdtemp",
    "mktemp",
    "gettempdir",
    "gettempprefix",
    "tempdir",
    "TMP_MAX",
]

_tempdir = "/tmp"
_tempprefix = "tmp"
_counter = [0]

try:
    _bytes_type = bytes
except NameError:  # Skulpt може не мати bytes
    _bytes_type = None

# Як у CPython: None означає "використовувати типовий каталог".
tempdir = None

TMP_MAX = 10000


def gettempdir():
    """Каталог, у якому створюються тимчасові файли."""
    return _tempdir


def gettempprefix():
    """Префікс імен тимчасових файлів."""
    return _tempprefix


def _ensure_tempdir():
    """Створює каталог тимчасових файлів у віртуальній файловій системі."""
    try:
        os.mkdir(_tempdir)
    except Exception:
        pass


_ensure_tempdir()


def _normalize_mode(mode):
    """Переводить режим CPython ('w+b', 'rb', ...) у режим, який підтримує
    файловий об'єкт Skulpt ('w', 'r', 'a')."""
    if mode is None:
        return "w"
    m = str(mode)
    if "a" in m:
        return "a"
    if "w" in m:
        return "w"
    if "r" in m:
        return "r"
    return "w"


def _random_suffix():
    """Випадковий суфікс імені (як у CPython — 8 символів)."""
    try:
        return os.urandom(4).hex()
    except Exception:
        return str(_counter[0])


def _make_name(prefix, suffix, dir):
    _counter[0] += 1
    d = dir if dir else _tempdir
    if not d.endswith("/"):
        d = d + "/"
    pfx = prefix if prefix is not None else _tempprefix
    sfx = suffix if suffix is not None else ""
    return "%s%s%s%s" % (d, pfx, _random_suffix(), sfx)


class _TempFile:
    """Файл-обгортка: як об'єкт tempfile.NamedTemporaryFile у CPython."""

    def __init__(self, file, name, mode="w+b", delete=True):
        self._file = file
        self.name = name
        self.mode = mode
        self.delete = delete
        self._closed = False

    # --- власні методи ---
    def read(self, size=-1):
        if size is None or size < 0:
            return self._file.read()
        return self._file.read(size)

    def readline(self, size=-1):
        return self._file.readline(size)

    def readlines(self, hint=-1):
        return self._file.readlines(hint)

    def write(self, data):
        if _bytes_type is not None and isinstance(data, _bytes_type):
            data = data.decode("latin-1")
        return self._file.write(data)

    def seek(self, offset, whence=0):
        return self._file.seek(offset, whence)

    def tell(self):
        return self._file.tell()

    def flush(self):
        return self._file.flush()

    def fileno(self):
        return self._file.fileno()

    def isatty(self):
        return False

    @property
    def closed(self):
        return self._closed

    def close(self):
        if not self._closed:
            try:
                self._file.close()
            finally:
                self._closed = True
                if self.delete:
                    try:
                        os.remove(self.name)
                    except Exception:
                        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_tb):
        self.close()
        return False

    def __iter__(self):
        return iter(self._file)

    def __getattr__(self, name):
        # решта атрибутів — прямому файлу (mode, name тощо)
        return getattr(self._file, name)


def NamedTemporaryFile(mode="w+b", buffering=-1, encoding=None, newline=None,
                       suffix="", prefix=None, dir=None, delete=True, **kwargs):
    """Створює тимчасовий файл. Повертає файл-об'єкт із атрибутом .name."""
    name = _make_name(prefix, suffix, dir)
    file = open(name, _normalize_mode(mode))
    if _normalize_mode(mode) == "w":
        # створюємо порожній файл одразу, щоб він існував у файловій системі
        try:
            file.write("")
        except Exception:
            pass
    return _TempFile(file, name, mode, delete)


def TemporaryFile(mode="w+b", buffering=-1, encoding=None, newline=None,
                  suffix="", prefix=None, dir=None, **kwargs):
    """Як NamedTemporaryFile, але файл без імені (видаляється при закритті)."""
    tmp = NamedTemporaryFile(mode, buffering, encoding, newline, suffix, prefix,
                             dir, True, **kwargs)
    return tmp


class SpooledTemporaryFile:
    """Простий аналог SpooledTemporaryFile: дані тримаються в пам'яті, поки
    не стане потрібним реальний файл."""

    def __init__(self, max_size=0, mode="w+b", buffering=-1, encoding=None,
                 newline=None, suffix="", prefix=None, dir=None, **kwargs):
        self._max_size = max_size
        self._mode = mode
        self._buffer = []
        self._size = 0
        self._rolled = False
        self._file = None
        self._closed = False
        self._name = None
        self.name = "<closed>" if False else None

    def _roll(self):
        if self._rolled:
            return
        self._file = NamedTemporaryFile(self._mode, suffix="", prefix=None,
                                        dir=None, delete=True)
        self.name = self._file.name
        for chunk in self._buffer:
            self._file.write(chunk)
        self._buffer = []
        self._rolled = True

    def write(self, data):
        if self._closed:
            raise ValueError("I/O operation on closed file")
        if _bytes_type is not None and isinstance(data, _bytes_type):
            data = data.decode("latin-1")
        if self._rolled:
            return self._file.write(data)
        self._buffer.append(data)
        self._size += len(data)
        if self._max_size and self._size > self._max_size:
            self._roll()
        return len(data)

    def read(self, size=-1):
        self._roll()
        return self._file.read(size)

    def readline(self, size=-1):
        self._roll()
        return self._file.readline(size)

    def readlines(self, hint=-1):
        self._roll()
        return self._file.readlines(hint)

    def seek(self, offset, whence=0):
        self._roll()
        return self._file.seek(offset, whence)

    def tell(self):
        if not self._rolled:
            return self._size
        return self._file.tell()

    def flush(self):
        if self._rolled:
            self._file.flush()

    @property
    def closed(self):
        return self._closed

    def close(self):
        if self._closed:
            return
        self._closed = True
        if self._file is not None:
            self._file.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_tb):
        self.close()
        return False

    def __iter__(self):
        self._roll()
        return iter(self._file)


def mkstemp(suffix="", prefix=None, dir=None, text=False):
    """Створює тимчасовий файл. Повертає пару (fd, шлях)."""
    name = _make_name(prefix, suffix, dir)
    file = open(name, "w")
    try:
        file.write("")
    except Exception:
        pass
    file.close()
    return (3, name)


def mkdtemp(suffix="", prefix=None, dir=None):
    """Створює тимчасовий каталог і повертає його шлях."""
    name = _make_name(prefix, suffix, dir)
    try:
        os.mkdir(name)
    except Exception:
        pass
    return name


def mktemp(suffix="", prefix=None, dir=None):
    """Повертає шлях до тимчасового файлу (файл не створюється)."""
    return _make_name(prefix, suffix, dir)
