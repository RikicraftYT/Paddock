/* ==========================================================
   Configurazione generale
   Tutto il codice vive nell'oggetto globale `Paddock`, diviso
   in sezioni: config, utils, cache, api, series, ui.
   ========================================================== */

window.Paddock = window.Paddock || { api: {}, series: {}, ui: {} };

Paddock.config = {
  // Indirizzi dei servizi dati (tutti gratuiti, senza chiave)
  endpoints: {
    jolpica: 'https://api.jolpi.ca/ergast/f1',
    openf1: 'https://api.openf1.org/v1',
  },

  // Dove si trovano i file preparati dal robot (cartella data/).
  // Vuoto = accanto all'app, che è il caso normale su GitHub Pages.
  // Per provare l'app aprendo index.html dal computer, metti qui l'indirizzo
  // del tuo sito, ad esempio 'https://tuonome.github.io/paddock/'.
  dataBase: '',

  // Unità di tempo in millisecondi, comode per le durate della cache
  MIN: 60e3,
  H: 3600e3,
  DAY: 24 * 3600e3,

  // Campionato aperto al primo avvio
  defaultSeries: 'f1',

  locale: 'it-IT',
};
