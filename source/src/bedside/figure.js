/* ---------------------------------------------------------------------------
   The patient, drawn.

   A stylised figure propped up at 45°, seen from the foot of the bed, so the
   patient's right is on your left. It is driven entirely by the bedside
   context: breathing rate and pattern, colour, sweat, expression, the height
   of the jugular pulsation, ankle swelling, a cervical collar when the
   neck is immobilised.

   Hotspots are per tool. Holding the stethoscope shows the auscultation
   areas; holding nothing but your hands shows the pulses and the apex.
--------------------------------------------------------------------------- */

const SKIN = {
  'tone-1': ['#F3D3BD', '#E2B79C'], 'tone-2': ['#E8BE9A', '#D29F7A'], 'tone-3': ['#C98F66', '#B0764F'],
  'tone-4': ['#A9704A', '#8E5A38'], 'tone-5': ['#7A4E33', '#643E27'],
};
const HAIR = {
  'short-dark': '#2B211C', 'grey-bun': '#C9C6C2', bald: null, 'short-curly': '#1A1411',
};

export const HOTSPOTS = {
  look: [
    { id: 'look.general', x: 200, y: 92, r: 40, label: 'Face and general appearance' },
    { id: 'look.jvp', x: 186, y: 152, r: 14, label: 'Neck: jugular venous pressure' },
    { id: 'look.chest', x: 200, y: 232, r: 34, label: 'Chest: breathing pattern' },
    { id: 'look.hands', x: 294, y: 344, r: 16, label: 'Hands' },
  ],
  feel: [
    { id: 'feel.radial', x: 106, y: 338, r: 13, label: 'Right radial pulse' },
    { id: 'feel.carotid', x: 187, y: 153, r: 11, label: 'Right carotid pulse' },
    { id: 'feel.periph', x: 294, y: 344, r: 15, label: 'Hands: temperature, capillary refill' },
    { id: 'feel.apex', x: 243, y: 262, r: 13, label: 'Apex beat' },
    { id: 'feel.abdomen', x: 200, y: 318, r: 24, label: 'Abdomen' },
    { id: 'feel.ankles', x: 236, y: 492, r: 16, label: 'Ankles and sacrum: oedema' },
  ],
  listen: [
    { id: 'listen.aortic', x: 182, y: 200, r: 10, label: 'Aortic area' },
    { id: 'listen.pulmonary', x: 218, y: 200, r: 10, label: 'Pulmonary area' },
    { id: 'listen.tricuspid', x: 212, y: 246, r: 10, label: 'Tricuspid area' },
    { id: 'listen.mitral', x: 243, y: 262, r: 10, label: 'Mitral area (apex)' },
    { id: 'listen.axilla', x: 272, y: 240, r: 10, label: 'Left axilla' },
    { id: 'listen.carotid', x: 187, y: 153, r: 9, label: 'Right carotid' },
    { id: 'listen.lungR', x: 150, y: 284, r: 12, label: 'Right lung base' },
    { id: 'listen.lungL', x: 250, y: 284, r: 12, label: 'Left lung base' },
  ],
  instruct: [
    { id: 'region:eyes', x: 200, y: 84, r: 22, label: 'Eyes and pupils' },
    { id: 'region:face', x: 200, y: 114, r: 16, label: 'Face, tongue, speech' },
    { id: 'region:R_arm', x: 112, y: 270, r: 20, label: 'Right arm' },
    { id: 'region:L_arm', x: 288, y: 270, r: 20, label: 'Left arm' },
    { id: 'region:trunk', x: 200, y: 290, r: 22, label: 'Trunk and bladder' },
    { id: 'region:R_leg', x: 164, y: 420, r: 22, label: 'Right leg' },
    { id: 'region:L_leg', x: 236, y: 420, r: 22, label: 'Left leg' },
  ],
};

function hairSvg(style, c) {
  if (!c) return '<path d="M160 70 Q200 40 240 70" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="3"/>';
  if (style === 'grey-bun') {
    return `<circle cx="200" cy="44" r="15" fill="${c}"/><path d="M152 92 Q150 48 200 46 Q250 48 248 92 Q240 64 200 62 Q160 64 152 92Z" fill="${c}"/>`;
  }
  if (style === 'short-curly') {
    let s = '';
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (0.05 + 0.9 * (i / 12));
      s += `<circle cx="${(200 - Math.cos(a) * 44).toFixed(1)}" cy="${(86 - Math.sin(a) * 42).toFixed(1)}" r="11" fill="${c}"/>`;
    }
    return s;
  }
  return `<path d="M154 94 Q146 46 200 44 Q254 46 246 94 Q240 66 212 64 Q180 72 160 70 Q156 80 154 94Z" fill="${c}"/>`;
}

let uid = 0;

export function patientSvg(persona) {
  const k = `p${++uid}`;
  const [skin, shade] = SKIN[persona.skin] || SKIN['tone-2'];
  const hair = hairSvg(persona.hair, HAIR[persona.hair]);
  const S = `url(#${k}skin)`; const G = `url(#${k}gown)`; const D = `url(#${k}dots)`;
  const collar = persona.immobile
    ? '<g class="collar"><rect x="168" y="134" width="64" height="30" rx="8" fill="#E9EEF3" stroke="#B8C3CE"/><rect x="190" y="138" width="20" height="22" rx="3" fill="#C9D3DD"/><rect x="138" y="70" width="16" height="50" rx="5" fill="#F2A541" opacity=".9"/><rect x="246" y="70" width="16" height="50" rx="5" fill="#F2A541" opacity=".9"/></g>'
    : '';
  return `
<svg class="pt-svg" viewBox="0 0 400 520" role="img" aria-label="${persona.name}, ${persona.age}">
  <defs>
    <radialGradient id="${k}skin" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${skin}"/><stop offset="1" stop-color="${shade}"/></radialGradient>
    <linearGradient id="${k}gown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CC3E4"/><stop offset="1" stop-color="#7FA9CF"/></linearGradient>
    <linearGradient id="${k}sheet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F1EC"/><stop offset="1" stop-color="#DCD6CE"/></linearGradient>
    <pattern id="${k}dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="rgba(255,255,255,.35)"/></pattern>
  </defs>
  <rect x="40" y="20" width="320" height="490" rx="36" class="pt-bed"/>
  <ellipse cx="200" cy="110" rx="120" ry="80" class="pt-pillow"/>
  <g class="pt-arms">
    <path d="M132 176 Q100 196 98 250 Q96 300 100 334 L118 336 Q122 296 126 256 Q132 214 150 196Z" fill="${G}"/>
    <path d="M268 176 Q300 196 302 250 Q304 300 300 334 L282 336 Q278 296 274 256 Q268 214 250 196Z" fill="${G}"/>
    <ellipse class="pt-hand" cx="106" cy="344" rx="14" ry="18" fill="${S}"/>
    <ellipse class="pt-hand" cx="294" cy="344" rx="14" ry="18" fill="${S}"/>
  </g>
  <g class="pt-abdo"><path d="M142 286 Q140 330 150 356 L250 356 Q260 330 258 286Z" fill="${G}"/><path d="M142 286 Q140 330 150 356 L250 356 Q260 330 258 286Z" fill="${D}"/></g>
  <g class="pt-chest">
    <path d="M150 164 Q126 172 132 206 Q136 250 142 292 L258 292 Q264 250 268 206 Q274 172 250 164 Q226 176 200 176 Q174 176 150 164Z" fill="${G}"/>
    <path d="M150 164 Q126 172 132 206 Q136 250 142 292 L258 292 Q264 250 268 206 Q274 172 250 164 Q226 176 200 176 Q174 176 150 164Z" fill="${D}"/>
    <path d="M176 170 Q200 196 224 170" fill="${S}"/>
    <path d="M176 170 Q200 196 224 170" fill="none" stroke="rgba(0,0,0,.15)" stroke-width="1.5"/>
    <g class="pt-landmarks"><line x1="200" y1="182" x2="200" y2="270" /><circle cx="200" cy="190" r="2.5"/></g>
  </g>
  <path d="M112 350 Q200 336 288 350 L300 478 Q200 492 100 478Z" fill="url(#${k}sheet)" class="pt-sheet"/>
  <path d="M112 350 Q200 336 288 350" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="6"/>
  <g class="pt-feet">
    <ellipse class="pt-ankle" cx="164" cy="492" rx="16" ry="12" fill="${S}"/>
    <ellipse class="pt-ankle" cx="236" cy="492" rx="16" ry="12" fill="${S}"/>
  </g>
  <path d="M178 124 L178 168 Q200 178 222 168 L222 124Z" fill="${S}"/>
  <line class="pt-jvp" x1="186" y1="166" x2="186" y2="150"/>
  <circle class="pt-carotid" cx="191" cy="150" r="3"/>
  <g class="pt-head">
    <ellipse cx="151" cy="98" rx="8" ry="13" fill="${S}"/>
    <ellipse cx="249" cy="98" rx="8" ry="13" fill="${S}"/>
    <ellipse cx="200" cy="92" rx="48" ry="54" fill="${S}"/>
    ${hair}
    <g class="pt-face">
      <path class="pt-brow pt-brow-r" d="M172 76 Q182 70 192 75"/>
      <path class="pt-brow pt-brow-l" d="M208 75 Q218 70 228 76"/>
      <g class="pt-eye"><ellipse cx="182" cy="88" rx="8" ry="5.5" fill="#fff"/><circle cx="182" cy="88" r="3.4" class="pt-iris"/><rect class="pt-lid" x="172" y="80" width="20" height="0" fill="${S}"/></g>
      <g class="pt-eye"><ellipse cx="218" cy="88" rx="8" ry="5.5" fill="#fff"/><circle cx="218" cy="88" r="3.4" class="pt-iris"/><rect class="pt-lid" x="208" y="80" width="20" height="0" fill="${S}"/></g>
      <path d="M200 92 Q196 104 200 108 Q204 108 206 106" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2" stroke-linecap="round"/>
      <path class="pt-mouth" d="M188 122 Q200 126 212 122" />
      <g class="pt-sweat"><path d="M172 70 q3 6 0 8 q-3 -2 0 -8Z"/><path d="M230 66 q3 6 0 8 q-3 -2 0 -8Z"/><path d="M160 104 q3 6 0 8 q-3 -2 0 -8Z"/></g>
    </g>
    <ellipse class="pt-tint" cx="200" cy="92" rx="48" ry="54"/>
  </g>
  ${collar}
  <g class="pt-wash"><ellipse cx="106" cy="344" rx="14" ry="18"/><ellipse cx="294" cy="344" rx="14" ry="18"/></g>
  <g class="pt-stetho" transform="translate(-100 -100)"><circle r="11" /><circle r="5" /></g>
  <g class="pt-hotspots"></g>
  <g class="pt-bubble" transform="translate(252 22)"><rect rx="12" width="140" height="44"/><path d="M14 44 L6 58 L28 44Z"/><text x="10" y="18"></text><text x="10" y="34"></text></g>
</svg>`;
}

const MOUTHS = {
  calm: 'M188 122 Q200 127 212 122',
  worried: 'M188 124 Q200 120 212 124',
  distressed: 'M186 121 Q200 116 214 121 Q200 130 186 121Z',
  breathless: 'M192 119 Q200 114 208 119 Q208 129 200 130 Q192 129 192 119Z',
  drowsy: 'M190 123 Q200 124 210 123',
};

/** Apply the current bedside context to a mounted figure. */
export function updateFigure(root, c, { tool = 'look', persona = {} } = {}) {
  const svg = root.querySelector('svg');
  if (!svg) return;
  const period = 60 / Math.max(6, c.RR);
  svg.style.setProperty('--breath', `${period.toFixed(2)}s`);
  svg.style.setProperty('--pulse', `${(60 / Math.max(30, c.HR)).toFixed(3)}s`);
  svg.classList.toggle('paradox', !!c.cervicalCord);
  svg.classList.toggle('laboured', c.RR > 22 && !c.cervicalCord);

  const mood = c.Pmean < 52 ? 'drowsy' : c.RR > 24 ? 'breathless' : (c.sympathetic > 0.8 || persona.id === 'c5') ? 'distressed'
    : (c.LAP > 20 || c.AS) ? 'worried' : 'calm';
  svg.querySelector('.pt-mouth')?.setAttribute('d', MOUTHS[mood]);
  svg.dataset.mood = mood;

  const pale = c.Hb < 110 || (!c.lossOfTone && c.sympathetic > 0.8);
  svg.classList.toggle('pale', pale);
  svg.classList.toggle('sweaty', !c.lossOfTone && c.sympathetic > 0.8);
  svg.classList.toggle('flushed', c.lossOfTone);
  svg.classList.toggle('cyanosed', c.SpO2 < 90);

  // JVP: the top of the pulsation, from the clavicle (y≈166) upwards.
  const top = Math.max(118, Math.min(166, 166 - Math.max(0, c.JVPcm + 2) * 4.5));
  const jv = svg.querySelector('.pt-jvp');
  if (jv) { jv.setAttribute('y2', String(top)); jv.style.opacity = c.JVPcm <= -2.5 || persona.immobile ? '0' : '1'; }
  svg.classList.toggle('corrigan', c.AR && c.PP > 60);

  const swollen = persona.chronicCongestion || c.CVP > 10;
  for (const a of svg.querySelectorAll('.pt-ankle')) { a.setAttribute('rx', swollen ? '21' : '16'); a.setAttribute('ry', swollen ? '15' : '12'); }

  const hs = svg.querySelector('.pt-hotspots');
  if (hs && hs.dataset.tool !== tool) {
    hs.dataset.tool = tool;
    hs.innerHTML = (HOTSPOTS[tool] || []).map((h) =>
      `<g class="hs" data-id="${h.id}" tabindex="0" role="button" aria-label="${h.label}"><circle cx="${h.x}" cy="${h.y}" r="${h.r}"/><circle class="hs-core" cx="${h.x}" cy="${h.y}" r="3"/><title>${h.label}</title></g>`).join('');
  }
  svg.dataset.tool = tool;
}

/** A short speech bubble near the head. Long replies are clipped with an ellipsis. */
export function say(root, text) {
  const svg = root?.querySelector('svg');
  const b = svg?.querySelector('.pt-bubble');
  if (!b) return;
  const words = String(text).split(/\s+/);
  const lines = ['', ''];
  let li = 0;
  for (const w of words) {
    if ((lines[li] + ' ' + w).trim().length > 22) {
      li += 1;
      if (li > 1) { lines[1] = lines[1].replace(/\s*\S*$/, '') + '…'; break; }
    }
    lines[li] = (lines[li] + ' ' + w).trim();
  }
  const [t1, t2] = b.querySelectorAll('text');
  t1.textContent = lines[0]; t2.textContent = lines[1] || '';
  b.classList.remove('show');
  void b.getBoundingClientRect?.();
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), 4200);
}

export function placeStethoscope(root, spot) {
  const g = root?.querySelector('.pt-stetho');
  if (!g) return;
  if (!spot) { g.setAttribute('transform', 'translate(-100 -100)'); return; }
  g.setAttribute('transform', `translate(${spot.x} ${spot.y})`);
}
