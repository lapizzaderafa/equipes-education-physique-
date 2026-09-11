// Force le choix du gymnase à chaque nouveau chargement de la page.
// Le choix reste valide pendant la session courante, mais ne survit jamais à un refresh.
try {
  localStorage.removeItem("tournoi-gym-selection");
} catch (e) {
  console.warn("Impossible de nettoyer l'ancien choix de gymnase", e);
}
