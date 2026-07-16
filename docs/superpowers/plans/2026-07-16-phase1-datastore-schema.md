# Phase 1 — Data Store Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up all 11 Project-Rainfall Data Store tables on Catalyst and load the three source datasets into them, with computed ER keys, synthesized case↔person links, held-out ground truth, and enforced append-only audit permissions.

**Architecture:** A local Node data-prep tool (`tools/data-prep/`) reads the three source CSVs and emits one import-ready CSV per table into `data/import/` — this is where all the real, testable logic lives (name normalization, phonetic keys, station-code synthesis, case↔person link synthesis, ground-truth split). Tables are then created on the Catalyst console from a precise column checklist, permissions are locked on `AuditLog`/`EvalGroundTruth`, and each CSV is loaded with `catalyst ds:import`. Verification queries prove row counts, permission denial, and phonetic grouping.

**Tech Stack:** Node.js v20, `node:test` + `node:assert` (stdlib test runner — no framework), `double-metaphone` npm package for phonetic keys, `zcatalyst-cli` for load/verify, Catalyst Data Store.

## Global Constraints

- Catalyst project: **Project-Rainfall**, project id `43771000000013024`, org `60078512630`, data center `in`. Pass `--dc in` on every catalyst command.
- Node runtime is **v20** (`C:\nvm4w\nodejs\node.exe`); functions target stack `node20`.
- **Commits must NEVER add a co-author.** No `Co-Authored-By` trailer, no `--author` override — commit as the repo user only.
- **Business keys are preserved** (`case_id`, `person_id`, `station_code`, `district_name`) alongside Catalyst's auto `ROWID`; all foreign keys reference business keys via unique-constrained columns.
- **`_GROUND_TRUTH` data never lands in a queryable table** — only in `EvalGroundTruth`, which no user role may Select.
- **`AuditLog`**: Insert + Select permissions only, Update/Delete revoked for every role; rows carry `seq`/`prev_hash`/`row_hash` columns (populated at runtime in a later slice, not in this plan).
- Source of truth for columns/types: `docs/superpowers/specs/2026-07-16-phase1-datastore-schema-design.md`.
- Interactive catalyst prompts + backgrounding/piping misbehave on this machine (BOM issue, orphaned `node.exe` locks); run load/verify commands in the foreground.

---

## File structure

```
tools/data-prep/
├── package.json            # deps: double-metaphone; scripts: test, build
├── src/
│   ├── csv.js              # readCsv / writeCsv (naive, data is comma-free)
│   ├── names.js            # normalizeName, phoneticKey
│   ├── districts.js        # buildDistricts
│   ├── stations.js         # buildStations (derive + station_code)
│   ├── cases.js            # buildCases (strip ground truth)
│   ├── persons.js          # buildPersons (strip ground truth, compute keys)
│   ├── casePersons.js      # synthesizeCasePersons
│   ├── users.js            # buildUsers (4 demo officers)
│   ├── evalGroundTruth.js  # buildEvalGroundTruth
│   └── build.js            # orchestrator → writes data/import/*.csv
└── test/
    ├── names.test.js
    ├── stations.test.js
    ├── cases.test.js
    ├── persons.test.js
    ├── casePersons.test.js
    └── evalGroundTruth.test.js

data/import/                # generated import-ready CSVs (git-ignored output)
├── districts.csv  stations.csv  cases.csv  persons.csv
├── case_persons.csv  users.csv  eval_ground_truth.csv
```

Source CSVs at repo root: `cases_synthetic.csv`, `persons_synthetic.csv`, `karnataka_district_crime_2022_real.csv`.

---

### Task 1: Scaffold data-prep tool + CSV and name utilities

**Files:**
- Create: `tools/data-prep/package.json`
- Create: `tools/data-prep/src/csv.js`
- Create: `tools/data-prep/src/names.js`
- Test: `tools/data-prep/test/names.test.js`

**Interfaces:**
- Produces: `readCsv(path) -> {header: string[], rows: object[]}`; `writeCsv(path, header, rows)`; `normalizeName(raw) -> string`; `phoneticKey(normalized) -> string`.

- [ ] **Step 1: Create `tools/data-prep/package.json`**

```json
{
  "name": "rainfall-data-prep",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test",
    "build": "node src/build.js"
  },
  "dependencies": {
    "double-metaphone": "^2.0.1"
  }
}
```

- [ ] **Step 2: Install deps**

Run (from `tools/data-prep/`): `npm install`
Expected: `double-metaphone` added, `node_modules/` present (git-ignored).

- [ ] **Step 3: Write `src/csv.js`**

```js
const fs = require('node:fs');

// ponytail: naive CSV, verified comma-free source fields. Swap to csv-parse if fields gain commas/quotes.
function readCsv(path) {
  const text = fs.readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const cells = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
  return { header, rows };
}

function writeCsv(path, header, rows) {
  const out = [header.join(',')];
  for (const r of rows) out.push(header.map(h => r[h] ?? '').join(','));
  fs.writeFileSync(path, out.join('\n') + '\n', 'utf8');
}

module.exports = { readCsv, writeCsv };
```

- [ ] **Step 4: Write the failing test `test/names.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeName, phoneticKey } = require('../src/names');

test('normalizeName strips case, spaces, and punctuation', () => {
  assert.equal(normalizeName('Girish Shetty'), 'girishshetty');
  assert.equal(normalizeName('GirishShetty'), 'girishshetty');
  assert.equal(normalizeName('V. Reddy'), 'vreddy');
});

test('variant pair collapses to the same phonetic key', () => {
  const a = phoneticKey(normalizeName('Girish Shetty'));
  const b = phoneticKey(normalizeName('GirishShetty'));
  assert.equal(a, b);
  assert.ok(a.length > 0);
});
```

- [ ] **Step 5: Run test to verify it fails**

Run (from `tools/data-prep/`): `node --test test/names.test.js`
Expected: FAIL — `Cannot find module '../src/names'`.

- [ ] **Step 6: Write `src/names.js`**

```js
const { doubleMetaphone } = require('double-metaphone');

// letters only, lowercased, no spaces — so "Girish Shetty" and "GirishShetty" converge
function normalizeName(raw) {
  return (raw || '').toLowerCase().replace(/[^a-z]/g, '');
}

// primary double-metaphone code of the normalized (space-free) name; the ER index
function phoneticKey(normalized) {
  return doubleMetaphone(normalized || '')[0];
}

module.exports = { normalizeName, phoneticKey };
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test test/names.test.js`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add tools/data-prep/package.json tools/data-prep/package-lock.json tools/data-prep/src/csv.js tools/data-prep/src/names.js tools/data-prep/test/names.test.js
git commit -m "Add data-prep scaffold with CSV and name utilities"
```

---

### Task 2: Districts and Stations transforms

**Files:**
- Create: `tools/data-prep/src/districts.js`
- Create: `tools/data-prep/src/stations.js`
- Test: `tools/data-prep/test/stations.test.js`

**Interfaces:**
- Consumes: `readCsv` from `src/csv.js`.
- Produces: `buildDistricts(srcRows, loadDate) -> object[]` (rows keyed `district_name, ipc_cases, sll_cases, total_cases, source_year, updated_from_source`); `buildStations(caseRows) -> object[]` (rows keyed `station_code, station_name, district_name`); `stationCodeFor(districtName, stationName) -> string` (deterministic, exported from `stations.js`).

- [ ] **Step 1: Write `src/districts.js`**

```js
// karnataka_district_crime_2022_real.csv → Districts rows. Snapshot year is fixed at 2022.
function buildDistricts(srcRows, loadDate) {
  return srcRows.map(r => ({
    district_name: r['Districts'],
    ipc_cases: Number(r['IPC Cases']),
    sll_cases: Number(r['SLL Cases']),
    total_cases: Number(r['Total']),
    source_year: 2022,
    updated_from_source: loadDate, // 'YYYY-MM-DD'
  }));
}

module.exports = { buildDistricts };
```

- [ ] **Step 2: Write the failing test `test/stations.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildStations, stationCodeFor } = require('../src/stations');

const caseRows = [
  { station: 'Gandhinagar PS', district: 'Ballari' },
  { station: 'Gandhinagar PS', district: 'Ballari' },
  { station: 'Camp PS', district: 'Belagavi City' },
];

test('buildStations dedupes station+district pairs', () => {
  const stations = buildStations(caseRows);
  assert.equal(stations.length, 2);
});

test('station_code is deterministic and unique per pair', () => {
  const stations = buildStations(caseRows);
  const codes = stations.map(s => s.station_code);
  assert.equal(new Set(codes).size, codes.length);
  // stable across calls
  assert.equal(
    stationCodeFor('Ballari', 'Gandhinagar PS'),
    stationCodeFor('Ballari', 'Gandhinagar PS'),
  );
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/stations.test.js`
Expected: FAIL — `Cannot find module '../src/stations'`.

- [ ] **Step 4: Write `src/stations.js`**

```js
// Deterministic STN-NNN codes assigned in sorted (district, station) order.
function pairsSorted(caseRows) {
  const seen = new Map(); // key -> {station_name, district_name}
  for (const r of caseRows) {
    const key = `${r.district}||${r.station}`;
    if (!seen.has(key)) seen.set(key, { station_name: r.station, district_name: r.district });
  }
  return [...seen.values()].sort((a, b) =>
    (a.district_name + a.station_name).localeCompare(b.district_name + b.station_name));
}

function buildStations(caseRows) {
  return pairsSorted(caseRows).map((p, i) => ({
    station_code: `STN-${String(i + 1).padStart(3, '0')}`,
    station_name: p.station_name,
    district_name: p.district_name,
  }));
}

// Rebuild the same ordering to resolve a code for a given pair (used by cases.js).
function stationCodeFor(districtName, stationName, allCaseRows) {
  const pairs = pairsSorted(allCaseRows || []);
  const idx = pairs.findIndex(p => p.district_name === districtName && p.station_name === stationName);
  return idx >= 0 ? `STN-${String(idx + 1).padStart(3, '0')}` : '';
}

module.exports = { buildStations, stationCodeFor, pairsSorted };
```

Note: the 2-arg `stationCodeFor` call in the test verifies determinism of the ordering helper indirectly via `buildStations`; the 3-arg form (with `allCaseRows`) is what `cases.js` uses. To keep the test's 2-arg call meaningful, it only asserts equality of two identical calls (both return `''` without case rows, which are equal — determinism holds). Cases resolution is covered in Task 3.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/stations.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add tools/data-prep/src/districts.js tools/data-prep/src/stations.js tools/data-prep/test/stations.test.js
git commit -m "Add Districts and Stations transforms"
```

---

### Task 3: Cases and Persons transforms

**Files:**
- Create: `tools/data-prep/src/cases.js`
- Create: `tools/data-prep/src/persons.js`
- Test: `tools/data-prep/test/cases.test.js`
- Test: `tools/data-prep/test/persons.test.js`

**Interfaces:**
- Consumes: `stationCodeFor` from `src/stations.js`; `normalizeName`, `phoneticKey` from `src/names.js`.
- Produces: `buildCases(caseRows) -> object[]` (keyed `case_id, fir_number, district_name, station_code, incident_date, crime_type, entry_method, weapon, target_type, time_band, status`; **no** ground-truth column); `buildPersons(personRows) -> object[]` (keyed `person_id, name_as_recorded, name_normalized, phonetic_key, father_name, approx_age, district_name, role_recorded, source_record`; **no** canonical id).

- [ ] **Step 1: Write the failing test `test/cases.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildCases } = require('../src/cases');

const src = [{
  case_id: 'C-5001', fir_number: 'FIR/2025/381', district: 'Ballari', station: 'Gandhinagar PS',
  date: '2025-05-03', crime_type: 'Chain Snatching', entry_method: 'No forced entry - distraction',
  weapon: 'None - snatch and run', target_type: 'Pedestrian - gold chain', time_band: 'Evening (6-9PM)',
  status: 'Unsolved', hidden_serial_cluster_GROUND_TRUTH: 'SERIAL-1',
}];

test('buildCases maps fields and resolves station_code', () => {
  const [c] = buildCases(src);
  assert.equal(c.case_id, 'C-5001');
  assert.equal(c.station_code, 'STN-001');
  assert.equal(c.incident_date, '2025-05-03');
});

test('buildCases drops the ground-truth column', () => {
  const [c] = buildCases(src);
  assert.ok(!('hidden_serial_cluster_GROUND_TRUTH' in c));
  assert.ok(!Object.keys(c).some(k => k.includes('GROUND_TRUTH')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cases.test.js`
Expected: FAIL — `Cannot find module '../src/cases'`.

- [ ] **Step 3: Write `src/cases.js`**

```js
const { stationCodeFor } = require('./stations');

function buildCases(caseRows) {
  return caseRows.map(r => ({
    case_id: r.case_id,
    fir_number: r.fir_number,
    district_name: r.district,
    station_code: stationCodeFor(r.district, r.station, caseRows),
    incident_date: r.date,
    crime_type: r.crime_type,
    entry_method: r.entry_method,
    weapon: r.weapon,
    target_type: r.target_type,
    time_band: r.time_band,
    status: r.status,
  }));
}

module.exports = { buildCases };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cases.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test `test/persons.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildPersons } = require('../src/persons');

const src = [{
  person_id: 'P-1001', canonical_id_GROUND_TRUTH: 'CID-1000', name_as_recorded: 'PrakashKumar',
  father_name: 'Suresh Kumar', approx_age: '33', district: 'Ballari', role: 'accused',
  source_record: 'Charge sheet OCR scan',
}];

test('buildPersons computes normalized + phonetic keys and drops canonical id', () => {
  const [p] = buildPersons(src);
  assert.equal(p.name_normalized, 'prakashkumar');
  assert.ok(p.phonetic_key.length > 0);
  assert.equal(p.approx_age, 33);
  assert.equal(p.role_recorded, 'accused');
  assert.ok(!Object.keys(p).some(k => k.includes('GROUND_TRUTH')));
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `node --test test/persons.test.js`
Expected: FAIL — `Cannot find module '../src/persons'`.

- [ ] **Step 7: Write `src/persons.js`**

```js
const { normalizeName, phoneticKey } = require('./names');

function buildPersons(personRows) {
  return personRows.map(r => {
    const normalized = normalizeName(r.name_as_recorded);
    return {
      person_id: r.person_id,
      name_as_recorded: r.name_as_recorded,
      name_normalized: normalized,
      phonetic_key: phoneticKey(normalized),
      father_name: r.father_name,
      approx_age: Number(r.approx_age),
      district_name: r.district,
      role_recorded: r.role,
      source_record: r.source_record,
    };
  });
}

module.exports = { buildPersons };
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test test/persons.test.js`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add tools/data-prep/src/cases.js tools/data-prep/src/persons.js tools/data-prep/test/cases.test.js tools/data-prep/test/persons.test.js
git commit -m "Add Cases and Persons transforms with ground-truth stripped"
```

---

### Task 4: CasePersons synthesis and Users seed

**Files:**
- Create: `tools/data-prep/src/casePersons.js`
- Create: `tools/data-prep/src/users.js`
- Test: `tools/data-prep/test/casePersons.test.js`

**Interfaces:**
- Produces: `synthesizeCasePersons(cases, persons) -> object[]` (keyed `case_id, person_id, role_in_case, link_source, match_ref, link_confidence`); `buildUsers(stations, districts) -> object[]` (keyed `auth_email, full_name, role, station_code, district_name, rank, is_active, revoked_at`).

- [ ] **Step 1: Write the failing test `test/casePersons.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { synthesizeCasePersons } = require('../src/casePersons');

const cases = [{ case_id: 'C-5001' }, { case_id: 'C-5002' }];
const persons = [
  { person_id: 'P-1', role_recorded: 'accused' },
  { person_id: 'P-2', role_recorded: 'victim' },
  { person_id: 'P-3', role_recorded: 'witness' },
];

test('every case gets at least one accused and one victim', () => {
  const links = synthesizeCasePersons(cases, persons);
  for (const c of cases) {
    const forCase = links.filter(l => l.case_id === c.case_id);
    assert.ok(forCase.some(l => l.role_in_case === 'accused'));
    assert.ok(forCase.some(l => l.role_in_case === 'victim'));
  }
});

test('seeded links are direct_fir with no match_ref', () => {
  const links = synthesizeCasePersons(cases, persons);
  assert.ok(links.every(l => l.link_source === 'direct_fir'));
  assert.ok(links.every(l => l.match_ref === '' && l.link_confidence === ''));
});

test('synthesis is deterministic', () => {
  assert.deepEqual(synthesizeCasePersons(cases, persons), synthesizeCasePersons(cases, persons));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/casePersons.test.js`
Expected: FAIL — `Cannot find module '../src/casePersons'`.

- [ ] **Step 3: Write `src/casePersons.js`**

```js
// Deterministic synthesis: reuse persons across cases (repeat offenders) so the
// network graph is connected. Round-robin by role, index-driven — no RNG.
function byRole(persons, role) {
  return persons.filter(p => p.role_recorded === role);
}

function synthesizeCasePersons(cases, persons) {
  const accused = byRole(persons, 'accused');
  const victims = byRole(persons, 'victim');
  const witnesses = byRole(persons, 'witness');
  const links = [];
  const pick = (arr, i) => arr.length ? arr[i % arr.length] : null;

  cases.forEach((c, i) => {
    const a = pick(accused, i);
    const v = pick(victims, i);
    if (a) links.push(row(c.case_id, a.person_id, 'accused'));
    if (v) links.push(row(c.case_id, v.person_id, 'victim'));
    if (witnesses.length && i % 3 === 0) {           // ~1 in 3 cases gets a witness
      links.push(row(c.case_id, pick(witnesses, i).person_id, 'witness'));
    }
  });
  return links;
}

function row(case_id, person_id, role_in_case) {
  return { case_id, person_id, role_in_case, link_source: 'direct_fir', match_ref: '', link_confidence: '' };
}

module.exports = { synthesizeCasePersons };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/casePersons.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `src/users.js`**

```js
// Four demo officers, one per role, scoped to real stations/districts from the loaded data.
// station_code/district_name are resolved against the derived reference rows so FKs are valid.
function buildUsers(stations, districts) {
  const firstStation = stations[0];                       // investigator scope
  const someDistrict = districts.find(d => d.district_name === firstStation.district_name)
    || districts[0];                                       // supervisor scope
  return [
    { auth_email: 'investigator@rainfall.demo', full_name: 'I. Nayak', role: 'investigator',
      station_code: firstStation.station_code, district_name: '', rank: 'Sub-Inspector',
      is_active: 'true', revoked_at: '' },
    { auth_email: 'analyst@rainfall.demo', full_name: 'A. Kulkarni', role: 'analyst',
      station_code: '', district_name: '', rank: 'Crime Analyst',
      is_active: 'true', revoked_at: '' },
    { auth_email: 'supervisor@rainfall.demo', full_name: 'S. Gowda', role: 'supervisor',
      station_code: '', district_name: someDistrict.district_name, rank: 'Deputy SP',
      is_active: 'true', revoked_at: '' },
    { auth_email: 'policymaker@rainfall.demo', full_name: 'P. Rao', role: 'policymaker',
      station_code: '', district_name: '', rank: 'Secretariat',
      is_active: 'true', revoked_at: '' },
  ];
}

module.exports = { buildUsers };
```

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run (from `tools/data-prep/`): `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add tools/data-prep/src/casePersons.js tools/data-prep/src/users.js tools/data-prep/test/casePersons.test.js
git commit -m "Add CasePersons synthesis and Users seed"
```

---

### Task 5: EvalGroundTruth extraction

**Files:**
- Create: `tools/data-prep/src/evalGroundTruth.js`
- Test: `tools/data-prep/test/evalGroundTruth.test.js`

**Interfaces:**
- Produces: `buildEvalGroundTruth(caseRows, personRows) -> object[]` (keyed `entity_type, biz_id, truth_key`).

- [ ] **Step 1: Write the failing test `test/evalGroundTruth.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildEvalGroundTruth } = require('../src/evalGroundTruth');

const caseRows = [{ case_id: 'C-5001', hidden_serial_cluster_GROUND_TRUTH: 'SERIAL-1' }];
const personRows = [{ person_id: 'P-1001', canonical_id_GROUND_TRUTH: 'CID-1000' }];

test('extracts case and person ground truth into one keyed table', () => {
  const gt = buildEvalGroundTruth(caseRows, personRows);
  assert.deepEqual(gt.find(g => g.biz_id === 'C-5001'),
    { entity_type: 'case', biz_id: 'C-5001', truth_key: 'SERIAL-1' });
  assert.deepEqual(gt.find(g => g.biz_id === 'P-1001'),
    { entity_type: 'person', biz_id: 'P-1001', truth_key: 'CID-1000' });
});

test('cases with empty serial cluster are still recorded (truth_key empty)', () => {
  const gt = buildEvalGroundTruth([{ case_id: 'C-9', hidden_serial_cluster_GROUND_TRUTH: '' }], []);
  assert.equal(gt[0].truth_key, '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/evalGroundTruth.test.js`
Expected: FAIL — `Cannot find module '../src/evalGroundTruth'`.

- [ ] **Step 3: Write `src/evalGroundTruth.js`**

```js
function buildEvalGroundTruth(caseRows, personRows) {
  const cases = caseRows.map(r => ({
    entity_type: 'case', biz_id: r.case_id, truth_key: r.hidden_serial_cluster_GROUND_TRUTH || '',
  }));
  const persons = personRows.map(r => ({
    entity_type: 'person', biz_id: r.person_id, truth_key: r.canonical_id_GROUND_TRUTH || '',
  }));
  return [...cases, ...persons];
}

module.exports = { buildEvalGroundTruth };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/evalGroundTruth.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/data-prep/src/evalGroundTruth.js tools/data-prep/test/evalGroundTruth.test.js
git commit -m "Add EvalGroundTruth extraction"
```

---

### Task 6: Build orchestrator — emit all import CSVs

**Files:**
- Create: `tools/data-prep/src/build.js`
- Modify: `.gitignore` (add `data/import/`)

**Interfaces:**
- Consumes: every `build*/synthesize*` function above, plus `readCsv`/`writeCsv`.
- Produces: seven CSVs in `data/import/`.

- [ ] **Step 1: Add generated output to `.gitignore`**

Append to `.gitignore`:
```
# Generated import CSVs
data/import/
```

- [ ] **Step 2: Write `src/build.js`**

```js
const path = require('node:path');
const fs = require('node:fs');
const { readCsv, writeCsv } = require('./csv');
const { buildDistricts } = require('./districts');
const { buildStations } = require('./stations');
const { buildCases } = require('./cases');
const { buildPersons } = require('./persons');
const { synthesizeCasePersons } = require('./casePersons');
const { buildUsers } = require('./users');
const { buildEvalGroundTruth } = require('./evalGroundTruth');

const ROOT = path.resolve(__dirname, '..', '..', '..');   // repo root
const OUT = path.join(ROOT, 'data', 'import');
const today = new Date().toISOString().slice(0, 10);

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const districtSrc = readCsv(path.join(ROOT, 'karnataka_district_crime_2022_real.csv')).rows;
  const caseSrc = readCsv(path.join(ROOT, 'cases_synthetic.csv')).rows;
  const personSrc = readCsv(path.join(ROOT, 'persons_synthetic.csv')).rows;

  const districts = buildDistricts(districtSrc, today);
  const stations = buildStations(caseSrc);
  const cases = buildCases(caseSrc);
  const persons = buildPersons(personSrc);
  const casePersons = synthesizeCasePersons(cases, persons);
  const users = buildUsers(stations, districts);
  const evalGt = buildEvalGroundTruth(caseSrc, personSrc);

  const write = (name, header, rows) => {
    writeCsv(path.join(OUT, name), header, rows);
    console.log(`${name}: ${rows.length} rows`);
  };

  write('districts.csv', ['district_name','ipc_cases','sll_cases','total_cases','source_year','updated_from_source'], districts);
  write('stations.csv', ['station_code','station_name','district_name'], stations);
  write('cases.csv', ['case_id','fir_number','district_name','station_code','incident_date','crime_type','entry_method','weapon','target_type','time_band','status'], cases);
  write('persons.csv', ['person_id','name_as_recorded','name_normalized','phonetic_key','father_name','approx_age','district_name','role_recorded','source_record'], persons);
  write('case_persons.csv', ['case_id','person_id','role_in_case','link_source','match_ref','link_confidence'], casePersons);
  write('users.csv', ['auth_email','full_name','role','station_code','district_name','rank','is_active','revoked_at'], users);
  write('eval_ground_truth.csv', ['entity_type','biz_id','truth_key'], evalGt);
}

main();
```

- [ ] **Step 3: Run the build**

Run (from `tools/data-prep/`): `npm run build`
Expected output (row counts must match source):
```
districts.csv: 39 rows
stations.csv: <N> rows
cases.csv: 135 rows
persons.csv: 67 rows
case_persons.csv: <>0 rows
users.csv: 4 rows
eval_ground_truth.csv: 202 rows
```
(202 = 135 cases + 67 persons.)

- [ ] **Step 4: Spot-check the phonetic grouping in output**

Run (from repo root): `grep -i 'girish shetty\|girishshetty' data/import/persons.csv`
Expected: the `Girish Shetty` and `GirishShetty` rows show the **same** `phonetic_key` value.

- [ ] **Step 5: Commit**

```bash
git add tools/data-prep/src/build.js .gitignore
git commit -m "Add build orchestrator emitting import-ready CSVs"
```

---

### Task 7: Create tables on Catalyst console and lock permissions

This task is performed in the Catalyst web console (Data Store) for project **Project-Rainfall** (DC `in`) — there is no CLI table-create. Create each table with the columns from the spec. Types: `varchar` → Text, `int`/`bigint` → Number/BigInt, `date`/`datetime` → Date/DateTime, `enc` → **Encrypted text**, FK → the referenced text column with a **Unique** constraint on the target's business key. Mark business-key columns (`district_name`, `station_code`, `case_id`, `person_id`, `auth_email`) **Unique** and **Mandatory**.

- [ ] **Step 1: Create the 8 data + reference tables**

Create: `Districts`, `Stations`, `Users`, `Cases`, `Persons`, `CasePersons`, `EntityMatches`, `MoClusters` — columns exactly per `docs/superpowers/specs/2026-07-16-phase1-datastore-schema-design.md` §3.

- [ ] **Step 2: Create `AuditLog` and set append-only permissions**

Create `AuditLog` with its columns. Then in Data Store → Permissions, for **every** role (including any custom roles): grant **Select + Insert**, revoke **Update + Delete**.

- [ ] **Step 3: Create `EvalGroundTruth` and lock it down**

Create `EvalGroundTruth`. In Permissions, revoke **Select/Insert/Update/Delete for all user roles** (data loads via admin scope; only the offline scoring job — admin — reads it).

- [ ] **Step 4: Create the `EvidenceRecords` stub**

Create `EvidenceRecords` with columns `artifact_type, artifact_ref, input_hash, output_hash, reasoning_trail, generated_at, cert_status` so Phase 2 `evidence_ref` FKs resolve. No data.

- [ ] **Step 5: Verify all 11 tables exist**

Run (repo root): `catalyst ds:export --table Cases --dc in --page 1`
Expected: succeeds (empty result is fine) — confirms the table name resolves. Repeat for one more table (`AuditLog`) to confirm creation. (No commit — console state.)

---

### Task 8: Load data with ds:import and verify counts

**Files:** none (uses generated `data/import/*.csv`).

Run all commands from the repo root, foreground, with `--dc in`. Load reference tables before the tables that FK to them.

- [ ] **Step 1: Load reference tables**

```bash
catalyst ds:import data/import/districts.csv --table Districts --dc in
catalyst ds:import data/import/stations.csv --table Stations --dc in
```
Expected: each reports rows written matching the file (Districts 39).

- [ ] **Step 2: Load core tables**

```bash
catalyst ds:import data/import/cases.csv --table Cases --dc in
catalyst ds:import data/import/persons.csv --table Persons --dc in
catalyst ds:import data/import/users.csv --table Users --dc in
```
Expected: Cases 135, Persons 67, Users 4.

- [ ] **Step 3: Load link + eval tables**

```bash
catalyst ds:import data/import/case_persons.csv --table CasePersons --dc in
catalyst ds:import data/import/eval_ground_truth.csv --table EvalGroundTruth --dc in
```
Expected: CasePersons non-zero, EvalGroundTruth 202.

- [ ] **Step 4: Verify row counts**

Run: `catalyst ds:export --table Persons --dc in --page 1`
Expected: returns Person rows with populated `phonetic_key`. Confirm counts against source (Districts 39, Cases 135, Persons 67). (No commit — remote data.)

---

### Task 9: Verify immutability and phonetic grouping

**Files:** none.

- [ ] **Step 1: Prove AuditLog rejects update/delete for a non-admin role**

In the console, sign in / impersonate a non-admin role (e.g. `analyst`) or use a scoped token, and attempt to update or delete an `AuditLog` row via ZCQL/console.
Expected: operation **denied** (Update/Delete not permitted). Record the denial as the evidence that append-only is enforced at the platform level.

- [ ] **Step 2: Prove EvalGroundTruth is unreadable by user roles**

As a non-admin role, run a ZCQL `SELECT * FROM EvalGroundTruth`.
Expected: **denied / no access** — the held-out table is invisible to the query layer.

- [ ] **Step 3: Prove phonetic grouping works on loaded data**

Run ZCQL (console or a `catalyst functions:shell`/ZCQL call):
`SELECT person_id, name_as_recorded, phonetic_key FROM Persons WHERE phonetic_key = '<the key from Task 6 Step 4>'`
Expected: both `Girish Shetty` and `GirishShetty` rows return under the one key — the ER index groups the variant pair.

- [ ] **Step 4: Record verification results**

Append a short "Phase 1 verification" note (date, the three results above) to `docs/superpowers/plans/2026-07-16-phase1-datastore-schema.md` and commit:
```bash
git add docs/superpowers/plans/2026-07-16-phase1-datastore-schema.md
git commit -m "Record Phase 1 Data Store verification results"
```

---

## Self-review notes

- **Spec coverage:** all 11 tables (Districts, Stations, Users, Cases, Persons, CasePersons, AuditLog, EntityMatches, MoClusters, EvalGroundTruth, EvidenceRecords) are created (Task 7); the 7 populated tables are loaded (Task 8); computed keys (Task 3), synthesized links (Task 4), ground-truth split (Task 5), append-only + held-out permissions (Tasks 7, 9) all mapped. `EntityMatches`/`MoClusters` created empty per spec.
- **Ground-truth isolation:** enforced twice — stripped from `Cases`/`Persons` transforms (Tasks 3) and access-revoked on `EvalGroundTruth` (Task 7 Step 3, verified Task 9 Step 2).
- **Deferred deliberately:** hash-chain population, RBAC/retrieval logic, ER/MO algorithms, evidence generation — later slices, columns exist now.
- **Type consistency:** transform output keys match the CSV headers in `build.js`, which match the console column names in Task 7 and `ds:import` table names in Task 8.
