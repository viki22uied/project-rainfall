# Project-Rainfall
## Product Requirements Document
**KSP Datathon 2026 — Challenge 01: Intelligent Conversational AI for KSP Crime Database**

---

## 1. Problem Statement

The State Crime Records Bureau (SCRB) manages crime data from 1,100+ police stations across Karnataka, currently trapped in manual, Excel-based, siloed workflows. Investigators cannot easily query across stations, cannot detect hidden links between cases, and cannot act proactively. Existing systems (CCTNS, ICJS) digitize records but don't reason over them.

Project-Rainfall is a natural-language crime intelligence platform built as a smart layer over CCTNS/ICJS data — not a replacement for them.

---

## 2. Must-Have Requirements (from hackathon brief — non-negotiable)

| # | Requirement | Notes |
|---|---|---|
| 1 | Natural language chatbot — English + Kannada | Core interface |
| 2 | Voice interaction (Q&A) | Input + output |
| 3 | Context-aware, follow-up queries | No repeating context |
| 4 | Save conversation history as PDF (local) | Encrypted export |
| 5 | Retrieve FIR, accused, victim, location, case status | Base retrieval layer |
| 6 | Criminal network & relationship visualization | Node-based graph |
| 7 | Repeat offender / MO tracking | Cross-jurisdiction |
| 8 | Crime hotspot & trend detection | Spatiotemporal |
| 9 | Socio-demographic crime correlation | Age, gender, urbanization overlays |
| 10 | Offender risk scoring | Behavioral profiling |
| 11 | Investigator decision support | Case summaries, similar-case lookup |
| 12 | Financial crime / transaction link analysis | **Mocked** — real access is FIU-IND/PMLA gated, see §5 |
| 13 | Crime forecasting / early warning | AI-driven trend alerts |
| 14 | Explainable AI — evidence trails for every answer | Foundational, not a feature |
| 15 | Role-based secure access + audit logs | Foundational, not a feature |

**Security and governance (RBAC, audit logging, data localization) are treated as system foundations built alongside every feature — not a checklist item added at the end.**

---

## 3. Our Differentiators (the 3 features)

### 3.1 Entity Resolution Engine
Matches the same person across inconsistent records (spelling variants, transliteration, OCR errors — "Shubham Kumar Singh" vs "Shubham K Singh" vs OCR-mangled text). No unique ID exists across Indian police records by design. Fuzzy/phonetic matching with confidence scoring; no silent auto-merge — human (analyst/supervisor) confirms ambiguous matches, logged.

### 3.2 Case Linkage Analysis (Modus Operandi clustering)
Links **unsolved** cases to each other by behavioral signature (entry method, time, target type, weapon, escape pattern, geographic spread) — without needing a named suspect. Surfaces likely serial-offender patterns. This is currently a manual process run by BPR&D's Modus Operandi Bureau; we automate it at state/district scale.

### 3.3 Court-Admissible AI Evidence Chain
Every AI-generated output (a match, a cluster, a risk score) is hash-stamped at the moment of generation, with a full reasoning trail logged, and auto-drafts a **BSA 2023 Section 63** electronic evidence certificate (hash value + chain of custody + dual sign-off format) — the actual legal standard Indian courts now require for electronic evidence to be admissible. Without this, every other AI output in this space is a suggestion, not usable evidence.

**Narrative arc for judges:** find the person → find the pattern → make it legally usable.

---

## 4. Roles & Access (foundation layer)

| Role | Access |
|---|---|
| Investigator | Full detail, own assigned cases/station only |
| Analyst | Cross-case patterns, network graphs — PII masked unless elevated |
| Supervisor | Full district access, approves analyst PII-access requests |
| Policymaker | State-wide aggregate stats only — no individual PII, ever |

Every query is filtered by role **before** it reaches any AI/LLM call. Every query is logged (who, what, when, which case IDs) in an immutable audit trail.

---

## 5. Explicit Scope Boundaries (be upfront with judges)

| Layer | Status |
|---|---|
| FIR/case data, hotspots, network graph, chatbot, Kannada, voice | Fully built, real logic |
| Entity resolution, MO clustering, evidence-chain hashing | Fully built — our core IP |
| RBAC, audit log, data localization | Fully built |
| Bank/financial transaction linkage | **Simulated.** Real access is legally gated to FIU-IND under PMLA — we generate a structured request object, not a live query |
| NATGRID-style cross-agency lookup | **Simulated as an escalation workflow** — access is restricted to SP-rank+ officers by design; we don't fake having it |

---

## 6. Design Direction

**Tone:** a serious government intelligence tool — precise, calm, authoritative. Not a startup dashboard. Not a generic "AI product" look (no purple-blue gradients, no glassmorphism, no glowing chat bubbles, no stock-AI sparkle icons).

**Color palette** (no blue, no purple):

| Role | Color | Hex (approx) | Use |
|---|---|---|---|
| Base ink | Charcoal | `#1C1E1B` | Primary text, headers, nav |
| Paper | Warm off-white | `#F4F0E6` | Backgrounds |
| Primary accent | Deep amber / ochre | `#C88A1E` | Actions, highlights, active states |
| Secondary accent | Rust / terracotta | `#A5432C` | Alerts, high-severity flags |
| Structure | Muted olive-grey | `#6B6E5E` | Borders, secondary text, dividers |
| Success/verified | Deep forest green | `#3C5B41` | Confirmed matches, verified evidence |

This reads as archival/institutional (think ledger paper, seals, official stamps) rather than "tech product" — appropriate for a document that may end up in court.

**Motion:** restrained, purposeful, never decorative.
- Network graph nodes settle into place with physics-based easing, not bouncy spring animation
- Hotspot map pulses are slow and deliberate (signal, not decoration)
- Evidence-chain hash generation shows a brief, real-feeling "sealing" animation (like a stamp/lock closing) — reinforces the legal-weight framing
- No skeleton-loading shimmer clichés, no confetti, no gradient-shift backgrounds
- Typography does the heavy lifting: a serious serif or slab-serif for headers (institutional feel), clean sans-serif for data/UI text

**Explicitly avoid:** rounded bubbly chat UI, generic robot/sparkle icons, blue-to-purple gradients, glowing neon borders, anything that visually says "AI startup landing page" instead of "government intelligence system."

---

## 7. Tech Stack

- **Backend:** Zoho Catalyst (mandatory) — Functions (Node.js for auth/RBAC/routing, Python/AppSail for ML), Data Store, Auth, API Gateway
- **Frontend:** hosted on Catalyst Slate, framework TBD
- **Build tooling:** Claude Code
- **ML:** entity resolution + MO clustering run as custom Python in AppSail (not Zia/QuickML — too custom for no-code tooling)

---

## 8. Open for Next Session
- Data Store schema (tables, fields, relationships)
- Detailed feature specs per module
- Demo script / judging-round flow
