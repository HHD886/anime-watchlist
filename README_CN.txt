王之宝库 · HHD 作品库 v4.0
============================================================
封面作品库 / 0.1 分个人评分 / 排行榜 / 标签 / 长评与随手记 /
原追番表 / Bangumi 导入 / GitHub Pages / 可选加密发布

【最先做这三步】
1. 打开浏览网址：https://hhd886.github.io/anime-watchlist/
2. 点“进入编辑”，或打开：https://hhd886.github.io/anime-watchlist/editor.html
3. 点封面评分、写评语；发布到其他设备前，在设置中填写你自己的 GitHub Token。
   用户名 HHD886、仓库 anime-watchlist、main 分支已预填。
   第一次发布前请先“读取 GitHub”，以最新记录为基础编辑。

升级以原仓库 2026-09-05 发布的 33 条记录为准：
每日更新 8 部、完结待看 10 部、漫画待看 12 部、小说待看 3 部。
原有标题、分类、优先级、进度、标签、封面和备注全部保留，没有替你打分。
旧 ZIP 中已删除或不在当前仓库的示例记录不会重新添加。
旧电脑上如果还有未发布记录，请先在旧表导出 JSON，再到新版导入并预览合并。

【下载后本地使用】
将整个 ZIP 解压，双击 editor.html，无需安装 Node、Python 或服务器。
从 GitHub 下载的网页文件不内置作品数据；首次本地打开，请点
“导入作品 → 旧表 / JSON 备份”，选择同目录 data.json，勾选导入。
已有的本机编辑会继续保留；后续请定期导出 JSON 备份。

【第一天怎么用】
作品库：点击封面进入详情，可评分、写长评、增加多条带日期的随手记。
点击“添加作品”：手动录入动画、漫画或小说，可上传封面或填封面网址。
个人榜单：0.0–10.0 分，精确到 0.1。未评分单独保留，不算 0 分。
  9 分区 = 9.0–10.0；8 分区 = 8.0–8.9；7 分区 = 7.0–7.9。
  同分并列，支持分区展示。Bangumi 参考分不会参与个人榜单。
心头好：与评分独立，默认按最近更新排序时优先显示。
标签：题材标签 + 自定义个人标签，可点击筛选，也可以组合类型、状态、分数。
系列：同名系列的不同季度、动画 / 漫画 / 小说会在详情中互相关联。
追番追更：保留每日更新、完结待看、漫画待看、小说待看四区。
  每日更新保留周一至周日和 SSR / SR / R 观看优先级。
  “＋1”记录进度，达到已知总数后自动标记完成。
  “已完结”只把作品从每日更新移到完结待看，保留观看进度和优先级。
  已完成与放弃的作品不会消失，仍在作品库中。

【从 Bangumi 导入】
方式一：导入作品 → 搜索 / 链接。输入名称，或粘贴条目链接 / ID。
  支持一次输入多个条目 ID 或链接，以空格、换行、逗号分隔，最多 100 个。
  名称搜索一次显示 20 个结果，可换原名搜索或直接用准确条目链接。
方式二：我的 Bangumi 收藏。输入用户名或个人主页链接。
  自动分页读取动画与书籍收藏，可按收藏状态分批读取。
  公开收藏通常无需 Token；私有收藏需要 Bangumi Access Token。
  地址：https://next.bgm.tv/demo/access-token
  Token 仅在当前页面内使用，不会发布或进入备份。
  带入已有整数评分、短评、个人标签和进度。导入后可改成 9.8 等分数。
  书籍条目资料不足时，请在导入预览核对漫画 / 小说类型。
方式三：继续使用原 Bangumi-Watchlist-Importer-v2 插件。
  新网页兼容原插件队列；本地 editor.html → 导入作品 → 原版导入插件。
  扩展需开启“允许访问文件网址”。网站端建议用直接搜索或账号导入。

所有导入都先预览，勾选后才写入。
默认“补全空白资料”：保护现有评分、评语、进度、分类和封面。
“跳过已有作品”：完全保留已有记录。
导入备份 / 账号收藏也可选择“替换重复记录”，明确确认后覆盖个人字段。
按 Bangumi ID 优先去重；没有 ID 时按同类型同名判断，可手动处理同名不同作。
导入、删除、读取 GitHub 前会保留一份本机恢复备份，设置中可恢复。

【沿用原来的 GitHub Pages 网站】
1. 打开 editor.html → 右上角设置图标 → GitHub 发布与跨设备读取。
2. 填原 GitHub 用户名、仓库名、分支（通常是 main）。
3. 填 GitHub Fine-grained Token。
   创建位置：GitHub 头像 → Settings → Developer settings →
   Personal access tokens → Fine-grained tokens。
   Repository access 仅选这个仓库，Contents 权限设为 Read and write。
   不需要仓库管理员权限或 Actions / Workflows 写入权限。
4. 点击“测试连接”。连接成功只验证读取权限，实际发布验证写入权限。
5. 如果原仓库已有最新记录，先点“读取 GitHub”，确认合并或替换本机。
6. 点击“发布到 GitHub”。网页与数据会一次提交，不逐个文件产生多个版本。
7. 如果之前开过 Pages，一般无需重新配置；新仓库需：
   Settings → Pages → Deploy from a branch → main → /(root) → Save。
8. 等待 Pages 构建完成。网页会显示自动生成的网站地址，也可自填自定义域名。

正常发布仅更新：
  index.html / editor.html / data.json / sw.js /
  manifest.webmanifest / icon.svg / .nojekyll
不会删除仓库中的 CNAME、README 或其他文件。
每次发布保留远程基础树、检查远程版本，并使用非强制分支更新。
新仓库请先创建 README，使 main 分支存在。程序不会静默创建或覆盖其他分支。
分支保护规则、GitHub 网络及 Token 权限仍可能阻止发布，界面会显示错误。

【手机、平板怎么用】
浏览：打开同一个 GitHub Pages 网址，刷新获取已发布数据。
编辑：点击“进入编辑”，在设备本机编辑；发布需要在该设备填写 GitHub Token。
换设备开始编辑前，先“读取 GitHub”获取最新版本。
修改先存在本机，必须点“发布”后才同步到其他设备，不是实时自动同步。
如果另一台设备已更新，程序会阻止覆盖，先读取 GitHub 合并 / 替换再发布。
在 iPhone / iPad Safari 分享菜单里可添加到主屏幕。
离线：HTTPS 网站联网打开后缓存页面和数据；设置中“准备离线阅读”可加载封面。
离线不能请求 Bangumi、读取或发布 GitHub。未缓存封面仍需联网。
浏览器可能回收缓存；请定期导出 JSON 备份。推荐使用现代浏览器。
iOS 10 等很老的系统未做兼容保证，尤其不支持完整 PWA / 现代加密功能。

【只有自己看：可选加密】
GitHub Pages 默认不是私人登录网站。普通发布时作品数据可能被他人访问。
启用“加密发布作品数据”，设置至少 8 字符的口令并再次输入。
作品资料先使用 AES-256-GCM 加密；口令通过 PBKDF2-SHA256（310000 次）派生密钥。
发布的 index.html 与 editor.html 不内置作品记录、Token 或口令。
打开网站需要口令解锁。口令仅在当前页面内保留。
本机编辑数据库和普通 JSON 备份是明文；若需要保护备份，请用“导出加密备份”。
请通过界面的发布按钮，或使用下面的脚本；它们只发布指定文件并清理内置记录。
普通下载包的 data.json 与自行生成的 --standalone 编辑文件可能包含明文资料，
启用加密后不要将旧明文备份或离线编辑文件重新上传到公开仓库。
加密不会移除曾经公开提交过的旧 Git 历史，也不会隐藏你访问 Bangumi 图片的请求。
如果遗忘口令，只能使用你另外保留的未加密备份恢复。
GitHub Token 默认仅保存在当前会话；只有主动勾选记住，才持久保存在本机浏览器。

【备用：不用网页 Token，改用 Git for Windows】
双击 publish_with_git.bat，选择最新导出的 JSON（可加密），填写仓库与分支。
脚本会克隆远程到临时目录、清理网页内置记录、提交并正常推送。
首次 Git 登录由 Git Credential Manager 处理；若推送冲突，脚本不会强制覆盖。
这个备用 Windows 脚本在当前 Linux 制作环境中未实际执行。

【备份 / 恢复 / 更新程序】
设置 → 导出 JSON 备份：保存全部作品资料与封面。
设置 → 导出加密备份：口令保护，导入时解锁。
更换电脑或浏览器：导入该文件，或从 GitHub 读取。
不要只复制 HTML 来迁移后续编辑：编辑数据保存在浏览器数据库中。
安装新版之前先导出 JSON；网页程序可以替换，已有本机数据按相同页面地址保留。
没有用到会员服务、付费数据库或第三方代理；GitHub / Bangumi 的服务规则仍适用。

【开发者文件（普通使用可忽略）】
src/ 为可维护源代码；Node 18+ 执行 node build.mjs 可重建发布网页。
重建不会覆盖已存在的 data.json；网页始终从 data.json 读取已发布记录。
node build.mjs --standalone 可将当前未加密 data.json 嵌入 editor.html，
用于本地离线携带。不要将这种含明文资料的编辑文件用于加密网站。
build.mjs 不会读取浏览器中后续编辑的数据；请先在网页导出 JSON。
src/core.test.cjs 可用 node --test src/core.test.cjs 运行核心验证。
不依赖 CDN 脚本，不需要 npm install。
完整制作验证与限制见 验证说明.txt。

官方参考：
https://github.com/bangumi/api/blob/master/open-api/v0.yaml
https://docs.github.com/en/rest/git/trees
https://docs.github.com/en/rest/git/refs
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
