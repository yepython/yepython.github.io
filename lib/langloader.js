/*
 * ЄPython — визначення, вибір і завантаження мови інтерфейсу.
 *
 * Підключати у index.html ПЕРЕД lib.js :
 *     <script src="langloader.js"></script>
 *     <script src="lib.js"></script>
 *     <script src="main.js"></script>
 *
 * Мовні файли (en.js, uk.js, pl.js, ...) лежать у теці lang/ поруч із цим файлом
 * (інший шлях можна задати до підключення: window.EPYTHON_LANG_DIR = 'шлях/').
 *
 * Пріоритет вибору мови:
 *   1) параметр запуску ?lang=xx (лише на цей сеанс, без запису та без запиту);
 *   2) мова, збережена в localStorage (ключ epython_lang);
 *   3) мова браузера (з navigator.languages), якщо вона є у переліку;
 *   4) англійська.
 * Якщо мова ще не збережена (перший запуск) і немає ?lang=, main.js показує вікно вибору.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'epython_lang';
    var FALLBACK = 'en';

    // ---- Прапорці: круглі значки (SVG у системі координат 60x40, обрізаються по центру) ----
    var FLAGS = {
        uk: "<rect width='60' height='20' fill='#0057b7'/><rect y='20' width='60' height='20' fill='#ffd700'/>",
        en: "<rect width='60' height='40' fill='#012169'/><path d='M0 0L60 40M60 0L0 40' stroke='#fff' stroke-width='8'/><path d='M0 0L60 40M60 0L0 40' stroke='#c8102e' stroke-width='3'/><path d='M30 0V40M0 20H60' stroke='#fff' stroke-width='12'/><path d='M30 0V40M0 20H60' stroke='#c8102e' stroke-width='7'/>",
        pl: "<rect width='60' height='20' fill='#fff'/><rect y='20' width='60' height='20' fill='#dc143c'/>",
        cs: "<rect width='60' height='20' fill='#fff'/><rect y='20' width='60' height='20' fill='#d7141a'/><path d='M0 0L32 20L0 40Z' fill='#11457e'/>",
        sk: "<rect width='60' height='13.4' fill='#fff'/><rect y='13.3' width='60' height='13.4' fill='#0b4ea2'/><rect y='26.6' width='60' height='13.4' fill='#ee1c25'/><path d='M13 9h15v12q0 8-7.5 11Q13 29 13 21Z' fill='#ee1c25' stroke='#fff' stroke-width='1'/><path d='M20.5 12v13M16 16h9M17 19.5h7' stroke='#fff' stroke-width='2'/>",
        bg: "<rect width='60' height='13.4' fill='#fff'/><rect y='13.3' width='60' height='13.4' fill='#00966e'/><rect y='26.6' width='60' height='13.4' fill='#d62612'/>",
        sr: "<rect width='60' height='13.4' fill='#c6363c'/><rect y='13.3' width='60' height='13.4' fill='#0c4076'/><rect y='26.6' width='60' height='13.4' fill='#fff'/><path d='M12 9h11v10q0 5-5.5 8Q12 24 12 19Z' fill='#c6363c' stroke='#edb92e' stroke-width='1'/>",
        hr: "<defs><clipPath id='epylc'><path d='M24 11h12v11q0 6-6 9Q24 28 24 22Z'/></clipPath></defs><rect width='60' height='13.4' fill='#f00'/><rect y='13.3' width='60' height='13.4' fill='#fff'/><rect y='26.6' width='60' height='13.4' fill='#171796'/><g clip-path='url(#epylc)'><rect x='24' y='11' width='12' height='21' fill='#fff'/><g fill='#f00'><rect x='24' y='11' width='4' height='4'/><rect x='32' y='11' width='4' height='4'/><rect x='28' y='15' width='4' height='4'/><rect x='24' y='19' width='4' height='4'/><rect x='32' y='19' width='4' height='4'/><rect x='28' y='23' width='4' height='4'/></g></g><path d='M24 11h12v11q0 6-6 9Q24 28 24 22Z' fill='none' stroke='#f00' stroke-width='1'/>",
        de: "<rect width='60' height='13.4' fill='#000'/><rect y='13.3' width='60' height='13.4' fill='#d00'/><rect y='26.6' width='60' height='13.4' fill='#ffce00'/>",
        nl: "<rect width='60' height='13.4' fill='#ae1c28'/><rect y='13.3' width='60' height='13.4' fill='#fff'/><rect y='26.6' width='60' height='13.4' fill='#21468b'/>",
        sv: "<rect width='60' height='40' fill='#006aa7'/><rect x='17' width='8' height='40' fill='#fecc00'/><rect y='16' width='60' height='8' fill='#fecc00'/>",
        da: "<rect width='60' height='40' fill='#c60c30'/><rect x='17' width='7' height='40' fill='#fff'/><rect y='16.5' width='60' height='7' fill='#fff'/>",
        no: "<rect width='60' height='40' fill='#ba0c2f'/><rect x='16' width='10' height='40' fill='#fff'/><rect y='15' width='60' height='10' fill='#fff'/><rect x='18' width='6' height='40' fill='#00205b'/><rect y='17' width='60' height='6' fill='#00205b'/>",
        fr: "<rect width='20' height='40' fill='#0055a4'/><rect x='20' width='20' height='40' fill='#fff'/><rect x='40' width='20' height='40' fill='#ef4135'/>",
        es: "<rect width='60' height='40' fill='#aa151b'/><rect y='10' width='60' height='20' fill='#f1bf00'/>",
        it: "<rect width='20' height='40' fill='#009246'/><rect x='20' width='20' height='40' fill='#fff'/><rect x='40' width='20' height='40' fill='#ce2b37'/>",
        pt: "<rect width='24' height='40' fill='#060'/><rect x='24' width='36' height='40' fill='#f00'/><circle cx='24' cy='20' r='7' fill='#ffe000'/><path d='M20.5 16h7v5q0 3.5-3.5 5Q20.5 24 20.5 21Z' fill='#f00' stroke='#fff' stroke-width='1'/>",
        ro: "<rect width='20' height='40' fill='#002b7f'/><rect x='20' width='20' height='40' fill='#fcd116'/><rect x='40' width='20' height='40' fill='#ce1126'/>",
        lt: "<rect width='60' height='13.4' fill='#fdb913'/><rect y='13.3' width='60' height='13.4' fill='#006a44'/><rect y='26.6' width='60' height='13.4' fill='#c1272d'/>",
        lv: "<rect width='60' height='40' fill='#9e3039'/><rect y='16' width='60' height='8' fill='#fff'/>"
    };

    // Перелік доступних мов: код файлу, назва рідною мовою.
    var LANGS = [
        { code: 'uk', name: 'Українська' }, { code: 'pl', name: 'Polski' },
        { code: 'cs', name: 'Čeština' },     { code: 'sk', name: 'Slovenčina' },
        { code: 'bg', name: 'Български' },   { code: 'sr', name: 'Српски' },
        { code: 'hr', name: 'Hrvatski' },    { code: 'en', name: 'English' },
        { code: 'de', name: 'Deutsch' },     { code: 'nl', name: 'Nederlands' },
        { code: 'sv', name: 'Svenska' },     { code: 'da', name: 'Dansk' },
        { code: 'no', name: 'Norsk' },       { code: 'fr', name: 'Français' },
        { code: 'es', name: 'Español' },     { code: 'it', name: 'Italiano' },
        { code: 'pt', name: 'Português' },   { code: 'ro', name: 'Română' },
        { code: 'lt', name: 'Lietuvių' },    { code: 'lv', name: 'Latviešu' }
    ];

    function find(code) {
        for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
        return null;
    }
    function normalize(tag) {
        if (!tag) return null;
        var c = String(tag).toLowerCase().split(/[-_]/)[0];
        if (c === 'nb' || c === 'nn') c = 'no';   // норвезька (букмол/нюношк) → no
        return find(c) ? c : null;
    }
    function detectBrowserLang() {
        var list = (navigator.languages && navigator.languages.length)
            ? navigator.languages : [navigator.language || navigator.userLanguage];
        for (var i = 0; i < list.length; i++) {
            var c = normalize(list[i]);
            if (c) return c;
        }
        return FALLBACK;
    }
    function getStored() {
        try { return normalize(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
    }
    function setStored(code) {
        try { localStorage.setItem(STORAGE_KEY, code); return true; } catch (e) { return false; }
    }

    // ---- Визначення поточної мови ----
    var urlLang = null;
    try { urlLang = normalize(new URLSearchParams(window.location.search).get('lang')); } catch (e) {}
    var stored = getStored();
    var current = urlLang || stored || detectBrowserLang();
    var needsPrompt = !urlLang && !stored;
    // Якщо мова задана через ?lang=, зберігаємо її, щоб інші сторінки
    // (наприклад, teacher_app.html) могли її підхопити автоматично.
    if (urlLang) {
        try { localStorage.setItem(STORAGE_KEY, urlLang); } catch (e) {}
    }

    // ---- Синхронне підвантаження мовних файлів (до lib.js і main.js) ----
    var script = document.currentScript;
    var dir = window.EPYTHON_LANG_DIR ||
        ((script && script.src ? script.src.replace(/[^\/]*$/, '') : '') + 'lang/');
    function load(code) {
        document.write('<script src="' + dir + code + '.js?v=7"><\/script>');
    }
    if (current !== FALLBACK) load(FALLBACK);   // англійська — запасний варіант для відсутніх ключів
    load(current);
    document.documentElement.setAttribute('lang', current);

    // ---- Вікно вибору мови ----
    function flagHtml(code) {
        return "<svg viewBox='0 0 60 40' preserveAspectRatio='xMidYMid slice' aria-hidden='true' focusable='false'>" +
            (FLAGS[code] || '') + '</svg>';
    }

    function injectStyle() {
        if (document.getElementById('epylang_style')) return;
        var st = document.createElement('style');
        st.id = 'epylang_style';
        st.textContent =
            '#epylang_overlay{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;background:rgba(0,0,0,.55);' +
            'display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:inherit}' +
            '#epylang_panel{background:#fff;color:#222;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);' +
            'padding:20px 20px 16px;max-width:680px;width:100%;max-height:92vh;overflow:auto;box-sizing:border-box}' +
            '#epylang_panel h2{margin:0 0 16px;font-size:20px;text-align:center;font-weight:600}' +
            '#epylang_grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}' +
            '.epylang-item{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 4px;' +
            'background:#f5f5f5;border:2px solid transparent;border-radius:10px;cursor:pointer;font:inherit;color:inherit}' +
            '.epylang-item:hover,.epylang-item:focus{background:#e6eefc;outline:none;border-color:#4a90d9}' +
            '.epylang-item.epylang-current{border-color:#2a6fc0;background:#dce9fb}' +
            '.epylang-flag{display:block;width:56px;height:56px;border-radius:50%;overflow:hidden;' +
            'box-shadow:0 0 0 1px rgba(0,0,0,.3);background:#ddd}' +
            '.epylang-flag svg{display:block;width:100%;height:100%}' +
            '.epylang-name{font-size:14px;line-height:1.2;text-align:center;word-break:break-word}' +
            '.epylang-settings-btn{display:inline-flex;align-items:center;gap:8px;padding:4px 10px;cursor:pointer;font:inherit}' +
            '.epylang-settings-btn .epylang-flag{width:24px;height:24px}';
        document.head.appendChild(st);
    }

    function applyChoice(code, first) {
        var ok = setStored(code);
        needsPrompt = false;
        if (code === current) return;
        if (!first) {
            // Зберегти поточний код у сховищі й відновити його після перезавантаження.
            try {
                if (window.PythonIDE && PythonIDE.saveSnapshot) {
                    PythonIDE.saveSnapshot();
                    localStorage.loadAction = 'restoreCode';
                }
            } catch (e) {}
        }
        var url = new URL(window.location.href);
        if (!ok || url.searchParams.has('lang')) url.searchParams.set('lang', code);
        if (url.href === window.location.href) window.location.reload();
        else window.location.href = url.href;
    }

    function showDialog(opts) {
        opts = opts || {};
        var first = opts.mode === 'first';
        if (document.getElementById('epylang_overlay')) return;
        injectStyle();

        var tr = window.translations || {};
        var title = (tr[current] && tr[current].choose_language) ||
                    (tr[FALLBACK] && tr[FALLBACK].choose_language) || 'Choose your language';

        var overlay = document.createElement('div');
        overlay.id = 'epylang_overlay';
        var panel = document.createElement('div');
        panel.id = 'epylang_panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', title);
        var h = document.createElement('h2');
        h.textContent = title;
        panel.appendChild(h);
        var grid = document.createElement('div');
        grid.id = 'epylang_grid';
        panel.appendChild(grid);
        overlay.appendChild(panel);

        var currentBtn = null;
        LANGS.forEach(function (l) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'epylang-item' + (l.code === current ? ' epylang-current' : '');
            b.setAttribute('data-code', l.code);
            b.setAttribute('lang', l.code);
            b.innerHTML = '<span class="epylang-flag">' + flagHtml(l.code) + '</span>' +
                          '<span class="epylang-name"></span>';
            b.lastChild.textContent = l.name;
            b.addEventListener('click', function () { choose(l.code); });
            if (l.code === current) currentBtn = b;
            grid.appendChild(b);
        });

        function close() {
            document.removeEventListener('keydown', onKey, true);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
        function choose(code) { close(); applyChoice(code, first); }
        function onKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault(); e.stopPropagation();
                if (first) choose(current); else close();   // Esc на першому запуску = прийняти мову за замовчуванням
            }
        }
        overlay.addEventListener('mousedown', function (e) {
            if (e.target === overlay && !first) close();
        });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(overlay);
        if (currentBtn) currentBtn.focus();
    }

    window.EpyLang = {
        langs: LANGS,
        current: current,
        needsPrompt: needsPrompt,
        flagHtml: flagHtml,
        nativeName: function (code) { var l = find(code); return l ? l.name : code; },
        showDialog: showDialog
    };
})();
