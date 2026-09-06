# Material You Theme (NCM v3)

BetterNCM/chromatic 主题插件 —— 为网易云音乐 **3.x** PC 客户端带来 Material You 动态取色。

- 基于 [solstice23/material-you-theme-netease](https://github.com/solstice23/material-you-theme-netease)(GPL-3.0)的配色引擎,针对 3.x 全新前端重写。
- 换肤原理:3.x 客户端将全部颜色挂在 `html` 元素的全局令牌(`--colorPrimary*` / `--colorBackground` / `--colorSidebar*` 等)上,本插件用 Material You 引擎生成的配色整体重定义这些令牌。
- **仅在 3.1.39 测试**,不设版本限制,更低/更高版本请自行尝试。

## 安装

1. 安装 [chromatic (BetterNCM)](https://github.com/std-microblock/chromatic)
2. 将 `dist` 打包为 `MaterialYouThemeNCMv3.plugin`(zip 格式)放入 BetterNCM 数据目录的 `plugins/` 文件夹,重启客户端

## 构建

```
npm install
npm run build
npm run deploy   # 打包并部署到本地 BetterNCM 插件目录
```

## License

GPL-3.0,详见 [LICENSE](LICENSE)
