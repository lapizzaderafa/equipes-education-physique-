async function reopenGym() {
  if (!requireCloud()) return;
  const info = schoolInfo(selectedDate), base = recordKey(selectedDate, info.level), gym = selectedGym;
  if (!confirm(`Rouvrir le gymnase ${gym}? Ses 3 matchs pourront être corrigés. La journée sera retirée du classement général jusqu’à ce que les deux gyms soient de nouveau soumis.`)) return;

  try {
    if (cloudLive) {
      const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
      const fk = fragmentKey(base, gym);
      const frag = structuredClone(cloudFragments[fk] || makeGymFragment(selectedDate, info, gym, r));
      frag.submitted = false;
      frag.reopenedAt = Date.now();
      await upsertFragment(fk, frag);
    } else {
      const lr = normalizeRecord(localDB.records[base] || blankRecord(selectedDate, info));
      lr.gymSubmissions[gym] = false;
      lr.submitted = false;
      localDB.records[base] = lr;
      persistLocal();
      renderAll();
    }
    showToast(`Gym ${gym} rouvert`);
  } catch (e) {
    console.error(e);
    showToast("Erreur de synchronisation — réessaie");
  }
}

function activeRecords() { return cloudLive ? combinedCloudRecords() : localDB.records; }

function aggregate(filter) {
  const a = Object.fromEntries(TEAM_ORDER.map(t => [t, { matches: 0, wins: 0, draws: 0, losses: 0, matchPoints: 0, bonusPoints: 0, total: 0 }]));
  Object.values(activeRecords()).forEach(raw => {
    const r = normalizeRecord(raw);
    if (!r || r.date < COMPETITION_START || !daySubmitted(r)) return;
    if (filter !== "all" && r.level !== filter) return;
    const p = pointsFor(r);
    TEAM_ORDER.forEach(t => Object.keys(a[t]).forEach(k => a[t][k] += p[t][k]));
  });
  return a;
}

function renderRanking() {
  const a = aggregate(rankingFilter);
  const ranked = TEAM_ORDER.map((team, i) => ({ team, i, ...a[team] }))
    .sort((x, y) => y.total - x.total || y.matchPoints - x.matchPoints || y.wins - x.wins || x.i - y.i);
  els.rankingCards.innerHTML = ranked.map((r, i) => `<article class="rank-card"><div class="rank-pos">${i + 1}</div><div><div class="rank-name"><span class="color-dot team-${r.team}"></span>${TEAMS[r.team].label}</div><div class="rank-stats">${r.matches} matchs · ${r.wins} V · ${r.draws} N · ${r.losses} D<br>${r.matchPoints} pts matchs + ${r.bonusPoints} bonus</div></div><div class="rank-total"><strong>${r.total}</strong><span>points</span></div></article>`).join("");
}

function renderHistory() {
  const rs = Object.values(activeRecords()).map(normalizeRecord).filter(r => r && r.date >= COMPETITION_START).sort((a, b) => b.date.localeCompare(a.date));
  if (!rs.length) {
    els.historyList.innerHTML = `<div class="empty-state"><strong>Aucune journée enregistrée</strong>Les journées apparaîtront ici dès les premiers résultats.</div>`;
    return;
  }
  els.historyList.innerHTML = rs.map(r => {
    const p = pointsFor(r), done = completedCount(r), full = daySubmitted(r);
    const aStatus = gymSubmitted(r, "A") ? "A ✓" : `A ${gymCompletedCount(r, "A")}/3`;
    const bStatus = gymSubmitted(r, "B") ? "B ✓" : `B ${gymCompletedCount(r, "B")}/3`;
    return `<article class="history-card"><div class="history-top"><div><h3>${esc(pretty(r.date))}</h3><p>Jour ${r.cycleDay} · ${esc(LEVELS[r.level])} · ${done}/6 matchs · ${aStatus} · ${bStatus}</p><span class="history-status ${full ? "submitted" : "draft"}">${full ? "✓ Validée" : "● En cours"}</span></div><button class="edit-link" data-edit="${r.date}">Ouvrir</button></div><div class="history-points">${TEAM_ORDER.map(t => `<div class="history-team team-${t}">${TEAMS[t].label}<br>${p[t].total} pts</div>`).join("")}</div></article>`;
  }).join("");
  els.historyList.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    setDate(b.dataset.edit);
    showView("today");
  });
}

function saveOverride() {
  const date = els.overrideDate.value, val = els.overrideCycle.value;
  if (!date) return;
  if (!val) delete localDB.overrides[date];
  else localDB.overrides[date] = val;
  persistLocal();
  renderAll();
  showToast("Calendrier mis à jour");
}

function renderOverrides() {
  const es = Object.entries(localDB.overrides || {}).sort(([a], [b]) => a.localeCompare(b));
  els.overrideList.innerHTML = es.length ? es.map(([d, v]) => `<div class="override-row"><span>${esc(pretty(d))} — ${v === "none" ? "Aucun cours" : `Jour ${v}`}</span><button data-remove="${d}">Retirer</button></div>`).join("") : `<p class="helper">Aucune correction manuelle.</p>`;
  els.overrideList.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => {
    delete localDB.overrides[b.dataset.remove];
    persistLocal();
    renderAll();
  });
}

function resetLocal() {
  if (prompt('Écris EFFACER pour confirmer') !== "EFFACER") return;
  localDB = { records: cloudLive ? combinedCloudRecords() : {}, overrides: {} };
  persistLocal();
  renderAll();
  showToast("Copie locale réinitialisée");
}

async function downloadBackup() {
  if (cloudLive) {
    try { await pullCloud(true); } catch (error) { console.warn("Export de la dernière copie confirmée", error); }
  }
  let saved;
  try { saved = JSON.parse(localStorage.getItem(BACKUP_KEY) || "null"); } catch { saved = null; }
  if (!saved?.rows?.length && cloudLive && Object.keys(cloudFragments).length) {
    saved = { savedAt: new Date().toISOString(), rows: Object.entries(cloudFragments).map(([record_key, payload]) => ({ record_key, payload })) };
  }
  if (!saved?.rows?.length) { showToast("Aucune sauvegarde confirmée disponible sur cet appareil"); return; }
  const data = { format: "coupe-typhon-v1", exportedAt: new Date().toISOString(), lastConfirmedAt: saved.savedAt, roomId: ROOM_ID, rows: saved.rows };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `coupe-typhon-sauvegarde-${fmt(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  showToast(cloudLive ? "Sauvegarde téléchargée ✓" : "Dernière copie confirmée téléchargée (hors ligne)");
}

$("downloadBackupBtn").onclick = downloadBackup;

function renderAll() {
  renderToday();
  renderRanking();
  renderHistory();
  renderOverrides();
  updateGymUI();
}

function loadLocal() {
  try {
    const x = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (x?.records) return { records: x.records || {}, overrides: x.overrides || {} };
  } catch {}
  return { records: {}, overrides: {} };
}
function persistLocal() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(localDB)); } catch (error) { console.warn("Copie locale indisponible", error); } }
function parseDate(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, 12); }
function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function pretty(iso) { return new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parseDate(iso)); }
function esc(v) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function showToast(msg) {
  clearTimeout(toastTimer);
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

init();
