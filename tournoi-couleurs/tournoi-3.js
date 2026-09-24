function normalizedMatches(r) {
  if (!r) return [];
  if (Array.isArray(r.matches)) return r.matches;
  return Object.values(r.matches || {}).sort((a, b) => a.id - b.id);
}

function renderMatches() {
  const info = schoolInfo(selectedDate);
  const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
  const locked = gymSubmitted(r, selectedGym);
  const ms = normalizedMatches(r).filter(m => m.gym === selectedGym);

  els.matches.innerHTML = ms.map(m => `<section><p class="slot-time">${m.time}</p><article class="match-card"><div class="match-meta"><span class="gym-badge">GYM ${m.gym}</span><span class="live-badge">Match ${m.slot} sur 3${locked ? " · verrouillé" : ""}</span></div><div class="matchup"><div class="team-pill team-${m.a}">${TEAMS[m.a].label}</div><span class="vs">VS</span><div class="team-pill team-${m.b}">${TEAMS[m.b].label}</div></div><div class="result-buttons"><button ${locked ? "disabled" : ""} class="result-btn team-result team-${m.a} ${m.result === m.a ? "selected" : ""}" data-match-id="${m.id}" data-result="${m.a}">${TEAMS[m.a].label}</button><button ${locked ? "disabled" : ""} class="result-btn ${m.result === "draw" ? "selected" : ""}" data-match-id="${m.id}" data-result="draw">Nulle</button><button ${locked ? "disabled" : ""} class="result-btn team-result team-${m.b} ${m.result === m.b ? "selected" : ""}" data-match-id="${m.id}" data-result="${m.b}">${TEAMS[m.b].label}</button></div></article></section>`).join("");

  els.matches.querySelectorAll("[data-match-id]").forEach(b => {
    b.onclick = () => saveMatch(Number(b.dataset.matchId), b.classList.contains("selected") ? null : b.dataset.result);
  });
}

async function saveMatch(id, result) {
  if (!requireCloud()) return;
  const info = schoolInfo(selectedDate), base = recordKey(selectedDate, info.level);
  const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
  const match = normalizedMatches(r).find(m => m.id === id);
  if (!match) return;
  if (gymSubmitted(r, match.gym)) {
    showToast(`Rouvre le gym ${match.gym} avant de modifier`);
    return;
  }

  try {
    if (cloudLive) {
      const fk = fragmentKey(base, match.gym);
      const frag = structuredClone(cloudFragments[fk] || makeGymFragment(selectedDate, info, match.gym, r));
      frag.matches = frag.matches || {};
      frag.matches[`m${id}`] = { ...match, result, updatedAt: Date.now() };
      await upsertFragment(fk, frag);
    } else {
      const lr = localDB.records[base] || blankRecord(selectedDate, info);
      lr.matches[`m${id}`].result = result;
      localDB.records[base] = lr;
      persistLocal();
      renderAll();
    }
    showToast(result === null ? "Sélection retirée" : "Résultat enregistré ✓");
  } catch (e) {
    console.error(e);
    showToast("Erreur de synchronisation — réessaie");
  }
}

function renderBonuses() {
  const info = schoolInfo(selectedDate);
  const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
  const locked = daySubmitted(r);
  const labels = {
    attendance: ["👥", "80 % et +"],
    shirts: ["👕", "Chandails"],
    spirit: ["👏", "Esprit d’équipe"]
  };

  els.bonusGrid.innerHTML = TEAM_ORDER.map(t => `<article class="bonus-card"><div class="bonus-title team-${t}">${TEAMS[t].label}</div><div class="bonus-options">${Object.entries(labels).map(([k, [icon, label]]) => {
    const on = !!r.bonuses?.[t]?.[k];
    return `<button ${locked ? "disabled" : ""} class="bonus-toggle ${on ? "active" : ""}" data-team="${t}" data-bonus="${k}"><span><span class="icon">${on ? "✓" : icon}</span>${label}</span></button>`;
  }).join("")}</div></article>`).join("");

  els.bonusGrid.querySelectorAll("[data-bonus]").forEach(b => {
    b.onclick = () => saveBonus(b.dataset.team, b.dataset.bonus, !b.classList.contains("active"));
  });
}

async function saveBonus(team, bonus, value) {
  if (!requireCloud()) return;
  const info = schoolInfo(selectedDate), base = recordKey(selectedDate, info.level);
  const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
  if (daySubmitted(r)) {
    showToast("Rouvre un gym avant de modifier les bonus");
    return;
  }

  try {
    if (cloudLive) {
      const fk = fragmentKey(base, "BONUS");
      const frag = structuredClone(cloudFragments[fk] || makeBonusFragment(selectedDate, info, r));
      frag.bonuses = frag.bonuses || makeBonusFragment(selectedDate, info, r).bonuses;
      frag.bonuses[team] = frag.bonuses[team] || { attendance: false, shirts: false, spirit: false };
      frag.bonuses[team][bonus] = value;
      await upsertFragment(fk, frag);
    } else {
      const lr = localDB.records[base] || blankRecord(selectedDate, info);
      lr.bonuses[team][bonus] = value;
      localDB.records[base] = lr;
      persistLocal();
      renderAll();
    }
    showToast("Bonus mis à jour");
  } catch (e) {
    console.error(e);
    showToast("Erreur de synchronisation — réessaie");
  }
}

function pointsFor(r) {
  const s = Object.fromEntries(TEAM_ORDER.map(t => [t, { matches: 0, wins: 0, draws: 0, losses: 0, matchPoints: 0, bonusPoints: 0, total: 0 }]));
  normalizedMatches(r).forEach(m => {
    if (!m.result) return;
    s[m.a].matches++;
    s[m.b].matches++;
    if (m.result === "draw") {
      s[m.a].draws++;
      s[m.b].draws++;
      s[m.a].matchPoints++;
      s[m.b].matchPoints++;
    } else if (m.result === m.a) {
      s[m.a].wins++;
      s[m.b].losses++;
      s[m.a].matchPoints += 2;
    } else if (m.result === m.b) {
      s[m.b].wins++;
      s[m.a].losses++;
      s[m.b].matchPoints += 2;
    }
  });
  TEAM_ORDER.forEach(t => {
    const b = r?.bonuses?.[t] || {};
    s[t].bonusPoints = ["attendance", "shirts", "spirit"].filter(k => !!b[k]).length;
    s[t].total = s[t].matchPoints + s[t].bonusPoints;
  });
  return s;
}

function renderDayPoints() {
  const info = schoolInfo(selectedDate);
  const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
  const p = pointsFor(r);
  els.dayPoints.innerHTML = TEAM_ORDER.map(t => `<div class="point-card team-${t}"><small>${TEAMS[t].label.toUpperCase()}</small><strong>${p[t].total} pts</strong><small>${p[t].matchPoints} match + ${p[t].bonusPoints} bonus</small></div>`).join("");
}

function renderSubmitCard() {
  const info = schoolInfo(selectedDate);
  const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
  const gym = selectedGym;
  const other = otherGym(gym);
  const done = gymCompletedCount(r, gym);
  const complete = done === 3;
  const mineSubmitted = gymSubmitted(r, gym);
  const otherSubmitted = gymSubmitted(r, other);
  const full = daySubmitted(r);

  if (mineSubmitted) {
    els.submitCard.className = `submit-card ${full ? "submitted" : ""}`;
    els.submitCard.innerHTML = `<div class="submit-top"><h3>${full ? "Journée validée ✓" : `Gymnase ${gym} enregistré ✓`}</h3><span class="progress-pill complete">3 / 3 matchs</span></div><p>${full ? "Les deux gymnases ont soumis leurs 3 matchs. Le classement général est maintenant recalculé automatiquement." : `Tes 3 résultats sont enregistrés. En attente du gymnase ${other}. Dès qu’il soumet, le classement se met à jour sur les deux appareils.`}</p><div class="submit-actions"><button id="reopenGymBtn" class="secondary-btn" type="button">Rouvrir le gymnase ${gym}</button></div>`;
    $("reopenGymBtn").onclick = reopenGym;
    return;
  }

  els.submitCard.className = "submit-card";
  els.submitCard.innerHTML = `<div class="submit-top"><h3>Soumettre le gymnase ${gym}</h3><span class="progress-pill ${complete ? "complete" : ""}">${done} / 3 matchs</span></div><p>${complete ? `Tes 3 matchs sont complétés. Tu peux les soumettre maintenant${otherSubmitted ? `; le gymnase ${other} a déjà soumis, donc la journée deviendra officielle et le classement sera recalculé.` : "."}` : `Il reste ${3 - done} résultat${3 - done > 1 ? "s" : ""} de match à entrer dans le gymnase ${gym}.`} <b>Les bonus sont facultatifs.</b></p><button id="submitGymBtn" class="primary-btn" type="button" ${complete ? "" : "disabled"}>Soumettre les 3 matchs du gym ${gym}</button>`;
  $("submitGymBtn").onclick = submitGym;
}

async function submitGym() {
  if (!requireCloud()) return;
  const info = schoolInfo(selectedDate), base = recordKey(selectedDate, info.level), gym = selectedGym;
  const r = getRecord(selectedDate, info.level);
  if (!r || gymCompletedCount(r, gym) !== 3) {
    showToast(`Les 3 matchs du gym ${gym} doivent être complétés`);
    return;
  }
  if (gymSubmitted(r, gym)) {
    showToast(`Gym ${gym} déjà soumis`);
    return;
  }
  if (!confirm(`Soumettre les 3 matchs du gymnase ${gym}? Les bonus non cochés resteront à 0 point.`)) return;

  try {
    let becameOfficial = false;
    if (cloudLive) {
      const fk = fragmentKey(base, gym);
      const frag = structuredClone(cloudFragments[fk] || makeGymFragment(selectedDate, info, gym, r));
      frag.submitted = true;
      frag.submittedAt = Date.now();
      frag.matches = makeGymFragment(selectedDate, info, gym, r).matches;
      await upsertFragment(fk, frag);
      becameOfficial = daySubmitted(getRecord(selectedDate, info.level));
    } else {
      const lr = normalizeRecord(localDB.records[base] || blankRecord(selectedDate, info));
      lr.gymSubmissions[gym] = true;
      lr.gymSubmittedAt = lr.gymSubmittedAt || {};
      lr.gymSubmittedAt[gym] = Date.now();
      lr.submitted = lr.gymSubmissions.A && lr.gymSubmissions.B;
      localDB.records[base] = lr;
      persistLocal();
      renderAll();
      becameOfficial = lr.submitted;
    }
    showToast(becameOfficial ? "Journée complète — classement mis à jour ✓" : `Gym ${gym} enregistré ✓`);
  } catch (e) {
    console.error(e);
    showToast("Soumission impossible — réessaie");
  }
}
