function schoolInfo(iso) {
  const manual = localDB.overrides?.[iso];
  if (manual === "none") return { isSchoolDay: false, reason: "Aucun cours — correction manuelle" };
  if (manual && /^[1-9]$/.test(manual)) {
    const cycleDay = Number(manual);
    return { isSchoolDay: true, cycleDay, level: getLevel(cycleDay), manual: true };
  }
  const d = parseDate(iso), start = parseDate(SCHOOL_START), end = parseDate(SCHOOL_END);
  if (d < start || d > end) return { isSchoolDay: false, reason: "Hors de l’année scolaire" };
  if (d.getDay() === 0 || d.getDay() === 6) return { isSchoolDay: false, reason: "Fin de semaine" };
  if (specialCycle[iso]) {
    const cycleDay = specialCycle[iso];
    return { isSchoolDay: true, cycleDay, level: getLevel(cycleDay), special: true };
  }
  if (iso === "2027-06-23") return { isSchoolDay: false, reason: "Jour-cycle à confirmer dans Gestion" };
  if (fixedNoSchool.has(iso)) return { isSchoolDay: false, reason: fixedNoSchool.get(iso) };
  if (floatingPed.has(iso)) return { isSchoolDay: false, reason: floatingPed.get(iso) };

  let cycle = 1, cursor = new Date(start);
  while (cursor <= d) {
    const key = fmt(cursor);
    const weekday = cursor.getDay() !== 0 && cursor.getDay() !== 6;
    if (weekday) {
      if (fixedNoSchool.has(key)) {
      } else if (floatingPed.has(key)) {
        cycle = cycle % 9 + 1;
      } else {
        if (key === iso) return { isSchoolDay: true, cycleDay: cycle, level: getLevel(cycle) };
        cycle = cycle % 9 + 1;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { isSchoolDay: false, reason: "Date non reconnue" };
}

function recordKey(date, level) { return `${date}_${level}`; }
function fragmentKey(base, kind) { return `${base}_${kind}`; }

function blankRecord(date, info) {
  return {
    date,
    cycleDay: info.cycleDay,
    level: info.level,
    submitted: false,
    gymSubmissions: { A: false, B: false },
    matches: Object.fromEntries(DAILY_MATCHES.map(m => [`m${m.id}`, { ...m, result: null }])),
    bonuses: Object.fromEntries(TEAM_ORDER.map(t => [t, { attendance: false, shirts: false, spirit: false }]))
  };
}

function normalizeRecord(r) {
  if (!r) return r;
  r.level = canonicalLevel(r.level);
  if (!r.gymSubmissions || typeof r.gymSubmissions !== "object") {
    const oldSubmitted = r.submitted === true;
    r.gymSubmissions = { A: oldSubmitted, B: oldSubmitted };
  } else {
    r.gymSubmissions.A = r.gymSubmissions.A === true;
    r.gymSubmissions.B = r.gymSubmissions.B === true;
  }
  r.submitted = r.gymSubmissions.A && r.gymSubmissions.B;
  return r;
}

function combinedCloudRecords() {
  const out = {};
  const bases = new Set();
  Object.keys(cloudFragments).forEach(k => {
    const m = k.match(/^(.*)_(A|B|BONUS)$/);
    if (m) bases.add(m[1]);
  });

  bases.forEach(base => {
    const a = cloudFragments[fragmentKey(base, "A")];
    const b = cloudFragments[fragmentKey(base, "B")];
    const bonus = cloudFragments[fragmentKey(base, "BONUS")];
    const seed = a || b || bonus || {};
    const date = seed.date || base.slice(0, 10);
    const level = canonicalLevel(seed.level || base.slice(11));
    const info = schoolInfo(date);
    const r = blankRecord(date, {
      cycleDay: seed.cycleDay || info.cycleDay,
      level
    });

    for (const [gym, frag] of [["A", a], ["B", b]]) {
      if (!frag) continue;
      Object.entries(frag.matches || {}).forEach(([mk, mv]) => {
        r.matches[mk] = { ...(r.matches[mk] || {}), ...mv };
      });
      r.gymSubmissions[gym] = frag.submitted === true;
      r.gymSubmittedAt = r.gymSubmittedAt || {};
      if (frag.submittedAt) r.gymSubmittedAt[gym] = frag.submittedAt;
    }
    if (bonus?.bonuses) r.bonuses = bonus.bonuses;
    r.submitted = r.gymSubmissions.A && r.gymSubmissions.B;
    out[base] = normalizeRecord(r);
  });
  return out;
}

function getRecord(date, level) {
  if (!level) return null;
  const key = recordKey(date, level);
  const records = cloudLive ? combinedCloudRecords() : localDB.records;
  return normalizeRecord(records[key] || null);
}

async function ensureRecord(date, info) {
  if (cloudLive) return;
  const key = recordKey(date, info.level);
  if (!localDB.records[key]) {
    localDB.records[key] = blankRecord(date, info);
    persistLocal();
  }
}

function makeGymFragment(date, info, gym, r) {
  return {
    date,
    cycleDay: info.cycleDay,
    level: info.level,
    gym,
    submitted: gymSubmitted(r, gym),
    submittedAt: r?.gymSubmittedAt?.[gym] || null,
    matches: Object.fromEntries(
      normalizedMatches(r)
        .filter(m => m.gym === gym)
        .map(m => [`m${m.id}`, { ...m }])
    )
  };
}

function makeBonusFragment(date, info, r) {
  return {
    date,
    cycleDay: info.cycleDay,
    level: info.level,
    bonuses: structuredClone(r?.bonuses || blankRecord(date, info).bonuses)
  };
}

function gymSubmitted(r, gym) { return !!normalizeRecord(r)?.gymSubmissions?.[gym]; }
function daySubmitted(r) { return gymSubmitted(r, "A") && gymSubmitted(r, "B"); }
function otherGym(gym) { return gym === "A" ? "B" : "A"; }
function gymCompletedCount(r, gym) { return normalizedMatches(r).filter(m => m.gym === gym && !!m.result).length; }
function completedCount(r) { return normalizedMatches(r).filter(m => !!m.result).length; }

async function renderToday() {
  const info = schoolInfo(selectedDate), dateLabel = pretty(selectedDate);
  if (!info.isSchoolDay) {
    els.competitionArea.hidden = true;
    els.dayStatus.innerHTML = `<div class="big-day"><span class="cycle-badge">—</span></div><h2>Aucune compétition</h2><p>${esc(dateLabel)} · ${esc(info.reason || "Aucun cours")}</p>`;
    return;
  }
  if (!info.level) {
    els.competitionArea.hidden = true;
    els.dayStatus.innerHTML = `<div class="big-day"><span class="cycle-badge">Jour ${info.cycleDay}</span></div><h2>Aucune compétition aujourd’hui</h2><p>${esc(dateLabel)} · Compétitions aux jours 2, 3, 6 et 7.</p>`;
    return;
  }

  await ensureRecord(selectedDate, info);
  const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
  const full = daySubmitted(r);
  const submittedCount = ["A", "B"].filter(g => gymSubmitted(r, g)).length;
  const statusText = full ? "✓ Journée validée" : submittedCount === 1 ? "✓ 1 gym soumis" : "● En cours";
  const statusClass = full ? "submitted" : "draft";

  els.competitionArea.hidden = !selectedGym;
  els.dayStatus.innerHTML = `<div class="big-day"><span class="cycle-badge">Jour ${info.cycleDay}</span>${selectedGym ? `<span class="cycle-badge">Gym ${selectedGym}</span>` : ""}<span class="status-badge ${statusClass}">${statusText}</span></div><h2>${esc(LEVELS[info.level])}</h2><p>${esc(dateLabel)} · 11 h 30 à midi · ${full ? "Les points comptent au classement général." : "Chaque arbitre peut soumettre son gym après ses 3 matchs. Les bonus sont facultatifs."}</p>`;

  if (!selectedGym) {
    openGymGate();
    return;
  }
  renderMatches();
  renderBonuses();
  renderDayPoints();
  renderSubmitCard();
}
