const assert = require('node:assert/strict');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const { root, Element, createEnvironment, loadModule, loadMain } = require('./helpers/runtime.cjs');
const path = require('node:path');

const mcuReady = import(pathToFileURL(path.join(root, 'node_modules/@material/material-color-utilities/index.js')).href);
const songplaySelector = '#page_pc_songplay, #vinyl-page-container, [class*="VinylPageContainer_"]';

function styleControllers(env) {
	return {
		token: env.head.children.find(el => el.id === 'md-token-override'),
		dynamic: env.head.children.find(el => el.tagName === 'STYLE' && !el.id),
	};
}

function scopedObserver(env, target, attribute) {
	return env.observers.find(observer => observer.targets.some(entry => (
		entry.target === target && (!attribute || entry.options.attributeFilter?.includes(attribute))
	)));
}

test('RGBA conversion preserves every channel and unsigned ARGB representation', () => {
	const env = createEnvironment();
	const { rgbaToArgb } = loadModule('src/color-utils.js', env);
	assert.deepEqual(Array.from(rgbaToArgb(new Uint8ClampedArray())), []);
	assert.deepEqual(Array.from(rgbaToArgb(new Uint8ClampedArray([
		0, 0, 0, 0, 255, 255, 255, 255, 1, 2, 3, 128, 255, 0, 127, 0,
	]))), [0, 0xffffffff, 0x80010203, 0x00ff007f]);
	const data = Uint8ClampedArray.from({ length: 48 * 48 * 4 }, (_, i) => (i * 73 + Math.floor(i / 7)) % 256);
	const expected = [];
	for (let i = 0; i < data.length; i += 4) {
		expected.push(((data[i + 3] << 24 >>> 0) | (data[i] << 16 >>> 0) | (data[i + 1] << 8 >>> 0) | data[i + 2]) >>> 0);
	}
	assert.deepEqual(Array.from(rgbaToArgb(data)), expected);
});

test('same source color uses the actual scheme and shares light/dark/auto family results', async () => {
	const { main, window } = loadMain(await mcuReady);
	window.mdCoverDominantColor = 0xff3e81d1;
	window.mdScheme = 'dynamic-default-light';
	const previous = main.getThemeCSSFromColor();
	window.mdScheme = 'dynamic-fidelity-light';
	const changed = main.getThemeCSSFromColor();
	assert.notStrictEqual(changed, previous);
	assert.deepEqual(changed, main.computeThemeCSSFromColor(window.mdCoverDominantColor, window.mdScheme));
	assert.notEqual(changed['--md-dynamic-light-primary'], previous['--md-dynamic-light-primary']);
	assert.strictEqual(changed, main.getThemeCSSFromColor('dynamic-fidelity-dark'));
	assert.strictEqual(changed, main.getThemeCSSFromColor('dynamic-fidelity-auto'));
	assert.strictEqual(changed, main.getThemeCSSFromColor('dynamic-fidelity'));
	window.mdScheme = 'dynamic-default-dark';
	assert.strictEqual(main.getThemeCSSFromColor(), previous);
});

test('custom black is a valid source color rather than the no-cover fallback', async () => {
	const { main, window } = loadMain(await mcuReady);
	window.mdDynamicThemeColorSource = 'custom';
	window.mdCostomDynamicThemeColor = [0, 0, 0];
	window.mdScheme = 'dynamic-neutral-light';
	assert.deepEqual(main.getThemeCSSFromColor(), main.computeThemeCSSFromColor(0, 'dynamic-neutral'));
});

test('theme cache keeps at most 40 entries and evicts the least recently used result', async () => {
	const { main, window } = loadMain(await mcuReady);
	window.mdScheme = 'dynamic-default-light';
	for (let i = 1; i <= 40; i++) {
		window.mdCoverDominantColor = 0xff000000 + i;
		main.getThemeCSSFromColor();
	}
	window.mdCoverDominantColor = 0xff000001;
	const hot = main.getThemeCSSFromColor();
	window.mdCoverDominantColor = 0xff000029;
	main.getThemeCSSFromColor();
	assert.equal(main.themeCSSCache.size, 40);
	assert.equal(main.themeCSSCache.has(`${0xff000002}|dynamic-default`), false);
	window.mdCoverDominantColor = 0xff000001;
	assert.strictEqual(main.getThemeCSSFromColor(), hot);
});

test('theme requests coalesce in one frame and repeated themes do not rewrite global styles', async () => {
	const env = loadMain(await mcuReady);
	env.window.mdCoverDominantColor = 0xff3e81d1;
	const controllers = styleControllers(env);
	env.main.applyScheme('dynamic-default-light');
	env.main.refreshTheme();
	env.main.refreshTheme();
	assert.equal(env.frames.size, 1);
	assert.equal(controllers.token.textWrites, 0);
	env.flushFrames();
	assert.equal(controllers.token.textWrites, 1);
	assert.equal(controllers.dynamic.textWrites, 1);
	const bodyWrites = env.body.style.writes.length;
	const nativeCalls = env.channelCalls.length;
	for (let i = 0; i < 5; i++) env.main.refreshTheme();
	assert.equal(env.frames.size, 1);
	env.flushFrames();
	assert.equal(controllers.token.textWrites, 1);
	assert.equal(controllers.dynamic.textWrites, 1);
	assert.equal(env.body.style.writes.length, bodyWrites);
	assert.equal(env.channelCalls.length, nativeCalls);
});

test('a same-color family switch updates the full token and accent path on the next frame', async () => {
	const env = loadMain(await mcuReady);
	env.window.mdCoverDominantColor = 0xff3e81d1;
	env.main.applyScheme('dynamic-default-light');
	env.flushFrames();
	const previousCSS = styleControllers(env).token.textContent;
	const previousAccent = env.body.style.getPropertyValue('--md-accent-color');
	env.main.applyScheme('dynamic-vibrant-dark');
	env.main.applyScheme('dynamic-fidelity-light');
	assert.equal(env.frames.size, 1);
	env.flushFrames();
	const expected = env.main.getThemeCSSFromColor('dynamic-fidelity-light')['--md-dynamic-light-primary'];
	assert.equal(env.body.style.getPropertyValue('--md-accent-color'), expected);
	assert.notEqual(expected, previousAccent);
	assert.notEqual(styleControllers(env).token.textContent, previousCSS);
	assert.equal(env.window.mdScheme, 'dynamic-fidelity-light');
	assert.equal(env.body.classList.contains('md-light'), true);
	assert.equal(env.body.classList.contains('md-dark'), false);
});

test('unchanged theme still supplies tokens to newly mounted songplay nodes', async () => {
	const env = loadMain(await mcuReady);
	env.main.applyScheme('light-blue');
	env.flushFrames();
	const tokenWrites = styleControllers(env).token.textWrites;
	const page = new Element();
	page.id = 'page_pc_songplay';
	env.selectorResults.set(songplaySelector, [page]);
	env.main.refreshTheme();
	env.flushFrames();
	assert.equal(page.style.writes.length, 24);
	assert.equal(styleControllers(env).token.textWrites, tokenWrites);
	const pageWrites = page.style.writes.length;
	env.main.refreshTheme();
	env.flushFrames();
	assert.equal(page.style.writes.length, pageWrites);
});

test('container discovery is shared, ignores unrelated insertions and rebinds replacements', () => {
	const env = createEnvironment();
	const { watchDOMTargets } = loadModule('src/dom-watchers.js', env);
	const changes = [];
	const stop = watchDOMTargets('#target', elements => changes.push(Array.from(elements)));
	const stopOther = watchDOMTargets('#other', () => {});
	assert.equal(env.observers.length, 1);
	const observer = env.observers[0];
	assert.deepEqual({ ...observer.targets[0].options }, { childList: true, subtree: true });
	assert.equal(changes.length, 1);
	env.queries.length = 0;
	observer.fire([{ addedNodes: [new Element()], removedNodes: [] }]);
	assert.equal(env.queries.length, 0);
	assert.equal(changes.length, 1);
	const first = new Element(); first.id = 'target';
	env.selectorResults.set('#target', [first]);
	observer.fire([{ addedNodes: [first], removedNodes: [] }]);
	assert.strictEqual(changes.at(-1)[0], first);
	const countBeforeMove = changes.length;
	observer.fire([{ addedNodes: [first], removedNodes: [first] }]);
	assert.equal(changes.length, countBeforeMove + 1);
	assert.strictEqual(changes.at(-1)[0], first);
	first.isConnected = false;
	const replacement = new Element(); replacement.id = 'target';
	env.selectorResults.set('#target', [replacement]);
	observer.fire([{ addedNodes: [replacement], removedNodes: [first] }]);
	assert.strictEqual(changes.at(-1)[0], replacement);
	replacement.isConnected = false;
	env.selectorResults.set('#target', []);
	observer.fire([{ addedNodes: [], removedNodes: [replacement] }]);
	assert.equal(changes.at(-1).length, 0);
	stop();
	assert.equal(observer.targets.length, 1);
	stopOther();
	assert.equal(observer.targets.length, 0);
});

test('songplay style watcher repairs all overridden tokens and stops writing once repaired', async () => {
	const env = loadMain(await mcuReady);
	const page = new Element(); page.id = 'page_pc_songplay';
	env.selectorResults.set(songplaySelector, [page]);
	env.main.applyScheme('light-blue');
	env.flushFrames();
	env.main.setupSongplayWatcher();
	const expectedBlack = page.style.getPropertyValue('--colorBlack8');
	const expectedWhite = page.style.getPropertyValue('--colorWhite12');
	const observer = scopedObserver(env, page, 'style');
	assert.ok(observer);
	assert.equal(observer.targets[0].options.subtree, undefined);
	page.style.setProperty('--colorBlack8', 'incorrect');
	page.style.setProperty('--colorWhite12', 'incorrect');
	observer.fire([{ type: 'attributes', target: page }]);
	observer.fire([{ type: 'attributes', target: page }]);
	assert.equal(Array.from(env.timers.values()).filter(timer => timer.delay === 50).length, 1);
	env.flushTimers(50);
	assert.equal(page.style.getPropertyValue('--colorBlack8'), expectedBlack);
	assert.equal(page.style.getPropertyValue('--colorWhite12'), expectedWhite);
	const writes = page.style.writes.length;
	observer.fire([{ type: 'attributes', target: page }]);
	env.flushTimers(50);
	assert.equal(page.style.writes.length, writes);
});

test('RNP keeps ownership while active and the latest native tokens recover on class removal', async () => {
	const env = loadMain(await mcuReady);
	const page = new Element(); page.id = 'page_pc_songplay';
	env.selectorResults.set(songplaySelector, [page]);
	env.body.classList.add('refined-now-playing');
	env.main.setupSongplayWatcher();
	env.main.applyScheme('light-blue');
	env.flushFrames();
	assert.equal(page.style.writes.length, 0);
	env.body.classList.remove('refined-now-playing');
	const observer = scopedObserver(env, env.body, 'class');
	observer.fire([{ type: 'attributes', target: env.body }]);
	env.flushTimers(50);
	assert.equal(page.style.writes.length, 24);
});

test('native appearance setting still applies when the global theme is unchanged', async () => {
	const env = loadMain(await mcuReady, { 'menu-coloring': false });
	env.main.applyScheme('light-blue');
	env.flushFrames();
	assert.equal(env.channelCalls.length, 0);
	const tokenWrites = styleControllers(env).token.textWrites;
	env.values.set('menu-coloring', true);
	env.main.refreshTheme();
	env.flushFrames();
	assert.equal(env.channelCalls.length, 1);
	assert.equal(env.channelCalls[0][0], 'app.loadSkinPackets');
	assert.equal(styleControllers(env).token.textWrites, tokenWrites);
	env.main.refreshTheme();
	env.flushFrames();
	assert.equal(env.channelCalls.length, 1);
});

test('RNP identified only by its view restores native tokens when removed', async () => {
	const env = loadMain(await mcuReady);
	const page = new Element(); page.id = 'page_pc_songplay';
	env.selectorResults.set(songplaySelector, [page]);
	env.main.applyScheme('light-blue');
	env.flushFrames();
	const expected = page.style.getPropertyValue('--colorWhite1');
	env.main.setupSongplayWatcher();
	const discovery = env.observers.find(observer => observer.targets.some(({ target, options }) => (
		target === env.body && options.childList && options.subtree
	)));
	const rnp = new Element(); rnp.id = 'rnp-view';
	env.body.appendChild(rnp);
	discovery.fire([{ addedNodes: [rnp], removedNodes: [] }]);
	page.style.setProperty('--colorWhite1', 'overridden');
	scopedObserver(env, page, 'style').fire([{ type: 'attributes', target: page }]);
	env.flushTimers(50);
	assert.equal(page.style.getPropertyValue('--colorWhite1'), 'overridden');
	env.body.children = env.body.children.filter(child => child !== rnp);
	rnp.isConnected = false;
	discovery.fire([{ addedNodes: [], removedNodes: [rnp] }]);
	env.flushTimers(50);
	assert.equal(page.style.getPropertyValue('--colorWhite1'), expected);
});

test('auto mode ignores unrelated html style changes but reacts to actual mode transitions', async () => {
	const env = loadMain(await mcuReady);
	env.html.setAttribute('style', '--colorBackground: rgba(250,250,250,1);');
	env.main.applyScheme('dynamic-default-dark');
	env.flushFrames();
	env.main.applyScheme('dynamic-default-auto');
	assert.equal(env.window.mdThemeType, 'light');
	env.flushFrames(); env.flushFrames();
	env.main.probeAndWatchAppThemeMode();
	const observer = scopedObserver(env, env.html, 'style');
	observer.fire([{ type: 'attributes', target: env.html }]);
	assert.equal(env.frames.size, 0);
	env.html.setAttribute('style', '--colorBackground: rgba(20,20,20,1); --irrelevant: 1;');
	observer.fire([{ type: 'attributes', target: env.html }]);
	assert.equal(env.window.mdThemeType, 'dark');
	assert.equal(env.frames.size, 1);
});

test('late disk cache cannot overwrite a newer cover color or a newly selected scheme', async () => {
	const env = loadMain(await mcuReady);
	env.window.mdScheme = 'dynamic-default-auto';
	env.context.BETTERNCM_API_PATH = 'http://example.invalid';
	env.context.BETTERNCM_API_KEY = 'test';
	let resolveRead;
	env.context.fetch = () => new Promise(resolve => { resolveRead = resolve; });
	const result = env.main.tryLoadThemeCache();
	env.window.mdCoverDominantColor = 0xff123456;
	resolveRead({ ok: true, text: async () => JSON.stringify({ color: 0xffabcdef }) });
	assert.equal(await result, false);
	assert.equal(env.window.mdCoverDominantColor, 0xff123456);
	const nextResult = env.main.tryLoadThemeCache();
	env.window.mdScheme = 'dark-blue';
	resolveRead({ ok: true, text: async () => JSON.stringify({ color: 0xffabcdef }) });
	assert.equal(await nextResult, false);
	assert.equal(env.window.mdCoverDominantColor, 0xff123456);
});

test('cover watcher observes image source changes only within cover containers', async () => {
	let samples = 0;
	const mcu = await mcuReady;
	const env = loadMain({
		...mcu,
		QuantizerCelebi: { quantize(pixels) { assert.equal(pixels.length, 2304); return new Map(); } },
		Score: { score: () => [0xff123456 + samples] },
	});
	env.window.mdScheme = 'dynamic-default-light';
	const coverRoot = new Element(); coverRoot.id = 'page_pc_mini_bar';
	const image = new Element('img');
	image.src = 'https://example.invalid/first.jpg'; image.complete = true; image.naturalWidth = 48;
	coverRoot.appendChild(image); env.body.appendChild(coverRoot);
	env.selectorResults.set('#page_pc_mini_bar img', [image]);
	const createElement = env.document.createElement;
	env.document.createElement = tag => tag === 'canvas' ? {
		getContext: () => ({ drawImage() {}, getImageData() { samples++; return { data: new Uint8ClampedArray(48 * 48 * 4) }; } }),
	} : createElement(tag);
	env.main.setupCoverWatcher();
	env.flushTimers(100);
	assert.equal(samples, 1);
	const observer = scopedObserver(env, coverRoot, 'src');
	assert.ok(observer);
	assert.equal(observer.targets[0].options.subtree, true);
	image.src = 'https://example.invalid/second.jpg';
	observer.fire([{ type: 'attributes', target: image, attributeName: 'src' }]);
	observer.fire([{ type: 'attributes', target: image, attributeName: 'src' }]);
	assert.equal(Array.from(env.timers.values()).filter(timer => timer.delay === 100).length, 1);
	env.flushTimers(100);
	assert.equal(samples, 2);
	assert.equal(env.window.mdCoverDominantColor, 0xff123458);
});

test('pending cover load listener is unique and detaches when the source element changes', async () => {
	const env = loadMain(await mcuReady);
	env.window.mdScheme = 'dynamic-default-light';
	const first = new Element('img');
	first.src = 'https://example.invalid/first.jpg'; first.complete = false; first.naturalWidth = 0;
	env.selectorResults.set('#page_pc_mini_bar img', [first]);
	env.main.scanCover(); env.main.scanCover(); env.main.scanCover();
	assert.equal(first.listeners.get('load').size, 1);
	const next = new Element('img');
	next.src = 'https://example.invalid/second.jpg'; next.complete = false; next.naturalWidth = 0;
	env.selectorResults.set('#page_pc_mini_bar img', [next]);
	env.main.scanCover();
	assert.equal(first.listeners.get('load').size, 0);
	assert.equal(next.listeners.get('load').size, 1);
	env.window.mdScheme = 'dark-blue';
	env.main.scanCover();
	assert.equal(next.listeners.get('load').size, 0);
});

test('header icon watcher is local to nav and reacts to reused icon classes', async () => {
	const env = loadMain(await mcuReady);
	const nav = new Element(); nav.id = 'page_pc_main_nav';
	const icon = new Element(); icon.classList.add('cmd-icon-minimize');
	nav.appendChild(icon); env.body.appendChild(nav);
	env.main.setupHeaderIconsWatcher();
	const observer = scopedObserver(env, nav, 'class');
	assert.ok(observer);
	assert.equal(icon.getAttribute('data-custom-icon'), 'minimize');
	assert.equal(observer.targets[0].options.subtree, true);
	icon.classList.remove('cmd-icon-minimize'); icon.classList.add('cmd-icon-maximize');
	observer.fire([{ type: 'attributes', target: icon }]);
	env.flushTimers(50);
	assert.equal(icon.getAttribute('data-custom-icon'), 'maximize');
	const settings = new Element(); settings.id = 'md-settings-menu-container';
	nav.appendChild(settings);
	observer.fire([{ type: 'childList', target: settings, addedNodes: [], removedNodes: [] }]);
	assert.equal(Array.from(env.timers.values()).filter(timer => timer.delay === 50).length, 0);
});
