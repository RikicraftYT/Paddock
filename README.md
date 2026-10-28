# Paddock

Orari e classifiche di **Formula 1**, **MotoGP** (con Moto2 e Moto3) e **Superbike** in un'unica web app, senza notizie, video o pubblicità.
Pensata per l'iPhone (si installa nella schermata Home), funziona anche su computer.

> App personale e **non ufficiale**: non ha legami con Formula 1, FIA, Dorna Sports, MotoGP o WorldSBK.

## Funzioni

- **Prossimi**: le sessioni dei prossimi 7 giorni di tutti i campionati insieme, in ordine di orario.
- **Gare**: il weekend in corso o il prossimo, con gli orari nel tuo fuso, la prossima sessione in evidenza e la classifica di ogni sessione. Il calendario della stagione mostra tutti i round con i vincitori.
- **Mondiale**: piloti, costruttori e (per MotoGP, Moto2, Moto3) squadre, con il distacco dal primo. Il Mondiale costruttori MotoGP è calcolato dal robot come da regolamento: in ogni gara e sprint ogni casa prende i punti del suo pilota meglio piazzato.
- **Filtro sessioni**: mostra solo prove libere, qualifiche, sprint e/o gare.
- **Tema** chiaro, scuro o automatico.
- **Accessibile**: buoni contrasti, testo che segue le impostazioni del telefono, supporto a VoiceOver.

## Come funziona

| Campionato | Fonte dati | Come arrivano |
|---|---|---|
| Formula 1 | [Jolpica](https://github.com/jolpica/jolpica-f1) e [OpenF1](https://openf1.org) | L'app li scarica direttamente |
| MotoGP, Moto2, Moto3 | Servizi di motogp.com | Robot su GitHub Actions ogni 15 minuti → `data/` |
| Superbike | Servizi di worldsbk.com | Robot su GitHub Actions ogni 15 minuti → `data/` |

I siti MotoGP e WorldSBK non permettono al browser di leggere i loro dati da un altro sito (CORS), quindi un robot
([`scripts/update-data.mjs`](scripts/update-data.mjs)) li scarica e li salva nella cartella `data/` del repository.
L'app li legge come file del proprio sito.

Nessuna dipendenza, nessun build: HTML, CSS e JavaScript semplici.

```
index.html            Pagina unica
css/style.css         Grafica
js/core/              Configurazione, utilità, cache
js/api/               Client dei servizi dati
js/series/            Un file per campionato
js/ui/views.js        Schermate
js/app.js             Avvio e navigazione
scripts/              Il robot (Node 18+)
data/                 Creata dal robot, non modificarla a mano
```

## Usarla in locale

Doppio clic su `index.html`. La F1 funziona subito; per MotoGP e SBK serve la cartella `data/`, che arriva con `git pull`.

Il robot si può lanciare anche dal computer con Node 18 o più recente:

```bash
node scripts/update-data.mjs
```

## Note

- Il robot fa un commit solo quando i dati cambiano. Prima di fare push delle tue modifiche, esegui `git pull --rebase`.
- GitHub sospende i workflow programmati dopo 60 giorni senza attività (succede nella pausa invernale): per riattivarlo vai su **Actions → Aggiorna dati → Enable workflow**.
- I servizi di MotoGP e WorldSBK non sono API pubbliche documentate e possono cambiare senza preavviso: in quel caso va aggiornato solo `scripts/sources/`.

## Licenza e dati

Il codice è distribuito con licenza [MIT](LICENSE).
Le bandiere in `assets/flags/` vengono da [flag-icons](https://github.com/lipis/flag-icons) (licenza MIT, © Panayiotis Lipiridis).

La licenza **non copre i dati** in `data/` né quelli mostrati dall'app: appartengono ai rispettivi proprietari
(Formula One Group, Dorna Sports, WorldSBK) e alle fonti indicate sopra. Sono usati solo a scopo personale e non commerciale.
Nomi, loghi e marchi citati appartengono ai rispettivi titolari.
Se sei titolare di questi dati e vuoi che vengano rimossi, apri una [issue](https://github.com/RikicraftYT/Paddock/issues).
