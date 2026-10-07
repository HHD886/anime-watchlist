# anime-watchlist

王之宝库 · HHD 的动画、漫画、小说收藏室。

[打开作品库](https://hhd886.github.io/anime-watchlist/) · [进入编辑](https://hhd886.github.io/anime-watchlist/editor.html) · [完整中文说明](README_CN.txt)

- 封面作品库，动画 / 漫画 / 小说分类，多标签与搜索。
- 0.0–10.0 个人评分，精确到 0.1；排行榜、并列名次、分数分区。
- 每部作品有长评、带日期的随手记、评分历史和系列关联。
- 原追番表的星期、SSR / SR / R 优先级、完结待看和阅读进度。
- Bangumi 名称 / 条目链接 / 账号收藏导入，支持旧版 JSON。
- 本机自动保存、JSON 备份、GitHub Pages 发布、跨设备读取、可选加密。

本次升级保留原网站的全部 33 条记录；没有预设个人评分。修改先保存在当前设备，点击发布后其他设备才会看到。首次发布请在“设置与备份”填写自己的 GitHub Token，并先读取 GitHub。Token 不随网页或数据发布。

GitHub Pages 是公开网站；希望作品内容需要口令才能查看，可启用“加密发布作品数据”。加密不会清理以前的 Git 历史。本机编辑缓存和普通备份仍是明文。

下载整个仓库后也能双击 `editor.html` 本地使用；第一次在“导入作品 → 旧表 / JSON 备份”导入同目录的 `data.json`。具体步骤见 [开始使用](开始使用.html)。

## 开发与验证

不依赖 npm 包或 CDN 脚本。Node 18+：

```sh
node build.mjs
node --test src/core.test.cjs
```

重建保留现有 `data.json`，两个网页的内置作品数组均为空。`node build.mjs --standalone` 仅供制作含当前明文记录的本地编辑包，不应用于加密网站。

制作验证范围和限制见 [验证说明](验证说明.txt)。
