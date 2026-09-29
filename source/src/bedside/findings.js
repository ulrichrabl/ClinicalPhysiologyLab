/* ---------------------------------------------------------------------------
   Bedside findings.

   Everything a clinician can see, feel or hear at the bedside, derived from
   the live model rather than written into a case. Every finding carries a
   `basis`: the model quantity it came from, so the learner can always ask
   "why is the JVP up?" and get a number, not an assertion.

   Two kinds of derivation, and they are labelled differently:
     model      read directly off the circulation, chemistry or nervous system
     heuristic  a bedside rule applied to model quantities where there is no
                underlying model (there is no lung model, so respiratory rate
                and SpO₂ are estimated from left atrial pressure, lactate and
                sympathetic drive)

   Pure functions of a context object. No DOM, no time, no randomness.
--------------------------------------------------------------------------- */

const r0 = (x) => Math.round(x);
const r1 = (x) => Math.round(x * 10) / 10;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const f = (text, basis, { abnormal = false, kind = 'model', key = null } = {}) =>
  ({ text, basis, abnormal, kind, key });

/** Normalise a raw circulation snapshot + chemistry + persona into one bag. */
export function makeContext({ snap, chem = {}, persona = {}, cordLevel = null, pathology = null }) {
  const m = snap?.metrics || {};
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const ctx = {
    HR: num(snap?.HR, 72),
    Psys: num(m.Psys, 115), Pdia: num(m.Pdia, 75), Pmean: num(m.Pmean, 95),
    SV: num(m.SV, 70), CO: num(m.CO, 5), EF: num(m.EF, 57),
    EDV: num(m.EDV, 120), ESV: num(m.ESV, 50),
    CVP: num(m.CVPmean, num(snap?.CVP, 4)), LAP: num(m.PlaMean, 7),
    PpaSys: num(m.PpaSys, 22), SVR: num(m.SVR, 1200),
    gradient: num(m.aorticGradient, 0), rf: num(m.regurgFraction, 0),
    Raortic: num(snap?.Raortic, 0.02), Rmitral: num(snap?.Rmitral, 0.01),
    regAortic: num(snap?.regAortic, 0), regMitral: num(snap?.regMitral, 0),
    regTricuspid: num(snap?.regTricuspid, 0),
    sympathetic: num(snap?.sympathetic, 0.5),
    pathology: pathology || snap?.pathology || 'normal',
    lactate: num(chem.lactate, 1), Hb: num(chem.haemoglobin, 150), K: num(chem.potassium, 4),
    temp: num(persona.temp, 36.8),
    cordLevel: cordLevel || null,
    persona,
  };
  ctx.PP = ctx.Psys - ctx.Pdia;
  ctx.cervicalCord = !!ctx.cordLevel && /^C/.test(ctx.cordLevel);
  /* Loss of sympathetic tone: a cord lesion at or above T6 cuts the thoracolumbar outflow. */
  ctx.lossOfTone = !!ctx.cordLevel && /^(C\d|T[1-6])$/.test(ctx.cordLevel);
  ctx.MR = ctx.regMitral >= 0.1;
  ctx.AR = ctx.regAortic >= 0.1;
  ctx.AS = ctx.gradient >= 25;
  ctx.MS = ctx.Rmitral >= 0.04;
  ctx.TR = ctx.regTricuspid >= 0.1;
  ctx.irregular = ['af', 'aflutter'].includes(ctx.pathology);
  ctx.dropped = ['wenckebach', 'mobitz2'].includes(ctx.pathology);
  ctx.atrialKick = !['af', 'aflutter', 'vt', 'vf', 'chb'].includes(ctx.pathology);
  ctx.RR = respiratoryRate(ctx);
  ctx.SpO2 = oxygenSaturation(ctx);
  ctx.CRT = capillaryRefill(ctx);
  ctx.JVPcm = r1(ctx.CVP * 1.36 - 5);  // cm above the sternal angle at 45°
  return ctx;
}

/* ---- heuristics (no lung model) ------------------------------------------ */
export function respiratoryRate(c) {
  if (c.cervicalCord) return 24;  // diaphragm only: fast and shallow
  const rr = 14 + Math.max(0, c.LAP - 18) * 0.9 + Math.max(0, c.lactate - 2) * 2
    + (c.sympathetic > 0.75 ? 3 : 0) + (c.persona.rrExtra || 0);
  return r0(clamp(rr, 10, 40));
}

export function oxygenSaturation(c) {
  const s = 98 - Math.max(0, c.LAP - 20) * 0.9 - (c.cervicalCord ? 2 : 0) - (c.persona.spo2Drop || 0);
  return r0(clamp(s, 75, 99));
}

export function capillaryRefill(c) {
  if (c.lossOfTone) return 2;
  const crt = 1.5 + Math.max(0, 4 - c.CO) * 1.1 + Math.max(0, c.sympathetic - 0.7) * 5;
  return Math.round(clamp(crt, 1, 7) * 2) / 2;
}

/* ---- observations -------------------------------------------------------- */
export function observations(c) {
  const bpS = Math.round(c.Psys / 2) * 2;
  const bpD = Math.round(c.Pdia / 2) * 2;
  return [
    f(`Heart rate ${r0(c.HR)}/min`, `Model heart rate ${r0(c.HR)}/min`, { abnormal: c.HR < 55 || c.HR > 100, key: 'obs.hr' }),
    f(`Blood pressure ${bpS}/${bpD} mmHg`, `Arterial pressure ${r0(c.Psys)}/${r0(c.Pdia)}, mean ${r0(c.Pmean)} mmHg`,
      { abnormal: c.Psys < 95 || c.Pmean < 65, key: 'obs.bp' }),
    f(`Respiratory rate ${c.RR}/min`, 'Estimated from left atrial pressure, lactate and sympathetic drive (no lung model)',
      { abnormal: c.RR > 20 || c.RR < 11, kind: 'heuristic', key: 'obs.rr' }),
    f(`SpO₂ ${c.SpO2}% on air`, 'Estimated from left atrial pressure (pulmonary congestion)',
      { abnormal: c.SpO2 < 94, kind: 'heuristic', key: 'obs.spo2' }),
    f(`Temperature ${c.temp.toFixed(1)} °C`, 'From the case', { abnormal: c.temp >= 38 || c.temp < 35.5, kind: 'case' }),
  ];
}

/* ---- general inspection -------------------------------------------------- */
export function consciousness(c) {
  if (c.Pmean < 40) return { level: 'responds to pain', talk: 'none' };
  if (c.Pmean < 52) return { level: 'drowsy, responds to voice', talk: 'drowsy' };
  return { level: 'alert', talk: 'normal' };
}

export function appearance(c) {
  const out = [];
  const cs = consciousness(c);
  out.push(f(`${cs.level === 'alert' ? 'Alert and orientated' : cs.level[0].toUpperCase() + cs.level.slice(1)}.`,
    `Mean arterial pressure ${r0(c.Pmean)} mmHg`, { abnormal: cs.level !== 'alert', key: 'look.conscious' }));
  if (!c.cervicalCord && (c.RR > 22 || c.LAP > 22)) {
    out.push(f(`Breathless at rest, sitting upright, ${c.RR} breaths/min.`,
      `Left atrial pressure ${r0(c.LAP)} mmHg drives interstitial lung water`, { abnormal: true, kind: 'heuristic', key: 'look.breathless' }));
  }
  if (c.cervicalCord) {
    out.push(f(`Lying flat on a spinal board. Shallow breathing at ${c.RR}/min with paradoxical movement: the abdomen rises as the chest sinks.`,
      `Cord lesion at ${c.cordLevel}: intercostals paralysed, diaphragm (C3–5) working alone`, { abnormal: true, key: 'look.paradox' }));
  }
  if (c.Hb < 105) {
    out.push(f('Pale conjunctivae and palmar creases.', `Haemoglobin ${r0(c.Hb)} g/L`, { abnormal: true, key: 'look.pallor' }));
  }
  if (!c.lossOfTone && c.sympathetic > 0.8) {
    out.push(f('Pale, grey and sweaty.', `Sympathetic drive ${Math.round(c.sympathetic * 100)}%: skin vasoconstriction and sweating`,
      { abnormal: true, key: 'look.clammy' }));
  } else if (c.lossOfTone) {
    out.push(f('Pink and warm-looking despite the low blood pressure.',
      'Sympathetic outflow interrupted: no skin vasoconstriction, no sweating', { abnormal: true, key: 'look.warm' }));
  }
  if (c.SpO2 < 88) out.push(f('Central cyanosis of the lips and tongue.', `SpO₂ ${c.SpO2}%`, { abnormal: true, kind: 'heuristic' }));
  if (c.AR && c.PP > 60) {
    out.push(f('Visible carotid pulsation in the neck (Corrigan’s sign).', `Pulse pressure ${r0(c.PP)} mmHg with regurgitant fraction ${Math.round(c.rf * 100)}%`,
      { abnormal: true, key: 'look.corrigan' }));
  }
  if (out.length === 1) out.push(f('Comfortable at rest. Normal colour.', 'No haemodynamic stress in the model'));
  return out;
}

export function jvp(c) {
  const h = c.JVPcm;
  const basis = `CVP ${r1(c.CVP)} mmHg ≈ ${r1(c.CVP * 1.36)} cmH₂O above the right atrium, which lies about 5 cm below the sternal angle`;
  const vwave = c.TR ? ' Large systolic v waves; the earlobes may move.' : '';
  if (h <= -2.5) return f('Neck veins flat, not visible even with the patient lying flat.', basis, { abnormal: true, key: 'look.jvp.low' });
  if (h <= 3) return f(`JVP not raised: ${h <= 0 ? 'just visible above the clavicle' : `${r0(Math.max(1, h))} cm above the sternal angle`} at 45°.${vwave}`, basis, { key: 'look.jvp' });
  return f(`JVP raised, ${r0(h)} cm above the sternal angle at 45°.${vwave}`, basis, { abnormal: true, key: 'look.jvp.high' });
}

/* ---- palpation ------------------------------------------------------------ */
export function pulse(c, site = 'radial') {
  const rate = `${r0(c.HR)}/min`;
  let rhythm = 'regular';
  if (c.irregular) rhythm = 'irregularly irregular';
  else if (c.dropped) rhythm = 'regularly irregular, with dropped beats';
  let character = 'normal volume and character';
  let basis = `Pulse pressure ${r0(c.PP)} mmHg, stroke volume ${r0(c.SV)} mL`;
  let abnormal = false;
  let key = `feel.pulse.${site}`;
  if (c.AS && c.gradient >= 50) {
    character = site === 'carotid' ? 'slow-rising, low-volume (plateau) pulse' : 'small volume, slow upstroke';
    basis = `Peak LV–aortic gradient ${r0(c.gradient)} mmHg delays and blunts the upstroke`;
    abnormal = true; key = 'feel.pulse.slowrising';
  } else if (c.AR && c.PP >= 55) {
    character = 'large volume, collapsing (water-hammer), more obvious with the arm raised';
    basis = `Diastolic pressure ${r0(c.Pdia)} mmHg falls as blood leaks back; pulse pressure ${r0(c.PP)} mmHg`;
    abnormal = true; key = 'feel.pulse.collapsing';
  } else if (c.PP < 25 || c.SV < 35) {
    character = 'weak and thready';
    abnormal = true; key = 'feel.pulse.thready';
  } else if (c.PP > 65) {
    character = 'bounding'; abnormal = true;
  }
  if (site === 'radial' && c.Psys < 75) {
    return f(`Radial pulse barely palpable. Rate about ${rate}, ${rhythm}.`, `Systolic pressure ${r0(c.Psys)} mmHg`, { abnormal: true, key: 'feel.pulse.thready' });
  }
  const slowFast = c.HR > 100 ? ' Tachycardic.' : c.HR < 55 ? ' Bradycardic.' : '';
  return f(`${site === 'carotid' ? 'Carotid' : 'Radial'} pulse ${rate}, ${rhythm}; ${character}.${slowFast}`, basis,
    { abnormal: abnormal || c.HR > 100 || c.HR < 55 || c.irregular || c.dropped, key });
}

export function peripheries(c) {
  if (c.lossOfTone) {
    return f(`Hands warm and dry, veins well filled. Capillary refill ${c.CRT} s.`,
      'No sympathetic vasoconstriction below the cord lesion', { abnormal: true, key: 'feel.warm' });
  }
  if (c.CRT >= 3) {
    return f(`Hands cool and clammy. Capillary refill ${c.CRT} s.`,
      `Cardiac output ${r1(c.CO)} L/min with sympathetic drive ${Math.round(c.sympathetic * 100)}%`, { abnormal: true, kind: 'heuristic', key: 'feel.cool' });
  }
  return f(`Hands warm, capillary refill ${c.CRT} s.`, `Cardiac output ${r1(c.CO)} L/min`, { kind: 'heuristic', key: 'feel.periph' });
}

export function apex(c) {
  let where = 'fifth intercostal space, mid-clavicular line';
  let character = 'normal, tapping';
  let abnormal = false;
  const basis = [`End-diastolic volume ${r0(c.EDV)} mL`];
  if (c.EDV > 170) { where = 'displaced to the sixth intercostal space, anterior axillary line'; abnormal = true; }
  else if (c.EDV > 145) { where = 'slightly displaced, just lateral to the mid-clavicular line'; abnormal = true; }
  if (c.AS && c.gradient >= 50) { character = 'heaving and sustained (pressure-loaded)'; abnormal = true; basis.push(`gradient ${r0(c.gradient)} mmHg`); }
  else if ((c.MR || c.AR) && c.rf > 0.25) { character = 'thrusting and hyperdynamic (volume-loaded)'; abnormal = true; basis.push(`regurgitant fraction ${Math.round(c.rf * 100)}%`); }
  else if (c.EF < 40) { character = 'diffuse and poorly localised'; abnormal = true; basis.push(`ejection fraction ${r0(c.EF)}%`); }
  const thrill = c.AS && c.gradient >= 70 ? ' A systolic thrill is palpable at the upper right sternal edge.' : '';
  const heave = c.PpaSys > 45 ? ' Left parasternal heave.' : '';
  return f(`Apex beat ${where}; ${character}.${thrill}${heave}`, basis.join(', '), { abnormal, key: abnormal ? 'feel.apex.abnormal' : 'feel.apex' });
}

export function abdomen(c) {
  const out = [];
  const tender = c.persona.abdomen?.tender;
  out.push(f(tender ? `Soft; ${tender}.` : 'Soft, non-tender, no masses.', 'Case finding', { kind: 'case', abnormal: !!tender, key: tender ? 'feel.abdo.tender' : null }));
  if (c.CVP > 9) {
    out.push(f(`Liver edge palpable ${c.CVP > 13 ? '4' : '2'} cm below the costal margin, smooth and slightly tender. Pressing on it raises the JVP (hepatojugular reflux).`,
      `CVP ${r1(c.CVP)} mmHg congests the liver`, { abnormal: true, key: 'feel.liver' }));
  }
  if (c.cervicalCord) {
    out.push(f('Bladder palpable, dull to the umbilicus. The patient does not feel your hand below the upper chest.',
      `Cord lesion at ${c.cordLevel}: acute urinary retention and a sensory level`, { abnormal: true, key: 'feel.bladder' }));
  }
  return out;
}

export function oedema(c) {
  const chronic = c.persona.chronicCongestion;
  if (chronic || c.CVP > 10) {
    return f(`Pitting oedema to ${c.CVP > 12 ? 'the knees' : 'mid-shin'} on both sides, and over the sacrum.`,
      `CVP ${r1(c.CVP)} mmHg${chronic ? ' sustained over weeks' : ''}`, { abnormal: true, key: 'feel.oedema' });
  }
  return f('No ankle or sacral oedema.', `CVP ${r1(c.CVP)} mmHg`, { key: 'feel.oedema.none' });
}

/* ---- auscultation ---------------------------------------------------------
   Each murmur knows where it is loudest. `where` is 0–1 per area. */
export function murmurs(c) {
  const list = [];
  const lowOutput = c.CO < 3 ? 1 : 0;
  if (c.AS) {
    const grade = clamp(r0(c.gradient / 30) + 1 - lowOutput, 1, 4);
    list.push({ id: 'as', phase: 'systole', grade,
      text: `Grade ${grade}/6 ejection systolic murmur, crescendo–decrescendo${c.gradient > 60 ? ', peaking late' : ''}`,
      where: { aortic: 1, carotid: 0.9, mitral: 0.55, pulmonary: 0.5, tricuspid: 0.35 },
      basis: `Peak gradient ${r0(c.gradient)} mmHg across the aortic valve, flow ${r1(c.CO)} L/min` });
  }
  if (c.MR) {
    const grade = clamp(r0(c.rf * 9) + 1, 1, 4);
    list.push({ id: 'mr', phase: 'systole', grade,
      text: `Grade ${grade}/6 pansystolic murmur, blowing, radiating to the axilla`,
      where: { mitral: 1, axilla: 0.8, tricuspid: 0.45, aortic: 0.2, pulmonary: 0.2 },
      basis: `Mitral regurgitant flow; regurgitant fraction ${Math.round(c.rf * 100)}%` });
  }
  if (c.AR) {
    const grade = clamp(r0(c.regAortic * 4) + 1, 1, 4);
    list.push({ id: 'ar', phase: 'diastole', grade,
      text: `Grade ${grade}/6 early diastolic murmur, high-pitched and decrescendo; loudest at the left sternal edge with the patient sitting forward in expiration`,
      where: { tricuspid: 0.9, aortic: 0.7, pulmonary: 0.6, mitral: 0.35 },
      basis: `Diastolic backflow across the aortic valve; diastolic pressure ${r0(c.Pdia)} mmHg` });
  }
  if (c.MS) {
    list.push({ id: 'ms', phase: 'diastole', grade: 2,
      text: 'Low-pitched mid-diastolic rumble at the apex after an opening snap, loudest in the left lateral position',
      where: { mitral: 1, tricuspid: 0.3 }, basis: 'Raised mitral valve resistance' });
  }
  if (c.TR) {
    list.push({ id: 'tr', phase: 'systole', grade: 2,
      text: 'Grade 2/6 pansystolic murmur at the lower left sternal edge, louder on inspiration',
      where: { tricuspid: 1, mitral: 0.3, pulmonary: 0.2 }, basis: 'Tricuspid regurgitation' });
  }
  if (!list.length && c.CO > 7) {
    list.push({ id: 'flow', phase: 'systole', grade: 1, text: 'Soft grade 1/6 ejection systolic flow murmur',
      where: { pulmonary: 1, aortic: 0.7, tricuspid: 0.4 }, basis: `High cardiac output ${r1(c.CO)} L/min` });
  }
  return list;
}

export function extraSounds(c) {
  return {
    /* Heuristic: rapid filling into a dilated, high-pressure ventricle. */
    s3: (c.EDV > 165 && c.LAP > 18) || (c.rf > 0.3 && c.EDV > 150),
    /* Heuristic: atrial kick into a stiff, pressure-loaded ventricle; absent without atrial contraction. */
    s4: c.atrialKick && c.AS && c.gradient >= 50,
    softS1: c.EF < 35,
    softA2: c.AS && c.gradient >= 60,
    loudP2: c.PpaSys > 40,
  };
}

export function heart(c, area, { manoeuvre = null } = {}) {
  const x = extraSounds(c);
  const parts = [];
  const s1 = x.softS1 ? 'soft S1' : c.MS ? 'loud S1' : 'S1';
  const s2 = area === 'aortic' && x.softA2 ? 'soft, single S2' : area === 'pulmonary' && x.loudP2 ? 'loud P2' : 'S2';
  parts.push(`${s1[0].toUpperCase()}${s1.slice(1)} and ${s2} heard`);
  if (x.s3 && (area === 'mitral' || area === 'tricuspid')) parts.push('a third heart sound (gallop rhythm)');
  if (x.s4 && area === 'mitral') parts.push('a fourth heart sound just before S1');
  const ms = murmurs(c)
    .map((mm) => {
      let w = mm.where[area] || 0;
      if (mm.id === 'ar' && manoeuvre === 'sit-forward') w = Math.min(1, w + 0.35);
      if (mm.id === 'ms' && manoeuvre === 'left-lateral') w = Math.min(1, w + 0.3);
      if (mm.id === 'tr' && manoeuvre === 'inspire') w = Math.min(1, w + 0.3);
      return { ...mm, w };
    })
    .filter((mm) => mm.w >= 0.3);
  let text = parts.join(', plus ');
  if (ms.length) text += '. ' + ms.map((mm) => (mm.w >= 0.8 ? mm.text : `${mm.text.replace(/^Grade \d\/6 /, 'Softer ')} (loudest elsewhere)`)).join('. ');
  else text += '. No murmurs.';
  const basis = [
    x.s3 ? `S3: EDV ${r0(c.EDV)} mL, LAP ${r0(c.LAP)} mmHg (heuristic)` : null,
    ...ms.map((mm) => mm.basis),
    x.softA2 && area === 'aortic' ? 'Stiff, calcified valve closes quietly' : null,
  ].filter(Boolean).join('; ') || 'Valve events from the model';
  const abnormal = ms.length > 0 || (x.s3 && area === 'mitral') || x.s4 || (x.softA2 && area === 'aortic');
  return { ...f(`${text}${text.endsWith('.') ? '' : '.'}`, basis, { abnormal, key: abnormal ? `listen.heart.${area}` : null }),
    sound: { murmurs: ms, extras: x } };
}

export function carotidAuscultation(c) {
  const as = murmurs(c).find((m) => m.id === 'as');
  return as
    ? f('The ejection systolic murmur radiates here.', as.basis, { abnormal: true, key: 'listen.carotid' })
    : f('No bruit.', 'No outflow turbulence in the model');
}

export function lungs(c, side = 'R') {
  if (c.cervicalCord) {
    return f('Quiet breath sounds with poor expansion; weak cough.', `Cord lesion at ${c.cordLevel}: diaphragm-only breathing`, { abnormal: true, key: 'listen.lungs.weak' });
  }
  if (c.LAP > 25) {
    return f(`Fine inspiratory crackles from the ${side === 'R' ? 'right' : 'left'} base to the mid-zone.`,
      `Left atrial pressure ${r0(c.LAP)} mmHg exceeds the oncotic threshold: alveolar oedema`, { abnormal: true, key: 'listen.crackles' });
  }
  if (c.LAP > 18) {
    return f(`Fine end-inspiratory crackles at the ${side === 'R' ? 'right' : 'left'} base.`,
      `Left atrial pressure ${r0(c.LAP)} mmHg: interstitial oedema`, { abnormal: true, key: 'listen.crackles' });
  }
  return f('Vesicular breath sounds, no added sounds.', `Left atrial pressure ${r0(c.LAP)} mmHg`);
}

export function percussion(c) {
  if (c.LAP > 24 && c.CVP > 8) {
    return f('Dull to percussion at the right base, with reduced breath sounds: a small effusion.',
      'Raised systemic and pulmonary venous pressure together', { abnormal: true, kind: 'heuristic', key: 'percuss.dull' });
  }
  return f('Resonant throughout.', 'No effusion expected at these venous pressures');
}

/* ---- neurological: delegate to the nervous-system graph ------------------ */
export function neuroTest(test, neuro, { spinalShock = false } = {}) {
  const hits = (neuro?.findings || []).filter((x) => { try { return test.match(x); } catch { return false; } });
  if (!hits.length) {
    const spared = (neuro?.spared || []).find((x) => { try { return test.match(x); } catch { return false; } });
    return f(spared ? `${test.normal} (Spared: ${spared.reason}.)` : test.normal,
      spared ? 'Pathway involved but redundantly supplied' : 'Pathway intact in the nervous-system model');
  }
  let text = [...new Set(hits.map((x) => x.deficit))].join(' ');
  /* In the first days after an acute cord injury, the segments below the
     lesion are flaccid and areflexic ("spinal shock"). Spasticity and
     hyperreflexia come later. The graph models the chronic state. */
  if (spinalShock && hits.some((x) => x.umnOrLmn === 'UMN')) {
    text = text
      .replace(/Tone spastic, clasp-knife\./g, 'Tone flaccid.')
      .replace(/Reflexes 3\+ with clonus\./g, 'Reflexes absent.')
      .replace(/Babinski upgoing\./g, 'Plantars mute.')
      + ' (Spinal shock: upper motor neuron signs appear after days to weeks.)';
  }
  return f(text, hits.map((x) => x.pathway).slice(0, 3).join('; ') + (hits.length > 3 ? '…' : ''),
    { abnormal: true, key: `neuro.${test.id}` });
}
