(function () {
  const originalSaveBonus = saveBonus;

  renderBonuses = function() {
    const info = schoolInfo(selectedDate);
    const r = getRecord(selectedDate, info.level) || blankRecord(selectedDate, info);
    const locked = daySubmitted(r);
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
      if (!b.disabled) {
        b.onclick = () => originalSaveBonus(b.dataset.team, b.dataset.bonus, !b.classList.contains("active"));
      }
    });
  };

  saveBonus = async function(team, bonus, value) {
    if (bonus === "attendance" || bonus === "shirts") {
      showToast("Ce point se calcule automatiquement avec les présences");
      return;
    }
    return originalSaveBonus(team, bonus, value);
  };

  const originalRenderAll = renderAll;
  renderAll = function() {
    originalRenderAll();
    renderBonuses();
  };

  renderBonuses();
})();