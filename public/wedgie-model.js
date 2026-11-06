import { sector } from './protocol.js';
import { drawPlanet } from './graphics.js';

let generation = 0, model, timer;
export function stopModelPress() { clearInterval(timer); model?.keyVisual('A', false); }
export function closeModel() {
  generation++; stopModelPress(); model?.destroy(); model = null;
  document.getElementById('wedgie-3d').replaceChildren();
  document.querySelector('.device-scene').classList.remove('has-3d');
}

export async function showModel(challenge) {
  closeModel();
  const token = generation;
  const host = document.createElement('div'); host.className = 'w3d-holder';
  document.getElementById('wedgie-3d').append(host);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 240;
  const g = canvas.getContext('2d'), world = sector(challenge.target), action = challenge.action;
  g.fillStyle = '#fefefe'; g.fillRect(0, 0, 240, 240);
  for (const [color, y] of [['#22c452', 10], ['#a9aaab', 19], ['#e3312c', 28]]) { g.fillStyle = color; g.fillRect(0, y, 240, 5); }
  g.textAlign = 'center'; g.fillStyle = '#1a1b1a'; g.font = 'bold 17px monospace';
  g.fillText(document.getElementById('device-question').textContent, 120, 62);
  drawPlanet(g, world, 43, 112, 27, 0);
  g.textAlign = 'left'; g.font = 'bold 17px monospace'; g.fillStyle = '#1a1b1a';
  g.fillText(world.name.toUpperCase(), 82, 98);
  g.font = '10px monospace';
  const detail = action === 'claim' ? world.artifact : action === 'refuel' ? 'Fill tank: 1 jump' : world.world;
  g.fillText(detail, 82, 117);
  g.fillText(document.getElementById('device-cost').textContent, 82, 136);
  g.textAlign = 'center'; g.font = '9px monospace'; g.fillStyle = '#787b78'; g.fillText('REVIEW YOUR REAL DEVICE', 120, 168);
  for (const [color, y, label] of [['#22c452', 184, 'sign'], ['#e3312c', 214, 'decline']]) {
    g.fillStyle = color; g.fillRect(0, y, 240, 26); g.fillStyle = '#fefefe'; g.font = 'bold 16px monospace'; g.fillText(label, 120, y + 19);
  }
  if (action === 'install') {
    g.fillStyle = '#e3312c'; g.fillRect(0, 0, 240, 240);
    g.fillStyle = '#fefefe'; g.textAlign = 'center'; g.font = 'bold 18px monospace';
    g.fillText('FULL CONTROL?', 120, 45); g.font = '12px monospace';
    g.fillText('Install Starproof', 120, 83); g.fillText('Review the linked code.', 120, 108);
    g.fillText('Green allows install.', 120, 133); g.fillText('Red cancels.', 120, 154);
    g.fillStyle = '#22c452'; g.fillRect(0, 184, 240, 26); g.fillStyle = '#fefefe'; g.font = 'bold 16px monospace';
    g.fillText('full control', 120, 203); g.fillText('no', 120, 233);
  }
  try {
    const { mountWedgie3D } = await import('/vendor/wedgie3d.js');
    if (generation !== token) return;
    const instance = await mountWedgie3D(host, { interactive: false, screen: canvas });
    if (generation !== token) { instance.destroy(); return; }
    model = instance;
    document.querySelector('.device-scene').classList.add('has-3d');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && ['waiting', 'preview', 'waiting-install'].includes(document.getElementById('approval').dataset.phase)) {
      let down = false; timer = setInterval(() => { down = !down; model?.keyVisual('A', down); }, 450);
    }
  } catch { host.remove(); }
}
