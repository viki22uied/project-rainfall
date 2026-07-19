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

// Some actions (decision-support) take one dynamic value appended as a query param.
// Returns null when the required arg is missing, so the caller can respond with a clear
// error rather than proxying a malformed request to AppSail.
function withQueryArg(def, value) {
  if (!def.queryArg) return def;
  if (!value) return null;
  return { ...def, path: `${def.path}?${def.queryArg}=${encodeURIComponent(value)}` };
}

module.exports = { PII_ML_ROLES, canRunPiiAction, withServerAttribution, withQueryArg };
