import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInstall, validateBundle, waitForApp } from '../public/vendor/installer.js';

const bundle = JSON.parse(readFileSync(new URL('../public/device-install.json', import.meta.url)));
test('installer ships the exact pinned device repo and refuses corrupt or unsafe payloads', async () => {
  await validateBundle(bundle);
  assert.match(bundle.source, new RegExp('NikolaiL/wedgie-starproof/tree/' + bundle.commit));
  const corrupt = structuredClone(bundle); corrupt.files[0].data = btoa('not the reviewed source');
  await assert.rejects(validateBundle(corrupt), /checksum/);
  const unsafe = structuredClone(bundle); unsafe.files[0].name = 'boot.py';
  await assert.rejects(validateBundle(unsafe), /Unsafe install filename/);
});

test('declining physical install approval never enters the REPL or writes files', async () => {
  const calls = [];
  const repl = {
    async hello() { return { fw: 'wedgie-0.3.76', version: '0.3.76', sealed: true, open: false, chip: 'OPTIGA Trust M' }; },
    async request(message) { calls.push(message.type); return { type: 'refused' }; },
    async enter() { assert.fail('No REPL access before physical approval.'); },
    async exec() { assert.fail('No device writes before physical approval.'); },
  };
  await assert.rejects(runInstall(repl, bundle, () => {}), /declined or timed out/);
  assert.deepEqual(calls, ['open']);
});

test('an older running app with an unchecked chip is probed before install approval', async () => {
  const calls = [];
  const repl = {
    async hello() { return { fw: 'wedgie-0.3.76', version: '0.3.76', running: 'starproof', sealed: true, open: false, chip: null }; },
    async request(message) {
      calls.push(message.type);
      return message.type === 'chip' ? { type: 'chip', kind: 'trustm', chip: 'OPTIGA Trust M' } : { type: 'refused' };
    },
    async enter() { assert.fail('No REPL access before physical approval.'); },
    async exec() { assert.fail('No device writes before physical approval.'); },
  };
  await assert.rejects(runInstall(repl, bundle, () => {}), /declined or timed out/);
  assert.deepEqual(calls, ['chip', 'open']);
});

test('unsupported, busy or failed chip checks never request install approval', async () => {
  for (const [proof, error] of [
    [{ type: 'chip', chip: 'ATECC608' }, /requires an OPTIGA/],
    [{ type: 'chip', chip: null }, /requires an OPTIGA/],
    [{ type: 'chip', busy: 1 }, /chip is busy/],
    [{ type: 'chip', chip: 'OPTIGA Trust M', error: 'read failed' }, /Could not check/],
    [{ type: 'error', chip: 'OPTIGA Trust M' }, /Could not check/],
  ]) {
    const repl = {
      async hello() { return { fw: 'wedgie-0.3.76', version: '0.3.76', chip: null }; },
      async request(message) { assert.equal(message.type, 'chip'); return proof; },
      async enter() { assert.fail('Unsupported or unchecked chips must not enter the REPL.'); },
    };
    await assert.rejects(runInstall(repl, bundle, () => {}), error);
  }
});

test('installer waits through USB restart and returns only the same board running Starproof', async (t) => {
  const requests = [], closes = [];
  let starts = 0, polls = 0;
  const uid = 'original-board';
  function makePort(board, running) {
    let incoming;
    return {
      connected: true,
      getInfo() { return { usbVendorId: 0x2e8a }; },
      get readable() { return new ReadableStream({ start(c) { incoming = c; } }); },
      get writable() { return new WritableStream({ write(bytes) {
        const message = JSON.parse(new TextDecoder().decode(bytes)); requests.push(message.type);
        incoming.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'hello', uid: board, running: running() }) + '\n'));
      } }); },
      async open() {}, async close() { closes.push(board); },
    };
  }
  const stale = { connected: true, getInfo() { return { usbVendorId: 0x2e8a }; }, async open() { this.connected = false; throw new Error('The device has been lost.'); }, async close() {} };
  const other = makePort('another-board', () => 'starproof');
  const target = makePort(uid, () => ++starts === 1 ? 'blocks' : 'starproof');
  const serial = new EventTarget();
  serial.getPorts = async () => { polls++; return [other, target]; };
  Object.defineProperty(navigator, 'serial', { configurable: true, value: serial });
  t.after(() => delete navigator.serial);
  const progress = [];
  assert.equal(await waitForApp(stale, uid, (p, text) => progress.push(text)), target);
  assert.equal(polls, 2);
  assert.equal(starts, 2);
  assert.ok(closes.includes('another-board'));
  assert.equal(closes.filter(board => board === uid).length, 2, 'release the probe before handing the port to the signer');
  assert.ok(requests.every(type => type === 'hello'), 'waiting must never install, sign or stop an app');
  assert.match(progress[0], /Waiting for Starproof/);
});

test('restart wait is bounded and a missing board identity cannot select another device', async (t) => {
  let polls = 0, now = 0;
  const serial = new EventTarget();
  serial.getPorts = async () => { polls++; now += 8000; return []; };
  Object.defineProperty(navigator, 'serial', { configurable: true, value: serial });
  t.after(() => delete navigator.serial);
  t.mock.method(Date, 'now', () => now);
  const stale = { connected: false, getInfo() { return { usbVendorId: 0x2e8a }; } };
  await assert.rejects(waitForApp(stale, undefined, () => {}), /identity is unavailable/);
  assert.equal(polls, 0);
  await assert.rejects(waitForApp(stale, 'original-board', () => {}), /installed.*has not responded/);
  assert.equal(polls, 2);
});
