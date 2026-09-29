/* ---------------------------------------------------------------------------
   Tap → click safety net.

   Some embedded touch browsers (seen in an in-app WebKit view) deliver
   pointer and touch events for a tap but never deliver the `click` that
   should follow. Every control in this app listens for `click`, so on those
   browsers nothing responds.

   This watches taps at the window level. When a short, still tap ends on an
   interactive element and no native click reaches that element soon after,
   it performs the click itself. Where native clicks arrive, as in every
   desktop browser and in ordinary mobile browsers, it does nothing: the
   native click is seen and the synthetic one is never sent. A late native
   click that arrives after a synthetic one is swallowed, so nothing fires
   twice.
--------------------------------------------------------------------------- */

const INTERACTIVE = 'button, a[href], summary, label, input, select, textarea, [role="button"], [role="tab"], [onclick], .hs, .chip, .opt';
const WAIT_MS = 380;        // how long to wait for the native click
const SWALLOW_MS = 1200;    // how long a late native click is suppressed
const MAX_MOVE = 12;        // px; a longer move is a scroll or drag, not a tap
const MAX_PRESS = 900;      // ms; a longer press is not a tap

export function installTapFix(win = globalThis.window) {
  if (!win || !win.addEventListener || win.__tapFixInstalled) return () => {};
  win.__tapFixInstalled = true;
  const doc = win.document;

  let down = null;              // { x, y, t, target }
  let lastNativeClick = { el: null, t: 0 };
  let synthetic = { el: null, t: 0 };
  let syntheticInFlight = false;

  const targetOf = (e) => {
    const t = e.target && e.target.nodeType === 1 ? e.target : e.target?.parentElement;
    return t?.closest?.(INTERACTIVE) || null;
  };

  const onDown = (e) => {
    if (e.button > 0) { down = null; return; }   // right or middle button
    const p = e.touches?.[0] || e;
    down = { x: p.clientX, y: p.clientY, t: Date.now(), target: targetOf(e) };
  };

  const onUp = (e) => {
    const d = down; down = null;
    if (!d || !d.target) return;
    const p = e.changedTouches?.[0] || e;
    if (Math.hypot((p.clientX ?? d.x) - d.x, (p.clientY ?? d.y) - d.y) > MAX_MOVE) return;
    if (Date.now() - d.t > MAX_PRESS) return;
    const el = d.target;
    if (el.disabled || el.closest?.('[disabled], [aria-disabled="true"]')) return;
    if (el.tagName === 'INPUT' && /^(range|file)$/i.test(el.type)) return;
    const upAt = Date.now();
    setTimeout(() => {
      if (!el.isConnected) return;
      const nativeSeen = lastNativeClick.t >= upAt - 50
        && (lastNativeClick.el === el || el.contains?.(lastNativeClick.el) || lastNativeClick.el?.contains?.(el));
      if (nativeSeen) return;
      synthetic = { el, t: Date.now() };
      syntheticInFlight = true;
      try {
        const tag = el.tagName;
        if (tag === 'SELECT' || (tag === 'INPUT' && !/^(checkbox|radio|button|submit|range|file)$/i.test(el.type))
          || tag === 'TEXTAREA') {
          el.focus({ preventScroll: true });
        } else if (typeof el.click === 'function') {
          el.click();
        } else {
          // SVG elements (the patient's tap spots) have no .click().
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: win }));
        }
      } finally { syntheticInFlight = false; }
    }, WAIT_MS);
  };

  const onClick = (e) => {
    if (syntheticInFlight || !e.isTrusted) return;
    const el = targetOf(e) || e.target;
    const s = synthetic;
    if (s.el && Date.now() - s.t < SWALLOW_MS && (s.el === el || s.el.contains?.(el) || el?.contains?.(s.el))) {
      // The browser caught up after we had already clicked for it.
      e.stopImmediatePropagation();
      e.preventDefault();
      synthetic = { el: null, t: 0 };
      return;
    }
    lastNativeClick = { el, t: Date.now() };
  };

  const hasPointer = 'PointerEvent' in win;
  const opts = { capture: true, passive: true };
  if (hasPointer) {
    win.addEventListener('pointerdown', onDown, opts);
    win.addEventListener('pointerup', onUp, opts);
    win.addEventListener('pointercancel', () => { down = null; }, opts);
  } else {
    win.addEventListener('touchstart', onDown, opts);
    win.addEventListener('touchend', onUp, opts);
    win.addEventListener('touchcancel', () => { down = null; }, opts);
  }
  win.addEventListener('click', onClick, true);
  doc?.documentElement?.classList?.add('tapfix');

  return () => {
    win.__tapFixInstalled = false;
    for (const [ev, fn] of [['pointerdown', onDown], ['pointerup', onUp], ['touchstart', onDown], ['touchend', onUp]]) {
      win.removeEventListener(ev, fn, opts);
    }
    win.removeEventListener('click', onClick, true);
  };
}
