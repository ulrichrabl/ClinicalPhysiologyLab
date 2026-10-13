"""Screenshots and checks for the patient figure.

  python3 studio/figure/shoot.py                 # poses, states and body sheets, touch check (fast, a few seconds)
  python3 studio/figure/shoot.py motion          # a transition in frames
  python3 studio/figure/shoot.py zoom <patient-id> <pose> [chest,abdomen]
  python3 studio/figure/shoot.py app             # the figure inside the real app page, light desktop + dark phone
  python3 studio/figure/shoot.py all             # everything above, plus the poses sheet for every patient
  add 'dark' to any sheet command for dark mode

Images go to studio/figure/out/. Run `node studio/figure/build.mjs` first (run.sh does both).
"""
import json, sys, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'out'
BENCH = (OUT / 'bench.html').as_uri()
LAB = (HERE / '../../dist/lab.html').resolve()
args = sys.argv[1:]
dark = 'dark' in args
args = [a for a in args if a != 'dark']
mode = args[0] if args else 'default'

# The touch contract: every region the app listens to must be drawn, inside the frame, and reachable by a tap.
# The far (left) limbs are drawn behind the body and may be hidden in some poses: for them a tap is checked but only
# reported as a note (the region menu offers both sides anyway).
REGIONS = [('head', None), ('neck', None), ('chest', None), ('abdomen', None), ('arm', 'R'), ('arm', 'L'), ('legs', 'R'), ('legs', 'L')]
CHECK_JS = """(regions) => {
  const out = [];
  document.querySelectorAll('svg#figure').forEach((svg, i) => {
    const vb = svg.viewBox.baseVal;
    for (const [r, side] of regions) {
      const sel = `[data-region="${r}"]` + (side ? `[data-side="${side}"]` : '');
      const el = svg.querySelector(sel);
      if (!el) { out.push({ i, region: r, side, problem: 'missing' }); continue; }
      /* getBBox ignores stroke width, and limbs are drawn as thick strokes: grow the box by half the widest stroke. */
      const g = el.getBBox(), sw = Math.max(0, ...[el, ...el.querySelectorAll('*')].map((e) => parseFloat(e.getAttribute('stroke-width') ?? '0') || 0)) / 2;
      const b = { x: g.x - sw, y: g.y - sw, width: g.width + 2 * sw, height: g.height + 2 * sw };
      if (!isFinite(b.x) || b.width * b.height < 40) out.push({ i, region: r, side, problem: `too small (${b.width.toFixed(0)}×${b.height.toFixed(0)})` });
      if (b.x < -2 || b.y < -2 || b.x + b.width > vb.width + 2 || b.y + b.height > vb.height + 2) out.push({ i, region: r, side, problem: 'outside the viewBox' });
      // tap test: is any point of the region's box answered by the region itself?
      let hits = 0;
      for (let gx = 1; gx < 8; gx++) for (let gy = 1; gy < 8; gy++) {
        const sp = new DOMPoint(b.x + b.width * gx / 8, b.y + b.height * gy / 8).matrixTransform(el.getScreenCTM()), x = sp.x, y = sp.y;
        const hit = document.elementFromPoint(x, y)?.closest('[data-region]');
        if (hit && hit.dataset.region === r && (!side || hit.dataset.side === side)) hits++;
      }
      if (!hits) out.push({ i, region: r, side, problem: 'cannot be tapped (covered everywhere)', note: side === 'L' });
    }
    if (svg.innerHTML.includes('NaN')) out.push({ i, problem: 'NaN in the drawing' });
  });
  return { figures: document.querySelectorAll('svg#figure').length, problems: out };
}"""

def page_for(b, url, width):
    pg = b.new_page(viewport={'width': width, 'height': 900}, color_scheme='dark' if dark else 'light')
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url)
    pg.wait_for_selector('body[data-ready="1"]', timeout=10000)
    # the whole sheet inside the viewport, so the tap test can reach every figure
    pg.set_viewport_size({'width': width, 'height': pg.evaluate('document.documentElement.scrollHeight')})
    return pg, errors

def sheet(b, name, query, cols, w=190):
    url = f"{BENCH}?{query}&w={w}" + ('&theme=dark' if dark else '')
    pg, errors = page_for(b, url, 32 + cols * (w + 8))
    path = OUT / f"{name}{'-dark' if dark else ''}.png"
    pg.locator('#bench').screenshot(path=str(path))
    report = pg.evaluate(CHECK_JS, REGIONS)
    pg.close()
    return path, report, errors

def summarise(path, report, errors):
    probs = [p for p in report['problems'] if not p.get('note')]
    notes = [p for p in report['problems'] if p.get('note')]
    print(f"{path.relative_to(HERE.parent.parent)}: {report['figures']} figures, {len(probs)} touch problems, {len(notes)} far-limb notes" + (f", page errors: {errors}" if errors else ''))
    for p in probs[:12]:
        print('   ', p)
    return len(probs) + len(errors)

with sync_playwright() as p:
    b = p.chromium.launch()
    bad = 0
    if mode in ('default', 'all'):
        bad += summarise(*sheet(b, 'poses', 'sheet=poses', 6))
        bad += summarise(*sheet(b, 'states', 'sheet=states', 6))
        bad += summarise(*sheet(b, 'body', 'sheet=body', 5))
    if mode == 'all':
        bad += summarise(*sheet(b, 'poses-all', 'sheet=poses&all=1', 6, 150))
    if mode in ('motion', 'all'):
        q = 'sheet=motion' + (f'&patient={args[1]}' if mode == 'motion' and len(args) > 1 else '')
        bad += summarise(*sheet(b, 'motion', q, 8, 150))
    if mode == 'zoom':
        pid, pose = (args[1] if len(args) > 1 else 'diabetic-ketoacidosis'), (args[2] if len(args) > 2 else 'reclined-45')
        expo = args[3] if len(args) > 3 else ''
        bad += summarise(*sheet(b, f'zoom-{pid}-{pose}', f'sheet=zoom&patient={pid}&pose={pose}&exposure={expo}', 1, 720))
    if mode in ('app', 'all'):
        if not LAB.exists():
            print('dist/lab.html missing: run `node scripts/build-vp-demo.mjs` (run.sh app does it)')
        else:
            for scheme, width, name in (('light', 1280, 'app-desktop'), ('dark', 390, 'app-phone-dark')):
                pg = b.new_page(viewport={'width': width, 'height': 900}, color_scheme=scheme, device_scale_factor=1)
                pg.goto(LAB.as_uri()); pg.wait_for_timeout(600)
                pg.locator('.bedcard').nth(5).locator('button.primary').click(); pg.wait_for_timeout(1200)
                pg.locator('.figure-panel').screenshot(path=str(OUT / f'{name}.png'))
                print(f'studio/figure/out/{name}.png: the figure panel in the app ({scheme}, {width}px)')
                pg.close()
    b.close()
    sys.exit(1 if bad else 0)
