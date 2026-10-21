"""shutil — робота з файлами та каталогами (обмежена реалізація для Skulpt/IDE).

Файли живуть у віртуальній файловій системі IDE (те саме сховище, що й модуль
os), тому shutil тут повністю працює: копіювання, переміщення, рекурсивне
видалення каталогів тощо.

Підтримуваний API (як у CPython):
    copyfile, copy, copy2, copystat, copytree, move, rmtree,
    which, get_terminal_size, disk_usage, Error
"""

import os

__all__ = [
    "copyfile",
    "copy",
    "copy2",
    "copystat",
    "copytree",
    "move",
    "rmtree",
    "which",
    "get_terminal_size",
    "disk_usage",
    "Error",
]


class Error(OSError):
    """Помилка копіювання дерева каталогів (як shutil.Error у CPython)."""

    def __init__(self, msg=""):
        OSError.__init__(self, msg)


def copyfile(src, dst, follow_symlinks=True):
    """Копіює вміст файлу src у dst (без метаданих)."""
    with open(src, "rb") as fsrc:
        data = fsrc.read()
    with open(dst, "wb") as fdst:
        fdst.write(data)
    return dst


def copy(src, dst, follow_symlinks=True):
    """Копіює файл src у dst."""
    copyfile(src, dst)
    return dst


def copy2(src, dst, follow_symlinks=True):
    """Як copy, але з копіюванням метаданих (у віртуальній ФС вони спільні)."""
    copyfile(src, dst)
    copystat(src, dst)
    return dst


def copystat(src, dst):
    """Копіює метадані (права доступу, час) — у віртуальній ФС це ніщо."""
    return dst


def copytree(src, dst, symlinks=False, ignore=None, copy_function=None,
             ignore_dangling_symlinks=False, dirs_exist_ok=False):
    """Рекурсивно копіює каталог src у dst."""
    if copy_function is None:
        copy_function = copy2
    names = os.listdir(src)
    if ignore is not None:
        ignored = ignore(src, names)
        names = [n for n in names if n not in ignored]
    # exist_ok передаємо позиційно: модуль os у Skulpt не приймає keyword-аргументів.
    os.makedirs(dst, 0o777, bool(dirs_exist_ok))
    errors = []
    for name in names:
        srcname = os.path.join(src, name)
        dstname = os.path.join(dst, name)
        try:
            if os.path.isdir(srcname):
                copytree(srcname, dstname, symlinks, ignore, copy_function,
                         ignore_dangling_symlinks, dirs_exist_ok)
            else:
                copy_function(srcname, dstname)
        except Exception as why:
            errors.append((srcname, dstname, str(why)))
    try:
        copy_function(src, dst)
    except Exception:
        pass
    if errors:
        raise Error("errors copying files")
    return dst


def move(src, dst, copy_function=copy2):
    """Переміщує src у dst (спочатку намагається перейменувати)."""
    try:
        os.rename(src, dst)
    except Exception:
        if os.path.isdir(src):
            copytree(src, dst, copy_function=copy_function)
            rmtree(src)
        else:
            copy_function(src, dst)
            os.remove(src)
    return dst


def rmtree(path, ignore_errors=False, onerror=None):
    """Рекурсивно видаляє каталог разом із вмістом."""
    try:
        if os.path.isdir(path):
            for name in os.listdir(path):
                rmtree(os.path.join(path, name), ignore_errors=ignore_errors)
            os.rmdir(path)
        else:
            os.remove(path)
    except Exception as err:
        if ignore_errors:
            return
        if onerror is not None:
            onerror(os.rmdir, path, err)
            return
        raise


def which(cmd, mode=None, path=None):
    """Шукає виконуваний файл у каталогах PATH."""
    if path is None:
        path = os.getenv("PATH", "/usr/local/bin:/usr/bin:/bin")
    sep = ":"
    try:
        sep = os.pathsep
    except Exception:
        pass
    if os.path.dirname(cmd):
        candidates = [cmd]
    else:
        candidates = []
        for directory in path.split(sep):
            candidates.append(os.path.join(directory, cmd))
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None


def get_terminal_size(fallback=(80, 24)):
    """Розмір термінала (у браузері — значення за замовчуванням)."""
    return fallback


class _DiskUsage:
    """Простий аналог shutil.disk_usage."""

    def __init__(self, total, used, free):
        self.total = total
        self.used = used
        self.free = free

    def __repr__(self):
        return "usage(total=%d, used=%d, free=%d)" % (self.total, self.used, self.free)


def disk_usage(path):
    """Імітує shutil.disk_usage — у віртуальній ФС місця необмежено."""
    return _DiskUsage(0, 0, 0)


def make_archive(base_name, format="zip", root_dir=None, base_dir=None, **kwargs):
    """Створення архіву не підтримується у браузерному середовищі."""
    raise NotImplementedError("shutil.make_archive is not supported in this environment")
