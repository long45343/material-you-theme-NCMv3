# HANDOFF — 新会话交接(2026-09-07)

## 项目一句话

BetterNCM/chromatic 主题插件 `MaterialYouThemeNCMv3`,为网易云 **3.1.39** 带来 Material You 动态取色。**核心机制:网易云 3.1 把全部颜色(81 个 `--color*` 令牌)挂在 `<html>` inline style 上,本插件用 MD3 引擎配色以 `!important` 在 html 重定义这些令牌实现全局换肤。**

- 仓库:`D:\EDCs\code\material-you-theme-NCMv3`(remote: github.com/long45343/material-you-theme-NCMv3,已推送)
- 数据目录:`C:\Users\Manet_Kirby\Documents\betterncm`(环境变量 BETTERNCM_PROFILE)
- 完整规格:`spec/ADAPT-SPEC.md`(v1.0,含第一轮 E1-E13 决策)、`spec/ROUND2-SPEC.md` + `ROUND2-DECISIONS.md`(本轮 E1-E8)

## 已验证可用(不要动坏)

1. 令牌层换肤:`theme-tokens.js` — `--color*` 81 个 + `--reset-*` 31 个双层令牌全部映射,深浅双模式;
2. 动态取色:多候选封面链(播放条小封面 `#page_pc_mini_bar img` 为首位)+ Celebi/Score;
3. 亮暗 auto:监听 html style 属性、读 `--colorBackground` 亮度 = 跟随网易云自身亮暗(网易云 web 层没有深色模式,酷炫黑皮肤不改令牌);
4. 设置面板:顶栏图标行按钮(onConfig 兜底)、22 预设、取色来源;
5. 皮肤切换按钮隐藏;BNCM 卡片暗色兜底;红心徽标主题化;E7 浅色分层(页面底微灰+白卡)。

## 当前 HEAD 状态(96b51cc,已推送)——回滚版

最后一轮引入了两个回归,**已回滚**:

- ~~refreshTheme 内 dispatch md-dominant-color-change~~ → 每次切换触发 18 个方案预览组件全量重算 = 切主题卡顿严重;
- ~~relocateBncmEntry 搬移 chromatic 音符按钮~~ → 该按钮是 **React 管理的节点**,JS 搬移引发 React 协调冲突 → **首次启动崩溃,二次启动 localStorage 损坏主题被重置**。

回滚后状态:稳定,但 chromatic 音符入口回到行下方原位(未归位)。**待办第一项:验证回滚版连续两次冷启动不崩溃、主题设置保留。**

## 下一步工作清单(按序,均未开始)

1. **回归验证**:杀进程 → 冷启动 ×2,确认无崩溃、scheme 保留(localStorage 键 `material-you-theme-scheme`);
2. **R1 行高亮横跨整行**(E1 保留原样/E2 纯 CSS 上移):发现步 = recon elementFromPoint 命中歌单页曲目行标题列(x≈500)与时长列(x≈1400)各走祖先找公共行元素;然后 CSS 把 hover 背景/圆角从内层上移到行元素;
3. **BNCM 入口归位改走 E3-B 纯 CSS**(禁用 JS 搬移!React 节点):先探针拿音符按钮 rect(上次 miss,需先弹窗让用户把窗口摆好或改用遍历搜 `title="BetterNCM"`——它有这个 title),然后 `position:fixed` 对齐图标行高度;
4. **R4-b 歌词 MD3 强对比**(E8):`.TrackDisplayContainer` 区域,当前行主色+1.15x+加粗;
5. **R5 验证**:用户复现"普通主题→动态主题"路径,确认配色正常(根因 `mdActivePreset` 残留已修,commit 0678567)。

## 环境坑(新会话必读,全部踩过)

1. **heredoc 里的 `\n` 会被吃成真实换行** → 侦察脚本字符串一律不用 `\n`(用 `' | '`),python 写文件用 `chr(10)` 或先替换;
2. **taskkill 可能静默失败**(输出被重定向看不到"拒绝访问")→ 杀完必须 tasklist 验证进程数=0 再部署,否则单实例导致"重启"无效、旧插件继续跑;
3. **Compress-Archive 的 zip chromatic 解不了** → 部署用 `scripts/deploy.py`(python zipfile);
4. **部署顺序**:先 taskkill → 再 deploy(.plugin 被运行中客户端锁住)→ 再启动;
5. **侦察插件改补丁必翻车**(多层转义)→ 改用 Write 全量重写,改完必须 `node --check`;
6. **React 管理的 DOM 节点不能 JS 搬移**(协调冲突→崩溃),自建节点要带重挂守卫;
7. 令牌改动跑 `/tmp/tokentest.mjs` 风格的单测(node 直跑 buildTokenCSS 双模式)。

## 侦察工具

- MD33Recon v2.1(源码 `material-you-theme-netease/.reversing/MD33Recon/`,部署在数据目录 plugins/)。
- v2.1 是精简版:boot/meta/probeBncm(DOM 搜 bncm|betterncm)。**已知缺口**:probeBncm 的调用接线已修但当时没重启验证;音符按钮的类名搜索落空(它无 bncm 类名,改用 `title="BetterNCM"` 或坐标探针)。
- 用户模式:**视觉验证由用户截图完成,需要用户操作时用 PowerShell MessageBox 弹窗提示**。
