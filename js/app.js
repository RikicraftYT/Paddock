/* ==========================================================
   Avvio dell'app: stato, navigazione e collegamento tra
   campionati (js/series) e schermate (js/ui/views.js).

   Sezioni:  Gare (calendario + classifiche di sessione)
             Mondiale (classifica piloti / costruttori o squadre)
   Layout:   telefono = una schermata alla volta
             computer (≥ 960 px) = sessioni a sinistra, classifica a destra
   ========================================================== */

(function () {
  const { DAY } = Paddock.config;
  const U = Paddock.utils;
  const V = Paddock.ui.views;
  const store = Paddock.cache.store;

  const $app = document.getElementById('app');
  const $tabs = document.getElementById('tabs');
  const $views = document.getElementById('views');
  const $classes = document.getElementById('classes');
  const $refresh = document.getElementById('refresh');
  const $status = document.getElementById('status');
  const $dialog = document.getElementById('settings');

  const wideMQ = window.matchMedia('(min-width: 960px)');
  const isWide = () => wideMQ.matches;

  const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const VIEWS = [
    { id: 'races', label: 'Gare', icon: icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>') },
    { id: 'standings', label: 'Mondiale', icon: icon('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>') },
  ];
  const RETRY = { label: 'Riprova', attr: 'data-retry' };
  const DEFAULT_FILTER = { practice: true, quali: true, sprint: true, race: true };

  /* ---------------- Stato (le preferenze restano salvate sul telefono) ---------------- */
  const state = {
    groupId: store.get('paddock:group') || 'f1',
    classBy: store.get('paddock:class') || {},           // classe scelta per gruppo, es. { moto: 'moto2' }
    view: store.get('paddock:view') || 'races',
    filter: { ...DEFAULT_FILTER, ...(store.get('paddock:filter') || {}) },
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

    const t = series().theme;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--on-accent', t.onAccent);
    root.style.setProperty('--accent-text-dark', t.textDark);
    root.style.setProperty('--accent-text-light', t.textLight);
  }

  /* ---------------- Barra superiore ---------------- */
  function renderChrome() {
    $tabs.innerHTML = V.seg(Paddock.groups.map(g => ({ id: g.id, label: g.label })), state.groupId, 'group');
    $views.innerHTML = V.seg(VIEWS, state.view, 'view');

    const g = group();
    $classes.hidden = g.series.length < 2;
    if (g.series.length > 1) {
      $classes.innerHTML = V.seg(g.series.map(id => ({ id, label: Paddock.series[id].name })), seriesId(), 'class');
    }
    applyTheme();
  }

  /* ---------------- Caricamento dati ---------------- */

  /** Il weekend da mostrare: il primo la cui ultima sessione è finita da meno di un giorno */
  function pickWeekend(weekends) {
    const now = Date.now();
    const i = weekends.findIndex(w => w.sessions.length && w.sessions[w.sessions.length - 1].end.getTime() + DAY > now);
    return i === -1 ? weekends.length - 1 : i;
  }

  async function ensureCalendar(force) {
    const id = seriesId();
    if (state.data[id] && !force) return;
    const { season, weekends } = await series().getCalendar();
    if (!weekends.length) throw new Error('Calendario vuoto');
    const index = pickWeekend(weekends);
    state.data[id] = { season, weekends, index, currentIndex: index };
  }

  async function ensureStandings(force) {
    const id = seriesId();
    if (state.standings[id] && !force) return;
    const season = current()?.season || 'current';
    state.standings[id] = await series().getStandings(season);
  }

  /* ---------------- Sessioni visibili secondo il filtro ---------------- */
  function visibleSessions(w) {
    const vis = [];
    w.sessions.forEach((s, i) => { if (state.filter[Paddock.filterGroupOf(s.kind)]) vis.push(i); });
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
    if (state.view === 'standings') return renderStandings();
    return renderRaces();
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
      $app.innerHTML = `<div class="pane-detail">${V.sessionShell(w, w.sessions[chosen], series().fullName, 1)}</div>`;
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
      : V.sessionShell(w, w.sessions[detailIdx], series().fullName);
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
      seriesName: series().fullName,
      season: current()?.season || '',
      tables: st.tables,
      source: st.source,
      active,
    });
  }

  /** Carica ciò che serve alla sezione aperta e disegna */
  async function show(force = false) {
    renderChrome();
    const needsLoad = force || !current() || (state.view === 'standings' && !state.standings[seriesId()]);
    if (needsLoad) {
      $app.innerHTML = V.message('', 'Caricamento…');
      announce('Caricamento');
    }
    try {
      await ensureCalendar(force);
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
    store.set('paddock:view', state.view);
    show();
  });

  $refresh.addEventListener('click', refresh);

  async function refresh() {
    $refresh.classList.add('spinning');
    $refresh.setAttribute('aria-busy', 'true');
    Paddock.cache.clearRecent();
    const id = seriesId();
    delete state.data[id];
    delete state.standings[id];
    await show(true);       // il weekend scelto resta: lo ripristina syncWeekend
    $refresh.classList.remove('spinning');
    $refresh.removeAttribute('aria-busy');
    announce('Dati aggiornati');
  }

  /* ---------------- Eventi: contenuto ---------------- */
  $app.addEventListener('click', e => {
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
  wideMQ.addEventListener('change', () => { if (current()) render(); });

  // Riaprendo l'app dopo un po', aggiorna i conti alla rovescia
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current() && state.view === 'races') render();
  });

  /* ---------------- Impostazioni: filtro sessioni e tema ---------------- */
  document.getElementById('open-settings').addEventListener('click', openSettings);

  function openSettings() {
    $dialog.querySelectorAll('#filter-set input').forEach(i => { i.checked = !!state.filter[i.name]; });
    $dialog.querySelectorAll('#theme-set input').forEach(i => { i.checked = i.value === state.theme; });
    $dialog.showModal();
  }

  $dialog.addEventListener('change', e => {
    const input = e.target;
    if (input.closest('#filter-set')) {
      state.filter[input.name] = input.checked;
      store.set('paddock:filter', state.filter);
    }
    if (input.name === 'theme') {
      state.theme = input.value;
      store.set('paddock:theme', state.theme);
    }
    if (current()) render();
  });

  // Tocco fuori dalla finestra = chiudi
  $dialog.addEventListener('click', e => { if (e.target === $dialog) $dialog.close(); });

  // Niente inviti automatici a installare l'app (Chrome, Edge): chi la vuole la installa dal menu del browser
  window.addEventListener('beforeinstallprompt', e => e.preventDefault());

  /* ---------------- Avvio ---------------- */
  show();
})();
