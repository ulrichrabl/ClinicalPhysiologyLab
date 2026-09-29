import { LearnerStore } from './store.js';

/* ---------------------------------------------------------------------------
   The learning layer's shared objects.

   registry  every learnable item (case or lesson) that a domain has mounted,
             with a way to open it. Runners register themselves; nothing here
             knows about cardiology or neurology.
   session   the learner's current context — a review queue or a CME module —
             so a case runner can offer "next in review" or "back to module"
             instead of its own "next case".
   store     the durable learner record.
--------------------------------------------------------------------------- */

export const slug = (s) => String(s || '').toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export class Registry {
  constructor() { this.items = new Map(); this.runners = new Map(); }

  registerRunner(domain, kind, runner) { this.runners.set(`${domain}/${kind}`, runner); }
  runner(domain, kind) { return this.runners.get(`${domain}/${kind}`) || null; }

  add(item) { this.items.set(item.id, item); }
  get(id) { return this.items.get(id) || null; }
  all(kind) { return [...this.items.values()].filter((i) => !kind || i.kind === kind); }
}

export class Session {
  constructor() { this.ctx = null; this.listeners = new Set(); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) { try { fn(this.ctx); } catch (e) { console.warn(e); } } }

  startReview(queue, label = 'Review') {
    this.ctx = { kind: 'review', label, queue: [...queue], index: 0, results: [] };
    this.emit();
    return this.current();
  }

  startModuleContext(moduleId, label) {
    this.ctx = { kind: 'module', moduleId, label };
    this.emit();
  }

  current() {
    return this.ctx?.kind === 'review' ? this.ctx.queue[this.ctx.index] || null : null;
  }

  remaining() { return this.ctx?.kind === 'review' ? this.ctx.queue.length - this.ctx.index - 1 : 0; }

  /** Is this item the one the review session is waiting on? */
  isCurrent(itemId) { return this.current() === itemId; }

  note(itemId, correct) {
    if (this.ctx?.kind === 'review' && this.current() === itemId) {
      this.ctx.results[this.ctx.index] = !!correct;
      this.emit();
    }
  }

  advance() {
    if (this.ctx?.kind !== 'review') return null;
    this.ctx.index += 1;
    const next = this.current();
    if (!next) this.ctx = { ...this.ctx, finished: true };
    this.emit();
    return next;
  }

  end() { this.ctx = null; this.emit(); }
}

export const learning = {
  store: new LearnerStore(),
  registry: new Registry(),
  session: new Session(),
  /** Set by the shell: open any registered item in its own domain. */
  open: (itemId) => { console.warn('learning.open not wired', itemId); },
  /** Set by the shell: go to the learning layer (optionally a module). */
  home: () => {},
};

/* ---- engagement clock ------------------------------------------------------
   Time only counts while the page is visible and the learner has interacted
   in the last 90 seconds. That is what makes the time on a certificate an
   honest number rather than "the tab was open". */
export function startEngagementClock(store = learning.store, { tickMs = 15_000, idleMs = 90_000 } = {}) {
  if (typeof window === 'undefined' || typeof setInterval !== 'function') return () => {};
  let lastInput = Date.now();
  const mark = () => { lastInput = Date.now(); };
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(ev, mark, { passive: true });
  }
  const id = setInterval(() => {
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    if (visible && Date.now() - lastInput < idleMs) store.addActiveSeconds(tickMs / 1000);
  }, tickMs);
  return () => clearInterval(id);
}
