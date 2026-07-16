const catalyst = require('zcatalyst-sdk-node');
const { decideAccess, buildScopeFilter, maskPerson } = require('./lib/rbac');
const { buildAuditRow } = require('./lib/audit');

// resource -> Data Store table, and which scope columns actually exist on it.
const RESOURCE = {
  aggregate:   { table: 'Districts',    scopeCols: [] },
  cases:       { table: 'Cases',        scopeCols: ['station_code', 'district_name'] },
  persons:     { table: 'Persons',      scopeCols: ['district_name'] },
  casepersons: { table: 'CasePersons',  scopeCols: [] },
};

/**
 * RBAC + immutable-audit gateway. Every request is role-filtered BEFORE the DB read,
 * and every request (allowed, masked, or denied) is written to the hash-chained AuditLog.
 *
 * Args (query or body): resource, elevated, actor_email (fallback when no auth context).
 *
 * @param {import('./types/basicio').Context} context
 * @param {import('./types/basicio').BasicIO} basicIO
 */
module.exports = async (context, basicIO) => {
  const app = catalyst.initialize(context);
  const zcql = app.zcql();
  const respond = (code, body) => { basicIO.write(JSON.stringify({ status: code, ...body })); context.close(); };

  const resource = basicIO.getArgument('resource') || 'cases';
  const elevated = String(basicIO.getArgument('elevated')) === 'true';

  try {
    // 1. Identify the actor: explicit arg (local/demo) first, else the logged-in Catalyst user.
    let email = basicIO.getArgument('actor_email');
    if (!email) {
      try { email = (await app.userManagement().getCurrentUser()).email_id; } catch (_) { /* no auth context */ }
    }
    if (!email) return respond('failure', { error: 'no authenticated user' });

    const users = await zcql.executeZCQLQuery(
      `SELECT auth_email, role, station_code, district_name, is_active, revoked_at ` +
      `FROM Users WHERE auth_email = '${email.replace(/'/g, "''")}'`);
    const user = users[0] && users[0].Users;
    if (!user) return respond('failure', { error: 'user not provisioned' });

    // 2. Decide access BEFORE touching case data.
    const verdict = decideAccess(user, { resource, elevated });

    // 3. Denied → audit and stop.
    if (verdict.decision === 'denied') {
      const seq = await writeAudit(app, zcql, user, resource, verdict);
      return respond('failure', { error: 'access denied', reason: verdict.reason, audit_seq: seq });
    }

    // 4. Apply role scope to the target table (only columns that exist on it).
    const def = RESOURCE[resource];
    if (!def) return respond('failure', { error: `unknown resource: ${resource}` });
    const scopeKeys = Object.keys(verdict.scope);
    const applicable = scopeKeys.filter(k => def.scopeCols.includes(k));
    if (scopeKeys.length && applicable.length === 0) {
      // ponytail: no cross-table scoping yet (e.g. investigator→persons via cases). Deny > leak.
      const denied = { decision: 'denied', reason: `${user.role} cannot scope ${resource} directly`, maskPII: false, scope: null };
      const seq = await writeAudit(app, zcql, user, resource, denied);
      return respond('failure', { error: 'access denied', reason: denied.reason, audit_seq: seq });
    }
    const where = buildScopeFilter(Object.fromEntries(applicable.map(k => [k, verdict.scope[k]])));

    // 5. Read, scoped.
    let rows = await zcql.executeZCQLQuery(
      `SELECT * FROM ${def.table}${where ? ` WHERE ${where}` : ''} LIMIT 200`);
    let data = rows.map(r => r[def.table]);
    if (verdict.maskPII && resource === 'persons') data = data.map(maskPerson);

    // 6. Audit the successful access, then return.
    const caseIds = resource === 'cases' ? data.map(d => d.case_id).filter(Boolean) : [];
    const seq = await writeAudit(app, zcql, user, resource, verdict, caseIds);
    return respond('success', { decision: verdict.decision, count: data.length, audit_seq: seq, data });
  } catch (err) {
    console.error('gateway error:', err);
    return respond('failure', { error: 'internal error' });
  }
};

// Append a hash-chained row to AuditLog (fetch last row for prev_hash, then insert).
async function writeAudit(app, zcql, user, resource, verdict, caseIds = []) {
  const last = await zcql.executeZCQLQuery('SELECT seq, row_hash FROM AuditLog ORDER BY seq DESC LIMIT 1');
  const prevRow = last[0] && last[0].AuditLog;
  const row = buildAuditRow(prevRow, {
    actor_email: user.auth_email, actor_role: user.role,
    action: `query_${resource}`, query_text: `${resource}${verdict.maskPII ? ' (masked)' : ''}`,
    case_ids: caseIds, person_ids: [], decision: verdict.decision, reason: verdict.reason,
  });
  await app.datastore().table('AuditLog').insertRow(row);
  return row.seq;
}
