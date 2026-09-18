# InstaFrame

Turn any webpage into a studio device mockup — in the browser, with one click.

**Live:** <https://sulutions.cloud/frame/>

Live multi-device responsive viewer plus a mockup composer that wraps a page in
realistic Apple and Android frames. No build step, no dependencies, no server,
no upload: the whole thing is a static page and the screenshot never leaves the
machine.

Open `index.html` — that's the entire app.

## The frames

Six devices, built from the published figures for each one. "Viewport" is the
CSS width the frame renders at; "panel" is the physical screen behind it.

| Frame | Viewport (CSS) | Native panel | Density | Hardware chrome |
|---|---|---|---|---|
| Pro Display XDR | 1600 × 900 | 6016 × 3384 | 218 ppi | Thin uniform bezel, Pro Stand |
| MacBook Air 13" | 1280 × 832 | 2560 × 1664 | 224 ppi | Lid notch + camera, aluminium deck |
| iPad Pro | 1366 × 1024 | 2732 × 2048 | 264 ppi | Uniform bezel, punched camera, rotates |
| iPhone 15 | 393 × 852 | 1179 × 2556 | 460 ppi | Dynamic Island, Action button |
| Galaxy S24 Ultra | 384 × 832 | 1440 × 3120 | 505 ppi | Flat titanium rails, centred punch-hole |
| Pixel 8 | 412 × 915 | 1080 × 2400 | 428 ppi | Polished aluminium frame, punch-hole |

## What it does

**Live viewer** — every selected frame renders the real page at its true
viewport width, side by side. Zoom (Fit / Relative size / 100-20 %), rotate the
iPad, reload on demand, toggle frames with the `1`-`6` keys. Ships with a
built-in sample page (generated in memory) so the viewer has something real to
show with zero setup.

**Mockup composer** — drop, paste (Cmd+V) or capture a screenshot and place it
in any frame. Fit (Top / Fill / Contain), background (transparent, white, pale,
black, studio glow), device chrome, drop shadow, device label, export scale
1x / 2x / 3x. Download PNG or copy straight to the clipboard; export all
selected frames in one pass.

Everything is drawn as vectors at export time, so a 3x mockup gets a crisp 3x
frame — only the page image inside is limited by the resolution you supplied.

## Run it

Any static host, or locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk also works for the composer; the live
viewer needs an `http(s)` origin.

## Files

```
index.html        markup, copy, spec table
css/app.css       design tokens and all layout
js/devices.js     device library — dimensions, bezel geometry, hardware chrome
js/exporter.js    canvas engine — draws the frame and composites the page image
js/studio.js      state, live frames, screenshot intake, export actions
assets/favicon.svg
_selftest.html    in-browser smoke test
_harness.js       the checks _selftest.html runs
```

Adding a frame means adding one object to `js/devices.js`: viewport, native
panel, density, and the bezel/chrome geometry. Both renderers — the DOM live
shell and the canvas export — read that same object.

## Smoke test

Serve the folder over HTTP and open `_selftest.html`. It loads the app in a
same-origin frame and runs the suite: geometry, DOM shells, iframe viewport
sizes, canvas export sizes, PNG encoding, transparency, the dark-stage rim
light, a 390 px narrow-viewport audit, and the frame-blocking paths.

```bash
python3 -m http.server 8000
open http://localhost:8000/_selftest.html
```

The suite is environment aware — it probes whether the host allows frames at
all and asserts the behaviour that host should produce.

## Known limits

- **A browser cannot read the pixels of a cross-origin page.** That is a
  security boundary, not a missing feature. The live viewer shows pages that
  permit embedding; the export composes from a screenshot, which works for any
  site, logged-in pages included.
- **Sites that send `X-Frame-Options` or a restrictive `frame-ancestors` will
  not appear in a frame**, anywhere. From inside the page a refused frame is
  indistinguishable from a slow one, so InstaFrame does not guess: every frame
  carries a `Screenshot →` control that routes it straight to the composer.
- **A host whose Content-Security-Policy restricts `frame-src` blocks frames
  entirely** (external and in-memory alike). InstaFrame probes for this at
  startup and marks the document `data-frames="blocked"` so the viewer explains
  the situation instead of showing blank frames.
- Capturing a cross-origin page into a frame requires a screenshot; the
  in-memory rasteriser only reaches documents the page itself loaded (local
  HTML files).

## Credits

Device names and marks belong to their respective owners and are used for
identification only. Every frame here is original vector chrome drawn from
published screen dimensions — not manufacturer artwork. Not affiliated with,
sponsored by, or endorsed by Apple, Samsung or Google.

Built by [DeenVeloper](https://github.com/bangsamoro).
