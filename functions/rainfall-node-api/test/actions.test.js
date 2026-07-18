const { test } = require('node:test');
const assert = require('node:assert');
const { canRunPiiAction, withServerAttribution } = require('../lib/actions');

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
