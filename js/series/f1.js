/* ==========================================================
   Campionato: Formula 1
   Unisce Jolpica (calendario + qualifiche/sprint/gara) e
   OpenF1 (tutte le sessioni, prove libere comprese).
   Rispetta il "contratto" dei campionati descritto in registry.js.
   ========================================================== */

(function () {
  const { MIN, H, DAY } = Paddock.config;
  const U = Paddock.utils;
  const jolpica = Paddock.api.jolpica;
  const openf1 = Paddock.api.openf1;

  // Sessioni del weekend: chiave Jolpica, etichetta, nome OpenF1, tipo, durata stimata (min)
  const SESSIONS = [
    { key: 'FirstPractice',    label: 'Libere 1',          of1: 'Practice 1',        kind: 'practice',   dur: 60 },
    { key: 'SecondPractice',   label: 'Libere 2',          of1: 'Practice 2',        kind: 'practice',   dur: 60 },
    { key: 'ThirdPractice',    label: 'Libere 3',          of1: 'Practice 3',        kind: 'practice',   dur: 60 },
    { key: 'SprintQualifying', label: 'Qualifiche Sprint', of1: 'Sprint Qualifying', kind: 'sprintQuali', dur: 45 },
    { key: 'Sprint',           label: 'Sprint',            of1: 'Sprint',            kind: 'sprint',     dur: 60 },
    { key: 'Qualifying',       label: 'Qualifiche',        of1: 'Qualifying',        kind: 'quali',      dur: 60 },
  ];
  const RACE = { key: 'Race', label: 'Gara', of1: 'Race', kind: 'race', dur: 120 };

  // Colori squadra quando i dati arrivano da Jolpica (OpenF1 li fornisce già)
  const TEAM_COLORS = {
    red_bull: '#3671C6', ferrari: '#E8002D', mercedes: '#27F4D2', mclaren: '#FF8000',
    aston_martin: '#229971', alpine: '#0093CC', williams: '#64C4FF', rb: '#6692FF',
    sauber: '#52E252', audi: '#BB0A30', haas: '#B6BABD', cadillac: '#C9C9C9',
  };

  /* ---------------- Calendario ---------------- */

  function toWeekend(race) {
    const sessions = [];
    for (const s of SESSIONS) {
      const info = race[s.key];
      if (info) sessions.push(makeSession(s, info.date, info.time));
    }
    sessions.push(makeSession(RACE, race.date, race.time));
    sessions.sort((a, b) => a.start - b.start);

    const loc = race.Circuit?.Location || {};
    const country = U.country(loc.country);
    return {
      id: `f1-${race.season}-${race.round}`,
      round: Number(race.round),
      name: race.raceName,
      country: country.name,
      flag: country.flag,
      city: loc.locality || '',
      circuit: race.Circuit?.circuitName || '',
      sessions,
    };
  }

  function makeSession(def, date, time) {
    const start = U.toDate(date, time);
    return {
      id: def.key,
      label: def.label,
      kind: def.kind,
      of1: def.of1,
      start,
      end: new Date(start.getTime() + def.dur * MIN),
      tbc: !time,               // orario non ancora confermato
    };
  }

  async function getCalendar() {
    const { season, races } = await jolpica.calendar(6 * H);
    // I vincitori servono solo al calendario della stagione: se non arrivano, pazienza
    const winners = await jolpica.winners(season, H).catch(() => ({}));
    const weekends = races.map(toWeekend);
    weekends.forEach(w => { if (winners[w.round]) w.winners = [{ label: 'Gara', name: winners[w.round] }]; });
    return { season, weekends, updatedAt: new Date() };
  }

  /* ---------------- Classifiche ---------------- */

  async function getResults(season, weekend, session) {
    const endedAgo = Date.now() - session.end.getTime();
    const settled = endedAgo > DAY;              // dopo un giorno i risultati non cambiano più
    const ttl = settled ? 30 * DAY : 3 * MIN;

    // 1) OpenF1: copre tutte le sessioni
    try {
      const all = await openf1.sessions(season, settled ? 7 * DAY : 10 * MIN);
      const match = openf1.findSession(all, session.of1, session.start);
      if (match) {
        const [res, drivers] = await Promise.all([
          openf1.sessionResult(match.session_key, ttl),
          openf1.drivers(match.session_key, ttl),
        ]);
        if (res.length) return { rows: fromOpenF1(res, drivers, session.kind), source: 'OpenF1' };
      }
    } catch (e) {
      console.warn('[F1] OpenF1 non disponibile, passo a Jolpica', e);
    }

    // 2) Jolpica: solo qualifiche, sprint e gara
    let race = null;
    if (session.kind === 'race')   race = await jolpica.raceResults(season, weekend.round, ttl);
    if (session.kind === 'sprint') race = await jolpica.sprintResults(season, weekend.round, ttl);
    if (session.kind === 'quali')  race = await jolpica.qualifyingResults(season, weekend.round, ttl);
    if (!race) return { rows: [], source: null };
    return { rows: fromJolpica(race, session.kind), source: 'Jolpica' };
  }

  /* --- Conversione dati OpenF1 -> righe di classifica --- */
  function fromOpenF1(results, drivers, kind) {
    const byNumber = {};
    drivers.forEach(d => { byNumber[d.driver_number] = d; });
    const isQuali = kind === 'quali' || kind === 'sprintQuali';

    return results
      .slice()
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
      .map(r => {
        const d = byNumber[r.driver_number] || {};
        let value = '', out = false;

        if (r.dsq)      { value = 'Squalificato'; out = true; }
        else if (r.dns) { value = 'Non partito';  out = true; }
        else if (r.dnf) { value = 'Ritirato';     out = true; }
        else if (isQuali) {
          // duration è [Q1, Q2, Q3]: mostro il miglior turno raggiunto
          const times = Array.isArray(r.duration) ? r.duration : [r.duration];
          value = U.lapTime([...times].reverse().find(t => t != null));
        } else if (r.position === 1) {
          value = kind === 'practice' ? U.lapTime(r.duration) : U.totalTime(r.duration);
        } else {
          const gap = Array.isArray(r.gap_to_leader) ? r.gap_to_leader.at(-1) : r.gap_to_leader;
          value = formatGap(gap);
        }

        return {
          pos: r.position ?? '–',
          name: U.titleCase(d.last_name || d.broadcast_name || ('#' + r.driver_number)),
          team: d.team_name || '',
          color: d.team_colour ? '#' + d.team_colour : null,
          value, out,
        };
      });
  }

  function formatGap(g) {
    if (g == null) return '';
    if (typeof g === 'number') return '+' + g.toFixed(3);
    return String(g).replace(/LAPS/i, 'giri').replace(/LAP/i, 'giro');
  }

  /* --- Conversione dati Jolpica -> righe di classifica --- */
  function fromJolpica(race, kind) {
    const list = kind === 'quali' ? race.QualifyingResults
               : kind === 'sprint' ? race.SprintResults
               : race.Results;

    return (list || []).map(r => {
      let value = '', out = false;
      if (kind === 'quali') value = r.Q3 || r.Q2 || r.Q1 || '';
      else if (r.Time?.time) value = r.Time.time;
      else ({ value, out } = translateStatus(r.status));

      return {
        pos: r.position,
        name: r.Driver.familyName,
        team: r.Constructor?.name || '',
        color: TEAM_COLORS[r.Constructor?.constructorId] || null,
        value, out,
      };
    });
  }

  function translateStatus(st) {
    if (!st || st === 'Finished') return { value: '', out: false };
    const laps = st.match(/^\+(\d+) Laps?$/);
    if (laps) return { value: `+${laps[1]} ${laps[1] === '1' ? 'giro' : 'giri'}`, out: false };
    if (st === 'Lapped') return { value: 'Doppiato', out: false };
    if (/not start/i.test(st)) return { value: 'Non partito', out: true };
    if (/disqualified/i.test(st)) return { value: 'Squalificato', out: true };
    return { value: 'Ritirato', out: true };
  }

  /* ---------------- Classifica mondiale ---------------- */

  async function getStandings(season) {
    const ttl = 30 * MIN;
    const [drivers, teams] = await Promise.all([
      jolpica.driverStandings(season, ttl),
      jolpica.constructorStandings(season, ttl),
    ]);
    return {
      tables: [
        {
          id: 'drivers', label: 'Piloti',
          rows: drivers.map(d => {
            const c = d.Constructors?.[d.Constructors.length - 1];
            return {
              pos: d.position ?? d.positionText,
              name: `${d.Driver.givenName} ${d.Driver.familyName}`,
              team: c?.name || '',
              color: TEAM_COLORS[c?.constructorId] || null,
              points: Number(d.points),
            };
          }),
        },
        {
          id: 'constructors', label: 'Costruttori',
          rows: teams.map(t => ({
            pos: t.position ?? t.positionText,
            name: t.Constructor.name,
            team: '',
            color: TEAM_COLORS[t.Constructor.constructorId] || null,
            points: Number(t.points),
          })),
        },
      ],
      source: 'Jolpica',
    };
  }

  /* ---------------- Registrazione ---------------- */
  Paddock.series.f1 = {
    id: 'f1',
    name: 'F1',
    fullName: 'Formula 1',
    // Giallo con testo scuro sopra: il bianco sul giallo non si legge
    theme: { accent: '#f5c400', onAccent: '#1a1400', textDark: '#fcd34d', textLight: '#7a5c00' },
    getCalendar,
    getResults,
    getStandings,
  };
})();
