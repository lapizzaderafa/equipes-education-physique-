(() => {
  const RESET_MARKER = "tournoi-reset-live-2026-09-11-v1";
  try {
    if (localStorage.getItem(RESET_MARKER)) return;

    [
      "tournoi-couleurs-v2",
      "tournoi-couleurs-v3-cloud",
      "tournoi-presence-local-v1",
      "tournoi-presence-local-v2"
    ].forEach(key => localStorage.removeItem(key));

    localStorage.setItem(RESET_MARKER, new Date().toISOString());
  } catch (e) {
    console.warn("Réinitialisation locale non disponible", e);
  }
})();