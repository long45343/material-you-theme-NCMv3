# 构建产物打包为 .plugin 并部署到 BetterNCM(chromatic)插件目录
import os, zipfile, glob
dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist')
data_dir = os.environ.get('BETTERNCM_PROFILE', r'C:\betterncm')
plugins_dir = os.path.join(data_dir, 'plugins')
target = os.path.join(plugins_dir, 'material-u-theme-ncmv3.plugin')
if not os.path.exists(os.path.join(dist, 'main.js')):
    raise SystemExit('dist/main.js 不存在,请先 npm run build')

# 清理任何带版本号的旧包，确保只保留一份 material-u-theme-ncmv3.plugin
for old in glob.glob(os.path.join(plugins_dir, 'material-u-theme-ncmv3-*.plugin')):
    try:
        os.remove(old)
        print('已清理带版本号旧包:', old)
    except Exception:
        pass

with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in ('main.js', 'manifest.json', 'Preview.jpg'):
        z.write(os.path.join(dist, f), f)
print('已部署:', target)
