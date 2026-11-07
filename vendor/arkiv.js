import { createPublicClient, createWalletClient, ExpirationTime } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { defineSchema, str } from '@arkiv-network/sdk/schema';
import { eq } from '@arkiv-network/sdk/query';
import { custom, http, keccak256, toHex } from 'viem';
import { SECTORS } from '../public/protocol.js';
import { mountWalletPicker } from '../public/wallets.js';
import { connectWallet } from './collectibles.js';

const chain = rabdi({ accessKey: '' });
const reader = createPublicClient({ chain, transport: http(undefined, { timeout: 8000, retryCount: 0 }) });
const systems = new Map(SECTORS.map(world => [world.id, world.name]));
const actions = { launch: 'Expedition launched', jump: 'System visited', claim: 'Artifact recovered' };
const explorer = 'https://rabdi.explorer.arkiv.network';
const Expeditions = defineSchema('starproof-expedition-v1', { system: str().indexed(), action: str(), receipt: str() });

export async function readExpeditions(system = '') {
  if (system && !systems.has(system)) throw new Error('Choose a charted system.');
  const query = reader.select({ $key: true, $owner: true, $createdAt: true, system: true, action: true })
    .from(Expeditions).limit(12);
  if (system) query.where(eq('system', system));
  const { entities } = await query.fetch();
  return entities.sort((a, b) => Number(b.$createdAt) - Number(a.$createdAt))
    .filter(entity => systems.has(entity.system?.value) && Object.hasOwn(actions, entity.action?.value))
    .map(entity => ({ key: entity.$key, owner: entity.$owner, system: entity.system.value, action: entity.action.value }));
}

function mountAtlas() {
  const $ = id => document.getElementById(id);
  const filter = $('arkiv-system'), list = $('arkiv-entries'), publish = $('arkiv-publish');
  const status = $('arkiv-status'), readStatus = $('arkiv-read-status'), txLink = $('arkiv-tx');
  const provider = mountWalletPicker($('arkiv-wallet'));
  for (const [id, name] of systems) filter.add(new Option(name, id));
  let readVersion = 0;

  async function refresh() {
    const version = ++readVersion;
    readStatus.textContent = 'Reading the atlas from Rabdi…';
    try {
      const records = await readExpeditions(filter.value);
      if (version !== readVersion) return;
      list.replaceChildren(...records.map(record => {
        const item = document.createElement('li');
        item.textContent = `${systems.get(record.system)} · ${actions[record.action]} · ${record.owner.slice(0, 8)}…${record.owner.slice(-4)}`;
        item.title = record.owner;
        return item;
      }));
      readStatus.textContent = records.length ? `${records.length} entries read from Rabdi.` : 'No entries for this view yet.';
    } catch {
      if (version === readVersion) readStatus.textContent = 'Rabdi is temporarily unavailable. Try Refresh atlas.';
    }
  }

  filter.addEventListener('change', refresh);
  $('arkiv-refresh').addEventListener('click', refresh);
  publish.addEventListener('click', async () => {
    publish.disabled = true;
    txLink.hidden = true;
    try {
      const response = await fetch('/api/state');
      if (!response.ok) throw new Error('Could not load your flight receipts.');
      const { receipts } = await response.json();
      const receipt = receipts.find(entry => entry.verification !== 'demo' && entry.text && entry.r && entry.s && systems.has(entry.target) && Object.hasOwn(actions, entry.action));
      if (!receipt) throw new Error('Launch with your Wedgie to earn a signed flight receipt first.');
      const selected = provider();
      const progress = text => { status.textContent = text; };
      let connection;
      try {
        connection = await connectWallet(selected, chain, progress);
      } catch (error) {
        if (error.code !== 4902) throw error;
        progress('Add Rabdi in your wallet, then approve the network switch.');
        await selected.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: toHex(chain.id), chainName: chain.name, nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http, blockExplorerUrls: [explorer],
        }] });
        connection = await connectWallet(selected, chain, progress);
      }
      if (await reader.getBalance({ address: connection.account }) === 0n) throw new Error('Fund this wallet with tGLM on Rabdi before publishing.');
      const wallet = createWalletClient({ chain, account: connection.account, transport: custom(selected) });
      progress(`Review the ${systems.get(receipt.target)} entry in your wallet.`);
      const result = await wallet.createEntity(Expeditions, {
        system: receipt.target, action: receipt.action, receipt: keccak256(toHex(`${receipt.text}:${receipt.r}:${receipt.s}`)),
      }, { expiration: ExpirationTime.fromDays(7) });
      txLink.href = `${explorer}/tx/${result.txHash}`;
      txLink.hidden = false;
      progress(`Published ${systems.get(receipt.target)} on Rabdi.`);
      filter.value = receipt.target;
      await refresh();
    } catch (error) {
      status.textContent = error.shortMessage || error.message;
    } finally {
      publish.disabled = false;
    }
  });
  void refresh();
}

if (typeof document !== 'undefined') mountAtlas();
