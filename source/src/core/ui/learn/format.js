/* Small formatting helpers shared by the learning views. */
export const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);

export function fmtMinutes(min) {
  if (!min) return '0 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}

export const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
export const fmtShort = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const DOMAIN_LABEL = { cardio: 'Circulation', neuro: 'Neurology', labs: 'Labs', bedside: 'Bedside' };

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function download(filename, text, type = 'application/json') {
  try {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch { return false; }
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
