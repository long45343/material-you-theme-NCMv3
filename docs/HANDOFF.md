# HANDOFF — 新会话交接(2026-09-07,第二轮完成后)

## 项目一句话

BetterNCM/chromatic 主题插件 `MaterialYouThemeNCMv3`,为网易云 **3.1.39** 带来 Material You 动态取色。**核心机制:网易云 3.1 把全部颜色(81 个 `--color*` 令牌)挂在 `<html>` inline style 上,本插件用 MD3 引擎配色以 `!important` 在 html 重定义这些令牌实现全局换肤。**

- 仓库:`D:\EDCs\code\material-you-theme-NCMv3`(remote: github.com/long45343/material-you-theme-NCMv3)
- 数据目录:`C:\Users\Manet_Kirby\Documents\betterncm`(环境变量 BETTERNCM_PROFILE)
- 决策与验证记录:`docs/FIX-CHECKLIST.md`(第一轮)+ `docs/ROUND2-FIX-CHECKLIST.md`(第二轮,含 BNCM 原生层事故与打点结论)——**新会话先读这两个文件**

## 已验证可用(不要动坏)

1. 令牌层换肤:`theme-tokens.js` — 81 令牌 + 31 reset 双层;**getThemeCSSFromColor 有 E2 缓存(键=取色色值|方案名,自然失效)**;
2. 动态取色多候选链(播放条小封面首位);
3. 亮暗 auto 跟随;
4. 设置面板:顶栏图标行按钮 + **E4-B 面板 memo**(DynamicSchemeSet 家族比较器 + SchemeItem memo——改面板代码时注意保持 props 引用稳定,否则 memo 全部失效);
5. **BNCM 音符按钮已纯 CSS 归位**(nav.scss:克隆按钮 absolute 锚在 ⚙ 的 BadgeWrapper 右外 22px;CEF 91 不支持 :has(),别用);
6. **E3c 背景渐变走合成器**:body 颜色瞬变 + `#md-bg-fader`(旧背景色层,base.scss)opacity 1→0 交叉淡出——切方案/切歌的背景渐变在合成线程跑满 180Hz。**不要改回 background-color 过渡**(主线程绘制,高刷屏锁 50-60fps);
7. **E3 过渡策略**:仅 body(瞬变,靠 fader 渐变)与 .cmd-button 保留 transition;卡片家族已加 `content-visibility: auto`(视口外跳过重算/绘制)。

## 性能结论(第二轮打点实测,勿重复劳动)

- 插件 JS 每次切换全程 **0.4ms**(refreshTheme 阶段打点 → window.__mdStageStats,recon meta.json 转储;探针 perf.txt 记 longtask/rAF 间隙);
- 切方案剩余 ~55-60ms 停顿 = **Chromium 全文档样式重算+绘制,固有成本**,content-visibility 已把掉帧压到 1~2 个(多次零掉帧);
- 切歌实际 151ms(取色量化 + 换肤),被封面动画掩盖,用户不感知——别"修"它。

## 事故教训(BNCM 原生层,详见 ROUND2 文件"插曲")

- **禁止在事件热路径上写文件**(recon v2.3 教训:每次令牌提交都写盘 → 写盘突发踩中 BNCM 原生层线程同步 bug → 连环崩溃/原版启动);探针类工具一律内存缓冲+定时统一落盘;
- **杀进程后等 ≥8s 再启动、不并发多开**(多实例 remove_all 竞争是 chromatic 已知崩溃源);
- 探针/侦察件:MD33Recon v2.4.1(源码 `material-you-theme-netease/.reversing/MD33Recon/`,deploy = python 打 zip 到 plugins/)。

## 环境坑(仍然有效)

1. heredoc 里 `\n` 会被吃成换行 → 侦察脚本字符串不用 `\n`;
2. taskkill 可能静默失败 → 杀完必须验证进程数=0(PowerShell `@(Get-Process ...).Count`,**tasklist+grep 计数不可靠**);
3. zip 部署用 `scripts/deploy.py`(python zipfile),不用 Compress-Archive;
4. 部署顺序:taskkill → 等 8s → deploy → 启动;
5. React 管理的 DOM 节点禁止 JS 搬移;自建节点带重挂守卫;
6. CEF = **Chromium 91**:`:has()` 不可用(整条规则会被丢弃),View Transitions 不可用。

## 下一步(第三轮)

用户将进行 **UI 调整**(具体需求待用户提出)。动手前建议先读 ROUND2 文件的"性能结论"——任何 UI 改动都别引入大表面颜色过渡或热路径写盘。
