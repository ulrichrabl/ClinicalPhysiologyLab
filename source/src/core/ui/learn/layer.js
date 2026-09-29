import { el, clear, toast } from '../kit.js';
import { learning } from '../../learning/index.js';
import { MODULES, moduleById } from '../../learning/modules.js';
import {
  dueItems, newItems, topicMastery, calibration, streak, activityGrid, totals,
  moduleStatus, followUpsDue,
} from '../../learning/analytics.js';
import { DAY } from '../../learning/srs.js';
import { ROLES } from '../../learning/store.js';
import { ModulesView } from './modules.js';
import { printCertificate, downloadCertificate } from './certificate.js';
import { pct, fmtMinutes, fmtDate, fmtShort, DOMAIN_LABEL, greeting, download } from './format.js';

/* ---------------------------------------------------------------------------
   The Learn layer: the front door for a learner who comes back.

   Today    what to do next, and how you are doing
   Modules  structured CME activities with certificates
   Review   spaced retrieval practice across every domain's cases
   Record   profile, transcript, certificates, export
--------------------------------------------------------------------------- */

const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};

function cases() { return learning.registry.all('case'); }

/** An interleaved queue: everything due, topped up with unseen cases from different topics. */
export function buildMix(n = 8, now = Date.now()) {
  const rec = learning.store.state;
  const due = dueItems(rec, cases(), now).map((d) => d.item.id);
  const fresh = newItems(rec, cases());
  const byTopic = new Map();
  for (const it of shuffle(fresh)) {
    const k = `${it.domain}/${it.topicId}`;
    if (!byTopic.has(k)) byTopic.set(k, []);
    byTopic.get(k).push(it.id);
  }
  const pool = [];
  while (pool.length + due.length < n && [...byTopic.values()].some((l) => l.length)) {
    for (const l of shuffle([...byTopic.values()])) if (l.length && pool.length + due.length < n) pool.push(l.shift());
  }
  let queue = [...due.slice(0, n), ...pool].slice(0, n);
  if (queue.length < Math.min(n, 4)) {
    // Everything seen and nothing due: practise the weakest items.
    const weakest = cases().map((it) => ({ id: it.id, c: rec.items[it.id]?.card }))
      .sort((a, b) => (a.c?.interval ?? 0) - (b.c?.interval ?? 0)).map((x) => x.id);
    queue = [...new Set([...queue, ...weakest])].slice(0, n);
  }
  return shuffle(queue);
}

function startSession(queue, label) {
  if (!queue.length) { toast('Nothing to review right now.'); return; }
  learning.session.startReview(queue, label);
  learning.open(queue[0]);
}

/* ======================================================================= */
class TodayView {
  constructor() { this.node = el('div', { class: 'learn-wrap' }); this.render(); }
  resize() {}
  refresh() { this.render(); }

  render() {
    clear(this.node);
    const now = Date.now();
    const store = learning.store;
    const rec = store.state;
    const due = dueItems(rec, cases(), now);
    const tot = totals(rec, now);
    const st = streak(rec, now);
    const inProgress = MODULES.map((m) => ({ m, s: moduleStatus(rec, m) }))
      .filter((x) => x.s.phase !== 'new' && x.s.phase !== 'complete');
    const active = rec.activeModule && inProgress.find((x) => x.m.id === rec.activeModule);
    const follow = followUpsDue(rec, now);
    const name = store.profile.name;

    let cta;
    if (due.length) {
      cta = el('button', { class: 'btn primary lg', onclick: () => startSession(due.map((d) => d.item.id).slice(0, 12), 'Review') },
        `Start review · ${Math.min(12, due.length)} due`);
    } else if (active || inProgress[0]) {
      const x = active || inProgress[0];
      cta = el('button', { class: 'btn primary lg', onclick: () => learning.home('module', x.m.id) }, `Continue: ${x.m.title}`);
    } else {
      cta = el('button', { class: 'btn primary lg', onclick: () => startSession(buildMix(8, now), 'Mixed practice') }, 'Start a mixed practice set');
    }

    const hero = el('section', { class: 'hero' },
      el('div', { class: 'hero-l' },
        el('div', { class: 'eyebrow' }, new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })),
        el('h1', { class: 'hero-h' }, name ? `${greeting()}, ${name.split(' ')[0]}.` : `${greeting()}.`),
        el('p', { class: 'hero-p' }, due.length
          ? `${due.length} case${due.length === 1 ? ' is' : 's are'} due for review${due.some((d) => d.danger) ? ', including answers you were certain of and got wrong' : ''}. `
            + 'Ten minutes of spaced retrieval is worth more than an hour of rereading.'
          : tot.attempts
            ? 'Nothing is due. Continue a module, or try a mixed set: interleaving topics is harder, and it sticks.'
            : 'Start with a CME module, meet a patient at the bedside, or let the simulator throw a mixed set of cases at you. Everything you answer is scheduled for review at the moment you are about to forget it.'),
        el('div', { class: 'btn-row' },
          cta,
          el('button', { class: 'btn', onclick: () => learning.home('modules') }, 'Browse modules'),
          el('button', { class: 'btn', onclick: () => learning.home('bedside') }, 'Meet a patient')),
        !store.persistent && el('p', { class: 'callout warn' }, el('strong', {}, 'Progress is not being saved. '),
          'This browser is refusing local storage (often private browsing or a restricted file:// page). '
          + 'Open the app through one of the serve scripts, or export your record from Record before closing.')),
      el('div', { class: 'hero-r' }, ring(tot.recentAccuracy, tot.recent ? `${tot.recent} answers, last 30 days` : 'No answers yet')));

    const tiles = el('div', { class: 'tiles' },
      tile('Due now', String(due.length), due.some((d) => d.danger) ? 'includes confident errors' : 'across all domains', due.length ? 'rose' : null),
      tile('Streak', `${st}`, st === 1 ? 'day' : 'days'),
      tile('Time, 30 days', fmtMinutes(tot.monthMinutes), 'engaged, not just open'),
      tile('Certificates', String(tot.certificates), `${MODULES.length} modules available`));

    const phaseName = { pre: 'pre-test', activities: 'activities', post: 'post-test', reflect: 'reflection', certificate: 'certificate' };
    const modulesRow = inProgress.length ? el('section', { class: 'card' },
      el('header', { class: 'card-h' }, el('div', {}, el('div', { class: 'card-t' }, 'In progress'))),
      el('div', { class: 'card-b cont-list' }, ...inProgress.map(({ m, s }) => el('button', { class: 'cont', onclick: () => learning.home('module', m.id) },
        el('span', { class: 'cont-t' }, m.title),
        el('span', { class: 'cont-k' }, `${s.done}/${s.total} activities · next: ${phaseName[s.phase] || ''}`),
        el('span', { class: 'bar' }, el('i', { style: { width: `${Math.round(s.progress * 100)}%` } })))))) : null;

    const followRow = follow.length ? el('section', { class: 'card follow' },
      el('div', { class: 'card-b' },
        el('div', { class: 'eyebrow' }, 'Follow-up due'),
        ...follow.map((f) => el('div', { class: 'follow-row' },
          el('span', {}, `30 days ago you finished "${moduleById(f.moduleId)?.title}". Did your commitment happen?`),
          el('button', { class: 'btn sm', onclick: () => learning.home('module', f.moduleId) }, 'Answer →'))))) : null;

    this.node.append(
      hero, tiles, followRow, modulesRow,
      el('div', { class: 'learn-2' }, masteryCard(rec, now), calibrationCard(rec)),
      heatmapCard(rec, now));
  }
}

function tile(k, v, sub, tone) {
  return el('div', { class: 'tile' + (tone ? ` ${tone}` : '') },
    el('span', { class: 'tile-k' }, k), el('span', { class: 'tile-v' }, v), el('span', { class: 'tile-s' }, sub));
}

function ring(value, caption) {
  /* Built from markup rather than createElementNS so it renders in any DOM. */
  const r = 52; const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  const label = value == null ? '—' : `${Math.round(v * 100)}%`;
  const svg = `<svg class="ring" viewBox="0 0 128 128" role="img" aria-label="Accuracy ${label}">`
    + `<circle class="ring-bg" cx="64" cy="64" r="${r}"></circle>`
    + (value == null ? '' : `<circle class="ring-fg" cx="64" cy="64" r="${r}" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 64 64)"></circle>`)
    + `<text class="ring-v" x="64" y="62" text-anchor="middle">${label}</text>`
    + '<text class="ring-k" x="64" y="82" text-anchor="middle">accuracy</text></svg>';
  return el('div', { class: 'ring-wrap' }, el('div', { html: svg }), el('span', { class: 'fine' }, caption));
}

function masteryCard(rec, now) {
  const topics = topicMastery(rec, cases(), now);
  const byDomain = {};
  for (const t of topics) (byDomain[t.domain] ||= []).push(t);
  return el('section', { class: 'card' },
    el('header', { class: 'card-h' }, el('div', {},
      el('div', { class: 'card-t' }, 'Mastery map'),
      el('div', { class: 'card-sub' }, 'How securely each topic is held: recency, spacing and correctness together. Tap a topic to drill it.'))),
    el('div', { class: 'card-b mastery' }, ...Object.entries(byDomain).map(([d, list]) => el('div', { class: 'mst-dom' },
      el('div', { class: 'eyebrow' }, DOMAIN_LABEL[d] || d),
      ...list.map((t) => el('button', { class: 'mst', title: `${t.seen}/${t.n} seen · ${t.secure} secure`, onclick: () => {
        const ids = cases().filter((it) => `${it.domain}/${it.topicId}` === t.key).map((it) => it.id);
        startSession(shuffle(ids), t.topic);
      } },
        el('span', { class: 'mst-t' }, t.topic),
        el('span', { class: 'mst-bar' }, el('i', { style: { width: `${Math.round(t.mastery * 100)}%` }, class: t.mastery > 0.7 ? 'hi' : t.mastery > 0.35 ? 'mid' : 'lo' })),
        el('span', { class: 'mst-n' }, `${t.seen}/${t.n}`)))))));
}

function calibrationCard(rec) {
  const cal = calibration(rec);
  return el('section', { class: 'card' },
    el('header', { class: 'card-h' }, el('div', {},
      el('div', { class: 'card-t' }, 'Calibration'),
      el('div', { class: 'card-sub' }, 'Does your confidence predict being right? The tick marks what a well-calibrated clinician would score.'))),
    el('div', { class: 'card-b' },
      cal.total === 0
        ? el('p', { class: 'fine' }, 'Answer a few cases and state how sure you are. This fills in as you go.')
        : el('div', { class: 'cal' }, ...cal.buckets.map((b) => el('div', { class: 'cal-row' },
          el('span', { class: 'cal-k' }, b.label),
          el('span', { class: 'cal-bar' },
            el('i', { style: { width: `${Math.round((b.rate ?? 0) * 100)}%` } }),
            el('b', { style: { left: `${Math.round(b.expected * 100)}%` }, title: `Expected about ${pct(b.expected)}` })),
          el('span', { class: 'cal-v' }, b.n ? `${pct(b.rate)} · n=${b.n}` : '—')))),
      cal.confidentlyWrong > 0 && el('p', { class: 'callout danger' },
        el('strong', {}, `${cal.confidentlyWrong} confident error${cal.confidentlyWrong === 1 ? '' : 's'}. `),
        'These are the answers most likely to reach a patient unchecked, so they are always first in your review queue.')));
}

function heatmapCard(rec, now) {
  const days = activityGrid(rec, now, 18);
  const max = Math.max(1, ...days.map((d) => d.attempts + d.seconds / 120));
  const lvl = (d) => {
    const v = d.attempts + d.seconds / 120;
    return v <= 0 ? 0 : v < max * 0.25 ? 1 : v < max * 0.5 ? 2 : v < max * 0.75 ? 3 : 4;
  };
  const first = new Date(days[0].t).getDay();
  const cells = [...Array((first + 6) % 7).fill(null), ...days];
  return el('section', { class: 'card' },
    el('header', { class: 'card-h' }, el('div', {},
      el('div', { class: 'card-t' }, 'Activity'),
      el('div', { class: 'card-sub' }, 'Little and often beats a weekend binge. Each square is a day.'))),
    el('div', { class: 'card-b' },
      el('div', { class: 'heat' }, ...cells.map((d) => (d
        ? el('i', { class: `h${lvl(d)}`, title: `${d.key}: ${d.attempts} answers, ${Math.round(d.seconds / 60)} min` })
        : el('i', { class: 'hx' }))))));
}

/* ======================================================================= */
class ReviewView {
  constructor() {
    this.node = el('div', { class: 'learn-wrap' });
    learning.session.on(() => { if (this.node.isConnected) this.render(); });
    this.render();
  }
  resize() {}
  refresh() { this.render(); }

  render() {
    clear(this.node);
    const now = Date.now();
    const rec = learning.store.state;
    const due = dueItems(rec, cases(), now);
    const fresh = newItems(rec, cases());
    const ctx = learning.session.ctx;

    const upcoming = [];
    for (let d = 1; d <= 7; d++) {
      const lo = now + (d - 1) * DAY; const hi = now + d * DAY;
      upcoming.push(cases().filter((it) => { const c = rec.items[it.id]?.card; return c && c.due > lo && c.due <= hi; }).length);
    }
    const maxUp = Math.max(1, ...upcoming);

    const summary = ctx?.kind === 'review' && ctx.finished ? el('section', { class: 'card result ok' },
      el('div', { class: 'card-b result-b' },
        el('div', { class: 'result-score' },
          el('span', { class: 'big' }, `${ctx.results.filter(Boolean).length}/${ctx.queue.length}`),
          el('span', { class: 'fine' }, ctx.label)),
        el('div', {},
          el('p', {}, 'Session complete. Each case has been rescheduled from how you did and how sure you were.'),
          el('div', { class: 'btn-row' }, el('button', { class: 'btn', onclick: () => learning.session.end() }, 'Done'))))) : null;

    this.node.append(
      el('div', { class: 'learn-head' }, el('div', {},
        el('div', { class: 'eyebrow' }, 'Spaced retrieval'),
        el('h1', { class: 'learn-h1' }, 'Review'),
        el('p', { class: 'learn-lede' }, 'Every case you answer comes back just before you would forget it. Certain-and-right '
          + 'answers wait weeks; guesses and errors come back within days. Mixed sets interleave topics on purpose: '
          + 'they feel harder and they transfer better.'))),
      summary,
      el('div', { class: 'review-actions' },
        actionCard('Due now', due.length, due.length ? 'Start review' : 'Nothing due', !due.length,
          () => startSession(due.map((d) => d.item.id).slice(0, 20), 'Review')),
        actionCard('Mixed set', 8, 'Interleave 8 cases', false, () => startSession(buildMix(8, now), 'Mixed practice')),
        actionCard('Not yet seen', fresh.length, fresh.length ? 'Try 5 new' : 'All seen', !fresh.length,
          () => startSession(shuffle(fresh.map((f) => f.id)).slice(0, 5), 'New cases'))),
      el('section', { class: 'card' },
        el('header', { class: 'card-h' }, el('div', {}, el('div', { class: 'card-t' }, 'Next 7 days'))),
        el('div', { class: 'card-b' }, el('div', { class: 'upcoming' }, ...upcoming.map((n, i) => el('div', { class: 'up' },
          el('span', { class: 'up-bar' }, el('i', { style: { height: `${Math.round((n / maxUp) * 100)}%` } })),
          el('span', { class: 'up-n' }, String(n)),
          el('span', { class: 'up-d' }, fmtShort(now + (i + 1) * DAY))))))),
      el('section', { class: 'card' },
        el('header', { class: 'card-h' }, el('div', {}, el('div', { class: 'card-t' }, `Due (${due.length})`))),
        el('div', { class: 'card-b' }, due.length
          ? el('ul', { class: 'due-list' }, ...due.map((d) => {
            const last = rec.items[d.item.id].attempts.at(-1);
            return el('li', { class: d.danger ? 'danger' : '' },
              el('button', { class: 'due-row', onclick: () => startSession([d.item.id], 'Single case') },
                el('span', { class: 'due-t' }, d.item.title),
                el('span', { class: 'due-k' }, `${DOMAIN_LABEL[d.item.domain] || d.item.domain} · ${d.item.topic}`),
                el('span', { class: 'due-s ' + (last.ok ? 'ok' : 'no') }, d.danger ? 'certain · wrong' : last.ok ? 'last: right' : 'last: wrong')));
          }))
          : el('p', { class: 'fine' }, 'Nothing is due. Come back tomorrow, or run a mixed set now.'))));
  }
}

function actionCard(k, n, label, disabled, fn) {
  return el('div', { class: 'act-card' },
    el('span', { class: 'tile-k' }, k),
    el('span', { class: 'tile-v' }, String(n)),
    el('button', { class: 'btn' + (disabled ? '' : ' primary'), disabled, onclick: fn }, label));
}

/* ======================================================================= */
class RecordView {
  constructor() { this.node = el('div', { class: 'learn-wrap' }); this.render(); }
  resize() {}
  refresh() { this.render(); }

  render() {
    clear(this.node);
    const store = learning.store;
    const p = store.profile;
    const rec = store.state;
    const now = Date.now();
    const tot = totals(rec, now);

    const name = el('input', { class: 'inp', type: 'text', value: p.name || '', placeholder: 'For certificates' });
    const role = el('select', { class: 'inp' }, ...ROLES.map((r) => el('option', { value: r.id, selected: r.id === p.role }, r.label)));
    const licence = el('input', { class: 'inp', type: 'text', value: p.licence || '', placeholder: 'Optional' });
    const country = el('input', { class: 'inp', type: 'text', value: p.country || '', placeholder: 'Optional' });
    const save = () => { store.setProfile({ name: name.value.trim(), role: role.value, licence: licence.value.trim(), country: country.value.trim() }); toast('Profile saved'); };

    const conf = el('input', { type: 'checkbox', checked: store.settings.askConfidence, onchange: (e) => store.setSetting('askConfidence', e.target.checked) });

    const certs = [];
    for (const [id, m] of Object.entries(rec.modules)) {
      const mod = moduleById(id);
      if (mod && m.certificate) certs.push({ mod, m, cert: m.certificate });
    }
    certs.sort((a, b) => b.cert.issuedAt - a.cert.issuedAt);
    const totalHours = certs.reduce((s, c) => s + c.cert.hours, 0);

    const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      try { store.importJSON(await f.text()); toast('Learner record imported'); this.render(); }
      catch (err) { toast(err.message || 'Could not import that file'); }
    } });

    const rows = certs.map(({ mod, cert }) => el('tr', {},
      el('td', {}, mod.title),
      el('td', {}, fmtDate(cert.issuedAt)),
      el('td', {}, fmtMinutes(cert.minutes)),
      el('td', {}, `${cert.hours} h`),
      el('td', {}, `${pct(cert.preScore)} → ${pct(cert.postScore)}`),
      el('td', { class: 'mono' }, cert.id),
      el('td', {}, el('div', { class: 'btn-row tight' },
        el('button', { class: 'btn sm', onclick: () => printCertificate(cert, mod) }, 'Print'),
        el('button', { class: 'btn sm ghost', onclick: () => downloadCertificate(cert, mod) }, 'Download')))));

    this.node.append(
      el('div', { class: 'learn-head' }, el('div', {},
        el('div', { class: 'eyebrow' }, 'Your record'),
        el('h1', { class: 'learn-h1' }, 'Record'),
        el('p', { class: 'learn-lede' }, 'Everything stays on this device. The app makes no network requests; nothing is '
          + 'uploaded unless you export it yourself.'))),
      el('div', { class: 'tiles' },
        tile('Certificates', String(certs.length), `${totalHours} h claimed`),
        tile('Cases answered', String(tot.attempts), `${pct(tot.accuracy)} correct overall`),
        tile('Member since', fmtShort(rec.createdAt), store.persistent ? 'saved on this device' : 'not being saved', store.persistent ? null : 'rose')),
      el('section', { class: 'card' },
        el('header', { class: 'card-h' }, el('div', {}, el('div', { class: 'card-t' }, 'Transcript'))),
        el('div', { class: 'card-b' }, certs.length
          ? el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' },
            el('thead', {}, el('tr', {}, ...['Module', 'Completed', 'Time', 'Claimed', 'Pre → post', 'Certificate', ''].map((h) => el('th', {}, h)))),
            el('tbody', {}, ...rows)))
          : el('p', { class: 'fine' }, 'Complete a module to earn your first certificate.'))),
      el('div', { class: 'learn-2' },
        el('section', { class: 'card' },
          el('header', { class: 'card-h' }, el('div', {}, el('div', { class: 'card-t' }, 'Profile'))),
          el('div', { class: 'card-b form' },
            el('label', { class: 'fld' }, el('span', {}, 'Full name'), name),
            el('label', { class: 'fld' }, el('span', {}, 'Role'), role),
            el('div', { class: 'fld-row' },
              el('label', { class: 'fld' }, el('span', {}, 'Registration / licence no.'), licence),
              el('label', { class: 'fld' }, el('span', {}, 'Country'), country)),
            el('div', { class: 'btn-row' }, el('button', { class: 'btn primary', onclick: save }, 'Save profile')))),
        el('section', { class: 'card' },
          el('header', { class: 'card-h' }, el('div', {}, el('div', { class: 'card-t' }, 'Settings & data'))),
          el('div', { class: 'card-b form' },
            el('label', { class: 'toggle' }, conf, el('span', {}, 'Ask how sure I am before revealing an answer'),
              el('span', { class: 'fine' }, 'Recommended. Confidence drives both spacing and the calibration report.')),
            el('div', { class: 'btn-row' },
              el('button', { class: 'btn', onclick: () => {
                if (!download(`cpl-learner-record-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON())) toast('Download blocked by this browser');
              } }, 'Export record (JSON)'),
              el('button', { class: 'btn', onclick: () => file.click() }, 'Import record…'), file),
            el('p', { class: 'fine' }, 'Export regularly: a record saved in the browser disappears if site data is cleared. '
              + 'Importing replaces the record on this device.'),
            el('div', { class: 'btn-row' },
              el('button', { class: 'btn ghost danger', onclick: (e) => {
                /* Two taps rather than confirm(): embedded and sandboxed pages
                   often suppress native dialogs. */
                const b = e.currentTarget;
                if (!b.dataset.armed) {
                  b.dataset.armed = '1';
                  b.textContent = 'Tap again to erase all progress (profile is kept)';
                  setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Reset learning data'; } }, 5000);
                  return;
                }
                store.reset(); toast('Learning record reset'); this.render();
              } }, 'Reset learning data'))))));
  }
}

/* ======================================================================= */
export function createLearnLayer() {
  const today = new TodayView();
  const modules = new ModulesView();
  const review = new ReviewView();
  const record = new RecordView();
  learning.store.on(() => {
    for (const v of [today, review, record]) if (v.node.isConnected) v.render();
  });
  return {
    id: 'learn',
    name: 'Learn',
    tagline: 'Modules, spaced review and your CME record',
    transport: false,
    layer: true,
    workspaces: [
      { id: 'today', label: 'Today', node: today.node, view: today },
      { id: 'modules', label: 'Modules', node: modules.node, view: modules },
      { id: 'review', label: 'Review', node: review.node, view: review },
      { id: 'record', label: 'Record', node: record.node, view: record },
    ],
    views: { today, modules, review, record },
  };
}
