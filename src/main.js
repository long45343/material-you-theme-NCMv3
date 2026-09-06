// Material You Theme — NCM v3
// 网易云音乐 3.1.x Material You 动态主题
// 架构:取色引擎(复用 2.x)→ MD3 配色 → 3.1 全局令牌映射(theme-tokens.js)

import './styles/variables.scss';
import './styles/base.scss';
import './styles/app-shell.scss';
import './styles/nav.scss';
import './styles/maintab.scss';
import './styles/songplay.scss';
import './styles/player.scss';
import './styles/pages.scss';
import './styles/overrides.scss';

import { waitForElement, getSetting, setSetting, makeToast, chunk } from './utils.js';
import { argb2Rgb, rgb2Hsl } from './color-utils.js';
import { schemePresets } from './scheme-presets.js';
import { initSettingMenu } from './settings.js';
import { themeFromSourceColor, QuantizerCelebi, Hct, Score, SchemeExpressive, SchemeVibrant, SchemeMonochrome, SchemeFidelity, SchemeTonalSpot, SchemeNeutral, MaterialDynamicColors } from '@material/material-color-utilities';
import { buildTokenCSS, rgba, mix as mixRgb } from './theme-tokens.js';

const migrateSettings = () => {
	if (getSetting('scheme') == 'dynamic-auto') {
		setSetting('scheme', 'dynamic-default-auto');
	}
}

// ---------------------------------------------------------------- 状态
window.mdScheme = null;          // 当前方案名
window.mdThemeType = null;       // 'light' | 'dark'
window.mdCoverDominantColor = null;   // 封面主色 (ARGB)
window.mdBGEnhancedDominantColor = null; // 播放页背景主色 (ARGB)
window.mdActivePreset = null;    // 非动态方案时激活的预设

migrateSettings();

// ---------------------------------------------------------------- 样式控制器
const addOrRemoveGlobalClassByOption = (className, optionValue) => {
	if (optionValue) {
		document.body.classList.add(className);
	} else {
		document.body.classList.remove(className);
	}
}

const updateAccentColor = ([r, g, b], name = '') => {
	if (name == '' || name == 'primary') {
		name = '--md-accent-color';
	} else {
		name = '--md-accent-color-' + name;
	}
	document.body.style.setProperty(name, `rgb(${r}, ${g}, ${b})`);
	document.body.style.setProperty(name + '-rgb', `${r}, ${g}, ${b}`);
}

// 3.1 全局令牌覆盖层(心脏:见 theme-tokens.js)
const tokenStyleController = document.createElement('style');
tokenStyleController.id = 'md-token-override';
document.head.appendChild(tokenStyleController);

// 动态方案变量控制器(--md-dynamic-*:保留给设置面板预览与我们自身样式)
const dynamicColorController = document.createElement('style');
document.head.appendChild(dynamicColorController);

const defaultDynamicColor = {
	'--md-dynamic-light-primary': 'rgb(103, 80, 164)',
	'--md-dynamic-light-primary-rgb': '103, 80, 164',
	'--md-dynamic-light-secondary': 'rgb(98, 91, 113)',
	'--md-dynamic-light-secondary-rgb': '98, 91, 113',
	'--md-dynamic-light-bg': 'rgb(244, 239, 244)',
	'--md-dynamic-light-bg-rgb': '244, 239, 244',
	'--md-dynamic-light-bg-darken': 'rgb(251, 246, 251)',
	'--md-dynamic-light-bg-darken-rgb': '251, 246, 251',

	'--md-dynamic-dark-primary': 'rgb(208, 188, 255)',
	'--md-dynamic-dark-primary-rgb': '208, 188, 255',
	'--md-dynamic-dark-secondary': 'rgb(204, 194, 220)',
	'--md-dynamic-dark-secondary-rgb': '204, 194, 220',
	'--md-dynamic-dark-bg': 'rgb(49, 48, 51)',
	'--md-dynamic-dark-bg-rgb': '49, 48, 51',
	'--md-dynamic-dark-bg-darken': 'rgb(38, 37, 40)',
	'--md-dynamic-dark-bg-darken-rgb': '38, 37, 40',
};

// ---------------------------------------------------------------- 配色引擎(复用 2.x,纯函数部分)
export const getDynamicThemeColor = () => {
	const source = window.mdDynamicThemeColorSource ?? getSetting('dynamic-theme-color-source', 'cover');
	if (source == 'cover') {
		return window.mdCoverDominantColor;
	} else if (source == 'bg-enhanced') {
		return window.mdBGEnhancedDominantColor ?? window.mdCoverDominantColor;
	}
	else {
		const color = window.mdCostomDynamicThemeColor ?? JSON.parse(getSetting('custom-dynamic-theme-color', '[189, 230, 251]'));
		return (color[0] << 16 >>> 0) | (color[1] << 8 >>> 0) | color[2];
	}
}
// E2:引擎结果缓存 —— 键 = 取色源解析出的颜色 + 方案名。
// 换歌/取色源切换/自定义改色都会改变解析色 → 键自然失效,无需手动清理。
const themeCSSCache = new Map();
export const getThemeCSSFromColor = (schemeName = null) => {
	const color = getDynamicThemeColor();
	if (!color) {
		return defaultDynamicColor;
	}
	const cacheKey = String(color) + '|' + (schemeName ?? '');
	if (themeCSSCache.has(cacheKey)) {
		return themeCSSCache.get(cacheKey);
	}
	const result = computeThemeCSSFromColor(color, schemeName);
	if (result) {
		themeCSSCache.set(cacheKey, result);
		if (themeCSSCache.size > 40) themeCSSCache.clear();
	}
	return result;
};

const computeThemeCSSFromColor = (color, schemeName) => {
	if (!schemeName) {
		schemeName = window.mdScheme ?? 'dynamic-default-auto';
	}
	if (!schemeName.startsWith('dynamic-')) {
		return '';
	}
	schemeName = schemeName.replace(/^dynamic-/, '');
	schemeName = schemeName.replace(/-(light|dark|auto)$/, '');

	if (schemeName === 'default') {
		const theme = themeFromSourceColor(color);

		theme.schemes.light.bgDarken = (Hct.from(theme.palettes.neutral.hue, theme.palettes.neutral.chroma, 97.5)).toInt();
		theme.schemes.dark.bgDarken = (Hct.from(theme.palettes.neutral.hue, theme.palettes.neutral.chroma, 15)).toInt();

		let newCSSItems = {};
		const updateColor = (colorMode, key, name) => {
			const [r, g, b] = [...argb2Rgb(theme.schemes[colorMode][key])]
			newCSSItems[`--md-dynamic-${colorMode}-${name}`] = `rgb(${r}, ${g}, ${b})`;
			newCSSItems[`--md-dynamic-${colorMode}-${name}-rgb`] = `${r}, ${g}, ${b}`;
		}
		for (let colorMode of ['light', 'dark']) {
			updateColor(colorMode, 'primary', 'primary');
			updateColor(colorMode, 'secondary', 'secondary');
			updateColor(colorMode, 'inverseOnSurface', 'bg');
			updateColor(colorMode, 'bgDarken', 'bg-darken');
		}
		return newCSSItems;
	} else {
		const schemeGenerator = {
			'tonal-spot': SchemeTonalSpot,
			'vibrant': SchemeVibrant,
			'expressive': SchemeExpressive,
			'neutral': SchemeNeutral,
			//'monochrome': SchemeMonochrome,
			'fidelity': SchemeFidelity
		};
		const dynamicScheme = {};
		dynamicScheme.light = new schemeGenerator[schemeName](
			Hct.fromInt(color),
			false,
			0.0
		);
		dynamicScheme.dark = new schemeGenerator[schemeName](
			Hct.fromInt(color),
			true,
			0.0
		);

		let newCSSItems = {};
		const updateColor = (colorMode, key, name) => {
			const [r, g, b] = [...argb2Rgb(MaterialDynamicColors[key].getArgb(dynamicScheme[colorMode]))];
			newCSSItems[`--md-dynamic-${colorMode}-${name}`] = `rgb(${r}, ${g}, ${b})`;
			newCSSItems[`--md-dynamic-${colorMode}-${name}-rgb`] = `${r}, ${g}, ${b}`;
		}
		for (let colorMode of ['light', 'dark']) {
			updateColor(colorMode, 'primary', 'primary');
			updateColor(colorMode, 'secondary', 'secondary');
			updateColor(colorMode, 'background', 'bg');
			updateColor(colorMode, 'surfaceContainerLowest', 'bg-darken');
		}
		return newCSSItems;
	}
}
export const updateDynamicTheme = () => {
	const CSSItems = getThemeCSSFromColor();
	let CSS = '';
	for (const [key, value] of Object.entries(CSSItems)) {
		CSS += `${key}: ${value};`;
	}
	dynamicColorController.innerHTML = `:root {${CSS}}`;
};

// ---------------------------------------------------------------- 主题刷新(令牌层 + 强调色变量)
// 汇总当前方案 + 当前亮暗模式的四元组 {primary, secondary, bg, bgDarken}
const getActiveColors = () => {
	if (window.mdActivePreset) {
		const p = window.mdActivePreset;
		return { primary: p.primary, secondary: p.secondary, bg: p.bg, bgDarken: p['bg-darken'] };
	}
	const mode = window.mdThemeType === 'dark' ? 'dark' : 'light';
	const items = getThemeCSSFromColor();
	const parse = (name) => {
		const v = items[`--md-dynamic-${mode}-${name}`];
		if (typeof v !== 'string') return null;
		const parts = v.match(/\d+/g);
		return parts ? parts.slice(0, 3).map(Number) : null;
	};
	return { primary: parse('primary'), secondary: parse('secondary'), bg: parse('bg'), bgDarken: parse('bg-darken') };
};

// E3c:背景交叉淡出层(样式见 base.scss #md-bg-fader)。
// 旧背景色由上一轮 refreshTheme 记录,避免 getComputedStyle 读取(那会强制同步整文档样式重算)。
let lastFaderBg = null;
const ensureBgFader = () => {
	let f = document.getElementById('md-bg-fader');
	if (!f && document.body) {
		f = document.createElement('div');
		f.id = 'md-bg-fader';
		document.body.appendChild(f);
	}
	return f;
};
const bgTokenColor = (colors, dark) => rgba(dark ? colors.bg : mixRgb(colors.bg, [226, 229, 233], 0.55), 1);

const refreshTheme = () => {
	const __t0 = performance.now();
	updateDynamicTheme();
	const __t1 = performance.now();
	const mode = window.mdThemeType === 'dark' ? 'dark' : 'light';
	let colors = getActiveColors();
	const __t2 = performance.now();
	if (!colors.primary) {
		// 引擎还没有取到色(无封面):用默认动态色兜底
		const fallback = (n) => defaultDynamicColor[`--md-dynamic-${mode}-${n}`].match(/\d+/g).slice(0, 3).map(Number);
		colors = { primary: fallback('primary'), secondary: fallback('secondary'), bg: fallback('bg'), bgDarken: fallback('bg-darken') };
	}

	// E3c 起点状态(与令牌同帧应用,无读取开销):fader 置为旧背景色、不透明、无过渡;
	// 下一帧起 transition 生效,opacity 1→0 在合成线程上以显示器刷新率交叉淡出
	const fader = ensureBgFader();
	const newBgToken = colors.bg ? bgTokenColor(colors, mode === 'dark') : null;
	if (fader && lastFaderBg && newBgToken && lastFaderBg !== newBgToken) {
		fader.style.transition = 'none';
		fader.style.backgroundColor = lastFaderBg;
		fader.style.opacity = '1';
		requestAnimationFrame(() => {
			fader.style.transition = 'opacity 0.25s ease';
			fader.style.opacity = '0';
		});
	}
	lastFaderBg = newBgToken;

	tokenStyleController.innerHTML = buildTokenCSS(colors, mode);
	const __t3 = performance.now();

	// 强调色变量(设置面板与插件样式消费)
	updateAccentColor(colors.primary, 'primary');
	updateAccentColor(colors.secondary, 'secondary');
	updateAccentColor(colors.bg, 'bg');
	updateAccentColor(colors.bgDarken, 'bg-darken');


	applyNativeAppearance(colors.primary);

	// E1 二期:阶段耗时打点(内存累积,recon meta.json 转储;上线后可移除)
	const __w = (window.__mdStageStats ??= []);
	__w.push(`dyn=${(__t1-__t0).toFixed(1)} engine=${(__t2-__t1).toFixed(1)} token=${(__t3-__t2).toFixed(1)} accent=${(performance.now()-__t3).toFixed(1)}`);
	if (__w.length > 24) __w.shift();
};

// ---------------------------------------------------------------- 原生外观联动(D3=实验开关)
// Spike S2 实测:channel.call('app.loadSkinPackets', cb, [type, name, extra]),
// 网易云启动时自调 ("common","common",{btn_color:{h,s,l}}),btn_color 为 HSL(h 0-360, s/l 0-100)。
let lastNativeColorKey = '';
const applyNativeAppearance = (primary) => {
	if (getSetting('native-skin-link', false) !== true) return;
	try {
		const key = primary.join(',');
		if (key === lastNativeColorKey) return; // 去重,防止与网易云自身更新形成循环
		lastNativeColorKey = key;
		const [h, s, l] = rgb2Hsl(primary);
		channel.call('app.loadSkinPackets', () => {}, ['common', 'common', {
			btn_color: { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
		}]);
	} catch (e) { /* 原生接口失败静默跳过 */ }
};

// ---------------------------------------------------------------- 菜单染色(D8,S3 实测 payload 为明文)
// winhelper.updateMenu / winhelper.popupMenu 的 args[1][0].content 是菜单 JSON 字符串:
//   文本项:image_color = "#AARRGGBB";按钮组:url 内 svg_color='#AARRGGBB'(normal=b3/hot=ff/disabled=4d)。
// 策略:保留原 alpha,后 6 位 RGB 替换为主题主色。
const primaryRGBHex = () => {
	const c = getActiveColors().primary ?? [103, 80, 164];
	return c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
};
let menuChannelPatched = false;
const hookChannelMenus = () => {
	if (getSetting('menu-coloring', true) !== true) return;
	if (menuChannelPatched || !window.channel || !channel.call) return;
	menuChannelPatched = true;
	const orig = channel.call;
	channel.call = function (name, ...args) {
		try {
			if (name === 'winhelper.updateMenu' || name === 'winhelper.popupMenu') {
				const menuObj = args[1]?.[0];
				if (menuObj && typeof menuObj.content === 'string' && menuObj.content.indexOf('#') !== -1) {
					const rgb = primaryRGBHex();
					// 保留原 8 位色中的 alpha(前 2 位),RGB 部分替换为主题主色
					menuObj.content = menuObj.content
						.replace(/("image_color":"#)([0-9a-fA-F]{2})([0-9a-fA-F]{6})/g, `$1$2${rgb}`)
						.replace(/(svg_color='#)([0-9a-fA-F]{2})([0-9a-fA-F]{6})/g, `$1$2${rgb}`);
				}
			}
		} catch (e) { /* 染色失败不影响原调用 */ }
		return orig.call(this, name, ...args);
	};
};

// ---------------------------------------------------------------- 方案应用
export const applyScheme = (scheme) => {
	window.mdScheme = scheme;
	document.body.classList.add('material-you-theme');
	document.body.classList.remove('md-dynamic-theme-light', 'md-dynamic-theme-dark', 'md-dynamic-theme-auto');
	if (scheme.startsWith('dynamic')) {
		window.mdActivePreset = null; // 清除普通主题残留,否则动态配色永远取旧预设(R5 根因)
		document.body.classList.add('md-dynamic-theme');
		const mode = scheme.split('-').slice(-1)[0];
		document.body.classList.add(`md-dynamic-theme-${mode}`);
		if (mode != 'auto') {
			setThemeType(mode);
		} else {
			// auto:交由 probeAndWatchAppThemeMode 判定
			refreshThemeWithCurrentMode();
		}
		return;
	}
	document.body.classList.remove('md-dynamic-theme');

	let preset;
	if (scheme == 'custom') {
		preset = JSON.parse(getSetting('custom-scheme', JSON.stringify(schemePresets['dark-blue'])));
	} else {
		if (!schemePresets[scheme]) {
			scheme = 'dark-blue';
		}
		preset = schemePresets[scheme];
	}

	preset['secondary'] ??= preset['primary'];
	if (preset['light']) {
		preset['grey-base'] ??= [0, 0, 0];
	} else {
		preset['grey-base'] ??= [255, 255, 255];
	}
	window.mdActivePreset = preset;
	setThemeType(preset['light'] ? 'light' : 'dark');
}

// 显式设置亮暗(auto 模式下由探测层调用)
const setThemeType = (mode) => {
	const changed = window.mdThemeType !== mode;
	window.mdThemeType = mode;
	document.body.classList.toggle('md-light', mode === 'light');
	document.body.classList.toggle('md-dark', mode === 'dark');
	refreshTheme();
	if (changed) {
		document.body.dispatchEvent(new CustomEvent('md-dynamic-theme-auto'));
	}
};
const refreshThemeWithCurrentMode = () => {
	if (!window.mdThemeType) {
		setThemeType(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
	} else {
		refreshTheme();
	}
};

const initSettings = () => {
	applyScheme(getSetting('scheme', 'dynamic-default-auto'));
	addOrRemoveGlobalClassByOption('ignore-now-playing', getSetting('ignore-now-playing-page', false));
	addOrRemoveGlobalClassByOption('md-disable-comment-style', getSetting('disable-comment-style', false));
	addOrRemoveGlobalClassByOption('hide-ncm-logo', getSetting('hide-ncm-logo', false));
}

// ---------------------------------------------------------------- 取色源(3.1 多候选链)
const COVER_CANDIDATES = [
	'#page_pc_mini_bar img',
	'#VINYL_COVER_ELEMENT_ID img',
	'.cover-container-rotate img',
	'.cover-area img',
	'.TrackInfoContainer img',
];
const isUsableCover = (img) => {
	if (!img || !img.src) return false;
	if (!(img.src.startsWith('http') || img.src.startsWith('orpheus://cache'))) return false;
	const rect = img.getBoundingClientRect();
	return rect.width > 24 && rect.height > 24;
};
const getCoverElement = () => {
	for (const sel of COVER_CANDIDATES) {
		for (const img of document.querySelectorAll(sel)) {
			if (isUsableCover(img)) return img;
		}
	}
	return null;
};

const updateDynamicColorFromCover = (img) => {
	const canvas = document.createElement('canvas');
	canvas.width = 48;
	canvas.height = 48;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0, 48, 48);
	const pixels = chunk(ctx.getImageData(0, 0, 48, 48).data, 4).map((pixel) => {
		return ((pixel[3] << 24 >>> 0) | (pixel[0] << 16 >>> 0) | (pixel[1] << 8 >>> 0) | pixel[2]) >>> 0;
	});

	const quantizedColors = QuantizerCelebi.quantize(pixels, 128);
	const ranked = Score.score(quantizedColors);
	const top = ranked[0];

	window.mdCoverDominantColor = top;
	document.body.dispatchEvent(new CustomEvent('md-dominant-color-change'));

	refreshTheme();
}

let lastCoverSrc = '';
const scanCover = () => {
	const img = getCoverElement();
	if (!img) return;
	if (img.src === lastCoverSrc) return;
	if (img.complete && img.naturalWidth > 0) {
		lastCoverSrc = img.src;
		updateDynamicColorFromCover(img);
	} else {
		img.addEventListener('load', () => {
			if (img.src === lastCoverSrc) return;
			lastCoverSrc = img.src;
			updateDynamicColorFromCover(img);
		}, { once: true });
	}
};
const setupCoverWatcher = () => {
	let timer = null;
	new MutationObserver(() => {
		clearTimeout(timer);
		timer = setTimeout(scanCover, 300);
	}).observe(document.body, { childList: true, subtree: true });
	scanCover();
};

// ---------------------------------------------------------------- 亮暗模式探测(D4:跟随网易云自身设置)
// 网易云把主题令牌写在 html 的 inline style 上;监听其变化,
// 用 --colorBackground 的亮度判定它当前的亮暗,即"跟随网易云"。
const readNCMMode = () => {
	const style = document.documentElement.getAttribute('style') || '';
	const m = style.match(/--colorBackground:\s*rgba?\(([^)]+)\)/);
	if (!m) return null;
	const parts = m[1].split(',').map((v) => parseFloat(v));
	if (parts.length < 3 || isNaN(parts[0])) return null;
	const [r, g, b] = parts;
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? 'light' : 'dark';
};

const probeAndWatchAppThemeMode = () => {
	const systemFallback = () => {
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
		return 'light';
	};
	const update = () => {
		if (!window.mdScheme || !window.mdScheme.endsWith('-auto')) return; // 仅 auto 跟随
		const mode = readNCMMode() ?? systemFallback();
		setThemeType(mode);
	};
	new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
	update();
};

// ---------------------------------------------------------------- 设置入口(D7:侧栏头像旁)
const injectSettingsEntry = () => {
	waitForElement('#page_pc_main_nav', (nav) => {
		// 关键路径(A1):容器创建与按钮初始化调度必须最先执行;
		// 装饰性逻辑(重挂守卫/皮肤隐藏)失败只允许影响外观,不得阻断按钮出现。
		const container = document.createElement('div');
		container.id = 'md-settings-menu-container';
		container.className = 'md-settings-menu-container';
		container.addEventListener('dblclick', (e) => e.stopPropagation());
		container.addEventListener('mousedown', (e) => e.stopPropagation());

		// React/ReactDOM 由客户端 vendor 挂载,需等待就绪(initSettingMenu 内部有容器缺失重试,可容忍时序差)
		const waitReactDOM = setInterval(() => {
			if (window.ReactDOM && window.React) {
				clearInterval(waitReactDOM);
				initSettingMenu();
			}
		}, 200);

		try {
			// 锚点:原生徽章行末尾(E4:✉ ⚙ [我们]);IconBar 本体在分隔线之前,徽章数量变化不影响
			const getAnchor = () => nav.querySelector('[class*="MiniModeIconBar_"]')?.parentElement
				?? nav.querySelector('img.cmd-image')?.closest('[class*="Bar_"]')?.parentElement
				?? nav;

			// React 重渲染会抹掉它不认识的子节点;且图标行可能晚于注入时机挂载:
			// 每次 DOM 变化都把容器纠正到正确的锚点(已到位则无操作)
			const reattach = () => {
				const anchor = getAnchor();
				const divider = anchor.querySelector('[class*="Divider_"]');
				if (container.parentElement !== anchor || (divider && container.nextElementSibling !== divider && divider.parentElement === anchor)) {
					anchor.insertBefore(container, divider && divider.parentElement === anchor ? divider : null);
				}
			};
			reattach();
			new MutationObserver(reattach).observe(nav, { childList: true, subtree: true });

			// 隐藏网易云皮肤切换入口(主题启用时与主题冲突;连同未读红点)
			const hideSkinEntry = () => {
				const icon = nav.querySelector('.cmd-icon-skin');
				if (!icon) return;
				const btn = icon.closest('[class*="BadgeWrapper"]') ?? icon.closest('.cmd-badge') ?? icon.closest('button') ?? icon;
				btn.style.display = 'none';
			};
			hideSkinEntry();
			new MutationObserver(hideSkinEntry).observe(nav, { childList: true, subtree: true });
		} catch (e) {
			console.error('MD3 nav decorations', e);
		}

		// BNCM 入口归位在第二轮以纯 CSS 实现(docs/FIX-CHECKLIST.md 工作项 D):
		// 严禁 JS 搬移/插入 React 管理的节点(96b51cc 前车之鉴:协调冲突 → 首启崩溃)
	});
};

// ---------------------------------------------------------------- 问候语(保留,样式层可选消费)
const updateGreeting = () => {
	const timeSegments = [
		[0, 3, '夜深了'],
		[3, 6, '凌晨好'],
		[6, 12, '早上好'],
		[12, 18, '下午好'],
		[18, 23, '晚上好'],
		[23, 24, '夜深了']
	];
	const now = new Date();
	const hour = now.getHours();
	for (const segment of timeSegments) {
		if (hour >= segment[0] && hour < segment[1]) {
			document.body.style.setProperty('--md-greeting', `'${segment[2]}'`);
			break;
		}
	}
}

// ---------------------------------------------------------------- 启动
const boot = () => {
	try { initSettings(); } catch (e) { console.error('MD3 initSettings', e); }
	updateGreeting();
	setInterval(updateGreeting, 30000);

	hookChannelMenus(); // 菜单染色(D8):尽早挂,晚于 applyScheme 以取到主色
	setupCoverWatcher();
	probeAndWatchAppThemeMode();
	injectSettingsEntry();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot);
} else {
	boot();
}

// BetterNCM 插件管理页的配置入口(兜底;framework 未提供 plugin 全局时静默跳过)
try {
	if (typeof plugin !== 'undefined' && plugin.onConfig) {
		plugin.onConfig(() => {
			const wrap = document.createElement('div');
			const span = document.createElement('span');
			span.innerHTML = '打开设置面板 ';
			span.style.fontSize = '16px';
			const btn = document.createElement('button');
			btn.innerText = '打开';
			btn.addEventListener('click', () => {
				document.querySelector('#md-theme-setting-btn:not(.active)')?.click();
			});
			wrap.appendChild(span);
			wrap.appendChild(btn);
			return wrap;
		});
	}
} catch (e) { /* framework 不提供 plugin 上下文时忽略 */ }
