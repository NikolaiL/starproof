import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { createPublicClient,createWalletClient,defineChain,encodeFunctionData,getAddress,hashTypedData,http,parseAbi,parseEventLogs } from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {base} from 'viem/chains';
import {MemorySessions} from '../lib/sessions.js';
import {createAirdrop,deviceClaimId,claimTypedData,ADMIN} from '../lib/airdrop.js';
import {SAFE_FACTORY,SAFE_L2,signerAddress,verifySafe} from '../lib/safe.js';
import artifact from '../lib/airdrop-artifact.json' with {type:'json'};
import {TOKEN} from '../public/token.js';
import {createApp} from '../server.js';
import {testIdentity} from './fixtures/pki.js';

const forkUrl=process.env.BASE_FORK_URL;
test('issuer configuration accepts surrounding secret-input whitespace without exposing the key',async()=>{
  const issuerKey='0x'+BigInt(0xA11CE).toString(16).padStart(64,'0');
  const drop=createAirdrop({issuerKey:' \n'+issuerKey+'\n'});
  const result=await drop.config();
  assert.equal(result.issuer,privateKeyToAccount(issuerKey).address);
  assert.equal(result.enabled,false);
  assert.ok(!JSON.stringify(result).includes(issuerKey));
});
test('an unconfigured drop stays disabled without leaking invalid secret configuration',async()=>{
  const drop=createAirdrop({rpcUrl:'not a URL',contract:'SECRET-CONFIGURATION',issuerKey:'SECRET-KEY'});
  const result=await drop.config();
  assert.equal(result.enabled,false);
  assert.equal(result.contract,null);
  assert.doesNotMatch(JSON.stringify(result),/SECRET/);
});

test('Safe lookup bypasses payout configuration and claim checks', async t => {
  const identity = testIdentity();
  const session = { game: { device: null } };
  const body = { cert: identity.certificate, wallet: identity.wallet };
  const owner = signerAddress(identity.wallet);
  const lookup = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(String(url), `https://safe-transaction-base.safe.global/api/v1/owners/${owner}/safes/`);
    return Response.json({ safes: [] });
  });
  const issuerKey = '0x' + 'a11ce'.padStart(64, '0');
  for (const options of [{ rpcUrl: '', contract: '', issuerKey: '' }, { rpcUrl: 'https://payout.invalid', contract: TOKEN.address, issuerKey }]) {
    const drop = createAirdrop({ verifier: identity.verifier, ...options });
    assert.deepEqual(await drop.handle('/api/airdrop/wallets', session, body), { owner, safes: [], discoveryUnavailable: false });
  }
  assert.equal(lookup.mock.callCount(), 2);
});

test('real-token fork: certified device proof selects a genuine Safe and pays once through HTTP', {skip:!forkUrl,timeout:90000},async t=>{
  const url=new URL(forkUrl);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  const identity=testIdentity();
  const chain=defineChain({...base,id:31337,name:'Local Base fork'});
  const client=createPublicClient({chain,transport:http(forkUrl)});
  assert.equal(await client.getChainId(),31337);
  const snapshot=await client.request({method:'evm_snapshot'});
  t.after(()=>client.request({method:'evm_revert',params:[snapshot]}));
  await client.request({method:'anvil_impersonateAccount',params:[ADMIN]});
  await client.request({method:'anvil_setBalance',params:[ADMIN,'0x8ac7230489e80000']});
  const wallet=createWalletClient({account:ADMIN,chain,transport:http(forkUrl)});
  const issuerKey='0x'+BigInt(0xA11CE).toString(16).padStart(64,'0'); // Public local-test account only.
  const issuer=privateKeyToAccount(issuerKey);
  await client.request({method:'anvil_setBalance',params:[issuer.address,'0x8ac7230489e80000']});
  const hash=await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode,args:[ADMIN,issuer.address]});
  const deployed=await client.waitForTransactionReceipt({hash});assert.equal(deployed.status,'success');
  const contract=deployed.contractAddress;
  const tokenAbi=parseAbi(['function transfer(address,uint256) returns(bool)','function balanceOf(address) view returns(uint256)']);
  await client.waitForTransactionReceipt({hash:await wallet.writeContract({address:TOKEN.address,abi:tokenAbi,functionName:'transfer',args:[contract,10_000n*10n**18n]})});
  const owner=signerAddress(identity.wallet);
  const initializer=encodeFunctionData({abi:parseAbi(['function setup(address[],uint256,address,bytes,address,address,uint256,address)']),functionName:'setup',args:[[owner],1n,'0x'+'0'.repeat(40),'0x','0x'+'0'.repeat(40),'0x'+'0'.repeat(40),0n,'0x'+'0'.repeat(40)]});
  const factoryAbi=parseAbi(['function createProxyWithNonce(address,bytes,uint256) returns(address)','event ProxyCreation(address indexed proxy,address singleton)']);
  const made=await client.waitForTransactionReceipt({hash:await wallet.writeContract({address:SAFE_FACTORY,abi:factoryAbi,functionName:'createProxyWithNonce',args:[SAFE_L2,initializer,13579n]})});
  const recipient=getAddress(parseEventLogs({abi:factoryAbi,logs:made.logs,eventName:'ProxyCreation'})[0].args.proxy);
  assert.equal(await verifySafe(client,recipient,identity.wallet),recipient);
  await assert.rejects(verifySafe(client,TOKEN.address,identity.wallet),/supported Safe/);
  const deadline=Math.floor(Date.now()/1000)+180,deviceId=deviceClaimId(identity.verifier.identity(identity.certificate).keyId);
  const contractHash=await client.readContract({address:contract,abi:artifact.abi,functionName:'claimDigest',args:[deviceId,recipient,BigInt(deadline)]});
  assert.equal(contractHash,hashTypedData(claimTypedData(contract,deviceId,recipient,deadline,31337)));
  const store=new MemorySessions();
  const drop=createAirdrop({store,verifier:identity.verifier,rpcUrl:forkUrl,contract,issuerKey,chain});
  const config=await drop.config();assert.equal(config.enabled,true);assert.equal(config.remainingClaims,'10');
  const app=createApp(identity.verifier,{store,airdrop:drop});await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>app.close(resolve)));
  const origin='http://127.0.0.1:'+app.address().port;
  const first=await fetch(origin+'/api/state');const cookie=first.headers.get('set-cookie').split(';')[0];
  const post=async(path,body,extra={})=>{const response=await fetch(origin+'/api/airdrop/'+path,{method:'POST',headers:{'content-type':'application/json',cookie,...extra},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const request={cert:identity.certificate,wallet:identity.wallet,recipient};
  assert.equal((await post('challenge',request,{origin:'https://evil.example'})).status,403);
  let challenge=await post('challenge',request);assert.equal(challenge.status,200);
  assert.equal((await post('cancel',{})).body.cancelled,true);
  assert.equal((await post('proof',{cert:identity.certificate,id:challenge.body.id,proof:identity.prove(challenge.body.text)})).status,400);
  challenge=await post('challenge',request);
  const proof=identity.prove(challenge.body.text);
  assert.equal((await post('proof',{cert:identity.certificate,id:challenge.body.id,proof:{...proof,code:'wrong'}})).status,400);
  assert.equal((await post('proof',{cert:identity.certificate,id:challenge.body.id,proof})).body.authorized,true);
  assert.equal((await post('proof',{cert:identity.certificate,id:challenge.body.id,proof})).status,400,'a consumed proof must not be authorized again');
  assert.equal((await post('cancel',{})).body.cancelled,true);
  assert.equal((await post('submit',{cert:identity.certificate})).status,400,'cancel must revoke an unsubmitted authorization');
  const approvedAgain=await post('challenge',request);
  assert.equal((await post('proof',{cert:identity.certificate,id:approvedAgain.body.id,proof:identity.prove(approvedAgain.body.text)})).body.authorized,true);
  let result=await post('submit',{cert:identity.certificate});assert.equal(result.status,200);
  for(let i=0;i<10 && !result.body.claimed;i++){
    await new Promise(resolve=>setTimeout(resolve,500));
    result=await post('status',{cert:identity.certificate});
  }
  assert.equal(result.body.claimed,true,JSON.stringify(result));
  assert.equal(await client.readContract({address:TOKEN.address,abi:tokenAbi,functionName:'balanceOf',args:[recipient]}),1000n*10n**18n);
  assert.equal(await client.readContract({address:contract,abi:artifact.abi,functionName:'claimed',args:[deviceId]}),true);
  assert.equal((await post('challenge',request)).body.claimed,true,'new claims cannot reset eligibility');
});
