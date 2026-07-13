/**
* bs4.js — Skulpt stdlib implementation of Python's "beautifulsoup4" (bs4) module
* Парсинг HTML/XML робить нативний браузерний DOMParser.
*
* Підтримано: BeautifulSoup(markup, features) (у т.ч. file-like з .read()),
* Tag: .name/.attrs/.text/.get_text()/.string/.strings/.stripped_strings/.contents/
* .children/.parent/.next_sibling/.previous_sibling/.find()/.find_all()/.findAll()/
* .select()/.select_one()/.get()/.has_attr()/tag['attr']=/del tag['attr']/.decompose()/
* .extract()/.append()/.insert()/.new_tag()/.prettify()/str(tag)/len(tag)/
* soup.<tagname> "магічний" шорткат; фільтри find/find_all за рядком, class_, id,
* attrs-словником, True/False, re.compile(...), списком варіантів і функцією-предикатом.
*
* НЕ підтримано: SoupStrainer, вибір реального парсера (lxml/html5lib — завжди
* DOMParser), Comment/CData як окремі типи, .next_element/.previous_element/.parents/
* .descendants, .replace_with()/.wrap()/.unwrap()/.clear()/.extend()/.smooth(), зміна
* .name/.string, encoding detection, output formatters.
*/
var $builtinmodule = function (name) {
"use strict";

var mod = {};

/* ------------------------------------------------------------------ */
/*  Внутрішні хелпери                                                 */
/* ------------------------------------------------------------------ */

function jsStr(pyVal) {
    if (pyVal === undefined || pyVal === Sk.builtin.none.none$) return undefined;
    return Sk.ffi.remapToJs(pyVal);
}

function setAttr(pyObj, jsName, val) {
    pyObj[jsName] = val;
    pyObj.tp$setattr(new Sk.builtin.str(jsName), val);
    return val;
}

function getDOMParserCtor() {
    if (typeof DOMParser !== "undefined") return DOMParser;
    if (typeof window !== "undefined" && window.DOMParser) return window.DOMParser;
    throw new Sk.builtin.RuntimeError("DOMParser недоступний у цьому середовищі (потрібен браузер)");
}

function parseMarkup(markup, features) {
    var feat = (features || "").toLowerCase();
    var mimeType = (feat.indexOf("xml") !== -1) ? "application/xml" : "text/html";
    var DP = getDOMParserCtor();
    return new DP().parseFromString(markup, mimeType);
}

// Приймає або звичайний Python-рядок, або будь-який file-like об'єкт
// (усе, що має метод .read()
function markupToString(markupPy) {
    if (markupPy === undefined || markupPy === Sk.builtin.none.none$) return "";
    if (markupPy instanceof Sk.builtin.str) {
        return Sk.ffi.remapToJs(markupPy);
    }
    var readMeth;
    try {
        readMeth = Sk.abstr.gattr(markupPy, new Sk.builtin.str("read"), true);
    } catch (e) {
        readMeth = undefined;
    }
    if (readMeth !== undefined && readMeth !== Sk.builtin.none.none$ && Sk.builtin.checkCallable(readMeth)) {
        var content = Sk.misceval.callsimArray(readMeth, []);
        return Sk.ffi.remapToJs(content) || "";
    }
    
    var fallback = Sk.ffi.remapToJs(markupPy);
    return (typeof fallback === "string") ? fallback : "";
}

// Перетворює Python dict у звичайний JS-об'єкт
function dictToObj(pyDict) {
    if (pyDict === undefined || pyDict === Sk.builtin.none.none$) return undefined;
    var jsObj = Sk.ffi.remapToJs(pyDict);
    if (jsObj === null || typeof jsObj !== "object" || Array.isArray(jsObj)) return undefined;
    return jsObj;
}

/* ------------------------------------------------------------------ */
/*  Розбір kwargs для find/find_all/new_tag тощо.
/* ------------------------------------------------------------------ */
function parseKwargs(kwargsArr) {
    var out = {};
    if (!kwargsArr) return out;
    for (var i = 0; i < kwargsArr.length; i += 2) {
        var rawKey = kwargsArr[i];
        var key = (rawKey && rawKey.v !== undefined) ? Sk.ffi.remapToJs(rawKey) : rawKey;
        out[key] = kwargsArr[i + 1];
    }
    return out;
}

/* ------------------------------------------------------------------ */
/*  Обгортання DOM-вузлів у python-об'єкти                            */
/* ------------------------------------------------------------------ */

function wrapNode(node) {
    if (!node) return Sk.builtin.none.none$;
    if (node.nodeType === 3) { // TEXT_NODE
        return new Sk.builtin.str(node.textContent);
    }
    if (node.nodeType === 1) { // ELEMENT_NODE
        return makeTagInstance(node, false);
    }
    return null; // Comment/CDATA/інше — свідомо пропускаємо
}

function makeTagInstance(domNode, isDocRoot) {
    var t = Sk.misceval.callsimArray(mod.Tag);
    t._node = domNode;       
    t._isDocRoot = !!isDocRoot;
    return t;
}

/* ------------------------------------------------------------------ */
/*  Побудова CSS-селектора з фільтрів find/find_all                   */
/* ------------------------------------------------------------------ */

function cssAttrEscape(v) {
    return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildSelector(nameFilter, attrsObj, classVal, idVal, extraAttrs) {
    var sel = nameFilter ? nameFilter : "*";
    if (idVal !== undefined) {
        sel += '[id="' + cssAttrEscape(idVal) + '"]';
    }
    if (classVal !== undefined) {
        var classes = Array.isArray(classVal) ? classVal : String(classVal).split(/\s+/).filter(Boolean);
        classes.forEach(function (c) { sel += "." + c; });
    }
    var merged = {};
    if (attrsObj) for (var k in attrsObj) merged[k] = attrsObj[k];
    if (extraAttrs) for (var k2 in extraAttrs) merged[k2] = extraAttrs[k2];
    for (var key in merged) {
        var v = merged[key];
        if (v === true) {
            sel += "[" + key + "]";
        } else {
            sel += '[' + key + '="' + cssAttrEscape(v) + '"]';
        }
    }
    return sel;
}

// Розпізнає "службові" ключі фільтра (name/attrs/class_/id/string/limit/
var RESERVED_FILTER_KEYS = { name: 1, attrs: 1, class_: 1, id: 1, string: 1, text: 1, limit: 1, recursive: 1 };

function splitFilterKwargs(kwObj) {
    var extra = {};
    var known = {};
    for (var k in kwObj) {
        if (RESERVED_FILTER_KEYS[k]) known[k] = kwObj[k];
        else extra[k] = kwObj[k]; // сирe Sk-значення — тип розпізнається пізніше в makeValueMatcher
    }
    return { known: known, extra: extra };
}

/* ------------------------------------------------------------------ */
/*  Матчери фільтрів: рядок / True / False / re.compile(...) / список */
/* ------------------------------------------------------------------ */

function classifyFilterValue(val) {
    if (val === undefined || val === Sk.builtin.none.none$) return "none";
    if (val === Sk.builtin.bool.true$) return "true";
    if (val === Sk.builtin.bool.false$) return "false";
    if (val instanceof Sk.builtin.str) return "str";
    if (val instanceof Sk.builtin.list) return "list";
    if (val.tp$name === "RegexObject") return "regex";
    if (val.tp$name === "function" || val.tp$name === "method") return "callable";
    return "unknown";
}

// Матчер для значень атрибутів/тексту
function makeValueMatcher(rawVal, tokenMatch) {
    var kind = classifyFilterValue(rawVal);

    if (tokenMatch && (kind === "str" || kind === "regex" || kind === "callable")) {
        var perTokenMatcher = makeValueMatcher(rawVal, false);
        return function (v) {
            if (v === undefined) return false;
            var tokens = v.trim().length ? v.trim().split(/\s+/) : [];
            return tokens.some(perTokenMatcher);
        };
    }

    switch (kind) {
        case "none": return null;
        case "true": return function (v) { return v !== undefined; };
        case "false": return function (v) { return v === undefined; };
        case "str": {
            var s = Sk.ffi.remapToJs(rawVal);
            return function (v) { return v === s; };
        }
        case "regex": {
            var searchMeth = rawVal.tp$getattr(new Sk.builtin.str("search"));
            return function (v) {
                if (v === undefined) return false;
                var res = Sk.misceval.callsimArray(searchMeth, [new Sk.builtin.str(v)]);
                return res !== Sk.builtin.none.none$;
            };
        }
        case "list": {
            var subs = rawVal.v.map(function (item) { return makeValueMatcher(item, tokenMatch); });
            return function (v) { return subs.some(function (m) { return m ? m(v) : false; }); };
        }
        case "callable":
            return function (v) {
                var pyArg = v === undefined ? Sk.builtin.none.none$ : new Sk.builtin.str(v);
                return Sk.misceval.isTrue(Sk.misceval.callsimArray(rawVal, [pyArg]));
            };
        default:
            throw new Sk.builtin.NotImplementedError("Непідтримуваний тип значення фільтра.");
    }
}

// Матчер для "name"
function makeNameMatcher(rawVal) {
    if (classifyFilterValue(rawVal) === "callable") {
        return function (domNode) {
            var tag = makeTagInstance(domNode, false);
            return Sk.misceval.isTrue(Sk.misceval.callsimArray(rawVal, [tag]));
        };
    }
    var valueMatcher = makeValueMatcher(rawVal, false);
    if (!valueMatcher) return null;
    return function (domNode) {
        return valueMatcher(domNode.tagName ? domNode.tagName.toLowerCase() : undefined);
    };
}

function simpleStrProjection(rawVal) {
    return classifyFilterValue(rawVal) === "str" ? Sk.ffi.remapToJs(rawVal) : undefined;
}

/* ------------------------------------------------------------------ */
/*  Ядро пошуку: find_all                                             */
/* ------------------------------------------------------------------ */

function findAllOnNode(rootNode, opts) {
    // opts: {nameRaw, attrsObj, classRaw, idRaw, stringRaw, extraRaw, limit, recursive}
    var results = [];

    var hasTagFilter = opts.nameRaw !== undefined || (opts.attrsObj && Object.keys(opts.attrsObj).length) ||
        opts.classRaw !== undefined || opts.idRaw !== undefined ||
        (opts.extraRaw && Object.keys(opts.extraRaw).length);

    // Пошук ЛИШЕ за текстом (без імені тега й атрибутів)
    if (opts.stringRaw !== undefined && !hasTagFilter) {
        var stringMatcher = makeValueMatcher(opts.stringRaw, false);
        var doc = rootNode.ownerDocument || rootNode;
        var walker = doc.createTreeWalker(rootNode, 4 /* NodeFilter.SHOW_TEXT */);
        var tn;
        while ((tn = walker.nextNode())) {
            if (stringMatcher(tn.textContent)) {
                results.push(tn.textContent);
                if (opts.limit && results.length >= opts.limit) break;
            }
        }
        return { items: results, isString: true };
    }

    var selector = buildSelector(
        simpleStrProjection(opts.nameRaw), opts.attrsObj,
        simpleStrProjection(opts.classRaw), simpleStrProjection(opts.idRaw),
        undefined
    );
    var nodeList;
    try {
        nodeList = (opts.recursive === false)
            ? rootNode.querySelectorAll(":scope > " + selector)
            : rootNode.querySelectorAll(selector);
    } catch (e) {
        throw new Sk.builtin.ValueError("Некоректний CSS-селектор, згенерований з фільтра: " + selector);
    }
    var arr = Array.prototype.slice.call(nodeList);

    var nameMatcher = makeNameMatcher(opts.nameRaw);
    var idMatcher = makeValueMatcher(opts.idRaw, false);
    var classMatcher = makeValueMatcher(opts.classRaw, true);
    var stringMatcherForTags = opts.stringRaw !== undefined ? makeValueMatcher(opts.stringRaw, false) : null;
    var extraMatchers = {};
    for (var ek in (opts.extraRaw || {})) extraMatchers[ek] = makeValueMatcher(opts.extraRaw[ek], false);

    arr = arr.filter(function (el) {
        if (nameMatcher && !nameMatcher(el)) return false;
        if (idMatcher && !idMatcher(el.hasAttribute("id") ? el.getAttribute("id") : undefined)) return false;
        if (classMatcher && !classMatcher(el.hasAttribute("class") ? el.getAttribute("class") : undefined)) return false;
        if (stringMatcherForTags && !stringMatcherForTags(el.textContent)) return false;
        for (var attrName in extraMatchers) {
            var v = el.hasAttribute(attrName) ? el.getAttribute(attrName) : undefined;
            if (!extraMatchers[attrName](v)) return false;
        }
        return true;
    });

    if (opts.limit) arr = arr.slice(0, opts.limit);
    return { items: arr, isString: false };
}

function resolveFindArgs(kwa, positionalName, positionalAttrs) {
    var kw = parseKwargs(kwa);
    var split = splitFilterKwargs(kw);
    var known = split.known;

    var nameRaw = positionalName !== undefined && positionalName !== Sk.builtin.none.none$
        ? positionalName
        : known.name;

    var classRaw = known.class_;
    if (positionalAttrs !== undefined && positionalAttrs !== Sk.builtin.none.none$ && positionalAttrs instanceof Sk.builtin.str) {
        classRaw = positionalAttrs;
    }
    var attrsObj = positionalAttrs !== undefined && positionalAttrs !== Sk.builtin.none.none$ && !(positionalAttrs instanceof Sk.builtin.str)
        ? dictToObj(positionalAttrs)
        : (known.attrs !== undefined ? dictToObj(known.attrs) : undefined);

    var idRaw = known.id;
    var stringRaw = known.string !== undefined ? known.string : known.text;
    var limit = known.limit !== undefined ? jsStr(known.limit) : undefined;
    var recursive = known.recursive !== undefined ? Sk.misceval.isTrue(known.recursive) : true;

    return {
        nameRaw: nameRaw, attrsObj: attrsObj, classRaw: classRaw, idRaw: idRaw,
        stringRaw: stringRaw, limit: limit, recursive: recursive, extraRaw: split.extra
    };
}

/* ------------------------------------------------------------------ */
/*  Tag — основний python-клас (представляє і елемент, і сам BeautifulSoup)
/* ------------------------------------------------------------------ */

mod.Tag = Sk.misceval.buildClass(mod, function (globals, attrs) {

    attrs.__init__ = new Sk.builtin.func(function (self) {
        self._node = null;
        self._isDocRoot = false;
        return Sk.builtin.none.none$;
    });

    // --- "Магічні" властивості (.name/.attrs/.text/...) + bs4-шорткат
    // (soup.title, tag.a, ...) 
    attrs.__getattr__ = new Sk.builtin.func(function (self, pyName) {
        var n = jsStr(pyName);
        var node = self._node;

        if (n === "name") {
            return new Sk.builtin.str(self._isDocRoot ? "[document]" : node.tagName.toLowerCase());
        }
        if (n === "attrs") {
            var out = {};
            if (node.attributes) {
                for (var i = 0; i < node.attributes.length; i++) {
                    var an = node.attributes[i].name;
                    if (an === "class") {
                        var toks2 = node.attributes[i].value.trim().length ? node.attributes[i].value.trim().split(/\s+/) : [];
                        out[an] = toks2;
                    } else {
                        out[an] = node.attributes[i].value;
                    }
                }
            }
            return Sk.ffi.remapToPy(out);
        }
        if (n === "text") {
            return new Sk.builtin.str(node.textContent || "");
        }
        if (n === "string") {
            // NavigableString-спрощення: якщо єдиний дочірній вузол — текст,
            // повертаємо його; інакше None (як і в оригінальному bs4).
            var kids = Array.prototype.filter.call(node.childNodes, function (c) {
                return c.nodeType === 1 || c.nodeType === 3;
            });
            if (kids.length === 1 && kids[0].nodeType === 3) {
                return new Sk.builtin.str(kids[0].textContent);
            }
            if (kids.length === 0) return Sk.builtin.none.none$;
            if (kids.length === 1 && kids[0].nodeType === 1) {
                return Sk.misceval.callsimArray(Sk.builtin.getattr, [wrapNode(kids[0]), new Sk.builtin.str("string")]);
            }
            return Sk.builtin.none.none$;
        }
        if (n === "contents") {
            var list = [];
            for (var j = 0; j < node.childNodes.length; j++) {
                var w = wrapNode(node.childNodes[j]);
                if (w !== null) list.push(w);
            }
            return new Sk.builtin.list(list);
        }
        if (n === "children") {
            // Спрощення: справжній bs4 повертає генератор; тут — список
            // (для `for x in tag.children` поведінка ідентична).
            return Sk.misceval.callsimArray(Sk.builtin.getattr, [self, new Sk.builtin.str("contents")]);
        }
        if (n === "strings" || n === "stripped_strings") {
            // Спрощення: справжній bs4 повертає генератор; тут — список.
            var doc2 = node.ownerDocument || node;
            var walker2 = doc2.createTreeWalker(node, 4 /* NodeFilter.SHOW_TEXT */);
            var pieces = [];
            var tn2;
            while ((tn2 = walker2.nextNode())) {
                if (n === "stripped_strings") {
                    var stripped = tn2.textContent.trim();
                    if (stripped.length) pieces.push(new Sk.builtin.str(stripped));
                } else {
                    pieces.push(new Sk.builtin.str(tn2.textContent));
                }
            }
            return new Sk.builtin.list(pieces);
        }
        if (n === "parent") {
            var p = node.parentElement || (node.parentNode && node.parentNode.nodeType === 1 ? node.parentNode : null);
            if (!p) return Sk.builtin.none.none$;
            return makeTagInstance(p, p === (node.ownerDocument && node.ownerDocument.documentElement) ? false : false);
        }
        if (n === "next_sibling") {
            var w2 = wrapNode(node.nextSibling);
            return w2 === null ? Sk.builtin.none.none$ : w2;
        }
        if (n === "previous_sibling") {
            var w3 = wrapNode(node.previousSibling);
            return w3 === null ? Sk.builtin.none.none$ : w3;
        }

        // bs4-шорткат: soup.title == soup.find('title'); tag.a == tag.find('a')
        if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(n)) {
            var found = node.querySelector(n);
            if (found) return makeTagInstance(found, false);
            return Sk.builtin.none.none$;
        }

        throw new Sk.builtin.AttributeError("'Tag' об'єкт не має атрибута '" + n + "'");
    });

    function attrValueFor(node, k) {
        var raw = node.getAttribute(k);
        if (k === "class") {
            var toks = raw.trim().length ? raw.trim().split(/\s+/) : [];
            return new Sk.builtin.list(toks.map(function (t) { return new Sk.builtin.str(t); }));
        }
        return new Sk.builtin.str(raw);
    }

    // --- tag['href'] ---
    attrs.__getitem__ = new Sk.builtin.func(function (self, key) {
        var k = jsStr(key);
        if (!self._node.hasAttribute || !self._node.hasAttribute(k)) {
            throw new Sk.builtin.KeyError(new Sk.builtin.str(k));
        }
        return attrValueFor(self._node, k);
    });

    // --- tag['id'] = 'x' ---
    attrs.__setitem__ = new Sk.builtin.func(function (self, key, val) {
        var k = jsStr(key);
        var v;
        if (val instanceof Sk.builtin.list) {
            v = val.v.map(function (item) { return jsStr(item); }).join(" ");
        } else {
            v = jsStr(val);
        }
        self._node.setAttribute(k, v);
        return Sk.builtin.none.none$;
    });

    // --- del tag['id'] ---
    attrs.__delitem__ = new Sk.builtin.func(function (self, key) {
        var k = jsStr(key);
        if (!self._node.hasAttribute || !self._node.hasAttribute(k)) {
            throw new Sk.builtin.KeyError(new Sk.builtin.str(k));
        }
        self._node.removeAttribute(k);
        return Sk.builtin.none.none$;
    });

    // --- str(tag) -> outerHTML (або весь документ, якщо це soup) ---
    attrs.__str__ = new Sk.builtin.func(function (self) {
        if (self._isDocRoot) {
            var de = self._node.documentElement;
            return new Sk.builtin.str(de ? de.outerHTML : "");
        }
        return new Sk.builtin.str(self._node.outerHTML);
    });
    attrs.__repr__ = attrs.__str__;

    attrs.__len__ = new Sk.builtin.func(function (self) {
        return new Sk.builtin.int_(self._node.childNodes.length);
    });

    // --- .get(key, default=None) ---
    var getFn = function (kwa, self, key, defaultVal) {
        var k = jsStr(key);
        if (self._node.hasAttribute && self._node.hasAttribute(k)) {
            return attrValueFor(self._node, k);
        }
        return defaultVal !== undefined ? defaultVal : Sk.builtin.none.none$;
    };
    getFn.co_kwargs = true;
    attrs.get = new Sk.builtin.func(getFn);

    // --- .has_attr(key) ---
    attrs.has_attr = new Sk.builtin.func(function (self, key) {
        var k = jsStr(key);
        return Sk.builtin.bool(!!(self._node.hasAttribute && self._node.hasAttribute(k)));
    });

    // --- .get_text(separator="", strip=False) ---
    var getTextFn = function (kwa, self, sep) {
        var kw = parseKwargs(kwa);
        var separator = sep !== undefined ? jsStr(sep) : (kw.separator !== undefined ? jsStr(kw.separator) : "");
        var strip = kw.strip !== undefined ? Sk.misceval.isTrue(kw.strip) : false;
        var doc = self._node.ownerDocument || self._node;
        var walker = doc.createTreeWalker(self._node, 4 /* SHOW_TEXT */);
        var parts = [];
        var tn;
        while ((tn = walker.nextNode())) {
            parts.push(strip ? tn.textContent.trim() : tn.textContent);
        }
        if (strip) parts = parts.filter(function (p) { return p.length > 0; });
        return new Sk.builtin.str(parts.join(separator));
    };
    getTextFn.co_kwargs = true;
    attrs.get_text = new Sk.builtin.func(getTextFn);

    // --- .find(name=None, attrs={}, recursive=True, string=None, **kwargs) ---
    var findFn = function (kwa, self, name, attrsArg) {
        var o = resolveFindArgs(kwa, name, attrsArg);
        o.limit = 1;
        var res = findAllOnNode(self._node, o);
        if (res.items.length === 0) return Sk.builtin.none.none$;
        return res.isString ? new Sk.builtin.str(res.items[0]) : makeTagInstance(res.items[0], false);
    };
    findFn.co_kwargs = true;
    attrs.find = new Sk.builtin.func(findFn);

    // --- .find_all(...) / .findAll(...) ---
    var findAllFn = function (kwa, self, name, attrsArg) {
        var o = resolveFindArgs(kwa, name, attrsArg);
        var res = findAllOnNode(self._node, o);
        var pyItems = res.items.map(function (it) {
            return res.isString ? new Sk.builtin.str(it) : makeTagInstance(it, false);
        });
        return new Sk.builtin.list(pyItems);
    };
    findAllFn.co_kwargs = true;
    attrs.find_all = new Sk.builtin.func(findAllFn);
    attrs.findAll = attrs.find_all; // застарілий, але поширений alias з bs4

    // --- .select(css) / .select_one(css) ---
    attrs.select = new Sk.builtin.func(function (self, cssSel) {
        var sel = jsStr(cssSel);
        var nodeList;
        try {
            nodeList = self._node.querySelectorAll(sel);
        } catch (e) {
            throw new Sk.builtin.ValueError("Некоректний CSS-селектор: " + sel);
        }
        var items = Array.prototype.map.call(nodeList, function (n) { return makeTagInstance(n, false); });
        return new Sk.builtin.list(items);
    });
    attrs.select_one = new Sk.builtin.func(function (self, cssSel) {
        var sel = jsStr(cssSel);
        var found;
        try {
            found = self._node.querySelector(sel);
        } catch (e) {
            throw new Sk.builtin.ValueError("Некоректний CSS-селектор: " + sel);
        }
        return found ? makeTagInstance(found, false) : Sk.builtin.none.none$;
    });

    // --- .decompose() ---
    attrs.decompose = new Sk.builtin.func(function (self) {
        if (self._node && self._node.remove) self._node.remove();
        return Sk.builtin.none.none$;
    });

    // --- .extract()
    attrs.extract = new Sk.builtin.func(function (self) {
        if (self._node && self._node.parentNode) {
            self._node.parentNode.removeChild(self._node);
        }
        return self;
    });

    // --- .append(child) ---
    attrs.append = new Sk.builtin.func(function (self, child) {
        if (child instanceof Sk.builtin.str) {
            self._node.appendChild(self._node.ownerDocument.createTextNode(jsStr(child)));
        } else if (child && child._node) {
            self._node.appendChild(child._node);
        } else {
            throw new Sk.builtin.TypeError("append() очікує Tag або рядок");
        }
        return Sk.builtin.none.none$;
    });

    // --- .insert(index, child) ---
    attrs.insert = new Sk.builtin.func(function (self, index, child) {
        var idx = jsStr(index);
        var newNode;
        if (child instanceof Sk.builtin.str) {
            newNode = self._node.ownerDocument.createTextNode(jsStr(child));
        } else if (child && child._node) {
            newNode = child._node;
        } else {
            throw new Sk.builtin.TypeError("insert() очікує Tag або рядок");
        }
        var ref = self._node.childNodes[idx] || null;
        self._node.insertBefore(newNode, ref);
        return Sk.builtin.none.none$;
    });

    // --- .prettify() — спрощений рекурсивний indent ---
    attrs.prettify = new Sk.builtin.func(function (self) {
        function rec(node, depth) {
            if (node.nodeType === 9) {
                return Array.prototype.map.call(node.childNodes, function (c) { return rec(c, depth); }).join("");
            }
            var pad = "  ".repeat(depth);
            if (node.nodeType === 3) {
                var t = node.textContent.trim();
                return t ? pad + t + "\n" : "";
            }
            if (node.nodeType !== 1) return "";
            var tag = node.tagName.toLowerCase();
            var attrsStr = Array.prototype.map.call(node.attributes || [], function (a) {
                return ' ' + a.name + '="' + a.value + '"';
            }).join("");
            var childrenStr = Array.prototype.map.call(node.childNodes, function (c) { return rec(c, depth + 1); }).join("");
            if (!childrenStr) return pad + "<" + tag + attrsStr + "></" + tag + ">\n";
            return pad + "<" + tag + attrsStr + ">\n" + childrenStr + pad + "</" + tag + ">\n";
        }
        return new Sk.builtin.str(rec(self._node, 0).replace(/\n$/, ""));
    });

    // --- .new_tag(name, string=None, **attrs) — створює НЕприв'язаний (detached) тег ---
    var newTagFn = function (kwa, self, tagName) {
        var kw = parseKwargs(kwa);
        var n = jsStr(tagName);
        var doc = self._node.ownerDocument || self._node;
        var el = doc.createElement(n);
        for (var k in kw) {
            if (k === "string") {
                el.textContent = jsStr(kw[k]);
                continue;
            }
            el.setAttribute(k, jsStr(kw[k]));
        }
        return makeTagInstance(el, false);
    };
    newTagFn.co_kwargs = true;
    attrs.new_tag = new Sk.builtin.func(newTagFn);

}, "Tag", []);

/* ------------------------------------------------------------------ */
/*  BeautifulSoup(markup, features=None)
/* ------------------------------------------------------------------ */

var bsCtorFn = function (kwa, markup, features) {
    var kw = parseKwargs(kwa);
    var markupJs = markupToString(markup);
    var featuresJs = features !== undefined ? jsStr(features) : (kw.features !== undefined ? jsStr(kw.features) : "");
    var doc = parseMarkup(markupJs, featuresJs);
    var t = makeTagInstance(doc, true);
    return t;
};
bsCtorFn.co_kwargs = true;
mod.BeautifulSoup = new Sk.builtin.func(bsCtorFn);

mod.__name__ = new Sk.builtin.str("bs4");

return mod;
};
