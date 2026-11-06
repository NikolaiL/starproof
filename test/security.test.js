import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
import { execFileSync } from 'node:child_process';
import { X509Certificate, sign } from 'node:crypto';
import { createTrustVerifier } from 'wedgie-actions/server';
import { Game } from '../lib/game.js';
import { SECTORS, MAPS, chartedWorlds, jumpCost } from '../public/protocol.js';
import { createApp } from '../server.js';

const deviceDir = fileURLToPath(new URL('device/', new URL('.', import.meta.resolve('starproof-device/package.json'))));
const pythonEnv = { ...process.env, STARPROOF_DEVICE_DIR: deviceDir };
const dir = mkdtempSync(join(tmpdir(), 'starproof-tests-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const openssl = (...args) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
openssl('req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'root.key', '-out', 'root.pem', '-subj', '/CN=Starproof TEST ROOT', '-days', '2', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:1', '-addext', 'keyUsage=critical,keyCertSign,cRLSign');
for (const [name, subject] of [['issuer', '/CN=Starproof TEST ISSUER'], ['device', '/CN=Starproof TEST DEVICE']]) {
  openssl('req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', name + '.key', '-out', name + '.csr', '-subj', subject);
  writeFileSync(join(dir, name + '.ext'), name === 'issuer' ? 'basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\n' : 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n');
  const parent = name === 'issuer' ? 'root' : 'issuer';
  openssl('x509', '-req', '-in', name + '.csr', '-CA', parent + '.pem', '-CAkey', parent + '.key', '-CAcreateserial', '-out', name + '.pem', '-days', '1', '-extfile', name + '.ext');
}
const cert = (name) => new X509Certificate(readFileSync(join(dir, name + '.pem')));
const device = cert('device'), root = cert('root'), issuer = cert('issuer');
const certificate = device.raw.toString('hex');
const key = readFileSync(join(dir, 'device.key'));
const verifier = createTrustVerifier([root], [issuer]);
const signText = (text) => {
  const signature = sign('sha256', Buffer.from(text, 'ascii'), { key, dsaEncoding: 'ieee-p1363' });
  return { r: signature.subarray(0, 32).toString('hex'), s: signature.subarray(32).toString('hex') };
};
const origin = 'http://localhost:4173';
function approved(game, action, target) {
  const challenge = game.challenge(action, target, certificate, origin);
  return game.complete(challenge.id, signText(challenge.text));
}

// Certificate-chain and signature verification are tested in wedgie-actions; these tests cover the game and its HTTP API.
test('launch, jump and claim require signatures; proof replay and substituted actions fail', () => {
  const game = new Game(verifier);
  assert.throws(() => game.challenge('jump', 'kepler', certificate, origin), /Sign the launch/);
  assert.throws(() => game.challenge('launch', 'vega', certificate, origin), /launch from Sol/);
  const launch = game.challenge('launch', 'sol', certificate, origin);
  const proof = signText(launch.text);
  game.complete(launch.id, proof);
  assert.equal(game.state().started, true);
  assert.throws(() => game.complete(launch.id, proof), /already used/);
  assert.throws(() => game.challenge('launch', 'sol', certificate, origin), /already launched/);
  const jump = game.challenge('jump', 'kepler', certificate, origin);
  assert.throws(() => game.complete(jump.id, signText(jump.text.replace('target=kepler', 'target=vega'))), /did not sign/);
  assert.equal(game.state().location, 'sol');
  game.complete(jump.id, signText(jump.text));
  assert.equal(game.state().fuel, 6);
  assert.equal(game.state().location, 'kepler');
  assert.throws(() => game.challenge('claim', 'vega', certificate, origin), /Travel/);
  approved(game, 'claim', 'kepler');
  assert.deepEqual(game.state().claims, ['kepler']);
  assert.throws(() => game.challenge('claim', 'kepler', certificate, origin), /already/);
  assert.equal(game.state().receipts.length, 3);
});

test('expired, cancelled, cross-session and replaced challenges cannot commit', () => {
  let now = Date.now();
  const game = new Game(verifier, () => now);
  const first = game.challenge('launch', 'sol', certificate, origin);
  now += 91_000;
  assert.throws(() => game.complete(first.id, signText(first.text)), /expired/);
  now -= 91_000;
  const cancelled = game.challenge('launch', 'sol', certificate, origin);
  game.pending = null;
  assert.throws(() => game.complete(cancelled.id, signText(cancelled.text)), /cancelled/);
  const old = game.challenge('launch', 'sol', certificate, origin);
  const fresh = game.challenge('launch', 'sol', certificate, origin);
  assert.throws(() => game.complete(old.id, signText(old.text)), /unknown/);
  const other = new Game(verifier), otherChallenge = other.challenge('launch', 'sol', certificate, origin);
  assert.throws(() => other.complete(otherChallenge.id, signText(fresh.text)), /did not sign/);
});

test('demo confirmation settings default to signed actions, preserve launch approval and never fabricate proofs', () => {
  const game = new Game(verifier);
  assert.throws(() => game.act('jump', 'kepler'), /requires Wedgie/);
  assert.throws(() => game.setConfirmations({ launch: false }), /Invalid/);
  assert.throws(() => game.setConfirmations({ jump: false, claim: 'false' }), /Invalid/);
  assert.equal(game.confirmations.jump, true, 'invalid settings cannot partially apply');
  game.setConfirmations({ jump: false, claim: false, refuel: false, scavenge: false });
  assert.throws(() => game.act('launch', 'sol'), /requires Wedgie/);
  assert.throws(() => game.act('jump', 'kepler'), /Sign the launch/);
  approved(game, 'launch', 'sol');
  const chip = game.device;
  assert.throws(() => game.act('jump', 'rift'), /star map/);
  game.act('jump', 'kepler');
  game.act('claim', 'kepler');
  game.act('refuel', 'kepler');
  game.fuel = 0;
  game.act('scavenge', 'kepler');
  assert.equal(game.fuel, 2);
  assert.equal(game.device, chip);
  for (const receipt of game.receipts.slice(0, 4)) {
    assert.equal(receipt.verification, 'demo');
    assert.equal(receipt.cert, undefined); assert.equal(receipt.r, undefined); assert.equal(receipt.text, undefined);
  }
  assert.equal(game.receipts.at(-1).verification, 'trustm');
  const pending = game.challenge('jump', 'sol', certificate, origin);
  game.setConfirmations({ jump: true });
  assert.throws(() => game.complete(pending.id, signText(pending.text)), /unknown/);
  assert.throws(() => game.act('jump', 'sol'), /requires Wedgie/);
});

test('HTTP confirmation switches are mission-local and unsigned actions retain origin and launch checks', async (t) => {
  const app = createApp(verifier);
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const base = `http://127.0.0.1:${app.address().port}`;
  const cookie = (await fetch(base + '/api/state')).headers.get('set-cookie').split(';')[0];
  const post = (path, body, extra = {}) => fetch(base + '/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie, ...extra }, body: JSON.stringify(body) });
  assert.equal((await post('settings', { jump: false }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('settings', { launch: false })).status, 400);
  assert.equal((await post('settings', { jump: false })).status, 200);
  assert.equal((await post('act', { action: 'jump', target: 'kepler' })).status, 400);
  const launch = await (await post('challenge', { action: 'launch', target: 'sol', cert: certificate })).json();
  assert.equal((await post('commit', { id: launch.id, ...signText(launch.text) })).status, 200);
  const travel = await (await post('act', { action: 'jump', target: 'kepler' })).json();
  assert.equal(travel.location, 'kepler');
  assert.equal(travel.receipts[0].verification, 'demo');
  assert.equal((await post('act', { action: 'claim', target: 'kepler' })).status, 400);
  const another = await (await fetch(base + '/api/state')).json();
  assert.equal(another.confirmations.jump, true);
});

test('fuel caches, paid refills, distance pricing and scavenging keep exploration playable', () => {
  const game = new Game(verifier);
  approved(game, 'launch', 'sol');
  assert.equal(game.fuel, 8); assert.equal(game.credits, 8);
  assert.deepEqual(game.state().maps, ['home']);
  assert.throws(() => game.challenge('jump', 'vega', certificate, origin), /star map/);
  assert.throws(() => game.challenge('refuel', 'sol', certificate, origin), /already full/);
  approved(game, 'jump', 'kepler');
  assert.equal(game.fuel, 6);
  game.fuel = 0;
  assert.throws(() => game.challenge('jump', 'sol', certificate, origin), /Not enough jump fuel/);
  assert.throws(() => game.challenge('refuel', 'sol', certificate, origin), /current planet/);
  const refill = game.challenge('refuel', 'kepler', certificate, origin);
  assert.match(refill.text, /cost=0/);
  assert.throws(() => game.complete(refill.id, signText(refill.text.replace('cost=0', 'cost=4'))), /did not sign/);
  game.complete(refill.id, signText(refill.text));
  assert.equal(game.fuel, 8); assert.equal(game.credits, 8);
  assert.throws(() => game.complete(refill.id, signText(refill.text)), /already used/);
  approved(game, 'claim', 'kepler');
  assert.deepEqual(game.maps, ['home', 'nebula']);
  approved(game, 'jump', 'lyra');
  assert.throws(() => game.challenge('jump', 'cinder', certificate, origin), /star map/);
  approved(game, 'claim', 'lyra');
  assert.deepEqual(game.maps, ['home', 'nebula', 'frontier']);
  approved(game, 'refuel', 'lyra');
  approved(game, 'jump', 'moss');
  approved(game, 'refuel', 'moss');
  approved(game, 'jump', 'kepler');
  const purchase = game.challenge('refuel', 'kepler', certificate, origin);
  assert.equal(purchase.cost, 4);
  game.complete(purchase.id, signText(purchase.text));
  assert.equal(game.credits, 12); assert.equal(game.fuel, 8);
  game.fuel = 0; game.credits = 0;
  assert.throws(() => game.challenge('refuel', 'kepler', certificate, origin), /Not enough credits/);
  assert.throws(() => game.challenge('scavenge', 'sol', certificate, origin), /current planet/);
  for (let i = 0; i < 4; i++) approved(game, 'scavenge', 'kepler');
  assert.equal(game.fuel, 8); assert.equal(game.credits, 0);
  assert.throws(() => game.challenge('scavenge', 'kepler', certificate, origin), /already full/);
  approved(game, 'jump', 'moss');
  assert.equal(game.fuel, 2);
  assert.throws(() => game.challenge('claim', 'unknown', certificate, origin), /Unknown destination/);
  game.verifier = { identity: () => ({ fingerprint: 'different' }) };
  assert.throws(() => game.challenge('claim', 'moss', certificate, origin), /chip that launched/);
});

test('all twenty artifacts and branching charts can be recovered without paid fuel or grinding', () => {
  const game = new Game(verifier);
  approved(game, 'launch', 'sol');
  while (game.claims.length < SECTORS.length) {
    const target = chartedWorlds(game.maps).find(world => !game.claims.includes(world.id))?.id;
    assert.ok(target, 'every chart has a reachable route to the next discoveries');
    if (target !== game.location) {
      if (game.fuel < jumpCost(game.location, target)) approved(game, 'refuel', game.location);
      approved(game, 'jump', target);
    }
    approved(game, 'claim', target);
  }
  assert.equal(game.claims.length, 20);
  assert.equal(game.credits, 88);
  assert.deepEqual([...game.maps].sort(), MAPS.map(map => map.id).sort());
});

test('MicroPython parser accepts the exact browser format and rejects hidden/unsupported actions', () => {
  const game = new Game(verifier);
  const text = game.challenge('launch', 'sol', certificate, origin).text;
  const python = `import sys,json\nsys.path.insert(0,__import__('os').environ['STARPROOF_DEVICE_DIR'])\nfrom starproof_protocol import parse_action,certificate_der\nv=json.load(sys.stdin)\nassert parse_action(v['text'])['action']=='launch'\nassert certificate_der(bytes.fromhex(v['wrapped'])).hex()==v['cert']\nfor bad in v['bad']:\n try: parse_action(bad)\n except ValueError: pass\n else: raise AssertionError('accepted invalid action')\nprint('device protocol OK')`;
  const bad = [text + '\n', text.replace('action=launch', 'action=withdraw'), text.replace('cost=0', 'cost=99'), text.replace('sequence=0', 'sequence=01'), text.replace('target=sol', 'target=vega'), text.replace('origin=http://localhost:4173', 'origin=https://evil.example'), text.replace('origin=http://localhost:4173', 'origin=http://localhost:evil.example:443'),text.replace('from=sol', 'from=sol\naction=claim'), text.replace('starproof/v1', 'other/v1'), text + '\u0000'];
  const result = execFileSync('python3', ['-c', python], { cwd: new URL('..', import.meta.url), env: pythonEnv, input: JSON.stringify({ text, cert: certificate, wrapped: 'c00000' + certificate, bad }), encoding: 'utf8' });
  assert.match(result, /device protocol OK/);
});

test('device polls cancellation by request ID without accepting a remote approval', () => {
  const game = new Game(verifier);
  const text = game.challenge('launch', 'sol', certificate, origin).text;
  assert.match(execFileSync('python3', ['test/device-cancel.py'], { cwd: new URL('..', import.meta.url), env: pythonEnv, input: JSON.stringify({ text }), encoding: 'utf8' }), /device request cancellation OK/);
});

test('device artwork fits every destination without covering the firmware title or answer bars', () => {
  assert.match(execFileSync('python3', ['test/device-art.py'], { cwd: new URL('..', import.meta.url), env: pythonEnv, encoding: 'utf8' }), /device art preserves controls OK/);
});

test('device validates both refuel prices and all newly discovered destinations', () => {
  const game = new Game(verifier);
  approved(game, 'launch', 'sol');
  approved(game, 'jump', 'kepler');
  const free = game.challenge('refuel', 'kepler', certificate, origin).text;
  const paid = free.replace('cost=0', 'cost=4');
  const frontier = free.replace('action=refuel', 'action=jump').replace('target=kepler', 'target=moss').replace('cost=0', 'cost=' + jumpCost('kepler', 'moss'));
  const python = `import sys,json\nsys.path.insert(0,__import__('os').environ['STARPROOF_DEVICE_DIR'])\nfrom starproof_protocol import parse_action\nv=json.load(sys.stdin)\nfor text in v['valid']: parse_action(text)\nfor text in v['invalid']:\n try: parse_action(text)\n except ValueError: pass\n else: raise AssertionError('invalid refuel accepted')\nprint('refuel protocol OK')`;
  const invalid = [free.replace('cost=0', 'cost=9'), free.replace('cost=0', 'cost=04'), free.replace('target=kepler', 'target=sol')];
  assert.match(execFileSync('python3', ['-c', python], { cwd: new URL('..', import.meta.url), env: pythonEnv, input: JSON.stringify({ valid: [free, paid, frontier], invalid }), encoding: 'utf8' }), /refuel protocol OK/);
});

test('browser and MicroPython compute identical signed fuel costs for every route', () => {
  const game = new Game(verifier);
  const launch = game.challenge('launch', 'sol', certificate, origin).text;
  const routes = SECTORS.flatMap((from) => SECTORS.filter((to) => to !== from).map((to) => ({
    text: launch.replace('action=launch', 'action=jump').replace('from=sol', 'from=' + from.id).replace('target=sol', 'target=' + to.id).replace('cost=0', 'cost=' + jumpCost(from.id, to.id)),
  })));
  const python = `import sys,json\nsys.path.insert(0,__import__('os').environ['STARPROOF_DEVICE_DIR'])\nfrom starproof_protocol import parse_action\nfor route in json.load(sys.stdin):\n fields=parse_action(route['text'])\n try: parse_action(route['text'].replace('cost='+fields['cost'],'cost=1'))\n except ValueError: pass\n else: raise AssertionError('cheap forged jump accepted')\nprint('all route costs match')`;
  assert.match(execFileSync('python3', ['-c', python], { env: pythonEnv, input: JSON.stringify(routes), encoding: 'utf8' }), /all route costs match/);
});

test('HTTP serves the game, isolates sessions and refuses cross-origin, oversized and fake device requests', async (t) => {
  const app = createApp();
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => app.close(resolve)));
  const base = `http://127.0.0.1:${app.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Space gets weird/);
  assert.match(html, /property="og:image" content="https:\/\/starproof-wedgie.vercel.app\/media\/starproof-og.png"/);
  assert.match(html, /rel="icon" href="\/favicon.svg"/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  for (const [asset, width, height] of [['/media/starproof-cover.png',1600,900],['/media/starproof-og.png',1200,630],['/favicon-16.png',16,16],['/favicon-32.png',32,32],['/apple-touch-icon.png',180,180]]) {
    const response = await fetch(base + asset);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), width); assert.equal(bytes.readUInt32BE(20), height);
  }
  const favicon = await fetch(base + '/favicon.ico');
  assert.match(favicon.headers.get('content-type'), /image\/x-icon/);
  assert.equal(Buffer.from(await favicon.arrayBuffer()).readUInt16LE(2), 1);
  for (const asset of ['/graphics.js', '/navigation.js', '/approval.js']) {
    const response = await fetch(base + asset);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
  }
  const sdk = await fetch(base + '/sdk.js');
  assert.equal(sdk.status, 200);
  const sdkText = await sdk.text();
  assert.match(sdkText, /constructor\(app\)/);
  assert.doesNotMatch(sdkText, /starproof_hello/);
  const unknown = await fetch(base + '/api/unknown');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get('set-cookie'), null);
  const response = await fetch(base + '/api/state');
  assert.doesNotMatch(response.headers.get('set-cookie'), /max-age/i);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal((await response.json()).started, false);
  const post = (path, body, extra = {}) => fetch(base + '/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie, ...extra }, body: JSON.stringify(body) });
  assert.equal((await post('device', { cert: certificate })).status, 400);
  assert.equal((await post('device', { cert: certificate }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('challenge', { cert: certificate, action: 'launch', target: 'sol' })).status, 400);
  assert.equal((await post('commit', { id: 'invented', r: '0'.repeat(64), s: '0'.repeat(64) })).status, 400);
  assert.equal((await post('device', { cert: '0'.repeat(17_000) })).status, 413);
  assert.equal((await fetch(base + '/api/state', { headers: { cookie } })).headers.get('set-cookie'), null);
  assert.equal((await fetch(base + '/../../server.js')).status, 404);
});

test('HTTP commits a signed action, honors cancel and keeps launched games when sessions fill up', async (t) => {
  const app = createApp(verifier);
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => app.close(resolve)));
  const base = `http://127.0.0.1:${app.address().port}`;
  const cookie = (await fetch(base + '/api/state')).headers.get('set-cookie').split(';')[0];
  const post = async (path, body) => (await fetch(base + '/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) })).json();
  const launch = await post('challenge', { cert: certificate, action: 'launch', target: 'sol' });
  assert.ok(launch.text.startsWith(`starproof/v1\norigin=${base}\n`));
  assert.equal((await post('commit', { id: launch.id, ...signText(launch.text) })).started, true);
  const jump = await post('challenge', { cert: certificate, action: 'jump', target: 'kepler' });
  assert.deepEqual(await post('cancel', {}), { cancelled: true });
  assert.match((await post('commit', { id: jump.id, ...signText(jump.text) })).error, /cancelled/);
  for (let i = 0; i < 100; i++) assert.equal((await fetch(base + '/api/state')).status, 200);
  const state = await (await fetch(base + '/api/state', { headers: { cookie } })).json();
  assert.equal(state.started, true);
  assert.equal(state.location, 'sol');
});

test('deployed API binds the canonical HTTPS origin and uses a secure session cookie', async (t) => {
  const origin = 'https://starproof-wedgie.vercel.app';
  const app = createApp(verifier, { origin });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => app.close(resolve)));
  const base = `http://127.0.0.1:${app.address().port}`;
  assert.equal((await fetch(base + '/api/state')).status, 403);
  const send = (path, method = 'GET', body, sentOrigin = origin) => new Promise((resolve, reject) => {
    const request = httpRequest(base + path, { method, headers: { host: new URL(origin).host, origin: sentOrigin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) } }, (response) => {
      let text = ''; response.setEncoding('utf8'); response.on('data', (chunk) => text += chunk);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, data: JSON.parse(text) }));
    });
    request.on('error', reject); request.end(body && JSON.stringify(body));
  });
  let cookie;
  const response = await send('/api/state');
  assert.equal(response.status, 200);
  assert.match(response.headers['set-cookie'][0], /Secure/);
  cookie = response.headers['set-cookie'][0].split(';')[0];
  const body = { cert: certificate, action: 'launch', target: 'sol' };
  const challenge = (await send('/api/challenge', 'POST', body)).data;
  assert.match(challenge.text, /^starproof\/v1\norigin=https:\/\/starproof-wedgie.vercel.app\n/);
  assert.equal((await send('/api/challenge', 'POST', body, 'https://other.example')).status, 403);
});
