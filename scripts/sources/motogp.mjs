/* ==========================================================
   Fonte: MotoGP, Moto2 e Moto3 (servizi Pulselive usati da motogp.com)
   - Calendario e orari: api.pulselive.motogp.com  (orari con fuso corretto)
   - Classifiche:        api.motogp.pulselive.com  (Results API)
   Non sono API ufficiali documentate: se cambiano, si corregge solo questo file.
   ========================================================== */

import { toUtcIso, addMinutes, titleCase, cleanTime, lapsDown, makerColor, iso2 } from '../lib/format.mjs';

const BROADCAST = 'https://api.pulselive.motogp.com/motogp/v1';
const RESULTS = 'https://api.motogp.pulselive.com/motogp/v1';

// Sessioni mostrate nell'app (sigla ufficiale -> etichetta, tipo, durata di riserva in minuti)
const SESSIONS = {
  FP1: { label: 'Libere 1',     kind: 'practice', dur: 45 },
  PR:  { label: 'Practice',     kind: 'practice', dur: 60 },
  FP2: { label: 'Libere 2',     kind: 'practice', dur: 30 },
  Q1:  { label: 'Qualifiche 1', kind: 'quali',    dur: 15 },
  Q2:  { label: 'Qualifiche 2', kind: 'quali',    dur: 15 },
  SPR: { label: 'Sprint',       kind: 'sprint',   dur: 25 },
  RAC: { label: 'Gara',         kind: 'race',     dur: 45 },
};

// Le tre classi: sigla nel calendario e numero nella Results API
export const CLASSES = {
  motogp: { acronym: 'MGP', legacyId: 3, name: 'MotoGP' },
  moto2:  { acronym: 'MT2', legacyId: 2, name: 'Moto2' },
  moto3:  { acronym: 'MT3', legacyId: 1, name: 'Moto3' },
};

/** "RAC2" (gara ripartita) -> "RAC" */
const normalize = code => (/^RAC\d+$/.test(code) ? 'RAC' : code);

/* ---------------- Calendario ---------------- */

export async function motogpCalendar({ year, fetchJSON, classId = 'motogp' }) {
  const cls = CLASSES[classId];
  const events = await fetchJSON(`${BROADCAST}/events?seasonYear=${year}`);
  const gps = events
    .filter(e => e.kind === 'GP')
    .sort((a, b) => toUtcIso(a.date_start).localeCompare(toUtcIso(b.date_start)));

  const weekends = gps.map((e, i) => {
    const byId = {};
    (e.broadcasts || [])
      .filter(b => b.category?.acronym === cls.acronym && b.type === 'SESSION' && SESSIONS[normalize(b.shortname)])
      .forEach(b => {
        const id = normalize(b.shortname);
        const def = SESSIONS[id];
        const start = toUtcIso(b.date_start);
        let end = toUtcIso(b.date_end);
        if (!end || end <= start) end = addMinutes(start, def.dur);
        // se ci sono due "gare" (RAC e RAC2) vale l'ultima
        if (!byId[id] || byId[id].start < start) {
          byId[id] = { id, srcKey: b.shortname, label: def.label, kind: def.kind, start, end };
        }
      });

    return {
      id: `${year}-${e.shortname}`,
      code: e.shortname,
      round: i + 1,
      name: titleCase(e.name),
      country: iso2(e.country || e.circuit?.iso_code),
      city: e.circuit?.city || '',
      circuit: e.circuit?.name || '',
      sessions: Object.values(byId).sort((a, b) => a.start.localeCompare(b.start)),
    };
  });

  return { series: classId, season: String(year), weekends };
}

/* ---------------- Colori delle squadre ---------------- */

// Il servizio dà a ogni squadra il colore delle grafiche di motogp.com.
// #262626 vuol dire "non impostato": lì si usa il colore della livrea,
// o in mancanza quello del costruttore.
const NO_COLOR = '#262626';
const LIVERY = [
  ['vr46', '#FFD200'],
  ['pramac', '#8E44AD'],
  ['tech3', '#2B4C9B'],
  ['trackhouse', '#1E90FF'],
  ['intact', '#1F5AA6'],
];

// MotoGP: colori scelti a mano, con la precedenza su quelli del servizio.
// L'ordine conta: prima le squadre satellite, poi le case ("gresini" va prima di "ducati").
const MOTOGP_COLORS = [
  ['gresini', '#92A8D1'],
  ['vr46', '#CCFF00'],
  ['pramac', '#1A53D8'],
  ['tech3', '#E96B1E'],
  ['lcr', '#E0E0E0'],
  ['trackhouse', '#008DD2'],
  ['aprilia', '#8A2BE2'],
  ['ducati', '#C51E14'],
  ['ktm', '#F37021'],
  ['yamaha', '#0033A0'],
  ['honda', '#D01012'],
];

// Parole che non aiutano a riconoscere una squadra
const STOP = new Set(['team', 'racing', 'motogp', 'moto2', 'moto3', 'the']);
const words = s => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w));
const compact = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function teamColor(t, classId) {
  if (classId === 'motogp') {
    const own = MOTOGP_COLORS.find(([k]) => compact(t.name).includes(k));
    if (own) return own[1];
  }
  const c = String(t.color || '').toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c) && c !== NO_COLOR) return c.toUpperCase();
  const hit = LIVERY.find(([k]) => compact(t.name).includes(k));
  return hit ? hit[1] : makerColor(t.constructor?.name, t.name);
}

/**
 * Restituisce una funzione: nome squadra (come nelle classifiche) -> { name, color }, o null.
 * name è il nome ufficiale della squadra: "Pro Honda LCR" e "Castrol Honda LCR" sono
 * entrambe "Honda LCR". I nomi delle classifiche cambiano con gli sponsor,
 * quindi si sceglie la squadra con più parole in comune.
 */
export async function motogpTeams({ year, fetchJSON, classId = 'motogp' }) {
  const cats = await fetchJSON(`${BROADCAST}/categories?seasonYear=${year}`);
  const cat = cats.find(c => compact(c.name).startsWith(compact(CLASSES[classId].name)));
  if (!cat) return () => null;
  const teams = (await fetchJSON(`${BROADCAST}/teams?categoryUuid=${cat.id}&seasonYear=${year}`))
    .map(t => ({ words: words(t.name), name: t.name, color: teamColor(t, classId) }))
    .filter(t => t.words.length);

  const memo = {};
  return name => {
    if (!name) return null;
    if (name in memo) return memo[name];
    const c = compact(name);
    let best = null, score = 0;
    for (const t of teams) {
      const s = t.words.filter(w => c.includes(w)).length / t.words.length;
      if (s > score) { score = s; best = t; }
    }
    return (memo[name] = score >= 0.6 ? { name: best.name, color: best.color } : null);
  };
}

/* ---------------- Identificativi della Results API ---------------- */

// Condivisi tra le tre classi nella stessa esecuzione del robot
const shared = { seasonId: {}, events: {} };

async function seasonId(year, fetchJSON) {
  if (!shared.seasonId[year]) {
    const seasons = await fetchJSON(`${RESULTS}/results/seasons`);
    const id = seasons.find(s => s.year === Number(year))?.id;
    if (!id) throw new Error(`Stagione MotoGP ${year} non trovata`);
    shared.seasonId[year] = id;
  }
  return shared.seasonId[year];
}

async function categoryId(year, fetchJSON, classId) {
  const sid = await seasonId(year, fetchJSON);
  const cats = await fetchJSON(`${RESULTS}/results/categories?seasonUuid=${sid}`);
  const c = cats.find(x => x.legacy_id === CLASSES[classId].legacyId);
  if (!c) throw new Error(`Categoria ${classId} non trovata`);
  return c.id;
}

/* ---------------- Classifiche di sessione ---------------- */

export function motogpResultsReader({ year, fetchJSON, classId = 'motogp' }) {
  const sessionCache = {};

  async function sessionsFor(code) {
    if (sessionCache[code]) return sessionCache[code];
    const sid = await seasonId(year, fetchJSON);
    if (!shared.events[year]) {
      shared.events[year] = (await fetchJSON(`${RESULTS}/results/events?seasonUuid=${sid}`)).filter(e => !e.test);
    }
    const ev = shared.events[year].find(e => e.short_name === code);
    if (!ev) return (sessionCache[code] = {});

    const cats = await fetchJSON(`${RESULTS}/results/categories?eventUuid=${ev.id}`);
    const cat = cats.find(c => c.legacy_id === CLASSES[classId].legacyId);
    if (!cat) return (sessionCache[code] = {});

    const list = await fetchJSON(`${RESULTS}/results/sessions?eventUuid=${ev.id}&categoryUuid=${cat.id}`);
    const map = {};
    list.forEach(s => { map[s.type + (s.number ?? '')] = s.id; });   // FP1, PR, FP2, Q1, Q2, SPR, RAC, RAC2…
    return (sessionCache[code] = map);
  }

  return async function read(weekend, session) {
    const ids = await sessionsFor(weekend.code);
    // gara ripartita: prima la sigla esatta (RAC2), poi RAC, poi qualunque RACn
    const id = ids[session.srcKey] || ids[session.id] ||
      Object.entries(ids).filter(([k]) => k.startsWith(session.id)).map(([, v]) => v).at(-1);
    if (!id) return [];
    const data = await fetchJSON(`${RESULTS}/results/session/${id}/classification?test=false`);
    return toRows(data.classification || [], session.kind);
  };
}

function toRows(list, kind) {
  const isRace = kind === 'race' || kind === 'sprint';
  return list.map(r => {
    let value = '', out = false;
    const st = r.status || '';

    if (isRace) {
      if (st === 'INSTND') {
        if (r.position === 1) value = cleanTime(r.time);
        else if (Number(r.gap?.lap) > 0) value = lapsDown(Number(r.gap.lap));
        else value = '+' + (r.gap?.first ?? '');
      } else if (/NOTSTART|DNS/i.test(st)) { value = 'Non partito'; out = true; }
      else if (/DSQ|DISQ|EXCL/i.test(st))  { value = 'Squalificato'; out = true; }
      else { value = 'Ritirato'; out = true; }
    } else {
      const lap = cleanTime(r.best_lap?.time);
      if (!lap) value = '';
      else if (r.position === 1) value = lap;
      else value = '+' + (r.gap?.first ?? '');
    }

    return {
      pos: r.position ?? '–',
      name: r.rider?.full_name || '',
      team: r.team?.name || '',
      color: makerColor(r.constructor?.name, r.team?.name),
      value, out,
      // Gare e sprint: punti ufficiali e costruttore, per il Mondiale costruttori
      ...(isRace ? { points: Number(r.points) || 0, maker: r.constructor?.name || '' } : {}),
    };
  });
}

/* ---------------- Mondiale costruttori ---------------- */

/**
 * Il servizio non lo fornisce, quindi si calcola come da regolamento:
 * in ogni gara e sprint ogni casa prende i punti del suo pilota meglio piazzato.
 * Si usano i punti ufficiali della sessione, così valgono anche le gare a punteggio dimezzato.
 * @param raceSessions  righe di classifica di tutte le gare e sprint della stagione
 */
export function motogpConstructors(raceSessions) {
  const total = {};
  for (const rows of raceSessions) {
    const best = {};
    for (const r of rows) {
      if (!r.maker) continue;
      best[r.maker] = Math.max(best[r.maker] || 0, Number(r.points) || 0);
    }
    for (const [maker, pts] of Object.entries(best)) total[maker] = (total[maker] || 0) + pts;
  }
  return Object.entries(total)
    .sort((a, b) => b[1] - a[1])
    .map(([name, points], i) => ({ pos: i + 1, name, team: '', color: makerColor(name), points }));
}

/* ---------------- Classifica mondiale ---------------- */

/**
 * Piloti: dal servizio ufficiale.
 * Squadre: il servizio non le fornisce; la classifica a squadre della MotoGP
 * è la somma dei punti dei piloti della squadra, quindi si calcola da qui.
 * (Un pilota che ha cambiato squadra a metà stagione viene contato
 * tutto nella squadra attuale: piccola approssimazione.)
 */
export async function motogpStandings({ year, fetchJSON, classId = 'motogp' }) {
  const sid = await seasonId(year, fetchJSON);
  const cid = await categoryId(year, fetchJSON, classId);
  const data = await fetchJSON(`${RESULTS}/results/standings?seasonUuid=${sid}&categoryUuid=${cid}`);
  const list = data.classification || [];

  const riders = list.map(r => ({
    pos: r.position,
    name: r.rider?.full_name || '',
    team: r.team?.name || '',
    color: makerColor(r.constructor?.name, r.team?.name),
    points: r.points ?? 0,
  }));

  const teamMap = {};
  list.forEach(r => {
    const name = r.team?.name;
    if (!name) return;
    const t = teamMap[name] || (teamMap[name] = { name, team: r.constructor?.name || '', color: makerColor(r.constructor?.name, name), points: 0 });
    t.points += Number(r.points) || 0;
  });
  const teams = Object.values(teamMap)
    .sort((a, b) => b.points - a.points)
    .map((t, i) => ({ pos: i + 1, ...t, points: Math.round(t.points * 10) / 10 }));

  return {
    tables: [
      { id: 'riders', label: 'Piloti', rows: riders },
      { id: 'teams', label: 'Squadre', note: 'Somma dei punti dei piloti di ogni squadra.', rows: teams },
    ],
    source: 'MotoGP.com',
  };
}
