/* ==========================================================
   Campionati: MotoGP, Moto2, Moto3
   Dati preparati dal robot (scripts/sources/motogp.mjs) e letti
   da data/motogp/, data/moto2/, data/moto3/.
   Le tre classi stanno nello stesso gruppo "MotoGP" (registry.js).
   ========================================================== */

(function () {
  // Blu: distinto dal rosso della F1 e dal giallo della SBK
  const theme = { accent: '#1d4ed8', onAccent: '#ffffff', textDark: '#7aa2ff', textLight: '#1d4ed8' };

  Paddock.series.motogp = Paddock.makeRobotSeries({ id: 'motogp', name: 'MotoGP', fullName: 'MotoGP', theme });
  Paddock.series.moto2  = Paddock.makeRobotSeries({ id: 'moto2',  name: 'Moto2',  fullName: 'Moto2',  theme });
  Paddock.series.moto3  = Paddock.makeRobotSeries({ id: 'moto3',  name: 'Moto3',  fullName: 'Moto3',  theme });
})();
