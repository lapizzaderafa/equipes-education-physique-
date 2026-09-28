(() => {
  function previewPointsForTeam(r, team) {
    let matchPoints = 0;
    let matches = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;

    normalizedMatches(r).forEach(m => {
      if (!m.result || (m.a !== team && m.b !== team)) return;
      matches += 1;
      if (m.result === "draw") {
        draws += 1;
        matchPoints += 1;
      } else if (m.result === team) {
        wins += 1;
        matchPoints += 2;
      } else {
        losses += 1;
      }
    });

    const bonus = r?.bonuses?.[team] || {};
    const attendance = bonus.attendance ? 1 : 0;
    const shirts = bonus.shirts ? 1 : 0;

    // Every team starts the day with the sportsmanship point.
    // A single explicit misconduct in any match removes it.
    const ethics = normalizedMatches(r).some(
      m => (m.a === team || m.b === team) && m.ethics?.[team] === false
    ) ? 0 : 1;

    const bonusPoints = attendance + shirts + ethics;
    return { matches, wins, draws, losses, matchPoints, bonusPoints, total: matchPoints + bonusPoints };
  }

  renderDayPoints = function() {
    const info = schoolInfo(selectedDate);
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);

    els.dayPoints.innerHTML = TEAM_ORDER.map(team => {
      const p = previewPointsForTeam(r, team);
      return `<div class="point-card team-${team}">
        <small>${TEAMS[team].label.toUpperCase()}</small>
        <strong>${p.total} pts</strong>
        <small>${p.matchPoints} match + ${p.bonusPoints} bonus</small>
      </div>`;
    }).join("");
  };

  renderDayPoints();
})();