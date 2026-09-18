/* InstaFrame — smoke test harness.
   Loaded by _selftest.html. Inspects the app frame, exercises the mockup
   composer, the live viewer, the frame-support probe, and the narrow-viewport
   layout. Reports on the page and to the console. No network, no dependencies.

   The suite is environment aware: it re-runs the app's own frame-support probe
   and then asserts the behaviour that environment should produce, so the same
   page is meaningful both on a normal host and behind a CSP that blocks frames. */
(function () {
  var out = document.getElementById('out');
  var frame = document.getElementById('app');
  var results = [];
  var failures = 0;

  function check(name, pass, detail) {
    var state = pass === null ? 'skip' : (pass ? 'ok' : 'fail');
    if (state === 'fail') failures++;
    results.push({ name: name, state: state, detail: detail == null ? '' : String(detail) });
  }

  function win0() { return frame.contentWindow; }

  function print() {
    var lines = results.map(function (r) {
      var tag = r.state === 'ok' ? '  ok   ' : (r.state === 'skip' ? '  skip ' : '  FAIL ');
      return tag + r.name + (r.detail ? '  →  ' + r.detail : '');
    });
    var head = failures === 0
      ? 'PASS — ' + results.length + ' checks, 0 failures'
      : 'FAIL — ' + failures + ' of ' + results.length + ' checks failed';
    out.textContent = head + '\n\n' + lines.join('\n');
    out.innerHTML = out.innerHTML
      .replace('PASS —', '<span class="ok">PASS —</span>')
      .replace('FAIL —', '<span class="fail">FAIL —</span>')
      .replace(/  FAIL /g, '  <span class="fail">FAIL</span> ');
    console.log(head, results);
  }

  /* ---- environment audit: does this host even allow frames? -------------- */

  function auditNarrow(then) {
    var hidden = document.createElement('iframe');
    hidden.style.cssText = 'position:absolute;left:-10000px;top:0;width:390px;height:844px;border:0;visibility:hidden';
    hidden.setAttribute('title', '390px audit');
    hidden.src = 'index.html';
    document.body.appendChild(hidden);
    var tries = 0;
    (function wait() {
      var d = null;
      try { d = hidden.contentDocument; } catch (e) { d = null; }
      var ready = d && d.querySelectorAll('.chip').length === 6;
      if (!ready && ++tries < 80) { setTimeout(wait, 150); return; }
      if (!ready) { check('the 390px audit could load the app', false); return then(); }

      var view = 390;
      check('no horizontal overflow at 390px', d.documentElement.scrollWidth <= view,
        d.documentElement.scrollWidth + 'px document in a ' + view + 'px viewport');

      var offenders = [];
      var all = d.querySelectorAll('body *');
      for (var i = 0; i < all.length && offenders.length < 5; i++) {
        var el = all[i];
        if (!el.getBoundingClientRect) continue;
        var r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > view + 1 || r.left < -1) {
          var style = hidden.contentWindow.getComputedStyle(el);
          if (style.position === 'absolute' || style.position === 'fixed') continue;
          offenders.push(el.tagName.toLowerCase() + '.' + String(el.className || '?').split(' ')[0] +
            ' [' + Math.round(r.left) + '→' + Math.round(r.right) + ']');
        }
      }
      check('no element pokes outside the 390px viewport', offenders.length === 0, offenders.join(' | '));

      check('the hero stacks to one column on a phone', (function () {
        var grid = d.querySelector('.hero__grid');
        if (!grid) return false;
        return hidden.contentWindow.getComputedStyle(grid).gridTemplateColumns.split(' ').length === 1;
      })());
      check('the report table stacks into blocks on a phone', (function () {
        var t = d.querySelector('table.spec');
        return !!t && hidden.contentWindow.getComputedStyle(t).display === 'block';
      })());
      then();
    })();
  }

  /* ---- does the in-memory sample page actually render? ------------------- */

  function sampleChecks(win, doc, supported, then) {
    doc.querySelector('#urlSample').click();
    var iframe = doc.querySelector('iframe.dev__iframe');
    check('the sample page is registered as a local document', (function () {
      var u = win.IF.app.state.demoUrl;
      return !!u && u.indexOf('blob:') === 0;
    })(), iframe ? 'frame src ' + iframe.src.slice(0, 12) + '…' : 'no frame attached');

    if (!supported) {
      check('the sample page renders inside a live frame', null, 'this host blocks frames — verified on an open host instead');
      return then();
    }
    var tries = 0;
    (function waitRender() {
      var inner = null;
      var lf = doc.querySelector('iframe.dev__iframe');
      try { inner = lf && lf.contentDocument; } catch (e) { inner = null; }
      if (inner && inner.title === 'InstaFrame sample page' && inner.getElementById('vw')) {
        check('the sample page renders inside a live frame', true, 'title: ' + inner.title);
        return then();
      }
      if (++tries > 40) {
        check('the sample page renders inside a live frame', false,
          'title was: ' + (inner ? JSON.stringify(inner.title) : 'no document'));
        return then();
      }
      setTimeout(waitRender, 150);
    })();
  }

  /* ---- the suite --------------------------------------------------------- */

  /* ---- 0. can this harness page frame anything at all? ------------------- */

  function probeThisHost(cb) {
    var probe = document.createElement('iframe');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:8px;height:8px;border:0';
    probe.setAttribute('title', 'host frame probe');
    var settled = false;
    var timer = setTimeout(function () { finish(false); }, 1500);
    function finish(ok) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { probe.parentNode.removeChild(probe); } catch (e) { /* gone already */ }
      cb(ok);
    }
    probe.addEventListener('load', function () {
      var title = '';
      try { title = probe.contentDocument ? probe.contentDocument.title : ''; } catch (e) { title = ''; }
      finish(title === 'instaframe-probe');
    });
    probe.src = URL.createObjectURL(new Blob(['<!doctype html><title>instaframe-probe</title>'], { type: 'text/html' }));
    document.body.appendChild(probe);
  }

  function blockedHostNotice() {
    out.innerHTML = '<span class="fail">This host blocks frames.</span>\n\n' +
      'Its Content-Security-Policy sets frame-src to a single origin, so this page cannot load index.html in a frame ' +
      'and the in-frame audit cannot run here.\n\n' +
      'InstaFrame detects this same condition at runtime: it marks the document with data-frames="blocked" and every ' +
      'live frame explains the block with a button through to the mockup composer, which is unaffected.\n\n' +
      'To run the full suite, load this page from a host without that restriction:\n\n' +
      '  python3 -m http.server 8000\n' +
      '  open http://localhost:8000/_selftest.html';
  }

  function run() {
    var win, doc;
    try {
      win = frame.contentWindow;
      doc = frame.contentDocument;
    } catch (e) {
      doc = null;
    }
    if (!doc || !win.IF) {
      out.textContent = 'Cannot inspect index.html from this origin.\n\nServe this folder over HTTP — for example:\n\n  python3 -m http.server 8000\n\nthen open http://localhost:8000/_selftest.html';
      return;
    }

    var IF = win.IF;
    check('device library exposes 6 frames', IF.DEVICES.length === 6, IF.DEVICES.length + ' found');
    check('every device has a mockup viewport and a native panel',
      IF.DEVICES.every(function (d) { return d.screen.w > 300 && d.screen.h > 700 && /\d/.test(d.native) && d.ppi > 200; }));

    var g = IF.geom(IF.deviceById('iphone-15'));
    check('iPhone 15 geometry is screen plus bezel', g.bodyW === 393 + 24 && g.bodyH === 852 + 24, g.bodyW + ' × ' + g.bodyH);
    var gl = IF.geom(IF.deviceById('macbook-air-13'));
    check('laptop geometry widens for the deck', gl.totalW > gl.bodyW && gl.totalH > gl.bodyH, gl.totalW + ' × ' + gl.totalH);
    var gm = IF.geom(IF.deviceById('pro-display-xdr'));
    check('display geometry adds the stand', gm.totalH > gm.bodyH + 150, gm.totalH + 'px tall');

    var chips = doc.querySelectorAll('.chip');
    check('frame chips rendered', chips.length === 6, chips.length + ' chips');
    check('two frames selected by default', doc.querySelectorAll('.chip.is-on').length === 2);
    check('default pair is one Apple and one Android phone',
      chips[3].classList.contains('is-on') && chips[4].classList.contains('is-on'));

    var canvases = doc.querySelectorAll('canvas.dev-canvas');
    check('mockup stage composed canvases', canvases.length === 2, canvases.length + ' canvases');
    var frameEls = doc.querySelectorAll('.frames > .frame');
    check('both frames sit side by side instead of wrapping',
      frameEls.length === 2 && frameEls[1].offsetLeft > frameEls[0].offsetLeft,
      frameEls.length === 2 ? 'lefts ' + frameEls[0].offsetLeft + ' / ' + frameEls[1].offsetLeft : 'wrong count');
    check('a fitted frame fills a real share of the stage',
      frameEls[0].offsetWidth > 200, frameEls[0].offsetWidth + 'px wide in a ' + doc.querySelector('#frames').clientWidth + 'px row');
    var stageBody = doc.querySelector('.stage__body');
    check('the stage never clips a frame', stageBody.scrollHeight <= stageBody.clientHeight + 2,
      stageBody.scrollHeight + ' vs ' + stageBody.clientHeight);
    check('the stage never scrolls sideways', stageBody.scrollWidth <= stageBody.clientWidth + 2,
      stageBody.scrollWidth + ' vs ' + stageBody.clientWidth);
    check('the frames sit clear of the stage edge', (function () {
      var row = doc.querySelector('#frames').getBoundingClientRect();
      var a = frameEls[0].getBoundingClientRect();
      var b = frameEls[frameEls.length - 1].getBoundingClientRect();
      var left = a.left - row.left;
      var right = row.right - b.right;
      return left >= 8 && right >= 8;
    })(), (function () {
      var row = doc.querySelector('#frames').getBoundingClientRect();
      var a = frameEls[0].getBoundingClientRect();
      var b = frameEls[frameEls.length - 1].getBoundingClientRect();
      return 'gutter ' + Math.round(a.left - row.left) + ' / ' + Math.round(row.right - b.right) + 'px';
    })());
    check('the stage keeps a workable height', (function () {
      var h = doc.querySelector('.stage').getBoundingClientRect().height;
      return h >= 500 && h <= 940;
    })(), doc.querySelector('.stage').getBoundingClientRect().height.toFixed(0) + 'px tall');

    var c0 = canvases[0];
    check('first canvas has real pixels', !!c0 && c0.width > 300 && c0.height > 600, c0 ? c0.width + ' × ' + c0.height : 'none');
    var cornerAlpha = c0 ? c0.getContext('2d').getImageData(1, 1, 1, 1).data[3] : 255;
    check('transparent background leaves corners effectively clear', cornerAlpha < 12, 'alpha ' + cornerAlpha);

    check('hero preview renders a device through the export engine', (function () {
      var hp = doc.querySelector('#heroStage canvas');
      if (!hp || hp.width < 800) return false;
      return hp.getContext('2d').getImageData(Math.round(hp.width / 2), Math.round(hp.height / 2), 1, 1).data[3] > 0;
    })(), (function () {
      var hp = doc.querySelector('#heroStage canvas');
      return hp ? hp.width + ' × ' + hp.height : 'no canvas';
    })());

    /* exporter */
    var galaxy = IF.deviceById('galaxy-s24-ultra');
    var body = galaxy.screen.w + galaxy.frame.bezel * 2;
    var flat = IF.export.compose(galaxy, { fit: 'top', background: 'transparent', shadow: false, scale: 2 });
    check('2× export doubles the device pixels', flat.width === body * 2, flat.width + 'px wide for a ' + body + 'px device');
    check('transparent background leaves the canvas clear',
      flat.getContext('2d').getImageData(1, 1, 1, 1).data[3] === 0);
    var shadowed = IF.export.compose(galaxy, { fit: 'top', background: 'transparent', scale: 2 });
    check('a shadowed transparent export keeps room for the shadow', shadowed.width === (body + 60) * 2, shadowed.width + 'px wide');

    var lit = IF.export.compose(galaxy, { fit: 'top', background: 'studio', chrome: true, shadow: true, scale: 2 });
    var litCtx = lit.getContext('2d');
    var rimY = Math.round((56 + galaxy.screen.h / 2) * 2);
    var rim = litCtx.getImageData(Math.round((56 + 1) * 2), rimY, 1, 1).data;
    var bezelPx = litCtx.getImageData(Math.round((56 + galaxy.frame.bezel / 2) * 2), rimY, 1, 1).data;
    check('a dark-stage export lights the device rim', rim[0] > 110 && bezelPx[0] < 90,
      'rim ' + rim[0] + ' vs bezel ' + bezelPx[0]);

    var staged = IF.export.compose(galaxy, { fit: 'top', background: 'studio', chrome: true, shadow: true, scale: 2, caption: true });
    check('a staged background pads the export', staged.width === (body + 112) * 2, staged.width + 'px wide');
    var bgPx = staged.getContext('2d').getImageData(4, 4, 1, 1).data;
    check('staged background fills the padded canvas', bgPx[3] === 255 && bgPx[0] < 24,
      'rgba(' + bgPx[0] + ',' + bgPx[1] + ',' + bgPx[2] + ',' + bgPx[3] + ')');
    var noLabel = IF.export.compose(galaxy, { fit: 'top', background: 'studio', scale: 2 }).height;
    check('the device label adds caption height', staged.height > noLabel, (staged.height - noLabel) + 'px');

    /* environment-dependent live stage */
    Promise.resolve(win.IF.app && win.IF.app.frameSupport ? win.IF.app.frameSupport() : true)
      .then(function (supported) {
        win.IF.app.state.frameSupport = supported;
        win.IF.app.render();

        var tabs = doc.querySelectorAll('#stageTabs [data-mode]');
        check('the frame-support probe returned an answer', typeof supported === 'boolean',
          supported ? 'frames allowed here' : 'this host blocks frames');
        check('the app exposes its frame-support probe', !!win.IF.app && typeof win.IF.app.frameSupport === 'function');

        tabs[0].click();
        if (supported) {
          check('live mode refuses to run without a source', doc.querySelectorAll('.frame--live').length === 0);
        } else {
          check('a blocked host still shows the live stage so it can explain itself',
            doc.querySelectorAll('.frame__overlay').length > 0);
        }

        doc.querySelector('#urlInput').value = 'example.com';
        doc.querySelector('#urlLoad').click();
        var shells = doc.querySelectorAll('.dev');
        check('live mode builds device shells', shells.length === 2, shells.length + ' shells');
        check('bare hostnames are normalised to https',
          doc.querySelector('#urlInput').value.indexOf('https://') === 0, doc.querySelector('#urlInput').value);

        if (supported) {
          var iphoneLive = null;
          [].slice.call(doc.querySelectorAll('.frame--live')).forEach(function (fr) {
            var f = fr.querySelector('iframe.dev__iframe');
            if (f && f.style.width === '393px') iphoneLive = fr;
          });
          var iIframe = iphoneLive && iphoneLive.querySelector('iframe.dev__iframe');
          check('live frame carries an iframe at true viewport size',
            !!iIframe && iIframe.style.height === '852px',
            iIframe ? iIframe.style.width + ' × ' + iIframe.style.height : 'no 393px frame');
          check('every live iframe matches its device viewport', (function () {
            var map = { '393px': 852, '384px': 832, '1280px': 832 };
            var ok = true;
            doc.querySelectorAll('iframe.dev__iframe').forEach(function (f) {
              if (map[f.style.width] !== parseInt(f.style.height, 10)) ok = false;
            });
            return ok;
          })());
          var island = doc.querySelector('.dev__island');
          check('Dynamic Island is drawn inside the bezel',
            !!island && getComputedStyle(island).width === '124px', island ? getComputedStyle(island).width : 'none');
          var iBody = iphoneLive && iphoneLive.querySelector('.dev__body');
          check('device body uses the shared geometry radius', !!iBody && iBody.style.borderRadius === '55px',
            iBody ? iBody.style.borderRadius : 'none');
          var iShell = iphoneLive && iphoneLive.querySelector('.dev');
          check('shell size equals screen plus bezel',
            !!iShell && iShell.style.width === '417px' && iShell.style.height === '876px',
            iShell ? iShell.style.width + ' × ' + iShell.style.height : 'none');

          /* the watchdog that used to guess "refused" is gone — it fired on slow
             pages and stayed on top of pages that loaded fine */
          check('no frame claims a refusal that never happened',
            doc.querySelectorAll('.frame__overlay').length === 0,
            doc.querySelectorAll('.frame__overlay').length + ' overlays on an open host');
          var shotBtns = doc.querySelectorAll('.frame__meta-btn');
          check('every live frame offers the screenshot route',
            shotBtns.length === doc.querySelectorAll('.frame--live').length,
            shotBtns.length + ' for ' + doc.querySelectorAll('.frame--live').length + ' frames');
          if (shotBtns.length) {
            shotBtns[0].click();
            check('the screenshot route jumps to the composer',
              win.IF.app.state.source === 'image' && win.IF.app.state.mode === 'mock',
              win.IF.app.state.source + '/' + win.IF.app.state.mode);
          }
        } else {
          check('every blocked frame explains itself in place',
            doc.querySelectorAll('.frame__overlay').length === doc.querySelectorAll('.frame--live').length,
            doc.querySelectorAll('.frame__overlay').length + ' overlays');
          check('blocked frames stop promising a live preview',
            doc.querySelectorAll('iframe.dev__iframe').length === 0);
          check('the explanation offers the composer instead', !!doc.querySelector('.frame__overlay-btn'),
            (function () { var b = doc.querySelector('.frame__overlay-btn'); return b ? b.textContent : 'none'; })());
          var island2 = doc.querySelector('.dev__island');
          check('the device chrome is still drawn without frames',
            !!island2 && getComputedStyle(island2).width === '124px', island2 ? getComputedStyle(island2).width : 'none');
        }

        tabs[1].click();
        check('switching back to mockup restores canvases', doc.querySelectorAll('canvas.dev-canvas').length === 2);

        /* what a frame-blocking host looks like: force it and inspect the result */
        win.IF.app.state.frameSupport = false;
        tabs[0].click();
        var blockedFrames = doc.querySelectorAll('.frame--live').length;
        check('a blocked host gets one explanation per frame',
          blockedFrames > 0 && doc.querySelectorAll('.frame__overlay').length === blockedFrames,
          doc.querySelectorAll('.frame__overlay').length + ' overlays for ' + blockedFrames + ' frames');
        check('a blocked host renders no iframes at all', doc.querySelectorAll('iframe.dev__iframe').length === 0);
        check('the blocked explanation links to the composer', (function () {
          var b = doc.querySelector('.frame__overlay-btn');
          return !!b && /composer|screenshot/i.test(b.textContent);
        })(), (function () { var b = doc.querySelector('.frame__overlay-btn'); return b ? b.textContent : 'none'; })());
        check('the device chrome still draws without frames', (function () {
          var i = doc.querySelector('.dev__island');
          return !!i && getComputedStyle(i).width === '124px';
        })());
        tabs[1].click();
        check('the mockup hint no longer points at a viewer that cannot run',
          /blocks frames/i.test(doc.querySelector('#stageNotice').textContent),
          doc.querySelector('#stageNotice').textContent.slice(0, 70));
        win.IF.app.state.frameSupport = supported;
        win.IF.app.render();

        sampleChecks(win, doc, supported, function () {
          IF.export.toBlob(staged, 'image/png').then(function (blob) {
            check('PNG encodes', blob.size > 20000, Math.round(blob.size / 1024) + ' KB');
            auditNarrow(print);
          }).catch(function (e) {
            check('PNG encodes', false, e.message);
            auditNarrow(print);
          });
        });
      })
      .catch(function (e) {
        check('the suite ran to completion', false, String((e && e.message) || e));
        print();
      });
  }

  probeThisHost(function (canFrame) {
    if (!canFrame) { blockedHostNotice(); return; }
    var tries = 0;
    (function wait() {
      var ready = false;
      try {
        ready = !!(frame.contentWindow && frame.contentWindow.IF &&
          frame.contentDocument.querySelectorAll('.chip').length === 6);
      } catch (e) { ready = false; }
      if (ready || ++tries > 80) { run(); return; }
      setTimeout(wait, 150);
    })();
  });
})();
