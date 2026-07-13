// Tkinter module for Skulpt. Pete Dring, 2015-2018, Gr.Gromko, 2020-2026
var $builtinmodule = function(name) {
	// clear all previous frames
	$('.tkinter').remove();

	// Track pending timeouts on window so a reload can cancel leftovers from the previous run (prevents duplicate animations)
	if (window.__tkinter_pending_timeouts) {
		window.__tkinter_pending_timeouts.forEach(function(id) {
			clearTimeout(id);
		});
	}
	window.__tkinter_pending_timeouts = [];

	// Same idea, but for the document-level keydown listener registered in commonKeyHandler()
	if (window.__tkinter_pending_key_listeners) {
		window.__tkinter_pending_key_listeners.forEach(function(fn) {
			document.removeEventListener('keydown', fn, true);
		});
	}
	window.__tkinter_pending_key_listeners = [];

    // adapted from https://www.tcl.tk/man/tcl8.4/TkCmd/colors.htm

	var idCount = 0;
	var varCount = 0;
	var firstRoot = 0;

	var widgets = [];
	var variables = [];
	var timeouts = window.__tkinter_pending_timeouts;

	var cleanup = function() {
		for (var i = 0; i < timeouts.length; i++) {
			clearTimeout(timeouts[i]);
		}
	}
	var s = {};

    // Initialize the virtual filesystem if not already set up.
    // IMPORTANT: open()/write() in customfile.js reads and writes through the
    // global `fsToBrowse` object, not through a separate FileSystem instance.
    // So Sk.__jsfs must point at that SAME object — otherwise filedialog (and
    // PhotoImage loading below) would browse/write a different localStorage
    // bucket than the one open() actually uses, and files "seen" in one would
    // be invisible ("No such file or directory") to the other.
    if (typeof fsToBrowse !== "undefined" && fsToBrowse) {
        Sk.__jsfs = fsToBrowse;
    } else if (!Sk.__jsfs) {
		console.log("Ініціалізація файлової системи")
        Sk.__jsfs = new window.FileSystem("epythonfs");
    }


	function forceDomReflow() {
		document.body.offsetHeight;
		window.dispatchEvent(new Event('resize'));
	}

	// Read PhotoImage's $dataUrl directly — Skulpt's JS toString() won't reliably call Python __str__
	function photoImageSrc(img) {
		if (img == null) {
			return "";
		}
		if (img.$dataUrl) {
			return img.$dataUrl;
		}
		// fallback for non-standard image objects
		try {
			return Sk.ffi.remapToJs(Sk.misceval.callsimOrSuspend(
				Sk.abstr.gattr(img, new Sk.builtin.str("__str__"))
			));
		} catch (e) {
			return "";
		}
	}
	// Return {width, height} in px for a PhotoImage, or null if unknown
	function photoImageSize(img) {
		if (img && img.$width && img.$height) {
			return { width: img.$width, height: img.$height };
		}
		return null;
	}
	// Set explicit pixel width/height up front — <img> naturalWidth/Height aren't available until the image decodes
	function photoImageSizedImg(img, extraStyle) {
		var sz = photoImageSize(img);
		var style = (sz ? ('width:' + sz.width + 'px;height:' + sz.height + 'px;') : '') + (extraStyle || '');
		return '<img src="' + photoImageSrc(img) + '"' + (style ? (' style="' + style + '"') : '') + '/>';
	}
	// Tkinter aliases
	s.__name__ = new Sk.builtin.str("tkinter");
	s.END = new Sk.builtin.str("end");
	s.W   = new Sk.builtin.str("w");
	s.E   = new Sk.builtin.str("e");
	s.N   = new Sk.builtin.str("n");
	s.S   = new Sk.builtin.str("s");
	s.NW  = new Sk.builtin.str("nw");
	s.NE  = new Sk.builtin.str("ne");
	s.SW  = new Sk.builtin.str("sw");
	s.SE  = new Sk.builtin.str("se");
	s.Y   = new Sk.builtin.str("y");
	s.X   = new Sk.builtin.str("x");
	s.DISABLED = new Sk.builtin.str("disabled");
	s.NORMAL = new Sk.builtin.str("normal");
	s.YES = new Sk.builtin.int_(1);
	s.NO = new Sk.builtin.int_(0);
	s.BOTH = new Sk.builtin.str("both");
	s.BOTTOM = new Sk.builtin.str("bottom");
	s.TOP = new Sk.builtin.str("top");
	s.RAISED = new Sk.builtin.str("raised");
	s.HORIZONTAL = new Sk.builtin.str("horizontal");
	s.VERTICAL = new Sk.builtin.str("vertical");
	s.SUNKEN = new Sk.builtin.str("sunken");
	s.ALL = new Sk.builtin.str("all");
	s.MULTIPLE = new Sk.builtin.str("multiple");
	s.ARC = new Sk.builtin.str("arc");
	s.CHORD = new Sk.builtin.str("chord");
	s.PIESLICE = new Sk.builtin.str("pieslice");
	s.LAST = new Sk.builtin.str("last");
	s.FIRST = new Sk.builtin.str("first");
	s.LEFT = new Sk.builtin.str("left");
	s.CENTER = new Sk.builtin.str("center");
	s.RIGHT = new Sk.builtin.str("right");
	s.SINGLE = new Sk.builtin.str("single");
	s.EXTENDED = new Sk.builtin.str("extended");
	s.INDETERMINATE = new Sk.builtin.str("indeterminate");
	s.WORD = new Sk.builtin.str("word");
	s.CHAR = new Sk.builtin.str("char");
	s.NONE = new Sk.builtin.str("none");

	function getColor(c) {
		var cName = c.replace(/ /g, "")
		if (tk_colors && tk_colors[cName]) {
			return tk_colors[cName];
		}
		return c;
	}
	var applyWidgetStyles = function(self) {
		// Apply common widget style props: justify, padding, border, colors, font, size, text
		var e = $('#tkinter_' + self.id);

		if (self.props.justify) {
			var align = Sk.ffi.remapToJs(self.props.justify);
			e.css('text-align', align);
		}

		if (self.props.bd) {
			var bdwidth = Sk.ffi.remapToJs(self.props.bd);
			e.css('border-style', 'solid');
			e.css('border-width', bdwidth + 'px');
		}

		if (self.props.foreground) {
			var fg = Sk.ffi.remapToJs(self.props.foreground);
			e.css('color', getColor(fg));
		}
		if (self.props.fg) {
			var fg = Sk.ffi.remapToJs(self.props.fg);
			e.css('color', getColor(fg));
		}

		if (self.props.relief) {
			var relief = Sk.ffi.remapToJs(self.props.relief);
			if (relief == "raised") {
				e.css({
					'border-style': 'solid',
					'border-width': '1px',
					'border-color': '#CCC #000 #000 #CCC'
				});
			}
		}

		if (self.props.padx) {
			var padx = Sk.ffi.remapToJs(self.props.padx) + 'px';
			e.css({
				'margin-right': padx,
				'margin-left': padx
			});
		}
		if (self.props.pady) {
			var pady = Sk.ffi.remapToJs(self.props.pady) + 'px';
			e.css({
				'margin-top': pady,
				'margin-bottom': pady
			});
		}

		if (self.props.background) {
			var bg = Sk.ffi.remapToJs(self.props.background);
			e.css('background-color', getColor(bg));
		}
		if (self.props.bg) {
			var bg = Sk.ffi.remapToJs(self.props.bg);
			e.css('background-color', getColor(bg));
		}

		if (self.props.font) {
			var font = Sk.ffi.remapToJs(self.props.font);

			if (typeof(font) == "string") {
				font = ("" + font).split(" ");
			}

			var fontFamily = font[0];
			var fontWeight = font.includes("bold") ? "bold" : "normal";
			var fontStyle = font.includes("italic") ? "italic" : "normal";

			if (font[1] === 0) {
				font[1] = 12;
			}

			e.css({
				'font-family': fontFamily,
				'font-weight': fontWeight,
				'font-size': font[1] + "pt",
				'font-style': fontStyle
			});
		}
		
		// Center alignment defaults apply only to text labels, not Text widgets, which default left like real tkinter.Text
		if (self.props.text) {
			if (!(self.props.justify)) {
				e.css('text-align', 'center');
			}
		} else if (self.props.textarea && !(self.props.justify)) {
			e.css('text-align', 'left');
		}

		// Real Tk switches width/height to pixel units the moment a widget carries an image,
		// even if it also has text via compound= — the "char units" path only applies to
		// text-only widgets. self.props.image tells us that regardless of the tk_charsized class.
		var sizeInPixels = !!self.props.image;

		if (self.props.width) {			
			let width = Sk.ffi.remapToJs(self.props.width);
            if (e.hasClass("tk_charsized") && !sizeInPixels) {
                // width= is a MINIMUM char width, not fixed — widget grows for longer text instead of truncating (matches real Tk)
                e.css({ 'min-width': width + 'ch', 'width': '', 'white-space': 'nowrap' });
                if (self._hasExplicitWidth === undefined) self._hasExplicitWidth = false;
            }
			else {
				e.css({ 'min-width': '', 'width': width + 'px' });
				// Tell layoutPack()'s getRequestedSize() to use this fixed pixel width as the
				// widget's requested size instead of clearing it and re-measuring from content
				// (previously only Frame set this flag, so pixel-sized Button/Label with an
				// image had their width silently overridden by the pack() measurement pass).
				// Guarded so it never overwrites a flag Frame already set itself in __init__.
				if (self._hasExplicitWidth === undefined) self._hasExplicitWidth = true;
			}
		}

		if (self.props.height) {
			let height = Sk.ffi.remapToJs(self.props.height);           
            if (e.hasClass("tk_charsized") && !sizeInPixels) { 
                let mh = 1;
                if (e.is("button")) { mh = 1.25;}              
                // min-height (not height) survives layoutPack()'s measurement pass, which clears
                // inline 'height' on non-Frame widgets before measuring natural size via outerHeight()
                e.css({ 'min-height': (height * mh) + 'em', 'height': '' });
                if (self._hasExplicitHeight === undefined) self._hasExplicitHeight = false;
            }
			else {
				e.css({ 'min-height': '', 'height': height + 'px' });
				if (self._hasExplicitHeight === undefined) self._hasExplicitHeight = true;
			}
        }

		// wraplength= sets a fixed pixel wrap width; must run before layoutPack measures reqW/reqH, and clears the nowrap forced by width=
		if (self.props.wraplength) {
			let wraplength = parseFloat(Sk.ffi.remapToJs(self.props.wraplength));
			if (!isNaN(wraplength) && wraplength > 0) {
				e.css({
					'max-width': wraplength + 'px',
					'min-width': '',
					// pre-line wraps long lines by word (like real wraplength) while preserving manual \n breaks
					'white-space': 'pre-line',
					'word-wrap': 'break-word',
					'overflow-wrap': 'break-word'
				});
			}
		}

		// fill overrides width/height set via pack
		if (self._pack_fill) {
			var f = self._pack_fill;
			if (f === 'x' || f === 'both') e.css('width', '100%');
			if (f === 'y' || f === 'both') e.css('height', '100%');
		}
		if (self._pack_expand) {
			e.css('flex', '1');
		}


		// Update content when either text or image is set (previously required text to be truthy)
		if (self.props.text || self.props.image) {
			if (self.hasLabel) {
				// Checkbutton/Radiobutton keep text in a separate <label>; image isn't rendered for them here
				let labelElement = document.getElementById("l_" + self.id);
				if (labelElement && self.props.text) {
					labelElement.innerHTML = PythonIDE.sanitize(Sk.ffi.remapToJs(self.props.text));
				}
			} else {
				// Button/Label: an image fully replaces text unless compound= combines them
				var vtxt = self.props.text ? PythonIDE.sanitize(Sk.ffi.remapToJs(self.props.text)) : "";
				var html = vtxt;
				if (self.props.image) {
					var vimg = photoImageSizedImg(self.props.image);

					if (vtxt && self.props.compound) {
						var comp = Sk.ffi.remapToJs(self.props.compound);
						if (comp == "top") {
							html = vimg + '<br>' + vtxt;
						} else if (comp == "bottom") {
							html = vtxt + '<br>' + vimg;
						} else if (comp == "left") {
							html = vimg + vtxt;
						} else if (comp == "right" || comp == "roght") {
							// 'roght' kept for backward compatibility with an old typo in this file
							html = vtxt + vimg;
						} else {
							html = vimg;
						}
					} else {
						html = vimg;
					}
				} else if (vtxt === "") {
					html = "\u2000\u2000"; // порожній Button/Label без тексту й без зображення
				}
				$('#tkinter_' + self.id).html(html);
				$('#tkinter_' + self.id).css('vertical-align', 'middle');
			}
		}
		if (self.props.state) {
			var disabled = Sk.ffi.remapToJs(self.props.state) == 'disabled';
			$('#tkinter_' + self.id).prop('disabled', disabled);
		}
	}

	var configure = function(kwa, self) {
		for (var i = 0; i < kwa.length; i += 2) {
			var key = Sk.ffi.remapToJs(kwa[i]);
			var val = kwa[i + 1];
			self.props[key] = val;
			
			// Attach a Menu to the window
			if (key === 'menu' && val && val.items) {
				ensureMenuStyles();
				renderMenuBar(self, val);
				// Меню-бар займає простір зверху вікна. Діти цього вікна
				// пакуються з master=self (а не self.master), тож загальна
				// перевірка "self.master && self._packInfo" нижче їх не
				// зачепить — перераховуємо їхню розкладку тут explicit,
				// інакше вони лишаться на позиціях, порахованих ще до
				// появи меню, і виявляться під ним.
				if (s.__layoutPack) {
					s.__layoutPack(self);
				}
			}
		}
		
		applyWidgetStyles(self);

		// Some widgets have their own update() with widget-specific logic — e.g. Label sizes images synchronously before the browser decodes them, avoiding a 0-height flash — call it before layout measures below
		if (typeof self.update === 'function') {
			self.update();
		}

		// config() can change a widget's required size (image, text, width...); re-run pack() layout for its ancestors so the box catches up
		if (self.master && self._packInfo && s.__layoutPack) {
			s.__layoutPack(self.master);
			if (s.__relayoutAncestors) s.__relayoutAncestors(self.master);
		}
	}
	configure.co_kwargs = true;

	s.mainloop = new Sk.builtin.func(function() {
		Sk.builtin.pyCheckArgs("mainloop", arguments, 0, 0);
	});

// Variable, StringVar, IntVar, BooleanVar
// Track ALL widgets bound to a Variable (not just the last one) so .set() updates every bound widget, e.g. a whole Radiobutton group
	function registerVarWidget(variable, id) {
		if (!variable) return;
		if (!Array.isArray(variable.updateIDs)) {
			variable.updateIDs = [];
		}
		if (variable.updateIDs.indexOf(id) === -1) {
			variable.updateIDs.push(id);
		}
	}
	function notifyVarWidgets(variable) {
		if (!variable || !Array.isArray(variable.updateIDs)) return;
		for (var i = 0; i < variable.updateIDs.length; i++) {
			var wid = variable.updateIDs[i];
			if (widgets[wid] && widgets[wid].update) {
				widgets[wid].update();
			}
		}
	}
	s.Variable = Sk.misceval.buildClass(s, function($gbl, $loc) {
		var init = function(kwa, self, master,value) {            
            if (value) {
                self.value = Sk.ffi.remapToJs(value);
                }
            else {self.value ='';}    
			initVariable(self, kwa, self.value);
			self.value = String(self.value);
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.__str__ = new Sk.builtin.func(self =>
			new Sk.builtin.str("PY_VAR" + self.id)
		);

		$loc.set = new Sk.builtin.func(function(self, value) {
			self.value = Sk.ffi.remapToJs(value);
			notifyVarWidgets(self);
		});

		$loc.get = new Sk.builtin.func(self =>
			Sk.ffi.remapToPy(self.value)
		);
	}, "Variable", []);
	function initVariable(self, kwa, defaultValue) {
        
		self.props = unpackKWA(kwa);
		self.value = defaultValue;

		if (self.props.value !== undefined) {
			self.value = Sk.ffi.remapToJs(self.props.value);
		}

		self.id = varCount;
		variables[varCount++] = self;
	}

	s.StringVar = Sk.misceval.buildClass(s, function($gbl, $loc) {
		var init = function(kwa, self, master,value) {            
            if (value) {
                self.value = Sk.ffi.remapToJs(value);
                }
            else {self.value ='';}    
			initVariable(self, kwa, self.value);
			self.value = String(self.value);
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.__str__ = new Sk.builtin.func(self =>
			new Sk.builtin.str("PY_VAR" + self.id)
		);

		$loc.set = new Sk.builtin.func(function(self, value) {
			self.value = Sk.ffi.remapToJs(value);
			notifyVarWidgets(self);
		});

		$loc.get = new Sk.builtin.func(self =>
			Sk.ffi.remapToPy(self.value)
		);
	}, "StringVar", []);

	s.IntVar = Sk.misceval.buildClass(s, function($gbl, $loc) {
		var init = function(kwa, self, master,value) {            
            if (value) {
                self.value = Sk.ffi.remapToJs(value);
                }
            else {self.value =0;}    
			initVariable(self, kwa, self.value);
			self.value = parseInt(self.value);
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.__str__ = new Sk.builtin.func(self =>
			new Sk.builtin.str("PY_VAR" + self.id)
		);

		$loc.set = new Sk.builtin.func(function(self, value) {
			self.value = parseInt(Sk.ffi.remapToJs(value));
			notifyVarWidgets(self);
		});

		$loc.get = new Sk.builtin.func(self =>
			Sk.ffi.remapToPy(parseInt(self.value))
		);
	}, "IntVar", []);

	s.DoubleVar = Sk.misceval.buildClass(s, function($gbl, $loc) {
		var init = function(kwa, self, master,value) {            
            if (value) {
                self.value = Sk.ffi.remapToJs(value);
                }
            else {self.value =0.0;}    
			initVariable(self, kwa, self.value);
			self.value = parseFloat(self.value);
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.__str__ = new Sk.builtin.func(self =>
			new Sk.builtin.str("PY_VAR" + self.id)
		);

		$loc.set = new Sk.builtin.func(function(self, value) {
			self.value = parseFloat(Sk.ffi.remapToJs(value));
			notifyVarWidgets(self);
		});

		$loc.get = new Sk.builtin.func(self =>
			Sk.ffi.remapToPy(parseFloat(self.value))
		);
	}, "DoubleVar", []);

    s.BooleanVar = Sk.misceval.buildClass(s, function($gbl, $loc) {
    
        var init = function(kwa, self, master, value) {
    
            let jsval = false;
    
            if (value !== undefined) {
                jsval = Sk.ffi.remapToJs(value);
            }
    
            // normalize to boolean
            self.value =
                jsval === true ||
                jsval === "true" ||
                jsval === 1 ||
                jsval === "1";
    
            initVariable(self, kwa, self.value);
        };
        init.co_kwargs = true;
        $loc.__init__ = new Sk.builtin.func(init);
    
        $loc.__str__ = new Sk.builtin.func(self =>
            new Sk.builtin.str("PY_VAR" + self.id)
        );
    
        $loc.set = new Sk.builtin.func(function(self, value) {
    
            let jsval = Sk.ffi.remapToJs(value);
    
            self.value =
                jsval === true ||
                jsval === "true" ||
                jsval === 1 ||
                jsval === "1";
    
            notifyVarWidgets(self);
        });
    
        $loc.get = new Sk.builtin.func(self =>
            Sk.ffi.remapToPy(!!self.value)
        );
    
    }, "BooleanVar", []);

// Event ---    
	s.Event = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		var init = function(kwa, self, master) {
			self.props = unpackKWA(kwa);

		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.__setattr__ = new Sk.builtin.func(function(self, key, value) {
			self.props[Sk.ffi.remapToJs(key)] = value;
		});

		$loc.__getattr__ = new Sk.builtin.func(function(self, key) {
			return self.props[Sk.ffi.remapToJs(key)];
		});

		$loc.__str__ = new Sk.builtin.func(function(self) {
			return new Sk.builtin.str("Event");
		});

	}, "Event", []);

	function getOffset(elem) { // fix getBoundingClientRect
		if (elem.getBoundingClientRect) {
			return getOffsetRect(elem)
		} else {
			return getOffsetSum(elem)
		}
	}

	function getOffsetSum(elem) {
		var top = 0,
			left = 0
		while (elem) {
			top = top + parseInt(elem.offsetTop)
			left = left + parseInt(elem.offsetLeft)
			elem = elem.offsetParent
		}
		return {
			top: top,
			left: left
		}
	}

	function getOffsetRect(elem) {
		var box = elem.getBoundingClientRect()
		var body = document.body
		var docElem = document.documentElement
		var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop
		var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft
		var clientTop = docElem.clientTop || body.clientTop || 0
		var clientLeft = docElem.clientLeft || body.clientLeft || 0
		var top = box.top + scrollTop - clientTop
		var left = box.left + scrollLeft - clientLeft
		return {
			top: Math.round(top),
			left: Math.round(left)
		}
	}
// Common widget class ---
	s.Widget = new Sk.misceval.buildClass(s, function($gbl, $loc) {

		function updateEventHandlers(self) {
			if (self.eventHandlers) {
				if (self.eventHandlers['<Return>']) {
					$('#tkinter_' + self.id).keypress(function(event) {
						var keycode = (event.keyCode ? event.keyCode : event.which);
						if (keycode == 13) {
							var evData = { char: '\r', keysym: 'Return' };
							var pyE = new Sk.builtin.object();
							pyE.$d = new Sk.ffi.remapToPy(evData);
							Sk.misceval.callsimAsync(null, self.eventHandlers['<Return>'], pyE).then(function success(r) {

							}, function fail(e) {
								window.onerror(e);
							});
						}

					});
				}

				function commonKeyHandler(ev) {

					function handleKeydownEvent(e) {
						if (e.type != "keydown") {
							return;
						}
						var event = {
							char: e.key
						}
						switch (e.key) {
							case "ArrowUp":
								event.keysym = "Up";
								break;
							case "ArrowDown":
								event.keysym = "Down";
								break;
							case "ArrowLeft":
								event.keysym = "Left";
								break;
							case "ArrowRight":
								event.keysym = "Right";
								break;
							default:
								event.keysym = e.key;
								break;
						}
						var pyE = new Sk.builtin.object();
						pyE.$d = new Sk.ffi.remapToPy(event);
						if (ev.eventDetails) {
							if (event.keysym != ev.eventDetails) {
								return;
							}
						}
						Sk.misceval.callsimAsync(null, ev, pyE).then(function success(r) {

						}, function fail(err) {
							window.onerror(err);
						});
					}

					// Attach a real document-level keydown listener (capture phase) so <Key> works regardless of DOM focus, independent of the IDE's own key-handler loop
					document.addEventListener('keydown', handleKeydownEvent, true);
					window.__tkinter_pending_key_listeners.push(handleKeydownEvent);
				}
				if (self.eventHandlers['<Key>']) {
					var ev = self.eventHandlers['<Key>'];
					commonKeyHandler(ev);
				}
				if (self.eventHandlers['<KeyPress>']) {
					var ev = self.eventHandlers['<KeyPress>'];
					commonKeyHandler(ev);
				}


				if (self.eventHandlers['<Button>']) {
					$('#tkinter_' + self.id).mousedown(function(e) {
						if (e.buttons) {
							var x = e.pageX - getOffsetRect(this).left;
							var y = e.pageY - getOffsetRect(this).top;

							var pyE = Sk.misceval.callsim(s.Event);
							pyE.props.x = new Sk.builtin.int_(x);
							pyE.props.y = new Sk.builtin.int_(y);
							Sk.misceval.callsimAsync(null, self.eventHandlers['<Button>'], pyE).then(function success(r) {

							}, function fail(e) {
								window.onerror(e);
							});
						}
					});
				}

				if (self.eventHandlers['<DoubleButton>']) {
					$('#tkinter_' + self.id).dblclick(function(e) {

						var x = e.pageX - getOffsetRect(this).left;
						var y = e.pageY - getOffsetRect(this).top;

						var pyE = Sk.misceval.callsim(s.Event);
						pyE.props.x = new Sk.builtin.int_(x);
						pyE.props.y = new Sk.builtin.int_(y);
						Sk.misceval.callsimAsync(null, self.eventHandlers['<DoubleButton>'], pyE).then(function success(r) {

						}, function fail(e) {
							window.onerror(e);
						});
					});
				}


				if (self.eventHandlers['<B1Motion>']) {
					$('#tkinter_' + self.id).mousemove(function(e) {

						if (e.buttons) {
							var x = e.pageX - getOffsetRect(this).left;
							var y = e.pageY - getOffsetRect(this).top;

							var pyE = Sk.misceval.callsim(s.Event);
							pyE.props.x = new Sk.builtin.int_(x);
							pyE.props.y = new Sk.builtin.int_(y);
							Sk.misceval.callsimAsync(null, self.eventHandlers['<B1Motion>'], pyE).then(function success(r) {

							}, function fail(e) {
								window.onerror(e);
							});
						}
					});
				}
				// <<ComboboxSelected>>: fire the Python callback on DOM change (previously unhandled)
				if (self.eventHandlers['<<ComboboxSelected>>']) {
					$('#tkinter_' + self.id).on('change', function(e) {
						var pyE = Sk.misceval.callsim(s.Event);
						pyE.props.widget = self;
						Sk.misceval.callsimAsync(null, self.eventHandlers['<<ComboboxSelected>>'], pyE).then(function success(r) {

						}, function fail(err) {
							window.onerror(err);
						});
					});
				}

				if (self.eventHandlers['<Motion>']) {
					$('#tkinter_' + self.id).mousemove(function(e) {
						var x = 0,
							y = 0;
						var element = $(this)[0];
						do {
							x += element.offsetLeft;
							y += element.offsetTop;
						}
						while (element = element.offsetParent);
						y += window.scrollY;
						var pyE = Sk.misceval.callsim(s.Event);
						pyE.props.x = new Sk.builtin.int_(e.pageX - x);
						pyE.props.y = new Sk.builtin.int_(e.pageY - y);
						Sk.misceval.callsimAsync(null, self.eventHandlers['<Motion>'], pyE).then(function success(r) {

						}, function fail(e) {
							window.onerror(e);
						});
					});
				}
			}
		}

		var after = function(kwa, self, delay, callback) {
			var timeout = Sk.ffi.remapToJs(delay);
			var timeoutId = setTimeout(function() {
				// Drop the timeout from the tracking list once it has fired
				var idx = timeouts.indexOf(timeoutId);
				if (idx > -1) {
					timeouts.splice(idx, 1);
				}
				Sk.misceval.callsimAsync(null, callback).then(function success(r) {

				}, function fail(e) {
					window.onerror(e);
				});
			}, timeout);
			timeouts.push(timeoutId);
			// Return the timeout id so after_cancel() can cancel this specific call
			return new Sk.builtin.int_(timeoutId);
		}
		after.co_kwargs = true;
		$loc.after = new Sk.builtin.func(after);

		$loc.after_cancel = new Sk.builtin.func(function(self, id) {
			// after_cancel(): cancel a pending after() callback
			var timeoutId = Sk.ffi.remapToJs(id);
			clearTimeout(timeoutId);
			var idx = timeouts.indexOf(timeoutId);
			if (idx > -1) {
				timeouts.splice(idx, 1);
			}
		});

		$loc.__getitem__ = new Sk.builtin.func(function(self, i) {
			return self.props[Sk.ffi.remapToJs(i)];
		});

		$loc.__init__ = new Sk.builtin.func(function(self) {
			self.eventHandlers = {};

			self.updateEventHandlers = updateEventHandlers;
		});

		$loc.update_idletasks = new Sk.builtin.func(function() {

		});

		$loc.configure = new Sk.builtin.func(configure);
		$loc.config = new Sk.builtin.func(configure);

		$loc.winfo_width = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_($('#tkinter_' + self.id).width());
		});

		$loc.winfo_height = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_($('#tkinter_' + self.id).height());
		});

		$loc.winfo_x = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_($('#tkinter_' + self.id).position().left);
		});

		$loc.winfo_y = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_($('#tkinter_' + self.id).position().top);
		});

		$loc.cget = new Sk.builtin.func(function(self, value) { // widget .cget() method
			var p = Sk.ffi.remapToJs(value);
			switch (p) {
				case 'text':
					return new Sk.builtin.str($('#tkinter_' + self.id).text());
				case 'bg':
					if (self.props.bg) {
						return new Sk.builtin.str(self.props.bg);
					} else {
						return new Sk.builtin.str($('#tkinter_' + self.id).css("background-color"));
					}
				case 'fg':
					if (self.props.fg) {
						return new Sk.builtin.str(self.props.fg);
					} else {
						return new Sk.builtin.str($('#tkinter_' + self.id).css("color"));
					}
				case 'width':
					return new Sk.builtin.int_($('#tkinter_' + self.id).width());
				case 'height':
					return new Sk.builtin.int_($('#tkinter_' + self.id).height());
				default:
					return new new Sk.builtin.ValueError("Error: Сan't get object property");
					break;
			}
		});
// skipGeometryStyling=true (new pack()) skips fill/expand/margin so layoutPack() fully controls geometry; grid()/place() still use the old path
		var commonDisplay = function(kwa, self, parent, skipGeometryStyling) {
			var props = unpackKWA(kwa);
			if (self.getHtml) {
				$('#tkinter_' + self.id).remove();
				var html = self.getHtml(self);
				parent.append(html);

				var e = $('#tkinter_' + self.id);

				if (!skipGeometryStyling) {
					if (props.fill) {
						var f = Sk.ffi.remapToJs(props.fill);
						if (f === 'x') {
							e.css({ width: '100%', alignSelf: 'stretch' });
						} else if (f === 'y') {
							e.css({ height: '100%', alignSelf: 'stretch' });
						} else if (f === 'both') {
							e.css({ width: '100%', height: '100%', alignSelf: 'stretch' });
						}
					}
					if (props.expand && Sk.ffi.remapToJs(props.expand)) e.css('flex', '1');
					var px = props.padx ? Sk.ffi.remapToJs(props.padx) : 0;
					var py = props.pady ? Sk.ffi.remapToJs(props.pady) : 0;
					e.css('margin', py + 'px ' + px + 'px');
					var ipx = props.ipadx ? Sk.ffi.remapToJs(props.ipadx) : 0;
					var ipy = props.ipady ? Sk.ffi.remapToJs(props.ipady) : 0;
					e.css('padding', ipy + 'px ' + ipx + 'px');
				}


				if (self.onShow) {
					self.onShow();
				}

				applyWidgetStyles(self);

				if (self.updateEventHandlers) self.updateEventHandlers(self);
				// Skip re-handling command if the widget already implements it
				if (self.props.command) { // && !self.customCommandHandled) {
					e.click(function() {

						Sk.misceval.callsimAsync(null, self.props.command)
							.catch((e) => {
								window.onerror(e.toString());
							});
					});
				}





				if (self.props.validate) {
					switch (Sk.ffi.remapToJs(self.props.validate)) {
						case 'key':
							$('#tkinter_' + self.id).on("change keyup", function(ev) {
								if (self.props.validatecommand) {
									var args = [];
									for (var i = 1; i < self.props.validatecommand.v.length; i++) {
										switch (Sk.ffi.remapToJs(self.props.validatecommand.v[i])) {
											case '%P':
												args = new Sk.builtin.str($('#tkinter_' + self.id).val());
												break;
										}
									}
									Sk.misceval.callsimAsync(null, self.props.validatecommand.v[0], args).then(function success(r) {

									}, function fail(e) {
										window.onerror(e);
									});
								}
							});

							break;

					}
				}
			}
		}

		function checkGeometryConflict(currentStyleId) { // перевірка на конфлікт менеджерів геометрії
			const styles = [{
					id: '#tkinter-pack-style',
					name: 'pack'
				},
				{
					id: '#tkinter-grid-style',
					name: 'grid'
				},
				{
					id: '#tkinter-place-style',
					name: 'place'
				},
			];
			if ($(currentStyleId).length) return; // якщо вже застосовувався
			for (let style of styles) {
				if ($(style.id).length) { // якщо перевірюваний стиль різниться запитуваному і перевірюваний стиль існує -> помилка
					var current = currentStyleId.replace('#tkinter-', '').replace('-style', '');
					throw new Sk.builtin.RuntimeError(
						"cannot use geometry manager " + current +
						" inside a widget which already has slaves managed by " + style.name
					);
				}
			}
		}

		// place layout manager ---
		var place = function(kwa, self) {
			var props = unpackKWA(kwa);
			var elementId = 'tkinter_' + self.id;
			var masterId = 'tkinter_' + self.master.id;
			var parentJQ = $('#' + masterId);


			var parentHeight = parentJQ.height();
			var parentWidth = parentJQ.width();


			// Add CSS once
			if (!$('#tkinter-place-style').length) {
				$('head').append(
					'<style id="tkinter-place-style">' +
					'.tk-place-item { position: absolute; box-sizing: border-box; }' +
					'</style>'
				);
			}

			var placeRoot = $('#tkinter_' + self.master.id);

			// place() uses position:absolute anchored to the nearest positioned ancestor; force the master to be positioned so children don't escape it
			if (placeRoot.length && placeRoot.css('position') === 'static') {
				placeRoot.css('position', 'relative');
			}

			var x = 0;
			if (props.x) {
				x = Sk.ffi.remapToJs(props.x);
			}
			var y = 0;
			if (props.y) {
				y = Sk.ffi.remapToJs(props.y);
			}
			var width = null;
			if (props.width) {
				width = Sk.ffi.remapToJs(props.width);
			}
			var height = null;
			if (props.height) {
				height = Sk.ffi.remapToJs(props.height);
			}
			var pos = 'absolute';
			var relx = null;
			if (props.relx) {
				relx = Sk.ffi.remapToJs(props.relx);
			}
			var rely = null;
			if (props.rely) {
				rely = Sk.ffi.remapToJs(props.rely);
			}
			var relwidth = null;
			if (props.relwidth) {
				relwidth = Sk.ffi.remapToJs(props.relwidth);
			}
			var relheight = null;
			if (props.relheight) {
				relheight = Sk.ffi.remapToJs(props.relheight);
			}
			var anchor = "nw"; // за замовчуванням "nw"
			if (props.anchor) {
				anchor = Sk.ffi.remapToJs(props.anchor);
			}
			if (relx !== null) {
				x = (relx * parentWidth);
			}
			if (rely !== null) {
				y = (rely * parentHeight);
			}
			commonDisplay(kwa, self, placeRoot);
			setTimeout(forceDomReflow, 0);
			var el = $('#tkinter_' + self.id)

			var oWidth = el.width();
			var oHeight = el.height();
			var dx = 0;
			var dy = 0;
			// Position via anchor
			if (props.anchor) {

				if (anchor.includes('s')) dy = -oHeight;
				if (anchor.includes('e')) dx = -oWidth;
				if (anchor === 'center') {
					dy = -oHeight / 2;
					dx = -oWidth / 2;
				}
				if (anchor === 'n') {
					dx = -oWidth / 2;
				}
				if (anchor === 's') {
					dy = -oHeight;
					dx = -oWidth / 2;
				}
				if (anchor === 'e') {
					dy = -oHeight / 2;
					dx = -oWidth;
				}
				if (anchor === 'w') {
					dy = -oHeight / 2;
				}
				if (anchor === 'ne') {
					dx = -oWidth;
				}
				if (anchor === 'se') {
					dy = -oHeight;
					dx = -oWidth;
				}
				if (anchor === 'sw') {
					dy = -oHeight;
				}

			}

			x = x + dx;
			y = y + dy;

			var style = {
				'position': pos,
				left: x + 'px',
				top: y + 'px',
			};

			if (width !== null) style.width = width + 'px';
			if (height !== null) style.height = height + 'px';
			if (relwidth !== null) style.width = (relwidth * 100) + '%';
			if (relheight !== null) style.height = (relheight * 100) + '%';

			el.css(style);

		};

		place.co_kwargs = true;
		$loc.place = new Sk.builtin.func(place);

		// pack() reimplements Tk's pack algorithm with position:absolute (no flexbox/grid): pack() stores params, layoutPack() computes geometry for all children

		// Add shared CSS once for the whole document
		var ensurePackStyles = function() {
			if ($('#tkinter-pack-style').length) return;
			$('head').append(
				'<style id="tkinter-pack-style">' +
				'.tk-frame { overflow: hidden; }' +
				'.tk-widget { box-sizing: border-box; margin: 0 !important; }' +
				// tk_charsized elements default to nowrap since pack() measures a natural width and enforces it as a fixed pixel width; wraplength= overrides via inline style; textarea (Text) is excluded so typed text still wraps
				'.tk_charsized:not(textarea) { white-space: nowrap; }' +
				'</style>'
			);
		};

		// Offset the widget box inside its allotted area per anchor (w/e for x, n/s for y; no letter = center)
		var packAnchorOffset = function(outerSize, innerSize, anchor, axis) {
			var free = outerSize - innerSize;
			// Check 'center' first — indexOf('e')/('n') would otherwise false-match inside the word 'center'
			if (!anchor || anchor === 'center') return free / 2;
			if (axis === 'x') {
				if (anchor.indexOf('w') > -1) return 0;
				if (anchor.indexOf('e') > -1) return free;
			} else {
				if (anchor.indexOf('n') > -1) return 0;
				if (anchor.indexOf('s') > -1) return free;
			}
			return free / 2;
		};

		// For Frame (_packPropagate===false) the requested size is the explicit width/height passed in, not a DOM measurement; otherwise size is computed recursively for nested pack containers
		var getRequestedSize = function(child) {
			if (!child) return null;
			var props = child.props || {};
			var explicitW = null, explicitH = null;

			// Generic override hook: some widgets have a real, fixed pixel size that is NOT
			// a function of their content (e.g. Treeview's height=<rows> just sets how many
			// rows are visible before scrolling — it has nothing to do with how many items
			// are actually inside, so it can't be derived by measuring rendered content).
			// Such widgets set _fixedPackWidth/_fixedPackHeight directly, in px.
			if (child._fixedPackWidth !== undefined && child._fixedPackWidth !== null) {
				explicitW = child._fixedPackWidth;
			}
			if (child._fixedPackHeight !== undefined && child._fixedPackHeight !== null) {
				explicitH = child._fixedPackHeight;
			}

			if (explicitW === null && child._hasExplicitWidth && props.width !== undefined && props.width !== null) {
				try { explicitW = Sk.ffi.remapToJs(props.width); } catch (e) { explicitW = props.width; }
			}
			if (explicitH === null && child._hasExplicitHeight && props.height !== undefined && props.height !== null) {
				try { explicitH = Sk.ffi.remapToJs(props.height); } catch (e) { explicitH = props.height; }
			}

			if (child._packPropagate === false) {
				if (explicitW === null && explicitH === null) return null;
				return { width: explicitW, height: explicitH };
			}

			if (child._packChildren && child._packChildren.length) {
				var req = computePackRequiredSize(child._packChildren);
				return {
					width: explicitW !== null ? explicitW : req.width,
					height: explicitH !== null ? explicitH : req.height
				};
			}

			if (explicitW === null && explicitH === null) return null;
			return { width: explicitW, height: explicitH };
		};

		// Compute the minimum size master needs so all packed children fit without overlapping (Tk's pack() formula)
		var computePackRequiredSize = function(children) {
			var leftTotal = 0, rightTotal = 0, topTotal = 0, bottomTotal = 0;
			var maxCrossW = 0, maxCrossH = 0;

			children.forEach(function(child) {
				var info = child._packInfo;
				if (!info) return;
				var el = $('#tkinter_' + child.id);
				if (!el.length) return;

				var fixedSize = getRequestedSize(child);

				el.addClass('tk-widget');
				el.css({
					position: 'absolute', left: '-99999px', top: '-99999px',
					width: (fixedSize && fixedSize.width !== null) ? fixedSize.width + 'px' : '',
					height: (fixedSize && fixedSize.height !== null) ? fixedSize.height + 'px' : '',
					paddingLeft: '', paddingRight: '', paddingTop: '', paddingBottom: ''
				});
				if (info.ipadx) el.css({ paddingLeft: info.ipadx + 'px', paddingRight: info.ipadx + 'px' });
				if (info.ipady) el.css({ paddingTop: info.ipady + 'px', paddingBottom: info.ipady + 'px' });

				var reqW = (el.outerWidth() || 0) + info.padx[0] + info.padx[1];
				var reqH = (el.outerHeight() || 0) + info.pady[0] + info.pady[1];

				switch (info.side) {
					case 'left':
						leftTotal += reqW;
						maxCrossH = Math.max(maxCrossH, reqH);
						break;
					case 'right':
						rightTotal += reqW;
						maxCrossH = Math.max(maxCrossH, reqH);
						break;
					case 'bottom':
						bottomTotal += reqH;
						maxCrossW = Math.max(maxCrossW, reqW);
						break;
					case 'top':
					default:
						topTotal += reqH;
						maxCrossW = Math.max(maxCrossW, reqW);
						break;
				}
			});

			return {
				width: leftTotal + rightTotal + maxCrossW,
				height: topTotal + bottomTotal + maxCrossH
			};
		};

		// Recomputes ALL children's pack geometry; runs whenever a child calls pack()/pack_forget()/destroy()
		var layoutPack = function(master) {
			if (!master) return;
			var containerJQ = $('#tkinter_' + master.id);
			if (!containerJQ.length) return;

			ensurePackStyles();
			containerJQ.addClass('tk-frame');
			// Anchor point for children's position:absolute is the master itself; skip if already positioned
			if (containerJQ.css('position') === 'static') {
				containerJQ.css('position', 'relative');
			}

			// Drop children whose DOM element was already removed (pack_forget/destroy)
			var children = (master._packChildren || []).filter(function(c) {
				return $('#tkinter_' + c.id).length > 0;
			});
			master._packChildren = children;
			if (!children.length) return;

			// pack_propagate(True) (Tk default): master grows to fit children before allocating cavity space, so later-packed children don't overlap earlier ones
			if (master._packPropagate !== false) {
				var req = computePackRequiredSize(children);
				var curW = containerJQ.width();
				var curH = containerJQ.height();
				var newW = Math.max(curW, req.width);
				var newH = Math.max(curH, req.height);
				if (newW !== curW || newH !== curH) {
					if (containerJQ.hasClass('ui-dialog-content') && containerJQ.dialog) {
						// Toplevel content is wrapped in a jQuery UI dialog; resize via dialog() options, not raw CSS
						try {
							containerJQ.dialog('option', 'width', newW);
							containerJQ.dialog('option', 'height', newH);
						} catch (e) {
							containerJQ.css({ width: newW + 'px', height: newH + 'px' });
						}
					} else {
						containerJQ.css({ width: newW + 'px', height: newH + 'px' });
					}
				}
			}

			var cw = containerJQ.width();
			var ch = containerJQ.height();

			// Якщо до контейнера прикріплено меню-бар (root.config(menu=...)),
			// він живе у нормальному потоці як перший дочірній елемент і займає
			// власну висоту зверху. Пакування ж використовує position:absolute
			// від top:0 контейнера, тож без цього зсуву перший запакований
			// віджет опиняється прямо під меню-баром (а через z-index меню —
			// візуально над ним).
			var menuBarEl = containerJQ.children('.tk-menu-bar').first();
			var menuBarH = menuBarEl.length ? (menuBarEl.outerHeight() || 0) : 0;

			// Pass 1: measure reqWidth/reqHeight and build the base parcel
			var free = { left: 0, top: menuBarH, right: cw, bottom: ch };
			var items = [];

			children.forEach(function(child) {
				var info = child._packInfo;
				if (!info) return;
				var el = $('#tkinter_' + child.id);
				if (!el.length) return;

				var fixedSize = getRequestedSize(child);

				el.addClass('tk-widget');
				// Reset size/padding to measure natural size, as Tk does before building each parcel; fixed-size containers use their explicit width/height instead
				el.css({
					position: 'absolute', left: 0, top: 0,
					width: (fixedSize && fixedSize.width !== null) ? fixedSize.width + 'px' : '',
					height: (fixedSize && fixedSize.height !== null) ? fixedSize.height + 'px' : '',
					paddingLeft: '', paddingRight: '', paddingTop: '', paddingBottom: ''
				});
				if (info.ipadx) el.css({ paddingLeft: info.ipadx + 'px', paddingRight: info.ipadx + 'px' });
				if (info.ipady) el.css({ paddingTop: info.ipady + 'px', paddingBottom: info.ipady + 'px' });

				// outerWidth/Height (no margin, zeroed by tk-widget) = border-box size including ipadx/ipady padding
				var reqW = el.outerWidth() || 0;
				var reqH = el.outerHeight() || 0;

				var padx = info.padx; // [left, right]
				var pady = info.pady; // [top, bottom]
				var outerW = reqW + padx[0] + padx[1];
				var outerH = reqH + pady[0] + pady[1];

				var parcel;
				switch (info.side) {
					case 'bottom':
						parcel = { x: free.left, y: free.bottom - outerH, w: free.right - free.left, h: outerH };
						free.bottom -= outerH;
						break;
					case 'left':
						parcel = { x: free.left, y: free.top, w: outerW, h: free.bottom - free.top };
						free.left += outerW;
						break;
					case 'right':
						parcel = { x: free.right - outerW, y: free.top, w: outerW, h: free.bottom - free.top };
						free.right -= outerW;
						break;
					case 'top':
					default:
						parcel = { x: free.left, y: free.top, w: free.right - free.left, h: outerH };
						free.top += outerH;
						break;
				}

				items.push({ el: el, info: info, reqW: reqW, reqH: reqH, padx: padx, pady: pady, parcel: parcel, child: child });
			});

			// Pass 2: expand — split leftover free space among expand widgets along the packing axis (as in Tk)
			var leftoverW = Math.max(0, free.right - free.left);
			var leftoverH = Math.max(0, free.bottom - free.top);

			var expandTB = items.filter(function(it) { return it.info.expand && (it.info.side === 'top' || it.info.side === 'bottom'); });
			var expandLR = items.filter(function(it) { return it.info.expand && (it.info.side === 'left' || it.info.side === 'right'); });
			var expandOther = items.filter(function(it) { return it.info.expand && it.info.side !== 'top' && it.info.side !== 'bottom' && it.info.side !== 'left' && it.info.side !== 'right'; });

			var shareH = expandTB.length ? leftoverH / expandTB.length : 0;
			var shareW = expandLR.length ? leftoverW / expandLR.length : 0;
			var shareOtherW = expandOther.length ? leftoverW / expandOther.length : 0;
			var shareOtherH = expandOther.length ? leftoverH / expandOther.length : 0;

			items.forEach(function(it) {
				if (!it.info.expand) return;
				if (it.info.side === 'top' || it.info.side === 'bottom') {
					it.parcel.h += shareH;
				} else if (it.info.side === 'left' || it.info.side === 'right') {
					it.parcel.w += shareW;
				} else {
					it.parcel.w += shareOtherW;
					it.parcel.h += shareOtherH;
				}
			});

			// Parcel sizes changed after expand; recompute x/y for all parcels so later items see the correct remaining space
			// (той самий зсув на висоту меню-бару, що й у "free" вище — інакше він тут обнуляється)
			var free2 = { left: 0, top: menuBarH, right: cw, bottom: ch };
			items.forEach(function(it) {
				var w = it.parcel.w, h = it.parcel.h;
				switch (it.info.side) {
					case 'bottom':
						it.parcel.w = free2.right - free2.left;
						it.parcel.x = free2.left;
						it.parcel.y = free2.bottom - h;
						free2.bottom -= h;
						break;
					case 'left':
						it.parcel.h = free2.bottom - free2.top;
						it.parcel.x = free2.left;
						it.parcel.y = free2.top;
						free2.left += w;
						break;
					case 'right':
						it.parcel.h = free2.bottom - free2.top;
						it.parcel.x = free2.right - w;
						it.parcel.y = free2.top;
						free2.right -= w;
						break;
					case 'top':
					default:
						it.parcel.w = free2.right - free2.left;
						it.parcel.x = free2.left;
						it.parcel.y = free2.top;
						free2.top += h;
						break;
				}
			});

			// Pass 3: apply fill + anchor -> left/top/width/height
			items.forEach(function(it) {
				var info = it.info;
				var padx = it.padx, pady = it.pady; // [left,right] / [top,bottom]

				// Inner area = parcel minus padx/pady (the outer margin around the widget)
				var inner = {
					x: it.parcel.x + padx[0],
					y: it.parcel.y + pady[0],
					w: Math.max(0, it.parcel.w - padx[0] - padx[1]),
					h: Math.max(0, it.parcel.h - pady[0] - pady[1])
				};

				var fill = info.fill || 'none';
				var w = (fill === 'x' || fill === 'both') ? inner.w : it.reqW;
				var h = (fill === 'y' || fill === 'both') ? inner.h : it.reqH;

				var anchor = info.anchor || 'center';
				var x = inner.x + packAnchorOffset(inner.w, w, anchor, 'x');
				var y = inner.y + packAnchorOffset(inner.h, h, anchor, 'y');

				it.el.css({
					position: 'absolute',
					left: Math.round(x) + 'px',
					top: Math.round(y) + 'px',
					width: Math.round(w) + 'px',
					height: Math.round(h) + 'px'
				});

				// If this child is itself a pack master, relayout its own children now that its size just changed
				if (it.child._packChildren && it.child._packChildren.length) {
					layoutPack(it.child);
				}
			});

			setTimeout(forceDomReflow, 0);
		};

		// relayoutAncestors: layoutPack() only recomputes downward; if master's size just changed, walk up and re-layout each ancestor so their cached position for it isn't stale
		var relayoutAncestors = function(master) {
			var node = master;
			var guard = 0;
			while (node && node.master && node.master !== node && node._packInfo && guard < 100) {
				layoutPack(node.master);
				node = node.master;
				guard++;
			}
		};

		// layoutPack/relayoutAncestors live in Widget's closure but configure() (defined earlier, shared across classes) can't see them — expose both via s.__layoutPack/s.__relayoutAncestors
		s.__layoutPack = layoutPack;
		s.__relayoutAncestors = relayoutAncestors;

		// savePackInfo only stores pack() params; padx/pady may be one number or a (before, after) tuple — normalizePad() always returns [before, after] in px (raw arrays otherwise produced NaN geometry)
		var normalizePad = function(raw) {
			if (raw === undefined || raw === null) return [0, 0];
			var v;
			try { v = Sk.ffi.remapToJs(raw); } catch (e) { v = raw; }
			if (Array.isArray(v)) {
				var a = Number(v[0]) || 0;
				var b = v.length > 1 ? (Number(v[1]) || 0) : a;
				return [a, b];
			}
			var n = Number(v) || 0;
			return [n, n];
		};

		var pack = function(kwa, self) {
			var props = unpackKWA(kwa);

			if (!self.master) {
				self.master = self;
			}

			ensurePackStyles();

			var info = {
				side: props.side ? Sk.ffi.remapToJs(props.side) : 'top',
				fill: props.fill ? Sk.ffi.remapToJs(props.fill) : 'none',
				expand: props.expand ? !!Sk.ffi.remapToJs(props.expand) : false,
				anchor: props.anchor ? Sk.ffi.remapToJs(props.anchor) : 'center',
				padx: normalizePad(props.padx), // [left, right]
				pady: normalizePad(props.pady), // [top, bottom]
				ipadx: props.ipadx ? Sk.ffi.remapToJs(props.ipadx) : 0,
				ipady: props.ipady ? Sk.ffi.remapToJs(props.ipady) : 0
			};
			self._packInfo = info;

			var containerJQ = $('#tkinter_' + self.master.id);

			if (!self.master._packChildren) self.master._packChildren = [];
			if (self.master._packChildren.indexOf(self) === -1) {
				self.master._packChildren.push(self);
			}

			// Render without the old fill/margin styling — layoutPack() handles geometry
			commonDisplay(kwa, self, containerJQ, true);

			// commonDisplay() re-attaches events; layoutPack only touches position/size
			layoutPack(self.master);
			relayoutAncestors(self.master);
		};
		pack.co_kwargs = true;
		$loc.pack = new Sk.builtin.func(pack);

		// pack_forget(): remove from pack layout; pack_propagate(flag): fixed size (False) vs auto-fit to children (True, default)
		$loc.pack_propagate = new Sk.builtin.func(function(self, flag) {
			if (flag === undefined) {
				return Sk.ffi.remapToPy(self._packPropagate !== false);
			}
			self._packPropagate = !!Sk.ffi.remapToJs(flag);
			if (self._packChildren) layoutPack(self);
			relayoutAncestors(self);
		});

		$loc.pack_forget = new Sk.builtin.func(function(self) {
			$('#tkinter_' + self.id).remove();
			if (self.master && self.master._packChildren) {
				var idx = self.master._packChildren.indexOf(self);
				if (idx > -1) self.master._packChildren.splice(idx, 1);
				layoutPack(self.master);
				relayoutAncestors(self.master);
			}
		});




		// grid layout manager ---
		var grid = function(kwa, self) {
			var props = unpackKWA(kwa);
			var elementId = 'tkinter_' + self.id;
			var masterId = 'tkinter_' + self.master.id;
			var parentJQ = $('#' + masterId);

			if (!self.master) {
				self.master = self;
			}

			// Add CSS once
			if (!$('#tkinter-grid-style').length) {
				$('head').append(
					'<style id="tkinter-grid-style">' +
					'.tk-grid-container { display: grid; gap: 4px; padding: 5px; width: 100%; height: 100%; box-sizing: border-box; align-content: start; justify-content: start; }' +
					'.tk-grid-item { align-self: stretch; justify-self: stretch; }' +
					'</style>'
				);
			}

			// Create the grid container if missing (scoped to this parent so multiple grid()s don't share one)
			if (!parentJQ.find('> #tk-grid-root').length) {
				parentJQ.append('<div id="tk-grid-root" class="tk-grid-container"></div>');
			}

			var gridRoot = parentJQ.find('> #tk-grid-root');

			// Read grid params
			var row = Sk.ffi.remapToJs(props.row ?? 0);
			var column = Sk.ffi.remapToJs(props.column ?? 0);
			var rowspan = Sk.ffi.remapToJs(props.rowspan ?? 1);
			var columnspan = Sk.ffi.remapToJs(props.columnspan ?? 1);
			var padx = Sk.ffi.remapToJs(props.padx ?? 0);
			var pady = Sk.ffi.remapToJs(props.pady ?? 0);
			var sticky = Sk.ffi.remapToJs(props.sticky ?? ''); // e.g., "nsew"
			// Add the widget to the container
			commonDisplay(kwa, self, gridRoot);
			setTimeout(forceDomReflow, 0);
			// padx/pady are already applied as margin in commonDisplay(); don't reapply as padding or the gap doubles (CSS Grid margins don't collapse)
			var el = $('#' + elementId);
			el.css({
				'grid-row': (row + 1) + ' / span ' + rowspan,
				'grid-column': (column + 1) + ' / span ' + columnspan,
				'align-self': 'stretch',
				'justify-self': 'stretch'
			});

			// sticky (n/s/e/w) controls alignment
			if (sticky.includes('n')) el.css('align-self', 'start');
			if (sticky.includes('s')) el.css('align-self', 'end');
			if (sticky.includes('e')) el.css('justify-self', 'end');
			if (sticky.includes('w')) el.css('justify-self', 'start');
			if (sticky.includes('n') && sticky.includes('s')) el.css('align-self', 'stretch');
			if (sticky.includes('e') && sticky.includes('w')) el.css('justify-self', 'stretch');

			// If this grid's own container (self.master, e.g. a Frame) was already pack()'d into
			// ITS parent before this child was added — a very common order (Frame(); frame.pack();
			// then grid() the contents) — the parent pack layout measured the container BEFORE it had
			// any content and froze its size (often 0x0, since Frame defaults to auto/pack_propagate).
			// Re-running the ancestor pack layout now lets the container re-measure itself with its
			// actual grid content, instead of staying invisible.
			relayoutAncestors(self.master);

		};

		grid.co_kwargs = true;
		$loc.grid = new Sk.builtin.func(grid);

		function bind(self, event, command) {
			var e = Sk.ffi.remapToJs(event);
			if (e === '<B1-Motion>') {
				e = '<B1Motion>';
			}
			if (e === '<Double-Button>') {
				e = '<DoubleButton>';
			}
			if (e.indexOf("-") > -1) {
				var parts = e.substr(1, e.length - 2).split("-");
				command.eventDetails = parts[1];
				e = "<" + parts[0] + ">";
			}
			if (!self.eventHandlers) {
				self.eventHandlers = {};
			}
			self.eventHandlers[e] = command;
			self.updateEventHandlers = updateEventHandlers;
			updateEventHandlers(self);
		};

		$loc.bind = new Sk.builtin.func(bind);

		$loc.bind_all = new Sk.builtin.func(bind);

		// Знаходить реальний <input>/<textarea>, з яким працює віджет: для Entry/Text
		// це сам #tkinter_<id>, для Spinbox — вкладений #spinner_input_<id>, для решти —
		// перший input/textarea всередині контейнера (якщо є).
		function getEditableElement(self) {
			var $direct = $('#tkinter_' + self.id);
			if ($direct.is('input, textarea')) {
				return $direct;
			}
			var $spinner = $('#spinner_input_' + self.id);
			if ($spinner.length) {
				return $spinner;
			}
			var $inner = $direct.find('input, textarea').first();
			if ($inner.length) {
				return $inner;
			}
			return $direct;
		}

		// Реалізація <<Copy>>/<<Cut>>/<<Paste>> для event_generate(): працює через
		// navigator.clipboard (де дозволено) з фолбеком на document.execCommand,
		// та синхронізує self.props.textvariable, якщо він є.
		function doClipboardAction(self, action) {
			var $el = getEditableElement(self);
			if (!$el.length) {
				return;
			}
			var el = $el[0];
			var full = el.value != null ? el.value : '';
			var start = el.selectionStart != null ? el.selectionStart : 0;
			var end = el.selectionEnd != null ? el.selectionEnd : full.length;
			var hasSelection = (start !== end);
			var selectedText = hasSelection ? full.substring(start, end) : full;

			function syncValue(newVal, caretPos) {
				el.value = newVal;
				if (self.props && self.props.textvariable) {
					self.props.textvariable.value = new Sk.builtin.str(newVal);
				}
				if (caretPos !== undefined && el.setSelectionRange) {
					el.setSelectionRange(caretPos, caretPos);
				}
			}

			if (action === 'copy' || action === 'cut') {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(selectedText).catch(function() {});
				}
				try {
					el.focus();
					if (hasSelection) { el.setSelectionRange(start, end); }
					document.execCommand('copy');
				} catch (e) {}

				if (action === 'cut') {
					var updated = hasSelection ? (full.substring(0, start) + full.substring(end)) : '';
					syncValue(updated, start);
				}
			} else if (action === 'paste') {
				if (navigator.clipboard && navigator.clipboard.readText) {
					navigator.clipboard.readText().then(function(text) {
						var updated = full.substring(0, start) + text + full.substring(end);
						syncValue(updated, start + text.length);
					}).catch(function() {
						try { el.focus(); document.execCommand('paste'); } catch (e2) {}
					});
				} else {
					try { el.focus(); document.execCommand('paste'); } catch (e) {}
				}
			}
		}

		// event_generate(): підтримує реальні дії для <<Copy>>/<<Cut>>/<<Paste>>
		// (стандартний спосіб реалізувати кнопки Копіювати/Вирізати/Вставити для
		// Entry/Text/Spinbox), а також викликає Python-обробник, якщо на цю
		// (віртуальну) подію є bind().
		var eventGenerate = function(kwa, self, event) {
			var e = Sk.ffi.remapToJs(event);

			if (e === '<<Copy>>') {
				doClipboardAction(self, 'copy');
			} else if (e === '<<Cut>>') {
				doClipboardAction(self, 'cut');
			} else if (e === '<<Paste>>') {
				doClipboardAction(self, 'paste');
			}

			if (self.eventHandlers && self.eventHandlers[e]) {
				var pyE = Sk.misceval.callsim(s.Event);
				pyE.props.widget = self;
				Sk.misceval.callsimAsync(null, self.eventHandlers[e], pyE).then(function success(r) {

				}, function fail(err) {
					window.onerror(err);
				});
			}
		};
		eventGenerate.co_kwargs = true;
		$loc.event_generate = new Sk.builtin.func(eventGenerate);

		$loc.__setitem__ = new Sk.builtin.func(function(self, key, value) { // Set key item values            
			self.props[Sk.ffi.remapToJs(key)] = value;
			applyWidgetStyles(self); //

			// Same as configure(): a prop change (e.g. width=) can alter the widget's
			// required size, so pack()'s cavity/anchor math must be redone for its
			// master, or the widget just grows from its old fixed left/top instead
			// of staying centered (or otherwise anchored) within its parcel.
			if (self.master && self._packInfo && s.__layoutPack) {
				s.__layoutPack(self.master);
				if (s.__relayoutAncestors) s.__relayoutAncestors(self.master);
			}
		});

		$loc.destroy = new Sk.builtin.func(function(self) {
			$('#tkinter_' + self.id).remove();
			if (self.master && self.master._packChildren) {
				var idx = self.master._packChildren.indexOf(self);
				if (idx > -1) {
					self.master._packChildren.splice(idx, 1);
					layoutPack(self.master);
				}
			}
			if (self.closeMainLoop) {
				self.closeMainLoop();
			}
		});
	}, 'Widget', []);

	function unpackKWA(kwa) {
		var result = {};

		for (var i = 0; i < kwa.length; i += 2) {
			var key = Sk.ffi.remapToJs(kwa[i]);
			var val = kwa[i + 1];
			result[key] = val;
		}
		return result;
	}

	var commonWidgetConstructor = function(kwa, self, master, getHtml) {

		self.props = unpackKWA(kwa);
		if (!master && firstRoot) {
			master = firstRoot;
		}
		self.master = master;
		widgets[idCount] = self;
		self.id = idCount++;
		self.getHtml = getHtml;
	}
	// Canvas ---
	s.Canvas = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		var canvasBg = '#eeeeee';
		var getHtml = function(self) {

			if (self.props.bg) {
				canvasBg = Sk.ffi.remapToJs(self.props.bg);
			}
			if (self.props.background) {
				canvasBg = Sk.ffi.remapToJs(self.props.background);
			}
			var width = 200;
			if (self.props.width) {
				width = Sk.ffi.remapToJs(self.props.width);
			}
			var height = 200;
			if (self.props.height) {
				height = Sk.ffi.remapToJs(self.props.height);
			}
			return '<canvas id="tkinter_' + self.id + '" tabindex="0" class="tk_pixelsized" width="' + width + '" height="' + height + '"></canvas>';
		}

		function commonCanvasElement(self, element) {
			var canvas = document.getElementById('tkinter_' + self.id);
			if (canvas) {
				element.draw(canvas);
			}

			self.elements.push(element);

			return new Sk.ffi.remapToPy(self.elements.length - 1);
		}

		// Offset (dx, dy) from the anchor point to the image's top-left corner; shared with bbox() for computing PhotoImage's real box
		function computeImageAnchorOffset(width, height, anchorRaw) {
			var dx = 0, dy = 0;
			var anchor = "CENTER";
			if (anchorRaw) {
				anchor = Sk.ffi.remapToJs(anchorRaw).toUpperCase();
			}
			if (anchor == "N") { dx = -width / 2; dy = 0; }
			if (anchor == "S") { dx = -width / 2; dy = -height; }
			if (anchor == "W") { dx = 0; dy = -height / 2; }
			if (anchor == "E") { dx = -width; dy = -height / 2; }
			if (anchor == "CENTER") { dx = -width / 2; dy = -height / 2; }
			if (anchor == "NW") { dx = 0; dy = 0; }
			if (anchor == "NE") { dx = -width; dy = 0; }
			if (anchor == "SW") { dx = 0; dy = -height; }
			if (anchor == "SE") { dx = -width; dy = -height; }
			return { dx: dx, dy: dy };
		}

		var init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);
			self.elements = [];
			self.onShow = function() {
				var canvas = document.getElementById('tkinter_' + self.id);
				if (canvas) {
					const cx = canvas.getContext('2d');
					if (self.props.bg) {
						cx.fillStyle = getColor(Sk.ffi.remapToJs(self.props.bg));
					}
					if (self.props.background) {
						cx.fillStyle = getColor(Sk.ffi.remapToJs(self.props.background));
					}
					cx.clearRect(0, 0, canvas.width, canvas.height);

					for (var i = 0; i < self.elements.length; i++) {
						if (self.elements[i].deleted)
							continue;
						self.elements[i].draw(canvas);
					}
				}
			}
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.bbox = new Sk.builtin.func(function(self, item) {
			// Normalize bbox to always return a tuple of 4 Sk.builtin.int_, or None if the item doesn't exist (previously mixed raw JS numbers and Sk.builtin.int_, which broke unpacking)
			if (!item) {
				return Sk.builtin.none.none$;
			}

			var idx = Sk.ffi.remapToJs(item);
			var e = self.elements[idx];
			if (!e || e.deleted) {
				return Sk.builtin.none.none$;
			}

			var x1, y1, x2, y2;

			if (Array.isArray(e.coords)) {
				// line/polygon: flat list [x1, y1, x2, y2, ...]
				var xs = [], ys = [];
				for (var i = 0; i + 1 < e.coords.length; i += 2) {
					xs.push(e.coords[i]);
					ys.push(e.coords[i + 1]);
				}
				if (xs.length === 0) {
					return Sk.builtin.none.none$;
				}
				x1 = Math.min.apply(null, xs);
				y1 = Math.min.apply(null, ys);
				x2 = Math.max.apply(null, xs);
				y2 = Math.max.apply(null, ys);
			} else if (e.type === "image") {
				// PhotoImage: the element only stores the anchor point; get the real size from props.image and account for anchor
				var sz = photoImageSize(e.props && e.props.image);
				var w = sz ? sz.width : 0;
				var h = sz ? sz.height : 0;
				var off = computeImageAnchorOffset(w, h, e.props && e.props.anchor);
				x1 = e.coords.x1 + off.dx;
				y1 = e.coords.y1 + off.dy;
				x2 = x1 + w;
				y2 = y1 + h;
			} else if (e.type === "text") {
				// Text element also only stores the anchor point; approximate the box via canvas.measureText
				var textStr = (e.props && e.props.text) ? Sk.ffi.remapToJs(e.props.text) : "";
				var canvasEl = document.getElementById('tkinter_' + self.id);
				var tw = 0, th = 12;
				if (canvasEl && textStr) {
					tw = canvasEl.getContext('2d').measureText(textStr).width;
				}
				x1 = e.coords.x1 - tw / 2;
				y1 = e.coords.y1 - th / 2;
				x2 = e.coords.x1 + tw / 2;
				y2 = e.coords.y1 + th / 2;
			} else if (e.coords && e.coords.x1 !== undefined && e.coords.y1 !== undefined &&
			           e.coords.x2 !== undefined && e.coords.y2 !== undefined) {
				// rectangle/oval/arc: coords already holds the full box
				x1 = e.coords.x1;
				y1 = e.coords.y1;
				x2 = e.coords.x2;
				y2 = e.coords.y2;
			} else if (e.coords && e.coords.x1 !== undefined && e.coords.y1 !== undefined) {
				// fallback for any other point-like element
				x1 = e.coords.x1;
				y1 = e.coords.y1;
				x2 = e.coords.x1;
				y2 = e.coords.y1;
			} else {
				return Sk.builtin.none.none$;
			}

			// normalize so x1<=x2 and y1<=y2, like real tkinter
			if (x1 > x2) { var tmpX = x1; x1 = x2; x2 = tmpX; }
			if (y1 > y2) { var tmpY = y1; y1 = y2; y2 = tmpY; }

			return new Sk.builtin.tuple([
				new Sk.builtin.int_(Math.round(x1)),
				new Sk.builtin.int_(Math.round(y1)),
				new Sk.builtin.int_(Math.round(x2)),
				new Sk.builtin.int_(Math.round(y2))
			]);
		});

		$loc.find_withtag = new Sk.builtin.func(function(self, tagname) {
			var tag = Sk.ffi.remapToJs(tagname);
			var matches = [];
			for (var i = 0; i < self.elements.length; i++) {
				if (self.elements[i] && self.elements[i].props && self.elements[i].props.tag && Sk.ffi.remapToJs(self.elements[i].props.tag) == tag && !self.elements[i].deleted) {
					matches.push(Sk.ffi.remapToPy(i));
				}
			}
			return new Sk.builtin.tuple(matches);
		});

		var coords = function(kwa, self, item, coords) {
			var id = Sk.ffi.remapToJs(item);
			if (coords) {
				var jsCoords = Sk.ffi.remapToJs(coords);
				if (typeof(jsCoords) == "number") {
					jsCoords = [];
					var found = false;
					for (var i = 0; i < arguments.length; i++) {
						if (arguments[i] == coords) {
							found = true;
						}
						if (found) {
							jsCoords.push(Sk.ffi.remapToJs(arguments[i]));
						}
					}
				}

				if (self.elements[id].coords.x1) { // перевірка як задані координати - як об’єкт: { x1: ..., y1: ..., x2: ..., y2: ... } або як масив: [x1, y1, x2, y2]
					if (jsCoords.length === 2) {
						self.elements[id].coords.x1 = jsCoords[0];
						self.elements[id].coords.y1 = jsCoords[1];
					} else if (jsCoords.length === 4) {
						self.elements[id].coords.x1 = jsCoords[0];
						self.elements[id].coords.y1 = jsCoords[1];
						self.elements[id].coords.x2 = jsCoords[2];
						self.elements[id].coords.y2 = jsCoords[3];
					}
				} else
					for (var i = 0; i < jsCoords.length; i++) {
						self.elements[id].coords[i] = jsCoords[i];
					}
				self.onShow();
			}
			var c = [];
			if (self && self.elements && self.elements[id] && !self.elements[id].deleted) {
				var crd = self.elements[id].coords;

				if (Array.isArray(crd)) {
					for (var i = 0; i < crd.length; i++) {
						c.push(new Sk.builtin.int_(crd[i]));
					}
				} else if (typeof crd === "object") {
					if (crd.x1 !== undefined) c.push(new Sk.builtin.int_(crd.x1));
					if (crd.y1 !== undefined) c.push(new Sk.builtin.int_(crd.y1));
					if (crd.x2 !== undefined) c.push(new Sk.builtin.int_(crd.x2));
					if (crd.y2 !== undefined) c.push(new Sk.builtin.int_(crd.y2));
				}
			}
			return new Sk.builtin.tuple(c);
		};
		coords.co_kwargs = true;
		$loc.coords = new Sk.builtin.func(coords);

		$loc.move = new Sk.builtin.func(function(self, item, dx, dy) {
			var id = Sk.ffi.remapToJs(item);
           
			if (self && self.elements && self.elements[id] && !self.elements[id].deleted) {
				self.elements[id].coords.x1 += Sk.ffi.remapToJs(dx);
				self.elements[id].coords.y1 += Sk.ffi.remapToJs(dy);
				self.elements[id].coords.x2 += Sk.ffi.remapToJs(dx);
				self.elements[id].coords.y2 += Sk.ffi.remapToJs(dy);
			}
			self.onShow();
		});

		$loc.find_overlapping = new Sk.builtin.func(function(self, x1, y1, x2, y2) {
			var matches = [];
			for (var i = 0; i < self.elements.length; i++) {
				if (self.elements[i] && self.elements[i].coords && !self.elements[i].deleted) {
					var r1 = {
						x1: Sk.ffi.remapToJs(x1),
						y1: Sk.ffi.remapToJs(y1),
						x2: Sk.ffi.remapToJs(x2),
						y2: Sk.ffi.remapToJs(y2)
					}
					var r2 = self.elements[i].coords;
					if ((r1.x2 >= r2.x1) && (r1.x1 <= r2.x2) && (r1.y2 >= r2.y1) && (r1.y1 <= r2.y2)) {
						matches.push(new Sk.builtin.int_(i));
					}
				}
			}
			return new Sk.builtin.tuple(matches);
		});

		$loc.delete_$rw$ = new Sk.builtin.func(function(self, id) {
			if (!id) id = new Sk.builtin.str("all");
			var idName = Sk.ffi.remapToJs(id);
			if (idName == "all") {
				self.elements = [];
			} else {
				var i = Sk.ffi.remapToJs(id);
				self.elements[i].deleted = true;
			}
			self.onShow();
		});

		function applyStyles(props, cx) {

			if (!props.dash) {
				cx.setLineDash([]);
			}
			if (props.fill) {
				cx.strokeStyle = getColor(Sk.ffi.remapToJs(props.fill));
			}
			if (!props.outline) {
				props.outline = new Sk.builtin.str("black");
			}
			cx.strokeStyle = getColor(Sk.ffi.remapToJs(props.outline));

			if (props.width) {
				cx.lineWidth = Sk.ffi.remapToJs(props.width);
			} else {
				cx.lineWidth = 1
			}

			if (props.dash) {
				var dash = Sk.ffi.remapToJs(props.dash);
				if (Array.isArray(dash)) {
					cx.setLineDash(dash);
				} else {
					var dashes = [dash, dash];
					cx.setLineDash(dashes);
				}
			}

			if (props.font) {
				var font = Sk.ffi.remapToJs(props.font);
				if (typeof(font) == "string") {
					font = font.split(" ");
				}
				var sFont = "";

				if (font.length > 1) {
					sFont = font[1] + "pt ";
				}
				sFont += font[0];
				cx.font = sFont;
			}
		}

		function draw_curve(ctx, pointsArray, closed = true, smoothing = 0.6) {
			if (pointsArray.length < 6) {
				console.error('Need at least 3 points (6 coordinates) to smooth a polygon');
				return;
			}
			const points = [];
			for (let i = 0; i < pointsArray.length; i += 2) {
				points.push({
					x: pointsArray[i],
					y: pointsArray[i + 1]
				});
			}
			if (closed) {
				points.push(points[0]);
				points.push(points[1]);
			}
			// Start at the midpoint of the first side
			let firstX = (points[0].x + points[1].x) / 2;
			let firstY = (points[0].y + points[1].y) / 2;
			let pend = 1;
			if (!closed) {
				firstX = points[0].x;
				firstY = points[0].y;
				pend = 2;
			}
			ctx.moveTo(firstX, firstY);

			for (let i = 1; i < points.length - pend; i++) {
				const prev = points[i - 1];
				const curr = points[i];
				const next = points[i + 1];
				// Midpoints of each side
				const mid1 = {
					x: (prev.x + curr.x) / 2,
					y: (prev.y + curr.y) / 2
				};
				const mid2 = {
					x: (curr.x + next.x) / 2,
					y: (curr.y + next.y) / 2
				};
				// Control points inside the polygon
				const control1 = {
					x: mid1.x + (curr.x - mid1.x) * smoothing,
					y: mid1.y + (curr.y - mid1.y) * smoothing
				};
				const control2 = {
					x: mid2.x + (curr.x - mid2.x) * smoothing,
					y: mid2.y + (curr.y - mid2.y) * smoothing
				};
				// Draw the Bézier curve
				ctx.bezierCurveTo(
					control1.x, control1.y,
					control2.x, control2.y,
					mid2.x, mid2.y
				);
			}

			if (closed) {

				ctx.closePath();
				ctx.fill()

			} else {
				// End the curve at the last point dynamically — hardcoded indices broke for anything other than exactly 5 points
				const last = points.length - 1;
				ctx.quadraticCurveTo(
					points[last - 1].x, points[last - 1].y,
					points[last].x, points[last].y);

			}

			ctx.stroke();

		}

		function draw_polygon(ctx, pointsArray, isClosed) {
			ctx.moveTo(pointsArray[0], pointsArray[1]);
			for (var i = 2; i < pointsArray.length; i += 2) {
				ctx.lineTo(pointsArray[i], pointsArray[i + 1]);
			}
			if (isClosed) {
				ctx.closePath();
			}
			ctx.stroke();

		}
		var create_polygon = function(kwa, self, coords) {
			var jsCoords = Sk.ffi.remapToJs(coords);
			if (self.props.fill) {
				self.props.fill = undefined;
			}
			var props = unpackKWA(kwa);
			for (var key in props) {
				self.props[key] = props[key];
			}
			if (typeof(jsCoords) == "number") {
				jsCoords = [];
				var found = false;
				for (var i = 0; i < arguments.length; i++) {
					if (arguments[i] == coords) {
						found = true;
					}
					if (found) {
						jsCoords.push(Sk.ffi.remapToJs(arguments[i]));
					}
				}
			}
			return commonCanvasElement(self, {
				props: props,
				coords: jsCoords,
				draw: function(canvas) {
					var cx = canvas.getContext('2d');
					cx.beginPath();
					applyStyles(props, cx);
					let smooth = false;

					if (self.props.smooth) {
						smooth = Sk.ffi.remapToJs(self.props.smooth)
						if (smooth) {
							draw_curve(cx, jsCoords, true)
						}

						if (!smooth) {
							draw_polygon(cx, jsCoords, true)
						}
					} else {
						draw_polygon(cx, jsCoords, true)
					}
					self.props.smooth = "";
					if (self.props.fill && Sk.ffi.remapToJs(self.props.fill) != '') {
						cx.fillStyle = Sk.ffi.remapToJs(self.props.fill);
						cx.fill();
					}
				}
			});
		}
		create_polygon.co_kwargs = true;
		$loc.create_polygon = new Sk.builtin.func(create_polygon);


		var create_line = function(kwa, self, coords) {
			var jsCoords = Sk.ffi.remapToJs(coords);
			if (self.props.fill) {
				self.props.fill = undefined;
			}
			var props = unpackKWA(kwa);
			for (var key in props) {
				self.props[key] = props[key];
			}
			if (typeof(jsCoords) == "number") {
				jsCoords = [];
				var found = false;
				for (var i = 0; i < arguments.length; i++) {
					if (arguments[i] == coords) {
						found = true;
					}
					if (found) {
						jsCoords.push(Sk.ffi.remapToJs(arguments[i]));
					}
				}
			}
			return commonCanvasElement(self, {
				props: props,
				coords: jsCoords,
				draw: function(canvas) {
					function drawArrow(x0, y0, x1, y1) {
						var headLength = 15;
						var deg_in_rad_200 = 200 * Math.PI / 180;
						var deg_in_rad_160 = 160 * Math.PI / 180;
						// calc the angle of the line
						var dx = x1 - x0;
						var dy = y1 - y0;
						var angle = Math.atan2(dy, dx);
						// calc arrowhead points
						var x200 = x1 + headLength * Math.cos(angle + deg_in_rad_200);
						var y200 = y1 + headLength * Math.sin(angle + deg_in_rad_200);
						var x160 = x1 + headLength * Math.cos(angle + deg_in_rad_160);
						var y160 = y1 + headLength * Math.sin(angle + deg_in_rad_160);
						cx.beginPath();
						cx.moveTo(x1, y1);
						cx.setLineDash([]);
						cx.lineWidth = 2;
						// draw arrowhead
						cx.lineTo(x200, y200);
						cx.lineTo(x160, y160);
						cx.lineTo(x1, y1);
						cx.closePath();
						cx.stroke();
						cx.fill()
					}
					var cx = canvas.getContext('2d');
					cx.beginPath();
					applyStyles(props, cx);
					if (props.fill) {
						cx.strokeStyle = getColor(Sk.ffi.remapToJs(props.fill));
						cx.fillStyle = getColor(Sk.ffi.remapToJs(props.fill));
					} else {
						cx.strokeStyle = 'black';
						cx.fillStyle = 'black';
					}

					if (self.props.smooth) {
						smooth = Sk.ffi.remapToJs(self.props.smooth);
						if (smooth) {
							draw_curve(cx, jsCoords, false)
						}
						if (!smooth) {
							draw_polygon(cx, jsCoords, false)
						}
					} else {
						draw_polygon(cx, jsCoords, false)
					}


					self.props.smooth = "";
					// arrow head
					if (props.arrow) {
						arrw = Sk.ffi.remapToJs(props.arrow);
						var l = jsCoords.length;
						if ((arrw == "last") || (arrw == "both")) {
							drawArrow(jsCoords[l - 4], jsCoords[l - 3], jsCoords[l - 2], jsCoords[l - 1])
						}
						if ((arrw == "first") || (arrw == "both")) {
							drawArrow(jsCoords[2], jsCoords[3], jsCoords[0], jsCoords[1])
						}
					}
				}
			});
		}
		create_line.co_kwargs = true;
		$loc.create_line = new Sk.builtin.func(create_line);
var create_text = function (kwa, self, x, y) {
    var coords = {
        x1: Sk.ffi.remapToJs(x),
        y1: Sk.ffi.remapToJs(y)
    };

    var props = unpackKWA(kwa);
    return commonCanvasElement(self, {
        type: "text",
        props: props,
        coords: coords,
        draw: function (canvas) {
            var cx = canvas.getContext('2d');
            var text = "";
            var angle = 0;
            var font = "12px Arial";
            var fill = "black";
            var anchor = "center";
            var justify = "center";

            if (props.text) text = "" + Sk.ffi.remapToJs(props.text);

            if (props.font) {
                let fontSpec = Sk.ffi.remapToJs(props.font);
                if (Array.isArray(fontSpec)) {
                    // tkinter passes ['Arial', 14, 'bold italic']
                    let family = fontSpec[0] || "Arial";
                    let size = fontSpec[1] || 12;
                    let style = "", weight = "";
                    if (fontSpec.length > 2) {
                        let rest = fontSpec.slice(2).join(" ").toLowerCase();
                        if (rest.includes("italic")) style = "italic";
                        if (rest.includes("bold")) weight = "bold";
                    }
                    font = `${style} ${weight} ${size}px ${family}`.trim();
                } else if (typeof fontSpec === "string") {
                    // parse a tkinter-style font string ('Arial 14 bold italic')
                    let parts = fontSpec.split(/\s+/);
                    let family = parts[0] || "Arial";
                    let size = "12px";
                    let style = "", weight = "";
                    for (let p of parts) {
                        if (/^\d+/.test(p)) size = `${p}px`;
                        if (p.toLowerCase() === "italic") style = "italic";
                        if (p.toLowerCase() === "bold") weight = "bold";
                    }
                    if (!/px/.test(size)) size = size + "px";
                    font = `${style} ${weight} ${size} ${family}`.trim();
                } else {
                    font = "12px Arial";
                }
            }
            cx.font = font;

            if (props.fill) fill = getColor(Sk.ffi.remapToJs(props.fill));
            cx.fillStyle = fill;

            if (props.anchor) anchor = Sk.ffi.remapToJs(props.anchor);
            if (props.justify) justify = Sk.ffi.remapToJs(props.justify);
            if (props.angle) angle = Sk.ffi.remapToJs(props.angle);


            var lines = text.split("\n");

            var lineHeights = [];
            var maxWidth = 0;
            for (var i = 0; i < lines.length; i++) {
                var metrics = cx.measureText(lines[i]);
                lineHeights.push(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
                maxWidth = Math.max(maxWidth, metrics.width);
            }
            var totalHeight = lineHeights.reduce((a, b) => a + b, 0);

            var x0 = coords.x1;
            var y0 = coords.y1;
            var dx = 0, dy = 0;
            switch (anchor) {
                case "n": dx = -maxWidth / 2; dy = 0; break;
                case "ne": dx = -maxWidth; dy = 0; break;
                case "e": dx = -maxWidth; dy = -totalHeight / 2; break;
                case "se": dx = -maxWidth; dy = -totalHeight; break;
                case "s": dx = -maxWidth / 2; dy = -totalHeight; break;
                case "sw": dx = 0; dy = -totalHeight; break;
                case "w": dx = 0; dy = -totalHeight / 2; break;
                case "nw": dx = 0; dy = 0; break;
                case "center": default: dx = -maxWidth / 2; dy = -totalHeight / 2; break;
            }

            cx.save();
            cx.translate(x0, y0);
            cx.rotate(-angle * Math.PI / 180);

            var yOffset = 0;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var lineWidth = cx.measureText(line).width;
                var xLine = dx;
                if (justify === "center") xLine = dx + (maxWidth - lineWidth) / 2;
                else if (justify === "right") xLine = dx + (maxWidth - lineWidth);
                cx.fillText(line, xLine, dy + yOffset + lineHeights[i]);
                yOffset += lineHeights[i];
            }

            cx.restore();
        }
    });
};
create_text.co_kwargs = true;
$loc.create_text = new Sk.builtin.func(create_text);

		var create_rectangle = function(kwa, self, x1, y1, x2, y2) {
			var coords = {
				x1: Sk.ffi.remapToJs(x1),
				y1: Sk.ffi.remapToJs(y1),
				x2: Sk.ffi.remapToJs(x2),
				y2: Sk.ffi.remapToJs(y2),
			}

			var props = unpackKWA(kwa);

			return commonCanvasElement(self, {
				type: "rectangle",
				props: props,
				coords: coords,
				draw: function(canvas) {
					var cx = canvas.getContext('2d');
					applyStyles(props, cx);
					if (props.fill) {
						cx.fillStyle = getColor(Sk.ffi.remapToJs(props.fill));
					}
					if (props.outline) {
						cx.strokeStyle = getColor(Sk.ffi.remapToJs(props.outline));
					}
					if (props.width) {
						cx.lineWidth = Sk.ffi.remapToJs(props.width);
					}
					if (props.fill) {
						cx.fillRect(coords.x1, coords.y1, coords.x2 - coords.x1, coords.y2 - coords.y1);
					}
					cx.strokeRect(coords.x1, coords.y1, coords.x2 - coords.x1, coords.y2 - coords.y1);
				}
			});

		}
		create_rectangle.co_kwargs = true;
		$loc.create_rectangle = new Sk.builtin.func(create_rectangle);
		// create_image ---
	var _imageDecodeCache = {}; // ключ: data URL (props.image.toString()) → готовий HTMLImageElement
	var _imageDecodeCacheOrder = []; // порядок вставки ключів, для обмеження розміру кешу
	var _IMAGE_DECODE_CACHE_LIMIT = 200; // захист від необмеженого memory leak (напр. анімації, що щокадру створюють новий PhotoImage)
	var _imageDecodeCacheSet = function(key, value) {
		if (!(key in _imageDecodeCache)) {
			_imageDecodeCacheOrder.push(key);
			if (_imageDecodeCacheOrder.length > _IMAGE_DECODE_CACHE_LIMIT) {
				var oldest = _imageDecodeCacheOrder.shift();
				delete _imageDecodeCache[oldest];
			}
		}
		_imageDecodeCache[key] = value;
	};

	var create_image = function(kwa, self, x1, y1) {
		var coords = {
			x1: Sk.ffi.remapToJs(x1),
			y1: Sk.ffi.remapToJs(y1)
		}

		var props = unpackKWA(kwa);

		function computeOffset(img, anchorRaw) {
			var dx = 0, dy = 0;
			var anchor = "CENTER";
			if (anchorRaw) {
				anchor = anchorRaw.v.toUpperCase();
			}
			if (anchor == "N") { dx = -img.width / 2; dy = 0; }
			if (anchor == "S") { dx = -img.width / 2; dy = -img.height; }
			if (anchor == "W") { dx = 0; dy = -img.height / 2; }
			if (anchor == "E") { dx = -img.width; dy = -img.height / 2; }
			if (anchor == "CENTER") { dx = -img.width / 2; dy = -img.height / 2; }
			if (anchor == "NW") { dx = 0; dy = 0; }
			if (anchor == "NE") { dx = -img.width; dy = 0; }
			if (anchor == "SW") { dx = 0; dy = -img.height; }
			if (anchor == "SE") { dx = -img.width; dy = -img.height; }
			return { dx: dx, dy: dy };
		}

		return commonCanvasElement(self, {
			type: "image",
			props: props,
			coords: coords,
			draw: function(canvas) {
				var cx = canvas.getContext('2d');
				// props.image is a PhotoImage; use its stable $dataUrl as the decode-cache key
				var src = photoImageSrc(props.image);
				var cached = _imageDecodeCache[src];

				if (cached && cached.complete && cached.naturalWidth > 0) {
					var off = computeOffset(cached, props.anchor);
					cx.drawImage(cached, coords.x1 + off.dx, coords.y1 + off.dy);
					return;
				}

				// Not decoded yet — wait for onload and draw once ready; skip this frame
				if (!cached) {
					var img = new Image();
					img.onload = function() {
						_imageDecodeCacheSet(src, img);
						// Redraw on the canvas passed to draw(), regardless of any external render loop
						var cx2 = canvas.getContext('2d');
						var off2 = computeOffset(img, props.anchor);
						cx2.drawImage(img, coords.x1 + off2.dx, coords.y1 + off2.dy);
					};
					img.src = src;
					_imageDecodeCacheSet(src, img); // позначаємо як "у процесі", щоб не плодити нові Image() на кожен кадр
				}
			}
		});

	}
	create_image.co_kwargs = true;
	$loc.create_image = new Sk.builtin.func(create_image);

		var create_oval = function(kwa, self, x1, y1, x2, y2) {
			var coords = {
				x1: Sk.ffi.remapToJs(x1),
				y1: Sk.ffi.remapToJs(y1),
				x2: Sk.ffi.remapToJs(x2),
				y2: Sk.ffi.remapToJs(y2),
			}

			var props = unpackKWA(kwa);

			return commonCanvasElement(self, {
				type: "oval",
				props: props,
				coords: coords,
				draw: function(canvas) {
					var cx = canvas.getContext('2d');
					applyStyles(props, cx);
					if (props.fill) {
						cx.fillStyle = getColor(Sk.ffi.remapToJs(props.fill));
					}
					if (props.outline) {
						cx.strokeStyle = getColor(Sk.ffi.remapToJs(props.outline));
					}
					if (props.width) {
						cx.lineWidth = Sk.ffi.remapToJs(props.width);
					}
					cx.beginPath();
					var w = coords.x2 - coords.x1;
					var h = coords.y2 - coords.y1
					cx.ellipse(coords.x1 + (w / 2), coords.y1 + (h / 2), w / 2, h / 2, 0, 0, 2 * Math.PI);
					if (props.fill) {
						cx.fill();
					}
					cx.stroke();
				}
			});
		}
		create_oval.co_kwargs = true;
		$loc.create_oval = new Sk.builtin.func(create_oval);

		var create_arc = function(kwa, self, x1, y1, x2, y2) {
			var coords = {
				x1: Sk.ffi.remapToJs(x1),
				y1: Sk.ffi.remapToJs(y1),
				x2: Sk.ffi.remapToJs(x2),
				y2: Sk.ffi.remapToJs(y2),
			}

			var props = unpackKWA(kwa);

			return commonCanvasElement(self, {
				type: "arc",
				props: props,
				coords: coords,
				draw: function(canvas) {
					var cx = canvas.getContext('2d');
					var start = 2 * Math.PI - Sk.ffi.remapToJs(props.start) * Math.PI / 180;
					var extent = 2 * Math.PI - Sk.ffi.remapToJs(props.extent) * Math.PI / 180;
					var style = Sk.ffi.remapToJs(props.style);
					if (!props.style) {
						style = "pieslice"
					}

					applyStyles(props, cx);
					if (props.fill) {
						cx.fillStyle = getColor(Sk.ffi.remapToJs(props.fill));
					}
					if (props.outline) {
						cx.strokeStyle = getColor(Sk.ffi.remapToJs(props.outline));
					}
					if (props.width) {
						cx.lineWidth = Sk.ffi.remapToJs(props.width);
					}
					cx.beginPath();
					var w = coords.x2 - coords.x1;
					var h = coords.y2 - coords.y1;
					if (style == "pieslice") {
						cx.moveTo(coords.x1 + (w / 2), coords.y1 + (h / 2));
					}

					cx.ellipse(coords.x1 + (w / 2), coords.y1 + (h / 2), w / 2, h / 2, 0, start, start + extent, true);
					if (style == "pieslice") {
						cx.lineTo(coords.x1 + (w / 2), coords.y1 + (h / 2));
					}
					if (props.fill) {
						cx.fill();
					}
					if (style == "chord") {
						cx.closePath();
					}
					cx.stroke();

				}
			});
		}
		create_arc.co_kwargs = true;
		$loc.create_arc = new Sk.builtin.func(create_arc);

		var item_config = function(kwa, self, id) {
			var e = self.elements[Sk.ffi.remapToJs(id)];
			var newProps = unpackKWA(kwa);
			for (var prop in newProps) {
				e.props[prop] = newProps[prop];
			}
			self.onShow();
		};

		item_config.co_kwargs = true;
		$loc.itemconfig = new Sk.builtin.func(item_config);
		$loc.itemconfigure = new Sk.builtin.func(item_config);

	}, 'Canvas', [s.Widget]);

// Entry ---
	s.Entry = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		var getHtml = function(self) {
			var v = "";
			if (self.props.textvariable) {
				v = Sk.ffi.remapToJs(self.props.textvariable.value);
				registerVarWidget(self.props.textvariable, self.id);
			}
			return '<input type="text" id="tkinter_' + self.id + '" class="tk_charsized" style="text-align:right;" value="' + PythonIDE.sanitize(v) + '">';
		}

		var init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);

			self.update = function() {
				if (self.props.textvariable) {
					let v = Sk.ffi.remapToJs(self.props.textvariable.value);
					$('#tkinter_' + self.id).val(v);
				}
			}

			self.onShow = function() {
				$('#tkinter_' + self.id).off('change').on('change', function() {
					if (self.props.textvariable) {
						self.props.textvariable.value = Sk.ffi.remapToPy($(this).val());
					}
				});
			}
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.get = new Sk.builtin.func(self =>
			new Sk.builtin.str($('#tkinter_' + self.id).val())
		);

		$loc.focus = $loc.focus_set = new Sk.builtin.func(function(self) {
			$('#tkinter_' + self.id).focus();
		});

		$loc.insert = new Sk.builtin.func(function(self, index, string) {
			var i = Sk.ffi.remapToJs(index);
			var v = $('#tkinter_' + self.id).val();
			var s = Sk.ffi.remapToJs(string);
			if (i == "end") {
				$('#tkinter_' + self.id).val(v + s);
			} else {
				var before = v.substr(0, i);
				var after = v.substr(i);
				$('#tkinter_' + self.id).val(before + s + after);
			}
			if (self.props.textvariable) {
				self.props.textvariable.value = Sk.ffi.remapToPy($('#tkinter_' + self.id).val());
			}
		});

		$loc.delete_$rw$ = new Sk.builtin.func(function(self, first, last) {
			var val = $('#tkinter_' + self.id).val();
			var start = Sk.ffi.remapToJs(first);
			var end = Sk.ffi.remapToJs(last);
			if (end === 'end') end = val.length;
			$('#tkinter_' + self.id).val(val.substring(0, start) + val.substring(end));
			if (self.props.textvariable) {
				self.props.textvariable.value = Sk.ffi.remapToPy($('#tkinter_' + self.id).val());
			}
		});
	}, 'Entry', [s.Widget]);

// Scale ---
	s.Scale = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		var getHtml = function(self) {
			let min = 0;
			if (self.props.from_) {
				min = Sk.ffi.remapToJs(self.props.from_);
			}

			let max = 100;
			if (self.props.to) {
				max = Sk.ffi.remapToJs(self.props.to);
			}

			let step = 1;
			if (self.props.resolution) {
				step = Sk.ffi.remapToJs(self.props.resolution);
			}

			let orientation = "horizontal";
			if (self.props.orient) {
				orientation = Sk.ffi.remapToJs(self.props.orient);
			}

			let value = 0;
			if (self.props.variable) {
				if (typeof self.props.variable.value === "undefined") {
					self.props.variable.value = Sk.ffi.remapToPy(value);
				}
				value = Sk.ffi.remapToJs(self.props.variable.value);
				registerVarWidget(self.props.variable, self.id);
			}

			let html = `<input id="slider_${self.id}" type="range" min="${min}" max="${max}" value="${value}" step="${step}" orient="${orientation}" />`;
			return `<div id="tkinter_${self.id}" class="tk_pixelsized" style="margin:auto;">
                    <span id="slider_${self.id}_Value">${value}</span>
                    <div style="line-height:0px;margin:0px;"></div>
                    ${html}
                </div>`;
		};

		var init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);

			self.customCommandHandled = true; // command вже оброблено

			self.onShow = function() {
				self.sliderValue = document.getElementById(`slider_${self.id}_Value`);
				self.slider = document.getElementById(`slider_${self.id}`);

				if (!self.slider) return;

				self.sliderValue.innerHTML = self.slider.value;

				self.slider.oninput = function() {
					const val = parseFloat(self.slider.value);
					if (self.sliderValue) self.sliderValue.innerHTML = val;

					if (self.props.variable) {
						self.props.variable.value = Sk.ffi.remapToPy(val);
					}

					if (self.props.command) {
						const pyVal = Sk.ffi.remapToPy(val);
						Sk.misceval.callsimAsync(null, self.props.command, pyVal).catch((e) => {
							window.onerror(e.toString());
						});
					}
				};
			};

			self.update = function() {
				if (self.props.variable) {
					let v = Sk.ffi.remapToJs(self.props.variable.value);
					if (self.slider) self.slider.value = v;
					if (self.sliderValue) self.sliderValue.innerHTML = v;
				}
			};
		};

		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.get = new Sk.builtin.func(function(self) {
			if (!self.slider) return Sk.ffi.remapToPy(0);
			let val = self.slider.value;
			let num = Number(val);
			return Number.isInteger(num) ? Sk.ffi.remapToPy(parseInt(val)) : Sk.ffi.remapToPy(parseFloat(val));
		});

		$loc.set = new Sk.builtin.func(function(self, value) {
			let v = Sk.ffi.remapToJs(value);
			if (self.slider) self.slider.value = v;
			if (self.sliderValue) self.sliderValue.innerHTML = v;
			if (self.props.variable) {
				self.props.variable.value = Sk.ffi.remapToPy(Number(v));
			}
		});
	}, "Scale", [s.Widget]);

// Message ---
s.Message = new Sk.misceval.buildClass(s, function($gbl, $loc) {
	var getHtml = function(self) {
		var v = "";
		if (self.props.text) {
			v = Sk.ffi.remapToJs(self.props.text);
		}
		// tkinter.Message width= is in pixels (screen units), not character count
		if (!self.props.width) {
			self.props.width = 200; // px за замовчуванням
		}
		if (!self.props.justify) {
			self.props.justify = 'left';
		}
		if (self.props.textvariable) {
			v = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
			registerVarWidget(self.props.textvariable, self.id);
		}
		
		var widthPx = Sk.ffi.remapToJs(self.props.width);
		var justify = Sk.ffi.remapToJs(self.props.justify);
		
		// pre-wrap preserves \n and auto-wraps long lines to fit width; word-wrap/overflow-wrap break very long words
		var html = '<div id="tkinter_' + self.id + '" style="width:' + widthPx + 'px; white-space:pre-wrap; word-wrap:break-word; overflow-wrap:break-word; line-height:120%; text-align:' + justify + ';">' + PythonIDE.sanitize(v) + '</div>';
		return html;
	}
	
	var init = function(kwa, self, master) {
		self.update = function() {
			var v = "";
			if (self.props.text) {
				v = Sk.ffi.remapToJs(self.props.text);
			}
			if (self.props.textvariable) {
				v = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
			}
			$('#tkinter_' + self.id).text(Sk.ffi.remapToJs(v));
			self.props.text = v;
			
			// Update width and wrap rules when textvariable changes
			$('#tkinter_' + self.id).css({
				'width': Sk.ffi.remapToJs(self.props.width) + 'px',
				'white-space': 'pre-wrap',
				'word-wrap': 'break-word',
				'overflow-wrap': 'break-word'
			});
		}
		commonWidgetConstructor(kwa, self, master, getHtml);
	}
	init.co_kwargs = true;
	$loc.__init__ = new Sk.builtin.func(init);
}, 'Message', [s.Widget]);

// PhotoImage ---
// Determine MIME type from file extension for the data-URL
	var _photoImageMime = function(path) {
		var ext = ("" + path).split('.').pop().toLowerCase();
		var map = {
			png: "image/png", gif: "image/gif", jpg: "image/jpeg",
			jpeg: "image/jpeg", bmp: "image/bmp",
			ppm: "image/x-portable-pixmap", pgm: "image/x-portable-graymap"
		};
		return map[ext] || "image/png";
	};

	// Sk.__jsfs.read returns a raw binary string (1 char = 1 byte); base64-encode it for the data-URL
	var _binaryStringToBase64 = function(binStr) {
		if (typeof btoa === "function") {
			return btoa(binStr);
		}
		return Buffer.from(binStr, "binary").toString("base64");
	};

	// Synchronously read width/height from PNG/GIF/BMP headers so width()/height() work before <img> loads
	var _readImageSize = function(binStr) {
		var b = function(i) { return binStr.charCodeAt(i) & 0xFF; };
		try {
			if (binStr.substr(0, 8) === "\x89PNG\r\n\x1a\n") {
				var w = ((b(16) << 24) | (b(17) << 16) | (b(18) << 8) | b(19)) >>> 0;
				var h = ((b(20) << 24) | (b(21) << 16) | (b(22) << 8) | b(23)) >>> 0;
				return { width: w, height: h };
			}
			if (binStr.substr(0, 3) === "GIF") {
				var w2 = b(6) | (b(7) << 8);
				var h2 = b(8) | (b(9) << 8);
				return { width: w2, height: h2 };
			}
			if (b(0) === 0x42 && b(1) === 0x4D) { // "BM"
				var w3 = (b(18) | (b(19) << 8) | (b(20) << 16) | (b(21) << 24)) >>> 0;
				var h3raw = (b(22) | (b(23) << 8) | (b(24) << 16) | (b(25) << 24)) | 0;
				return { width: w3, height: Math.abs(h3raw) };
			}
		} catch (e) {
			// unknown/corrupt format — size stays unknown
		}
		return { width: 0, height: 0 };
	};

	s.PhotoImage = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		var init = function(kwa, self) {
			var props = unpackKWA(kwa);
			var path = Sk.ffi.remapToJs(props.file);
			var binData;
			try {
				binData = Sk.__jsfs.read(path);
			} catch (e) {
				binData = null;
			}
			if (binData === null || binData === undefined) {
				throw new Sk.builtin.RuntimeError('couldn\'t open "' + path + '": no such file or directory');
			}

			var dataUrl, rawBin;
			if (typeof binData === "string" && binData.substr(0, 5) === "data:") {
				// Sk.__jsfs already stored this file as a text data-URL; use it directly instead of re-encoding
				dataUrl = binData;
				var comma = binData.indexOf(",");
				var b64payload = comma >= 0 ? binData.substr(comma + 1) : "";
				try {
					rawBin = (typeof atob === "function")
						? atob(b64payload)
						: Buffer.from(b64payload, "base64").toString("binary");
				} catch (e2) {
					rawBin = "";
				}
			} else {
				rawBin = binData;
				dataUrl = "data:" + _photoImageMime(path) + ";base64," + _binaryStringToBase64(binData);
			}

			var size = _readImageSize(rawBin);
			self.$width = size.width;
			self.$height = size.height;
			self.$dataUrl = dataUrl;
		};
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		// Implicit string conversion (Label/Canvas etc.) yields the data-URL
		$loc.__str__ = new Sk.builtin.func(function(self) {
			return new Sk.builtin.str(self.$dataUrl);
		});
		$loc.__repr__ = $loc.__str__;

		$loc.width = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_(self.$width);
		});
		$loc.height = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_(self.$height);
		});
		// No real pixel scaling (would need <canvas> decoding); return self unchanged so the call doesn't break
		$loc.subsample = new Sk.builtin.func(function(self) { return self; });
		$loc.zoom = new Sk.builtin.func(function(self) { return self; });
	}, 'PhotoImage', []);
// ================= MENU WIDGET HELPERS =================
var ensureMenuStyles = function() {
    if ($('#tkinter-menu-style').length) return;
    $('head').append(
        '<style id="tkinter-menu-style">' +
        '.tk-menu-bar { display: flex; background: #f0f0f0; border-bottom: 1px solid #ccc; width: 100%; box-sizing: border-box; position: relative; z-index: 1000; font-family: sans-serif; font-size: 10pt; }' +
        '.tk-menu-bar > .tk-menu-item { padding: 4px 8px; cursor: default; position: relative; user-select: none; }' +
        '.tk-menu-bar > .tk-menu-item:hover { background: #e0e0e0; }' +
        '.tk-menu-dropdown { display: none; position: absolute; top: 100%; left: 0; background: #fff; border: 1px solid #ccc; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); min-width: 150px; z-index: 1001; }' +
        '.tk-menu-bar > .tk-menu-item.tk-menu-open > .tk-menu-dropdown { display: block; }' +
        '.tk-menu-dropdown .tk-menu-item:hover > .tk-menu-dropdown { display: block; }' +
        '.tk-menu-dropdown .tk-menu-item { padding: 4px 20px; white-space: nowrap; }' +
        '.tk-menu-dropdown .tk-menu-item:hover { background: #0078d7; color: white; }' +
        '.tk-menu-separator { height: 1px; background: #ccc; margin: 2px 0; }' +
        '.tk-menu-tearoff { border-top: 2px dotted #999; background: transparent; margin: 2px 0; height: 0; }' +
        '</style>'
    );
};

function getMenuId(menuObj) {
    if (!window.__tkinter_menus) window.__tkinter_menus = [];
    var idx = window.__tkinter_menus.indexOf(menuObj);
    if (idx === -1) {
        idx = window.__tkinter_menus.length;
        window.__tkinter_menus.push(menuObj);
    }
    return idx;
}

function buildMenuHtml(menuObj, isTopLevel) {
    if (!menuObj || !menuObj.items) return '';
    var html = '';
    var mid = getMenuId(menuObj);
    
    // Tearoff separator
    if (menuObj.tearoff !== 0) {
        html += '<div class="tk-menu-separator tk-menu-tearoff"></div>';
    }

    for (var i = 0; i < menuObj.items.length; i++) {
        var item = menuObj.items[i];
        if (item.type === 'separator') {
            html += '<div class="tk-menu-separator"></div>';
        } else if (item.type === 'command') {
            var disabled = item.state === 'disabled' ? ' style="color:#999; pointer-events:none;"' : '';
            html += '<div class="tk-menu-item tk-menu-command" data-mid="' + mid + '" data-idx="' + i + '"' + disabled + '>' + PythonIDE.sanitize(item.label) + '</div>';
        } else if (item.type === 'cascade') {
            var arrow = isTopLevel ? '' : ' &#9658;';
            html += '<div class="tk-menu-item tk-menu-cascade" data-mid="' + mid + '" data-idx="' + i + '">' + PythonIDE.sanitize(item.label) + arrow;
            if (item.menu) {
                html += '<div class="tk-menu-dropdown">' + buildMenuHtml(item.menu, false) + '</div>';
            }
            html += '</div>';
        } else if (item.type === 'checkbutton') {
            var checked = false;
            if (item.variable) {
                var v = Sk.ffi.remapToJs(item.variable.value);
                checked = (v === item.onvalue);
            }
            var mark = checked ? '&#10004; ' : '&nbsp;&nbsp;&nbsp;';
            html += '<div class="tk-menu-item tk-menu-command" data-mid="' + mid + '" data-idx="' + i + '">' + mark + PythonIDE.sanitize(item.label) + '</div>';
        } else if (item.type === 'radiobutton') {
            var checkedR = false;
            if (item.variable) {
                var vR = Sk.ffi.remapToJs(item.variable.value);
                checkedR = (vR === item.value);
            }
            var markR = checkedR ? '&#9679; ' : '&nbsp;&nbsp;&nbsp;';
            html += '<div class="tk-menu-item tk-menu-command" data-mid="' + mid + '" data-idx="' + i + '">' + markR + PythonIDE.sanitize(item.label) + '</div>';
        }
    }
    return html;
}

function renderMenuBar(root, menuObj) {
    var rootId = root.id;
    var menuBarId = 'tk-menu-bar-' + rootId;
    var $root = $('#tkinter_' + rootId);
    $root.find('> .tk-menu-bar').remove();
    
    if (menuObj && menuObj.items) {
        var menuHtml = '<div class="tk-menu-bar" id="' + menuBarId + '">' + buildMenuHtml(menuObj, true) + '</div>';
        $root.prepend(menuHtml);
        menuObj._attachedRoot = root;
    }
}

// Toggle top-level menu-bar dropdowns by click (not hover)
$(document).off('click.tkMenuBarToggle', '.tk-menu-bar > .tk-menu-item').on('click.tkMenuBarToggle', '.tk-menu-bar > .tk-menu-item', function(e) {
    e.stopPropagation();
    var $item = $(this);
    var wasOpen = $item.hasClass('tk-menu-open');
    $item.closest('.tk-menu-bar').find('> .tk-menu-item').removeClass('tk-menu-open');
    if (!wasOpen) {
        $item.addClass('tk-menu-open');
    }
});

// Click anywhere outside closes any open top-level menu
$(document).off('click.tkMenuBarClose').on('click.tkMenuBarClose', function() {
    $('.tk-menu-bar > .tk-menu-item').removeClass('tk-menu-open');
});

// Global click handler for menu items
$(document).off('click.tkMenuCommand', '.tk-menu-command').on('click.tkMenuCommand', '.tk-menu-command', function(e) {
    e.stopPropagation();
    var $item = $(this);
    var mid = $item.data('mid');
    var idx = $item.data('idx');
    var menuObj = window.__tkinter_menus ? window.__tkinter_menus[mid] : null;
    if (menuObj && menuObj.items && menuObj.items[idx]) {
        var item = menuObj.items[idx];
        if (item.type === 'command' && item.command) {
            Sk.misceval.callsimAsync(null, item.command).catch(function(err) { window.onerror(err); });
        } else if (item.type === 'checkbutton') {
            if (item.variable) {
                var curVal = Sk.ffi.remapToJs(item.variable.value);
                var newVal = (curVal === item.onvalue) ? item.offvalue : item.onvalue;
                item.variable.value = Sk.ffi.remapToPy(newVal);
                notifyVarWidgets(item.variable);
            }
            if (item.command) {
                Sk.misceval.callsimAsync(null, item.command).catch(function(err) { window.onerror(err); });
            }
            if (menuObj._attachedRoot) renderMenuBar(menuObj._attachedRoot, menuObj._attachedRoot.props.menu);
        } else if (item.type === 'radiobutton') {
            if (item.variable) {
                item.variable.value = Sk.ffi.remapToPy(item.value);
                notifyVarWidgets(item.variable);
            }
            if (item.command) {
                Sk.misceval.callsimAsync(null, item.command).catch(function(err) { window.onerror(err); });
            }
            if (menuObj._attachedRoot) renderMenuBar(menuObj._attachedRoot, menuObj._attachedRoot.props.menu);
        }
    }
    // Close the top-level menu after selecting an item
    $('.tk-menu-bar > .tk-menu-item').removeClass('tk-menu-open');
});
// ================= END MENU HELPERS =================
// Menu ---
s.Menu = new Sk.misceval.buildClass(s, function($gbl, $loc) {
    
    // 1. __init__
    var init = function(kwa, self, master) {
        self.master = master;
        self.props = unpackKWA(kwa);
        self.items = [];
        self.tearoff = self.props.tearoff !== undefined ? Sk.ffi.remapToJs(self.props.tearoff) : 1;
    };
    init.co_kwargs = true;
    $loc.__init__ = new Sk.builtin.func(init);

    // 2. add_command
    var add_command = function(kwa, self) {
        var props = unpackKWA(kwa);
        self.items.push({
            type: 'command',
            label: props.label ? Sk.ffi.remapToJs(props.label) : '',
            command: props.command,
            state: props.state ? Sk.ffi.remapToJs(props.state) : 'normal'
        });
    };
    add_command.co_kwargs = true;
    $loc.add_command = new Sk.builtin.func(add_command);

    // 3. add_cascade
    var add_cascade = function(kwa, self) {
        var props = unpackKWA(kwa);
        self.items.push({
            type: 'cascade',
            label: props.label ? Sk.ffi.remapToJs(props.label) : '',
            menu: props.menu,
            state: props.state ? Sk.ffi.remapToJs(props.state) : 'normal'
        });
    };
    add_cascade.co_kwargs = true;
    $loc.add_cascade = new Sk.builtin.func(add_cascade);

    // 4. add_separator (no kwargs, left as-is)
    $loc.add_separator = new Sk.builtin.func(function(self) {
        self.items.push({ type: 'separator' });
    });

    // 5. add_checkbutton
    var add_checkbutton = function(kwa, self) {
        var props = unpackKWA(kwa);
        self.items.push({
            type: 'checkbutton',
            label: props.label ? Sk.ffi.remapToJs(props.label) : '',
            variable: props.variable,
            onvalue: props.onvalue ? Sk.ffi.remapToJs(props.onvalue) : 1,
            offvalue: props.offvalue ? Sk.ffi.remapToJs(props.offvalue) : 0,
            command: props.command
        });
    };
    add_checkbutton.co_kwargs = true;
    $loc.add_checkbutton = new Sk.builtin.func(add_checkbutton);

    // 6. add_radiobutton
    var add_radiobutton = function(kwa, self) {
        var props = unpackKWA(kwa);
        self.items.push({
            type: 'radiobutton',
            label: props.label ? Sk.ffi.remapToJs(props.label) : '',
            variable: props.variable,
            value: props.value ? Sk.ffi.remapToJs(props.value) : '',
            command: props.command
        });
    };
    add_radiobutton.co_kwargs = true;
    $loc.add_radiobutton = new Sk.builtin.func(add_radiobutton);

    // 7. delete (no kwargs)
    $loc.delete_$rw$ = new Sk.builtin.func(function(self, index1, index2) {
        var i1 = Sk.ffi.remapToJs(index1);
        var i2 = index2 ? Sk.ffi.remapToJs(index2) : i1;
        if (i1 === 'all') {
            self.items = [];
        } else {
            self.items.splice(i1, i2 - i1 + 1);
        }
    });

    // 8. entryconfig
    var entryconfig = function(kwa, self, index) {
        var props = unpackKWA(kwa);
        var idx = Sk.ffi.remapToJs(index);
        if (self.items[idx]) {
            if (props.label) self.items[idx].label = Sk.ffi.remapToJs(props.label);
            if (props.command) self.items[idx].command = props.command;
            if (props.state) self.items[idx].state = Sk.ffi.remapToJs(props.state);
        }
    };
    entryconfig.co_kwargs = true;
    $loc.entryconfig = new Sk.builtin.func(entryconfig);

}, 'Menu', []);
// Label ---
	s.Label = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		// Build content (text + image), accounting for compound=
		var renderContent = function(self) {
			var vtxt = "";
			if (self.props.text) {
				vtxt = PythonIDE.sanitize(Sk.ffi.remapToJs(self.props.text));
			}
			if (self.props.textvariable) {
				vtxt = PythonIDE.sanitize("" + Sk.ffi.remapToJs(self.props.textvariable.value));
			}
			var vimg = "";
			if (self.props.image) {
				// props.image is a PhotoImage; use $dataUrl and set explicit pixel size so nested flex containers don't collapse it to 0
				var sz = photoImageSize(self.props.image);
				var imgStyle = "display:block;";
				if (sz) {
					imgStyle += "width:" + sz.width + "px;height:" + sz.height + "px;";
				} else {
					imgStyle += "max-width:100%;";
				}
				vimg = '<img src="' + photoImageSrc(self.props.image) + '" style="' + imgStyle + '">';
			}
			if (!vimg) {
				return vtxt;
			}
			if (!vtxt) {
				return vimg;
			}
			var comp = self.props.compound ? Sk.ffi.remapToJs(self.props.compound) : "top";
			// top/bottom stack image and text via their own column-flex, since <br> is ignored inside a flex container
			switch (comp) {
				case "bottom": return '<div style="display:flex;flex-direction:column;align-items:center;">' + vtxt + vimg + '</div>';
				case "left":   return vimg + vtxt;
				case "right":  return vtxt + vimg;
				case "center": return '<div style="position:relative">' + vimg + vtxt + '</div>';
				case "top":
				default:       return '<div style="display:flex;flex-direction:column;align-items:center;">' + vimg + vtxt + '</div>';
			}
		}
		// Resolve flex justify-content from anchor (priority, like real tkinter.Label) or justify; default center
		var resolveJustifyContent = function(self) {
			var align = "center";
			if (self.props.anchor) {
				align = Sk.ffi.remapToJs(self.props.anchor);
			} else if (self.props.justify) {
				align = Sk.ffi.remapToJs(self.props.justify);
			}
			if (align === "w" || align === "nw" || align === "sw" || align === "left") {
				return "flex-start";
			}
			if (align === "e" || align === "ne" || align === "se" || align === "right") {
				return "flex-end";
			}
			return "center";
		};
		// Size the container to the image and prevent flex-shrink so it isn't squeezed out by sibling sections
		var labelSizeStyle = function(self) {
			if (!self.props.image) {
				return "";
			}
			var sz = photoImageSize(self.props.image);
			if (!sz) {
				return "flex-shrink:0;";
			}
			return "width:" + sz.width + "px;height:" + sz.height + "px;flex-shrink:0;";
		};
		var getHtml = function(self) {
			var v = "";
			if (self.props.text) {
				v = Sk.ffi.remapToJs(self.props.text);
			}
			txtwidth = v.length;
			// Don't shrink Label to 0 chars when only an image is set; check width===undefined, not falsy, so explicit width=0 isn't confused with unset
			if (self.props.width === undefined && !self.props.image) {
				self.props.width = txtwidth;
				// Mark this as auto-computed so it can be safely reset once an image is set
				self._autoWidth = true;
			}
			if (self.props.textvariable) {
				registerVarWidget(self.props.textvariable, self.id);
			}
			var html = '<div id="tkinter_' + self.id + '" class="tk_charsized" style="display:flex;align-items:center;justify-content:' + resolveJustifyContent(self) + ';' + labelSizeStyle(self) + '">' + renderContent(self) + '</div>';
			return html;
		}
		var init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);
			self.update = function() {
				var v = "";
				if (self.props.text) {
					v = Sk.ffi.remapToJs(self.props.text);
				}
				if (self.props.textvariable) {
					v = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
					self.props.text = new Sk.builtin.str(v);
				}
				$('#tkinter_' + self.id).html(renderContent(self));
				$('#tkinter_' + self.id).css('justify-content', resolveJustifyContent(self));

				// Size the container to the image once one appears (e.g. via config(image=...)), instead of a stale char width or 'auto' collapsing in a flex row
				if (self.props.image) {
					self.props.width = undefined;
					self._autoWidth = false;
					var sz = photoImageSize(self.props.image);
					if (sz) {
						$('#tkinter_' + self.id).css({
							width: sz.width + 'px',
							height: sz.height + 'px',
							'flex-shrink': '0'
						});
					} else {
						$('#tkinter_' + self.id).css({ width: 'auto', height: 'auto', 'flex-shrink': '0' });
					}
				} else {
					if (self.props.width === 1) {
						self.props.width = v.length + 0;
					}
					if (self.props.width) {
						$('#tkinter_' + self.id).css('width', Sk.ffi.remapToJs(self.props.width) + 'ch');
					}
				}

				$('#tkinter_' + self.id).addClass("tk-label"); // виправлено: .classList не існує в jQuery-обгортці
			}
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);
	}, 'Label', [s.Widget]);

// Button ---
        s.Button = new Sk.misceval.buildClass(s, function($gbl, $loc) {
        
            var getHtml = function(self) {
                var disabled = false;
                if (self.props.state) {
                    disabled = Sk.ffi.remapToJs(self.props.state) == 'disabled';
                }
                var vtxt = "";
                if (self.props.text) {
                    vtxt = Sk.ffi.remapToJs(self.props.text);
                }
                if (self.props.textvariable) {
                    vtxt = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
                    registerVarWidget(self.props.textvariable, self.id);
                }
                if (vtxt === "") {
                    vtxt = "\u2000\u2000"; // blank button
                }
                var vimg = "";
                if (self.props.image) {
                    vimg = photoImageSizedImg(self.props.image);
                    if (vtxt == "\u2000\u2000") {
                        vtxt = "";
                    }
                }
        
                vtxt = vtxt + vimg;
                var html = '<button id="tkinter_' + self.id + '" class="tk_charsized"' + (disabled ? ' disabled' : '') + '>' + vtxt + '</button>';
                return html;
            }
        
            var init = function(kwa, self, master) {
                commonWidgetConstructor(kwa, self, master, getHtml);
        
                self.update = function() {
                    var v = "";
                    if (self.props.textvariable) {
                        v = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
                    } else if (self.props.text) {
                        v = Sk.ffi.remapToJs(self.props.text);
                    }
        
                    if (v === "") {
                        v = "\u2000\u2000";
                    }
        
                    var vimg = "";
                    if (self.props.image) {
                        vimg = '<img src="' + photoImageSrc(self.props.image) + '"/>';
                        if (v === "\u2000\u2000") {
                            v = "";
                        }
                    }
        
                    v = v + vimg;
                    $('#tkinter_' + self.id).html(v);
                };
            }
        
            init.co_kwargs = true;
            $loc.__init__ = new Sk.builtin.func(init);
        
        }, 'Button', [s.Widget]);
        
// Checkbutton ---
s.Checkbutton = new Sk.misceval.buildClass(s, function($gbl, $loc) {

    var getHtml = function(self) {
        self.props.justify = 'left';

        // onvalue / offvalue
        self.onval = 1;
        self.offval = 0;

        if (self.props.onvalue !== undefined) {
            self.onval = Sk.ffi.remapToJs(self.props.onvalue);
        }
        if (self.props.offvalue !== undefined) {
            self.offval = Sk.ffi.remapToJs(self.props.offvalue);
        }

        // label
        var label = "";
        if (self.props.text) {
            label = Sk.ffi.remapToJs(self.props.text);
        }
        if (self.props.textvariable) {
            label = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
            registerVarWidget(self.props.textvariable, self.id);
        }

        // initial checked state from variable
        var checked = false;
        if (self.props.variable) {
            registerVarWidget(self.props.variable, self.id);

            var v = Sk.ffi.remapToJs(self.props.variable.value);

            // if the variable hasn't been initialized yet
            if (v === '' || v === undefined) {
                self.props.variable.value = Sk.ffi.remapToPy(self.offval);
                v = self.offval;
            }

            checked = (v === self.onval);
        }

        var html =
            '<div id="tkinter_' + self.id + '" style="white-space:nowrap;">' +
                '<input type="checkbox"' + (checked ? ' checked' : '') + '>' +
                '<label id="l_' + self.id + '" style="white-space:nowrap;">' +
                    PythonIDE.sanitize(label) +
                '</label>' +
            '</div>';

        return html;
    };

    var init = function(kwa, self, master) {

        self.onShow = function() {
            $('#item_' + self.id).css({ 'margin-left': '0' });

            $('#tkinter_' + self.id + ' input').on('change', function() {
                var checked = $(this).prop('checked');

                if (self.props.variable) {
                    var value = checked ? self.onval : self.offval;
                    self.props.variable.value = Sk.ffi.remapToPy(value);                    
                }

                // command (як у tkinter)
                if (self.props.command) {
                    Sk.misceval.callsimAsync(null, self.props.command);
                }
            });
        };

        self.update = function() {
            // variable → checkbox
            if (self.props.variable) {
                var checked =
                    Sk.ffi.remapToJs(self.props.variable.value) === self.onval;
                $('#tkinter_' + self.id + ' input').prop('checked', checked);
            }

            // textvariable → label
            if (self.props.textvariable) {
                var v = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
                $('#l_' + self.id).text(v);
            }
        };

        commonWidgetConstructor(kwa, self, master, getHtml);
        self.hasLabel = true;
    };

    init.co_kwargs = true;
    $loc.__init__ = new Sk.builtin.func(init);

}, 'Checkbutton', [s.Widget]);


// Radiobutton ---
	s.Radiobutton = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		var getHtml = function(self) {
			self.props.justify = 'left';
			var label = "";
			if (self.props.text) {
				label = Sk.ffi.remapToJs(self.props.text);
			}
			if (self.props.textvariable) {
				label = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
				registerVarWidget(self.props.textvariable, self.id);
			}
			var value = "";
			if (self.props.value) {
				value = "" + Sk.ffi.remapToJs(self.props.value);
			}

			var name = "default";
			if (self.props.variable) {
				name = "PY_VAR" + self.props.variable.id;
			}

			if (self.props.var) {
				self.props.variable = self.props.var
			}

			var checked = false;
			if (self.props.variable) {
				registerVarWidget(self.props.variable, self.id);
				if (
					Sk.ffi.remapToJs(self.props.variable?.value) ===
					Sk.ffi.remapToJs(self.props.value)
				) {
					checked = true;
				}
			}
			var html = '<div id="tkinter_' + self.id + '" style="white-space:nowrap;"><input name="' + name + '" type="radio" ' + (checked ? ' checked' : '') + ' value="' + PythonIDE.sanitize(value) + '">' +
				'<label id="l_' + self.id + '" for="tkinter_' + self.id + '" style="white-space:nowrap;">' + PythonIDE.sanitize(label) + '</label></div>';
			return html;
		}

		var init = function(kwa, self, master) {

			self.onShow = function() {
				$('#item_' + self.id).css({
					'margin-left': '0'
				});

				$('#tkinter_' + self.id + ' input').click(function() {
					if (self.props.variable) {
						var val = $('#tkinter_' + self.id + ' input').val();
						self.props.variable.value = Sk.ffi.remapToPy(val);
					}
				});
			}

			self.update = function() {
				var checked = false;
				if (self.props.variable) {
					checked = Sk.ffi.remapToJs(self.props.variable.value) === Sk.ffi.remapToJs(self.props.value);
				}
				$('#tkinter_' + self.id + " input").prop('checked', checked);
				if (self.props.textvariable) {
					var text = "" + Sk.ffi.remapToJs(self.props.textvariable.value);
					$('#l_' + self.id).text(text);
				}
			}
			commonWidgetConstructor(kwa, self, master, getHtml);
			self.hasLabel = true; //LW.push(self.id);
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		$loc.set = new Sk.builtin.func(function(self, value) {
			self.props.value = Sk.ffi.remapToJs(value);
			$('#tkinter_' + self.id + ' input').prop('checked', value);
		});
	}, 'Radiobutton', [s.Widget]);

// Listbox ---
	s.Listbox = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		const getHtml = function(self) {
			const items = self.items || [];
			const widthChars = self.props.width || 20;
			const heightLines = self.props.height || 6;

			let html = `<select id="tkinter_${self.id}" multiple  class="tk_charsized" style="width: ${widthChars}ch; height: ${heightLines}em;">`;

			for (let i = 0; i < items.length; i++) {
				html += `<option value="${i}">${PythonIDE.sanitize(items[i])}</option>`;
			}
			const selectmode = self.props.selectmode ? Sk.ffi.remapToJs(self.props.selectmode) : "single";
			if (selectmode === "multiple" || selectmode === "extended") {
				html += " multiple";
			}
			html += `</select>`;
			return html;
		};

		const init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);
			self.items = [];

			// Support for listvariable
			if (self.props.listvariable) {
				const listVar = self.props.listvariable;
				registerVarWidget(listVar, self.id);

				const jsList = Sk.ffi.remapToJs(listVar.value);

				if (Array.isArray(jsList)) {
					self.items = jsList.map(item => item.toString());
				} else if (typeof jsList === "string") {
					self.items = jsList.trim().length > 0 ? jsList.trim().split(",") : [];
				} else {
					self.items = [];
				}

				listVar.linkedWidget = self;
			}

			self.onShow = function() {
				const el = $(`#tkinter_${self.id}`);
				el.off("change").on("change", function() {
					if (self.props.command) {
						Sk.misceval.callsimAsync(null, self.props.command)
							.catch((e) => window.onerror(e.toString()));
					}
				});
			};

			self.insert = function(index, value) {
				const jsval = Sk.ffi.remapToJs(value);
				const el = $('#tkinter_' + self.id);

				let newOption = $('<option>', {
					text: jsval,
					value: self.items.length
				});

				if (index === "end" || (index.v && index.v === "end")) {
					el.append(newOption).trigger('change');
					self.items.push(jsval);
				} else {
					const pos = Sk.ffi.remapToJs(index);
					self.items.splice(pos, 0, jsval);
					if (pos >= el.children().length) {
						el.append(newOption);
					} else {
						el.children().eq(pos).before(newOption);
					}
					el.trigger('change');
				}
			};

			self.delete = function(first, last) {
				const el = $('#tkinter_' + self.id);
				const from = Sk.ffi.remapToJs(first);
				let to;

				if (typeof last === "undefined") {
					to = from;
				} else {
					to = (Sk.ffi.remapToJs(last) === "end") ?
						self.items.length - 1 :
						Sk.ffi.remapToJs(last);
				}

				if (from < 0 || from >= self.items.length || to < from) {
					throw new Sk.builtin.IndexError("listbox index out of range");
				}

				for (let i = to; i >= from; i--) {
					self.items.splice(i, 1);
					el.find(`option:eq(${i})`).remove();
				}
			};

			self.selection_set = function(self, first, last) {
				const el = document.getElementById("tkinter_" + self.id);
				const f = Sk.ffi.remapToJs(first);
				const l = Sk.ffi.remapToJs(last);

				for (let i = f; i <= l; i++) {
					if (el.options[i]) {
						el.options[i].selected = true;
					}
				}
			};

			self.selection_clear = function(self, first, last) {
				const el = document.getElementById("tkinter_" + self.id);
				const f = Sk.ffi.remapToJs(first);
				const l = Sk.ffi.remapToJs(last);

				for (let i = f; i <= l; i++) {
					el.options[i].selected = false;
				}
			};

        	self.get = function(index, ilast) {
                const first = Sk.ffi.remapToJs(index);
                let last;
            
                if (typeof ilast === "undefined") {
                    // Single index: return a string
                    if (first < 0 || first >= self.items.length) {
                        throw new Sk.builtin.IndexError("listbox index out of range");
                    }
                    return Sk.ffi.remapToPy(self.items[first]);
                }
            
                // Two indices: return a tuple
                last = (Sk.ffi.remapToJs(ilast) === "end") ?
                       self.items.length - 1 :
                       Sk.ffi.remapToJs(ilast);
            
                if (first < 0 || last >= self.items.length || first > last) {
                    throw new Sk.builtin.IndexError("listbox index out of range");
                }
            
                let result = [];
                for (let i = first; i <= last; i++) {
                    result.push(Sk.ffi.remapToPy(self.items[i]));
                }
            
                return new Sk.builtin.tuple(result);
            };

			self.size = function() {
				return new Sk.builtin.int_(self.items.length);
			};

			self.curselection = function() {
				let selected = [];
				$(`#tkinter_${self.id} option:selected`).each(function() {
					selected.push(new Sk.builtin.int_($(this).index()));
				});
				return new Sk.builtin.tuple(selected);
			};
		};
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);
		$loc.insert = new Sk.builtin.func((self, index, value) => self.insert(index, value));
		$loc.delete = new Sk.builtin.func((self, first, last) => self.delete(first, last));
		$loc.get = new Sk.builtin.func((self, index, ilast) => self.get(index, ilast));
		$loc.selection_set = new Sk.builtin.func((self, first, last) => self.selection_set(self, first, last));
		$loc.selection_clear = new Sk.builtin.func((self, first, last) => self.selection_clear(self, first, last));
		$loc.size = new Sk.builtin.func(self => self.size());
		$loc.curselection = new Sk.builtin.func(self => self.curselection());

	}, "Listbox", [s.Widget]);

// SpinBox ---
	s.Spinbox = new Sk.misceval.buildClass(s, function($gbl, $loc) {

		const getSpinData = function(self) {
			const inputVal = $('#spinner_input_' + self.id).val().replace(/_/g, "");
			let sv;

			if (self.props.values) {
				sv = new Sk.builtin.str(inputVal);
			} else {
				const numVal = Number(inputVal);
				sv = Number.isInteger(numVal) ?
					new Sk.builtin.int_(numVal) :
					new Sk.builtin.float_(numVal);
			}

			if (self.props.textvariable) {
				self.props.textvariable.value = sv;
			}

			return sv;
		};

		const getHtml = function(self) {
			let minVal = 0,
				maxVal = 100,
				step = 1;
			let startVal = 0;
			self._values = [];

			const useValues = !!self.props.values;

			if (useValues) {
				const vals = Sk.ffi.remapToJs(self.props.values);
				self._values = vals.map(val => String(val).replace(/_/g, ""));
				startVal = self._values[0] || "";
			} else {
				minVal = Sk.ffi.remapToJs(self.props.from_ || 0);
				maxVal = Sk.ffi.remapToJs(self.props.to || 100);
				step = Sk.ffi.remapToJs(self.props.increment || 1);
				startVal = minVal;
			}

			startVal = String(startVal).replace(/_/g, "");

			if (self.props.textvariable) {
				registerVarWidget(self.props.textvariable, self.id);
				self.props.textvariable.value = new Sk.builtin.str(startVal);
			}

			const id$ = `id='tkinter_${self.id}'`;
			const html = `
            <div ${id$} class="tk_charsized" style='margin: 5px 0; width: 120px; display: flex; gap: 4px; align-items: center; border: 1px solid gray; padding: 2px; border-radius: 4px; box-sizing: border-box;'>
                <input type='text' id='spinner_input_${self.id}' value='${startVal}' 
                    style='flex: 1 1 auto; min-width: 0; width: auto; color: black; border: none; outline: none;'>
                <div style='display: flex; flex-direction: column; gap: 0px;'>
                    <button id='spinner_up_${self.id}' style='height: 10px; font-size: 8px;padding: 0;'>▲</button>
                    <button id='spinner_down_${self.id}' style='height: 10px; font-size: 8px;padding: 0;'>▼</button>
                </div>
            </div>
        `;

			return html;
		};

		const init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);

			self.onShow = function() {
				const $input = $('#spinner_input_' + self.id);
				const $up = $('#spinner_up_' + self.id);
				const $down = $('#spinner_down_' + self.id);

				$input.change(function() {
					getSpinData(self);
				});

				if (self.props.values) {
					let index = 0;
					const updateInput = () => {
						const val = self._values[index];
						$input.val(val);
						if (self.props.textvariable) {
							self.props.textvariable.value = new Sk.builtin.str(val);
						}
					};
					$up.click(() => {
						index = (index + 1) % self._values.length;
						updateInput();
					});
					$down.click(() => {
						index = (index - 1 + self._values.length) % self._values.length;
						updateInput();
					});
				} else {
					let val = Sk.ffi.remapToJs(self.props.from_ || 0);
					const minVal = Sk.ffi.remapToJs(self.props.from_ || 0);
					const maxVal = Sk.ffi.remapToJs(self.props.to || 100);
					const step = Sk.ffi.remapToJs(self.props.increment || 1);

					const updateInput = () => {
						$input.val(val);
						if (self.props.textvariable) {
							self.props.textvariable.value = new Sk.builtin.int_(val);
						}
					};

					$up.click(() => {
						val = Math.min(val + step, maxVal);
						updateInput();
					});
					$down.click(() => {
						val = Math.max(val - step, minVal);
						updateInput();
					});
				}
			};
		};

		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);
		$loc.get = new Sk.builtin.func(function(self) {
			return getSpinData(self);
		});

	}, 'Spinbox', [s.Widget]);



// Frame ---
	s.Frame = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		var getHtml = function(self) {
			var width = 200;
			var height = 100;
			if (self.props.width) {
				width = Sk.ffi.remapToJs(self.props.width);
			} else {
				self.props.width = width
			}

			if (self.props.height) {
				height = Sk.ffi.remapToJs(self.props.height);
			} else {
				self.props.height = height
			}

			// overflow:hidden keeps children from spilling out when content is wider than Frame's fixed size (no pack_propagate here)
			return '<div id="tkinter_' + self.id + '" class="tk_pixelsized tk-frame" style="margin:auto;width:' + width + 'px; height:' + height + 'px; overflow:hidden;"></div>';
		}

		var init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);

			// Record whether width/height were passed explicitly, before getHtml() fills in the 200x100 defaults
			self._hasExplicitWidth = self.props.width !== undefined && self.props.width !== null;
			self._hasExplicitHeight = self.props.height !== undefined && self.props.height !== null;

			// pack_propagate(True) default: Frame sizes itself to content unless width/height were passed explicitly, in which case size stays fixed
			self._packPropagate = (self._hasExplicitWidth || self._hasExplicitHeight) ? false : true;
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);


		$loc.__getattr__ = new Sk.builtin.func(function(self, name) {
			switch (Sk.ffi.remapToJs(name)) {
				case 'master':
					return self.master;
					break;
			};
		});

		$loc.mainloop = new Sk.builtin.func(function(self) {});
	}, 'Frame', [s.Widget]);

// Text ---
	s.Text = new Sk.misceval.buildClass(s, function($gbl, $loc) {

		function parseIndex(text, indexStr) {
			if (indexStr === 'end') {
				return text.length;
			}
			const [rowStr, colStr] = indexStr.split('.');
			const row = parseInt(rowStr, 10) - 1;
			const col = parseInt(colStr, 10);
			const lines = text.split('\n');

			let offset = 0;
			for (let i = 0; i < row && i < lines.length; i++) {
				offset += lines[i].length + 1; // +1 for '\n'
			}
			return offset + col;
		}

		var getHtml = function(self) {
			self.props.textarea = true;
			let rows = self.props.height || 10; // height в рядках
			let cols = self.props.width || 40; // width у символах

			// wrap= mirrors real Tk: "word" (default) breaks at word boundaries,
			// "char" breaks anywhere (even mid-word), "none" never wraps and scrolls horizontally instead
			let wrapMode = self.props.wrap ? Sk.ffi.remapToJs(self.props.wrap) : "word";
			let wrapAttr = "soft";
			let wrapStyle = "";
			if (wrapMode === "none") {
				wrapAttr = "off";
				wrapStyle = "white-space: pre; overflow-x: auto;";
			} else if (wrapMode === "char") {
				wrapStyle = "word-break: break-all; overflow-wrap: break-word;";
			}

			return `<textarea id="tkinter_${self.id}" class="tk_charsized" rows="${rows}" cols="${cols}" wrap="${wrapAttr}" style="resize:none; ${wrapStyle}"></textarea>`;
		}

		const init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);

			// Real Tk lets you insert()/delete()/get() before the widget is ever packed/gridded/
			// placed — content and layout are independent. Here the <textarea> only enters the
			// DOM once a geometry manager call runs commonDisplay()/getHtml(), so before that,
			// $('#tkinter_'+id) matches nothing and .val() returns undefined. This buffer holds
			// the text in the meantime; onShow() (called by commonDisplay right after the
			// <textarea> is appended) flushes it into the real DOM element.
			self._textBuffer = '';
			self.onShow = function() {
				$('#tkinter_' + self.id).val(self._textBuffer);
			};
		};
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		// Widget may not be mounted yet (see comment in init above) — read/write the buffer in that case
		function currentText(self, $el) {
			return $el.length ? $el.val() : (self._textBuffer || '');
		}
		function setCurrentText(self, $el, newVal) {
			if ($el.length) { $el.val(newVal).focus(); }
			else { self._textBuffer = newVal; }
		}

		// Get the current text value
		$loc.get = new Sk.builtin.func(function(self) {
			return new Sk.builtin.str(currentText(self, $('#tkinter_' + self.id)));
		});

		// Focus the text widget
		$loc.focus = new Sk.builtin.func(function(self) {
			$('#tkinter_' + self.id).focus();
		});

		// Real Tk indices are "row.col" strings, but Python conventionally passes them as a
		// float (e.g. txt.insert(1.0, ...)) — the real _tkinter C module converts that float
		// to a Tcl string like "1.0" before Tk ever sees it. Sk.ffi.remapToJs alone turns a
		// Python float 1.0 into the JS number 1 (dropping the ".0"), which then breaks any
		// code expecting a "row.col" string (e.g. indexStr.split('.')). This mirrors Tcl's
		// float-to-string conversion so int/float/str indices all end up as proper strings.
		function normalizeIndex(indexObj) {
			if (indexObj instanceof Sk.builtin.float_) {
				var v = indexObj.v;
				return Number.isInteger(v) ? (v + '.0') : String(v);
			}
			if (indexObj instanceof Sk.builtin.int_) {
				return Sk.ffi.remapToJs(indexObj) + '.0';
			}
			return Sk.ffi.remapToJs(indexObj); // already a str like "1.0", "end", "insert"
		}

		// Delete from index `first` to `last`
		$loc.delete_$rw$ = new Sk.builtin.func(function(self, first, last) {
			const $el = $('#tkinter_' + self.id);
			const val = currentText(self, $el);

			const start = parseIndex(val, normalizeIndex(first));
			let end = normalizeIndex(last);

			if (end === 'end') {
				end = val.length;
			} else {
				end = parseIndex(val, end);
			}

			const updated = val.slice(0, start) + val.slice(end);
			setCurrentText(self, $el, updated);
		});

		// Insert `newVal` at position `pos`
		$loc.insert = new Sk.builtin.func(function(self, pos, newVal) {
			const $el = $('#tkinter_' + self.id);
			const val = currentText(self, $el);
			let position = normalizeIndex(pos);
			newVal = Sk.ffi.remapToJs(newVal);

			if (position === 'end') {
				position = val.length;
			} else {
				position = parseIndex(val, position);
			}

			const updated = val.slice(0, position) + newVal + val.slice(position);
			setCurrentText(self, $el, updated);
		});

	}, "Text", [s.Widget]);


// TopLevel ---
	s.Toplevel = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		$loc.__init__ = new Sk.builtin.func(function(self) {

			self.tk_left = 0;
			self.tk_top = 0;
			self.props = {};
			self.id = idCount++;
			if (!firstRoot) firstRoot = self;
			s.lastCreatedWin = self;
			var html = '<div id="tkinter_' + self.id + '" class="tkinter" class="tk_pixelsized" title="Tk"></div>';
			PythonIDE.python.output(html);
			$('#tkinter_' + self.id).dialog({
				width: 200,
				height: 200,
				open: function(event, ui) {
					$(this).parent().find(".ui-dialog-titlebar").css({
						"background-color": "#4b42d6",
						"color": "white"
					});
				},
				close: function() {
					if (self.protocols && self.protocols['WM_DELETE_WINDOW']) {
						Sk.misceval.callsimAsync(null, self.protocols['WM_DELETE_WINDOW']).then(function success(r) {

						}, function fail(e) {
							window.onerror(e);
						});
					} else if (self.closeMainLoop) {
						self.closeMainLoop();
					}
				}
			}).parent().css({
				position: "fixed",
				'background-color': '#BBB',
				'border': '1px solid #550',
				'box-shadow': '0 8px 16px rgba(0, 0, 0, 0.4)',
				'font-size': '12pt'
			});
			$('#tkinter_' + self.id).dialog({
				position: {
					my: "center",
					at: "center",
					of: window,
					offset: "100 100" // зсув на 50px вправо і 50px вниз
				}
			});
		});

		$loc.destroy = new Sk.builtin.func(function(self) {
			$('#tkinter_' + self.id).remove();
			if (self.closeMainLoop) {
				self.closeMainLoop();
			}
		});

		$loc.protocol = new Sk.builtin.func(function(self, name, func) {
			var protoName = Sk.ffi.remapToJs(name);
			if (!self.protocols) {
				self.protocols = {};
			}
			self.protocols[protoName] = func;
		});

		$loc.attributes = new Sk.builtin.func(function(self, key, val) {});


		$loc.configure = new Sk.builtin.func(configure);
		$loc.config = new Sk.builtin.func(configure);

		$loc.title = new Sk.builtin.func(function(self, title) {

			$('#tkinter_' + self.id).dialog('option', 'title', PythonIDE.sanitize(Sk.ffi.remapToJs(title)));
		});

		$loc.quit = new Sk.builtin.func(function(self) {
			if (self.closeMainLoop) {
				self.closeMainLoop();
			}
		});

		$loc.mainloop = new Sk.builtin.func(function(self, pyData) {
			return PythonIDE.runAsync(function(resolve, reject) {
				self.closeMainLoop = function() {
					cleanup();
					resolve();
				}
			});
		});

		$loc.register = new Sk.builtin.func(function(self, func) {
			return func;
		});

		$loc.geometry = new Sk.builtin.func(function(self, geometry) {
			if (geometry) {
				var size = Sk.ffi.remapToJs(geometry).split("x");
				$('#tkinter_' + self.id).dialog('option', {
					width: size[0],
					height: size[1]
				});
			}

		});
	}, "Toplevel", [s.Widget]);

// Tk main class ---
	s.Tk = new Sk.misceval.buildClass(s, function($gbl, $loc) {

		$loc.update = new Sk.builtin.func(function(self) {});

		$loc.update_idletasks = new Sk.builtin.func(function(self) {});

		$loc.__init__ = new Sk.builtin.func(function(self) {
			self.tk_left = 0;
			self.tk_top = 0;
			self.props = {};

			self.id = idCount++;
			if (!firstRoot) firstRoot = self;
			s.lastCreatedWin = self;
			var html = '<div id="tkinter_' + self.id + '" class="tkinter" class="tk_pixelsized" title="Tk" ></div>';
			PythonIDE.python.output(html);

			$('#tkinter_' + self.id).dialog({
				width: 300,
				height: 300,
				open: function(event, ui) {
					$(this).parent().find(".ui-dialog-titlebar").css({
						"background-color": "#025a9a",
						"color": "white"
					});
				},
				close: function() {
					if (self.protocols && self.protocols['WM_DELETE_WINDOW']) {
						Sk.misceval.callsimAsync(null, self.protocols['WM_DELETE_WINDOW']).then(function success(r) {

						}, function fail(e) {
							window.onerror(e);
						});
					} else if (self.closeMainLoop) {
						self.closeMainLoop();
					}
				}
			}).css({
				padding: '0px'
			}).parent().css({
				position: "fixed",
				'background-color': '#CCC',
				'border': '1px solid #225',
				'box-shadow': '0 8px 16px rgba(0, 0, 0, 0.4)',
				'font-size': '11pt',
				'line-height': '2em'
			});
			self.props.width = 300;
			self.props.height = 300;
			$('#tkinter_' + self.id).dialog({
				position: {
					my: "center",
					at: "center",
					of: window
				}
			});

			self.tk_left = Math.ceil($('#tkinter_' + self.id).offset().left - $(window).scrollLeft());
			self.tk_top = Math.ceil($('#tkinter_' + self.id).offset().top - $(window).scrollTop());

		});

		$loc.winfo_screenwidth = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_(window.screen.width);
		});

		$loc.winfo_screenheight = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_(window.screen.height);
		});

		$loc.winfo_x = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_(self.tk_left);
		});

		$loc.winfo_y = new Sk.builtin.func(function(self) {
			return new Sk.builtin.int_(self.tk_top);
		});

		$loc.destroy = new Sk.builtin.func(function(self) {
			$('#tkinter_' + self.id).remove();
			if (self.closeMainLoop) {
				self.closeMainLoop();
			}
		});

		$loc.protocol = new Sk.builtin.func(function(self, name, func) {
			var protoName = Sk.ffi.remapToJs(name);
			if (!self.protocols) {
				self.protocols = {};
			}
			self.protocols[protoName] = func;
		});

		$loc.attributes = new Sk.builtin.func(function(self, key, val) {});

		$loc.configure = new Sk.builtin.func(configure);
		$loc.config = new Sk.builtin.func(configure);

		$loc.title = new Sk.builtin.func(function(self, title) {

			$('#tkinter_' + self.id).dialog('option', 'title', PythonIDE.sanitize(Sk.ffi.remapToJs(title)));
		});

		$loc.quit = new Sk.builtin.func(function(self) {
			if (self.closeMainLoop) {
				self.closeMainLoop();
			}
		});

		$loc.mainloop = new Sk.builtin.func(function(self, pyData) {
			return PythonIDE.runAsync(function(resolve, reject) {
				self.closeMainLoop = function() {
					cleanup();
					resolve();
				}
			});
		});

		$loc.register = new Sk.builtin.func(function(self, func) {
			return func;
		});

		$loc.geometry = new Sk.builtin.func(function(self, geometry) {
			if (geometry) {

				let txt2 = Sk.ffi.remapToJs(geometry);
				let w = window.innerWidth;
				let h = window.innerHeight;

				txt2 = txt2.replaceAll('x', ':');
				txt2 = txt2.replaceAll('+', ':+');
				txt2 = txt2.replaceAll('-', ':-');
				const v = txt2.split(':');

				if (v.length === 4) {
					x_pos = Number(v[2]);
					y_pos = Number(v[3]);
					if (x_pos < 0) {
						x_pos = w + x_pos - v[0];
					}
					if (y_pos < 0) {
						y_pos = h + y_pos - v[1];
					}

					$('#tkinter_' + self.id).dialog({
						position: {
							my: 'left top',
							at: 'left+' + x_pos + ' top+' + y_pos,
							of: window
						},
					});
					self.tk_left = x_pos;
					self.tk_top = y_pos;
				}

				$('#tkinter_' + self.id).dialog('option', {
					width: v[0],
					height: v[1]
				});
				self.props.width = v[0];
				self.props.height = v[1];

				$('#tkinter_' + self.id).dialog("option", "resizable", false);
			}
		});

	}, 'Tk', [s.Widget]);


	s.ttk = new Sk.builtin.module();
	var ttk = function(name) {
		var t = {
			// ttk aliases: forward to the tk variants for compatibility

			Button: s.Button,
			Checkbutton: s.Checkbutton,
			Radiobutton: s.Radiobutton,
			Label: s.Label,
			Entry: s.Entry,
			Frame: s.Frame,
			Scale: s.Scale,
			Spinbox: s.Spinbox
		};
// Combobox ---
        t.Combobox = new Sk.misceval.buildClass(t, function($gbl, $loc) {
        	var getHtml = function(self) {
        		var html = '<select id="tkinter_' + self.id + '" class="tk_charsized">';
        		if (self.props.values) {
        			var vals = Sk.ffi.remapToJs(self.props.values);
        			for (var i = 0; i < vals.length; i++) {
        				var val = PythonIDE.sanitize("" + vals[i]);
        				var selected = self.props.current && self.props.current == i;
        				html += '<option value="' + i + '"' + (selected ? ' selected' : '') + '>' + val + '</option>';
        			}
        		}
        		html += '</select>';
        		return html;
        	};
        
        	var init = function(kwa, self, master) {
        		commonWidgetConstructor(kwa, self, master, getHtml);
        
        		self.onShow = function() {
        			const select = $('#tkinter_' + self.id);
        			select.on('change', function() {
        				const selectedText = select.find("option:selected").text();
        				if (self.props.textvariable) {
        					self.props.textvariable.value = new Sk.builtin.str(selectedText);
        				}
        			});
        		};
        
        		self.update = function() {
        			if (self.props.textvariable) {
        				const value = Sk.ffi.remapToJs(self.props.textvariable.value);
        				const select = $('#tkinter_' + self.id);
        				select.find('option').each(function(index) {
        					if ($(this).text() === value) {
        						select.val(index);
        						self.props.current = index;
        						return false;
        					}
        				});
        			}
        		};
        
        		if (self.props.textvariable) {
        			registerVarWidget(self.props.textvariable, self.id);
        		}
        	};
        	init.co_kwargs = true;
        	$loc.__init__ = new Sk.builtin.func(init);
        
        	$loc.current = new Sk.builtin.func(function(self, item) {
        		var val = Sk.ffi.remapToJs(item);
        		$('#tkinter_' + self.id).val(val);
        		self.props.current = val;
        	});
        
        	$loc.set = new Sk.builtin.func(function(self, value) {
        		let target = Sk.ffi.remapToJs(value);
        		let select = $('#tkinter_' + self.id);
        		let found = false;
        
        		select.find('option').each(function(index) {
        			if ($(this).text() === target) {
        				select.val(index);
        				self.props.current = index;
        				found = true;
        				return false;
        			}
        		});
        
        		if (!found) {
        			let newIndex = select.children().length;
        			select.append('<option value="' + newIndex + '" selected>' + PythonIDE.sanitize(target) + '</option>');
        			self.props.current = newIndex;
        		}
        
        		if (self.props.textvariable) {
        			self.props.textvariable.value = new Sk.builtin.str(target);
        		}
        	});
        
        	$loc.get = new Sk.builtin.func(function(self) {
        		const value = $('#tkinter_' + self.id + ' option:selected').text();
        		return new Sk.builtin.str(value);
        	});
        
        }, 'Combobox', [s.Widget]);

// Separator ---
		t.Separator = new Sk.misceval.buildClass(t, function($gbl, $loc) {
			const getHtml = function(self) {
				let html = "";
				const id = `tkinter_${self.id}`;

				if (self.props.orient) {
					const orient = Sk.ffi.remapToJs(self.props.orient);
					if (orient === "vertical") {
						// Vertical line: a narrow bordered block
						html = `<div id="${id}" class="tk_pixelsized" style="display:inline-block; width:1px; height:100px; background-color:gray; margin:0 5px;"></div>`;
					} else {
						// Horizontal line
						html = `<hr id="${id}" class="tk_pixelsized" style="margin:5px 0;">`;
					}
				} else {
					// Default: horizontal
					html = `<hr id="${id}" class="tk_pixelsized" style="margin:5px 0;">`;
				}

				return html;
			};

			const init = function(kwa, self, master) {
				commonWidgetConstructor(kwa, self, master, getHtml);
			};
			init.co_kwargs = true;

			$loc.__init__ = new Sk.builtin.func(init);
		}, "Separator", [s.Widget]);


// Progressbar ---
		t.Progressbar = new Sk.misceval.buildClass(t, function($gbl, $loc) {
			const getHtml = function(self) {
				let value = 0;
				let maximum = 100;
				self._mode = self.props.mode ? Sk.ffi.remapToJs(self.props.mode) : "determinate";

				if (self.props.maximum) {
					maximum = Sk.ffi.remapToJs(self.props.maximum);
				}

				if (self.props.variable) {
					if (typeof self.props.variable.value === "undefined") {
						self.props.variable.value = Sk.ffi.remapToPy(value);
					}
					value = Sk.ffi.remapToJs(self.props.variable.value);
					registerVarWidget(self.props.variable, self.id);
				} else if (self.props.value) {
					value = Sk.ffi.remapToJs(self.props.value);
				}

				const isIndeterminate = self._mode === "indeterminate";
				// Render stopped (value=0) initially; without a value attribute, native <progress> auto-animates as indeterminate before .start() is called
				const attrs = isIndeterminate ?
					`max="${maximum}" value="0"` :
					`max="${maximum}" value="${value}"`;

				return `<progress id="tkinter_${self.id}" ${attrs} class="tk_pixelsized" style="height: 10px; width: 100%;"></progress>`;
			};

			const init = function(kwa, self, master) {
				commonWidgetConstructor(kwa, self, master, getHtml);

				self.update = function() {
					const el = document.getElementById("tkinter_" + self.id);
					if (!el || self._mode === "indeterminate") return;

					let v = 0;
					if (self.props.variable) {
						v = Sk.ffi.remapToJs(self.props.variable.value || Sk.ffi.remapToPy(0));
					} else if (self.props.value) {
						v = Sk.ffi.remapToJs(self.props.value);
					}
					el.value = v;
				};

				// indeterminate start
				self.start = function() {
					if (self._mode !== "indeterminate") return;
					const el = document.getElementById("tkinter_" + self.id);
					if (el) {
						el.removeAttribute("value");
					}
				};

				self.stop = function() {
					if (self._mode !== "indeterminate") return;
					const el = document.getElementById("tkinter_" + self.id);
					if (el) {
						el.setAttribute("value", "0");
					}
				};

				self.step = function(amount) {
					// No-op for indeterminate mode
				};

				setTimeout(() => {
					self.tkWidget = document.getElementById("tkinter_" + self.id);
				}, 0);
			};

			init.co_kwargs = true;
			$loc.__init__ = new Sk.builtin.func(init);

			$loc.__setitem__ = new Sk.builtin.func(function(self, key, value) {
				key = Sk.ffi.remapToJs(key);
				if (key === "value") {
					if (self.props.variable) {
						self.props.variable.value = value;
					} else {
						self.props.value = value;
					}
					self.update();
				}
				return Sk.builtin.none.none$;
			});

			$loc.__getitem__ = new Sk.builtin.func(function(self, key) {
				key = Sk.ffi.remapToJs(key);
				if (key === "value") {
					if (self.props.variable) {
						return self.props.variable.value;
					} else {
						return self.props.value || Sk.ffi.remapToPy(0);
					}
				}
				return Sk.builtin.none.none$;
			});

			// start/stop/step methods
			$loc.start = new Sk.builtin.func(function(self) {
				self.start();
				return Sk.builtin.none.none$;
			});

			$loc.stop = new Sk.builtin.func(function(self) {
				self.stop();
				return Sk.builtin.none.none$;
			});

			$loc.step = new Sk.builtin.func(function(self, inc) {
				self.step(inc);
				return Sk.builtin.none.none$;
			});

			$loc.update = new Sk.builtin.func(function(self) {
				self.update();
				return Sk.builtin.none.none$;
			});

		}, 'Progressbar', [s.Widget]);
// Treeview ---
var ensureTreeviewStyles = function() {
	if ($('#tkinter-treeview-style').length) return;
	$('head').append(
		'<style id="tkinter-treeview-style">' +
		'.tk-treeview-container { overflow: auto; border: 1px solid #999; background: #fff; box-sizing: border-box; }' +
		'.tk-treeview-table { width: 100%; border-collapse: collapse; font-size: 10pt; font-family: sans-serif; }' +
		'.tk-treeview-table th { background: #f0f0f0; border: 1px solid #ccc; padding: 4px 6px; font-weight: bold; text-align: left; position: sticky; top: 0; z-index: 1; user-select: none; }' +
		'.tk-treeview-table td { padding: 2px 6px; border-bottom: 1px solid #f0f0f0; white-space: nowrap; text-align: left; }' +
		'.tk-treeview-row { cursor: default; }' +
		'.tk-treeview-row:hover { background-color: #e5f3ff; }' +
		'.tk-treeview-selected { background-color: #0078d7 !important; color: white !important; }' +
		'.tk-treeview-selected:hover { background-color: #0078d7 !important; }' +
		'.tk-treeview-arrow { cursor: pointer; margin-right: 4px; display: inline-block; width: 12px; text-align: center; font-size: 0.8em; }' +
		'</style>'
	);
};

t.Treeview = new Sk.misceval.buildClass(t, function($gbl, $loc) {
	var getHtml = function(self) {
		ensureTreeviewStyles();
		var heightPx = (self.props.height ? Sk.ffi.remapToJs(self.props.height) : 10) * 20 + 30;
		// Treeview's height is a fixed row count (like real Tk), not something derived from
		// content — tell the pack layout to always use this exact pixel height rather than
		// trying to measure it from however many rows happen to be rendered right now.
		self._fixedPackHeight = heightPx;
		return `<div id="tkinter_${self.id}" class="tk_pixelsized tk-treeview-container" style="height:${heightPx}px;">
					<table class="tk-treeview-table">
						<thead><tr id="tkinter_${self.id}_head"></tr></thead>
						<tbody id="tkinter_${self.id}_body"></tbody>
					</table>
				</div>`;
	};

	// Internal JS helpers (plain functions, not Sk.builtin.func)
	var renderHead_js = function(self) {
		if (!self.headings) self.headings = {};
		if (!self.colOptions) self.colOptions = {};
		var $head = $('#tkinter_' + self.id + '_head');
		if (!$head.length) return;
		$head.empty();
		
		if (self.show && self.show.includes("tree")) {
			var hText = (self.headings["#0"] && self.headings["#0"].text) ? self.headings["#0"].text : "";
			$head.append(`<th style="min-width: 150px;">${PythonIDE.sanitize(hText)}</th>`);
		}
		
		if (self.columns) {
			for (var i = 0; i < self.columns.length; i++) {
				var colId = self.columns[i];
				var hText = (self.headings[colId] && self.headings[colId].text) ? self.headings[colId].text : colId;
				var anchor = (self.colOptions[colId] && self.colOptions[colId].anchor) || "w";
				var align = (anchor === "e") ? "right" : (anchor === "center") ? "center" : "left";
				var width = (self.colOptions[colId] && self.colOptions[colId].width) ? self.colOptions[colId].width + "px" : "auto";
				$head.append(`<th style="text-align:${align}; min-width:${width};">${PythonIDE.sanitize(hText)}</th>`);
			}
		}
	};

	var renderBody_js = function(self) {
		if (!self.items) self.items = {};
		if (!self.rootChildren) self.rootChildren = [];
		if (!self.selectionList) self.selectionList = [];
		
		var $body = $('#tkinter_' + self.id + '_body');
		if (!$body.length) return;
		$body.empty();
		
		function renderRows(parentId, depth) {
			var html = "";
			var children = parentId === "" ? self.rootChildren : (self.items[parentId] ? self.items[parentId].children : []);
			
			for (var i = 0; i < children.length; i++) {
				var iid = children[i];
				var item = self.items[iid];
				if (!item) continue;

				var isSelected = self.selectionList.indexOf(iid) !== -1;
				var rowClass = isSelected ? "tk-treeview-row tk-treeview-selected" : "tk-treeview-row";

				html += `<tr data-iid="${iid}" class="${rowClass}">`;

				if (self.show && self.show.includes("tree")) {
					var indent = depth * 20;
					var arrow = "&nbsp;&nbsp;";
					if (item.children && item.children.length > 0) {
						arrow = item.open ? "▼" : "▶";
					}
					html += `<td style="padding-left:${indent}px; text-align:left;">`;
					html += `<span class="tk-treeview-arrow" data-iid="${iid}">${arrow}</span>`;
					html += `<span class="tk-treeview-text">${PythonIDE.sanitize(item.text || "")}</span></td>`;
				}

				if (self.columns) {
					for (var c = 0; c < self.columns.length; c++) {
						var colId = self.columns[c];
						var val = (item.values && item.values[c] !== undefined) ? item.values[c] : "";
						var anchor = (self.colOptions && self.colOptions[colId] && self.colOptions[colId].anchor) || "w";
						var align = (anchor === "e") ? "right" : (anchor === "center") ? "center" : "left";
						html += `<td style="text-align:${align};">${PythonIDE.sanitize(String(val))}</td>`;
					}
				}
				html += `</tr>`;

				if (item.open && item.children && item.children.length > 0) {
					html += renderRows(iid, depth + 1);
				}
			}
			return html;
		}
		
		$body.html(renderRows("", 0));

		// Якщо сам Treeview уже був запакований через pack() до того, як у нього
		// з'явилися рядки (типовий порядок: tree.pack(); потім tree.insert(...)),
		// розмір контейнера був заміряний і "заморожений" ще коли рядків не було
		// (часто лишався лише заголовок). Перераховуємо розмір по предках зараз,
		// щоб контейнер підлаштувався під реальний вміст.
		if (s.__relayoutAncestors) { s.__relayoutAncestors(self); }
	};

	var bindEvents_js = function(self) {
		var $body = $('#tkinter_' + self.id + '_body');
		if (!$body.length) return;
		
		$body.off('click', 'tr').on('click', 'tr', function(e) {
			if ($(e.target).hasClass('tk-treeview-arrow')) return;
			var iid = $(this).data('iid');
			if (!iid) return;

			if (!self.selectionList) self.selectionList = [];
			var selectMode = self.selectMode || "browse";

			if (selectMode === "browse" || selectMode === "extended") {
				if (selectMode === "extended" && (e.ctrlKey || e.metaKey)) {
					var idx = self.selectionList.indexOf(iid);
					if (idx !== -1) self.selectionList.splice(idx, 1);
					else self.selectionList.push(iid);
				} else {
					self.selectionList = [iid];
				}
				self.focusItem = iid;
				renderBody_js(self);
				triggerSelectEvent_js(self);
			}
		});

		$body.off('click', '.tk-treeview-arrow').on('click', '.tk-treeview-arrow', function(e) {
			var iid = $(this).data('iid');
			if (self.items && self.items[iid]) {
				self.items[iid].open = !self.items[iid].open;
				renderBody_js(self);
			}
			e.stopPropagation();
		});
	};

	var triggerSelectEvent_js = function(self) {
		if (self.eventHandlers && self.eventHandlers['<<TreeviewSelect>>']) {
			var pyE = Sk.misceval.callsim(s.Event);
			pyE.props.widget = self;
			Sk.misceval.callsimAsync(null, self.eventHandlers['<<TreeviewSelect>>'], pyE).catch(function(err) { window.onerror(err); });
		}
	};

	// Init
	var init = function(kwa, self, master) {
		commonWidgetConstructor(kwa, self, master, getHtml);
		
		self.columns = [];
		self.items = {};
		self.rootChildren = [];
		self.headings = {};
		self.colOptions = {};
		self.selectionList = [];
		self.focusItem = null;
		self._iidCounter = 0;
		
		self.selectMode = self.props.selectmode ? Sk.ffi.remapToJs(self.props.selectmode) : "browse";
		self.show = self.props.show ? Sk.ffi.remapToJs(self.props.show) : "tree headings";
		
		syncColumnsFromProps_js(self);

		self.onShow = function() {
			renderHead_js(self);
			renderBody_js(self);
			bindEvents_js(self);
		};
	};
	init.co_kwargs = true;
	$loc.__init__ = new Sk.builtin.func(init);

	// self.columns must stay in sync with self.props.columns even when set AFTER construction (tree['columns']=... or config()), since the inherited __setitem__/configure only touch self.props
	var syncColumnsFromProps_js = function(self) {
		if (self.props.columns !== undefined) {
			var cols = Sk.ffi.remapToJs(self.props.columns);
			if (Array.isArray(cols)) self.columns = cols;
			else if (cols !== null && cols !== undefined) self.columns = [cols];
			else self.columns = [];
		}
		if (self.props.show !== undefined) {
			self.show = Sk.ffi.remapToJs(self.props.show);
		}
		if (self.props.selectmode !== undefined) {
			self.selectMode = Sk.ffi.remapToJs(self.props.selectmode);
		}
	};

	$loc.__setitem__ = new Sk.builtin.func(function(self, key, value) {
		if (!self.props) self.props = {};
		self.props[Sk.ffi.remapToJs(key)] = value;
		syncColumnsFromProps_js(self);
		renderHead_js(self);
		renderBody_js(self);
	});

	var treeviewConfigure = function(kwa, self) {
		if (!self.props) self.props = {};
		for (var i = 0; i < kwa.length; i += 2) {
			var key = Sk.ffi.remapToJs(kwa[i]);
			self.props[key] = kwa[i + 1];
		}
		syncColumnsFromProps_js(self);
		renderHead_js(self);
		renderBody_js(self);
	};
	treeviewConfigure.co_kwargs = true;
	$loc.configure = new Sk.builtin.func(treeviewConfigure);
	$loc.config = new Sk.builtin.func(treeviewConfigure);

	// Expose render methods to Python if needed
	$loc.renderHead = new Sk.builtin.func(function(self) { renderHead_js(self); });
	$loc.renderBody = new Sk.builtin.func(function(self) { renderBody_js(self); });
	$loc.bindEvents = new Sk.builtin.func(function(self) { bindEvents_js(self); });
	$loc.triggerSelectEvent = new Sk.builtin.func(function(self) { triggerSelectEvent_js(self); });

	// Public methods (self-initializing)
	
	var heading_func = function(kwa, self, column) {
		if (!self.headings) self.headings = {};
		var col = Sk.ffi.remapToJs(column);
		var props = unpackKWA(kwa);
		if (!self.headings[col]) self.headings[col] = {};
		if (props.text !== undefined) self.headings[col].text = Sk.ffi.remapToJs(props.text);
		if (props.anchor !== undefined) self.headings[col].anchor = Sk.ffi.remapToJs(props.anchor);
		renderHead_js(self);
	};
	heading_func.co_kwargs = true;
	$loc.heading = new Sk.builtin.func(heading_func);

	var column_func = function(kwa, self, column) {
		if (!self.colOptions) self.colOptions = {};
		var col = Sk.ffi.remapToJs(column);
		var props = unpackKWA(kwa);
		if (!self.colOptions[col]) self.colOptions[col] = {};
		if (props.width !== undefined) self.colOptions[col].width = Sk.ffi.remapToJs(props.width);
		if (props.anchor !== undefined) self.colOptions[col].anchor = Sk.ffi.remapToJs(props.anchor);
		renderHead_js(self);
		renderBody_js(self);
	};
	column_func.co_kwargs = true;
	$loc.column = new Sk.builtin.func(column_func);

	var insert_func = function(kwa, self, parent, index) {
		if (!self.items) self.items = {};
		if (!self.rootChildren) self.rootChildren = [];
		
		var props = unpackKWA(kwa);
		var parentId = Sk.ffi.remapToJs(parent);
		var iid = props.iid ? Sk.ffi.remapToJs(props.iid) : null;
		var text = props.text ? Sk.ffi.remapToJs(props.text) : "";
		var values = props.values ? Sk.ffi.remapToJs(props.values) : [];
		var open = props.open ? Sk.ffi.remapToJs(props.open) : false;

		if (!iid) {
			if (!self._iidCounter) self._iidCounter = 0;
			self._iidCounter++;
			iid = "I" + String(self._iidCounter).padStart(3, '0');
		}
		
		if (!Array.isArray(values)) values = [values];

		self.items[iid] = {
			parent: parentId,
			children: [],
			text: text,
			values: values,
			open: open
		};

		if (parentId === "" || parentId === null) {
			self.rootChildren.push(iid);
		} else {
			if (self.items[parentId]) {
				self.items[parentId].children.push(iid);
			}
		}
		
		renderBody_js(self);
		return new Sk.builtin.str(iid);
	};
	insert_func.co_kwargs = true;
	$loc.insert = new Sk.builtin.func(insert_func);

	var item_func = function(kwa, self, item, option) {
		if (!self.items) self.items = {};
		var iid = Sk.ffi.remapToJs(item);
		var props = unpackKWA(kwa);
		var data = self.items[iid];
		if (!data) return Sk.builtin.none.none$;

		function valuesToPy(values) {
			return new Sk.builtin.tuple((values || []).map(function(v) { return Sk.ffi.remapToPy(v); }));
		}

		// tree.item(iid, "values") / "text" / "open" / "parent" — запит ОДНОГО конкретного
		// поля позиційним аргументом, як у справжньому tkinter (Treeview.item(item, option=None, **kw)).
		// Раніше цей другий позиційний аргумент просто нічим не приймався і ігнорувався,
		// тому завжди повертався повний словник замість, наприклад, самого кортежу values.
		if (option !== undefined && Object.keys(props).length === 0) {
			var optKey = Sk.ffi.remapToJs(option);
			switch (optKey) {
				case "values": return valuesToPy(data.values);
				case "text": return new Sk.builtin.str(data.text || "");
				case "open": return new Sk.builtin.bool(!!data.open);
				case "parent": return new Sk.builtin.str(data.parent || "");
				default: return Sk.builtin.none.none$;
			}
		}

		if (Object.keys(props).length === 0) {
			var res = {
				"text": new Sk.builtin.str(data.text || ""),
				"values": valuesToPy(data.values),
				"open": new Sk.builtin.bool(!!data.open),
				"parent": new Sk.builtin.str(data.parent || "")
			};
			return Sk.ffi.remapToPy(res);
		}

		if (props.text !== undefined) data.text = Sk.ffi.remapToJs(props.text);
		if (props.values !== undefined) data.values = Sk.ffi.remapToJs(props.values);
		if (props.open !== undefined) data.open = Sk.ffi.remapToJs(props.open);
		
		renderBody_js(self);
		return Sk.builtin.none.none$;
	};
	item_func.co_kwargs = true;
	$loc.item = new Sk.builtin.func(item_func);

	$loc.set = new Sk.builtin.func(function(self, item, column, value) {
		if (!self.items) self.items = {};
		var iid = Sk.ffi.remapToJs(item);
		var data = self.items[iid];
		if (!data) return Sk.builtin.none.none$;

		if (column === undefined) {
			return Sk.ffi.remapToPy(data.values || []);
		}
		
		var col = Sk.ffi.remapToJs(column);
		var colIdx = self.columns ? self.columns.indexOf(col) : -1;
		
		if (value === undefined) {
			var val = (colIdx !== -1 && data.values && data.values[colIdx] !== undefined) ? data.values[colIdx] : "";
			return new Sk.builtin.str(String(val));
		} else {
			var jsVal = Sk.ffi.remapToJs(value);
			if (colIdx !== -1) {
				if (!data.values) data.values = [];
				data.values[colIdx] = jsVal;
			} else if (col === "#0") {
				data.text = jsVal;
			}
			renderBody_js(self);
			return Sk.builtin.none.none$;
		}
	});

	$loc.get_children = new Sk.builtin.func(function(self, item) {
		if (!self.items) self.items = {};
		if (!self.rootChildren) self.rootChildren = [];
		var parentId = item ? Sk.ffi.remapToJs(item) : "";
		var children = parentId === "" ? self.rootChildren : (self.items[parentId] ? self.items[parentId].children : []);
		var res = children.map(function(iid) { return new Sk.builtin.str(iid); });
		return new Sk.builtin.tuple(res);
	});

	$loc.selection = new Sk.builtin.func(function(self) {
		if (!self.selectionList) self.selectionList = [];
		var res = self.selectionList.map(function(iid) { return new Sk.builtin.str(iid); });
		return new Sk.builtin.tuple(res);
	});

	$loc.selection_set = new Sk.builtin.func(function(self) {
		self.selectionList = [];
		for (var i = 1; i < arguments.length; i++) {
			self.selectionList.push(Sk.ffi.remapToJs(arguments[i]));
		}
		renderBody_js(self);
		triggerSelectEvent_js(self);
	});

	$loc.selection_add = new Sk.builtin.func(function(self) {
		if (!self.selectionList) self.selectionList = [];
		for (var i = 1; i < arguments.length; i++) {
			var iid = Sk.ffi.remapToJs(arguments[i]);
			if (self.selectionList.indexOf(iid) === -1) {
				self.selectionList.push(iid);
			}
		}
		renderBody_js(self);
		triggerSelectEvent_js(self);
	});

	$loc.selection_remove = new Sk.builtin.func(function(self) {
		if (!self.selectionList) self.selectionList = [];
		for (var i = 1; i < arguments.length; i++) {
			var iid = Sk.ffi.remapToJs(arguments[i]);
			var idx = self.selectionList.indexOf(iid);
			if (idx !== -1) self.selectionList.splice(idx, 1);
		}
		renderBody_js(self);
		triggerSelectEvent_js(self);
	});

	$loc.focus = new Sk.builtin.func(function(self) {
		return new Sk.builtin.str(self.focusItem || "");
	});

	$loc.parent = new Sk.builtin.func(function(self, item) {
		if (!self.items) self.items = {};
		var iid = Sk.ffi.remapToJs(item);
		if (self.items[iid]) {
			return new Sk.builtin.str(self.items[iid].parent || "");
		}
		return Sk.builtin.none.none$;
	});

	$loc.delete_$rw$ = new Sk.builtin.func(function(self) {
		if (!self.items) self.items = {};
		if (!self.rootChildren) self.rootChildren = [];
		if (!self.selectionList) self.selectionList = [];

		function removeRecursive(iid) {
			if (self.items[iid]) {
				var children = self.items[iid].children.slice();
				for (var i = 0; i < children.length; i++) {
					removeRecursive(children[i]);
				}
				delete self.items[iid];
			}
		}

		for (var i = 1; i < arguments.length; i++) {
			var iid = Sk.ffi.remapToJs(arguments[i]);
			if (iid === "") {
				self.items = {};
				self.rootChildren = [];
				self.selectionList = [];
			} else {
				removeRecursive(iid);
				self.rootChildren = self.rootChildren.filter(function(c) { return c !== iid; });
				for (var key in self.items) {
					self.items[key].children = self.items[key].children.filter(function(c) { return c !== iid; });
				}
				var selIdx = self.selectionList.indexOf(iid);
				if (selIdx !== -1) self.selectionList.splice(selIdx, 1);
			}
		}
		renderBody_js(self);
	});
}, 'Treeview', [s.Widget]);
		return t;
	}

// tkinter.colorchooser ---
	s.colorchooser = new Sk.builtin.module();

	(function() {
		// Convert HEX to RGB
		function hexToRgb(hex) {
			const bigint = parseInt(hex.slice(1), 16);
			return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
		}

		// askcolor() implementation
		const askcolor = new Sk.builtin.func(function() {
			return Sk.misceval.promiseToSuspension(new Promise((resolve) => {
				const input = document.createElement('input');
				input.type = 'color';
				input.value = '#000000';
				input.style.position = 'fixed';
				input.style.left = '-1000px';
				document.body.appendChild(input);

				input.addEventListener('input', () => {
					const color = input.value;
					const rgb = hexToRgb(color);
					resolve(
						new Sk.builtin.tuple([
							new Sk.builtin.tuple(rgb.map(x => new Sk.builtin.int_(x))),
							new Sk.builtin.str(color)
						])
					);
					input.remove();
				}, {
					once: true
				});

				input.click();
			}));
		});

		// Register the function on the module
		s.colorchooser.$d = {
			askcolor: askcolor
		};

		// Register the module in sys.modules
		const modName = new Sk.builtin.str("tkinter.colorchooser");
		Sk.sysmodules.mp$ass_subscript(modName, s.colorchooser);
	})();

// tkinter.font stub ---
	var font_mod = new Sk.builtin.module({});
	font_mod.$d = new Sk.builtin.dict();

	font_mod.$d.mp$ass_subscript(
		new Sk.builtin.str("Font"),
		Sk.builtin.none.none$
	);

	s.font = font_mod;

	s.ttk.$d = new ttk("tkinter.ttk");
	const pyModName0 = new Sk.builtin.str("tkinter.ttk");
	Sk.sysmodules.mp$ass_subscript(pyModName0, s.ttk);

// message box ---
	s.messagebox = new Sk.builtin.module();
	var messagebox = function(name) {
		var m = {};

		function msgOutput(title, message, msg) {
			if (!title) title = new Sk.builtin.str("");
			if (!message) message = new Sk.builtin.str("");
			title = PythonIDE.sanitize("" + Sk.ffi.remapToJs(title));
			message = PythonIDE.sanitize("" + Sk.ffi.remapToJs(message)).replace(/\n/g, '<br>');
			return PythonIDE.runAsync(function(resolve, reject) {
				var html = '<div id="tkinter_show' + msg + '" title="' + title + '">' +
					'<p><img style="vertical-align:middle" src="./media/' + msg + '.png" width="48" height="48">' +
					'     ' + message +
					'</p><br><button id="btn_tkinter_dlg_ok" class="btn_tkinter_dlg">OK</button></div>';
				PythonIDE.python.output(html);
				$('#tkinter_show' + msg).dialog();
				$('.btn_tkinter_dlg').button().click(function(e) {
					var id = e.currentTarget.id.split("_")[3];
					resolve();
					$('#tkinter_show' + msg).remove();
				});
			});
		}
		m.showinfo = new Sk.builtin.func(function(title, message) {
			msgOutput(title, message, 'info');
		});

		m.showwarning = new Sk.builtin.func(function(title, message) {
			msgOutput(title, message, 'warning');
		});

		m.showerror = new Sk.builtin.func(function(title, message) {
			msgOutput(title, message, 'error');
		});

		m.askyesno = new Sk.builtin.func(function(title, message) {
			if (!title) title = new Sk.builtin.str("");
			if (!message) message = new Sk.builtin.str("");
			title = PythonIDE.sanitize("" + Sk.ffi.remapToJs(title));
			message = PythonIDE.sanitize("" + Sk.ffi.remapToJs(message)).replace(/\n/g, '<br>');

			return PythonIDE.runAsync(function(resolve, reject) {

				var html = '<div id="tkinter_askyesno" title="' + title + '">' +
					'<p><img style="vertical-align:middle" src="./media/yesno.png" width="48" height="48">' +
					'     ' + message +
					'<br><br><button id="btn_tkinter_dlg_yes" class="btn_tkinter_dlg">Yes</button>' +
					'<button id="btn_tkinter_dlg_no" class="btn_tkinter_dlg">No</button></div>';
				PythonIDE.python.output(html);
				$('#tkinter_askyesno').dialog();
				$('.btn_tkinter_dlg').button().click(function(e) {
					var id = e.currentTarget.id.split("_")[3];
					resolve(new Sk.builtin.bool(id == "yes"));
					$('#tkinter_askyesno').remove();
				});
			});
		});
		return m;
	};

	s.messagebox.$d = new messagebox("tkinter.messagebox");
	const pyModName1 = new Sk.builtin.str("tkinter.messagebox");
	Sk.sysmodules.mp$ass_subscript(pyModName1, s.messagebox);


// simpledialog ---
	s.simpledialog = new Sk.builtin.module();
	var simpledialog = function(name) {
		var m = {};

		function createPrompt(title, prompt, parseFunc, resolve) {
			const dialogId = "simpledialog_" + Math.random().toString(36).substring(2);
			const html = `
            <div id="${dialogId}" title="${title || 'Input'}" style="overflow-x: hidden;">
                <p>${prompt || ''}</p>
                <input type="text" id="${dialogId}_input" style="width:100%; margin-top:5px;" autofocus>
            </div>
        `;
			$("body").append(html);

			const $dialog = $("#" + dialogId);
			const $input = $("#" + dialogId + "_input");

			// Handle Enter key
			$input.on("keypress", function(event) {
				if (event.which === 13) { // Enter key code
					const value = $input.val();
					$dialog.dialog("close");
					$dialog.remove();
					try {
						resolve(parseFunc(value));
					} catch {
						resolve(Sk.builtin.none.none$);
					}
				}
			});

			$dialog.dialog({
				modal: true,
				buttons: {
					OK: function() {
						const value = $input.val();
						$(this).dialog("close");
						$(this).remove();
						try {
							resolve(parseFunc(value));
						} catch {
							resolve(Sk.builtin.none.none$);
						}
					},
					Cancel: function() {
						$(this).dialog("close");
						$(this).remove();
						resolve(Sk.builtin.none.none$);
					}
				},
				width: 250,
				open: function(event, ui) {
					$(this).parent().find(".ui-dialog-titlebar").css({
						"background-color": "#d63c00",
						"color": "white"
					});
				},
				close: function() {
					$(this).remove();
				}
			}).parent().css({
				position: "fixed",
				'background-color': '#EEE',
				'border': '1px solid #225',
				'box-shadow': '0 8px 16px rgba(0, 0, 0, 0.4)',
				'font-size': '11pt',
				'line-height': '1em'
			});
		}

		function makeAsyncDialog(parseFunc) {
			return new Sk.builtin.func(function(title, prompt) {
				Sk.builtin.pyCheckArgs("ask", arguments, 2, 2);
				title = Sk.ffi.remapToJs(title);
				prompt = Sk.ffi.remapToJs(prompt);

				return Sk.misceval.promiseToSuspension(
					new Promise((resolve) => {
						createPrompt(title, prompt, parseFunc, (result) => {
							resolve(Sk.ffi.remapToPy(result));
						});
					})
				);
			});
		}

		m.askstring = makeAsyncDialog((val) => val);
		m.askinteger = makeAsyncDialog((val) => {
			const i = parseInt(val);
			if (isNaN(i)) throw new Error("Invalid integer");
			return i;
		});
		m.askfloat = makeAsyncDialog((val) => {
			const f = parseFloat(val);
			if (isNaN(f)) throw new Error("Invalid float");
			return f;
		});

		return m;
	};

	s.simpledialog.$d = new simpledialog("tkinter.simpledialog");
	const pyModName3 = new Sk.builtin.str("tkinter.simpledialog");
	Sk.sysmodules.mp$ass_subscript(pyModName3, s.simpledialog);
// filedialog ---
// All dialogs below browse and persist to the browser's internal storage
// (the virtual filesystem in Sk.__jsfs, backed by localStorage — see jsfs.js).
// There is no import from the real OS filesystem; everything lives in the
// same storage that Python's open()/read()/write() use inside this environment.
s.filedialog = new Sk.builtin.module();
var filedialog = function(name) {
	var fd = {};

	// Helper to parse kwargs
	function parseKwargs(kwa) {
		var props = {};
		if (kwa && kwa.length) {
			for (var i = 0; i < kwa.length; i += 2) {
				props[Sk.ffi.remapToJs(kwa[i])] = kwa[i+1];
			}
		}
		return props;
	}

	// --- VFS path helpers ---
	function vfsPathJoin(base, name) {
		if (!base || base === '/') return '/' + name;
		return base.replace(/\/+$/, '') + '/' + name;
	}

	function vfsParentPath(path) {
		if (!path || path === '/') return '/';
		var parts = path.split('/').filter(Boolean);
		parts.pop();
		return '/' + parts.join('/');
	}

	// List folders/files at a VFS path; always safe (never throws)
	function vfsListDir(path) {
		var folders = [], files = [];
		try { folders = Sk.__jsfs.ls(path, 'folders') || []; } catch (e) { folders = []; }
		try { files = Sk.__jsfs.ls(path, 'files') || []; } catch (e) { files = []; }
		return { folders: folders, files: files };
	}

	// Make sure a path actually resolves to a folder in the VFS; else fall back to '/'
	function vfsNormalizeDir(path) {
		if (!path) return '/';
		try {
			if (Sk.__jsfs.type(path) === 'folder' || path === '/') return path;
		} catch (e) {}
		return '/';
	}

	// Turn a Python filetypes=[("Text files", "*.txt"), ...] argument into
	// a simple {exts: [...], hasAll: bool} filter descriptor
	function extractExtensions(filetypes) {
		var exts = [], hasAll = false;
		if (filetypes) {
			var types = Sk.ffi.remapToJs(filetypes);
			if (Array.isArray(types)) {
				types.forEach(function(t) {
					if (Array.isArray(t) && t.length > 1) {
						("" + t[1]).split(/\s+/).forEach(function(p) {
							p = p.trim();
							if (!p) return;
							if (p === '*' || p === '*.*') { hasAll = true; }
							else if (p.indexOf('*.') === 0) { exts.push(p.substring(1).toLowerCase()); }
							else if (p[0] === '.') { exts.push(p.toLowerCase()); }
						});
					}
				});
			}
		}
		return { exts: exts, hasAll: hasAll };
	}

	function fileMatchesFilter(filename, filterInfo) {
		if (!filterInfo || filterInfo.hasAll || filterInfo.exts.length === 0) return true;
		var lower = filename.toLowerCase();
		return filterInfo.exts.some(function(ext) { return lower.endsWith(ext); });
	}

	function escapeHtml(str) {
		return $('<div>').text(str).html();
	}

	// --- Shared file-browser dialog over the browser's internal storage (VFS) ---
	// mode: 'open' | 'open-multi' | 'save' | 'dir'
	// Resolves with a VFS path string ("" if cancelled), or an array of paths for 'open-multi'.
	function openVfsBrowserDialog(opts) {
		return new Promise(function(resolve) {
			var mode = opts.mode;
			var currentPath = vfsNormalizeDir(opts.initialDir || '/');
			var selectedFile = null;
			var selectedFiles = {};
			var dialogId = "filedialog_vfs_" + Math.random().toString(36).substring(2);

			var html = '' +
				'<div id="' + dialogId + '" title="' + escapeHtml(opts.title) + '" style="overflow:hidden;">' +
					'<div class="vfs-toolbar" style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">' +
						'<button type="button" class="vfs-up" title="Вгору, до батьківської теки">⬆ Вгору</button>' +
						'<span class="vfs-path" style="flex:1; font-family:monospace; font-size:10pt; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>' +
						'<button type="button" class="vfs-newfolder" title="Створити нову теку">📁+ Тека</button>' +
					'</div>' +
					'<div class="vfs-list" style="height:220px; overflow-y:auto; border:1px solid #ccc; background:#fff; padding:4px;"></div>' +
					'<div class="vfs-empty-msg" style="display:none; color:#888; font-style:italic; padding:10px; text-align:center;">Тут ще немає файлів</div>' +
					(mode === 'save' ?
						'<div style="margin-top:8px;">' +
							'<label style="font-size:10pt;">Ім&#39;я файлу:</label>' +
							'<input type="text" class="vfs-filename" style="width:100%; margin-top:3px; box-sizing:border-box;">' +
						'</div>' : '') +
				'</div>';

			$("body").append(html);
			var $dialog = $("#" + dialogId);
			var $list = $dialog.find(".vfs-list");
			var $pathLabel = $dialog.find(".vfs-path");
			var $filenameInput = $dialog.find(".vfs-filename");
			var $emptyMsg = $dialog.find(".vfs-empty-msg");

			if (mode === 'save') {
				$filenameInput.val(opts.initialFile || "untitled.txt");
			}

			function refresh() {
				$pathLabel.text(currentPath);
				$list.empty();
				selectedFile = null;

				var entries = vfsListDir(currentPath);
				var folders = entries.folders;
				var files = mode === 'dir' ? [] : entries.files.filter(function(f) {
					return fileMatchesFilter(f, opts.filterInfo);
				});

				$emptyMsg.toggle(folders.length === 0 && files.length === 0);

				folders.forEach(function(name) {
					var $row = $('<div class="vfs-entry vfs-folder">📁 ' + escapeHtml(name) + '</div>');
					$row.css({ padding: '4px 6px', cursor: 'pointer', 'border-radius': '3px' });
					$row.on('mouseenter', function() { if (!$(this).data('selected')) $(this).css('background', '#eef'); });
					$row.on('mouseleave', function() { if (!$(this).data('selected')) $(this).css('background', ''); });
					$row.on('click', function() {
						currentPath = vfsPathJoin(currentPath, name);
						refresh();
					});
					$list.append($row);
				});

				if (mode !== 'dir') {
					files.forEach(function(name) {
						var $row = $('<div class="vfs-entry vfs-file">📄 ' + escapeHtml(name) + '</div>');
						$row.css({ padding: '4px 6px', cursor: 'pointer', 'border-radius': '3px' });
						if (mode === 'open-multi' && selectedFiles[name]) {
							$row.data('selected', true).css('background', '#cde');
						}
						$row.on('mouseenter', function() { if (!$(this).data('selected')) $(this).css('background', '#eef'); });
						$row.on('mouseleave', function() { if (!$(this).data('selected')) $(this).css('background', ''); });
						$row.on('click', function() {
							if (mode === 'open-multi') {
								if (selectedFiles[name]) {
									delete selectedFiles[name];
									$row.data('selected', false).css('background', '');
								} else {
									selectedFiles[name] = true;
									$row.data('selected', true).css('background', '#cde');
								}
							} else {
								$list.find('.vfs-entry').data('selected', false).css('background', '');
								$row.data('selected', true).css('background', '#cde');
								selectedFile = name;
								if (mode === 'save') $filenameInput.val(name);
							}
						});
						$row.on('dblclick', function() {
							if (mode === 'open') {
								selectedFile = name;
								finish();
							}
						});
						$list.append($row);
					});
				}
			}

			function finish() {
				var result;
				if (mode === 'open') {
					if (!selectedFile) return;
					result = vfsPathJoin(currentPath, selectedFile);
				} else if (mode === 'open-multi') {
					var names = Object.keys(selectedFiles);
					if (names.length === 0) return;
					result = names.map(function(n) { return vfsPathJoin(currentPath, n); });
				} else if (mode === 'save') {
					var fname = ($filenameInput.val() || '').trim();
					if (!fname) return;
					result = fname.charAt(0) === '/' ? fname : vfsPathJoin(currentPath, fname);
				} else if (mode === 'dir') {
					result = currentPath;
				}
				$dialog.dialog("close");
				$dialog.remove();
				resolve(result);

			}

			function cancel() {
				$dialog.dialog("close");
				$dialog.remove();
				resolve(mode === 'open-multi' ? [] : "");
			}

			$dialog.find(".vfs-up").on('click', function() {
				currentPath = vfsParentPath(currentPath);
				refresh();
			});

			$dialog.find(".vfs-newfolder").on('click', function() {
				var name = prompt("Назва нової теки:");
				if (name) {
					try { Sk.__jsfs.mkdir(vfsPathJoin(currentPath, name)); } catch (e) {}
					refresh();
				}
			});
			if (mode === 'save') {
				$filenameInput.on('keypress', function(event) { if (event.which === 13) finish(); });
			}

			var buttons = {};
			buttons[opts.confirmLabel] = finish;
			buttons["Скасувати"] = cancel;

            $dialog.dialog({
                modal: true,
                width: 420,
                buttons: buttons,
                close: function() { $(this).remove(); }
            }).parent().css({
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                margin: 0,
                'background-color': '#EEE',
                'border': '1px solid #225',
                'box-shadow': '0 8px 16px rgba(0, 0, 0, 0.4)',
                'font-size': '11pt'
            });
			refresh();
		});
	}

	// --- askopenfilename ---
	var askopenfilename = function(kwa) {
		var props = parseKwargs(kwa);
		var initialDir = props.initialdir ? Sk.ffi.remapToJs(props.initialdir) : "/";
		var title = props.title ? Sk.ffi.remapToJs(props.title) : "Відкрити файл";
		var filterInfo = extractExtensions(props.filetypes);

		return Sk.misceval.promiseToSuspension(
			openVfsBrowserDialog({
				title: title,
				mode: 'open',
				initialDir: initialDir,
				filterInfo: filterInfo,
				confirmLabel: "Відкрити"
			}).then(function(path) {
				return new Sk.builtin.str(path || "");
			})
		);
	};
	askopenfilename.co_kwargs = true;
	fd.askopenfilename = new Sk.builtin.func(askopenfilename);

	// --- askopenfilenames ---
	var askopenfilenames = function(kwa) {
		var props = parseKwargs(kwa);
		var initialDir = props.initialdir ? Sk.ffi.remapToJs(props.initialdir) : "/";
		var title = props.title ? Sk.ffi.remapToJs(props.title) : "Відкрити файли";
		var filterInfo = extractExtensions(props.filetypes);

		return Sk.misceval.promiseToSuspension(
			openVfsBrowserDialog({
				title: title,
				mode: 'open-multi',
				initialDir: initialDir,
				filterInfo: filterInfo,
				confirmLabel: "Відкрити"
			}).then(function(paths) {
				return new Sk.builtin.tuple((paths || []).map(function(p) { return new Sk.builtin.str(p); }));
			})
		);
	};
	askopenfilenames.co_kwargs = true;
	fd.askopenfilenames = new Sk.builtin.func(askopenfilenames);

	// --- asksaveasfilename ---
	var asksaveasfilename = function(kwa) {
		var props = parseKwargs(kwa);
		var initialDir = props.initialdir ? Sk.ffi.remapToJs(props.initialdir) : "/";
		var initialFile = props.initialfile ? Sk.ffi.remapToJs(props.initialfile) : "untitled.txt";
		var title = props.title ? Sk.ffi.remapToJs(props.title) : "Зберегти файл як";
		var defaultExt = props.defaultextension ? Sk.ffi.remapToJs(props.defaultextension) : "";

		return Sk.misceval.promiseToSuspension(
			openVfsBrowserDialog({
				title: title,
				mode: 'save',
				initialDir: initialDir,
				initialFile: initialFile,
				confirmLabel: "Зберегти"
			}).then(function(path) {
				if (path && defaultExt && path.indexOf('.') === -1) {
					path += (defaultExt.charAt(0) === '.' ? defaultExt : '.' + defaultExt);
				}
				return new Sk.builtin.str(path || "");
			})
		);
	};
	asksaveasfilename.co_kwargs = true;
	fd.asksaveasfilename = new Sk.builtin.func(asksaveasfilename);

	// --- askdirectory ---
	var askdirectory = function(kwa) {
		var props = parseKwargs(kwa);
		var initialDir = props.initialdir ? Sk.ffi.remapToJs(props.initialdir) : "/";
		var title = props.title ? Sk.ffi.remapToJs(props.title) : "Оберіть теку";

		return Sk.misceval.promiseToSuspension(
			openVfsBrowserDialog({
				title: title,
				mode: 'dir',
				initialDir: initialDir,
				confirmLabel: "Обрати"
			}).then(function(path) {
				return new Sk.builtin.str(path || "");
			})
		);
	};
	askdirectory.co_kwargs = true;
	fd.askdirectory = new Sk.builtin.func(askdirectory);

	return fd;
};

s.filedialog.$d = new filedialog("tkinter.filedialog");
const pyModNameFD = new Sk.builtin.str("tkinter.filedialog");
Sk.sysmodules.mp$ass_subscript(pyModNameFD, s.filedialog);

	return s;
};
