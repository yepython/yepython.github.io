// added functions -------------------------
    (function() {
        // Library definitions
        var RT_LIBS = [
            { name: 'arduino',        desc: 'Симулятор Arduino',			      configurable: false },
            { name: 'matplotlib',     desc: 'Побудова графіків і діаграм',        configurable: false },
            { name: 'microbit',       desc: 'Симулятор micro:bit',                configurable: false },
            { name: 'music',          desc: 'Відтворення музики / MML',           configurable: false },
            { name: 'numpy',          desc: 'Числові масиви та математика',       configurable: false },
            { name: 'p5',             desc: 'Графіка p5 (p5-python)',             configurable: true  },
            { name: 'pandas',         desc: 'Аналіз та обробка даних',            configurable: true  },
            { name: 'processing',     desc: 'Графіка Processing',				  configurable: true  },
            { name: 'pygame',         desc: 'Розробка ігор Pygame',               configurable: false },
            { name: 'pgzrun',         desc: 'Pygame Zero — спрощена Pygame',      configurable: false },
            { name: 'SimpleGraphics', desc: 'Проста графіка(simlegraphics-python)',configurable: false },
            { name: 'sqlite3',        desc: 'Робота з базами даних SQLite',       configurable: true  },
            { name: 'soundfx',        desc: 'Звукові ефекти',                     configurable: false },
            { name: 'tkinter',        desc: 'Створення GUI з Tkinter',            configurable: false },
            { name: 'turtle',         desc: 'Черепашача графіка',                 configurable: false },
            { name: 'withcode',       desc: 'Додаткові засоби WithCode',          configurable: false },
            { name: 'os',             desc: 'Робота з файловою системою',         configurable: false },
        ];

        var LS_KEY = 'epython_runtime_libs';

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
                var tr = document.createElement('tr');

                // Name
                var tdName = document.createElement('td');
                tdName.style.fontWeight = 'bold';
                tdName.style.fontFamily = 'monospace';
                tdName.textContent = lib.name;
                tr.appendChild(tdName);

                // Description
                var tdDesc = document.createElement('td');
                tdDesc.textContent = lib.desc;
                tr.appendChild(tdDesc);

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
                tr.appendChild(tdStatus);

                tbody.appendChild(tr);
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
                title: 'Середовище виконання',
                buttons: [
                    {
                        text: 'Закрити',
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
					PythonIDE.showHint("Непідтримуваний формат файлу");	
					
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
  






