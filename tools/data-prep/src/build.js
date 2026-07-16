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
