import { delineate, type Fiducials, type Machine } from '../measurements/ecg-measure.ts';
import type { LeadName } from '../measurements/ecg.ts';
import { paperGeometry, type PaperGeometry } from '../render/ecg-paper.ts';
import type { Lang } from './diagrams.ts';

/* ---------------------------------------------------------------------------
   Measuring an ECG by hand, on the printed paper: calipers and a ruler laid
   over the tracing, and the steps a clinician goes through (rate, rhythm,
   PR, QRS, QT and QTc, axis), each with how to do it by counting squares.

   The paper is 25 mm/s and 10 mm/mV: a small square (1 mm) is 40 ms and
   0.1 mV, a big square (5 mm) 200 ms. The calipers say how many small and
   big squares they span and what that is in milliseconds, and in the rate
   step what rate that R–R means (300 ÷ big squares, 1500 ÷ small squares).
   Big squares between the calipers are shaded and numbered, which is the
   counting made visible.

   Each step can show where the calipers go: on the tracing itself, from the
   complexes found on it and the model's own intervals (ecg-measure.ts), and
   then what the machine measured. The learner's own measurement is kept
   (an R–R for the QTc, the QT), so the QTc is worked out from their numbers.
--------------------------------------------------------------------------- */

type Step = 'rate' | 'rhythm' | 'pr' | 'qrs' | 'qt' | 'axis';
const STEPS: Step[] = ['rate', 'rhythm', 'pr', 'qrs', 'qt', 'axis'];

export interface MeasureToolOptions {
  wrap: HTMLElement;                 // the .paper-wrap around the paper canvas
  panel: HTMLElement;                // where the steps are shown
  leads: Record<LeadName, ArrayLike<number>>;
  fs: number;
  pxPerMm: number;
  /** Redraw the paper at another scale (px per mm), for looking closely; the tool follows. */
  repaint?: (pxPerMm: number) => void;
  machine: Machine;
  sex: 'F' | 'M';
  lang: Lang;
}

export function mountMeasureTool(o: MeasureToolOptions): () => void {
  const L = (en: string, de: string) => (o.lang === 'de' ? de : en);
  const num = (x: number, d = 0) => { const s = x.toFixed(d); return o.lang === 'de' ? s.replace('.', ',') : s; };
  const n = o.leads.II.length;
  const fitMm = o.pxPerMm;
  let G: PaperGeometry = paperGeometry(n, o.fs, fitMm);
  const F: Fiducials = delineate(o.leads, o.fs, o.machine);
  let mm = G.mm;
  const msPerMm = 1000 / G.speed;
  const beat = F.beats[Math.max(0, Math.floor(F.beats.length / 2) - 1)];
  const next = F.beats[F.beats.indexOf(beat) + 1];
  /* positions are kept in paper millimetres, so they stay put when the paper is magnified */
  const X = (i: number) => G.rhythmX(i) / mm;
  const rhythmY = () => G.rhythmY / mm;

  const cal = { a: X(beat?.r ?? n / 2), b: X(next?.r ?? n / 2 + o.fs * 0.8), y: rhythmY() - 15, on: true };
  const ruler = { x: 14, y: rhythmY() - 26, on: false };
  let zoom = 1;
  let step: Step = 'rate';
  const kept: { rr?: number; qt?: number } = {};
  const shown = new Set<Step>();
  const guess: { I: number; F: number } = { I: 0, F: 0 };
  let marks = '';             // extra marks a "show me" leaves on the paper
  let anim = 0;

  o.wrap.style.position = 'relative';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'measure-layer');
  svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;touch-action:none';
  o.wrap.appendChild(svg);
  const size = () => { svg.setAttribute('width', String(G.width)); svg.setAttribute('height', String(G.height)); svg.setAttribute('viewBox', `0 0 ${G.width} ${G.height}`); };
  size();
  /* magnify: the paper is redrawn bigger and the view scrolls to the calipers */
  const setZoom = (z: number, centre = true) => {
    if (!o.repaint || z === zoom) return;
    zoom = z; marks = ''; o.repaint(fitMm * z);
    G = paperGeometry(n, o.fs, fitMm * z); mm = G.mm; size();
    o.panel.querySelectorAll('[data-z]').forEach((b) => b.setAttribute('aria-pressed', String(Number((b as HTMLElement).dataset.z) === zoom)));
    draw();
    o.wrap.classList.toggle('zoomed', zoom > 1);
    if (zoom === 1) { o.wrap.scrollLeft = 0; o.wrap.scrollTop = 0; } else if (centre) scrollTo((cal.a + cal.b) / 2);
  };
  /* bring the calipers into view, across and down */
  const scrollTo = (xMm: number) => {
    o.wrap.scrollLeft = Math.max(0, xMm * mm - o.wrap.clientWidth / 2);
    if (zoom > 1) o.wrap.scrollTop = Math.max(0, cal.y * mm - o.wrap.clientHeight * 0.35);
  };

  const span = () => Math.abs(cal.b - cal.a);                            // mm = small squares
  const spanMs = () => span() * msPerMm;

  /* ---- drawing the layer ---- */
  const draw = () => {
    const out: string[] = [];
    if (cal.on) {
      const a = Math.min(cal.a, cal.b) * mm, b = Math.max(cal.a, cal.b) * mm, y = cal.y * mm, big = 5 * mm, ca = cal.a * mm, cb = cal.b * mm;
      /* big squares counted from the first caliper: shaded alternately, numbered */
      for (let k = 0; a + k * big < b - 0.5; k++) {
        const x = a + k * big, w = Math.min(big, b - x), full = w >= big - 0.5;
        out.push(`<rect x="${x}" y="0" width="${w}" height="${G.height}" fill="${k % 2 ? 'rgba(250,200,80,0.16)' : 'rgba(250,200,80,0.26)'}"/>`);
        if (full) out.push(`<text x="${x + big / 2}" y="${y + 20}" font-size="${Math.max(9, Math.min(14, 2.4 * mm))}" text-anchor="middle" fill="#7a5a10" font-weight="700">${k + 1}</text>`);
      }
      out.push(`<line x1="${ca}" y1="0" x2="${ca}" y2="${G.height}" stroke="#1f6f66" stroke-width="1.4"/><line x1="${cb}" y1="0" x2="${cb}" y2="${G.height}" stroke="#1f6f66" stroke-width="1.4"/>`);
      out.push(`<line x1="${a + 4}" y1="${y}" x2="${b - 4}" y2="${y}" stroke="#1f6f66" stroke-width="2"/>`);
      out.push(`<path d="M${a} ${y}l7 -4v8z M${b} ${y}l-7 -4v8z" fill="#1f6f66"/>`);
      const lab = `${num(span(), 1)} ${L('small sq', 'kl. K.')} · ${num(span() / 5, 1)} ${L('big', 'gr.')} · ${Math.round(spanMs())} ms`;
      out.push(`<g transform="translate(${(a + b) / 2} ${y - 16})"><rect x="${-lab.length * 3.4}" y="-11" width="${lab.length * 6.8}" height="15" rx="4" fill="#1f6f66"/><text y="0" font-size="11" text-anchor="middle" fill="#fff" font-family="ui-monospace,monospace">${lab}</text></g>`);
      out.push(`<rect data-h="bar" x="${a + 8}" y="${y - 7}" width="${Math.max(4, b - a - 16)}" height="14" fill="transparent" style="pointer-events:all;cursor:grab"/>`);
      for (const [k, x] of [['a', ca], ['b', cb]] as const) out.push(`<g data-h="${k}" style="pointer-events:all;cursor:ew-resize"><circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="#1f6f66" stroke-width="2"/><path d="M${x - 3} ${y - 4}v8M${x + 3} ${y - 4}v8" stroke="#1f6f66" stroke-width="1.5"/></g>`);
    }
    if (ruler.on) {
      const len = 80, h = 9 * mm, x = ruler.x * mm, y = ruler.y * mm, t: string[] = [];
      for (let k = 0; k <= len; k++) {
        const xx = x + k * mm, tall = k % 10 === 0 ? 0.45 : k % 5 === 0 ? 0.32 : 0.18;
        t.push(`<line x1="${xx}" y1="${y}" x2="${xx}" y2="${y + h * tall}" stroke="#333" stroke-width="${k % 5 ? 0.6 : 1}"/>`);
        if (k % 10 === 0) t.push(`<text x="${xx + 1.5}" y="${y + h * 0.62}" font-size="${Math.max(8, Math.min(14, 2 * mm))}" fill="#333" font-family="ui-monospace,monospace">${k / 10}</text>`);
        if (k % (mm * 5 >= 30 ? 5 : 10) === 0) t.push(`<text x="${xx + 1.5}" y="${y + h - 2}" font-size="${Math.max(7, Math.min(12, 1.6 * mm))}" fill="#1f6f66" font-family="ui-monospace,monospace">${num((k * msPerMm) / 1000, 1)}</text>`);
      }
      out.push(`<g data-h="ruler" style="pointer-events:all;cursor:move"><rect x="${x - 3}" y="${y}" width="${len * mm + 10}" height="${h}" rx="3" fill="rgba(255,255,255,0.9)" stroke="#555"/>${t.join('')}
        <text x="${x + len * mm + 4}" y="${y + h * 0.62}" font-size="9" fill="#333">cm</text><text x="${x + len * mm + 4}" y="${y + h - 2}" font-size="9" fill="#1f6f66">s</text></g>`);
    }
    svg.innerHTML = out.join('') + marks;
    panelUpdate();
  };

  /* ---- dragging: a caliper point, the bar (both points), or the ruler ---- */
  const toLocal = (e: PointerEvent) => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onDown = (e: PointerEvent) => {
    const h = (e.target as Element).closest('[data-h]')?.getAttribute('data-h');
    if (!h) return;
    e.preventDefault(); cancelAnimationFrame(anim);
    const p0 = toLocal(e), c0 = { ...cal }, r0 = { ...ruler };
    const move = (ev: PointerEvent) => {
      const p = toLocal(ev), dx = (p.x - p0.x) / mm, dy = (p.y - p0.y) / mm, H = G.height / mm;
      if (h === 'a') cal.a = clampX(c0.a + dx);
      else if (h === 'b') cal.b = clampX(c0.b + dx);
      else if (h === 'bar') { const d = clampX(c0.a + dx) - c0.a; cal.a = c0.a + d; cal.b = clampX(c0.b + d); cal.y = Math.max(8, Math.min(H - 2, c0.y + dy)); }
      else if (h === 'ruler') { ruler.x = Math.round(r0.x + dx); ruler.y = Math.max(0, Math.min(H - 9, r0.y + dy)); }
      if (step === 'rate' && (h === 'a' || h === 'b' || h === 'bar')) kept.rr = spanMs();
      if (step === 'qt' && (h === 'a' || h === 'b' || h === 'bar')) kept.qt = spanMs();
      draw();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const clampX = (x: number) => Math.max(0.5, Math.min(G.width / mm - 0.5, x));
  svg.addEventListener('pointerdown', onDown);

  /* ---- moving the calipers for "show me", smoothly ---- */
  const glide = (a0: number, b0: number, y0: number, then?: () => void) => {
    cancelAnimationFrame(anim);
    const a = a0 / mm, b = b0 / mm, y = y0 / mm;
    /* bring them into view: magnified, or on a phone where the paper is wider than the screen */
    const left = Math.min(a0, b0), right = Math.max(a0, b0);
    if (zoom > 1 || left < o.wrap.scrollLeft || right > o.wrap.scrollLeft + o.wrap.clientWidth) scrollTo((a + b) / 2);
    const s = { ...cal }, t0 = performance.now(), dur = 450;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const f = (now: number) => {
      const x = reduce ? 1 : Math.min(1, (now - t0) / dur), e = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
      cal.a = s.a + (a - s.a) * e; cal.b = s.b + (b - s.b) * e; cal.y = s.y + (y - s.y) * e; cal.on = true;
      draw();
      if (x < 1) anim = requestAnimationFrame(f); else then?.();
    };
    anim = requestAnimationFrame(f);
  };
  const dot = (x: number, y: number, label = '') => `<circle cx="${x}" cy="${y}" r="4" fill="#d33c32" opacity=".85"/>${label ? `<text x="${x}" y="${y - 7}" font-size="10" text-anchor="middle" fill="#d33c32" font-weight="700">${label}</text>` : ''}`;
  const yAbove = () => G.rhythmY - 15 * mm;

  const showMe = () => {
    shown.add(step);
    marks = '';
    if (!beat) { draw(); return; }
    if (step === 'rate') {
      const onStrip = F.beats.filter((b) => G.rhythmX(b.r) > 10 * mm);
      marks = onStrip.map((b, i) => dot(G.rhythmX(b.r), G.rhythmY - 11 * mm, String(i + 1))).join('');
      glide(G.rhythmX(beat.r), G.rhythmX(next?.r ?? beat.r), yAbove(), () => { kept.rr = spanMs(); draw(); });
    } else if (step === 'rhythm') {
      let k = 0;
      const walk = () => {
        const b0 = F.beats[k], b1 = F.beats[k + 1];
        if (!b0 || !b1 || step !== 'rhythm') return;
        glide(G.rhythmX(b0.r), G.rhythmX(b1.r), yAbove(), () => { k++; setTimeout(walk, 250); });
      };
      walk();
    } else if (step === 'pr') {
      if (beat.pOn != null) glide(G.rhythmX(beat.pOn), G.rhythmX(beat.qrsOn), yAbove());
    } else if (step === 'qrs') glide(G.rhythmX(beat.qrsOn), G.rhythmX(beat.qrsOff), yAbove());
    else if (step === 'qt') glide(G.rhythmX(beat.qrsOn), G.rhythmX(beat.tEnd), yAbove(), () => { kept.qt = spanMs(); draw(); });
    else if (step === 'axis') {
      for (const lead of ['I', 'aVF'] as LeadName[]) {
        const b = F.beats.find((x) => G.gridX(lead, x.qrsOn) != null && G.gridX(lead, x.qrsOff) != null);
        if (!b) continue;
        const x0 = G.gridX(lead, b.qrsOn)! - 4, x1 = G.gridX(lead, b.qrsOff)! + 4, y = G.rowY(lead);
        marks += `<rect x="${x0}" y="${y - 16 * mm}" width="${x1 - x0}" height="${22 * mm}" fill="none" stroke="#d33c32" stroke-width="2" rx="4"/>`;
      }
      cal.on = false; draw();
    }
    draw();
  };

  /* ---- the steps panel ---- */
  const T: Record<Step, { name: string; how: string[] }> = {
    rate: { name: L('Rate', 'Frequenz'), how: [
      L('Put the calipers on two neighbouring R waves.', 'Setzen Sie den Zirkel auf zwei benachbarte R-Zacken.'),
      L('Count the big squares between them: rate = 300 ÷ big squares.', 'Zählen Sie die großen Kästchen dazwischen: Frequenz = 300 ÷ große Kästchen.'),
      L('More precisely, count small squares: rate = 1500 ÷ small squares.', 'Genauer mit kleinen Kästchen: Frequenz = 1500 ÷ kleine Kästchen.'),
      L('Irregular rhythm: count the QRS complexes on the 10-second strip and multiply by 6.', 'Unregelmäßiger Rhythmus: QRS-Komplexe im 10-Sekunden-Streifen zählen, mal 6.')] },
    rhythm: { name: L('Rhythm', 'Rhythmus'), how: [
      L('Set the calipers on one R–R interval.', 'Stellen Sie den Zirkel auf ein R-R-Intervall ein.'),
      L('Drag the bar to walk the calipers along the strip: in a regular rhythm each next R lands on the point.', 'Ziehen Sie am Steg, um den Zirkel den Streifen entlang zu setzen: Bei regelmäßigem Rhythmus trifft jede nächste R-Zacke die Spitze.'),
      L('Is there a P wave before every QRS, and a QRS after every P?', 'Steht vor jedem QRS eine P-Welle und folgt jeder P-Welle ein QRS?')] },
    pr: { name: 'PR', how: [
      L('From the start of the P wave to the start of the QRS complex, in lead II.', 'Vom Beginn der P-Welle bis zum Beginn des QRS-Komplexes, in Ableitung II.'),
      L('Normal: 3–5 small squares, 120–200 ms.', 'Normal: 3–5 kleine Kästchen, 120–200 ms.')] },
    qrs: { name: 'QRS', how: [
      L('From the first deflection of the QRS to its end (the J point).', 'Vom ersten Ausschlag des QRS bis zu seinem Ende (J-Punkt).'),
      L('Normal: under 3 small squares, below 120 ms.', 'Normal: unter 3 kleinen Kästchen, unter 120 ms.')] },
    qt: { name: 'QT · QTc', how: [
      L('From the start of the QRS to the end of the T wave, where it returns to the baseline (lead II or V5).', 'Vom Beginn des QRS bis zum Ende der T-Welle, wo sie die Grundlinie erreicht (Ableitung II oder V5).'),
      L('The QT shortens as the rate rises, so correct it: QTc = QT ÷ √RR (Bazett, RR in seconds).', 'Die QT-Zeit verkürzt sich mit steigender Frequenz, deshalb korrigieren: QTc = QT ÷ √RR (Bazett, RR in Sekunden).'),
      L(`Normal QTc: up to ${o.sex === 'F' ? 460 : 450} ms.`, `Normale QTc: bis ${o.sex === 'F' ? 460 : 450} ms.`)] },
    axis: { name: L('Axis', 'Lagetyp'), how: [
      L('Look at the QRS in lead I and in aVF: mostly above the baseline (positive) or below (negative)?', 'Betrachten Sie den QRS in I und aVF: überwiegend über der Grundlinie (positiv) oder darunter (negativ)?'),
      L('Both positive: normal axis. I positive, aVF negative: left axis deviation (if II is negative too). I negative, aVF positive: right axis deviation. Both negative: extreme axis.', 'Beide positiv: normale Achse. I positiv, aVF negativ: überdrehter Linkstyp (wenn auch II negativ). I negativ, aVF positiv: Rechtstyp. Beide negativ: extreme Achse.')] },
  };
  o.panel.hidden = false;
  o.panel.innerHTML = `<div class="measure-tools"><span class="care-label">${L('Tools', 'Werkzeuge')}</span>
      <button type="button" class="chip" data-t="cal" aria-pressed="true">${L('Calipers', 'Zirkel')}</button>
      <button type="button" class="chip" data-t="ruler" aria-pressed="false">${L('Ruler', 'Lineal')}</button>
      ${o.repaint ? `<span class="care-label">${L('Magnify', 'Lupe')}</span>${[1, 2, 3].map((z) => `<button type="button" class="chip" data-z="${z}" aria-pressed="${z === 1}">${z === 1 ? L('Fit', 'Ganz') : `${z}×`}</button>`).join('')}` : ''}
      <span class="muted small">${L('1 small square = 1 mm = 40 ms · 1 big square = 5 mm = 200 ms', '1 kleines Kästchen = 1 mm = 40 ms · 1 großes = 5 mm = 200 ms')}</span></div>
    <div class="chips measure-steps">${STEPS.map((k, i) => `<button type="button" class="chip" data-step="${k}" aria-pressed="${k === step}">${i + 1}. ${T[k].name}</button>`).join('')}</div>
    <div class="measure-body" data-body></div>`;
  const body = o.panel.querySelector('[data-body]') as HTMLElement;

  const readout = (): string => {
    const sq = span(), ms = spanMs();
    const qtcOf = (qt: number, rr: number) => qt / Math.sqrt(rr / 1000);
    switch (step) {
      case 'rate': return sq > 0.5 ? `${L('Calipers', 'Zirkel')}: ${num(sq, 1)} ${L('small squares', 'kleine Kästchen')} (${num(sq / 5, 1)} ${L('big', 'große')}) = ${Math.round(ms)} ms<br>
        1500 ÷ ${num(sq, 1)} = <b>${Math.round(1500 / sq)} /min</b> · 300 ÷ ${num(sq / 5, 1)} = ${Math.round(300 / (sq / 5))} /min` : '';
      case 'rhythm': {
        if (!shown.has('rhythm') || F.beats.length < 3) return '';
        const rr = F.beats.slice(1).map((b, i) => ((b.r - F.beats[i].r) / o.fs) * 1000);
        const spread = Math.max(...rr) - Math.min(...rr);
        return `${L('R–R intervals', 'R-R-Abstände')}: ${rr.map((x) => Math.round(x)).join(', ')} ms → ${spread < 120 ? L('regular', 'regelmäßig') : L('irregular', 'unregelmäßig')} (${L('spread', 'Streuung')} ${Math.round(spread)} ms)`;
      }
      case 'pr': case 'qrs': return sq > 0.5 ? `${L('Calipers', 'Zirkel')}: ${num(sq, 1)} ${L('small squares', 'kleine Kästchen')} × 40 ms = <b>${Math.round(ms)} ms</b>` : '';
      case 'qt': {
        const qt = kept.qt ?? ms, rr = kept.rr ?? F.rrMs ?? 1000;
        return `QT = ${num(qt / msPerMm, 1)} ${L('small squares', 'kleine Kästchen')} = <b>${Math.round(qt)} ms</b> · RR = ${Math.round(rr)} ms${kept.rr ? '' : ` (${L('measure it in step 1, or the machine’s', 'in Schritt 1 messen, sonst die des Geräts')})`}<br>
          QTc = ${Math.round(qt)} ÷ √${num(rr / 1000, 2)} = <b>${Math.round(qtcOf(qt, rr))} ms</b>`;
      }
      case 'axis': {
        const q = guess.I && guess.F ? (guess.I > 0 && guess.F > 0 ? L('normal axis (0° to +90°)', 'normale Achse (0° bis +90°)') : guess.I > 0 ? L('left axis deviation, if II is negative too (otherwise still normal, 0° to −30°)', 'überdrehter Linkstyp, wenn auch II negativ ist (sonst noch normal, 0° bis −30°)') : guess.F > 0 ? L('right axis deviation (+90° to +180°)', 'Rechtstyp (+90° bis +180°)') : L('extreme axis (−90° to 180°)', 'extreme Achse (−90° bis 180°)')) : '';
        const btn = (lead: 'I' | 'F', v: number, t: string) => `<button type="button" class="chip" data-g="${lead}${v}" aria-pressed="${guess[lead] === v}">${t}</button>`;
        return `<div class="axis-pick"><span>I</span>${btn('I', 1, '+')}${btn('I', -1, '−')}<span>aVF</span>${btn('F', 1, '+')}${btn('F', -1, '−')}</div>${q ? `→ <b>${q}</b>` : ''}`;
      }
    }
  };
  const machineLine = (): string => {
    if (!shown.has(step)) return '';
    const m = o.machine;
    const sign = (x: number) => (x > 0 ? L('positive', 'positiv') : L('negative', 'negativ'));
    switch (step) {
      case 'rate': return `${L('Counted', 'Gezählt')}: ${F.beats.filter((b) => G.rhythmX(b.r) > 10 * mm).length} ${L('complexes in 10 s', 'Komplexe in 10 s')} × 6 = ${F.beats.filter((b) => G.rhythmX(b.r) > 10 * mm).length * 6} /min · ${L('machine', 'Gerät')}: ${m.rate ?? '–'} /min`;
      case 'rhythm': return '';
      case 'pr': return beat?.pOn == null ? L('No P wave conducts to the QRS here: there is no PR interval to measure.', 'Hier leitet keine P-Welle auf den QRS über: es gibt keine PQ-Zeit zu messen.') : `${L('machine', 'Gerät')}: PR ${m.pr ?? '–'} ms`;
      case 'qrs': return `${L('machine', 'Gerät')}: QRS ${m.qrs ?? '–'} ms`;
      case 'qt': return `${L('machine', 'Gerät')}: QTc ${m.qtc ?? '–'} ms`;
      case 'axis': return `${L('On this tracing', 'In dieser Kurve')}: I ${sign(F.netI)}, aVF ${sign(F.netF)} · ${L('machine', 'Gerät')}: ${m.axis ?? '–'}°`;
    }
  };
  function panelUpdate() {
    body.innerHTML = `<ol class="measure-how">${T[step].how.map((x) => `<li>${x}</li>`).join('')}</ol>
      <div class="measure-read">${readout()}</div>
      <div class="focus-tools"><button type="button" class="ghost small" data-show>${L('Show me', 'Zeig es mir')}</button></div>
      ${machineLine() ? `<p class="focus-caption">${machineLine()}</p>` : ''}`;
    body.querySelector<HTMLButtonElement>('[data-show]')!.onclick = showMe;
    body.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((b) => b.onclick = () => { const k = b.dataset.g!; guess[k[0] as 'I' | 'F'] = k.endsWith('-1') ? -1 : 1; panelUpdate(); });
  }
  o.panel.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => b.onclick = () => {
    step = b.dataset.step as Step; marks = '';
    o.panel.querySelectorAll('[data-step]').forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.step === step)));
    if (step !== 'axis') cal.on = true;
    /* intervals are measured close up; rate, rhythm and axis on the whole paper */
    setZoom(step === 'pr' || step === 'qrs' || step === 'qt' ? 3 : 1, true);
    draw();
  });
  o.panel.querySelectorAll<HTMLButtonElement>('[data-z]').forEach((b) => b.onclick = () => setZoom(Number(b.dataset.z)));
  o.panel.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => b.onclick = () => {
    if (b.dataset.t === 'cal') cal.on = !cal.on; else ruler.on = !ruler.on;
    b.setAttribute('aria-pressed', String(b.dataset.t === 'cal' ? cal.on : ruler.on));
    draw();
  });
  kept.rr = spanMs();
  draw();
  return () => { cancelAnimationFrame(anim); svg.remove(); o.panel.innerHTML = ''; o.panel.hidden = true; o.wrap.classList.remove('zoomed'); if (zoom !== 1) o.repaint?.(fitMm); };
}
