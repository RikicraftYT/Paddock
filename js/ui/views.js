/* ==========================================================
   Schermate dell'app. Ricevono dati già pronti e producono HTML.
   Non sanno nulla di API: funzionano uguale per ogni campionato.
   ========================================================== */

(function () {
  const U = Paddock.utils;
  const esc = U.esc;
  const { locale } = Paddock.config;

  const KIND_IT = { practice: 'Prove libere', quali: 'Qualifiche', sprintQuali: 'Qualifiche', sprint: 'Sprint', race: 'Gara' };

  const fmtDayHead = d => d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  Paddock.ui.views = {
    /**
     * Messaggio centrato (caricamento, errori, "in arrivo").
     * @param action  { label, attr } pulsante opzionale, es. { label: 'Riprova', attr: 'data-retry' }
     */
    message(title, text = '', action = null) {
      return `<div class="msg">
        ${title ? `<b>${esc(title)}</b>` : ''}${text ? `<p>${esc(text)}</p>` : ''}
        ${action ? `<button type="button" class="btn" ${action.attr}>${esc(action.label)}</button>` : ''}
      </div>`;
    },

    /** Gruppo di pulsanti a scelta singola. items = [{ id, label, icon? }] */
    seg(items, currentId, attr) {
      return items.map(it =>
        `<button type="button" data-${attr}="${esc(it.id)}" aria-pressed="${it.id === currentId}">${it.icon || ''}<span>${esc(it.label)}</span></button>`
      ).join('');
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
        if (st === 'done') badge = 'Classifica';
        else if (st === 'live') badge = 'In corso';
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
            <span class="chev" aria-hidden="true">›</span>
          </button>
        </li>`;
      };

      // Sessioni raggruppate per giorno: si legge "venerdì → sabato → domenica"
      const days = [];
      o.visible.forEach(i => {
        const key = w.sessions[i].start.toDateString();
        const last = days[days.length - 1];
        if (last && last.key === key) last.items.push(i);
        else days.push({ key, date: w.sessions[i].start, items: [i] });
      });

      const list = o.visible.length
        ? days.map(d => `
            <section class="day-group">
              <h2 class="day-head">${esc(fmtDayHead(d.date))}</h2>
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
          <b>${esc(f.label)}</b>
          <span>${esc(U.fmtLong(f.start))}${f.tbc ? '' : ' · ore ' + U.fmtTime(f.start)}</span>
          ${liveIdx === -1 ? `<span class="count">${esc(U.until(f.start - now))}</span>` : ''}
        </div>` : '';

      const backToCurrent = !o.isCurrent
        ? `<button type="button" class="link-btn today-btn" data-go-current>Torna al weekend attuale</button>`
        : '';

      return `
        <nav class="round-nav" aria-label="Weekend">
          <button type="button" class="arrow" data-go="-1" ${o.index === 0 ? 'disabled' : ''} aria-label="Weekend precedente">‹</button>
          <span>Round ${w.round} di ${o.weekends.length} · ${esc(o.season)}</span>
          <button type="button" class="arrow" data-go="1" ${o.index === o.weekends.length - 1 ? 'disabled' : ''} aria-label="Weekend successivo">›</button>
        </nav>
        ${backToCurrent}
        <section class="hero" aria-labelledby="weekend-title">
          <div class="flag" aria-hidden="true">${w.flag}</div>
          <div>
            <h1 id="weekend-title" tabindex="-1">${esc(w.name)}</h1>
            <p>${esc(w.country)}${w.city ? ' · ' + esc(w.city) : ''}</p>
            ${w.circuit ? `<p>${esc(w.circuit)}</p>` : ''}
          </div>
        </section>
        ${nextUp}
        ${list}
        ${note}`;
    },

    /* ---------------- Dettaglio sessione ---------------- */

    /** Intestazione della sessione; la classifica arriva dopo in #results */
    sessionShell(weekend, session, seriesName, level = 2) {
      const h = level === 1 ? 'h1' : 'h2';
      return `
        <button type="button" class="back" data-back>‹ Torna a ${esc(weekend.name)}</button>
        <div class="detail-head">
          <p class="eyebrow">${esc(seriesName)} · ${esc(KIND_IT[session.kind] || '')}</p>
          <${h} id="detail-title" tabindex="-1">${esc(session.label)}</${h}>
          <p>${esc(weekend.name)} · ${U.fmtLong(session.start)}${session.tbc ? '' : ' · ' + U.fmtTime(session.start)}</p>
        </div>
        <div id="results">${this.message('', 'Caricamento…')}</div>`;
    },

    /** Classifica di una sessione */
    results(rows, source, caption) {
      const body = rows.map(r => `
        <tr>
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
        ${source ? `<p class="source">Dati: ${esc(source)}</p>` : ''}`;
    },

    /* ---------------- Classifica mondiale ---------------- */

    standings({ seriesName, season, tables, source, active }) {
      const tabs = tables.length > 1
        ? `<div class="seg seg-sub standings-tabs" role="group" aria-label="Tipo di classifica">
             ${this.seg(tables.map(t => ({ id: t.id, label: t.label })), active, 'table')}
           </div>`
        : '';

      const sections = tables.map(t => {
        const body = t.rows.map(r => `
          <tr>
            <td class="pos">${esc(r.pos)}</td>
            <td class="who"${r.color ? ` style="--team:${esc(r.color)}"` : ''}><b>${esc(r.name)}</b>${r.team ? `<small>${esc(r.team)}</small>` : ''}</td>
            <td class="pts">${U.points(r.points)} <small>pt</small></td>
          </tr>`).join('');
        return `
          <section aria-labelledby="t-${esc(t.id)}" class="${t.id !== active ? 'is-off' : ''}">
            <h2 id="t-${esc(t.id)}">${esc(t.label)}</h2>
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
          <h1 id="standings-title" tabindex="-1">Mondiale ${esc(seriesName)} ${esc(season)}</h1>
        </div>
        ${tabs}
        <div class="tables">${sections}</div>
        ${source ? `<p class="source">Dati: ${esc(source)}</p>` : ''}`;
    },
  };
})();
