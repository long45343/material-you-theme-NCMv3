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
import { buildTokenCSS, rgba, mix as mixRgb, foregroundOf, FOREGROUND_ALPHA } from './theme-tokens.js';

// 兼容性适配: 为依赖旧版 MaterialYouTheme 标识的第三方插件 (如 Refined Now Playing Next) 注入别名映射
try {
	if (typeof window !== 'undefined') {
		window.loadedPlugins = window.loadedPlugins || {};
		if (!window.loadedPlugins['MaterialYouTheme']) {
			window.loadedPlugins['MaterialYouTheme'] = window.loadedPlugins['material-u-theme-ncmv3'] || {
				manifest: { name: 'MaterialYouTheme', version: '1.0.1-alpha' }
			};
		}
	}
} catch (e) {}

const migrateSettings = () => {
	if (getSetting('scheme') == 'dynamic-auto') {
		setSetting('scheme', 'dynamic-default-auto');
	}
}

// ---------------------------------------------------------------- 状态
window.mdScheme = null;          // 当前方案名

// 响应式代理 window.mdThemeType: 拦截外部直接改写并自动触发主题重绘自愈
let _mdThemeType = null;
let _isSyncingThemeType = false;
try {
	Object.defineProperty(window, 'mdThemeType', {
		get: () => _mdThemeType,
		set: (val) => {
			if (_mdThemeType === val) return;
			_mdThemeType = val;
			if (!_isSyncingThemeType && typeof setThemeType === 'function') {
				_isSyncingThemeType = true;
				try {
					setThemeType(val);
				} finally {
					_isSyncingThemeType = false;
				}
			}
		},
		configurable: true,
		enumerable: true
	});
} catch (e) {
	window.mdThemeType = null;
}

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

// 默认动态兜底颜色：纯净中性灰色 (RGB 128, 128, 128)，杜绝生硬紫粉色
const defaultDynamicColor = {
	'--md-dynamic-light-primary': 'rgb(128, 128, 128)',
	'--md-dynamic-light-primary-rgb': '128, 128, 128',
	'--md-dynamic-light-secondary': 'rgb(100, 100, 100)',
	'--md-dynamic-light-secondary-rgb': '100, 100, 100',
	'--md-dynamic-light-bg': 'rgb(244, 239, 244)',
	'--md-dynamic-light-bg-rgb': '244, 239, 244',
	'--md-dynamic-light-bg-darken': 'rgb(251, 246, 251)',
	'--md-dynamic-light-bg-darken-rgb': '251, 246, 251',

	'--md-dynamic-dark-primary': 'rgb(180, 180, 180)',
	'--md-dynamic-dark-primary-rgb': '180, 180, 180',
	'--md-dynamic-dark-secondary': 'rgb(160, 160, 160)',
	'--md-dynamic-dark-secondary-rgb': '160, 160, 160',
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

// 判断 RNP (Refined Now Playing Next) 是否存在或处于激活态
const isRNPActive = () => {
	return Boolean(
		document.body.classList.contains('refined-now-playing')
		|| document.body.classList.contains('rnp-lyric-page-open')
		|| (typeof loadedPlugins !== 'undefined' && (loadedPlugins.RefinedNowPlayingNext || loadedPlugins['RefinedNowPlayingNext']))
		|| document.getElementById('rnp-view')
	);
};

// Q1 实施: 直写播放页内联样式 (--colorBlack* & --colorWhite*) 并维护守卫
// 逆向发现: NCM 播放页组件原生直接消费 --colorWhite1..12 作为主要文字颜色!
// 在亮色模式下, 必须将 --colorWhite* 和 --colorBlack* 都覆写为深色前景;
// 在暗色模式下, --colorWhite* 保持浅色/纯白, --colorBlack* 覆写为浅色前景。
let currentSongplayFg = null;
const applySongplayInlineTokens = (fg) => {
	if (isRNPActive()) return; // 冲突点3实施: RNP完全接管播放页，跳过对原生播放页的内联样式覆写
	if (fg) currentSongplayFg = fg;
	if (!currentSongplayFg) return;
	const isDark = window.mdThemeType === 'dark';
	const targets = [
		document.querySelector('#page_pc_songplay'),
		document.querySelector('#vinyl-page-container'),
		document.querySelector('[class*="VinylPageContainer_"]'),
	].filter(Boolean);

	if (targets.length === 0) return;

	targets.forEach((el) => {
		FOREGROUND_ALPHA.forEach((alpha, idx) => {
			const fgVal = rgba(currentSongplayFg, alpha);
			// 播放页内不论消费 --colorBlack 还是 --colorWhite 均保证对比度
			el.style.setProperty(`--colorBlack${idx + 1}`, fgVal);
			if (!isDark) {
				// 亮色模式下: 颠覆网易云把 --colorWhite* 写死为白色的逻辑, 写入深色前景
				el.style.setProperty(`--colorWhite${idx + 1}`, fgVal);
			} else {
				// 暗色模式下: 恢复标准纯白透明度
				el.style.setProperty(`--colorWhite${idx + 1}`, rgba([255, 255, 255], alpha));
			}
		});
	});
};

const setupSongplayWatcher = () => {
	let timer = null;
	const check = () => {
		if (isRNPActive()) return; // 冲突点3实施: 挂起空转监听，完全由 RNP 接管正在播放页
		const page = document.querySelector('#page_pc_songplay') || document.querySelector('#vinyl-page-container');
		if (page && currentSongplayFg) {
			const isDark = window.mdThemeType === 'dark';
			const firstWhiteVal = page.style.getPropertyValue('--colorWhite1');
			const targetWhiteVal = isDark ? rgba([255, 255, 255], FOREGROUND_ALPHA[0]) : rgba(currentSongplayFg, FOREGROUND_ALPHA[0]);
			if (firstWhiteVal !== targetWhiteVal) {
				applySongplayInlineTokens();
			}
		}
	};
	new MutationObserver(() => {
		if (isRNPActive()) return; // RNP 激活时不触发延时检查
		clearTimeout(timer);
		timer = setTimeout(check, 50);
	}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
};

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

		// E1 四期:舞台令牌 —— 播放页/评论区的底色与前景改用我们自有名字的令牌。
		// 实测网易云在播放页子树局部覆盖 --colorBackground/--colorBlack*(劫持全局令牌),
		// 自有名字(--md-stage-*)无法被局部覆盖,保证播放页/评论区的深浅与模式一致。
		const __fg = foregroundOf(colors, mode === 'dark');
		const __bodyStyle = document.body.style;
		__bodyStyle.setProperty('--md-stage-bg', bgTokenColor(colors, mode === 'dark'));
		__bodyStyle.setProperty('--md-stage-fg', rgba(__fg, 1));
		__bodyStyle.setProperty('--md-stage-fg-muted', rgba(__fg, 0.55));
		__bodyStyle.setProperty('--md-stage-surface', mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)');

		// Q1 决议: JS 动态直写播放页内联 --colorBlack1..12, 击穿原生局部劫持
		applySongplayInlineTokens(__fg);

		tokenStyleController.innerHTML = buildTokenCSS(colors, mode);
	const __t3 = performance.now();

		// 强调色变量(设置面板与插件样式消费)
		updateAccentColor(colors.primary, 'primary');
		updateAccentColor(colors.secondary, 'secondary');
		updateAccentColor(colors.bg, 'bg');
		updateAccentColor(colors.bgDarken, 'bg-darken');

			// 冲突点4实施: 正向桥接 RNP 强调色变量，实现全客户端与 RNP 全屏歌词页色彩 100% 严密同频
			// 注意: RNP 歌词文字直接消费 --rnp-accent-color-shade-2，副歌词消费 shade-1。
			// 必须完整注入对应全套色阶，杜绝变量为空导致歌词文字透明/隐形。
			if (colors.primary) {
				const [r, g, b] = colors.primary;
				const rgbStr = `${r}, ${g}, ${b}`;
				const colorRgb = `rgb(${rgbStr})`;
				const isDark = mode === 'dark';
				const bStyle = document.body.style;

				bStyle.setProperty('--rnp-accent-color', colorRgb);
				bStyle.setProperty('--rnp-accent-color-rgb', rgbStr);
				bStyle.setProperty('--rnp-accent-color-dark', colorRgb);
				bStyle.setProperty('--rnp-accent-color-dark-rgb', rgbStr);
				bStyle.setProperty('--rnp-accent-color-light', colorRgb);
				bStyle.setProperty('--rnp-accent-color-light-rgb', rgbStr);

				if (isDark) {
					// 暗色模式: 歌词主文字高亮纯白，次级文字淡灰
					bStyle.setProperty('--rnp-accent-color-shade-2', '#ffffff');
					bStyle.setProperty('--rnp-accent-color-shade-2-rgb', '255, 255, 255');
					bStyle.setProperty('--rnp-accent-color-shade-1', 'rgba(255, 255, 255, 0.75)');
					bStyle.setProperty('--rnp-accent-color-shade-1-rgb', '240, 240, 240');
					bStyle.setProperty('--rnp-accent-color-on-primary', '#ffffff');
					bStyle.setProperty('--rnp-accent-color-contrast', '#ffffff');
					bStyle.setProperty('--rnp-accent-color-contrast-rgb', '255, 255, 255');
					bStyle.setProperty('--rnp-accent-color-overlay', '#000000');
				} else {
					// 亮色模式: 歌词主文字深黑板岩色，次级文字深灰
					bStyle.setProperty('--rnp-accent-color-shade-2', '#1e1e22');
					bStyle.setProperty('--rnp-accent-color-shade-2-rgb', '30, 30, 34');
					bStyle.setProperty('--rnp-accent-color-shade-1', 'rgba(30, 30, 34, 0.75)');
					bStyle.setProperty('--rnp-accent-color-shade-1-rgb', '70, 70, 75');
					bStyle.setProperty('--rnp-accent-color-on-primary', '#000000');
					bStyle.setProperty('--rnp-accent-color-contrast', '#000000');
					bStyle.setProperty('--rnp-accent-color-contrast-rgb', '0, 0, 0');
					bStyle.setProperty('--rnp-accent-color-overlay', '#ffffff');
				}

				if (colors.secondary) {
					const [sr, sg, sb] = colors.secondary;
					bStyle.setProperty('--rnp-accent-color-bg', `rgb(${sr}, ${sg}, ${sb})`);
					bStyle.setProperty('--rnp-accent-color-bg-rgb', `${sr}, ${sg}, ${sb}`);
				}
			}


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

// ---------------------------------------------------------------- 菜单染色(D8: 遵循 Windows 原生菜单 BGR 格式)
// winhelper.updateMenu / winhelper.popupMenu 的 args[0].content (或 args[1][0].content) 是菜单 JSON 字符串:
// 关键: 网易云底层 Windows 原生层菜单接受的颜色通道格式为 #AABBGGRR (BGR 逆序),
// 原项目明确采用了 rgb.reverse()。若误用标准 RGB 会导致红蓝倒置(如青色变橙红)。
const primaryBGRHex = () => {
	const c = getActiveColors().primary ?? [103, 80, 164];
	const bgr = [c[2], c[1], c[0]]; // RGB -> BGR
	return bgr.map((v) => v.toString(16).padStart(2, '0')).join('').toLowerCase();
};

const updateMenuColorsInObject = (obj, bgrHex) => {
	if (!obj) return;
	if (Array.isArray(obj)) {
		obj.forEach((item) => updateMenuColorsInObject(item, bgrHex));
		return;
	}
	if (typeof obj === 'object') {
		if (obj.image_color && typeof obj.image_color === 'string') {
			const alphaMatch = obj.image_color.match(/^#([0-9a-fA-F]{2})/);
			const alpha = alphaMatch ? alphaMatch[1] : 'ff';
			obj.image_color = `#${alpha}${bgrHex}`;
		}
		if (obj.children) {
			updateMenuColorsInObject(obj.children, bgrHex);
		}
	}
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
				const bgr = primaryBGRHex();
				// 3.1 客户端签名可能为 (name, l, r) 其中 l.content 为 JSON 字符串
				for (let i = 0; i < args.length; i++) {
					const arg = args[i];
					const targetObj = (arg && typeof arg === 'object' && arg.content) ? arg : (Array.isArray(arg) && arg[0]?.content ? arg[0] : null);
					if (targetObj && typeof targetObj.content === 'string') {
						try {
							const parsed = JSON.parse(targetObj.content);
							updateMenuColorsInObject(parsed, bgr);
							targetObj.content = JSON.stringify(parsed);
						} catch (e) {
							// 兜底正则替换
							targetObj.content = targetObj.content
								.replace(/("image_color":"#)([0-9a-fA-F]{2})([0-9a-fA-F]{6})/g, `$1$2${bgr}`)
								.replace(/(svg_color='#)([0-9a-fA-F]{2})([0-9a-fA-F]{6})/g, `$1$2${bgr}`);
						}
					}
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
	const changed = _mdThemeType !== mode;
	_isSyncingThemeType = true;
	try {
		_mdThemeType = mode;
		document.body.classList.toggle('md-light', mode === 'light');
		document.body.classList.toggle('md-dark', mode === 'dark');
		refreshTheme();
		if (changed) {
			document.body.dispatchEvent(new CustomEvent('md-dynamic-theme-auto'));
		}
	} finally {
		_isSyncingThemeType = false;
	}
};
const refreshThemeWithCurrentMode = () => {
	if (!window.mdThemeType) {
		setThemeType(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
	} else {
		refreshTheme();
	}
};

	// 优先异步尝试从 BETTERNCM_PROFILE/material-you-theme-cache.json 读取上次缓存的主题色
	// 注意：该逻辑仅应在动态取色状态下生效；如果用户采用静态配色，则无视该逻辑。
	const tryLoadThemeCache = async () => {
		const currentScheme = getSetting('scheme', 'dynamic-default-auto');
		if (!currentScheme.startsWith('dynamic-')) {
			// 静态配色无视缓存文件
			return false;
		}
		if (typeof fetch === 'undefined' || typeof BETTERNCM_API_PATH === 'undefined') return false;
		try {
			const res = await fetch(BETTERNCM_API_PATH + '/fs/read_file_text?path=' + encodeURIComponent('material-you-theme-cache.json'), {
				headers: { 'BETTERNCM_API_KEY': BETTERNCM_API_KEY }
			});
			if (!res.ok) return false;
			const text = await res.text();
			if (!text) return false;
			const data = JSON.parse(text);
			if (data && typeof data.color === 'number' && Number.isFinite(data.color)) {
				// 成功读取到文件中的主题色
				window.mdCoverDominantColor = data.color;
				refreshTheme();
				return true;
			}
		} catch (e) {
			// 读取异常直接静默走常规兜底
		}
		return false;
	};

	const initSettings = () => {
		const savedScheme = getSetting('scheme', 'dynamic-default-auto');
		applyScheme(savedScheme);
		addOrRemoveGlobalClassByOption('ignore-now-playing', getSetting('ignore-now-playing-page', false));
		addOrRemoveGlobalClassByOption('md-disable-comment-style', getSetting('disable-comment-style', false));
		addOrRemoveGlobalClassByOption('hide-ncm-logo', getSetting('hide-ncm-logo', false));

		// 动态模式下优先读取磁盘缓存色
		if (savedScheme.startsWith('dynamic-')) {
			tryLoadThemeCache();
		}
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

// ---------------------------------------------------------------- 主题色磁盘持久化 (仅动态取色生效)
// 写入 BETTERNCM_PROFILE/material-you-theme-cache.json
let lastSavedColor = null;
let saveColorTimer = null;
const saveThemeCacheToFile = (force = false) => {
	// 仅在动态取色模式下生效；若用户采用静态配色，则完全无视该逻辑
	if (!window.mdScheme || !window.mdScheme.startsWith('dynamic-')) return;
	const color = window.mdCoverDominantColor;
	if (!color || typeof color !== 'number') return;
	if (!force && color === lastSavedColor) return;

	const doWrite = () => {
		lastSavedColor = color;
		if (typeof fetch !== 'undefined' && typeof BETTERNCM_API_PATH !== 'undefined') {
			const payload = JSON.stringify({
				color: color,
				scheme: window.mdScheme,
				time: Date.now()
			});
			fetch(BETTERNCM_API_PATH + '/fs/write_file_text?path=' + encodeURIComponent('material-you-theme-cache.json'), {
				method: 'POST',
				headers: { 'BETTERNCM_API_KEY': BETTERNCM_API_KEY, 'Content-Type': 'text/plain' },
				body: payload
			}).catch(() => {});
		}
	};

	if (force) {
		doWrite();
	} else {
		clearTimeout(saveColorTimer);
		saveColorTimer = setTimeout(doWrite, 1000); // 1s 防抖，避开热路径
	}
};

// 页面隐藏/卸载/关闭时立即强制落盘一次
window.addEventListener('pagehide', () => saveThemeCacheToFile(true));
window.addEventListener('beforeunload', () => saveThemeCacheToFile(true));

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
	saveThemeCacheToFile(); // 动态取色成功后防抖落盘
}

	// Q3 实施: 补全 3.1 播放页内置模糊背景取色逻辑 (闭环 D6 决策)
	const BG_CANDIDATES = [
		'#page_pc_songplay [class*="CoverBackgroundContainer_"] img',
		'#page_pc_songplay [class*="CoverBackgroundContainer_"] canvas',
		'#page_pc_songplay img[class*="bg"]',
	];
	const updateDynamicColorFromBuiltInBG = () => {
		let targetEl = null;
		for (const sel of BG_CANDIDATES) {
			const el = document.querySelector(sel);
			if (el) {
				if (el.tagName.toLowerCase() === 'img' && isUsableCover(el)) {
					targetEl = el;
					break;
				} else if (el.tagName.toLowerCase() === 'canvas' && el.width > 0 && el.height > 0) {
					targetEl = el;
					break;
				}
			}
		}
		if (!targetEl) {
			// 背景层未就绪或未进入播放页时，平滑回退到封面色
			window.mdBGEnhancedDominantColor = window.mdCoverDominantColor;
			return;
		}

		try {
			const canvas = document.createElement('canvas');
			canvas.width = 48;
			canvas.height = 48;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(targetEl, 0, 0, 48, 48);
			const pixels = chunk(ctx.getImageData(0, 0, 48, 48).data, 4).map((pixel) => {
				return ((pixel[3] << 24 >>> 0) | (pixel[0] << 16 >>> 0) | (pixel[1] << 8 >>> 0) | pixel[2]) >>> 0;
			});

			const quantizedColors = QuantizerCelebi.quantize(pixels, 128);
			const ranked = Score.score(quantizedColors);
			const top = ranked[0];

			if (top) {
				window.mdBGEnhancedDominantColor = top;
				document.body.dispatchEvent(new CustomEvent('md-dominant-color-change'));
				refreshTheme();
			}
		} catch (e) {
			window.mdBGEnhancedDominantColor = window.mdCoverDominantColor;
		}
	};

	let lastCoverSrc = '';
	const scanCover = () => {
		const img = getCoverElement();
		if (!img) return;
		if (img.src === lastCoverSrc) return;
		if (img.complete && img.naturalWidth > 0) {
			lastCoverSrc = img.src;
			updateDynamicColorFromCover(img);
			// 若当前启用了播放页背景取色源，在切歌时同步尝试更新背景取色
			if ((window.mdDynamicThemeColorSource ?? getSetting('dynamic-theme-color-source', 'cover')) === 'bg-enhanced') {
				setTimeout(updateDynamicColorFromBuiltInBG, 200);
			}
		} else {
			img.addEventListener('load', () => {
				if (img.src === lastCoverSrc) return;
				lastCoverSrc = img.src;
				updateDynamicColorFromCover(img);
				if ((window.mdDynamicThemeColorSource ?? getSetting('dynamic-theme-color-source', 'cover')) === 'bg-enhanced') {
					setTimeout(updateDynamicColorFromBuiltInBG, 200);
				}
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

// ---------------------------------------------------------------- 设置入口挂载 (遵循铁律: 绝不物理搬移任何 React 管理的原生 DOM 节点)
	const injectSettingsEntry = () => {
		waitForElement('#page_pc_main_nav', (nav) => {
			const container = document.createElement('div');
			container.id = 'md-settings-menu-container';
			container.className = 'md-settings-menu-container';
			container.addEventListener('dblclick', (e) => e.stopPropagation());
			container.addEventListener('mousedown', (e) => e.stopPropagation());

			// React/ReactDOM 由客户端 vendor 挂载,需等待就绪
			const waitReactDOM = setInterval(() => {
				if (window.ReactDOM && window.React) {
					clearInterval(waitReactDOM);
					initSettingMenu();
				}
			}, 200);

			try {
				const getAnchor = () => nav.querySelector('[class*="IconBar_"]') ?? nav;

				let attachTimer = null;
				const attachContainer = () => {
					const anchor = getAnchor();
					const winBar = anchor.querySelector('[class*="WindowOpBarContainer_"]');
					const divider = anchor.querySelector('[class*="Divider_"]') || winBar;

					// 仅将自建的调色盘 container 安全插入到分隔线或窗口控制之前，绝不搬动任何原生已有节点
					if (container.parentElement !== anchor || (divider && container.nextElementSibling !== divider && divider.parentElement === anchor)) {
						anchor.insertBefore(container, divider && divider.parentElement === anchor ? divider : null);
					}

					// 精准隐藏换肤外层 BadgeWrapper 的 Flex 占位 (仅改内联样式，绝对不搬动节点)
					const skinIcon = nav.querySelector('.cmd-icon-skin');
					if (skinIcon) {
						const skinBadge = skinIcon.closest('[class*="BadgeWrapper"]') ?? skinIcon;
						skinBadge.style.setProperty('display', 'none', 'important');
					}
				};

				attachContainer();
				new MutationObserver(() => {
					clearTimeout(attachTimer);
					attachTimer = setTimeout(attachContainer, 50);
				}).observe(nav, { childList: true });
			} catch (e) {
				console.error('MD3 nav decorations', e);
			}
		});
	};

			// ---------------------------------------------------------------- 顶栏图标重绘 (全部统一定制 Material Symbols，加粗 20%)
			const CUSTOM_NAV_SVGS = {
				setting: `<svg width="20" height="20" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m388-80-20-126q-19-7-40-19t-37-25l-118 54-93-164 108-79q-2-9-2.5-20.5T185-480q0-9 .5-20.5T188-521L80-600l93-164 118 54q16-13 37-25t40-18l20-127h184l20 126q19 7 40.5 18.5T669-710l118-54 93 164-108 77q2 10 2.5 21.5t.5 21.5q0 10-.5 21t-2.5 21l108 78-93 164-118-54q-16 13-36.5 25.5T592-206L572-80H388Zm48-60h88l14-112q33-8 62.5-25t53.5-41l106 46 40-72-94-69q4-17 6.5-33.5T715-480q0-17-2-33.5t-7-33.5l94-69-40-72-106 46q-23-26-52-43.5T538-708l-14-112h-88l-14 112q-34 7-63.5 24T306-642l-106-46-40 72 94 69q-4 17-6.5 33.5T245-480q0 17 2.5 33.5T254-413l-94 69 40 72 106-46q24 24 53.5 41t62.5 25l14 112Zm44-210q54 0 92-38t38-92q0-54-38-92t-92-38q-54 0-92 38t-38 92q0 54 38 92t92 38Zm0-130Z" fill="currentColor"></path></svg>`,
				message: `<svg width="20" height="20" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M140-160q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H140Zm340-302L140-685v465h680v-465L480-462Zm0-60 336-218H145l335 218ZM140-685v-55 520-465Z" fill="currentColor"></path></svg>`,
				// 最小化: 用户指定居中横线 + 20% 加粗(stroke-width=24)
				minimize: `<svg width="20" height="20" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M200-450v-60h560v60H200Z" fill="currentColor" stroke="currentColor" stroke-width="24" stroke-linejoin="round"></path></svg>`,
				// 还原: 双层圆角框 + 20% 加粗(stroke-width=24)
				restore: `<svg width="20" height="20" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M373-253q-93-93-93-227t93-227q93-93 227-93t227 93q93 93 93 227t-93 227q-93 93-227 93t-227-93Zm-79 81q-113-14-183.5-103.5T40-480q0-115 70.5-204.5T294-788v58q-88 16-141 87.5T100-480q0 91 53 162.5T294-230v58Zm306-308Zm183.5 183.5Q860-373 860-480t-76.5-183.5Q707-740 600-740t-183.5 76.5Q340-587 340-480t76.5 183.5Q493-220 600-220t183.5-76.5Z" fill="currentColor" stroke="currentColor" stroke-width="24" stroke-linejoin="round"></path></svg>`,
				// 最大化: 正圆线框 + 20% 加粗(stroke-width=24)
				maximize: `<svg width="20" height="20" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Zm0-340Z" fill="currentColor" stroke="currentColor" stroke-width="24" stroke-linejoin="round"></path></svg>`,
				// 关闭: 交叉细线 + 20% 加粗(stroke-width 从 80 提升至 100)
				close: `<svg width="20" height="20" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M 200 -200 L 760 -760 M 200 -760 L 760 -200" stroke="currentColor" stroke-width="100" stroke-linecap="round"/></svg>`,
				// 搜索放大镜 (用户指定 Material Symbols search, 适度加粗以匹配顶栏)
				search: `<svg width="18" height="18" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M796-121 533-384q-30 26-70 40.5T378-329q-108 0-183-75t-75-181q0-106 75-181t182-75q106 0 180.5 75T632-585q0 43-14 83t-42 75l264 262-44 44ZM377-389q81 0 138-57.5T572-585q0-81-57-138.5T377-781q-82 0-139.5 57.5T180-585q0 81 57.5 138.5T377-389Z" fill="currentColor" stroke="currentColor" stroke-width="20" stroke-linejoin="round"></path></svg>`,
				// 返回箭头 (用户指定 Material Symbols arrow_back, 适度加粗)
				back: `<svg width="18" height="18" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M400-240 160-480l241-241 43 42-169 169h526v60H275l168 168-43 42Z" fill="currentColor" stroke="currentColor" stroke-width="20" stroke-linejoin="round"></path></svg>`,
				// 听歌识曲 (用户指定 Material Symbols mic, 适度加粗)
				mic: `<svg width="20" height="20" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M408-453.92q-29-30.91-29-75.08v-251q0-41.67 29.44-70.83Q437.88-880 479.94-880t71.56 29.17Q581-821.67 581-780v251q0 44.17-29 75.08Q523-423 480-423t-72-30.92ZM480-651Zm-30 531v-136q-106-11-178-89t-72-184h60q0 91 64.29 153t155.5 62q91.21 0 155.71-62Q700-438 700-529h60q0 106-72 184t-178 89v136h-60Zm59.5-376.5Q521-510 521-529v-251q0-17-11.79-28.5T480-820q-17.42 0-29.21 11.5T439-780v251q0 19 11.5 32.5T480-483q18 0 29.5-13.5Z" fill="currentColor" stroke="currentColor" stroke-width="16" stroke-linejoin="round"></path></svg>`
			};

		const replaceIconSvg = (container, svgHtml, key) => {
			if (!container) return;
			if (container.getAttribute('data-custom-icon') === key) return;
			container.setAttribute('data-custom-icon', key);
			container.innerHTML = svgHtml;
		};

		const setupHeaderIconsWatcher = () => {
			const applyIcons = () => {
				const nav = document.querySelector('#page_pc_main_nav');
				if (!nav) return;

				// 1. 设置 (排除 BetterNCM)
				const settingIcon = nav.querySelector('[data-testid="tid_header_setting_btn"] .cmd-icon, .cmd-icon-setting:not([title="BetterNCM"])');
				replaceIconSvg(settingIcon, CUSTOM_NAV_SVGS.setting, 'setting');

				// 2. 消息
				const msgIcon = nav.querySelector('[data-testid="tid_header_msg_btn"] .cmd-icon, .cmd-icon-message');
				replaceIconSvg(msgIcon, CUSTOM_NAV_SVGS.message, 'message');

				// 3. 最小化
				const minIcon = nav.querySelector('[title="最小化"] .cmd-icon, .cmd-icon-minimize');
				replaceIconSvg(minIcon, CUSTOM_NAV_SVGS.minimize, 'minimize');

				// 4. 还原
				const restoreIcon = nav.querySelector('[title="向下还原"] .cmd-icon, .cmd-icon-restore');
				replaceIconSvg(restoreIcon, CUSTOM_NAV_SVGS.restore, 'restore');

				// 5. 最大化
				const maxIcon = nav.querySelector('[title="最大化"] .cmd-icon, .cmd-icon-maximize');
				replaceIconSvg(maxIcon, CUSTOM_NAV_SVGS.maximize, 'maximize');

				// 6. 关闭
				const closeIcon = nav.querySelector('[title="关闭"] .cmd-icon, .cmd-icon-close');
				replaceIconSvg(closeIcon, CUSTOM_NAV_SVGS.close, 'close');

				// 7. 返回箭头
				const backIcon = nav.querySelector('[data-testid="tid_header_back_btn"]');
				replaceIconSvg(backIcon, CUSTOM_NAV_SVGS.back, 'back');

				// 8. 搜索框放大镜
				const searchBtn = nav.querySelector('[data-testid*="tid_searchbox_btn"] .cmd-button-content')
					|| nav.querySelector('.cmd-input-prefix .prefix-icon .cmd-button-content')
					|| nav.querySelector('.cmd-input-prefix .prefix-icon');
				replaceIconSvg(searchBtn, CUSTOM_NAV_SVGS.search, 'search');

				// 9. 听歌识曲
				const micBtn = nav.querySelector('[data-testid="tid_header_recognize_btn"]');
				replaceIconSvg(micBtn, CUSTOM_NAV_SVGS.mic, 'mic');

				// 10. 彻底隐藏删除 mini 模式按钮与相关占位
				nav.querySelectorAll('[title="mini模式"], [title="全屏纯享"], .cmd-icon-mini, [data-log*="btn_pc_main_nav_mini"]').forEach((el) => {
					const target = el.closest('button') ?? el.closest('.icon') ?? el;
					target.style.setProperty('display', 'none', 'important');
				});
			};

				let iconsTimer = null;
				const debouncedApplyIcons = () => {
					clearTimeout(iconsTimer);
					iconsTimer = setTimeout(applyIcons, 50);
				};
				applyIcons();
				new MutationObserver(debouncedApplyIcons).observe(document.body, { childList: true, subtree: true });
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
	setupSongplayWatcher(); // Q1: 播放页挂载/更新守卫
	setupHeaderIconsWatcher(); // 顶栏图标 Material Symbols 重绘
	probeAndWatchAppThemeMode();
	injectSettingsEntry();

	// 探针: 采集当前完整 DOM 树与播放条几何到日志
	setTimeout(() => {
		try {
			const dump = [];
			const walk = (el, d) => {
				if (!el || d > 8 || dump.length > 500) return;
				const r = el.getBoundingClientRect();
				dump.push(`${'  '.repeat(d)}${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}]`);
				for (const c of el.children) walk(c, d + 1);
			};
			walk(document.querySelector('#root') || document.body, 0);
			if (typeof fetch !== 'undefined' && typeof BETTERNCM_API_PATH !== 'undefined') {
				fetch(BETTERNCM_API_PATH + '/fs/write_file_text?path=md33recon-rootlayout.txt', {
					method: 'POST',
					headers: { 'BETTERNCM_API_KEY': BETTERNCM_API_KEY, 'Content-Type': 'text/plain' },
					body: dump.join('\n')
				}).catch(() => {});
			}
		} catch (e) {}
	}, 3000);
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
