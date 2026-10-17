const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '../..');

class Style {
	constructor() {
		this.values = new Map();
		this.writes = [];
	}
	get length() { return this.values.size; }
	getPropertyValue(name) { return this.values.get(name)?.value ?? ''; }
	getPropertyPriority(name) { return this.values.get(name)?.priority ?? ''; }
	setProperty(name, value, priority = '') {
		this.values.set(name, { value, priority });
		this.writes.push({ name, value, priority });
	}
	removeProperty(name) {
		const previous = this.getPropertyValue(name);
		this.values.delete(name);
		this.writes.push({ name, value: null });
		return previous;
	}
}

class Element extends EventTarget {
	constructor(tagName = 'div') {
		super();
		this.nodeType = 1;
		this.tagName = tagName.toUpperCase();
		this.id = '';
		this.className = '';
		this.style = new Style();
		this.children = [];
		this.attributes = new Map();
		this.isConnected = true;
		this.textWrites = 0;
		this._text = '';
		this.classes = new Set();
		this.listeners = new Map();
		this.classList = {
			contains: name => this.classes.has(name),
			add: (...names) => names.forEach(name => this.classes.add(name)),
			remove: (...names) => names.forEach(name => this.classes.delete(name)),
			toggle: (name, force) => {
				const present = force ?? !this.classes.has(name);
				if (present) this.classes.add(name); else this.classes.delete(name);
				return present;
			},
		};
	}
	get textContent() { return this._text; }
	set textContent(value) { this._text = value; this.textWrites++; }
	get innerHTML() { return this._text; }
	set innerHTML(value) { this._text = value; this.textWrites++; }
	appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
	getAttribute(name) { return this.attributes.get(name) ?? null; }
	setAttribute(name, value) { this.attributes.set(name, value); }
	getBoundingClientRect() { return { x: 0, y: 0, width: 100, height: 100 }; }
	matches(selector) {
		return selector.split(',').some(part => {
			part = part.trim();
			if (part.startsWith('#')) return this.id === part.slice(1);
			if (part.startsWith('.')) return this.classes.has(part.slice(1));
			const attribute = part.match(/^\[class\*="([^"]+)"\]$/);
			if (attribute) return this.className.includes(attribute[1]);
			return this.tagName.toLowerCase() === part;
		});
	}
	querySelectorAll(selector) {
		const elements = [];
		for (const child of this.children) {
			if (child.matches(selector)) elements.push(child);
			elements.push(...child.querySelectorAll(selector));
		}
		return elements;
	}
	querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
	closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
	addEventListener(type, listener, options) {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type).add(listener);
		super.addEventListener(type, listener, options);
	}
	removeEventListener(type, listener, options) {
		this.listeners.get(type)?.delete(listener);
		super.removeEventListener(type, listener, options);
	}
}

function createEnvironment(settings = {}) {
	const observers = [];
	class Observer {
		constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
		observe(target, options) { this.targets.push({ target, options }); }
		disconnect() { this.targets = []; }
		fire(records) { this.callback(records, this); }
	}
	const body = new Element('body');
	const head = new Element('head');
	const html = new Element('html');
	const selectorResults = new Map();
	const queries = [];
	const document = new EventTarget();
	Object.assign(document, {
		body, head, documentElement: html, readyState: 'loading',
		createElement: tag => new Element(tag),
		querySelectorAll(selector) {
			queries.push(selector);
			if (selectorResults.has(selector)) return selectorResults.get(selector);
			return [...body.querySelectorAll(selector), ...head.querySelectorAll(selector)];
		},
		querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
		getElementById(id) { return this.querySelector('#' + id); },
	});
	const frames = new Map();
	const timers = new Map();
	let sequence = 0;
	const storage = new Map();
	const media = new EventTarget();
	media.matches = false;
	const window = new EventTarget();
	window.loadedPlugins = {};
	window.matchMedia = () => media;
	const channelCalls = [];
	window.channel = { call: (...args) => channelCalls.push(args) };
	const context = vm.createContext({
		window, document, MutationObserver: Observer, Event, CustomEvent, EventTarget,
		console, performance, Uint8ClampedArray, setTimeout: (fn, delay) => {
			const id = ++sequence;
			timers.set(id, { fn, delay });
			return id;
		},
		clearTimeout: id => timers.delete(id),
		setInterval: () => ++sequence, clearInterval() {},
		requestAnimationFrame: fn => { const id = ++sequence; frames.set(id, fn); return id; },
		cancelAnimationFrame: id => frames.delete(id),
		localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
		loadedPlugins: window.loadedPlugins, channel: window.channel,
	});
	const values = new Map(Object.entries(settings));
	return {
		context, window, document, body, head, html, media, observers, frames, timers,
		selectorResults, queries, channelCalls, values,
		utils: {
			getSetting: (key, fallback = '') => values.has(key) ? values.get(key) : fallback,
			setSetting: (key, value) => values.set(key, value),
			loadSettingsFromDisk: async () => false,
			waitForElement() {},
		},
		flushFrames() {
			const pending = Array.from(frames.values()); frames.clear();
			for (const callback of pending) callback(performance.now());
		},
		flushTimers(delay) {
			const pending = Array.from(timers.entries()).filter(([, timer]) => delay === undefined || timer.delay === delay);
			for (const [id, timer] of pending) { timers.delete(id); timer.fn(); }
		},
	};
}

function loadModule(file, env, dependencies = {}, exposed = []) {
	let source = fs.readFileSync(path.join(root, file), 'utf8');
	if (exposed.length) source += '\nexport { ' + exposed.join(', ') + ' };';
	const code = babel.transformSync(source, {
		filename: path.join(root, file), babelrc: false, configFile: false,
		presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-react'],
	}).code;
	const module = { exports: {} };
	const requireMock = name => {
		if (/\.s?css$/.test(name)) return {};
		if (Object.hasOwn(dependencies, name)) return dependencies[name];
		throw new Error('Unexpected dependency: ' + name);
	};
	const execute = vm.runInContext('(function(require, module, exports) {\n' + code + '\n})', env.context, { filename: file });
	execute(requireMock, module, module.exports);
	return module.exports;
}

function loadMain(mcu, settings) {
	const env = createEnvironment(settings);
	const colors = loadModule('src/color-utils.js', env);
	const tokens = loadModule('src/theme-tokens.js', env);
	const presets = loadModule('src/scheme-presets.js', env);
	const watchers = loadModule('src/dom-watchers.js', env);
	const main = loadModule('src/main.js', env, {
		'./utils.js': env.utils, './color-utils.js': colors, './theme-tokens.js': tokens,
		'./scheme-presets.js': presets, './dom-watchers.js': watchers,
		'./settings.js': { initSettingMenu() {} }, './ripple.js': { setupRipple() {} },
		'@material/material-color-utilities': mcu,
	}, [
		'computeThemeCSSFromColor', 'themeCSSCache', 'setupCoverWatcher', 'setupSongplayWatcher',
		'setupAPBWatcher', 'setupHeaderIconsWatcher', 'probeAndWatchAppThemeMode',
		'applySongplayInlineTokens', 'tryLoadThemeCache', 'scanCover',
	]);
	return Object.assign(env, { main, colors, tokens, presets, watchers });
}

module.exports = { root, Style, Element, createEnvironment, loadModule, loadMain };
