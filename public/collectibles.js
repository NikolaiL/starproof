import { connectWallet, mintMonster } from '/vendor/collectibles.js';
import { MONSTERS, hasEncounterProof } from './monster-catalog.js';
import { mountWalletPicker } from './wallets.js';
import { drawMonster } from './graphics.js';

export function mountCollectibles({ api, getState }) {
  const $ = id => document.getElementById(id);
  let connection = null, active = false, config = null, generation = 0;
  const minted = new Set();
  const encounterKey = () => getState().device + ':' + $('monster-world').value;
  const buttons = ['crew-connect', 'monster-mint'];
  function update() {
    $('crew-provider').disabled = active;
    for (const id of buttons) $(id).disabled = active || (id !== 'crew-connect' && !connection);
    const eligible = MONSTERS.filter(monster => getState().receipts.some(receipt => receipt.target === monster.id && hasEncounterProof(receipt)));
    const previous = $('monster-world').value;
    $('monster-world').replaceChildren(...eligible.map(monster => Object.assign(document.createElement('option'), { value: monster.id, textContent: monster.resident + ' · ' + monster.name })));
    if (eligible.some(monster => monster.id === previous)) $('monster-world').value = previous;
    $('monster-mint').disabled = active || !connection || !config?.enabled || !eligible.length || minted.has(encounterKey());
    if (!active) $('monster-mint').textContent = minted.has(encounterKey()) ? 'Monster collected' : 'Mint monster NFT';
    $('monster-empty').hidden = eligible.length > 0;
    preview();
  }
  function preview() {
    const monster = MONSTERS.find(item => item.id === $('monster-world').value) || MONSTERS[0];
    const canvas = $('monster-preview'), context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (monster) drawMonster(context, monster.monster, 110, 100, 65, 0);
  }
  async function run(id, text, work) {
    if (active) return;
    active = true; const label = $(id).textContent;
    $(id).textContent = text; $('crew-status').textContent = text; update();
    try { await work(); }
    catch (error) { $('crew-status').textContent = error.shortMessage || error.message || 'The wallet request failed.'; }
    finally { active = false; $(id).textContent = label; update(); }
  }
  function transaction(hash) {
    $('crew-tx').href = 'https://basescan.org/tx/' + hash;
    $('crew-tx').hidden = false;
  }
  $('crew-connect').addEventListener('click', () => run('crew-connect', 'Connecting wallet…', async () => {
    connection = await connectWallet(provider(), undefined, text => { $('crew-status').textContent = text; });
    const link = $('crew-wallet'); link.textContent = connection.account.slice(0, 6) + '…' + connection.account.slice(-4) + ' ↗';
    link.href = 'https://basescan.org/address/' + connection.account; link.hidden = false;
    $('crew-status').textContent = 'Wallet connected to Base. Monster mints use Base ETH for gas.';
  }));
  $('monster-world').addEventListener('change', update);
  $('monster-mint').addEventListener('click', () => run('monster-mint', 'Minting monster…', async () => {
    const current = connection = await connectWallet(provider(), undefined, text => { $('crew-status').textContent = text; }), epoch = generation;
    const voucher = await api('monsters/voucher', { world: $('monster-world').value, recipient: current.account });
    const hash = await mintMonster(current, voucher);
    if (generation !== epoch) throw new Error('Wallet changed. Check the mint transaction in your wallet.');
    minted.add(encounterKey());
    transaction(hash);
    $('crew-status').textContent = 'Monster NFT minted to your connected wallet on Base.';
  }));
  let observedProvider;
  const provider = mountWalletPicker($('crew-provider'), next => {
    observedProvider?.removeListener?.('accountsChanged', resetWallet);
    observedProvider?.removeListener?.('chainChanged', resetWallet);
    observedProvider = next;
    next?.on?.('accountsChanged', resetWallet); next?.on?.('chainChanged', resetWallet);
    resetWallet();
  });
  function resetWallet() {
    generation++; connection = null; $('crew-wallet').hidden = true;
    $('crew-status').textContent = 'Wallet changed. Reconnect on Base before continuing.';
    update();
  }
  api('monsters').then(result => { config = result; $('monster-config').textContent = result.enabled ? 'Base collectibles · no mint price; Base ETH gas applies.' : result.reason; update(); })
    .catch(() => { $('monster-config').textContent = 'Monster minting is temporarily unavailable.'; });
  update();
  return { update };
}
