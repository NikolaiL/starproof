import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('green toggles planet info; joystick presses preserve flight without triggering actions', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const listener = source.slice(source.indexOf("signer.addEventListener('input'"), source.indexOf('\nasync function commit('));
  let input, popup = false, scans = 0;
  const actions = [];
  const approval = { open: false };
  const context = {
    signer: { addEventListener(type, callback) { assert.equal(type, 'input'); input = callback; } },
    $: id => id === 'approval' ? approval : { matches: () => popup },
    deviceReady: true, busy: false, state: { started: true, location: 'sol' }, deviceInput: null,
    performance: { now: () => 123 },
    togglePlanetInfo() { popup = !popup; },
    commit: (...args) => actions.push(args), scan() { scans++; },
    startExploring() { assert.fail('Navigation buttons must not launch a mission.'); },
  };
  runInNewContext(listener, context);

  for (const started of [false, true]) {
    context.state.started = started;
    input({ detail: { action: 'info', dx: 1, dy: -1 } });
    assert.equal(popup, false);
    input({ detail: { action: 'go' } });
    assert.equal(popup, true);
    assert.equal(context.deviceInput, null);
    input({ detail: { action: 'info', dx: 0, dy: 0 } });
    assert.equal(popup, true, 'joystick press must not close the popup');
    input({ detail: { action: 'go' } });
    assert.equal(popup, false);
  }
  assert.equal(actions.length, 0);
  input({ detail: { action: 'info', dx: 1, dy: -1 } });
  assert.equal(context.deviceInput.dx, 1);
  assert.equal(context.deviceInput.dy, -1);
  assert.equal(context.deviceInput.at, 123);
  input({ detail: { action: 'info', dx: 0, dy: 0 } });
  assert.equal(context.deviceInput.dx, 0, 'release must stop flight even with an accidental press');
  assert.equal(scans, 0);
  for (const action of ['refuel', 'scavenge']) input({ detail: { action } });
  assert.deepEqual(actions, [['refuel', 'sol'], ['scavenge', 'sol']]);
  input({ detail: { dx: 0, dy: 0, scan: true } });
  assert.equal(scans, 1);
  approval.open = true;
  input({ detail: { action: 'go' } });
  assert.equal(popup, false, 'navigation must not run during signing approval');
});
