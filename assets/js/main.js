/* ==========================================================================
 * AWM 站点 · 页面交互
 * --------------------------------------------------------------------------
 * 导航 / 进场动画 / 手风琴 / 复制 / 数字滚动 / 返回顶部 / 鼠标光晕
 * ========================================================================== */
(function () {
  'use strict';

  var CFG = window.RS_CONFIG || {};
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ======================================================================
   * 1. 导航
   * ==================================================================== */
  function initNav() {
    var nav = $('.nav');
    var burger = $('.nav__burger');
    var drawer = $('.nav__drawer');

    // 滚动吸顶
    if (nav) {
      var onScroll = function () {
        nav.classList.toggle('is-stuck', window.scrollY > 12);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // 移动端抽屉
    if (burger && drawer) {
      burger.addEventListener('click', function () {
        var open = drawer.classList.toggle('is-open');
        burger.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
      });
      $$('a', drawer).forEach(function (a) {
        a.addEventListener('click', function () {
          drawer.classList.remove('is-open');
          burger.classList.remove('is-open');
          document.body.style.overflow = '';
        });
      });
    }

    // 当前页高亮
    var here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav__link').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('/').pop().split('#')[0];
      if (href && href === here) a.classList.add('is-active');
    });

    // 平滑锚点（带导航高度偏移）
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        if (!id) return;
        var t = document.getElementById(id);
        if (!t) return;
        e.preventDefault();
        var top = t.getBoundingClientRect().top + window.scrollY
                - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 68)
                - 18;
        window.scrollTo({ top: top, behavior: 'smooth' });
        history.replaceState(null, '', '#' + id);
      });
    });
  }

  /* ======================================================================
   * 2. 公告条关闭
   * ==================================================================== */
  function initAnnounce() {
    var bar = $('.announce');
    if (!bar) return;
    var btn = $('.announce__close', bar);
    if (!btn) return;
    btn.addEventListener('click', function () {
      bar.style.transition = 'height .28s, opacity .28s, margin .28s';
      bar.style.height = bar.offsetHeight + 'px';
      requestAnimationFrame(function () {
        bar.style.height = '0px';
        bar.style.opacity = '0';
        bar.style.marginTop = '0px';
      });
      setTimeout(function () { bar.remove(); }, 320);
    });
  }

  /* ======================================================================
   * 3. 进场动画
   * ----------------------------------------------------------------------
   * 用 IntersectionObserver 做主力，但**不能只靠它**：
   * 快速滚动 / 程序化 scrollTo / 锚点跳转时，元素可能在同一帧内进入又离开，
   * 回调里的 isIntersecting 为 false，于是它永远停在 opacity:0 —— 视觉上就是
   * 整块内容不见了。所以补两道保险：
   *   ① rAF 节流的滚动兜底检查（按视口位置直接判定）
   *   ② 观测器一旦触发过（说明支持），仅在元素真正「离开」且已显示后才 un
   * ==================================================================== */
  function initReveal() {
    // 可重复调用：只接管尚未处理的节点（动态插入的卡片）
    var nodes = $$('[data-reveal]').filter(function (n) {
      return !n.hasAttribute('data-reveal-bound');
    });
    if (!nodes.length) return;

    nodes.forEach(function (n) { n.setAttribute('data-reveal-bound', '1'); });

    // 错峰延迟：同组内依次入场
    nodes.forEach(function (n) {
      if (!n.style.getPropertyValue('--reveal-delay')) {
        var sib = n.parentElement ? Array.prototype.indexOf.call(n.parentElement.children, n) : 0;
        n.style.setProperty('--reveal-delay', Math.min(sib, 8) * 70 + 'ms');
      }
    });

    var pending = nodes.slice();
    var ticking = false;

    /** 判定元素是否已进入（或越过）视口下沿 */
    function inView(n) {
      var r = n.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return true; // 不可见元素直接放行
      // 顶部留 8% 余量，等效于原来的 rootMargin
      return r.top < (window.innerHeight || document.documentElement.clientHeight) * 0.92
          && r.bottom > 0;
    }

    function sweep() {
      ticking = false;
      if (!pending.length) return;
      var rest = [];
      for (var i = 0; i < pending.length; i++) {
        var n = pending[i];
        if (inView(n)) n.classList.add('is-in');
        else rest.push(n);
      }
      pending = rest;
      if (!pending.length) teardown();
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sweep);
    }

    function teardown() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (io) io.disconnect();
    }

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) en.target.classList.add('is-in');
        });
        // 观测器只管「显示」，隐藏判定交给 sweep
        onScroll();
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
      nodes.forEach(function (n) { io.observe(n); });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // 首屏 + 布局稳定后各扫一次
    sweep();
    requestAnimationFrame(sweep);
    setTimeout(sweep, 260);
    window.addEventListener('load', function () { sweep(); setTimeout(sweep, 400); });

    // 终极保险：3 秒后仍未显示的，直接放行，绝不留下看不见的内容
    setTimeout(function () {
      pending.forEach(function (n) { n.classList.add('is-in'); });
      pending = [];
      teardown();
    }, 3000);
  }

  /* ======================================================================
   * 4. 手风琴
   * ==================================================================== */
  function initAccordion() {
    $$('.acc__head').forEach(function (head) {
      head.addEventListener('click', function () {
        var acc = head.closest('.acc');
        var open = acc.classList.toggle('is-open');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  /* ======================================================================
   * 5. 复制按钮
   * ==================================================================== */
  function initCopy() {
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.RS_CORE.copy(btn.getAttribute('data-copy'), btn);
      });
    });
  }

  /* ======================================================================
   * 6. 数字滚动
   * ==================================================================== */
  function initCountUp() {
    if (CFG.countUp === false) return;
    var nodes = $$('[data-count]');
    if (!nodes.length) return;

    var run = function (el) {
      var to = parseFloat(el.getAttribute('data-count')) || 0;
      var dur = 1400;
      var start = null;
      var dec = (el.getAttribute('data-dec') | 0);

      function frame(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (to * eased).toFixed(dec);
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = to.toFixed(dec);
      }
      requestAnimationFrame(frame);
    };

    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        run(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ======================================================================
   * 7. 返回顶部
   * ==================================================================== */
  function initToTop() {
    var btn = $('.to-top');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.classList.toggle('is-show', window.scrollY > 620);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ======================================================================
   * 8. 鼠标光晕 + 卡片追踪光
   * ==================================================================== */
  function initCursorFX() {
    if (CFG.cursorFX === false) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    // 全局光晕
    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    var gx = window.innerWidth / 2, gy = window.innerHeight / 2;
    var tx = gx, ty = gy;

    document.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      document.body.classList.add('has-cursor');
    }, { passive: true });

    (function loop() {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();

    // 卡片局部光
    $$('.card, .dl-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      }, { passive: true });
    });
  }

  /* ======================================================================
   * 9. 年份 / 版权
   * ==================================================================== */
  function initYear() {
    $$('[data-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ======================================================================
   * 10. 购卡占位（外链不是自家卡网，点击只提示，不跳转）
   * ==================================================================== */
  function initShopSoon() {
    function tip() {
      if (window.RS && window.RS.toast) {
        window.RS.toast('购卡通道筹备中，请进交流群了解', 'ok');
      } else {
        alert('购卡通道筹备中，请进交流群了解');
      }
    }
    $$('[data-shop-soon]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        tip();
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tip();
        }
      });
    });
  }

  /* ======================================================================
   * 11. 外链补 rel
   * ==================================================================== */
  function initDownloadLinks() {
    document.addEventListener('rs:config', function () {
      $$('a[target="_blank"]').forEach(function (a) {
        a.setAttribute('rel', 'noopener noreferrer');
      });
    });
  }

  /* ======================================================================
   * 启动
   * ----------------------------------------------------------------------
   * 顺序：先处理现有节点，再等 rs:config 异步渲染出卡片后补扫 [data-reveal]，
   * 否则动态节点永远等不到观察者，整块内容停在 opacity:0。
   * ==================================================================== */
  function init() {
    initNav();
    initAnnounce();
    initAccordion();
    initCopy();
    initCountUp();
    initToTop();
    initCursorFX();
    initYear();
    initShopSoon();
    initDownloadLinks();

    // 配置渲染是异步的，渲染完再扫一遍新增节点
    document.addEventListener('rs:config', function () {
      initReveal();
    });

    initReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
