import test from 'node:test';
import assert from 'node:assert/strict';
import { openApproval, showVerifying, closeApproval, openInstall, installProgress } from '../public/approval.js';

test('the button guide sends no request; real approvals show the action and bounded countdown', (t) => {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { dataset: {}, showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  t.mock.method(globalThis, 'fetch', () => { assert.fail('The approval guide must not send requests.'); });
  const originalDocument = globalThis.document;
  globalThis.document = { getElementById: element };
  t.after(() => { globalThis.document = originalDocument; });
  let now = 1_000_000, tick, activeTimer = false;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'setInterval', (callback) => { tick = callback; activeTimer = true; return 1; });
  t.mock.method(globalThis, 'clearInterval', () => { activeTimer = false; });

  openApproval({ action: 'launch', target: 'sol' }, true);
  assert.equal(element('approval').open, true);
  assert.equal(element('approval').dataset.phase, 'preview');
  assert.equal(element('approval-countdown').hidden, true);
  assert.equal(activeTimer, false);
  assert.match(element('approval-status').textContent, /NO REQUEST SENT/);
  closeApproval();
  assert.equal(element('approval').open, false);

  openApproval({ action: 'jump', target: 'vega', expires: now / 1000 + 90 });
  assert.equal(element('approval-action').textContent, 'Jump to Vega');
  assert.equal(element('device-cost').textContent, 'Fuel: 1');
  assert.equal(element('approval-countdown').textContent, '60s to respond');
  now += 61_000; tick();
  assert.equal(element('approval-countdown').textContent, 'Request expired');
  showVerifying();
  assert.equal(activeTimer, false);
  assert.equal(element('approval').dataset.phase, 'verifying');
  assert.equal(element('cancel').disabled, true);
  assert.equal(element('approval-countdown').hidden, true);
  closeApproval();

  openApproval({ action: 'claim', target: 'kepler', expires: now / 1000 + 5 });
  assert.match(element('approval-action').textContent, /^Claim /);
  assert.equal(element('device-cost').textContent, 'Fuel: 0');
  assert.equal(element('cancel').disabled, false);
  assert.equal(element('approval-countdown').textContent, '5s to respond');
  closeApproval();
  assert.equal(activeTimer, false);

  openApproval({ action: 'refuel', target: 'kepler', cost: 3, expires: now / 1000 + 20 });
  assert.equal(element('device-question').textContent, 'Refuel tank?');
  assert.equal(element('device-cost').textContent, '3 credits');
  assert.match(element('approval-action').textContent, /Refuel at Kepler · 3 credits/);
  closeApproval();
  openApproval({ action: 'refuel', target: 'kepler', cost: 0, expires: now / 1000 + 20 });
  assert.equal(element('device-cost').textContent, 'Free fuel cache');
  closeApproval();
  openInstall('0.2.0', 'https://github.com/NikolaiL/wedgie-starproof');
  assert.equal(element('cancel').disabled, true);
  assert.match(element('approval-description').textContent, /FULL CONTROL/);
  installProgress(.5, 'starproof.py');
  assert.equal(element('physical-instructions').hidden, true);
  assert.match(element('approval-status').textContent, /50%/);
  closeApproval();
});
