/* ==========================================================
   "Stampo" per i campionati i cui dati arrivano dal robot
   (MotoGP, Moto2, Moto3, Superbike e in futuro altri).
   I file del robot sono già nel formato dell'app: qui si
   trasformano solo le date da testo a Date e i codici paese
   in nome italiano + bandiera.
   ========================================================== */

(function () {
  const { MIN, DAY } = Paddock.config;
  const U = Paddock.utils;
  const data = Paddock.api.paddockData;

  /**
   * @param {object} info  { id, name, fullName, theme }
   * @returns un campionato che rispetta il contratto di registry.js
   */
  Paddock.makeRobotSeries = function (info) {
    async function getCalendar() {
      const cal = await data.calendar(info.id, 10 * MIN);
      return {
        season: cal.season,
        updatedAt: cal.updatedAt ? new Date(cal.updatedAt) : null,
        weekends: cal.weekends.map(w => {
          const c = U.countryByCode(w.country);
          return {
            id: w.id,
            round: w.round,
            name: w.name,
            country: c.name,
            flag: c.flag,
            city: w.city,
            circuit: w.circuit,
            winners: w.winners || [],
            sessions: w.sessions.map(s => ({
              id: s.id,
              label: s.label,
              kind: s.kind,
              start: new Date(s.start),
              end: new Date(s.end),
              tbc: false,
            })),
          };
        }),
      };
    }

    async function getResults(season, weekend, session) {
      // Anche le classifiche vecchie possono cambiare (colori, correzioni del robot):
      // dopo 10 minuti si richiede il file; se non è cambiato il sito risponde subito senza riscaricarlo
      const settled = Date.now() - session.end.getTime() > DAY;
      const file = await data.weekend(info.id, weekend.id, settled ? 10 * MIN : 2 * MIN);
      const entry = file?.sessions?.[session.id];
      return { rows: entry?.rows || [], source: entry?.source || null };
    }

    async function getStandings() {
      const st = await data.standings(info.id, 10 * MIN);
      return { tables: st.tables || [], source: st.source || null, updatedAt: st.updatedAt ? new Date(st.updatedAt) : null };
    }

    return { ...info, getCalendar, getResults, getStandings };
  };
})();
