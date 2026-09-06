# 构建产物打包为 .plugin 并部署到 BetterNCM(chromatic)插件目录
import os, zipfile
dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist')
data_dir = os.environ.get('BETTERNCM_PROFILE', r'C:\betterncm')
target = os.path.join(data_dir, 'plugins', 'MaterialYouThemeNCMv3.plugin')
if not os.path.exists(os.path.join(dist, 'main.js')):
    raise SystemExit('dist/main.js 不存在,请先 npm run build')
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in ('main.js', 'manifest.json', 'preview.gif'):
        z.write(os.path.join(dist, f), f)
print('已部署:', target)
