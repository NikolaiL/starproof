import { connectWallet, deployMonsters, base } from '/vendor/collectibles.js';
import { mountWalletPicker } from './wallets.js';
const provider = mountWalletPicker(document.getElementById('monster-provider'));
const button = document.getElementById('monster-deploy'), status = document.getElementById('monster-setup-status');
let deployed = false;
button.addEventListener('click', async () => {
  if (deployed) return;
  button.disabled = true; button.textContent = 'Deploying collection…';
  status.textContent = 'Review Base deployment and gas in your wallet. Waiting for confirmation…';
  try {
    const progress = text => { status.textContent = text; };
    const connection = await connectWallet(provider(), base, progress);
    const result = await deployMonsters(connection, document.getElementById('monster-issuer').value.trim(), progress);
    deployed = true;
    document.getElementById('monster-contract').textContent = 'Collection: ' + result.address;
    const link = document.getElementById('monster-setup-tx'); link.href = 'https://basescan.org/tx/' + result.hash; link.hidden = false;
    status.textContent = 'Collection deployed. Configure the server with this collection and its matching proof issuer.';
  } catch (error) { status.textContent = error.shortMessage || error.message || 'Deployment failed.'; }
  finally { button.disabled = deployed; button.textContent = deployed ? 'Collection already deployed' : 'Review Base deployment in wallet'; }
});

void fetch('/api/airdrop').then(response => response.json()).then(config => {
  const input = document.getElementById('monster-issuer');
  if (!input.value && config.issuer) input.value = config.issuer;
}).catch(() => {});

button.disabled = true;
void fetch('/api/monsters').then(response => response.json()).then(config => {
  if (config.enabled) {
    deployed = true;
    document.getElementById('monster-contract').textContent = 'Collection: ' + config.contract;
    status.textContent = 'The Base collection is configured and minting is enabled. Return to the game to collect monsters.';
  }
  button.disabled = deployed;
  button.textContent = deployed ? 'Collection already deployed' : 'Review Base deployment in wallet';
}).catch(() => { status.textContent = 'Could not check the existing collection. Reload before deploying.'; });
