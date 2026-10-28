/* ==========================================================
   Client dei dati preparati dal robot (cartella data/)
   Il robot (scripts/update-data.mjs) gira su GitHub Actions ogni
   15 minuti e salva qui calendario e classifiche di MotoGP e SBK.
   L'app li legge come normali file del proprio sito: niente
   problemi di permessi tra siti diversi (CORS).

   Aperta con doppio clic (file://) il browser blocca la lettura
   dei .json: in quel caso si caricano i gemelli .js come <script>.
   ========================================================== */

(function () {
  const { getJSON } = Paddock.cache;
  const base = () => Paddock.config.dataBase || '';

  // no-cache: chiede sempre al sito se il file è cambiato,
  // invece di fidarsi della copia del browser
  const opts = { cache: 'no-cache' };

  /* ---------------- Modalità doppio clic ---------------- */

  const viaScript = () => location.protocol === 'file:' && !Paddock.config.dataBase;
  const received = {};

  /** Chiamata dai file data/<...>.js scritti dal robot */
  Paddock.receiveData = (key, data) => { received[key] = data; };

  function loadScript(key) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = `data/${key}.js?t=${Date.now()}`;      // sempre la versione più recente sul disco
      el.onload = () => { el.remove(); key in received ? resolve(received[key]) : reject(missing(key)); };
      el.onerror = () => { el.remove(); reject(missing(key)); };
      document.head.appendChild(el);
    });
  }

  function missing(key) {
    const err = new Error(`File data/${key}.js non trovato`);
    err.localDataMissing = true;
    return err;
  }

  /** data/<key>.json, oppure il gemello .js se l'app è aperta con doppio clic */
  function load(key, ttl) {
    return viaScript() ? loadScript(key) : getJSON(`${base()}data/${key}.json`, ttl, opts);
  }

  Paddock.api.paddockData = {
    /** data/<campionato>/calendar.json */
    async calendar(seriesId, ttl) {
      return load(`${seriesId}/calendar`, ttl);
    },

    /** data/<campionato>/standings.json (classifica mondiale) */
    async standings(seriesId, ttl) {
      return load(`${seriesId}/standings`, ttl);
    },

    /** data/<campionato>/<weekend>.json, oppure null se non esiste ancora */
    async weekend(seriesId, weekendId, ttl) {
      try {
        return await load(`${seriesId}/${weekendId}`, ttl);
      } catch (e) {
        return null;    // nessuna sessione ancora conclusa: il file non c'è
      }
    },
  };
})();
