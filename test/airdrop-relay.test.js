import test from 'node:test';
import assert from 'node:assert/strict';
import {ClaimRelay} from '../lib/airdrop-relay.js';
import artifact from '../lib/airdrop-artifact.json' with {type:'json'};

function fixture(){
  const state={prepares:0,sends:[],mined:false,networkDown:true,claimed:false,nonceUsed:false};
  const client={
    async getTransactionReceipt(){if(!state.mined)throw Object.assign(new Error('not mined'),{name:'TransactionReceiptNotFoundError'});return {status:'success'};},
    async sendRawTransaction({serializedTransaction}){state.sends.push(serializedTransaction);if(state.nonceUsed)throw new Error('nonce too low');if(state.networkDown)throw new Error('network down');return '0x'+'a'.repeat(64);},
    async readContract(){return state.claimed;},async getTransactionCount(){return state.nonceUsed?1:0;},
  };
  const wallet={async prepareTransactionRequest(){state.prepares++;return {nonce:state.prepares-1};},async signTransaction(request){return request.nonce===0?'0x1234':'0x5678';}};
  const options={store:{},client,wallet,account:{address:'0x'+'1'.repeat(40)},contract:'0x'+'2'.repeat(40),abi:artifact.abi,chainId:31337};
  const voucher={deviceId:'0x'+'3'.repeat(64),recipient:'0x'+'4'.repeat(40),deadline:Math.floor(Date.now()/1000)+180,authorization:'0x'+'5'.repeat(130)};
  return {state,options,voucher};
}

test('interrupted broadcasts recover the identical durable transaction across relay instances',async()=>{
  const {state,options,voucher}=fixture();
  const first=new ClaimRelay(options);
  assert.equal((await first.submit(voucher)).status,'pending');
  assert.equal(state.prepares,1);
  const restarted=new ClaimRelay(options);state.networkDown=false;
  assert.equal((await restarted.submit(voucher)).status,'pending');
  assert.equal(state.prepares,1);
  assert.deepEqual(state.sends,['0x1234','0x1234']);
  state.mined=true;state.claimed=true;
  assert.equal((await restarted.status(voucher.deviceId)).status,'confirmed');
  assert.equal((await restarted.submit(voucher)).claimed,true);
  assert.equal(state.prepares,1);
});

test('a replaced consumed nonce releases the relay without consuming chip eligibility',async()=>{
  const {state,options,voucher}=fixture();const relay=new ClaimRelay(options);
  await relay.submit(voucher);
  state.nonceUsed=true;
  const result=await relay.status(voucher.deviceId);
  assert.equal(result.status,'failed');assert.equal(result.hash,null);assert.equal(state.claimed,false);
  assert.equal(await relay.get(':active'),null);
  state.nonceUsed=false;
  await relay.submit({...voucher,deviceId:'0x'+'6'.repeat(64)});
  assert.equal(state.prepares,2);
});

test('concurrent claim requests serialize nonce preparation',async()=>{
  const {state,options,voucher}=fixture();const relay=new ClaimRelay(options);
  const [a,b]=await Promise.all([relay.submit(voucher),relay.submit({...voucher,deviceId:'0x'+'7'.repeat(64)})]);
  assert.equal(a.status,'pending');assert.equal(b.status,'pending');assert.equal(state.prepares,1);
});
