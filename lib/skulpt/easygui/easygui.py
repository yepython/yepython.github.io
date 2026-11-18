# -*- coding: utf-8 -*-
"""``easygui`` для Skulpt / ЄPython.

Це порт знайомого з CPython пакета easygui на tkinter, який у середовищі
ЄPython працює у браузері. Кожен виклик діалогу призупиняє Python-програму,
поки користувач не натисне кнопку (як і в origінальному easygui).

Приклад::

    import easygui as eg

    name = eg.enterbox("Як вас звати?", "Введення")
    if name:
        eg.msgbox("Привіт, " + name + "!", "Вітання")

Реалізовані діалоги: msgbox, buttonbox, choicebox, integerbox, floatbox,
textbox, codebox, enterbox, passwordbox, multenterbox, multpasswordbox,
listbox, ynbox, ccbox, boolbox, indexbox, fileopenbox, filesavebox,
diropenbox, colorbox та exceptionbox.
"""

import tkinter as _tk
from tkinter import _get_temp_root, _destroy_temp_root
from tkinter import filedialog as _filedialog
from tkinter import colorchooser as _colorchooser

__version__ = "0.98.5"
__all__ = [
    "msgbox", "buttonbox", "choicebox", "integerbox", "floatbox",
    "textbox", "codebox", "enterbox", "passwordbox", "multenterbox",
    "multpasswordbox", "listbox", "ynbox", "ccbox", "boolbox", "indexbox",
    "fileopenbox", "filesavebox", "diropenbox", "colorbox", "exceptionbox",
]


# --- допоміжні перетворення -------------------------------------------------

def _text(value):
    """Рядок для показу в діалозі (None та інші типи не ламають віджет)."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _string_list(values):
    if values is None:
        return []
    if isinstance(values, str):
        return [values]
    result = []
    for item in values:
        result.append(_text(item))
    return result


def _index_of(items, value, default=0):
    """Індекс кнопки: приймає і номер, і напис кнопки."""
    if value is None:
        return default
    if isinstance(value, str):
        if value in items:
            return items.index(value)
        return default
    try:
        i = int(value)
    except (TypeError, ValueError):
        return default
    if i < 0 or i >= len(items):
        return default
    return i


# --- база діалогу -----------------------------------------------------------

class _EasyDialog:
    """Спільна основа для всіх діалогів easygui.

    Створює Toplevel, чекає ``wait_window()`` (у Skulpt це Suspension, тож
    події браузера продовжують оброблятися), а потім повертає ``self.result``.
    """

    def __init__(self, msg="", title=" ", buttons=None, default=0,
                 cancel=None, message_width=430):
        self.master = _get_temp_root()
        self.top = _tk.Toplevel(self.master)
        self.top.title(_text(title))
        self.top.resizable(True, True)

        self.buttons = _string_list(buttons) if buttons else ["OK"]
        self.default_index = _index_of(self.buttons, default, 0)
        self.cancel_index = None if cancel is None else _index_of(self.buttons, cancel, len(self.buttons) - 1)
        self.result = None
        self.done = False

        body = _tk.Frame(self.top)
        body.pack(fill="both", expand=1, padx=14, pady=12)
        self.body = body

        message = _text(msg)
        if message:
            label = _tk.Label(body, text=message, wraplength=message_width,
                              justify="left", anchor="w")
            label.pack(fill="x", pady=(0, 8))
        self.error_label = None

        self.create_body(body)

        buttons_frame = _tk.Frame(self.top)
        buttons_frame.pack(fill="x", padx=14, pady=(0, 12))
        self.button_widgets = []
        for i in range(len(self.buttons)):
            button = _tk.Button(buttons_frame, text=self.buttons[i],
                                command=self._command(i), width=9)
            button.pack(side="right", padx=4)
            self.button_widgets.append(button)

        self.top.protocol("WM_DELETE_WINDOW", self.close_window)
        self.top.bind("<Return>", self.return_key)
        self.top.bind("<Escape>", self.escape_key)

        self.top.wait_window(self.top)
        _destroy_temp_root(self.master)

    def create_body(self, parent):
        """Нащадки додають сюди свої віджети."""
        return None

    def _command(self, index):
        def press():
            self.finish(index)
        return press

    def show_error(self, message):
        if self.error_label is None:
            self.error_label = _tk.Label(self.body, text="", fg="#b00020",
                                         justify="left", wraplength=430)
            self.error_label.pack(fill="x", pady=(4, 0))
        self.error_label.config(text=message)

    def finish(self, index=None):
        """Закриває вікно; нащадки можуть спершу зчитати значення віджетів."""
        if self.done:
            return
        self.done = True
        if index is not None and index >= 0 and index < len(self.buttons):
            self.result = self.buttons[index]
        self.top.destroy()

    def close_window(self):
        self.finish(self.cancel_index)

    def return_key(self, event=None):
        self.finish(self.default_index)

    def escape_key(self, event=None):
        self.finish(self.cancel_index)


class _ChoiceDialog(_EasyDialog):
    """Список варіантів з кнопками OK / Cancel."""

    def __init__(self, msg, title, choices, preselect=0, selectmode="browse",
                 buttons=("OK", "Cancel")):
        self.items = _string_list(choices)
        self.preselect = preselect
        self.selectmode = selectmode
        _EasyDialog.__init__(self, msg, title, buttons, default=0, cancel=1)

    def create_body(self, parent):
        frame = _tk.Frame(parent)
        frame.pack(fill="both", expand=1)
        self.listbox = _tk.Listbox(frame, selectmode=self.selectmode,
                                   height=min(max(len(self.items), 4), 12),
                                   width=45)
        scroll = _tk.Scrollbar(frame, orient="vertical",
                               command=self.listbox.yview)
        self.listbox.config(yscrollcommand=scroll.set)
        self.listbox.pack(side="left", fill="both", expand=1)
        scroll.pack(side="right", fill="y")
        for item in self.items:
            self.listbox.insert("end", item)
        selected = _index_of(self.items, self.preselect, -1 if isinstance(self.preselect, str) else 0)
        if selected >= 0 and selected < len(self.items):
            self.listbox.selection_set(selected)
            self.listbox.activate(selected)
        self.listbox.bind("<Double-Button-1>", self.double_click)
        self.listbox.focus_set()

    def double_click(self, event=None):
        if self.selectmode == "multiple" or self.selectmode == "extended":
            self.finish(0)
        elif self.listbox.curselection():
            self.finish(0)

    def selected(self):
        indexes = self.listbox.curselection()
        if self.selectmode in ("multiple", "extended"):
            return [self.items[int(i)] for i in indexes]
        if indexes:
            return self.items[int(indexes[0])]
        return None

    def finish(self, index=None):
        if self.done:
            return
        if index == 0:
            self.result = self.selected()
        else:
            self.result = None
        _EasyDialog.finish(self, None)


class _EntryDialog(_EasyDialog):
    """Одне рядкове поле вводу."""

    def __init__(self, msg="Enter something.", title=" ", default="",
                 strip=True, show=None, image=None, root=None,
                 buttons=("OK", "Cancel")):
        self.initial = _text(default)
        self.strip = strip
        self.show = show
        _EasyDialog.__init__(self, msg, title, buttons, default=0, cancel=1)

    def create_body(self, parent):
        self.entry = _tk.Entry(parent, width=48)
        if self.show is not None:
            self.entry.config(show=self.show)
        self.entry.insert(0, self.initial)
        self.entry.pack(fill="x")
        self.entry.focus_set()

    def finish(self, index=None):
        if self.done:
            return
        if index == 0:
            value = self.entry.get()
            if self.strip:
                value = value.strip()
            self.result = value
        else:
            self.result = None
        _EasyDialog.finish(self, None)


class _MultiEntryDialog(_EasyDialog):
    """Кілька полів вводу (multenterbox / multpasswordbox)."""

    def __init__(self, msg, title, fields, values, hidden=False):
        self.fields = _string_list(fields)
        self.values = _string_list(values)
        self.hidden = hidden
        _EasyDialog.__init__(self, msg, title, ("OK", "Cancel"), default=0, cancel=1)

    def create_body(self, parent):
        self.entries = []
        for i in range(len(self.fields)):
            row = _tk.Frame(parent)
            row.pack(fill="x", pady=2)
            label = _tk.Label(row, text=self.fields[i], width=18, anchor="w")
            label.pack(side="left")
            entry = _tk.Entry(row, width=34)
            if self.hidden:
                entry.config(show="*")
            value = "" if i >= len(self.values) else self.values[i]
            entry.insert(0, _text(value))
            entry.pack(side="left", fill="x", expand=1)
            self.entries.append(entry)
        if self.entries:
            self.entries[0].focus_set()

    def finish(self, index=None):
        if self.done:
            return
        if index == 0:
            self.result = []
            for entry in self.entries:
                self.result.append(entry.get().strip())
        else:
            self.result = None
        _EasyDialog.finish(self, None)


class _TextDialog(_EasyDialog):
    """Багаторядковий текст (textbox / codebox)."""

    def __init__(self, msg, title, text, codebox=False):
        self.initial = _text(text)
        self.codebox = codebox
        _EasyDialog.__init__(self, msg, title, ("OK", "Cancel"), default=0, cancel=1,
                             message_width=520)

    def create_body(self, parent):
        self.text = _tk.Text(parent, width=62, height=14, wrap="word")
        if self.codebox:
            self.text.config(font="Courier 10")
        scroll = _tk.Scrollbar(parent, orient="vertical", command=self.text.yview)
        self.text.config(yscrollcommand=scroll.set)
        self.text.pack(side="left", fill="both", expand=1)
        scroll.pack(side="right", fill="y")
        self.text.insert("1.0", self.initial)
        self.text.focus_set()

    def finish(self, index=None):
        if self.done:
            return
        if index == 0:
            value = self.text.get("1.0", "end")
            if value.endswith("\n"):
                value = value[:-1]
            self.result = value
        else:
            self.result = None
        _EasyDialog.finish(self, None)


# --- публічні функції -------------------------------------------------------

def msgbox(msg="", title=" ", ok_button="OK", image=None, root=None):
    """Показує повідомлення та повертає напис кнопки (зазвичай ``"OK"``)."""
    label = _text(ok_button) or "OK"
    return _EasyDialog(msg, title, [label], default=0, cancel=0).result


def buttonbox(msg="", title=" ", choices=("Button1", "Button2"), image=None,
              root=None):
    """Показує набір кнопок; повертає вибраний напис або ``None``."""
    items = _string_list(choices)
    if not items:
        items = ["OK"]
    cancel = None
    if "Cancel" in items:
        cancel = items.index("Cancel")
    return _EasyDialog(msg, title, items, default=0, cancel=cancel).result


def ynbox(msg="Shall I continue?", title=" ", choices=("Yes", "No"), image=None):
    """Дві кнопки Так/Ні; ``True`` для першої, ``False`` для другої."""
    return buttonbox(msg, title, choices, image) == _text(choices[0])


def ccbox(msg="Shall I continue?", title=" ", choices=("Continue", "Cancel"),
          image=None):
    """Дві кнопки; ``True`` якщо вибрано першу."""
    return buttonbox(msg, title, choices, image) == _text(choices[0])


def boolbox(msg="Shall I continue?", title=" ", choices=("Yes", "No"), image=None):
    return ynbox(msg, title, choices, image)


def choicebox(msg="Pick an item", title="", choices=(), preselect=0,
              callback=None, run=True):
    """Вибирає один елемент зі списку; повертає рядок або ``None``."""
    return _ChoiceDialog(msg, title, choices, preselect).result


def indexbox(msg="Pick an item", title="", choices=(), preselect=0,
             callback=None):
    """Як choicebox, але повертає номер вибраного елемента (або ``None``)."""
    answer = choicebox(msg, title, choices, preselect, callback)
    if answer is None:
        return None
    items = _string_list(choices)
    if answer in items:
        return items.index(answer)
    return None


def listbox(msg=" ", title=" ", choices=(), selectmode="single", callback=None,
            run=True):
    """Список із можливістю вибрати кілька елементів.

    ``selectmode="single"`` повертає один рядок, ``"multiple"`` — список.
    """
    mode = "multiple" if selectmode in ("multiple", "multi", "extended") else "browse"
    return _ChoiceDialog(msg, title, choices, 0, mode).result


def enterbox(msg="Enter something.", title=" ", default="", strip=True,
             image=None, root=None):
    """Поле вводу рядка; ``None`` якщо натиснуто Cancel."""
    return _EntryDialog(msg, title, default, strip).result


def passwordbox(msg="Enter your password.", title=" ", default="", image=None,
                root=None):
    """Поле вводу з прихованим текстом."""
    return _EntryDialog(msg, title, default, True, show="*").result


def _numberbox(msg, title, default, lowerbound, upperbound, integer):
    while True:
        answer = _EntryDialog(msg, title, default).result
        if answer is None:
            return None
        if answer == "":
            return None
        try:
            value = int(answer) if integer else float(answer)
        except (TypeError, ValueError):
            msgbox("Будь ласка, введіть " + ("ціле число." if integer else "число."),
                   "Некоректне значення")
            default = answer
            continue
        if lowerbound is not None and value < lowerbound:
            msgbox("Значення має бути не менше " + _text(lowerbound), "Межа")
            default = answer
            continue
        if upperbound is not None and value > upperbound:
            msgbox("Значення має бути не більше " + _text(upperbound), "Межа")
            default = answer
            continue
        return value


def integerbox(msg="", title=" ", default="", lowerbound=0, upperbound=99,
               image=None, root=None):
    """Ввід цілого числа в заданих межах; ``None`` при скасуванні."""
    return _numberbox(msg, title, default, lowerbound, upperbound, True)


def floatbox(msg="", title=" ", default="", lowerbound=None, upperbound=None,
             image=None, root=None):
    """Ввід дробового числа в заданих межах; ``None`` при скасуванні."""
    return _numberbox(msg, title, default, lowerbound, upperbound, False)


def multenterbox(msg="Fill in values for the fields below.", title=" ",
                 fields=(), values=()):
    """Кілька полів вводу; повертає список рядків або ``None``."""
    return _MultiEntryDialog(msg, title, fields, values).result


def multpasswordbox(msg="Fill in values for the fields below.", title=" ",
                    fields=(), values=()):
    """Кілька полів вводу, усі з прихованим текстом."""
    return _MultiEntryDialog(msg, title, fields, values, hidden=True).result


def textbox(msg="", title=" ", text="", codebox=False, callback=None, run=True):
    """Редагування багаторядкового тексту; повертає текст або ``None``."""
    return _TextDialog(msg, title, text, codebox).result


def codebox(msg="", title=" ", text=""):
    """textbox у моноширинному шрифті."""
    return textbox(msg, title, text, codebox=True)


def _default_parts(default):
    """Розкладає easygui-default на initialdir та initialfile."""
    value = _text(default)
    if value in ("", "*", "*.*"):
        return "", ""
    value = value.replace("\\", "/")
    cut = value.rfind("/")
    directory = value[:cut] if cut >= 0 else ""
    basename = value[cut + 1:] if cut >= 0 else value
    if directory.startswith("/"):
        directory = directory[1:]
    # ``*.txt`` — це маска файлів, а не ім'я файлу для поля вводу.
    if "*" in basename:
        basename = ""
    return directory, basename


def _tk_filetypes(filetypes):
    if not filetypes:
        return []
    if isinstance(filetypes, str):
        return [(filetypes, filetypes)]
    result = []
    for item in filetypes:
        if isinstance(item, (tuple, list)):
            label = _text(item[0]) if len(item) > 0 else "Files"
            pattern = _text(item[1]) if len(item) > 1 else label
            result.append((label, pattern))
        else:
            result.append((_text(item), _text(item)))
    return result


def fileopenbox(msg=None, title=None, default="*", filetypes=None,
                multiple=False):
    """Вибір файлу (або файлів) з віртуальної ФС проєкту."""
    initialdir, initialfile = _default_parts(default)
    options = {
        "title": _text(title) or "Open",
        "initialdir": initialdir,
        "initialfile": initialfile,
        "filetypes": _tk_filetypes(filetypes),
    }
    if multiple:
        names = _filedialog.askopenfilenames(**options)
        return list(names) if names else None
    name = _filedialog.askopenfilename(**options)
    return name if name else None


def filesavebox(msg=None, title=None, default="", filetypes=None):
    """Вибір імені файлу для збереження."""
    initialdir, initialfile = _default_parts(default)
    name = _filedialog.asksaveasfilename(
        title=_text(title) or "Save",
        initialdir=initialdir,
        initialfile=initialfile,
        filetypes=_tk_filetypes(filetypes),
    )
    return name if name else None


def diropenbox(msg=None, title=None, default=None):
    """Вибір теки у віртуальній ФС проєкту."""
    initialdir, _unused = _default_parts(default)
    name = _filedialog.askdirectory(title=_text(title) or "Select directory",
                                    initialdir=initialdir)
    return name if name else None


def colorbox(msg="Pick a color", title=" ", color=None):
    """Палітра кольорів; повертає рядок вигляду ``#rrggbb`` або ``None``."""
    rgb, hex_color = _colorchooser.askcolor(color=color, title=_text(title))
    return hex_color if hex_color else None


def exceptionbox(msg=None, title=None):
    """Показує текст помилки (зручно викликати у блоці ``except``)."""
    if msg is None:
        parts = []
        try:
            import sys
            info = sys.exc_info()
            parts = [_text(info[0]), _text(info[1])]
        except (AttributeError, ImportError):
            # Skulpt не має sys.exc_info(); у такому разі показуємо загальне
            # повідомлення, але сам діалог залишається працездатним.
            parts = []
        parts = [part for part in parts if part]
        msg = ": ".join(parts) or "Помилка"
    msgbox(msg, title or "Exception", "OK")
    return None
