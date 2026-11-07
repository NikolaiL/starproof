import { createPublicClient, createWalletClient, custom, getAddress, toHex, zeroAddress } from 'viem';
import { base } from 'viem/chains';
import artifact from '../lib/monsters-artifact.json' with { type: 'json' };
export { base };

export async function connectWallet(provider, chain = base, progress = () => {}) {
  if (!provider) throw new Error('Open Starproof in a browser with an Ethereum wallet.');
  const request = async args => {
    let timer;
    try { return await Promise.race([provider.request(args), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Wallet connection timed out. Open your wallet or choose another wallet and try again.')), 60000); })]); }
    finally { clearTimeout(timer); }
  };
  progress('Connect your wallet to Starproof…');
  const accounts = await request({ method: 'eth_requestAccounts' });
  if (!accounts[0]) throw new Error('Choose a wallet account.');
  if (BigInt(await request({ method: 'eth_chainId' })) !== BigInt(chain.id)) {
    progress('Switch your wallet to ' + chain.name + '…');
    await request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toHex(chain.id) }] });
  }
  if (BigInt(await request({ method: 'eth_chainId' })) !== BigInt(chain.id)) throw new Error('Switch your wallet to ' + chain.name + '.');
  const current = await request({ method: 'eth_accounts' });
  if (String(current[0]).toLowerCase() !== String(accounts[0]).toLowerCase()) throw new Error('Wallet account changed. Reconnect before continuing.');
  const account = getAddress(current[0]);
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
