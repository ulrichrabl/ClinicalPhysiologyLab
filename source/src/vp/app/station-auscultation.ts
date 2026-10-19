import { LivePatient, type BeatRecord } from '../live/live-patient.ts';
import { healthyModel, caseWithModel } from '../physiology/state.ts';
import { getPath, setPath } from '../physiology/models.ts';
import type { VariableDef } from '../physiology/types.ts';
import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { FREE_CASE } from './free-case.ts';
import { FORMATTERS } from '../text/formatters.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import { AUSCULTATION_STATION, stationSettings } from '../stations/station.ts';
import { AUSC_PRESETS, AUSC_PRESET_GROUPS, applyAuscPreset } from '../stations/auscultation-presets.ts';
import { cycleAt, cycleSegments, valveEvents, meanMitralGradient, CYCLE_PHASES, type CyclePhase } from '../stations/cardiac-cycle.ts';
import { explainCycle, CYCLE_LABEL } from '../stations/auscultation-texts.ts';
import { cycle as phonoCycle } from '../render/phono.ts';
import { drawPhonoStrip, phonoStripHeight, type StripBeat, type PhonoGeometry } from '../render/phono-strip.ts';
import { drawWiggers, wiggersHeight, type WiggersGeometry } from '../render/wiggers.ts';
import { playCycle } from './sound.ts';
import { auscSigns, auscSignsOf } from '../stations/auscultation-signs.ts';
import { KNOWLEDGE, labelOf } from '../knowledge/index.ts';
import { fmtValue } from './math.ts';
import type { Lang } from './diagrams.ts';
import type { StationHandle } from './station-ecg.ts';
import type { ExamContext } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   The auscultation station (ADR-017 step 4): Explore.

   A healthy adult's circulation runs here on its own. The signal is the
   phonocardiogram the examination model gives at the chosen site, timed
   beat by beat from the circulation's valve events, under the ECG the same
   beats produced and over the breath they fell in. The mechanism is the
   beat at the cursor as a Wiggers diagram: pressures, volume, valve events
   and phases, all the model's own. Playing, the cursor sweeps the most
   recent beat; paused, the learner moves it through the last beats, and can
   listen to the beat under it on its own.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
  preparing: L('Preparing the heart…', 'Das Herz wird vorbereitet…'),
  settings: L('What moves these sounds', 'Was diese Töne verändert'),
  settingsNote: L('Only the model settings that change this test.', 'Nur die Modelleinstellungen, die diesen Test verändern.'),
  startFrom: L('Start from', 'Ausgangspunkt'), choose: L('Choose a heart…', 'Herz wählen…'), healthy: L('Reset to healthy', 'Auf gesund zurücksetzen'),
  listen: L('Where and how you listen', 'Wo und wie Sie hören'), site: L('Site', 'Ort'), position: L('Position', 'Lage'), breathing: L('Breathing', 'Atmung'),
  diaphragm: L('Diaphragm', 'Membran'), bell: L('Bell', 'Glocke'),
  supine: L('Lying', 'Liegend'), leftLat: L('Left side', 'Linksseitenlage'), forward: L('Sitting forward', 'Vorgebeugt sitzend'),
  quiet: L('Quiet breathing', 'Ruhige Atmung'), held: L('Breath held out', 'In Exspiration angehalten'),
  hear: L('What you hear', 'Was Sie hören'), hearNote: L('The phonocardiogram of the last beats, each timed from its own valves, under the ECG they made', 'Das Phonokardiogramm der letzten Schläge, jeder nach seinen eigenen Klappen getimt, unter dem EKG, das sie erzeugt haben'),
  play: L('Play', 'Abspielen'), pause: L('Pause', 'Anhalten'), slow: L('Slow motion', 'Zeitlupe'),
  sound: L('Listen to this beat', 'Diesen Schlag anhören'), stopSound: L('Stop the sound', 'Ton beenden'),
  hint: L('or tap or drag on the sounds or the diagram; ← → move the cursor', 'oder auf die Töne oder das Diagramm tippen oder ziehen; ← → bewegen den Cursor'),
  why: L('What makes it', 'Was es erzeugt'), mechanism: L('The beat under the cursor', 'Der Schlag unter dem Cursor'),
  left: L('Left heart', 'Linkes Herz'), right: L('Right heart', 'Rechtes Herz'),
  aorta: L('Aorta', 'Aorta'), pa: L('Pulmonary artery', 'Pulmonalarterie'), lv: L('Left ventricle', 'Linker Ventrikel'), rv: L('Right ventricle', 'Rechter Ventrikel'),
  la: L('Left atrium', 'Linker Vorhof'), ra: L('Right atrium', 'Rechter Vorhof'),
  pressure: L('mmHg', 'mmHg'), volume: L('Volume, mL', 'Volumen, mL'), phono: L('PCG', 'PKG'), ecg: L('ECG', 'EKG'),
  insp: L('inspiration', 'Einatmung'), exp: L('expiration', 'Ausatmung'),
  valves: L('The valves now', 'Die Klappen jetzt'), open: L('open', 'offen'), closed: L('closed', 'geschlossen'), leaking: L('leaking', 'undicht'),
  mitral: L('Mitral', 'Mitral'), aortic: L('Aortic', 'Aorten'), tricuspid: L('Tricuspid', 'Trikuspidal'), pulmonic: L('Pulmonary', 'Pulmonal'),
  rate: L('Rate', 'Frequenz'), bp: L('BP', 'RR'), grad: L('Aortic gradient', 'Aortengradient'), msgrad: L('Mitral gradient', 'Mitralgradient'), rf: L('Regurgitant fraction', 'Regurgitationsfraktion'), ef: L('EF', 'EF'), split: L('A2–P2', 'A2–P2'),
  strip: L('Phonocardiogram with ECG and breathing. Arrow keys move the cursor, space plays or pauses.', 'Phonokardiogramm mit EKG und Atmung. Pfeiltasten bewegen den Cursor, Leertaste spielt oder hält an.'),
  diagram: L('Wiggers diagram of the beat at the cursor', 'Wiggers-Diagramm des Schlags am Cursor'),
  noAudio: L('This browser cannot play sound.', 'Dieser Browser kann keinen Ton abspielen.'),
  settling: L('The circulation is settling into its new state…', 'Der Kreislauf stellt sich auf den neuen Zustand ein…'),
  explore: L('Explore', 'Erkunden'), identify: L('Identify', 'Erkennen'), mode: L('Mode', 'Modus'),
  signsNow: L('Signs heard now', 'Jetzt hörbare Zeichen'), noSigns: L('none: normal heart sounds', 'keine: normale Herztöne'), at: L('at', 'bei'),
  predict: L('Predict first', 'Erst vorhersagen'), predictNote: L('Choosing a heart first asks which signs it will bring.', 'Bei der Wahl eines Herzens fragt die Station zuerst, welche Zeichen es bringt.'),
  predictQ: L('Which signs will this bring to the stethoscope?', 'Welche Zeichen wird das am Stethoskop bringen?'),
  playIt: L('Play it', 'Abspielen'), cancel: L('Cancel', 'Abbrechen'),
  brought: L('It brought', 'Es brachte'), took: L('It took away', 'Es nahm weg'), youMissed: L('Not predicted', 'Nicht vorhergesagt'), notCome: L('Predicted, did not come', 'Vorhergesagt, kam nicht'), nothing: L('nothing', 'nichts'),
  allRight: L('Every sign as you predicted.', 'Jedes Zeichen wie vorhergesagt.'), waiting: L('Listening to the new heart…', 'Das neue Herz wird abgehört…'),
  unknown: L('Unknown', 'Unbekannt'), unknownNote: L('A hidden change has been made to a healthy heart. Listen where and how you would at the bedside: every site, the bell, the positions, held expiration.', 'Ein gesundes Herz wurde verdeckt verändert. Hören Sie, wo und wie Sie es am Bett täten: alle Areale, die Glocke, die Lagerungen, angehaltene Exspiration.'),
  preparingUnknown: L('Preparing the patient…', 'Der Patient wird vorbereitet…'),
  nameSigns: L('Name the signs', 'Zeichen benennen'), nameSignsNote: L('Pick every sign you hear. Naming one that is not there counts too.', 'Wählen Sie jedes Zeichen, das Sie hören. Ein Zeichen zu nennen, das nicht da ist, zählt auch.'),
  nameMech: L('Name the heart', 'Das Herz benennen'), healthyHeart: L('A healthy heart', 'Ein gesundes Herz'), chooseMech: L('Choose…', 'Wählen…'),
  check: L('Check', 'Prüfen'), next: L('Next unknown', 'Nächstes Unbekanntes'), seeWhy: L('See why, in Explore', 'Das Warum ansehen, im Erkunden-Modus'),
  hits: L('Named, and there', 'Benannt und vorhanden'), misses: L('There, not named', 'Vorhanden, nicht benannt'), over: L('Named, not there', 'Benannt, nicht vorhanden'),
  mechRight: L('Right', 'Richtig'), mechWrong: L('It was', 'Es war'), score: L('right this session', 'richtig in dieser Sitzung'), heardWhere: L('Where each is heard', 'Wo jedes zu hören ist'),
};
/* The hearts Identify hides: the starting points and a healthy one. Moderate mitral stenosis is left out: the examination
   model does not yet let it be heard (known gap), and a silent unknown would be unfair. */
const IDENTIFY_POOL = ['healthy', 'as-moderate', 'as-severe', 'ms-severe', 'ar-moderate', 'mr-moderate', 'dilated-failing'];
const SITES = ['chest.aortic-area', 'chest.pulmonary-area', 'chest.erb', 'chest.tricuspid-area', 'chest.mitral-area'];
const PHASE_SHORT: Record<CyclePhase, LocalizedText> = {
  'iso-contraction': L('IVCT', 'Anspannung'), ejection: L('ejection', 'Austreibung'), 'iso-relaxation': L('IVRT', 'Entspannung'),
  'rapid-filling': L('rapid filling', 'rasche Füllung'), diastasis: L('diastasis', 'Diastase'), 'atrial-systole': L('atrial', 'Vorhof'),
};
/** Seconds of phonocardiogram: five on a wide screen, three on a phone. */
const secondsFor = (w: number) => (w < 600 ? 3 : 5);

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function mountAuscultationStation(host: HTMLElement, o: { lang: Lang; onLeave: () => void }): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const healthy = healthyModel();
  const live = new LivePatient(healthy);
  let raf = 0, stopped = false, ready = false;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slow = false;
  let frozen: BeatRecord[] | null = null;
  let cursor = 0;
  let stripGeom: PhonoGeometry | null = null, wigGeom: WiggersGeometry | null = null, wigBeat: BeatRecord | null = null;
  let side: 'left' | 'right' = 'left';
  const ctx: ExamContext = { site: 'chest.aortic-area', instrument: 'stethoscope-diaphragm', position: 'supine', respiration: 'quiet' };
  let finding: any = null, findingTick = 0;
  let stopSound: (() => void) | null = null;
  let textKey = '';
  let mode: 'explore' | 'identify' = 'explore';
  let predict = false;
  let pending: { id: string; picked: Set<string> } | null = null;
  let awaiting: { before: Set<string>; picked: string[] } | null = null;
  let feedback: { brought: string[]; took: string[]; picked: string[] } | null = null;
  let signsTick = 0;
  const id: { pool: string[]; n: number; hidden: string; truth: ReturnType<typeof auscSignsOf> | null; named: Set<string>; mech: string; checked: boolean; right: number; done: number } =
    { pool: [], n: 0, hidden: 'healthy', truth: null, named: new Set(), mech: '', checked: false, right: 0, done: 0 };
  const signLabel = (x: string) => labelOf(KNOWLEDGE, `sign:${x}`, lang);
  const presetLabel = (pid: string) => (pid === 'healthy' ? t('healthyHeart') : tr(AUSC_PRESETS.find((p) => p.id === pid)?.label ?? L(pid, pid), lang));
  const manoeuvreLabel = (m: string) => tr(CATALOG.manoeuvres[m]?.label ?? L(m, m), lang).replace(/^(Heart sounds|Herztöne): /, '');
  const settings = stationSettings(AUSCULTATION_STATION);
  const open = new Set<string>(['haemodynamics/valves', 'haemodynamics/lv']);
  const seconds = () => secondsFor(host.querySelector<HTMLElement>('.st-strip')?.clientWidth ?? 800);
  const beats = () => frozen ?? live.beats;

  const head = () => `<div class="st-head">
        <button type="button" class="ghost" data-leave>← ${t('back')}</button>
        <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(AUSCULTATION_STATION.title, lang))}</h1><p class="lede">${esc(tr(AUSCULTATION_STATION.summary, lang))}</p></div>
        <span class="seg st-mode" role="radiogroup" aria-label="${t('mode')}">${(['explore', 'identify'] as const).map((m) => `<button type="button" role="radio" aria-checked="${mode === m}" data-mode="${m}">${t(m)}</button>`).join('')}</span>
      </div>
      ${ready ? '' : `<p class="muted" data-preparing>${t('preparing')}</p>`}`;
  const listenControls = () => `<div class="st-listen" role="group" aria-label="${t('listen')}">
              <label>${t('site')} <select data-site>${SITES.map((s) => `<option value="${s}" ${s === ctx.site ? 'selected' : ''}>${esc(tr(CATALOG.structures[s]?.label ?? L(s, s), lang))}</option>`).join('')}</select></label>
              <span class="seg" role="radiogroup" aria-label="${t('listen')}">${(['stethoscope-diaphragm', 'stethoscope-bell'] as const).map((i) => `<button type="button" role="radio" aria-checked="${ctx.instrument === i}" data-inst="${i}">${t(i === 'stethoscope-bell' ? 'bell' : 'diaphragm')}</button>`).join('')}</span>
              <label>${t('position')} <select data-pos>${([['supine', 'supine'], ['left-lateral', 'leftLat'], ['sitting-forward', 'forward']] as const).map(([v, k]) => `<option value="${v}" ${ctx.position === v ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
              <label>${t('breathing')} <select data-resp>${([['quiet', 'quiet'], ['held-expiration', 'held']] as const).map(([v, k]) => `<option value="${v}" ${ctx.respiration === v ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
            </div>`;
  const render = () => {
    if (mode === 'identify') { renderIdentify(); return; }
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-set-h">
          <h2 id="st-set-h">${t('settings')}</h2>
          <p class="layer-note">${t('settingsNote')}</p>
          <label class="st-preset">${t('startFrom')}
            <select data-preset><option value="">${t('choose')}</option>${AUSC_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.map((id) => AUSC_PRESETS.find((p) => p.id === id)!).map((p) => `<option value="${p.id}">${esc(tr(p.label, lang))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          <button type="button" class="ghost small" data-healthy>${t('healthy')}</button>
          <label class="st-predict"><input type="checkbox" data-predict ${predict ? 'checked' : ''}><span><b>${t('predict')}</b><br><span class="muted small">${t('predictNote')}</span></span></label>
          <div data-controls></div>
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-hear-h">
            <div class="st-row">
              <div><h2 id="st-hear-h">${t('hear')}</h2><div class="muted small">${t('hearNote')}</div></div>
            </div>
            ${listenControls()}
            <p class="st-heard" data-heard aria-live="polite"></p>
            <div class="st-measures" data-measures></div>
            <div class="st-signs" data-signs aria-live="polite"></div>
            <div data-predict-box></div>
            <canvas class="st-strip" tabindex="0" aria-label="${t('strip')}"></canvas>
          </section>
          <div class="st-bar" role="group">
            <button type="button" class="primary" data-play></button>
            <button type="button" class="ghost" data-slow aria-pressed="${slow}">${t('slow')}</button>
            <button type="button" class="ghost" data-sound aria-pressed="false">${t('sound')}</button>
            <span class="st-phases">${CYCLE_PHASES.map((p) => `<button type="button" class="tog" data-phase="${p}">${esc(tr(CYCLE_LABEL[p], lang))}</button>`).join('')}</span>
            <span class="muted small">${t('hint')}</span>
            <span class="st-note" role="status" data-note></span>
          </div>
          <section class="panel st-why st-why-wide" aria-labelledby="st-why-h">
            <div class="st-row">
              <div><h2>${t('mechanism')}</h2></div>
              <span class="seg" role="radiogroup" aria-label="${t('mechanism')}">${(['left', 'right'] as const).map((x) => `<button type="button" role="radio" aria-checked="${side === x}" data-side="${x}">${t(x)}</button>`).join('')}</span>
            </div>
            <canvas class="st-wiggers" tabindex="0" aria-label="${t('diagram')}"></canvas>
            <div class="st-valves" data-valves aria-label="${t('valves')}"></div>
            <div class="st-text">
              <div class="eyebrow" data-phase-name></div>
              <h3 id="st-why-h" data-title></h3>
              <div data-body></div>
            </div>
          </section>
        </div>
      </div>`;
    renderControls();
    wire();
    renderPredict();
    textKey = '';
    findingTick = 0; signsTick = 0;
  };

  /* ---- predict ----------------------------------------------------------------------------------- */
  const chips = (ids: string[], on: Set<string>, attr: string, disabled = false) => ids.map((x) =>
    `<button type="button" class="chip st-chip" ${attr}="${x}" aria-pressed="${on.has(x)}" ${disabled ? 'disabled' : ''}>${esc(signLabel(x))}</button>`).join('');
  const renderPredict = () => {
    const box = host.querySelector<HTMLElement>('[data-predict-box]');
    if (!box) return;
    if (pending) {
      box.innerHTML = `<div class="st-predict-q" role="group" aria-label="${t('predictQ')}">
        <div class="eyebrow">${t('predict')} · ${esc(presetLabel(pending.id))}</div>
        <p><b>${t('predictQ')}</b></p>
        <div class="st-chips">${chips(auscSigns(), pending.picked, 'data-pick')}</div>
        <div class="st-row-buttons"><button type="button" class="primary" data-go>${t('playIt')}</button><button type="button" class="ghost" data-cancel>${t('cancel')}</button></div></div>`;
      box.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.onclick = () => {
        const x = b.dataset.pick!; pending!.picked.has(x) ? pending!.picked.delete(x) : pending!.picked.add(x);
        b.setAttribute('aria-pressed', String(pending!.picked.has(x)));
      });
      box.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = () => { pending = null; host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; renderPredict(); };
      box.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => {
        /* the answer is read once the new heart has settled (frame) */
        awaiting = { before: auscSignsOf(live.model, live.snap, live.chemistry).present, picked: [...pending!.picked] };
        change(applyAuscPreset(live.model, healthy.circulation, pending!.id), true);
        pending = null; feedback = null;
        renderPredict();
      };
    } else if (awaiting) box.innerHTML = `<p class="muted">${t('waiting')}</p>`;
    else if (feedback) {
      const f = feedback, got = new Set(f.brought);
      const right = f.picked.filter((x) => got.has(x)), missed = f.brought.filter((x) => !f.picked.includes(x)), wrong = f.picked.filter((x) => !got.has(x));
      const list = (xs: string[]) => (xs.length ? xs.map((x) => esc(signLabel(x))).join(', ') : t('nothing'));
      box.innerHTML = `<div class="st-predict-a" role="status">
        <p><b>${t('brought')}:</b> ${list(f.brought)}${f.took.length ? `. <b>${t('took')}:</b> ${list(f.took)}` : ''}.</p>
        ${!missed.length && !wrong.length ? `<p class="ok">${t('allRight')}</p>` : `${missed.length ? `<p><b>${t('youMissed')}:</b> ${list(missed)}</p>` : ''}${wrong.length ? `<p><b>${t('notCome')}:</b> ${list(wrong)}</p>` : ''}`}
        ${right.length ? `<p class="muted small">✓ ${list(right)}</p>` : ''}</div>`;
    } else box.innerHTML = '';
  };
  const signsHtml = (r: ReturnType<typeof auscSignsOf>) => r.present.size
    ? [...r.present].map((x) => `<span class="sign" title="${esc(`${t('at')}: ${(r.where.get(x) ?? []).map(manoeuvreLabel).join('; ')}`)}">${esc(signLabel(x))}</span>`).join('')
    : `<span class="muted small">${t('noSigns')}</span>`;
  const renderSignsNow = () => {
    const box = host.querySelector<HTMLElement>('[data-signs]');
    if (!box) return;
    const html = `<span class="muted small">${t('signsNow')}:</span> ${signsHtml(auscSignsOf(live.model, live.snap, live.chemistry))}`;
    if (box.innerHTML !== html) box.innerHTML = html;
  };

  /* ---- identify ---------------------------------------------------------------------------------- */
  const nextUnknown = () => {
    if (!id.pool.length) id.pool = [...IDENTIFY_POOL].sort(() => Math.random() - 0.5);
    id.hidden = id.pool.pop()!;
    id.n++; id.truth = null; id.named = new Set(); id.mech = ''; id.checked = false;
    Object.assign(ctx, { site: 'chest.aortic-area', instrument: 'stethoscope-diaphragm', position: 'supine', respiration: 'quiet' });
    change(id.hidden === 'healthy' ? healthyModel() : applyAuscPreset(healthyModel(), healthy.circulation, id.hidden), false);
  };
  const renderIdentify = () => {
    host.innerHTML = `${head()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="st-name-h">
          <h2 id="st-name-h">${t('nameSigns')}</h2>
          <p class="layer-note">${t('nameSignsNote')}</p>
          <div class="st-chips">${chips(auscSigns(), id.named, 'data-name', id.checked)}</div>
          <label class="st-preset">${t('nameMech')}
            <select data-mech ${id.checked ? 'disabled' : ''}><option value="">${t('chooseMech')}</option><option value="healthy" ${id.mech === 'healthy' ? 'selected' : ''}>${t('healthyHeart')}</option>
            ${AUSC_PRESET_GROUPS.map((g) => `<optgroup label="${esc(tr(g.group, lang))}">${g.ids.filter((x) => IDENTIFY_POOL.includes(x)).map((x) => `<option value="${x}" ${id.mech === x ? 'selected' : ''}>${esc(presetLabel(x))}</option>`).join('')}</optgroup>`).join('')}</select>
          </label>
          ${id.checked ? `<button type="button" class="primary" data-next>${t('next')}</button>` : `<button type="button" class="primary" data-check ${id.truth && id.mech ? '' : 'disabled'}>${t('check')}</button>`}
          ${id.done ? `<p class="muted small">${id.right} / ${id.done} ${t('score')}</p>` : ''}
        </aside>
        <div class="st-main">
          <section class="panel st-signal" aria-labelledby="st-unk-h">
            <div class="st-row"><div><h2 id="st-unk-h">${t('unknown')} ${id.n}</h2><div class="muted small">${t('unknownNote')}</div></div></div>
            ${listenControls()}
            ${id.truth ? '' : `<p class="muted" data-recording>${t('preparingUnknown')}</p>`}
            <canvas class="st-strip" tabindex="0" aria-label="${t('strip')}"></canvas>
          </section>
          <div class="st-bar" role="group">
            <button type="button" class="primary" data-play></button>
            <button type="button" class="ghost" data-sound aria-pressed="false">${t('sound')}</button>
            <span class="muted small">${t('hint')}</span>
            <span class="st-note" role="status" data-note></span>
          </div>
          ${id.checked ? resultHtml() : ''}
        </div>
      </div>`;
    wireCommon();
    host.querySelectorAll<HTMLButtonElement>('[data-name]').forEach((b) => b.onclick = () => {
      const x = b.dataset.name!; id.named.has(x) ? id.named.delete(x) : id.named.add(x);
      b.setAttribute('aria-pressed', String(id.named.has(x)));
    });
    host.querySelector<HTMLSelectElement>('[data-mech]')!.onchange = (e) => { id.mech = (e.target as HTMLSelectElement).value; const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !(id.truth && id.mech); };
    host.querySelector<HTMLButtonElement>('[data-check]')?.addEventListener('click', () => {
      id.checked = true; id.done++;
      const tp = id.truth!.present;
      if (id.mech === id.hidden && [...id.named].every((x) => tp.has(x)) && [...tp].every((x) => id.named.has(x))) id.right++;
      endSound(); renderIdentify();
    });
    host.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { endSound(); nextUnknown(); renderIdentify(); });
    host.querySelector<HTMLButtonElement>('[data-why]')?.addEventListener('click', () => { mode = 'explore'; endSound(); render(); });
    findingTick = 0;
  };
  const resultHtml = () => {
    const truth = id.truth!;
    const hits = [...id.named].filter((x) => truth.present.has(x)), misses = [...truth.present].filter((x) => !id.named.has(x)), over = [...id.named].filter((x) => !truth.present.has(x));
    const col = (title: string, xs: string[], cls: string) => `<div class="st-res ${cls}"><h3>${title}</h3>${xs.length ? `<ul>${xs.map((x) => `<li>${esc(signLabel(x))}</li>`).join('')}</ul>` : `<p class="muted small">—</p>`}</div>`;
    const right = id.mech === id.hidden;
    const where = [...truth.present].map((x) => `<li><b>${esc(signLabel(x))}</b>: ${esc((truth.where.get(x) ?? []).map(manoeuvreLabel).join('; '))}</li>`).join('');
    return `<section class="panel st-result" aria-labelledby="st-res-h">
      <h2 id="st-res-h" class="${right ? 'ok' : 'abn'}">${right ? t('mechRight') : t('mechWrong')}: ${esc(presetLabel(id.hidden))}</h2>
      <div class="st-res-grid">${col(t('hits'), hits, 'hit')}${col(t('misses'), misses, 'miss')}${col(t('over'), over, 'over')}</div>
      ${where ? `<div><h3 class="small">${t('heardWhere')}</h3><ul class="small">${where}</ul></div>` : ''}
      <button type="button" class="ghost" data-why>${t('seeWhy')}</button>
    </section>`;
  };

  /* ---- settings ------------------------------------------------------------------------------ */
  const renderControls = () => {
    const box = host.querySelector<HTMLElement>('[data-controls]')!;
    const m = live.model;
    const control = (v: VariableDef) => {
      const val = getPath(m, v.key);
      const label = esc(tr(v.label, lang));
      if (v.control === 'enum') return `<label class="st-var"><span>${label}</span><select data-k="${v.key}">${(v.options ?? []).map((op) => `<option value="${esc(op.value)}" ${op.value === val ? 'selected' : ''}>${esc(tr(op.label, lang))}</option>`).join('')}</select></label>`;
      if (v.control === 'toggle') return `<label class="st-var st-check"><input type="checkbox" data-k="${v.key}" ${val ? 'checked' : ''}><span>${label}</span></label>`;
      return `<label class="st-var"><span>${label} <output data-out="${v.key}">${esc(fmtValue(v, val, lang))} ${esc(v.unit)}</output></span>
        <input type="range" data-k="${v.key}" min="${v.min}" max="${v.max}" step="${v.step}" value="${Number(val)}"></label>`;
    };
    box.innerHTML = settings.map((g) => `<details class="grp" data-sec="${g.id}" ${open.has(g.id) ? 'open' : ''}><summary>${esc(tr(g.label, lang))}</summary>
      ${g.why ? `<p class="muted small">${esc(tr(g.why, lang))}</p>` : ''}${g.vars.map(control).join('')}</details>`).join('');
    box.querySelectorAll<HTMLDetailsElement>('details[data-sec]').forEach((d) => d.addEventListener('toggle', () => { d.open ? open.add(d.dataset.sec!) : open.delete(d.dataset.sec!); }));
    box.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) => {
      const key = el.dataset.k!;
      const handler = () => {
        let v: unknown;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') { const cur = getPath(live.model, key); v = typeof cur === 'boolean' ? el.checked : el.checked ? 1 : 0; }
        else if (el instanceof HTMLInputElement) v = Number(el.value);
        else v = el.value;
        const next = structuredClone(live.model);
        setPath(next, key, v);
        change(next, false);
        const out = box.querySelector<HTMLOutputElement>(`[data-out="${CSS.escape(key)}"]`);
        const def = settings.flatMap((g) => g.vars).find((x) => x.key === key);
        if (out && def) out.textContent = `${fmtValue(def, v as number, lang)} ${def.unit}`;
      };
      el.addEventListener(el instanceof HTMLInputElement && el.type === 'range' ? 'input' : 'change', handler);
    });
  };
  /* After a change the circulation takes some seconds to settle (blood moves between vessels and heart, the reflexes act):
     the station runs it ahead quickly through that, so what is heard is the new steady state. */
  let settleUntil = 0;
  const SETTLE_S = 20, SETTLE_SPEED = 8;
  const change = (next: ReturnType<typeof healthyModel>, rerenderControls: boolean) => {
    live.setModel(next);
    settleUntil = live.t + SETTLE_S; live.speed = SETTLE_SPEED; note(t('settling'));
    playing = true; frozen = null; findingTick = 0; endSound();
    if (rerenderControls) renderControls();
    syncButtons();
  };

  /* ---- sound --------------------------------------------------------------------------------- */
  const endSound = () => { stopSound?.(); stopSound = null; host.querySelector('[data-sound]')?.setAttribute('aria-pressed', 'false'); const b = host.querySelector<HTMLButtonElement>('[data-sound]'); if (b) b.textContent = t('sound'); };
  const startSound = () => {
    const b = stripBeat(wigBeat ?? beats().at(-1)!);
    if (!b) return;
    stopSound = playCycle(b.cycle);
    const btn = host.querySelector<HTMLButtonElement>('[data-sound]')!;
    if (!stopSound) { note(t('noAudio')); return; }
    btn.setAttribute('aria-pressed', 'true'); btn.textContent = t('stopSound');
  };

  /* ---- wiring -------------------------------------------------------------------------------- */
  const note = (x: string) => { const n = host.querySelector<HTMLElement>('[data-note]'); if (n) n.textContent = x; };
  const syncButtons = () => {
    const play = host.querySelector<HTMLButtonElement>('[data-play]');
    if (play) play.textContent = playing ? t('pause') : t('play');
    host.querySelector('[data-slow]')?.setAttribute('aria-pressed', String(slow));
  };
  const span = () => { const bs = beats(); const last = bs.at(-1); const to = last ? last.t0 + last.dur : 0; return { from: to - seconds() * 1000, to }; };
  const pause = () => { if (playing) { frozen = live.beats.map((b) => b); } playing = false; syncButtons(); };
  const clampCursor = (x: number) => { const s = span(); const first = beats().find((b) => b.t0 + b.dur > s.from); return Math.max(first ? Math.max(s.from, first.t0) : s.from, Math.min(s.to - 1, x)); };
  const seekOn = (canvas: HTMLCanvasElement, toTime: (x: number) => number | null) => {
    let dragging = false;
    const seek = (ev: PointerEvent) => {
      if (playing) pause();
      const r = canvas.getBoundingClientRect();
      const tt = toTime(ev.clientX - r.left);
      if (tt != null) { cursor = clampCursor(tt); note(''); }
    };
    canvas.addEventListener('pointerdown', (ev) => { dragging = true; canvas.setPointerCapture(ev.pointerId); seek(ev); });
    canvas.addEventListener('pointermove', (ev) => { if (dragging) seek(ev); });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('keydown', (ev) => {
      if (ev.key === ' ') { ev.preventDefault(); host.querySelector<HTMLButtonElement>('[data-play]')!.click(); return; }
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      if (playing) pause();
      cursor = clampCursor(cursor + (ev.key === 'ArrowLeft' ? -1 : 1) * (ev.shiftKey ? 40 : 4));
    });
  };
const wireCommon = () => {
    host.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => o.onLeave();
    host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.onclick = () => {
      const m = b.dataset.mode as typeof mode;
      if (m === mode) return;
      mode = m; pending = null; awaiting = null; feedback = null; endSound();
      if (mode === 'identify') nextUnknown(); else { playing = true; frozen = null; }
      render();
    });
    host.querySelector<HTMLSelectElement>('[data-site]')!.onchange = (e) => { ctx.site = (e.target as HTMLSelectElement).value; findingTick = 0; endSound(); };
    host.querySelector<HTMLSelectElement>('[data-pos]')!.onchange = (e) => { ctx.position = (e.target as HTMLSelectElement).value as ExamContext['position']; findingTick = 0; endSound(); };
    host.querySelector<HTMLSelectElement>('[data-resp]')!.onchange = (e) => { ctx.respiration = (e.target as HTMLSelectElement).value as ExamContext['respiration']; findingTick = 0; endSound(); };
    host.querySelectorAll<HTMLButtonElement>('[data-inst]').forEach((b) => b.onclick = () => {
      ctx.instrument = b.dataset.inst!; findingTick = 0; endSound();
      host.querySelectorAll('[data-inst]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    host.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => { if (playing) pause(); else { playing = true; frozen = null; note(''); syncButtons(); } };
    host.querySelector<HTMLButtonElement>('[data-sound]')!.onclick = () => { if (stopSound) endSound(); else startSound(); };
    seekOn(host.querySelector<HTMLCanvasElement>('.st-strip')!, (x) => stripGeom?.tAt(x) ?? null);
    syncButtons();
  };
  const wire = () => {
    wireCommon();
    host.querySelector<HTMLSelectElement>('[data-preset]')!.onchange = (e) => {
      const pid = (e.target as HTMLSelectElement).value;
      if (!pid) return;
      if (predict) { pending = { id: pid, picked: new Set() }; feedback = null; renderPredict(); }
      else change(applyAuscPreset(live.model, healthy.circulation, pid), true);
    };
    host.querySelector<HTMLInputElement>('[data-predict]')!.onchange = (e) => { predict = (e.target as HTMLInputElement).checked; pending = null; renderPredict(); };
    host.querySelector<HTMLButtonElement>('[data-healthy]')!.onclick = () => { change(healthyModel(), true); host.querySelector<HTMLSelectElement>('[data-preset]')!.value = ''; };
    host.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => b.onclick = () => {
      side = b.dataset.side as typeof side;
      host.querySelectorAll('[data-side]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    host.querySelector<HTMLButtonElement>('[data-slow]')!.onclick = () => { slow = !slow; if (!settleUntil) live.speed = slow ? 0.25 : 1; syncButtons(); };
    host.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach((b) => b.onclick = () => {
      pause();
      const beat = wigBeat ?? beats().at(-1);
      if (!beat) return;
      const seg = cycleSegments(beat, side).find((x) => x.phase === b.dataset.phase);
      if (!seg) { note(tr(L('Not in this beat.', 'Nicht in diesem Schlag.'), lang)); return; }
      cursor = beat.t0 + (seg.from + seg.to) / 2; note('');
    });
    seekOn(host.querySelector<HTMLCanvasElement>('.st-wiggers')!, (x) => (wigGeom && wigBeat ? wigBeat.t0 + wigGeom.tAt(x) : null));
    syncButtons();
  };

  /* ---- the finding and each beat's sounds ------------------------------------------------------ */
  const readFinding = () => {
    const c = caseWithModel(FREE_CASE, live.model);
    const view = buildView(c, { circulation: live.snap, chemistry: live.chemistry });
    finding = observe(CATALOG, REGISTRY.resolvers, c, view, 'heart.sounds', ctx).value;
  };
  const hr = () => (live.snap.metricsBreath?.HRbeat ?? live.snap.metrics?.HRbeat ?? 72) as number;
  const cache = new WeakMap<BeatRecord, { key: string; sb: StripBeat }>();
  let findingKey = '';
  const stripBeat = (b: BeatRecord): StripBeat => {
    const hit = cache.get(b);
    if (hit && hit.key === findingKey) return hit.sb;
    const m1 = b.times.m1 ?? 0, s1At = m1 > b.dur / 2 ? m1 - b.dur : m1;
    const sb = { beat: b, cycle: phonoCycle(finding ?? {}, 60000 / b.dur, b.times as any), s1At };
    cache.set(b, { key: findingKey, sb });
    return sb;
  };

  /* ---- drawing --------------------------------------------------------------------------------- */
  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const sizeCanvas = (c: HTMLCanvasElement, h: number) => {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth;
    if (c.style.height !== `${h}px`) c.style.height = `${h}px`;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w };
  };
  const num = (x: number, d = 0) => (lang === 'de' ? x.toFixed(d).replace('.', ',') : x.toFixed(d));

  const frame = () => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (!ready) return;
    if (settleUntil && live.t >= settleUntil) {
      settleUntil = 0; live.speed = slow ? 0.25 : 1; note('');
      if (awaiting) {
        const after = auscSignsOf(live.model, live.snap, live.chemistry).present, a = awaiting;
        feedback = { brought: [...after].filter((x) => !a.before.has(x)), took: [...a.before].filter((x) => !after.has(x)), picked: a.picked };
        awaiting = null; renderPredict();
      }
      if (mode === 'identify' && !id.truth) {
        id.truth = auscSignsOf(live.model, live.snap, live.chemistry);
        host.querySelector('[data-recording]')?.remove();
        const c = host.querySelector<HTMLButtonElement>('[data-check]'); if (c) c.disabled = !id.mech;
      }
    }
    if (mode === 'explore' && !settleUntil && signsTick-- <= 0) { renderSignsNow(); signsTick = 90; }
    if (findingTick-- <= 0) {
      readFinding(); findingTick = 30;
      const key = JSON.stringify([finding, ctx]);
      if (key !== findingKey) {
        findingKey = key;
        const heard = host.querySelector<HTMLElement>('[data-heard]');
        if (heard) heard.textContent = FORMATTERS['heart.sounds']?.(finding, ctx, lang, CATALOG, { property: 'heart.sounds' } as any) ?? '';
        if (stopSound) { endSound(); startSound(); }
      }
    }
    const bs = beats();
    const strip = host.querySelector<HTMLCanvasElement>('.st-strip'), wig = host.querySelector<HTMLCanvasElement>('.st-wiggers');
    if (!strip || bs.length < 2) return;
    if (mode === 'identify' && !id.truth) return;
    const { from, to } = span();
    const last = bs.at(-1)!;
    if (playing) {
      const into = live.run.sim.t * 1000 - (last.t0 + last.dur);
      cursor = last.t0 + Math.max(0, Math.min(last.dur - 1, into));
    }
    const beat = bs.find((b) => cursor >= b.t0 && cursor < b.t0 + b.dur) ?? last;
    wigBeat = beat;
    const sb = stripBeat(beat);
    const tIn = cursor - beat.t0;
    const mo = cycleAt(beat, tIn, side);
    const segs = cycleSegments(beat, side);
    const seg = segs.find((x) => tIn >= x.from && tIn < x.to) ?? null;
    const colors = { fg: css('--fg'), muted: css('--muted'), accent: css('--accent'), abn: css('--abn'), line: css('--line'), surface: css('--surface') };

    const sw = strip.clientWidth, sh = phonoStripHeight(sw);
    stripGeom = drawPhonoStrip(sizeCanvas(strip, sh).g, sw, sh, {
      beats: bs.filter((b) => b.t0 + b.dur > from).map(stripBeat), from, to, cursor,
      band: seg ? { from: beat.t0 + seg.from, to: beat.t0 + seg.to } : null,
      colors: { ...colors, insp: '#4f8fb3' },
      /* in Identify the sounds are not named: naming them is the task */
      labels: { ecg: t('ecg'), phono: t('phono'), insp: t('insp'), exp: t('exp'), sounds: mode === 'identify' ? { s1: '', a2: '', p2: '', s3: '', s4: '', 'opening-snap': '', 'ejection-click': '' } : { s1: 'S1', a2: 'A2', p2: 'P2', s3: 'S3', s4: 'S4', 'opening-snap': 'OS', 'ejection-click': 'EC' } },
    });
    if (!wig) return;
    const ww = wig.clientWidth, wh = wiggersHeight(ww);
    wigGeom = drawWiggers(sizeCanvas(wig, wh).g, ww, wh, {
      b: sb, side, segments: segs, events: valveEvents(beat), cursor: tIn,
      colors: { ...colors, atrium: '#4f6fb3', volume: '#8a6d1f' },
      labels: {
        pressure: t('pressure'), volume: t('volume'), ecg: t('ecg'), phono: t('phono'),
        artery: t(side === 'left' ? 'aorta' : 'pa'), ventricle: t(side === 'left' ? 'lv' : 'rv'), atrium: t(side === 'left' ? 'la' : 'ra'),
        phase: Object.fromEntries(CYCLE_PHASES.map((p) => [p, tr(PHASE_SHORT[p], lang)])),
      },
    });

    // the valves now
    const vb = host.querySelector<HTMLElement>('[data-valves]')!;
    const vhtml = `<span class="muted small">${t('valves')}:</span> ${(['mitral', 'aortic', 'tricuspid', 'pulmonic'] as const).map((k) => `<span class="st-valve ${mo.valves[k]}">${t(k)} <b>${t(mo.valves[k])}</b></span>`).join('')}`;
    if (vb.innerHTML !== vhtml) vb.innerHTML = vhtml;

    // the words: rewritten only when what they describe changes
    const mt = live.snap.metricsBreath ?? live.snap.metrics ?? {};
    const leaks = (k: 'mitral' | 'aortic') => beat.samples.some((s) => cycleAt(beat, s.t).valves[k] === 'leaking');
    const split = beat.times.a2 != null && beat.times.p2 != null ? beat.times.p2 - beat.times.a2 : null;
    const ms = meanMitralGradient(beat);
    const m = {
      hr: hr(), gradient: mt.aorticGradient ?? 0, msGradient: ms, regurgFraction: mt.regurgFraction ?? 0, ef: mt.EF ?? 60, edv: mt.EDV ?? 120, la: mt.PlaMean ?? 8,
      split, phaseMs: seg ? seg.to - seg.from : 0, mitralLeaks: leaks('mitral'), aorticLeaks: leaks('aortic'),
      prematureMitralClosure: (beat.times.m1 ?? 0) > beat.dur / 2 && beat.dur - (beat.times.m1 ?? 0) > 120,
      af: live.model.electrical.atrial === 'af', breath: (beat.log.breath?.phase ?? null) as 'insp' | 'exp' | null,
    };
    const key = JSON.stringify([lang, side, mo.phase, mo.valves, findingKey, beat.t0, Math.round(m.gradient), Math.round(ms), m.af]);
    if (key !== textKey) {
      textKey = key;
      const x = explainCycle({ phase: mo.phase, valves: mo.valves, finding: finding ?? {}, m, site: ctx.site!, bell: ctx.instrument === 'stethoscope-bell' });
      host.querySelector('[data-phase-name]')!.textContent = `${t('why')} · ${tr(CYCLE_LABEL[mo.phase], lang)}`;
      host.querySelector('[data-title]')!.textContent = tr(x.title, lang);
      const rightNote = side === 'right' ? [L('The diagram shows the right heart, whose phases are its own: its pressures are a fifth of the left’s, its valves open and close a few ms apart from the left ones, and P2 follows A2. The text follows the left heart.',
        'Das Diagramm zeigt das rechte Herz mit seinen eigenen Phasen: Seine Drücke sind ein Fünftel der linken, seine Klappen öffnen und schließen einige ms neben den linken, und P2 folgt A2. Der Text folgt dem linken Herzen.')] : [];
      host.querySelector('[data-body]')!.innerHTML = [...rightNote, ...x.body].map((b) => `<p>${esc(tr(b, lang))}</p>`).join('');
      host.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === mo.phase)));
      const chip = (label: string, v: string, abn = false) => `<span class="${abn ? 'abn' : ''}">${label} <b>${v}</b></span>`;
      host.querySelector('[data-measures]')!.innerHTML = chip(t('rate'), `${Math.round(m.hr)}/min`)
        + chip(t('bp'), `${Math.round(mt.Psys ?? 0)}/${Math.round(mt.Pdia ?? 0)}`)
        + chip(t('grad'), `${Math.round(m.gradient)} mmHg`, m.gradient >= 36)
        + chip(t('msgrad'), `${num(ms, 1)} mmHg`, ms >= 5)
        + chip(t('rf'), `${Math.round(m.regurgFraction * 100)} %`, m.regurgFraction >= 0.3)
        + chip(t('ef'), `${Math.round(m.ef)} %`, m.ef < 50)
        + chip(t('split'), split == null ? '—' : `${Math.round(split)} ms`, split != null && (split < 0 || split > 60));
    }
  };

  render();
  raf = requestAnimationFrame(frame);
  void live.settle(20).then(() => {
    if (stopped) return;
    ready = true;
    host.querySelector('[data-preparing]')?.remove();
    live.start();
  });

  return {
    stop: () => { stopped = true; cancelAnimationFrame(raf); live.stop(); endSound(); },
    setLang: (l: Lang) => { lang = l; findingKey = ''; render(); },
  };
}
