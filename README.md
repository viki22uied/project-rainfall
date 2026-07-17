# Project-Rainfall

**Natural-language crime-intelligence platform for the Karnataka State Police** — built for KSP Datathon 2026 (Challenge 01). A reasoning layer *over* CCTNS/ICJS crime data, not a replacement: ask questions in natural language, resolve identities across messy records, surface serial-offender patterns, and produce **court-admissible** AI evidence.

Backend runs entirely on **Zoho Catalyst** (Functions, Data Store, Auth, API Gateway, AppSail).

---

## What it does

Every query is **role-filtered before it reaches any AI/LLM call** and **logged to an immutable, hash-chained audit trail**. On top of that foundation sit three differentiators — the narrative arc is *find the person → find the pattern → make it legally usable*:

| # | Differentiator | What it does | Measured result |
|---|---|---|---|
| 1 | **Entity Resolution** | Matches the same person across inconsistent records (spelling, transliteration, OCR, initials) — no unique ID exists in Indian police data. Confidence-scored; **no silent auto-merge**, a human confirms. | pairwise **F1 0.76**; **entity recall 1.00** after confirmation + transitive closure |
| 2 | **MO Clustering** | Links **unsolved** cases by behavioral signature (entry method, weapon, target, time, geographic spread) — no named suspect needed. | **F1 0.98**; recovers all 3 hidden serial patterns, each cross-jurisdiction |
| 3 | **Court-Admissible Evidence Chain** | Hash-stamps every AI output at generation and auto-drafts a **BSA 2023 Section 63** electronic-evidence certificate (SHA-256 + chain of custody + dual sign-off). | tamper-evident, verifiable |

Supporting features: offender **risk scoring** (explainable factors), crime **forecasting / early warning**, **socio-demographic** correlation, investigator **decision support** (similar-case lookup), **explainability** envelopes on every output, and **encrypted conversation export**.

---

## Roles & access (foundation layer)

| Role | Access |
|---|---|
| Investigator | Full detail, **own station only** |
| Analyst | Cross-case patterns, **PII masked** unless elevated |
| Supervisor | Full **district** access, approves PII elevation |
| Policymaker | **State aggregates only** — never individual PII |

Enforced by the Node gateway (`functions/rainfall-node-api`), verified live against Catalyst data. Identity is trusted only from Catalyst Auth in production (the local `actor_email` override is gated behind a server-side flag).

---

## Architecture

```
functions/rainfall-node-api/   Node.js — RBAC filter + immutable (hash-chained) audit gateway
appsail/entity-resolution/     Python — Entity Resolution (differentiator 1)
appsail/mo-clustering/         Python — MO / serial-pattern clustering (differentiator 2)
appsail/legal/                 Python — BSA S.63 evidence, escalation, explainability, export (differentiator 3)
appsail/analytics/             Python — risk scoring, forecasting, socio-demographic, decision support
tools/data-prep/               Node.js — transforms the source CSVs into load-ready Data Store tables
docs/                          PRD + Phase-1 schema spec
data/import/                   generated import CSVs (git-ignored)
```

**Data Store**: 11 tables (Districts, Stations, Users, Cases, Persons, CasePersons, AuditLog, EntityMatches, MoClusters, EvalGroundTruth, EvidenceRecords). The `_GROUND_TRUTH` answer keys live in the held-out `EvalGroundTruth` table, which **no user role can read** — so accuracy is measured honestly and the ML never "cheats". `AuditLog` is append-only (Insert+Select; Update/Delete revoked) plus hash-chained for tamper-evidence even against admin scope.

---

## Running it

**Tests (40 across 6 suites, all passing):**
```bash
# Node
cd functions/rainfall-node-api && node --test
cd tools/data-prep && npm test
# Python (3.9+, no third-party deps for the logic/tests)
cd appsail/entity-resolution && python -m unittest discover -s tests
cd appsail/mo-clustering    && python -m unittest discover -s tests
cd appsail/analytics        && python -m unittest discover -s tests
cd appsail/legal            && python -m unittest discover -s tests
```

**Accuracy against the real data (no deploy needed):**
```bash
cd appsail/entity-resolution && python eval_local.py   # ER F1 0.76 / entity recall 1.00
cd appsail/mo-clustering     && python eval_local.py   # MO F1 0.98
cd appsail/analytics         && python demo_local.py    # risk / forecast / socio / decision support
```

**Load the Data Store** (tables created in the Catalyst console first — see `docs/superpowers/specs/`):
```bash
cd tools/data-prep && npm install && npm run build      # emits data/import/*.csv
catalyst ds:import data/import/<table>.csv --table <Table> --dc in
```

---

## Scope boundaries (honest by design — PRD §5)

| Layer | Status |
|---|---|
| FIR/case retrieval, hotspots, network graph, RBAC, audit | Real logic |
| Entity resolution, MO clustering, evidence-chain hashing | Real logic — the core IP |
| Bank / financial transaction linkage | **Simulated** — FIU-IND/PMLA gated; emits a structured request object, never a live query |
| NATGRID cross-agency lookup | **Simulated escalation** — SP-rank+ gated; refuses below rank |

## Known blocker

The AppSail Python services deploy successfully but the container returns `Execution failed — check startup command or port`, reproducible even with a minimal bare-Flask app matching Catalyst's own guide. Bisected to a platform/console-side issue (not the code or dependencies). The ML logic is fully validated locally via the `eval_local.py` scripts. See `appsail/DEPLOY_NOTES.md`.

---

## License

MIT — see [LICENSE](LICENSE).
