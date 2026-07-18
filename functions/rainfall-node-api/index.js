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

// AppSail ML services. Local `catalyst serve` ports by default; override per env in the
// cloud (each AppSail's real URL). ML is Python/AppSail per PRD §7 — Node only routes to it.
const APPSAIL = {
  ER:        process.env.APPSAIL_ER        || 'http://localhost:3004',
  MO:        process.env.APPSAIL_MO        || 'http://localhost:3001',
  ANALYTICS: process.env.APPSAIL_ANALYTICS || 'http://localhost:3002',
  LEGAL:     process.env.APPSAIL_LEGAL     || 'http://localhost:3003',
};

// ML actions the gateway proxies AFTER the role check (PRD §4: role-filter before any ML).
// pii:true actions expose individual identities → denied to policymaker (aggregates only).
const ACTIONS = {
  er_candidates: { pii: true,  svc: 'ER',        path: '/candidates?threshold=90&limit=12', method: 'GET'  },
  mo_clusters:   { pii: false, svc: 'MO',        path: '/cluster?threshold=1.0',            method: 'POST' },
  risk:          { pii: true,  svc: 'ANALYTICS', path: '/risk',                             method: 'GET'  },
  socio:         { pii: false, svc: 'ANALYTICS', path: '/sociodemographic',                 method: 'GET'  },
  forecast:      { pii: false, svc: 'ANALYTICS', path: '/forecast?key=crime_type',          method: 'GET'  },
  seal:          { pii: false, svc: 'LEGAL',     path: '/seal',                             method: 'POST', bodyArg: 'finding' },
};

// Roles allowed to run identity-level (pii) ML — cross-case tools per PRD §4.
const PII_ML_ROLES = new Set(['analyst', 'supervisor']);

async function callAppsail(def, body) {
  const res = await fetch(APPSAIL[def.svc] + def.path, {
    method: def.method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`appsail ${def.svc} ${res.status}`);
  return res.json();
}

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
  // basicIO.write appends across calls; local serve caps each call at 1024 chars, so chunk
  // the payload (harmless in the cloud, where writes also concatenate into one response body).
  const respond = (code, body) => {
    const s = JSON.stringify({ status: code, ...body });
    for (let i = 0; i < s.length; i += 1000) basicIO.write(s.slice(i, i + 1000));
    context.close();
  };

  const resource = basicIO.getArgument('resource') || 'cases';
  const elevated = String(basicIO.getArgument('elevated')) === 'true';

  try {
    // 1. Identify the actor. The authenticated Catalyst user ALWAYS wins — a client-supplied
    //    actor_email is only honoured when there is no real session AND a server-side flag is
    //    set. That flag is absent from the deployed config (see catalyst-config.json) and is
    //    injected for local serve only (serve-local.sh); in production it can never impersonate.
    let email;
    try { email = (await app.userManagement().getCurrentUser()).email_id; } catch (_) { /* no auth context */ }
    if (!email && process.env.ALLOW_ACTOR_EMAIL_OVERRIDE === 'true') email = basicIO.getArgument('actor_email');
    // Strict validation doubles as injection defense: a valid email contains no quotes,
    // so the interpolation below cannot be broken out of.
    if (!email || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      return respond('failure', { error: 'no authenticated user' });
    }

    const users = await zcql.executeZCQLQuery(
      `SELECT auth_email, role, station_code, district_name, is_active, revoked_at ` +
      `FROM Users WHERE auth_email = '${email.replace(/'/g, "''")}'`);
    const user = users[0] && users[0].Users;
    if (!user) return respond('failure', { error: 'user not provisioned' });

    // 1b. ML action? Role-gate BEFORE proxying to AppSail, then audit the call.
    const action = basicIO.getArgument('action');
    if (action === 'stats') {
      const stats = await computeStats(zcql);
      await writeAudit(app, zcql, user, 'stats', { decision: 'allowed', reason: '', maskPII: false });
      return respond('success', { stats });
    }
    if (action && ACTIONS[action]) {
      const def = ACTIONS[action];
      // Identity-level ML (pii) runs over the WHOLE Data Store, so it exceeds the row scope of
      // investigator (own station) and policymaker (aggregates only). Restrict it to the
      // cross-case roles. Aggregate ML (mo_clusters, socio, forecast) stays open to all.
      if (def.pii && !PII_ML_ROLES.has(user.role)) {
        const denied = { decision: 'denied', reason: `${user.role}: identity-level ML is restricted to analyst/supervisor`, maskPII: false, scope: null };
        const seq = await writeAudit(app, zcql, user, action, denied);
        return respond('failure', { error: 'access denied', reason: denied.reason, audit_seq: seq });
      }
      let body;
      if (def.bodyArg) { try { body = JSON.parse(basicIO.getArgument(def.bodyArg) || '{}'); } catch (_) { body = {}; } }
      const data = await callAppsail(def, body);
      const seq = await writeAudit(app, zcql, user, action, { decision: 'allowed', reason: '', maskPII: false });
      return respond('success', { action, audit_seq: seq, data });
    }

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

// Aggregate counts for the console header. ZCQL caps LIMIT at 300, so use COUNT() for the
// totals (correct past 300 rows) and a capped scan only for the per-status breakdown.
async function computeStats(zcql) {
  const [totalRow, unsolvedRow, personsRow] = await Promise.all([
    zcql.executeZCQLQuery('SELECT COUNT(ROWID) FROM Cases'),
    zcql.executeZCQLQuery("SELECT COUNT(ROWID) FROM Cases WHERE status = 'Unsolved'"),
    zcql.executeZCQLQuery('SELECT COUNT(ROWID) FROM Persons'),
  ]);
  const val = (rows, table) => Number(rows[0] && rows[0][table] && Object.values(rows[0][table])[0]) || 0;
  return { cases: val(totalRow, 'Cases'), unsolved: val(unsolvedRow, 'Cases'), persons: val(personsRow, 'Persons') };
}

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
