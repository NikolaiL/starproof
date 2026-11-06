import { connectWallet, profileNames, readProfile, publishProfile, delegateLogbook, writeLogbook, mintMonster, mainnet } from '/vendor/collectibles.js';
import { MONSTERS, hasEncounterProof } from './monster-catalog.js';
import { mountWalletPicker } from './wallets.js';
import { drawMonster } from './graphics.js';

export function mountCollectibles({ api, getState }) {
  const $ = id => document.getElementById(id);
  let connection = null, active = false, config = null, generation = 0;
  const minted = new Set();
  const encounterKey = () => getState().device + ':' + $('monster-world').value;
  const buttons = ['crew-connect', 'crew-load', 'crew-publish', 'crew-grant', 'crew-revoke', 'crew-log-save', 'monster-mint'];
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
  function names() { return profileNames($('crew-captain').value, $('crew-ship').value); }
  function showProfile(profile, expectedGeneration) {
    if (generation !== expectedGeneration) throw new Error('Wallet changed. Load the crew profile again.');
    if (profile.address.toLowerCase() !== connection?.account.toLowerCase()) throw new Error('These ENS names resolve to a different captain wallet.');
    $('crew-identity').textContent = 'Captain ' + profile.captain + ' · Ship ' + profile.ship;
    $('crew-log').value = profile.logbook;
    $('crew-status').textContent = 'Captain and ship verified from ENS on Ethereum.';
    try { localStorage.setItem('starproof-crew', JSON.stringify({ captain: profile.captain, ship: profile.ship })); } catch { /* Profile persistence is optional. */ }
  }
  function transaction(hash) {
    $('crew-tx').href = 'https://' + (connection?.wallet.chain.id === 1 ? 'etherscan.io' : 'basescan.org') + '/tx/' + hash;
    $('crew-tx').hidden = false;
  }
  $('crew-connect').addEventListener('click', () => run('crew-connect', 'Connecting wallet…', async () => {
    connection = await connectWallet(provider(), undefined, text => { $('crew-status').textContent = text; });
    const link = $('crew-wallet'); link.textContent = connection.account.slice(0, 6) + '…' + connection.account.slice(-4) + ' ↗';
    link.href = 'https://basescan.org/address/' + connection.account; link.hidden = false;
    $('crew-status').textContent = 'Wallet connected to Base. Monster mints use Base ETH for gas; ENS writes use Ethereum.';
  }));
  async function namingWallet() { connection = await connectWallet(provider(), mainnet, text => { $('crew-status').textContent = text; }); return connection; }
  $('crew-load').addEventListener('click', () => run('crew-load', 'Reading ENS…', async () => {
    const current = await namingWallet(), epoch = generation;
    showProfile(await readProfile(current.client, names()), epoch);
  }));
  $('crew-publish').addEventListener('click', () => run('crew-publish', 'Publishing profile…', async () => {
    const current = await namingWallet(), epoch = generation;
    showProfile(await publishProfile(current, names(), text => { if (generation === epoch) $('crew-status').textContent = text; }), epoch);
  }));
  for (const [id, revoke] of [['crew-grant', false], ['crew-revoke', true]]) {
    $(id).addEventListener('click', () => run(id, revoke ? 'Revoking permission…' : 'Granting permission…', async () => {
      const current = await namingWallet(), epoch = generation;
      const hash = await delegateLogbook(current, names(), $('crew-delegate').value.trim(), revoke);
      if (generation !== epoch) throw new Error('Wallet changed. Check the confirmed transaction in your wallet.');
      transaction(hash);
      $('crew-status').textContent = revoke ? 'Navigator logbook permission revoked.' : 'Navigator can edit only the logbook key, across names on this resolver.';
    }));
  }
  $('crew-log-save').addEventListener('click', () => run('crew-log-save', 'Saving logbook…', async () => {
    const current = await namingWallet(), epoch = generation;
    const hash = await writeLogbook(current, names(), $('crew-log').value);
    if (generation !== epoch) throw new Error('Wallet changed. Reload the logbook.');
    transaction(hash);
    showProfile(await readProfile(current.client, names()), epoch);
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
    $('crew-identity').textContent = 'No crew profile loaded.';
    $('crew-status').textContent = 'Wallet changed. Reconnect on Base before continuing.';
    update();
  }
  try {
    const saved = JSON.parse(localStorage.getItem('starproof-crew'));
    if (saved) { $('crew-captain').value = saved.captain; $('crew-ship').value = saved.ship; }
  } catch { /* A blocked browser store must not prevent gameplay. */ }
  api('monsters').then(result => { config = result; $('monster-config').textContent = result.enabled ? 'Base collectibles · no mint price; Base ETH gas applies.' : result.reason; update(); })
    .catch(() => { $('monster-config').textContent = 'Monster minting is temporarily unavailable.'; });
  update();
  return { update };
}
