/* 
 Matplotlib module for Skulpt, use Chart.js
*/

var $builtinmodule = function(name) {
	
	
	var xdata = []; // actually x and y data may contain multiple lines
	var ydata = [];
	var stylestring =[];
	var scatterData =[];
	var xValues = xdata[0];
	var yValues = ydata[0];
	var gridXview = true;
	var gridYview = true;
	var barColors = ["red", "green","blue","orange","brown"];
	var chart_title = "";
	var chart_title_fontsize = 16;   // plt.title(..., fontsize=..)
	var chart_title_color = undefined; // plt.title(..., color=..)
	var borderColor ="black"; // chart line color
	var linewidth = 1;      // chart line width
	var charts_type ="line";
	var label ="";
	var marker =false;
	var markerSize = 1;
	var lineDash = [];
	var pieLabels = false;
	var forceLegend = false; // встановлюється plt.legend()
	function $chart() {
				this.label = ""; 
				this.data = yValues; 				// дані осі OY
				this.backgroundColor = barColors;	// заповнення маркерів або стовпчиків
				this.borderColor = borderColor;	// колір лінії
				this.borderWidth = linewidth;		// ширина лінії
				this.borderDash = lineDash;		// штрихована лінія
				this.fill = false;				// заповнення під лінією
				this.pointStyle = marker;      	// стиль маркера
				this.pointRadius = markerSize; 	// розмір маркера
				this.tension = 0.0				// згладжування				
				
				}
	const Charts =[];   // data for all charts
	// axhline()/axvline() зберігаються окремо від Charts, бо це не
	// datasets графіка, а допоміжні лінії на весь плот (як у matplotlib) -
	// малюються плагіном Chart.js напряму по всій площі осей, тому не
	// прив'язані до діапазону даних і не потрапляють у легенду як пусті
	// кольорові квадратики.
	const axLines = [];
	var chartsNum = 0; // num of charts 

	// Плагін Chart.js, що малює axhline()/axvline() напряму на канвасі,
	// розтягуючи лінію на всю ширину/висоту поточної площі осей (chartArea).
	// Завдяки цьому лінія завжди сягає країв графіка незалежно від того,
	// який діапазон мають реальні дані (як і в справжньому matplotlib).
	if (typeof Chart !== 'undefined' && Chart.registry && !Chart.registry.plugins.get('axLinePlugin')) {
		Chart.register({
			id: 'axLinePlugin',
			afterDraw: function(chartInst) {
				var opts = chartInst.options.plugins && chartInst.options.plugins.axLinePlugin;
				var lines = (opts && opts.lines) || [];
				if (!lines.length) return;
				var ctx = chartInst.ctx;
				var area = chartInst.chartArea;
				var xScale = chartInst.scales.x;
				var yScale = chartInst.scales.y;
				if (!area || !xScale || !yScale) return;
				lines.forEach(function(ln) {
					ctx.save();
					ctx.beginPath();
					ctx.lineWidth = ln.width || 1;
					ctx.strokeStyle = ln.color || 'black';
					ctx.setLineDash(ln.dash && ln.dash.length ? ln.dash : []);
					if (ln.type === 'h') {
						var yPix = yScale.getPixelForValue(ln.value);
						ctx.moveTo(area.left, yPix);
						ctx.lineTo(area.right, yPix);
					} else {
						var xPix = xScale.getPixelForValue(ln.value);
						ctx.moveTo(xPix, area.top);
						ctx.lineTo(xPix, area.bottom);
					}
					ctx.stroke();
					ctx.restore();
				});
			}
		});
	}
	
  var mod = {};
  var chart;
  var canvas;
  var xLabelView = false;
  var xLabel = "";
  var yLabelView = false;
  var yLabel = "";
  // Межі осей, які встановлюються plt.xlim()/plt.ylim(). undefined = автомасштаб Chart.js.
  var xLimMin = undefined;
  var xLimMax = undefined;
  var yLimMin = undefined;
  var yLimMax = undefined;
 
  var CLASS_NDARRAY = "numpy.ndarray"; // maybe make identifier accessible in numpy module

  // ------------------------------------------------------------------
  // Кожна фігура (plt.show()) тепер малюється у своєму власному
  // jQuery UI dialog-вікні, а не в одному статичному канвасі сторінки.
  // Це дозволяє відкривати кілька графіків одночасно (як окремі вікна
  // matplotlib) і не втрачати попередні при повторному plt.show().
  var figureCounter = 0;        // лічильник фігур для унікальних id
  var lastCanvasEl = null;      // DOM-елемент канваса останньої намальованої фігури (потрібен для savefig)
  var lastChartInstance = null; // останній екземпляр Chart.js
  var lastRenderSpec = null;    // {type,data,options} останньої показаної фігури (для savefig після show())

  /*
   * Створює нове jQuery-діалогове вікно з канвасом усередині і повертає
   * DOM-елемент цього канваса. Якщо jQuery UI (.dialog) недоступний,
   * робимо fallback - просте плаваюче <div> вікно з можливістю закриття,
   * щоб функціональність все одно працювала.
   */
  var create_chart_dialog = function(title) {
    figureCounter++;
    var canvasId = "pltCanvas_" + figureCounter;
    var dialogId = "pltDialog_" + figureCounter;

    var $dialogDiv = $('<div id="' + dialogId + '"><canvas id="' + canvasId +
      '" width="600" height="450"></canvas></div>');
    $('body').append($dialogDiv);

    var dialogTitle = title && title.length ? title : ("Figure " + figureCounter);

    if (typeof $dialogDiv.dialog === 'function') {
      // jQuery UI доступний - використовуємо повноцінний dialog widget
      $dialogDiv.dialog({
        title: dialogTitle,
        width: 650,
        height: 540,
        modal: false,
        resizable: true,
        close: function() {
          // прибираємо DOM-вузли вікна після закриття, щоб не засмічувати сторінку
          $(this).dialog('destroy').remove();
        }
      });
    } else {
      // Fallback без jQuery UI: просте вікно з заголовком і кнопкою закриття
      $dialogDiv.css({
        position: 'fixed', top: '60px', left: '60px', width: '620px',
        background: '#fff', border: '1px solid #999', 'box-shadow': '0 2px 10px rgba(0,0,0,0.3)',
        'z-index': 9999, padding: '10px'
      });
      var $header = $('<div></div>').css({
        cursor: 'move', 'font-weight': 'bold', 'margin-bottom': '8px',
        'border-bottom': '1px solid #ccc', 'padding-bottom': '4px'
      }).text(dialogTitle);
      var $closeBtn = $('<button style="float:right;">\u2715</button>').on('click', function() {
        $dialogDiv.remove();
      });
      $header.append($closeBtn);
      $dialogDiv.prepend($header);
    }

    var canvasEl = document.getElementById(canvasId);
    lastCanvasEl = canvasEl;
    return canvasEl;
  };
// ------------------------------------------------------------------
 function unpackKWA(kwa) {
		result = {};

		for(var i = 0; i < kwa.length; i+=2) {
			var key = Sk.ffi.remapToJs(kwa[i]);
			console.log("key=",key);
			var val = kwa[i+1];
			console.log("val=",val);
			result[key] = val;
		}
		return result;
 }
// Style setup ***********************************************
function styleSetup(kwa) {
	function markerStyle(mark){			
		if (!mark) return "circle";
		switch (mark) {
			case '.':
				return false;
			case ',':
				return false;
			case 'o':
				return "circle";
			case 'v':
				return "triangle";
			case '^':
				return "triangle";
			case '<':
				return "triangle";
			case '>':
				return "triangle";
			case '1':
				return "circle";
			case '2':
				return "circle";
			case '3':
				return "circle";
			case '4':
				return "circle";
			case 's':
				return "rect";
			case 'p':
				return "rect";
			case '*':
				return "star";
			case 'h':
				return "rectRounded";
			case 'H':
				return "rectRounded";
			case '+':
				return "cross";
			case 'x':
				return "crossRot";
			case 'D':
				return "rectRot";
			case 'd':
				return "rectRot";
			case '|':
				return "dash";
			case '_':
				return "line";
			default:
				return false;
			}
	}
	
	function lineStyle(dash) {
		if (dash==='-') return [] // draw_solid
		if ((dash==='--')||(dash==='dashed')) return [10,10] // draw_dashed'
		if (dash==='-.') return [2,10,2] //draw_dash_dot
		if ((dash===':')||(dash==='dotted')) return [2,10]  // draw_dotted
		if (dash===' ')  return [] // no draw
    }

	self.props = unpackKWA(kwa);
	console.log("Props=",self.props);
	label = ""; // скидаємо label, щоб він не переносився з попереднього викову plot()
		if (self.props.color) {
		borderColor=Sk.ffi.remapToJs(self.props.color);
		console.log("color=",borderColor);
		}
	if (self.props.linewidth) {
		linewidth=Sk.ffi.remapToJs(self.props.linewidth);
		console.log("linewidth=",linewidth);
		}
	if (self.props.marker) {
		markerSize = 5;
		mark=Sk.ffi.remapToJs(self.props.marker);
		marker = markerStyle(mark);
		console.log("marker=",marker);
		}	
	if (self.props.linestyle) {
		linest=Sk.ffi.remapToJs(self.props.linestyle);
		lineDash=lineStyle(linest)
		console.log("linestyle=",lineDash); 			
		}
	if (self.props.ls) {
		linest=Sk.ffi.remapToJs(self.props.ls);
		lineDash=lineStyle(linest)
		console.log("linestyle=",lineDash); 			
		}
	if (self.props.markersize) {
		markerSize=Sk.ffi.remapToJs(self.props.markersize);
		console.log("markerSize=",markerSize); 			
		}
	if (self.props.label) {
		label=Sk.ffi.remapToJs(self.props.label);
		console.log("label=",label); 			
		}
	
}
// 
function GetParam(kwa,args) {
	
	styleSetup(kwa);
	kwargs = new Sk.builtins.dict(kwa); // is pretty useless for handling kwargs
    kwargs = Sk.ffi.remapToJs(kwargs); // create a proper dict
	console.log("KWA=",kwa);
	
    var i = 0;
    var xdata_not_ydata_flag = true;
    var slice = new Sk.builtin.slice(0, undefined, 1); // getting complete first dimension of ndarray

    for (i = 0; i < args.length; i++) {
	
      if (args[i] instanceof Sk.builtin.list || Sk.abstr.typeName(args[i]) === CLASS_NDARRAY || Sk.abstr.typeName(args[i])==='range') {
        // special treatment for ndarrays, though we allow basic lists too
        var _unpacked;
        if(Sk.abstr.typeName(args[i]) === CLASS_NDARRAY) {
          // we get the first dimension, no 2-dim data
          _unpacked = Sk.ffi.unwrapn(args[i]);
          var first_dim_size = 0;
          if(_unpacked && _unpacked.shape && _unpacked.shape[0]){
            first_dim_size = _unpacked.shape[0];
          } else {
            throw new Sk.builtin.ValueError('args contain "' + CLASS_NDARRAY + '" without elements or malformed shape.');
          }
          _unpacked = _unpacked.buffer.slice(0, first_dim_size); // buffer array of first dimension
          _unpacked = _unpacked.map(function(x) { return Sk.ffi.remapToJs(x);})
        } else {
          _unpacked = Sk.ffi.remapToJs(args[i]); // basic list
          console.log("unpacked=",_unpacked);
        }

        // unwraps x and y, but no 2-dim-data
        if (xdata_not_ydata_flag) {
          xdata.push(_unpacked);
          xdata_not_ydata_flag = false;
        } else {
          ydata.push(_unpacked);
          xdata_not_ydata_flag = true;
        }
      } else if (Sk.builtin.checkString(args[i])) {
        stylestring.push(Sk.ffi.remapToJs(args[i]));
      } else if (Sk.builtin.checkNumber(args[i])) {
          _unpacked = Sk.ffi.remapToJs(args[i]);
          var tempArray = [];
          tempArray.push(_unpacked);
          /**
           * Why do we need to push an single item array?
           *
           * Each Line is represented as an array of x values and an array of y values
           * so just calling plot with (x, y, fmt) would result in Line2D([x], [y], fmt)
           */
          if (xdata_not_ydata_flag) {
            xdata.push(tempArray);
            xdata_not_ydata_flag = false;
          } else {
            ydata.push(tempArray);
            xdata_not_ydata_flag = true;
          }
      } else {
        throw new Sk.builtin.TypeError("'" + Sk.abstr.typeName(args[i]) +
          "' is not supported for *args[" + i + "].");
      }
    }
    
    /* handle special cases
      only supplied y
      only supplied 1 array and stylestring
    */
    if ((args.length === 1) || (args.length === 2 && (xdata.length === 1 &&
      ydata.length === 0))) {
      // only y supplied
      
      xdata.forEach(function(element) {
        ydata.push(element);
      });
      
      xdata[0] = [];
      var ly=ydata[0].length;
      
      for (let i=0;i<ly;i++) {
	  xdata[0].push(i);
	  }
	  
    }
        console.log(">>xData=",xdata[0]); 
    console.log(">>yData=",ydata[0]);
	return
}

// Розпаковує один аргумент (ndarray/list/range) в звичайний JS-масив чисел.
// Використовується там, де потрібно розібрати кілька окремих масивів
// (наприклад fill_between(x, y1, y2)), а не пару x/y, як у GetParam().
function __unwrapSingleArrayArg(arg) {
  if (Sk.abstr.typeName(arg) === CLASS_NDARRAY) {
    var unpacked = Sk.ffi.unwrapn(arg);
    var first_dim_size = (unpacked && unpacked.shape && unpacked.shape[0]) ? unpacked.shape[0] : 0;
    if (!first_dim_size) {
      throw new Sk.builtin.ValueError('args contain "' + CLASS_NDARRAY + '" without elements or malformed shape.');
    }
    return unpacked.buffer.slice(0, first_dim_size).map(function(x) { return Sk.ffi.remapToJs(x); });
  } else if (arg instanceof Sk.builtin.list || Sk.abstr.typeName(arg) === 'range') {
    return Sk.ffi.remapToJs(arg);
  }
  return null; // не масив (наприклад число, або відсутній аргумент)
}

// Перетворює будь-який CSS-колір (назву, hex, rgb...) разом із alpha (0..1)
// у рядок rgba(...), щоб можна було реалізувати plt.fill_between(..., alpha=0.5).
// Використовує canvas для нормалізації кольору - надійно працює з будь-якою
// коректною CSS-назвою кольору (напр. "lightblue"), без ручного словника.
function __colorWithAlpha(color, alpha) {
  if (alpha === undefined || alpha === null) return color;
  try {
    var probe = document.createElement('canvas').getContext('2d');
    probe.fillStyle = color;
    var normalized = probe.fillStyle; // "#rrggbb" або "rgba(...)"
    var r = 0, g = 0, b = 0;
    if (normalized[0] === '#') {
      r = parseInt(normalized.slice(1, 3), 16);
      g = parseInt(normalized.slice(3, 5), 16);
      b = parseInt(normalized.slice(5, 7), 16);
    } else {
      var nums = normalized.match(/[\d.]+/g);
      if (nums) { r = +nums[0]; g = +nums[1]; b = +nums[2]; }
    }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  } catch (e) {
    return color; // якщо щось пішло не так - краще показати без прозорості, ніж падати
  }
}

// plot **********************************************
var plot = function(kwa) {
    Sk.builtin.pyCheckArgs("plotk", arguments, 1, Infinity, true, false);
    args = Array.prototype.slice.call(arguments, 1);
    GetParam(kwa, args);

    charts_type = "line"; // це все ще може бути, але використовується лише для зворотної сумісності
    chart$ = new $chart();
    chart$.label = label;
    chart$.data = ydata[chartsNum];
    // Маркери на лінії мають бути того ж кольору, що й сама лінія (borderColor),
    // а НЕ циклічною палітрою barColors (["red","green","blue","orange","brown"]) —
    // інакше Chart.js розфарбовує кожну точку лінії по черзі в різні кольори з палітри,
    // через що маркери не збігаються з кольором лінії/легенди.
    chart$.backgroundColor = borderColor;
    chart$.pointBackgroundColor = borderColor;
    chart$.pointBorderColor = borderColor;
    chart$.borderColor = borderColor;
    chart$.borderWidth = linewidth;
    chart$.borderDash = lineDash;
    chart$.fill = false;
    chart$.pointStyle = marker;
    chart$.pointRadius = markerSize;
    chart$.tension = 0.0;
    chart$.type = "line"; // <<< Додано: тип графіка для цього dataset

    Charts[chartsNum] = chart$;
    chartsNum++;
    var result = [];
    return new Sk.builtins.tuple(result);
};
plot.co_kwargs = true;
mod.plot = new Sk.builtin.func(plot);

// bar **********************************************
var bar = function(kwa) {
    Sk.builtin.pyCheckArgs("plotk", arguments, 1, Infinity, true, false);
    args = Array.prototype.slice.call(arguments, 1);
    GetParam(kwa, args);
    console.log("bar:");

    charts_type = "bar"; // залишаємо для зворотної сумісності, якщо використовується десь
    chart$ = new $chart();
    chart$.label = "";
    chart$.data = ydata[chartsNum];
    chart$.backgroundColor = barColors;
    chart$.borderColor = borderColor;
    chart$.borderWidth = linewidth;
    chart$.borderDash = lineDash;
    chart$.fill = false;
    chart$.pointStyle = marker;
    chart$.pointRadius = markerSize;
    chart$.tension = 0.0;
    chart$.type = "bar"; // <<< Додано: тип графіка для цього dataset

    Charts[chartsNum] = chart$;
    chartsNum++;
    var result = [];
    return new Sk.builtins.tuple(result);
};
bar.co_kwargs = true;
mod.bar = new Sk.builtin.func(bar);

// barh **********************************************
var barh = function(kwa) {
    Sk.builtin.pyCheckArgs("plotk", arguments, 1, Infinity, true, false);
    args = Array.prototype.slice.call(arguments, 1);
    GetParam(kwa, args);
    
    // Зберігаємо інформацію, що це горизонтальна діаграма
    chart$ = new $chart();
    chart$.label = "";
    chart$.data = ydata[chartsNum];
    chart$.backgroundColor = barColors;
    chart$.borderColor = borderColor;
    chart$.borderWidth = linewidth;
    chart$.borderDash = lineDash;
    chart$.fill = false;
    chart$.pointStyle = marker;
    chart$.pointRadius = markerSize;
    chart$.tension = 0.0;
    chart$.type = "bar"; // ← ТІЛЬКИ "bar"
    chart$.isHorizontal = true; // ← додатковий флаг

    Charts[chartsNum] = chart$;
    chartsNum++;
    var result = [];
    return new Sk.builtins.tuple(result);
};
barh.co_kwargs = true;
mod.barh = new Sk.builtin.func(barh);

// scatter **********************************************
var scatter = function(kwa) {
    Sk.builtin.pyCheckArgs("scatter", arguments, 1, Infinity, true, false);
    args = Array.prototype.slice.call(arguments, 1);
    
    // --- Отримуємо параметри (включаючи color) ---
    var kwargs = Sk.ffi.remapToJs(new Sk.builtins.dict(kwa));
    var color = kwargs.color ? Sk.ffi.remapToJs(kwargs.color) : "rgba(0,0,0,1)";

    GetParam(kwa, args); // це обновлює xdata, ydata, marker тощо

    // Створюємо масив {x, y}
    var data_scatter = [];
    var xs = xdata[chartsNum] || [];
    var ys = ydata[chartsNum] || [];
    var len = Math.min(xs.length, ys.length);
    for (var i = 0; i < len; i++) {
        data_scatter.push({ x: xs[i], y: ys[i] });
    }

    chart$ = new $chart();
    chart$.label = "";
    chart$.data = data_scatter;
    chart$.type = "line";
    chart$.showLine = false;
    chart$.pointStyle = "circle";
    chart$.pointRadius = 4;
    chart$.pointBackgroundColor = color;
    chart$.pointBorderColor = color;
    chart$.pointBorderWidth = 1;
    chart$.fill = false;
    chart$.borderWidth = 0;

    Charts[chartsNum] = chart$;
    chartsNum++;
    return Sk.ffi.remapToPy([]);
};
scatter.co_kwargs = true;
mod.scatter = new Sk.builtin.func(scatter);

// pie **********************************************
var pie = function(kwa) {
    Sk.builtin.pyCheckArgs("pie", arguments, 1, Infinity, true, false);
    var args = Array.prototype.slice.call(arguments, 1);

    // 1. sizes — завжди перший позиційний аргумент
    var sizes = args[0];
    var data = Sk.ffi.remapToJs(sizes);
    if (!Array.isArray(data)) data = [data];

    // 2. labels — шукаємо в kwa
    var labels = [];
    for (let i = 0; i < kwa.length; i += 2) {
        let keyObj = kwa[i];
        let valObj = kwa[i + 1];
        // Перетворюємо ключ на рядок
        let key = Sk.ffi.remapToJs(keyObj);
        if (key === "labels") {
            labels = Sk.ffi.remapToJs(valObj);
            pieLabels = true;
            if (!Array.isArray(labels)) labels = [labels];
            break;
        }
    }

    // 3. Якщо labels не знайдено — генеруємо індекси
    if (labels.length === 0) {
        labels = data.map((_, i) => i.toString());
        pieLabels = false;
    }

    // 4. Зберігаємо у глобальні масиви (для mod.show)
    xdata[chartsNum] = labels;
    ydata[chartsNum] = data;

    // 5. Створюємо об'єкт діаграми
    var chart$ = new $chart();
    chart$.label = "";
    chart$.data = data;
    chart$.backgroundColor = barColors;
    chart$.borderColor = borderColor;
    chart$.borderWidth = linewidth;
    chart$.borderDash = lineDash;
    chart$.fill = false;
    chart$.pointStyle = marker;
    chart$.pointRadius = markerSize;
    chart$.tension = 0.0;
    chart$.type = "pie";

    Charts[chartsNum] = chart$;
    chartsNum++;

    console.log("Pie ", data);
    console.log("Pie labels:", labels);

    return new Sk.builtins.tuple([]);
};
pie.co_kwargs = true;
mod.pie = new Sk.builtin.func(pie);
   
//***********************
// Будує повну специфікацію графіка (type/data/options) з поточного стану
// (Charts/xdata/ydata/chart_title/labels/...), нічого не змінюючи і нічого
// не малюючи. Використовується і в show() (малює у видиме вікно), і в
// savefig() (малює в офскрін-канвас), щоб обидва завжди давали однаковий
// результат незалежно від анімації/видимості діалогу.
var buildChartRenderSpec = function() {
    var hasPie = Charts.some(ds => ds.type === "pie");
    var hasBar = Charts.some(ds => ds.type === "bar");
    var isHorizontal = Charts.some(ds => ds.isHorizontal === true);

    var mainChartType = "line";
    if (hasPie) {
        mainChartType = "pie";
    } else if (hasBar) {
        mainChartType = "bar";
    }

    var yAxis = !hasPie;
    var xAxis = !hasPie;
    var indexAxis = isHorizontal ? "y" : "x";

    var chartData;
    var isNumericX = false;

    if (hasPie) {
        const labels = (xdata[0] && xdata[0].length) ? xdata[0] : ydata[0].map((_, i) => i);
        chartData = {
            labels: labels,
            datasets: Charts.map(ds => ({
                ...ds,
                data: ds.data
            }))
        };
    } else if (hasBar) {
        const labels = (xdata[0] && xdata[0].length) ? xdata[0] : ydata[0].map((_, i) => i.toString());
        const datasets = Charts.map((ds, i) => {
            return {
                ...ds,
                data: ydata[i] || []
            };
        });
        chartData = {
            labels: labels,
            datasets: datasets
        };
    } else {
        // Перевіряємо, чи X-дані першого набору справді числові.
        // Використовуємо Number(), а не parseFloat() — parseFloat("10:00") поверне 10
        // (парсить лише префікс рядка), через що всі часові підписи "10:00","10:05"...
        // перетворювались би на одне й те саме число і графік ставав вертикальною лінією.
        // Number("10:00") коректно дає NaN, бо вимагає, щоб ЦІЛИЙ рядок був числом.
        const firstXs = xdata[0] || [];
        isNumericX = firstXs.length > 0 && firstXs.every(function(v) {
            return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
        });

        const datasets = Charts.map((ds, i) => {
            let points = [];
            if (Array.isArray(ds.data) && ds.data.length > 0 && ds.data[0] && typeof ds.data[0].x !== 'undefined') {
                points = ds.data;
            } else if (isNumericX) {
                const xs = xdata[i] || [];
                const ys = ydata[i] || [];
                const len = Math.min(xs.length, ys.length);
                for (let j = 0; j < len; j++) {
                    const xVal = typeof xs[j] === 'number' ? xs[j] : parseFloat(xs[j]);
                    const yVal = typeof ys[j] === 'number' ? ys[j] : parseFloat(ys[j]);
                    if (!isNaN(xVal) && !isNaN(yVal)) {
                        points.push({ x: xVal, y: yVal });
                    }
                }
            } else {
                // категоріальний X (наприклад назви днів тижня) —
                // просто беремо Y як звичайні дані, підписи по X підуть через chartData.labels
                points = ydata[i] || [];
            }
            return {
                ...ds,
                data: points
            };
        });

        chartData = { datasets: datasets };
        if (!isNumericX) {
            chartData.labels = firstXs;
        }
    }

    var hasAnyLabel = Charts.some(ds => ds.label && ds.label.length > 0);
    var hasLabeledAxLine = axLines.some(ln => ln.label && ln.label.length > 0);
    var axLinesCopy = axLines.slice();

    var chartOptions = {
        indexAxis: indexAxis,
        responsive: true,
        plugins: {
            legend: { display: (hasPie && pieLabels) || hasAnyLabel || forceLegend || hasLabeledAxLine,
                      position: 'top',
                      labels: {
                        // Додаємо в легенду підписані axhline()/axvline(),
                        // хоча вони й не є звичайними datasets графіка.
                        // Лінії без label (як у axhline(0, color="black"))
                        // у легенду НЕ потрапляють - це узгоджується з
                        // поведінкою справжнього matplotlib.
                        generateLabels: function(chartInst) {
                          var items = Chart.defaults.plugins.legend.labels.generateLabels(chartInst);
                          axLinesCopy.forEach(function(ln) {
                            if (ln.label && ln.label.length > 0) {
                              items.push({
                                text: ln.label,
                                strokeStyle: ln.color,
                                fillStyle: ln.color,
                                lineWidth: ln.width,
                                lineDash: ln.dash,
                                pointStyle: 'line',
                                hidden: false
                              });
                            }
                          });
                          return items;
                        }
                      }
                    },
            title: {
                display: !!chart_title,
                text: chart_title,
                font: { size: chart_title_fontsize },
                color: chart_title_color
            },
            axLinePlugin: { lines: axLinesCopy }
        },
        layout: { padding: 30 }
    };

    if (!hasPie) {
        chartOptions.scales = {
            y: {
                display: yAxis,
                title: {
                    display: yLabelView,
                    text: yLabel,
                    font: { size: 16 }
                },
                grid: {
                    display: gridYview
                },
                ...(yLimMin !== undefined ? { min: yLimMin } : {}),
                ...(yLimMax !== undefined ? { max: yLimMax } : {}),
                ...(hasBar ? {} : { type: 'linear' })
            },
            x: {
                display: xAxis,
                title: {
                    display: xLabelView,
                    text: xLabel,
                    font: { size: 16 }
                },
                grid: {
                    display: gridXview
                },
                ...(xLimMin !== undefined ? { min: xLimMin } : {}),
                ...(xLimMax !== undefined ? { max: xLimMax } : {}),
                ...(hasBar || !isNumericX ? {} : { type: 'linear' })
            }
        };
    }

    return { type: mainChartType, data: chartData, options: chartOptions };
};

mod.show = new Sk.builtin.func(function() {
    var spec = buildChartRenderSpec();

    // Зберігаємо специфікацію останньої фігури - потрібна для plt.savefig(),
    // якщо його викличуть ПІСЛЯ show(), коли Charts/xdata/ydata вже скинуті.
    lastRenderSpec = spec;

    // Кожен plt.show() відкриває нове окреме jQuery-діалогове вікно
    // з власним канвасом всередині - так само, як matplotlib відкриває
    // окреме вікно фігури.
    var newCanvasEl = create_chart_dialog(chart_title);
    var newCtx = newCanvasEl.getContext('2d');

    lastChartInstance = new Chart(newCtx, spec);

    console.log('Chart displayed successfully');

    // Скидаємо стан для наступної фігури (в matplotlib кожен plt.show() "завершує"
    // поточну фігуру). Без цього дані з попереднього графіка (xdata/ydata/Charts)
    // залишались би і змішувались би з даними наступного plt.plot()/bar()/... у тому ж скрипті.
    xdata = [];
    ydata = [];
    stylestring = [];
    scatterData = [];
    Charts.length = 0;
    axLines.length = 0;
    chartsNum = 0;
    chart_title = "";
    chart_title_fontsize = 16;
    chart_title_color = undefined;
    borderColor = "black";
    linewidth = 1;
    label = "";
    marker = false;
    markerSize = 1;
    lineDash = [];
    pieLabels = false;
    forceLegend = false;
    xLabelView = false;
    xLabel = "";
    yLabelView = false;
    yLabel = "";
    xLimMin = undefined;
    xLimMax = undefined;
    yLimMin = undefined;
    yLimMax = undefined;
    gridXview = true;
    gridYview = true;
});
// ----------------------------------------------------------
// title(label, fontdict=None, loc=None, pad=None, *, y=None, **kwargs)
// Реальний matplotlib приймає купу іменованих аргументів (fontsize, color,
// fontweight, loc, pad, y ...). Тут ми не рендеримо все це у Chart.js, але
// маємо приймати їх без помилки, а fontsize/color - дійсно застосовувати.
var title_f = function(kwa) {
    Sk.builtin.pyCheckArgs("title", arguments, 1, Infinity, true, false);
    var args = Array.prototype.slice.call(arguments, 1);

    var label = args[0];
    if (!Sk.builtin.checkString(label)) {
      throw new Sk.builtin.TypeError("'" + Sk.abstr.typeName(label) +
        "' is not supported for title.");
    }

    var label_unwrap = Sk.ffi.remapToJs(label);
    chart_title = label_unwrap;

    // Скидаємо стиль заголовка на дефолтний перед розбором kwargs цього виклику
    chart_title_fontsize = 16;
    chart_title_color = undefined;

    if (kwa && kwa.length) {
      for (var i = 0; i < kwa.length; i += 2) {
        var key = Sk.ffi.remapToJs(kwa[i]);
        var val = kwa[i + 1];
        if (key === 'fontsize' || key === 'size') {
          chart_title_fontsize = Sk.ffi.remapToJs(val);
        } else if (key === 'color' || key === 'c') {
          chart_title_color = Sk.ffi.remapToJs(val);
        }
        // інші kwargs (fontweight, loc, pad, y, fontdict, fontstyle, ...)
        // приймаються заради сумісності сигнатури, але поки що ігноруються.
      }
    }

    console.log("Title=", label_unwrap);

    return new Sk.builtin.str(label_unwrap);
  };
  title_f.co_kwargs = true;
mod.title = new Sk.builtin.func(title_f);
  
// ---------------------------------------------------------------------------
var axis_f = function(label, fontdict, loc) {
    Sk.builtin.pyCheckArgs("axis", arguments, 0, 3);

    // when called without any arguments it should return the current axis limits
    // >>> axis(v)
    // sets the min and max of the x and y axes, with
    // ``v = [xmin, xmax, ymin, ymax]``.::
    //The xmin, xmax, ymin, ymax tuple is returned
    var res;

    return Sk.ffi.remapToPy([]);
  };

  axis_f.co_varnames = ['label', 'fontdict', 'loc', ];
  axis_f.$defaults = [null, Sk.builtin.none.none$, Sk.builtin.none.none$,
    Sk.builtin.none.none$
  ];
mod.axis = new Sk.builtin.func(axis_f);
// --------------------------------------------------------------------
var xlabel_f = function(s, fontdict, loc) {
  
    xLabelView=false;
	console.log("xLabel= ",s.v)
	if (s.v!=""){
		xLabel= s.v;
		xLabelView=true;
	}
	
  };

  xlabel_f.co_varnames = ['s', 'fontdict', 'loc','color', ];
  xlabel_f.$defaults = [null, Sk.builtin.none.none$, Sk.builtin.none.none$,  Sk.builtin.none.none$,
    Sk.builtin.none.none$
  ];
mod.xlabel = new Sk.builtin.func(xlabel_f);



var ylabel_f = function(s, fontdict, loc) {
  
    yLabelView=false;
	console.log("yLabel= ",s.v)
	if (s.v!=""){
		yLabel= s.v;
		yLabelView=true;
	}
  };

  ylabel_f.co_varnames = ['s', 'fontdict', 'loc', 'color',];
  ylabel_f.$defaults = [null, Sk.builtin.none.none$, Sk.builtin.none.none$,  Sk.builtin.none.none$,
    Sk.builtin.none.none$
  ];
mod.ylabel = new Sk.builtin.func(ylabel_f);
// --------------------------------------------
// grid(visible=None, which='major', axis='both', **kwargs)
// Підтримує позиційний або keyword visible/b (True/False), та keyword axis='both'|'x'|'y'.
// Стильові kwargs (linestyle, alpha, color) приймаються (щоб не було TypeError),
// але поки що не впливають на вигляд сітки Chart.js.
var grid = function(kwa) {
	var args = Array.prototype.slice.call(arguments, 1);
	var props = {};
	if (kwa && kwa.length) {
		for (var i = 0; i < kwa.length; i += 2) {
			var key = Sk.ffi.remapToJs(kwa[i]);
			props[key] = kwa[i + 1];
		}
	}

	// Визначаємо бажаний стан (увімкнути/вимкнути). Якщо не передано жодного
	// значення - вважаємо True (типова поведінка виклику grid() без аргументів).
	var visible = true;
	if (args.length > 0 && args[0] !== undefined && args[0] !== Sk.builtin.none.none$) {
		visible = Sk.misceval.isTrue(args[0]);
	} else if (props.visible !== undefined) {
		visible = Sk.misceval.isTrue(props.visible);
	} else if (props.b !== undefined) {
		visible = Sk.misceval.isTrue(props.b);
	}

	// Вісь, до якої застосовується сітка
	var axis = 'both';
	if (props.axis !== undefined) {
		axis = Sk.ffi.remapToJs(props.axis);
	}

	console.log("grid: visible=", visible, " axis=", axis);

	if (axis === 'both' || axis === 'x') {
		gridXview = visible;
	}
	if (axis === 'both' || axis === 'y') {
		gridYview = visible;
	}
  };

grid.co_kwargs = true;
mod.grid = new Sk.builtin.func(grid);
// Clear the current figure ------------------------------------------------------
  var clf_f = function() {
    // clear all - скидаємо накопичені дані поточної (ще не показаної) фігури.
    // Вже відкриті jQuery-діалоги з попередніх plt.show() не зачіпаються,
    // так само як в matplotlib clf() очищає лише поточну figure, а не
    // вже намальовані/показані вікна.
    chart = null;

    xdata = [];
    ydata = [];
    stylestring = [];
    scatterData = [];
    Charts.length = 0;
    axLines.length = 0;
    chartsNum = 0;
    chart_title = "";
    chart_title_fontsize = 16;
    chart_title_color = undefined;
    borderColor = "black";
    linewidth = 1;
    label = "";
    marker = false;
    markerSize = 1;
    lineDash = [];
    pieLabels = false;
    forceLegend = false;
    xLabelView = false;
    xLabel = "";
    yLabelView = false;
    yLabel = "";
    xLimMin = undefined;
    xLimMax = undefined;
    yLimMin = undefined;
    yLimMax = undefined;
    gridXview = true;
    gridYview = true;
  };

  mod.clf = new Sk.builtin.func(clf_f);
//


  
  
// ---------------------------------------------------------------------
  /* list of not implemented methods */
  mod.findobj = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "findobj is not yet implemented");
  });
  mod.switch_backend = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "switch_backend is not yet implemented");
  });
  mod.isinteractive = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "isinteractive is not yet implemented");
  });
  mod.ioff = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "ioff is not yet implemented");
  });
  mod.ion = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("ion is not yet implemented");
  });
  mod.pause = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "pause is not yet implemented");
  });
  mod.rc = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("rc is not yet implemented");
  });
  mod.rc_context = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "rc_context is not yet implemented");
  });
  mod.rcdefaults = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "rcdefaults is not yet implemented");
  });
  mod.gci = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("gci is not yet implemented");
  });
  mod.sci = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("sci is not yet implemented");
  });
  mod.xkcd = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "xkcd is not yet implemented");
  });
  mod.figure = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "figure is not yet implemented");
  });
  mod.gcf = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("gcf is not yet implemented");
  });
  mod.get_fignums = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "get_fignums is not yet implemented");
  });
  mod.get_figlabels = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "get_figlabels is not yet implemented");
  });
  mod.get_current_fig_manager = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "get_current_fig_manager is not yet implemented");
  });
  mod.connect = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "connect is not yet implemented");
  });
  mod.disconnect = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "disconnect is not yet implemented");
  });
  mod.close = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "close is not yet implemented");
  });
  var savefig_f = function(fname, dpi, format, bbox_inches, transparent, facecolor) {
    // fname - шлях/ім'я файлу. Решта аргументів matplotlib (dpi, format,
    // bbox_inches тощо) приймаються заради сумісності сигнатури; dpi
    // додатково впливає на розмір збереженого растру. За замовчуванням
    // (як у справжньому matplotlib) фон збереженого зображення - білий;
    // transparent=True вимикає заливку фону, facecolor="..." задає інший колір.

    // Визначаємо, яку фігуру зберігати:
    // 1) якщо є ще не показані дані (plt.plot(...) без наступного show()) -
    //    будуємо свіжу специфікацію графіка прямо з поточного стану;
    // 2) інакше беремо специфікацію останньої показаної (plt.show()) фігури.
    var spec = null;
    if (Charts.length > 0) {
      spec = buildChartRenderSpec();
    } else if (lastRenderSpec) {
      spec = lastRenderSpec;
    } else {
      throw new Sk.builtin.OperationError(
        "savefig: немає жодної фігури для збереження. Спочатку побудуйте графік (plt.plot()/plt.bar()/...).");
    }

    var filename = "figure.png";
    if (fname !== undefined && fname !== Sk.builtin.none.none$) {
      filename = Sk.ffi.remapToJs(fname);
      if (!/\.[a-zA-Z0-9]+$/.test(filename)) {
        filename += ".png"; // matplotlib за замовчуванням теж дописує розширення
      }
    }

    var scale = 1;
    if (dpi !== undefined && dpi !== Sk.builtin.none.none$) {
      var dpiVal = Sk.ffi.remapToJs(dpi);
      if (typeof dpiVal === 'number' && dpiVal > 0) {
        scale = dpiVal / 100; // matplotlib за замовчуванням рахує від 100 dpi
      }
    }

    var isTransparent = false;
    if (transparent !== undefined && transparent !== Sk.builtin.none.none$) {
      isTransparent = Sk.misceval.isTrue(transparent);
    }
    var bgColor = "white"; // дефолт matplotlib (rcParams['savefig.facecolor'] == фон фігури, білий)
    if (facecolor !== undefined && facecolor !== Sk.builtin.none.none$) {
      bgColor = Sk.ffi.remapToJs(facecolor);
    }

    try {
      // Малюємо в ПРИХОВАНИЙ офскрін-канвас з вимкненою анімацією та
      // responsive:false (фіксований піксельний розмір). Це критично:
      // видимий канвас у jQuery-діалозі анімує появу даних кількома
      // кадрами (requestAnimationFrame), тож toDataURL(), викликаний одразу
      // після show(), захоплював би ще порожній перший кадр. При
      // animation:false Chart.js малює графік синхронно за один виклик,
      // тож знімок завжди повний.
      var offCanvas = document.createElement('canvas');
      offCanvas.width = Math.round(800 * scale);
      offCanvas.height = Math.round(600 * scale);
      var offCtx = offCanvas.getContext('2d');

      var offOptions = JSON.parse(JSON.stringify(spec.options));
      offOptions.responsive = false;
      offOptions.maintainAspectRatio = false;
      offOptions.animation = false;

      var offChart = new Chart(offCtx, {
        type: spec.type,
        data: spec.data,
        options: offOptions
      });

      // Canvas за замовчуванням прозорий - Chart.js малює тільки самі
      // елементи графіка. Щоб отримати білий (чи інший) фон, як у
      // справжнього matplotlib, домальовуємо суцільну заливку ПІД уже
      // намальованим графіком через destination-over: там, де вже є
      // непрозорі пікселі графіка, вони лишаються зверху, а порожні
      // (прозорі) ділянки канваса стають кольору bgColor.
      if (!isTransparent) {
        offCtx.save();
        offCtx.globalCompositeOperation = 'destination-over';
        offCtx.fillStyle = bgColor;
        offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        offCtx.restore();
      }

      var dataURL = offCanvas.toDataURL("image/png");
      offChart.destroy();

      var link = document.createElement('a');
      link.href = dataURL;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log("savefig: збережено як " + filename + (isTransparent ? " (прозорий фон)" : " (фон: " + bgColor + ")"));
    } catch (e) {
      throw new Sk.builtin.OperationError("savefig: не вдалося зберегти зображення (" + e + ")");
    }

    return Sk.builtin.none.none$;
  };
  savefig_f.co_varnames = ['fname', 'dpi', 'format', 'bbox_inches', 'transparent', 'facecolor'];
  savefig_f.$defaults = [Sk.builtin.none.none$, Sk.builtin.none.none$,
    Sk.builtin.none.none$, Sk.builtin.none.none$, Sk.builtin.none.none$,
    Sk.builtin.none.none$
  ];
  mod.savefig = new Sk.builtin.func(savefig_f);
  mod.ginput = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "ginput is not yet implemented");
  });
  mod.waitforbuttonpress = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "waitforbuttonpress is not yet implemented");
  });
  mod.figtext = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "figtext is not yet implemented");
  });
  mod.suptitle = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "suptitle is not yet implemented");
  });
  mod.figimage = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "figimage is not yet implemented");
  });
  mod.figlegend = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "figlegend is not yet implemented");
  });
  mod.hold = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "hold is not yet implemented");
  });
  mod.ishold = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "ishold is not yet implemented");
  });
  mod.over = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "over is not yet implemented");
  });
  mod.delaxes = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "delaxes is not yet implemented");
  });
  mod.sca = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("sca is not yet implemented");
  });
  mod.gca = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("gca is not yet implemented");
  });
  mod.subplot = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "subplot is not yet implemented");
  });
  mod.subplots = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "subplots is not yet implemented");
  });
  mod.subplot2grid = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "subplot2grid is not yet implemented");
  });
  mod.twinx = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "twinx is not yet implemented");
  });
  mod.twiny = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "twiny is not yet implemented");
  });
  mod.subplots_adjust = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "subplots_adjust is not yet implemented");
  });
  mod.subplot_tool = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "subplot_tool is not yet implemented");
  });
  mod.tight_layout = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "tight_layout is not yet implemented");
  });
  mod.box = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("box is not yet implemented");
  });
  mod.xlim = new Sk.builtin.func(function() {
    var posArgs = Array.prototype.slice.call(arguments, 0);
    if (posArgs.length === 0) {
      return new Sk.builtins.tuple([
        Sk.ffi.remapToPy(xLimMin === undefined ? null : xLimMin),
        Sk.ffi.remapToPy(xLimMax === undefined ? null : xLimMax)
      ]);
    }
    if (posArgs.length === 1 &&
        (posArgs[0] instanceof Sk.builtin.tuple || posArgs[0] instanceof Sk.builtin.list)) {
      var pair = Sk.ffi.remapToJs(posArgs[0]);
      xLimMin = pair[0];
      xLimMax = pair[1];
    } else {
      xLimMin = Sk.ffi.remapToJs(posArgs[0]);
      xLimMax = posArgs.length > 1 ? Sk.ffi.remapToJs(posArgs[1]) : xLimMax;
    }
    var result = [];
    return new Sk.builtins.tuple(result);
  });
  mod.ylim = new Sk.builtin.func(function() {
    var posArgs = Array.prototype.slice.call(arguments, 0);
    // ylim() без аргументів - просто повертає поточні межі, тут не критично.
    if (posArgs.length === 0) {
      return new Sk.builtins.tuple([
        Sk.ffi.remapToPy(yLimMin === undefined ? null : yLimMin),
        Sk.ffi.remapToPy(yLimMax === undefined ? null : yLimMax)
      ]);
    }
    if (posArgs.length === 1 &&
        (posArgs[0] instanceof Sk.builtin.tuple || posArgs[0] instanceof Sk.builtin.list)) {
      var pair = Sk.ffi.remapToJs(posArgs[0]);
      yLimMin = pair[0];
      yLimMax = pair[1];
    } else {
      yLimMin = Sk.ffi.remapToJs(posArgs[0]);
      yLimMax = posArgs.length > 1 ? Sk.ffi.remapToJs(posArgs[1]) : yLimMax;
    }
    var result = [];
    return new Sk.builtins.tuple(result);
  });
  mod.xscale = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "xscale is not yet implemented");
  });
  mod.yscale = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "yscale is not yet implemented");
  });
  mod.xticks = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "xticks is not yet implemented");
  });
  mod.yticks = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "yticks is not yet implemented");
  });
  mod.minorticks_on = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "minorticks_on is not yet implemented");
  });
  mod.minorticks_off = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "minorticks_off is not yet implemented");
  });
  mod.rgrids = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "rgrids is not yet implemented");
  });
  mod.thetagrids = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "thetagrids is not yet implemented");
  });
  mod.plotting = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "plotting is not yet implemented");
  });
  mod.get_plot_commands = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "get_plot_commands is not yet implemented");
  });
  mod.colors = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "colors is not yet implemented");
  });
  mod.colormaps = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "colormaps is not yet implemented");
  });
  mod._setup_pyplot_info_docstrings = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "_setup_pyplot_info_docstrings is not yet implemented");
  });
  mod.colorbar = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "colorbar is not yet implemented");
  });
  mod.clim = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "clim is not yet implemented");
  });
  mod.set_cmap = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "set_cmap is not yet implemented");
  });
  mod.imread = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "imread is not yet implemented");
  });
  mod.imsave = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "imsave is not yet implemented");
  });
  mod.matshow = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "matshow is not yet implemented");
  });
  mod.polar = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "polar is not yet implemented");
  });
  mod.plotfile = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "plotfile is not yet implemented");
  });
  mod._autogen_docstring = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "_autogen_docstring is not yet implemented");
  });
  mod.acorr = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "acorr is not yet implemented");
  });
  mod.arrow = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "arrow is not yet implemented");
  });
  var axhline = function(kwa) {
    Sk.builtin.pyCheckArgs("axhline", arguments, 0, Infinity, true, false);
    var posArgs = Array.prototype.slice.call(arguments, 1);
    styleSetup(kwa);

    var yVal = 0; // за замовчуванням, як у справжньому matplotlib
    if (posArgs.length > 0 && Sk.builtin.checkNumber(posArgs[0])) {
      yVal = Sk.ffi.remapToJs(posArgs[0]);
    }

    axLines.push({
      type: 'h',
      value: yVal,
      color: borderColor,
      width: linewidth,
      dash: lineDash,
      label: label
    });

    var result = [];
    return new Sk.builtins.tuple(result);
  };
  axhline.co_kwargs = true;
  mod.axhline = new Sk.builtin.func(axhline);

  mod.axhspan = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "axhspan is not yet implemented");
  });

  var axvline = function(kwa) {
    Sk.builtin.pyCheckArgs("axvline", arguments, 0, Infinity, true, false);
    var posArgs = Array.prototype.slice.call(arguments, 1);
    styleSetup(kwa);

    var xVal = 0; // за замовчуванням, як у справжньому matplotlib
    if (posArgs.length > 0 && Sk.builtin.checkNumber(posArgs[0])) {
      xVal = Sk.ffi.remapToJs(posArgs[0]);
    }

    axLines.push({
      type: 'v',
      value: xVal,
      color: borderColor,
      width: linewidth,
      dash: lineDash,
      label: label
    });

    var result = [];
    return new Sk.builtins.tuple(result);
  };
  axvline.co_kwargs = true;
  mod.axvline = new Sk.builtin.func(axvline);
  mod.axvspan = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "axvspan is not yet implemented");
  });

  mod.broken_barh = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "broken_barh is not yet implemented");
  });
  mod.boxplot = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "boxplot is not yet implemented");
  });
  mod.cohere = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "cohere is not yet implemented");
  });
  mod.clabel = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "clabel is not yet implemented");
  });
  mod.contour = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "contour is not yet implemented");
  });
  mod.contourf = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "contourf is not yet implemented");
  });
  mod.csd = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("csd is not yet implemented");
  });
  mod.errorbar = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "errorbar is not yet implemented");
  });
  mod.eventplot = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "eventplot is not yet implemented");
  });
  mod.fill = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "fill is not yet implemented");
  });
  var fill_between = function(kwa) {
    Sk.builtin.pyCheckArgs("fill_between", arguments, 1, Infinity, true, false);
    var posArgs = Array.prototype.slice.call(arguments, 1);
    styleSetup(kwa);

    // alpha не обробляється у styleSetup(), тому дістаємо його окремо з kwargs.
    var kwargsJs = Sk.ffi.remapToJs(new Sk.builtins.dict(kwa));
    var alpha = (kwargsJs.alpha !== undefined) ? kwargsJs.alpha : undefined;

    var xs = __unwrapSingleArrayArg(posArgs[0]);
    if (xs === null) {
      throw new Sk.builtin.TypeError("fill_between() очікує масив/список як перший аргумент (x)");
    }

    var y1 = (posArgs.length > 1) ? __unwrapSingleArrayArg(posArgs[1]) : null;
    if (y1 === null && posArgs.length > 1 && Sk.builtin.checkNumber(posArgs[1])) {
      var y1v = Sk.ffi.remapToJs(posArgs[1]);
      y1 = xs.map(function() { return y1v; });
    }
    if (y1 === null) y1 = xs.map(function() { return 0; });

    var y2;
    if (posArgs.length > 2) {
      y2 = __unwrapSingleArrayArg(posArgs[2]);
      if (y2 === null && Sk.builtin.checkNumber(posArgs[2])) {
        var y2v = Sk.ffi.remapToJs(posArgs[2]);
        y2 = xs.map(function() { return y2v; });
      }
    }
    if (y2 === null || y2 === undefined) {
      y2 = xs.map(function() { return 0; });
    }

    var fillColor = __colorWithAlpha(borderColor, alpha);

    // Реалізуємо як дві "невидимі" лінії (верхня межа y1 та нижня межа y2),
    // де верхня заповнюється кольором до нижньої (fill: '+1' - до наступного
    // dataset у списку Charts). Обидві без обвідки та без маркерів, щоб
    // виглядало саме як залита область, а не дві лінії.
    var baseLine = new $chart();
    baseLine.label = "";
    baseLine.data = xs.map(function(xv, i) { return { x: xv, y: y2[i] }; });
    baseLine.borderColor = "rgba(0,0,0,0)";
    baseLine.backgroundColor = "rgba(0,0,0,0)";
    baseLine.pointStyle = false;
    baseLine.pointRadius = 0;
    baseLine.borderWidth = 0;
    baseLine.fill = false;
    baseLine.tension = 0.0;
    baseLine.type = "line";

    // xdata[i] тримаємо в парі з Charts[i], як і решта функцій графіка -
    // це потрібно, щоб isNumericX коректно визначив вісь X як числову,
    // навіть якщо fill_between() - перший виклик на новому графіку.
    xdata[chartsNum] = xs;
    ydata[chartsNum] = y2;
    Charts[chartsNum] = baseLine;
    chartsNum++;

    var topLine = new $chart();
    topLine.label = label;
    topLine.data = xs.map(function(xv, i) { return { x: xv, y: y1[i] }; });
    topLine.borderColor = "rgba(0,0,0,0)";
    topLine.backgroundColor = fillColor;
    topLine.pointStyle = false;
    topLine.pointRadius = 0;
    topLine.borderWidth = 0;
    topLine.fill = "-1"; // заповнити до попереднього dataset (baseLine)
    topLine.tension = 0.0;
    topLine.type = "line";

    xdata[chartsNum] = xs;
    ydata[chartsNum] = y1;
    Charts[chartsNum] = topLine;
    chartsNum++;

    var result = [];
    return new Sk.builtins.tuple(result);
  };
  fill_between.co_kwargs = true;
  mod.fill_between = new Sk.builtin.func(fill_between);
  mod.fill_betweenx = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "fill_betweenx is not yet implemented");
  });
  mod.hexbin = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "hexbin is not yet implemented");
  });

// hist **********************************************
var hist = function(kwa) {
    Sk.builtin.pyCheckArgs("hist", arguments, 1, Infinity, true, false);
    args = Array.prototype.slice.call(arguments, 1);

    // Отримуємо дані (тільки y, бо це гістограма)
    GetParam(kwa, args);
    console.log("hist input ydata =", ydata[chartsNum]);

    var data = ydata[chartsNum];
    
    // Параметри гістограми: bins (кількість відер)
    let kwargs = Sk.ffi.remapToJs(new Sk.builtins.dict(kwa));
    let bins = kwargs.bins || 10; // за замовчуванням 10
    if (typeof bins !== 'number') {
        bins = Sk.ffi.remapToJs(bins);
    }

    // Обчислення гістограми
    let min = Math.min(...data);
    let max = Math.max(...data);
    let binSize = (max - min) / bins;

    let binEdges = [];
    let counts = new Array(bins).fill(0);

    for (let i = 0; i <= bins; i++) {
        binEdges.push(min + i * binSize);
    }

    data.forEach(val => {
        let index = Math.floor((val - min) / binSize);
        if (index === bins) index = bins - 1; // включаємо max у останній бін
        counts[index]++;
    });

    // Підготовка даних
    let binLabels = [];
    for (let i = 0; i < bins; i++) {
        let left = binEdges[i].toFixed(2);
        let right = binEdges[i + 1].toFixed(2);
        binLabels.push(`${left}–${right}`);
    }

    xdata[chartsNum] = binLabels;
    ydata[chartsNum] = counts;

    charts_type = "hist";
    chart$ = new $chart();
    // Підпис береться лише якщо його явно передали через label=,
    // як і для решти видів графіків. Без цього легенда з'являлася
    // сама по собі навіть без plt.legend().
    chart$.label = kwargs.label || "";
    chart$.type = "bar"; // ← ОСНОВНЕ ВИПРАВЛЕННЯ!
    // Уникаємо невидимих стовпців
    let visibleCounts = counts.map(c => (c === 0 ? 0.5 : c));
    chart$.data = visibleCounts;    
    chart$.backgroundColor = barColors;
    chart$.borderColor = borderColor;
    chart$.borderWidth = linewidth;
    chart$.borderDash = lineDash;
    chart$.fill = false;
    chart$.pointStyle = marker;
    chart$.pointRadius = markerSize;
    chart$.tension = 0.0;

    chart$.barPercentage = 1.0;
    chart$.categoryPercentage = 1.0;

    Charts[chartsNum] = chart$;
    chartsNum++;

    var result = [];
    return new Sk.builtins.tuple(result);
};
hist.co_kwargs = true;
mod.hist = new Sk.builtin.func(hist);

  /*
  mod.hist = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "hist is not yet implemented");
  });
  */
  mod.hist2d = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "hist2d is not yet implemented");
  });
  mod.hlines = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "hlines is not yet implemented");
  });
  mod.loglog = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "loglog is not yet implemented");
  });
  mod.magnitude_spectrum = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "magnitude_spectrum is not yet implemented");
  });
  mod.pcolor = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "pcolor is not yet implemented");
  });
  mod.pcolormesh = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "pcolormesh is not yet implemented");
  });
  mod.phase_spectrum = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "phase_spectrum is not yet implemented");
  });

  mod.plot_date = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "plot_date is not yet implemented");
  });
  mod.psd = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("psd is not yet implemented");
  });
  mod.quiver = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "quiver is not yet implemented");
  });
  mod.quiverkey = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "quiverkey is not yet implemented");
  });
  mod.semilogx = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "semilogx is not yet implemented");
  });
  mod.semilogy = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "semilogy is not yet implemented");
  });
  mod.specgram = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "specgram is not yet implemented");
  });
  mod.stackplot = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "stackplot is not yet implemented");
  });
  mod.stem = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "stem is not yet implemented");
  });
  mod.step = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "step is not yet implemented");
  });
  mod.streamplot = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "streamplot is not yet implemented");
  });
  mod.tricontour = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "tricontour is not yet implemented");
  });
  mod.tricontourf = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "tricontourf is not yet implemented");
  });
  mod.tripcolor = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "tripcolor is not yet implemented");
  });
  mod.triplot = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "triplot is not yet implemented");
  });
  mod.vlines = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "vlines is not yet implemented");
  });
  mod.xcorr = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "xcorr is not yet implemented");
  });
  mod.barbs = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "barbs is not yet implemented");
  });
  mod.cla = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("cla is not yet implemented");
  });
  mod.legend = new Sk.builtin.func(function() {
    // plt.legend() у справжньому matplotlib просто увімкнув би легенду.
    // У нас легенда й так автоматично показується, якщо хоч у одного датасета
    // є label (див. hasAnyLabel у show()), тож тут достатньо примусово
    // увімкнути прапорець forceLegend і нічого не кидати - будь-які
    // аргументи/kwargs (loc, fontsize, ncol тощо) просто ігноруються.
    forceLegend = true;
    return Sk.builtin.none.none$;
  });
  mod.table = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "table is not yet implemented");
  });
  mod.text = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "text is not yet implemented");
  });
  mod.annotate = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "annotate is not yet implemented");
  });
  mod.ticklabel_format = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "ticklabel_format is not yet implemented");
  });
  mod.locator_params = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "locator_params is not yet implemented");
  });
  mod.tick_params = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "tick_params is not yet implemented");
  });
  mod.margins = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "margins is not yet implemented");
  });
  mod.autoscale = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "autoscale is not yet implemented");
  });
  mod.autumn = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "autumn is not yet implemented");
  });
  mod.cool = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "cool is not yet implemented");
  });
  mod.copper = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "copper is not yet implemented");
  });
  mod.flag = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "flag is not yet implemented");
  });
  mod.gray = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "gray is not yet implemented");
  });
  mod.hot = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("hot is not yet implemented");
  });
  mod.hsv = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("hsv is not yet implemented");
  });
  mod.jet = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError("jet is not yet implemented");
  });
  mod.pink = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "pink is not yet implemented");
  });
  mod.prism = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "prism is not yet implemented");
  });
  mod.spring = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "spring is not yet implemented");
  });
  mod.summer = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "summer is not yet implemented");
  });
  mod.winter = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "winter is not yet implemented");
  });
  mod.spectral = new Sk.builtin.func(function() {
    throw new Sk.builtin.NotImplementedError(
      "spectral is not yet implemented");
  });

  return mod;
};
