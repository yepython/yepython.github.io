// Skulpt pandas module — danfo.js backend
// Usage: place as skulpt/src/lib/pandas/__init__.js
// Requires danfo.js loaded on the page (window.dfd)

var $builtinmodule = function (name) {
  var mod = {};

  // ─── helpers ────────────────────────────────────────────────────────────────

  function ensureDfd() {
    if (typeof window === "undefined" || !window.dfd) {
      throw new Sk.builtin.ImportError(
        new Sk.builtin.str(
          "pandas requires danfo.js to be loaded (window.dfd not found). " +
          "Add <script src=\"https://cdn.jsdelivr.net/npm/danfojs@1.2.0/lib/bundle.js\"></script> to your page."
        )
      );
    }
    return window.dfd;
  }


// Convert a JS value → Skulpt Python value
function js2py(v) {
  if (v === null || v === undefined) return Sk.builtin.none.none$;
  if (typeof v === "boolean") return new Sk.builtin.bool(v);
  if (typeof v === "number") {
    return Number.isInteger(v) ? new Sk.builtin.int_(v) : new Sk.builtin.float_(v);
  }
  if (typeof v === "string") return new Sk.builtin.str(v);
  if (Array.isArray(v)) {
    return new Sk.builtin.list(v.map(js2py));
  }
  if (v && v.$isSeries === false) return wrapDataFrame(v);
  if (v && v.$isSeries === true)  return wrapSeries(v);

  // ←←← НОВЕ: plain JS object → Python dict
  if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
    var d = new Sk.builtin.dict();
    for (var k in v) {
      if (v.hasOwnProperty(k)) {
        d.mp$ass_subscript(new Sk.builtin.str(k), js2py(v[k]));
      }
    }
    return d;
  }

  return new Sk.builtin.str(String(v));
}

  // Convert Skulpt Python value → JS value
  function py2js(v) {
    if (v === undefined || v === Sk.builtin.none.none$) return null;
    if (v instanceof Sk.builtin.bool)   return v.v;
    if (v instanceof Sk.builtin.int_)   return v.v;
    if (v instanceof Sk.builtin.float_) return v.v;
    if (v instanceof Sk.builtin.str)    return v.v;
    if (v instanceof Sk.builtin.list)   return v.v.map(py2js);
    if (v instanceof Sk.builtin.tuple)  return v.v.map(py2js);
    if (v instanceof Sk.builtin.dict) {
      var obj = {};
      // Skulpt dict internal layout differs by version:
      //   newer : v.$d  = { hash: { lhs: pyKey, rhs: pyVal } }
      //   older : v.entries = [ [pyKey, pyVal], ... ]
      //   fallback: use the public mp$keys() / mp$subscript() API
      if (v.$d && typeof v.$d === "object") {
        // newer Skulpt (1.x+)
        var internalKeys = Object.keys(v.$d);
        for (var i = 0; i < internalKeys.length; i++) {
          var entry = v.$d[internalKeys[i]];
          if (entry && entry.lhs !== undefined) {
            obj[py2js(entry.lhs)] = py2js(entry.rhs);
          }
        }
      } else if (v.entries && Array.isArray(v.entries)) {
        // some builds store as array of [key, val] pairs
        for (var i = 0; i < v.entries.length; i++) {
          obj[py2js(v.entries[i][0])] = py2js(v.entries[i][1]);
        }
      } else {
        // safest fallback: iterate via Skulpt's own iterator API
        var iter = Sk.abstr.iter(v);
        for (;;) {
          var pyKey;
          try { pyKey = Sk.abstr.iternext(iter); } catch(e) { break; }
          if (pyKey === undefined) break;
          obj[py2js(pyKey)] = py2js(v.mp$subscript(pyKey));
        }
      }
      return obj;
    }
    // DataFrame / Series wrappers
    if (v.__dfd_df) return v.__dfd_df;
    if (v.__dfd_sr) return v.__dfd_sr;
    return v;
  }

  // Pretty-print a danfo DataFrame/Series as a string (like pandas)
  function dfToString(df, opts) {
    opts = opts || {};
    var showIndex = opts.showIndex !== undefined ? opts.showIndex : true;
    var showHeader = opts.showHeader !== undefined ? opts.showHeader : true;
    var naRep = opts.naRep !== undefined ? opts.naRep : "NaN";
    var lines = [];
    // NOTE: instanceof checks against window.dfd.DataFrame are unreliable —
    // danfojs 1.2.0 can return DataFrame instances (e.g. from .head()/.tail()
    // or after a read_csv round-trip) that are functionally DataFrames
    // (correct .columns, .shape, .constructor.name) but fail `instanceof`
    // due to duplicate class definitions inside the bundled library. Use the
    // library's own internal flag instead, which doesn't depend on identity.
    var isDF = df.$isSeries !== true;
    if (isDF) {
      var cols = df.columns;
      var idx  = dfGetIndexArray(df.index);
      var allVals = dfGet2DValues(df);
      // compute column widths from header and all cell values
      var widths = cols.map(function (c, ci) {
        var w = showHeader ? String(c).length : 0;
        allVals.forEach(function(row) {
          var cell = (row && row[ci] !== null && row[ci] !== undefined) ? formatCell(row[ci]) : naRep;
          if (cell.length > w) w = cell.length;
        });
        return w;
      });
      var idxNameStr = df.__indexName ? String(df.__indexName) : "";
      var idxW = showIndex ? Math.max(...idx.map(function(x){ return String(x).length; }), idxNameStr.length, 1) : 0;
      // header
      if (showHeader) {
        var header = (showIndex ? pad(idxNameStr, idxW) + "  " : "") + cols.map(function (c, i) { return pad(String(c), widths[i]); }).join("  ");
        lines.push(header);
      }
      // rows
      for (var r = 0; r < idx.length; r++) {
        var rowStr = showIndex ? pad(String(idx[r]), idxW) + "  " : "";
        var row = allVals[r];
        // row may be a string (danfo serialised it) — split by comma
        if (typeof row === "string") row = row.split(",");
        var cells = cols.map(function (c, i) {
          var val = (row && row[i] !== null && row[i] !== undefined) ? formatCell(row[i]) : naRep;
          return pad(val, widths[i]);
        });
        lines.push(rowStr + cells.join("  "));
      }
    } else {
      // Series
      var idx2 = dfGetIndexArray(df.index);
      var vals = dfGetIndexArray(df.values);
      var idxW2 = Math.max(...idx2.map(function (x) { return String(x).length; }), 1);
      var valW2 = Math.max(...vals.map(function (v) { return v === null ? naRep.length : formatCell(v).length; }), 1);
      for (var i = 0; i < idx2.length; i++) {
        lines.push((showIndex ? padEnd(String(idx2[i]), idxW2) + "  " : "") + pad(vals[i] === null ? naRep : formatCell(vals[i]), valW2));
      }
      if (opts.showDtype !== false) {
      	var dtype = df.dtype;
      	if (!dtype) {
      		var sample = vals.find(function(v) {
      			return v !== null && v !== undefined;
      		});
      		dtype = typeof sample === "boolean" ? "bool" :
      			typeof sample === "number" ? (Number.isInteger(sample) ? "int64" : "float64") :
      			"object"; // dtype-рядок для самого Series завжди "object" для рядкових значень
      	} else {
      		// forSummary=true: підсумковий рядок "dtype: ..." має показувати
      		// "object" для рядкових значень (як у справжньому pandas),
      		// на відміну від значень окремих клітинок, де лишаємо "str".
      		dtype = normalizeDtype(dtype, vals, true);
      	}
      	lines.push((df.name ? "Name: " + df.name + ", " : "") + "dtype: " + dtype);
      }
    }
    return lines.join("\n");
  }

  // Map danfo.js dtype naming ("string"/"int32"/"float32"/"boolean") to
  // pandas dtype naming ("object"/"int64"/"float64"/"bool"). Also handles
  // the case of a row Series (e.g. from df.iloc[0]) whose values come from
  // different columns and therefore may be a mix of JS types — pandas
  // always reports such a Series as dtype: object, regardless of what
  // danfo's own (single-column-oriented) dtype inference says.
  // Map danfo.js dtype naming to pandas-style
  function normalizeDtype(danfoDtype, values, forSummary) {
    var map = {
      string: "object",   // pandas використовує object для string
      int32: "int64",
      float32: "float64",
      boolean: "bool"
    };
  
    var mapped = map[danfoDtype] || danfoDtype || "object";
  
    // Важлива логіка для визначення реального типу
    if (values && values.length > 0) {
      var hasNumber = false;
      var hasString = false;
      var hasBool = false;
  
      for (var i = 0; i < values.length; i++) {
        var v = values[i];
        if (v === null || v === undefined) continue;
        if (typeof v === "number") hasNumber = true;
        else if (typeof v === "string") hasString = true;
        else if (typeof v === "boolean") hasBool = true;
      }
  
      if (hasNumber && !hasString) {
        // Перевіряємо, чи всі числа цілі
        var allIntegers = values.every(function(v) {
          return v === null || v === undefined || (typeof v === "number" && Number.isInteger(v));
        });
        return allIntegers ? "int64" : "float64";
      }
      // forSummary=true використовується для підсумкового рядка "dtype: ..."
      // при друці Series — там, як і в справжньому pandas, рядкові значення
      // завжди дають dtype "object". Без forSummary (наприклад, при побудові
      // стовпця значень df.dtypes) лишаємо історичне позначення "str".
      if (hasString) return forSummary ? "object" : "str";
      if (hasBool) return "bool";
    }
  
    return mapped;
  }

  function pad(s, w) {
    s = String(s);
    while (s.length < w) s = " " + s;
    return s;
  }

  // Left-justify (pad trailing spaces) — used for Series index labels,
  // which pandas aligns to the left, unlike values which are right-aligned.
  function padEnd(s, w) {
    s = String(s);
    while (s.length < w) s = s + " ";
    return s;
  }

  // pandas/Python print True/False (capitalized), not JS's true/false.
  function formatCell(v) {
    if (v === true) return "True";
    if (v === false) return "False";
    return String(v);
  }

  // ─── CSV parsing / writing ──────────────────────────────────────────────────
  // A small RFC4180-ish CSV engine: handles quoted fields, embedded commas,
  // embedded newlines inside quotes, and escaped quotes ("").

  var DEFAULT_NA_VALUES = ["", "NA", "N/A", "NaN", "nan", "null", "NULL", "None", "#N/A", "<NA>"];

  function parseCSV(text, sep) {
    sep = sep || ",";
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    var len = text.length;
    while (i < len) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === "") { inQuotes = true; i++; continue; }
      if (c === sep) { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
        i++; continue;
      }
      field += c; i++;
    }
    // flush trailing field/row (file may not end with a newline)
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    // drop a single fully-empty trailing row (artifact of a trailing newline)
    if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
      rows.pop();
    }
    return rows;
  }

  // Quote a single CSV field only when necessary (contains sep/quote/newline).
  function formatCSVField(val, sep, naRep) {
    if (val === null || val === undefined || (typeof val === "number" && isNaN(val))) {
      return naRep;
    }
    var s = String(val);
    if (s.indexOf(sep) !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1 || s.indexOf("\r") !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // Coerce a raw CSV cell (string) into null/number/bool/string, pandas-style.
  function coerceCSVValue(raw, naValues) {
    if (raw === undefined) return null;
    if (naValues.indexOf(raw) !== -1) return null;
    var trimmed = raw.trim();
    if (trimmed !== "" && !isNaN(Number(trimmed))) return Number(trimmed);
    if (raw === "True" || raw === "TRUE" || raw === "true") return true;
    if (raw === "False" || raw === "FALSE" || raw === "false") return false;
    return raw;
  }

  // In-memory virtual filesystem so df.to_csv("name.csv") and
  // pd.read_csv("name.csv") round-trip within the same session even though
  // there is no real disk to write to in the browser/Skulpt sandbox.
  var __csvStore = {};

  // Parallel in-memory store for df.to_excel("name.xlsx") / pd.read_excel(...)
  // round-tripping within the same session. When SheetJS (window.XLSX) is
  // available on the page, to_excel also writes a real, downloadable .xlsx
  // file; otherwise this store just keeps the sheet data (as an array of
  // rows) so read_excel can hand it back.
  var __excelStore = {};

  // Trigger an actual browser download (Blob + temporary <a download>),
  // used by to_csv() so df.to_csv("name.csv") saves a real file to the
  // user's Downloads folder instead of only living in the in-memory
  // __csvStore (which only lets pd.read_csv() read it back within the
  // same session, but produces nothing the user can see on disk).
  function triggerBrowserDownload(filename, content, mimeType) {
    if (typeof window === "undefined" || typeof document === "undefined" || typeof Blob === "undefined") return false;
    try {
      var blob = new Blob([content], { type: mimeType });
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { window.URL.revokeObjectURL(url); }, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Build a danfo DataFrame from parsed CSV rows honouring header/names/
  // index_col/usecols/na_values — shared by read_csv's text and URL paths.
  function buildDataFrameFromCSV(dfd, text, opts) {
    var rows = parseCSV(text, opts.sep);
    if (rows.length === 0) return new dfd.DataFrame({});
    var headers, dataRows;
    if (opts.header === null || opts.header === false) {
      dataRows = rows;
      var ncols = rows[0].length;
      if (opts.names && opts.names.length) {
        headers = opts.names.map(String);
      } else {
        headers = [];
        for (var c = 0; c < ncols; c++) headers.push(String(c));
      }
    } else {
      var headerIdx = typeof opts.header === "number" ? opts.header : 0;
      headers = rows[headerIdx] ? rows[headerIdx].slice() : [];
      if (opts.names && opts.names.length) headers = opts.names.map(String);
      dataRows = rows.slice(headerIdx + 1);
    }
    // usecols filter (by name or positional index)
    var colIndices = headers.map(function (_, i) { return i; });
    if (opts.usecols) {
      var useSet = opts.usecols.map(String);
      colIndices = colIndices.filter(function (i) {
        return useSet.indexOf(headers[i]) !== -1 || useSet.indexOf(String(i)) !== -1;
      });
    }
    var data = {};
    colIndices.forEach(function (ci) { data[headers[ci]] = []; });
    dataRows.forEach(function (r) {
      colIndices.forEach(function (ci) {
        data[headers[ci]].push(coerceCSVValue(r[ci] !== undefined ? r[ci] : "", opts.naValues));
      });
    });
    var df = new dfd.DataFrame(data);
    if (opts.indexCol !== null && opts.indexCol !== undefined) {
      var idxColName = typeof opts.indexCol === "number" ? headers[colIndices[opts.indexCol]] : opts.indexCol;
      try { df = df.setIndex({ column: idxColName, drop: true }); }
      catch (e) { try { df = df.setIndex({ column: idxColName }); } catch (e2) {} }
    }
    return df;
  }

  // Serialize a danfo DataFrame to CSV text honouring index/sep/header/columns/na_rep.
  function dataFrameToCSV(df, opts) {
    var sep = opts.sep, naRep = opts.naRep, index = opts.index, header = opts.header;
    var allCols = df.columns;
    var cols = opts.columns && opts.columns.length ? opts.columns : allCols;
    var colIdx = cols.map(function (c) { return allCols.indexOf(c); });
    var lines = [];
    if (header) {
      var headerRow = index ? [opts.indexLabel || ""].concat(cols) : cols.slice();
      lines.push(headerRow.map(function (h) { return formatCSVField(h, sep, naRep); }).join(sep));
    }
    var allRows = dfGet2DValues(df);
    allRows.forEach(function (row, i) {
      var outRow = colIdx.map(function (ci) { return formatCSVField(row[ci], sep, naRep); });
      if (index) outRow.unshift(formatCSVField(df.index[i], sep, naRep));
      lines.push(outRow.join(sep));
    });
    return lines.join("\n") + "\n";
  }

  // ─── Skulpt keyword-argument helper ────────────────────────────────────────
  // Skulpt passes keyword arguments as flat trailing pairs in `arguments`:
  //   fn(posArg1, posArg2, "kwKey1", kwVal1, "kwKey2", kwVal2)
  // parseKwargs(arguments, numPositional) returns { pos: [...], kw: {key: pyVal} }
  function parseKwargs(args, numPos) {
    args = Array.prototype.slice.call(args);
    var pos = args.slice(0, numPos);
    var kw  = {};
    for (var i = numPos; i + 1 < args.length; i += 2) {
      if (args[i] instanceof Sk.builtin.str) {
        kw[args[i].v] = args[i + 1];
      }
    }
    return { pos: pos, kw: kw };
  }

  function kwGet(kw, name, def_) {
    return kw.hasOwnProperty(name) ? py2js(kw[name]) : def_;
  }

  // Read a value from positional args[i] if present, else from kwargs[name],
  // else fall back to def_. Used throughout to accept args either way,
  // e.g. df.rename({...}) or df.rename(columns={...}).
  function argOrKw(args, i, kw, name, def_) {
    if (args[i] !== undefined) return py2js(args[i]);
    return kwGet(kw, name, def_);
  }

  // Build a Skulpt-callable function that correctly receives (args, kwargs).
  // handler(args, kwargs) where:
  //   args   = JS array of positional py-values
  //   kwargs = plain JS object { "key": pyValue }
  // Like kwFunc, but for __init__ methods: Skulpt invokes __init__ with self
  // as the first positional argument. Plain Sk.builtin.func instances don't
  // accept keyword arguments at all (Skulpt raises "takes no keyword
  // arguments" the moment any kwarg is passed) unless tp$call is overridden,
  // so pd.Series(data=..., index=...) / pd.DataFrame(data=..., index=...)
  // need this instead of a plain Sk.builtin.func.
  function kwInitFunc(handler) {
    var f = new Sk.builtin.func(function() {});
    f.tp$call = function(args, kwargs) {
      var self = args[0];
      var rest = args.slice(1);
      var kw = {};
      if (kwargs) {
        for (var i = 0; i + 1 < kwargs.length; i += 2) {
          kw[kwargs[i]] = kwargs[i + 1];
        }
      }
      return handler(self, rest, kw);
    };
    return f;
  }

  function kwFunc(handler) {
    var f = new Sk.builtin.func(function() {});
    f.tp$call = function(args, kwargs) {
      var kw = {};
      if (kwargs) {
        for (var i = 0; i + 1 < kwargs.length; i += 2) {
          kw[kwargs[i]] = kwargs[i + 1];   // kwargs is ["key", pyVal, ...]
        }
      }
      return handler(args || [], kw);
    };
    return f;
  }

  // ─── danfo DataFrame helpers ────────────────────────────────────────────────

  function dfSubscript(df, key) {
    if (!df) throw new Sk.builtin.KeyError(new Sk.builtin.str("DataFrame is empty"));
    // boolean Series mask — direct (mp$subscript intercepts before coercion)
    if (key && key.__dfd_sr) {
      var dfd2 = ensureDfd();
      _lastBoolSeries = null;
      return wrapDataFrame(dfFilterByMask(df, key.__dfd_sr.values, dfd2));
    }
    // Skulpt coerced our boolean Series to bool — retrieve the stashed mask
    if ((key instanceof Sk.builtin.bool || key instanceof Sk.builtin.int_) && _lastBoolSeries) {
      var stashed = _lastBoolSeries;
      _lastBoolSeries = null;
      var dfd2 = ensureDfd();
      return wrapDataFrame(dfFilterByMask(df, stashed.__dfd_sr.values, dfd2));
    }
    var k = py2js(key);
    // list of columns
    if (Array.isArray(k)) {
      return wrapDataFrame(df.loc({ columns: k }));
    }
    // single column
    var dfd3 = ensureDfd();
    var colVals = dfGetColumn(df, k);
    return wrapSeries(new dfd3.Series(colVals, { index: df.index }));
  }



  // Safely extract a guaranteed plain JS array from a danfo df.index / sr.index.
  // Same rationale as dfGet2DValues() above: some danfo 1.2.0 code paths
  // (notably when a DataFrame is built from a 2D array with mixed-dtype
  // columns, e.g. a string column alongside a numeric one -- exactly what
  // Series.reset_index() below produces) hand back a typed tensor / index
  // wrapper instead of a plain array. That object still has a `.map()`
  // method, but it's TensorFlow.js's `.map()`, which doesn't return a plain
  // iterable array -- so `Math.max(...idx.map(...))` blows up with
  // "idx.map(...) is not iterable" even though `idx.map` itself is callable.
  function dfGetIndexArray(idx) {
    if (Array.isArray(idx)) return idx;
    if (idx && typeof idx.arraySync === "function") return idx.arraySync();
    if (idx && (idx instanceof Float32Array || idx instanceof Int32Array || ArrayBuffer.isView(idx))) {
      return Array.prototype.slice.call(idx);
    }
    if (idx && typeof idx.tolist === "function") return idx.tolist();
    if (idx && typeof idx[Symbol.iterator] === "function") return Array.from(idx);
    return idx ? [idx] : [];
  }

  // Safely extract a guaranteed 2D JS array from danfo df.values
  // In some danfo versions df.values returns a typed tensor, not a plain 2D array
  function dfGet2DValues(df) {
    var v = df.values;
    // Already a plain 2D JS array?
    if (Array.isArray(v) && (v.length === 0 || Array.isArray(v[0]))) return v;
    // Typed tensor with .arraySync() (TensorFlow.js backend)
    if (v && typeof v.arraySync === "function") return v.arraySync();
    // Flat typed array — reshape using df.shape
    if (v && (v instanceof Float32Array || v instanceof Int32Array || ArrayBuffer.isView(v))) {
      var nrows = df.shape[0], ncols = df.shape[1];
      var result = [];
      for (var r = 0; r < nrows; r++) {
        result.push(Array.prototype.slice.call(v, r * ncols, (r + 1) * ncols));
      }
      return result;
    }
    // Last resort: return as-is and hope for the best
    return v;
  }

  // Get a column's values as a JS array from a danfo DataFrame.
  // Uses df.values (2D array) — the only reliable cross-version API.
  function dfGetColumn(df, colName) {
    var cols = df.columns;
    // df.columns in danfo may be a special object — normalize to plain JS array of strings
    var colArr = Array.isArray(cols) ? cols : (cols && cols.tolist ? cols.tolist() : Object.values(cols));
    colArr = colArr.map(String);
    var ci = colArr.indexOf(String(colName));
    if (ci === -1) {
      console.error("[pandas.js] dfGetColumn: colName=", colName, "cols=", cols, "colArr=", colArr);
      throw new Error("Column not found: " + colName + " (available: " + colArr.join(", ") + ")");
    }
    var rows = dfGet2DValues(df);
    return rows.map(function(row) { return row[ci]; });
  }

  // Build a new danfo DataFrame from a plain {col: [values]} object.
  // Thin wrapper so call-sites stay readable.
  function dfFromColMap(colMap, dfd) {
    return new dfd.DataFrame(colMap);
  }

  // Filter a danfo DataFrame by a boolean JS array (same length as df rows).
  function dfFilterByMask(df, mask, dfd) {
    var cols = df.columns;
    var colArr = Array.isArray(cols) ? cols : (cols && cols.tolist ? cols.tolist() : Object.values(cols));
    colArr = colArr.map(String);
    var allRows = dfGet2DValues(df);  // 2D
    var result = {};
    colArr.forEach(function(c) { result[c] = []; });
    mask.forEach(function(v, i) {
      if (v) colArr.forEach(function(c, ci) {
        result[c].push(allRows[i] !== undefined ? allRows[i][ci] : null);
      });
    });
    if (!colArr[0] || result[colArr[0]].length === 0) {
      return new dfd.DataFrame({});
    }
    return new dfd.DataFrame(result);
  }

  // ─── Plotting (df.plot / series.plot) ──────────────────────────────────────
  // Delegates to the project's own `matplotlib.pyplot` Skulpt module (Chart.js
  // backend) instead of reimplementing charting here. That module has no
  // Figure/Axes objects at all — plt.figure()/plt.subplots()/plt.gca() are all
  // NotImplementedError stubs, it's a pure global-state pyplot() shim — so
  // df.plot() just drives plt.plot()/plt.bar()/plt.scatter()/... the same way
  // a script would, and leaves plt.show() to the caller, exactly like real
  // pandas leaves plt.show() to the caller in a plain script.

  // Sk.importModule can return a Suspension on first import (module source
  // still loading) or the module directly if already cached; chain handles
  // both uniformly, same as our own read_csv Suspension already does for I/O.
  //
  // For a dotted name, Python's own __import__ semantics return the
  // top-level package (`matplotlib`), not the leaf submodule (`pyplot`) —
  // that's why a plain `pyplotModule.$d.plot` can come back undefined even
  // though the import itself succeeded. Try a few plausible shapes before
  // giving up.
  function resolvePyplotNamespace(importResult) {
    // Case 1: importModule already handed us the pyplot submodule itself.
    if (importResult && importResult.$d && importResult.$d.plot) {
      return importResult.$d;
    }
    // Case 2: importModule gave back the top-level `matplotlib` package —
    // the submodule lives at matplotlib.pyplot.
    if (importResult && importResult.$d && importResult.$d.pyplot && importResult.$d.pyplot.$d) {
      return importResult.$d.pyplot.$d;
    }
    // Case 3: fall back to sys.modules, where the fully-dotted name is
    // always registered once imported, regardless of what importModule
    // itself returned.
    if (Sk.sysmodules) {
      var lookups = [
        function () { return Sk.sysmodules.mp$lookup(new Sk.builtin.str("matplotlib.pyplot")); },
        function () { return Sk.sysmodules.mp$subscript(new Sk.builtin.str("matplotlib.pyplot")); }
      ];
      for (var i = 0; i < lookups.length; i++) {
        try {
          var sysMod = lookups[i]();
          if (sysMod && sysMod.$d && sysMod.$d.plot) return sysMod.$d;
        } catch (e) {}
      }
    }
    return null;
  }

  function withPyplot(fn) {
    return Sk.misceval.chain(Sk.importModule("matplotlib.pyplot", false, true), function (importResult) {
      var ns = resolvePyplotNamespace(importResult);
      if (!ns) {
        var topKeys = importResult && importResult.$d ? Object.keys(importResult.$d).join(", ") : "(none)";
        throw new Sk.builtin.ImportError(new Sk.builtin.str(
          "plot() could not resolve matplotlib.pyplot's functions from the import result " +
          "(top-level keys seen: [" + topKeys + "]). Make sure `import matplotlib.pyplot` works in this environment."
        ));
      }
      return fn(ns);
    });
  }

  // Call a pyplot function using Skulpt's own calling convention (tp$call
  // with a positional-args array and a flat ["key", pyVal, ...] kwargs array)
  // — the same convention this pyplot module's co_kwargs functions expect,
  // and the same one our own kwFunc-built functions expose.
  function callPlt(plt, name, posArgs, kwFlat) {
    var fn = plt[name];
    if (!fn || !fn.tp$call) {
      throw new Sk.builtin.AttributeError(new Sk.builtin.str("matplotlib.pyplot has no attribute '" + name + "'"));
    }
    return fn.tp$call(posArgs, kwFlat);
  }

  // This pyplot shim has no Axes object to hand back (see note above), so we
  // can't return a real one. Chained calls like ax.set_title(...) just no-op
  // instead of raising, rather than pretending to support the full Axes API.
  function wrapAxesStub() {
    var axes = {};
    axes.tp$getattr = function () { return new Sk.builtin.func(function () { return axes; }); };
    return axes;
  }

  var PLOT_KINDS_SUPPORTED = ["line", "bar", "barh", "scatter", "hist", "pie"];

  // getColData() => { columns: [...], index: [...], colData: {col: [values]} }
  // Shared by DataFrame.plot and Series.plot so both get the same kind/x/y/
  // title/color kwargs and the same `.line()/.bar()/.scatter()/...` accessors.
  function makePlotAccessor(getColData) {
    function doPlot(kind, kw) {
      if (PLOT_KINDS_SUPPORTED.indexOf(kind) === -1) {
        throw new Sk.builtin.NotImplementedError(new Sk.builtin.str(
          "plot(kind='" + kind + "') is not supported by this matplotlib.pyplot backend " +
          "(supported: " + PLOT_KINDS_SUPPORTED.join(", ") + ")"
        ));
      }
      var data = getColData();
      var xCol = kwGet(kw, "x", null);
      var yArg = kwGet(kw, "y", null);
      var yCols = yArg ? (Array.isArray(yArg) ? yArg : [yArg]) : data.columns.filter(function (c) { return c !== xCol; });
      var title = kwGet(kw, "title", null);
      var color = kwGet(kw, "color", null);
      var xVals = xCol ? data.colData[xCol] : data.index;

      return withPyplot(function (plt) {
        if (kind === "scatter") {
          if (!xCol || !yCols.length) {
            throw new Sk.builtin.ValueError(new Sk.builtin.str("plot(kind='scatter') requires both x= and y="));
          }
          var kwFlat = [];
          if (color) kwFlat.push("color", js2py(color));
          callPlt(plt, "scatter", [js2py(data.colData[xCol]), js2py(data.colData[yCols[0]])], kwFlat);
        } else if (kind === "pie") {
          var valCol = yCols[0] || (data.columns.length === 1 ? data.columns[0] : null);
          if (!valCol) {
            throw new Sk.builtin.ValueError(new Sk.builtin.str("plot(kind='pie') requires y= when called on a multi-column DataFrame"));
          }
          var labels = (xCol ? data.colData[xCol] : data.index).map(String);
          callPlt(plt, "pie", [js2py(data.colData[valCol])], ["labels", js2py(labels)]);
        } else if (kind === "hist") {
          yCols.forEach(function (c) {
            var kwFlat = ["label", js2py(c)];
            var bins = kwGet(kw, "bins", null);
            if (bins !== null) kwFlat.push("bins", js2py(bins));
            callPlt(plt, "hist", [js2py(data.colData[c])], kwFlat);
          });
        } else if (kind === "bar" || kind === "barh") {
          var fnName = kind === "barh" ? "barh" : "bar";
          yCols.forEach(function (c) {
            var kwFlat = [];
            if (color) kwFlat.push("color", js2py(color));
            callPlt(plt, fnName, [js2py(xVals), js2py(data.colData[c])], kwFlat);
          });
        } else {
          // line (default)
          yCols.forEach(function (c) {
            var kwFlat = ["label", js2py(c)];
            if (color) kwFlat.push("color", js2py(color));
            callPlt(plt, "plot", [js2py(xVals), js2py(data.colData[c])], kwFlat);
          });
        }
        if (title) callPlt(plt, "title", [js2py(title)], []);
        return wrapAxesStub();
      });
    }

    function kwFromSkulptArgs(kwargs) {
      var kw = {};
      if (kwargs) { for (var i = 0; i + 1 < kwargs.length; i += 2) kw[kwargs[i]] = kwargs[i + 1]; }
      return kw;
    }
    var acc = {};
    acc.tp$call = function (args, kwargs) {
      var kw = kwFromSkulptArgs(kwargs);
      return doPlot(kwGet(kw, "kind", "line"), kw);
    };
    var accessorKinds = ["line", "bar", "barh", "scatter", "hist", "pie", "box", "area", "kde"];
    acc.tp$getattr = function (name) {
      var n = typeof name === "string" ? name : name.v;
      if (accessorKinds.indexOf(n) !== -1) {
        var subF = new Sk.builtin.func(function () {});
        subF.tp$call = function (args, kwargs) { return doPlot(n, kwFromSkulptArgs(kwargs)); };
        return subF;
      }
      throw new Sk.builtin.AttributeError(new Sk.builtin.str("plot accessor has no attribute '" + n + "'"));
    };
    return acc;
  }

  // ─── Series ─────────────────────────────────────────────────────────────────

  function wrapSeries(sr) {
    var pysr = Sk.misceval.callsim(mod.Series, Sk.builtin.none.none$);
    pysr.__dfd_sr = sr;
    return pysr;
  }

  mod.Series = Sk.misceval.buildClass(mod, function ($gbl, $loc) {

    $loc.__init__ = kwInitFunc(function (self, args, kw) {
      // data may be list/dict/None, passed positionally or as data=...
      var dfd = ensureDfd();
      var data = argOrKw(args, 0, kw, "data", null);
      var index = argOrKw(args, 1, kw, "index", null);
      var name = argOrKw(args, 3, kw, "name", null);
      if (data !== null && data !== undefined) {
        var jsData = data;
        var values = Array.isArray(jsData) ? jsData : Object.values(jsData);
        var opts = {};
        if (index) opts.index = index;
        if (name) opts.name = name;
        self.__dfd_sr = new dfd.Series(values, opts);
      }
    });

    $loc.__repr__ = new Sk.builtin.func(function (self) {
      if (!self.__dfd_sr) return new Sk.builtin.str("Series(empty)");
      return new Sk.builtin.str(dfToString(self.__dfd_sr));
    });

    $loc.__str__ = $loc.__repr__;

    $loc.__getattr__ = new Sk.builtin.func(function (self, name) {
      var n = Sk.ffi.remapToJs(name);
      var sr = self.__dfd_sr;
      if (!sr) throw new Sk.builtin.AttributeError(name);

      if (n === "values")  return new Sk.builtin.list(sr.values.map(js2py));
      if (n === "index")   return new Sk.builtin.list(dfGetIndexArray(sr.index).map(js2py));
      if (n === "name")    return sr.name ? new Sk.builtin.str(sr.name) : Sk.builtin.none.none$;
      if (n === "dtype")   return new Sk.builtin.str(normalizeDtype(sr.dtype, sr.values));
      if (n === "shape")   return new Sk.builtin.tuple([new Sk.builtin.int_(sr.values.length)]);
      if (n === "size")    return new Sk.builtin.int_(sr.values.length);

      // delegate numeric methods
      var numMethods = ["mean","sum","min","max","std","var","count","median","abs","cumsum","cumprod","cummax","cummin"];
      if (numMethods.indexOf(n) !== -1) {
        return new Sk.builtin.func(function () {
          var res = sr[n]();
          // danfo returns a Series for cumulative; scalar for agg
          if (res && typeof res === "object" && res.$isSeries === true) return wrapSeries(res);
          return js2py(typeof res === "object" && res !== null ? res.values ? res.values[0] : res : res);
        });
      }

      if (n === "to_string") return kwFunc(function (args, kw) {
        var showIndex = kwGet(kw, "index", true);
        var naRep = kwGet(kw, "na_rep", "NaN");
        return new Sk.builtin.str(dfToString(sr, { showIndex: showIndex, naRep: naRep }));
      });

      if (n === "head") return new Sk.builtin.func(function (n2) { return wrapSeries(sr.head(n2 ? py2js(n2) : 5)); });
      if (n === "tail") return new Sk.builtin.func(function (n2) { return wrapSeries(sr.tail(n2 ? py2js(n2) : 5)); });

      if (n === "unique")   return new Sk.builtin.func(function () { return new Sk.builtin.list(sr.unique().map(js2py)); });
      if (n === "nunique")  return new Sk.builtin.func(function () { return js2py(sr.nunique()); });

      if (n === "value_counts") return new Sk.builtin.func(function () { return wrapSeries(sr.valueCounts()); });

      if (n === "idxmax") return new Sk.builtin.func(function () {
        var vals = sr.values;
        var bestI = -1;
        for (var i = 0; i < vals.length; i++) {
          var v = vals[i];
          if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) continue;
          if (bestI === -1 || v > vals[bestI]) bestI = i;
        }
        if (bestI === -1) throw new Sk.builtin.ValueError("attempt to get idxmax of an empty sequence");
        return js2py(sr.index[bestI]);
      });
      if (n === "idxmin") return new Sk.builtin.func(function () {
        var vals = sr.values;
        var bestI = -1;
        for (var i = 0; i < vals.length; i++) {
          var v = vals[i];
          if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) continue;
          if (bestI === -1 || v < vals[bestI]) bestI = i;
        }
        if (bestI === -1) throw new Sk.builtin.ValueError("attempt to get idxmin of an empty sequence");
        return js2py(sr.index[bestI]);
      });

      if (n === "fillna")  return kwFunc(function(args, kw) {
        var val = argOrKw(args, 0, kw, "value", 0);
        var inplace = kwGet(kw, "inplace", false);
        var res = sr.fillNa(val);
        if (inplace) { self.__dfd_sr = res; return Sk.builtin.none.none$; }
        return wrapSeries(res);
      });
      if (n === "dropna")  return kwFunc(function(args, kw) {
        var inplace = kwGet(kw, "inplace", false);
        var res = sr.dropNa();
        if (inplace) { self.__dfd_sr = res; return Sk.builtin.none.none$; }
        return wrapSeries(res);
      });
      if (n === "isna")    return new Sk.builtin.func(function () { return wrapSeries(sr.isNa()); });
      if (n === "notna")   return new Sk.builtin.func(function () { return wrapSeries(sr.notNa()); });
      if (n === "isnull")  return new Sk.builtin.func(function () { return wrapSeries(sr.isNa()); });
      if (n === "notnull") return new Sk.builtin.func(function () { return wrapSeries(sr.notNa()); });

      if (n === "sort_values") return kwFunc(function(args, kw) {
        var asc = kwGet(kw, "ascending", true);
        var inplace = kwGet(kw, "inplace", false);
        var res = sr.sortValues({ ascending: asc });
        if (inplace) { self.__dfd_sr = res; return Sk.builtin.none.none$; }
        return wrapSeries(res);
      });

      if (n === "reset_index") return kwFunc(function(args, kw) {
        var drop = kwGet(kw, "drop", false);
        var inplace = kwGet(kw, "inplace", false);
        if (drop) {
          // drop=True: just renumber the index, values unchanged, still a Series.
          var res = sr.resetIndex();
          if (inplace) { self.__dfd_sr = res; return Sk.builtin.none.none$; }
          return wrapSeries(res);
        }
        // drop=False (pandas default): the old index becomes its own column
        // (named after the index, or "index" if unnamed) and the values
        // become a column named after the Series (or "0" if unnamed) --
        // i.e. the Series turns into a two-column DataFrame. Build this via
        // an explicit 2D array + column names, same as DataFrame.reset_index()
        // above, to avoid danfo's special-cased handling of a column
        // literally named "index".
        var dfd2 = ensureDfd();
        var indexColName = sr.__indexName ? String(sr.__indexName) : "index";
        var valColName = sr.name || "0";
        var newCols = [indexColName, valColName];
        var oldIdx = dfGetIndexArray(sr.index);
        var newRows = sr.values.map(function (v, i) { return [oldIdx[i], v]; });
        // Pass an explicit plain-array RangeIndex (0..n-1), same as real
        // pandas after reset_index(). Leaving it to danfo's own default can,
        // for a 2D array with mixed-dtype columns (a string column next to
        // a numeric one -- exactly the shape produced here), hand back a
        // non-plain-array index object later, which breaks unrelated code
        // that assumes df.index is a plain array (e.g. printing).
        var newDf = new dfd2.DataFrame(newRows, { columns: newCols, index: newRows.map(function (_, i) { return i; }) });
        if (inplace) {
          // Real pandas raises here too: a Series can't turn into a
          // DataFrame "in place".
          throw new Sk.builtin.TypeError(new Sk.builtin.str(
            "Cannot reset_index inplace on a Series to create a DataFrame"
          ));
        }
        return wrapDataFrame(newDf);
      });

      if (n === "tolist" || n === "to_list") return new Sk.builtin.func(function () {
        return new Sk.builtin.list(sr.values.map(js2py));
      });

      if (n === "astype") return new Sk.builtin.func(function (dtype) {
        var t = py2js(dtype);
        var map = { "int": "int32", "int32": "int32", "int64": "int32", "float": "float32", "float64": "float32", "str": "string", "string": "string" };
        return wrapSeries(sr.astype(map[t] || t));
      });

      if (n === "apply") return new Sk.builtin.func(function (fn) {
        var newVals = sr.values.map(function (v) { return py2js(Sk.misceval.callsim(fn, js2py(v))); });
        var dfd2 = ensureDfd();
        return wrapSeries(new dfd2.Series(newVals, { index: sr.index }));
      });

      if (n === "map") return new Sk.builtin.func(function (mapping) {
        var dfd2 = ensureDfd();
        // pandas' Series.map() accepts either a callable (function/lambda)
        // or a dict-like mapping. Skulpt functions/lambdas expose
        // tp$call/func_code, so detect those first and call them per-element
        // (same as apply()); only fall back to dict-style lookup otherwise.
        var isCallable = mapping instanceof Sk.builtin.func ||
          (mapping && (typeof mapping.tp$call === "function" || mapping.func_code));
        var newVals;
        if (isCallable) {
          newVals = sr.values.map(function (v) { return py2js(Sk.misceval.callsim(mapping, js2py(v))); });
        } else {
          var jsMap = py2js(mapping);
          newVals = sr.values.map(function (v) { return jsMap[v] !== undefined ? jsMap[v] : null; });
        }
        return wrapSeries(new dfd2.Series(newVals, { index: sr.index }));
      });

      if (n === "isin") return new Sk.builtin.func(function (vals) {
        var arr = py2js(vals);
        var set = new Set(arr);
        var dfd2 = ensureDfd();
        return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return set.has(v); }), { index: sr.index }));
      });

      if (n === "between") return new Sk.builtin.func(function (lo, hi) {
        var l = py2js(lo), h = py2js(hi);
        var dfd2 = ensureDfd();
        return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return v >= l && v <= h; }), { index: sr.index }));
      });

      if (n === "round") return new Sk.builtin.func(function (decimals) {
        var d = decimals !== undefined ? py2js(decimals) : 0;
        var factor = Math.pow(10, d);
        var dfd2 = ensureDfd();
        var newVals = sr.values.map(function (v) {
          return (v === null || v === undefined || (typeof v === "number" && isNaN(v)))
            ? v : Math.round(v * factor) / factor;
        });
        return wrapSeries(new dfd2.Series(newVals, { index: sr.index, name: sr.name }));
      });

      if (n === "rename") return new Sk.builtin.func(function (nm) {
        var s2 = new window.dfd.Series(sr.values, { index: sr.index, name: py2js(nm) });
        return wrapSeries(s2);
      });

      // Comparison methods (gt/lt/ge/le/eq/ne) — pandas.Series API.
      // These exist as *method calls* (as opposed to `series > 20`) because
      // Skulpt's compiler unconditionally coerces every `a > b`-style
      // comparison expression down to a plain Python bool (see the note by
      // elementwiseCompare further below), so `mask = series > 20` can never
      // hold onto a real element-wise boolean Series. A plain method call
      // like `series.gt(20)` isn't compiled that way, so it can return (and
      // keep) an actual boolean Series that survives assignment/masking.
      var cmpMethodOps = { gt: "Gt", lt: "Lt", ge: "GtE", le: "LtE", eq: "Eq", ne: "NotEq" };
      if (cmpMethodOps.hasOwnProperty(n)) {
        var cmpOp = cmpMethodOps[n];
        return kwFunc(function (args, kw) {
          var other = argOrKw(args, 0, kw, "other", null);
          return elementwiseCompare(self, other, cmpOp);
        });
      }

      if (n === "str") return makeStrAccessor(sr);

      if (n === "dt")  return makeDtAccessor(sr);

      if (n === "plot") return makePlotAccessor(function () {
        var name = sr.name || "value";
        var colData = {};
        colData[name] = sr.values;
        return { columns: [name], index: sr.index, colData: colData };
      });

      // to_csv/to_excel on a Series: pandas treats it as a single-column
      // frame for export purposes. Build a minimal {columns, values, index}
      // stand-in (dfGet2DValues/dataFrameToCSV only need those three plain
      // properties) and reuse the same CSV-building logic and in-memory
      // stores (__csvStore/__excelStore) that back df.to_csv/df.to_excel,
      // so pd.read_csv/pd.read_excel can still round-trip the result.
      if (n === "to_csv") return kwFunc(function (args, kw) {
        var pathArg = args[0] !== undefined ? py2js(args[0]) : null;
        var colName = sr.name || "0";
        var fakeDf = { columns: [colName], values: sr.values.map(function (v) { return [v]; }), index: sr.index };
        var opts = {
          sep: kwGet(kw, "sep", ","),
          index: kwGet(kw, "index", true),
          header: kwGet(kw, "header", true),
          columns: null,
          naRep: kwGet(kw, "na_rep", ""),
          indexLabel: kwGet(kw, "index_label", "")
        };
        var csvText = dataFrameToCSV(fakeDf, opts);
        var encoding = kwGet(kw, "encoding", "utf-8");
        if (pathArg) {
          __csvStore[pathArg] = csvText;
          var withBom = (String(encoding).toLowerCase().indexOf("utf-8") !== -1 ? "\ufeff" : "") + csvText;
          triggerBrowserDownload(pathArg, withBom, "text/csv;charset=utf-8;");
          return Sk.builtin.none.none$;
        }
        return new Sk.builtin.str(csvText);
      });

      if (n === "to_excel") return kwFunc(function (args, kw) {
        var pathArg = args[0] !== undefined ? py2js(args[0]) : null;
        var colName = sr.name || "0";
        var opts = {
          sheetName: kwGet(kw, "sheet_name", "Sheet1"),
          index: kwGet(kw, "index", true),
          header: kwGet(kw, "header", true),
          naRep: kwGet(kw, "na_rep", ""),
          indexLabel: kwGet(kw, "index_label", "")
        };

        var aoa = [];
        if (opts.header) {
          aoa.push(opts.index ? [opts.indexLabel || ""].concat([colName]) : [colName]);
        }
        sr.values.forEach(function (v, ri) {
          var isNaN_ = typeof v === "number" && isNaN(v);
          var cell = (v === null || v === undefined || isNaN_) ? opts.naRep : v;
          var outRow = opts.index ? [sr.index[ri], cell] : [cell];
          aoa.push(outRow);
        });

        if (typeof window !== "undefined" && window.XLSX) {
          var ws = window.XLSX.utils.aoa_to_sheet(aoa);
          var wb = window.XLSX.utils.book_new();
          window.XLSX.utils.book_append_sheet(wb, ws, opts.sheetName);
          if (pathArg) {
            window.XLSX.writeFile(wb, pathArg);
            __excelStore[pathArg] = aoa;
            return Sk.builtin.none.none$;
          }
          var bin = window.XLSX.write(wb, { type: "binary", bookType: "xlsx" });
          return new Sk.builtin.str(bin);
        }

        if (pathArg) {
          __excelStore[pathArg] = aoa;
          return Sk.builtin.none.none$;
        }
        throw new Sk.builtin.ImportError(new Sk.builtin.str(
          "to_excel() requires either a path to write to, or SheetJS " +
          "(window.XLSX) loaded on the page to return raw bytes. Add " +
          "<script src=\"https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js\"></script> " +
          "to your page for full .xlsx support."
        ));
      });

      throw new Sk.builtin.AttributeError(new Sk.builtin.str("Series has no attribute '" + n + "'"));
    });

    $loc.__getitem__ = new Sk.builtin.func(function (self, key) {
      var sr = self.__dfd_sr;
      // Skulpt always coerces `series > n` (and friends) down to a plain
      // Python bool before it ever reaches this __getitem__ — the real
      // element-wise mask was stashed on nb$bool. Recover it here the same
      // way DataFrame subscripting already does. This must run BEFORE the
      // generic numeric-index check below: py2js(a Python bool) is itself
      // a plain JS number (0/1), so s[mask] would otherwise silently be
      // treated as positional index s.iloc[1] instead of a mask.
      if (key instanceof Sk.builtin.bool && _lastBoolSeries) {
        var stashed = _lastBoolSeries;
        _lastBoolSeries = null;
        var dfd3 = ensureDfd();
        var stashedMask = stashed.__dfd_sr.values;
        var filtered2 = sr.values.filter(function (_, i) { return stashedMask[i]; });
        var filteredIdx2 = sr.index.filter(function (_, i) { return stashedMask[i]; });
        return wrapSeries(new dfd3.Series(filtered2, { index: filteredIdx2 }));
      }
      var k = py2js(key);
      if (typeof k === "number") {
        var v = sr.iloc([k]).values[0];
        return js2py(v);
      }
      // boolean series mask — key really is a Series object (e.g. built by
      // hand as pd.Series([True, False, ...]) rather than via `series > n`)
      if (key.__dfd_sr) {
        var mask = key.__dfd_sr.values;
        var dfd2 = ensureDfd();
        _lastBoolSeries = null;
        var filtered = sr.values.filter(function (_, i) { return mask[i]; });
        var filteredIdx = sr.index.filter(function (_, i) { return mask[i]; });
        return wrapSeries(new dfd2.Series(filtered, { index: filteredIdx }));
      }
      // label-based lookup: e.g. a row Series pulled out via df.iloc[0] has
      // sr.index == the original column names, so row['col_name'] must look
      // up the position in sr.index rather than indexing sr.values directly
      // (sr.values is a plain JS array, so sr.values["col_name"] is always
      // undefined — this was silently returning None for every string key).
      if (typeof k === "string") {
        var pos = sr.index.indexOf(k);
        if (pos !== -1) return js2py(sr.values[pos]);
        throw new Sk.builtin.KeyError(new Sk.builtin.str(k));
      }
      return js2py(sr.values[k]);
    });

    // arithmetic operators
    function makeOp(op) {
      return new Sk.builtin.func(function (self, other) {
        var sr = self.__dfd_sr;
        var dfd2 = ensureDfd();
        var o = other.__dfd_sr ? other.__dfd_sr.values : py2js(other);
        var res;
        if (Array.isArray(o)) {
          res = sr.values.map(function (v, i) { return eval(v + op + o[i]); });
        } else {
          res = sr.values.map(function (v) { return eval(v + op + o); });
        }
        return wrapSeries(new dfd2.Series(res, { index: sr.index }));
      });
    }
    $loc.__add__  = makeOp("+");
    $loc.__sub__  = makeOp("-");
    $loc.__mul__  = makeOp("*");
    $loc.__truediv__ = makeOp("/");
    $loc.__len__  = new Sk.builtin.func(function (self) { return new Sk.builtin.int_(self.__dfd_sr ? self.__dfd_sr.values.length : 0); });

    // Skulpt uses tp$richcompare for all comparisons, not __ge__ etc.
    $loc.__init__.$d = $loc.__init__.$d || {};
    function seriesCmp(self, other, op) {
      var sr = self.__dfd_sr;
      if (!sr || !sr.values) return Sk.builtin.NotImplemented.NotImplemented$;
      var dfd2 = ensureDfd();
      var o = py2js(other);
      var arr = sr.values.map(function (v) {
        if (op === "Eq")  return v === o;
        if (op === "NotEq") return v !== o;
        if (op === "Gt")  return v > o;
        if (op === "Lt")  return v < o;
        if (op === "GtE") return v >= o;
        if (op === "LtE") return v <= o;
        return false;
      });
      var result = wrapSeries(new dfd2.Series(arr, { index: sr.index }));      
      return result;
    }
    $loc.tp$richcompare = function (other, op) {
      return seriesCmp(this, other, op);
    };
    // Try every possible Skulpt calling convention for comparisons
    function makeCmp(skOp, jsOp) {
      var f = new Sk.builtin.func(function (a, b) {
        
        // Convention 1: called as unbound — f(self, other)
        if (a && a.__dfd_sr) return seriesCmp(a, b, skOp);
        // Convention 2: called as bound — f(other), 'this' is instance
        if (this && this.__dfd_sr) return seriesCmp(this, a, skOp);
        // Convention 3: only one arg, 'a' is 'other', self is lost — can't help
        return Sk.builtin.NotImplemented.NotImplemented$;
      });
      return f;
    }
    $loc.__eq__ = makeCmp("Eq",    "===");
    $loc.__ne__ = makeCmp("NotEq", "!==");
    $loc.__gt__ = makeCmp("Gt",    ">");
    $loc.__lt__ = makeCmp("Lt",    "<");
    $loc.__ge__ = makeCmp("GtE",   ">=");
    $loc.__le__ = makeCmp("LtE",   "<=");

    $loc.__and__ = new Sk.builtin.func(function (self, other) {
      var dfd2 = ensureDfd();
      var a = self.__dfd_sr.values, b = other.__dfd_sr.values;
      return wrapSeries(new dfd2.Series(a.map(function (v, i) { return v && b[i]; }), { index: self.__dfd_sr.index }));
    });
    $loc.__or__ = new Sk.builtin.func(function (self, other) {
      var dfd2 = ensureDfd();
      var a = self.__dfd_sr.values, b = other.__dfd_sr.values;
      return wrapSeries(new dfd2.Series(a.map(function (v, i) { return v || b[i]; }), { index: self.__dfd_sr.index }));
    });
    $loc.__invert__ = new Sk.builtin.func(function (self) {
      var dfd2 = ensureDfd();
      return wrapSeries(new dfd2.Series(self.__dfd_sr.values.map(function (v) { return !v; }), { index: self.__dfd_sr.index }));
    });

    $loc.__iter__ = new Sk.builtin.func(function (self) {
      var vals = self.__dfd_sr ? self.__dfd_sr.values : [];
      var i = 0;
      return new Sk.builtin.func(function () {
        if (i < vals.length) return js2py(vals[i++]);
        throw new Sk.builtin.StopIteration();
      });
    });

  }, "Series", []);

  // When Skulpt coerces a boolean Series to bool (for df[mask] subscript),
  // we stash the Series so mp$subscript can retrieve it.
  var _lastBoolSeries = null;
  mod.Series.prototype.nb$bool = function () {
    if (this.__dfd_sr) {
      _lastBoolSeries = this;  // stash for mp$subscript to use
      // Return true so Skulpt doesn't error — the actual mask is in _lastBoolSeries
      return true;
    }
    return this.__dfd_sr ? this.__dfd_sr.values.some(Boolean) : false;
  };

  // Patch tp$richcompare onto the Series prototype directly after buildClass.
  // Skulpt's buildClass copies $loc entries but richcompare must be on the prototype.
  mod.Series.prototype.tp$richcompare = function (other, op) {
    var sr = this.__dfd_sr;
    if (!sr || !sr.values) return Sk.builtin.NotImplemented.NotImplemented$;
    var dfd2 = ensureDfd();
    var o = py2js(other);
    var arr = sr.values.map(function (v) {
      if (op === "Eq")    return v === o;
      if (op === "NotEq") return v !== o;
      if (op === "Gt")    return v > o;
      if (op === "Lt")    return v < o;
      if (op === "GtE")   return v >= o;
      if (op === "LtE")   return v <= o;
      return false;
    });
    return wrapSeries(new dfd2.Series(arr, { index: sr.index }));
  };

  // String accessor
  function makeStrAccessor(sr) {
    var dfd2 = ensureDfd();
    var acc = {};
    function strMap(fn) {
      return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return v == null ? null : fn(String(v)); }), { index: sr.index }));
    }
    acc.upper    = new Sk.builtin.func(function () { return strMap(function (s) { return s.toUpperCase(); }); });
    acc.lower    = new Sk.builtin.func(function () { return strMap(function (s) { return s.toLowerCase(); }); });
    acc.strip    = new Sk.builtin.func(function () { return strMap(function (s) { return s.trim(); }); });
    acc.len      = new Sk.builtin.func(function () { return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return v == null ? null : String(v).length; }), { index: sr.index })); });
    acc.contains = new Sk.builtin.func(function (sub) { var s = py2js(sub); return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return v == null ? false : String(v).includes(s); }), { index: sr.index })); });
    acc.startswith = new Sk.builtin.func(function (sub) { var s = py2js(sub); return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return v == null ? false : String(v).startsWith(s); }), { index: sr.index })); });
    acc.endswith   = new Sk.builtin.func(function (sub) { var s = py2js(sub); return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return v == null ? false : String(v).endsWith(s); }), { index: sr.index })); });
    acc.replace    = new Sk.builtin.func(function (pat, repl) { var p = py2js(pat), r = py2js(repl); return strMap(function (s) { return s.split(p).join(r); }); });
    acc.split      = new Sk.builtin.func(function (sep) { var s = py2js(sep); return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return v == null ? [] : String(v).split(s); }), { index: sr.index })); });
    acc.get        = new Sk.builtin.func(function (i2) { var idx = py2js(i2); return wrapSeries(new dfd2.Series(sr.values.map(function (v) { return v == null ? null : (Array.isArray(v) ? v[idx] : String(v)[idx]); }), { index: sr.index })); });
    // proxy via __getattr__
    var proxy = {
      tp$getattr: function (name) {
        var n = typeof name === "string" ? name : name.v;
        if (acc[n]) return acc[n];
        throw new Sk.builtin.AttributeError(new Sk.builtin.str("str accessor has no attribute '" + n + "'"));
      }
    };
    return proxy;
  }

  // Datetime accessor
  function makeDtAccessor(sr) {
    var dfd2 = ensureDfd();
    function dtMap(fn) {
      return wrapSeries(new dfd2.Series(sr.values.map(function (v) { try { return fn(new Date(v)); } catch(e) { return null; } }), { index: sr.index }));
    }
    var acc = {};
    acc.year    = { tp$getattr: function () { return dtMap(function (d) { return d.getFullYear(); }); } };
    acc.month   = { tp$getattr: function () { return dtMap(function (d) { return d.getMonth() + 1; }); } };
    acc.day     = { tp$getattr: function () { return dtMap(function (d) { return d.getDate(); }); } };
    acc.hour    = { tp$getattr: function () { return dtMap(function (d) { return d.getHours(); }); } };
    acc.minute  = { tp$getattr: function () { return dtMap(function (d) { return d.getMinutes(); }); } };
    acc.second  = { tp$getattr: function () { return dtMap(function (d) { return d.getSeconds(); }); } };
    acc.dayofweek = { tp$getattr: function () { return dtMap(function (d) { return d.getDay(); }); } };
    var proxy = {
      tp$getattr: function (name) {
        var n = typeof name === "string" ? name : name.v;
        if (acc[n]) return acc[n].tp$getattr();
        throw new Sk.builtin.AttributeError(new Sk.builtin.str("dt accessor has no attribute '" + n + "'"));
      }
    };
    return proxy;
  }

  // ─── GroupBy ─────────────────────────────────────────────────────────────────

  // Translate an ASCII alias (produced by the Cyrillic-identifier
  // preprocessor in lib.js) back to the real column name, e.g.
  // "_cyr1_" -> "ціна_за_кг", so gb.ціна_за_кг resolves correctly.
  function resolveCyrAlias(n) {
    if (typeof window !== "undefined" && window.__pandasCyrAliasMap && window.__pandasCyrAliasMap[n]) {
      return window.__pandasCyrAliasMap[n];
    }
    return n;
  }

  function wrapGroupBy(df, byCol) {
    var obj = {};
    obj.__df = df;
    obj.__by = byCol;

    function makeAgg(method) {
      return new Sk.builtin.func(function () {
        var dfd2 = ensureDfd();
        var gb   = df.groupby([byCol]);
        var res  = gb[method]();
        // Track the group key as the index name (mirrors real pandas, where
        // groupby(...).agg(...) leaves the index named after the group key).
        // Doing this lets reset_index() later use that real name instead of
        // falling back to the literal string "index" — see the note in
        // reset_index() for why a literal "index" column name is dangerous.
        res.__indexName = byCol;
        return wrapDataFrame(res);
      });
    }

    obj.tp$getattr = function (name) {
      var n = resolveCyrAlias(typeof name === "string" ? name : name.v);
      if (n === "mean")  return makeAgg("mean");
      if (n === "sum")   return makeAgg("sum");
      if (n === "min")   return makeAgg("min");
      if (n === "max")   return makeAgg("max");
      if (n === "count") return makeAgg("count");
      if (n === "size")  return new Sk.builtin.func(function () {
        // manual count per group
        var groups = {};
        var col = df[byCol].values;
        col.forEach(function (v) { groups[v] = (groups[v] || 0) + 1; });
        var dfd2 = ensureDfd();
        return wrapSeries(new dfd2.Series(Object.values(groups), { index: Object.keys(groups) }));
      });
      if (n === "agg" || n === "aggregate") return kwFunc(function (args, kw) {
        var dfd2 = ensureDfd();
        var kwNames = Object.keys(kw);

        // Named aggregation: gb.agg(new_col=('source_col', 'func'), ...)
        // Skulpt only reaches here (rather than erroring on kwargs) because
        // this is a kwFunc; a plain Sk.builtin.func rejects any keyword
        // argument outright, which is what caused the original TypeError.
        if (kwNames.length > 0) {
          function aggregateOne(vals, method) {
            var nums = vals.filter(function (v) { return v !== null && v !== undefined && !(typeof v === "number" && isNaN(v)); });
            switch (method) {
              case "count": return nums.length;
              case "sum":   return nums.reduce(function (a, b) { return a + b; }, 0);
              case "mean":  return nums.length ? nums.reduce(function (a, b) { return a + b; }, 0) / nums.length : null;
              case "min":   return nums.length ? Math.min.apply(null, nums) : null;
              case "max":   return nums.length ? Math.max.apply(null, nums) : null;
              default:      return null;
            }
          }
          var keys = dfGetColumn(df, byCol);
          var order = [];
          var groupIdx = {};
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (!groupIdx[k]) { groupIdx[k] = []; order.push(k); }
            groupIdx[k].push(i);
          }
          order.sort();
          var result = {};
          kwNames.forEach(function (rawOutName) {
            // rawOutName may be an ASCII alias standing in for a Cyrillic
            // identifier (Skulpt's preprocessor renames Cyrillic keyword-
            // argument names before compiling) — translate back so the
            // resulting DataFrame has the real column name the user wrote,
            // not a "_cyr0_"-style placeholder.
            var outName = resolveCyrAlias(rawOutName);
            var spec = py2js(kw[rawOutName]); // (source_col, func_name) tuple -> [col, func]
            var srcCol = spec[0], method = spec[1];
            var vals = dfGetColumn(df, srcCol);
            result[outName] = order.map(function (k) {
              var colVals = groupIdx[k].map(function (ii) { return vals[ii]; });
              return aggregateOne(colVals, method);
            });
          });
          var namedDf = new dfd2.DataFrame(result, { index: order });
          namedDf.__indexName = byCol;
          return wrapDataFrame(namedDf);
        }

        // simple: single string, e.g. gb.agg('mean')
        var f = py2js(args[0]);
        if (typeof f === "string") return makeAgg(f).v();
        // dict {col: func} — best-effort
        return makeAgg("mean").v();
      });
      if (n === "__getitem__") return new Sk.builtin.func(function (_, col2) {
        // df.groupby(by)[col].agg()  or  df.groupby(by)[[col1, col2]].agg()
        var colName = py2js(col2);
        if (Array.isArray(colName)) return wrapGroupByFrame(df, byCol, colName);
        return wrapGroupBySeries(df, byCol, colName);
      });
      // attribute access for a specific column, e.g. gb.ціна_за_кг
      // (equivalent to gb['ціна_за_кг']) — mirrors real pandas behaviour.
      if (df.columns.indexOf(n) !== -1) {
        return wrapGroupBySeries(df, byCol, n);
      }
      throw new Sk.builtin.AttributeError(new Sk.builtin.str("GroupBy has no attribute '" + n + "'"));
    };
    obj.mp$subscript = function (key) {
      var colName = py2js(key);
      if (Array.isArray(colName)) return wrapGroupByFrame(df, byCol, colName);
      return wrapGroupBySeries(df, byCol, colName);
    };
    return obj;
  }

  // Handles df.groupby(byCol)[list_of_cols].mean() etc. — same manual
  // grouping approach as wrapGroupBySeries, but aggregates several target
  // columns at once and returns a DataFrame (one output column per
  // selected input column) instead of a single Series.
  function wrapGroupByFrame(df, byCol, valCols) {
    var obj = {};

    function aggregateOne(vals, method) {
      var nums = vals.filter(function (v) { return v !== null && v !== undefined && !(typeof v === "number" && isNaN(v)); });
      switch (method) {
        case "count": return nums.length;
        case "sum":   return nums.reduce(function (a, b) { return a + b; }, 0);
        case "mean":  return nums.length ? nums.reduce(function (a, b) { return a + b; }, 0) / nums.length : null;
        case "min":   return nums.length ? Math.min.apply(null, nums) : null;
        case "max":   return nums.length ? Math.max.apply(null, nums) : null;
        default:      return null;
      }
    }

    function computeAggFrame(method) {
      var dfd2 = ensureDfd();
      var keys = dfGetColumn(df, byCol);
      var order = [];
      var groupIdx = {};
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!groupIdx[k]) { groupIdx[k] = []; order.push(k); }
        groupIdx[k].push(i);
      }
      order.sort();
      var result = {};
      valCols.forEach(function (vc) {
        var vals = dfGetColumn(df, vc);
        result[vc] = order.map(function (k) {
          var colVals = groupIdx[k].map(function (ii) { return vals[ii]; });
          return aggregateOne(colVals, method);
        });
      });
      var aggDf = new dfd2.DataFrame(result, { index: order });
      aggDf.__indexName = byCol;
      return aggDf;
    }

    function makeAgg(method) {
      return new Sk.builtin.func(function () {
        return wrapDataFrame(computeAggFrame(method));
      });
    }

    obj.tp$getattr = function (name) {
      var n = resolveCyrAlias(typeof name === "string" ? name : name.v);
      if (["mean", "sum", "min", "max", "count"].indexOf(n) !== -1) return makeAgg(n);
      if (n === "agg" || n === "aggregate") return new Sk.builtin.func(function (funcs) {
        var f = py2js(funcs);
        if (typeof f === "string") return makeAgg(f).v();
        // list of function names isn't well-defined for a multi-column
        // selection with multiple funcs (would need a MultiIndex); fall
        // back to the first requested function as a reasonable default.
        var fnList = Array.isArray(f) ? f : [f];
        return makeAgg(fnList[0] || "mean").v();
      });
      throw new Sk.builtin.AttributeError(new Sk.builtin.str("GroupBy has no attribute '" + n + "'"));
    };
    return obj;
  }

  function wrapGroupBySeries(df, byCol, valCol) {
    var obj = {};

    // Manual (pure-JS) groupby aggregation for a single target column.
    // We deliberately avoid delegating to danfo's own groupby(...)[method]()
    // here: danfo's internal aggregation breaks in this bundle when run on
    // a narrowed 2-column DataFrame (throws "r[0] is undefined") and also
    // breaks on the original full DataFrame when it contains non-numeric
    // columns (throws "Can't perform math operation on column X"). Doing
    // the grouping/aggregating ourselves sidesteps both bugs.
    function computeGroupsManually() {
      var keys = dfGetColumn(df, byCol);
      var vals = dfGetColumn(df, valCol);
      var order = []; // preserve first-seen order, then sort like pandas does
      var groups = {};
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(vals[i]);
      }
      // pandas groupby sorts group keys ascending by default
      order.sort();
      return { order: order, groups: groups };
    }

    function aggregateOne(vals, method) {
      var nums = vals.filter(function (v) { return v !== null && v !== undefined && !(typeof v === "number" && isNaN(v)); });
      switch (method) {
        case "count": return nums.length;
        case "sum":   return nums.reduce(function (a, b) { return a + b; }, 0);
        case "mean":  return nums.length ? nums.reduce(function (a, b) { return a + b; }, 0) / nums.length : null;
        case "min":   return nums.length ? Math.min.apply(null, nums) : null;
        case "max":   return nums.length ? Math.max.apply(null, nums) : null;
        default:      return null;
      }
    }

    function computeAggSeries(method) {
      var dfd2 = ensureDfd();
      var g = computeGroupsManually();
      var values = g.order.map(function (k) { return aggregateOne(g.groups[k], method); });
      var res = new dfd2.Series(values, { index: g.order, name: valCol });
      // Mirrors aggDf.__indexName = byCol elsewhere in this file: a
      // groupby(...)[col].agg() result's index is named after the group
      // key. reset_index() (Series version, above) reads this to restore
      // the real column name instead of falling back to "index".
      res.__indexName = byCol;
      return res;
    }

    function makeAgg(method) {
      return new Sk.builtin.func(function () {
        var sr = computeAggSeries(method);
        return wrapSeries(sr);
      });
    }
    obj.tp$getattr = function (name) {
      var n = resolveCyrAlias(typeof name === "string" ? name : name.v);
      if (["mean", "sum", "min", "max", "count"].indexOf(n) !== -1) return makeAgg(n);
      if (n === "agg" || n === "aggregate") return new Sk.builtin.func(function (funcs) {
        var dfd2 = ensureDfd();
        var f = py2js(funcs);
        // single function name -> returns a Series (pandas behaviour)
        if (typeof f === "string") return makeAgg(f).v();
        // list of function names -> returns a DataFrame: one column per
        // aggregation, indexed by group key (matches real pandas)
        var fnList = Array.isArray(f) ? f : [f];
        var index = null;
        var result = {};
        fnList.forEach(function (fn) {
          var sr = computeAggSeries(fn);
          if (sr) {
            if (!index) index = sr.index;
            result[fn] = sr.values;
          }
        });
        var aggDf = new dfd2.DataFrame(result, index ? { index: index } : {});
        aggDf.__indexName = byCol; // see makeAgg() above for why this matters
        return wrapDataFrame(aggDf);
      });
      throw new Sk.builtin.AttributeError(new Sk.builtin.str("GroupBy has no attribute '" + n + "'"));
    };
    obj.mp$subscript = function (key) {
      // e.g. gb['ціна_за_кг']['mean'] isn't standard pandas, but keep the
      // door open the same way DataFrame/Series do elsewhere.
      var n = py2js(key);
      if (["mean", "sum", "min", "max", "count"].indexOf(n) !== -1) return makeAgg(n).v();
      return js2py(null);
    };
    return obj;
  }

  // ─── DataFrame ──────────────────────────────────────────────────────────────

  function wrapDataFrame(df) {
    var pydf = Sk.misceval.callsim(mod.DataFrame, Sk.builtin.none.none$);
    pydf.__dfd_df = df;
    return pydf;
  }

  mod.DataFrame = Sk.misceval.buildClass(mod, function ($gbl, $loc) {

    $loc.__init__ = kwInitFunc(function (self, args, kw) {
      var dfd = ensureDfd();
      var data = argOrKw(args, 0, kw, "data", null);
      var index = argOrKw(args, 1, kw, "index", null);
      var columns = argOrKw(args, 2, kw, "columns", null);
      if (data === null || data === undefined) return;
      var opts = {};
      if (index) opts.index = index;
      if (columns) opts.columns = columns;
      if (Array.isArray(data)) {
        // list of dicts (or list of lists, paired with columns)
        self.__dfd_df = new dfd.DataFrame(data, opts);
      } else if (typeof data === "object") {
        // dict of lists
        self.__dfd_df = new dfd.DataFrame(data, opts);
      }
    });

    $loc.__repr__ = new Sk.builtin.func(function (self) {
      if (!self.__dfd_df) return new Sk.builtin.str("DataFrame(empty)");
      return new Sk.builtin.str(dfToString(self.__dfd_df));
    });
    $loc.__str__ = $loc.__repr__;

    $loc.__len__ = new Sk.builtin.func(function (self) {
      return new Sk.builtin.int_(self.__dfd_df ? self.__dfd_df.shape[0] : 0);
    });

    $loc.__getitem__ = new Sk.builtin.func(function (self, key) {
      return dfSubscript(self.__dfd_df, key);
    });

    // mp$subscript is called by Skulpt BEFORE any bool coercion — use this
    // to intercept boolean Series masks reliably
    $loc.mp$subscript = function (key) {
      return dfSubscript(this.__dfd_df, key);
    };

    $loc.__setitem__ = new Sk.builtin.func(function (self, key, value) {
      var df = self.__dfd_df;
      if (!df) return;
      var colName = py2js(key);
      var colVals;
      if (value.__dfd_sr) {
        colVals = value.__dfd_sr.values;
      } else {
        colVals = py2js(value);
        if (!Array.isArray(colVals)) {
          colVals = new Array(df.shape[0]).fill(colVals);
        }
      }
      var dfd2 = ensureDfd();
      df.addColumn(colName, colVals, { inplace: true });
    });

    $loc.__getattr__ = new Sk.builtin.func(function (self, name) {
      var n = Sk.ffi.remapToJs(name);
      // Translate an ASCII alias (produced by the Cyrillic-identifier
      // preprocessor in lib.js) back to the real column name, e.g.
      // "_cyr0_" -> "ціна_за_кг", so shop._cyr0_ resolves correctly.
      if (typeof window !== "undefined" && window.__pandasCyrAliasMap && window.__pandasCyrAliasMap[n]) {
        n = window.__pandasCyrAliasMap[n];
      }
      var df = self.__dfd_df;
      if (!df) throw new Sk.builtin.AttributeError(name);

      // ── properties ─────────────────────────────────────────────────────────
      if (n === "shape")   return new Sk.builtin.tuple([new Sk.builtin.int_(df.shape[0]), new Sk.builtin.int_(df.shape[1])]);
      if (n === "columns") return new Sk.builtin.list(df.columns.map(function (c) { return new Sk.builtin.str(c); }));
      if (n === "index")   return new Sk.builtin.list(dfGetIndexArray(df.index).map(js2py));
      if (n === "dtypes") {
          var dtObj = {};
          df.columns.forEach(function (c) {
              var colIndex = df.columns.indexOf(c);
              // ✅ ВИПРАВЛЕННЯ: df.ctypes - це масив, тому беремо за індексом, а не за ім'ям
              var danfoType = df.ctypes[colIndex]; 
              var normalized = normalizeDtype(danfoType, dfGetColumn(df, c));
              console.log("normalized =",normalized )
              dtObj[c] = normalized;
          });
          
          // Перетворюємо словник типів на pandas Series для коректного виводу
          var dfd2 = ensureDfd();
          var keys = Object.keys(dtObj);
          var vals = keys.map(function(k) { return dtObj[k]; });
          var dtSr = new dfd2.Series(vals, { index: keys });
          return wrapSeries(dtSr);
      }
      if (n === "values") {
        return new Sk.builtin.list(df.values.map(function (row) { return new Sk.builtin.list(row.map(js2py)); }));
      }
      if (n === "size") return new Sk.builtin.int_(df.shape[0] * df.shape[1]);
      if (n === "empty") return new Sk.builtin.bool(df.shape[0] === 0);

      // ── loc / iloc ─────────────────────────────────────────────────────────
      if (n === "loc")  return makeLocProxy(df, false);
      if (n === "iloc") return makeLocProxy(df, true);
      if (n === "at")   return makeLocProxy(df, false);
      if (n === "iat")  return makeLocProxy(df, true);

      // ── methods ────────────────────────────────────────────────────────────
      if (n === "head") return new Sk.builtin.func(function (n2) { return wrapDataFrame(df.head(n2 ? py2js(n2) : 5)); });
      if (n === "tail") return new Sk.builtin.func(function (n2) { return wrapDataFrame(df.tail(n2 ? py2js(n2) : 5)); });

      if (n === "info") return new Sk.builtin.func(function () {
        var lines = ["<class 'pandas.core.frame.DataFrame'>",
          "RangeIndex: " + df.shape[0] + " entries",
          "Data columns (total " + df.shape[1] + " columns):"];
        df.columns.forEach(function (c, i) {
          lines.push(" " + pad(i, 3) + "  " + pad(c, 20) + df.shape[0] + " non-null  " + normalizeDtype(df.ctypes[c], dfGetColumn(df, c)));
        });
        Sk.builtin.print([new Sk.builtin.str(lines.join("\n"))]);
        return Sk.builtin.none.none$;
      });

      if (n === "describe") return new Sk.builtin.func(function () {
        var dfd2 = ensureDfd();
        return wrapDataFrame(df.describe());
      });

      if (n === "copy") return new Sk.builtin.func(function () {
        var dfd2 = ensureDfd();
        return wrapDataFrame(new dfd2.DataFrame(df.values, { columns: df.columns, index: df.index }));
      });

      function isNaVal(v) { return v === null || v === undefined || (typeof v === "number" && isNaN(v)); }

      if (n === "dropna") return kwFunc(function(args, kw) {
        var axis = kwGet(kw, "axis", 0);
        var how = kwGet(kw, "how", "any");
        var subset = kwGet(kw, "subset", null);
        var inplace = kwGet(kw, "inplace", false);
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var allRows = dfGet2DValues(df);
        var idx = df.index;
        if (axis === 1 || axis === "columns") {
          var keepCols = cols2.filter(function (c, ci) {
            var colVals = allRows.map(function (row) { return row[ci]; });
            var nas = colVals.filter(isNaVal).length;
            return how === "all" ? nas < colVals.length : nas === 0;
          });
          var result2 = {};
          keepCols.forEach(function (c) { result2[c] = df[c].values; });
          var newDf2 = new dfd2.DataFrame(result2, { index: idx });
          if (inplace) { self.__dfd_df = newDf2; return Sk.builtin.none.none$; }
          return wrapDataFrame(newDf2);
        }
        var checkCols = subset ? subset.map(function (c) { return cols2.indexOf(c); }) : cols2.map(function (_, i) { return i; });
        var result = {};
        cols2.forEach(function (c) { result[c] = []; });
        var newIdx = [];
        allRows.forEach(function (row, ri) {
          var relevant = checkCols.map(function (ci) { return row[ci]; });
          var nas = relevant.filter(isNaVal).length;
          var keep = how === "all" ? nas < relevant.length : nas === 0;
          if (keep) {
            cols2.forEach(function (c, ci) { result[c].push(row[ci]); });
            newIdx.push(idx[ri]);
          }
        });
        var newDf = new dfd2.DataFrame(result, { index: newIdx });
        if (inplace) { self.__dfd_df = newDf; return Sk.builtin.none.none$; }
        return wrapDataFrame(newDf);
      });

      if (n === "fillna") return kwFunc(function(args, kw) {
        var value = argOrKw(args, 0, kw, "value", undefined);
        var method = kwGet(kw, "method", null);
        var inplace = kwGet(kw, "inplace", false);
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var allRows = dfGet2DValues(df);
        var isPerColumn = value !== null && typeof value === "object" && !Array.isArray(value);
        var result = {};
        cols2.forEach(function (c, ci) {
          var colVals = allRows.map(function (row) { return row[ci]; });
          var fillVal = isPerColumn ? value[c] : value;
          var out = [];
          var last = null;
          colVals.forEach(function (v) {
            if (!isNaVal(v)) { out.push(v); last = v; return; }
            if (method === "ffill" || method === "pad") { out.push(last !== null ? last : null); return; }
            if (method === "bfill" || method === "backfill") { out.push(null); return; }
            out.push(fillVal !== undefined ? fillVal : null);
          });
          if (method === "bfill" || method === "backfill") {
            var next = null;
            for (var ri = out.length - 1; ri >= 0; ri--) {
              if (!isNaVal(colVals[ri])) next = colVals[ri];
              else out[ri] = next;
            }
          }
          result[c] = out;
        });
        var newDf = new dfd2.DataFrame(result, { index: df.index });
        if (inplace) { self.__dfd_df = newDf; return Sk.builtin.none.none$; }
        return wrapDataFrame(newDf);
      });

      if (n === "isna")  return new Sk.builtin.func(function () { return wrapDataFrame(df.isNa()); });
      if (n === "notna") return new Sk.builtin.func(function () { return wrapDataFrame(df.notNa()); });
      if (n === "isnull")  return new Sk.builtin.func(function () { return wrapDataFrame(df.isNa()); });
      if (n === "notnull") return new Sk.builtin.func(function () { return wrapDataFrame(df.notNa()); });

      if (n === "sort_values") return kwFunc(function(args, kw) {
        var col = argOrKw(args, 0, kw, "by", null);
        var asc = kwGet(kw, "ascending", true);
        var inplace = kwGet(kw, "inplace", false);
        if (col === null) return inplace ? Sk.builtin.none.none$ : wrapDataFrame(df);
        var sortCol = Array.isArray(col) ? col[0] : col;
        // sort manually using dfGet2DValues to avoid danfo serialisation bugs
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var allRows = dfGet2DValues(df);
        var idx = df.index;
        var ci = cols2.indexOf(sortCol);
        if (ci === -1) return inplace ? Sk.builtin.none.none$ : wrapDataFrame(df);
        // pair each row with its original index
        var paired = allRows.map(function(row, i) { return { row: row, idx: idx[i] }; });
        paired.sort(function(a, b) {
          var va = a.row[ci], vb = b.row[ci];
          if (va === null || va === undefined) return 1;
          if (vb === null || vb === undefined) return -1;
          return asc ? (va > vb ? 1 : va < vb ? -1 : 0)
                     : (va < vb ? 1 : va > vb ? -1 : 0);
        });
        // Build via an explicit 2D array + columns list rather than a plain
        // {col: [values]} object — see the note in reset_index() below:
        // danfo's object-based constructor special-cases a key literally
        // named "index" (which exists here whenever sort_values runs on a
        // frame produced by reset_index()), corrupting the resulting index
        // and causing "Row index must contain unique values" on the next
        // operation that rebuilds the frame the same way.
        var newRowsSorted = [];
        var newIdx = [];
        paired.forEach(function(p) {
          newRowsSorted.push(p.row.slice());
          newIdx.push(p.idx);
        });
        var newDf = new dfd2.DataFrame(newRowsSorted, { columns: cols2.slice(), index: newIdx });
        if (inplace) { self.__dfd_df = newDf; return Sk.builtin.none.none$; }
        return wrapDataFrame(newDf);
      });

      if (n === "sort_index") return kwFunc(function(args, kw) {
        var asc = kwGet(kw, "ascending", true);
        var inplace = kwGet(kw, "inplace", false);
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var allRows = dfGet2DValues(df);
        var idx = df.index;
        var paired = allRows.map(function (row, i) { return { row: row, idx: idx[i] }; });
        paired.sort(function (a, b) {
          return asc ? (a.idx > b.idx ? 1 : a.idx < b.idx ? -1 : 0)
                     : (a.idx < b.idx ? 1 : a.idx > b.idx ? -1 : 0);
        });
        // Same fix as sort_values() above: use 2D array + columns instead
        // of an object keyed by column name, to avoid danfo's special
        // handling of a column literally named "index".
        var newRowsSortedIdx = [];
        var newIdx = [];
        paired.forEach(function (p) {
          newRowsSortedIdx.push(p.row.slice());
          newIdx.push(p.idx);
        });
        var newDf = new dfd2.DataFrame(newRowsSortedIdx, { columns: cols2.slice(), index: newIdx });
        if (inplace) { self.__dfd_df = newDf; return Sk.builtin.none.none$; }
        return wrapDataFrame(newDf);
      });

      if (n === "reset_index") return kwFunc(function(args, kw) {
        var drop = kwGet(kw, "drop", false);
        var inplace = kwGet(kw, "inplace", false);
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var allRows = dfGet2DValues(df);
        // Build via an explicit 2D array + columns list rather than a plain
        // {col: [values]} object. danfo's object-based DataFrame constructor
        // special-cases a key literally named "index" (used to set the
        // frame's own index instead of creating a real column), which
        // corrupts the resulting index and later breaks things like
        // sort_values with "Row index must contain unique values". Passing
        // a 2D array + explicit column names sidesteps that entirely.
        var newCols = [];
        var oldIdx = df.index.slice();
        // Real pandas names the restored column after df.index.name, falling
        // back to the literal "index" only when the index is unnamed. This
        // also sidesteps a danfojs quirk where a column literally named
        // "index" can get corrupted by the library's special-cased handling
        // of that name, which previously surfaced later as "Row index must
        // contain unique values" (e.g. after a groupby().agg() whose index
        // name wasn't being tracked, forcing the "index" fallback here even
        // though the real index had a proper name like the group-by key).
        var indexColName = df.__indexName ? String(df.__indexName) : "index";
        if (!drop) newCols.push(indexColName);
        newCols = newCols.concat(cols2);
        var newRows = allRows.map(function (row, ri) {
          var newRow = [];
          if (!drop) newRow.push(oldIdx[ri]);
          return newRow.concat(row);
        });
        var newDf = new dfd2.DataFrame(newRows, { columns: newCols });
        if (inplace) { self.__dfd_df = newDf; return Sk.builtin.none.none$; }
        return wrapDataFrame(newDf);
      });

      if (n === "set_index") return kwFunc(function(args, kw) {
        var col = argOrKw(args, 0, kw, "keys", null);
        var drop = kwGet(kw, "drop", true);
        var inplace = kwGet(kw, "inplace", false);
        // Reimplemented manually rather than delegating to danfo's own
        // setIndex(), which in this bundle miscounts rows (e.g. throwing
        // "index of length 10 but Ndframe rows has length of 5" for a
        // 5-row x 2-column frame — it appears to be counting flattened
        // values instead of row count). Same pattern as sort_values() /
        // reset_index() above: pull a 2D array via dfGet2DValues and
        // rebuild the frame by hand.
        var setIdxCol = Array.isArray(col) ? col[0] : col;
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var ci = cols2.indexOf(setIdxCol);
        if (ci === -1) return inplace ? Sk.builtin.none.none$ : wrapDataFrame(df);
        var allRows = dfGet2DValues(df);
        var newIdx = allRows.map(function (row) { return row[ci]; });
        var newCols = drop ? cols2.filter(function (c) { return c !== setIdxCol; }) : cols2.slice();
        var newRows = allRows.map(function (row) {
          return drop ? row.filter(function (v, i) { return i !== ci; }).slice() : row.slice();
        });
        var newDf = new dfd2.DataFrame(newRows, { columns: newCols, index: newIdx });
        // Track the original column name so a later reset_index() restores
        // it under its real name instead of falling back to "index".
        newDf.__indexName = setIdxCol;
        if (inplace) { self.__dfd_df = newDf; return Sk.builtin.none.none$; }
        return wrapDataFrame(newDf);
      });

      if (n === "rename") return kwFunc(function(args, kw) {
        var columnsMap = kwGet(kw, "columns", null);
        var indexMap = kwGet(kw, "index", null);
        var mapper = argOrKw(args, 0, kw, "mapper", null);
        var inplace = kwGet(kw, "inplace", false);
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var newCols = cols2.map(function (c) {
          if (columnsMap && columnsMap.hasOwnProperty(c)) return columnsMap[c];
          if (mapper && typeof mapper === "object" && mapper.hasOwnProperty(c)) return mapper[c];
          return c;
        });
        var newIdx = dfGetIndexArray(df.index);
        if (indexMap) {
          newIdx = newIdx.map(function (i) { return indexMap.hasOwnProperty(i) ? indexMap[i] : i; });
        }
        var allRows = dfGet2DValues(df);
        var result = {};
        newCols.forEach(function (c, ci) { result[c] = allRows.map(function (row) { return row[ci]; }); });
        var newDf = new dfd2.DataFrame(result, { index: newIdx });
        if (inplace) { self.__dfd_df = newDf; return Sk.builtin.none.none$; }
        return wrapDataFrame(newDf);
      });

      if (n === "rename_axis") return kwFunc(function(args, kw) {
        var mapper = argOrKw(args, 0, kw, "mapper", null);
        var axis = kwGet(kw, "axis", 0);
        var inplace = kwGet(kw, "inplace", false);
        var name = py2js(mapper);
        var isColsAxis = (axis === 1 || axis === "columns");
        var targetDf = df;
        if (!inplace) {
          var dfd2 = ensureDfd();
          targetDf = new dfd2.DataFrame(dfGet2DValues(df), { columns: df.columns.slice(), index: df.index.slice() });
          // carry over any existing axis name not being changed
          targetDf.__indexName = df.__indexName;
          targetDf.__columnsName = df.__columnsName;
        }
        if (isColsAxis) { targetDf.__columnsName = name; } else { targetDf.__indexName = name; }
        if (inplace) { return Sk.builtin.none.none$; }
        return wrapDataFrame(targetDf);
      });

      if (n === "drop") return kwFunc(function(args, kw) {
        var labels = argOrKw(args, 0, kw, "labels", null);
        var axis = kwGet(kw, "axis", 1);
        var columnsArg = kwGet(kw, "columns", null);
        var indexArg = kwGet(kw, "index", null);
        var inplace = kwGet(kw, "inplace", false);
        var dfd2 = ensureDfd();
        var dropCols = columnsArg !== null ? (Array.isArray(columnsArg) ? columnsArg : [columnsArg]) : null;
        var dropIdx = indexArg !== null ? (Array.isArray(indexArg) ? indexArg : [indexArg]) : null;
        if (!dropCols && !dropIdx && labels !== null) {
          var lbls = Array.isArray(labels) ? labels : [labels];
          if (axis === 1 || axis === "columns") dropCols = lbls; else dropIdx = lbls;
        }
        var res = df;
        if (dropCols) { try { res = res.drop({ columns: dropCols }); } catch (e) {} }
        if (dropIdx) {
          var cols2 = res.columns;
          var allRows = dfGet2DValues(res);
          var idx2 = res.index;
          var result = {};
          cols2.forEach(function (c) { result[c] = []; });
          var newIdx = [];
          allRows.forEach(function (row, ri) {
            if (dropIdx.indexOf(idx2[ri]) === -1) {
              cols2.forEach(function (c, ci) { result[c].push(row[ci]); });
              newIdx.push(idx2[ri]);
            }
          });
          res = new dfd2.DataFrame(result, { index: newIdx });
        }
        if (inplace) { self.__dfd_df = res; return Sk.builtin.none.none$; }
        return wrapDataFrame(res);
      });

      if (n === "groupby") return kwFunc(function(args, kw) {
        var by = argOrKw(args, 0, kw, "by", null);
        var col = Array.isArray(by) ? by[0] : by; // simplified: single col
        return wrapGroupBy(df, col);
      });

      if (n === "merge") return kwFunc(function(args, kw) {
        var right = args[0];
        var rdf = right.__dfd_df;
        var on = kwGet(kw, "on", null);
        var leftOn = kwGet(kw, "left_on", null);
        var rightOn = kwGet(kw, "right_on", null);
        var how = kwGet(kw, "how", "inner");
        var dfd2 = ensureDfd();
        var onCol = on || leftOn || rightOn;
        return wrapDataFrame(dfd2.merge({ left: df, right: rdf, on: [onCol], how: how }));
      });

      if (n === "join") return kwFunc(function(args, kw) {
        var other = args[0];
        var how = kwGet(kw, "how", "left");
        var lsuffix = kwGet(kw, "lsuffix", "");
        var rsuffix = kwGet(kw, "rsuffix", "");
        var dfd2 = ensureDfd();
        var odf = other.__dfd_df;
        var leftCols = df.columns, rightCols = odf.columns;
        // pandas .join() matches on the index (not the first column, and not
        // an on= column — that's merge()'s job), and renames any overlapping
        // column names using lsuffix/rsuffix so they don't collide.
        var overlap = leftCols.filter(function (c) { return rightCols.indexOf(c) !== -1; });
        var newLeftNames = leftCols.map(function (c) { return overlap.indexOf(c) !== -1 ? c + lsuffix : c; });
        var newRightNames = rightCols.map(function (c) { return overlap.indexOf(c) !== -1 ? c + rsuffix : c; });

        var leftRows = dfGet2DValues(df);
        var rightRows = dfGet2DValues(odf);
        var leftIdx = df.index, rightIdx = odf.index;

        var rightMap = {};
        rightIdx.forEach(function (ix, ri) { rightMap[ix] = rightRows[ri]; });
        var nullRight = rightCols.map(function () { return null; });
        var nullLeft = leftCols.map(function () { return null; });

        var resultIndex = [], resultRows = [];
        if (how === "left" || how === "outer") {
          leftIdx.forEach(function (ix, li) {
            var rrow = rightMap.hasOwnProperty(ix) ? rightMap[ix] : nullRight;
            resultIndex.push(ix);
            resultRows.push(leftRows[li].concat(rrow));
          });
          if (how === "outer") {
            rightIdx.forEach(function (ix, ri) {
              if (leftIdx.indexOf(ix) === -1) {
                resultIndex.push(ix);
                resultRows.push(nullLeft.concat(rightRows[ri]));
              }
            });
          }
        } else if (how === "inner") {
          leftIdx.forEach(function (ix, li) {
            if (rightMap.hasOwnProperty(ix)) {
              resultIndex.push(ix);
              resultRows.push(leftRows[li].concat(rightMap[ix]));
            }
          });
        } else { // "right"
          rightIdx.forEach(function (ix, ri) {
            var liPos = leftIdx.indexOf(ix);
            var lrow = liPos !== -1 ? leftRows[liPos] : nullLeft;
            resultIndex.push(ix);
            resultRows.push(lrow.concat(rightRows[ri]));
          });
        }

        var allCols = newLeftNames.concat(newRightNames);
        var resultObj = {};
        allCols.forEach(function (c, ci) {
          resultObj[c] = resultRows.map(function (row) { return row[ci]; });
        });
        var newDf = new dfd2.DataFrame(resultObj, { index: resultIndex });
        newDf.__indexName = df.__indexName;
        return wrapDataFrame(newDf);
      });

      if (n === "assign") return kwFunc(function(args, kw) {
        var dfd2 = ensureDfd();
        var newDf = new dfd2.DataFrame(df.values, { columns: df.columns.slice(), index: df.index.slice() });
        Object.keys(kw).forEach(function (col) {
          var v = kw[col];
          var vals2;
          if (v && v.tp$call) {
            var sr2 = Sk.misceval.callsim(v, wrapDataFrame(newDf));
            vals2 = sr2 && sr2.__dfd_sr ? sr2.__dfd_sr.values : py2js(sr2);
          } else {
            vals2 = py2js(v);
          }
          if (!Array.isArray(vals2)) vals2 = new Array(newDf.shape[0]).fill(vals2);
          newDf.addColumn(col, vals2, { inplace: true });
        });
        return wrapDataFrame(newDf);
      });

      if (n === "apply") return kwFunc(function(args, kw) {
        var fn = args[0];
        var axis = kwGet(kw, "axis", 0);
        var dfd2 = ensureDfd();
        if (axis === 1 || axis === "columns") {
          // apply row-wise
          var results = df.values.map(function (row) {
            var pySeries = wrapSeries(new dfd2.Series(row, { index: df.columns }));
            return py2js(Sk.misceval.callsim(fn, pySeries));
          });
          return wrapSeries(new dfd2.Series(results, { index: df.index }));
        } else {
          // apply column-wise
          var resObj = {};
          df.columns.forEach(function (c) {
            var sr = wrapSeries(df[c]);
            resObj[c] = py2js(Sk.misceval.callsim(fn, sr));
          });
          return wrapSeries(new dfd2.Series(Object.values(resObj), { index: Object.keys(resObj) }));
        }
      });

      if (n === "applymap" || n === "map") return new Sk.builtin.func(function (fn) {
        var dfd2 = ensureDfd();
        var newVals = df.values.map(function (row) {
          return row.map(function (v) { return py2js(Sk.misceval.callsim(fn, js2py(v))); });
        });
        return wrapDataFrame(new dfd2.DataFrame(newVals, { columns: df.columns, index: df.index }));
      });

      if (n === "query") return new Sk.builtin.func(function (expr) {
        // very limited: col > val, col == val, etc.
        var e = py2js(expr).trim();
        var m = e.match(/^(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
        if (!m) throw new Sk.builtin.ValueError(new Sk.builtin.str("Unsupported query: " + e));
        var col2 = m[1], op2 = m[2], val2 = m[3].trim();
        var numVal = parseFloat(val2);
        if (isNaN(numVal)) val2 = val2.replace(/^['"]|['"]$/g, "");
        else val2 = numVal;
        var mask = df[col2].values.map(function (v) {
          if (op2 === "==") return v === val2;
          if (op2 === "!=") return v !== val2;
          if (op2 === ">")  return v > val2;
          if (op2 === "<")  return v < val2;
          if (op2 === ">=") return v >= val2;
          if (op2 === "<=") return v <= val2;
        });
        var indices = mask.map(function (v, i) { return v ? i : -1; }).filter(function (i) { return i >= 0; });
        return wrapDataFrame(df.iloc({ rows: indices }));
      });

      if (n === "astype") return kwFunc(function(args, kw) {
        var t = args[0] !== undefined ? py2js(args[0]) : null;
        var map = { "int": "int32", "int32": "int32", "int64": "int32", "float": "float32", "float64": "float32", "str": "string", "string": "string" };
        var dfd2 = ensureDfd();
        if (typeof t === "string") return wrapDataFrame(df.astype(map[t] || t));
        if (t && typeof t === "object") {
          // dict per-column: {"col": "int"}
          var allRows = dfGet2DValues(df);
          var cols2 = df.columns;
          var result = {};
          cols2.forEach(function (c, ci) {
            var target = t.hasOwnProperty(c) ? (map[t[c]] || t[c]) : null;
            var colVals = allRows.map(function (row) { return row[ci]; });
            if (!target) { result[c] = colVals; return; }
            result[c] = colVals.map(function (v) {
              if (v === null || v === undefined) return null;
              if (target.indexOf("int") !== -1) return parseInt(v, 10);
              if (target.indexOf("float") !== -1) return parseFloat(v);
              if (target === "string" || target === "str") return String(v);
              return v;
            });
          });
          return wrapDataFrame(new dfd2.DataFrame(result, { index: df.index }));
        }
        return wrapDataFrame(df);
      });

      if (n === "round") return new Sk.builtin.func(function (decimals) {
        var d = decimals !== undefined ? py2js(decimals) : 0;
        var factor = Math.pow(10, d);
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var allRows = dfGet2DValues(df);
        var newRows = allRows.map(function (row) {
          return row.map(function (v) {
            return (typeof v === "number" && !isNaN(v))
              ? Math.round(v * factor) / factor : v;
          });
        });
        var newDf = new dfd2.DataFrame(newRows, { columns: cols2.slice(), index: df.index });
        newDf.__indexName = df.__indexName;
        return wrapDataFrame(newDf);
      });

      if (n === "to_string") return kwFunc(function (args, kw) {
        var showIndex = kwGet(kw, "index", true);
        var showHeader = kwGet(kw, "header", true);
        var cols = kwGet(kw, "columns", null);
        var naRep = kwGet(kw, "na_rep", "NaN");
        var srcDf = df;
        if (cols && cols.length) {
          var dfd2 = ensureDfd();
          var picked = {};
          cols.forEach(function (c) { picked[c] = df[c].values; });
          srcDf = new dfd2.DataFrame(picked, { index: df.index });
        }
        var text = dfToString(srcDf, { showIndex: showIndex, showHeader: showHeader, naRep: naRep });
        return new Sk.builtin.str(text);
      });

      if (n === "to_dict") return new Sk.builtin.func(function (orient) {
        var o = orient ? py2js(orient) : "dict";
        var result = {};
        if (o === "records") {
          return new Sk.builtin.list(df.values.map(function (row) {
            var obj2 = {};
            df.columns.forEach(function (c, i) { obj2[c] = row[i]; });
            return js2py(obj2);
          }));
        }
        df.columns.forEach(function (c) {
          result[c] = {};
          var vals = df[c].values;
          df.index.forEach(function (idx2, i) { result[c][idx2] = vals[i]; });
        });
        return js2py(result);
      });

      if (n === "to_csv") return kwFunc(function(args, kw) {
        var pathArg = args[0] !== undefined ? py2js(args[0]) : null;
        var encoding = kwGet(kw, "encoding", "utf-8");
        var opts = {
          sep: kwGet(kw, "sep", ","),
          index: kwGet(kw, "index", true),
          header: kwGet(kw, "header", true),
          columns: kwGet(kw, "columns", null),
          naRep: kwGet(kw, "na_rep", ""),
          indexLabel: kwGet(kw, "index_label", "")
        };
        var csvText = dataFrameToCSV(df, opts);
        if (pathArg) {
          __csvStore[pathArg] = csvText;
          // Prepend a UTF-8 BOM for utf-8-sig (and default utf-8, since
          // Excel — the overwhelmingly common consumer of a downloaded
          // .csv — otherwise mis-renders Cyrillic/other non-ASCII text
          // without it). Real pandas only adds the BOM for "utf-8-sig",
          // but browsers/Excel need the nudge for a file to actually be
          // usable once downloaded, so we add it for plain "utf-8" too.
          var withBom = (String(encoding).toLowerCase().indexOf("utf-8") !== -1 ? "\ufeff" : "") + csvText;
          triggerBrowserDownload(pathArg, withBom, "text/csv;charset=utf-8;");
          return Sk.builtin.none.none$;
        }
        return new Sk.builtin.str(csvText);
      });

      if (n === "to_excel") return kwFunc(function(args, kw) {
        var pathArg = args[0] !== undefined ? py2js(args[0]) : null;
        var opts = {
          sheetName: kwGet(kw, "sheet_name", "Sheet1"),
          index: kwGet(kw, "index", true),
          header: kwGet(kw, "header", true),
          columns: kwGet(kw, "columns", null),
          naRep: kwGet(kw, "na_rep", ""),
          indexLabel: kwGet(kw, "index_label", "")
        };

        var allCols = df.columns;
        var cols = opts.columns && opts.columns.length ? opts.columns : allCols;
        var colIdx = cols.map(function (c) { return allCols.indexOf(c); });

        // Build a 2D array-of-arrays representation (header row + data rows),
        // shared by both the SheetJS path and the plain in-memory fallback.
        var aoa = [];
        if (opts.header) {
          aoa.push(opts.index ? [opts.indexLabel || ""].concat(cols) : cols.slice());
        }
        df.values.forEach(function (row, ri) {
          var outRow = colIdx.map(function (ci) {
            var v = row[ci];
            var isNaN_ = typeof v === "number" && isNaN(v);
            return (v === null || v === undefined || isNaN_) ? opts.naRep : v;
          });
          if (opts.index) outRow = [df.index[ri]].concat(outRow);
          aoa.push(outRow);
        });

        // If SheetJS is loaded on the page, write a real, downloadable .xlsx.
        if (typeof window !== "undefined" && window.XLSX) {
          var ws = window.XLSX.utils.aoa_to_sheet(aoa);
          var wb = window.XLSX.utils.book_new();
          window.XLSX.utils.book_append_sheet(wb, ws, opts.sheetName);

          if (pathArg) {
            window.XLSX.writeFile(wb, pathArg);
            __excelStore[pathArg] = aoa;
            return Sk.builtin.none.none$;
          }
          var bin = window.XLSX.write(wb, { type: "binary", bookType: "xlsx" });
          return new Sk.builtin.str(bin);
        }

        // Fallback: no SheetJS available, so we can't produce real .xlsx
        // bytes. Keep the sheet data in memory so pd.read_excel(path) can
        // still round-trip it within this session.
        if (pathArg) {
          __excelStore[pathArg] = aoa;
          return Sk.builtin.none.none$;
        }
        throw new Sk.builtin.ImportError(new Sk.builtin.str(
          "to_excel() requires either a path to write to, or SheetJS " +
          "(window.XLSX) loaded on the page to return raw bytes. Add " +
          "<script src=\"https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js\"></script> " +
          "to your page for full .xlsx support."
        ));
      });

      if (n === "iterrows") return new Sk.builtin.func(function () {
        var i = 0;
        var dfd2 = ensureDfd();
        var iter = {
          tp$iter: function () { return iter; },
          tp$iternext: function () {
            if (i >= df.shape[0]) throw new Sk.builtin.StopIteration();
            var rowVals = df.values[i];
            var rowObj = {};
            df.columns.forEach(function (c, ci) { rowObj[c] = rowVals[ci]; });
            var sr = wrapSeries(new dfd2.Series(rowVals, { index: df.columns }));
            return new Sk.builtin.tuple([js2py(df.index[i++]), sr]);
          }
        };
        return iter;
      });

      if (n === "itertuples") return new Sk.builtin.func(function () {
        var i = 0;
        var iter = {
          tp$iter: function () { return iter; },
          tp$iternext: function () {
            if (i >= df.shape[0]) throw new Sk.builtin.StopIteration();
            var rowVals = [df.index[i]].concat(df.values[i]);
            i++;
            return new Sk.builtin.tuple(rowVals.map(js2py));
          }
        };
        return iter;
      });

      // numeric agg methods
      var numMethods2 = ["mean","sum","min","max","std","var","count","median","abs","cumsum"];
      if (numMethods2.indexOf(n) !== -1) {
        return kwFunc(function(args, kw) {
          var dfd2 = ensureDfd();
          try {
            var res = df[n]();
            if (res && typeof res === "object" && res.$isSeries === false) return wrapDataFrame(res);
            if (res && typeof res === "object" && res.$isSeries === true)  return wrapSeries(res);
            return js2py(res);
          } catch(e) {
            return wrapDataFrame(df);
          }
        });
      }

      if (n === "nunique") return new Sk.builtin.func(function () {
        var dfd2 = ensureDfd();
        var vals = df.columns.map(function (c) { return new Set(df[c].values).size; });
        return wrapSeries(new dfd2.Series(vals, { index: df.columns }));
      });

      if (n === "value_counts") return new Sk.builtin.func(function () {
        // works for single-col df
        return wrapSeries(df[df.columns[0]].valueCounts());
      });

      if (n === "corr") return new Sk.builtin.func(function () {
        try { return wrapDataFrame(df.corr()); }
        catch(e) { return wrapDataFrame(df); }
      });

      if (n === "cov")  return new Sk.builtin.func(function () {
        try { return wrapDataFrame(df.cov());  }
        catch(e) { return wrapDataFrame(df); }
      });

      if (n === "T" || n === "transpose") {
        if (n === "T") {
          try { return wrapDataFrame(df.T); } catch(e) { return wrapDataFrame(df); }
        }
        return new Sk.builtin.func(function () {
          try { return wrapDataFrame(df.T); } catch(e) { return wrapDataFrame(df); }
        });
      }

      if (n === "pipe") return new Sk.builtin.func(function (fn) {
        return Sk.misceval.callsim(fn, wrapDataFrame(df));
      });

      if (n === "plot") return makePlotAccessor(function () {
        var allRows = dfGet2DValues(df);
        var colData = {};
        df.columns.forEach(function (c, ci) { colData[c] = allRows.map(function (row) { return row[ci]; }); });
        return { columns: df.columns, index: df.index, colData: colData };
      });

      // column access via attribute (last resort)
      if (df.columns.indexOf(n) !== -1) {
        return wrapSeries(df[n]);
      }

      throw new Sk.builtin.AttributeError(new Sk.builtin.str("DataFrame has no attribute '" + n + "'"));
    });

    $loc.__iter__ = new Sk.builtin.func(function (self) {
      var cols = self.__dfd_df ? self.__dfd_df.columns : [];
      var i = 0;
      return new Sk.builtin.func(function () {
        if (i < cols.length) return new Sk.builtin.str(cols[i++]);
        throw new Sk.builtin.StopIteration();
      });
    });

    $loc.__contains__ = new Sk.builtin.func(function (self, key) {
      var df = self.__dfd_df;
      return df ? new Sk.builtin.bool(df.columns.indexOf(py2js(key)) !== -1) : Sk.builtin.bool.false$;
    });

  }, "DataFrame", []);

  // Patch mp$subscript on DataFrame prototype so Skulpt calls it before
  // any bool coercion of the key argument
  mod.DataFrame.prototype.mp$subscript = function (key) {
    return dfSubscript(this.__dfd_df, key);
  };

  // ─── loc / iloc proxy ──────────────────────────────────────────────────────

  function makeLocProxy(df, isIloc) {
    return {
      mp$subscript: function (key) {
        // boolean Series mask — direct (in case it reaches us before coercion)
        if (key && key.__dfd_sr) {
          var dfdMask = ensureDfd();
          _lastBoolSeries = null;
          return wrapDataFrame(dfFilterByMask(df, key.__dfd_sr.values, dfdMask));
        }
        // Skulpt's compiler coerced our boolean Series to a plain bool/int —
        // recover the real mask that Series.nb$bool() stashed for us. Without
        // this, `.loc[mask]` falls through to the "single row" branch below
        // and misinterprets the coerced 0/1 as a row *label*, silently
        // returning whatever row happens to have index 0 or 1.
        if ((key instanceof Sk.builtin.bool || key instanceof Sk.builtin.int_) && _lastBoolSeries) {
          var stashedMask = _lastBoolSeries;
          _lastBoolSeries = null;
          var dfdMask2 = ensureDfd();
          return wrapDataFrame(dfFilterByMask(df, stashedMask.__dfd_sr.values, dfdMask2));
        }
        var k = py2js(key);
        // single row
        if (typeof k === "number" || typeof k === "string") {
          var dfd2 = ensureDfd();
          if (isIloc) {
            var rowVals = df.values[k];
            return wrapSeries(new dfd2.Series(rowVals, { index: df.columns }));
          } else {
            var ri = df.index.indexOf(k);
            var rowVals2 = df.values[ri];
            return wrapSeries(new dfd2.Series(rowVals2, { index: df.columns }));
          }
        }
        // tuple [row, col]
        if (Array.isArray(k)) {
          var rowSpec = k[0], colSpec = k[1];
          var rowIsList = Array.isArray(rowSpec);
          var colIsList = colSpec !== undefined && Array.isArray(colSpec);
          var dfd3 = ensureDfd();

          if (isIloc) {
            var rows2 = rowIsList ? rowSpec : [rowSpec];
            var cols2 = colSpec !== undefined ? (colIsList ? colSpec : [colSpec]) : df.columns;
            try {
              var resIloc = df.iloc({ rows: rows2, columns: cols2.map(function (c) { return typeof c === "string" ? df.columns.indexOf(c) : c; }) });
              // single row + single col -> scalar
              if (!rowIsList && colSpec !== undefined && !colIsList) {
                return js2py(dfGet2DValues(resIloc)[0][0]);
              }
              return wrapDataFrame(resIloc);
            } catch (e) {
              return js2py(null);
            }
          }

          // .loc — resolve row label(s) to position(s) against df.index directly,
          // rather than delegating to danfo's own .loc() (unreliable across
          // versions, and silently swallowed into a returned None on failure).
          var idxArr = df.index;
          function rowPos(label) {
            var p = idxArr.indexOf(label);
            if (p === -1) p = idxArr.indexOf(String(label));
            if (p === -1) p = idxArr.map(String).indexOf(String(label));
            return p;
          }

          if (!rowIsList && colSpec !== undefined && !colIsList) {
            // single row label + single column label -> scalar
            var pos = rowPos(rowSpec);
            if (pos === -1) throw new Sk.builtin.KeyError(new Sk.builtin.str(String(rowSpec)));
            return js2py(dfGetColumn(df, colSpec)[pos]);
          }

          if (!rowIsList && (colSpec === undefined || colIsList)) {
            // single row label + column list (or all columns) -> Series
            var pos2 = rowPos(rowSpec);
            if (pos2 === -1) throw new Sk.builtin.KeyError(new Sk.builtin.str(String(rowSpec)));
            var cols3 = colSpec !== undefined ? colSpec : df.columns;
            var rowVals3 = dfGet2DValues(df)[pos2];
            var colArr3 = df.columns;
            var vals3 = cols3.map(function (c) { return rowVals3[colArr3.indexOf(c)]; });
            return wrapSeries(new dfd3.Series(vals3, { index: cols3 }));
          }

          // row list (or boolean-ish) + column(s) -> DataFrame
          var positions = rowSpec.map(rowPos);
          var cols4 = colSpec !== undefined ? (colIsList ? colSpec : [colSpec]) : df.columns;
          var allRows4 = dfGet2DValues(df);
          var colArr4 = df.columns;
          var result = {};
          cols4.forEach(function (c) {
            var ci = colArr4.indexOf(c);
            result[c] = positions.map(function (p) { return p === -1 ? null : allRows4[p][ci]; });
          });
          var newIdx4 = positions.map(function (p, i) { return p === -1 ? rowSpec[i] : idxArr[p]; });
          return wrapDataFrame(new dfd3.DataFrame(result, { index: newIdx4 }));
        }
        return js2py(null);
      },
      mp$ass_subscript: function (key, value) {
        // loc assignment
        var k = py2js(key);
        if (Array.isArray(k)) {
          var rowSpec2 = k[0], colSpec2 = k[1];
          if (typeof colSpec2 === "string") {
            var col = colSpec2;
            var mask = Array.isArray(rowSpec2) ? rowSpec2 : dfGetIndexArray(df.index).map(function (idx) { return idx === rowSpec2; });
            var vals = df[col].values.slice();
            var newVal = py2js(value);
            mask.forEach(function (m, i) { if (m) vals[i] = newVal; });
            df.addColumn(col, vals, { inplace: true });
          }
        }
      }
    };
  }

  // ─── Top-level functions ────────────────────────────────────────────────────

  mod.read_csv = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var pathOrUrl = args[0];
    var url = py2js(pathOrUrl);
    var sep = kwGet(kw, "delimiter", kwGet(kw, "sep", ","));
    var header = kwGet(kw, "header", 0);
    var names = kwGet(kw, "names", null);
    var indexCol = kwGet(kw, "index_col", null);
    var usecols = kwGet(kw, "usecols", null);
    var naValuesExtra = kwGet(kw, "na_values", null);
    var naValues = DEFAULT_NA_VALUES.slice();
    if (naValuesExtra) naValues = naValues.concat(Array.isArray(naValuesExtra) ? naValuesExtra : [naValuesExtra]);
    var opts = { sep: sep, header: header, names: names, indexCol: indexCol, usecols: usecols, naValues: naValues };

    // 1) something previously written via df.to_csv("name.csv") in this session
    if (__csvStore.hasOwnProperty(url)) {
      return wrapDataFrame(buildDataFrameFromCSV(dfd, __csvStore[url], opts));
    }
    // 2) raw CSV text passed directly (contains a newline)
    if (url.indexOf("\n") !== -1) {
      return wrapDataFrame(buildDataFrameFromCSV(dfd, url, opts));
    }
    // 3) URL/path: fetch the text ourselves and parse with the same engine
    // (rather than danfo's readCSV) so options behave consistently.
    var susp = new Sk.misceval.Suspension();
    susp.resume = function () {
      if (susp.promise.error) throw new Sk.builtin.RuntimeError(new Sk.builtin.str(String(susp.promise.error)));
      return susp.promise.result;
    };
    susp.data = {
      type: "Sk.promise",
      promise: fetch(url).then(function (r) { return r.text(); }).then(function (text) {
        susp.promise = { result: wrapDataFrame(buildDataFrameFromCSV(dfd, text, opts)) };
      }).catch(function (e) {
        susp.promise = { error: e };
      })
    };
    return susp;
  });

  mod.read_excel = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var pathOrUrl = args[0];
    var url = py2js(pathOrUrl);
    var sheetName = kwGet(kw, "sheet_name", 0);
    var header = kwGet(kw, "header", 0);
    var indexCol = kwGet(kw, "index_col", null);
    var naValuesExtra = kwGet(kw, "na_values", null);
    var naValues = DEFAULT_NA_VALUES.slice();
    if (naValuesExtra) naValues = naValues.concat(Array.isArray(naValuesExtra) ? naValuesExtra : [naValuesExtra]);

    // Build a DataFrame from an array-of-arrays sheet (header row + data rows).
    function dfFromAOA(aoa) {
      if (!aoa || aoa.length === 0) return new dfd.DataFrame({});
      var headerIdx = typeof header === "number" ? header : 0;
      var headers = header === null || header === false
        ? aoa[0].map(function (_, i) { return String(i); })
        : aoa[headerIdx].map(String);
      var dataRows = (header === null || header === false) ? aoa : aoa.slice(headerIdx + 1);
      var data = {};
      headers.forEach(function (h, ci) { data[h] = []; });
      dataRows.forEach(function (r) {
        headers.forEach(function (h, ci) {
          var raw = r[ci];
          var val = (raw === undefined || raw === null || raw === "") ? null
            : (naValues.indexOf(raw) !== -1 ? null : raw);
          data[h].push(val);
        });
      });
      var out = new dfd.DataFrame(data);
      if (indexCol !== null && indexCol !== undefined) {
        var idxColName = typeof indexCol === "number" ? headers[indexCol] : indexCol;
        try { out = out.setIndex({ column: idxColName, drop: true }); }
        catch (e) { try { out = out.setIndex({ column: idxColName }); } catch (e2) {} }
      }
      return out;
    }

    // 1) something previously written via df.to_excel("name.xlsx") this session
    if (__excelStore.hasOwnProperty(url)) {
      return wrapDataFrame(dfFromAOA(__excelStore[url]));
    }

    // 2) fetch the file as bytes and parse with SheetJS, if available
    if (typeof window === "undefined" || !window.XLSX) {
      throw new Sk.builtin.ImportError(new Sk.builtin.str(
        "read_excel requires either a file previously written with " +
        "to_excel() in this session, or SheetJS (window.XLSX) loaded on " +
        "the page. Add <script src=\"https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js\"></script> " +
        "to your page for full .xlsx support."
      ));
    }
    var susp = new Sk.misceval.Suspension();
    susp.resume = function () {
      if (susp.promise.error) throw new Sk.builtin.RuntimeError(new Sk.builtin.str(String(susp.promise.error)));
      return susp.promise.result;
    };
    susp.data = {
      type: "Sk.promise",
      promise: fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        var wb = window.XLSX.read(new Uint8Array(buf), { type: "array" });
        var sn = typeof sheetName === "number" ? wb.SheetNames[sheetName] : sheetName;
        var ws = wb.Sheets[sn] || wb.Sheets[wb.SheetNames[0]];
        var aoa = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        susp.promise = { result: wrapDataFrame(dfFromAOA(aoa)) };
      }).catch(function (e) {
        susp.promise = { error: e };
      })
    };
    return susp;
  });

  mod.read_json = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var url = py2js(args[0]);
    if (url.startsWith("{") || url.startsWith("[")) {
      try {
        var jsData = JSON.parse(url);
        return wrapDataFrame(new dfd.DataFrame(jsData));
      } catch(e) {
        throw new Sk.builtin.ValueError(new Sk.builtin.str("Invalid JSON: " + e.message));
      }
    }
    var susp = new Sk.misceval.Suspension();
    susp.resume = function () {
      if (susp.promise.error) throw new Sk.builtin.RuntimeError(new Sk.builtin.str(String(susp.promise.error)));
      return wrapDataFrame(susp.promise.result);
    };
    susp.data = {
      type: "Sk.promise",
      promise: dfd.readJSON(url).then(function (df) {
        susp.promise = { result: df };
      }).catch(function (e) {
        susp.promise = { error: e };
      })
    };
    return susp;
  });

  mod.concat = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var objs = args[0];
    var list = py2js(objs);
    var axis = kwGet(kw, "axis", 0);
    var dfs = list.map(function (item) {
      if (item && typeof item === "object" && item.$isSeries !== undefined) return item;
      if (item.__dfd_df) return item.__dfd_df;
      if (item.__dfd_sr) return item.__dfd_sr;
      return item;
    });
    return wrapDataFrame(dfd.concat({ dfList: dfs, axis: axis }));
  });

  mod.merge = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var left = args[0], right = args[1];
    var ldf = py2js(left), rdf = py2js(right);
    var on = kwGet(kw, "on", null);
    var leftOn = kwGet(kw, "left_on", null);
    var rightOn = kwGet(kw, "right_on", null);
    var how = kwGet(kw, "how", "inner");
    var onCol = on || leftOn || rightOn;
    return wrapDataFrame(dfd.merge({ left: ldf, right: rdf, on: [onCol], how: how }));
  });

  function isNaValue(v) {
    return v === null || v === undefined || (typeof v === "number" && isNaN(v));
  }

  // pd.isna()/pd.isnull() must work on a scalar, a Series, or a DataFrame.
  // The old version only ever handled scalars: py2js() on a Series/DataFrame
  // unwraps it to the raw danfo object (not null/undefined/NaN), so it
  // silently fell through and returned a bare `False`. Skulpt's internal
  // bool value is the JS number 0/1 (not true/false), so `shop[False]` was
  // then read as `shop[0]` — a positional column lookup — producing exactly
  // the "Column not found: 0" error instead of a boolean mask.
  function isnaGeneric(obj, negate) {
    var dfd = ensureDfd();
    if (obj && obj.__dfd_sr) {
      var sr = obj.__dfd_sr;
      var arr = sr.values.map(function (v) { var r = isNaValue(v); return negate ? !r : r; });
      return wrapSeries(new dfd.Series(arr, { index: sr.index }));
    }
    if (obj && obj.__dfd_df) {
      var df = obj.__dfd_df;
      var rows = dfGet2DValues(df);
      var result = {};
      df.columns.forEach(function (c, ci) {
        result[c] = rows.map(function (row) { var r = isNaValue(row[ci]); return negate ? !r : r; });
      });
      return wrapDataFrame(new dfd.DataFrame(result, { index: df.index }));
    }
    var v = py2js(obj);
    var r = isNaValue(v);
    return new Sk.builtin.bool(negate ? !r : r);
  }
  mod.isna  = new Sk.builtin.func(function (obj) { return isnaGeneric(obj, false); });
  mod.notna = new Sk.builtin.func(function (obj) { return isnaGeneric(obj, true); });
  mod.isnull  = mod.isna;
  mod.notnull = mod.notna;

  mod.to_datetime = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var arg = args[0];
    if (arg.__dfd_sr) {
      var vals = arg.__dfd_sr.values.map(function (v) { return v ? new Date(v).toISOString() : null; });
      return wrapSeries(new dfd.Series(vals, { index: arg.__dfd_sr.index }));
    }
    return js2py(new Date(py2js(arg)).toISOString());
  });

  // ─── Comparison functions (pd.greater, pd.equal, ...) ──────────────────────
  // Skulpt's compiler unconditionally wraps every `a > b`-style comparison in
  // Sk.builtin.bool(...) before the result is ever assigned or printed (see
  // compile.js's Compare handling), so `mask = series > 20` can never hold
  // onto a real element-wise boolean Series no matter what __gt__ returns.
  // Plain function calls aren't compiled that way, so pd.greater(series, 20)
  // etc. can return (and keep) an actual boolean Series/DataFrame.
  function elementwiseCompare(a, b, op) {
    var dfd = ensureDfd();
    function cmp(v, w) {
      if (v === null || v === undefined || w === null || w === undefined) return null;
      switch (op) {
        case "Eq":    return v === w;
        case "NotEq": return v !== w;
        case "Gt":    return v > w;
        case "Lt":    return v < w;
        case "GtE":   return v >= w;
        case "LtE":   return v <= w;
      }
    }
    var aIsDF = a && a.__dfd_df, bIsDF = b && b.__dfd_df;
    var aIsSr = a && a.__dfd_sr, bIsSr = b && b.__dfd_sr;

    if (aIsDF || bIsDF) {
      var df = aIsDF ? a.__dfd_df : b.__dfd_df;
      var otherDf = aIsDF ? (bIsDF ? b.__dfd_df : null) : a.__dfd_df;
      var cols = df.columns;
      var rows = dfGet2DValues(df);
      var result = {};
      cols.forEach(function (c, ci) {
        result[c] = rows.map(function (row, ri) {
          var v = row[ci];
          var w;
          if (otherDf) {
            var otherRows = dfGet2DValues(otherDf);
            var oci = otherDf.columns.indexOf(c);
            w = oci !== -1 && otherRows[ri] ? otherRows[ri][oci] : null;
          } else {
            var scalar = py2js(aIsDF ? b : a);
            w = scalar;
          }
          return aIsDF ? cmp(v, w) : cmp(w, v);
        });
      });
      return wrapDataFrame(new dfd.DataFrame(result, { index: df.index }));
    }

    if (aIsSr && bIsSr) {
      var aVals = a.__dfd_sr.values, bVals = b.__dfd_sr.values;
      var arr = aVals.map(function (v, i) { return cmp(v, bVals[i]); });
      return wrapSeries(new dfd.Series(arr, { index: a.__dfd_sr.index }));
    }
    if (aIsSr) {
      var scalarB = py2js(b);
      var arr2 = a.__dfd_sr.values.map(function (v) { return cmp(v, scalarB); });
      return wrapSeries(new dfd.Series(arr2, { index: a.__dfd_sr.index }));
    }
    if (bIsSr) {
      var scalarA = py2js(a);
      var arr3 = b.__dfd_sr.values.map(function (v) { return cmp(scalarA, v); });
      return wrapSeries(new dfd.Series(arr3, { index: b.__dfd_sr.index }));
    }
    // both plain scalars
    return js2py(cmp(py2js(a), py2js(b)));
  }

  mod.greater       = new Sk.builtin.func(function (a, b) { return elementwiseCompare(a, b, "Gt"); });
  mod.greater_equal = new Sk.builtin.func(function (a, b) { return elementwiseCompare(a, b, "GtE"); });
  mod.less          = new Sk.builtin.func(function (a, b) { return elementwiseCompare(a, b, "Lt"); });
  mod.less_equal    = new Sk.builtin.func(function (a, b) { return elementwiseCompare(a, b, "LtE"); });
  mod.equal         = new Sk.builtin.func(function (a, b) { return elementwiseCompare(a, b, "Eq"); });
  mod.not_equal     = new Sk.builtin.func(function (a, b) { return elementwiseCompare(a, b, "NotEq"); });

  mod.get_dummies = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var data = args[0];
    var df = data.__dfd_df || null;
    if (!df) return data; // no-op if not supported
    // simplistic one-hot for one column
    return wrapDataFrame(dfd.getDummies(df));
  });

  // Shared binning logic used by both cut() and qcut().
  function binValues(vals, b, labels) {
    return vals.map(function (v) {
      if (typeof b === "number") {
        // number of equal-width bins
        var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
        var w = (mx - mn) / b;
        var bi = Math.floor((v - mn) / w);
        bi = Math.min(bi, b - 1);
        return labels ? labels[bi] : "(" + (mn + bi * w).toFixed(2) + ", " + (mn + (bi + 1) * w).toFixed(2) + "]";
      }
      // explicit array of bin edges
      for (var i = 0; i < b.length - 1; i++) {
        if (v > b[i] && v <= b[i + 1]) return labels ? labels[i] : "(" + b[i] + ", " + b[i + 1] + "]";
      }
      return null;
    });
  }

  mod.cut = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var x = args[0], bins = args[1];
    var vals = x.__dfd_sr ? x.__dfd_sr.values : py2js(x);
    var b = py2js(bins);
    var labels = kwGet(kw, "labels", null);
    var result = binValues(vals, b, labels);
    return wrapSeries(new dfd.Series(result, x.__dfd_sr ? { index: x.__dfd_sr.index } : {}));
  });

  mod.qcut = kwFunc(function (args, kw) {
    var dfd = ensureDfd();
    var x = args[0], q = args[1];
    var vals = x.__dfd_sr ? x.__dfd_sr.values : py2js(x);
    var nq = py2js(q);
    var labels = kwGet(kw, "labels", null);
    var sorted = vals.slice().sort(function (a, b) { return a - b; });
    var edges = [sorted[0]];
    for (var i = 1; i <= nq; i++) {
      edges.push(sorted[Math.round(i * sorted.length / nq) - 1]);
    }
    var result = binValues(vals, edges, labels);
    return wrapSeries(new dfd.Series(result, x.__dfd_sr ? { index: x.__dfd_sr.index } : {}));
  });

  mod.pivot_table = kwFunc(function (args, kw) {
    // simplified — return groupby aggfunc
    var data = args[0];
    var df = data.__dfd_df;
    if (!df) return data;
    var index2 = kwGet(kw, "index", null);
    var aggfunc = kwGet(kw, "aggfunc", "mean");
    if (index2) {
      var gb = df.groupby([index2]);
      return wrapDataFrame(gb[aggfunc] ? gb[aggfunc]() : gb.mean());
    }
    return data;
  });

  mod.NA    = Sk.builtin.none.none$;
  mod.NaT   = Sk.builtin.none.none$;
  mod.NaN   = new Sk.builtin.float_(NaN);
  mod.Int64 = new Sk.builtin.str("int64");
  mod.Float64 = new Sk.builtin.str("float64");

  // ── RangeIndex & Index stubs ──────────────────────────────────────────────
  mod.RangeIndex = Sk.misceval.buildClass(mod, function ($gbl2, $loc2) {
    $loc2.__init__ = new Sk.builtin.func(function (self, start, stop, step) {
      self.start = py2js(start) || 0;
      self.stop  = py2js(stop);
      self.step  = py2js(step) || 1;
    });
    $loc2.__repr__ = new Sk.builtin.func(function (self) {
      return new Sk.builtin.str("RangeIndex(start=" + self.start + ", stop=" + self.stop + ", step=" + self.step + ")");
    });
  }, "RangeIndex", []);

  mod.Index = Sk.misceval.buildClass(mod, function ($gbl2, $loc2) {
    $loc2.__init__ = new Sk.builtin.func(function (self, data) {
      self.__data = py2js(data);
    });
    $loc2.__repr__ = new Sk.builtin.func(function (self) {
      return new Sk.builtin.str("Index(" + JSON.stringify(self.__data) + ")");
    });
  }, "Index", []);

  return mod;
};
