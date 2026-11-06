import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeFunctionData,erc20Abi} from 'viem';
import {administrator,deployRequest,fundRequest,waitReceipt} from '../public/vendor/airdrop-wallet.js';
import artifact from '../lib/airdrop-artifact.json' with {type:'json'};
import {ADMIN} from '../lib/airdrop.js';
import {TOKEN} from '../public/token.js';
const issuer='0x1111111111111111111111111111111111111111';
const distributor='0x2222222222222222222222222222222222222222';

test('setup requests bind Base and encode exact funding without an approval',()=>{
  const deploy=deployRequest(artifact,issuer,ADMIN);
  assert.equal(deploy.chainId,'0x2105'); assert.equal(deploy.from,ADMIN); assert.ok(deploy.data.startsWith(artifact.bytecode));
  for(const bad of ['',ADMIN,'0x'+'0'.repeat(40),'0x'+'a'.repeat(64)]) assert.throws(()=>deployRequest(artifact,bad,ADMIN));
  const fund=fundRequest(distributor,'3',ADMIN);
  assert.equal(fund.chainId,'0x2105'); assert.equal(fund.to,TOKEN.address);
  const decoded=decodeFunctionData({abi:erc20Abi,data:fund.data});
  assert.equal(decoded.functionName,'transfer'); assert.deepEqual(decoded.args,[distributor,3000n*10n**18n]);
  for(const bad of ['', '0','-1','1.5','01','1000000']) assert.throws(()=>fundRequest(distributor,bad,ADMIN));
});
test('setup rejects other wallets and verifies the network after switching',async()=>{
  await assert.rejects(administrator(null),/deployment wallet/);
  await assert.rejects(administrator({request:async()=>[issuer]}),/deployment wallet/);
  let chain='0x1'; const calls=[];
  const provider={request:async({method})=>{calls.push(method);if(method==='eth_requestAccounts')return[ADMIN];if(method==='eth_chainId')return chain;if(method==='wallet_switchEthereumChain')chain='0x2105';}};
  assert.equal(await administrator(provider),ADMIN);assert.ok(calls.includes('wallet_switchEthereumChain'));
  chain='0x1';provider.request=async({method})=>method==='eth_requestAccounts'?[ADMIN]:method==='eth_chainId'?'0x1':undefined;
  await assert.rejects(administrator(provider),/Switch the wallet/);
});
test('setup detects reverted transactions',async()=>{
  await assert.rejects(waitReceipt({request:async()=>({status:'0x0'})},'0xhash'),/reverted/);
  assert.deepEqual(await waitReceipt({request:async()=>({status:'0x1',contractAddress:distributor})},'0xhash'),{status:'0x1',contractAddress:distributor});
});
