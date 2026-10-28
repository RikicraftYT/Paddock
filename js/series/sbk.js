/* ==========================================================
   Campionato: Superbike (WorldSBK)
   Dati preparati dal robot (scripts/sources/sbk.mjs) e letti
   da data/sbk/. Sessioni: Libere 1-2-3, Superpole, Gara 1,
   Superpole Race, Gara 2.
   Il giallo ha testo scuro sopra: il bianco sul giallo non si legge.
   ========================================================== */

Paddock.series.sbk = Paddock.makeRobotSeries({
  id: 'sbk',
  name: 'SBK',
  fullName: 'Superbike',
  theme: { accent: '#f2b705', onAccent: '#1a1400', textDark: '#f2b705', textLight: '#7a5a00' },
});
