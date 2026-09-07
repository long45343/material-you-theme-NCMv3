# 第二轮操作清单与决策记录(ROUND2-FIX-CHECKLIST)

> 使用方式同第一轮(docs/FIX-CHECKLIST.md):决策即时记录到"决策日志",全部完成后做一致性检查。
> 本文件自包含。范围:①切换主题卡顿(新问题,工作项 E);②BNCM 音符按钮归位(第一轮既定 D1-A,工作项 D)。
> 创建时间:2026-09-07。第一轮结论:bug#1 修复生效、5 启动零崩溃、bug#3 未复现,用户截图兜底确认。

---

## 0. 卡顿根因分析(静态证据链,待 E1 可能的量化确认)

**切换方案时的完整时序**(设置面板内点击一个方案):
1. `MDSettings.setScheme` → `this.setState({scheme})` → **整个面板重渲染**(settings.js:36-40,无 memo):18 个 SchemeItem × 每个 SchemePreview ~30 个 div ≈ **550+ vdom 节点**重渲染;激活态卡片切换又触发其 `transition: all .25s`。
2. `applyScheme(name)`(main.js:264)→ 类切换 → `setThemeType` → `refreshTheme()`:
   - `updateDynamicTheme()` → `getThemeCSSFromColor()` —— **完整 MD3 引擎计算**(main.js:168);
   - `getActiveColors()` → `getThemeCSSFromColor()` **再来一遍**(main.js:184)—— **每次切换双算**;
   - `tokenStyleController.innerHTML = buildTokenCSS(...)` —— html 上 81+31 个令牌整体替换;
   - `updateAccentColor ×4` —— body 上 8 个 `--md-accent-*` 自定义属性更新(CSS 变量变化使其全部使用者失效重算);
   - 两个 `<style>` 的 innerHTML 替换 + body 类 + body 内联样式 → **全文档样式重算**(89 个变量级联,不可避免,但只应发生一次重算而非多次);
3. **过渡重绘风暴(主嫌)**:令牌变化后,以下元素全部进入 200-300ms 颜色过渡同时连续重绘:
   - `body`(base.scss:5 `background-color .3s`;base.scss:18-21 body+footer+.cmd-button `.25s`);
   - **所有卡片** overrides.scss:10-16:`[class*="StyledRankCard"], [class*="CardWrapper"], [class*="WrapperCard"], [class*="containerCls"]` → `background-color .2s + box-shadow .2s`(首页/歌单页几十张卡,box-shadow 过渡=大面积阴影重绘,代价最高);
   - 设置面板内 ~16 处 `transition: all .25s/.3s`(按钮、面板开合 height/opacity .4s、18 个方案项名称与指示点、预览卡 transform)——面板开着切换时全部参与。
4. 附带(换歌路径,同族问题):每次切歌 `md-dominant-color-change` 触发 **6 个 DynamicSchemeSet 各自全量跑一遍引擎**(settings.js:158-172,`removeEventListener` 传了新箭头函数导致实际永不解绑),这是"切歌卡"的独立来源。

**成本判断(假设,待量化)**:(b) 过渡重绘 > (c) 面板重渲染 > (a) 全文档重算(固有,每次必付一次)> (d) 引擎双算(毫秒级但白付)。其中 (a) 无法消除只能保证只算一次,(b)(c)(d) 均可修。

---

## 工作项 E:切换主题卡顿修复

### E1 决策点:修复路径 —— 先量化还是直接修 ✅ → **选 A:先量化再修**(recon v2.3 性能探针先行,数据定主攻点)(2026-09-07)
- **A(推荐)先量化再修**:recon v2.3 加性能探针——`PerformanceObserver('longtask')` + applyScheme/refreshTheme 分阶段计时(引擎计算/innerHTML/类切换)→ `md33recon-perf.txt`;用户复现"打开面板点几个方案"后读数,按数据定主攻点。
  - 优:数据驱动,知道 (b)(c)(d) 各占多少,修完有 before/after 对比;符合本项目"recon 先行"的既有方法论。
  - 劣:多一轮"复现→读数"往返(用户配合成本约 2 分钟)。
- **B 直接修**:按静态分析同时落地 E2+E3(双算+过渡),一次构建后靠体感验证。
  - 优:最快,少一次往返。
  - 劣:若体感无改善,不知道主因是否打中;before/after 无量化对比。
- **C 混合**:先直接修 E2+E3(低风险高确定性),构建后 recon 带上性能探针,体感仍差再看数据。
  - 优:兼顾速度与兜底。
  - 劣:同一构建引入两个变量,若探针数据显示异常归因稍难。

### E2 决策点:引擎双算消除 ✅ → **选 A:全局 memoize**(按 (sourceColor, schemeName) 缓存;取色来源切换/自定义颜色改色时必须清缓存)(2026-09-07)
- **A(推荐)全局 memoize**:`getThemeCSSFromColor` 按 `(sourceColor, schemeName)` 加一层 Map 缓存,入参不变直接返回上次结果。
  - 优:一处改动同时覆盖"切换双算"和"换歌 6× 预览重算"(换歌时 color 不变,6 个方案全部命中缓存);切歌卡顿顺带缓解。
  - 劣:需注意缓存失效点——取色来源切换(cover/bg-enhanced/custom)与自定义颜色修改时必须清缓存,漏掉会出"颜色不更新"的诡异 bug。
- **B 仅合并计算**:refreshTheme 内把 updateDynamicTheme 与 getActiveColors 合成一次计算,结果复用。
  - 优:改动最小、无缓存失效风险。
  - 劣:只省切换路径的双算,换歌 6× 重算不动。
- **C 两者都做**:合并 + memoize。
  - 优:覆盖最全。
  - 劣:E2-B 的收益被 A 完全覆盖,B 变成无意义重复;不推荐。

### E3 决策点:过渡策略(主嫌 (b)) ✅ → **选用户自定义变体:按钮渐变 + 其余瞬变**(2026-09-07)
- **改瞬变**:body 背景(base.scss:4-6)、footer(base.scss:17-22 中 body/footer 两项)、**所有卡片** bg+box-shadow 过渡(overrides.scss:10-16,风暴主力);
- **保留渐变**:`.cmd-button`(全部原生按钮:播放条三键/顶栏图标/列表按钮,几十个小元素,每帧代价可忽略)+ 设置面板内部小元素规则(非主嫌,不动);
- 实施注意:删除 base.scss 两条规则中的 body/footer 选择器、保留 .cmd-button;删除 overrides.scss 卡片 transition 行(box-shadow 静态值仍由 md-elev 提供,仅失去渐变);
- 已向用户解释重绘机制(浏览器本就不画屏外元素;卡顿源于可见大元素 18 帧连续重绘,而非屏外内容)。
- **A(推荐)切换期临时禁用**:applyScheme 时给 body 加 `.md-switching`(`* { transition: none !important }` 或至少覆盖大表面+卡片+面板),2 个 rAF(或 ~350ms)后移除;日常 hover/开合动画全部保留。
  - 优:直接消灭"切换期重绘风暴"且不牺牲日常质感;业界标准做法;卡片 box-shadow 过渡在日常仍生效。
  - 劣:需要时序控制(加类→强制 reflow→换令牌→延迟移除),实现要小心"`transition:none` 未生效前令牌已换"的竞态(先加类→force reflow→再写 innerHTML 可解)。
- **B 全部去掉**:删除 base.scss 两处 + overrides.scss 卡片过渡,切换瞬变。
  - 优:最简单、零竞态。
  - 劣:失去切歌/亮暗切换时的渐变质感(这正是 6d91769 特意加的);hover 之外的大面变化变硬切。
- **C 只留小元素**:大表面(body/footer/卡片)全去,仅 .cmd-button、列表行等小元素保留过渡。
  - 优:折中——大面硬切但小交互仍有质感;无时序竞态。
  - 劣:切歌时大面(背景、卡片)仍是硬切,观感突兀;需逐条梳理现有规则,梳理成本中等。

### E4 决策点:面板重渲染优化(嫌疑 (c)) ✅ → **选 A:暂不动,等 E1 数据**(若探针显示 React 渲染占比显著,再回来做 memo 化)(2026-09-07)
- **A(推荐)暂不动,等 E1 数据**:550 vdom 的重渲染在现代机器约几 ms~十几 ms,很可能不是主因;若 E1 量化显示 React 渲染占比高再回来修。
  - 优:避免过度工程;面板代码(settings.js)是 2.x 移植的,改动风险与收益不成比。
  - 劣:若数据表明面板渲染占大头,本轮要多跑一次。
- **B memo + 稳定回调**:SchemeItem/SchemePreview 用 React.memo,setScheme 链全部 useCallback/useMemo 化。
  - 优:点击只重渲染新旧两个激活项,渲染成本降一个量级。
  - 劣:settings.js 结构性改动;props 里有 `scheme.palette` 对象引用,需一并稳定化,漏一处 memo 全部失效。
- **C 状态下沉**:激活方案名放 Context/各 item 自管,点击只动两个组件。
  - 优:渲染最省。
  - 劣:重构最大,与"先稳定"原则冲突,风险高。

---

## 工作项 D:BNCM 音符按钮归位(基于 chromatic 源码的修订版)

### 关键源码事实(2026-09-07 读 chromatic/js-framework `plugin-manager/index.tsx`)
- 音符按钮 = **原生 ⚙ 设置按钮的 `cloneNode`**(`.cmd-icon-setting, a[href="#/m/setting/"]`),vanilla JS `settingsButton.parentElement.appendChild(...)` 插在 **⚙ 同一父容器、紧跟其后**;
- 它**不受 React 管理**(vanilla 注入,点击为 vanilla addEventListener)——纯 CSS 移动其视觉位置安全,点击不受影响;
- `title="BetterNCM"`、`href="javascript:void(0)"`,类名继承自 ⚙ → **E3 的 `.cmd-button` 渐变白名单自动覆盖它**;
- 它掉到第二行是 **⚙ 父容器的布局问题**(flex-wrap/容器过窄),非其原生位置"天生在下面";
- chromatic 的 `showSettings()` 用 `display:none !important` 隐藏主页面(它已考虑主题插件 !important 冲突),与我们的令牌换肤无冲突。

### 修订后的技术路线(取代第一轮 D1-A 的 fixed+坐标方案)
1. ⬜ recon v2.3(与 E1 性能探针同一次部署)增加布局转储:⚙ 按钮 + 音符按钮各自 rect、⚙ 的 parentElement 的 tag/class/computed display·flexWrap·width;
2. ⬜ 依据数据选择并实现 CSS 归位(决策 D-rev);
3. ⬜ 验证:最大化/还原窗口、徽章数变化、切页后对齐保持。

### D-rev 决策点:归位实现方式 ✅ → **选 A:纯 CSS 布局修正**(依据 recon v2.3 布局数据写规则;fixed+坐标仅作失败兜底)(2026-09-07)
- **A(推荐)纯 CSS 布局修正**:依据 recon 数据对 ⚙ 父容器/克隆写一条布局规则(如父容器 `flex-wrap:nowrap` 或克隆 `flex-shrink` 调整),让兄弟节点自然排回同一行。
  - 优:零 JS、零坐标、零漂移;不受窗口/徽章变化影响(布局自动跟随);最贴合"严禁碰 React 节点"约束。
  - 劣:依赖 recon 数据先落地;若父容器布局有意外约束(固定宽度等),可能需要换具体规则再试一轮。
- **B 原方案 fixed+坐标变量**(第一轮 D1-A):JS 读 rect → CSS 变量 → position:fixed;重算时机按 D5。
  - 优:不依赖父容器布局,强制摆放。
  - 劣:JS 参与 + 漂移风险 + 需要 D5 的重算机制;既然已知克隆与 ⚙ 同容器,B 的必要性大降。
- **C A 失败后的兜底**:A 的 CSS 尝试(最多两三条规则)都不奏效时,回落到 B。
  - 优:进可攻退可守。
  - 劣:两步走,周期略长。

---

## 发布与验证(E+D 的组合方式)

### Q6 决策点:发布节奏与验证 ✅ → **选 A:探针波 + 修复波**(2026-09-07)
- **第一波(探针波)**:仅部署 recon v2.3(性能探针 + 布局转储),用户复现卡顿与切页,取 baseline;
- **第二波(修复波)**:E2+E3+D-rev 同一构建发布,对比 before/after 数据 + verify 探针 + 用户体感截图。

---

## 决策日志

| # | 决策点 | 选项 | 状态 | 时间 | 备注 |
|---|--------|------|------|------|------|
| E1 | jank 修复路径 | **A** 先量化再修 | ✅ 已决策 | 2026-09-07 | recon v2.3:longtask + applyScheme 分阶段计时 → md33recon-perf.txt;用户复现后读数 |
| E2 | 引擎双算消除 | **A** 全局 memoize | ✅ 已决策 | 2026-09-07 | 缓存键 (sourceColor, schemeName);失效点:取色来源切换、自定义颜色、封面主色更新 |
| E3 | 过渡策略 | **用户变体** 按钮渐变+其余瞬变 | ✅ 已决策 | 2026-09-07 | 删 body/footer/卡片过渡;保留 .cmd-button 与面板小元素;卡片阴影静态值保留仅失渐变 |
| E4 | 面板渲染优化 | **A** 暂不动等数据 | ✅ 已决策 | 2026-09-07 | 若 perf 数据显示 React 渲染占比显著 → 回来做 memo+稳定回调(B 方案) |
| D5 | ~~rect 重算时机~~ → 已被 D-rev 取代(读到 chromatic 源码:克隆按钮与 ⚙ 同容器) | — | 🔄 转为 D-rev | 2026-09-07 | 原 A/B/C 选项作废;fixed+坐标方案仅作 D-rev 兜底 |
| D-rev | 归位实现方式 | **A** 纯 CSS 布局修正 | ✅ 已决策 | 2026-09-07 | recon v2.3 布局转储先行;fixed+坐标仅作兜底(D-rev C 路径) |
| Q6 | 发布节奏与验证 | **A** 探针波+修复波 | ✅ 已决策 | 2026-09-07 | 波1=recon v2.3 baseline;波2=E2+E3+D 同构建,对比验证 |

## 一致性检查(2026-09-07 全部决策完成后执行)

1. ✅ **E1=A 与 Q6=A 组合自洽**:探针波(recon v2.3,含性能探针+布局转储)→ 修复波(E2+E3+D-rev 同构建)。baseline 在修复前取得,对比有效;无冲突。
2. ⚠ **原"E3=.md-switching 与 E4 联动"检查项作废**:E3 最终采用用户变体(永久删除大表面过渡,非切换期临时禁用),不存在 `.md-switching` 时序;面板小元素过渡保留,故 perf 数据中 React 渲染成本仍可观测,E4=A(等数据)的判断路径不受影响。
3. ✅ **E2=A(memoize)缓存失效点必须覆盖三条路径**:①取色来源切换(settings.js:441 setDynamicThemeColorSource → 会触发 updateDynamicTheme + dispatch);②自定义颜色修改(settings.js:453-459);③封面主色更新(main.js:367 updateDynamicColorFromCover)。实施时在 `window.mdCoverDominantColor`/`mdDynamicThemeColorSource`/`mdCostomDynamicThemeColor` 三者任一变化处清缓存——最稳妥做法:缓存键里纳入这三个输入,天然失效,无需手动清。
4. ✅ **D-rev=A 与 recon v2.3 合并**:布局转储(⚙ parent 的 computed display/flexWrap/width + 两按钮 rect)并入性能探针同一次 recon 部署,一次波次两个产出。
5. ✅ **E3 白名单对音符按钮的自动覆盖**:克隆按钮类名继承自原生 ⚙,属 cmd-button 系;即使个别类名缺失也不影响决策(仅渐变观感,非功能)。
6. ✅ **三处修复改动互不耦合**:E2 在 main.js(引擎缓存)、E3 在 styles(删规则)、D-rev 在 styles(nav.scss 一条布局规则)——同一构建发布但可独立 revert,符合 Q6=A 的前提。
7. ✅ **禁令复查**:D-rev=A 全程零 JS、零 DOM 结构干预,满足"严禁 JS 搬移/插入 React 节点"的最高约束。

**结论:6 项决策(E1/E2/E3/E4/D-rev/Q6)组合自洽,无冲突。执行顺序:探针波 → 读 baseline → 修复波 → 对比验证。**

## 插曲:BNCM 原生层损坏事件(2026-09-07 02:34-02:58,探针波期间)

### 时间线
| 时刻 | 事件 | 证据 |
|------|------|------|
| 01:38-02:34 | 用户正常使用约 1 小时(切方案多次) | verify 17:38Z |
| 02:34:48 | /F 强杀 → 换装 recon v2.3 → 启动:插件跑起来(recon 写出 meta 02:34)但 ~10s 后进程死 | meta.json 02:34 |
| 02:37:36 | 二次启动:存活,但探针零输出(框架 JS 未执行);后死亡 | running=0 |
| 02:42 | 纯主题(移除 recon)启动:进程稳定 3min+ —— **但事后确认 UI 是原版,插件 JS 其实也没跑** | 截图 |
| 02:46 / 02:50 | recon 归位后的启动:先存活后崩,弹 "BetterNCM Crashed!" 对话框 | 用户截图 |
| 02:58 | 清空 plugins_runtime 重建 + 干净重启:解压正常、进程稳定,**框架 JS 仍不运行,界面原版** | boot.txt 依旧陈旧 |

### 崩溃签名(native 层,与插件 JS 无关)
- 签名 A:`MSIMG32.dll`(网易云目录,BNCM 的 DLL 代理注入层)`CxxThrowException` → libcef → 未捕获;每次错误码不同(ACCESS_VIOLATION 0xC0000005 → UNKNOWN 3765269347);
- 签名 B:`RtlSleepConditionVariableCS/RtlEnterCriticalSection` 上的 ACCESS_VIOLATION(cloudmusic.dll 自有线程同步代码);
- BNCM 官方崩溃报告器自己归因 "可能的出现问题的插件: **Unknown**";
- dllmain.cpp 的 catch 即弹此对话框并宣布 "BetterNCM 将不会运行" → **此后进程活着但永远是原版界面**(与观察一致)。

### 排除项(已逐一验证)
- ✗ recon v2.3 zip 损坏:testzip OK、manifest 完整、02:34 那次成功运行过其 JS;
- ✗ 解压产物损坏:清空 plugins_runtime 后重建仍复现;
- ✗ 配置禁用:`cpp_side_inject_feature_disabled` 全程为 "false";
- ✗ 主题插件 JS:第一轮 5 次启动零崩溃;崩溃栈无任何 JS 帧;官方归因 Unknown。

### 结论(修订:用户"查探针冲突"的怀疑部分成立)
1. **bug#3("要两次才能打开")根因在 chromatic/网易云原生层**(注入钩子/插件加载路径的 C++ 异常 + 线程同步 AV),非本插件 JS——第一轮清创修的是 bug#1,而 bug#3 的"设置丢失"是这类原生崩溃的 LevelDB 连带损伤;
2. **recon v2.3 的热路径写盘是 02:34 后连串故障的首要诱因(高度疑似)**:v2.3 在每次令牌提交(切方案/切歌/亮暗切换)时立刻写 perf.txt,启动期令牌连续提交 → 写盘突发 → 踩中原生 API 层线程同步 bug(崩溃签名 B 正是同步原语上的 AV)。证据链:v2.3 在场 0/4 稳定 / v2.2 节奏 5/5 正常 / 移除 recon 后框架与主题立即恢复 / v2.3 zip 与解压产物逐字节完好(排除包损坏,坐实"运行时行为"诱因);
3. 插件 JS 无法直接 AV 原生内存——冲突面是"高频并发写同一文件"经由 BNCM 本地 API 触发原生层缺陷;
4. **规避 SOP**:强杀后等 ≥8s 再启动、不并发多开、探针类工具禁止在事件热路径上写盘。

### 修复:recon v2.4(2026-09-07 03:16 部署,验证通过)
- perf/error 只进内存缓冲:perf 每 60s 或启动后 25s 统一落盘,error 5s 防抖;布局转储一次性;
- 部署后:boot/verify/perf 全部即时产出,按钮 FOUND 1.0s,主题正常,**进程稳定**——事故关闭。

### 待办(环境恢复后)
- ⬜ 重启机器(清 Defender/句柄/socket 状态)→ 验证 BNCM 框架恢复(boot.txt 变新 + 主题出现);
- ⬜ 若重启后仍原版:用 BNCM Installer 重装 chromatic;
- ⬜ 恢复后继续探针波(E1 baseline → 修复波)。

## 验证记录(执行时填写)

| 步骤 | 结果 | 证据 | 备注 |
|------|------|------|------|
| 探针波(v2.4) | ✅ 2026-09-07 03:16 部署,按钮 FOUND 1.0s,主题正常 | boot/verify/perf 全部即时产出 | v2.4 关闭热路径写盘事故 |
| **E1 baseline** | ✅ **典型一次方案切换 = longtask 60-75ms + 4-12 个 >25ms 帧间隙(最大 58-103ms)**;重切换 107-113ms;连点同方案时出现无变更轻切 | md33recon-perf.txt(19:19:08-31,21 次点击) | 60fps 下每次切换冻结 4-6 帧 = 用户体感卡顿;另:一次点击可产生 2-3 次令牌提交(auto 方案的双提交路径) |
| D-rev 布局数据 | ✅ ⚙ 父容器 BadgeWrapper **固定宽 40px**(display:block),BNCM 克隆(28×28)同容器装不下被挤到下一行(y=49 vs y=26) | md33recon-bncmlayout.txt | CSS 修法:含 `[title="BetterNCM"]` 的 wrapper 放开宽度 |
| 修复波部署 | ✅ 2026-09-07 03:24-03:31(迭代 3 次) | verify:按钮 FOUND 1.0s;主题正常 | E2+E3 首次部署即生效:启动期帧间隙 114ms → 32ms |
| E1 二期打点 | ✅ 插件 JS 全程 **0.3~0.5ms**(React/引擎/令牌/accent);58~65ms longtask = Chromium 全文档重算+重绘(固有);**切歌实际 151ms+157ms 帧隙,被封面动画感知掩盖** | meta.json stageStats + perf.txt | 用户澄清:卡顿指动画掉帧,颜色晚变可接受 |
| E3b body 渐变 | ✅ 已恢复部署,实测帧数据与无渐变轮相同(无恶化) | 03:40/03:49 两轮 perf | 用户要求 |
| E4-B 面板 memo | ✅ 已部署生效(useCallback×1/useMemo×3 在 dist),longtask 纹丝不动 → **证实面板渲染非主体** | dist grep + 19:53 轮 perf | 保留(点击正确性+未来收益) |
| E1 三期 content-visibility | ⛔ **已撤回**:预估尺寸(170×200)与实际不符 → 视口临近震荡,首页闲置时界面抖动(播放进度条每秒更新放大循环);掉帧收益(2~4→1~2)不抵副作用。若重试需按页面/容器精确圈定并校准 intrinsic-size | perf.txt 20:09 轮(数据仍有效)+ 用户抖动报告 | 12:36 撤回部署,验证通过 |
| E3c 合成器背景淡出 | ✅ 用户澄清卡顿=动画帧率(180Hz 屏上渐变只跑 50-60fps):body 瞬变 + #md-bg-fader(旧背景色)opacity 1→0 合成器交叉淡出,主线程停顿不再影响丝滑度;切歌着色同样受益 | 用户目测通过("可以了") | 替代 E3b;CEF 91 无 View Transitions,双容器 opacity 是唯一合成器化路径 |
| D-rev 归位 | ✅ 03:30 版本生效:BNCM 克隆 x=1189,y=26(与 ⚙ 同行;此前 y=49 第二行) | bncmbtn.txt + 放大截图(✉ ⚙ [BNCM] [我们] 同行等距) | 迭代:①`:has()` 失效——CEF 91 不支持,整条规则被丢;②克隆缩 20px 仍换行——容器宽随徽章 20↔40 波动;③终版 = wrapper 提 relative + 克隆绝对定位锚右外 22px |
| D-rev 顺序说明 | 克隆落在 ⚙ 与我们按钮之间(✉ ⚙ [BNCM] [我们]),非 E4 理想序 [我们][BNCM] | 截图 | 纯 CSS 无法重排 React 兄弟节点;同行目标已达成,顺序调整须用户拍板 |
