(function () {
  function setupTopPresenceButton() {
    const todayView = document.getElementById("view-today");
    const competitionArea = document.getElementById("competitionArea");
    const matchHead = competitionArea?.querySelector(".section-head");
    if (!todayView || !competitionArea || !matchHead || document.getElementById("presenceTopAction")) return;

    const wrap = document.createElement("div");
    wrap.id = "presenceTopAction";
    wrap.className = "presence-top-action";
    wrap.innerHTML = `
      <button id="presenceTopBtn" class="presence-top-btn" type="button">
        <span class="presence-top-icon">👥</span>
        <span class="presence-top-copy">
          <strong>Prendre les présences</strong>
          <small>Présence + chandails</small>
        </span>
        <span class="presence-top-arrow">›</span>
      </button>
    `;

    matchHead.insertAdjacentElement("afterend", wrap);

    const btn = document.getElementById("presenceTopBtn");
    btn.addEventListener("click", () => {
      dayMode = dayMode === "presence" ? "matches" : "presence";
      relocatePresenceButton();
      applyDayMode();
      if (dayMode === "presence") renderPresence();
      syncTopPresenceButton();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.querySelectorAll(".nav-btn").forEach(nav => {
      nav.addEventListener("click", () => setTimeout(() => {
        relocatePresenceButton();
        syncTopPresenceButton();
      }, 0));
    });

    relocatePresenceButton();
    syncTopPresenceButton();
  }

  function relocatePresenceButton() {
    const wrap = document.getElementById("presenceTopAction");
    const competitionArea = document.getElementById("competitionArea");
    const matchHead = competitionArea?.querySelector(".section-head");
    const presenceArea = document.getElementById("presenceArea");
    if (!wrap || !matchHead || !presenceArea) return;

    if (dayMode === "presence") {
      presenceArea.parentNode.insertBefore(wrap, presenceArea);
    } else {
      matchHead.insertAdjacentElement("afterend", wrap);
    }
  }

  function syncTopPresenceButton() {
    const btn = document.getElementById("presenceTopBtn");
    if (!btn) return;
    if (dayMode === "presence") {
      btn.classList.add("back-mode");
      btn.innerHTML = `
        <span class="presence-top-icon">←</span>
        <span class="presence-top-copy">
          <strong>Retour aux matchs</strong>
          <small>Revenir à la journée de compétition</small>
        </span>
        <span class="presence-top-arrow">›</span>
      `;
    } else {
      btn.classList.remove("back-mode");
      btn.innerHTML = `
        <span class="presence-top-icon">👥</span>
        <span class="presence-top-copy">
          <strong>Prendre les présences</strong>
          <small>Présence + chandails</small>
        </span>
        <span class="presence-top-arrow">›</span>
      `;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupTopPresenceButton, { once: true });
  } else {
    setupTopPresenceButton();
  }
})();