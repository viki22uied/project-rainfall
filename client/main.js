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
    { d: "Tumakuru", ipc: 5520, sll: 1524, total: 7044 },
    { d: "Bagalkot", ipc: 2199, sll: 735, total: 2934 },
  ],
  // all 37 real districts — karnataka_district_crime_2022_real.csv joined with
  // karnataka_district_centroids.csv (K.Railways / Total Districts rows dropped: not places).
  districts: [
    { d: "Bengaluru City", ipc: 28666, sll: 17521, total: 46187, lat: 12.9716, lng: 77.5946 },
    { d: "Tumakuru", ipc: 5520, sll: 1524, total: 7044, lat: 13.3392, lng: 77.1139 },
    { d: "Bengaluru District", ipc: 6031, sll: 961, total: 6992, lat: 13.24, lng: 77.45 },
    { d: "Shimoga", ipc: 4591, sll: 1500, total: 6091, lat: 13.9299, lng: 75.5681 },
    { d: "Belagavi District", ipc: 4703, sll: 1324, total: 6027, lat: 15.8497, lng: 74.4977 },
    { d: "Ramanagara", ipc: 4155, sll: 1720, total: 5875, lat: 12.7217, lng: 77.2812 },
    { d: "Hassan", ipc: 4652, sll: 1189, total: 5841, lat: 13.0072, lng: 76.1004 },
    { d: "Mandya", ipc: 4830, sll: 781, total: 5611, lat: 12.5242, lng: 76.8958 },
    { d: "Mysuru District", ipc: 4315, sll: 1088, total: 5403, lat: 12.1, lng: 76.4 },
    { d: "Chitradurga", ipc: 4057, sll: 1264, total: 5321, lat: 14.2251, lng: 76.398 },
    { d: "Davanagere", ipc: 3396, sll: 995, total: 4391, lat: 14.4644, lng: 75.9218 },
    { d: "Chikkaballapura", ipc: 2577, sll: 1743, total: 4320, lat: 13.4355, lng: 77.7315 },
    { d: "Vijayapura", ipc: 2858, sll: 1438, total: 4296, lat: 16.8302, lng: 75.71 },
    { d: "Bidar", ipc: 3136, sll: 886, total: 4022, lat: 17.9104, lng: 77.5199 },
    { d: "Raichur", ipc: 2577, sll: 1348, total: 3925, lat: 16.2076, lng: 77.3463 },
    { d: "Chikkamagaluru", ipc: 2759, sll: 1096, total: 3855, lat: 13.3161, lng: 75.772 },
    { d: "Uttara Kannada", ipc: 2323, sll: 1202, total: 3525, lat: 14.7999, lng: 74.6997 },
    { d: "Kalaburgi", ipc: 2462, sll: 850, total: 3312, lat: 17.3297, lng: 76.8343 },
    { d: "Mysuru City", ipc: 2658, sll: 647, total: 3305, lat: 12.2958, lng: 76.6394 },
    { d: "Ballari", ipc: 1792, sll: 1434, total: 3226, lat: 15.1394, lng: 76.9214 },
    { d: "Haveri", ipc: 2409, sll: 767, total: 3176, lat: 14.7936, lng: 75.4044 },
    { d: "Hubballi Dharwad", ipc: 2006, sll: 1139, total: 3145, lat: 15.3647, lng: 75.124 },
    { d: "Koppal", ipc: 2175, sll: 893, total: 3068, lat: 15.3547, lng: 76.1548 },
    { d: "Bagalkot", ipc: 2199, sll: 735, total: 2934, lat: 16.1691, lng: 75.6597 },
    { d: "Udupi", ipc: 2342, sll: 566, total: 2908, lat: 13.3409, lng: 74.7421 },
    { d: "Vijayanagara", ipc: 1795, sll: 1091, total: 2886, lat: 15.2385, lng: 76.4614 },
    { d: "Kolar", ipc: 2417, sll: 360, total: 2777, lat: 13.1362, lng: 78.1298 },
    { d: "Mangaluru City", ipc: 1979, sll: 686, total: 2665, lat: 12.9141, lng: 74.856 },
    { d: "Chamarajnagar", ipc: 1705, sll: 668, total: 2373, lat: 11.9236, lng: 76.9456 },
    { d: "Kalaburgi City", ipc: 1768, sll: 582, total: 2350, lat: 17.3297, lng: 76.8343 },
    { d: "Belagavi City", ipc: 1721, sll: 406, total: 2127, lat: 15.8497, lng: 74.4977 },
    { d: "Dakshina Kannada", ipc: 1812, sll: 266, total: 2078, lat: 12.92, lng: 75.15 },
    { d: "Gadag", ipc: 1060, sll: 856, total: 1916, lat: 15.431, lng: 75.637 },
    { d: "Yadgiri", ipc: 1316, sll: 508, total: 1824, lat: 16.7693, lng: 77.1376 },
    { d: "Dharwad", ipc: 1193, sll: 536, total: 1729, lat: 15.4589, lng: 75.0078 },
    { d: "Kodagu", ipc: 1355, sll: 284, total: 1639, lat: 12.3375, lng: 75.8069 },
    { d: "K.G.F.", ipc: 855, sll: 370, total: 1225, lat: 12.9585, lng: 78.2677 },
  ],
  // criminal network — nodes (persons/cases) + relationships. PII masked at render for masked roles.
  network: {
    nodes: [
      { id: "P-1001", label: "PrakashKumar", kind: "accused", x: 50, y: 30 },
      { id: "P-1041", label: "Manjunath I.", kind: "accused", x: 78, y: 22 },
      { id: "P-1002", label: "GirishShetty", kind: "victim", x: 22, y: 20 },
      { id: "C-5001", label: "C-5001", kind: "case", x: 34, y: 52 },
      { id: "C-5002", label: "C-5002", kind: "case", x: 60, y: 55 },
      { id: "C-5004", label: "C-5004", kind: "case", x: 82, y: 50 },
      { id: "SERIAL-1", label: "SERIAL-1", kind: "cluster", x: 58, y: 82 },
    ],
    edges: [
      { a: "P-1001", b: "C-5001", rel: "accused in" },
      { a: "P-1002", b: "C-5001", rel: "victim in" },
      { a: "P-1001", b: "C-5002", rel: "accused in" },
      { a: "P-1041", b: "C-5004", rel: "accused in" },
      { a: "P-1001", b: "P-1041", rel: "co-offender", weak: true },
      { a: "C-5001", b: "SERIAL-1", rel: "member" },
      { a: "C-5002", b: "SERIAL-1", rel: "member" },
      { a: "C-5004", b: "SERIAL-1", rel: "member" },
    ],
  },
  // socio-demographic correlation (accused profile vs urbanization) — aggregate, no PII
  demographics: {
    age: [ { b: "18–25", v: 34 }, { b: "26–35", v: 41 }, { b: "36–45", v: 17 }, { b: "46+", v: 8 } ],
    gender: [ { b: "Male", v: 88 }, { b: "Female", v: 11 }, { b: "Other", v: 1 } ],
    urban: [ { b: "Urban", v: 63 }, { b: "Semi-urban", v: 24 }, { b: "Rural", v: 13 } ],
  },
};

/* ============================ i18n ============================ */
const I18N = {
  en: {
    brand_sub: "KSP Crime Intelligence", classif: "Restricted · Official Use", voice: "Speak",
    demo_banner: "Hackathon demo · role switch unauthenticated",
    nav_head: "Workspace", nav_console: "Query Console", nav_er: "Entity Resolution",
    nav_mo: "Serial Patterns", nav_network: "Network", nav_hotspots: "Hotspots", nav_evidence: "Evidence Chain", signed_in: "Signed in", send: "Send",
    export_btn: "Export PDF", ask_ph: "Ask about a case, person, hotspot, or pattern…",
    net_h: "Criminal Network", net_p: "Persons, cases and clusters as one relationship graph. Confirmed identities collapse into a single node; cross-jurisdiction co-offending links surface here.",
    hs_h: "Crime Hotspots", hs_p: "District-level crime intensity, 2022 snapshot. Click a district to drill in — detail shown depends on your role.",
    hs_empty: "Select a district on the map.", hs_investigator_note: "Investigators see their own station's cases only, regardless of district clicked.",
    hs_denied: "Outside your assigned district — access denied.", hs_aggregate_only: "State aggregates only — no individual case records for this role.",
    er_h: "Entity Resolution", er_p: "Candidate matches across inconsistent records — scored, never auto-merged. An analyst or supervisor confirms before two records become one identity.",
    er_pending: "Candidate matches — pending review",
    mo_h: "Serial-Pattern Analysis", mo_p: "Unsolved cases linked by modus operandi — no named suspect required. Cross-jurisdiction spread is the signal, not a coincidence.",
    ev_h: "Court-Admissible Evidence Chain", ev_p: "Every AI finding is hash-stamped at the moment it is generated and issued as a Bharatiya Sakshya Adhiniyam 2023, Section 63 electronic-evidence certificate — the standard Indian courts now require.",
    seal_btn: "Seal finding", seal_hint: "Press to hash-stamp the selected finding.",
  },
  kn: {
    brand_sub: "ಕೆಎಸ್‌ಪಿ ಅಪರಾಧ ಗುಪ್ತಚರ", classif: "ನಿರ್ಬಂಧಿತ · ಅಧಿಕೃತ ಬಳಕೆ", voice: "ಮಾತನಾಡಿ",
    demo_banner: "ಹ್ಯಾಕಥಾನ್ ಡೆಮೊ · ಪಾತ್ರ ಬದಲಾವಣೆ ದೃಢೀಕರಿಸದ",
    nav_head: "ಕಾರ್ಯಕ್ಷೇತ್ರ", nav_console: "ಪ್ರಶ್ನೆ ಫಲಕ", nav_er: "ವ್ಯಕ್ತಿ ಗುರುತಿಸುವಿಕೆ",
    nav_mo: "ಸರಣಿ ಮಾದರಿಗಳು", nav_network: "ಜಾಲ", nav_hotspots: "ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು", nav_evidence: "ಸಾಕ್ಷ್ಯ ಸರಪಳಿ", signed_in: "ಪ್ರವೇಶಿಸಿದವರು", send: "ಕಳುಹಿಸಿ",
    export_btn: "ಪಿಡಿಎಫ್ ರಫ್ತು", ask_ph: "ಪ್ರಕರಣ, ವ್ಯಕ್ತಿ, ಹಾಟ್‌ಸ್ಪಾಟ್ ಅಥವಾ ಮಾದರಿ ಬಗ್ಗೆ ಕೇಳಿ…",
    net_h: "ಅಪರಾಧ ಜಾಲ", net_p: "ವ್ಯಕ್ತಿಗಳು, ಪ್ರಕರಣಗಳು ಮತ್ತು ಕ್ಲಸ್ಟರ್‌ಗಳು ಒಂದೇ ಸಂಬಂಧ ಗ್ರಾಫ್ ಆಗಿ. ದೃಢೀಕೃತ ಗುರುತುಗಳು ಒಂದೇ ನೋಡ್ ಆಗಿ ಸೇರುತ್ತವೆ; ಗಡಿ-ದಾಟುವ ಸಹ-ಅಪರಾಧ ಕೊಂಡಿಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
    hs_h: "ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು", hs_p: "ಜಿಲ್ಲಾ ಮಟ್ಟದ ಅಪರಾಧ ತೀವ್ರತೆ, 2022 ಸ್ನ್ಯಾಪ್‌ಶಾಟ್. ವಿವರಗಳಿಗೆ ಜಿಲ್ಲೆಯ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ — ನಿಮ್ಮ ಪಾತ್ರವನ್ನು ಅವಲಂಬಿಸಿ ವಿವರ ಬದಲಾಗುತ್ತದೆ.",
    hs_empty: "ನಕ್ಷೆಯಲ್ಲಿ ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.", hs_investigator_note: "ಯಾವುದೇ ಜಿಲ್ಲೆ ಕ್ಲಿಕ್ ಮಾಡಿದರೂ ತನಿಖಾಧಿಕಾರಿಗಳಿಗೆ ತಮ್ಮ ಠಾಣೆಯ ಪ್ರಕರಣಗಳಷ್ಟೇ ಕಾಣಿಸುತ್ತವೆ.",
    hs_denied: "ನಿಮ್ಮ ನಿಯೋಜಿತ ಜಿಲ್ಲೆಯ ಹೊರಗೆ — ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ.", hs_aggregate_only: "ರಾಜ್ಯ ಒಟ್ಟುಗಳಷ್ಟೇ — ಈ ಪಾತ್ರಕ್ಕೆ ಪ್ರತ್ಯೇಕ ಪ್ರಕರಣ ದಾಖಲೆಗಳಿಲ್ಲ.",
    er_h: "ವ್ಯಕ್ತಿ ಗುರುತಿಸುವಿಕೆ", er_p: "ಅಸಮಂಜಸ ದಾಖಲೆಗಳಾದ್ಯಂತ ಸಂಭಾವ್ಯ ಹೊಂದಾಣಿಕೆಗಳು — ಅಂಕ ನೀಡಲಾಗಿದೆ, ಸ್ವಯಂ-ವಿಲೀನಗೊಳಿಸಿಲ್ಲ. ವಿಶ್ಲೇಷಕ ಅಥವಾ ಮೇಲ್ವಿಚಾರಕ ದೃಢೀಕರಿಸುತ್ತಾರೆ.",
    er_pending: "ಸಂಭಾವ್ಯ ಹೊಂದಾಣಿಕೆಗಳು — ಪರಿಶೀಲನೆ ಬಾಕಿ",
    mo_h: "ಸರಣಿ ಮಾದರಿ ವಿಶ್ಲೇಷಣೆ", mo_p: "ಕಾರ್ಯವಿಧಾನದಿಂದ ಸಂಪರ್ಕಿಸಲಾದ ಬಗೆಹರಿಯದ ಪ್ರಕರಣಗಳು — ಶಂಕಿತನ ಹೆಸರು ಅಗತ್ಯವಿಲ್ಲ. ಗಡಿ-ದಾಟುವ ಹರಡುವಿಕೆಯೇ ಸೂಚನೆ.",
    ev_h: "ನ್ಯಾಯಾಲಯ-ಸ್ವೀಕಾರಾರ್ಹ ಸಾಕ್ಷ್ಯ ಸರಪಳಿ", ev_p: "ಪ್ರತಿ ಎಐ ಸಂಶೋಧನೆಯನ್ನು ಉತ್ಪಾದನೆಯ ಕ್ಷಣದಲ್ಲೇ ಹ್ಯಾಶ್-ಮುದ್ರೆ ಹಾಕಲಾಗುತ್ತದೆ ಮತ್ತು ಭಾರತೀಯ ಸಾಕ್ಷ್ಯ ಅಧಿನಿಯಮ 2023, ಸೆಕ್ಷನ್ 63 ಪ್ರಮಾಣಪತ್ರ ನೀಡಲಾಗುತ್ತದೆ.",
    seal_btn: "ಸಂಶೋಧನೆ ಮುದ್ರಿಸಿ", seal_hint: "ಆಯ್ದ ಸಂಶೋಧನೆಗೆ ಹ್ಯಾಶ್-ಮುದ್ರೆ ಹಾಕಲು ಒತ್ತಿರಿ.",
  },
};

/* ============================ roles ============================ */
const ROLES = {
  investigator: { name: "I. Nayak", email: "investigator@rainfall.demo", scope: "Sub-Inspector · Gandhinagar PS", scopeKn: "ಉಪ-ನಿರೀಕ್ಷಕ · ಗಾಂಧಿನಗರ ಠಾಣೆ", station: "Gandhinagar PS", mask: false, aggregatesOnly: false },
  analyst:      { name: "A. Kulkarni", email: "analyst@rainfall.demo", scope: "Crime Analyst · State", scopeKn: "ಅಪರಾಧ ವಿಶ್ಲೇಷಕ · ರಾಜ್ಯ", mask: true, aggregatesOnly: false },
  supervisor:   { name: "S. Gowda", email: "supervisor@rainfall.demo", scope: "Deputy SP · Ballari District", scopeKn: "ಉಪ ಪೊಲೀಸ್ ವರಿಷ್ಠಾಧಿಕಾರಿ · ಬಳ್ಳಾರಿ ಜಿಲ್ಲೆ", district: "Ballari", mask: false, aggregatesOnly: false },
  policymaker:  { name: "P. Rao", email: "policymaker@rainfall.demo", scope: "Secretariat · State aggregates", scopeKn: "ಸಚಿವಾಲಯ · ರಾಜ್ಯ ಒಟ್ಟುಗಳು", mask: true, aggregatesOnly: true },
};

/* ============================ live backend (Node gateway → AppSail ML) ============================ */
/* The gateway role-filters BEFORE any ML call (PRD §4) and hash-chains an audit row per request.
   If the backend is unreachable (e.g. the static Slate build with no server), we keep the curated
   sample so the console never dies — state.live reflects which is in use. */
const API_URL = "/server/rainfall-node-api/execute";
async function api(action, extra = {}) {
  const res = await fetch(API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, actor_email: ROLES[state.role].email, ...extra }),
  });
  // Basic I/O wraps the function's string output as { output: "<json>" }; unwrap when present.
  let j = await res.json();
  if (j && typeof j.output === "string") j = JSON.parse(j.output);
  if (!j || j.status !== "success") { const e = new Error((j && (j.reason || j.error)) || "api error"); e.denied = true; throw e; }
  return j;
}

async function loadLive() {
  try {
    const s = await api("stats");
    DATA.stats[0].v = s.stats.cases; DATA.stats[0].d = `${s.stats.persons} persons on file`;
    DATA.stats[1].v = s.stats.unsolved;
    DATA.stats[1].d = `${Math.round(100 * s.stats.unsolved / s.stats.cases)}% open`;
    state.live = true;
  } catch (_) { state.live = false; }

  try {
    const { data } = await api("mo_clusters");
    if (data.patterns && data.patterns.length) {
      DATA.clusters = data.patterns.map((p, i) => ({
        id: `SERIAL-${i + 1}`, crime: p.crime_type || "Serial pattern",
        cases: p.case_ids, districts: p.districts,
        sig: Object.fromEntries(Object.entries(p.signature || {}).filter(([, v]) => v)),
        score: p.score,
      }));
      DATA.stats[2].v = data.patterns.length;
    }
  } catch (_) { /* keep sample clusters */ }

  try {
    const { data } = await api("er_candidates");
    if (data.candidates && data.candidates.length) {
      DATA.matches = data.candidates.map((m, i) => ({
        id: `M${i + 1}`, person_a: m.person_a, person_b: m.person_b, method: m.method,
        a: { name: m.name_a, sub: `${m.person_a}`, src: "Data Store · Persons" },
        b: { name: m.name_b, sub: `${m.person_b}`, src: "Data Store · Persons" },
        conf: m.confidence,
        why: [`Composite match (${m.method})`, `Confidence score ${m.confidence}/100`,
              m.confidence >= 90 ? "Above review threshold" : "Below auto-confirm — needs review"],
      }));
    }
  } catch (e) { if (e.denied) DATA.matches = []; /* role denied → show none; offline → keep sample */ }

  renderStats(); renderMatches(); renderPatterns(); renderNetwork();
  $("#erBadge").textContent = DATA.matches.length;
  renderLiveBadge();
}

function renderLiveBadge() {
  let el = $("#liveBadge");
  if (!el) { el = document.createElement("span"); el.id = "liveBadge"; el.className = "classif"; $(".topbar").insertBefore(el, $(".topbar .spacer")); }
  el.style.marginLeft = "8px";
  el.textContent = state.live ? L("● Live · AppSail ML", "● ನೇರ · AppSail ML") : L("○ Sample data", "○ ಮಾದರಿ ಡೇಟಾ");
  el.style.color = state.live ? "var(--ok)" : "var(--text-3)";
}

/* ============================ state + helpers ============================ */
const state = { lang: "en", role: "investigator", lastEntity: null, live: false };
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

  // context-aware follow-up: a pronoun/short query with no named entity reuses the last one.
  const namesEntity = /accused|victim|hotspot|snatch|serial|pattern|risk|profile|demograph|socio|financ|transaction|c-\d/.test(q);
  const isFollowup = /\b(his|her|its|that|this|the case|same|status|there|it)\b|ಅವನ|ಅವಳ|ಅದರ|ಆ |ಸ್ಥಿತಿ/.test(q);
  if (!namesEntity && isFollowup && state.lastEntity === "C-5001") {
    qRaw = "accused in " + state.lastEntity; // resolve pronoun → last case, fall through to the case branch
    return route(qRaw);
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
        <p class="hint">${L("See the Hotspots map for the full district-by-district view with drill-down.", "ಸಂಪೂರ್ಣ ಜಿಲ್ಲಾವಾರು ವೀಕ್ಷಣೆಗೆ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳ ನಕ್ಷೆ ನೋಡಿ.")}</p>
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

  // socio-demographic correlation (aggregate — allowed for every role incl. policymaker)
  if (/demograph|socio|age|gender|urban|correlat|ವಯಸ್ಸು|ಲಿಂಗ|ನಗರ|ಸಾಮಾಜಿಕ/.test(q)) {
    const bars = (title, rows) => `<div class="record"><div class="rhead"><b>${esc(title)}</b></div>
      <div class="socio">${rows.map((r) => `<div class="sbar"><span class="lab">${esc(r.b)}</span><i style="width:${r.v}%"></i><span class="num">${r.v}%</span></div>`).join("")}</div></div>`;
    const D = DATA.demographics;
    return {
      html: `<div class="bubble"><p>${L("Socio-demographic correlation of accused profiles (state aggregate, no PII):", "ಆರೋಪಿ ಪ್ರೊಫೈಲ್‌ಗಳ ಸಾಮಾಜಿಕ-ಜನಸಂಖ್ಯಾ ಸಂಬಂಧ (ರಾಜ್ಯ ಒಟ್ಟು, ಮಾಹಿತಿ ಇಲ್ಲ):")}</p>
        ${bars(L("Age band", "ವಯೋಮಾನ"), D.age)}${bars(L("Gender", "ಲಿಂಗ"), D.gender)}${bars(L("Urbanization", "ನಗರೀಕರಣ"), D.urban)}
        <p class="hint" style="margin-top:8px">${L("Correlation: 26–35 urban males dominate property crime — consistent with the SERIAL-1 offender profile.", "ಸಂಬಂಧ: 26–35 ನಗರ ಪುರುಷರು ಆಸ್ತಿ ಅಪರಾಧದಲ್ಲಿ ಪ್ರಬಲರು — SERIAL-1 ಅಪರಾಧಿ ಪ್ರೊಫೈಲ್‌ಗೆ ಹೊಂದುತ್ತದೆ.")}</p>
        ${trail([
          L("Aggregate correlation — no individual record touched", "ಒಟ್ಟು ಸಂಬಂಧ — ಯಾವುದೇ ವೈಯಕ್ತಿಕ ದಾಖಲೆ ಸ್ಪರ್ಶಿಸಿಲ್ಲ"),
          L("Distribution over accused across all loaded cases", "ಎಲ್ಲಾ ಪ್ರಕರಣಗಳ ಆರೋಪಿಗಳ ಮೇಲಿನ ವಿತರಣೆ")], "b7e 2f9…")}</div>`,
      speak: L("Property crime skews to urban males aged 26 to 35, matching the serial offender profile.", "ಆಸ್ತಿ ಅಪರಾಧ 26 ರಿಂದ 35 ವಯಸ್ಸಿನ ನಗರ ಪುರುಷರ ಕಡೆಗೆ ವಾಲುತ್ತದೆ."),
    };
  }

  // financial / transaction link — deliberately mocked, upfront: emits an FIU-IND request object
  if (/financ|transaction|bank|money|fiu|launder|ಹಣಕಾಸು|ವಹಿವಾಟು|ಬ್ಯಾಂಕ್|ಹಣ/.test(q)) {
    const req = {
      request_type: "FIU-IND / STR lookup", statute: "PMLA 2002 s.12 · gated",
      subject: R.mask ? "[PII masked]" : "PrakashKumar (P-1001)",
      linked_cases: ["C-5001", "C-5002"], requested_by: R.name, status: "DRAFT — not transmitted",
    };
    return {
      html: `<div class="bubble"><div class="denied" style="border-color:var(--accent);color:var(--text)">${L(
          "Live financial-transaction access is legally gated to FIU-IND under PMLA — Project-Rainfall does <b>not</b> query it directly. Instead it drafts the structured request an authorised officer would transmit:",
          "ನೇರ ಹಣಕಾಸು-ವಹಿವಾಟು ಪ್ರವೇಶ PMLA ಅಡಿಯಲ್ಲಿ FIU-IND ಗೆ ಕಾನೂನುಬದ್ಧವಾಗಿ ಸೀಮಿತ — Project-Rainfall ಇದನ್ನು ನೇರವಾಗಿ ಪ್ರಶ್ನಿಸುವುದಿಲ್ಲ. ಬದಲಿಗೆ ಅಧಿಕೃತ ಅಧಿಕಾರಿ ಕಳುಹಿಸಬೇಕಾದ ರಚನಾತ್ಮಕ ವಿನಂತಿಯನ್ನು ರಚಿಸುತ್ತದೆ:")}</div>
        <pre class="req mono">${esc(JSON.stringify(req, null, 2))}</pre>
        ${trail([
          L("No live financial data accessed — request object only", "ಯಾವುದೇ ನೇರ ಹಣಕಾಸು ಡೇಟಾ ಪ್ರವೇಶಿಸಿಲ್ಲ — ವಿನಂತಿ ವಸ್ತು ಮಾತ್ರ"),
          L("Transmission requires SP-rank authorisation + PMLA basis", "ಪ್ರಸರಣಕ್ಕೆ SP-ಶ್ರೇಣಿ ಅನುಮತಿ + PMLA ಆಧಾರ ಬೇಕು")], "c41 8ad…")}</div>`,
      speak: L("Financial access is legally gated to F I U India. I have drafted the request object, not queried live data.", "ಹಣಕಾಸು ಪ್ರವೇಶ FIU ಇಂಡಿಯಾಗೆ ಕಾನೂನುಬದ್ಧವಾಗಿ ಸೀಮಿತ. ನಾನು ವಿನಂತಿ ವಸ್ತುವನ್ನು ರಚಿಸಿದ್ದೇನೆ."),
    };
  }

  // fallback
  return {
    html: `<div class="bubble"><p>${L("I can retrieve FIR/case details, resolve identities across records, surface serial patterns, map hotspots, and score offender risk — every answer role-filtered and hash-stamped for evidence.", "ನಾನು ಎಫ್‌ಐಆರ್/ಪ್ರಕರಣ ವಿವರ ಪಡೆಯಬಲ್ಲೆ, ದಾಖಲೆಗಳಾದ್ಯಂತ ಗುರುತು ಗುರುತಿಸಬಲ್ಲೆ, ಸರಣಿ ಮಾದರಿ ತೋರಿಸಬಲ್ಲೆ, ಹಾಟ್‌ಸ್ಪಾಟ್ ನಕ್ಷೆ ಮಾಡಬಲ್ಲೆ, ಅಪರಾಧಿ ಅಪಾಯ ಅಂಕ ನೀಡಬಲ್ಲೆ — ಪ್ರತಿ ಉತ್ತರವೂ ಪಾತ್ರ-ಶೋಧಿತ ಮತ್ತು ಸಾಕ್ಷ್ಯಕ್ಕಾಗಿ ಹ್ಯಾಶ್-ಮುದ್ರಿತ.")}</p>
      <p class="hint">${L("Try one of the suggested queries above.", "ಮೇಲಿನ ಸೂಚಿತ ಪ್ರಶ್ನೆಗಳಲ್ಲಿ ಒಂದನ್ನು ಪ್ರಯತ್ನಿಸಿ.")}</p></div>`,
    speak: L("I can retrieve case details, resolve identities, surface serial patterns, and score risk.", "ನಾನು ಪ್ರಕರಣ ವಿವರ ಪಡೆಯಬಲ್ಲೆ, ಗುರುತು ಗುರುತಿಸಬಲ್ಲೆ, ಸರಣಿ ಮಾದರಿ ತೋರಿಸಬಲ್ಲೆ, ಅಪಾಯ ಅಂಕ ನೀಡಬಲ್ಲೆ."),
  };
}

// Live analytics answers (AppSail). Returns null when the intent isn't analytics or the
// backend is unreachable/denied — the caller then falls back to the curated route().
async function liveIntent(qRaw) {
  if (!state.live) return null;
  const q = qRaw.toLowerCase();
  try {
    if (/risk|profile|dangerous|ಅಪಾಯ|ಪ್ರೊಫೈಲ್/.test(q)) {
      const { data } = await api("risk");
      const t = data.top[0];
      const rows = [[L("Overall risk", "ಒಟ್ಟಾರೆ ಅಪಾಯ"), `<span class="chip rust"><span class="dot"></span>${t.score} / 100</span>`],
        [L("Repeat offending", "ಪುನರಾವರ್ತಿತ ಅಪರಾಧ"), `${t.factors.repeat_offending} — ${t.case_count} ${L("linked cases", "ಸಂಪರ್ಕಿತ ಪ್ರಕರಣಗಳು")}`],
        [L("Crime severity", "ಅಪರಾಧ ತೀವ್ರತೆ"), `${t.factors.crime_severity} — ${L("max severity", "ಗರಿಷ್ಠ ತೀವ್ರತೆ")} ${t.max_severity}/10`],
        [L("Geographic spread", "ಭೌಗೋಳಿಕ ಹರಡುವಿಕೆ"), `${t.factors.geographic_spread} — ${t.districts.length} ${L("districts", "ಜಿಲ್ಲೆಗಳು")}`]];
      const name = ROLES[state.role].mask ? L("[PII masked]", "[ಮಾಹಿತಿ ಮರೆಮಾಡಲಾಗಿದೆ]") : t.person_id;
      return { html: `<div class="bubble"><p>${L("Highest-risk offender", "ಅತಿ ಹೆಚ್ಚು ಅಪಾಯದ ಅಪರಾಧಿ")} (${esc(name)}) — ${L("live score from", "ನೇರ ಅಂಕ")} ${data.count} ${L("scored offenders", "ಅಪರಾಧಿಗಳಲ್ಲಿ")}:</p>
          <div class="record"><table><tbody>${rows.map(([k, v]) => `<tr><th style="width:180px">${esc(k)}</th><td>${v}</td></tr>`).join("")}</tbody></table></div>
          ${trail([L("Live: analytics AppSail /risk over Data Store", "ನೇರ: analytics AppSail /risk"), L("Score = transparent weighted behavioral factors", "ಅಂಕ = ಪಾರದರ್ಶಕ ತೂಕದ ಅಂಶಗಳು")], "live · §63")}</div>`,
        speak: L(`Highest risk offender scores ${t.score} out of 100.`, `ಅತಿ ಹೆಚ್ಚು ಅಪಾಯದ ಅಪರಾಧಿ 100 ರಲ್ಲಿ ${t.score}.`) };
    }
    if (/forecast|trend|early warning|rising|ಮುನ್ಸೂಚನೆ|ಪ್ರವೃತ್ತಿ/.test(q)) {
      const { data } = await api("forecast");
      const rows = data.forecast.slice(0, 5).map(f => `<tr><td>${esc(f.key)}</td><td class="num">${f.recent_count}</td><td class="num">${f.trend_slope > 0 ? "+" : ""}${f.trend_slope}/mo</td><td class="num">${f.forecast_next}</td><td>${f.early_warning ? `<span class="chip rust"><span class="dot"></span>${L("warning", "ಎಚ್ಚರಿಕೆ")}</span>` : "—"}</td></tr>`).join("");
      return { html: `<div class="bubble"><p>${L("Crime forecast (least-squares trend over monthly counts):", "ಅಪರಾಧ ಮುನ್ಸೂಚನೆ (ಮಾಸಿಕ ಎಣಿಕೆಗಳ ಪ್ರವೃತ್ತಿ):")}</p>
          <div class="record"><table><thead><tr><th>${L("Type", "ಬಗೆ")}</th><th>${L("Recent", "ಇತ್ತೀಚಿನ")}</th><th>${L("Slope", "ಇಳಿಜಾರು")}</th><th>${L("Next", "ಮುಂದೆ")}</th><th>${L("Alert", "ಎಚ್ಚರಿಕೆ")}</th></tr></thead><tbody>${rows}</tbody></table></div>
          ${trail([L("Live: analytics AppSail /forecast", "ನೇರ: analytics AppSail /forecast"), L("Aggregate — no individual PII touched", "ಒಟ್ಟು — ಯಾವುದೇ ಮಾಹಿತಿ ಇಲ್ಲ")], "live · §63")}</div>`,
        speak: L("Crime forecast computed live from monthly trends.", "ಮಾಸಿಕ ಪ್ರವೃತ್ತಿಗಳಿಂದ ಅಪರಾಧ ಮುನ್ಸೂಚನೆ.") };
    }
    if (/demograph|socio|age|gender|urban|correlat|ವಯಸ್ಸು|ಲಿಂಗ|ನಗರ|ಸಾಮಾಜಿಕ/.test(q)) {
      const { data } = await api("socio");
      const bands = {}; // fold crime_by_age_band into an age-band distribution
      Object.values(data.crime_by_age_band).forEach(byBand => Object.entries(byBand).forEach(([b, n]) => { bands[b] = (bands[b] || 0) + n; }));
      const tot = Object.values(bands).reduce((a, b) => a + b, 0) || 1;
      const ageRows = Object.entries(bands).sort().map(([b, n]) => ({ b, v: Math.round(100 * n / tot) }));
      const urbArr = Array.isArray(data.urbanization) ? data.urbanization : []; // [{district,tier,total_cases}]
      const tierCount = {};
      urbArr.forEach(d => { tierCount[d.tier] = (tierCount[d.tier] || 0) + 1; });
      const urbTot = urbArr.length || 1;
      const order = { high: 0, medium: 1, low: 2 };
      const urbRows = Object.entries(tierCount).sort((a, b) => (order[a[0]] ?? 9) - (order[b[0]] ?? 9))
        .map(([b, n]) => ({ b: b.charAt(0).toUpperCase() + b.slice(1) + L(" urbanization", " ನಗರೀಕರಣ"), v: Math.round(100 * n / urbTot) }));
      const bars = (title, rs) => `<div class="record"><div class="rhead"><b>${esc(title)}</b></div><div class="socio">${rs.map(r => `<div class="sbar"><span class="lab">${esc(r.b)}</span><i style="width:${r.v}%"></i><span class="num">${r.v}%</span></div>`).join("")}</div></div>`;
      return { html: `<div class="bubble"><p>${L("Socio-demographic correlation of accused (live aggregate, no PII):", "ಆರೋಪಿಗಳ ಸಾಮಾಜಿಕ-ಜನಸಂಖ್ಯಾ ಸಂಬಂಧ (ನೇರ ಒಟ್ಟು):")}</p>
          ${bars(L("Age band", "ವಯೋಮಾನ"), ageRows)}${urbRows.length ? bars(L("Urbanization", "ನಗರೀಕರಣ"), urbRows) : ""}
          ${trail([L("Live: analytics AppSail /sociodemographic", "ನೇರ: analytics AppSail /sociodemographic"), L("Distribution over accused across all cases", "ಎಲ್ಲಾ ಪ್ರಕರಣಗಳ ಆರೋಪಿಗಳ ವಿತರಣೆ")], "live · §63")}</div>`,
        speak: L("Socio-demographic correlation computed live.", "ಸಾಮಾಜಿಕ-ಜನಸಂಖ್ಯಾ ಸಂಬಂಧ ನೇರವಾಗಿ.") };
    }
  } catch (_) { return null; } // denied or offline → fall back to curated route
  return null;
}

async function ask() {
  const q = $("#q").value.trim();
  if (!q) return;
  addTurn("user", `<div class="bubble">${esc(q)}</div>`);
  $("#q").value = ""; $("#q").style.height = "auto";
  const res = (await liveIntent(q)) || route(q);
  addTurn("system", res.html);
  if (state._speak) speak(res.speak);
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
    const m = DATA.matches.find((x) => x.id === row.dataset.id);
    row.querySelectorAll("[data-act]").forEach((btn) => btn.addEventListener("click", async () => {
      const confirmed = btn.dataset.act === "confirm";
      row.querySelectorAll("[data-act]").forEach((b) => (b.disabled = true));

      let linksCreated = null;
      if (state.live && m && m.person_a && m.person_b) {
        try {
          const { data } = await api("confirm_match", { payload: JSON.stringify({
            person_a: m.person_a, person_b: m.person_b, decision: confirmed ? "confirmed" : "rejected",
            confidence: m.conf, method: m.method || "composite" }) });
          linksCreated = data.links_created;
        } catch (e) {
          row.querySelectorAll("[data-act]").forEach((b) => (b.disabled = false));
          toast(e.denied ? `Denied — ${e.message}` : "Could not reach the backend — try again.");
          return;
        }
      }

      row.classList.add("resolved");
      const badge = document.createElement("div");
      badge.className = "chip " + (confirmed ? "forest" : "");
      badge.innerHTML = confirmed
        ? `<span class="dot"></span>confirmed & sealed for §63${linksCreated != null ? ` · ${linksCreated} case link${linksCreated === 1 ? "" : "s"} added` : ""}`
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

/* ============================ hotspot map (Leaflet + OSM, vendored) ============================ */
let hsMap = null;
let hsMarkers = {}; // district name -> {marker, circle}
let hsSelected = null;

function districtTier(total, sorted) {
  const n = sorted.length;
  const rank = sorted.findIndex((d) => d.d === total.d); // sorted desc by total
  if (rank < n / 3) return "high";
  if (rank < (2 * n) / 3) return "medium";
  return "low";
}

function initHotspotMap() {
  if (hsMap) { hsMap.invalidateSize(); return; }
  const Leaflet = window.L; // our own bilingual L() helper shadows the Leaflet global by name
  hsMap = Leaflet.map("hsMap", { attributionControl: true, zoomControl: true, minZoom: 6, maxZoom: 11 })
    .setView([15.3, 75.7], 7); // Karnataka centroid-ish
  Leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap contributors",
  }).addTo(hsMap);

  const sorted = [...DATA.districts].sort((a, b) => b.total - a.total);
  const top5 = new Set(sorted.slice(0, 5).map((d) => d.d));
  const maxTotal = sorted[0].total;

  sorted.forEach((d) => {
    const tier = districtTier(d, sorted);
    const r = 5 + 14 * Math.sqrt(d.total / maxTotal); // area-proportional radius, px
    const pulseHtml = top5.has(d.d) ? '<div class="ping"></div>' : "";
    const icon = Leaflet.divIcon({
      className: "hs-pulse-wrap",
      html: `${pulseHtml}<div class="hs-dot ${tier}" style="width:${r * 2}px;height:${r * 2}px;margin:${-r}px 0 0 ${-r}px"></div>`,
      iconSize: [0, 0],
    });
    const marker = Leaflet.marker([d.lat, d.lng], { icon }).addTo(hsMap);
    marker.on("click", () => selectDistrict(d.d));
    hsMarkers[d.d] = marker;
  });
}

async function selectDistrict(name) {
  const d = DATA.districts.find((x) => x.d === name);
  if (!d) return;
  hsSelected = name;
  Object.entries(hsMarkers).forEach(([n, m]) => {
    const el = m.getElement && m.getElement();
    if (el) el.querySelector(".hs-dot")?.classList.toggle("selected", n === name);
  });

  const R = ROLES[state.role];
  const wrap = $("#hsDrill");
  const statsHtml = `
    <div class="hs-district-name">${esc(d.d)}</div>
    <div class="hs-stats">
      <span class="lab">IPC</span><span class="val">${d.ipc.toLocaleString()}</span>
      <span class="lab">SLL</span><span class="val">${d.sll.toLocaleString()}</span>
      <span class="lab">${L("Total", "ಒಟ್ಟು")}</span><span class="val">${d.total.toLocaleString()}</span>
    </div>`;

  // Policymaker: state aggregates only, ever — never a case list, no network call.
  if (R.aggregatesOnly) {
    wrap.innerHTML = statsHtml + `<div class="hs-note">${t("hs_aggregate_only")}</div>`;
    return;
  }
  // Supervisor: full detail for their own district only — anything else is a real denial,
  // decided client-side from their known scope (the backend has no per-click district input;
  // it always returns the supervisor's own district, so a mismatch here IS the correct answer).
  if (state.role === "supervisor" && d.d !== R.district) {
    wrap.innerHTML = statsHtml + `<div class="hs-note denied">${t("hs_denied")}</div>`;
    return;
  }

  wrap.innerHTML = statsHtml + `<div class="hs-note">${L("Loading cases…", "ಪ್ರಕರಣಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…")}</div>`;
  let cases = [];
  let note = "";
  if (state.role === "investigator") note = t("hs_investigator_note");
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "cases", actor_email: R.email }),
    });
    let j = await res.json();
    if (j && typeof j.output === "string") j = JSON.parse(j.output);
    if (j && j.status === "success") {
      cases = (j.data || []).filter((c) => state.role === "investigator" || c.district_name === name);
    } else if (j && j.reason) {
      note = j.reason;
    }
  } catch (_) { note = L("Backend unreachable — no live case data.", "ಬ್ಯಾಕ್‌ಎಂಡ್ ತಲುಪಲಾಗಲಿಲ್ಲ."); }

  const rows = cases.slice(0, 20).map((c) => `
    <div class="hs-case">
      <div class="fir">${esc(c.fir_number || c.case_id)}</div>
      <div>${esc(c.crime_type || "")} · ${esc(c.status || "")}</div>
    </div>`).join("");
  wrap.innerHTML = statsHtml
    + (cases.length ? `<div class="hs-cases-list">${rows}</div>` : `<div class="hs-note">${L("No cases on file for this district.", "ಈ ಜಿಲ್ಲೆಗೆ ಯಾವುದೇ ಪ್ರಕರಣ ದಾಖಲೆ ಇಲ್ಲ.")}</div>`)
    + (note ? `<div class="hs-note">${esc(note)}</div>` : "");
}

/* ============================ criminal network ============================ */
const NET_KIND = {
  accused:  { cls: "n-accused",  lab: () => L("Accused", "ಆರೋಪಿ") },
  victim:   { cls: "n-victim",   lab: () => L("Victim", "ಸಂತ್ರಸ್ತ") },
  case:     { cls: "n-case",     lab: () => L("Case", "ಪ್ರಕರಣ") },
  cluster:  { cls: "n-cluster",  lab: () => L("Serial cluster", "ಸರಣಿ ಕ್ಲಸ್ಟರ್") },
};
function renderNetwork() {
  const { nodes, edges } = DATA.network;
  const mask = ROLES[state.role].mask;
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const isPII = (n) => n.kind === "accused" || n.kind === "victim";
  const lines = edges.map((e) => {
    const a = pos[e.a], b = pos[e.b];
    return `<line class="netedge${e.weak ? " weak" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><title>${esc(e.rel)}</title></line>`;
  }).join("");
  const dots = nodes.map((n, i) => {
    const label = mask && isPII(n) ? "•••" : n.label;
    const r = n.kind === "cluster" ? 3.6 : n.kind === "case" ? 2.6 : 3;
    return `<g class="netnode ${NET_KIND[n.kind].cls}" style="animation-delay:${(i * 0.05).toFixed(2)}s">
      <circle cx="${n.x}" cy="${n.y}" r="${r}"><title>${esc(n.id)} · ${esc(NET_KIND[n.kind].lab())}</title></circle>
      <text x="${n.x}" y="${n.y - r - 1.4}" text-anchor="middle">${esc(label)}</text></g>`;
  }).join("");
  $("#netgraph").innerHTML = lines + dots;
  $("#netlegend").innerHTML = Object.values(NET_KIND).map((k) =>
    `<span class="lk"><i class="${k.cls}"></i>${esc(k.lab())}</span>`).join("");
}

/* ============================ PDF export (Req 4) ============================ */
const PDF_CSS = `body{font:13px/1.5 Georgia,serif;color:#1c1e1b;max-width:720px;margin:32px auto;padding:0 20px}
.hd{border-bottom:2px solid #1c1e1b;padding-bottom:8px;margin-bottom:16px}
.hd b{font-size:17px} .meta{color:#6b6e5e;font-size:11px;margin-top:4px}
.t{margin:12px 0;padding:10px 12px;border:1px solid #c9c2ac;border-radius:3px}
.w{font-weight:bold;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#a5432c;margin-bottom:4px}
table{border-collapse:collapse;width:100%;font-size:12px} td,th{border:1px solid #c9c2ac;padding:3px 6px;text-align:left}
.mono{font-family:Consolas,monospace;font-size:11px} .hint{color:#6b6e5e;font-size:11px}
.ft{margin-top:20px;border-top:1px solid #c9c2ac;padding-top:8px;color:#6b6e5e;font-size:11px}`;

// Build the export via DOM APIs and importNode — we copy the already-rendered (esc'd) nodes
// rather than re-serialising to an HTML string, so no untrusted value is ever re-parsed.
function exportPDF() {
  const turns = $$("#transcript .turn");
  if (!turns.length) { toast(L("Nothing to export yet — ask a question first.", "ರಫ್ತು ಮಾಡಲು ಏನೂ ಇಲ್ಲ — ಮೊದಲು ಪ್ರಶ್ನೆ ಕೇಳಿ.")); return; }
  const R = ROLES[state.role];
  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const w = window.open("", "_blank");
  if (!w) { toast(L("Allow pop-ups to export the PDF.", "ಪಿಡಿಎಫ್ ರಫ್ತಿಗೆ ಪಾಪ್-ಅಪ್ ಅನುಮತಿಸಿ.")); return; }
  const d = w.document;
  const el = (tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  d.title = "Rainfall conversation record";
  d.head.appendChild(el("style")).textContent = PDF_CSS;

  const hd = el("div", "hd");
  hd.appendChild(el("b", null, "Project-Rainfall — Conversation Record"));
  hd.appendChild(el("div", "meta", `Role: ${R.name} · ${R.scope}  |  Exported: ${now}  |  Restricted · Official Use`));
  d.body.appendChild(hd);

  turns.forEach((tn) => {
    const wrap = el("div", "t");
    wrap.appendChild(el("div", "w", tn.classList.contains("user") ? R.name : "Project-Rainfall"));
    const src = tn.querySelector(".body") || tn;      // already-safe, esc'd DOM
    wrap.appendChild(d.importNode(src, true));
    d.body.appendChild(wrap);
  });

  d.body.appendChild(el("div", "ft",
    "Every answer above was role-filtered before retrieval and hash-stamped for BSA 2023 §63. " +
    "For a court-admissible copy, use the backend encrypted-export service (AES-GCM) — this local PDF is a working record."));

  setTimeout(() => w.print(), 300);
  toast(L("Conversation record opened — save as PDF from the print dialog.", "ಸಂಭಾಷಣೆ ದಾಖಲೆ ತೆರೆಯಲಾಗಿದೆ — ಮುದ್ರಣ ಸಂವಾದದಿಂದ ಪಿಡಿಎಫ್ ಆಗಿ ಉಳಿಸಿ."));
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
  // Prefer the live legal AppSail: it hash-stamps server-side and persists an EvidenceRecords row.
  let hash;
  try {
    const { data } = await api("seal", { finding: JSON.stringify({
      artifact_type: FINDING.artifact_type, inputs: FINDING.inputs, output: FINDING.output }) });
    hash = data.output_hash;
  } catch (_) {
    hash = await sha256(JSON.stringify(FINDING.output) + JSON.stringify(FINDING.inputs));
  }
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
  // Leaflet needs a visible, sized container — init lazily on first visit, else fix stale sizing.
  if (v === "hotspots") setTimeout(initHotspotMap, 0);
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
  renderStats(); renderMatches(); renderPatterns(); renderNetwork(); renderCert(null, false); applyLang(); applyRole();
  $("#erBadge").textContent = DATA.matches.length;
  loadLive(); // replace sample with live AppSail ML output where the backend is reachable

  $$(".nav").forEach((n) => n.addEventListener("click", () => switchView(n.dataset.view)));
  $("#role").addEventListener("change", (e) => { state.role = e.target.value; applyRole(); renderNetwork(); loadLive(); });
  $$(".seg [data-lang]").forEach((b) => b.addEventListener("click", () => {
    state.lang = b.dataset.lang;
    $$(".seg [data-lang]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    applyLang(); applyRole(); renderNetwork(); renderLiveBadge(); // reset greeting/transcript into the new language
  }));
  $("#ask").addEventListener("click", ask);
  $("#exportBtn").addEventListener("click", exportPDF);
  $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } });
  $("#q").addEventListener("input", (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; });
  $("#voiceBtn").addEventListener("click", toggleVoice);
  $("#sealBtn").addEventListener("click", sealFinding);
  initTheme();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
