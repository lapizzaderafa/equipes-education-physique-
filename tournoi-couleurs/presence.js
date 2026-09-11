const PRESENCE_LOCAL_KEY = "tournoi-presence-local-v1";
const PRESENCE_TEST_ROSTERS = {
  rouge: ["Alexis Martin","Émile Roy","Nathan Gagnon","Thomas Bouchard","Léo Fortin","Olivier Côté","Félix Tremblay","Charles Pelletier","Jacob Morin","Antoine Lavoie"],
  vert: ["Samuel Girard","Louis Bergeron","Noah Bélanger","Gabriel Gauthier","William Caron","Henri Beaulieu","Mathis Lévesque","Raphaël Cloutier","Elliot Dufour","Jules Parent"],
  bleu: ["Milan Dubois","Xavier Fournier","Arthur Renaud","Édouard Simard","Logan Poirier","Victor Lapointe","Malik Desjardins","Nolan Landry","Théo Hébert","Mathieu Ouellet"],
  jaune: ["Benjamin Mercier","Zachary Lemieux","Adam Nadeau","Tristan Proulx","Éli Paquette","Maxime Bédard","Lucas Turcotte","Alec Richard","Dylan Charest","Mikaël Savard"]
};

let presenceLocal = loadPresenceLocal();
let dayMode = "matches";
let selectedPresenceTeam = "rouge";
let presenceSaving = false;

const baseGetRecordForPresence = getRecord;
const baseActiveRecordsForPresence = activeRecords;
const baseRenderBonusesForPresence = renderBonuses;
const baseRenderAllForPresence = renderAll;
const baseSetDateForPresence = setDate;
const baseShowViewForPresence = showView;

function presenceFragmentKey(base, team) {
  return `${base}_PRESENCE_${team.toUpperCase()}`;
}

function rosterFor(level, team) {
  return (PRESENCE_TEST_ROSTERS[team] || []).map((name, index) => ({
    id: `${level || "X"}-${team}-${index + 1}`,
    name
  }));
}

function blankPresenceFragment(date, info, team) {
  const students = Object.fromEntries(
    rosterFor(info.level, team).map(s => [s.id, { present: false, shirt: false }])
  );
  return { date, cycleDay: info.cycleDay, level: info.level, team, students };
}

function presenceSource(base, team, date, info) {
  const key = presenceFragmentKey(base, team);
  const source = cloudLive ? cloudFragments[key] : presenceLocal[key];
  return structuredClone(source || blankPresenceFragment(date, info, team));
}

function presenceStats(date, level, team) {
  const info = schoolInfo(date);
  const base = recordKey(date, level);
  const roster = rosterFor(level, team);
  const frag = presenceSource(base, team, date, { ...info, level });
  let present = 0;
  let shirts = 0;

  roster.forEach(student => {
    const state = frag.students?.[student.id] || { present: false, shirt: false };
    if (state.present) {
      present++;
      if (state.shirt) shirts++;
    }
  });

  const total = roster.length;
  const percent = total ? Math.round((present / total) * 100) : 0;
  return {
    total,
    present,
    shirts,
    percent,
    attendanceBonus: total > 0 && present / total >= 0.8,
    shirtsBonus: present > 0 && shirts === present
  };
}

function applyAutomaticBonuses(record) {
  if (!record?.date || !record?.level) return record;
  record.bonuses = record.bonuses || {};
  TEAM_ORDER.forEach(team => {
    const stats = presenceStats(record.date, record.level, team);
    record.bonuses[team] = record.bonuses[team] || { attendance: false, shirts: false, spirit: false };
    record.bonuses[team].attendance = stats.attendanceBonus;
    record.bonuses[team].shirts = stats.shirtsBonus;
  });
  return record;
}

getRecord = function(date, level) {
  const r = baseGetRecordForPresence(date, level);
  return r ? applyAutomaticBonuses(structuredClone(r)) : r;
};

activeRecords = function() {
  const records = structuredClone(baseActiveRecordsForPresence() || {});
  Object.keys(records).forEach(key => {
    records[key] = applyAutomaticBonuses(records[key]);
  });
  return records;
};

renderBonuses = function() {
  const info = schoolInfo(selectedDate);
  const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
  const locked = daySubmitted(r);
  const labels = {
    attendance: ["👥", "80 % et +", true],
    shirts: ["👕", "Chandails", true],
    spirit: ["👏", "Esprit d’équipe", false]
  };

  els.bonusGrid.innerHTML = TEAM_ORDER.map(t => `<article class="bonus-card"><div class="bonus-title team-${t}">${TEAMS[t].label}</div><div class="bonus-options">${Object.entries(labels).map(([k, [icon, label, automatic]]) => {
    const on = !!r.bonuses?.[t]?.[k];
    return `<button ${(automatic || locked) ? "disabled" : ""} class="bonus-toggle ${automatic ? "auto" : ""} ${on ? "active" : ""}" data-team="${t}" data-bonus="${k}"><span><span class="icon">${on ? "✓" : icon}</span>${label}${automatic ? " · auto" : ""}</span></button>`;
  }).join("")}</div></article>`).join("");

  els.bonusGrid.querySelectorAll("[data-bonus='spirit']").forEach(b => {
    if (!b.disabled) b.onclick = () => saveBonus(b.dataset.team, b.dataset.bonus, !b.classList.contains("active"));
  });
};

renderAll = function() {
  baseRenderAllForPresence();
  renderPresence();
  applyDayMode();
};

setDate = function(iso) {
  baseSetDateForPresence(iso);
  renderPresence();
  applyDayMode();
};

showView = function(v) {
  baseShowViewForPresence(v);
  if (v === "today") {
    renderPresence();
    applyDayMode();
  }
};

function setupPresenceUI() {
  const todayView = document.getElementById("view-today");
  const dateToolbar = todayView?.querySelector(".date-toolbar");
  if (!todayView || !dateToolbar || document.getElementById("dayModeTabs")) return;

  const tabs = document.createElement("div");
  tabs.id = "dayModeTabs";
  tabs.className = "day-mode-tabs";
  tabs.innerHTML = `
    <button type="button" class="day-mode-tab active" data-day-mode="matches">Matchs</button>
    <button type="button" class="day-mode-tab" data-day-mode="presence">Présence</button>
  `;
  dateToolbar.insertAdjacentElement("afterend", tabs);

  const presenceArea = document.createElement("section");
  presenceArea.id = "presenceArea";
  presenceArea.className = "presence-area";
  const dayStatus = document.getElementById("dayStatus");
  dayStatus.insertAdjacentElement("afterend", presenceArea);

  tabs.querySelectorAll("[data-day-mode]").forEach(btn => {
    btn.onclick = () => {
      dayMode = btn.dataset.dayMode;
      applyDayMode();
      if (dayMode === "presence") renderPresence();
    };
  });
}

function applyDayMode() {
  const tabs = document.getElementById("dayModeTabs");
  const presenceArea = document.getElementById("presenceArea");
  const competitionArea = document.getElementById("competitionArea");
  if (!tabs || !presenceArea || !competitionArea) return;

  tabs.querySelectorAll("[data-day-mode]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.dayMode === dayMode);
  });

  const info = schoolInfo(selectedDate);
  const canCompete = !!(info.isSchoolDay && info.level);
  presenceArea.classList.toggle("active", dayMode === "presence");
  if (dayMode === "presence") {
    competitionArea.hidden = true;
  } else if (canCompete && selectedGym) {
    competitionArea.hidden = false;
  }
}

function renderPresence() {
  const area = document.getElementById("presenceArea");
  if (!area) return;

  const info = schoolInfo(selectedDate);
  if (!info.isSchoolDay || !info.level) {
    area.innerHTML = `<div class="presence-empty"><strong>Pas de prise de présence aujourd’hui.</strong><br>${esc(info.reason || "Aucune compétition pour ce jour-cycle.")}</div>`;
    return;
  }

  const base = recordKey(selectedDate, info.level);
  const selectedStats = presenceStats(selectedDate, info.level, selectedPresenceTeam);
  const selectedRoster = rosterFor(info.level, selectedPresenceTeam);
  const selectedFrag = presenceSource(base, selectedPresenceTeam, selectedDate, info);

  area.innerHTML = `
    <div class="presence-head">
      <p class="kicker">PRISE DE PRÉSENCE</p>
      <h2>${esc(LEVELS[info.level])}</h2>
      <p>Présence à 80 % et + = 1 point automatiquement. Chandail = 1 point lorsque tous les élèves présents ont leur chandail.</p>
    </div>

    <div class="presence-summary-grid">
      ${TEAM_ORDER.map(team => {
        const s = presenceStats(selectedDate, info.level, team);
        return `<article class="presence-summary">
          <strong>${TEAMS[team].label}</strong>
          <small>${s.present}/${s.total} présents · ${s.percent}%</small>
          <div class="auto-points">
            <span class="auto-badge ${s.attendanceBonus ? "on" : ""}">${s.attendanceBonus ? "✓" : "○"} Présence</span>
            <span class="auto-badge ${s.shirtsBonus ? "on" : ""}">${s.shirtsBonus ? "✓" : "○"} Chandail</span>
          </div>
        </article>`;
      }).join("")}
    </div>

    <div class="presence-team-tabs">
      ${TEAM_ORDER.map(team => `<button type="button" class="presence-team-tab team-${team} ${team === selectedPresenceTeam ? "active" : ""}" data-presence-team="${team}">${TEAMS[team].label}</button>`).join("")}
    </div>

    <div class="presence-scorebar">
      <div class="presence-scorebox ${selectedStats.attendanceBonus ? "good" : ""}"><strong>${selectedStats.present}/${selectedStats.total}</strong><span>${selectedStats.percent}% présents ${selectedStats.attendanceBonus ? "· +1 point" : "· objectif 80 %"}</span></div>
      <div class="presence-scorebox ${selectedStats.shirtsBonus ? "good" : ""}"><strong>${selectedStats.shirts}/${selectedStats.present || 0}</strong><span>chandails parmi les présents ${selectedStats.shirtsBonus ? "· +1 point" : ""}</span></div>
    </div>

    <article class="presence-card">
      <div class="presence-card-head"><span>Élève</span><span>Présent</span><span>Chandail</span></div>
      ${selectedRoster.map(student => {
        const state = selectedFrag.students?.[student.id] || { present: false, shirt: false };
        return `<div class="student-row">
          <div class="student-name">${esc(student.name)}</div>
          <label class="student-check"><input type="checkbox" data-student="${student.id}" data-field="present" ${state.present ? "checked" : ""}><span>${state.present ? "Oui" : "Non"}</span></label>
          <label class="student-check shirt"><input type="checkbox" data-student="${student.id}" data-field="shirt" ${state.shirt ? "checked" : ""} ${state.present ? "" : "disabled"}><span>${state.shirt ? "Oui" : "Non"}</span></label>
        </div>`;
      }).join("")}
    </article>
    <div class="presence-saving">● ${presenceSaving ? "Sauvegarde…" : (cloudLive ? "Synchronisé en direct" : "Sauvegarde locale")}</div>
  `;

  area.querySelectorAll("[data-presence-team]").forEach(btn => {
    btn.onclick = () => {
      selectedPresenceTeam = btn.dataset.presenceTeam;
      renderPresence();
    };
  });

  area.querySelectorAll("input[data-student]").forEach(input => {
    input.onchange = () => savePresenceField(input.dataset.student, input.dataset.field, input.checked);
  });
}

async function savePresenceField(studentId, field, value) {
  const info = schoolInfo(selectedDate);
  if (!info.isSchoolDay || !info.level) return;
  const base = recordKey(selectedDate, info.level);
  const key = presenceFragmentKey(base, selectedPresenceTeam);
  const frag = presenceSource(base, selectedPresenceTeam, selectedDate, info);
  frag.students = frag.students || {};
  frag.students[studentId] = frag.students[studentId] || { present: false, shirt: false };
  frag.students[studentId][field] = value;
  if (field === "present" && !value) frag.students[studentId].shirt = false;
  frag.updatedAt = Date.now();

  presenceSaving = true;
  if (cloudLive) cloudFragments[key] = structuredClone(frag);
  else presenceLocal[key] = structuredClone(frag);
  if (!cloudLive) savePresenceLocal();
  renderAll();

  try {
    if (cloudLive) {
      await upsertFragment(key, frag);
    }
  } catch (e) {
    console.error(e);
    showToast("Erreur de sauvegarde de présence");
    try { await pullCloud(true); } catch {}
  } finally {
    presenceSaving = false;
    renderAll();
  }
}

function loadPresenceLocal() {
  try {
    return JSON.parse(localStorage.getItem(PRESENCE_LOCAL_KEY)) || {};
  } catch {
    return {};
  }
}

function savePresenceLocal() {
  localStorage.setItem(PRESENCE_LOCAL_KEY, JSON.stringify(presenceLocal));
}

setupPresenceUI();
renderPresence();
applyDayMode();
