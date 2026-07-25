// Використовуємо глобальний selectedLang з lib.js (визначений раніше).
// Якщо з якоїсь причини він недоступний — визначаємо самостійно.
if (typeof selectedLang === 'undefined') {
    let userLang = navigator.language || navigator.userLanguage;
    selectedLang = (userLang.startsWith('uk') || userLang.startsWith('ru')) ? 'uk' : 'en';
}

// Параметр запуску ?lang=uk або ?lang=en має найвищий пріоритет.
// Якщо параметра немає (або значення некоректне) — залишається мова браузера/lib.js.
// ВАЖЛИВО: цей блок виконується одразу під час завантаження скрипта (а не в
// $(document).ready), тому що lib.js реєструє власний ready-обробник, який
// вже під час першого рендеру бічної панелі файлів читає selectedLang. Якщо
// перевизначати selectedLang всередині $(function(){...}) нижче, обробник
// lib.js встигає спрацювати раніше (jQuery виконує ready-колбеки в порядку
// реєстрації), і перший файл (mycode.py) промальовується зі старою мовою.
(function () {
    var urlParams = new URLSearchParams(window.location.search);
    var langParam = urlParams.get('lang');
    if (langParam === 'uk' || langParam === 'en') {
        selectedLang = langParam;
    }
})();

$(function () {

    function applyTranslations(lang) {
        const translation = translations[lang] || {};

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

    // Повторне застосування після повної ініціалізації jQuery UI діалогів
    // (lib.js ініціалізує їх у $(document).ready, який може виконатись після цього блоку)
    $(window).on('load', function() {
        applyTranslations(selectedLang);
    });
});
