/* ==========================================================
   Campionati: MotoGP, Moto2, Moto3
   Dati preparati dal robot (scripts/sources/motogp.mjs) e letti
   da data/motogp/, data/moto2/, data/moto3/.
   Le tre classi stanno nello stesso gruppo "MotoGP" (registry.js).
   ========================================================== */

(function () {
  // Tre sfumature di verde, distinte dal giallo della F1 e dal marrone della SBK:
  // MotoGP verde, Moto2 smeraldo, Moto3 verde oliva. Testo bianco sopra ognuna (contrasto ≥ 4,5:1).
  const themes = {
    motogp: { accent: '#15803d', onAccent: '#ffffff', textDark: '#4ade80', textLight: '#166534' },
    moto2:  { accent: '#047857', onAccent: '#ffffff', textDark: '#34d399', textLight: '#047857' },
    moto3:  { accent: '#4d7c0f', onAccent: '#ffffff', textDark: '#a3e635', textLight: '#3f6212' },
  };

  Paddock.series.motogp = Paddock.makeRobotSeries({ id: 'motogp', name: 'MotoGP', fullName: 'MotoGP', theme: themes.motogp });
  Paddock.series.moto2  = Paddock.makeRobotSeries({ id: 'moto2',  name: 'Moto2',  fullName: 'Moto2',  theme: themes.moto2 });
  Paddock.series.moto3  = Paddock.makeRobotSeries({ id: 'moto3',  name: 'Moto3',  fullName: 'Moto3',  theme: themes.moto3 });
})();
