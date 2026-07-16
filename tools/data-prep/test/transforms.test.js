const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeName, phoneticKey } = require('../src/names');
const { buildStations, stationCodeFor } = require('../src/stations');
const { buildCases } = require('../src/cases');
const { buildPersons } = require('../src/persons');
const { synthesizeCasePersons } = require('../src/casePersons');
const { buildEvalGroundTruth } = require('../src/evalGroundTruth');

test('normalizeName strips case, spaces, punctuation', () => {
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

const caseRows = [
  { case_id: 'C-5001', fir_number: 'FIR/2025/381', district: 'Ballari', station: 'Gandhinagar PS',
    date: '2025-05-03', crime_type: 'Chain Snatching', entry_method: 'No forced entry - distraction',
    weapon: 'None - snatch and run', target_type: 'Pedestrian - gold chain', time_band: 'Evening (6-9PM)',
    status: 'Unsolved', hidden_serial_cluster_GROUND_TRUTH: 'SERIAL-1' },
  { case_id: 'C-5002', fir_number: 'FIR/2025/340', district: 'Belagavi City', station: 'Camp PS',
    date: '2025-05-27', crime_type: 'Chain Snatching', entry_method: 'x', weapon: 'x', target_type: 'x',
    time_band: 'x', status: 'Unsolved', hidden_serial_cluster_GROUND_TRUTH: 'SERIAL-1' },
];

test('buildStations dedupes and assigns unique deterministic codes', () => {
  const stations = buildStations([...caseRows, { district: 'Ballari', station: 'Gandhinagar PS' }]);
  assert.equal(stations.length, 2);
  const codes = stations.map(s => s.station_code);
  assert.equal(new Set(codes).size, codes.length);
});

test('buildCases resolves station_code and drops ground truth', () => {
  const cases = buildCases(caseRows);
  const c = cases.find(x => x.case_id === 'C-5001');
  assert.equal(c.station_code, stationCodeFor('Ballari', 'Gandhinagar PS', caseRows));
  assert.ok(!Object.keys(c).some(k => k.includes('GROUND_TRUTH')));
});

const personRows = [
  { person_id: 'P-1001', canonical_id_GROUND_TRUTH: 'CID-1000', name_as_recorded: 'PrakashKumar',
    father_name: 'Suresh Kumar', approx_age: '33', district: 'Ballari', role: 'accused',
    source_record: 'Charge sheet OCR scan' },
  { person_id: 'P-1002', canonical_id_GROUND_TRUTH: 'CID-1001', name_as_recorded: 'Girish Shetty',
    father_name: 'x', approx_age: '44', district: 'Tumakuru', role: 'victim', source_record: 'x' },
];

test('buildPersons computes keys and drops canonical id', () => {
  const [p] = buildPersons(personRows);
  assert.equal(p.name_normalized, 'prakashkumar');
  assert.ok(p.phonetic_key.length > 0);
  assert.equal(p.approx_age, 33);
  assert.ok(!Object.keys(p).some(k => k.includes('GROUND_TRUTH')));
});

test('synthesizeCasePersons: every case has accused + victim, direct_fir, deterministic', () => {
  const cases = buildCases(caseRows);
  const persons = buildPersons(personRows);
  const links = synthesizeCasePersons(cases, persons);
  for (const c of cases) {
    const forCase = links.filter(l => l.case_id === c.case_id);
    assert.ok(forCase.some(l => l.role_in_case === 'accused'));
    assert.ok(forCase.some(l => l.role_in_case === 'victim'));
  }
  assert.ok(links.every(l => l.link_source === 'direct_fir' && l.match_ref === ''));
  assert.deepEqual(synthesizeCasePersons(cases, persons), links);
});

test('buildEvalGroundTruth keys case + person truth', () => {
  const gt = buildEvalGroundTruth(caseRows, personRows);
  assert.deepEqual(gt.find(g => g.biz_id === 'C-5001'),
    { entity_type: 'case', biz_id: 'C-5001', truth_key: 'SERIAL-1' });
  assert.deepEqual(gt.find(g => g.biz_id === 'P-1001'),
    { entity_type: 'person', biz_id: 'P-1001', truth_key: 'CID-1000' });
});
