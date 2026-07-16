// Held-out answer keys. Never loaded into a queryable table — only EvalGroundTruth.
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
