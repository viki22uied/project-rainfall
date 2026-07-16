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
