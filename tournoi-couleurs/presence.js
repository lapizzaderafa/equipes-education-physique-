const PRESENCE_LOCAL_KEY = "tournoi-presence-local-v2";
const PRESENCE_ROSTERS = {
  "S12": {
    "rouge": [
      "Clara Belzile",
      "Alice Grenier",
      "Ariane Bélanger",
      "Ève Briand",
      "Maxim Drouin",
      "Henri Foster",
      "Jules Larivière",
      "Mya Larouche",
      "Lya Marceau",
      "Arnaud Néron",
      "Manda Ramanandraibe Hiaro",
      "Edouard Sirois",
      "Victor Tanguay",
      "Cassandra Fiset",
      "Laïla Tanguay"
    ],
    "vert": [
      "Thierry Bellavance",
      "Sarah-Maude Fortin",
      "Camille moore",
      "Florence Giguère",
      "Alexandre Germain",
      "lexie labrecque",
      "Jérémy Letellier",
      "Jeanne Paradis",
      "Florence Roux",
      "jacob talbot",
      "Koralie Dion",
      "Alycia Marcil",
      "Jade Roberge",
      "Maxime Mercier",
      "Laurence Julien",
      "Thomas Mercier"
    ],
    "bleu": [
      "Alfred Elliot Anctil",
      "Martin Coronel",
      "Éliane Dubé",
      "Éliam Fournier",
      "Rosalie Julien",
      "Justine Lasalle",
      "léonie martel",
      "Mélodie Otis-Dubé",
      "Émilia roger",
      "Flavie St-Laurent",
      "Léo Jason Andriamboavonjy",
      "Maryane Lachance",
      "Viktoriia Lisnycha",
      "Ariane Bolduc",
      "Mehdi Chachia Plamondon"
    ],
    "jaune": [
      "Emy-Anne Côté",
      "Arsène Mvondo Wong",
      "Baptiste Autret",
      "Estée Bouchard",
      "Tyfany Russel",
      "Anais Fortin",
      "Zara Grimard",
      "Matthew Lajeunesse",
      "Chloé Mainguy",
      "Tasnim Naouali",
      "Jeanne Polisois",
      "julien vallières",
      "Dominic Dionne",
      "Josianne Dolet",
      "charles-olivier seaborn"
    ]
  },
  "S345": {
    "rouge": [
      "Tom Arsenault",
      "Simone Beaudin",
      "Zackary Pleau",
      "Dorianne Caron",
      "Jérémy Billette",
      "Charles Fisette",
      "Sarah Duquette",
      "Émile Foster",
      "Miakym zaragoza",
      "Léo Grenier"
    ],
    "vert": [
      "Éliane Bériault",
      "Bastien Munger",
      "mathilde cantin",
      "Félix Martineau",
      "Charles Germain",
      "Lucas St-Pierre",
      "Loane Bourque",
      "floralie huard",
      "Simon Bujold"
    ],
    "bleu": [
      "Justin Allen",
      "Félix Bordeleau",
      "Edmond Cloutier",
      "Louis Genois",
      "Rosalie Lachance",
      "Grégoire Paradis",
      "Hubert Larivière",
      "Louis-Thomas Des Rochers",
      "Mykaëla Fiset"
    ],
    "jaune": [
      "Léana Soucy",
      "Paul Cloutier",
      "Éliot Bélanger",
      "Anne-Sophie Gouin",
      "Malik Mercier",
      "Félix Pouliot",
      "Maxime Turcotte",
      "Liam Brière",
      "Maya Nourcy"
    ]
  }
};

let presenceLocal = loadPresenceLocal();
let dayMode = "matches";
let selectedPresenceTeam = "rouge";
let presenceSaving = false;

function presenceFragmentKey(base, team) {
  return `${base}_PRESENCE_${team.toUpperCase()}`;
}

function rosterFor(level, team) {
  const canonical = canonicalLevel(level);
  return (PRESENCE_ROSTERS[canonical]?.[team] || []).map((name, index) => ({
    id: `${canonical || "X"}-${team}-${index + 1}`,
    name
  }));
}

function blankPresenceFragment(date, info, team) {
  const students = Object.fromEntries(
    rosterFor(info.level, team).map(s => [s.id, { present: false, shirt: false, motivated: false }])
  );
  return { date, cycleDay: info.cycleDay, level: info.level, team, students };
}

function presenceSource(base, team, date, info) {
  const key = presenceFragmentKey(base, team);
  const source = cloudLive ? cloudFragments[key] : presenceLocal[key];
  return cloneData(source || blankPresenceFragment(date, info, team));
}

function presenceStatsFromFragment(level, team, frag) {
  const roster = rosterFor(level, team);
  let present = 0;
  let shirts = 0;
  let motivated = 0;
  roster.forEach(student => {
    const state = frag.students?.[student.id] || { present: false, shirt: false, motivated: false };
    if (state.motivated) motivated++;
    if (state.present) {
      present++;
      if (state.shirt) shirts++;
    }
  });
  const total = roster.length;
  const eligible = Math.max(0, total - motivated);
  const percent = eligible ? Math.round((present / eligible) * 100) : 100;
  return {
    total,
    eligible,
    present,
    shirts,
    motivated,
    percent,
    attendanceBonus: total > 0 && (eligible === 0 || present / eligible >= 0.8),
    shirtsBonus: present > 0 && shirts === present
  };
}

function presenceStats(date, level, team) {
  const info = schoolInfo(date);
  const base = recordKey(date, level);
  return presenceStatsFromFragment(level, team, presenceSource(base, team, date, { ...info, level }));
}

function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

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
  document.getElementById("dayStatus").insertAdjacentElement("afterend", presenceArea);

  tabs.querySelectorAll("[data-day-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      dayMode = btn.dataset.dayMode;
      applyDayMode();
      if (dayMode === "presence") renderPresence();
    });
  });

  els.datePicker.addEventListener("change", () => setTimeout(refreshPresenceUI, 0));
  $("prevDayBtn").addEventListener("click", () => setTimeout(refreshPresenceUI, 0));
  $("nextDayBtn").addEventListener("click", () => setTimeout(refreshPresenceUI, 0));
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view === "today") setTimeout(refreshPresenceUI, 0);
    });
  });
}

function refreshPresenceUI() {
  if (els.datePicker && !els.datePicker.value) els.datePicker.value = selectedDate;
  renderPresence();
  applyDayMode();
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
  presenceArea.classList.toggle("active", dayMode === "presence");
  if (dayMode === "presence") {
    competitionArea.hidden = true;
  } else {
    competitionArea.hidden = !(info.isSchoolDay && info.level && selectedGym);
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
  const selectedFrag = presenceSource(base, selectedPresenceTeam, selectedDate, info);
  const selectedStats = presenceStatsFromFragment(info.level, selectedPresenceTeam, selectedFrag);
  const selectedRoster = rosterFor(info.level, selectedPresenceTeam);

  area.innerHTML = `
    <div class="presence-head">
      <p class="kicker">PRISE DE PRÉSENCE</p>
      <h2>${esc(LEVELS[info.level])}</h2>
      <p>80 % et + présents = 1 point automatique. Tous les élèves présents avec leur chandail = 1 point automatique.</p>
    </div>
    <div class="presence-summary-grid">
      ${TEAM_ORDER.map(team => {
        const s = presenceStats(selectedDate, info.level, team);
        return `<article class="presence-summary"><strong>${TEAMS[team].label}</strong><small>${s.present}/${s.eligible} présents · ${s.percent}% · ${s.motivated} motivé${s.motivated === 1 ? "" : "s"}</small><div class="auto-points"><span class="auto-badge ${s.attendanceBonus ? "on" : ""}">${s.attendanceBonus ? "✓" : "○"} Présence</span><span class="auto-badge ${s.shirtsBonus ? "on" : ""}">${s.shirtsBonus ? "✓" : "○"} Chandail</span></div></article>`;
      }).join("")}
    </div>
    <div class="presence-team-tabs">
      ${TEAM_ORDER.map(team => `<button type="button" class="presence-team-tab team-${team} ${team === selectedPresenceTeam ? "active" : ""}" data-presence-team="${team}">${TEAMS[team].label}</button>`).join("")}
    </div>
    <div class="presence-scorebar">
      <div class="presence-scorebox ${selectedStats.attendanceBonus ? "good" : ""}"><strong>${selectedStats.present}/${selectedStats.eligible}</strong><span>${selectedStats.percent}% présents · ${selectedStats.motivated} motivé${selectedStats.motivated === 1 ? "" : "s"} ${selectedStats.attendanceBonus ? "· +1 point" : "· objectif 80 %"}</span></div>
      <div class="presence-scorebox ${selectedStats.shirtsBonus ? "good" : ""}"><strong>${selectedStats.shirts}/${selectedStats.present || 0}</strong><span>chandails parmi les présents ${selectedStats.shirtsBonus ? "· +1 point" : ""}</span></div>
    </div>
    <article class="presence-card">
      <div class="presence-card-head"><span>Élève</span><span>Présent</span><span>Chandail</span><span>Motivé</span></div>
      ${selectedRoster.map(student => {
        const state = selectedFrag.students?.[student.id] || { present: false, shirt: false, motivated: false };
        return `<div class="student-row"><div class="student-name">${esc(student.name)}</div><label class="student-check"><input type="checkbox" data-student="${student.id}" data-field="present" ${state.present ? "checked" : ""}><span>${state.present ? "Oui" : "Non"}</span></label><label class="student-check shirt"><input type="checkbox" data-student="${student.id}" data-field="shirt" ${state.shirt ? "checked" : ""} ${state.present ? "" : "disabled"}><span>${state.shirt ? "Oui" : "Non"}</span></label><label class="student-check motivated"><input type="checkbox" data-student="${student.id}" data-field="motivated" ${state.motivated ? "checked" : ""}><span>${state.motivated ? "Oui" : "Non"}</span></label></div>`;
      }).join("")}
    </article>
    <div class="presence-saving">● ${presenceSaving ? "Sauvegarde…" : (cloudLive ? "Synchronisé en direct" : "Sauvegarde locale")}</div>`;

  area.querySelectorAll("[data-presence-team]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedPresenceTeam = btn.dataset.presenceTeam;
      renderPresence();
    });
  });
  area.querySelectorAll("input[data-student]").forEach(input => {
    input.addEventListener("change", () => savePresenceField(input.dataset.student, input.dataset.field, input.checked));
  });
}

async function savePresenceField(studentId, field, value) {
  const info = schoolInfo(selectedDate);
  if (!info.isSchoolDay || !info.level) return;
  const base = recordKey(selectedDate, info.level);
  const pKey = presenceFragmentKey(base, selectedPresenceTeam);
  const frag = presenceSource(base, selectedPresenceTeam, selectedDate, info);
  frag.students = frag.students || {};
  frag.students[studentId] = frag.students[studentId] || { present: false, shirt: false, motivated: false };
  frag.students[studentId][field] = value;
  if (field === "present" && !value) frag.students[studentId].shirt = false;
  if (field === "present" && value) frag.students[studentId].motivated = false;
  if (field === "motivated" && value) {
    frag.students[studentId].present = false;
    frag.students[studentId].shirt = false;
  }
  frag.updatedAt = Date.now();

  presenceSaving = true;
  if (cloudLive) cloudFragments[pKey] = cloneData(frag);
  else {
    presenceLocal[pKey] = cloneData(frag);
    savePresenceLocal();
  }
  renderPresence();

  try {
    const stats = presenceStatsFromFragment(info.level, selectedPresenceTeam, frag);
    if (cloudLive) {
      await upsertFragment(pKey, frag);
      const bonusKey = fragmentKey(base, "BONUS");
      const currentRecord = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
      const bonusFrag = cloneData(cloudFragments[bonusKey] || makeBonusFragment(selectedDate, info, currentRecord));
      bonusFrag.bonuses = bonusFrag.bonuses || makeBonusFragment(selectedDate, info, currentRecord).bonuses;
      bonusFrag.bonuses[selectedPresenceTeam] = bonusFrag.bonuses[selectedPresenceTeam] || { attendance: false, shirts: false, spirit: false };
      bonusFrag.bonuses[selectedPresenceTeam].attendance = stats.attendanceBonus;
      bonusFrag.bonuses[selectedPresenceTeam].shirts = stats.shirtsBonus;
      await upsertFragment(bonusKey, bonusFrag);
      await pullCloud(true);
    } else {
      const r = localDB.records[base] || blankRecord(selectedDate, info);
      r.bonuses[selectedPresenceTeam].attendance = stats.attendanceBonus;
      r.bonuses[selectedPresenceTeam].shirts = stats.shirtsBonus;
      localDB.records[base] = r;
      persistLocal();
      renderAll();
    }
  } catch (e) {
    console.error(e);
    showToast("Erreur de sauvegarde de présence");
  } finally {
    presenceSaving = false;
    renderAll();
    renderPresence();
    applyDayMode();
  }
}

async function saveAllPresence(checked) {
  const info = schoolInfo(selectedDate);
  if (!info.isSchoolDay || !info.level) return;
  const base = recordKey(selectedDate, info.level);
  const pKey = presenceFragmentKey(base, selectedPresenceTeam);
  const frag = presenceSource(base, selectedPresenceTeam, selectedDate, info);
  frag.students = frag.students || {};
  rosterFor(info.level, selectedPresenceTeam).forEach(student => {
    frag.students[student.id] = frag.students[student.id] || { present: false, shirt: false, motivated: false };
    frag.students[student.id].present = checked;
    frag.students[student.id].shirt = checked;
    frag.students[student.id].motivated = false;
  });
  frag.updatedAt = Date.now();

  presenceSaving = true;
  if (cloudLive) cloudFragments[pKey] = cloneData(frag);
  else {
    presenceLocal[pKey] = cloneData(frag);
    savePresenceLocal();
  }
  renderPresence();

  try {
    const stats = presenceStatsFromFragment(info.level, selectedPresenceTeam, frag);
    if (cloudLive) {
      await upsertFragment(pKey, frag);
      const bonusKey = fragmentKey(base, "BONUS");
      const currentRecord = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
      const bonusFrag = cloneData(cloudFragments[bonusKey] || makeBonusFragment(selectedDate, info, currentRecord));
      bonusFrag.bonuses = bonusFrag.bonuses || makeBonusFragment(selectedDate, info, currentRecord).bonuses;
      bonusFrag.bonuses[selectedPresenceTeam] = bonusFrag.bonuses[selectedPresenceTeam] || { attendance: false, shirts: false, spirit: false };
      bonusFrag.bonuses[selectedPresenceTeam].attendance = stats.attendanceBonus;
      bonusFrag.bonuses[selectedPresenceTeam].shirts = stats.shirtsBonus;
      await upsertFragment(bonusKey, bonusFrag);
      await pullCloud(true);
    } else {
      const r = localDB.records[base] || blankRecord(selectedDate, info);
      r.bonuses[selectedPresenceTeam].attendance = stats.attendanceBonus;
      r.bonuses[selectedPresenceTeam].shirts = stats.shirtsBonus;
      localDB.records[base] = r;
      persistLocal();
      renderAll();
    }
  } catch (e) {
    console.error(e);
    showToast("Erreur de sauvegarde de présence");
  } finally {
    presenceSaving = false;
    renderAll();
    renderPresence();
    applyDayMode();
  }
}

function loadPresenceLocal() {
  try { return JSON.parse(localStorage.getItem(PRESENCE_LOCAL_KEY)) || {}; }
  catch { return {}; }
}
function savePresenceLocal() {
  localStorage.setItem(PRESENCE_LOCAL_KEY, JSON.stringify(presenceLocal));
}

setupPresenceUI();
if (els.datePicker && !els.datePicker.value) els.datePicker.value = selectedDate;
renderAll();
refreshPresenceUI();
