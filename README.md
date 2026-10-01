# AWM — 超自然辅助社区站

纯静态站点（HTML / CSS / JS），可直接丢到 **GitHub + Cloudflare Pages**。
无后端、无 Node 运行时依赖。

---

## 部署（Cloudflare）

根目录已有现成 HTML，**不要**用自动检测的 Cecil / `_site`（以仓库内 `wrangler.toml` 为准）。

### 方式 A：Workers 静态资源（`npx wrangler deploy`）

仓库已带 `wrangler.toml`（`assets.directory = "."`）。

1. 推送本仓库到 GitHub  
2. Cloudflare → Workers → 连接仓库  
3. **Deploy command** 填：`npx wrangler deploy`  
4. 不要让它自动跑 `npx cecil build`

### 方式 B：Cloudflare Pages

1. Pages → Connect repo  
2. Framework preset：**None**  
3. **Build command** 留空（或 `node build.mjs`）  
4. **Output directory** 填 `/`

日常改链接、版本号、QQ 群：只改 **`assets/js/config.js`** 里的 `RS_DATA`，提交后自动更新。

---

## 本地预览

双击 HTML 也能看大致效果；若要用完整路径行为，可任意起一个静态服务：

```bash
python -m http.server 8899
```

访问 http://127.0.0.1:8899/

---

## 改内容

| 想改什么 | 改哪里 |
|---|---|
| 版本号 / 下载链接 / QQ / 购卡 | `assets/js/config.js` → `RS_DATA` |
| 功能页截图 | `assets/img/features/` 同名替换 |
| 页面结构 / 文案布局 | `src/pages/*.html` 后跑 `node build.mjs` |
| 配色 | `assets/css/variables.css` |

### 更新功能截图

```
assets/img/features/
├── login.png
├── aimbot-basic.png / aimbot-predict.png
├── draw-player.png / draw-loot.png / draw-custom.png
├── memory-visual.png / memory-utility.png
├── teleport.png / navigate.png / settings.png
```

### 改页面结构

```bash
node build.mjs           # 从 src/pages 生成根目录 HTML
node build.mjs --watch   # 监听自动重建
```

---

## 目录结构

```
.
├── index.html / download.html / features.html / …
├── assets/
│   ├── css/
│   ├── js/
│   │   ├── config.js        ← ★ 下载链接 / 版本 / 社区（日常只改这个）
│   │   ├── config-loader.js
│   │   ├── loader.js
│   │   └── main.js
│   └── img/
├── src/pages/               ← 页面源文件
└── build.mjs                ← 可选：拼装公共导航/页脚
```

---

## 说明

- 加载动画默认本会话只播一次（`RS_CONFIG.loader: 'once'`）  
- 不要把 `.t/` 等本地缓存目录提交进仓库  
