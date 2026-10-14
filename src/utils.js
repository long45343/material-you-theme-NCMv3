export const injectHTML = (type, html, parent, fun = (dom) => {}) => {
	const dom = document.createElement(type);
	dom.innerHTML = html;
	fun.call(this, dom);

	parent.appendChild(dom);
	return dom;
}
export const waitForElement = (selector, fun) => {
	selector = selector.split(',');
	let done = true;
	for (const s of selector) {
		if (!document.querySelector(s)) {
			done = false;
		}
	}
	if (done) {
		for (const s of selector) {
			fun.call(this, document.querySelector(s));
		}
		return;
	}
	let interval = setInterval(() => {
		let done = true;
		for (const s of selector) {
			if (!document.querySelector(s)) {
				done = false;
			}
		}
		if (done) {
			clearInterval(interval);
			for (const s of selector) {
				fun.call(this, document.querySelector(s));
			}
		}
	}, 100);
}
export const waitForElementAsync = async (selector) => {
	if (document.querySelector(selector)) {
		return document.querySelector(selector);
	}
	return await betterncm.utils.waitForElement(selector);
}
const cachedConfig = {};
let saveConfigTimer = null;

// 从磁盘读取完整配置 (material-you-theme-config.json) 水合到内存与 localStorage
export const loadSettingsFromDisk = async () => {
	if (typeof fetch === 'undefined' || typeof BETTERNCM_API_PATH === 'undefined') return false;
	try {
		const res = await fetch(BETTERNCM_API_PATH + '/fs/read_file_text?path=' + encodeURIComponent('material-you-theme-config.json'), {
			headers: { 'BETTERNCM_API_KEY': BETTERNCM_API_KEY }
		});
		if (res.ok) {
			const text = await res.text();
			if (text) {
				const data = JSON.parse(text);
				if (data && typeof data === 'object') {
					for (const [k, v] of Object.entries(data)) {
						cachedConfig[k] = v;
						try {
							localStorage.setItem('material-you-theme-' + k, typeof v === 'object' ? JSON.stringify(v) : String(v));
						} catch (e) {}
					}
					return true;
				}
			}
		} else {
			// 首次运行或磁盘配置文件尚不存在: 扫描已有的 localStorage 项导入并写入一份初始配置文件
			const keys = [
				'scheme', 'custom-scheme', 'dynamic-theme-color-source', 'custom-dynamic-theme-color',
				'ignore-now-playing-page', 'disable-comment-style', 'hide-ncm-logo', 'hide-ncm-title',
				'ripple-effect', 'menu-coloring'
			];
			let foundAny = false;
			for (const k of keys) {
				try {
					const val = localStorage.getItem('material-you-theme-' + k);
					if (val !== null) {
						foundAny = true;
						try {
							cachedConfig[k] = JSON.parse(val);
						} catch (e) {
							cachedConfig[k] = val;
						}
					}
				} catch (e) {}
			}
			if (foundAny) {
				saveConfigToDisk();
			}
		}
	} catch (e) {}
	return false;
};

const saveConfigToDisk = () => {
	if (typeof fetch === 'undefined' || typeof BETTERNCM_API_PATH === 'undefined') return;
	try {
		fetch(BETTERNCM_API_PATH + '/fs/write_file_text?path=' + encodeURIComponent('material-you-theme-config.json'), {
			method: 'POST',
			headers: { 'BETTERNCM_API_KEY': BETTERNCM_API_KEY, 'Content-Type': 'text/plain' },
			body: JSON.stringify(cachedConfig, null, 2)
		}).catch(() => {});
	} catch (e) {}
};

export const getSetting = (option, defaultValue = '') => {
	if (option in cachedConfig) {
		const val = cachedConfig[option];
		if (val === 'true') return true;
		if (val === 'false') return false;
		return val;
	}
	const fullKey = "material-you-theme-" + option;
	let value = null;
	try {
		value = localStorage.getItem(fullKey);
	} catch (e) {}
	if (value === null || value === undefined) {
		value = defaultValue;
	}
	if (value === 'true') {
		value = true;
	} else if (value === 'false') {
		value = false;
	}
	cachedConfig[option] = value;
	return value;
}

export const setSetting = (option, value) => {
	cachedConfig[option] = value;
	const fullKey = "material-you-theme-" + option;
	try {
		localStorage.setItem(fullKey, typeof value === 'object' ? JSON.stringify(value) : String(value));
	} catch (e) {}
	clearTimeout(saveConfigTimer);
	saveConfigTimer = setTimeout(saveConfigToDisk, 300); // 300ms 防抖立即落盘写入硬盘文件
}

if (typeof window !== 'undefined') {
	window.addEventListener('pagehide', saveConfigToDisk);
	window.addEventListener('beforeunload', saveConfigToDisk);
}
export const makeToast = (html, duration = 1000) => {
	let noIntroAnimation = false;
	if (document.querySelector('.md-toast')) {
		noIntroAnimation = true;
		document.querySelector('.md-toast').remove();
	}
	const toast = document.createElement('div');
	toast.classList.add('md-toast');
	toast.innerHTML = `
		<div class="wrap">
			<div class="inner" style="${ noIntroAnimation ? 'animation-duration: 0s;' : ''}">
				${html}
			</div>
		</div>
	`;
	document.body.appendChild(toast);
	setTimeout(() => {
		toast.classList.add('z-hide');
		toast.querySelector('.inner').style = '';
	}, duration);
	setTimeout(() => {
		document.body.removeChild(toast);
	}, duration + 500);
}
export const chunk = (input, size) => {
	return input.reduce((arr, item, idx) => {
		return idx % size === 0
			? [...arr, [item]]
			: [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
	}, []);
};
