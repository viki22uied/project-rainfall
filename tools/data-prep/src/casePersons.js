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
