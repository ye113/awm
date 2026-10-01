/* ==========================================================================
 * AWM 站点 · 站点配置装载与渲染
 * --------------------------------------------------------------------------
 * 内容来自 assets/js/config.js 的 window.RS_DATA（纯静态，无需服务器）。
 * ========================================================================== */
(function () {
  'use strict';

  /* 兜底：即使 RS_DATA 未加载也不至于整页崩 */
  var DEFAULTS = {
    site: {
      name: 'AWM',
      full_name: 'AWM 超自然辅助',
      tagline: '下载 · 功能 · 社区，一站直达',
      announcement: '',
      author: 'AWM 开发组',
      footer_note: '愿你我惺惺相惜'
    },
    version: { current: '0.1.0', date: '', size: '', platform: 'Windows 10 / 11 · x64' },
    downloads: [],
    game: {
      name: '超自然',
      desc: '官方客户端下载入口',
      official_url: 'https://www.chaoziran.com/',
      download_url: 'https://www.chaoziran.com/'
    },
    shop: { name: '购卡', desc: '', url: '#' },
    community: { qq_url: '#', qq_label: '加入交流群', qq_number: '' },
    highlights: []
  };

  function deepMerge(base, over) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (!over) return out;
    Object.keys(over).forEach(function (k) {
      var bv = base[k], ov = over[k];
      if (ov === undefined || ov === null) return;
      if (Array.isArray(ov)) out[k] = ov;
      else if (typeof ov === 'object' && typeof bv === 'object' && !Array.isArray(bv)) out[k] = deepMerge(bv || {}, ov);
      else out[k] = ov;
    });
    return out;
  }

  /* ======================================================================
   * 值解析：支持 "site.name" 这种点路径
   * ==================================================================== */
  function get(path) {
    var cur = window.RS;
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return '';
      cur = cur[parts[i]];
    }
    return cur == null ? '' : cur;
  }

  /* ======================================================================
   * 文本插值：{{ site.name }} / {{ version.current }}
   * ==================================================================== */
  function interpolate(str) {
    return String(str).replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (_, p) {
      var v = get(p);
      return typeof v === 'object' ? '' : v;
    });
  }

  /* ======================================================================
   * DOM 渲染
   * ==================================================================== */
  function renderBinds(root) {
    (root || document).querySelectorAll('[data-bind]').forEach(function (el) {
      var val = interpolate('{{ ' + el.getAttribute('data-bind') + ' }}');
      if (val === '' && el.hasAttribute('data-bind-hide-empty')) {
        el.style.display = 'none';
        return;
      }
      el.textContent = val;
    });

    (root || document).querySelectorAll('[data-bind-attr]').forEach(function (el) {
      // 格式：data-bind-attr="href:game.official_url,title:site.name"
      el.getAttribute('data-bind-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length < 2) return;
        var attr = bits[0].trim();
        var val = interpolate('{{ ' + bits.slice(1).join(':').trim() + ' }}');
        // 跳过空值与占位 #，避免把已有的真实 href 冲掉
        if (val && val !== '#') el.setAttribute(attr, val);
      });
    });

    (root || document).querySelectorAll('[data-bind-html]').forEach(function (el) {
      el.innerHTML = interpolate(el.getAttribute('data-bind-html'));
    });
  }

  /** 按模板渲染列表 */
  function renderLists(root) {
    (root || document).querySelectorAll('[data-list]').forEach(function (host) {
      var path = host.getAttribute('data-list');
      var items = get(path);
      if (!Array.isArray(items)) return;

      var tpl = host.querySelector('template[data-tpl]');
      if (!tpl) return;
      var frag = document.createDocumentFragment();

      items.forEach(function (item, idx) {
        var node = tpl.content.firstElementChild.cloneNode(true);
        bindItem(node, item, idx, path);
        frag.appendChild(node);
      });

      tpl.parentNode.querySelectorAll('[data-tpl-holder]').forEach(function (n) { n.remove(); });
      host.insertBefore(frag, tpl);
      host.setAttribute('data-list-ready', '1');
    });
  }

  function bindItem(node, item, idx, listPath) {
    if (typeof item !== 'object' || item === null) {
      node.innerHTML = interpolate(String(item));
      return;
    }
    var sub = listPath + '.' + idx;

    node.querySelectorAll('[data-item]').forEach(function (el) {
      var key = el.getAttribute('data-item');
      var val = item[key];
      if (val === undefined || val === null) val = '';

      if (el.hasAttribute('data-item-attr')) {
        el.getAttribute('data-item-attr').split(',').forEach(function (attr) {
          if (val) el.setAttribute(attr.trim(), val);
        });
      } else if (el.hasAttribute('data-item-html')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    // 条件显示：data-item-if="key" 有值才显示
    node.querySelectorAll('[data-item-if]').forEach(function (el) {
      if (!item[el.getAttribute('data-item-if')]) el.remove();
    });

    // 序列号
    node.querySelectorAll('[data-item-idx]').forEach(function (el) {
      el.textContent = String(idx + 1).padStart(2, '0');
    });

    // 递归子列表
    node.querySelectorAll('[data-sublist]').forEach(function (host) {
      var key = host.getAttribute('data-sublist');
      var arr = item[key];
      if (!Array.isArray(arr)) return;
      var tpl = host.querySelector('template[data-tpl]');
      if (!tpl) return;
      var frag = document.createDocumentFragment();
      arr.forEach(function (sub2) {
        var n = tpl.content.firstElementChild.cloneNode(true);
        if (typeof sub2 === 'object') bindItem(n, sub2, 0, sub);
        else n.textContent = String(sub2);
        frag.appendChild(n);
      });
      host.insertBefore(frag, tpl);
    });

    node.setAttribute('data-idx', idx);
    return sub;
  }

  /* ======================================================================
   * 通用交互
   * ==================================================================== */

  /** 复制文本并给按钮反馈 */
  function copyText(text, btn) {
    var done = function () {
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = '已复制';
        btn.classList.add('is-copied');
        setTimeout(function () {
          btn.textContent = orig;
          btn.classList.remove('is-copied');
        }, 1600);
      }
      window.RS.toast && window.RS.toast('已复制：' + text, 'ok');
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-2000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* 静默 */ }
    document.body.removeChild(ta);
  }

  /* ======================================================================
   * Toast
   * ==================================================================== */
  function toast(msg, kind) {
    var host = document.querySelector('.toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 320);
    }, 2000);
  }

  /* ======================================================================
   * 启动：直接用 config.js 里的 RS_DATA，不依赖 fetch / 后端
   * ==================================================================== */
  function boot() {
    window.RS = deepMerge(DEFAULTS, window.RS_DATA || {});
    window.RS.get = get;
    window.RS.toast = toast;
    window.RS.copy = copyText;
    renderBinds(document);
    renderLists(document);
    document.dispatchEvent(new CustomEvent('rs:config', { detail: window.RS }));
    return Promise.resolve(window.RS);
  }

  window.RS_CORE = {
    boot: boot,
    renderBinds: renderBinds,
    renderLists: renderLists,
    interpolate: interpolate,
    get: get,
    toast: toast,
    copy: copyText
  };
})();
