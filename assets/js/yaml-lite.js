/* ==========================================================================
 * AWM 站点 · config.yml 极简解析器
 * --------------------------------------------------------------------------
 * 只支持本站用到的 YAML 子集：
 *   key: value
 *   key: "quoted value"
 *   list:
 *     - item
 *     - key: value
 *         other: value
 * 嵌套靠缩进（2 空格一层）。不支持锚点 / 多行块 / 复杂类型。
 * ========================================================================== */
(function () {
  'use strict';

  function stripComment(line) {
    var out = '';
    var inS = false, inD = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === "'" && !inD) inS = !inS;
      else if (ch === '"' && !inS) inD = !inD;
      else if (ch === '#' && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) break;
      out += ch;
    }
    return out;
  }

  function unquote(v) {
    v = v.trim();
    if (v.length >= 2) {
      var a = v[0], b = v[v.length - 1];
      if ((a === '"' && b === '"') || (a === "'" && b === "'")) v = v.slice(1, -1);
    }
    return v;
  }

  function cast(v) {
    v = unquote(v);
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null' || v === '~') return null;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }

  /**
   * 解析 YAML 子集。
   * @param {string} text
   * @returns {object}
   */
  function parse(text) {
    var root = {};
    // 栈元素：{ indent, container }
    var stack = [{ indent: -1, node: root }];
    var lines = String(text).replace(/\r\n?/g, '\n').split('\n');

    for (var i = 0; i < lines.length; i++) {
      var raw = stripComment(lines[i]);
      if (!raw.trim()) continue;

      var indent = raw.match(/^ */)[0].length;
      var body = raw.trim();

      // 弹栈到合适的父级
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      var parent = stack[stack.length - 1].node;

      // ── 列表项 ──
      if (body === '-' || body.slice(0, 2) === '- ') {
        var rest = body.slice(1).trim();
        if (!Array.isArray(parent)) {
          // 父节点是对象但没有对应 key —— 兼容写法：把父对象当数组用（少见）
          continue;
        }
        if (!rest) {
          // 空项：后面跟缩进块
          var emptyItem = {};
          parent.push(emptyItem);
          stack.push({ indent: indent, node: emptyItem });
          continue;
        }
        var ci = rest.indexOf(':');
        if (ci > 0) {
          var ik = rest.slice(0, ci).trim();
          var iv = rest.slice(ci + 1).trim();
          var item = {};
          item[ik] = iv ? cast(iv) : {};
          parent.push(item);
          stack.push({ indent: indent, node: iv ? item : item[ik] });
          if (!iv) stack[stack.length - 1].node = item[ik];
          // 该项后续同缩进键归入 item
          if (iv) stack[stack.length - 1].node = item;
        } else {
          parent.push(cast(rest));
        }
        continue;
      }

      // ── 键值对 ──
      var ci2 = body.indexOf(':');
      if (ci2 < 0) continue;
      var key = body.slice(0, ci2).trim();
      var val = body.slice(ci2 + 1).trim();

      if (val) {
        parent[key] = cast(val);
      } else {
        // 空值：看下一有效行是不是列表项
        var nextIsList = false;
        for (var j = i + 1; j < lines.length; j++) {
          var nl = stripComment(lines[j]);
          if (!nl.trim()) continue;
          var ni = nl.match(/^ */)[0].length;
          nextIsList = ni >= indent && nl.trim().slice(0, 2) === '- ';
          break;
        }
        var child = nextIsList ? [] : {};
        parent[key] = child;
        stack.push({ indent: indent, node: child });
      }
    }

    return root;
  }

  /**
   * 拉取并解析 config.yml。
   * @param {string} [url]
   * @returns {Promise<object>}
   */
  function load(url) {
    var u = url || (window.RS_CONFIG && window.RS_CONFIG.base || '/') + 'config.yml';
    return fetch(u + (u.indexOf('?') < 0 ? '?v=' + Date.now() : ''), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('config.yml HTTP ' + r.status);
        return r.text();
      })
      .then(parse);
  }

  window.RS_YAML = { parse: parse, load: load };
})();
