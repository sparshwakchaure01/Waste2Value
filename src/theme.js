// Appearance options: accent colour and compact density. Stored per browser.
export const ACCENTS = {
  emerald: { label: 'Emerald', teal: '#0B8A68', bright: '#19C597', deep: '#076B50', tint: '#E3F6EF', rgb: '25,197,151' },
  azure:   { label: 'Azure',   teal: '#1B6FD1', bright: '#3FA2FF', deep: '#114E9C', tint: '#E3EFFD', rgb: '63,162,255' },
  violet:  { label: 'Violet',  teal: '#6A48DB', bright: '#9A7DFF', deep: '#4B2FB5', tint: '#EDE8FD', rgb: '154,125,255' },
  amber:   { label: 'Amber',   teal: '#B4701A', bright: '#F2A93B', deep: '#865311', tint: '#FBEFD9', rgb: '242,169,59' },
  rose:    { label: 'Rose',    teal: '#C0405C', bright: '#F0708A', deep: '#962D45', tint: '#FCE7EC', rgb: '240,112,138' }
};

const KEY = 'w2v-theme';

export function getTheme() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { accent: ACCENTS[t.accent] ? t.accent : 'emerald', compact: !!t.compact };
  } catch {
    return { accent: 'emerald', compact: false };
  }
}

export function applyTheme(theme = getTheme()) {
  const a = ACCENTS[theme.accent] || ACCENTS.emerald;
  const root = document.documentElement.style;
  root.setProperty('--teal', a.teal);
  root.setProperty('--teal-bright', a.bright);
  root.setProperty('--teal-deep', a.deep);
  root.setProperty('--teal-tint', a.tint);
  root.setProperty('--accent-rgb', a.rgb);
  document.body.classList.toggle('compact', theme.compact);
}

export function setTheme(patch) {
  const next = { ...getTheme(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  applyTheme(next);
  return next;
}
