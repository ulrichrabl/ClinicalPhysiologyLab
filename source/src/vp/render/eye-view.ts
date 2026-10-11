import type { Side } from '../model/types.ts';
import { scene, type SceneControls, type SceneFindings } from './eye-scene.ts';

/* ---------------------------------------------------------------------------
   SVG eye view: draws an eye scene (see eye-scene.ts) into an SVG element.
   Markup and drawing live together so any page can mount an animated pair
   of eyes driven by the model's findings.
--------------------------------------------------------------------------- */

export const EYE_SVG = `
<svg class="eyeview" viewBox="0 0 440 200" role="img" aria-label="Eyes">
  <defs>
    <clipPath id="ev-clip-R"><path d="M98 100 Q150 60 202 100 Q150 132 98 100 Z"/></clipPath>
    <clipPath id="ev-clip-L"><path d="M238 100 Q290 60 342 100 Q290 132 238 100 Z"/></clipPath>
    <radialGradient id="ev-iris" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#5a7d6e"/><stop offset="75%" stop-color="#5a7d6e"/><stop offset="100%" stop-color="#34503f"/></radialGradient>
    <radialGradient id="ev-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff6d8" stop-opacity="0.95"/><stop offset="100%" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <g id="ev-iris-art">
      <circle r="24" fill="url(#ev-iris)"/>
      <g stroke="#34503f" stroke-width="0.9" opacity="0.55">
        <line x1="0" y1="-23" x2="0" y2="-9"/><line x1="0" y1="23" x2="0" y2="9"/><line x1="-23" y1="0" x2="-9" y2="0"/><line x1="23" y1="0" x2="9" y2="0"/>
        <line x1="-16" y1="-16" x2="-6.5" y2="-6.5"/><line x1="16" y1="16" x2="6.5" y2="6.5"/><line x1="16" y1="-16" x2="6.5" y2="-6.5"/><line x1="-16" y1="16" x2="-6.5" y2="6.5"/>
      </g>
      <circle cx="0" cy="-17" r="2.2" fill="#34503f" opacity="0.8"/>
      <circle r="24" fill="none" stroke="#34503f" stroke-width="1.5"/>
    </g>
  </defs>
  <rect class="ev-skin" x="0" y="0" width="440" height="200"/>
  <g class="ev-face">
    <path class="ev-shade" d="M60 32 Q150 10 210 38" fill="none" stroke-width="7" stroke-linecap="round"/>
    <path class="ev-shade" d="M230 38 Q290 10 380 32" fill="none" stroke-width="7" stroke-linecap="round"/>
    <path class="ev-shade" d="M220 62 Q212 130 206 168 Q220 180 236 172" fill="none" stroke-width="2.5" stroke-linecap="round"/>
    ${(['R', 'L'] as Side[]).map((S) => {
      const cx = S === 'R' ? 150 : 290;
      return `<g>
      <path class="ev-shade" d="M${cx - 56} 94 Q${cx} 48 ${cx + 56} 94" fill="none" stroke-width="2"/>
      <g clip-path="url(#ev-clip-${S})">
        <rect x="${cx - 60}" y="50" width="120" height="90" fill="#fbf8f2"/>
        <g data-iris="${S}" transform="translate(${cx} 100)">
          <use href="#ev-iris-art"/><circle data-pupil="${S}" r="7" fill="#0b0d0d"/><circle cx="-6" cy="-7" r="2.4" fill="#fff" opacity="0.85"/>
        </g>
        <path class="ev-skin" data-lid="${S}" d="M${cx - 60} 30 H${cx + 60} V100 Q${cx} 60 ${cx - 60} 100 Z"/>
      </g>
      <path class="ev-shade" d="M${cx - 52} 100 Q${cx} 60 ${cx + 52} 100 Q${cx} 132 ${cx - 52} 100 Z" fill="none" stroke-width="1.6"/>
      <circle data-glow="${S}" cx="${cx}" cy="100" r="46" fill="url(#ev-glow)" opacity="0"/>
      <circle class="ev-lens" cx="${cx}" cy="98" r="60" fill="#c27a12" fill-opacity="0.08" stroke="#1d2322" stroke-opacity="0.6" stroke-width="7" opacity="0"/>
      <rect data-occ="${S}" x="${cx - 64}" y="52" width="128" height="94" rx="14" fill="#1d2322" opacity="0"/>
    </g>`;
    }).join('')}
  </g>
  <rect class="ev-dim" x="0" y="0" width="440" height="200" fill="#000" opacity="0"/>
</svg>`;

export class EyeView {
  private findings: SceneFindings | null = null;
  private controls: (now: number) => SceneControls = () => ({ gaze: 'primary', fixation: true, lightOn: 'none', ambient: 'room' });
  private pupil: Record<Side, number> = { L: 4, R: 4 };
  private raf = 0;
  private svg: SVGSVGElement;

  constructor(host: HTMLElement, skin: string, shade: string) {
    host.innerHTML = EYE_SVG;
    this.svg = host.querySelector('svg')!;
    this.svg.querySelectorAll<SVGElement>('.ev-skin').forEach((e) => e.setAttribute('fill', skin));
    this.svg.querySelectorAll<SVGElement>('.ev-shade').forEach((e) => e.setAttribute('stroke', shade));
  }

  /** `findingsFor` is re-evaluated whenever the controls change (a light switched on). */
  show(findingsFor: (k: SceneControls) => SceneFindings, controls: (now: number) => SceneControls) {
    this.controls = controls;
    let lastKey = '';
    cancelAnimationFrame(this.raf);
    const q = <T extends Element>(sel: string) => this.svg.querySelector(sel) as T;
    const frame = (now: number) => {
      const k = this.controls(now);
      const key = `${k.gaze}|${k.fixation}|${k.lightOn}|${k.ambient}`;
      if (key !== lastKey || !this.findings) { this.findings = findingsFor(k); lastKey = key; }
      const sc = scene(this.findings, k, now / 1000);
      q<SVGGElement>('.ev-face').setAttribute('transform', `translate(${(-sc.head * 2.4).toFixed(2)} 0)`);
      q<SVGRectElement>('.ev-dim').setAttribute('opacity', k.ambient === 'dim' ? '0.38' : '0');
      this.svg.querySelectorAll<SVGElement>('.ev-lens').forEach((e) => e.setAttribute('opacity', k.fixation ? '0' : '1'));
      for (const S of ['L', 'R'] as Side[]) {
        const e = sc[S];
        const cx = S === 'R' ? 150 : 290;
        const x = cx - (e.h - sc.head) * 0.95, y = 100 - e.v * 0.95;
        q<SVGGElement>(`[data-iris="${S}"]`).setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(-e.torsion).toFixed(2)})`);
        this.pupil[S] += (e.pupilMm - this.pupil[S]) * 0.12;
        q<SVGCircleElement>(`[data-pupil="${S}"]`).setAttribute('r', (this.pupil[S] / 2 * 3.4).toFixed(2));
        q<SVGPathElement>(`[data-lid="${S}"]`).setAttribute('transform', `translate(0 ${(Math.min(e.ptosisMm, 9) * 3.4).toFixed(2)})`);
        q<SVGRectElement>(`[data-occ="${S}"]`).setAttribute('opacity', sc.covered === S ? '0.92' : '0');
        q<SVGCircleElement>(`[data-glow="${S}"]`).setAttribute('opacity', k.lightOn === S ? '1' : '0');
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() { cancelAnimationFrame(this.raf); }
}
