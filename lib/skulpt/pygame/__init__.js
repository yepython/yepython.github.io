/*
 * pygame for Skulpt — актуалізована версія 2025
 * Базується на оригінальному коді Petlja (2017)
 *
 * Виправлення та доповнення:
 *  - Правильна архітектура: один $builtinmodule + Sk.builtinFiles для підмодулів
 *  - Виправлено помилку draw_lines (інвертована логіка ширини)
 *  - Виправлено centery_setter (параметр val)
 *  - Виправлено Surface.copy (висота/ширина)
 *  - Виправлено alpha у extract_color (0–255, не 0–1)
 *  - Виправлено imageExists → async через fetch
 *  - Sk.builtins.function → Sk.builtin.func
 *  - Додано: mixer (заглушка), sprite.Group/Sprite, math.Vector2
 *  - Додано: Surface.set_alpha/get_alpha, set_colorkey/get_colorkey, lock/unlock
 *  - Додано: Rect.__eq__, __ne__, __iter__, Rect(4-tuple), Rect(Rect)
 *  - Додано: Color.__getitem__, __iter__, __eq__
 *  - Додано: event.post, event.clear, event.peek
 *  - Додано: pygame.locals (аліаси констант)
 */

// ─────────────────────────────────────────────────────────────────────────────
// PygameLib — глобальний простір стану
// ─────────────────────────────────────────────────────────────────────────────
var PygameLib = {
    running: false,
    surface: null,
    caption: '',
    eventQueue: [],
    eventTimer: {},
    pressedKeys: {},
    mouseData: { button: [0, 0, 0], pos: [0, 0], rel: [0, 0] },
    repeatKeys: false,
    initial_time: new Date(),
    // типи (заповнюються при pygame.init())
    SurfaceType: null,
    RectType: null,
    ColorType: null,
    EventType: null,
    FontType: null,
    ClockType: null,
    Colors: null,
    constants: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Утиліти
// ─────────────────────────────────────────────────────────────────────────────
PygameLib.extract_color = function (color) {
    if (Sk.abstr.typeName(color) === 'Color') {
        return [color._r, color._g, color._b, color._a / 255];
    }
    var c = Sk.ffi.remapToJs(color);
    // підтримка рядкових кольорів: 'red', '#ff0000'
    if (typeof c === 'string') {
        var named = PygameLib.Colors[c.toLowerCase()];
        if (named) return [named[0], named[1], named[2], named[3] / 255];
        // fallback через canvas
        var tmp = document.createElement('canvas').getContext('2d');
        tmp.fillStyle = c;
        var hex = tmp.fillStyle; // браузер нормалізує
        if (hex.startsWith('#')) {
            var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            return [r, g, b, 1];
        }
        return [0, 0, 0, 1];
    }
    if (c.length === 3) return [c[0], c[1], c[2], 1];
    return [c[0], c[1], c[2], c[3] / 255];
};

PygameLib.extract_rect = function (rect) {
    if (Sk.abstr.typeName(rect) === 'Rect') {
        // Використовуємо Sk.abstr.gattr + remapToJs для отримання справжніх JS-чисел
        var l = Sk.abstr.gattr(rect, new Sk.builtin.str('left'), false);
        var t = Sk.abstr.gattr(rect, new Sk.builtin.str('top'), false);
        var w = Sk.abstr.gattr(rect, new Sk.builtin.str('width'), false);
        var h = Sk.abstr.gattr(rect, new Sk.builtin.str('height'), false);
        return [
            Sk.ffi.remapToJs(l),
            Sk.ffi.remapToJs(t),
            Sk.ffi.remapToJs(w),
            Sk.ffi.remapToJs(h)
        ];
    }
    var r = Sk.ffi.remapToJs(rect);
    if (Array.isArray(r[0])) return [r[0][0], r[0][1], r[1][0], r[1][1]];
    return r;
};

PygameLib.cssColor = function(c) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + c[3] + ')';
};

//
function unpackKWA(kwa) {
    var result = {};
    if (!kwa) return result;
    
    // У Skulpt при co_kwargs=true аргументи приходять як масив [key1, val1, key2, val2]
    if (Array.isArray(kwa)) {
        for (var i = 0; i < kwa.length; i += 2) {
            var key = Sk.ffi.remapToJs(kwa[i]);
            var val = kwa[i + 1];
            result[key] = val;
        }
    } else if (kwa.mp) {
        // Фоллбек, якщо раптом прийшло як словник
        for (var k in kwa.mp) {
            result[Sk.ffi.remapToJs(k)] = kwa.mp[k];
        }
    }
    return result;
}
// ─────────────────────────────────────────────────────────────────────────────
// Константи pygame
// ─────────────────────────────────────────────────────────────────────────────
PygameLib.constants = {
    'ACTIVEEVENT': 1, 'ANYFORMAT': 268435456, 'ASYNCBLIT': 4,
    'AUDIO_S16': 32784, 'AUDIO_S16LSB': 32784, 'AUDIO_S16MSB': 36880,
    'AUDIO_S16SYS': 32784, 'AUDIO_S8': 32776, 'AUDIO_U16': 16,
    'AUDIO_U16LSB': 16, 'AUDIO_U16MSB': 4112, 'AUDIO_U16SYS': 16,
    'AUDIO_U8': 8, 'BIG_ENDIAN': 4321,
    'BLEND_ADD': 1, 'BLEND_MAX': 5, 'BLEND_MIN': 4, 'BLEND_MULT': 3,
    'BLEND_PREMULTIPLIED': 17, 'BLEND_RGBA_ADD': 6, 'BLEND_RGBA_MAX': 16,
    'BLEND_RGBA_MIN': 9, 'BLEND_RGBA_MULT': 8, 'BLEND_RGBA_SUB': 7,
    'BLEND_RGB_ADD': 1, 'BLEND_RGB_MAX': 5, 'BLEND_RGB_MIN': 4,
    'BLEND_RGB_MULT': 3, 'BLEND_RGB_SUB': 2, 'BLEND_SUB': 2,
    'BUTTON_X1': 6, 'BUTTON_X2': 7,
    'DOUBLEBUF': 1073741824, 'FULLSCREEN': -2147483648,
    'HWSURFACE': 1, 'SWSURFACE': 0, 'NOFRAME': 32, 'RESIZABLE': 16,
    'SRCALPHA': 65536, 'SRCCOLORKEY': 4096,
    'JOYAXISMOTION': 7, 'JOYBALLMOTION': 8, 'JOYBUTTONDOWN': 10,
    'JOYBUTTONUP': 11, 'JOYHATMOTION': 9,
    'KEYDOWN': 2, 'KEYUP': 3,
    'KMOD_ALT': 768, 'KMOD_CAPS': 8192, 'KMOD_CTRL': 192,
    'KMOD_LALT': 256, 'KMOD_LCTRL': 64, 'KMOD_LMETA': 1024,
    'KMOD_LSHIFT': 1, 'KMOD_META': 3072, 'KMOD_MODE': 16384,
    'KMOD_NONE': 0, 'KMOD_NUM': 4096, 'KMOD_RALT': 512,
    'KMOD_RCTRL': 128, 'KMOD_RMETA': 2048, 'KMOD_RSHIFT': 2,
    'KMOD_SHIFT': 3,
    'K_0': 48, 'K_1': 49, 'K_2': 50, 'K_3': 51, 'K_4': 52,
    'K_5': 53, 'K_6': 54, 'K_7': 55, 'K_8': 56, 'K_9': 57,
    'K_AMPERSAND': 38, 'K_ASTERISK': 42, 'K_AT': 64,
    'K_BACKQUOTE': 96, 'K_BACKSLASH': 92, 'K_BACKSPACE': 8,
    'K_BREAK': 318, 'K_CAPSLOCK': 301, 'K_CARET': 94,
    'K_CLEAR': 12, 'K_COLON': 58, 'K_COMMA': 44,
    'K_DELETE': 127, 'K_DOLLAR': 36, 'K_DOWN': 274,
    'K_END': 279, 'K_EQUALS': 61, 'K_ESCAPE': 27, 'K_EURO': 321,
    'K_EXCLAIM': 33,
    'K_F1': 282, 'K_F2': 283, 'K_F3': 284, 'K_F4': 285,
    'K_F5': 286, 'K_F6': 287, 'K_F7': 288, 'K_F8': 289,
    'K_F9': 290, 'K_F10': 291, 'K_F11': 292, 'K_F12': 293,
    'K_F13': 294, 'K_F14': 295, 'K_F15': 296,
    'K_FIRST': 0, 'K_GREATER': 62, 'K_HASH': 35, 'K_HELP': 315,
    'K_HOME': 278, 'K_INSERT': 277,
    'K_KP0': 256, 'K_KP1': 257, 'K_KP2': 258, 'K_KP3': 259,
    'K_KP4': 260, 'K_KP5': 261, 'K_KP6': 262, 'K_KP7': 263,
    'K_KP8': 264, 'K_KP9': 265,
    'K_KP_DIVIDE': 267, 'K_KP_ENTER': 271, 'K_KP_EQUALS': 272,
    'K_KP_MINUS': 269, 'K_KP_MULTIPLY': 268, 'K_KP_PERIOD': 266,
    'K_KP_PLUS': 270,
    'K_LALT': 308, 'K_LAST': 323, 'K_LCTRL': 306,
    'K_LEFT': 276, 'K_LEFTBRACKET': 91, 'K_LEFTPAREN': 40,
    'K_LESS': 60, 'K_LMETA': 310, 'K_LSHIFT': 304, 'K_LSUPER': 311,
    'K_MENU': 319, 'K_MINUS': 45, 'K_MODE': 313,
    'K_NUMLOCK': 300, 'K_PAGEDOWN': 281, 'K_PAGEUP': 280,
    'K_PAUSE': 19, 'K_PERIOD': 46, 'K_PLUS': 43, 'K_POWER': 320,
    'K_PRINT': 316, 'K_QUESTION': 63, 'K_QUOTE': 39,
    'K_QUOTEDBL': 34, 'K_RALT': 307, 'K_RCTRL': 305,
    'K_RETURN': 13, 'K_RIGHT': 275, 'K_RIGHTBRACKET': 93,
    'K_RIGHTPAREN': 41, 'K_RMETA': 309, 'K_RSHIFT': 303,
    'K_RSUPER': 312, 'K_SCROLLOCK': 302, 'K_SEMICOLON': 59,
    'K_SLASH': 47, 'K_SPACE': 32, 'K_SYSREQ': 317, 'K_TAB': 9,
    'K_UNDERSCORE': 95, 'K_UNKNOWN': 0, 'K_UP': 273,
    'K_a': 97, 'K_b': 98, 'K_c': 99, 'K_d': 100, 'K_e': 101,
    'K_f': 102, 'K_g': 103, 'K_h': 104, 'K_i': 105, 'K_j': 106,
    'K_k': 107, 'K_l': 108, 'K_m': 109, 'K_n': 110, 'K_o': 111,
    'K_p': 112, 'K_q': 113, 'K_r': 114, 'K_s': 115, 'K_t': 116,
    'K_u': 117, 'K_v': 118, 'K_w': 119, 'K_x': 120, 'K_y': 121,
    'K_z': 122,
    'LIL_ENDIAN': 1234, 'MOUSEBUTTONDOWN': 5, 'MOUSEBUTTONUP': 6,
    'MOUSEMOTION': 4, 'NOEVENT': 0, 'NUMEVENTS': 32,
    'OPENGL': 2, 'OPENGLBLIT': 10, 'PREALLOC': 16777216,
    'QUIT': 12, 'RLEACCEL': 16384, 'RLEACCELOK': 8192,
    'SYSWMEVENT': 13, 'TIMER_RESOLUTION': 10,
    'USEREVENT': 24, 'VIDEOEXPOSE': 17, 'VIDEORESIZE': 16,
    'HAVE_NEWBUF': 1, 'HWACCEL': 256, 'HWPALETTE': 536870912,
};

// ─────────────────────────────────────────────────────────────────────────────
// Таблиця кольорів
// ─────────────────────────────────────────────────────────────────────────────
PygameLib.Colors = {
    'black': [0,0,0,255], 'white': [255,255,255,255],
    'red': [255,0,0,255], 'green': [0,255,0,255], 'blue': [0,0,255,255],
    'yellow': [255,255,0,255], 'cyan': [0,255,255,255], 'magenta': [255,0,255,255],
    'orange': [255,165,0,255], 'purple': [160,32,240,255],
    'gray': [190,190,190,255], 'grey': [190,190,190,255],
    'darkgray': [169,169,169,255], 'darkgrey': [169,169,169,255],
    'lightgray': [211,211,211,255], 'lightgrey': [211,211,211,255],
    'brown': [165,42,42,255], 'pink': [255,192,203,255],
    'gold': [255,215,0,255], 'silver': [192,192,192,255],
    'coral': [255,127,80,255], 'salmon': [250,128,114,255],
    'aqua': [0,255,255,255], 'lime': [0,255,0,255],
    'navy': [0,0,128,255], 'teal': [0,128,128,255],
    'maroon': [176,48,96,255], 'olive': [128,128,0,255],
    'darkgreen': [0,100,0,255], 'darkblue': [0,0,139,255],
    'darkred': [139,0,0,255], 'darkcyan': [0,139,139,255],
    'darkmagenta': [139,0,139,255], 'darkviolet': [148,0,211,255],
    'darkorange': [255,140,0,255], 'darkorchid': [153,50,204,255],
    'darkslateblue': [72,61,139,255], 'darkslategray': [47,79,79,255],
    'darkslategrey': [47,79,79,255], 'darkturquoise': [0,206,209,255],
    'deeppink': [255,20,147,255], 'deepskyblue': [0,191,255,255],
    'dimgray': [105,105,105,255], 'dimgrey': [105,105,105,255],
    'dodgerblue': [30,144,255,255], 'firebrick': [178,34,34,255],
    'forestgreen': [34,139,34,255], 'fuchsia': [255,0,255,255],
    'gainsboro': [220,220,220,255], 'goldenrod': [218,165,32,255],
    'greenyellow': [173,255,47,255], 'hotpink': [255,105,180,255],
    'indianred': [205,92,92,255], 'indigo': [75,0,130,255],
    'khaki': [240,230,140,255], 'lavender': [230,230,250,255],
    'lawngreen': [124,252,0,255], 'limegreen': [50,205,50,255],
    'mediumblue': [0,0,205,255], 'mediumpurple': [147,112,219,255],
    'mediumseagreen': [60,179,113,255], 'mediumslateblue': [123,104,238,255],
    'mediumspringgreen': [0,250,154,255], 'mediumturquoise': [72,209,204,255],
    'mediumvioletred': [199,21,133,255], 'midnightblue': [25,25,112,255],
    'mintcream': [245,255,250,255], 'mistyrose': [255,228,225,255],
    'moccasin': [255,228,181,255], 'oldlace': [253,245,230,255],
    'olivedrab': [107,142,35,255], 'orangered': [255,69,0,255],
    'orchid': [218,112,214,255], 'palegoldenrod': [238,232,170,255],
    'palegreen': [152,251,152,255], 'paleturquoise': [175,238,238,255],
    'palevioletred': [219,112,147,255], 'papayawhip': [255,239,213,255],
    'peachpuff': [255,218,185,255], 'peru': [205,133,63,255],
    'plum': [221,160,221,255], 'powderblue': [176,224,230,255],
    'rosybrown': [188,143,143,255], 'royalblue': [65,105,225,255],
    'saddlebrown': [139,69,19,255], 'sandybrown': [244,164,96,255],
    'seagreen': [46,139,87,255], 'seashell': [255,245,238,255],
    'sienna': [160,82,45,255], 'skyblue': [135,206,235,255],
    'slateblue': [106,90,205,255], 'slategray': [112,128,144,255],
    'slategrey': [112,128,144,255], 'snow': [255,250,250,255],
    'springgreen': [0,255,127,255], 'steelblue': [70,130,180,255],
    'tan': [210,180,140,255], 'thistle': [216,191,216,255],
    'tomato': [255,99,71,255], 'turquoise': [64,224,208,255],
    'violet': [238,130,238,255], 'wheat': [245,222,179,255],
    'yellowgreen': [154,205,50,255],
    'aquamarine': [127,255,212,255], 'azure': [240,255,255,255],
    'beige': [245,245,220,255], 'bisque': [255,228,196,255],
    'blanchedalmond': [255,235,205,255], 'blueviolet': [138,43,226,255],
    'burlywood': [222,184,135,255], 'cadetblue': [95,158,160,255],
    'chartreuse': [127,255,0,255], 'chocolate': [210,105,30,255],
    'cornflowerblue': [100,149,237,255], 'cornsilk': [255,248,220,255],
    'crimson': [220,20,60,255], 'floralwhite': [255,250,240,255],
    'ghostwhite': [248,248,255,255], 'honeydew': [240,255,240,255],
    'ivory': [255,255,240,255], 'lavenderblush': [255,240,245,255],
    'lemonchiffon': [255,250,205,255], 'lightyellow': [255,255,224,255],
    'linen': [250,240,230,255], 'mintcream': [245,255,250,255],
    'navajowhite': [255,222,173,255],
    'lightsalmon': [255,160,122,255], 'lightcoral': [240,128,128,255],
    'lightcyan': [224,255,255,255], 'lightgoldenrodyellow': [250,250,210,255],
    'lightgreen': [144,238,144,255], 'lightpink': [255,182,193,255],
    'lightskyblue': [135,206,250,255], 'lightslategray': [119,136,153,255],
    'lightslategrey': [119,136,153,255], 'lightsteelblue': [176,196,222,255],
    'lightblue': [173,216,230,255], 'lightyellow': [255,255,224,255],
    'limegreen': [50,205,50,255], 'magenta': [255,0,255,255],
};

// ─────────────────────────────────────────────────────────────────────────────
// Обробники подій клавіатури та миші
// ─────────────────────────────────────────────────────────────────────────────
var keyToName = [
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "backspace","tab","unknown","unknown","clear","return","unknown","unknown",
    "unknown","unknown","unknown","pause","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","escape","unknown","unknown","unknown","unknown",
    "space","!","\"","#","$","unknown","&","'",
    "(",")","*","+",",","-",".","/",
    "0","1","2","3","4","5","6","7",
    "8","9",":",";","<","=",">","?",
    "@","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","[","\\","]","^","_",
    "`","a","b","c","d","e","f","g",
    "h","i","j","k","l","m","n","o",
    "p","q","r","s","t","u","v","w",
    "x","y","z","unknown","unknown","unknown","unknown","delete",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "unknown","unknown","unknown","unknown","unknown","unknown","unknown","unknown",
    "[0]","[1]","[2]","[3]","[4]","[5]","[6]","[7]",
    "[8]","[9]","[.]","[/]","[*]","[-]","[+]","[enter]",
    "[=]","up","down","right","left","insert","home","end",
    "page up","page down","f1","f2","f3","f4","f5","f6",
    "f7","f8","f9","f10","f11","f12","f13","f14",
    "f15","unknown","unknown","unknown","numlock","caps lock","scroll lock","right shift",
    "left shift","right ctrl","left ctrl","right alt","left alt","right meta","left meta","left super",
    "right super","mode","unknown","help","print screen","sys req","break","menu",
    "power","euro","undo",
];


var createKeyboardEvent = function (event) {
    var keyPGConstant = (event.type === 'keyup')
        ? PygameLib.constants.KEYUP
        : PygameLib.constants.KEYDOWN;
    var c = PygameLib.constants;

    // Обчислюємо mod — бітова маска активних модифікаторів
    function getCurrentMod() {
        var mask = 0;
        var pk = PygameLib.pressedKeys;
        if (pk[c.K_LSHIFT] || pk[c.K_RSHIFT]) mask |= c.KMOD_SHIFT;
        if (pk[c.K_LCTRL]  || pk[c.K_RCTRL])  mask |= c.KMOD_CTRL;
        if (pk[c.K_LALT]   || pk[c.K_RALT])   mask |= c.KMOD_ALT;
        if (pk[c.K_LMETA]  || pk[c.K_RMETA])  mask |= c.KMOD_META;
        if (pk[c.K_CAPSLOCK])  mask |= c.KMOD_CAPS;
        if (pk[c.K_NUMLOCK])   mask |= c.KMOD_NUM;
        // також враховуємо поточну подію якщо це KEYDOWN
        if (event.shiftKey) mask |= c.KMOD_SHIFT;
        if (event.ctrlKey)  mask |= c.KMOD_CTRL;
        if (event.altKey)   mask |= c.KMOD_ALT;
        if (event.metaKey)  mask |= c.KMOD_META;
        return mask;
    }

    function makeEvt(key) {
        return { key: key, mod: getCurrentMod(), unicode: event.key || '' };
    }

    switch (event.which) {
        case 27: return [PygameLib.constants.QUIT, makeEvt(c.K_ESCAPE)];
        case 37: return [keyPGConstant, makeEvt(c.K_LEFT)];
        case 38: return [keyPGConstant, makeEvt(c.K_UP)];
        case 39: return [keyPGConstant, makeEvt(c.K_RIGHT)];
        case 40: return [keyPGConstant, makeEvt(c.K_DOWN)];
        case 13: return [keyPGConstant, makeEvt(c.K_RETURN)];
        case 8:  return [keyPGConstant, makeEvt(c.K_BACKSPACE)];
        case 9:  return [keyPGConstant, makeEvt(c.K_TAB)];
        case 32: return [keyPGConstant, makeEvt(c.K_SPACE)];
        default:
            var diff = (event.which >= 65 && event.which <= 90) ? 32 : 0;
            return [keyPGConstant, makeEvt(event.which + diff)];
    }
};

function keyEventListener(event) {
    var e = createKeyboardEvent(event);
    if (e[0] === PygameLib.constants.KEYDOWN)
        PygameLib.pressedKeys[e[1].key] = true;
    else if (e[0] === PygameLib.constants.KEYUP)
        delete PygameLib.pressedKeys[e[1].key];
    if (PygameLib.eventQueue) {
        if (PygameLib.repeatKeys) {
            PygameLib.eventQueue.unshift(e);
        } else {
            if (!('repeat' in event) || !event.repeat)
                PygameLib.eventQueue.unshift(e);
        }
    }
    if (PygameLib.running) event.preventDefault();
}

var mouseEventListener = function (event) {
    var rect = this.getBoundingClientRect();
    var canvasX = event.clientX - rect.left;
    var canvasY = event.clientY - rect.top;
    var button = event.button;
    var e;
    if (event.type === 'mousedown') {
        e = [PygameLib.constants.MOUSEBUTTONDOWN,
            { key: PygameLib.constants.MOUSEBUTTONDOWN, pos: [canvasX, canvasY], button: button + 1 }];
        PygameLib.mouseData.button[button] = 1;
    } else if (event.type === 'mouseup') {
        e = [PygameLib.constants.MOUSEBUTTONUP,
            { key: PygameLib.constants.MOUSEBUTTONUP, pos: [canvasX, canvasY], button: button + 1 }];
        PygameLib.mouseData.button[button] = 0;
    } else if (event.type === 'mousemove') {
        var lb = (event.buttons & 1) ? 1 : 0;
        var mb = (event.buttons & 4) ? 1 : 0;
        var rb = (event.buttons & 2) ? 1 : 0;
        e = [PygameLib.constants.MOUSEMOTION,
            { key: PygameLib.constants.MOUSEMOTION, pos: [canvasX, canvasY],
              rel: [event.movementX, event.movementY], buttons: [lb, mb, rb] }];
        PygameLib.mouseData.pos = [canvasX, canvasY];
        PygameLib.mouseData.rel = [event.movementX, event.movementY];
    }
    if (e) PygameLib.eventQueue.unshift(e);
};

var wheelEventListener = function (event) {
    var rect = this.getBoundingClientRect ? this.getBoundingClientRect() : {left: 0, top: 0};
    var canvasX = event.clientX - rect.left;
    var canvasY = event.clientY - rect.top;
    
    // У Pygame: 4 = Scroll Up, 5 = Scroll Down
    var button = event.deltaY < 0 ? 4 : 5; 
    
    var e = [PygameLib.constants.MOUSEBUTTONDOWN,
        { key: PygameLib.constants.MOUSEBUTTONDOWN, pos: [canvasX, canvasY], button: button }];
        
    if (PygameLib.eventQueue) {
        PygameLib.eventQueue.unshift(e);
    }
    if (PygameLib.running) event.preventDefault();
};

// Зовнішній API вставки подій (для кнопок-стрілок на сторінці)
Sk.insertEvent = function (eventName) {
    var c = PygameLib.constants;
    var e;
    switch (eventName) {
        case 'left':  e = [c.KEYDOWN, { key: c.K_LEFT }]; break;
        case 'right': e = [c.KEYDOWN, { key: c.K_RIGHT }]; break;
        case 'up':    e = [c.KEYDOWN, { key: c.K_UP }]; break;
        case 'down':  e = [c.KEYDOWN, { key: c.K_DOWN }]; break;
        case 'quit':  e = [c.QUIT, { key: c.K_ESCAPE }]; break;
        default: return;
    }
    PygameLib.eventQueue.unshift(e);
};

// ─────────────────────────────────────────────────────────────────────────────
// Surface
// ─────────────────────────────────────────────────────────────────────────────
function fillBlack(ctx, w, h) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);
}

var surface_init = function (self, size, flags, depth) {
    var flags_js = (flags !== undefined) ? Sk.ffi.remapToJs(flags) : 0;
    var isMain = !!(self._main);
    var t = Sk.ffi.remapToJs(size);
    self.width  = Math.round(t[0]);
    self.height = Math.round(t[1]);
    self._alpha = 255;
    self._colorkey = null;
    self._flags = flags_js;

    if (isMain) {
        // Шукаємо існуючий canvas за id або в Sk.main_canvas
        var existingCanvas = (Sk.main_canvas) ? Sk.main_canvas
            : document.getElementById('pygame-canvas');

        if (!existingCanvas) {
            // Створюємо jQuery UI dialog з canvas всередині
            existingCanvas = document.createElement('canvas');
            existingCanvas.id = 'pygame-canvas';
            existingCanvas.setAttribute('tabindex', '0');

            var dlgWrapper = document.createElement('div');
            dlgWrapper.id = 'pygame-dialog';
            dlgWrapper.appendChild(existingCanvas);
            document.body.appendChild(dlgWrapper);

            if (typeof $ !== 'undefined' && $.fn && $.fn.dialog) {
                $(dlgWrapper).dialog({
                    title: PygameLib.caption || 'Pygame',
                    width: 'auto',
                    height: 'auto',
                    resizable: false,
                    modal: false,
                    close: function() {
                        // При закритті діалогу — генеруємо QUIT
                        PygameLib.eventQueue.unshift([PygameLib.constants.QUIT, {}]);
                    }
                });
                // Збереження посилання на dialog для оновлення заголовка
                PygameLib._dialog = dlgWrapper;
            } else {
                // Без jQuery UI — вставляємо просто на сторінку
                existingCanvas.style.cssText = 'border:1px solid darkgray;display:block;outline:none;';
            }

            Sk.main_canvas = existingCanvas;
        }

        self.main_canvas = existingCanvas;

        // Додаємо обробники подій лише один раз
        if (!self.main_canvas._pg_listeners_added) {
            self.main_canvas.addEventListener('mousedown', mouseEventListener);
            self.main_canvas.addEventListener('mouseup',   mouseEventListener);
            self.main_canvas.addEventListener('mousemove', mouseEventListener);
            self.main_canvas.addEventListener('wheel', wheelEventListener);
            window.addEventListener('keydown', keyEventListener);
            window.addEventListener('keyup',   keyEventListener);
            self.main_canvas._pg_listeners_added = true;
        }
    } else {
        self.main_canvas = document.createElement('canvas');
    }

    self.main_canvas.width  = self.width;
    self.main_canvas.height = self.height;
    self.main_context = self.main_canvas.getContext('2d');

    self.offscreen_canvas = document.createElement('canvas');
    self.offscreen_canvas.width  = self.width;
    self.offscreen_canvas.height = self.height;
    self.context2d = self.offscreen_canvas.getContext('2d');

    if (isMain) {
        self.main_canvas.setAttribute('style', 'border:1px solid darkgray;display:block;outline:none;');
        fillBlack(self.main_context, self.width, self.height);
        // Головний екран за замовчуванням чорний (як справжній pygame)
        fillBlack(self.context2d, self.width, self.height);
    }
    // Не-головні поверхні (Surface()) — прозорі, як у справжньому pygame
    return Sk.builtin.none.none$;
};
surface_init.co_varnames = ['self','size','flags','depth'];
surface_init.$defaults = [new Sk.builtin.int_(0), new Sk.builtin.int_(0)];

function surface_class($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(surface_init, $gbl);

    $loc.__repr__ = new Sk.builtin.func(function (self) {
        return Sk.ffi.remapToPy('<Surface(' + self.width + 'x' + self.height + 'x32 SW)>');
    });

    $loc.fill = new Sk.builtin.func(function (self, color, rect) {
        var c = PygameLib.extract_color(color);
        var ctx = self.context2d;
        ctx.fillStyle = PygameLib.cssColor(c);
        if (rect !== undefined && Sk.abstr.typeName(rect) === 'Rect') {
            var r = PygameLib.extract_rect(rect);
            ctx.fillRect(r[0], r[1], r[2], r[3]);
        } else {
            ctx.fillRect(0, 0, self.width, self.height);
        }
        return Sk.builtin.none.none$;
    });

    $loc.blit = new Sk.builtin.func(function (self, other, pos, area) {
        var p;
        if (pos === undefined || pos === Sk.builtin.none.none$) {
            p = [0, 0];
        } else if (Sk.abstr.typeName(pos) === 'Rect') {
            var rp = PygameLib.extract_rect(pos);
            p = [rp[0], rp[1]];
        } else {
            p = Sk.ffi.remapToJs(pos);
            if (Array.isArray(p) && Array.isArray(p[0])) p = p[0];
        }
        var dx = Math.round(p[0]), dy = Math.round(p[1]);
        if (area !== undefined && Sk.abstr.typeName(area) === 'Rect') {
            var ar = PygameLib.extract_rect(area);
            self.context2d.drawImage(other.offscreen_canvas, ar[0], ar[1], ar[2], ar[3], dx, dy, ar[2], ar[3]);
            return Sk.misceval.callsim(PygameLib.RectType,
                new Sk.builtin.tuple([Sk.ffi.remapToPy(dx), Sk.ffi.remapToPy(dy)]),
                new Sk.builtin.tuple([Sk.ffi.remapToPy(ar[2]), Sk.ffi.remapToPy(ar[3])]));
        }
        self.context2d.drawImage(other.offscreen_canvas, dx, dy);
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(dx), Sk.ffi.remapToPy(dy)]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(other.width), Sk.ffi.remapToPy(other.height)]));
    });

    $loc.convert = new Sk.builtin.func(function (self) { return self; });
    $loc.convert_alpha = new Sk.builtin.func(function (self) { return self; });

    // Surface.get_buffer — повертає memoryview-заглушку
    $loc.get_buffer = new Sk.builtin.func(function(self) { return Sk.builtin.none.none$; });

$loc.update = new Sk.builtin.func(function (self) {
    self.main_canvas.width  = self.offscreen_canvas.width;
    self.main_canvas.height = self.offscreen_canvas.height;
    self.main_context.clearRect(0, 0, self.main_canvas.width, self.main_canvas.height);
    self.main_context.drawImage(self.offscreen_canvas, 0, 0);
    return Sk.builtin.none.none$;
});

    $loc.get_width  = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(self.width); });
    $loc.get_height = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(self.height); });
    $loc.get_size   = new Sk.builtin.func(function(self){
        return new Sk.builtin.tuple([Sk.ffi.remapToPy(self.width), Sk.ffi.remapToPy(self.height)]);
    });
    $loc.get_flags  = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(self._flags || 0); });

    $loc.copy = new Sk.builtin.func(function (self) {
        var s = Sk.misceval.callsim(PygameLib.SurfaceType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(self.width), Sk.ffi.remapToPy(self.height)]));
        s.context2d.drawImage(self.offscreen_canvas, 0, 0);
        return s;
    });

    $loc.scroll = new Sk.builtin.func(function (self, dx, dy) {
        var x = dx ? Sk.ffi.remapToJs(dx) : 0;
        var y = dy ? Sk.ffi.remapToJs(dy) : 0;
        var tmp = document.createElement('canvas');
        tmp.width = self.width; tmp.height = self.height;
        tmp.getContext('2d').drawImage(self.offscreen_canvas, 0, 0);
        self.context2d.clearRect(0, 0, self.width, self.height);
        self.context2d.drawImage(tmp, x, y);
        return Sk.builtin.none.none$;
    });

    $loc.get_at = new Sk.builtin.func(function (self, coords) {
        var x = Sk.ffi.remapToJs(coords.v[0]);
        var y = Sk.ffi.remapToJs(coords.v[1]);
        var d = self.context2d.getImageData(x, y, 1, 1).data;
        return new Sk.builtin.tuple([
            Sk.ffi.remapToPy(d[0]), Sk.ffi.remapToPy(d[1]),
            Sk.ffi.remapToPy(d[2]), Sk.ffi.remapToPy(d[3])]);
    });

    $loc.set_at = new Sk.builtin.func(function (self, coords, clr) {
        var rgba = PygameLib.extract_color(clr);
        self.context2d.fillStyle = PygameLib.cssColor(rgba);
        var x = Sk.ffi.remapToJs(coords.v[0]);
        var y = Sk.ffi.remapToJs(coords.v[1]);
        self.context2d.fillRect(x, y, 1, 1);
    });

// get_rect з підтримкою kwargs через js_kwargs_method
// Skulpt передає kwargs як масив [key,val,...] лише в __init__.
// Для звичайних методів kwargs перехоплюємо через tp$call на рівні JS-функції.
var _applyRectKwargs = function(r, kwarr) {
    // kwarr — масив [key1, val1, key2, val2, ...]
    function num(v) { return (typeof v === 'number') ? v : Sk.ffi.remapToJs(v); }
    function pair(v) {
        if (v && v.v) return [num(v.v[0]), num(v.v[1])];
        var a = Sk.ffi.remapToJs(v);
        return Array.isArray(a) ? [a[0], a[1]] : [0, 0];
    }
    function gw(){ return r.width; }
    function gh(){ return r.height; }
    function sl(v){ r.left = v; }
    function st(v){ r.top  = v; }
    function scx(v){ r.left = v - Math.floor(gw()/2); }
    function scy(v){ r.top  = v - Math.floor(gh()/2); }

    for (var i = 0; i < kwarr.length; i += 2) {
        var kw  = (typeof kwarr[i] === 'string') ? kwarr[i] : Sk.ffi.remapToJs(kwarr[i]);
        var val = kwarr[i+1];
        if (kw === '__class__') continue;
        switch (kw) {
            case 'x': case 'left':   sl(num(val)); break;
            case 'y': case 'top':    st(num(val)); break;
            case 'right':            sl(num(val) - gw()); break;
            case 'bottom':           st(num(val) - gh()); break;
            case 'width':  case 'w': r.width  = num(val); break;
            case 'height': case 'h': r.height = num(val); break;
            case 'centerx':          scx(num(val)); break;
            case 'centery':          scy(num(val)); break;
            case 'center':      { var p=pair(val); scx(p[0]); scy(p[1]); break; }
            case 'topleft':     { var p=pair(val); sl(p[0]); st(p[1]); break; }
            case 'topright':    { var p=pair(val); sl(p[0]-gw()); st(p[1]); break; }
            case 'bottomleft':  { var p=pair(val); sl(p[0]); st(p[1]-gh()); break; }
            case 'bottomright': { var p=pair(val); sl(p[0]-gw()); st(p[1]-gh()); break; }
            case 'midtop':    { var p=pair(val); scx(p[0]); st(p[1]); break; }
            case 'midbottom': { var p=pair(val); scx(p[0]); st(p[1]-gh()); break; }
            case 'midleft':   { var p=pair(val); sl(p[0]); scy(p[1]); break; }
            case 'midright':  { var p=pair(val); sl(p[0]-gw()); scy(p[1]); break; }
            case 'size':      { var p=pair(val); r.width=p[0]; r.height=p[1]; break; }
        }
    }
};

// Обгортка що перехоплює tp$call — так Skulpt передає kwargs до довільного callable
var get_rect_func = new Sk.builtin.func(function(self) {
    // викликається лише якщо kwargs відсутні (позиційний виклик)
    return Sk.misceval.callsim(PygameLib.RectType,
        new Sk.builtin.tuple([Sk.ffi.remapToPy(0), Sk.ffi.remapToPy(0)]),
        new Sk.builtin.tuple([Sk.ffi.remapToPy(self.width), Sk.ffi.remapToPy(self.height)]));
});

// Перевизначаємо tp$call щоб отримати kwargs напряму від Skulpt
get_rect_func.tp$call = function(args, kwargs) {
    var self = args[0];
    var r = Sk.misceval.callsim(PygameLib.RectType,
        new Sk.builtin.tuple([Sk.ffi.remapToPy(0), Sk.ffi.remapToPy(0)]),
        new Sk.builtin.tuple([Sk.ffi.remapToPy(self.width), Sk.ffi.remapToPy(self.height)]));
    if (kwargs && kwargs.length) {
        _applyRectKwargs(r, kwargs);
    }
    return r;
};
$loc.get_rect = get_rect_func;

    $loc.get_bounding_rect = new Sk.builtin.func(function (self) {
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(0), Sk.ffi.remapToPy(0)]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(self.width), Sk.ffi.remapToPy(self.height)]));
    });

    $loc.set_alpha = new Sk.builtin.func(function (self, val) {
        self._alpha = (val === undefined || val === Sk.builtin.none.none$)
            ? 255 : Sk.ffi.remapToJs(val);
    });
    $loc.get_alpha = new Sk.builtin.func(function (self) {
        return Sk.ffi.remapToPy(self._alpha !== undefined ? self._alpha : 255);
    });

    $loc.set_colorkey = new Sk.builtin.func(function (self, color) {
        if (color === undefined || color === Sk.builtin.none.none$) {
            self._colorkey = null;
        } else {
            self._colorkey = PygameLib.extract_color(color);
        }
    });
    $loc.get_colorkey = new Sk.builtin.func(function (self) {
        if (!self._colorkey) return Sk.builtin.none.none$;
        var c = self._colorkey;
        return new Sk.builtin.tuple([
            Sk.ffi.remapToPy(c[0]), Sk.ffi.remapToPy(c[1]),
            Sk.ffi.remapToPy(c[2]), Sk.ffi.remapToPy(Math.round(c[3]*255))]);
    });

    // заглушки — canvas не потребує lock/unlock
    $loc.lock   = new Sk.builtin.func(function(self){ return Sk.builtin.none.none$; });
    $loc.unlock = new Sk.builtin.func(function(self){ return Sk.builtin.none.none$; });
    $loc.mustlock= new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(false); });
    $loc.get_locked = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(false); });

    $loc.get_pitch  = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(self.width * 4); });
    $loc.get_bitsize= new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(32); });
    $loc.get_bytesize=new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(4); });

    $loc.subsurface = new Sk.builtin.func(function (self, rect) {
        var r = PygameLib.extract_rect(rect);
        var s = Sk.misceval.callsim(PygameLib.SurfaceType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(r[2]), Sk.ffi.remapToPy(r[3])]));
        s.context2d.drawImage(self.offscreen_canvas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
        return s;
    });
}
surface_class.co_name = new Sk.builtin.str('Surface');

// ─────────────────────────────────────────────────────────────────────────────
// Color
// ─────────────────────────────────────────────────────────────────────────────
function color_class($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function (self, r, g, b, a) {
        var r_js = Sk.ffi.remapToJs(r);
        if (typeof r_js === 'string') {
            var named = PygameLib.Colors[r_js.toLowerCase()];
            if (!named) throw new Sk.builtin.ValueError('unknown color: ' + r_js);
            r = Sk.ffi.remapToPy(named[0]); g = Sk.ffi.remapToPy(named[1]);
            b = Sk.ffi.remapToPy(named[2]); a = Sk.ffi.remapToPy(named[3]);
        } else if (Array.isArray(r_js)) {
            // передано кортеж/список
            var arr = r_js;
            r = Sk.ffi.remapToPy(arr[0]); g = Sk.ffi.remapToPy(arr[1]);
            b = Sk.ffi.remapToPy(arr[2]); a = Sk.ffi.remapToPy(arr.length>3 ? arr[3] : 255);
        }
        if (a === undefined) a = Sk.ffi.remapToPy(255);
        self._r = Sk.ffi.remapToJs(r);
        self._g = Sk.ffi.remapToJs(g);
        self._b = Sk.ffi.remapToJs(b);
        self._a = Sk.ffi.remapToJs(a);
        return Sk.builtin.none.none$;
    });

    // Геттери/сетери для Python-атрибутів r,g,b,a через __getattr__/__setattr__
    $loc.__getattr__ = new Sk.builtin.func(function(self, name) {
        var n = Sk.ffi.remapToJs(name);
        if (n === 'r') return Sk.ffi.remapToPy(self._r);
        if (n === 'g') return Sk.ffi.remapToPy(self._g);
        if (n === 'b') return Sk.ffi.remapToPy(self._b);
        if (n === 'a') return Sk.ffi.remapToPy(self._a);
        throw new Sk.builtin.AttributeError("'Color' object has no attribute '" + n + "'");
    });
    $loc.__setattr__ = new Sk.builtin.func(function(self, name, val) {
        var n = Sk.ffi.remapToJs(name);
        var v = Sk.ffi.remapToJs(val);
        if (n === 'r') { self._r = v; return Sk.builtin.none.none$; }
        if (n === 'g') { self._g = v; return Sk.builtin.none.none$; }
        if (n === 'b') { self._b = v; return Sk.builtin.none.none$; }
        if (n === 'a') { self._a = v; return Sk.builtin.none.none$; }
        self[n] = val;
        return Sk.builtin.none.none$;
    });

    $loc.__repr__ = new Sk.builtin.func(function (self) {
        return Sk.ffi.remapToPy('Color('+self._r+', '+self._g+', '+self._b+', '+self._a+')');
    });

    $loc.__eq__ = new Sk.builtin.func(function (self, other) {
        if (Sk.abstr.typeName(other) !== 'Color') return Sk.ffi.remapToPy(false);
        return Sk.ffi.remapToPy(
            self._r === other._r && self._g === other._g &&
            self._b === other._b && self._a === other._a);
    });

    $loc.__getitem__ = new Sk.builtin.func(function (self, idx) {
        var i = Sk.ffi.remapToJs(idx);
        if (i < 0) i = 4 + i;
        if (i < 0 || i > 3) throw new Sk.builtin.IndexError('index out of range');
        return Sk.ffi.remapToPy([self._r, self._g, self._b, self._a][i]);
    });

    $loc.__len__ = new Sk.builtin.func(function (self) {
        return Sk.ffi.remapToPy(4);
    });

    $loc.__iter__ = new Sk.builtin.func(function (self) {
        return Sk.ffi.remapToPy([self._r, self._g, self._b, self._a]).__iter__();
    });

    $loc.normalize = new Sk.builtin.func(function (self) {
        return new Sk.builtin.tuple([
            Sk.ffi.remapToPy(self._r/255), Sk.ffi.remapToPy(self._g/255),
            Sk.ffi.remapToPy(self._b/255), Sk.ffi.remapToPy(self._a/255)]);
    });

    $loc.correct_gamma = new Sk.builtin.func(function (self, val) {
        var gamma = Sk.ffi.remapToJs(val);
        var r = Math.min(255, Math.round(Math.pow(self._r/255, gamma)*255));
        var g = Math.min(255, Math.round(Math.pow(self._g/255, gamma)*255));
        var b = Math.min(255, Math.round(Math.pow(self._b/255, gamma)*255));
        var a = Math.min(255, Math.round(Math.pow(self._a/255, gamma)*255));
        self._r = r; self._g = g; self._b = b; self._a = a;
        return new Sk.builtin.tuple([
            Sk.ffi.remapToPy(r), Sk.ffi.remapToPy(g),
            Sk.ffi.remapToPy(b), Sk.ffi.remapToPy(a)]);
    });

    // HSV/HSL/CMY властивості
    var prop = function(getter, setter) {
        return Sk.misceval.callsimOrSuspend(Sk.builtins.property, getter, setter);
    };

    var cmy_getter = new Sk.builtin.func(function(self) {
        return new Sk.builtin.tuple([
            Sk.ffi.remapToPy(1 - self._r/255),
            Sk.ffi.remapToPy(1 - self._g/255),
            Sk.ffi.remapToPy(1 - self._b/255)]);
    });
    var cmy_setter = new Sk.builtin.func(function(self, val) {
        var c = Sk.ffi.remapToJs(val);
        self._r = Math.round((1-c[0])*255);
        self._g = Math.round((1-c[1])*255);
        self._b = Math.round((1-c[2])*255);
    });
    $loc.cmy = prop(cmy_getter, cmy_setter);

    $loc.set_length = new Sk.builtin.func(function(self,val){/* no-op for 3 or 4 */});
}
color_class.co_name = new Sk.builtin.str('Color');

// ─────────────────────────────────────────────────────────────────────────────
// Rect
// ─────────────────────────────────────────────────────────────────────────────
function rect_class($gbl, $loc) {
    // Тепер атрибути зберігаються як JS-числа напряму в self
    function _gl(s){ return s.left; }
    function _gt(s){ return s.top; }
    function _gw(s){ return s.width; }
    function _gh(s){ return s.height; }
    function _sl(s,v){ s.left = v; }
    function _st(s,v){ s.top = v; }
    function _sw(s,v){ s.width = v; }
    function _sh(s,v){ s.height = v; }
    
    function _gcx(s){ return _gl(s)+Math.floor(_gw(s)/2); }
    function _gcy(s){ return _gt(s)+Math.floor(_gh(s)/2); }
    function _gr(s){ return _gl(s)+_gw(s); }
    function _gb(s){ return _gt(s)+_gh(s); }
    function _scx(s,v){ _sl(s, v-Math.floor(_gw(s)/2)); }
    function _scy(s,v){ _st(s, v-Math.floor(_gh(s)/2)); }

    var prop = function(getter, setter) {
        return Sk.misceval.callsimOrSuspend(Sk.builtins.property, getter, setter);
    };

    $loc.__init__ = new Sk.builtin.func(function (self, a, b, c, d) {
        var left, top, width, height;
        if (b === undefined) {
            if (Sk.abstr.typeName(a) === 'Rect') {
                left=_gl(a); top=_gt(a); width=_gw(a); height=_gh(a);
            } else {
                var arr = Sk.ffi.remapToJs(a);
                left=arr[0]; top=arr[1]; width=arr[2]; height=arr[3];
            }
        } else if (Sk.abstr.typeName(a) === 'tuple' && Sk.abstr.typeName(b) === 'tuple') {
            var aa = Sk.ffi.remapToJs(a), bb = Sk.ffi.remapToJs(b);
            left=aa[0]; top=aa[1]; width=bb[0]; height=bb[1];
        } else {
            left  = Sk.ffi.remapToJs(a);
            top   = Sk.ffi.remapToJs(b);
            width = Sk.ffi.remapToJs(c);
            height= Sk.ffi.remapToJs(d);
        }
        // Зберігаємо як JS-числа напряму
        self.left   = left;
        self.top    = top;
        self.width  = width;
        self.height = height;
        return Sk.builtin.none.none$;
    });

    $loc.__repr__ = new Sk.builtin.func(function(self){
        return Sk.ffi.remapToPy('<Rect('+_gl(self)+', '+_gt(self)+', '+_gw(self)+', '+_gh(self)+')>');
    });

    $loc.__eq__ = new Sk.builtin.func(function(self, other) {
        if (Sk.abstr.typeName(other) !== 'Rect') return Sk.ffi.remapToPy(false);
        return Sk.ffi.remapToPy(_gl(self)===_gl(other) && _gt(self)===_gt(other) &&
                                 _gw(self)===_gw(other) && _gh(self)===_gh(other));
    });

    $loc.__ne__ = new Sk.builtin.func(function(self, other) {
        if (Sk.abstr.typeName(other) !== 'Rect') return Sk.ffi.remapToPy(true);
        return Sk.ffi.remapToPy(!(_gl(self)===_gl(other) && _gt(self)===_gt(other) &&
                                   _gw(self)===_gw(other) && _gh(self)===_gh(other)));
    });

    $loc.__iter__ = new Sk.builtin.func(function(self) {
        return Sk.ffi.remapToPy([_gl(self), _gt(self), _gw(self), _gh(self)]).__iter__();
    });

    $loc.__bool__ = new Sk.builtin.func(function(self) {
        return Sk.ffi.remapToPy(_gw(self) !== 0 || _gh(self) !== 0);
    });

    // __getattr__ дозволяє Python-коду читати rect.width / rect.height / rect.left / rect.top
    // (ці значення зберігаються як JS-властивості, а не Python properties)
    $loc.__getattr__ = new Sk.builtin.func(function(self, name) {
        var n = Sk.ffi.remapToJs(name);
        switch (n) {
            case 'width':   return Sk.ffi.remapToPy(_gw(self));
            case 'height':  return Sk.ffi.remapToPy(_gh(self));
            case 'left':    return Sk.ffi.remapToPy(_gl(self));
            case 'top':     return Sk.ffi.remapToPy(_gt(self));
            case 'right':   return Sk.ffi.remapToPy(_gr(self));
            case 'bottom':  return Sk.ffi.remapToPy(_gb(self));
            case 'x':       return Sk.ffi.remapToPy(_gl(self));
            case 'y':       return Sk.ffi.remapToPy(_gt(self));
            case 'w':       return Sk.ffi.remapToPy(_gw(self));
            case 'h':       return Sk.ffi.remapToPy(_gh(self));
            case 'centerx': return Sk.ffi.remapToPy(_gcx(self));
            case 'centery': return Sk.ffi.remapToPy(_gcy(self));
            case 'center':  return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gcx(self)), Sk.ffi.remapToPy(_gcy(self))]);
            case 'topleft': return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(self)), Sk.ffi.remapToPy(_gt(self))]);
            case 'topright': return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gr(self)), Sk.ffi.remapToPy(_gt(self))]);
            case 'bottomleft': return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(self)), Sk.ffi.remapToPy(_gb(self))]);
            case 'bottomright': return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gr(self)), Sk.ffi.remapToPy(_gb(self))]);
            case 'midtop':    return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gcx(self)), Sk.ffi.remapToPy(_gt(self))]);
            case 'midbottom': return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gcx(self)), Sk.ffi.remapToPy(_gb(self))]);
            case 'midleft':   return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(self)), Sk.ffi.remapToPy(_gcy(self))]);
            case 'midright':  return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gr(self)), Sk.ffi.remapToPy(_gcy(self))]);
            case 'size':      return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gw(self)), Sk.ffi.remapToPy(_gh(self))]);
        }
        throw new Sk.builtin.AttributeError("'Rect' object has no attribute '" + n + "'");
    });

    // __setattr__ дозволяє rect.width = 10 тощо
    $loc.__setattr__ = new Sk.builtin.func(function(self, name, val) {
        var n = (typeof name === 'string') ? name : Sk.ffi.remapToJs(name);
        // Для скалярних атрибутів
        function num(pyval) { return Sk.ffi.remapToJs(pyval); }
        // Для парних атрибутів — val є Python tuple/list, елементи треба конвертувати окремо
        function pair(pyval) {
            if (pyval && pyval.v) return [num(pyval.v[0]), num(pyval.v[1])];
            var a = Sk.ffi.remapToJs(pyval);
            if (Array.isArray(a)) {
                return [
                    (typeof a[0] === 'number') ? a[0] : num(a[0]),
                    (typeof a[1] === 'number') ? a[1] : num(a[1])
                ];
            }
            return [0, 0];
        }
        switch (n) {
            case 'width':  case 'w': _sw(self, num(val)); return Sk.builtin.none.none$;
            case 'height': case 'h': _sh(self, num(val)); return Sk.builtin.none.none$;
            case 'left':   case 'x': _sl(self, num(val)); return Sk.builtin.none.none$;
            case 'top':    case 'y': _st(self, num(val)); return Sk.builtin.none.none$;
            case 'right':  _sl(self, num(val) - _gw(self)); return Sk.builtin.none.none$;
            case 'bottom': _st(self, num(val) - _gh(self)); return Sk.builtin.none.none$;
            case 'centerx': _scx(self, num(val)); return Sk.builtin.none.none$;
            case 'centery': _scy(self, num(val)); return Sk.builtin.none.none$;
            case 'center': { var p=pair(val); _scx(self,p[0]); _scy(self,p[1]); return Sk.builtin.none.none$; }
            case 'topleft':    { var p=pair(val); _sl(self,p[0]); _st(self,p[1]); return Sk.builtin.none.none$; }
            case 'topright':   { var p=pair(val); _sl(self,p[0]-_gw(self)); _st(self,p[1]); return Sk.builtin.none.none$; }
            case 'bottomleft': { var p=pair(val); _sl(self,p[0]); _st(self,p[1]-_gh(self)); return Sk.builtin.none.none$; }
            case 'bottomright':{ var p=pair(val); _sl(self,p[0]-_gw(self)); _st(self,p[1]-_gh(self)); return Sk.builtin.none.none$; }
            case 'midtop':    { var p=pair(val); _scx(self,p[0]); _st(self,p[1]); return Sk.builtin.none.none$; }
            case 'midbottom': { var p=pair(val); _scx(self,p[0]); _st(self,p[1]-_gh(self)); return Sk.builtin.none.none$; }
            case 'midleft':   { var p=pair(val); _sl(self,p[0]); _scy(self,p[1]); return Sk.builtin.none.none$; }
            case 'midright':  { var p=pair(val); _sl(self,p[0]-_gw(self)); _scy(self,p[1]); return Sk.builtin.none.none$; }
            case 'size':      { var p=pair(val); _sw(self,p[0]); _sh(self,p[1]); return Sk.builtin.none.none$; }
            default:
                // Довільні атрибути (rect.speed = 5, rect.name = "player" тощо)
                self['_py_' + n] = val;
                return Sk.builtin.none.none$;
        }
    });

    $loc.copy = new Sk.builtin.func(function(self) {
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(self)), Sk.ffi.remapToPy(_gt(self))]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(_gw(self)), Sk.ffi.remapToPy(_gh(self))]));
    });

    // Властивості x,y,w,h
    $loc.x = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s.left); }),
        new Sk.builtin.func(function(s,v){ s.left = Sk.ffi.remapToJs(v); }));
    $loc.y = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s.top); }),
        new Sk.builtin.func(function(s,v){ s.top = Sk.ffi.remapToJs(v); }));
    $loc.w = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s.width); }),
        new Sk.builtin.func(function(s,v){ s.width = Sk.ffi.remapToJs(v); }));
    $loc.h = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s.height); }),
        new Sk.builtin.func(function(s,v){ s.height = Sk.ffi.remapToJs(v); }));

    // Властивості left, top, right, bottom
    $loc.left = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s.left); }),
        new Sk.builtin.func(function(s,v){ s.left = Sk.ffi.remapToJs(v); }));
    $loc.top = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s.top); }),
        new Sk.builtin.func(function(s,v){ s.top = Sk.ffi.remapToJs(v); }));
    $loc.right  = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(_gr(s)); }),
        new Sk.builtin.func(function(s,v){ _sl(s, Sk.ffi.remapToJs(v)-_gw(s)); }));
    $loc.bottom = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(_gb(s)); }),
        new Sk.builtin.func(function(s,v){ _st(s, Sk.ffi.remapToJs(v)-_gh(s)); }));

    $loc.centerx = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(_gcx(s)); }),
        new Sk.builtin.func(function(s,v){ _scx(s, Sk.ffi.remapToJs(v)); }));
    $loc.centery = prop(
        new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(_gcy(s)); }),
        new Sk.builtin.func(function(s,v){ _scy(s, Sk.ffi.remapToJs(v)); }));

    $loc.center = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gcx(s)), Sk.ffi.remapToPy(_gcy(s))]); }),
        new Sk.builtin.func(function(s,v){
            var c=v.v ? [Sk.ffi.remapToJs(v.v[0]),Sk.ffi.remapToJs(v.v[1])] : Sk.ffi.remapToJs(v);
            _scx(s,c[0]); _scy(s,c[1]); }));

    // Допоміжна функція: розпаковує Python tuple/list у [num, num]
    function _p2(v) {
        if (v && v.v) return [Sk.ffi.remapToJs(v.v[0]), Sk.ffi.remapToJs(v.v[1])];
        var a = Sk.ffi.remapToJs(v);
        if (Array.isArray(a)) return [
            (typeof a[0]==='number') ? a[0] : Sk.ffi.remapToJs(a[0]),
            (typeof a[1]==='number') ? a[1] : Sk.ffi.remapToJs(a[1])
        ];
        return [0,0];
    }

    $loc.topleft = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(s)), Sk.ffi.remapToPy(_gt(s))]); }),
        new Sk.builtin.func(function(s,v){
            var tl=_p2(v); _sl(s,tl[0]); _st(s,tl[1]); }));

    $loc.topright = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gr(s)), Sk.ffi.remapToPy(_gt(s))]); }),
        new Sk.builtin.func(function(s,v){
            var tr=_p2(v); _sl(s,tr[0]-_gw(s)); _st(s,tr[1]); }));

    $loc.bottomleft = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(s)), Sk.ffi.remapToPy(_gb(s))]); }),
        new Sk.builtin.func(function(s,v){
            var bl=_p2(v); _sl(s,bl[0]); _st(s,bl[1]-_gh(s)); }));

    $loc.bottomright = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gr(s)), Sk.ffi.remapToPy(_gb(s))]); }),
        new Sk.builtin.func(function(s,v){
            var br=_p2(v); _sl(s,br[0]-_gw(s)); _st(s,br[1]-_gh(s)); }));

    $loc.midtop = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gcx(s)), Sk.ffi.remapToPy(_gt(s))]); }),
        new Sk.builtin.func(function(s,v){
            var m=_p2(v); _scx(s,m[0]); _st(s,m[1]); }));

    $loc.midbottom = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gcx(s)), Sk.ffi.remapToPy(_gb(s))]); }),
        new Sk.builtin.func(function(s,v){
            var m=_p2(v); _scx(s,m[0]); _st(s,m[1]-_gh(s)); }));

    $loc.midleft = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(s)), Sk.ffi.remapToPy(_gcy(s))]); }),
        new Sk.builtin.func(function(s,v){
            var m=_p2(v); _sl(s,m[0]); _scy(s,m[1]); }));

    $loc.midright = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gr(s)), Sk.ffi.remapToPy(_gcy(s))]); }),
        new Sk.builtin.func(function(s,v){
            var m=_p2(v); _sl(s,m[0]-_gw(s)); _scy(s,m[1]); }));

    $loc.size = prop(
        new Sk.builtin.func(function(s){
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(_gw(s)), Sk.ffi.remapToPy(_gh(s))]); }),
        new Sk.builtin.func(function(s,v){
            var sz=_p2(v); _sw(s,sz[0]); _sh(s,sz[1]); }));

$loc.move = new Sk.builtin.func(function(self, x, y) {
    // ✅ Додано перевірку на 'list'
    if ((Sk.abstr.typeName(x)==='tuple' || Sk.abstr.typeName(x)==='list') && y===undefined) {
        var t=Sk.ffi.remapToJs(x); x=t[0]; y=t[1];
    } else { x=Sk.ffi.remapToJs(x); y=Sk.ffi.remapToJs(y); }
    return Sk.misceval.callsim(PygameLib.RectType ,
        new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(self)+x), Sk.ffi.remapToPy(_gt(self)+y)]),
        new Sk.builtin.tuple([Sk.ffi.remapToPy(_gw(self)), Sk.ffi.remapToPy(_gh(self ))]));
});
$loc.move_ip = new Sk.builtin.func(function(self, x, y) {
    // ✅ Додано перевірку на 'list'
    if ((Sk.abstr.typeName(x)==='tuple' || Sk.abstr.typeName(x)==='list') && y===undefined) {
        var t=Sk.ffi.remapToJs(x); x=t[0]; y=t[1];
    } else { x=Sk.ffi.remapToJs(x); y=Sk.ffi.remapToJs(y); }
    _sl(self, _gl(self)+x); _st(self, _gt(self)+y );
});

    $loc.inflate = new Sk.builtin.func(function(self, x, y) {
        x=Sk.ffi.remapToJs(x); y=Sk.ffi.remapToJs(y);
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(_gl(self)-Math.floor(x/2)), Sk.ffi.remapToPy(_gt(self)-Math.floor(y/2))]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(_gw(self)+x), Sk.ffi.remapToPy(_gh(self)+y)]));
    });
    $loc.inflate_ip = new Sk.builtin.func(function(self, x, y) {
        x=Sk.ffi.remapToJs(x); y=Sk.ffi.remapToJs(y);
        _sl(self, _gl(self)-Math.floor(x/2));
        _st(self, _gt(self)-Math.floor(y/2));
        _sw(self, _gw(self)+x);
        _sh(self, _gh(self)+y);
    });

    $loc.normalize = new Sk.builtin.func(function(self) {
        var l=_gl(self), t=_gt(self), w=_gw(self), h=_gh(self);
        if (w<0){ l+=w; w=-w; }
        if (h<0){ t+=h; h=-h; }
        _sl(self,l); _st(self,t); _sw(self,w); _sh(self,h);
    });

    function _intersect(s, a) {
        return _gl(s) < _gl(a)+_gw(a) && _gt(s) < _gt(a)+_gh(a) &&
               _gl(s)+_gw(s) > _gl(a) && _gt(s)+_gh(s) > _gt(a);
    }

$loc.collidepoint = new Sk.builtin.func(function(self, x, y) {
    // ✅ Додано перевірку на 'list'
    if ((Sk.abstr.typeName(x)==='tuple' || Sk.abstr.typeName(x)==='list') && y===undefined) {
        var t=Sk.ffi.remapToJs(x); x=t[0]; y=t[1];
    } else { x=Sk.ffi.remapToJs(x); y=Sk.ffi.remapToJs(y); }
    return Sk.ffi.remapToPy(x >=_gl(self) &&x <_gl(self)+_gw(self) &&y >=_gt(self) &&y <_gt(self)+_gh(self));
});
    $loc.colliderect = new Sk.builtin.func(function(self, other) {
        return Sk.ffi.remapToPy(_intersect(self, other));
    });
    $loc.collidelist = new Sk.builtin.func(function(self, lst) {
        for (var i=0; i<lst.v.length; i++)
            if (_intersect(self, lst.v[i])) return Sk.ffi.remapToPy(i);
        return Sk.ffi.remapToPy(-1);
    });
    $loc.collidelistall = new Sk.builtin.func(function(self, lst) {
        var ret=[];
        for (var i=0; i<lst.v.length; i++)
            if (_intersect(self, lst.v[i])) ret.push(i);
        return Sk.ffi.remapToPy(ret);
    });
    $loc.contains = new Sk.builtin.func(function(self, other) {
        return Sk.ffi.remapToPy(_gl(self)<=_gl(other) && _gt(self)<=_gt(other) &&
            _gl(self)+_gw(self)>=_gl(other)+_gw(other) &&
            _gt(self)+_gh(self)>=_gt(other)+_gh(other));
    });
    $loc.clip = new Sk.builtin.func(function(self, other) {
        var x=Math.max(_gl(self),_gl(other)), y=Math.max(_gt(self),_gt(other));
        var r=Math.min(_gl(self)+_gw(self), _gl(other)+_gw(other));
        var b=Math.min(_gt(self)+_gh(self), _gt(other)+_gh(other));
        var w=Math.max(0,r-x), h=Math.max(0,b-y);
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(x), Sk.ffi.remapToPy(y)]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
    });
    $loc.union = new Sk.builtin.func(function(self, other) {
        var x=Math.min(_gl(self),_gl(other)), y=Math.min(_gt(self),_gt(other));
        var r=Math.max(_gl(self)+_gw(self), _gl(other)+_gw(other));
        var b=Math.max(_gt(self)+_gh(self), _gt(other)+_gh(other));
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(x), Sk.ffi.remapToPy(y)]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(r-x), Sk.ffi.remapToPy(b-y)]));
    });
    $loc.union_ip = new Sk.builtin.func(function(self, other) {
        var x=Math.min(_gl(self),_gl(other)), y=Math.min(_gt(self),_gt(other));
        var r=Math.max(_gl(self)+_gw(self), _gl(other)+_gw(other));
        var b=Math.max(_gt(self)+_gh(self), _gt(other)+_gh(other));
        _sl(self,x); _st(self,y); _sw(self,r-x); _sh(self,b-y);
    });
    $loc.unionall = new Sk.builtin.func(function(self, lst) {
        var l=_gl(self),t=_gt(self),r=_gr(self),b=_gb(self);
        for (var i=0; i<lst.v.length; i++) {
            l=Math.min(l,_gl(lst.v[i])); t=Math.min(t,_gt(lst.v[i]));
            r=Math.max(r,_gr(lst.v[i])); b=Math.max(b,_gb(lst.v[i]));
        }
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(l), Sk.ffi.remapToPy(t)]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(r-l), Sk.ffi.remapToPy(b-t)]));
    });
    $loc.unionall_ip = new Sk.builtin.func(function(self, lst) {
        var l=_gl(self),t=_gt(self),r=_gr(self),b=_gb(self);
        for (var i=0; i<lst.v.length; i++) {
            l=Math.min(l,_gl(lst.v[i])); t=Math.min(t,_gt(lst.v[i]));
            r=Math.max(r,_gr(lst.v[i])); b=Math.max(b,_gb(lst.v[i]));
        }
        _sl(self,l); _st(self,t); _sw(self,r-l); _sh(self,b-t);
    });
    $loc.fit = new Sk.builtin.func(function(self, other) {
        var ow=_gw(other), oh=_gh(other), sw=_gw(self), sh=_gh(self);
        var xr=sw/ow, yr=sh/oh, mr=Math.max(xr,yr);
        var w=Math.round(sw/mr), h=Math.round(sh/mr);
        var x=_gl(other)+Math.floor((ow-w)/2);
        var y=_gt(other)+Math.floor((oh-h)/2);
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(x), Sk.ffi.remapToPy(y)]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
    });
    $loc.clamp = new Sk.builtin.func(function(self, other) {
        var x, y;
        if (_gw(self)>=_gw(other)) x=_gl(other)+Math.floor((_gw(other)-_gw(self))/2);
        else if (_gl(self)<_gl(other)) x=_gl(other);
        else if (_gl(self)+_gw(self)>_gl(other)+_gw(other)) x=_gl(other)+_gw(other)-_gw(self);
        else x=_gl(self);
        if (_gh(self)>=_gh(other)) y=_gt(other)+Math.floor((_gh(other)-_gh(self))/2);
        else if (_gt(self)<_gt(other)) y=_gt(other);
        else if (_gt(self)+_gh(self)>_gt(other)+_gh(other)) y=_gt(other)+_gh(other)-_gh(self);
        else y=_gt(self);
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(x), Sk.ffi.remapToPy(y)]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(_gw(self)), Sk.ffi.remapToPy(_gh(self))]));
    });
    $loc.clamp_ip = new Sk.builtin.func(function(self, other) {
        var x, y;
        if (_gw(self)>=_gw(other)) x=_gl(other)+Math.floor((_gw(other)-_gw(self))/2);
        else if (_gl(self)<_gl(other)) x=_gl(other);
        else if (_gl(self)+_gw(self)>_gl(other)+_gw(other)) x=_gl(other)+_gw(other)-_gw(self);
        else x=_gl(self);
        if (_gh(self)>=_gh(other)) y=_gt(other)+Math.floor((_gh(other)-_gh(self))/2);
        else if (_gt(self)<_gt(other)) y=_gt(other);
        else if (_gt(self)+_gh(self)>_gt(other)+_gh(other)) y=_gt(other)+_gh(other)-_gh(self);
        else y=_gt(self);
        _sl(self, x); _st(self, y);
    });
}
rect_class.co_name = new Sk.builtin.str('Rect');

// ─────────────────────────────────────────────────────────────────────────────
// pygame.draw
// ─────────────────────────────────────────────────────────────────────────────
function makeDrawModule() {
    var mod = {};
    
function bbox(x1, y1, x2, y2) {
    // x1, y1, x2, y2 тут вже є звичайними JS-числами
    var left = Math.min(x1, x2);
    var top = Math.min(y1, y2);
    var width = Math.abs(x2 - x1);
    var height = Math.abs(y2 - y1);
    
    // Використовуємо Sk.ffi.remapToPy замість new Sk.builtin.int_
    // та передаємо координати у вигляді двох кортежів, як це зроблено в інших місцях файлу
    return Sk.misceval.callsim(
        PygameLib.RectType,
        new Sk.builtin.tuple([Sk.ffi.remapToPy(left), Sk.ffi.remapToPy(top)]),
        new Sk.builtin.tuple([Sk.ffi.remapToPy(width), Sk.ffi.remapToPy(height)])
    );
}

    var _draw_rect_impl = function(surf, color, rect, width, borderRadius,
                                   borderTopLeftRadius, borderTopRightRadius,
                                   borderBottomLeftRadius, borderBottomRightRadius) {
        var ctx = surf.context2d;
        var c = PygameLib.extract_color(color);
        var r = PygameLib.extract_rect(rect);
        var w = (width !== undefined && width !== null) ? Sk.ffi.remapToJs(width) : 0;
        var br = (borderRadius !== undefined && borderRadius !== null) ? Sk.ffi.remapToJs(borderRadius) : 0;
        var brTL = (borderTopLeftRadius    !== undefined && borderTopLeftRadius    !== null) ? Sk.ffi.remapToJs(borderTopLeftRadius)    : br;
        var brTR = (borderTopRightRadius   !== undefined && borderTopRightRadius   !== null) ? Sk.ffi.remapToJs(borderTopRightRadius)   : br;
        var brBL = (borderBottomLeftRadius !== undefined && borderBottomLeftRadius !== null) ? Sk.ffi.remapToJs(borderBottomLeftRadius) : br;
        var brBR = (borderBottomRightRadius!== undefined && borderBottomRightRadius!== null) ? Sk.ffi.remapToJs(borderBottomRightRadius): br;

        var x = r[0], y = r[1], rw = r[2], rh = r[3];

        function roundedRect(ctx, x, y, w, h, tl, tr, br, bl) {
            tl = Math.min(tl, w/2, h/2);
            tr = Math.min(tr, w/2, h/2);
            br = Math.min(br, w/2, h/2);
            bl = Math.min(bl, w/2, h/2);
            ctx.beginPath();
            ctx.moveTo(x + tl, y);
            ctx.lineTo(x + w - tr, y);
            ctx.arcTo(x + w, y,     x + w, y + tr, tr);
            ctx.lineTo(x + w, y + h - br);
            ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
            ctx.lineTo(x + bl, y + h);
            ctx.arcTo(x,     y + h, x, y + h - bl, bl);
            ctx.lineTo(x, y + tl);
            ctx.arcTo(x, y,         x + tl, y, tl);
            ctx.closePath();
        }

        var hasRadius = (brTL > 0 || brTR > 0 || brBL > 0 || brBR > 0);
        if (hasRadius) {
            roundedRect(ctx, x, y, rw, rh, brTL, brTR, brBR, brBL);
            if (w > 0) {
                ctx.lineWidth = w;
                ctx.strokeStyle = PygameLib.cssColor(c);
                ctx.stroke();
            } else {
                ctx.fillStyle = PygameLib.cssColor(c);
                ctx.fill();
            }
        } else {
            ctx.beginPath();
            if (w > 0) {
                ctx.lineWidth = w;
                ctx.strokeStyle = PygameLib.cssColor(c);
                ctx.strokeRect(x, y, rw, rh);
            } else {
                ctx.fillStyle = PygameLib.cssColor(c);
                ctx.fillRect(x, y, rw, rh);
            }
        }
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(x), Sk.ffi.remapToPy(y)]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(rw), Sk.ffi.remapToPy(rh)]));
    };

    var _draw_rect_func = new Sk.builtin.func(function(surf, color, rect, width) {
        return _draw_rect_impl(surf, color, rect, width);
    });
    _draw_rect_func.tp$call = function(args, kwargs) {
        var surf  = args[0], color = args[1], rect = args[2];
        var width = args[3] !== undefined ? args[3] : null;
        var br = null, brTL = null, brTR = null, brBL = null, brBR = null;
        if (kwargs) {
            for (var i = 0; i < kwargs.length; i += 2) {
                var k = (typeof kwargs[i] === 'string') ? kwargs[i] : Sk.ffi.remapToJs(kwargs[i]);
                var v = kwargs[i+1];
                if      (k === 'width')                    width = v;
                else if (k === 'border_radius')            br    = v;
                else if (k === 'border_top_left_radius')   brTL  = v;
                else if (k === 'border_top_right_radius')  brTR  = v;
                else if (k === 'border_bottom_left_radius')brBL  = v;
                else if (k === 'border_bottom_right_radius')brBR = v;
            }
        }
        return _draw_rect_impl(surf, color, rect, width, br, brTL, brTR, brBL, brBR);
    };
    mod.rect = _draw_rect_func;

// ✅ Виправлена версія mod.circle з підтримкою width=...
var _draw_circle_impl = function(surf, color, pos, radius, width) {
    var ctx = surf.context2d;
    var c = PygameLib.extract_color(color);
    
    var x, y;
    try {
        var p_js = Sk.ffi.remapToJs(pos);
        if (Array.isArray(p_js) && p_js.length >= 2) {
            x = p_js[0];
            y = p_js[1];
        } else {
            throw new Error("Not an array");
        }
    } catch (e) {
        if (pos.v && Array.isArray(pos.v)) {
            x = Sk.ffi.remapToJs(pos.v[0]);
            y = Sk.ffi.remapToJs(pos.v[1]);
        } else if (pos.x !== undefined && pos.y !== undefined) {
            x = Sk.ffi.remapToJs(pos.x);
            y = Sk.ffi.remapToJs(pos.y);
        } else {
            x = Sk.ffi.remapToJs(Sk.abstr.gattr(pos, 'x', false));
            y = Sk.ffi.remapToJs(Sk.abstr.gattr(pos, 'y', false));
        }
    }

    var rad = Sk.ffi.remapToJs(radius);
    var w = (width !== undefined && width !== null) ? Sk.ffi.remapToJs(width) : 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
    if (w) {
        ctx.lineWidth = w;
        ctx.strokeStyle = PygameLib.cssColor(c);
        ctx.stroke();
    } else {
        ctx.fillStyle = PygameLib.cssColor(c);
        ctx.fill();
    }
    ctx.restore();

    return bbox(x - rad, y - rad, x + rad, y + rad);
};

var _draw_circle_func = new Sk.builtin.func(function(surf, color, pos, radius, width) {
    return _draw_circle_impl(surf, color, pos, radius, width);
});

// ✅ КРИТИЧНО: Перехоплюємо tp$call для підтримки kwargs
_draw_circle_func.tp$call = function(args, kwargs) {
    var surf = args[0], color = args[1], pos = args[2], radius = args[3];
    var width = (args[4] !== undefined) ? args[4] : null;
    
    // Обробка іменованих аргументів
    if (kwargs && kwargs.length > 0) {
        for (var i = 0; i < kwargs.length; i += 2) {
            var k = (typeof kwargs[i] === 'string') ? kwargs[i] : Sk.ffi.remapToJs(kwargs[i]);
            var v = kwargs[i + 1];
            if (k === 'width') {
                width = v;
            }
        }
    }
    
    return _draw_circle_impl(surf, color, pos, radius, width);
};

mod.circle = _draw_circle_func;

    mod.ellipse = new Sk.builtin.func(function (surf, color, rect, width) {
        var ctx = surf.context2d;
        var c = PygameLib.extract_color(color);
        var r = PygameLib.extract_rect(rect);
        var w = (width !== undefined) ? Sk.ffi.remapToJs(width) : 0;
        var cx = r[0]+r[2]/2, cy = r[1]+r[3]/2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r[2]/2, r[3]/2, 0, 0, 2*Math.PI);
        if (w) {
            ctx.lineWidth = w;
            ctx.strokeStyle = PygameLib.cssColor(c);
            ctx.stroke();
        } else {
            ctx.fillStyle = PygameLib.cssColor(c);
            ctx.fill();
        }
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(r[0]), Sk.ffi.remapToPy(r[1])]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(r[2]), Sk.ffi.remapToPy(r[3])]));
    });

    mod.arc = new Sk.builtin.func(function (surf, color, rect, start_angle, stop_angle, width) {
        var ctx = surf.context2d;
        var c = PygameLib.extract_color(color);
        var r = PygameLib.extract_rect(rect);
        var w = (width !== undefined) ? Sk.ffi.remapToJs(width) : 1;
        var sa = Sk.ffi.remapToJs(start_angle);
        var ea = Sk.ffi.remapToJs(stop_angle);
        var cx = r[0]+r[2]/2, cy = r[1]+r[3]/2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r[2]/2, r[3]/2, 0, -sa, -ea, true);
        ctx.lineWidth = w;
        ctx.strokeStyle = PygameLib.cssColor(c);
        ctx.stroke();
        return Sk.misceval.callsim(PygameLib.RectType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(r[0]), Sk.ffi.remapToPy(r[1])]),
            new Sk.builtin.tuple([Sk.ffi.remapToPy(r[2]), Sk.ffi.remapToPy(r[3])]));
    });

    mod.line = new Sk.builtin.func(function (surf, color, start_pos, end_pos, width) {
        var ctx = surf.context2d;
        var c = PygameLib.extract_color(color);
        var sp = Sk.ffi.remapToJs(start_pos);
        var ep = Sk.ffi.remapToJs(end_pos);
        var w = (width !== undefined) ? Sk.ffi.remapToJs(width) : 1;
        ctx.beginPath();
        ctx.moveTo(sp[0], sp[1]);
        ctx.lineTo(ep[0], ep[1]);
        ctx.lineWidth = w;
        ctx.strokeStyle = PygameLib.cssColor(c);
        ctx.lineCap = 'round';
        ctx.stroke();
        return bbox(sp[0], sp[1], ep[0], ep[1]);
    });

    mod.lines = new Sk.builtin.func(function (surf, color, closed, pointlist, width) {
        var ctx = surf.context2d;
        var c = PygameLib.extract_color(color);
        var pts = Sk.ffi.remapToJs(pointlist);
        var w = (width !== undefined) ? Sk.ffi.remapToJs(width) : 1;
        var cl = Sk.ffi.remapToJs(closed);
        if (pts.length < 2) return bbox(0,0,0,0);
        var minX=pts[0][0], maxX=pts[0][0], minY=pts[0][1], maxY=pts[0][1];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i=1; i<pts.length; i++) {
            ctx.lineTo(pts[i][0], pts[i][1]);
            minX=Math.min(minX,pts[i][0]); maxX=Math.max(maxX,pts[i][0]);
            minY=Math.min(minY,pts[i][1]); maxY=Math.max(maxY,pts[i][1]);
        }
        if (cl) ctx.closePath();
        if (w === 0) {
            // width=0: зафарбувати (polygon-like)
            ctx.fillStyle = PygameLib.cssColor(c);
            ctx.fill();
        } else {
            ctx.lineWidth = w;
            ctx.strokeStyle = PygameLib.cssColor(c);
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
        return bbox(minX, minY, maxX, maxY);
    });

    mod.polygon = new Sk.builtin.func(function (surf, color, pointlist, width) {
        var ctx = surf.context2d;
        var c = PygameLib.extract_color(color);
        var pts = Sk.ffi.remapToJs(pointlist);
        var w = (width !== undefined) ? Sk.ffi.remapToJs(width) : 0;
        if (pts.length < 2) return bbox(0,0,0,0);
        var minX=pts[0][0], maxX=pts[0][0], minY=pts[0][1], maxY=pts[0][1];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i=1; i<pts.length; i++) {
            ctx.lineTo(pts[i][0], pts[i][1]);
            minX=Math.min(minX,pts[i][0]); maxX=Math.max(maxX,pts[i][0]);
            minY=Math.min(minY,pts[i][1]); maxY=Math.max(maxY,pts[i][1]);
        }
        ctx.closePath();
        if (w) {
            ctx.lineWidth = w;
            ctx.strokeStyle = PygameLib.cssColor(c);
            ctx.stroke();
        } else {
            ctx.fillStyle = PygameLib.cssColor(c);
            ctx.fill();
        }
        return bbox(minX, minY, maxX, maxY);
    });

mod.aaline = new Sk.builtin.func(function(surf, color, startpos, endpos, blend) {
    return Sk.misceval.callsim(mod.line, surf, color, startpos, endpos, Sk.ffi.remapToPy(1));
});
mod.aalines = new Sk.builtin.func(function(surf, color, closed, pointlist, blend) {
     return Sk.misceval.callsim(mod.lines, surf, color, closed, pointlist, Sk.ffi.remapToPy(1));
});

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.display
// ─────────────────────────────────────────────────────────────────────────────
function makeDisplayModule() {
    var mod = {};
    mod.__is_initialized = false;

    mod.init = new Sk.builtin.func(function () {
        mod.__is_initialized = true;
        return Sk.builtin.none.none$;
    });
    mod.quit = new Sk.builtin.func(function () {
        mod.__is_initialized = false;
        return Sk.builtin.none.none$;
    });
    mod.get_init = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(mod.__is_initialized);
    });

    mod.set_mode = new Sk.builtin.func(function (size, flags, depth) {
        var f = (flags !== undefined) ? Sk.ffi.remapToJs(flags) : 0;
        var surf = Sk.misceval.callsim(PygameLib.SurfaceType, size, flags || Sk.ffi.remapToPy(0));
        surf._main = true;
        // перезапуск init щоб прикріпити обробники
        surface_init(surf, size, flags || Sk.ffi.remapToPy(0), depth);
        PygameLib.surface = surf;
        mod.surface = surf;
        return surf;
    });

    mod.get_surface = new Sk.builtin.func(function () {
        return PygameLib.surface || Sk.builtin.none.none$;
    });

mod.flip = new Sk.builtin.func(function () {
    if (PygameLib.surface) {
        var s = PygameLib.surface;
        s.main_canvas.width  = s.offscreen_canvas.width;
        s.main_canvas.height = s.offscreen_canvas.height;
        s.main_context.clearRect(0, 0, s.main_canvas.width, s.main_canvas.height);
        s.main_context.drawImage(s.offscreen_canvas, 0, 0);
    }
    // Якщо pygame вже зупинено — не чекаємо rAF, одразу повертаємо
    if (!PygameLib.running) return Sk.builtin.none.none$;
    // Один yield на кадр через requestAnimationFrame:
    // дозволяє браузеру обробити keydown/keyup між кадрами без накопичення затримки
    return new Sk.misceval.promiseToSuspension(new Promise(function(resolve) {
        requestAnimationFrame(function() { resolve(Sk.builtin.none.none$); });
    }));
});
    mod.update = new Sk.builtin.func(function() {
        if (PygameLib.surface) {
            var s = PygameLib.surface;
            s.main_canvas.width  = s.offscreen_canvas.width;
            s.main_canvas.height = s.offscreen_canvas.height;
            s.main_context.clearRect(0, 0, s.main_canvas.width, s.main_canvas.height);
            s.main_context.drawImage(s.offscreen_canvas, 0, 0);
        }
        if (!PygameLib.running) return Sk.builtin.none.none$;
        return new Sk.misceval.promiseToSuspension(new Promise(function(resolve) {
            requestAnimationFrame(function() { resolve(Sk.builtin.none.none$); });
        }));
    });

mod.set_caption = new Sk.builtin.func(function (caption) {
    PygameLib.caption = Sk.ffi.remapToJs(caption);
    if (Sk.title_container) Sk.title_container.innerText = PygameLib.caption;
    document.title = PygameLib.caption;
    // Оновлення заголовка jQuery UI dialog
    if (PygameLib._dialog && typeof $ !== 'undefined' && $.fn && $.fn.dialog) {
        $(PygameLib._dialog).dialog('option', 'title', PygameLib.caption);
    }
    return Sk.builtin.none.none$;
});
    mod.get_caption = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(PygameLib.caption);
    });
    mod.get_active = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(document.hasFocus());
    });
    mod.set_icon = new Sk.builtin.func(function () {
        return Sk.builtin.none.none$; // не реалізовано в браузері
    });

mod.toggle_fullscreen = new Sk.builtin.func(function () {
    try {
        var el = Sk.main_canvas || document.getElementById('pygame-canvas');
        if (!el) return Sk.ffi.remapToPy(0);

        // Перевіряємо поточний стан fullscreen
        var isFullscreen = !!(document.fullscreenElement ||
                             document.webkitFullscreenElement ||
                             document.mozFullScreenElement ||
                             document.msFullscreenElement);

        if (isFullscreen) {
            // Вихід з повноекранного режиму
            var exit = document.exitFullscreen ||
                       document.webkitExitFullscreen ||
                       document.mozCancelFullScreen ||
                       document.msExitFullscreen;
            if (exit) {
                var promise = exit.call(document);
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(function(err) {
                        // Ігноруємо помилку — браузер блокує вихід без user gesture
                        console.debug('Exit fullscreen denied (expected):', err.message);
                    });
                }
            }
        } else {
            // Вхід у повноекранний режим
            var req = el.requestFullscreen ||
                      el.webkitRequestFullscreen ||
                      el.mozRequestFullScreen ||
                      el.msRequestFullscreen;
            if (req) {
                var promise = req.call(el);
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(function(err) {
                        console.warn('Enter fullscreen denied:', err.message);
                    });
                }
            }
        }
    } catch (e) {
        console.warn('Fullscreen toggle error:', e);
    }
    return Sk.ffi.remapToPy(0);
});

    

     
    mod.iconify = new Sk.builtin.func(function () {
        // У браузері немає еквіваленту — повертаємо 0
        return Sk.ffi.remapToPy(0);
    });
    mod.Info = new Sk.builtin.func(function () {
        return Sk.builtin.none.none$;
    });
    mod.list_modes = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(-1); // -1 означає "будь-який розмір"
    });
    mod.mode_ok = new Sk.builtin.func(function (size, flags, depth) {
        return Sk.ffi.remapToPy(32);
    });
    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.event
// ─────────────────────────────────────────────────────────────────────────────
function makeEventModule() {
    var mod = {};

    // Допоміжна функція для створення properties
    var prop = function(getter, setter) {
        return Sk.misceval.callsimOrSuspend(Sk.builtins.property, getter, setter);
    };

    mod.EventType = Sk.misceval.buildClass(mod, function($gbl, $loc) {
        // 1. Визначаємо type та dict як Python-властивості (properties).
        // Тепер Python-код може безпечно читати/писати event.type та event.dict
        $loc.type = prop(
            new Sk.builtin.func(function(s){ return s._type; }),
            new Sk.builtin.func(function(s,v){ s._type = v; }));
        $loc.dict = prop(
            new Sk.builtin.func(function(s){ return s._dict; }),
            new Sk.builtin.func(function(s,v){ s._dict = v; }));

        $loc.__init__ = new Sk.builtin.func(function (self, type, dict) {
            dict = dict || new Sk.builtin.dict([]);
            
            // Зберігаємо базові атрибути як внутрішні JS-властивості
            self._type = type;
            self._dict = dict;
            
            // Додаткові параметри події (key, pos, button тощо) зберігаємо в JS-об'єкті _data
            self._data = {};
            if (dict && dict.mp$subscript) {
                // Sk.builtin.dict — ітеруємо через keys()
                var keys = dict.tp$iter();
                var kitem;
                while ((kitem = keys.tp$iternext()) !== undefined) {
                    var jskey = Sk.ffi.remapToJs(kitem);
                    var pyval = dict.mp$subscript(kitem);
                    self._data[jskey] = pyval;
                }
            }
            return Sk.builtin.none.none$;
        });

        // 2. __getattr__ викликається автоматично, якщо Python не знайшов атрибут серед звичайних властивостей.
        // Це дозволяє нам динамічно віддавати параметри з _data (наприклад, event.key, event.pos)
        $loc.__getattr__ = new Sk.builtin.func(function(self, name) {
            var attr = Sk.ffi.remapToJs(name);
            if (self._data && self._data.hasOwnProperty(attr)) {
                return self._data[attr];
            }
            throw new Sk.builtin.AttributeError("'Event' object has no attribute '" + attr + "'");
        });

        $loc.__repr__ = new Sk.builtin.func(function(self) { 
            var t = Sk.ffi.remapToJs(self._type);
            return Sk.ffi.remapToPy('<Event(' + t + ')>');
        });
    }, 'Event', []);
    PygameLib.EventType = mod.EventType;

    mod.Event = new Sk.builtin.func(function(type, dict) {
        return Sk.misceval.callsim(mod.EventType, type, dict);
    });

    function makeEvent(entry) {
        var type = Sk.ffi.remapToPy(entry[0]);
        var djs  = entry[1];
        var kvs  = [];
        for (var k in djs) {
            kvs.push(Sk.ffi.remapToPy(k));
            kvs.push(Sk.ffi.remapToPy(djs[k]));
        }
        var dict = new Sk.builtin.dict(kvs);
        return Sk.misceval.callsim(mod.EventType, type, dict);
    }

    mod.get = new Sk.builtin.func(function (types) {
        var list = [];
        var types_js = types ? Sk.ffi.remapToJs(types) : null;
        var isArray = Array.isArray(types_js);
        var queue;
        if (!types_js) {
            queue = PygameLib.eventQueue.splice(0);
        } else if (isArray) {
            queue = PygameLib.eventQueue.filter(function(e){ return types_js.includes(e[0]); });
            PygameLib.eventQueue = PygameLib.eventQueue.filter(function(e){ return !types_js.includes(e[0]); });
        } else {
            queue = PygameLib.eventQueue.filter(function(e){ return e[0]===types_js; });
            PygameLib.eventQueue = PygameLib.eventQueue.filter(function(e){ return e[0]!==types_js; });
        }
        for (var i=0; i<queue.length; i++) list.push(makeEvent(queue[i]));
        return new Sk.builtin.list(list);
    });

    mod.poll = new Sk.builtin.func(function () {
        if (PygameLib.eventQueue.length === 0)
            return Sk.misceval.callsim(mod.EventType, Sk.ffi.remapToPy(PygameLib.constants.NOEVENT));
        return makeEvent(PygameLib.eventQueue.pop());
    });

    mod.peek = new Sk.builtin.func(function (types) {
        if (!types) return Sk.ffi.remapToPy(PygameLib.eventQueue.length > 0);
        var tj = Sk.ffi.remapToJs(types);
        var isArray = Array.isArray(tj);
        return Sk.ffi.remapToPy(PygameLib.eventQueue.some(function(e){
            return isArray ? tj.includes(e[0]) : e[0]===tj;
        }));
    });

    mod.clear = new Sk.builtin.func(function (types) {
        if (!types) { PygameLib.eventQueue = []; return Sk.builtin.none.none$; }
        var tj = Sk.ffi.remapToJs(types);
        var isArray = Array.isArray(tj);
        PygameLib.eventQueue = PygameLib.eventQueue.filter(function(e){
            return isArray ? !tj.includes(e[0]) : e[0]!==tj;
        });
        return Sk.builtin.none.none$;
    });

    mod.post = new Sk.builtin.func(function (event) {
        // Читаємо напряму з внутрішніх JS-властивостей об'єкта event
        var t = 0;
        var djs = {};
        try { 
            t = Sk.ffi.remapToJs(event._type); 
            djs = Sk.ffi.remapToJs(event._dict); 
        } catch(e){}
        PygameLib.eventQueue.unshift([t, djs]);
        return Sk.ffi.remapToPy(true);
    });

    mod.wait = new Sk.builtin.func(function () {
        return new Sk.misceval.promiseToSuspension(new Promise(function (resolve) {
            var f = function () {
                if (PygameLib.eventQueue.length) {
                    resolve(makeEvent(PygameLib.eventQueue.pop()));
                } else {
                    Sk.setTimeout(f, 10);
                }
            };
            Sk.setTimeout(f, 10);
        }));
    });

    mod.set_allowed = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.set_blocked = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.get_blocked = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(false); });

    // pygame.event.custom_type() — повертає унікальний тип події >= USEREVENT
    mod._next_custom_type = PygameLib.constants.USEREVENT + 1;
    mod.custom_type = new Sk.builtin.func(function() {
        var t = mod._next_custom_type++;
        if (t > PygameLib.constants.NUMEVENTS - 1)
            throw new Sk.builtin.ValueError('pygame.event.custom_type: too many event types');
        return Sk.ffi.remapToPy(t);
    });

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.key
// ─────────────────────────────────────────────────────────────────────────────
function makeKeyModule() {
    var mod = {};

    mod.set_repeat = new Sk.builtin.func(function (delay, interval) {
        PygameLib.repeatKeys = (delay !== undefined);
    });
    mod.get_repeat = new Sk.builtin.func(function () {
        return PygameLib.repeatKeys
            ? new Sk.builtin.tuple([Sk.ffi.remapToPy(1), Sk.ffi.remapToPy(1)])
            : new Sk.builtin.tuple([Sk.ffi.remapToPy(0), Sk.ffi.remapToPy(0)]);
    });
    mod.get_focused = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(document.hasFocus());
    });
    mod.get_pressed = new Sk.builtin.func(function () {
        var pressed = new Array(PygameLib.constants.K_LAST + 1).fill(false);
        for (var k in PygameLib.pressedKeys) {
            if (k < pressed.length) pressed[k] = true;
        }
        return Sk.ffi.remapToPy(pressed);
    });
    mod.get_mods = new Sk.builtin.func(function () {
        var mask = 0;
        var c = PygameLib.constants;
        if (PygameLib.pressedKeys[c.K_LSHIFT] || PygameLib.pressedKeys[c.K_RSHIFT]) mask |= c.KMOD_SHIFT;
        if (PygameLib.pressedKeys[c.K_LCTRL]  || PygameLib.pressedKeys[c.K_RCTRL])  mask |= c.KMOD_CTRL;
        if (PygameLib.pressedKeys[c.K_LALT]   || PygameLib.pressedKeys[c.K_RALT])   mask |= c.KMOD_ALT;
        if (PygameLib.pressedKeys[c.K_CAPSLOCK]) mask |= c.KMOD_CAPS;
        if (PygameLib.pressedKeys[c.K_NUMLOCK])  mask |= c.KMOD_NUM;
        return Sk.ffi.remapToPy(mask);
    });
    mod.set_mods = new Sk.builtin.func(function(m){ return Sk.builtin.none.none$; });

    var keyNameFunc = new Sk.builtin.func(function (idx) {
        var i = Sk.ffi.remapToJs(idx);
        if (i < 0 || i >= keyToName.length) return Sk.ffi.remapToPy('unknown key');
        return Sk.ffi.remapToPy(keyToName[i] || 'unknown key');
    });
    mod['name'] = keyNameFunc;
    mod['key_name'] = keyNameFunc; // аліас на випадок конфлікту
    mod.key_code = new Sk.builtin.func(function(name) {
        var n = Sk.ffi.remapToJs(name);
        for (var i=0; i<keyToName.length; i++)
            if (keyToName[i] === n) return Sk.ffi.remapToPy(i);
        return Sk.ffi.remapToPy(-1);
    });

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.mouse
// ─────────────────────────────────────────────────────────────────────────────
function makeMouseModule() {
    var mod = {};
    mod.get_pressed = new Sk.builtin.func(function (num_buttons) {
        return Sk.ffi.remapToPy(PygameLib.mouseData.button);
    });
    mod.get_pos = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(PygameLib.mouseData.pos);
    });
    mod.get_rel = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(PygameLib.mouseData.rel);
    });
    mod.set_pos = new Sk.builtin.func(function (x, y) {
        if (Sk.abstr.typeName(x) === 'tuple' && y===undefined) {
            var xy = Sk.ffi.remapToJs(x); x=xy[0]; y=xy[1];
        } else { x=Sk.ffi.remapToJs(x); y=Sk.ffi.remapToJs(y); }
        PygameLib.mouseData.pos = [x, y];
    });
    mod.set_visible = new Sk.builtin.func(function (b) {
        document.body.style.cursor = Sk.ffi.remapToJs(b) ? '' : 'none';
    });
    mod.get_visible = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(document.body.style.cursor !== 'none');
    });
    mod.get_focused = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(document.hasFocus());
    });
    mod.set_cursor = new Sk.builtin.func(function () { return Sk.builtin.none.none$; });
    mod.get_cursor = new Sk.builtin.func(function () { return Sk.builtin.none.none$; });
    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.time
// ─────────────────────────────────────────────────────────────────────────────
function makeTimeModule() {
    var mod = {};
    
    mod.get_ticks = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(Date.now() - PygameLib.initial_time);
    });
    
    mod.wait = new Sk.builtin.func(function (amount) {
        var t_m = Sk.importModule('time', false, true);
        return Sk.misceval.callsimOrSuspend(t_m.$d['sleep'],
            Sk.ffi.remapToPy(Sk.ffi.remapToJs(amount) / 1000));
    });
    mod.delay = mod.wait;

    mod.set_timer = new Sk.builtin.func(function (eventid, milliseconds) {
        var evid = Sk.ffi.remapToJs(eventid);
        var ms   = Sk.ffi.remapToJs(milliseconds);
        if (PygameLib.eventTimer[evid]) clearInterval(PygameLib.eventTimer[evid].timer);
        if (ms > 0) {
            PygameLib.eventTimer[evid] = {
                timer: setInterval(function() {
                    PygameLib.eventQueue.unshift([evid, {}]);
                }, ms)
            };
        }
        return Sk.builtin.none.none$;
    });

    // Клас Clock
    mod.Clock = Sk.misceval.buildClass(mod, function($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function (self) {
            self._prev = null;
            self._dt = 0;
            self._raw = 0;
            self._fps = [];
            self._idx = 0;
            return Sk.builtin.none.none$;
        });

        $loc.tick = new Sk.builtin.func(function (self, framerate) {
            var now = Date.now();
            var dt = (self._prev !== null) ? (now - self._prev) : 0;
            self._raw = dt;
            self._prev = now;

            var delayMs = 0;
            if (framerate !== undefined && framerate !== Sk.builtin.none.none$) {
                var fps = Sk.ffi.remapToJs(framerate);
                if (fps > 0) {
                    var target_ms = 1000 / fps;
                    delayMs = Math.max(0, Math.round(target_ms - dt));
                }
            }

            return new Sk.misceval.promiseToSuspension(new Promise(function(resolve) {
                function finish() {
                    var elapsed = Date.now() - now;
                    self._dt = dt + elapsed;
                    if (self._fps.length < 10) {
                        self._fps.push(self._dt);
                    } else {
                        self._fps[self._idx] = self._dt;
                    }
                    self._idx = (self._idx + 1) % 10;
                    resolve(Sk.ffi.remapToPy(self._dt));
                }
                if (delayMs > 2) {
                    setTimeout(finish, delayMs);
                } else {
                    // Мінімальний yield через rAF щоб браузер встиг обробити події
                    requestAnimationFrame(finish);
                }
            }));
        });

        $loc.tick_busy_loop = $loc.tick;

        $loc.get_time = new Sk.builtin.func(function(self){ 
            return Sk.ffi.remapToPy(self._dt); 
        });
        
        $loc.get_rawtime = new Sk.builtin.func(function(self){ 
            return Sk.ffi.remapToPy(self._raw); 
        });
        
        $loc.get_fps = new Sk.builtin.func(function(self){
            if (self._fps.length === 0) return Sk.ffi.remapToPy(0.0);
            var sum = self._fps.reduce(function(a,b){return a+b;}, 0);
            var avg = sum / self._fps.length;
            return Sk.ffi.remapToPy(avg > 0 ? 1000/avg : 0.0);
        });
    }, 'Clock', []);
    
    PygameLib.ClockType = mod.Clock;
    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.image
// ─────────────────────────────────────────────────────────────────────────────
function makeImageModule() {
    var mod = {};

    mod.load = new Sk.builtin.func(function (filename) {
        var fname = Sk.ffi.remapToJs(filename);

        // Допоміжна функція: завантажує зображення з URL або data URL → Surface
        function loadFromSrc(src, reject) {
            return new Promise(function (resolve, reject_) {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function () {
                    var s = Sk.misceval.callsim(PygameLib.SurfaceType,
                        new Sk.builtin.tuple([
                            Sk.ffi.remapToPy(img.width),
                            Sk.ffi.remapToPy(img.height)]));
                    s.context2d.drawImage(img, 0, 0);
                    resolve(s);
                };
                img.onerror = function () {
                    reject_(new Sk.builtin.IOError('Image not found: ' + fname));
                };
                img.src = src;
            });
        }

        // Перевіряємо чи fname є URL (починається з http/https/data/blob//)
        var isUrl = /^(https?:\/\/|data:|blob:|\/\/)/i.test(fname);

        return new Sk.misceval.promiseToSuspension(new Promise(function (resolve, reject) {
            if (isUrl) {
                // Завантаження з мережі
                loadFromSrc(fname, reject).then(resolve).catch(reject);
            } else {
				
                // Спроба зчитати з локальної FS (fsToBrowse)
                var imgData = null;
                if (typeof fsToBrowse !== 'undefined' && fsToBrowse && typeof fsToBrowse.read === 'function') {
                    
                    try {						
                        imgData = fsToBrowse.read(fname);                       
                    } catch (e) {
                        imgData = null;
                    }
                }

                if (imgData) {
                    // fsToBrowse.read може повернути:
                    //   - рядок data URL ("data:image/png;base64,...")
                    //   - рядок base64 без заголовка
                    //   - Blob або ArrayBuffer
                    var src;
                    if (typeof imgData === 'string') {
                        if (imgData.startsWith('data:')) {
                            src = imgData;
                        } else {
                            // Припускаємо base64, визначаємо тип за розширенням
                            var ext = fname.split('.').pop().toLowerCase();
                            var mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                                     : ext === 'gif' ? 'image/gif'
                                     : ext === 'bmp' ? 'image/bmp'
                                     : 'image/png';
                            src = 'data:' + mime + ';base64,' + imgData;
                        }
                        loadFromSrc(src, reject).then(resolve).catch(reject);
                    } else if (imgData instanceof Blob) {
                        var url = URL.createObjectURL(imgData);
                        loadFromSrc(url, reject).then(function(s) {
                            URL.revokeObjectURL(url);
                            resolve(s);
                        }).catch(reject);
                    } else if (imgData instanceof ArrayBuffer || ArrayBuffer.isView(imgData)) {
                        var blob = new Blob([imgData]);
                        var url2 = URL.createObjectURL(blob);
                        loadFromSrc(url2, reject).then(function(s) {
                            URL.revokeObjectURL(url2);
                            resolve(s);
                        }).catch(reject);
                    } else {
                        reject(new Sk.builtin.IOError('Unsupported image data type for: ' + fname));
                    }
                } else {
                    // Локальна FS не дала результату — пробуємо як відносний URL
                    var url = (Sk.imgPath || '') + fname;
                    loadFromSrc(url, reject).then(resolve).catch(reject);
                }
            }
        }));
    });

    mod.save = new Sk.builtin.func(function (surf, filename) {
        var fname = (filename !== undefined) ? Sk.ffi.remapToJs(filename) : 'surface';
        if (!fname.endsWith('.png') && !fname.endsWith('.jpg')) fname += '.png';
        var a = document.createElement('a');
        a.href = surf.offscreen_canvas.toDataURL('image/png');
        a.download = fname;
        a.click();
    });

    mod.get_extended = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(true);
    });

    mod.tostring = new Sk.builtin.func(function (surf, format, flipped) {
        throw new Sk.builtin.NotImplementedError('pygame.image.tostring not implemented');
    });
    mod.fromstring = new Sk.builtin.func(function (data, size, format, flipped) {
        throw new Sk.builtin.NotImplementedError('pygame.image.fromstring not implemented');
    });

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.font
// ─────────────────────────────────────────────────────────────────────────────
function makeFontModule() {
    var mod = {};
    mod.__is_initialized = false;
    mod.init  = new Sk.builtin.func(function(){ mod.__is_initialized = true; });
    mod.quit  = new Sk.builtin.func(function(){ mod.__is_initialized = false; });
    mod.get_init = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(mod.__is_initialized); });
    mod.get_default_font = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy('freesansbold.ttf'); });
    mod.get_fonts = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(['arial','verdana','helvetica','monospace','sans-serif','serif']); });
    mod.match_font = new Sk.builtin.func(function(name){ return Sk.ffi.remapToPy(Sk.ffi.remapToJs(name)); });

    var FontClass = Sk.misceval.buildClass(mod, function($gbl, $loc) {

var font_init_func = new Sk.builtin.func(function(self, kwa) {
    var kwargs = unpackKWA(kwa);
    
    // Отримуємо значення з kwargs або використовуємо дефолтні
    var filename = kwargs['filename'] || kwargs['name'] || Sk.builtin.none.none$;
    var size = kwargs['size'] !== undefined ? kwargs['size'] : Sk.ffi.remapToPy(16);
    var bold = kwargs['bold'] !== undefined ? kwargs['bold'] : Sk.ffi.remapToPy(false);
    var italic = kwargs['italic'] !== undefined ? kwargs['italic'] : Sk.ffi.remapToPy(false);

    var fname = (filename && filename !== Sk.builtin.none.none$)
        ? Sk.ffi.remapToJs(filename) : 'sans-serif';
    if (typeof fname === 'string' && fname.includes('.')) fname = 'sans-serif';

    self._fname  = fname;
    self._fsize  = Sk.ffi.remapToJs(size);
    self._bold   = !!Sk.ffi.remapToJs(bold);
    self._italic = !!Sk.ffi.remapToJs(italic);
    self._under  = false;
    return Sk.builtin.none.none$;
});

font_init_func.co_kwargs = true;
font_init_func.co_varnames = ['self']; 
$loc.__init__ = font_init_func;
        function fontStr(self) {
            var h  = self._fsize || 16;
            var nm = self._fname || 'sans-serif';
            var fs = h + 'px ' + nm;
            if (self._bold)   fs = 'bold '   + fs;
            if (self._italic) fs = 'italic ' + fs;
            return fs;
        }

        $loc.render = new Sk.builtin.func(function(self, text, antialias, color, background) {
            var msg = Sk.ffi.remapToJs(text);
            var fs  = fontStr(self);
            var h   = (self._fsize || 16) * 1.2;

            var tmp = document.createElement('canvas');
            tmp.width=1; tmp.height=1;
            var tc = tmp.getContext('2d');
            tc.font = fs;
            var w = Math.ceil(tc.measureText(msg).width) + 2;
            if (w < 1) w = 1;
            h = Math.ceil(h);

            var s = Sk.misceval.callsim(PygameLib.SurfaceType,
                new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
            var ctx = s.context2d;

            // Спочатку очищаємо до прозорого (поверхня вже прозора після виправлення surface_init)
            ctx.clearRect(0, 0, w, h);

            if (background && background !== Sk.builtin.none.none$) {
                var bc = PygameLib.extract_color(background);
                ctx.fillStyle = PygameLib.cssColor(bc);
                ctx.fillRect(0, 0, w, h);
            }
            ctx.font = fs;
            var c = PygameLib.extract_color(color);
            ctx.fillStyle = PygameLib.cssColor(c);
            ctx.textBaseline = 'top';
            ctx.fillText(msg, 1, 0);

            if (self._under) {
                ctx.strokeStyle = PygameLib.cssColor(c);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, h-2); ctx.lineTo(w, h-2);
                ctx.stroke();
            }
            return s;
        });

        $loc.size = new Sk.builtin.func(function(self, text) {
            var msg = Sk.ffi.remapToJs(text);
            var fs  = fontStr(self);
            var h   = (self._fsize || 16) * 1.2;
            var tmp = document.createElement('canvas').getContext('2d');
            tmp.font = fs;
            return new Sk.builtin.tuple([
                Sk.ffi.remapToPy(Math.ceil(tmp.measureText(msg).width)),
                Sk.ffi.remapToPy(Math.ceil(h))]);
        });

        $loc.set_bold     = new Sk.builtin.func(function(s,v){ s._bold   = !!Sk.ffi.remapToJs(v); });
        $loc.get_bold     = new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(!!s._bold); });
        $loc.set_italic   = new Sk.builtin.func(function(s,v){ s._italic = !!Sk.ffi.remapToJs(v); });
        $loc.get_italic   = new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(!!s._italic); });
        $loc.set_underline= new Sk.builtin.func(function(s,v){ s._under  = !!Sk.ffi.remapToJs(v); });
        $loc.get_underline= new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(!!s._under); });
        $loc.metrics = new Sk.builtin.func(function(self, text) {
            return Sk.ffi.remapToPy([]);
        });
    }, 'Font', []);
    PygameLib.FontType = FontClass;

    mod.Font = FontClass;

    var sysfont_fn = function(name, size, bold, italic) {
        var fname = (name && name !== Sk.builtin.none.none$)
            ? Sk.ffi.remapToJs(name) : 'sans-serif';
        var f = Sk.misceval.callsim(FontClass,
            Sk.ffi.remapToPy(fname),
            size   || Sk.ffi.remapToPy(16),
            bold   || Sk.ffi.remapToPy(false),
            italic || Sk.ffi.remapToPy(false));
        return f;
    };
    sysfont_fn.co_varnames = ['name', 'size', 'bold', 'italic'];
    sysfont_fn.$defaults   = [Sk.ffi.remapToPy('sans-serif'), Sk.ffi.remapToPy(16),
                              Sk.ffi.remapToPy(false), Sk.ffi.remapToPy(false)];
    mod.SysFont = new Sk.builtin.func(sysfont_fn);

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.transform
// ─────────────────────────────────────────────────────────────────────────────
function makeTransformModule() {
    var mod = {};

    function mkSurf(w, h) {
        return Sk.misceval.callsim(PygameLib.SurfaceType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(Math.max(1,Math.round(w))),
                                  Sk.ffi.remapToPy(Math.max(1,Math.round(h)))]));
    }

    mod.flip = new Sk.builtin.func(function(surf, xbool, ybool) {
        var xf = Sk.ffi.remapToJs(xbool) ? -1 : 1;
        var yf = Sk.ffi.remapToJs(ybool) ? -1 : 1;
        var ret = mkSurf(surf.width, surf.height);
        ret.context2d.save();
        ret.context2d.scale(xf, yf);
        ret.context2d.drawImage(surf.offscreen_canvas,
            xf < 0 ? -surf.width : 0, yf < 0 ? -surf.height : 0);
        ret.context2d.restore();
        return ret;
    });

    function doScale(surf, size) {
        var sz = Sk.ffi.remapToJs(size);
        var w = Math.round(sz[0]), h = Math.round(sz[1]);
        if (w<=0 || h<=0) return surf;
        var ret = mkSurf(w, h);
        ret.context2d.drawImage(surf.offscreen_canvas, 0, 0, w, h);
        return ret;
    }
    mod.scale       = new Sk.builtin.func(function(surf, size, dest){ return doScale(surf, size); });
    mod.smoothscale = new Sk.builtin.func(function(surf, size, dest){ return doScale(surf, size); });
    mod.scale_by    = new Sk.builtin.func(function(surf, factor) {
        var f = Sk.ffi.remapToJs(factor);
        if (Array.isArray(f)) {
            return doScale(surf, new Sk.builtin.tuple([Sk.ffi.remapToPy(surf.width*f[0]), Sk.ffi.remapToPy(surf.height*f[1])]));
        }
        return doScale(surf, new Sk.builtin.tuple([Sk.ffi.remapToPy(surf.width*f), Sk.ffi.remapToPy(surf.height*f)]));
    });

    mod.rotate = new Sk.builtin.func(function(surf, angle) {
        var a = Sk.ffi.remapToJs(angle) * Math.PI / 180;
        var w = surf.width, h = surf.height;
        var cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
        var nw = Math.ceil(w*cos + h*sin), nh = Math.ceil(w*sin + h*cos);
        var ret = mkSurf(nw, nh);
        ret.context2d.clearRect(0, 0, nw, nh);
        ret.context2d.save();
        ret.context2d.translate(nw/2, nh/2);
        ret.context2d.rotate(-a);
        ret.context2d.drawImage(surf.offscreen_canvas, -w/2, -h/2);
        ret.context2d.restore();
        return ret;
    });

    mod.rotozoom = new Sk.builtin.func(function(surf, angle, sc) {
        var a = Sk.ffi.remapToJs(angle) * Math.PI / 180;
        var scale = Sk.ffi.remapToJs(sc);
        var w = surf.width*scale, h = surf.height*scale;
        var cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
        var nw = Math.ceil(w*cos + h*sin), nh = Math.ceil(w*sin + h*cos);
        var ret = mkSurf(nw, nh);
        ret.context2d.clearRect(0, 0, nw, nh);
        ret.context2d.save();
        ret.context2d.translate(nw/2, nh/2);
        ret.context2d.rotate(-a);
        ret.context2d.scale(scale, scale);
        ret.context2d.drawImage(surf.offscreen_canvas, -surf.width/2, -surf.height/2);
        ret.context2d.restore();
        return ret;
    });

    mod.scale2x = new Sk.builtin.func(function(surf) {
        return doScale(surf, new Sk.builtin.tuple([
            Sk.ffi.remapToPy(surf.width*2), Sk.ffi.remapToPy(surf.height*2)]));
    });

    mod.chop = new Sk.builtin.func(function(surf, rect) {
        var r = PygameLib.extract_rect(rect);
        var w = surf.width, h = surf.height;
        var rw = w - (r[0]+r[2]), rh = h - (r[1]+r[3]);
        var ret = mkSurf(w - r[2], h - r[3]);
        var ctx = ret.context2d;
        ctx.drawImage(surf.offscreen_canvas, 0,0,r[0],r[1],  0,0,r[0],r[1]);
        ctx.drawImage(surf.offscreen_canvas, 0,r[1]+r[3],r[0],rh,  0,r[1],r[0],rh);
        ctx.drawImage(surf.offscreen_canvas, r[0]+r[2],0,rw,r[1],  r[0],0,rw,r[1]);
        ctx.drawImage(surf.offscreen_canvas, r[0]+r[2],r[1]+r[3],rw,rh,  r[0],r[1],rw,rh);
        return ret;
    });

    mod.threshold = new Sk.builtin.func(function() {
        throw new Sk.builtin.NotImplementedError('transform.threshold not implemented');
    });
    mod.laplacian = new Sk.builtin.func(function(surf) { return surf; });
    mod.invert = new Sk.builtin.func(function(surf) {
        var ret = Sk.misceval.callsim(PygameLib.SurfaceType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(surf.width), Sk.ffi.remapToPy(surf.height)]));
        var ctx = ret.context2d;
        ctx.drawImage(surf.offscreen_canvas, 0, 0);
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.fillRect(0, 0, surf.width, surf.height);
        ctx.globalCompositeOperation = 'source-over';
        return ret;
    });

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.mixer (заглушка — Web Audio API складний, але навчальні програми рідко потребують звуку)
// ─────────────────────────────────────────────────────────────────────────────
function makeMixerModule() {
    var mod = {};

    function stubSound($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function(self, file){ return Sk.builtin.none.none$; });
        $loc.play    = new Sk.builtin.func(function(self, loops, maxtime, fade_ms){ return Sk.builtin.none.none$; });
        $loc.stop    = new Sk.builtin.func(function(self){ return Sk.builtin.none.none$; });
        $loc.pause   = new Sk.builtin.func(function(self){ return Sk.builtin.none.none$; });
        $loc.unpause = new Sk.builtin.func(function(self){ return Sk.builtin.none.none$; });
        $loc.fadeout = new Sk.builtin.func(function(self, time){ return Sk.builtin.none.none$; });
        $loc.set_volume = new Sk.builtin.func(function(self, v){ return Sk.builtin.none.none$; });
        $loc.get_volume = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(0.0); });
        $loc.get_length = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(0.0); });
        $loc.get_num_channels = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(0); });
        $loc.get_busy = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(false); });
    }

    mod.Sound = Sk.misceval.buildClass(mod, stubSound, 'Sound', []);

    mod.init     = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.quit     = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.get_init = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(false); });
    mod.pre_init = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.stop     = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.pause    = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.unpause  = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.fadeout  = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.set_volume = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.get_volume = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(0.0); });
    mod.get_busy   = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(false); });
    mod.get_num_channels = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(0); });
    mod.find_channel = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.set_num_channels = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.set_reserved = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });

    // music підмодуль
    var music = {};
    music.load    = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.play    = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.stop    = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.pause   = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.unpause = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.fadeout = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.set_volume = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.get_volume = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(0.0); });
    music.get_busy   = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(false); });
    music.get_pos    = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(-1); });
    music.set_pos    = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.rewind     = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.queue      = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.set_endevent = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    music.get_endevent = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(PygameLib.constants.NOEVENT); });
    mod.music = music;

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.sprite (базова реалізація)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// pygame.sprite (базова реалізація)
// ─────────────────────────────────────────────────────────────────────────────
function makeSpriteModule() {
var mod = {};
var SpriteClass = Sk.misceval.buildClass(mod, function($gbl, $loc) {
    $loc.__init__ = new Sk.builtin.func(function(self) {
        self._groups = [];
        self._layer  = 0; // Стандартний шар для Sprite
        return Sk.builtin.none.none$;
    });
    $loc.add = new Sk.builtin.func(function(self) {
        for (var i=1; i<arguments.length; i++) arguments[i].add(self);
    });
    $loc.remove = new Sk.builtin.func(function(self) {
        for (var i=1; i<arguments.length; i++) arguments[i].remove(self);
    });
    $loc.kill = new Sk.builtin.func(function(self) {
        var groups = self._groups || [];
        for (var i = 0; i < groups.length; i++) {
            var arr = groups[i].$d && groups[i].$d['_sprites_arr'];
            if (arr) { var idx = arr.indexOf(self); if (idx > -1) arr.splice(idx, 1); }
        }
        self._groups = [];
        return Sk.builtin.none.none$;
    });
    $loc.alive = new Sk.builtin.func(function(self) {
        return Sk.ffi.remapToPy((self._groups || []).length > 0);
    });
    $loc.groups = new Sk.builtin.func(function(self) {
        return Sk.abstr.gattr(self,'_groups',false);
    });
    $loc.update = new Sk.builtin.func(function(self) {
        return Sk.builtin.none.none$;
    });
    $loc.draw = new Sk.builtin.func(function(self, surface) {			
        var img = Sk.abstr.gattr(self,'image',false);
        var rect = Sk.abstr.gattr(self,'rect',false);
        if (img && rect) {
            var pos = PygameLib.extract_rect(rect);
            surface.context2d.drawImage(img.offscreen_canvas, pos[0], pos[1]);
        }
    });
}, 'Sprite', []);
mod.Sprite = SpriteClass;

// ✅ Оновлена функція makeGroup: тепер приймає boolean isLayered
function makeGroup(isLayered) {
return Sk.misceval.buildClass(mod, function($gbl, $loc) {
    function _getArr(self) {
        if (!self.$d['_sprites_arr']) {
            self.$d['_sprites_arr'] = [];
        }
        return self.$d['_sprites_arr'];
    }
    
    function _addSprite(self, sprite) {
        var arr = _getArr(self);
        if (!sprite) return;
        function _linkGroup(s) {
            if (!s._groups) s._groups = [];
            if (s._groups.indexOf(self) === -1) s._groups.push(self);
        }

        var tname = Sk.abstr.typeName(sprite);
        if (tname === 'list' || tname === 'tuple') {
            sprite.v.forEach(function(s) {
                if (arr.indexOf(s) === -1) { arr.push(s); _linkGroup(s); }
            });
        } else if (tname === 'Group' || tname === 'LayeredUpdates') {
            var inner = sprite.$d['_sprites_arr'] || [];
            inner.forEach(function(s) {
                if (arr.indexOf(s) === -1) { arr.push(s); _linkGroup(s); }
            });
        } else {
            if (arr.indexOf(sprite) === -1) { arr.push(sprite); _linkGroup(sprite); }
        }
    }

    $loc.__init__ = new Sk.builtin.func(function(self) {
        self.$d['_sprites_arr'] = [];
        for (var i = 1; i < arguments.length; i++) {
            _addSprite(self, arguments[i]);
        }
        return Sk.builtin.none.none$;
    });

    // ✅ Перехоплюємо add через tp$call для підтримки kwargs (layer=...)
    var add_func = new Sk.builtin.func(function(self, sprite) {
        _addSprite(self, sprite);
        return Sk.builtin.none.none$;
    });

    if (isLayered) {
        add_func.tp$call = function(args, kwargs) {
            var self = args[0];
            var sprites = args.slice(1);
            
            var layerVal = undefined;
            if (kwargs && kwargs.length > 0) {
                for (var i = 0; i < kwargs.length; i += 2) {
                    var k = (typeof kwargs[i] === 'string') ? kwargs[i] : Sk.ffi.remapToJs(kwargs[i]);
                    if (k === 'layer') {
                        layerVal = Sk.ffi.remapToJs(kwargs[i+1]);
                    }
                }
            }
            
            sprites.forEach(function(sprite) {
                var tname = Sk.abstr.typeName(sprite);
                if (tname === 'list' || tname === 'tuple') {
                    sprite.v.forEach(function(s) { 
                        if(s) {
                            if (layerVal !== undefined) s._layer = layerVal;
                            _addSprite(self, s); 
                        }
                    });
                } else if (sprite) {
                    if (layerVal !== undefined) sprite._layer = layerVal;
                    _addSprite(self, sprite);
                }
            });
            return Sk.builtin.none.none$;
        };
    }
    $loc.add = add_func;

    $loc.remove = new Sk.builtin.func(function(self, sprite) {
        var arr = _getArr(self);
        var idx = arr.indexOf(sprite);
        if (idx > -1) arr.splice(idx, 1);
        return Sk.builtin.none.none$;
    });

    $loc.has = new Sk.builtin.func(function(self, sprite) {
        return Sk.ffi.remapToPy(_getArr(self).indexOf(sprite) > -1);
    });

    // ✅ Для LayeredUpdates sprites() має повертати список, відсортований за шарами
    $loc.sprites = new Sk.builtin.func(function(self) {
        var arr = _getArr(self).slice();
        if (isLayered) {
            arr.sort(function(a, b) {
                var la = a._layer !== undefined ? a._layer : 0;
                var lb = b._layer !== undefined ? b._layer : 0;
                return la - lb;
            });
        }
        return Sk.ffi.remapToPy(arr);
    });

    $loc.__len__ = new Sk.builtin.func(function(self) {
        return Sk.ffi.remapToPy(_getArr(self).length);
    });

    $loc.__iter__ = new Sk.builtin.func(function(self) {
        return Sk.ffi.remapToPy(_getArr(self)).__iter__();
    });

    $loc.__bool__ = new Sk.builtin.func(function(self) {
        return Sk.ffi.remapToPy(_getArr(self).length > 0);
    });

    $loc.copy = new Sk.builtin.func(function(self) {
        var g = Sk.misceval.callsim(isLayered ? mod.LayeredUpdates : mod.Group);
        g.$d['_sprites_arr'] = _getArr(self).slice();
        return g;
    });

    $loc.update = new Sk.builtin.func(function(self) {
        var arr = _getArr(self).slice();
        for (var i = 0; i < arr.length; i++) {
            try {
                Sk.misceval.callsim(
                    Sk.abstr.gattr(arr[i], new Sk.builtin.str('update'), false)
                );
            } catch(e) {}
        }
        return Sk.builtin.none.none$;
    });

    // ✅ Для LayeredUpdates draw() має малювати спрайти у порядку їхніх шарів
    $loc.draw = new Sk.builtin.func(function(self, surface) {
        var arr = _getArr(self).slice();
        if (isLayered) {
            arr.sort(function(a, b) {
                var la = a._layer !== undefined ? a._layer : 0;
                var lb = b._layer !== undefined ? b._layer : 0;
                return la - lb;
            });
        }
        var rects = [];
        for (var i = 0; i < arr.length; i++) {
            var sp = arr[i];
            try {
                var img  = Sk.abstr.gattr(sp, new Sk.builtin.str('image'), false);
                var rect = Sk.abstr.gattr(sp, new Sk.builtin.str('rect'),  false);
                if (!img || !img.offscreen_canvas) continue;
                if (!rect) continue;
                var x = rect.left !== undefined ? rect.left : 0;
                var y = rect.top  !== undefined ? rect.top  : 0;
                surface.context2d.drawImage(img.offscreen_canvas, x, y);
                rects.push(rect);
            } catch(e) { console.warn('Group.draw error:', e); }
        }
        return Sk.ffi.remapToPy(rects);
    });

    $loc.empty = new Sk.builtin.func(function(self) {
        self.$d['_sprites_arr'] = [];
        return Sk.builtin.none.none$;
    });

    // ✅ Додаємо специфічні методи для LayeredUpdates
    if (isLayered) {
        $loc.get_layer_of_sprite = new Sk.builtin.func(function(self, sprite) {
            var layer = sprite._layer !== undefined ? sprite._layer : 0;
            return Sk.ffi.remapToPy(layer);
        });

        $loc.get_top_layer = new Sk.builtin.func(function(self) {
            var arr = _getArr(self);
            var maxL = -Infinity;
            arr.forEach(function(s) {
                var l = s._layer !== undefined ? s._layer : 0;
                if (l > maxL) maxL = l;
            });
            return Sk.ffi.remapToPy(maxL === -Infinity ? 0 : maxL);
        });

        $loc.get_bottom_layer = new Sk.builtin.func(function(self) {
            var arr = _getArr(self);
            var minL = Infinity;
            arr.forEach(function(s) {
                var l = s._layer !== undefined ? s._layer : 0;
                if (l < minL) minL = l;
            });
            return Sk.ffi.remapToPy(minL === Infinity ? 0 : minL);
        });

        $loc.change_layer = new Sk.builtin.func(function(self, sprite, layer) {
            sprite._layer = Sk.ffi.remapToJs(layer);
            return Sk.builtin.none.none$;
        });

        $loc.layers = new Sk.builtin.func(function(self) {
            var arr = _getArr(self);
            var layerSet = {};
            arr.forEach(function(s) {
                var l = s._layer !== undefined ? s._layer : 0;
                layerSet[l] = true;
            });
            var layers = Object.keys(layerSet).map(Number).sort(function(a,b){return a-b;});
            return Sk.ffi.remapToPy(layers);
        });
    }

}, isLayered ? 'LayeredUpdates' : 'Group', []);
}

mod.Group = makeGroup(false);
mod.RenderPlain = mod.Group;
mod.RenderClear = mod.Group;
mod.RenderUpdates = mod.Group;
mod.LayeredUpdates = makeGroup(true); // ✅ Тепер це окремий клас з усіма методами шарів
mod.LayeredDirty   = mod.LayeredUpdates;
mod.GroupSingle = mod.Group;
mod.OrderedUpdates = mod.Group;
//***************************
    // DirtySprite — розширення Sprite з атрибутами dirty/visible/blendmode
    mod.DirtySprite = Sk.misceval.buildClass(mod, function($gbl, $loc) {
        // Python properties — той самий патерн що й Event.type/dict
        var prop = function(getter, setter) {
            return Sk.misceval.callsimOrSuspend(Sk.builtins.property, getter, setter);
        };

        // dirty, visible, blendmode, layer, source_rect — через prop
        // Значення зберігаються як JS-властивості _ds_* напряму на self
        $loc.dirty = prop(
            new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s._ds_dirty !== undefined ? s._ds_dirty : 1); }),
            new Sk.builtin.func(function(s,v){ s._ds_dirty = Sk.ffi.remapToJs(v); }));
        $loc.visible = prop(
            new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s._ds_visible !== undefined ? s._ds_visible : 1); }),
            new Sk.builtin.func(function(s,v){ s._ds_visible = Sk.ffi.remapToJs(v); }));
        $loc.blendmode = prop(
            new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s._ds_blendmode !== undefined ? s._ds_blendmode : 0); }),
            new Sk.builtin.func(function(s,v){ s._ds_blendmode = Sk.ffi.remapToJs(v); }));
        $loc.layer = prop(
            new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s._ds_layer !== undefined ? s._ds_layer : 0); }),
            new Sk.builtin.func(function(s,v){ s._ds_layer = Sk.ffi.remapToJs(v); }));
        $loc.source_rect = prop(
            new Sk.builtin.func(function(s){ return s._ds_source_rect || Sk.builtin.none.none$; }),
            new Sk.builtin.func(function(s,v){ s._ds_source_rect = v; }));

        $loc.__init__ = new Sk.builtin.func(function(self) {
            self._groups         = [];
            self._ds_dirty       = 1;
            self._ds_visible     = 1;
            self._ds_blendmode   = 0;
            self._ds_layer       = 0;
            self._ds_source_rect = null;
            return Sk.builtin.none.none$;
        });

        $loc.add = new Sk.builtin.func(function(self) {
            for (var i = 1; i < arguments.length; i++) arguments[i].add(self);
        });
        $loc.remove = new Sk.builtin.func(function(self) {
            for (var i = 1; i < arguments.length; i++) arguments[i].remove(self);
        });
        $loc.kill = new Sk.builtin.func(function(self) {
            for (var i = 0; i < self._groups.length; i++) self._groups[i].remove(self);
        });
        $loc.alive = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy(self._groups.length > 0);
        });
        $loc.groups = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy(self._groups);
        });
        $loc.update = new Sk.builtin.func(function(self) {
            return Sk.builtin.none.none$;
        });
        $loc.draw = new Sk.builtin.func(function(self, surface) {
            var img  = null, rect = null;
            try { img  = Sk.abstr.gattr(self, 'image', false); } catch(e){}
            try { rect = Sk.abstr.gattr(self, 'rect',  false); } catch(e){}
            if (img && rect) {
                var pos = PygameLib.extract_rect(rect);
                surface.context2d.drawImage(img.offscreen_canvas, pos[0], pos[1]);
            }
        });
    }, 'DirtySprite', []);

    // ── Допоміжні функції ────────────────────────────────────────────────────

    // Отримати JS-rect [x, y, w, h] з атрибута 'rect' спрайта.
    // Повертає null, якщо атрибут відсутній.
    function _spriteRect(sp) {
        // спочатку пробуємо напряму з $d (без виклику Python-машини)
        var r = (sp && sp.$d && sp.$d['rect']) ? sp.$d['rect'] : null;
        if (!r) {
            try { r = Sk.abstr.gattr(sp, new Sk.builtin.str('rect'), true); }
            catch(e) { return null; }
        }
        if (!r) return null;
        // Rect зберігає координати як прямі JS-числа
        if (r.left !== undefined) return [r.left, r.top, r.width, r.height];
        return PygameLib.extract_rect(r);
    }

    // Перевірка перетину двох прямокутників [x,y,w,h].
    function _rectsOverlap(a, b) {
        if (!a || !b) return false;
        return !(a[0] + a[2] <= b[0] ||   // a правіше b
                 b[0] + b[2] <= a[0] ||   // b правіше a
                 a[1] + a[3] <= b[1] ||   // a нижче b
                 b[1] + b[3] <= a[1]);    // b нижче a
    }

    // Отримати центр та радіус кола для спрайта.
    // Радіус = max(w, h) / 2 якщо атрибут 'radius' не встановлено.
    function _spriteCircle(sp) {
        var r = _spriteRect(sp);
        if (!r) return null;
        var cx = r[0] + r[2] / 2;
        var cy = r[1] + r[3] / 2;
        var rad;
        try {
            var pyRad = Sk.abstr.gattr(sp, 'radius', false);
            rad = Sk.ffi.remapToJs(pyRad);
        } catch(e) {
            // За замовчуванням — описане коло навколо rect
            rad = Math.sqrt(r[2] * r[2] + r[3] * r[3]) / 2;
        }
        return { cx: cx, cy: cy, r: rad };
    }

    // Отримати JS-масив Python-об'єктів спрайтів з Group-об'єкта.
    function _groupSprites(group) {
        // спрайти зберігаються в group.$d['_sprites_arr']
        if (group && group.$d && group.$d['_sprites_arr']) {
            return group.$d['_sprites_arr'].slice();
        }
        // фолбек: викликаємо .sprites() і беремо .v (внутрішній масив Python list)
        try {
            var pyList = Sk.misceval.callsim(Sk.abstr.gattr(group, 'sprites', false));
            if (pyList && pyList.v) return pyList.v;
            return [];
        } catch(e) { return []; }
    }

    // ── collide_rect ────────────────────────────────────────────────────────
    // pygame.sprite.collide_rect(left, right) -> bool
    // Повертає True, якщо прямокутники двох спрайтів перетинаються.
    mod.collide_rect = new Sk.builtin.func(function(left, right) {
        var a = _spriteRect(left);
        var b = _spriteRect(right);
        return Sk.ffi.remapToPy(_rectsOverlap(a, b));
    });

    // ── collide_circle ───────────────────────────────────────────────────────
    // pygame.sprite.collide_circle(left, right) -> bool
    // Повертає True, якщо кола двох спрайтів перетинаються.
    // Радіус береться з атрибута 'radius'; якщо відсутній — описане коло rect.
    mod.collide_circle = new Sk.builtin.func(function(left, right) {
        var a = _spriteCircle(left);
        var b = _spriteCircle(right);
        if (!a || !b) return Sk.ffi.remapToPy(false);
        var dx = a.cx - b.cx;
        var dy = a.cy - b.cy;
        var dist2 = dx * dx + dy * dy;
        var sumR  = a.r + b.r;
        return Sk.ffi.remapToPy(dist2 <= sumR * sumR);
    });

    // ── spritecollide ────────────────────────────────────────────────────────
    // pygame.sprite.spritecollide(sprite, group, dokill, collided=None) -> list
    // Повертає список спрайтів з group, що зіткнулися зі sprite.
    // dokill=True — видаляє знайдені спрайти з усіх їхніх груп.
    // collided — необов'язкова функція-колайдер(a,b)->bool; за замовчуванням collide_rect.
    mod.spritecollide = new Sk.builtin.func(function(sprite, group, dokill, collided) {
        var dokillJs = dokill && Sk.ffi.remapToJs(dokill);
        var arr      = _groupSprites(group);
        var result   = [];

        // collided — Python-функція або None/undefined
        var hasFn = collided && collided !== Sk.builtin.none.none$;

        for (var i = 0; i < arr.length; i++) {
            var sp = arr[i];
            if (sp === sprite) continue; // не зіштовхуємо зі собою

            var hit = false;
            if (hasFn) {
                try {
                    var pyBool = Sk.misceval.callsim(collided, sprite, sp);
                    hit = Sk.ffi.remapToJs(pyBool);
                } catch(e) { hit = false; }
            } else {
                // стандартний collide_rect
                hit = _rectsOverlap(_spriteRect(sprite), _spriteRect(sp));
            }

            if (hit) {
                result.push(sp);
                if (dokillJs) {
                    // kill(): видалити з усіх груп
                    try {
                        var killFn = Sk.abstr.gattr(sp, 'kill', false);
                        Sk.misceval.callsim(killFn);
                    } catch(e) {}
                }
            }
        }
        return Sk.ffi.remapToPy(result);
    });

    // ── groupcollide ─────────────────────────────────────────────────────────
    // pygame.sprite.groupcollide(groupa, groupb, dokilla, dokillb, collided=None) -> dict
    // Повертає словник {sprite_з_groupa: [список_спрайтів_з_groupb]}.
    // dokilla=True — вбиває спрайти з groupa при зіткненні.
    // dokillb=True — вбиває спрайти з groupb при зіткненні.
    mod.groupcollide = new Sk.builtin.func(function(groupa, groupb, dokilla, dokillb, collided) {
        var killA   = dokilla  && Sk.ffi.remapToJs(dokilla);
        var killB   = dokillb  && Sk.ffi.remapToJs(dokillb);
        var hasFn   = collided && collided !== Sk.builtin.none.none$;
        var arrA    = _groupSprites(groupa);
        var arrB    = _groupSprites(groupb);

        // Будуємо плоский Python dict через масив пар [key, value, key, value, ...]
        var dictPairs = [];

        for (var i = 0; i < arrA.length; i++) {
            var sa = arrA[i];
            var hits = [];

            for (var j = 0; j < arrB.length; j++) {
                var sb = arrB[j];
                var hit = false;

                if (hasFn) {
                    try {
                        var pyBool = Sk.misceval.callsim(collided, sa, sb);
                        hit = Sk.ffi.remapToJs(pyBool);
                    } catch(e) { hit = false; }
                } else {
                    hit = _rectsOverlap(_spriteRect(sa), _spriteRect(sb));
                }

                if (hit) {
                    hits.push(sb);
                    if (killB) {
                        try {
                            Sk.misceval.callsim(Sk.abstr.gattr(sb, 'kill', false));
                        } catch(e) {}
                    }
                }
            }

            if (hits.length > 0) {
                if (killA) {
                    try {
                        Sk.misceval.callsim(Sk.abstr.gattr(sa, 'kill', false));
                    } catch(e) {}
                }
                dictPairs.push(sa);
                dictPairs.push(Sk.ffi.remapToPy(hits));
            }
        }

        return new Sk.builtin.dict(dictPairs);
    });

    // ── collide_rect_ratio ───────────────────────────────────────────────────
    // pygame.sprite.collide_rect_ratio(ratio) -> collided_func
    // Повертає функцію, яка перевіряє зіткнення масштабованих прямокутників.
    mod.collide_rect_ratio = new Sk.builtin.func(function(ratio) {
        var r = Sk.ffi.remapToJs(ratio);
        return new Sk.builtin.func(function(left, right) {
            var a = _spriteRect(left);
            var b = _spriteRect(right);
            if (!a || !b) return Sk.ffi.remapToPy(false);
            // Масштабуємо обидва rect навколо їх центрів
            function scale(rc) {
                var nw = rc[2] * r, nh = rc[3] * r;
                return [rc[0] + (rc[2] - nw) / 2, rc[1] + (rc[3] - nh) / 2, nw, nh];
            }
            return Sk.ffi.remapToPy(_rectsOverlap(scale(a), scale(b)));
        });
    });

    // ── collide_circle_ratio ─────────────────────────────────────────────────
    // pygame.sprite.collide_circle_ratio(ratio) -> collided_func
    mod.collide_circle_ratio = new Sk.builtin.func(function(ratio) {
        var r = Sk.ffi.remapToJs(ratio);
        return new Sk.builtin.func(function(left, right) {
            var a = _spriteCircle(left);
            var b = _spriteCircle(right);
            if (!a || !b) return Sk.ffi.remapToPy(false);
            var dx = a.cx - b.cx;
            var dy = a.cy - b.cy;
            var dist2 = dx * dx + dy * dy;
            var sumR  = (a.r + b.r) * r;
            return Sk.ffi.remapToPy(dist2 <= sumR * sumR);
        });
    });

    // ── collide_mask ─────────────────────────────────────────────────────────
    // pygame.sprite.collide_mask(left, right) -> point | None
    // Перевіряє зіткнення через маску пікселів (атрибут 'mask').
    // Повертає перший конфліктний пункт або None.
    mod.collide_mask = new Sk.builtin.func(function(left, right) {
        // Спочатку перевіряємо rect — швидка відмова
        var ra = _spriteRect(left);
        var rb = _spriteRect(right);
        if (!_rectsOverlap(ra, rb)) return Sk.builtin.none.none$;

        var maskA = null, maskB = null;
        try { maskA = Sk.abstr.gattr(left,  'mask', false); } catch(e){}
        try { maskB = Sk.abstr.gattr(right, 'mask', false); } catch(e){}

        if (!maskA || !maskB ||
            maskA === Sk.builtin.none.none$ ||
            maskB === Sk.builtin.none.none$) {
            // Немає маски — fallback до rect, повертаємо точку перетину
            var ix = Math.max(ra[0], rb[0]);
            var iy = Math.max(ra[1], rb[1]);
            return new Sk.builtin.tuple([Sk.ffi.remapToPy(ix), Sk.ffi.remapToPy(iy)]);
        }

        // Якщо маска реалізована (pygame.mask.Mask), делегуємо overlap()
        try {
            var ox = Sk.ffi.remapToPy(Math.round(rb[0] - ra[0]));
            var oy = Sk.ffi.remapToPy(Math.round(rb[1] - ra[1]));
            var overlapFn = Sk.abstr.gattr(maskA, 'overlap', false);
            var pt = Sk.misceval.callsim(overlapFn, maskB,
                         new Sk.builtin.tuple([ox, oy]));
            return pt;  // (x,y) або None
        } catch(e) {
            return Sk.builtin.none.none$;
        }
    });

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.math
// ─────────────────────────────────────────────────────────────────────────────
function makeMathModule() {
    var mod = {};

    var Vector2 = Sk.misceval.buildClass(mod, function($gbl, $loc) {

        $loc.__init__ = new Sk.builtin.func(function(self, x, y) {
            if (x === undefined) { self._x = 0; self._y = 0; }
            else if (y === undefined) {
                var xjs = Sk.ffi.remapToJs(x);
                if (Array.isArray(xjs)) { self._x = xjs[0]; self._y = xjs[1]; }
                else { self._x = +xjs; self._y = +xjs; }
            } else {
                self._x = +Sk.ffi.remapToJs(x);
                self._y = +Sk.ffi.remapToJs(y);
            }
            return Sk.builtin.none.none$;
        });

        $loc.__getattr__ = new Sk.builtin.func(function(self, name) {
            var n = Sk.ffi.remapToJs(name);
            if (n === 'x') return Sk.ffi.remapToPy(self._x);
            if (n === 'y') return Sk.ffi.remapToPy(self._y);
            throw new Sk.builtin.AttributeError('Vector2 has no attribute ' + n);
        });

        $loc.__setattr__ = new Sk.builtin.func(function(self, name, val) {
            var n = Sk.ffi.remapToJs(name);
            if (n === 'x') { self._x = +Sk.ffi.remapToJs(val); return Sk.builtin.none.none$; }
            if (n === 'y') { self._y = +Sk.ffi.remapToJs(val); return Sk.builtin.none.none$; }
            throw new Sk.builtin.AttributeError('Vector2 has no attribute ' + n);
        });

        $loc.__repr__ = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy('<Vector2(' + self._x.toFixed(4) + ', ' + self._y.toFixed(4) + ')>');
        });

        $loc.__add__ = new Sk.builtin.func(function(self, other) {
            var ox, oy;
            if (Sk.abstr.typeName(other) === 'Vector2') { ox = other._x; oy = other._y; }
            else { var o = Sk.ffi.remapToJs(other); if (Array.isArray(o)) { ox=o[0]; oy=o[1]; } else { ox=+o; oy=+o; } }
            return Sk.misceval.callsim(Vector2, Sk.ffi.remapToPy(self._x+ox), Sk.ffi.remapToPy(self._y+oy));
        });

        $loc.__sub__ = new Sk.builtin.func(function(self, other) {
            var ox, oy;
            if (Sk.abstr.typeName(other) === 'Vector2') { ox = other._x; oy = other._y; }
            else { var o = Sk.ffi.remapToJs(other); if (Array.isArray(o)) { ox=o[0]; oy=o[1]; } else { ox=+o; oy=+o; } }
            return Sk.misceval.callsim(Vector2, Sk.ffi.remapToPy(self._x-ox), Sk.ffi.remapToPy(self._y-oy));
        });

        $loc.__mul__ = new Sk.builtin.func(function(self, scalar) {
            var s = +Sk.ffi.remapToJs(scalar);
            return Sk.misceval.callsim(Vector2, Sk.ffi.remapToPy(self._x*s), Sk.ffi.remapToPy(self._y*s));
        });
        $loc.__rmul__ = $loc.__mul__;

        $loc.__truediv__ = new Sk.builtin.func(function(self, scalar) {
            var s = +Sk.ffi.remapToJs(scalar);
            return Sk.misceval.callsim(Vector2, Sk.ffi.remapToPy(self._x/s), Sk.ffi.remapToPy(self._y/s));
        });

        $loc.__neg__ = new Sk.builtin.func(function(self) {
            return Sk.misceval.callsim(Vector2, Sk.ffi.remapToPy(-self._x), Sk.ffi.remapToPy(-self._y));
        });

        $loc.__iadd__ = new Sk.builtin.func(function(self, other) {
            if (Sk.abstr.typeName(other) === 'Vector2') { self._x += other._x; self._y += other._y; }
            else { var o = Sk.ffi.remapToJs(other); if (Array.isArray(o)) { self._x+=o[0]; self._y+=o[1]; } else { self._x+=+o; self._y+=+o; } }
            return self;
        });

        $loc.__isub__ = new Sk.builtin.func(function(self, other) {
            if (Sk.abstr.typeName(other) === 'Vector2') { self._x -= other._x; self._y -= other._y; }
            else { var o = Sk.ffi.remapToJs(other); if (Array.isArray(o)) { self._x-=o[0]; self._y-=o[1]; } else { self._x-=+o; self._y-=+o; } }
            return self;
        });

        $loc.__imul__ = new Sk.builtin.func(function(self, scalar) {
            var s = +Sk.ffi.remapToJs(scalar);
            self._x *= s; self._y *= s;
            return self;
        });

        $loc.__iter__ = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy([self._x, self._y]).__iter__();
        });

        $loc.__getitem__ = new Sk.builtin.func(function(self, idx) {
            var i = Sk.ffi.remapToJs(idx);
            if (i === 0) return Sk.ffi.remapToPy(self._x);
            if (i === 1) return Sk.ffi.remapToPy(self._y);
            throw new Sk.builtin.IndexError('index out of range');
        });

        $loc.__len__ = new Sk.builtin.func(function(self) { return Sk.ffi.remapToPy(2); });

        $loc.__eq__ = new Sk.builtin.func(function(self, other) {
            if (Sk.abstr.typeName(other) !== 'Vector2') return Sk.ffi.remapToPy(false);
            return Sk.ffi.remapToPy(self._x === other._x && self._y === other._y);
        });

        $loc.length = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy(Math.sqrt(self._x*self._x + self._y*self._y));
        });

        $loc.length_squared = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy(self._x*self._x + self._y*self._y);
        });

        $loc.normalize = new Sk.builtin.func(function(self) {
            var l = Math.sqrt(self._x*self._x + self._y*self._y);
            if (l === 0) throw new Sk.builtin.ValueError('Cannot normalize zero vector');
            return Sk.misceval.callsim(Vector2, Sk.ffi.remapToPy(self._x/l), Sk.ffi.remapToPy(self._y/l));
        });

        $loc.normalize_ip = new Sk.builtin.func(function(self) {
            var l = Math.sqrt(self._x*self._x + self._y*self._y);
            if (l === 0) throw new Sk.builtin.ValueError('Cannot normalize zero vector');
            self._x /= l; self._y /= l;
        });

        $loc.dot = new Sk.builtin.func(function(self, other) {
            return Sk.ffi.remapToPy(self._x * other._x + self._y * other._y);
        });

        $loc.cross = new Sk.builtin.func(function(self, other) {
            return Sk.ffi.remapToPy(self._x * other._y - self._y * other._x);
        });

        $loc.distance_to = new Sk.builtin.func(function(self, other) {
            var dx = self._x - other._x, dy = self._y - other._y;
            return Sk.ffi.remapToPy(Math.sqrt(dx*dx + dy*dy));
        });

        $loc.distance_squared_to = new Sk.builtin.func(function(self, other) {
            var dx = self._x - other._x, dy = self._y - other._y;
            return Sk.ffi.remapToPy(dx*dx + dy*dy);
        });

        $loc.rotate = new Sk.builtin.func(function(self, angle) {
            var a = +Sk.ffi.remapToJs(angle) * Math.PI / 180;
            var cos = Math.cos(a), sin = Math.sin(a);
            return Sk.misceval.callsim(Vector2,
                Sk.ffi.remapToPy(self._x*cos - self._y*sin),
                Sk.ffi.remapToPy(self._x*sin + self._y*cos));
        });

        $loc.rotate_ip = new Sk.builtin.func(function(self, angle) {
            var a = +Sk.ffi.remapToJs(angle) * Math.PI / 180;
            var cos = Math.cos(a), sin = Math.sin(a);
            var nx = self._x*cos - self._y*sin;
            var ny = self._x*sin + self._y*cos;
            self._x = nx; self._y = ny;
        });

    $loc.rotate_rad = new Sk.builtin.func(function(self, angle) {
        var a = +Sk.ffi.remapToJs(angle); // Кут вже в радіанах
        var cos = Math.cos(a), sin = Math.sin(a);
        return Sk.misceval.callsim(Vector2,
            Sk.ffi.remapToPy(self._x*cos - self._y*sin),
            Sk.ffi.remapToPy(self._x*sin + self._y*cos));
    });

    $loc.rotate_rad_ip = new Sk.builtin.func(function(self, angle) {
        var a = +Sk.ffi.remapToJs(angle); // Кут вже в радіанах
        var cos = Math.cos(a), sin = Math.sin(a);
        var nx = self._x*cos - self._y*sin;
        var ny = self._x*sin + self._y*cos;
        self._x = nx; self._y = ny;
    });

        $loc.angle_to = new Sk.builtin.func(function(self, other) {
            return Sk.ffi.remapToPy((Math.atan2(other._y, other._x) - Math.atan2(self._y, self._x)) * 180 / Math.PI);
        });

        $loc.scale_to_length = new Sk.builtin.func(function(self, len) {
            var cur = Math.sqrt(self._x*self._x + self._y*self._y);
            if (cur === 0) throw new Sk.builtin.ValueError('Cannot scale zero vector');
            var s = +Sk.ffi.remapToJs(len) / cur;
            self._x *= s; self._y *= s;
        });

        $loc.copy = new Sk.builtin.func(function(self) {
            return Sk.misceval.callsim(Vector2, Sk.ffi.remapToPy(self._x), Sk.ffi.remapToPy(self._y));
        });

    }, 'Vector2', []);

    mod.Vector2 = Vector2;
    mod.Vector3 = Vector2;
    mod.clamp = new Sk.builtin.func(function(val, mn, mx) {
        var v=Sk.ffi.remapToJs(val), a=Sk.ffi.remapToJs(mn), b=Sk.ffi.remapToJs(mx);
        return Sk.ffi.remapToPy(Math.max(a, Math.min(b, v)));
    });
    mod.lerp = new Sk.builtin.func(function(a, b, t) {
        var av=Sk.ffi.remapToJs(a), bv=Sk.ffi.remapToJs(b), tv=Sk.ffi.remapToJs(t);
        return Sk.ffi.remapToPy(av + (bv-av)*tv);
    });

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.version
// ─────────────────────────────────────────────────────────────────────────────
function makeVersionModule() {
    var mod = {};
    mod.ver    = Sk.ffi.remapToPy('2.5.2');
    mod.vernum = new Sk.builtin.tuple([Sk.ffi.remapToPy(2), Sk.ffi.remapToPy(5), Sk.ffi.remapToPy(2)]);
    mod.rev    = Sk.ffi.remapToPy('');
    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.PixelArray
// ─────────────────────────────────────────────────────────────────────────────
function makePixelArrayClass(mod) {
    return Sk.misceval.buildClass(mod, function($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function(self, surface) {
            self._surf = surface;
            // Читаємо усі пікселі в JS-масив для швидкого доступу
            self._w = surface.width;
            self._h = surface.height;
            self._data = surface.context2d.getImageData(0, 0, self._w, self._h);
            return Sk.builtin.none.none$;
        });

        // px[x] повертає об'єкт-стовпець що підтримує px[x][y]
        $loc.__getitem__ = new Sk.builtin.func(function(self, x) {
            var xi = Sk.ffi.remapToJs(x);
            // Повертаємо проксі-об'єкт стовпця
            var col = Sk.misceval.callsim(PygameLib._PixelColType,
                self, Sk.ffi.remapToPy(xi));
            return col;
        });

        $loc.__setitem__ = new Sk.builtin.func(function(self, x, val) {
            // px[x] = color — встановлює весь стовпець (рідко використовується)
            var xi = Sk.ffi.remapToJs(x);
            var c = PygameLib.extract_color(val);
            var d = self._data.data;
            for (var y = 0; y < self._h; y++) {
                var idx = (y * self._w + xi) * 4;
                d[idx]   = c[0]; d[idx+1] = c[1];
                d[idx+2] = c[2]; d[idx+3] = Math.round(c[3] * 255);
            }
            return Sk.builtin.none.none$;
        });

        // Записати зміни назад на поверхню
        $loc.close = new Sk.builtin.func(function(self) {
            self._surf.context2d.putImageData(self._data, 0, 0);
            return Sk.builtin.none.none$;
        });

        $loc.__del__ = new Sk.builtin.func(function(self) {
            // При видаленні автоматично flush (якщо не було close)
            try { self._surf.context2d.putImageData(self._data, 0, 0); } catch(e){}
            return Sk.builtin.none.none$;
        });

        $loc.__repr__ = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy('<PixelArray(' + self._w + 'x' + self._h + ')>');
        });
    }, 'PixelArray', []);
}

// Проксі-об'єкт для стовпця PixelArray: px[x][y]
function makePixelColClass(mod) {
    return Sk.misceval.buildClass(mod, function($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function(self, pa, x) {
            self._pa = pa;
            self._x  = Sk.ffi.remapToJs(x);
            return Sk.builtin.none.none$;
        });
        $loc.__getitem__ = new Sk.builtin.func(function(self, y) {
            var yi = Sk.ffi.remapToJs(y);
            var d  = self._pa._data.data;
            var idx = (yi * self._pa._w + self._x) * 4;
            // Повертаємо упакований int (RGBA → int32)
            return Sk.ffi.remapToPy(
                ((d[idx+3] << 24) | (d[idx] << 16) | (d[idx+1] << 8) | d[idx+2]) >>> 0);
        });
        $loc.__setitem__ = new Sk.builtin.func(function(self, y, val) {
            var yi = Sk.ffi.remapToJs(y);
            var c  = PygameLib.extract_color(val);
            var d  = self._pa._data.data;
            var idx = (yi * self._pa._w + self._x) * 4;
            d[idx]   = c[0]; d[idx+1] = c[1];
            d[idx+2] = c[2]; d[idx+3] = Math.round(c[3] * 255);
            return Sk.builtin.none.none$;
        });
    }, '_PixelCol', []);
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.surfarray (модуль)
// ─────────────────────────────────────────────────────────────────────────────
function makeSurfarrayModule() {
    var mod = {};

    // array2d: повертає список списків упакованих int (W×H)
    mod.array2d = new Sk.builtin.func(function(surf) {
        var w = surf.width, h = surf.height;
        var d = surf.context2d.getImageData(0, 0, w, h).data;
        var rows = [];
        for (var x = 0; x < w; x++) {
            var col = [];
            for (var y = 0; y < h; y++) {
                var i = (y * w + x) * 4;
                col.push(((d[i+3]<<24)|(d[i]<<16)|(d[i+1]<<8)|d[i+2]) >>> 0);
            }
            rows.push(col);
        }
        return Sk.ffi.remapToPy(rows);
    });

    // array3d: повертає список списків [r,g,b] (W×H×3)
    mod.array3d = new Sk.builtin.func(function(surf) {
        var w = surf.width, h = surf.height;
        var d = surf.context2d.getImageData(0, 0, w, h).data;
        var rows = [];
        for (var x = 0; x < w; x++) {
            var col = [];
            for (var y = 0; y < h; y++) {
                var i = (y * w + x) * 4;
                col.push([d[i], d[i+1], d[i+2]]);
            }
            rows.push(col);
        }
        return Sk.ffi.remapToPy(rows);
    });

    // make_surface: з array2d або array3d → Surface
    mod.make_surface = new Sk.builtin.func(function(arr) {
        var a = Sk.ffi.remapToJs(arr);
        var w = a.length, h = a[0] ? a[0].length : 0;
        var surf = Sk.misceval.callsim(PygameLib.SurfaceType,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
        var imgData = surf.context2d.createImageData(w, h);
        var d = imgData.data;
        for (var x = 0; x < w; x++) {
            for (var y = 0; y < h; y++) {
                var idx = (y * w + x) * 4;
                var px = a[x][y];
                if (Array.isArray(px)) {
                    d[idx]=px[0]; d[idx+1]=px[1]; d[idx+2]=px[2]; d[idx+3]=255;
                } else {
                    // упакований int
                    d[idx]   = (px >> 16) & 0xff;
                    d[idx+1] = (px >> 8)  & 0xff;
                    d[idx+2] =  px        & 0xff;
                    d[idx+3] = (px >> 24) & 0xff;
                }
            }
        }
        surf.context2d.putImageData(imgData, 0, 0);
        return surf;
    });

    // blit_array: накладає array2d/array3d на поверхню
    mod.blit_array = new Sk.builtin.func(function(surf, arr) {
        var a = Sk.ffi.remapToJs(arr);
        var w = Math.min(surf.width,  a.length);
        var h = Math.min(surf.height, (a[0]||[]).length);
        var imgData = surf.context2d.getImageData(0, 0, surf.width, surf.height);
        var d = imgData.data;
        for (var x = 0; x < w; x++) {
            for (var y = 0; y < h; y++) {
                var idx = (y * surf.width + x) * 4;
                var px = a[x][y];
                if (Array.isArray(px)) {
                    d[idx]=px[0]; d[idx+1]=px[1]; d[idx+2]=px[2]; d[idx+3]=255;
                } else {
                    d[idx]   = (px >> 16) & 0xff;
                    d[idx+1] = (px >> 8)  & 0xff;
                    d[idx+2] =  px        & 0xff;
                    d[idx+3] = (px >> 24) & 0xff;
                }
            }
        }
        surf.context2d.putImageData(imgData, 0, 0);
        return Sk.builtin.none.none$;
    });

mod.map_array = new Sk.builtin.func(function(surf, arr)  {
    return Sk.misceval.callsim(mod.make_surface, arr);
});

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.mask (доповнення: from_surface, from_threshold)
// ─────────────────────────────────────────────────────────────────────────────
function makeMaskModule() {
    var MaskClass = Sk.misceval.buildClass({}, function($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function(self, size, fill) {
            var s = Sk.ffi.remapToJs(size);
            self._w = s[0]; self._h = s[1];
            var f = fill ? Sk.ffi.remapToJs(fill) : false;
            // Бітова маска як плоский масив булевих значень [w*h]
            self._bits = new Array(self._w * self._h).fill(f ? true : false);
            return Sk.builtin.none.none$;
        });

        $loc.get_size = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy([self._w, self._h]);
        });
        $loc.get_at = new Sk.builtin.func(function(self, pos) {
            var p = Sk.ffi.remapToJs(pos);
            return Sk.ffi.remapToPy(self._bits[p[1] * self._w + p[0]] ? 1 : 0);
        });
        $loc.set_at = new Sk.builtin.func(function(self, pos, val) {
            var p = Sk.ffi.remapToJs(pos);
            self._bits[p[1] * self._w + p[0]] = Sk.ffi.remapToJs(val) ? true : false;
            return Sk.builtin.none.none$;
        });
        $loc.fill = new Sk.builtin.func(function(self) {
            self._bits.fill(true);
            return Sk.builtin.none.none$;
        });
        $loc.clear = new Sk.builtin.func(function(self) {
            self._bits.fill(false);
            return Sk.builtin.none.none$;
        });
        $loc.invert = new Sk.builtin.func(function(self) {
            for (var i=0; i<self._bits.length; i++) self._bits[i] = !self._bits[i];
            return Sk.builtin.none.none$;
        });
        $loc.count = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy(self._bits.filter(Boolean).length);
        });
    $loc.overlap = new Sk.builtin.func(function(self, other, offset) {
        var ox = 0, oy = 0;
        if (offset) { var o  = Sk.ffi.remapToJs(offset); ox=o[0]; oy=o[1]; }
        for (var x=0; x <self._w; x++) {
            for (var y=0; y <self._h; y++) {
                if (!self._bits[y*self._w+x]) continue;
                // Виправлено: віднімаємо зсув, щоб знайти правильну координату в other
                var nx = x - ox, ny = y - oy; 
                if (nx >=0 && nx <other._w && ny >=0 && ny <other._h && other._bits[ny*other._w+nx])
                    return Sk.ffi.remapToPy([x, y]);
            }
        }
        return Sk.builtin.none.none$;
    });
    $loc.overlap_area = new  Sk.builtin.func(function(self, other, offset) {
        var ox=0,oy=0;
        if (offset) { var o=Sk.ffi.remapToJs(offset); ox=o[0]; oy=o[1]; }
        var count=0;
        for ( var x=0;x <self._w;x++) for (var y=0;y <self._h;y++) {
            if (!self._bits[y*self._w+x]) continue;
            // Виправлено: віднімаємо зсув
            var nx = x - ox, ny = y - oy; 
            if (nx >=0 && nx <other._w && ny >=0 && ny <other._h && other._bits[ny*other._w+nx]) count++;
        }
        return Sk.ffi.remapToPy(count);
    });
    
        $loc.overlap_mask = new Sk.builtin.func(function(self, other, offset) {
        var ox = 0, oy = 0;
        if (offset) { var o = Sk.ffi.remapToJs(offset); ox = o[0]; oy = o[1]; }
        
        // Створюємо нову маску того ж розміру, що й self
        var result = Sk.misceval.callsim(MaskClass,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(self._w), Sk.ffi.remapToPy(self._h)]));
        
        // Заповнюємо тільки ті пікселі, які перекриваються
        for (var x = 0; x < self._w; x++) {
            for (var y = 0; y < self._h; y++) {
                if (!self._bits[y * self._w + x]) continue;
                var nx = x - ox, ny = y - oy; // ✅ Віднімаємо зсув
                if (nx >= 0 && nx < other._w && ny >= 0 && ny < other._h && other._bits[ny * other._w + nx]) {
                    result._bits[y * self._w + x] = true;
                }
            }
        }
        return result;
    });
    
    
    
        $loc.get_bounding_rects = new Sk.builtin.func(function(self) {
            return Sk.ffi.remapToPy([]);
        });
// 1. Сама логіка малювання (чиста функція)
var _to_surface_impl = function(self, setcolor, unsetcolor) {
    // Якщо аргумент не переданий або це Python None, використовуємо дефолт
    var sc = (setcolor && setcolor !== Sk.builtin.none.none$) 
        ? PygameLib.extract_color(setcolor) 
        : [255, 255, 255, 255];
    var uc = (unsetcolor && unsetcolor !== Sk.builtin.none.none$) 
        ? PygameLib.extract_color(unsetcolor) 
        : [0, 0, 0, 0];

    var surf = Sk.misceval.callsim(PygameLib.SurfaceType,
        new Sk.builtin.tuple([Sk.ffi.remapToPy(self._w), Sk.ffi.remapToPy(self._h)]));
    var ctx = surf.context2d;

    for (var x = 0; x < self._w; x++) {
        for (var y = 0; y < self._h; y++) {
            ctx.fillStyle = PygameLib.cssColor(self._bits[y * self._w + x] ? sc : uc);
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return surf;
};

// 2. Обгортка для позиційних аргументів
var to_surface_func = new Sk.builtin.func(function(self, setcolor, unsetcolor) {
    return _to_surface_impl(self, setcolor, unsetcolor);
});

// 3. Перехоплювач tp$call для іменованих аргументів
to_surface_func.tp$call = function(args, kwargs) {
    var self = args[0];
    var setcolor = args[1] !== undefined ? args[1] : null;
    var unsetcolor = args[2] !== undefined ? args[2] : null;

    // Розпаковуємо kwargs, якщо вони є
    if (kwargs && kwargs.length > 0) {
        for (var i = 0; i < kwargs.length; i += 2) {
            var k = (typeof kwargs[i] === 'string') ? kwargs[i] : Sk.ffi.remapToJs(kwargs[i]);
            var v = kwargs[i + 1];
            if (k === 'setcolor') setcolor = v;
            else if (k === 'unsetcolor') unsetcolor = v;
        }
    }
    
    return _to_surface_impl(self, setcolor, unsetcolor);
};

$loc.to_surface = to_surface_func;
    }, 'Mask', []);

    var mod = {};
    mod.Mask = MaskClass;

    mod.from_surface = new Sk.builtin.func(function(surf, threshold) {		
        var th = (threshold !== undefined) ? Sk.ffi.remapToJs(threshold) : 127;
        var w = surf.width, h = surf.height;
        var d = surf.context2d.getImageData(0, 0, w, h).data;
        var mask = Sk.misceval.callsim(MaskClass,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
        for (var x=0;x<w;x++) for (var y=0;y<h;y++) {
            var alpha = d[(y*w+x)*4+3];
            mask._bits[y*w+x] = alpha > th;
        }        
        return mask;
    });

    mod.from_threshold = new Sk.builtin.func(function(surf, color, threshold, othersurface, palette_colors) {
        var c = PygameLib.extract_color(color);
        var th = threshold ? PygameLib.extract_color(threshold) : [0,0,0,255];
        var w = surf.width, h = surf.height;
        var d = surf.context2d.getImageData(0, 0, w, h).data;
        var mask = Sk.misceval.callsim(MaskClass,
            new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
        for (var x=0;x<w;x++) for (var y=0;y<h;y++) {
            var i=(y*w+x)*4;
            mask._bits[y*w+x] = (
                Math.abs(d[i]-c[0])<=th[0] &&
                Math.abs(d[i+1]-c[1])<=th[1] &&
                Math.abs(d[i+2]-c[2])<=th[2]);
        }
        return mask;
    });

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.joystick (заглушка)
// ─────────────────────────────────────────────────────────────────────────────
function makeJoystickModule() {
    var mod = {};
    mod.init      = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.quit      = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.get_init  = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(true); });
    mod.get_count = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(0); });

    mod.Joystick = Sk.misceval.buildClass(mod, function($gbl, $loc) {
        $loc.__init__     = new Sk.builtin.func(function(self, id){ return Sk.builtin.none.none$; });
        $loc.init         = new Sk.builtin.func(function(self){ return Sk.builtin.none.none$; });
        $loc.quit         = new Sk.builtin.func(function(self){ return Sk.builtin.none.none$; });
        $loc.get_init     = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(false); });
        $loc.get_id       = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(0); });
        $loc.get_name     = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(''); });
        $loc.get_numaxes  = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(0); });
        $loc.get_numbuttons= new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(0); });
        $loc.get_numhats  = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(0); });
        $loc.get_numballs = new Sk.builtin.func(function(self){ return Sk.ffi.remapToPy(0); });
        $loc.get_axis     = new Sk.builtin.func(function(self,i){ return Sk.ffi.remapToPy(0.0); });
        $loc.get_button   = new Sk.builtin.func(function(self,i){ return Sk.ffi.remapToPy(0); });
        $loc.get_hat      = new Sk.builtin.func(function(self,i){ return Sk.ffi.remapToPy([0,0]); });
        $loc.get_ball     = new Sk.builtin.func(function(self,i){ return Sk.ffi.remapToPy([0,0]); });
    }, 'Joystick', []);

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.freetype (тонка обгортка над pygame.font)
// ─────────────────────────────────────────────────────────────────────────────
function makeFreetypeModule() {
    var mod = {};
    mod.init  = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.quit  = new Sk.builtin.func(function(){ return Sk.builtin.none.none$; });
    mod.get_init = new Sk.builtin.func(function(){ return Sk.ffi.remapToPy(true); });
    mod.get_default_font = new Sk.builtin.func(function(){
        return Sk.ffi.remapToPy('freesansbold.ttf');
    });
    mod.get_default_resolution = new Sk.builtin.func(function(){
        return Sk.ffi.remapToPy(72);
    });

    // pygame.freetype.Font — схожий на pygame.font.Font, але render() інший
    mod.Font = Sk.misceval.buildClass(mod, function($gbl, $loc) {
        var ft_init = function(self, filename, size) {
            var fname = (filename && filename !== Sk.builtin.none.none$)
                ? Sk.ffi.remapToJs(filename) : 'sans-serif';
            if (typeof fname === 'string' && fname.includes('.')) fname = 'sans-serif';
            self._fname  = fname;
            self._fsize  = (size !== undefined && size !== Sk.builtin.none.none$)
                ? Sk.ffi.remapToJs(size) : 16;
            self._bold   = false;
            self._italic = false;
            return Sk.builtin.none.none$;
        };
        ft_init.co_varnames = ['self', 'filename', 'size'];
        ft_init.$defaults   = [Sk.builtin.none.none$, Sk.ffi.remapToPy(16)];
        $loc.__init__ = new Sk.builtin.func(ft_init);

        function fontStr(self) {
            var h = self._fsize || 16;
            var nm = self._fname || 'sans-serif';
            var fs = h + 'px ' + nm;
            if (self._bold)   fs = 'bold '   + fs;
            if (self._italic) fs = 'italic ' + fs;
            return fs;
        }

        // Приватна JS-функція рендеру (викликається з render і render_to)
        function _ftRender(self, text, fgcolor, bgcolor, size) {
            var msg = Sk.ffi.remapToJs(text);
            var fsz = (size && size !== Sk.builtin.none.none$)
                ? Sk.ffi.remapToJs(size) : self._fsize;
            var origSize = self._fsize;
            self._fsize = fsz;
            var fs = fontStr(self);
            self._fsize = origSize;

            var h = fsz * 1.2;
            var tmp = document.createElement('canvas');
            tmp.width = 1; tmp.height = 1;
            var tc = tmp.getContext('2d');
            tc.font = fs;
            var w = Math.ceil(tc.measureText(msg).width) + 2;
            if (w < 1) w = 1;
            h = Math.ceil(h);

            var s = Sk.misceval.callsim(PygameLib.SurfaceType,
                new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
            var ctx = s.context2d;
            if (bgcolor && bgcolor !== Sk.builtin.none.none$) {
                var bc = PygameLib.extract_color(bgcolor);
                ctx.fillStyle = PygameLib.cssColor(bc);
                ctx.fillRect(0, 0, w, h);
            }
            ctx.font = fs;
            var c = PygameLib.extract_color(fgcolor);
            ctx.fillStyle = PygameLib.cssColor(c);
            ctx.textBaseline = 'top';
            ctx.fillText(msg, 1, 0);

            var r = Sk.misceval.callsim(PygameLib.RectType,
                new Sk.builtin.tuple([Sk.ffi.remapToPy(0), Sk.ffi.remapToPy(0)]),
                new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
            return { surf: s, rect: r };
        }

        // freetype.Font.render(text, fgcolor, bgcolor=None, size=0) → (Surface, Rect)
        $loc.render = new Sk.builtin.func(function(self, text, fgcolor, bgcolor, size) {
            var res = _ftRender(self, text, fgcolor, bgcolor, size);
            return new Sk.builtin.tuple([res.surf, res.rect]);
        });

        // render_to(surf, dest, text, fgcolor, bgcolor=None, size=0) → Rect
        $loc.render_to = new Sk.builtin.func(function(self, surf, dest, text, fgcolor, bgcolor, size) {
            var res = _ftRender(self, text, fgcolor, bgcolor, size);
            var pos = Sk.ffi.remapToJs(dest);
            surf.context2d.drawImage(res.surf.offscreen_canvas, pos[0], pos[1]);
            return res.rect;
        });

        $loc.get_rect = new Sk.builtin.func(function(self, text, size) {
            var msg = Sk.ffi.remapToJs(text);
            var fsz = (size && size !== Sk.builtin.none.none$)
                ? Sk.ffi.remapToJs(size) : self._fsize;
            var h = Math.ceil(fsz * 1.2);
            var tmp2 = document.createElement('canvas').getContext('2d');
            tmp2.font = fsz + 'px ' + (self._fname||'sans-serif');
            var w = Math.ceil(tmp2.measureText(msg).width) + 2;
            return Sk.misceval.callsim(PygameLib.RectType,
                new Sk.builtin.tuple([Sk.ffi.remapToPy(0), Sk.ffi.remapToPy(0)]),
                new Sk.builtin.tuple([Sk.ffi.remapToPy(w), Sk.ffi.remapToPy(h)]));
        });

        $loc.get_sized_height = new Sk.builtin.func(function(self, size) {
            var fsz = size ? Sk.ffi.remapToJs(size) : self._fsize;
            return Sk.ffi.remapToPy(Math.ceil(fsz * 1.2));
        });

        $loc.set_bold   = new Sk.builtin.func(function(s,v){ s._bold  =!!Sk.ffi.remapToJs(v); });
        $loc.set_italic = new Sk.builtin.func(function(s,v){ s._italic=!!Sk.ffi.remapToJs(v); });
        $loc.get_bold   = new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(!!s._bold); });
        $loc.get_italic = new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(!!s._italic); });

        // Властивість size
        var prop = function(getter, setter) {
            return Sk.misceval.callsimOrSuspend(Sk.builtins.property, getter, setter);
        };
        $loc.size = prop(
            new Sk.builtin.func(function(s){ return Sk.ffi.remapToPy(s._fsize); }),
            new Sk.builtin.func(function(s,v){ s._fsize = Sk.ffi.remapToJs(v); }));

    }, 'Font', []);

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// pygame.gfxdraw (часткова реалізація через canvas)
// ─────────────────────────────────────────────────────────────────────────────
function makeGfxdrawModule() {
    var mod = {};

    function gc(color) { return PygameLib.extract_color(color); }

    mod.pixel = new Sk.builtin.func(function(surf, x, y, color) {
        var c = gc(color);
        surf.context2d.fillStyle = PygameLib.cssColor(c);
        surf.context2d.fillRect(Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y), 1, 1);
        return Sk.builtin.none.none$;
    });

    mod.hline = new Sk.builtin.func(function(surf, x1, x2, y, color) {
        var c = gc(color);
        var ctx = surf.context2d;
        ctx.fillStyle = PygameLib.cssColor(c);
        ctx.fillRect(Sk.ffi.remapToJs(x1), Sk.ffi.remapToJs(y),
                     Sk.ffi.remapToJs(x2) - Sk.ffi.remapToJs(x1) + 1, 1);
        return Sk.builtin.none.none$;
    });

    mod.vline = new Sk.builtin.func(function(surf, x, y1, y2, color) {
        var c = gc(color);
        var ctx = surf.context2d;
        ctx.fillStyle = PygameLib.cssColor(c);
        ctx.fillRect(Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y1),
                     1, Sk.ffi.remapToJs(y2) - Sk.ffi.remapToJs(y1) + 1);
        return Sk.builtin.none.none$;
    });

    // Заповнений прямокутник
    mod.box = new Sk.builtin.func(function(surf, x, y, w, h, color) {
        var c = gc(color);
        surf.context2d.fillStyle = PygameLib.cssColor(c);
        surf.context2d.fillRect(Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y),
                                Sk.ffi.remapToJs(w), Sk.ffi.remapToJs(h));
        return Sk.builtin.none.none$;
    });

    function drawCircle(ctx, x, y, r, c, fill) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2);
        if (fill) { ctx.fillStyle = PygameLib.cssColor(c); ctx.fill(); }
        else { ctx.lineWidth=1; ctx.strokeStyle = PygameLib.cssColor(c); ctx.stroke(); }
    }

    mod.circle = new Sk.builtin.func(function(surf, x, y, r, color) {
        drawCircle(surf.context2d,
            Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y), Sk.ffi.remapToJs(r),
            gc(color), false);
        return Sk.builtin.none.none$;
    });
//
/* ✅ draw.circle
var draw_circle_func = new Sk.builtin.func(function (surf, color, pos, radius, kwa) {
    var kwargs = unpackKWA(kwa);
    var width = kwargs['width'] !== undefined ? Sk.ffi.remapToJs(kwargs['width']) : 0;

    var ctx = surf.context2d;
    var c = PygameLib.extract_color(color);
    
    var x, y;
    // ... (залиште тут ваш існуючий код парсингу x та y з pos без змін) ...
    try {
        var p_js = Sk.ffi.remapToJs(pos);
        if (Array.isArray(p_js) && p_js.length >= 2) { x = p_js[0]; y = p_js[1]; } 
        else { throw new Error("Not an array"); }
    } catch (e) {
        if (pos.v && Array.isArray(pos.v)) { x = Sk.ffi.remapToJs(pos.v[0]); y = Sk.ffi.remapToJs(pos.v[1]); } 
        else if (pos.x !== undefined && pos.y !== undefined) { x = Sk.ffi.remapToJs(pos.x); y = Sk.ffi.remapToJs(pos.y); }
        else { x = Sk.ffi.remapToJs(Sk.abstr.gattr(pos, 'x', false)); y = Sk.ffi.remapToJs(Sk.abstr.gattr(pos, 'y', false)); }
    }

    var rad = Sk.ffi.remapToJs(radius);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
    if (width) {
        ctx.lineWidth = width;
        ctx.strokeStyle = PygameLib.cssColor(c);
        ctx.stroke();
    } else {
        ctx.fillStyle = PygameLib.cssColor(c);
        ctx.fill();
    }
    ctx.restore();

    return bbox(x - rad, y - rad, x + rad, y + rad);
});

// 🔥 КРИТИЧНО: Вказуємо підтримку kwargs
draw_circle_func.co_kwargs = true;
draw_circle_func.co_varnames = ['surf', 'color', 'pos', 'radius'];
mod.circle = draw_circle_func;
*/
    mod.filled_circle = new Sk.builtin.func(function(surf, x, y, r, color) {
        drawCircle(surf.context2d,
            Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y), Sk.ffi.remapToJs(r),
            gc(color), true);
        return Sk.builtin.none.none$;
    });

    mod.aacircle = new Sk.builtin.func(function(surf, x, y, r, color) {
        // Anti-aliased = те саме через canvas (браузер сам згладжує)
        drawCircle(surf.context2d,
            Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y), Sk.ffi.remapToJs(r),
            gc(color), false);
        return Sk.builtin.none.none$;
    });

    mod.aafilled_circle = new Sk.builtin.func(function(surf, x, y, r, color) {
        drawCircle(surf.context2d,
            Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y), Sk.ffi.remapToJs(r),
            gc(color), true);
        return Sk.builtin.none.none$;
    });

    function drawEllipse(ctx, x, y, rx, ry, c, fill) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2);
        if (fill) { ctx.fillStyle = PygameLib.cssColor(c); ctx.fill(); }
        else { ctx.lineWidth=1; ctx.strokeStyle = PygameLib.cssColor(c); ctx.stroke(); }
    }

    mod.ellipse = new Sk.builtin.func(function(surf, x, y, rx, ry, color) {
        drawEllipse(surf.context2d,
            Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y),
            Sk.ffi.remapToJs(rx), Sk.ffi.remapToJs(ry), gc(color), false);
        return Sk.builtin.none.none$;
    });

    mod.filled_ellipse = new Sk.builtin.func(function(surf, x, y, rx, ry, color) {
        drawEllipse(surf.context2d,
            Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y),
            Sk.ffi.remapToJs(rx), Sk.ffi.remapToJs(ry), gc(color), true);
        return Sk.builtin.none.none$;
    });

    mod.aaellipse = mod.ellipse;

    mod.arc = new Sk.builtin.func(function(surf, x, y, r, start_angle, stop_angle, color) {
        var c = gc(color), ctx = surf.context2d;
        ctx.beginPath();
        ctx.arc(Sk.ffi.remapToJs(x), Sk.ffi.remapToJs(y), Sk.ffi.remapToJs(r),
            -Sk.ffi.remapToJs(start_angle), -Sk.ffi.remapToJs(stop_angle), true);
        ctx.lineWidth=1; ctx.strokeStyle=PygameLib.cssColor(c); ctx.stroke();
        return Sk.builtin.none.none$;
    });

    mod.pie = new Sk.builtin.func(function(surf, x, y, r, start_angle, stop_angle, color) {
        var c = gc(color), ctx = surf.context2d;
        var xi=Sk.ffi.remapToJs(x), yi=Sk.ffi.remapToJs(y), ri=Sk.ffi.remapToJs(r);
        ctx.beginPath();
        ctx.moveTo(xi, yi);
        ctx.arc(xi, yi, ri, -Sk.ffi.remapToJs(start_angle), -Sk.ffi.remapToJs(stop_angle), true);
        ctx.closePath();
        ctx.lineWidth=1; ctx.strokeStyle=PygameLib.cssColor(c); ctx.stroke();
        return Sk.builtin.none.none$;
    });

    mod.line = new Sk.builtin.func(function(surf, x1, y1, x2, y2, color) {
        var c = gc(color), ctx = surf.context2d;
        ctx.beginPath();
        ctx.moveTo(Sk.ffi.remapToJs(x1), Sk.ffi.remapToJs(y1));
        ctx.lineTo(Sk.ffi.remapToJs(x2), Sk.ffi.remapToJs(y2));
        ctx.lineWidth=1; ctx.strokeStyle=PygameLib.cssColor(c); ctx.stroke();
        return Sk.builtin.none.none$;
    });

    mod.aaline = mod.line;

    mod.polygon = new Sk.builtin.func(function(surf, points, color) {
        var c = gc(color), ctx = surf.context2d;
        var pts = Sk.ffi.remapToJs(points);
        if (!pts.length) return Sk.builtin.none.none$;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.lineWidth=1; ctx.strokeStyle=PygameLib.cssColor(c); ctx.stroke();
        return Sk.builtin.none.none$;
    });

    mod.filled_polygon = new Sk.builtin.func(function(surf, points, color) {
        var c = gc(color), ctx = surf.context2d;
        var pts = Sk.ffi.remapToJs(points);
        if (!pts.length) return Sk.builtin.none.none$;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle=PygameLib.cssColor(c); ctx.fill();
        return Sk.builtin.none.none$;
    });

    mod.aapolygon = mod.polygon;

mod.trigon = new Sk.builtin.func(function(surf, x1,y1,x2,y2,x3,y3,color) {
    return Sk.misceval.callsim(mod.polygon, surf, Sk.ffi.remapToPy([[Sk.ffi.remapToJs(x1),Sk.ffi.remapToJs(y1) ],[Sk.ffi.remapToJs(x2),Sk.ffi.remapToJs(y2)],[Sk.ffi.remapToJs(x3),Sk.ffi.remapToJs(y3)]]), color);
});

mod.filled_trigon = new Sk.builtin.func(function(surf, x1,y1,x2,y2,x3,y3,color) {
    return Sk.misceval.callsim(mod.filled_polygon, surf, Sk.ffi.remapToPy([[Sk.ffi.remapToJs(x1),Sk.ffi.remapToJs(y1)],[Sk.ffi.remapToJs(x2),Sk.ffi.remapToJs(y2)],[Sk.ffi.remapToJs(x3),Sk.ffi.remapToJs(y3)]]), color);
});

    mod.aatrigon = mod.trigon;

    mod.bezier = new Sk.builtin.func(function(surf, points, steps, color) {
        var c = gc(color), ctx = surf.context2d;
        var pts = Sk.ffi.remapToJs(points);
        var n = pts.length - 1;
        if (n < 1) return Sk.builtin.none.none$;
        var st = steps ? Sk.ffi.remapToJs(steps) : 20;
        ctx.beginPath();
        for (var t=0; t<=st; t++) {
            var u = t/st;
            // Де Кастельйо
            var p = pts.map(function(q){ return q.slice(); });
            for (var r=1; r<=n; r++)
                for (var i=0; i<=n-r; i++) {
                    p[i][0] = (1-u)*p[i][0]+u*p[i+1][0];
                    p[i][1] = (1-u)*p[i][1]+u*p[i+1][1];
                }
            if (t===0) ctx.moveTo(p[0][0], p[0][1]);
            else ctx.lineTo(p[0][0], p[0][1]);
        }
        ctx.lineWidth=1; ctx.strokeStyle=PygameLib.cssColor(c); ctx.stroke();
        return Sk.builtin.none.none$;
    });

    return mod;
}

// ─────────────────────────────────────────────────────────────────────────────
// Реєстрація підмодулів через Sk.builtinFiles
// ─────────────────────────────────────────────────────────────────────────────
if (!Sk.builtinFiles) Sk.builtinFiles = { files: {} };
if (!Sk.builtinFiles.files) Sk.builtinFiles.files = {};

// Кожен підмодуль реєструється як окремий builtinFiles-модуль
var _submodules = {
    'pygame/display.js':   makeDisplayModule,
    'pygame/draw.js':      makeDrawModule,
    'pygame/event.js':     makeEventModule,
    'pygame/key.js':       makeKeyModule,
    'pygame/mouse.js':     makeMouseModule,
    'pygame/time.js':      makeTimeModule,
    'pygame/image.js':     makeImageModule,
    'pygame/font.js':      makeFontModule,
    'pygame/transform.js': makeTransformModule,
    'pygame/mixer.js':     makeMixerModule,
    'pygame/sprite.js':    makeSpriteModule,
    'pygame/math.js':      makeMathModule,
    'pygame/version.js':   makeVersionModule,
    'pygame/surfarray.js': makeSurfarrayModule,
    'pygame/mask.js':      makeMaskModule,
    'pygame/joystick.js':  makeJoystickModule,
    'pygame/freetype.js':  makeFreetypeModule,
    'pygame/gfxdraw.js':   makeGfxdrawModule,
};

// Skulpt шукає підмодулі за допомогою Sk.builtinFiles.files[path]
// Для pygame.display шлях буде 'src/lib/pygame/display.js' або просто через $builtinmodule
// Найнадійніший спосіб — використовувати Sk.sysmodules напряму після init

// ─────────────────────────────────────────────────────────────────────────────
// Головний $builtinmodule для pygame
// ─────────────────────────────────────────────────────────────────────────────
var $builtinmodule = function (name) {
    var mod = {};

    // Всі константи доступні напряму: import pygame; pygame.QUIT
    for (var k in PygameLib.constants) {
        mod[k] = Sk.ffi.remapToPy(PygameLib.constants[k]);
    }

    // Типи
    mod.Surface = Sk.misceval.buildClass(mod, surface_class, 'Surface', []);
    PygameLib.SurfaceType = mod.Surface;

    mod.Color = Sk.misceval.buildClass(mod, color_class, 'Color', []);
    PygameLib.ColorType = mod.Color;

    mod.Rect = Sk.misceval.buildClass(mod, rect_class, 'Rect', []);
    PygameLib.RectType = mod.Rect;

    // PixelArray — потребує SurfaceType вже визначеним
    PygameLib._PixelColType = makePixelColClass(mod);
    mod.PixelArray = makePixelArrayClass(mod);

    // ─────────────────────────────────────────────────────────────────────────────
    // Реєстрація підмодулів (має відбуватися при імпорті pygame, а не в init)
    // ─────────────────────────────────────────────────────────────────────────────
    var submap = {
        'display':   makeDisplayModule,
        'draw':      makeDrawModule,
        'event':     makeEventModule,
        'key':       makeKeyModule,
        'mouse':     makeMouseModule,
        'time':      makeTimeModule,
        'image':     makeImageModule,
        'font':      makeFontModule,
        'transform': makeTransformModule,
        'mixer':     makeMixerModule,
        'sprite':    makeSpriteModule,
        'math':      makeMathModule,
        'version':   makeVersionModule,
        'surfarray': makeSurfarrayModule,
        'mask':      makeMaskModule,
        'joystick':  makeJoystickModule,
        'freetype':  makeFreetypeModule,
        'gfxdraw':   makeGfxdrawModule,
    };

    for (var shortName in submap) {
        var makeFn = submap[shortName];
        var submodDict = makeFn();

        var submod = new Sk.builtin.module();
        submod.tp$name = 'pygame.' + shortName;
        submod.$d = {};

        // Реєструємо кожну функцію через tp$setattr — так Skulpt знаходить їх через tp$getattr
        for (var attr in submodDict) {
            if (Object.prototype.hasOwnProperty.call(submodDict, attr)) {
                submod.$d[attr] = submodDict[attr];
            }
        }
        submod.$d['__name__'] = new Sk.builtin.str('pygame.' + shortName);

        // Для pygame.key: перевизначаємо tp$getattr щоб 'name' точно знаходилось
        if (shortName === 'key') {
            var origGetAttr = submod.tp$getattr;
            var keyFuncs = submod.$d;
            submod.tp$getattr = function(pyname, canSuspend) {
                var jsname = typeof pyname === 'string' ? pyname : Sk.ffi.remapToJs(pyname);
                if (keyFuncs.hasOwnProperty(jsname)) return keyFuncs[jsname];
                if (origGetAttr) return origGetAttr.call(this, pyname, canSuspend);
                throw new Sk.builtin.AttributeError("module 'pygame.key' has no attribute '" + jsname + "'");
            };
        }
        Sk.sysmodules.mp$ass_subscript(Sk.ffi.remapToPy('pygame.' + shortName), submod);
        mod[shortName] = submod;
    }

    // Окремо обробляємо pygame.locals
    var localsMod = new Sk.builtin.module();
    localsMod.tp$name = 'pygame.locals';
    localsMod.$d = {};
    for (var ck in PygameLib.constants) {
        localsMod.$d[ck] = Sk.ffi.remapToPy(PygameLib.constants[ck]);
    }
    mod['locals'] = localsMod;
    Sk.sysmodules.mp$ass_subscript(Sk.ffi.remapToPy('pygame.locals'), localsMod);

    // pygame.mixer.music — теж звичайний JS-об'єкт
    var musicMod = mod['mixer']['music'];
    if (musicMod) {
        musicMod['__name__'] = 'pygame.mixer.music';
        mod['mixer']['music'] = musicMod;
        Sk.sysmodules.mp$ass_subscript(Sk.ffi.remapToPy('pygame.mixer.music'), musicMod);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // pygame.init() - залишається лише очищення стану
    // ─────────────────────────────────────────────────────────────────────────────
    mod.init = new Sk.builtin.func(function () {
        PygameLib.eventQueue = [];
        PygameLib.eventTimer = {};
        PygameLib.pressedKeys = {};
        PygameLib.mouseData = { button: [0, 0, 0], pos: [0, 0], rel: [0, 0] };
        PygameLib.running = true;
        PygameLib.repeatKeys = false;
        PygameLib.initial_time = Date.now();

        return new Sk.builtin.tuple([Sk.ffi.remapToPy(6), Sk.ffi.remapToPy(0)]);
    });

    mod.quit = new Sk.builtin.func(function () {
        PygameLib.running = false;
        for (var t in PygameLib.eventTimer) {
            if (PygameLib.eventTimer[t] && PygameLib.eventTimer[t].timer)
                clearInterval(PygameLib.eventTimer[t].timer);
        }
        PygameLib.eventTimer = {};
        if (Sk.quitHandler) Sk.quitHandler();
        // Зупиняємо виконання Skulpt:
        // Sk.execLimit = 1 змушує Skulpt кинути виняток при наступному кроці.
        // Якщо середовище надало власний обробник зупинки — використовуємо його.
        if (typeof Sk.interruptExecution === 'function') {
            Sk.interruptExecution();
        } else {
            Sk.builtin.SystemExit;
        }
        return Sk.builtin.none.none$;
    });

    mod.get_init = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(PygameLib.running);
    });

    mod.error = Sk.misceval.buildClass(mod, function($gbl, $loc) {
        $loc.__init__ = new Sk.builtin.func(function(self, msg) {
            Sk.abstr.sattr(self, 'args', new Sk.builtin.tuple([msg]), false);
        });
    }, 'error', [Sk.builtins['Exception']]);

    mod.get_error = new Sk.builtin.func(function() {
        throw new Sk.builtin.NotImplementedError('get_error');
    });
    mod.set_error = new Sk.builtin.func(function() { 
        throw new Sk.builtin.NotImplementedError('set_error');
    });
    mod.get_sdl_version = new Sk.builtin.func(function() {
        return new Sk.builtin.tuple([Sk.ffi.remapToPy(2), Sk.ffi.remapToPy(28), Sk.ffi.remapToPy(0)]);
    });
    mod.get_sdl_byteorder = new Sk.builtin.func(function() {
        return Sk.ffi.remapToPy(PygameLib.constants.LIL_ENDIAN);
    });
    mod.register_quit = new Sk.builtin.func(function(fn) {
        Sk.quitHandler = function() { Sk.misceval.callsim(fn); };
    });

    return mod;
};
