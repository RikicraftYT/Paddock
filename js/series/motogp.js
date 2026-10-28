/* ==========================================================
   Campionati: MotoGP, Moto2, Moto3
   Dati preparati dal robot (scripts/sources/motogp.mjs) e letti
   da data/motogp/, data/moto2/, data/moto3/.
   Le tre classi stanno nello stesso gruppo "MotoGP" (registry.js).
   ========================================================== */

(function () {
  // Un solo verde per tutta la famiglia: le classi si distinguono per lo stile dell'etichetta
  // (MotoGP piena, Moto2 tenue, Moto3 solo bordo), leggibile anche da chi non distingue bene i colori.
  const green = { accent: '#15803d', onAccent: '#ffffff', textDark: '#4ade80', textLight: '#166534' };
  const themes = {
    motogp: { ...green, badge: 'solid' },
    moto2:  { ...green, badge: 'tint' },
    moto3:  { ...green, badge: 'outline' },
  };

  Paddock.series.motogp = Paddock.makeRobotSeries({ id: 'motogp', name: 'MotoGP', fullName: 'MotoGP', theme: themes.motogp });
  Paddock.series.moto2  = Paddock.makeRobotSeries({ id: 'moto2',  name: 'Moto2',  fullName: 'Moto2',  theme: themes.moto2 });
  Paddock.series.moto3  = Paddock.makeRobotSeries({ id: 'moto3',  name: 'Moto3',  fullName: 'Moto3',  theme: themes.moto3 });
})();
