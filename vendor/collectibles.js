import { createPublicClient, createWalletClient, custom, getAddress, keccak256, toHex, zeroAddress } from 'viem';
import { packetToBytes } from 'viem/ens';
import { base, mainnet } from 'viem/chains';
import { PROFILE_KEYS, resolverAbi, currentResolver, profileNames, readProfile, textCall } from '../public/ens-profile.js';
import artifact from '../lib/monsters-artifact.json' with { type: 'json' };
export { profileNames, readProfile, base, mainnet };

export async function connectWallet(provider, chain = base, progress = () => {}) {
  if (!provider) throw new Error('Open Starproof in a browser with an Ethereum wallet.');
  progress('Connect your wallet to Starproof…');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts[0]) throw new Error('Choose a wallet account.');
  if (BigInt(await provider.request({ method: 'eth_chainId' })) !== BigInt(chain.id)) {
    progress('Switch your wallet to ' + chain.name + '…');
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toHex(chain.id) }] });
  }
  if (BigInt(await provider.request({ method: 'eth_chainId' })) !== BigInt(chain.id)) throw new Error('Switch your wallet to ' + chain.name + '.');
  const current = await provider.request({ method: 'eth_accounts' });
  if (String(current[0]).toLowerCase() !== String(accounts[0]).toLowerCase()) throw new Error('Wallet account changed. Reconnect before continuing.');
  const account = getAddress(current[0]);
  // ENS resolution stays in the user's wallet; no public RPC or third-party gateway is proxied by our server.
  const client = createPublicClient({ chain, transport: custom(provider), ccipRead: false });
  const wallet = createWalletClient({ account, chain, transport: custom(provider) });
  return { account, client, wallet };
}
export async function writeConfirmed(connection, address, abi, functionName, args) {
  const { client, wallet, account } = connection;
  const { request } = await client.simulateContract({ address, abi, functionName, args, account });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180000 });
  if (receipt.status !== 'success') throw new Error('The transaction reverted.');
  return hash;
}
export async function publishProfile(connection, names, progress = () => {}) {
  const { client, account } = connection;
  const addresses = await Promise.all(Object.values(names).map(name => client.getEnsAddress({ name })));
  if (addresses.some(address => address?.toLowerCase() !== account.toLowerCase())) throw new Error('Both names must resolve to your connected wallet. Set their address records in ENS first.');
  for (const [name, key, value] of [[names.captain, PROFILE_KEYS.ship, names.ship], [names.ship, PROFILE_KEYS.captain, names.captain]]) {
    progress('Review the profile record for ' + name + ' in your wallet…');
    const resolver = await currentResolver(client, name);
    await writeConfirmed(connection, resolver, resolverAbi, 'setText', [toHexName(name), key, value]);
  }
  return readProfile(client, names);
}
function toHexName(name) {
  return toHex(packetToBytes(name));
}
export async function delegateLogbook(connection, names, delegate, revoke = false) {
  delegate = getAddress(delegate);
  if (delegate === zeroAddress || delegate === connection.account) throw new Error('Choose a different navigator wallet.');
  const resolver = await currentResolver(connection.client, names.ship);
  return writeConfirmed(connection, resolver, resolverAbi, revoke ? 'revokeRoles' : 'grantSetterRoles', revoke
    ? [BigInt(keccak256(toHex(PROFILE_KEYS.logbook))), 1n << 4n, delegate]
    : [textCall(names.ship, PROFILE_KEYS.logbook, ''), delegate]);
}
export async function writeLogbook(connection, names, value) {
  if (!value.trim() || value.length > 280) throw new Error('Write a logbook entry of 1–280 characters.');
  const resolver = await currentResolver(connection.client, names.ship);
  return writeConfirmed(connection, resolver, resolverAbi, 'setText', [toHexName(names.ship), PROFILE_KEYS.logbook, value.trim()]);
}
export async function mintMonster(connection, voucher) {
  if (voucher.chainId !== base.id || getAddress(voucher.recipient) !== connection.account) throw new Error('Reconnect the receiving wallet on Base.');
  return writeConfirmed(connection, voucher.contract, artifact.abi, 'mint',
    [voucher.deviceId, voucher.worldId, voucher.recipient, BigInt(voucher.deadline), voucher.authorization]);
}
export async function deployMonsters(connection, issuer, progress = () => {}) {
  if (connection.wallet.chain.id !== base.id) throw new Error('Deploy the monster collection on Base.');
  issuer = getAddress(issuer);
  if (issuer === zeroAddress) throw new Error('Choose a nonzero proof issuer.');
  progress('Review the Base contract deployment and gas fee in your wallet…');
  const hash = await connection.wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode,
    args: [issuer, 'https://starproof-wedgie.vercel.app/monsters/'] });
  progress('Deployment sent. Waiting for Base confirmation…');
  const receipt = await connection.client.waitForTransactionReceipt({ hash, timeout: 180000 });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Monster deployment failed.');
  return { hash, address: receipt.contractAddress };
}
