/* ==========================================================
   Scaricamento dati con cache locale.
   - Ogni risposta viene salvata nel telefono con l'ora di salvataggio.
   - Se è ancora "fresca" (entro ttl) non si rifà la richiesta:
     l'app è più veloce e si rispettano i limiti dei servizi gratuiti.
   - Se la rete non risponde, si usa l'ultima copia salvata.
   ========================================================== */

(function () {
  const PREFIX = 'paddock:c:';
  const { DAY } = Paddock.config;

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* memoria piena o privata */ } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) {} },
    keys() { try { return Object.keys(localStorage); } catch (e) { return []; } },
  };

  Paddock.cache = {
    store,

    /**
     * Scarica un JSON usando la cache.
     * @param {string} url
     * @param {number} ttl  validità della copia salvata, in ms
     * @param {object} [fetchOptions]  opzioni passate a fetch (es. { cache: 'no-cache' })
     */
    async getJSON(url, ttl, fetchOptions) {
      const key = PREFIX + url;
      const cached = store.get(key);
      if (cached && Date.now() - cached.t < ttl) return cached.d;

      try {
        const res = await fetch(url, fetchOptions);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const isEmpty = Array.isArray(data) && data.length === 0;
        if (!isEmpty) store.set(key, { t: Date.now(), d: data });
        return data;
      } catch (err) {
        if (cached) return cached.d;   // offline: meglio un dato vecchio che niente
        throw err;
      }
    },

    /**
     * Svuota le copie recenti (ultimi 2 giorni) per forzare l'aggiornamento.
     * Le classifiche vecchie restano: non cambiano più.
     */
    clearRecent() {
      store.keys()
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => {
          const c = store.get(k);
          if (!c || Date.now() - c.t < 2 * DAY) store.remove(k);
        });
    },
  };
})();
