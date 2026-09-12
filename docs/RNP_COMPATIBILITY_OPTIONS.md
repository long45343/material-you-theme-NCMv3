# Material You Theme 与 Refined Now Playing Next 冲突解决决策集

> **核心设计准则**：
> **Refined Now Playing Next（RNP）为第三方独立插件，所有兼容、防御与规避方案 100% 仅在当前 Material You 主题插件内部落地实施，严禁任何修改 RNP 源码或重新打包 RNP 的方案。**

---

## 用户决策跟踪表

| 序号 | 冲突点分类 | 选定方案 (100% 纯主题侧) | 状态 | 详细说明 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 底部播放条展开时样式遮挡冲突 | **选项 A：主题端选择器排除放行 (`:not` 排除)** | 已完成 | 在 `player.scss` 中加入 `:not(.rnp-lyric-page-open):not(.mq-playing)`，全屏展开时放行原生底栏推离，退出即刻恢复 |
| 2 | 进度条点击/拖拽误触发全屏 | **选项 B：主题滑块内敛定位 (纯 CSS 兼容最好)** | 已完成 | 将直轨滑块几何收敛在 footer 内（`top: 0`），零 JS、零副作用，彻底消除 RNP 边缘误触 |
| 3 | 播放页 DOM 架构脱钩与后台监听空转 | **选项 B：完全由 RNP 接管 (Bypass)** | 已完成 | 主题对全屏播放页完全放权，关闭针对原生播放页的无效样式和监听，职责严格隔离 |
| 4 | 取色系统与色彩空间割裂 | **选项 A：主题正向桥接统一强调色** | 已完成 | 主题在 `refreshTheme` 时，将自身算出的 MD3 主色同步注入 `--rnp-accent-color` 变量，消除内外色差 |
| 5 | 插件识别标识与加载顺序失效 | **选项 A：主题启动时注入全局兼容别名** | 已完成 | 主题在 `main.js` 启动最早期向 `loadedPlugins['MaterialYouTheme']` 写入别名镜像，一行代码消除误判 |
| 6 | 全局变量 `window.mdThemeType` 篡改 | **选项 A：主题响应式代理防范 (Reactive Setter)** | 已完成 | 主题端使用 `Object.defineProperty` 代理该全局变量，外部直接赋值自动触发主题防抖自愈刷新 |

---

## 冲突点详情与纯主题侧实施细则

### 冲突点 1: 底部播放条展开时样式遮挡
* **实施方案**：在主题 `src/styles/player.scss` 中将 `body.material-you-theme footer` 改为 `body.material-you-theme:not(.rnp-lyric-page-open):not(.mq-playing) footer`。
* **效果**：RNP 全屏打开时，原生 footer 正常被推离视口；退出全屏时，主题的底部圆角悬浮 fixed footer 瞬间恢复。

### 冲突点 2: 进度条点击/拖拽误触发全屏
* **纯主题侧备选方案**：
  * **方案 2-1 (Recommended)：主题 JS 捕获层截断冒泡**
    * 在主题 `src/main.js` 中，为底栏进度条容器（`[class*="StyledSliderContainer_"]` 等）挂载 `capture: true` 的事件监听，在滑块交互时调用 `e.stopPropagation()`，在捕获阶段阻断事件向 `document` 根节点上的 RNP 全局监听器传播，彻底避免触发 RNP 的全屏误判，且 100% 保留主题直轨跨界居中的美感。
  * **方案 2-2：主题滑块内敛定位**
    * 调整主题 `player.scss`，将直轨滑块与感应区的顶部偏移设为 `top: 0`，使其绝对不超出原生 footer 的物理高度。但会轻微影响跨界悬浮的视觉对称性。

### 冲突点 3: 播放页 DOM 架构脱钩与后台监听空转
* **实施方案**：
  * 当检测到启用 RNP 时，主题的 `setupSongplayWatcher` 保持静默，不再对被隐藏的官方 `#page_pc_songplay` 执行高频 MutationObserver 监听，零 DOM 争抢，完全由 RNP 接管正在播放界面的视觉展现。

### 冲突点 4: 取色系统与色彩空间割裂
* **实施方案**：
  * 主题在 `src/main.js` 的 `refreshTheme()` 中，除了设置 `--md-accent-color` 外，同步执行：
    ```javascript
    document.body.style.setProperty('--rnp-accent-color', `rgb(${colors.primary.join(',')})`);
    document.body.style.setProperty('--rnp-accent-color-rgb', colors.primary.join(','));
    ```
  * 使 RNP 全屏界面的所有高亮、歌词聚焦和手柄统一使用主题当前选定的 MD3 配色方案（包括动态方案与 12 款精选预设）。

### 冲突点 5: 插件识别标识与加载顺序失效
* **实施方案**：
  * 主题在 `src/main.js` 最顶部执行：
    ```javascript
    window.loadedPlugins = window.loadedPlugins || {};
    if (!loadedPlugins['MaterialYouTheme']) {
        loadedPlugins['MaterialYouTheme'] = loadedPlugins['material-u-theme-ncmv3'] || { manifest: { version: '3.0.0' } };
    }
    ```
  * 彻底消除 `<body>` 上的 `no-material-you-theme` 误判类名。

### 冲突点 6: 全局变量 `window.mdThemeType` 篡改与状态失步
* **实施方案**：
  * 主题在 `src/main.js` 中将全局属性包装为代理：
    ```javascript
    let _themeType = null;
    Object.defineProperty(window, 'mdThemeType', {
        get: () => _themeType,
        set: (val) => {
            if (_themeType !== val) {
                _themeType = val;
                setThemeType(val); // 外部静默篡改时，主题自动联动重绘自愈
            }
        },
        configurable: true
    });
    ```

---

## 最终决策自洽性与交叉冲突审查报告

| 审查维度 | 检查结果 | 详细结论 |
| :--- | :--- | :--- |
| **纯主题侧原则符合度** | **100% 通过** | 六项方案全部仅在 `material-you-theme-NCMv3` 内部实现，零改动任何 RNP 源码，不需要重新构建 RNP，升级 RNP 不会丢失任何修复。 |
| **底栏行为协同性 (点1 + 点2)** | **完全自洽** | 进度条改用纯 CSS 内敛（`top: 0`），非全屏态下微调绝对不越界触发误判；全屏态下通过 `:not` 自动放行底栏隐藏，二者互不干扰、体验极其丝滑。 |
| **播放页与色彩协同性 (点3 + 点4)** | **完全自洽** | 结构上 Bypass 放权给 RNP（消除无谓监听和 DOM 争抢）；色彩上正向注入 `--rnp-accent-color`，使 RNP 播放页高亮与主程序 MD3 主色 100% 严密统一，达成兼顾性能与质感的最佳平衡。 |
| **底层环境健壮性 (点5 + 点6)** | **完全自洽** | 别名注入（点5）消除了 RNP 对主题未安装的误判；响应式代理（点6）为全局变量提供了防御与自愈机制，即使外部代码静默赋值也能自动触发主题重绘。 |
| **综合可行性评估** | **全部合格 (Ready)** | 六项方案之间无任何逻辑冲突、时序竞争或样式覆盖冲突，技术路线极度稳健，具备立即实施的全部条件。 |

