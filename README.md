# my_website_work

本工作区用途：my_website_work

## 项目

| 目录 | 说明 | 入口 |
|------|------|------|
| `quiz_app/` | 答题应用 | `quiz_app/index.html` |
| `earthquake_app/` | 全球地震实时监测 3D 地球 | `earthquake_app/index.html` |

## 本地运行

两个项目都使用 ES Module，必须通过 HTTP 服务器打开（`file://` 会被 CORS 拦截）：

```bash
# 在工作区根目录执行
python -m http.server 8080