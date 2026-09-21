(function () {
  function teamsForCurrentGym(info) {
    if (!selectedGym || !info?.level) return [];
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const teams = new Set();
    normalizedMatches(r)
      .filter(match => match.gym === selectedGym)
      .forEach(match => {
        teams.add(match.a);
        teams.add(match.b);
      });
    return TEAM_ORDER.filter(team => teams.has(team));
  }

  renderPresence = function() {
    const area = document.getElementById("presenceArea");
    if (!area) return;

    const info = schoolInfo(selectedDate);
    if (!info.isSchoolDay || !info.level) {
      area.innerHTML = `<div class="presence-simple-empty">Aucune compétition aujourd’hui.</div>`;
      return;
    }

    if (!selectedGym) {
      area.innerHTML = `<div class="presence-simple-empty">Choisis ton gymnase pour prendre les présences.</div>`;
      return;
    }

    const allowedTeams = teamsForCurrentGym(info);
    if (!allowedTeams.length) {
      area.innerHTML = `<div class="presence-simple-empty">Aucune équipe à prendre en présence dans le Gym ${esc(selectedGym)}.</div>`;
      return;
    }

    if (!allowedTeams.includes(selectedPresenceTeam)) {
      selectedPresenceTeam = allowedTeams[0];
    }

    const base = recordKey(selectedDate, info.level);
    const frag = presenceSource(base, selectedPresenceTeam, selectedDate, info);
    const roster = rosterFor(info.level, selectedPresenceTeam);
    const stats = presenceStatsFromFragment(info.level, selectedPresenceTeam, frag);

    area.innerHTML = `
      <div class="presence-simple-teams" style="grid-template-columns:repeat(${allowedTeams.length},minmax(0,1fr))">
        ${allowedTeams.map(team => `<button type="button" class="presence-simple-team team-${team} ${team === selectedPresenceTeam ? "active" : ""}" data-presence-team="${team}">${TEAMS[team].label}</button>`).join("")}
      </div>

      <div class="presence-simple-note"><strong>${stats.present}/${stats.eligible} présents · ${stats.percent}%</strong><span>${stats.motivated} absence${stats.motivated === 1 ? "" : "s"} motivée${stats.motivated === 1 ? "" : "s"}, retirée${stats.motivated === 1 ? "" : "s"} du calcul</span></div>

      <div class="presence-simple-list">
        <div class="presence-simple-head">
          <span>Élève</span>
          <span>Présent</span>
          <span>Chandail</span>
          <span>Motivé</span>
        </div>
        ${roster.map(student => {
          const state = frag.students?.[student.id] || { present: false, shirt: false, motivated: false };
          return `
            <div class="presence-simple-row">
              <span class="presence-simple-name">${esc(student.name)}</span>
              <label class="presence-simple-check" aria-label="${esc(student.name)} présent">
                <input type="checkbox" data-student="${student.id}" data-field="present" ${state.present ? "checked" : ""}>
                <span></span>
              </label>
              <label class="presence-simple-check shirt" aria-label="${esc(student.name)} chandail">
                <input type="checkbox" data-student="${student.id}" data-field="shirt" ${state.shirt ? "checked" : ""} ${state.present ? "" : "disabled"}>
                <span></span>
              </label>
              <label class="presence-simple-check motivated" aria-label="${esc(student.name)} absence motivée">
                <input type="checkbox" data-student="${student.id}" data-field="motivated" ${state.motivated ? "checked" : ""}>
                <span></span>
              </label>
            </div>`;
        }).join("")}
      </div>`;

    area.querySelectorAll("[data-presence-team]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedPresenceTeam = btn.dataset.presenceTeam;
        renderPresence();
      });
    });

    area.querySelectorAll("input[data-student]").forEach(input => {
      input.addEventListener("change", () => savePresenceField(input.dataset.student, input.dataset.field, input.checked));
    });
  };

  const originalChooseGym = chooseGym;
  chooseGym = function(g) {
    originalChooseGym(g);
    if (dayMode === "presence") renderPresence();
  };

  if (typeof refreshPresenceUI === "function") refreshPresenceUI();
})();
