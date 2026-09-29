import { el, clear, toast } from '../core/ui/kit.js';
import { guard } from '../core/diagnostics.js';
import { learning } from '../core/learning/index.js';
import { CONFIDENCE } from '../core/learning/srs.js';
import { BODY_REGIONS } from '../domains/neuro/data/exam.js';
import { findingsForNodes, sparedForNodes, cordLevelOf } from '../domains/neuro/model/localize.js';
import * as F from './findings.js';
import { PERSONAS, QUESTIONS, DEFAULT_ANSWERS, MANOEUVRES, personaById } from './personas.js';
import { patientSvg, updateFigure, say, placeStethoscope, HOTSPOTS } from './figure.js';
import { synthBeat, synthBreath, Stethoscope } from './sound.js';

/* ---------------------------------------------------------------------------
   Bedside encounter.

   Meet the patient, talk to them, look, feel, listen, and ask them to do
   things; then commit to what is going on. Everything you find comes from
   the live model through bedside/findings.js, and every finding can answer
   "why?". The monitor strip is hidden during an encounter, because at a
   real bedside you have to go and get the numbers yourself.
--------------------------------------------------------------------------- */

const TOOLS = [
  { id: 'talk', label: 'Talk', icon: '💬' },
  { id: 'look', label: 'Look', icon: '👁' },
  { id: 'feel', label: 'Feel', icon: '✋' },
  { id: 'listen', label: 'Listen', icon: '🩺' },
  { id: 'instruct', label: 'Instruct', icon: '🗣' },
  { id: 'measure', label: 'Measure', icon: '📟' },
];

const NEURO_GROUPS = {
  eyes: { label: 'Eyes and pupils', regions: ['R_eye', 'L_eye'] },
  face: { label: 'Face, hearing, speech, swallow', regions: ['R_face', 'L_face', 'R_ear', 'L_ear', 'speech', 'throat'] },
  R_arm: { label: 'Right arm', regions: ['R_arm'] },
  L_arm: { label: 'Left arm', regions: ['L_arm'] },
  trunk: { label: 'Trunk and bladder', regions: ['trunk'] },
  R_leg: { label: 'Right leg', regions: ['R_leg'] },
  L_leg: { label: 'Left leg', regions: ['L_leg'] },
};

const spotById = (id) => Object.values(HOTSPOTS).flat().find((h) => h.id === id);

export class BedsideView {
  constructor({ shell, runtime }) {
    this.shell = shell;
    this.runtime = runtime;
    this.node = el('div', { class: 'bedside' });
    this.persona = null;
    this.tool = 'talk';
    this.steth = new Stethoscope();
    this.soundOn = false;
    this.neuroGroup = null;
    this.registerItems();
    this.render();
    this._tick = setInterval(() => {
      if (this.node.isConnected && this.persona) guard('bedside.tick', () => this.tickFigure());
      else if (!this.node.isConnected) this.stopSound();
    }, 1000);
  }

  /* ---- learning integration -------------------------------------------- */
  registerItems() {
    learning.registry.registerRunner('bedside', 'case', this);
    for (const p of PERSONAS) {
      if (!p.diagnosis) continue;
      learning.registry.add({
        id: `bedside/case/${p.id}`, kind: 'case', domain: 'bedside', path: 'examine.encounter',
        topic: 'Bedside encounters', topicId: 'bedside', title: `${p.name}, ${p.age}: ${p.triage.split('.')[0]}`,
        answerLabel: () => p.diagnosis.options[p.diagnosis.answer],
      });
    }
  }

  jumpTo(id) { const local = String(id).split('/').pop(); this.start(personaById(local)); return true; }

  resize() {}
  refresh() { if (!this.persona) this.render(); }

  /* ---- context ----------------------------------------------------------- */
  cardio() { return this.shell.byId.get('cardio'); }
  neuro() { return this.shell.byId.get('neuro'); }
  snap() { return this.shell.byId.get('cardio')?.snapshot?.() || null; }

  ctx() {
    const p = this.persona;
    const nodes = p?.setup?.neuro?.nodes || null;
    return F.makeContext({
      snap: this.snap(),
      chem: this.runtime?.chemistryState?.() || {},
      persona: p || {},
      cordLevel: nodes ? cordLevelOf(nodes) : null,
    });
  }

  neuroState() {
    const nodes = this.persona?.setup?.neuro?.nodes || [];
    if (!nodes.length) return { findings: [], spared: [] };
    if (!this._neuroCache) this._neuroCache = { findings: findingsForNodes(nodes, true), spared: sparedForNodes(nodes, true) };
    return this._neuroCache;
  }

  /* ---- starting an encounter -------------------------------------------- */
  start(persona) {
    this.stopSound();
    this.persona = persona;
    this._neuroCache = null;
    this.log = [];
    this.actions = new Set();
    this.keys = new Set();
    this.manoeuvre = null;
    this.finished = null;
    this.pick = null;
    this.tool = 'talk';
    this.neuroGroup = null;
    this.listening = null;
    this.startedAt = Date.now();
    this.monitorOn = false;
    document.body.classList.remove('monitor-on');

    guard('bedside.stage', () => {
      this.shell.resetAll?.();
      const neuro = this.neuro();
      neuro?.applyLesion?.({ nodes: persona.setup.neuro ? persona.setup.neuro.nodes : [], complete: true });
      /* A cord lesion switches the baroreflex off through the runtime (the
         sympathetic outflow is cut). Re-enabling it here would quietly undo
         the neurogenic shock, so only restore it for patients without one. */
      this.cardio()?.apply?.({
        params: { ...persona.setup.params },
        pathology: persona.setup.pathology || 'normal',
        baro: persona.setup.neuro ? null : true,
        settle: 14,
      });
    });

    this.push({ who: 'sys', text: `${persona.setting}. ${persona.triage}` });
    this.render();
  }

  leave() {
    this.stopSound();
    this.persona = null;
    document.body.classList.remove('monitor-on');
    this.render();
  }

  /* ---- log ---------------------------------------------------------------- */
  push(entry) {
    this.log.push({ t: Date.now(), ...entry });
    if (this.lastNode && (entry.who === 'pt' || entry.who === 'find')) {
      clear(this.lastNode);
      this.lastNode.append(el('span', { class: 'bs-last-k' }, entry.who === 'pt' ? this.persona.name.split(' ')[0] : 'Finding'),
        el('span', {}, entry.who === 'pt' ? entry.text : entry.finding.text));
      this.lastNode.classList.toggle('abn', entry.who === 'find' && !!entry.finding.abnormal);
    }
    if (entry.key) this.keys.add(entry.key);
    if (entry.finding?.key) this.keys.add(entry.finding.key);
    this.renderLog();
  }

  /* ---- actions ------------------------------------------------------------ */
  talk(item) {
    const p = this.persona;
    const c = this.ctx();
    const cs = F.consciousness(c);
    const entry = p.history[item.id];
    let a = entry?.a || DEFAULT_ANSWERS[item.id] || (item.id === 'intro' ? `${p.name}.` : 'Sorry, I don’t follow.');
    if (cs.talk === 'drowsy') a = `Mm… ${a.split(/[.!?]/)[0].toLowerCase()}…`;
    if (cs.talk === 'none') a = '(No verbal response. Eyes flicker open to a sternal rub.)';
    this.actions.add(`talk.${item.id}`);
    this.push({ who: 'doc', text: item.q });
    this.push({ who: 'pt', text: a, key: cs.talk === 'normal' ? entry?.key : null });
    say(this.fig, a);
  }

  examine(spotId) {
    if (spotId.startsWith('listen.')) { this.listen(spotId); return; }
    const c = this.ctx();
    const spot = spotById(spotId);
    this.actions.add(spotId);
    let findings = [];
    switch (spotId) {
      case 'look.general': findings = F.appearance(c); break;
      case 'look.jvp': findings = [F.jvp(c)]; break;
      case 'look.chest': {
        if (c.cervicalCord) { findings = F.appearance(c).filter((x) => x.key === 'look.paradox'); break; }
        const rr = F.observations(c)[2];
        findings = [{ ...rr, text: `Chest expands symmetrically. ${rr.text}${c.RR > 22 ? ', using accessory muscles' : ''}.` }];
        break;
      }
      case 'look.hands': findings = [{ text: `No clubbing.${c.Hb < 105 ? ' Pale palmar creases.' : ''}${c.CRT >= 4 ? ' Peripheral cyanosis of the nail beds.' : ''}`,
        basis: `Hb ${Math.round(c.Hb)} g/L; capillary refill ${c.CRT} s`, abnormal: c.Hb < 105 || c.CRT >= 4, kind: 'model' }]; break;
      case 'feel.radial': findings = [F.pulse(c, 'radial')]; break;
      case 'feel.carotid': findings = [F.pulse(c, 'carotid')]; break;
      case 'feel.periph': findings = [F.peripheries(c)]; break;
      case 'feel.apex': findings = [F.apex(c)]; break;
      case 'feel.abdomen': findings = F.abdomen(c); break;
      case 'feel.ankles': findings = [F.oedema(c)]; break;
      default: break;
    }
    this.push({ who: 'act', text: `${spotId.startsWith('look') ? 'Inspect' : 'Palpate'} · ${spot?.label || spotId}` });
    for (const x of findings) this.push({ who: 'find', finding: x });
    this.markDone();
  }

  listen(spotId) {
    const c = this.ctx();
    const area = spotId.split('.')[1];
    const spot = spotById(spotId);
    this.actions.add(spotId);
    placeStethoscope(this.fig, spot);
    this.listening = spotId;
    let finding;
    if (area === 'lungL' || area === 'lungR') finding = F.lungs(c, area === 'lungR' ? 'R' : 'L');
    else if (area === 'carotid') finding = F.carotidAuscultation(c);
    else finding = F.heart(c, area, { manoeuvre: this.activeManoeuvre() });
    const man = this.activeManoeuvre();
    this.push({ who: 'act', text: `Auscultate · ${spot?.label || area}${man ? ` (${man.replace('-', ' ')})` : ''}` });
    this.push({ who: 'find', finding });
    this.renderSteth(finding);
    if (this.soundOn) this.playSound();
    this.markDone();
  }

  markDone() {
    for (const b of this.panelNode?.querySelectorAll?.('[data-spot]') || []) {
      b.classList.toggle('done', this.actions.has(b.dataset.spot));
    }
  }

  activeManoeuvre() {
    return this.manoeuvre && Date.now() < this.manoeuvre.until ? this.manoeuvre.id : null;
  }

  doManoeuvre(m) {
    this.push({ who: 'doc', text: m.ask });
    if (this.persona.immobile) {
      const a = 'I can’t, I’m strapped to this board and I can’t move.';
      this.push({ who: 'pt', text: a }); say(this.fig, a); return;
    }
    this.manoeuvre = { id: m.id, until: Date.now() + 30_000 };
    this.push({ who: 'pt', text: m.reply });
    say(this.fig, m.reply);
    toast(`${m.hint} Listen within 30 seconds.`);
  }

  neuroTest(region, test) {
    const r = F.neuroTest(test, this.neuroState(), { spinalShock: !!this.persona.spinalShock });
    this.actions.add(`neuro.${test.id}`);
    this.push({ who: 'doc', text: `${region.label}: ${test.label}.` });
    const motor = /power|strength|abduction|flexion|extension|dorsiflexion|grip|shrug|jaw|tongue|\(C\d|\(L\d|\(S\d/i.test(test.label);
    const sensory = /sensation|pinprick|vibration|touch|proprio/i.test(test.label);
    const reply = r.abnormal
      ? (motor ? 'I’m trying… it won’t move.' : sensory ? 'I can’t feel that at all.' : 'Is that right?')
      : (sensory ? 'Yes, I can feel that.' : 'Okay.');
    this.push({ who: 'pt', text: reply });
    say(this.fig, reply);
    this.push({ who: 'find', finding: r });
  }

  measure() {
    const c = this.ctx();
    this.actions.add('measure.obs');
    this.push({ who: 'act', text: 'Measure · A full set of observations' });
    for (const x of F.observations(c)) this.push({ who: 'find', finding: x });
  }

  toggleMonitor() {
    this.monitorOn = !this.monitorOn;
    document.body.classList.toggle('monitor-on', this.monitorOn);
    if (this.monitorOn) { this.actions.add('measure.monitor'); this.push({ who: 'act', text: 'Attached to the monitor: ECG, non-invasive BP, SpO₂.' }); }
    this.renderHead();
    if (this.tool === 'measure') this.renderToolPanel();
  }

  /* ---- sound -------------------------------------------------------------- */
  makeBuffer(fs, seed) {
    const area = (this.listening || '').split('.')[1];
    if (!area) return null;
    const c = this.ctx();
    if (area === 'lungL' || area === 'lungR') {
      return synthBreath({ rr: c.RR, crackles: c.LAP > 25 ? 1 : c.LAP > 18 ? 0.5 : 0, weak: c.cervicalCord }, fs, seed);
    }
    const h = F.heart(c, area, { manoeuvre: this.activeManoeuvre() });
    return synthBeat(this.snap()?.beat, { area, murmurs: h.sound.murmurs, extras: h.sound.extras, gradient: c.gradient }, fs, seed);
  }

  playSound() {
    if (!this.listening) return;
    const started = this.steth.start((fs) => this.makeBuffer(fs, Math.floor(Math.random() * 1e9)));
    if (!started) toast('This browser has no Web Audio; the phonocardiogram still shows what you would hear.');
  }

  stopSound() { this.steth.stop(); }

  toggleSound() {
    this.soundOn = !this.soundOn;
    if (this.soundOn) this.playSound(); else this.stopSound();
    if (this.tool === 'listen') this.renderToolPanel();
    this.renderStethButton();
  }

  drawPcg(data) {
    const cv = this.pcg;
    if (!cv || !cv.isConnected || !data) return;
    const w = cv.clientWidth || 300; const hgt = cv.clientHeight || 70;
    const dpr = globalThis.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
    const g = cv.getContext?.('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    g.strokeStyle = getComputedStyle(cv).color || '#3DDC84';
    g.lineWidth = 1.2; g.beginPath();
    const step = Math.max(1, Math.floor(data.length / w));
    for (let x = 0; x < w; x++) {
      let mx = 0;
      for (let k = x * step; k < Math.min(data.length, (x + 1) * step); k++) mx = Math.max(mx, Math.abs(data[k]));
      g.moveTo(x + 0.5, hgt / 2 - mx * (hgt * 0.45)); g.lineTo(x + 0.5, hgt / 2 + mx * (hgt * 0.45));
    }
    g.stroke();
  }

  /* ---- commit & debrief ------------------------------------------------- */
  finish(choice, conf) {
    const p = this.persona;
    const d = p.diagnosis;
    const correct = !!d && choice === d.answer;
    const kf = this.keyFindingStatus();
    this.finished = { choice, correct, conf, kf, minutes: Math.max(1, Math.round((Date.now() - this.startedAt) / 60000)) };
    if (d) {
      learning.store.recordAttempt(`bedside/case/${p.id}`, { correct, choice: String(choice), conf, ms: Date.now() - this.startedAt, context: 'bedside' });
      learning.session.note(`bedside/case/${p.id}`, correct);
    }
    this.stopSound();
    this.render();
  }

  keyFindingStatus() {
    const has = (k) => (k.startsWith('@') ? this.actions.has(k.slice(1)) : [...this.keys].some((x) => x === k || x.startsWith(k)));
    return (this.persona.keyFindings || []).map((kf) => ({ ...kf, done: kf.all ? kf.keys.every(has) : kf.keys.some(has) }));
  }

  /* ---- rendering --------------------------------------------------------- */
  render() {
    clear(this.node);
    if (!this.persona) { this.node.append(this.renderPicker()); return; }
    this.headNode = el('div', { class: 'bs-head' });
    this.figNode = el('div', { class: 'bs-figure', html: patientSvg(this.persona) });
    this.fig = this.figNode;
    this.figNode.addEventListener('click', (e) => {
      const hs = e.target.closest?.('.hs'); if (!hs) return;
      this.onHotspot(hs.dataset.id);
    });
    this.figNode.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const hs = e.target.closest?.('.hs'); if (!hs) return;
      e.preventDefault(); this.onHotspot(hs.dataset.id);
    });
    this.toolbar = el('div', { class: 'bs-tools', role: 'tablist' });
    this.panelNode = el('div', { class: 'bs-panel' });
    this.logNode = el('div', { class: 'bs-log', 'aria-live': 'polite' });
    this.stethNode = el('div', { class: 'bs-steth', hidden: true });
    /* On a phone the figure scrolls away while you pick questions, so the
       latest reply or finding is echoed right under the tool bar. */
    this.lastNode = el('div', { class: 'bs-last', 'aria-hidden': 'true' });

    this.node.append(
      this.headNode,
      el('div', { class: 'bs-grid' },
        el('section', { class: 'card bs-stage' },
          el('div', { class: 'bs-fig-wrap' }, this.figNode, el('div', { class: 'bs-orient' }, 'Patient’s right', el('span', {}, 'Patient’s left'))),
          this.toolbar, this.stethNode),
        this.lastNode,
        el('div', { class: 'bs-side' },
          el('section', { class: 'card' }, this.panelNode),
          el('section', { class: 'card bs-log-card' },
            el('header', { class: 'card-h' }, el('div', {}, el('div', { class: 'card-t' }, 'Encounter'),
              el('div', { class: 'card-sub' }, 'Everything said and found, in order. Tap “why?” on any finding to see where it comes from.'))),
            this.logNode))));
    this.renderHead();
    this.renderTools();
    this.renderToolPanel();
    this.renderLog();
    if (this.finished) this.renderDebrief();
    this.tickFigure();
  }

  renderPicker() {
    return el('div', { class: 'learn-wrap' },
      el('div', { class: 'learn-head' }, el('div', {},
        el('div', { class: 'eyebrow' }, 'Examine'),
        el('h1', { class: 'learn-h1' }, 'The bedside'),
        el('p', { class: 'learn-lede' }, 'Take a history, examine, and decide. Pulses, heart sounds, neck veins and neurology are all '
          + 'generated live by the simulator, so what you find is what the physiology is doing. Headphones help for the stethoscope.'))),
      el('div', { class: 'mod-grid' }, ...PERSONAS.map((p) => {
        const rec = learning.store.item(`bedside/case/${p.id}`);
        const last = rec?.attempts?.at(-1);
        return el('button', { class: 'mod-card bs-pcard', onclick: () => this.start(p) },
          el('div', { class: 'mod-card-top' },
            el('span', { class: 'mod-spec' }, p.setting),
            p.practice ? el('span', { class: 'pill' }, 'Practice')
              : last ? el('span', { class: `pill ${last.ok ? 'ok' : 'no'}` }, last.ok ? 'Solved' : 'Try again') : null),
          el('div', { class: 'bs-pc-row' },
            el('div', { class: 'bs-avatar', html: patientSvg(p).replace('class="pt-svg"', 'class="pt-svg mini"') }),
            el('div', {},
              el('div', { class: 'mod-title' }, `${p.name}, ${p.age}`),
              el('div', { class: 'mod-blurb' }, p.triage))));
      })));
  }

  renderHead() {
    const p = this.persona; if (!p || !this.headNode) return;
    clear(this.headNode);
    this.headNode.append(
      el('div', { class: 'bs-who' },
        el('div', { class: 'eyebrow' }, p.setting),
        el('div', { class: 'bs-name' }, `${p.name}, ${p.age}`),
        el('div', { class: 'bs-triage' }, p.triage)),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn sm' + (this.monitorOn ? ' on' : ''), onclick: () => this.toggleMonitor(), title: 'Show the vital-signs strip' },
          this.monitorOn ? 'Monitor attached' : 'Attach monitor'),
        el('button', { class: 'btn sm ghost', onclick: () => this.leave() }, 'Change patient'),
        !this.finished && el('button', { class: 'btn sm primary', onclick: () => this.setTool('commit') },
          p.diagnosis ? 'Commit to a diagnosis' : 'Finish')));
  }

  setTool(id) {
    this.tool = id;
    this.neuroGroup = null;
    if (id !== 'listen') { this.stopSound(); placeStethoscope(this.fig, null); if (this.stethNode) this.stethNode.hidden = true; }
    this.renderTools();
    this.renderToolPanel();
    this.tickFigure();
    if (id === 'commit') this.panelNode?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  renderTools() {
    clear(this.toolbar);
    for (const t of TOOLS) {
      this.toolbar.append(el('button', {
        class: 'bs-tool' + (this.tool === t.id ? ' on' : ''), role: 'tab', 'aria-selected': this.tool === t.id ? 'true' : 'false',
        onclick: () => this.setTool(t.id) },
      el('span', { class: 'bs-ti', 'aria-hidden': 'true' }, t.icon), el('span', {}, t.label)));
    }
  }

  onHotspot(id) {
    if (id.startsWith('region:')) { this.neuroGroup = id.slice(7); this.renderToolPanel(); return; }
    this.examine(id);
  }

  renderToolPanel() {
    const n = this.panelNode; if (!n) return;
    clear(n);
    const head = (t, s) => el('header', { class: 'card-h' }, el('div', {}, el('div', { class: 'card-t' }, t), s && el('div', { class: 'card-sub' }, s)));
    const body = el('div', { class: 'card-b' });
    const spotButtons = (tool) => el('div', { class: 'bs-choices' }, ...(HOTSPOTS[tool] || []).map((h) =>
      el('button', { class: 'bs-choice' + (this.actions?.has(h.id) ? ' done' : ''), data: { spot: h.id }, onclick: () => this.examine(h.id) }, h.label)));

    if (this.finished) { n.append(head('Debrief'), body); body.append(el('p', { class: 'fine' }, 'Your debrief is below the encounter.')); return; }

    switch (this.tool) {
      case 'talk':
        n.append(head('Talk', 'Choose what to say. The patient answers in their own words.'), body);
        for (const g of QUESTIONS) {
          body.append(el('details', { class: 'bs-q', open: g.cat === 'Introduction' || g.cat === 'Presenting complaint' },
            el('summary', {}, g.cat),
            el('div', { class: 'bs-choices' }, ...g.items.map((it) => el('button', {
              class: 'bs-choice' + (this.actions?.has(`talk.${it.id}`) ? ' done' : ''),
              onclick: (e) => { this.talk(it); e.currentTarget.classList.add('done'); } }, it.q)))));
        }
        break;
      case 'look':
        n.append(head('Look', 'Inspect from the end of the bed, then up close. Tap the figure or choose below.'), body);
        body.append(spotButtons('look'));
        break;
      case 'feel':
        n.append(head('Feel', 'Pulses, peripheries, the apex, the abdomen and the ankles.'), body);
        body.append(spotButtons('feel'));
        break;
      case 'listen':
        n.append(head('Listen', 'Place the stethoscope. Sound is synthesised from the model’s own heartbeat.'), body);
        body.append(
          el('div', { class: 'btn-row' },
            el('button', { class: 'btn sm' + (this.soundOn ? ' primary' : ''), onclick: () => this.toggleSound() }, this.soundOn ? '🔊 Sound on' : '🔈 Sound off'),
            el('span', { class: 'fine' }, 'Headphones recommended.')),
          spotButtons('listen'),
          el('div', { class: 'bs-sub' }, 'Percuss'),
          el('div', { class: 'bs-choices' }, el('button', { class: 'bs-choice' + (this.actions.has('percuss.bases') ? ' done' : ''), onclick: (e) => {
            this.actions.add('percuss.bases'); e.currentTarget.classList.add('done');
            this.push({ who: 'act', text: 'Percuss · Both lung bases' }); this.push({ who: 'find', finding: F.percussion(this.ctx()) });
          } }, 'Percuss both lung bases')));
        break;
      case 'instruct': {
        n.append(head('Instruct', 'Ask the patient to do things: manoeuvres for auscultation, or a neurological examination by region.'), body);
        body.append(el('div', { class: 'bs-sub' }, 'Manoeuvres'),
          el('div', { class: 'bs-choices' }, ...MANOEUVRES.map((m) => el('button', { class: 'bs-choice', onclick: () => this.doManoeuvre(m), title: m.hint }, m.ask))),
          el('div', { class: 'bs-sub' }, 'Neurological examination'));
        if (!this.neuroGroup) {
          body.append(el('div', { class: 'bs-choices grid' }, ...Object.entries(NEURO_GROUPS).map(([id, g]) =>
            el('button', { class: 'bs-choice', onclick: () => { this.neuroGroup = id; this.renderToolPanel(); } }, g.label))));
        } else {
          const g = NEURO_GROUPS[this.neuroGroup];
          body.append(el('button', { class: 'btn ghost sm', onclick: () => { this.neuroGroup = null; this.renderToolPanel(); } }, `← ${g.label}`));
          for (const rid of g.regions) {
            const region = BODY_REGIONS.find((r) => r.id === rid);
            if (!region) continue;
            body.append(el('div', { class: 'bs-sub' }, region.label),
              el('div', { class: 'bs-choices' }, ...region.tests.map((t) => el('button', {
                class: 'bs-choice' + (this.actions?.has(`neuro.${t.id}`) ? ' done' : ''), title: t.hint || '',
                onclick: (e) => { this.neuroTest(region, t); e.currentTarget.classList.add('done'); } }, t.label))));
          }
        }
        break;
      }
      case 'measure':
        n.append(head('Measure', 'Take your own observations, or attach the monitor.'), body);
        body.append(el('div', { class: 'bs-choices' },
          el('button', { class: 'bs-choice' + (this.actions.has('measure.obs') ? ' done' : ''), onclick: () => { this.measure(); this.renderToolPanel(); } },
            'Full set of observations: HR, BP, RR, SpO₂, temperature'),
          el('button', { class: 'bs-choice', onclick: () => this.toggleMonitor() },
            this.monitorOn ? 'Detach the monitor' : 'Attach the monitor (shows the live vitals strip)')));
        break;
      case 'commit': this.renderCommit(n, head, body); break;
      default: break;
    }
  }

  renderCommit(n, head, body) {
    const p = this.persona;
    n.append(head(p.diagnosis ? 'What is going on?' : 'Finish',
      p.diagnosis ? 'Commit to the most likely diagnosis, then say how sure you are.' : 'See how complete your examination was.'), body);
    if (!p.diagnosis) {
      body.append(el('button', { class: 'btn primary', onclick: () => this.finish(null, null) }, 'Show my coverage'));
      return;
    }
    const conf = el('div', { class: 'conf', hidden: true },
      el('span', { class: 'conf-q' }, 'How sure are you?'),
      el('div', { class: 'conf-row' }, ...CONFIDENCE.map((k) => el('button', { class: `conf-b conf-${k.id}`, onclick: () => this.finish(this.pick, k.id) }, k.label))));
    const order = p.diagnosis.options.map((o, i) => ({ o, i }));
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const opts = order.map(({ o, i }, k) => el('button', { class: 'opt', onclick: (e) => {
      this.pick = i;
      for (const b of opts) b.classList.toggle('picked', b === e.currentTarget);
      if (learning.store.settings.askConfidence) conf.hidden = false; else this.finish(i, null);
    } }, el('span', { class: 'opt-k' }, String.fromCharCode(65 + k)), el('span', { class: 'opt-l' }, o)));
    body.append(el('div', { class: 'opts' }, ...opts), conf,
      el('div', { class: 'btn-row' }, el('button', { class: 'btn ghost sm', onclick: () => this.setTool('talk') }, '← Keep examining')));
  }

  renderDebrief() {
    const p = this.persona; const r = this.finished; const d = p.diagnosis;
    const done = r.kf.filter((k) => k.done).length;
    const inReview = learning.session.ctx?.kind === 'review' && learning.session.isCurrent(`bedside/case/${p.id}`);
    const card = el('section', { class: `card result ${!d || r.correct ? 'ok' : 'no'} bs-debrief` },
      el('div', { class: 'card-b' },
        el('div', { class: 'rat-h' },
          el('span', { class: 'rat-badge' }, !d ? 'Coverage' : r.correct ? 'Correct' : 'Not quite'),
          d && el('span', { class: 'rat-dx' }, d.options[d.answer])),
        d && !r.correct && el('p', { class: 'tq-yours' }, el('span', {}, 'You chose: '), d.options[r.choice]),
        d && r.conf === 'sure' && !r.correct && el('p', { class: 'rat-calib danger' }, el('strong', {}, 'Certain, and wrong. '), 'This case will come back in your review queue tomorrow.'),
        el('div', { class: 'eyebrow', style: { marginTop: '10px' } }, `Key findings · ${done} of ${r.kf.length}`),
        el('ul', { class: 'act-list' }, ...r.kf.map((k) => el('li', { class: 'act' + (k.done ? ' done' : '') },
          el('span', { class: 'act-check' }, k.done ? '✓' : ''),
          el('span', { class: 'act-body' }, el('span', { class: 'act-t' }, k.label), !k.done && el('span', { class: 'act-k' }, 'Missed'))))),
        d && el('p', { class: 'rat-teach', style: { marginTop: '10px' } }, d.teaching),
        el('p', { class: 'fine' }, `${this.log.filter((x) => x.who === 'doc').length} things said · ${this.log.filter((x) => x.who === 'find').length} findings · about ${r.minutes} min`),
        el('div', { class: 'btn-row' },
          inReview && el('button', { class: 'btn primary', onclick: () => {
            const nxt = learning.session.advance(); if (nxt) learning.open(nxt); else learning.home('review');
          } }, 'Next in review →'),
          el('button', { class: inReview ? 'btn' : 'btn primary', onclick: () => this.start(p) }, 'Examine again'),
          el('button', { class: 'btn', onclick: () => this.leave() }, 'Another patient'))));
    this.node.append(card);
    requestAnimationFrame(() => card.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }

  renderSteth(finding) {
    const n = this.stethNode; if (!n) return;
    n.hidden = false; clear(n);
    this.pcg = el('canvas', { class: 'bs-pcg' });
    this.steth.onBuffer = (d) => this.drawPcg(d);
    this.stethBtn = el('button', { class: 'btn sm', onclick: () => this.toggleSound() });
    this.renderStethButton();
    n.append(
      el('div', { class: 'bs-steth-h' }, el('span', { class: 'eyebrow' }, 'Phonocardiogram · what you are hearing'), this.stethBtn),
      this.pcg,
      el('p', { class: 'bs-steth-t' }, finding.text));
    // Draw one silent beat so the trace is visible even with sound off.
    requestAnimationFrame(() => guard('bedside.pcg', () => this.drawPcg(this.makeBuffer(8000, 7))));
  }

  renderStethButton() {
    if (!this.stethBtn) return;
    this.stethBtn.className = 'btn sm' + (this.soundOn ? ' primary' : '');
    this.stethBtn.textContent = this.soundOn ? '🔊 Sound on' : '🔈 Play sound';
  }

  renderLog() {
    const n = this.logNode; if (!n || !this.log) return;
    clear(n);
    for (const e of this.log) {
      if (e.who === 'sys') n.append(el('div', { class: 'lg-sys' }, e.text));
      else if (e.who === 'doc') n.append(el('div', { class: 'lg-doc' }, el('span', {}, e.text)));
      else if (e.who === 'pt') n.append(el('div', { class: 'lg-pt' }, el('span', {}, e.text)));
      else if (e.who === 'act') n.append(el('div', { class: 'lg-act' }, e.text));
      else if (e.who === 'find') {
        const x = e.finding;
        const why = el('div', { class: 'lg-why', hidden: true },
          el('span', { class: `lg-kind ${x.kind || 'model'}` }, x.kind === 'heuristic' ? 'Bedside rule of thumb' : x.kind === 'case' ? 'From the case' : 'From the model'),
          ' ', x.basis || '');
        n.append(el('div', { class: 'lg-find' + (x.abnormal ? ' abn' : '') },
          el('span', { class: 'lg-dot' }),
          el('span', { class: 'lg-t' }, x.text),
          x.basis && el('button', { class: 'lg-whyb', onclick: () => { why.hidden = !why.hidden; } }, 'why?'),
          why));
      }
    }
    n.scrollTop = n.scrollHeight;
  }

  tickFigure() {
    if (!this.fig || !this.persona) return;
    const hsTool = ['look', 'feel', 'listen', 'instruct'].includes(this.tool) ? this.tool : 'none';
    updateFigure(this.fig, this.ctx(), { tool: hsTool, persona: this.persona });
  }
}

export function createBedsideWorkspace({ shell, runtime }) {
  const view = new BedsideView({ shell, runtime });
  return { id: 'encounter', label: 'Bedside', node: view.node, view };
}
