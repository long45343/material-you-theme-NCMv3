// theme-tokens.js — NCM 3.1 全局令牌映射层
//
// 3.1 客户端把全部颜色定义在 html 元素的 inline style 上(--colorPrimary/Secondary/
// Black/White/Sidebar/Function/Mask/Background 系),web 层所有组件只消费这些令牌。
// 本模块把 Material You 引擎产出的配色(primary/secondary/bg/前景)映射为完整令牌表,
// 以 `html { --colorX: ... !important }` 形式注入,压制网易云自身的 inline 定义。
//
// 基准值(3.1.39 亮色实测,alpha 梯度规律):
//   PrimaryN      alpha = [1, .9, .8, .6, .4, .3, .1, .08]
//   BlackN        alpha = [1, .9, .8, .7, .6, .5, .4, .3, .25, .1, .06, .03]
//   WhiteN        同 BlackN 梯度,基色白
//   Sidebar1-7    = 前景灰阶(同 Black 梯度),Sidebar9-12 = 强调色变体

const PRIMARY_ALPHA = [1, 0.9, 0.8, 0.6, 0.4, 0.3, 0.1, 0.08]; // Primary1..8
const FOREGROUND_ALPHA = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.1, 0.06, 0.03]; // x1..x12

export const rgba = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;

// 在两个颜色之间按比例混合(t=0 → a,t=1 → b)
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/**
 * 生成整套 3.1 令牌的 CSS 文本。
 * @param {object} scheme  { primary:[r,g,b], secondary:[r,g,b], bg:[r,g,b], bgDarken:[r,g,b] }
 * @param {string} mode    'light' | 'dark'
 * @returns {string}       css 文本(`html { --colorX: ... !important; ... }`)
 */
export const buildTokenCSS = (scheme, mode) => {
	const dark = mode === 'dark';
	const primary = scheme.primary;
	const secondary = scheme.secondary ?? scheme.primary;
	const bg = scheme.bg;
	const bgDarken = scheme.bgDarken ?? scheme.bg;
	const surface = dark ? mix(bg, [255, 255, 255], 0.07) : [255, 255, 255]; // 主题表面色(卡片层)

	// 前景色:亮色模式 = 深色文字(基于 bg-darken 加深),暗色模式 = 浅色文字(接近 bg 提亮);
	// 混入 6% 主色色调,符合 MD3 onSurface 的微带色规范
	const fgBase = (() => {
		const base = dark ? mix(bg, [255, 255, 255], 0.92) : mix(bgDarken, [0, 0, 0], 0.78);
		return mix(base, primary, 0.06);
	})();
	// 侧栏前景与主前景保持同一族
	const sidebarFgBase = fgBase;

	const out = [];

	// ---- 主色梯度 Primary1..8 ----
	PRIMARY_ALPHA.forEach((a, i) => {
		out.push(`--colorPrimary${i + 1}: ${rgba(primary, a)} !important;`);
	});

	// ---- Secondary1_x:主按钮渐变两端。NCM 原生用 linear-gradient(1_2→1_1),
	// 但原版两色几乎同色(纯色观感);这里两端统一为主色,保持纯色质感 ----
	out.push(`--colorSecondary1_1: ${rgba(primary, 1)} !important;`);
	out.push(`--colorSecondary1_2: ${rgba(primary, 1)} !important;`);

	// ---- Secondary2_x:分类色板。2_1 跟随主色,2_2..4 保留网易云原值 ----
	out.push(`--colorSecondary2_1: ${rgba(primary, 1)} !important;`);
	out.push(`--colorSecondary2_2: rgba(89,117,178,1) !important;`);
	out.push(`--colorSecondary2_3: rgba(54,178,133,1) !important;`);
	out.push(`--colorSecondary2_4: rgba(54,93,178,1) !important;`);

	// ---- Secondary3_x:浅色高亮背景(主色淡出版 / 分类色淡出版保留) ----
	const white = [255, 255, 255];
	out.push(`--colorSecondary3_1: ${rgba(mix(primary, white, dark ? 0.25 : 0.55), 1)} !important;`);
	out.push(`--colorSecondary3_2: ${rgba(mix(primary, dark ? bgDarken : white, dark ? 0.12 : 0.93), 1)} !important;`);
	out.push(`--colorSecondary3_3: rgba(50,169,252,1) !important;`);
	out.push(`--colorSecondary3_4: rgba(230,242,250,1) !important;`);

	// ---- Secondary4:会员金,保留 ----
	out.push(`--colorSecondary4: rgba(211,160,59,1) !important;`);

	// ---- 前景色 Black1..12(模式敏感)----
	FOREGROUND_ALPHA.forEach((a, i) => {
		out.push(`--colorBlack${i + 1}: ${rgba(fgBase, a)} !important;`);
	});

	// ---- White1..12(深底上的文字/图标,两模式同白)----
	FOREGROUND_ALPHA.forEach((a, i) => {
		out.push(`--colorWhite${i + 1}: ${rgba(white, a)} !important;`);
	});

	// ---- Sidebar1..13 ----
	FOREGROUND_ALPHA.slice(0, 7).forEach((a, i) => {
		out.push(`--colorSidebar${i + 1}: ${rgba(sidebarFgBase, a)} !important;`);
	});
	out.push(`--colorSidebar8: ${rgba(dark ? mix(bg, [255, 255, 255], 0.08) : white, 1)} !important;`);
	out.push(`--colorSidebar9:  ${rgba(primary, 1)} !important;`);
	out.push(`--colorSidebar10: ${rgba(primary, 1)} !important;`);
	out.push(`--colorSidebar11: ${rgba(primary, 1)} !important;`);
	out.push(`--colorSidebar12: ${rgba(primary, 1)} !important;`);
	out.push(`--colorSidebar13: ${rgba(white, 1)} !important;`);

	// ---- 背景 ----
	out.push(`--colorBackground: ${rgba(bg, 1)} !important;`);
	out.push(`--colorBackgroundWhite: ${rgba(dark ? bgDarken : white, 1)} !important;`);

	// ---- Function:灰阶成员跟随前景,红心/播放态跟随主色,其余保留 ----
	out.push(`--colorFunction1: ${rgba(fgBase, 0.5)} !important;`);
	out.push(`--colorFunction2: ${rgba(dark ? surface : white, 1)} !important;`);
	out.push(`--colorFunction3: ${rgba(white, 0.8)} !important;`);
	out.push(`--colorFunction4: ${rgba(white, 1)} !important;`);
	out.push(`--colorFunction5: ${rgba(fgBase, 0.06)} !important;`);
	out.push(`--colorFunction6: ${rgba(white, 0.8)} !important;`);
	out.push(`--colorFunction7: ${rgba(fgBase, 0.8)} !important;`);
	out.push(`--colorFunction8: ${rgba(fgBase, 1)} !important;`);
	out.push(`--colorFunction9: ${rgba(fgBase, 0.06)} !important;`);
	out.push(`--colorFunction10: ${rgba(fgBase, 0.1)} !important;`);
	out.push(`--colorFunction11: ${rgba(primary, 1)} !important;`);
	out.push(`--colorFunction12: ${rgba(mix(primary, [255, 0, 60], 0.12), 1)} !important;`);
	out.push(`--colorFunction13: rgba(50,119,255,1) !important;`);
	out.push(`--colorFunction14: rgba(119,88,255,1) !important;`);
	out.push(`--colorFunction15: ${rgba(white, 1)} !important;`);
	out.push(`--colorFunction16: ${rgba(dark ? bgDarken : [45, 45, 56], 1)} !important;`);
	out.push(`--colorFunction17: ${rgba(dark ? mix(bg, [255, 255, 255], 0.04) : [250, 250, 250], 1)} !important;`);

	// ---- Mask:保持网易云原值 ----
	out.push(`--colorMask1: rgba(0,0,0,0.7) !important;`);
	out.push(`--colorMask2: rgba(0,0,0,0.3) !important;`);
	out.push(`--colorMask3: rgba(0,0,0,0.25) !important;`);
	out.push(`--colorMask4: rgba(0,0,0,0.1) !important;`);
	out.push(`--colorMask5: rgba(0,0,0,0) !important;`);

	// ---- reset 系(第二令牌层:JS 注入的静态亮色 RGB 三元组,卡片/文字大量消费)----
	// 深色下必须重映射,否则卡片永远是白底(rgba(var(--reset-white),1))
	out.push(`--reset-white: ${surface.join(',')} !important;`);
	out.push(`--reset-black: ${dark ? fgBase.join(',') : '0,0,0'} !important;`);
	// grey 阶:grey-0(最浅表面)→ grey-9(正文),dark 下从深表面渐变到浅前景
	const greyOld = { 0: 249, 1: 230, 2: 198, 3: 167, 5: 107, 6: 85, 7: 65, 8: 46, 9: 28 };
	const greyTable = { 0: '249,249,249', 1: '230,232,234', 2: '198,202,205', 3: '167,171,176', 5: '107,112,117', 6: '85,91,97', 7: '65,70,76', 8: '46,50,56', 9: '28,31,35' };
	for (const [n, old] of Object.entries(greyOld)) {
		let rgb;
		if (!dark) {
			rgb = greyTable[n].split(',').map(Number);
		} else {
			const t = (249 - old) / 221;
			rgb = mix(surface, fgBase, t);
		}
		out.push(`--reset-grey-${n}: ${rgb.join(',')} !important;`);
	}
	// 彩色系:浅底档(-0/-1/-2)在 dark 下压深,主色档保持原值
	const colorFamilies = {
		blue: { lights: { 0: [234, 245, 255], 1: [203, 231, 254], 2: [152, 205, 253] }, base: [0, 98, 214], solids: { 6: '0,98,214', 7: '0,79,179', 8: '0,61,143', 9: '0,44,107' } },
		green: { lights: { 1: [208, 240, 209], 2: [164, 224, 167] }, base: [59, 179, 70], solids: { 5: '59,179,70', 6: '48,149,59', 7: '37,119,47' } },
		orange: { lights: { 0: [255, 248, 234], 1: [254, 238, 204], 2: [254, 217, 152] }, base: [252, 136, 0], solids: { 5: '252,136,0', 6: '210,103,0', 7: '168,74,0' } },
		red: { lights: { 0: [254, 242, 237], 1: [254, 221, 210], 2: [253, 183, 165] }, base: [249, 57, 32], solids: { 5: '249,57,32', 6: '213,37,21', 7: '178,20,12' } },
	};
	for (const [name, fam] of Object.entries(colorFamilies)) {
		for (const [n, orig] of Object.entries(fam.lights)) {
			const rgb = dark ? mix(fam.base, bg, 0.8) : orig;
			out.push(`--reset-${name}-${n}: ${rgb.join(',')} !important;`);
		}
		for (const [n, v] of Object.entries(fam.solids)) {
			out.push(`--reset-${name}-${n}: ${v} !important;`);
		}
	}

	return `html {\n${out.map((l) => '\t' + l).join('\n')}\n}`;
};
