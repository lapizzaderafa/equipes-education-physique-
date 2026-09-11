// Fonctions indispensables chargées AVANT les scripts du tournoi.
// Elles évitent que tournoi-1.js utilise des helpers définis seulement plus tard.
function parseDate(iso) {
  const parts = String(iso || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 12);
}

function fmt(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function loadLocal() {
  try {
    const x = JSON.parse(localStorage.getItem("tournoi-couleurs-v3-cloud"));
    if (x && x.records) return { records: x.records || {}, overrides: x.overrides || {} };
  } catch (e) {
    console.warn("Lecture locale impossible", e);
  }
  return { records: {}, overrides: {} };
}

function persistLocal() {
  try {
    if (typeof localDB !== "undefined") {
      localStorage.setItem("tournoi-couleurs-v3-cloud", JSON.stringify(localDB));
    }
  } catch (e) {
    console.warn("Sauvegarde locale impossible", e);
  }
}

// Compatibilité avec certains navigateurs intégrés iOS.
if (typeof window.structuredClone !== "function") {
  window.structuredClone = function(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  };
}
