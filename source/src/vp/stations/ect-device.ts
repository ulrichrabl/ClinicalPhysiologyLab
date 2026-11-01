import { ECT } from '../evidence/ect.ts';
import { PERCENT_STEPS, CHARGE_MC, PROGRAM_TABLES, type ProgramId } from './ect-programs.ts';

/* ===========================================================================
   The ECT device as a state machine (ECT station, part 1).

   It behaves as its manual describes (Thymatron System IV Instructions for
   Use, Rev 21, "Operating instructions" and "Treatment stimulus
   administration"), so that the steps learned here are the steps at the real
   device: power on and self test ("SELFTEST", then "NO BASE"); the percent
   energy dial with its 1 s display of the charge; pressing that dial to show
   the program; the FlexDial (press to enter, rotate through functions, press
   for the option, rotate, press to select; the impedance test or
   start/stop button exits); the impedance test ("TESTING", the ohms while
   held, then "BASELINE" for 6–10 s, then "READY"); the treatment button,
   held: 1 s continuous tone (3 s above 3000 Ω), then an intermittent tone
   while the current flows; released early, a smaller charge; afterwards the
   seconds since the stimulus on the left display and the printer running;
   start/stop prints the end-of-treatment report.

   The device knows nothing of the patient: the station gives it the static
   impedance it would measure and is told when a stimulus starts and stops.
=========================================================================== */

export type ProgramChoice = 'DGX' | 'LOWEST' | 'LOW_UB' | 'LOW_05' | 'INTERMIT' | 'USER';
export const PROGRAM_NAMES: Record<ProgramChoice, string> = {
  DGX: 'DGX', LOWEST: 'LOWEST', LOW_UB: 'LOW 0.25', LOW_05: 'LOW 0.5', INTERMIT: 'INTERMIT', USER: 'USER',
};
/** the names printed on the report */
export const PROGRAM_REPORT: Record<ProgramChoice, string> = {
  DGX: 'DGx', LOWEST: 'Lowest charge rate', LOW_UB: 'Low 0.25 charge rate', LOW_05: 'Low 0.5 charge rate', INTERMIT: 'Intermittent', USER: 'User set',
};

export const FREQUENCIES = [10, 20, 30, 40, 50, 60, 70];
export const PULSE_WIDTHS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];

export interface Stimulus { frequency: number; pulseWidth: number; pulses: number; charge: number; duration: number }

/** The stimulus a program gives at a percent setting; null where a user setting would take longer than 8 s. */
export function stimulusFor(program: ProgramChoice, percent: number, user: { frequency: number; pulseWidth: number }, ultrabrief: 0.25 | 0.3 = 0.25): Stimulus | null {
  const i = PERCENT_STEPS.indexOf(percent);
  if (i < 0) return null;
  if (program === 'USER') {
    const pulses = Math.round(CHARGE_MC[i] / (ECT.current * user.pulseWidth));
    const duration = pulses / (2 * user.frequency);
    if (duration > ECT.maxDuration + 0.005) return null;
    return { frequency: user.frequency, pulseWidth: user.pulseWidth, pulses, charge: ECT.current * user.pulseWidth * pulses, duration };
  }
  const ub3 = ultrabrief === 0.3;
  const id: ProgramId = program === 'LOWEST' ? (ub3 ? 'LOWEST_030' : 'LOWEST_025') : program === 'LOW_UB' ? (ub3 ? 'LOW_030' : 'LOW_025') : program;
  const T = PROGRAM_TABLES[id];
  const s = { frequency: T.frequency[i], pulseWidth: T.pulseWidth[i], pulses: T.pulses[i] };
  return { ...s, charge: ECT.current * s.pulseWidth * s.pulses, duration: program === 'INTERMIT' ? T.duration[i] : s.pulses / (2 * s.frequency) };
}

/* ---- FlexDial: the functions the station offers, with their options ------------------------------ */

export type FlexFunction = 'PROGRAMS' | 'FREQUENC' | 'P-WIDTH' | 'CHANN. 1' | 'CHANN. 2' | 'INDEXES' | 'EEG FREQ' | 'PRINTOUT';
export const FLEX_FUNCTIONS: FlexFunction[] = ['PROGRAMS', 'FREQUENC', 'P-WIDTH', 'CHANN. 1', 'CHANN. 2', 'INDEXES', 'EEG FREQ', 'PRINTOUT'];
export const EEG_GAINS = [10, 20, 50, 100, 200, 500, 1000, 2000];
export const EEG_FREQ = ['SP. EDGE', 'MID FREQ', '% DELTA', 'OFF'] as const;
export const PAPER = [10, 25, 50];

export interface DeviceSettings {
  program: ProgramChoice;
  percentIndex: number;
  user: { frequency: number; pulseWidth: number };
  gain: [number, number];
  indexes: boolean;
  eegFreq: typeof EEG_FREQ[number];
  paper: number;
  /** the highest percent the dial offers: 100, or 200 where the double range is approved (CE regions) */
  maxPercent: 100 | 200;
  /** the ultrabrief pulse the device was set up with: 0.25 or 0.3 ms (firmware 5.60: "either 0.25 or 0.3 pulsewidths"),
      for the LOWEST and LOW programs' ultrabrief tables (Addendum VII) */
  ultrabrief: 0.25 | 0.3;
}

export const DEFAULT_SETTINGS: DeviceSettings = {
  program: 'LOW_05', percentIndex: PERCENT_STEPS.indexOf(30), user: { frequency: 30, pulseWidth: 0.5 }, gain: [200, 200], indexes: true, eegFreq: 'OFF', paper: 25, maxPercent: 100, ultrabrief: 0.25,
};

export type DeviceEvent =
  | { type: 'selftest-printed' }
  | { type: 'impedance-test' }
  | { type: 'baseline-start' }
  | { type: 'ready' }
  | { type: 'stimulus-start'; stimulus: Stimulus }
  | { type: 'stimulus-stop'; early: boolean }
  | { type: 'printer'; running: boolean }
  | { type: 'report' }
  | { type: 'settings-printed' };

export type Tone = 'none' | 'warning' | 'delivering';

export class EctDevice {
  settings: DeviceSettings;
  on = false;
  /** seconds since power on, and the device's clock (s) */
  t = 0;
  private bootAt = -1;
  /** 'none' before the impedance test, then collecting, then ready */
  baseline: 'none' | 'collecting' | 'ready' = 'none';
  private baselineAt = 0;
  /** what the station says the device would measure now (Ω); Infinity with nothing connected */
  staticOhm = Infinity;
  /** the impedance test button */
  testing = false; private testAt = 0;
  /** last static impedance shown */
  lastStatic: number | null = null;
  /** the treatment button */
  treat: 'idle' | 'warning' | 'delivering' | 'done' = 'idle';
  private treatAt = 0;
  /** the stimulus set when the treatment button was pressed */
  active: Stimulus | null = null;
  /** end of the last stimulus (device time), and what it gave */
  stimulusEnd: number | null = null;
  delivered: Stimulus | null = null;
  printing = false;
  /** the percent dial's charge display lasts 1 s after a turn */
  private chargeShownUntil = -1;
  /** the percent dial pressed (shows the program) */
  percentPressed = false;
  /** FlexDial mode */
  flex: { fn: number; option: number | null } | null = null;
  private lastFn = 0;
  reportFlashUntil = -1;
  readonly events: DeviceEvent[] = [];

  constructor(settings: DeviceSettings = DEFAULT_SETTINGS) { this.settings = structuredClone(settings); }

  get percent() { return PERCENT_STEPS[this.settings.percentIndex]; }
  get stimulusNow(): Stimulus | null { return stimulusFor(this.settings.program, this.percent, this.settings.user, this.settings.ultrabrief); }
  /** the program's name as this device shows it (its ultrabrief program as LOW 0.3 if it was set up with 0.3 ms) */
  programName(p: ProgramChoice = this.settings.program) { return p === 'LOW_UB' && this.settings.ultrabrief === 0.3 ? 'LOW 0.3' : PROGRAM_NAMES[p]; }

  private emit(e: DeviceEvent) { this.events.push(e); }
  /** take the events since the last call */
  drain(): DeviceEvent[] { return this.events.splice(0, this.events.length); }

  /* ---- controls ---------------------------------------------------------------------------- */

  power(on: boolean) {
    if (on === this.on) return;
    this.on = on;
    if (on) { this.bootAt = this.t; this.baseline = 'none'; this.treat = 'idle'; this.flex = null; this.printing = false; this.stimulusEnd = null; }
    else { this.printing = false; this.flex = null; this.treat = 'idle'; }
  }
  get booting() { return this.on && this.t - this.bootAt < 5; }

  /** turn the percent energy dial by `steps` detents (±) */
  turnPercent(steps: number) {
    if (!this.on || this.booting) return;
    if (this.percentPressed) {
      const order: ProgramChoice[] = ['DGX', 'LOWEST', 'LOW_UB', 'LOW_05', 'INTERMIT', 'USER'];
      const i = order.indexOf(this.settings.program);
      this.settings.program = order[(i + steps + order.length * 10) % order.length];
      return;
    }
    /* the dial's own range: the table's settings up to the allowed maximum (5 % steps from 30 %) */
    const max = PERCENT_STEPS.findIndex((p) => p === this.settings.maxPercent);
    this.settings.percentIndex = Math.max(0, Math.min(max, this.settings.percentIndex + steps));
    this.chargeShownUntil = this.t + 1;
  }
  pressPercent(down: boolean) { if (this.on && !this.booting) this.percentPressed = down; }

  pressFlex() {
    if (!this.on || this.booting) return;
    if (!this.flex) { this.flex = { fn: this.lastFn, option: null }; return; }
    const fn = FLEX_FUNCTIONS[this.flex.fn];
    if (this.flex.option == null) { this.flex.option = this.currentOption(fn); return; }
    this.applyOption(fn, this.flex.option);
    this.lastFn = this.flex.fn;
    this.flex.option = null;
  }
  turnFlex(steps: number) {
    if (!this.flex) return;
    if (this.flex.option == null) { const n = FLEX_FUNCTIONS.length; this.flex.fn = (this.flex.fn + steps + n * 10) % n; return; }
    const n = this.options(FLEX_FUNCTIONS[this.flex.fn]).length;
    this.flex.option = (this.flex.option + steps + n * 10) % n;
  }
  options(fn: FlexFunction): string[] {
    switch (fn) {
      case 'PROGRAMS': return (['DGX', 'LOWEST', 'LOW_UB', 'LOW_05', 'INTERMIT', 'USER'] as ProgramChoice[]).map((p) => PROGRAM_NAMES[p]);
      case 'FREQUENC': return FREQUENCIES.map((f) => `${f} HZ`);
      case 'P-WIDTH': return PULSE_WIDTHS.map((w) => `${w} MS`);
      case 'CHANN. 1': case 'CHANN. 2': return EEG_GAINS.map((g) => `GAIN ${g}`);
      case 'INDEXES': return ['ON', 'OFF'];
      case 'EEG FREQ': return [...EEG_FREQ];
      case 'PRINTOUT': return PAPER.map((p) => `PRINT ${p}`);
    }
  }
  private currentOption(fn: FlexFunction): number {
    const s = this.settings;
    switch (fn) {
      case 'PROGRAMS': return ['DGX', 'LOWEST', 'LOW_UB', 'LOW_05', 'INTERMIT', 'USER'].indexOf(s.program);
      case 'FREQUENC': return FREQUENCIES.indexOf(s.user.frequency);
      case 'P-WIDTH': return PULSE_WIDTHS.indexOf(s.user.pulseWidth);
      case 'CHANN. 1': return EEG_GAINS.indexOf(s.gain[0]);
      case 'CHANN. 2': return EEG_GAINS.indexOf(s.gain[1]);
      case 'INDEXES': return s.indexes ? 0 : 1;
      case 'EEG FREQ': return EEG_FREQ.indexOf(s.eegFreq);
      case 'PRINTOUT': return PAPER.indexOf(s.paper);
    }
  }
  private applyOption(fn: FlexFunction, i: number) {
    const s = this.settings;
    switch (fn) {
      case 'PROGRAMS': s.program = (['DGX', 'LOWEST', 'LOW_UB', 'LOW_05', 'INTERMIT', 'USER'] as ProgramChoice[])[i]; break;
      /* a frequency or pulse width of its own takes the device out of any preset program (manual) */
      case 'FREQUENC': s.user.frequency = FREQUENCIES[i]; s.program = 'USER'; break;
      case 'P-WIDTH': s.user.pulseWidth = PULSE_WIDTHS[i]; s.program = 'USER'; break;
      case 'CHANN. 1': s.gain[0] = EEG_GAINS[i]; break;
      case 'CHANN. 2': s.gain[1] = EEG_GAINS[i]; break;
      case 'INDEXES': s.indexes = i === 0; break;
      case 'EEG FREQ': s.eegFreq = EEG_FREQ[i]; break;
      case 'PRINTOUT': s.paper = PAPER[i]; break;
    }
  }

  /** the impedance test button, pressed (true) or released (false) */
  impedanceButton(down: boolean) {
    if (!this.on || this.booting) return;
    if (this.flex) { if (down) this.flex = null; return; }   // locks in and leaves FlexDial mode
    if (down) { this.testing = true; this.testAt = this.t; this.emit({ type: 'impedance-test' }); return; }
    if (!this.testing) return;
    this.testing = false;
    if (this.t - this.testAt >= 1) this.lastStatic = Math.min(this.staticOhm, ECT.staticHigh);
    /* releasing the button starts the baseline EEG collection */
    this.baseline = 'collecting'; this.baselineAt = this.t; this.emit({ type: 'baseline-start' });
  }

  startStop() {
    if (!this.on || this.booting) return;
    if (this.flex) { this.flex = null; this.emit({ type: 'settings-printed' }); return; }
    if (this.printing) {
      this.printing = false; this.emit({ type: 'printer', running: false });
      if (this.stimulusEnd != null) { this.reportFlashUntil = this.t + 3; this.emit({ type: 'report' }); this.stimulusEnd = null; }
      return;
    }
    this.printing = true; this.emit({ type: 'printer', running: true });
  }

  /** the treatment button, pressed (true) or released (false) */
  treatButton(down: boolean) {
    if (!this.on || this.booting) return;
    if (down) {
      if (this.treat !== 'idle' && this.treat !== 'done') return;
      const s = this.stimulusNow;
      if (!s || this.settings.program === 'INTERMIT') return;
      this.active = s; this.treat = 'warning'; this.treatAt = this.t;
      if (this.printing) { this.printing = false; this.emit({ type: 'printer', running: false }); }
      return;
    }
    if (this.treat === 'warning') { this.treat = 'idle'; this.active = null; return; }
    if (this.treat === 'delivering') { this.finishStimulus(true); }
  }
  private finishStimulus(early: boolean) {
    this.treat = 'done';
    this.stimulusEnd = this.t;
    this.emit({ type: 'stimulus-stop', early });
    this.printing = true; this.emit({ type: 'printer', running: true });
  }
  /** what the station reports was actually given, after a stimulus stops */
  setDelivered(s: Stimulus) { this.delivered = s; }

  /** advance the device's clock */
  tick(dt: number) {
    const before = this.t;
    this.t += dt;
    if (!this.on) return;
    if (before - this.bootAt < 5 && this.t - this.bootAt >= 5) this.emit({ type: 'selftest-printed' });
    if (this.baseline === 'collecting' && this.t - this.baselineAt >= ECT.baselineSeconds) { this.baseline = 'ready'; this.emit({ type: 'ready' }); }
    if (this.treat === 'warning') {
      const tone = this.staticOhm >= ECT.staticHigh ? 3 * ECT.warningTone : ECT.warningTone;
      if (this.t - this.treatAt >= tone) { this.treat = 'delivering'; this.treatAt = this.t; this.emit({ type: 'stimulus-start', stimulus: this.active! }); }
    } else if (this.treat === 'delivering' && this.active && this.t - this.treatAt >= this.active.duration) this.finishStimulus(false);
  }

  get tone(): Tone { return this.treat === 'warning' ? 'warning' : this.treat === 'delivering' ? 'delivering' : 'none'; }

  /* ---- displays ---------------------------------------------------------------------------- */

  /** the 8-character display */
  get left(): string {
    if (!this.on) return '';
    const since = this.t - this.bootAt;
    if (since < 2) return '*#*#*#*#';
    if (since < 5) return 'SELFTEST';
    if (this.t < this.reportFlashUntil) return 'REPORT';
    if (this.flex) {
      const fn = FLEX_FUNCTIONS[this.flex.fn];
      return this.flex.option == null ? fn : this.options(fn)[this.flex.option];
    }
    if (this.testing) {
      if (this.t - this.testAt < 1) return 'TESTING';
      return String(Math.round(Math.min(this.staticOhm, ECT.staticHigh)));
    }
    if (this.treat === 'delivering' || this.treat === 'warning') return '';
    if (this.stimulusEnd != null) return String(Math.floor(this.t - this.stimulusEnd));
    if (this.baseline === 'none') return 'NO BASE';
    if (this.baseline === 'collecting') return 'BASELINE';
    return 'READY';
  }
  /** whether the left display flashes (an impedance of 3000 or more, FlexDial options) */
  get leftFlashes() { return (this.testing && this.t - this.testAt >= 1 && this.staticOhm >= ECT.staticHigh) || (!!this.flex && this.flex.option != null) || this.t < this.reportFlashUntil || (this.on && this.t - this.bootAt < 5); }

  /** the 4-character display */
  get right(): string {
    if (!this.on || this.booting) return '';
    /* pressed, PERCENT ENERGY shows the program; with doses up to 200 % (2X, where CE rules allow: the manual, Addendum VII)
       the usual 0.5 ms program shows as "2x" (the owner's hospital's check of the settings) */
    if (this.percentPressed) return this.settings.maxPercent === 200 && this.settings.program === 'LOW_05' ? '2x' : this.programName().replace('LOW ', 'L').slice(0, 4);
    const s = this.stimulusNow;
    if (!s) return '>8 S';
    if (this.t < this.chargeShownUntil) return String(Math.round(CHARGE_MC[this.settings.percentIndex]));
    return String(this.percent);
  }

  get lights() {
    return {
      flexDial: !!this.flex,
      safety: false,
      preset: this.on && this.settings.program === 'LOW_05',
      userSet: this.on && this.settings.program === 'USER',
    };
  }
}
