// Мову визначає langloader.js (підключається перед lib.js): параметр ?lang=xx,
// збережений вибір (localStorage.epython_lang), мова браузера або англійська.
// lib.js бере з нього глобальну змінну selectedLang. Якщо з якоїсь причини вона
// недоступна — використовуємо англійську.
// ВАЖЛИВО: selectedLang визначається ще до lib.js, тому що lib.js читає її під час
// першого рендеру (бічна панель файлів, привітання тощо).
if (typeof selectedLang === 'undefined') {
    selectedLang = (window.EpyLang && window.EpyLang.current) || 'en';
}

$(function () {

    // Додаємо кнопку зміни мови до вікна "Середовище виконання": вона стоїть
    // у тому самому фреймі, що й версії Skulpt і Python, біля правого краю.
    // (HTML-розмітка вікна статична в index.html; цей блок лише доповнює її.)
    (function addLanguageSetting() {
        if (!window.EpyLang) return;
        var $slot = $('#rt_lang_slot');
        if (!$slot.length || $('#epylang_btn').length) return;
        var $btn = $('<button type="button" id="epylang_btn" class="epylang-settings-btn"></button>');
        $btn.html('<span class="epylang-flag">' + EpyLang.flagHtml(EpyLang.current) + '</span>' +
                  '<span class="epylang-name"></span>');
        $btn.find('.epylang-name').text(EpyLang.nativeName(EpyLang.current));
        $btn.on('click', function () { EpyLang.showDialog({ mode: 'change' }); });
        $slot.append($btn);
    })();

    function applyTranslations(lang) {
        // Англійська — запасний варіант для ключів, яких немає у вибраній мові.
        const translation = Object.assign({}, translations.en || {}, translations[lang] || {});

        // 1. Текстовий вміст елементів: data-i18n="key"
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key && translation[key]) {
                element.textContent = translation[key];
            }
        });

        // 2. Атрибути: data-i18n-title="key", data-i18n-alt="key" тощо
        document.querySelectorAll('*').forEach(element => {
            [...element.attributes].forEach(attr => {
                if (attr.name.startsWith('data-i18n-')) {
                    const attrName = attr.name.replace('data-i18n-', '');
                    const translationKey = attr.value;
                    if (translation[translationKey]) {
                        element.setAttribute(attrName, translation[translationKey]);
                        // Якщо діалог jQuery UI вже ініціалізований — оновити його заголовок
                        if (attrName === 'title' && $(element).data('ui-dialog')) {
                            $(element).dialog('option', 'title', translation[translationKey]);
                        }
                    }
                }
            });
        });

        // 3. Заголовки jQuery UI діалогів, ініціалізованих після цього виклику —
        //    перехоплюємо подію dialogcreate і одразу встановлюємо правильний заголовок.
        //    off + on щоб не накопичувати дублікати при повторному виклику applyTranslations.
        $(document).off('dialogcreate.i18n').on('dialogcreate.i18n', function(event) {
            const $el = $(event.target);
            const titleKey = $el.attr('data-i18n-title');
            if (titleKey && translation[titleKey]) {
                $el.dialog('option', 'title', translation[titleKey]);
            }
        });
    }

    applyTranslations(selectedLang);

    // Перший запуск: мову ще не обрано (немає запису в localStorage) — пропонуємо обрати.
    // Мова браузера (або англійська, якщо її немає у переліку) вже вибрана за замовчуванням.
    if (window.EpyLang && EpyLang.needsPrompt) {
        EpyLang.showDialog({ mode: 'first' });
    }

    // Повторне застосування після повної ініціалізації jQuery UI діалогів
    // (lib.js ініціалізує їх у $(document).ready, який може виконатись після цього блоку)
    $(window).on('load', function() {
        applyTranslations(selectedLang);
    });
});
