(function () {
  const originalRenderSubmitCard = renderSubmitCard;

  function isPastDate() {
    return selectedDate < fmt(new Date());
  }

  renderSubmitCard = function() {
    originalRenderSubmitCard();
    const info = schoolInfo(selectedDate);
    if (!isPastDate() || !info.isSchoolDay || !info.level) return;
    const r = getRecord(selectedDate, info.level);
    if (!r || !daySubmitted(r)) return;

    els.submitCard.className = "submit-card submitted";
    els.submitCard.innerHTML = `<div class="submit-top"><h3>Journée validée ✓</h3><span class="progress-pill complete">Mode correction</span></div><p>Cette journée reste officielle. Tu peux modifier les résultats, l’esprit d’équipe ou les présences en tout temps; le classement sera recalculé automatiquement.</p>`;
  };

  const previousRenderAll = renderAll;
  renderAll = function() {
    previousRenderAll();
    renderSubmitCard();
  };

  renderSubmitCard();
})();