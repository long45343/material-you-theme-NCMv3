const watchers = new Set();
let discoveryObserver = null;

const updateTargets = (watcher, recheck = false) => {
	const elements = Array.from(document.querySelectorAll(watcher.selector));
	if (!recheck && elements.length === watcher.elements.length && elements.every((el, i) => el === watcher.elements[i])) return;
	watcher.elements = elements;
	watcher.onChange(elements);
};

// 全局只发现容器的挂载/替换；属性和内容变化交给各容器自己的观察器。
export const watchDOMTargets = (selector, onChange) => {
	const watcher = { selector, onChange, elements: [] };
	watchers.add(watcher);
	onChange(watcher.elements = Array.from(document.querySelectorAll(selector)));

	if (!discoveryObserver) {
		discoveryObserver = new MutationObserver((records) => {
			for (const watcher of watchers) {
				const removed = watcher.elements.some((el) => !el.isConnected);
				const added = records.some((record) => Array.from(record.addedNodes).some((node) => (
					node.nodeType === 1 && (node.matches(watcher.selector) || node.querySelector(watcher.selector))
				)));
				if (removed || added) updateTargets(watcher, added);
			}
		});
		discoveryObserver.observe(document.body, { childList: true, subtree: true });
	}

	return () => {
		watchers.delete(watcher);
		if (watchers.size === 0) {
			discoveryObserver.disconnect();
			discoveryObserver = null;
		}
	};
};
