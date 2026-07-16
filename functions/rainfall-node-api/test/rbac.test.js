const { test } = require('node:test');
const assert = require('node:assert');
const { decideAccess, buildScopeFilter, maskPerson } = require('../lib/rbac');

const inv = { role: 'investigator', station_code: 'STN-001', is_active: 'true' };
const analyst = { role: 'analyst', is_active: 'true' };
const sup = { role: 'supervisor', district_name: 'Ballari', is_active: 'true' };
const pol = { role: 'policymaker', is_active: 'true' };

test('inactive or revoked user is denied', () => {
  assert.equal(decideAccess({ ...inv, is_active: 'false' }, { resource: 'cases' }).decision, 'denied');
  assert.equal(decideAccess({ ...inv, revoked_at: '2026-01-01' }, { resource: 'cases' }).decision, 'denied');
});

test('investigator is scoped to own station, full detail', () => {
  const d = decideAccess(inv, { resource: 'cases' });
  assert.equal(d.decision, 'allowed');
  assert.deepEqual(d.scope, { station_code: 'STN-001' });
  assert.equal(d.maskPII, false);
});

test('supervisor is scoped to own district', () => {
  const d = decideAccess(sup, { resource: 'persons' });
  assert.equal(d.decision, 'allowed');
  assert.deepEqual(d.scope, { district_name: 'Ballari' });
});

test('analyst sees cross-case but PII masked unless elevated', () => {
  const masked = decideAccess(analyst, { resource: 'persons' });
  assert.equal(masked.decision, 'masked');
  assert.equal(masked.maskPII, true);
  assert.deepEqual(masked.scope, {});
  const elevated = decideAccess(analyst, { resource: 'persons', elevated: true });
  assert.equal(elevated.decision, 'allowed');
  assert.equal(elevated.maskPII, false);
});

test('policymaker gets aggregates only, never individual records', () => {
  assert.equal(decideAccess(pol, { resource: 'aggregate' }).decision, 'allowed');
  assert.equal(decideAccess(pol, { resource: 'persons' }).decision, 'denied');
  assert.equal(decideAccess(pol, { resource: 'cases' }).decision, 'denied');
});

test('unknown role denied', () => {
  assert.equal(decideAccess({ role: 'hacker', is_active: 'true' }, { resource: 'cases' }).decision, 'denied');
});

test('buildScopeFilter builds a ZCQL WHERE fragment, null when unscoped', () => {
  assert.equal(buildScopeFilter({ station_code: 'STN-001' }), "station_code = 'STN-001'");
  assert.equal(buildScopeFilter({}), null);
  assert.equal(buildScopeFilter(null), null);
  // single-quote injection is escaped
  assert.equal(buildScopeFilter({ district_name: "O'Hara" }), "district_name = 'O''Hara'");
});

test('maskPerson redacts readable PII, keeps derived fields', () => {
  const m = maskPerson({ person_id: 'P-1', name_as_recorded: 'Girish', father_name: 'X', phonetic_key: 'JRXXT' });
  assert.equal(m.name_as_recorded, '[REDACTED]');
  assert.equal(m.father_name, '[REDACTED]');
  assert.equal(m.phonetic_key, 'JRXXT');
  assert.equal(m.person_id, 'P-1');
});
