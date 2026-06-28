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
    if (v instanceof window.dfd.DataFrame) return wrapDataFrame(v);
    if (v instanceof window.dfd.Series)   return wrapSeries(v);
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
  function dfToString(df) {
    var lines = [];
    var isDF = df instanceof window.dfd.DataFrame;
    if (isDF) {
      var cols = df.columns;
      var idx  = df.index;
      var allVals = dfGet2DValues(df);
      // compute column widths from header and all cell values
      var widths = cols.map(function (c, ci) {
        var w = String(c).length;
        allVals.forEach(function(row) {
          var cell = (row && row[ci] !== null && row[ci] !== undefined) ? String(row[ci]) : "NaN";
          if (cell.length > w) w = cell.length;
        });
        return w;
      });
      var idxW = Math.max(...idx.map(function(x){ return String(x).length; }), 1);
      // header
      var header = pad("", idxW) + "  " + cols.map(function (c, i) { return pad(String(c), widths[i]); }).join("  ");
      lines.push(header);
      // rows
      for (var r = 0; r < idx.length; r++) {
        var rowStr = pad(String(idx[r]), idxW) + "  ";
        var row = allVals[r];
        // row may be a string (danfo serialised it) — split by comma
        if (typeof row === "string") row = row.split(",");
        var cells = cols.map(function (c, i) {
          var val = (row && row[i] !== null && row[i] !== undefined) ? row[i] : "NaN";
          return pad(String(val), widths[i]);
        });
        lines.push(rowStr + cells.join("  "));
      }
    } else {
      // Series
      var idx2 = df.index;
      var vals = df.values;
      var idxW2 = Math.max(...idx2.map(function (x) { return String(x).length; }), 1);
      var valW2 = Math.max(...vals.map(function (v) { return v === null ? 3 : String(v).length; }), 1);
      for (var i = 0; i < idx2.length; i++) {
        lines.push(pad(String(idx2[i]), idxW2) + "    " + pad(vals[i] === null ? "NaN" : String(vals[i]), valW2));
      }
    }
    return lines.join("\n");
  }

  function pad(s, w) {
    s = String(s);
    while (s.length < w) s = " " + s;
    return s;
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

  // Build a Skulpt-callable function that correctly receives (args, kwargs).
  // handler(args, kwargs) where:
  //   args   = JS array of positional py-values
  //   kwargs = plain JS object { "key": pyValue }
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

  // ─── Series ─────────────────────────────────────────────────────────────────

  function wrapSeries(sr) {
    var pysr = Sk.misceval.callsim(mod.Series, Sk.builtin.none.none$);
    pysr.__dfd_sr = sr;
    return pysr;
  }

  mod.Series = Sk.misceval.buildClass(mod, function ($gbl, $loc) {

    $loc.__init__ = new Sk.builtin.func(function (self, data, kw) {
      // data may be list/dict/None
      var dfd = ensureDfd();
      if (data && data !== Sk.builtin.none.none$) {
        var jsData = py2js(data);
        self.__dfd_sr = new dfd.Series(Array.isArray(jsData) ? jsData : Object.values(jsData));
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
      if (n === "index")   return new Sk.builtin.list(sr.index.map(js2py));
      if (n === "name")    return sr.name ? new Sk.builtin.str(sr.name) : Sk.builtin.none.none$;
      if (n === "dtype")   return new Sk.builtin.str(sr.dtype || "object");
      if (n === "shape")   return new Sk.builtin.tuple([new Sk.builtin.int_(sr.values.length)]);
      if (n === "size")    return new Sk.builtin.int_(sr.values.length);

      // delegate numeric methods
      var numMethods = ["mean","sum","min","max","std","var","count","median","abs","cumsum","cumprod","cummax","cummin"];
      if (numMethods.indexOf(n) !== -1) {
        return new Sk.builtin.func(function () {
          var res = sr[n]();
          // danfo returns a Series for cumulative; scalar for agg
          if (res instanceof window.dfd.Series) return wrapSeries(res);
          return js2py(typeof res === "object" && res !== null ? res.values ? res.values[0] : res : res);
        });
      }

      if (n === "head") return new Sk.builtin.func(function (n2) { return wrapSeries(sr.head(n2 ? py2js(n2) : 5)); });
      if (n === "tail") return new Sk.builtin.func(function (n2) { return wrapSeries(sr.tail(n2 ? py2js(n2) : 5)); });

      if (n === "unique")   return new Sk.builtin.func(function () { return new Sk.builtin.list(sr.unique().map(js2py)); });
      if (n === "nunique")  return new Sk.builtin.func(function () { return js2py(sr.nunique()); });

      if (n === "value_counts") return new Sk.builtin.func(function () { return wrapSeries(sr.valueCounts()); });

      if (n === "fillna")  return kwFunc(function(args, kw) {
        var val = args[0] !== undefined ? py2js(args[0]) : kwGet(kw, "value", 0);
        return wrapSeries(sr.fillNa(val));
      });
      if (n === "dropna")  return new Sk.builtin.func(function () { return wrapSeries(sr.dropNa()); });
      if (n === "isna")    return new Sk.builtin.func(function () { return wrapSeries(sr.isNa()); });
      if (n === "notna")   return new Sk.builtin.func(function () { return wrapSeries(sr.notNa()); });

      if (n === "sort_values") return kwFunc(function(args, kw) {
        var asc = kwGet(kw, "ascending", true);
        return wrapSeries(sr.sortValues({ ascending: asc }));
      });

      if (n === "reset_index") return new Sk.builtin.func(function () { return wrapSeries(sr.resetIndex()); });

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
        var jsMap = py2js(mapping);
        var dfd2 = ensureDfd();
        var newVals = sr.values.map(function (v) { return jsMap[v] !== undefined ? jsMap[v] : null; });
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

      if (n === "rename") return new Sk.builtin.func(function (nm) {
        var s2 = new window.dfd.Series(sr.values, { index: sr.index, name: py2js(nm) });
        return wrapSeries(s2);
      });

      if (n === "str") return makeStrAccessor(sr);

      if (n === "dt")  return makeDtAccessor(sr);

      throw new Sk.builtin.AttributeError(new Sk.builtin.str("Series has no attribute '" + n + "'"));
    });

    $loc.__getitem__ = new Sk.builtin.func(function (self, key) {
      var sr = self.__dfd_sr;
      var k = py2js(key);
      if (typeof k === "number") {
        var v = sr.iloc([k]).values[0];
        return js2py(v);
      }
      // boolean series mask
      if (key.__dfd_sr) {
        var mask = key.__dfd_sr.values;
        var dfd2 = ensureDfd();
        var filtered = sr.values.filter(function (_, i) { return mask[i]; });
        return wrapSeries(new dfd2.Series(filtered));
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

  function wrapGroupBy(df, byCol) {
    var obj = {};
    obj.__df = df;
    obj.__by = byCol;

    function makeAgg(method) {
      return new Sk.builtin.func(function () {
        var dfd2 = ensureDfd();
        var gb   = df.groupby([byCol]);
        var res  = gb[method]();
        return wrapDataFrame(res);
      });
    }

    obj.tp$getattr = function (name) {
      var n = typeof name === "string" ? name : name.v;
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
      if (n === "agg" || n === "aggregate") return new Sk.builtin.func(function (funcs) {
        // simple: single string
        var f = py2js(funcs);
        if (typeof f === "string") return makeAgg(f).v();
        // dict {col: func} — best-effort
        return makeAgg("mean").v();
      });
      if (n === "__getitem__") return new Sk.builtin.func(function (_, col2) {
        // df.groupby(by)[col].agg()
        var colName = py2js(col2);
        return wrapGroupBySeries(df, byCol, colName);
      });
      throw new Sk.builtin.AttributeError(new Sk.builtin.str("GroupBy has no attribute '" + n + "'"));
    };
    obj.mp$subscript = function (key) {
      var colName = py2js(key);
      return wrapGroupBySeries(df, byCol, colName);
    };
    return obj;
  }

  function wrapGroupBySeries(df, byCol, valCol) {
    var obj = {};
    function makeAgg(method) {
      return new Sk.builtin.func(function () {
        var dfd2 = ensureDfd();
        var gb = df.groupby([byCol]);
        var res = gb[method]();
        // extract the valCol series from result
        try { return wrapSeries(res[valCol]); } catch(e) { return wrapDataFrame(res); }
      });
    }
    obj.tp$getattr = function (name) {
      var n = typeof name === "string" ? name : name.v;
      if (["mean","sum","min","max","count"].indexOf(n) !== -1) return makeAgg(n);
      throw new Sk.builtin.AttributeError(new Sk.builtin.str("GroupBy has no attribute '" + n + "'"));
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

    $loc.__init__ = new Sk.builtin.func(function (self, data, kw) {
      var dfd = ensureDfd();
      if (!data || data === Sk.builtin.none.none$) return;
      var jsData = py2js(data);
      if (Array.isArray(jsData)) {
        // list of dicts
        self.__dfd_df = new dfd.DataFrame(jsData);
      } else if (typeof jsData === "object") {
        // dict of lists
        self.__dfd_df = new dfd.DataFrame(jsData);
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
      var df = self.__dfd_df;
      if (!df) throw new Sk.builtin.AttributeError(name);

      // ── properties ─────────────────────────────────────────────────────────
      if (n === "shape")   return new Sk.builtin.tuple([new Sk.builtin.int_(df.shape[0]), new Sk.builtin.int_(df.shape[1])]);
      if (n === "columns") return new Sk.builtin.list(df.columns.map(function (c) { return new Sk.builtin.str(c); }));
      if (n === "index")   return new Sk.builtin.list(df.index.map(js2py));
      if (n === "dtypes") {
        var dtObj = {};
        df.columns.forEach(function (c) { dtObj[c] = df.ctypes[c] || "object"; });
        return js2py(dtObj);
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
          lines.push(" " + pad(i, 3) + "  " + pad(c, 20) + df.shape[0] + " non-null  " + (df.ctypes[c] || "object"));
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

      if (n === "dropna") return new Sk.builtin.func(function (kw2) {
        return wrapDataFrame(df.dropNa());
      });

      if (n === "fillna") return new Sk.builtin.func(function (val, kw2) {
        return wrapDataFrame(df.fillNa({ values: py2js(val) }));
      });

      if (n === "isna")  return new Sk.builtin.func(function () { return wrapDataFrame(df.isNa()); });
      if (n === "notna") return new Sk.builtin.func(function () { return wrapDataFrame(df.notNa()); });
      if (n === "isnull")  return $loc.__getattr__(self, name); // alias

      if (n === "sort_values") return kwFunc(function(args, kw) {
        var col = args[0] !== undefined ? py2js(args[0]) : kwGet(kw, "by", null);
        var asc = kwGet(kw, "ascending", true);
        if (col === null) return wrapDataFrame(df);
        var sortCol = Array.isArray(col) ? col[0] : col;
        // sort manually using dfGet2DValues to avoid danfo serialisation bugs
        var dfd2 = ensureDfd();
        var cols2 = df.columns;
        var allRows = dfGet2DValues(df);
        var idx = df.index;
        var ci = cols2.indexOf(sortCol);
        if (ci === -1) return wrapDataFrame(df);
        // pair each row with its original index
        var paired = allRows.map(function(row, i) { return { row: row, idx: idx[i] }; });
        paired.sort(function(a, b) {
          var va = a.row[ci], vb = b.row[ci];
          if (va === null || va === undefined) return 1;
          if (vb === null || vb === undefined) return -1;
          return asc ? (va > vb ? 1 : va < vb ? -1 : 0)
                     : (va < vb ? 1 : va > vb ? -1 : 0);
        });
        var result = {};
        cols2.forEach(function(c) { result[c] = []; });
        var newIdx = [];
        paired.forEach(function(p) {
          cols2.forEach(function(c, i) { result[c].push(p.row[i]); });
          newIdx.push(p.idx);
        });
        var newDf = new dfd2.DataFrame(result, { index: newIdx });
        return wrapDataFrame(newDf);
      });

      if (n === "sort_index") return new Sk.builtin.func(function () {
        var dfd2 = ensureDfd();
        var sorted = df.sortValues(df.columns[0]);
        return wrapDataFrame(sorted);
      });

      if (n === "reset_index") return new Sk.builtin.func(function (kw2) {
        return wrapDataFrame(df.resetIndex());
      });

      if (n === "set_index") return new Sk.builtin.func(function (col) {
        return wrapDataFrame(df.setIndex({ column: py2js(col) }));
      });

      if (n === "rename") return new Sk.builtin.func(function (kw2) {
        var mapping = py2js(kw2 && kw2.mp$subscript ? kw2.mp$subscript(new Sk.builtin.str("columns")) : kw2);
        return wrapDataFrame(df.rename({ mapper: mapping }));
      });

      if (n === "drop") return new Sk.builtin.func(function (labels, kw2) {
        var lbls = py2js(labels);
        var axis = 1;
        if (kw2 && kw2.mp$subscript) {
          var a = kw2.mp$subscript(new Sk.builtin.str("axis"));
          if (a !== undefined) axis = py2js(a);
        }
        if (!Array.isArray(lbls)) lbls = [lbls];
        if (axis === 1 || axis === "columns") {
          return wrapDataFrame(df.drop({ columns: lbls }));
        } else {
          return wrapDataFrame(df.drop({ index: lbls }));
        }
      });

      if (n === "groupby") return new Sk.builtin.func(function (by) {
        var col = py2js(by);
        if (Array.isArray(col)) col = col[0]; // simplified: single col
        return wrapGroupBy(df, col);
      });

      if (n === "merge") return new Sk.builtin.func(function (right, kw2) {
        var rdf = right.__dfd_df;
        var on = null, how = "inner";
        if (kw2) {
          if (kw2.mp$subscript) {
            try { on  = py2js(kw2.mp$subscript(new Sk.builtin.str("on"))); } catch(e) {}
            try { how = py2js(kw2.mp$subscript(new Sk.builtin.str("how"))); } catch(e) {}
          }
        }
        var dfd2 = ensureDfd();
        return wrapDataFrame(dfd2.merge({ left: df, right: rdf, on: [on], how: how }));
      });

      if (n === "join") return new Sk.builtin.func(function (other, kw2) {
        // simplified join via merge on index
        var dfd2 = ensureDfd();
        return wrapDataFrame(dfd2.merge({ left: df, right: other.__dfd_df, on: [df.columns[0]], how: "left" }));
      });

      if (n === "assign") return new Sk.builtin.func(function (kw2) {
        var dfd2 = ensureDfd();
        var newDf = new dfd2.DataFrame(df.values, { columns: df.columns.slice(), index: df.index.slice() });
        if (kw2 && kw2.tp$iter) {
          var iter = Sk.abstr.iter(kw2);
          var k;
          while ((k = Sk.abstr.iternext(iter)) !== undefined) {
            var v = kw2.mp$subscript(k);
            var col = py2js(k);
            var vals2;
            if (typeof v === "function" || (v && v.tp$call)) {
              var sr2 = Sk.misceval.callsim(v, wrapDataFrame(newDf));
              vals2 = sr2.__dfd_sr ? sr2.__dfd_sr.values : py2js(sr2);
            } else {
              vals2 = py2js(v);
            }
            if (!Array.isArray(vals2)) vals2 = new Array(newDf.shape[0]).fill(vals2);
            newDf.addColumn(col, vals2, { inplace: true });
          }
        }
        return wrapDataFrame(newDf);
      });

      if (n === "apply") return new Sk.builtin.func(function (fn, kw2) {
        var axis = 0;
        if (kw2 && kw2.mp$subscript) {
          try { axis = py2js(kw2.mp$subscript(new Sk.builtin.str("axis"))); } catch(e) {}
        }
        var dfd2 = ensureDfd();
        if (axis === 1 || axis === "columns") {
          // apply row-wise
          var results = df.values.map(function (row) {
            var rowDict = {};
            df.columns.forEach(function (c, i) { rowDict[c] = row[i]; });
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

      if (n === "astype") return new Sk.builtin.func(function (dtype) {
        var t = py2js(dtype);
        var map = { "int": "int32", "int32": "int32", "int64": "int32", "float": "float32", "float64": "float32", "str": "string", "string": "string" };
        if (typeof t === "string") return wrapDataFrame(df.astype(map[t] || t));
        // dict per column — not supported yet
        return wrapDataFrame(df);
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

      if (n === "to_csv") return new Sk.builtin.func(function (kw2) {
        var lines = [df.columns.join(",")];
        df.values.forEach(function (row, i) {
          lines.push(df.index[i] + "," + row.join(","));
        });
        return new Sk.builtin.str(lines.join("\n"));
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
        return new Sk.builtin.func(function (kw2) {
          var dfd2 = ensureDfd();
          try {
            var res = df[n]();
            if (res instanceof dfd2.DataFrame) return wrapDataFrame(res);
            if (res instanceof dfd2.Series)    return wrapSeries(res);
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
          var rows2 = Array.isArray(rowSpec) ? rowSpec : [rowSpec];
          var cols2 = colSpec !== undefined ? (Array.isArray(colSpec) ? colSpec : [colSpec]) : df.columns;
          try {
            if (isIloc) {
              return wrapDataFrame(df.iloc({ rows: rows2, columns: cols2.map(function (c) { return typeof c === "string" ? df.columns.indexOf(c) : c; }) }));
            } else {
              return wrapDataFrame(df.loc({ rows: rows2.map(String), columns: cols2 }));
            }
          } catch(e) {
            return js2py(null);
          }
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
            var mask = Array.isArray(rowSpec2) ? rowSpec2 : df.index.map(function (idx) { return idx === rowSpec2; });
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

  mod.read_csv = new Sk.builtin.func(function (path_or_url, kw) {
    var dfd = ensureDfd();
    var url = py2js(path_or_url);
    var sep = ",";
    var header = 0;
    if (kw) {
      try { sep = py2js(kw.mp$subscript(new Sk.builtin.str("sep"))); } catch(e) {}
      try { sep = py2js(kw.mp$subscript(new Sk.builtin.str("delimiter"))); } catch(e) {}
    }
    // if it's raw CSV text (contains newlines), parse directly
    if (url.indexOf("\n") !== -1) {
      var rows = url.trim().split("\n").map(function (r) { return r.split(sep); });
      var headers = rows[0];
      var data = {};
      headers.forEach(function (h) { data[h] = []; });
      for (var i = 1; i < rows.length; i++) {
        headers.forEach(function (h, hi) {
          var v = rows[i][hi];
          var n = parseFloat(v);
          data[h].push(isNaN(n) ? v : n);
        });
      }
      return wrapDataFrame(new dfd.DataFrame(data));
    }
    // URL: use danfo's readCSV (returns a promise — Skulpt async)
    var susp = new Sk.misceval.Suspension();
    susp.resume = function () {
      if (susp.promise.error) throw new Sk.builtin.RuntimeError(new Sk.builtin.str(String(susp.promise.error)));
      return wrapDataFrame(susp.promise.result);
    };
    susp.data = {
      type: "Sk.promise",
      promise: dfd.readCSV(url).then(function (df) {
        susp.promise = { result: df };
        return df;
      }).catch(function (e) {
        susp.promise = { error: e };
      })
    };
    return susp;
  });

  mod.read_json = new Sk.builtin.func(function (path_or_str, kw) {
    var dfd = ensureDfd();
    var url = py2js(path_or_str);
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

  mod.concat = new Sk.builtin.func(function (objs, kw) {
    var dfd = ensureDfd();
    var list = py2js(objs);
    var axis = 0;
    if (kw) {
      try { axis = py2js(kw.mp$subscript(new Sk.builtin.str("axis"))); } catch(e) {}
    }
    var dfs = list.map(function (item) {
      if (item instanceof dfd.DataFrame) return item;
      if (item instanceof dfd.Series)    return item;
      if (item.__dfd_df) return item.__dfd_df;
      if (item.__dfd_sr) return item.__dfd_sr;
      return item;
    });
    return wrapDataFrame(dfd.concat({ dfList: dfs, axis: axis }));
  });

  mod.merge = new Sk.builtin.func(function (left, right, kw) {
    var dfd = ensureDfd();
    var ldf = py2js(left), rdf = py2js(right);
    var on = null, how = "inner";
    if (kw) {
      try { on  = py2js(kw.mp$subscript(new Sk.builtin.str("on"))); } catch(e) {}
      try { how = py2js(kw.mp$subscript(new Sk.builtin.str("how"))); } catch(e) {}
    }
    return wrapDataFrame(dfd.merge({ left: ldf, right: rdf, on: [on], how: how }));
  });

  mod.isna  = new Sk.builtin.func(function (obj) {
    var v = py2js(obj);
    return new Sk.builtin.bool(v === null || v === undefined || (typeof v === "number" && isNaN(v)));
  });
  mod.notna = new Sk.builtin.func(function (obj) {
    var v = py2js(obj);
    return new Sk.builtin.bool(v !== null && v !== undefined && !(typeof v === "number" && isNaN(v)));
  });
  mod.isnull  = mod.isna;
  mod.notnull = mod.notna;

  mod.to_datetime = new Sk.builtin.func(function (arg, kw) {
    var dfd = ensureDfd();
    if (arg.__dfd_sr) {
      var vals = arg.__dfd_sr.values.map(function (v) { return v ? new Date(v).toISOString() : null; });
      return wrapSeries(new dfd.Series(vals, { index: arg.__dfd_sr.index }));
    }
    return js2py(new Date(py2js(arg)).toISOString());
  });

  mod.get_dummies = new Sk.builtin.func(function (data, kw) {
    var dfd = ensureDfd();
    var df = data.__dfd_df || (data.__dfd_sr ? null : null);
    if (!df) return data; // no-op if not supported
    // simplistic one-hot for one column
    return wrapDataFrame(dfd.getDummies(df));
  });

  mod.cut = new Sk.builtin.func(function (x, bins, kw) {
    var dfd = ensureDfd();
    var vals = x.__dfd_sr ? x.__dfd_sr.values : py2js(x);
    var b = py2js(bins);
    var labels = null;
    if (kw) { try { labels = py2js(kw.mp$subscript(new Sk.builtin.str("labels"))); } catch(e) {} }
    var result = vals.map(function (v) {
      if (typeof b === "number") {
        // number of bins
        var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
        var w = (mx - mn) / b;
        var bi = Math.floor((v - mn) / w);
        bi = Math.min(bi, b - 1);
        return labels ? labels[bi] : "(" + (mn + bi * w).toFixed(2) + ", " + (mn + (bi + 1) * w).toFixed(2) + "]";
      }
      // array of bin edges
      for (var i = 0; i < b.length - 1; i++) {
        if (v > b[i] && v <= b[i + 1]) return labels ? labels[i] : "(" + b[i] + ", " + b[i + 1] + "]";
      }
      return null;
    });
    return wrapSeries(new dfd.Series(result, x.__dfd_sr ? { index: x.__dfd_sr.index } : {}));
  });

  mod.qcut = new Sk.builtin.func(function (x, q, kw) {
    var dfd = ensureDfd();
    var vals = x.__dfd_sr ? x.__dfd_sr.values : py2js(x);
    var nq = py2js(q);
    var sorted = vals.slice().sort(function (a, b) { return a - b; });
    var edges = [sorted[0]];
    for (var i = 1; i <= nq; i++) {
      edges.push(sorted[Math.round(i * sorted.length / nq) - 1]);
    }
    return mod.cut.v(x, new Sk.builtin.list(edges.map(js2py)), kw);
  });

  mod.pivot_table = new Sk.builtin.func(function (data, kw) {
    // simplified — return groupby mean
    var df = data.__dfd_df;
    if (!df) return data;
    var values = null, index2 = null, aggfunc = "mean";
    if (kw) {
      try { values  = py2js(kw.mp$subscript(new Sk.builtin.str("values"))); } catch(e) {}
      try { index2  = py2js(kw.mp$subscript(new Sk.builtin.str("index"))); } catch(e) {}
      try { aggfunc = py2js(kw.mp$subscript(new Sk.builtin.str("aggfunc"))); } catch(e) {}
    }
    var dfd2 = ensureDfd();
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
