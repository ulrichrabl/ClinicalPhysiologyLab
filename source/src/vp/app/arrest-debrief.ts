import { tr, type LocalizedText } from '../model/i18n.ts';
import type { GuidelineDef, GuidelineReport } from '../guidelines/types.ts';
import type { ScenarioEvent } from '../scenario/types.ts';
import type { TraceRow } from '../scenario/run.ts';
import type { Lang } from './diagrams.ts';

/* ---------------------------------------------------------------------------
   The debrief of a practice arrest (ADR-018 step 5): one timeline of what
   the learner did, what the guideline asked and what the patient did, and
   the rules with how each went.

   The grade is adherence, not the outcome: the patient's course is the
   model's (and chance's), so it is shown, not scored.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  title: L('Debrief', 'Nachbesprechung'),
  lede: L('What you did, against the ERC 2025 guideline, on one timeline with what the patient did. The score is how closely you followed the guideline, not whether he survived: his course is the model’s, and partly chance.',
    'Was Sie getan haben, gemessen an der ERC-Leitlinie 2025, auf einer Zeitachse mit dem, was der Patient tat. Bewertet wird, wie genau Sie der Leitlinie gefolgt sind, nicht ob er überlebt hat: sein Verlauf ist der des Modells und zum Teil Zufall.'),
  outcomeRosc: L('A circulation returned at {t}.', 'Ein Kreislauf kehrte bei {t} zurück.'),
  outcomeNone: L('He was still in arrest at the end ({r}).', 'Am Ende war er noch im Stillstand ({r}).'),
  outcomeNoArrest: L('His heart did not stop in this run.', 'Sein Herz ist in diesem Durchgang nicht stehen geblieben.'),
  vf: L('ventricular fibrillation', 'Kammerflimmern'), asystole: L('asystole', 'Asystolie'), pea: L('pulseless electrical activity', 'pulslose elektrische Aktivität'), vt: L('ventricular tachycardia', 'Kammertachykardie'),
  measures: L('Measures', 'Kennzahlen'),
  mFirst: L('First compression', 'Erste Kompression'), mShock: L('First shock', 'Erster Schock'), mFraction: L('Compressing', 'Anteil mit Kompressionen'),
  mRate: L('Rate', 'Frequenz'), mPause: L('Longest pause', 'Längste Pause'), mShocks: L('Shocks', 'Schocks'),
  after: L('after the collapse', 'nach dem Kollaps'), ofTime: L('of the time CPR was needed', 'der Zeit, in der Reanimation nötig war'),
  timeline: L('Timeline', 'Zeitachse'),
  kRhythm: L('Rhythm', 'Rhythmus'), kCpr: L('Compressions (red: pauses over 10 s)', 'Kompressionen (rot: Pausen über 10 s)'), kEvents: L('Shocks ⚡, adrenaline A, amiodarone Am, rhythm checks R', 'Schocks ⚡, Adrenalin A, Amiodaron Am, Rhythmuskontrollen R'),
  kLines: L('Coronary perfusion pressure (red) and end-tidal CO₂ (blue), mmHg', 'Koronarer Perfusionsdruck (rot) und endtidales CO₂ (blau), mmHg'),
  kMissed: L('Numbered: where a rule was missed', 'Nummeriert: wo eine Regel verfehlt wurde'),
  rules: L('The guideline', 'Die Leitlinie'),
  met: L('met', 'erfüllt'), missed: L('missed', 'verfehlt'), na: L('did not apply', 'nicht zutreffend'),
  ours: L('our threshold', 'unsere Schwelle'), oursHint: L('The guideline gives no number here, or we added a tolerance; the note says what it rests on.', 'Die Leitlinie nennt hier keine Zahl, oder wir haben eine Toleranz ergänzt; die Anmerkung sagt, worauf sie beruht.'),
  source: L('Source', 'Quelle'), back: L('Back to the patient', 'Zurück zum Patienten'), again: L('Start again', 'Neu beginnen'),
  draft: L('Draft: what is scored and how it is shown are first attempts, for review.', 'Entwurf: was bewertet wird und wie es gezeigt wird, sind erste Versuche, zur Durchsicht.'),
};
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export interface DebriefRun { trace: TraceRow[]; compressions: Array<{ at: number; by: string }>; events: ScenarioEvent[]; t: number }

/** The first second, after the collapse, from which an organised rhythm with a pulse held to the end (or null). */
function roscAt(rep: GuidelineReport, g: GuidelineDef, trace: TraceRow[]): number | null {
  if (rep.onset == null) return null;
  const pulse = (r: TraceRow) => r.rhythm === 'organised' && r.Psys >= g.definitions.pulseSystolic.value;
  let from: number | null = null;
  for (const r of trace) { if (r.t <= rep.onset) continue; if (pulse(r)) { if (from == null) from = r.t; } else from = null; }
  return from;
}

export function debriefHtml(rep: GuidelineReport, g: GuidelineDef, run: DebriefRun, lang: Lang, opts: { canReturn: boolean }): string {
  const t = (k: string) => tr(T[k], lang);
  const last = run.trace.at(-1);
  const rosc = roscAt(rep, g, run.trace);
  const rhythmName = (r: TraceRow | undefined) => !r ? '' : r.rhythm === 'organised' ? t('pea') : t(r.rhythm in T ? r.rhythm : 'vf');
  const outcome = rep.onset == null ? t('outcomeNoArrest') : rosc != null ? t('outcomeRosc').replace('{t}', fmtClock(rosc)) : t('outcomeNone').replace('{r}', rhythmName(last));
  const m = rep.measures;
  const tile = (label: string, v: string, sub = '') => `<div><dt>${label}</dt><dd>${v}</dd>${sub ? `<div class="muted small">${sub}</div>` : ''}</div>`;
  const missedIds = rep.rules.filter((r) => r.status === 'missed').map((r) => r.id);
  const rows = g.rules.map((rule) => {
    const res = rep.rules.find((r) => r.id === rule.id)!;
    const n = missedIds.indexOf(rule.id) + 1;
    const mark = res.status === 'met' ? '✓' : res.status === 'missed' ? `${n}` : '–';
    const value = res.value != null && rule.unit ? ` · <span class="ar-db-val">${res.value}${rule.unit === '%' ? ' %' : rule.unit === '/min' ? '/min' : ` ${rule.unit}`}</span>` : '';
    const at = res.at.length ? ` · <span class="muted">${res.at.slice(0, 4).map(fmtClock).join(', ')}${res.at.length > 4 ? ' …' : ''}</span>` : '';
    return `<li class="ar-db-rule ${res.status}">
      <span class="ar-db-mark" aria-label="${t(res.status === 'met' ? 'met' : res.status === 'missed' ? 'missed' : 'na')}">${mark}</span>
      <div><b>${esc(tr(rule.title, lang))}</b> <span class="muted small">${t(res.status === 'met' ? 'met' : res.status === 'missed' ? 'missed' : 'na')}</span>${value}${at}
        ${rule.basis === 'placement' ? ` <span class="ar-db-ours" title="${esc(t('oursHint'))}">${t('ours')}</span>` : ''}
        <div class="muted small">${esc(tr(rule.why, lang))}</div>
        <details class="small"><summary class="muted">${esc(rule.section)}</summary>${rule.note ? `<p class="muted">${esc(rule.note)}</p>` : ''}</details></div></li>`;
  }).join('');
  return `<section class="panel ar-debrief" aria-labelledby="ar-db-h">
      <div class="st-row"><div><h2 id="ar-db-h">${t('title')}</h2><p class="muted small">${t('lede')}</p></div>
        <span class="ar-head-buttons">${opts.canReturn ? `<button type="button" class="ghost" data-db-back>${t('back')}</button>` : ''}<button type="button" class="primary" data-db-again>${t('again')}</button></span></div>
      <p class="ar-db-outcome"><b>${outcome}</b></p>
      <h3>${t('measures')}</h3>
      <dl class="ar-nums">
        ${tile(t('mFirst'), m.firstCompression != null ? `${m.firstCompression} s` : '—', t('after'))}
        ${tile(t('mShock'), m.firstShock != null ? fmtClock(m.firstShock) : '—', t('after'))}
        ${tile(t('mFraction'), m.fraction != null ? `${m.fraction} %` : '—', t('ofTime'))}
        ${tile(t('mRate'), m.rate != null ? `${m.rate}/min` : '—')}
        ${tile(t('mPause'), m.longestPause != null ? `${m.longestPause} s` : '—')}
        ${tile(t('mShocks'), String(m.shocks.length))}
      </dl>
      <h3>${t('timeline')}</h3>
      <canvas class="ar-db-timeline" aria-label="${t('timeline')}"></canvas>
      <p class="ar-legend small muted">${t('kRhythm')} · ${t('kCpr')} · ${t('kEvents')} · ${t('kLines')} · ${t('kMissed')}</p>
      <h3>${t('rules')}</h3>
      <ol class="ar-db-rules">${rows}</ol>
      <p class="muted small">${t('source')}: ${esc(g.source.citation)}${g.source.doi ? ` doi:${esc(g.source.doi)}` : ''}</p>
      <p class="muted small">${t('draft')}</p>
    </section>`;
}

/** The timeline: rhythm, compressions and their pauses, shocks, doses and checks, the patient's pressures, the misses. */
export function drawDebrief(c: HTMLCanvasElement, rep: GuidelineReport, g: GuidelineDef, run: DebriefRun, css: (n: string) => string): void {
  const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = 250;
  c.style.height = `${h}px`; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const x2 = c.getContext('2d')!; x2.setTransform(dpr, 0, 0, dpr, 0, 0);
  x2.fillStyle = css('--surface'); x2.fillRect(0, 0, w, h);
  const end = Math.max(1, run.t), pad = 8;
  const X = (s: number) => pad + (s / end) * (w - 2 * pad);
  const muted = css('--muted'), abn = css('--abn'), acc = css('--accent'), grid = css('--grid');
  x2.font = '500 10px "JetBrains Mono", ui-monospace, monospace'; x2.textBaseline = 'middle';
  /* rhythm band */
  const col: Record<string, string> = { vf: '#c0392b', vt: '#d35400', asystole: '#7f8c8d', organised: '#27ae60', pea: '#e1a33b' };
  for (const r of run.trace) {
    const k = r.rhythm === 'organised' && !(r.Psys >= g.definitions.pulseSystolic.value) ? 'pea' : r.rhythm;
    x2.fillStyle = col[k] ?? muted; x2.globalAlpha = 0.75; x2.fillRect(X(r.t - 1), 4, Math.max(1, X(r.t) - X(r.t - 1)) + 0.5, 12);
  }
  x2.globalAlpha = 1;
  /* compressions: covered spans, and the long pauses */
  const on = run.compressions.map((x) => x.at).sort((a, b) => a - b), gap = g.definitions.pauseGap.value;
  x2.fillStyle = acc;
  for (let i = 1; i < on.length; i++) if (on[i] - on[i - 1] <= gap) x2.fillRect(X(on[i - 1]), 22, Math.max(1, X(on[i]) - X(on[i - 1])), 10);
  x2.fillStyle = abn;
  for (const p of rep.pauses) if (p.seconds > 10) x2.fillRect(X(p.from), 22, Math.max(1.5, X(p.to) - X(p.from)), 10);
  /* events */
  const mark = (s: number, label: string, color: string, y: number) => { x2.fillStyle = color; x2.textAlign = 'center'; x2.fillText(label, X(s), y); };
  for (const e of run.events) {
    if (e.kind === 'shock' && e.joules > 0) mark(e.t, '⚡', '#b9770e', 44);
    if (e.kind === 'dose') mark(e.t, e.drug === 'adrenaline' ? 'A' : 'Am', e.drug === 'adrenaline' ? '#c0392b' : '#8e44ad', 58);
    if (e.kind === 'assessed') mark(e.t, 'R', muted, 44);
  }
  /* the patient's pressures, 0–40 mmHg */
  const top = 70, bot = h - 46, Y = (v: number) => bot - Math.max(0, Math.min(40, v)) / 40 * (bot - top);
  x2.strokeStyle = grid; x2.lineWidth = 1;
  for (const v of [0, 15, 40]) { x2.setLineDash(v === 15 ? [4, 4] : []); x2.beginPath(); x2.moveTo(pad, Y(v)); x2.lineTo(w - pad, Y(v)); x2.stroke(); }
  x2.setLineDash([]); x2.textAlign = 'left'; x2.fillStyle = muted;
  x2.fillText('40', pad + 2, Y(40) + 6); x2.fillText('15', pad + 2, Y(15) - 6);
  const line = (get: (r: TraceRow) => number | null, color: string) => {
    x2.strokeStyle = color; x2.lineWidth = 1.6; x2.beginPath(); let up = false;
    for (const r of run.trace) { const v = get(r); if (v == null || !Number.isFinite(v)) { up = false; continue; } if (!up) { x2.moveTo(X(r.t), Y(v)); up = true; } else x2.lineTo(X(r.t), Y(v)); }
    x2.stroke();
  };
  line((r) => (r.rhythm === 'organised' && r.Psys >= g.definitions.pulseSystolic.value ? null : r.CPP), '#c0392b');
  line((r) => r.EtCO2, '#3f6fb5');
  /* the misses, numbered as in the list */
  const missed = rep.rules.filter((r) => r.status === 'missed');
  missed.forEach((r, i) => { for (const s of r.at.slice(0, 6)) { x2.fillStyle = abn; x2.beginPath(); x2.arc(X(Math.min(s, end)), h - 30, 7, 0, 2 * Math.PI); x2.fill(); x2.fillStyle = '#fff'; x2.textAlign = 'center'; x2.fillText(String(i + 1), X(Math.min(s, end)), h - 30); } });
  /* time axis */
  x2.fillStyle = muted; x2.textAlign = 'center';
  const step = end > 900 ? 120 : 60;
  for (let s = 0; s <= end; s += step) { x2.textAlign = s === 0 ? 'left' : X(s) > w - 30 ? 'right' : 'center'; x2.fillText(fmtClock(s), X(s), h - 10); }
}
