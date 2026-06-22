/**
 * arduino/__init__.js
 * Skulpt module that bridges Python code to the Arduino UNO R3 simulator.
 *
 * Usage in Python:
 *   import arduino
 *   arduino.pinMode(13, arduino.OUTPUT)
 *   arduino.digitalWrite(13, arduino.HIGH)
 *   arduino.analogWrite(3, 128)
 *   val = arduino.analogRead(0)   # returns 0–1023
 *   arduino.delay(500)
 *   t = arduino.millis()
 *
 * Or via pin objects:
 *   from arduino import Pin
 *   led = Pin(13, Pin.OUT)
 *   led.high()
 *   led.write(128)            # PWM
 *   val = led.read_analog()   # analogRead
 *
 * Serial:
 *   arduino.Serial.begin(9600)
 *   arduino.Serial.println("Hello!")
 *   arduino.Serial.print(val)
 *
 * The module talks to the simulator via a shared JS bridge object
 * `window.ArduinoSim` that the simulator exposes.  If the simulator
 * is not present the module still works but calls are no-ops / return 0.
 */

var $builtinmodule = function (name) {

    'use strict';

    /* ── helpers ─────────────────────────────────────────── */

    var mod = {};
    var startTime = Date.now();

    /** Return the simulator bridge, or a safe stub if missing. */
    function sim() {
        if (typeof window !== 'undefined' && window.ArduinoSim) {
            return window.ArduinoSim;
        }
        return null;
    }

    function jsInt(pyVal) {
        return Sk.ffi.remapToJs(pyVal) | 0;
    }

    function jsBool(pyVal) {
        return !!Sk.ffi.remapToJs(pyVal);
    }

    function checkPin(n, name) {
        if (n < 0 || n > 19) {
            throw new Sk.builtin.ValueError(
                (name || 'pin') + ': номер піна поза діапазоном 0–19 (аналогові: 14–19 = A0–A5)'
            );
        }
    }

    /* Print to PythonIDE console (Serial output mirror) */
    function serialOut(text) {
        if (typeof PythonIDE !== 'undefined' && PythonIDE.python && PythonIDE.python.output) {
            PythonIDE.python.output(text);
        } else {
            console.log('[arduino Serial]', text);
        }
    }

    /* ── Constants ───────────────────────────────────────── */

    mod.HIGH   = Sk.ffi.remapToPy(1);
    mod.LOW    = Sk.ffi.remapToPy(0);
    mod.INPUT  = Sk.ffi.remapToPy(0);
    mod.OUTPUT = Sk.ffi.remapToPy(1);
    mod.INPUT_PULLUP = Sk.ffi.remapToPy(2);

    /* ── setDevice ───────────────────────────────────────── */

    /** Wait up to `timeoutMs` for window.ArduinoSim to become available,
     *  then call setDevice. Returns a Skulpt suspension (async). */
    var setDevice = function (device) {
        var dev = Sk.ffi.remapToJs(device);
        console.log("Sk setDevice =", dev);

        return PythonIDE.runAsync(function (resolve, reject) {
            var deadline = Date.now() + 5000;   // чекаємо до 5 секунд

            function attempt() {
                var s = sim();
                if (s && typeof s.setDevice === 'function') {
                    var success = s.setDevice(dev);
                    if (!success) {
                        reject(new Sk.builtin.ValueError(
                            'setDevice: невідомий пристрій "' + dev + '". ' +
                            'Підтримуються: "uno", "nano", "esp"'
                        ));
                    } else {
                        resolve(Sk.builtin.none.none$);
                    }
                } else if (Date.now() > deadline) {
                    /* Симулятор так і не з\'явився — просто ігноруємо */
                    console.warn('[arduino] setDevice: симулятор недоступний, пропускаємо');
                    resolve(Sk.builtin.none.none$);
                } else {
                    setTimeout(attempt, 100);
                }
            }
            attempt();
        });
    };
    setDevice.co_varnames = ['device'];
    setDevice.co_numargs  = 1;
    mod.setDevice = new Sk.builtin.func(setDevice);
    /* ── pinMode ─────────────────────────────────────────── */

    var pinMode = function (pin, mode) {
        var p = jsInt(pin);
        var m = jsInt(mode);
        checkPin(p, 'pinMode');
        var modeStr = (m === 1) ? 'out' : (m === 2 ? 'pu' : 'in');
        var s = sim();
        if (s) {
            s.setMode(p, modeStr);
        }
    };
    pinMode.co_varnames = ['pin', 'mode'];
    pinMode.co_numargs  = 2;
    mod.pinMode = new Sk.builtin.func(pinMode);

    /* ── digitalWrite ────────────────────────────────────── */

    var digitalWrite = function (pin, value) {
        var p = jsInt(pin);
        var v = jsInt(value) ? 1 : 0;
        checkPin(p, 'digitalWrite');
        var s = sim();
        if (s) {
            s.digitalWrite(p, v);
        }
    };
    digitalWrite.co_varnames = ['pin', 'value'];
    digitalWrite.co_numargs  = 2;
    mod.digitalWrite = new Sk.builtin.func(digitalWrite);

    /* ── digitalRead ─────────────────────────────────────── */

    var digitalRead = function (pin) {
        var p = jsInt(pin);
        checkPin(p, 'digitalRead');
        var s = sim();
        var v = s ? s.digitalRead(p) : 0;
        return Sk.ffi.remapToPy(v);
    };
    digitalRead.co_varnames = ['pin'];
    digitalRead.co_numargs  = 1;
    mod.digitalRead = new Sk.builtin.func(digitalRead);

    /* ── analogWrite (PWM) ───────────────────────────────── */

    var analogWrite = function (pin, value) {
        var p = jsInt(pin);
        var v = Math.max(0, Math.min(255, jsInt(value)));
        /* Не обмежуємо перелік пінів тут — симулятор сам знає
           які піни підтримують PWM для поточного пристрою.
           Для UNO/Nano checkPin залишає діапазон 0-19;
           для ESP пін-номери можуть бути більшими — перевіряємо м'якше. */
        if (p < 0 || p > 255) {
            throw new Sk.builtin.ValueError('analogWrite: невалідний номер піна ' + p);
        }
        var s = sim();
        if (s) {
            s.analogWrite(p, v);
        }
    };
    analogWrite.co_varnames = ['pin', 'value'];
    analogWrite.co_numargs  = 2;
    mod.analogWrite = new Sk.builtin.func(analogWrite);

    /* ── analogRead ──────────────────────────────────────── */

    var analogRead = function (pin) {
        var p = jsInt(pin);
        /* Accept both 0–5 (A0–A5) and 14–19 */
        if (p >= 0 && p <= 5) {
            p = p + 14;
        }
        checkPin(p, 'analogRead');
        var s = sim();
        var v = s ? s.analogRead(p) : 0;
        return Sk.ffi.remapToPy(v);
    };
    analogRead.co_varnames = ['pin'];
    analogRead.co_numargs  = 1;
    mod.analogRead = new Sk.builtin.func(analogRead);

    /* ── delay ───────────────────────────────────────────── */

    var delay = function (ms) {
        var t = jsInt(ms);
        return PythonIDE.runAsync(function (resolve) {
            setTimeout(resolve, t);
        });
    };
    delay.co_varnames = ['ms'];
    delay.co_numargs  = 1;
    mod.delay = new Sk.builtin.func(delay);

    /* ── delayMicroseconds ───────────────────────────────── */

    var delayMicroseconds = function (us) {
        var t = jsInt(us);
        /* Simulate with setTimeout(0) for values < 1ms, else round up */
        var ms = Math.max(0, Math.round(t / 1000));
        return PythonIDE.runAsync(function (resolve) {
            setTimeout(resolve, ms);
        });
    };
    delayMicroseconds.co_varnames = ['us'];
    delayMicroseconds.co_numargs  = 1;
    mod.delayMicroseconds = new Sk.builtin.func(delayMicroseconds);

    /* ── millis / micros ─────────────────────────────────── */

    mod.millis = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(Date.now() - startTime);
    });

    mod.micros = new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy((Date.now() - startTime) * 1000);
    });

    /* ── map ─────────────────────────────────────────────── */

    var mapFn = function (value, fromLow, fromHigh, toLow, toHigh) {
        var v  = Sk.ffi.remapToJs(value);
        var fl = Sk.ffi.remapToJs(fromLow);
        var fh = Sk.ffi.remapToJs(fromHigh);
        var tl = Sk.ffi.remapToJs(toLow);
        var th = Sk.ffi.remapToJs(toHigh);
        var result = (v - fl) * (th - tl) / (fh - fl) + tl;
        return Sk.ffi.remapToPy(result);
    };
    mapFn.co_varnames = ['value', 'fromLow', 'fromHigh', 'toLow', 'toHigh'];
    mapFn.co_numargs  = 5;
    mod.map = new Sk.builtin.func(mapFn);

    /* ── constrain ───────────────────────────────────────── */

    var constrain = function (value, low, high) {
        var v = Sk.ffi.remapToJs(value);
        var l = Sk.ffi.remapToJs(low);
        var h = Sk.ffi.remapToJs(high);
        return Sk.ffi.remapToPy(Math.min(h, Math.max(l, v)));
    };
    constrain.co_varnames = ['value', 'low', 'high'];
    constrain.co_numargs  = 3;
    mod.constrain = new Sk.builtin.func(constrain);

    /* ── Pin class ───────────────────────────────────────── */

    var PinClass = new Sk.misceval.buildClass(mod, function ($gbl, $loc) {

        /* Class-level constants */
        $loc.OUT        = Sk.ffi.remapToPy(1);
        $loc.IN         = Sk.ffi.remapToPy(0);
        $loc.INPUT_PULLUP = Sk.ffi.remapToPy(2);

        var PWM_SET  = [3, 5, 6, 9, 10, 11];
        var ANA_SET  = [14, 15, 16, 17, 18, 19];

        /* __init__(self, pin_number, mode=Pin.OUT) */
        var init = function (self, pin_number, mode) {
            var p = jsInt(pin_number);
            /* Accept A0–A5 shorthand */
            if (typeof pin_number.v === 'string') {
                var m2 = pin_number.v.match(/^A(\d)$/i);
                if (m2) { p = parseInt(m2[1]) + 14; }
            }
            checkPin(p, 'Pin.__init__');
            self._pin  = p;
            var m = (mode !== undefined) ? jsInt(mode) : 1;
            self._mode = m;
            var modeStr = (m === 1) ? 'out' : (m === 2 ? 'pu' : 'in');
            var s = sim();
            if (s) { s.setMode(p, modeStr); }
        };
        init.co_varnames = ['self', 'pin_number', 'mode'];
        init.$defaults   = [Sk.ffi.remapToPy(1)];   // default mode = OUT
        init.co_numargs  = 3;
        $loc.__init__ = new Sk.builtin.func(init);

        /* value([v]) – getter/setter like MicroPython */
        var valueFn = function (self, val) {
            var p = self._pin;
            var s = sim();
            if (val === undefined) {
                /* Read */
                var isAnalogIn = ANA_SET.indexOf(p) !== -1 && self._mode !== 1;
                if (isAnalogIn) {
                    return Sk.ffi.remapToPy(s ? s.analogRead(p) : 0);
                }
                return Sk.ffi.remapToPy(s ? s.digitalRead(p) : 0);
            }
            /* Write */
            var v = Sk.ffi.remapToJs(val);
            var isPwm = PWM_SET.indexOf(p) !== -1 && self._mode === 1;
            if (isPwm && v > 1) {
                /* Treat values > 1 as PWM duty (0–255) */
                v = Math.max(0, Math.min(255, v | 0));
                if (s) { s.analogWrite(p, v); }
            } else {
                v = v ? 1 : 0;
                if (s) { s.digitalWrite(p, v); }
            }
            return Sk.builtin.none.none$;
        };
        valueFn.co_varnames = ['self', 'val'];
        valueFn.$defaults   = [undefined];
        valueFn.co_numargs  = 2;
        $loc.value = new Sk.builtin.func(valueFn);

        /* high() / low() */
        $loc.high = new Sk.builtin.func(function (self) {
            var s = sim();
            if (s) { s.digitalWrite(self._pin, 1); }
        });
        $loc.low = new Sk.builtin.func(function (self) {
            var s = sim();
            if (s) { s.digitalWrite(self._pin, 0); }
        });

        /* toggle() */
        $loc.toggle = new Sk.builtin.func(function (self) {
            var s = sim();
            var cur = s ? s.digitalRead(self._pin) : 0;
            if (s) { s.digitalWrite(self._pin, cur ? 0 : 1); }
        });

        /* read_digital() */
        $loc.read_digital = new Sk.builtin.func(function (self) {
            var s = sim();
            return Sk.ffi.remapToPy(s ? s.digitalRead(self._pin) : 0);
        });

        /* write_digital(v) */
        var writeDigital = function (self, v) {
            var s = sim();
            if (s) { s.digitalWrite(self._pin, jsInt(v) ? 1 : 0); }
        };
        writeDigital.co_varnames = ['self', 'v'];
        writeDigital.co_numargs  = 2;
        $loc.write_digital = new Sk.builtin.func(writeDigital);

        /* read_analog() → 0–1023 */
        $loc.read_analog = new Sk.builtin.func(function (self) {
            var p = self._pin;
            if (ANA_SET.indexOf(p) === -1) {
                throw new Sk.builtin.ValueError(
                    'read_analog: пін D' + p + ' не є аналоговим. Аналогові піни: A0–A5 (14–19)'
                );
            }
            var s = sim();
            return Sk.ffi.remapToPy(s ? s.analogRead(p) : 0);
        });

        /* write_analog(v) → PWM 0–255 */
        var writeAnalog = function (self, v) {
            var p = self._pin;
            var PWM = [3, 5, 6, 9, 10, 11];
            if (PWM.indexOf(p) === -1) {
                throw new Sk.builtin.ValueError(
                    'write_analog: пін D' + p + ' не підтримує PWM'
                );
            }
            var val = Math.max(0, Math.min(255, jsInt(v)));
            var s = sim();
            if (s) { s.analogWrite(p, val); }
        };
        writeAnalog.co_varnames = ['self', 'v'];
        writeAnalog.co_numargs  = 2;
        $loc.write_analog = new Sk.builtin.func(writeAnalog);

        /* __repr__ */
        $loc.__repr__ = new Sk.builtin.func(function (self) {
            var p = self._pin;
            var name = (p >= 14) ? 'A' + (p - 14) : 'D' + p;
            return new Sk.builtin.str('Pin(' + name + ')');
        });

        /* __str__ */
        $loc.__str__ = new Sk.builtin.func(function (self) {
            var p = self._pin;
            var name = (p >= 14) ? 'A' + (p - 14) : 'D' + p;
            var mStr = (self._mode === 1) ? 'OUTPUT' : (self._mode === 2 ? 'INPUT_PULLUP' : 'INPUT');
            return new Sk.builtin.str('Pin(' + name + ', ' + mStr + ')');
        });

    }, 'Pin', []);

    mod.Pin = PinClass;

    /* ── Serial sub-module ───────────────────────────────── */

    var Serial = new Sk.builtin.module();
    Serial.$d = (function () {
        var s = {};
        var _baudrate = 9600;
        var _buffer   = [];

        /* begin(baudrate) */
        var beginFn = function (baudrate) {
            _baudrate = baudrate !== undefined ? jsInt(baudrate) : 9600;
        };
        beginFn.co_varnames = ['baudrate'];
        beginFn.$defaults   = [Sk.ffi.remapToPy(9600)];
        beginFn.co_numargs  = 1;
        s.begin = new Sk.builtin.func(beginFn);

        /* print(value) – no newline */
        var printFn = function (value) {
            var str = Sk.ffi.remapToJs(Sk.builtin.str(value));
            serialOut(str);
        };
        printFn.co_varnames = ['value'];
        printFn.co_numargs  = 1;
        s.print = new Sk.builtin.func(printFn);

        /* println(value) – with newline */
        var printlnFn = function (value) {
            var str = (value !== undefined)
                ? Sk.ffi.remapToJs(Sk.builtin.str(value))
                : '';
            serialOut(str + '\n');
        };
        printlnFn.co_varnames = ['value'];
        printlnFn.$defaults   = [new Sk.builtin.str('')];
        printlnFn.co_numargs  = 1;
        s.println = new Sk.builtin.func(printlnFn);

        /* available() */
        s.available = new Sk.builtin.func(function () {
            return Sk.ffi.remapToPy(_buffer.length);
        });

        /* read() */
        s.read = new Sk.builtin.func(function () {
            if (_buffer.length === 0) {
                return Sk.ffi.remapToPy(-1);
            }
            return Sk.ffi.remapToPy(_buffer.shift());
        });

        /* flush() */
        s.flush = new Sk.builtin.func(function () {
            _buffer = [];
        });

        return s;
    })();

    mod.Serial = Serial;

    /* ── Expose ArduinoSim bridge needed by the simulator ── */
    /*
     * The simulator (arduino_simulator_v2.html) must call
     *   window.ArduinoSim = { ... }
     * before any Python is run.  This module reads from that object.
     *
     * Expected bridge API:
     *   ArduinoSim.setMode(pin, modeStr)         // 'in'|'out'|'pu'
     *   ArduinoSim.digitalWrite(pin, value)       // 0 | 1
     *   ArduinoSim.digitalRead(pin)              // → 0 | 1
     *   ArduinoSim.analogWrite(pin, value)        // 0–255 (PWM)
     *   ArduinoSim.analogRead(pin)               // → 0–1023  (pin 14–19)
     */

    /* ── Module-level init ───────────────────────────────── */
    /*
     * When `import arduino` is run, we inject the simulator iframe/panel
     * into the output area using the same technique as the microbit module.
     * The simulator HTML is loaded once; subsequent imports reuse it.
     */

    var _initialized = false;

    function initSimulator() {
        if (_initialized) { return; }
        _initialized = true;

        /* If the simulator is already embedded in the page, just install
           the bridge and return. */
        if (typeof window !== 'undefined' && window.ArduinoSim) {
            return;
        }

        /* Inject the simulator panel (iframe) into PythonIDE output area */
        if (typeof PythonIDE !== 'undefined' && PythonIDE.python && PythonIDE.python.output) {
            /* Determine the path to the simulator HTML.
               Adjust SIMULATOR_URL to match your deployment. */
            var SIMULATOR_URL = (typeof ARDUINO_SIMULATOR_URL !== 'undefined')
                ? ARDUINO_SIMULATOR_URL
                : './lib/skulpt/arduino/arduino_simulator.html';

            var html = '<div id="arduino-sim-container" style="'
                + 'width:100%;max-width:960px;margin:0 auto 16px;'
                + 'border-radius:12px;overflow:hidden;'
                + 'box-shadow:0 8px 24px rgba(0,0,0,.5)">'
                + '<iframe id="arduino-sim-iframe" src="' + SIMULATOR_URL + '"'
                + ' style="width:100%;height:800px;border:none;display:block;"'
                + ' onload="ArduinoSimBridge.onLoad(this)">'
                + '</iframe>'
                + '</div>';

            PythonIDE.python.output(html, true);

            /* Install a bridge that proxies calls into the iframe */
            window.ArduinoSimBridge = {
                onLoad: function (iframe) {
                    var iwin = iframe.contentWindow;
                    window.ArduinoSim = {
						setDevice: function (device) {
							console.log(" window.ArduinoSim Device")
							if (iwin.simSetDevice) {
								return iwin.simSetDevice(device);
							}
							return false;
						},
                        setMode: function (pin, modeStr) {
                            if (iwin.simSetMode) { iwin.simSetMode(pin, modeStr); }
                        },
                        digitalWrite: function (pin, val) {
                            if (iwin.simDigitalWrite) { iwin.simDigitalWrite(pin, val); }
                        },
                        digitalRead: function (pin) {
                            return iwin.simDigitalRead ? iwin.simDigitalRead(pin) : 0;
                        },
                        analogWrite: function (pin, val) {
                            if (iwin.simAnalogWrite) { iwin.simAnalogWrite(pin, val); }
                        },
                        analogRead: function (pin) {
                            return iwin.simAnalogRead ? iwin.simAnalogRead(pin) : 0;
                        }
                    };
                }
            };
        }
    }

    initSimulator();

    return mod;
};
