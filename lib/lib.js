/**
 * Cyrillic-identifier preprocessor — workaround for a Skulpt tokenizer bug
 * (Skulpt's grammar is derived from Python 2.6.5, ASCII-only identifiers;
 * Cyrillic identifiers were bolted on afterwards and fail in some token
 * positions -> "SyntaxError: bad token T_OP"). This rewrites every
 * non-ASCII identifier to a stable ASCII alias BEFORE Skulpt tokenizes the
 * source, leaving string literals and comments untouched.
 */
function preprocessCyrillicIdentifiers(pythonSource) {
	var IDENT_START   = /[A-Za-z_\u0400-\u04FF\u0490\u0491]/;
	var IDENT_CONT    = /[A-Za-z0-9_\u0400-\u04FF\u0490\u0491]/;
	var HAS_NON_ASCII = /[^\x00-\x7F]/;

	var aliasMap = {};
	var reverseMap = {};
	var counter = 0;

	function aliasFor(name) {
		if (reverseMap[name]) return reverseMap[name];
		var alias = "_cyr" + (counter++) + "_";
		reverseMap[name] = alias;
		aliasMap[alias] = name;
		return alias;
	}

	var out = "";
	var i = 0;
	var n = pythonSource.length;

	while (i < n) {
		var ch = pythonSource[i];

		if (ch === "'" || ch === '"') {
			var quote = ch;
			var isTriple = pythonSource.slice(i, i + 3) === quote + quote + quote;
			var closer = isTriple ? quote + quote + quote : quote;
			var start = i;
			i += closer.length;
			while (i < n) {
				if (pythonSource[i] === "\\") { i += 2; continue; }
				if (pythonSource.slice(i, i + closer.length) === closer) { i += closer.length; break; }
				if (!isTriple && pythonSource[i] === "\n") break;
				i++;
			}
			out += pythonSource.slice(start, i);
			continue;
		}

		if (ch === "#") {
			var end = pythonSource.indexOf("\n", i);
			if (end === -1) end = n;
			out += pythonSource.slice(i, end);
			i = end;
			continue;
		}

		if (IDENT_START.test(ch)) {
			var j = i + 1;
			while (j < n && IDENT_CONT.test(pythonSource[j])) j++;
			var word = pythonSource.slice(i, j);
			out += HAS_NON_ASCII.test(word) ? aliasFor(word) : word;
			i = j;
			continue;
		}

		out += ch;
		i++;
	}

	return { code: out, aliasMap: aliasMap, reverseMap: reverseMap };
}

let userLang = navigator.language || navigator.userLanguage;
let selectedLang = userLang.startsWith('en') ? 'en' : 'uk';

var t;
var wscale =0.5;
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
var saveAs=saveAs||function(e){"use strict";if("undefined"==typeof navigator||!/MSIE [1-9]\./.test(navigator.userAgent)){var t=e.document,n=function(){return e.URL||e.webkitURL||e},o=t.createElementNS("http://www.w3.org/1999/xhtml","a"),r="download"in o,i=function(e){var t=new MouseEvent("click");e.dispatchEvent(t)},a=e.webkitRequestFileSystem,c=e.requestFileSystem||a||e.mozRequestFileSystem,u=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},f="application/octet-stream",s=0,d=500,l=function(t){var o=function(){"string"==typeof t?n().revokeObjectURL(t):t.remove()};e.chrome?o():setTimeout(o,d)},v=function(e,t,n){t=[].concat(t);for(var o=t.length;o--;){var r=e["on"+t[o]];if("function"==typeof r)try{r.call(e,n||e)}catch(i){u(i)}}},p=function(e){return/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)?new Blob(["﻿",e],{type:e.type}):e},w=function(t,u,d){d||(t=p(t));var w,y,m,S=this,h=t.type,O=!1,R=function(){v(S,"writestart progress write writeend".split(" "))},b=function(){if((O||!w)&&(w=n().createObjectURL(t)),y)y.location.href=w;else{var o=e.open(w,"_blank");void 0==o&&"undefined"!=typeof safari&&(e.location.href=w)}S.readyState=S.DONE,R(),l(w)},g=function(e){return function(){return S.readyState!==S.DONE?e.apply(this,arguments):void 0}},E={create:!0,exclusive:!1};return S.readyState=S.INIT,u||(u="download"),r?(w=n().createObjectURL(t),o.href=w,o.download=u,void setTimeout(function(){i(o),R(),l(w),S.readyState=S.DONE})):(e.chrome&&h&&h!==f&&(m=t.slice||t.webkitSlice,t=m.call(t,0,t.size,f),O=!0),a&&"download"!==u&&(u+=".download"),(h===f||a)&&(y=e),c?(s+=t.size,void c(e.TEMPORARY,s,g(function(e){e.root.getDirectory("saved",E,g(function(e){var n=function(){e.getFile(u,E,g(function(e){e.createWriter(g(function(n){n.onwriteend=function(t){y.location.href=e.toURL(),S.readyState=S.DONE,v(S,"writeend",t),l(e)},n.onerror=function(){var e=n.error;e.code!==e.ABORT_ERR&&b()},"writestart progress write abort".split(" ").forEach(function(e){n["on"+e]=S["on"+e]}),n.write(t),S.abort=function(){n.abort(),S.readyState=S.DONE},S.readyState=S.WRITING}),b)}),b)};e.getFile(u,{create:!1},g(function(e){e.remove(),n()}),g(function(e){e.code===e.NOT_FOUND_ERR?n():b()}))}),b)}),b)):void b())},y=w.prototype,m=function(e,t,n){return new w(e,t,n)};return"undefined"!=typeof navigator&&navigator.msSaveOrOpenBlob?function(e,t,n){return n||(e=p(e)),navigator.msSaveOrOpenBlob(e,t||"download")}:(y.abort=function(){var e=this;e.readyState=e.DONE,v(e,"abort")},y.readyState=y.INIT=0,y.WRITING=1,y.DONE=2,y.error=y.onwritestart=y.onprogress=y.onwrite=y.onabort=y.onerror=y.onwriteend=null,m)}}("undefined"!=typeof self&&self||"undefined"!=typeof window&&window||this.content);"undefined"!=typeof module&&module.exports?module.exports.saveAs=saveAs:"undefined"!=typeof define&&null!==define&&null!=define.amd&&define([],function(){return saveAs});
// Close dialog
$(document).on("click touchend", ".ui-dialog-titlebar-close", function(e) {
    e.preventDefault();
    
    // Знайти контейнер діалогу, до якого належить кнопка
    var dialogContainer = $(this).closest(".ui-dialog");

    // Знайти оригінальний DOM-елемент діалогу (всередині контейнера)
    var dialogId = dialogContainer.find(".ui-dialog-content").attr("id");

    // Закрити цей конкретний діалог
    $("#" + dialogId).dialog("close");
});
// Main PythonIDE object
var PythonIDE = {
	updateConsoleSize: function() {
		var h = $('#output').height() - $('#headerOut').height();
		if(h < 100) {
			h = 100;
		}
		$('#consoleOut').css({
			'max-height': h + "px"
		});
	},
	// debug
	debugHandler: function(result) {
		var c = result;
		if(!c)
			return;
		var filename = PythonIDE.currentFile;
		while(c.child) {
			lineNumber = c.$lineno;
			c = c.child;
			if(c.filename)
				filename = c.filename;
		}
		filename = filename.replace("./", "");
		//console.log(filename, lineNumber);
		var breakpoint = false;
		if(PythonIDE.breakpoints[filename] && PythonIDE.breakpoints[filename][lineNumber] && PythonIDE.continueRunning) {
			//PythonIDE.showHint("Призупинено через точку зупинки на рядку " + (lineNumber));
            PythonIDE.showHint(selectedLang === 'en' ? "Paused due to a breakpoint on the line " + (lineNumber) : "Призупинено через точку зупинки на рядку " + (lineNumber));
			breakpoint = true;
			PythonIDE.editFile(filename, lineNumber);
			PythonIDE.continueRunning = false;
			PythonIDE.runMode = "paused";
			PythonIDE.python.replInit();
			//debugger;
		}
		
//		console.log(PythonIDE.runMode, breakpoint);
		///
		// globals
		PythonIDE.currentScope = {};
		var susp = result;
		if(true || PythonIDE.runMode == "step" || breakpoint) {
			var html = '<i id="btnToggleGlobals" class="fa fa-arrows-h"></i> <div id="globals"><h3 data-i18n="global_vars">Глобальні змінні: </h3><table><tr><th>Ім'+"'"+'я</th><th data-i18n="data_type">Тип даних</th><th data-i18n="variable_values">Значення</th></tr></div>';
			PythonIDE.watchVariables.expandHandlers = [];
			var context = susp;
			if(context.child && context.child.$gbl) {
				context = context.child;
			}
	
			for(var key in context.$gbl) {
				var pyVal = context.$gbl[key];
				PythonIDE.currentScope[key] = pyVal;
				var type = PythonIDE.getPyType(pyVal);
				if(type == undefined) {
					continue;
				}
				if(type == "function"){
					continue;
				}
				if(key.match(/__.*__/)) {
					continue;
				}
				var val = "";
				try {
					val = Sk.ffi.remapToJs(Sk.builtin.repr(pyVal));	
				} catch(e) {
					//debugger;
					val = "ERROR: " + type;
				}
				
	
				if(val === undefined) {
					val = "";
				}
	
				if(val && val.length && val.length > 20) {
					var eH = {"id":PythonIDE.watchVariables.expandHandlers.length, "fullText": val, "shortText": val.substring(0,17)};
	
					PythonIDE.watchVariables.expandHandlers.push(eH);
					val = '<span class="debug_expand_zone" id="debug_expand_' + eH.id + '">' + val.substring(0, 17) + '<img src="./media/tools.png" class="debug_expand" title="Click to see full value"></span>';
				}
	
				html += '<tr><td>' + key + '</td><td>' + type + '</td><td>' + val + '</td></tr>';
			}
			html += '</table>';

			context = susp.child;
			while(context && context.$tmps && context.$lineno) {
			
				html += '<h4><span data-i18n="local_variables">Локальні змінні у рядку</span> ' + context.$lineno + '</h4><table><tr><th>Ім'+"'"+'я</th><th data-i18n="data_type">Тип даних</th><th data-i18n="variable_values">Значення</th></tr>';
				
				for(var key in context.$tmps) {
					var pyVal = context.$tmps[key];
					PythonIDE.currentScope[key] = pyVal;
					if(pyVal) {
						var type = PythonIDE.getPyType(pyVal);
						if(type != undefined && type != "function" && key[0] != "$") {
							var val = "";
							try {
								val = Sk.ffi.remapToJs(Sk.builtin.repr(pyVal));
							} catch(e) {
								//debugger;
								val = "ERROR!: " + type;
							}
							html += '<tr><td>' + key + '</td><td>' + type + '</td><td>' + val + '</td></tr>';		
						}
						
					}
					
				}
			
				html += '</table>';
				context = context.child;
			}
	
	
	
			$('#watch').html(html);
			$('#btnToggleGlobals').click(function() {
				PythonIDE.showGlobalVariables = !PythonIDE.showGlobalVariables;
				if(PythonIDE.showGlobalVariables) {
					$('#watch').css({"max-width":"30%"});
				} else {
					$('#watch').css({"max-width":"2em"});
				}
				
			});
	
			$('span.debug_expand_zone').click(function(e) {
				var id = e.currentTarget.id;
				var idNum = id.replace("debug_expand_", "");
				$('#' + id).html(PythonIDE.watchVariables.expandHandlers[idNum].fullText);
			});
		}

		var p = new Promise(function(resolve,reject){
			PythonIDE.continueDebug = function() {
				if(PythonIDE.runMode != "step" && PythonIDE.running) {
					requestAnimationFrame(function() {PythonIDE.runCode(PythonIDE.runMode); });
				}
				return resolve(susp.resume());
			}

			PythonIDE.abortDebug = function() {
				delete PythonIDE.abortDebug;
				delete PythonIDE.continueDebug;
				PythonIDE.running = false;
				return reject("Program aborted");
			}

		});
		return p;
		///

		if(PythonIDE.continueRunning) {
			delete PythonIDE.continueDebug;
			PythonIDE.runToEnd();
			return result;	
		} else {
			if(breakpoint) {
				var p = new Promise(function(resolve,reject){
					PythonIDE.continueDebug = function() {
						setTimeout(function() {PythonIDE.runCode(PythonIDE.runMode); }, 100);
						return resolve(result);
					}

					PythonIDE.abortDebug = function() {
						delete PythonIDE.abortDebug;
						delete PythonIDE.continueDebug;
						PythonIDE.running = false;
						return reject("Program aborted");
					}

				});
				return p;
			}
			return result;
		}
		
	},
//---------------
	// edit a file
	// filename: string (name of file to edit)
	editFile: function(filename, lineno) {
		filename = filename.replace("./", "");
		if(filename == PythonIDE.projectName + ".py") {
			filename = "mycode.py";
		}
		if(!lineno)
			lineno = 1;

		if(filename != PythonIDE.currentFile) {
			if(undefined === PythonIDE.files[filename]) {
				return;
			}
			if(PythonIDE.files[PythonIDE.currentFile]) {
				PythonIDE.files[PythonIDE.currentFile] = PythonIDE.editor.getValue();
			}
			PythonIDE.currentFile = filename;
			PythonIDE.disableChangeEvent = true;
			PythonIDE.editor.setValue(PythonIDE.files[filename]);
			
			PythonIDE.disableChangeEvent = false;
			//PythonIDE.editor.focus();

			var extension = filename.match(/(\.[^.]+)/);
			if(extension.length > 1)
				extension = extension[1];
			switch(extension) {
				case '.py':
					PythonIDE.editor.setOption("mode", "python");
				break;
				case '.html':
					PythonIDE.editor.setOption("mode", "htmlmixed");
				break;
				case '.json':
					PythonIDE.editor.setOption("mode", "javascript");
				break;
				case '.css':
					PythonIDE.editor.setOption("mode", "css");
				break;
				case '.js':
					PythonIDE.editor.setOption("mode", "javascript");
					break;
				default:
					PythonIDE.editor.setOption("mode", "");
				break;
			}

			if(PythonIDE.breakpoints[filename]) {
				for (var line in Object.keys(PythonIDE.breakpoints[filename])) {
					PythonIDE.addBreakpoint(filename, line);
				}
			}

			PythonIDE.updateFileTabs();
			PythonIDE.editor.refresh();

		}
		PythonIDE.editor.setCursor(lineno - 1);
	},
	// update the list of files at the top of the screen
	updateFileTabs: function() {
		var html = '';
		for(var file in PythonIDE.files){
			if(file == 'mycode.py'){
				file = PythonIDE.projectName + ".py";
			}
			html += '<span class="file_tab';
			if((file == PythonIDE.currentFile) || (file == PythonIDE.projectName + ".py") && (PythonIDE.currentFile == "mycode.py")) {
				html += ' file_tab_selected">'
				if(file != 'mycode.py') {
					html += '';
				}
			} else {
				html += '">';
			}
			html += file + '</span> ';
		}
		//html += '<span class="file_tab"><img class="btn_file_settings" data-i18n-alt="create_file_alt" alt="Створити новий файл" data-i18n-title="create_file_title" title="Створити новий файл" src="./media/tools.png"></span>';
        html += '<span class="file_tab"><img class="btn_file_settings" ' 
        + (selectedLang === 'en' 
            ? 'data-i18n-alt="create_file_alt" alt="Create a new file" data-i18n-title="create_file_title" title="Create a new file"' 
            : 'data-i18n-alt="create_file_alt" alt="Створити новий файл" data-i18n-title="create_file_title" title="Створити новий файл"') 
        + ' src="./media/tools.png"></span>';
		$('#file_tabs').html(html);
		// Окремий обробник для іконки шестерні — відкриває діалог і не дозволяє
		// події спливати до обробника span (що перемикав би файл).
		$('#file_tabs').off('click.filesettings').on('click.filesettings', '.btn_file_settings', function(e) {
			e.stopPropagation();
			var $span = $(this).closest('.file_tab');
			var fileName = $span.text().trim(); // textContent без іконки
			if (fileName === '') {
				// Кнопка "Створити новий файл"
				var newFile = 'newfile.txt';
				if (PythonIDE.files[newFile] === undefined) {
					PythonIDE.files[newFile] = '';
				}
				PythonIDE.editFile(newFile);
			} else if (fileName === PythonIDE.projectName + '.py' || fileName === 'mycode.py') {
				$('#txt_project_name').val(PythonIDE.projectName);
				$('#project_settings').dialog('open');
			} else {
				$('#txt_file_name').val(fileName);
				$('#file_settings').dialog('open');
			}
		});
		$('.file_tab').click(function(e) {
			var fileName = e.currentTarget.textContent;
			if(fileName == PythonIDE.projectName + ".py") {
				fileName = "mycode.py";
			}
			switch(fileName) {
				case "":
					fileName = 'newfile.txt';
					if(PythonIDE.files[fileName] === undefined){
						PythonIDE.files[fileName] = '';
					}
					PythonIDE.editFile('newfile.txt');
					break;
				case PythonIDE.currentFile:
					if(fileName == "mycode.py") {
						$('#txt_project_name').val(PythonIDE.projectName);
						$('#project_settings').dialog("open");
					} else {
						$('#file_settings').dialog("open");
						$('#txt_file_name').val(fileName).focus();
					}
					break;
				default:
					PythonIDE.editFile(e.currentTarget.textContent);
					break;
			}

		});
	},

	projectName: 'mycode',
	// file currently being edited
	currentFile: 'mycode.py',
	// returns the number of files in the current project
	countFiles: function() {
		var c = 0;
		for(var f in PythonIDE.files) {
			c++;
		}
		return c;
	},
	// stores each of the files in the project
	files: {'mycode.py':''},

	// callback function to allow python (skulpt) to write to a file
	writeFile: function(file, contents) {
		console.log('Filepos:',file.pos$);
		console.log('FileData:',file.data$);
		if(!Sk.builtin.checkString(contents)) {
			throw new Sk.builtin.TypeError("write() arguments must be str, not " + contents.tp$name); 
		}
		if (file.mode.v==='a') {
				file.pos$ = file.data$.length;
			}
		if ((file.mode.v==='w')&&(file.pos$ ===0)) {
				file.data$ = '';				
			} 	

		var before = file.data$; //.substr(0, file.pos$);

		file.data$ = before + Sk.ffi.remapToJs(contents).toString();
		file.pos$ = file.data$.length;
		
		file.lineList = file.data$.split("\n");
        file.lineList = file.lineList.slice(0, -1);

        for (i in file.lineList) {
            file.lineList[i] = file.lineList[i] + "\n";
        }
        file.currentLine = 0;
		
		PythonIDE.files[file.name] = file.data$;
		PythonIDE.updateFileTabs(); 
	},
	// message to display in the status bar at the bottom of the screen
	welcomeMessage: selectedLang === 'en'
    ? "Press F5 to run the code"
    : "Натисніть F5, щоб виконати код",
	// options are stored in browers's localstorage. Get the value of a specified option
	getOption: function(optionName, defaultValue) {
		if(localStorage && localStorage['OPT_' + optionName])
			return localStorage['OPT_' + optionName]
		return defaultValue;
	},
	// set the value of an option and store it in the browser's localstorage
	setOption: function(optionName, value) {
		localStorage['OPT_' + optionName] = value;
		return value;
	},
	// display text in the status bar
	showHint: function(msg) {
		if(PythonIDE.hideHintTimeout) {
			clearTimeout(PythonIDE.hideHintTimeout);
		}
		PythonIDE.hideHintTimeout = setTimeout(function(){
			delete PythonIDE.hideHintTimeout;
			$('#hintBar').fadeOut();
		}, 5000);
		$('#hintBar').html(msg).show();
	},
	
	sanitize: function(input) {
		return $("<div/>").text(input).html();
	  function replace(match) {
		// allow attributes for images and links except for event handlers
		if(match.match(/^\s*(href|src)/i)) {
			return match.replace(/on[a-z]+\s*=\s*(("[^"]*")|('[^']*'))/i, "");

		}
		return "";
	  }
	  var white="b|i|p|br|a|img";//allowed tags
	  var black="script|object|embed";//complete remove tags
	  var e=new RegExp("(<("+black+")[^>]*>.*<\\/2>|(?!<[\\/]?("+white+")(\\s[^<]*>|[\\/]>|>))<[^<>]*>|(?!<[^<>\\s]+)\\s[^<\\/>]+(?=[\\/>]))", "gi");
	  output = input.replace(e,replace);
	  
		return output;
	},
	// functions and data needed for running theh python code
	python: {
		// --- REPL state ---
		replHistory: (function() {
			try {
				return JSON.parse(localStorage.replHistory || "[]");
			} catch(e) {
				return [];
			}
		})(),
		replHistoryIndex: 0,
		replBuffer: "",
		// Current auto-indent level (in spaces) applied to the next REPL
		// input line while a multi-line block is open.
		replIndent: 0,

		replActive: false,

		// Builds the console's base markup (#consoleOut / #headerOut) if it
		// isn't there yet. This covers opening the output console (e.g. via
		// the "show output" toolbar button) *without* having run any code
		// first - previously the REPL only ever appeared as a side effect of
		// runCode(), so it was missing in that case.
		ensureConsoleReady: function() {
			if($('#consoleOut').length > 0) {
				return;
			}
			var html = '<div id="headerOut"></div>';
			html += '<pre id="consoleOut"><div id="watch"><h2>Variables:</h2></div></pre>';
			Sk.canvas = 'myChart';
			$('#output').html(html);
		},

		// Called to (re)create the always-available REPL input line inside the console.
		// Unlike the old implementation, this no longer waits for the running program
		// to finish - it is inserted immediately whenever the console is opened
		// (whether or not a program has ever been run). While a program is
		// actively executing the input line is hidden so it doesn't collide
		// with the program's own output/input; it reappears as soon as
		// execution is idle, paused at a breakpoint, or finished.
		// Safe to call repeatedly: since PythonIDE.python.output() rebuilds the
		// console's innerHTML (which destroys/recreates all its children,
		// including the REPL input), replInit() is also called again after
		// every bit of console output to make sure the input line is always
		// present, empty state aside, and focused.
		replInit: function() {
			PythonIDE.python.ensureConsoleReady();
			var firstInitThisSession = !PythonIDE.python.replActive;
			PythonIDE.python.attachReplHandlers();
			PythonIDE.python.replActive = true;
			if(firstInitThisSession) {
				PythonIDE.python.replBuffer = "";
				PythonIDE.python.replIndent = 0;
				PythonIDE.python.replHistoryIndex = PythonIDE.python.replHistory.length;
			}
			if($('#repl_input').length === 0) {
				var html = '<div id="repl_container">' +
					'<span id="repl_prompt" class="repl_prompt">&gt;&gt;&gt;</span>' +
					'<textarea id="repl_input" rows="1" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off"></textarea>' +
					'</div>';
				PythonIDE.python.output(html);
				// Keep the "..." continuation prompt visible if console output
				// (e.g. from the running program) forced the input line to be
				// recreated while the user was still in the middle of typing a
				// multi-line block.
				if(PythonIDE.python.replBuffer) {
					$('#repl_prompt').text('...');
				}
			}

			// Hide the REPL while the program is actively running (normal/step/
			// anim execution), but keep it available when idle, paused at a
			// breakpoint, or after the program has finished.
			var activelyRunning = PythonIDE.running && PythonIDE.runMode !== "paused";
			if(activelyRunning) {
				$('#repl_container').hide();
			} else {
				$('#repl_container').show();
				$('#repl_input').focus();
			}
		},

		// Bound once, via delegation on the document, so the handlers keep
		// working even though the actual #repl_input element gets destroyed
		// and recreated every time PythonIDE.python.output() runs.
		attachReplHandlers: function() {
			if(PythonIDE.python.replHandlersAttached) {
				return;
			}
			PythonIDE.python.replHandlersAttached = true;

			if($('#repl_style').length === 0) {
				$('head').append(
					'<style id="repl_style">' +
					'#repl_container{display:flex;align-items:flex-start;margin-top:4px;}' +
					'.repl_prompt{color:#8a8a8a;margin-right:6px;flex-shrink:0;white-space:pre;font-family:monospace;line-height:1.4;}' +
					'#repl_input{flex:1;resize:none;overflow:hidden;border:none;outline:none;background:none;' +
						'color:inherit;font-family:monospace;font-size:inherit;line-height:1.4;padding:0;min-height:1.4em;}' +
					'.repl_echo{color:inherit;white-space:pre-wrap;font-family:monospace;}' +
					'.repl_echo .repl_prompt{margin-right:6px;}' +
					'</style>'
				);
			}

			function autoResize(el) {
				el.style.height = 'auto';
				el.style.height = el.scrollHeight + 'px';
			}

			$(document).on('input.repl_input', '#repl_input', function() {
				autoResize(this);
			});

			$(document).on('keydown.repl_input', '#repl_input', function(e) {
				// Tab support: insert spaces instead of moving focus away,
				// so users can type indented blocks (functions, loops, conditions).
				if(e.key === 'Tab') {
					e.preventDefault();
					var start = this.selectionStart;
					var end = this.selectionEnd;
					var val = this.value;
					this.value = val.substring(0, start) + '    ' + val.substring(end);
					this.selectionStart = this.selectionEnd = start + 4;
					autoResize(this);
					return;
				}

				if(e.key === 'ArrowUp' && !e.shiftKey) {
					var beforeCursor = this.value.substring(0, this.selectionStart);
					if(beforeCursor.indexOf('\n') === -1) {
						e.preventDefault();
						PythonIDE.python.replHistoryUp();
					}
					return;
				}

				if(e.key === 'ArrowDown' && !e.shiftKey) {
					var afterCursor = this.value.substring(this.selectionStart);
					if(afterCursor.indexOf('\n') === -1) {
						e.preventDefault();
						PythonIDE.python.replHistoryDown();
					}
					return;
				}

				if(e.key === 'Enter') {
					// Shift+Enter always inserts a newline, so multi-line
					// definitions can be edited freely before running.
					if(e.shiftKey) {
						return;
					}
					e.preventDefault();
					PythonIDE.python.replSubmitLine();
				}
			});
		},

		// Handles what happens when the user presses Enter in the REPL box:
		// either the line is appended to a growing multi-line block (function
		// definitions, loops, if/else, etc.) or, if the block is complete,
		// the whole thing is executed.
		replSubmitLine: function() {
			var $input = $('#repl_input');
			var line = $input.val();
			var wasContinuation = PythonIDE.python.replBuffer.length > 0;
			var newBuffer = wasContinuation ? PythonIDE.python.replBuffer + "\n" + line : line;
			var trimmedLine = line.trim();
			var currentIndent = PythonIDE.python.replIndent || 0;

			// A blank line while still indented inside an open block just
			// dedents one level (4 spaces), like most code editors, instead
			// of always ending the block. Only a blank line back at the top
			// level (no indent left) actually closes and runs the block.
			if(wasContinuation && trimmedLine === '' && currentIndent > 0) {
				PythonIDE.python.replBuffer = newBuffer;
				PythonIDE.python.replIndent = Math.max(0, currentIndent - 4);
				$('#repl_prompt').text('...');
				$input.val(' '.repeat(PythonIDE.python.replIndent));
				$input.css('height', 'auto');
				PythonIDE.python.moveReplCaretToEnd();
				return;
			}

			var needsContinuation = PythonIDE.python.replNeedsContinuation(newBuffer, line, wasContinuation);

			var echoPrompt = wasContinuation ? '...' : '&gt;&gt;&gt;';
			PythonIDE.python.output('<div class="repl_echo"><span class="repl_prompt">' + echoPrompt + '</span> ' + PythonIDE.sanitize(line) + '</div>');

			// output() re-creates #consoleOut's children (including
			// #repl_input, via replInit()), so the $input reference grabbed
			// at the top of this function now points to a detached, dead
			// element. Re-fetch the live one before touching it further.
			$input = $('#repl_input');

			if(needsContinuation) {
				PythonIDE.python.replBuffer = newBuffer;

				// Next line keeps this line's own indent, plus one more
				// level (4 spaces) if this line opens a new block (ends
				// with ":").
				var leading = (line.match(/^[ \t]*/) || [''])[0].length;
				var nextIndent = leading;
				if(/:\s*(#.*)?$/.test(trimmedLine)) {
					nextIndent += 4;
				}
				PythonIDE.python.replIndent = nextIndent;

				$('#repl_prompt').text('...');
				$input.val(' '.repeat(nextIndent));
				$input.css('height', 'auto');
				PythonIDE.python.moveReplCaretToEnd();
				return;
			}

			var codeToRun = newBuffer;
			PythonIDE.python.replBuffer = "";
			PythonIDE.python.replIndent = 0;
			$('#repl_prompt').text('>>>');
			$input.val('');
			$input.css('height', 'auto');

			if(codeToRun.trim().length > 0) {
				PythonIDE.python.replHistory.push(codeToRun);
				if(PythonIDE.python.replHistory.length > 200) {
					PythonIDE.python.replHistory = PythonIDE.python.replHistory.slice(PythonIDE.python.replHistory.length - 200);
				}
				try {
					localStorage.replHistory = JSON.stringify(PythonIDE.python.replHistory);
				} catch(e) {}
				PythonIDE.python.replHistoryIndex = PythonIDE.python.replHistory.length;

				PythonIDE.python.repl(codeToRun);
			}
		},

		// Decides whether the block the user is typing needs another line
		// before it can be run. Supports multi-line function/class definitions,
		// for/while loops and if/elif/else blocks (Python-REPL style: a blank
		// line closes and runs the block), as well as unbalanced
		// brackets/quotes and explicit "\" line continuations.
		replNeedsContinuation: function(buffer, lastLine, wasContinuation) {
			// A blank line always ends a block that is already open.
			if(wasContinuation && lastLine.trim() === '') {
				return false;
			}

			if(PythonIDE.python.replUnbalanced(buffer)) {
				return true;
			}

			if(/\\\s*$/.test(lastLine)) {
				return true;
			}

			var trimmedLast = lastLine.trim();
			if(/:\s*(#.*)?$/.test(trimmedLast)) {
				return true;
			}

			// Already inside a block (e.g. after "def foo():") - keep
			// accepting lines until the user submits a blank line.
			if(wasContinuation) {
				return true;
			}

			return false;
		},

		// Simple bracket/quote balance checker so multi-line literals
		// (lists, dicts, strings spanning several lines, etc.) keep prompting
		// for more input instead of erroring out early.
		replUnbalanced: function(code) {
			var depth = 0;
			var inStr = null;
			for(var i = 0; i < code.length; i++) {
				var c = code[i];
				if(inStr) {
					if(c === '\\') { i++; continue; }
					if(c === inStr) { inStr = null; }
					continue;
				}
				if(c === '"' || c === "'") { inStr = c; continue; }
				if(c === '(' || c === '[' || c === '{') { depth++; }
				if(c === ')' || c === ']' || c === '}') { depth--; }
			}
			return depth > 0 || !!inStr;
		},

		replHistoryUp: function() {
			if(PythonIDE.python.replHistory.length === 0) {
				return;
			}
			if(PythonIDE.python.replHistoryIndex > 0) {
				PythonIDE.python.replHistoryIndex--;
			}
			$('#repl_input').val(PythonIDE.python.replHistory[PythonIDE.python.replHistoryIndex]);
			PythonIDE.python.moveReplCaretToEnd();
		},

		replHistoryDown: function() {
			if(PythonIDE.python.replHistoryIndex < PythonIDE.python.replHistory.length - 1) {
				PythonIDE.python.replHistoryIndex++;
				$('#repl_input').val(PythonIDE.python.replHistory[PythonIDE.python.replHistoryIndex]);
			} else {
				PythonIDE.python.replHistoryIndex = PythonIDE.python.replHistory.length;
				$('#repl_input').val('');
			}
			PythonIDE.python.moveReplCaretToEnd();
		},

		moveReplCaretToEnd: function() {
			var el = $('#repl_input')[0];
			if(!el) {
				return;
			}
			el.selectionStart = el.selectionEnd = el.value.length;
			$(el).trigger('input');
		},

		// Executes one or more lines of Python code typed into the REPL.
		// `code` is now always supplied directly by replSubmitLine (the old
		// single-line Sk.inputfun-based prompt loop has been replaced by the
		// textarea-based multi-line input above).
		repl: function(code) {
			if(code == undefined) {
				return;
			}
			var outputResult = true;
			if(code.match(/\s*import/) || code.indexOf("\n") > -1) {
				outputResult = false;
			} else {
				code = "__result = " + code;
			}
			try {
				var r = eval(Sk.compile(code, "repl", "exec", true).code)(PythonIDE.currentScope?PythonIDE.currentScope:Sk.globals);

				var startTime = new Date().getTime();
				while(r.$isSuspension) {
					if(r.data.promise) {
						r.data.promise.then(function(result) {
							if(outputResult) {

								PythonIDE.python.output(Sk.ffi.remapToJs(Sk.builtin.repr(result)));
							}
						}).catch(PythonIDE.handleError);
					} else {
						r = r.resume();
					}
					var now = new Date().getTime();
					if(now - startTime > 5000) {
						PythonIDE.showHint(selectedLang === 'en' ? "Stopped after 5 seconds to prevent web browser crashes" : "Зупинено через 5 секунд, щоб запобігти збою у роботі вебпереглядача");
						break;
					}
				}
				if(r.__result && outputResult) {
					if (Sk.ffi.remapToJs(Sk.builtin.repr(r.__result))!='None'){
						PythonIDE.python.output(Sk.ffi.remapToJs(Sk.builtin.repr(r.__result)));
					}
				}
			} catch(e) {
				PythonIDE.handleError(e);
			}

		},

		outputListeners: [],

		outputSanitized: function(text, header) {
			PythonIDE.python.output(text, header, true);
		},

		output: function(text, header, sanitized) {
			if(PythonIDE.runningTests)
				return;
            
			var id = header == undefined?'consoleOut': 'headerOut';            
			var c = document.getElementById(id);
            
			if(!c) {
				console.error(text);
				return;
			}
			if(sanitized) {
				text = PythonIDE.sanitize(text);
			}

			// The REPL input row (#repl_container) is always the last child
			// of #consoleOut. Since c.innerHTML += text appends the new text
			// AFTER whatever is currently there (including #repl_container),
			// simply concatenating would leave the input row stuck above the
			// newly added output instead of below it. So remove it first;
			// replInit() (called below) will detect it's missing and
			// re-create it at the end again, after the new text.
			if(id === 'consoleOut') {
				var replContainer = document.getElementById('repl_container');
				if(replContainer) {
					replContainer.remove();
				}
			}

			c.innerHTML += text;


			var i = 0;
			while(i < PythonIDE.python.outputListeners.length) {
				var l = PythonIDE.python.outputListeners[i];
				try {
					l(text);
					i++;
				} catch(e) {
					PythonIDE.python.outputListeners.splice(i, 1);
				}
			}
			//var c = c.parentNode.parentNode;
			c.scrollTop = c.scrollHeight;

			// c.innerHTML += text destroys and recreates all of consoleOut's
			// children (including the REPL input line), so make sure it is
			// always put back afterwards. replInserting guards against the
			// recursive call this triggers when it's the REPL box itself
			// being inserted.
			if(id === 'consoleOut' && PythonIDE.python.replActive && !PythonIDE.python.replInserting) {
				PythonIDE.python.replInserting = true;
				PythonIDE.python.replInit();
				PythonIDE.python.replInserting = false;
			}

		},

		clear: function() {
			var c = document.getElementById('consoleOut');
			c.innerHTML = '';
			var c = c.parentNode.parentNode;
			c.scrollTop = c.scrollHeight;
		}
	},
	// convenience function that allows modules to run syncronous code asyncrounously.
	// For example time.sleep needs to pause the python program but shouldn't make the browser unresponsive
runAsync: function(asyncFunc) {
    var p = new Promise(asyncFunc);
    var result;
    var failed = false, failErr = null;
    var susp = new Sk.misceval.Suspension();

    susp.resume = function() {
        if (failed) {
            // кидаємо справжній Python-виняток замість "порожнього" значення
            throw failErr;
        }
        return result;
    };

    susp.data = {
        type: "Sk.promise",
        promise: p.then(function(value) {
            result = value;
            return value;
        }, function(err) {
            failed = true;
            failErr = (err instanceof Sk.builtin.BaseException)
                ? err
                : new Sk.builtin.RuntimeError(err && err.message ? err.message : String(err));
            // ПЕРЕКИДАЄМО помилку далі, щоб susp.data.promise дійсно
            // відхилився — тоді Skulpt сам підніме її в місці виклику
            // Image.open(...), а не залишить "img" зі сміттєвим значенням.
            throw failErr;
        })
    };

    return susp;
},
	// used when displaying the contents of global variables that are too large to display on the screeen until clicked on to expand
	watchVariables: {
		expandHandlers:[]
	},
	// stores all code executed on this browser so the user can recover code from a previous session
	vault: localStorage.vault?JSON.parse(localStorage.vault):[],
	// recover code from a previous session in this browser. This is client side only. To save in the cloud, visit create.withcode.uk
	recover: function() {
		PythonIDE.saveSnapshot();

		// HTML-розмітка діалогу визначена статично в index.html (#recover).
		// Тут лише оновлюємо динамічні дані та відкриваємо діалог.
		$('#recover_vault_count').text(PythonIDE.vault.length);

		// Показати останню копію у превʼю одразу при відкритті
		if(PythonIDE.vault.length > 0) {
			var last = PythonIDE.vault[PythonIDE.vault.length - 1];
			var lastFiles = JSON.parse(last.files);
			$('#recover_code_preview').text(lastFiles['mycode.py'] || '');
		}

		$("#save").dialog("close");
		$('#recover').dialog("open").parent().css({'opacity':1.0});

		// Перестворити слайдер (щоб уникнути дублювання після повторного відкриття)
		if($('#slider_recover').hasClass('ui-slider')) {
			$('#slider_recover').slider('destroy');
		}

		$('#slider_recover').slider({
			min: 0,
			max: PythonIDE.vault.length - 1,
			value: PythonIDE.vault.length - 1,
			slide: function(event, ui) {
				var snapshot = PythonIDE.vault[ui.value];
				var d = new Date(snapshot.date);
				PythonIDE.files = JSON.parse(snapshot.files);
				PythonIDE.currentFile = "mycode.py";
				PythonIDE.editor.setValue(PythonIDE.files[PythonIDE.currentFile]);
				PythonIDE.updateFileTabs();
				PythonIDE.editor.setCursor(0);

				// Оновити превʼю коду
				$('#recover_code_preview').text(PythonIDE.files['mycode.py'] || '');

				var hours = d.getHours();
				if(hours == 0) { hours = 12; }

                var days = selectedLang === 'en' 
                    ? "Sun,Mon,Tue,Wed,Thu,Fri,Sat,Sun".split(",") 
                    : "Нд,Пн,Вт,Ср,Чт,Пт,Сб,Нд".split(",");
                var months = selectedLang === 'en' 
                    ? "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(",") 
                    : "Січ,Лют,Бер,Кві,Тра,Чер,Лип,Серп,Вер,Жовт,Лист,Гру".split(",");
				function pad2(s){s = s.toString();return s.length < 2?"0"+s:s;}

				// Оновити дату та час горизонтально
				$('#recover_date_val').text(days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear());
				$('#recover_time_hours').text(pad2(hours));
				$('#recover_time_mins').text(pad2(d.getMinutes()));
			}
		});

		$('#btn_recover_clear').button().click(function(){
			PythonIDE.vault = [];
			localStorage.vault = JSON.stringify(PythonIDE.vault);
			PythonIDE.recover();
		});
		$('#btn_recover').button().click(function() {
			$('#recover').dialog("close");
		});
	},
	// save code to the vault (store it in the browser's local storage so it can be recovered at a later date / session)
	saveSnapshot: function(submit) {
		if(submit === undefined) {
			submit = true;
		}
		var snapshot = {date: Date.now(), files: JSON.stringify(PythonIDE.files)};
		while(PythonIDE.vault.length > 50) {
			PythonIDE.vault = PythonIDE.vault.slice(1);
		}
		var match = false;
		for(i = 0; i < PythonIDE.vault.length; i++) {
			if(i == PythonIDE.vault.length - 1 && PythonIDE.vault[i].files == snapshot.files) {
				PythonIDE.vault[i].date = snapshot.date;
				match = true;
			}
		}
		if(!match) {
			PythonIDE.vault.push(snapshot);
		}

		localStorage.vault = JSON.stringify(PythonIDE.vault);
	},

	showGlobalVariables: true,

	hash: "/",

//----------------------------------------------------------------------------------
	runToEnd: function() {
		
		
		if(PythonIDE.continueRunning) {
			requestAnimationFrame(PythonIDE.runToEnd);
			if(PythonIDE.continueDebug) {
				PythonIDE.continueDebug();
			}
		}
	
	},
	// run the code in the editor
	// runMode can be "anim" to step through each line of python code or "normal" to run the whole code as fast as possible
	runCode: function(runMode) {
        
		if(runMode == "finished") {
			return;
		}
		if(!PythonIDE.files['mycode.py']) {
			PythonIDE.files['mycode.py'] = '# You need to have a file called mycode.py'
			PythonIDE.updateFileTabs();
		}
		if(!PythonIDE.files[PythonIDE.currentFile]) {
			PythonIDE.currentFile = "mycode.py";
		}
		PythonIDE.aT[PythonIDE.hash].r = Date.now();
		localStorage.aT = JSON.stringify(PythonIDE.aT);
		Sk.TurtleGraphics.animate = true;

		if(PythonIDE.animTimeout && runMode != "anim") {
			clearTimeout(PythonIDE.animTimeout);
			delete PythonIDE.animTimeout;
			return;
		}

		if(PythonIDE.hasBreakpoints() && runMode == "normal") {
			runMode = "debugging";
			PythonIDE.continueRunning = true;
		} else {
		}

		if(PythonIDE.continueDebug) {
			PythonIDE.runMode = runMode;
			switch(runMode) {
				case 'paused':
					return;
				break;
				case 'debugging':
				case 'step':
				case 'normal':
					PythonIDE.continueDebug();
					return;	
				break;
				case 'finished':
				return;
				default:
					debugger;
					PythonIDE.runToEnd();
					return;
			}
		}
		

		if(runMode === undefined)
			runMode = "normal";

		PythonIDE.runMode = runMode;
		PythonIDE.python.outputListeners = [];

		//PythonIDE.showHint("Програма виконується...");
        PythonIDE.showHint(selectedLang === 'en' ? "Program is running..." : "Програма виконується...");
		$('#btn_stopRunning').addClass('visibleButton');

		var code = PythonIDE.files['mycode.py'];

		var codeName = "mycode.py";
		var fileParts = PythonIDE.currentFile.split(".");
		if(fileParts.length == 2 && fileParts[1] == "py") {
			code = PythonIDE.files[PythonIDE.currentFile];
			codeName = PythonIDE.currentFile;
		}
		$('#dlg').dialog('option', 'title', codeName);
        
		PythonIDE.saveSnapshot();
		
		// super() hack
		if(code.indexOf("super()") > -1) {
			var lines = code.split("\n");
			var superClass = "";
			for(var i = 0; i < lines.length; i++) {
				var line = lines[i];
				var m = line.match(/\bclass\s+([a-zA-Z0-9_]*)\s*\(([A-Za-z0-9]*)\)/);
				if(m) {
					superClass = m[2];
				}
				lines[i] = line.replace(/\bsuper\s*\(\s*\)\s*\.\s*([A-Za-z0-9_]*)\s*\((.*?)\)/, function(m, method, params ) {
					var replacement = superClass + "." + method + "(self";
					if(params && params.trim().length > 0) {
						replacement += "," + params;
					}
					replacement += ")";
					return replacement;
				});
			}
			
			code = lines.join("\n");
		}
		//

		// ---- Cyrillic identifier fix (Skulpt "bad token T_OP" workaround) ----
		// Skulpt's grammar is ASCII-only for identifiers; Cyrillic dot-attribute
		// names break its tokenizer in some positions. We alias every non-ASCII
		// identifier to a safe ASCII name before Skulpt ever sees the source,
		// and expose the reverse map so pandas/__init__.js can translate
		// DataFrame column lookups back to the real (Cyrillic) names.
		var __cyrResult = preprocessCyrillicIdentifiers(code);
		code = __cyrResult.code;
		window.__pandasCyrAliasMap = __cyrResult.aliasMap;
		// ------------------------------------------------------------------


		// A brand new #consoleOut element is about to be created, so treat
		// this as a fresh REPL session (clears any leftover multi-line buffer
		// or history cursor from a previous run).
		PythonIDE.python.replActive = false;

		var html = '';
		html += '<div id="headerOut"></div>';
		html += '<pre id="consoleOut"><div id="watch"><h2>Variables:</h2></div></pre>';
		html += '</pre>';



		// Check if processing module is used
		var isProcessing = /^\s*(from\s+processing\s+import|import\s+processing)\b/m.test(code);
		console.log("isProcessing =",isProcessing )
		if (isProcessing) {
			$('#output').html(html);
			$('#dlg').dialog('open');
			Sk.canvas = 'pjs_canvas';			
			$('#dlg_processing').dialog('open');
			// Re-fit to canvas once the sketch has had time to call size()
			setTimeout(function() {
				var canvas = document.getElementById('pjs_canvas');
				if (canvas && canvas.width > 0 && canvas.height > 0) {
					var titlebarH = $('#dlg_processing').parent().find('.ui-dialog-titlebar').outerHeight() || 30;
					var dlgW = canvas.width + 2;
					var dlgH = canvas.height + titlebarH + 2;
					$('#dlg_processing').dialog('option', 'width', dlgW);
					$('#dlg_processing').dialog('option', 'height', dlgH);
					$('#dlg_processing').dialog('option', 'position', {
						my: "center center",
						at: "center center",
						of: window
					});
				}
			}, 400);
		} else {
			Sk.canvas = 'myChart';
			$('#output').html(html);
			$('#dlg').dialog('open');
		}

		// The REPL input line is now available immediately when the console
		// opens, instead of only after the program finishes running.
		PythonIDE.python.replInit();

		$('#btn_stop').button().click(function() {
			localStorage.loadAction = "restoreCode";
			window.location = window.location.href.replace('run/', 'python/').replace('#', '');
		});

		var handlers = [];
		PythonIDE.running = true;
		var crashPreventionMode = false;
		if(runMode != "normal") {
			handlers["Sk.debug"] = PythonIDE.debugHandler;
			requestAnimationFrame(function() {PythonIDE.runCode(runMode); });

			$('#watch').show();
		}

		PythonIDE.configSkulpt(runMode, crashPreventionMode);

		Sk.misceval.callsimAsync(handlers, function() {
			return Sk.importMainWithBody(PythonIDE.currentFile.replace(".py", ""),false,code,true);
		}).then(function(module){
			//PythonIDE.showHint('Програма завершила виконання>');
            PythonIDE.showHint(selectedLang === 'en' ? "The program has completed execution." : "Програма завершила виконання.");
			PythonIDE.continueRunning = false;
			if(PythonIDE.continueDebug)
				delete PythonIDE.continueDebug;
			if(PythonIDE.abortDebug)
				delete PythonIDE.abortDebug;
			$('#btn_stop').hide();
			PythonIDE.python.replInit();
			$('#repl_input').focus();
			$('#btn_stopRunning').removeClass('visibleButton').addClass('hiddenButton');
			PythonIDE.running = false;
			PythonIDE.runMode = "finished";
			if(PythonIDE.whenFinished) {
				PythonIDE.whenFinished();
			}
		}, PythonIDE.handleError);

	},
	// display errors caught when the python code runs
	handleError:function (err){
		PythonIDE.running = false;
		console.log(err);

		var html = '<div class="error">' + PythonIDE.sanitize(err.toString()) + '</div>';
		PythonIDE.showHint(html);
		

		if(err.traceback && err.traceback[0].filename != "repl") {
			console.log(err);
			html += '<fieldset><legend>Stack trace:</legend>';
			for(var i = 0; i < err.traceback.length; i++) {
				var t = err.traceback[i];
				if(t.filename == "mycode.py") {
					t.filename = PythonIDE.projectName + ".py";
				}
				html += '<div class="error">' + t.filename + ' <button class="btn_lineno" data-file="' + t.filename + '" data-line="' + t.lineno + '">line ' + t.lineno + '</button></div>';
			}
			html += '</fieldset>';
		} 

		PythonIDE.python.output(html);
		$('.btn_lineno').button().click(function(e) {
			var b = $(this);
			var line = b.data('line');
			PythonIDE.editFile(b.data('file'), line);
			$('.CodeMirror-activeline')[0].scrollIntoView({behaviour:"smooth"});
		});
	},
	// not used in client side code
	showShare: function(){

		if(!PythonIDE.shareMode)
			PythonIDE.shareMode = "code";

		var r = /\/python\/([\d\w]+)/;
	
		$('#share').dialog("open");
	},

	getPyType: function(v) {
		if(v){
				var type = v.skType?v.skType : v.tp$name;
				if(type == "str") {
					type = "string";
				}
				return type;	
		}
	},

	downloadFile: function() {
		var file_name = PythonIDE.currentFile;
		if (file_name === 'mycode.py') {
			file_name = PythonIDE.projectName + ".py";
		}

		// Заповнити поле імені файлу та відкрити діалог підтвердження
		$('#save_confirm_name').val(file_name);

		$('#save_confirm').dialog({
			modal: true,
			width: 380,
			resizable: false,
			closeOnEscape: true,
			buttons: [
				{
					text: selectedLang === 'en' ? 'Save' : 'Зберегти',
					click: function() {
						var chosen_name = $('#save_confirm_name').val().trim() || file_name;
						var blob = new Blob([PythonIDE.files[PythonIDE.currentFile]], {type: "text/plain", endings: "transparent"});
						saveAs(blob, chosen_name);
						$(this).dialog('close');
					}
				},
				{
					text: selectedLang === 'en' ? 'Cancel' : 'Скасувати',
					click: function() {
						$(this).dialog('close');
					}
				}
			]
		}).dialog('open');

		// Зберегти по Enter у полі імені
		$('#save_confirm_name').off('keydown.saveconfirm').on('keydown.saveconfirm', function(e) {
			if (e.key === 'Enter') {
				$('#save_confirm').dialog('widget').find('button:first').trigger('click');
			}
		});
	},
	saveChoice: function() {
		if ($("#save").dialog("isOpen")===false) { 
			$("#save").dialog("open"); }
		else {$("#save").dialog("close"); }	
	},

	breakpoints: {},

	addBreakpoint: function(file, line) {
		if(!PythonIDE.breakpoints[file])
			PythonIDE.breakpoints[file] = {};
		PythonIDE.breakpoints[file][line] = true;
		var b = document.createElement("div");
		b.style.color = "#822";
		b.innerHTML = "●";
		if(PythonIDE.currentFile == file)
			PythonIDE.editor.setGutterMarker(line - 1, "breakpoints", b);
	},

	hasBreakpoints: function(file) {
		return Object.keys(PythonIDE.breakpoints).length > 0;
	},

	clearBreakpoints: function(file) {
		if(PythonIDE.currentFile == file)
			PythonIDE.editor.clearGutter("breakpoints");
		PythonIDE.breakpoints[file] = {};
	},

	removeBreakpoint: function(file, line) {
		delete PythonIDE.breakpoints[file][line];
		if(PythonIDE.currentFile == file)
			PythonIDE.editor.setGutterMarker(line - 1, "breakpoints", null);
	},

	toggleBreakpoint: function(file, line) {
		if(PythonIDE.breakpoints[file] && PythonIDE.breakpoints[file][line]) {
			PythonIDE.removeBreakpoint(file, line);
		} else {
			PythonIDE.addBreakpoint(file, line);
		}
	},
	// event handler that responds when the browser resizes
	autoSize: function(e) {	
				wscale=0.5;		
				let check = false;
				(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
				if (check) {wscale=1;}
		

		if(e && e.target.localName == "div")
			return;
		// expand editor to fit height of the screen.
		$('.holder').css({height: window.innerHeight - 80});
		$('#dlg,#settings,#login,#share,#recover,#save,#tracker').dialog({
			width: window.innerWidth * wscale,
			height: window.innerHeight
		});
		$('#project_settings,#file_settings').dialog({
			width: window.innerWidth * wscale
		});
		$('#editor').css({top:$('#file_tabs').height() - 20});
		PythonIDE.editor.refresh();
	},

	configSkulpt: function(mode, forceDebugging) {
		var debugging = forceDebugging || !(mode == "run" || mode == "normal");
		
		Sk.inputfun = function(prompt) {
			//return window.prompt(prompt);
			var p = new Promise(function(resolve, reject) {
				if($('#raw_input_holder').length > 0) {
					return;
				}
				PythonIDE.python.output('<form><div id="raw_input_holder"><label for="raw_input">' + prompt + '</label><input class="ui-widget ui-state-default ui-corner-all" type="text" style="color:#ff0000;background:none;border:none;outline:none;" name="raw_input" id="raw_input" value="" autocomplete="off"/><button id="raw_input_accept" type="submit" style="border:none;padding:1em;background: none;">OK</button></div></form>');

				var btn = $('#raw_input_accept').button().click(function() {
					var val = $('#raw_input').val();
					$('#raw_input_holder').remove();
					console.log('val=',val);
					PythonIDE.python.output(prompt + ' <span class="console_input">' + val + "</span>\n");
					resolve(val);
				});
				$('#raw_input').focus();
			});
			return p;
		}
		//console.log('Sk.configure');
		Sk.configure({
				breakpoints:function(filename, line_number, offset, s) {
				//debugger;
				if(PythonIDE.runMode == "anim") {
					if(PythonIDE.continueDebug) {
						PythonIDE.animTimeout = setTimeout(function() {
							PythonIDE.runCode("anim");
						}, $( "#slider_step_anim_time" ).slider( "value" ));
					}
				}
				if(PythonIDE.runMode == "step" || PythonIDE.runMode == "anim" || PythonIDE.runMode == "debugging") {
					PythonIDE.editFile(filename, line_number);	
					//console.log(this, filename, line_number,PythonIDE.runMode);
				}
				
				PythonIDE.lineNumber = line_number;
				return true;
			},
			//debugging: !(mode == "run" || mode == "normal") ,
			debugging: debugging,
			output: PythonIDE.python.outputSanitized,
			filewrite: PythonIDE.writeFile,
			read: PythonIDE.builtinRead,
			killableWhile: true,
			/*killableFor: true,*/
			inputfunTakesPrompt: true});
	},	
	aT: {},


	stop: function() {
		localStorage.loadAction = "restoreCode";
		window.location = window.location.href.replace('run/', 'python/').replace("", "");
		location.reload();
	},

	keyHandlers: [],

	savePreview: {
		start: 0,
		size: 9,
		order: "updated"
	},

	globals: ["abs","delattr","hash","memoryview","set","all","dict","help","min","setattr","any","dir","hex","next","slice","ascii","divmod","id","object","sorted","bin","enumerate","input","oct","staticmethod","bool","eval","int","open","str","breakpoint","exec","isinstance","ord","sum","bytearray","filter","issubclass","pow","super","bytes","float","iter","print","tuple","callable","format","len","property","type","chr","frozenset","list","range","vars","classmethod","getattr","locals","repr","zip","compile","globals","map","reversed","complex","hasattr","max","round"],

	autoComplete: function(cm, option) {

		return new Promise(function(accept) {
			var suggestions = [];
			var keys = {

			};
			var cursor = cm.getCursor(), line = cm.getLine(cursor.line)
	        var start = cursor.ch, end = cursor.ch
	        while (start && /\w/.test(line.charAt(start - 1))) --start;
	        while (end < line.length && /\w/.test(line.charAt(end))) ++end;
	        var preLine = line.slice(0, start).trim();
	        var context = preLine.split(/\b/);

	        var word = line.slice(start, end).toLowerCase();

	        function addSuggestion(text, className) {
				if(keys[text] || text.indexOf(word) !== 0)
					return;
				suggestions.push({
	        		text: text,
	        		className: className
	        	});
	        	keys[text] = true;
			}
	        
	        var addMore = true;

	        var last = context[context.length - 1];
	        if(last == ".") {
	        	addMore = false;
	        }
	        if(addMore) {
	        	if(last == "import") {
	        		var builtins = ["math", "re", "random", "turtle", "time"];
	        		for(var i = 0; i < builtins.length; i++) {
	        			addSuggestion(builtins[i], 'autocomplete-mod');
	        		}
	        		for(var key in Sk.externalLibraries) {
	        			if(!Sk.externalLibraries.hasOwnProperty(key)) {
	        				continue;
	        			}
	        			addSuggestion(key, 'autocomplete-mod');
	        		}
	        		addMore = false;
	        	}
	        }

	        if(addMore) {
		        for(var i = 0; i < PythonIDE.globals.length; i++) {
		        	addSuggestion(PythonIDE.globals[i], 'autocomplete-builtin');
		        }
		    }

		    var code = PythonIDE.editor.getValue();
	        if(addMore) {
	        	var r = /\b([A-Za-z_0-9]+)\b\s*=/g;
		        var v;
		        while(v = r.exec(code)) {
		        	addSuggestion(v[1], 'autocomplete-var');
		        }

		        r = /^\s*def\s+([A-Za-z0-9_]+)/gm;
		        while(v = r.exec(code)) {
		        	addSuggestion(v[1], 'autocomplete-def');
		        }	
	        }
	        
	        
	        suggestions.sort(function(a,b) {
	        	return (a.text > b.text)? 1:-1;
	        });
			return accept({
				list: suggestions,
				from: CodeMirror.Pos(cursor.line, start),
				to: CodeMirror.Pos(cursor.line, end)
			});
		});
	},
		builtinRead: function(file) {				

				// 1. Зовнішні бібліотеки
				if (externalLibs[file] !== undefined) {
					return Sk.misceval.promiseToSuspension(
						fetch(externalLibs[file]).then(res => res.text())
					)
				}

				// Нормалізуємо: прибираємо префікс src/lib/ якщо є
				var f = file;
				if (f.slice(0, 8) === "src/lib/") {
					f = f.slice(8);
				}

				// 2. Вкладка IDE — шукаємо "mylib.py" і "mylib" (без розширення)
				if (PythonIDE.files[f] !== undefined) {					
					return PythonIDE.files[f];
				}
				if (PythonIDE.files[f + ".py"] !== undefined) {					
					return PythonIDE.files[f + ".py"];
				}

				// 3. jsfs — файли створені через open/write під час виконання
				try {
					var jscontent = fsToBrowse.read(f);
					if (jscontent !== undefined && jscontent !== null) {						
						return jscontent;
					}
				} catch(e) {}
				try {
					var jscontent = fsToBrowse.read(f + ".py");
					if (jscontent !== undefined && jscontent !== null) {						
						return jscontent;
					}
				} catch(e) {}

				// 4. Вбудовані файли Skulpt
				if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[file] === undefined) {					
					throw "File not found: " + file;
				}
				return Sk.builtinFiles.files[file];
			},
	init: function(style) {
		$('#hintBar').click(function() {
			clearTimeout(PythonIDE.hideHintTimeout);
			delete PythonIDE.hideHintTimeout;
			$('#hintBar').fadeOut();
		});	

				
		var $form = $('.box');

		function loadFile(file) {
			PythonIDE.saveSnapshot();
			if (file.name.match(/\.(txt|py|json)$/)) {
				var reader = new FileReader();
				var loadname = file.name.replace(/ \(\d+\)\./, ".");
				reader.onload = function (event) {
					PythonIDE.files[loadname] = event.target.result;
					PythonIDE.currentFile = loadname;
					PythonIDE.editor.setValue(PythonIDE.files[PythonIDE.currentFile]);
					PythonIDE.updateFileTabs();
					PythonIDE.editor.refresh();
				};
				reader.readAsText(file);
			} else {
				if(file.name.match(/\.sb3$/)) {
					PythonIDE.showHint("Спроба прочитати файл sb3");
				} else {
					PythonIDE.showHint("Непідтримуваний формат файлу");	
				}
				
			}
		}
		
		
		const fileBtn = document.getElementById('file-btn');
        fileBtn.addEventListener('change', function(){
				console.log(this.files[0].name);
				var file = this.files[0];			
			    loadFile(file);  
		});	
		  
		const recoverBtn = document.getElementById('btn_show_recover');
        recoverBtn.addEventListener('click', function(){
			console.log("Recover ")
				PythonIDE.recover();
		});
		
		
		var r = /\/(python|embed|run)\/(.*)(\?|#)?/;
		var m = r.exec(window.location.pathname);
		if(m && m.length > 2) {
			PythonIDE.hash = m[2];
		}
		if(localStorage.aT) PythonIDE.aT = JSON.parse(localStorage.aT);
		if(!PythonIDE.aT[PythonIDE.hash]) PythonIDE.aT[PythonIDE.hash] = {r:false, v:Date.now(), t:false, s:0, m:0};
		localStorage.aT = JSON.stringify(PythonIDE.aT); 

		$('#btnDownload').button().click(function(e) {
			PythonIDE.downloadFile();
		});		


		PythonIDE.showHint(PythonIDE.welcomeMessage);
		window.onresize = PythonIDE.autoSize;
		PythonIDE.updateFileTabs();

		$('#share_tabs').tabs();		

		PythonIDE.editor = CodeMirror(document.getElementById('editor'), {
			value: PythonIDE.files['mycode.py'],
			extraKeys: {"Ctrl-Space": "autocomplete"},
			mode: 'python',
			lineNumbers: true,
			gutters: ["CodeMirror-linenumbers", "breakpoints"],
			styleActiveLine: true,
			inputStyle: "textarea",
			lineWrapping: true,
			searchbox: true,
			hintOptions: {
				hint: PythonIDE.autoComplete
			}
		});

		PythonIDE.editor.on("gutterClick", function(cm, n) {
		  PythonIDE.toggleBreakpoint(PythonIDE.currentFile, n + 1);
		});

		PythonIDE.editor.addKeyMap({
		"Tab": function (cm) {
			if (cm.somethingSelected()) {
				var sel = PythonIDE.editor.getSelection("\n");
				// Indent only if there are multiple lines selected, or if the selection spans a full line
				if (sel.length > 0 && (sel.indexOf("\n") > -1 || sel.length === cm.getLine(cm.getCursor().line).length)) {
					cm.indentSelection("add");
					return;
				}
			}

			if (cm.options.indentWithTabs)
				cm.execCommand("insertTab");
			else
				cm.execCommand("insertSoftTab");
		},
		"Shift-Tab": function (cm) {
			cm.indentSelection("subtract");
		}
		});
		setTimeout(function() {
			PythonIDE.editor.refresh();
		}, 100);

		if(style != "embed" && style != "run") {
			PythonIDE.editor.focus();
		}
		PythonIDE.editor.on("change", function(e) {
			if(PythonIDE.disableChangeEvent){
				return 0;
			}
//-------------------------
			if(PythonIDE.abortDebug) {
				PythonIDE.abortDebug();
			}
			// update breakpoints
			PythonIDE.breakpoints = {};
			for(var n = 0; n < PythonIDE.editor.lineCount(); n++) {
				var info = PythonIDE.editor.lineInfo(n);
				if(info && info.gutterMarkers && info.gutterMarkers.breakpoints) {
					PythonIDE.breakpoints[n+1] = true;
				}
			}
			
			PythonIDE.files[PythonIDE.currentFile] = PythonIDE.editor.getValue();
		});

		// Ініціалізація діалогів project_settings і file_settings має відбутися
		// ДО будь-яких викликів dialog('option', ...) — інакше jQuery UI кидає виняток.
		$('#project_settings,#file_settings').dialog({
			autoOpen: false,
			width: window.innerWidth * wscale,
			height: 'auto',
			position: {my: "center top", at: "center top+60", of: window}
		}).parent().css({position: "fixed"});

		$('#project_settings').dialog('option', 'buttons', [
			{
				text: selectedLang === 'en' ? 'OK' : 'OK',
				click: function() {
					var newProjectName = $('#txt_project_name').val();
					PythonIDE.projectName = newProjectName;
					PythonIDE.updateFileTabs();
					$(this).dialog('close');
				}
			},
			{
				text: selectedLang === 'en' ? 'Cancel' : 'Скасувати',
				click: function() {
					$(this).dialog('close');
				}
			}
		]);

		$('#txt_project_name').off('keydown.projectsettings').on('keydown.projectsettings', function(e) {
			if (e.key === 'Enter') { $('#btn_project_ok').trigger('click'); }
		});

		$('#file_settings').dialog('option', 'buttons', [
			{
				text: selectedLang === 'en' ? 'Rename' : 'Перейменувати',
				click: function() {
					var newFileName = $('#txt_file_name').val();
					if(!newFileName.match(/^[A-Za-z0-9_.]+$/)){
						PythonIDE.showHint(selectedLang === 'en' ? "Invalid file name" : "Некоректне ім'я файлу");
						return;
					}
					if(PythonIDE.files[newFileName] || (PythonIDE.projectName + ".py" == newFileName)) {
						PythonIDE.showHint(selectedLang === 'en' ? "A file with that name already exists" : "Файл із такою назвою вже існує");
						return;
					}
					var fileContents = PythonIDE.files[PythonIDE.currentFile];
					delete PythonIDE.files[PythonIDE.currentFile];
					PythonIDE.currentFile = newFileName;
					PythonIDE.files[PythonIDE.currentFile] = fileContents;
					PythonIDE.updateFileTabs();
					$(this).dialog('close');
					PythonIDE.editFile(newFileName);
				}
			},
			{
				text: selectedLang === 'en' ? 'Delete' : 'Видалити',
				icons: { primary: 'ui-icon-trash' },
				click: function() {
					delete PythonIDE.files[PythonIDE.currentFile];
					PythonIDE.editFile("mycode.py");
					$(this).dialog('close');
				}
			},
			{
				text: selectedLang === 'en' ? 'Cancel' : 'Скасувати',
				click: function() {
					$(this).dialog('close');
				}
			}
		]);

		if(localStorage && !localStorage.options) {
			localStorage.options = {
				codeSize:12,
				outputSize: 12,
				outputTransparency: 0,
				stepAnimtime: 1000
			}
		}

		$('#slider_code_size').slider({
			value: PythonIDE.getOption('codeSize', 12),
			min: 6,
			max: 40,
			slide: function(e, ui) {
				$('#txt_code_size').val(ui.value + "pt");
				$('#editor').css({'font-size':ui.value + 'pt'});
				PythonIDE.setOption('codeSize', ui.value);
			}
		});
		$('#txt_code_size').val(PythonIDE.getOption('codeSize', 12) + "pt");
		$('#editor').css({'font-size':PythonIDE.getOption('codeSize', 12) + 'pt'});

		$('#slider_output_size').slider({
			value: PythonIDE.getOption('outputSize', 12),
			min: 6,
			max: 40,
			slide: function(e, ui) {
				$('#txt_output_size').val(ui.value + "pt");
				$('#output').css({'font-size':ui.value + 'pt'});
				PythonIDE.setOption('outputSize', ui.value)
			}
		});
		$('#txt_output_size').val(PythonIDE.getOption('outputSize', 12) + "pt");
		$('#output').css({'font-size':PythonIDE.getOption('outputSize', 12) + 'pt'});

		$('#slider_output_transparency').slider({
			value: PythonIDE.getOption('outputTransparency', 0),
			min: 0,
			max: 100,
			slide: function(e, ui) {
				$('#txt_output_transparency').val(ui.value + "%");
				$('#dlg').parent().css({'opacity':1 - (ui.value / 100)});
				PythonIDE.setOption('outputTransparency', ui.value);
			}
		});
		$('#txt_output_transparency').val(PythonIDE.getOption('outputTransparency', 0) + "%");

		$('#slider_step_anim_time').slider({
			value: PythonIDE.getOption('stepAnimTime', 500),
			min: 500,
			max: 5000,
			step: 500,
			slide: function(e, ui) {
				$('#txt_step_anim_time').val(ui.value / 1000 + "s");
				PythonIDE.setOption('stepAnimtime', ui.value)
			}
		});
		$('#txt_step_anim_time').val(PythonIDE.getOption('stepAnimTime', 500) + "ms");

		window.onerror=function(err) {
			if(err && err.__proto__ && err.__proto__.tp$name == "SystemExit") {
				PythonIDE.stop();
			} else {
				var msg = err.toString().replace("Uncaught ", "");

				var html = '<div class="error">' + msg + '</div>';
				html += '<fieldset><legend>Stack trace:</legend>';
				if(err.traceback) {
					for(var i = 0; i < err.traceback.length; i++) {
						var t = err.traceback[i];
						if(t.filename == "mycode.py") {
							t.filename = PythonIDE.projectName + ".py";
						}
						html += '<div class="error">' + t.filename + ' <button class="btn_lineno" data-file="' + t.filename + '" data-line="' + t.lineno + '">line ' + t.lineno + '</button></div>';
					}
				} else {
					var t = {
						filename: PythonIDE.currentFile,
						lineno: 1
					}
					var m = msg.match(/line\s+(\d+)/);
					if(m && m.length > 1) {
						t.lineno = m[1];
					}
					if(t.filename == "mycode.py") {
						t.filename = PythonIDE.projectName + ".py";
					}
					html += '<div class="error">' + t.filename + ' <button class="btn_lineno" data-file="' + t.filename + '" data-line="' + t.lineno + '">line ' + t.lineno + '</button></div>';
				}
				html += '</fieldset>';

				PythonIDE.python.output(html);
				$('.btn_lineno').button().click(function(e) {
					var b = $(this);
					var line = b.data('line');
					PythonIDE.editFile(b.data('file'), line);
					$('.CodeMirror-activeline')[0].scrollIntoView({behaviour:"smooth"});
				});



				console.log(err);
				return true;				
			}
			
		}

		$(window).keyup(function(e) {
			if(!PythonIDE.running) {
				PythonIDE.keyHandlers = [];
			} else {

				// space and arrow keys
			    if([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
			        e.preventDefault();
			    }

				for(var i = 0; i < PythonIDE.keyHandlers.length; i++) {
					PythonIDE.keyHandlers[i](e);
				}	
			}
		});

		// setup keyboard shortcutts
		$(window).keydown(function(e) {
			
			if(!PythonIDE.running) {
				PythonIDE.keyHandlers = [];
			} else {

				// space and arrow keys
			    if([37, 38, 39, 40, 116].indexOf(e.keyCode) > -1) {
			        e.preventDefault();
			    }

				for(var i = 0; i < PythonIDE.keyHandlers.length; i++) {
					PythonIDE.keyHandlers[i](e);
				}	
			}
			if ((e.which || e.keyCode) == 116) {
					if(e.shiftKey) {
								PythonIDE.runCode("step");
								e.preventDefault();
							} 
					else {
								PythonIDE.runCode("normal");
								e.preventDefault(); }
					};
			if(PythonIDE.resetCode) {
				delete PythonIDE.resetCode;
			}
			if(e.altKey && e.shiftKey && e.keyCode == 83) {
				PythonIDE.showShare();
			}
			if(e.ctrlKey) {
				switch(e.keyCode) {
					case 13: // CTRL + ENTER = run / stop
						PythonIDE.runCode("normal");
						e.preventDefault();
					break;

					case 83: // CTRL + S = save
							if(e.altKey) {
								PythonIDE.downloadFile();
							}			
						
						e.preventDefault();
						break;

					case 79: // CTRL + O settings
						$('#settings').dialog("open");
						e.preventDefault();
						break;

					case 65: // Ctrl + A Select all
						PythonIDE.editor.execCommand("selectAll");
						PythonIDE.editor.focus();
						e.preventDefault();
						break;

					case 32: // Ctrl + Space show code hint
						//PythonIDE.showCodeHint();
					break;

					default:
						//console.log("Control + keycode:" + e.keyCode);
					break;
				}
			}
		});

		$('#dlg,#settings,#share,#recover,#save').dialog({
			autoOpen:false,
			width: window.innerWidth * wscale,
			height: window.innerHeight,
			position: {my: "left top", at: "center top", of: window}
		}).parent().css({position: "fixed"});

		$('#dlg_processing').dialog({
			autoOpen: false,
			width: 460,
			height: 420,
			resizable: true,
			draggable: true,
			position: {my: "center center", at: "center center", of: window},
			title: "Processing",
			open: function(event, ui) {
				// Style the titlebar
				$(this).parent().find(".ui-dialog-titlebar").css({
					"background-color": "#4b42d6",
					"color": "white"
				});
				$(this).parent().find(".ui-dialog-titlebar-close").css({
					"color": "white"
				});
				// Fit dialog to canvas size after a short delay (canvas may not be sized yet)
				setTimeout(function() {
					var canvas = document.getElementById('pjs_canvas');
					if (canvas && canvas.width > 0 && canvas.height > 0) {
						var titlebarH = $('#dlg_processing').parent().find('.ui-dialog-titlebar').outerHeight() || 30;
						var dlgW = canvas.width + 2;
						var dlgH = canvas.height + titlebarH + 2;
						$('#dlg_processing').dialog('option', 'width', dlgW);
						$('#dlg_processing').dialog('option', 'height', dlgH);
						// Re-center on screen
						$('#dlg_processing').dialog('option', 'position', {
							my: "center center",
							at: "center center",
							of: window
						});
					}
				}, 150);
			},
			close: function() {
				if (window._pjsInstance) {
					try { window._pjsInstance.exit(); } catch(e) {}
					window._pjsInstance = null;
				}
			}
		}).parent().css({
			position: "fixed",
			'background-color': '#BBB',
			'border': '1px solid #550',
			'box-shadow': '0 8px 16px rgba(0, 0, 0, 0.4)',
			'font-size': '12pt'
		});

		$('#btnShare').button().click(function() {
			PythonIDE.showShare();
		});


		$('#radio_share_mode').buttonset().change(function(e) {
			var id = $('#radio_share_mode :radio:checked').attr('id');
			switch(id) {
				case 'radio_share_mode_code':
					PythonIDE.shareMode = 'code';
				break;
				case 'radio_share_mode_run':
					PythonIDE.shareMode = 'run';
				break;
			}
			PythonIDE.showShare();
		});

		$('#radio_run_mode').buttonset().change(function(e) {
			var id = $('#radio_run_mode :radio:checked').attr('id');
			switch(id) {
				case 'radio_run_mode_all':
					PythonIDE.runMode = "normal";
					$("#btn_run").attr("src", "./media/play.png");
				break;
				case 'radio_run_mode_single':
					PythonIDE.runMode = "step";
					$("#btn_run").attr("src", "./media/step.png");
				break;
				case 'radio_run_mode_anim':
					PythonIDE.runMode = "anim";
				break;
			}
		});

		$('#radio_code_style').buttonset().change(function(e) {
			var id = $('#radio_code_style :radio:checked').attr('id');
			switch(id) {
				case 'radio_code_style_light':
					PythonIDE.editor.setOption("theme", "default");
					$('body').css({'background-color': '#FFF'});
					PythonIDE.setOption('code_style', 'light')
				break;
				case 'radio_code_style_dark':
					PythonIDE.editor.setOption("theme", "blackboard");
					$('body').css({'background-color': '#000'});
					PythonIDE.setOption('code_style', 'dark')
				break;
				case 'radio_code_style_dusk':
					PythonIDE.editor.setOption("theme", "cobalt");
					$('body').css({'background-color': '#002240'});
					PythonIDE.setOption('code_style', 'dusk')
				break;
			}
		});
		$('#radio_code_style_' + PythonIDE.getOption('code_style', 'light')).prop('checked', true).change();

		$('#radio_output_style').buttonset().change(function(e) {
			var id = $('#radio_output_style :radio:checked').attr('id');
			switch(id) {
				case 'radio_output_style_light':
					$('#dlg').css({'background-color': '#FFF','color':'#000'});
					PythonIDE.setOption('output_style', 'light')
				break;
				case 'radio_output_style_dark':
					$('#dlg').css({'background-color': '#222','color':'#CCC'});
					PythonIDE.setOption('output_style', 'dark')
				break;
				case 'radio_output_style_dusk':
					$('#dlg').css({'background-color': '#002240','color':'#CCC'});
					PythonIDE.setOption('output_style', 'dusk')
				break;
			}
		});
		$('#radio_output_style_' + PythonIDE.getOption('output_style', 'dark')).prop('checked', true).change();



		if(localStorage.loadAction) {
			switch(localStorage.loadAction) {
				case 'showShare':
					PythonIDE.showShare();
				break;
				case 'restoreCode':
					console.log("restoring");
					var snapshot = PythonIDE.vault.pop()
					if(snapshot) {
						PythonIDE.files = JSON.parse(snapshot.files);
						PythonIDE.currentFile = "mycode.py";
						PythonIDE.editor.setValue(PythonIDE.files[PythonIDE.currentFile]);
						PythonIDE.updateFileTabs();	
		
					}
					
				break;
			}
			delete localStorage.loadAction;
			PythonIDE.editor.setCursor(0);
			PythonIDE.editor.focus();
		}

//---------------------		

		Sk.inBrowser = true;

		Sk.inputfunTakesPrompt = true;

		(Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'canvas';

		PythonIDE.configSkulpt("run");

		// expand editor to fit height of the screen.
		$('.holder').css({height: window.innerHeight - 80});

		$('#footer').css({bottom: 0});
		$('#chk-advanced').checkboxradio();
		if(localStorage.debug) {
			$('#chk-advanced').prop('checked', true).change();
		}
		
		
		$('#chk-advanced').change(function(e){
			$('#chk-advanced').checkboxradio('refresh');
			if($('#chk-advanced').prop('checked')){
				localStorage.debug=true;
			} else{
				delete localStorage.debug;
			}
			PythonIDE.updateFileTabs();
			});

		
		if(style == "run") {

			$('#editor').hide();
			var output = $('#output').detach();
			$('#holder').append(output);
			$('#dlg').remove();
			PythonIDE.whenFinished = function() {
				var link = window.location.href.replace('run/', 'python/');
				var html = '<div><p>This python app was written using create.withcode</p></div>';
				PythonIDE.python.output(html+'<button id="btn_run_again">Run again</button>');
				$('#btn_run_again').button().click(function() {PythonIDE.runCode()});
			}
			PythonIDE.runCode();
		}

//------------------------------
		
		function timeSince(date) {

		  var seconds = Math.floor((new Date() - date) / 1000);

		  var interval = Math.floor(seconds / 31536000);

		  if (interval > 1) {
		    return interval + " years";
		  }
		  interval = Math.floor(seconds / 2592000);
		  if (interval > 1) {
		    return interval + " months";
		  }
		  interval = Math.floor(seconds / 86400);
		  if (interval > 1) {
		    return interval + " days";
		  }
		  interval = Math.floor(seconds / 3600);
		  if (interval > 1) {
		    return interval + " hours";
		  }
		  interval = Math.floor(seconds / 60);
		  if (interval > 1) {
		    return interval + " minutes";
		  }
		  return Math.floor(seconds) + (seconds==1?" second" : " seconds");
		}

		if(PythonIDE.hash && !PythonIDE.forceReset && PythonIDE.aT && PythonIDE.aT[PythonIDE.hash] && PythonIDE.aT[PythonIDE.hash].c) {
			PythonIDE.defaultSavedCode = JSON.stringify(PythonIDE.files);
			if(JSON.stringify(PythonIDE.aT[PythonIDE.hash].c) != PythonIDE.defaultSavedCode) {
				PythonIDE.restored = true;
				PythonIDE.files = PythonIDE.aT[PythonIDE.hash].c;
				PythonIDE.editor.setValue(PythonIDE.files[PythonIDE.currentFile]);
				PythonIDE.updateFileTabs();
				//PythonIDE.showHint("Відображається код, який ви редагували востаннє " + timeSince(PythonIDE.aT[PythonIDE.hash].t) + " тому");	
                PythonIDE.showHint(selectedLang === 'en' ? "Showing the code you last edited " + timeSince(PythonIDE.aT[PythonIDE.hash].t) + " ago" : "Відображається код, який ви редагували востаннє " + timeSince(PythonIDE.aT[PythonIDE.hash].t) + " тому");
				var html = '<img id="btn_reset_code" data-i18n-title="reset_code_title" data-i18n-alt="reset_code_alt" alt="Скинути код до збереженої версії" title="Скинути код" class="toolButton hiddenButton visibleButton" src="./media/reset.png">';
				$("#btn_stopRunning").after(html);
			}
				
			if(PythonIDE.files['tests.json'] !== undefined) {
				PythonIDE.runTests();
			}
		}

		$('.toolButton').hover(function(e) {
			// mouse over tool button
			PythonIDE.showHint($('#' + e.currentTarget.id).attr('alt'));
		}, function(e) {
			// mouse out tool button
			//PythonIDE.showHint(PythonIDE.welcomeMessage);
		}).click(function(e) {
			// tool button click
			switch(e.currentTarget.id) {
				case 'btn_reset_code':
					PythonIDE.resetFiles();
				break;

				case 'btn_edit':
					window.open(window.location.href.replace('embed', 'python').replace('run', 'python'));
				break;

				case 'btn_stopRunning':
					PythonIDE.stop();
				break;

				case 'btn_tools':
					toolsVisible = !toolsVisible;
					if(toolsVisible) {
						$('.toolButton').addClass('visibleButton');
					} else {
						$('.toolButton').removeClass('visibleButton');
					}
				break;

				case 'btn_show_output':
					//$('#btn_group_console').toggleClass('hiddenButtonPanel');					
					if ($('#dlg').dialog("isOpen")===false) { 
									$('#dlg').dialog("open");
									PythonIDE.python.replInit();
					}
						else {$('#dlg').dialog("close"); }	
				break;

				case 'btn_show_settings':
						
						if ($('#settings').dialog("isOpen")===false) { 
									$('#settings').dialog("open"); }
						else {$('#settings').dialog("close");$(".ui-dialog-content").dialog("close");}	
				break;

				case 'btn_show_share':
					PythonIDE.saveChoice();
				break;

				case 'btn_run':
						var bimg=$("#btn_run").attr("src");
						if (bimg==="./media/play.png"){PythonIDE.runCode();}
						if (bimg==="./media/step.png"){PythonIDE.runCode("step");}
				break;
 	
			}
		});
		PythonIDE.autoSize();
	},
//

	resetFiles: function(all) {
		if(PythonIDE.aT && PythonIDE.hash && PythonIDE.aT[PythonIDE.hash] && PythonIDE.defaultSavedCode) {
			PythonIDE.saveSnapshot();
			delete PythonIDE.aT[PythonIDE.hash];
			PythonIDE.aT[PythonIDE.hash] = {r:false, v:Date.now(), t:false, s:0, m:0};
			localStorage.aT = JSON.stringify(PythonIDE.aT);
			PythonIDE.files = JSON.parse(PythonIDE.defaultSavedCode);
			PythonIDE.editor.setValue(PythonIDE.files[PythonIDE.currentFile]);
			PythonIDE.updateFileTabs();
			//PythonIDE.showHint("Відновити збережений код за замовчуванням. Для скасування скористайтеся кнопкою відновлення коду.");
            PythonIDE.showHint(selectedLang === 'en' ? "Restore the saved default code. To cancel, use the restore code button." : "Відновити збережений код за замовчуванням. Для скасування скористайтеся кнопкою відновлення коду.");
		}
	}
}
