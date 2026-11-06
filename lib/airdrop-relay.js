import { randomBytes } from 'node:crypto';
import { encodeFunctionData, keccak256 } from 'viem';

// One durable active transaction per relayer avoids serverless nonce races and survives interrupted sends.
// shortcut: a persistently underpriced pending transaction needs operator replacement before this serial relay can advance.
export class ClaimRelay {
  constructor({store,client,wallet,account,contract,abi,chainId}) {
    Object.assign(this,{store,client,wallet,account,contract,abi});
    this.prefix='starproof:relay:'+chainId+':'+contract.toLowerCase()+':'+account.address.toLowerCase();
    this.memory=store ? (store.relayEntries ||= new Map()) : new Map();
  }
  async get(key) { const raw=this.store?.command?await this.store.command('GET',this.prefix+key):this.memory.get(key);return raw?JSON.parse(raw):null; }
  async lock(token) {
    if(this.store?.command)return await this.store.command('SET',this.prefix+':lock',token,'NX','EX',45)==='OK';
    const old=this.memory.get(':lock');if(old && old.until>Date.now())return false;
    this.memory.set(':lock',{token,until:Date.now()+45000});return true;
  }
  async unlock(token) {
    if(this.store?.command)await this.store.command('EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,this.prefix+':lock',token);
    else if(this.memory.get(':lock')?.token===token)this.memory.delete(':lock');
  }
  async record(token,job,active) {
    const json=JSON.stringify(job);
    if(this.store?.command){
      const ok=await this.store.command('EVAL',"if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2]); if ARGV[3]=='1' then redis.call('SET',KEYS[3],ARGV[2]) else redis.call('DEL',KEYS[3]) end return 1",3,this.prefix+':lock',this.prefix+':job:'+job.deviceId,this.prefix+':active',token,json,active?'1':'0');
      if(ok!==1)throw new Error('The claim relay is busy. Try again shortly.');
    }else{
      if(this.memory.get(':lock')?.token!==token || this.memory.get(':lock').until<=Date.now())throw new Error('The claim relay is busy. Try again shortly.');
      this.memory.set(':job:'+job.deviceId,json);
      if(active)this.memory.set(':active',json);else this.memory.delete(':active');
    }
  }
  async job(deviceId) {
    const job=await this.get(':job:'+deviceId);
    return job?{status:job.status,hash:job.hash,deviceId:job.deviceId,recipient:job.recipient}:null;
  }
  async recover(token,active) {
    let receipt;
    try { receipt=await this.client.getTransactionReceipt({hash:active.hash}); }
    catch(error){if(error.name!=='TransactionReceiptNotFoundError')throw error;}
    if(!receipt){
      // A send can fail after reaching the node; retry these exact signed bytes, never a fresh nonce.
      try { await this.client.sendRawTransaction({serializedTransaction:active.raw}); }
      catch(error){
        if(/nonce too low/i.test(error?.message||'') && active.nonce !== undefined && await this.client.getTransactionCount({address:this.account.address,blockTag:'latest'})>Number(active.nonce)) {
          const claimed=await this.client.readContract({address:this.contract,abi:this.abi,functionName:'claimed',args:[active.deviceId]});
          const job={...active,hash:null,status:claimed?'confirmed':'failed',replaced:true};
          await this.record(token,job,false);return job;
        }
        if(!/already known|known transaction/i.test(error?.message||''))return {...active,status:'pending'};
      }
      return {...active,status:'pending'};
    }
    const job={...active,status:receipt.status==='success'?'confirmed':'failed'};
    await this.record(token,job,false);return job;
  }
  async status(deviceId) {
    const token=randomBytes(16).toString('hex');
    if(await this.lock(token))try{
      const active=await this.get(':active');
      if(active?.deviceId===deviceId)await this.recover(token,active);
    }finally{await this.unlock(token);}
    return this.job(deviceId);
  }
  async submit(voucher) {
    const token=randomBytes(16).toString('hex');
    if(!await this.lock(token))return {...await this.job(voucher.deviceId),status:'pending',retry:true};
    try {
      const active=await this.get(':active');
      if(active){
        const result=await this.recover(token,active);
        if(result.status==='pending')return {...await this.job(voucher.deviceId),status:'pending',retry:true};
      }
      const existing=await this.job(voucher.deviceId);
      const claimed=await this.client.readContract({address:this.contract,abi:this.abi,functionName:'claimed',args:[voucher.deviceId]});
      if(claimed)return {...existing,status:'confirmed',claimed:true};
      if(BigInt(voucher.deadline)<BigInt(Math.floor(Date.now()/1000)))throw new Error('The claim authorization expired. Approve a fresh claim.');
      const data=encodeFunctionData({abi:this.abi,functionName:'claim',args:[voucher.deviceId,voucher.recipient,BigInt(voucher.deadline),voucher.authorization]});
      const request=await this.wallet.prepareTransactionRequest({account:this.account,to:this.contract,data});
      const raw=await this.wallet.signTransaction(request),hash=keccak256(raw);
      const job={...voucher,hash,raw,nonce:String(request.nonce),status:'pending'};
      await this.record(token,job,true);
      const result=await this.recover(token,job);
      return {status:result.status,hash,recipient:result.recipient,claimed:result.status==='confirmed'};
    }finally{await this.unlock(token);}
  }
}
