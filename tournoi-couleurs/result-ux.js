(function () {
  function todayIsoForResultUX() { return fmt(new Date()); }
  function pastDateForResultUX() { return selectedDate < todayIsoForResultUX(); }

  function resultSummary(match) {
    if (!match.result) return `<div class="result-confirmation empty">Choisis le résultat du match</div>`;
    if (match.result === "draw") {
      return `<div class="result-confirmation confirmed"><div class="result-outcome-row"><span class="result-outcome-pill draw">✓ Match nul · 1 point chacun</span></div></div>`;
    }
    const winner = match.result;
    const loser = winner === match.a ? match.b : match.a;
    return `<div class="result-confirmation confirmed"><div class="result-outcome-row"><span class="result-outcome-pill win">✓ Victoire ${TEAMS[winner].label}</span><span class="result-outcome-arrow">→</span><span class="result-outcome-pill loss">Défaite ${TEAMS[loser].label}</span></div></div>`;
  }

  function teamResultButton(match, team, locked) {
    const selected = match.result === team;
    return `<button ${locked ? "disabled" : ""} aria-pressed="${selected ? "true" : "false"}" class="result-btn team-result team-${team} ${selected ? "selected" : ""}" data-match-id="${match.id}" data-result="${team}">
      <span class="result-choice-check">✓</span>
      <span class="result-choice-label">Victoire</span>
      <strong>${TEAMS[team].label}</strong>
    </button>`;
  }

  renderMatches = function() {
    const info = schoolInfo(selectedDate);
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const submitted = gymSubmitted(r, selectedGym);
    const correction = pastDateForResultUX();
    const locked = submitted && !correction;
    const ms = normalizedMatches(r).filter(m => m.gym === selectedGym);

    els.matches.innerHTML = ms.map(m => {
      const hasResult = !!m.result;
      const drawSelected = m.result === "draw";
      return `<section>
        <p class="slot-time">${m.time}</p>
        <article class="match-card ${hasResult ? "result-recorded" : ""}">
          <div class="match-meta"><span class="gym-badge">GYM ${m.gym}</span><span class="live-badge">Match ${m.slot} sur 3${submitted ? (correction ? " · correction" : " · verrouillé") : ""}</span></div>
          <div class="matchup"><div class="team-pill team-${m.a}">${TEAMS[m.a].label}</div><span class="vs">VS</span><div class="team-pill team-${m.b}">${TEAMS[m.b].label}</div></div>
          <div class="result-buttons result-ux ${hasResult ? "has-result" : ""}">
            ${teamResultButton(m, m.a, locked)}
            <button ${locked ? "disabled" : ""} aria-pressed="${drawSelected ? "true" : "false"}" class="result-btn result-draw ${drawSelected ? "selected" : ""}" data-match-id="${m.id}" data-result="draw">
              <span class="result-choice-check">✓</span>
              <span class="result-choice-label">Match</span>
              <strong>Nul</strong>
            </button>
            ${teamResultButton(m, m.b, locked)}
          </div>
          ${resultSummary(m)}
        </article>
      </section>`;
    }).join("");

    els.matches.querySelectorAll("[data-match-id]").forEach(b => {
      b.onclick = () => saveMatch(Number(b.dataset.matchId), b.classList.contains("selected") ? null : b.dataset.result);
    });

    if (typeof renderCorrectionNotice === "function") renderCorrectionNotice();
  };

  const previousRenderAllResultUX = renderAll;
  renderAll = function() {
    previousRenderAllResultUX();
    renderMatches();
  };

  renderMatches();
})();