import { WedgieSigner } from './sdk.js';
import { SECTORS, MAPS, MAX_FUEL, START_CREDITS, SCAVENGE_FUEL, jumpCost, DEVICE_VERSION, sector, PROTOCOL, chartedWorlds, chartBounds } from './protocol.js';
import { drawPlanet, drawMonster, drawShip } from './graphics.js';
import { openApproval, showVerifying, closeApproval, openInstall, installProgress } from './approval.js';
import { showModel, stopModelPress, closeModel } from './wedgie-model.js';

const $ = (id) => document.getElementById(id);
const emptyLog = $('receipts').firstElementChild;
const signer = new WedgieSigner('starproof');
let state = { started: false, location: 'sol', fuel: MAX_FUEL, credits: START_CREDITS, maps: ['home'], refuelCost: 0, claims: [], receipts: [], sequence: 0 };
let view = chartBounds(chartedWorlds(state.maps)), viewTarget = view;
let selected = 'kepler', busy = false, deviceReady = false, cancelled = false;
let ship = { x: 0.23, y: 0.54 }, scanned = new Set(), noticeTimer;
let ping = null;
let cancellation;
const keys = new Set();
const canvas = $('space'), ctx = canvas.getContext('2d');
const portrait = $('planet'), portraitContext = portrait.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
function notice(text) { clearTimeout(noticeTimer); $('notice').textContent = text; $('notice').hidden = false; noticeTimer = setTimeout(() => $('notice').hidden = true, 9000); }
function select(id) { if (state.maps.includes(sector(id).map)) { selected = id; render(); } }
function visibleWorlds() { return chartedWorlds(state.maps); }
function dock() { const here = sector(state.location); ship = { x: here.x, y: here.y }; }

for (const star of SECTORS) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'destination-button';
  button.textContent = '✧ ' + star.name.toUpperCase(); button.dataset.id = star.id;
  button.addEventListener('click', () => select(star.id)); $('destinations').append(button);
}

function render() {
  if (!state.maps.includes(sector(selected).map)) selected = state.location;
  viewTarget = chartBounds(visibleWorlds());
  const destination = sector(selected), here = selected === state.location;
  $('fuel').replaceChildren(document.createTextNode(String(state.fuel).padStart(2, '0') + ' '), Object.assign(document.createElement('small'), { textContent: '/ 0' + MAX_FUEL }));
  $('artifact-count').replaceChildren(document.createTextNode(String(state.claims.length).padStart(2, '0') + ' '), Object.assign(document.createElement('small'), { textContent: '/ 0' + SECTORS.length }));
  $('credits').textContent = state.credits;
  $('refuel').textContent = state.refuelCost ? 'Buy fuel · ' + state.refuelCost + ' credits' : 'Refuel · free planet cache';
  $('refuel').disabled = busy || !deviceReady || !state.started || state.fuel >= MAX_FUEL || state.credits < state.refuelCost;
  $('fuel-hint').textContent = 'Jumps cost 2–8 fuel by distance. ' + (state.refuelCost ? 'A full refill costs ' + state.refuelCost + ' credits. Scavenge if you are short.' : 'A free full-tank cache is waiting at ' + sector(state.location).name + '.');
  $('scavenge').textContent = 'Scavenge up to ' + SCAVENGE_FUEL + ' fuel';
  $('scavenge').disabled = busy || !deviceReady || !state.started || state.fuel >= MAX_FUEL;
  const found = MAPS.find((map) => map.foundAt === selected);
  $('loot-note').textContent = state.claims.includes(selected) ? 'Artifact recovered. This planet’s loot is yours.' : 'Artifact loot: +4 credits' + (found ? ' + ' + found.name + ' star map.' : '.');
  $('charted-count').textContent = visibleWorlds().length + ' / ' + SECTORS.length + ' STARS CHARTED';
  const next = MAPS.find((map) => !state.maps.includes(map.id));
  $('map-hint').textContent = next ? 'Recover the artifact on ' + sector(next.foundAt).name + ' to chart the next stars.' : 'Every star is charted. The whole universe is on this map.';
  $('destination-name').textContent = destination.name;
  $('destination-description').textContent = destination.description;
  $('world-type').textContent = here ? 'CURRENT SYSTEM' : 'UNEXPLORED SYSTEM';
  $('landmark').textContent = destination.world;
  $('destination-state').textContent = state.claims.includes(selected) ? 'Artifact secured' : here && state.started ? 'In range' : 'Uncharted';
  $('jump-cost').textContent = here ? '—' : jumpCost(state.location, selected) + ' fuel';
  $('resident-name').textContent = destination.resident || 'Clear skies. For now.';
  $('resident-note').textContent = destination.residentNote || 'A peaceful place to stretch your space legs.';
  $('resident-card').classList.toggle('has-monster', !!destination.monster);
  $('location-tag').textContent = sector(state.location).name.toUpperCase() + ' SYSTEM';
  $('chart-title').textContent = 'The growing unknown.';
  $('map-overlay').hidden = state.started;
  $('launch').hidden = state.started;
  $('launch').disabled = busy || !deviceReady;
  $('jump').disabled = busy || !deviceReady || !state.started || here || state.fuel < jumpCost(state.location, selected);
  $('claim').disabled = busy || !deviceReady || !state.started || !here || state.claims.includes(selected);
  $('connect').disabled = busy;
  $('signing-help').disabled = busy;
  $('scan').disabled = !state.started || busy;
  $('connect').textContent = signer.port && deviceReady ? 'Disconnect ↗' : 'Connect Wedgie ↗';
  $('mission-hint').textContent = state.started ? 'Sign jumps and refills. Recover artifacts to find more maps.' : 'A real Trust M signature is required to leave Sol.';
  $('trust-status').textContent = state.started ? 'TRUST M SIGNATURE VERIFIED' : 'AWAITING LAUNCH';
  $('trust-status').className = 'status' + (state.started ? ' verified' : '');
  for (const button of $('destinations').children) { button.hidden = !state.maps.includes(sector(button.dataset.id).map); button.classList.toggle('active', button.dataset.id === selected); button.setAttribute('aria-pressed', String(button.dataset.id === selected)); }
  $('export').disabled = state.receipts.length === 0;
  if (state.receipts.length) {
    $('receipts').replaceChildren(...state.receipts.map((receipt) => {
      const item = document.createElement('li'), number = document.createElement('span'), title = document.createElement('span');
      number.textContent = String(receipt.sequence).padStart(2, '0');
      title.textContent = receipt.action === 'launch' ? 'Expedition authorized · departed Sol' : receipt.action === 'jump' ? 'Jump committed · ' + sector(receipt.target).name : receipt.action === 'refuel' ? 'Tank filled · ' + (receipt.cost ? receipt.cost + ' credits' : 'planet cache') : receipt.action === 'scavenge' ? 'Fuel scavenged · ' + sector(receipt.target).name : 'Artifact secured · ' + sector(receipt.target).artifact;
      const proof = Object.assign(document.createElement('span'), { className: 'receipt-proof', textContent: 'CHIP ' + receipt.fingerprint.slice(0, 10) + '…' });
      const time = document.createElement('time'); time.dateTime = receipt.at; time.textContent = new Date(receipt.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.append(number, title, proof, time); return item;
    }));
  } else $('receipts').replaceChildren(emptyLog);
}

$('connect').addEventListener('click', async () => {
  busy = true; render();
  try {
    if (signer.port && deviceReady) { await signer.disconnect(); return; }
    await signer.connect({ version: DEVICE_VERSION, install: async (port) => {
      const response = await fetch('/device-install.json');
      if (!response.ok) throw new Error('Could not load the device installer. Reload and try again.');
      const bundle = await response.json();
      const { installDevice } = await import('/vendor/installer.js');
      openInstall(bundle.version, bundle.source);
      void showModel({ action: 'install', target: 'sol' });
      try {
        await installDevice(port, bundle, (progress, what) => { stopModelPress(); installProgress(progress, what); });
      } finally { closeModel(); closeApproval(); }
    } });
    if (!signer.canCancel) throw new Error('Install the updated Starproof device app for refuelling and browser cancellation, then reconnect.');
    const identity = await api('device', { cert: signer.cert });
    deviceReady = true;
    $('device-status').textContent = 'Trust M certificate accepted';
    $('device-detail').textContent = 'Chip ' + identity.fingerprint.slice(0, 16) + '… · prove possession at launch';
    notice('Connected. Authorize the expedition, then check your Wedgie.');
  } catch (error) {
    await signer.disconnect();
    notice(error.message);
  } finally { busy = false; render(); }
});
signer.addEventListener('disconnect', () => {
  deviceReady = false; $('device-status').textContent = 'No Wedgie connected';
  $('device-detail').textContent = 'Reconnect the same chip to commit another decision.'; render();
});

async function commit(action, target) {
  if (busy) return;
  busy = true; cancelled = false; cancellation = null; render();
  let challenge;
  try {
    challenge = await api('challenge', { action, target, cert: signer.cert });
    openApproval(challenge);
    void showModel(challenge);
    const proof = await signer.signAction(challenge);
    if (cancelled) return;
    showVerifying();
    stopModelPress();
    const previous = state.location;
    state = await api('commit', { id: challenge.id, ...proof });
    if (state.location !== previous) dock();
    selected = state.location;
    const found = MAPS.find((map) => map.foundAt === target);
    notice(action === 'launch' ? 'Signature verified. The stars are yours.' : action === 'jump' ? 'Jump committed. Welcome to ' + sector(target).name + '. ' + state.fuel + ' fuel left.' : action === 'refuel' ? 'Tank filled to 8 fuel. Plan your next route.' : action === 'scavenge' ? 'Fuel gathered. You now have ' + state.fuel + ' / 8 fuel.' : sector(target).artifact + ' secured. +4 credits.' + (found ? ' Found the ' + found.name + ' star map!' : ''));
    canvas.focus();
  } catch (error) {
    if (!cancelled) notice(error.message);
    if (challenge) await api('cancel', {}).catch(() => {});
    // The server may have restarted or expired this session; show the game it actually has.
    const previous = state.location;
    state = await api('state').catch(() => state);
    if (!state.started || state.location !== previous) dock();
  } finally { if (cancellation) await cancellation; closeModel(); closeApproval(); busy = false; render(); }
}
$('launch').addEventListener('click', () => commit('launch', 'sol'));
$('jump').addEventListener('click', () => commit('jump', selected));
$('claim').addEventListener('click', () => commit('claim', selected));
$('refuel').addEventListener('click', () => commit('refuel', state.location));
$('scavenge').addEventListener('click', () => commit('scavenge', state.location));
async function cancel() {
  if (!busy) { closeModel(); closeApproval(); return; }
  if (cancelled || $('cancel').disabled) return;
  cancelled = true;
  stopModelPress();
  $('cancel').disabled = true;
  $('approval-status').textContent = 'CANCELLING ON WEDGIE…';
  cancellation = (async () => {
    const [server, device] = await Promise.allSettled([api('cancel', {}), signer.cancelAction()]);
    if (device.status === 'rejected') notice((server.status === 'fulfilled' ? 'Server request cancelled. ' : 'No proof will be submitted. ') + device.reason.message + ' Press red if the device still shows a prompt.');
    else if (server.status === 'rejected') notice('Device request cancelled; server unreachable. No proof will be submitted.');
    else notice(device.value ? 'Cancelled in the browser and on your Wedgie. No action was taken.' : 'Request cancelled. The device prompt has already ended.');
  })();
  await cancellation;
  closeModel();
  closeApproval();
}
$('signing-help').addEventListener('click', () => {
  const challenge = { action: 'launch', target: 'sol' };
  openApproval(challenge, true); void showModel(challenge);
});
$('cancel').addEventListener('click', cancel);
$('approval').addEventListener('cancel', (event) => { event.preventDefault(); void cancel(); });
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ protocol: PROTOCOL, receipts: state.receipts }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'starproof-receipts.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function scan() {
  if (!state.started || busy) return;
  let nearest = visibleWorlds()[0];
  for (const star of visibleWorlds()) if (Math.hypot(ship.x - star.x, ship.y - star.y) < Math.hypot(ship.x - nearest.x, ship.y - nearest.y)) nearest = star;
  scanned.add(nearest.id); select(nearest.id);
  ping = { at: performance.now(), x: ship.x, y: ship.y, target: nearest.id };
  $('scan-readout').textContent = nearest.monster ? nearest.resident + ': “' + nearest.greeting + '”' : nearest.world + ': clear skies. Keep exploring.';
  notice(nearest.monster ? nearest.resident + ' heard your ping. ' + nearest.greeting : 'Signal: ' + nearest.world + '. ' + nearest.description);
}
$('scan').addEventListener('click', scan);
addEventListener('keydown', (event) => {
  if (event.target.closest('button, input, textarea, select') || $('approval').open || event.metaKey || event.ctrlKey || event.altKey) return;
  // event.code ignores Shift/Caps Lock, so a keyup always matches its keydown.
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault(); keys.add(event.code);
    if (event.code === 'Space' && !event.repeat) scan();
  }
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('click', (event) => {
  const box = canvas.getBoundingClientRect(), x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
  const distance = (star) => Math.hypot(((star.x - view.left) / view.width - x) * box.width, ((star.y - view.top) / view.height - y) * box.height);
  const nearest = visibleWorlds().sort((a, b) => distance(a) - distance(b))[0]; select(nearest.id); canvas.focus();
});
// Procedural art keeps the scene local and makes each planet's resident react to sonar.
const stars = Array.from({ length: 125 }, (_, i) => ({ x: ((i * 137.508) % 997) / 997, y: ((i * 83.17 + 31) % 991) / 991, r: i % 11 === 0 ? 1.8 : .7 }));
let last = performance.now();
function frame(time) {
  const dt = Math.min((time - last) / 1000, .05); last = time;
  const artTime = reducedMotion ? 0 : time;
  const box = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(box.width * dpr) || canvas.height !== Math.round(box.height * dpr)) { canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr); }
  const w = box.width, h = box.height; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  for (const key of ['left', 'top', 'width', 'height']) view[key] += (viewTarget[key] - view[key]) * (reducedMotion ? 1 : Math.min(1, dt * 4));
  const point = (object) => ({ x: (object.x - view.left) / view.width * w, y: (object.y - view.top) / view.height * h });
  const moving = state.started && !busy && !$('approval').open && ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some((key) => keys.has(key));
  if (state.started && !busy && !$('approval').open) {
    ship.x += ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)) * dt * .18 * view.width;
    ship.y += ((keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)) * dt * .18 * view.height;
    ship.x = Math.max(viewTarget.left + viewTarget.width * .05, Math.min(viewTarget.left + viewTarget.width * .95, ship.x));
    ship.y = Math.max(viewTarget.top + viewTarget.height * .08, Math.min(viewTarget.top + viewTarget.height * .89, ship.y));
  }
  ctx.strokeStyle = '#a294fa0c'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 55) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 55) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (const star of stars) {
    ctx.globalAlpha = .25 + (Math.sin(artTime / 1800 + star.x * 40) + 1) * .2;
    ctx.fillStyle = star.r > 1 ? '#ded2ff' : '#7791c2'; ctx.beginPath(); ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2); ctx.fill();
    if (star.r > 1) { ctx.fillRect(star.x * w - 4, star.y * h - .5, 8, 1); ctx.fillRect(star.x * w - .5, star.y * h - 4, 1, 8); }
  }
  ctx.globalAlpha = 1;
  const here = sector(state.location), destination = sector(selected);
  if (selected !== state.location) {
    ctx.setLineDash([5, 8]); ctx.lineDashOffset = -artTime / 90; ctx.strokeStyle = '#dbff6390'; ctx.lineWidth = 1.5;
    const from = point(here), to = point(destination);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo((from.x + to.x) / 2, Math.min(from.y, to.y) - 30, to.x, to.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  const pingAge = ping ? (time - ping.at) / 1000 : 99;
  if (ping && pingAge < 3) {
    ctx.strokeStyle = '#d7ff63'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const radius = reducedMotion ? 70 + i * 30 : Math.max(0, pingAge * 150 - i * 45);
      ctx.globalAlpha = Math.max(0, .7 - radius / 400); ctx.beginPath(); ctx.arc(point(ping).x, point(ping).y, radius, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (const star of visibleWorlds()) {
    const { x, y } = point(star), active = star.id === selected;
    const compact = w < 450 && visibleWorlds().length > 4, size = compact ? .75 : 1;
    ctx.strokeStyle = active ? '#deff6266' : '#a294fa20'; ctx.lineWidth = active ? 2 : 1; ctx.setLineDash(active ? [3, 7] : []);
    ctx.beginPath(); ctx.ellipse(x, y, (active ? 46 : 34) * size, (active ? 46 : 34) * size, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    drawPlanet(ctx, star, x, y, (active ? 23 : 17) * size, artTime);
    const labelY = y > h * .68 ? y - 48 * size : y + 48 * size;
    ctx.font = '900 ' + (compact ? 12 : 15) + 'px "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#101124';
    ctx.strokeText(star.name.toUpperCase(), x, labelY); ctx.fillStyle = active ? '#efffc9' : '#beb9dc'; ctx.fillText(star.name.toUpperCase(), x, labelY);
    ctx.font = 'bold 8px ui-monospace, monospace';
    if (state.claims.includes(star.id)) { ctx.fillStyle = '#d7ff63'; ctx.fillText('★ ARTIFACT SECURED', x, labelY + 14); }
    else if (scanned.has(star.id)) { ctx.fillStyle = '#a5a4c2'; ctx.fillText('SIGNAL FOUND', x, labelY + 14); }
    if (star.monster) {
      const mx = x + (x > w * .72 ? -47 : 47) * size, my = y - 30 * size, startled = pingAge < 3.5 && ping.target === star.id;
      drawMonster(ctx, star.monster, mx, my, (active ? 27 : 21) * size, artTime, startled);
      if (startled) {
        ctx.font = '900 10px "Arial Black", sans-serif'; ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.roundRect(mx - 39, my - 58, 78, 22, 6); ctx.fill(); ctx.fillStyle = '#18152e'; ctx.fillText(star.monster === 'jelly' ? 'BLORP!' : 'SNACK?!', mx, my - 43);
      }
    }
  }
  if (state.started) drawShip(ctx, point(ship).x, point(ship).y - 25, artTime, moving && !reducedMotion);
  portraitContext.clearRect(0, 0, 300, 225);
  drawPlanet(portraitContext, destination, 135, 136, 68, artTime);
  if (destination.monster) drawMonster(portraitContext, destination.monster, 213, 99, 65, artTime, pingAge < 3.5 && ping.target === destination.id);
  else {
    portraitContext.strokeStyle = '#fff9e870'; portraitContext.lineWidth = 2; portraitContext.setLineDash([3, 8]);
    portraitContext.beginPath(); portraitContext.ellipse(143, 126, 112, 44, -.4, 0, Math.PI * 2); portraitContext.stroke(); portraitContext.setLineDash([]);
    drawShip(portraitContext, 235, 62 + Math.sin(artTime / 1300) * 6, 0, false);
  }
  requestAnimationFrame(frame);
}
render(); requestAnimationFrame(frame);
try { state = await api('state'); dock(); render(); }
catch (error) { notice(error.message); }
