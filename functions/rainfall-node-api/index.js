const catalyst = require('zcatalyst-sdk-node');
const { decideAccess, buildScopeFilter, maskPerson } = require('./lib/rbac');
const { buildAuditRow } = require('./lib/audit');
const { canRunPiiAction, withServerAttribution, withQueryArg } = require('./lib/actions');

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
  // bodyArg name avoids collisions with String.prototype methods (e.g. 'match', 'length',
  // 'slice') — the local serve's arg lookup does `queryParamsAsString[key] || body[key]`,
  // and a key that shadows a built-in string method resolves to that method, not the value.
  confirm_match: { pii: true,  svc: 'ER',        path: '/confirm',                          method: 'POST', bodyArg: 'payload' },
  mo_clusters:   { pii: false, svc: 'MO',        path: '/cluster?threshold=1.0',            method: 'POST' },
  risk:          { pii: true,  svc: 'ANALYTICS', path: '/risk',                             method: 'GET'  },
  socio:         { pii: false, svc: 'ANALYTICS', path: '/sociodemographic',                 method: 'GET'  },
  forecast:      { pii: false, svc: 'ANALYTICS', path: '/forecast?key=crime_type',          method: 'GET'  },
  decision:      { pii: true,  svc: 'ANALYTICS', path: '/decision-support',                 method: 'GET', queryArg: 'case_id' },
  seal:          { pii: false, svc: 'LEGAL',     path: '/seal',                             method: 'POST', bodyArg: 'finding' },
};

async function callAppsail(def, body) {
  const res = await fetch(APPSAIL[def.svc] + def.path, {
    method: def.method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const reason = await res.json().catch(() => null);
    throw new Error((reason && reason.error) || `appsail ${def.svc} ${res.status}`);
  }
  return res.json();
}

// Voice input: browser records audio, we transcribe it server-side via Groq Whisper so the
// API key never reaches the client. GROQ_API_KEY is set via the Catalyst console's function
// environment variables (never committed — see appsail/DEPLOY_NOTES.md). Kept separate from
// the AppSail ACTIONS map above since it's multipart, not JSON, and hits an external API.
async function transcribeAudio(base64Audio, lang) {
  if (!process.env.GROQ_API_KEY) throw new Error('voice transcription is not configured');
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(base64Audio, 'base64')]), 'query.webm');
  form.append('model', 'whisper-large-v3-turbo');
  if (lang === 'kn' || lang === 'en') form.append('language', lang);
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`groq transcription ${res.status}`);
  const json = await res.json();
  return (json.text || '').trim();
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
    // 1. Identify the actor. The authenticated Catalyst user ALWAYS wins. HACKATHON_DEMO_MODE
    //    is an intentional, labeled exception for this submission: there is no login UI wired
    //    up yet (Catalyst Auth requires console setup we don't have access to for this build),
    //    so judges pick a role via the dropdown instead of logging in. Scoped tight: only the
    //    4 seeded @rainfall.demo accounts can be asserted this way — not an arbitrary email —
    //    and the UI shows a permanent banner saying this mode is active. See DEPLOY_NOTES.md.
    let email;
    try { email = (await app.userManagement().getCurrentUser()).email_id; } catch (_) { /* no auth context */ }
    if (!email && process.env.HACKATHON_DEMO_MODE === 'true') {
      const claimed = basicIO.getArgument('actor_email');
      if (claimed && /^[a-z]+@rainfall\.demo$/.test(claimed)) email = claimed;
    }
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
    if (action === 'transcribe') {
      const audio = basicIO.getArgument('audio'); // base64, no data: prefix
      if (!audio) return respond('failure', { error: 'no audio provided' });
      let text;
      try { text = await transcribeAudio(audio, basicIO.getArgument('lang')); }
      catch (err) { return respond('failure', { error: err.message || 'transcription failed' }); }
      const seq = await writeAudit(app, zcql, user, 'transcribe', { decision: 'allowed', reason: '', maskPII: false });
      return respond('success', { text, audit_seq: seq });
    }
    if (action === 'network') {
      // Criminal network graph (PRD #6): built from the SAME role-scoped case set the
      // `cases` resource already computes — an investigator sees their own station's
      // network, a supervisor their own district, an analyst everything (masked). No
      // case-level network for policymaker: aggregates only, never individual PII.
      if (user.role === 'policymaker') {
        const denied = { decision: 'denied', reason: 'policymaker: aggregates only, no case-level network', maskPII: false, scope: null };
        const seq = await writeAudit(app, zcql, user, 'network', denied);
        return respond('failure', { error: 'access denied', reason: denied.reason, audit_seq: seq });
      }
      const verdict = decideAccess(user, { resource: 'cases', elevated });
      if (verdict.decision === 'denied') {
        const seq = await writeAudit(app, zcql, user, 'network', verdict);
        return respond('failure', { error: 'access denied', reason: verdict.reason, audit_seq: seq });
      }
      const scopeKeys = Object.keys(verdict.scope);
      const applicable = scopeKeys.filter(k => RESOURCE.cases.scopeCols.includes(k));
      const where = buildScopeFilter(Object.fromEntries(applicable.map(k => [k, verdict.scope[k]])));
      const caseRows = await zcql.executeZCQLQuery(`SELECT case_id FROM Cases${where ? ` WHERE ${where}` : ''} LIMIT 10`);
      const caseIds = caseRows.map(r => r.Cases.case_id);
      const nodes = caseIds.map(id => ({ id, label: id, kind: 'case' }));
      const edges = [];
      if (caseIds.length) {
        const idList = caseIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
        const cpRows = await zcql.executeZCQLQuery(
          `SELECT case_id, person_id, role_in_case FROM CasePersons WHERE case_id IN (${idList})`);
        const personIds = [...new Set(cpRows.map(r => r.CasePersons.person_id))];
        const pidList = personIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
        const personRows = personIds.length
          ? await zcql.executeZCQLQuery(`SELECT person_id, name_as_recorded FROM Persons WHERE person_id IN (${pidList})`)
          : [];
        const nameById = Object.fromEntries(personRows.map(r => [r.Persons.person_id, r.Persons.name_as_recorded]));
        const seenPerson = new Set();
        for (const r of cpRows) {
          const cp = r.CasePersons;
          const kind = ['accused', 'victim', 'witness'].includes(cp.role_in_case) ? cp.role_in_case : 'witness';
          if (!seenPerson.has(cp.person_id)) {
            seenPerson.add(cp.person_id);
            nodes.push({ id: cp.person_id, label: verdict.maskPII ? '•••' : (nameById[cp.person_id] || cp.person_id), kind });
          }
          edges.push({ a: cp.person_id, b: cp.case_id, rel: cp.role_in_case });
        }
      }
      const seq = await writeAudit(app, zcql, user, 'network', { decision: verdict.decision, reason: '', maskPII: verdict.maskPII }, caseIds);
      return respond('success', { network: { nodes, edges }, audit_seq: seq });
    }
    if (action && ACTIONS[action]) {
      let def = ACTIONS[action];
      // Identity-level ML (pii) runs over the WHOLE Data Store, so it exceeds the row scope of
      // investigator (own station) and policymaker (aggregates only). Restrict it to the
      // cross-case roles. Aggregate ML (mo_clusters, socio, forecast) stays open to all.
      if (def.pii && !canRunPiiAction(user.role)) {
        const denied = { decision: 'denied', reason: `${user.role}: identity-level ML is restricted to analyst/supervisor`, maskPII: false, scope: null };
        const seq = await writeAudit(app, zcql, user, action, denied);
        return respond('failure', { error: 'access denied', reason: denied.reason, audit_seq: seq });
      }
      if (def.queryArg) {
        def = withQueryArg(def, basicIO.getArgument(def.queryArg));
        if (!def) return respond('failure', { error: `missing ${ACTIONS[action].queryArg}` });
      }
      let body;
      if (def.bodyArg) { try { body = JSON.parse(basicIO.getArgument(def.bodyArg) || '{}'); } catch (_) { body = {}; } }
      body = withServerAttribution(action, body, user);
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
module.exports.transcribeAudio = transcribeAudio; // exported for testing (mocked fetch)

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
