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
