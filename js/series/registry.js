/* ==========================================================
   Gruppi di campionati e "contratto" che ogni campionato rispetta.

   GRUPPI = i pulsanti in alto (F1 · MotoGP · SBK).
   Un gruppo può contenere più classi: MotoGP, Moto2 e Moto3 stanno
   nello stesso gruppo e si scelgono con il selettore sotto.

   Ogni campionato (Paddock.series[id]) è un oggetto con:
     id, name, fullName
     theme       { accent, onAccent, textDark, textLight, badge }
                 Colori usati solo per riconoscere il campionato (etichette, pallini):
                 l'interfaccia resta neutra.
                 accent    = sfondo dell'etichetta piena
                 onAccent  = testo sopra accent
                 textDark  = colore come testo su sfondo scuro
                 textLight = colore come testo su sfondo chiaro
                 badge     = 'solid' | 'tint' | 'outline' (stile dell'etichetta)

     getCalendar() -> Promise<{
       season: '2026', updatedAt?: Date,
       weekends: [{ id, round, name, country, flag, city, circuit,
                    winners?: [{ label, name }],      // gare già corse
                    sessions: [{ id, label, kind, start: Date, end: Date, tbc }] }]
     }>

     getResults(season, weekend, session) -> Promise<{
       rows: [{ pos, name, team, color, value, out }], source
     }>

     getStandings(season) -> Promise<{
       tables: [{ id, label, note?, rows: [{ pos, name, team, color, points }] }], source, updatedAt?: Date
     }>

   kind: 'practice' | 'quali' | 'sprintQuali' | 'sprint' | 'race'
   ========================================================== */

(function () {
  Paddock.groups = [
    { id: 'f1',   label: 'F1',     series: ['f1'] },
    { id: 'moto', label: 'MotoGP', series: ['motogp', 'moto2', 'moto3'] },
    { id: 'sbk',  label: 'SBK',    series: ['sbk'] },
  ];

  Paddock.getGroup = id => Paddock.groups.find(g => g.id === id) || Paddock.groups[0];

  /** Gruppo del filtro sessioni a cui appartiene ogni tipo di sessione */
  Paddock.filterGroupOf = kind =>
    ({ practice: 'practice', quali: 'quali', sprintQuali: 'quali', sprint: 'sprint', race: 'race' }[kind] || 'race');
})();
