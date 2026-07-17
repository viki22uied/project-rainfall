# Project-Rainfall — Roadmap

## Phase 1 — Foundation & Retrieval ✅
Data Store schema + load (11 tables, verified), RBAC filter + immutable hash-chained audit log
(Node function, tested + verified live), append-only AuditLog & held-out EvalGroundTruth permissions.

## Phase 2 — Intelligence (core IP) ✅
- **Entity Resolution** — `appsail/entity-resolution/` — F1 0.76, entity recall 1.00 after confirmation.
- **MO clustering** — `appsail/mo-clustering/` — F1 0.98, all 3 serial patterns recovered.
- **Analytics** — `appsail/analytics/` — offender risk scoring, forecasting/early-warning,
  socio-demographic correlation, decision support / similar-case lookup.

## Phase 3 — Legal weight & scope-honesty ✅
`appsail/legal/` — BSA 2023 §63 evidence chain (hash-stamp + certificate), explainability envelopes,
encrypted conversation export, mocked FIU-IND / NATGRID escalation (rank-gated, simulated).

---

**Status:** all three phases built; 40 tests pass; ML validated locally against the real data.
Open item: AppSail Python deployment (platform blocker — see `appsail/DEPLOY_NOTES.md`).
UI / chatbot / voice / Slate frontend are the next build.
