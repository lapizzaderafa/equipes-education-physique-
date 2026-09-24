(function () {
  function todayIso() { return fmt(new Date()); }
  function isPastCompetitionDate() { return selectedDate < todayIso(); }

  function renderCorrectionNotice() {
    let notice = document.getElementById("correctionNotice");
    const area = document.getElementById("competitionArea");
    if (!area) return;
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "correctionNotice";
      notice.className = "correction-notice";
      area.insertBefore(notice, area.firstChild);
    }
    const info = schoolInfo(selectedDate);
    const record = info.level ? getRecord(selectedDate, info.level) : null;
    const active = !!(isPastCompetitionDate() && info.isSchoolDay && info.level && record);
    notice.hidden = !active;
    if (active) {
      notice.innerHTML = `<strong>✎ Mode correction</strong><span>Cette journée est passée. Tu peux corriger les données; le classement se met à jour automatiquement.</span>`;
    }
  }

  renderMatches = function() {
    const info = schoolInfo(selectedDate);
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const submitted = gymSubmitted(r, selectedGym);
    const correction = isPastCompetitionDate();
    const locked = submitted && !correction;
    const ms = normalizedMatches(r).filter(m => m.gym === selectedGym);

    els.matches.innerHTML = ms.map(m => `<section><p class="slot-time">${m.time}</p><article class="match-card"><div class="match-meta"><span class="gym-badge">GYM ${m.gym}</span><span class="live-badge">Match ${m.slot} sur 3${submitted ? (correction ? " · correction" : " · verrouillé") : ""}</span></div><div class="matchup"><div class="team-pill team-${m.a}">${TEAMS[m.a].label}</div><span class="vs">VS</span><div class="team-pill team-${m.b}">${TEAMS[m.b].label}</div></div><div class="result-buttons"><button ${locked ? "disabled" : ""} class="result-btn team-result team-${m.a} ${m.result === m.a ? "selected" : ""}" data-match-id="${m.id}" data-result="${m.a}">${TEAMS[m.a].label}</button><button ${locked ? "disabled" : ""} class="result-btn ${m.result === "draw" ? "selected" : ""}" data-match-id="${m.id}" data-result="draw">Nulle</button><button ${locked ? "disabled" : ""} class="result-btn team-result team-${m.b} ${m.result === m.b ? "selected" : ""}" data-match-id="${m.id}" data-result="${m.b}">${TEAMS[m.b].label}</button></div></article></section>`).join("");

    els.matches.querySelectorAll("[data-match-id]").forEach(b => {
      b.onclick = () => saveMatch(Number(b.dataset.matchId), b.classList.contains("selected") ? null : b.dataset.result);
    });
    renderCorrectionNotice();
  };

  saveMatch = async function(id, result) {
    if (!requireCloud()) return;
    const info = schoolInfo(selectedDate), base = recordKey(selectedDate, info.level);
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const match = normalizedMatches(r).find(m => m.id === id);
    if (!match) return;
    const submitted = gymSubmitted(r, match.gym);
    if (submitted && !isPastCompetitionDate()) {
      showToast(`Rouvre le gym ${match.gym} avant de modifier`);
      return;
    }

    try {
      if (cloudLive) {
        const fk = fragmentKey(base, match.gym);
        const frag = cloneForCorrection(cloudFragments[fk] || makeGymFragment(selectedDate, info, match.gym, r));
        frag.matches = frag.matches || {};
        frag.matches[`m${id}`] = { ...match, result, updatedAt: Date.now() };
        if (submitted) frag.submitted = true;
        frag.correctedAt = Date.now();
        await upsertFragment(fk, frag);
        await pullCloud(true);
      } else {
        const lr = localDB.records[base] || blankRecord(selectedDate, info);
        lr.matches[`m${id}`].result = result;
        lr.correctedAt = Date.now();
        localDB.records[base] = lr;
        persistLocal();
        renderAll();
      }
      showToast(isPastCompetitionDate() ? "Correction enregistrée — classement mis à jour ✓" : (result === null ? "Sélection retirée" : "Résultat enregistré ✓"));
    } catch (e) {
      console.error(e);
      showToast("Erreur de synchronisation — réessaie");
    }
  };

  function cloneForCorrection(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  saveBonus = async function(team, bonus, value) {
    if (!requireCloud()) return;
    if (bonus === "attendance" || bonus === "shirts") {
      showToast("Ce point se calcule automatiquement avec les présences");
      return;
    }
    const info = schoolInfo(selectedDate), base = recordKey(selectedDate, info.level);
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const submitted = daySubmitted(r);
    if (submitted && !isPastCompetitionDate()) {
      showToast("Rouvre un gym avant de modifier les bonus");
      return;
    }
    try {
      if (cloudLive) {
        const fk = fragmentKey(base, "BONUS");
        const frag = cloneForCorrection(cloudFragments[fk] || makeBonusFragment(selectedDate, info, r));
        frag.bonuses = frag.bonuses || makeBonusFragment(selectedDate, info, r).bonuses;
        frag.bonuses[team] = frag.bonuses[team] || { attendance: false, shirts: false, spirit: false };
        frag.bonuses[team][bonus] = value;
        frag.correctedAt = Date.now();
        await upsertFragment(fk, frag);
        await pullCloud(true);
      } else {
        const lr = localDB.records[base] || blankRecord(selectedDate, info);
        lr.bonuses[team][bonus] = value;
        lr.correctedAt = Date.now();
        localDB.records[base] = lr;
        persistLocal();
        renderAll();
      }
      showToast(isPastCompetitionDate() ? "Correction enregistrée — classement mis à jour ✓" : "Bonus mis à jour");
    } catch (e) {
      console.error(e);
      showToast("Erreur de synchronisation — réessaie");
    }
  };

  renderBonuses = function() {
    const info = schoolInfo(selectedDate);
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const locked = daySubmitted(r) && !isPastCompetitionDate();
    const labels = {
      attendance: ["👥", "Équipe complète", true],
      shirts: ["👕", "Chandail", true],
      spirit: ["👏", "Esprit d’équipe", false]
    };

    els.bonusGrid.innerHTML = TEAM_ORDER.map(t => `<article class="bonus-card"><div class="bonus-title team-${t}">${TEAMS[t].label}</div><div class="bonus-options">${Object.entries(labels).map(([k, [icon, label, automatic]]) => {
      const on = !!r.bonuses?.[t]?.[k];
      const disabled = automatic || locked;
      return `<button ${disabled ? "disabled" : ""} class="bonus-toggle ${automatic ? "auto" : ""} ${on ? "active" : ""}" data-team="${t}" data-bonus="${k}" title="${automatic ? "Attribué automatiquement via les présences" : ""}"><span><span class="icon">${on ? "✓" : icon}</span>${label}${automatic ? "<small style='display:block;font-size:.62rem;margin-top:3px'>AUTO</small>" : ""}</span></button>`;
    }).join("")}</div></article>`).join("");

    els.bonusGrid.querySelectorAll("[data-bonus='spirit']").forEach(b => {
      if (!b.disabled) b.onclick = () => saveBonus(b.dataset.team, b.dataset.bonus, !b.classList.contains("active"));
    });
  };

  renderHistory = function() {
    const rs = Object.values(activeRecords()).map(normalizeRecord).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
    if (!rs.length) {
      els.historyList.innerHTML = `<div class="empty-state"><strong>Aucune journée enregistrée</strong>Les journées apparaîtront ici dès les premiers résultats.</div>`;
      return;
    }
    els.historyList.innerHTML = rs.map(r => {
      const p = pointsFor(r), done = completedCount(r), full = daySubmitted(r);
      const aStatus = gymSubmitted(r, "A") ? "A ✓" : `A ${gymCompletedCount(r, "A")}/3`;
      const bStatus = gymSubmitted(r, "B") ? "B ✓" : `B ${gymCompletedCount(r, "B")}/3`;
      const old = r.date < todayIso();
      return `<article class="history-card"><div class="history-top"><div><h3>${esc(pretty(r.date))}</h3><p>Jour ${r.cycleDay} · ${esc(LEVELS[r.level])} · ${done}/6 matchs · ${aStatus} · ${bStatus}</p><span class="history-status ${full ? "submitted" : "draft"}">${full ? "✓ Validée" : "● En cours"}</span></div><button class="edit-link" data-edit="${r.date}">${old ? "Modifier" : "Ouvrir"}</button></div><div class="history-points">${TEAM_ORDER.map(t => `<div class="history-team team-${t}">${TEAMS[t].label}<br>${p[t].total} pts</div>`).join("")}</div></article>`;
    }).join("");
    els.historyList.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
      setDate(b.dataset.edit);
      showView("today");
      setTimeout(() => {
        renderMatches();
        renderBonuses();
        renderCorrectionNotice();
      }, 0);
    });
  };

  const previousRenderAll = renderAll;
  renderAll = function() {
    previousRenderAll();
    renderMatches();
    renderBonuses();
    renderHistory();
    renderCorrectionNotice();
  };

  renderAll();
})();
