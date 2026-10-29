import type { LocalizedText } from '../model/i18n.ts';
import { electrodeLabel } from '../measurements/eeg-forward.ts';
import type { FieldReading } from '../measurements/eeg-montage.ts';
import type { Montage } from '../measurements/eeg-montage.ts';
import type { EegScene } from './eeg-presets.ts';

/* ---------------------------------------------------------------------------
   The EEG station's explanations, in English and German: the only authored
   part. Chosen by what the model's field does (how the source lies, where
   the reader finds the maximum and the reversal, whether the reference is
   quiet, whether the scalp sees the discharge at all). Drafts until a
   clinician has read them.
--------------------------------------------------------------------------- */

export interface EegText { title: LocalizedText; body: LocalizedText }
const L = (en: string, de: string): LocalizedText => ({ en, de });
const T = (title: LocalizedText, body: LocalizedText): EegText => ({ title, body });

/** A discharge too small for the scalp: below the lowest normal background (ACNS: under 20 µV is low voltage). */
export const SCALP_VISIBLE_UV = 20;

export interface EegContext {
  scene: EegScene;
  reading: FieldReading;
  montage: Montage;
  /** the reference's own potential at the peak, as a share of the largest electrode's (referential montages) */
  refShare: number | null;
  refName: string | null;
}

const list = (xs: string[], lang: 'en' | 'de') => {
  const n = xs.map(electrodeLabel);
  if (n.length <= 1) return n.join('');
  return `${n.slice(0, -1).join(', ')} ${lang === 'de' ? 'und' : 'and'} ${n[n.length - 1]}`;
};

export function explainEeg(c: EegContext): Array<{ title: LocalizedText; body: (lang: 'en' | 'de') => string }> {
  const out: Array<{ title: LocalizedText; body: (lang: 'en' | 'de') => string }> = [];
  const r = c.reading, p = c.scene.patch;
  const by = (en: string, de: string) => (lang: 'en' | 'de') => (lang === 'de' ? de : en);

  /* is it seen at all? */
  if (r.bipolarPeak < SCALP_VISIBLE_UV) {
    out.push({ title: L('Hardly seen on the scalp', 'Auf der Kopfhaut kaum zu sehen'), body: by(
      `The largest channel carries ${r.bipolarPeak.toFixed(0)} µV: less than a low-voltage background (under 20 µV), so it would be lost in a real recording. ${p.depth > 5 ? 'The source is deep: its field falls off with distance, and the skull smears what reaches it.' : 'The patch is small: its dipoles are few.'} In patients, spikes from less than about 6 cm² of cortex were never seen on the scalp, and those over 10 cm² usually were (Tao 2005); discharges confined to the hippocampus give no scalp rhythm (Pacia & Ebersole 1997).`,
      `Der größte Kanal trägt ${r.bipolarPeak.toFixed(0)} µV: weniger als ein niedrigamplitudiger Grundrhythmus (unter 20 µV), in einer echten Ableitung ginge er unter. ${p.depth > 5 ? 'Die Quelle liegt tief: Ihr Feld fällt mit dem Abstand ab, und der Schädel verschmiert, was ankommt.' : 'Das Areal ist klein: Es hat wenige Dipole.'} Bei Patienten waren Spikes aus weniger als etwa 6 cm² Rinde auf der Kopfhaut nie zu sehen, solche aus mehr als 10 cm² meist schon (Tao 2005); auf den Hippocampus beschränkte Entladungen erzeugen keinen Skalp-Rhythmus (Pacia & Ebersole 1997).`) });
  }

  /* how the source lies */
  if (p.tilt < 30) {
    out.push({ title: L('A radial source: one pole over it', 'Eine radiale Quelle: ein Pol darüber'), body: by(
      `The patch faces the skull, like the crown of a gyrus: its negative end points out. The scalp sees one negative maximum straight over it (${list(r.negNear, 'en')}), and the positive end, pointing into the brain, spreads its field thinly over the far side of the head.`,
      `Das Areal ist dem Schädel zugewandt wie die Kuppe eines Gyrus: Sein negatives Ende zeigt nach außen. Die Kopfhaut sieht ein negatives Maximum genau darüber (${list(r.negNear, 'de')}), und das positive Ende, ins Gehirn gerichtet, verteilt sein Feld dünn über die Gegenseite des Kopfes.`) });
  } else if (p.tilt > 60) {
    out.push({ title: L('A tangential source: two poles beside it', 'Eine tangentiale Quelle: zwei Pole daneben'), body: by(
      `The patch lies like the wall of a sulcus: its dipoles run along the skull. The scalp sees two poles of opposite sign on either side of it, the negative over ${list(r.negNear, 'en')} and the positive over ${list(r.posNear, 'en')}, and very little straight above it, where the field passes zero. A reader who looks only for the negative maximum puts the source too far toward it; the generator lies between the poles. This is the field of rolandic (centrotemporal) spikes: negative centrotemporal, positive frontal (Gregory & Wong 1984).`,
      `Das Areal liegt wie die Wand eines Sulcus: Seine Dipole verlaufen entlang dem Schädel. Die Kopfhaut sieht zwei Pole entgegengesetzten Vorzeichens zu beiden Seiten, den negativen über ${list(r.negNear, 'de')} und den positiven über ${list(r.posNear, 'de')}, und genau darüber sehr wenig, wo das Feld durch null geht. Wer nur das negative Maximum sucht, verlegt die Quelle zu weit dorthin; der Generator liegt zwischen den Polen. Das ist das Feld rolandischer (zentrotemporaler) Spikes: negativ zentrotemporal, positiv frontal (Gregory & Wong 1984).`) });
  } else {
    out.push({ title: L('An oblique source', 'Eine schräge Quelle'), body: by(
      `The patch is tilted ${p.tilt.toFixed(0)}° from radial. Its negative maximum (${list(r.negNear, 'en')}) moves away from the point straight over it, toward where the negative end leans, and a weaker positive pole appears on the other side (${list(r.posNear, 'en')}).`,
      `Das Areal ist um ${p.tilt.toFixed(0)}° gegen die Radiale geneigt. Sein negatives Maximum (${list(r.negNear, 'de')}) rückt vom Punkt genau darüber weg, dorthin, wohin das negative Ende zeigt, und auf der anderen Seite erscheint ein schwächerer positiver Pol (${list(r.posNear, 'de')}).`) });
  }

  /* reading it in this montage */
  if (c.montage.kind === 'bipolar') {
    const rev = r.reversals.find((x) => x.kind === (c.scene.polarity === 'negative' ? 'negative' : 'positive'));
    if (r.endOfChain) {
      out.push({ title: L('No phase reversal: the maximum is at the end of a chain', 'Keine Phasenumkehr: Das Maximum liegt am Ende einer Kette'), body: by(
        `The most negative electrode, ${electrodeLabel(r.negMax)}, is the first or last in its chain, so there is no channel on its far side to point back at it. The channels next to it all deflect the same way, largest nearest the maximum. A reversal is not needed to localise: the largest amplitude at the end of the chain is the sign. A referential montage shows it directly.`,
        `Die negativste Elektrode, ${electrodeLabel(r.negMax)}, ist die erste oder letzte ihrer Kette, also gibt es jenseits von ihr keinen Kanal, der zurückzeigen könnte. Die Kanäle daneben schlagen alle gleich aus, am stärksten nahe dem Maximum. Zum Lokalisieren braucht es keine Umkehr: Die größte Amplitude am Kettenende ist das Zeichen. Eine Referenzmontage zeigt es direkt.`) });
    } else if (rev) {
      const pair = rev.at.split('=');
      out.push({ title: pair.length > 1 ? L('A phase reversal across an equipotential pair', 'Eine Phasenumkehr über ein äquipotentielles Paar') : L('A phase reversal', 'Eine Phasenumkehr'), body: by(
        `${pair.length > 1 ? `The channel ${pair.join('–')} is nearly flat because both its electrodes sit at the same potential: together they are the maximum. The channels on either side point at them.` : `The channel before ${electrodeLabel(rev.at)} deflects down and the channel after it up: the pens point at each other, at the electrode they share.`} Each channel subtracts input 2 from input 1, and a channel goes up when input 1 is the more negative. So a negative maximum makes the channel ending on it go down and the channel starting from it go up: a ${rev.kind === 'negative' ? 'negative' : 'positive'} phase reversal at ${rev.at.split('=').map(electrodeLabel).join(' and ')}. The reversal says where the field peaks, not that the discharge is epileptic.`,
        `${pair.length > 1 ? `Der Kanal ${pair.join('–')} ist fast flach, weil seine beiden Elektroden auf gleichem Potential liegen: Zusammen sind sie das Maximum. Die Kanäle zu beiden Seiten zeigen auf sie.` : `Der Kanal vor ${electrodeLabel(rev.at)} schlägt nach unten aus, der Kanal danach nach oben: Die Ausschläge zeigen aufeinander, auf die Elektrode, die sie teilen.`} Jeder Kanal zieht Eingang 2 von Eingang 1 ab, und ein Kanal schlägt nach oben aus, wenn Eingang 1 der negativere ist. Ein negatives Maximum lässt also den Kanal, der darauf endet, nach unten und den Kanal, der davon ausgeht, nach oben ausschlagen: eine ${rev.kind === 'negative' ? 'negative' : 'positive'} Phasenumkehr bei ${rev.at.split('=').map(electrodeLabel).join(' und ')}. Die Umkehr sagt, wo das Feld gipfelt, nicht, dass die Entladung epileptisch ist.`) });
    }
  } else {
    const active = (c.refShare ?? 0) >= 0.25;
    out.push({ title: active ? L('The reference is not quiet', 'Die Referenz ist nicht ruhig') : L('A referential montage: the largest deflection is the maximum', 'Eine Referenzmontage: Der größte Ausschlag ist das Maximum'), body: by(
      active
        ? `The reference (${c.refName === 'AVG' ? 'the average of all 19 electrodes' : electrodeLabel(c.refName ?? '')}) itself carries ${Math.round((c.refShare ?? 0) * 100)} % of the field at the maximum. Every channel that uses it shows the reference’s part with inverted sign: channels far from the source deflect, and the channel nearest the reference shrinks. ${c.refName === 'A1' || c.refName === 'A2' ? 'An ear lies close to the temporal lobe: that is why ACNS prefers a Cz reference when temporal discharges are expected (Acharya 2016).' : c.refName === 'AVG' ? 'A large field pulls the average with it, so every electrode looks opposite to the source a little.' : 'Choose a reference far from the field.'}`
        : `Every channel compares one electrode with the same reference, so the channels draw the field electrode by electrode, and the largest deflection, at ${list(r.negNear, 'en')}, is the maximum. That holds as long as the reference itself sits outside the field.`,
      active
        ? `Die Referenz (${c.refName === 'AVG' ? 'der Mittelwert aller 19 Elektroden' : electrodeLabel(c.refName ?? '')}) trägt selbst ${Math.round((c.refShare ?? 0) * 100)} % des Feldes am Maximum. Jeder Kanal, der sie benutzt, zeigt ihren Anteil mit umgekehrtem Vorzeichen: Ferne Kanäle schlagen aus, und der Kanal nahe der Referenz wird kleiner. ${c.refName === 'A1' || c.refName === 'A2' ? 'Ein Ohr liegt nahe am Temporallappen: Deshalb empfiehlt die ACNS eine Cz-Referenz, wenn temporale Entladungen zu erwarten sind (Acharya 2016).' : c.refName === 'AVG' ? 'Ein großes Feld zieht den Mittelwert mit, also wirkt jede Elektrode ein wenig entgegengesetzt zur Quelle.' : 'Wählen Sie eine Referenz fern vom Feld.'}`
        : `Jeder Kanal vergleicht eine Elektrode mit derselben Referenz, also zeichnen die Kanäle das Feld Elektrode für Elektrode, und der größte Ausschlag, bei ${list(r.negNear, 'de')}, ist das Maximum. Das gilt, solange die Referenz selbst außerhalb des Feldes liegt.`) });
  }

  /* spike or sharp wave */
  const d = c.scene.discharge.duration;
  out.push({ title: d < 70 ? L('A spike', 'Ein Spike') : L('A sharp wave', 'Eine Sharp Wave'), body: by(
    `Its main component lasts ${d} ms: ${d < 70 ? 'a spike (20 to under 70 ms)' : 'a sharp wave (70–200 ms)'} by the IFCN glossary (Kane 2017); the line between them is a convention. ${c.scene.discharge.slowWave > 0 ? 'The slow wave after it is one of the six criteria for an epileptiform discharge (Kural 2020).' : 'Without a slow wave after it, it meets one fewer of the six criteria for an epileptiform discharge (Kural 2020).'} The machine’s filters change its shape: a lower high-frequency filter blunts the point.`,
    `Seine Hauptkomponente dauert ${d} ms: ${d < 70 ? 'ein Spike (20 bis unter 70 ms)' : 'eine Sharp Wave (70–200 ms)'} nach dem IFCN-Glossar (Kane 2017); die Grenze ist eine Konvention. ${c.scene.discharge.slowWave > 0 ? 'Die nachfolgende langsame Welle ist eines der sechs Kriterien einer epilepsietypischen Entladung (Kural 2020).' : 'Ohne nachfolgende langsame Welle erfüllt sie eines der sechs Kriterien einer epilepsietypischen Entladung weniger (Kural 2020).'} Die Filter des Geräts verändern ihre Form: Ein niedrigerer Hochfrequenzfilter stumpft die Spitze ab.`) });

  if (c.scene.polarity === 'positive') {
    out.push({ title: L('A surface-positive discharge', 'Eine oberflächenpositive Entladung'), body: by(
      'Most discharges are surface negative. Here the patch’s positive end faces out, so every sign turns over: the channels around the maximum point away from each other (a positive phase reversal).',
      'Die meisten Entladungen sind oberflächennegativ. Hier zeigt das positive Ende des Areals nach außen, also kehrt sich jedes Vorzeichen um: Die Kanäle um das Maximum zeigen voneinander weg (eine positive Phasenumkehr).') });
  }
  return out;
}

/** Background explanations, folded under the live ones. */
export const EEG_BACKGROUND: EegText[] = [
  T(L('Why the skull smears the field', 'Warum der Schädel das Feld verschmiert'), L(
    'The current a discharge drives flows mostly in the brain and the cerebrospinal fluid, which conduct well. The skull conducts 15 to 80 times worse than the brain (the ratio is still argued over: Rush & Driscoll 1968, Oostendorp 2000, Lai 2005, McCann 2019). Little current crosses it, and what crosses spreads sideways in the scalp. So a field a few millimetres wide on the cortex arrives on the scalp several centimetres wide and much smaller. Change the ratio and watch the section and the map.',
    'Der Strom einer Entladung fließt vor allem im Gehirn und im Liquor, die gut leiten. Der Schädel leitet 15- bis 80-mal schlechter als das Gehirn (das Verhältnis ist noch umstritten: Rush & Driscoll 1968, Oostendorp 2000, Lai 2005, McCann 2019). Wenig Strom tritt hindurch, und was hindurchtritt, breitet sich in der Kopfhaut seitlich aus. So kommt ein Feld, das auf der Rinde wenige Millimeter breit ist, auf der Kopfhaut mehrere Zentimeter breit und viel kleiner an. Ändern Sie das Verhältnis und sehen Sie auf Schnitt und Karte.')),
  T(L('What makes a source', 'Was eine Quelle ausmacht'), L(
    'Scalp EEG comes from the pyramidal cells of the cortex, which stand side by side with their apical dendrites toward the surface. When many are depolarised together, their currents add up to a sheet of dipoles; a single cell is far too weak. Measured in people, the cortex gives at most about 0.16–0.77 nAm per mm² (Murakami & Okada 2015). So what the scalp sees depends on how much cortex joins in, how deep it is, and which way it faces.',
    'Das Skalp-EEG stammt von den Pyramidenzellen der Rinde, die nebeneinander stehen, ihre apikalen Dendriten zur Oberfläche. Werden viele zugleich depolarisiert, summieren sich ihre Ströme zu einer Dipolschicht; eine einzelne Zelle ist viel zu schwach. Beim Menschen gemessen liefert die Rinde höchstens etwa 0,16–0,77 nAm pro mm² (Murakami & Okada 2015). Was die Kopfhaut sieht, hängt also davon ab, wie viel Rinde mitmacht, wie tief sie liegt und wohin sie zeigt.')),
  T(L('Reading a field', 'Ein Feld lesen'), L(
    'Find the most negative point: in a bipolar chain the channels point at it from both sides (a phase reversal), or, at the end of a chain, the largest channel touches it. Check it in a referential montage with a quiet reference. Then look for the positive pole: a tangential source shows both, and lies between them (Ebersole 1997).',
    'Suchen Sie den negativsten Punkt: In einer bipolaren Kette zeigen die Kanäle von beiden Seiten auf ihn (eine Phasenumkehr), oder am Ende einer Kette berührt ihn der größte Kanal. Prüfen Sie ihn in einer Referenzmontage mit ruhiger Referenz. Suchen Sie dann den positiven Pol: Eine tangentiale Quelle zeigt beide und liegt zwischen ihnen (Ebersole 1997).')),
  T(L('What this model leaves out', 'Was dieses Modell weglässt'), L(
    'The head here is four concentric spheres. A real head is not round, its skull is thinner at the temples and has openings, and its cortex is folded, so neighbouring walls of a sulcus partly cancel. This model makes a 6 cm² patch at a gyral crown give a clearly visible spike, where patients’ spikes from under 6 cm² were never seen (Tao 2005): a known gap. The background rhythms, slowing, artefacts and benign variants follow in the next parts.',
    'Der Kopf ist hier aus vier konzentrischen Kugeln. Ein echter Kopf ist nicht rund, sein Schädel ist an den Schläfen dünner und hat Öffnungen, und seine Rinde ist gefaltet, sodass sich benachbarte Wände eines Sulcus teilweise aufheben. Dieses Modell lässt ein Areal von 6 cm² auf einer Gyruskuppe einen deutlich sichtbaren Spike erzeugen, wo Spikes von Patienten aus weniger als 6 cm² nie zu sehen waren (Tao 2005): eine bekannte Lücke. Grundrhythmen, Verlangsamung, Artefakte und Normvarianten folgen in den nächsten Teilen.')),
];
