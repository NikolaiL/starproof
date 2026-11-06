import { connectWallet, deployMonsters, base } from '/vendor/collectibles.js';
const button = document.getElementById('monster-deploy'), status = document.getElementById('monster-setup-status');
button.addEventListener('click', async () => {
  button.disabled = true; button.textContent = 'Deploying collection…';
  status.textContent = 'Review Base deployment and gas in your wallet. Waiting for confirmation…';
  try {
    const progress = text => { status.textContent = text; };
    const connection = await connectWallet(window.ethereum, base, progress);
    const deployed = await deployMonsters(connection, document.getElementById('monster-issuer').value.trim(), progress);
    document.getElementById('monster-contract').textContent = 'Collection: ' + deployed.address;
    const link = document.getElementById('monster-setup-tx'); link.href = 'https://basescan.org/tx/' + deployed.hash; link.hidden = false;
    status.textContent = 'Collection deployed. Configure the server with this collection and its matching proof issuer.';
  } catch (error) { status.textContent = error.shortMessage || error.message || 'Deployment failed.'; }
  finally { button.disabled = false; button.textContent = 'Review Base deployment in wallet'; }
});

void fetch('/api/airdrop').then(response => response.json()).then(config => {
  const input = document.getElementById('monster-issuer');
  if (!input.value && config.issuer) input.value = config.issuer;
}).catch(() => {});
