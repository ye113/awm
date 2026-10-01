/* ==========================================================================
 * AWM 站点 · 启动加载动画驱动
 * --------------------------------------------------------------------------
 * 流程：
 *   1. 生成 SVG Wordmark（逐字母入场）
 *   2. 按阶段推进进度条 + 终端日志
 *   3. 并行等待：最短时长 / 配置加载 / 字体就绪
 *   4. 满进度 → 退场 → 触发 body.is-ready
 * 兜底：超过 loaderMaxMs 强制放行，绝不白屏卡死。
 * ========================================================================== */
(function () {
  'use strict';

  var CFG = window.RS_CONFIG || {};
  var MIN_MS = CFG.loaderMinMs || 2000;
  var MAX_MS = CFG.loaderMaxMs || 6000;

  var LOG_STEPS = [
    { text: '初始化渲染管线', at: 0 },
    { text: '装载站点配置', at: 16 },
    { text: '同步资源清单', at: 34 },
    { text: '校验版本签名', at: 52 },
    { text: '预热界面缓存', at: 70 },
    { text: '启动完成', at: 90 }
  ];

  var t0 = performance.now();
  var done = false;
  var logHost = null;
  var logIdx = 0;

  /* ---------------------------------------------------------------- */
  /* Wordmark：把站点名拆成逐字母 */
  /* ---------------------------------------------------------------- */
  function buildWordmark(el) {
    if (!el || el.getAttribute('data-built')) return 0;
    var name = (window.RS && window.RS.site && window.RS.site.name) || 'AWM';
    var chars = String(name).toUpperCase().split('');
    el.innerHTML = '';
    chars.forEach(function (ch, i) {
      var s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.animationDelay = (0.42 + i * 0.075) + 's';
      el.appendChild(s);
    });
    el.setAttribute('data-built', '1');
    return chars.length;
  }

  /* ---------------------------------------------------------------- */
  /* 进度：0~100，只增不减 */
  /* ---------------------------------------------------------------- */
  var pct = 0, target = 0, raf = null;

  function tick() {
    if (done) return;
    // 平滑逼近目标（越接近越慢，最后阶段有「收尾感」）
    var diff = target - pct;
    if (diff > 0.05) {
      pct += Math.max(diff * 0.11, 0.16);
      if (pct > target) pct = target;
    }
    if (pct >= 98 && target < 100) pct = 98 + (pct - 98) * 0.9;

    paint();
    raf = requestAnimationFrame(tick);
  }

  function paint() {
    var v = Math.min(pct, 100);
    var bar = document.getElementById('boot-bar-fill');
    var num = document.getElementById('boot-pct');
    if (bar) bar.style.width = v.toFixed(2) + '%';
    if (num) num.textContent = String(Math.floor(v)).padStart(3, '0') + '%';
    pushLogs(v);
  }

  function pushLogs(v) {
    if (!logHost) return;
    while (logIdx < LOG_STEPS.length && v >= LOG_STEPS[logIdx].at) {
      var step = LOG_STEPS[logIdx];
      var line = document.createElement('div');
      line.textContent = step.text;
      // 完成态在下一阶段补上勾
      logHost.appendChild(line);
      if (logHost.children.length > 3) logHost.removeChild(logHost.firstChild);
      logIdx++;
      // 给上一条打勾
      if (logHost.children.length >= 2) {
        logHost.children[logHost.children.length - 2].classList.add('is-ok');
      }
    }
  }

  function setTarget(v) {
    if (v > target) target = Math.min(v, 99.5);
  }

  /* ---------------------------------------------------------------- */
  /* 收尾 */
  /* ---------------------------------------------------------------- */
  function finish(reason) {
    if (done) return;
    done = true;

    target = 100;
    pct = 100;
    paint();

    if (logHost) {
      Array.prototype.forEach.call(logHost.children, function (c) { c.classList.add('is-ok'); });
      var last = document.createElement('div');
      last.textContent = '就绪';
      last.classList.add('is-ok');
      logHost.appendChild(last);
    }

    var el = document.getElementById('boot-loader');
    document.body.classList.remove('is-booting');
    document.body.classList.add('is-ready');
    document.documentElement.setAttribute('data-booted', '1');

    try { sessionStorage.setItem('rs_booted', '1'); } catch (e) { /* 隐私模式忽略 */ }

    if (raf) cancelAnimationFrame(raf);

    // 让 100% 至少被看见一瞬
    setTimeout(function () {
      if (!el) return;
      el.classList.add('is-done');
      setTimeout(function () {
        el.classList.add('is-gone');
        el.setAttribute('aria-hidden', 'true');
        document.dispatchEvent(new CustomEvent('rs:booted', { detail: { reason: reason } }));
      }, 760);
    }, 180);
  }

  /* ---------------------------------------------------------------- */
  /* 主流程 */
  /* ---------------------------------------------------------------- */
  function run() {
    var el = document.getElementById('boot-loader');
    var wordmark = document.getElementById('boot-wordmark');

    /* 是否播放：loader === true 每次都播；false 从不播；
       'once'（默认）只在本会话首次进入站点时播。
       首帧前已在 <head> 打过 data-skip-boot 标记，这里与之保持一致。 */
    var mode = CFG.loader;
    var played = document.documentElement.hasAttribute('data-skip-boot');
    if (!played) {
      try { played = sessionStorage.getItem('rs_booted') === '1'; } catch (e) { played = false; }
    }

    var shouldPlay = mode === false ? false
                   : mode === true ? true
                   : !played;                       /* 'once' 及未设值 */

    // 无论是否播放动画，都要渲染配置；否则站内跳转后列表/绑定会空白
    var cfgReady = window.RS_CORE ? window.RS_CORE.boot() : Promise.resolve();

    if (!el || !shouldPlay) {
      // 直接进入：移除遮罩，立即显示内容，不发任何动画
      if (el) el.remove();
      document.body.classList.remove('is-booting');
      document.body.classList.add('is-ready');
      document.documentElement.setAttribute('data-booted', '1');
      try { sessionStorage.setItem('rs_booted', '1'); } catch (e) { /* 隐私模式忽略 */ }
      document.dispatchEvent(new CustomEvent('rs:booted', { detail: { reason: played ? 'session' : 'off' } }));
      return;
    }

    logHost = document.getElementById('boot-log');

    // 配置先到手，Wordmark 才能用真名字
    cfgReady.then(function () {
      buildWordmark(wordmark);
    });

    var fontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready.catch(function () { return null; })
      : Promise.resolve();

    raf = requestAnimationFrame(tick);

    // 阶段推进：最小 2s 里铺满进度
    var timeline = [
      { t: 120,  v: 22 },
      { t: 520,  v: 44 },
      { t: 960,  v: 62 },
      { t: 1420, v: 78 },
      { t: 1820, v: 90 }
    ];
    timeline.forEach(function (s) { setTimeout(function () { setTarget(s.v); }, s.t); });

    // 真实完成条件：最短时长 + 配置 + 字体
    Promise.all([
      new Promise(function (r) { setTimeout(r, MIN_MS); }),
      cfgReady.catch(function () { return null; }),
      fontsReady
    ]).then(function () { finish('resources'); });

    // 兜底放行
    setTimeout(function () { finish('timeout'); }, MAX_MS);

    // 用户点任意键 / 点击可跳过
    var skipHandler = function (e) {
      if (done) return;
      if (e.type === 'keydown' && e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
      finish('user-skip');
      window.removeEventListener('keydown', skipHandler);
      window.removeEventListener('click', skipHandler);
    };
    window.addEventListener('keydown', skipHandler);
    window.addEventListener('click', skipHandler, { once: true });
  }

  window.RS_LOADER = { run: run, finish: finish };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  // 暴露耗时，便于排查
  window.addEventListener('load', function () {
    console.info('[RS] 页面完全加载 ' + Math.round(performance.now() - t0) + 'ms');
  });
})();
