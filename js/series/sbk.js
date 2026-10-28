/* ==========================================================
   Campionato: Superbike (WorldSBK)
   Dati preparati dal robot (scripts/sources/sbk.mjs) e letti
   da data/sbk/. Sessioni: Libere 1-2-3, Superpole, Gara 1,
   Superpole Race, Gara 2.
   Colore marrone, con testo bianco sopra.
   ========================================================== */

Paddock.series.sbk = Paddock.makeRobotSeries({
  id: 'sbk',
  name: 'SBK',
  fullName: 'Superbike',
  theme: { accent: '#8b5a2b', onAccent: '#ffffff', textDark: '#d4a373', textLight: '#7c4a1e', badge: 'solid' },
});
