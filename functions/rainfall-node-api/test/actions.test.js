const { test } = require('node:test');
const assert = require('node:assert');
const { canRunPiiAction, withServerAttribution, withQueryArg } = require('../lib/actions');

test('canRunPiiAction: only analyst/supervisor run identity-level ML', () => {
  assert.equal(canRunPiiAction('analyst'), true);
  assert.equal(canRunPiiAction('supervisor'), true);
  assert.equal(canRunPiiAction('investigator'), false);
  assert.equal(canRunPiiAction('policymaker'), false);
});

test('withServerAttribution: confirm_match gets decided_by from the authenticated user, overriding any client-supplied value', () => {
  const user = { auth_email: 'supervisor@rainfall.demo' };
  const body = withServerAttribution('confirm_match',
    { person_a: 'P-1', person_b: 'P-2', decision: 'confirmed', decided_by: 'someone-else@evil.com' }, user);
  assert.equal(body.decided_by, 'supervisor@rainfall.demo');
  assert.equal(body.person_a, 'P-1');
});

test('withServerAttribution: leaves other actions untouched', () => {
  const user = { auth_email: 'analyst@rainfall.demo' };
  const body = { finding: '{}' };
  assert.strictEqual(withServerAttribution('seal', body, user), body);
});

test('withQueryArg: appends the value, URL-encoded, to the path', () => {
  const def = { svc: 'ANALYTICS', path: '/decision-support', method: 'GET', queryArg: 'case_id' };
  const result = withQueryArg(def, 'C-5001 & Co');
  assert.equal(result.path, '/decision-support?case_id=C-5001%20%26%20Co');
  assert.equal(def.path, '/decision-support'); // original untouched
});

test('withQueryArg: returns null when the required value is missing, not a malformed path', () => {
  const def = { svc: 'ANALYTICS', path: '/decision-support', method: 'GET', queryArg: 'case_id' };
  assert.strictEqual(withQueryArg(def, undefined), null);
  assert.strictEqual(withQueryArg(def, ''), null);
});

test('withQueryArg: passes through actions with no queryArg unchanged', () => {
  const def = { svc: 'ANALYTICS', path: '/risk', method: 'GET' };
  assert.strictEqual(withQueryArg(def, 'anything'), def);
});
