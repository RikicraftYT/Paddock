/* ==========================================================
   Campionati: MotoGP, Moto2, Moto3
   Dati preparati dal robot (scripts/sources/motogp.mjs) e letti
   da data/motogp/, data/moto2/, data/moto3/.
   Le tre classi stanno nello stesso gruppo "MotoGP" (registry.js).
   ========================================================== */

(function () {
  // Tinte fredde, distinte dal rosso della F1 e dal giallo della SBK:
  // MotoGP blu, Moto2 verde acqua, Moto3 viola. Testo bianco sopra ognuna (contrasto ≥ 4,5:1).
  const themes = {
    motogp: { accent: '#1d4ed8', onAccent: '#ffffff', textDark: '#7aa2ff', textLight: '#1d4ed8' },
    moto2:  { accent: '#0f766e', onAccent: '#ffffff', textDark: '#2dd4bf', textLight: '#0f766e' },
    moto3:  { accent: '#6d28d9', onAccent: '#ffffff', textDark: '#a78bfa', textLight: '#6d28d9' },
  };

  Paddock.series.motogp = Paddock.makeRobotSeries({ id: 'motogp', name: 'MotoGP', fullName: 'MotoGP', theme: themes.motogp });
  Paddock.series.moto2  = Paddock.makeRobotSeries({ id: 'moto2',  name: 'Moto2',  fullName: 'Moto2',  theme: themes.moto2 });
  Paddock.series.moto3  = Paddock.makeRobotSeries({ id: 'moto3',  name: 'Moto3',  fullName: 'Moto3',  theme: themes.moto3 });
})();
