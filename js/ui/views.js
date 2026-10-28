/* ==========================================================
   Schermate dell'app. Ricevono dati già pronti e producono HTML.
   Non sanno nulla di API: funzionano uguale per ogni campionato.
   ========================================================== */

(function () {
  const U = Paddock.utils;
  const esc = U.esc;
  const { locale } = Paddock.config;

  const KIND_IT = { practice: 'Prove libere', quali: 'Qualifiche', sprintQuali: 'Qualifiche', sprint: 'Sprint', race: 'Gara' };

  const fmtDayHead = d => {
    const s = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  /** "Oggi", "Domani" o "Venerdì 30 ottobre" */
  function dayLabel(d, now = new Date()) {
    const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 864e5);
    if (days === 0) return 'Oggi';
    if (days === 1) return 'Domani';
    return fmtDayHead(d);
  }

  /** Raggruppa elementi consecutivi con lo stesso giorno: [{ date, items }] */
  function byDay(items, dateOf) {
    const days = [];
    items.forEach(it => {
      const d = dateOf(it);
      const last = days[days.length - 1];
      if (last && last.date.toDateString() === d.toDateString()) last.items.push(it);
      else days.push({ date: d, items: [it] });
    });
    return days;
  }

  /** Chip con il nome del campionato, nei suoi colori */
  const seriesChip = s =>
    `<span class="chip-series" style="--c:${esc(s.theme.accent)};--oc:${esc(s.theme.onAccent)}">${esc(s.name)}</span>`;

  Paddock.ui.views = {
    /**
     * Messaggio centrato (errori, "in arrivo").
     * @param action  { label, attr } pulsante opzionale, es. { label: 'Riprova', attr: 'data-retry' }
     */
    message(title, text = '', action = null) {
      return `<div class="msg">
        ${title ? `<b>${esc(title)}</b>` : ''}${text ? `<p>${esc(text)}</p>` : ''}
        ${action ? `<button type="button" class="btn" ${action.attr}>${esc(action.label)}</button>` : ''}
      </div>`;
    },

    /** Righe grigie animate mentre si carica */
    skeleton(rows = 6) {
      return `<div class="skeleton" aria-hidden="true">
        <div class="sk sk-title"></div>
        <div class="card">${'<div class="sk-row"><span class="sk"></span><span class="sk"></span></div>'.repeat(rows)}</div>
      </div>`;
    },

    /** Gruppo di pulsanti a scelta singola. items = [{ id, label, icon? }] */
    seg(items, currentId, attr) {
      return items.map(it =>
        `<button type="button" data-${attr}="${esc(it.id)}" aria-pressed="${it.id === currentId}">${it.icon || ''}<span>${esc(it.label)}</span></button>`
      ).join('');
    },

    /** "Dati: Jolpica · aggiornati alle 17:42" */
    source(source, updatedAt) {
      if (!source && !updatedAt) return '';
      const parts = [];
      if (source) parts.push(`Dati: ${esc(source)}`);
      if (updatedAt) parts.push(`aggiornati ${updatedAt.toDateString() === new Date().toDateString() ? 'alle' : 'il ' + esc(U.fmtDayMonth(updatedAt)) + ' alle'} ${U.fmtTime(updatedAt)}`);
      return `<p class="source">${parts.join(' · ')}</p>`;
    },

    /* ---------------- Prossimi (tutti i campionati) ---------------- */

    /**
     * @param o.live     [{ series, weekend, session, key }]  sessioni in corso
     * @param o.items    [{ series, weekend, session, key }]  prossimi 7 giorni, in ordine
     * @param o.later    [{ series, weekend }]  campionati senza sessioni nei 7 giorni (weekend = prossimo o null)
     * @param o.failed   [series]  campionati non caricati
     */
    upcoming(o) {
      const now = new Date();
      const row = it => {
        const s = it.session;
        const live = U.sessionStatus(s, now) === 'live';
        const when = live ? 'in corso' : `${U.fmtLong(s.start)}, ore ${U.fmtTime(s.start)}`;
        return `<li>
          <button type="button" class="up-row${s.kind === 'race' ? ' is-race' : ''}${live ? ' live' : ''}" data-up="${esc(it.key)}"
            aria-label="${esc(`${it.series.fullName}, ${s.label}, ${it.weekend.name}, ${when}`)}">
            <span class="time" aria-hidden="true">${live ? 'Live' : s.tbc ? 'da def.' : U.fmtTime(s.start)}</span>
            <span class="up-main" aria-hidden="true">
              <span class="up-title">${seriesChip(it.series)}<span class="name">${esc(s.label)}</span></span>
              <span class="up-sub">${esc(it.weekend.name)}</span>
            </span>
            <span class="chev" aria-hidden="true">›</span>
          </button>
        </li>`;
      };

      const live = o.live.length ? `
        <section class="group" aria-labelledby="up-live">
          <h2 class="group-head live-head" id="up-live">In corso ora</h2>
          <ul class="list card">${o.live.map(row).join('')}</ul>
        </section>` : '';

      const days = byDay(o.items, it => it.session.start).map((d, i) => `
        <section class="group" aria-labelledby="up-d${i}">
          <h2 class="group-head" id="up-d${i}">${esc(dayLabel(d.date, now))}</h2>
          <ul class="list card">${d.items.map(row).join('')}</ul>
        </section>`).join('');

      const empty = !o.live.length && !o.items.length
        ? `<div class="card">${this.message('Nessuna sessione nei prossimi 7 giorni', o.failed.length ? '' : 'Ecco quando si riparte.')}</div>`
        : '';

      const later = o.later.length ? `
        <section class="group" aria-labelledby="up-later">
          <h2 class="group-head" id="up-later">Più avanti</h2>
          <ul class="list card">${o.later.map(l => `
            <li><div class="later-row">
              ${seriesChip(l.series)}
              <span class="up-main">
                ${l.weekend
                  ? `<span class="name">${esc(l.weekend.name)}</span><span class="up-sub">${esc(U.dateRange(l.weekend))}</span>`
                  : `<span class="name">Stagione conclusa</span>`}
              </span>
            </div></li>`).join('')}
          </ul>
        </section>` : '';

      const failed = o.failed.length
        ? `<p class="filter-note"><span>${esc(o.failed.map(s => s.name).join(', '))} non ${o.failed.length === 1 ? 'disponibile' : 'disponibili'}</span>
           <button type="button" class="link-btn" data-retry>Riprova</button></p>`
        : '';

      return `
        <div class="page-head">
          <h1 id="page-title" tabindex="-1">Prossimi</h1>
          <p>${esc(fmtDayHead(now))}</p>
        </div>
        <div class="narrow">${live}${days}${empty}${later}${failed}</div>`;
    },

    /* ---------------- Calendario del weekend ---------------- */

    /**
     * @param o.weekends, o.index, o.season
     * @param o.visible       indici delle sessioni da mostrare (dopo il filtro)
     * @param o.hiddenCount   quante sessioni nasconde il filtro
     * @param o.selected      indice della sessione aperta a destra (solo computer)
     * @param o.isCurrent     true se è il weekend in corso / prossimo
     */
    weekend(o) {
      const w = o.weekends[o.index];
      const now = new Date();
      const nextIdx = o.isCurrent ? w.sessions.findIndex(s => s.end > now) : -1;

      const row = i => {
        const s = w.sessions[i];
        const st = U.sessionStatus(s, now);
        const isNext = i === nextIdx && st === 'next';
        let badge = '';
        if (st === 'live') badge = 'In corso';
        else if (isNext) badge = U.until(s.start - now);

        const cls = ['sess', st, s.kind === 'race' ? 'is-race' : '', isNext ? 'is-next' : ''].join(' ');
        const when = s.tbc ? 'orario da definire' : `${U.fmtLong(s.start)}, ore ${U.fmtTime(s.start)}`;
        const state = st === 'done' ? 'conclusa, apri la classifica' : st === 'live' ? 'in corso' : isNext ? `prossima sessione, ${badge}` : 'in programma';

        return `<li>
          <button type="button" class="${cls}" data-session="${i}"
            ${o.selected === i ? 'aria-current="true"' : ''}
            aria-label="${esc(`${s.label}, ${when}, ${state}`)}">
            <span class="time" aria-hidden="true">${s.tbc ? 'da def.' : U.fmtTime(s.start)}</span>
            <span class="name" aria-hidden="true">${esc(s.label)}</span>
            ${badge ? `<span class="badge" aria-hidden="true">${esc(badge)}</span>` : ''}
            ${st === 'done' ? '<span class="done-mark" aria-hidden="true">Risultati</span>' : ''}
            <span class="chev" aria-hidden="true">›</span>
          </button>
        </li>`;
      };

      // Sessioni raggruppate per giorno: si legge "venerdì → sabato → domenica"
      const list = o.visible.length
        ? byDay(o.visible, i => w.sessions[i].start).map(d => `
            <section class="group">
              <h2 class="group-head">${esc(fmtDayHead(d.date))}</h2>
              <ul class="list card">${d.items.map(row).join('')}</ul>
            </section>`).join('')
        : `<div class="card">${this.message('Nessuna sessione da mostrare', 'Il filtro nasconde tutte le sessioni di questo weekend.', { label: 'Modifica filtro', attr: 'data-open-settings' })}</div>`;

      const note = o.hiddenCount && o.visible.length
        ? `<p class="filter-note"><span>${o.hiddenCount} ${o.hiddenCount === 1 ? 'sessione nascosta' : 'sessioni nascoste'} dal filtro</span>
           <button type="button" class="link-btn" data-open-settings>Modifica filtro</button></p>`
        : '';

      // Riquadro "prossima sessione": la cosa che si cerca aprendo l'app
      const liveIdx = o.isCurrent ? w.sessions.findIndex(s => U.sessionStatus(s, now) === 'live') : -1;
      const focusIdx = liveIdx !== -1 ? liveIdx : nextIdx;
      const f = focusIdx !== -1 ? w.sessions[focusIdx] : null;
      const nextUp = f ? `
        <div class="next-up${liveIdx !== -1 ? ' is-live' : ''}">
          <span class="next-label">${liveIdx !== -1 ? 'In corso ora' : 'Prossima sessione'}</span>
          <span class="next-main"><b>${esc(f.label)}</b>${liveIdx === -1 ? `<span class="count">${esc(U.until(f.start - now))}</span>` : ''}</span>
          <span class="next-when">${esc(U.fmtLong(f.start))}${f.tbc ? '' : ' · ore ' + U.fmtTime(f.start)}</span>
        </div>` : '';

      const winners = w.winners?.length
        ? `<p class="winners">${w.winners.map(x => `<span>${w.winners.length > 1 ? esc(x.label) + ': ' : 'Vincitore: '}<b>${esc(x.name)}</b></span>`).join('')}</p>`
        : '';

      return `
        <nav class="round-nav" aria-label="Weekend">
          <button type="button" class="arrow" data-go="-1" ${o.index === 0 ? 'disabled' : ''} aria-label="Weekend precedente">‹</button>
          <button type="button" class="round-btn" data-open-season aria-haspopup="dialog">
            Round ${w.round} di ${o.weekends.length}<span aria-hidden="true"> ▾</span><span class="sr-only">, apri il calendario della stagione</span>
          </button>
          <button type="button" class="arrow" data-go="1" ${o.index === o.weekends.length - 1 ? 'disabled' : ''} aria-label="Weekend successivo">›</button>
        </nav>
        ${!o.isCurrent ? `<button type="button" class="link-btn today-btn" data-go-current>Torna al weekend attuale</button>` : ''}
        <section class="hero" aria-labelledby="weekend-title">
          <div class="hero-flag" aria-hidden="true">${w.flag}</div>
          <div>
            <h1 id="weekend-title" tabindex="-1">${esc(w.name)}</h1>
            <p class="hero-when">${esc(U.dateRange(w))}${w.city ? ' · ' + esc(w.city) : ''}</p>
            ${w.circuit ? `<p>${esc(w.circuit)}</p>` : ''}
          </div>
        </section>
        ${winners}
        ${nextUp}
        ${list}
        ${note}`;
    },

    /* ---------------- Calendario della stagione ---------------- */

    seasonList({ weekends, index, currentIndex, season, seriesName }) {
      const now = new Date();
      const items = weekends.map((w, i) => {
        const last = w.sessions[w.sessions.length - 1];
        const done = last && last.end < now;
        let info = '';
        if (w.winners?.length) {
          info = w.winners.map(x => `${w.winners.length > 1 ? esc(x.label) + ': ' : ''}${esc(x.name)}`).join(' · ');
        } else if (i === currentIndex && !done) info = 'Prossimo weekend';
        else if (done) info = 'Concluso';

        return `<li>
          <button type="button" class="season-row${i === currentIndex ? ' is-current' : ''}${done ? ' done' : ''}" data-pick="${i}"
            ${i === index ? 'aria-current="true"' : ''}>
            <span class="season-round" aria-hidden="true">${w.round}</span>
            <span class="season-flag" aria-hidden="true">${w.flag}</span>
            <span class="season-main">
              <span class="name">${esc(w.name)}</span>
              <span class="season-sub">${esc(U.dateRange(w))}${info ? ' · ' + info : ''}</span>
            </span>
          </button>
        </li>`;
      }).join('');

      return `
        <div class="sheet-head">
          <h2 id="season-title">Calendario ${esc(seriesName)} ${esc(season)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Chiudi">✕</button>
        </div>
        <ol class="list season-list" aria-labelledby="season-title">${items}</ol>`;
    },

    /* ---------------- Dettaglio sessione ---------------- */

    /** Intestazione della sessione; la classifica arriva dopo in #results */
    sessionShell(weekend, session, seriesName, level = 2) {
      const h = level === 1 ? 'h1' : 'h2';
      return `
        <button type="button" class="back" data-back>‹ ${esc(weekend.name)}</button>
        <div class="detail-head">
          <p class="eyebrow">${esc(seriesName)} · ${esc(KIND_IT[session.kind] || '')}</p>
          <${h} id="detail-title" tabindex="-1">${esc(session.label)}</${h}>
          <p>${U.fmtLong(session.start)}${session.tbc ? '' : ' · ' + U.fmtTime(session.start)}</p>
        </div>
        <div id="results">${this.skeleton(8)}</div>`;
    },

    /** Classifica di una sessione */
    results(rows, source, caption) {
      const body = rows.map(r => `
        <tr${Number(r.pos) <= 3 ? ' class="podium"' : ''}>
          <td class="pos">${esc(r.pos)}</td>
          <td class="who"${r.color ? ` style="--team:${esc(r.color)}"` : ''}><b>${esc(r.name)}</b><small>${esc(r.team)}</small></td>
          <td class="val${r.out ? ' out' : ''}">${esc(r.value)}</td>
        </tr>`).join('');
      return `
        <div class="card">
          <table class="board">
            <caption class="sr-only">${esc(caption)}</caption>
            <thead><tr><th scope="col" class="pos">Pos.</th><th scope="col">Pilota</th><th scope="col" class="val">Tempo</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        ${this.source(source)}`;
    },

    /* ---------------- Classifica mondiale ---------------- */

    standings({ seriesName, season, tables, source, updatedAt, active }) {
      const tabs = tables.length > 1
        ? `<div class="seg seg-sub standings-tabs" role="group" aria-label="Tipo di classifica">
             ${this.seg(tables.map(t => ({ id: t.id, label: t.label })), active, 'table')}
           </div>`
        : '';

      const sections = tables.map(t => {
        const lead = Number(t.rows[0]?.points) || 0;
        const body = t.rows.map((r, i) => {
          const gap = i > 0 ? lead - (Number(r.points) || 0) : 0;
          return `
          <tr${Number(r.pos) <= 3 ? ' class="podium"' : ''}>
            <td class="pos">${esc(r.pos)}</td>
            <td class="who"${r.color ? ` style="--team:${esc(r.color)}"` : ''}><b>${esc(r.name)}</b>${r.team ? `<small>${esc(r.team)}</small>` : ''}</td>
            <td class="pts">${U.points(r.points)}${gap > 0 ? `<small class="gap"><span aria-hidden="true">−</span><span class="sr-only">a </span>${U.points(gap)}<span class="sr-only"> punti dal primo</span></small>` : ''}</td>
          </tr>`;
        }).join('');
        return `
          <section aria-labelledby="t-${esc(t.id)}" class="${t.id !== active ? 'is-off' : ''}">
            <h2 id="t-${esc(t.id)}" class="group-head">${esc(t.label)}</h2>
            <div class="card">
              <table class="board">
                <thead><tr><th scope="col" class="pos">Pos.</th><th scope="col">Nome</th><th scope="col" class="pts">Punti</th></tr></thead>
                <tbody>${body || `<tr><td colspan="3">${this.message('Classifica non ancora disponibile')}</td></tr>`}</tbody>
              </table>
            </div>
            ${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}
          </section>`;
      }).join('');

      return `
        <div class="page-head">
          <h1 id="page-title" tabindex="-1">Mondiale ${esc(seriesName)}</h1>
          <p>Stagione ${esc(season)}</p>
        </div>
        ${tabs}
        <div class="tables">${sections}</div>
        ${this.source(source, updatedAt)}`;
    },
  };
})();
