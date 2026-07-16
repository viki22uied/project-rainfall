// Four demo officers, one per role, scoped to real stations/districts from the loaded data.
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
