import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInstall, validateBundle } from '../public/vendor/installer.js';

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
