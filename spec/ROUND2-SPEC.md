# ROUND 2 — 打磨层 Spec(函数级)

- 版本:v1.0(决策完成)
- 日期:2026-09-06
- 前置:主题本体(令牌换肤 + 深浅模式 + MD3 v1)已上线运行;本层 = 剩余 bug 修复 + MD3 质感深化。
- 决策文件:[ROUND2-DECISIONS.md](ROUND2-DECISIONS.md),文中 `【E#】` 标记引用。

---

## R1. 歌曲列表行:圆角高亮横跨整行

现象:歌单页曲目列表中,行的圆角矩形背景/悬浮高亮只画在「#/标题」列容器上,右侧「专辑/喜欢/时长」列在圆角矩形之外。

### 函数/规则级方案

| 步骤 | 位置 | 内容 |
|---|---|---|
| 1. 发现 | 侦察插件 `probePoint()` | elementFromPoint 命中曲目行两处:标题列中部(x≈500)与时长列(x≈1400),各走 8 层祖先,找两链的**最近公共祖先** = 行元素;dump 行与标题列容器的 class/bg/radius |
| 2. 修复 | `styles/overrides.scss` → `rowHighlight()` 规则组 | 【E1✅ 保留原样】不改触发与配色;实现 = 把原生 hover 背景/圆角从内层容器上移到行元素(行元素必须横跨全部列——由发现步确认),内层改回透明 |
| 3. 回归 | 截图 | 悬浮任意一行:圆角覆盖 # 到 时长 全列;主题色淡染;左右两列文字对比度正常 |

约束:行元素若为虚拟列表片段(滚动回收),背景必须挂在"回收后仍存在"的层级(发现步确认)。

## R2. BetterNCM(chromatic)入口齿轮归位

现象:chromatic 注入的管理器入口按钮悬在图标行下方,未与 ✉/⚙/我们对齐。

| 步骤 | 位置 | 内容 |
|---|---|---|
| 1. 发现 | 侦察插件 `probeBncm()`(已写好,**调用未接线**:`main.js` boot 流程补 `probeBncm();`) | elementFromPoint(1725,72) → 8 层祖先链 + class/rect → 得到按钮选择器与当前定位方式(absolute/static) |
| 2. 归位 | `src/main.js` → `relocateBncmEntry()`【E3✅ JS搬移+守卫】| 按 probeBncm 输出的选择器找按钮节点;插入点 = 我们按钮(`#md-settings-menu-container`)的 nextSibling(✉ ⚙ [我们] [BNCM]),并入重挂守卫;找不到时静默 |
| 3. 样式 | `styles/nav.scss` | 与原生图标同尺寸同基线;hover 与 ⚙ 一致 |
| 4. 顺序 | — | 【E4✅】我们在左,BNCM 在右(✉ ⚙ [我们] [BNCM]) |

约束:chromatic 更新可能改变其按钮结构,`relocateBncmEntry` 必须幂等 + 找不到时静默。

## R3. 我们的入口图标视觉校准

现状:26×26 容器 + 18×18 mask 图标,与原生 `cmd-icon`(font-size 28px 档,视觉约 20px)不一致。

| 步骤 | 位置 | 内容 |
|---|---|---|
| 1. 规格 | `styles/nav.scss` | 【E5✅ 完全对齐原生】盒 28×28、mask 20×20、间距对齐徽章;hover/按下态与 ⚙ 一致 |
| 2. 落地 | 同文件 | 容器/按钮/内层三档尺寸改写;hover 圆形底色与 ⚙ 徽章一致(含按下态) |
| 3. 回归 | 截图 | 与 ✉/⚙ 并排时视觉大小、间距、对齐一致 |

## R4. MD3 重塑层(第二批)

### R4-a 浅色表面分层【E7✅ 白卡+阴影】页面底极浅灰,卡片纯白+elev-1

`styles/variables.scss` + `overrides.scss`:定义 `--md-surface-container`(卡片面)与页面底的梯度关系;卡片阴影已有 elev-1/2,补:页面底色与卡片面的对比规范。

### R4-b 播放页歌词排版【E8✅ MD3 强对比】当前行=主色+1.15x+加粗,非当前=前景55%,行距放宽,两侧渐隐

`styles/songplay.scss`:歌词行颜色(当前行 = 主色/亮前景,非当前行 = 前景 60%)、字阶(当前行放大)、渐隐边缘;作用于 `.TrackDisplayContainer` 区域(3.1 类名,含哈希辅助)。

### R4-c 设置面板预览图更新

`src/settings.js` → `SchemePreview.inner()`:预览小样从"模仿 2.x 布局"改为"模仿 3.x 布局"(顶栏图标行 + 左侧导航胶囊 + 播放条圆点),纯 React 自绘,无客户端依赖;`settings.scss` 对应小样元素样式更新。

### R4 范围【E6✅ a+b】

本轮做 R4-a(浅色分层)+ R4-b(歌词排版);R4-c(面板预览图)延后。**新增 R5(高优)**:动态主题配色异常排查(用户截图待提供)。

---

## 附录:3.1 平台事实增量(本轮新确认)

- 顶栏图标行真实容器:`MiniModeIconBar_m1jn0mly`(MiniModeIconBar 图标区)内为 `cmd-badge` 徽章(inline-block),父级 `IconBar_i1ueu1yn` 为 flex 行;
- 我们的入口:26×26 @(1721,23),`display:inline-flex`,父级 = MiniModeIconBar ✓;
- chromatic 入口按钮:悬于行下方,类名待 probeBncm 输出;
- 原生图标字:`.cmd-icon` font-size 28px 档(顶栏),视觉约 20px;
- 榜单卡:`containerCls_c1t4iqps`,bg=var(--colorFunction2),radius 10px(已映射);
- 环境坑:heredoc 中的 `\n` 会被吃成真实换行——侦察/脚本补丁一律用 `' | '` 或 `chr(10)`;
- MD33Recon v2.1:rankcard/sectioncard 文本锚点探针在懒加载区需滚动触发;probeBncm 已定义待接线。
