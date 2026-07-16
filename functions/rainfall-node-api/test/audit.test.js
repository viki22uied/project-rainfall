const { test } = require('node:test');
const assert = require('node:assert');
const { buildAuditRow, verifyChain, GENESIS } = require('../lib/audit');

const ev = (over = {}) => ({
  actor_email: 'analyst@rainfall.demo', actor_role: 'analyst', ts: '2026-07-16T10:00:00Z',
  action: 'query_persons', query_text: 'show accused in C-5001', case_ids: ['C-5001'],
  person_ids: ['P-1001'], decision: 'masked', reason: '', ...over,
});

test('first row is genesis: seq 1, prev_hash GENESIS', () => {
  const r = buildAuditRow(null, ev());
  assert.equal(r.seq, 1);
  assert.equal(r.prev_hash, GENESIS);
  assert.ok(/^[0-9a-f]{64}$/.test(r.row_hash));
});

test('each row links to the previous row_hash and increments seq', () => {
  const r1 = buildAuditRow(null, ev());
  const r2 = buildAuditRow(r1, ev({ action: 'query_cases' }));
  assert.equal(r2.seq, 2);
  assert.equal(r2.prev_hash, r1.row_hash);
});

test('hashing is deterministic regardless of key order', () => {
  const a = buildAuditRow(null, ev());
  const b = buildAuditRow(null, ev());
  assert.equal(a.row_hash, b.row_hash);
});

test('verifyChain accepts an intact chain', () => {
  const r1 = buildAuditRow(null, ev());
  const r2 = buildAuditRow(r1, ev({ action: 'query_cases' }));
  const r3 = buildAuditRow(r2, ev({ action: 'query_aggregate', decision: 'allowed' }));
  assert.deepEqual(verifyChain([r1, r2, r3]), { valid: true, brokenAt: null });
});

test('verifyChain detects tampering with a logged row', () => {
  const r1 = buildAuditRow(null, ev());
  const r2 = buildAuditRow(r1, ev({ action: 'query_cases' }));
  // someone edits the record after the fact (e.g. hides which case was queried)
  const tampered = { ...r2, query_text: 'innocuous' };
  assert.equal(verifyChain([r1, tampered]).valid, false);
  assert.equal(verifyChain([r1, tampered]).brokenAt, 2);
});

test('verifyChain detects a deleted row (broken link)', () => {
  const r1 = buildAuditRow(null, ev());
  const r2 = buildAuditRow(r1, ev({ action: 'a' }));
  const r3 = buildAuditRow(r2, ev({ action: 'b' }));
  // r2 removed → r3.prev_hash no longer matches the row before it
  assert.equal(verifyChain([r1, r3]).valid, false);
});
