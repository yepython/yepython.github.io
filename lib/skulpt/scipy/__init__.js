/**
 * scipy для Skulpt
 * ------------------
 * Реалізація підмножини SciPy поверх Skulpt, у тому ж стилі, що й
 * доданий numpy-модуль для Skulpt (https://github.com/skulpt/skulpt).
 *
 * На відміну від numpy-модуля, scipy НЕ лізе у внутрішні структури numpy
 * (PyArray_DATA і т.і. — вони приватні для того файлу). Натомість, як і
 * справжній SciPy, цей модуль спілкується з numpy лише через його
 * публічний Python-рівень API: np.array(...), arr.tolist(), arr.shape
 * тощо. Якщо numpy недоступний, модуль однаково працює зі звичайними
 * python-послідовностями (list/tuple) і повертає list.
 *
 * Підмодулі:
 *   scipy.constants  — фізичні та математичні константи
 *   scipy.special    — спеціальні функції (gamma, erf, ...)
 *   scipy.linalg     — лінійна алгебра (det, inv, solve, eig, ...)
 *   scipy.optimize   — оптимізація і пошук коренів
 *   scipy.integrate  — чисельне інтегрування та ОДР
 *   scipy.stats      — статистика та розподіли ймовірностей
 *   scipy.fft        — швидке перетворення Фур'є
 *   scipy.spatial    — просторові функції (відстані)
 *
 * Автор: побудовано за аналогією до numpy-модуля для Skulpt.
 */
var $builtinmodule = function (name) {
  "use strict";

  var mod = {};
  mod.__name__ = new Sk.builtin.str("scipy");
  mod.__doc__ = new Sk.builtin.str(
    "SciPy для Skulpt\n================\n\n" +
    "Легка, чиста JS-реалізація підмножини SciPy для використання у " +
    "браузері разом з numpy-модулем для Skulpt.\n" +
    "Підпакети: constants, special, linalg, optimize, integrate, stats, fft, spatial.\n"
  );

  /* ============================================================ */
  /*  Взаємодія з Python / numpy об'єктами                         */
  /* ============================================================ */

  /**
   * math.js підключений глобально через <script src="./lib/skulpt/deps/math.js">
   * (тобто глобальна змінна `math` у браузері, а не Python/Skulpt-модуль).
   * Використовуємо перевірені реалізації лінійної алгебри й спец-функцій
   * звідти замість власних ручних (LU, Якобі, Ланцош тощо), де вони є.
   *
   * ВАЖЛИВО: не відомо точно, яка версія math.js зашита в цю збірку —
   * деякі API (напр. math.eigs) з'явились у math.js відносно пізно.
   * Тому кожен виклик іде через hasFn()-перевірку й try/catch: якщо
   * потрібної функції немає або вона кинула виняток — тихо повертаємось
   * до власної ручної реалізації нижче, а не ламаємо модуль.
   */
  function getMathJS() {
    return (typeof math !== "undefined" && math) ? math : null;
  }
  function hasFn(obj, name) {
    return !!(obj && typeof obj[name] === "function");
  }
  /**
   * Глибоко копіює в гарантовано "чисті" нативні Array/Number, перш ніж
   * віддати дані в math.js. Skulpt суттєво патчить Array.prototype /
   * Object.prototype для власної Python-семантики (напр. додає власні
   * enumerable-методи), і диспетчер типів math.js (`typed-function`)
   * інколи губиться на таких "заражених" об'єктах під час визначення
   * типу аргументу — що на практиці проявляється як переповнення стеку
   * ("too much recursion") саме у викликах на кшталt lusolve/eigs, а
   * не в простіших (det/gamma), де такого не траплялось.
   */
  function toPlainArray(x) {
    if (Array.isArray(x)) {
      var out = new Array(x.length);
      for (var i = 0; i < x.length; i++) out[i] = toPlainArray(x[i]);
      return out;
    }
    return +x; // гарантовано примітивне число, без жодної обгортки
  }
  /** Розгортає результат math.js (Matrix-об'єкт або вкладений масив) у звичайний вкладений JS Array. */
  function mjsToArray(x, _depth) {
    _depth = _depth || 0;
    if (_depth > 50) return x; // запобіжник від нескінченної рекурсії (той самий клас проблем, що й вище)
    if (x && typeof x.toArray === "function") return x.toArray();
    if (x && typeof x.valueOf === "function" && x.valueOf() !== x) return mjsToArray(x.valueOf(), _depth + 1);
    return x;
  }

  var _npCache; // кеш словника numpy-модуля (undefined = ще не пробували)

  /** Повертає $d (простір імен) модуля numpy, або null, якщо він недоступний. */
  function getNumpy() {
    if (_npCache !== undefined) {
      return _npCache;
    }
    try {
      var m = Sk.importModule("numpy", false, false);
      _npCache = (m && m.$d) ? m.$d : null;
    } catch (e) {
      _npCache = null;
    }
    return _npCache;
  }

  /** true, якщо obj — numpy.ndarray */
  function isNdarray(obj) {
    return !!(obj && obj.tp$name === "numpy.ndarray");
  }

  /** true, якщо obj — скалярне число (int/float/bool) */
  function isPyNumber(obj) {
    return obj instanceof Sk.builtin.int_ ||
      obj instanceof Sk.builtin.float_ ||
      obj instanceof Sk.builtin.bool ||
      typeof obj === "number";
  }

  /** Дістає obj[i] максимально сумісним способом (різні збірки Skulpt). */
  function subscriptGet(obj, i) {
    var key = new Sk.builtin.int_(i);
    if (typeof Sk.abstr.objectGetItem === "function") return Sk.abstr.objectGetItem(obj, key);
    if (typeof obj.mp$subscript === "function") return obj.mp$subscript(key);
    if (typeof obj.sq$item === "function") return obj.sq$item(i);
    throw new Error("немає жодного відомого способу індексувати об'єкт (objectGetItem/mp$subscript/sq$item)");
  }

  /**
   * Конвертує numpy.ndarray у вкладений JS Array, обходячи елементи
   * через звичайне індексування obj[i] (за .shape), А НЕ через
   * ndarray.tolist(). У конкретній збірці numpy-для-Skulpt, з якою це
   * використовується, .tolist() для 2D-масивів рекурсивно ламається
   * ("too much recursion") — а базове індексування зобов'язаний
   * підтримувати будь-який масив-подібний об'єкт, тож це надійніший шлях.
   */
  function ndarrayToJS(obj, _depth) {
    _depth = _depth || 0;
    if (_depth > 64) throw new Error("ndarrayToJS: перевищено глибину вкладеності");
    var shape = toJS(Sk.abstr.gattr(obj, "shape"));
    if (!Array.isArray(shape) || shape.length === 0) {
      // 0-вимірний масив (скаляр)
      return Sk.ffi.remapToJs(obj);
    }
    var n = shape[0];
    var out = new Array(n);
    for (var i = 0; i < n; i++) {
      var el = subscriptGet(obj, i);
      if (isNdarray(el)) {
        out[i] = ndarrayToJS(el, _depth + 1);
      } else if (typeof el === "number") {
        out[i] = el;
      } else if (el instanceof Sk.builtin.int_ || el instanceof Sk.builtin.float_) {
        out[i] = el.v;
      } else {
        out[i] = Sk.ffi.remapToJs(el);
      }
    }
    return out;
  }

  /**
   * Рекурсивно перетворює будь-який python/numpy об'єкт
   * (ndarray, list, tuple, число) у "чистий" JS: число або
   * вкладений Array чисел.
   */
  function toJS(obj, _depth) {
    _depth = _depth || 0;
    if (_depth > 200) {
      // Захист від "too much recursion": або самопосилальна структура,
      // або тут (numpy.tolist() / remapToJs) справжня рекурсивна
      // помилка десь поза цим файлом — краще чітка Python-помилка,
      // ніж сирий крах стеку браузера.
      throw ValueError("toJS: перевищено максимальну глибину вкладеності (можлива самопосилальна структура або помилка в numpy-модулі)");
    }
    if (obj === undefined || obj === null || Sk.builtin.checkNone(obj)) {
      return null;
    }
    if (isNdarray(obj)) {
      try {
        return ndarrayToJS(obj);
      } catch (e) {
        // якщо індексування з якоїсь причини недоступне в цій збірці —
        // повертаємось до старого шляху через .tolist() (як було раніше).
        var tolistFn = Sk.abstr.gattr(obj, "tolist");
        obj = Sk.misceval.callsim(tolistFn);
      }
    }
    if (obj instanceof Sk.builtin.list || obj instanceof Sk.builtin.tuple) {
      var out = [];
      for (var i = 0; i < obj.v.length; i++) {
        out.push(toJS(obj.v[i], _depth + 1));
      }
      return out;
    }
    if (typeof obj === "number") {
      return obj;
    }
    return Sk.ffi.remapToJs(obj);
  }

  /** Перетворює вкладений JS-масив/число у Python list/число. */
  function fromJS(x) {
    if (Array.isArray(x)) {
      var items = [];
      for (var i = 0; i < x.length; i++) {
        items.push(fromJS(x[i]));
      }
      return new Sk.builtin.list(items);
    }
    if (typeof x === "number") {
      return new Sk.builtin.float_(x);
    }
    if (typeof x === "boolean") {
      return new Sk.builtin.bool(x);
    }
    return Sk.ffi.remapToPy(x);
  }

  /**
   * Як fromJS, але якщо numpy доступний — повертає numpy.ndarray
   * (це те, що очікують користувачі від scipy-функцій, які повертають масиви).
   */
  function toArrayLike(x) {
    var np = getNumpy();
    if (np && np.array) {
      return Sk.misceval.callsim(np.array, fromJS(x));
    }
    return fromJS(x);
  }

  /** Викликає python-функцію (callable) f з JS-числовими аргументами, повертає JS-число. */
  function callScalarFn(f, args) {
    var pyArgs = args.map(function (a) { return new Sk.builtin.float_(a); });
    var res = Sk.misceval.callsim.apply(null, [f].concat(pyArgs));
    return toJS(res);
  }

  /** pyCheckArgs-скорочення */
  /**
   * checkArgs — валідація кількості позиційних аргументів для ПРОСТИХ
   * (без **kwargs) функцій.
   *
   * ВАЖЛИВО: п'ятий аргумент Sk.builtin.pyCheckArgs ("kwargs") означає не
   * "чи передав виклик іменовані аргументи", а "чи ця функція взагалі
   * оголошена як co_kwargs=true" — у такому разі Skulpt ЗАВЖДИ додає
   * службовий масив kwarg-пар в кінець arguments (навіть порожній), і
   * pyCheckArgs віднімає 1 з довжини arguments, щоб його не рахувати.
   * Жодна з функцій, що викликає checkArgs у цьому файлі, не має
   * co_kwargs=true (ті, кому потрібні kwargs, розбирають їх вручну
   * через splitKwargs і НЕ викликають checkArgs). Тому прапорець мав
   * бути false — з true кожен виклик з рівно N аргументами хибно
   * повідомляв "N-1 given" (напр. convert_temperature(100, 'Celsius',
   * 'Fahrenheit') → "takes exactly 3 arguments (2 given)").
   */
  function checkArgs(name, args, min, max) {
    Sk.builtin.pyCheckArgs(name, args, min, max === undefined ? min : max, false, false);
  }

  function ValueError(msg) { return new Sk.builtin.ValueError(msg); }
  function NotImplementedError(msg) {
    return new Sk.builtin.NotImplementedError(msg);
  }

  /* (стара функція splitKwargs видалена — вона хибно припускала, що масив
     kwargs передається Skulpt-ом ОСТАННІМ аргументом; насправді
     Sk.builtin.func.$resolveArgs робить args.unshift(kwargs), тобто масив
     завжди ПЕРШИЙ. Дивись parseKw вище.) */

  function kwOr(kw, key, def) {
    return (kw[key] !== undefined && kw[key] !== null && !Sk.builtin.checkNone(kw[key])) ? kw[key] : def;
  }

  /**
   * ВАЖЛИВО: для функцій з co_kwargs=true Skulpt (Sk.builtin.func.$resolveArgs)
   * додає масив [ім'я1, значення1, ім'я2, значення2, ...] ЧЕРЕЗ unshift —
   * тобто це ПЕРШИЙ аргумент виклику, а не останній (як помилково
   * передбачалося раніше в цьому файлі через splitKwargs+slice(N) — саме
   * тому func/a/b отримували зсунуті значення і виклик кидав
   * "'<invalid type>' object is not callable"). parseKw читає цей масив
   * напряму і повертає звичайний JS-об'єкт {ім'я: значення}.
   */
  function parseKw(kwArr) {
    var kw = {};
    if (kwArr instanceof Array) {
      for (var i = 0; i < kwArr.length; i += 2) {
        kw[kwArr[i]] = kwArr[i + 1];
      }
    }
    return kw;
  }

  /* ============================================================ */
  /*  Малий набір лінійно-алгебраїчних утиліт на "сирих" JS-масивах */
  /*  (використовуються linalg/optimize/stats/integrate)           */
  /* ============================================================ */

  /**
   * Прибирає типовий floating-point "шум" (напр. -0.09999999999999999
   * замість -0.1, або 2.999999999999999 замість 3.0), який з'являється
   * після LU/Якобі обчислень. Реальний numpy показує такі значення
   * округленими завдяки своєму repr-алгоритму (dragon4 з обмеженою
   * кількістю значущих цифр); наш Skulpt-numpy шар цього не робить,
   * тому імітуємо той самий ефект прямим округленням до 1e-12.
   */
  function cleanJS(x) {
    if (typeof x === "number") return Math.round(x * 1e12) / 1e12;
    if (Array.isArray(x)) return x.map(cleanJS);
    return x;
  }

  function isMatrix(a) { return Array.isArray(a) && Array.isArray(a[0]); }
  function shapeOf(a) {
    if (!Array.isArray(a)) return [];
    if (isMatrix(a)) return [a.length, a[0].length];
    return [a.length];
  }
  function zerosMat(n, m) {
    var r = [];
    for (var i = 0; i < n; i++) {
      r.push(new Array(m).fill(0));
    }
    return r;
  }
  function eyeMat(n) {
    var r = zerosMat(n, n);
    for (var i = 0; i < n; i++) r[i][i] = 1;
    return r;
  }
  function cloneMat(a) { return a.map(function (row) { return row.slice(); }); }
  function matMul(A, B) {
    var n = A.length, k = B.length, m = B[0].length;
    var C = zerosMat(n, m);
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < m; j++) {
        var s = 0;
        for (var p = 0; p < k; p++) s += A[i][p] * B[p][j];
        C[i][j] = s;
      }
    }
    return C;
  }
  function matVec(A, x) {
    return A.map(function (row) {
      var s = 0;
      for (var i = 0; i < row.length; i++) s += row[i] * x[i];
      return s;
    });
  }
  function transpose(A) {
    var n = A.length, m = A[0].length;
    var T = zerosMat(m, n);
    for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) T[j][i] = A[i][j];
    return T;
  }

  /**
   * LU-розклад з частковим вибором головного елемента.
   * Повертає { LU: matrix, piv: [...], sign: +-1 }, LU містить L (без діагоналі, вона=1) та U разом.
   */
  function luDecompose(Ain) {
    var A = cloneMat(Ain);
    var n = A.length;
    var piv = [];
    for (var i = 0; i < n; i++) piv.push(i);
    var sign = 1;

    for (var col = 0; col < n; col++) {
      var maxVal = Math.abs(A[col][col]);
      var maxRow = col;
      for (var r = col + 1; r < n; r++) {
        if (Math.abs(A[r][col]) > maxVal) {
          maxVal = Math.abs(A[r][col]);
          maxRow = r;
        }
      }
      if (maxVal === 0) {
        continue; // сингулярна матриця (по цьому стовпцю)
      }
      if (maxRow !== col) {
        var tmp = A[col]; A[col] = A[maxRow]; A[maxRow] = tmp;
        var tp = piv[col]; piv[col] = piv[maxRow]; piv[maxRow] = tp;
        sign = -sign;
      }
      for (var row = col + 1; row < n; row++) {
        var factor = A[row][col] / A[col][col];
        A[row][col] = factor;
        for (var c2 = col + 1; c2 < n; c2++) {
          A[row][c2] -= factor * A[col][c2];
        }
      }
    }
    return { LU: A, piv: piv, sign: sign };
  }

  function luSolve(lu, b) {
    var n = lu.LU.length;
    var y = new Array(n).fill(0);
    var x = new Array(n).fill(0);
    var i, j;
    // Ly = Pb
    for (i = 0; i < n; i++) {
      var s = b[lu.piv[i]];
      for (j = 0; j < i; j++) s -= lu.LU[i][j] * y[j];
      y[i] = s;
    }
    // Ux = y
    for (i = n - 1; i >= 0; i--) {
      var s2 = y[i];
      for (j = i + 1; j < n; j++) s2 -= lu.LU[i][j] * x[j];
      if (lu.LU[i][i] === 0) {
        throw ValueError("Matrix is singular.");
      }
      x[i] = s2 / lu.LU[i][i];
    }
    return x;
  }

  function determinant(A) {
    var m = getMathJS();
    if (hasFn(m, "det")) {
      try { return m.det(toPlainArray(A)); } catch (e) { /* падаємо до ручної реалізації нижче */ }
    }
    var lu = luDecompose(A);
    var det = lu.sign;
    for (var i = 0; i < lu.LU.length; i++) det *= lu.LU[i][i];
    return det;
  }

  function inverse(A) {
    var m = getMathJS();
    if (hasFn(m, "inv")) {
      try { return mjsToArray(m.inv(toPlainArray(A))); } catch (e) { /* падаємо до ручної реалізації нижче */ }
    }
    var n = A.length;
    var lu = luDecompose(A);
    var inv = zerosMat(n, n);
    for (var col = 0; col < n; col++) {
      var e = new Array(n).fill(0);
      e[col] = 1;
      var x = luSolve(lu, e);
      for (var row = 0; row < n; row++) inv[row][col] = x[row];
    }
    return inv;
  }

  /**
   * Пробує math.js `eigs()`, якщо ця збірка її має (з'явилась відносно
   * пізно в math.js, тож не гарантована). Формат повернення різнився
   * між версіями (values/vectors як Matrix, або масив {value,vector}),
   * тому парсимо обережно й підганяємо під наш власний порядок
   * (спадання за величиною — так, як робить jacobiEig), щоб не зламати
   * узгодженість виводу незалежно від того, яка версія завантажена.
   * Повертає null, якщо eigs недоступна/кинула виняток/формат незнайомий —
   * тоді викликач падає до jacobiEig.
   */
  function mathEigsTry(A) {
    var m = getMathJS();
    if (!hasFn(m, "eigs")) return null;
    try {
      var res = m.eigs(toPlainArray(A));
      var vals = mjsToArray(res.values);
      if (!Array.isArray(vals) || !vals.length) return null;
      var vecs = null;
      if (Array.isArray(res.eigenvectors)) {
        // [{value, vector}, ...] -> зберемо в матрицю-стовпці
        vecs = transpose(res.eigenvectors.map(function (ev) { return mjsToArray(ev.vector); }));
      } else if (res.vectors) {
        vecs = mjsToArray(res.vectors);
      }
      var n = vals.length;
      var order = vals.map(function (v, idx) { return idx; });
      order.sort(function (i1, i2) { return vals[i2] - vals[i1]; });
      var sortedValues = order.map(function (idx) { return vals[idx]; });
      var sortedVectors = null;
      if (vecs) {
        sortedVectors = zerosMat(n, n);
        for (var col = 0; col < n; col++) for (var row = 0; row < n; row++) sortedVectors[row][col] = vecs[row][order[col]];
      }
      return { values: sortedValues, vectors: sortedVectors };
    } catch (e) {
      return null;
    }
  }

  /** Симетрична власна задача: Jacobi eigenvalue algorithm. Повертає {values, vectors(стовпці)}. */
  function jacobiEig(Ain, maxSweeps) {
    var A = cloneMat(Ain);
    var n = A.length;
    var V = eyeMat(n);
    maxSweeps = maxSweeps || 100;

    for (var sweep = 0; sweep < maxSweeps; sweep++) {
      var off = 0;
      for (var i = 0; i < n; i++) {
        for (var j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      }
      if (off < 1e-20) break;

      for (var p = 0; p < n; p++) {
        for (var q = p + 1; q < n; q++) {
          if (Math.abs(A[p][q]) < 1e-15) continue;
          var theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
          var t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          var c = 1 / Math.sqrt(t * t + 1);
          var s = t * c;
          var app = A[p][p], aqq = A[q][q], apq = A[p][q];
          A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
          A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
          A[p][q] = 0; A[q][p] = 0;
          for (var k = 0; k < n; k++) {
            if (k !== p && k !== q) {
              var akp = A[k][p], akq = A[k][q];
              A[k][p] = c * akp - s * akq; A[p][k] = A[k][p];
              A[k][q] = s * akp + c * akq; A[q][k] = A[k][q];
            }
            var vkp = V[k][p], vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }
    var values = [];
    for (var d = 0; d < n; d++) values.push(A[d][d]);
    // сортування за спаданням, як зазвичай очікується
    var order = values.map(function (v, idx) { return idx; });
    order.sort(function (a, b) { return values[b] - values[a]; });
    var sortedValues = order.map(function (idx) { return values[idx]; });
    var sortedVectors = zerosMat(n, n);
    for (var col2 = 0; col2 < n; col2++) {
      for (var row2 = 0; row2 < n; row2++) {
        sortedVectors[row2][col2] = V[row2][order[col2]];
      }
    }
    return { values: sortedValues, vectors: sortedVectors };
  }

  function choleskyDecompose(A) {
    var n = A.length;
    var L = zerosMat(n, n);
    for (var i = 0; i < n; i++) {
      for (var j = 0; j <= i; j++) {
        var s = 0;
        for (var k = 0; k < j; k++) s += L[i][k] * L[j][k];
        if (i === j) {
          var val = A[i][i] - s;
          if (val <= 0) throw ValueError("Matrix is not positive definite.");
          L[i][j] = Math.sqrt(val);
        } else {
          L[i][j] = (A[i][j] - s) / L[j][j];
        }
      }
    }
    return L;
  }

  function vectorNorm(x, ord) {
    var i;
    if (ord === undefined || ord === null || ord === 2) {
      var s = 0;
      for (i = 0; i < x.length; i++) s += x[i] * x[i];
      return Math.sqrt(s);
    }
    if (ord === 1) {
      var s1 = 0;
      for (i = 0; i < x.length; i++) s1 += Math.abs(x[i]);
      return s1;
    }
    if (ord === Infinity || ord === "inf") {
      var m = 0;
      for (i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
      return m;
    }
    if (ord === -Infinity) {
      var mn = Infinity;
      for (i = 0; i < x.length; i++) mn = Math.min(mn, Math.abs(x[i]));
      return mn;
    }
    // p-норма
    var sp = 0;
    for (i = 0; i < x.length; i++) sp += Math.pow(Math.abs(x[i]), ord);
    return Math.pow(sp, 1 / ord);
  }

  /* ============================================================ */
  /*  Утиліта для побудови "підмодулів" (scipy.linalg, ...)        */
  /*  Реалізовано аналогічно класу numpy.ndarray у numpy-модулі:   */
  /*  через Sk.misceval.buildClass + одноразовий екземпляр, що     */
  /*  виступає простором імен з атрибутами-функціями.              */
  /* ============================================================ */

  /**
   * Будує підпакет (напр. scipy.constants) як СПРАВЖНІЙ Skulpt-модуль і
   * реєструє його в Sk.sysmodules під повним dotted-іменем — так само,
   * як зроблено для tkinter.filedialog в одному файлі з tkinter:
   *
   *   s.filedialog = new Sk.builtin.module();
   *   s.filedialog.$d = new filedialog("tkinter.filedialog");
   *   Sk.sysmodules.mp$ass_subscript(new Sk.builtin.str("tkinter.filedialog"), s.filedialog);
   *
   * Завдяки цьому `import scipy.constants` (і будь-який інший дотований
   * імпорт підпакета, включно з вкладеним `scipy.spatial.distance`)
   * знаходить готовий модуль напряму в Sk.sysmodules і НЕ намагається
   * шукати окремий файл scipy/constants.js — усе залишається в ОДНОМУ
   * файлі __init__.js, як і було раніше.
   */
  function makeNamespace(qualname, builder) {
    var $d = {};
    $d.__name__ = new Sk.builtin.str(qualname);
    builder($d);

    var subMod = new Sk.builtin.module();
    subMod.$d = $d;
    Sk.sysmodules.mp$ass_subscript(new Sk.builtin.str(qualname), subMod);
    return subMod;
  }


  /* ============================================================ */
  /*  scipy.constants                                              */
  /* ============================================================ */

  mod.constants = makeNamespace("scipy.constants", function ($loc) {
    function C(v) { return new Sk.builtin.float_(v); }

    // математичні
    $loc.pi = C(Math.PI);
    $loc.golden = C((1 + Math.sqrt(5)) / 2);
    $loc.golden_ratio = $loc.golden;

    // базові фізичні (СІ)
    $loc.c = C(299792458.0);
    $loc.speed_of_light = $loc.c;
    $loc.mu_0 = C(1.25663706212e-6);
    $loc.epsilon_0 = C(8.8541878128e-12);
    $loc.h = C(6.62607015e-34);
    $loc.Planck = $loc.h;
    $loc.hbar = C(6.62607015e-34 / (2 * Math.PI));
    $loc.G = C(6.6743e-11);
    $loc.gravitational_constant = $loc.G;
    $loc.g = C(9.80665);
    $loc.e = C(1.602176634e-19);
    $loc.elementary_charge = $loc.e;
    $loc.R = C(8.314462618);
    $loc.gas_constant = $loc.R;
    $loc.k = C(1.380649e-23);
    $loc.Boltzmann = $loc.k;
    $loc.N_A = C(6.02214076e23);
    $loc.Avogadro = $loc.N_A;
    $loc.sigma = C(5.670374419e-8);
    $loc.Stefan_Boltzmann = $loc.sigma;
    $loc.m_e = C(9.1093837015e-31);
    $loc.electron_mass = $loc.m_e;
    $loc.m_p = C(1.67262192369e-27);
    $loc.proton_mass = $loc.m_p;
    $loc.m_n = C(1.67492749804e-27);
    $loc.neutron_mass = $loc.m_n;
    $loc.atomic_mass = C(1.66053906660e-27);
    $loc.u = $loc.atomic_mass;

    // префікси SI
    $loc.yotta = C(1e24); $loc.zetta = C(1e21); $loc.exa = C(1e18);
    $loc.peta = C(1e15); $loc.tera = C(1e12); $loc.giga = C(1e9);
    $loc.mega = C(1e6); $loc.kilo = C(1e3); $loc.hecto = C(1e2);
    $loc.deka = C(1e1); $loc.deci = C(1e-1); $loc.centi = C(1e-2);
    $loc.milli = C(1e-3); $loc.micro = C(1e-6); $loc.nano = C(1e-9);
    $loc.pico = C(1e-12); $loc.femto = C(1e-15); $loc.atto = C(1e-18);

    // час
    $loc.minute = C(60.0); $loc.hour = C(3600.0); $loc.day = C(86400.0);
    $loc.week = C(604800.0); $loc.year = C(365.25 * 86400.0);
    $loc.Julian_year = C(365.25 * 86400.0);

    // довжина / маса / кут
    $loc.inch = C(0.0254); $loc.foot = C(0.3048); $loc.yard = C(0.9144);
    $loc.mile = C(1609.344); $loc.pound = C(0.45359237);
    $loc.ounce = C(0.028349523125);
    $loc.degree = C(Math.PI / 180.0);
    $loc.arcmin = C(Math.PI / 180.0 / 60.0);
    $loc.arcminute = $loc.arcmin;
    $loc.arcsec = C(Math.PI / 180.0 / 3600.0);
    $loc.arcsecond = $loc.arcsec;

    var convert_temperature_f = function (val, old_scale, new_scale) {
      checkArgs("convert_temperature", arguments, 3);
      var v = toJS(val);
      var o = Sk.ffi.remapToJs(old_scale).toLowerCase();
      var n = Sk.ffi.remapToJs(new_scale).toLowerCase();
      var norm = {
        celsius: "c", c: "c", kelvin: "k", k: "k",
        fahrenheit: "f", f: "f", rankine: "r", r: "r"
      };
      o = norm[o] || o; n = norm[n] || n;

      function apply(val, fn) {
        return Array.isArray(val) ? val.map(function (x) { return apply(x, fn); }) : fn(val);
      }

      var toK;
      if (o === "c") toK = function (x) { return x + 273.15; };
      else if (o === "k") toK = function (x) { return x; };
      else if (o === "f") toK = function (x) { return (x - 32) * 5 / 9 + 273.15; };
      else if (o === "r") toK = function (x) { return x * 5 / 9; };
      else throw ValueError("Unknown scale: " + o);

      var fromK;
      if (n === "c") fromK = function (x) { return x - 273.15; };
      else if (n === "k") fromK = function (x) { return x; };
      else if (n === "f") fromK = function (x) { return (x - 273.15) * 9 / 5 + 32; };
      else if (n === "r") fromK = function (x) { return x * 9 / 5; };
      else throw ValueError("Unknown scale: " + n);

      var kelvinVal = apply(v, toK);
      var result = apply(kelvinVal, fromK);
      return toArrayLike(result);
    };
    convert_temperature_f.co_varnames = ["val", "old_scale", "new_scale"];
    $loc.convert_temperature = new Sk.builtin.func(convert_temperature_f);
  });

  /* ============================================================ */
  /*  scipy.special                                                 */
  /* ============================================================ */

  // Lanczos-наближення для гамма-функції (g=7, n=9), точність ~1e-15
  var LANCZOS_G = 7;
  var LANCZOS_COEF = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];

  function gammaFn(x) {
    var m = getMathJS();
    if (hasFn(m, "gamma")) {
      try { return m.gamma(+x); } catch (e) { /* падаємо до Ланцоша нижче */ }
    }
    if (x < 0.5) {
      // формула відбиття: гамма(x) * гамма(1-x) = pi / sin(pi*x)
      return Math.PI / (Math.sin(Math.PI * x) * gammaFn(1 - x));
    }
    x -= 1;
    var a = LANCZOS_COEF[0];
    var t = x + LANCZOS_G + 0.5;
    for (var i = 1; i < LANCZOS_G + 2; i++) {
      a += LANCZOS_COEF[i] / (x + i);
    }
    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
  }

  function gammalnFn(x) {
    if (x < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammalnFn(1 - x);
    }
    x -= 1;
    var a = LANCZOS_COEF[0];
    var t = x + LANCZOS_G + 0.5;
    for (var i = 1; i < LANCZOS_G + 2; i++) {
      a += LANCZOS_COEF[i] / (x + i);
    }
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  // Erf: ряд Тейлора для |x|<=2 (швидко збігається без втрати точності),
  // і неперервний дріб для erfc при |x|>2 (стабільний і в хвостах,
  // на відміну від самого ряду Тейлора, який там втрачає точність
  // через накопичення похибки округлення при великій кількості членів).
  function erfFn(x) {
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    if (x < 1e-12) return 0;
    if (x <= 2.0) {
      var x2 = x * x;
      var term = x * 1.1283791670955126; // 2/sqrt(pi)
      var sum = term;
      for (var n = 1; n < 200; n++) {
        term *= -x2 / n;
        var add = term / (2 * n + 1);
        sum += add;
        if (Math.abs(add) < 1e-18 * Math.abs(sum)) break;
      }
      return sign * sum;
    }
    var b = x, c = 1e300, d = 1.0 / x, h = d;
    for (var i = 2; i < 100; i++) {
      var a = 0.5 * (i - 1);
      d = b + a * d; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + a / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1.0 / d;
      var delta = c * d;
      h *= delta;
      if (Math.abs(delta - 1.0) < 1e-16) break;
    }
    var erfc = Math.exp(-x * x) / 1.7724538509055159 * h; // 1/sqrt(pi)
    return sign * (1.0 - erfc);
  }

  function factorialFn(n) {
    if (n < 0) return NaN;
    if (Math.floor(n) === n && n < 171) {
      var r = 1;
      for (var i = 2; i <= n; i++) r *= i;
      return r;
    }
    return gammaFn(n + 1);
  }

  function combFn(n, k) {
    if (k < 0 || k > n) return 0;
    var m = getMathJS();
    if (hasFn(m, "combinations")) {
      try { return m.combinations(+n, +k); } catch (e) { /* падаємо нижче */ }
    }
    return Math.round(Math.exp(gammalnFn(n + 1) - gammalnFn(k + 1) - gammalnFn(n - k + 1)));
  }

  function permFn(n, k) {
    if (k < 0 || k > n) return 0;
    var m = getMathJS();
    if (hasFn(m, "permutations")) {
      try { return m.permutations(+n, +k); } catch (e) { /* падаємо нижче */ }
    }
    return Math.round(Math.exp(gammalnFn(n + 1) - gammalnFn(n - k + 1)));
  }

  /**
   * Функції Бесселя першого роду J0, J1. Ні в math.js (перевірено — немає),
   * ні в цьому файлі раніше не було жодних функцій Бесселя.
   * Для |x|<=15 — прямий степеневий ряд (збігається до подвійної
   * точності, ~1e-14..1e-15). Для |x|>15 ряд втрачає точність через
   * накопичення похибки округлення при великій кількості членів,
   * тому там — класична асимптотична апроксимація Numerical Recipes
   * (точність там гірша, ~1e-10..1e-11, але це вже дуже великі x).
   */
  function besselJ0(x) {
    var ax = Math.abs(x);
    if (ax <= 15) {
      var z = ax / 2, z2 = -z * z, term = 1, sum = 1;
      for (var k = 1; k < 100; k++) {
        term *= z2 / (k * k);
        sum += term;
        if (Math.abs(term) < 1e-18 * Math.abs(sum)) break;
      }
      return sum;
    }
    var zz = 8.0 / ax, y2 = zz * zz, xx = ax - 0.785398164;
    var ans1 = 1.0 + y2 * (-0.1098628627e-2 + y2 * (0.2734510407e-4
      + y2 * (-0.2073370639e-5 + y2 * 0.2093887211e-6)));
    var ans2 = -0.1562499995e-1 + y2 * (0.1430488765e-3
      + y2 * (-0.6911147651e-5 + y2 * (0.7621095161e-6
        - y2 * 0.934935152e-7)));
    return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * ans1 - zz * Math.sin(xx) * ans2);
  }
  function besselJ1(x) {
    var sign = x < 0 ? -1 : 1;
    var ax = Math.abs(x);
    if (ax <= 15) {
      var z = ax / 2, z2 = -z * z, term = z, sum = z;
      for (var k = 1; k < 100; k++) {
        term *= z2 / (k * (k + 1));
        sum += term;
        if (Math.abs(term) < 1e-18 * Math.abs(sum)) break;
      }
      return sign * sum;
    }
    var zz = 8.0 / ax, y2 = zz * zz, xx = ax - 2.356194491;
    var ans1 = 1.0 + y2 * (0.183105e-2 + y2 * (-0.3516396496e-4
      + y2 * (0.2457520174e-5 + y2 * (-0.240337019e-6))));
    var ans2 = 0.04687499995 + y2 * (-0.2002690873e-3
      + y2 * (0.8449199096e-5 + y2 * (-0.88228987e-6 + y2 * 0.105787412e-6)));
    var ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * ans1 - zz * Math.sin(xx) * ans2);
    return sign * ans;
  }
  /** J_n(x) для цілого n>=0 через рекурентне співвідношення Бесселя: J_{n+1} = (2n/x)J_n - J_{n-1}. */
  function besselJv(n, x) {
    n = Math.round(n);
    if (n < 0) return (n % 2 === 0 ? 1 : -1) * besselJv(-n, x);
    if (n === 0) return besselJ0(x);
    if (n === 1) return besselJ1(x);
    if (x === 0) return 0;
    // Пряма рекурсія вгору нестабільна для великих n; для помірних n
    // (звичний випадок use-кейсів) вона є достатньо точною.
    var jPrev = besselJ0(x), jCur = besselJ1(x);
    for (var k = 1; k < n; k++) {
      var jNext = (2 * k / x) * jCur - jPrev;
      jPrev = jCur; jCur = jNext;
    }
    return jCur;
  }

  function elementwiseMap1(fn) {
    return function (x) {
      var v = toJS(x);
      function apply(v) { return Array.isArray(v) ? v.map(apply) : fn(v); }
      var r = apply(v);
      return Array.isArray(v) ? toArrayLike(r) : new Sk.builtin.float_(r);
    };
  }

  mod.special = makeNamespace("scipy.special", function ($loc) {
    $loc.gamma = new Sk.builtin.func(elementwiseMap1(gammaFn));
    $loc.gammaln = new Sk.builtin.func(elementwiseMap1(gammalnFn));
    $loc.loggamma = $loc.gammaln;
    $loc.erf = new Sk.builtin.func(elementwiseMap1(erfFn));
    $loc.erfc = new Sk.builtin.func(elementwiseMap1(function (x) { return 1 - erfFn(x); }));
    $loc.expit = new Sk.builtin.func(elementwiseMap1(function (x) { return 1 / (1 + Math.exp(-x)); }));
    $loc.logit = new Sk.builtin.func(elementwiseMap1(function (x) { return Math.log(x / (1 - x)); }));
    $loc.factorial = new Sk.builtin.func(elementwiseMap1(factorialFn));
    $loc.cbrt = new Sk.builtin.func(elementwiseMap1(Math.cbrt));
    $loc.exp2 = new Sk.builtin.func(elementwiseMap1(function (x) { return Math.pow(2, x); }));
    $loc.j0 = new Sk.builtin.func(elementwiseMap1(besselJ0));
    $loc.j1 = new Sk.builtin.func(elementwiseMap1(besselJ1));

    var jv_f = function (v, x) {
      checkArgs("jv", arguments, 2);
      var order = toJS(v);
      function apply(xv) { return Array.isArray(xv) ? xv.map(apply) : besselJv(order, xv); }
      var xv = toJS(x);
      var r = apply(xv);
      return Array.isArray(xv) ? toArrayLike(r) : new Sk.builtin.float_(r);
    };
    jv_f.co_varnames = ["v", "x"];
    $loc.jv = new Sk.builtin.func(jv_f);

    var comb_f = function (n, k) {
      checkArgs("comb", arguments, 2);
      return new Sk.builtin.float_(combFn(toJS(n), toJS(k)));
    };
    comb_f.co_varnames = ["n", "k"];
    $loc.comb = new Sk.builtin.func(comb_f);

    var perm_f = function (n, k) {
      checkArgs("perm", arguments, 2);
      return new Sk.builtin.float_(permFn(toJS(n), toJS(k)));
    };
    perm_f.co_varnames = ["n", "k"];
    $loc.perm = new Sk.builtin.func(perm_f);

    var softmax_f = function (x) {
      checkArgs("softmax", arguments, 1);
      var v = toJS(x);
      var flat = Array.isArray(v[0]) ? v.reduce(function (a, b) { return a.concat(b); }, []) : v;
      var m = Math.max.apply(null, flat);
      var exps = flat.map(function (xi) { return Math.exp(xi - m); });
      var s = exps.reduce(function (a, b) { return a + b; }, 0);
      var normed = exps.map(function (e) { return e / s; });
      if (Array.isArray(v[0])) {
        // повернути ту саму форму (проста 2D підтримка)
        var cols = v[0].length, out = [];
        for (var i = 0; i < v.length; i++) out.push(normed.slice(i * cols, i * cols + cols));
        return toArrayLike(out);
      }
      return toArrayLike(normed);
    };
    softmax_f.co_varnames = ["x"];
    $loc.softmax = new Sk.builtin.func(softmax_f);
  });

  /* ============================================================ */
  /*  scipy.linalg                                                  */
  /* ============================================================ */

  function asMatrix(x, name) {
    var v = toJS(x);
    if (!isMatrix(v)) {
      throw ValueError(name + ": expected a 2D array/matrix");
    }
    return v;
  }
  function asVector(x, name) {
    var v = toJS(x);
    if (Array.isArray(v) && Array.isArray(v[0])) {
      throw ValueError(name + ": expected a 1D array/vector");
    }
    return v;
  }

  /**
   * Розв'язує Ax=b для одного вектора b.
   *
   * ПРИМІТКА: тут навмисно НЕ використовується math.js (`lusolve`), на
   * відміну від det/inv/gamma/comb/perm/eig вище. У користувача саме
   * виклик через math.js.lusolve спричиняв "too much recursion"
   * (переповнення стеку) — ймовірно, конфлікт диспетчера типів
   * math.js (`typed-function`) із тим, як Skulpt патчить Array.prototype
   * у цьому середовищі. Власний LU-розв'язувач нижче вже перевірений і
   * коректно збігається з контрольними Python-результатами, тож ризик
   * делегування сюди не виправданий.
   */
  function linSolve(A, bv) {
    return luSolve(luDecompose(A), bv);
  }

  mod.linalg = makeNamespace("scipy.linalg", function ($loc) {
    var det_f = function (a) {
      checkArgs("det", arguments, 1);
      return new Sk.builtin.float_(cleanJS(determinant(asMatrix(a, "det"))));
    };
    det_f.co_varnames = ["a"];
    $loc.det = new Sk.builtin.func(det_f);

    var inv_f = function (a) {
      checkArgs("inv", arguments, 1);
      return toArrayLike(cleanJS(inverse(asMatrix(a, "inv"))));
    };
    inv_f.co_varnames = ["a"];
    $loc.inv = new Sk.builtin.func(inv_f);

    var solve_f = function (a, b) {
      checkArgs("solve", arguments, 2);
      function stage(label, fn) {
        try { return fn(); }
        catch (e) {
          if (!(e instanceof Error)) throw e; // наш власний ValueError і т.п. — пропускаємо як є
          throw ValueError("solve: помилка на етапі [" + label + "] (" + e.message + ")");
        }
      }
      var A = stage("asMatrix(a)", function () { return asMatrix(a, "solve"); });
      var bv = stage("toJS(b)", function () { return toJS(b); });
      if (Array.isArray(bv[0])) {
        // множина правих частин (матриця) — розв'язуємо по стовпцях
        var Bt = stage("transpose(bv)", function () { return transpose(bv); });
        var cols = stage("linSolve x N стовпців", function () {
          return Bt.map(function (col) { return linSolve(A, col); });
        });
        var colsT = stage("transpose(cols)", function () { return transpose(cols); });
        return stage("toArrayLike(cleanJS(colsT))", function () { return toArrayLike(cleanJS(colsT)); });
      }
      var x = stage("linSolve(A, bv)", function () { return linSolve(A, bv); });
      return stage("toArrayLike(cleanJS(x))", function () { return toArrayLike(cleanJS(x)); });
    };
    solve_f.co_varnames = ["a", "b"];
    $loc.solve = new Sk.builtin.func(solve_f);

    var lstsq_f = function (a, b) {
      checkArgs("lstsq", arguments, 2);
      var A = asMatrix(a, "lstsq");
      var bv = asVector(b, "lstsq");
      var At = transpose(A);
      var AtA = matMul(At, A);
      var Atb = matVec(At, bv);
      var x = linSolve(AtA, Atb);
      return new Sk.builtin.tuple([toArrayLike(cleanJS(x)), toArrayLike([]), new Sk.builtin.int_(A.length), Sk.builtin.none.none$]);
    };
    lstsq_f.co_varnames = ["a", "b"];
    $loc.lstsq = new Sk.builtin.func(lstsq_f);

    var norm_f = function (x, ord) {
      checkArgs("norm", arguments, 1, 2);
      var v = toJS(x);
      if (isMatrix(v)) {
        // Frobenius-норма за замовчуванням
        var s = 0;
        for (var i = 0; i < v.length; i++) for (var j = 0; j < v[i].length; j++) s += v[i][j] * v[i][j];
        return new Sk.builtin.float_(Math.sqrt(s));
      }
      var ordJs = (ord === undefined || Sk.builtin.checkNone(ord)) ? undefined : toJS(ord);
      return new Sk.builtin.float_(vectorNorm(v, ordJs));
    };
    norm_f.co_varnames = ["x", "ord"];
    $loc.norm = new Sk.builtin.func(norm_f);

    /** Обгортає масив дійсних власних чисел у Sk.builtin.complex (dtype complex),
     *  так само як робить справжній scipy.linalg.eig/eigvals для загальних матриць. */
    function toComplexList(values) {
      return new Sk.builtin.list(values.map(function (v) {
        return new Sk.builtin.complex(new Sk.builtin.float_(v), new Sk.builtin.float_(0));
      }));
    }

    /** Спершу пробує math.js eigs(), інакше — власний Якобі-алгоритм. */
    function eigOf(A) {
      return mathEigsTry(A) || jacobiEig(A);
    }

    var eig_f = function (a) {
      checkArgs("eig", arguments, 1);
      var A = asMatrix(a, "eig");
      var res = eigOf(A);
      // eig (загальний випадок) в справжньому SciPy завжди повертає
      // комплексний dtype, навіть коли уявна частина нульова (напр.
      // [3.+0.j 1.+0.j], а не [3.0, 1.0]).
      return new Sk.builtin.tuple([toComplexList(cleanJS(res.values)), toArrayLike(cleanJS(res.vectors))]);
    };
    eig_f.co_varnames = ["a"];
    $loc.eig = new Sk.builtin.func(eig_f);

    var eigh_f = function (a) {
      checkArgs("eigh", arguments, 1);
      var res = eigOf(asMatrix(a, "eigh"));
      // eigh — для симетричних/ермітових матриць — лишається дійсним.
      return new Sk.builtin.tuple([toArrayLike(cleanJS(res.values)), toArrayLike(cleanJS(res.vectors))]);
    };
    eigh_f.co_varnames = ["a"];
    $loc.eigh = new Sk.builtin.func(eigh_f);

    var eigvals_f = function (a) {
      checkArgs("eigvals", arguments, 1);
      var vals = cleanJS(eigOf(asMatrix(a, "eigvals")).values);
      return toComplexList(vals);
    };
    eigvals_f.co_varnames = ["a"];
    $loc.eigvals = new Sk.builtin.func(eigvals_f);

    var eigvalsh_f = function (a) {
      checkArgs("eigvalsh", arguments, 1);
      return toArrayLike(cleanJS(eigOf(asMatrix(a, "eigvalsh")).values));
    };
    eigvalsh_f.co_varnames = ["a"];
    $loc.eigvalsh = new Sk.builtin.func(eigvalsh_f);

    var cholesky_f = function (a, lower) {
      checkArgs("cholesky", arguments, 1, 2);
      var L = choleskyDecompose(asMatrix(a, "cholesky"));
      var isLower = (lower !== undefined && !Sk.builtin.checkNone(lower)) ? Sk.misceval.isTrue(lower) : true;
      return toArrayLike(isLower ? L : transpose(L));
    };
    cholesky_f.co_varnames = ["a", "lower"];
    $loc.cholesky = new Sk.builtin.func(cholesky_f);

    var lu_f = function (a) {
      checkArgs("lu", arguments, 1);
      var A = asMatrix(a, "lu");
      var n = A.length;
      var res = luDecompose(A);
      var L = eyeMat(n), U = zerosMat(n, n);
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          if (j < i) L[i][j] = res.LU[i][j];
          else U[i][j] = res.LU[i][j];
        }
      }
      var P = zerosMat(n, n);
      for (var r = 0; r < n; r++) P[r][res.piv[r]] = 1;
      return new Sk.builtin.tuple([toArrayLike(transpose(P)), toArrayLike(L), toArrayLike(U)]);
    };
    lu_f.co_varnames = ["a"];
    $loc.lu = new Sk.builtin.func(lu_f);

    var qr_f = function (a) {
      checkArgs("qr", arguments, 1);
      var A = asMatrix(a, "qr");
      var m = A.length, n = A[0].length;
      // модифікований Грам-Шмідт (стовпці A -> стовпці Q)
      var At = transpose(A); // At[j] = j-й стовпець A
      var Qcols = [], R = zerosMat(n, n);
      for (var j = 0; j < n; j++) {
        var v = At[j].slice();
        for (var i = 0; i < j; i++) {
          var r = 0;
          for (var k = 0; k < m; k++) r += Qcols[i][k] * At[j][k];
          R[i][j] = r;
          for (k = 0; k < m; k++) v[k] -= r * Qcols[i][k];
        }
        var norm = Math.sqrt(v.reduce(function (s, x) { return s + x * x; }, 0));
        R[j][j] = norm;
        Qcols.push(norm > 1e-14 ? v.map(function (x) { return x / norm; }) : v);
      }
      var Q = transpose(Qcols);
      return new Sk.builtin.tuple([toArrayLike(Q), toArrayLike(R)]);
    };
    qr_f.co_varnames = ["a"];
    $loc.qr = new Sk.builtin.func(qr_f);

    var pinv_f = function (a) {
      checkArgs("pinv", arguments, 1);
      var A = asMatrix(a, "pinv");
      var At = transpose(A);
      // (A^T A)^-1 A^T  (для A з незалежними стовпцями / m>=n)
      var AtA = matMul(At, A);
      return toArrayLike(matMul(inverse(AtA), At));
    };
    pinv_f.co_varnames = ["a"];
    $loc.pinv = new Sk.builtin.func(pinv_f);

    $loc.norm.__doc__ = new Sk.builtin.str("norm(x, ord=None): векторна (L1/L2/Linf/Lp) або матрична (Фробеніус) норма.");
  });

  /* ============================================================ */
  /*  scipy.optimize                                                */
  /* ============================================================ */

  function makeResultObject(name, dict) {
    var Cls = Sk.misceval.buildClass(mod, function ($gbl, $loc) {
      $loc.__init__ = new Sk.builtin.func(function (self) {
        for (var key in dict) {
          if (dict.hasOwnProperty(key)) {
            Sk.abstr.sattr(self, new Sk.builtin.str(key), dict[key], true);
          }
        }
        return Sk.builtin.none.none$;
      });
      $loc.__repr__ = new Sk.builtin.func(function (self) {
        var parts = [];
        for (var key in dict) {
          if (dict.hasOwnProperty(key)) {
            parts.push(key + "=" + Sk.misceval.objectRepr(Sk.abstr.gattr(self, new Sk.builtin.str(key))));
          }
        }
        return new Sk.builtin.str(name + "(" + parts.join(", ") + ")");
      });
      // Реальні результати SciPy (pearsonr, ttest, ...) часто є
      // namedtuple-подібними — підтримують і .attr, і розпакування
      // `a, b = f(...)`. Додаємо __iter__/__getitem__/__len__, щоб
      // розпакування теж працювало, а не тільки атрибутний доступ.
      var keys = Object.keys(dict);
      $loc.__iter__ = new Sk.builtin.func(function (self) {
        var vals = keys.map(function (k) { return Sk.abstr.gattr(self, new Sk.builtin.str(k)); });
        return new Sk.builtin.tuple(vals).tp$iter();
      });
      $loc.__getitem__ = new Sk.builtin.func(function (self, idx) {
        var vals = keys.map(function (k) { return Sk.abstr.gattr(self, new Sk.builtin.str(k)); });
        return new Sk.builtin.tuple(vals).mp$subscript(idx);
      });
      $loc.__len__ = new Sk.builtin.func(function (self) {
        return new Sk.builtin.int_(keys.length);
      });
    }, name, []);
    return Sk.misceval.callsim(Cls);
  }

  function bisectRoot(f, a, b, tol, maxiter) {
    var fa = f(a), fb = f(b);
    if (fa * fb > 0) {
      throw ValueError("f(a) and f(b) must have opposite signs");
    }
    var mid = a;
    for (var i = 0; i < maxiter; i++) {
      mid = (a + b) / 2;
      var fm = f(mid);
      if (Math.abs(fm) < tol || (b - a) / 2 < tol) return { x: mid, iters: i, converged: true };
      if (fa * fm < 0) { b = mid; fb = fm; } else { a = mid; fa = fm; }
    }
    return { x: mid, iters: maxiter, converged: false };
  }

  function brentqRoot(f, a, b, tol, maxiter) {
    var fa = f(a), fb = f(b);
    if (fa * fb > 0) throw ValueError("f(a) and f(b) must have opposite signs");
    var c = a, fc = fa, d = b - a, e = d;
    for (var iter = 0; iter < maxiter; iter++) {
      if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
      var tolAct = 2 * 1e-16 * Math.abs(b) + tol / 2;
      var xm = (c - b) / 2;
      if (Math.abs(xm) <= tolAct || fb === 0) return { x: b, iters: iter, converged: true };
      if (Math.abs(e) >= tolAct && Math.abs(fa) > Math.abs(fb)) {
        var s = fb / fa, p, q;
        if (a === c) { p = 2 * xm * s; q = 1 - s; }
        else {
          var qv = fa / fc, r = fb / fc;
          p = s * (2 * xm * qv * (qv - r) - (b - a) * (r - 1));
          q = (qv - 1) * (r - 1) * (s - 1);
        }
        if (p > 0) q = -q; else p = -p;
        if (2 * p < Math.min(3 * xm * q - Math.abs(tolAct * q), Math.abs(e * q))) {
          e = d; d = p / q;
        } else { d = xm; e = d; }
      } else { d = xm; e = d; }
      a = b; fa = fb;
      b += Math.abs(d) > tolAct ? d : (xm > 0 ? tolAct : -tolAct);
      fb = f(b);
      if ((fb > 0) === (fc > 0)) { c = a; fc = fa; d = b - a; e = d; }
    }
    return { x: b, iters: maxiter, converged: false };
  }

  function newtonRoot(f, x0, fprime, tol, maxiter) {
    var x = x0;
    for (var i = 0; i < maxiter; i++) {
      var fx = f(x);
      if (Math.abs(fx) < tol) return { x: x, iters: i, converged: true };
      var dfx = fprime ? fprime(x) : (f(x + 1e-8) - fx) / 1e-8;
      if (dfx === 0) break;
      var xNew = x - fx / dfx;
      if (Math.abs(xNew - x) < tol) return { x: xNew, iters: i, converged: true };
      x = xNew;
    }
    return { x: x, iters: maxiter, converged: false };
  }

  function goldenSectionMin(f, a, b, tol, maxiter) {
    var gr = (Math.sqrt(5) - 1) / 2;
    var c = b - gr * (b - a), d = a + gr * (b - a);
    var fc = f(c), fd = f(d);
    for (var i = 0; i < maxiter && Math.abs(b - a) > tol; i++) {
      if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); }
      else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
    }
    var x = (a + b) / 2;
    return { x: x, fun: f(x) };
  }

  /** Nelder-Mead для мінімізації функції n змінних (f приймає JS-масив). */
  function nelderMead(f, x0, opts) {
    var n = x0.length;
    var alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;
    var maxiter = (opts && opts.maxiter) || 200 * n;
    var tol = (opts && opts.tol) || 1e-8;

    var simplex = [x0.slice()];
    for (var i = 0; i < n; i++) {
      var p = x0.slice();
      p[i] += (p[i] !== 0 ? 0.05 * p[i] : 0.00025);
      simplex.push(p);
    }
    var fvals = simplex.map(f);

    for (var iter = 0; iter < maxiter; iter++) {
      var order = fvals.map(function (v, idx) { return idx; }).sort(function (a, b) { return fvals[a] - fvals[b]; });
      simplex = order.map(function (idx) { return simplex[idx]; });
      fvals = order.map(function (idx) { return fvals[idx]; });

      if (Math.abs(fvals[n] - fvals[0]) < tol) break;

      var centroid = new Array(n).fill(0);
      for (i = 0; i < n; i++) {
        for (var d = 0; d < n; d++) centroid[d] += simplex[i][d] / n;
      }

      var worst = simplex[n];
      var xr = centroid.map(function (c, d) { return c + alpha * (c - worst[d]); });
      var fr = f(xr);

      if (fr < fvals[0]) {
        var xe = centroid.map(function (c, d) { return c + gamma * (xr[d] - c); });
        var fe = f(xe);
        if (fe < fr) { simplex[n] = xe; fvals[n] = fe; } else { simplex[n] = xr; fvals[n] = fr; }
      } else if (fr < fvals[n - 1]) {
        simplex[n] = xr; fvals[n] = fr;
      } else {
        var xc = centroid.map(function (c, d) { return c + rho * (worst[d] - c); });
        var fc = f(xc);
        if (fc < fvals[n]) { simplex[n] = xc; fvals[n] = fc; }
        else {
          for (i = 1; i <= n; i++) {
            simplex[i] = simplex[i].map(function (v, d) { return simplex[0][d] + sigma * (v - simplex[0][d]); });
            fvals[i] = f(simplex[i]);
          }
        }
      }
    }

    var order2 = fvals.map(function (v, idx) { return idx; }).sort(function (a, b) { return fvals[a] - fvals[b]; });
    return { x: simplex[order2[0]], fun: fvals[order2[0]], iters: iter };
  }

  mod.optimize = makeNamespace("scipy.optimize", function ($loc) {
    var bisect_f = function (_kw, func, a, b) {
      var props = parseKw(_kw);
      var tol = toJS(kwOr(props, "xtol", new Sk.builtin.float_(1e-10)));
      var maxiter = toJS(kwOr(props, "maxiter", new Sk.builtin.int_(200)));
      var jf = function (x) { return callScalarFn(func, [x]); };
      var r = bisectRoot(jf, toJS(a), toJS(b), tol, maxiter);
      return new Sk.builtin.float_(r.x);
    };
    bisect_f.co_kwargs = true;
    bisect_f.co_varnames = ["func", "a", "b"];
    $loc.bisect = new Sk.builtin.func(bisect_f);

    var brentq_f = function (_kw, func, a, b) {
      var props = parseKw(_kw);
      var tol = toJS(kwOr(props, "xtol", new Sk.builtin.float_(2e-12)));
      var maxiter = toJS(kwOr(props, "maxiter", new Sk.builtin.int_(100)));
      var jf = function (x) { return callScalarFn(func, [x]); };
      var r = brentqRoot(jf, toJS(a), toJS(b), tol, maxiter);
      return new Sk.builtin.float_(r.x);
    };
    brentq_f.co_kwargs = true;
    brentq_f.co_varnames = ["func", "a", "b"];
    $loc.brentq = new Sk.builtin.func(brentq_f);

    var newton_f = function (_kw, func, x0) {
      var props = parseKw(_kw);
      var fprimePy = kwOr(props, "fprime", null);
      var tol = toJS(kwOr(props, "tol", new Sk.builtin.float_(1.48e-8)));
      var maxiter = toJS(kwOr(props, "maxiter", new Sk.builtin.int_(50)));
      var jf = function (x) { return callScalarFn(func, [x]); };
      var jfp = fprimePy ? function (x) { return callScalarFn(fprimePy, [x]); } : null;
      var r = newtonRoot(jf, toJS(x0), jfp, tol, maxiter);
      return new Sk.builtin.float_(r.x);
    };
    newton_f.co_kwargs = true;
    newton_f.co_varnames = ["func", "x0"];
    $loc.newton = new Sk.builtin.func(newton_f);

    var root_scalar_f = function (_kw, func) {
      var props = parseKw(_kw);
      var method = props.method ? Sk.ffi.remapToJs(props.method).toLowerCase() : "brentq";
      var jf = function (x) { return callScalarFn(func, [x]); };
      var res;
      if (method === "bisect") {
        var br = toJS(props.bracket);
        res = bisectRoot(jf, br[0], br[1], 1e-10, 200);
      } else if (method === "newton") {
        res = newtonRoot(jf, toJS(props.x0), null, 1.48e-8, 50);
      } else {
        var br2 = toJS(props.bracket);
        res = brentqRoot(jf, br2[0], br2[1], 2e-12, 100);
      }
      return makeResultObject("RootResults", {
        root: new Sk.builtin.float_(res.x),
        iterations: new Sk.builtin.int_(res.iters),
        converged: new Sk.builtin.bool(res.converged !== false)
      });
    };
    root_scalar_f.co_kwargs = true;
    root_scalar_f.co_varnames = ["func"];
    $loc.root_scalar = new Sk.builtin.func(root_scalar_f);

    var minimize_scalar_f = function (_kw, func) {
      var props = parseKw(_kw);
      var bracket = props.bracket ? toJS(props.bracket) : (props.bounds ? toJS(props.bounds) : [-10, 10]);
      var jf = function (x) { return callScalarFn(func, [x]); };
      var r = goldenSectionMin(jf, bracket[0], bracket[bracket.length - 1], 1e-8, 500);
      return makeResultObject("OptimizeResult", {
        x: new Sk.builtin.float_(r.x),
        fun: new Sk.builtin.float_(r.fun),
        success: new Sk.builtin.bool(true)
      });
    };
    minimize_scalar_f.co_kwargs = true;
    minimize_scalar_f.co_varnames = ["func"];
    $loc.minimize_scalar = new Sk.builtin.func(minimize_scalar_f);

    var minimize_f = function (_kw, func, x0) {
      var x0js = toJS(x0);
      if (!Array.isArray(x0js)) x0js = [x0js];
      var jf2 = function (xArr) {
        var pyVec = fromJS(xArr);
        var res = Sk.misceval.callsim(func, pyVec);
        return toJS(res);
      };
      var r = nelderMead(jf2, x0js, {});
      return makeResultObject("OptimizeResult", {
        x: toArrayLike(r.x),
        fun: new Sk.builtin.float_(r.fun),
        nit: new Sk.builtin.int_(r.iters),
        success: new Sk.builtin.bool(true)
      });
    };
    minimize_f.co_kwargs = true;
    minimize_f.co_varnames = ["func", "x0"];
    $loc.minimize = new Sk.builtin.func(minimize_f);

    /* curve_fit: найменші квадрати методом Гаусса-Ньютона з чисельним якобіаном */
    var curve_fit_f = function (_kw, f, xdata, ydata) {
      var props = parseKw(_kw);
      var xs = toJS(xdata), ys = toJS(ydata);
      var p0 = props.p0 ? toJS(props.p0) : [1.0];
      if (!Array.isArray(p0)) p0 = [p0];
      var nParams = p0.length;

      function residuals(p) {
        var pyParams = p.map(function (v) { return new Sk.builtin.float_(v); });
        var r = [];
        for (var i = 0; i < xs.length; i++) {
          var args = [new Sk.builtin.float_(xs[i])].concat(pyParams);
          var yPred = toJS(Sk.misceval.callsim.apply(null, [f].concat(args)));
          r.push(ys[i] - yPred);
        }
        return r;
      }

      var p = p0.slice();
      for (var iter = 0; iter < 200; iter++) {
        var r0 = residuals(p);
        // числовий якобіан (n_data x n_params)
        var J = [];
        for (var i = 0; i < xs.length; i++) J.push(new Array(nParams).fill(0));
        var eps = 1e-6;
        for (var j = 0; j < nParams; j++) {
          var pj = p.slice();
          pj[j] += eps;
          var rj = residuals(pj);
          for (i = 0; i < xs.length; i++) J[i][j] = -(rj[i] - r0[i]) / eps;
        }
        var Jt = transpose(J);
        var JtJ = matMul(Jt, J);
        for (j = 0; j < nParams; j++) JtJ[j][j] += 1e-10; // регуляризація
        var Jtr = matVec(Jt, r0);
        var delta;
        try { delta = linSolve(JtJ, Jtr); } catch (e) { break; }
        // ВАЖЛИВО: J тут — якобіан f (не залишку r=y-f), тому JtJ*delta=Jtr
        // вже дає ПРАВИЛЬНИЙ адитивний крок Гауса-Ньютона: p_new = p + delta.
        // Було: p - delta — це розвертало напрям кроку на 180°, і ітерації
        // розбігалися до -/+ мільярдів замість збіжності (баг, що спричиняв
        // curve_fit -> [-21926693806.97353, -18788239326.38564] замість [2, 1]).
        var newP = p.map(function (v, idx) { return v + delta[idx]; });
        var diff = 0;
        for (j = 0; j < nParams; j++) diff += Math.abs(newP[j] - p[j]);
        p = newP;
        if (diff < 1e-12) break;
      }
      return new Sk.builtin.tuple([toArrayLike(p), toArrayLike(eyeMat(nParams))]);
    };
    curve_fit_f.co_kwargs = true;
    curve_fit_f.co_varnames = ["f", "xdata", "ydata"];
    $loc.curve_fit = new Sk.builtin.func(curve_fit_f);
  });

  /* ============================================================ */
  /*  scipy.integrate                                               */
  /* ============================================================ */

  /**
   * Адаптивна квадратура Сімпсона (рекурсивна).
   * Повертає {value, error}: value — уточнене (Річардсонівська екстраполяція)
   * значення інтеграла на [a,b], error — сума модулів локальних поправок
   * (те саме "|S(a,b) - S(a,m) - S(m,b)| / 15", яке правило Сімпсона
   * використовує як оцінку власної похибки на кожній ділянці). Раніше
   * quad() ігнорував це число і завжди повертав фіксоване error=1e-9
   * незалежно від фактичної точності — тепер похибка результату
   * повністю обчислюється, як і в scipy.integrate.quad.
   */
  function adaptiveSimpson(f, a, b, eps, whole, fa, fb, fm, depth) {
    var m = (a + b) / 2;
    var lm = (a + m) / 2, rm = (m + b) / 2;
    var flm = f(lm), frm = f(rm);
    var left = (m - a) / 6 * (fa + 4 * flm + fm);
    var right = (b - m) / 6 * (fm + 4 * frm + fb);
    var sum = left + right;
    var correction = (sum - whole) / 15;
    if (depth <= 0 || Math.abs(sum - whole) <= 15 * eps) {
      return { value: sum + correction, error: Math.abs(correction) };
    }
    var l = adaptiveSimpson(f, a, m, eps / 2, left, fa, fm, flm, depth - 1);
    var r = adaptiveSimpson(f, m, b, eps / 2, right, fm, fb, frm, depth - 1);
    return { value: l.value + r.value, error: l.error + r.error };
  }

  function quad(f, a, b) {
    if (a === b) return { value: 0, error: 0 };
    var neg = false;
    if (a > b) { var t = a; a = b; b = t; neg = true; }
    var fa = f(a), fb = f(b), m = (a + b) / 2, fm = f(m);
    var whole = (b - a) / 6 * (fa + 4 * fm + fb);
    var r = adaptiveSimpson(f, a, b, 1e-10, whole, fa, fb, fm, 50);
    return { value: neg ? -r.value : r.value, error: r.error };
  }

  function simpsonComposite(y, dx) {
    var n = y.length - 1;
    if (n < 1) return 0;
    if (n % 2 === 1) {
      // непарна кількість інтервалів: остання ділянка трапецією
      var head = simpsonComposite(y.slice(0, n), dx);
      return head + dx * (y[n - 1] + y[n]) / 2;
    }
    var s = y[0] + y[n];
    for (var i = 1; i < n; i++) s += (i % 2 === 0 ? 2 : 4) * y[i];
    return s * dx / 3;
  }

  function trapezoidComposite(y, xOrDx) {
    var s = 0;
    if (Array.isArray(xOrDx)) {
      for (var i = 0; i < y.length - 1; i++) s += (xOrDx[i + 1] - xOrDx[i]) * (y[i] + y[i + 1]) / 2;
    } else {
      for (var i2 = 0; i2 < y.length - 1; i2++) s += xOrDx * (y[i2] + y[i2 + 1]) / 2;
    }
    return s;
  }

  /** Розв'язання dy/dt = f(y, t) методом Рунге-Кутти 4-го порядку (сумісно зі scipy.integrate.odeint). */
  function rk4Solve(fJs, y0, tArr) {
    var ys = [y0.slice ? y0.slice() : [y0]];
    var isScalar = !Array.isArray(y0);
    if (isScalar) ys = [[y0]];

    function addScaled(a, b, h) { return a.map(function (v, i) { return v + h * b[i]; }); }

    for (var i = 0; i < tArr.length - 1; i++) {
      var tStart = tArr[i], tEnd = tArr[i + 1];
      var span = tEnd - tStart;
      // Один крок RK4 на весь запитаний інтервал дає надто грубу похибку
      // (помітну вже в 4-му знаку). Реальні розв'язувачі scipy (LSODA/RK45)
      // підбирають крок адаптивно; тут імітуємо це фіксованою кількістю
      // внутрішніх підкроків, достатньою для похибки ~1e-10..1e-12.
      var nSub = Math.min(2000, Math.max(1, Math.ceil(Math.abs(span) / 1e-3)));
      var h = span / nSub;
      var t = tStart;
      var y = ys[ys.length - 1];
      for (var s = 0; s < nSub; s++) {
        var k1 = fJs(y, t);
        var k2 = fJs(addScaled(y, k1, h / 2), t + h / 2);
        var k3 = fJs(addScaled(y, k2, h / 2), t + h / 2);
        var k4 = fJs(addScaled(y, k3, h), t + h);
        y = y.map(function (v, idx) {
          return v + h / 6 * (k1[idx] + 2 * k2[idx] + 2 * k3[idx] + k4[idx]);
        });
        t += h;
      }
      ys.push(y);
    }
    return isScalar ? ys.map(function (v) { return v[0]; }) : ys;
  }

  mod.integrate = makeNamespace("scipy.integrate", function ($loc) {
    var quad_f = function (func, a, b) {
      checkArgs("quad", arguments, 3);
      var jf = function (x) { return callScalarFn(func, [x]); };
      var r = quad(jf, toJS(a), toJS(b));
      return new Sk.builtin.tuple([new Sk.builtin.float_(r.value), new Sk.builtin.float_(r.error)]);
    };
    quad_f.co_varnames = ["func", "a", "b"];
    $loc.quad = new Sk.builtin.func(quad_f);

    var simpson_f = function (_kw, y) {
      var props = parseKw(_kw);
      var yJs = toJS(y);
      var dx = props.dx !== undefined ? toJS(props.dx) : 1.0;
      return new Sk.builtin.float_(simpsonComposite(yJs, dx));
    };
    simpson_f.co_kwargs = true;
    simpson_f.co_varnames = ["y"];
    $loc.simpson = new Sk.builtin.func(simpson_f);
    $loc.simps = $loc.simpson;

    var trapezoid_f = function (_kw, y) {
      var props = parseKw(_kw);
      var yJs = toJS(y);
      var xOrDx;
      if (props.x !== undefined && !Sk.builtin.checkNone(props.x)) xOrDx = toJS(props.x);
      else if (props.dx !== undefined) xOrDx = toJS(props.dx);
      else xOrDx = 1.0;
      return new Sk.builtin.float_(trapezoidComposite(yJs, xOrDx));
    };
    trapezoid_f.co_kwargs = true;
    trapezoid_f.co_varnames = ["y"];
    $loc.trapezoid = new Sk.builtin.func(trapezoid_f);
    $loc.trapz = $loc.trapezoid;

    var odeint_f = function (func, y0, t) {
      checkArgs("odeint", arguments, 3);
      var y0js = toJS(y0);
      var tJs = toJS(t);
      var fJs = function (yArr, tVal) {
        var pyY = isMatrixOrVec(yArr) ? fromJS(yArr) : new Sk.builtin.float_(yArr);
        var res = Sk.misceval.callsim(func, pyY, new Sk.builtin.float_(tVal));
        var jsRes = toJS(res);
        return Array.isArray(jsRes) ? jsRes : [jsRes];
      };
      function isMatrixOrVec(v) { return Array.isArray(v); }
      var y0Arr = Array.isArray(y0js) ? y0js : [y0js];
      var wrapped = function (yArr, tVal) { return fJs(Array.isArray(y0js) ? yArr : yArr[0], tVal); };
      var ys = rk4Solve(wrapped, y0Arr, tJs);
      return toArrayLike(ys);
    };
    odeint_f.co_varnames = ["func", "y0", "t"];
    $loc.odeint = new Sk.builtin.func(odeint_f);

    /* solve_ivp(fun, t_span, y0, t_eval=None) — фіксований крок RK4 */
    var solve_ivp_f = function (_kw, fun, t_span, y0) {
      var props = parseKw(_kw);
      var span = toJS(t_span);
      var y0js = toJS(y0);
      if (!Array.isArray(y0js)) y0js = [y0js];
      var tEval;
      if (props.t_eval && !Sk.builtin.checkNone(props.t_eval)) {
        tEval = toJS(props.t_eval);
      } else {
        var nSteps = 100;
        tEval = [];
        for (var i = 0; i <= nSteps; i++) tEval.push(span[0] + (span[1] - span[0]) * i / nSteps);
      }
      var fJs = function (yArr, tVal) {
        var res = Sk.misceval.callsim(fun, new Sk.builtin.float_(tVal), fromJS(yArr));
        return toJS(res);
      };
      var ys = rk4Solve(fJs, y0js, tEval);
      var ysT = transpose(ys); // scipy повертає y як (n_states, n_times)
      return makeResultObject("OdeResult", {
        t: toArrayLike(tEval),
        y: toArrayLike(ysT),
        success: new Sk.builtin.bool(true)
      });
    };
    solve_ivp_f.co_kwargs = true;
    solve_ivp_f.co_varnames = ["fun", "t_span", "y0"];
    $loc.solve_ivp = new Sk.builtin.func(solve_ivp_f);
  });

  /* ============================================================ */
  /*  scipy.stats                                                   */
  /* ============================================================ */

  /**
   * Регуляризована неповна бета-функція I_x(a,b) (continued-fraction,
   * алгоритм Лентца, як у Numerical Recipes). Потрібна для точного
   * p-value t-розподілу (pearsonr, ttest_1samp) — попередня версія
   * апроксимувала t-розподіл нормальним, що для великих |t| (r близьке
   * до ±1) давало p=0.0 замість коректного дуже малого числа.
   */
  function betacf(a, b, x) {
    var MAXIT = 200, EPS = 3e-16, FPMIN = 1e-300;
    var qab = a + b, qap = a + 1, qam = a - 1;
    var c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= MAXIT; m++) {
      var m2 = 2 * m;
      var aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(gammalnFn(a + b) - gammalnFn(a) - gammalnFn(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  /** P(T > t) для двобічного t-розподілу з df ступенями свободи (t може бути будь-якого знаку). */
  function tSf(t, df) {
    if (t <= 0) return 1 - tSf(-t, df);
    var x = df / (df + t * t);
    return 0.5 * betai(df / 2, 0.5, x);
  }

  function normPdf(x, mu, sigma) {
    return Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI));
  }
  function normCdf(x, mu, sigma) {
    return 0.5 * (1 + erfFn((x - mu) / (sigma * Math.sqrt(2))));
  }
  function normPpf(p, mu, sigma) {
    // раціональна апроксимація Acklam для оберненого нормального CDF
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
      3.754408661907416e+00];
    var plow = 0.02425, phigh = 1 - plow, q, r, z;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= phigh) {
      q = p - 0.5; r = q * q;
      z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    return mu + sigma * z;
  }

  function boxMullerNormal() {
    var u1 = Math.random() || 1e-12, u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Повертає int, якщо значення ціле (як зберігає numpy dtype для цілочисельного входу), інакше float. */
  function toPyNum(v) {
    if (v === Math.floor(v) && Math.abs(v) < 1e15) return new Sk.builtin.int_(v);
    return new Sk.builtin.float_(v);
  }

  function meanOf(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function varOf(a, ddof) {
    var m = meanOf(a);
    var s = a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0);
    return s / (a.length - (ddof || 0));
  }
  function stdOf(a, ddof) { return Math.sqrt(varOf(a, ddof)); }

  function makeContinuousDist(name, pdf, cdf, ppf, rvs) {
    return makeNamespace("scipy.stats." + name, function ($loc) {
      var pdf_f = function (_kw, x) {
        var props = parseKw(_kw);
        var loc = toJS(kwOr(props, "loc", new Sk.builtin.float_(0)));
        var scale = toJS(kwOr(props, "scale", new Sk.builtin.float_(1)));
        var v = toJS(x);
        function apply(v) { return Array.isArray(v) ? v.map(apply) : pdf(v, loc, scale) / scale; }
        var r = apply(v);
        return Array.isArray(v) ? toArrayLike(r) : new Sk.builtin.float_(r);
      };
      pdf_f.co_kwargs = true; pdf_f.co_varnames = ["x"];
      $loc.pdf = new Sk.builtin.func(pdf_f);

      var cdf_f = function (_kw, x) {
        var props = parseKw(_kw);
        var loc = toJS(kwOr(props, "loc", new Sk.builtin.float_(0)));
        var scale = toJS(kwOr(props, "scale", new Sk.builtin.float_(1)));
        var v = toJS(x);
        function apply(v) { return Array.isArray(v) ? v.map(apply) : cdf(v, loc, scale); }
        var r = apply(v);
        return Array.isArray(v) ? toArrayLike(r) : new Sk.builtin.float_(r);
      };
      cdf_f.co_kwargs = true; cdf_f.co_varnames = ["x"];
      $loc.cdf = new Sk.builtin.func(cdf_f);

      var ppf_f = function (_kw, q) {
        var props = parseKw(_kw);
        var loc = toJS(kwOr(props, "loc", new Sk.builtin.float_(0)));
        var scale = toJS(kwOr(props, "scale", new Sk.builtin.float_(1)));
        var v = toJS(q);
        function apply(v) { return Array.isArray(v) ? v.map(apply) : ppf(v, loc, scale); }
        var r = apply(v);
        return Array.isArray(v) ? toArrayLike(r) : new Sk.builtin.float_(r);
      };
      ppf_f.co_kwargs = true; ppf_f.co_varnames = ["q"];
      $loc.ppf = new Sk.builtin.func(ppf_f);

      var rvs_f = function () {
        var props = parseKw(arguments[0]);
        var posArgs = Array.prototype.slice.call(arguments, 1);
        var loc = posArgs[0] !== undefined ? toJS(posArgs[0]) : toJS(kwOr(props, "loc", new Sk.builtin.float_(0)));
        var scale = posArgs[1] !== undefined ? toJS(posArgs[1]) : toJS(kwOr(props, "scale", new Sk.builtin.float_(1)));
        var size = posArgs[2] !== undefined ? toJS(posArgs[2]) :
          (props.size !== undefined && !Sk.builtin.checkNone(props.size) ? toJS(props.size) : 1);
        var out = [];
        var n = Array.isArray(size) ? size.reduce(function (a, b) { return a * b; }, 1) : size;
        for (var i = 0; i < n; i++) out.push(rvs(loc, scale));
        if (size === 1) return new Sk.builtin.float_(out[0]);
        return toArrayLike(out);
      };
      rvs_f.co_kwargs = true;
      $loc.rvs = new Sk.builtin.func(rvs_f);

      var mean_f = function () {
        var props = parseKw(arguments[0]);
        var posArgs = Array.prototype.slice.call(arguments, 1);
        var loc = posArgs[0] !== undefined ? toJS(posArgs[0]) : toJS(kwOr(props, "loc", new Sk.builtin.float_(0)));
        return new Sk.builtin.float_(loc);
      };
      mean_f.co_kwargs = true;
      $loc.mean = new Sk.builtin.func(mean_f);
    });
  }

  mod.stats = makeNamespace("scipy.stats", function ($loc) {
    $loc.norm = makeContinuousDist("norm",
      function (x, loc, scale) { return normPdf(x, loc, scale) * scale; },
      function (x, loc, scale) { return normCdf(x, loc, scale); },
      function (q, loc, scale) { return normPpf(q, loc, scale); },
      function (loc, scale) { return loc + scale * boxMullerNormal(); });

    $loc.uniform = makeContinuousDist("uniform",
      function (x, loc, scale) { return (x >= loc && x <= loc + scale) ? 1 / scale * scale : 0; },
      function (x, loc, scale) { return Math.min(1, Math.max(0, (x - loc) / scale)); },
      function (q, loc, scale) { return loc + q * scale; },
      function (loc, scale) { return loc + Math.random() * scale; });

    $loc.expon = makeContinuousDist("expon",
      function (x, loc, scale) { return x >= loc ? Math.exp(-(x - loc) / scale) / scale * scale : 0; },
      function (x, loc, scale) { return x >= loc ? 1 - Math.exp(-(x - loc) / scale) : 0; },
      function (q, loc, scale) { return loc - scale * Math.log(1 - q); },
      function (loc, scale) { return loc - scale * Math.log(1 - Math.random()); });

    var describe_f = function (a) {
      checkArgs("describe", arguments, 1);
      var v = toJS(a);
      var n = v.length, m = meanOf(v), variance = varOf(v, 1);
      var s3 = v.reduce(function (s, x) { return s + Math.pow(x - m, 3); }, 0) / n;
      var s2 = varOf(v, 0);
      var skew = s3 / Math.pow(s2, 1.5);
      var s4 = v.reduce(function (s, x) { return s + Math.pow(x - m, 4); }, 0) / n;
      var kurt = s4 / (s2 * s2) - 3;
      return makeResultObject("DescribeResult", {
        nobs: new Sk.builtin.int_(n),
        minmax: new Sk.builtin.tuple([toPyNum(Math.min.apply(null, v)), toPyNum(Math.max.apply(null, v))]),
        mean: new Sk.builtin.float_(m),
        variance: new Sk.builtin.float_(variance),
        skewness: new Sk.builtin.float_(skew),
        kurtosis: new Sk.builtin.float_(kurt)
      });
    };
    describe_f.co_varnames = ["a"];
    $loc.describe = new Sk.builtin.func(describe_f);

    var zscore_f = function (a) {
      checkArgs("zscore", arguments, 1);
      var v = toJS(a);
      var m = meanOf(v), s = stdOf(v, 0);
      return toArrayLike(v.map(function (x) { return (x - m) / s; }));
    };
    zscore_f.co_varnames = ["a"];
    $loc.zscore = new Sk.builtin.func(zscore_f);

    var sem_f = function (a) {
      checkArgs("sem", arguments, 1);
      var v = toJS(a);
      return new Sk.builtin.float_(stdOf(v, 1) / Math.sqrt(v.length));
    };
    sem_f.co_varnames = ["a"];
    $loc.sem = new Sk.builtin.func(sem_f);

    var pearsonr_f = function (x, y) {
      checkArgs("pearsonr", arguments, 2);
      var vx = toJS(x), vy = toJS(y);
      var mx = meanOf(vx), my = meanOf(vy);
      var num = 0, dx = 0, dy = 0;
      for (var i = 0; i < vx.length; i++) {
        num += (vx[i] - mx) * (vy[i] - my);
        dx += (vx[i] - mx) * (vx[i] - mx);
        dy += (vy[i] - my) * (vy[i] - my);
      }
      var r = num / Math.sqrt(dx * dy);
      var n = vx.length;
      var df = n - 2;
      var pValue;
      if (df <= 0) {
        pValue = 1.0;
      } else if (Math.abs(r) >= 1) {
        pValue = 0.0;
      } else {
        var t = r * Math.sqrt(df / (1 - r * r));
        // точне p-value через t-розподіл (регуляризована неповна бета),
        // а не нормальне наближення — те давало p=0.0 (замість ~1.3e-08)
        // для r близького до ±1, оскільки normCdf насичувалась до 1.0.
        pValue = 2 * tSf(Math.abs(t), df);
      }
      return makeResultObject("PearsonRResult", {
        statistic: new Sk.builtin.float_(r),
        pvalue: new Sk.builtin.float_(pValue)
      });
    };
    pearsonr_f.co_varnames = ["x", "y"];
    $loc.pearsonr = new Sk.builtin.func(pearsonr_f);

    var ttest_1samp_f = function (a, popmean) {
      checkArgs("ttest_1samp", arguments, 2);
      var v = toJS(a);
      var pm = toJS(popmean);
      var m = meanOf(v), se = stdOf(v, 1) / Math.sqrt(v.length);
      var t = (m - pm) / se;
      var df = v.length - 1;
      var p = df > 0 ? 2 * tSf(Math.abs(t), df) : 1.0; // точний t-розподіл замість нормального наближення
      return makeResultObject("TtestResult", {
        statistic: new Sk.builtin.float_(t),
        pvalue: new Sk.builtin.float_(p)
      });
    };
    ttest_1samp_f.co_varnames = ["a", "popmean"];
    $loc.ttest_1samp = new Sk.builtin.func(ttest_1samp_f);

    var mode_f = function (a) {
      checkArgs("mode", arguments, 1);
      var v = toJS(a);
      var counts = {};
      v.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
      var best = v[0], bestCount = 0;
      for (var key in counts) {
        if (counts[key] > bestCount) { bestCount = counts[key]; best = parseFloat(key); }
      }
      return makeResultObject("ModeResult", {
        mode: new Sk.builtin.float_(best),
        count: new Sk.builtin.int_(bestCount)
      });
    };
    mode_f.co_varnames = ["a"];
    $loc.mode = new Sk.builtin.func(mode_f);
  });

  /* ============================================================ */
  /*  scipy.fft                                                     */
  /* ============================================================ */

  /** Дискретне перетворення Фур'є (O(n^2), працює для будь-якого n). Вхід: [re,...], опційно [im,...]. */
  function dft(reArr, imArr, invert) {
    var n = reArr.length;
    var outRe = new Array(n).fill(0), outIm = new Array(n).fill(0);
    var sign = invert ? 1 : -1;
    for (var k = 0; k < n; k++) {
      var sr = 0, si = 0;
      for (var t = 0; t < n; t++) {
        var angle = sign * 2 * Math.PI * k * t / n;
        var cosA = Math.cos(angle), sinA = Math.sin(angle);
        sr += reArr[t] * cosA - imArr[t] * sinA;
        si += reArr[t] * sinA + imArr[t] * cosA;
      }
      outRe[k] = sr; outIm[k] = si;
    }
    if (invert) {
      for (var i = 0; i < n; i++) { outRe[i] /= n; outIm[i] /= n; }
    }
    // Пряме підсумовування через Math.cos/Math.sin (Math.PI — лише
    // наближення π) залишає "шум" ~1e-15..1e-16 навіть там, де точний
    // результат — ціле число (напр. -1.9999999999999996 замість -2.0).
    // Справжній numpy.fft отримує чисті значення завдяки іншому,
    // чисельно точнішому алгоритму (Cooley-Tukey для степенів двійки
    // взагалі обходиться без тригонометрії на базових кроках) і своєму
    // repr з обмеженою кількістю значущих цифр. Тут імітуємо той самий
    // ефект тим самим прийомом, що вже використовується в лінійній
    // алгебрі цього файлу (див. cleanJS вище) — округленням до 1e-12.
    return { re: cleanJS(outRe), im: cleanJS(outIm) };
  }

  function complexList(re, im) {
    var out = [];
    for (var i = 0; i < re.length; i++) {
      try {
        out.push(new Sk.builtin.complex(new Sk.builtin.float_(re[i]), new Sk.builtin.float_(im[i])));
      } catch (e) {
        out.push(new Sk.builtin.tuple([new Sk.builtin.float_(re[i]), new Sk.builtin.float_(im[i])]));
      }
    }
    return new Sk.builtin.list(out);
  }

  function splitComplexInput(x) {
    var v = toJS(x);
    var re = [], im = [];
    for (var i = 0; i < v.length; i++) {
      if (Array.isArray(v[i])) { re.push(v[i][0]); im.push(v[i][1] || 0); }
      else { re.push(v[i]); im.push(0); }
    }
    return { re: re, im: im };
  }

  mod.fft = makeNamespace("scipy.fft", function ($loc) {
    var fft_f = function (x) {
      checkArgs("fft", arguments, 1);
      var c = splitComplexInput(x);
      var r = dft(c.re, c.im, false);
      return complexList(r.re, r.im);
    };
    fft_f.co_varnames = ["x"];
    $loc.fft = new Sk.builtin.func(fft_f);

    var ifft_f = function (x) {
      checkArgs("ifft", arguments, 1);
      var c = splitComplexInput(x);
      var r = dft(c.re, c.im, true);
      return complexList(r.re, r.im);
    };
    ifft_f.co_varnames = ["x"];
    $loc.ifft = new Sk.builtin.func(ifft_f);

    var fftfreq_f = function (n, d) {
      checkArgs("fftfreq", arguments, 1, 2);
      var nn = toJS(n);
      var dd = (d !== undefined && !Sk.builtin.checkNone(d)) ? toJS(d) : 1.0;
      var out = new Array(nn);
      var half = Math.floor((nn - 1) / 2) + 1;
      for (var i = 0; i < half; i++) out[i] = i / (nn * dd);
      for (var j = half; j < nn; j++) out[j] = (j - nn) / (nn * dd);
      return toArrayLike(out);
    };
    fftfreq_f.co_varnames = ["n", "d"];
    $loc.fftfreq = new Sk.builtin.func(fftfreq_f);
  });

  /* ============================================================ */
  /*  scipy.spatial                                                 */
  /* ============================================================ */

  function euclideanDist(u, v) {
    var s = 0;
    for (var i = 0; i < u.length; i++) s += (u[i] - v[i]) * (u[i] - v[i]);
    return Math.sqrt(s);
  }
  function cityblockDist(u, v) {
    var s = 0;
    for (var i = 0; i < u.length; i++) s += Math.abs(u[i] - v[i]);
    return s;
  }
  function cosineDist(u, v) {
    var dot = 0, nu = 0, nv = 0;
    for (var i = 0; i < u.length; i++) { dot += u[i] * v[i]; nu += u[i] * u[i]; nv += v[i] * v[i]; }
    return 1 - dot / (Math.sqrt(nu) * Math.sqrt(nv));
  }
  function chebyshevDist(u, v) {
    var m = 0;
    for (var i = 0; i < u.length; i++) m = Math.max(m, Math.abs(u[i] - v[i]));
    return m;
  }

  mod.spatial = makeNamespace("scipy.spatial", function ($loc) {
    $loc.distance = makeNamespace("scipy.spatial.distance", function ($d) {
      function wrap1(fn, argNames) {
        var f = function (u, v) {
          checkArgs(argNames[0], arguments, 2);
          return new Sk.builtin.float_(fn(toJS(u), toJS(v)));
        };
        f.co_varnames = ["u", "v"];
        return new Sk.builtin.func(f);
      }
      $d.euclidean = wrap1(euclideanDist, ["euclidean"]);
      $d.cityblock = wrap1(cityblockDist, ["cityblock"]);
      $d.cosine = wrap1(cosineDist, ["cosine"]);
      $d.chebyshev = wrap1(chebyshevDist, ["chebyshev"]);

      var metricMap = { euclidean: euclideanDist, cityblock: cityblockDist, cosine: cosineDist, chebyshev: chebyshevDist };

      var cdist_f = function (_kw, XA, XB) {
        var props = parseKw(_kw);
        var metricName = props.metric ? Sk.ffi.remapToJs(props.metric) : "euclidean";
        var fn = metricMap[metricName] || euclideanDist;
        var A = toJS(XA), B = toJS(XB);
        if (!Array.isArray(A[0])) A = [A];
        if (!Array.isArray(B[0])) B = [B];
        var out = A.map(function (a) { return B.map(function (b) { return fn(a, b); }); });
        return toArrayLike(out);
      };
      cdist_f.co_kwargs = true;
      cdist_f.co_varnames = ["XA", "XB"];
      $d.cdist = new Sk.builtin.func(cdist_f);

      var pdist_f = function (_kw, X) {
        var props = parseKw(_kw);
        var metricName = props.metric ? Sk.ffi.remapToJs(props.metric) : "euclidean";
        var fn = metricMap[metricName] || euclideanDist;
        var A = toJS(X);
        var out = [];
        for (var i = 0; i < A.length; i++) {
          for (var j = i + 1; j < A.length; j++) out.push(fn(A[i], A[j]));
        }
        return toArrayLike(out);
      };
      pdist_f.co_kwargs = true;
      pdist_f.co_varnames = ["X"];
      $d.pdist = new Sk.builtin.func(pdist_f);
    });
  });

  return mod;
};
