// Safe owner derivation constants from wedgie-safe/safe_addr.py (MIT); see vendor/WEDGIE-LICENSE.txt.
import { concatHex, encodeAbiParameters, getAddress, getCreate2Address, keccak256, parseAbi, padHex } from 'viem';

export const SAFE_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';
export const SAFE_L2 = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762';
export const SAFE_ABI = parseAbi(['function isOwner(address) view returns (bool)']);
// Hashes of unmodified deployed bytecode from @safe-global/safe-contracts 1.4.1-2 artifacts.
const PROXY_HASH = '0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c';
const IMPLEMENTATIONS = new Map([
  [SAFE_L2.toLowerCase(), '0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff'],
  ['0x41675c099f32341bf84bfc5382af534df5c7461a5','0x1fe2df852ba3299d6534ef416eefa406e56ced995bca886ab7a553e6d0c5e1c4'],
]);
const OWNER_FACTORY = '0x1d31F259eE307358a26dFb23EB365939E8641195';
const OWNER_SINGLETON = '0x4E27b51350e6c2083EE19011120F50DAfEc5CA50';
const OWNER_PROXY = '0x610100346100ad57601f6101b538819003918201601f19168301916001600160401b038311848410176100b2578084926080946040528339810103126100ad578051906001600160a01b03821682036100ad5760208101516040820151606090920151926001600160b01b03841684036100ad5760805260a05260c05260e05260405160ec90816100c98239608051816082015260a05181604d015260c051816027015260e0518160010152f35b600080fd5b634e487b7160e01b600052604160045260246000fdfe7f000000000000000000000000000000000000000000000000000000000000000060b63601527f000000000000000000000000000000000000000000000000000000000000000060a03601527f000000000000000000000000000000000000000000000000000000000000000036608001523660006080376000806056360160807f00000000000000000000000000000000000000000000000000000000000000005af43d600060803e60b1573d6080fd5b3d6080f3fea26469706673582212201660515548d15702d720bbc046b457ca85e941a4559ab9f9518488e4c82e5ee964736f6c634300081a0033';

export function signerAddress(wallet) {
  if (!wallet || !['x','y'].every(key => /^0x[0-9a-f]{64}$/i.test(wallet[key]))) throw new Error('Invalid Safe wallet public key.');
  const init = concatHex([OWNER_PROXY, encodeAbiParameters([{type:'address'},{type:'bytes32'},{type:'bytes32'},{type:'uint256'}], [OWNER_SINGLETON, wallet.x, wallet.y, 0x100n << 160n])]);
  return getCreate2Address({ from: OWNER_FACTORY, salt: padHex('0x00', {size:32}), bytecodeHash: keccak256(init) });
}

export async function verifySafe(client, address, wallet) {
  const safe = getAddress(address), owner = signerAddress(wallet);
  if (keccak256(await client.getCode({address:safe}) || '0x') !== PROXY_HASH) throw new Error('Choose a deployed, supported Safe 1.4.1 wallet.');
  const singleton = '0x' + (await client.getStorageAt({address:safe,slot:padHex('0x00',{size:32})})).slice(-40).toLowerCase();
  const expected = IMPLEMENTATIONS.get(singleton);
  if (!expected || keccak256(await client.getCode({address:getAddress(singleton)}) || '0x') !== expected) throw new Error('This Safe implementation is not supported by the airdrop.');
  if (!await client.readContract({address:safe,abi:SAFE_ABI,functionName:'isOwner',args:[owner]})) throw new Error('The connected Wedgie is not an owner of this Safe.');
  return safe;
}

export async function findSafes(client, wallet) {
  const owner = signerAddress(wallet);
  let data;
  try {
    const response = await fetch('https://safe-transaction-base.safe.global/api/v1/owners/'+owner+'/safes/', {signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('Safe discovery unavailable');
    data = await response.json();
  } catch { return {owner,safes:[],discoveryUnavailable:true}; }
  const candidates = [...new Set(Array.isArray(data.safes) ? data.safes.filter(value=>typeof value==='string').slice(0,20) : [])];
  const results = await Promise.allSettled(candidates.map(address=>verifySafe(client,address,wallet)));
  return {owner,safes:results.filter(r=>r.status==='fulfilled').map(r=>r.value),discoveryUnavailable:false};
}
