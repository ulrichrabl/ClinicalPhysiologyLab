/* Small DOM helpers. Nothing clever — just enough to write views as
   expressions instead of twenty lines of appendChild. */

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
    else n.setAttribute(k, v === true ? '' : v);
  }
  add(n, kids);
  return n;
}

function add(parent, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) add(parent, k);
    else parent.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
}

export const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

export function card(title, sub, ...body) {
  return el('section', { class: 'card' },
    (title || sub) && el('header', { class: 'card-h' },
      el('div', {},
        title && el('div', { class: 'card-t' }, title),
        sub && el('div', { class: 'card-sub' }, sub)),
    ),
    el('div', { class: 'card-b' }, ...body));
}

export function canvasCard(title, sub, height, extra) {
  const cv = el('canvas', { style: { width: '100%', height: `${height}px`, display: 'block' } });
  const c = card(title, sub, extra || null, cv);
  return { node: c, canvas: cv };
}

/* A labelled slider that reports on input and shows its live value. */
export function slider({ label, key, min, max, step, value, unit = '', hint, onInput, format }) {
  const out = el('span', { class: 'num' }, format ? format(value) : String(value));
  const input = el('input', {
    type: 'range', min, max, step, value,
    oninput: (e) => {
      const v = parseFloat(e.target.value);
      out.textContent = format ? format(v) : String(v);
      onInput(key, v);
    },
  });
  const node = el('div', { class: 'ctrl', data: { key } },
    el('label', {},
      el('span', {}, label),
      el('span', {}, out, unit && el('span', { class: 'unit' }, unit))),
    input,
    hint && el('div', { class: 'hint' }, hint));
  return {
    node,
    set(v) { input.value = v; out.textContent = format ? format(v) : String(v); },
    highlight(on) { node.classList.toggle('driven', !!on); },
  };
}

export function segmented(options, active, onPick) {
  const btns = options.map((o) => el('button', {
    class: 'chip' + (o.id === active ? ' on' : ''),
    onclick: () => { for (const b of btns) b.classList.toggle('on', b.dataset.id === o.id); onPick(o.id); },
    data: { id: o.id },
    title: o.title || '',
  }, o.label));
  return el('div', { class: 'chips' }, ...btns);
}

/* ---------------------------------------------------------------------------
   Inspector: a click-anywhere explanation popover. Every number in the app
   should be able to say what it is and why it is what it is.
--------------------------------------------------------------------------- */
export class Inspector {
  constructor(root) {
    this.node = el('div', { class: 'inspector', hidden: true });
    root.appendChild(this.node);
    document.addEventListener('pointerdown', (e) => {
      if (!this.node.hidden && !this.node.contains(e.target) && !e.target.closest('[data-inspect]')) this.hide();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); });
  }

  show(anchor, { title, value, body, detail, links }) {
    clear(this.node);
    this.node.append(
      el('div', { class: 'insp-h' },
        el('div', { class: 'insp-t' }, title),
        value && el('div', { class: 'insp-v' }, value)),
      body && el('p', { class: 'insp-b' }, body),
      detail && el('p', { class: 'insp-d' }, detail),
      links && links.length && el('div', { class: 'insp-links' },
        el('div', { class: 'eyebrow' }, 'Currently driven by'),
        ...links.map((l) => el('div', { class: 'insp-link' },
          el('strong', {}, l.name), ' — ', l.text))),
    );
    this.node.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = 320;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(12, Math.min(window.innerWidth - w - 12, x));
    let y = r.bottom + 10;
    this.node.style.left = `${x}px`;
    this.node.style.top = `${y}px`;
    const h = this.node.getBoundingClientRect().height;
    if (y + h > window.innerHeight - 12) this.node.style.top = `${Math.max(12, r.top - h - 10)}px`;
  }

  hide() { this.node.hidden = true; }
}

/* ---------------------------------------------------------------------------
   Toast — brief, non-blocking confirmation for things like "lesion applied".
--------------------------------------------------------------------------- */
export function toast(msg, kind = 'info') {
  let host = document.querySelector('.toasts');
  if (!host) { host = el('div', { class: 'toasts' }); document.body.appendChild(host); }
  const n = el('div', { class: `toast ${kind}` }, msg);
  host.appendChild(n);
  requestAnimationFrame(() => n.classList.add('in'));
  setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 260); }, 2600);
}

export const fmt = {
  n: (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d)),
  pct: (v) => (v == null ? '—' : `${Math.round(v)}%`),
  title: (s) => String(s).replace(/_/g, ' ').replace(/^([lr]) /i, (m, g) => g.toUpperCase() + ' '),
};
