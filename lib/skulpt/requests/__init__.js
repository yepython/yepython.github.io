/**
 * requests.js — Skulpt-реалізація підмножини Python-бібліотеки "requests".
 *
 * CORS: запити підпорядковуються CORS-політиці цільового сервера; помилка
 * з'єднання (мережа/CORS/downtime) невідрізнювана на рівні браузера.
 *
 * Підтримано: get/post/put/patch/delete/head/options, Session,
 * Response (.status_code/.reason/.ok/.text/.content[bytes]/.headers/.url/.encoding/.elapsed[timedelta]/.json()/.raise_for_status()),
 * винятки RequestException/ConnectionError/HTTPError/Timeout/TooManyRedirects.
 *
 * Не підтримано: streaming, multipart upload, proxies, verify=False,
 * auth-плагіни (крім Basic), історія редиректів.
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

function dictToObj(pyDict) {
    if (pyDict === undefined || pyDict === Sk.builtin.none.none$) return undefined;
    var jsObj = Sk.ffi.remapToJs(pyDict);
    if (jsObj === null || typeof jsObj !== "object" || Array.isArray(jsObj)) return undefined;
    var out = {};
    for (var k in jsObj) out[k] = jsObj[k];
    return out;
}

function buildQueryString(paramsObj) {
    if (!paramsObj) return "";
    var parts = [];
    for (var k in paramsObj) {
        var v = paramsObj[k];
        if (Array.isArray(v)) {
            v.forEach(function (item) { parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(item)); });
        } else {
            parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
        }
    }
    return parts.join("&");
}

function headersToObj(fetchHeaders) {
    var out = {};
    fetchHeaders.forEach(function (value, key) { out[key] = value; });
    return out;
}

function detectEncoding(contentTypeHeader) {
    if (!contentTypeHeader) return "utf-8";
    var m = /charset=([^;]+)/i.exec(contentTypeHeader);
    return m ? m[1].trim().toLowerCase() : "utf-8";
}

var REASON_PHRASES = {
    200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
    301: "Moved Permanently", 302: "Found", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    405: "Method Not Allowed", 408: "Request Timeout", 409: "Conflict",
    410: "Gone", 422: "Unprocessable Entity", 429: "Too Many Requests",
    500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway",
    503: "Service Unavailable", 504: "Gateway Timeout"
};

function reasonPhrase(status, statusText) {
    if (statusText) return statusText;
    return REASON_PHRASES[status] || "";
}

function setAttr(pyObj, name, val) {
    pyObj[name] = val;
    pyObj.tp$setattr(new Sk.builtin.str(name), val);
    return val;
}

var _timedeltaClass = null;
var _timedeltaUnavailable = false;
function makeElapsed(elapsedMs) {
    if (_timedeltaUnavailable) {
        return Sk.builtin.none.none$;
    }
    try {
        if (_timedeltaClass === null) {
            var dtMod = Sk.importModule("datetime", false, false);
            _timedeltaClass = dtMod.tp$getattr(new Sk.builtin.str("timedelta"));
        }
        return Sk.misceval.callsimArray(_timedeltaClass, [
            new Sk.builtin.int_(0), new Sk.builtin.float_(elapsedMs / 1000)
        ]);
    } catch (e) {
        console.error("[requests.js] не вдалося побудувати datetime.timedelta для .elapsed:", e);
        _timedeltaUnavailable = true;
        return Sk.builtin.none.none$;
    }
}

/* ------------------------------------------------------------------ */
/*  Python-винятки (requests.exceptions)                              */
/* ------------------------------------------------------------------ */

var excModule = {};

function makeExceptionClass(pyName, baseKlass) {
    return Sk.misceval.buildClass(mod, function (globals, attrs) {
        attrs.__init__ = new Sk.builtin.func(function (self, msg) {
            self.args = new Sk.builtin.tuple([msg || new Sk.builtin.str("")]);
            setAttr(self, "message", msg || new Sk.builtin.str(""));
            return Sk.builtin.none.none$;
        });
        attrs.__str__ = new Sk.builtin.func(function (self) { return self.message; });
    }, pyName, baseKlass ? [baseKlass] : []);
}

excModule.RequestException  = makeExceptionClass("RequestException", Sk.builtin.Exception);
excModule.ConnectionError   = makeExceptionClass("ConnectionError",  excModule.RequestException);
excModule.HTTPError         = makeExceptionClass("HTTPError",        excModule.RequestException);
excModule.Timeout           = makeExceptionClass("Timeout",          excModule.RequestException);
excModule.TooManyRedirects  = makeExceptionClass("TooManyRedirects", excModule.RequestException);

function raisePy(klass, message) {
    var inst = Sk.misceval.callsimArray(klass, [new Sk.builtin.str(message)]);
    throw inst;
}

/* ------------------------------------------------------------------ */
/*  Response — Python-клас                                            */
/* ------------------------------------------------------------------ */

function makeResponseInstance(fetchResp, bodyBuffer, url, elapsedMs) {
    var bytes = new Uint8Array(bodyBuffer);
    var contentType = fetchResp.headers.get("content-type");
    var encoding = detectEncoding(contentType);

    var bodyText;
    try {
        bodyText = new TextDecoder(encoding).decode(bytes);
    } catch (e) {
        // невідома/непідтримувана кодировка -> як реальний requests, падаємо на utf-8
        bodyText = new TextDecoder("utf-8").decode(bytes);
    }

    var pyResp = Sk.misceval.callsimArray(mod.Response);
    setAttr(pyResp, "status_code", new Sk.builtin.int_(fetchResp.status));
    setAttr(pyResp, "reason",      new Sk.builtin.str(reasonPhrase(fetchResp.status, fetchResp.statusText)));
    setAttr(pyResp, "ok",          Sk.builtin.bool(fetchResp.status >= 200 && fetchResp.status < 400));
    setAttr(pyResp, "url",         new Sk.builtin.str(url));
    setAttr(pyResp, "text",        new Sk.builtin.str(bodyText));
    setAttr(pyResp, "content",     new Sk.builtin.bytes(bytes)); // тепер справжні bytes, не рядок
    setAttr(pyResp, "elapsed",     makeElapsed(elapsedMs));
    pyResp._headers = headersToObj(fetchResp.headers); // суто внутрішнє, не python-атрибут
    setAttr(pyResp, "headers", Sk.ffi.remapToPy(pyResp._headers));
    setAttr(pyResp, "encoding", new Sk.builtin.str(encoding));
    return pyResp;
}

mod.Response = Sk.misceval.buildClass(mod, function (globals, attrs) {
    attrs.__init__ = new Sk.builtin.func(function (self) {
        setAttr(self, "status_code", Sk.builtin.none.none$);
        setAttr(self, "ok",          Sk.builtin.bool(false));
        setAttr(self, "text",        new Sk.builtin.str(""));
        setAttr(self, "content",     new Sk.builtin.bytes([]));
        setAttr(self, "url",         new Sk.builtin.str(""));
        setAttr(self, "headers",     Sk.ffi.remapToPy({}));
        setAttr(self, "encoding",    Sk.builtin.none.none$);
        setAttr(self, "elapsed",     makeElapsed(0));
        return Sk.builtin.none.none$;
    });

    attrs.json = new Sk.builtin.func(function (self) {
        var raw = Sk.ffi.remapToJs(self.text);
        var parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            raisePy(excModule.RequestException, "Response не містить валідного JSON");
        }
        return Sk.ffi.remapToPy(parsed);
    });

    attrs.raise_for_status = new Sk.builtin.func(function (self) {
        var code = Sk.ffi.remapToJs(self.status_code);
        if (code >= 400) {
            var kind = code >= 500 ? "Server Error" : "Client Error";
            raisePy(excModule.HTTPError, code + " " + kind + " for url: " + Sk.ffi.remapToJs(self.url));
        }
        return Sk.builtin.none.none$;
    });

    attrs.__repr__ = new Sk.builtin.func(function (self) {
        return new Sk.builtin.str("<Response [" + Sk.ffi.remapToJs(self.status_code) + "]>");
    });
    attrs.__str__ = attrs.__repr__;
}, "Response", []);

/* ------------------------------------------------------------------ */
/*  Ядро: виконання HTTP-запиту через fetch + Suspension              */
/* ------------------------------------------------------------------ */

function doRequest(method, url, opts) {
    opts = opts || {};

    var qs = buildQueryString(opts.params);
    var fullUrl = url + (qs ? (url.indexOf("?") === -1 ? "?" : "&") + qs : "");

    var fetchOpts = {
        method: method,
        headers: opts.headers || {},
        credentials: opts.withCredentials ? "include" : "same-origin"
    };

    if (opts.json !== undefined) {
        fetchOpts.headers["Content-Type"] = fetchOpts.headers["Content-Type"] || "application/json";
        fetchOpts.body = JSON.stringify(opts.json);
    } else if (opts.data !== undefined) {
        if (opts.data instanceof Uint8Array) {
            // Python bytes -> сирі байти напряму в тіло, без перетворення на рядок
            fetchOpts.body = opts.data;
        } else if (opts.data !== null && typeof opts.data === "object" && !Array.isArray(opts.data)) {
            fetchOpts.headers["Content-Type"] = fetchOpts.headers["Content-Type"] || "application/x-www-form-urlencoded";
            fetchOpts.body = buildQueryString(opts.data);
        } else if (Array.isArray(opts.data)) {
            fetchOpts.headers["Content-Type"] = fetchOpts.headers["Content-Type"] || "application/x-www-form-urlencoded";
            fetchOpts.body = opts.data.map(function (pair) {
                return encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]);
            }).join("&");
        } else {
            fetchOpts.body = String(opts.data);
        }
    }

    if (opts.auth) {
        fetchOpts.headers["Authorization"] = "Basic " + btoa(opts.auth[0] + ":" + opts.auth[1]);
    }

    var controller = new AbortController();
    fetchOpts.signal = controller.signal;
    var timeoutId;
    if (opts.timeout) {
        timeoutId = setTimeout(function () { controller.abort(); }, opts.timeout * 1000);
    }

    var t0 = performance.now();

    var promise = fetch(fullUrl, fetchOpts)
        .catch(function (networkErr) {
            if (timeoutId) clearTimeout(timeoutId);
            if (networkErr && networkErr.name === "AbortError") {
                raisePy(excModule.Timeout, "Request to " + fullUrl + " timed out");
            }
    
            console.error("[requests.js] fetch() network error:", networkErr);
            var detail = (networkErr && networkErr.message) ? networkErr.message : String(networkErr);
            raisePy(excModule.ConnectionError, "Не вдалося з'єднатися з " + fullUrl + " (мережа або CORS): " + detail);
        })
        .then(function (resp) {
            if (timeoutId) clearTimeout(timeoutId);
            return resp.arrayBuffer().then(function (buf) {
                return makeResponseInstance(resp, buf, resp.url || fullUrl, performance.now() - t0);
            });
        });

    var suspension = new Sk.misceval.Suspension();
    var resolvedVal;
    suspension.resume = function () {
        if (suspension.data.error !== undefined) {
            throw suspension.data.error;
        }
        return resolvedVal;
    };
    suspension.data = {
        type: "Sk.promise",
        promise: promise.then(function (v) { resolvedVal = v; return v; })
    };
    return suspension;
}

/* ------------------------------------------------------------------ */
/*  Парсинг Python kwargs для get/post/... (params, headers, json, data, timeout, auth)
 * ------------------------------------------------------------------ */

function parseKwargs(kwargsArr) {
    var out = {};
    if (!kwargsArr) return out;
    for (var i = 0; i < kwargsArr.length; i += 2) {
        var rawKey = kwargsArr[i];
        var key = (rawKey && rawKey.v !== undefined) ? Sk.ffi.remapToJs(rawKey) : rawKey;
        var val = kwargsArr[i + 1];
        switch (key) {
            case "params":  out.params  = dictToObj(val); break;
            case "headers": out.headers = dictToObj(val) || {}; break;
            case "json":    out.json    = (val === undefined || val === Sk.builtin.none.none$) ? undefined : Sk.ffi.remapToJs(val); break;
            case "data":    out.data    = (val === undefined || val === Sk.builtin.none.none$) ? undefined : Sk.ffi.remapToJs(val); break;
            case "timeout": out.timeout = jsStr(val); break;
            case "auth":    out.auth    = (val === undefined || val === Sk.builtin.none.none$) ? undefined : Sk.ffi.remapToJs(val); break;
        }
    }
    if (!out.headers) out.headers = {};
    return out;
}

/* ------------------------------------------------------------------ */
/*  requests.get/post/put/patch/delete/head/options
 * ------------------------------------------------------------------ */

function makeVerbSafe(method) {
    var fn = function (kwa, url) {
        var urlJs = Sk.ffi.remapToJs(url);
        var opts = parseKwargs(kwa);
        return doRequest(method, urlJs, opts);
    };
    fn.co_kwargs = true;
    return new Sk.builtin.func(fn);
}

mod.get     = makeVerbSafe("GET");
mod.post    = makeVerbSafe("POST");
mod.put     = makeVerbSafe("PUT");
mod.patch   = makeVerbSafe("PATCH");
mod[Sk.fixReserved ? Sk.fixReserved("delete") : "delete_$rw$"] = makeVerbSafe("DELETE");
mod.head    = makeVerbSafe("HEAD");
mod.options = makeVerbSafe("OPTIONS");

/* ------------------------------------------------------------------ */
/*  Session — зберігає базові headers/cookies між викликами           */
/* ------------------------------------------------------------------ */

mod.Session = Sk.misceval.buildClass(mod, function (globals, attrs) {
    attrs.__init__ = new Sk.builtin.func(function (self) {
        setAttr(self, "headers", Sk.ffi.remapToPy({}));
        return Sk.builtin.none.none$;
    });

    ["get", "post", "put", "patch", "delete", "head", "options"].forEach(function (method) {
        var rawFn = function (kwa, self, url) {
            var opts = parseKwargs(kwa);
            var currentHeaders = dictToObj(self.tp$getattr(new Sk.builtin.str("headers"))) || {};
            var merged = {};
            for (var k in currentHeaders) merged[k] = currentHeaders[k];
            for (var k2 in opts.headers) merged[k2] = opts.headers[k2];
            opts.headers = merged;
            return doRequest(method.toUpperCase(), Sk.ffi.remapToJs(url), opts);
        };
        rawFn.co_kwargs = true;
        var attrName = Sk.fixReserved ? Sk.fixReserved(method) : method;
        attrs[attrName] = new Sk.builtin.func(rawFn);
    });

    attrs.close = new Sk.builtin.func(function () { return Sk.builtin.none.none$; });
}, "Session", []);

/* ------------------------------------------------------------------ */
/*  Реєстрація exceptions як підмодуля requests.exceptions            */
/* ------------------------------------------------------------------ */
mod.exceptions = Sk.misceval.buildClass(mod, function (globals, attrs) {
    for (var k in excModule) attrs[k] = excModule[k];
}, "exceptions", []);

for (var k2 in excModule) mod[k2] = excModule[k2];

mod.__name__ = new Sk.builtin.str("requests");

return mod;
};
