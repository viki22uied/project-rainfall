/* Project-Rainfall console — vanilla, no build step.
   Backend ML (AppSail) is offline, so this runs on a curated sample drawn from the
   real datasets; every panel is shaped to swap in the live Node/AppSail endpoints. */
"use strict";

/* ============================ sample data (from the real CSVs) ============================ */
const DATA = {
  stats: [
    { k: "cases", v: 135, d: "across 18 stations" },
    { k: "unsolved", v: 58, d: "43% open", cls: "alert" },
    { k: "serial patterns", v: 3, d: "cross-jurisdiction", cls: "alert" },
    { k: "resolved identities", v: 21, d: "confidence ≥ 95", cls: "ok" },
  ],
  // person records with recorded-name variants (persons_synthetic.csv)
  persons: {
    "P-1001": { name: "PrakashKumar", father: "Suresh Kumar", age: 33, district: "Ballari", role: "accused", src: "Charge sheet OCR scan" },
    "P-1002": { name: "GirishShetty", father: "Nagaraj Shetty", age: 55, district: "Tumakuru", role: "victim", src: "e-Prisons intake" },
    "P-1003": { name: "Girish Shetty", father: "Deepa Shetty", age: 44, district: "Tumakuru", role: "witness", src: "e-Prisons intake" },
  },
  // candidate matches (ER output) — pending human confirmation
  matches: [
    { id: "M1", a: { name: "Girish Shetty", sub: "P-1003 · witness · Tumakuru", src: "e-Prisons intake" },
      b: { name: "GirishShetty", sub: "P-1002 · victim · Tumakuru", src: "e-Prisons intake" },
      conf: 96, why: ["Whole-name phonetic key identical (JRXXT)", "Jaro-Winkler 0.98 on normalized name", "Same district (Tumakuru)"] },
    { id: "M2", a: { name: "MANJUNATH IYER", sub: "P-1010 · victim · Ballari", src: "Station diary" },
      b: { name: "Manjunath I.", sub: "P-1041 · accused · Hubballi Dharwad", src: "Charge sheet OCR scan" },
      conf: 92, why: ["Shared token 'manjunath' (phonetic)", "Initial 'I.' expands to 'Iyer'", "Token-alignment score 0.94"] },
    { id: "M3", a: { name: "VENKATESH REDDY", sub: "P-1006 · witness · Mysuru City", src: "CCTNS FIR entry" },
      b: { name: "V. Reddy", sub: "P-1029 · witness · Mangaluru City", src: "OCR scan" },
      conf: 90, why: ["Shared surname token 'reddy'", "Initial 'V.' expands to 'Venkatesh'", "Token-alignment score 0.90"] },
    { id: "M4", a: { name: "RADHA IYER", sub: "P-1055 · accused · Ballari", src: "Charge sheet OCR scan" },
      b: { name: "R. Iyer", sub: "P-1071 · victim · Mysuru City", src: "CCTNS FIR entry" },
      conf: 74, why: ["Shared surname token 'iyer'", "Initial 'R.' is ambiguous (Radha / Ramesh)", "Below auto-confirm — needs review"] },
  ],
  // serial clusters (MO output) — behavioral signatures + geographic spread
  clusters: [
    { id: "SERIAL-1", crime: "Chain Snatching", cases: ["C-5001", "C-5002", "C-5003", "C-5004", "C-5005", "C-5006"],
      districts: ["Ballari", "Belagavi City", "Mangaluru City", "Bengaluru City", "Mysuru City", "Tumakuru"],
      sig: { "Entry": "No forced entry — distraction", "Weapon": "None — snatch and run", "Target": "Pedestrian — gold chain", "Time": "Evening (6–9PM)" }, score: 100 },
    { id: "SERIAL-2", crime: "House Break-in", cases: ["C-5007", "C-5008", "C-5009", "C-5010", "C-5011"],
      districts: ["Bengaluru City", "Tumakuru", "Hubballi Dharwad"],
      sig: { "Entry": "Rear window — glass cut", "Weapon": "Screwdriver", "Target": "Locked residence, daytime", "Time": "Afternoon (12–3PM)" }, score: 100 },
    { id: "SERIAL-3", crime: "Vehicle Theft", cases: ["C-5012", "C-5013", "C-5014", "C-5015"],
      districts: ["Belagavi City", "Bengaluru City", "Ballari", "Mysuru City"],
      sig: { "Entry": "Ignition bypass", "Weapon": "None", "Target": "Two-wheeler, parked", "Time": "Night (9PM–12AM)" }, score: 96 },
  ],
  // for the query console
  cases: {
    "C-5001": { fir: "FIR/2025/381", crime: "Chain Snatching", station: "Gandhinagar PS", district: "Ballari",
      date: "2025-05-03", status: "Unsolved", serial: "SERIAL-1",
      people: [ { role: "accused", pid: "P-1001", name: "PrakashKumar" }, { role: "victim", pid: "P-1002", name: "GirishShetty" } ] },
  },
  districtsTop: [
    { d: "Bengaluru City", ipc: 28666, sll: 17521, total: 46187 },
    { d: "Bengaluru District", ipc: 6031, sll: 961, total: 6992 },
    { d: "Tumakuru", ipc: 3894, sll: 1102, total: 4996 },
    { d: "Bagalkot", ipc: 2199, sll: 735, total: 2934 },
  ],
};

/* ============================ i18n ============================ */
const I18N = {
  en: {
    brand_sub: "KSP Crime Intelligence", classif: "Restricted · Official Use", voice: "Speak",
    nav_head: "Workspace", nav_console: "Query Console", nav_er: "Entity Resolution",
    nav_mo: "Serial Patterns", nav_evidence: "Evidence Chain", signed_in: "Signed in", send: "Send",
    ask_ph: "Ask about a case, person, hotspot, or pattern…",
    er_h: "Entity Resolution", er_p: "Candidate matches across inconsistent records — scored, never auto-merged. An analyst or supervisor confirms before two records become one identity.",
    er_pending: "Candidate matches — pending review",
    mo_h: "Serial-Pattern Analysis", mo_p: "Unsolved cases linked by modus operandi — no named suspect required. Cross-jurisdiction spread is the signal, not a coincidence.",
    ev_h: "Court-Admissible Evidence Chain", ev_p: "Every AI finding is hash-stamped at the moment it is generated and issued as a Bharatiya Sakshya Adhiniyam 2023, Section 63 electronic-evidence certificate — the standard Indian courts now require.",
    seal_btn: "Seal finding", seal_hint: "Press to hash-stamp the selected finding.",
  },
  kn: {
    brand_sub: "ಕೆಎಸ್‌ಪಿ ಅಪರಾಧ ಗುಪ್ತಚರ", classif: "ನಿರ್ಬಂಧಿತ · ಅಧಿಕೃತ ಬಳಕೆ", voice: "ಮಾತನಾಡಿ",
    nav_head: "ಕಾರ್ಯಕ್ಷೇತ್ರ", nav_console: "ಪ್ರಶ್ನೆ ಫಲಕ", nav_er: "ವ್ಯಕ್ತಿ ಗುರುತಿಸುವಿಕೆ",
    nav_mo: "ಸರಣಿ ಮಾದರಿಗಳು", nav_evidence: "ಸಾಕ್ಷ್ಯ ಸರಪಳಿ", signed_in: "ಪ್ರವೇಶಿಸಿದವರು", send: "ಕಳುಹಿಸಿ",
    ask_ph: "ಪ್ರಕರಣ, ವ್ಯಕ್ತಿ, ಹಾಟ್‌ಸ್ಪಾಟ್ ಅಥವಾ ಮಾದರಿ ಬಗ್ಗೆ ಕೇಳಿ…",
    er_h: "ವ್ಯಕ್ತಿ ಗುರುತಿಸುವಿಕೆ", er_p: "ಅಸಮಂಜಸ ದಾಖಲೆಗಳಾದ್ಯಂತ ಸಂಭಾವ್ಯ ಹೊಂದಾಣಿಕೆಗಳು — ಅಂಕ ನೀಡಲಾಗಿದೆ, ಸ್ವಯಂ-ವಿಲೀನಗೊಳಿಸಿಲ್ಲ. ವಿಶ್ಲೇಷಕ ಅಥವಾ ಮೇಲ್ವಿಚಾರಕ ದೃಢೀಕರಿಸುತ್ತಾರೆ.",
    er_pending: "ಸಂಭಾವ್ಯ ಹೊಂದಾಣಿಕೆಗಳು — ಪರಿಶೀಲನೆ ಬಾಕಿ",
    mo_h: "ಸರಣಿ ಮಾದರಿ ವಿಶ್ಲೇಷಣೆ", mo_p: "ಕಾರ್ಯವಿಧಾನದಿಂದ ಸಂಪರ್ಕಿಸಲಾದ ಬಗೆಹರಿಯದ ಪ್ರಕರಣಗಳು — ಶಂಕಿತನ ಹೆಸರು ಅಗತ್ಯವಿಲ್ಲ. ಗಡಿ-ದಾಟುವ ಹರಡುವಿಕೆಯೇ ಸೂಚನೆ.",
    ev_h: "ನ್ಯಾಯಾಲಯ-ಸ್ವೀಕಾರಾರ್ಹ ಸಾಕ್ಷ್ಯ ಸರಪಳಿ", ev_p: "ಪ್ರತಿ ಎಐ ಸಂಶೋಧನೆಯನ್ನು ಉತ್ಪಾದನೆಯ ಕ್ಷಣದಲ್ಲೇ ಹ್ಯಾಶ್-ಮುದ್ರೆ ಹಾಕಲಾಗುತ್ತದೆ ಮತ್ತು ಭಾರತೀಯ ಸಾಕ್ಷ್ಯ ಅಧಿನಿಯಮ 2023, ಸೆಕ್ಷನ್ 63 ಪ್ರಮಾಣಪತ್ರ ನೀಡಲಾಗುತ್ತದೆ.",
    seal_btn: "ಸಂಶೋಧನೆ ಮುದ್ರಿಸಿ", seal_hint: "ಆಯ್ದ ಸಂಶೋಧನೆಗೆ ಹ್ಯಾಶ್-ಮುದ್ರೆ ಹಾಕಲು ಒತ್ತಿರಿ.",
  },
};

/* ============================ roles ============================ */
const ROLES = {
  investigator: { name: "I. Nayak", scope: "Sub-Inspector · Gandhinagar PS", scopeKn: "ಉಪ-ನಿರೀಕ್ಷಕ · ಗಾಂಧಿನಗರ ಠಾಣೆ", station: "Gandhinagar PS", mask: false, aggregatesOnly: false },
  analyst:      { name: "A. Kulkarni", scope: "Crime Analyst · State", scopeKn: "ಅಪರಾಧ ವಿಶ್ಲೇಷಕ · ರಾಜ್ಯ", mask: true, aggregatesOnly: false },
  supervisor:   { name: "S. Gowda", scope: "Deputy SP · Ballari District", scopeKn: "ಉಪ ಪೊಲೀಸ್ ವರಿಷ್ಠಾಧಿಕಾರಿ · ಬಳ್ಳಾರಿ ಜಿಲ್ಲೆ", district: "Ballari", mask: false, aggregatesOnly: false },
  policymaker:  { name: "P. Rao", scope: "Secretariat · State aggregates", scopeKn: "ಸಚಿವಾಲಯ · ರಾಜ್ಯ ಒಟ್ಟುಗಳು", mask: true, aggregatesOnly: true },
};

/* ============================ state + helpers ============================ */
const state = { lang: "en", role: "investigator", lastEntity: null };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const t = (k) => (I18N[state.lang][k] || I18N.en[k] || k);
const L = (en, kn) => (state.lang === "kn" ? kn : en); // inline bilingual string
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

async function sha256(str) {
  if (!(crypto && crypto.subtle)) return "sha256-unavailable-in-this-context";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ============================ i18n apply ============================ */
function applyLang() {
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.documentElement.lang = state.lang;
  renderSuggest();
}

/* ============================ stats ============================ */
function renderStats() {
  $("#stats").innerHTML = DATA.stats.map((s) => `
    <div class="tile ${s.cls || ""}">
      <div class="k">${esc(s.k)}</div>
      <div class="v num">${s.v}</div>
      <div class="d">${esc(s.d)}</div>
    </div>`).join("");
}

/* ============================ query console ============================ */
const SUGGEST = {
  en: ["Who is the accused in C-5001?", "Show chain-snatching hotspots", "Any serial pattern this month?", "Risk profile of PrakashKumar"],
  kn: ["C-5001 ರಲ್ಲಿ ಆರೋಪಿ ಯಾರು?", "ಚೈನ್ ಸ್ನ್ಯಾಚಿಂಗ್ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು", "ಈ ತಿಂಗಳು ಸರಣಿ ಮಾದರಿ ಇದೆಯೇ?", "ಪ್ರಕಾಶ್ ಕುಮಾರ್ ಅಪಾಯ ಪ್ರೊಫೈಲ್"],
};
function renderSuggest() {
  $("#suggest").innerHTML = SUGGEST[state.lang].map((q) => `<button class="btn ghost">${esc(q)}</button>`).join("");
  $$("#suggest button").forEach((b) => b.addEventListener("click", () => { $("#q").value = b.textContent; ask(); }));
}

function addTurn(who, html) {
  const div = document.createElement("div");
  div.className = "turn " + who;
  const initial = who === "user" ? ROLES[state.role].name[0] : "R";
  const label = who === "user" ? ROLES[state.role].name : "Project-Rainfall";
  div.innerHTML = `<div class="who-i">${initial}</div><div class="body"><div class="meta">${esc(label)}</div>${html}</div>`;
  $("#transcript").appendChild(div);
  $("#transcript").scrollTop = $("#transcript").scrollHeight;
  return div;
}

function maskName(name) { return ROLES[state.role].mask ? '<span class="masked">[PII masked — request elevation]</span>' : esc(name); }

function trail(items, hash) {
  return `<div class="trail"><div class="eyebrow">${L("Evidence trail", "ಸಾಕ್ಷ್ಯ ಜಾಡು")}</div><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    <div class="hash"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/></svg>
    <span class="mono">${esc(hash)}</span> · ${L("sealed for §63", "§63 ಗಾಗಿ ಮುದ್ರಿತ")}</div></div>`;
}

// intent router → returns {text, html?, speak}
function route(qRaw) {
  const q = qRaw.toLowerCase();
  const R = ROLES[state.role];

  // policymaker: individual-record queries are denied
  const wantsIndividual = /accused|victim|person|c-\d|risk|profile|witness|ಆರೋಪಿ|ವ್ಯಕ್ತಿ|ಅಪಾಯ|ಪ್ರೊಫೈಲ್/.test(q);
  if (R.aggregatesOnly && wantsIndividual) {
    return { html: `<div class="bubble"><div class="denied">${L(
        "Access denied — the Policymaker role sees state-wide aggregates only. No individual PII, ever. This query was logged (decision: <b>denied</b>, seq #4127).",
        "ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ — ನೀತಿನಿರೂಪಕ ಪಾತ್ರವು ರಾಜ್ಯ ಮಟ್ಟದ ಒಟ್ಟುಗಳನ್ನಷ್ಟೇ ನೋಡುತ್ತದೆ. ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ ಎಂದಿಗೂ ಇಲ್ಲ. ಈ ಪ್ರಶ್ನೆಯನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ (ನಿರ್ಧಾರ: <b>ನಿರಾಕರಿಸಲಾಗಿದೆ</b>, ಕ್ರಮ #4127).")}</div></div>`,
      speak: L("Access denied. The policymaker role sees state aggregates only.", "ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ. ನೀತಿನಿರೂಪಕ ಪಾತ್ರವು ರಾಜ್ಯ ಒಟ್ಟುಗಳನ್ನಷ್ಟೇ ನೋಡುತ್ತದೆ.") };
  }

  // accused in a case
  if (/accused|c-5001|who .*case|ಆರೋಪಿ|ಪ್ರಕರಣ/.test(q)) {
    state.lastEntity = "C-5001";
    const c = DATA.cases["C-5001"];
    const roleLbl = { accused: L("accused", "ಆರೋಪಿ"), victim: L("victim", "ಸಂತ್ರಸ್ತ"), witness: L("witness", "ಸಾಕ್ಷಿ") };
    const rows = c.people.map((p) => `<tr><td>${esc(roleLbl[p.role] || p.role)}</td><td>${maskName(p.name)}</td><td class="mono">${esc(p.pid)}</td></tr>`).join("");
    const hash = "e3b0c442…"; // placeholder short hash for the answer
    return {
      html: `<div class="bubble">
        <p><b>${esc(c.fir)}</b> — ${esc(c.crime)} ${L("at", "—")} ${esc(c.station)}, ${esc(c.district)} (${esc(c.date)}). ${L("Status", "ಸ್ಥಿತಿ")}: <span class="chip rust"><span class="dot"></span>${esc(c.status)}</span></p>
        <div class="record"><div class="rhead"><b>${L("Parties to the case", "ಪ್ರಕರಣದ ಪಕ್ಷಗಳು")}</b><span class="chip amber">${L("role-filtered", "ಪಾತ್ರ-ಶೋಧಿತ")} · ${esc(state.role)}</span></div>
          <table><thead><tr><th>${L("Role", "ಪಾತ್ರ")}</th><th>${L("Name", "ಹೆಸರು")}</th><th>${L("Person ID", "ವ್ಯಕ್ತಿ ID")}</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${R.mask ? `<p class="hint" style="margin-top:8px">${L("Names withheld under analyst PII policy — a supervisor can grant elevation.", "ವಿಶ್ಲೇಷಕ ಮಾಹಿತಿ ನೀತಿಯಡಿ ಹೆಸರುಗಳನ್ನು ತಡೆಹಿಡಿಯಲಾಗಿದೆ — ಮೇಲ್ವಿಚಾರಕ ಅನುಮತಿ ನೀಡಬಹುದು.")}</p>` : ""}
        <p class="hint" style="margin-top:8px">${L("Linked to", "ಸಂಪರ್ಕಿತ")} <b>SERIAL-1</b> — ${L("see Serial Patterns.", "ಸರಣಿ ಮಾದರಿಗಳನ್ನು ನೋಡಿ.")}</p>
        ${trail([
          L("Query gated by role BEFORE retrieval (" + state.role + ")", "ಪಡೆಯುವ ಮೊದಲೇ ಪಾತ್ರದಿಂದ ಶೋಧಿಸಲಾಗಿದೆ (" + state.role + ")"),
          L("Source: CCTNS FIR entry + charge sheet", "ಮೂಲ: CCTNS ಎಫ್‌ಐಆರ್ ನಮೂದು + ದೋಷಾರೋಪ ಪಟ್ಟಿ"),
          L("Row-level access checked against station scope", "ಠಾಣೆ ವ್ಯಾಪ್ತಿಗೆ ವಿರುದ್ಧ ಸಾಲು-ಮಟ್ಟದ ಪ್ರವೇಶ ಪರಿಶೀಲಿಸಲಾಗಿದೆ")], hash)}
      </div>`,
      speak: `${c.fir}. ${c.crime} ${L("at", "—")} ${c.station}. ${L("Status", "ಸ್ಥಿತಿ")} ${c.status}.`,
    };
  }

  // hotspots / trend
  if (/hotspot|snatch|trend|where|ಹಾಟ್|ಸ್ನ್ಯಾಚ|ಎಲ್ಲಿ/.test(q)) {
    const rows = DATA.districtsTop.map((d) => `<tr><td>${esc(d.d)}</td><td class="num">${d.ipc.toLocaleString()}</td><td class="num">${d.sll.toLocaleString()}</td><td class="num">${d.total.toLocaleString()}</td></tr>`).join("");
    return {
      html: `<div class="bubble"><p>${L("Chain-snatching is concentrated in urban corridors; district IPC/SLL intensity (2022 snapshot):", "ಚೈನ್ ಸ್ನ್ಯಾಚಿಂಗ್ ನಗರ ಕಾರಿಡಾರ್‌ಗಳಲ್ಲಿ ಕೇಂದ್ರೀಕೃತವಾಗಿದೆ; ಜಿಲ್ಲಾ IPC/SLL ತೀವ್ರತೆ (2022 ಸ್ನ್ಯಾಪ್‌ಶಾಟ್):")}</p>
        <div class="record"><div class="rhead"><b>${L("District crime intensity", "ಜಿಲ್ಲಾ ಅಪರಾಧ ತೀವ್ರತೆ")}</b><span class="chip">${L("source-year 2022 · snapshot", "ಮೂಲ-ವರ್ಷ 2022 · ಸ್ನ್ಯಾಪ್‌ಶಾಟ್")}</span></div>
          <table><thead><tr><th>${L("District", "ಜಿಲ್ಲೆ")}</th><th>IPC</th><th>SLL</th><th>${L("Total", "ಒಟ್ಟು")}</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="hint" style="margin-top:8px">${L("Forecast: Burglary rising fastest (slope +0.35/mo) — early warning flagged.", "ಮುನ್ಸೂಚನೆ: ಕಳ್ಳತನ ಅತಿ ವೇಗವಾಗಿ ಏರುತ್ತಿದೆ (ಇಳಿಜಾರು +0.35/ತಿಂಗಳು) — ಮುನ್ನೆಚ್ಚರಿಕೆ ಗುರುತಿಸಲಾಗಿದೆ.")}</p>
        ${trail([
          L("Aggregate query — no individual PII touched", "ಒಟ್ಟು ಪ್ರಶ್ನೆ — ಯಾವುದೇ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ ಸ್ಪರ್ಶಿಸಿಲ್ಲ"),
          L("Real KSP 2022 IPC/SLL totals", "ನೈಜ KSP 2022 IPC/SLL ಒಟ್ಟುಗಳು"),
          L("Trend = least-squares slope over monthly counts", "ಪ್ರವೃತ್ತಿ = ಮಾಸಿಕ ಎಣಿಕೆಗಳ ಮೇಲೆ ಕನಿಷ್ಠ-ವರ್ಗ ಇಳಿಜಾರು")], "9f2 a1c…")}</div>`,
      speak: L("Chain snatching is concentrated in urban corridors. Bengaluru City has the highest crime intensity.", "ಚೈನ್ ಸ್ನ್ಯಾಚಿಂಗ್ ನಗರ ಕಾರಿಡಾರ್‌ಗಳಲ್ಲಿ ಕೇಂದ್ರೀಕೃತವಾಗಿದೆ. ಬೆಂಗಳೂರು ನಗರದಲ್ಲಿ ಅತಿ ಹೆಚ್ಚು ಅಪರಾಧ ತೀವ್ರತೆ ಇದೆ."),
    };
  }

  // serial pattern
  if (/serial|pattern|linked|repeat|ಸರಣಿ|ಮಾದರಿ/.test(q)) {
    const c = DATA.clusters[0];
    return {
      html: `<div class="bubble"><p>${L("Yes —", "ಹೌದು —")} <b>${esc(c.id)}</b>: ${c.cases.length} ${L("unsolved " + c.crime + " cases share one behavioral signature across " + c.districts.length + " districts.", "ಬಗೆಹರಿಯದ " + c.crime + " ಪ್ರಕರಣಗಳು " + c.districts.length + " ಜಿಲ್ಲೆಗಳಾದ್ಯಂತ ಒಂದೇ ವರ್ತನಾ ಸಹಿ ಹಂಚಿಕೊಳ್ಳುತ್ತವೆ.")}</p>
        <div class="record"><div class="rhead"><b>${esc(c.id)} ${L("signature", "ಸಹಿ")}</b><span class="chip rust"><span class="dot"></span>${L("cross-jurisdiction", "ಗಡಿ-ದಾಟುವ")}</span></div>
          <table><tbody>${Object.entries(c.sig).map(([k, v]) => `<tr><th style="width:120px">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div>
        <p class="hint" style="margin-top:8px">${L("Cases", "ಪ್ರಕರಣಗಳು")}: ${c.cases.map(esc).join(", ")}. ${L("Cluster cohesion", "ಕ್ಲಸ್ಟರ್ ಒಗ್ಗಟ್ಟು")} ${c.score}%.</p>
        ${trail([
          L("Linked by MO signature — no named suspect used", "MO ಸಹಿಯಿಂದ ಸಂಪರ್ಕಿತ — ಹೆಸರಿಸಿದ ಶಂಕಿತ ಬಳಸಿಲ್ಲ"),
          L("Union-find over cases with ≥ threshold MO match", "ಮಿತಿ ≥ MO ಹೊಂದಾಣಿಕೆ ಇರುವ ಪ್ರಕರಣಗಳ ಮೇಲೆ ಯೂನಿಯನ್-ಫೈಂಡ್"),
          L("Geographic spread across " + c.districts.length + " districts", c.districts.length + " ಜಿಲ್ಲೆಗಳಾದ್ಯಂತ ಭೌಗೋಳಿಕ ಹರಡುವಿಕೆ")], "7ac 44b…")}</div>`,
      speak: L("Yes. " + c.id + ". " + c.cases.length + " chain snatching cases across " + c.districts.length + " districts share one signature.", "ಹೌದು. " + c.id + ". " + c.cases.length + " ಚೈನ್ ಸ್ನ್ಯಾಚಿಂಗ್ ಪ್ರಕರಣಗಳು " + c.districts.length + " ಜಿಲ್ಲೆಗಳಾದ್ಯಂತ ಒಂದೇ ಸಹಿ ಹಂಚಿಕೊಳ್ಳುತ್ತವೆ."),
    };
  }

  // risk
  if (/risk|profile|dangerous|ಅಪಾಯ|ಪ್ರೊಫೈಲ್/.test(q)) {
    const name = R.mask ? L("[PII masked]", "[ಮಾಹಿತಿ ಮರೆಮಾಡಲಾಗಿದೆ]") : "PrakashKumar";
    return {
      html: `<div class="bubble"><p>${L("Risk profile", "ಅಪಾಯ ಪ್ರೊಫೈಲ್")} — ${maskName("PrakashKumar")} (P-1001):</p>
        <div class="record"><table><tbody>
          <tr><th style="width:180px">${L("Overall risk", "ಒಟ್ಟಾರೆ ಅಪಾಯ")}</th><td><span class="chip rust"><span class="dot"></span>89 / 100</span></td></tr>
          <tr><th>${L("Repeat offending", "ಪುನರಾವರ್ತಿತ ಅಪರಾಧ")}</th><td>32 — ${L("4 linked cases", "4 ಸಂಪರ್ಕಿತ ಪ್ರಕರಣಗಳು")}</td></tr>
          <tr><th>${L("Crime severity", "ಅಪರಾಧ ತೀವ್ರತೆ")}</th><td>32 — ${L("max Robbery (9/10)", "ಗರಿಷ್ಠ ದರೋಡೆ (9/10)")}</td></tr>
          <tr><th>${L("Geographic spread", "ಭೌಗೋಳಿಕ ಹರಡುವಿಕೆ")}</th><td>25 — ${L("operating across 4 districts", "4 ಜಿಲ್ಲೆಗಳಾದ್ಯಂತ ಕಾರ್ಯನಿರ್ವಹಣೆ")}</td></tr>
        </tbody></table></div>
        ${trail([
          L("Every factor is transparent and contributes a shown weight", "ಪ್ರತಿ ಅಂಶವೂ ಪಾರದರ್ಶಕ ಮತ್ತು ತೋರಿಸಿದ ತೂಕ ನೀಡುತ್ತದೆ"),
          L("Score = weighted behavioral factors, no opaque model", "ಅಂಕ = ತೂಕದ ವರ್ತನಾ ಅಂಶಗಳು, ಯಾವುದೇ ಅಪಾರದರ್ಶಕ ಮಾದರಿ ಇಲ್ಲ"),
          L("Cited cases available on request", "ಉಲ್ಲೇಖಿತ ಪ್ರಕರಣಗಳು ವಿನಂತಿಯ ಮೇರೆಗೆ ಲಭ್ಯ")], "1d0 e7f…")}</div>`,
      speak: L("Risk profile. " + name + ". Overall risk 89 out of 100. High.", "ಅಪಾಯ ಪ್ರೊಫೈಲ್. " + name + ". ಒಟ್ಟಾರೆ ಅಪಾಯ 100 ರಲ್ಲಿ 89. ಹೆಚ್ಚು."),
    };
  }

  // fallback
  return {
    html: `<div class="bubble"><p>${L("I can retrieve FIR/case details, resolve identities across records, surface serial patterns, map hotspots, and score offender risk — every answer role-filtered and hash-stamped for evidence.", "ನಾನು ಎಫ್‌ಐಆರ್/ಪ್ರಕರಣ ವಿವರ ಪಡೆಯಬಲ್ಲೆ, ದಾಖಲೆಗಳಾದ್ಯಂತ ಗುರುತು ಗುರುತಿಸಬಲ್ಲೆ, ಸರಣಿ ಮಾದರಿ ತೋರಿಸಬಲ್ಲೆ, ಹಾಟ್‌ಸ್ಪಾಟ್ ನಕ್ಷೆ ಮಾಡಬಲ್ಲೆ, ಅಪರಾಧಿ ಅಪಾಯ ಅಂಕ ನೀಡಬಲ್ಲೆ — ಪ್ರತಿ ಉತ್ತರವೂ ಪಾತ್ರ-ಶೋಧಿತ ಮತ್ತು ಸಾಕ್ಷ್ಯಕ್ಕಾಗಿ ಹ್ಯಾಶ್-ಮುದ್ರಿತ.")}</p>
      <p class="hint">${L("Try one of the suggested queries above.", "ಮೇಲಿನ ಸೂಚಿತ ಪ್ರಶ್ನೆಗಳಲ್ಲಿ ಒಂದನ್ನು ಪ್ರಯತ್ನಿಸಿ.")}</p></div>`,
    speak: L("I can retrieve case details, resolve identities, surface serial patterns, and score risk.", "ನಾನು ಪ್ರಕರಣ ವಿವರ ಪಡೆಯಬಲ್ಲೆ, ಗುರುತು ಗುರುತಿಸಬಲ್ಲೆ, ಸರಣಿ ಮಾದರಿ ತೋರಿಸಬಲ್ಲೆ, ಅಪಾಯ ಅಂಕ ನೀಡಬಲ್ಲೆ."),
  };
}

function ask() {
  const q = $("#q").value.trim();
  if (!q) return;
  addTurn("user", `<div class="bubble">${esc(q)}</div>`);
  $("#q").value = ""; $("#q").style.height = "auto";
  const res = route(q);
  setTimeout(() => {
    addTurn("system", res.html);
    if (state._speak) speak(res.speak);
  }, 260);
}

/* ============================ entity resolution ============================ */
function renderMatches() {
  const wrap = $("#matches");
  wrap.innerHTML = DATA.matches.map((m) => `
    <div class="match" data-id="${m.id}">
      <div>
        <div class="pair">
          <div class="rec"><div class="nm">${esc(m.a.name)}</div><div class="sub">${esc(m.a.sub)}</div><div class="src">${esc(m.a.src)}</div></div>
          <div class="vs">≟</div>
          <div class="rec"><div class="nm">${esc(m.b.name)}</div><div class="sub">${esc(m.b.sub)}</div><div class="src">${esc(m.b.src)}</div></div>
        </div>
        <div class="trail" style="margin-top:12px"><div class="eyebrow">Why matched</div><ul>${m.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
      </div>
      <div class="conf">
        <div class="chip ${m.conf >= 90 ? "amber" : "rust"}">confidence ${m.conf}</div>
        <div class="gauge"><i style="width:${m.conf}%"></i></div>
        <div class="acts">
          <button class="btn forest" data-act="confirm">Confirm</button>
          <button class="btn danger" data-act="reject">Reject</button>
        </div>
      </div>
    </div>`).join("");
  $$("#matches .match").forEach((row) => {
    row.querySelectorAll("[data-act]").forEach((btn) => btn.addEventListener("click", () => {
      const confirmed = btn.dataset.act === "confirm";
      row.classList.add("resolved");
      const badge = document.createElement("div");
      badge.className = "chip " + (confirmed ? "forest" : "");
      badge.innerHTML = confirmed
        ? '<span class="dot"></span>confirmed & sealed for §63'
        : "rejected — kept separate";
      row.querySelector(".conf").appendChild(badge);
      const n = DATA.matches.length - $$("#matches .resolved").length;
      $("#erBadge").textContent = n; $("#erCount").textContent = n + " pending";
      toast(confirmed ? "Match confirmed — identities merged, action logged" : "Match rejected — records kept separate, action logged");
    }));
  });
  $("#erCount").textContent = DATA.matches.length + " pending";
}

/* ============================ serial patterns ============================ */
function renderPatterns() {
  $("#patterns").innerHTML = DATA.clusters.map((c) => `
    <div class="pattern">
      <div class="ph"><h3>${esc(c.id)}</h3><span class="chip rust"><span class="dot"></span>${c.cases.length} cases</span></div>
      <dl class="sig">${Object.entries(c.sig).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <div class="map" data-districts="${c.districts.length}"></div>
      <div class="footer"><span class="chip amber">cohesion ${c.score}%</span> ${esc(c.crime)} · ${c.districts.length} districts</div>
    </div>`).join("");
  // scatter slow-pulsing hotspots on each mini-map
  $$("#patterns .map").forEach((map) => {
    const n = +map.dataset.districts;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "ping";
      p.style.left = (12 + Math.random() * 76) + "%";
      p.style.top = (16 + Math.random() * 64) + "%";
      p.style.animationDelay = (Math.random() * 2).toFixed(2) + "s";
      map.appendChild(p);
    }
  });
}

/* ============================ evidence chain ============================ */
const FINDING = {
  artifact_type: "cluster", id: "SERIAL-1",
  inputs: { cases: ["C-5001", "C-5002", "C-5003", "C-5004", "C-5005", "C-5006"], features: ["entry_method", "weapon", "target_type", "time_band"] },
  output: { serial: "SERIAL-1", size: 6, districts: 6, cohesion: 100 },
};
let sealedHash = null;

function renderCert(hash, sealed) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  $("#cert").className = "cert" + (sealed ? "" : " locked");
  $("#cert").innerHTML = `
    <div class="ct"><div class="eyebrow">Bharatiya Sakshya Adhiniyam, 2023</div><h3>Certificate under Section 63</h3></div>
    <div class="cbody">
      <div class="row"><span class="lab">Electronic record</span><div>Serial-pattern finding <b>SERIAL-1</b> — 6 linked cases across 6 districts (cohesion 100%).</div></div>
      <div class="row"><span class="lab">Output hash (SHA-256)</span><div class="mono" style="word-break:break-all">${esc(hash || "— pending seal —")}</div></div>
      <div class="row"><span class="lab">Manner of production</span><div>Produced by the Project-Rainfall automated system from the stated inputs in the ordinary course of operation; integrity secured by SHA-256 at time of generation.</div></div>
      <div class="row"><span class="lab">Generated at</span><div class="mono">${sealed ? esc(now) : "—"}</div></div>
      <div class="row" style="border:0"><span class="lab">Dual sign-off</span>
        <div class="sign">
          <div class="slot ${sealed ? "done" : ""}"><div class="line"></div><small>Custodian — S. Gowda, Dy.SP</small></div>
          <div class="slot ${sealed ? "done" : ""}"><div class="line"></div><small>Expert — A. Kulkarni, Forensic Analyst</small></div>
        </div>
      </div>
      <div><span class="chip ${sealed ? "forest" : ""}">${sealed ? "sealed · draft pending dual signature" : "unsealed"}</span></div>
    </div>`;
}

async function sealFinding() {
  const stamp = $("#stamp");
  if (stamp.classList.contains("sealed")) return;
  stamp.classList.add("pressing");
  $("#sealBtn").disabled = true;
  const hash = await sha256(JSON.stringify(FINDING.output) + JSON.stringify(FINDING.inputs));
  sealedHash = hash;
  setTimeout(() => {
    stamp.classList.remove("pressing");
    stamp.classList.add("sealed");
    $("#stampTxt").textContent = "SEALED";
    renderCert(hash, true);
    $("#sealHint").textContent = "Hash-stamped. Certificate drafted — awaiting dual signature.";
    toast("Finding sealed — §63 certificate drafted");
    if (state._speak) speak("Finding sealed. Section 63 certificate drafted.");
  }, 520);
}

/* ============================ voice (Web Speech) ============================ */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;
function speak(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = state.lang === "kn" ? "kn-IN" : "en-IN";
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
const VOICE_ERR = {
  "not-allowed": L => L("Microphone blocked — allow mic access for this site, then click Speak again.", "ಮೈಕ್ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ — ಈ ಸೈಟ್‌ಗೆ ಮೈಕ್ ಅನುಮತಿಸಿ, ನಂತರ ಮತ್ತೆ ಮಾತನಾಡಿ ಒತ್ತಿ."),
  "service-not-allowed": L => L("Speech service unavailable — open the page over http://localhost, not a file:// path.", "ಭಾಷಣ ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ — ಪುಟವನ್ನು file:// ಬದಲು http://localhost ಮೂಲಕ ತೆರೆಯಿರಿ."),
  "network": L => L("Speech recognition needs an internet connection.", "ಭಾಷಣ ಗುರುತಿಸುವಿಕೆಗೆ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಬೇಕು."),
  "no-speech": L => L("Didn't catch that — try speaking again.", "ಕೇಳಿಸಲಿಲ್ಲ — ಮತ್ತೆ ಮಾತನಾಡಲು ಪ್ರಯತ್ನಿಸಿ."),
};
function toggleVoice() {
  state._speak = true;
  if (!SR) { toast(L("Voice input needs Chrome or Edge — output still works.", "ಧ್ವನಿ ಇನ್‌ಪುಟ್‌ಗೆ Chrome ಅಥವಾ Edge ಬೇಕು — ಔಟ್‌ಪುಟ್ ಇನ್ನೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.")); return; }
  if (recog && recog._on) { recog.stop(); return; }
  recog = new SR();
  recog.lang = state.lang === "kn" ? "kn-IN" : "en-IN";
  recog.interimResults = true;
  recog._on = true;
  $("#voiceBtn").classList.add("live");
  recog._got = false;
  recog.onstart = () => toast(L("Listening…", "ಆಲಿಸುತ್ತಿದೆ…"));
  recog.onresult = (e) => {
    const text = [...e.results].map((r) => r[0].transcript).join("");
    $("#q").value = text;
    if (text.trim()) recog._got = true;
    // submit as soon as we have a final result, don't wait for the mic to time out
    if ([...e.results].some((r) => r.isFinal) && text.trim()) { recog._done = true; recog.stop(); }
  };
  recog.onend = () => {
    recog._on = false; $("#voiceBtn").classList.remove("live");
    if ($("#q").value.trim()) ask();
    else if (!recog._got) toast(L("Didn't catch anything — speak clearly and try again.", "ಏನೂ ಕೇಳಿಸಲಿಲ್ಲ — ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."));
  };
  recog.onerror = (e) => {
    recog._on = false; $("#voiceBtn").classList.remove("live");
    const m = VOICE_ERR[e.error]; if (m) toast(m(L)); else toast(L("Voice error: ", "ಧ್ವನಿ ದೋಷ: ") + e.error);
  };
  try { recog.start(); }
  catch (err) { recog._on = false; $("#voiceBtn").classList.remove("live"); toast(L("Couldn't start the mic — click Speak again.", "ಮೈಕ್ ಪ್ರಾರಂಭಿಸಲಾಗಲಿಲ್ಲ — ಮತ್ತೆ ಮಾತನಾಡಿ ಒತ್ತಿ.")); }
}

/* ============================ role + nav + theme ============================ */
function applyRole() {
  const R = ROLES[state.role];
  $("#whoName").textContent = R.name;
  $("#whoScope").textContent = state.lang === "kn" ? R.scopeKn : R.scope;
  // reset console with a role-appropriate greeting
  $("#transcript").innerHTML = "";
  const greet = R.aggregatesOnly
    ? L("You are viewing state-wide aggregates only. Individual records and PII are never shown to this role.",
        "ನೀವು ರಾಜ್ಯ ಮಟ್ಟದ ಒಟ್ಟುಗಳನ್ನಷ್ಟೇ ನೋಡುತ್ತಿದ್ದೀರಿ. ವೈಯಕ್ತಿಕ ದಾಖಲೆ ಮತ್ತು ಮಾಹಿತಿಯನ್ನು ಈ ಪಾತ್ರಕ್ಕೆ ಎಂದಿಗೂ ತೋರಿಸಲಾಗುವುದಿಲ್ಲ.")
    : R.mask
      ? L("Cross-case access enabled. Personal identifiers are masked until a supervisor grants elevation.",
          "ಅಡ್ಡ-ಪ್ರಕರಣ ಪ್ರವೇಶ ಸಕ್ರಿಯಗೊಂಡಿದೆ. ಮೇಲ್ವಿಚಾರಕ ಅನುಮತಿ ನೀಡುವವರೆಗೆ ವೈಯಕ್ತಿಕ ಗುರುತುಗಳನ್ನು ಮರೆಮಾಡಲಾಗಿದೆ.")
      : L(`Full detail for your scope: ${R.scope.split("· ")[1] || "assigned cases"}. Every query is role-filtered before retrieval and logged.`,
          `ನಿಮ್ಮ ವ್ಯಾಪ್ತಿಗೆ ಪೂರ್ಣ ವಿವರ: ${R.scopeKn.split("· ")[1] || "ನಿಯೋಜಿತ ಪ್ರಕರಣಗಳು"}. ಪ್ರತಿ ಪ್ರಶ್ನೆಯೂ ಪಡೆಯುವ ಮೊದಲು ಪಾತ್ರ-ಶೋಧಿತ ಮತ್ತು ದಾಖಲಿತ.`);
  addTurn("system", `<div class="bubble"><p>${esc(greet)}</p></div>`);
}

function switchView(v) {
  $$(".view").forEach((s) => s.classList.toggle("active", s.id === "view-" + v));
  $$(".nav").forEach((n) => n.setAttribute("aria-current", String(n.dataset.view === v)));
}

function initTheme() {
  const btn = $("#themeBtn");
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme")
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  });
}

/* ============================ boot ============================ */
function boot() {
  renderStats(); renderMatches(); renderPatterns(); renderCert(null, false); applyLang(); applyRole();
  $("#erBadge").textContent = DATA.matches.length;

  $$(".nav").forEach((n) => n.addEventListener("click", () => switchView(n.dataset.view)));
  $("#role").addEventListener("change", (e) => { state.role = e.target.value; applyRole(); });
  $$(".seg [data-lang]").forEach((b) => b.addEventListener("click", () => {
    state.lang = b.dataset.lang;
    $$(".seg [data-lang]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    applyLang(); applyRole(); // reset greeting/transcript into the new language
  }));
  $("#ask").addEventListener("click", ask);
  $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } });
  $("#q").addEventListener("input", (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; });
  $("#voiceBtn").addEventListener("click", toggleVoice);
  $("#sealBtn").addEventListener("click", sealFinding);
  initTheme();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
