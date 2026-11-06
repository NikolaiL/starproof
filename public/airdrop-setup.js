import {administrator,deployRequest,fundRequest,waitReceipt} from '/vendor/airdrop-wallet.js';
const $=id=>document.getElementById(id);
let distributor=null,busy=false;
function render(){ $('setup-deploy').disabled=busy; $('setup-fund').disabled=busy||!distributor||!/^[1-9][0-9]{0,5}$/.test($('setup-count').value); $('setup-count').disabled=busy; $('setup-issuer').disabled=busy; }
async function run(label,work){if(busy)return;busy=true;render();$('setup-status').textContent=label;try{await work();}catch(error){$('setup-status').textContent=error.shortMessage||error.message||'The wallet request failed.';}finally{busy=false;render();}}
function transaction(hash){$('setup-tx').href='https://basescan.org/tx/'+hash;$('setup-tx').hidden=false;}
$('setup-count').addEventListener('input',()=>{const value=$('setup-count').value;$('setup-amount').textContent=/^[1-9][0-9]{0,5}$/.test(value)?(BigInt(value)*1000n).toLocaleString()+' STARPROOF':'Enter a whole number of claims.';render();});
$('setup-deploy').addEventListener('click',()=>run('Review deployment in your wallet…',async()=>{
  const artifact=await(await fetch('/airdrop-deploy.json')).json();
  const provider=window.ethereum,from=await administrator(provider);
  const request=deployRequest(artifact,$('setup-issuer').value.trim(),from);
  const hash=await provider.request({method:'eth_sendTransaction',params:[request]});transaction(hash);
  $('setup-status').textContent='Deployment pending on Base…';
  const receipt=await waitReceipt(provider,hash);
  if(!receipt.contractAddress)throw new Error('The receipt did not contain a distributor address.');
  distributor=receipt.contractAddress;$('setup-contract').textContent=distributor;
  $('setup-status').textContent='Distributor deployed. Review the funding amount, then fund its claims.';
}));
$('setup-fund').addEventListener('click',()=>run('Review token funding in your wallet…',async()=>{
  const provider=window.ethereum,from=await administrator(provider);
  const request=fundRequest(distributor,$('setup-count').value,from);
  const hash=await provider.request({method:'eth_sendTransaction',params:[request]});transaction(hash);
  $('setup-status').textContent='Funding pending on Base…';await waitReceipt(provider,hash);
  $('setup-status').textContent='Funding confirmed. Configure the claim service with this distributor address to enable claims.';
}));
void fetch('/api/airdrop').then(response=>response.json()).then(config=>{if(config.issuer)$('setup-issuer').value=config.issuer;}).catch(()=>{});
