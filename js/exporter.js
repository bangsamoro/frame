/* InstaFrame — canvas compositing engine.
   Draws the device chrome procedurally at 1:1 device pixels, then clips the
   page image into the screen rect. Everything is vector + local: no remote
   assets, no fonts to download, nothing leaves the browser. */
(function () {
  var IF = window.IF;
  var STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

  /* ---- helpers ----------------------------------------------------------- */

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function linGrad(ctx, x0, y0, x1, y1, stops) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  function fitRect(iw, ih, w, h, mode) {
    if (!iw || !ih) return { x: 0, y: 0, w: w, h: h };
    var cover = mode === 'fill';
    var s = cover ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    if (mode === 'top') s = w / iw;
    var dw = iw * s;
    var dh = ih * s;
    if (mode === 'top') return { x: (w - dw) / 2, y: 0, w: dw, h: dh };
    return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
  }

  /* ---- background -------------------------------------------------------- */

  function paintBackground(ctx, x, y, w, h, mode) {
    if (!mode || mode === 'transparent') return;
    if (mode === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      return;
    }
    if (mode === 'pale') {
      ctx.fillStyle = '#f5f5f7';
      ctx.fillRect(x, y, w, h);
      return;
    }
    if (mode === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, w, h);
      return;
    }
    if (mode === 'studio') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, w, h);
      var cx = x + w / 2;
      var cy = y + h * 0.38;
      var rad = Math.max(w, h) * 0.72;
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    }
  }

  /* ---- body / stand / base ---------------------------------------------- */

  function drawBody(ctx, dev, g, opts) {
    var f = dev.frame;
    var grad = linGrad(ctx, g.bodyX, 0, g.bodyX + g.bodyW * 0.55, g.bodyH, [
      [0, f.body[0]],
      [0.42, f.body[1]],
      [1, f.body[2] || f.body[1]]
    ]);
    rr(ctx, g.bodyX, 0, g.bodyW, g.bodyH, f.outer);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = f.rim;
    ctx.stroke();

    /* on a dark stage, add a rim light so the silhouette separates from black */
    if (opts && opts.shadowTone === 'light') {
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.52)';
      ctx.stroke();
      ctx.lineWidth = 9;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.stroke();
    }

    if (f.rails) {
      ctx.save();
      rr(ctx, g.bodyX, 0, g.bodyW, g.bodyH, f.outer);
      ctx.clip();
      var rl = linGrad(ctx, g.bodyX, 0, g.bodyX + 5, 0, [
        [0, 'rgba(255,255,255,0.30)'],
        [1, 'rgba(255,255,255,0)']
      ]);
      ctx.fillStyle = rl;
      ctx.fillRect(g.bodyX, 0, 5, g.bodyH);
      var rr2 = linGrad(ctx, g.bodyX + g.bodyW, 0, g.bodyX + g.bodyW - 5, 0, [
        [0, 'rgba(255,255,255,0.22)'],
        [1, 'rgba(255,255,255,0)']
      ]);
      ctx.fillStyle = rr2;
      ctx.fillRect(g.bodyX + g.bodyW - 5, 0, 5, g.bodyH);
      ctx.restore();
    }
  }

  function drawStand(ctx, dev, g) {
    var s = dev.stand;
    var cx = g.totalW / 2;
    var y = g.bodyH + s.gap;
    var metal = linGrad(ctx, cx - s.columnW / 2, y, cx + s.columnW / 2, y, [
      [0, s.metal[2]],
      [0.28, s.metal[0]],
      [0.72, s.metal[1]],
      [1, s.metal[2]]
    ]);
    rr(ctx, cx - s.columnW / 2, y - 6, s.columnW, s.columnH + 6, 6);
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.stroke();

    ctx.save();
    rr(ctx, cx - s.columnW / 2, y - 6, s.columnW, s.columnH + 6, 6);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    var n = 7;
    for (var i = 1; i < n; i++) {
      var yy = y + (s.columnH / n) * i - s.columnH / n / 2;
      ctx.fillRect(cx - s.columnW / 2, yy, s.columnW, 2);
    }
    ctx.restore();

    var fy = y + s.columnH;
    var foot = linGrad(ctx, 0, fy, 0, fy + s.footH, [
      [0, '#f0f0f3'],
      [0.4, s.metal[0]],
      [1, s.metal[2]]
    ]);
    rr(ctx, cx - s.footW / 2, fy, s.footW, s.footH, s.footH / 2);
    ctx.fillStyle = foot;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.stroke();
  }

  function drawBase(ctx, dev, g) {
    var b = dev.base;
    var cx = g.totalW / 2;
    var w = g.baseW;
    var x = cx - w / 2;
    var y = g.bodyH;

    ctx.fillStyle = '#232326';
    ctx.fillRect(g.bodyX + 6, y - 5, g.bodyW - 12, 9);

    var dy = y + b.gap;
    var deck = linGrad(ctx, 0, dy, 0, dy + b.height, [
      [0, b.deck[0]],
      [0.34, b.deck[1]],
      [1, b.deck[2]]
    ]);
    ctx.save();
    rr(ctx, x, dy, w, b.height, 4);
    ctx.fillStyle = deck;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, dy + b.height - 4, w, 4);
    ctx.restore();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    rr(ctx, x, dy, w, b.height, 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 52, dy);
    ctx.lineTo(cx + 52, dy);
    ctx.lineTo(cx + 46, dy + 7);
    ctx.lineTo(cx - 46, dy + 7);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();
  }

  /* ---- screen ------------------------------------------------------------ */

  function drawDemoScreen(ctx, r) {
    var w = r.w;
    var h = r.h;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x, r.y, w, h);

    var pad = Math.round(w * 0.07);
    var navH = Math.round(Math.min(72, h * 0.075));
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(r.x, r.y, w, navH);
    ctx.fillStyle = '#d2d2d7';
    ctx.fillRect(r.x + pad, r.y + navH / 2 - 4, Math.round(w * 0.16), 8);
    for (var i = 0; i < 3; i++) {
      ctx.fillRect(r.x + w - pad - (i + 1) * Math.round(w * 0.1), r.y + navH / 2 - 3, Math.round(w * 0.055), 6);
    }

    var titleSize = Math.max(15, Math.round(w * 0.062));
    var bodySize = Math.max(11, Math.round(w * 0.03));
    var ty = r.y + navH + Math.round(h * 0.11);
    ctx.fillStyle = '#1d1d1f';
    ctx.font = '600 ' + titleSize + 'px ' + STACK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Your page here', r.x + pad, ty);
    ctx.fillStyle = '#6e6e73';
    ctx.font = '400 ' + bodySize + 'px ' + STACK;
    ctx.fillText('Drop a screenshot, load a URL, or paste from the clipboard.', r.x + pad, ty + bodySize * 1.9);

    var cardY = ty + Math.round(h * 0.12);
    var cardW = Math.round((w - pad * 2 - pad * 0.6 * 2) / 3);
    var cardH = Math.max(Math.round(h * 0.2), 60);
    for (var c = 0; c < 3; c++) {
      var cxx = r.x + pad + c * (cardW + pad * 0.6);
      if (cxx + cardW > r.x + w - pad) break;
      rr(ctx, cxx, cardY, cardW, cardH, 10);
      ctx.fillStyle = '#f5f5f7';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#e8e8ed';
      ctx.stroke();
      ctx.fillStyle = '#d2d2d7';
      ctx.fillRect(cxx + 12, cardY + 14, cardW - 24, 7);
      ctx.fillRect(cxx + 12, cardY + 28, Math.round((cardW - 24) * 0.66), 7);
    }

    ctx.fillStyle = '#86868b';
    ctx.font = '500 ' + Math.max(10, Math.round(w * 0.024)) + 'px ' + STACK;
    ctx.textAlign = 'center';
    ctx.fillText('Sample page', r.x + w / 2, r.y + h - Math.round(h * 0.05));
    ctx.textAlign = 'left';
  }

  function drawScreen(ctx, dev, g, opts) {
    var r = g.screen;
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, dev.frame.screenRadius);
    ctx.clip();
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(r.x, r.y, r.w, r.h);

    if (opts.image) {
      var d = fitRect(opts.image.width, opts.image.height, r.w, r.h, opts.fit || 'top');
      ctx.drawImage(opts.image, r.x + d.x, r.y + d.y, d.w, d.h);
    } else {
      drawDemoScreen(ctx, r);
    }

    if (opts.sheen !== false) {
      var sh = linGrad(ctx, r.x, r.y, r.x + r.w * 0.75, r.y + r.h * 0.9, [
        [0, 'rgba(255,255,255,0.075)'],
        [0.42, 'rgba(255,255,255,0)']
      ]);
      ctx.fillStyle = sh;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, dev.frame.screenRadius);
    ctx.stroke();
  }

  /* ---- chrome (island / punch-hole / camera / buttons) ------------------ */

  function rail(ctx, x, y, w, h, horizontal) {
    rr(ctx, x, y, w, h, Math.min(w, h) / 2);
    ctx.fillStyle = '#101012';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
  }

  function drawChrome(ctx, dev, g) {
    var c = dev.frame.chrome;
    var cx = g.totalW / 2;

    if (c && c.lid) {
      var lx = cx - c.lid.notchW / 2;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx + c.lid.notchW, 0);
      ctx.lineTo(lx + c.lid.notchW - 8, c.lid.notchH);
      ctx.lineTo(lx + 8, c.lid.notchH);
      ctx.closePath();
      ctx.fillStyle = dev.frame.body[2] || '#191919';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, c.lid.notchH / 2 - 1, c.lid.camR, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0c';
      ctx.fill();
    }

    if (c && c.island) {
      var ix = cx - c.island.w / 2;
      rr(ctx, ix, c.island.top, c.island.w, c.island.h, c.island.h / 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      var lensX = ix + c.island.w - c.island.h / 2 - 4;
      var lensY = c.island.top + c.island.h / 2;
      var lens = ctx.createRadialGradient(lensX - 1.5, lensY - 1.5, 0.5, lensX, lensY, c.island.camR);
      lens.addColorStop(0, '#2c3550');
      lens.addColorStop(0.45, '#0d1018');
      lens.addColorStop(1, '#000000');
      ctx.beginPath();
      ctx.arc(lensX, lensY, c.island.camR, 0, Math.PI * 2);
      ctx.fillStyle = lens;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lensX + 1.2, lensY - 1.4, c.island.camR * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180,205,255,0.5)';
      ctx.fill();
    }

    if (c && c.punch) {
      var px = cx + (c.punch.offset || 0);
      var py = c.punch.top + c.punch.d / 2;
      ctx.beginPath();
      ctx.arc(px, py, c.punch.d / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      var pg = ctx.createRadialGradient(px - 1.5, py - 1.5, 0.4, px, py, c.punch.d / 2);
      pg.addColorStop(0, '#26304a');
      pg.addColorStop(0.5, '#0c0f16');
      pg.addColorStop(1, '#000000');
      ctx.beginPath();
      ctx.arc(px, py, c.punch.d / 2 - 0.6, 0, Math.PI * 2);
      ctx.fillStyle = pg;
      ctx.fill();
    }

    if (c && c.camera) {
      var camCX = dev.kind === 'tablet' ? cx : cx;
      var camCY = g.bezel / 2;
      ctx.beginPath();
      ctx.arc(camCX, camCY, c.camera.d / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0c';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(camCX - 0.8, camCY - 0.8, c.camera.d / 6.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,180,235,0.45)';
      ctx.fill();
    }

    (dev.frame.buttons || []).forEach(function (b) {
      if (b.side === 'left') {
        rail(ctx, g.bodyX - b.w + 1, b.top, b.w, b.h, false);
      } else if (b.side === 'right') {
        rail(ctx, g.bodyX + g.bodyW - 1, b.top, b.w, b.h, false);
      } else if (b.side === 'top') {
        var tx = g.bodyX + g.bodyW * (b.left || 0.5) - b.w / 2;
        rail(ctx, tx, -b.h + 1, b.w, b.h, true);
      }
    });
  }

  /* ---- composite --------------------------------------------------------- */

  function drawDevice(ctx, dev, opts) {
    var g = IF.geom(dev, opts);
    if (opts.shadow !== false) {
      ctx.save();
      /* on a dark stage a black shadow is invisible, so the device floats.
         A light halo reads as product-render separation instead. */
      ctx.shadowColor = opts.shadowTone === 'light' ? 'rgba(255,255,255,0.46)' : 'rgba(0,0,0,0.34)';
      ctx.shadowBlur = opts.shadowTone === 'light' ? 54 : 46;
      ctx.shadowOffsetY = opts.shadowTone === 'light' ? 6 : 20;
      rr(ctx, g.bodyX + 6, 8, g.bodyW - 12, g.bodyH - 12, dev.frame.outer);
      ctx.fillStyle = opts.shadowTone === 'light' ? 'rgba(255,255,255,0.06)' : '#000000';
      ctx.fill();
      ctx.restore();
    }
    if (dev.stand) drawStand(ctx, dev, g);
    drawBody(ctx, dev, g, opts);
    drawScreen(ctx, dev, g, opts);
    if (opts.chrome !== false) drawChrome(ctx, dev, g);
    if (dev.base) drawBase(ctx, dev, g);
    return g;
  }

  function compose(dev, opts) {
    opts = opts || {};
    var scale = opts.scale || 2;
    var bg = opts.background || 'transparent';
    if (opts.shadowTone == null) opts.shadowTone = (bg === 'black' || bg === 'studio') ? 'light' : 'dark';
    var pad = opts.pad == null ? (bg === 'transparent' ? 0 : 56) : opts.pad;
    /* a transparent PNG still carries the soft shadow, so leave room for it
       instead of clipping it at the canvas edge */
    if (bg === 'transparent' && opts.shadow !== false && pad < 30) pad = 30;
    var g0 = IF.geom(dev, opts);

    var captionH = opts.caption ? 58 : 0;
    var W = Math.round((g0.totalW + pad * 2) * scale);
    var H = Math.round((g0.totalH + pad * 2 + captionH) * scale);

    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, pad * scale, pad * scale);
    ctx.textBaseline = 'alphabetic';

    paintBackground(ctx, -pad, -pad, g0.totalW + pad * 2, g0.totalH + pad * 2 + captionH, bg);
    drawDevice(ctx, dev, opts);

    if (opts.caption) {
      var label = opts.captionText || (dev.name + ' · ' + (opts.orientation === 'portrait' ? dev.screen.h + ' × ' + dev.screen.w : dev.screen.w + ' × ' + dev.screen.h));
      var light = bg === 'black' || bg === 'studio' || bg === 'transparent';
      ctx.font = '500 15px ' + STACK;
      ctx.fillStyle = light ? 'rgba(255,255,255,0.62)' : '#6e6e73';
      ctx.textAlign = 'center';
      ctx.fillText(label, g0.totalW / 2 + pad, g0.totalH + pad + 34);
      ctx.textAlign = 'left';
    }

    return canvas;
  }

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (b) {
          if (b) resolve(b);
          else reject(new Error('encode-failed'));
        },
        type || 'image/png',
        quality
      );
    });
  }

  /* ---- rasterise a same-origin document (local HTML mode) ---------------- */

  function rasterizeDocument(doc, w, h) {
    return new Promise(function (resolve, reject) {
      var styles = [].slice.call(doc.querySelectorAll('style')).map(function (s) { return s.outerHTML; }).join('');
      var body = doc.body ? doc.body.innerHTML : '';
      body = body.replace(/<script[\s\S]*?<\/script>/gi, '');
      var cls = doc.body && doc.body.className ? ' class="' + doc.body.className + '"' : '';
      var inner =
        '<div xmlns="http://www.w3.org/1999/xhtml"' + cls +
        ' style="width:' + w + 'px;height:' + h + 'px;overflow:hidden;background:#ffffff;margin:0">' +
        styles + body + '</div>';
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
        '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' +
        inner + '</foreignObject></svg>';
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; reject(new Error('timeout')); }
      }, 9000);
      img.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('rasterize-failed'));
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  IF.export = {
    compose: compose,
    toBlob: toBlob,
    fitRect: fitRect,
    paintBackground: paintBackground,
    rasterizeDocument: rasterizeDocument
  };
})();
