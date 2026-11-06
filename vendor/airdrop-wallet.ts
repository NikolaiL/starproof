import { encodeDeployData, encodeFunctionData, erc20Abi, getAddress } from 'viem';
const ADMIN = '0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6';
const TOKEN = '0x469F27BC9CA19d78455867aAFc7aA4186d3cCccC';

export async function administrator(provider: any) {
  if (!provider) throw new Error('Open this page in a browser with your token deployment wallet.');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (String(accounts[0]).toLowerCase() !== ADMIN.toLowerCase()) throw new Error('Connect the token deployment wallet shown on this page.');
  if (BigInt(await provider.request({ method: 'eth_chainId' })) !== 8453n) {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
  }
  if (BigInt(await provider.request({ method: 'eth_chainId' })) !== 8453n) throw new Error('Switch the wallet to Base mainnet.');
  return accounts[0];
}
export function deployRequest(artifact: any, issuer: string, from: string) {
  if (!/^0x[0-9a-f]{40}$/i.test(issuer)) throw new Error('Enter the public issuer address, never a private key.');
  const key = getAddress(issuer);
  if (key === '0x' + '0'.repeat(40) || key.toLowerCase() === ADMIN.toLowerCase()) throw new Error('Use a dedicated claim issuer address, separate from the administrator.');
  return { from, chainId: '0x2105', data: encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args: [ADMIN, key] }), value: '0x0' };
}
export function fundRequest(distributor: string, count: string, from: string) {
  if (!/^[1-9][0-9]{0,5}$/.test(count)) throw new Error('Enter a whole number from 1 to 999999 claims.');
  return { from, chainId: '0x2105', to: TOKEN, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [getAddress(distributor), BigInt(count) * 1000n * 10n ** 18n] }), value: '0x0' };
}
export async function waitReceipt(provider: any, hash: string) {
  for (let i = 0; i < 90; i++) {
    const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) { if (receipt.status !== '0x1') throw new Error('The transaction reverted.'); return receipt; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('The transaction is still pending. Check it on BaseScan before trying again.');
}
