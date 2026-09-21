const SUPABASE_URL="https://jetogsbyptglaihktdel.supabase.co";
const SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpldG9nc2J5cHRnbGFpaGt0ZGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzYyODQsImV4cCI6MjEwMzcxMjI4NH0.Evdhtdbb9jsjGxAEQ4JZ7wctdME--MPrMygjvfYj2Zg";
const ROOM_ID="4069ee17-d2ac-47a3-9b47-ed7d03d4c98f";
const REST_URL=`${SUPABASE_URL}/rest/v1/eps_tournoi_records`;

const TEAMS={rouge:{label:"Rouge",className:"red"},vert:{label:"Vert",className:"green"},bleu:{label:"Bleu",className:"blue"},jaune:{label:"Jaune",className:"yellow"}};
const TEAM_ORDER=["rouge","vert","bleu","jaune"];
const LEVELS={S12:"Secondaire 1-2",S345:"Secondaire 3-4-5",S1:"Secondaire 1-2",S2:"Secondaire 1-2"};
const DAILY_MATCHES=[
  {id:1,slot:1,time:"11 h 30 – 11 h 40",gym:"A",a:"rouge",b:"vert"},
  {id:2,slot:1,time:"11 h 30 – 11 h 40",gym:"B",a:"bleu",b:"jaune"},
  {id:3,slot:2,time:"11 h 40 – 11 h 50",gym:"A",a:"rouge",b:"bleu"},
  {id:4,slot:2,time:"11 h 40 – 11 h 50",gym:"B",a:"vert",b:"jaune"},
  {id:5,slot:3,time:"11 h 50 – 12 h 00",gym:"A",a:"rouge",b:"jaune"},
  {id:6,slot:3,time:"11 h 50 – 12 h 00",gym:"B",a:"vert",b:"bleu"}
];

const ROSTERS={
  S12:{
    rouge:["Clara Belzile","Alice Grenier","Ariane Bélanger","Ève Briand","Maxim Drouin","Henri Foster","Jules Larivière","Mya Larouche","Lya Marceau","Arnaud Néron","Manda Ramanandraibe Hiaro","Edouard Sirois","Victor Tanguay","Cassandra Fiset","Laïla Tanguay"],
    vert:["Thierry Bellavance","Sarah-Maude Fortin","Camille moore","Florence Giguère","Alexandre Germain","lexie labrecque","Jérémy Letellier","Jeanne Paradis","Florence Roux","jacob talbot","Koralie Dion","Alycia Marcil","Jade Roberge","Maxime Mercier","Laurence Julien","Thomas Mercier"],
    bleu:["Alfred Elliot Anctil","Martin Coronel","Éliane Dubé","Éliam Fournier","Rosalie Julien","Justine Lasalle","léonie martel","Mélodie Otis-Dubé","Émilia roger","Flavie St-Laurent","Léo Jason Andriamboavonjy","Maryane Lachance","Viktoriia Lisnycha","Ariane Bolduc","Mehdi Chachia Plamondon"],
    jaune:["Emy-Anne Côté","Arsène Mvondo Wong","Baptiste Autret","Estée Bouchard","Tyfany Russel","Anais Fortin","Zara Grimard","Matthew Lajeunesse","Chloé Mainguy","Tasnim Naouali","Jeanne Polisois","julien vallières","Dominic Dionne","Josianne Dolet","charles-olivier seaborn"]
  },
  S345:{
    rouge:["Tom Arsenault","Simone Beaudin","Zackary Pleau","Dorianne Caron","Jérémy Billette","Charles Fisette","Sarah Duquette","Émile Foster","Miakym zaragoza","Léo Grenier"],
    vert:["Éliane Bériault","Bastien Munger","mathilde cantin","Félix Martineau","Charles Germain","Lucas St-Pierre","Loane Bourque","floralie huard","Simon Bujold"],
    bleu:["Justin Allen","Félix Bordeleau","Edmond Cloutier","Louis Genois","Rosalie Lachance","Grégoire Paradis","Hubert Larivière","Louis-Thomas Des Rochers","Mykaëla Fiset"],
    jaune:["Léana Soucy","Paul Cloutier","Éliot Bélanger","Anne-Sophie Gouin","Malik Mercier","Félix Pouliot","Maxime Turcotte","Liam Brière","Maya Nourcy"]
  }
};

const SCHOOL_START="2026-08-31";
const SCHOOL_END="2027-06-23";
const fixedNoSchool=new Map();
const addNo=(d,l)=>fixedNoSchool.set(d,l);
function addRange(s,e,l){let d=parseDate(s),last=parseDate(e);while(d<=last){if(d.getDay()!==0&&d.getDay()!==6)addNo(fmt(d),l);d.setDate(d.getDate()+1)}}
addNo("2026-09-07","Congé");addNo("2026-10-05","Journée pédagogique");addNo("2026-10-12","Congé");addNo("2026-10-23","Journée pédagogique");addNo("2026-11-19","Journée pédagogique");addNo("2026-11-20","Journée pédagogique");addRange("2026-12-21","2027-01-01","Congé des Fêtes");addNo("2027-01-04","Journée pédagogique");addNo("2027-02-12","Journée pédagogique");addRange("2027-03-01","2027-03-05","Semaine de relâche");addNo("2027-03-26","Congé");addNo("2027-03-29","Congé");addNo("2027-04-09","Journée pédagogique");addNo("2027-04-19","Journée pédagogique / reprise possible");addNo("2027-05-10","Journée pédagogique / reprise possible");addNo("2027-05-21","Journée pédagogique");addNo("2027-05-24","Congé");
const floatingPed=new Map([["2026-09-25","Journée pédagogique flottante"],["2027-01-29","Journée pédagogique flottante"]]);
const specialCycle={"2027-06-21":1,"2027-06-22":3};

let selectedDate=fmt(new Date());
let rankingFilter="all";
let cloudFragments={};
let cloudHash="";

const $=id=>document.getElementById(id);
const els={datePicker:$("datePicker"),dayHero:$("dayHero"),scheduleArea:$("scheduleArea"),rankingList:$("rankingList"),syncPill:$("syncPill"),syncText:$("syncText"),modal:$("rosterModal"),rosterColor:$("rosterColor"),rosterLevel:$("rosterLevel"),rosterTitle:$("rosterTitle"),rosterList:$("rosterList")};

function getLevel(day){if(day===2||day===6)return"S12";if(day===5||day===8)return"S345";return null}
function schoolInfo(iso){
  const d=parseDate(iso),start=parseDate(SCHOOL_START),end=parseDate(SCHOOL_END);
  if(d<start||d>end)return{isSchoolDay:false,reason:"Hors de l’année scolaire"};
  if(d.getDay()===0||d.getDay()===6)return{isSchoolDay:false,reason:"Fin de semaine"};
  if(specialCycle[iso]){const cycleDay=specialCycle[iso];return{isSchoolDay:true,cycleDay,level:getLevel(cycleDay)}}
  if(iso==="2027-06-23")return{isSchoolDay:false,reason:"Jour-cycle à confirmer"};
  if(fixedNoSchool.has(iso))return{isSchoolDay:false,reason:fixedNoSchool.get(iso)};
  if(floatingPed.has(iso))return{isSchoolDay:false,reason:floatingPed.get(iso)};
  let cycle=1,cursor=new Date(start);
  while(cursor<=d){
    const key=fmt(cursor),weekday=cursor.getDay()!==0&&cursor.getDay()!==6;
    if(weekday){
      if(fixedNoSchool.has(key)){}
      else if(floatingPed.has(key)){cycle=cycle%9+1}
      else{if(key===iso)return{isSchoolDay:true,cycleDay:cycle,level:getLevel(cycle)};cycle=cycle%9+1}
    }
    cursor.setDate(cursor.getDate()+1);
  }
  return{isSchoolDay:false,reason:"Date non reconnue"};
}

function authHeaders(){return{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}}
async function pullCloud(force=false){
  const url=`${REST_URL}?room_id=eq.${encodeURIComponent(ROOM_ID)}&select=record_key,payload,updated_at&order=record_key.asc`;
  const res=await fetch(url,{headers:authHeaders()});
  if(!res.ok)throw new Error(await res.text());
  const rows=await res.json(),nextHash=JSON.stringify(rows);
  if(force||nextHash!==cloudHash){cloudHash=nextHash;cloudFragments=Object.fromEntries(rows.map(r=>[r.record_key,r.payload||{}]));renderAll()}
  setSync(true,"En direct");
}
function setSync(live,text){els.syncPill.classList.toggle("live",live);els.syncText.textContent=text}

function combinedRecords(){
  const out={},bases=new Set();
  Object.keys(cloudFragments).forEach(k=>{const m=k.match(/^(.*)_(A|B|BONUS)$/);if(m)bases.add(m[1])});
  bases.forEach(base=>{
    const a=cloudFragments[`${base}_A`],b=cloudFragments[`${base}_B`],bonus=cloudFragments[`${base}_BONUS`],seed=a||b||bonus||{};
    const date=seed.date||base.slice(0,10),level=seed.level||base.slice(11),info=schoolInfo(date);
    const r={date,cycleDay:seed.cycleDay||info.cycleDay,level,gymSubmissions:{A:!!a?.submitted,B:!!b?.submitted},matches:Object.fromEntries(DAILY_MATCHES.map(m=>[`m${m.id}`,{...m,result:null}])),bonuses:Object.fromEntries(TEAM_ORDER.map(t=>[t,{attendance:false,shirts:false,spirit:false}]))};
    [a,b].forEach(f=>{Object.entries(f?.matches||{}).forEach(([k,v])=>r.matches[k]={...(r.matches[k]||{}),...v})});
    if(bonus?.bonuses)r.bonuses=bonus.bonuses;
    r.submitted=r.gymSubmissions.A&&r.gymSubmissions.B;
    out[base]=r;
  });
  return out;
}
function recordFor(date,level){return combinedRecords()[`${date}_${level}`]||null}
function normalizedMatches(r){return r?Object.values(r.matches||{}).sort((a,b)=>a.id-b.id):[]}
function daySubmitted(r){return !!(r?.gymSubmissions?.A&&r?.gymSubmissions?.B)}
function pointsFor(r){
  const s=Object.fromEntries(TEAM_ORDER.map(t=>[t,{matches:0,wins:0,draws:0,losses:0,matchPoints:0,bonusPoints:0,total:0}]));
  normalizedMatches(r).forEach(m=>{if(!m.result)return;s[m.a].matches++;s[m.b].matches++;if(m.result==="draw"){s[m.a].draws++;s[m.b].draws++;s[m.a].matchPoints++;s[m.b].matchPoints++}else if(m.result===m.a){s[m.a].wins++;s[m.b].losses++;s[m.a].matchPoints+=2}else if(m.result===m.b){s[m.b].wins++;s[m.a].losses++;s[m.b].matchPoints+=2}});
  TEAM_ORDER.forEach(t=>{const b=r?.bonuses?.[t]||{};s[t].bonusPoints=["attendance","shirts","spirit"].filter(k=>!!b[k]).length;s[t].total=s[t].matchPoints+s[t].bonusPoints});
  return s;
}
function canonicalLevel(level){return level==="S1"||level==="S2"?"S12":level}
function aggregate(filter){
  const a=Object.fromEntries(TEAM_ORDER.map(t=>[t,{matches:0,wins:0,draws:0,losses:0,matchPoints:0,bonusPoints:0,total:0}]));
  Object.values(combinedRecords()).forEach(r=>{if(!daySubmitted(r))return;if(filter!=="all"&&canonicalLevel(r.level)!==filter)return;const p=pointsFor(r);TEAM_ORDER.forEach(t=>Object.keys(a[t]).forEach(k=>a[t][k]+=p[t][k]))});
  return a;
}

function renderSchedule(){
  const info=schoolInfo(selectedDate),dateLabel=pretty(selectedDate);
  if(!info.isSchoolDay){els.dayHero.innerHTML=`<div class="badges"><span class="badge">—</span></div><h2>Aucune compétition</h2><p>${esc(dateLabel)} · ${esc(info.reason||"Aucun cours")}</p>`;els.scheduleArea.innerHTML=`<div class="empty">Il n’y a pas de compétition à cette date.</div>`;return}
  if(!info.level){els.dayHero.innerHTML=`<div class="badges"><span class="badge">Jour ${info.cycleDay}</span></div><h2>Aucune compétition aujourd’hui</h2><p>${esc(dateLabel)} · Secondaire 1-2 aux jours 2 et 6 · Secondaire 3-4-5 aux jours 5 et 8.</p>`;els.scheduleArea.innerHTML=`<div class="empty">Choisis une autre date pour voir l’horaire.</div>`;return}
  const r=recordFor(selectedDate,info.level),official=daySubmitted(r);
  els.dayHero.innerHTML=`<div class="badges"><span class="badge">Jour ${info.cycleDay}</span><span class="badge">${esc(LEVELS[info.level])}</span></div><h2>Horaire des matchs</h2><p>${esc(dateLabel)} · 11 h 30 à midi${official?" · Résultats officiels disponibles":""}</p>`;
  els.scheduleArea.innerHTML=`<div class="schedule-head"><div><p>HORAIRE</p><h3>6 matchs</h3></div><span>Touche ton équipe pour voir la liste</span></div><div class="match-list">${DAILY_MATCHES.map(m=>{
    const saved=r?.matches?.[`m${m.id}`],result=official?saved?.result:null;
    let resultText="Résultat à venir",resultClass="pending";
    if(result==="draw"){resultText="Match nul · 1 point chaque équipe";resultClass=""}
    else if(result&&TEAMS[result]){resultText=`Victoire ${TEAMS[result].label}`;resultClass=""}
    return `<article class="match-card"><div class="match-meta"><span>${m.time}</span><span>Gym ${m.gym}</span></div><div class="matchup"><button class="team-btn ${TEAMS[m.a].className}" data-roster-team="${m.a}" type="button">${TEAMS[m.a].label}</button><span class="vs">VS</span><button class="team-btn ${TEAMS[m.b].className}" data-roster-team="${m.b}" type="button">${TEAMS[m.b].label}</button></div><div class="match-result ${resultClass}">${resultText}</div></article>`
  }).join("")}</div>`;
  els.scheduleArea.querySelectorAll("[data-roster-team]").forEach(b=>b.addEventListener("click",()=>openRoster(info.level,b.dataset.rosterTeam)));
}

function renderRanking(){
  const a=aggregate(rankingFilter),ranked=TEAM_ORDER.map((team,i)=>({team,i,...a[team]})).sort((x,y)=>y.total-x.total||y.matchPoints-x.matchPoints||y.wins-x.wins||x.i-y.i);
  els.rankingList.innerHTML=ranked.map((r,i)=>`<article class="rank-card"><div class="rank-pos">${i+1}</div><div class="rank-main"><div class="rank-name"><span class="dot ${TEAMS[r.team].className}"></span>${TEAMS[r.team].label}</div><div class="rank-stats">${r.matches} matchs · ${r.wins} V · ${r.draws} N · ${r.losses} D<br>${r.matchPoints} pts matchs + ${r.bonusPoints} bonus</div></div><div class="rank-total"><strong>${r.total}</strong><span>points</span></div></article>`).join("");
}
function renderAll(){renderSchedule();renderRanking()}

function openRoster(level,team){
  const names=ROSTERS[level]?.[team]||[];
  els.rosterColor.className=`modal-color ${TEAMS[team].className}`;
  els.rosterLevel.textContent=LEVELS[level]||level;
  els.rosterTitle.textContent=`Équipe ${TEAMS[team].label}`;
  els.rosterList.innerHTML=names.map((name,i)=>`<div class="roster-row"><span class="roster-num">${i+1}</span><span>${esc(name)}</span></div>`).join("")||`<div class="empty">Liste à venir.</div>`;
  els.modal.classList.remove("hidden");
}
function closeRoster(){els.modal.classList.add("hidden")}
function showView(view){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));if(view==="ranking")renderRanking();window.scrollTo({top:0,behavior:"smooth"})}
function setDate(iso){if(!iso)return;selectedDate=iso;els.datePicker.value=iso;renderSchedule()}
function shiftDate(n){const d=parseDate(selectedDate);d.setDate(d.getDate()+n);setDate(fmt(d))}
function parseDate(iso){const[y,m,d]=iso.split("-").map(Number);return new Date(y,m-1,d,12)}
function fmt(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function pretty(iso){return new Intl.DateTimeFormat("fr-CA",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(parseDate(iso))}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}

function bind(){
  $("prevDay").addEventListener("click",()=>shiftDate(-1));$("nextDay").addEventListener("click",()=>shiftDate(1));els.datePicker.addEventListener("change",()=>setDate(els.datePicker.value));
  document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{rankingFilter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderRanking()}));
  $("closeRoster").addEventListener("click",closeRoster);els.modal.addEventListener("click",e=>{if(e.target===els.modal)closeRoster()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeRoster()});
}

async function init(){
  els.datePicker.value=selectedDate;bind();renderAll();
  try{await pullCloud(true);setInterval(()=>{if(document.visibilityState==="visible")pullCloud(false).catch(()=>setSync(false,"Hors ligne"))},5000)}catch(e){console.error(e);setSync(false,"Hors ligne")}
}
init();
