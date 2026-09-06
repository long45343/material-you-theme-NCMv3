# DECISIONS — 适配决策清单

- 规则:每个争议点给 3 个选项(A/B/C)并阐述优劣;**每次只问一个问题**;用户选择后立刻把「✅ 已选」写入本题状态行;全部选完后做一致性检查(结论追加在第 14 节)。
- 提问顺序即下列编号顺序(关键决策优先)。

| # | 议题 | 状态 | 选择 |
|---|---|---|---|
| D1 | 仓库/版本组织 | ✅ 已选 | **C 变体(用户自述)**:用户非本仓库维护者;完成后在 `D:\EDCs\code\material-you-theme-NCMv3` 初始化新仓库,remote 设为 `https://github.com/long45343/material-you-theme-NCMv3`。即独立新 slug 方案,新插件 slug/名称在 D1 记录基础上于 M0 定稿(建议 slug `MaterialYouThemeNCMv3` 或沿用 `MaterialYouTheme` 但作者信息为用户)。 |
| D2 | v1 功能范围 | ✅ 已选 | **C 分层发布**:首版 = ①核心配色/取色/亮暗 + 设置面板 + ②中无风险的纯 CSS 项(隐藏 Logo、评论区样式开关);悬浮底栏/全透明框架/胶囊侧栏等改造项与 ③ 全部进 backlog,按里程碑逐个加回,每项独立验收。 |
| D3 | 原生外观联动(皮肤/链接) | ✅ 已选 | **C 混合分级**:默认纯 CSS 不碰原生;设置面板加「实验性:原生皮肤联动」开关(默认关),开启才调 `app.loadSkinPackets`(Spike S2 实测签名后),失败静默跳过。与 D4 的选择联动(倾向 D4=C 以减轻亮暗割裂)。 |
| D4 | 亮暗模式检测来源 | ✅ 已选 | **C 跟随网易云设置**:auto 模式读网易云自身的亮暗状态(Spike S1 定位键控方式;拿不到时兜底 `os.isSystemDarkThemeEnabled`)。写入 `window.mdThemeType` 并派发 `md-dynamic-theme-auto`;与 D3=C 组合可把原生割裂降到只剩色相差异。 |
| D5 | 封面取色锚点 | ✅ 已选 | **C 多候选链**:候选数组 `[#VINYL_COVER_ELEMENT_ID img, .cover-container-rotate img, .cover-area img, .TrackInfoContainer img]` 按序探测,取第一个可见且 src 非空的 img;MutationObserver + img load 双触发;全 miss 保留上次颜色。候选表随客户端版本维护(Spike 持续验证)。 |
| D6 | 背景增强(BGEnhanced) | ✅ 已选 | **B 只用内置背景**:删除 BGEnhanced 依赖与 `updateDynamicColorFromBGEnhanced`;新增 `updateDynamicColorFromBuiltInBG()` 从 3.1 播放页内置封面模糊背景(`#VINYL_COVER_ELEMENT_ID` 容器背后的图)取色;设置面板「取色来源」中 `bg-enhanced` 选项语义改为「播放页背景」。 |
| D7 | 设置面板入口 | ✅ 已选(实现修正) | 原选 **A 侧栏头像旁**。实测发现 3.1 的 `#page_pc_main_nav` 是**顶栏**(非左侧栏),头像芯片空间不足;最终落点 = 顶栏功能图标区 `MiniModeIconBar` 末尾(24px,与原生图标同排),备选头像行、兜底 nav;并加 MutationObserver 重挂守卫(React 重渲染会抹掉外来节点)。 |
| D8 | 右键菜单染色 | ✅ 已选 | **C v1 放弃留桩**:v1 不写实现;`hookChannelMenus()` 只留空框架与注释(标注依赖 Spike S3 的 payload 结论);v2 视 S3 产出(明文 JSON→适配;加密→评估 deData 方案)再决策。 |
| D9 | 时间指示器 | ✅ 已选 | **B CSS-only**:不注入 TimeIndicator 组件(文件保留在仓库但不再 import);仅对 3.1 播放条原生时间显示做配色/字体统一(Spike S4 仍需定位时间元素选择器)。设置面板如无其他入口引用则删除相关设置项。 |
| D10 | ripple 点击效果 | ✅ 已选 | **C 放弃**:不移植 ripple.js,完全使用 3.1 原生按压反馈;ripple.js 与 ripple.scss 不再打包。 |
| D11 | 列表视图切换器 | ✅ 已选 | **C 延后到 v2**:v1 不做,进 backlog(前置条件:Spike S5 确认 3.1 歌单列表行高可 CSS 控制且路由可监听);组件源码保留待复用。 |
| D12 | 样式文件架构 | ✅ 已选 | **B 模块拆分**:main.js 按序 import `styles/variables.scss → base.scss → app-shell.scss → nav.scss → maintab.scss → songplay.scss → player.scss → pages.scss → overrides.scss`(import 顺序即层叠优先级,写入 spec 8.3);settings.scss 插件自有保留。 |
| D13 | 兼容版本范围 | ✅ 已选 | **用户自定:声明仅在 3.1.39 测试,不做安装限制**。manifest 不设 `ncm-version-req` 收紧(保留 chromatic 默认值),README/描述中明确标注「仅在 3.1.39 测试」;不做版本墙,用户自担低版本风险。 |

---

## D1. 仓库/版本组织

背景:2.x 代码在 master;3.1 适配是大规模重写(样式层 100% 重写),要决定 2.x 老版本与 3.x 新版本如何共存、插件 slug 是否变化(决定老用户升级路径与插件市场呈现)。

- **A. 同仓库新分支(master 继续 2.x,3.1 分支开发,稳定后合回并升主版本)**
  - 优点:一个 slug,老用户在插件市场直接收到更新;2.x 修复仍可发布;git 历史连续,复用代码 diff 清晰。
  - 缺点:合回前 2.x/3.1 两头维护要频繁 rebase;若 3.1 架构与 2.x 差异过大,merge 冲突成本高(本次样式层全重写,冲突集中在 styles.scss,反而影响不大)。
- **B. 同仓库共存双版本(同一插件内按 ncm-version-req 二选一注入)**
  - 优点:单插件同时服务 2.x 和 3.1 用户;无分支分裂。
  - 缺点:manifest 的 injects/hijacks 按版本分叉会让代码目录和构建配置复杂化;2.x 已随客户端停止更新,为它增加长期构建负担不值;测试矩阵翻倍。
- **C. 独立新仓库/新 slug(如 MaterialYouTheme3),2.x 仓库封存**
  - 优点:零历史包袱,manifest/构建/依赖完全自由;失败不影响 2.x。
  - 缺点:2.x 用户无法一键升级(要手动装新插件);两仓库共用的引擎代码(scheme-presets、color-utils、settings 面板)靠手动同步;社区认知分裂。

## D2. v1 功能范围

背景:2.x 功能分三类——①配色/取色/亮暗(核心)②界面改造(隐藏 Logo、胶囊侧栏、悬浮底栏、全透明框架、禁用新 UI、评论区样式开关)③2.x 页面专属(推荐页重组、歌名自适应、定位播放、每日推荐日期、歌单页视图切换)。3.1 DOM 全变,②③每一项都要重新验证。

- **A. 最小可用版**:只做 ① + 设置面板,② ③ 全删,设置项同步删减。
  - 优点:最快可用;样式层基线干净;后续按需求逐项加回,每加一项测一项。
  - 缺点:2.x 老用户升级后感知"功能变少";界面改造类卖点(如全透明框架)缺席。
- **B. 全量移植**:①②③ 全部按 3.1 锚点重做后再发布。
  - 优点:功能对齐 2.x;一次性交付完整体验。
  - 缺点:工期最长;③ 里部分功能在 3.1 的对应物可能根本不存在(如推荐页布局已变),有做不成的风险;首版 bug 面大。
- **C. 分层发布(推荐)① + 设置面板首发(等于 A),② 里保留架构上无风险的项(隐藏 Logo、评论区样式开关这类纯 CSS 项),③ 全部砍;② 其余项与 ③ 进入 backlog 按里程碑加回。**
  - 优点:首版快且有亮点的界面项;backlog 里每项都带独立验收,回归风险可控。
  - 缺点:需要维护功能开关矩阵;backlog 可能烂尾(需要自律)。

## D3. 原生外观联动(皮肤/链接)

背景:2.x 用 `overrideNCMCSS()` 改写 #pri-skin-gride/#skin_default 两个 link 的 href + `updateNativeTheme()` 调 `app.loadSkinPackets` 换内置皮肤包,让"客户端原生部分"(右键菜单、滚动条、原生弹层)跟着主题走。3.1 这两个 link 不存在;`app.loadSkinPackets` 存活但签名变为 `(type, name, extra, cb)`(Spike S2 实测语义)。

- **A. 继续驱动原生皮肤**:S2 摸清 loadSkinPackets 新签名后,亮/暗各选一个内置皮肤包加载,失败则静默跳过。
  - 优点:原生弹层/菜单/滚动条自动跟随,视觉一致性最好;不写大量兜底 CSS。
  - 缺点:依赖未公开协议,客户端更新即碎;S2 若证明 3.1 皮肤包机制变化大则此路不通(需二次决策)。
- **B. 完全不动原生,纯 CSS 覆盖**:原生部分保持网易云默认外观,我们只覆盖 web UI。
  - 优点:零协议依赖,最稳;实现最简单。
  - 缺点:原生弹层(右键菜单、部分对话框)与主题割裂;为一致性要写更多覆盖 CSS,且有些原生窗口(CEF 弹窗)根本够不到。
- **C. 混合分级**:CSS 覆盖为主;loadSkinPackets 作为可选实验开关(设置面板加"尝试原生皮肤联动",默认关)。
  - 优点:默认路径稳定,激进用户可开实验项;为未来留了接口。
  - 缺点:多一个设置项和一条实验代码路径的维护成本;实验项效果随客户端版本波动。

## D4. 亮暗模式检测来源

背景:2.x 用 `matchMedia('prefers-color-scheme: dark')` + body class `md-light/md-dark`。3.1 新增了原生接口 `os.isSystemDarkThemeEnabled`,且 3.1 自身有主题设置(Spike S1 找它自己的键控方式)。"auto" 模式跟随谁,直接影响用户体验一致性。

- **A. matchMedia(沿袭 2.x)**
  - 优点:实现零成本;行为与 2.x 完全一致。
  - 缺点:与网易云自身亮暗设置可能不同步(用户在网易云里切了暗色,系统没切,主题跟系统不跟网易云,观感割裂)。
- **B. `os.isSystemDarkThemeEnabled` 原生接口**
  - 优点:原生接口,语义就是系统暗色;在 CEF 内比 matchMedia 更"客户端视角";实现成本与 A 相当。
  - 缺点:本质仍是跟系统而非跟网易云设置;异步 channel 调用需要缓存+重查时机(启动/visibilitychange)。
- **C. 跟随网易云自身主题设置(设置面板里的亮暗选择),读不到再兜底 B**
  - 优点:与客户端 UI 模式永远一致,体验最自然;这是 3.1 场景下最符合直觉的"auto"。
  - 缺点:依赖 S1 的产出,若网易云把模式存在 native 侧而非 DOM/localStorage,则拿不到或拿到的是私有协议;实现与维护成本最高。

## D5. 封面取色锚点

背景:2.x 从 `.m-pinfo .j-cover` 取封面。3.1 播放页已知多个封面 img 候选:vinyl 页 `.cover-container-rotate img`、`#VINYL_COVER_ELEMENT_ID` 容器、`.TrackInfoContainer .cover-container img`。不同页面模式(经典/vinyl/迷你)下可见元素不同。

- **A. 单锚点:只认 `#VINYL_COVER_ELEMENT_ID` 内的 img**
  - 优点:实现最简单;该容器常驻播放页。
  - 缺点:依赖单一 ID,客户端改名即失效;部分播放模式(如迷你模式)下可能取不到,取色停在上一首。
- **B. 单锚点:只认 `.TrackInfoContainer` 封面**
  - 优点:该容器在评论 tab 旁,常规页面结构较稳定。
  - 缺点:同为单一脆弱锚点;切歌瞬间可能仍是旧图(MutationObserver 时机要精确)。
- **C. 多候选链(推荐实现,选项为"确认采用")**:候选数组按序探测 `[#VINYL_COVER_ELEMENT_ID img, .cover-container-rotate img, .cover-area img, .TrackInfoContainer img]`,取第一个"可见且 src 非空"的;MutationObserver + img load 双触发;全部 miss 时保留上次颜色。
  - 优点:抗单一锚点失效;跨播放模式健壮;与现有 `md-dominant-color-change` 机制无缝。
  - 缺点:选择器表需要随客户端版本维护(Spike 持续验证);实现比单锚点多 ~40 行。

## D6. 背景增强(BGEnhanced)

背景:2.x 支持从 BGEnhanced 插件的背景图取色(`updateDynamicColorFromBGEnhanced`)。3.1 生态里 BGEnhanced 是否有 3.x 版未知;同时 3.1 播放页自带封面模糊背景(`#VINYL_COVER_ELEMENT_ID .mask` 后面的图),天然可作取色源。

- **A. 保留 BGEnhanced 钩子**(带 `loadedPlugins['BGEnhanced']` 守卫,装了才生效)
  - 优点:兼容装了 3.x 版 BGEnhanced 的用户;代码几乎原样保留。
  - 缺点:若 3.x 版 BGEnhanced 长期不存在,这段是死代码;其 DOM 选择器 `.BGEnhanced-BackgoundDom .background img` 仍需适配。
- **B. 移除 BGEnhanced,改用 3.1 内置封面模糊背景作取色源**
  - 优点:贴合 3.1 现实(自带背景);不依赖第三方插件生死;"背景增强取色"的体验由内置背景等价实现。
  - 缺点:失去"任意自定义背景图"场景(那本来就要 BGEnhanced);设置里"取色来源"少一项。
- **C. 两者都做**:内置背景作为 `bg-enhanced` 的新语义,BGEnhanced 存在时优先用它。
  - 优点:覆盖面最大;老用户无感。
  - 缺点:两条取色路径都要测;设置项语义变化(来源叫"背景")需要用户理解。

## D7. 设置面板入口

背景:2.x 把设置按钮注入 `header .m-tool .user`(顶栏头像旁)。3.1 顶栏结构完全不同(侧栏顶部 `#page_pc_main_nav` 内有搜索框/头像区)。

- **A. 注入到 3.1 侧栏头像区旁**(`#page_pc_main_nav .Bar_*` / 头像容器附近,含 100ms 重试)
  - 优点:体验与 2.x 一致(头旁一个小按钮);入口显眼。
  - 缺点:锚点是哈希类容器(`Bar_b2jgnke`),需用结构锚点(头像 img 的父级)兜底;3.1 布局紧凑,按钮需精细样式避免挤压。
- **B. 只从 BetterNCM 插件管理页打开**(plugin.onConfig 已有"打开设置面板"按钮,保留即可)
  - 优点:零 DOM 适配成本,永不失效;不侵入客户端 UI。
  - 缺点:入口深(要进插件管理器),日常使用不便;老用户会找不到设置。
- **C. 悬浮按钮**(fixed 定位小圆钮,可拖动/可隐藏设置)
  - 优点:不依赖任何客户端锚点,永不怕改版。
  - 缺点:侵入感强,遮挡内容;与 3.1 设计语言不搭;要处理窗口缩放/全屏模式下的定位。

## D8. 右键菜单染色

背景:2.x hook `channel.call` 拦截 `winhelper.updateMenuItem` 和 `winhelper.popupMenu`,把菜单颜色字段替换为主题主色(`#ff` + BGR hex)。3.1 方法名变为 `winhelper.updateMenu`,popupMenu payload 结构未知(Spike S3)。

- **A. 适配新协议**:S3 摸清 payload 后按新字段名重写 hook,菜单随主题色。
  - 优点:视觉一致性最佳(右键菜单是高频可见面);延续 2.x 完整体验。
  - 缺点:依赖私有 payload 结构,3.1 更新可能静默改变字段;若 payload 是加密/序列化对象(channel 有 serialData/enData 系列方法),逆向成本陡增。
- **B. 放弃菜单染色**:不 hook channel,原生菜单保持默认色。
  - 优点:零风险零维护;hook channel.call 本身有全局性能与稳定性风险(所有调用过一遍我们的函数)。
  - 缺点:右键菜单与主题割裂,是明显可见的不一致点。
- **C. v1 放弃,留 backlog**(hook 代码留桩,设置面板不加开关,S3 产出后 v2 决定)
  - 优点:首版稳定;不关死大门。
  - 缺点:同 B 的短期观感;backlog 项可能不了了之。

## D9. 时间指示器

背景:2.x 在播放条注入 React 组件,读 `time.now`/`time.all` 文本 MutationObserver 计算剩余/总时长,依赖 `.brt`/`.speed` 等按钮算偏移。3.1 播放条结构完全不同(`footer.Container_*`,锚点待 Spike S4)。

- **A. 移植**:S4 找到 3.1 时间元素等价物后改 parentDOM/偏移计算,功能原样(剩余↔总时长点击切换)。
  - 优点:高价值小功能,老用户直接感知;组件逻辑可整体复用。
  - 缺点:3.1 播放条本身可能已有等价显示;依赖 S4 产出;偏移计算对 3.1 布局敏感(响应式重排)。
- **B. CSS-only**:不做注入组件,只对 3.1 原生时间显示做样式统一(字体/颜色)。
  - 优点:零脆弱锚点;工作量极小。
  - 缺点:失去"剩余时长模式"功能本身。
- **C. 放弃**:v1 完全不碰时间显示。
  - 优点:最省。
  - 缺点:同 B 且少一个细节打磨点。

## D10. ripple 点击效果

背景:2.x ripple.js 维护一张 2.x 选择器表决定哪些元素出水波纹。3.1 的按钮体系是 `cmd-button`,且 3.1 自带按压反馈(未知是否已有 ripple 类效果)。

- **A. 适配 cmd-***:重写选择器表(导航项、cmd-button、播放条按钮),保留 JS ripple。
  - 优点:Material You 质感的核心卖点之一;与主题一体。
  - 缺点:选择器表维护成本依旧;若 3.1 原生已有按压动效,叠加可能违和(需实测关掉原生或我们让位)。
- **B. CSS-only 近似**(`:active` 缩放/透明度过渡,全 `cmd-button` 通用)。
  - 优点:稳定、零 JS;覆盖面广(所有 cmd-button 自动生效)。
  - 缺点:不是真 ripple(无扩散动画),质感打折。
- **C. 放弃**(3.1 原生按压反馈已够)。
  - 优点:最省,尊重 3.1 自身设计语言。
  - 缺点:主题个性弱化。

## D11. 列表视图切换器

背景:2.x 在歌单页注入三档密度切换(compact/comfortable/spacious),写 `body[data-list-view]` + styles.scss 控制行高。3.1 歌单页结构/路由未知(Spike S5)。

- **A. 移植**:S5 后找新注入点,行高 CSS 重写。
  - 优点:实用功能;若 3.1 列表行高由 CSS 变量控制则改动很小。
  - 缺点:3.1 歌单页可能是虚拟列表/自绘,行高未必可 CSS 覆盖;S5 结论可能直接判死。
- **B. 放弃**。
  - 优点:省;避开虚拟列表风险。
  - 缺点:功能退档。
- **C. 延后到 v2**(backlog,带 S5 前置条件)。
  - 优点:v1 不背包袱;留评估期。
  - 缺点:同 B 的短期观感。

## D12. 样式文件架构

背景:styles.scss 已 2976 行;3.1 重写后规模相当,组织方式决定可维护性。

- **A. 维持单文件 styles.scss**(内部用注释分区)。
  - 优点:与 2.x 习惯一致;构建零改动;全文检索方便。
  - 缺点:3000 行单文件 diff/协作/定位都痛;分区纪律靠自觉。
- **B. webpack 多入口拆分**(main.js import 多个 scss 模块:variables/base/nav/maintab/songplay/player/overrides)。
  - 优点:模块边界强制化;单文件 300–600 行可读可测;逐模块独立验收。
  - 缺点:构建配置微调;文件数增多;跨模块的层叠顺序要有约定(import 顺序即优先级)。
- **C. 两层架构**:variables.scss(变量+映射)+ pages.scss(其余全部)。
  - 优点:变量层稳定、页面层自由;折中方案。
  - 缺点:页面层仍是巨型文件;没有真正解决 B 要解决的问题。

## D13. 兼容版本范围

背景:manifest `ncm-version-req` 决定插件市场里哪些客户端版本能装;哈希类随版本漂移,范围越宽维护越重。当前实测基线 3.1.39;InfLink-rs 的 hijacks 写的是 `>=3.1.21`。

- **A. 只声明 `>= 3.1.21 < 3.2`**:覆盖当前 3.1.x 线,明确排除未知的 3.2。
  - 优点:诚实反映测试面;3.2 出来时强制做一次适配回归(哈希类/协议可能变)。
  - 缺点:忘更新 range 会导致 3.2 用户装不上(可通过加宽范围解决)。
- **B. `>= 3.1.21` 无上界**。
  - 优点:新版本用户不会被挡;与生态内其他插件(InfLink-rs)行为一致。
  - 缺点:3.2/3.3 若大改,插件带着坏样式继续"能装",破损报告会先于版本墙出现。
- **C. `>= 3.0.0`**:把 3.0.x 也纳入。
  - 优点:覆盖面最大。
  - 缺点:3.0.x 与 3.1.x DOM 可能已有差异,未实测的声明是虚假承诺;不建议。

---

## 14. 一致性检查(2026-09-06 执行完毕)

- 状态:✅ 已执行,**5 项检查全部通过,无冲突**。

| 检查项 | 结果 | 说明 |
|---|---|---|
| ① D2 与 D9/D10/D11 无范围冲突 | ✅ 通过 | D2=C 分层发布;D9=B(CSS-only,属低风险层,与首版一致)、D10=C(放弃,不占 backlog)、D11=C(backlog,与 ③ 处置一致)。三者互相兼容 |
| ② D3 与 D8 对 channel 的立场一致 | ✅ 通过 | D3=C 的实验开关只**调用** `app.loadSkinPackets` 单个方法,不做全局 hook;D8=C 的全局 channel.call hook 留桩不实现。两者机制不同层,无冲突 |
| ③ D4 与 D6 在设置面板语义上不矛盾 | ✅ 通过 | D4 管「亮暗模式来源」(跟随网易云设置),D6 管「取色颜色来源」(封面/内置背景/自定义)。两个下拉各自独立,语义无重叠;D6=B 已将 bg-enhanced 选项改为「播放页背景」 |
| ④ D13 与 D1 发布节奏匹配 | ✅ 通过 | D1=C 新仓库无存量用户,不做版本墙(D13)的连带风险(旧用户装到坏版本)不存在;README 声明测试版本即可 |
| ⑤ spec 中所有【D#】占位符清零 | ✅ 通过 | ADAPT-SPEC.md 已全部更新为「【D#✅】+ 结论」,grep 校验通过 |

- 附带确认(非冲突,记录备忘):
  1. D3=C 实验开关依赖 S2 产出;若 S2 证明 loadSkinPackets 不可用,实验开关标注失效但不影响主线(里程碑 M4)。
  2. D4=C 的「跟随网易云设置」依赖 S1 产出;若 S1 找不到键控方式,兜底路径(原生接口)自动生效,不阻塞 M3。
  3. D2=C 的 backlog 清单与 D9/D10/D11 结论已同步进 ADAPT-SPEC.md §5.5/§6/§7/§11。
