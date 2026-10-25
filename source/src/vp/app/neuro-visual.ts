import type { ExamContext, Side } from '../model/types.ts';
import type { NeuroTest } from '../stations/neuro-tests.ts';
import type { NeuroMotion } from './neuro-motion-view.ts';
import type { ReflexGrade } from '../render/neuro-motion.ts';
import { powerChartSvg } from '../render/power-chart.ts';
import { sensoryChartSvg, sensoryInputFrom } from '../render/sensory-chart.ts';

/* ---------------------------------------------------------------------------
   What the neurological station and the ward show for a test: the figure
   doing it (a motion) or a chart (power, sensation), always from the
   examination model's findings, read through `read`.
--------------------------------------------------------------------------- */

export type NeuroReadFn = (ref: string, ctx?: ExamContext) => any;
const grade = (g: unknown): ReflexGrade => Math.max(0, Math.min(4, typeof g === 'number' ? g : 2)) as ReflexGrade;

/** The figure doing the test for this patient, or null when the test is shown by a chart or in words. */
export function neuroMotionFor(test: NeuroTest, read: NeuroReadFn, side: Side, eyesClosed = false): NeuroMotion | null {
  const S = side as 'L' | 'R';
  switch (test) {
    case 'drift': return { kind: 'drift', finding: { drift: [!!read('arm.drift.R', { eyesClosed: true })?.drift, !!read('arm.drift.L', { eyesClosed: true })?.drift] } };
    case 'finger-nose': return { kind: 'finger-nose', side: S, finding: read(`arm.finger-nose.${S}`, { eyesClosed }) ?? {}, eyesClosed };
    case 'heel-shin': return { kind: 'heel-shin', side: S, finding: read(`leg.heel-shin.${S}`, { eyesClosed }) ?? {}, eyesClosed };
    case 'rapid-alternating': return { kind: 'rapid-alternating', side: S, finding: read(`arm.rapid-alternating.${S}`) ?? {} };
    case 'romberg': return { kind: 'romberg', open: read('posture.romberg', { eyesClosed: false }) ?? { stance: 'steady' }, closed: read('posture.romberg', { eyesClosed: true }) ?? { stance: 'steady' } };
    case 'gait': return { kind: 'gait', finding: read('gait.pattern') ?? { pattern: 'normal' } };
    case 'leg-reflexes': { const r = read(`leg.reflexes.${S}`) ?? {}; return { kind: 'leg-reflexes', side: S, finding: { knee: grade(r.knee), ankle: grade(r.ankle), plantar: r.plantar === 'extensor' ? 'extensor' : 'flexor' } }; }
    case 'arm-reflexes': { const r = read(`arm.reflexes.${S}`) ?? {}; return { kind: 'arm-reflexes', side: S, finding: { biceps: grade(r.biceps), supinator: grade(r.supinator), triceps: grade(r.triceps) } }; }
    case 'tone': return { kind: 'tone', side: S, finding: { tone: read(`arm.tone.${S}`)?.tone ?? 'normal', restTremor: read(`arm.rest-tremor.${S}`)?.tremor === 'rest' } };
    default: return null;
  }
}

/** A chart for the tests whose finding is a map or a grid. */
export function neuroChartFor(test: NeuroTest, read: NeuroReadFn, lang: 'en' | 'de', colors: { fg: string; muted: string; line: string; abn: string; accent: string; surface: string }): string | null {
  if (test === 'power') {
    const p = (S: Side) => ({ arm: read(`arm.power.${S}`) ?? undefined, leg: read(`leg.power.${S}`) ?? undefined });
    const tired = (S: Side) => read(`arm.power.${S}`, { repetition: 20 }) ?? undefined;
    return powerChartSvg({ power: { R: p('R'), L: p('L') }, tired: { R: tired('R'), L: tired('L') } }, lang, colors);
  }
  if (test === 'sensation') return sensoryChartSvg(sensoryInputFrom((ref, ctx) => { const v = read(ref, ctx as ExamContext); return v === undefined ? undefined : { value: v }; }), lang, colors);
  return null;
}
