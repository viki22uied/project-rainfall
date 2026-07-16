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

// Resolve the code for a given pair against the same ordering (used by cases.js).
function stationCodeFor(districtName, stationName, allCaseRows) {
  const pairs = pairsSorted(allCaseRows || []);
  const idx = pairs.findIndex(p => p.district_name === districtName && p.station_name === stationName);
  return idx >= 0 ? `STN-${String(idx + 1).padStart(3, '0')}` : '';
}

module.exports = { buildStations, stationCodeFor, pairsSorted };
