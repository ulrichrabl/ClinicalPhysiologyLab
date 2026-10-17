/* ===========================================================================
   Report a problem: point at something in the app, say what is wrong, and
   get one JSON file with everything needed to see it again.

   The report carries the comment, what was pointed at (its place in the page,
   its text, a trimmed piece of its HTML and the sign, test or card it belongs
   to), pictures of the canvases near it, the app's state (case, language,
   layer, the encounter so far, the physiology model and its current values),
   recent script errors, and the build. `scripts/replay-report.mjs` replays the
   encounter from it in the test harness.

   Where reports go: the file is downloaded, and "Open GitHub issue" opens a
   pre-filled issue that the file is attached to. Sending them to a server
   needs a relay that holds a key; that is a later step (docs/HANDOVER.md).
=========================================================================== */

type Lang = 'en' | 'de';

export const REPORT_SCHEMA = 'vp.report/1';
const REPO = 'https://github.com/ulrichrabl/ClinicalPhysiologyLab';
const MAX_HTML = 4000, MAX_TEXT = 400, MAX_IMAGES = 4, MAX_ERRORS = 20, MAX_ISSUE_BODY = 5500;

export type ReportCategory = 'clinical' | 'physiology' | 'display' | 'text' | 'bug' | 'other';
export const CATEGORIES: Record<ReportCategory, Record<Lang, string>> = {
  clinical: { en: 'Clinical content is wrong', de: 'Klinischer Inhalt falsch' },
  physiology: { en: 'Physiology model behaves wrongly', de: 'Physiologisches Modell verhält sich falsch' },
  display: { en: 'Figure or display looks wrong', de: 'Abbildung oder Darstellung falsch' },
  text: { en: 'Wording or translation', de: 'Formulierung oder Übersetzung' },
  bug: { en: 'Something does not work', de: 'Etwas funktioniert nicht' },
  other: { en: 'Other', de: 'Sonstiges' },
};

/** What was pointed at. */
export interface ReportTarget {
  /** A CSS path from the app root, good enough to find the element again. */
  path: string;
  tag: string;
  text: string;
  html: string;
  rect: { x: number; y: number; width: number; height: number };
  /** data-* attributes on the element and its ancestors, nearest first (the card, tab, layer or suggestion it belongs to). */
  data: Record<string, string>;
  /** The nearest heading or label above it, for a human reading the report. */
  context: string;
}

/** The app's own state, supplied by the app. */
export interface ReportApp {
  screen: string;
  caseId: string;
  caseVersion?: string;
  free: boolean;
  lang: Lang;
  [k: string]: unknown;
}

export interface Report {
  schema: typeof REPORT_SCHEMA;
  id: string;
  createdAt: string;
  comment: string;
  category: ReportCategory;
  reporter: string;
  target: ReportTarget | null;
  app: ReportApp;
  env: { build: unknown; url: string; userAgent: string; viewport: { width: number; height: number; dpr: number }; theme: string };
  errors: Array<{ at: string; message: string }>;
  /** PNG data URLs of the canvases near the target, and the patient figure as SVG when it was pointed at. */
  images: Array<{ what: string; dataUrl?: string; svg?: string }>;
}

const UI: Record<string, Record<Lang, string>> = {
  button: { en: 'Report', de: 'Melden' },
  buttonTitle: { en: 'Report a problem with what you see', de: 'Ein Problem mit dem Gezeigten melden' },
  pick: { en: 'Click what is wrong. Esc cancels.', de: 'Klicken Sie auf das, was falsch ist. Esc bricht ab.' },
  whole: { en: 'The whole page', de: 'Die ganze Seite' },
  title: { en: 'Report a problem', de: 'Problem melden' },
  pointed: { en: 'You pointed at', de: 'Sie haben gezeigt auf' },
  repick: { en: 'Point again', de: 'Neu zeigen' },
  wholeBtn: { en: 'Whole page', de: 'Ganze Seite' },
  kind: { en: 'What kind of problem?', de: 'Welche Art von Problem?' },
  comment: { en: 'What is wrong, and what should it be?', de: 'Was ist falsch, und wie sollte es sein?' },
  reporter: { en: 'Your name (optional)', de: 'Ihr Name (optional)' },
  download: { en: 'Download report', de: 'Bericht herunterladen' },
  issue: { en: 'Open GitHub issue', de: 'GitHub-Issue öffnen' },
  cancel: { en: 'Cancel', de: 'Abbrechen' },
  needComment: { en: 'Please say what is wrong.', de: 'Bitte beschreiben Sie, was falsch ist.' },
  saved: { en: 'Report saved as', de: 'Bericht gespeichert als' },
  attach: { en: 'Attach this file to the issue:', de: 'Diese Datei an das Issue anhängen:' },
  includes: { en: 'The report includes the case, your steps so far, the model’s state and pictures of the views near what you pointed at. It does not include your own notes.',
    de: 'Der Bericht enthält den Fall, Ihre bisherigen Schritte, den Zustand des Modells und Bilder der Ansichten nahe der gezeigten Stelle. Ihre eigenen Notizen sind nicht enthalten.' },
};

/* ---- recent script errors -------------------------------------------------------- */
const errors: Report['errors'] = [];
let errorsHooked = false;
function hookErrors(): void {
  if (errorsHooked || typeof window === 'undefined') return;
  errorsHooked = true;
  const keep = (message: string) => { errors.push({ at: new Date().toISOString(), message: message.slice(0, 500) }); if (errors.length > MAX_ERRORS) errors.shift(); };
  window.addEventListener('error', (e) => keep(`${e.message} (${e.filename?.split('/').pop() ?? ''}:${e.lineno ?? ''})`));
  window.addEventListener('unhandledrejection', (e) => keep(`unhandled rejection: ${String((e.reason as Error)?.message ?? e.reason)}`));
}

/* ---- describing what was pointed at ---------------------------------------------- */
export function cssPath(el: Element, root: Element): string {
  const parts: string[] = [];
  for (let n: Element | null = el; n && n !== root && n !== document.documentElement; n = n.parentElement) {
    if (n.id) { parts.unshift(`#${n.id}`); break; }
    const tag = n.tagName.toLowerCase();
    const sib = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.tagName === n!.tagName) : [];
    parts.unshift(sib.length > 1 ? `${tag}:nth-of-type(${sib.indexOf(n) + 1})` : tag);
  }
  return parts.join(' > ');
}

export function describeTarget(el: Element, root: Element): ReportTarget {
  const data: Record<string, string> = {};
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    for (const a of Array.from(n.attributes)) if (a.name.startsWith('data-') && !(a.name in data)) data[a.name] = a.value.slice(0, 200);
    if (n instanceof HTMLElement && n.id && !('id' in data)) data.id = n.id;
  }
  /* The nearest heading or caption before it, inside the panel, section or dialog that holds it; else the open tab. */
  const LABELS = 'h1, h2, h3, h4, figcaption, [aria-selected="true"], [class*="caption"], [class*="label"], [class*="head"], .eyebrow';
  const scope = el.closest('.panel, section, [role="dialog"]') ?? root;
  const before = Array.from(scope.querySelectorAll(LABELS))
    .filter((h) => !h.contains(el) && !!(h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && (h.textContent ?? '').trim());
  const near = before[before.length - 1] ?? (el.matches(LABELS) ? el : null);
  let context = (near?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!context) context = Array.from(root.querySelectorAll('[role="tab"][aria-selected="true"]')).map((x) => x.textContent?.trim()).filter(Boolean).join(' · ');
  const r = el.getBoundingClientRect();
  return {
    path: cssPath(el, root), tag: el.tagName.toLowerCase(),
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
    html: el.outerHTML.slice(0, MAX_HTML),
    rect: { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) },
    data, context,
  };
}

function picturesNear(el: Element | null, root: Element): Report['images'] {
  const out: Report['images'] = [];
  const scope = el ? (el.closest('.panel') ?? el) : root;
  const canvases = el instanceof HTMLCanvasElement ? [el] : Array.from(scope.querySelectorAll('canvas'));
  for (const c of canvases.slice(0, MAX_IMAGES)) {
    if (!c.width || !c.height) continue;
    try { out.push({ what: cssPath(c, root), dataUrl: c.toDataURL('image/png') }); } catch { /* a tainted canvas cannot be read */ }
  }
  const fig = el?.closest('.figure-panel')?.querySelector('svg#figure');
  if (fig) out.push({ what: 'patient figure', svg: fig.outerHTML });
  return out;
}

/* ---- the report itself ----------------------------------------------------------- */
export function buildReport(input: {
  comment: string; category: ReportCategory; reporter?: string; target: ReportTarget | null; app: ReportApp;
  images?: Report['images']; errors?: Report['errors']; now?: Date;
  env?: Report['env'];
}): Report {
  const now = input.now ?? new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  return {
    schema: REPORT_SCHEMA,
    id: `${stamp}-${input.app.caseId}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now.toISOString(),
    comment: input.comment.trim(), category: input.category, reporter: (input.reporter ?? '').trim(),
    target: input.target, app: input.app,
    env: input.env ?? environment(),
    errors: input.errors ?? [...errors],
    images: input.images ?? [],
  };
}

function environment(): Report['env'] {
  return {
    build: (globalThis as Record<string, unknown>).__VP_BUILD__ ?? null,
    url: location.href, userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1 },
    theme: matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
}

export const reportFileName = (r: Report) => `report-${r.id}.json`;

/** The learner's steps, one per line: what replaying needs, readable in an issue. */
export function stepsOf(app: ReportApp): string[] {
  const events = (app.events as Array<Record<string, any>> | undefined) ?? [];
  const mm = (t: number) => `${Math.round(t / 60000)} min`;
  return events.flatMap((e) => {
    if (e.kind === 'utterance' && e.from === 'learner') return [`${mm(e.t)}  ask: ${e.text}`];
    if (e.kind === 'action') return [`${mm(e.t)}  ${e.outcome === 'blocked' ? 'blocked' : 'test'}: ${e.manoeuvre}${e.side ? ` (${e.side})` : ''}${e.reason ? ` [${e.reason}]` : ''}`];
    if (e.kind === 'order') return [`${mm(e.t)}  order: ${e.test}`];
    if (e.kind === 'commit') return [`${mm(e.t)}  commit: ${e.differential.map((d: any) => d.diagnosis).join(', ')}`];
    return [];
  });
}

const buildLine = (b: unknown): string => {
  const x = b as { commit?: string | null; builtAt?: string } | null;
  return x?.commit ? `[${x.commit.slice(0, 7)}](${REPO}/commit/${x.commit}), built ${x.builtAt ?? '?'}` : 'unknown (a local build)';
};

/** A pre-filled GitHub issue: the comment, where it was, the steps, and a note to attach the file. */
export function issueUrl(r: Report): string {
  const cat = CATEGORIES[r.category].en;
  const title = `[report] ${cat}: ${r.comment.split('\n')[0].slice(0, 70)}`;
  const tgt = r.target ? `\`${r.target.path}\`${r.target.context ? ` in “${r.target.context}”` : ''}\n> ${r.target.text.slice(0, 200) || '(no text)'}` : 'The whole page';
  const head = [
    r.comment, '', `**Kind:** ${cat}`, `**Pointed at:** ${tgt}`, '',
    `**Case:** ${r.app.caseId}${r.app.caseVersion ? ` v${r.app.caseVersion}` : ''} · **screen:** ${r.app.screen} · **layer:** ${String(r.app.layer ?? '')} · **language:** ${r.app.lang} · **time:** ${String(r.app.simMinutes ?? 0)} min`,
    `**Build:** ${buildLine(r.env.build)} · ${r.env.viewport.width}×${r.env.viewport.height}`,
    r.reporter ? `**Reported by:** ${r.reporter}` : '', '',
    `**Please attach \`${reportFileName(r)}\`** (downloaded just now): it has the full state for replaying.`, '',
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  let steps = stepsOf(r.app);
  const body = () => `${head}\n<details><summary>Steps (${steps.length})</summary>\n\n\`\`\`\n${steps.join('\n')}\n\`\`\`\n</details>\n\nReport ${r.id}`;
  while (steps.length > 1 && encodeURIComponent(body()).length > MAX_ISSUE_BODY * 1.5) steps = ['…', ...steps.slice(Math.ceil(steps.length / 4) + 1)];
  return `${REPO}/issues/new?labels=report&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body())}`;
}

function download(r: Report): void {
  const blob = new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = reportFileName(r);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/* ---- the interface: a button, pointing, and a short form ------------------------ */
export function installReport(opts: { root: HTMLElement; lang: () => Lang; app: () => ReportApp }): void {
  hookErrors();
  const { root } = opts;
  const t = (k: string) => UI[k][opts.lang()];
  const ui = document.createElement('div');
  ui.className = 'report-ui';
  ui.innerHTML = `
    <button type="button" class="report-btn" id="report-btn"></button>
    <div class="report-hint" id="report-hint" hidden></div>
    <div class="report-box" id="report-box" hidden></div>
    <div class="report-outline" id="report-outline" hidden></div>
    <div class="report-done" id="report-done" role="status" hidden></div>`;
  document.body.appendChild(ui);
  const q = <T extends HTMLElement>(id: string) => ui.querySelector(`#${id}`) as T;
  const btn = q<HTMLButtonElement>('report-btn'), hint = q('report-hint'), box = q('report-box'), outline = q('report-outline'), done = q('report-done');
  const label = () => { btn.textContent = t('button'); btn.title = t('buttonTitle'); btn.setAttribute('aria-label', t('buttonTitle')); };
  label();
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  let picking = false, picked: Element | null = null, target: ReportTarget | null = null, images: Report['images'] = [], app: ReportApp | null = null;
  let comment = '', category: ReportCategory = 'clinical';
  let reporter = ''; try { reporter = localStorage.getItem('vp.reporter') ?? ''; } catch { /* storage may be blocked */ }

  const ours = (el: Element | null) => !!el && ui.contains(el);
  const outlineOn = (el: Element | null) => {
    if (!el) { outline.hidden = true; return; }
    const r = el.getBoundingClientRect();
    Object.assign(outline.style, { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
    outline.hidden = false;
  };
  const under = (e: MouseEvent | PointerEvent) => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && !ours(el) && root.contains(el) ? el : null; };
  const onMove = (e: PointerEvent) => { if (picking) outlineOn(under(e)); };
  const swallow = (e: Event) => { if (picking && !ours(e.target as Element)) { e.preventDefault(); e.stopPropagation(); } };
  const onClick = (e: MouseEvent) => {
    if (!picking || ours(e.target as Element)) return;
    e.preventDefault(); e.stopPropagation();
    choose(under(e));
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (picking) stopPicking(); else if (!box.hidden) close(); } };
  const startPicking = () => {
    picking = true; box.hidden = true; done.hidden = true;
    hint.textContent = t('pick'); hint.hidden = false; document.body.classList.add('report-picking');
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerdown', swallow, true);
    window.addEventListener('mousedown', swallow, true);
    window.addEventListener('click', onClick, true);
  };
  const stopPicking = () => {
    picking = false; hint.hidden = true; outline.hidden = true; document.body.classList.remove('report-picking');
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerdown', swallow, true);
    window.removeEventListener('mousedown', swallow, true);
    window.removeEventListener('click', onClick, true);
  };
  /* The state is taken at the moment of pointing, so a running trace or a moving eye is caught as it was. */
  const choose = (el: Element | null) => {
    stopPicking();
    picked = el; target = el ? describeTarget(el, root) : null; images = picturesNear(el, root); app = opts.app();
    outlineOn(el);
    renderBox();
  };
  const close = () => { box.hidden = true; outline.hidden = true; picked = null; };
  window.addEventListener('keydown', onKey);
  window.addEventListener('scroll', () => { if (!box.hidden && picked) outlineOn(picked); }, { passive: true });
  btn.onclick = () => (picking ? stopPicking() : startPicking());

  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const renderBox = () => {
    const lang = opts.lang();
    const where = target ? `${target.context ? `${esc(target.context)} · ` : ''}<span class="report-quote">${esc(target.text.slice(0, 120) || (target.tag === 'canvas' ? 'a picture' : '—'))}</span>` : esc(t('whole'));
    box.innerHTML = `
      <div class="report-head"><b>${t('title')}</b><button type="button" class="report-x" id="report-cancel-x" aria-label="${t('cancel')}">×</button></div>
      <div class="report-where"><span class="report-k">${t('pointed')}</span> ${where}
        <span class="report-actions"><button type="button" class="ghost small" id="report-repick">${t('repick')}</button>${target ? `<button type="button" class="ghost small" id="report-whole">${t('wholeBtn')}</button>` : ''}</span></div>
      <label class="report-k" for="report-kind">${t('kind')}</label>
      <select id="report-kind">${(Object.keys(CATEGORIES) as ReportCategory[]).map((c) => `<option value="${c}"${c === category ? ' selected' : ''}>${esc(CATEGORIES[c][lang])}</option>`).join('')}</select>
      <label class="report-k" for="report-comment">${t('comment')}</label>
      <textarea id="report-comment" rows="4">${esc(comment)}</textarea>
      <label class="report-k" for="report-reporter">${t('reporter')}</label>
      <input id="report-reporter" value="${esc(reporter)}" autocomplete="name">
      <p class="report-note">${t('includes')}</p>
      <p class="report-err" id="report-err" hidden></p>
      <div class="report-buttons"><button type="button" class="ghost" id="report-cancel">${t('cancel')}</button>
        <button type="button" class="ghost" id="report-download">${t('download')}</button>
        <button type="button" class="primary" id="report-issue">${t('issue')}</button></div>`;
    box.hidden = false;
    const ta = q<HTMLTextAreaElement>('report-comment');
    ta.oninput = () => { comment = ta.value; };
    q<HTMLSelectElement>('report-kind').onchange = (e) => { category = (e.target as HTMLSelectElement).value as ReportCategory; };
    q<HTMLInputElement>('report-reporter').oninput = (e) => { reporter = (e.target as HTMLInputElement).value; try { localStorage.setItem('vp.reporter', reporter); } catch { /* ignore */ } };
    q('report-repick').onclick = startPicking;
    const whole = ui.querySelector<HTMLButtonElement>('#report-whole'); if (whole) whole.onclick = () => choose(null);
    q('report-cancel').onclick = close; q('report-cancel-x').onclick = close;
    const make = (): Report | null => {
      if (!comment.trim()) { const e = q('report-err'); e.textContent = t('needComment'); e.hidden = false; ta.focus(); return null; }
      return buildReport({ comment, category, reporter, target, app: app!, images });
    };
    const finish = (r: Report, issue: boolean) => {
      /* The issue first: opening a window needs the click, which a download may use up. */
      if (issue) window.open(issueUrl(r), '_blank', 'noopener');
      download(r);
      close(); comment = '';
      done.innerHTML = `${issue ? t('attach') : t('saved')} <code>${esc(reportFileName(r))}</code>`;
      done.hidden = false; setTimeout(() => { done.hidden = true; }, 12000);
    };
    q('report-download').onclick = () => { const r = make(); if (r) finish(r, false); };
    q('report-issue').onclick = () => { const r = make(); if (r) finish(r, true); };
    ta.focus();
  };
}
