import { getSetting, setSetting } from "./utils";
import { schemePresets } from "./scheme-presets";
import { applyScheme, getThemeCSSFromColor, updateDynamicTheme } from "./main";
import './settings.scss';
class MDSettings extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			open: false,
			scheme: 'dynamic-auto',
			ignoreNowPlaying: false,
			hideNCMLogo: false,
			disableCommentStyle: false,
			nativeSkinLink: false,
			menuColoring: true,
			customPreset: JSON.parse(getSetting('custom-scheme', JSON.stringify({
				'primary': [189, 230, 251],
				'secondary': [],
				'bg': [30, 37, 41],
				'bg-darken': [23, 29, 32],
				'light': false
			})))
		};
		this.setScheme = this.setScheme.bind(this);
		// E4-B:自定义主题项的回调原本是 render 内联箭头(每次渲染新引用,击穿 memo)——提为绑定方法
		this.setCustomScheme = this.setCustomScheme.bind(this);
	}
	componentDidMount() {
		this.setState({
			scheme: getSetting('scheme', 'dynamic-default-auto'),
			ignoreNowPlaying: getSetting('ignore-now-playing-page', false),
			hideNCMLogo: getSetting('hide-ncm-logo', false),
			disableCommentStyle: getSetting('disable-comment-style', false),
			nativeSkinLink: getSetting('native-skin-link', false),
			menuColoring: getSetting('menu-coloring', true),
		});
	}
	setScheme(scheme) {
		const __t0 = performance.now();
		this.setState({ scheme: scheme.name });
		applyScheme(scheme.name);
		setSetting('scheme', scheme.name);
		// E1 二期:点击侧总耗时(含同步 React 渲染 + applyScheme 全程),recon meta.json 转储
		const __w = (window.__mdStageStats ??= []);
		__w.push(`CLICK total=${(performance.now()-__t0).toFixed(1)} (${scheme.name})`);
		if (__w.length > 24) __w.shift();
	}
	setCustomScheme(scheme) {
		setSetting('custom-scheme', JSON.stringify(this.state.customPreset));
		this.setScheme(scheme);
	}
	render() {
		return (
			<div>
						<button
							id="md-theme-setting-btn"
							title="主题设置"
							className={ `${ this.state.open ? 'active' : ''}`}
							onClick={ () => { this.setState({ open: !this.state.open }); } } >
							<span className="cmd-icon icon IconStyle_ic272p3">
								<svg width="20" height="20" viewBox="0 -960 960 960" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-85 32-158t87.5-127q55.5-54 130-84.5T489-880q79 0 150 26.5T763.5-780q53.5 47 85 111.5T880-527q0 108-63 170.5T650-294h-75q-18 0-31 14t-13 31q0 27 14.5 46t14.5 44q0 38-21 58.5T480-80Zm0-400Zm-198 11q15-15 15-35t-15-35q-15-15-35-15t-35 15q-15 15-15 35t15 35q15 15 35 15t35-15Zm126-170q15-15 15-35t-15-35q-15-15-35-15t-35 15q-15 15-15 35t15 35q15 15 35 15t35-15Zm214 0q15-15 15-35t-15-35q-15-15-35-15t-35 15q-15 15-15 35t15 35q15 15 35 15t35-15Zm131 170q15-15 15-35t-15-35q-15-15-35-15t-35 15q-15 15-15 35t15 35q15 15 35 15t35-15ZM480-140q11 0 15.5-4.5T500-159q0-14-14.5-26T471-238q0-46 30-81t76-35h73q76 0 123-44.5T820-527q0-132-100-212.5T489-820q-146 0-247.5 98.5T140-480q0 141 99.5 240.5T480-140Z" fill="currentColor"></path>
								</svg>
							</span>
						</button>
				<div id="md-theme-setting" className={ `${ this.state.open ? 'active' : ''}`}>
					<div className="md-theme-setting-title">设置</div>
					<div className="md-theme-setting-subtitle">Material You Theme</div>
					<div className="md-scheme-list">
						<div className="md-scheme-list-section-title">动态主题</div>
						<div className="md-scheme-list-section-description">根据歌曲封面动态生成配色</div>
						<DynamicSchemeSet name="default" activeScheme={ this.state.scheme } setScheme={ this.setScheme } />
						<DynamicSchemeSet name="tonal-spot" activeScheme={ this.state.scheme } setScheme={ this.setScheme } />
						<DynamicSchemeSet name="vibrant" activeScheme={ this.state.scheme } setScheme={ this.setScheme } />
						<DynamicSchemeSet name="expressive" activeScheme={ this.state.scheme } setScheme={ this.setScheme } />
						<DynamicSchemeSet name="fidelity" activeScheme={ this.state.scheme } setScheme={ this.setScheme } />
						<DynamicSchemeSet name="neutral" activeScheme={ this.state.scheme } setScheme={ this.setScheme } />
					</div>
					<CustomDynamicThemeSetting show={ this.state.scheme.startsWith('dynamic-') } />
					<div className="md-scheme-list">
						<div className="md-scheme-list-section-title">普通主题</div>
						{
							this.props.list.map((item, index) => {
								return (
									<SchemeItem key={ index } scheme={ item } active={ this.state.scheme === item.name } setScheme={ this.setScheme } />
								);
							})
						}
					</div>
					<div className="md-scheme-list">
						<div className="md-scheme-list-section-title">自定义主题</div>
					<SchemeItem key="custom" scheme={ {name: 'custom', palette: this.state.customPreset} } active={ this.state.scheme === 'custom' } setScheme={ this.setCustomScheme } />
					</div>
					{
						this.state.scheme === 'custom' ? (
							<CustomSchemeSetting scheme={ this.state.customPreset } setCustomPreset={ (preset) => {
								this.setState({ customPreset: preset }, () => {	
									setSetting('custom-scheme', JSON.stringify(this.state.customPreset));
									applyScheme('custom');
								});
							}} />
						) : null
					}
					<div className="md-theme-setting-subtitle">界面</div>
					<>
						<div className="md-checkbox-wrapper">
							<input id="md-hide-ncm-logo" type="checkbox" className="md-checkbox" checked={ this.state.hideNCMLogo } onChange={ (e) => {
								this.setState({ hideNCMLogo: e.target.checked });
								if (e.target.checked) {
									document.body.classList.add('hide-ncm-logo');
								} else {
									document.body.classList.remove('hide-ncm-logo');
								}
								setSetting('hide-ncm-logo', e.target.checked);
							}} />
							<label for="md-hide-ncm-logo" className="md-checkbox-label">隐藏网易云 Logo</label>
						</div>
					</>
					<div className="md-theme-setting-subtitle">其他设置</div>
					<div className="md-checkbox-wrapper">
						<input id="md-ignore-now-playing-page" type="checkbox" className="md-checkbox" checked={ this.state.ignoreNowPlaying } onChange={ (e) => {
							this.setState({ ignoreNowPlaying: e.target.checked });
							if (e.target.checked) {
								document.body.classList.add('ignore-now-playing');
							} else {
								document.body.classList.remove('ignore-now-playing');
							}
							setSetting('ignore-now-playing-page', e.target.checked);
						}} />
						<label for="md-ignore-now-playing-page" className="md-checkbox-label">在正在播放页面中不应用主题</label>
					</div>
					<div className="md-checkbox-wrapper">
						<input id="md-disable-comment-style" type="checkbox" className="md-checkbox" checked={ this.state.disableCommentStyle } onChange={ (e) => {
							this.setState({ disableCommentStyle: e.target.checked });
							if (e.target.checked) {
								document.body.classList.add('md-disable-comment-style');
							} else {
								document.body.classList.remove('md-disable-comment-style');
							}
							setSetting('disable-comment-style', e.target.checked);
						}} />
						<label for="md-disable-comment-style" className="md-checkbox-label">禁用评论区样式</label>
					</div>
					<div className="md-checkbox-wrapper">
						<input id="md-native-skin-link" type="checkbox" className="md-checkbox" checked={ this.state.nativeSkinLink } onChange={ (e) => {
							this.setState({ nativeSkinLink: e.target.checked });
							setSetting('native-skin-link', e.target.checked);
							window.location.reload();
						}} />
						<label for="md-native-skin-link" className="md-checkbox-label">实验性:原生皮肤联动(重启生效)</label>
					</div>
					<div className="md-checkbox-wrapper">
						<input id="md-menu-coloring" type="checkbox" className="md-checkbox" checked={ this.state.menuColoring } onChange={ (e) => {
							this.setState({ menuColoring: e.target.checked });
							setSetting('menu-coloring', e.target.checked);
							window.location.reload();
						}} />
						<label for="md-menu-coloring" className="md-checkbox-label">悬浮菜单/托盘按钮染色(重启生效)</label>
					</div>
				</div>
			</div>
		);
	}
}

// E4-B:仅当本族方案的激活态进出、或回调/取色缓存变化时才重渲染;
// 其它族的 activeScheme 字符串变化(点了别的族)不触发本族重渲染。
const DynamicSchemeSet = React.memo(function DynamicSchemeSet(props) {
	const [cssVariables, setCssVariables] = React.useState({});

	React.useEffect(() => {
		const onDominantColorChange = () => {
			const newCssVariables = getThemeCSSFromColor(`dynamic-${props.name}`);
			setCssVariables(newCssVariables);
		};
		document.body.addEventListener('md-dominant-color-change', () => {
			onDominantColorChange();
		});
		onDominantColorChange();
		return () => {
			document.body.removeEventListener('md-dominant-color-change', () => {
				onDominantColorChange();
			});
		};
	}, []);

	// 稳定引用:三件套 scheme 对象与 auto 回调(原先是 render 内联字面量/箭头,击穿子级 memo)
	const darkItem = React.useMemo(() => ({ name: `dynamic-${props.name}-dark`, palette: {} }), [props.name]);
	const lightItem = React.useMemo(() => ({ name: `dynamic-${props.name}-light`, palette: {} }), [props.name]);
	const autoItem = React.useMemo(() => ({ name: `dynamic-${props.name}-auto`, palette: {} }), [props.name]);
	const setAutoScheme = React.useCallback((scheme) => {
		props.setScheme(scheme);
		document.body.dispatchEvent(new CustomEvent('md-dynamic-theme-auto'));
	}, [props.setScheme]);

	return (
		<React.Fragment>
			<SchemeItem
				key={`dynamic-${props.name}-dark`}
				dynamic={true}
				scheme={darkItem}
				active={ props.activeScheme === darkItem.name }
				setScheme={ props.setScheme }
				cssVariablesOverride={cssVariables}
			/>
			<SchemeItem
				key={`dynamic-${props.name}-light`}
				dynamic={true}
				scheme={lightItem}
				active={ props.activeScheme === lightItem.name }
				setScheme={ props.setScheme }
				cssVariablesOverride={cssVariables}
			/>
			<SchemeItem
				key={`dynamic-${props.name}-auto`}
				dynamic={true}
				scheme={autoItem}
				active={ props.activeScheme === autoItem.name }
				setScheme={ setAutoScheme }
				cssVariablesOverride={cssVariables}
			/>
		</React.Fragment>
	);
}, (prev, next) => {
	// 返回 true = 跳过重渲染。本族激活态 = activeScheme 以 dynamic-<本族名>- 开头
	const familyPrefix = `dynamic-${next.name}-`;
	const familyChanged = prev.activeScheme.startsWith(familyPrefix) !== next.activeScheme.startsWith(familyPrefix);
	if (familyChanged) return false;
	if (prev.activeScheme !== next.activeScheme && next.activeScheme.startsWith(familyPrefix)) return false;
	return prev.name === next.name && prev.setScheme === next.setScheme;
});

// E4-B:自定义比较器 —— scheme 用"名字+调色板引用"深一度比较(容忍父级每次新建包装对象),
// 其余 props 浅比较。点击方案时仅新旧两个激活项重渲染,其余 ~16 项全部跳过。
const SchemeItem = React.memo(function SchemeItem(props) {
	const containerRef = React.useRef(null);

	React.useEffect(() => {
		if (!props.cssVariablesOverride) return;
		if (containerRef.current) {
			let style = containerRef.current.style;
			for (let i = 0; i < style.length; i++) {
				let key = style[i];
				if (key.startsWith('--')) {
					style.removeProperty(key);
				}
			}
		}
		Object.entries(props.cssVariablesOverride).forEach(([key, value]) => {
			containerRef.current.style.setProperty(key, value);
		});
	}, [props.cssVariablesOverride]);

	return (
		<div ref={containerRef} className={`md-scheme-item ${props.dynamic ? 'md-scheme-item-dynamic' : ''} ${props.active ? 'active' : ''}`}>
			<SchemePreview scheme={ props.scheme.palette } setScheme= {() => { props.setScheme(props.scheme); }} name={ props.scheme.name } />
			<div className="md-scheme-item-name-container">
				<span className="md-scheme-item-indicator"></span>
				<span className="md-scheme-item-name">{ props.scheme.name.replace(/^dynamic\-/, '').replace(/\-/g, ' ') }</span>
			</div>
		</div>
	);
}, (prev, next) => {
	if (prev.active !== next.active) return false;
	if (prev.dynamic !== next.dynamic) return false;
	if (prev.setScheme !== next.setScheme) return false;
	if (prev.cssVariablesOverride !== next.cssVariablesOverride) return false;
	return prev.scheme.name === next.scheme.name && prev.scheme.palette === next.scheme.palette;
});

class SchemePreview extends React.Component {
	constructor(props) {
		super(props);
	}
	
	getAccentColorStyle = () => {
		let result = {};
		this.props.scheme['secondary'] ??= this.props.scheme['primary'];
		for (let name in this.props.scheme) {
			if (name == 'light') {
				continue;
			}
			if (!this.props.scheme[name]) continue;
			const [r, g, b] = this.props.scheme[name];
			if (name == '' || name == 'primary') {
				name = '--md-accent-color';
			} else {
				name = '--md-accent-color-' + name;
			}
			result[name] = `rgb(${r}, ${g}, ${b})`;
			result[name + '-rgb'] = `${r}, ${g}, ${b}`;
		}
		return result;
	}

	inner = () => (
		<div className="md-scheme-preview-inner">
			<div className="md-bottombar"></div>
			<div className="md-leftbar"></div>
			<div className="md-btn-1"></div>
			<div className="md-btn-2"></div>
			<div className="md-btn-3"></div>
			<div className="md-leftbar-content-1"></div>
			<div className="md-leftbar-content-2"></div>
			<div className="md-leftbar-content-3"></div>
			<div className="md-leftbar-content-4"></div>
			<div className="md-leftbar-content-5"></div>
			<div className="md-leftbar-content-6"></div>
			<div className="md-leftbar-content-7"></div>
			<div className="md-main">
				<div className="md-today-recommend-demo">
					<div className="md-today-recommend-1"></div>
					<div className="md-today-recommend-2"></div>
					<div className="md-today-recommend-3"></div>
				</div>
				<div className="md-recommend-demo">
					<div className="md-recommend-1"></div>
					<div className="md-recommend-2"></div>
					<div className="md-recommend-3"></div>
					<div className="md-recommend-4"></div>
					<div className="md-recommend-5"></div>
					<div className="md-recommend-6"></div>
					<div className="md-recommend-7"></div>
					<div className="md-recommend-8"></div>
					<div className="md-recommend-9"></div>
					<div className="md-recommend-10"></div>
				</div>
			</div>
		</div>
	);

	render() {
		return (
			<div className="md-scheme-preview"
				scheme-name={ this.props.name }
				style={ this.getAccentColorStyle() }
				onClick={
					() => {
						this.props.setScheme();
					}
				}>
				{ this.inner() }
				{ this.props.name.startsWith('dynamic') && this.props.name.endsWith('-auto') ? this.inner() : null }
			</div>
		);
	}
}

class CustomSchemeSetting extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			scheme: this.props.scheme
		}
	}
	
	updateScheme = () => {
		let scheme = this.state.scheme;
		this.props.setCustomPreset(scheme);
	}
	
	setColor = (name, value) => {
		this.setState({
			scheme: {
				...this.state.scheme,
				[name]: value
			}
		}, () => {
			this.updateScheme();
		});
	}
	
	render() {
		return (
			<div className="md-custom-scheme-setting">
				<div className="md-theme-setting-subtitle">自定义</div>
				<ColorField color={ this.state.scheme['primary'] } label="主色" defaultColor={[189, 230, 251]} setColor={ (value) => { this.setColor('primary', value); } } />
				<ColorField color={ this.state.scheme['secondary'] } label="次色 (文字)" defaultColor={this.state.scheme['primary'] ?? [189, 230, 251]} setColor={ (value) => { this.setColor('secondary', value); } } optional={true} />
				<ColorField color={ this.state.scheme['bg'] } label="背景" defaultColor={[30, 37, 41]} setColor={ (value) => { this.setColor('bg', value); } } />
				<ColorField color={ this.state.scheme['bg-darken'] } label="背景 (暗化)" defaultColor={[23, 29, 32]} setColor={ (value) => { this.setColor('bg-darken', value); } } />
				<div className="md-checkbox-wrapper">
					<input id="md-custom-scheme-light" type="checkbox" className="md-checkbox" checked={ this.state.scheme.light } onChange={ (e) => {
						this.setColor('light', e.target.checked);
					}} />
					<label for="md-custom-scheme-light" className="md-checkbox-label">亮色主题</label>
				</div>
			</div>
		);
	}
}

class ColorField extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			color: this.props.color ?? ['', '', ''],
		}
	}

	componentDidUpdate( prevProps ) {
		if (prevProps.defaultColor.toString() != this.props.defaultColor.toString() && this.state.color.filter((v) => v !== '').length !== 3) {
			this.props.setColor(this.getCurrentColor());
		}
	}

	getCurrentColor() {
		if (this.state.color.filter((v) => v !== '').length === 3) {
			return this.state.color;
		} else {
			return this.props.defaultColor;
		}
	}

	render() {
		return (
			<div className="md-color-field">
				<input className="md-color-field-color" type="color" value={ '#' + this.getCurrentColor().map((v) => {
					return v.toString(16).padStart(2, '0');
				}).join('') } onChange={ (e) => {
					const color = e.target.value.substr(1).match(/.{2}/g).map((v) => parseInt(v, 16));
					this.setState({ color }, () => {
						this.props.setColor(this.getCurrentColor());
					});
				}} />
				<div className="md-color-field-label">{ this.props.label }</div>
				{
					['R', 'G', 'B'].map((v, i) => {
						return (
							<div className="md-color-field-input-wrapper">
								<input type="number" min="0" max="255" step="1" value={ this.state.color[i] ?? '' }
									onInput={ (e) => {
										const color = this.state.color;
										if (e.target.value === '') {
											color[i] = '';
										} else {
											color[i] = Math.min(255, Math.max(0, parseInt(e.target.value)));
											e.target.value = color[i];
										}
										this.setState({ color }, () => {
											this.props.setColor(this.getCurrentColor());
										});
									}}
								/>
								<div className="md-color-field-input-label">{ v }</div>
							</div>
						)
					})
				}
				<button className="md-color-field-reset" onClick={ () => {
					this.setState({ color: ['', '', ''] }, () => {
						this.props.setColor(this.getCurrentColor());
					});
				} }><svg xmlns="http://www.w3.org/2000/svg" height="24" width="24"><path d="M6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5l5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6Z"/></svg></button>
			</div>
		);
	}
}
function CustomDynamicThemeSetting(props) {
	const [dynamicThemeColorSource, setDynamicThemeColorSource] = React.useState(getSetting('dynamic-theme-color-source', 'cover'));
	const [customDynamicThemeColor, setCustomDynamicThemeColor] = React.useState(JSON.parse(getSetting('custom-dynamic-theme-color', '[189, 230, 251]')));

	React.useEffect(() => {
		window.mdDynamicThemeColorSource = dynamicThemeColorSource;
		updateDynamicTheme();
		document.body.dispatchEvent(new CustomEvent('md-dominant-color-change'));
	}, [dynamicThemeColorSource]);
	
	return (
		props.show && 
		(
			<div className="md-custom-scheme-setting">
				<div className="md-theme-setting-subtitle">取色选项</div>
				<div className="md-select">
					<label className="md-select-label">取色来源</label>
					<select className="md-theme-setting-select" value={ dynamicThemeColorSource } onChange={ (e) => {
							setDynamicThemeColorSource(e.target.value);
							setSetting('dynamic-theme-color-source', e.target.value);
						} }>
						<option value="cover">当前歌曲封面</option>
						<option value="bg-enhanced">播放页背景</option>
						<option value="custom">自定义颜色</option>
					</select>
				</div>
				{
					dynamicThemeColorSource === 'custom' &&
					(
						<ColorField color={ customDynamicThemeColor } label="自定义颜色" defaultColor={[189, 230, 251]} setColor={ (value) => {
							setCustomDynamicThemeColor(value);
							setSetting('custom-dynamic-theme-color', JSON.stringify(value));
							window.mdCostomDynamicThemeColor = value;
							updateDynamicTheme();
							document.body.dispatchEvent(new CustomEvent('md-dominant-color-change'));
						} } />
					)
				}
			</div>
		)
	);
}

export const initSettingMenu = () => {
	const container = document.querySelector('#md-settings-menu-container');
	if (!container) {
		setTimeout(() => { initSettingMenu() } , 100);
		return;
	}
	let list = [];
	for (let key in schemePresets) {
		if (schemePresets.hasOwnProperty(key)) {
			list.push( {
				name: key,
				palette: schemePresets[key]
			});
		}
	}
	ReactDOM.render(<MDSettings list={ list }/>, container);
}
