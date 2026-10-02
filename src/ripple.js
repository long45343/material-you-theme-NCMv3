// ripple.js — MD3 涟漪特效 (state layer)
// 全局事件委托(pointerdown 捕获):在按下点生成圆形涟漪向四周扩散,松开后淡出移除。
// 涟漪取按钮文字色 currentColor —— 与 MD3 state layer 规范一致(onSurface/onPrimary 覆层),
// 实心主按钮上呈现白色涟漪、普通按钮上呈现深色涟漪,无需逐按钮配色。

// 涟漪目标:原生按钮 + 网易云自绘的可点击行(类名依据 maintab.scss / pages.scss 的 recon 结果)
// 1) 左侧栏胶囊导航/资料库项: [class*="ItemContainer_"],排除分组容器 NavItemContainer_
// 2) 左侧栏歌单行: PlayListItemContent_ 内的 .background 胶囊(外层无圆角,内层才是胶囊)
// 3) 歌曲表格行: .tbody .tr (歌单详情/搜索/我的音乐等所有列表)
const RIPPLE_SELECTOR = [
	'button',
	'[role="button"]',
	'.cmd-button',
	'.md-scheme-preview',
	'#page_pc_main_tab [class*="ItemContainer_"]:not([class*="NavItemContainer_"])',
	'#page_pc_main_tab [class*="PlayListItemContent_"] .background',
	'#page_pc_main_tab [class*="PlayListItemContent_"]',
	'.tbody .tr',
].join(', ');
const MAX_RIPPLES = 4;              // 单按钮同时存在的涟漪上限(超出移除最旧)
const ENTER_MS = 500;               // 扩散时长
const EXIT_MS = 200;                // 淡出时长
const ENTER_EASING = 'cubic-bezier(0.2, 0, 0, 1)'; // MD3 emphasized
const RIPPLE_OPACITY = 0.14;        // MD3 state layer 覆层不透明度
const HOLD_TIMEOUT_MS = 3000;       // 按住不松的兜底回收(防止 pointerup 丢失造成泄漏)

const activeRipples = new Set();    // 已生成且未淡出的涟漪
const pressedRipples = new Map();   // pointerId -> 涟漪
let keyRipple = null;               // 键盘激活产生的涟漪

const isEnabled = () => {
	const b = document.body;
	return Boolean(b) && b.classList.contains('material-you-theme') && b.classList.contains('md-ripple-enabled');
};

const MAX_FALLBACK_DEPTH = 10;    // 兜底向上探测层级
const FALLBACK_AREA_RATIO = 0.6;  // 兜底元素面积上限(占视口比例),避免整页容器误判

// 选择器未命中时的兜底:取最近的 cursor:pointer 祖先链顶端。
// cursor 会继承,故子元素(文字 span 等)同样报 pointer —— 需沿链上溯到真正的可点击容器,
// 才能让涟漪覆盖整个可点击区域而非一行文字;链条在首个非 pointer 祖先处结束。
const findPointerAncestor = (t) => {
	let el = t;
	let found = null;
	for (let i = 0; i < MAX_FALLBACK_DEPTH && el && el !== document.body && el !== document.documentElement; i++) {
		if (getComputedStyle(el).cursor !== 'pointer') break;
		const r = el.getBoundingClientRect();
		// 面积超限(整页容器)时停在上一个合法元素,链条起点即超限则放弃兜底
		if (r.width <= 0 || r.height <= 0 || r.width * r.height > innerWidth * innerHeight * FALLBACK_AREA_RATIO) break;
		found = el;
		el = el.parentElement;
	}
	return found;
};

const findTarget = (e) => {
	const t = e.target;
	if (!t || typeof t.closest !== 'function') return null;
	let el = t.closest(RIPPLE_SELECTOR);
	if (!el) el = findPointerAncestor(t);
	if (!el || !el.isConnected) return null;
	if (el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
	if (el.closest('[data-md-no-ripple]')) return null;
	return el;
};

// 保证宿主元素可作为绝对定位裁剪容器:静态定位→relative。
// 涟漪层覆在内容之上(与 MDC web 一致),因背景取 currentColor,
// 文字本体不产生视觉变化,仅周围出现 MD3 state layer 覆层。
const prepareTarget = (el) => {
	if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
};

const ensureHost = (el) => {
	let host = el.__mdRippleHost;
	if (!host || !host.isConnected || host.parentElement !== el) {
		host = document.createElement('span');
		host.className = 'md-ripple-host';
		el.appendChild(host);
		el.__mdRippleHost = host;
	}
	return host;
};

const releaseRipple = (ripple) => {
	if (!ripple || !activeRipples.has(ripple)) return;
	activeRipples.delete(ripple);
	try {
		ripple.animate(
			[{ opacity: RIPPLE_OPACITY }, { opacity: 0 }],
			{ duration: EXIT_MS, easing: 'linear', fill: 'forwards' }
		);
	} catch (e) { /* 动画不可用时直接移除 */ }
	setTimeout(() => ripple.remove(), EXIT_MS + 60);
};

const spawnRipple = (el, x, y) => {
	prepareTarget(el);
	const host = ensureHost(el);

	const rect = el.getBoundingClientRect();
	// MD3:涟漪直径 = 到最远角距离的 2 倍,保证松开前覆盖整个按钮
	const dx = Math.max(x - rect.left, rect.right - x);
	const dy = Math.max(y - rect.top, rect.bottom - y);
	const size = Math.ceil(2 * Math.hypot(dx, dy));

	const ripple = document.createElement('span');
	ripple.className = 'md-ripple';
	ripple.style.width = size + 'px';
	ripple.style.height = size + 'px';
	ripple.style.left = Math.round(x - rect.left - size / 2) + 'px';
	ripple.style.top = Math.round(y - rect.top - size / 2) + 'px';
	host.appendChild(ripple);

	while (host.childElementCount > MAX_RIPPLES) {
		const old = host.firstElementChild;
		activeRipples.delete(old);
		old.remove();
	}

	activeRipples.add(ripple);
	try {
		ripple.animate(
			[{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
			{ duration: ENTER_MS, easing: ENTER_EASING, fill: 'forwards' }
		);
	} catch (e) { /* 动画不可用时保留静态涟漪 */ }

	setTimeout(() => releaseRipple(ripple), HOLD_TIMEOUT_MS);
	return ripple;
};

export const setupRipple = () => {
	window.addEventListener('pointerdown', (e) => {
		if (!isEnabled() || e.button !== 0) return;
		const el = findTarget(e);
		if (!el) return;
		pressedRipples.set(e.pointerId, spawnRipple(el, e.clientX, e.clientY));
	}, true);

	const endPress = (e) => {
		const ripple = pressedRipples.get(e.pointerId);
		if (ripple === undefined) return;
		pressedRipples.delete(e.pointerId);
		releaseRipple(ripple);
	};
	window.addEventListener('pointerup', endPress, true);
	window.addEventListener('pointercancel', endPress, true);
	window.addEventListener('blur', () => {
		pressedRipples.forEach((ripple) => releaseRipple(ripple));
		pressedRipples.clear();
		if (keyRipple) {
			releaseRipple(keyRipple);
			keyRipple = null;
		}
	});

	// 键盘激活(Enter/空格)也应有涟漪:以按钮中心为源
	document.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
		if (keyRipple || !isEnabled()) return;
		const el = findTarget(e);
		if (!el) return;
		const r = el.getBoundingClientRect();
		keyRipple = spawnRipple(el, r.left + r.width / 2, r.top + r.height / 2);
	});
	document.addEventListener('keyup', () => {
		if (!keyRipple) return;
		releaseRipple(keyRipple);
		keyRipple = null;
	});
};
