# 🐍 YePython (ЄPython) — Programming Made Simple!

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/)
[![Made in Ukraine](https://img.shields.io/badge/Made%20in-%F0%9F%87%BA%F0%9F%87%A6%20Ukraine-yellow)](https://yepython.github.io/)

**YePython (ЄPython)** is a free, browser-based online environment for writing, running, and debugging Python code. Designed for students, teachers, and beginners, it makes learning programming accessible, secure, and convenient without requiring any software installation on your computer.

🔗 **Try it now:** [yepython.github.io](https://yepython.github.io/) *(replace with your actual project URL)*

---

## ✨ Key Features

- 🚀 **Runs in the Browser**: No installation required. Works fast and smoothly even on older or low-spec hardware.
- 🔒 **Privacy First**: Code executes locally in your browser via **Skulpt**. Your data is never sent to or collected by any server.
- 💾 **Smart Local Storage**: Automatically saves copies of your code to browser storage every time you run it, allowing you to view history and restore previous versions.
- 📂 **Virtual File System**: Full support for file operations (`os`, `open`, `sqlite3`, etc.) directly in the browser, simulating a real operating system environment.
- 🎨 **Flexible UI Customization**: 
  - Editor and console themes: Day, Twilight, Night.
  - Adjustable font sizes for both code and output text.
  - Transparent output window mode (lets you see your code behind the results).
- 🎬 **Execution Modes**: 
  - Run entire program (instant execution).
  - Step-by-step execution (`Shift + F5`).
  - Line-by-line animation with configurable delay for educational algorithm breakdown.
- 🔗 **Easy Sharing**: Share your code via Base64 links (code embedded in the URL, works offline) or short links via `dpaste.com` (with configurable expiry: 1 day, 1 week, 1 month, or 1 year). You can also host your own code and load it via a `?load=` URL parameter.

---

## 📦 Supported Libraries "Out of the Box"

YePython provides access to a powerful set of libraries typically available only in full local environments:

| Category | Libraries |
| :--- | :--- |
| **Scientific Computing & Data Science** | `numpy`, `pandas`, `scipy`, `matplotlib` |
| **Graphics, Games & GUI** | `pygame`, `pgzrun`, `p5`, `turtle`, `tkinter`, `PIL`, `easygui`, `simplegraphics` |
| **File & OS Operations** | `os`, `shutil`, `tempfile`, `csv`, `json`, `sqlite3`, `enum` |
| **Network & Web** | `requests`, `bs4` (BeautifulSoup) |
| **Hardware Simulators** | `microbit`, `arduino`, `robot` |
| **Multimedia** | `music`, `soundfx` |
| **Special & Educational** | `withcode` |

> *Note: Modules like `p5`, `tkinter`, `matplotlib`, and `pgzrun` have been specially implemented, adapted, and enhanced for seamless browser-based execution.*

---

## ⌨️ Essential Hotkeys

| Action | Shortcut |
| :--- | :--- |
| **Run Program** | `F5` or `Ctrl` + `Enter` |
| **Step-by-step Execution** | `Shift` + `F5` |
| **Save Current File to PC** | `Ctrl` + `Alt` + `S` |
| **Open Settings** | `Ctrl` + `O` |
| **Code Completion / Hints** | `Ctrl` + `Space` |
| **Find / Replace** | `Ctrl` + `F` / `Ctrl` + `H` |
| **Increase / Decrease Indent** | `Ctrl` + `]` / `Ctrl` + `[` |
| **Delete Current Line** | `Ctrl` + `D` |
| **Undo / Redo** | `Ctrl` + `Z` / `Ctrl` + `Y` |

*(Press `Ctrl` + `?` at any time to open or close the full hotkey reference guide.)*

---

## 🏗 Architecture & Technologies

- **Execution Core**: [Skulpt](https://skulpt.org/) (JavaScript implementation of Python 3.7+, licensed under MIT / PSFL v2).
- **Code Editor**: [CodeMirror](https://codemirror.net/) (MIT License).
- **Base Architecture**: The project was initiated based on the open-source code of [createwithcode](https://github.com/pddring/createwithcode) by Pete Dring.

---

## 👥 Authors & Contribution

The project is driven by the community and core developers:
- **Pete Dring** (Author of the base `createwithcode` project)
- **Michael Ebert, Nebojša Vasiljević, mohayonao** (Skulpt developers and community)
- **Oleksandr Miziuk, Hryhorii Hromko** (Adaptation, enhancement of modules, and development of YePython)

We warmly welcome contributions (Pull Requests), bug reports (Issues), and documentation improvements!

---

## 📜 License

This project is distributed under the **GNU General Public License v3.0 (GPL-3.0)**. 
Third-party libraries used (NumPy, Pandas, Matplotlib, CodeMirror, etc.) retain their original open-source licenses (BSD, MIT, PSF), guaranteeing free use of the project for educational and non-commercial purposes.

---

> 💡 **Pro Tip for Teachers**: You can host your own copy of YePython on any static hosting (e.g., GitHub Pages) and share it with students by appending `?load=<base64_or_link_to_code>` to the URL. This allows students to instantly open a pre-loaded task or template.

<br>
<br>
<br>

---

<br>
<br>
<br>

# 🐍 ЄPython — програмувати просто!

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/)
[![Made in Ukraine](https://img.shields.io/badge/Made%20in-%F0%9F%87%BA%F0%9F%87%A6%20Ukraine-yellow)](https://yepython.github.io/)

**ЄPython** — це безкоштовне онлайн-середовище для написання, запуску та налагодження коду на Python прямо у веббраузері. Проєкт створено для учнів, студентів та викладачів, щоб зробити вивчення програмування доступним, безпечним і зручним, без необхідності встановлювати будь-яке програмне забезпечення на комп'ютер.

🔗 **Спробувати зараз:** [yepython.github.io](https://yepython.github.io/) *(вкажіть актуальне посилання на ваш проєкт)*

---

## ✨ Ключові можливості

- 🚀 **Працює у браузері**: Жодних встановлень, працює швидко навіть на старих або слабких комп'ютерах.
- 🔒 **Приватність понад усе**: Код виконується локально у вашому браузері завдяки **Skulpt**. Ваші дані нікуди не відправляються і не збираються.
- 💾 **Розумне сховище**: Автоматичне збереження копій коду в локальному сховищі браузера кожного разу, коли ви його запускаєте, з можливістю перегляду історії та відновлення попередніх версій.
- 📂 **Віртуальна файлова система**: Повноцінна підтримка файлових операцій (`os`, `open`, `sqlite3` тощо) прямо в браузері, що імітує роботу реальної операційної системи.
- 🎨 **Гнучке налаштування інтерфейсу**: 
  - Теми редактора та консолі: День, Сутінки, Ніч.
  - Налаштування розмірів шрифтів коду та тексту.
  - Режим прозорого вікна виведення (щоб бачити свій код під результатами).
- 🎬 **Режими виконання**: 
  - Уся програма (миттєвий запуск).
  - Покрокове виконання (`Shift + F5`).
  - Анімація рядків із налаштовуваною затримкою для навчального розбору алгоритмів.
- 🔗 **Зручний шерінг**: Діліться кодом через Base64-посилання (код вбудовано в URL, працює офлайн) або короткі посилання через `dpaste.com` (з вибором терміну дії: одна доба, один тиждень, один місяць, один рік). Код також можна завантажити з будь-якої адреси в інтернеті через параметр `?load=`.

---

## 📦 Підтримувані бібліотеки "з коробки"

ЄPython надає доступ до потужного набору бібліотек, які зазвичай доступні лише у повноцінних локальних середовищах:

| Категорія | Бібліотеки |
| :--- | :--- |
| **Наукові обчислення та Data Science** | `numpy`, `pandas`, `scipy`, `matplotlib` |
| **Графіка, ігри та GUI** | `pygame`, `pgzrun`, `p5`, `turtle`, `tkinter`, `PIL`, `easygui`, `simplegraphics` |
| **Робота з файлами та ОС** | `os`, `shutil`, `tempfile`, `csv`, `json`, `sqlite3`, `enum` |
| **Мережа та веб** | `requests`, `bs4` (BeautifulSoup) |
| **Апаратне забезпечення (симулятори)** | `microbit`, `arduino`, `robot` |
| **Мультимедіа** | `music`, `soundfx` |
| **Спеціальні та освітні** | `withcode` |

> *Примітка: Модулі `p5`, `tkinter`, `matplotlib`, `pgzrun` та інші були спеціально імплементовані, адаптовані та удосконалені для роботи в браузерному середовищі.*

---

## ⌨️ Гарячі клавіші (найважливіші)

| Дія | Комбінація клавіш |
| :--- | :--- |
| **Запустити програму** | `F5` або `Ctrl` + `Enter` |
| **Покрокове виконання** | `Shift` + `F5` |
| **Зберегти поточний файл на комп'ютер** | `Ctrl` + `Alt` + `S` |
| **Відкрити налаштування** | `Ctrl` + `O` |
| **Автодоповнення коду (підказки)** | `Ctrl` + `Space` |
| **Знайти / Замінити** | `Ctrl` + `F` / `Ctrl` + `H` |
| **Збільшити / Зменшити відступ** | `Ctrl` + `]` / `Ctrl` + `[` |
| **Видалити рядок під курсором** | `Ctrl` + `D` |
| **Скасувати / Повторити зміну** | `Ctrl` + `Z` / `Ctrl` + `Y` |

*(Натисніть `Ctrl` + `?` будь-коли, щоб відкрити або закрити повну довідку з гарячими клавішами.)*

---

## 🏗 Архітектура та технології

- **Ядро виконання**: [Skulpt](https://skulpt.org/) (JavaScript-реалізація Python 3.7+, ліцензія MIT / PSFL v2).
- **Редактор коду**: [CodeMirror](https://codemirror.net/) (ліцензія MIT).
- **Базова архітектура**: Проєкт започатковано на основі відкритого коду [createwithcode](https://github.com/pddring/createwithcode) (Pete Dring).

---

## 👥 Автори та внесок

Проєкт розвивається завдяки зусиллям спільноти та основних розробників:
- **Pete Dring** (автор базового проєкту createwithcode)
- **Michael Ebert, Nebojša Vasiljević, mohayonao** (розробники Skulpt та спільноти)
- **Олександр Мізюк, Григорій Громко** (адаптація, удосконалення модулів та розвиток ЄPython)

Ми вітаємо внески (Pull Requests), повідомлення про помилки (Issues) та покращення документації!

---

## 📜 Ліцензія

Цей проєкт поширюється на умовах ліцензії **GNU General Public License v3.0 (GPL-3.0)**. 
Використані сторонні бібліотеки (NumPy, Pandas, Matplotlib, CodeMirror тощо) зберігають свої оригінальні відкриті ліцензії (BSD, MIT, PSF), що гарантує вільне використання проєкту в освітніх та некомерційних цілях.

---

> 💡 **Порада для викладачів**: Ви можете розмістити власну копію ЄPython на будь-якому статичному хостингу (наприклад, GitHub Pages) і ділитися нею з учнями, додаючи до URL параметр `?load=<base64_або_посилання_на_код>`. Це дозволить учням миттєво відкривати готове завдання або шаблон без необхідності копіювати код вручну.
