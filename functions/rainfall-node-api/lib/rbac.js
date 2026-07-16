// Role-based access control — pure decisions, no IO.
// Every query is run through decideAccess BEFORE any DB/LLM call (PRD §4).
//
// Roles (PRD §4):
//   investigator — full detail, own station only
//   analyst      — cross-case, PII masked unless elevated
//   supervisor   — full district access
//   policymaker  — state-wide aggregates only, never individual PII

const PII_MASK = '[REDACTED]';

function isActive(user) {
  if (!user) return false;
  const flag = user.is_active === true || user.is_active === 'true';
  const revoked = user.revoked_at != null && String(user.revoked_at).trim() !== '';
  return flag && !revoked;
}

function deny(reason) {
  return { decision: 'denied', scope: null, maskPII: false, reason };
}
function allow(scope, maskPII) {
  return { decision: maskPII ? 'masked' : 'allowed', scope, maskPII, reason: '' };
}

// request = { resource: 'aggregate' | 'cases' | 'persons' | 'casepersons' | ..., elevated?: bool }
function decideAccess(user, request) {
  if (!isActive(user)) return deny('account inactive or revoked');
  const isAggregate = request && request.resource === 'aggregate';

  switch (user.role) {
    case 'policymaker':
      return isAggregate
        ? allow({}, false)
        : deny('policymaker: state aggregates only, no individual records');

    case 'investigator':
      if (isAggregate) return allow({}, false);
      if (!user.station_code) return deny('investigator has no station assignment');
      return allow({ station_code: user.station_code }, false);

    case 'supervisor':
      if (isAggregate) return allow({}, false);
      if (!user.district_name) return deny('supervisor has no district assignment');
      return allow({ district_name: user.district_name }, false);

    case 'analyst':
      if (isAggregate) return allow({}, false);
      return allow({}, !(request && request.elevated)); // masked unless elevated

    default:
      return deny(`unknown role: ${user.role}`);
  }
}

// Turn a scope object into a ZCQL WHERE fragment (null = no restriction).
// Values come from the authenticated user's own Users row (station_code / district_name),
// not from request input. ZCQL has no bind-parameter API, so single quotes are escaped by
// doubling ('') — the standard, sufficient escaping for a single-quoted string literal.
// Keys are fixed column identifiers set in index.js, never client-supplied.
function buildScopeFilter(scope) {
  if (!scope) return null;
  const parts = Object.entries(scope).map(([k, v]) =>
    `${k} = '${String(v).replace(/'/g, "''")}'`);
  return parts.length ? parts.join(' AND ') : null;
}

// Redact readable PII on a person record; keep derived/non-PII fields for pattern work.
function maskPerson(row) {
  return { ...row, name_as_recorded: PII_MASK, father_name: PII_MASK };
}

module.exports = { decideAccess, buildScopeFilter, maskPerson, isActive, PII_MASK };
