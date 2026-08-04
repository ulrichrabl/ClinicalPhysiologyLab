import { el, clear, Inspector, toast } from './core/ui/kit.js';
import { installErrorHandlers, guard } from './core/diagnostics.js';
import { installCapture } from './core/capture.js';
import { invalidatePalette } from './core/ui/draw.js';
import { Patient, CHANNELS, channelStatus } from './core/patient.js';
import { PatientView } from './core/ui/patientview.js';
import cardioDomain from './domains/cardio/index.js';
import neuroDomain from './domains/neuro/index.js';
import labsDomain from './domains/labs/index.js';
import { VITALS } from './domains/cardio/data/reference.js';
import { attachRuntimeToPatient } from './runtime/compatibility-facade.ts';
import { neurogenicShockDemo } from './scenarios/definitions/neurogenic-shock-demo.ts';

/* ---------------------------------------------------------------------------
   Shell.

   Holds the patient, mounts the domains, and owns the two things that must be
   true across all of them: one set of vitals at the top of the screen, and one
   transport control. Everything else belongs to a domain.

   Adding a domain is one import and one entry in DOMAIN_FACTORIES.
--------------------------------------------------------------------------- */

const DOMAIN_FACTORIES = [cardioDomain, neuroDomain, labsDomain];

class Shell {
  constructor(root) {
    this.root = root;
    this.patient = new Patient();
    /* Patient Runtime owns condition → mechanism → effect → adapter for the
       C5 neurogenic-shock proof slice. Legacy Patient remains the shared
       channel the existing UI reads; the facade keeps them in sync. */
    this.runtime = attachRuntimeToPatient(this.patient, {
      seed: 'cpl-main-session',
      scenario: { id: neurogenicShockDemo.id, version: neurogenicShockDemo.version },
    });
    this.domains = [];
    this.byId = new Map();
    this.active = null;
    this.playing = true;
    this.speed = 1;
    this.lastSnap = null;

    this.buildChrome();
    this.inspector = new Inspector(document.body);

    for (const factory of DOMAIN_FACTORIES) {
      const d = factory({ patient: this.patient, shell: this, runtime: this.runtime });
      this.domains.push(d);
      this.byId.set(d.id, d);
    }

    /* Once domains are mounted, cardio has created its sim host. */
    const cardio = this.byId.get('cardio');
    if (cardio && typeof window !== 'undefined' && window.__sim) {
      this.runtime.bindCardioHost(window.__sim);
    }
    if (typeof window !== 'undefined') {
      window.__runtime = this.runtime;
      window.__scenario = neurogenicShockDemo;
    }

    this.patientView = new PatientView({
      patient: this.patient,
      onNavigate: (domainId) => {
        const d = this.byId.get(domainId);
        if (d) this.go(`${d.id}.${d.workspaces[0].id}`);
      },
    });
    this.patientDomain = {
      id: 'patient', name: 'Patient', tagline: 'The shared state both domains read',
      transport: false,
      workspaces: [{ id: 'shared', label: 'Shared state', node: this.patientView.node, view: this.patientView }],
    };
    this.domains.push(this.patientDomain);
    this.byId.set('patient', this.patientDomain);

    this.renderRail();
    this.go('cardio.loop');
    this.firstRun();

    window.addEventListener('resize', () => this.resizeActive());
    /* Redraw when the pane is actually laid out, rather than hoping a single
       animation frame was enough. This is what makes the canvases fill in on a
       slow first paint, on a font load, and after the first-run card closes. */
    if (typeof ResizeObserver === 'function') {
      let last = 0;
      this._ro = new ResizeObserver(() => {
        const w = this.pane.clientWidth;
        if (w && w !== last) { last = w; this.resizeActive(); }
      });
      this._ro.observe(this.pane);
    }
    // and once more after layout and webfonts have settled
    setTimeout(() => this.resizeActive(), 60);
    setTimeout(() => this.resizeActive(), 400);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this.resizeActive()).catch(() => {});
    }
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.patient.on(() => this.renderRailBadges());
  }

  /* ---- chrome ----------------------------------------------------------- */
  buildChrome() {
    this.domainTabs = el('div', { class: 'tabs domains' });
    this.spaceTabs = el('div', { class: 'tabs spaces' });

    this.playBtn = el('button', { class: 'tbtn', title: 'Play / pause  (space)',
      onclick: () => this.togglePlay() }, '❚❚');
    this.speedSel = el('div', { class: 'speed' },
      ...[0.25, 0.5, 1, 2].map((v) => el('button', {
        class: 'chip' + (v === 1 ? ' on' : ''),
        onclick: (e) => {
          for (const b of this.speedSel.children) b.classList.remove('on');
          e.currentTarget.classList.add('on');
          this.speed = v;
          for (const d of this.domains) d.control?.speed?.(v);
        },
      }, `${v}×`)));
    this.resetBtn = el('button', { class: 'tbtn', title: 'Reset', onclick: () => this.resetAll() }, '⟲');
    this.transport = el('div', { class: 'transport' }, this.playBtn, this.speedSel, this.resetBtn);

    this.themeBtn = el('button', { class: 'tbtn', title: 'Switch theme (T)',
      onclick: () => this.toggleTheme() }, '◐');

    this.monitor = el('div', { class: 'monitor' });

    this.pane = el('main', { class: 'pane' });

    this.root.append(
      el('header', { class: 'rail' },
        el('div', { class: 'brand' },
          el('span', { class: 'brand-mark' }),
          el('span', { class: 'brand-name' }, 'Clinical Physiology Lab')),
        this.domainTabs,
        el('div', { class: 'rail-spacer' }),
        this.transport,
        this.themeBtn),
      el('div', { class: 'subrail' }, this.spaceTabs),
      this.monitor,
      this.pane,
    );
  }

  renderRail() {
    clear(this.domainTabs);
    for (const d of this.domains) {
      const b = el('button', { class: 'tab', data: { domain: d.id },
        onclick: () => this.go(`${d.id}.${this.lastSpace(d) || d.workspaces[0].id}`) },
        el('span', {}, d.name),
        el('span', { class: 'tab-badge', hidden: true }));
      this.domainTabs.appendChild(b);
    }
    this.renderRailBadges();
  }

  renderRailBadges() {
    const active = this.patient.activeCouplings();
    for (const b of this.domainTabs.children) {
      const id = b.dataset.domain;
      const hits = active.filter((c) => c.to === id || (id === 'patient' && active.length));
      const badge = b.querySelector('.tab-badge');
      const n = id === 'patient' ? active.length : hits.length;
      badge.hidden = n === 0;
      badge.textContent = String(n);
      badge.className = 'tab-badge' + (hits.some((c) => c.level === 'danger') ? ' danger' : '');
    }
  }

  lastSpace(d) { return this._lastSpace?.[d.id]; }

  go(path) {
    const [domainId, spaceId] = path.split('.');
    const d = this.byId.get(domainId);
    if (!d) return;
    const space = d.workspaces.find((w) => w.id === spaceId) || d.workspaces[0];
    this.active = { domain: d, space };
    (this._lastSpace ??= {})[d.id] = space.id;

    for (const b of this.domainTabs.children) b.classList.toggle('on', b.dataset.domain === d.id);

    clear(this.spaceTabs);
    for (const w of d.workspaces) {
      this.spaceTabs.appendChild(el('button', {
        class: 'tab sm' + (w.id === space.id ? ' on' : ''),
        onclick: () => this.go(`${d.id}.${w.id}`),
      }, w.label));
    }
    this.spaceTabs.appendChild(el('div', { class: 'rail-spacer' }));
    this.spaceTabs.appendChild(el('div', { class: 'space-tagline' }, d.tagline || ''));

    this.transport.style.visibility = d.transport ? 'visible' : 'hidden';

    clear(this.pane);
    this.pane.appendChild(space.node);
    requestAnimationFrame(() => this.resizeActive());
  }

  activeWorkspace() { return this.active ? `${this.active.domain.id}.${this.active.space.id}` : null; }
  resizeActive() { guard('shell.resize', () => this.active?.space.view?.resize?.()); }

  /* ---- vitals strip ----------------------------------------------------- */
  updateVitals(snap) {
    this.lastSnap = snap;
    if (this.monitor.children.length === 0) this.buildVitals();
    const st = this.patient.all();
    for (const v of VITALS) {
      const cell = this._vitalCells?.[v.key];
      if (!cell) continue;
      const shown = v.read ? v.read(snap) : snap[v.key];
      cell.value.textContent = shown == null || (typeof shown === 'number' && Number.isNaN(shown))
        ? '—' : String(shown);
      const num = v.value ? v.value(snap) : (typeof shown === 'number' ? shown : null);
      cell.num = num;
      const bad = v.normal && num != null && (num < v.normal[0] || num > v.normal[1]);
      cell.node.classList.toggle('warn', !!bad);
    }
    // shared-state chips that are out of range
    const chips = [];
    for (const [k, ch] of Object.entries(CHANNELS)) {
      if (ch.derived && k !== 'CPP') continue;
      const s = channelStatus(k, st[k]);
      if (s === 'normal') continue;
      chips.push({ k, ch, v: st[k], s });
    }
    clear(this._alertCell);
    if (chips.length) {
      this._alertCell.append(...chips.map((c) => el('span', { class: `vflag ${c.s}` },
        `${c.ch.label.split(' ')[0]} ${typeof c.v === 'number' ? c.v.toFixed(c.ch.step < 1 ? 1 : 0) : c.v}`)));
    }
  }

  buildVitals() {
    this._vitalCells = {};
    for (const v of VITALS) {
      const value = el('span', { class: 'vital-v' }, '—');
      const node = el('button', { class: 'vital', data: { inspect: v.key },
        onclick: (e) => this.inspector.show(e.currentTarget, {
          title: v.title || v.label, value: value.textContent + (v.unit ? ` ${v.unit}` : ''),
          body: v.body,
          detail: typeof v.detail === 'function'
            ? (v.detail(this.lastSnap) || []).map(([k, val]) => `${k}: ${val}`).join('   ·   ')
            : v.detail,
          links: this.patient.explain(v.key).map((h) => ({ name: h.coupling.name, text: h.coupling.short })),
        }) },
        el('span', { class: 'vital-k' }, v.label),
        value,
        v.unit && el('span', { class: 'vital-u' }, v.unit),
        v.normal && el('span', { class: 'vital-l' }, v.normal));
      this._vitalCells[v.key] = { node, value };
      this.monitor.appendChild(node);
    }
    this._alertCell = el('div', { class: 'vflags' });
    this.monitor.append(el('div', { class: 'rail-spacer' }), this._alertCell);
  }

  /* A short orientation, dismissed for good on first close. Three things only:
     the one interaction that is not discoverable, the one that shows the
     framework off, and where to get help. */
  firstRun() {
    let seen = false;
    try { seen = localStorage.getItem('cpl.seen') === '1'; } catch {}
    if (seen) return;

    const close = () => {
      try { localStorage.setItem('cpl.seen', '1'); } catch {}
      overlay.remove();
    };
    const overlay = el('div', { class: 'first-run', onclick: (e) => { if (e.target === overlay) close(); } },
      el('div', { class: 'fr-card' },
        el('div', { class: 'eyebrow' }, 'Three things worth knowing'),
        el('h2', {}, 'Clinical Physiology Lab'),
        el('ol', { class: 'fr-list' },
          el('li', {},
            el('strong', {}, 'Drag the cardiac cycle strip. '),
            'The pressure–volume loop, the heart schematic and every number follow the '
            + 'cursor. Double-click to release it and go back to live.'),
          el('li', {},
            el('strong', {}, 'The patient is shared. '),
            'Place a cervical cord lesion in Neurology, then come back here — the '
            + 'circulation will have changed, because the sympathetic outflow is cut. '
            + 'The Patient tab lists every link that is currently firing.'),
          el('li', {},
            el('strong', {}, 'Press D at any time. '),
            'If a panel ever looks blank or wrong, that opens a diagnostic report you '
            + 'can copy — much more useful than a screenshot.')),
        el('p', { class: 'fr-keys' },
          'Space play/pause · Tab switch domain · 1–9 workspaces · T theme · Shift+C ECG capture'),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn', onclick: close }, 'Start'))));
    document.body.appendChild(overlay);
  }

  /* ---- controls --------------------------------------------------------- */
  togglePlay() {
    this.playing = !this.playing;
    this.playBtn.textContent = this.playing ? '❚❚' : '▶';
    for (const d of this.domains) (this.playing ? d.control?.play : d.control?.pause)?.();
  }

  resetAll() {
    this.patient.reset();
    for (const d of this.domains) d.control?.reset?.();
    toast('Patient and all models reset');
  }

  toggleTheme() {
    const cur = document.documentElement.dataset.theme || 'monitor';
    const next = cur === 'monitor' ? 'paper' : 'monitor';
    document.documentElement.dataset.theme = next;
    invalidatePalette();
    this.resizeActive();
  }

  onKey(e) {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); this.togglePlay(); }
    else if (e.key.toLowerCase() === 't') this.toggleTheme();
    else if (e.key >= '1' && e.key <= '9') {
      const i = +e.key - 1;
      const w = this.active?.domain.workspaces[i];
      if (w) this.go(`${this.active.domain.id}.${w.id}`);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const idx = this.domains.indexOf(this.active.domain);
      const next = this.domains[(idx + (e.shiftKey ? -1 : 1) + this.domains.length) % this.domains.length];
      this.go(`${next.id}.${this.lastSpace(next) || next.workspaces[0].id}`);
    }
  }
}

installErrorHandlers();
installCapture();
document.documentElement.dataset.theme = 'monitor';
const shell = new Shell(document.getElementById('app'));
if (typeof globalThis !== 'undefined') {
  globalThis.__shell = shell;
  /* Stamped by scripts/build.mjs — null in raw src / unbundled runs. */
  if (globalThis.__BUILD_ID === undefined) globalThis.__BUILD_ID = null;
}
