/* tkinter JS engine (classic script, no ES modules). Exposes global TkEngine. */

// ============================================================
// _boot.js
// ============================================================

/**
 * Shared namespace + default sync suspension object.
 * dialogs.js reads ns.susp before app.js runs; app.js mutates this same object.
 */
(function (ns) {
  "use strict";
  ns.susp = {
    is_sync: true,
    is_suspension: function (value) { return false; },
    chain: function (value, onValue, onError) {
      try {
        return onValue(value);
      } catch (e) {
        if (onError) return onError(e);
        throw e;
      }
    },
    suspend: function (register) {
      throw new Error("suspensions are not supported in synchronous mode");
    },
  };
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// tcl.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Tcl value conventions used between tkinter and the emulated Tk.
   *
   * JS port of pythonny_tk/tcl.py: converts values to Tcl string form,
   * splits/joins Tcl lists, and parses Tcl numbers and booleans.
   */

  class TclError extends Error {
    constructor(message) {
      super(message);
      this.name = `TclError`;
    }
  }

  const NEEDS_QUOTING = /[\s{}\[\]$\\;"]/;
  const ESCAPE = /([\s{}\[\]$\\;"])/g;

  function to_str(value) {
    if (typeof value === `string`) return value;
    if (typeof value === `boolean`) return value ? `1` : `0`;
    if (typeof value === `number`) {
      return Number.isInteger(value) ? String(value) : String(value);
    }
    if (Array.isArray(value)) return join_list(value);
    if (value === null || value === undefined) return ``;
    return String(value);
  }

  function braces_balanced(s) {
    let depth = 0;
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === `\\`) {
        i += 2;
        continue;
      }
      if (c === `{`) depth += 1;
      else if (c === `}`) {
        depth -= 1;
        if (depth < 0) return false;
      }
      i += 1;
    }
    return depth === 0;
  }

  function quote_element(s) {
    if (s === ``) return `{}`;
    if (!NEEDS_QUOTING.test(s) && !s.startsWith(`#`)) return s;
    if (braces_balanced(s) && !s.endsWith(`\\`)) return `{` + s + `}`;
    return s.replace(ESCAPE, `\\$1`).replace(/\n/g, `\\n`);
  }

  function join_list(items) {
    return items.map((item) => quote_element(to_str(item))).join(` `);
  }

  const BACKSLASH = {
    n: `\n`,
    t: `\t`,
    r: `\r`,
    a: `\x07`,
    b: `\b`,
    f: `\f`,
    v: `\v`,
  };

  function split_list(value) {
    if (Array.isArray(value)) return value.slice();
    const s = to_str(value);
    const items = [];
    let i = 0;
    const n = s.length;
    for (;;) {
      while (i < n && /\s/.test(s[i])) i += 1;
      if (i >= n) break;
      if (s[i] === `{`) {
        let depth = 1;
        let j = i + 1;
        while (j < n && depth) {
          if (s[j] === `\\`) {
            j += 2;
            continue;
          }
          if (s[j] === `{`) depth += 1;
          else if (s[j] === `}`) depth -= 1;
          j += 1;
        }
        if (depth) throw new TclError(`unmatched open brace in list`);
        items.push(s.slice(i + 1, j - 1));
        i = j;
      } else if (s[i] === `"`) {
        let j = i + 1;
        let buf = ``;
        while (j < n && s[j] !== `"`) {
          if (s[j] === `\\` && j + 1 < n) {
            buf += BACKSLASH[s[j + 1]] ?? s[j + 1];
            j += 2;
          } else {
            buf += s[j];
            j += 1;
          }
        }
        if (j >= n) throw new TclError(`unmatched open quote in list`);
        items.push(buf);
        i = j + 1;
      } else {
        let buf = ``;
        while (i < n && !/\s/.test(s[i])) {
          if (s[i] === `\\` && i + 1 < n) {
            buf += BACKSLASH[s[i + 1]] ?? s[i + 1];
            i += 2;
          } else {
            buf += s[i];
            i += 1;
          }
        }
        items.push(buf);
      }
    }
    return items;
  }

  const INT_RE = /^\s*([+-]?)(0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|0[0-7]*|[1-9][0-9]*)\s*$/;

  function get_int(value) {
    if (typeof value === `boolean`) return value ? 1 : 0;
    if (typeof value === `number`) return Math.trunc(value);
    const s = to_str(value);
    const m = INT_RE.exec(s);
    if (!m) {
      // Tcl converts a whole double to an integer ("1.0" -> 1).
      const d = /^([+-]?)(\d+)\.0+$/.exec(s.trim());
      if (d) return (d[1] === `-` ? -1 : 1) * parseInt(d[2], 10);
      throw new TclError(`expected integer but got "${s}"`);
    }
    const sign = m[1];
    const digits = m[2];
    const lower = digits.slice(0, 2).toLowerCase();
    let number;
    if (lower === `0x` || lower === `0o` || lower === `0b`) {
      number = parseInt(digits, lower === `0x` ? 16 : lower === `0o` ? 8 : 2);
    } else if (digits.length > 1 && digits[0] === `0`) {
      number = parseInt(digits, 8);
    } else {
      number = parseInt(digits, 10);
    }
    return sign === `-` ? -number : number;
  }

  function get_double(value) {
    if (typeof value === `number` && !Number.isNaN(value)) return value;
    const s = to_str(value).trim();
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
    if (/^[+-]?\d+$/.test(s)) return get_int(s);
    throw new TclError(`expected floating-point number but got "${to_str(value)}"`);
  }

  const TRUE_WORDS = [`1`, `true`, `yes`, `on`];
  const FALSE_WORDS = [`0`, `false`, `no`, `off`];

  function get_boolean(value) {
    if (typeof value === `boolean`) return value;
    if (typeof value === `number`) return value !== 0;
    const s = to_str(value).trim().toLowerCase();
    if (TRUE_WORDS.includes(s)) return true;
    if (FALSE_WORDS.includes(s)) return false;
    if (s) {
      for (const word of [`true`, `yes`]) if (word.startsWith(s)) return true;
      for (const word of [`false`, `no`]) if (word.startsWith(s)) return false;
      if (s === `of`) return false;
    }
    try {
      return get_double(s) !== 0;
    } catch {
      throw new TclError(`expected boolean value but got "${to_str(value)}"`);
    }
  }

  function get_pixels(value, what = `screen distance`) {
    if (typeof value === `number` && !Number.isNaN(value)) return Math.round(value);
    const s = to_str(value).trim();
    const units = { c: 96 / 2.54, m: 96 / 25.4, i: 96, p: 96 / 72 };
    const unit = s ? units[s[s.length - 1]] : undefined;
    const num = unit !== undefined ? parseFloat(s.slice(0, -1)) : parseFloat(s);
    if (Number.isNaN(num)) throw new TclError(`bad ${what} "${s}"`);
    return Math.round(unit !== undefined ? num * unit : num);
  }

  function flatten(args) {
    const result = [];
    for (const arg of args) {
      if (Array.isArray(arg)) result.push(...flatten(arg));
      else result.push(arg);
    }
    return result;
  }

  ns.TclError = TclError;
  ns.to_str = to_str;
  ns.quote_element = quote_element;
  ns.join_list = join_list;
  ns.split_list = split_list;
  ns.get_int = get_int;
  ns.get_double = get_double;
  ns.get_boolean = get_boolean;
  ns.get_pixels = get_pixels;
  ns.flatten = flatten;
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// colors.js
// ============================================================

(function (ns) {
  "use strict";
  var TclError = ns.TclError;
  var to_str = ns.to_str;

  /**
   * Tk color names -> CSS colors: Windows system colors, X11 names, CSS names.
   *
   * JS port of pythonny_tk/colors.py.
   */


  // GetSysColor() values of a default Windows 10 installation.
  const SYSTEM = {
    systembuttonface: `#f0f0f0`,
    systembuttontext: `#000000`,
    systemwindow: `#ffffff`,
    systemwindowtext: `#000000`,
    systemhighlight: `#0078d7`,
    systemhighlighttext: `#ffffff`,
    systemdisabledtext: `#6d6d6d`,
    systemgraytext: `#6d6d6d`,
    systemwindowframe: `#646464`,
    systemscrollbar: `#c8c8c8`,
    system3ddarkshadow: `#696969`,
    system3dlight: `#e3e3e3`,
    systembuttonhighlight: `#ffffff`,
    systembuttonshadow: `#a0a0a0`,
    systemactiveborder: `#b4b4b4`,
    systemactivecaption: `#99b4d1`,
    systemappworkspace: `#ababab`,
    systembackground: `#000000`,
    systemcaptiontext: `#000000`,
    systeminactiveborder: `#f4f7fc`,
    systeminactivecaption: `#bfcddb`,
    systeminactivecaptiontext: `#000000`,
    systeminfobackground: `#ffffe1`,
    systeminfotext: `#000000`,
    systemmenu: `#f0f0f0`,
    systemmenutext: `#000000`,
  };

  // X11 names whose RGB differs from CSS (Tk 8.6 uses the X11 table).
  const X11_DIFFERENT = {
    gray: `#bebebe`,
    grey: `#bebebe`,
    green: `#00ff00`,
    maroon: `#b03060`,
    purple: `#a020f0`,
  };

  // X11-only names (not in CSS).
  const X11_ONLY = {
    navyblue: `#000080`,
    lightgoldenrod: `#eedd82`,
    violetred: `#d02090`,
    lightslateblue: `#8470ff`,
    mediumforestgreen: `#6b8e23`,
    verylightgray: `#d3d3d3`,
  };

  const CSS_NAMES = new Set(
    `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
  blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson
  cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
  darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray
  darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick
  floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey
  honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon
  lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
  lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow
  lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple
  mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue
  mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen
  seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal
  thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/),
  );

  function hex_channel(digits) {
    // X11 semantics: #RGB means R<<4 (so "#fff" is #f0f0f0), longer forms keep the top 8 bits.
    if (digits.length === 1) return parseInt(digits, 16) << 4;
    return parseInt(digits.slice(0, 2), 16);
  }

  function hex2(v) {
    return v.toString(16).padStart(2, `0`);
  }

  function css_color(value) {
    const name = to_str(value);
    if (name === ``) return ``;
    if (name.startsWith(`#`)) {
      const digits = name.slice(1);
      if ([3, 6, 9, 12].includes(digits.length) && /^[0-9a-fA-F]+$/.test(digits)) {
        const n = digits.length / 3;
        const r = hex_channel(digits.slice(0, n));
        const g = hex_channel(digits.slice(n, 2 * n));
        const b = hex_channel(digits.slice(2 * n, 3 * n));
        return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
      }
      throw new TclError(`invalid color name "${name}"`);
    }
    const key = name.replace(/ /g, ``).toLowerCase();
    if (key in SYSTEM) return SYSTEM[key];
    if (key in X11_DIFFERENT) return X11_DIFFERENT[key];
    if (key in X11_ONLY) return X11_ONLY[key];
    for (const prefix of [`gray`, `grey`]) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        if (/^\d+$/.test(rest)) {
          const level = parseInt(rest, 10);
          if (level >= 0 && level <= 100) {
            const v = Math.round((level * 255) / 100);
            return `#${hex2(v)}${hex2(v)}${hex2(v)}`;
          }
        }
      }
    }
    if (CSS_NAMES.has(key)) return key;
    // X11 numbered variants such as "SteelBlue1": approximate by the base color.
    if (`1234`.includes(key[key.length - 1]) && CSS_NAMES.has(key.slice(0, -1))) {
      return key.slice(0, -1);
    }
    throw new TclError(`unknown color name "${name}"`);
  }

  ns.SYSTEM = SYSTEM;
  ns.css_color = css_color;
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// metrics.js
// ============================================================

(function (ns) {
  "use strict";
  /**
   * Browser text metrics for the font engine: width of a string and
   * font ascent/descent, measured with a canvas 2D context.
   */

  let ctx = null;

  function getContext() {
    if (ctx) return ctx;
    if (typeof OffscreenCanvas !== `undefined`) {
      ctx = new OffscreenCanvas(1, 1).getContext(`2d`);
    } else if (typeof document !== `undefined`) {
      const canvas = document.createElement(`canvas`);
      canvas.width = 1;
      canvas.height = 1;
      ctx = canvas.getContext(`2d`);
    }
    return ctx; // stays null in non-browser environments (approximate metrics)
  }

  function measure_text(css, text) {
    const c = getContext();
    if (!c) return text.length * 7;
    c.font = css;
    return c.measureText(text).width;
  }

  function font_metrics(css) {
    const c = getContext();
    let ascent = 0;
    let descent = 0;
    if (c) {
      c.font = css;
      const m = c.measureText(`Mg`);
      ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? 0;
      descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? 0;
      if (!ascent && !descent) {
        const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(css);
        const size = sizeMatch ? parseFloat(sizeMatch[1]) : 12;
        ascent = size * 0.8;
        descent = size * 0.2;
      }
    }
    return [ascent, descent];
  }

  ns.measure_text = measure_text;
  ns.font_metrics = font_metrics;
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// events.js
// ============================================================

(function (ns) {
  "use strict";
  var TclError = ns.TclError;

  /**
   * Tk events: binding sequences, matching, %-substitution and class bindings.
   *
   * Class bindings reproduce Tk's library/button.tcl for Windows (they change
   * the widget's -relief and -state exactly like the Tcl procedures do).
   *
   * JS port of pythonny_tk/events.py.
   */


  // Event type name -> [Tk type number, canonical name]
  const TYPES = {
    KeyPress: 2, Key: 2, KeyRelease: 3,
    ButtonPress: 4, Button: 4, ButtonRelease: 5,
    Motion: 6, Enter: 7, Leave: 8, FocusIn: 9, FocusOut: 10,
    Expose: 12, Visibility: 15, Destroy: 17, Unmap: 18, Map: 19,
    Reparent: 21, Configure: 22, Gravity: 24, Circulate: 26,
    Property: 28, Colormap: 32, Activate: 36, Deactivate: 37,
    MouseWheel: 38,
  };

  const CANONICAL = {
    2: `KeyPress`, 3: `KeyRelease`, 4: `ButtonPress`, 5: `ButtonRelease`, 6: `Motion`,
    7: `Enter`, 8: `Leave`, 9: `FocusIn`, 10: `FocusOut`, 17: `Destroy`, 22: `Configure`,
    36: `Activate`, 37: `Deactivate`, 38: `MouseWheel`, 19: `Map`, 18: `Unmap`, 12: `Expose`,
  };

  const SHIFT = 0x1;
  const LOCK = 0x2;
  const CONTROL = 0x4;
  const MOD1 = 0x8;
  const ALT = 0x20000;
  const BUTTON_MASKS = { 1: 0x100, 2: 0x200, 3: 0x400, 4: 0x800, 5: 0x1000 };

  const MODIFIERS = {
    Control: CONTROL, Shift: SHIFT, Lock: LOCK, Alt: ALT, Meta: ALT, M: ALT,
    Mod1: MOD1, M1: MOD1, Command: CONTROL, Option: ALT,
    Button1: 0x100, B1: 0x100, Button2: 0x200, B2: 0x200, Button3: 0x400, B3: 0x400,
    Button4: 0x800, B4: 0x800, Button5: 0x1000, B5: 0x1000,
  };
  const COUNTS = { Double: 2, Triple: 3, Quadruple: 4 };

  // X11 keysym numbers for %N (keysym_num).
  const KEYSYM_NUMS = {
    BackSpace: 0xff08, Tab: 0xff09, Return: 0xff0d, Pause: 0xff13, Escape: 0xff1b,
    Delete: 0xffff, Home: 0xff50, Left: 0xff51, Up: 0xff52, Right: 0xff53, Down: 0xff54,
    Prior: 0xff55, Next: 0xff56, End: 0xff57, Insert: 0xff63, Num_Lock: 0xff7f,
    Shift_L: 0xffe1, Shift_R: 0xffe2, Control_L: 0xffe3, Control_R: 0xffe4,
    Caps_Lock: 0xffe5, Alt_L: 0xffe9, Alt_R: 0xffea, Win_L: 0xff5b, Win_R: 0xff5c,
    App: 0xff67, space: 0x20, Scroll_Lock: 0xff14, Print: 0xff61,
  };
  for (let i = 1; i <= 12; i++) KEYSYM_NUMS[`F${i}`] = 0xffbe + i - 1;

  // Keysym names of printable ASCII characters other than letters and digits.
  const CHAR_KEYSYMS = {
    [` `]: `space`,
    [`!`]: `exclam`,
    [`"`]: `quotedbl`,
    [`#`]: `numbersign`,
    [`$`]: `dollar`,
    [`%`]: `percent`,
    [`&`]: `ampersand`,
    [`'`]: `apostrophe`,
    [`(`]: `parenleft`,
    [`)`]: `parenright`,
    [`*`]: `asterisk`,
    [`+`]: `plus`,
    [`,`]: `comma`,
    [`-`]: `minus`,
    [`.`]: `period`,
    [`/`]: `slash`,
    [`:`]: `colon`,
    [`;`]: `semicolon`,
    [`<`]: `less`,
    [`=`]: `equal`,
    [`>`]: `greater`,
    [`?`]: `question`,
    [`@`]: `at`,
    [`[`]: `bracketleft`,
    [`\\`]: `backslash`,
    [`]`]: `bracketright`,
    [`^`]: `asciicircum`,
    [`_`]: `underscore`,
    ["`"]: `grave`,
    [`{`]: `braceleft`,
    [`|`]: `bar`,
    [`}`]: `braceright`,
    [`~`]: `asciitilde`,
  };
  const KEYSYM_TO_CHAR = {};
  for (const [k, v] of Object.entries(CHAR_KEYSYMS)) KEYSYM_TO_CHAR[v] = k;

  function keysym_num(keysym) {
    if (keysym in KEYSYM_NUMS) return KEYSYM_NUMS[keysym];
    if (keysym.length === 1) return keysym.codePointAt(0);
    if (keysym in KEYSYM_TO_CHAR) return KEYSYM_TO_CHAR[keysym].codePointAt(0);
    return 0;
  }

  class Pattern {
    constructor(type_, detail, mods, count) {
      this.type = type_;
      this.detail = detail;
      this.mods = mods;
      this.count = count;
    }

    specificity() {
      let bits = 0;
      for (let m = this.mods; m; m >>= 1) bits += m & 1;
      return [this.detail !== null, bits, this.count];
    }
  }

  function spec_greater(a, b) {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  }

  function parse_sequence(sequence) {
    const patterns = [];
    const s = sequence;
    let i = 0;
    while (i < s.length) {
      if (s.startsWith(`<<`, i)) {
        const j = s.indexOf(`>>`, i);
        if (j === -1) throw new TclError(`missing ">" in binding`);
        patterns.push(new Pattern(`virtual`, s.slice(i + 2, j), 0, 1));
        i = j + 2;
        continue;
      }
      if (s[i] === `<`) {
        const j = s.indexOf(`>`, i);
        if (j === -1) throw new TclError(`missing ">" in binding`);
        const body = s.slice(i + 1, j);
        i = j + 1;
        if (body.startsWith(`<`) && body.endsWith(`>`)) {
          patterns.push(new Pattern(`virtual`, body, 0, 1));
          continue;
        }
        patterns.push(_parse_pattern(body));
      } else {
        const ch = s[i];
        i += 1;
        if (ch === ` `) patterns.push(new Pattern(2, `space`, 0, 1));
        else patterns.push(new Pattern(2, CHAR_KEYSYMS[ch] ?? ch, 0, 1));
      }
    }
    if (!patterns.length) throw new TclError(`no events specified in binding`);
    return patterns;
  }

  function _parse_pattern(body) {
    if (body.startsWith(`<`)) return new Pattern(`virtual`, body, 0, 1);
    const parts = body.split(`-`);
    let mods = 0;
    let count = 1;
    let type_ = null;
    let detail = null;
    while (parts.length && (parts[0] in MODIFIERS || parts[0] in COUNTS || parts[0] === `Any`)) {
      const part = parts.shift();
      if (part in MODIFIERS) mods |= MODIFIERS[part];
      else if (part in COUNTS) count = COUNTS[part];
    }
    if (parts.length && parts[0] in TYPES) type_ = TYPES[parts.shift()];
    if (parts.length) {
      detail = parts.join(`-`);
      if (type_ === null) {
        if (detail.length === 1 && `12345`.includes(detail) && /^\d$/.test(detail)) type_ = 4;
        else type_ = 2;
      }
      if (type_ === 4 || type_ === 5) {
        if (!/^\d+$/.test(detail)) throw new TclError(`bad event type or keysym "${detail}"`);
      }
    }
    if (type_ === null) throw new TclError(`bad event type or keysym "${body}"`);
    if ((type_ === 2 || type_ === 3) && detail !== null) detail = CHAR_KEYSYMS[detail] ?? detail;
    return new Pattern(type_, detail, mods, count);
  }

  function matches(pattern, event) {
    if (pattern.type !== event.type) return false;
    if (pattern.detail !== null) {
      if (pattern.type === 4 || pattern.type === 5) {
        if (parseInt(pattern.detail, 10) !== event.num) return false;
      } else if (pattern.type === 2 || pattern.type === 3) {
        if (pattern.detail !== event.keysym) return false;
      }
    }
    const state = event.state ?? 0;
    if (pattern.mods & ~state) return false;
    if (pattern.count > 1 && (event.count ?? 1) < pattern.count) return false;
    return true;
  }

  function best_binding(bindings, event) {
    let best = null;
    let best_key = null;
    const entries = bindings instanceof Map ? Array.from(bindings.values()) : Object.values(bindings);
    for (const entry of entries) {
      const pattern = entry.patterns[entry.patterns.length - 1];
      if (matches(pattern, event)) {
        const key = pattern.specificity();
        if (best === null || spec_greater(key, best_key)) {
          best = entry;
          best_key = key;
        }
      }
    }
    return best;
  }

  function substitute(app, event, widget_path) {
    const etype = event.type;
    const num = event.num;
    const keysym = event.keysym ?? `??`;
    return [
      String(app.next_serial()),
      num !== undefined && num !== null ? String(num) : `??`,
      event.focus === false ? `0` : `1`,
      String(event.height ?? `??`),
      String(event.keycode ?? `??`),
      String(event.state ?? 0),
      String(event.time ?? Date.now() & 0x7fffffff),
      String(event.width ?? `??`),
      String(event.x ?? `??`),
      String(event.y ?? `??`),
      event.char ?? (etype === 2 || etype === 3 ? `` : `??`),
      `0`,
      etype === 2 || etype === 3 ? keysym : `??`,
      etype === 2 || etype === 3 ? String(keysym_num(keysym)) : `??`,
      widget_path,
      String(etype),
      String(event.rootx ?? `??`),
      String(event.rooty ?? `??`),
      String(event.delta ?? 0),
    ];
  }

  // ---- class bindings (library/button.tcl, Windows) ------------------------------------

  class ClassBindings {
    constructor(app) {
      this.app = app;
      this.button_window = null;
      this.window = null;
      this.saved_relief = {};
      this.pressed_relief = {};
    }

    handle(widget, event) {
      const handler = widget.class_event;
      if (handler !== undefined && handler !== null) return handler.call(widget, event);
      const cls = widget.tk_class;
      const etype = event.type;
      if (cls === `Button` || cls === `TButton`) {
        if (etype === 7) return this.button_enter(widget);
        else if (etype === 8) return this.button_leave(widget);
        else if (etype === 4 && event.num === 1) return this.button_down(widget, true);
        else if (etype === 5 && event.num === 1) return this.button_up(widget);
        else if (etype === 2 && event.keysym === `space`) return this.invoke(widget);
      } else if (cls === `Checkbutton` || cls === `Radiobutton` || cls === `TCheckbutton` || cls === `TRadiobutton`) {
        if (etype === 7) return this.check_radio_enter(widget);
        else if (etype === 8) return this.button_leave(widget);
        else if (etype === 4 && event.num === 1) return this.button_down(widget, false);
        else if (etype === 5 && event.num === 1) return this.button_up(widget);
        else if (etype === 2 && event.keysym === `space`) return this.invoke(widget);
        else if (cls === `Checkbutton` && etype === 2 && [`equal`, `plus`].includes(event.keysym)) {
          if (widget.options.state !== `disabled`) return widget.cmd_select([]);
        } else if (cls === `Checkbutton` && etype === 2 && event.keysym === `minus`) {
          if (widget.options.state !== `disabled`) return widget.cmd_deselect([]);
        }
      } else if ([`Entry`, `Spinbox`, `Text`, `TEntry`, `TSpinbox`].includes(cls) && etype === 4 && event.num === 1) {
        if (widget.options.state !== `disabled`) this.app.set_focus(widget, true);
      } else if (cls === `Listbox`) {
        return this.listbox(widget, event);
      } else if ((cls === `Menubutton` || cls === `TMenubutton`) && etype === 4 && event.num === 1) {
        widget.post_menu();
      }
      return null;
    }

    // ---- listbox (library/listbox.tcl) ---------------------------------------------------

    listbox(w, event) {
      const etype = event.type;
      if (w.options.state === `disabled` || !w.items.length) return;
      const mode = w.options.selectmode;
      if (etype === 4 && event.num === 1) {
        this.app.set_focus(w);
        const index = w.nearest(Math.floor(event.y ?? 0));
        const state = event.state ?? 0;
        if (mode === `extended` && state & SHIFT) {
          this._listbox_range(w, w.anchor, index);
        } else if (mode === `extended` && state & CONTROL) {
          if (w.selected.has(index)) w.selected.delete(index);
          else w.selected.add(index);
          w.anchor = index;
        } else if (mode === `multiple`) {
          if (w.selected.has(index)) w.selected.delete(index);
          else w.selected.add(index);
        } else {
          w.selected = new Set([index]);
          w.anchor = index;
        }
        w.active = index;
        this.app.schedule_render();
        this.app.dispatch_virtual(w, `ListboxSelect`);
      } else if (etype === 6 && (event.state ?? 0) & 0x100) {
        const index = w.nearest(Math.floor(event.y ?? 0));
        if (index === w.active) return;
        if (mode === `browse`) w.selected = new Set([index]);
        else if (mode === `extended`) this._listbox_range(w, w.anchor, index);
        else return;
        w.active = index;
        w.cmd_see([index]);
        this.app.dispatch_virtual(w, `ListboxSelect`);
      } else if (etype === 2 && [`Up`, `Down`, `Prior`, `Next`, `Home`, `End`].includes(event.keysym)) {
        const keysym = event.keysym;
        const page = w.visible_lines();
        const moves = { Up: -1, Down: 1, Prior: -page, Next: page };
        let index;
        if (keysym in moves) index = w.active + moves[keysym];
        else index = keysym === `Home` ? 0 : w.items.length - 1;
        index = Math.max(0, Math.min(index, w.items.length - 1));
        w.active = index;
        w.cmd_see([index]);
        if (mode === `browse` || mode === `extended`) {
          w.selected = new Set([index]);
          w.anchor = index;
          this.app.dispatch_virtual(w, `ListboxSelect`);
        }
        this.app.schedule_render();
      } else if (etype === 2 && event.keysym === `space` && (mode === `single` || mode === `multiple`)) {
        if (mode === `single`) w.selected = new Set([w.active]);
        else if (w.selected.has(w.active)) w.selected.delete(w.active);
        else w.selected.add(w.active);
        this.app.dispatch_virtual(w, `ListboxSelect`);
        this.app.schedule_render();
      } else if (etype === 38) {
        w.cmd_yview([`scroll`, -Math.floor((event.delta ?? 0) / 120) * 4, `units`]);
      }
    }

    _listbox_range(w, first, last) {
      const a = Math.min(first, last);
      const b = Math.max(first, last);
      w.selected = new Set();
      for (let i = a; i <= b; i++) w.selected.add(i);
      this.app.schedule_render();
    }

    _set(widget, options) {
      for (const [key, value] of Object.entries(options)) widget.options[key] = value;
      this.app.schedule_render();
    }

    button_enter(w) {
      if (w.options.state !== `disabled`) {
        this.saved_relief[w.path] = w.options.relief;
        if (this.button_window === w) {
          this._set(w, { relief: `sunken`, state: `active` });
          this.pressed_relief[w.path] = `sunken`;
        } else if (w.options.overrelief) {
          this._set(w, { relief: w.options.overrelief });
          this.pressed_relief[w.path] = w.options.overrelief;
        }
      }
      this.window = w;
    }

    check_radio_enter(w) {
      if (w.options.state !== `disabled`) {
        if (this.button_window === w) this._set(w, { state: `active` });
        if (w.options.overrelief) {
          this.saved_relief[w.path] = w.options.relief;
          this.pressed_relief[w.path] = w.options.overrelief;
          this._set(w, { relief: w.options.overrelief });
        }
      }
      this.window = w;
    }

    button_leave(w) {
      if (w.options.state !== `disabled`) this._set(w, { state: `normal` });
      if (w.path in this.saved_relief) {
        if (this.pressed_relief[w.path] === w.options.relief) {
          this._set(w, { relief: this.saved_relief[w.path] });
        }
        delete this.saved_relief[w.path];
        delete this.pressed_relief[w.path];
      }
      this.window = null;
    }

    button_down(w, relief) {
      if (!(w.path in this.saved_relief)) this.saved_relief[w.path] = w.options.relief;
      if (w.options.state !== `disabled`) {
        this.button_window = w;
        if (relief) {
          this._set(w, { relief: `sunken`, state: `active` });
          this.pressed_relief[w.path] = `sunken`;
        } else {
          this._set(w, { state: `active` });
        }
      }
      this.window = w;
    }

    button_up(w) {
      if (this.button_window !== w) return;
      this.button_window = null;
      if (w.path in this.saved_relief) {
        if (this.pressed_relief[w.path] === w.options.relief) {
          this._set(w, { relief: this.saved_relief[w.path] });
        }
        delete this.saved_relief[w.path];
        delete this.pressed_relief[w.path];
      }
      if (this.window === w && w.options.state !== `disabled`) {
        this._set(w, { state: `normal` });
        return this.app.call(w.path, `invoke`);
      }
    }

    invoke(w) {
      if (w.options.state !== `disabled`) return this.app.call(w.path, `invoke`);
    }

    forget(w) {
      if (this.button_window === w) this.button_window = null;
      if (this.window === w) this.window = null;
      delete this.saved_relief[w.path];
      delete this.pressed_relief[w.path];
    }
  }

  ns.CANONICAL = CANONICAL;
  ns.SHIFT = SHIFT;
  ns.LOCK = LOCK;
  ns.CONTROL = CONTROL;
  ns.MOD1 = MOD1;
  ns.ALT = ALT;
  ns.BUTTON_MASKS = BUTTON_MASKS;
  ns.KEYSYM_NUMS = KEYSYM_NUMS;
  ns.CHAR_KEYSYMS = CHAR_KEYSYMS;
  ns.keysym_num = keysym_num;
  ns.Pattern = Pattern;
  ns.parse_sequence = parse_sequence;
  ns.matches = matches;
  ns.best_binding = best_binding;
  ns.substitute = substitute;
  ns.ClassBindings = ClassBindings;
  ns.events = { CANONICAL, SHIFT, LOCK, CONTROL, MOD1, ALT, BUTTON_MASKS, KEYSYM_NUMS, CHAR_KEYSYMS, keysym_num, Pattern, parse_sequence, matches, best_binding, substitute, ClassBindings };
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// geometry.js
// ============================================================

(function (ns) {
  "use strict";
  var TclError = ns.TclError;
  var get_boolean = ns.get_boolean;
  var get_double = ns.get_double;
  var get_int = ns.get_int;
  var get_pixels = ns.get_pixels;
  var split_list = ns.split_list;
  var to_str = ns.to_str;

  /**
   * Geometry managers pack, grid and place.
   *
   * pack follows generic/tkPack.c (ArrangePacking, XExpansion, YExpansion)
   * closely; grid and place implement the documented Tk behaviour.
   *
   * JS port of pythonny_tk/geometry.py.
   */


  function cdiv(a, b) {
    const q = Math.floor(Math.abs(a) / Math.abs(b));
    return a >= 0 === b > 0 ? q : -q;
  }

  function pad_pair(value, what) {
    const parts = split_list(value);
    if (parts.length === 1) {
      const p = get_pixels(parts[0]);
      return [p, p];
    }
    if (parts.length === 2) {
      const first = get_pixels(parts[0]);
      const second = get_pixels(parts[1]);
      if (first < 0 || second < 0)
        throw new TclError(`bad pad value "${to_str(value)}": must be positive screen distance`);
      return [first, second];
    }
    throw new TclError(`bad pad value "${to_str(value)}": must be positive screen distance`);
  }

  const ANCHORS = [`n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`, `center`];

  function anchor(value) {
    const v = to_str(value);
    if (!ANCHORS.includes(v))
      throw new TclError(`bad anchor "${v}": must be n, ne, e, se, s, sw, w, nw, or center`);
    return v;
  }

  // ---- pack --------------------------------------------------------------------------

  function pack_defaults() {
    return {
      side: `top`, anchor: `center`, fill: `none`, expand: 0,
      padx: [0, 0], pady: [0, 0], ipadx: 0, ipady: 0,
    };
  }

  function pack_configure(app, widgets, args) {
    const opts = {};
    if (args.length % 2) throw new TclError(`extra option "${args[args.length - 1]}" (option with no value?)`);
    for (let i = 0; i < args.length; i += 2) opts[to_str(args[i])] = args[i + 1];
    for (const widget of widgets) {
      const container = `-in` in opts ? app.widget(to_str(opts[`-in`])) : widget.parent;
      const info = widget.manager === `pack` && widget.pack ? widget.pack : pack_defaults();
      for (const [name, value] of Object.entries(opts)) {
        if (name === `-side`) {
          const v = to_str(value);
          if (![`top`, `bottom`, `left`, `right`].includes(v))
            throw new TclError(`bad side "${v}": must be top, bottom, left, or right`);
          info.side = v;
        } else if (name === `-anchor`) {
          info.anchor = anchor(value);
        } else if (name === `-fill`) {
          const v = to_str(value);
          if (![`none`, `x`, `y`, `both`].includes(v))
            throw new TclError(`bad fill style "${v}": must be none, x, y, or both`);
          info.fill = v;
        } else if (name === `-expand`) {
          info.expand = get_boolean(value) ? 1 : 0;
        } else if (name === `-padx`) {
          info.padx = pad_pair(value, `padx`);
        } else if (name === `-pady`) {
          info.pady = pad_pair(value, `pady`);
        } else if (name === `-ipadx`) {
          info.ipadx = get_pixels(value);
        } else if (name === `-ipady`) {
          info.ipady = get_pixels(value);
        } else if ([`-in`, `-before`, `-after`].includes(name)) {
          // no-op
        } else {
          throw new TclError(
            `bad option "${name}": must be -after, -anchor, -before, -expand, -fill, -in, -ipadx, -ipady, -padx, -pady, or -side`,
          );
        }
      }
      app.unmanage(widget, `pack`);
      widget.manager = `pack`;
      widget.pack = info;
      info.in = container;
      const slaves = container.pack_slaves;
      const existing = slaves.indexOf(widget);
      if (existing !== -1) slaves.splice(existing, 1);
      if (`-before` in opts) {
        const ref = app.widget(to_str(opts[`-before`]));
        const at = slaves.indexOf(ref);
        slaves.splice(at !== -1 ? at : slaves.length, 0, widget);
      } else if (`-after` in opts) {
        const ref = app.widget(to_str(opts[`-after`]));
        const at = slaves.indexOf(ref);
        slaves.splice(at !== -1 ? at + 1 : slaves.length, 0, widget);
      } else {
        slaves.push(widget);
      }
    }
    app.schedule_layout();
  }

  function pack_info(widget) {
    const info = widget.pack;
    if (widget.manager !== `pack` || !info) throw new TclError(`window "${widget.path}" isn't packed`);
    const pad = (p) => (p[0] === p[1] ? p[0] : p);
    return [
      `-in`, info.in.path, `-anchor`, info.anchor, `-expand`, info.expand,
      `-fill`, info.fill, `-ipadx`, info.ipadx, `-ipady`, info.ipady,
      `-padx`, pad(info.padx), `-pady`, pad(info.pady), `-side`, info.side,
    ];
  }

  function _pack_req(slave) {
    const info = slave.pack;
    const pad_x = info.padx[0] + info.padx[1];
    const pad_y = info.pady[0] + info.pady[1];
    return [slave.req_w, slave.req_h, pad_x, pad_y, 2 * info.ipadx, 2 * info.ipady];
  }

  function pack_request(container) {
    const [left, top, right, bottom] = container.borders();
    let width = left + right;
    let max_width = width;
    let height = top + bottom;
    let max_height = height;
    for (const slave of container.pack_slaves) {
      const [w, h, px, py, ipx, ipy] = _pack_req(slave);
      if (slave.pack.side === `top` || slave.pack.side === `bottom`) {
        max_width = Math.max(max_width, w + px + ipx + width);
        height += h + py + ipy;
      } else {
        max_height = Math.max(max_height, h + py + ipy + height);
        width += w + px + ipx;
      }
    }
    return [Math.max(max_width, width), Math.max(max_height, height)];
  }

  function _x_expansion(slaves, cavity_width) {
    /* Tk's XExpansion (generic/tkPack.c): the extra width an expandable slave
       gets. The slaves packed after it take their share of the cavity first,
       so a status bar packed after an expanding frame still gets the size it
       asked for. */
    let min_expand = cavity_width;
    let num_expand = 0;
    for (const slave of slaves) {
      const [w, , px, , ipx] = _pack_req(slave);
      const child_width = w + px + ipx;
      if (slave.pack.side === `top` || slave.pack.side === `bottom`) {
        if (num_expand) {
          const cur = cdiv(cavity_width - child_width, num_expand);
          if (cur < min_expand) min_expand = cur;
        }
      } else {
        cavity_width -= child_width;
        if (slave.pack.expand) num_expand += 1;
      }
    }
    if (num_expand) {
      const cur = cdiv(cavity_width, num_expand);
      if (cur < min_expand) min_expand = cur;
    }
    return Math.max(min_expand, 0);
  }

  function _y_expansion(slaves, cavity_height) {
    /* Tk's YExpansion (generic/tkPack.c). */
    let min_expand = cavity_height;
    let num_expand = 0;
    for (const slave of slaves) {
      const [, h, , py, , ipy] = _pack_req(slave);
      const child_height = h + py + ipy;
      if (slave.pack.side === `left` || slave.pack.side === `right`) {
        if (num_expand) {
          const cur = cdiv(cavity_height - child_height, num_expand);
          if (cur < min_expand) min_expand = cur;
        }
      } else {
        cavity_height -= child_height;
        if (slave.pack.expand) num_expand += 1;
      }
    }
    if (num_expand) {
      const cur = cdiv(cavity_height, num_expand);
      if (cur < min_expand) min_expand = cur;
    }
    return Math.max(min_expand, 0);
  }

  function _place_in_frame(fx, frame_x, frame_y, frame_w, frame_h, width, height,
                           border_left, border_right, border_top, border_btm) {
    let x;
    if ([`n`, `s`, `center`].includes(fx)) {
      x = frame_x + Math.trunc((border_left + frame_w - width - border_right) / 2);
    } else if ([`ne`, `e`, `se`].includes(fx)) {
      x = frame_x + frame_w - width - border_right;
    } else {
      x = frame_x + border_left;
    }
    let y;
    if ([`n`, `ne`, `nw`].includes(fx)) {
      y = frame_y + border_top;
    } else if ([`s`, `se`, `sw`].includes(fx)) {
      y = frame_y + frame_h - height - border_btm;
    } else {
      y = frame_y + Math.trunc((border_top + frame_h - height - border_btm) / 2);
    }
    return [x, y];
  }

  function pack_arrange(container) {
    const [left, top, right, bottom] = container.borders();
    let cavity_x = left;
    let cavity_y = top;
    let cavity_w = container.width - left - right;
    let cavity_h = container.height - top - bottom;
    const slaves = container.pack_slaves;
    for (let i = 0; i < slaves.length; i++) {
      const slave = slaves[i];
      const info = slave.pack;
      const [w, h, px, py, ipx, ipy] = _pack_req(slave);
      let frame_x;
      let frame_y;
      let frame_w;
      let frame_h;
      if (info.side === `top` || info.side === `bottom`) {
        frame_w = cavity_w;
        frame_h = h + py + ipy;
        if (info.expand) frame_h += _y_expansion(slaves.slice(i), cavity_h);
        cavity_h -= frame_h;
        if (cavity_h < 0) {
          frame_h += cavity_h;
          cavity_h = 0;
        }
        frame_x = cavity_x;
        if (info.side === `top`) {
          frame_y = cavity_y;
          cavity_y += frame_h;
        } else {
          frame_y = cavity_y + cavity_h;
        }
      } else {
        frame_h = cavity_h;
        frame_w = w + px + ipx;
        if (info.expand) frame_w += _x_expansion(slaves.slice(i), cavity_w);
        cavity_w -= frame_w;
        if (cavity_w < 0) {
          frame_w += cavity_w;
          cavity_w = 0;
        }
        frame_y = cavity_y;
        if (info.side === `left`) {
          frame_x = cavity_x;
          cavity_x += frame_w;
        } else {
          frame_x = cavity_x + cavity_w;
        }
      }
      const [border_left, border_right] = info.padx;
      const [border_top, border_btm] = info.pady;
      let width = w + ipx;
      if (info.fill === `x` || info.fill === `both` || width > frame_w - px) width = frame_w - px;
      let height = h + ipy;
      if (info.fill === `y` || info.fill === `both` || height > frame_h - py) height = frame_h - py;
      const [x, y] = _place_in_frame(info.anchor, frame_x, frame_y, frame_w, frame_h, width, height,
                                     border_left, border_right, border_top, border_btm);
      set_slave_geometry(container, slave, x, y, width, height);
    }
  }

  function set_slave_geometry(container, slave, x, y, width, height) {
    if (width <= 0 || height <= 0) {
      slave.mapped = false;
      slave.width = Math.max(width, 1);
      slave.height = Math.max(height, 1);
      return;
    }
    // Slaves managed in a container other than their parent are positioned relative
    // to the parent, like Tk_MaintainGeometry.
    let offset_x = 0;
    let offset_y = 0;
    let w = container;
    while (w !== slave.parent && w !== null && w !== undefined && !w.is_toplevel) {
      offset_x += w.x;
      offset_y += w.y;
      w = w.parent;
    }
    slave.x = x + offset_x;
    slave.y = y + offset_y;
    slave.width = width;
    slave.height = height;
    slave.mapped = true;
  }

  // ---- grid --------------------------------------------------------------------------

  function grid_defaults() {
    return {
      row: null, column: null, rowspan: 1, columnspan: 1,
      sticky: ``, padx: [0, 0], pady: [0, 0], ipadx: 0, ipady: 0,
    };
  }

  function sticky(value) {
    const s = to_str(value).toLowerCase().replace(/,/g, ``).replace(/ /g, ``);
    for (const c of s) {
      if (!`nsew`.includes(c))
        throw new TclError(
          `bad stickyness value "${to_str(value)}": must be a string containing n, e, s, and/or w`,
        );
    }
    return [...`nesw`].filter((c) => s.includes(c)).join(``);
  }

  function grid_configure(app, widgets, args) {
    const opts = {};
    if (args.length % 2) throw new TclError(`extra option "${args[args.length - 1]}" (option with no value?)`);
    for (let i = 0; i < args.length; i += 2) opts[to_str(args[i])] = args[i + 1];
    for (let index = 0; index < widgets.length; index++) {
      const widget = widgets[index];
      const container = `-in` in opts ? app.widget(to_str(opts[`-in`])) : widget.parent;
      const info = widget.manager === `grid` && widget.grid ? widget.grid : grid_defaults();
      for (const [name, value] of Object.entries(opts)) {
        if (name === `-row`) {
          info.row = get_int(value);
          if (info.row < 0)
            throw new TclError(`bad row value "${to_str(value)}": must be a non-negative integer`);
        } else if (name === `-column`) {
          info.column = get_int(value);
          if (info.column < 0)
            throw new TclError(`bad column value "${to_str(value)}": must be a non-negative integer`);
        } else if (name === `-rowspan`) {
          info.rowspan = Math.max(1, get_int(value));
        } else if (name === `-columnspan`) {
          info.columnspan = Math.max(1, get_int(value));
        } else if (name === `-sticky`) {
          info.sticky = sticky(value);
        } else if (name === `-padx`) {
          info.padx = pad_pair(value, `padx`);
        } else if (name === `-pady`) {
          info.pady = pad_pair(value, `pady`);
        } else if (name === `-ipadx`) {
          info.ipadx = get_pixels(value);
        } else if (name === `-ipady`) {
          info.ipady = get_pixels(value);
        } else if (name === `-in`) {
          // no-op
        } else {
          throw new TclError(
            `bad option "${name}": must be -column, -columnspan, -in, -ipadx, -ipady, -padx, -pady, -row, -rowspan, or -sticky`,
          );
        }
      }
      if (info.row === null) {
        // Like Tk: a new widget goes into the next free row.
        const used = container.grid_slaves
          .filter((s) => s !== widget)
          .map((s) => s.grid.row + s.grid.rowspan);
        info.row = used.length ? Math.max(...used) : 0;
      }
      if (info.column === null) info.column = index;
      app.unmanage(widget, `grid`);
      widget.manager = `grid`;
      widget.grid = info;
      info.in = container;
      if (!container.grid_slaves.includes(widget)) container.grid_slaves.push(widget);
    }
    app.schedule_layout();
  }

  function grid_info(widget) {
    const info = widget.grid;
    if (widget.manager !== `grid` || !info) return [];
    const pad = (p) => (p[0] === p[1] ? p[0] : p);
    return [
      `-in`, info.in.path, `-column`, info.column, `-row`, info.row,
      `-columnspan`, info.columnspan, `-rowspan`, info.rowspan,
      `-ipadx`, info.ipadx, `-ipady`, info.ipady,
      `-padx`, pad(info.padx), `-pady`, pad(info.pady), `-sticky`, info.sticky,
    ];
  }

  function slot_defaults() {
    return { minsize: 0, weight: 0, uniform: ``, pad: 0 };
  }

  function grid_slot_configure(app, container, axis, index_spec, args) {
    const table = axis === `column` ? container.grid_columns : container.grid_rows;
    const indices = [];
    for (const item of split_list(index_spec)) {
      if (item === `all`) {
        const key = axis;
        indices.push(...[...new Set(container.grid_slaves.map((s) => s.grid[key]))].sort((a, b) => a - b));
      } else {
        indices.push(get_int(item));
      }
    }
    if (!args.length) {
      const slot = indices.length ? table[indices[0]] ?? slot_defaults() : slot_defaults();
      return [`-minsize`, slot.minsize, `-pad`, slot.pad, `-uniform`, slot.uniform, `-weight`, slot.weight];
    }
    if (args.length === 1) {
      const slot = table[indices[0]] ?? slot_defaults();
      return slot[to_str(args[0]).slice(1)];
    }
    for (const index of indices) {
      const slot = table[index] ?? (table[index] = slot_defaults());
      for (let i = 0; i < args.length; i += 2) {
        const name = to_str(args[i]);
        const value = args[i + 1];
        if (name === `-weight`) slot.weight = get_int(value);
        else if (name === `-minsize`) slot.minsize = get_pixels(value);
        else if (name === `-pad`) slot.pad = get_pixels(value);
        else if (name === `-uniform`) slot.uniform = to_str(value);
        else throw new TclError(`bad option "${name}": must be -minsize, -pad, -uniform, or -weight`);
      }
    }
    app.schedule_layout();
    return ``;
  }

  function _grid_sizes(container) {
    const slaves = container.grid_slaves.filter((s) => s.grid);
    if (!slaves.length && !Object.keys(container.grid_columns).length && !Object.keys(container.grid_rows).length) {
      return [[], []];
    }

    const solve = (axis) => {
      const pos_key = axis === `x` ? `column` : `row`;
      const span_key = axis === `x` ? `columnspan` : `rowspan`;
      const table = axis === `x` ? container.grid_columns : container.grid_rows;
      let count = slaves.reduce((m, s) => Math.max(m, s.grid[pos_key] + s.grid[span_key]), 0);
      count = Math.max(count, Object.keys(table).length ? Math.max(...Object.keys(table).map(Number)) + 1 : -1) + 0;
      if (count <= 0) return [];
      const sizes = new Array(count).fill(0);
      for (let i = 0; i < count; i++) {
        const slot = table[i];
        if (slot) sizes[i] = slot.minsize;
      }
      // Single-span slaves first, then spanning slaves distribute the excess.
      const sorted = slaves.slice().sort((a, b) => a.grid[span_key] - b.grid[span_key]);
      for (const s of sorted) {
        const g = s.grid;
        const need = axis === `x`
          ? s.req_w + 2 * g.ipadx + g.padx[0] + g.padx[1]
          : s.req_h + 2 * g.ipady + g.pady[0] + g.pady[1];
        const start = g[pos_key];
        const span = g[span_key];
        const cells = [];
        let have = 0;
        for (let i = start; i < start + span; i++) {
          cells.push(i);
          have += sizes[i] ?? 0;
          have += (table[i] ?? slot_defaults()).pad;
        }
        if (need > have) {
          const extra = need - have;
          const weighted = cells.filter((i) => (table[i] ?? slot_defaults()).weight > 0);
          const use = weighted.length ? weighted : cells;
          const share = Math.trunc(extra / use.length);
          let rest = extra % use.length;
          for (let j = 0; j < use.length; j++) {
            sizes[use[j]] += share + (j < rest ? 1 : 0);
          }
        }
      }
      // Uniform groups share the largest size scaled by weight.
      const groups = {};
      for (let i = 0; i < count; i++) {
        const slot = table[i];
        if (slot && slot.uniform) {
          if (!groups[slot.uniform]) groups[slot.uniform] = [];
          groups[slot.uniform].push(i);
        }
      }
      for (const members of Object.values(groups)) {
        const unit = Math.max(...members.map((i) => sizes[i] / Math.max(table[i].weight, 1)));
        for (const i of members) sizes[i] = Math.round(unit * Math.max(table[i].weight, 1));
      }
      const pads = [];
      for (let i = 0; i < count; i++) pads.push((table[i] ?? slot_defaults()).pad);
      return sizes.map((size, i) => size + pads[i]);
    };

    return [solve(`x`), solve(`y`)];
  }

  function grid_request(container) {
    const [cols, rows] = _grid_sizes(container);
    const [left, top, right, bottom] = container.borders();
    return [cols.reduce((a, b) => a + b, 0) + left + right, rows.reduce((a, b) => a + b, 0) + top + bottom];
  }

  function _distribute(sizes, weights, available) {
    const total = sizes.reduce((a, b) => a + b, 0);
    const extra = available - total;
    const weight_sum = weights.reduce((a, b) => a + b, 0);
    if (extra === 0 || weight_sum === 0) return sizes.slice();
    const result = sizes.slice();
    if (extra > 0) {
      let given = 0;
      for (let i = 0; i < weights.length; i++) {
        const add = Math.trunc((extra * weights[i]) / weight_sum);
        result[i] += add;
        given += add;
      }
      const weighted = [];
      for (let i = weights.length - 1; i >= 0; i--) if (weights[i]) weighted.push(i);
      for (let k = 0; k < extra - given; k++) result[weighted[k % weighted.length]] += 1;
      return result;
    }
    // Shrink weighted slots, never below zero.
    let shortfall = -extra;
    while (shortfall > 0) {
      const active = [];
      for (let i = 0; i < weights.length; i++) if (weights[i] && result[i] > 0) active.push(i);
      if (!active.length) break;
      const active_weight = active.reduce((a, i) => a + weights[i], 0);
      let took = 0;
      for (const i of active) {
        let take = Math.min(result[i], Math.max(1, Math.trunc((shortfall * weights[i]) / active_weight)));
        take = Math.min(take, shortfall - took);
        result[i] -= take;
        took += take;
        if (took >= shortfall) break;
      }
      shortfall -= took;
      if (took === 0) break;
    }
    return result;
  }

  function grid_arrange(container) {
    let [cols, rows] = _grid_sizes(container);
    if (!cols.length || !rows.length) return;
    const [left, top, right, bottom] = container.borders();
    const avail_w = container.width - left - right;
    const avail_h = container.height - top - bottom;
    const col_weights = cols.map((_, i) => (container.grid_columns[i] ?? slot_defaults()).weight);
    const row_weights = rows.map((_, i) => (container.grid_rows[i] ?? slot_defaults()).weight);
    cols = _distribute(cols, col_weights, avail_w);
    rows = _distribute(rows, row_weights, avail_h);
    // Tk 8.6 anchors the grid at the top-left corner (grid anchor nw).
    const col_pos = [left];
    for (const size of cols) col_pos.push(col_pos[col_pos.length - 1] + size);
    const row_pos = [top];
    for (const size of rows) row_pos.push(row_pos[row_pos.length - 1] + size);
    for (const slave of container.grid_slaves) {
      const g = slave.grid;
      const c = g.column;
      const r = g.row;
      const c2 = Math.min(c + g.columnspan, cols.length);
      const r2 = Math.min(r + g.rowspan, rows.length);
      let cell_x = col_pos[c];
      let cell_y = row_pos[r];
      let cell_w = col_pos[c2] - cell_x;
      let cell_h = row_pos[r2] - cell_y;
      const [pad_l, pad_r] = g.padx;
      const [pad_t, pad_b] = g.pady;
      // Slot padding (-pad of columnconfigure) is split around the cell.
      let col_pad = 0;
      for (let i = c; i < c2; i++) col_pad += (container.grid_columns[i] ?? slot_defaults()).pad;
      let row_pad = 0;
      for (let i = r; i < r2; i++) row_pad += (container.grid_rows[i] ?? slot_defaults()).pad;
      cell_x += Math.trunc(col_pad / 2);
      cell_w -= col_pad;
      cell_y += Math.trunc(row_pad / 2);
      cell_h -= row_pad;
      const inner_w = cell_w - pad_l - pad_r;
      const inner_h = cell_h - pad_t - pad_b;
      let width = Math.min(slave.req_w + 2 * g.ipadx, inner_w);
      let height = Math.min(slave.req_h + 2 * g.ipady, inner_h);
      const st = g.sticky;
      if (st.includes(`e`) && st.includes(`w`)) width = inner_w;
      if (st.includes(`n`) && st.includes(`s`)) height = inner_h;
      let x;
      if (st.includes(`w`)) x = cell_x + pad_l;
      else if (st.includes(`e`)) x = cell_x + pad_l + inner_w - width;
      else x = cell_x + pad_l + Math.trunc((inner_w - width) / 2);
      let y;
      if (st.includes(`n`)) y = cell_y + pad_t;
      else if (st.includes(`s`)) y = cell_y + pad_t + inner_h - height;
      else y = cell_y + pad_t + Math.trunc((inner_h - height) / 2);
      set_slave_geometry(container, slave, x, y, width, height);
    }
  }

  function grid_size(container) {
    let cols = 0;
    let rows = 0;
    for (const s of container.grid_slaves) {
      cols = Math.max(cols, s.grid.column + s.grid.columnspan);
      rows = Math.max(rows, s.grid.row + s.grid.rowspan);
    }
    return [cols, rows];
  }

  // ---- place -------------------------------------------------------------------------

  function place_configure(app, widgets, args) {
    if (args.length % 2) throw new TclError(`value for "${args[args.length - 1]}" missing`);
    for (const widget of widgets) {
      const info = widget.manager === `place` && widget.place
        ? widget.place
        : {
            x: 0, y: 0, relx: 0, rely: 0, width: null, height: null,
            relwidth: null, relheight: null, anchor: `nw`, bordermode: `inside`,
          };
      let container = widget.parent;
      for (let i = 0; i < args.length; i += 2) {
        const key = to_str(args[i]).slice(1);
        const value = args[i + 1];
        if (key === `x` || key === `y`) info[key] = get_pixels(value);
        else if (key === `relx` || key === `rely`) info[key] = get_double(value);
        else if (key === `width` || key === `height`) info[key] = to_str(value) === `` ? null : get_pixels(value);
        else if (key === `relwidth` || key === `relheight`) info[key] = to_str(value) === `` ? null : get_double(value);
        else if (key === `anchor`) info.anchor = anchor(value);
        else if (key === `bordermode`) info.bordermode = to_str(value);
        else if (key === `in`) container = app.widget(to_str(value));
        else throw new TclError(`unknown option "-${key}"`);
      }
      app.unmanage(widget, `place`);
      widget.manager = `place`;
      widget.place = info;
      info.in = container;
      if (!container.place_slaves.includes(widget)) container.place_slaves.push(widget);
    }
    app.schedule_layout();
  }

  function place_info(widget) {
    const info = widget.place;
    if (widget.manager !== `place` || !info) return [];
    const opt = (v) => (v === null || v === undefined ? `` : v);
    return [
      `-in`, info.in.path, `-x`, info.x, `-relx`, info.relx, `-y`, info.y,
      `-rely`, info.rely, `-width`, opt(info.width), `-relwidth`, opt(info.relwidth),
      `-height`, opt(info.height), `-relheight`, opt(info.relheight),
      `-anchor`, info.anchor, `-bordermode`, info.bordermode,
    ];
  }

  function place_arrange(container) {
    const inset = container.border_inset();
    const inner_w = container.width - 2 * inset;
    const inner_h = container.height - 2 * inset;
    for (const slave of container.place_slaves) {
      const p = slave.place;
      let base_x;
      let base_y;
      let base_w;
      let base_h;
      if (p.bordermode === `inside`) {
        base_x = inset;
        base_y = inset;
        base_w = inner_w;
        base_h = inner_h;
      } else {
        base_x = 0;
        base_y = 0;
        base_w = container.width;
        base_h = container.height;
      }
      let x = base_x + p.x + Math.trunc(p.relx * base_w);
      let y = base_y + p.y + Math.trunc(p.rely * base_h);
      let width = slave.req_w;
      if (p.width !== null || p.relwidth !== null) {
        width = (p.width ?? 0) + Math.trunc((p.relwidth ?? 0) * base_w);
      }
      let height = slave.req_h;
      if (p.height !== null || p.relheight !== null) {
        height = (p.height ?? 0) + Math.trunc((p.relheight ?? 0) * base_h);
      }
      const a = p.anchor;
      if ([`n`, `s`, `center`].includes(a)) x -= Math.trunc(width / 2);
      else if ([`ne`, `e`, `se`].includes(a)) x -= width;
      if ([`w`, `e`, `center`].includes(a)) y -= Math.trunc(height / 2);
      else if ([`sw`, `s`, `se`].includes(a)) y -= height;
      set_slave_geometry(container, slave, x, y, width, height);
    }
  }

  // ---- whole tree --------------------------------------------------------------------

  function compute_requests(widget, done = null) {
    const visited = done ?? new Set();
    if (visited.has(widget.path)) return;
    for (const child of widget.children) {
      if (!child.is_toplevel) compute_requests(child, visited);
    }
    // Slaves managed with -in may live elsewhere in the tree: size them first.
    const managed = widget.managed_slaves ? widget.managed_slaves() : [];
    for (const slave of [
      ...widget.pack_slaves, ...widget.grid_slaves, ...widget.place_slaves, ...managed,
    ]) {
      if (!visited.has(slave.path)) compute_requests(slave, visited);
    }
    visited.add(widget.path);
    let [width, height] = widget.content_request();
    if (widget.pack_slaves.length && widget.propagate.pack) {
      [width, height] = pack_request(widget);
    } else if (widget.grid_slaves.length && widget.propagate.grid) {
      [width, height] = grid_request(widget);
    }
    widget.req_w = Math.max(width, 1);
    widget.req_h = Math.max(height, 1);
  }

  function arrange(widget) {
    for (const child of widget.children) {
      if (!child.is_toplevel) child.mapped = false;
    }
    if (widget.pack_slaves.length) pack_arrange(widget);
    if (widget.grid_slaves.length) grid_arrange(widget);
    if (widget.place_slaves.length) place_arrange(widget);
    if (typeof widget.arrange_slaves === `function`) widget.arrange_slaves();
    for (const child of widget.children) {
      if (!child.is_toplevel && child.mapped) arrange(child);
    }
  }

  ns.cdiv = cdiv;
  ns.pack_defaults = pack_defaults;
  ns.pack_configure = pack_configure;
  ns.pack_info = pack_info;
  ns.pack_request = pack_request;
  ns.pack_arrange = pack_arrange;
  ns.set_slave_geometry = set_slave_geometry;
  ns.grid_defaults = grid_defaults;
  ns.grid_configure = grid_configure;
  ns.grid_info = grid_info;
  ns.slot_defaults = slot_defaults;
  ns.grid_slot_configure = grid_slot_configure;
  ns.grid_request = grid_request;
  ns.grid_arrange = grid_arrange;
  ns.grid_size = grid_size;
  ns.place_configure = place_configure;
  ns.place_info = place_info;
  ns.place_arrange = place_arrange;
  ns.compute_requests = compute_requests;
  ns.arrange = arrange;
  ns.geometry = { cdiv, pack_defaults, pack_configure, pack_info, pack_request, pack_arrange, set_slave_geometry, grid_defaults, grid_configure, grid_info, slot_defaults, grid_slot_configure, grid_request, grid_arrange, grid_size, place_configure, place_info, place_arrange, compute_requests, arrange };
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// images.js
// ============================================================

(function (ns) {
  "use strict";
  var TclError = ns.TclError;
  var get_int = ns.get_int;
  var split_list = ns.split_list;
  var to_str = ns.to_str;

  /**
   * Tk photo images: blank images, PNG/GIF from -file or -data, zoom/subsample.
   *
   * Like Tk 8.6 without extensions, only PNG and GIF are recognized. Pixels are
   * not stored: the page shows the encoded file, scaled for zoom/subsample.
   *
   * JS port of pythonny_tk/images.py. File access goes through the registry's
   * optional read_file/write_file hooks (the Skulpt layer wires them to its
   * virtual filesystem).
   */


  function b64encode(bytes) {
    if (typeof Buffer !== `undefined`) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(`base64`);
    let bin = ``;
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64decode(s) {
    try {
      if (typeof Buffer !== `undefined`) return new Uint8Array(Buffer.from(s, `base64`));
      const bin = atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch {
      // Like Python's base64 fallback: treat the text as latin-1 bytes.
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
      return out;
    }
  }

  function bytes_from(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (Array.isArray(value)) return Uint8Array.from(value);
    return null;
  }

  // 1x1 transparent GIF used for blank images.
  const _BLANK_GIF = b64decode(`R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`);

  const _PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  function _sniff(data) {
    /* (mime, width, height) of PNG/GIF data, or raises like Tk. */
    if (data.length >= 24 && _PNG_SIG.every((b, i) => data[i] === b)) {
      const view = new DataView(data.buffer, data.byteOffset + 16, 8);
      return [`image/png`, view.getUint32(0), view.getUint32(4)];
    }
    if (data.length >= 10) {
      const sig = String.fromCharCode(data[0], data[1], data[2], data[3], data[4], data[5]);
      if (sig === `GIF87a` || sig === `GIF89a`) {
        const view = new DataView(data.buffer, data.byteOffset + 6, 4);
        return [`image/gif`, view.getUint16(0, true), view.getUint16(2, true)];
      }
    }
    throw new TclError(`couldn't recognize data in image file`);
  }

  class PhotoImage {
    constructor(registry, name) {
      this.registry = registry;
      this.name = name;
      this.options = {
        data: ``, file: ``, format: ``, gamma: 1.0, height: 0, palette: ``, width: 0,
      };
      this.source = null; // null or [mime, bytes, natural_width, natural_height]
      this.provider = null; // () => data-URL: малюнок оновлюється ззовні
      this.scale = [1.0, 1.0];
      this.version = 0;
    }

    // ---- size and content --------------------------------------------------------------

    get source() {
      if (this.provider) {
        // «Живе» зображення (PIL.ImageTk.PhotoImage): data-URL читається щоразу.
        const url = this.provider();
        if (url !== this._providerUrl) {
          this._providerUrl = url;
          this.version += 1; // малюнок змінився (напр. після paste())
        }
        const m = /^data:([^;]+);base64,(.*)$/.exec(url ?? ``);
        this._source = m ? [m[1], b64decode(m[2]), 0, 0] : null;
        if (this._source) {
          const sniffed = _sniff(this._source[1]);
          this._source[2] = sniffed[1];
          this._source[3] = sniffed[2];
        }
      }
      return this._source;
    }

    set source(value) {
      this._source = value;
    }

    get width() {
      if (this.options.width) return this.options.width;
      if (this.source) return Math.max(1, Math.trunc(this.source[2] * this.scale[0]));
      return 0;
    }

    get height() {
      if (this.options.height) return this.options.height;
      if (this.source) return Math.max(1, Math.trunc(this.source[3] * this.scale[1]));
      return 0;
    }

    url() {
      if (this.provider) {
        const url = this.provider();
        return url ?? ``;
      }
      if (!this.source) return ``;
      const [mime, data] = this.source;
      return `data:${mime};base64,${b64encode(data)}`;
    }

    _load_bytes(data) {
      const [mime, width, height] = _sniff(data);
      this.source = [mime, data, width, height];
      this.scale = [1.0, 1.0];
    }

    configure(args) {
      if (args.length % 2) {
        throw new TclError(`value for "${to_str(args[args.length - 1])}" missing`);
      }
      for (let k = 0; k < args.length; k += 2) {
        let value = args[k + 1];
        const key = to_str(args[k]).replace(/^-/, ``);
        if (!(key in this.options)) throw new TclError(`unknown option "${to_str(args[k])}"`);
        if (key === `width` || key === `height`) value = get_int(value);
        else if (key === `file`) {
          const path = to_str(value);
          if (path) {
            const raw = this.registry.read_file ? this.registry.read_file(path) : null;
            if (raw === null || raw === undefined) {
              throw new TclError(`couldn't open "${path}": no such file or directory`);
            }
            this._load_bytes(bytes_from(raw) ?? new Uint8Array(raw));
          }
        } else if (key === `data`) {
          let raw = bytes_from(value);
          if (!raw) {
            const text = to_str(value);
            raw = text ? b64decode(text) : new Uint8Array(0);
          }
          if (raw.length) this._load_bytes(raw);
          value = bytes_from(value) ? `` : to_str(value);
        }
        this.options[key] = value;
      }
      this.changed();
    }

    changed() {
      this.version += 1;
      this.registry.changed(this);
    }

    // ---- the image command -------------------------------------------------------------

    command(args) {
      const sub = args.length ? to_str(args[0]) : ``;
      const rest = args.slice(1);
      if (sub === `configure` || sub === `config`) {
        // tkinter's Image.configure() sends "config"
        if (!rest.length) {
          return Object.entries(this.options).map(([k, v]) => [`-` + k, ``, ``, ``, v]);
        }
        if (rest.length === 1) {
          const key = to_str(rest[0]).replace(/^-/, ``);
          return [`-` + key, ``, ``, ``, this.options[key] ?? ``];
        }
        this.configure(rest);
        return ``;
      }
      if (sub === `cget`) return this.options[to_str(rest[0]).replace(/^-/, ``)] ?? ``;
      if (sub === `blank`) {
        this.source = null;
        this.changed();
        return ``;
      }
      if (sub === `copy`) {
        const source = this.registry.get(rest[0]);
        const opts = {};
        for (let k = 1; k + 1 < rest.length; k += 2) opts[to_str(rest[k])] = rest[k + 1];
        this.source = source.source;
        let [sx, sy] = source.scale;
        if (`-zoom` in opts) {
          const z = split_list(opts[`-zoom`]).map((v) => get_int(v));
          sx *= z[0];
          sy *= z.length > 1 ? z[1] : z[0];
        }
        if (`-subsample` in opts) {
          const z = split_list(opts[`-subsample`]).map((v) => get_int(v));
          sx /= z[0];
          sy /= z.length > 1 ? z[1] : z[0];
        }
        this.scale = [sx, sy];
        this.changed();
        return ``;
      }
      if (sub === `data`) return this.source ? b64encode(this.source[1]) : ``;
      if (sub === `get`) {
        throw new TclError(`reading pixels of a PhotoImage is not supported in PyThonny yet`);
      }
      if (sub === `put`) {
        throw new TclError(`drawing pixels into a PhotoImage is not supported in PyThonny yet`);
      }
      if (sub === `transparency`) return rest.length && to_str(rest[0]) === `get` ? 0 : ``;
      if (sub === `write`) {
        if (!this.source) throw new TclError(`image is empty`);
        if (!this.registry.write_file) {
          throw new TclError(`couldn't open "${to_str(rest[0])}": no such file or directory`);
        }
        this.registry.write_file(to_str(rest[0]), this.source[1]);
        return ``;
      }
      if (sub === `read`) {
        const path = to_str(rest[0]);
        const raw = this.registry.read_file ? this.registry.read_file(path) : null;
        if (raw === null || raw === undefined) {
          throw new TclError(`couldn't open "${path}": no such file or directory`);
        }
        this._load_bytes(bytes_from(raw) ?? new Uint8Array(raw));
        this.changed();
        return ``;
      }
      if (sub === `redither`) return ``;
      throw new TclError(
        `bad option "${sub}": must be blank, cget, configure, copy, data, get, put, read, redither, transparency, or write`,
      );
    }

    render() {
      return { url: this.url(), w: this.width, h: this.height, v: this.version };
    }
  }

  class ImageRegistry {
    constructor(app) {
      this.app = app;
      this.images = new Map();
      this.counter = 0;
      this.pending = new Map();
      this.read_file = null;
      this.write_file = null;
    }

    get(name) {
      const key = to_str(name);
      if (!this.images.has(key)) throw new TclError(`image "${key}" doesn't exist`);
      return this.images.get(key);
    }

    exists(name) {
      return this.images.has(to_str(name));
    }

    register_provider(provider) {
      /* Реєструє «живе» зображення: data-URL читається щоразу під час
         малювання, тож PIL.ImageTk.PhotoImage оновлюється після paste(). */
      this.counter += 1;
      const name = `image${this.counter}`;
      const image = new PhotoImage(this, name);
      image.provider = provider;
      this.images.set(name, image);
      this.app.commands.set(name, (...a) => image.command(a));
      return name;
    }

    changed(image) {
      this.pending.set(image.name, image);
      this.app.schedule_layout();
    }

    command(args) {
      const sub = args.length ? to_str(args[0]) : ``;
      let rest = args.slice(1);
      if (sub === `create`) {
        const kind = to_str(rest[0]);
        if (![`photo`, `bitmap`].includes(kind)) {
          throw new TclError(`image type "${kind}" doesn't exist`);
        }
        if (kind === `bitmap`) throw new TclError(`bitmap images are not supported in PyThonny yet`);
        rest = rest.slice(1);
        let name;
        if (rest.length && !to_str(rest[0]).startsWith(`-`)) {
          name = to_str(rest[0]);
          rest = rest.slice(1);
        } else {
          this.counter += 1;
          name = `image${this.counter}`;
        }
        const image = this.images.get(name) ?? new PhotoImage(this, name);
        this.images.set(name, image);
        this.app.commands.set(name, (...a) => image.command(a));
        image.configure(rest);
        return name;
      }
      if (sub === `delete`) {
        for (const name of rest) {
          this.images.delete(to_str(name));
          this.app.commands.delete(to_str(name));
        }
        return ``;
      }
      if (sub === `names`) return [...this.images.keys()];
      if (sub === `types`) return [`photo`];
      if (sub === `width` || sub === `height`) {
        const image = this.get(rest[0]);
        return sub === `width` ? image.width : image.height;
      }
      if (sub === `type`) {
        this.get(rest[0]);
        return `photo`;
      }
      if (sub === `inuse`) return 0;
      throw new TclError(
        `bad option "${sub}": must be create, delete, height, inuse, names, type, types, or width`,
      );
    }

    take_ops() {
      const ops = [];
      for (const [name, image] of this.pending) {
        ops.push({ op: `image`, name, ...image.render() });
      }
      this.pending.clear();
      return ops;
    }
  }

  ns.b64encode = b64encode;
  ns.PhotoImage = PhotoImage;
  ns.ImageRegistry = ImageRegistry;
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// fonts.js
// ============================================================

(function (ns) {
  "use strict";
  var TclError = ns.TclError;
  var get_int = ns.get_int;
  var split_list = ns.split_list;
  var to_str = ns.to_str;
  var font_metrics = ns.font_metrics;
  var measure_text = ns.measure_text;

  /**
   * Tk fonts: named fonts, font descriptions, metrics and text layout.
   *
   * Sizes follow Tk on Windows at 96 DPI: positive sizes are points
   * (px = round(pt * 96 / 72)), negative sizes are pixels. Text is measured
   * by the browser canvas, so layout matches what the page draws.
   *
   * JS port of pythonny_tk/fonts.py.
   */


  // Tk 8.6 named fonts on Windows 10 (taken from the system message font).
  const NAMED_DEFAULTS = {
    TkDefaultFont: [`Segoe UI`, 9, `normal`, `roman`],
    TkTextFont: [`Segoe UI`, 9, `normal`, `roman`],
    TkFixedFont: [`Courier New`, 10, `normal`, `roman`],
    TkMenuFont: [`Segoe UI`, 9, `normal`, `roman`],
    TkHeadingFont: [`Segoe UI`, 9, `bold`, `roman`],
    TkCaptionFont: [`Segoe UI`, 9, `normal`, `roman`],
    TkSmallCaptionFont: [`Segoe UI`, 9, `normal`, `roman`],
    TkIconFont: [`Segoe UI`, 9, `normal`, `roman`],
    TkTooltipFont: [`Segoe UI`, 9, `normal`, `roman`],
  };

  // Tk on Windows substitutes these X11-era names.
  const ALIASES = {
    courier: `Courier New`,
    times: `Times New Roman`,
    helvetica: `Arial`,
    fixed: `Courier New`,
    system: `Segoe UI`,
    ansi: `Segoe UI`,
    systemfixed: `Courier New`,
    ansifixed: `Courier New`,
    device: `Segoe UI`,
  };

  const MONO = new Set([`courier new`, `consolas`, `lucida console`, `fixedsys`, `terminal`]);
  const SERIF = new Set([
    `times new roman`,
    `georgia`,
    `cambria`,
    `book antiqua`,
    `garamond`,
    `palatino linotype`,
  ]);

  const DEFAULT_SIZE = 9;

  class Font {
    constructor(family, size, weight = `normal`, slant = `roman`, underline = false, overstrike = false) {
      this.family = family;
      this.size = size;
      this.weight = weight;
      this.slant = slant;
      this.underline = underline;
      this.overstrike = overstrike;
      this._metrics = null;
      this._widths = {};
    }

    get pixels() {
      const size = this.size || DEFAULT_SIZE;
      return size < 0 ? -size : Math.round((size * 96) / 72);
    }

    get css() {
      const key = this.family.toLowerCase();
      const generic = MONO.has(key) ? `monospace` : SERIF.has(key) ? `serif` : `sans-serif`;
      const style = this.slant === `italic` ? `italic ` : ``;
      const weight = this.weight === `bold` ? `bold ` : ``;
      return `${style}${weight}${this.pixels}px "${this.family}", ${generic}`;
    }

    metrics() {
      if (this._metrics === null) {
        const [a, d] = font_metrics(this.css);
        const ascent = Math.round(a);
        const descent = Math.round(d);
        this._metrics = [ascent, descent, ascent + descent];
      }
      return this._metrics;
    }

    get linespace() {
      return this.metrics()[2];
    }

    measure(text) {
      let width = this._widths[text];
      if (width === undefined) {
        width = text ? Math.round(measure_text(this.css, text)) : 0;
        if (Object.keys(this._widths).length < 2000) this._widths[text] = width;
      }
      return width;
    }

    actual() {
      return [
        `-family`, this.family,
        `-size`, this.size || DEFAULT_SIZE,
        `-weight`, this.weight,
        `-slant`, this.slant,
        `-underline`, this.underline ? 1 : 0,
        `-overstrike`, this.overstrike ? 1 : 0,
      ];
    }

    layout(text, wraplength = 0) {
      const lines = [];
      for (const paragraph of text.split(`\n`)) {
        if (wraplength && wraplength > 0 && this.measure(paragraph) > wraplength) {
          let current = ``;
          for (const word of paragraph.split(` `)) {
            const candidate = current ? current + ` ` + word : word;
            if (current && this.measure(candidate) > wraplength) {
              lines.push(current);
              current = word;
            } else {
              current = candidate;
            }
          }
          lines.push(current);
        } else {
          lines.push(paragraph);
        }
      }
      const widths = lines.map((line) => this.measure(line));
      return [lines, widths.length ? Math.max(...widths) : 0, lines.length * this.linespace];
    }
  }

  class FontRegistry {
    constructor() {
      this.named = {};
      this._cache = {};
      this._counter = 0;
      for (const [name, [family, size, weight, slant]] of Object.entries(NAMED_DEFAULTS)) {
        this.named[name] = new Font(family, size, weight, slant);
      }
    }

    get(spec) {
      if (spec instanceof Font) return spec;
      const key = to_str(spec);
      if (key in this.named) return this.named[key];
      let font = this._cache[key];
      if (font === undefined) {
        font = this._parse(spec);
        this._cache[key] = font;
      }
      return font;
    }

    _parse(spec) {
      const words = split_list(spec);
      if (!words.length) throw new TclError(`font "" doesn't exist`);
      if (words[0].startsWith(`-`)) return this._from_options(words);
      const family = ALIASES[words[0].toLowerCase()] ?? words[0];
      let size = DEFAULT_SIZE;
      let weight = `normal`;
      let slant = `roman`;
      let underline = false;
      let overstrike = false;
      if (words.length > 1) {
        try {
          size = get_int(words[1]);
        } catch {
          throw new TclError(`expected integer but got "${words[1]}"`);
        }
      }
      const styles = [];
      for (const word of words.slice(2)) styles.push(...split_list(word));
      for (let style of styles) {
        style = style.toLowerCase();
        if (style === `bold`) weight = `bold`;
        else if (style === `normal`) weight = `normal`;
        else if (style === `italic`) slant = `italic`;
        else if (style === `roman`) slant = `roman`;
        else if (style === `underline`) underline = true;
        else if (style === `overstrike`) overstrike = true;
        else throw new TclError(`unknown font style "${style}"`);
      }
      return new Font(family, size, weight, slant, underline, overstrike);
    }

    _from_options(words, base = null) {
      const font = base ?? new Font(`Segoe UI`, DEFAULT_SIZE);
      if (words.length % 2) throw new TclError(`value for "${words[words.length - 1]}" missing`);
      for (let i = 0; i < words.length; i += 2) {
        const option = words[i];
        const value = words[i + 1];
        if (option === `-family`) font.family = ALIASES[value.toLowerCase()] ?? value;
        else if (option === `-size`) font.size = get_int(value);
        else if (option === `-weight`) font.weight = value === `bold` ? `bold` : `normal`;
        else if (option === `-slant`) font.slant = value === `italic` ? `italic` : `roman`;
        else if (option === `-underline`) font.underline = ![`0`, `false`, `no`, `off`, ``].includes(value);
        else if (option === `-overstrike`) font.overstrike = ![`0`, `false`, `no`, `off`, ``].includes(value);
        else
          throw new TclError(
            `bad option "${option}": must be -family, -size, -weight, -slant, -underline, or -overstrike`,
          );
      }
      font._metrics = null;
      font._widths = {};
      return font;
    }

    // ---- the "font" command ---------------------------------------------------

    command(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "font option ?arg?"`);
      const sub = args[0];
      const rest = args.slice(1);
      if (sub === `create`) {
        let name;
        let options = rest;
        if (rest.length && !rest[0].startsWith(`-`)) {
          name = rest[0];
          options = rest.slice(1);
        } else {
          this._counter += 1;
          name = `font${this._counter}`;
        }
        if (name in this.named && !(name in NAMED_DEFAULTS)) {
          throw new TclError(`named font "${name}" already exists`);
        }
        this.named[name] = this._from_options(options.slice());
        return name;
      }
      if (sub === `configure`) {
        const font = this._named(rest[0]);
        if (rest.length === 1) return font.actual();
        if (rest.length === 2) {
          const values = font.actual();
          const dict = {};
          for (let i = 0; i < values.length; i += 2) dict[values[i]] = values[i + 1];
          return dict[rest[1]];
        }
        this._from_options(rest.slice(1), font);
        this._cache = {};
        return ``;
      }
      if (sub === `delete`) {
        for (const name of rest) delete this.named[name];
        return ``;
      }
      if (sub === `names`) return Object.keys(this.named);
      if (sub === `families`)
        return [
          `Arial`, `Calibri`, `Cambria`, `Comic Sans MS`, `Consolas`, `Courier New`,
          `Georgia`, `Impact`, `Lucida Console`, `Segoe UI`, `Tahoma`,
          `Times New Roman`, `Trebuchet MS`, `Verdana`,
        ];
      if ([`actual`, `metrics`, `measure`].includes(sub)) {
        const clean = rest.filter((r, i) => !(r === `-displayof` || (i > 0 && rest[i - 1] === `-displayof`)));
        const font = this.get(clean[0]);
        if (sub === `measure`) return font.measure(clean[1]);
        if (sub === `actual`) {
          const values = font.actual();
          if (clean.length > 1) {
            const dict = {};
            for (let i = 0; i < values.length; i += 2) dict[values[i]] = values[i + 1];
            return dict[clean[1]];
          }
          return values;
        }
        const [ascent, descent, linespace] = font.metrics();
        const fixed = font.family.toLowerCase() in MONO ? 1 : 0;
        const values = [`-ascent`, ascent, `-descent`, descent, `-linespace`, linespace, `-fixed`, fixed];
        if (clean.length > 1) {
          const dict = {};
          for (let i = 0; i < values.length; i += 2) dict[values[i]] = values[i + 1];
          return dict[clean[1]];
        }
        return values;
      }
      throw new TclError(
        `bad option "${sub}": must be actual, configure, create, delete, families, measure, metrics, or names`,
      );
    }

    _named(name) {
      if (!(name in this.named)) throw new TclError(`named font "${name}" doesn't exist`);
      return this.named[name];
    }
  }

  ns.DEFAULT_SIZE = DEFAULT_SIZE;
  ns.Font = Font;
  ns.FontRegistry = FontRegistry;
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// widgets.js
// ============================================================

(function (ns) {
  "use strict";
  var css_color = ns.css_color;
  var TclError = ns.TclError;
  var get_boolean = ns.get_boolean;
  var get_double = ns.get_double;
  var get_int = ns.get_int;
  var get_pixels = ns.get_pixels;
  var to_str = ns.to_str;

  /**
   * Widget model of the emulated Tk: options, widget commands and requested size.
   *
   * Defaults and size formulas follow Tk 8.6 on Windows (win/tkWinDefault.h,
   * win/tkWinButton.c, generic/tkEntry.c, generic/tkFrame.c).
   *
   * JS port of pythonny_tk/widgets.py.
   */


  class Option {
    constructor(name, db, klass, default_, kind = `str`) {
      this.name = name;
      this.db = db;
      this.klass = klass;
      this.default = default_;
      this.kind = kind;
    }
  }

  function options(...specs) {
    const result = {};
    for (const spec of specs) result[spec[0]] = new Option(...spec);
    return result;
  }

  function merge_options(...tables) {
    return Object.assign({}, ...tables);
  }

  function without(table, keys) {
    const result = {};
    for (const [k, v] of Object.entries(table)) if (!keys.includes(k)) result[k] = v;
    return result;
  }

  const ALIASES = { bg: `background`, fg: `foreground`, bd: `borderwidth` };

  const RELIEFS = [`flat`, `groove`, `raised`, `ridge`, `solid`, `sunken`];
  const ANCHORS = [`n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`, `center`];
  const JUSTIFY = [`left`, `right`, `center`];
  const COMPOUND = [`bottom`, `center`, `left`, `none`, `right`, `top`];

  function choice(value, choices, what) {
    const v = to_str(value);
    if (choices.includes(v)) return v;
    // Tk accepts unique abbreviations.
    const matches = v ? choices.filter((c) => c.startsWith(v)) : [];
    if (matches.length === 1) return matches[0];
    const listed = choices.slice(0, -1).join(`, `) + `, or ` + choices[choices.length - 1];
    throw new TclError(`bad ${what} "${v}": must be ${listed}`);
  }

  function convert(option, value) {
    if (typeof value === `function`) return value; // JS callback (binding layer)
    const kind = option.kind;
    if (kind === `int`) return get_int(value);
    if (kind === `float`) return get_double(value);
    if (kind === `pixels`) return get_pixels(value);
    if (kind === `bool`) return get_boolean(value) ? 1 : 0;
    if (kind === `relief`) return choice(value, RELIEFS, `relief`);
    if (kind === `anchor`) return choice(value, ANCHORS, `anchor`);
    if (kind === `justify`) return choice(value, JUSTIFY, `justification`);
    if (kind === `compound`) return choice(value, COMPOUND, `compound`);
    if (kind === `state`) return choice(value, [`active`, `disabled`, `normal`], `state`);
    if (kind === `entrystate`) return choice(value, [`disabled`, `normal`, `readonly`], `state`);
    if (kind === `color`) {
      css_color(value); // raises TclError for unknown colors, like Tk
      return to_str(value);
    }
    return to_str(value);
  }

  // ---- option tables ----------------------------------------------------------------

  const FRAME_OPTIONS = options(
    [`background`, `background`, `Background`, `SystemButtonFace`, `color`],
    [`borderwidth`, `borderWidth`, `BorderWidth`, 0, `pixels`],
    [`class`, `class`, `Class`, `Frame`],
    [`colormap`, `colormap`, `Colormap`, ``],
    [`container`, `container`, `Container`, 0, `bool`],
    [`cursor`, `cursor`, `Cursor`, ``],
    [`height`, `height`, `Height`, 0, `pixels`],
    [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
    [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
    [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 0, `pixels`],
    [`padx`, `padX`, `Pad`, 0, `pixels`],
    [`pady`, `padY`, `Pad`, 0, `pixels`],
    [`relief`, `relief`, `Relief`, `flat`, `relief`],
    [`takefocus`, `takeFocus`, `TakeFocus`, `0`],
    [`visual`, `visual`, `Visual`, ``],
    [`width`, `width`, `Width`, 0, `pixels`],
  );

  const TOPLEVEL_OPTIONS = merge_options(
    FRAME_OPTIONS,
    options(
      [`class`, `class`, `Class`, `Toplevel`],
      [`menu`, `menu`, `Menu`, ``],
      [`screen`, `screen`, `Screen`, ``],
      [`use`, `use`, `Use`, ``],
    ),
  );

  const LABEL_OPTIONS = options(
    [`activebackground`, `activeBackground`, `Foreground`, `SystemButtonFace`, `color`],
    [`activeforeground`, `activeForeground`, `Background`, `SystemButtonText`, `color`],
    [`anchor`, `anchor`, `Anchor`, `center`, `anchor`],
    [`background`, `background`, `Background`, `SystemButtonFace`, `color`],
    [`bitmap`, `bitmap`, `Bitmap`, ``],
    [`borderwidth`, `borderWidth`, `BorderWidth`, 2, `pixels`],
    [`compound`, `compound`, `Compound`, `none`, `compound`],
    [`cursor`, `cursor`, `Cursor`, ``],
    [`disabledforeground`, `disabledForeground`, `DisabledForeground`, `SystemDisabledText`, `color`],
    [`font`, `font`, `Font`, `TkDefaultFont`, `font`],
    [`foreground`, `foreground`, `Foreground`, `SystemButtonText`, `color`],
    [`height`, `height`, `Height`, 0, `pixels`],
    [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
    [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
    [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 0, `pixels`],
    [`image`, `image`, `Image`, ``, `image`],
    [`justify`, `justify`, `Justify`, `center`, `justify`],
    [`padx`, `padX`, `Pad`, 1, `pixels`],
    [`pady`, `padY`, `Pad`, 1, `pixels`],
    [`relief`, `relief`, `Relief`, `flat`, `relief`],
    [`state`, `state`, `State`, `normal`, `state`],
    [`takefocus`, `takeFocus`, `TakeFocus`, `0`],
    [`text`, `text`, `Text`, ``],
    [`textvariable`, `textVariable`, `Variable`, ``],
    [`underline`, `underline`, `Underline`, -1, `int`],
    [`width`, `width`, `Width`, 0, `pixels`],
    [`wraplength`, `wrapLength`, `WrapLength`, 0, `pixels`],
  );

  const BUTTON_OPTIONS = merge_options(
    LABEL_OPTIONS,
    options(
      [`command`, `command`, `Command`, ``],
      [`default`, `default`, `Default`, `disabled`],
      [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 1, `pixels`],
      [`overrelief`, `overRelief`, `OverRelief`, ``],
      [`relief`, `relief`, `Relief`, `raised`, `relief`],
      [`repeatdelay`, `repeatDelay`, `RepeatDelay`, 0, `int`],
      [`repeatinterval`, `repeatInterval`, `RepeatInterval`, 0, `int`],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
    ),
  );

  const CHECK_OPTIONS = without(
    merge_options(
      BUTTON_OPTIONS,
      options(
        [`activeforeground`, `activeForeground`, `Background`, `SystemWindowText`, `color`],
        [`anchor`, `anchor`, `Anchor`, `center`, `anchor`],
        [`foreground`, `foreground`, `Foreground`, `SystemWindowText`, `color`],
        [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 1, `pixels`],
        [`indicatoron`, `indicatorOn`, `IndicatorOn`, 1, `bool`],
        [`offrelief`, `offRelief`, `OffRelief`, `raised`, `relief`],
        [`offvalue`, `offValue`, `Value`, `0`],
        [`onvalue`, `onValue`, `Value`, `1`],
        [`relief`, `relief`, `Relief`, `flat`, `relief`],
        [`selectcolor`, `selectColor`, `Background`, `SystemWindow`, `color`],
        [`selectimage`, `selectImage`, `SelectImage`, ``, `image`],
        [`tristateimage`, `tristateImage`, `TristateImage`, ``, `image`],
        [`tristatevalue`, `tristateValue`, `TristateValue`, ``],
        [`variable`, `variable`, `Variable`, ``],
      ),
    ),
    [`default`, `repeatdelay`, `repeatinterval`],
  );

  const RADIO_OPTIONS = merge_options(
    without(CHECK_OPTIONS, [`offvalue`, `onvalue`]),
    options([`value`, `value`, `Value`, ``]),
  );

  const ENTRY_OPTIONS = options(
    [`background`, `background`, `Background`, `SystemWindow`, `color`],
    [`borderwidth`, `borderWidth`, `BorderWidth`, 1, `pixels`],
    [`cursor`, `cursor`, `Cursor`, `xterm`],
    [`disabledbackground`, `disabledBackground`, `DisabledBackground`, `SystemButtonFace`, `color`],
    [`disabledforeground`, `disabledForeground`, `DisabledForeground`, `SystemDisabledText`, `color`],
    [`exportselection`, `exportSelection`, `ExportSelection`, 1, `bool`],
    [`font`, `font`, `Font`, `TkTextFont`, `font`],
    [`foreground`, `foreground`, `Foreground`, `SystemWindowText`, `color`],
    [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
    [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
    [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 0, `pixels`],
    [`insertbackground`, `insertBackground`, `Foreground`, `SystemWindowText`, `color`],
    [`insertborderwidth`, `insertBorderWidth`, `BorderWidth`, 0, `pixels`],
    [`insertofftime`, `insertOffTime`, `OffTime`, 300, `int`],
    [`insertontime`, `insertOnTime`, `OnTime`, 600, `int`],
    [`insertwidth`, `insertWidth`, `InsertWidth`, 2, `pixels`],
    [`invalidcommand`, `invalidCommand`, `InvalidCommand`, ``],
    [`justify`, `justify`, `Justify`, `left`, `justify`],
    [`readonlybackground`, `readonlyBackground`, `ReadonlyBackground`, `SystemButtonFace`, `color`],
    [`relief`, `relief`, `Relief`, `sunken`, `relief`],
    [`selectbackground`, `selectBackground`, `Foreground`, `SystemHighlight`, `color`],
    [`selectborderwidth`, `selectBorderWidth`, `BorderWidth`, 0, `pixels`],
    [`selectforeground`, `selectForeground`, `Background`, `SystemHighlightText`, `color`],
    [`show`, `show`, `Show`, ``],
    [`state`, `state`, `State`, `normal`, `entrystate`],
    [`takefocus`, `takeFocus`, `TakeFocus`, ``],
    [`textvariable`, `textVariable`, `Variable`, ``],
    [`validate`, `validate`, `Validate`, `none`],
    [`validatecommand`, `validateCommand`, `ValidateCommand`, ``],
    [`width`, `width`, `Width`, 20, `int`],
    [`xscrollcommand`, `xScrollCommand`, `ScrollCommand`, ``],
  );
  const ENTRY_ALIASES = { invcmd: `invalidcommand`, vcmd: `validatecommand` };

  // ---- widgets -----------------------------------------------------------------------

  class Widget {
    /* A Tk window: options, children, geometry and bindtags. */
    static tk_class = `Frame`;
    static OPTIONS = FRAME_OPTIONS;
    static EXTRA_ALIASES = {};
    static is_toplevel = false;

    get tk_class() {
      return this._tk_class !== undefined ? this._tk_class : this.constructor.tk_class;
    }

    set tk_class(value) {
      this._tk_class = value;
    }

    get OPTIONS() {
      return this.constructor.OPTIONS;
    }

    get EXTRA_ALIASES() {
      return this.constructor.EXTRA_ALIASES;
    }

    get is_toplevel() {
      return this.constructor.is_toplevel;
    }

    constructor(app, path, parent) {
      this.app = app;
      this.path = path;
      this.parent = parent;
      this.children = [];
      this.options = {};
      const spec = this.constructor.OPTIONS;
      for (const [name, option] of Object.entries(spec)) this.options[name] = option.default;
      this.destroyed = false;
      // Geometry management.
      this.manager = null;
      this.pack = null;
      this.grid = null;
      this.place = null;
      this.pack_slaves = [];
      this.grid_slaves = [];
      this.place_slaves = [];
      this.propagate = { pack: true, grid: true };
      this.grid_columns = {};
      this.grid_rows = {};
      this.req_w = 1;
      this.req_h = 1;
      this.x = 0;
      this.y = 0;
      this.width = 1;
      this.height = 1;
      this.mapped = false;
      this.last_geometry = null;
      this.bindtags = null;
      if (parent !== null && parent !== undefined) parent.children.push(this);
    }

    get name() {
      const parts = this.path.split(`.`);
      return parts[parts.length - 1] || `.`;
    }

    get toplevel() {
      let w = this;
      while (!w.is_toplevel) w = w.parent;
      return w;
    }

    get_bindtags() {
      if (this.bindtags !== null) return this.bindtags;
      const top = this.toplevel.path;
      if (this.is_toplevel) return [this.path, this.tk_class, `all`];
      return [this.path, this.tk_class, top, `all`];
    }

    // ---- options -------------------------------------------------------------------

    _canonical(name) {
      if (!name.startsWith(`-`)) throw new TclError(`unknown option "${name}"`);
      let key = name.slice(1);
      key = ALIASES[key] ?? this.EXTRA_ALIASES[key] ?? key;
      if (!(key in this.OPTIONS)) {
        // Tk accepts unique abbreviations of option names.
        const matches = key ? Object.keys(this.OPTIONS).filter((k) => k.startsWith(key)) : [];
        if (matches.length !== 1) throw new TclError(`unknown option "${name}"`);
        key = matches[0];
      }
      return key;
    }

    configure(args, creating = false) {
      if (args.length % 2) {
        const name = this._canonical(args[args.length - 1]);
        throw new TclError(`value for "-${name}" missing`);
      }
      const changed = [];
      for (let i = 0; i < args.length; i += 2) {
        const key = this._canonical(to_str(args[i]));
        const value = args[i + 1];
        if (key === `class` && !creating) {
          throw new TclError(`can't modify -class option after widget is created`);
        }
        if (this.OPTIONS[key].kind === `image` && to_str(value)) {
          this.app.images.get(to_str(value)); // raises: image "x" doesn't exist
        }
        this.set_option(key, convert(this.OPTIONS[key], value));
        changed.push(key);
      }
      this.options_changed(changed);
    }

    set_option(key, value) {
      this.options[key] = value;
    }

    options_changed(keys) {
      this.app.schedule_layout();
    }

    created() {}

    geometry_changed() {}

    extra_ops() {
      return [];
    }

    cget(name) {
      const key = this._canonical(to_str(name));
      return this.options[key];
    }

    option_info(key) {
      const option = this.OPTIONS[key];
      return [`-` + key, option.db, option.klass, option.default, this.options[key]];
    }

    configure_info(name = null) {
      if (name !== null && name !== undefined) {
        const alias = to_str(name).slice(1);
        if (alias in ALIASES) return [`-` + alias, `-` + ALIASES[alias]];
        return this.option_info(this._canonical(to_str(name)));
      }
      const result = Object.keys(this.OPTIONS).sort().map((key) => this.option_info(key));
      for (const [a, t] of Object.entries(ALIASES)) {
        if (t in this.OPTIONS) result.push([`-` + a, `-` + t]);
      }
      result.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      return result;
    }

    // ---- widget command ------------------------------------------------------------

    command(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} option ?arg ...?"`);
      const sub = to_str(args[0]);
      const rest = args.slice(1);
      if (sub === `configure`) {
        if (!rest.length) return this.configure_info();
        if (rest.length === 1) return this.configure_info(rest[0]);
        this.configure(rest);
        return ``;
      }
      if (sub === `cget`) {
        if (rest.length !== 1) throw new TclError(`wrong # args: should be "${this.path} cget option"`);
        return this.cget(rest[0]);
      }
      const handler = this[`cmd_${sub}`];
      if (typeof handler !== `function`) {
        throw new TclError(`bad option "${sub}": must be ${this.subcommand_list()}`);
      }
      return handler.call(this, rest);
    }

    subcommand_list() {
      const names = [`cget`, `configure`];
      let proto = Object.getPrototypeOf(this);
      while (proto && proto !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (key.startsWith(`cmd_`) && typeof this[key] === `function` && !names.includes(key.slice(4))) {
            names.push(key.slice(4));
          }
        }
        proto = Object.getPrototypeOf(proto);
      }
      names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const named = names.filter((n) => n !== `cget` && n !== `configure`);
      const all = [`cget`, `configure`, ...named];
      return all.slice(0, -1).join(`, `) + `, or ` + all[all.length - 1];
    }

    // ---- geometry ------------------------------------------------------------------

    border_inset() {
      return (this.options.borderwidth ?? 0) + (this.options.highlightthickness ?? 0);
    }

    internal_border() {
      const inset = this.border_inset();
      return [inset + (this.options.padx ?? 0), inset + (this.options.pady ?? 0)];
    }

    borders() {
      const [left, top] = this.internal_border();
      return [left, top, left, top];
    }

    content_request() {
      const width = this.options.width ?? 0;
      const height = this.options.height ?? 0;
      return [width > 0 ? width : 1, height > 0 ? height : 1];
    }

    // ---- lifecycle -----------------------------------------------------------------

    on_destroy() {}

    render() {
      return { kind: `frame` };
    }
  }

  class Frame extends Widget {
    static tk_class = `Frame`;
    static OPTIONS = FRAME_OPTIONS;

    render() {
      const o = this.options;
      return {
        kind: `frame`,
        bg: o.background,
        relief: o.relief,
        bd: o.borderwidth,
        hl: o.highlightthickness,
      };
    }
  }

  class Toplevel extends Frame {
    static tk_class = `Toplevel`;
    static OPTIONS = TOPLEVEL_OPTIONS;
    static is_toplevel = true;

    constructor(app, path, parent) {
      super(app, path, parent);
      this.wm = {
        title: path === `.` ? `tk` : ``,
        geometry: null,
        position: null,
        resizable: [1, 1],
        minsize: [1, 1],
        maxsize: [100000, 100000],
        state: `normal`,
        protocols: {},
        attributes: {
          "-alpha": 1, "-topmost": 0, "-disabled": 0,
          "-toolwindow": 0, "-fullscreen": 0, "-transparentcolor": ``,
        },
        iconname: ``,
        transient: ``,
        overrideredirect: 0,
      };
    }

    render() {
      const props = super.render();
      // Like Tk: the root window follows the background of the ttk theme.
      props.bg = this.app.ttk.background;
      return props;
    }
  }

  class TextWidget extends Widget {
    /* Shared logic of label-like widgets (text, textvariable, font). */

    KIND = `label`;

    constructor(app, path, parent) {
      super(app, path, parent);
      this._linked_var = null;
    }

    get text() {
      const variable = this.options.textvariable;
      if (variable) return to_str(this.app.getvar_default(variable, ``));
      return this.options.text;
    }

    options_changed(keys) {
      if (keys.includes(`textvariable`)) this.app.link_variable(this, this.options.textvariable);
      super.options_changed(keys);
    }

    variable_changed(name) {
      this.app.schedule_layout();
    }

    created() {
      if (this.options.textvariable) this.app.link_variable(this, this.options.textvariable);
    }

    on_destroy() {
      this.app.unlink_widget(this);
    }

    get font() {
      return this.app.fonts.get(this.options.font);
    }

    text_layout() {
      return this.font.layout(this.text, this.options.wraplength ?? 0);
    }

    _dlu() {
      const font = this.font;
      const sample = `abcdefghijklmnopqurstuvwzyABCDEFGHIJKLMNOPQURSTUVWZY`;
      const avg = Math.floor((font.measure(sample) + 26) / 52);
      return [avg, avg / 4.0, font.linespace / 8.0];
    }

    image() {
      const name = this.options.image;
      if (name && this.app.images.exists(name)) {
        const image = this.app.images.get(name);
        return image.width && image.height ? image : image;
      }
      return null;
    }

    compound_mode() {
      if (this.image() !== null && this.text && (this.options.compound ?? `none`) !== `none`) {
        return this.options.compound;
      }
      return null;
    }

    inset() {
      const extra =
        [`button`, `check`, `radio`].includes(this.KIND) &&
        (this.KIND !== `button` || this.image() === null || this.compound_mode())
          ? 1
          : 0;
      return this.options.highlightthickness + this.options.borderwidth + extra;
    }

    indicator_space() {
      return 0;
    }

    content_request() {
      const o = this.options;
      const font = this.font;
      const [, text_w, text_h] = this.text_layout();
      const [avg, hdlu, vdlu] = this._dlu();
      const kind = this.KIND;
      let width;
      let height;
      if (kind === `button`) {
        width = text_w + Math.floor(0.5 + 6 * hdlu);
        height = text_h + Math.floor(0.5 + 6 * vdlu);
        width -= 10;
        height -= 10;
      } else if (kind === `label`) {
        width = text_w;
        height = text_h ? text_h : font.linespace;
      } else {
        width = text_w;
        height = text_h + Math.floor(0.5 + 2.0 * vdlu) - 4;
      }
      if (o.width > 0) width = o.width * avg;
      if (o.height > 0) {
        height = o.height * font.linespace;
        if (kind === `button`) height += Math.floor(0.5 + 6 * vdlu) - 10;
        else if ([`check`, `radio`].includes(kind)) height += Math.floor(0.5 + 2.0 * vdlu) - 4;
      }
      const image = this.image();
      const compound = this.compound_mode();
      if (image !== null && compound) {
        const iw = image.width;
        const ih = image.height;
        if (compound === `top` || compound === `bottom`) {
          width = Math.max(width, iw);
          height += ih + o.pady;
        } else if (compound === `left` || compound === `right`) {
          width = Math.max(width, iw + text_w + o.padx);
          height = Math.max(height, ih);
        } else {
          width = Math.max(width, iw);
          height = Math.max(height, ih);
        }
        width = o.width > 0 ? o.width : width;
        height = o.height > 0 ? o.height : height;
        width += 2 * o.padx;
        height += 2 * o.pady;
      } else if (image !== null) {
        width = o.width > 0 ? o.width : image.width;
        height = o.height > 0 ? o.height : image.height;
      } else {
        width += 2 * o.padx;
        height += 2 * o.pady;
      }
      if ([`check`, `radio`].includes(kind) && o.indicatoron) {
        const box = 13;
        height = Math.max(height, box);
        width += box + Math.floor(0.5 + 3.0 * hdlu);
      }
      const inset = this.inset();
      return [width + 2 * inset, height + 2 * inset];
    }

    content_boxes() {
      const o = this.options;
      const image = this.image();
      const compound = this.compound_mode();
      const [lines, text_w, text_h] = this.text_layout();
      if (image === null) {
        const [l, x, y, w, h] = this.text_box();
        return [l, [x, y, w, h], null];
      }
      const iw = image.width;
      const ih = image.height;
      let block_w;
      let block_h;
      if (!compound) {
        block_w = iw;
        block_h = ih;
      } else if (compound === `top` || compound === `bottom`) {
        block_w = Math.max(iw, text_w);
        block_h = ih + o.pady + text_h;
      } else if (compound === `left` || compound === `right`) {
        block_w = iw + o.padx + text_w;
        block_h = Math.max(ih, text_h);
      } else {
        block_w = Math.max(iw, text_w);
        block_h = Math.max(ih, text_h);
      }
      const [bx, by] = this._anchor_block(block_w, block_h, !!compound);
      if (!compound) return [[], null, [bx, by, iw, ih]];
      let image_box;
      let text_box;
      if (compound === `top`) {
        image_box = [bx + Math.trunc((block_w - iw) / 2), by, iw, ih];
        text_box = [bx + Math.trunc((block_w - text_w) / 2), by + ih + o.pady, text_w, text_h];
      } else if (compound === `bottom`) {
        text_box = [bx + Math.trunc((block_w - text_w) / 2), by, text_w, text_h];
        image_box = [bx + Math.trunc((block_w - iw) / 2), by + text_h + o.pady, iw, ih];
      } else if (compound === `left`) {
        image_box = [bx, by + Math.trunc((block_h - ih) / 2), iw, ih];
        text_box = [bx + iw + o.padx, by + Math.trunc((block_h - text_h) / 2), text_w, text_h];
      } else if (compound === `right`) {
        text_box = [bx, by + Math.trunc((block_h - text_h) / 2), text_w, text_h];
        image_box = [bx + text_w + o.padx, by + Math.trunc((block_h - ih) / 2), iw, ih];
      } else {
        image_box = [bx + Math.trunc((block_w - iw) / 2), by + Math.trunc((block_h - ih) / 2), iw, ih];
        text_box = [bx + Math.trunc((block_w - text_w) / 2), by + Math.trunc((block_h - text_h) / 2), text_w, text_h];
      }
      return [lines, text_box, image_box];
    }

    _anchor_block(block_w, block_h, pad = true) {
      const o = this.options;
      const inset = this.inset();
      const indicator = this.indicator_width();
      const [pad_x, pad_y] = pad ? [o.padx, o.pady] : [0, 0];
      const avail_x0 = inset + pad_x + indicator;
      const avail_w = this.width - 2 * inset - 2 * pad_x - indicator;
      const avail_y0 = inset + pad_y;
      const avail_h = this.height - 2 * inset - 2 * pad_y;
      const a = o.anchor;
      let x;
      if ([`nw`, `w`, `sw`].includes(a)) x = avail_x0;
      else if ([`ne`, `e`, `se`].includes(a)) x = avail_x0 + avail_w - block_w;
      else x = avail_x0 + Math.trunc((avail_w - block_w) / 2);
      let y;
      if ([`nw`, `n`, `ne`].includes(a)) y = avail_y0;
      else if ([`sw`, `s`, `se`].includes(a)) y = avail_y0 + avail_h - block_h;
      else y = avail_y0 + Math.trunc((avail_h - block_h) / 2);
      return [x, y];
    }

    text_box() {
      const o = this.options;
      const [lines, text_w, text_h] = this.text_layout();
      const inset = this.inset();
      const indicator = this.indicator_width();
      const pad_x = o.padx;
      const pad_y = o.pady;
      const avail_x0 = inset + pad_x + indicator;
      const avail_w = this.width - 2 * inset - 2 * pad_x - indicator;
      const avail_y0 = inset + pad_y;
      const avail_h = this.height - 2 * inset - 2 * pad_y;
      const a = o.anchor;
      let x;
      if ([`nw`, `w`, `sw`].includes(a)) x = avail_x0;
      else if ([`ne`, `e`, `se`].includes(a)) x = avail_x0 + avail_w - text_w;
      else x = avail_x0 + Math.trunc((avail_w - text_w) / 2);
      let y;
      if ([`nw`, `n`, `ne`].includes(a)) y = avail_y0;
      else if ([`sw`, `s`, `se`].includes(a)) y = avail_y0 + avail_h - text_h;
      else y = avail_y0 + Math.trunc((avail_h - text_h) / 2);
      return [lines, x, y, text_w, text_h];
    }

    indicator_width() {
      return 0;
    }

    state_colors() {
      const o = this.options;
      let fg = o.foreground;
      let bg = o.background;
      if (o.state === `disabled`) fg = o.disabledforeground;
      else if (o.state === `active`) {
        fg = o.activeforeground;
        bg = o.activebackground;
      }
      return [fg, bg];
    }

    render() {
      const o = this.options;
      const [lines, text_box, image_box] = this.content_boxes();
      const [tx, ty, tw] = text_box ?? [0, 0, 0];
      const [fg, bg] = this.state_colors();
      const image = this.image();
      let extra;
      if (image !== null && image_box !== null) {
        extra = {
          img: image.url(), ix_img: image_box[0], iy_img: image_box[1],
          iw_img: image_box[2], ih_img: image_box[3],
        };
      } else {
        extra = { img: `` };
      }
      return {
        ...extra,
        kind: this.KIND,
        bg,
        fg,
        relief: o.relief,
        bd: o.borderwidth,
        hl: o.highlightthickness,
        font: this.font.css,
        underline_font: this.font.underline ? 1 : 0,
        lines,
        tx,
        ty,
        tw,
        lh: this.font.linespace,
        justify: o.justify,
        underline: o.underline,
        disabled: o.state === `disabled`,
      };
    }
  }

  class Label extends TextWidget {
    static tk_class = `Label`;
    static OPTIONS = LABEL_OPTIONS;
    KIND = `label`;
  }

  class Button extends TextWidget {
    static tk_class = `Button`;
    static OPTIONS = BUTTON_OPTIONS;
    KIND = `button`;

    cmd_invoke(args) {
      if (this.options.state === `disabled`) return ``;
      return this.app.eval_script(this.options.command);
    }

    cmd_flash(args) {
      return ``;
    }
  }

  class Toggle extends TextWidget {
    /* Checkbutton and Radiobutton share the variable link and indicator. */

    KIND = `check`;
    DEFAULT_VARIABLE = null;

    variable_name() {
      return this.options.variable;
    }

    created() {
      if (!this.options.variable) this.options.variable = this.DEFAULT_VARIABLE || this.name;
      this.app.link_variable(this, this.options.variable);
      this.init_variable();
    }

    options_changed(keys) {
      if (keys.includes(`variable`) && this.options.variable && this.app.widgets.get(this.path) === this) {
        this.app.link_variable(this, this.options.variable);
        this.init_variable();
      }
      super.options_changed(keys);
    }

    variable_changed(name) {
      this.app.schedule_render();
    }

    indicator_width() {
      if (!this.options.indicatoron) return 0;
      const [, hdlu] = this._dlu();
      return 13 + Math.floor(0.5 + 3.0 * hdlu);
    }

    render() {
      const props = super.render();
      props.selected = this.is_selected();
      props.indicator = !!this.options.indicatoron;
      props.selectcolor = this.options.selectcolor;
      const inset = this.inset();
      props.ix = inset + this.options.padx;
      props.iy = Math.trunc((this.height - 13) / 2);
      props.pressed = this.options.state === `active`;
      return props;
    }

    cmd_invoke(args) {
      if (this.options.state === `disabled`) return ``;
      this.toggle_on_invoke();
      return this.app.eval_script(this.options.command);
    }
  }

  class Checkbutton extends Toggle {
    static tk_class = `Checkbutton`;
    static OPTIONS = CHECK_OPTIONS;
    KIND = `check`;

    init_variable() {
      const name = this.variable_name();
      if (!this.app.var_exists(name)) this.app.setvar(name, this.options.offvalue);
    }

    is_selected() {
      const value = this.app.getvar_default(this.variable_name(), null);
      return value !== null && value !== undefined && to_str(value) === to_str(this.options.onvalue);
    }

    toggle_on_invoke() {
      const o = this.options;
      this.app.setvar(this.variable_name(), this.is_selected() ? o.offvalue : o.onvalue);
    }

    cmd_select(args) {
      this.app.setvar(this.variable_name(), this.options.onvalue);
      return ``;
    }

    cmd_deselect(args) {
      this.app.setvar(this.variable_name(), this.options.offvalue);
      return ``;
    }

    cmd_toggle(args) {
      this.toggle_on_invoke();
      return ``;
    }

    cmd_flash(args) {
      return ``;
    }
  }

  class Radiobutton extends Toggle {
    static tk_class = `Radiobutton`;
    static OPTIONS = RADIO_OPTIONS;
    KIND = `radio`;
    DEFAULT_VARIABLE = `selectedButton`;

    init_variable() {
      const name = this.variable_name();
      if (!this.app.var_exists(name)) this.app.setvar(name, ``);
    }

    is_selected() {
      const value = this.app.getvar_default(this.variable_name(), null);
      return value !== null && value !== undefined && to_str(value) === to_str(this.options.value);
    }

    toggle_on_invoke() {
      this.app.setvar(this.variable_name(), this.options.value);
    }

    cmd_select(args) {
      this.toggle_on_invoke();
      return ``;
    }

    cmd_deselect(args) {
      if (this.is_selected()) this.app.setvar(this.variable_name(), ``);
      return ``;
    }

    cmd_flash(args) {
      return ``;
    }
  }

  class Entry extends Widget {
    static tk_class = `Entry`;
    static OPTIONS = ENTRY_OPTIONS;
    static EXTRA_ALIASES = ENTRY_ALIASES;

    constructor(app, path, parent) {
      super(app, path, parent);
      this._value = ``;
      this.cursor = 0;
      this.selection = null;
      this.anchor = 0;
    }

    get value() {
      const variable = this.options.textvariable;
      if (variable) return to_str(this.app.getvar_default(variable, ``));
      return this._value;
    }

    set_value(value) {
      this._value = value;
      const variable = this.options.textvariable;
      if (variable) this.app.setvar(variable, value, this);
      this.cursor = Math.min(this.cursor, value.length);
      this.app.schedule_render();
    }

    options_changed(keys) {
      if (keys.includes(`textvariable`)) {
        const variable = this.options.textvariable;
        this.app.link_variable(this, variable);
        if (variable && !this.app.var_exists(variable)) this.app.setvar(variable, this._value);
      }
      super.options_changed(keys);
    }

    variable_changed(name) {
      this.cursor = Math.min(this.cursor, this.value.length);
      this.app.schedule_render();
    }

    created() {
      const variable = this.options.textvariable;
      if (variable) {
        this.app.link_variable(this, variable);
        if (!this.app.var_exists(variable)) this.app.setvar(variable, ``);
      }
    }

    on_destroy() {
      this.app.unlink_widget(this);
    }

    get font() {
      return this.app.fonts.get(this.options.font);
    }

    inset() {
      return this.options.highlightthickness + this.options.borderwidth + 1;
    }

    content_request() {
      const font = this.font;
      const inset = this.inset();
      const height = font.linespace + 2 * inset;
      const avg = font.measure(`0`) || 1;
      let width;
      if (this.options.width > 0) width = this.options.width * avg + 2 * inset;
      else if (this.options.width === 0) width = font.measure(this.value) + 2 * inset;
      else width = avg + 2 * inset;
      return [width, height];
    }

    editable() {
      return this.options.state === `normal`;
    }

    // ---- indices -------------------------------------------------------------------

    index(spec) {
      const s = to_str(spec);
      const n = this.value.length;
      if (s === `end`) return n;
      if (s === `insert`) return this.cursor;
      if (s === `anchor`) return this.anchor;
      if (s === `sel.first` || s === `sel.last`) {
        if (!this.selection) throw new TclError(`selection isn't in widget ` + this.path);
        return this.selection[s === `sel.first` ? 0 : 1];
      }
      if (s.startsWith(`@`)) {
        const x = get_int(s.slice(1)) - this.inset();
        const text = this.value;
        for (let i = 0; i <= n; i++) {
          if (this.font.measure(text.slice(0, i)) >= x) return i;
        }
        return n;
      }
      let i;
      try {
        i = get_int(s);
      } catch {
        throw new TclError(`bad entry index "${s}"`);
      }
      return Math.max(0, Math.min(i, n));
    }

    // ---- widget commands -----------------------------------------------------------

    cmd_get(args) {
      return this.value;
    }

    cmd_insert(args) {
      if (args.length !== 2) throw new TclError(`wrong # args: should be "${this.path} insert index text"`);
      if (!this.editable()) return ``;
      const i = this.index(args[0]);
      const text = to_str(args[1]);
      const value = this.value;
      if (this.cursor >= i) this.cursor += text.length;
      this.set_value(value.slice(0, i) + text + value.slice(i));
      return ``;
    }

    cmd_delete(args) {
      if (args.length < 1 || args.length > 2) {
        throw new TclError(`wrong # args: should be "${this.path} delete firstIndex ?lastIndex?"`);
      }
      if (!this.editable()) return ``;
      const first = this.index(args[0]);
      const last = args.length === 2 ? this.index(args[1]) : first + 1;
      if (last <= first) return ``;
      const value = this.value;
      if (this.cursor > first) this.cursor = Math.max(first, this.cursor - (last - first));
      this.selection = null;
      this.set_value(value.slice(0, first) + value.slice(last));
      return ``;
    }

    cmd_icursor(args) {
      this.cursor = this.index(args[0]);
      this.app.schedule_render();
      return ``;
    }

    cmd_index(args) {
      return this.index(args[0]);
    }

    cmd_selection(args) {
      const sub = args.length ? to_str(args[0]) : ``;
      if (sub === `range`) {
        const first = this.index(args[1]);
        const last = this.index(args[2]);
        this.selection = last > first ? [first, last] : null;
      } else if (sub === `clear`) {
        this.selection = null;
      } else if (sub === `present`) {
        return this.selection ? 1 : 0;
      } else if (sub === `from`) {
        this.anchor = this.index(args[1]);
      } else if (sub === `to`) {
        const last = this.index(args[1]);
        const first = this.anchor;
        this.selection = first !== last ? [Math.min(first, last), Math.max(first, last)] : null;
      } else if (sub === `adjust`) {
        const last = this.index(args[1]);
        this.selection = [Math.min(this.anchor, last), Math.max(this.anchor, last)];
      } else {
        throw new TclError(
          `bad selection option "${sub}": must be adjust, clear, element, from, present, range, or to`,
        );
      }
      this.app.schedule_render();
      return ``;
    }

    cmd_xview(args) {
      if (!args.length) return [0, 1];
      return ``;
    }

    cmd_validate(args) {
      return 1;
    }

    cmd_scan(args) {
      return ``;
    }

    cmd_bbox(args) {
      const i = this.index(args[0]);
      const x = this.inset() + this.font.measure(this.value.slice(0, i));
      return [x, this.inset(), this.font.measure(this.value.slice(i, i + 1)) || 1, this.font.linespace];
    }

    render() {
      const o = this.options;
      const state = o.state;
      let bg = o.background;
      let fg = o.foreground;
      if (state === `disabled`) {
        bg = o.disabledbackground;
        fg = o.disabledforeground;
      } else if (state === `readonly`) {
        bg = o.readonlybackground;
      }
      return {
        kind: `entry`,
        bg,
        fg,
        relief: o.relief,
        bd: o.borderwidth,
        hl: o.highlightthickness,
        font: this.font.css,
        value: this.value,
        show: o.show,
        justify: o.justify,
        state,
        pad: this.inset() - o.borderwidth - o.highlightthickness,
        insertcolor: o.insertbackground,
        selectbg: o.selectbackground,
        selectfg: o.selectforeground,
        cursor: this.cursor,
        selection: this.selection ? this.selection.slice() : null,
      };
    }
  }

  const WIDGET_CLASSES = {
    frame: Frame,
    toplevel: Toplevel,
    label: Label,
    button: Button,
    checkbutton: Checkbutton,
    radiobutton: Radiobutton,
    entry: Entry,
  };

  ns.Option = Option;
  ns.options = options;
  ns.merge_options = merge_options;
  ns.without = without;
  ns.ALIASES = ALIASES;
  ns.convert = convert;
  ns.FRAME_OPTIONS = FRAME_OPTIONS;
  ns.TOPLEVEL_OPTIONS = TOPLEVEL_OPTIONS;
  ns.LABEL_OPTIONS = LABEL_OPTIONS;
  ns.BUTTON_OPTIONS = BUTTON_OPTIONS;
  ns.CHECK_OPTIONS = CHECK_OPTIONS;
  ns.RADIO_OPTIONS = RADIO_OPTIONS;
  ns.ENTRY_OPTIONS = ENTRY_OPTIONS;
  ns.ENTRY_ALIASES = ENTRY_ALIASES;
  ns.Widget = Widget;
  ns.Frame = Frame;
  ns.Toplevel = Toplevel;
  ns.TextWidget = TextWidget;
  ns.Label = Label;
  ns.Button = Button;
  ns.Checkbutton = Checkbutton;
  ns.Radiobutton = Radiobutton;
  ns.Entry = Entry;
  ns.WIDGET_CLASSES = WIDGET_CLASSES;
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// widgets_more.js
// ============================================================

(function (ns) {
  "use strict";
  var css_color = ns.css_color;
  var TclError = ns.TclError;
  var get_double = ns.get_double;
  var get_int = ns.get_int;
  var to_str = ns.to_str;
  var split_list = ns.split_list;
  var ENTRY_OPTIONS = ns.ENTRY_OPTIONS;
  var FRAME_OPTIONS = ns.FRAME_OPTIONS;
  var LABEL_OPTIONS = ns.LABEL_OPTIONS;
  var Entry = ns.Entry;
  var Frame = ns.Frame;
  var TextWidget = ns.TextWidget;
  var Widget = ns.Widget;
  var options = ns.options;
  var merge_options = ns.merge_options;

  /**
   * LabelFrame, Message, Listbox, Scrollbar, Scale and Spinbox.
   *
   * Defaults follow Tk 8.6 on Windows (win/tkWinDefault.h); geometry follows
   * generic/tkFrame.c, tkMessage.c, tkListbox.c, tkScale.c and tkEntry.c.
   *
   * JS port of pythonny_tk/widgets_more.py.
   */


  function _fraction(value) {
    return parseFloat(value.toPrecision(6));
  }

  class Scrollable {
    /* Reports view changes through -xscrollcommand / -yscrollcommand. */

    init_scroll() {
      this._reported = { x: null, y: null };
    }

    scroll_fractions(axis) {
      return [0, 1];
    }

    notify_scroll() {
      for (const axis of [`x`, `y`]) {
        const command = this.options[axis + `scrollcommand`];
        if (!command) continue;
        const [first, last] = this.scroll_fractions(axis);
        const current = [_fraction(first), _fraction(last)];
        const prev = this._reported[axis];
        if (!prev || prev[0] !== current[0] || prev[1] !== current[1]) {
          this._reported[axis] = current;
          this.app._run_background(command, current);
        }
      }
    }
  }

  function parse_view_args(args) {
    const sub = to_str(args[0]);
    if (sub === `moveto`) return [`moveto`, get_double(args[1]), null];
    if (sub === `scroll`) {
      const what = to_str(args[2]);
      if (![`units`, `pages`, `pixels`].includes(what)) {
        throw new TclError(`bad argument "${what}": must be pages, pixels, or units`);
      }
      return [`scroll`, get_double(args[1]), what];
    }
    throw new TclError(`bad option "${sub}": must be moveto or scroll`);
  }

  // ---- LabelFrame ----------------------------------------------------------------------

  class LabelFrame extends Frame {
    static tk_class = `Labelframe`;
    static OPTIONS = merge_options(
      FRAME_OPTIONS,
      options(
        [`borderwidth`, `borderWidth`, `BorderWidth`, 2, `pixels`],
        [`class`, `class`, `Class`, `Labelframe`],
        [`font`, `font`, `Font`, `TkDefaultFont`, `font`],
        [`foreground`, `foreground`, `Foreground`, `SystemButtonText`, `color`],
        [`labelanchor`, `labelAnchor`, `LabelAnchor`, `nw`],
        [`labelwidget`, `labelWidget`, `LabelWidget`, ``],
        [`relief`, `relief`, `Relief`, `groove`, `relief`],
        [`text`, `text`, `Text`, ``],
      ),
    );

    get font() {
      return this.app.fonts.get(this.options.font);
    }

    label_size() {
      const text = this.options.text;
      if (!text) return [0, 0];
      const [, w, h] = this.font.layout(text);
      return [w + 2, h + 2];
    }

    internal_border() {
      const o = this.options;
      const left = o.highlightthickness + o.borderwidth + o.padx;
      let top = o.highlightthickness + o.borderwidth + o.pady;
      const [, label_h] = this.label_size();
      if (label_h) top += label_h - o.borderwidth;
      return [left, top];
    }

    borders() {
      const [left, top] = this.internal_border();
      const o = this.options;
      return [left, top, left, o.highlightthickness + o.borderwidth + o.pady];
    }

    content_request() {
      const [width, height] = super.content_request();
      const [label_w, label_h] = this.label_size();
      const o = this.options;
      const padding = o.highlightthickness + (o.borderwidth > 0 ? o.borderwidth + 4 : 0);
      return [
        Math.max(width, label_w + 2 * padding),
        Math.max(height, label_h + o.borderwidth + o.highlightthickness),
      ];
    }

    render() {
      const props = super.render();
      const [label_w, label_h] = this.label_size();
      const o = this.options;
      Object.assign(props, {
        kind: `labelframe`,
        label: o.text,
        font: this.font.css,
        fg: o.foreground,
        lw: label_w,
        lh: label_h,
        lx: o.highlightthickness + o.borderwidth + 4,
        ly: o.highlightthickness,
        linespace: this.font.linespace,
      });
      return props;
    }
  }

  // ---- Message -------------------------------------------------------------------------

  class Message extends TextWidget {
    static tk_class = `Message`;
    static OPTIONS = options(
      [`anchor`, `anchor`, `Anchor`, `center`, `anchor`],
      [`aspect`, `aspect`, `Aspect`, 150, `int`],
      [`background`, `background`, `Background`, `SystemButtonFace`, `color`],
      [`borderwidth`, `borderWidth`, `BorderWidth`, 1, `pixels`],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`font`, `font`, `Font`, `TkDefaultFont`, `font`],
      [`foreground`, `foreground`, `Foreground`, `SystemButtonText`, `color`],
      [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
      [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
      [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 0, `pixels`],
      [`justify`, `justify`, `Justify`, `left`, `justify`],
      [`padx`, `padX`, `Pad`, -1, `pixels`],
      [`pady`, `padY`, `Pad`, -1, `pixels`],
      [`relief`, `relief`, `Relief`, `flat`, `relief`],
      [`takefocus`, `takeFocus`, `TakeFocus`, `0`],
      [`text`, `text`, `Text`, ``],
      [`textvariable`, `textVariable`, `Variable`, ``],
      [`width`, `width`, `Width`, 0, `pixels`],
    );
    KIND = `label`;

    _pads() {
      const o = this.options;
      const avg = this.font.measure(`0`);
      const pad_x = o.padx >= 0 ? o.padx : Math.floor(avg / 2);
      const pad_y = o.pady >= 0 ? o.pady : Math.floor(this.font.linespace / 4);
      return [pad_x, pad_y];
    }

    wrap_width() {
      const o = this.options;
      const font = this.font;
      if (o.width > 0) return o.width;
      const total = font.measure(this.text.replace(/\n/g, ` `));
      let lower = font.linespace;
      let upper = Math.max(total, font.linespace);
      let width = upper;
      while (lower <= upper) {
        const middle = Math.floor((lower + upper) / 2);
        const [, w, h] = font.layout(this.text, middle);
        const aspect = h ? Math.floor((100 * w) / h) : 0;
        if (aspect < o.aspect) lower = middle + 1;
        else {
          width = middle;
          upper = middle - 1;
        }
      }
      return width;
    }

    text_layout() {
      return this.font.layout(this.text, this.wrap_width());
    }

    content_request() {
      const [, w, h] = this.text_layout();
      const [pad_x, pad_y] = this._pads();
      const inset = this.options.borderwidth + this.options.highlightthickness;
      return [w + 2 * (pad_x + inset), h + 2 * (pad_y + inset)];
    }

    inset() {
      return this.options.borderwidth + this.options.highlightthickness;
    }

    text_box() {
      const [, w, h] = this.text_layout();
      const [pad_x, pad_y] = this._pads();
      const inset = this.inset();
      const anchor = this.options.anchor;
      const avail_w = this.width - 2 * (inset + pad_x);
      const avail_h = this.height - 2 * (inset + pad_y);
      let x = inset + pad_x;
      if ([`ne`, `e`, `se`].includes(anchor)) x += avail_w - w;
      else if (![`nw`, `w`, `sw`].includes(anchor)) x += Math.trunc((avail_w - w) / 2);
      let y = inset + pad_y;
      if (anchor.includes(`s`)) y += avail_h - h;
      else if (!anchor.includes(`n`)) y += Math.trunc((avail_h - h) / 2);
      return [null, x, y, w, h];
    }

    state_colors() {
      return [this.options.foreground, this.options.background];
    }

    render() {
      const o = this.options;
      const [, tx, ty, tw, th] = this.text_box();
      const layout = this.text_layout();
      const lines = layout[0];
      return {
        kind: `label`, bg: o.background, fg: o.foreground, relief: o.relief,
        bd: o.borderwidth, hl: o.highlightthickness, font: this.font.css,
        underline_font: this.font.underline ? 1 : 0, lines, tx, ty, tw,
        lh: this.font.linespace, justify: o.justify, underline: -1, disabled: false,
      };
    }
  }

  // ---- Listbox -------------------------------------------------------------------------

  class Listbox extends Widget {
    static tk_class = `Listbox`;
    static OPTIONS = options(
      [`activestyle`, `activeStyle`, `ActiveStyle`, `dotbox`],
      [`background`, `background`, `Background`, `SystemWindow`, `color`],
      [`borderwidth`, `borderWidth`, `BorderWidth`, 1, `pixels`],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`disabledforeground`, `disabledForeground`, `DisabledForeground`, `SystemDisabledText`, `color`],
      [`exportselection`, `exportSelection`, `ExportSelection`, 1, `bool`],
      [`font`, `font`, `Font`, `TkDefaultFont`, `font`],
      [`foreground`, `foreground`, `Foreground`, `SystemButtonText`, `color`],
      [`height`, `height`, `Height`, 10, `int`],
      [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
      [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
      [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 1, `pixels`],
      [`justify`, `justify`, `Justify`, `left`, `justify`],
      [`listvariable`, `listVariable`, `Variable`, ``],
      [`relief`, `relief`, `Relief`, `sunken`, `relief`],
      [`selectbackground`, `selectBackground`, `Foreground`, `SystemHighlight`, `color`],
      [`selectborderwidth`, `selectBorderWidth`, `BorderWidth`, 0, `pixels`],
      [`selectforeground`, `selectForeground`, `Background`, `SystemHighlightText`, `color`],
      [`selectmode`, `selectMode`, `SelectMode`, `browse`],
      [`setgrid`, `setGrid`, `SetGrid`, 0, `bool`],
      [`state`, `state`, `State`, `normal`],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
      [`width`, `width`, `Width`, 20, `int`],
      [`xscrollcommand`, `xScrollCommand`, `ScrollCommand`, ``],
      [`yscrollcommand`, `yScrollCommand`, `ScrollCommand`, ``],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this.items = [];
      this.item_options = [];
      this.selected = new Set();
      this.active = 0;
      this.anchor = 0;
      this.top = 0;
      Scrollable.prototype.init_scroll.call(this);
    }

    get font() {
      return this.app.fonts.get(this.options.font);
    }

    created() {
      this._link_list_variable();
    }

    options_changed(keys) {
      if (keys.includes(`listvariable`) && this.app.widgets.get(this.path) === this) {
        this._link_list_variable();
      }
      super.options_changed(keys);
    }

    _link_list_variable() {
      const variable = this.options.listvariable;
      this.app.link_variable(this, variable);
      if (variable) {
        if (this.app.var_exists(variable)) this.variable_changed(variable);
        else this.app.setvar(variable, this.items.slice(), this);
      }
    }

    variable_changed(name) {
      this.items = split_list(this.app.getvar_default(name, ``));
      this.item_options = this.items.map(() => ({}));
      this.selected = new Set([...this.selected].filter((i) => i < this.items.length));
      this.app.schedule_layout();
    }

    on_destroy() {
      this.app.unlink_widget(this);
    }

    _items_changed() {
      const variable = this.options.listvariable;
      if (variable) this.app.setvar(variable, this.items.slice(), this);
      this.app.schedule_layout();
    }

    inset() {
      return this.options.highlightthickness + this.options.borderwidth;
    }

    line_height() {
      return this.font.linespace + 1 + 2 * this.options.selectborderwidth;
    }

    visible_lines() {
      return Math.max(1, Math.floor((this.height - 2 * this.inset()) / this.line_height()));
    }

    content_request() {
      const font = this.font;
      const inset = this.inset();
      const o = this.options;
      const width =
        o.width > 0
          ? o.width * font.measure(`0`)
          : Math.max(...this.items.map((i) => font.measure(i)), font.measure(`0`));
      const lines = o.height > 0 ? o.height : Math.max(this.items.length, 1);
      return [width + 2 * inset + 2 * o.selectborderwidth, lines * this.line_height() + 2 * inset];
    }

    scroll_fractions(axis) {
      const n = this.items.length;
      if (axis === `x` || n === 0) return [0, 1];
      return [this.top / n, Math.min(1, (this.top + this.visible_lines()) / n)];
    }

    _clamp_top() {
      this.top = Math.max(0, Math.min(this.top, this.items.length - this.visible_lines()));
    }

    geometry_changed() {
      this._clamp_top();
    }

    index(spec, end_ok = true) {
      const s = to_str(spec);
      const n = this.items.length;
      if (s === `end`) return end_ok ? n : Math.max(n - 1, 0);
      if (s === `active`) return this.active;
      if (s === `anchor`) return this.anchor;
      if (s.startsWith(`@`)) {
        const comma = s.indexOf(`,`);
        if (comma === -1) throw new TclError(`bad listbox index "${s}": must be active, anchor, end, @x,y, or a number`);
        const y = get_int(s.slice(comma + 1));
        return this.nearest(y);
      }
      try {
        return get_int(s);
      } catch {
        throw new TclError(`bad listbox index "${s}": must be active, anchor, end, @x,y, or a number`);
      }
    }

    nearest(y) {
      const i = this.top + Math.trunc((y - this.inset()) / this.line_height());
      return Math.max(0, Math.min(i, this.items.length - 1));
    }

    // ---- widget commands -------------------------------------------------------------

    cmd_insert(args) {
      if (this.options.state === `disabled`) return ``;
      const i = Math.max(0, Math.min(this.index(args[0]), this.items.length));
      const new_items = args.slice(1).map(to_str);
      this.items.splice(i, 0, ...new_items);
      for (let k = 0; k < new_items.length; k++) this.item_options.splice(i, 0, {});
      this.selected = new Set(
        [...this.selected].map((s) => (s >= i ? s + new_items.length : s)),
      );
      this._items_changed();
      return ``;
    }

    cmd_delete(args) {
      if (this.options.state === `disabled`) return ``;
      const first = this.index(args[0]);
      const last = args.length > 1 ? this.index(args[1], false) : first;
      if (first >= this.items.length || last < first) return ``;
      const last_ok = Math.min(last, this.items.length - 1);
      const count = last_ok - first + 1;
      this.items.splice(first, count);
      this.item_options.splice(first, count);
      this.selected = new Set(
        [...this.selected]
          .filter((s) => !(s >= first && s <= last_ok))
          .map((s) => (s > last_ok ? s - count : s)),
      );
      this._clamp_top();
      this._items_changed();
      return ``;
    }

    cmd_get(args) {
      const first = this.index(args[0], false);
      if (args.length === 1) return first >= 0 && first < this.items.length ? this.items[first] : ``;
      const last = this.index(args[1], false);
      return this.items.slice(first, last + 1);
    }

    cmd_size(args) {
      return this.items.length;
    }

    cmd_index(args) {
      return this.index(args[0]);
    }

    cmd_curselection(args) {
      return [...this.selected].sort((a, b) => a - b);
    }

    cmd_nearest(args) {
      return this.nearest(get_int(args[0]));
    }

    cmd_activate(args) {
      if (this.items.length) {
        this.active = Math.max(0, Math.min(this.index(args[0], false), this.items.length - 1));
        this.app.schedule_render();
      }
      return ``;
    }

    cmd_see(args) {
      const i = this.index(args[0], false);
      const visible = this.visible_lines();
      if (i < this.top) this.top = i;
      else if (i >= this.top + visible) this.top = i - visible + 1;
      this._clamp_top();
      this.app.schedule_render();
      return ``;
    }

    cmd_selection(args) {
      const sub = to_str(args[0]);
      if (sub === `anchor`) {
        this.anchor = this.index(args[1], false);
        return ``;
      }
      if (sub === `includes`) return this.selected.has(this.index(args[1])) ? 1 : 0;
      let first = this.index(args[1], false);
      let last = args.length > 2 ? this.index(args[2], false) : first;
      [first, last] = [Math.min(first, last), Math.max(first, last)];
      const rng = [];
      for (let i = first; i <= Math.min(last, this.items.length - 1); i++) rng.push(i);
      if (sub === `set`) for (const i of rng) this.selected.add(i);
      else if (sub === `clear`) for (const i of rng) this.selected.delete(i);
      else throw new TclError(`bad option "${sub}": must be anchor, clear, includes, or set`);
      this.app.schedule_render();
      return ``;
    }

    cmd_yview(args) {
      if (!args.length) return this.scroll_fractions(`y`);
      if (args.length === 1) {
        this.top = this.index(args[0], false);
      } else {
        const [kind, amount, what] = parse_view_args(args);
        if (kind === `moveto`) this.top = Math.trunc(amount * this.items.length + 0.5);
        else {
          let step = 1;
          if (what === `pages`) step = Math.max(1, this.visible_lines() - 1);
          if (what === `pixels`) step = 1 / this.line_height();
          this.top += Math.trunc(amount * step);
        }
      }
      this._clamp_top();
      this.app.schedule_render();
      return ``;
    }

    cmd_xview(args) {
      return !args.length ? [0, 1] : ``;
    }

    cmd_bbox(args) {
      const i = this.index(args[0], false);
      if (!(this.top <= i && i < this.top + this.visible_lines()) || i >= this.items.length) return ``;
      const inset = this.inset();
      return [
        inset, inset + (i - this.top) * this.line_height(),
        this.font.measure(this.items[i]), this.font.linespace,
      ];
    }

    cmd_itemconfigure(args) {
      const i = this.index(args[0], false);
      const opts = this.item_options[i];
      const names = [`background`, `foreground`, `selectbackground`, `selectforeground`];
      const aliases = { bg: `background`, fg: `foreground` };
      if (args.length === 1) return names.map((n) => [`-` + n, ``, ``, ``, opts[n] ?? ``]);
      if (args.length === 2) {
        const raw = to_str(args[1]).slice(1);
        const key = aliases[raw] ?? raw;
        return [`-` + key, ``, ``, ``, opts[key] ?? ``];
      }
      for (let k = 1; k < args.length; k += 2) {
        const raw = to_str(args[k]).slice(1);
        const key = aliases[raw] ?? raw;
        if (!names.includes(key)) throw new TclError(`unknown option "${to_str(args[k])}"`);
        opts[key] = to_str(args[k + 1]);
      }
      this.app.schedule_render();
      return ``;
    }

    cmd_itemcget(args) {
      const i = this.index(args[0], false);
      let key = to_str(args[1]).slice(1);
      key = ({ bg: `background`, fg: `foreground` })[key] ?? key;
      return this.item_options[i][key] ?? ``;
    }

    cmd_scan(args) {
      return ``;
    }

    render() {
      const o = this.options;
      const items = [];
      for (let i = 0; i < this.items.length; i++) {
        const item = { t: this.items[i] };
        const opts = this.item_options[i];
        for (const [key, short] of [
          [`background`, `bg`], [`foreground`, `fg`],
          [`selectbackground`, `sbg`], [`selectforeground`, `sfg`],
        ]) {
          if (opts[key]) item[short] = css_color(opts[key]);
        }
        items.push(item);
      }
      return {
        kind: `listbox`,
        bg: o.background,
        fg: o.state !== `disabled` ? o.foreground : o.disabledforeground,
        relief: o.relief,
        bd: o.borderwidth,
        hl: o.highlightthickness,
        font: this.font.css,
        items,
        selected: [...this.selected].sort((a, b) => a - b),
        active: this.active,
        top: this.top,
        rowh: this.line_height(),
        selectbg: o.selectbackground,
        selectfg: o.selectforeground,
        justify: o.justify,
        focused: this.app.focus_widget === this,
        activestyle: o.activestyle,
      };
    }
  }

  // ---- Scrollbar -----------------------------------------------------------------------

  const SCROLLBAR_WIDTH = 17;

  class Scrollbar extends Widget {
    static tk_class = `Scrollbar`;
    static OPTIONS = options(
      [`activebackground`, `activeBackground`, `Foreground`, `SystemButtonFace`, `color`],
      [`activerelief`, `activeRelief`, `Relief`, `raised`, `relief`],
      [`background`, `background`, `Background`, `SystemButtonFace`, `color`],
      [`borderwidth`, `borderWidth`, `BorderWidth`, 0, `pixels`],
      [`command`, `command`, `Command`, ``],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`elementborderwidth`, `elementBorderWidth`, `BorderWidth`, -1, `pixels`],
      [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
      [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
      [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 0, `pixels`],
      [`jump`, `jump`, `Jump`, 0, `bool`],
      [`orient`, `orient`, `Orient`, `vertical`],
      [`relief`, `relief`, `Relief`, `sunken`, `relief`],
      [`repeatdelay`, `repeatDelay`, `RepeatDelay`, 300, `int`],
      [`repeatinterval`, `repeatInterval`, `RepeatInterval`, 100, `int`],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
      [`troughcolor`, `troughColor`, `Background`, `SystemScrollbar`, `color`],
      [`width`, `width`, `Width`, 10, `pixels`],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this.first = 0;
      this.last = 1;
    }

    set_option(key, value) {
      if (key === `orient`) {
        const v = to_str(value);
        if (v && `horizontal`.startsWith(v)) value = `horizontal`;
        else if (v && `vertical`.startsWith(v)) value = `vertical`;
        else throw new TclError(`bad orientation "${v}": must be vertical or horizontal`);
      }
      super.set_option(key, value);
    }

    get vertical() {
      return this.options.orient === `vertical`;
    }

    content_request() {
      const hl = this.options.highlightthickness;
      const thickness = SCROLLBAR_WIDTH + 2 * hl;
      const length = 2 * SCROLLBAR_WIDTH + 2 * hl + 8;
      return this.vertical ? [thickness, length] : [length, thickness];
    }

    cmd_set(args) {
      if (args.length !== 2) {
        throw new TclError(`wrong # args: should be "${this.path} set firstFraction lastFraction"`);
      }
      const first = Math.max(0, Math.min(1, get_double(args[0])));
      const last = Math.max(first, Math.min(1, get_double(args[1])));
      if (first !== this.first || last !== this.last) {
        this.first = first;
        this.last = last;
        this.app.schedule_render();
      }
      return ``;
    }

    cmd_get(args) {
      return [this.first, this.last];
    }

    cmd_activate(args) {
      return ``;
    }

    cmd_delta(args) {
      const length = (this.vertical ? this.height : this.width) - 2 * SCROLLBAR_WIDTH;
      const dx = get_int(args[0]);
      const dy = get_int(args[1]);
      return (this.vertical ? dy : dx) / Math.max(length, 1);
    }

    cmd_fraction(args) {
      const length = (this.vertical ? this.height : this.width) - 2 * SCROLLBAR_WIDTH;
      const pos = get_int(this.vertical ? args[1] : args[0]) - SCROLLBAR_WIDTH;
      return Math.max(0, Math.min(1, pos / Math.max(length, 1)));
    }

    cmd_identify(args) {
      return ``;
    }

    scroll(words) {
      const command = this.options.command;
      if (command) this.app._run_background(command, words);
    }

    render() {
      const o = this.options;
      return {
        kind: `scrollbar`, bg: o.background, relief: `flat`, bd: 0,
        hl: o.highlightthickness, vertical: this.vertical,
        first: this.first, last: this.last, arrow: SCROLLBAR_WIDTH,
      };
    }
  }

  // ---- Scale ---------------------------------------------------------------------------

  const SPACING = 2;

  class Scale extends Widget {
    static tk_class = `Scale`;
    static OPTIONS = options(
      [`activebackground`, `activeBackground`, `Foreground`, `SystemButtonFace`, `color`],
      [`background`, `background`, `Background`, `SystemButtonFace`, `color`],
      [`bigincrement`, `bigIncrement`, `BigIncrement`, 0, `float`],
      [`borderwidth`, `borderWidth`, `BorderWidth`, 1, `pixels`],
      [`command`, `command`, `Command`, ``],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`digits`, `digits`, `Digits`, 0, `int`],
      [`font`, `font`, `Font`, `TkDefaultFont`, `font`],
      [`foreground`, `foreground`, `Foreground`, `SystemButtonText`, `color`],
      [`from`, `from`, `From`, 0, `float`],
      [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
      [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
      [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 2, `pixels`],
      [`label`, `label`, `Label`, ``],
      [`length`, `length`, `Length`, 100, `pixels`],
      [`orient`, `orient`, `Orient`, `vertical`],
      [`relief`, `relief`, `Relief`, `flat`, `relief`],
      [`repeatdelay`, `repeatDelay`, `RepeatDelay`, 300, `int`],
      [`repeatinterval`, `repeatInterval`, `RepeatInterval`, 100, `int`],
      [`resolution`, `resolution`, `Resolution`, 1, `float`],
      [`showvalue`, `showValue`, `ShowValue`, 1, `bool`],
      [`sliderlength`, `sliderLength`, `SliderLength`, 30, `pixels`],
      [`sliderrelief`, `sliderRelief`, `SliderRelief`, `raised`, `relief`],
      [`state`, `state`, `State`, `normal`, `state`],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
      [`tickinterval`, `tickInterval`, `TickInterval`, 0, `float`],
      [`to`, `to`, `To`, 100, `float`],
      [`troughcolor`, `troughColor`, `Background`, `SystemScrollbar`, `color`],
      [`variable`, `variable`, `Variable`, ``],
      [`width`, `width`, `Width`, 15, `pixels`],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this.value = 0;
    }

    set_option(key, value) {
      if (key === `orient`) {
        const v = to_str(value);
        if (v && `horizontal`.startsWith(v)) value = `horizontal`;
        else if (v && `vertical`.startsWith(v)) value = `vertical`;
        else throw new TclError(`bad orientation: must be horizontal or vertical`);
      } else if ([`from`, `to`, `resolution`, `bigincrement`, `tickinterval`].includes(key)) {
        value = get_double(value);
      }
      super.set_option(key, value);
    }

    created() {
      this.value = this.round(this.options.from);
      this._link();
    }

    options_changed(keys) {
      if (keys.includes(`variable`) && this.app.widgets.get(this.path) === this) this._link();
      if ((keys.includes(`from`) || keys.includes(`to`)) && this.app.widgets.get(this.path) === this) {
        this.value = this.round(this.value);
      }
      super.options_changed(keys);
    }

    _link() {
      const variable = this.options.variable;
      this.app.link_variable(this, variable);
      if (variable) {
        if (this.app.var_exists(variable)) this.variable_changed(variable);
        else this.app.setvar(variable, this.typed(this.value), this);
      }
    }

    variable_changed(name) {
      try {
        this.value = this.round(get_double(this.app.getvar_default(name, 0)));
      } catch {
        // not a number: keep the current value
      }
      this.app.schedule_render();
    }

    on_destroy() {
      this.app.unlink_widget(this);
    }

    get font() {
      return this.app.fonts.get(this.options.font);
    }

    get horizontal() {
      return this.options.orient === `horizontal`;
    }

    round(value) {
      const o = this.options;
      const res = o.resolution;
      if (res > 0) {
        const tick = Math.floor(value / res);
        const rem = value - res * tick;
        value = res * tick + (rem >= res / 2 ? res : 0);
      }
      const low = Math.min(o.from, o.to);
      const high = Math.max(o.from, o.to);
      return Math.max(low, Math.min(high, value));
    }

    decimals() {
      const o = this.options;
      if (o.digits > 0) return Math.max(0, o.digits - 1);
      const res = o.resolution;
      if (res <= 0 || (res >= 1 && Number.isInteger(res))) return 0;
      return Math.max(0, -Math.floor(Math.log10(res)));
    }

    format(value) {
      return value.toFixed(this.decimals());
    }

    typed(value) {
      return this.decimals() === 0 ? Math.round(value) : parseFloat(this.format(value));
    }

    set_value(value, user = false) {
      value = this.round(value);
      if (value === this.value) return;
      this.value = value;
      const variable = this.options.variable;
      if (variable) this.app.setvar(variable, this.typed(value), this);
      const command = this.options.command;
      if (command) {
        this.app.after_counter += 1;
        this.app.idle_scripts.push([
          `after#${this.app.after_counter}`,
          command + " " + this.format(value),
        ]);
      }
      this.app.schedule_render();
    }

    cmd_get(args) {
      return this.format(this.value);
    }

    cmd_set(args) {
      if (this.options.state !== `disabled`) this.set_value(get_double(args[0]));
      return ``;
    }

    cmd_coords(args) {
      const geo = this._geometry();
      const pos = this._slider_center(geo);
      return this.horizontal ? [pos, geo.ty + Math.trunc(geo.tw / 2)] : [geo.tx + Math.trunc(geo.tw / 2), pos];
    }

    cmd_identify(args) {
      return ``;
    }

    _text_width() {
      const o = this.options;
      return Math.max(this.font.measure(this.format(o.from)), this.font.measure(this.format(o.to)));
    }

    content_request() {
      const o = this.options;
      const hl = o.highlightthickness;
      const bd = o.borderwidth;
      const line = this.font.linespace;
      const trough = o.width + 2 * bd;
      if (this.horizontal) {
        let height = trough;
        if (o.label) height += line + SPACING;
        if (o.showvalue) height += line + SPACING;
        if (o.tickinterval) height += line + SPACING;
        return [o.length + 2 * hl, height + 2 * hl];
      }
      let width = trough;
      if (o.showvalue) width += this._text_width() + 2 * SPACING;
      if (o.label) width += this.font.measure(o.label) + 2 * SPACING;
      if (o.tickinterval) width += this._text_width() + 2 * SPACING;
      return [width + 2 * hl, o.length + 2 * hl];
    }

    _geometry() {
      const o = this.options;
      const hl = o.highlightthickness;
      const bd = o.borderwidth;
      const line = this.font.linespace;
      const thickness = o.width + 2 * bd;
      if (this.horizontal) {
        let y = hl;
        const label_y = o.label ? y : null;
        if (o.label) y += line + SPACING;
        const value_y = o.showvalue ? y : null;
        if (o.showvalue) y += line + SPACING;
        return {
          tx: hl, ty: y, tl: this.width - 2 * hl, tw: thickness,
          label_y, value_y, tick_y: y + thickness + SPACING,
        };
      }
      let x = hl;
      const tick_x = o.tickinterval ? x : null;
      if (o.tickinterval) x += this._text_width() + 2 * SPACING;
      const value_x = o.showvalue ? x : null;
      if (o.showvalue) x += this._text_width() + 2 * SPACING;
      return {
        tx: x, ty: hl, tl: this.height - 2 * hl, tw: thickness,
        value_x, tick_x, label_x: x + thickness + SPACING,
      };
    }

    _slider_center(geo) {
      const o = this.options;
      const bd = o.borderwidth;
      const inner = geo.tl - 2 * bd;
      const travel = Math.max(inner - o.sliderlength, 0);
      const span = o.to - o.from;
      const frac = span === 0 ? 0 : (this.value - o.from) / span;
      const start = (this.horizontal ? geo.tx : geo.ty) + bd;
      return Math.trunc(start + o.sliderlength / 2 + frac * travel);
    }

    value_from_pixel(pixel) {
      const o = this.options;
      const geo = this._geometry();
      const bd = o.borderwidth;
      const inner = geo.tl - 2 * bd;
      const travel = Math.max(inner - o.sliderlength, 1);
      const start = (this.horizontal ? geo.tx : geo.ty) + bd + o.sliderlength / 2;
      const frac = Math.max(0, Math.min(1, (pixel - start) / travel));
      return o.from + frac * (o.to - o.from);
    }

    step(direction) {
      const o = this.options;
      const increment = o.resolution || Math.abs(o.to - o.from) / 10;
      const sign = o.to >= o.from ? 1 : -1;
      this.set_value(this.value + direction * sign * increment, true);
    }

    render() {
      const o = this.options;
      const geo = this._geometry();
      const ticks = [];
      if (o.tickinterval) {
        const interval = Math.abs(o.tickinterval) * (o.to >= o.from ? 1 : -1);
        let value = o.from;
        const saved = this.value;
        for (let k = 0; k < 200; k++) {
          if ((interval > 0 && value > o.to + 1e-9) || (interval < 0 && value < o.to - 1e-9)) break;
          this.value = value;
          ticks.push([this._slider_center(geo), this.format(value)]);
          value += interval;
        }
        this.value = saved;
      }
      return {
        kind: `scale`, bg: o.background, fg: o.foreground, relief: o.relief,
        bd: 0, hl: o.highlightthickness, horizontal: this.horizontal,
        font: this.font.css, lh: this.font.linespace, trough: o.troughcolor,
        tbd: o.borderwidth, slider: o.sliderlength, sliderrelief: o.sliderrelief,
        center: this._slider_center(geo),
        value: o.showvalue ? this.format(this.value) : ``,
        label: o.label, ticks, disabled: o.state === `disabled`,
        active: o.state === `active`, ...geo,
      };
    }
  }

  // ---- Spinbox -------------------------------------------------------------------------

  function py_percent_format(fmt, number) {
    return fmt.replace(
      /%([-+ #0]*\d*(?:\.\d+)?)([diouxXeEfFgGcrsa%])/g,
      (match, spec, conv) => {
        if (conv === `%`) return `%`;
        let n;
        if ([`d`, `i`].includes(conv)) n = String(Math.round(Number(number)));
        else if (conv === `s`) return String(number);
        else if (conv === `x`) return Math.round(Number(number)).toString(16);
        else if (conv === `X`) return Math.round(Number(number)).toString(16).toUpperCase();
        else if (conv === `o`) return Math.round(Number(number)).toString(8);
        else if (conv === `u`) return String(Math.round(Number(number)));
        else n = Number(number);
        const widthMatch = /(\d*)(?:\.(\d+))?/.exec(spec);
        const precision = widthMatch && widthMatch[2] !== undefined ? Number(widthMatch[2]) : undefined;
        const width = widthMatch && widthMatch[1] ? Number(widthMatch[1]) : 0;
        let out;
        if ([`e`, `E`, `f`, `F`, `g`, `G`].includes(conv)) {
          if (Number.isNaN(n)) throw new TypeError(`float argument required`);
          const c = conv.toLowerCase();
          out = c === `f` || c === `F` ? n.toFixed(precision ?? 6) : String(n);
          if (conv === `E` || conv === `G`) out = out.toUpperCase();
        } else {
          if (Number.isNaN(n)) throw new TypeError(`not a number`);
          out = String(n);
        }
        return spec.includes(`-`) ? out.padEnd(width, ` `) : out.padStart(width, ` `);
      },
    );
  }

  class Spinbox extends Entry {
    static tk_class = `Spinbox`;
    static OPTIONS = merge_options(
      ENTRY_OPTIONS,
      options(
        [`activebackground`, `activeBackground`, `Background`, `SystemButtonFace`, `color`],
        [`buttonbackground`, `buttonBackground`, `Background`, `SystemButtonFace`, `color`],
        [`buttoncursor`, `buttonCursor`, `Cursor`, ``],
        [`buttondownrelief`, `buttonDownRelief`, `Relief`, `raised`, `relief`],
        [`buttonuprelief`, `buttonUpRelief`, `Relief`, `raised`, `relief`],
        [`command`, `command`, `Command`, ``],
        [`format`, `format`, `Format`, ``],
        [`from`, `from`, `From`, 0, `float`],
        [`increment`, `increment`, `Increment`, 1, `float`],
        [`to`, `to`, `To`, 0, `float`],
        [`values`, `values`, `Values`, ``],
        [`wrap`, `wrap`, `Wrap`, 0, `bool`],
      ),
    );

    set_option(key, value) {
      if ([`from`, `to`, `increment`].includes(key)) value = get_double(value);
      super.set_option(key, value);
    }

    created() {
      super.created();
      if (this.value === ``) {
        const values = split_list(this.options.values);
        const initial = values.length ? values[0] : this._format(this.options.from);
        if (
          values.length ||
          this.options.from !== this.options.to ||
          this.options.from !== 0
        ) {
          this.set_value(initial);
        }
      }
    }

    _format(number) {
      const fmt = this.options.format;
      if (fmt) {
        try {
          return py_percent_format(fmt, number);
        } catch {
          // fall through to the default format
        }
      }
      const o = this.options;
      if (Number.isInteger(o.increment) && Number.isInteger(o.from)) {
        return String(Math.round(number));
      }
      const decimals = Math.max(String(o.increment).split(`.`).pop().length, 1);
      return number.toFixed(decimals);
    }

    button_width() {
      return Math.max(this.font.measure(`0`) + 4, 11);
    }

    content_request() {
      const [width, height] = super.content_request();
      return [width + this.button_width(), height];
    }

    cmd_invoke(args) {
      const element = args.length ? to_str(args[0]) : ``;
      if (![`buttonup`, `buttondown`].includes(element)) {
        throw new TclError(`bad element "${element}": must be buttonup or buttondown`);
      }
      if (this.options.state === `disabled`) return ``;
      this.spin(element === `buttonup` ? 1 : -1);
      return ``;
    }

    spin(direction) {
      const o = this.options;
      const values = split_list(o.values);
      const current = this.value;
      let new_value;
      if (values.length) {
        let i = values.indexOf(current);
        if (i === -1) i = direction > 0 ? -1 : values.length;
        i += direction;
        if (i >= values.length) i = o.wrap ? 0 : values.length - 1;
        else if (i < 0) i = o.wrap ? values.length - 1 : 0;
        new_value = values[i];
      } else {
        let number = parseFloat(current);
        if (Number.isNaN(number)) number = o.from;
        const low = Math.min(o.from, o.to);
        const high = Math.max(o.from, o.to);
        number += direction * o.increment;
        if (number > high) number = o.wrap ? low : high;
        else if (number < low) number = o.wrap ? high : low;
        new_value = this._format(number);
      }
      this.cursor = new_value.length;
      this.set_value(new_value);
      const command = o.command;
      if (command) this.app.eval_script(command);
    }

    cmd_set(args) {
      if (args.length) {
        this.set_value(to_str(args[0]));
        return ``;
      }
      return this.value;
    }

    cmd_identify(args) {
      return `entry`;
    }

    render() {
      const props = super.render();
      Object.assign(props, {
        kind: `spinbox`, bw: this.button_width(), buttonbg: this.options.buttonbackground,
      });
      return props;
    }
  }

  const WIDGETS = {
    labelframe: LabelFrame,
    message: Message,
    listbox: Listbox,
    scrollbar: Scrollbar,
    scale: Scale,
    spinbox: Spinbox,
  };


  ns.parse_view_args = parse_view_args;
  ns.LabelFrame = LabelFrame;
  ns.Message = Message;
  ns.Listbox = Listbox;
  ns.Scrollbar = Scrollbar;
  ns.Scale = Scale;
  ns.Spinbox = Spinbox;
  ns.WIDGETS = WIDGETS;
  ns.Scrollable = Scrollable;
  ns.more = { parse_view_args, LabelFrame, Message, Listbox, Scrollbar, Scale, Spinbox, WIDGETS, Scrollable };
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// menus.js
// ============================================================

(function (ns) {
  "use strict";
  var TclError = ns.TclError;
  var get_int = ns.get_int;
  var to_str = ns.to_str;
  var TextWidget = ns.TextWidget;
  var Widget = ns.Widget;
  var BUTTON_OPTIONS = ns.BUTTON_OPTIONS;
  var options = ns.options;
  var without = ns.without;

  /**
   * Menu and Menubutton (OptionMenu is built from them), menubars and tk_popup.
   *
   * On Windows Tk uses native menus, so the page draws Windows-style menus from
   * the entry list; choosing an entry comes back as an "invoke" of that index.
   *
   * JS port of pythonny_tk/menus.py.
   */


  const _ENTRY_TYPES = [`cascade`, `checkbutton`, `command`, `radiobutton`, `separator`];
  const _ENTRY_OPTIONS = {
    command: [
      `accelerator`, `activebackground`, `activeforeground`, `background`, `bitmap`,
      `columnbreak`, `command`, `compound`, `font`, `foreground`, `hidemargin`, `image`,
      `label`, `state`, `underline`,
    ],
    separator: [`background`, `columnbreak`, `hidemargin`],
  };
  _ENTRY_OPTIONS.cascade = [..._ENTRY_OPTIONS.command, `menu`];
  _ENTRY_OPTIONS.checkbutton = [
    ..._ENTRY_OPTIONS.command,
    `indicatoron`, `offvalue`, `onvalue`, `selectcolor`, `selectimage`, `variable`,
  ];
  _ENTRY_OPTIONS.radiobutton = [
    ..._ENTRY_OPTIONS.command,
    `indicatoron`, `selectcolor`, `selectimage`, `value`, `variable`,
  ];
  _ENTRY_OPTIONS.tearoff = [`background`, `state`];

  class Menu extends Widget {
    static tk_class = `Menu`;
    static OPTIONS = options(
      [`activebackground`, `activeBackground`, `Foreground`, `SystemHighlight`, `color`],
      [`activeborderwidth`, `activeBorderWidth`, `BorderWidth`, 0, `pixels`],
      [`activeforeground`, `activeForeground`, `Background`, `SystemHighlightText`, `color`],
      [`activerelief`, `activeRelief`, `Relief`, `flat`, `relief`],
      [`background`, `background`, `Background`, `SystemMenu`, `color`],
      [`borderwidth`, `borderWidth`, `BorderWidth`, 0, `pixels`],
      [`cursor`, `cursor`, `Cursor`, `arrow`],
      [`disabledforeground`, `disabledForeground`, `DisabledForeground`, `SystemDisabledText`, `color`],
      [`font`, `font`, `Font`, `TkMenuFont`, `font`],
      [`foreground`, `foreground`, `Foreground`, `SystemMenuText`, `color`],
      [`postcommand`, `postCommand`, `Command`, ``],
      [`relief`, `relief`, `Relief`, `flat`, `relief`],
      [`selectcolor`, `selectColor`, `Background`, `SystemMenuText`, `color`],
      [`takefocus`, `takeFocus`, `TakeFocus`, `0`],
      [`tearoff`, `tearOff`, `TearOff`, 1, `bool`],
      [`tearoffcommand`, `tearOffCommand`, `TearOffCommand`, ``],
      [`title`, `title`, `Title`, ``],
      [`type`, `type`, `Type`, `normal`],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this.entries = [];
      this.sent = null;
    }

    created() {
      if (this.options.tearoff) this.entries.push({ type: `tearoff` });
    }

    content_request() {
      return [1, 1];
    }

    // ---- entries ---------------------------------------------------------------------

    index(spec, allow_end = true) {
      const s = to_str(spec);
      const n = this.entries.length;
      if (s === `end` || s === `last`) return n ? n - 1 : `none`;
      if (s === `none`) return `none`;
      if (s === `active`) return `none`;
      if (s.startsWith(`@`)) return `none`;
      let i;
      try {
        i = get_int(s);
      } catch {
        i = null;
      }
      if (i !== null) return n ? Math.max(0, Math.min(i, n - 1)) : `none`;
      for (let k = 0; k < n; k++) {
        if (this.entries[k].label === s) return k;
      }
      for (let k = 0; k < n; k++) {
        if (to_str(this.entries[k].label ?? ``).startsWith(s) && s) return k;
      }
      throw new TclError(`bad menu entry index "${s}"`);
    }

    _entry(spec) {
      const i = this.index(spec);
      if (i === `none`) throw new TclError(`bad menu entry index "${to_str(spec)}"`);
      return this.entries[i];
    }

    _configure_entry(entry, args) {
      if (args.length % 2) {
        throw new TclError(`value for "${to_str(args[args.length - 1])}" missing`);
      }
      const allowed = _ENTRY_OPTIONS[entry.type];
      for (let k = 0; k < args.length; k += 2) {
        const name = args[k];
        const value = args[k + 1];
        const key = to_str(name).replace(/^-/, ``);
        if (!allowed.includes(key)) throw new TclError(`unknown option "${to_str(name)}"`);
        if (key === `image` && to_str(value)) this.app.images.get(value);
        entry[key] = key === `underline` ? get_int(value) : to_str(value);
      }
      if (entry.type === `checkbutton` || entry.type === `radiobutton`) {
        const var_name =
          entry.variable ||
          (entry.type === `checkbutton` ? entry.label : `selectedButton`);
        entry.variable = var_name;
        this.app.link_variable_extra(this, var_name);
        if (entry.type === `checkbutton` && !this.app.var_exists(var_name)) {
          this.app.setvar(var_name, entry.offvalue ?? `0`);
        }
      }
      this.app.schedule_render();
    }

    _new_entry(args) {
      const kind = to_str(args[0]);
      if (!_ENTRY_TYPES.includes(kind)) {
        throw new TclError(
          `bad menu entry type "${kind}": must be cascade, checkbutton, command, radiobutton, or separator`,
        );
      }
      const entry = { type: kind };
      this._configure_entry(entry, args.slice(1));
      return entry;
    }

    cmd_add(args) {
      this.entries.push(this._new_entry(args));
      return ``;
    }

    cmd_insert(args) {
      const i = this.index(args[0]);
      let position = i === `none` ? this.entries.length : i;
      if (to_str(args[0]) === `end`) position = this.entries.length;
      this.entries.splice(position, 0, this._new_entry(args.slice(1)));
      return ``;
    }

    cmd_delete(args) {
      const first = this.index(args[0]);
      const last = args.length > 1 ? this.index(args[1]) : first;
      if (first === `none` || last === `none`) return ``;
      this.entries.splice(first, last + 1 - first);
      this.app.schedule_render();
      return ``;
    }

    cmd_entryconfigure(args) {
      const entry = this._entry(args[0]);
      if (args.length === 1) {
        return _ENTRY_OPTIONS[entry.type].map((k) => [`-` + k, ``, ``, ``, entry[k] ?? ``]);
      }
      if (args.length === 2) {
        const key = to_str(args[1]).replace(/^-/, ``);
        return [`-` + key, ``, ``, ``, entry[key] ?? ``];
      }
      this._configure_entry(entry, args.slice(1));
      return ``;
    }

    cmd_entrycget(args) {
      const entry = this._entry(args[0]);
      const key = to_str(args[1]).replace(/^-/, ``);
      if (!_ENTRY_OPTIONS[entry.type].includes(key)) {
        throw new TclError(`unknown option "${to_str(args[1])}"`);
      }
      return entry[key] ?? ``;
    }

    cmd_index(args) {
      return this.index(args[0]);
    }

    cmd_type(args) {
      return this._entry(args[0]).type;
    }

    cmd_invoke(args) {
      return this.invoke(this._entry(args[0]));
    }

    invoke(entry) {
      if (entry.state === `disabled` || [`separator`, `tearoff`, `cascade`].includes(entry.type)) {
        return ``;
      }
      const var_name = entry.variable;
      if (entry.type === `checkbutton`) {
        const on = entry.onvalue ?? `1`;
        const off = entry.offvalue ?? `0`;
        const current = to_str(this.app.getvar_default(var_name, off));
        this.app.setvar(var_name, current === on ? off : on);
      } else if (entry.type === `radiobutton`) {
        this.app.setvar(var_name, entry.value ?? entry.label ?? ``);
      }
      if (entry.command) return this.app.eval_script(entry.command);
      return ``;
    }

    cmd_activate() {
      return ``;
    }

    cmd_post(args) {
      this.post(get_int(args[0]), get_int(args[1]));
      return ``;
    }

    cmd_unpost() {
      this.app.post_ops([{ op: `menu_unpost`, app: this.app.id }]);
      return ``;
    }

    cmd_yposition(args) {
      const i = this.index(args[0]);
      return i === `none` ? 0 : i * 22;
    }

    cmd_xposition() {
      return 0;
    }

    cmd_clone() {
      return ``;
    }

    variable_changed() {
      this.app.schedule_render();
    }

    on_destroy() {
      this.app.unlink_widget(this);
    }

    // ---- rendering -------------------------------------------------------------------

    describe(seen = null) {
      /* Entries for the page (labels, states, check marks, submenus). */
      const visited = seen ?? new Set();
      visited.add(this.path);
      const result = [];
      for (let i = 0; i < this.entries.length; i++) {
        const entry = this.entries[i];
        const kind = entry.type;
        const item = { type: kind, index: i };
        if (![`separator`, `tearoff`].includes(kind)) {
          item.label = entry.label ?? ``;
          item.accel = entry.accelerator ?? ``;
          item.disabled = entry.state === `disabled`;
          item.underline = entry.underline ?? -1;
          if (entry.image && this.app.images.exists(entry.image)) {
            item.image = this.app.images.get(entry.image).url();
          }
        }
        if (kind === `checkbutton`) {
          item.checked =
            to_str(this.app.getvar_default(entry.variable, ``)) === (entry.onvalue ?? `1`);
        } else if (kind === `radiobutton`) {
          item.checked =
            to_str(this.app.getvar_default(entry.variable, ``)) ===
            (entry.value ?? entry.label ?? ``);
        } else if (kind === `cascade`) {
          const sub = this.app.widgets.get(entry.menu ?? ``);
          if (sub instanceof Menu && !visited.has(sub.path)) {
            item.menu = sub.path;
            item.entries = sub.describe(new Set(visited));
          }
        }
        result.push(item);
      }
      return result;
    }

    post(x, y, below = null) {
      const command = this.options.postcommand;
      if (command) this.app.eval_script(command);
      const font = this.app.fonts.get(this.options.font);
      this.app.flush();
      const op = {
        op: `menu_post`, app: this.app.id, menu: this.path, x, y,
        font: font.css, entries: this.describe(),
      };
      if (below !== null && below !== undefined) {
        op.below = { win: below.toplevel.path, id: below.path };
      }
      this.app.post_ops([op]);
    }
  }

  class Menubutton extends TextWidget {
    static tk_class = `Menubutton`;
    static OPTIONS = {
      ...without(BUTTON_OPTIONS, [`command`, `default`, `overrelief`, `repeatdelay`, `repeatinterval`]),
      ...options(
        [`borderwidth`, `borderWidth`, `BorderWidth`, 1, `pixels`],
        [`direction`, `direction`, `Direction`, `below`],
        [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 0, `pixels`],
        [`indicatoron`, `indicatorOn`, `IndicatorOn`, 0, `bool`],
        [`menu`, `menu`, `Menu`, ``],
        [`relief`, `relief`, `Relief`, `flat`, `relief`],
      ),
    };

    KIND = `label`;
    INDICATOR_WIDTH = 8;
    INDICATOR_HEIGHT = 4;

    indicator_space() {
      return this.options.indicatoron ? this.INDICATOR_WIDTH + 12 : 0;
    }

    content_request() {
      const [width, height] = super.content_request();
      return [width + this.indicator_space(), height];
    }

    text_box() {
      const [lines, x0, y, w, h] = super.text_box();
      let x = x0;
      if (this.options.indicatoron && [`center`, `n`, `s`].includes(this.options.anchor)) {
        x -= Math.trunc(this.indicator_space() / 2);
      }
      return [lines, x, y, w, h];
    }

    render() {
      const props = super.render();
      props.kind = `menubutton`;
      props.indicator = Boolean(this.options.indicatoron);
      props.iw = this.INDICATOR_WIDTH;
      props.ih = this.INDICATOR_HEIGHT;
      return props;
    }

    post_menu() {
      const menu = this.app.widgets.get(this.options.menu);
      if (menu instanceof Menu && this.options.state !== `disabled`) {
        menu.post(0, 0, this);
      }
    }
  }

  const WIDGETS = { menu: Menu, menubutton: Menubutton };

  ns.Menu = Menu;
  ns.Menubutton = Menubutton;
  ns.WIDGETS = WIDGETS;
  ns.menusm = { Menu, Menubutton, WIDGETS };
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// text.js
// ============================================================

(function (ns) {
  "use strict";
  var css_color = ns.css_color;
  var TclError = ns.TclError;
  var get_boolean = ns.get_boolean;
  var join_list = ns.join_list;
  var split_list = ns.split_list;
  var to_str = ns.to_str;
  var Widget = ns.Widget;
  var options = ns.options;
  var Scrollable = ns.Scrollable;
  var parse_view_args = ns.parse_view_args;
  var parse_sequence = ns.parse_sequence;

  /**
   * The Text widget: content, indices, marks, tags, search and undo.
   *
   * Content always ends with a newline, like in Tk; "end" is the position after
   * it. Tag inheritance on insert and mark gravity follow the Tk text(n) manual.
   * The page owns scrolling and reports the visible fraction back.
   *
   * JS port of pythonny_tk/text.py.
   */


  const _TAG_OPTIONS = [
    `background`, `bgstipple`, `borderwidth`, `elide`, `fgstipple`, `font`, `foreground`,
    `justify`, `lmargin1`, `lmargin2`, `lmargincolor`, `offset`, `overstrike`, `overstrikefg`,
    `relief`, `rmargin`, `rmargincolor`, `selectbackground`, `selectforeground`, `spacing1`,
    `spacing2`, `spacing3`, `tabs`, `tabstyle`, `underline`, `underlinefg`, `wrap`,
  ];
  const _TAG_ALIASES = { bg: `background`, fg: `foreground`, bd: `borderwidth` };

  const _BASE = /^\s*(@-?\d+,-?\d+|\d+\.(?:\d+|end)|[^\s+-]+)/;
  const _COUNT_MOD = /^\s*([+-])\s*(\d+)\s*([a-z]+)?/;
  const _WORD_MOD = /^\s*(?:display\s+|any\s+)?(linestart|lineend|wordstart|wordend)/;
  const _WORD_CHAR = /\w/;
  const _LINE_END = /^(\d+)\.(\d+|end)$/;

  function _units(word) {
    if (!word) return `chars`;
    for (const unit of [`chars`, `indices`, `lines`, `displaychars`, `displayindices`, `displaylines`]) {
      if (unit.startsWith(word)) return unit.replace(`display`, ``);
    }
    throw new TclError(`bad text index modifier "${word}"`);
  }

  function bisect_right(starts, offset) {
    let lo = 0;
    let hi = starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] <= offset) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function escape_regex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
  }

  function style_key(style) {
    const entries = Object.entries(style).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return JSON.stringify(entries);
  }

  class Text extends Widget {
    static tk_class = `Text`;
    static OPTIONS = options(
      [`autoseparators`, `autoSeparators`, `AutoSeparators`, 1, `bool`],
      [`background`, `background`, `Background`, `SystemWindow`, `color`],
      [`blockcursor`, `blockCursor`, `BlockCursor`, 0, `bool`],
      [`borderwidth`, `borderWidth`, `BorderWidth`, 1, `pixels`],
      [`cursor`, `cursor`, `Cursor`, `xterm`],
      [`endline`, `endLine`, `EndLine`, ``],
      [`exportselection`, `exportSelection`, `ExportSelection`, 1, `bool`],
      [`font`, `font`, `Font`, `TkFixedFont`, `font`],
      [`foreground`, `foreground`, `Foreground`, `SystemWindowText`, `color`],
      [`height`, `height`, `Height`, 24, `pixels`],
      [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
      [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
      [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 0, `pixels`],
      [`inactiveselectbackground`, `inactiveSelectBackground`, `Foreground`, `SystemButtonFace`, `color`],
      [`insertbackground`, `insertBackground`, `Foreground`, `SystemWindowText`, `color`],
      [`insertborderwidth`, `insertBorderWidth`, `BorderWidth`, 0, `pixels`],
      [`insertofftime`, `insertOffTime`, `OffTime`, 300, `int`],
      [`insertontime`, `insertOnTime`, `OnTime`, 600, `int`],
      [`insertunfocussed`, `insertUnfocussed`, `InsertUnfocussed`, `none`],
      [`insertwidth`, `insertWidth`, `InsertWidth`, 2, `pixels`],
      [`maxundo`, `maxUndo`, `MaxUndo`, 0, `int`],
      [`padx`, `padX`, `Pad`, 1, `pixels`],
      [`pady`, `padY`, `Pad`, 1, `pixels`],
      [`relief`, `relief`, `Relief`, `sunken`, `relief`],
      [`selectbackground`, `selectBackground`, `Foreground`, `SystemHighlight`, `color`],
      [`selectborderwidth`, `selectBorderWidth`, `BorderWidth`, 0, `pixels`],
      [`selectforeground`, `selectForeground`, `Background`, `SystemHighlightText`, `color`],
      [`setgrid`, `setGrid`, `SetGrid`, 0, `bool`],
      [`spacing1`, `spacing1`, `Spacing`, 0, `pixels`],
      [`spacing2`, `spacing2`, `Spacing`, 0, `pixels`],
      [`spacing3`, `spacing3`, `Spacing`, 0, `pixels`],
      [`startline`, `startLine`, `StartLine`, ``],
      [`state`, `state`, `State`, `normal`],
      [`tabs`, `tabs`, `Tabs`, ``],
      [`tabstyle`, `tabStyle`, `TabStyle`, `tabular`],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
      [`undo`, `undo`, `Undo`, 0, `bool`],
      [`width`, `width`, `Width`, 80, `int`],
      [`wrap`, `wrap`, `Wrap`, `char`],
      [`xscrollcommand`, `xScrollCommand`, `ScrollCommand`, ``],
      [`yscrollcommand`, `yScrollCommand`, `ScrollCommand`, ``],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this.content = `\n`;
      this._starts = null;
      this.marks = { insert: [0, `right`], current: [0, `right`] };
      this.tags = { sel: { ranges: [], opts: {} } };
      this.tag_order = [`sel`];
      this.tag_bindings = new Map();
      this.view = [0.0, 1.0];
      this.modified = false;
      this.undo_stack = [];
      this.redo_stack = [];
      this.page_ops = [];
      Scrollable.prototype.init_scroll.call(this);
    }

    notify_scroll() {
      Scrollable.prototype.notify_scroll.call(this);
    }

    set_option(key, value) {
      if (key === `state`) {
        value = to_str(value);
        if (![`normal`, `disabled`].includes(value)) {
          throw new TclError(`bad state "${value}": must be disabled or normal`);
        }
      }
      if (key === `wrap`) {
        value = to_str(value);
        if (![`char`, `none`, `word`].includes(value)) {
          throw new TclError(`bad wrap "${value}": must be char, none, or word`);
        }
      }
      super.set_option(key, value);
    }

    get font() {
      return this.app.fonts.get(this.options.font);
    }

    inset() {
      const o = this.options;
      return o.highlightthickness + o.borderwidth;
    }

    content_request() {
      const o = this.options;
      const font = this.font;
      const inset = this.inset();
      return [
        o.width * font.measure(`0`) + 2 * (inset + o.padx),
        o.height * font.linespace + 2 * (inset + o.pady),
      ];
    }

    // ---- positions -------------------------------------------------------------------

    starts() {
      if (this._starts === null) {
        const starts = [0];
        let i = this.content.indexOf(`\n`);
        while (i !== -1) {
          starts.push(i + 1);
          i = this.content.indexOf(`\n`, i + 1);
        }
        this._starts = starts;
      }
      return this._starts;
    }

    line_count() {
      return this.starts().length - 1;
    }

    to_index(offset) {
      const starts = this.starts();
      const line = bisect_right(starts, offset) - 1;
      return `${line + 1}.${offset - starts[line]}`;
    }

    line_bounds(line) {
      /* (start, end) offsets of 1-based line, end before its newline. */
      const starts = this.starts();
      line = Math.max(1, Math.min(line, starts.length - 1));
      const start = starts[line - 1];
      const end = line < starts.length ? starts[line] - 1 : this.content.length;
      return [start, end];
    }

    index(spec) {
      const s = to_str(spec);
      const m = _BASE.exec(s);
      if (!m) throw new TclError(`bad text index "${s}"`);
      let offset = this._base(m[1], s);
      let rest = s.slice(m[0].length);
      while (rest.trim()) {
        const cm = _COUNT_MOD.exec(rest);
        if (cm) {
          const sign = cm[1];
          let count = parseInt(cm[2], 10) * (sign === `+` ? 1 : -1);
          const unit = _units(cm[3]);
          if (unit === `chars` || unit === `indices`) {
            offset += count;
          } else {
            const [line_s, col] = this.to_index(Math.max(0, Math.min(offset, this.content.length))).split(`.`);
            const line = parseInt(line_s, 10);
            const [start, end] = this.line_bounds(line + count);
            const target = line + count;
            if (target < 1) offset = 0;
            else if (target > this.line_count()) offset = this.content.length;
            else offset = Math.min(start + parseInt(col, 10), end);
          }
          offset = Math.max(0, Math.min(offset, this.content.length));
          rest = rest.slice(cm[0].length);
          continue;
        }
        const wm = _WORD_MOD.exec(rest);
        if (wm) {
          offset = this._word_mod(offset, wm[1]);
          rest = rest.slice(wm[0].length);
          continue;
        }
        throw new TclError(`bad text index "${s}"`);
      }
      return Math.max(0, Math.min(offset, this.content.length));
    }

    _base(base, whole) {
      if (base === `end`) return this.content.length;
      const m = _LINE_END.exec(base);
      if (m) {
        const line = parseInt(m[1], 10);
        if (line > this.line_count()) return this.content.length;
        if (line < 1) return 0;
        const [start, end] = this.line_bounds(line);
        if (m[2] === `end`) return end;
        return Math.min(start + parseInt(m[2], 10), end);
      }
      if (base.startsWith(`@`)) {
        const [x, y] = base.slice(1).split(`,`).map((v) => parseInt(v, 10));
        const line = Math.max(
          1,
          Math.floor((y - this.inset() - this.options.pady) / Math.max(this.font.linespace, 1)) + 1,
        );
        const [start, end] = this.line_bounds(Math.min(line, this.line_count()));
        const text = this.content.slice(start, end);
        for (let i = 0; i <= text.length; i++) {
          if (this.font.measure(text.slice(0, i)) >= x - this.inset() - this.options.padx) {
            return start + i;
          }
        }
        return end;
      }
      if (base in this.marks) return this.marks[base][0];
      for (const suffix of [`.first`, `.last`]) {
        if (base.endsWith(suffix)) {
          const tag = base.slice(0, -suffix.length);
          const ranges = this.tags[tag]?.ranges;
          if (!ranges || !ranges.length) {
            throw new TclError(`text doesn't contain any characters tagged with "${tag}"`);
          }
          return suffix === `.first` ? ranges[0][0] : ranges[ranges.length - 1][1];
        }
      }
      throw new TclError(`bad text index "${whole}"`);
    }

    _word_mod(offset, mod) {
      const [line_s] = this.to_index(offset).split(`.`);
      const [start, end] = this.line_bounds(parseInt(line_s, 10));
      if (mod === `linestart`) return start;
      if (mod === `lineend`) return end;
      const text = this.content;
      if (mod === `wordstart`) {
        let i = Math.min(offset, text.length - 1);
        if (i < text.length && _WORD_CHAR.test(text[i])) {
          while (i > 0 && _WORD_CHAR.test(text[i - 1])) i -= 1;
        }
        return i;
      }
      let i = offset;
      if (i < text.length && _WORD_CHAR.test(text[i])) {
        while (i < text.length && _WORD_CHAR.test(text[i])) i += 1;
      } else {
        i += 1;
      }
      return Math.min(i, text.length);
    }

    // ---- editing ---------------------------------------------------------------------

    _changed() {
      this._starts = null;
      if (!this.modified) {
        this.modified = true;
        this.app.dispatch_virtual(this, `Modified`);
      }
      this.app.schedule_render();
    }

    insert(offset, text, tags = null, record = true) {
      if (!text) return;
      offset = Math.min(offset, this.content.length - 1);
      this.content = this.content.slice(0, offset) + text + this.content.slice(offset);
      const n = text.length;
      for (const mark of Object.values(this.marks)) {
        if (mark[0] > offset || (mark[0] === offset && mark[1] === `right`)) mark[0] += n;
      }
      for (const tag of Object.values(this.tags)) {
        const new_ranges = [];
        for (const [s, e] of tag.ranges) {
          if (s >= offset) new_ranges.push([s + n, e + n]);
          else if (e <= offset) new_ranges.push([s, e]);
          else if (tags === null || tags === undefined) new_ranges.push([s, e + n]); // inherit the tag
          else new_ranges.push([s, offset], [offset + n, e + n]);
        }
        tag.ranges = new_ranges;
      }
      for (const name of tags ?? []) {
        this.tag(name).ranges.push([offset, offset + n]);
        this._merge(name);
      }
      if (record && this.options.undo) {
        this.undo_stack.push([`insert`, offset, text]);
        this.redo_stack.length = 0;
      }
      this._changed();
    }

    delete(start, end, record = true) {
      end = Math.min(end, this.content.length - 1);
      if (start >= end) return;
      const removed = this.content.slice(start, end);
      this.content = this.content.slice(0, start) + this.content.slice(end);
      const n = end - start;
      for (const mark of Object.values(this.marks)) {
        if (mark[0] >= end) mark[0] -= n;
        else if (mark[0] > start) mark[0] = start;
      }
      for (const tag of Object.values(this.tags)) {
        const new_ranges = [];
        for (let [s, e] of tag.ranges) {
          s = s >= end ? s - n : Math.min(s, start);
          e = e >= end ? e - n : Math.min(e, start);
          if (e > s) new_ranges.push([s, e]);
        }
        tag.ranges = new_ranges;
      }
      if (record && this.options.undo) {
        this.undo_stack.push([`delete`, start, removed]);
        this.redo_stack.length = 0;
      }
      this._changed();
    }

    editable() {
      return this.options.state === `normal`;
    }

    // ---- tags ------------------------------------------------------------------------

    tag(name) {
      if (!(name in this.tags)) {
        this.tags[name] = { ranges: [], opts: {} };
        this.tag_order.push(name);
      }
      return this.tags[name];
    }

    _merge(name) {
      const ranges = [...this.tags[name].ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const merged = [];
      for (const [s, e] of ranges) {
        if (merged.length && s <= merged[merged.length - 1][1]) {
          merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
        } else if (e > s) merged.push([s, e]);
      }
      this.tags[name].ranges = merged;
    }

    tags_at(offset) {
      return this.tag_order.filter((n) =>
        this.tags[n].ranges.some(([s, e]) => s <= offset && offset < e),
      );
    }

    _pairs(args) {
      /* (start, end) offsets from "index1 ?index2 index1 index2 ...?". */
      const pairs = [];
      for (let i = 0; i < args.length; i += 2) {
        const start = this.index(args[i]);
        const end = i + 1 < args.length ? this.index(args[i + 1]) : start + 1;
        pairs.push([start, Math.min(end, this.content.length)]);
      }
      return pairs;
    }

    cmd_tag(args) {
      const sub = args.length ? to_str(args[0]) : ``;
      const rest = args.slice(1);
      if (sub === `add`) {
        const tag = this.tag(to_str(rest[0]));
        for (const [s, e] of this._pairs(rest.slice(1))) {
          if (e > s) tag.ranges.push([s, e]);
        }
        this._merge(to_str(rest[0]));
      } else if (sub === `remove`) {
        const name = to_str(rest[0]);
        if (name in this.tags) {
          for (const [s, e] of this._pairs(rest.slice(1))) {
            const kept = [];
            for (const [rs, re] of this.tags[name].ranges) {
              if (re <= s || rs >= e) kept.push([rs, re]);
              else {
                if (rs < s) kept.push([rs, s]);
                if (re > e) kept.push([e, re]);
              }
            }
            this.tags[name].ranges = kept;
          }
        }
      } else if (sub === `configure` || sub === `config`) {
        const tag = this.tag(to_str(rest[0]));
        if (rest.length === 1) {
          return _TAG_OPTIONS.map((o) => [`-` + o, ``, ``, ``, tag.opts[o] ?? ``]);
        }
        if (rest.length === 2) {
          const key = this._tag_option(rest[1]);
          return [`-` + key, ``, ``, ``, tag.opts[key] ?? ``];
        }
        for (let i = 1; i + 1 < rest.length; i += 2) {
          const key = this._tag_option(rest[i]);
          let value = to_str(rest[i + 1]);
          if ([`background`, `foreground`, `selectbackground`, `selectforeground`].includes(key) && value) {
            css_color(value);
          }
          if (key === `font` && value) this.app.fonts.get(value);
          tag.opts[key] = value;
        }
      } else if (sub === `cget`) {
        return this.tag(to_str(rest[0])).opts[this._tag_option(rest[1])] ?? ``;
      } else if (sub === `delete`) {
        for (let name of rest) {
          name = to_str(name);
          if (name === `sel`) this.tags.sel.ranges = [];
          else if (name in this.tags) {
            delete this.tags[name];
            this.tag_order.splice(this.tag_order.indexOf(name), 1);
            this.tag_bindings.delete(name);
          }
        }
      } else if (sub === `names`) {
        if (rest.length) return this.tags_at(this.index(rest[0]));
        return this.tag_order.slice();
      } else if (sub === `ranges`) {
        const name = to_str(rest[0]);
        const ranges = (this.tags[name] ?? { ranges: [] }).ranges;
        return ranges.flatMap((r) => r.map((x) => this.to_index(x)));
      } else if (sub === `nextrange` || sub === `prevrange`) {
        const name = to_str(rest[0]);
        const start = this.index(rest[1]);
        const stop =
          rest.length > 2
            ? this.index(rest[2])
            : sub === `nextrange`
              ? this.content.length
              : 0;
        const ranges = (this.tags[name] ?? { ranges: [] }).ranges;
        if (sub === `nextrange`) {
          for (const [s, e] of ranges) {
            if ((s >= start && s < stop) || s < start < e) {
              return [this.to_index(Math.max(s, start)), this.to_index(e)];
            }
          }
        } else {
          for (const [s, e] of [...ranges].reverse()) {
            if (s < start && e > stop) return [this.to_index(s), this.to_index(e)];
          }
        }
        return ``;
      } else if (sub === `raise` || sub === `lower`) {
        const name = to_str(rest[0]);
        this.tag(name);
        this.tag_order.splice(this.tag_order.indexOf(name), 1);
        if (rest.length > 1) {
          const ref = this.tag_order.indexOf(to_str(rest[1]));
          this.tag_order.splice(sub === `raise` ? ref + 1 : ref, 0, name);
        } else if (sub === `raise`) this.tag_order.push(name);
        else this.tag_order.unshift(name);
      } else if (sub === `bind`) {
        const name = to_str(rest[0]);
        if (!this.tag_bindings.has(name)) this.tag_bindings.set(name, new Map());
        const table = this.tag_bindings.get(name);
        if (rest.length === 1) return [...table.keys()];
        const patterns = parse_sequence(to_str(rest[1]));
        const key = this.app._canonical_sequence(patterns);
        if (rest.length === 2) return table.get(key)?.script ?? ``;
        const script = to_str(rest[2]);
        if (!script) table.delete(key);
        else if (script.startsWith(`+`) && table.has(key)) {
          table.get(key).script += `\n` + script.slice(1);
        } else {
          table.set(key, { script: script.replace(/^\++/, ``), patterns });
        }
      } else {
        throw new TclError(
          `bad tag option "${sub}": must be add, bind, cget, configure, delete, ` +
            `lower, names, nextrange, prevrange, raise, ranges, or remove`,
        );
      }
      this.app.schedule_render();
      return ``;
    }

    _tag_option(name) {
      let key = to_str(name).replace(/^-/, ``);
      key = _TAG_ALIASES[key] ?? key;
      if (!_TAG_OPTIONS.includes(key)) throw new TclError(`unknown option "${to_str(name)}"`);
      return key;
    }

    item_bindings(event) {
      /* Bindings of the tags at the character under the pointer (Tk text tag bind). */
      const offset = event.offset;
      if (offset === null || offset === undefined || ![4, 5, 6, 7, 8].includes(event.type)) return [];
      return this.tags_at(offset)
        .filter((t) => this.tag_bindings.has(t))
        .map((t) => this.tag_bindings.get(t));
    }

    // ---- widget commands -------------------------------------------------------------

    cmd_insert(args) {
      if (!this.editable()) return ``;
      let offset = this.index(args[0]);
      const rest = args.slice(1);
      while (rest.length) {
        const text = to_str(rest.shift());
        const tags = rest.length ? split_list(rest.shift()).map(to_str) : null;
        this.insert(offset, text, tags);
        offset += text.length;
      }
      return ``;
    }

    cmd_delete(args) {
      if (!this.editable()) return ``;
      for (const [start, end] of this._pairs(args)) this.delete(start, end);
      return ``;
    }

    cmd_replace(args) {
      if (!this.editable()) return ``;
      let start = this.index(args[0]);
      const end = this.index(args[1]);
      this.delete(start, end);
      const rest = args.slice(2);
      while (rest.length) {
        const text = to_str(rest.shift());
        const tags = rest.length ? split_list(rest.shift()).map(to_str) : null;
        this.insert(start, text, tags);
        start += text.length;
      }
      return ``;
    }

    cmd_get(args) {
      const filtered = args.filter((a) => ![`-displaychars`, `--`].includes(to_str(a)));
      if (!filtered.length) {
        throw new TclError(
          `wrong # args: should be "${this.path} get ?-displaychars? ?--? index1 ?index2 ...?"`,
        );
      }
      const pairs = this._pairs(filtered);
      const texts = pairs.map(([s, e]) => (e > s ? this.content.slice(s, e) : ``));
      return texts.length === 1 ? texts[0] : texts;
    }

    cmd_index(args) {
      return this.to_index(this.index(args[0]));
    }

    cmd_compare(args) {
      const a = this.index(args[0]);
      const op = to_str(args[1]);
      const b = this.index(args[2]);
      const ops = { "<": a < b, "<=": a <= b, "==": a === b, ">=": a >= b, ">": a > b, "!=": a !== b };
      if (!(op in ops)) {
        throw new TclError(`bad comparison operator "${op}": must be <, <=, ==, >=, >, or !=`);
      }
      return ops[op] ? 1 : 0;
    }

    cmd_count(args) {
      const opts = args.filter((a) => to_str(a).startsWith(`-`)).map(to_str);
      const rest = args.filter((a) => !to_str(a).startsWith(`-`));
      const a = this.index(rest[0]);
      const b = this.index(rest[1]);
      if (opts.includes(`-lines`)) {
        return (
          parseInt(this.to_index(b).split(`.`)[0], 10) - parseInt(this.to_index(a).split(`.`)[0], 10)
        );
      }
      return b - a;
    }

    cmd_mark(args) {
      const sub = to_str(args[0]);
      if (sub === `set`) {
        const name = to_str(args[1]);
        const gravity = this.marks[name]?.[1] ?? `right`;
        this.marks[name] = [this.index(args[2]), gravity];
        this.app.schedule_render();
        return ``;
      }
      if (sub === `unset`) {
        for (const name of args.slice(1)) {
          if (![`insert`, `current`].includes(to_str(name))) delete this.marks[to_str(name)];
        }
        return ``;
      }
      if (sub === `names`) return Object.keys(this.marks);
      if (sub === `gravity`) {
        const mark = this.marks[to_str(args[1])];
        if (mark === undefined || mark === null) {
          throw new TclError(`there is no mark named "${to_str(args[1])}"`);
        }
        if (args.length === 2) return mark[1];
        mark[1] = to_str(args[2]);
        return ``;
      }
      if (sub === `next` || sub === `previous`) {
        const offset = this.index(args[1]);
        const items = Object.entries(this.marks)
          .map(([name, [pos]]) => [pos, name])
          .sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
        if (sub === `next`) {
          for (const [pos, name] of items) {
            if (pos >= offset) return name;
          }
        } else {
          for (const [pos, name] of [...items].reverse()) {
            if (pos < offset) return name;
          }
        }
        return ``;
      }
      throw new TclError(
        `bad mark option "${sub}": must be gravity, names, next, previous, set, or unset`,
      );
    }

    cmd_search(args) {
      args = args.map(to_str);
      let backwards = false;
      let nocase = false;
      let regexp = false;
      let count_var = null;
      let found_all = false;
      while (args.length && args[0].startsWith(`-`)) {
        const opt = args.shift();
        if (opt === `--`) break;
        if (opt === `-backwards` || opt === `-backward`) backwards = true;
        else if (
          [
            `-forwards`, `-forward`, `-exact`, `-elide`, `-hidden`,
            `-nolinestop`, `-strictlimits`, `-overlap`,
          ].includes(opt)
        );
        else if (opt === `-nocase`) nocase = true;
        else if (opt === `-regexp`) regexp = true;
        else if (opt === `-all`) found_all = true;
        else if (opt === `-count`) count_var = args.shift();
        else throw new TclError(`bad switch "${opt}"`);
      }
      const pattern = args[0];
      const start = this.index(args[1]);
      const stop = args.length > 2 ? this.index(args[2]) : null;
      const source = regexp ? pattern : escape_regex(pattern);
      const regex = new RegExp(source, nocase ? `i` : ``);
      const text = this.content;
      const matches = [];
      let m;
      const global_regex = new RegExp(source, (nocase ? `i` : ``) + `g`);
      while ((m = global_regex.exec(text)) !== null) {
        matches.push(m);
        if (m[0] === ``) global_regex.lastIndex += 1;
      }
      if (!matches.length) return ``;
      if (found_all) {
        const hits = matches.filter(
          (mm) => (stop === null || mm.index < stop) && mm.index >= start,
        );
        if (count_var) {
          this.app.setvar(count_var, hits.map((mm) => mm[0].length));
        }
        return hits.map((mm) => this.to_index(mm.index));
      }
      const ordered = matches.slice().sort((a, b) => a.index - b.index);
      if (backwards) ordered.reverse();
      let hit = null;
      for (const mm of ordered) {
        if (!backwards && mm.index >= start && (stop === null || mm.index < stop)) {
          hit = mm;
          break;
        }
        if (backwards && mm.index < start && (stop === null || mm.index >= stop)) {
          hit = mm;
          break;
        }
      }
      if (hit === null && stop === null) hit = ordered[0]; // wrap around, like Tk without -stopindex
      if (hit === null) return ``;
      if (count_var) this.app.setvar(count_var, hit[0].length);
      return this.to_index(hit.index);
    }

    cmd_see(args) {
      this.page_ops.push({ op: `text_see`, offset: this.index(args[0]) });
      this.app.schedule_render();
      return ``;
    }

    cmd_yview(args) {
      if (!args.length) return this.view.slice();
      if (args.length === 1 || to_str(args[0]) === `-pickplace`) {
        return this.cmd_see([args[args.length - 1]]);
      }
      const [kind, amount, what] = parse_view_args(args);
      this.page_ops.push({ op: `text_scroll`, kind, amount, what });
      this.app.schedule_render();
      return ``;
    }

    cmd_xview(args) {
      return args.length ? `` : [0.0, 1.0];
    }

    cmd_bbox(args) {
      const offset = this.index(args[0]);
      const [line_s, col] = this.to_index(offset).split(`.`);
      const line = parseInt(line_s, 10);
      const [start, end] = this.line_bounds(line);
      const font = this.font;
      const x = this.inset() + this.options.padx + font.measure(this.content.slice(start, offset));
      const y = this.inset() + this.options.pady + (line - 1) * font.linespace;
      const width = font.measure(this.content.slice(offset, offset + 1).replace(`\n`, ` `)) || 1;
      return [x, y, width, font.linespace];
    }

    cmd_dlineinfo(args) {
      const [x, y, w, h] = this.cmd_bbox(args);
      return [x, y, w, h, this.font.metrics()[0]];
    }

    cmd_edit(args) {
      const sub = to_str(args[0]);
      if (sub === `modified`) {
        if (args.length === 1) return this.modified ? 1 : 0;
        this.modified = get_boolean(args[1]);
        return ``;
      }
      if (sub === `reset`) {
        this.undo_stack.length = 0;
        this.redo_stack.length = 0;
        return ``;
      }
      if (sub === `separator`) {
        this.undo_stack.push([`separator`, 0, ``]);
        return ``;
      }
      if (sub === `undo` || sub === `redo`) {
        if (!this.options.undo) return ``;
        const source = sub === `undo` ? this.undo_stack : this.redo_stack;
        const target = sub === `undo` ? this.redo_stack : this.undo_stack;
        while (source.length && source[source.length - 1][0] === `separator`) source.pop();
        if (!source.length) throw new TclError(`nothing to ${sub}`);
        while (source.length && source[source.length - 1][0] !== `separator`) {
          const [op, offset, text] = source.pop();
          if ((op === `insert`) === (sub === `undo`)) {
            this.delete(offset, offset + text.length, false);
            target.push([`insert`, offset, text]);
          } else {
            this.insert(offset, text, null, false);
            target.push([`delete`, offset, text]);
          }
        }
        return ``;
      }
      if (sub === `canundo` || sub === `canredo`) {
        const stack = sub === `canundo` ? this.undo_stack : this.redo_stack;
        return stack.length ? 1 : 0;
      }
      throw new TclError(
        `bad edit option "${sub}": must be canredo, canundo, modified, redo, reset, separator, or undo`,
      );
    }

    cmd_scan() {
      return ``;
    }

    cmd_dump() {
      return [];
    }

    cmd_window() {
      throw new TclError(`embedded windows in Text are not supported in PyThonny yet`);
    }

    cmd_image() {
      throw new TclError(`embedded images in Text are not supported in PyThonny yet`);
    }

    // ---- page interaction ------------------------------------------------------------

    apply_page_edit(value, cursor, selection) {
      /* Applies the page's edited text as one delete+insert, like typing. */
      if (!this.editable()) return;
      const old = this.content.slice(0, -1);
      if (value !== old) {
        let prefix = 0;
        const limit = Math.min(old.length, value.length);
        while (prefix < limit && old[prefix] === value[prefix]) prefix += 1;
        let suffix = 0;
        while (
          suffix < limit - prefix &&
          old[old.length - 1 - suffix] === value[value.length - 1 - suffix]
        ) {
          suffix += 1;
        }
        if (this.options.undo && this.options.autoseparators) {
          this.undo_stack.push([`separator`, 0, ``]);
        }
        this.delete(prefix, old.length - suffix);
        this.insert(prefix, value.slice(prefix, value.length - suffix));
      }
      this.set_page_selection(cursor, selection);
    }

    set_page_selection(cursor, selection) {
      this.marks.insert[0] = Math.max(0, Math.min(Math.trunc(Number(cursor)), this.content.length - 1));
      if (selection && selection[1] > selection[0]) {
        this.tags.sel.ranges = [[Math.trunc(Number(selection[0])), Math.trunc(Number(selection[1]))]];
      } else {
        this.tags.sel.ranges = [];
      }
    }

    scroll_fractions(axis) {
      return axis === `y` ? this.view.slice() : [0.0, 1.0];
    }

    render() {
      const o = this.options;
      const text = this.content.slice(0, -1);
      // Style runs from tags with visual options, lowest priority first.
      const styled = this.tag_order.filter(
        (n) => n !== `sel` && Object.keys(this.tags[n].opts).length && this.tags[n].ranges.length,
      );
      const bounds = new Set([0, text.length]);
      for (const name of styled) {
        for (const [s, e] of this.tags[name].ranges) {
          bounds.add(Math.min(s, text.length));
          bounds.add(Math.min(e, text.length));
        }
      }
      const sorted_bounds = [...bounds].sort((a, b) => a - b);
      const styles = [];
      const style_keys = new Map();
      const runs = [];
      for (let k = 0; k + 1 < sorted_bounds.length; k++) {
        const a = sorted_bounds[k];
        const b = sorted_bounds[k + 1];
        if (b <= a) continue;
        const style = {};
        for (const name of styled) {
          if (this.tags[name].ranges.some(([s, e]) => s <= a && a < e)) {
            const opts = this.tags[name].opts;
            if (opts.foreground) style.fg = css_color(opts.foreground);
            if (opts.background) style.bg = css_color(opts.background);
            if (opts.font) style.font = this.app.fonts.get(opts.font).css;
            for (const key of [`underline`, `overstrike`, `elide`]) {
              if (opts[key] && ![`0`, `false`, `no`, `off`].includes(opts[key])) style[key] = 1;
            }
            if (opts.justify) style.justify = opts.justify;
          }
        }
        const key = style_key(style);
        if (!style_keys.has(key)) {
          style_keys.set(key, styles.length);
          styles.push(style);
        }
        runs.push([b - a, style_keys.get(key)]);
      }
      const sel = this.tags.sel.ranges;
      return {
        kind: `text`, bg: o.background, fg: o.foreground, relief: o.relief,
        bd: o.borderwidth, hl: o.highlightthickness, font: this.font.css,
        lh: this.font.linespace, padx: o.padx, pady: o.pady, value: text,
        runs, styles, wrap: o.wrap, state: o.state,
        insertcolor: o.insertbackground, selectbg: o.selectbackground,
        selectfg: o.selectforeground, cursor: this.marks.insert[0],
        selection: sel.length ? [sel[0][0], sel[sel.length - 1][1]] : null,
      };
    }

    extra_ops() {
      const ops = this.page_ops;
      this.page_ops = [];
      return ops;
    }
  }

  const WIDGETS = { text: Text };

  ns.Text = Text;
  ns.WIDGETS = WIDGETS;
  ns.textm = { Text, WIDGETS };
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// canvas.js
// ============================================================

(function (ns) {
  "use strict";
  var css_color = ns.css_color;
  var TclError = ns.TclError;
  var get_double = ns.get_double;
  var get_int = ns.get_int;
  var get_pixels = ns.get_pixels;
  var split_list = ns.split_list;
  var to_str = ns.to_str;
  var parse_sequence = ns.parse_sequence;
  var Widget = ns.Widget;
  var options = ns.options;
  var Scrollable = ns.Scrollable;
  var parse_view_args = ns.parse_view_args;

  /**
   * The Canvas widget: items, tags, coordinates, scrolling and item bindings.
   *
   * Only changed items are sent to the page (turtle drawings can have thousands of
   * items), so the canvas keeps its own dirty set instead of using the generic
   * widget props diff.
   *
   * JS port of pythonny_tk/canvas.py.
   */


  const _COMMON = { tags: [], state: `` };

  const _ITEM_DEFAULTS = {
    line: Object.assign({}, _COMMON, {
      fill: `black`, width: 1.0, dash: ``, arrow: `none`, arrowshape: [8, 10, 3],
      capstyle: `butt`, joinstyle: `round`, smooth: 0, splinesteps: 12, activefill: ``,
      activewidth: 0.0, disabledfill: ``, dashoffset: 0, stipple: ``,
    }),
    rectangle: Object.assign({}, _COMMON, {
      fill: ``, outline: `black`, width: 1.0, dash: ``, activefill: ``,
      activeoutline: ``, activewidth: 0.0, disabledfill: ``, disabledoutline: ``,
      dashoffset: 0, stipple: ``, outlinestipple: ``, offset: `0,0`, outlineoffset: `0,0`,
    }),
    polygon: Object.assign({}, _COMMON, {
      fill: `black`, outline: ``, width: 1.0, dash: ``, joinstyle: `round`,
      smooth: 0, splinesteps: 12, activefill: ``, activeoutline: ``, activewidth: 0.0,
      disabledfill: ``, disabledoutline: ``, dashoffset: 0, stipple: ``, outlinestipple: ``,
    }),
    arc: Object.assign({}, _COMMON, {
      fill: ``, outline: `black`, width: 1.0, dash: ``, start: 0.0, extent: 90.0,
      style: `pieslice`, activefill: ``, activeoutline: ``, activewidth: 0.0, dashoffset: 0,
      stipple: ``, outlinestipple: ``,
    }),
    text: Object.assign({}, _COMMON, {
      text: ``, fill: `black`, font: `TkDefaultFont`, anchor: `center`,
      justify: `left`, width: 0, angle: 0.0, underline: -1, activefill: ``, disabledfill: ``,
      stipple: ``,
    }),
    image: Object.assign({}, _COMMON, { image: ``, anchor: `center`, activeimage: ``, disabledimage: `` }),
    window: Object.assign({}, _COMMON, { window: ``, anchor: `center`, width: 0, height: 0 }),
    bitmap: Object.assign({}, _COMMON, { bitmap: ``, anchor: `center`, foreground: `black`, background: `` }),
  };
  _ITEM_DEFAULTS.oval = Object.assign({}, _ITEM_DEFAULTS.rectangle);

  const _COORD_COUNT = {
    line: [4, null], rectangle: [4, 4], oval: [4, 4], arc: [4, 4],
    polygon: [6, null], text: [2, 2], image: [2, 2], window: [2, 2], bitmap: [2, 2],
  };

  const _COLOR_OPTIONS = [`fill`, `outline`, `activefill`, `activeoutline`, `disabledfill`, `disabledoutline`];
  const _FLOAT_OPTIONS = [`width`, `start`, `extent`, `angle`, `activewidth`];

  function _dash_array(dash, width) {
    /* Tk dash pattern (list of lengths or -,.,_ characters) as SVG dasharray. */
    if (!dash) return ``;
    const parts = split_list(dash);
    let lengths = [];
    try {
      lengths = parts.map((p) => get_double(p));
    } catch {
      lengths = [];
      const w = Math.max(1.0, get_double(width));
      for (const ch of to_str(dash)) {
        if (ch === `.`) lengths.push(2 * w, 4 * w);
        else if (ch === `-`) lengths.push(6 * w, 4 * w);
        else if (ch === `,`) lengths.push(4 * w, 4 * w);
        else if (ch === `_`) lengths.push(8 * w, 4 * w);
        else if (ch === ` ` && lengths.length) lengths[lengths.length - 1] += 4 * w;
      }
    }
    return lengths.map((x) => strip_zero(x)).join(` `);
  }

  function strip_zero(x) {
    /* Python "%g" formatting for dash arrays. */
    if (!Number.isFinite(x)) return String(x);
    const s = x.toPrecision(12);
    return String(parseFloat(s));
  }

  class Item {
    constructor(item_id, item_type, coords, item_options) {
      this.id = item_id;
      this.type = item_type;
      this.coords = coords;
      this.options = item_options;
    }
  }

  function _tokenize_tag_expr(expr) {
    /* Splits a tag expression into and/or/not/!=/( /)/bool tokens. */
    let src = expr.replace(/\(/g, ` ( `).replace(/\)/g, ` ) `);
    src = src.replace(/&&/g, ` and `).replace(/\|\|/g, ` or `).replace(/\^/g, ` != `);
    const parts = [];
    const push = (t) => t && parts.push(t);
    for (const tok of src.split(/\s+/).filter(Boolean)) {
      if (tok === `!=` || !tok.includes(`!`)) {
        push(tok);
        continue;
      }
      // Tokens like "!foo" or "a!=b": split "!" from the rest, keeping "!=" intact.
      let cur = ``;
      for (let i = 0; i < tok.length; ) {
        if (tok.startsWith(`!=`, i)) {
          push(cur);
          cur = ``;
          push(`!=`);
          i += 2;
        } else if (tok[i] === `!`) {
          push(cur);
          cur = ``;
          push(`not`);
          i += 1;
        } else {
          cur += tok[i];
          i += 1;
        }
      }
      push(cur);
    }
    return parts;
  }

  function _eval_tag_expr(expr, tags) {
    /* Evaluates a tag expression (&&, ||, ^, !, parens, tag names) safely. */
    const tokens = _tokenize_tag_expr(expr).map((t) => {
      if ([`and`, `or`, `not`, `(`, `)`, `!=`].includes(t)) return t;
      return tags.has(t) ? `T` : `F`;
    });
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const parse_atom = () => {
      const t = next();
      if (t === `(`) {
        const v = parse_or();
        if (next() !== `)`) throw new SyntaxError(`expected )`);
        return v;
      }
      if (t === `T`) return true;
      if (t === `F`) return false;
      throw new SyntaxError(`unexpected token`);
    };
    const parse_comparison = () => {
      let left = parse_atom();
      while (peek() === `!=`) {
        next();
        const right = parse_atom();
        left = left !== right;
      }
      return left;
    };
    const parse_not = () => {
      if (peek() === `not`) {
        next();
        return !parse_not();
      }
      return parse_comparison();
    };
    const parse_and = () => {
      let left = parse_not();
      while (peek() === `and`) {
        next();
        const right = parse_not();
        left = left && right;
      }
      return left;
    };
    const parse_or = () => {
      let left = parse_and();
      while (peek() === `or`) {
        next();
        const right = parse_and();
        left = left || right;
      }
      return left;
    };
    try {
      const result = parse_or();
      if (pos !== tokens.length) return false;
      return Boolean(result);
    } catch {
      return false;
    }
  }

  class Canvas extends Widget {
    static tk_class = `Canvas`;
    static OPTIONS = options(
      [`background`, `background`, `Background`, `SystemButtonFace`, `color`],
      [`borderwidth`, `borderWidth`, `BorderWidth`, 0, `pixels`],
      [`closeenough`, `closeEnough`, `CloseEnough`, 1.0, `float`],
      [`confine`, `confine`, `Confine`, 1, `bool`],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`height`, `height`, `Height`, 265, `pixels`],
      [`highlightbackground`, `highlightBackground`, `HighlightBackground`, `SystemButtonFace`, `color`],
      [`highlightcolor`, `highlightColor`, `HighlightColor`, `SystemWindowFrame`, `color`],
      [`highlightthickness`, `highlightThickness`, `HighlightThickness`, 2, `pixels`],
      [`insertbackground`, `insertBackground`, `Foreground`, `SystemButtonText`, `color`],
      [`insertborderwidth`, `insertBorderWidth`, `BorderWidth`, 0, `pixels`],
      [`insertofftime`, `insertOffTime`, `OffTime`, 300, `int`],
      [`insertontime`, `insertOnTime`, `OnTime`, 600, `int`],
      [`insertwidth`, `insertWidth`, `InsertWidth`, 2, `pixels`],
      [`offset`, `offset`, `Offset`, `0,0`],
      [`relief`, `relief`, `Relief`, `flat`, `relief`],
      [`scrollregion`, `scrollRegion`, `ScrollRegion`, ``],
      [`selectbackground`, `selectBackground`, `Foreground`, `SystemHighlight`, `color`],
      [`selectborderwidth`, `selectBorderWidth`, `BorderWidth`, 1, `pixels`],
      [`selectforeground`, `selectForeground`, `Background`, `SystemHighlightText`, `color`],
      [`state`, `state`, `State`, `normal`],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
      [`width`, `width`, `Width`, 378, `pixels`],
      [`xscrollcommand`, `xScrollCommand`, `ScrollCommand`, ``],
      [`xscrollincrement`, `xScrollIncrement`, `ScrollIncrement`, 0, `pixels`],
      [`yscrollcommand`, `yScrollCommand`, `ScrollCommand`, ``],
      [`yscrollincrement`, `yScrollIncrement`, `ScrollIncrement`, 0, `pixels`],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this.items = new Map();
      this.order = [];
      this.next_id = 1;
      this.x_origin = 0;
      this.y_origin = 0;
      this.current = null;
      this.item_bindings_table = new Map();
      this.dirty = new Set();
      this.deleted = [];
      this.order_ops = [];
      this.sent_full = false;
      // Image items -> version of their photo image when last sent: a new
      // picture in the same image (e.g. matplotlib's blit) is sent again.
      this.image_versions = new Map();
      Scrollable.prototype.init_scroll.call(this);
    }

    inset() {
      return this.options.highlightthickness + this.options.borderwidth;
    }

    content_request() {
      const inset = this.inset();
      return [this.options.width + 2 * inset, this.options.height + 2 * inset];
    }

    // ---- view ------------------------------------------------------------------------
    // x_origin/y_origin are the canvas coordinates of the widget's top-left pixel
    // (under the border), exactly like xOrigin/yOrigin in generic/tkCanvas.c.

    region() {
      const sr = split_list(this.options.scrollregion);
      if (sr.length === 4) return sr.map((v) => get_pixels(v));
      return null;
    }

    _set_origin(x, y) {
      /* CanvasSetOrigin: keeps the view inside -scrollregion when -confine is on. */
      const region = this.region();
      const inset = this.inset();
      if (region !== null && region !== undefined && this.options.confine) {
        const [x1, y1, x2, y2] = region;
        const left = x + inset - x1;
        const right = x2 - (x + this.width - inset);
        if (left < 0 && right > 0) x += right > -left ? -left : right;
        else if (right < 0 && left > 0) x -= left > -right ? -right : left;
        const top = y + inset - y1;
        const bottom = y2 - (y + this.height - inset);
        if (top < 0 && bottom > 0) y += bottom > -top ? -top : bottom;
        else if (bottom < 0 && top > 0) y -= top > -bottom ? -bottom : top;
      }
      const changed = x !== this.x_origin || y !== this.y_origin;
      this.x_origin = x;
      this.y_origin = y;
      if (changed && this.window_items().length) this.app.schedule_layout();
      this.app.schedule_render();
    }

    geometry_changed() {
      this._set_origin(this.x_origin, this.y_origin);
    }

    scroll_fractions(axis) {
      const region = this.region();
      const inset = this.inset();
      let x1, x2, origin, size;
      if (axis === `x`) {
        [x1, x2] = region ? [region[0], region[2]] : [0, this.width];
        origin = this.x_origin;
        size = this.width;
      } else {
        [x1, x2] = region ? [region[1], region[3]] : [0, this.height];
        origin = this.y_origin;
        size = this.height;
      }
      const span = Math.max(x2 - x1, 1);
      const first = (origin + inset - x1) / span;
      const last = (origin + size - inset - x1) / span;
      return [Math.max(0.0, Math.min(1.0, first)), Math.max(0.0, Math.min(1.0, last))];
    }

    _view(axis, args) {
      if (!args.length) return this.scroll_fractions(axis);
      const [kind, amount, what] = parse_view_args(args);
      const region = this.region();
      const inset = this.inset();
      const size = (axis === `x` ? this.width : this.height) - 2 * inset;
      let origin = axis === `x` ? this.x_origin : this.y_origin;
      if (kind === `moveto`) {
        let start, end;
        if (axis === `x`) [start, end] = region ? [region[0], region[2]] : [0, this.width];
        else [start, end] = region ? [region[1], region[3]] : [0, this.height];
        origin = start + amount * (end - start) - inset;
      } else {
        const increment = this.options[axis === `x` ? `xscrollincrement` : `yscrollincrement`];
        if (what === `pages`) origin += (amount * 9 * size) / 10;
        else if (what === `pixels`) origin += amount;
        else origin += amount * (increment > 0 ? increment : size / 10);
      }
      origin = Number.isInteger(origin) ? Math.trunc(origin) : Math.round(origin);
      if (axis === `x`) this._set_origin(origin, this.y_origin);
      else this._set_origin(this.x_origin, origin);
      return ``;
    }

    cmd_xview(args) {
      return this._view(`x`, args);
    }

    cmd_yview(args) {
      return this._view(`y`, args);
    }

    cmd_canvasx(args) {
      let value = get_double(args[0]) + this.x_origin;
      if (args.length > 1 && get_double(args[1]) > 0) {
        const grid = get_double(args[1]);
        value = Math.round(value / grid) * grid;
      }
      return value;
    }

    cmd_canvasy(args) {
      let value = get_double(args[0]) + this.y_origin;
      if (args.length > 1 && get_double(args[1]) > 0) {
        const grid = get_double(args[1]);
        value = Math.round(value / grid) * grid;
      }
      return value;
    }

    set_option(key, value) {
      super.set_option(key, value);
      if ([`scrollregion`, `confine`].includes(key) && this.app.widgets.get(this.path) === this) {
        this._set_origin(this.x_origin, this.y_origin);
      }
    }

    // ---- items -----------------------------------------------------------------------

    _coords(values) {
      const coords = [];
      for (const v of values) {
        for (const c of split_list(v)) {
          coords.push(typeof c === `number` ? c : get_double(c));
        }
      }
      return coords;
    }

    _set_options(item, args, creating = false) {
      if (args.length % 2) {
        throw new TclError(`value for "${to_str(args[args.length - 1])}" missing`);
      }
      const defaults = _ITEM_DEFAULTS[item.type];
      for (let k = 0; k < args.length; k += 2) {
        const name = args[k];
        let value = args[k + 1];
        let key = to_str(name).replace(/^-/, ``);
        if (!(key in defaults)) {
          const matches = key ? Object.keys(defaults).filter((d) => d.startsWith(key)) : [];
          if (matches.length !== 1) throw new TclError(`unknown option "${to_str(name)}"`);
          key = matches[0];
        }
        if (key === `tags`) value = split_list(value);
        else if ((key === `width` || key === `height`) && item.type === `window`) {
          value = get_pixels(value);
        } else if (_COLOR_OPTIONS.includes(key)) {
          value = to_str(value);
          if (value) css_color(value);
        } else if (_FLOAT_OPTIONS.includes(key)) value = get_double(value);
        else if (key === `smooth`) {
          value = to_str(value);
          value = [``].includes(value) || [`0`, `false`, `no`, `off`].includes(value) ? 0 : 1;
        } else if ((key === `underline` || key === `width`) && item.type === `text`) {
          value = key === `underline` ? get_int(value) : get_pixels(value);
        } else if (key === `arrowshape`) value = split_list(value).map((v) => get_double(v));
        else if ([`image`, `activeimage`, `disabledimage`].includes(key)) {
          value = to_str(value);
          if (value) this.app.images.get(value); // raises: image "x" doesn't exist
        } else if (key === `window` && item.type === `window`) {
          value = this._attach_window(item, to_str(value));
        } else if (key === `font`) {
          value = to_str(value);
          this.app.fonts.get(value);
        } else if (typeof value !== `number`) value = to_str(value);
        item.options[key] = value;
      }
      this._touch(item);
    }

    // ---- window items (embedded widgets) ---------------------------------------------

    window_items() {
      return [...this.items.values()].filter((i) => i.type === `window`);
    }

    _attach_window(item, path) {
      const old = this.app.widgets.get(to_str(item.options.window ?? ``));
      if (old && old.path !== path) this._release(old, item);
      if (path === ``) return ``;
      const w = this.app.widget(path);
      if (w.is_toplevel || w === this) throw new TclError(`can't use ${path} in a canvas`);
      if (w.manager !== null && w.canvas_owner !== this) this.app.unmanage(w);
      w.manager = `canvas`;
      w.canvas_owner = this;
      return path;
    }

    _release(w, item) {
      const used = this.window_items().some((i) => i !== item && i.options.window === w.path);
      if (w.canvas_owner === this && !used) {
        w.manager = null;
        w.canvas_owner = null;
        w.mapped = false;
      }
    }

    forget_window(w) {
      for (const item of this.window_items()) {
        if (item.options.window === w.path) {
          item.options.window = ``;
          this._touch(item);
        }
      }
      w.canvas_owner = null;
    }

    managed_slaves() {
      return this.window_items()
        .map((i) => this.app.widgets.get(to_str(i.options.window)))
        .filter(Boolean);
    }

    _window_box(item) {
      const o = item.options;
      const w = this.app.widgets.get(to_str(o.window));
      const width = o.width > 0 ? o.width : w ? w.req_w : 0;
      const height = o.height > 0 ? o.height : w ? w.req_h : 0;
      const [x, y] = item.coords;
      const a = o.anchor ?? `center`;
      const left = [`nw`, `w`, `sw`].includes(a) ? x : [`ne`, `e`, `se`].includes(a) ? x - width : x - width / 2;
      const top = a.startsWith(`n`) ? y : a.startsWith(`s`) ? y - height : y - height / 2;
      return [Math.round(left), Math.round(top), width, height];
    }

    arrange_slaves() {
      for (const w of this._arranged ?? []) w.mapped = false;
      this._arranged = new Set();
      for (const id of this.order) {
        const item = this.items.get(id);
        if (item.type !== `window` || item.options.state === `hidden`) continue;
        const w = this.app.widgets.get(to_str(item.options.window));
        if (!w || w.destroyed) continue;
        const [x, y, bw, bh] = this._window_box(item);
        ns.set_slave_geometry(this, w, x - this.x_origin, y - this.y_origin, bw, bh);
        this._arranged.add(w);
      }
    }

    _touch(item) {
      if (item.type === `window`) this.app.schedule_layout();
      if (item.type === `image`) {
        if (!this.image_versions.has(item.id)) this.image_versions.set(item.id, null);
      }
      this.dirty.add(item.id);
      this.app.schedule_render();
    }

    create(item_type, args) {
      if (!(item_type in _ITEM_DEFAULTS)) {
        throw new TclError(`unknown or ambiguous item type "${item_type}"`);
      }
      const values = [];
      const rest = args.slice();
      const is_option = (v) =>
        typeof v === `string` && v.startsWith(`-`) && !/^\d/.test(v.slice(1, 2));
      while (rest.length && !is_option(rest[0])) values.push(rest.shift());
      const coords = this._coords(values);
      const [low, high] = _COORD_COUNT[item_type];
      if (
        coords.length < low ||
        (high !== null && coords.length !== high) ||
        coords.length % 2
      ) {
        throw new TclError(
          `wrong # coordinates: expected ${high ? `` : `at least `}${low}, got ${coords.length}`,
        );
      }
      const item = new Item(this.next_id, item_type, coords, Object.assign({}, _ITEM_DEFAULTS[item_type]));
      this.next_id += 1;
      this._set_options(item, rest, true);
      this.items.set(item.id, item);
      this.order.push(item.id);
      this.order_ops.push([`top`, item.id]);
      return item.id;
    }

    find(spec) {
      /* Item ids matching a tag, an id, "all" or "current" (display order). */
      if (typeof spec === `number`) return this.items.has(spec) ? [spec] : [];
      const s = to_str(spec);
      if (/^\d+$/.test(s)) {
        const i = get_int(s);
        return this.items.has(i) ? [i] : [];
      }
      if (s === `all`) return this.order.slice();
      if (s === `current`) return this.current !== null && this.items.has(this.current) ? [this.current] : [];
      if ([`&&`, `||`, `^`, `!`].some((op) => s.includes(op))) {
        return this.order.filter((i) => _eval_tag_expr(s, this.tag_set(this.items.get(i))));
      }
      return this.order.filter((i) => this.items.get(i).options.tags.includes(s));
    }

    tag_set(item) {
      return new Set([...item.options.tags, `all`]);
    }

    first(spec) {
      const found = this.find(spec);
      return found.length ? this.items.get(found[0]) : null;
    }

    bbox(item) {
      const c = item.coords;
      if (item.type === `text`) {
        const box = this._text_box(item);
        return [box.x, box.y, box.x + box.w, box.y + box.h];
      }
      if (item.type === `image`) {
        const [x, y, w, h] = this._image_box(item);
        return [x, y, x + w, y + h];
      }
      if (item.type === `window`) {
        const [wx, wy, ww, wh] = this._window_box(item);
        return [wx, wy, wx + ww, wy + wh];
      }
      if (item.type === `bitmap`) return [c[0], c[1], c[0], c[1]];
      const xs = c.filter((_, k) => k % 2 === 0);
      const ys = c.filter((_, k) => k % 2 === 1);
      let pad =
        item.options.outline || item.type === `line` ? (item.options.width ?? 1.0) / 2 : 0;
      if (item.type === `line` && (item.options.arrow ?? `none`) !== `none`) {
        pad = Math.max(pad, Math.max(...item.options.arrowshape));
      }
      return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
    }

    _image_box(item) {
      const name = item.options.image;
      const image = name && this.app.images.exists(name) ? this.app.images.get(name) : null;
      const w = image ? image.width : 0;
      const h = image ? image.height : 0;
      const x = item.coords[0];
      const y = item.coords[1];
      const anchor = item.options.anchor ?? `center`;
      const left = [`nw`, `w`, `sw`].includes(anchor)
        ? x
        : [`ne`, `e`, `se`].includes(anchor)
          ? x - w
          : x - w / 2;
      const top = anchor.startsWith(`n`) ? y : anchor.startsWith(`s`) ? y - h : y - h / 2;
      return [left, top, w, h];
    }

    _text_box(item) {
      const o = item.options;
      const font = this.app.fonts.get(o.font);
      const [lines, w, h] = font.layout(to_str(o.text), o.width ? o.width : 0);
      const x = item.coords[0];
      const y = item.coords[1];
      const anchor = o.anchor;
      let left;
      if ([`nw`, `w`, `sw`].includes(anchor)) left = x;
      else if ([`ne`, `e`, `se`].includes(anchor)) left = x - w;
      else left = x - w / 2;
      let top;
      if (anchor.startsWith(`n`)) top = y;
      else if (anchor.startsWith(`s`)) top = y - h;
      else top = y - h / 2;
      return { x: left, y: top, w, h, lines, font };
    }

    // ---- widget commands -------------------------------------------------------------

    cmd_create(args) {
      return this.create(to_str(args[0]), args.slice(1));
    }

    cmd_coords(args) {
      const item = this.first(args[0]);
      if (item === null) return [];
      if (args.length === 1) return item.coords.map((v) => Math.round(v * 1e6) / 1e6);
      const coords = this._coords(args.slice(1));
      const [low, high] = _COORD_COUNT[item.type];
      if (
        coords.length < low ||
        (high !== null && coords.length !== high) ||
        coords.length % 2
      ) {
        throw new TclError(`wrong # coordinates: expected ${low}, got ${coords.length}`);
      }
      item.coords = coords;
      this._touch(item);
      return ``;
    }

    cmd_itemconfigure(args) {
      const items = this.find(args[0]);
      if (args.length <= 2) {
        if (!items.length) return [];
        const item = this.items.get(items[0]);
        if (args.length === 1) {
          return Object.entries(item.options).map(([k, v]) => [
            `-` + k, ``, ``, _ITEM_DEFAULTS[item.type][k], v,
          ]);
        }
        const key = to_str(args[1]).replace(/^-/, ``);
        return [`-` + key, ``, ``, _ITEM_DEFAULTS[item.type][key] ?? ``, item.options[key] ?? ``];
      }
      for (const i of items) this._set_options(this.items.get(i), args.slice(1));
      return ``;
    }

    cmd_itemcget(args) {
      const item = this.first(args[0]);
      if (item === null) return ``;
      const key = to_str(args[1]).replace(/^-/, ``);
      if (!(key in item.options)) throw new TclError(`unknown option "${to_str(args[1])}"`);
      return item.options[key];
    }

    cmd_delete(args) {
      for (const spec of args) {
        for (const i of this.find(spec)) {
          const gone = this.items.get(i);
          this.items.delete(i);
          if (gone && gone.type === `window`) {
            const w = this.app.widgets.get(to_str(gone.options.window));
            if (w) this._release(w, gone);
            this.app.schedule_layout();
          }
          this.order.splice(this.order.indexOf(i), 1);
          this.dirty.delete(i);
          this.deleted.push(i);
          if (this.current === i) this.current = null;
        }
      }
      this.app.schedule_render();
      return ``;
    }

    cmd_move(args) {
      const dx = get_double(args[1]);
      const dy = get_double(args[2]);
      for (const i of this.find(args[0])) {
        const item = this.items.get(i);
        item.coords = item.coords.map((v, k) => v + (k % 2 === 0 ? dx : dy));
        this._touch(item);
      }
      return ``;
    }

    cmd_moveto(args) {
      const items = this.find(args[0]);
      if (!items.length) return ``;
      const boxes = items.map((i) => this.bbox(this.items.get(i)));
      const x0 = Math.min(...boxes.map((b) => b[0]));
      const y0 = Math.min(...boxes.map((b) => b[1]));
      const x =
        args.length > 1 && to_str(args[1]) !== `` ? get_double(args[1]) : x0;
      const y =
        args.length > 2 && to_str(args[2]) !== `` ? get_double(args[2]) : y0;
      return this.cmd_move([args[0], x - x0, y - y0]);
    }

    cmd_scale(args) {
      const [ox, oy, sx, sy] = args.slice(1, 5).map((a) => get_double(a));
      for (const i of this.find(args[0])) {
        const item = this.items.get(i);
        item.coords = item.coords.map((v, k) =>
          k % 2 === 0 ? ox + (v - ox) * sx : oy + (v - oy) * sy,
        );
        this._touch(item);
      }
      return ``;
    }

    _restack(ids, ref, above) {
      const moving = this.order.filter((i) => ids.has(i));
      if (!moving.length) return;
      const rest = this.order.filter((i) => !ids.has(i));
      if (ref === null || ref === undefined) {
        this.order = above ? [...rest, ...moving] : [...moving, ...rest];
        const targets = above ? moving : [...moving].reverse();
        for (const i of targets) this.order_ops.push([above ? `top` : `bottom`, i]);
      } else {
        const pos = rest.indexOf(ref) + (above ? 1 : 0);
        this.order = [...rest.slice(0, pos), ...moving, ...rest.slice(pos)];
        let anchor = ref;
        for (const i of moving) {
          this.order_ops.push([above ? `after` : `before`, i, anchor]);
          if (above) anchor = i;
        }
      }
      this.app.schedule_render();
    }

    cmd_raise(args) {
      const ids = new Set(this.find(args[0]));
      let ref = null;
      if (args.length > 1) {
        const refs = this.find(args[1]);
        if (!refs.length) {
          throw new TclError(`tagOrId "${to_str(args[1])}" doesn't match any items`);
        }
        ref = refs[refs.length - 1];
      }
      this._restack(ids, ref, true);
      return ``;
    }

    cmd_lower(args) {
      const ids = new Set(this.find(args[0]));
      let ref = null;
      if (args.length > 1) {
        const refs = this.find(args[1]);
        if (!refs.length) {
          throw new TclError(`tagOrId "${to_str(args[1])}" doesn't match any items`);
        }
        ref = refs[0];
      }
      this._restack(ids, ref, false);
      return ``;
    }

    cmd_find(args) {
      const sub = to_str(args[0]);
      const rest = args.slice(1);
      if (sub === `all`) return this.order.slice();
      if (sub === `withtag`) return this.find(rest[0]);
      if (sub === `above` || sub === `below`) {
        const found = this.find(rest[0]);
        if (!found.length) return [];
        const pos = this.order.indexOf(sub === `above` ? found[found.length - 1] : found[0]);
        const target = sub === `above` ? pos + 1 : pos - 1;
        return target >= 0 && target < this.order.length ? [this.order[target]] : [];
      }
      if (sub === `overlapping` || sub === `enclosed`) {
        const [x1, y1, x2, y2] = rest.slice(0, 4).map((v) => get_double(v));
        const result = [];
        for (const i of this.order) {
          const [bx1, by1, bx2, by2] = this.bbox(this.items.get(i));
          if (sub === `overlapping` && bx1 <= x2 && bx2 >= x1 && by1 <= y2 && by2 >= y1) {
            result.push(i);
          } else if (sub === `enclosed` && bx1 > x1 && bx2 < x2 && by1 > y1 && by2 < y2) {
            result.push(i);
          }
        }
        return result;
      }
      if (sub === `closest`) {
        const x = get_double(rest[0]);
        const y = get_double(rest[1]);
        let best = null;
        let best_d = null;
        for (const i of [...this.order].reverse()) {
          const [bx1, by1, bx2, by2] = this.bbox(this.items.get(i));
          const dx = Math.max(bx1 - x, 0, x - bx2);
          const dy = Math.max(by1 - y, 0, y - by2);
          const d = Math.hypot(dx, dy);
          if (best_d === null || d < best_d) {
            best = i;
            best_d = d;
          }
        }
        return best !== null ? [best] : [];
      }
      throw new TclError(
        `bad search command "${sub}": must be above, all, below, closest, enclosed, overlapping, or withtag`,
      );
    }

    cmd_addtag(args) {
      const tag = to_str(args[0]);
      const ids =
        to_str(args[1]) !== `withtag` ? this.cmd_find(args.slice(1)) : this.find(args[2]);
      for (const i of ids) {
        const item = this.items.get(i);
        if (!item.options.tags.includes(tag)) item.options.tags = [...item.options.tags, tag];
      }
      return ``;
    }

    cmd_dtag(args) {
      const tag = args.length > 1 ? to_str(args[1]) : to_str(args[0]);
      for (const i of this.find(args[0])) {
        const item = this.items.get(i);
        item.options.tags = item.options.tags.filter((t) => t !== tag);
      }
      return ``;
    }

    cmd_gettags(args) {
      const item = this.first(args[0]);
      return item ? item.options.tags.slice() : [];
    }

    cmd_type(args) {
      const item = this.first(args[0]);
      return item ? item.type : ``;
    }

    cmd_bbox(args) {
      const boxes = [];
      for (const spec of args) {
        for (const i of this.find(spec)) boxes.push(this.bbox(this.items.get(i)));
      }
      if (!boxes.length) return ``;
      return [
        Math.floor(Math.min(...boxes.map((b) => b[0]))),
        Math.floor(Math.min(...boxes.map((b) => b[1]))),
        Math.ceil(Math.max(...boxes.map((b) => b[2]))),
        Math.ceil(Math.max(...boxes.map((b) => b[3]))),
      ];
    }

    cmd_bind(args) {
      const tag = to_str(args[0]);
      if (!this.item_bindings_table.has(tag)) this.item_bindings_table.set(tag, new Map());
      const table = this.item_bindings_table.get(tag);
      if (args.length === 1) return [...table.keys()];
      const patterns = parse_sequence(to_str(args[1]));
      const key = this.app._canonical_sequence(patterns);
      if (args.length === 2) return table.get(key)?.script ?? ``;
      const script = to_str(args[2]);
      if (!script) table.delete(key);
      else if (script.startsWith(`+`) && table.has(key)) {
        table.get(key).script += `\n` + script.slice(1);
      } else {
        table.set(key, { script: script.replace(/^\++/, ``), patterns });
      }
      this.app.schedule_render();
      return ``;
    }

    cmd_focus() {
      return ``;
    }

    cmd_postscript(args) {
      /* canvas postscript: renders the items to PostScript. With -file the text is
         written through app.fs.write (the virtual filesystem), otherwise it is
         returned. Images, windows and bitmaps are not drawn; smooth is ignored. */
      const known = [
        `-channel`, `-colormap`, `-colormode`, `-file`, `-fontmap`, `-height`, `-pageanchor`,
        `-pageheight`, `-pagewidth`, `-pagex`, `-pagey`, `-rotate`, `-width`, `-x`, `-y`,
      ];
      if (args.length % 2) throw new TclError(`value for "${to_str(args[args.length - 1])}" missing`);
      const opts = {};
      for (let i = 0; i < args.length; i += 2) {
        const key = to_str(args[i]);
        if (!known.includes(key)) throw new TclError(`unknown option "${key}"`);
        opts[key] = args[i + 1];
      }
      const mode = to_str(opts[`-colormode`] ?? `color`);
      if (![`color`, `gray`, `grey`, `mono`].includes(mode)) {
        throw new TclError(`bad colormode "${mode}": must be color, gray, or mono`);
      }

      const inset = this.inset();
      const x0 = `-x` in opts ? get_pixels(opts[`-x`]) : this.x_origin;
      const y0 = `-y` in opts ? get_pixels(opts[`-y`]) : this.y_origin;
      const w = `-width` in opts
        ? get_pixels(opts[`-width`])
        : Math.max(1, (this.width || this.options.width + 2 * inset) - 2 * inset);
      const h = `-height` in opts
        ? get_pixels(opts[`-height`])
        : Math.max(1, (this.height || this.options.height + 2 * inset) - 2 * inset);

      const points = (v) => {
        const m = /^\s*([-+]?[\d.]+)\s*([cimp]?)\s*$/.exec(to_str(v));
        if (!m) throw new TclError(`bad screen distance "${to_str(v)}"`);
        return parseFloat(m[1]) * { '': 1, p: 1, i: 72, c: 72 / 2.54, m: 72 / 25.4 }[m[2]];
      };
      let scale = 0.75; // 1 pixel = 72/96 pt, like Tk at 96 dpi
      if (`-pagewidth` in opts) scale = points(opts[`-pagewidth`]) / w;
      else if (`-pageheight` in opts) scale = points(opts[`-pageheight`]) / h;
      const rotate = [`1`, `true`, `yes`, `on`].includes(to_str(opts[`-rotate`] ?? `0`).toLowerCase());
      const pw = (rotate ? h : w) * scale;
      const ph = (rotate ? w : h) * scale;
      const px = `-pagex` in opts ? points(opts[`-pagex`]) : 306;
      const py = `-pagey` in opts ? points(opts[`-pagey`]) : 396;
      const anchor = to_str(opts[`-pageanchor`] ?? `center`);
      const left = anchor.includes(`w`) ? px : anchor.includes(`e`) ? px - pw : px - pw / 2;
      const bottom = anchor.includes(`s`) ? py : anchor.includes(`n`) ? py - ph : py - ph / 2;

      const n = (v) => String(Math.round(v * 1000) / 1000);
      let ctx2d = null;
      const rgb = (name) => {
        let hex = css_color(name);
        if (!hex.startsWith(`#`)) {
          try {
            ctx2d = ctx2d || document.createElement(`canvas`).getContext(`2d`);
            ctx2d.fillStyle = `#000000`;
            ctx2d.fillStyle = hex;
            hex = ctx2d.fillStyle;
          } catch {
            hex = `#000000`;
          }
        }
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
        return m ? [1, 2, 3].map((k) => parseInt(m[k], 16) / 255) : [0, 0, 0];
      };
      const setcolor = (name) => {
        const [r, g, b] = rgb(name);
        const gray = 0.3 * r + 0.59 * g + 0.11 * b;
        if (mode === `color`) return `${n(r)} ${n(g)} ${n(b)} setrgbcolor`;
        if (mode === `mono`) return `${gray >= 0.5 ? 1 : 0} setgray`;
        return `${n(gray)} setgray`;
      };
      const ps_str = (s) =>
        Array.from(s).map((ch) => {
          const c = ch.codePointAt(0);
          if (ch === `\\` || ch === `(` || ch === `)`) return `\\` + ch;
          return c >= 32 && c < 127 ? ch : `?`;
        }).join(``);
      const ps_font = (font) => {
        const fam = String(font.family).toLowerCase();
        const bold = font.weight === `bold`;
        const italic = font.slant === `italic`;
        if ([`courier new`, `consolas`, `lucida console`, `fixedsys`, `terminal`, `courier`].includes(fam)) {
          return `Courier` + (bold || italic ? `-` + (bold ? `Bold` : ``) + (italic ? `Oblique` : ``) : ``);
        }
        if ([`times new roman`, `georgia`, `cambria`, `book antiqua`, `garamond`, `palatino linotype`, `times`].includes(fam)) {
          return `Times-` + (bold && italic ? `BoldItalic` : bold ? `Bold` : italic ? `Italic` : `Roman`);
        }
        return `Helvetica` + (bold || italic ? `-` + (bold ? `Bold` : ``) + (italic ? `Oblique` : ``) : ``);
      };

      const out = [
        `%!PS-Adobe-3.0 EPSF-3.0`,
        `%%Creator: PyThonny Tk`,
        `%%BoundingBox: ${Math.floor(left)} ${Math.floor(bottom)} ${Math.ceil(left + pw)} ${Math.ceil(bottom + ph)}`,
        `%%Pages: 1`,
        `%%EndComments`,
        `%%Page: 1 1`,
        `save`,
        `gsave`,
        rotate
          ? `[0 ${n(scale)} ${n(scale)} 0 ${n(left)} ${n(bottom)}] concat`
          : `[${n(scale)} 0 0 ${n(-scale)} ${n(left)} ${n(bottom + ph)}] concat`,
        `${n(-x0)} ${n(-y0)} translate`,
        `newpath ${n(x0)} ${n(y0)} moveto ${n(w)} 0 rlineto 0 ${n(h)} rlineto ${n(-w)} 0 rlineto closepath clip newpath`,
      ];

      const paint = (o, can_fill) => {
        if (can_fill && o.fill) out.push(`gsave`, setcolor(o.fill), `fill`, `grestore`);
        if (o.outline) {
          const dash = _dash_array(o.dash, o.width);
          out.push(
            `gsave`, `${n(o.width)} setlinewidth`, `[${dash}] 0 setdash`, setcolor(o.outline), `stroke`, `grestore`,
          );
        }
        out.push(`newpath`);
      };

      for (const id of this.order) {
        const item = this.items.get(id);
        if (!item) continue;
        const o = item.options;
        const c = item.coords;
        if (o.state === `hidden`) continue;
        if (item.type === `line`) {
          if (!o.fill) continue;
          const cap = { butt: 0, round: 1, projecting: 2 }[o.capstyle] ?? 0;
          const join = { miter: 0, round: 1, bevel: 2 }[o.joinstyle] ?? 1;
          out.push(`gsave`, `newpath`, `${n(c[0])} ${n(c[1])} moveto`);
          for (let k = 2; k < c.length; k += 2) out.push(`${n(c[k])} ${n(c[k + 1])} lineto`);
          out.push(
            `${n(o.width)} setlinewidth`, `${cap} setlinecap`, `${join} setlinejoin`,
            `[${_dash_array(o.dash, o.width)}] 0 setdash`, setcolor(o.fill), `stroke`, `grestore`,
          );
          for (const head of this._arrows(item)) {
            out.push(`gsave`, setcolor(o.fill), `newpath ${n(head[0])} ${n(head[1])} moveto`);
            for (let k = 2; k < head.length; k += 2) out.push(`${n(head[k])} ${n(head[k + 1])} lineto`);
            out.push(`closepath fill`, `grestore`);
          }
        } else if (item.type === `rectangle`) {
          out.push(`newpath ${n(c[0])} ${n(c[1])} moveto ${n(c[2])} ${n(c[1])} lineto ${n(c[2])} ${n(c[3])} lineto ${n(c[0])} ${n(c[3])} lineto closepath`);
          paint(o, true);
        } else if (item.type === `polygon`) {
          out.push(`newpath ${n(c[0])} ${n(c[1])} moveto`);
          for (let k = 2; k < c.length; k += 2) out.push(`${n(c[k])} ${n(c[k + 1])} lineto`);
          out.push(`closepath`);
          paint(o, true);
        } else if (item.type === `oval`) {
          const [cx, cy] = [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2];
          const [rx, ry] = [Math.abs(c[2] - c[0]) / 2, Math.abs(c[3] - c[1]) / 2];
          out.push(`newpath matrix currentmatrix ${n(cx)} ${n(cy)} translate ${n(rx)} ${n(ry)} scale 0 0 1 0 360 arc setmatrix closepath`);
          paint(o, true);
        } else if (item.type === `arc`) {
          const [cx, cy] = [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2];
          const [rx, ry] = [Math.abs(c[2] - c[0]) / 2, Math.abs(c[3] - c[1]) / 2];
          const a1 = -o.start;
          const a2 = -(o.start + o.extent);
          const style = o.style;
          out.push(
            `newpath matrix currentmatrix ${n(cx)} ${n(cy)} translate ${n(rx)} ${n(ry)} scale` +
              (style === `pieslice` ? ` 0 0 moveto` : ``) +
              ` 0 0 1 ${n(a1)} ${n(a2)} ${o.extent >= 0 ? `arcn` : `arc`} setmatrix` +
              (style === `arc` ? `` : ` closepath`),
          );
          paint(o, style !== `arc`);
        } else if (item.type === `text`) {
          if (!o.fill) continue;
          const box = this._text_box(item);
          const font = box.font;
          const ascent = font.metrics()[0];
          out.push(
            `gsave`, `${n(c[0])} ${n(c[1])} translate`, `${n(-(o.angle || 0))} rotate`,
            setcolor(o.fill), `/${ps_font(font)} findfont ${font.pixels} scalefont setfont`,
          );
          box.lines.forEach((line, i) => {
            const lw = font.measure(line);
            const lx = o.justify === `center` ? box.x + (box.w - lw) / 2
              : o.justify === `right` ? box.x + box.w - lw : box.x;
            const by = box.y + ascent + i * font.linespace;
            out.push(`gsave ${n(lx - c[0])} ${n(by - c[1])} translate 1 -1 scale 0 0 moveto (${ps_str(line)}) show grestore`);
          });
          out.push(`grestore`);
        }
        // image / window / bitmap items are not rendered
      }

      out.push(`grestore`, `restore`, `showpage`, `%%Trailer`, `%%EOF`, ``);
      const text = out.join(`\n`);
      const path = to_str(opts[`-file`] ?? ``);
      if (path) {
        /* Як PIL.Image.save: пишемо прямо у віртуальну ФС (fsToBrowse / Sk.__jsfs);
           hooks.fs.write лишається запасним шляхом, якщо jsfs на сторінці немає. */
        const jsfs = globalThis.fsToBrowse || (globalThis.Sk && globalThis.Sk.__jsfs) || null;
        try {
          if (jsfs && typeof jsfs.write === `function`) {
            const cut = path.lastIndexOf(`/`);
            if (cut > 0 && typeof jsfs.mkdir === `function`) jsfs.mkdir(path.slice(0, cut));
            if (jsfs.write(path, text) === false) throw new Error(`недостатньо місця у сховищі`);
          } else {
            this.app.fs.write(path, text);
          }
        } catch (e) {
          throw new TclError(`couldn't open "${path}": ${e && e.message ? e.message : e}`);
        }
        return ``;
      }
      return text;
    }

    cmd_select() {
      return ``;
    }

    cmd_icursor() {
      return ``;
    }

    cmd_insert(args) {
      const item = this.first(args[0]);
      if (item !== null && item.type === `text`) {
        const text = to_str(item.options.text);
        const index = to_str(args[1]) === `end` ? text.length : get_int(args[1]);
        item.options.text = text.slice(0, index) + to_str(args[2]) + text.slice(index);
        this._touch(item);
      }
      return ``;
    }

    cmd_dchars(args) {
      const item = this.first(args[0]);
      if (item !== null && item.type === `text`) {
        const text = to_str(item.options.text);
        const first = to_str(args[1]) === `end` ? text.length : get_int(args[1]);
        const last =
          args.length < 3
            ? first
            : to_str(args[2]) === `end`
              ? text.length - 1
              : get_int(args[2]);
        item.options.text = text.slice(0, first) + text.slice(last + 1);
        this._touch(item);
      }
      return ``;
    }

    cmd_index(args) {
      const item = this.first(args[0]);
      const text = item ? to_str(item.options.text ?? ``) : ``;
      return to_str(args[1]) === `end` ? text.length : get_int(args[1]);
    }

    cmd_lift(args) {
      return this.cmd_raise(args);
    }

    cmd_imove() {
      return ``;
    }

    cmd_rchars() {
      return ``;
    }

    // ---- events and rendering ----------------------------------------------------------

    item_bindings(event) {
      /* Bindings of the item under the pointer: its tags, its id, then "all". */
      const item = event.item;
      if (item !== null && item !== undefined) {
        this.current = this.items.has(item) ? item : null;
      } else if ([4, 5, 6, 7, 8].includes(event.type)) {
        this.current = null;
      }
      if (this.current === null) return [];
      const tags = [...this.items.get(this.current).options.tags, String(this.current), `all`];
      return tags
        .filter((t) => this.item_bindings_table.has(t))
        .map((t) => this.item_bindings_table.get(t));
    }

    wants_item_events() {
      return this.item_bindings_table.size > 0;
    }

    item_props(item) {
      const o = item.options;
      const props = { type: item.type, state: o.state ?? `` };
      if (item.type === `line`) {
        Object.assign(props, {
          points: item.coords,
          stroke: o.fill ? css_color(o.fill) : ``,
          width: o.width,
          dash: _dash_array(o.dash, o.width),
          cap: { butt: `butt`, projecting: `square`, round: `round` }[o.capstyle] ?? `butt`,
          join: { miter: `miter`, bevel: `bevel`, round: `round` }[o.joinstyle] ?? `round`,
          smooth: o.smooth,
          arrows: this._arrows(item),
        });
      } else if ([`rectangle`, `oval`, `polygon`, `arc`].includes(item.type)) {
        Object.assign(props, {
          points: item.coords,
          fill: o.fill ? css_color(o.fill) : ``,
          stroke: o.outline ? css_color(o.outline) : ``,
          width: o.width,
          dash: _dash_array(o.dash, o.width),
        });
        if (item.type === `polygon`) {
          Object.assign(props, {
            smooth: o.smooth,
            join: { miter: `miter`, bevel: `bevel`, round: `round` }[o.joinstyle] ?? `round`,
          });
        }
        if (item.type === `arc`) {
          Object.assign(props, { start: o.start, extent: o.extent, style: o.style });
        }
      } else if (item.type === `image`) {
        const name = o.image;
        const image = name && this.app.images.exists(name) ? this.app.images.get(name) : null;
        const [x, y, w, h] = this._image_box(item);
        Object.assign(props, {
          url: image ? image.url() : ``, x, y, w, h, v: image ? image.version : 0,
        });
      } else if (item.type === `text`) {
        const box = this._text_box(item);
        const font = box.font;
        const ascent = font.metrics()[0];
        Object.assign(props, {
          lines: box.lines, x: box.x, y: box.y + ascent, w: box.w,
          lh: font.linespace, font: font.css,
          fill: o.fill ? css_color(o.fill) : ``,
          justify: o.justify, angle: o.angle,
          ax: item.coords[0], ay: item.coords[1],
          underline: font.underline ? 1 : 0,
        });
      }
      return props;
    }

    _arrows(item) {
      const o = item.options;
      if (o.arrow === `none` || item.coords.length < 4) return [];
      const [d1, d2, d3] = [...o.arrowshape, 8, 10, 3].slice(0, 3);
      const result = [];
      const c = item.coords;

      const head = (tip_x, tip_y, from_x, from_y) => {
        const angle = Math.atan2(tip_y - from_y, tip_x - from_x);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const back_x = tip_x - d1 * cos;
        const back_y = tip_y - d1 * sin;
        const wing_x = tip_x - d2 * cos;
        const wing_y = tip_y - d2 * sin;
        return [
          tip_x, tip_y,
          wing_x - d3 * sin, wing_y + d3 * cos,
          back_x, back_y,
          wing_x + d3 * sin, wing_y - d3 * cos,
        ];
      };

      if (o.arrow === `first` || o.arrow === `both`) {
        result.push(head(c[0], c[1], c[2], c[3]));
      }
      if (o.arrow === `last` || o.arrow === `both`) {
        result.push(head(c[c.length - 2], c[c.length - 1], c[c.length - 4], c[c.length - 3]));
      }
      return result;
    }

    render() {
      const o = this.options;
      return {
        kind: `canvas`, bg: o.background, relief: o.relief, bd: o.borderwidth,
        hl: o.highlightthickness, ox: this.x_origin + this.inset(),
        oy: this.y_origin + this.inset(),
        items_bound: this.wants_item_events(),
      };
    }

    _mark_changed_images() {
      for (const item_id of [...this.image_versions.keys()]) {
        const item = this.items.get(item_id);
        if (item === undefined || item.type !== `image`) {
          this.image_versions.delete(item_id);
          continue;
        }
        const name = item.options.image;
        const image = name ? this.app.images.images.get(to_str(name)) : undefined;
        const version = image !== undefined && image !== null ? image.version : null;
        if (version !== this.image_versions.get(item_id)) {
          this.image_versions.set(item_id, version);
          this.dirty.add(item_id);
        }
      }
    }

    extra_ops() {
      this._mark_changed_images();
      if (!this.sent_full) {
        // First render (or after a reset): send every item in order.
        this.sent_full = true;
        this.dirty = new Set(this.order);
        this.order_ops = [];
        const ops = [{
          op: `canvas`, reset: true,
          items: this.order.map((i) => [i, this.item_props(this.items.get(i))]),
        }];
        this.dirty.clear();
        this.deleted = [];
        return ops;
      }
      if (!this.dirty.size && !this.deleted.length && !this.order_ops.length) return [];
      const ops = [{
        op: `canvas`,
        items: this.order
          .filter((i) => this.dirty.has(i))
          .map((i) => [i, this.item_props(this.items.get(i))]),
        deleted: this.deleted.slice(),
        order: this.order_ops.map((op) => op.slice()),
      }];
      this.dirty = new Set();
      this.deleted = [];
      this.order_ops = [];
      return ops;
    }
  }

  const WIDGETS = { canvas: Canvas };

  ns.Canvas = Canvas;
  ns.WIDGETS = WIDGETS;
  ns.canvasm = { Canvas, WIDGETS };
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// themed.js
// ============================================================

(function (ns) {
  "use strict";
  var TclError = ns.TclError;
  var to_str = ns.to_str;
  var split_list = ns.split_list;
  var get_int = ns.get_int;
  var get_double = ns.get_double;
  var get_boolean = ns.get_boolean;
  var get_pixels = ns.get_pixels;
  var Widget = ns.Widget;
  var options = ns.options;
  var merge_options = ns.merge_options;
  var events = ns.events;
  var css_color = ns.css_color;
  var ANCHORS = [`n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`, `center`];

  // Port of pythonny_tk/themed.py: the ttk style database.
  //
  // Scope: the StyleDB command surface ("ttk::style ...") plus the state-map
  // helpers. The builtin vista/clam style *tables* (_vista_theme, _clam_theme),
  // the default layout specs (_LAYOUTS) and the themed widget classes live in
  // themed.py and are deferred: theme records are created empty here, so lookups
  // return the caller's default until the tables are ported. The page draws the
  // "vista"/"clam" look itself from widget "parts", so an empty StyleDB still
  // renders sensible widgets.


  // ---- script splitting ----------------------------------------------------------------

  function split_commands(script) {
    // Splits a Tcl script into commands at newlines and semicolons outside braces.
    const commands = [];
    let current = "";
    let depth = 0;
    let quoted = false;
    for (const ch of to_str(script)) {
      if (ch === `"` && depth === 0) {
        quoted = !quoted;
      } else if (ch === `{` && !quoted) {
        depth += 1;
      } else if (ch === `}` && !quoted) {
        depth -= 1;
      }
      if ((ch === `\n` || ch === `;`) && depth === 0 && !quoted) {
        commands.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    commands.push(current);
    return commands.map((c) => c.trim()).filter((c) => c !== ``);
  }

  // ---- states ---------------------------------------------------------------------------

  const FLAGS = [
    `active`, `disabled`, `focus`, `pressed`, `selected`, `background`, `readonly`,
    `alternate`, `invalid`, `hover`, `user1`, `user2`, `user3`,
  ];

  function parse_statespec(spec) {
    const words = Array.isArray(spec) ? spec.map((w) => to_str(w)) : split_list(spec);
    for (const word of words) {
      const name = word.startsWith(`!`) ? word.slice(1) : word;
      if (!FLAGS.includes(name)) throw new TclError(`Invalid state name ${name}`);
    }
    return words;
  }

  function state_matches(spec, flags) {
    for (const word of spec) {
      if (word.startsWith(`!`)) {
        if (flags.has(word.slice(1))) return false;
      } else if (!flags.has(word)) {
        return false;
      }
    }
    return true;
  }

  // ---- style chains ---------------------------------------------------------------------

  function style_chain(style) {
    /* "My.TButton" -> My.TButton, TButton, "." (the parent drops the first part). */
    const chain = [];
    let name = style;
    while (name && name !== `.`) {
      chain.push(name);
      name = name.includes(`.`) ? name.slice(name.indexOf(`.`) + 1) : ``;
    }
    chain.push(`.`);
    return chain;
  }

  // Default layouts (what "ttk::style layout" reports; drawing does not use them).
  // Deferred together with themed.py's widget classes.
  const _LAYOUTS = {};

  const _ELEMENT_NAME = /(?<![\w.-])((?:[A-Z]\w*\.)+[a-z]\w*)/g;
  const _ELEMENTS = Array.from(
    new Set(Object.values(_LAYOUTS).flatMap((layout) => Array.from(layout.matchAll(_ELEMENT_NAME), (m) => m[0]))),
  ).sort();

  // ---- themes ---------------------------------------------------------------------------

  const THEMES = [
    `winnative`, `clam`, `alt`, `default`, `classic`, `vista`, `xpnative`,
  ];
  // The page draws two looks; Windows themes share the vista one.
  const LOOKS = {
    vista: `vista`, winnative: `vista`, xpnative: `vista`,
    clam: `clam`, alt: `clam`, default: `clam`, classic: `clam`,
  };

  /* The background colour of each look: the ttk frames, the labels and the
     root window use it, so switching the theme repaints them. */
  const LOOK_BACKGROUNDS = {
    vista: `#f0f0f0`,
    clam: `#dcdad5`,
  };

  function builtin_theme(name) {
    return {
      look: LOOKS[name],
      parent: null,
      configure: {},
      map: {},
      layout: {},
      elements: new Set(),
    };
  }

  class StyleDB {
    constructor(app) {
      this.app = app;
      this.themes = {};
      for (const name of THEMES) this.themes[name] = builtin_theme(name);
      this.current = `vista`;
      app.vars[`ttk::currentTheme`] = this.current;
    }

    get theme() {
      return this.themes[this.current];
    }

    get look() {
      return this.theme.look;
    }

    get background() {
      return LOOK_BACKGROUNDS[this.look] ?? LOOK_BACKGROUNDS.vista;
    }

    lookup(style, option, flags = new Set(), default_ = null) {
      const theme = this.theme;
      const chain = style_chain(style);
      for (const name of chain) {
        const entries = (theme.map[name] ?? {})[option] ?? [];
        for (const [spec, value] of entries) {
          if (state_matches(spec, flags)) return value;
        }
      }
      for (const name of chain) {
        const settings = theme.configure[name];
        if (settings && Object.prototype.hasOwnProperty.call(settings, option)) return settings[option];
      }
      return default_;
    }

    layout_of(style) {
      for (const name of style_chain(style)) {
        if (Object.prototype.hasOwnProperty.call(this.theme.layout, name)) return this.theme.layout[name];
        if (Object.prototype.hasOwnProperty.call(_LAYOUTS, name)) return _LAYOUTS[name];
      }
      return null;
    }

    use(name) {
      name = to_str(name);
      if (!Object.prototype.hasOwnProperty.call(this.themes, name)) {
        throw new TclError(`theme "${name}" doesn't exist`);
      }
      this.current = name;
      this.app.vars[`ttk::currentTheme`] = name;
      this.app.dispatch_all_virtual(`ThemeChanged`);
      this.app.schedule_layout();
    }

    // ---- the command -------------------------------------------------------------------

    command(args) {
      if (!args.length) {
        throw new TclError(`wrong # args: should be "ttk::style option ?arg ...?"`);
      }
      const sub = to_str(args[0]);
      const rest = args.slice(1);
      const handler = this[`_cmd_${sub}`];
      if (typeof handler !== `function`) {
        throw new TclError(`bad command "${sub}": must be configure, element, layout, lookup, map, or theme`);
      }
      return handler.call(this, rest);
    }

    _cmd_configure(args) {
      if (!args.length) {
        throw new TclError(`wrong # args: should be "ttk::style configure style ?-option ?value...??"`);
      }
      const style = to_str(args[0]);
      if (!Object.prototype.hasOwnProperty.call(this.theme.configure, style)) this.theme.configure[style] = {};
      const settings = this.theme.configure[style];
      const rest = args.slice(1);
      if (!rest.length) {
        const out = [];
        for (const [k, v] of Object.entries(settings)) out.push(`-${k}`, v);
        return out;
      }
      if (rest.length === 1) {
        return settings[to_str(rest[0]).replace(/^-/, ``)] ?? ``;
      }
      if (rest.length % 2) {
        throw new TclError(`value for "${to_str(rest[rest.length - 1])}" missing`);
      }
      for (let i = 0; i < rest.length; i += 2) {
        settings[to_str(rest[i]).replace(/^-/, ``)] = to_str(rest[i + 1]);
      }
      this.app.schedule_layout();
      return ``;
    }

    _cmd_map(args) {
      if (!args.length) {
        throw new TclError(`wrong # args: should be "ttk::style map style ?-option ?value...??"`);
      }
      const style = to_str(args[0]);
      if (!Object.prototype.hasOwnProperty.call(this.theme.map, style)) this.theme.map[style] = {};
      const maps = this.theme.map[style];
      const rest = args.slice(1);

      const flat = (entries) => {
        const out = [];
        for (const [spec, value] of entries) out.push(spec.join(` `), value);
        return out;
      };

      if (!rest.length) {
        const out = [];
        for (const [k, v] of Object.entries(maps)) out.push(`-${k}`, flat(v));
        return out;
      }
      if (rest.length === 1) {
        return flat(maps[to_str(rest[0]).replace(/^-/, ``)] ?? []);
      }
      if (rest.length % 2) {
        throw new TclError(`value for "${to_str(rest[rest.length - 1])}" missing`);
      }
      for (let i = 0; i < rest.length; i += 2) {
        const words = split_list(rest[i + 1]);
        if (words.length % 2) throw new TclError(`Odd number of elements in state map`);
        const entries = [];
        for (let j = 0; j < words.length; j += 2) {
          entries.push([parse_statespec(to_str(words[j])), to_str(words[j + 1])]);
        }
        maps[to_str(rest[i]).replace(/^-/, ``)] = entries;
      }
      this.app.schedule_layout();
      return ``;
    }

    _cmd_lookup(args) {
      if (args.length < 2) {
        throw new TclError(`wrong # args: should be "ttk::style lookup style -option ?state? ?default?"`);
      }
      const flags = new Set();
      if (args.length > 2) {
        for (const w of parse_statespec(args[2])) {
          if (!w.startsWith(`!`)) flags.add(w);
        }
      }
      const default_ = args.length > 3 ? to_str(args[3]) : ``;
      const value = this.lookup(to_str(args[0]), to_str(args[1]).replace(/^-/, ``), flags, null);
      return value === null ? default_ : value;
    }

    _cmd_layout(args) {
      if (!args.length) {
        throw new TclError(`wrong # args: should be "ttk::style layout name ?layoutSpec?"`);
      }
      const style = to_str(args[0]);
      if (args.length > 1) {
        const spec = args[1];
        this.theme.layout[style] = to_str(spec).trim() === `null` ? `` : spec;
        this.app.schedule_layout();
        return ``;
      }
      const layout = this.layout_of(style);
      if (layout === null) throw new TclError(`Layout ${style} not found`);
      return layout;
    }

    _cmd_element(args) {
      const sub = args.length ? to_str(args[0]) : ``;
      if (sub === `create`) {
        this.theme.elements.add(to_str(args[1]));
        return ``;
      }
      if (sub === `names`) {
        return Array.from(new Set([..._ELEMENTS, ...this.theme.elements])).sort();
      }
      if (sub === `options`) return [];
      throw new TclError(`bad option "${sub}": must be create, names, or options`);
    }

    _cmd_theme(args) {
      const sub = args.length ? to_str(args[0]) : ``;
      if (sub === `names`) return Object.keys(this.themes);
      if (sub === `use`) {
        if (args.length === 1) return this.current;
        this.use(args[1]);
        return ``;
      }
      if (sub === `create`) {
        const name = to_str(args[1]);
        if (Object.prototype.hasOwnProperty.call(this.themes, name)) {
          throw new TclError(`Theme ${name} already exists`);
        }
        const opts = {};
        for (let i = 2; i + 1 < args.length; i += 2) opts[to_str(args[i])] = args[i + 1];
        const parent = to_str(opts[`-parent`] ?? `default`);
        if (!Object.prototype.hasOwnProperty.call(this.themes, parent)) {
          throw new TclError(`theme "${parent}" doesn't exist`);
        }
        const base = this.themes[parent];
        this.themes[name] = {
          look: base.look,
          parent: parent,
          configure: Object.fromEntries(Object.entries(base.configure).map(([k, v]) => [k, { ...v }])),
          map: Object.fromEntries(
            Object.entries(base.map).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([o, e]) => [o, e.map((x) => [x[0], x[1]])]))]),
          ),
          layout: { ...base.layout },
          elements: new Set(base.elements),
        };
        if (Object.prototype.hasOwnProperty.call(opts, `-settings`)) this._settings(name, opts[`-settings`]);
        return ``;
      }
      if (sub === `settings`) {
        const name = to_str(args[1]);
        if (!Object.prototype.hasOwnProperty.call(this.themes, name)) {
          throw new TclError(`theme "${name}" doesn't exist`);
        }
        this._settings(name, args[2]);
        return ``;
      }
      if (sub === `styles`) return Object.keys(this.theme.configure);
      throw new TclError(`bad option "${sub}": must be create, names, settings, styles, or use`);
    }

    _settings(name, script) {
      // Runs a settings script with `name` as the current theme.
      const saved = this.current;
      this.current = name;
      try {
        for (const command of split_commands(script)) this.app.call(...split_list(command));
      } finally {
        this.current = saved;
      }
      this.app.schedule_layout();
    }
  }

  // ---- ttk::notebook ------------------------------------------------------------------------

  const NB_TAB_OPTS = [`padding`, `sticky`, `state`, `text`, `image`, `compound`, `underline`];

  function nb_pad(value, fallback) {
    let list;
    try {
      list = split_list(to_str(value)).map((v) => get_pixels(v));
    } catch (e) {
      return fallback;
    }
    if (!list.length || list.length > 4) return fallback;
    const [a, b, c, d] = list;
    if (list.length === 1) return [a, a, a, a];
    if (list.length === 2) return [a, b, a, b];
    if (list.length === 3) return [a, b, c, b];
    return [a, b, c, d];
  }

  class Notebook extends Widget {
    static tk_class = `TNotebook`;
    static OPTIONS = options(
      [`class`, `class`, `Class`, ``],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`height`, `height`, `Height`, 0, `pixels`],
      [`padding`, `padding`, `Padding`, ``],
      [`style`, `style`, `Style`, ``],
      [`takefocus`, `takeFocus`, `TakeFocus`, `ttk::takefocus`],
      [`width`, `width`, `Width`, 0, `pixels`],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this.tabs = [];
      this.selected = null; // the tab record that is shown
      this.traversal = false;
    }

    // ---- style helpers -------------------------------------------------------------------

    get look() {
      return this.app.ttk.look;
    }

    tab_style() {
      return (to_str(this.options.style) || `TNotebook`) + `.Tab`;
    }

    lookup(style, option, flags = []) {
      return this.app.ttk.lookup(style, option, new Set(flags), null);
    }

    tab_font() {
      return this.app.fonts.get(this.lookup(this.tab_style(), `font`) ?? `TkDefaultFont`);
    }

    // ---- tab records ----------------------------------------------------------------------

    visible_tabs() {
      return this.tabs.filter((t) => t.state !== `hidden`);
    }

    find_tab(widget) {
      return this.tabs.find((t) => t.widget === widget) ?? null;
    }

    parse_tab_options(tab, args) {
      if (args.length % 2) throw new TclError(`value for "${to_str(args[args.length - 1])}" missing`);
      for (let i = 0; i < args.length; i += 2) {
        const raw = to_str(args[i]).replace(/^-/, ``);
        const hits = NB_TAB_OPTS.filter((o) => o === raw);
        const found = hits.length ? hits : raw ? NB_TAB_OPTS.filter((o) => o.startsWith(raw)) : [];
        if (found.length !== 1) {
          throw new TclError(`unknown option "${to_str(args[i])}"`);
        }
        const key = found[0];
        const value = args[i + 1];
        const s = to_str(value);
        if (key === `state`) {
          const m = [`normal`, `disabled`, `hidden`].filter((c) => s && c.startsWith(s));
          if (m.length !== 1) throw new TclError(`bad state "${s}": must be disabled, hidden, or normal`);
          tab.state = m[0];
        } else if (key === `underline`) {
          tab.underline = get_int(value);
        } else if (key === `compound`) {
          const all = [`none`, `text`, `image`, `center`, `top`, `bottom`, `left`, `right`];
          const m = all.filter((c) => s && c.startsWith(s));
          if (m.length !== 1) {
            throw new TclError(`bad compound "${s}": must be none, text, image, center, top, bottom, left, or right`);
          }
          tab.compound = m[0];
        } else if (key === `image`) {
          if (s) this.app.images.get(s);
          tab.image = s;
        } else if (key === `sticky`) {
          if (/[^nsew, ]/i.test(s)) {
            throw new TclError(`Invalid sticky specification "${s}"`);
          }
          tab.sticky = s;
        } else if (key === `padding`) {
          nb_pad(value, null) === null && s !== `` && (() => { throw new TclError(`Invalid padding "${s}"`); })();
          tab.padding = s || `0`;
        } else {
          tab.text = s;
        }
      }
    }

    tab_option(tab, key) {
      return {
        padding: tab.padding, sticky: tab.sticky, state: tab.state, text: tab.text,
        image: tab.image, compound: tab.compound, underline: tab.underline,
      }[key];
    }

    // Resolves a tab specification to an index (Tk: index, current, end, @x,y, path).
    resolve(spec, end_ok = false) {
      const s = to_str(spec);
      if (s === `current`) {
        const at = this.selected ? this.tabs.indexOf(this.selected) : -1;
        if (at === -1) throw new TclError(`Invalid slave specification current`);
        return at;
      }
      if (s === `end`) return end_ok || true ? this.tabs.length : 0;
      if (s.startsWith(`@`)) {
        const m = /^@(-?\d+),(-?\d+)$/.exec(s);
        if (!m) throw new TclError(`Invalid slave specification ${s}`);
        const hit = this.hit_test(Number(m[1]), Number(m[2]));
        if (!hit || !hit.tab) throw new TclError(`Invalid slave specification ${s}`);
        return this.tabs.indexOf(hit.tab);
      }
      if (s.startsWith(`.`)) {
        const w = this.app.widgets.get(s);
        const tab = w ? this.find_tab(w) : null;
        if (!tab) throw new TclError(`${s} is not managed by ${this.path}`);
        return this.tabs.indexOf(tab);
      }
      if (/^[+-]?\d+$/.test(s)) {
        const n = parseInt(s, 10);
        if (n < 0 || n > this.tabs.length) throw new TclError(`Slave index ${n} out of bounds`);
        return n;
      }
      throw new TclError(`Invalid slave specification ${s}`);
    }

    resolve_tab(spec) {
      const at = this.resolve(spec);
      if (at >= this.tabs.length) throw new TclError(`Slave index ${at} out of bounds`);
      return this.tabs[at];
    }

    // ---- selection ------------------------------------------------------------------------

    select_tab(tab, notify = true) {
      if (tab === this.selected || (tab && tab.state === `hidden`)) return;
      this.selected = tab;
      if (notify && tab) this.app.queue_virtual(this, `NotebookTabChanged`);
      this.app.schedule_layout();
    }

    pick_neighbour(index) {
      for (let i = index; i < this.tabs.length; i++) if (this.tabs[i].state === `normal`) return this.tabs[i];
      for (let i = Math.min(index, this.tabs.length) - 1; i >= 0; i--) {
        if (this.tabs[i].state === `normal`) return this.tabs[i];
      }
      return null;
    }

    forget_slave(widget) {
      /* Called by unmanage(): the widget leaves the notebook. */
      const at = this.tabs.findIndex((t) => t.widget === widget);
      if (at === -1) return;
      const was = this.tabs[at];
      this.tabs.splice(at, 1);
      widget.notebook = null;
      if (this.selected === was) {
        this.selected = null;
        const next = this.pick_neighbour(at);
        if (next) this.select_tab(next);
        else this.app.schedule_layout();
      }
    }

    // ---- commands -------------------------------------------------------------------------

    insert_tab(index, path, opts) {
      const widget = this.app.widget(path);
      if (widget.is_toplevel) throw new TclError(`can't add ${widget.path}: it's a top-level window`);
      if (widget.parent !== this) {
        throw new TclError(`can't add ${widget.path} to ${this.path}: it must be a child of ${this.path}`);
      }
      const existing = this.find_tab(widget);
      if (existing) {
        if (existing.state !== `hidden`) throw new TclError(`${widget.path} already added`);
        existing.state = `normal`;
        this.parse_tab_options(existing, opts);
        this.app.schedule_layout();
        if (!this.selected) this.select_tab(existing);
        return;
      }
      const tab = {
        widget, padding: `0`, sticky: `nsew`, state: `normal`, text: ``, image: ``,
        compound: `none`, underline: -1,
      };
      this.parse_tab_options(tab, opts);
      this.app.unmanage(widget);
      widget.manager = `notebook`;
      widget.notebook = this;
      this.tabs.splice(Math.min(index, this.tabs.length), 0, tab);
      if (!this.selected && tab.state === `normal`) this.select_tab(tab);
      this.app.schedule_layout();
    }

    cmd_add(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} add window ?options...?"`);
      this.insert_tab(this.tabs.length, args[0], args.slice(1));
      return ``;
    }

    cmd_insert(args) {
      if (args.length < 2) throw new TclError(`wrong # args: should be "${this.path} insert index window ?options...?"`);
      const spec = to_str(args[0]);
      const w = spec.startsWith(`.`) ? null : this.resolve(spec, true);
      let index = w;
      if (w === null) index = this.resolve(spec);
      const widget = this.app.widget(args[1]);
      const existing = this.find_tab(widget);
      if (existing && existing.state !== `hidden`) {
        // Moving an already managed tab.
        const from = this.tabs.indexOf(existing);
        this.tabs.splice(from, 1);
        this.tabs.splice(Math.min(from < index ? index - 1 : index, this.tabs.length), 0, existing);
        this.parse_tab_options(existing, args.slice(2));
        this.app.schedule_layout();
        return ``;
      }
      this.insert_tab(index, args[1], args.slice(2));
      return ``;
    }

    cmd_forget(args) {
      if (args.length !== 1) throw new TclError(`wrong # args: should be "${this.path} forget tabId"`);
      this.app.unmanage(this.resolve_tab(args[0]).widget);
      return ``;
    }

    cmd_hide(args) {
      if (args.length !== 1) throw new TclError(`wrong # args: should be "${this.path} hide tabId"`);
      const tab = this.resolve_tab(args[0]);
      tab.state = `hidden`;
      if (this.selected === tab) {
        this.selected = null;
        const next = this.pick_neighbour(this.tabs.indexOf(tab));
        if (next) this.select_tab(next);
      }
      this.app.schedule_layout();
      return ``;
    }

    cmd_select(args) {
      if (!args.length) return this.selected ? this.selected.widget.path : ``;
      this.select_tab(this.resolve_tab(args[0]));
      return ``;
    }

    cmd_tabs() {
      return this.tabs.map((t) => t.widget.path);
    }

    cmd_index(args) {
      if (args.length !== 1) throw new TclError(`wrong # args: should be "${this.path} index tabId"`);
      return this.resolve(args[0], true);
    }

    cmd_tab(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} tab tabId ?-option ?value ...?"`);
      const tab = this.resolve_tab(args[0]);
      const rest = args.slice(1);
      if (!rest.length) {
        const out = [];
        for (const key of NB_TAB_OPTS) out.push(`-` + key, this.tab_option(tab, key));
        return out;
      }
      if (rest.length === 1) {
        const raw = to_str(rest[0]).replace(/^-/, ``);
        const found = NB_TAB_OPTS.filter((o) => o === raw);
        const m = found.length ? found : raw ? NB_TAB_OPTS.filter((o) => o.startsWith(raw)) : [];
        if (m.length !== 1) throw new TclError(`unknown option "${to_str(rest[0])}"`);
        return this.tab_option(tab, m[0]);
      }
      this.parse_tab_options(tab, rest);
      if (tab.state !== `normal` && this.selected === tab && tab.state === `hidden`) {
        this.cmd_hide([tab.widget.path]);
      }
      this.app.schedule_layout();
      return ``;
    }

    cmd_identify(args) {
      let mode = `element`;
      let rest = args.map((a) => to_str(a));
      if (rest[0] === `element` || rest[0] === `tab`) mode = rest.shift();
      if (rest.length !== 2) throw new TclError(`wrong # args: should be "${this.path} identify element x y"`);
      const hit = this.hit_test(get_int(rest[0]), get_int(rest[1]));
      if (mode === `tab`) return hit && hit.tab ? this.tabs.indexOf(hit.tab) : ``;
      return hit ? hit.element : ``;
    }

    // ---- geometry -------------------------------------------------------------------------

    tab_boxes() {
      /* Computes the strip: per visible tab its box and content boxes. */
      const font = this.tab_font();
      const style = this.tab_style();
      const fallback = this.look === `clam` ? [6, 2, 6, 2] : [8, 2, 8, 2];
      const pad = nb_pad(this.lookup(style, `padding`) ?? ``, fallback);
      const margins = nb_pad(this.lookup(to_str(this.options.style) || `TNotebook`, `tabmargins`) ?? ``, [2, 2, 2, 0]);
      const boxes = [];
      let th = 0;
      for (const tab of this.visible_tabs()) {
        let image = null;
        if (tab.image) {
          try {
            image = this.app.images.get(tab.image);
          } catch (e) {
            image = null;
          }
        }
        const text = tab.compound === `image` ? `` : tab.text;
        const tw = text ? font.measure(text) : 0;
        const tl = text ? font.linespace : 0;
        const iw = image ? image.width : 0;
        const ih = image ? image.height : 0;
        let cw;
        let ch;
        const c = tab.compound;
        if (c === `none` && image) {
          cw = iw; ch = ih;
        } else if (!image || !text || c === `text`) {
          cw = text ? tw : iw; ch = text ? tl : ih;
        } else if (c === `top` || c === `bottom`) {
          cw = Math.max(tw, iw); ch = tl + ih + 4;
        } else if (c === `center`) {
          cw = Math.max(tw, iw); ch = Math.max(tl, ih);
        } else {
          cw = tw + iw + 4; ch = Math.max(tl, ih);
        }
        const showImage = image && c !== `text`;
        const showText = tab.compound === `none` && image ? false : Boolean(text);
        const w = cw + pad[0] + pad[2] + 2;
        const h = ch + pad[1] + pad[3] + 2;
        th = Math.max(th, h);
        boxes.push({ tab, w, h, cw, ch, tw, tl, iw, ih, image: showImage ? image : null, text: showText ? text : ``, pad });
      }
      let x = margins[0];
      for (const b of boxes) {
        b.x = x;
        x += b.w - 1;
      }
      const strip_w = boxes.length ? x + 1 + margins[2] : margins[0] + margins[2];
      return { boxes, th, strip_h: th + margins[1], strip_w, margins };
    }

    client_pad() {
      return nb_pad(this.options.padding, [0, 0, 0, 0]);
    }

    content_request() {
      const strip = this.tab_boxes();
      const o = this.options;
      let aw = 0;
      let ah = 0;
      for (const t of this.tabs) {
        const [pl, pt, pr, pb] = nb_pad(t.padding, [0, 0, 0, 0]);
        aw = Math.max(aw, t.widget.req_w + pl + pr);
        ah = Math.max(ah, t.widget.req_h + pt + pb);
      }
      if (o.width > 0) aw = o.width;
      if (o.height > 0) ah = o.height;
      const [npl, npt, npr, npb] = this.client_pad();
      const width = Math.max(aw + 2 + npl + npr, strip.strip_w);
      const height = strip.strip_h - 1 + ah + 2 + npt + npb;
      return [Math.max(width, 1), Math.max(height, 1)];
    }

    client_box(strip) {
      return { x: 0, y: strip.strip_h - 1, w: this.width, h: Math.max(0, this.height - strip.strip_h + 1) };
    }

    arrange_slaves() {
      const strip = this.tab_boxes();
      const client = this.client_box(strip);
      for (const t of this.tabs) t.widget.mapped = false;
      const tab = this.selected;
      if (!tab || tab.state === `hidden` || !this.tabs.includes(tab)) return;
      const [npl, npt, npr, npb] = this.client_pad();
      const [pl, pt, pr, pb] = nb_pad(tab.padding, [0, 0, 0, 0]);
      const ax = client.x + 1 + npl + pl;
      const ay = client.y + 1 + npt + pt;
      const aw = client.w - 2 - npl - npr - pl - pr;
      const ah = client.h - 2 - npt - npb - pt - pb;
      const w = tab.widget;
      const st = tab.sticky.toLowerCase();
      let width = st.includes(`e`) && st.includes(`w`) ? aw : Math.min(w.req_w, aw);
      let height = st.includes(`n`) && st.includes(`s`) ? ah : Math.min(w.req_h, ah);
      let x = ax;
      let y = ay;
      if (!st.includes(`w`)) x = st.includes(`e`) ? ax + aw - width : ax + Math.trunc((aw - width) / 2);
      if (!st.includes(`n`)) y = st.includes(`s`) ? ay + ah - height : ay + Math.trunc((ah - height) / 2);
      ns.set_slave_geometry(this, w, x, y, width, height);
    }

    hit_test(x, y) {
      const strip = this.tab_boxes();
      const sel = this.selected;
      const order = [...strip.boxes].sort((a, b) => (b.tab === sel) - (a.tab === sel));
      for (const b of order) {
        const exp = b.tab === sel ? 2 : 0;
        const bx = b.x - exp;
        const by = b.tab === sel ? 0 : strip.strip_h - b.h;
        const bw = b.w + 2 * exp;
        const bh = b.tab === sel ? strip.strip_h + 1 : b.h;
        if (x >= bx && x < bx + bw && y >= by && y < by + bh) {
          const inner = x >= b.x + b.pad[0] && x < b.x + b.pad[0] + b.cw && y >= by + 1 + b.pad[1];
          return { tab: b.tab, element: inner ? `label` : `tab` };
        }
      }
      const c = this.client_box(strip);
      if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return { tab: null, element: `client` };
      return null;
    }

    // ---- page events ----------------------------------------------------------------------

    page_tab(ev) {
      const tab = this.tabs[Number(ev.ix)];
      if (!tab || tab.state !== `normal`) return undefined;
      this.select_tab(tab);
      return undefined;
    }

    // ---- rendering ------------------------------------------------------------------------

    render() {
      const strip = this.tab_boxes();
      const client = this.client_box(strip);
      const style = this.tab_style();
      const look = this.look;
      const font = this.tab_font();
      const parts = [];
      const clam = look === `clam`;
      const cbg = this.lookup(to_str(this.options.style) || `TNotebook`, `background`) ?? (clam ? `#dcdad5` : null);
      const cpart = { c: `client`, x: client.x, y: client.y, w: client.w, h: client.h };
      if (cbg) cpart.bg = cbg;
      parts.push(cpart);
      const sel = this.selected;
      const draw = (b) => {
        const selected = b.tab === sel;
        const flags = [selected ? `selected` : `!selected`, b.tab.state === `disabled` ? `disabled` : `!disabled`];
        const exp = selected ? 2 : 0;
        const x = b.x - exp;
        const y = selected ? 0 : strip.strip_h - b.h;
        const h = selected ? strip.strip_h + 1 : b.h;
        const w = b.w + 2 * exp;
        const part = {
          c: `tab` + (selected ? ` sel` : ``) + (b.tab.state === `disabled` ? ` dis` : ``),
          x, y, w, h, ix: this.tabs.indexOf(b.tab),
        };
        const bg = this.lookup(style, `background`, flags) ?? (clam ? (selected ? `#dcdad5` : `#c3c3c3`) : null);
        if (bg) part.bg = bg;
        parts.push(part);
        const fg = this.lookup(style, `foreground`, flags) ?? (b.tab.state === `disabled` ? `#6d6d6d` : `#000000`);
        const top = (selected ? 0 : strip.strip_h - b.h) + 1 + b.pad[1];
        const left = b.x + 1 + b.pad[0];
        let ix = left;
        let iy = top;
        let tx = left;
        let ty = top;
        const c = b.tab.compound;
        if (b.image && b.text) {
          if (c === `top`) { tx = left + Math.trunc((b.cw - b.tw) / 2); ix = left + Math.trunc((b.cw - b.iw) / 2); ty = top + b.ih + 4; }
          else if (c === `bottom`) { tx = left + Math.trunc((b.cw - b.tw) / 2); ix = left + Math.trunc((b.cw - b.iw) / 2); iy = top + b.tl + 4; }
          else if (c === `right`) { ix = left + b.tw + 4; ty = top + Math.trunc((b.ch - b.tl) / 2); iy = top + Math.trunc((b.ch - b.ih) / 2); }
          else if (c === `center`) { tx = left + Math.trunc((b.cw - b.tw) / 2); ix = left + Math.trunc((b.cw - b.iw) / 2); ty = top + Math.trunc((b.ch - b.tl) / 2); iy = top + Math.trunc((b.ch - b.ih) / 2); }
          else { tx = left + b.iw + 4; ty = top + Math.trunc((b.ch - b.tl) / 2); iy = top + Math.trunc((b.ch - b.ih) / 2); }
        }
        if (selected) { ty -= 0; }
        if (b.image) parts.push({ c: `img`, x: ix, y: iy, w: b.iw, h: b.ih, img: b.image.url() });
        if (b.text) {
          const tp = { c: `text`, x: tx, y: ty, w: b.tw, h: b.tl, t: b.text, f: font.css, lh: b.tl, fg };
          if (b.tab.underline >= 0) tp.u = b.tab.underline;
          parts.push(tp);
        }
      };
      for (const b of strip.boxes) if (b.tab !== sel) draw(b);
      for (const b of strip.boxes) if (b.tab === sel) draw(b);
      return { kind: `ttk`, ttk: `notebook`, theme: look, st: ``, bd: 0, hl: 0, parts };
    }
  }

  // ---- ttk::treeview ----------------------------------------------------------------------

  const TREE_INDENT = 16;
  const TREE_IND_W = 15;
  const TREE_IND_BOX = 10;

  const TREEVIEW_COL_OPTS = [`width`, `minwidth`, `stretch`, `anchor`, `id`];
  const TREEVIEW_HEADING_OPTS = [`text`, `image`, `anchor`, `command`, `state`];
  const TREEVIEW_ITEM_OPTS = [`text`, `image`, `values`, `open`, `tags`];
  const TREEVIEW_TAG_OPTS = [`foreground`, `background`, `font`, `image`];

  function treeview_pad(value) {
    return nb_pad(value, [0, 0, 0, 0]);
  }

  function tree_list(values) {
    /* Like Tcl: an empty list is an empty string, a filled one is a list. */
    return values.length ? values.slice() : ``;
  }

  function treeview_anchor(value) {
    const v = to_str(value);
    if (!ANCHORS.includes(v)) {
      const listed = ANCHORS.slice(0, -1).join(`, `) + `, or ` + ANCHORS[ANCHORS.length - 1];
      throw new TclError(`bad anchor "${v}": must be ${listed}`);
    }
    return v;
  }

  function treeview_align(anchor) {
    /* A Tk anchor (n, ne, e, ...) as a CSS text-align. */
    const a = to_str(anchor);
    if ([`e`, `ne`, `se`].includes(a)) return `right`;
    if ([`center`, `n`, `s`].includes(a)) return `center`;
    return `left`;
  }

  class Treeview extends Widget {
    static tk_class = `Treeview`;
    static OPTIONS = options(
      [`class`, `class`, `Class`, ``],
      [`columns`, `columns`, `Columns`, ``],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`displaycolumns`, `displaycolumns`, `DisplayColumns`, `#all`],
      [`height`, `height`, `Height`, 10, `int`],
      [`padding`, `padding`, `Padding`, ``],
      [`selectmode`, `selectmode`, `SelectMode`, `extended`],
      [`show`, `show`, `Show`, `tree headings`],
      [`style`, `style`, `Style`, ``],
      [`takefocus`, `takeFocus`, `TakeFocus`, `ttk::takefocus`],
      [`xscrollcommand`, `xScrollCommand`, `ScrollCommand`, ``],
      [`yscrollcommand`, `yScrollCommand`, `ScrollCommand`, ``],
    );
    static WANTS_MOTION = true;

    constructor(app, path, parent) {
      super(app, path, parent);
      this.items = new Map();
      this.root = { id: ``, parent: null, children: [], text: ``, image: ``, values: [], open: true, tags: [], detached: false };
      this.columns = [];
      this.display_columns = null;
      this.headings = new Map();
      this.column_opts = new Map();
      this.tag_opts = new Map();
      this.tag_bindings = new Map();
      this.selected = new Set();
      this.focus_item = null;
      this.anchor = null;
      this.top = 0;
      this.xscroll = 0;
      this._states = new Set();
      this._next_id = 0;
      ns.Scrollable.prototype.init_scroll.call(this);
      this._setup_columns();
    }

    // ---- style helpers ---------------------------------------------------------------

    get look() {
      return this.app.ttk.look;
    }

    style_name() {
      return to_str(this.options.style) || `Treeview`;
    }

    lookup(style, option, flags = [], default_ = null) {
      return this.app.ttk.lookup(style, option, new Set(flags), default_);
    }

    font() {
      return this.app.fonts.get(this.lookup(this.style_name(), `font`) ?? `TkDefaultFont`);
    }

    pad() {
      return treeview_pad(this.options.padding);
    }

    row_h() {
      const p = this.pad();
      return this.font().linespace + 2 + p[1] + p[3];
    }

    heading_h() {
      return this.show_headings() ? this.font().linespace + 6 + this.pad()[1] + this.pad()[3] : 0;
    }

    show_tree() {
      return to_str(this.options.show).split(/\s+/).includes(`tree`);
    }

    show_headings() {
      return to_str(this.options.show).split(/\s+/).includes(`headings`);
    }

    mode() {
      return to_str(this.options.selectmode);
    }

    options_changed(keys) {
      if (keys.some((k) => [`columns`, `displaycolumns`].includes(k))) this._setup_columns();
      super.options_changed(keys);
    }

    _setup_columns() {
      const cols = to_str(this.options.columns);
      this.columns = cols ? split_list(cols).map(to_str) : [];
      this.column_opts.set(`#0`, { width: 200, minwidth: 20, stretch: 1, anchor: `w` });
      this.headings.set(`#0`, { text: ``, image: ``, anchor: `center`, command: `` });
      for (const col of this.columns) {
        this.column_opts.set(col, { width: 200, minwidth: 20, stretch: 1, anchor: `w` });
        this.headings.set(col, { text: ``, image: ``, anchor: `center`, command: `` });
      }
      const disp = to_str(this.options.displaycolumns);
      this.display_columns = disp === `#all` || disp === `` ? null : split_list(disp).map(to_str);
    }

    col_width(col) {
      const o = this.column_opts.get(col);
      return o && o.width > 0 ? o.width : 200;
    }

    display_cols() {
      return this.display_columns ? this.columns.filter((c) => this.display_columns.includes(c)) : this.columns;
    }

    visible_items() {
      const out = [];
      const walk = (item, depth) => {
        for (const child of item.children) {
          if (child.detached) continue;
          out.push({ item: child, depth });
          if (child.open) walk(child, depth + 1);
        }
      };
      walk(this.root, 0);
      return out;
    }

    _has_visible_children(item) {
      return item.children.some((c) => !c.detached);
    }

    visible_rows() {
      // The number of rows that fit in the widget; -height only sets the
      // requested size, resizing the widget shows more or fewer rows.
      const avail = this.height - this.heading_h() - 2 * this.inset();
      if (avail <= 0) return this.options.height > 0 ? this.options.height : 1;
      return Math.max(1, Math.floor(avail / this.row_h()));
    }

    _clamp_top() {
      const n = this.visible_items().length;
      this.top = Math.max(0, Math.min(this.top, Math.max(0, n - this.visible_rows())));
    }

    geometry_changed() {
      this._clamp_top();
    }

    inset() {
      return 1;
    }

    content_request() {
      const heading = this.heading_h();
      const rows = this.options.height > 0 ? this.options.height : Math.max(this.visible_items().length, 1);
      const height = heading + rows * this.row_h() + 2 * this.inset();
      let width = 0;
      if (this.show_tree()) width += this.col_width(`#0`);
      for (const col of this.display_cols()) width += this.col_width(col);
      if (!width) width = this.font().measure(`0`) * 10;
      return [width + 2 * this.inset(), height];
    }

    scroll_fractions(axis) {
      if (axis === `x`) {
        const total = this._content_width();
        if (!total) return [0, 1];
        const avail = Math.max(1, this.width - 2 * this.inset());
        return [
          Math.max(0, Math.min(1, this.xscroll / total)),
          Math.max(0, Math.min(1, (this.xscroll + avail) / total)),
        ];
      }
      const n = this.visible_items().length;
      if (n === 0) return [0, 1];
      return [this.top / n, Math.min(1, (this.top + this.visible_rows()) / n)];
    }

    notify_scroll() {
      ns.Scrollable.prototype.notify_scroll.call(this);
    }

    column_layout() {
      const x = {};
      let cur = 0;
      this._stretch_columns();
      for (const col of this._all_columns()) {
        x[col] = cur;
        cur += this.col_width(col);
      }
      return { x, total: cur };
    }

    _stretch_columns() {
      /* Tk's DistributeWidth (ttkTreeview.c): the columns are stretched to
         fill the widget. The extra space is shared equally between the
         stretchable columns (-stretch), the remainder is handed out
         round-robin, and Tk keeps the new widths in the -width option. */
      const cols = this._all_columns();
      if (!cols.length) return;
      const avail = this.width - 2 * this.inset();
      if (avail <= 0) return; // the widget is not laid out yet
      let total = 0;
      for (const col of cols) total += this.col_width(col);
      const n = avail - total;
      if (!n) return;
      const stretchable = cols.filter((col) => (this.column_opts.get(col)?.stretch ?? 0) > 0);
      const m = stretchable.length;
      if (!m) return;
      let d = Math.trunc(n / m);
      let r = n % m;
      if (r < 0) {
        r += m;
        d -= 1;
      }
      let w = total;
      for (const col of stretchable) {
        w += 1;
        const o = this.column_opts.get(col);
        if (!o) continue;
        let width = o.width + d + ((w % m) < r ? 1 : 0);
        const min = o.minwidth ?? 20;
        if (width < min) width = min;
        o.width = width;
      }
    }

    _content_width() {
      let total = 0;
      for (const col of this._all_columns()) total += this.col_width(col);
      return total;
    }

    _max_xscroll() {
      return Math.max(0, this._content_width() - (this.width - 2 * this.inset()));
    }

    row_at(y) {
      const hh = this.heading_h();
      const rows = this.visible_items();
      const idx = this.top + Math.floor((y - hh) / this.row_h());
      if (idx < this.top || idx >= this.top + this.visible_rows() || idx >= rows.length) return null;
      return Object.assign({ index: idx }, rows[idx]);
    }

    heading_at(x) {
      if (!this.show_headings()) return null;
      const { x: xs } = this.column_layout();
      for (const col of this._all_columns()) {
        if (x >= xs[col] && x < xs[col] + this.col_width(col)) return col;
      }
      return null;
    }

    _all_columns() {
      return this.show_tree() ? [`#0`, ...this.display_cols()] : this.display_cols();
    }

    data_column_at(x) {
      const { x: xs } = this.column_layout();
      for (const col of this.display_cols()) {
        if (x >= xs[col] && x < xs[col] + this.col_width(col)) return col;
      }
      return null;
    }

    column_at(x) {
      if (this.show_tree()) {
        const { x: xs } = this.column_layout();
        if (x >= xs[`#0`] && x < xs[`#0`] + this.col_width(`#0`)) return `#0`;
      }
      return this.data_column_at(x);
    }

    hit_test(x, y) {
      // The field border is not part of the content: work in content coords.
      const cx = x - this.inset() + this.xscroll;
      const cy = y - this.inset();
      if (this.show_headings() && cy < this.heading_h()) {
        const col = this.heading_at(cx);
        return col ? { region: `heading`, column: col } : { region: `separator` };
      }
      const row = this.row_at(cy);
      if (!row) return null;
      if (this.show_tree()) {
        const indent = row.depth * TREE_INDENT;
        if (cx >= indent + 1 && cx < indent + 1 + TREE_IND_BOX && this._has_visible_children(row.item)) {
          return { region: `tree`, item: row.item, indicator: true };
        }
        const { x: xs } = this.column_layout();
        if (cx < xs[`#0`] + this.col_width(`#0`)) return { region: `tree`, item: row.item, column: `#0` };
      }
      const col = this.data_column_at(cx);
      if (col) return { region: `cell`, item: row.item, column: col };
      return { region: `tree`, item: row.item };
    }

    // ---- item helpers -----------------------------------------------------------------

    _resolve_item(id) {
      const s = to_str(id);
      if (s === ``) return this.root;
      const item = this.items.get(s);
      if (!item) throw new TclError(`item "${s}" not found`);
      return item;
    }

    _parse_index(spec, count) {
      const s = to_str(spec);
      if (s === `end`) return count;
      return Math.max(0, Math.min(get_int(s), count));
    }

    _gen_id() {
      let id;
      do {
        id = `I` + String(this._next_id++).padStart(3, `0`);
      } while (this.items.has(id));
      return id;
    }

    _is_descendant(ancestor, item) {
      let p = item.parent;
      while (p) {
        if (p === ancestor) return true;
        p = p.parent;
      }
      return false;
    }

    _cell_value(item, col) {
      if (col === `#0`) return item.text;
      const idx = this.columns.indexOf(col);
      return idx === -1 ? `` : item.values[idx] ?? ``;
    }

    _image(name) {
      if (name && this.app.images.exists(name)) return this.app.images.get(name);
      return null;
    }

    _see_item(item) {
      let p = item.parent;
      while (p) {
        p.open = true;
        p = p.parent;
      }
      const rows = this.visible_items();
      const idx = rows.findIndex((r) => r.item.id === item.id);
      if (idx === -1) return;
      const vis = this.visible_rows();
      if (idx < this.top) this.top = idx;
      else if (idx >= this.top + vis) this.top = idx - vis + 1;
      this._clamp_top();
    }

    _set_open(item, open) {
      if (item.open === open) return;
      item.open = open;
      this._clamp_top();
      this.app.schedule_render();
      this.app.dispatch_virtual(this, open ? `TreeviewOpen` : `TreeviewClose`);
    }

    _dispatch_tag(event, item) {
      if (!this.tag_bindings.size) return;
      for (const tag of item.tags) {
        const table = this.tag_bindings.get(tag);
        if (!table) continue;
        const entry = events.best_binding(table, event);
        if (entry) this.app.eval_script(entry.script);
      }
    }

    _range_to(item) {
      const ids = this.visible_items().map((r) => r.item.id);
      const a = ids.indexOf(this.anchor);
      const b = ids.indexOf(item.id);
      if (a === -1 || b === -1) return;
      const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
      this.selected = new Set(ids.slice(lo, hi + 1));
      this.app.schedule_render();
      this.app.dispatch_virtual(this, `TreeviewSelect`);
    }

    _press_select(item, event) {
      const mode = this.mode();
      if (mode === `none`) {
        this.focus_item = item.id;
        this.app.schedule_render();
        return;
      }
      const state = event.state ?? 0;
      if (mode === `extended` && state & events.CONTROL) {
        if (this.selected.has(item.id)) this.selected.delete(item.id);
        else this.selected.add(item.id);
        this.anchor = item.id;
      } else if (mode === `extended` && state & events.SHIFT) {
        if (this.anchor && this.items.has(this.anchor)) this._range_to(item);
        else {
          this.selected = new Set([item.id]);
          this.anchor = item.id;
        }
      } else if (mode === `multiple`) {
        if (this.selected.has(item.id)) this.selected.delete(item.id);
        else this.selected.add(item.id);
        this.anchor = item.id;
      } else {
        this.selected = new Set([item.id]);
        this.anchor = item.id;
      }
      this.focus_item = item.id;
      this.app.schedule_render();
      this.app.dispatch_virtual(this, `TreeviewSelect`);
    }

    // ---- mouse / keyboard events -------------------------------------------------------

    class_event(event) {
      const etype = event.type;
      if (this._states.has(`disabled`)) return undefined;
      if (etype === 4 && event.num === 1) {
        this.app.set_focus(this);
        const hit = this.hit_test(event.x ?? 0, event.y ?? 0);
        if (!hit) return undefined;
        if (hit.region === `heading`) {
          const h = this.headings.get(hit.column);
          if (h && h.command) this.app._run_background(h.command, [hit.column]);
          return undefined;
        }
        if (hit.region === `separator`) return undefined;
        const item = hit.item;
        if (!item) return undefined;
        if (hit.indicator) {
          this._set_open(item, !item.open);
          return undefined;
        }
        this._dispatch_tag(event, item);
        this._press_select(item, event);
        return undefined;
      }
      if (etype === 5 && event.num === 1) {
        if ((event.count ?? 1) >= 2) {
          const hit = this.hit_test(event.x ?? 0, event.y ?? 0);
          if (hit && hit.item && !hit.indicator) this._dispatch_tag(event, hit.item);
        }
        return undefined;
      }
      if (etype === 6) {
        if ((event.state ?? 0) & 0x100) {
          const hit = this.hit_test(event.x ?? 0, event.y ?? 0);
          if (hit && hit.item && !hit.indicator) this._range_to(hit.item);
        }
        return undefined;
      }
      if (etype === 38) {
        this.cmd_yview([`scroll`, -Math.floor((event.delta ?? 0) / 120), `units`]);
        return undefined;
      }
      if (etype === 2) {
        this._key(event);
        return undefined;
      }
      return undefined;
    }

    _key(event) {
      const keysym = event.keysym;
      const rows = this.visible_items();
      if (!rows.length) return;
      let cur = rows.findIndex((r) => r.item.id === this.focus_item);
      if (cur === -1) cur = 0;
      const item = rows[cur].item;
      const mode = this.mode();
      const move = (idx) => {
        const n = Math.max(0, Math.min(idx, rows.length - 1));
        const it = rows[n].item;
        this.focus_item = it.id;
        this._see_item(it);
        if (mode === `browse` || mode === `extended`) {
          this.selected = new Set([it.id]);
          this.anchor = it.id;
          this.app.dispatch_virtual(this, `TreeviewSelect`);
        }
        this.app.schedule_render();
      };
      switch (keysym) {
        case `Up`: move(cur - 1); break;
        case `Down`: move(cur + 1); break;
        case `Prior`: move(cur - this.visible_rows()); break;
        case `Next`: move(cur + this.visible_rows()); break;
        case `Home`: move(0); break;
        case `End`: move(rows.length - 1); break;
        case `Left`:
          if (item.open && this._has_visible_children(item)) this._set_open(item, false);
          else if (item.parent) {
            this.focus_item = item.parent.id;
            this._see_item(item.parent);
            this.app.schedule_render();
          }
          break;
        case `Right`:
          if (!item.open && this._has_visible_children(item)) this._set_open(item, true);
          else {
            const next = rows[cur + 1];
            if (next && next.item.parent === item) move(cur + 1);
          }
          break;
        case `plus`: this._set_open(item, true); break;
        case `minus`: this._set_open(item, false); break;
        case `space`:
          if (mode === `browse` || mode === `single`) {
            this.selected = new Set([item.id]);
            this.anchor = item.id;
          } else if (mode === `extended` || mode === `multiple`) {
            if (this.selected.has(item.id)) this.selected.delete(item.id);
            else this.selected.add(item.id);
          }
          this.focus_item = item.id;
          this.app.schedule_render();
          this.app.dispatch_virtual(this, `TreeviewSelect`);
          break;
        case `Return`:
          this._dispatch_tag(event, item);
          break;
        default:
          break;
      }
    }

    // ---- option commands ---------------------------------------------------------------

    _match_opt(raw, keys) {
      const hits = keys.filter((k) => k === raw);
      const found = hits.length ? hits : raw ? keys.filter((k) => k.startsWith(raw)) : [];
      if (found.length !== 1) throw new TclError(`unknown option "-${raw}"`);
      return found[0];
    }

    _flat(args) {
      /* Python passes lists (tuples) as a single argument: expand them. */
      const out = [];
      for (const arg of args) {
        if (Array.isArray(arg)) {
          for (const item of arg) out.push(item);
        } else {
          out.push(arg);
        }
      }
      return out;
    }

    _options_cmd(rest, keys, get, set) {
      if (!rest.length) {
        const out = [];
        for (const key of keys) out.push(`-` + key, get(key));
        return out;
      }
      if (rest.length === 1) {
        const raw = to_str(rest[0]).replace(/^-/, ``);
        return get(this._match_opt(raw, keys));
      }
      if (rest.length % 2) throw new TclError(`value for "${to_str(rest[rest.length - 1])}" missing`);
      for (let i = 0; i < rest.length; i += 2) {
        const raw = to_str(rest[i]).replace(/^-/, ``);
        set(this._match_opt(raw, keys), rest[i + 1]);
      }
      this.app.schedule_render();
      return ``;
    }

    cmd_column(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} column column ?-option ?value ...?"`);
      const col = to_str(args[0]);
      if (col !== `#0` && !this.columns.includes(col)) throw new TclError(`bad column "${col}"`);
      const rest = args.slice(1);
      const get = (key) => {
        if (key === `id`) return col;
        const o = this.column_opts.get(col);
        if (!o) return ``;
        return { width: o.width, minwidth: o.minwidth, stretch: o.stretch, anchor: o.anchor }[key];
      };
      const set = (key, value) => {
        const o = this.column_opts.get(col);
        if (!o || key === `id`) return; // -id is read-only
        if (key === `width`) o.width = Math.max(0, get_int(value));
        else if (key === `minwidth`) o.minwidth = Math.max(0, get_int(value));
        else if (key === `stretch`) o.stretch = get_boolean(value) ? 1 : 0;
        else if (key === `anchor`) o.anchor = treeview_anchor(value);
      };
      return this._options_cmd(rest, TREEVIEW_COL_OPTS, get, set);
    }

    cmd_heading(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} heading column ?-option ?value ...?"`);
      const col = to_str(args[0]);
      if (col !== `#0` && !this.columns.includes(col)) throw new TclError(`bad column "${col}"`);
      const rest = args.slice(1);
      const h = this.headings.get(col) ?? { text: ``, image: ``, anchor: `center`, command: `` };
      const get = (key) => (key === `state` ? `` : { text: h.text, image: h.image, anchor: h.anchor, command: h.command }[key]);
      const set = (key, value) => {
        if (key === `state`) return; // read-only
        if (key === `text`) h.text = to_str(value);
        else if (key === `image`) {
          if (to_str(value)) this.app.images.get(to_str(value));
          h.image = to_str(value);
        } else if (key === `anchor`) h.anchor = treeview_anchor(value);
        else if (key === `command`) h.command = to_str(value);
        this.headings.set(col, h);
      };
      return this._options_cmd(rest, TREEVIEW_HEADING_OPTS, get, set);
    }

    cmd_item(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} item item ?-option ?value ...?"`);
      const item = this._resolve_item(args[0]);
      const rest = args.slice(1);
      const get = (key) => ({
        text: item.text, image: item.image, values: tree_list(item.values),
        open: item.open ? 1 : 0, tags: tree_list(item.tags),
      })[key];
      const set = (key, value) => {
        if (key === `text`) item.text = to_str(value);
        else if (key === `image`) {
          if (to_str(value)) this.app.images.get(to_str(value));
          item.image = to_str(value);
        } else if (key === `values`) item.values = split_list(to_str(value)).map(to_str);
        else if (key === `open`) item.open = get_boolean(value);
        else if (key === `tags`) item.tags = split_list(to_str(value)).map(to_str);
      };
      return this._options_cmd(rest, TREEVIEW_ITEM_OPTS, get, set);
    }

    cmd_set(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} set item ?column? ?value?"`);
      const item = this._resolve_item(args[0]);
      if (args.length === 1) {
        const out = [];
        for (const col of this.display_cols()) out.push(col, this._cell_value(item, col));
        return out;
      }
      const col = to_str(args[1]);
      if (col !== `#0` && !this.columns.includes(col)) throw new TclError(`bad column "${col}"`);
      if (args.length === 2) return this._cell_value(item, col);
      if (col === `#0`) item.text = to_str(args[2]);
      else {
        const idx = this.columns.indexOf(col);
        while (item.values.length <= idx) item.values.push(``);
        item.values[idx] = to_str(args[2]);
      }
      this.app.schedule_render();
      return ``;
    }

    cmd_tag(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} tag option ?arg ...?"`);
      const sub = to_str(args[0]);
      const rest = args.slice(1);
      if (sub === `configure`) {
        if (!rest.length) throw new TclError(`wrong # args: should be "${this.path} tag configure tagname ?-option ?value ...?"`);
        const tag = to_str(rest[0]);
        const opts = this.tag_opts.get(tag) ?? { foreground: ``, background: ``, font: ``, image: `` };
        const get = (key) => ({ foreground: opts.foreground, background: opts.background, font: opts.font, image: opts.image })[key];
        const set = (key, value) => {
          if (key === `font`) this.app.fonts.get(to_str(value));
          if (key === `image` && to_str(value)) this.app.images.get(to_str(value));
          opts[key] = to_str(value);
          this.tag_opts.set(tag, opts);
        };
        return this._options_cmd(rest.slice(1), TREEVIEW_TAG_OPTS, get, set);
      }
      if (sub === `bind`) {
        if (rest.length < 2) throw new TclError(`wrong # args: should be "${this.path} tag bind tagname sequence ?command?"`);
        const tag = to_str(rest[0]);
        const seq = to_str(rest[1]);
        if (!this.tag_bindings.has(tag)) this.tag_bindings.set(tag, new Map());
        const table = this.tag_bindings.get(tag);
        const patterns = events.parse_sequence(seq);
        const key = this.app._canonical_sequence(patterns);
        if (rest.length === 2) {
          const entry = table.get(key);
          return entry ? entry.script : ``;
        }
        const script = to_str(rest[2]);
        if (script === ``) table.delete(key);
        else table.set(key, { script: script.replace(/^\++/, ``), patterns });
        return ``;
      }
      if (sub === `has`) {
        if (!rest.length) throw new TclError(`wrong # args: should be "${this.path} tag has tagname ?item?"`);
        const tag = to_str(rest[0]);
        if (rest.length === 1) {
          const out = [];
          for (const item of this.items.values()) if (item.tags.includes(tag)) out.push(item.id);
          return out;
        }
        const item = this._resolve_item(rest[1]);
        return item.tags.includes(tag) ? 1 : 0;
      }
      if (sub === `names`) {
        if (rest.length) {
          const item = this._resolve_item(rest[0]);
          return item.tags.slice();
        }
        return [...this.tag_opts.keys()];
      }
      throw new TclError(`bad option "${sub}": must be bind, configure, has, or names`);
    }

    // ---- item commands ------------------------------------------------------------------

    cmd_insert(args) {
      if (args.length < 2) throw new TclError(`wrong # args: should be "${this.path} insert parent index ?-id id? ?-option value ...?"`);
      const parent = this._resolve_item(args[0]);
      const index = this._parse_index(args[1], parent.children.length);
      let opts = args.slice(2);
      let id = null;
      if (to_str(opts[0]) === `-id`) {
        id = to_str(opts[1]);
        opts = opts.slice(2);
      }
      if (opts.length % 2) throw new TclError(`value for "${to_str(opts[opts.length - 1])}" missing`);
      if (id && this.items.has(id)) throw new TclError(`item "${id}" already exists`);
      const item = { id: id || this._gen_id(), parent, children: [], text: ``, image: ``, values: [], open: false, tags: [], detached: false };
      for (let i = 0; i + 1 < opts.length; i += 2) {
        const raw = to_str(opts[i]).replace(/^-/, ``);
        const value = opts[i + 1];
        if (raw === `text`) item.text = to_str(value);
        else if (raw === `image`) {
          if (to_str(value)) this.app.images.get(to_str(value));
          item.image = to_str(value);
        } else if (raw === `values`) item.values = split_list(to_str(value)).map(to_str);
        else if (raw === `open`) item.open = get_boolean(value);
        else if (raw === `tags`) item.tags = split_list(to_str(value)).map(to_str);
        else throw new TclError(`unknown option "-${raw}"`);
      }
      parent.children.splice(index, 0, item);
      this.items.set(item.id, item);
      if (!this.focus_item) this.focus_item = item.id;
      this._clamp_top();
      this.app.schedule_render();
      return item.id;
    }

    _delete_item(item) {
      for (const child of [...item.children]) this._delete_item(child);
      const siblings = item.parent ? item.parent.children : [];
      const at = siblings.indexOf(item);
      if (at !== -1) siblings.splice(at, 1);
      this.items.delete(item.id);
      this.selected.delete(item.id);
      if (this.focus_item === item.id) this.focus_item = null;
      if (this.anchor === item.id) this.anchor = null;
    }

    cmd_delete(args) {
      const ids = this._flat(args);
      if (!ids.length) throw new TclError(`wrong # args: should be "${this.path} delete item ..."`);
      for (const id of ids) {
        const s = to_str(id);
        if (s === ``) throw new TclError(`can't delete root item`);
        this._delete_item(this._resolve_item(s));
      }
      this._clamp_top();
      this.app.schedule_render();
      return ``;
    }

    cmd_detach(args) {
      const ids = this._flat(args);
      if (!ids.length) throw new TclError(`wrong # args: should be "${this.path} detach item ..."`);
      for (const id of ids) {
        const s = to_str(id);
        if (s === ``) throw new TclError(`can't detach root item`);
        const item = this._resolve_item(s);
        const siblings = item.parent ? item.parent.children : [];
        const at = siblings.indexOf(item);
        if (at !== -1) siblings.splice(at, 1);
        item.detached = true;
      }
      this._clamp_top();
      this.app.schedule_render();
      return ``;
    }

    cmd_children(args) {
      if (args.length > 2) throw new TclError(`wrong # args: should be "${this.path} children ?item? ?newchildren?"`);
      const item = args.length && to_str(args[0]) !== `` ? this._resolve_item(args[0]) : this.root;
      if (args.length === 2) {
        // "children item newchildren": re-attach the given items under item.
        const wanted = this._flat([args[1]]).map(to_str);
        for (const child of [...item.children]) {
          if (!wanted.includes(child.id)) {
            const at = item.children.indexOf(child);
            if (at !== -1) item.children.splice(at, 1);
            child.detached = true;
          }
        }
        for (const id of wanted) {
          const child = this._resolve_item(id);
          if (child === item || this._is_descendant(child, item)) {
            throw new TclError(`can't move item under its own descendant`);
          }
          const old = child.parent ? child.parent.children : [];
          const at = old.indexOf(child);
          if (at !== -1) old.splice(at, 1);
          item.children.push(child);
          child.parent = item;
          child.detached = false;
        }
        this._clamp_top();
        this.app.schedule_render();
        return ``;
      }
      return item.children.map((c) => c.id);
    }

    cmd_parent(args) {
      if (args.length !== 1) throw new TclError(`wrong # args: should be "${this.path} parent item"`);
      const item = this._resolve_item(args[0]);
      return item.parent ? item.parent.id : ``;
    }

    _sibling(args, dir) {
      if (args.length !== 1) throw new TclError(`wrong # args: should be "${this.path} ${dir > 0 ? `next` : `prev`} item"`);
      const item = this._resolve_item(args[0]);
      const siblings = item.parent ? item.parent.children : [];
      const n = siblings[siblings.indexOf(item) + dir];
      return n ? n.id : ``;
    }

    cmd_next(args) {
      return this._sibling(args, 1);
    }

    cmd_prev(args) {
      return this._sibling(args, -1);
    }

    cmd_index(args) {
      if (args.length !== 1) throw new TclError(`wrong # args: should be "${this.path} index item"`);
      const item = this._resolve_item(args[0]);
      const siblings = item.parent ? item.parent.children : [];
      return siblings.indexOf(item);
    }

    cmd_exists(args) {
      if (args.length !== 1) throw new TclError(`wrong # args: should be "${this.path} exists item"`);
      const s = to_str(args[0]);
      return s === `` || this.items.has(s) ? 1 : 0;
    }

    cmd_move(args) {
      if (args.length !== 3) throw new TclError(`wrong # args: should be "${this.path} move item parent index"`);
      const item = this._resolve_item(args[0]);
      const parent = this._resolve_item(args[1]);
      if (parent === item || this._is_descendant(item, parent)) {
        throw new TclError(`can't move item under its own descendant`);
      }
      const old = item.parent ? item.parent.children : [];
      const at = old.indexOf(item);
      if (at !== -1) old.splice(at, 1);
      const index = this._parse_index(args[2], parent.children.length);
      parent.children.splice(index, 0, item);
      item.parent = parent;
      item.detached = false;
      this._clamp_top();
      this.app.schedule_render();
      return ``;
    }

    cmd_selection(args) {
      if (!args.length) return [...this.selected];
      const sub = to_str(args[0]);
      const ids = this._flat(args.slice(1)).map(to_str);
      if (sub === `set`) this.selected = new Set(ids);
      else if (sub === `add`) for (const id of ids) this.selected.add(id);
      else if (sub === `remove`) for (const id of ids) this.selected.delete(id);
      else if (sub === `toggle`) {
        for (const id of ids) {
          if (this.selected.has(id)) this.selected.delete(id);
          else this.selected.add(id);
        }
      } else {
        throw new TclError(`bad option "${sub}": must be add, remove, set, or toggle`);
      }
      this.app.schedule_render();
      this.app.dispatch_virtual(this, `TreeviewSelect`);
      return ``;
    }

    cmd_see(args) {
      if (args.length !== 1) throw new TclError(`wrong # args: should be "${this.path} see item"`);
      this._see_item(this._resolve_item(args[0]));
      this.app.schedule_render();
      return ``;
    }

    cmd_focus(args) {
      if (!args.length) return this.focus_item ?? ``;
      const item = this._resolve_item(args[0]);
      this.focus_item = item.id;
      this._see_item(item);
      this.app.schedule_render();
      return ``;
    }

    cmd_identify(args) {
      if (args.length !== 3) throw new TclError(`wrong # args: should be "${this.path} identify component x y"`);
      const comp = to_str(args[0]);
      const x = get_int(args[1]);
      const y = get_int(args[2]);
      const hit = this.hit_test(x, y);
      if (!hit) return ``;
      if (comp === `row`) return hit.item ? hit.item.id : ``;
      if (comp === `column`) return hit.column ?? ``;
      if (comp === `region`) {
        if (hit.region === `heading`) return `heading`;
        if (hit.region === `separator`) return `separator`;
        if (hit.region === `cell`) return `cell`;
        if (hit.region === `tree`) return `tree`;
        return ``;
      }
      if (comp === `element`) {
        if (hit.region === `heading`) return `heading`;
        if (hit.region === `cell`) return `cell`;
        if (hit.region === `tree`) return `treeitem`;
        return ``;
      }
      throw new TclError(`bad component "${comp}": must be column, element, region, or row`);
    }

    cmd_bbox(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} bbox item ?column?"`);
      const item = this._resolve_item(args[0]);
      const rows = this.visible_items();
      const idx = rows.findIndex((r) => r.item.id === item.id);
      if (idx === -1) return ``;
      const y = this.inset() + this.heading_h() + (idx - this.top) * this.row_h();
      if (args.length === 1) {
        const { total } = this.column_layout();
        return [this.inset() - this.xscroll, y, total, this.row_h()];
      }
      const col = to_str(args[1]);
      if (col !== `#0` && !this.columns.includes(col)) throw new TclError(`bad column "${col}"`);
      const { x: xs } = this.column_layout();
      return [this.inset() + (xs[col] ?? 0) - this.xscroll, y, this.col_width(col), this.row_h()];
    }

    cmd_yview(args) {
      if (!args.length) return this.scroll_fractions(`y`);
      if (args.length === 1) {
        this.top = get_int(args[0]);
      } else {
        const sub = to_str(args[0]);
        if (sub === `moveto`) {
          this.top = Math.trunc(get_double(args[1]) * this.visible_items().length + 0.5);
        } else if (sub === `scroll`) {
          const what = to_str(args[2]);
          if (![`units`, `pages`, `pixels`].includes(what)) {
            throw new TclError(`bad argument "${what}": must be pages, pixels, or units`);
          }
          let step = 1;
          if (what === `pages`) step = Math.max(1, this.visible_rows() - 1);
          if (what === `pixels`) step = 1 / this.row_h();
          this.top += Math.trunc(get_double(args[1]) * step);
        } else {
          throw new TclError(`bad option "${sub}": must be moveto or scroll`);
        }
      }
      this._clamp_top();
      this.app.schedule_render();
      return ``;
    }

    cmd_xview(args) {
      if (!args.length) return this.scroll_fractions(`x`);
      const sub = to_str(args[0]);
      const total = this._content_width();
      if (sub === `moveto`) {
        this.xscroll = Math.round(get_double(args[1]) * total);
      } else if (sub === `scroll`) {
        const what = to_str(args[2]);
        if (![`units`, `pages`, `pixels`].includes(what)) {
          throw new TclError(`bad argument "${what}": must be pages, pixels, or units`);
        }
        let step = 40;
        if (what === `pages`) step = Math.max(1, this.width - 2 * this.inset());
        if (what === `pixels`) step = 1;
        this.xscroll += Math.trunc(get_double(args[1]) * step);
      } else {
        throw new TclError(`bad option "${sub}": must be moveto or scroll`);
      }
      this.xscroll = Math.max(0, Math.min(this.xscroll, this._max_xscroll()));
      this.app.schedule_render();
      return ``;
    }

    cmd_state(args) {
      if (!args.length) return [...this._states].join(` `);
      const words = parse_statespec(args[0]);
      const changed = [];
      for (const word of words) {
        if (word.startsWith(`!`)) {
          const name = word.slice(1);
          if (this._states.delete(name)) changed.push(name);
        } else if (!this._states.has(word)) {
          this._states.add(word);
          changed.push(word);
        }
      }
      this.app.schedule_render();
      return changed.join(` `);
    }

    cmd_instate(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} instate statespec"`);
      const words = parse_statespec(args[0]);
      return state_matches(words, this.effective_states()) ? 1 : 0;
    }

    effective_states() {
      const flags = new Set(this._states);
      if (this.app.focus_widget === this) flags.add(`focus`);
      return flags;
    }

    cmd_style(args) {
      return this.style_name();
    }

    // ---- rendering ------------------------------------------------------------------------

    render() {
      const font = this.font();
      const style = this.style_name();
      const look = this.look;
      const hh = this.heading_h();
      const row_h = this.row_h();
      const parts = [];
      const rows = this.visible_items();
      const { x: xs, total } = this.column_layout();
      const start = this.top;
      const count = Math.max(0, Math.min(rows.length - start, this.visible_rows()));
      const sel_bg = this.lookup(style, `background`, [`selected`], `#cce8ff`);
      const sel_fg = this.lookup(style, `foreground`, [`selected`], `#000000`);
      const fg = this.lookup(style, `foreground`, [], `#000000`);
      const heading_style = style + `.Heading`;
      const hfg = this.lookup(heading_style, `foreground`, [], `#000000`);
      const hfont = this.app.fonts.get(this.lookup(heading_style, `font`) ?? `TkDefaultFont`);
      const field_bg = this.lookup(style, `fieldbackground`, [], `#ffffff`);
      const frame = this.inset();
      parts.push({ c: `field`, x: 0, y: 0, w: this.width, h: this.height, bg: field_bg });
      if (this.show_headings()) {
        const cols = this._all_columns();
        const last = cols[cols.length - 1];
        for (const col of cols) {
          const h = this.headings.get(col) ?? { text: ``, image: ``, anchor: `center`, command: `` };
          parts.push({
            c: `heading` + (col === last ? ` fill` : ``),
            x: frame + xs[col] - this.xscroll, y: frame, w: this.col_width(col), h: hh,
            t: h.text, f: hfont.css, lh: hh, al: h.anchor, fg: hfg,
          });
        }
      }
      for (let i = 0; i < count; i++) {
        const row = rows[start + i];
        const item = row.item;
        const y = frame + hh + i * row_h;
        const selected = this.selected.has(item.id);
        const rfg = selected ? sel_fg : fg;
        const rbg = selected ? sel_bg : null;
        if (this.show_tree()) {
          const indent = row.depth * TREE_INDENT;
          const has_children = this._has_visible_children(item);
          if (has_children) {
            parts.push({
              c: `tind` + (item.open ? ` open` : ``),
              x: frame + indent + 1, y: y + Math.trunc((row_h - TREE_IND_BOX) / 2), w: TREE_IND_BOX, h: TREE_IND_BOX,
            });
          }
          const tx = frame + indent + (has_children ? TREE_IND_W : 0) + 2;
          const tw = Math.max(0, this.col_width(`#0`) - indent - (has_children ? TREE_IND_W : 0) - 2);
          const cell = {
            c: `cell`, x: tx, y, w: tw, h: row_h, t: item.text, f: font.css, lh: row_h, fg: rfg,
            al: treeview_align(this.column_opts.get(`#0`)?.anchor ?? `w`),
          };
          if (rbg) cell.bg = rbg;
          parts.push(cell);
          if (item.image) {
            const img = this._image(item.image);
            if (img) parts.push({ c: `img`, x: tx, y, w: img.width, h: img.height, img: img.url() });
          }
        }
        for (const col of this.display_cols()) {
          const cell = {
            c: `cell`, x: frame + xs[col] - this.xscroll, y, w: this.col_width(col), h: row_h,
            t: this._cell_value(item, col), f: font.css, lh: row_h, fg: rfg,
            al: treeview_align(this.column_opts.get(col)?.anchor ?? `w`),
          };
          if (rbg) cell.bg = rbg;
          parts.push(cell);
        }
        if (this.focus_item === item.id) {
          parts.push({ c: `rowfocus`, x: frame, y, w: total, h: row_h });
        }
      }
      return { kind: `ttk`, ttk: `treeview`, theme: look, st: [...this.effective_states()].join(` `), bd: 0, hl: 0, bg: field_bg, parts };
    }
  }

  // ---- ttk::progressbar ---------------------------------------------------------------------

  const PROGRESSBAR_THICKNESS = 20;

  class Progressbar extends Widget {
    static tk_class = `TProgressbar`;
    static OPTIONS = options(
      [`class`, `class`, `Class`, ``],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`length`, `length`, `Length`, 100, `pixels`],
      [`maximum`, `maximum`, `Maximum`, 100, `float`],
      [`mode`, `mode`, `ProgressMode`, `determinate`],
      [`orient`, `orient`, `Orient`, `horizontal`],
      [`phase`, `phase`, `Phase`, 0, `int`],
      [`style`, `style`, `Style`, ``],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
      [`value`, `value`, `Value`, 0, `float`],
      [`variable`, `variable`, `Variable`, ``],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this._auto_running = false;
      this._auto_interval = 50;
      this._auto_id = null;
      this._auto_serial = 0;
    }

    get look() {
      return this.app.ttk.look;
    }

    set_option(key, value) {
      if (key === `mode`) {
        const v = to_str(value);
        if (v && `determinate`.startsWith(v)) value = `determinate`;
        else if (v && `indeterminate`.startsWith(v)) value = `indeterminate`;
        else throw new TclError(`bad progress mode "${v}": must be determinate or indeterminate`);
      } else if (key === `orient`) {
        const v = to_str(value);
        if (v && `horizontal`.startsWith(v)) value = `horizontal`;
        else if (v && `vertical`.startsWith(v)) value = `vertical`;
        else throw new TclError(`bad orientation "${v}": must be horizontal or vertical`);
      }
      super.set_option(key, value);
    }

    created() {
      this._link();
    }

    options_changed(keys) {
      if (keys.includes(`variable`) && this.app.widgets.get(this.path) === this) this._link();
      super.options_changed(keys);
    }

    on_destroy() {
      this.app.unlink_widget(this);
      this._auto_running = false;
      this._cancel_auto();
    }

    _link() {
      const variable = this.options.variable;
      this.app.link_variable(this, variable);
      if (variable) {
        if (this.app.var_exists(variable)) this.variable_changed(variable);
        else this.app.setvar(variable, String(this.options.value), this);
      }
    }

    variable_changed(name) {
      try {
        this.options.value = get_double(this.app.getvar_default(name, 0));
      } catch {
        // not a number: keep the current value
      }
      this.app.schedule_render();
    }

    set_value(value) {
      this.options.value = value;
      const variable = this.options.variable;
      if (variable) this.app.setvar(variable, String(value), this);
      this.app.schedule_render();
    }

    horizontal() {
      return this.options.orient !== `vertical`;
    }

    fraction() {
      const maximum = get_double(this.options.maximum);
      if (!(maximum > 0)) return 0;
      return Math.max(0, Math.min(1, get_double(this.options.value) / maximum));
    }

    content_request() {
      const length = this.options.length > 0 ? this.options.length : 100;
      return this.horizontal()
        ? [length, PROGRESSBAR_THICKNESS]
        : [PROGRESSBAR_THICKNESS, length];
    }

    // ---- commands ---------------------------------------------------------------------

    cmd_start(args) {
      this._auto_interval = args.length ? Math.max(1, get_int(args[0])) : 50;
      this._auto_running = true;
      this._schedule_auto();
      return ``;
    }

    cmd_stop(args) {
      this._auto_running = false;
      this._cancel_auto();
      return ``;
    }

    cmd_step(args) {
      const amount = args.length ? get_double(args[0]) : 1;
      if (this.options.mode === `indeterminate`) {
        this.options.phase = (this.options.phase + 10) % 100;
        this.app.schedule_render();
        return ``;
      }
      const range = get_double(this.options.maximum);
      if (range > 0) {
        const value = ((get_double(this.options.value) + amount) % range + range) % range;
        this.set_value(value);
      }
      return ``;
    }

    _schedule_auto() {
      if (!this._auto_running || this.destroyed || this._auto_id !== null) return;
      const name = `::ttk::progressbar::auto::${this._auto_serial++}`;
      this.app.createcommand(name, () => {
        this._auto_id = null;
        this.cmd_step([]);
        this._schedule_auto();
        return ``;
      });
      this._auto_id = this.app.tcl_after([String(this._auto_interval), name]);
    }

    _cancel_auto() {
      if (this._auto_id === null) return;
      this.app.tcl_after([`cancel`, this._auto_id]);
      this._auto_id = null;
    }

    // ---- rendering ---------------------------------------------------------------------

    render() {
      const o = this.options;
      const w = this.width;
      const h = this.height;
      const horizontal = this.horizontal();
      const parts = [{ c: `trough`, x: 0, y: 0, w, h }];
      // The bar fills the interior of the trough (the trough has a border).
      const iw = Math.max(0, w - 2);
      const ih = Math.max(0, h - 2);
      if (o.mode === `indeterminate`) {
        const span = horizontal ? iw : ih;
        const bar = Math.max(8, Math.round(span / 4));
        const phase = (o.phase % 100) / 100;
        if (horizontal) parts.push({ c: `bar`, x: 1 + Math.round((span - bar) * phase), y: 1, w: bar, h: ih });
        else parts.push({ c: `bar`, x: 1, y: 1 + Math.round((span - bar) * (1 - phase)), w: iw, h: bar });
      } else {
        const fraction = this.fraction();
        if (fraction > 0) {
          if (horizontal) parts.push({ c: `bar`, x: 1, y: 1, w: Math.round(iw * fraction), h: ih });
          else parts.push({ c: `bar`, x: 1, y: 1 + Math.round(ih * (1 - fraction)), w: iw, h: Math.round(ih * fraction) });
        }
      }
      return { kind: `ttk`, ttk: `progressbar`, theme: this.look, st: ``, bd: 0, hl: 0, parts };
    }
  }

  // ---- ttk::combobox ---------------------------------------------------------------------

  class Combobox extends Widget {
    static tk_class = `TCombobox`;
    static OPTIONS = options(
      [`background`, `background`, `WindowColor`, ``],
      [`class`, `class`, `Class`, ``],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`exportselection`, `exportSelection`, `ExportSelection`, 1, `bool`],
      [`font`, `font`, `Font`, `TkDefaultFont`, `font`],
      [`foreground`, `foreground`, `TextColor`, ``],
      [`height`, `height`, `Height`, 10, `int`],
      [`invalidcommand`, `invalidcommand`, `InvalidCommand`, ``],
      [`justify`, `justify`, `Justify`, `left`, `justify`],
      [`postcommand`, `postcommand`, `PostCommand`, ``],
      [`show`, `show`, `Show`, ``],
      [`state`, `state`, `State`, `normal`, `entrystate`],
      [`style`, `style`, `Style`, ``],
      [`takefocus`, `takeFocus`, `TakeFocus`, `ttk::takefocus`],
      [`textvariable`, `textvariable`, `Variable`, ``],
      [`validate`, `validate`, `Validate`, `none`],
      [`validatecommand`, `validatecommand`, `ValidateCommand`, ``],
      [`values`, `values`, `Values`, ``],
      [`width`, `width`, `Width`, 20, `int`],
      [`xscrollcommand`, `xScrollCommand`, `ScrollCommand`, ``],
    );

    constructor(app, path, parent) {
      super(app, path, parent);
      this._value = ``;
      this.cursor = 0;
      this.selection = null;
      this.anchor = 0;
    }

    get look() {
      return this.app.ttk.look;
    }

    style_name() {
      return to_str(this.options.style) || `TCombobox`;
    }

    lookup(style, option, flags = [], default_ = null) {
      return this.app.ttk.lookup(style, option, new Set(flags), default_);
    }

    get font() {
      return this.app.fonts.get(this.options.font);
    }

    get value() {
      const variable = this.options.textvariable;
      if (variable) return to_str(this.app.getvar_default(variable, ``));
      return this._value;
    }

    set_value(value) {
      this._value = value;
      const variable = this.options.textvariable;
      if (variable) this.app.setvar(variable, value, this);
      this.cursor = Math.min(this.cursor, value.length);
      this.app.schedule_render();
    }

    options_changed(keys) {
      if (keys.includes(`textvariable`)) {
        const variable = this.options.textvariable;
        this.app.link_variable(this, variable);
        if (variable && !this.app.var_exists(variable)) this.app.setvar(variable, this._value);
      }
      super.options_changed(keys);
    }

    variable_changed(name) {
      this.cursor = Math.min(this.cursor, this.value.length);
      this.app.schedule_render();
    }

    created() {
      const variable = this.options.textvariable;
      if (variable) {
        this.app.link_variable(this, variable);
        if (!this.app.var_exists(variable)) this.app.setvar(variable, ``);
      }
    }

    on_destroy() {
      this.app.unlink_widget(this);
    }

    editable() {
      return this.options.state === `normal`;
    }

    values() {
      return split_list(to_str(this.options.values)).map(to_str);
    }

    current_index() {
      const value = this.value;
      if (!value) return -1;
      return this.values().indexOf(value);
    }

    arrow_width() {
      return 18;
    }

    content_request() {
      const font = this.font;
      const avg = font.measure(`0`) || 1;
      const width = this.options.width > 0 ? this.options.width * avg : font.measure(this.value);
      return [width + 2 * 3 + this.arrow_width(), font.linespace + 8];
    }

    // ---- commands ---------------------------------------------------------------------

    cmd_get(args) {
      return this.value;
    }

    cmd_set(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} set value"`);
      this.set_value(to_str(args[0]));
      return ``;
    }

    cmd_current(args) {
      if (!args.length) {
        const index = this.current_index();
        return index === -1 ? `` : String(index);
      }
      const index = get_int(args[0]);
      const values = this.values();
      if (index < 0 || index >= values.length) throw new TclError(`Index ${index} out of range`);
      this.set_value(values[index]);
      return String(index);
    }

    cmd_post(args) {
      this.post_list();
      return ``;
    }

    cmd_insert(args) {
      if (args.length !== 2) throw new TclError(`wrong # args: should be "${this.path} insert index text"`);
      if (!this.editable()) return ``;
      const i = this.index(args[0]);
      const text = to_str(args[1]);
      const value = this.value;
      if (this.cursor >= i) this.cursor += text.length;
      this.set_value(value.slice(0, i) + text + value.slice(i));
      return ``;
    }

    cmd_delete(args) {
      if (args.length < 1 || args.length > 2) {
        throw new TclError(`wrong # args: should be "${this.path} delete firstIndex ?lastIndex?"`);
      }
      if (!this.editable()) return ``;
      const first = this.index(args[0]);
      const last = args.length === 2 ? this.index(args[1]) : first + 1;
      if (last <= first) return ``;
      const value = this.value;
      this.set_value(value.slice(0, first) + value.slice(last));
      return ``;
    }

    cmd_icursor(args) {
      this.cursor = this.index(args[0]);
      this.app.schedule_render();
      return ``;
    }

    cmd_index(args) {
      return this.index(args[0]);
    }

    cmd_selection(args) {
      const sub = args.length ? to_str(args[0]) : ``;
      if (sub === `range`) {
        const first = this.index(args[1]);
        const last = this.index(args[2]);
        this.selection = last > first ? [first, last] : null;
      } else if (sub === `clear`) {
        this.selection = null;
      } else if (sub === `present`) {
        return this.selection ? 1 : 0;
      } else if (sub === `from`) {
        this.anchor = this.index(args[1]);
      } else if (sub === `to`) {
        const last = this.index(args[1]);
        const first = this.anchor;
        this.selection = first !== last ? [Math.min(first, last), Math.max(first, last)] : null;
      } else if (sub === `adjust`) {
        const last = this.index(args[1]);
        this.selection = [Math.min(this.anchor, last), Math.max(this.anchor, last)];
      } else {
        throw new TclError(
          `bad selection option "${sub}": must be adjust, clear, element, from, present, range, or to`,
        );
      }
      this.app.schedule_render();
      return ``;
    }

    cmd_xview(args) {
      return !args.length ? [0, 1] : ``;
    }

    cmd_bbox(args) {
      const i = this.index(args[0]);
      const font = this.font;
      const x = 3 + font.measure(this.value.slice(0, i));
      return [x, 3, font.measure(this.value.slice(i, i + 1)) || 1, font.linespace];
    }

    cmd_identify(args) {
      if (args.length !== 2) throw new TclError(`wrong # args: should be "${this.path} identify x y"`);
      const x = get_int(args[0]);
      const y = get_int(args[1]);
      if (y < 0 || y >= this.height) return ``;
      if (x >= this.width - this.arrow_width()) return `Arrow`;
      if (x >= 0) return `Text`;
      return ``;
    }

    cmd_validate(args) {
      return 1;
    }

    cmd_state(args) {
      if (!args.length) {
        return this.options.state === `normal` ? `` : this.options.state;
      }
      const words = parse_statespec(args[0]);
      for (const word of words) {
        if (word === `disabled`) this.options.state = `disabled`;
        else if (word === `!disabled`) this.options.state = `normal`;
        else if (word === `readonly`) this.options.state = `readonly`;
        else if (word === `!readonly`) this.options.state = `normal`;
      }
      this.app.schedule_render();
      return ``;
    }

    cmd_instate(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "${this.path} instate statespec"`);
      const words = parse_statespec(args[0]);
      const flags = new Set();
      if (this.options.state === `disabled`) flags.add(`disabled`);
      if (this.options.state === `readonly`) flags.add(`readonly`);
      return state_matches(words, flags) ? 1 : 0;
    }

    cmd_style(args) {
      return this.style_name();
    }

    index(spec) {
      const s = to_str(spec);
      const n = this.value.length;
      if (s === `end`) return n;
      if (s === `insert`) return this.cursor;
      if (s === `anchor`) return this.anchor;
      if (s === `sel.first` || s === `sel.last`) {
        if (!this.selection) throw new TclError(`selection isn't in widget ${this.path}`);
        return this.selection[s === `sel.first` ? 0 : 1];
      }
      let i;
      try {
        i = get_int(s);
      } catch {
        throw new TclError(`bad index "${s}"`);
      }
      return Math.max(0, Math.min(i, n));
    }

    // ---- the drop-down list ------------------------------------------------------------

    post_list() {
      const command = this.options.postcommand;
      if (command) this.app.eval_script(command);
      const values = this.values();
      if (!values.length) return;
      const font = this.font;
      const rowh = font.linespace + 4;
      const rows = Math.max(1, Math.min(values.length, this.options.height > 0 ? this.options.height : 10));
      this.app.flush();
      this.app.post_ops([
        {
          op: `combo_post`, app: this.app.id, id: this.path, win: this.toplevel.path,
          font: font.css, values, current: this.current_index(), rows, rowh,
        },
      ]);
    }

    page_combo(ev) {
      /* The page reports the row picked in the drop-down list. */
      const values = this.values();
      const index = Number(ev.index);
      if (!(index >= 0) || index >= values.length) return undefined;
      this.set_value(values[index]);
      this.selection = null;
      this.app.schedule_render();
      this.app.dispatch_virtual(this, `ComboboxSelected`);
      return undefined;
    }

    class_event(event) {
      if (event.type === 4 && event.num === 1) {
        const x = event.x ?? 0;
        if (x >= this.width - this.arrow_width()) {
          this.post_list();
          return undefined;
        }
      }
      return undefined;
    }

    // ---- rendering ----------------------------------------------------------------------

    render() {
      const o = this.options;
      const font = this.font;
      const w = this.width;
      const h = this.height;
      const arrow = this.arrow_width();
      const pad = 3;
      const style = this.style_name();
      const field_bg = this.lookup(style, `fieldbackground`, [], `#ffffff`);
      const fg = this.lookup(style, `foreground`, [], `#000000`);
      const state = o.state;
      const st = state === `disabled` ? `disabled` : state === `readonly` ? `readonly` : ``;
      const parts = [
        { c: `field`, x: 0, y: 0, w, h, bg: field_bg },
        { c: `arrow`, x: w - arrow, y: 0, w: arrow, h },
      ];
      return {
        kind: `ttk`, ttk: `combobox`, theme: this.look, st, bd: 0, hl: 0,
        bg: field_bg, fbg: field_bg, parts,
        ib: [pad, pad, Math.max(1, w - arrow - 2 * pad), Math.max(1, h - 2 * pad)],
        padr: 0,
        value: this.value,
        font: font.css,
        fg,
        bg: field_bg,
        justify: o.justify,
        pad: 0,
        state,
        show: o.show,
        cursor: this.cursor,
        selectbg: `#0078d7`,
        selectfg: `#ffffff`,
        insertcolor: fg,
        values: this.values(),
        current: this.current_index(),
        rows: Math.max(1, Math.min(this.values().length || 1, o.height > 0 ? o.height : 10)),
        rowh: font.linespace + 4,
      };
    }
  }

  // ---- ttk widgets ---------------------------------------------------------------------------
  //
  // The themed widgets are drawn as "ttk" widgets: the page paints their parts
  // with the look of the current theme (vista/clam), so switching the theme
  // repaints every ttk widget in the new colours.

  const TTK_PADDING_OPTION = [`padding`, `padding`, `Padding`, ``];

  function ttk_padding(value) {
    return nb_pad(value, [0, 0, 0, 0]);
  }
  const TTK_STYLE_OPTION = [`style`, `style`, `Style`, ``];

  const TtkMixin = {
    get look() {
      return this.app.ttk.look;
    },
    ttk_style(fallback) {
      return to_str(this.options.style) || fallback;
    },
    ttk_lookup(style, option, flags = [], default_ = null) {
      return this.app.ttk.lookup(style, option, new Set(flags), default_);
    },
    ttk_pad() {
      return ttk_padding(this.options.padding);
    },
    ttk_background() {
      /* The theme background of a widget: the style value or the theme's. */
      const style = this.ttk_style(``);
      if (style) {
        const bg = this.ttk_lookup(style, `background`, [], null);
        if (bg) return bg;
      }
      return this.app.ttk.background;
    },
    ttk_states(extra = []) {
      const flags = [...extra];
      const o = this.options;
      if (o.state === `disabled`) flags.push(`disabled`);
      else if (o.state === `active`) flags.push(`active`);
      if (this.app.focus_widget === this) flags.push(`focus`);
      return flags.join(` `);
    },
    ttk_text_box() {
      /* Where the text goes inside a ttk label-like widget. */
      const font = this.font;
      const p = this.ttk_pad();
      const [, text_w, text_h] = this.text_layout();
      const h = text_h || font.linespace;
      const avail_w = Math.max(0, this.width - p[0] - p[2]);
      const avail_h = Math.max(0, this.height - p[1] - p[3]);
      const a = this.options.anchor ?? `center`;
      let x;
      if ([`nw`, `w`, `sw`].includes(a)) x = p[0];
      else if ([`ne`, `e`, `se`].includes(a)) x = p[0] + avail_w - text_w;
      else x = p[0] + Math.trunc((avail_w - text_w) / 2);
      let y;
      if ([`nw`, `n`, `ne`].includes(a)) y = p[1];
      else if ([`sw`, `s`, `se`].includes(a)) y = p[1] + avail_h - h;
      else y = p[1] + Math.trunc((avail_h - h) / 2);
      return { x, y, w: text_w, h };
    },
    ttk_text_part(extra = {}) {
      const font = this.font;
      const t = this.ttk_text_box();
      const [fg] = this.state_colors();
      return Object.assign(
        {
          c: `text`, x: t.x, y: t.y, w: t.w, h: t.h, t: this.text,
          f: font.css, lh: t.h, al: `left`, fg: css_color(fg),
        },
        extra,
      );
    },
  };

  function ttk_class(cls) {
    const descriptors = Object.getOwnPropertyDescriptors(TtkMixin);
    for (const [key, value] of Object.entries(descriptors)) {
      Object.defineProperty(cls.prototype, key, value);
    }
    return cls;
  }

  class TtkFrame extends ns.Frame {
    static tk_class = `TFrame`;
    static OPTIONS = merge_options(ns.FRAME_OPTIONS, options(TTK_PADDING_OPTION, TTK_STYLE_OPTION));

    borders() {
      const [left, top, right, bottom] = super.borders();
      const p = this.ttk_pad();
      return [left + p[0], top + p[1], right + p[2], bottom + p[3]];
    }

    render() {
      return {
        kind: `ttk`, ttk: `frame`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, bg: css_color(this.ttk_background()), parts: [],
      };
    }
  }

  class TtkLabel extends ns.Label {
    static tk_class = `TLabel`;
    static OPTIONS = merge_options(ns.LABEL_OPTIONS, options(TTK_PADDING_OPTION, TTK_STYLE_OPTION));

    content_request() {
      const font = this.font;
      const [, text_w, text_h] = this.text_layout();
      const p = this.ttk_pad();
      return [text_w + p[0] + p[2], (text_h || font.linespace) + p[1] + p[3]];
    }

    render() {
      const parts = [];
      const text = this.ttk_text_part();
      if (text.w || text.h) parts.push(text);
      const image = this.image();
      if (image) {
        const t = this.ttk_text_box();
        parts.push({ c: `img`, x: t.x, y: t.y, w: image.width, h: image.height, img: image.url() });
      }
      return {
        kind: `ttk`, ttk: `label`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, bg: css_color(this.ttk_background()), parts,
      };
    }
  }

  class TtkButton extends ns.Button {
    static tk_class = `TButton`;
    static OPTIONS = merge_options(ns.BUTTON_OPTIONS, options(TTK_PADDING_OPTION, TTK_STYLE_OPTION));

    content_request() {
      const font = this.font;
      const [, text_w, text_h] = this.text_layout();
      return [text_w + 16, (text_h || font.linespace) + 10];
    }

    render() {
      const parts = [{ c: `face`, x: 0, y: 0, w: this.width, h: this.height }];
      const text = this.ttk_text_part();
      if (text.w || text.h) parts.push(text);
      return {
        kind: `ttk`, ttk: `button`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, parts,
      };
    }
  }

  function ttk_toggle_request(widget) {
    const font = widget.font;
    const [, text_w, text_h] = widget.text_layout();
    const box = 13;
    return [box + 4 + text_w, Math.max(box, text_h || font.linespace) + 4];
  }

  function ttk_toggle_render(widget, kind) {
    const font = widget.font;
    const box = 13;
    const parts = [{ c: `ind`, x: 0, y: Math.trunc((widget.height - box) / 2), w: box, h: box }];
    const [, text_w, text_text_h] = widget.text_layout();
    const h = text_text_h || font.linespace;
    const [fg] = widget.state_colors();
    parts.push({
      c: `text`, x: box + 4, y: Math.trunc((widget.height - h) / 2), w: text_w, h,
      t: widget.text, f: font.css, lh: h, al: `left`, fg: css_color(fg),
    });
    const states = [];
    if (widget.is_selected()) states.push(`selected`);
    if (widget.options.alternate) states.push(`alternate`);
    return {
      kind: `ttk`, ttk: kind, theme: widget.look, st: widget.ttk_states(states),
      bd: 0, hl: 0, parts,
    };
  }

  class TtkCheckbutton extends ns.Checkbutton {
    static tk_class = `TCheckbutton`;
    static OPTIONS = merge_options(ns.CHECK_OPTIONS, options(TTK_PADDING_OPTION, TTK_STYLE_OPTION));

    content_request() {
      return ttk_toggle_request(this);
    }

    render() {
      return ttk_toggle_render(this, `check`);
    }
  }

  class TtkRadiobutton extends ns.Radiobutton {
    static tk_class = `TRadiobutton`;
    static OPTIONS = merge_options(ns.RADIO_OPTIONS, options(TTK_PADDING_OPTION, TTK_STYLE_OPTION));

    content_request() {
      return ttk_toggle_request(this);
    }

    render() {
      return ttk_toggle_render(this, `radio`);
    }
  }

  class TtkEntry extends ns.Entry {
    static tk_class = `TEntry`;
    static OPTIONS = merge_options(ns.ENTRY_OPTIONS, options(TTK_STYLE_OPTION));

    content_request() {
      const font = this.font;
      const avg = font.measure(`0`) || 1;
      const width = this.options.width > 0 ? this.options.width * avg : font.measure(this.value);
      return [width + 8, font.linespace + 8];
    }

    render() {
      const o = this.options;
      const font = this.font;
      const w = this.width;
      const h = this.height;
      const pad = 3;
      const style = this.ttk_style(`TEntry`);
      const field_bg = this.ttk_lookup(style, `fieldbackground`, [], `#ffffff`);
      const fg = this.ttk_lookup(style, `foreground`, [], `#000000`);
      const parts = [{ c: `field`, x: 0, y: 0, w, h, bg: field_bg }];
      return {
        kind: `ttk`, ttk: `entry`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, bg: field_bg, fbg: field_bg, parts,
        ib: [pad, pad, Math.max(1, w - 2 * pad), Math.max(1, h - 2 * pad)],
        padr: 0,
        value: this.value, font: font.css, fg, bg: field_bg,
        justify: o.justify, pad: 0, state: o.state, show: o.show, cursor: this.cursor,
        selectbg: `#0078d7`, selectfg: `#ffffff`, insertcolor: fg,
      };
    }
  }

  class TtkMenubutton extends ns.Menubutton {
    static tk_class = `TMenubutton`;
    static OPTIONS = merge_options(ns.Menubutton.OPTIONS, options(TTK_STYLE_OPTION));

    arrow_width() {
      return 14;
    }

    content_request() {
      const font = this.font;
      const [, text_w, text_h] = this.text_layout();
      return [text_w + 16 + this.arrow_width(), (text_h || font.linespace) + 10];
    }

    render() {
      const font = this.font;
      const arrow = this.arrow_width();
      const parts = [{ c: `face`, x: 0, y: 0, w: this.width, h: this.height }];
      const [, text_w, text_h] = this.text_layout();
      const h = text_h || font.linespace;
      const [fg] = this.state_colors();
      parts.push({
        c: `text`, x: 8, y: Math.trunc((this.height - h) / 2), w: text_w, h,
        t: this.text, f: font.css, lh: h, al: `left`, fg: css_color(fg),
      });
      parts.push({
        c: `arrow`, x: this.width - arrow, y: 0, w: arrow, h: this.height,
      });
      return {
        kind: `ttk`, ttk: `menubutton`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, parts,
      };
    }
  }

  class TtkLabelFrame extends ns.more.LabelFrame {
    static tk_class = `TLabelframe`;
    static OPTIONS = merge_options(
      ns.more.LabelFrame.OPTIONS,
      options(TTK_PADDING_OPTION, TTK_STYLE_OPTION),
    );

    label_height() {
      return this.options.text ? this.font.linespace : 0;
    }

    internal_border() {
      // The ttk padding replaces the classic -padx/-pady.
      const o = this.options;
      const inset = o.highlightthickness + o.borderwidth;
      return [inset, inset];
    }

    borders() {
      const [left, top, right, bottom] = super.borders();
      const p = this.ttk_pad();
      // The label sits on the top border: the content starts below it.
      return [left + p[0], top + p[1] + this.label_height(), right + p[2], bottom + p[3]];
    }

    content_request() {
      const font = this.font;
      const text_w = this.options.text ? font.measure(this.options.text) : 0;
      const p = this.ttk_pad();
      return [text_w + 16, this.label_height() + 4 + p[1] + p[3]];
    }

    render() {
      const font = this.font;
      const text = this.options.text ?? ``;
      const label_w = text ? font.measure(text) : 0;
      const label_h = font.linespace;
      const bg = this.ttk_background();
      const parts = [{ c: `border`, x: 0, y: 0, w: this.width, h: this.height }];
      if (text) {
        parts.push({
          c: `lflabel`, x: 4, y: 1, w: label_w + 2, h: label_h,
          t: text, f: font.css, lh: label_h, al: `left`,
          fg: css_color(this.options.foreground), bg: css_color(bg),
        });
      }
      return {
        kind: `ttk`, ttk: `labelframe`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, bg: css_color(bg), parts,
      };
    }
  }

  class TtkScrollbar extends ns.more.Scrollbar {
    static tk_class = `TScrollbar`;
    static OPTIONS = merge_options(ns.more.Scrollbar.OPTIONS, options(TTK_STYLE_OPTION));

    render() {
      const w = this.width;
      const h = this.height;
      const vertical = this.vertical;
      const parts = [{ c: `trough`, x: 0, y: 0, w, h }];
      const size = vertical ? w : h;
      const bar = Math.max(12, Math.round(size * (this.last - this.first)));
      const pos = Math.round((size - bar) * this.first);
      if (vertical) parts.push({ c: `bar`, x: 0, y: pos, w, h: bar });
      else parts.push({ c: `bar`, x: pos, y: 0, w: bar, h });
      return {
        kind: `ttk`, ttk: `scrollbar`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, vertical, parts,
      };
    }
  }

  class TtkSeparator extends ns.Frame {
    static tk_class = `TSeparator`;
    static OPTIONS = options(
      [`class`, `class`, `Class`, ``],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`orient`, `orient`, `Orient`, `horizontal`],
      [`style`, `style`, `Style`, ``],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
    );

    horizontal() {
      return this.options.orient !== `vertical`;
    }

    content_request() {
      return this.horizontal() ? [20, 2] : [2, 20];
    }

    render() {
      const horizontal = this.horizontal();
      const parts = horizontal
        ? [{ c: `sep`, x: 0, y: 0, w: this.width, h: 2 }]
        : [{ c: `sep`, x: 0, y: 0, w: 2, h: this.height }];
      return {
        kind: `ttk`, ttk: `separator`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, vertical: !horizontal, parts,
      };
    }
  }

  class TtkSizegrip extends ns.Frame {
    static tk_class = `TSizegrip`;
    static OPTIONS = options(
      [`class`, `class`, `Class`, ``],
      [`cursor`, `cursor`, `Cursor`, ``],
      [`style`, `style`, `Style`, ``],
      [`takefocus`, `takeFocus`, `TakeFocus`, ``],
    );

    content_request() {
      return [14, 14];
    }

    render() {
      return {
        kind: `ttk`, ttk: `sizegrip`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, parts: [{ c: `grip`, x: this.width - 14, y: this.height - 14, w: 14, h: 14 }],
      };
    }
  }

  const SpinboxBase = ns.more.Spinbox;

  class TtkSpinbox extends SpinboxBase {
    static tk_class = `TSpinbox`;
    static OPTIONS = merge_options(
      SpinboxBase.OPTIONS,
      options(
        [`style`, `style`, `Style`, ``],
      ),
    );

    get look() {
      return this.app.ttk.look;
    }

    style_name() {
      return to_str(this.options.style) || `TSpinbox`;
    }

    arrow_width() {
      return 16;
    }

    button_width() {
      return this.arrow_width();
    }

    render() {
      const o = this.options;
      const font = this.font;
      const w = this.width;
      const h = this.height;
      const arrow = this.arrow_width();
      const pad = 3;
      const style = this.style_name();
      const field_bg = this.app.ttk.lookup(style, `fieldbackground`, new Set(), `#ffffff`);
      const fg = this.app.ttk.lookup(style, `foreground`, new Set(), `#000000`);
      const half = Math.trunc(h / 2);
      const parts = [
        { c: `field`, x: 0, y: 0, w, h, bg: field_bg },
        { c: `up`, x: w - arrow, y: 0, w: arrow, h: half },
        { c: `down`, x: w - arrow, y: half, w: arrow, h: h - half },
      ];
      return {
        kind: `ttk`, ttk: `spinbox`, theme: this.look,
        st: o.state === `disabled` ? `disabled` : ``,
        bd: 0, hl: 0, bg: field_bg, fbg: field_bg, parts,
        ib: [pad, pad, Math.max(1, w - arrow - 2 * pad), Math.max(1, h - 2 * pad)],
        padr: 0,
        value: this.value,
        font: font.css,
        fg,
        bg: field_bg,
        justify: o.justify,
        pad: 0,
        state: o.state,
        show: o.show,
        cursor: this.cursor,
        selectbg: `#0078d7`,
        selectfg: `#ffffff`,
        insertcolor: fg,
      };
    }
  }


  // ---- ttk::scale --------------------------------------------------------------------------

  const ScaleBase = ns.more.Scale;

  class TtkScale extends ScaleBase {
    static tk_class = `TScale`;
    static OPTIONS = merge_options(
      ScaleBase.OPTIONS,
      options(
        [`orient`, `orient`, `Orient`, `horizontal`],
        [`value`, `value`, `Value`, 0, `float`],
        [`style`, `style`, `Style`, ``],
      ),
    );

    get look() {
      return this.app.ttk.look;
    }

    slider_length() {
      return 11;
    }

    content_request() {
      const o = this.options;
      const length = o.length > 0 ? o.length : 100;
      return this.horizontal ? [length, 20] : [20, length];
    }

    _geometry() {
      /* The ttk scale draws a thin track instead of a trough. */
      const length = this.horizontal ? this.width : this.height;
      const thickness = 4;
      if (this.horizontal) {
        const y = Math.trunc((this.height - thickness) / 2);
        return { tx: 0, ty: y, tl: length, tw: thickness };
      }
      const x = Math.trunc((this.width - thickness) / 2);
      return { tx: x, ty: 0, tl: length, tw: thickness };
    }

    _slider_center(geo) {
      const o = this.options;
      const len = this.slider_length();
      const travel = Math.max(geo.tl - len, 0);
      const span = o.to - o.from;
      const frac = span === 0 ? 0 : (this.value - o.from) / span;
      const start = this.horizontal ? geo.tx : geo.ty;
      return Math.trunc(start + len / 2 + frac * travel);
    }

    value_from_pixel(pixel) {
      const o = this.options;
      const geo = this._geometry();
      const len = this.slider_length();
      const travel = Math.max(geo.tl - len, 1);
      const start = (this.horizontal ? geo.tx : geo.ty) + len / 2;
      const frac = Math.max(0, Math.min(1, (pixel - start) / travel));
      return o.from + frac * (o.to - o.from);
    }

    render() {
      const geo = this._geometry();
      const len = this.slider_length();
      const center = this._slider_center(geo);
      // geo.tl is the length of the track, geo.tw its thickness.
      const parts = [{
        c: `track`,
        x: geo.tx, y: geo.ty,
        w: this.horizontal ? geo.tl : geo.tw,
        h: this.horizontal ? geo.tw : geo.tl,
      }];
      if (this.horizontal) {
        parts.push({ c: `slider`, x: center - Math.trunc(len / 2), y: 0, w: len, h: this.height });
      } else {
        parts.push({ c: `slider`, x: 0, y: center - Math.trunc(len / 2), w: this.width, h: len });
      }
      return {
        kind: `ttk`, ttk: `scale`, theme: this.look, st: this.ttk_states(),
        bd: 0, hl: 0, vertical: !this.horizontal, parts,
      };
    }

    created() {
      super.created();
      this.value = this.round(this.options.value);
      this._push_value();
    }

    options_changed(keys) {
      if (keys.includes(`value`) && this.app.widgets.get(this.path) === this) {
        this.value = this.round(this.options.value);
        this._push_value();
      }
      super.options_changed(keys);
    }

    set_value(value, user = false) {
      const rounded = this.round(value);
      this.options.value = rounded;
      super.set_value(rounded, user);
    }

    _push_value() {
      const variable = this.options.variable;
      if (variable) this.app.setvar(variable, this.typed(this.value), this);
    }
  }

  for (const cls of [TtkFrame, TtkLabel, TtkButton, TtkCheckbutton, TtkRadiobutton, TtkEntry,
                     TtkMenubutton, TtkLabelFrame, TtkScrollbar, TtkSeparator, TtkSizegrip, TtkSpinbox,
                     TtkScale]) {
    ttk_class(cls);
  }

  ns.split_commands = split_commands;
  ns.Notebook = Notebook;
  ns.Treeview = Treeview;
  ns.Progressbar = Progressbar;
  ns.Combobox = Combobox;
  ns.TtkScale = TtkScale;
  ns.TtkFrame = TtkFrame;
  ns.TtkLabelFrame = TtkLabelFrame;
  ns.TtkLabel = TtkLabel;
  ns.TtkButton = TtkButton;
  ns.TtkCheckbutton = TtkCheckbutton;
  ns.TtkRadiobutton = TtkRadiobutton;
  ns.TtkEntry = TtkEntry;
  ns.TtkMenubutton = TtkMenubutton;
  ns.TtkScrollbar = TtkScrollbar;
  ns.TtkSeparator = TtkSeparator;
  ns.TtkSizegrip = TtkSizegrip;
  ns.TtkSpinbox = TtkSpinbox;
  ns.FLAGS = FLAGS;
  ns.parse_statespec = parse_statespec;
  ns.state_matches = state_matches;
  ns.style_chain = style_chain;
  ns.THEMES = THEMES;
  ns.LOOKS = LOOKS;
  ns.StyleDB = StyleDB;
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// dialogs.js
// ============================================================

(function (ns) {
  "use strict";
  var css_color = ns.css_color;
  var TclError = ns.TclError;
  var get_boolean = ns.get_boolean;
  var split_list = ns.split_list;
  var to_str = ns.to_str;
  var susp = ns.susp;

  /**
   * tk_chooseColor, tk_getOpenFile, tk_getSaveFile and tk_chooseDirectory:
   * Windows dialogs drawn by the page.
   *
   * The file dialogs show the program folder (app.fs.program_dir). Files the
   * user uploads from the computer in a dialog are written into the folder
   * before the dialog returns their names; app.apply_uploads performs the
   * (possibly asynchronous) writes in the binding layer.
   *
   * JS port of pythonny_tk/dialogs.py: os.path / _pythonny_io access is routed
   * through the app.fs hook object.
   */


  const _OPTIONS = {
    color: [`-initialcolor`, `-parent`, `-title`],
    open: [
      `-defaultextension`, `-filetypes`, `-initialdir`, `-initialfile`, `-multiple`, `-parent`,
      `-title`, `-typevariable`,
    ],
    save: [
      `-confirmoverwrite`, `-defaultextension`, `-filetypes`, `-initialdir`, `-initialfile`,
      `-parent`, `-title`, `-typevariable`,
    ],
    dir: [`-initialdir`, `-mustexist`, `-parent`, `-title`],
  };

  function _root(app) {
    return String(app.fs.program_dir ?? `/`);
  }

  function _options(app, kind, args) {
    if (args.length % 2) {
      throw new TclError(`value for "${to_str(args[args.length - 1])}" missing`);
    }
    const allowed = _OPTIONS[kind];
    const opts = {};
    for (let k = 0; k < args.length; k += 2) {
      const name = to_str(args[k]);
      if (!allowed.includes(name)) {
        const listed = allowed.slice(0, -1).join(`, `) + `, or ` + allowed[allowed.length - 1];
        throw new TclError(`bad option "${name}": must be ${listed}`);
      }
      opts[name] = args[k + 1];
    }
    if (`-parent` in opts) app.widget(opts[`-parent`]); // bad window path name "..."
    return opts;
  }

  function choose_color(app, args) {
    const opts = _options(app, `color`, args);
    const initial = to_str(opts[`-initialcolor`] ?? ``);
    const value = app.modal(
      {
        op: `colorbox`, title: to_str(opts[`-title`] ?? ``),
        initial: initial ? css_color(initial) : ``,
      },
      to_str(opts[`-parent`] ?? `.`),
    );
    return susp.chain(value, (v) => to_str(v || ``));
  }

  function _filetypes(value) {
    /* -filetypes {{label patterns ?mactypes?} ...} -> [[label, [".txt", "*"]], ...]. */
    const types = [];
    const items = value !== null && value !== undefined && value !== `` ? split_list(value) : [];
    for (const item of items) {
      const parts = split_list(item);
      if (parts.length < 2) {
        throw new TclError(
          `bad file type "${to_str(item)}", should be "typeName {{extension ?extensions ...?}} ?{{macType ?macTypes ...?}}?"`,
        );
      }
      const patterns = split_list(parts[1]).map(to_str);
      types.push([to_str(parts[0]), patterns]);
    }
    return types;
  }

  function _own(name) {
    return !name.startsWith(`.`) && name !== `__pycache__`;
  }

  function _listing(app) {
    /* The folder's files ("dir/" for folders) with their sizes, as in the Files panel. */
    const fs = app.fs;
    const root = _root(app);
    const programs = fs.program_files;
    const hidden = new Set(programs ?? []);
    const entries = [];
    for (const { top, dirs, files } of fs.walk(root, _own)) {
      const rel = fs.relpath(top, root);
      const prefix = rel === `.` ? `` : String(rel).split(fs.sep ?? `/`).join(`/`) + `/`;
      for (const d of dirs) entries.push({ path: prefix + d + `/`, size: 0 });
      for (const name of [...files].sort()) {
        if (_own(name) && (prefix || !hidden.has(name))) {
          let size;
          try {
            size = fs.size(fs.join(top, name));
          } catch {
            continue;
          }
          entries.push({ path: prefix + name, size });
        }
      }
    }
    return entries;
  }

  function _start_dir(app, root, initial) {
    /* -initialdir as a folder of the program folder ("" or "images/"). */
    if (!initial) return ``;
    const fs = app.fs;
    const path = fs.normpath(fs.join(root, initial));
    if (((path !== root && !path.startsWith(root + (fs.sep ?? `/`))) || !fs.is_dir(path))) {
      return ``;
    }
    const rel = fs.relpath(path, root);
    return rel === `.` ? `` : String(rel).split(fs.sep ?? `/`).join(`/`) + `/`;
  }

  function file_dialog(app, kind, args) {
    const opts = _options(app, kind, args);
    const root = _root(app);
    const multiple = kind === `open` && get_boolean(opts[`-multiple`] ?? 0);
    const types = kind !== `dir` ? _filetypes(opts[`-filetypes`] ?? ``) : [];
    const typevar = to_str(opts[`-typevariable`] ?? ``);
    let type_index = 0;
    if (typevar && types.length) {
      const current = to_str(app.getvar_default(typevar, ``));
      type_index = types.findIndex(([label]) => label === current);
      if (type_index === -1) type_index = 0;
    }
    const fs = app.fs;
    const res = app.modal(
      {
        op: `filebox`, kind, title: to_str(opts[`-title`] ?? ``),
        dir: _start_dir(app, root, to_str(opts[`-initialdir`] ?? ``)),
        name: fs.basename(to_str(opts[`-initialfile`] ?? ``)),
        types, type: type_index, multiple: Boolean(multiple),
        defaultext: to_str(opts[`-defaultextension`] ?? ``),
        confirm: Boolean(get_boolean(opts[`-confirmoverwrite`] ?? 1)),
        entries: _listing(app),
      },
      to_str(opts[`-parent`] ?? `.`),
    );
    return susp.chain(res, (result) => {
      if (!result) return ``;
      const uploads = result.uploads ?? [];
      if (uploads.length) app.apply_uploads(uploads, root);
      if (typevar && result.type !== undefined && result.type !== null) {
        app.setvar(typevar, result.type);
      }
      const paths = (result.paths ?? []).map((p) => fs.join(root, p).replace(/\/+$/, ``));
      if (multiple) return paths;
      return paths.length ? paths[0] : ``;
    });
  }

  const DIALOG_COMMANDS = {
    tk_chooseColor: choose_color,
    tk_getOpenFile: (app, args) => file_dialog(app, `open`, args),
    tk_getSaveFile: (app, args) => file_dialog(app, `save`, args),
    tk_chooseDirectory: (app, args) => file_dialog(app, `dir`, args),
  };

  ns.choose_color = choose_color;
  ns.file_dialog = file_dialog;
  ns.DIALOG_COMMANDS = DIALOG_COMMANDS;
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});

// ============================================================
// app.js
// ============================================================

(function (ns) {
  "use strict";
  var TclError = ns.TclError;
  var get_boolean = ns.get_boolean;
  var get_double = ns.get_double;
  var get_int = ns.get_int;
  var get_pixels = ns.get_pixels;
  var join_list = ns.join_list;
  var split_list = ns.split_list;
  var to_str = ns.to_str;
  var css_color = ns.css_color;
  var FontRegistry = ns.FontRegistry;
  var ImageRegistry = ns.ImageRegistry;
  var b64encode = ns.b64encode;
  var WIDGET_CLASSES = ns.WIDGET_CLASSES;
  var Toplevel = ns.Toplevel;
  var Menu = ns.Menu;
  var choose_color = ns.choose_color;
  var file_dialog = ns.file_dialog;
  var StyleDB = ns.StyleDB;
  var events = ns.events;
  var geometry = ns.geometry;
  var more = ns.more;
  var textm = ns.textm;
  var canvasm = ns.canvasm;
  var menusm = ns.menusm;

  // The emulated Tcl/Tk interpreter behind our _tkinter module (port of
  // pythonny_tk/app.py).
  //
  // TkApp implements the commands tkinter sends through tk.call() (widget
  // creation, geometry managers, bind, after, wm, winfo, variables, ...), runs
  // the event loop and sends the rendered widget tree to the page.
  //
  // Suspension design (async hosts): a callback may return a suspension instead
  // of a value (e.g. a Python callback awaiting inside mainloop/modal). Every
  // frame that examines or transforms a result must pass it through
  // susp.chain(value, onValue, onError):
  //   - guard pattern: `const r = sub(); if (susp.is_suspension(r)) return
  //     susp.chain(r, continuation);` - in sync mode is_suspension() is always
  //     false, so the chain is never built (zero overhead, plain iteration);
  //   - onError is used where Python has try/except/finally around the call
  //     (dispatch restores current_event, process_event reports the error).
  // Values that Python ignores may be dropped, but only with _sink() so that
  // post-resume errors still reach a handler.



  // ---- widget classes ---------------------------------------------------------------------
  // Python updates WIDGET_CLASSES in place with the extra widget modules.
  // The themed ttk widgets are deferred; ttk::* creation is redirected to the
  // plain Tk classes (unknown ttk-only options are filtered in _create), which
  // still renders the widget in the page's themed look.

  // Every ttk widget has its own class now, so nothing is redirected to the
  // plain Tk classes any more.
  const TTK_KINDS = {};

  const CLASSES = Object.assign(
    Object.create(null),
    WIDGET_CLASSES,
    more.WIDGETS,
    textm.WIDGETS,
    canvasm.WIDGETS,
    menusm.WIDGETS,
  );
  for (const [name, kind] of Object.entries(TTK_KINDS)) CLASSES[name] = CLASSES[kind];
  CLASSES[`ttk::notebook`] = ns.Notebook;
  CLASSES[`ttk::treeview`] = ns.Treeview;
  CLASSES[`ttk::progressbar`] = ns.Progressbar;
  CLASSES[`ttk::combobox`] = ns.Combobox;
  CLASSES[`ttk::scale`] = ns.TtkScale;
  CLASSES[`ttk::frame`] = ns.TtkFrame;
  CLASSES[`ttk::labelframe`] = ns.TtkLabelFrame;
  CLASSES[`ttk::label`] = ns.TtkLabel;
  CLASSES[`ttk::button`] = ns.TtkButton;
  CLASSES[`ttk::checkbutton`] = ns.TtkCheckbutton;
  CLASSES[`ttk::radiobutton`] = ns.TtkRadiobutton;
  CLASSES[`ttk::entry`] = ns.TtkEntry;
  CLASSES[`ttk::menubutton`] = ns.TtkMenubutton;
  CLASSES[`ttk::scrollbar`] = ns.TtkScrollbar;
  CLASSES[`ttk::separator`] = ns.TtkSeparator;
  CLASSES[`ttk::sizegrip`] = ns.TtkSizegrip;
  CLASSES[`ttk::spinbox`] = ns.TtkSpinbox;

  // ---- module state ------------------------------------------------------------------------

  const APPS = [];
  let _app_counter = 0;
  // mainloop() ends after quit() on any application.
  let _quit_requested = false;

  // Stand-in grab window while a message box is open: blocks all other input.
  const MSGBOX_GRAB = { destroyed: false, parent: null };

  const _BIND_LINE = /^\+?if \{"\[(\S+) ([^\]]*)\]" == "break"\} break$/;

  const _SUBST_INDEX = {
    "%#": 0, "%b": 1, "%f": 2, "%h": 3, "%k": 4, "%s": 5, "%t": 6, "%w": 7, "%x": 8, "%y": 9,
    "%A": 10, "%E": 11, "%K": 12, "%N": 13, "%W": 14, "%T": 15, "%X": 16, "%Y": 17, "%D": 18,
  };

  // Tcl (not Tk) commands: they keep working after the root window is destroyed,
  // because only Tk is deleted, not the interpreter (Variable.__del__ uses them).
  const _TCL_COMMANDS = new Set([`info`, `set`, `unset`, `trace`, `after`, `return`]);

  const _EMPTY_BINDINGS = new Map();

  const _MSGBOX_TYPES = {
    abortretryignore: [`abort`, `retry`, `ignore`],
    ok: [`ok`],
    okcancel: [`ok`, `cancel`],
    retrycancel: [`retry`, `cancel`],
    yesno: [`yes`, `no`],
    yesnocancel: [`yes`, `no`, `cancel`],
  };

  const _GEOMETRY = /^=?(?:(\d+)x(\d+))?(?:([+-])(-?\d+)([+-])(-?\d+))?$/;

  function now() {
    return Date.now() / 1000;
  }

  const OIDS = new WeakMap();
  let _oid_counter = 0;
  function oid(obj) {
    let value = OIDS.get(obj);
    if (value === undefined) {
      _oid_counter += 1;
      value = _oid_counter;
      OIDS.set(obj, value);
    }
    return value;
  }

  function string_hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function deep_equal(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== `object` || typeof b !== `object`) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deep_equal(v, b[i]));
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deep_equal(a[k], b[k]))
    );
  }

  function strip_angles(name) {
    return String(name).replace(/^[<>]+|[<>]+$/g, ``);
  }

  function has_own(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  // ---- host interfaces ---------------------------------------------------------------------

  /* The page/driver hooks. The Skulpt layer overwrites send/wait_events/sleep
     and supplies fs/apply_uploads through the hooks object. */
  const ui = {
    screen_size: () => [1920, 1080],
    send: (json) => {},
    wait_events: (timeout) => null,
    sleep: (ms) => {},
  };

  const hooks = {
    fs: {
      program_dir: `/`,
      program_files: [],
      sep: `/`,
      walk: function* () {},
      relpath: () => `.`,
      size: () => 0,
      is_dir: () => false,
      join: (...parts) =>
        parts
          .filter((p) => p !== `` && p !== undefined && p !== null)
          .join(`/`)
          .replace(/\/{2,}/g, `/`),
      normpath: (p) => String(p).replace(/\/{2,}/g, `/`) || `/`,
      basename: (p) => String(p).split(`/`).pop(),
      makedirs: () => {},
      write: () => {},
      fetch_url: () => null,
    },
    apply_uploads: (uploads, root) => {},
  };

  // ---- suspension interface -----------------------------------------------------------------

  /* Sync default: nothing ever suspends, chain() just runs the callback.
     The Skulpt layer calls set_susp() with async implementations. */
  const susp = ns.susp;

  function set_susp(next) {
    Object.assign(susp, next);
  }

  // ---- waiters (async do_one_event phase 3) ---------------------------------------------------

  const _waiters = [];

  function wake_waiters() {
    for (const waiter of [..._waiters]) waiter.resume(true);
  }

  // =================================================================================================
  // TkApp
  // =================================================================================================

  class TkApp {
    constructor(class_name = `Tk`, interactive = false, want_objects = true) {
      _app_counter += 1;
      this.id = _app_counter;
      this.interactive = interactive;
      this.destroyed = false;
      this.want_objects = want_objects;
      this.commands = new Map();
      this.vars = {
        tk_version: `8.6`,
        tcl_version: `8.6`,
        tk_patchLevel: `8.6.13`,
        tcl_patchLevel: `8.6.13`,
        tk_strictMotif: `0`,
      };
      this.traces = {};
      this.var_links = {};
      this.widgets = new Map();
      this.bindings = new Map();
      this.timers = [];
      this.timer_scripts = new Map();
      this.idle_scripts = [];
      this.after_counter = 0;
      this.serial = 0;
      this.focus_widget = null;
      this.pending_focus = null; // focus to show on the page after the next render
      this.grab_widget = null;
      this.fonts = new FontRegistry();
      this.images = new ImageRegistry(this);
      this.classes = new events.ClassBindings(this);
      this.layout_dirty = true;
      this.render_dirty = true;
      this.sent = new Map();
      this.sent_windows = new Map();
      this.event_queue = [];
      this.current_event = null;
      this.clipboard = ``;
      this.msgbox_counter = 0;
      this.msgbox_results = {};
      this._modal_grabs = new Map();
      this._msgbox_waiters = new Map();
      this._uid = 0;
      this.screen = ui.screen_size().slice(0, 2);
      this.ttk = new StyleDB(this);
      const root = new Toplevel(this, `.`, null);
      root.tk_class = class_name;
      root.options[`class`] = class_name;
      this.widgets.set(`.`, root);
      APPS.push(this);
    }

    // ---- helpers ---------------------------------------------------------------------------

    widget(path) {
      path = to_str(path);
      const w = this.widgets.get(path);
      if (w === undefined) throw new TclError(`bad window path name "${path}"`);
      return w;
    }

    next_serial() {
      this.serial += 1;
      return this.serial;
    }

    schedule_layout() {
      this.layout_dirty = true;
      this.render_dirty = true;
    }

    invalidateImages() {
      /* «Живі» зображення (PIL.ImageTk.PhotoImage) могли змінитися — перемалюємо. */
      let any = false;
      for (const image of this.images.images.values()) {
        if (image.provider) any = true;
      }
      if (any) this.schedule_render();
    }

    schedule_render() {
      this.render_dirty = true;
    }

    toplevels() {
      return [...this.widgets.values()].filter((w) => w.is_toplevel);
    }

    has_windows() {
      return !this.destroyed && this.widgets.has(`.`);
    }

    // ---- the _tkinter interface --------------------------------------------------------------

    call(...args) {
      if (args.length === 1 && Array.isArray(args[0])) args = args[0];
      // Like _tkinter, a None argument ends the argument list.
      for (let i = 0; i < args.length; i += 1) {
        if (args[i] === null || args[i] === undefined) {
          args = args.slice(0, i);
          break;
        }
      }
      if (!args.length) return ``;
      const cmd = to_str(args[0]);
      const rest = args.slice(1);
      const finish = (r) => susp.chain(r, (v) => (v === null || v === undefined ? `` : v));
      if (this.commands.has(cmd)) {
        const target = this.commands.get(cmd);
        const strs = rest.map((a) => to_str(a));
        if (typeof target === `function`) return finish(target(...strs));
        return finish(this.eval_script(strs.length ? `${target} ${join_list(strs)}` : target));
      }
      if (this.destroyed && !_TCL_COMMANDS.has(cmd)) {
        throw new TclError(`can't invoke "${cmd}" command: application has been destroyed`);
      }
      if (cmd.startsWith(`.`)) {
        const widget = this.widgets.get(cmd);
        if (widget === undefined) throw new TclError(`invalid command name "${cmd}"`);
        return finish(widget.command(rest));
      }
      if (cmd in CLASSES) return finish(this._create(cmd, rest));
      const handler = this[`tcl_${cmd.replace(/::/g, `_`)}`];
      if (typeof handler !== `function`) throw new TclError(`invalid command name "${cmd}"`);
      return finish(handler.call(this, rest));
    }

    eval(script) {
      return this.eval_script(to_str(script));
    }

    createcommand(name, func) {
      this.commands.set(to_str(name), func);
    }

    deletecommand(name) {
      name = to_str(name);
      if (!this.commands.has(name)) throw new TclError(`can't delete "${name}": command doesn't exist`);
      this.commands.delete(name);
    }

    // ---- scripts ------------------------------------------------------------------------------

    eval_script(script) {
      /* Runs the Tcl scripts tkinter generates: command calls and bind lines. */
      if (typeof script === `function`) return script();
      script = to_str(script);
      let result = ``;
      const lines = script.split(`\n`);
      const step = (i) => {
        while (i < lines.length) {
          const line = lines[i].trim();
          i += 1;
          if (line === ``) continue;
          const m = line.match(_BIND_LINE);
          if (m) {
            const cmd = m[1];
            const spec = m[2];
            const tokens = spec.trim() === `` ? [] : spec.split(/\s+/);
            const values = this._substitution(tokens);
            const r = this.call(cmd, ...values);
            if (susp.is_suspension(r)) {
              return susp.chain(r, (v) => {
                result = v;
                if (to_str(v) === `break`) return `break`;
                return step(i);
              });
            }
            result = r;
            if (to_str(r) === `break`) return `break`;
            continue;
          }
          const words = split_list(line);
          if (words.length && words[0] === `break`) return `break`;
          const r = this.call(...words);
          if (susp.is_suspension(r)) {
            return susp.chain(r, (v) => {
              result = v;
              return step(i);
            });
          }
          result = r;
        }
        return result;
      };
      return step(0);
    }

    _substitution(tokens) {
      if (this.current_event === null) return tokens.map(() => `??`);
      const [event, path] = this.current_event;
      const values = events.substitute(this, event, path);
      return tokens.map((t) => (has_own(_SUBST_INDEX, t) ? values[_SUBST_INDEX[t]] : t));
    }

    background_error(exc) {
      const name = exc && exc.name ? exc.name : `Error`;
      const message = exc && exc.message !== undefined ? exc.message : String(exc);
      console.error(`Exception in Tkinter callback\n${name}: ${message}`);
    }

    _sink(r) {
      // Drops a value Python ignores, but keeps the chain alive so that
      // post-resume errors still reach background_error().
      if (susp.is_suspension(r)) {
        susp.chain(r, (v) => v, (e) => {
          this.background_error(e);
        });
      }
      return undefined;
    }

    // ---- variables ------------------------------------------------------------------------------

    var_exists(name) {
      return has_own(this.vars, to_str(name));
    }

    getvar(name) {
      name = to_str(name);
      if (!has_own(this.vars, name)) throw new TclError(`can't read "${name}": no such variable`);
      const r = this._fire_traces(name, `read`);
      return susp.is_suspension(r) ? susp.chain(r, () => this.vars[name]) : this.vars[name];
    }

    getvar_default(name, default_) {
      name = to_str(name);
      return has_own(this.vars, name) ? this.vars[name] : default_;
    }

    setvar(name, value, source = null) {
      name = to_str(name);
      this.vars[name] = value;
      const fire = this._fire_traces(name, `write`);
      const rest = () => {
        const links = this.var_links[name];
        if (links) {
          for (const widget of [...links]) {
            if (widget !== source && !widget.destroyed) widget.variable_changed(name);
          }
        }
        this.schedule_render();
        return value;
      };
      return susp.is_suspension(fire) ? susp.chain(fire, rest) : rest();
    }

    unsetvar(name) {
      name = to_str(name);
      if (!has_own(this.vars, name)) throw new TclError(`can't unset "${name}": no such variable`);
      delete this.vars[name];
      const r = this._fire_traces(name, `unset`);
      const rest = () => {
        delete this.traces[name];
        return undefined;
      };
      return susp.is_suspension(r) ? susp.chain(r, rest) : rest();
    }

    globalgetvar(name) {
      return this.getvar(name);
    }

    globalsetvar(name, value) {
      return this.setvar(name, value);
    }

    globalunsetvar(name) {
      return this.unsetvar(name);
    }

    _fire_traces(name, op) {
      const old_style = op === `read` ? `r` : op === `write` ? `w` : `u`;
      const entries = [...(this.traces[name] ?? [])];
      const step = (i) => {
        while (i < entries.length) {
          const [ops, command, legacy] = entries[i];
          i += 1;
          if (!ops.includes(op)) continue;
          const words = [...split_list(command), name, ``, legacy ? old_style : op];
          const r = this.call(...words);
          if (susp.is_suspension(r)) return susp.chain(r, () => step(i));
        }
        return undefined;
      };
      return step(0);
    }

    link_variable(widget, name, text = true) {
      this.unlink_widget(widget);
      if (name) {
        const key = to_str(name);
        if (!this.var_links[key]) this.var_links[key] = new Set();
        this.var_links[key].add(widget);
      }
    }

    link_variable_extra(widget, name) {
      /* Adds a variable link without dropping the widget's other links (menus). */
      if (name) {
        const key = to_str(name);
        if (!this.var_links[key]) this.var_links[key] = new Set();
        this.var_links[key].add(widget);
      }
    }

    unlink_widget(widget) {
      for (const linked of Object.values(this.var_links)) linked.delete(widget);
    }

    is_linked(widget, name) {
      const linked = this.var_links[to_str(name)];
      return linked ? linked.has(widget) : false;
    }

    tcl_trace(args) {
      if (args.length < 2) throw new TclError(`wrong # args: should be "trace option ?arg ...?"`);
      const sub = to_str(args[0]);
      if (sub === `add` || sub === `remove`) {
        if (to_str(args[1]) !== `variable`) {
          throw new TclError(`bad option "${to_str(args[1])}": must be command, execution, or variable`);
        }
        const name = to_str(args[2]);
        const ops = split_list(args[3]).map((o) => (to_str(o) === `array` ? `unset` : to_str(o)));
        const command = to_str(args[4]);
        if (!this.traces[name]) this.traces[name] = [];
        const entries = this.traces[name];
        if (sub === `add`) {
          entries.unshift([ops, command, false]);
        } else {
          const sorted_ops = [...ops].sort().join(`,`);
          const idx = entries.findIndex(
            (e) => e[1] === command && [...e[0]].sort().join(`,`) === sorted_ops,
          );
          if (idx !== -1) entries.splice(idx, 1);
        }
        return ``;
      }
      if (sub === `info`) {
        const name = to_str(args[2]);
        return (this.traces[name] ?? []).filter((e) => !e[2]).map((e) => [e[0], e[1]]);
      }
      if (sub === `variable` || sub === `vdelete` || sub === `vinfo`) {
        const name = to_str(args[1]);
        const mapping = { r: `read`, w: `write`, u: `unset` };
        if (sub === `variable`) {
          const ops = [...to_str(args[2])].filter((c) => has_own(mapping, c)).map((c) => mapping[c]);
          if (!this.traces[name]) this.traces[name] = [];
          this.traces[name].unshift([ops, to_str(args[3]), true]);
          return ``;
        }
        if (sub === `vdelete`) {
          const command = to_str(args[3]);
          this.traces[name] = (this.traces[name] ?? []).filter((t) => t[1] !== command);
          return ``;
        }
        return (this.traces[name] ?? []).filter((e) => e[2]).map((e) => [e[0].join(``), e[1]]);
      }
      throw new TclError(`bad option "${sub}": must be add, info, remove, variable, vdelete, or vinfo`);
    }

    tcl_unset(args) {
      const names = args.map((a) => to_str(a));
      const quiet = names.length > 0 && names[0] === `-nocomplain`;
      for (const name of quiet ? names.slice(1) : names) {
        if (has_own(this.vars, name) || !quiet) this.unsetvar(name);
      }
      return ``;
    }

    tcl_set(args) {
      if (args.length === 1) return this.getvar(args[0]);
      return this.setvar(args[0], args[1]);
    }

    // ---- conversions ----------------------------------------------------------------------------

    getint(value) {
      return get_int(value);
    }

    getdouble(value) {
      return get_double(value);
    }

    getboolean(value) {
      return get_boolean(value);
    }

    splitlist(value) {
      return split_list(value);
    }

    split(value) {
      return split_list(value);
    }

    wantobjects(...rest) {
      if (rest.length) {
        this.want_objects = Boolean(rest[0]);
        return null;
      }
      return this.want_objects ? 1 : 0;
    }

    exprstring(expr) {
      throw new TclError(`expressions are not supported`);
    }

    exprlong(expr) {
      throw new TclError(`expressions are not supported`);
    }

    exprdouble(expr) {
      throw new TclError(`expressions are not supported`);
    }

    exprboolean(expr) {
      throw new TclError(`expressions are not supported`);
    }

    interpaddr() {
      return oid(this);
    }

    loadtk() {
      return null;
    }

    willdispatch() {
      return null;
    }

    settrace(func) {
      return null;
    }

    gettrace() {
      return null;
    }

    record(script) {
      return this.eval(script);
    }

    adderrorinfo(msg) {
      return null;
    }

    createfilehandler(...rest) {
      throw new TclError(`file handlers are not supported in the browser`);
    }

    deletefilehandler(...rest) {
      throw new TclError(`file handlers are not supported in the browser`);
    }

    // ---- widget creation -------------------------------------------------------------------------

    _create(kind, args, ignore_unknown = false) {
      if (!args.length) {
        throw new TclError(`wrong # args: should be "${kind} pathName ?-option value ...?"`);
      }
      const path = to_str(args[0]);
      if (this.widgets.has(path)) {
        throw new TclError(`window name "${path.slice(path.lastIndexOf(`.`) + 1)}" already exists in parent`);
      }
      const dot = path.lastIndexOf(`.`);
      const parent_path = (dot === -1 ? path : path.slice(0, dot)) || `.`;
      const parent = this.widgets.get(parent_path);
      if (parent === undefined) throw new TclError(`bad window path name "${parent_path}"`);
      const widget = new CLASSES[kind](this, path, parent);
      this.widgets.set(path, widget);
      let option_args = args.slice(1);
      // ttk:: widgets use ttk option names (-style, -padding, ...) that the
      // plain Tk option tables do not know: drop the unknown pairs.
      if (ignore_unknown || kind.startsWith(`ttk::`)) {
        const filtered = [];
        for (let i = 0; i + 1 < option_args.length; i += 2) {
          try {
            widget._canonical(to_str(option_args[i]));
          } catch (e) {
            continue;
          }
          filtered.push(option_args[i], option_args[i + 1]);
        }
        option_args = filtered;
      }
      try {
        widget.configure(option_args, true);
        widget.created();
      } catch (e) {
        this.destroy_widget(widget);
        throw e;
      }
      if (widget.is_toplevel) widget.wm[`title`] = path.slice(path.lastIndexOf(`.`) + 1);
      this.schedule_layout();
      return path;
    }

    tcl_frame(args) {
      return this._create(`frame`, args);
    }

    tcl_toplevel(args) {
      return this._create(`toplevel`, args);
    }

    tcl_label(args) {
      return this._create(`label`, args);
    }

    tcl_button(args) {
      return this._create(`button`, args);
    }

    tcl_checkbutton(args) {
      return this._create(`checkbutton`, args);
    }

    tcl_radiobutton(args) {
      return this._create(`radiobutton`, args);
    }

    tcl_entry(args) {
      return this._create(`entry`, args);
    }

    // ---- destroy ---------------------------------------------------------------------------------

    tcl_destroy(args) {
      for (const path of args) {
        const widget = this.widgets.get(to_str(path));
        if (widget !== undefined) this.destroy_widget(widget);
      }
      return ``;
    }

    destroy_widget(widget) {
      if (widget.destroyed) return;
      for (const child of [...widget.children]) this.destroy_widget(child);
      if (this._has_binding_for(widget, 17)) this._sink(this.dispatch(widget, { type: 17 }));
      widget.destroyed = true;
      widget.on_destroy();
      this.classes.forget(widget);
      this.unmanage(widget);
      for (const slave of [...widget.pack_slaves, ...widget.grid_slaves, ...widget.place_slaves]) {
        slave.manager = null;
        slave.mapped = false;
      }
      if (widget.parent !== null && widget.parent !== undefined) {
        const at = widget.parent.children.indexOf(widget);
        if (at !== -1) widget.parent.children.splice(at, 1);
      }
      this.widgets.delete(widget.path);
      this.bindings.delete(widget.path);
      if (this.focus_widget === widget) this.focus_widget = null;
      if (widget.path === `.`) {
        for (const top of this.toplevels()) this.destroy_widget(top);
        this.destroyed = true;
        this.flush();
        const at = APPS.indexOf(this);
        if (at !== -1) APPS.splice(at, 1);
      }
      this.schedule_layout();
    }

    unmanage(widget, keep = null) {
      /* Removes the widget from its current geometry manager. */
      const notebook = widget.notebook ?? null;
      if (widget.manager === `notebook` && notebook !== null && !notebook.destroyed) {
        notebook.forget_slave(widget);
      }
      const paned = widget.paned ?? null;
      if (widget.manager === `panedwindow` && paned !== null && !paned.destroyed) {
        paned.forget_slave(widget);
      }
      if (widget.manager === `canvas` && widget.canvas_owner && !widget.canvas_owner.destroyed) {
        widget.canvas_owner.forget_window(widget);
      }
      for (const manager of [`pack`, `grid`, `place`]) {
        if (manager === keep) continue;
        const info = widget[manager];
        if (info) {
          const container = info[`in`] || widget.parent;
          const slaves = container[`${manager}_slaves`];
          const at = slaves.indexOf(widget);
          if (at !== -1) slaves.splice(at, 1);
          widget[manager] = null;
        }
      }
      if (keep === null) widget.manager = null;
      widget.mapped = false;
      this.schedule_layout();
    }

    // ---- geometry managers ---------------------------------------------------------------------

    _manager_command(manager, args, subcommands) {
      if (!args.length) {
        throw new TclError(`wrong # args: should be "${manager} option arg ?arg ...?"`);
      }
      const first = to_str(args[0]);
      if (first.startsWith(`.`)) return this._manage(manager, args);
      if (first === `configure`) return this._manage(manager, args.slice(1));
      const handler = subcommands[first];
      if (handler === undefined) {
        const names = [`configure`, ...Object.keys(subcommands)].sort().join(`, `);
        throw new TclError(`bad option "${first}": must be ${names}`);
      }
      return handler(args.slice(1));
    }

    _manage(manager, args) {
      const widgets = [];
      let i = 0;
      while (i < args.length && to_str(args[i]).startsWith(`.`)) {
        widgets.push(this.widget(args[i]));
        i += 1;
      }
      const options = args.slice(i);
      for (const w of widgets) {
        if (w.is_toplevel) throw new TclError(`can't manage "${w.path}": it's a top-level window`);
      }
      const fn = {
        pack: geometry.pack_configure,
        grid: geometry.grid_configure,
        place: geometry.place_configure,
      }[manager];
      fn(this, widgets, options);
      return ``;
    }

    _forget(manager, args) {
      for (const path of args) {
        const widget = this.widget(path);
        if (widget.manager === manager) this.unmanage(widget);
      }
      return ``;
    }

    _propagate(manager, args) {
      const widget = this.widget(args[0]);
      if (args.length === 1) return widget.propagate[manager] ? 1 : 0;
      widget.propagate[manager] = get_boolean(args[1]);
      this.schedule_layout();
      return ``;
    }

    tcl_pack(args) {
      return this._manager_command(`pack`, args, {
        forget: (a) => this._forget(`pack`, a),
        info: (a) => geometry.pack_info(this.widget(a[0])),
        propagate: (a) => this._propagate(`pack`, a),
        slaves: (a) => this.widget(a[0]).pack_slaves.map((w) => w.path),
        content: (a) => this.widget(a[0]).pack_slaves.map((w) => w.path),
      });
    }

    tcl_grid(args) {
      const slaves = (a) => {
        const container = this.widget(a[0]);
        let result = [...container.grid_slaves];
        const opts = {};
        for (let i = 1; i + 1 < a.length; i += 2) opts[to_str(a[i])] = a[i + 1];
        if (opts[`-row`] !== undefined) {
          const r = get_int(opts[`-row`]);
          result = result.filter((w) => w.grid.row <= r && r < w.grid.row + w.grid.rowspan);
        }
        if (opts[`-column`] !== undefined) {
          const c = get_int(opts[`-column`]);
          result = result.filter((w) => w.grid.column <= c && c < w.grid.column + w.grid.columnspan);
        }
        return result.reverse().map((w) => w.path);
      };
      const slot = (axis) => (a) =>
        geometry.grid_slot_configure(this, this.widget(a[0]), axis, a[1], a.slice(2));
      const bbox = (a) => {
        this.flush();
        const container = this.widget(a[0]);
        return [0, 0, container.width, container.height];
      };
      return this._manager_command(`grid`, args, {
        forget: (a) => this._forget(`grid`, a),
        remove: (a) => this._forget(`grid`, a),
        info: (a) => geometry.grid_info(this.widget(a[0])),
        propagate: (a) => this._propagate(`grid`, a),
        slaves: slaves,
        content: slaves,
        size: (a) => geometry.grid_size(this.widget(a[0])),
        bbox: bbox,
        columnconfigure: slot(`column`),
        rowconfigure: slot(`row`),
        anchor: (a) => `nw`,
        location: (a) => [0, 0],
      });
    }

    tcl_place(args) {
      return this._manager_command(`place`, args, {
        forget: (a) => this._forget(`place`, a),
        info: (a) => geometry.place_info(this.widget(a[0])),
        slaves: (a) => this.widget(a[0]).place_slaves.map((w) => w.path),
        content: (a) => this.widget(a[0]).place_slaves.map((w) => w.path),
      });
    }

    // ---- bindings --------------------------------------------------------------------------------

    _canonical_sequence(patterns) {
      const parts = [];
      for (const p of patterns) {
        if (p.type === `virtual`) {
          parts.push(`<<${strip_angles(p.detail)}>>`);
          continue;
        }
        const mods = [];
        if (p.mods & events.CONTROL) mods.push(`Control`);
        if (p.mods & events.SHIFT) mods.push(`Shift`);
        if (p.mods & events.LOCK) mods.push(`Lock`);
        if (p.mods & events.ALT) mods.push(`Alt`);
        if (p.mods & 0x100) mods.push(`B1`);
        if (p.mods & 0x200) mods.push(`B2`);
        if (p.mods & 0x400) mods.push(`B3`);
        const counts = { 2: `Double`, 3: `Triple`, 4: `Quadruple` };
        if (has_own(counts, p.count)) mods.push(counts[p.count]);
        let name = has_own(events.CANONICAL, p.type) ? events.CANONICAL[p.type] : String(p.type);
        if (p.type === 4) name = `Button`;
        else if (p.type === 2) name = `Key`;
        const body = [...mods, name, ...(p.detail !== null && p.detail !== undefined ? [p.detail] : [])].join(`-`);
        parts.push(`<${body}>`);
      }
      return parts.join(``);
    }

    tcl_bind(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "bind window ?pattern? ?command?"`);
      const tag = to_str(args[0]);
      if (tag.startsWith(`.`) && !this.widgets.has(tag)) {
        throw new TclError(`bad window path name "${tag}"`);
      }
      if (!this.bindings.has(tag)) this.bindings.set(tag, new Map());
      const table = this.bindings.get(tag);
      if (args.length === 1) return [...table.keys()];
      const patterns = events.parse_sequence(to_str(args[1]));
      const key = this._canonical_sequence(patterns);
      if (args.length === 2) {
        const entry = table.get(key);
        return entry ? entry.script : ``;
      }
      const script = to_str(args[2]);
      if (script === ``) {
        table.delete(key);
      } else if (script.startsWith(`+`) && table.has(key)) {
        const entry = table.get(key);
        entry.script = `${entry.script}\n${script.slice(1)}`;
      } else {
        table.set(key, { script: script.replace(/^\++/, ``), patterns: patterns });
      }
      this.schedule_render();
      return ``;
    }

    tcl_bindtags(args) {
      const widget = this.widget(args[0]);
      if (args.length === 1) return widget.get_bindtags();
      const tags = split_list(args[1]);
      widget.bindtags = tags.length ? tags : null;
      return ``;
    }

    _has_binding_for(widget, etype) {
      for (const tag of widget.get_bindtags()) {
        const table = this.bindings.get(tag);
        if (!table) continue;
        for (const entry of table.values()) {
          if (entry.patterns[entry.patterns.length - 1].type === etype) return true;
        }
      }
      return false;
    }

    wants_motion(widget) {
      return this._has_binding_for(widget, 6);
    }

    dispatch(widget, event) {
      /* Delivers an event through the widget's bindtags (Tk_BindEvent). */
      const previous = this.current_event;
      this.current_event = [event, widget.path];
      const restore = () => {
        this.current_event = previous;
      };
      const tags = widget.get_bindtags();
      const item_tables = typeof widget.item_bindings === `function` ? widget.item_bindings(event) : [];

      const run_tags = (i) => {
        while (i < tags.length) {
          const tag = tags[i];
          i += 1;
          const table = this.bindings.get(tag) ?? _EMPTY_BINDINGS;
          const entry = events.best_binding(table, event);
          let result = null;
          if (entry !== null) {
            result = this.eval_script(entry.script);
            if (susp.is_suspension(result)) {
              const captured = i;
              return susp.chain(
                result,
                (v) => {
                  if (to_str(v) === `break` || widget.destroyed) {
                    restore();
                    return undefined;
                  }
                  return run_tags(captured);
                },
                (e) => {
                  restore();
                  throw e;
                },
              );
            }
          } else if (tag === widget.tk_class) {
            result = this.classes.handle(widget, event);
            if (susp.is_suspension(result)) {
              const captured = i;
              return susp.chain(
                result,
                (v) => {
                  if (to_str(v) === `break` || widget.destroyed) {
                    restore();
                    return undefined;
                  }
                  return run_tags(captured);
                },
                (e) => {
                  restore();
                  throw e;
                },
              );
            }
          }
          if (to_str(result) === `break` || widget.destroyed) {
            restore();
            return undefined;
          }
        }
        restore();
        return undefined;
      };

      const run_items = (i) => {
        while (i < item_tables.length) {
          const entry = events.best_binding(item_tables[i], event);
          if (entry !== null) {
            const result = this.eval_script(entry.script);
            if (susp.is_suspension(result)) {
              const captured = i;
              return susp.chain(
                result,
                (v) => {
                  if (to_str(v) === `break`) return after_items();
                  if (widget.destroyed) {
                    restore();
                    return undefined;
                  }
                  return run_items(captured + 1);
                },
                (e) => {
                  restore();
                  throw e;
                },
              );
            }
            if (to_str(result) === `break`) return after_items();
          }
          if (widget.destroyed) {
            restore();
            return undefined;
          }
          i += 1;
        }
        return after_items();
      };

      const after_items = () => {
        if (event.itemonly) {
          restore();
          return undefined;
        }
        return run_tags(0);
      };

      return run_items(0);
    }

    // ---- focus -------------------------------------------------------------------------------------

    set_focus(widget, from_page = false) {
      if (widget === this.focus_widget) return undefined;
      const old = this.focus_widget;
      this.focus_widget = widget;
      const finish = () => {
        if (widget === null || widget === undefined) return undefined;
        const r = this.dispatch(widget, { type: 9, focus: true });
        const done = () => {
          if (!from_page) {
            // The widget may not be on the page yet: focus after rendering.
            this.pending_focus = widget;
            this.schedule_render();
          }
          return undefined;
        };
        return susp.is_suspension(r) ? susp.chain(r, done) : done();
      };
      if (old !== null && old !== undefined && !old.destroyed) {
        const r = this.dispatch(old, { type: 10, focus: false });
        return susp.is_suspension(r) ? susp.chain(r, finish) : finish();
      }
      return finish();
    }

    tcl_focus(args) {
      const strs = args.map((a) => to_str(a));
      if (!strs.length) return this.focus_widget ? this.focus_widget.path : ``;
      if (strs[0] === `-displayof`) return this.focus_widget ? this.focus_widget.path : ``;
      if (strs[0] === `-lastfor`) {
        const w = this.widget(strs[1]);
        const f = this.focus_widget;
        return f !== null && f.toplevel === w.toplevel ? f.path : w.toplevel.path;
      }
      let rest = strs;
      if (rest[0] === `-force`) rest = rest.slice(1);
      if (rest.length && rest[0]) this.set_focus(this.widget(rest[0]));
      return ``;
    }

    _focus_chain(start, forward) {
      const order = [];
      const walk = (w) => {
        if (w.mapped || w.is_toplevel) {
          order.push(w);
          for (const c of w.children) if (!c.is_toplevel) walk(c);
        }
      };
      walk(start.toplevel);
      const candidates = order.filter(
        (w) =>
          [`Entry`, `Button`, `Checkbutton`, `Radiobutton`].includes(w.tk_class) &&
          w.options.state !== `disabled` &&
          to_str(w.options.takefocus ?? ``) !== `0`,
      );
      if (!candidates.length) return start.path;
      let i;
      if (candidates.includes(start)) i = candidates.indexOf(start) + (forward ? 1 : -1);
      else i = forward ? 0 : -1;
      const n = candidates.length;
      return candidates[((i % n) + n) % n].path;
    }

    tcl_tk_focusNext(args) {
      return this._focus_chain(this.widget(args[0]), true);
    }

    tcl_tk_focusPrev(args) {
      return this._focus_chain(this.widget(args[0]), false);
    }

    // ---- after / update / event loop ---------------------------------------------------------------

    tcl_after(args) {
      if (!args.length) throw new TclError(`wrong # args: should be "after option ?arg ...?"`);
      const first = to_str(args[0]);
      if (first === `cancel`) {
        const target = args.length === 2 ? to_str(args[1]) : join_list(args.slice(1));
        if (this.timer_scripts.has(target)) {
          this.timer_scripts.delete(target);
        } else {
          for (const [after_id, script] of [...this.timer_scripts]) {
            if (script === target) {
              this.timer_scripts.delete(after_id);
              break;
            }
          }
          this.idle_scripts = this.idle_scripts.filter(([i, s]) => i !== target && s !== target);
        }
        return ``;
      }
      if (first === `idle`) {
        if (args.length < 2) throw new TclError(`wrong # args: should be "after option ?arg ...?"`);
        this.after_counter += 1;
        const after_id = `after#${this.after_counter}`;
        const script = args.length > 2 ? join_list(args.slice(1)) : to_str(args[1]);
        this.idle_scripts.push([after_id, script]);
        return after_id;
      }
      if (first === `info`) {
        if (args.length === 1) return [...this.timer_scripts.keys(), ...this.idle_scripts.map(([i]) => i)];
        const after_id = to_str(args[1]);
        if (this.timer_scripts.has(after_id)) return [this.timer_scripts.get(after_id), `timer`];
        for (const [i, s] of this.idle_scripts) if (i === after_id) return [s, `idle`];
        throw new TclError(`event "${after_id}" doesn't exist`);
      }
      let ms;
      try {
        ms = get_int(first);
      } catch (e) {
        if (e instanceof TclError) {
          throw new TclError(`bad argument "${first}": must be cancel, idle, info, or an integer`);
        }
        throw e;
      }
      if (args.length === 1) {
        const wait_ms = Math.max(ms, 0);
        if (susp.is_sync) {
          ui.sleep(wait_ms);
          return ``;
        }
        return susp.suspend((resume) => {
          setTimeout(resume, wait_ms);
        });
      }
      const script = args.length === 2 ? to_str(args[1]) : join_list(args.slice(1));
      this.after_counter += 1;
      const after_id = `after#${this.after_counter}`;
      const due = now() + Math.max(ms, 0) / 1000;
      this.timers.push({ due: due, seq: this.after_counter, id: after_id });
      this.timers.sort((a, b) => a.due - b.due || a.seq - b.seq);
      this.timer_scripts.set(after_id, script);
      return after_id;
    }

    next_timer_delay() {
      /* Seconds until the next timer, or null when there is none. */
      while (this.timers.length && !this.timer_scripts.has(this.timers[0].id)) this.timers.shift();
      if (!this.timers.length) return null;
      return Math.max(0, this.timers[0].due - now());
    }

    run_due_timers() {
      let ran = false;
      const snapshot = now();
      const step = () => {
        while (this.timers.length && this.timers[0].due <= snapshot) {
          const t = this.timers.shift();
          const script = this.timer_scripts.get(t.id);
          if (script === undefined) continue;
          this.timer_scripts.delete(t.id);
          ran = true;
          const r = this._run_background(script);
          if (susp.is_suspension(r)) {
            return susp.chain(r, () => {
              if (this.destroyed) return ran;
              return step();
            });
          }
          if (this.destroyed) break;
        }
        return ran;
      };
      return step();
    }

    run_idle() {
      if (!this.idle_scripts.length) return false;
      const scripts = this.idle_scripts;
      this.idle_scripts = [];
      const step = (i) => {
        while (i < scripts.length) {
          const r = this._run_background(scripts[i][1]);
          if (susp.is_suspension(r)) return susp.chain(r, () => step(i + 1));
          i += 1;
        }
        return true;
      };
      return step(0);
    }

    _run_background(script, extra = null) {
      let target = script;
      if (extra !== null && extra !== undefined) {
        target = typeof script === `function` ? script : `${to_str(script)} ${join_list(Array.isArray(extra) ? extra : [extra])}`;
      }
      let r;
      try {
        r = typeof target === `function` ? target() : this.eval_script(target);
      } catch (e) {
        if (e instanceof TclError) {
          this.background_error(e);
          return ``;
        }
        throw e;
      }
      if (susp.is_suspension(r)) {
        return susp.chain(
          r,
          (v) => v,
          (e) => {
            if (e instanceof TclError) {
              this.background_error(e);
              return ``;
            }
            throw e;
          },
        );
      }
      return r;
    }

    process_event() {
      if (!this.event_queue.length) return false;
      const page_event = this.event_queue.shift();
      const ok = () => true;
      const err = (e) => {
        if (e instanceof TclError) {
          this.background_error(e);
          return true;
        }
        throw e;
      };
      let r;
      try {
        r = this.handle_page_event(page_event);
      } catch (e) {
        return err(e);
      }
      if (susp.is_suspension(r)) return susp.chain(r, ok, err);
      return true;
    }

    do_one_event(block = true) {
      /* One step of the Tk event loop (Tcl_DoOneEvent).

         Like Tk, the loop serves every application (each tkinter.Tk()), not
         only the one it was called on: matplotlib opens a Tk() per figure. */
      const apps = [this, ...APPS.filter((a) => a !== this)];
      const steps = [`process_event`, `run_due_timers`, `run_idle`];
      const phase1 = (k) => {
        const total = steps.length * apps.length;
        while (k < total) {
          const app = apps[k % apps.length];
          const stepName = steps[Math.floor(k / apps.length)];
          k += 1;
          if (app.destroyed) continue;
          const r = app[stepName]();
          if (susp.is_suspension(r)) {
            return susp.chain(r, (did) => (did ? true : phase1(k)));
          }
          if (r) return true;
        }
        return phase2();
      };
      const phase2 = () => {
        for (const app of apps) if (!app.destroyed) app.flush();
        // Layout may have queued <Configure> events: handle them before waiting.
        if (apps.some((app) => !app.destroyed && (app.event_queue.length || app.idle_scripts.length))) {
          return true;
        }
        const delays = [];
        for (const app of apps) {
          if (app.destroyed) continue;
          const d = app.next_timer_delay();
          if (d !== null) delays.push(d);
        }
        let timeout;
        if (!block) timeout = 0;
        else if (!delays.length) timeout = -1;
        else timeout = Math.floor(Math.min(...delays) * 1000) + 1;
        const run_timers = () => {
          let ran = false;
          for (const app of apps) {
            if (app.destroyed) continue;
            if (app.run_due_timers()) ran = true;
          }
          return ran;
        };
        if (susp.is_sync) {
          const raw = ui.wait_events(timeout);
          if (typeof raw === `string`) {
            deliver(raw);
            return true;
          }
          return run_timers();
        }
        // Async: no events -> queue a waiter; the host delivers events through
        // deliver(), which resumes it with true, or the timeout with false.
        if (timeout === 0) return run_timers();
        return susp.chain(
          susp.suspend((resume) => {
            const waiter = { resume: null, timer: null };
            waiter.resume = (has_event) => {
              const at = _waiters.indexOf(waiter);
              if (at !== -1) _waiters.splice(at, 1);
              if (waiter.timer !== null) {
                clearTimeout(waiter.timer);
                waiter.timer = null;
              }
              resume(has_event);
            };
            _waiters.push(waiter);
            if (timeout > 0) waiter.timer = setTimeout(() => waiter.resume(false), timeout);
          }),
          (reason) => (reason ? true : run_timers()),
        );
      };
      return phase1(0);
    }

    mainloop(threshold = 0) {
      // Runs while any application has a window, until quit() on any of
      // them (_tkinter's quitMainLoop flag is global too).
      _quit_requested = false;
      const step = () => {
        for (;;) {
          if (_quit_requested || !APPS.some((a) => a.has_windows())) {
            _quit_requested = false;
            for (const app of [...APPS]) if (!app.destroyed) app.flush();
            return undefined;
          }
          const r = this.do_one_event(true);
          if (susp.is_suspension(r)) return susp.chain(r, () => step());
        }
      };
      return step();
    }

    dooneevent(flags = 0) {
      const r = this.do_one_event(!(Number(flags) & 2));
      return susp.chain(r, (v) => (v ? 1 : 0));
    }

    quit() {
      _quit_requested = true;
      wake_waiters();
    }

    tcl_update(args) {
      if (args.length && to_str(args[0]) === `idletasks`) {
        const r = this.run_idle();
        const done = () => {
          this.flush();
          return ``;
        };
        return susp.is_suspension(r) ? susp.chain(r, done) : done();
      }
      const finish = () => {
        this.flush();
        return ``;
      };
      const step = (i) => {
        while (i < 10000) {
          const r = this.do_one_event(false);
          if (susp.is_suspension(r)) {
            return susp.chain(r, (did) => {
              if (did) return step(i + 1);
              return finish();
            });
          }
          if (!r) return finish();
          i += 1;
        }
        return finish();
      };
      return step(0);
    }

    tcl_tkwait(args) {
      if (args.length < 2) throw new TclError(`wrong # args: should be "wait option name"`);
      const kind = to_str(args[0]);
      const name = to_str(args[1]);
      if (kind === `variable`) {
        const done = [];
        this._uid += 1;
        const command = `__tkwait_${this._uid}`;
        this.commands.set(command, (...a) => {
          done.push(1);
          return ``;
        });
        if (!this.traces[name]) this.traces[name] = [];
        this.traces[name].unshift([[`write`, `unset`], command, false]);
        const cleanup = () => {
          if (this.traces[name]) {
            this.traces[name] = this.traces[name].filter((t) => t[1] !== command);
          }
          this.commands.delete(command);
        };
        const step = () => {
          while (!done.length && this.has_windows()) {
            const r = this.do_one_event(true);
            if (susp.is_suspension(r)) {
              return susp.chain(
                r,
                () => step(),
                (e) => {
                  cleanup();
                  throw e;
                },
              );
            }
          }
          cleanup();
          return ``;
        };
        return step();
      }
      if (kind === `window` || kind === `visibility`) {
        const step = () => {
          while (this.widgets.has(name) && this.has_windows()) {
            if (kind === `visibility` && this.widgets.get(name).mapped) break;
            const r = this.do_one_event(true);
            if (susp.is_suspension(r)) return susp.chain(r, () => step());
          }
          return ``;
        };
        return step();
      }
      throw new TclError(`bad option "${kind}": must be variable, visibility, or window`);
    }

    // ---- page events -------------------------------------------------------------------------------

    handle_page_event(ev) {
      const kind = ev.t;
      if (kind === `msgbox`) {
        const mid = Number(ev.mid);
        this.msgbox_results[mid] = ev.value;
        const waiter = this._msgbox_waiters.get(mid);
        if (waiter) {
          this._msgbox_waiters.delete(mid);
          waiter(ev.value);
        }
        return undefined;
      }
      if (kind === `menu`) {
        const menu = this.widgets.get(ev.menu);
        if (menu instanceof Menu && Number(ev.index) >= 0 && Number(ev.index) < menu.entries.length) {
          const entry = menu.entries[Number(ev.index)];
          let r;
          try {
            r = menu.invoke(entry);
          } catch (e) {
            if (e instanceof TclError) {
              this.background_error(e);
              return undefined;
            }
            throw e;
          }
          if (susp.is_suspension(r)) {
            return susp.chain(
              r,
              (v) => v,
              (e) => {
                if (e instanceof TclError) {
                  this.background_error(e);
                  return undefined;
                }
                throw e;
              },
            );
          }
        }
        return undefined;
      }
      if (kind === `close`) {
        const top = this.widgets.get(ev.win);
        if (top !== undefined) {
          const command = top.wm.protocols[`WM_DELETE_WINDOW`];
          if (command) return this._run_background(command);
          this.destroy_widget(top);
        }
        return undefined;
      }
      if (kind === `configure`) {
        const top = this.widgets.get(ev.win);
        if (top === undefined) return undefined;
        top.wm.position = [Number(ev.x), Number(ev.y)];
        top.x = top.wm.position[0];
        top.y = top.wm.position[1];
        if (ev.resized) {
          top.wm.geometry = [Math.max(1, Number(ev.w)), Math.max(1, Number(ev.h))];
          this.schedule_layout();
        }
        if (ev.state !== undefined) {
          top.wm.state = ev.state;
          this.schedule_layout();
        }
        return undefined;
      }
      const widget = this.widgets.get(ev.w);
      if (widget === undefined) return undefined;
      if (kind === `_virtual`) {
        return this._dispatch_virtual(widget, ev.name);
      }
      if (this.grab_widget !== null && !this.grab_widget.destroyed && kind !== `_configure`) {
        // A grab (modal dialog) blocks input to windows outside it.
        let w = widget;
        while (w !== null && w !== this.grab_widget) w = w.parent;
        if (w === null || w === undefined) return undefined;
      }
      if (kind === `_configure`) {
        return this.dispatch(widget, {
          type: 22,
          width: widget.width,
          height: widget.height,
          x: widget.x,
          y: widget.y,
        });
      }
      // Widget-specific page events (ttk scale, spinbox, combobox list).
      const custom = widget[`page_${kind}`];
      if (typeof custom === `function`) return custom.call(widget, ev);
      if (kind === `entry`) {
        if (ev.selonly && ev.value !== widget.value) return undefined; // a selection report from before the latest edit
        if (ev.value !== widget.value) widget.set_value(ev.value);
        widget.cursor = ev.cursor ?? ev.value.length;
        const sel = ev.sel;
        widget.selection = sel && sel[1] > sel[0] ? [sel[0], sel[1]] : null;
        return undefined;
      }
      if (kind === `focus`) {
        return this.set_focus(widget, true);
      }
      if (kind === `scroll`) {
        return widget.scroll(ev.args.map((w) => to_str(w)));
      }
      if (kind === `scale`) {
        if ((widget.options.state ?? ``) !== `disabled`) {
          return widget.set_value(widget.value_from_pixel(Number(ev.pos)), true);
        }
        return undefined;
      }
      if (kind === `scale_step`) {
        if ((widget.options.state ?? ``) !== `disabled`) return widget.step(Number(ev.dir));
        return undefined;
      }
      if (kind === `spin`) {
        return widget.cmd_invoke([Number(ev.dir) > 0 ? `buttonup` : `buttondown`]);
      }
      if (kind === `text`) {
        return widget.apply_page_edit(ev.value, ev.cursor ?? 0, ev.sel);
      }
      if (kind === `textsel`) {
        return widget.set_page_selection(ev.cursor ?? 0, ev.sel);
      }
      if (kind === `textview`) {
        widget.view = [Number(ev.first), Number(ev.last)];
        this.schedule_render();
        return undefined;
      }
      const state = Number(ev.s ?? 0);
      const base = {
        x: ev.x ?? 0,
        y: ev.y ?? 0,
        rootx: ev.rx ?? 0,
        rooty: ev.ry ?? 0,
        state: state,
      };
      if (ev.item !== undefined) base.item = ev.item; // canvas item under the pointer
      if (ev.offset !== undefined) base.offset = Number(ev.offset); // text position under the pointer
      if (ev.itemonly) base.itemonly = true; // canvas item <Enter>/<Leave>: item bindings only
      if (kind === `press` || kind === `release`) {
        const num = Number(ev.b ?? 1);
        const event = Object.assign({}, base, {
          type: kind === `press` ? 4 : 5,
          num: num,
          count: Number(ev.n ?? 1),
        });
        if (kind === `release`) event.state = state | (events.BUTTON_MASKS[num] ?? 0);
        return this.dispatch(widget, event);
      }
      if (kind === `motion`) return this.dispatch(widget, Object.assign({}, base, { type: 6 }));
      if (kind === `enter` || kind === `leave`) {
        return this.dispatch(widget, Object.assign({}, base, { type: kind === `enter` ? 7 : 8 }));
      }
      if (kind === `wheel`) {
        return this.dispatch(widget, Object.assign({}, base, { type: 38, delta: Number(ev.delta ?? 0) }));
      }
      if (kind === `key` || kind === `keyup`) {
        const target =
          this.focus_widget !== null &&
          this.focus_widget !== undefined &&
          this.focus_widget.toplevel === widget.toplevel
            ? this.focus_widget
            : widget;
        const event = Object.assign({}, base, {
          type: kind === `key` ? 2 : 3,
          keysym: ev.keysym ?? ``,
          char: ev.char ?? ``,
          keycode: ev.code ?? 0,
        });
        return this.dispatch(target, event);
      }
      return undefined;
    }

    // ---- layout and rendering --------------------------------------------------------------------

    layout() {
      this.layout_dirty = false;
      for (const top of this.toplevels()) {
        geometry.compute_requests(top);
        let req_w = top.req_w;
        let req_h = top.req_h;
        const has_content =
          top.pack_slaves.length > 0 ||
          top.grid_slaves.length > 0 ||
          top.place_slaves.length > 0 ||
          top.options.width > 0 ||
          top.options.height > 0;
        if (!has_content) {
          req_w = 200;
          req_h = 200; // Tk's size for an empty toplevel
        }
        const size = top.wm.geometry ?? [req_w, req_h];
        let width = size[0];
        let height = size[1];
        const min_w = top.wm.minsize[0];
        const min_h = top.wm.minsize[1];
        const max_w = top.wm.maxsize[0];
        const max_h = top.wm.maxsize[1];
        width = Math.min(Math.max(width, min_w), max_w);
        height = Math.min(Math.max(height, min_h), max_h);
        top.width = width;
        top.height = height;
        top.mapped = top.wm.state !== `withdrawn`;
        geometry.arrange(top);
      }
      // Like Tk, every window whose geometry changed gets a <Configure> event.
      for (const widget of this.widgets.values()) {
        const geom = widget.mapped ? [widget.x, widget.y, widget.width, widget.height] : null;
        if (geom !== null && !deep_equal(geom, widget.last_geometry)) {
          widget.last_geometry = geom;
          widget.geometry_changed();
          if (this._has_binding_for(widget, 22)) {
            this.event_queue.push({ t: `_configure`, w: widget.path });
          }
        }
      }
    }

    flush() {
      if (this.layout_dirty) this.layout();
      if (this.render_dirty) this.render();
    }

    post_ops(ops) {
      if (ops.length) ui.send(JSON.stringify(ops));
    }

    render() {
      this.render_dirty = false;
      const ops = [];
      const alive = new Set();
      for (const top of this.toplevels()) {
        const win = {
          op: `window`,
          app: this.id,
          id: top.path,
          title: top.wm.title,
          w: top.width,
          h: top.height,
          state: top.wm.state,
          resizable: top.wm.resizable.slice(0),
          bg: css_color(top.options.background),
          pos: top.wm.position ? top.wm.position.slice(0) : null,
          topmost: Number(top.wm.attributes[`-topmost`] ?? 0),
          alpha: Number(top.wm.attributes[`-alpha`] ?? 1),
          motion: this.wants_motion(top),
          menubar: this._menubar(top),
        };
        if (top.wm.gamepad !== undefined && top.wm.gamepad !== null) win.gamepad = top.wm.gamepad;
        if (!deep_equal(this.sent_windows.get(top.path), win)) {
          ops.push(win);
          this.sent_windows.set(top.path, win);
        }
        const items = [];
        this._collect(top, 0, 0, top.path, items);
        for (const [path, props] of items) {
          alive.add(path);
          const widget = this.widgets.get(path);
          if (widget.tk_class === `Listbox` || (widget.WANTS_MOTION ?? false)) {
            props.motion = true; // drags (selection, column resize) need motion events
          }
          const old = this.sent.get(path);
          if (old === undefined && widget.sent_full !== undefined) {
            widget.sent_full = false; // new on the page: send all canvas items
          }
          if (!deep_equal(old, props)) {
            const diff = {};
            if (old === undefined) {
              Object.assign(diff, props);
            } else {
              for (const [k, v] of Object.entries(props)) if (!deep_equal(old[k], v)) diff[k] = v;
            }
            diff.id = path;
            diff.win = top.path;
            diff.new = old === undefined;
            ops.push(Object.assign({}, diff, { op: `widget`, app: this.id }));
            this.sent.set(path, props);
          }
          for (const extra of widget.extra_ops()) {
            ops.push(Object.assign({}, extra, { app: this.id, id: path, win: top.path }));
          }
        }
      }
      for (const path of [...this.sent.keys()]) {
        if (!alive.has(path)) {
          ops.push({ op: `remove`, app: this.id, id: path });
          this.sent.delete(path);
        }
      }
      for (const path of [...this.sent_windows.keys()]) {
        if (!this.widgets.has(path)) {
          ops.push({ op: `close`, app: this.id, id: path });
          this.sent_windows.delete(path);
        }
      }
      const focus = this.pending_focus;
      this.pending_focus = null;
      if (focus !== null && focus !== undefined && !focus.destroyed) {
        ops.push({ op: `focus`, app: this.id, id: focus.path, win: focus.toplevel.path });
      }
      this.post_ops(ops);
      // Like Tk's idle redisplay, tell scrollbars about view changes.
      for (const widget of [...this.widgets.values()]) {
        if (typeof widget.notify_scroll === `function` && widget.mapped && !widget.destroyed) {
          this._sink(widget.notify_scroll());
        }
      }
    }

    _menubar(top) {
      const menu = this.widgets.get(to_str(top.options.menu ?? ``));
      if (!(menu instanceof Menu)) return null;
      const font = this.fonts.get(menu.options.font);
      return {
        menu: menu.path,
        font: font.css,
        entries: menu.describe().filter((e) => e.type !== `tearoff`),
      };
    }

    _collect(widget, base_x, base_y, win, items, clip = null) {
      // Windows embedded in a canvas (and their descendants) are clipped to the canvas's inner box.
      let canvas_box = null;
      if (widget.tk_class === `Canvas`) {
        const inset = widget.inset();
        canvas_box = [base_x + inset, base_y + inset, base_x + widget.width - inset, base_y + widget.height - inset];
      }
      for (const child of widget.children) {
        if (child.is_toplevel || !child.mapped) continue;
        const x = base_x + child.x;
        const y = base_y + child.y;
        let child_clip = clip;
        if (canvas_box && child.manager === `canvas`) {
          child_clip = clip
            ? [
                Math.max(clip[0], canvas_box[0]), Math.max(clip[1], canvas_box[1]),
                Math.min(clip[2], canvas_box[2]), Math.min(clip[3], canvas_box[3]),
              ]
            : canvas_box;
        }
        const props = child.render();
        for (const key of [`bg`, `fg`, `selectcolor`, `insertcolor`, `selectbg`, `selectfg`]) {
          if (key in props) props[key] = css_color(props[key]);
        }
        const hl = props.hl ?? 0;
        Object.assign(props, {
          x: x,
          y: y,
          w: child.width,
          h: child.height,
          parent: widget.is_toplevel ? win : widget.path,
          motion: this.wants_motion(child),
          clip: child_clip
            ? [child_clip[0] - x - hl, child_clip[1] - y - hl, child_clip[2] - x - hl, child_clip[3] - y - hl]
            : null,
        });
        items.push([child.path, props]);
        this._collect(child, x, y, win, items, child_clip);
      }
    }

    // ---- wm ------------------------------------------------------------------------------------

    tcl_wm(args) {
      if (args.length < 2) throw new TclError(`wrong # args: should be "wm option window ?arg ...?"`);
      const sub = to_str(args[0]);
      const top = this.widget(args[1]);
      if (!top.is_toplevel) throw new TclError(`window "${top.path}" isn't a top-level window`);
      const rest = args.slice(2);
      const wm = top.wm;
      if (sub === `title`) {
        if (!rest.length) return wm.title;
        wm.title = to_str(rest[0]);
      } else if (sub === `geometry`) {
        if (!rest.length) {
          this.flush();
          const pos = wm.position ?? [0, 0];
          return `${top.width}x${top.height}+${pos[0]}+${pos[1]}`;
        }
        this._set_geometry(top, to_str(rest[0]));
      } else if (sub === `resizable`) {
        if (!rest.length) return wm.resizable.slice(0);
        wm.resizable = [get_boolean(rest[0]) ? 1 : 0, get_boolean(rest[1]) ? 1 : 0];
      } else if (sub === `minsize` || sub === `maxsize`) {
        if (!rest.length) return wm[sub].slice(0);
        wm[sub] = [get_pixels(rest[0]), get_pixels(rest[1])];
        this.schedule_layout();
      } else if (sub === `protocol`) {
        if (!rest.length) return Object.keys(wm.protocols);
        if (rest.length === 1) return wm.protocols[to_str(rest[0])] ?? ``;
        const name = to_str(rest[0]);
        const command = to_str(rest[1]);
        if (command) wm.protocols[name] = command;
        else delete wm.protocols[name];
      } else if (sub === `state`) {
        if (!rest.length) return wm.state;
        const state = to_str(rest[0]);
        if (![`normal`, `iconic`, `withdrawn`, `zoomed`].includes(state)) {
          throw new TclError(`bad argument "${state}": must be normal, iconic, withdrawn, or zoomed`);
        }
        wm.state = state;
        this.schedule_layout();
      } else if (sub === `iconify` || sub === `deiconify` || sub === `withdraw`) {
        wm.state = { iconify: `iconic`, deiconify: `normal`, withdraw: `withdrawn` }[sub];
        this.schedule_layout();
      } else if (sub === `attributes`) {
        const attrs = wm.attributes;
        if (!rest.length) {
          const out = [];
          for (const [k, v] of Object.entries(attrs)) out.push(k, v);
          return out;
        }
        if (rest.length === 1) return attrs[to_str(rest[0])] ?? ``;
        for (let i = 0; i + 1 < rest.length; i += 2) {
          const name = to_str(rest[i]);
          const value = rest[i + 1];
          attrs[name] =
            name === `-alpha`
              ? get_double(value)
              : name === `-transparentcolor`
                ? to_str(value)
                : get_boolean(value)
                  ? 1
                  : 0;
        }
      } else if (
        [
          `iconname`,
          `iconbitmap`,
          `iconphoto`,
          `iconmask`,
          `iconposition`,
          `iconwindow`,
          `group`,
          `command`,
          `client`,
          `colormapwindows`,
          `positionfrom`,
          `sizefrom`,
          `aspect`,
        ].includes(sub)
      ) {
        if (rest.length) wm[sub] = rest;
        else return wm[sub] ?? ``;
      } else if (sub === `transient`) {
        if (!rest.length) return wm.transient;
        wm.transient = to_str(rest[0]);
      } else if (sub === `overrideredirect`) {
        if (!rest.length) return wm.overrideredirect;
        wm.overrideredirect = get_boolean(rest[0]) ? 1 : 0;
      } else if (sub === `focusmodel`) {
        return rest.length ? `` : `passive`;
      } else if (sub === `frame`) {
        return `0x${(0x10000 + (oid(top) % 0xffff)).toString(16)}`;
      } else if (sub === `stackorder`) {
        return this.toplevels().map((t) => t.path);
      } else {
        throw new TclError(
          `bad option "${sub}": must be aspect, attributes, client, colormapwindows, ` +
            `command, deiconify, focusmodel, forget, frame, geometry, grid, group, ` +
            `iconbitmap, iconify, iconmask, iconname, iconphoto, iconposition, ` +
            `iconwindow, manage, maxsize, minsize, overrideredirect, positionfrom, ` +
            `protocol, resizable, sizefrom, stackorder, state, title, transient, or withdraw`,
        );
      }
      this.schedule_render();
      return ``;
    }

    _set_geometry(top, spec) {
      if (spec === ``) {
        top.wm.geometry = null;
        this.schedule_layout();
        return;
      }
      const m = spec.match(_GEOMETRY);
      if (!m || !m.slice(1).some((g) => g !== undefined)) {
        throw new TclError(`bad geometry specifier "${spec}"`);
      }
      const w = m[1];
      const h = m[2];
      const sx = m[3];
      const x = m[4];
      const sy = m[5];
      const y = m[6];
      if (w !== undefined) top.wm.geometry = [Number(w), Number(h)];
      if (x !== undefined) {
        let px = Number(x);
        let py = Number(y);
        if (sx === `-`) px = this.screen[0] - px - (w !== undefined ? Number(w) : top.width);
        if (sy === `-`) py = this.screen[1] - py - (h !== undefined ? Number(h) : top.height);
        top.wm.position = [px, py];
        top.x = px;
        top.y = py;
      }
      this.schedule_layout();
    }

    // ---- winfo ------------------------------------------------------------------------------

    tcl_winfo(args) {
      const sub = to_str(args[0]);
      const rest = args.slice(1).map((a) => to_str(a));
      if (rest.length && rest[0] === `-displayof`) rest.splice(0, 2);
      if (sub === `exists`) return this.widgets.has(rest[0]) ? 1 : 0;
      if (sub === `screenwidth` || sub === `vrootwidth`) return this.screen[0];
      if (sub === `screenheight` || sub === `vrootheight`) return this.screen[1];
      if (sub === `screenmmwidth`) return Math.trunc((this.screen[0] * 25.4) / 96);
      if (sub === `screenmmheight`) return Math.trunc((this.screen[1] * 25.4) / 96);
      if (sub === `screendepth` || sub === `depth`) return 24;
      if (sub === `vrootx` || sub === `vrooty`) return 0;
      if (sub === `pointerx` || sub === `pointery`) return -1;
      if (sub === `pointerxy`) return [-1, -1];
      if (sub === `interps`) return [`tk`];
      if (sub === `visual` || sub === `screenvisual`) return `truecolor`;
      if (sub === `fpixels` || sub === `pixels`) {
        const value = rest[rest.length - 1];
        return sub === `fpixels` ? Number(get_pixels(value)) : get_pixels(value);
      }
      if (sub === `rgb`) {
        const color = css_color(rest[rest.length - 1]);
        if (/^#[0-9a-fA-F]{6}$/.test(color)) {
          return [
            parseInt(color.slice(1, 3), 16) * 257,
            parseInt(color.slice(3, 5), 16) * 257,
            parseInt(color.slice(5, 7), 16) * 257,
          ];
        }
        return [0, 0, 0];
      }
      if (sub === `atom`) return string_hash(rest[rest.length - 1]) % 10000;
      if (sub === `server`) return `Windows 10.0 19045 Win32`;
      const widget = this.widget(rest[0]);
      if (sub === `children`) return widget.children.map((c) => c.path);
      if (sub === `class`) return widget.tk_class;
      if (sub === `name`) return widget.name;
      if (sub === `parent`) return widget.parent ? widget.parent.path : ``;
      if (sub === `toplevel`) return widget.toplevel.path;
      if (sub === `manager`) {
        if (widget.is_toplevel) return `wm`;
        return widget.manager ?? ``;
      }
      if (sub === `ismapped` || sub === `viewable`) {
        this.flush();
        let w = widget;
        while (w !== null && w !== undefined) {
          if (!w.mapped) return 0;
          w = w.parent;
        }
        return 1;
      }
      if (sub === `reqwidth` || sub === `reqheight`) {
        geometry.compute_requests(widget);
        return sub === `reqwidth` ? widget.req_w : widget.req_h;
      }
      if ([`width`, `height`, `x`, `y`, `geometry`, `rootx`, `rooty`].includes(sub)) {
        // Like Tk, geometry is only updated when the event loop runs.
        if (sub === `width`) return widget.width;
        if (sub === `height`) return widget.height;
        if (sub === `x`) return widget.x;
        if (sub === `y`) return widget.y;
        if (sub === `geometry`) return `${widget.width}x${widget.height}+${widget.x}+${widget.y}`;
        let x = 0;
        let y = 0;
        let w = widget;
        while (!w.is_toplevel) {
          x += w.x;
          y += w.y;
          w = w.parent;
        }
        const pos = w.wm.position ?? [0, 0];
        return sub === `rootx` ? x + pos[0] : y + pos[1];
      }
      if (sub === `id`) return oid(widget) % 0xffffff;
      if (sub === `containing`) return ``;
      if (sub === `cells`) return 256;
      throw new TclError(
        `bad option "${sub}": must be atom, atomname, cells, children, class, ` +
          `colormapfull, containing, depth, exists, fpixels, geometry, height, id, ` +
          `interps, ismapped, manager, name, parent, pathname, pixels, pointerx, ` +
          `pointerxy, pointery, reqheight, reqwidth, rgb, rootx, rooty, screen, ` +
          `screencells, screendepth, screenheight, screenmmheight, screenmmwidth, ` +
          `screenvisual, screenwidth, server, toplevel, viewable, visual, visualid, ` +
          `visualsavailable, vrootheight, vrootwidth, vrootx, vrooty, width, x, or y`,
      );
    }

    // ---- misc Tk commands ---------------------------------------------------------------------

    tcl_info(args) {
      const sub = to_str(args[0]);
      if (sub === `exists`) return this.var_exists(args[1]) ? 1 : 0;
      if (sub === `patchlevel`) return `8.6.13`;
      if (sub === `commands`) return [...this.commands.keys()];
      throw new TclError(`info ${sub} is not supported in PyThonny`);
    }

    tcl_tk(args) {
      const sub = to_str(args[0]);
      if (sub === `windowingsystem`) return `win32`;
      if (sub === `scaling`) {
        return args.length === 1 || to_str(args[1]) === `-displayof` ? 1.3333333333333333 : ``;
      }
      if (sub === `appname`) return `tk`;
      if ([`useinputmethods`, `caret`, `inactive`, `busy`, `fontchooser`, `systray`, `sysnotify`].includes(sub)) {
        return sub === `useinputmethods` || sub === `inactive` ? 0 : ``;
      }
      throw new TclError(
        `bad option "${sub}": must be appname, busy, caret, fontchooser, inactive, ` +
          `scaling, sysnotify, systray, useinputmethods, or windowingsystem`,
      );
    }

    tcl_option(args) {
      return ``;
    }

    tcl_bell(args) {
      this.post_ops([{ op: `bell`, app: this.id }]);
      return ``;
    }

    tcl_font(args) {
      return this.fonts.command(args.map((a) => to_str(a)));
    }

    tcl_image(args) {
      return this.images.command(args);
    }

    tcl_tk_popup(args) {
      const menu = this.widget(args[0]);
      if (!(menu instanceof Menu)) throw new TclError(`"${menu.path}" is not a menu`);
      menu.post(get_int(args[1]), get_int(args[2]));
      return ``;
    }

    tcl_grab(args) {
      const strs = args.map((a) => to_str(a));
      if (!strs.length) return this.grab_widget ? this.grab_widget.path : ``;
      const sub = strs[0];
      if (sub.startsWith(`.`)) {
        this.grab_widget = this.widget(sub);
      } else if (sub === `set`) {
        this.grab_widget = this.widget(strs[strs.length - 1]);
      } else if (sub === `release`) {
        this.grab_widget = null;
      } else if (sub === `current`) {
        return this.grab_widget ? this.grab_widget.path : ``;
      } else if (sub === `status`) {
        return this.grab_widget && this.grab_widget.path === strs[1] ? `local` : `none`;
      }
      return ``;
    }

    tcl_raise(args) {
      const widget = this.widget(args[0]);
      if (widget.is_toplevel) {
        this.post_ops([{ op: `raise`, app: this.id, id: widget.path }]);
      } else if (widget.parent !== null && widget.parent !== undefined) {
        const siblings = widget.parent.children;
        const at = siblings.indexOf(widget);
        if (at !== -1) siblings.splice(at, 1);
        siblings.push(widget);
        this.schedule_render();
      }
      return ``;
    }

    tcl_lower(args) {
      const widget = this.widget(args[0]);
      if (!widget.is_toplevel && widget.parent !== null && widget.parent !== undefined) {
        const siblings = widget.parent.children;
        const at = siblings.indexOf(widget);
        if (at !== -1) siblings.splice(at, 1);
        siblings.unshift(widget);
        this.schedule_render();
      }
      return ``;
    }

    tcl_clipboard(args) {
      const sub = to_str(args[0]);
      if (sub === `clear`) {
        this.clipboard = ``;
      } else if (sub === `append`) {
        this.clipboard += to_str(args[args.length - 1]);
        this.post_ops([{ op: `clipboard`, app: this.id, text: this.clipboard }]);
      } else if (sub === `get`) {
        return this.clipboard;
      }
      return ``;
    }

    tcl_event(args) {
      const sub = to_str(args[0]);
      if (sub === `generate`) {
        const widget = this.widget(args[1]);
        const patterns = events.parse_sequence(to_str(args[2]));
        const pattern = patterns[patterns.length - 1];
        const opts = {};
        for (let i = 3; i + 1 < args.length; i += 2) opts[to_str(args[i])] = args[i + 1];
        if (pattern.type === `virtual`) {
          const r = this._dispatch_virtual(widget, pattern.detail);
          return susp.chain(r, () => ``);
        }
        const event = { type: pattern.type, state: pattern.mods };
        if (pattern.type === 4 || pattern.type === 5) event.num = Number(pattern.detail || 1);
        if (pattern.type === 2 || pattern.type === 3) {
          event.keysym = pattern.detail || ``;
          event.char = pattern.detail && pattern.detail.length === 1 ? pattern.detail : ``;
        }
        for (const key of [`x`, `y`]) {
          if (opts[`-${key}`] !== undefined) event[key] = get_int(opts[`-${key}`]);
        }
        const r = this.dispatch(widget, event);
        return susp.chain(r, () => ``);
      }
      if (sub === `add` || sub === `delete`) return ``;
      if (sub === `info`) return [];
      throw new TclError(`bad option "${sub}": must be add, delete, generate, or info`);
    }

    dispatch_virtual(widget, name) {
      return this._sink(this._dispatch_virtual(widget, name));
    }

    _dispatch_virtual(widget, name) {
      const previous = this.current_event;
      this.current_event = [{ type: 35 }, widget.path];
      const restore = () => {
        this.current_event = previous;
      };
      const target = strip_angles(name);
      const entries = [];
      for (const tag of widget.get_bindtags()) {
        const table = this.bindings.get(tag);
        if (!table) continue;
        for (const entry of table.values()) {
          const p = entry.patterns[entry.patterns.length - 1];
          if (p.type === `virtual` && strip_angles(p.detail) === target) entries.push(entry);
        }
      }
      const after = (v, next) => {
        if (to_str(v) === `break`) {
          restore();
          return undefined;
        }
        return step(next);
      };
      const step = (i) => {
        while (i < entries.length) {
          const r = this.eval_script(entries[i].script);
          if (susp.is_suspension(r)) {
            const captured = i;
            return susp.chain(
              r,
              (v) => after(v, captured + 1),
              (e) => {
                restore();
                throw e;
              },
            );
          }
          i += 1;
          if (to_str(r) === `break`) {
            restore();
            return undefined;
          }
        }
        restore();
        return undefined;
      };
      return step(0);
    }

    // ---- dialogs --------------------------------------------------------------------------------

    tcl_tk_messageBox(args) {
      /* Modal Windows message box; returns the name of the pressed button. */
      if (args.length % 2) throw new TclError(`value for "${to_str(args[args.length - 1])}" missing`);
      const opts = {};
      for (let i = 0; i < args.length; i += 2) opts[to_str(args[i])] = to_str(args[i + 1]);
      for (const key of Object.keys(opts)) {
        if (![`-default`, `-detail`, `-icon`, `-message`, `-parent`, `-title`, `-type`, `-command`].includes(key)) {
          throw new TclError(
            `bad option "${key}": must be -default, -detail, -icon, -message, -parent, -title, or -type`,
          );
        }
      }
      const icon = opts[`-icon`] ?? `info`;
      if (![`error`, `info`, `question`, `warning`].includes(icon)) {
        throw new TclError(`bad -icon value "${icon}": must be error, info, question, or warning`);
      }
      const kind = opts[`-type`] ?? `ok`;
      if (!has_own(_MSGBOX_TYPES, kind)) {
        throw new TclError(
          `bad -type value "${kind}": must be abortretryignore, ok, okcancel, retrycancel, yesno, or yesnocancel`,
        );
      }
      const buttons = _MSGBOX_TYPES[kind];
      const default_ = opts[`-default`] ?? buttons[0];
      if (!buttons.includes(default_)) throw new TclError(`invalid default button "${default_}"`);
      const res = this.modal(
        {
          op: `msgbox`,
          title: opts[`-title`] ?? ``,
          message: opts[`-message`] ?? ``,
          detail: opts[`-detail`] ?? ``,
          icon: icon,
          buttons: buttons.slice(0),
          default: default_,
        },
        opts[`-parent`] ?? `.`,
      );
      return susp.chain(res, (v) => to_str(v));
    }

    modal(op, parent = `.`) {
      /* Shows a dialog drawn by the page and waits for its answer, like Tk's modal loop. */
      const p = this.widgets.get(to_str(parent)) ?? null;
      this.msgbox_counter += 1;
      const mid = this.msgbox_counter;
      this.flush();
      this.post_ops([
        Object.assign({}, op, {
          app: this.id,
          id: `msgbox${mid}`,
          mid: mid,
          parent: p ? p.toplevel.path : `.`,
        }),
      ]);
      const previous_grab = this.grab_widget;
      this._modal_grabs.set(mid, previous_grab);
      this.grab_widget = MSGBOX_GRAB;
      const cleanup = () => {
        this.grab_widget = this._modal_grabs.get(mid) ?? null;
        this._modal_grabs.delete(mid);
        this._msgbox_waiters.delete(mid);
      };
      const finish = () => {
        cleanup();
        const value = this.msgbox_results[mid];
        delete this.msgbox_results[mid];
        return value;
      };
      if (susp.is_sync) {
        // Synchronous host: block the loop like the reference implementation.
        while (!has_own(this.msgbox_results, mid)) this.do_one_event(true);
        return finish();
      }
      // Async host: never nest an event loop (two live Skulpt suspensions would
      // fight over the queue). The outer do_one_event keeps running; delivering
      // the msgbox event resolves this waiter from handle_page_event.
      if (has_own(this.msgbox_results, mid)) return finish();
      return susp.chain(
        susp.suspend((resume) => {
          this._msgbox_waiters.set(mid, resume);
        }),
        () => (has_own(this.msgbox_results, mid) ? finish() : this._await_msgbox(mid)),
        (e) => {
          cleanup();
          throw e;
        },
      );
    }

    _await_msgbox(mid) {
      /* Resumes the modal wait across do_one_event wakeups until its event lands. */
      return susp.chain(
        susp.suspend((resume) => {
          this._msgbox_waiters.set(mid, resume);
        }),
        () => (has_own(this.msgbox_results, mid) ? this._msgbox_finish(mid) : this._await_msgbox(mid)),
      );
    }

    _msgbox_finish(mid) {
      this.grab_widget = this._modal_grabs.get(mid) ?? null;
      this._modal_grabs.delete(mid);
      this._msgbox_waiters.delete(mid);
      const value = this.msgbox_results[mid];
      delete this.msgbox_results[mid];
      return value;
    }

    tcl_tk_chooseColor(args) {
      return choose_color(this, args);
    }

    tcl_tk_getOpenFile(args) {
      return file_dialog(this, `open`, args);
    }

    tcl_tk_getSaveFile(args) {
      return file_dialog(this, `save`, args);
    }

    tcl_tk_chooseDirectory(args) {
      return file_dialog(this, `dir`, args);
    }

    tcl_tk_setPalette(args) {
      return ``;
    }

    tcl_tk_bisque(args) {
      return ``;
    }

    tcl_source(args) {
      throw new TclError(`Tcl scripts are not supported in PyThonny`);
    }

    tcl_return(args) {
      // tkinter.ttk reads the theme with `return $ttk::currentTheme`.
      const value = args.length ? to_str(args[0]) : ``;
      if (value.startsWith(`$`)) return this.getvar(value.slice(1));
      return value;
    }

    // ---- ttk -------------------------------------------------------------------------------------

    tcl_ttk_style(args) {
      return this.ttk.command(args);
    }

    tcl_ttk_setTheme(args) {
      this.ttk.use(args[0]);
      return ``;
    }

    tcl_ttk_notebook_enableTraversal(args) {
      const notebook = this.widget(args[0]);
      notebook.traversal = true;
      return ``;
    }

    queue_virtual(widget, name) {
      /* Delivers a virtual event later, from the event loop (Tk_QueueWindowEvent). */
      this.event_queue.push({ t: `_virtual`, w: widget.path, name: name });
    }

    dispatch_all_virtual(name) {
      const widgets = [...this.widgets.values()];
      const step = (i) => {
        while (i < widgets.length) {
          const w = widgets[i];
          i += 1;
          if (w.destroyed) continue;
          const r = this._dispatch_virtual(w, name);
          if (susp.is_suspension(r)) return susp.chain(r, () => step(i));
        }
        return undefined;
      };
      return step(0);
    }

    // ---- host hooks --------------------------------------------------------------------------------

    get fs() {
      return hooks.fs;
    }

    set fs(value) {
      hooks.fs = value;
    }

    apply_uploads(uploads, root) {
      hooks.apply_uploads(uploads, root);
    }
  }

  // =================================================================================================
  // module-level entry points for the worker
  // =================================================================================================

  function download(filename, data, mime = `application/octet-stream`) {
    /* Offers bytes to the user as a file download (e.g. matplotlib's Save button). */
    ui.send(
      JSON.stringify([
        { op: `download`, name: filename, mime: mime, data: b64encode(data) },
      ]),
    );
  }

  function deliver(raw) {
    /* Queues a batch of page events (JSON list) for their applications. */
    let batch;
    try {
      batch = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!Array.isArray(batch)) return;
    const by_id = new Map(APPS.map((app) => [app.id, app]));
    for (const ev of batch) {
      const app = by_id.get(ev.app);
      if (app !== undefined) {
        if (ev.t === `msgbox`) {
          const mid = Number(ev.mid);
          app.msgbox_results[mid] = ev.value;
          const waiter = app._msgbox_waiters.get(mid);
          if (waiter) {
            app._msgbox_waiters.delete(mid);
            waiter(ev.value);
            continue;
          }
        }
        app.event_queue.push(ev);
      }
    }
    wake_waiters();
  }

  function pump() {
    /* Processes everything pending while no user code runs (REPL idle).

       Returns milliseconds until the next timer, or -1 when there is none. */
    const apps = [...APPS];
    const delays_of = () => {
      const delays = [];
      for (const app of APPS) {
        if (app.destroyed) continue;
        const d = app.next_timer_delay();
        if (d !== null) delays.push(d);
      }
      return delays.length ? Math.floor(Math.min(...delays) * 1000) + 1 : -1;
    };
    const step = (idx) => {
      while (idx < apps.length) {
        const r = pump_app(apps[idx]);
        if (susp.is_suspension(r)) return susp.chain(r, () => step(idx + 1));
        idx += 1;
      }
      return delays_of();
    };
    return step(0);
  }

  function pump_app(app) {
    const STAGES = [`process_event`, `run_due_timers`, `run_idle`];
    const step = (i) => {
      if (i >= 10000) return undefined;
      const stages = (s) => {
        while (s < STAGES.length) {
          const r = app[STAGES[s]]();
          if (susp.is_suspension(r)) {
            return susp.chain(r, (did) => (did ? step(i + 1) : stages(s + 1)));
          }
          if (r) return step(i + 1);
          s += 1;
        }
        if (!app.destroyed) app.flush();
        // Layout may have queued <Configure> events.
        if (app.destroyed || !(app.event_queue.length || app.idle_scripts.length)) return undefined;
        return step(i + 1);
      };
      return stages(0);
    };
    return step(0);
  }

  function dispatch_external(raw) {
    deliver(raw);
    return pump();
  }

  ns.APPS = APPS;
  ns.MSGBOX_GRAB = MSGBOX_GRAB;
  ns.ui = ui;
  ns.hooks = hooks;
  ns.set_susp = set_susp;
  ns.TkApp = TkApp;
  ns.download = download;
  ns.deliver = deliver;
  ns.pump = pump;
  ns.dispatch_external = dispatch_external;
  ns.TclError = TclError;
  globalThis.TkEngine = {
    TclError: ns.TclError,
    APPS: APPS,
    MSGBOX_GRAB: MSGBOX_GRAB,
    ui: ui,
    hooks: hooks,
    susp: susp,
    set_susp: set_susp,
    TkApp: TkApp,
    download: download,
    deliver: deliver,
    pump: pump,
    dispatch_external: dispatch_external,
    invalidateImages: () => {
      for (const app of APPS) app.invalidateImages();
    },
    destroyAllWindows: () => {
      /* Знищує всі вікна всіх застосунків Tk. Використовується при імпорті
         tkinter, щоб після повторного запуску програми старі вікна не
         залишалися на екрані. */
      for (const app of [...APPS]) {
        const root = app.widgets.get(`.`);
        if (root) {
          app.destroy_widget(root);
        } else {
          app.destroyed = true;
          const at = APPS.indexOf(app);
          if (at !== -1) APPS.splice(at, 1);
        }
      }
    },
  };
})(globalThis.__TkEngineNS = globalThis.__TkEngineNS || {});
