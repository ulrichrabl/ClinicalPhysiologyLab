import { defineConstants } from './constants.ts';

/* Thresholds at which examination finds what the models produce (models/*-exam.ts): the point at which a sign
   becomes visible, palpable or audible. Many signs are unreliable in real practice; the model reports a sign
   deterministically once its cause passes the threshold, and the threshold is placed where the evidence says the
   sign usually appears. Thresholds not listed here are heuristics described where they are used. */

export const EXAM = defineConstants('exam', {
  msAudibleGradient: { value: 3, unit: 'mmHg', status: 'assumed', refs: ['bonow2006'], means: 'Mean diastolic gradient across a narrowed mitral valve at which its opening snap, loud S1 and rumble are heard.',
    derivation: 'Placed just above what a normal valve gives (the model’s healthy heart: 1.75 mmHg) and below the 5 mmHg at which Bonow grades stenosis moderate. No study of audibility against the gradient was found; the sounds of mild stenosis are often present, but faint and short.' },
  msModerateGradient: { value: 5, unit: 'mmHg', status: 'derived', refs: ['bonow2006'], means: 'Mean mitral gradient from which the rumble is graded louder (moderate stenosis).',
    derivation: 'Bonow 2006: mild stenosis below 5 mmHg, moderate 5–10, severe above 10. The rumble’s loudness tracks severity only loosely; its length tracks it better.' },
  msSevereGradient: { value: 10, unit: 'mmHg', status: 'derived', refs: ['bonow2006'], means: 'Mean mitral gradient above which stenosis is severe.', derivation: 'Bonow 2006.' },
  icterusMild: { value: 40, unit: 'µmol/L', status: 'assumed', refs: ['hung2000'], means: 'Bilirubin at which scleral icterus becomes visible.',
    derivation: 'The classical 2.5–3 mg/dL (43–51 µmol/L), slightly lower; physicians detect jaundice with sensitivity and specificity of only about 70 % (Hung).' },
  icterusMarked: { value: 85, unit: 'µmol/L', status: 'ungrounded', means: 'Bilirubin at which jaundice is obvious.' },
  pallorMild: { value: 100, unit: 'g/L', status: 'assumed', refs: ['sheth1997'], means: 'Haemoglobin below which the conjunctivae look pale.',
    derivation: 'Conjunctival pallor has a likelihood ratio of 4.5 for haemoglobin ≤ 90 g/L and borderline pallor 1.8 (Sheth); the sign begins in the 90s.' },
  pallorMarked: { value: 70, unit: 'g/L', status: 'derived', refs: ['kalantri2010'], means: 'Haemoglobin below which pallor is marked.',
    derivation: 'Below 7 g/dL severe (tongue) pallor had a likelihood ratio of 9.9 and its absence ruled anaemia that severe out (Kalantri).' },
  cyanosis: { value: 40, unit: 'g/L capillary deoxy-Hb', status: 'derived', refs: ['lundsgaard1923', 'comroe1947'], means: 'Deoxygenated haemoglobin in capillary blood at which central cyanosis is seen.',
    derivation: 'Lundsgaard and Van Slyke placed cyanosis at about 50 g/L of reduced haemoglobin in capillary blood; observers in Comroe and Botelho’s study first saw it at arterial saturations of about 80–85 %, which at a normal haemoglobin and venous saturation is about 40–45 g/L capillary deoxy-Hb.' },
  crtNormalMan: { value: 1.0, unit: 's', status: 'measured', refs: ['schriger1988'], means: 'Capillary refill of a healthy adult man.', derivation: 'Schriger & Baraff: median 1.0 s in adult men.' },
  crtNormalWoman: { value: 1.2, unit: 's', status: 'measured', refs: ['schriger1988'], means: 'Capillary refill of a healthy adult woman.', derivation: 'Schriger & Baraff: median 1.2 s in adult women.' },
  crtNormalOld: { value: 1.6, unit: 's', status: 'measured', refs: ['schriger1988'], means: 'Capillary refill of a healthy person over 65.', derivation: 'Schriger & Baraff: median 1.5 s in elderly women and 1.8 s in elderly men.' },
  crtShock: { value: 3.5, unit: 's', status: 'ungrounded', means: 'Capillary refill at a mean pressure below 65 with constricted skin vessels.' },
  crtProfound: { value: 5, unit: 's', status: 'ungrounded', means: 'Capillary refill at a mean pressure below 50.' },
  orthostaticHrBase: { value: 10, unit: '/min', status: 'assumed', refs: ['mcgee1999'], means: 'Rise in heart rate on standing in a healthy, normovolaemic person.',
    derivation: 'Healthy people rarely gain 30 /min on standing (specificity 98 %, McGee); about 10 /min is the usual rise.' },
  orthostaticHrPerDeficit: { value: 167, unit: '/min per fraction of blood volume lost', status: 'derived', refs: ['mcgee1999'], means: 'Extra rise in heart rate on standing per fraction of blood volume lost.',
    derivation: 'McGee: a postural rise of 30 /min or more after 630–1150 mL of blood loss in 97 %, after 450–630 mL in only 22 %. The threshold of 30 is then crossed at about 12 % of the blood volume, between the two: (30 − 10)/0.12 = 167. The old slope of 250 crossed it at 8 %, after a moderate loss.' },
  jvpSternalOffset: { value: 5, unit: 'cm', status: 'assumed', means: 'Height of the sternal angle above the right atrium (JVP is measured from it).', derivation: 'The textbook 5 cm, at any position of the trunk.' },
  oedemaAnkle: { value: 2.5, unit: 'L of interstitial fluid', status: 'assumed', means: 'Interstitial fluid gained before oedema pits at the ankle (scaled to a 70 kg adult).', derivation: 'The textbook 2–3 L (about 10 % of body weight in fluid before oedema is seen is an overstatement; 2–3 L is the usual figure).' },
  ascitesFlank: { value: 0.8, unit: 'L', status: 'ungrounded', means: 'Ascites at which flank dullness appears.' },
  ascitesShifting: { value: 1.5, unit: 'L', status: 'assumed', refs: ['cattau1982'], means: 'Ascites at which shifting dullness appears.', derivation: 'The textbook 1.5 L; examination for small amounts is unreliable, and only absent flank dullness rules ascites out (Cattau).' },
  feverFlush: { value: 38.3, unit: '°C', status: 'assumed', means: 'Temperature above which the skin is flushed and sweating.', derivation: 'The usual clinical definition of fever, 38.3 °C.' },
  sgPerOsm: { value: 0.000033, unit: 'per mosmol/kg', status: 'assumed', means: 'Urine specific gravity above water per mosmol/kg (SG 1.010 at about 300 mosmol/kg).', derivation: 'The textbook relation of specific gravity to osmolality in urine without glucose or protein.' },
});
