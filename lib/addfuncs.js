// added functions -------------------------
    (function() {
        // Library definitions (descriptions are resolved from the selected locale)
        var RT_LIBS = [
            { name: 'arduino',        descKey: 'rt_lib_desc_arduino',        configurable: false },
            { name: 'easygui',        descKey: 'rt_lib_desc_easygui',        configurable: false },
            { name: 'matplotlib',     descKey: 'rt_lib_desc_matplotlib',     configurable: false },
            { name: 'microbit',       descKey: 'rt_lib_desc_microbit',       configurable: false },
            { name: 'music',          descKey: 'rt_lib_desc_music',          configurable: false },
            { name: 'numpy',          descKey: 'rt_lib_desc_numpy',          configurable: false },
            { name: 'p5',             descKey: 'rt_lib_desc_p5',             configurable: true  },
            { name: 'pandas',         descKey: 'rt_lib_desc_pandas',         configurable: true  },
            { name: 'processing',     descKey: 'rt_lib_desc_processing',     configurable: true  },
            { name: 'pygame',         descKey: 'rt_lib_desc_pygame',         configurable: false },
            { name: 'pgzrun',         descKey: 'rt_lib_desc_pgzrun',         configurable: false },
            { name: 'robot',          descKey: 'rt_lib_desc_robot',          configurable: false },
            { name: 'SimpleGraphics', descKey: 'rt_lib_desc_simplegraphics', configurable: false },
            { name: 'sqlite3',        descKey: 'rt_lib_desc_sqlite3',        configurable: true  },
            { name: 'soundfx',        descKey: 'rt_lib_desc_soundfx',        configurable: false },
            { name: 'tkinter',        descKey: 'rt_lib_desc_tkinter',        configurable: false },
            { name: 'turtle',         descKey: 'rt_lib_desc_turtle',         configurable: false },
            { name: 'withcode',       descKey: 'rt_lib_desc_withcode',       configurable: false },
            { name: 'os',             descKey: 'rt_lib_desc_os',             configurable: false },
            { name: 'PIL',            descKey: 'rt_lib_desc_pil',            configurable: false },
        ];

        var LS_KEY = 'epython_runtime_libs';

        function currentLang() {
            if (typeof selectedLang !== 'undefined' && selectedLang) return selectedLang;
            if (window.EpyLang && window.EpyLang.current) return window.EpyLang.current;
            return 'en';
        }

        function tr(key) {
            var lang = currentLang();
            var dict = (window.translations && window.translations[lang]) || {};
            if (dict[key]) return dict[key];
            var enDict = (window.translations && window.translations.en) || {};
            if (enDict[key]) return enDict[key];
            return key;
        }

        function getStoredLibs() {
            try {
                var val = localStorage.getItem(LS_KEY);
                if (val) return JSON.parse(val);
            } catch(e) {}
            // Defaults: p5, pandas, sqlite3, processing checked
            return { p5: true, pandas: true, sqlite3: true, processing: true };
        }

        function saveLibs(state) {
            try {
                localStorage.setItem(LS_KEY, JSON.stringify(state));
            } catch(e) {}
        }

        function buildTable() {
            var stored = getStoredLibs();
            var tbody = document.getElementById('rt_libs_tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            for (var i = 0; i < RT_LIBS.length; i++) {
                var lib = RT_LIBS[i];
                var trEl = document.createElement('tr');

                // Name
                var tdName = document.createElement('td');
                tdName.style.fontWeight = 'bold';
                tdName.style.fontFamily = 'monospace';
                tdName.textContent = lib.name;
                trEl.appendChild(tdName);

                // Description (localized)
                var tdDesc = document.createElement('td');
                tdDesc.textContent = tr(lib.descKey);
                trEl.appendChild(tdDesc);

                // Status — checkbox for all; disabled+checked for built-in, active for configurable
                var tdStatus = document.createElement('td');
                tdStatus.className = 'rt-checkbox-cell';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.id = 'rt_cb_' + lib.name;
                if (lib.configurable) {
                    cb.checked = !!stored[lib.name];
                    cb.disabled = false;
                    cb.style.cursor = 'pointer';
                    (function(libName, checkbox) {
                        checkbox.addEventListener('change', function() {
                            var s = getStoredLibs();
                            s[libName] = checkbox.checked;
                            saveLibs(s);
                        });
                    })(lib.name, cb);
                } else {
                    cb.checked = true;
                    cb.disabled = true;
                    cb.style.opacity = '0.5';
                    cb.style.cursor = 'default';
                }
                tdStatus.appendChild(cb);
                trEl.appendChild(tdStatus);

                tbody.appendChild(trEl);
            }
        }

        function openRuntimeDialog() {
            // Fill Skulpt version
            var el = document.getElementById('rt_skulpt_version');
            if (el) el.textContent = '1.3.0';

            buildTable();

            $('#runtime_env').dialog({
                modal: true,
                width: 620,
                maxHeight: 720,
                title: tr('runtime_env_title'),
                buttons: [
                    {
                        text: tr('exam_close_btn'),
                        click: function() { $(this).dialog('close'); }
                    }
                ]
            });
        }

        // Bind button after DOM ready
        $(document).ready(function() {
            $('#btn_open_runtime').on('click', function() {
                openRuntimeDialog();
            });
        });
    })();
var toolsVisible = false;
        $(function () {
            $('#loading').hide();
            $('#holder').show();
            PythonIDE.init('normal');
});
        
		function loadAsset() {
				
			const file = document.getElementById("asset-file").files[0];
			if (file.name.match(/\.(json)$/)) {				
				const reader = new FileReader();
				reader.addEventListener(
					"load",
					() => {
		
					PythonIDE.files['assets.json'] = reader.result;
					PythonIDE.editor.refresh();	
				},
				false,
				);
				if (file) {
					reader.readAsText(file);
				}
			}
		  else {
					PythonIDE.showHint((((typeof selectedLang !== 'undefined' ? selectedLang : (window.EpyLang && window.EpyLang.current)) || 'en') !== 'uk') ? "Unsupported file format" : "Непідтримуваний формат файлу");	
					
			}
				
		}
				
	function getFile() {
		const file = document.getElementById("choose-file").files[0];
		const reader = new FileReader();
		reader.addEventListener(
			"load",
			() => {
		// convert image file to base64 string
			localStorage.setItem(file.name,reader.result);
			},
			false,
		);

		if (file) {
			reader.readAsDataURL(file);
		}
	}

    let btnRun = document.querySelector("#btn_run");
    function runSketch(event) {
        runit();
    }
    btnRun.addEventListener('click', runSketch);

    function runit() { 
		document.querySelector("#myChart").style.display = "none";
		Sk.canvas = "myChart";
		Sk.p5Sketch = "p5Sketch";
        const cnvs = [...document.querySelectorAll(`[id^="defaultCanvas"]`),];
        cnvs.forEach((cnv) => {
            //cnv.style = "display:none";
            cnv.remove();
        });
    } 



$('#btn_PGZ').button().click(function() {
	openFileBrowser();	
	});
  






