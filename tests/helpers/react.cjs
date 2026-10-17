const { Element } = require('./runtime.cjs');

// 只模拟 hooks 状态和 effect 生命周期,不模拟 React DOM 提交或浏览器绘制。
function createReactHarness() {
	let active = null;
	const equalDeps = (previous, next) => previous && next && previous.length === next.length && previous.every((value, i) => Object.is(value, next[i]));
	const React = {
		Component: class {
			constructor(props) { this.props = props; this.state = {}; }
			setState(value, callback) { Object.assign(this.state, typeof value === 'function' ? value(this.state) : value); callback?.(); }
		},
		Fragment: Symbol('Fragment'),
		memo: (component, compare) => Object.assign(component, { compare }),
		createElement(type, props, ...children) {
			if (props?.ref && typeof type === 'string') props.ref.current = active.element;
			return { type, props: { ...props, children } };
		},
		useState(initial) {
			const instance = active;
			const index = instance.cursor++;
			if (!instance.slots[index]) instance.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
			return [instance.slots[index].value, value => {
				instance.stateUpdates++;
				const current = instance.slots[index].value;
				const next = typeof value === 'function' ? value(current) : value;
				if (!Object.is(current, next)) { instance.slots[index].value = next; instance.dirty = true; }
			}];
		},
		useRef(value) {
			const instance = active;
			const index = instance.cursor++;
			if (!instance.slots[index]) instance.slots[index] = { current: value };
			return instance.slots[index];
		},
		useEffect(effect, dependencies) {
			const instance = active;
			const index = instance.cursor++;
			const previous = instance.slots[index];
			if (!previous || !equalDeps(previous.dependencies, dependencies)) {
				instance.effects.push(() => {
					previous?.cleanup?.();
					instance.slots[index] = { dependencies, cleanup: effect() };
				});
			}
		},
		useMemo(factory, dependencies) {
			const instance = active;
			const index = instance.cursor++;
			const previous = instance.slots[index];
			if (!previous || !equalDeps(previous.dependencies, dependencies)) instance.slots[index] = { dependencies, value: factory() };
			return instance.slots[index].value;
		},
		useCallback(callback, dependencies) { return React.useMemo(() => callback, dependencies); },
	};
	function mount(component, initialProps) {
		const instance = {
			slots: [], effects: [], cursor: 0, stateUpdates: 0, dirty: false,
			element: new Element(), props: initialProps, tree: null,
			render(props = instance.props) {
				instance.props = props;
				for (let pass = 0; pass < 10; pass++) {
					instance.dirty = false; instance.cursor = 0; instance.effects = [];
					active = instance;
					instance.tree = component(props);
					active = null;
					for (const effect of instance.effects) effect();
					if (!instance.dirty) return instance.tree;
				}
				throw new Error('Hook test exceeded 10 renders');
			},
			unmount() { for (const slot of instance.slots) slot?.cleanup?.(); },
		};
		instance.render();
		return instance;
	}
	return { React, mount };
}

function findElement(tree, predicate) {
	if (!tree) return null;
	if (Array.isArray(tree)) {
		for (const child of tree) { const found = findElement(child, predicate); if (found) return found; }
		return null;
	}
	if (typeof tree !== 'object') return null;
	if (predicate(tree)) return tree;
	return findElement(tree.props?.children, predicate);
}

module.exports = { createReactHarness, findElement };
