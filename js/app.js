/* ==========================================================
   Avvio dell'app: stato, navigazione e collegamento tra
   campionati (js/series) e schermate (js/ui/views.js).

   Sezioni:  Prossimi (sessioni dei prossimi 7 giorni, tutti i campionati)
             Gare (calendario del weekend + classifiche di sessione)
             Mondiale (classifica piloti / costruttori o squadre)
   Layout:   telefono = una schermata alla volta, sezioni nella barra in basso
             computer (≥ 960 px) = sessioni a sinistra, classifica a destra
   ========================================================== */

(function () {
  const { DAY } = Paddock.config;
  const U = Paddock.utils;
  const V = Paddock.ui.views;
  const store = Paddock.cache.store;

  const $app = document.getElementById('app');
  const $topbar = document.getElementById('topbar');
  const $tabs = document.getElementById('tabs');
  const $views = document.getElementById('views');
  const $seriesBar = document.getElementById('series-bar');
  const $classes = document.getElementById('classes');
  const $refresh = document.getElementById('refresh');
  const $status = document.getElementById('status');
  const $dialog = document.getElementById('settings');
  const $season = document.getElementById('season');

  const wideMQ = window.matchMedia('(min-width: 960px)');
  const isWide = () => wideMQ.matches;

  const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const VIEWS = [
    { id: 'upcoming', label: 'Prossimi', icon: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') },
    { id: 'races', label: 'Gare', icon: icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>') },
    { id: 'standings', label: 'Mondiale', icon: icon('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>') },
  ];
  const RETRY = { label: 'Riprova', attr: 'data-retry' };
  const DEFAULT_FILTER = { practice: true, quali: true, sprint: true, race: true };

  // Campionati che si possono mostrare in "Prossimi" (scelta nelle Impostazioni, tutti attivi all'inizio)
  const UPCOMING_ALL = ['f1', 'motogp', 'moto2', 'moto3', 'sbk'];
  const upcomingSeries = () => UPCOMING_ALL.filter(id => state.upcoming[id] !== false);

  /* ---------------- Stato (le preferenze restano salvate sul telefono) ---------------- */
  const state = {
    groupId: store.get('paddock:group') || 'f1',
    classBy: store.get('paddock:class') || {},           // classe scelta per gruppo, es. { moto: 'moto2' }
    view: 'upcoming',                                     // l'app si apre sempre su "Prossimi"
    filter: { ...DEFAULT_FILTER, ...(store.get('paddock:filter') || {}) },
    upcoming: store.get('paddock:upcoming') || {},       // campionati nascosti in "Prossimi", es. { moto3: false }
    theme: store.get('paddock:theme') || 'auto',
    weekendBy: {},          // weekend scelto per gruppo, uguale per tutte le classi (assente = quello attuale)
    sessionIdx: null,       // sessione aperta (null = nessuna scelta esplicita)
    standingsTab: {},       // tabella mondiale scelta per campionato (telefono)
    data: {},               // calendari caricati, per campionato
    standings: {},          // classifiche mondiali caricate, per campionato
  };

  const group = () => Paddock.getGroup(state.groupId);
  const seriesId = () => {
    const g = group();
    return g.series.includes(state.classBy[g.id]) ? state.classBy[g.id] : g.series[0];
  };
  const series = () => Paddock.series[seriesId()];
  const current = () => state.data[seriesId()];

  /* ---------------- Weekend scelto (condiviso da MotoGP, Moto2 e Moto3) ---------------- */

  /** Porta il calendario della classe aperta sul weekend scelto per il gruppo */
  function syncWeekend(d) {
    const wanted = state.weekendBy[state.groupId];
    if (!wanted) { d.index = d.currentIndex; return; }
    const i = d.weekends.findIndex(w => w.id === wanted.id);
    // Classe che non corre quel weekend: il più vicino per data
    d.index = i !== -1 ? i : d.weekends.reduce((best, w, j) =>
      Math.abs(firstStart(w) - wanted.start) < Math.abs(firstStart(d.weekends[best]) - wanted.start) ? j : best, 0);
  }

  const firstStart = w => w.sessions[0]?.start.getTime() ?? 0;

  function chooseWeekend(i) {
    const d = current();
    const w = d.weekends[i];
    if (i === d.currentIndex) delete state.weekendBy[state.groupId];
    else state.weekendBy[state.groupId] = { id: w.id, start: firstStart(w) };
    d.index = i;
    state.sessionIdx = null;
  }

  /** Messaggio letto da VoiceOver senza spostare il focus */
  function announce(msg) {
    $status.textContent = '';
    setTimeout(() => { $status.textContent = msg; }, 50);
  }

  /* ---------------- Tema e colori del campionato ---------------- */
  function applyTheme() {
    const root = document.documentElement;
    if (state.theme === 'light' || state.theme === 'dark') root.dataset.theme = state.theme;
    else delete root.dataset.theme;

    // L'interfaccia resta neutra: il colore del campionato serve solo a pochi segni
    // (pallino del logo, bordo della prossima sessione). In "Prossimi" non c'è un campionato solo.
    const t = state.view === 'upcoming' ? null : series().theme;
    const set = (k, v) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k));
    set('--series', t?.accent);
    set('--series-text-dark', t?.textDark);
    set('--series-text-light', t?.textLight);
  }

  /* ---------------- Barra superiore ---------------- */
  function renderChrome() {
    $views.innerHTML = V.seg(VIEWS, state.view, 'view');

    $seriesBar.hidden = state.view === 'upcoming';
    $tabs.innerHTML = V.seg(Paddock.groups.map(g => ({ id: g.id, label: g.label, theme: { ...Paddock.series[g.series[0]].theme, badge: 'solid' } })), state.groupId, 'group');
    const g = group();
    $classes.hidden = g.series.length < 2;
    if (g.series.length > 1) {
      $classes.innerHTML = V.seg(g.series.map(id => ({ id, label: Paddock.series[id].name, theme: Paddock.series[id].theme })), seriesId(), 'class');
    }
    applyTheme();
  }

  // Altezza della barra superiore: serve alla colonna della classifica che resta ferma (computer)
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-h', $topbar.offsetHeight + 'px');
  }).observe($topbar);

  /* ---------------- Caricamento dati ---------------- */

  /** Il weekend da mostrare: il primo la cui ultima sessione è finita da meno di un giorno */
  function pickWeekend(weekends) {
    const now = Date.now();
    const i = weekends.findIndex(w => w.sessions.length && w.sessions[w.sessions.length - 1].end.getTime() + DAY > now);
    return i === -1 ? weekends.length - 1 : i;
  }

  async function ensureCalendar(id = seriesId(), force = false) {
    if (state.data[id] && !force) return;
    const { season, weekends, updatedAt } = await Paddock.series[id].getCalendar();
    if (!weekends.length) throw new Error('Calendario vuoto');
    const index = pickWeekend(weekends);
    state.data[id] = { season, weekends, index, currentIndex: index, updatedAt };
  }

  async function ensureStandings(force) {
    const id = seriesId();
    if (state.standings[id] && !force) return;
    const season = current()?.season || 'current';
    const st = await series().getStandings(season);
    state.standings[id] = { ...st, updatedAt: st.updatedAt || new Date() };
  }

  /* ---------------- Sessioni visibili secondo il filtro ---------------- */
  const isVisible = s => state.filter[Paddock.filterGroupOf(s.kind)];

  function visibleSessions(w) {
    const vis = [];
    w.sessions.forEach((s, i) => { if (isVisible(s)) vis.push(i); });
    return vis;
  }

  /** Sul computer, se non hai scelto: l'ultima sessione conclusa, altrimenti la prossima */
  function defaultSession(w, visible) {
    const now = new Date();
    const done = visible.filter(i => w.sessions[i].end <= now);
    if (done.length) return done[done.length - 1];
    return visible.length ? visible[0] : null;
  }

  /* ---------------- Disegno ---------------- */
  function render() {
    renderChrome();
    if (state.view === 'upcoming') return renderUpcoming();
    if (state.view === 'standings') return renderStandings();
    return renderRaces();
  }

  /** Inizio di oggi e fine della domenica di questa settimana (ora locale) */
  function thisWeek(now = new Date()) {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + (7 - start.getDay()) % 7); end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }

  /**
   * Prossimi: le sessioni di questa settimana, da oggi a domenica, di tutti i campionati.
   * Quelle di oggi restano anche dopo la fine (con il link ai risultati).
   */
  function renderUpcoming() {
    const now = Date.now();
    const week = thisWeek();
    const live = [], items = [], later = [], failed = [];

    upcomingSeries().forEach(id => {
      const s = Paddock.series[id];
      const d = state.data[id];
      if (!d) { failed.push(s); return; }
      let found = false;
      d.weekends.forEach((w, wi) => w.sessions.forEach((sess, si) => {
        const t0 = sess.start.getTime(), t1 = sess.end.getTime();
        if (!isVisible(sess) || t0 > week.end || (t1 <= now && t0 < week.start)) return;
        found = true;
        const it = { series: s, weekend: w, session: sess, key: `${id}:${wi}:${si}` };
        (t0 <= now && t1 > now ? live : items).push(it);
      }));
      // Niente questa settimana: il prossimo weekend; a stagione finita il campionato non compare
      const next = !found && d.weekends.find(w => w.sessions.some(x => x.start.getTime() > week.end));
      if (next) later.push({ series: s, weekend: next });
    });

    items.sort((a, b) => a.session.start - b.session.start);
    $app.innerHTML = V.upcoming({ live, items, later, failed });
  }

  function renderRaces() {
    const d = current();
    if (!d) return;
    syncWeekend(d);
    const w = d.weekends[d.index];
    const visible = visibleSessions(w);
    const chosen = visible.includes(state.sessionIdx) ? state.sessionIdx : null;

    // Telefono con una sessione aperta: solo la classifica
    if (!isWide() && chosen !== null) {
      $app.innerHTML = `<div class="pane-detail">${V.sessionShell(w, w.sessions[chosen], series(), 1)}</div>`;
      loadResults(w, w.sessions[chosen]);
      return;
    }

    const detailIdx = isWide() ? (chosen ?? defaultSession(w, visible)) : null;
    const weekendHtml = V.weekend({
      weekends: d.weekends,
      index: d.index,
      season: d.season,
      visible,
      hiddenCount: w.sessions.length - visible.length,
      selected: detailIdx,
      isCurrent: d.index === d.currentIndex,
    });

    if (!isWide()) {
      $app.innerHTML = `<div class="pane-weekend">${weekendHtml}</div>`;
      return;
    }

    const detail = detailIdx === null
      ? V.message('Nessuna sessione', 'Il filtro nasconde tutte le sessioni.')
      : V.sessionShell(w, w.sessions[detailIdx], series());
    $app.innerHTML = `
      <div class="layout">
        <div class="pane-weekend">${weekendHtml}</div>
        <section class="pane-detail" aria-label="Classifica della sessione">${detail}</section>
      </div>`;
    if (detailIdx !== null) loadResults(w, w.sessions[detailIdx]);
  }

  let resultsToken = 0;
  async function loadResults(weekend, session) {
    const $res = document.getElementById('results');
    if (!$res) return;
    const now = new Date();
    const status = U.sessionStatus(session, now);

    if (status === 'next') {
      $res.innerHTML = V.message('Non ancora disputata', `Inizia ${U.until(session.start - now)}.`);
      return;
    }

    const token = ++resultsToken;
    const s = series();
    try {
      const { rows, source } = await s.getResults(current().season, weekend, session);
      if (token !== resultsToken) return;           // nel frattempo hai aperto altro
      if (!rows.length) {
        $res.innerHTML = status === 'live'
          ? V.message('Sessione in corso', 'La classifica sarà disponibile a fine sessione.')
          : V.message('Classifica non ancora disponibile', 'Di solito arriva entro qualche ora dalla fine.', RETRY);
        announce('Classifica non ancora disponibile');
        return;
      }
      $res.innerHTML = V.results(rows, source, `Classifica ${session.label}, ${weekend.name}`);
      announce(`Classifica ${session.label} caricata, ${rows.length} piloti`);
    } catch (err) {
      console.error(err);
      if (token === resultsToken) {
        $res.innerHTML = V.message('Impossibile caricare la classifica', 'Controlla la connessione e riprova.', RETRY);
        announce('Impossibile caricare la classifica');
      }
    }
  }

  function renderStandings() {
    const id = seriesId();
    const st = state.standings[id];
    if (!st) return;
    if (!st.tables.length) {
      $app.innerHTML = V.message('Classifica non disponibile', 'Potrebbe non essere ancora stata pubblicata.', RETRY);
      return;
    }
    const active = st.tables.some(t => t.id === state.standingsTab[id]) ? state.standingsTab[id] : st.tables[0].id;
    $app.innerHTML = V.standings({
      series: series(),
      season: current()?.season || '',
      tables: st.tables,
      source: st.source,
      updatedAt: st.updatedAt,
      active,
    });
  }

  /** Carica ciò che serve alla sezione aperta e disegna */
  async function show(force = false) {
    renderChrome();

    if (state.view === 'upcoming') {
      if (force || upcomingSeries().some(id => !state.data[id])) {
        $app.innerHTML = V.skeleton(8);
        announce('Caricamento');
      }
      // Ognuno per conto suo: se un campionato non risponde, gli altri si vedono lo stesso
      await Promise.all(upcomingSeries().map(id => ensureCalendar(id, force).catch(err => console.error(err))));
      if (state.view === 'upcoming') render();
      return;
    }

    const needsLoad = force || !current() || (state.view === 'standings' && !state.standings[seriesId()]);
    if (needsLoad) {
      $app.innerHTML = V.skeleton();
      announce('Caricamento');
    }
    try {
      await ensureCalendar(seriesId(), force);
      if (state.view === 'standings') await ensureStandings(force);
      render();
    } catch (err) {
      console.error(err);
      const what = state.view === 'standings' ? 'la classifica mondiale' : 'il calendario';
      // Aperta con doppio clic ma la cartella data/ (creata dal robot su GitHub) non c'è
      const hint = err.localDataMissing
        ? `Mancano i dati ${series().fullName} nella cartella data/: li crea il robot su GitHub. Scarica la cartella data/ dal tuo repository e mettila accanto a index.html, oppure apri l'app dal sito GitHub Pages.`
        : 'Controlla la connessione e riprova.';
      $app.innerHTML = V.message(`Impossibile caricare ${what}`, hint, RETRY);
      announce(`Impossibile caricare ${what}`);
    }
  }

  function focusEl(sel) {
    const el = document.querySelector(sel);
    if (el) el.focus({ preventScroll: true });
    return !!el;
  }

  /* ---------------- Eventi: barra superiore ---------------- */
  $tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-group]');
    if (!b || b.dataset.group === state.groupId) return;
    state.groupId = b.dataset.group;
    state.sessionIdx = null;
    store.set('paddock:group', state.groupId);
    show();
  });

  $classes.addEventListener('click', e => {
    const b = e.target.closest('[data-class]');
    if (!b || b.dataset.class === seriesId()) return;
    state.classBy[state.groupId] = b.dataset.class;
    state.sessionIdx = null;
    store.set('paddock:class', state.classBy);
    show();
  });

  $views.addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (!b || b.dataset.view === state.view) return;
    state.view = b.dataset.view;
    state.sessionIdx = null;
    window.scrollTo(0, 0);
    show();
  });

  $refresh.addEventListener('click', refresh);

  async function refresh() {
    $refresh.classList.add('spinning');
    $refresh.setAttribute('aria-busy', 'true');
    Paddock.cache.clearRecent();
    const ids = state.view === 'upcoming' ? upcomingSeries() : [seriesId()];
    ids.forEach(id => { delete state.data[id]; delete state.standings[id]; });
    await show(true);       // il weekend scelto resta: lo ripristina syncWeekend
    $refresh.classList.remove('spinning');
    $refresh.removeAttribute('aria-busy');
    announce('Dati aggiornati');
  }

  /* ---------------- Eventi: contenuto ---------------- */

  /** Da "Prossimi" a una sessione: apre Gare su quel campionato, weekend e sessione */
  function openFromUpcoming(key) {
    const [id, wi, si] = key.split(':');
    const g = Paddock.groups.find(x => x.series.includes(id));
    state.groupId = g.id;
    state.classBy[g.id] = id;
    store.set('paddock:group', state.groupId);
    store.set('paddock:class', state.classBy);
    state.view = 'races';
    chooseWeekend(Number(wi));
    state.sessionIdx = Number(si);
    if (!isWide()) history.pushState({ session: true }, '');
    render();
    window.scrollTo(0, 0);
    focusEl(isWide() ? `[data-session="${si}"]` : '#detail-title');
  }

  $app.addEventListener('click', e => {
    const up = e.target.closest('[data-up]');
    if (up) { openFromUpcoming(up.dataset.up); return; }

    const go = e.target.closest('[data-go]');
    if (go) {
      chooseWeekend(current().index + Number(go.dataset.go));
      render();
      focusEl(`[data-go="${go.dataset.go}"]:not(:disabled)`) || focusEl('#weekend-title');
      announce(current().weekends[current().index].name);
      return;
    }

    if (e.target.closest('[data-go-current]')) {
      chooseWeekend(current().currentIndex);
      render();
      focusEl('#weekend-title');
      announce(current().weekends[current().index].name);
      return;
    }

    if (e.target.closest('[data-open-season]')) { openSeason(); return; }

    if (e.target.closest('[data-retry]')) { refresh(); return; }

    const sess = e.target.closest('[data-session]');
    if (sess) {
      const i = Number(sess.dataset.session);
      state.sessionIdx = i;
      if (isWide()) {
        render();
        focusEl(`[data-session="${i}"]`);
      } else {
        history.pushState({ session: true }, '');
        render();
        window.scrollTo(0, 0);
        focusEl('#detail-title');
      }
      return;
    }

    if (e.target.closest('[data-back]')) {
      if (history.state?.session) history.back();
      else closeSession();
      return;
    }

    if (e.target.closest('[data-open-settings]')) { openSettings(); return; }

    const tab = e.target.closest('[data-table]');
    if (tab) {
      state.standingsTab[seriesId()] = tab.dataset.table;
      renderStandings();
      focusEl(`[data-table="${tab.dataset.table}"]`);
    }
  });

  function closeSession() {
    const prev = state.sessionIdx;
    state.sessionIdx = null;
    render();
    if (prev !== null) focusEl(`[data-session="${prev}"]`);
  }

  // Tasto "indietro" del browser e swipe dal bordo su iPhone
  window.addEventListener('popstate', () => { if (state.sessionIdx !== null) closeSession(); });

  // Rotazione / ridimensionamento: passa da una a due colonne e viceversa
  wideMQ.addEventListener('change', () => { if (current() || state.view === 'upcoming') render(); });

  // Riaprendo l'app dopo un po', aggiorna i conti alla rovescia
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.view !== 'standings' && (current() || state.view === 'upcoming')) render();
  });

  /* ---------------- Calendario della stagione ---------------- */
  function openSeason() {
    const d = current();
    $season.innerHTML = V.seasonList({
      weekends: d.weekends, index: d.index, currentIndex: d.currentIndex,
      season: d.season, seriesName: group().label,
    });
    $season.showModal();
    const sel = $season.querySelector('[aria-current="true"]');
    if (sel) { sel.scrollIntoView({ block: 'center' }); sel.focus(); }
  }

  $season.addEventListener('click', e => {
    if (e.target === $season || e.target.closest('[data-close]')) { $season.close(); return; }
    const pick = e.target.closest('[data-pick]');
    if (!pick) return;
    chooseWeekend(Number(pick.dataset.pick));
    $season.close();
    render();
    window.scrollTo(0, 0);
    focusEl('#weekend-title');
    announce(current().weekends[current().index].name);
  });

  /* ---------------- Impostazioni: filtro sessioni e tema ---------------- */
  document.getElementById('open-settings').addEventListener('click', openSettings);

  function openSettings() {
    $dialog.querySelectorAll('#filter-set input').forEach(i => { i.checked = !!state.filter[i.name]; });
    $dialog.querySelectorAll('#upcoming-set input').forEach(i => { i.checked = state.upcoming[i.name] !== false; });
    $dialog.querySelectorAll('#theme-set input').forEach(i => { i.checked = i.value === state.theme; });
    $dialog.showModal();
  }

  $dialog.addEventListener('change', e => {
    const input = e.target;
    if (input.closest('#filter-set')) {
      state.filter[input.name] = input.checked;
      store.set('paddock:filter', state.filter);
    }
    if (input.closest('#upcoming-set')) {
      state.upcoming[input.name] = input.checked;
      store.set('paddock:upcoming', state.upcoming);
      if (state.view === 'upcoming') { show(); return; }      // carica i calendari appena attivati
    }
    if (input.name === 'theme') {
      state.theme = input.value;
      store.set('paddock:theme', state.theme);
    }
    if (current() || state.view === 'upcoming') render();
  });

  // Tocco fuori dalla finestra = chiudi
  $dialog.addEventListener('click', e => { if (e.target === $dialog) $dialog.close(); });

  // Niente inviti automatici a installare l'app (Chrome, Edge): chi la vuole la installa dal menu del browser
  window.addEventListener('beforeinstallprompt', e => e.preventDefault());

  /* ---------------- Avvio ---------------- */
  show();
})();
