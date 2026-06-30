/*
  filemanager.js — Розпорядник файлів для віртуальної файлової системи
  Залежності: jsfs (FileSystem), Tabler Icons webfont
  Використання: викликати FileManager.init('container-id', fsInstance)
*/

var FileManager = (function () {
  'use strict';

  /* ── стан ──────────────────────────────────────── */
  var _fs = null;      // екземпляр FileSystem (jsfs)
  var _cwd = '/';
  var _selected = null;
  var _clipboard = null;   // { name, path, mode: 'copy'|'cut' }
  var _viewState = null;
  var _notification = null;
  var _notifyTimer = null;
  var _containerId = null;
  var _lastClick = { key: null, time: 0 };

  var SEP = '/';
  /* ── i18n ───────────────────────────────────────── */
  var _i18n = {
    uk: {
      root:              'Верхній рівень',
      create_folder:     'Створити теку',
      add_file:          'Додати файл',
      view_file:         'Переглянути файл',
      copy_file:         'Копіювати',
      cut_file:          'Вирізати',
      paste_file:        'Вставити',
      save_file:         'Зберегти файл',
      delete:            'Видалити',
      up:                'На рівень вище',
      empty:             'Тека порожня',
      folder_singular:   'тека',
      folder_plural:     'теки/тек',
      file_singular:     'файл',
      file_plural:       'файли/файлів',
      hint:              'Клацніть для вибору, двічі — відкрити',
      close:             'Закрити',
      cancel:            'Скасувати',
      confirm:           'Підтвердити',
      confirmation:      'Підтвердження',
      modal_create_title:'Створити теку',
      modal_create_label:'Назва теки',
      modal_create_ph:   'Мої файли',
      notify_created:    'Теку «{name}» створено.',
      notify_exists:     'Тека з такою назвою вже існує.',
      notify_added:      'Файл «{name}» додано.',
      notify_read_err:   'Помилка читання файлу.',
      notify_sel_view:   'Виділіть файл для перегляду.',
      notify_sel_file:   'Виберіть файл (не теку).',
      notify_sel_copy:   'Виберіть файл (не теку) для копіювання.',
      notify_sel_cut:    'Виберіть файл (не теку) для вирізання.',
      clipboard_copy:    'Файл «{name}» у буфері обміну (копіювання)',
      clipboard_cut:     'Файл «{name}» у буфері обміну (перенесення)',
      notify_paste_empty:'Буфер обміну порожній.',
      notify_pasted:     'Файл «{name}» вставлено.',
      notify_paste_err:  'Не вдалося вставити файл.',
      notify_sel_save:   'Виділіть файл для збереження.',
      notify_sel_save2:  'Виберіть файл для збереження.',
      notify_saved:      'Файл «{name}» збережено.',
      notify_sel_del:    'Виділіть файл або теку для видалення.',
      notify_confirm_del:'Видалити «{name}» назавжди?',
      notify_deleted:    '«{name}» видалено.',
      notify_ext:        'Дозволені лише файли .txt та .png',
      dialog_title:      'Розпорядник файлів',
      close_label:       'Закрити'
    },
    en: {
      root:              'Root',
      create_folder:     'New folder',
      add_file:          'Add file',
      view_file:         'View file',
      copy_file:         'Copy',
      cut_file:          'Cut',
      paste_file:        'Paste',
      save_file:         'Save file',
      delete:            'Delete',
      up:                'Up one level',
      empty:             'Folder is empty',
      folder_singular:   'folder',
      folder_plural:     'folders',
      file_singular:     'file',
      file_plural:       'files',
      hint:              'Click to select, double-click to open',
      close:             'Close',
      cancel:            'Cancel',
      confirm:           'Confirm',
      confirmation:      'Confirmation',
      modal_create_title:'Create folder',
      modal_create_label:'Folder name',
      modal_create_ph:   'My files',
      notify_created:    'Folder "{name}" created.',
      notify_exists:     'A folder with this name already exists.',
      notify_added:      'File "{name}" added.',
      notify_read_err:   'File read error.',
      notify_sel_view:   'Select a file to view.',
      notify_sel_file:   'Select a file (not a folder).',
      notify_sel_copy:   'Select a file (not a folder) to copy.',
      notify_sel_cut:    'Select a file (not a folder) to cut.',
      clipboard_copy:    'File "{name}" in clipboard (copy)',
      clipboard_cut:     'File "{name}" in clipboard (move)',
      notify_paste_empty:'Clipboard is empty.',
      notify_pasted:     'File "{name}" pasted.',
      notify_paste_err:  'Could not paste the file.',
      notify_sel_save:   'Select a file to save.',
      notify_sel_save2:  'Select a file to save.',
      notify_saved:      'File "{name}" saved.',
      notify_sel_del:    'Select a file or folder to delete.',
      notify_confirm_del:'Delete "{name}" permanently?',
      notify_deleted:    '"{name}" deleted.',
      notify_ext:        'Only .txt and .png files are allowed',
      dialog_title:      'File manager',
      close_label:       'Close'
    }
  };

  function _getLang() {
    if (typeof selectedLang !== 'undefined' && _i18n[selectedLang]) return selectedLang;
    var l = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return (l.startsWith('uk') || l.startsWith('ru')) ? 'uk' : 'en';
  }

  function t(key, vars) {
    var str = (_i18n[_getLang()] || _i18n['en'])[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return str;
  }



  /* ── публічний init ─────────────────────────────── */
  function init(containerId, fsInstance) {
    _containerId = containerId;
    _fs = fsInstance;
    /* скидаємо до кореня і в jsfs, і у власному стані */
    try { _fs.cd(SEP); } catch(e) {}
    _cwd = _fs.getCwd ? _fs.getCwd() : SEP;
    _selected = null;
    render();
  }

  /* ── helpers ────────────────────────────────────── */
  function notify(msg, type) {
    _notification = { msg: msg, type: type || 'info' };
    if (_notifyTimer) clearTimeout(_notifyTimer);
    _notifyTimer = setTimeout(function () { _notification = null; render(); }, 2800);
    render();
  }

  function joinPath(base, name) {
    return base === SEP ? SEP + name : base + SEP + name;
  }

  function parentPath(path) {
    if (path === SEP) return SEP;
    var parts = path.split(SEP).filter(Boolean);
    parts.pop();
    return parts.length === 0 ? SEP : SEP + parts.join(SEP);
  }

  function basename(path) {
    return path.split(SEP).filter(Boolean).pop() || '';
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return String(s || '')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;');
  }

  function breadcrumbs() {
    if (_cwd === SEP) return [{ label: t('root'), path: SEP }];
    var parts = _cwd.split(SEP).filter(Boolean);
    var crumbs = [{ label: t('root'), path: SEP }];
    parts.forEach(function (p, i) {
      crumbs.push({ label: p, path: SEP + parts.slice(0, i + 1).join(SEP) });
    });
    return crumbs;
  }

  /* ── файлові операції через jsfs ────────────────── */
  function getFolders() {
    return (_fs.ls('.', 'folders') || []).slice().sort();
  }

  function getFiles() {
    return (_fs.ls('.', 'files') || []).slice().sort();
  }

  function navigateTo(path) {
    _fs.cd(path);
    _cwd = _fs.getCwd();
    _selected = null;
    render();
  }

  function navigate(name) {
    _fs.cd(name);
    _cwd = _fs.getCwd();
    _selected = null;
    render();
  }

  function goUp() {
    _fs.cd('..');
    _cwd = _fs.getCwd();
    _selected = null;
    render();
  }

  /* ── дії панелі меню ────────────────────────────── */
  function createFolder() {
    showInputModal(t('modal_create_title'), t('modal_create_label'), t('modal_create_ph'), function (name) {
      if (!name.trim()) return;
      if (_fs.mkdir(name)) {
        notify(t('notify_created', {name: name}), 'success');
      } else {
        notify(t('notify_exists'), 'error');
      }
    });
  }

  function addFile() {
    document.getElementById('fm_fileInput').click();
  }

  function handleFileInput(input) {
    var file = input.files[0];
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'txt' && ext !== 'png') {
      notify(t('notify_ext'), 'error');
      input.value = '';
      return;
    }
    var reader = new FileReader();
    if (ext === 'txt') {
      reader.readAsText(file);
      reader.onload = function () {
        _fs.write(file.name, reader.result);
        notify(t('notify_added', {name: file.name}), 'success');
      };
    } else {
      reader.readAsDataURL(file);
      reader.onload = function () {
        _fs.write(file.name, reader.result);
        notify(t('notify_added', {name: file.name}), 'success');
      };
    }
    reader.onerror = function () { notify(t('notify_read_err'), 'error'); };
    input.value = '';
  }

  function viewFile() {
    if (!_selected) { notify(t('notify_sel_view'), 'error'); return; }
    var files = getFiles();
    if (files.indexOf(_selected) < 0) { notify(t('notify_sel_file'), 'error'); return; }
    var content = _fs.read(_cwd === SEP ? SEP + _selected : _cwd + SEP + _selected);
    if (typeof content !== 'string') content = JSON.stringify(content, null, 2);
    var isImage = _selected.split('.').pop().toLowerCase() === 'png';
    _viewState = { name: _selected, content: content, isImage: isImage };
    render();
  }

  function _fullPath(name) {
    return _cwd === SEP ? SEP + name : _cwd + SEP + name;
  }

  function copyEntry() {
    if (!_selected) { notify(t('notify_sel_copy'), 'error'); return; }
    var files = getFiles();
    if (files.indexOf(_selected) < 0) { notify(t('notify_sel_copy'), 'error'); return; }
    _clipboard = { name: _selected, path: _fullPath(_selected), mode: 'copy' };
    notify(t('clipboard_copy', { name: _selected }), 'info');
  }

  function cutEntry() {
    if (!_selected) { notify(t('notify_sel_cut'), 'error'); return; }
    var files = getFiles();
    if (files.indexOf(_selected) < 0) { notify(t('notify_sel_cut'), 'error'); return; }
    _clipboard = { name: _selected, path: _fullPath(_selected), mode: 'cut' };
    notify(t('clipboard_cut', { name: _selected }), 'info');
  }

  function pasteEntry() {
    if (!_clipboard) { notify(t('notify_paste_empty'), 'error'); return; }
    try {
      var content = _fs.read(_clipboard.path);
      _fs.write(_clipboard.name, content);
      if (_clipboard.mode === 'cut') {
        _fs.rm(_clipboard.path);
      }
      var name = _clipboard.name;
      _clipboard = null;
      _selected = null;
      notify(t('notify_pasted', { name: name }), 'success');
    } catch (e) {
      notify(t('notify_paste_err'), 'error');
    }
  }

  function saveFile() {
    if (!_selected) { notify(t('notify_sel_save'), 'error'); return; }
    var files = getFiles();
    if (files.indexOf(_selected) < 0) { notify(t('notify_sel_save2'), 'error'); return; }
    var fullPath = _cwd === SEP ? SEP + _selected : _cwd + SEP + _selected;
    var content = _fs.read(fullPath);
    if (typeof content !== 'string') content = JSON.stringify(content, null, 2);
    var ext = _selected.split('.').pop().toLowerCase();
    if (ext === 'png' && content.indexOf('data:') === 0) {
      var a = document.createElement('a');
      a.href = content;
      a.download = _selected;
      a.click();
    } else {
      var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a2 = document.createElement('a');
      a2.href = url;
      a2.download = _selected;
      a2.click();
      URL.revokeObjectURL(url);
    }
    notify(t('notify_saved', {name: _selected}), 'success');
  }

  function deleteEntry() {
    if (!_selected) { notify(t('notify_sel_del'), 'error'); return; }
    var name = _selected;
    showConfirmModal(t('notify_confirm_del', {name: name}), function () {
      _fs.rm(name);
      _selected = null;
      notify(t('notify_deleted', {name: name}), 'success');
    });
  }

  /* ── HTML-будівельники ─────────────────────────── */
  /* Кругла кнопка — лише для панелі меню */
  var BT = 'display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px;width:48px;height:48px;font-size:11px;font-weight:400;background:#f4f4f4;border:1px solid #ccc;border-radius:50%;cursor:pointer;color:#333;font-family:inherit;';
  /* Прямокутні кнопки — для модальних вікон */
  var BT_BASE = 'display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:6px 14px;font-size:13px;font-weight:400;background:#f4f4f4;border:1px solid #ccc;border-radius:6px;cursor:pointer;color:#333;font-family:inherit;';
  var BT_ACCENT = BT_BASE + 'background:var(--fill-accent,#2563eb);color:#fff;border:none;';
  var BT_DANGER = BT_BASE + 'background:#dc2626;color:#fff;border:none;';

  /* PNG icons from media/ folder */
  var ICONS = {
    'ti-folder-plus': 'new_folder.png',
    'ti-file-upload':  'add_file.png',
    'ti-eye':          'view.png',
    'ti-copy':         'copy.png',
    'ti-cut':          'cut.png',
    'ti-paste':        'paste.png',
    'ti-download':     'download.png',
    'ti-trash':        'delete.png'
  };
  function btn(label, icon, onclick, extraStyle) {
    var img = ICONS[icon] ? '<img src="media/' + ICONS[icon] + '" style="width:32px;height:32px;display:block" alt="">' : '';
    return '<button onclick="' + onclick + '" title="' + escAttr(label) + '" style="' + BT + (extraStyle || '') + '" ' +
      'onmouseover="this.style.background=\'#e8e8e8\'" ' +
      'onmouseout="this.style.background=\'#f4f4f4\'">' +
      img + '</button>';
  }

  /* Unicode icons for entries */
  var ENTRY_ICONS = {
    'folder':  '\uD83D\uDCC1',
    'up':      '\u2B06',
    'txt':     '\uD83D\uDCC4',
    'png':     '\uD83D\uDDBC',
    'file':    '\uD83D\uDCC4'
  };

  function entryRow(icon, label, key, isFolder, isSelected, isMuted, iconColor) {
    var bg = isSelected ? '#ddeeff' : 'transparent';
    var tc = isMuted ? '#999' : isSelected ? '#1a4fa0' : '#1a1a18';
    var sym;
    if (key === '__up__') { sym = ENTRY_ICONS['up']; }
    else if (isFolder)    { sym = ENTRY_ICONS['folder']; }
    else {
      var ext = label.split('.').pop().toLowerCase();
      sym = ENTRY_ICONS[ext] || ENTRY_ICONS['file'];
    }
    /* use click-timing trick instead of ondblclick (jQuery UI blocks native dblclick) */
    var clickFn;
    if (key === '__up__') {
      clickFn = 'FileManager._clickEntry(\'__up__\', true)';
    } else if (isFolder) {
      clickFn = 'FileManager._clickEntry(\'' + escAttr(key) + '\', true)';
    } else {
      clickFn = 'FileManager._clickEntry(\'' + escAttr(key) + '\', false)';
    }
    var hoverBg = '#f0f4ff';
    return '<div onclick="' + clickFn + '" ' +
      'style="display:flex;align-items:center;gap:10px;padding:7px 14px;cursor:pointer;user-select:none;background:' + bg + ';border-bottom:0.5px solid #f0f0f0" ' +
      'onmouseover="this.style.background=\'' + (isSelected ? '#ddeeff' : hoverBg) + '\'" ' +
      'onmouseout="this.style.background=\'' + bg + '\'">' +
      '<span style="font-size:18px;line-height:1;flex-shrink:0">' + sym + '</span>' +
      '<span style="font-size:14px;color:' + tc + (isSelected ? ';font-weight:500' : '') + '">' + escHtml(label) + '</span>' +
      '</div>';
  }

  /* ── модальні вікна ──────────────────────────────── */
  var _modalCb = null;

  function showConfirmModal(message, onConfirm) {
    _modalCb = onConfirm;
    var html = '<div id="fm_overlay" onclick="if(event.target.id===\'fm_overlay\')FileManager._closeModal()" ' +
      'style="position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999">' +
      '<div style="background:var(--surface-2,#fff);border-radius:12px;border:0.5px solid var(--border,#ddd);padding:20px 24px;min-width:300px;max-width:440px;width:90%">' +
      '<div style="font-weight:500;margin-bottom:12px;font-size:15px">' + t('confirmation') + '</div>' +
      '<p style="margin:0 0 16px;font-size:14px;color:var(--text-secondary,#666)">' + escHtml(message) + '</p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button onclick="FileManager._closeModal()" style="' + BT_BASE + '">' + t('cancel') + '</button>' +
      '<button onclick="FileManager._confirmModal()" style="' + BT_DANGER + '">' + t('delete') + '</button>' +
      '</div></div></div>';
    _appendOverlay(html);
  }

  function showInputModal(title, label, placeholder, onConfirm) {
    _modalCb = onConfirm;
    var html = '<div id="fm_overlay" onclick="if(event.target.id===\'fm_overlay\')FileManager._closeModal()" ' +
      'style="position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999">' +
      '<div style="background:var(--surface-2,#fff);border-radius:12px;border:0.5px solid var(--border,#ddd);padding:20px 24px;min-width:300px;max-width:440px;width:90%">' +
      '<div style="font-weight:500;margin-bottom:12px;font-size:15px">' + escHtml(title) + '</div>' +
      '<label style="font-size:13px;color:var(--text-secondary,#666);display:block;margin-bottom:6px">' + escHtml(label) + '</label>' +
      '<input id="fm_modalInput" type="text" placeholder="' + escAttr(placeholder) + '" ' +
        'onkeydown="if(event.key===\'Enter\')FileManager._confirmInput();if(event.key===\'Escape\')FileManager._closeModal()" ' +
        'style="width:100%;box-sizing:border-box;margin-bottom:14px;padding:7px 10px;font-size:13px;border:0.5px solid var(--border-strong,#bbb);border-radius:var(--radius,8px);font-family:inherit;color:var(--text-primary,#1a1a18);background:var(--surface-2,#fff)">' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button onclick="FileManager._closeModal()" style="' + BT_BASE + '">' + t('cancel') + '</button>' +
      '<button onclick="FileManager._confirmInput()" style="' + BT_ACCENT + '">' + t('confirm') + '</button>' +
      '</div></div></div>';
    _appendOverlay(html);
    setTimeout(function () {
      var inp = document.getElementById('fm_modalInput');
      if (inp) inp.focus();
    }, 30);
  }

  function _appendOverlay(html) {
    var old = document.getElementById('fm_overlay');
    if (old) old.parentNode.removeChild(old);
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
  }

  /* ── рендер ──────────────────────────────────────── */
  function render() {
    var container = document.getElementById(_containerId);
    if (!container) return;

    var folders = getFolders();
    var files = getFiles();
    var crumbs = breadcrumbs();

    var html = '<div style="font-family:var(--font-sans,system-ui,sans-serif);color:var(--text-primary,#1a1a18)">';

    /* Панель меню */
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;' +
      'background:#455a6e;border:1px solid #bbb;border-bottom:2px solid #999;margin-bottom:0">';
    html += btn(t('create_folder'),  'ti-folder-plus', 'FileManager._createFolder()');
    html += btn(t('add_file'),    'ti-file-upload',  'FileManager._addFile()', '');
    html += btn(t('view_file'),'ti-eye',          'FileManager._viewFile()');
    html += btn(t('copy_file'),'ti-copy',         'FileManager._copyFile()');
    html += btn(t('cut_file'), 'ti-cut',          'FileManager._cutFile()');
    html += btn(t('paste_file'),'ti-paste',       'FileManager._pasteFile()');
    html += btn(t('save_file'),  'ti-download',     'FileManager._saveFile()');
    html += btn(t('delete'),       'ti-trash',        'FileManager._deleteEntry()');
    html += '<input type="file" id="fm_fileInput" accept=".txt,.png" ' +
      'onchange="FileManager._handleFileInput(this)" style="display:none">';
    html += '</div>';

    /* Хліббокрошки */
    html += '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:5px 10px;' +
      'background:#fafafa;border-left:1px solid #bbb;border-right:1px solid #bbb;border-top:1px solid #ddd;font-size:13px">';
    html += '<span style="font-size:13px">&#127968;</span>';
    crumbs.forEach(function (c, i) {
      if (i < crumbs.length - 1) {
        html += '<button onclick="FileManager._navigateTo(\'' + escAttr(c.path) + '\')" ' +
          'style="background:none;border:none;color:#2563eb;cursor:pointer;font-size:13px;padding:0;font-family:inherit">' +
          escHtml(c.label) + '</button>';
        html += '<span style="color:#bbb;padding:0 2px">&rsaquo;</span>';
      } else {
        html += '<span style="color:#1a1a18;font-weight:500">' + escHtml(c.label) + '</span>';
      }
    });
    html += '</div>';

    /* Повідомлення */
    if (_notification) {
      var nc = _notification.type === 'error' ? 'var(--bg-danger,#fef2f2)' :
               _notification.type === 'success' ? 'var(--bg-success,#f0fdf4)' : 'var(--bg-accent,#eff6ff)';
      var tc = _notification.type === 'error' ? 'var(--text-danger,#b91c1c)' :
               _notification.type === 'success' ? 'var(--text-success,#166534)' : 'var(--text-accent,#1d4ed8)';
      html += '<div style="padding:8px 14px;font-size:13px;background:' + nc + ';color:' + tc + ';' +
        'border-left:0.5px solid var(--border,#ddd);border-right:0.5px solid var(--border,#ddd)">' +
        escHtml(_notification.msg) + '</div>';
    }

    /* Фрейм зі значками */
    html += '<div style="border:1px solid #bbb;border-top:none;' +
      'background:#fff;max-height:380px;overflow-y:auto;padding:4px 0">';

    if (_cwd !== SEP) {
      html += entryRow('ti-corner-left-up', t('up'), '__up__', false, false, true);
    }

    if (folders.length === 0 && files.length === 0) {
      html += '<div style="padding:40px 20px;text-align:center;color:var(--text-muted,#999);font-size:13px">'+t('empty')+'</div>';
    }

    folders.forEach(function (name) {
      html += entryRow('ti-folder-filled', name, name, true, _selected === name, false, '#e8a000');
    });

    files.forEach(function (name) {
      var isImg = name.split('.').pop().toLowerCase() === 'png';
      html += entryRow(isImg ? 'ti-photo' : 'ti-file-text', name, name, false, _selected === name, false);
    });

    html += '</div>';

    /* Рядок стану */
    html += '<div style="font-size:12px;color:var(--text-muted,#999);margin-top:6px;padding-left:2px">' +
      folders.length + ' ' + (folders.length === 1 ? t('folder_singular') : t('folder_plural')) + ', ' +
      files.length + ' ' + (files.length === 1 ? t('file_singular') : t('file_plural')) +
      ' · ' + t('hint') + '</div>';

    if (_clipboard) {
      html += '<div style="font-size:12px;color:var(--fill-accent,#2563eb);margin-top:2px;padding-left:2px">' +
        escHtml(t(_clipboard.mode === 'cut' ? 'clipboard_cut' : 'clipboard_copy', { name: _clipboard.name })) +
        '</div>';
    }

    /* Вікно перегляду */
    if (_viewState) {
      html += '<div id="fm_viewOverlay" onclick="if(event.target.id===\'fm_viewOverlay\')FileManager._closeView()" ' +
        'style="position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999">' +
        '<div style="background:var(--surface-2,#fff);border-radius:12px;border:0.5px solid var(--border,#ddd);padding:20px 24px;min-width:300px;max-width:520px;width:92%">' +
        '<div style="font-weight:500;margin-bottom:12px;font-size:15px">' +
        '<span style="margin-right:6px">👁️</span>' + escHtml(_viewState.name) + '</div>' +
        '<div style="background:var(--surface-0,#f5f5f3);border-radius:var(--radius,8px);border:0.5px solid var(--border,#ddd);padding:12px 14px;max-height:300px;overflow-y:auto">';

      if (_viewState.isImage) {
        html += '<img src="' + escAttr(_viewState.content) + '" alt="' + escAttr(_viewState.name) + '" style="max-width:100%;border-radius:4px">';
      } else {
        html += '<pre style="margin:0;white-space:pre-wrap;font-size:13px;color:var(--text-primary,#1a1a18);font-family:var(--font-mono,monospace)">' +
          escHtml(_viewState.content) + '</pre>';
      }

      html += '</div><div style="display:flex;justify-content:flex-end;margin-top:12px">' +
        '<button onclick="FileManager._closeView()" style="' + BT_BASE + '">' + t('close') + '</button>' +
        '</div></div></div>';
    }

    html += '</div>'; /* зовнішній контейнер */
    container.innerHTML = html;
  }

  /* ── публічний API (викликається з HTML) ─────────── */
  return {
    init: init,

    _goUp:         function () { goUp(); },
    _navigate:     function (name) { navigate(name); },
    _navigateTo:   function (path) { navigateTo(path); },
    _selectEntry:  function (name) { _selected = _selected === name ? null : name; render(); },
    _openView:     function (name) {
      _selected = name;
      var fullPath = _cwd === SEP ? SEP + name : _cwd + SEP + name;
      var content = _fs.read(fullPath);
      if (typeof content !== 'string') content = JSON.stringify(content, null, 2);
      var isImage = name.split('.').pop().toLowerCase() === 'png';
      _viewState = { name: name, content: content, isImage: isImage };
      render();
    },
    _closeView:    function () { _viewState = null; render(); },

    _createFolder: createFolder,
    _addFile:      addFile,
    _handleFileInput: handleFileInput,
    _viewFile:     viewFile,
    _copyFile:     copyEntry,
    _cutFile:      cutEntry,
    _pasteFile:    pasteEntry,
    _saveFile:     saveFile,
    _deleteEntry:  deleteEntry,
    t:             t,

    _closeModal:   function () {
      var ov = document.getElementById('fm_overlay');
      if (ov) ov.parentNode.removeChild(ov);
      _modalCb = null;
    },
    _confirmModal: function () {
      var cb = _modalCb; _modalCb = null;
      var ov = document.getElementById('fm_overlay');
      if (ov) ov.parentNode.removeChild(ov);
      if (cb) { cb(); render(); }
    },
    _confirmInput: function () {
      var inp = document.getElementById('fm_modalInput');
      if (!inp || !inp.value.trim()) return;
      var val = inp.value;
      var cb = _modalCb; _modalCb = null;
      var ov = document.getElementById('fm_overlay');
      if (ov) ov.parentNode.removeChild(ov);
      if (cb) { cb(val); render(); }
    },


    /* click-timing double-click (works inside jQuery UI dialog) */
    _clickEntry: function (key, isFolder) {
      var now = Date.now();
      var dbl = (_lastClick.key === key && (now - _lastClick.time) < 400);
      _lastClick = { key: key, time: now };
      if (dbl) {
        _lastClick = { key: null, time: 0 };
        if (key === '__up__') { goUp(); }
        else if (isFolder)   { navigate(key); }
        else                 { FileManager._openView(key); }
      } else {
        if (key === '__up__') { goUp(); }
        else { _selected = (_selected === key) ? null : key; render(); }
      }
    }
  };
}());

/*
  openFileBrowser() — глобальна функція-сумісність із зовнішнім кодом.
  Якщо є jQuery UI діалог #filemanager — відкриває його, інакше показує
  вбудований менеджер у контейнері 'fm' (створює його, якщо відсутній).
*/
/* ── внутрішня ініціалізація FileManager у контейнері #fm ── */
function _initFM() {
  var container = document.getElementById('fm');
  if (!container) return;
  var fsInst = (typeof fsToBrowse !== 'undefined') ? fsToBrowse : null;
  if (!fsInst && typeof FileSystem !== 'undefined') {
    window.fsToBrowse = new FileSystem('epythonfs');
    fsInst = window.fsToBrowse;
  }
  if (fsInst) FileManager.init('fm', fsInst);
}

function openFileBrowser() {
  /* варіант 1: jQuery UI діалог #filemanager існує */
  if (typeof $ !== 'undefined' && $('#filemanager').length) {
    var $dlg = $('#filemanager');

    /* гарантуємо наявність внутрішнього контейнера */
    if (!$dlg.find('#fm').length) {
      $dlg.html('<div id="fm" style="padding:4px 8px"></div>');
    }

    /* ініціалізуємо діалог, якщо ще не було */
    if (!$dlg.hasClass('ui-dialog-content')) {
      $dlg.dialog({
        autoOpen:  false,
        modal:     false,
        width:     Math.min(660, window.innerWidth * 0.96),
        maxHeight: 540,
        title:     FileManager.t('dialog_title'),
        open: function () { _initFM(); }
      });
    }

    $dlg.dialog('option', 'title', FileManager.t('dialog_title')).dialog('open');
    /* підлаштовуємо ширину при зміні розмірів вікна */
    $(window).off('resize.fmdlg').on('resize.fmdlg', function () {
      if ($dlg.dialog('isOpen')) {
        $dlg.dialog('option', 'width', Math.min(660, window.innerWidth * 0.96));
        $dlg.dialog('option', 'position', { my: 'center', at: 'center', of: window });
      }
    });
    /* якщо open-callback вже не спрацює повторно — ініціалізуємо тут */
    _initFM();
    return;
  }

  /* варіант 2: власний модальний оверлей із FileManager всередині */
  var OVERLAY_ID = 'fm_browser_overlay';
  if (document.getElementById(OVERLAY_ID)) {
    document.getElementById(OVERLAY_ID).style.display = 'flex';
    _initFM();  /* скидаємо до кореня при кожному відкритті */
    return;
  }

  /* створюємо оверлей */
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);' +
    'display:flex;align-items:center;justify-content:center;z-index:9000';

  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface-2,#fff);border-radius:12px;' +
    'border:0.5px solid var(--border,#ddd);width:min(660px,96vw);' +
    'max-height:90vh;overflow-y:auto;padding:0 0 12px';

  /* заголовок із кнопкою закриття */
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;' +
    'padding:12px 16px 0;margin-bottom:4px';
  header.innerHTML = '<span style="font-weight:500;font-size:15px;font-family:var(--font-sans,system-ui,sans-serif)">' + FileManager.t('dialog_title') + '</span>' +
    '<button onclick="closeFileBrowser()" style="background:none;border:none;cursor:pointer;' +
    'font-size:20px;line-height:1;color:var(--text-muted,#999);font-family:inherit" ' +
    'aria-label="'+FileManager.t('close_label')+'"><i class="ti ti-x"></i></button>';

  var inner = document.createElement('div');
  inner.id = 'fm';
  inner.style.cssText = 'padding:0 16px';

  box.appendChild(header);
  box.appendChild(inner);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  /* клік поза діалогом — закрити */
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeFileBrowser();
  });

  _initFM();
}

function closeFileBrowser() {
  var ov = document.getElementById('fm_browser_overlay');
  if (ov) ov.style.display = 'none';
}
