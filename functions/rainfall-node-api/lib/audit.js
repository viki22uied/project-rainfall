// Immutable audit trail via hash-chain — pure logic, no IO.
// Table permissions revoke Update/Delete (defense in depth); this chain makes any
// tampering *detectable* even against admin scope, and is the same SHA-256 primitive
// Feature 3 (BSA 2023 §63 evidence chain) reuses.

const crypto = require('node:crypto');

const GENESIS = 'GENESIS';

// Catalyst datetime columns want "YYYY-MM-DD HH:MM:SS", not ISO-8601.
function catalystNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Stable stringify (sorted keys) so a row's hash is reproducible regardless of key order.
function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(v).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}';
}

function computeRowHash(prevHash, payload) {
  return crypto.createHash('sha256').update(prevHash + canonicalJson(payload)).digest('hex');
}

// The hashed payload — the fields whose integrity we guarantee.
function payloadOf(row) {
  return {
    seq: row.seq,
    actor_email: row.actor_email,
    actor_role: row.actor_role,
    ts: row.ts,
    action: row.action,
    query_text: row.query_text,
    case_ids: row.case_ids,
    person_ids: row.person_ids,
    decision: row.decision,
    reason: row.reason,
  };
}

// Build the next chained row. prevRow = last AuditLog row (or null for the first).
// event carries actor_email, actor_role, action, query_text, case_ids, person_ids,
// decision, reason, and optionally ts.
function buildAuditRow(prevRow, event) {
  const seq = (prevRow && Number(prevRow.seq)) ? Number(prevRow.seq) + 1 : 1;
  const prev_hash = (prevRow && prevRow.row_hash) ? prevRow.row_hash : GENESIS;
  const row = {
    seq,
    actor_email: event.actor_email || '',
    actor_role: event.actor_role || '',
    ts: event.ts || catalystNow(),
    action: event.action || '',
    query_text: event.query_text || '',
    case_ids: JSON.stringify(event.case_ids || []),
    person_ids: JSON.stringify(event.person_ids || []),
    decision: event.decision || '',
    reason: event.reason || '',
    prev_hash,
  };
  row.row_hash = computeRowHash(prev_hash, payloadOf(row));
  return row;
}

// Re-walk a chain (ordered by seq) and confirm every link. Returns {valid, brokenAt}.
function verifyChain(rows) {
  let prevHash = GENESIS;
  for (const row of rows) {
    if (row.prev_hash !== prevHash) return { valid: false, brokenAt: row.seq };
    if (computeRowHash(row.prev_hash, payloadOf(row)) !== row.row_hash) {
      return { valid: false, brokenAt: row.seq };
    }
    prevHash = row.row_hash;
  }
  return { valid: true, brokenAt: null };
}

module.exports = { buildAuditRow, verifyChain, computeRowHash, canonicalJson, GENESIS };
