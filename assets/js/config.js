/* ==========================================================================
 * AWM 站点 · 全部内容配置（纯静态，不依赖服务器）
 * --------------------------------------------------------------------------
 * 改下载链接 / QQ 群 / 版本号 —— 只改这个文件，刷新即可。
 * Cloudflare Pages / GitHub Pages 直接托管根目录，无需构建后端。
 * ========================================================================== */
window.RS_CONFIG = {
  /* 资源相对路径前缀。独立域名或仓库根目录部署保持 "./" 即可。 */
  base: './',

  /* 载入动画：'once' | true | false */
  loader: 'once',
  loaderMinMs: 2050,
  loaderMaxMs: 6000,

  cursorFX: true,
  countUp: true
};

/* 站点内容 */
window.RS_DATA = {
  site: {
    name: 'AWM',
    full_name: 'AWM 超自然辅助',
    tagline: '下载 · 功能 · 社区，一站直达',
    announcement: '公益期内置卡登录，卡密随意输入即可进入',
    author: 'AWM 开发组',
    footer_note: '愿你我惺惺相惜'
  },

  version: {
    current: '0.1.0',
    date: '2026-10-01',
    size: '11.2 MB',
    platform: 'Windows 10 / 11 · x64'
  },

  /* 只有一个下载入口，蓝奏直链，无需提取码 */
  downloads: [
    {
      id: 'awm-full',
      name: 'AWM 完整包',
      desc: '启动器 + 注入器 + 配置，解压即用',
      url: 'https://wwbeq.lanzoub.com/ibrW34ajj2sd',
      tag: '推荐',
      primary: true
    }
  ],

  game: {
    name: '超自然',
    desc: '官方客户端下载入口，请以官网版本为准',
    official_url: 'https://www.chaoziran.com/',
    download_url: 'https://www.chaoziran.com/'
  },

  shop: {
    name: '购卡',
    desc: '购卡通道筹备中，请进交流群了解',
    url: ''
  },

  community: {
    qq_url: 'https://qm.qq.com/q/47gswt0Qw8',
    qq_label: '点击链接加入群聊【古德猫宁】',
    qq_number: '1109329652'
  },

  highlights: [
    { icon: '🎯', title: '自研预测', desc: '按距离分段设置弹速，拉枪更稳', url: './features.html#aimbot' },
    { icon: '🌀', title: '内存 / 静默', desc: '两种瞄准方式，独立热键随时切换', url: './features.html#aimbot' },
    { icon: '📊', title: '可调字体', desc: '字号、透明度、组间距全部可调', url: './features.html#draw' },
    { icon: '👁️', title: '视觉增强', desc: '地图除雾、广角视野、超级夜视', url: './features.html#memory' },
    { icon: '🧭', title: '传送导航', desc: '高价值阈值筛选 + 导航线粗细', url: './features.html#teleport' },
    { icon: '🙌', title: '快捷操作', desc: '一键开棺、一键发力、秒交互', url: './features.html#memory' }
  ]
};
