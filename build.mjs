#!/usr/bin/env node
/* ==========================================================================
 * AWM 站点 · 静态页生成器
 * --------------------------------------------------------------------------
 * 为什么需要它：loader / 导航 / 页脚在每个页面都一样，手抄 6 遍必然漂移。
 * 本脚本读 src/pages/*.html 的内容块，套上统一的 shell，输出根目录 HTML。
 *
 *   node build.mjs            生成全部页面
 *   node build.mjs --watch    改动 src/ 后自动重建
 *
 * 产出是**纯静态 HTML**，不依赖 Node，可直接丢 GitHub Pages。
 * 改完 src/ 记得跑一次，或开 --watch。
 * ========================================================================== */
import { readFileSync, writeFileSync, readdirSync, existsSync, watch } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(ROOT, 'src', 'pages');

/* 正式域名：部署后改成自己的域名（用于 canonical / og:url / sitemap） */
const SITE_URL = 'https://awm.yexinghan.dpdns.org';

/* 姊妹服务「号牌行」入口（兜底链接；正式值也可在 config.js 的 RS_DATA.roomkeeper.url 覆盖） */
const RK_URL = 'http://room.yexinghan.dpdns.org/';

/* 样式按顺序合并成一个 app.css，减少渲染阻塞请求 */
const CSS_FILES = ['fonts.css', 'variables.css', 'base.css', 'animations.css', 'loader.css', 'components.css', 'style.css'];

/* ── 导航定义（顺序即显示顺序） ── */
const NAV = [
  ['index.html', '首页'],
  ['download.html', '下载'],
  ['features.html', '功能'],
  ['changelog.html', '更新日志'],
  ['faq.html', '教程与答疑']
];

/* ══════════════════════════════════════════════════════════════════
   公共区块
   ══════════════════════════════════════════════════════════════════ */

const LOADER = `
<div id="boot-loader" aria-hidden="true">
  <div class="boot-stage">
    <div class="boot-ring" aria-hidden="true"></div>
    <div class="boot-ring boot-ring--inner" aria-hidden="true"></div>
    <svg class="boot-ring boot-ring--dashed" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="88"/></svg>
    <svg class="boot-crosshair" viewBox="0 0 200 200" aria-hidden="true">
      <line x1="100" y1="0" x2="100" y2="30"/><line x1="100" y1="170" x2="100" y2="200"/>
      <line x1="0" y1="100" x2="30" y2="100"/><line x1="170" y1="100" x2="200" y2="100"/>
    </svg>
    <div class="boot-logo">
      <svg viewBox="0 0 128 128" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="bootGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#22d3ee"/><stop offset="52%" stop-color="#818cf8"/><stop offset="100%" stop-color="#f472b6"/>
          </linearGradient>
        </defs>
        <path class="logo-stroke" style="--len:400" d="M64 8 L112 36 L112 92 L64 120 L16 92 L16 36 Z"/>
        <g class="logo-stroke" style="--len:280; animation-delay:.5s">
          <line x1="64" y1="30" x2="64" y2="43"/><line x1="64" y1="85" x2="64" y2="98"/>
          <line x1="30" y1="64" x2="43" y2="64"/><line x1="85" y1="64" x2="98" y2="64"/>
        </g>
        <g class="logo-stroke" style="--len:420; animation-delay:.72s">
          <path d="M34 86 L42 46"/>
          <path d="M50 86 L42 46"/>
          <path d="M37.5 72 L46.5 72"/>
          <path d="M53 46 L58 86 L63.5 58 L69 86 L74 46"/>
          <path d="M77 86 L77 46 L83.5 70 L90 46 L90 86"/>
        </g>
        <circle class="logo-solid" cx="64" cy="98" r="3" fill="#22d3ee"/>
      </svg>
    </div>
    <div class="boot-floor" aria-hidden="true"></div>
  </div>
  <div class="boot-wordmark" id="boot-wordmark" aria-hidden="true"></div>
  <div class="boot-sub" aria-hidden="true">超自然辅助</div>
  <div class="boot-progress">
    <div class="boot-bar">
      <div class="boot-bar__fill" id="boot-bar-fill"></div>
      <div class="boot-bar__shine" aria-hidden="true"></div>
    </div>
    <div class="boot-meta">
      <span>正在载入</span>
      <span class="boot-meta__pct" id="boot-pct">000%</span>
    </div>
  </div>
  <div class="boot-log" id="boot-log" aria-hidden="true"></div>
</div>`;

function navBlock(active) {
  const main = NAV.map(([h, t]) =>
    `<a class="nav__link${h === active ? ' is-active' : ''}" href="./${h}"${h === active ? ' aria-current="page"' : ''}>${t}</a>`).join('\n        ');
  const drawer = NAV.map(([h, t]) => `<a class="nav__link" href="./${h}">${t}</a>`).join('\n    ');

  return `
  <!-- 背景场 -->
  <div class="bg-field" aria-hidden="true"></div>
  <div class="bg-scan" aria-hidden="true"></div>

  <!-- 顶部导航 -->
  <header class="nav">
    <div class="nav__inner">
      <a class="brand" href="./index.html">
        <img class="brand__mark" src="./assets/img/logo.svg" alt="" width="30" height="30">
        <span class="brand__name" data-bind="site.name">AWM</span>
        <span class="brand__tag">超自然社区</span>
      </a>
      <nav class="nav__links" aria-label="主导航">
        ${main}
      </nav>
      <div class="nav__actions">
        <a class="btn btn--sm nav__rk" href="${RK_URL}" data-bind-attr="href:roomkeeper.url" target="_blank" rel="noopener noreferrer"><span class="rk-dot" aria-hidden="true"></span>号牌行</a>
        <a class="btn btn--primary btn--sm" href="./download.html">立即下载</a>
        <button class="nav__burger" type="button" aria-label="打开菜单" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </div>
  </header>

  <!-- 移动端抽屉 -->
  <div class="nav__drawer">
    ${drawer}
    <a class="btn btn--ghost btn--block nav__rk" href="${RK_URL}" data-bind-attr="href:roomkeeper.url" target="_blank" rel="noopener noreferrer"><span class="rk-dot" aria-hidden="true"></span>号牌行</a>
    <a class="btn btn--primary btn--block" href="./download.html">立即下载</a>
  </div>

  <!-- 公告条 -->
  <div class="announce" data-bind-hide-empty>
    <div class="announce__inner">
      <span class="announce__icon" aria-hidden="true"></span>
      <span class="announce__text" data-bind="site.announcement">公告</span>
      <button class="announce__close" type="button" aria-label="关闭公告">✕</button>
    </div>
  </div>`;
}

const FOOTER = `
  <!-- 页脚 -->
  <footer class="footer">
    <div class="wrap">
      <div class="footer__grid">
        <div>
          <div class="footer__brand">
            <img src="./assets/img/logo.svg" alt="" width="30" height="30">
            <strong class="brand__name" data-bind="site.name">AWM</strong>
          </div>
          <p class="sm dim" style="max-width:320px" data-bind="site.tagline">下载 · 功能 · 社区</p>
          <p class="xs faint mt-3">本项目仅供学习与参考。</p>
        </div>

        <div>
          <div class="footer__title">导航</div>
          <a class="footer__link" href="./index.html">首页</a>
          <a class="footer__link" href="./download.html">下载中心</a>
          <a class="footer__link" href="./features.html">功能介绍</a>
          <a class="footer__link" href="./changelog.html">更新日志</a>
        </div>

        <div>
          <div class="footer__title">资源</div>
          <a class="footer__link" href="./faq.html">教程与答疑</a>
        </div>

        <div>
          <div class="footer__title">社区</div>
          <a class="footer__link" data-bind-attr="href:community.qq_url" target="_blank" rel="noopener noreferrer">QQ 群 · 古德猫宁</a>
          <button class="footer__link" type="button" data-shop-soon>购卡入口</button>
          <a class="footer__link" data-bind-attr="href:game.official_url" target="_blank" rel="noopener noreferrer">游戏官网</a>
        </div>
      </div>

      <div class="footer__bottom">
        <span>© <span data-year>2026</span> <span data-bind="site.author">AWM 开发组</span> · <span data-bind="site.footer_note">愿你我惺惺相惜</span></span>
        <span class="mono xs faint">v<span data-bind="version.current">0.0.5</span></span>
      </div>
    </div>
  </footer>

  <button class="to-top" type="button" aria-label="返回顶部">↑</button>`;

const SCRIPTS = `
<script src="./assets/js/config.js"></script>
<script src="./assets/js/config-loader.js"></script>
<script src="./assets/js/loader.js"></script>
<script src="./assets/js/main.js"></script>`;

/* ══════════════════════════════════════════════════════════════════
   Shell 模板
   ══════════════════════════════════════════════════════════════════ */
function productVersion() {
  try {
    const js = readFileSync(join(ROOT, 'assets', 'js', 'config.js'), 'utf8');
    const m = js.match(/current:\s*'([^']+)'/);
    if (m) return m[1];
  } catch (e) {}
  return '0.0.5';
}

function shell(meta, body, file) {
  const extraCss = (meta.css || []).map(f => `<link rel="stylesheet" href="./assets/css/${f}">`).join('\n');
  const pagePath = file === 'index.html' ? '/' : '/' + file;
  const canonical = SITE_URL + pagePath;
  const ogImage = SITE_URL + '/assets/img/og-cover.png';
  const version = productVersion();

  return `<!DOCTYPE html>
<html lang="zh-CN" data-booted="0">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#04060d">
<meta name="color-scheme" content="dark light">
<title>${meta.title}</title>
<meta name="description" content="${meta.desc}">
<link rel="canonical" href="${canonical}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="AWM">
<meta property="og:title" content="${meta.title}">
<meta property="og:description" content="${meta.desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="AWM 超自然辅助">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${meta.title}">
<meta name="twitter:description" content="${meta.desc}">
<meta name="twitter:image" content="${ogImage}">

<link rel="icon" href="./assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="./assets/img/apple-touch-icon.png">
<link rel="preload" href="./assets/fonts/Inter-400_800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="./assets/fonts/ChakraPetch-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="./assets/fonts/ChakraPetch-700.woff2" as="font" type="font/woff2" crossorigin>

<link rel="stylesheet" href="./assets/css/app.css">
${extraCss}
<noscript><style>
  #boot-loader { display: none !important; }
  body.is-booting { overflow: auto; }
  #app { opacity: 1 !important; }
</style></noscript>
</head>

<body class="is-booting">
<a class="skip-link" href="#main-content">跳到主内容</a>

<!-- 首次访问判定：在首帧前同步打标记，跳过动画时不会闪一下淡入 -->
<script>
(function(){
  try {
    if (sessionStorage.getItem('rs_booted') === '1') {
      document.documentElement.setAttribute('data-booted', '1');
      document.documentElement.setAttribute('data-skip-boot', '1');
    }
  } catch (e) {}
})();
</script>

<!-- ═══ 启动加载动画 ═══ -->
${LOADER}
<div class="sr-only" role="status" aria-live="polite">页面正在载入</div>

<!-- ═══ 页面主体 ═══ -->
<div id="app">
${navBlock(meta.active)}

  <main id="main-content">
${body}
  </main>
${FOOTER}
</div>
${SCRIPTS}
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"SoftwareApplication","name":"AWM 超自然辅助","applicationCategory":"UtilitiesApplication","operatingSystem":"Windows 10, Windows 11","softwareVersion":"${version}","url":"${SITE_URL}/","downloadUrl":"${SITE_URL}/download.html"}
</script>
</body>
</html>
`;
}

/* ══════════════════════════════════════════════════════════════════
   读取源文件并生成
   ══════════════════════════════════════════════════════════════════ */

/** 解析 src/pages/x.html：头部 --- 包起来的 meta + 正文 */
function parseSource(text, file) {
  // 去掉偶发的 UTF-8 BOM，避免 ^--- 匹配失败
  text = text.replace(/^\uFEFF/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: 缺少 meta 头（--- 包裹的 title/desc/active ---）`);

  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (k === 'css') meta.css = v.split(',').map(s => s.trim()).filter(Boolean);
    else meta[k] = v;
  }
  if (!meta.title) throw new Error(`${file}: meta 缺少 title`);
  if (!meta.desc) throw new Error(`${file}: meta 缺少 desc`);
  if (!meta.active) meta.active = basename(file);

  return { meta, body: m[2].trimEnd() };
}

function buildCssBundle() {
  const parts = [];
  for (const f of CSS_FILES) {
    const fp = join(ROOT, 'assets', 'css', f);
    if (!existsSync(fp)) { console.error('  ✗ 缺少样式文件: ' + f); continue; }
    parts.push(`/* ===== ${f} ===== */\n` + readFileSync(fp, 'utf8'));
  }
  const css = parts.join('\n');
  writeFileSync(join(ROOT, 'assets', 'css', 'app.css'), css, 'utf8');
  console.log(`  ✓ app.css ${(Buffer.byteLength(css, 'utf8') / 1024).toFixed(1)} KB`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const LOG_TAG_CLASS = { '新增': 'new', '优化': 'opt', '修复': 'fix', '安全': 'sec' };

function renderChangelog() {
  const file = join(ROOT, 'src', 'data', 'changelog.json');
  if (!existsSync(file)) return '<p class="dim">更新日志准备中。</p>';
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.error('  ✗ changelog.json 解析失败: ' + e.message); return '<p class="dim">更新日志暂时无法显示。</p>'; }

  const entries = Array.isArray(data.entries) ? data.entries : [];
  if (!entries.length) return '<p class="dim">更新日志准备中。</p>';

  const siteVersion = productVersion();
  if (entries[0].version !== siteVersion) {
    console.warn(`  ! 更新日志最新版本 ${entries[0].version} 与站点版本 ${siteVersion} 不一致（config.js）`);
  }

  return entries.map(en => {
    const items = (en.items || []).map(it => `<li><span class="log-tag log-tag--${LOG_TAG_CLASS[it.type] || 'opt'}">${escapeHtml(it.type)}</span><span>${escapeHtml(it.text)}</span></li>`).join('');
    return `
          <article class="log-entry" data-reveal>
            <div class="log-meta">
              <time class="log-date" datetime="${escapeHtml(en.date)}">${escapeHtml(en.date)}</time>
              <span class="log-ver">v${escapeHtml(en.version)}</span>
            </div>
            <div class="log-body">
              <h2 class="log-title">${escapeHtml(en.title || '')}</h2>
              <ul class="log-list">${items}</ul>
            </div>
          </article>`;
  }).join('');
}

function buildSitemap(files) {
  const pages = files.filter(f => f !== '404.html');
  const urls = pages.map(f => `  <url><loc>${SITE_URL}/${f === 'index.html' ? '' : f}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(join(ROOT, 'sitemap.xml'), xml, 'utf8');
  console.log(`  ✓ sitemap.xml ${pages.length} 条`);
}

function build() {
  if (!existsSync(PAGES_DIR)) {
    console.error('✗ 找不到 src/pages/');
    process.exit(1);
  }

  buildCssBundle();

  const files = readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));
  let ok = 0;

  for (const f of files) {
    const raw = readFileSync(join(PAGES_DIR, f), 'utf8');
    try {
      let { meta, body } = parseSource(raw, f);
      if (body.includes('<!-- BUILD:CHANGELOG -->')) {
        body = body.replace('<!-- BUILD:CHANGELOG -->', renderChangelog());
      }
      const html = shell(meta, body, f);
      writeFileSync(join(ROOT, f), html, 'utf8');
      const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
      console.log(`  ✓ ${f.padEnd(18)} ${kb.padStart(6)} KB  ${meta.title}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${f}: ${e.message}`);
    }
  }

  buildSitemap(files);
  console.log(`\n生成完成：${ok}/${files.length} 页\n`);
}

build();

/* ── watch ── */
if (process.argv.includes('--watch')) {
  console.log('监听 src/ 变化中… (Ctrl+C 退出)\n');
  let t = null;
  watch(PAGES_DIR, { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => { console.log('— 重建 —'); build(); }, 120);
  });
}
