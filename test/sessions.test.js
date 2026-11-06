import test from 'node:test';
import assert from 'node:assert/strict';
import { RedisSessions } from '../lib/sessions.js';

test('shared sessions restore across instances and atomically consume a pending challenge once', async (t) => {
  const records = new Map(), calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const [command, ...args] = JSON.parse(options.body); calls.push([command, ...args]);
    let result;
    if (command === 'GET') result = records.get(args[0]) || null;
    else if (command === 'EVAL' && args[0].includes("'INCR'")) {
      result = (records.get(args[2]) || 0) + 1; records.set(args[2], result);
    } else {
      const [, , key, previous, next, ttl] = args;
      assert.equal(ttl, 7200);
      result = (records.get(key) || '') === previous ? 1 : 0;
      if (result) records.set(key, next);
    }
    return Response.json({ result });
  });
  const verifier = { identity() {}, signature() {} };
  const a = new RedisSessions('https://test.invalid', 'not-a-real-token');
  const b = new RedisSessions('https://test.invalid', 'not-a-real-token');
  const first = await a.run(null, verifier, (session) => { session.game.pending = { id: 'one-use' }; session.game.fuel = 0; return session.game.id; });
  const restored = await b.run(first.id, verifier, (session) => session.game.state());
  assert.equal(restored.result.fuel, 0);
  assert.equal(typeof restored.result.refuelCost, 'number');
  const consume = (session) => {
    if (!session.game.pending) return false;
    session.game.pending = null; session.game.sequence++; return true;
  };
  const results = await Promise.all([a.run(first.id, verifier, consume), b.run(first.id, verifier, consume)]);
  assert.equal(results.filter((value) => value.result).length, 1);
  assert.equal((await a.run(first.id, verifier, (session) => session.game.sequence)).result, 1);
  assert.ok(calls.some(([command]) => command === 'EVAL'));
  const key = 'starproof:session:' + first.id;
  const legacy = JSON.parse(records.get(key));
  delete legacy.game.economyVersion;
  legacy.game.fuel = 0; legacy.game.credits = 2;
  legacy.game.claims = ['kepler']; legacy.game.maps = ['home', 'nebula'];
  legacy.game.pending = { id: 'old-fuel-price' };
  records.set(key, JSON.stringify(legacy));
  const upgraded = await b.run(first.id, verifier, (session) => {
    assert.equal(session.game.pending, null);
    assert.equal(session.game.fuel, 8);
    assert.equal(session.game.credits, 8);
    session.game.fuel = 3;
    return session.game.state();
  });
  assert.deepEqual(upgraded.result.claims, ['kepler']);
  assert.deepEqual(upgraded.result.maps, ['home', 'nebula']);
  assert.equal((await a.run(first.id, verifier, (session) => session.game.fuel)).result, 3);
  const veteran = JSON.parse(records.get(key));
  veteran.game.claims = ['kepler', 'lyra', 'cinder', 'moss'];
  veteran.game.maps = ['home', 'nebula', 'frontier'];
  records.set(key, JSON.stringify(veteran));
  const expanded = await b.run(first.id, verifier, session => session.game.state());
  assert.ok(expanded.result.maps.includes('north') && expanded.result.maps.includes('south'));
  assert.equal(expanded.result.fuel, 3, 'galaxy expansion must not reset existing resources');
  assert.deepEqual(expanded.result.claims, veteran.game.claims);
  for (let i = 0; i < 9; i++) await a.run(null, verifier, () => null);
  await assert.rejects(a.run(null, verifier, () => null), /Too many new missions/);
});

test('shared storage failures never report a successful mutation', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'storage failure' }, { status: 500 }));
  const store = new RedisSessions('https://test.invalid', 'not-a-real-token');
  await assert.rejects(store.run('a'.repeat(64), {}, () => true), /storage is unavailable/);
});
