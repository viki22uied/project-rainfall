// Pure decisions for the ML action-proxy path — no IO, mirrors lib/rbac.js's style.

// Identity-level ML (er_candidates, risk, confirm_match) runs over the WHOLE Data Store,
// exceeding investigator's station scope and policymaker's aggregates-only scope.
const PII_ML_ROLES = new Set(['analyst', 'supervisor']);
function canRunPiiAction(role) {
  return PII_ML_ROLES.has(role);
}

// decided_by is attribution for an ER merge decision — always the authenticated actor,
// never a client-supplied value (a caller could otherwise forge who confirmed a match).
function withServerAttribution(action, body, user) {
  if (action !== 'confirm_match') return body;
  return { ...body, decided_by: user.auth_email };
}

module.exports = { PII_ML_ROLES, canRunPiiAction, withServerAttribution };
