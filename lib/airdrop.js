import { createHash, randomBytes } from 'node:crypto';
import { createPublicClient, createWalletClient, encodeAbiParameters, getAddress, http, keccak256, parseAbi, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { trustM } from 'wedgie-actions/server';
import artifact from './airdrop-artifact.json' with { type: 'json' };
import { TOKEN } from '../public/token.js';
import { findSafes, verifySafe } from './safe.js';
import { ClaimRelay } from './airdrop-relay.js';

export const ADMIN = '0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6';
export const CAMPAIGN_ID = keccak256(toHex('starproof-airdrop-v1'));
export const CLAIM_TYPES = { Claim: [{name:'campaignId',type:'bytes32'},{name:'deviceId',type:'bytes32'},{name:'recipient',type:'address'},{name:'token',type:'address'},{name:'amount',type:'uint256'},{name:'deadline',type:'uint256'}] };
const ERC20 = parseAbi(['function balanceOf(address) view returns (uint256)']);
const FIELDS = ['origin','chain','token','amount','recipient','distributor','campaign','chip','expires','nonce'];
export const deviceClaimId = keyId => {
  if (!/^[0-9a-f]{64}$/.test(keyId)) throw new Error('Invalid factory-key identity.');
  return keccak256(encodeAbiParameters([{type:'bytes32'},{type:'bytes32'}],[CAMPAIGN_ID,'0x'+keyId]));
};
export function claimTypedData(contract, deviceId, recipient, deadline, chainId = TOKEN.chainId) {
  return {domain:{name:'StarproofAirdrop',version:'1',chainId,verifyingContract:contract},types:CLAIM_TYPES,primaryType:'Claim',message:{campaignId:CAMPAIGN_ID,deviceId,recipient,token:TOKEN.address,amount:BigInt(TOKEN.claimAmountUnits),deadline:BigInt(deadline)}};
}
function expectedRuntime(code) {
  const mask = hex => {
    const bytes=Buffer.from(hex.replace(/^0x/,''),'hex');
    for(const refs of Object.values(artifact.immutableReferences || {}))for(const {start,length}of refs)bytes.fill(0,start,start+length);
    return bytes.toString('hex');
  };
  return !!code && mask(code)===mask(artifact.deployedBytecode);
}

export function createAirdrop({store,verifier=trustM,rpcUrl=process.env.AIRDROP_RPC_URL,contract=process.env.AIRDROP_CONTRACT,issuerKey=process.env.AIRDROP_ISSUER_PRIVATE_KEY,chain=base,now=Date.now}={}) {
  let account,client,wallet,relay,configError;
  try {
    if(issuerKey) {
      issuerKey=issuerKey.trim();
      if(!/^0x[0-9a-f]{64}$/i.test(issuerKey))throw new Error();
      account=privateKeyToAccount(issuerKey);
      if(account.address.toLowerCase()===ADMIN.toLowerCase())throw new Error();
    }
    if(contract)contract=getAddress(contract);
    if(rpcUrl && account && contract) {
      const rpc=new URL(rpcUrl);
      if(!['https:','http:'].includes(rpc.protocol) || (process.env.VERCEL && rpc.protocol!=='https:'))throw new Error();
      client=createPublicClient({chain,transport:http(rpcUrl,{timeout:8000,retryCount:0})});
      wallet=createWalletClient({account,chain,transport:http(rpcUrl,{timeout:8000,retryCount:0})});
      relay=new ClaimRelay({store,client,wallet,account,contract,abi:artifact.abi,chainId:chain.id});
    }
  }catch { configError='The claim service configuration is invalid.'; account=null; client=null; }
  const publicConfig={token:TOKEN,admin:ADMIN,contract:typeof contract==='string' && /^0x[0-9a-f]{40}$/i.test(contract)?contract:null,issuer:account?.address||null};
  const read = (name,args=[]) => client.readContract({address:contract,abi:artifact.abi,functionName:name,args});
  let cached;
  async function config() {
    if(!client || configError) return {...publicConfig,enabled:false,reason:configError || 'The airdrop distributor is not configured yet.'};
    if(cached && cached.until>now())return cached.value;
    const [chainId,code,token,amount,campaign,issuer,owner,paused,balance,gas] = await Promise.all([
      client.getChainId(),client.getCode({address:contract}),read('TOKEN'),read('CLAIM_AMOUNT'),read('CAMPAIGN_ID'),read('issuer'),read('owner'),read('paused'),client.readContract({address:TOKEN.address,abi:ERC20,functionName:'balanceOf',args:[contract]}),
      client.getBalance({address:account.address}),
    ]);
    if(chainId!==chain.id || !expectedRuntime(code) || token.toLowerCase()!==TOKEN.address.toLowerCase() || amount!==BigInt(TOKEN.claimAmountUnits) || campaign!==CAMPAIGN_ID || issuer.toLowerCase()!==account.address.toLowerCase() || owner.toLowerCase()!==ADMIN.toLowerCase())throw new Error('The configured distributor does not match this airdrop.');
    const remaining=(balance/BigInt(TOKEN.claimAmountUnits)).toString();
    const reason=paused?'Claims are paused.':balance<BigInt(TOKEN.claimAmountUnits)?'The airdrop needs token funding.':gas===0n?'The claim service needs Base ETH for gas.':null;
    const value={...publicConfig,enabled:!reason,remainingClaims:remaining,reason};
    cached={until:now()+5000,value};return value;
  }
  function identity(session,cert) {
    const device=verifier.identity(cert,now());
    if(session.game.device && session.game.device!==device.fingerprint)throw new Error('Reconnect the chip that launched this mission.');
    return device;
  }
  async function ready() {const state=await config();if(!state.enabled)throw new Error(state.reason);}
  async function handle(path,session,body,origin) {
    if(path==='/api/airdrop')return config();
    if(path==='/api/airdrop/cancel'){session.airdropPending=null;session.airdropVoucher=null;return {cancelled:true};}
    const device=identity(session,body.cert),deviceId=deviceClaimId(device.keyId);
    if(path==='/api/airdrop/status') {
      if(!client)return {claimed:false,configured:false};
      const claimed=await read('claimed',[deviceId]),job=await relay.status(deviceId);
      const authorized=session.airdropVoucher?.deviceId===deviceId && session.airdropVoucher.deadline>Math.floor(now()/1000);
      return {claimed,configured:true,txHash:job?.hash||null,status:claimed?'confirmed':job?.status|| (authorized?'authorized':'unclaimed'),retry:!claimed && authorized};
    }
    await ready();
    if(await read('claimed',[deviceId]))return {...(await relay.job(deviceId) || {}),claimed:true,status:'confirmed'};
    if(path==='/api/airdrop/wallets')return findSafes(client,body.wallet);
    if(path==='/api/airdrop/challenge') {
      const recipient=await verifySafe(client,body.recipient,body.wallet);
      const nonce=randomBytes(32).toString('hex'),expires=Math.floor(now()/1000)+180;
      const fields={origin,chain:String(TOKEN.chainId),token:TOKEN.address.toLowerCase(),amount:TOKEN.claimAmountUnits,recipient:recipient.toLowerCase(),distributor:contract.toLowerCase(),campaign:CAMPAIGN_ID,chip:device.fingerprint,expires:String(expires),nonce};
      const text='starproof_airdrop/v1\n'+FIELDS.map(key=>key+'='+fields[key]).join('\n');
      session.airdropPending={id:nonce,text,nonce,expires,recipient,wallet:body.wallet,keyId:device.keyId};
      return {id:nonce,text,expires,recipient,token:TOKEN};
    }
    if(path==='/api/airdrop/proof') {
      const pending=session.airdropPending;
      if(!pending || pending.id!==body.id || pending.expires<=Math.floor(now()/1000))throw new Error('The claim expired or was cancelled. Request it again.');
      const proven=verifier.walletProof(body.proof,pending.text,pending.nonce,now());
      if(proven.keyId!==device.keyId || proven.keyId!==pending.keyId || ['x','y'].some(key=>proven.wallet[key].toLowerCase()!==String(pending.wallet?.[key]).toLowerCase()))throw new Error('The claim proof is for another wallet or chip.');
      await verifySafe(client,pending.recipient,proven.wallet);
      const authorization=await account.signTypedData(claimTypedData(contract,deviceId,pending.recipient,pending.expires,chain.id));
      session.airdropVoucher={deviceId,recipient:pending.recipient,deadline:pending.expires,authorization};
      session.airdropPending=null;
      return {authorized:true,recipient:pending.recipient};
    }
    if(path==='/api/airdrop/submit') {
      const voucher=session.airdropVoucher;
      if(!voucher || voucher.deviceId!==deviceId || voucher.deadline<=Math.floor(now()/1000))throw new Error('Approve a fresh claim on the Wedgie first.');
      return {relay:voucher};
    }
    throw new Error('Unknown airdrop request.');
  }
  // Never forward viem transport errors: they can include the private RPC URL.
  function cleanError(error) {
    const message=String(error?.message || '');
    if(/^(Reconnect |The claim |The configured |The connected |The airdrop |Claims are |Choose a |This Safe |Invalid Safe |Approve a |Unknown airdrop)/.test(message))return new Error(message);
    return new Error('Could not complete the Base claim request. Check the receiving Safe or try again shortly.');
  }
  return {
    handle:async(...args)=>{try{return await handle(...args);}catch(error){throw cleanError(error);}},
    submit:async voucher=>{try{return await relay.submit(voucher);}catch(error){throw cleanError(error);}},
    config:async()=>{try{return await config();}catch(error){return {...publicConfig,enabled:false,reason:cleanError(error).message};}},
  };
}
