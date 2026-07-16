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
