import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicClient, createWalletClient, defineChain, http, hashTypedData, recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { Game } from '../lib/game.js';
import { createMonsters, encounterTypedData } from '../lib/monsters.js';
import { MONSTERS, hasEncounterProof } from '../public/monster-catalog.js';
import { writeConfirmed } from '../vendor/collectibles.js';
import artifact from '../lib/monsters-artifact.json' with { type: 'json' };
import { testIdentity } from './fixtures/pki.js';
import { readFile } from 'node:fs/promises';
const origin = 'http://localhost:4178';
const account = '0x1111111111111111111111111111111111111111';
const issuerKey = '0x' + BigInt(0xA11CE).toString(16).padStart(64, '0'); // Public local-test key only.
function mission() {
  const identity = testIdentity(), game = new Game(identity.verifier);
  const sign = (action, target) => { const pending = game.challenge(action, target, identity.certificate, origin); game.complete(pending.id, identity.signAction(pending.text)); };
  sign('launch', 'sol'); sign('jump', 'kepler'); sign('claim', 'kepler');
  return { ...identity, game, sign };
}
test('monster IDs and static metadata cover exactly the existing 18 monster worlds', async () => {
  assert.equal(MONSTERS.length, 18);
  for (const monster of MONSTERS) {
    assert.ok(monster.worldId >= 2 && monster.worldId <= 20 && monster.worldId !== 4);
    const metadata = JSON.parse(await readFile(new URL('../public/monsters/' + monster.worldId + '.json', import.meta.url)));
    assert.equal(metadata.name, monster.resident);
    assert.match(await readFile(new URL('../public/monsters/' + monster.worldId + '.svg', import.meta.url), 'utf8'), /<svg/);
  }
});
test('mint eligibility rejects unsigned, relabeled, cross-mission and wrong-origin receipts before issuing anything', async () => {
  const { game, verifier } = mission();
  const monsters = createMonsters({ verifier });
  const args = { world: 'kepler', recipient: account };
  await assert.rejects(monsters.voucher(game, args, 'https://another.example'), /does not match/);
  const claim = game.receipts[0];
  delete claim.verification;
  assert.equal(hasEncounterProof(claim), true);
  await assert.rejects(monsters.voucher(game, args, origin), /awaiting contract setup/, 'legacy receipts must pass the same cryptographic checks');
  const originalSignature = claim.r;
  claim.r = '00'.repeat(32);
  await assert.rejects(monsters.voucher(game, args, origin), /signed encounter/, 'a legacy label never bypasses signature verification');
  claim.r = originalSignature;
  claim.verification = 'demo'; await assert.rejects(monsters.voucher(game, args, origin), /Unsigned/);
  claim.verification = 'trustm';
  game.id = 'different'; await assert.rejects(monsters.voucher(game, args, origin), /does not match/);
  game.id = claim.text.split('\n').find(line => line.startsWith('session=')).slice(8);
  claim.text = claim.text.replace('action=claim', 'action=jump');
  await assert.rejects(monsters.voucher(game, args, origin), /does not match/);
  assert.equal((await createMonsters({ rpcUrl:'SECRET-RPC',contract:'SECRET-CONTRACT',issuerKey:'SECRET-KEY' }).config()).enabled, false);
});
test('wallet writes simulate, submit and await confirmation, and reject reverted transactions', async () => {
  const calls = [];
  const client = {
    simulateContract: async request => { calls.push('simulate'); return {request}; },
    waitForTransactionReceipt: async () => { calls.push('confirmed'); return {status:'success'}; },
  };
  const connection = { account, client, wallet: { writeContract: async () => { calls.push('submit'); return '0x123'; } } };
  assert.equal(await writeConfirmed(connection, account, [], 'example', []), '0x123');
  assert.deepEqual(calls, ['simulate', 'submit', 'confirmed']);
  client.waitForTransactionReceipt = async () => ({status:'reverted'});
  await assert.rejects(writeConfirmed(connection, account, [], 'example', []), /reverted/);
});
const forkUrl = process.env.MONSTERS_FORK_URL;
test('Base fork: existing signed game claim produces an onchain ERC721 once, without any new device request', {skip:!forkUrl,timeout:60000}, async t => {
  assert.ok(['localhost','127.0.0.1'].includes(new URL(forkUrl).hostname));
  const chain = defineChain({...base,id:31337});
  const client = createPublicClient({chain,transport:http(forkUrl)});
  assert.equal(await client.getChainId(),31337);
  const snapshot = await client.request({method:'evm_snapshot'});
  t.after(() => client.request({method:'evm_revert',params:[snapshot]}));
  const [account] = await client.request({method:'eth_accounts'});
  const wallet = createWalletClient({account,chain,transport:http(forkUrl)});
  const issuer = privateKeyToAccount(issuerKey);
  const deployed = await client.waitForTransactionReceipt({hash:await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode,args:[issuer.address,'https://starproof-wedgie.vercel.app/monsters/']})});
  const contract = deployed.contractAddress;
  const {game,verifier} = mission();
  const monsters = createMonsters({verifier,rpcUrl:forkUrl,contract,issuerKey,chain});
  assert.equal((await monsters.config()).enabled,true);
  const recipient = '0x1234567890123456789012345678901234567890';
  assert.equal(await client.getCode({address:recipient}),undefined);
  const voucher = await monsters.voucher(game,{world:'kepler',recipient},origin);
  const typed = encounterTypedData(contract,31337,voucher);
  assert.equal(await recoverTypedDataAddress({...typed,signature:voucher.authorization}),issuer.address);
  assert.equal(await client.readContract({address:contract,abi:artifact.abi,functionName:'encounterDigest',args:[voucher.deviceId,2,recipient,BigInt(voucher.deadline)]}),hashTypedData(typed));
  const args = [voucher.deviceId,2,recipient,BigInt(voucher.deadline),voucher.authorization];
  const {request} = await client.simulateContract({account,address:contract,abi:artifact.abi,functionName:'mint',args});
  const minted = await client.waitForTransactionReceipt({hash:await wallet.writeContract({...request,gas:500000n})});
  assert.equal(minted.status,'success');
  await assert.rejects(client.simulateContract({account,address:contract,abi:artifact.abi,functionName:'mint',args}));
});

test('the selected existing airdrop issuer and RPC are reused unless monster-specific overrides are supplied', async t => {
  const keys = ['AIRDROP_RPC_URL','AIRDROP_ISSUER_PRIVATE_KEY','MONSTERS_RPC_URL','MONSTERS_ISSUER_PRIVATE_KEY','MONSTERS_CONTRACT'];
  const before = Object.fromEntries(keys.map(key => [key,process.env[key]]));
  t.after(() => { for (const [key,value] of Object.entries(before)) { if(value===undefined)delete process.env[key];else process.env[key]=value; } });
  process.env.AIRDROP_RPC_URL='http://127.0.0.1:1'; process.env.AIRDROP_ISSUER_PRIVATE_KEY=issuerKey;
  delete process.env.MONSTERS_RPC_URL; delete process.env.MONSTERS_ISSUER_PRIVATE_KEY; delete process.env.MONSTERS_CONTRACT;
  assert.equal((await createMonsters().config()).enabled,false,'a shared issuer alone never enables an undeployed collection');
  process.env.MONSTERS_CONTRACT='0x1111111111111111111111111111111111111111';
  const config=await createMonsters().config();
  assert.equal(config.contract,process.env.MONSTERS_CONTRACT,'the shared issuer/RPC configure a client without requiring duplicated secrets');
  assert.equal(config.enabled,false,'unreachable RPC must fail closed');
  assert.ok(!JSON.stringify(config).includes(issuerKey));
});
