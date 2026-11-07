export function mountAirdrop({signer,api,deviceJob,notice}) {
  const $=id=>document.getElementById(id);
  let config=null,wallet=null,working=false,pending=false,claimed=false,cancelled=false,generation=0;
  const recipient=()=>($('drop-safe').value || $('drop-safe-manual').value).trim();
  function render() {
    $('drop-load').disabled=working;
    $('drop-claim').disabled=working || pending || claimed || !config?.enabled || !wallet || !recipient();
    $('drop-claim').textContent=claimed?'Claimed on this chip':pending?'Transfer pending…':working?'Preparing claim…':'Claim 1,000 STARPROOF';
    $('drop-safe').disabled=working || pending; $('drop-safe-manual').disabled=working || pending;
    $('drop-config').textContent=config?.enabled?'1,000 tokens per verified chip · choose a receiving Safe':config?.reason||'Checking the token drop…';
    $('drop-recipient').textContent=recipient() || 'Select a Safe, or enter its full address.';
  }
  async function refresh() {try{config=await api('airdrop');}catch{config={enabled:false,reason:'The token drop is temporarily unavailable.'};}render();}
  function showTransaction(hash) {
    $('drop-tx').hidden=!hash;
    if(hash){$('drop-tx').href='https://basescan.org/tx/'+hash;$('drop-tx').textContent='View transfer on Base ↗';}
  }
  function showStatus(status,lookupMessage='') {
    claimed=!!status.claimed || status.status==='confirmed'; pending=!claimed && ['pending','authorized'].includes(status.status);
    showTransaction(status.txHash || status.hash);
    $('drop-status').textContent=claimed?'This chip has claimed its 1,000 STARPROOF.':pending?'Your approved transfer is pending on Base.':status.status==='failed'?'The transfer failed. No chip claim was consumed; you can review and retry.':lookupMessage;
    render();
  }
  async function poll(myGeneration) {
    const until=Date.now()+120000;
    while(myGeneration===generation && pending && Date.now()<until) {
      await new Promise(resolve=>setTimeout(resolve,6000));
      if(myGeneration!==generation || !wallet)break;
      try {
        const state=await api('airdrop/status',{cert:wallet.cert}); showStatus(state);
        if(!claimed && state.retry)showStatus(await api('airdrop/submit',{cert:wallet.cert}));
        if(claimed){notice('1,000 STARPROOF sent to your Safe. This chip’s claim is recorded onchain.');void refresh();}
      }catch(error){$('drop-status').textContent=error.message;break;}
    }
  }
  $('drop-load').addEventListener('click',()=>deviceJob(async()=>{
    if(working)return;
    const lookupGeneration = ++generation;
    working=true;wallet=null;claimed=false;pending=false;render();
    try {
      const reply=await signer.request('starproof_wallet',{},8000);
      if(reply.type!=='starproof_wallet')throw new Error('Update the Starproof device app, then reconnect.');
      const discoveredWallet={x:reply.x,y:reply.y,cert:reply.cert};
      const result=await api('airdrop/wallets',{cert:discoveredWallet.cert,wallet:discoveredWallet});
      if(lookupGeneration!==generation)return;
      $('drop-safe').replaceChildren(new Option('Choose a receiving Safe',''),...result.safes.map(address=>new Option(address,address)));
      $('drop-safe-manual').value='';
      let lookupMessage = 'Select a Safe to inspect its full address.';
      if(result.discoveryUnavailable)lookupMessage='Safe discovery is temporarily unavailable. You can enter an address manually.';
      else if(!result.safes.length)lookupMessage='No supported Safes were found. Enter a deployed Safe 1.4.1 address owned by this Wedgie.';
      const claimStatus=await api('airdrop/status',{cert:discoveredWallet.cert});
      if(lookupGeneration!==generation)return;
      wallet=discoveredWallet;
      showStatus(claimStatus,lookupMessage);
      if(pending)void poll(lookupGeneration);
    }catch(error){notice(error.message);$('drop-status').textContent=error.message;}
    finally{working=false;render();}
  }));
  $('drop-safe').addEventListener('change',()=>{if($('drop-safe').value)$('drop-safe-manual').value='';render();});
  $('drop-safe-manual').addEventListener('input',()=>{$('drop-safe').value='';render();});
  async function cancel(event) {
    event?.preventDefault();
    if($('drop-cancel').disabled)return;
    cancelled=true;
    await Promise.allSettled([signer.cancelAction('starproof_airdrop'),api('airdrop/cancel',{})]);
    $('drop-approval').close();
  }
  $('drop-cancel').addEventListener('click',cancel);$('drop-approval').addEventListener('cancel',cancel);
  $('drop-claim').addEventListener('click',()=>deviceJob(async()=>{
    if(working || pending || claimed || !config?.enabled || !wallet)return;
    working=true;cancelled=false;render();
    try {
      const challenge=await api('airdrop/challenge',{cert:wallet.cert,wallet,recipient:recipient()});
      if(challenge.claimed){showStatus(challenge);return;}
      $('drop-review-address').textContent=challenge.recipient;
      $('drop-review-state').textContent='On Wedgie: review the token, press green for next, then review the receiving Safe and press green to claim. Red declines.';
      $('drop-cancel').disabled=false;$('drop-approval').showModal();
      const proof=await signer.request('starproof_airdrop',{text:challenge.text},145000);
      if(cancelled)return;
      if(proof.type!=='starproof_airdrop_proof')throw new Error('Unexpected device claim response.');
      $('drop-cancel').disabled=true;$('drop-review-state').textContent='Verifying your chip proof and preparing the transfer…';
      await api('airdrop/proof',{id:challenge.id,cert:wallet.cert,proof});
      const result=await api('airdrop/submit',{cert:wallet.cert});
      showStatus(result);
      if(result.status==='failed')throw new Error('The transfer failed. Review a fresh claim to retry.');
      if(pending)void poll(++generation);
    }catch(error){if(!cancelled){notice(error.message);$('drop-status').textContent=error.message;}await api('airdrop/cancel',{}).catch(()=>{});}
    finally{$('drop-approval').close();working=false;render();}
  }));
  signer.addEventListener('disconnect',()=>{wallet=null;generation++;pending=false;claimed=false;render();});
  render();
  void refresh();
}
