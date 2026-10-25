/* ---------------------------------------------------------------------------
   What the patient says at the bedside, from the examination model's speech
   findings: the answer to "what happened?", a sentence to repeat, and counting
   to 50. Each kind of failure is shown as it sounds (a depiction of the
   finding, like the formatters' words, in English and German):

   * non-fluent (Broca): content words, few, with long pauses;
   * fluent with comprehension lost (Wernicke): fluent, grammatical, empty,
     with wrong words (paraphasias);
   * repetition alone lost (conduction): the answer fine, the repetition not;
   * dysarthric: the right words, slurred;
   * fatigable (the junction): counting fades and turns nasal.
--------------------------------------------------------------------------- */

export interface SpeechLine { who: 'examiner' | 'patient'; words: string[]; /** seconds per word */ pace: number; /** extra pause after each word, s */ pauses?: number[]; /** the voice fades from this word on (0 … 1 of the line) */ fadeFrom?: number }
export interface SpeechFindings { fluency?: string; comprehension?: string; repetition?: string; articulation?: string; fatigue?: string }

const W = (s: string) => s.split(' ');

export function speechScript(f: SpeechFindings, lang: 'en' | 'de'): SpeechLine[] {
  const de = lang === 'de';
  const out: SpeechLine[] = [];
  const nonFluent = f.fluency && f.fluency !== 'normal', lostComp = f.comprehension && f.comprehension !== 'normal';
  const slurred = f.articulation === 'dysarthric';
  out.push({ who: 'examiner', words: W(de ? 'Erzählen Sie mir, was passiert ist.' : 'Tell me what happened.'), pace: 0.22 });
  let answer: string, pace = 0.3, pauses: number[] | undefined;
  if (nonFluent) {
    answer = de ? 'Frühstück… Arm… schwer. Mann… Kranken… Krankenwagen.' : 'Breakfast… arm… heavy. Husband… ambu… ambulance.';
    pace = 0.55; pauses = W(answer).map(() => 0.7);
  } else if (lostComp) {
    answer = de ? 'Also ich hab das Frühstück gemacht, und dann ist der Arm auf den Tisch gegangen, und er hat den Kranker, den Krankler gerufen, mit dem Ding da.'
      : 'Well I was having the breakfast and then the arm went on the table, so he called the ambler, the ambling, to come round with the thing.';
    pace = 0.24;
  } else if (slurred) {
    answer = de ? 'Ich hab gefrühshtückt, da wurde mein rechter Arm shwer, und mein Mann hat den Krankenwag’n gerufen.' : 'I wath having breakfatht when my right arm went heavy, tho my huthband called the ambulanthe.';
    pace = 0.4;
  } else {
    answer = de ? 'Ich habe gefrühstückt, da wurde mein rechter Arm schwer, und mein Mann hat den Krankenwagen gerufen.' : 'I was having breakfast when my right arm went heavy, so my husband called the ambulance.';
  }
  out.push({ who: 'patient', words: W(answer), pace, pauses });
  out.push({ who: 'examiner', words: W(de ? 'Sprechen Sie nach: „Kein Wenn und Aber.“' : 'Say after me: “No ifs, ands or buts.”'), pace: 0.22 });
  const rep = f.repetition && f.repetition !== 'normal'
    ? (nonFluent ? (de ? 'Kein… Wenn…' : 'No… ifs…') : (de ? 'Kein Wenn… und… Ober.' : 'No ifs… ends… or bots.'))
    : slurred ? (de ? 'Kein Wenn und Aber.' : 'No ifth, andth or butth.') : (de ? 'Kein Wenn und Aber.' : 'No ifs, ands or buts.');
  out.push({ who: 'patient', words: W(rep), pace: nonFluent ? 0.55 : 0.32 });
  out.push({ who: 'examiner', words: W(de ? 'Zählen Sie bis fünfzig.' : 'Count to fifty.'), pace: 0.22 });
  const nums = de ? ['eins,', 'zwei,', 'drei,', '…', 'zehn,', '…', 'zwanzig,', '…', 'dreißig,', 'einunddreißig,', '…', 'vierzig,', '…', 'fünfzig.']
    : ['one,', 'two,', 'three,', '…', 'ten,', '…', 'twenty,', '…', 'thirty,', 'thirty-one,', '…', 'forty,', '…', 'fifty.'];
  if (f.fatigue === 'fading-nasal') {
    const nasal = de ? ['vierzig,', 'fünfzig.'] : ['forddy,', 'fiddy.'];
    out.push({ who: 'patient', words: [...nums.slice(0, 11), nasal[0], '…', nasal[1]], pace: 0.4, fadeFrom: 0.55 });
  } else out.push({ who: 'patient', words: nums, pace: 0.4 });
  return out;
}
