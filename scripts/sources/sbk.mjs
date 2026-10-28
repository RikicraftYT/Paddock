/* ==========================================================
   Fonte: Superbike (servizi Pulselive usati da worldsbk.com)
   - Calendario e orari: wsbk-events/v1
   - Classifiche:        wsbk-results/v1
   Non sono API ufficiali documentate: se cambiano, si corregge solo questo file.
   ========================================================== */

import { addMinutes, lapFromMs, totalFromMs, gapFromMs, lapsDown, makerColor, iso2 } from '../lib/format.mjs';

const BASE = 'https://api.wsbk.pulselive.com';

// Sessioni WorldSBK mostrate nell'app (sigla -> etichetta, tipo, durata di riserva in minuti)
const SESSIONS = {
  FP1:  { label: 'Libere 1',       kind: 'practice', dur: 45 },
  FP2:  { label: 'Libere 2',       kind: 'practice', dur: 45 },
  FP3:  { label: 'Libere 3',       kind: 'practice', dur: 30 },
  SP:   { label: 'Superpole',      kind: 'quali',    dur: 15 },
  RC1:  { label: 'Gara 1',         kind: 'race',     dur: 40 },
  SPRC: { label: 'Superpole Race', kind: 'sprint',   dur: 20 },
  RC2:  { label: 'Gara 2',         kind: 'race',     dur: 40 },
};

/* ---------------- Calendario ---------------- */

export async function sbkCalendar({ year, fetchJSON }) {
  const rounds = await fetchJSON(`${BASE}/wsbk-events/v1/seasons/${year}/rounds`);
  const circuits = {};
  (rounds.included || []).filter(x => x.type === 'circuits').forEach(c => { circuits[c.id] = c.attributes; });

  const list = rounds.data
    .filter(r => r.relationships?.categories?.data?.some(c => c.id === 'SBK'))
    .sort((a, b) => a.attributes.sequence_order - b.attributes.sequence_order);

  const weekends = [];
  for (const r of list) {
    const a = r.attributes;
    const circuit = circuits[r.relationships?.circuit?.data?.id] || {};
    const res = await fetchJSON(`${BASE}/wsbk-events/v1/seasons/${year}/rounds/${a.source_id}/sessions`);

    const sessions = pickOnePerSession((res.data || [])
      .filter(s => s.relationships?.category?.data?.id === 'SBK'))
      .map(s => {
        const short = String(s.attributes.short_name || '').trim().toUpperCase();
        const def = SESSIONS[short];
        if (!def) return null;
        const start = new Date(s.attributes.start_date_utc).toISOString();
        let end = s.attributes.end_date_utc ? new Date(s.attributes.end_date_utc).toISOString() : null;
        if (!end || end <= start) end = addMinutes(start, s.attributes.duration || def.dur);
        return { id: short, sourceId: s.attributes.source_id, label: def.label, kind: def.kind, start, end };
      })
      .filter(Boolean)
      .sort((x, y) => x.start.localeCompare(y.start));

    weekends.push({
      id: `${year}-${a.source_id}`,
      code: a.source_id,
      round: a.sequence_order,
      name: a.description || a.name,
      country: iso2(a.country_iso),
      city: circuit.locality || a.brief_description || '',
      circuit: circuit.description || a.name || '',
      sessions,
    });
  }

  return { series: 'sbk', season: String(year), weekends };
}

/**
 * Se una gara viene interrotta con bandiera rossa e ripartita, il servizio
 * elenca due sessioni con la stessa sigla (es. due "RC1"): la prima con
 * "Red Flag" nel nome. Si tiene quella ripartita, cioè la classifica valida.
 */
function pickOnePerSession(list) {
  const groups = {};
  list.forEach(s => {
    const k = String(s.attributes.short_name || '').trim().toUpperCase();
    (groups[k] = groups[k] || []).push(s);
  });
  return Object.values(groups).map(g => {
    if (g.length === 1) return g[0];
    const clean = g.filter(s => !/red\s*flag/i.test(s.attributes.description || ''));
    const pool = clean.length ? clean : g;
    return pool.sort((a, b) => a.attributes.start_date_utc.localeCompare(b.attributes.start_date_utc)).at(-1);
  });
}

/**
 * Il servizio scrive i tempi "compattati": 3256372 = 32:56.372, 136643 = 1:36.643.
 * Qui si convertono in millisecondi veri, così si possono calcolare i distacchi.
 */
export function packedToMs(n) {
  if (!n) return 0;
  const s = String(n).padStart(6, '0');
  const ms = Number(s.slice(-3));
  const sec = Number(s.slice(-5, -3));
  let min = Number(s.slice(0, -5) || 0);
  let h = 0;
  if (min >= 100) { h = Math.floor(min / 100); min %= 100; }   // oltre l'ora: h mm ss mmm
  return ((h * 60 + min) * 60 + sec) * 1000 + ms;
}

/* ---------------- Classifica mondiale ---------------- */

export async function sbkStandings({ year, fetchJSON }) {
  const base = `${BASE}/wsbk-results/v1/seasons/${year}/categories/SBK`;
  const [r, m] = await Promise.all([
    fetchJSON(`${base}/riders/standings`),
    fetchJSON(`${base}/manufacturers/standings`),
  ]);

  const inc = {};
  [...(r.included || []), ...(m.included || [])].forEach(x => { inc[x.type + ':' + x.id] = x.attributes; });

  const riders = (r.data || [])
    .slice().sort((a, b) => a.attributes.position - b.attributes.position)
    .map(d => {
      const rider = inc['riders:' + d.relationships?.rider?.data?.id] || {};
      const team = inc['teams:' + d.relationships?.team?.data?.id] || {};
      return {
        pos: d.attributes.position,
        name: [rider.name, rider.surname].filter(Boolean).join(' ') || ('#' + d.attributes.number),
        team: team.name || '',
        color: makerColor(team.name),
        points: d.attributes.points ?? 0,
      };
    });

  const makers = (m.data || [])
    .slice().sort((a, b) => a.attributes.position - b.attributes.position)
    .map(d => {
      const mk = inc['manufacturers:' + d.relationships?.manufacturer?.data?.id] || {};
      const name = mk.name ? mk.name.charAt(0).toUpperCase() + mk.name.slice(1) : '';
      return { pos: d.attributes.position, name, team: '', color: makerColor(name), points: d.attributes.points ?? 0 };
    });

  return {
    tables: [
      { id: 'riders', label: 'Piloti', rows: riders },
      { id: 'makers', label: 'Costruttori', rows: makers },
    ],
    source: 'WorldSBK.com',
  };
}

/* ---------------- Classifiche ---------------- */

export function sbkResultsReader({ year, fetchJSON }) {
  return async function read(weekend, session) {
    const url = `${BASE}/wsbk-results/v1/seasons/${year}/categories/SBK/rounds/${weekend.code}/sessions/${session.sourceId}/results`;
    const data = await fetchJSON(url);
    return toRows(data, session.kind);
  };
}

function toRows(data, kind) {
  const riders = {}, teams = {};
  (data.included || []).forEach(x => {
    if (x.type === 'rider') riders[x.id] = x.attributes;
    if (x.type === 'team') teams[x.id] = x.attributes;
  });

  const list = (data.data || []).slice().sort((a, b) => (a.attributes.position ?? 99) - (b.attributes.position ?? 99));
  const first = list[0]?.attributes || {};
  const leader = { laps: first.laps, time: packedToMs(first.time) };
  const isRace = kind === 'race' || kind === 'sprint';

  return list.map(r => {
    const a = { ...r.attributes, time: packedToMs(r.attributes.time) };
    const rider = riders[r.relationships?.rider?.data?.id] || {};
    const team = teams[r.relationships?.team?.data?.id] || {};
    const st = a.status || '';
    let value = '', out = false;

    if (st !== 'Classified') {
      out = true;
      if (/not.?start/i.test(st)) value = 'Non partito';
      else if (/disq|excl/i.test(st)) value = 'Squalificato';
      else if (/not.?class/i.test(st)) value = 'Non classificato';
      else value = 'Ritirato';
    } else if (isRace) {
      if (a.position === 1) value = totalFromMs(a.time);
      else if (a.laps < leader.laps) value = lapsDown(leader.laps - a.laps);
      else value = gapFromMs(a.time - leader.time);
    } else {
      if (!a.time) value = '';
      else if (a.position === 1) value = lapFromMs(a.time);
      else value = gapFromMs(a.time - leader.time);
    }

    return {
      pos: a.position ?? '–',
      name: [rider.name, rider.surname].filter(Boolean).join(' ') || ('#' + a.number),
      team: team.name || '',
      color: makerColor(team.name),
      value, out,
    };
  });
}
