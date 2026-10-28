/* ==========================================================
   Robot dei dati di Paddock
   Scarica calendario, classifiche di sessione e classifica mondiale
   di MotoGP, Moto2, Moto3 e Superbike e li salva in data/ nel
   formato che l'app legge.

   Lo fa girare GitHub Actions ogni 15 minuti (.github/workflows/update-data.yml),
   ma si può lanciare anche a mano con Node 18 o più recente:

       node scripts/update-data.mjs                     tutti i campionati, anno in corso
       SERIES=motogp,sbk node scripts/update-data.mjs   solo alcuni
       YEAR=2026 node scripts/update-data.mjs           un anno preciso

   File prodotti, per ogni campionato:
       data/<campionato>/calendar.json      weekend e orari delle sessioni
       data/<campionato>/<weekend>.json     classifiche delle sessioni di quel weekend
       data/<campionato>/standings.json     classifica mondiale
   Ognuno ha un gemello .js per aprire l'app con doppio clic.
   ========================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { motogpCalendar, motogpResultsReader, motogpStandings, motogpTeamColors, motogpConstructors } from './sources/motogp.mjs';
import { sbkCalendar, sbkResultsReader, sbkStandings } from './sources/sbk.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const YEAR = Number(process.env.YEAR) || new Date().getUTCFullYear();
const ONLY = process.env.SERIES ? process.env.SERIES.split(',') : null;

// Una classifica di sessione si considera definitiva 3 ore dopo la fine:
// da lì in poi non viene più riscaricata. Se dopo 3 giorni è ancora vuota
// (sessione annullata) si smette comunque di chiederla.
const FINAL_AFTER_MS = 3 * 3600e3;
const GIVE_UP_AFTER_MS = 3 * 24 * 3600e3;

const motoClass = classId => ({
  calendar: o => motogpCalendar({ ...o, classId }),
  reader: o => motogpResultsReader({ ...o, classId }),
  standings: o => motogpStandings({ ...o, classId }),
  teamColors: o => motogpTeamColors({ ...o, classId }),
  constructors: motogpConstructors,
  source: 'MotoGP.com',
});

const SOURCES = {
  motogp: motoClass('motogp'),
  moto2: motoClass('moto2'),
  moto3: motoClass('moto3'),
  sbk: { calendar: sbkCalendar, reader: sbkResultsReader, standings: sbkStandings, source: 'WorldSBK.com' },
};

/* ---------------- Rete ---------------- */

let requests = 0;
const memo = new Map();           // stessa richiesta nella stessa esecuzione = una sola volta
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchJSON(url) {
  if (!memo.has(url)) memo.set(url, fetchWithRetry(url).catch(err => { memo.delete(url); throw err; }));
  return memo.get(url);
}

async function fetchWithRetry(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      requests++;
      await sleep(150);                       // gentilezza verso i server
      const res = await fetch(url, { headers: { 'User-Agent': 'Paddock personal app (GitHub Actions)', Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw err;
      await sleep(1000 * i);
    }
  }
}

/* ---------------- File ---------------- */

async function readJSON(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

/**
 * Scrive solo se il contenuto è cambiato (così il robot non fa commit inutili).
 * Accanto a ogni .json scrive un gemello .js con gli stessi dati: il browser non
 * permette di leggere i .json da una pagina aperta con doppio clic (file://),
 * ma carica senza problemi uno <script>. Vedi js/api/paddock-data.js.
 */
async function writeIfChanged(path, data) {
  const prev = await readJSON(path);
  const jsPath = path.replace(/\.json$/, '.js');
  const strip = o => JSON.stringify({ ...o, updatedAt: undefined });
  const same = prev && strip(prev) === strip(data);
  if (same && (await readFile(jsPath).then(() => true, () => false))) return false;

  const full = same ? prev : { ...data, updatedAt: new Date().toISOString() };
  const key = relative(DATA, path).replace(/\\/g, '/').replace(/\.json$/, '');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(full, null, 1) + '\n');
  await writeFile(jsPath, `Paddock.receiveData(${JSON.stringify(key)}, ${JSON.stringify(full)});\n`);
  return true;
}

/* ---------------- Lavoro per campionato ---------------- */

/** Colori delle squadre: si applicano a tutte le righe, anche alle classifiche già definitive */
function recolor(rows, colorOf, key) {
  for (const r of rows || []) {
    const c = colorOf(r[key]);
    if (c) r.color = c;
  }
}

async function updateSeries(id, def) {
  const dir = join(DATA, id);
  const now = Date.now();
  const log = (...a) => console.log(`[${id}]`, ...a);

  /* Calendario */
  const calendar = await def.calendar({ year: YEAR, fetchJSON });
  if (!calendar.weekends.length) throw new Error('calendario vuoto');

  const colorOf = def.teamColors
    ? await def.teamColors({ year: YEAR, fetchJSON }).catch(err => { log('colori squadre non disponibili:', err.message); return null; })
    : null;

  /* Classifiche di sessione */
  const read = def.reader({ year: YEAR, fetchJSON });
  let recentRace = false;
  const winners = {};       // weekend -> [{ label, name }], per il calendario della stagione
  const raceRows = [];      // classifiche di gare e sprint, per il Mondiale costruttori
  const isRace = s => s.kind === 'race' || s.kind === 'sprint';

  for (const w of calendar.weekends) {
    const ended = w.sessions.filter(s => new Date(s.end).getTime() < now);
    if (!ended.length) continue;

    const path = join(dir, `${w.id}.json`);
    const prev = (await readJSON(path)) || { weekend: w.id, sessions: {} };
    const next = { weekend: w.id, sessions: { ...prev.sessions } };

    for (const s of ended) {
      // Gare e sprint salvate prima che le righe avessero punti e costruttore: si riscaricano una volta
      const old = prev.sessions[s.id];
      const missing = def.constructors && isRace(s) && old?.rows?.length > 0 && !('maker' in old.rows[0]);
      if (old?.final && !missing) continue;
      if (s.kind === 'race' || s.kind === 'sprint') recentRace = true;
      try {
        const rows = await read(w, s);
        const age = now - new Date(s.end).getTime();
        const final = (rows.length > 0 && age > FINAL_AFTER_MS) || age > GIVE_UP_AFTER_MS;
        next.sessions[s.id] = { final, source: def.source, rows };
      } catch (err) {
        log(`classifica ${w.id} ${s.id} non disponibile:`, err.message);
      }
    }
    if (colorOf) Object.values(next.sessions).forEach(s => recolor(s.rows, colorOf, 'team'));
    if (await writeIfChanged(path, next)) log(`classifiche ${w.id} aggiornate`);

    w.sessions.filter(isRace).forEach(s => { if (next.sessions[s.id]) raceRows.push(next.sessions[s.id].rows || []); });

    winners[w.id] = w.sessions
      .filter(s => s.kind === 'race')
      .map(s => ({ label: s.label, first: next.sessions[s.id]?.rows?.[0] }))
      .filter(x => String(x.first?.pos) === '1')
      .map(x => ({ label: x.label, name: x.first.name }));
  }

  /* Calendario (dopo le classifiche, perché contiene i vincitori).
     Quello pubblico non ha bisogno dei codici interni usati per le classifiche. */
  const publicCal = {
    ...calendar,
    weekends: calendar.weekends.map(({ code, ...w }) => ({
      ...w,
      ...(winners[w.id]?.length ? { winners: winners[w.id] } : {}),
      sessions: w.sessions.map(({ sourceId, srcKey, ...s }) => s),
    })),
  };
  if (await writeIfChanged(join(dir, 'calendar.json'), publicCal)) log('calendario aggiornato');

  /* Classifica mondiale: si riscarica se c'è stata da poco una gara, se manca,
     e comunque una volta ogni 6 ore (per penalità o correzioni successive) */
  const standingsPath = join(dir, 'standings.json');
  const t = new Date();
  const periodic = t.getUTCHours() % 6 === 0 && t.getUTCMinutes() < 15;
  if (recentRace || periodic || !(await readJSON(standingsPath))) {
    try {
      const st = await def.standings({ year: YEAR, fetchJSON });
      if (await writeIfChanged(standingsPath, { series: id, season: String(YEAR), ...st })) log('mondiale aggiornato');
    } catch (err) {
      log('classifica mondiale non disponibile:', err.message);
    }
  }

  // Squadre: nella tabella "teams" il nome della squadra è in name, altrove in team
  const saved = (colorOf || def.constructors) && (await readJSON(standingsPath));
  if (saved) {
    const { updatedAt, ...rest } = saved;
    if (colorOf) rest.tables.forEach(tb => recolor(tb.rows, colorOf, tb.id === 'teams' ? 'name' : 'team'));

    // Costruttori subito dopo i piloti; solo se tutte le gare hanno già punti e costruttore
    if (def.constructors && raceRows.every(rows => rows.every(r => 'maker' in r))) {
      const others = rest.tables.filter(tb => tb.id !== 'constructors');
      const rows = def.constructors(raceRows);
      if (rows.length) rest.tables = [others[0], { id: 'constructors', label: 'Costruttori', rows }, ...others.slice(1)];
    }
    if (await writeIfChanged(standingsPath, rest)) log('mondiale aggiornato (colori e costruttori)');
  }
}

/* ---------------- Avvio ---------------- */

let failures = 0;
const ids = Object.keys(SOURCES).filter(id => !ONLY || ONLY.includes(id));

for (const id of ids) {
  try {
    await updateSeries(id, SOURCES[id]);
  } catch (err) {
    failures++;
    console.error(`[${id}] ERRORE:`, err.message);
  }
}

console.log(`Fatto: ${requests} richieste, ${failures} campionati con errori.`);
// Esce con errore solo se non è riuscito niente, così GitHub ti avvisa per email
process.exit(failures === ids.length ? 1 : 0);
