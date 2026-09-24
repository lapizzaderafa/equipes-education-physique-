/* Referee edits stay on this device until explicit submission. */
(function () {
  const KEY = 'typhon-device-drafts-v1';
  let drafts;
  try { drafts = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { drafts = {}; }
  let saving = false;
  const sharedRecord = getRecord;
  const sharedPresence = presenceSource;
  const copy = value => JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(stableJson(a ?? null)) === JSON.stringify(stableJson(b ?? null));
  const draftKey = (date, level, gym) => `${recordKey(date, level)}_${gym}`;
  function currentDraft() {
    const info = schoolInfo(selectedDate);
    return drafts[draftKey(selectedDate, info.level, selectedGym)];
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(drafts)); }
    catch { showToast('Brouillon en mémoire seulement : garde cette page ouverte jusqu’à l’enregistrement.'); }
  }
  function editDraft() {
    const info = schoolInfo(selectedDate);
    if (saving || !selectedGym || !info.isSchoolDay || !info.level) return null;
    const key = draftKey(selectedDate, info.level, selectedGym);
    if (!drafts[key]) {
      const r = sharedRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
      const fragment = makeGymFragment(selectedDate, info, selectedGym, r);
      drafts[key] = { date: selectedDate, info, gym: selectedGym, fragment,
        original: copy(cloudFragments[key] || null), presence: {}, presenceOriginal: {}, spirits: {}, spiritOriginal: {} };
    }
    return drafts[key];
  }
  function refresh() {
    persist();
    renderAll();
    renderPresence();
    applyDayMode();
  }
  getRecord = function(date, level) {
    const shared = sharedRecord(date, level);
    const draft = drafts[draftKey(date, level, selectedGym)];
    if (!shared && !draft) return shared;

    const r = copy(shared || blankRecord(date, { ...schoolInfo(date), level }));

    if (draft) {
      Object.assign(r.matches, copy(draft.fragment.matches));
      r.gymSubmissions[draft.gym] = false;
      r.submitted = false;
      for (const [team, value] of Object.entries(draft.spirits)) r.bonuses[team].spirit = value;
    }

    // Attendance + shirt bonuses must always come from the actual presence
    // state (shared or this device's draft), never from a stale BONUS fragment.
    const base = recordKey(date, level);
    const effectiveInfo = { ...schoolInfo(date), level };
    for (const team of TEAM_ORDER) {
      const frag = presenceSource(base, team, date, effectiveInfo);
      const stats = presenceStatsFromFragment(level, team, frag);
      r.bonuses[team] = r.bonuses[team] || { attendance: false, shirts: false, spirit: false };
      r.bonuses[team].attendance = stats.attendanceBonus;
      r.bonuses[team].shirts = stats.shirtsBonus;
    }
    return r;
  };
  presenceSource = function(base, team, date, info) {
    const d = drafts[draftKey(date, info.level, selectedGym)];
    return d?.presence[team] ? copy(d.presence[team]) : sharedPresence(base, team, date, info);
  };
  saveMatch = async function(id, result) {
    if (saving) return;
    const info = schoolInfo(selectedDate);
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const match = normalizedMatches(r).find(m => m.id === id && m.gym === selectedGym);
    if (!match || (result !== null && ![match.a, match.b, 'draw'].includes(result))) return;
    const d = editDraft();
    if (!d) return;
    d.fragment.matches[`m${id}`] = { ...match, result, updatedAt: Date.now() };
    refresh();
    showToast('Brouillon sur cet appareil — à enregistrer');
  };
  saveBonus = async function(team, bonus, value) {
    if (bonus !== 'spirit' || !TEAM_ORDER.includes(team)) return;
    const d = editDraft();
    if (!d) return;
    if (!(team in d.spirits)) d.spiritOriginal[team] = !!cloudFragments[fragmentKey(recordKey(d.date, d.info.level), 'BONUS')]?.bonuses?.[team]?.spirit;
    d.spirits[team] = !!value;
    refresh();
  };
  function changePresence(change) {
    const d = editDraft();
    if (!d) return;
    const team = selectedPresenceTeam;
    const base = recordKey(d.date, d.info.level);
    if (!d.presence[team]) {
      d.presenceOriginal[team] = copy(cloudFragments[presenceFragmentKey(base, team)] || null);
      d.presence[team] = sharedPresence(base, team, d.date, d.info);
    }
    change(d.presence[team], team, d.info.level);
    refresh();
  }
  savePresenceField = async function(studentId, field, value) {
    if (!['present', 'shirt', 'motivated'].includes(field)) return;
    changePresence(frag => {
      const state = frag.students[studentId];
      if (!state) return;
      state[field] = !!value;
      if (field === 'present' && !value) state.shirt = false;
      if (field === 'present' && value) state.motivated = false;
      if (field === 'motivated' && value) { state.present = false; state.shirt = false; }
    });
  };
  saveAllPresence = async function(checked) {
    changePresence((frag, team, level) => rosterFor(level, team).forEach(s => {
      frag.students[s.id] = { present: !!checked, shirt: !!checked, motivated: false };
    }));
  };
  reopenGym = async function() {
    if (editDraft()) { refresh(); showToast('Correction locale — les résultats publiés restent inchangés'); }
  };
  function discardDraft() {
    if (saving || !confirm('Abandonner le brouillon de ce gym sur cet appareil?')) return;
    const info = schoolInfo(selectedDate);
    delete drafts[draftKey(selectedDate, info.level, selectedGym)];
    refresh();
  }
  submitGym = async function() {
    if (saving) return;
    const d = currentDraft();
    if (!d || Object.values(d.fragment.matches).filter(m => m.result).length !== 3) {
      showToast('Complète les 3 matchs avant d’enregistrer'); return;
    }
    if (!confirm(`Enregistrer les 3 matchs, les bonus et les présences du gym ${d.gym}? Ils seront alors partagés.`)) return;
    saving = true;
    renderSubmitCard();
    try {
      // Refresh directly so an in-flight periodic poll cannot skip this conflict check.
      const res = await fetch(`${REST_URL}?room_id=eq.${encodeURIComponent(ROOM_ID)}&select=record_key,payload,updated_at&order=record_key.asc`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Connexion impossible. Ton brouillon est conservé.');
      const rows = await res.json();
      const latest = Object.fromEntries(rows.map(r => [r.record_key, r.payload]));
      const base = recordKey(d.date, d.info.level), key = draftKey(d.date, d.info.level, d.gym);
      if (!equal(latest[key], d.original)) throw new Error('Ce gym a été enregistré par un autre appareil. Ton brouillon est conservé; consulte les résultats enregistrés avant de recommencer.');
      const bonusKey = fragmentKey(base, 'BONUS');
      const bonus = copy(latest[bonusKey] || makeBonusFragment(d.date, d.info, blankRecord(d.date, d.info)));
      const updates = {};
      for (const [team, value] of Object.entries(d.spirits)) {
        if (!!latest[bonusKey]?.bonuses?.[team]?.spirit !== d.spiritOriginal[team]) throw new Error('Un bonus a été modifié sur un autre appareil. Ton brouillon est conservé.');
        bonus.bonuses[team].spirit = value;
      }
      for (const [team, frag] of Object.entries(d.presence)) {
        const pk = presenceFragmentKey(base, team);
        if (!equal(latest[pk], d.presenceOriginal[team])) throw new Error('Ces présences ont été enregistrées sur un autre appareil. Ton brouillon est conservé.');
        updates[pk] = frag;
        const stats = presenceStatsFromFragment(d.info.level, team, frag);
        bonus.bonuses[team].attendance = stats.attendanceBonus;
        bonus.bonuses[team].shirts = stats.shirtsBonus;
      }
      if (Object.keys(d.presence).length || Object.keys(d.spirits).length) updates[bonusKey] = bonus;
      updates[key] = { ...copy(d.fragment), submitted: true, submittedAt: Date.now() };
      const body = Object.entries(updates).map(([record_key, payload]) => ({ room_id: ROOM_ID, record_key, payload, updated_at: new Date().toISOString() }));
      // One database request: matches, attendance and bonuses commit together.
      const savedResponse = await fetch(`${REST_URL}?on_conflict=room_id,record_key&select=record_key,payload,updated_at`, {
        method: 'POST', headers: authHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }), body: JSON.stringify(body)
      });
      if (!savedResponse.ok) throw new Error('Enregistrement impossible. Ton brouillon est conservé.');
      const saved = await savedResponse.json();
      if (saved.length !== body.length || body.some(row => !saved.some(s => s.record_key === row.record_key && equal(s.payload, row.payload)))) throw new Error('Confirmation impossible. Vérifie les résultats partagés avant de réessayer.');
      cloudFragments = { ...latest, ...Object.fromEntries(saved.map(r => [r.record_key, r.payload])) };
      cloudMetaHash = ''; cloudHash = ''; cloudLive = true;
      delete drafts[key];
      persist();
      localDB.records = combinedCloudRecords();
      persistLocal();
      saveConfirmedBackup(Object.entries(cloudFragments).map(([record_key, payload]) => ({ record_key, payload })));
      showToast(`Gym ${d.gym} enregistré et partagé ✓`);
    } catch (e) {
      showToast(e.message);
      alert(e.message);
    } finally { saving = false; refresh(); }
  };
  renderSubmitCard = function() {
    const info = schoolInfo(selectedDate);
    if (!selectedGym || !info.level) { els.submitCard.innerHTML = ''; return; }
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const d = currentDraft(), done = gymCompletedCount(r, selectedGym);
    const registered = !d && gymSubmitted(r, selectedGym);
    els.submitCard.className = 'submit-card';
    els.submitCard.innerHTML = `<h3>${registered ? 'Résultats enregistrés ✓' : 'Brouillon sur cet appareil'}</h3><p>${registered ? 'Les résultats sont partagés. Les prochaines corrections resteront locales jusqu’à leur enregistrement.' : `${done} / 3 matchs. Tes choix, bonus et présences restent sur cet appareil jusqu’à l’enregistrement.`}</p>${registered ? '<button id="reopenGymBtn" class="secondary-btn">Modifier sur cet appareil</button>' : `<button id="submitGymBtn" class="primary-btn" ${saving || done !== 3 || !d ? 'disabled' : ''}>${saving ? 'Enregistrement…' : `Enregistrer les résultats du gym ${selectedGym}`}</button>`}${d ? '<button id="discardDraftBtn" class="secondary-btn">Abandonner le brouillon</button>' : ''}`;
    if ($('submitGymBtn')) $('submitGymBtn').onclick = submitGym;
    if ($('reopenGymBtn')) $('reopenGymBtn').onclick = reopenGym;
    if ($('discardDraftBtn')) $('discardDraftBtn').onclick = discardDraft;
    els.saveState.textContent = d ? 'Brouillon privé sur cet appareil — non partagé' : 'Seuls les résultats enregistrés sont partagés';
    const notice = $('correctionNotice');
    if (notice && !notice.hidden) notice.innerHTML = '<strong>✎ Mode correction</strong><span>Les corrections restent sur cet appareil jusqu’à leur enregistrement.</span>';
  };
  const previousPresenceRender = renderPresence;
  renderPresence = function() {
    previousPresenceRender();
    const area = $('presenceArea');
    if (area && selectedGym && schoolInfo(selectedDate).level) {
      const note = document.createElement('p');
      note.className = 'helper';
      note.textContent = 'Présences en brouillon sur cet appareil. Enregistre-les avec les 3 matchs dans l’onglet Matchs.';
      area.append(note);
    }
  };
  const previousRender = renderAll;
  renderAll = function() { previousRender(); renderSubmitCard(); renderPresence(); applyDayMode(); };
  // A delayed cloud read only refreshes shared data; drafts are never merged into it.
  renderAll();
})();
