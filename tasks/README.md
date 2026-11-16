# Приклади завдань для режиму іспиту (?mode=exam)

Кожна підтека — окреме завдання:

- `task.md` — текст умови для вчителя/студента.
- `task.json` — файл завдання (`.task.json`), який завантажується за посиланням `?mode=exam&task=<url>`.
- `solutions/` — рішення-приклади:
  - `correct_*.py` — правильні (мають отримати 100%).
  - `wrong_*.py` — неправильні (мають показати відмінності).

## Запуск перевірки
1. Розмістіть `task.json` за доступним URL (або локально через `python3 -m http.server`).
2. Відкрийте `index.html?mode=exam&task=<url до task.json>`.
3. Вставте код рішення в редактор, натисніть кнопку «Тест» (середня).

## Кодування еталонного коду
Поле `reference_code` у `task.json` зберігається закодованим через XOR + Base64
(префікс `ENC:`) — щоб учень не міг легко підглянути розв'язок у файлі завдання.
`teacher_app.html` кодує його при збереженні та декодує при відкритті, а
`lib/checker.js` декодує при завантаженні завдання в ЄPython.

## Список завдань
- `console_sum` — консоль: сума двох чисел.
- `functions_factorial` — функції: факторіал.
- `gui_counter` — GUI: лічильник з кнопкою.
- `both_echo` — both: ехо у консоль і вікно.
- `console_GUI/` — завдання режиму `both` (Tkinter + консоль, кожна підтека — окреме завдання):
  - `console_GUI/calculator_sum` — калькулятор: сума двох чисел з консолі у вікні.
  - `console_GUI/currency_converter` — конвертер валют.
  - `console_GUI/greet_user` — привітання користувача за ім'ям з консолі.
  - `console_GUI/password_check` — перевірка пароля з виводом результату у вікні.
  - `console_GUI/random_number` — генератор випадкових чисел у заданому діапазоні.
  - `console_GUI/window_settings` — вікно з персональними налаштуваннями (заголовок, розміри).
- `console/` — додаткові консольні завдання (кожна підтека — окреме завдання):
  - `console/even_odd` — парне чи непарне число.
  - `console/max_of_three` — найбільше з трьох чисел.
  - `console/sum_1_to_n` — сума чисел від 1 до N.
  - `console/reverse_string` — перевернути рядок.
  - `console/prime_check` — перевірка простого числа.
  - `console/fibonacci` — числа Фібоначчі.
  - `console/palindrome` — паліндром.
  - `console/sort_manual` — сортування без використання `sort()` (заборонено `sort`/`sorted`).
- `functions/` — додаткові завдання на створення функцій (`mode: functions`, кожна підтека — окреме завдання):
  - `functions/greeting` — привітання (`greeting(name)`).
  - `functions/add` — сума двох чисел (`add(a, b)`).
  - `functions/is_even` — перевірка парності (`is_even(n)`).
  - `functions/maximum` — максимум трьох чисел (`maximum(a, b, c)`).
  - `functions/factorial` — факторіал (`factorial(n)`).
  - `functions/reverse_string` — перевернутий рядок (`reverse_string(s)`).
  - `functions/count_vowels` — кількість голосних латинських літер (`count_vowels(s)`).
  - `functions/is_prime` — перевірка простого числа (`is_prime(n)`).
