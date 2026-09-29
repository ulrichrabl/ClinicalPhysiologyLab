import { el } from '../kit.js';
import { ROLES } from '../../learning/store.js';
import { fmtDate, fmtMinutes, pct, escapeHtml, download } from './format.js';

/* ---------------------------------------------------------------------------
   Certificate of completion.

   One definition, rendered two ways: as DOM for the on-screen preview and for
   printing, and as a standalone HTML file the learner can keep or submit to
   their licensing body. Accreditation text appears only when a module
   actually carries accreditation; otherwise the certificate says plainly that
   it records participation in self-directed learning.
--------------------------------------------------------------------------- */

function lines(cert, mod) {
  const role = ROLES.find((r) => r.id === cert.role)?.label || '';
  const acc = mod.accreditation;
  return {
    name: cert.name || 'Name not recorded',
    role,
    licence: cert.licence ? `Registration no. ${cert.licence}` : '',
    title: mod.title,
    date: fmtDate(cert.issuedAt),
    time: fmtMinutes(cert.minutes),
    credit: acc
      ? `${cert.hours} ${acc.creditType || 'credit hours'} (maximum ${acc.credits ?? cert.maxHours})`
      : `${cert.hours} h of ${cert.maxHours} h designated learning time`,
    scores: `Pre-test ${pct(cert.preScore)} → post-test ${pct(cert.postScore)}`,
    statement: acc
      ? `This activity has been accredited by ${acc.provider}${acc.activityId ? ` (activity ${acc.activityId})` : ''}.`
      : 'Certificate of participation in a self-directed learning activity. This activity is not accredited for CME/CPD credit. Whether it can be logged as self-directed learning depends on your licensing body\'s rules.',
    objectives: mod.objectives,
    id: cert.id,
  };
}

export function certificateNode(cert, mod) {
  const L = lines(cert, mod);
  return el('div', { class: 'cert' },
    el('div', { class: 'cert-rule' }),
    el('div', { class: 'cert-brand' }, el('span', { class: 'brand-mark' }), 'Clinical Physiology Lab'),
    el('div', { class: 'cert-kicker' }, 'Certificate of completion'),
    el('div', { class: 'cert-name' }, L.name),
    L.role && el('div', { class: 'cert-role' }, [L.role, L.licence].filter(Boolean).join(' · ')),
    el('div', { class: 'cert-has' }, 'has completed the learning activity'),
    el('div', { class: 'cert-title' }, L.title),
    el('div', { class: 'cert-grid' },
      el('div', {}, el('span', {}, 'Completed'), el('b', {}, L.date)),
      el('div', {}, el('span', {}, 'Engaged time'), el('b', {}, L.time)),
      el('div', {}, el('span', {}, 'Credit claimed'), el('b', {}, L.credit)),
      el('div', {}, el('span', {}, 'Assessment'), el('b', {}, L.scores))),
    el('div', { class: 'cert-obj' },
      el('span', {}, 'Learning objectives'),
      el('ol', {}, ...L.objectives.map((o) => el('li', {}, o)))),
    el('p', { class: 'cert-statement' }, L.statement),
    el('div', { class: 'cert-id' }, `Certificate ${L.id}`));
}

export function certificateHTML(cert, mod) {
  const L = lines(cert, mod);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(L.title)} — certificate ${escapeHtml(L.id)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font-family: "IBM Plex Sans", -apple-system, "Segoe UI", Roboto, sans-serif; color: #1E1A19; background: #EFE7E1; margin: 0; padding: 24px; }
  .c { max-width: 960px; margin: 0 auto; background: #FBF7F4; border: 1px solid rgba(60,40,40,.18); border-radius: 14px; padding: 48px 56px; position: relative; overflow: hidden; }
  .c::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 6px; background: linear-gradient(90deg, #D2384F, #B26A00, #0E7C6B, #1D4ED8); }
  .b { font-weight: 600; font-size: 13px; letter-spacing: .02em; color: #4E4644; }
  .k { margin-top: 28px; font: 600 12px ui-monospace, Menlo, monospace; letter-spacing: .16em; text-transform: uppercase; color: #D2384F; }
  .n { font-size: 38px; font-weight: 600; letter-spacing: -.02em; margin-top: 10px; }
  .r { color: #857A77; font-size: 14px; margin-top: 4px; }
  .h { margin-top: 18px; color: #4E4644; }
  .t { font-size: 24px; font-weight: 600; margin-top: 6px; }
  .g { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 28px; border-top: 1px solid rgba(60,40,40,.14); padding-top: 18px; }
  .g span, .o span { display: block; font: 11px ui-monospace, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; color: #857A77; }
  .g b { display: block; margin-top: 4px; font-size: 14px; }
  .o { margin-top: 22px; } .o ol { margin: 6px 0 0 18px; font-size: 13px; line-height: 1.55; color: #4E4644; }
  .s { margin-top: 22px; font-size: 12px; color: #4E4644; line-height: 1.5; max-width: 80ch; }
  .i { margin-top: 18px; font: 11px ui-monospace, Menlo, monospace; color: #857A77; }
  @media print { body { background: #fff; padding: 0; } .c { border: none; } }
</style></head><body><div class="c">
<div class="b">Clinical Physiology Lab</div>
<div class="k">Certificate of completion</div>
<div class="n">${escapeHtml(L.name)}</div>
<div class="r">${escapeHtml([L.role, L.licence].filter(Boolean).join(' · '))}</div>
<div class="h">has completed the learning activity</div>
<div class="t">${escapeHtml(L.title)}</div>
<div class="g"><div><span>Completed</span><b>${escapeHtml(L.date)}</b></div><div><span>Engaged time</span><b>${escapeHtml(L.time)}</b></div><div><span>Credit claimed</span><b>${escapeHtml(L.credit)}</b></div><div><span>Assessment</span><b>${escapeHtml(L.scores)}</b></div></div>
<div class="o"><span>Learning objectives</span><ol>${L.objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ol></div>
<p class="s">${escapeHtml(L.statement)}</p>
<div class="i">Certificate ${escapeHtml(L.id)}</div>
</div></body></html>`;
}

export function downloadCertificate(cert, mod) {
  return download(`certificate-${mod.id}-${cert.id}.html`, certificateHTML(cert, mod), 'text/html');
}

/* Print just the certificate: mount it in a print-only host and print. */
export function printCertificate(cert, mod) {
  const host = el('div', { class: 'print-host' }, certificateNode(cert, mod));
  document.body.appendChild(host);
  document.documentElement.classList.add('printing');
  const done = () => {
    document.documentElement.classList.remove('printing');
    host.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  try { window.print(); } catch { done(); }
  setTimeout(() => { if (host.isConnected && !matchMedia?.('print').matches) done(); }, 60_000);
}
