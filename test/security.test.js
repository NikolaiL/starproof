import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { X509Certificate, sign, generateKeyPairSync } from 'node:crypto';
import { createTrustVerifier, trustM, certificateFromHex } from '../lib/verifier.js';
import { Game } from '../lib/game.js';
import { createApp } from '../server.js';

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
const signText = (text, signingKey = key) => {
  const signature = sign('sha256', Buffer.from(text, 'ascii'), { key: signingKey, dsaEncoding: 'ieee-p1363' });
  return { r: signature.subarray(0, 32).toString('hex'), s: signature.subarray(32).toString('hex') };
};
const origin = 'http://localhost:4173';
function approved(game, action, target) {
  const challenge = game.challenge(action, target, certificate, origin);
  return game.complete(challenge.id, signText(challenge.text));
}

test('production verifier rejects a software-generated PKI, copied certificate alone and malformed data', () => {
  assert.throws(() => trustM.identity(certificate), /pinned Infineon/);
  assert.throws(() => trustM.identity('gg'.repeat(400)), /Malformed/);
  const identity = verifier.identity(certificate);
  assert.throws(() => verifier.signature(identity, 'launch', {}), /Malformed/);
  const attacker = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  assert.throws(() => verifier.signature(identity, 'launch', signText('launch', attacker.privateKey)), /did not sign/);
  assert.throws(() => verifier.identity(certificate, Date.parse(device.validTo) + 1000), /expired/);
  assert.throws(() => createTrustVerifier([root], []).identity(certificate), /pinned/);
});

test('DER certificate wrappers are handled without trusting certificate names', () => {
  assert.equal(certificateFromHex('c00000' + certificate).fingerprint256, device.fingerprint256);
  assert.throws(() => verifier.identity(root.raw.toString('hex')), /device certificate/);
  assert.throws(() => certificateFromHex('00'.repeat(300)), /decode/);
});

test('launch, jump and claim require signatures; proof replay and substituted actions fail', () => {
  const game = new Game(verifier);
  assert.throws(() => game.challenge('jump', 'kepler', certificate, origin), /Sign the launch/);
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
  assert.equal(game.state().fuel, 7);
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

test('game rules enforce finite fuel and preserve the registered chip', () => {
  const game = new Game(verifier);
  approved(game, 'launch', 'sol');
  for (let i = 0; i < 8; i++) approved(game, 'jump', i % 2 ? 'sol' : 'vega');
  assert.equal(game.state().fuel, 0);
  assert.throws(() => game.challenge('jump', 'lyra', certificate, origin), /No jump fuel/);
  assert.throws(() => game.challenge('claim', 'unknown', certificate, origin), /Unknown destination/);
  assert.throws(() => game.challenge('teleport', 'sol', certificate, origin), /Unknown strategic/);
  const wrongDevice = { identity: () => ({ fingerprint: 'different' }) };
  game.verifier = wrongDevice;
  assert.throws(() => game.challenge('claim', 'sol', certificate, origin), /chip that launched/);
});

test('MicroPython parser accepts the exact browser format and rejects hidden/unsupported actions', () => {
  const game = new Game(verifier);
  const text = game.challenge('launch', 'sol', certificate, origin).text;
  const python = `import sys,json\nsys.path.insert(0,'device')\nfrom starproof_protocol import parse_action,certificate_der\nv=json.load(sys.stdin)\nassert parse_action(v['text'])['action']=='launch'\nassert certificate_der(bytes.fromhex(v['wrapped'])).hex()==v['cert']\nfor bad in v['bad']:\n try: parse_action(bad)\n except ValueError: pass\n else: raise AssertionError('accepted invalid action')\nprint('device protocol OK')`;
  const bad = [text + '\n', text.replace('action=launch', 'action=withdraw'), text.replace('cost=0', 'cost=99'), text.replace('sequence=0', 'sequence=01'), text.replace('target=sol', 'target=vega'), text.replace('origin=http://localhost:4173', 'origin=https://evil.example'), text.replace('from=sol', 'from=sol\naction=claim'), text.replace('starproof/v1', 'other/v1'), text + '\u0000'];
  const result = execFileSync('python3', ['-c', python], { cwd: new URL('..', import.meta.url), input: JSON.stringify({ text, cert: certificate, wrapped: 'c00000' + certificate, bad }), encoding: 'utf8' });
  assert.match(result, /device protocol OK/);
});

test('HTTP serves the game, isolates sessions and refuses cross-origin, oversized and fake device requests', async (t) => {
  const app = createApp();
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => app.close(resolve)));
  const base = `http://127.0.0.1:${app.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /A mission/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const response = await fetch(base + '/api/state');
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
