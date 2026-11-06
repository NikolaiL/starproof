import test from 'node:test';
import assert from 'node:assert/strict';
import { mountWalletPicker } from '../public/wallets.js';
import { connectWallet } from '../vendor/collectibles.js';

class Select extends EventTarget {
  options = []; value = '';
  append(option) { this.options.push(option); if(!this.value)this.value=option.value; }
  replaceChildren() { this.options=[];this.value=''; }
}
function host() {
  const target=new EventTarget();target.document={createElement:()=>({})};return target;
}
test('wallet discovery selects the chosen extension regardless of window.ethereum injection order', async () => {
  const target=host(),select=new Select(),calls=[];
  target.ethereum={request:async()=>{throw new Error('the conflicting legacy provider must not be used');}};
  const account='0x1111111111111111111111111111111111111111';
  const provider={request:async({method})=>{calls.push(method);return method==='eth_chainId'?'0x2105':[account];}};
  const other={request:async()=>{throw new Error('the unselected extension must not be used');}};
  const announce=(uuid,name,p)=>target.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid,name},provider:p}}));
  target.addEventListener('eip6963:requestProvider',()=>{announce('first','Other wallet',other);announce('rainbow','Rainbow',provider);});
  const selected=mountWalletPicker(select,()=>{},target);
  assert.deepEqual(select.options.map(o=>o.textContent),['Other wallet','Rainbow']);
  select.value='rainbow';select.dispatchEvent(new Event('change'));
  announce('rainbow','Duplicate',other);
  target.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'invalid',name:'Missing provider'}}}));
  assert.equal(select.options.length,2);
  assert.equal((await connectWallet(selected())).account,account);
  assert.deepEqual(calls,['eth_requestAccounts','eth_chainId','eth_chainId','eth_accounts']);
});
test('a wallet without discovery keeps the legacy connection and no-wallet errors are actionable',()=>{
  const target=host(),select=new Select();target.ethereum={request:async()=>[]};
  assert.equal(mountWalletPicker(select,()=>{},target)(),target.ethereum);
  const empty=host();assert.throws(mountWalletPicker(new Select(),()=>{},empty),/No Ethereum wallet found/);
});
test('a stalled account request times out without submitting or retrying any transaction',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const calls=[];
  const pending=connectWallet({request:({method})=>{calls.push(method);return new Promise(()=>{});}});
  const rejected=assert.rejects(pending,/connection timed out/);
  t.mock.timers.tick(60000);await rejected;
  assert.deepEqual(calls,['eth_requestAccounts']);
});
