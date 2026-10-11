import type { MathNode, ModelDef, VariableDef, EquationDef } from '../physiology/types.ts';
import { variableOf } from '../physiology/models.ts';

/* ---------------------------------------------------------------------------
   Equations as MathML, from the same trees the models declare.

   Two renderings of each equation: symbolic, and with this patient's
   current values put in place of the symbols. The values are live: the
   caller re-renders the value line as the simulation runs.
--------------------------------------------------------------------------- */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const OPS = new Set(['+', '−', '-', '·', '×', '=', '→', ',', '/', '(', ')', '≈', '½', 'Σ']);

/** An identifier like `E_{max}`, `[K^+]_o`, `HCO_3^-`, `V_0,a`, `dV_LV/dt`. */
function ident(s: string): string {
  // bracketed concentration: [K^+]_o
  const br = /^\[(.+)\](?:_(\{[^}]*\}|\w+))?$/.exec(s);
  if (br) { const inner = `<mrow><mo>[</mo>${ident(br[1])}<mo>]</mo></mrow>`; const sb = br[2]?.replace(/^\{|\}$/g, ''); return sb ? `<msub>${inner}<mtext>${esc(sb)}</mtext></msub>` : inner; }
  // split at the first sub- or superscript marker
  const m = /^([^_^]+)(?:_(\{[^}]*\}|[^_^\s/]+))?(?:\^(\{[^}]*\}|[^_^\s/]+))?(.*)$/.exec(s);
  if (!m) return `<mi>${esc(s)}</mi>`;
  const [, base, sub, sup, rest] = m;
  const strip = (x?: string) => (x ? x.replace(/^\{|\}$/g, '') : undefined);
  const b = base.length > 1 && /^[A-Za-z]+$/.test(base) && !/^[A-Z]{2,}$/.test(base) ? `<mi mathvariant="normal">${esc(base)}</mi>` : `<mi>${esc(base)}</mi>`;
  const sb = strip(sub), sp = strip(sup);
  const scr = (x: string) => /^[0-9.]+$/.test(x) ? `<mn>${esc(x)}</mn>` : `<mtext>${esc(x)}</mtext>`;
  let out = b;
  if (sb && sp) out = `<msubsup>${b}${scr(sb)}${scr(sp)}</msubsup>`;
  else if (sb) out = `<msub>${b}${scr(sb)}</msub>`;
  else if (sp) out = `<msup>${b}${scr(sp)}</msup>`;
  return rest ? `<mrow>${out}${tokens(rest)}</mrow>` : out;
}

/** Free text inside an equation: numbers, operators and identifiers. */
function tokens(s: string): string {
  const out: string[] = [];
  const re = /(\d+(?:[.,]\d+)?)|([A-Za-zÀ-ÿα-ωΑ-Ωθτσ⃗][A-Za-zÀ-ÿα-ωΑ-Ωθτσ⃗0-9]*(?:_(?:\{[^}]*\}|[A-Za-z0-9,]+))?(?:\^(?:\{[^}]*\}|[^\s()]+))?)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1]) out.push(`<mn>${esc(m[1])}</mn>`);
    else if (m[2]) out.push(ident(m[2]));
    else if (m[3]) out.push('<mspace width="0.2em"/>');
    else if (m[4]) out.push(`<mo>${esc(m[4])}</mo>`);
  }
  return out.join('');
}

export interface MathContext {
  model: ModelDef;
  values: (v: VariableDef) => number | string | boolean | undefined;
  locale: 'en' | 'de';
  /** Render variables as their values instead of their symbols. */
  substitute: boolean;
}

export function fmtValue(v: VariableDef, x: number | string | boolean | undefined, locale: 'en' | 'de'): string {
  if (x == null || (typeof x === 'number' && !Number.isFinite(x))) return '—';
  if (typeof x === 'boolean') return x ? (locale === 'de' ? 'an' : 'on') : (locale === 'de' ? 'aus' : 'off');
  if (typeof x === 'string') return x;
  const d = v.digits ?? (Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2);
  const s = x.toFixed(d);
  return locale === 'de' ? s.replace('.', ',') : s;
}

function node(n: MathNode, c: MathContext): string {
  if (typeof n === 'string') {
    if (OPS.has(n)) return `<mo>${esc(n)}</mo>`;
    return tokens(n);
  }
  if ('v' in n) {
    const v = variableOf(c.model, n.v);
    if (!v) return `<mi>${esc(n.v)}</mi>`;
    if (!c.substitute) return `<mrow class="mv" data-var="${esc(v.id)}">${ident(v.symbol)}</mrow>`;
    return `<mrow class="mv val" data-var="${esc(v.id)}"><mn>${esc(fmtValue(v, c.values(v), c.locale))}</mn></mrow>`;
  }
  if ('frac' in n) return `<mfrac><mrow>${n.frac[0].map((x) => node(x, c)).join('')}</mrow><mrow>${n.frac[1].map((x) => node(x, c)).join('')}</mrow></mfrac>`;
  if ('paren' in n) return `<mrow><mo>(</mo>${n.paren.map((x) => node(x, c)).join('')}<mo>)</mo></mrow>`;
  if ('sup' in n) return `<msup><mrow>${n.sup[0].map((x) => node(x, c)).join('')}</mrow><mrow>${n.sup[1].map((x) => node(x, c)).join('')}</mrow></msup>`;
  if ('fn' in n) {
    const args = n.args.map((x) => node(x, c)).join('');
    if (n.fn === 'sqrt') return `<msqrt>${args}</msqrt>`;
    return `<mrow><mi mathvariant="normal">${esc(n.fn)}</mi><mo>&#x2061;</mo><mo>(</mo>${args}<mo>)</mo></mrow>`;
  }
  if ('text' in n) return `<mrow>${tokens(n.text)}</mrow>`;
  return '';
}

/** One equation as a MathML block. */
export function equationMathML(e: EquationDef, c: MathContext): string {
  return `<math display="block"><mrow>${e.lhs.map((x) => node(x, c)).join('')}<mo>=</mo>${e.rhs.map((x) => node(x, c)).join('')}</mrow></math>`;
}

/** The variables an equation mentions, in order, without repeats. */
export function equationVariables(e: EquationDef, model: ModelDef): VariableDef[] {
  const out: VariableDef[] = [];
  const walk = (n: MathNode) => {
    if (typeof n === 'string') return;
    if ('v' in n) { const v = variableOf(model, n.v); if (v && !out.includes(v)) out.push(v); return; }
    if ('frac' in n) { n.frac[0].forEach(walk); n.frac[1].forEach(walk); }
    else if ('paren' in n) n.paren.forEach(walk);
    else if ('sup' in n) { n.sup[0].forEach(walk); n.sup[1].forEach(walk); }
    else if ('fn' in n) n.args.forEach(walk);
  };
  e.lhs.forEach(walk); e.rhs.forEach(walk);
  return out;
}

/** A symbol on its own, for labels and legends. */
export const symbolMathML = (symbol: string) => `<math>${ident(symbol)}</math>`;
