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
import { createPatientRuntime } from './runtime/patient-runtime.ts';
import { neurogenicShockDemo, compileScenario } from './scenarios/index.ts';
import {
  createExamineLayer,
  createInvestigateLayer,
  createTreatLayer,
} from './shell/layers.js';

/* ---------------------------------------------------------------------------
   Shell (ADR-009).

   Top-level information architecture: Patient / Examine / Investigate /
   Treat / Explore. Specialty domains remain Explore lenses. The Patient
   Runtime is the sole canonical-state authority.
--------------------------------------------------------------------------- */

const SPECIALTY_FACTORIES = [cardioDomain, neuroDomain, labsDomain];

class Shell {
  constructor(root) {
    this.root = root;
    this.patient = new Patient();
    this.runtime = createPatientRuntime({
      seed: 'cpl-main-session',
      scenario: { id: neurogenicShockDemo.id, version: neurogenicShockDemo.version },
      projectChannels: (patch) => this.patient.setMany(patch, 'runtime'),
    });
    this.patient.runtime = this.runtime;
    this.runtime.syncChannels(this.patient.channelSnapshot());

    /** Top-level ADR-009 layers shown in the primary rail. */
    this.domains = [];
    /** Specialty lenses (Circulation / Neurology / Labs), nested under Explore. */
    this.lenses = [];
    this.byId = new Map();
    this.active = null;
    this.exploreLensId = null;
    this.playing = true;
    this.speed = 1;
    this.lastSnap = null;

    this.buildChrome();
    this.inspector = new Inspector(document.body);

    for (const factory of SPECIALTY_FACTORIES) {
      const d = factory({ patient: this.patient, shell: this, runtime: this.runtime });
      d.lens = true;
      this.lenses.push(d);
      this.byId.set(d.id, d);
    }

    if (typeof window !== 'undefined' && window.__sim) {
      this.runtime.bindCardioHost(window.__sim);
    }

    const compiled = compileScenario(neurogenicShockDemo, {
      availableCapabilities: this.runtime.describeCapabilities().capabilities,
    });
    if (typeof window !== 'undefined') {
      window.__runtime = this.runtime;
      window.__scenario = neurogenicShockDemo;
      window.__compiledScenario = compiled.ok ? compiled.compiled : null;
    }

    this.patientView = new PatientView({
      patient: this.patient,
      runtime: this.runtime,
      onNavigate: (id) => this.navigateLayerOrLens(id),
    });

    const patientLayer = {
      id: 'patient',
      name: 'Patient',
      tagline: 'Clinical summary, scenario, and shared state',
      transport: false,
      layer: true,
      workspaces: [
        { id: 'summary', label: 'Summary', node: this.patientView.node, view: this.patientView },
      ],
    };

    const examineLayer = createExamineLayer({ runtime: this.runtime });
    const investigateLayer = createInvestigateLayer({
      runtime: this.runtime,
      onExplore: (lensId, spaceId) => this.go(`${lensId}.${spaceId}`),
    });
    const treatLayer = createTreatLayer({ runtime: this.runtime });

    const exploreLayer = {
      id: 'explore',
      name: 'Explore',
      tagline: 'Specialty lenses — Circulation, Neurology, Labs',
      transport: false,
      layer: true,
      workspaces: this.lenses.map((lens) => ({
        id: lens.id,
        label: lens.name,
        node: el('div', { class: 'explore-lens-placeholder' },
          el('p', {}, `Opening ${lens.name}…`)),
        view: { resize() {} },
        lensId: lens.id,
      })),
    };

    this.domains = [patientLayer, examineLayer, investigateLayer, treatLayer, exploreLayer];
    for (const d of this.domains) this.byId.set(d.id, d);

    this.renderRail();
    this.go('patient.summary');
    this.firstRun();

    window.addEventListener('resize', () => this.resizeActive());
    if (typeof ResizeObserver === 'function') {
      let last = 0;
      this._ro = new ResizeObserver(() => {
        const w = this.pane.clientWidth;
        if (w && w !== last) { last = w; this.resizeActive(); }
      });
      this._ro.observe(this.pane);
    }
    setTimeout(() => this.resizeActive(), 60);
    setTimeout(() => this.resizeActive(), 400);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this.resizeActive()).catch(() => {});
    }
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.patient.on(() => this.renderRailBadges());
    this.runtime.subscribe(() => this.renderRailBadges());
  }

  navigateLayerOrLens(id) {
    if (this.byId.has(id) && this.domains.includes(this.byId.get(id))) {
      const d = this.byId.get(id);
      this.go(`${d.id}.${d.workspaces[0].id}`);
      return;
    }
    const lens = this.lenses.find((l) => l.id === id);
    if (lens) {
      this.go(`${lens.id}.${lens.workspaces[0].id}`);
    }
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
          for (const d of this.lenses) d.control?.speed?.(v);
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
        onclick: () => {
          if (d.id === 'explore') {
            const lens = this.lenses.find((l) => l.id === this.exploreLensId) || this.lenses[0];
            this.go(`${lens.id}.${this.lastSpace(lens) || lens.workspaces[0].id}`);
            return;
          }
          this.go(`${d.id}.${this.lastSpace(d) || d.workspaces[0].id}`);
        } },
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
      const badge = b.querySelector('.tab-badge');
      let n = 0;
      let danger = false;
      if (id === 'patient' || id === 'examine') {
        n = active.length;
        danger = active.some((c) => c.level === 'danger');
      } else if (id === 'explore') {
        const hits = active.filter((c) => this.lenses.some((l) => l.id === c.to));
        n = hits.length;
        danger = hits.some((c) => c.level === 'danger');
      }
      badge.hidden = n === 0;
      badge.textContent = String(n);
      badge.className = 'tab-badge' + (danger ? ' danger' : '');
    }
  }

  lastSpace(d) { return this._lastSpace?.[d.id]; }

  isLensId(id) {
    return this.lenses.some((l) => l.id === id);
  }

  go(path) {
    const [domainId, spaceId] = path.split('.');
    const asLens = this.isLensId(domainId);
    const d = this.byId.get(domainId);
    if (!d) return;

    if (asLens) {
      this.exploreLensId = domainId;
      const space = d.workspaces.find((w) => w.id === spaceId) || d.workspaces[0];
      this.active = { domain: d, space, layer: 'explore' };
      (this._lastSpace ??= {})[d.id] = space.id;

      for (const b of this.domainTabs.children) {
        b.classList.toggle('on', b.dataset.domain === 'explore');
      }

      clear(this.spaceTabs);
      // Lens picker
      for (const lens of this.lenses) {
        this.spaceTabs.appendChild(el('button', {
          class: 'tab sm' + (lens.id === d.id ? ' on' : ''),
          onclick: () => this.go(`${lens.id}.${this.lastSpace(lens) || lens.workspaces[0].id}`),
        }, lens.name));
      }
      this.spaceTabs.appendChild(el('span', { class: 'space-sep' }, '·'));
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
      return;
    }

    // Top-level layer
    const space = d.workspaces.find((w) => w.id === spaceId) || d.workspaces[0];
    this.active = { domain: d, space, layer: d.id };
    (this._lastSpace ??= {})[d.id] = space.id;

    for (const b of this.domainTabs.children) {
      b.classList.toggle('on', b.dataset.domain === d.id);
    }

    clear(this.spaceTabs);
    for (const w of d.workspaces) {
      this.spaceTabs.appendChild(el('button', {
        class: 'tab sm' + (w.id === space.id ? ' on' : ''),
        onclick: () => {
          if (d.id === 'explore' && w.lensId) {
            const lens = this.byId.get(w.lensId);
            this.go(`${lens.id}.${this.lastSpace(lens) || lens.workspaces[0].id}`);
            return;
          }
          this.go(`${d.id}.${w.id}`);
        },
      }, w.label));
    }
    this.spaceTabs.appendChild(el('div', { class: 'rail-spacer' }));
    this.spaceTabs.appendChild(el('div', { class: 'space-tagline' }, d.tagline || ''));

    this.transport.style.visibility = d.transport ? 'visible' : 'hidden';

    // Explore workspace tiles jump straight into the lens.
    if (d.id === 'explore' && space.lensId) {
      const lens = this.byId.get(space.lensId);
      this.go(`${lens.id}.${this.lastSpace(lens) || lens.workspaces[0].id}`);
      return;
    }

    clear(this.pane);
    this.pane.appendChild(space.node);
    requestAnimationFrame(() => this.resizeActive());
  }

  activeWorkspace() {
    return this.active ? `${this.active.domain.id}.${this.active.space.id}` : null;
  }
  resizeActive() { guard('shell.resize', () => this.active?.space.view?.resize?.()); }

  /* ---- vitals strip ----------------------------------------------------- */
  updateVitalsFromRuntime() {
    if (!this.runtime) return;
    const snap = this.runtime.monitorSnapshot();
    this.lastSnap = snap;
    this.renderVitals(snap);
    const obs = this.runtime.observe({ type: 'observe.vital-signs' });
    this._lastVitalsObservation = obs;
  }

  updateVitals(snap) {
    this.lastSnap = snap;
    this.renderVitals(snap);
  }

  renderVitals(snap) {
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
    const chips = [];
    for (const [k, ch] of Object.entries(CHANNELS)) {
      if (ch.derived && k !== 'CPP') continue;
      const s = channelStatus(k, st[k]);
      if (s === 'normal') continue;
      chips.push({ k, ch, v: st[k], s });
    }
    const interp = this._lastVitalsObservation?.interpretation;
    if (interp?.length) {
      for (const i of interp) {
        chips.push({ k: i.id, ch: { label: i.label }, v: '', s: i.id.includes('shock') ? 'danger' : 'warn' });
      }
    }
    clear(this._alertCell);
    if (chips.length) {
      this._alertCell.append(...chips.map((c) => el('span', { class: `vflag ${c.s}` },
        c.v === '' || c.v == null
          ? c.ch.label
          : `${c.ch.label.split(' ')[0]} ${typeof c.v === 'number' ? c.v.toFixed(c.ch.step < 1 ? 1 : 0) : c.v}`)));
    }
  }

  buildVitals() {
    this._vitalCells = {};
    this._lastVitalsObservation = null;
    for (const v of VITALS) {
      const value = el('span', { class: 'vital-v' }, '—');
      const node = el('button', { class: 'vital', data: { inspect: v.key },
        onclick: (e) => {
          const obs = this.runtime?.observe?.({ type: 'observe.vital-signs' });
          const explain = this.runtime?.query?.({ type: 'explanation.vitals' });
          this.inspector.show(e.currentTarget, {
            title: v.title || v.label, value: value.textContent + (v.unit ? ` ${v.unit}` : ''),
            body: v.body,
            detail: typeof v.detail === 'function'
              ? (v.detail(this.lastSnap) || []).map(([k, val]) => `${k}: ${val}`).join('   ·   ')
              : v.detail,
            links: [
              ...(obs?.interpretation || []).map((i) => ({ name: i.label, text: 'Observation interpretation' })),
              ...(explain?.nodes || []).slice(0, 3).map((n) => ({ name: n.label, text: n.detail || n.kind })),
            ],
          });
        } },
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
            el('strong', {}, 'Work the patient, not the specialty. '),
            'Patient → Examine → Investigate → Treat. Specialty simulators live under Explore.'),
          el('li', {},
            el('strong', {}, 'Start the C5 scenario from Patient. '),
            'It compiles to runtime commands — the same path tests and tools use — and the '
            + 'circulation changes because sympathetic outflow is cut.'),
          el('li', {},
            el('strong', {}, 'Press D at any time. '),
            'If a panel ever looks blank or wrong, that opens a diagnostic report you '
            + 'can copy — much more useful than a screenshot.')),
        el('p', { class: 'fr-keys' },
          'Space play/pause · Tab switch layer · 1–9 workspaces · T theme · Shift+C ECG capture'),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn', onclick: close }, 'Start'))));
    document.body.appendChild(overlay);
  }

  /* ---- controls --------------------------------------------------------- */
  togglePlay() {
    this.playing = !this.playing;
    this.playBtn.textContent = this.playing ? '❚❚' : '▶';
    for (const d of this.lenses) (this.playing ? d.control?.play : d.control?.pause)?.();
  }

  resetAll() {
    this.patient.reset();
    for (const d of this.lenses) d.control?.reset?.();
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
      if (this.active?.layer === 'explore' || this.isLensId(this.active?.domain?.id)) {
        const lens = this.byId.get(this.exploreLensId) || this.lenses[0];
        const w = lens.workspaces[i];
        if (w) this.go(`${lens.id}.${w.id}`);
        return;
      }
      const w = this.active?.domain.workspaces[i];
      if (w) this.go(`${this.active.domain.id}.${w.id}`);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const idx = this.domains.indexOf(
        this.active?.layer === 'explore'
          ? this.byId.get('explore')
          : this.active?.domain,
      );
      const next = this.domains[(idx + (e.shiftKey ? -1 : 1) + this.domains.length) % this.domains.length];
      if (next.id === 'explore') {
        const lens = this.lenses.find((l) => l.id === this.exploreLensId) || this.lenses[0];
        this.go(`${lens.id}.${this.lastSpace(lens) || lens.workspaces[0].id}`);
      } else {
        this.go(`${next.id}.${this.lastSpace(next) || next.workspaces[0].id}`);
      }
    }
  }
}

installErrorHandlers();
installCapture();
document.documentElement.dataset.theme = 'monitor';
const shell = new Shell(document.getElementById('app'));
if (typeof globalThis !== 'undefined') {
  globalThis.__shell = shell;
  if (globalThis.__BUILD_ID === undefined) globalThis.__BUILD_ID = null;
}
