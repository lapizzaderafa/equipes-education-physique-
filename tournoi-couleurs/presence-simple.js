(function () {
  renderPresence = function() {
    const area = document.getElementById("presenceArea");
    if (!area) return;

    const info = schoolInfo(selectedDate);
    if (!info.isSchoolDay || !info.level) {
      area.innerHTML = `<div class="presence-simple-empty">Aucune compétition aujourd’hui.</div>`;
      return;
    }

    const base = recordKey(selectedDate, info.level);
    const frag = presenceSource(base, selectedPresenceTeam, selectedDate, info);
    const roster = rosterFor(info.level, selectedPresenceTeam);

    area.innerHTML = `
      <div class="presence-simple-teams">
        ${TEAM_ORDER.map(team => `<button type="button" class="presence-simple-team team-${team} ${team === selectedPresenceTeam ? "active" : ""}" data-presence-team="${team}">${TEAMS[team].label}</button>`).join("")}
      </div>

      <div class="presence-simple-list">
        <div class="presence-simple-head">
          <span>Élève</span>
          <span>Présent</span>
          <span>Chandail</span>
        </div>
        ${roster.map(student => {
          const state = frag.students?.[student.id] || { present: false, shirt: false };
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

  if (typeof refreshPresenceUI === "function") refreshPresenceUI();
})();