import { createPublicClient, encodeAbiParameters, getAddress, http, keccak256, toHex, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import artifact from './monsters-artifact.json' with { type: 'json' };
import { MONSTERS, hasEncounterProof } from '../public/monster-catalog.js';

export const ENCOUNTER_TYPES = { Encounter: [
  { name: 'deviceId', type: 'bytes32' }, { name: 'worldId', type: 'uint8' },
  { name: 'recipient', type: 'address' }, { name: 'deadline', type: 'uint256' },
] };
export function encounterTypedData(contract, chainId, message) {
  return { domain: { name: 'StarproofMonsters', version: '1', chainId, verifyingContract: contract },
    types: ENCOUNTER_TYPES, primaryType: 'Encounter', message: { ...message, deadline: BigInt(message.deadline) } };
}
export const monsterDeviceId = keyId => {
  if (!/^[0-9a-f]{64}$/.test(keyId)) throw new Error('Invalid factory key.');
  return keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }],
    [keccak256(toHex('starproof-monsters-v1')), '0x' + keyId]));
};

export function createMonsters({ verifier, rpcUrl = process.env.MONSTERS_RPC_URL || process.env.AIRDROP_RPC_URL,
  contract = process.env.MONSTERS_CONTRACT, issuerKey = process.env.MONSTERS_ISSUER_PRIVATE_KEY || process.env.AIRDROP_ISSUER_PRIVATE_KEY,
  chain = base, now = Date.now } = {}) {
  let account, client;
  try {
    if (issuerKey) account = privateKeyToAccount(issuerKey.trim());
    if (contract) contract = getAddress(contract);
    if (rpcUrl && contract && account) {
      const url = new URL(rpcUrl);
      if (!['https:', 'http:'].includes(url.protocol) || (process.env.VERCEL && url.protocol !== 'https:')) throw new Error();
      client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 8000, retryCount: 0 }) });
    }
  } catch { client = null; }
  let cached, checking;
  async function inspectConfig() {
    const result = { enabled: false, chainId: chain.id, chainName: chain.name, contract: client ? contract : null };
    if (!client) return { ...result, reason: 'Monster minting is awaiting contract setup.' };
    try {
      const [id, code, issuer] = await Promise.all([client.getChainId(), client.getCode({ address: contract }),
        client.readContract({ address: contract, abi: artifact.abi, functionName: 'issuer' })]);
      const mask = hex => {
        const bytes = Buffer.from((hex || '').replace(/^0x/, ''), 'hex');
        for (const refs of Object.values(artifact.immutableReferences)) for (const { start, length } of refs) bytes.fill(0, start, start + length);
        return bytes.toString('hex');
      };
      if (id !== chain.id || !code || mask(code) !== mask(artifact.deployedBytecode) || issuer !== account.address) throw new Error();
      return { ...result, enabled: true, reason: null };
    } catch { return { ...result, reason: 'The monster contract could not be verified on the configured network.' }; }
  }
  async function config() {
    if (cached && cached.until > now()) return cached.value;
    if (!checking) checking = inspectConfig().then(value => { cached = { value, until: now() + 5000 }; return value; }).finally(() => { checking = null; });
    return checking;
  }
  async function voucher(game, { world, recipient }, origin) {
    const monster = MONSTERS.find(item => item.id === world);
    if (!monster) throw new Error('Choose a world with a monster.');
    recipient = getAddress(recipient);
    if (recipient === zeroAddress) throw new Error('Choose a world encounter and a nonzero receiving wallet.');
    const receipt = game.receipts.find(item => item.target === world && hasEncounterProof(item));
    if (!game.claims.includes(world) || !receipt) throw new Error('Recover this world’s artifact with Wedgie confirmation first. Unsigned demo claims cannot mint.');
    const device = verifier.identity(receipt.cert, now());
    if (device.fingerprint !== game.device || receipt.fingerprint !== game.device) throw new Error('The receipt belongs to another chip.');
    // Reconstruct the approved action: a mutable receipt label is never minting evidence.
    const fields = Object.fromEntries(receipt.text.split('\n').slice(1).map(line => line.split('=')));
    if (fields.origin !== origin || fields.session !== game.id || fields.chip !== device.fingerprint || fields.action !== 'claim'
      || fields.target !== world || fields.from !== world || fields.cost !== '0' || receipt.text.split('\n')[0] !== 'starproof/v1') throw new Error('The encounter receipt does not match this mission.');
    verifier.signature(device, receipt.text, receipt);
    const ready = await config();
    if (!ready.enabled) throw new Error(ready.reason);
    const message = { deviceId: monsterDeviceId(device.keyId), worldId: monster.worldId, recipient, deadline: Math.floor(now() / 1000) + 300 };
    return { ...message, authorization: await account.signTypedData(encounterTypedData(contract, chain.id, message)), contract, chainId: chain.id };
  }
  return { config, voucher: async (...args) => {
    try { return await voucher(...args); }
    catch (error) {
      if (/^(Choose a world|Recover this|The receipt|The encounter|Monster minting|The monster contract)/.test(error.message)) throw error;
      throw new Error('Could not authorize the monster mint. Check the recipient and signed encounter.');
    }
  } };
}
