// Tkinter module for Skulpt. Pete Dring, 2015-2018, Gr.Gromko, 2020-2024
var $builtinmodule = function(name) {
	// clear all previous frames
	$('.tkinter').remove();
    // adapted from https://www.tcl.tk/man/tcl8.4/TkCmd/colors.htm
    var tk_colors={"alice blue":"#f0f8ff",AliceBlue:"#f0f8ff","antique white":"#faebd7",AntiqueWhite:"#faebd7",AntiqueWhite1:"#ffefdb",AntiqueWhite2:"#eedfcc",AntiqueWhite3:"#cdc0b0",AntiqueWhite4:"#8b8378",aquamarine:"#7fffd4",aquamarine1:"#7fffd4",aquamarine2:"#76eec6",aquamarine3:"#66cdaa",aquamarine4:"#458b74",azure:"#f0ffff",azure1:"#f0ffff",azure2:"#e0eeee",azure3:"#c1cdcd",azure4:"#838b8b",beige:"#f5f5dc",bisque:"#ffe4c4",bisque1:"#ffe4c4",bisque2:"#eed5b7",bisque3:"#cdb79e",bisque4:"#8b7d6b",black:"#000000","blanched almond":"#ffebcd",BlanchedAlmond:"#ffebcd",blue:"#0000ff","blue violet":"#8a2be2",blue1:"#0000ff",blue2:"#0000ee",blue3:"#0000cd",blue4:"#00008b",BlueViolet:"#8a2be2",brown:"#a52a2a",brown1:"#ff4040",brown2:"#ee3b3b",brown3:"#cd3333",brown4:"#8b2323",burlywood:"#deb887",burlywood1:"#ffd39b",burlywood2:"#eec591",burlywood3:"#cdaa7d",burlywood4:"#8b7355","cadet blue":"#5f9ea0",CadetBlue:"#5f9ea0",CadetBlue1:"#98f5ff",CadetBlue2:"#8ee5ee",CadetBlue3:"#7ac5cd",CadetBlue4:"#53868b",chartreuse:"#7fff00",chartreuse1:"#7fff00",chartreuse2:"#76ee00",chartreuse3:"#66cd00",chartreuse4:"#458b00",chocolate:"#d2691e",chocolate1:"#ff7f24",chocolate2:"#ee7621",chocolate3:"#cd661d",chocolate4:"#8b4513",coral:"#ff7f50",coral1:"#ff7256",coral2:"#ee6a50",coral3:"#cd5b45",coral4:"#8b3e2f","cornflower blue":"#6495ed",CornflowerBlue:"#6495ed",cornsilk:"#fff8dc",cornsilk1:"#fff8dc",cornsilk2:"#eee8cd",cornsilk3:"#cdc8b1",cornsilk4:"#8b8878",cyan:"#00ffff",cyan1:"#00ffff",cyan2:"#00eeee",cyan3:"#00cdcd",cyan4:"#008b8b","dark blue":"#00008b","dark cyan":"#008b8b","dark goldenrod":"#b8860b","dark gray":"#a9a9a9","dark green":"#006400","dark grey":"#a9a9a9","dark khaki":"#bdb76b","dark magenta":"#8b008b","dark olive green":"#556b2f","dark orange":"#ff8c00","dark orchid":"#9932cc","dark red":"#8b0000","dark salmon":"#e9967a","dark sea green":"#8fbc8f","dark slate blue":"#483d8b","dark slate gray":"#2f4f4f","dark slate grey":"#2f4f4f","dark turquoise":"#00ced1","dark violet":"#9400d3",DarkBlue:"#00008b",DarkCyan:"#008b8b",DarkGoldenrod:"#b8860b",DarkGoldenrod1:"#ffb90f",DarkGoldenrod2:"#eead0e",DarkGoldenrod3:"#cd950c",DarkGoldenrod4:"#8b6508",DarkGray:"#a9a9a9",DarkGreen:"#006400",DarkGrey:"#a9a9a9",DarkKhaki:"#bdb76b",DarkMagenta:"#8b008b",DarkOliveGreen:"#556b2f",DarkOliveGreen1:"#caff70",DarkOliveGreen2:"#bcee68",DarkOliveGreen3:"#a2cd5a",DarkOliveGreen4:"#6e8b3d",DarkOrange:"#ff8c00",DarkOrange1:"#ff7f00",DarkOrange2:"#ee7600",DarkOrange3:"#cd6600",DarkOrange4:"#8b4500",DarkOrchid:"#9932cc",DarkOrchid1:"#bf3eff",DarkOrchid2:"#b23aee",DarkOrchid3:"#9a32cd",DarkOrchid4:"#68228b",DarkRed:"#8b0000",DarkSalmon:"#e9967a",DarkSeaGreen:"#8fbc8f",DarkSeaGreen1:"#c1ffc1",DarkSeaGreen2:"#b4eeb4",DarkSeaGreen3:"#9bcd9b",DarkSeaGreen4:"#698b69",DarkSlateBlue:"#483d8b",DarkSlateGray:"#2f4f4f",DarkSlateGray1:"#97ffff",DarkSlateGray2:"#8deeee",DarkSlateGray3:"#79cdcd",DarkSlateGray4:"#528b8b",DarkSlateGrey:"#2f4f4f",DarkTurquoise:"#00ced1",DarkViolet:"#9400d3","deep pink":"#ff1493","deep sky blue":"#00bfff",DeepPink:"#ff1493",DeepPink1:"#ff1493",DeepPink2:"#ee1289",DeepPink3:"#cd1076",DeepPink4:"#8b0a50",DeepSkyBlue:"#00bfff",DeepSkyBlue1:"#00bfff",DeepSkyBlue2:"#00b2ee",DeepSkyBlue3:"#009acd",DeepSkyBlue4:"#00688b","dim gray":"#696969","dim grey":"#696969",DimGray:"#696969",DimGrey:"#696969","dodger blue":"#1e90ff",DodgerBlue:"#1e90ff",DodgerBlue1:"#1e90ff",DodgerBlue2:"#1c86ee",DodgerBlue3:"#1874cd",DodgerBlue4:"#104e8b",firebrick:"#b22222",firebrick1:"#ff3030",firebrick2:"#ee2c2c",firebrick3:"#cd2626",firebrick4:"#8b1a1a","floral white":"#fffaf0",FloralWhite:"#fffaf0","forest green":"#228b22",ForestGreen:"#228b22",gainsboro:"#dcdcdc","ghost white":"#f8f8ff",GhostWhite:"#f8f8ff",gold:"#ffd700",gold1:"#ffd700",gold2:"#eec900",gold3:"#cdad00",gold4:"#8b7500",goldenrod:"#daa520",goldenrod1:"#ffc125",goldenrod2:"#eeb422",goldenrod3:"#cd9b1d",goldenrod4:"#8b6914",gray:"#bebebe",gray0:"#000000",gray1:"#030303",gray2:"#050505",gray3:"#080808",gray4:"#0a0a0a",gray5:"#0d0d0d",gray6:"#0f0f0f",gray7:"#121212",gray8:"#141414",gray9:"#171717",gray10:"#1a1a1a",gray11:"#1c1c1c",gray12:"#1f1f1f",gray13:"#212121",gray14:"#242424",gray15:"#262626",gray16:"#292929",gray17:"#2b2b2b",gray18:"#2e2e2e",gray19:"#303030",gray20:"#333333",gray21:"#363636",gray22:"#383838",gray23:"#3b3b3b",gray24:"#3d3d3d",gray25:"#404040",gray26:"#424242",gray27:"#454545",gray28:"#474747",gray29:"#4a4a4a",gray30:"#4d4d4d",gray31:"#4f4f4f",gray32:"#525252",gray33:"#545454",gray34:"#575757",gray35:"#595959",gray36:"#5c5c5c",gray37:"#5e5e5e",gray38:"#616161",gray39:"#636363",gray40:"#666666",gray41:"#696969",gray42:"#6b6b6b",gray43:"#6e6e6e",gray44:"#707070",gray45:"#737373",gray46:"#757575",gray47:"#787878",gray48:"#7a7a7a",gray49:"#7d7d7d",gray50:"#7f7f7f",gray51:"#828282",gray52:"#858585",gray53:"#878787",gray54:"#8a8a8a",gray55:"#8c8c8c",gray56:"#8f8f8f",gray57:"#919191",gray58:"#949494",gray59:"#969696",gray60:"#999999",gray61:"#9c9c9c",gray62:"#9e9e9e",gray63:"#a1a1a1",gray64:"#a3a3a3",gray65:"#a6a6a6",gray66:"#a8a8a8",gray67:"#ababab",gray68:"#adadad",gray69:"#b0b0b0",gray70:"#b3b3b3",gray71:"#b5b5b5",gray72:"#b8b8b8",gray73:"#bababa",gray74:"#bdbdbd",gray75:"#bfbfbf",gray76:"#c2c2c2",gray77:"#c4c4c4",gray78:"#c7c7c7",gray79:"#c9c9c9",gray80:"#cccccc",gray81:"#cfcfcf",gray82:"#d1d1d1",gray83:"#d4d4d4",gray84:"#d6d6d6",gray85:"#d9d9d9",gray86:"#dbdbdb",gray87:"#dedede",gray88:"#e0e0e0",gray89:"#e3e3e3",gray90:"#e5e5e5",gray91:"#e8e8e8",gray92:"#ebebeb",gray93:"#ededed",gray94:"#f0f0f0",gray95:"#f2f2f2",gray96:"#f5f5f5",gray97:"#f7f7f7",gray98:"#fafafa",gray99:"#fcfcfc",gray100:"#ffffff",green:"#00ff00","green yellow":"#adff2f",green1:"#00ff00",green2:"#00ee00",green3:"#00cd00",green4:"#008b00",GreenYellow:"#adff2f",grey:"#bebebe",grey0:"#000000",grey1:"#030303",grey2:"#050505",grey3:"#080808",grey4:"#0a0a0a",grey5:"#0d0d0d",grey6:"#0f0f0f",grey7:"#121212",grey8:"#141414",grey9:"#171717",grey10:"#1a1a1a",grey11:"#1c1c1c",grey12:"#1f1f1f",grey13:"#212121",grey14:"#242424",grey15:"#262626",grey16:"#292929",grey17:"#2b2b2b",grey18:"#2e2e2e",grey19:"#303030",grey20:"#333333",grey21:"#363636",grey22:"#383838",grey23:"#3b3b3b",grey24:"#3d3d3d",grey25:"#404040",grey26:"#424242",grey27:"#454545",grey28:"#474747",grey29:"#4a4a4a",grey30:"#4d4d4d",grey31:"#4f4f4f",grey32:"#525252",grey33:"#545454",grey34:"#575757",grey35:"#595959",grey36:"#5c5c5c",grey37:"#5e5e5e",grey38:"#616161",grey39:"#636363",grey40:"#666666",grey41:"#696969",grey42:"#6b6b6b",grey43:"#6e6e6e",grey44:"#707070",grey45:"#737373",grey46:"#757575",grey47:"#787878",grey48:"#7a7a7a",grey49:"#7d7d7d",grey50:"#7f7f7f",grey51:"#828282",grey52:"#858585",grey53:"#878787",grey54:"#8a8a8a",grey55:"#8c8c8c",grey56:"#8f8f8f",grey57:"#919191",grey58:"#949494",grey59:"#969696",grey60:"#999999",grey61:"#9c9c9c",grey62:"#9e9e9e",grey63:"#a1a1a1",grey64:"#a3a3a3",grey65:"#a6a6a6",grey66:"#a8a8a8",grey67:"#ababab",grey68:"#adadad",grey69:"#b0b0b0",grey70:"#b3b3b3",grey71:"#b5b5b5",grey72:"#b8b8b8",grey73:"#bababa",grey74:"#bdbdbd",grey75:"#bfbfbf",grey76:"#c2c2c2",grey77:"#c4c4c4",grey78:"#c7c7c7",grey79:"#c9c9c9",grey80:"#cccccc",grey81:"#cfcfcf",grey82:"#d1d1d1",grey83:"#d4d4d4",grey84:"#d6d6d6",grey85:"#d9d9d9",grey86:"#dbdbdb",grey87:"#dedede",grey88:"#e0e0e0",grey89:"#e3e3e3",grey90:"#e5e5e5",grey91:"#e8e8e8",grey92:"#ebebeb",grey93:"#ededed",grey94:"#f0f0f0",grey95:"#f2f2f2",grey96:"#f5f5f5",grey97:"#f7f7f7",grey98:"#fafafa",grey99:"#fcfcfc",grey100:"#ffffff",honeydew:"#f0fff0",honeydew1:"#f0fff0",honeydew2:"#e0eee0",honeydew3:"#c1cdc1",honeydew4:"#838b83","hot pink":"#ff69b4",HotPink:"#ff69b4",HotPink1:"#ff6eb4",HotPink2:"#ee6aa7",HotPink3:"#cd6090",HotPink4:"#8b3a62","indian red":"#cd5c5c",IndianRed:"#cd5c5c",IndianRed1:"#ff6a6a",IndianRed2:"#ee6363",IndianRed3:"#cd5555",IndianRed4:"#8b3a3a",ivory:"#fffff0",ivory1:"#fffff0",ivory2:"#eeeee0",ivory3:"#cdcdc1",ivory4:"#8b8b83",khaki:"#f0e68c",khaki1:"#fff68f",khaki2:"#eee685",khaki3:"#cdc673",khaki4:"#8b864e",lavender:"#e6e6fa","lavender blush":"#fff0f5",LavenderBlush:"#fff0f5",LavenderBlush1:"#fff0f5",LavenderBlush2:"#eee0e5",LavenderBlush3:"#cdc1c5",LavenderBlush4:"#8b8386","lawn green":"#7cfc00",LawnGreen:"#7cfc00","lemon chiffon":"#fffacd",LemonChiffon:"#fffacd",LemonChiffon1:"#fffacd",LemonChiffon2:"#eee9bf",LemonChiffon3:"#cdc9a5",LemonChiffon4:"#8b8970","light blue":"#add8e6","light coral":"#f08080","light cyan":"#e0ffff","light goldenrod":"#eedd82","light goldenrod yellow":"#fafad2","light gray":"#d3d3d3","light green":"#90ee90","light grey":"#d3d3d3","light pink":"#ffb6c1","light salmon":"#ffa07a","light sea green":"#20b2aa","light sky blue":"#87cefa","light slate blue":"#8470ff","light slate gray":"#778899","light slate grey":"#778899","light steel blue":"#b0c4de","light yellow":"#ffffe0",LightBlue:"#add8e6",LightBlue1:"#bfefff",LightBlue2:"#b2dfee",LightBlue3:"#9ac0cd",LightBlue4:"#68838b",LightCoral:"#f08080",LightCyan:"#e0ffff",LightCyan1:"#e0ffff",LightCyan2:"#d1eeee",LightCyan3:"#b4cdcd",LightCyan4:"#7a8b8b",LightGoldenrod:"#eedd82",LightGoldenrod1:"#ffec8b",LightGoldenrod2:"#eedc82",LightGoldenrod3:"#cdbe70",LightGoldenrod4:"#8b814c",LightGoldenrodYellow:"#fafad2",LightGray:"#d3d3d3",LightGreen:"#90ee90",LightGrey:"#d3d3d3",LightPink:"#ffb6c1",LightPink1:"#ffaeb9",LightPink2:"#eea2ad",LightPink3:"#cd8c95",LightPink4:"#8b5f65",LightSalmon:"#ffa07a",LightSalmon1:"#ffa07a",LightSalmon2:"#ee9572",LightSalmon3:"#cd8162",LightSalmon4:"#8b5742",LightSeaGreen:"#20b2aa",LightSkyBlue:"#87cefa",LightSkyBlue1:"#b0e2ff",LightSkyBlue2:"#a4d3ee",LightSkyBlue3:"#8db6cd",LightSkyBlue4:"#607b8b",LightSlateBlue:"#8470ff",LightSlateGray:"#778899",LightSlateGrey:"#778899",LightSteelBlue:"#b0c4de",LightSteelBlue1:"#cae1ff",LightSteelBlue2:"#bcd2ee",LightSteelBlue3:"#a2b5cd",LightSteelBlue4:"#6e7b8b",LightYellow:"#ffffe0",LightYellow1:"#ffffe0",LightYellow2:"#eeeed1",LightYellow3:"#cdcdb4",LightYellow4:"#8b8b7a","lime green":"#32cd32",LimeGreen:"#32cd32",linen:"#faf0e6",magenta:"#ff00ff",magenta1:"#ff00ff",magenta2:"#ee00ee",magenta3:"#cd00cd",magenta4:"#8b008b",maroon:"#b03060",maroon1:"#ff34b3",maroon2:"#ee30a7",maroon3:"#cd2990",maroon4:"#8b1c62","medium aquamarine":"#66cdaa","medium blue":"#0000cd","medium orchid":"#ba55d3","medium purple":"#9370db","medium sea green":"#3cb371","medium slate blue":"#7b68ee","medium spring green":"#00fa9a","medium turquoise":"#48d1cc","medium violet red":"#c71585",MediumAquamarine:"#66cdaa",MediumBlue:"#0000cd",MediumOrchid:"#ba55d3",MediumOrchid1:"#e066ff",MediumOrchid2:"#d15fee",MediumOrchid3:"#b452cd",MediumOrchid4:"#7a378b",MediumPurple:"#9370db",MediumPurple1:"#ab82ff",MediumPurple2:"#9f79ee",MediumPurple3:"#8968cd",MediumPurple4:"#5d478b",MediumSeaGreen:"#3cb371",MediumSlateBlue:"#7b68ee",MediumSpringGreen:"#00fa9a",MediumTurquoise:"#48d1cc",MediumVioletRed:"#c71585","midnight blue":"#191970",MidnightBlue:"#191970","mint cream":"#f5fffa",MintCream:"#f5fffa","misty rose":"#ffe4e1",MistyRose:"#ffe4e1",MistyRose1:"#ffe4e1",MistyRose2:"#eed5d2",MistyRose3:"#cdb7b5",MistyRose4:"#8b7d7b",moccasin:"#ffe4b5","navajo white":"#ffdead",NavajoWhite:"#ffdead",NavajoWhite1:"#ffdead",NavajoWhite2:"#eecfa1",NavajoWhite3:"#cdb38b",NavajoWhite4:"#8b795e",navy:"#000080","navy blue":"#000080",NavyBlue:"#000080","old lace":"#fdf5e6",OldLace:"#fdf5e6","olive drab":"#6b8e23",OliveDrab:"#6b8e23",OliveDrab1:"#c0ff3e",OliveDrab2:"#b3ee3a",OliveDrab3:"#9acd32",OliveDrab4:"#698b22",orange:"#ffa500","orange red":"#ff4500",orange1:"#ffa500",orange2:"#ee9a00",orange3:"#cd8500",orange4:"#8b5a00",OrangeRed:"#ff4500",OrangeRed1:"#ff4500",OrangeRed2:"#ee4000",OrangeRed3:"#cd3700",OrangeRed4:"#8b2500",orchid:"#da70d6",orchid1:"#ff83fa",orchid2:"#ee7ae9",orchid3:"#cd69c9",orchid4:"#8b4789","pale goldenrod":"#eee8aa","pale green":"#98fb98","pale turquoise":"#afeeee","pale violet red":"#db7093",PaleGoldenrod:"#eee8aa",PaleGreen:"#98fb98",PaleGreen1:"#9aff9a",PaleGreen2:"#90ee90",PaleGreen3:"#7ccd7c",PaleGreen4:"#548b54",PaleTurquoise:"#afeeee",PaleTurquoise1:"#bbffff",PaleTurquoise2:"#aeeeee",PaleTurquoise3:"#96cdcd",PaleTurquoise4:"#668b8b",PaleVioletRed:"#db7093",PaleVioletRed1:"#ff82ab",PaleVioletRed2:"#ee799f",PaleVioletRed3:"#cd687f",PaleVioletRed4:"#8b475d","papaya whip":"#ffefd5",PapayaWhip:"#ffefd5","peach puff":"#ffdab9",PeachPuff:"#ffdab9",PeachPuff1:"#ffdab9",PeachPuff2:"#eecbad",PeachPuff3:"#cdaf95",PeachPuff4:"#8b7765",peru:"#cd853f",pink:"#ffc0cb",pink1:"#ffb5c5",pink2:"#eea9b8",pink3:"#cd919e",pink4:"#8b636c",plum:"#dda0dd",plum1:"#ffbbff",plum2:"#eeaeee",plum3:"#cd96cd",plum4:"#8b668b","powder blue":"#b0e0e6",PowderBlue:"#b0e0e6",purple:"#a020f0",purple1:"#9b30ff",purple2:"#912cee",purple3:"#7d26cd",purple4:"#551a8b",red:"#ff0000",red1:"#ff0000",red2:"#ee0000",red3:"#cd0000",red4:"#8b0000","rosy brown":"#bc8f8f",RosyBrown:"#bc8f8f",RosyBrown1:"#ffc1c1",RosyBrown2:"#eeb4b4",RosyBrown3:"#cd9b9b",RosyBrown4:"#8b6969","royal blue":"#4169e1",RoyalBlue:"#4169e1",RoyalBlue1:"#4876ff",RoyalBlue2:"#436eee",RoyalBlue3:"#3a5fcd",RoyalBlue4:"#27408b","saddle brown":"#8b4513",SaddleBrown:"#8b4513",salmon:"#fa8072",salmon1:"#ff8c69",salmon2:"#ee8262",salmon3:"#cd7054",salmon4:"#8b4c39","sandy brown":"#f4a460",SandyBrown:"#f4a460","sea green":"#2e8b57",SeaGreen:"#2e8b57",SeaGreen1:"#54ff9f",SeaGreen2:"#4eee94",SeaGreen3:"#43cd80",SeaGreen4:"#2e8b57",seashell:"#fff5ee",seashell1:"#fff5ee",seashell2:"#eee5de",seashell3:"#cdc5bf",seashell4:"#8b8682",sienna:"#a0522d",sienna1:"#ff8247",sienna2:"#ee7942",sienna3:"#cd6839",sienna4:"#8b4726","sky blue":"#87ceeb",SkyBlue:"#87ceeb",SkyBlue1:"#87ceff",SkyBlue2:"#7ec0ee",SkyBlue3:"#6ca6cd",SkyBlue4:"#4a708b","slate blue":"#6a5acd","slate gray":"#708090","slate grey":"#708090",SlateBlue:"#6a5acd",SlateBlue1:"#836fff",SlateBlue2:"#7a67ee",SlateBlue3:"#6959cd",SlateBlue4:"#473c8b",SlateGray:"#708090",SlateGray1:"#c6e2ff",SlateGray2:"#b9d3ee",SlateGray3:"#9fb6cd",SlateGray4:"#6c7b8b",SlateGrey:"#708090",snow:"#fffafa",snow1:"#fffafa",snow2:"#eee9e9",snow3:"#cdc9c9",snow4:"#8b8989","spring green":"#00ff7f",SpringGreen:"#00ff7f",SpringGreen1:"#00ff7f",SpringGreen2:"#00ee76",SpringGreen3:"#00cd66",SpringGreen4:"#008b45","steel blue":"#4682b4",SteelBlue:"#4682b4",SteelBlue1:"#63b8ff",SteelBlue2:"#5cacee",SteelBlue3:"#4f94cd",SteelBlue4:"#36648b",tan:"#d2b48c",tan1:"#ffa54f",tan2:"#ee9a49",tan3:"#cd853f",tan4:"#8b5a2b",thistle:"#d8bfd8",thistle1:"#ffe1ff",thistle2:"#eed2ee",thistle3:"#cdb5cd",thistle4:"#8b7b8b",tomato:"#ff6347",tomato1:"#ff6347",tomato2:"#ee5c42",tomato3:"#cd4f39",tomato4:"#8b3626",turquoise:"#40e0d0",turquoise1:"#00f5ff",turquoise2:"#00e5ee",turquoise3:"#00c5cd",turquoise4:"#00868b",violet:"#ee82ee","violet red":"#d02090",VioletRed:"#d02090",VioletRed1:"#ff3e96",VioletRed2:"#ee3a8c",VioletRed3:"#cd3278",VioletRed4:"#8b2252",wheat:"#f5deb3",wheat1:"#ffe7ba",wheat2:"#eed8ae",wheat3:"#cdba96",wheat4:"#8b7e66",white:"#ffffff","white smoke":"#f5f5f5",WhiteSmoke:"#f5f5f5",yellow:"#ffff00","yellow green":"#9acd32",yellow1:"#ffff00",yellow2:"#eeee00",yellow3:"#cdcd00",yellow4:"#8b8b00",YellowGreen:"#9acd32"};

	var idCount = 0;
	var varCount = 0;
	var firstRoot = 0;

	var widgets = [];
	var variables = [];
	var timeouts = [];

	var cleanup = function() {
		for (var i = 0; i < timeouts.length; i++) {
			clearTimeout(timeouts[i]);
		}
	}
	var s = {};

    // Ініціалізація файлової системи, якщо її ще немає
    if (!Sk.__jsfs) {
		console.log("Ініціалізація файлової системи")
        Sk.__jsfs = new window.FileSystem("epythonfs");
    }


	function forceDomReflow() {
		document.body.offsetHeight;
		window.dispatchEvent(new Event('resize'));
	}

	// Повертає data-URL для PhotoImage-об'єкта (self.props.image).
	// ВАЖЛИВО: не можна покладатись на неявне приведення до рядка
	// (JS `+` / `String(...)`) для екземплярів, створених через
	// Sk.misceval.buildClass — їх "рідний" JS toString() не гарантовано
	// викликає Python __str__ і на практиці повертає "[object Object]",
	// через що <img src="..."> лишається порожнім місцем. Тому читаємо
	// JS-властивість $dataUrl напряму — її PhotoImage.__init__ встановлює
	// на екземпляр одразу при створенні.
	function photoImageSrc(img) {
		if (img == null) {
			return "";
		}
		if (img.$dataUrl) {
			return img.$dataUrl;
		}
		// резервний варіант для нестандартних об'єктів
		try {
			return Sk.ffi.remapToJs(Sk.misceval.callsimOrSuspend(
				Sk.abstr.gattr(img, new Sk.builtin.str("__str__"))
			));
		} catch (e) {
			return "";
		}
	}
	// Повертає {width, height} у пікселях для PhotoImage-об'єкта, або null,
	// якщо розмір невідомий. Використовується, щоб підганяти розмір
	// Label/Button під РЕАЛЬНИЙ розмір картинки (а не через max-width:100%,
	// який у вкладених flex-контейнерах з невизначеною шириною класично
	// призводить до схлопування <img> у 0 — та не через 'ch'-розмір
	// тексту, який лишається значно меншим за фактичну картинку).
	function photoImageSize(img) {
		if (img && img.$width && img.$height) {
			return { width: img.$width, height: img.$height };
		}
		return null;
	}
	// Будує рядок <img>, одразу ставлячи ЯВНИЙ піксельний width/height зі
	// self.$width/$height PhotoImage-об'єкта (photoImageSize) — а НЕ
	// покладаючись на <img>.naturalWidth/Height, які браузер визначає
	// АСИНХРОННО (одразу після встановлення src декодування ще не
	// завершено: naturalWidth/Height = 0, img.complete = false). Без цього
	// будь-яке вимірювання розміру контейнера "по вмісту" (наприклад,
	// layoutPack() у config(image=...)) синхронно бачить порожню картинку
	// й виставляє контейнеру нульову висоту — саме так вона й "спливала",
	// перекриваючи сусідні віджети.
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

	function getColor(c) {
		var cName = c.replace(/ /g, "")
		if (tk_colors && tk_colors[cName]) {
			return tk_colors[cName];
		}
		return c;
	}
	// ----------------------------
	var applyWidgetStyles = function(self) {
		/* Apply common widget properties:
		 * justify
		 * padx
		 * pady
		 * bd
		 * fg
		 * bg
		 * relief
		 * font
		 * width
		 * height
		 * text
		 */
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
		
		// Примусове центрування за замовчуванням стосується лише
		// текстових написів (self.props.text, напр. Label/Button), а не
		// self.props.textarea (Text) — справжній tkinter.Text за
		// замовчуванням вирівнює текст ЛІВОРУЧ, а не по центру.
		// (self.props.justify, якщо заданий, уже застосований вище.)
		if (self.props.text) {
			if (!(self.props.justify)) {
				e.css('text-align', 'center');
			}
		} else if (self.props.textarea && !(self.props.justify)) {
			e.css('text-align', 'left');
		}

		if (self.props.width) {			
			let width = Sk.ffi.remapToJs(self.props.width);
            if (e.hasClass("tk_charsized")) {
                // У справжньому tkinter width= для Button/Label — це
                // МІНІМАЛЬНА ширина в символах, а не фіксована: якщо
                // текст довший за задану ширину, віджет РОЗТЯГУЄТЬСЯ під
                // текст (текст ніколи не обрізається). Раніше тут стояло
                // 'width' (жорстка ширина), через що довгий текст
                // ("Дуже-дуже довгий текст на кнопці") просто обрізався
                // замість того, щоб кнопка стала ширшою. min-width дає
                // саме потрібну поведінку: фактична ширина = max(ширина
                // під текст, задана width), як і в реальному Tk.
                e.css({ 'min-width': width + 'ch', 'width': '', 'white-space': 'nowrap' });
            }
			else {
				e.css('width', width + 'px');
			}
		}

		if (self.props.height) {
			let height = Sk.ffi.remapToJs(self.props.height);           
            if (e.hasClass("tk_charsized")) { 
                mh = 1;
                if (e.is("button")) { mh = 1.25;}              
                e.css('height', height * mh + 'em');
            }
			else {
				e.css('height', height + 'px');
			}
        }

		// wraplength= (Label/Button/Message тощо) раніше взагалі не
		// підтримувався — текст ніколи не переносився на новий рядок.
		// У справжньому tkinter це ЖОРСТКА ширина переносу в пікселях,
		// однакова незалежно від контейнера. КРИТИЧНО ставити це ДО
		// того, як layoutPack() зніме офскрін-мірку reqW/reqH (тобто
		// зараз, у applyWidgetStyles — вона виконується РАНІШЕ, під час
		// commonDisplay): 'max-width' лишається інлайн-стилем елемента
		// і продовжує діяти навіть коли layoutPack тимчасово переносить
		// елемент у position:absolute; left:-99999px для вимірювання —
		// тому висота багаторядкового тексту рахується ПРАВИЛЬНО одразу,
		// а не як один суцільний рядок (що й спричиняло накладання
		// preview-картинки на текст status: reqH зі status рахувався як
		// один рядок ~20px, а насправді текст займав 2-3 рядки).
		// Також знімаємо 'white-space: nowrap', який width= (вище)
		// примусово ставить для tk_charsized-елементів (Button/Label) —
		// інакше перенос рядків буде заблокований навіть з max-width.
		if (self.props.wraplength) {
			let wraplength = parseFloat(Sk.ffi.remapToJs(self.props.wraplength));
			if (!isNaN(wraplength) && wraplength > 0) {
				e.css({
					'max-width': wraplength + 'px',
					'min-width': '',
					// pre-line: і переносить довгі рядки по словах (як
					// wraplength у справжньому tkinter), і водночас
					// зберігає РУЧНІ переноси рядків (\n у тексті) — на
					// відміну від 'normal', який \n просто схлопує в
					// пробіл.
					'white-space': 'pre-line',
					'word-wrap': 'break-word',
					'overflow-wrap': 'break-word'
				});
			}
		}

		// fill перезаписує width/height якщо задано через pack
		if (self._pack_fill) {
			var f = self._pack_fill;
			if (f === 'x' || f === 'both') e.css('width', '100%');
			if (f === 'y' || f === 'both') e.css('height', '100%');
		}
		if (self._pack_expand) {
			e.css('flex', '1');
		}


		// Раніше цей блок оновлював вміст (текст+зображення) ЛИШЕ якщо
		// self.props.text було truthy — тому config(image=...) без
		// text= (або повторний config(image=...) у віджета, який мав
		// image=None при створенні) просто ігнорувався: applyWidgetStyles
		// навіть не заходив усередину. Тепер умова врахує І text, І image.
		if (self.props.text || self.props.image) {
			if (self.hasLabel) {
				// Checkbutton/Radiobutton: текст живе в окремому <label>;
				// image= для них у цьому емуляторі не рендериться (немає
				// відповідної розмітки в getHtml), тож тут його не чіпаємо.
				let labelElement = document.getElementById("l_" + self.id);
				if (labelElement && self.props.text) {
					labelElement.innerHTML = PythonIDE.sanitize(Sk.ffi.remapToJs(self.props.text));
				}
			} else {
				// Button / Label: як і в getHtml() цих віджетів — якщо є
				// image, він за замовчуванням ПОВНІСТЮ замінює текст;
				// показ і тексту, і картинки одночасно можливий лише
				// через compound=.
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
							// "roght" — сумісність зі старою друкарською
							// помилкою в цьому ж файлі.
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
		}
		applyWidgetStyles(self);

		// Деякі віджети (Label, Radiobutton, Checkbutton, Spinbox...)
		// мають ВЛАСНИЙ self.update() із логікою, специфічною саме для
		// них — зокрема, Label.update() виставляє явний піксельний
		// width/height контейнера через photoImageSize() (СИНХРОННО, за
		// self.$width/self.$height, які ми самі порахували, а не за
		// <img>.naturalWidth/Height). Це критично: одразу після зміни
		// <img src=...> браузер ЩЕ НЕ продекодував зображення
		// (naturalWidth/naturalHeight = 0, img.complete = false), тож
		// БУДЬ-ЯКЕ вимірювання розміру контейнера "по вмісту" одразу
		// після config(image=...) дало б 0 — саме так layoutPack() і
		// виставляв конейнеру картинки висоту 0px, через що вона
		// "спливала" і перекривала сусідні віджети. applyWidgetStyles()
		// цього не знає (це узагальнена логіка для ВСІХ віджетів), тож
		// викликаємо self.update(), якщо він є, — він і виправляє розмір
		// контейнера ще ДО того, як layoutPack() виміряє його нижче.
		if (typeof self.update === 'function') {
			self.update();
		}

		// config()/configure() може змінити те, що впливає на "потрібний"
		// розмір віджета (image, text, width, height тощо) — наприклад,
		// Label спершу мав лише короткий текст "preview", а після
		// config(image=...) у нього всередині вже картинка 260x260.
		// applyWidgetStyles() лише оновлює HTML/CSS ВСЕРЕДИНІ елемента,
		// але сам pack()-бокс цього віджета (left/top/width/height),
		// виставлений один раз ЩЕ ПІД ЧАС .pack(), так і лишається
		// старим — новий вміст просто "вилазить" за його межі й
		// обрізається сусіднім overflow:hidden. Тому, якщо віджет
		// керується pack(), перераховуємо layout його master-а й усіх
		// предків вгору по ланцюжку — так само, як це вже робиться в
		// pack()/pack_forget() (див. relayoutAncestors).
		if (self.master && self._packInfo && s.__layoutPack) {
			s.__layoutPack(self.master);
			if (s.__relayoutAncestors) s.__relayoutAncestors(self.master);
		}
	}
	configure.co_kwargs = true;

//------------------------------------------------
	s.mainloop = new Sk.builtin.func(function() {
		Sk.builtin.pyCheckArgs("mainloop", arguments, 0, 0);
	});

// Variable, StringVar, IntVar, BooleanVar    
//🔡 Variable
	// ВАЖЛИВО: раніше variable.updateID зберігав ОДИН id віджета. Коли
	// декілька віджетів (напр. група Radiobutton) прив'язані до однієї
	// й тієї ж Variable, кожен наступний віджет під час рендеру
	// перезаписував updateID своїм id — і .set() сповіщав лише
	// ОСТАННІЙ зареєстрований віджет, а не всю групу. Тому програмна
	// установка variable.set(...) оновлювала лише одну радіокнопку.
	// Замінено на масив updateIDs — кожен віджет, що прив'язується до
	// Variable (variable= або textvariable=), реєструє себе в масиві,
	// а .set() проходить по ВСІХ зареєстрованих віджетах.
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
	// 
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
    
            // ✔ нормалізація до boolean
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
    
        // ✔ set(): завжди зводимо до boolean
        $loc.set = new Sk.builtin.func(function(self, value) {
    
            let jsval = Sk.ffi.remapToJs(value);
    
            self.value =
                jsval === true ||
                jsval === "true" ||
                jsval === 1 ||
                jsval === "1";
    
            // ✔ оновлення віджета
            notifyVarWidgets(self);
        });
    
        // ✔ get(): повертає Python bool
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
							Sk.misceval.callsimAsync(null, self.eventHandlers['<Return>'], Sk.builtin.str("test")).then(function success(r) {

							}, function fail(e) {
								window.onerror(e);
							});
						}

					});
				}

				function commonKeyHandler(ev) {

					PythonIDE.keyHandlers.push(function(e) {
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
						var e = new Sk.builtin.object();
						e.$d = new Sk.ffi.remapToPy(event);
						if (ev.eventDetails) {
							if (event.keysym != ev.eventDetails) {
								return;
							}
						}
						Sk.misceval.callsimAsync(null, ev, e).then(function success(r) {

						}, function fail(e) {
							window.onerror(e);
						});
					});
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
				Sk.misceval.callsimAsync(null, callback).then(function success(r) {

				}, function fail(e) {
					window.onerror(e);
				});
			}, timeout);
			timeouts.push(timeoutId);
		}
		after.co_kwargs = true;
		$loc.after = new Sk.builtin.func(after);

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
//--------------        
		// skipGeometryStyling: якщо true (використовується новим pack()),
		// commonDisplay НЕ чіпає fill/expand/margin/padding — усю геометрію
		// (left/top/width/height/padding) повністю визначає layoutPack().
		// Стара логіка нижче виставляла width:100%/margin через flex-модель,
		// що конфліктує з position:absolute-розрахунками нового pack().
		// grid()/place() і далі викликають commonDisplay без 4-го
		// аргументу — їхня поведінка не змінюється.
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
				// 🛠 Не обробляти повторно command, якщо воно вже реалізоване у віджеті
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


			// Додаємо CSS стилі, якщо ще не додано
			if (!$('#tkinter-place-style').length) {
				$('head').append(
					'<style id="tkinter-place-style">' +
					'.tk-place-item { position: absolute; box-sizing: border-box; }' +
					'</style>'
				);
			}

			var placeRoot = $('#tkinter_' + self.master.id);

			// place() позиціонує дочірній елемент через position:absolute,
			// а CSS прив'язує його до найближчого позиціонованого предка
			// (тобто з position != static). Якщо контейнер-master (Frame,
			// Canvas, Toplevel тощо) сам лишається "static", дочірній
			// віджет "телепортується" відносно якогось далекого предка і
			// вилазить за межі свого master. Тому примусово робимо master
			// точкою відліку для .place(), якщо він ще не позиціонований.
			if (placeRoot.length && placeRoot.css('position') === 'static') {
				placeRoot.css('position', 'relative');
			}

			// Отримуємо координати та розміри
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
			// Додаємо до контейнера   
			commonDisplay(kwa, self, placeRoot);
			setTimeout(forceDomReflow, 0);
			var el = $('#tkinter_' + self.id)

			var oWidth = el.width();
			var oHeight = el.height();
			var dx = 0;
			var dy = 0;
			// ⚓ Позиціонування з anchor
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

			// Початкове позиціонування
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

		// pack layout manager ---
		//
		// Реалізація без Flexbox/Grid: контейнер (master) — це звичайний
		// position:relative/overflow:hidden <div>, а кожна запакована
		// дитина — position:absolute <div> з обчисленими left/top/width/
		// height. Уся логіка — власна JS-реалізація алгоритму Tk pack():
		//
		//   pack() -> savePackInfo(self) -> master._packChildren -> layoutPack(master)
		//
		// pack() лише запам'ятовує параметри (side/fill/expand/anchor/
		// padx/pady/ipadx/ipady) у self._packInfo та додає self у список
		// master._packChildren (якщо ще не додано). Уся геометрія
		// перераховується заново, для ВСІХ дітей master, у layoutPack().

		// Додає спільний CSS один раз для всього документа.
		var ensurePackStyles = function() {
			if ($('#tkinter-pack-style').length) return;
			$('head').append(
				'<style id="tkinter-pack-style">' +
				'.tk-frame { overflow: hidden; }' +
				'.tk-widget { box-sizing: border-box; margin: 0 !important; }' +
				'</style>'
			);
		};

		// Зсув widget-боксу (розміром innerSize) всередині відведеної
		// йому області (розміром outerSize) відповідно до anchor.
		// axis 'x' -> керують літери w/e; axis 'y' -> керують літери n/s.
		// Немає літери -> по центру (anchor="center" — типове значення pack()).
		var packAnchorOffset = function(outerSize, innerSize, anchor, axis) {
			var free = outerSize - innerSize;
			// ВАЖЛИВО: 'center' перевіряємо ОКРЕМО і ПЕРШИМ. Слово
			// "center" саме по собі містить літери 'e' (c-E-nter) і 'n'
			// (ce-N-ter) як підрядок — тому anchor.indexOf('e')/('n')
			// нижче хибно спрацьовували на дефолтному anchor='center' і
			// трактували його як anchor='e' (праворуч) чи 'n' (вгору)
			// замість справжнього центрування. Через це віджети без
			// явного anchor (типове значення pack() — саме "center")
			// притискались до краю замість центру.
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

		// Для Frame (та будь-якого іншого master з _packPropagate === false)
		// "запитаний" (requested) розмір під час pack() — це САМЕ ТЕ число,
		// що передане у width/height при створенні (self.props.width/height),
		// а не розмір, виміряний по DOM. На відміну від Label/Button/Entry,
		// чий природний розмір залежить від вмісту (тексту), Frame свій
		// розмір під вміст не підлаштовує (pack_propagate примусово
		// вимкнено), тож скидати йому width/height у '' для "природного"
		// вимірювання не можна: ще порожній (без дітей) або вже розтягнутий
		// попереднім pack()-проходом Frame дасть хибний 0 чи випадкове
		// значення замість заданого width/height (саме так toolbar
		// лишався height:0, sidebar — width:0, controls_frame — height:2px
		// від самих лише бордерів).
		// getRequestedSize(child) — заміна колишньої getFixedRequestedSize().
		// Раніше функція повертала фіксований розмір ТІЛЬКИ якщо
		// child._packPropagate === false (що Frame виставляв собі
		// БЕЗУМОВНО, незалежно від того, чи користувач взагалі задавав
		// width/height — звідси й баг: порожній Frame без заданого
		// розміру намертво застрягав на дефолтних 200x100 з getHtml()).
		//
		// Тепер Frame виставляє _packPropagate=false лише тоді, коли
		// користувач сам передав width і/або height у конструктор
		// (self._hasExplicitWidth/_hasExplicitHeight, запам'ятовані в
		// Frame.__init__ ДО того, як getHtml() підставить дефолти в
		// self.props). Якщо ж розмір не задано явно — child._packPropagate
		// лишається true (типова поведінка tkinter), і, якщо цей child
		// сам є pack-master для власних дітей (Frame-контейнер), його
		// "природний" розмір рахуємо РЕКУРСИВНО тим самим алгоритмом
		// Tk_GeometryRequest (computePackRequiredSize) — а не через CSS
		// auto-layout, який не працює для дітей із position:absolute.
		var getRequestedSize = function(child) {
			if (!child) return null;
			var props = child.props || {};
			var explicitW = null, explicitH = null;
			if (child._hasExplicitWidth && props.width !== undefined && props.width !== null) {
				try { explicitW = Sk.ffi.remapToJs(props.width); } catch (e) { explicitW = props.width; }
			}
			if (child._hasExplicitHeight && props.height !== undefined && props.height !== null) {
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

		// Обчислює МІНІМАЛЬНИЙ розмір, потрібний master, щоб усі
		// запаковані діти вмістились БЕЗ накладання — так само, як Tk
		// обчислює "requested size" контейнера (Tk_GeometryRequest) ПЕРЕД
		// тим, як власне розкладати дітей по кавіті. Формула стандартна
		// для pack(): по осі пакування (top/bottom -> вертикаль,
		// left/right -> горизонталь) розміри підсумовуються, а по
		// перпендикулярній осі береться максимум серед усіх дітей.
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

		// Уся "магія" pack(): рахує геометрію ВСІХ дітей master заново.
		// Викликається щоразу, коли якийсь із дітей викликає pack()/
		// pack_forget()/destroy(), бо додавання чи зникнення однієї
		// дитини впливає на вільну область (free) для решти.
		var layoutPack = function(master) {
			if (!master) return;
			var containerJQ = $('#tkinter_' + master.id);
			if (!containerJQ.length) return;

			ensurePackStyles();
			containerJQ.addClass('tk-frame');
			// Точка відліку для position:absolute дітей — сам master.
			// Якщо master уже позиціонований (наприклад, це Frame,
			// запакований у СВОЄму master, а тому вже має
			// position:absolute) — не чіпаємо, бо будь-яке non-static
			// значення position однаково робить елемент точкою відліку.
			if (containerJQ.css('position') === 'static') {
				containerJQ.css('position', 'relative');
			}

			// Прибираємо з переліку дітей ті, чий DOM-елемент вже видалено
			// (pack_forget/destroy).
			var children = (master._packChildren || []).filter(function(c) {
				return $('#tkinter_' + c.id).length > 0;
			});
			master._packChildren = children;
			if (!children.length) return;

			// pack_propagate(True) — типова поведінка Tk за замовчуванням:
			// master САМ підлаштовує (розтягує) свій розмір під потреби
			// дітей ПЕРЕД тим, як розподіляти кавіту. Без цього кроку
			// діти, запаковані пізніше (наприклад BOTTOM після LEFT/TOP/
			// RIGHT), отримують вже "з'їдену" попередніми дітьми кавіту й
			// накладаються на них — саме так і було в реальному Tk без
			// авто-розширення master.
			if (master._packPropagate !== false) {
				var req = computePackRequiredSize(children);
				var curW = containerJQ.width();
				var curH = containerJQ.height();
				var newW = Math.max(curW, req.width);
				var newH = Math.max(curH, req.height);
				if (newW !== curW || newH !== curH) {
					if (containerJQ.hasClass('ui-dialog-content') && containerJQ.dialog) {
						// Tk / Toplevel: контент загорнутий у jQuery UI
						// dialog — розмір вікна керується опціями dialog(),
						// а не просто CSS width/height внутрішнього div.
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

			// ---------- Прохід №1: reqWidth/reqHeight + базовий parcel ----------
			var free = { left: 0, top: 0, right: cw, bottom: ch };
			var items = [];

			children.forEach(function(child) {
				var info = child._packInfo;
				if (!info) return;
				var el = $('#tkinter_' + child.id);
				if (!el.length) return;

				var fixedSize = getRequestedSize(child);

				el.addClass('tk-widget');
				// Скидаємо розміри/відступи, щоб виміряти "природний"
				// (requested) розмір віджета, як це робить Tk перед
				// побудовою кожного parcel. Виняток — Frame-подібні
				// контейнери з _packPropagate===false (див.
				// getFixedRequestedSize вище): їм замість скидання у ''
				// підставляємо явно задані width/height, бо їхній
				// "природний" розмір — це задане число, а не вміст.
				el.css({
					position: 'absolute', left: 0, top: 0,
					width: (fixedSize && fixedSize.width !== null) ? fixedSize.width + 'px' : '',
					height: (fixedSize && fixedSize.height !== null) ? fixedSize.height + 'px' : '',
					paddingLeft: '', paddingRight: '', paddingTop: '', paddingBottom: ''
				});
				if (info.ipadx) el.css({ paddingLeft: info.ipadx + 'px', paddingRight: info.ipadx + 'px' });
				if (info.ipady) el.css({ paddingTop: info.ipady + 'px', paddingBottom: info.ipady + 'px' });

				// outerWidth()/outerHeight() без margin (margin у tk-widget
				// примусово занулено CSS-класом вище) — border-box розмір
				// разом з ipadx/ipady, які щойно додані як CSS padding.
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

			// ---------- Прохід №2: expand ----------
			// Те, що лишилось у free після проходу №1, ділиться між
			// expand-віджетами: вертикальний залишок (leftoverH) — між
			// side=top/bottom, горизонтальний (leftoverW) — між
			// side=left/right. Саме так це влаштовано в оригінальному Tk:
			// expand "з'їдає" решту вільної area вздовж своєї осі пакування.
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

			// Розміри частини parcel-ів вздовж осі пакування щойно
			// змінились (через expand) — перераховуємо x/y/крос-вісь усіх
			// parcel-ів послідовно ще раз, щоб наступні (за порядком
			// пакування) віджети коректно "бачили" нову, зменшену вільну
			// область.
			var free2 = { left: 0, top: 0, right: cw, bottom: ch };
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

			// ---------- Прохід №3: fill + anchor -> left/top/width/height ----------
			items.forEach(function(it) {
				var info = it.info;
				var padx = it.padx, pady = it.pady; // [left,right] / [top,bottom]

				// "Внутрішня" область parcel — сам parcel, зменшений на
				// padx/pady (це зовнішній відступ навколо віджета).
				// padx[0]/pady[0] — відступ "до" (left/top),
				// padx[1]/pady[1] — відступ "після" (right/bottom); для
				// симетричного padx=N/pady=N обидва однакові.
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

				// Якщо ця дитина (напр. Frame) сама є master для власних
				// pack-запакованих дітей — її ширина/висота щойно змінились
				// (рядки вище). Її внутрішні діти були розраховані під
				// СТАРИЙ розмір цього контейнера (наприклад, під повну
				// ширину root, коли right_frame ще не існував). Якщо не
				// перерахувати їх зараз під НОВИЙ розмір — вони будуть
				// ширшими/вищими за оновлений контейнер і просто
				// обріжуться через overflow:hidden. Тому рекурсивно
				// перекладаємо вміст щойно зміненого контейнера.
				if (it.child._packChildren && it.child._packChildren.length) {
					layoutPack(it.child);
				}
			});

			setTimeout(forceDomReflow, 0);
		};

		// relayoutAncestors(master) — коли всередину master (наприклад,
		// controls_frame) щойно спакували НОВОГО pack-child (кнопку), і
		// сам master є pack-дитиною СВОГО master (наприклад, content_area),
		// то одного layoutPack(master) НЕДОСТАТНЬО: layoutPack() рахує
		// геометрію ВНИЗ (від master до його дітей), але ніяк не
		// повідомляє БАТЬКА master-а, що "потрібний" розмір master-а щойно
		// змінився. Батько ж (content_area) уже виставив master-у
		// left/top/width/height ОДИН РАЗ, у момент, коли master.pack()
		// викликався — тобто коли всередині master ще НЕ було жодної
		// дитини (реальний сценарій: controls_frame.pack() відбувається
		// РАНІШЕ за btn_save.pack()). Того разу "потрібна" висота
		// controls_frame вимірювалась як ~0 (порожній Frame), і саме це
		// нульове значення "top"/"height" назавжди застрягало в inline
		// style controls_frame — подальші layoutPack(controls_frame) (при
		// пакуванні кнопок) міняли лише його width/height як master-а
		// (self-resize), АЛЕ НЕ його позицію top всередині content_area,
		// тож фрейм фактично "виїжджав" за нижню межу content_area й
		// ховався під overflow:hidden.
		//
		// Тому після layoutPack(master) додатково йдемо вгору по
		// ланцюжку master.master, master.master.master, ... і для КОЖНОГО
		// з них теж викликаємо layoutPack() — це коректно перераховує і
		// розмір, і позицію (left/top/width/height) щойно зміненого
		// вкладеного контейнера в координатах його справжнього батька.
		var relayoutAncestors = function(master) {
			var node = master;
			var guard = 0;
			while (node && node.master && node.master !== node && node._packInfo && guard < 100) {
				layoutPack(node.master);
				node = node.master;
				guard++;
			}
		};

		// configure()/config() визначений ЗНАЧНО РАНІШЕ у файлі (спільний
		// для Widget і кількох інших класів, напр. Frame/Listbox/Spinbox —
		// звідти й береться ReferenceError: layoutPack is not defined),
		// у зовнішній замиканні $builtinmodule, ТОДІ ЯК layoutPack і
		// relayoutAncestors оголошені ТУТ — усередині власного замикання
		// buildClass для s.Widget. У JS зовнішня функція не бачить
		// змінних, оголошених у вкладеній — тож configure() фізично не
		// міг звернутись до layoutPack напряму. Замість переносу великого
		// шматка коду геометрії назовні — прив'язуємо обидві функції до
		// спільного модульного об'єкта `s` (він видимий і тут, і в
		// configure(), бо обидва лежать в одному $builtinmodule).
		s.__layoutPack = layoutPack;
		s.__relayoutAncestors = relayoutAncestors;

		// savePackInfo(self) — зберігає параметри виклику pack() у
		// self._packInfo. Сама геометрія тут НЕ рахується.
		// padx/pady у справжньому tkinter можуть бути або одним числом
		// (симетричний відступ з обох боків), або tuple (before, after)
		// для несиметричного відступу — саме так писав користувач:
		// pady=(0, 10). Sk.ffi.remapToJs() перетворює такий Python-tuple
		// на JS-масив [0, 10]; якщо просто підставити цей масив у
		// подальшу арифметику (2 * padx, parcel.h - 2*pady тощо), JS
		// приводить масив до NaN ("0,10" -> Number() -> NaN), і вся
		// геометрія віджета, що йде далі по ланцюжку (reqH/outerH/
		// parcel/inner), стає NaN — CSS-властивість із NaN просто
		// відкидається браузером, тому висота елемента лишається
		// невизначеною (як і сталось із лейблом "Головна робоча зона").
		// normalizePad() завжди повертає пару [before, after] у px.
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

			// Рендеримо HTML елемента без старої fill/margin-стилізації —
			// про геометрію повністю подбає layoutPack().
			commonDisplay(kwa, self, containerJQ, true);

			// commonDisplay() перевстановлює обробники подій/команд, тож
			// layoutPack чіпає лише left/top/width/height/padding.
			layoutPack(self.master);
			relayoutAncestors(self.master);
		};
		pack.co_kwargs = true;
		$loc.pack = new Sk.builtin.func(pack);

		// pack_forget() — знімає віджет з pack-розкладки поточного master
		// і перераховує геометрію решти дітей.
		// pack_propagate(flag) — як у справжньому Tkinter: True (типово) —
		// master сам підлаштовує розмір під дітей; False — розмір master
		// лишається фіксованим (як заданий width/height), і кавіта може
		// стискатись/накладатись, якщо дітям не вистачає місця — це вже
		// відповідальність автора коду, так само як у CPython tkinter.
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

			// Додаємо CSS-стилі до <head>, якщо ще не додані
			if (!$('#tkinter-grid-style').length) {
				$('head').append(
					'<style id="tkinter-grid-style">' +
					'.tk-grid-container { display: grid; gap: 4px; padding: 5px; width: 100%; height: 100%; box-sizing: border-box; }' +
					'.tk-grid-item { align-self: stretch; justify-self: stretch; }' +
					'</style>'
				);
			}

			// Створення grid-контейнера, якщо ще немає (пошук лише всередині БАТЬКА,
			// щоб кілька Frame/Tk з окремими grid() не ділили один контейнер)
			if (!parentJQ.find('> #tk-grid-root').length) {
				parentJQ.append('<div id="tk-grid-root" class="tk-grid-container"></div>');
			}

			var gridRoot = parentJQ.find('> #tk-grid-root');

			// Отримуємо параметри
			var row = Sk.ffi.remapToJs(props.row ?? 0);
			var column = Sk.ffi.remapToJs(props.column ?? 0);
			var rowspan = Sk.ffi.remapToJs(props.rowspan ?? 1);
			var columnspan = Sk.ffi.remapToJs(props.columnspan ?? 1);
			var padx = Sk.ffi.remapToJs(props.padx ?? 0);
			var pady = Sk.ffi.remapToJs(props.pady ?? 0);
			var sticky = Sk.ffi.remapToJs(props.sticky ?? ''); // e.g., "nsew"
			// Додаємо віджет до контейнера
			commonDisplay(kwa, self, gridRoot);
			setTimeout(forceDomReflow, 0);
			// Встановлення позиціонування
			var el = $('#' + elementId);
			el.css({
				'grid-row': (row + 1) + ' / span ' + rowspan,
				'grid-column': (column + 1) + ' / span ' + columnspan,
				'padding': `${pady}px ${padx}px`,
				'align-self': 'stretch',
				'justify-self': 'stretch'
			});

			// Sticky (n, s, e, w → управління вирівнюванням)
			if (sticky.includes('n')) el.css('align-self', 'start');
			if (sticky.includes('s')) el.css('align-self', 'end');
			if (sticky.includes('e')) el.css('justify-self', 'end');
			if (sticky.includes('w')) el.css('justify-self', 'start');
			if (sticky.includes('n') && sticky.includes('s')) el.css('align-self', 'stretch');
			if (sticky.includes('e') && sticky.includes('w')) el.css('justify-self', 'stretch');


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

		$loc.__setitem__ = new Sk.builtin.func(function(self, key, value) { // Set key item values            
			self.props[Sk.ffi.remapToJs(key)] = value;
			applyWidgetStyles(self); //
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
			return '<canvas id="tkinter_' + self.id + '" class="tk_pixelsized" width="' + width + '" height="' + height + '"></canvas>';
		}

		function commonCanvasElement(self, element) {
			var canvas = document.getElementById('tkinter_' + self.id);
			if (canvas) {
				element.draw(canvas);
			}

			self.elements.push(element);

			return new Sk.ffi.remapToPy(self.elements.length - 1);
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
			var bbox = [0, 0, 0, 0];
			if (item) {
				var e = self.elements[Sk.ffi.remapToJs(item)];
                if (e.coords.x1 !== undefined)
                    bbox[0] = new Sk.builtin.int_(e.coords.x1);
                if (e.coords.y1 !== undefined)
                    bbox[1] = new Sk.builtin.int_(e.coords.y1);
                if (e.coords.x2 !== undefined)
                    bbox[2] = new Sk.builtin.int_(e.coords.x2);
                if (e.coords.y2 !== undefined)
                    bbox[3] = new Sk.builtin.int_(e.coords.y2);                
			}
			return new Sk.builtin.tuple(bbox);
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
					// Якщо coords — масив
					for (var i = 0; i < crd.length; i++) {
						c.push(new Sk.builtin.int_(crd[i]));
					}
				} else if (typeof crd === "object") {
					// Якщо coords — об’єкт
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
					// r1 is param
					// r2 is e
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

// -----------------        
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
			//ctx.beginPath();
			// Починаємо з середини першої сторони
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
				// Обчислюємо середини сторін
				const mid1 = {
					x: (prev.x + curr.x) / 2,
					y: (prev.y + curr.y) / 2
				};
				const mid2 = {
					x: (curr.x + next.x) / 2,
					y: (curr.y + next.y) / 2
				};
				// Обчислюємо контрольні точки всередині полігона
				const control1 = {
					x: mid1.x + (curr.x - mid1.x) * smoothing,
					y: mid1.y + (curr.y - mid1.y) * smoothing
				};
				const control2 = {
					x: mid2.x + (curr.x - mid2.x) * smoothing,
					y: mid2.y + (curr.y - mid2.y) * smoothing
				};
				// Малюємо криву Безьє
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
				// Завершуємо криву в ОСТАННІЙ заданій точці — раніше тут
				// були захардкоджені індекси points[3]/points[4], що
				// працювало лише якщо точок було рівно 5, а для будь-якої
				// іншої кількості (напр. 4 точки, як у create_line з
				// 4 парами координат) кидало
				// "points[4] is undefined". Беремо останні дві точки
				// динамічно, незалежно від їх загальної кількості.
				const last = points.length - 1;
				ctx.quadraticCurveTo(
					points[last - 1].x, points[last - 1].y,
					points[last].x, points[last].y);

			}

			ctx.stroke();

		}

		// ---------------
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
		//----------------
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
							//if(self.props.fill && Sk.ffi.remapToJs(self.props.fill) != '') {
							//    cx.lineWidth = 1;
							//    draw_polygon(cx, jsCoords, true)
							//    }
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

		// -----------------

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
						// constants
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
		//------------------
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

            // 🟢 Текст
            if (props.text) text = "" + Sk.ffi.remapToJs(props.text);

            // 🟢 Шрифт
            if (props.font) {
                let fontSpec = Sk.ffi.remapToJs(props.font);
                if (Array.isArray(fontSpec)) {
                    // tkinter передає ['Arial', 14, 'bold italic']
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
                    // спроба розпарсити рядок у стилі tkinter ("Arial 14 bold italic")
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

            // 🟢 Колір
            if (props.fill) fill = getColor(Sk.ffi.remapToJs(props.fill));
            cx.fillStyle = fill;

            // 🟢 Вирівнювання, обертання
            if (props.anchor) anchor = Sk.ffi.remapToJs(props.anchor);
            if (props.justify) justify = Sk.ffi.remapToJs(props.justify);
            if (props.angle) angle = Sk.ffi.remapToJs(props.angle);

            //applyStyles(props, cx);

            // 🟢 Багаторядковий текст
            var lines = text.split("\n");

            // Вимірювання
            var lineHeights = [];
            var maxWidth = 0;
            for (var i = 0; i < lines.length; i++) {
                var metrics = cx.measureText(lines[i]);
                lineHeights.push(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
                maxWidth = Math.max(maxWidth, metrics.width);
            }
            var totalHeight = lineHeights.reduce((a, b) => a + b, 0);

            // 🟢 Позиціонування anchor
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

            // 🟢 Малювання рядків
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
		// create image
// create image
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
				// props.image — це PhotoImage; беремо стабільний data-URL
				// напряму з $dataUrl і використовуємо як ключ кешу
				// декодованих зображень.
				var src = photoImageSrc(props.image);
				var cached = _imageDecodeCache[src];

				if (cached && cached.complete && cached.naturalWidth > 0) {
					var off = computeOffset(cached, props.anchor);
					cx.drawImage(cached, coords.x1 + off.dx, coords.y1 + off.dy);
					return;
				}

				// Зображення ще не задекодоване (або це нове зображення) —
				// чекаємо onload і малюємо, коли воно реально готове.
				// На цьому кадрі просто нічого не малюємо (замість гонитви
				// з нульовими width/height).
				if (!cached) {
					var img = new Image();
					img.onload = function() {
						_imageDecodeCacheSet(src, img);
						// Перемальовуємо саме на той canvas, що був переданий
						// у момент виклику draw() — цього достатньо, щоб
						// зображення з'явилось одразу після декодування,
						// незалежно від того, чи є в проєкті окремий цикл
						// періодичного перерендеру canvas.
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

		//
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
					//applyStyles                
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

		//
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
					//applyStyles
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

		//
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
			// ВАЖЛИВО: на відміну від Label/Button, у справжньому
			// tkinter.Message розмір (width/height) задається в
			// ПІКСЕЛЯХ (screen units), а не в символах шрифту. Тому цей
			// <div> НЕ повинен мати клас "tk_charsized" — інакше
			// applyWidgetStyles() трактує width як "Nch"/"Nem", і
			// значення, яке користувач передав як пікселі, перетворюється
			// на непередбачувану ширину в символах (аж до майже нульової
			// ширини, коли текст переноситься по одній букві на рядок).
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
			var html = '<div id="tkinter_' + self.id + '" style="word-wrap:break-word;line-height:120%" >' + PythonIDE.sanitize(v) + '</div>';
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

				if (self.props.width === 1) {
					self.props.width = v.length + 1;
				}
				// Пікселі, а не 'em' — узгоджено з getHtml()/applyWidgetStyles()
				$('#tkinter_' + self.id).css('width', Sk.ffi.remapToJs(self.props.width) + 'px');
			}
			commonWidgetConstructor(kwa, self, master, getHtml);
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);
	}, 'Message', [s.Widget]);

// PhotoImage ---
	// Визначає MIME-тип за розширенням файлу, щоб зібрати коректний data-URL.
	var _photoImageMime = function(path) {
		var ext = ("" + path).split('.').pop().toLowerCase();
		var map = {
			png: "image/png", gif: "image/gif", jpg: "image/jpeg",
			jpeg: "image/jpeg", bmp: "image/bmp",
			ppm: "image/x-portable-pixmap", pgm: "image/x-portable-graymap"
		};
		return map[ext] || "image/png";
	};

	// Sk.__jsfs.read повертає "бінарний" рядок (1 символ = 1 байт 0-255).
	// Перекодовуємо його в base64 для data-URL.
	var _binaryStringToBase64 = function(binStr) {
		if (typeof btoa === "function") {
			return btoa(binStr);
		}
		return Buffer.from(binStr, "binary").toString("base64");
	};

	// Синхронно дістає ширину/висоту з заголовків PNG/GIF/BMP, без очікування
	// завантаження <img>, щоб width()/height() працювали одразу після створення.
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
			// невідомий/пошкоджений формат — розмір лишається невідомим
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
				// Sk.__jsfs зберігає цей файл вже як текстовий data-URL
				// (а не сирі байти зображення) — використовуємо його
				// напряму, інакше base64-кодування вдруге зламає джерело.
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

		// Неявне приведення до рядка (у Label/Canvas тощо) дає готовий data-URL.
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
		// Реального піксельного масштабування (як у CPython tkinter) тут немає —
		// це вимагало б декодування зображення через <canvas>. Повертаємо той
		// самий об'єкт, щоб виклик хоча б не падав і код лишався сумісним.
		$loc.subsample = new Sk.builtin.func(function(self) { return self; });
		$loc.zoom = new Sk.builtin.func(function(self) { return self; });
	}, 'PhotoImage', []);

// Label ---
	s.Label = new Sk.misceval.buildClass(s, function($gbl, $loc) {
		// Формує внутрішній вміст (текст + картинка) з урахуванням compound.
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
				// props.image — це PhotoImage; беремо готовий data-URL
				// напряму з $dataUrl (див. ImageTk.PhotoImage/photoImageSrc).
				// Розмір задаємо ЯВНО, у пікселях, за фактичним розміром
				// картинки (photoImageSize), а НЕ через max-width:100%.
				// Percentage-розмір у вкладених flex-контейнерах з
				// невизначеною шириною — класичний баг браузерів: min-width
				// такого <img> вважається 0, і flex-shrink стискає картинку
				// до 0 замість того, щоб віддати їй природний розмір.
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
			// top/bottom мають СКЛАДАТИ картинку й текст один над одним.
			// <br> усередині flex-контейнера (яким є сам Label) браузер
			// ігнорує — картинка й текст стають двома окремими flex-items
			// в РЯДОК і можуть вилізти за межі віджета. Тому для top/bottom
			// загортаємо їх у власний column-flex, незалежний від напрямку
			// батьківського контейнера.
			switch (comp) {
				case "bottom": return '<div style="display:flex;flex-direction:column;align-items:center;">' + vtxt + vimg + '</div>';
				case "left":   return vimg + vtxt;
				case "right":  return vtxt + vimg;
				case "center": return '<div style="position:relative">' + vimg + vtxt + '</div>';
				case "top":
				default:       return '<div style="display:flex;flex-direction:column;align-items:center;">' + vimg + vtxt + '</div>';
			}
		}
		// Визначає CSS justify-content для flex-контейнера Label на основі
		// anchor (пріоритет, як у справжньому tkinter.Label) або, якщо
		// anchor не задано, властивості justify. За замовчуванням — center.
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
		// CSS-фрагмент, який підганяє РОЗМІР самого контейнера Label під
		// зображення (коли воно є) і забороняє йому стискатись у flex-рядку
		// (flex-shrink:0) — інакше сусідні секції (наприклад right_side у
		// pack) можуть "з'їсти" його ширину/висоту при нестачі місця, і
		// картинка або зникне, або вилізе за межі свого блоку.
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
			// не звужувати Label до 0 символів, якщо задано лише картинку.
			// ВАЖЛИВО: перевіряємо саме "width не задано" (undefined), а не
			// "width falsy" — інакше свідоме width=0 чи авто-обчислений 0
			// (порожній текст) поводяться однаково і плутаються між собою.
			if (self.props.width === undefined && !self.props.image) {
				self.props.width = txtwidth;
				// позначаємо, що це значення обчислено автоматично (не
				// задане користувачем явно через width=...), щоб потім,
				// коли з'явиться картинка, можна було безпечно його скинути.
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

				// Якщо з'явилось зображення (наприклад, через config(image=...)
				// пізніше, коли Label спершу створювався з текстом-заглушкою
				// або порожнім) — підганяємо розмір контейнера ПІД КАРТИНКУ
				// (а не залишаємо застарілу 'ch'-ширину від попереднього
				// тексту, і не покладаємось на голий 'auto', який у
				// flex-рядку може схлопнутись до 0).
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

            // якщо variable ще не ініціалізована
            if (v === '' || v === undefined) {
                self.props.variable.value = Sk.ffi.remapToPy(self.offval);
                v = self.offval;
            }

            checked = (v === self.onval);
        }

        var html =
            '<div id="tkinter_' + self.id + '">' +
                '<input type="checkbox"' + (checked ? ' checked' : '') + '>' +
                '<label id="l_' + self.id + '">' +
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

                //
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
			var html = '<div id="tkinter_' + self.id + '"><input name="' + name + '" type="radio" ' + (checked ? ' checked' : '') + ' value="' + PythonIDE.sanitize(value) + '">' +
				'<label id="l_' + self.id + '" for="tkinter_' + self.id + '">' + PythonIDE.sanitize(label) + '</label></div>';
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
			self.props.value = Sk.ffi.remapToJs(value); // ✅ правильно
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
                    // Один індекс: має повернути рядок (str)
                    if (first < 0 || first >= self.items.length) {
                        throw new Sk.builtin.IndexError("listbox index out of range");
                    }
                    return Sk.ffi.remapToPy(self.items[first]);
                }
            
                // Два індекси → повертаємо tuple
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
            <div ${id$} class="tk_charsized" style='margin: 5px 0; width: 120px; display: flex; gap: 4px; align-items: center; border: 1px solid gray; padding: 2px; border-radius: 4px;'>
                <input type='text' id='spinner_input_${self.id}' value='${startVal}' 
                    style='width: 100px; color: black; border: none; outline: none;'>
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

			// overflow:hidden — щоб дочірні віджети (напр. Label, чия ширина
			// авто-виставляється під довжину тексту в "ch") не вилазили
			// за межі Frame, коли реальний вміст ширший за задані
			// width/height Frame (Frame тут не має pack_propagate і не
			// підлаштовує свій розмір під вміст, як справжній tkinter).
			return '<div id="tkinter_' + self.id + '" class="tk_pixelsized tk-frame" style="margin:auto;width:' + width + 'px; height:' + height + 'px; overflow:hidden;"></div>';
		}

		var init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);

			// Запам'ятовуємо, чи width/height передані явно КОРИСТУВАЧЕМ
			// у конструкторі — саме зараз, ДО виклику getHtml() (він
			// відбудеться пізніше, при першому display()/pack(), і сам
			// підставить дефолтні 200x100 у self.props.width/height, тож
			// перевіряти props.width/height ПІСЛЯ getHtml() вже не можна:
			// вони завжди будуть "задані").
			self._hasExplicitWidth = self.props.width !== undefined && self.props.width !== null;
			self._hasExplicitHeight = self.props.height !== undefined && self.props.height !== null;

			// pack_propagate(True) — типова поведінка справжнього tkinter:
			// Frame САМ підлаштовує розмір під вміст, якщо width/height не
			// задані явно. _packPropagate=false (фіксований розмір, вміст
			// ховається через overflow:hidden) виставляємо ЛИШЕ тоді, коли
			// користувач сам передав width і/або height.
			//
			// Раніше тут стояло БЕЗУМОВНЕ self._packPropagate = false для
			// будь-якого Frame — через це кожен Frame без заданого розміру
			// намертво застрягав на дефолтних 200x100 з getHtml(), навіть
			// якщо реальний вміст (наприклад, кілька кнопок) вимагав
			// значно менше. Саме так controls_frame отримував висоту
			// 100px замість ~59px, потрібних під кнопки. Природний розмір
			// такого Frame тепер рахується рекурсивно в getRequestedSize()/
			// computePackRequiredSize() за вмістом його pack-дітей — це не
			// зламає й той сценарій, заради якого пропагацію вимкнули
			// раніше (toolbar/sidebar із явним width/height), бо для них
			// _hasExplicitWidth/_hasExplicitHeight лишиться true.
			self._packPropagate = (self._hasExplicitWidth || self._hasExplicitHeight) ? false : true;
		}
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		//---------------------------------------

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
			return `<textarea id="tkinter_${self.id}" class="tk_charsized" rows="${rows}" cols="${cols}" style="resize:none;"></textarea>`;
		}

		const init = function(kwa, self, master) {
			commonWidgetConstructor(kwa, self, master, getHtml);
		};
		init.co_kwargs = true;
		$loc.__init__ = new Sk.builtin.func(init);

		// Get the current text value
		$loc.get = new Sk.builtin.func(function(self) {
			return new Sk.builtin.str($('#tkinter_' + self.id).val());
		});

		// Focus the text widget
		$loc.focus = new Sk.builtin.func(function(self) {
			$('#tkinter_' + self.id).focus();
		});

		// Delete from index `first` to `last`
		$loc.delete_$rw$ = new Sk.builtin.func(function(self, first, last) {
			const $el = $('#tkinter_' + self.id);
			const val = $el.val();

			const start = parseIndex(val, Sk.ffi.remapToJs(first));
			let end = Sk.ffi.remapToJs(last);

			if (end === 'end') {
				end = val.length;
			} else {
				end = parseIndex(val, end);
			}

			const updated = val.slice(0, start) + val.slice(end);
			$el.val(updated).focus();
		});

		// Insert `newVal` at position `pos`
		$loc.insert = new Sk.builtin.func(function(self, pos, newVal) {
			const $el = $('#tkinter_' + self.id);
			const val = $el.val();
			let position = Sk.ffi.remapToJs(pos);
			newVal = Sk.ffi.remapToJs(newVal);

			if (position === 'end') {
				position = val.length;
			} else {
				position = parseIndex(val, position);
			}

			const updated = val.slice(0, position) + newVal + val.slice(position);
			$el.val(updated).focus();
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
					if (self.closeMainLoop) {
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
					if (self.closeMainLoop) {
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

	//PythonIDE.python.output('<small>tkinter/Skulpt, by Pete Dring, 30042024</small><br><br>');

	s.ttk = new Sk.builtin.module();
	var ttk = function(name) {
		var t = {
			// ttk псевдоніми - працює як перенаправлення до tk-варіантів, зроблено для сумісності

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
						// Вертикальна лінія: вузький блок з border
						html = `<div id="${id}" class="tk_pixelsized" style="display:inline-block; width:1px; height:100px; background-color:gray; margin:0 5px;"></div>`;
					} else {
						// Горизонтальна лінія
						html = `<hr id="${id}" class="tk_pixelsized" style="margin:5px 0;">`;
					}
				} else {
					// За замовчуванням горизонтальна
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
				// ВАЖЛИВО: нативний HTML <progress> БЕЗ атрибута value
				// браузер сам трактує як "невизначений" і одразу
				// запускає власну CSS-анімацію — тобто indeterminate
				// прогрес-бар "стартував" би сам, без виклику .start().
				// Тому початковий стан рендеримо як зупинений
				// (value="0"), так само як це робить self.stop(); лише
				// self.start() прибирає атрибут value і вмикає анімацію.
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
					// Заглушка для indeterminate
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

			// Методи start, stop, step
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



		return t;
	}

// tkinter.colorchooser ---
	s.colorchooser = new Sk.builtin.module();

	(function() {
		// Допоміжна функція: конвертація HEX у RGB
		function hexToRgb(hex) {
			const bigint = parseInt(hex.slice(1), 16);
			return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
		}

		// Основна функція askcolor
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

		// Додавання функції до модуля
		s.colorchooser.$d = {
			askcolor: askcolor
		};

		// Реєстрація модуля у sys.modules
		const modName = new Sk.builtin.str("tkinter.colorchooser");
		Sk.sysmodules.mp$ass_subscript(modName, s.colorchooser);
	})();

// Заглушка для tkinter.font ---
	var font_mod = new Sk.builtin.module({});
	font_mod.$d = new Sk.builtin.dict();

	font_mod.$d.mp$ass_subscript(
		new Sk.builtin.str("Font"),
		Sk.builtin.none.none$
	);

	s.font = font_mod;
	//--------------------

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
			message = PythonIDE.sanitize("" + Sk.ffi.remapToJs(message));
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
			message = PythonIDE.sanitize("" + Sk.ffi.remapToJs(message));

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

			// Обробка натискання Enter
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

//------------------------------   

	return s;
};
