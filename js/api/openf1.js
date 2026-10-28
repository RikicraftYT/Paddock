/* ==========================================================
   Client API OpenF1
   https://openf1.org
   Gratuita e senza chiave per i dati storici (sessioni concluse).
   I dati in tempo reale durante la sessione richiedono un
   abbonamento: qui NON li usiamo.
   Fornisce: classifiche di TUTTE le sessioni, prove libere comprese,
   con nomi, squadre e colori dei team.
   ========================================================== */

(function () {
  const BASE = Paddock.config.endpoints.openf1;
  const { getJSON } = Paddock.cache;

  Paddock.api.openf1 = {
    /** Tutte le sessioni di un anno (servono per trovare il session_key) */
    async sessions(year, ttl) {
      const data = await getJSON(`${BASE}/sessions?year=${year}`, ttl);
      return Array.isArray(data) ? data : [];
    },

    /** Classifica finale di una sessione */
    async sessionResult(sessionKey, ttl) {
      const data = await getJSON(`${BASE}/session_result?session_key=${sessionKey}`, ttl);
      return Array.isArray(data) ? data : [];
    },

    /** Piloti presenti in una sessione (nome, squadra, colore) */
    async drivers(sessionKey, ttl) {
      const data = await getJSON(`${BASE}/drivers?session_key=${sessionKey}`, ttl);
      return Array.isArray(data) ? data : [];
    },

    /**
     * Trova la sessione OpenF1 che corrisponde a una nostra sessione:
     * stesso nome e inizio entro 36 ore (tollera piccole differenze d'orario).
     */
    findSession(list, name, start) {
      return list.find(x =>
        x.session_name === name &&
        Math.abs(new Date(x.date_start) - start) < 36 * 3600e3) || null;
    },
  };
})();
