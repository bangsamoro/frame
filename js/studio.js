/* InstaFrame — studio controller.
   Live multi-device viewer (DOM + iframes) and mockup composer (canvas).
   Both renderers read the same geometry from js/devices.js. */
(function () {
  var IF = window.IF;
  var STORE = 'instaframe.v1';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var el = function (tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; };

  var state = {
    source: 'url',
    url: '',
    recent: [],
    image: null,
    imageName: '',
    htmlBlobUrl: null,
    htmlName: '',
    selected: ['iphone-15', 'galaxy-s24-ultra'],
    mode: 'mock',
    frameSupport: null,
    demoUrl: '',
    fit: 'top',
    background: 'transparent',
    chrome: true,
    shadow: true,
    label: false,
    scale: 2,
    zoom: 'fit',
    orientation: 'landscape'
  };

  var els = {};
  var sig = '';
  var lastBlobUrl = null;

  /* ---- persistence ------------------------------------------------------- */

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        url: state.url,
        recent: state.recent,
        selected: state.selected,
        source: state.source,
        mode: state.mode,
        fit: state.fit,
        background: state.background,
        chrome: state.chrome,
        shadow: state.shadow,
        label: state.label,
        scale: state.scale,
        orientation: state.orientation
      }));
    } catch (e) { /* storage disabled — the studio still works */ }
  }

  function restore() {
    var raw;
    try { raw = localStorage.getItem(STORE); } catch (e) { return; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    ['url', 'source', 'fit', 'background', 'scale', 'orientation', 'mode', 'zoom'].forEach(function (k) {
      if (typeof data[k] === 'string' && data[k]) state[k] = data[k];
    });
    if (Array.isArray(data.recent)) state.recent = data.recent.slice(0, 4);
    if (Array.isArray(data.selected) && data.selected.length) state.selected = data.selected;
    ['chrome', 'shadow', 'label'].forEach(function (k) {
      if (typeof data[k] === 'boolean') state[k] = data[k];
    });
  }

  /* ---- status ------------------------------------------------------------ */

  function say(msg) {
    els.status.textContent = '';
    window.setTimeout(function () { els.status.textContent = msg; }, 30);
  }

  function notice(msg, kind) {
    if (!msg) {
      els.notice.hidden = true;
      els.notice.textContent = '';
      return;
    }
    els.notice.hidden = false;
    els.notice.className = 'notice' + (kind ? ' notice--' + kind : '');
    els.notice.textContent = msg;
  }

  /* ---- source helpers ---------------------------------------------------- */

  function liveSrc() {
    if (state.source === 'html') return state.htmlBlobUrl || '';
    if (state.source === 'url') return state.demoUrl || state.url || '';
    return '';
  }

  function selectedDevices() {
    return IF.DEVICES.filter(function (d) { return state.selected.indexOf(d.id) !== -1; });
  }

  function geomFor(dev) {
    return IF.geom(dev, { orientation: state.orientation });
  }

  /* ---- device chips ------------------------------------------------------ */

  var ICONS = {
    display: 'M3 4.5h18v11H3zM8.5 19.5h7M12 15.5v4',
    laptop: 'M4.5 5.5h15v9h-15zM2.5 18.5h19l-1.5-4H4z',
    tablet: 'M6 3.5h12v17H6zM11 18.4h2',
    phone: 'M8 3.5h8v17H8zM11 18.6h2'
  };

  function icon(kind, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size || 18);
    svg.setAttribute('height', size || 18);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[kind] || ICONS.phone);
    svg.appendChild(p);
    return svg;
  }

  function renderDeviceChips() {
    els.deviceList.innerHTML = '';
    IF.DEVICES.forEach(function (dev, i) {
      var on = state.selected.indexOf(dev.id) !== -1;
      var chip = el('button', 'chip' + (on ? ' is-on' : ''));
      chip.type = 'button';
      chip.setAttribute('role', 'switch');
      chip.setAttribute('aria-checked', on ? 'true' : 'false');
      chip.setAttribute('aria-label', dev.name + ' frame, ' + dev.screen.w + ' by ' + dev.screen.h + ' viewport');
      chip.dataset.id = dev.id;

      chip.appendChild(icon(dev.kind, 18));
      var text = el('span', 'chip__text');
      var nm = el('span', 'chip__name');
      nm.textContent = dev.name;
      var vp = el('span', 'chip__meta');
      vp.textContent = dev.screen.w + ' × ' + dev.screen.h + ' · ' + dev.vendor;
      text.appendChild(nm);
      text.appendChild(vp);
      chip.appendChild(text);

      var kbd = el('span', 'chip__kbd');
      kbd.setAttribute('aria-hidden', 'true');
      kbd.textContent = String(i + 1);
      chip.appendChild(kbd);

      chip.addEventListener('click', function () { toggleDevice(dev.id); });
      els.deviceList.appendChild(chip);
    });

    var rotatable = selectedDevices().filter(function (d) { return d.orientations; }).length > 0;
    els.orientationRow.hidden = !rotatable;
  }

  function toggleDevice(id) {
    var i = state.selected.indexOf(id);
    if (i === -1) state.selected.push(id);
    else state.selected.splice(i, 1);
    state.selected = IF.DEVICES.filter(function (d) { return state.selected.indexOf(d.id) !== -1; }).map(function (d) { return d.id; });
    renderDeviceChips();
    renderStage(true);
    save();
  }

  /* ---- device shell builder (shared geometry) ---------------------------- */

  function bodyGradient(dev) {
    var b = dev.frame.body;
    return 'linear-gradient(155deg,' + b[0] + ' 0%,' + b[1] + ' 44%,' + (b[2] || b[1]) + ' 100%)';
  }

  function buildShell(dev, g, screenNode) {
    var f = dev.frame;
    var shell = el('div', 'dev');
    shell.style.width = g.totalW + 'px';
    shell.style.height = g.totalH + 'px';

    if (dev.stand) {
      var s = dev.stand;
      var col = el('div', 'dev__stand-col');
      col.style.width = s.columnW + 'px';
      col.style.height = (s.columnH + 6) + 'px';
      col.style.left = ((g.totalW - s.columnW) / 2) + 'px';
      col.style.top = (g.bodyH - 6) + 'px';
      col.style.background = 'linear-gradient(90deg,' + s.metal[2] + ',' + s.metal[0] + ' 30%,' + s.metal[1] + ' 72%,' + s.metal[2] + ')';
      shell.appendChild(col);

      var foot = el('div', 'dev__stand-foot');
      foot.style.width = s.footW + 'px';
      foot.style.height = s.footH + 'px';
      foot.style.left = ((g.totalW - s.footW) / 2) + 'px';
      foot.style.top = (g.bodyH + s.columnH) + 'px';
      foot.style.background = 'linear-gradient(180deg,#f0f0f3,' + s.metal[0] + ' 40%,' + s.metal[2] + ')';
      shell.appendChild(foot);
    }

    var body = el('div', 'dev__body');
    body.style.left = g.bodyX + 'px';
    body.style.top = '0px';
    body.style.width = g.bodyW + 'px';
    body.style.height = g.bodyH + 'px';
    body.style.padding = g.bezel + 'px';
    body.style.borderRadius = f.outer + 'px';
    body.style.background = bodyGradient(dev);
    body.style.setProperty('--rim', f.rim);

    var screen = el('div', 'dev__screen');
    screen.style.borderRadius = f.screenRadius + 'px';
    if (screenNode) screen.appendChild(screenNode);
    else {
      var ph = el('div', 'dev__screen-ph');
      ph.textContent = 'Awaiting page';
      screen.appendChild(ph);
    }
    body.appendChild(screen);

    var c = f.chrome || {};
    if (c.island) {
      var isl = el('span', 'dev__island');
      isl.style.width = c.island.w + 'px';
      isl.style.height = c.island.h + 'px';
      isl.style.top = c.island.top + 'px';
      body.appendChild(isl);
    }
    if (c.punch) {
      var pu = el('span', 'dev__punch');
      pu.style.width = c.punch.d + 'px';
      pu.style.height = c.punch.d + 'px';
      pu.style.top = c.punch.top + 'px';
      pu.style.marginLeft = (c.punch.offset || 0) + 'px';
      body.appendChild(pu);
    }
    if (c.camera) {
      var cam = el('span', 'dev__cam');
      cam.style.width = c.camera.d + 'px';
      cam.style.height = c.camera.d + 'px';
      cam.style.top = ((g.bezel - c.camera.d) / 2) + 'px';
      body.appendChild(cam);
    }
    if (c.lid) {
      var notch = el('span', 'dev__notch');
      notch.style.width = c.lid.notchW + 'px';
      notch.style.height = c.lid.notchH + 'px';
      notch.style.background = f.body[2] || f.body[1];
      body.appendChild(notch);
    }
    shell.appendChild(body);

    (f.buttons || []).forEach(function (b) {
      var railEl = el('span', 'dev__btn');
      if (b.side === 'left') {
        railEl.style.left = (g.bodyX - b.w + 1) + 'px';
        railEl.style.top = b.top + 'px';
        railEl.style.width = b.w + 'px';
        railEl.style.height = b.h + 'px';
      } else if (b.side === 'right') {
        railEl.style.left = (g.bodyX + g.bodyW - 1) + 'px';
        railEl.style.top = b.top + 'px';
        railEl.style.width = b.w + 'px';
        railEl.style.height = b.h + 'px';
      } else {
        railEl.style.left = (g.bodyX + g.bodyW * (b.left || 0.5) - b.w / 2) + 'px';
        railEl.style.top = (-b.h + 1) + 'px';
        railEl.style.width = b.w + 'px';
        railEl.style.height = b.h + 'px';
      }
      shell.appendChild(railEl);
    });

    if (dev.base) {
      var deck = el('div', 'dev__deck');
      deck.style.width = g.baseW + 'px';
      deck.style.height = dev.base.height + 'px';
      deck.style.left = ((g.totalW - g.baseW) / 2) + 'px';
      deck.style.top = (g.bodyH + dev.base.gap) + 'px';
      deck.style.background = 'linear-gradient(180deg,' + dev.base.deck[0] + ',' + dev.base.deck[1] + ' 34%,' + dev.base.deck[2] + ')';
      shell.appendChild(deck);

      var hinge = el('div', 'dev__hinge');
      hinge.style.width = (g.bodyW - 12) + 'px';
      hinge.style.left = (g.bodyX + 6) + 'px';
      hinge.style.top = (g.bodyH - 5) + 'px';
      shell.appendChild(hinge);
    }

    return shell;
  }

  /* ---- live frames ------------------------------------------------------- */

  /* A self-contained page rendered from memory. It needs no network, so the
     live viewer has something real to show even offline. */
  var SAMPLE_PAGE = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>InstaFrame sample page</title><style>',
    '*{box-sizing:border-box}body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",Helvetica,Arial,sans-serif;color:#1d1d1f;background:#fff}',
    'header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 22px;border-bottom:1px solid #e8e8ed}',
    'b{font-size:15px;letter-spacing:-.01em}',
    '.vw{font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0071e3;border:1px solid #cfe4fb;background:#f4f9ff;border-radius:980px;padding:6px 12px;white-space:nowrap}',
    'main{padding:38px 22px 44px;max-width:980px;margin:0 auto}',
    'h1{font-size:clamp(26px,5.2vw,46px);line-height:1.08;letter-spacing:-.02em;margin:0 0 12px}',
    'p.lede{color:#6e6e73;max-width:56ch;margin:0}',
    '.grid{display:grid;gap:14px;margin-top:34px;grid-template-columns:1fr}',
    '@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}',
    '@media(min-width:1000px){.grid{grid-template-columns:repeat(3,1fr)}main{padding-left:40px;padding-right:40px}}',
    '.card{border:1px solid #e8e8ed;border-radius:14px;padding:18px;background:#fbfbfd}',
    '.card h2{font-size:16px;margin:0 0 6px;letter-spacing:-.01em}.card p{margin:0;color:#6e6e73;font-size:14px}',
    'footer{padding:22px;border-top:1px solid #e8e8ed;color:#86868b;font-size:13px}',
    '</style></head><body>',
    '<header><b>InstaFrame sample page</b><span class="vw" id="vw">–</span></header>',
    '<main><h1>This page reflows for every frame.</h1>',
    '<p class="lede">One document, six viewports. The badge in the header reports the width this copy is being rendered at, so you can watch the grid go from one column to three as the frames get wider.</p>',
    '<div class="grid">',
    '<div class="card"><h2>One column under 640</h2><p>Phones stack the cards and shorten the measure. Text stays inside 56 characters per line.</p></div>',
    '<div class="card"><h2>Two columns from 640</h2><p>Tablets in portrait get a two-up grid with the same type scale.</p></div>',
    '<div class="card"><h2>Three columns from 1000</h2><p>The desktop frames spread the same three cards across the full width.</p></div>',
    '</div></main>',
    '<footer>Sample content, shipped inside InstaFrame. No network involved.</footer>',
    '<script>function u(){document.getElementById("vw").textContent=window.innerWidth+" \u00d7 "+window.innerHeight+" px";}u();addEventListener("resize",u);<\/script>',
    '</body></html>'
  ].join('');

  /* Can this document host an iframe at all? A host that ships a restrictive
     frame-src will silently refuse every frame, including local ones, so the
     live viewer has to know before it promises anything. */
  function detectFrameSupport() {
    return new Promise(function (resolve) {
      var probe = document.createElement('iframe');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:8px;height:8px;border:0';
      probe.setAttribute('title', 'frame support probe');
      probe.setAttribute('aria-hidden', 'true');
      var settled = false;
      var timer = window.setTimeout(function () { finish(false); }, 1400);
      function finish(ok) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        try { probe.parentNode.removeChild(probe); } catch (e) { /* already gone */ }
        resolve(ok);
      }
      probe.addEventListener('load', function () {
        var title = '';
        try { title = probe.contentDocument ? probe.contentDocument.title : ''; } catch (e) { title = ''; }
        finish(title === 'instaframe-probe');
      });
      var blob = new Blob(['<!doctype html><title>instaframe-probe</title>'], { type: 'text/html' });
      probe.src = URL.createObjectURL(blob);
      document.body.appendChild(probe);
    });
  }

  function goToScreenshot() {
    state.source = 'image';
    state.mode = 'mock';
    syncControls();
    renderStage(true);
    try { els.dropZone.focus(); } catch (e) { /* focus is best effort */ }
    say('Drop a screenshot or paste one with ⌘V — the composer takes it from there.');
  }

  function overlayCard(kind, src) {
    var card = el('div', 'frame__overlay');
    var title = el('h4', 'frame__overlay-title');
    var body = el('p', 'frame__overlay-text');
    var actions = el('div', 'frame__overlay-actions');

    if (kind === 'env') {
      title.textContent = 'This host blocks frames';
      body.textContent = 'Its Content-Security-Policy only allows frames from a single origin, so no site can be embedded here. The mockup composer is unaffected — and the live viewer works if you open this file locally or host it yourself.';
      actions.appendChild(overlayBtn('Use the mockup composer', goToScreenshot));
    } else {
      title.textContent = 'This site refuses to be embedded';
      body.textContent = 'It answered with X-Frame-Options or a frame-ancestors rule. Open it in a tab, take a screenshot, and drop it in — the frame chrome is identical.';
      actions.appendChild(overlayBtn('Use a screenshot', goToScreenshot));
    }
    if (src) {
      var link = el('a', 'frame__overlay-link');
      link.href = src;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = kind === 'env' ? 'Open the page ↗' : 'Open in a new tab';
      actions.appendChild(link);
    }
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);
    return card;
  }

  function overlayBtn(label, fn) {
    var b = el('button', 'btn btn--sm frame__overlay-btn');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function liveFrame(dev) {
    var g = geomFor(dev);
    var src = liveSrc();
    var supportsFrames = state.frameSupport !== false;
    var frame = el('div', 'frame frame--live');
    var stage = el('div', 'frame__stage');
    var wrap = el('div', 'frame__scale');
    var iframe = null;

    if (supportsFrames) {
      iframe = el('iframe', 'dev__iframe');
      iframe.setAttribute('title', dev.name + ' live preview');
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.setAttribute('loading', 'eager');
      iframe.style.width = g.screen.w + 'px';
      iframe.style.height = g.screen.h + 'px';
      iframe.src = src;
    }

    var shell = buildShell(dev, g, iframe || el('div', 'dev__no-frame'));
    shell.dataset.dev = dev.id;
    wrap.appendChild(shell);
    stage.appendChild(wrap);
    if (!supportsFrames) stage.appendChild(overlayCard('env', src));
    frame.appendChild(stage);

    var meta = el('div', 'frame__meta');
    var id = el('span', 'frame__meta-id');
    id.textContent = dev.name + ' · ' + g.screen.w + ' × ' + g.screen.h;
    meta.appendChild(id);
    if (src) {
      var open = el('a', 'frame__meta-link');
      open.href = src;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.textContent = 'Open ↗';
      meta.appendChild(open);
    }
    frame.appendChild(meta);

    if (iframe && src) {
      var settled = false;
      var timer = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        if (stage.querySelector('.frame__overlay')) return;
        stage.appendChild(overlayCard('refused', src));
      }, 5000);
      iframe.addEventListener('load', function () {
        settled = true;
        window.clearTimeout(timer);
      });
    }

    return frame;
  }

  /* ---- stage: mockup frames (canvas, WYSIWYG with the export) ----------- */

  function mockCanvas(dev) {
    var g = geomFor(dev);
    var canvas = IF.export.compose(dev, {
      image: state.image,
      fit: state.fit,
      background: state.background,
      chrome: state.chrome,
      shadow: state.shadow,
      shadowTone: (state.background === 'white' || state.background === 'pale') ? 'dark' : 'light',
      orientation: state.orientation,
      scale: 1,
      label: state.label,
      caption: state.label,
      captionText: dev.name + ' · ' + g.screen.w + ' × ' + g.screen.h
    });
    canvas.className = 'dev-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', dev.name + ' mockup, ' + g.screen.w + ' by ' + g.screen.h);
    return canvas;
  }

  function mockFrame(dev) {
    var g = geomFor(dev);
    var frame = el('div', 'frame frame--mock');
    var wrap = el('div', 'frame__scale');
    wrap.appendChild(mockCanvas(dev));
    frame.appendChild(wrap);

    var meta = el('div', 'frame__meta');
    var id = el('span', 'frame__meta-id');
    id.textContent = dev.name + ' · ' + g.screen.w + ' × ' + g.screen.h;
    meta.appendChild(id);
    var tag = el('span', 'frame__meta-tag');
    tag.textContent = state.image ? 'screenshot' : 'sample page';
    meta.appendChild(tag);
    frame.appendChild(meta);

    return frame;
  }

  /* ---- stage orchestration ---------------------------------------------- */

  function zoomFactor(naturalW, naturalH) {
    var n = Math.max(1, selectedDevices().length);
    var avail = (els.frames.clientWidth || els.stage.clientWidth || 640) - 28;
    var availH = (els.frames.clientHeight || 420) - 40;
    var cols = avail < 460 ? 1 : (avail < 980 ? 2 : 3);
    cols = Math.min(cols, n);
    var perSlot = (avail - 40 * (cols - 1)) / cols;

    if (state.zoom === 'relative') {
      var widest = 0;
      var tallest = 0;
      selectedDevices().forEach(function (d) {
        var g = geomFor(d);
        widest = Math.max(widest, g.totalW);
        tallest = Math.max(tallest, g.totalH);
      });
      return clamp(Math.min(perSlot / (widest || 1), availH / (tallest || 1)));
    }
    if (state.zoom !== 'fit') return parseFloat(state.zoom) || 1;
    return clamp(Math.min(
      perSlot / (naturalW || perSlot),
      naturalH ? availH / naturalH : 1
    ));
  }

  function clamp(z) { return Math.max(0.06, Math.min(1, z)); }

  function applyZoom() {
    $$('.frame__scale', els.frames).forEach(function (scale) {
      var inner = scale.firstElementChild;
      if (!inner) return;
      var z = zoomFactor(inner.offsetWidth, inner.offsetHeight);
      inner.style.transformOrigin = 'top left';
      inner.style.transform = 'scale(' + z + ')';
      /* floor the box so two frames plus the gap can never add up to a
         fraction wider than the row and force a sideways scroll */
      scale.style.width = Math.floor(inner.offsetWidth * z) + 'px';
      scale.style.height = Math.floor(inner.offsetHeight * z) + 'px';
    });
  }

  function stageSignature() {
    var devices = selectedDevices().map(function (d) { return d.id + (d.orientations ? ':' + state.orientation : ''); }).join(',');
    return [devices, state.mode, liveSrc(), state.image ? state.imageName + state.image.width : 'demo',
      state.fit, state.background, state.chrome, state.shadow, state.label].join('|');
  }

  function renderStage(force) {
    var devices = selectedDevices();
    var next = stageSignature();
    if (!force && next === sig) { applyZoom(); return; }
    sig = next;

    els.frames.innerHTML = '';
    els.stageEmpty.hidden = devices.length > 0;
    els.stageTabs.classList.toggle('is-live', state.mode === 'live');

    if (!devices.length) {
      notice('');
      return;
    }

    if (state.mode === 'live' && !liveSrc() && state.frameSupport !== false) {
      state.mode = 'mock';
      syncControls();
    }
    if (state.mode === 'mock' && !state.image && liveSrc()) {
      /* keep mock: it renders the sample page */
    }

    devices.forEach(function (dev) {
      els.frames.appendChild(state.mode === 'live' ? liveFrame(dev) : mockFrame(dev));
    });

    if (state.mode === 'live') {
      if (state.frameSupport === false) {
        notice('The host serving this page allows frames from one origin only, so no site can be embedded here. The mockup composer is unaffected — and the live viewer works normally when you open this file locally or host it yourself.', 'warn');
      } else {
        notice('Frames render the real page at its true viewport width. If one stays blank, that site refuses to be embedded (X-Frame-Options or a frame-ancestors rule) — open it in a tab and drop a screenshot in instead.', 'hint');
      }
    } else if (!state.image) {
      notice(state.frameSupport === false
        ? 'Showing the built-in sample page. Drop a screenshot or paste one with ⌘V — this host blocks frames, so the live viewer explains the block instead of rendering a site.'
        : 'Showing the built-in sample page. Drop a screenshot, paste one with ⌘V, or switch to the live viewer to frame a real site.', 'hint');
    } else {
      notice('');
    }
    applyZoom();
    updateActionState();
    renderHeroPreview();
  }

  function updateActionState() {
    var devices = selectedDevices();
    var ready = devices.length > 0;
    els.btnDownload.disabled = !ready;
    els.btnCopy.disabled = !ready;
    els.btnAll.disabled = !ready;
    var g = devices[0] ? geomFor(devices[0]) : null;
    els.btnAll.textContent = devices.length > 1 ? 'Download all ' + devices.length : 'Download';
  }

  /* ---- hero preview (rendered by the same engine as the export) --------- */

  var heroKey = '';

  function renderHeroPreview() {
    if (!els.heroStage) return;
    var key = state.image ? 'image:' + state.imageName + ':' + state.image.width : 'sample';
    if (key === heroKey) return;
    heroKey = key;
    var dev = IF.deviceById('iphone-15');
    var canvas = IF.export.compose(dev, {
      image: state.image,
      fit: 'top',
      background: 'studio',
      chrome: true,
      shadow: true,
      shadowTone: 'light',
      scale: 2
    });
    canvas.setAttribute('aria-hidden', 'true');
    els.heroStage.innerHTML = '';
    els.heroStage.appendChild(canvas);
  }

  /* ---- controls sync ----------------------------------------------------- */

  function syncControls() {
    $$('[data-src]', els.srcTabs).forEach(function (b) {
      var on = b.dataset.src === state.source;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    els.panelUrl.hidden = state.source !== 'url';
    els.panelImage.hidden = state.source !== 'image';
    els.panelHtml.hidden = state.source !== 'html';

    $$('[data-mode]', els.stageTabs).forEach(function (b) {
      var on = b.dataset.mode === state.mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    els.urlInput.value = state.url;
    $$('input[name="fit"]', els.fitSeg).forEach(function (r) { r.checked = r.value === state.fit; });
    els.bgSelect.value = state.background;
    els.scaleSelect.value = String(state.scale);
    els.orientationSelect.value = state.orientation;
    els.zoomSelect.value = String(state.zoom);
    els.chkChrome.checked = state.chrome;
    els.chkShadow.checked = state.shadow;
    els.chkLabel.checked = state.label;

    els.btnOpen.hidden = !liveSrc();
    if (liveSrc()) els.btnOpen.href = liveSrc();

    renderRecent();
    renderShotInfo();
    renderHtmlInfo();
    renderDeviceChips();

    els.sourceTag.textContent = state.source === 'url' ? 'live URL' : state.source === 'image' ? 'screenshot' : 'local file';
    els.frameCount.textContent = state.selected.length + ' selected';
    els.scaleTag.textContent = state.scale + '×';
  }

  function renderRecent() {
    els.recent.innerHTML = '';
    els.recent.hidden = state.recent.length === 0;
    state.recent.forEach(function (u) {
      var chip = el('button', 'recent__chip');
      chip.type = 'button';
      var host = u;
      try { host = new URL(u).host; } catch (e) { /* keep raw */ }
      chip.textContent = host;
      chip.title = u;
      chip.addEventListener('click', function () {
        state.url = u;
        els.urlInput.value = u;
        loadUrl();
      });
      els.recent.appendChild(chip);
    });
  }

  function renderShotInfo() {
    els.shotInfo.hidden = !state.image;
    if (!state.image) return;
    els.shotThumb.src = state.image.src;
    els.shotName.textContent = state.imageName + ' · ' + state.image.width + ' × ' + state.image.height;
  }

  function renderHtmlInfo() {
    els.htmlInfo.hidden = !state.htmlBlobUrl;
    if (!state.htmlBlobUrl) return;
    els.htmlName.textContent = state.htmlName;
  }

  /* ---- URL handling ------------------------------------------------------ */

  function normalizeUrl(raw) {
    var v = (raw || '').trim();
    if (!v) return { error: 'Enter the address of the page you want to frame.' };
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v) && !/^https?:/i.test(v)) {
        return { error: 'Only http and https pages can be loaded in a frame.' };
      }
      v = 'https://' + v;
    }
    var u;
    try { u = new URL(v); } catch (e) { return { error: 'That does not look like a web address. Try example.com or https://example.com.' }; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { error: 'Only http and https pages can be loaded in a frame.' };
    }
    if (!u.hostname || u.hostname.indexOf('.') === -1) {
      return { error: 'That address has no domain in it. Try example.com.' };
    }
    return { url: u.href };
  }

  function showUrlError(msg) {
    els.urlError.textContent = msg || '';
    els.urlError.hidden = !msg;
    els.urlInput.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function loadUrl() {
    var res = normalizeUrl(els.urlInput.value);
    if (res.error) {
      showUrlError(res.error);
      els.urlInput.focus();
      return;
    }
    showUrlError('');
    state.url = res.url;
    state.demoUrl = '';
    state.source = 'url';
    state.mode = 'live';
    els.urlInput.value = res.url;
    state.recent = [res.url].concat(state.recent.filter(function (u) { return u !== res.url; })).slice(0, 4);
    syncControls();
    renderStage(true);
    say('Loading ' + res.url + ' in ' + selectedDevices().length + ' frame(s).');
    save();
  }

  /* ---- image intake ------------------------------------------------------ */

  var OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

  function acceptImageFile(file) {
    if (!file) return;
    if (file.type && OK_TYPES.indexOf(file.type) === -1) {
      notice('That file is a ' + (file.type || 'unknown') + '. InstaFrame reads PNG, JPEG, WebP, GIF, and AVIF screenshots.', 'warn');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        state.image = img;
        state.imageName = file.name || 'pasted-image.png';
        state.source = 'image';
        state.mode = 'mock';
        if (state.zoom === 'fit') { /* keep */ }
        syncControls();
        renderStage(true);
        notice('');
        say('Screenshot loaded: ' + state.imageName + '. Pick a frame, then download or copy.');
        save();
      };
      img.onerror = function () { notice('That image could not be decoded. Try re-saving it as a PNG.', 'warn'); };
      img.src = reader.result;
    };
    reader.onerror = function () { notice('That file could not be read.', 'warn'); };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    state.image = null;
    state.imageName = '';
    if (els.shotInput) els.shotInput.value = '';
    syncControls();
    renderStage(true);
    say('Screenshot removed.');
  }

  /* ---- local HTML intake ------------------------------------------------- */

  function acceptHtmlFile(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      notice('That file is over 4 MB. Live rendering keeps the whole document in memory — trim it first.', 'warn');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
      var blob = new Blob([reader.result], { type: 'text/html' });
      lastBlobUrl = URL.createObjectURL(blob);
      state.htmlBlobUrl = lastBlobUrl;
      state.htmlName = file.name;
      state.source = 'html';
      state.mode = 'live';
      syncControls();
      renderStage(true);
      notice('Rendering ' + file.name + ' from memory. Relative image paths and remote stylesheets will not resolve — inline anything the page needs.');
      say('Local page loaded: ' + file.name);
      save();
    };
    reader.onerror = function () { notice('That file could not be read.', 'warn'); };
    reader.readAsText(file);
  }

  function clearHtml() {
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
    state.htmlBlobUrl = null;
    state.htmlName = '';
    if (els.htmlInput) els.htmlInput.value = '';
    syncControls();
    renderStage(true);
  }

  function captureLocalPage() {
    var iframe = $('.dev__iframe', els.frames);
    if (!iframe || !state.htmlBlobUrl) {
      notice('Load a local HTML file first — InstaFrame captures the page it is already rendering.', 'warn');
      return;
    }
    var dev = selectedDevices()[0];
    var g = geomFor(dev);
    var doc;
    try { doc = iframe.contentDocument; } catch (e) { doc = null; }
    if (!doc) {
      notice('This frame is cross-origin, so the browser will not hand over its pixels. Use a screenshot for that page.', 'warn');
      return;
    }
    notice('Rasterising the local page…');
    IF.export.rasterizeDocument(doc, g.screen.w, g.screen.h).then(function (img) {
      state.image = img;
      state.imageName = state.htmlName.replace(/\.html?$/i, '') + '-capture.png';
      state.mode = 'mock';
      syncControls();
      renderStage(true);
      notice('');
      say('Local page captured into the mockup composer.');
    }).catch(function () {
      notice('The browser could not rasterise that page (external stylesheets and exotic CSS are the usual cause). Take a screenshot and drop it in instead.', 'warn');
    });
  }

  /* ---- export ------------------------------------------------------------ */

  function composeSelected(dev) {
    var g = geomFor(dev);
    return IF.export.compose(dev, {
      image: state.image,
      fit: state.fit,
      background: state.background,
      chrome: state.chrome,
      shadow: state.shadow,
      orientation: state.orientation,
      scale: state.scale,
      caption: state.label,
      captionText: dev.name + ' · ' + g.screen.w + ' × ' + g.screen.h
    });
  }

  function fileName(dev, ext) {
    return 'instaframe-' + dev.id + '-' + state.scale + 'x.' + ext;
  }

  function withBusy(btn, label, work) {
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-busy');
    btn.textContent = label;
    return Promise.resolve()
      .then(work)
      .then(function (r) { btn.innerHTML = original; btn.classList.remove('is-busy'); updateActionState(); return r; })
      .catch(function (e) {
        btn.innerHTML = original;
        btn.classList.remove('is-busy');
        updateActionState();
        notice('Export failed: ' + (e && e.message ? e.message : 'unknown error') + '. Try a lower scale.', 'warn');
      });
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function downloadOne() {
    var dev = selectedDevices()[0];
    if (!dev) return;
    withBusy(els.btnDownload, 'Composing…', function () {
      return IF.export.toBlob(composeSelected(dev), 'image/png').then(function (blob) {
        downloadBlob(blob, fileName(dev, 'png'));
        say('Downloaded ' + fileName(dev, 'png') + ' at ' + state.scale + '×.');
      });
    });
  }

  function downloadAll() {
    var devices = selectedDevices();
    if (!devices.length) return;
    withBusy(els.btnAll, 'Composing…', function () {
      var chain = Promise.resolve();
      devices.forEach(function (dev, i) {
        chain = chain.then(function () {
          return IF.export.toBlob(composeSelected(dev), 'image/png').then(function (blob) {
            return new Promise(function (res) {
              window.setTimeout(function () { downloadBlob(blob, fileName(dev, 'png')); res(); }, i * 260);
            });
          });
        });
      });
      return chain.then(function () {
        say('Composing ' + devices.length + ' files. If your browser asks about multiple downloads, allow them.');
      });
    });
  }

  function copyOne() {
    var dev = selectedDevices()[0];
    if (!dev) return;
    withBusy(els.btnCopy, 'Copying…', function () {
      return IF.export.toBlob(composeSelected(dev), 'image/png').then(function (blob) {
        if (!navigator.clipboard || !window.ClipboardItem) {
          downloadBlob(blob, fileName(dev, 'png'));
          say('This browser blocks clipboard images — the PNG was downloaded instead.');
          return;
        }
        return navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
          .then(function () { say('Copied the ' + dev.name + ' mockup to the clipboard.'); })
          .catch(function () {
            downloadBlob(blob, fileName(dev, 'png'));
            say('Clipboard permission was refused — the PNG was downloaded instead.');
          });
      });
    });
  }

  /* ---- wiring ------------------------------------------------------------ */

  function wire() {
    els.srcTabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-src]');
      if (!b) return;
      state.source = b.dataset.src;
      state.mode = state.source === 'image' ? 'mock' : 'live';
      syncControls();
      renderStage(true);
      save();
    });

    els.srcTabs.addEventListener('keydown', function (e) {
      var keys = ['ArrowRight', 'ArrowLeft'];
      if (keys.indexOf(e.key) === -1) return;
      var tabs = $$('[data-src]', els.srcTabs);
      var i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });

    els.urlForm.addEventListener('submit', function (e) { e.preventDefault(); loadUrl(); });

    els.dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.shotInput.click(); }
    });

    els.heroForm.addEventListener('submit', function (e) {
      e.preventDefault();
      els.urlInput.value = els.heroUrl.value;
      state.source = 'url';
      state.mode = 'live';
      syncControls();
      loadUrl();
      if (!els.urlError.hidden) return;
      try { location.hash = '#studio'; } catch (err) { /* anchor may be blocked */ }
    });

    els.btnSelectAllFromEmpty.addEventListener('click', function () {
      state.selected = IF.DEVICES.map(function (d) { return d.id; });
      renderDeviceChips(); renderStage(true); save();
    });
    els.urlInput.addEventListener('blur', function () {
      if (!els.urlInput.value.trim()) { showUrlError(''); return; }
      var res = normalizeUrl(els.urlInput.value);
      showUrlError(res.error || '');
    });
    els.urlInput.addEventListener('input', function () {
      if (els.urlInput.getAttribute('aria-invalid') === 'true') {
        var res = normalizeUrl(els.urlInput.value);
        if (!res.error) showUrlError('');
      }
    });
    els.urlClear.addEventListener('click', function () {
      els.urlInput.value = '';
      state.url = '';
      showUrlError('');
      syncControls();
      renderStage(true);
      els.urlInput.focus();
      save();
    });

    els.urlSample.addEventListener('click', function () {
      if (!state.demoUrl) state.demoUrl = URL.createObjectURL(new Blob([SAMPLE_PAGE], { type: 'text/html' }));
      state.source = 'url';
      state.mode = 'live';
      els.urlInput.value = '';
      state.url = '';
      showUrlError('');
      syncControls();
      renderStage(true);
      say('Sample page loaded into the live viewer — the badge in its header reports each frame\u2019s width.');
    });

    els.shotInput.addEventListener('change', function (e) { acceptImageFile(e.target.files && e.target.files[0]); });
    els.shotRemove.addEventListener('click', clearImage);
    els.shotPaste.addEventListener('click', function () {
      notice('Press ⌘V or Ctrl+V anywhere in the page — the clipboard image goes straight into the composer.');
      els.dropZone.focus();
    });

    els.htmlInput.addEventListener('change', function (e) { acceptHtmlFile(e.target.files && e.target.files[0]); });
    els.htmlRemove.addEventListener('click', clearHtml);
    els.htmlCapture.addEventListener('click', captureLocalPage);

    els.deviceList.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (b) toggleDevice(b.dataset.id);
    });
    els.btnSelectAll.addEventListener('click', function () {
      state.selected = IF.DEVICES.map(function (d) { return d.id; });
      renderDeviceChips(); renderStage(true); save();
    });
    els.btnSelectNone.addEventListener('click', function () {
      state.selected = [];
      renderDeviceChips(); renderStage(true); save();
    });

    els.stageTabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mode]');
      if (!b) return;
      if (b.dataset.mode === 'live' && !liveSrc() && state.frameSupport !== false) {
        notice('Load a URL or a local HTML file to use the live viewer. Or keep going with the sample page.');
        return;
      }
      state.mode = b.dataset.mode;
      renderStage(true);
      save();
    });

    els.fitSeg.addEventListener('change', function (e) {
      if (e.target.name === 'fit') { state.fit = e.target.value; renderStage(true); save(); }
    });
    els.bgSelect.addEventListener('change', function () { state.background = els.bgSelect.value; renderStage(true); save(); });
    els.scaleSelect.addEventListener('change', function () { state.scale = parseInt(els.scaleSelect.value, 10) || 2; save(); });
    els.orientationSelect.addEventListener('change', function () { state.orientation = els.orientationSelect.value; renderStage(true); save(); });
    els.zoomSelect.addEventListener('change', function () { state.zoom = els.zoomSelect.value; applyZoom(); });
    els.chkChrome.addEventListener('change', function () { state.chrome = els.chkChrome.checked; renderStage(true); save(); });
    els.chkShadow.addEventListener('change', function () { state.shadow = els.chkShadow.checked; renderStage(true); save(); });
    els.chkLabel.addEventListener('change', function () { state.label = els.chkLabel.checked; renderStage(true); save(); });

    els.btnDownload.addEventListener('click', downloadOne);
    els.btnCopy.addEventListener('click', copyOne);
    els.btnAll.addEventListener('click', downloadAll);

    els.btnReload.addEventListener('click', function () {
      renderStage(true);
      say('Frames reloaded.');
    });

    document.addEventListener('paste', function (e) {
      if (!e.clipboardData) return;
      var items = e.clipboardData.items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          var f = items[i].getAsFile();
          if (f) { acceptImageFile(f); e.preventDefault(); }
          return;
        }
      }
    });

    ['dragenter', 'dragover'].forEach(function (t) {
      document.addEventListener(t, function (e) {
        if (!e.dataTransfer) return;
        e.preventDefault();
        els.dropZone.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      document.addEventListener(t, function (e) {
        els.dropZone.classList.remove('is-over');
        if (t === 'dragleave' && e.relatedTarget) return;
      });
    });
    document.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      var f = e.dataTransfer.files[0];
      if (f.type && f.type.indexOf('image/') === 0) {
        e.preventDefault();
        acceptImageFile(f);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= IF.DEVICES.length) {
        e.preventDefault();
        toggleDevice(IF.DEVICES[n - 1].id);
      }
    });

    var resize;
    window.addEventListener('resize', function () {
      window.clearTimeout(resize);
      resize = window.setTimeout(function () { if (state.zoom === 'fit') applyZoom(); }, 120);
    });
  }

  function boot() {
    els.status = $('#status');
    els.notice = $('#stageNotice');
    els.srcTabs = $('#srcTabs');
    els.panelUrl = $('#panelUrl');
    els.panelImage = $('#panelImage');
    els.panelHtml = $('#panelHtml');
    els.urlForm = $('#studioPanel');
    els.heroForm = $('#heroForm');
    els.heroUrl = $('#heroUrl');
    els.heroStage = $('#heroStage');
    els.btnSelectAllFromEmpty = $('#btnSelectAllFromEmpty');
    els.sourceTag = $('#sourceTag');
    els.frameCount = $('#frameCount');
    els.scaleTag = $('#scaleTag');
    els.urlInput = $('#urlInput');
    els.urlError = $('#urlError');
    els.urlClear = $('#urlClear');
    els.urlSample = $('#urlSample');
    els.recent = $('#recent');
    els.shotInput = $('#shotInput');
    els.dropZone = $('#dropZone');
    els.shotInfo = $('#shotInfo');
    els.shotThumb = $('#shotThumb');
    els.shotName = $('#shotName');
    els.shotRemove = $('#shotRemove');
    els.shotPaste = $('#shotPaste');
    els.htmlInput = $('#htmlInput');
    els.htmlInfo = $('#htmlInfo');
    els.htmlName = $('#htmlName');
    els.htmlRemove = $('#htmlRemove');
    els.htmlCapture = $('#htmlCapture');
    els.deviceList = $('#deviceList');
    els.btnSelectAll = $('#btnSelectAll');
    els.btnSelectNone = $('#btnSelectNone');
    els.stageTabs = $('#stageTabs');
    els.frames = $('#frames');
    els.framesWrap = $('#framesWrap');
    els.stage = $('#stage');
    els.stageEmpty = $('#stageEmpty');
    els.zoomSelect = $('#zoomSelect');
    els.btnReload = $('#btnReload');
    els.btnOpen = $('#btnOpen');
    els.fitSeg = $('#fitSeg');
    els.bgSelect = $('#bgSelect');
    els.scaleSelect = $('#scaleSelect');
    els.orientationSelect = $('#orientationSelect');
    els.orientationRow = $('#orientationRow');
    els.chkChrome = $('#chkChrome');
    els.chkShadow = $('#chkShadow');
    els.chkLabel = $('#chkLabel');
    els.btnDownload = $('#btnDownload');
    els.btnCopy = $('#btnCopy');
    els.btnAll = $('#btnAll');

    restore();
    if (state.mode === 'live' && !liveSrc()) state.mode = 'mock';
    if (!state.selected.length) state.selected = ['iphone-15', 'galaxy-s24-ultra'];
    wire();
    syncControls();
    renderStage(true);
    detectFrameSupport().then(function (ok) {
      state.frameSupport = ok;
      document.documentElement.setAttribute('data-frames', ok ? 'allowed' : 'blocked');
      renderStage(true);
    });
    IF.app = { state: state, render: function () { renderStage(true); }, frameSupport: detectFrameSupport };
    if (state.url) {
      var res = normalizeUrl(state.url);
      if (res.url && res.url !== state.url) state.url = res.url;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
