import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('a new toast replaces the dismissal timer and fades only after its own display period', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const classes = new Set(), timers = new Map();
  let next = 0;
  const toast = { textContent: '', classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
  const context = { $: () => toast, noticeTimer: undefined,
    clearTimeout: id => timers.delete(id),
    setTimeout(callback, delay) { assert.equal(delay, 9000); timers.set(++next, callback); return next; },
  };
  runInNewContext(source.slice(source.indexOf('function notice(text)'), source.indexOf('\nfunction select(')), context);
  context.notice('First message');
  context.notice('Latest message');
  assert.equal(toast.textContent, 'Latest message');
  assert.equal(classes.has('is-visible'), true);
  assert.equal(timers.size, 1, 'an old dismissal must not hide a newer notification');
  timers.get(next)();
  assert.equal(classes.has('is-visible'), false);
});

test('connected status only opens device details; disconnect requires its separate menu button', async () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, textContent: id, attributes: {}, listeners: {}, open: false,
      addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute(name, value) { this.attributes[name] = value; },
      getBoundingClientRect: () => ({ bottom: 68, right: 1000 }),
      togglePopover() { this.open = !this.open; }, hidePopover() { this.open = false; },
    });
    return elements.get(id);
  };
  let connects = 0, disconnects = 0;
  const context = { $: element, busy: false, deviceReady: true, innerWidth: 1200, DEVICE_VERSION: '0.5.0', statsUpdate: null,
    signer: { port: {}, disconnect: async () => { disconnects++; } },
    connectDevice: () => { connects++; }, render() {}, notice: assert.fail,
  };
  runInNewContext(source.slice(source.indexOf("$('connect').addEventListener"), source.indexOf("\nsigner.addEventListener('disconnect'")), context);
  element('connect').listeners.click();
  assert.equal(element('device-menu').open, true);
  assert.equal(disconnects, 0);
  assert.equal(element('device-menu').style.right, '200px');
  assert.equal(element('connection-status').textContent, 'device-status');
  assert.match(element('connection-app').textContent, /0.5.0/);
  element('connect').listeners.click();
  assert.equal(element('device-menu').open, false);
  assert.equal(disconnects, 0);
  context.busy = true;
  await element('disconnect').listeners.click();
  assert.equal(disconnects, 0, 'a pending device action cannot be interrupted from this menu');
  context.busy = false;
  await element('disconnect').listeners.click();
  assert.equal(disconnects, 1);
  context.deviceReady = false;
  element('connect').listeners.click();
  assert.equal(connects, 1);

  runInNewContext(source.slice(source.indexOf('async function connectDevice()'), source.indexOf("\nfor (const input of document.querySelectorAll('[data-confirmation]')")), context);
  context.deviceReady = true;
  assert.equal(await context.connectDevice(), true, 'an already connected device must never be toggled off');
  assert.equal(disconnects, 1);
});

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
