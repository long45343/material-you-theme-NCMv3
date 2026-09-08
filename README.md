# Material You Theme (NCM v3)

BetterNCM/chromatic 主题插件 —— 为网易云音乐 **3.x** PC 客户端带来 Material You 风格的主题，采用Zcode+GLM5.3Flash/Gemini 3.8 Flash辅助开发。

- 基于 [solstice23/material-you-theme-netease](https://github.com/solstice23/material-you-theme-netease)(GPL-3.0)开发,针对 3.x 全新前端重写。
- 换肤原理:3.x 客户端将全部颜色挂在 `html` 元素的全局令牌(`--colorPrimary*` / `--colorBackground` / `--colorSidebar*` 等)上,本插件用 Material You 引擎生成的配色整体重定义这些令牌。
- **仅在 3.1.39 测试通过**,更低/更高版本请自行尝试。

## 预览
<img width="1919" height="1028" alt="屏幕截图 2026-09-08 121124" src="https://github.com/user-attachments/assets/15a4a750-b269-4f7f-a81a-a06c98acc0d6" />
（此处采用固定色主题）
<img width="1919" height="1029" alt="屏幕截图 2026-09-08 121232" src="https://github.com/user-attachments/assets/a6d532d9-dfde-425d-9a2f-8be17256b835" />
<img width="1917" height="1030" alt="屏幕截图 2026-09-08 121243" src="https://github.com/user-attachments/assets/143088a1-27e2-45e7-81c3-a3a20eef8cc8" />
<img width="607" height="889" alt="屏幕截图 2026-09-08 121444" src="https://github.com/user-attachments/assets/7b8ffaad-c7fa-4f3b-9368-173d54744937" />



## 安装
1. 下载release文件夹中的plugin文件放入BetterNCM 数据目录的 `plugins/` 文件夹,重启客户端。

## 手动编译与安装

1. 安装 [BetterNCM](https://microblock.cc/betterncm)
2. 将 `dist` 打包为 `MaterialYouThemeNCMv3.plugin`(zip 格式)放入 BetterNCM 数据目录的 `plugins/` 文件夹,重启客户端

## 构建

```
npm install
npm run build
npm run deploy   # 打包并部署到本地 BetterNCM 插件目录
```

## License

GPL-3.0,详见 [LICENSE](LICENSE)
