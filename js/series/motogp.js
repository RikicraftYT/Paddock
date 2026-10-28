/* ==========================================================
   Campionati: MotoGP, Moto2, Moto3
   Dati preparati dal robot (scripts/sources/motogp.mjs) e letti
   da data/motogp/, data/moto2/, data/moto3/.
   Le tre classi stanno nello stesso gruppo "MotoGP" (registry.js).
   ========================================================== */

(function () {
  const theme = { accent: '#c80f2e', onAccent: '#ffffff', textDark: '#ff6b80', textLight: '#b00d28' };

  Paddock.series.motogp = Paddock.makeRobotSeries({ id: 'motogp', name: 'MotoGP', fullName: 'MotoGP', theme });
  Paddock.series.moto2  = Paddock.makeRobotSeries({ id: 'moto2',  name: 'Moto2',  fullName: 'Moto2',  theme });
  Paddock.series.moto3  = Paddock.makeRobotSeries({ id: 'moto3',  name: 'Moto3',  fullName: 'Moto3',  theme });
})();
