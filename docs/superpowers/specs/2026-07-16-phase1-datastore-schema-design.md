# Phase 1 — Data Store Schema Design

**Project:** Project-Rainfall (KSP Datathon 2026, Challenge 01)
**Date:** 2026-07-16
**Status:** Approved — ready for implementation planning
**Scope:** Data Store schema only. RBAC/audit *enforcement logic*, retrieval APIs, chatbot, and the ER/MO algorithms are later slices; this spec defines the tables they all read and write.

---

## 1. Purpose & context

The Data Store is the spine of the platform: every other module (RBAC filter, audit log, base retrieval, entity resolution, MO clustering, evidence chain) reads or writes it. It is the one component Catalyst's CLI cannot scaffold — tables are created on the console / via the Admin SDK.

This schema is designed **against the actual datasets** in the repo root, not from the PRD alone:

| File | Rows | What it is |
|---|---|---|
| `cases_synthetic.csv` | 135 | MO-clustering set. Behavioral-signature columns + `hidden_serial_cluster_GROUND_TRUTH`. 3 real serial clusters hidden among 120 noise cases. |
| `persons_synthetic.csv` | 67 | Entity-resolution set. `name_as_recorded` variants (spacing, initials, ALLCAPS, concatenated) + `canonical_id_GROUND_TRUTH`. |
| `karnataka_district_crime_2022_real.csv` | 39 | **Real** IPC/SLL aggregate stats per district. Policymaker / hotspot baseline. |

### Three facts the data imposes on the schema
1. **`_GROUND_TRUTH` columns are answer keys, not data.** They move to a held-out `EvalGroundTruth` table that the RBAC/query/LLM layer can never read. Exposing them would make ER/MO "cheat."
2. **`father_name`, `approx_age`, `district` are noisy for the same person** (e.g. `CID-1001` carries two different father names and ages). Schema keeps them; ER logic must distrust them and lean on name phonetics.
3. **No case↔person link exists in the raw data.** The two synthetic files are standalone. Base retrieval and the network graph need the relationship, so a `CasePersons` link table is **synthesized** (decision approved by user): persons assigned to cases as accused/victim/witness, structurally realistic.

---

## 2. Platform notes (Catalyst Data Store)

- Every table auto-includes `ROWID` (bigint PK), `CREATEDTIME`, `MODIFIEDTIME`, `CREATORID`. Columns below are **app columns only**.
- Column types available: varchar, int, bigint, boolean, date, datetime, **Encrypted text** (max 10,000 chars), and foreign-key columns.
- **Business keys** (`case_id`, `person_id`, `station_code`, …) are kept alongside `ROWID` because the source data already has them and they read cleaner in demos (`C-5001` vs a 17-digit ROWID). Foreign keys reference business keys via unique-constrained columns.
- **Per-table permissions**: independent Select / Insert / Update / Delete flags per Catalyst user role. Used to enforce append-only on `AuditLog`.

### Immutability model for AuditLog (defense in depth)
Table-level permissions bind **user/client scope** only; a backend Function on **admin scope is not documented to be constrained** by them. So immutability is enforced two ways:
1. **Platform ACL** — `AuditLog` grants **Insert + Select only; Update and Delete revoked for every role.** Blocks the entire user-facing path.
2. **Hash-chain** — each row stores `seq`, `prev_hash`, and `row_hash = SHA256(prev_hash + canonical_json(payload))`. Any post-hoc update/delete breaks the chain and is provable by re-walking it. This is admin-scope-proof and reuses the exact hashing primitive Feature 3 (BSA 2023 §63 evidence chain) requires.

An external object-lock/write-once store is the only stronger option and is deliberately out of scope (YAGNI for the datathon). The hash-chain is the court-facing artifact.

---

## 3. Tables

Legend: `→X` = foreign key to table X (by business key). `enc` = Encrypted text. `comp` = computed at load. `null` = nullable.

### Phase 1 — Foundation

**`Districts`** — reference + policymaker aggregate (from the real CSV)
| Column | Type | Notes |
|---|---|---|
| `district_name` | varchar, unique | |
| `ipc_cases` | int | |
| `sll_cases` | int | |
| `total_cases` | int | |
| `source_year` | int | = 2022 — snapshot marker |
| `updated_from_source` | date | when the snapshot was loaded; dashboard must label as snapshot, never imply live |

**`Stations`** — derived from distinct (station, district) in `cases_synthetic`; RBAC ownership anchor
| Column | Type | Notes |
|---|---|---|
| `station_code` | varchar, unique | synthesized code |
| `station_name` | varchar | |
| `district_name` | →Districts | |

**`Users`** — app-side role mapping; identity comes from Catalyst Auth
| Column | Type | Notes |
|---|---|---|
| `auth_email` | varchar, unique | matches Catalyst Auth user |
| `full_name` | varchar | |
| `role` | varchar | investigator │ analyst │ supervisor │ policymaker |
| `station_code` | →Stations, null | scope for investigators |
| `district_name` | →Districts, null | scope for supervisors |
| `rank` | varchar | |
| `is_active` | boolean | RBAC filter checks this **before** role |
| `revoked_at` | datetime, null | transfer/suspension timestamp |

**`Cases`** — MO set, ground-truth column stripped
| Column | Type | Notes |
|---|---|---|
| `case_id` | varchar, unique | e.g. `C-5001` |
| `fir_number` | varchar | e.g. `FIR/2025/381` |
| `district_name` | →Districts | |
| `station_code` | →Stations | |
| `incident_date` | date | |
| `crime_type` | varchar | Burglary, Chain Snatching, … |
| `entry_method` | varchar | behavioral signature |
| `weapon` | varchar | behavioral signature |
| `target_type` | varchar | behavioral signature |
| `time_band` | varchar | behavioral signature |
| `status` | varchar | Solved │ Under Investigation │ Unsolved |

**`Persons`** — ER set, ground-truth column stripped
| Column | Type | Notes |
|---|---|---|
| `person_id` | varchar, unique | e.g. `P-1001` |
| `name_as_recorded` | enc | PII |
| `name_normalized` | varchar, comp | lowercased/de-spaced/de-initialed for matching |
| `phonetic_key` | varchar, comp | Metaphone key; the ER index |
| `father_name` | enc | PII; noisy — ER distrusts |
| `approx_age` | int | noisy — ER distrusts |
| `district_name` | →Districts | noisy — ER distrusts |
| `role_recorded` | varchar | accused │ victim │ witness |
| `source_record` | varchar | CCTNS FIR entry / Charge sheet OCR scan / e-Prisons intake / Station diary manual entry |

**`CasePersons`** — synthesized link; enables retrieval + network graph
| Column | Type | Notes |
|---|---|---|
| `case_id` | →Cases | |
| `person_id` | →Persons | |
| `role_in_case` | varchar | accused │ victim │ witness |
| `link_source` | varchar | direct_fir │ er_inferred |
| `match_ref` | →EntityMatches, null | set only when `link_source = er_inferred` |
| `link_confidence` | int, null | set only when inferred |

`link_source = er_inferred` rows cannot be produced at data-prep time — `EntityMatches`
doesn't exist yet when `CasePersons` is first seeded (§4 below). They are created live by
the ER AppSail's `POST /confirm` (`appsail/entity-resolution/catalyst_io.py:confirm_match`),
called when an analyst/supervisor confirms a candidate match in the Entity Resolution panel
(Node gateway action `confirm_match`, RBAC-restricted like the other identity-level ML).
Confirming person A ↔ person B copies each identity's existing `CasePersons` rows onto the
other (skipping cases where a link already exists), tagging the new rows `er_inferred` with
`match_ref` = the deciding `EntityMatches` row and `link_confidence` = the match confidence
— so every inferred link is citable back to the decision that justified it, and the merged
identity's case history becomes visible from either original record (feeds the network graph,
Requirement #6). Rejecting a match updates `EntityMatches.status` only; no `CasePersons` rows
are added.

**`AuditLog`** — append-only (Insert+Select perms only) + hash-chained
| Column | Type | Notes |
|---|---|---|
| `seq` | bigint | monotonic sequence |
| `actor_email` | varchar | |
| `actor_role` | varchar | |
| `ts` | datetime | |
| `action` | varchar | |
| `query_text` | enc | may contain PII |
| `case_ids` | varchar (json) | ids touched |
| `person_ids` | varchar (json) | ids touched |
| `decision` | varchar | allowed │ denied │ masked |
| `reason` | varchar | |
| `prev_hash` | varchar | hash of previous row |
| `row_hash` | varchar | SHA256(prev_hash + canonical_json(payload)) |

### Phase 2 — designed now, populated later

**`EntityMatches`** — ER output; no silent merge, human confirms
| Column | Type | Notes |
|---|---|---|
| `person_a` | →Persons | |
| `person_b` | →Persons | |
| `confidence` | int | 0–100 |
| `method` | varchar | phonetic │ fuzzy │ composite |
| `status` | varchar | pending │ confirmed │ rejected |
| `decided_by` | varchar, null | analyst/supervisor email |
| `decided_at` | datetime, null | |
| `case_ids` | varchar (json), null | cases this match touches |
| `evidence_ref` | →EvidenceRecords, null | citation hook for the evidence chain |

**`MoClusters`** — MO output
| Column | Type | Notes |
|---|---|---|
| `cluster_label` | varchar | e.g. `SERIAL-1` (system-assigned, not the ground-truth label) |
| `signature` | varchar (json) | shared entry_method/weapon/target/time |
| `case_ids` | varchar (json) | member cases |
| `score` | int | cluster cohesion |
| `created_at` | datetime | |
| `evidence_ref` | →EvidenceRecords, null | citation hook (symmetry with EntityMatches) |

### Held-out — query/RBAC/LLM layer can NEVER read this

**`EvalGroundTruth`** — loaded from the `_GROUND_TRUTH` columns; offline scoring only
| Column | Type | Notes |
|---|---|---|
| `entity_type` | varchar | person │ case |
| `biz_id` | varchar | `person_id` or `case_id` |
| `truth_key` | varchar | `canonical_id` (persons) or `serial_cluster` (cases) |

Access control: no user role gets Select on this table; only an offline scoring job (dedicated function/service) reads it.

### Referenced but specified in a later phase

**`EvidenceRecords`** (Phase 3) — target of `evidence_ref` FKs above. Full spec deferred to the Phase 3 evidence-chain slice; created as a stub table now (columns: `artifact_type`, `artifact_ref`, `input_hash`, `output_hash`, `reasoning_trail`, `generated_at`, `cert_status`) so Phase 2 FKs resolve.

---

## 4. Load plan (data → tables)

1. **`Districts`** ← `karnataka_district_crime_2022_real.csv` direct; set `source_year = 2022`, `updated_from_source = load date`.
2. **`Stations`** ← distinct (`station`,`district`) from `cases_synthetic.csv`; synthesize `station_code`.
3. **`Cases`** ← `cases_synthetic.csv` minus `hidden_serial_cluster_GROUND_TRUTH`.
4. **`Persons`** ← `persons_synthetic.csv` minus `canonical_id_GROUND_TRUTH`; compute `name_normalized`, `phonetic_key` at load.
5. **`CasePersons`** ← synthesized: assign each person to ≥1 case with a `role_in_case`; all seeded rows `link_source = direct_fir` (er_inferred rows appear later when ER runs).
6. **`EvalGroundTruth`** ← the two `_GROUND_TRUTH` columns, keyed by `biz_id`.
7. **`Users`** ← seed 4 demo officers, one per role, with realistic station/district scoping + `is_active = true`.
8. `EntityMatches`, `MoClusters`, `EvidenceRecords` ← created empty.

---

## 5. Out of scope for this spec
- RBAC enforcement logic, audit-write logic, retrieval APIs (next slices).
- The ER and MO algorithms themselves (Phase 2).
- Evidence-record generation and BSA §63 certificate drafting (Phase 3).
- Object-lock external write-once store (deliberate YAGNI).

## 6. Success criteria
- All 11 tables exist on Catalyst Data Store with the columns above and correct types.
- `AuditLog` and `EvalGroundTruth` have their restrictive permissions set and verified (attempt an update on `AuditLog` as a non-privileged role → denied).
- All five CSVs' worth of data loaded; row counts match source (Districts 39, Cases 135, Persons 67) and `CasePersons` non-empty.
- `phonetic_key` populated for every person; a spot-check groups an obvious variant pair (`Girish Shetty` / `GirishShetty`) under the same key.
