const SUPABASE_URL = "https://jetogsbyptglaihktdel.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpldG9nc2J5cHRnbGFpaGt0ZGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzYyODQsImV4cCI6MjEwMzcxMjI4NH0.Evdhtdbb9jsjGxAEQ4JZ7wctdME--MPrMygjvfYj2Zg";
const ROOM_ID = "4069ee17-d2ac-47a3-9b47-ed7d03d4c98f";
const TABLE = "eps_tournoi_records";
const REST_URL = `${SUPABASE_URL}/rest/v1/${TABLE}`;

const STORAGE_KEY = "tournoi-couleurs-v3-cloud";
const GYM_KEY = "tournoi-gym-selection";
const SCHOOL_START = "2026-08-31";
const SCHOOL_END = "2027-06-23";

const TEAMS = {
  rouge: { label: "Rouge" },
  vert: { label: "Vert" },
  bleu: { label: "Bleu" },
  jaune: { label: "Jaune" }
};
const TEAM_ORDER = ["rouge", "vert", "bleu", "jaune"];
const LEVELS = { S12: "Secondaire 1-2", S345: "Secondaire 3-4-5", S1: "Secondaire 1-2", S2: "Secondaire 1-2" };
const DAILY_MATCHES = [
  { id: 1, slot: 1, time: "11 h 30 – 11 h 40", gym: "A", a: "rouge", b: "vert" },
  { id: 2, slot: 1, time: "11 h 30 – 11 h 40", gym: "B", a: "bleu", b: "jaune" },
  { id: 3, slot: 2, time: "11 h 40 – 11 h 50", gym: "A", a: "rouge", b: "bleu" },
  { id: 4, slot: 2, time: "11 h 40 – 11 h 50", gym: "B", a: "vert", b: "jaune" },
  { id: 5, slot: 3, time: "11 h 50 – 12 h 00", gym: "A", a: "rouge", b: "jaune" },
  { id: 6, slot: 3, time: "11 h 50 – 12 h 00", gym: "B", a: "vert", b: "bleu" }
];

const fixedNoSchool = new Map();
const addNo = (d, l) => fixedNoSchool.set(d, l);
function addRange(s, e, l) {
  let d = parseDate(s), last = parseDate(e);
  while (d <= last) {
    if (d.getDay() !== 0 && d.getDay() !== 6) addNo(fmt(d), l);
    d.setDate(d.getDate() + 1);
  }
}
addNo("2026-09-07", "Congé");
addNo("2026-10-05", "Journée pédagogique");
addNo("2026-10-12", "Congé");
addNo("2026-10-23", "Journée pédagogique");
addNo("2026-11-19", "Journée pédagogique");
addNo("2026-11-20", "Journée pédagogique");
addRange("2026-12-21", "2027-01-01", "Congé des Fêtes");
addNo("2027-01-04", "Journée pédagogique");
addNo("2027-02-12", "Journée pédagogique");
addRange("2027-03-01", "2027-03-05", "Semaine de relâche");
addNo("2027-03-26", "Congé");
addNo("2027-03-29", "Congé");
addNo("2027-04-09", "Journée pédagogique");
addNo("2027-04-19", "Journée pédagogique / reprise possible");
addNo("2027-05-10", "Journée pédagogique / reprise possible");
addNo("2027-05-21", "Journée pédagogique");
addNo("2027-05-24", "Congé");
const floatingPed = new Map([
  ["2026-09-25", "Journée pédagogique flottante"],
  ["2027-01-29", "Journée pédagogique flottante"]
]);
const specialCycle = { "2027-06-21": 1, "2027-06-22": 3 };

let localDB = loadLocal();
let cloudFragments = {};
let cloudHash = "";
let cloudLive = false;
let selectedDate = fmt(new Date());
let selectedGym = localStorage.getItem(GYM_KEY) || null;
let rankingFilter = "all";
let toastTimer = null;
let pulling = false;

const $ = id => document.getElementById(id);
const els = {
  datePicker: $("datePicker"), dayStatus: $("dayStatus"), competitionArea: $("competitionArea"),
  matches: $("matches"), bonusGrid: $("bonusGrid"), dayPoints: $("dayPoints"), submitCard: $("submitCard"),
  rankingCards: $("rankingCards"), historyList: $("historyList"), overrideDate: $("overrideDate"),
  overrideCycle: $("overrideCycle"), overrideList: $("overrideList"), toast: $("toast"), gymGate: $("gymGate"),
  gymChip: $("gymChip"), gymTitle: $("gymTitle"), saveState: $("saveState"), syncPill: $("syncPill"),
  syncText: $("syncText"), deviceGymText: $("deviceGymText"), firebaseStatusText: $("firebaseStatusText")
};

async function init() {
  els.datePicker.value = selectedDate;
  els.overrideDate.value = selectedDate;
  bind();
  updateGymUI();
  renderAll();
  await initCloud();
  if (!selectedGym) openGymGate();
}

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function initCloud() {
  try {
    await pullCloud(true);
    cloudLive = true;
    setSync(true, "En direct");
    els.firebaseStatusText.textContent = "Synchronisation active. Les gymnases A et B partagent maintenant les mêmes résultats et le même classement.";
    setInterval(() => {
      if (document.visibilityState === "visible") pullCloud(false).catch(() => {});
    }, 2500);
  } catch (e) {
    console.error(e);
    cloudLive = false;
    setSync(false, "Mode local");
    els.firebaseStatusText.textContent = "La synchronisation en ligne est momentanément indisponible. L’app continue avec la copie locale de cet appareil.";
  }
}

async function pullCloud(forceRender = false) {
  if (pulling) return;
  pulling = true;
  try {
    const url = `${REST_URL}?room_id=eq.${encodeURIComponent(ROOM_ID)}&select=record_key,payload,updated_at&order=record_key.asc`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    const nextHash = JSON.stringify(rows);
    if (forceRender || nextHash !== cloudHash) {
      cloudHash = nextHash;
      cloudFragments = Object.fromEntries(rows.map(r => [r.record_key, r.payload || {}]));
      localDB.records = combinedCloudRecords();
      persistLocal();
      renderAll();
    }
    if (!cloudLive) {
      cloudLive = true;
      setSync(true, "En direct");
    }
  } finally {
    pulling = false;
  }
}

async function upsertFragment(key, payload) {
  const body = {
    room_id: ROOM_ID,
    record_key: key,
    payload,
    updated_at: new Date().toISOString()
  };
  const res = await fetch(`${REST_URL}?on_conflict=room_id,record_key`, {
    method: "POST",
    headers: authHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  cloudFragments[key] = structuredClone(payload);
  localDB.records = combinedCloudRecords();
  persistLocal();
  renderAll();
}

function setSync(live, text) {
  els.syncPill.classList.toggle("live", live);
  els.syncText.textContent = text;
  els.saveState.textContent = live ? "Synchronisation en direct" : "Sauvegarde locale";
}

function bind() {
  $("prevDayBtn").onclick = () => shiftDate(-1);
  $("nextDayBtn").onclick = () => shiftDate(1);
  els.datePicker.onchange = () => setDate(els.datePicker.value);
  els.gymChip.onclick = openGymGate;
  $("changeGymBtn").onclick = openGymGate;
  document.querySelectorAll("[data-pick-gym]").forEach(b => b.onclick = () => chooseGym(b.dataset.pickGym));
  document.querySelectorAll(".nav-btn").forEach(b => b.onclick = () => showView(b.dataset.view));
  document.querySelectorAll(".segment").forEach(b => b.onclick = () => {
    rankingFilter = b.dataset.filter;
    document.querySelectorAll(".segment").forEach(x => x.classList.toggle("active", x === b));
    renderRanking();
  });
  $("saveOverrideBtn").onclick = saveOverride;
  $("resetBtn").onclick = resetLocal;
}

function openGymGate() { els.gymGate.classList.remove("hidden"); }
function chooseGym(g) {
  selectedGym = g;
  localStorage.setItem(GYM_KEY, g);
  els.gymGate.classList.add("hidden");
  updateGymUI();
  renderToday();
  showToast(`Gymnase ${g} sélectionné`);
}
function updateGymUI() {
  els.gymChip.textContent = selectedGym ? `Gym ${selectedGym}` : "Choisir gym";
  els.gymTitle.textContent = selectedGym ? `Gymnase ${selectedGym}` : "Choisis ton gymnase";
  els.deviceGymText.textContent = selectedGym ? `Cet appareil est assigné au gymnase ${selectedGym}.` : "Aucun gymnase choisi.";
}
function showView(v) {
  document.querySelectorAll(".view").forEach(x => x.classList.toggle("active", x.id === `view-${v}`));
  document.querySelectorAll(".nav-btn").forEach(x => x.classList.toggle("active", x.dataset.view === v));
  if (v === "ranking") renderRanking();
  if (v === "history") renderHistory();
  if (v === "settings") renderOverrides();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function setDate(iso) {
  if (!iso) return;
  selectedDate = iso;
  els.datePicker.value = iso;
  els.overrideDate.value = iso;
  renderToday();
}
function shiftDate(n) {
  const d = parseDate(selectedDate);
  d.setDate(d.getDate() + n);
  setDate(fmt(d));
}

function canonicalLevel(level) {
  return level === "S1" || level === "S2" ? "S12" : level;
}

function getLevel(day) {
  if (day === 2 || day === 6) return "S12";
  if (day === 3 || day === 7) return "S345";
  return null;
}
