import { schedule, newCard } from './srs.js';

/* ---------------------------------------------------------------------------
   Learner record.

   Everything a learner has done, kept on their own device. The app makes no
   network requests, so nothing leaves the machine unless the learner exports
   it. The record is versioned so it can be migrated rather than discarded.

   Storage is optional: a browser that refuses localStorage (private mode,
   some file:// setups) still gets a working session, just not a durable one,
   and the UI says so.
--------------------------------------------------------------------------- */

export const STORAGE_KEY = 'cpl.learner.v1';
export const SCHEMA_VERSION = 1;
const MAX_ATTEMPTS_PER_ITEM = 40;

export const ROLES = [
  { id: 'student', label: 'Medical student' },
  { id: 'resident', label: 'Resident / trainee' },
  { id: 'physician', label: 'Practising physician' },
  { id: 'other', label: 'Other health professional' },
];

export function emptyRecord(now = Date.now()) {
  return {
    v: SCHEMA_VERSION,
    createdAt: now,
    profile: { name: '', role: 'resident', licence: '', country: '' },
    settings: { askConfidence: true },
    items: {},        // itemId → { card, attempts: [...] }
    lessons: {},      // lessonId → { completions: [ts], predictions: [{ok, t}] }
    modules: {},      // moduleId → module progress (see startModule)
    activity: {},     // 'YYYY-MM-DD' → { seconds, attempts }
    activeModule: null,
  };
}

export const dayKey = (t) => {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function safeStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__cpl_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch { return null; }
}

/** Validate and upgrade anything that claims to be a learner record. */
export function migrate(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return emptyRecord(now);
  const base = emptyRecord(raw.createdAt || now);
  const rec = {
    ...base,
    ...raw,
    profile: { ...base.profile, ...(raw.profile || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    items: raw.items && typeof raw.items === 'object' ? raw.items : {},
    lessons: raw.lessons && typeof raw.lessons === 'object' ? raw.lessons : {},
    modules: raw.modules && typeof raw.modules === 'object' ? raw.modules : {},
    activity: raw.activity && typeof raw.activity === 'object' ? raw.activity : {},
  };
  rec.v = SCHEMA_VERSION;
  return rec;
}

export class LearnerStore {
  constructor({ storage, now } = {}) {
    this.now = now || (() => Date.now());
    this.storage = storage === undefined ? safeStorage() : storage;
    this.persistent = !!this.storage;
    this.listeners = new Set();
    this.state = this.load();
  }

  /* ---- persistence ------------------------------------------------------ */
  load() {
    if (!this.storage) return emptyRecord(this.now());
    try {
      const txt = this.storage.getItem(STORAGE_KEY);
      return txt ? migrate(JSON.parse(txt), this.now()) : emptyRecord(this.now());
    } catch { return emptyRecord(this.now()); }
  }

  save() {
    if (!this.storage) return;
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state)); }
    catch { this.persistent = false; }
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) {
    this.save();
    for (const fn of this.listeners) { try { fn(ev); } catch (e) { console.warn('learner listener', e); } }
  }

  /* ---- profile & settings ---------------------------------------------- */
  get profile() { return this.state.profile; }
  get settings() { return this.state.settings; }
  setProfile(patch) { Object.assign(this.state.profile, patch); this.emit({ type: 'profile' }); }
  setSetting(k, v) { this.state.settings[k] = v; this.emit({ type: 'settings' }); }

  /* ---- items (cases) ---------------------------------------------------- */
  item(id) { return this.state.items[id] || null; }

  recordAttempt(itemId, { correct, choice, conf = null, ms = null, context = null }) {
    const t = this.now();
    const it = this.state.items[itemId] || (this.state.items[itemId] = { card: newCard(), attempts: [] });
    it.attempts.push({ t, ok: !!correct, choice: choice ?? null, conf, ms, ctx: context });
    if (it.attempts.length > MAX_ATTEMPTS_PER_ITEM) it.attempts.splice(0, it.attempts.length - MAX_ATTEMPTS_PER_ITEM);
    it.card = schedule(it.card, { correct, conf, now: t });
    this.bumpActivity(t, { attempts: 1 });
    this.emit({ type: 'attempt', itemId, correct: !!correct, conf });
    return it;
  }

  /* ---- lessons ----------------------------------------------------------- */
  recordPrediction(lessonId, ok) {
    const l = this.state.lessons[lessonId] || (this.state.lessons[lessonId] = { completions: [], predictions: [] });
    l.predictions.push({ t: this.now(), ok: !!ok });
    if (l.predictions.length > 60) l.predictions.splice(0, l.predictions.length - 60);
    this.bumpActivity(this.now(), { attempts: 1 });
    this.emit({ type: 'prediction', lessonId, ok: !!ok });
  }

  completeLesson(lessonId) {
    const l = this.state.lessons[lessonId] || (this.state.lessons[lessonId] = { completions: [], predictions: [] });
    l.completions.push(this.now());
    this.emit({ type: 'lesson-complete', lessonId });
  }

  /* ---- activity & time -------------------------------------------------- */
  bumpActivity(t, { seconds = 0, attempts = 0 } = {}) {
    const k = dayKey(t);
    const a = this.state.activity[k] || (this.state.activity[k] = { seconds: 0, attempts: 0 });
    a.seconds += seconds;
    a.attempts += attempts;
  }

  /** Called by the shell's engagement clock with seconds of attended use. */
  addActiveSeconds(sec) {
    if (!(sec > 0)) return;
    this.bumpActivity(this.now(), { seconds: sec });
    const m = this.state.activeModule && this.state.modules[this.state.activeModule];
    if (m && !m.completedAt) m.seconds = (m.seconds || 0) + sec;
    this.save(); // no emit: this fires every few seconds and changes nothing visible
  }

  /* ---- CME modules ------------------------------------------------------ */
  module(id) { return this.state.modules[id] || null; }

  startModule(id) {
    const t = this.now();
    let m = this.state.modules[id];
    if (!m || m.completedAt) {
      m = this.state.modules[id] = {
        startedAt: t, seconds: 0, pre: null, posts: [], reflection: null,
        evaluation: null, completedAt: null, certificate: null,
        followUp: null, history: m ? [...(m.history || []), summarise(m)] : [],
      };
    }
    this.state.activeModule = id;
    this.emit({ type: 'module-start', moduleId: id });
    return m;
  }

  setActiveModule(id) { this.state.activeModule = id; this.emit({ type: 'module-active', moduleId: id }); }

  savePreTest(id, result) {
    const m = this.state.modules[id]; if (!m) return;
    m.pre = { ...result, at: this.now() };
    this.emit({ type: 'module-pre', moduleId: id });
  }

  savePostTest(id, result) {
    const m = this.state.modules[id]; if (!m) return;
    m.posts.push({ ...result, at: this.now() });
    this.emit({ type: 'module-post', moduleId: id, passed: result.passed });
  }

  saveReflection(id, reflection) {
    const m = this.state.modules[id]; if (!m) return;
    m.reflection = { ...reflection, at: this.now() };
    this.emit({ type: 'module-reflection', moduleId: id });
  }

  saveEvaluation(id, evaluation) {
    const m = this.state.modules[id]; if (!m) return;
    m.evaluation = { ...evaluation, at: this.now() };
    this.emit({ type: 'module-evaluation', moduleId: id });
  }

  completeModule(id, { title, maxHours }) {
    const m = this.state.modules[id]; if (!m || m.completedAt) return m;
    const t = this.now();
    const post = m.posts[m.posts.length - 1];
    const minutes = Math.round((m.seconds || 0) / 60);
    /* A learner claims only the time they actually spent, capped at what the
       activity is designed to take — the rule most CME systems apply. */
    const hours = Math.min(maxHours, Math.round((minutes / 60) * 4) / 4);
    m.completedAt = t;
    m.certificate = {
      id: certificateId(id, t, this.state.profile.name),
      issuedAt: t, title, minutes, hours, maxHours,
      preScore: m.pre?.score ?? null, postScore: post?.score ?? null,
      name: this.state.profile.name, role: this.state.profile.role,
      licence: this.state.profile.licence,
    };
    if (this.state.activeModule === id) this.state.activeModule = null;
    this.emit({ type: 'module-complete', moduleId: id });
    return m;
  }

  saveFollowUp(id, followUp) {
    const m = this.state.modules[id]; if (!m) return;
    m.followUp = { ...followUp, at: this.now() };
    this.emit({ type: 'module-followup', moduleId: id });
  }

  /* ---- portability ------------------------------------------------------ */
  exportJSON() {
    return JSON.stringify({ app: 'Clinical Physiology Lab', exportedAt: new Date(this.now()).toISOString(), record: this.state }, null, 2);
  }

  importJSON(text) {
    const parsed = JSON.parse(text);
    const rec = parsed && parsed.record ? parsed.record : parsed;
    if (!rec || typeof rec !== 'object' || !('items' in rec || 'modules' in rec)) {
      throw new Error('This file is not a Clinical Physiology Lab learner record.');
    }
    this.state = migrate(rec, this.now());
    this.emit({ type: 'import' });
  }

  reset() {
    const profile = { ...this.state.profile };
    this.state = emptyRecord(this.now());
    this.state.profile = profile;
    this.emit({ type: 'reset' });
  }
}

function summarise(m) {
  return { startedAt: m.startedAt, completedAt: m.completedAt, certificate: m.certificate?.id || null };
}

/** Short, human-checkable certificate id (not a security token). */
export function certificateId(moduleId, t, name) {
  const s = `${moduleId}|${t}|${name || ''}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const hex = (h >>> 0).toString(36).toUpperCase().padStart(7, '0');
  return `CPL-${dayKey(t).replace(/-/g, '')}-${hex}`;
}
