const assert = require('node:assert/strict');
const test = require('node:test');
const { createEnvironment, loadModule } = require('./helpers/runtime.cjs');
const { createReactHarness, findElement } = require('./helpers/react.cjs');

function loadSettings() {
	const env = createEnvironment();
	const harness = createReactHarness();
	env.context.React = harness.React;
	env.context.ReactDOM = { render() {} };
	const calculations = [];
	let refreshes = 0;
	let version = 0;
	const cache = new Map();
	const settings = loadModule('src/settings.js', env, {
		'./utils': env.utils,
		'./scheme-presets': { schemePresets: {} },
		'./main': {
			applyScheme() {},
			refreshTheme: () => refreshes++,
			getThemeCSSFromColor: name => {
				calculations.push(name);
				const key = `${version}|${name}`;
				if (!cache.has(key)) cache.set(key, { '--test-color': String(version), '--family': name });
				return cache.get(key);
			},
		},
	}, ['MDSettings', 'DynamicSchemeSet', 'SchemeItem', 'CustomDynamicThemeSetting']);
	return Object.assign(env, harness, {
		settings, calculations, get refreshes() { return refreshes; },
		advanceColor: () => version++,
		getRefreshes: () => refreshes,
	});
}

const families = ['default', 'tonal-spot', 'vibrant', 'expressive', 'fidelity', 'neutral'];

test('closed settings propagate preview gating to all six dynamic families', () => {
	const env = loadSettings();
	const instance = new env.settings.MDSettings({ list: [] });
	const tree = instance.render();
	for (const name of families) {
		const family = findElement(tree, element => element.type === env.settings.DynamicSchemeSet && element.props.name === name);
		assert.ok(family);
		assert.equal(family.props.open, false);
	}
});

test('six preview families do no work while closed, resync on reopen and clean up listeners', () => {
	const env = loadSettings();
	const setScheme = () => {};
	const instances = families.map(name => env.mount(env.settings.DynamicSchemeSet, {
		name, open: false, activeScheme: 'dynamic-default-light', setScheme,
	}));
	assert.equal(env.calculations.length, 0);
	assert.equal(env.body.listeners.get('md-dominant-color-change')?.size ?? 0, 0);
	env.body.dispatchEvent(new CustomEvent('md-dominant-color-change'));
	assert.equal(env.calculations.length, 0);
	for (const instance of instances) instance.render({ ...instance.props, open: true });
	assert.equal(env.calculations.length, 6);
	assert.equal(env.body.listeners.get('md-dominant-color-change').size, 6);
	const updates = instances.reduce((sum, instance) => sum + instance.stateUpdates, 0);
	env.body.dispatchEvent(new CustomEvent('md-dominant-color-change'));
	assert.equal(env.calculations.length, 12);
	assert.equal(instances.reduce((sum, instance) => sum + instance.stateUpdates, 0), updates);
	env.advanceColor();
	env.body.dispatchEvent(new CustomEvent('md-dominant-color-change'));
	assert.equal(instances.reduce((sum, instance) => sum + instance.stateUpdates, 0), updates + 6);
	for (const instance of instances) instance.render({ ...instance.props, open: false });
	assert.equal(env.body.listeners.get('md-dominant-color-change').size, 0);
	const calculations = env.calculations.length;
	env.advanceColor();
	env.body.dispatchEvent(new CustomEvent('md-dominant-color-change'));
	assert.equal(env.calculations.length, calculations);
	for (const instance of instances) instance.render({ ...instance.props, open: true });
	assert.equal(env.calculations.length, calculations + 6);
	for (const instance of instances) {
		assert.equal(instance.tree.props.children[0].props.open, true);
		assert.equal(instance.tree.props.children[0].props.cssVariablesOverride['--test-color'], '2');
		instance.unmount();
	}
	assert.equal(env.body.listeners.get('md-dominant-color-change').size, 0);
});

test('memo comparison includes panel state for both dynamic families and items', () => {
	const { settings } = loadSettings();
	const previous = {
		name: 'default', open: false, activeScheme: 'dynamic-default-light', setScheme() {},
		scheme: { name: 'dynamic-default-light', palette: {} },
	};
	assert.equal(settings.DynamicSchemeSet.compare(previous, { ...previous, open: true }), false);
	assert.equal(settings.SchemeItem.compare(previous, { ...previous, open: true }), false);
	assert.equal(settings.DynamicSchemeSet.compare(previous, { ...previous }), true);
});

test('preview variables are gated, diffed and removed using a stable key snapshot', () => {
	const env = loadSettings();
	const props = {
		open: false, dynamic: true, scheme: { name: 'dynamic-default-light', palette: {} },
		setScheme() {}, cssVariablesOverride: { '--first': 'a', '--second': 'b', '--third': 'c' },
	};
	const instance = env.mount(env.settings.SchemeItem, props);
	const style = instance.element.style;
	assert.equal(style.writes.length, 0);
	style.setProperty('--unrelated', 'keep');
	instance.render({ ...props, open: true });
	assert.equal(style.writes.length, 4);
	instance.render({ ...props, open: true, cssVariablesOverride: { ...props.cssVariablesOverride } });
	assert.equal(style.writes.length, 4);
	instance.render({ ...props, open: true, cssVariablesOverride: { '--third': 'changed' } });
	assert.equal(style.getPropertyValue('--first'), '');
	assert.equal(style.getPropertyValue('--second'), '');
	assert.equal(style.getPropertyValue('--third'), 'changed');
	assert.equal(style.getPropertyValue('--unrelated'), 'keep');
	const writes = style.writes.length;
	instance.render({ ...props, open: false, cssVariablesOverride: { '--third': 'newer' } });
	assert.equal(style.writes.length, writes);
	assert.equal(style.getPropertyValue('--third'), 'changed');
	instance.render({ ...props, open: true, cssVariablesOverride: { '--third': 'newer' } });
	assert.equal(style.getPropertyValue('--third'), 'newer');
	instance.render({ ...props, open: true, cssVariablesOverride: undefined });
	assert.equal(style.getPropertyValue('--third'), '');
	assert.equal(style.getPropertyValue('--unrelated'), 'keep');
});

test('source and mutable custom RGB edits run the full refresh path without redundant updates', () => {
	const env = loadSettings();
	let notifications = 0;
	env.body.addEventListener('md-dominant-color-change', () => notifications++);
	const instance = env.mount(env.settings.CustomDynamicThemeSetting, { show: true });
	assert.equal(env.window.mdDynamicThemeColorSource, 'cover');
	assert.equal(env.getRefreshes(), 1);
	assert.equal(notifications, 1);
	let select = findElement(instance.tree, element => element.type === 'select');
	select.props.onChange({ target: { value: 'cover' } });
	assert.equal(instance.stateUpdates, 0);
	select.props.onChange({ target: { value: 'custom' } });
	instance.render();
	assert.equal(env.window.mdDynamicThemeColorSource, 'custom');
	assert.equal(env.getRefreshes(), 2);
	assert.equal(notifications, 2);
	const field = findElement(instance.tree, element => element.props?.label === '自定义颜色');
	assert.ok(field);
	const color = field.props.color;
	color[0] = 120;
	field.props.setColor(color);
	instance.render();
	assert.deepEqual(Array.from(env.window.mdCostomDynamicThemeColor), [120, 230, 251]);
	assert.equal(env.getRefreshes(), 3);
	assert.equal(notifications, 3);
	const updates = instance.stateUpdates;
	field.props.setColor([120, 230, 251]);
	assert.equal(env.getRefreshes(), 3);
	assert.equal(instance.stateUpdates, updates);
	assert.equal(env.values.get('custom-dynamic-theme-color'), '[120,230,251]');
});
