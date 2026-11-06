import test from 'node:test';
import assert from 'node:assert/strict';
import {signerAddress} from '../lib/safe.js';

test('Safe owner derivation matches the independent upstream MicroPython implementation',()=>{
  const point={x:'0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296',y:'0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'};
  assert.equal(signerAddress(point),'0xf28F8AF710ee4764fb5097Eff6a588BE436dc916');
  assert.throws(()=>signerAddress({x:'0x1',y:point.y}),/Invalid/);
});

test('Safe discovery failures preserve manual address entry',async t=>{
  const {findSafes}=await import('../lib/safe.js');
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
  const point={x:'0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296',y:'0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'};
  globalThis.fetch=async()=>{throw new Error('offline');};
  assert.deepEqual(await findSafes({},point),{owner:signerAddress(point),safes:[],discoveryUnavailable:true});
});
