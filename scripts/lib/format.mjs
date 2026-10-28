/* ==========================================================
   Funzioni di formattazione condivise dal robot.
   Nessuna dipendenza: solo JavaScript standard.
   ========================================================== */

/** Millisecondi -> "1:38.155" (tempo sul giro) */
export function lapFromMs(ms) {
  if (!ms) return '';
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

/** Millisecondi -> "32:56.372" o "1:02:10.120" (tempo totale) */
export function totalFromMs(ms) {
  if (!ms) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Millisecondi di distacco -> "+4.696" */
export function gapFromMs(ms) {
  if (ms == null || ms < 0) return '';
  return '+' + (ms / 1000).toFixed(3);
}

/** "01:30.132" -> "1:30.132" ; "00:40:46.582" -> "40:46.582" */
export function cleanTime(t) {
  if (!t) return '';
  return String(t).replace(/^(00:)+/, '').replace(/^0(\d)/, '$1');
}

/** "+N giri" con singolare/plurale */
export function lapsDown(n) {
  return `+${n} ${n === 1 ? 'giro' : 'giri'}`;
}

/** "PETRONAS GRAND PRIX OF MALAYSIA " -> "Petronas Grand Prix of Malaysia" */
export function titleCase(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'(])\S/g, c => c.toUpperCase())
    .replace(/\b(Of|The|And|De|Di|Del)\b/g, w => w.toLowerCase())
    .replace(/^./, c => c.toUpperCase())
    .replace(/Motogp/g, 'MotoGP');
}

/** "2026-10-30T10:45:00+0800" -> Date ISO in UTC */
export function toUtcIso(s) {
  if (!s) return null;
  const fixed = String(s).replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const d = new Date(fixed);
  return isNaN(d) ? null : d.toISOString();
}

export function addMinutes(iso, min) {
  return new Date(new Date(iso).getTime() + min * 60000).toISOString();
}

/** Codici paese a 3 lettere (usati dalla Superbike) -> 2 lettere */
const ISO3 = {
  AUS: 'AU', POR: 'PT', PRT: 'PT', NED: 'NL', NLD: 'NL', HUN: 'HU', CZE: 'CZ', ESP: 'ES', SPA: 'ES',
  ITA: 'IT', GBR: 'GB', FRA: 'FR', GER: 'DE', DEU: 'DE', ARG: 'AR', IDN: 'ID', INA: 'ID', THA: 'TH',
  QAT: 'QA', JPN: 'JP', USA: 'US', BRA: 'BR', MYS: 'MY', MAL: 'MY', TUR: 'TR', CHN: 'CN', AUT: 'AT',
  BEL: 'BE', SMR: 'SM', RSA: 'ZA', ZAF: 'ZA', IND: 'IN', KAZ: 'KZ', MEX: 'MX', CAN: 'CA',
};
export function iso2(code) {
  if (!code) return null;
  const c = String(code).toUpperCase();
  return c.length === 2 ? c : (ISO3[c] || null);
}

/** Colore della barra a sinistra in classifica, in base al costruttore */
const MAKER_COLORS = [
  ['bimota', '#C9C9C9'],
  ['ducati', '#C51E14'],
  ['aprilia', '#8A2BE2'],
  ['ktm', '#F37021'],
  ['yamaha', '#0033A0'],
  ['honda', '#D01012'],
  ['bmw', '#1C69D4'],
  ['kawasaki', '#5DBB46'],
  ['triumph', '#9AA0A6'],
  ['mv agusta', '#B11226'],
  ['kalex', '#3BA3D9'],
  ['boscoscuro', '#B5121B'],
  ['forward', '#8E8E8E'],
  ['gasgas', '#C00000'],
  ['husqvarna', '#1D3A6E'],
  ['cfmoto', '#00A3E0'],
];
/** Prova i nomi nell'ordine dato: prima il costruttore, poi la squadra */
export function makerColor(...names) {
  for (const n of names.filter(Boolean)) {
    const text = String(n).toLowerCase();
    const hit = MAKER_COLORS.find(([k]) => text.includes(k));
    if (hit) return hit[1];
  }
  return null;
}
