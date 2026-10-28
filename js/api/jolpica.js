/* ==========================================================
   Client API Jolpica (successore di Ergast)
   https://github.com/jolpica/jolpica-f1
   Gratuita, senza chiave. Limiti: 4 richieste/secondo, 500/ora.
   Fornisce: calendario con orari di tutte le sessioni,
   risultati di qualifiche, sprint e gara.
   NON fornisce: classifiche delle prove libere (-> OpenF1).
   ========================================================== */

(function () {
  const BASE = Paddock.config.endpoints.jolpica;
  const { getJSON } = Paddock.cache;

  Paddock.api.jolpica = {
    /** Calendario della stagione in corso */
    async calendar(ttl) {
      const data = await getJSON(`${BASE}/current.json?limit=100`, ttl);
      const table = data.MRData.RaceTable;
      return { season: table.season, races: table.Races };
    },

    /** Risultati della gara */
    async raceResults(season, round, ttl) {
      return firstRace(await getJSON(`${BASE}/${season}/${round}/results.json?limit=100`, ttl));
    },

    /** Vincitori delle gare già corse: { round: "Nome Cognome" } (una sola richiesta) */
    async winners(season, ttl) {
      const data = await getJSON(`${BASE}/${season}/results/1.json?limit=100`, ttl);
      const out = {};
      (data.MRData.RaceTable.Races || []).forEach(r => {
        const d = r.Results?.[0]?.Driver;
        if (d) out[r.round] = `${d.givenName} ${d.familyName}`;
      });
      return out;
    },

    /** Risultati della sprint */
    async sprintResults(season, round, ttl) {
      return firstRace(await getJSON(`${BASE}/${season}/${round}/sprint.json?limit=100`, ttl));
    },

    /** Risultati delle qualifiche (Q1, Q2, Q3) */
    async qualifyingResults(season, round, ttl) {
      return firstRace(await getJSON(`${BASE}/${season}/${round}/qualifying.json?limit=100`, ttl));
    },

    /** Classifica piloti (pronta per una futura schermata) */
    async driverStandings(season, ttl) {
      const data = await getJSON(`${BASE}/${season}/driverstandings.json?limit=100`, ttl);
      return data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
    },

    /** Classifica costruttori (pronta per una futura schermata) */
    async constructorStandings(season, ttl) {
      const data = await getJSON(`${BASE}/${season}/constructorstandings.json?limit=100`, ttl);
      return data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
    },
  };

  function firstRace(data) {
    return data?.MRData?.RaceTable?.Races?.[0] || null;
  }
})();
