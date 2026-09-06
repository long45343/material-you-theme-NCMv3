# Material You Theme — 网易云音乐 3.1 适配 Spec

- 版本:v1.0(决策全部完成)
- 日期:2026-09-06
- 决策状态:**13 项全部已决**,结论见 [DECISIONS.md](DECISIONS.md) 及下方摘要表;一致性检查已通过(见 DECISIONS.md 第 14 节)。
- 依据:静态解包(orpheus.ntpk 1377 文件)+ 运行时侦察插件(MD33Recon)双路确认,事实清单见附录 A。

### 已定决策摘要

| # | 议题 | 结论 |
|---|---|---|
| D1 | 组织 | 独立新仓库 `D:\EDCs\code\material-you-theme-NCMv3`(remote:github.com/long45343/material-you-theme-NCMv3),新 slug |
| D2 | v1 范围 | 分层发布:核心配色 + 无风险纯 CSS 项首发;其余进 backlog |
| D3 | 原生联动 | 混合分级:默认纯 CSS;「实验性:原生皮肤联动」开关默认关(S2 后实现) |
| D4 | 亮暗来源 | 跟随网易云自身设置(S1),兜底 `os.isSystemDarkThemeEnabled` |
| D5 | 取色锚点 | 多候选链(vinyl 容器 → cover-area → TrackInfo),Observer+load 双触发 |
| D6 | 背景取色 | 删 BGEnhanced;用 3.1 内置封面模糊背景 |
| D7 | 设置入口 | 侧栏头像区旁注入 + onConfig 兜底 |
| D8 | 菜单染色 | v1 放弃,留空桩,v2 视 S3 决策 |
| D9 | 时间指示器 | CSS-only 样式统一原生时间显示,不注入组件 |
| D10 | ripple | 放弃,用 3.1 原生按压反馈 |
| D11 | 视图切换器 | 延后 v2(backlog,前置 S5) |
| D12 | 样式架构 | 模块拆分,import 顺序即层叠优先级 |
| D13 | 版本范围 | 不设版本墙;README 声明仅在 3.1.39 测试 |

---

## 0. 目标与范围

将 BetterNCM 主题插件 material-you-theme(Material You 动态取色)适配到网易云 3.1.x PC 客户端。

> **【D1 已决策】组织方式**:用户非上游维护者;本项目为独立新仓库,工作目录最终落在 `D:\EDCs\code\material-you-theme-NCMv3`(remote:`https://github.com/long45343/material-you-theme-NCMv3`)。当前目录作为逆向/复用代码的参考库,不直接提交。manifest 的 name/slug/author 按新插件身份填写。

- 复用:取色/配色引擎(material-color-utilities 封装)、方案预设数据、设置面板 React 组件、插件自有样式(settings.scss)。
- 重写:全部面向客户端 DOM 的样式(styles.scss 约 2976 行 + ncm-css-override.css)、DOM 锚点、原生外观联动。
- 范围由决策 D2 定(最小可用 / 全量移植 / 分层)。

## 1. 总体架构

```
┌─ manifest.json (ncm3-compatible, ncm-version-req, injects.Main=[main.js])
│
├─ main.js(入口,startup 注入)
│   ├─ 配色引擎(纯 JS,与客户端无关,原样保留)
│   │    getDynamicThemeColor → getThemeCSSFromColor → updateDynamicTheme
│   │    (QuantizerCelebi + Score + themeFromSourceColor / Scheme* 生成)
│   ├─ 取色源适配层(3.1 新 DOM)
│   │    setupCoverWatcher → getCoverElementCandidates → updateDynamicColorFromCover
│   ├─ 原生外观联动层(3.1 新协议)
│   │    applyNativeAppearance【D3✅】、probeAndWatchAppThemeMode【D4✅】、hookChannelMenus【D8✅ 留桩】
│   ├─ 功能开关层(body class + localStorage 设置)
│   └─ 设置面板挂载 injectSettingsEntry【D7✅】
│
├─ settings.js(React 设置面板,大部分保留)
├─ widgets/: time-indicator【D9✅ 不打包】、list-view-switcher【D11✅ 不打包】、ripple【D10✅ 不打包】
└─ 样式层【D12✅】: variables / base / nav / maintab / player / songplay / overrides
     输出契约:--md-accent-color(-rgb)、--md-accent-color-secondary(-rgb)、
              --md-accent-color-bg(-rgb)、--md-accent-color-bg-darken(-rgb)、
              --md-accent-color-grey-base(-rgb)、--md-dynamic-{light,dark}-*、
              body class: material-you-theme / md-dynamic-theme(-light|-dark|-auto)
```

数据流:封面 img → canvas 48×48 → QuantizerCelebi(128) → Score → sourceColor(ARGB) →
Scheme 生成 light/dark 两套 → 写入 `:root` 级 CSS 变量 → 样式层按 body class 消费。
`md-dominant-color-change` 自定义事件为模块间通知,保持不变。

## 2. manifest.json(字段级)

| 字段 | 值 | 说明 |
|---|---|---|
| manifest_version | 1 | 固定 |
| name / slug | Material You Theme / MaterialYouThemeNCMv3 | 【D1✅】新仓库新身份,author 填用户(long45343) |
| version | 3.0.0-alpha.N | 主版本号升 3 与客户端对齐 |
| type | theme | 保留 |
| ncm3-compatible | true | **3.x 硬性要求**,缺失即被 chromatic 跳过 |
| ncm-version-req | 不设置(保留 chromatic 默认) | 【D13✅】不做安装限制,README/描述声明「仅在 3.1.39 测试」 |
| injects.Main | [ {file: main.js} ] | 必须走 injects(startup_script 路径拿不到 plugin 上下文) |
| requirements | 无 | 【D2✅/D6✅】list-scroll-fix 为 2.x 依赖,移除;不再依赖 BGEnhanced |
| hijacks | 无(v1) | D3 实验开关走运行时 loadSkinPackets 调用,不用 hijacks;未来若需资源替换参考 InfLink-rs 的 `">=3.1.21"` 写法 |

## 3. utils.js(逐函数)

| 函数 | 处置 | 说明 |
|---|---|---|
| injectCSS(css) | 保留原样 | 与 DOM 版本无关 |
| injectHTML(type, html, parent, fun) | 保留原样 | 同上 |
| waitForElement(selector, fun) | 保留原样 | 轮询实现,不依赖客户端内部 |
| waitForElementAsync(selector) | 保留原样 | 依赖 `betterncm.utils.waitForElement`(3.1 存在,运行时已确认 betterncm 对象含 utils) |
| getSetting / setSetting | 保留原样 | localStorage 键前缀 `material-you-theme-`;沿用可继承 2.x 用户设置 |
| makeToast(html, duration) | 修改 | 移除 2.x 类 `u-result`/`j-tips` 依赖,样式完全由插件自带类 `md-toast` 提供 |
| chunk(input, size) | 保留原样 | 纯函数 |

## 4. color-utils.js / scheme-presets.js

- color-utils.js:`rgb2Hsl`、`hsl2Rgb`、`argb2Rgb` 等纯函数,**原样保留**。
- scheme-presets.js:22 个预设数据,**原样保留**。

## 5. main.js(逐函数)

处置图例:保留=逻辑不变;修改=改实现;删除=3.1 无对应物且不移植;新增=3.1 新需求。

### 5.1 配色引擎(核心,全部保留)

| 函数 | 处置 | 3.1 变更点 |
|---|---|---|
| migrateSettings() | 保留 | 无 |
| updateAccentColor([r,g,b], name) | 保留 | 写 body 变量,与 DOM 无关 |
| getCalculatedPrimaryColorBGRHEX() | 保留 | 仅 D8=适配 时被菜单染色使用 |
| getDynamicThemeColor() | 保留 | 读 `dynamic-theme-color-source` 设置 + `window.mdCoverDominantColor` |
| getThemeCSSFromColor(schemeName?) | 保留 | 纯引擎;SchemeVibrant/Expressive/Neutral/Fidelity/TonalSpot + themeFromSourceColor |
| updateDynamicTheme() | 保留 | 写 `#root` 级 style 元素,变量名不变 |
| updateDynamicColorFromCover() | **修改** | 见 5.3 取色源适配层 |

### 5.2 方案应用

| 函数 | 处置 | 说明 |
|---|---|---|
| applyScheme(scheme) | 修改 | 保留骨架:`md-dynamic-theme(-light|-dark|-auto)` body class、preset 处理、变量写入;把 `overrideNCMCSS`/`updateNativeTheme` 两处调用替换为 `applyNativeAppearance()`(D3✅:默认 no-op,实验开关开启才调 loadSkinPackets);auto 模式的亮暗判定改由 `probeAndWatchAppThemeMode()` 提供(D4✅) |
| initSettings() | 修改 | 选项清单按 D2✅ 收缩(保留 hide-ncm-logo、disable-comment-style);`--bottombar-height`、`--sidebar-width` 等 2.x 变量删除 |
| addOrRemoveGlobalClassByOption() | 保留 | 无 |

### 5.3 取色源适配层(新增/重写)

| 函数 | 处置 | 说明 |
|---|---|---|
| getCoverElementCandidates() | **新增** | 【D5✅】返回有序候选选择器数组:`['#VINYL_COVER_ELEMENT_ID img', '.cover-container-rotate img', '.cover-area img', '.TrackInfoContainer img']`,命中第一个可见且 src 为 http(s)/orpheus://cache 的 `<img>`;候选表随客户端版本维护 |
| setupCoverWatcher() | **新增** | MutationObserver(body 子树, childList)+ img load 事件,src 变化时触发取色;替代 2.x 对 `.m-pinfo` 的观察 |
| updateDynamicColorFromCover() | 修改 | 从候选 img 绘 48×48 canvas → Celebi/Score → `window.mdCoverDominantColor` + 派发 `md-dominant-color-change`;数据算法与 2.x 完全一致 |
| updateDynamicColorFromBuiltInBG() | **新增**(替代 updateDynamicColorFromBGEnhanced) | 【D6✅】删除 BGEnhanced 路径;从 3.1 播放页内置封面模糊背景(`#VINYL_COVER_ELEMENT_ID` 容器背后的图,60px 缩采样同 2.x 算法)取色,写 `window.mdBGEnhancedDominantColor` 保持取色来源切换逻辑复用 |

### 5.4 原生外观联动层

| 函数 | 处置 | 说明 |
|---|---|---|
| applyNativeAppearance(mode) | **新增**(替代 setHref/overrideNCMCSS/updateNativeTheme) | 【D3✅=C 混合分级】默认实现为 no-op;设置面板「实验性:原生皮肤联动」开启时才调 `channel.call('app.loadSkinPackets', type, name, extra, cb)`(签名/语义以 Spike S2 为准),任何异常静默跳过并自动回退关闭开关 |
| probeAndWatchAppThemeMode() | **新增** | 【D4✅=C 跟随网易云】优先读网易云自身亮暗状态(Spike S1 定位键控:body 属性/localStorage/设置存储),叠加 MutationObserver 监听变化;拿不到时兜底 `channel.call('os.isSystemDarkThemeEnabled')`(启动 + visibilitychange 时重查);结果写 `window.mdThemeType`、切 body class `md-light/md-dark`、auto 模式下派发 `md-dynamic-theme-auto` |
| hookChannelMenus() | **新增**(替代 main.js 顶层 channel.call hook) | 【D8✅=C v1 留桩】v1 仅保留空函数与注释(标注:依赖 Spike S3 的 updateMenu/popupMenu payload 结论,v2 决策);**不**替换全局 channel.call |

### 5.5 2.x 专属功能(默认删除,存活取决于 D2)

| 函数组 | 2.x 锚点 | 默认处置 |
|---|---|---|
| updateGreeting | CSS `--md-greeting` 展示位 | 样式重写后自然可用,保留函数 |
| updateDailyRecommendationDate | `.u-cover-daily` | 删除 |
| isPlaylistSpecial / processPlaylistTitles / playlistMoveto* / updateRecommendPlaylists / initRecommendPlaylists / removeRedundantPlaylists(推荐页重组) | `.g-mn .p-recmd` 等 | 删除 |
| recalculateTitleSize(歌名自适应字号) | `.g-mn .m-info .tit .name h2 .f-ust` | 删除 |
| scrollToCurrentPlaying(定位播放) | `.m-plylist .itm.z-play` | 删除 |
| plugin.onLoad 内:time indicator 注入(`#main-player`/`.m-player-fm`) | 2.x 播放条 | 【D9✅=B】删除注入;仅 CSS 统一 3.1 原生时间显示 |
| plugin.onLoad 内:queueNotify/jump-to-playing 按钮 | `#main-player .list .m-queuenotify` | 删除 |
| plugin.onLoad 内:u-ibtn5/artist-info 的 --text/--number 变量 | `.u-ibtn5` | 删除 |
| plugin.onLoad 内:sidebar 宽度 observer | `.g-sd` | 删除(3.1 布局不同,如需要按新布局重做) |
| plugin.onLoad 内:主题变化 observer(#pri-skin-gride/#skin_default) | 2.x 专属 | 删除,由 applyNativeAppearance 内部机制替代 |
| plugin.onLoad 内:hashchange 监听 + page-hash 属性 | location.hash | 修改:保留 `page-hash` body 属性(样式层用它做页面级配色);3.1 主页 hash 为空字符串,监听 `hashchange`+`popstate` 双通道 |
| plugin.onLoad 内:list view switcher 注入 | `.m-lstoper`/`.m-plylist .hd` | 【D11✅=C】删除,组件源码保留,backlog |
| plugin.onConfig | — | 保留原样 |

## 6. settings.js(逐函数)

| 函数/组件 | 处置 | 说明 |
|---|---|---|
| MDSettings.constructor/componentDidMount | 修改 | 【D2✅】state 开关清单收缩为:hideNCMLogo、disableCommentStyle;删除 capsuleSidebar/disableNewUI/floatingBottombar/transparentFramework(backlog)与 ignoreNowPlaying 保留待定(默认保留,纯 class 开关) |
| MDSettings.setScheme | 保留 | 调 applyScheme + setSetting |
| MDSettings.render 中播放进度读取 | **删除** | 2.x 读 `.m-player .prg .has` 写 `--md-now-playing-persentage`;【D9✅=B】随组件注入一并取消 |
| DynamicSchemeSet | 保留 | 纯 React + md-dominant-color-change 事件 |
| SchemeItem / SchemePreview | 保留 | 预览图是插件自绘装饰(模仿 2.x 布局),不依赖客户端 |
| CustomSchemeSetting / ColorField | 保留 | 纯 React |
| CustomDynamicThemeSetting | 修改 | 【D6✅】「取色来源」选项变为:当前歌曲封面 / 播放页背景(内置,原 bg-enhanced 语义)/ 自定义颜色;移除 `md-has-background`/`bg-enhanced` body class 检测,内置背景选项恒显示 |
| initSettingMenu() | **修改** | 【D7✅】新锚点:`#page_pc_main_nav` 头像区的结构定位父级(哈希类仅辅助 + `:not()` 兜底),插入 `#md-settings-menu-container`;重试逻辑(100ms 轮询)保留;`plugin.onConfig` 兜底打开按钮保留 |

## 7. widgets

| 组件 | 处置 | 说明 |
|---|---|---|
| time-indicator.js | **不打包** | 【D9✅=B】源码保留仓库备查,main.js 不再 import;播放条时间显示仅做 CSS 统一 |
| list-view-switcher.js | **不打包**(v2) | 【D11✅=C】源码保留待 backlog 恢复,前置 Spike S5 |
| ripple.js / ripple.scss | **不打包** | 【D10✅=C】彻底放弃,使用 3.1 原生按压反馈 |

## 8. 样式层重写规范【D12✅】

### 8.1 选择器锚点规则(强制)

按优先级使用锚点,越靠前越稳定:
1. 页面骨架 ID:`#page_pc_main_nav`、`#page_pc_main_tab`、`#page_pc_songplay`、`#vinyl-page-container`
2. `cmd-*` 语义类:`cmd-button`、`cmd-typography`、`cmd-card`、`cmd-icon-*`、`cmd-input-wrapper`
3. 结构稳定语义类:`.cover-area`、`.page-footer`、`.searchbox`、`.lyric-mode`
4. **禁用** CSS-in-JS 哈希类(`XxxWrapper_x1abcdef`)作为唯一锚点;确需使用时必须与 1–3 组合并写在 `:not([类名漂移兜底])` 结构旁,并在选择器旁注释客户端版本

### 8.2 变量契约(不变,样式层只消费)

见第 1 节输出契约。新增 3.1 特有:
- `--md-page-bg` / `--md-page-fg`:由 `--md-dynamic-{mode}-bg/primary` 按 `window.mdThemeType` 映射,样式层统一消费,避免每处写亮暗分支
- 消费方式:body class `md-dynamic-theme-light|dark` + `md-light|md-dark`(系统探测结果)组合

### 8.3 模块划分(D12✅=B 模块拆分)

`src/styles/` 目录,main.js **按以下顺序 import**(顺序即层叠优先级,不得调换):

```
variables.scss   → 变量定义 + 亮暗映射(--md-page-bg/fg 等)
base.scss        → typography / scrollbar / 全局 reset
app-shell.scss   → 窗口圆角 / 透明 / html 状态类
nav.scss         → #page_pc_main_nav 侧栏
maintab.scss     → #page_pc_main_tab 主区
songplay.scss    → #page_pc_songplay 播放页 / vinyl
player.scss      → 播放条 footer / DefaultPlayerContainer
pages.scss       → 歌单 / 搜索等其他页面
overrides.scss   → cmd-* 组件配色(替代旧 ncm-css-override.css)
```

settings.scss 由 settings.js 单独 import,不参与上述层叠链。

### 8.4 旧文件处置

| 文件 | 处置 |
|---|---|
| styles.scss(2976 行) | 重写(内容全部面向 3.1 锚点) |
| ncm-css-override.css(156 行) | 重写为 3.1 overrides 分区 |
| dynamic-theme.scss(25 行) | 保留(body class → 变量映射),微调 |
| refined-now-playing-accent-color-compatibility.scss | 3.1 版 refined-now-playing 未知;先移出编译,待其 3.x 版出现后恢复 |
| settings.scss / ripple.scss / list-view-switcher.scss | 保留(插件自有) |

## 9. Spike 任务(开发期侦察,产出写回本 spec)

| # | 任务 | 服务于 | 验收 |
|---|---|---|---|
| S1 | 找到 3.1 自身亮暗键控机制:检索 app.chunk 中 theme-mode 写入方、设置存储键(localStorage/native config) | D4✅ | 能用一行代码读写当前模式并被 app 感知 |
| S2 | 实测 `app.loadSkinPackets` 3.1 签名 `(type, name, extra, cb)`:type/name 合法值、extra 结构、效果范围、与网易云自身主题设置是否冲突 | D3✅ 实验开关 | 能切换内置皮肤包或确认其不可用(不可用则实验开关标注失效) |
| S3 | 捕获 `winhelper.updateMenu` / `winhelper.popupMenu` 真实 payload(hook 后打印,注意是否经 enData 序列化) | D8✅ v2 决策 | 拿到菜单项 JSON 结构与颜色字段名,或确认已加密 |
| S4 | 播放条锚点精查:时间显示、进度条、按钮区在 3.1 的类名/结构 | D9✅ CSS-only | 给出原生时间显示的等价选择器清单 |
| S5 | 3.1 歌单页路由与列表结构(路由是 hash 还是 pushState;行高是否 CSS 变量可控) | D11✅ backlog | 给出 switcher 恢复可行性结论 |

## 10. 验收标准(v1)

1. 客户端启动无插件报错;插件管理页可见,`plugin.onConfig` 按钮可打开设置面板。
2. 动态取色:切换歌曲后主色随封面变化(3 秒内),设置面板预览同步。
3. 亮/暗/auto 三种模式可用;auto 跟随网易云自身亮暗设置(D4✅),读不到时兜底系统暗色接口。
4. 侧栏、主区、播放页、播放条背景与强调色一致应用所选 scheme;原生时间显示样式统一(D9✅)。
5. 设置项与功能清单严格对应:保留项全部生效,已删除项(胶囊侧栏/悬浮底栏/全透明框架/时间指示器组件/ripple/视图切换器)不出现在设置面板。
6. 客户端升级到 3.1.x 更高小版本后,因哈希类漂移导致的最大破损面 = 局部样式错乱,不崩溃、不失效(锚点规则 8.1 的目标)。

## 11. 里程碑

| 里程碑 | 内容 | 前置 |
|---|---|---|
| M0 | 新仓库初始化(`material-you-theme-NCMv3`)+ 骨架:manifest(ncm3-compatible)+ injects + 变量注入 + body class,客户端可加载 | 全部决策✅ |
| M1 | 取色链路:setupCoverWatcher(多候选链)→ 变量随封面变化;内置背景取色 | D5✅、D6✅ |
| M2 | 核心配色:variables/base/app-shell/nav/maintab/songplay/player/pages/overrides | 8.1–8.3 |
| M3 | 原生联动:probeAndWatchAppThemeMode(S1)+ applyNativeAppearance 默认路径;设置面板迁移(侧栏头像旁) | D3✅、D4✅、D7✅ |
| M4 | Spike 批处理(S2/S3/S4):实验开关上线(若 S2 可行)、时间显示 CSS 统一、菜单染色 v2 评估 | S2–S4 |
| M5 | 打磨、3.1.39 回归、首次发布(README 声明测试版本) | 全部 |

## 附录 A:3.1 平台事实(侦察结论,spec 自包含)

- 客户端 3.1.39.205426;主窗口 `orpheus://orpheus/pub/app.html`,React + webpackJsonp,`div#root`。
- 全局:应用加载后 `window.React`(28 keys)/`ReactDOM`(11)/`Rx`(61)/`loadedPlugins` 可用;`window.channel` 立即可用(call/registerCall/viewCall/…);启动脚本执行时刻 React 尚未挂载(waitForElement 必要)。
- channel 方法(运行时捕获约 100 个):`app.loadSkinPackets`、`os.isSystemDarkThemeEnabled`、`winhelper.popupMenu`、`winhelper.updateMenu`(2.x 为 updateMenuItem)、`app.setCefNativeTransparentMinibarBackdropEnabled`、`player.setLRCColor` 等。
- stylesheet:`orpheus://orpheus/pub/styles/<hash>.css` ×11,**无 id**(2.x 的 #pri-skin-gride/#skin_default 不存在)。
- DOM 锚点:`#page_pc_main_nav`(侧栏,含搜索框 `.searchbox`)、`#page_pc_main_tab`(主区)、`#page_pc_songplay`(播放页)、`#VINYL_COVER_ELEMENT_ID.CoverBackgroundContainer`(封面模糊背景 + `.mask`)、播放条 `footer.Container_*` 与 `DefaultPlayerContainer_*`、`html.window-fullscreen` 状态类。
- 类名体系:`cmd-*` 语义设计系统(稳定)+ `XxxWrapper_x1abcdef` CSS-in-JS 哈希类(漂移);设计令牌 `--reset-grey-*` 等定义在 app 容器上,html/body 无变量(cssvars.json 为空)。
- 封面图:`.cover-container-rotate .CenterImg_*`、`.TrackInfoContainer_* .cover-container img`;`.theme-dark` 仅用于个别背景图组件,非全局键控(全局键控待 S1)。
- chromatic:3.x 只加载 `"ncm3-compatible": true` 的插件;`injects.Main` 由 js-framework 注入(提供 plugin 上下文);hijacks 按 `">=3.1.21"` 版本区间声明(InfLink-rs 已验证可用);本地 HTTP API `/api/fs/write_file_text` 需 `BETTERNCM_API_KEY` 头且**不创建父目录**。
