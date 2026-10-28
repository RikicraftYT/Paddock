/* ==========================================================
   Funzioni di utilità condivise da tutti i campionati:
   date, tempi sul giro, bandiere, nomi dei paesi.
   ========================================================== */

(function () {
  const { MIN, H, DAY, locale } = Paddock.config;

  // Nome paese (come arriva dalle API, in inglese) -> codice ISO a 2 lettere
  const COUNTRY_CODES = {
    'Australia': 'AU', 'China': 'CN', 'Japan': 'JP', 'Bahrain': 'BH', 'Saudi Arabia': 'SA',
    'USA': 'US', 'United States': 'US', 'Canada': 'CA', 'Monaco': 'MC', 'Spain': 'ES',
    'Austria': 'AT', 'UK': 'GB', 'United Kingdom': 'GB', 'Great Britain': 'GB', 'Belgium': 'BE',
    'Hungary': 'HU', 'Netherlands': 'NL', 'Italy': 'IT', 'Azerbaijan': 'AZ', 'Singapore': 'SG',
    'Mexico': 'MX', 'Brazil': 'BR', 'Qatar': 'QA', 'UAE': 'AE', 'United Arab Emirates': 'AE',
    'Portugal': 'PT', 'Turkey': 'TR', 'Germany': 'DE', 'France': 'FR', 'Argentina': 'AR',
    'Thailand': 'TH', 'Indonesia': 'ID', 'Malaysia': 'MY', 'India': 'IN', 'South Africa': 'ZA',
    'Korea': 'KR', 'Vietnam': 'VN', 'Russia': 'RU', 'Czech Republic': 'CZ', 'Czechia': 'CZ',
    'San Marino': 'SM', 'Kazakhstan': 'KZ',
  };

  const regionNames = (() => {
    try { return new Intl.DisplayNames(['it'], { type: 'region' }); } catch (e) { return null; }
  })();

  Paddock.utils = {
    /** Protegge il testo prima di inserirlo nell'HTML */
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    /** Paese (nome inglese, es. "Italy") -> { code, name (in italiano), flag (emoji) } */
    country(englishName) {
      return this.countryByCode(COUNTRY_CODES[englishName] || null, englishName);
    },

    /** Codice ISO a 2 lettere (es. "IT") -> { code, name (in italiano), flag (emoji) } */
    countryByCode(code, fallbackName = '') {
      const name = code && regionNames ? regionNames.of(code) : (fallbackName || code || '');
      const flag = code
        ? code.replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))
        : '🏁';
      return { code, name, flag };
    },

    /** Data "2026-10-25" + ora "19:00:00Z" -> Date (ora sconosciuta = mezzogiorno UTC) */
    toDate(date, time) {
      return date ? new Date(date + 'T' + (time || '12:00:00Z')) : null;
    },

    fmtDay:  d => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }),
    fmtTime: d => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    fmtLong: d => d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),

    /** Millisecondi -> "tra 2g 4h", "tra 3h 10m", "tra 12m" */
    until(ms) {
      const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / H), m = Math.floor((ms % H) / MIN);
      if (d > 0) return `tra ${d}g ${h}h`;
      if (h > 0) return `tra ${h}h ${m}m`;
      return `tra ${m}m`;
    },

    /** Secondi -> "1:23.456" (tempo sul giro) */
    lapTime(sec) {
      if (sec == null || isNaN(sec)) return '';
      const m = Math.floor(sec / 60), s = sec - m * 60;
      return m ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
    },

    /** Secondi -> "1:32:10.123" (tempo totale di gara) */
    totalTime(sec) {
      if (sec == null || isNaN(sec)) return '';
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec - h * 3600 - m * 60;
      return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + ':' + s.toFixed(3).padStart(6, '0');
    },

    /** 265.5 -> "265,5" */
    points(n) {
      return Number(n || 0).toLocaleString(locale, { maximumFractionDigits: 1 });
    },

    /** "VERSTAPPEN" -> "Verstappen" */
    titleCase(s) {
      return (s || '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
    },

    /** Stato di una sessione rispetto all'ora attuale */
    sessionStatus(session, now = new Date()) {
      if (now >= session.end) return 'done';
      if (now >= session.start) return 'live';
      return 'next';
    },
  };
})();
