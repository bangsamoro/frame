/* InstaFrame — device library.
   Every number here is a real device figure: mockup viewport (CSS px),
   native panel resolution, pixel density. The frame block describes the
   physical bezel so the same geometry can drive both the DOM preview and
   the canvas export. */
(function () {
  var IF = (window.IF = window.IF || {});

  var DEVICES = [
    {
      id: 'pro-display-xdr',
      name: 'Pro Display XDR',
      vendor: 'Apple',
      kind: 'display',
      traits: '32-inch 6K panel · Pro Stand · thin uniform bezel',
      screen: { w: 1600, h: 900 },
      native: '6016 × 3384',
      ppi: 218,
      dpr: 2,
      frame: {
        bezel: 13,
        outer: 8,
        screenRadius: 3,
        body: ['#34343a', '#1b1b1e', '#121214'],
        rim: 'rgba(255,255,255,0.16)',
        rails: false,
        chrome: null,
        buttons: []
      },
      stand: {
        gap: 0,
        columnW: 104,
        columnH: 176,
        footW: 300,
        footH: 18,
        metal: ['#e2e2e6', '#b4b4ba', '#8e8e94']
      }
    },
    {
      id: 'macbook-air-13',
      name: 'MacBook Air 13"',
      vendor: 'Apple',
      kind: 'laptop',
      traits: 'Liquid Retina · 1080p camera notch · aluminum deck',
      screen: { w: 1280, h: 832 },
      native: '2560 × 1664',
      ppi: 224,
      dpr: 2,
      frame: {
        bezel: 10,
        outer: 14,
        screenRadius: 4,
        body: ['#333338', '#212125', '#191919'],
        rim: 'rgba(255,255,255,0.14)',
        rails: false,
        chrome: { lid: { notchW: 150, notchH: 16, camR: 2.5 } },
        buttons: []
      },
      base: {
        ratio: 1.11,
        gap: 0,
        height: 26,
        deck: ['#e8e8ec', '#c6c6cb', '#9d9da3']
      }
    },
    {
      id: 'ipad-pro',
      name: 'iPad Pro',
      vendor: 'Apple',
      kind: 'tablet',
      traits: '12.9-inch Liquid Retina · punched camera · USB-C edge',
      screen: { w: 1366, h: 1024 },
      native: '2732 × 2048',
      ppi: 264,
      dpr: 2,
      orientations: ['landscape', 'portrait'],
      frame: {
        bezel: 16,
        outer: 30,
        screenRadius: 14,
        body: ['#3c3c41', '#252529', '#1b1b1e'],
        rim: 'rgba(255,255,255,0.15)',
        rails: false,
        chrome: { camera: { d: 7, inset: 8 } },
        buttons: [
          { side: 'right', top: 132, h: 30, w: 4 },
          { side: 'right', top: 176, h: 30, w: 4 },
          { side: 'top', left: 0.56, w: 46, h: 4 }
        ]
      }
    },
    {
      id: 'iphone-15',
      name: 'iPhone 15',
      vendor: 'Apple',
      kind: 'phone',
      traits: '6.1-inch Super Retina XDR · Dynamic Island · Action button',
      screen: { w: 393, h: 852 },
      native: '1179 × 2556',
      ppi: 460,
      dpr: 3,
      frame: {
        bezel: 12,
        outer: 55,
        screenRadius: 43,
        body: ['#3a3a3f', '#242428', '#191a1c'],
        rim: 'rgba(255,255,255,0.18)',
        rails: false,
        chrome: { island: { w: 124, h: 36, top: 22, camR: 5.5 } },
        buttons: [
          { side: 'left', top: 168, h: 30, w: 4 },
          { side: 'left', top: 216, h: 58, w: 4 },
          { side: 'left', top: 286, h: 58, w: 4 },
          { side: 'right', top: 248, h: 96, w: 4 }
        ]
      }
    },
    {
      id: 'galaxy-s24-ultra',
      name: 'Galaxy S24 Ultra',
      vendor: 'Samsung',
      kind: 'phone',
      traits: '6.8-inch QHD+ · flat titanium rails · centred punch-hole',
      screen: { w: 384, h: 832 },
      native: '1440 × 3120',
      ppi: 505,
      dpr: 3.75,
      frame: {
        bezel: 8,
        outer: 26,
        screenRadius: 18,
        body: ['#4b4b4f', '#303034', '#232326'],
        rim: 'rgba(255,255,255,0.22)',
        rails: true,
        chrome: { punch: { d: 13, top: 19, offset: 0 } },
        buttons: [
          { side: 'right', top: 246, h: 62, w: 3 },
          { side: 'right', top: 322, h: 104, w: 3 }
        ]
      }
    },
    {
      id: 'pixel-8',
      name: 'Pixel 8',
      vendor: 'Google',
      kind: 'phone',
      traits: '6.2-inch Actua · centred punch-hole · polished aluminium frame',
      screen: { w: 412, h: 915 },
      native: '1080 × 2400',
      ppi: 428,
      dpr: 2.625,
      frame: {
        bezel: 11,
        outer: 44,
        screenRadius: 33,
        body: ['#4d4d52', '#33333a', '#242428'],
        rim: 'rgba(255,255,255,0.2)',
        rails: false,
        chrome: { punch: { d: 15, top: 20, offset: 0 } },
        buttons: [
          { side: 'right', top: 232, h: 74, w: 3.5 },
          { side: 'right', top: 322, h: 100, w: 3.5 }
        ]
      }
    }
  ];

  /* ---- geometry ---------------------------------------------------------- */

  function geom(dev, opts) {
    opts = opts || {};
    var portrait = opts.orientation === 'portrait';
    var sw = portrait ? dev.screen.h : dev.screen.w;
    var sh = portrait ? dev.screen.w : dev.screen.h;
    var b = dev.frame.bezel;
    var bodyW = sw + b * 2;
    var bodyH = sh + b * 2;
    var totalW = bodyW;
    var totalH = bodyH;
    var bodyX = 0;
    var baseW = 0;

    if (dev.base) {
      baseW = Math.round(bodyW * dev.base.ratio);
      totalW = Math.max(totalW, baseW);
    }
    if (dev.stand) {
      totalW = Math.max(totalW, dev.stand.footW);
    }
    bodyX = (totalW - bodyW) / 2;

    if (dev.stand) {
      totalH += dev.stand.gap + dev.stand.columnH + dev.stand.footH;
    }
    if (dev.base) {
      totalH += dev.base.gap + dev.base.height;
    }

    return {
      totalW: totalW,
      totalH: totalH,
      bodyX: bodyX,
      bodyY: 0,
      bodyW: bodyW,
      bodyH: bodyH,
      baseW: baseW,
      bezel: b,
      portrait: portrait,
      screen: { x: bodyX + b, y: b, w: sw, h: sh }
    };
  }

  IF.DEVICES = DEVICES;
  IF.geom = geom;
  IF.deviceById = function (id) {
    for (var i = 0; i < DEVICES.length; i++) if (DEVICES[i].id === id) return DEVICES[i];
    return null;
  };
  IF.viewportLabel = function (dev, g) {
    return g.screen.w + ' × ' + g.screen.h;
  };
})();
