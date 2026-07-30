/* A DOM small enough to run the app's construction and render paths in Node.
   Not a browser — just enough surface that a missing method shows up as a real
   error instead of silence. */

const CTX_METHODS = ['clearRect','fillRect','strokeRect','beginPath','closePath','moveTo','lineTo',
  'arc','ellipse','quadraticCurveTo','bezierCurveTo','rect','roundRect','fill','stroke','save',
  'restore','setTransform','translate','rotate','scale','setLineDash','fillText','strokeText',
  'clip','createLinearGradient','drawImage','arcTo'];

function makeCtx() {
  const ctx = {
    measureText: (t) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    canvas: null,
  };
  for (const m of CTX_METHODS) if (!ctx[m]) ctx[m] = () => {};
  return new Proxy(ctx, {
    get(t, k) { if (k in t) return t[k]; return typeof k === 'string' ? undefined : undefined; },
    set(t, k, v) { t[k] = v; return true; },
  });
}

class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...c) { for (const x of c) if (x) this.set.add(x); this.sync(); }
  remove(...c) { for (const x of c) this.set.delete(x); this.sync(); }
  toggle(c, f) { const on = f === undefined ? !this.set.has(c) : !!f; on ? this.set.add(c) : this.set.delete(c); this.sync(); return on; }
  contains(c) { return this.set.has(c); }
  sync() { this.el._class = [...this.set].join(' '); }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.style = new Proxy({ setProperty(){}, removeProperty(){} }, { get:(t,k)=>t[k] ?? '', set:(t,k,v)=>{t[k]=v; return true;} });
    this.dataset = {};
    this.classList = new ClassList(this);
    this._class = '';
    this.attrs = {};
    this._text = '';
    this.listeners = {};
    this.hidden = false;
    this.value = '';
    this.clientWidth = 1200;
    this.clientHeight = 300;
    this.width = 0; this.height = 0;
    if (this.tagName === 'CANVAS') this._ctx = makeCtx();
  }
  get className() { return this._class; }
  set className(v) { this._class = v; this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text || this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  set innerHTML(v) { this._html = String(v); this.children = []; }
  get innerHTML() { return this._html || ''; }
  get firstChild() { return this.children[0] || null; }
  get lastElementChild() { return this.children[this.children.length - 1] || null; }
  appendChild(c) { if (!c) return c; c.parentElement = this; this.children.push(c); return c; }
  append(...cs) { for (const c of cs) if (c) this.appendChild(typeof c === 'object' ? c : textNode(c)); }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  remove() { this.parentElement?.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = v; if (k === 'class') this.className = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] ??= []).push(fn); }
  removeEventListener() {}
  dispatch(t, ev = {}) { for (const fn of this.listeners[t] || []) fn({ preventDefault(){}, currentTarget: this, target: this, ...ev }); }
  getContext() { return this._ctx; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 1200, bottom: 300, width: 1200, height: 300 }; }
  setPointerCapture() {}
  scrollIntoView() {}
  matches() { return false; }
  closest() { return null; }
  contains(n) { if (n === this) return true; return this.children.some(c => c.contains && c.contains(n)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const out = [];
    const want = sel.replace(/^\./, '').replace(/^\[data-(\w+)\]$/, '$1');
    const isAttr = /^\[data-/.test(sel);
    const isTag = /^[a-z]+$/i.test(sel);
    const walk = (n) => {
      for (const c of n.children) {
        if (isAttr) { const key = sel.slice(6, -1).replace(/-(\w)/g, (m,g)=>g.toUpperCase()); if (c.dataset[key] !== undefined) out.push(c); }
        else if (isTag) { if (c.tagName === sel.toUpperCase()) out.push(c); }
        else if (c.classList.contains(want)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}

function textNode(t) { const n = new El('#text'); n._text = String(t); return n; }

export function installDOM() {
  const doc = new El('#document');
  doc.documentElement = new El('html');
  doc.documentElement.dataset = {};
  doc.body = new El('body');
  const app = new El('div');
  app.attrs.id = 'app';
  doc.body.appendChild(app);
  doc.createElement = (t) => new El(t);
  doc.createTextNode = textNode;
  doc.getElementById = (id) => (id === 'app' ? app : null);
  doc.addEventListener = () => {};
  doc.querySelector = (s) => doc.body.querySelector(s);
  doc.activeElement = null;

  const g = globalThis;
  g.document = doc;
  g.window = g;
  g.self = g;
  g.location = { protocol: globalThis.__forceFile ? 'file:' : 'http:', href: 'http://x/' };
  g.innerWidth = 1400; g.innerHeight = 900;
  g.devicePixelRatio = 1;
  g.addEventListener = () => {};
  g.requestAnimationFrame = (fn) => { setTimeout(() => fn(performance.now()), 0); return 1; };
  g.cancelAnimationFrame = () => {};
  g.getComputedStyle = () => ({ getPropertyValue: (n) => ({ '--text': '#fff', '--muted': '#888' }[n] || '#888') });
  g.localStorage = { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=String(v); }, removeItem(k){ delete this._d[k]; } };
  g.Blob = class { constructor(parts) { this.parts = parts; } };
  // Keep the real URL constructor — esbuild and Node both need it — and just
  // bolt the object-URL helpers onto it.
  g.URL.createObjectURL = (b) => { g.__workerSource = b.parts[0]; return 'blob:worker'; };
  g.URL.revokeObjectURL = () => {};
  g.Worker = class {
    constructor() { g.__worker = this; this.onmessage = null; this.sent = []; }
    postMessage(m) { this.sent.push(m); }
    terminate() {}
  };
  return { doc, app };
}
