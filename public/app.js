import { WedgieSigner } from './sdk.js';
import { SECTORS, MAPS, MAX_FUEL, START_CREDITS, SCAVENGE_FUEL, jumpCost, DEVICE_VERSION, sector, PROTOCOL, chartedWorlds, chartBounds } from './protocol.js';
import { drawPlanet, drawMonster, drawShip } from './graphics.js';
import { mapPoint, planetAction } from './navigation.js';
import { openApproval, showVerifying, closeApproval, openInstall, installProgress } from './approval.js';
import { showModel, stopModelPress, closeModel } from './wedgie-model.js';

const $ = (id) => document.getElementById(id);
const emptyLog = $('receipts').firstElementChild;
const signer = new WedgieSigner('starproof');
let state = { started: false, location: 'sol', fuel: MAX_FUEL, credits: START_CREDITS, maps: ['home'], refuelCost: 0, claims: [], receipts: [], sequence: 0 };
let view = chartBounds(chartedWorlds(state.maps)), viewTarget = view;
let selected = 'kepler', busy = false, deviceReady = false, cancelled = false;
let ship = { x: 0.23, y: 0.54 }, noticeTimer;
let ping = null;
let cancellation;
const keys = new Set();
const planetNodes = new Map();
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
  const node = document.createElement('div'); node.className = 'planet-node'; node.dataset.id = star.id;
  node.style.setProperty('--planet-color', star.color);
  const name = document.createElement('button'); name.type = 'button'; name.className = 'planet-name'; name.textContent = star.name;
  name.addEventListener('click', () => select(star.id));
  const status = document.createElement('span'); status.className = 'planet-loot';
  const action = document.createElement('button'); action.type = 'button'; action.className = 'planet-action';
  action.addEventListener('click', () => { select(star.id); void commit(planetAction(state, star.id, deviceReady, busy).action, star.id); });
  node.append(name, status, action); $('destinations').append(node);
  planetNodes.set(star.id, { node, name, status, action });
}

function render() {
  if (!state.maps.includes(sector(selected).map)) selected = state.location;
  viewTarget = chartBounds(visibleWorlds());
  canvas.parentElement.dataset.worlds = visibleWorlds().length;
  const destination = sector(selected), here = selected === state.location;
  $('fuel').replaceChildren(document.createTextNode(String(state.fuel).padStart(2, '0') + ' '), Object.assign(document.createElement('small'), { textContent: '/ 0' + MAX_FUEL }));
  $('artifact-count').replaceChildren(document.createTextNode(String(state.claims.length).padStart(2, '0') + ' '), Object.assign(document.createElement('small'), { textContent: '/ 0' + SECTORS.length }));
  $('credits').textContent = state.credits;
  $('fuel-meter').value = state.fuel;
  $('fuel-meter').setAttribute('aria-valuetext', state.fuel + ' of ' + MAX_FUEL + ' fuel');
  $('refuel').textContent = state.refuelCost ? 'Refuel · ' + state.refuelCost + ' credits' : 'Refuel · free cache';
  $('refuel').disabled = busy || !deviceReady || !state.started || state.fuel >= MAX_FUEL || state.credits < state.refuelCost;
  $('fuel-hint').textContent = state.started ? (state.refuelCost ? 'Jumps use 2–8 fuel. Refill for ' + state.refuelCost + ' credits, or scavenge for free.' : 'Free full-tank cache at ' + sector(state.location).name + '. Jumps use 2–8 fuel.') : 'Approve launch on your Wedgie. Then collect artifacts to chart new stars.';
  $('scavenge').textContent = 'Scavenge +' + SCAVENGE_FUEL + ' fuel';
  $('scavenge').disabled = busy || !deviceReady || !state.started || state.fuel >= MAX_FUEL;
  const found = MAPS.find((map) => map.foundAt === selected);
  $('loot-note').textContent = state.claims.includes(selected) ? 'Artifact recovered. This planet’s loot is yours.' : 'Artifact loot: +4 credits' + (found ? ' + ' + found.name + ' star map.' : '.');
  $('charted-count').textContent = visibleWorlds().length + ' / ' + SECTORS.length + ' STARS CHARTED';
  const next = MAPS.find((map) => !state.maps.includes(map.id));
  $('map-hint').textContent = next ? 'Recover the artifact on ' + sector(next.foundAt).name + ' to chart the next stars.' : 'Every star is charted. The whole universe is on this map.';
  $('destination-name').textContent = destination.name;
  $('report-name').textContent = destination.name;
  $('destination-description').textContent = destination.description;
  $('world-type').textContent = here ? 'Current system' : 'Selected system';
  $('landmark').textContent = destination.world;
  $('destination-state').textContent = state.claims.includes(selected) ? 'Artifact secured' : here && state.started ? 'Ready to collect' : 'Artifact available';
  $('jump-cost').textContent = here ? '—' : jumpCost(state.location, selected) + ' fuel';
  $('resident-name').textContent = destination.resident || 'Clear skies. For now.';
  $('resident-note').textContent = destination.residentNote || 'A peaceful place to stretch your space legs.';
  $('resident-card').classList.toggle('has-monster', !!destination.monster);
  $('location-tag').textContent = sector(state.location).name.toUpperCase() + ' SYSTEM';
  $('map-overlay').hidden = state.started;
  $('launch').hidden = state.started;
  $('launch').disabled = busy || !deviceReady;
  $('refuel').hidden = !state.started;
  $('scavenge').hidden = !state.started;
  $('scan').hidden = !state.started;
  $('connect').disabled = busy;
  $('signing-help').disabled = busy;
  $('scan').disabled = !state.started || busy;
  $('connect').textContent = signer.port && deviceReady ? 'Disconnect ↗' : 'Connect Wedgie ↗';
  $('dock-location').textContent = (state.started ? 'Docked at ' : 'Ready at ') + sector(state.location).name;
  $('mission-hint').textContent = !deviceReady ? 'Connect your Wedgie to ' + (state.started ? 'continue.' : 'launch.') : state.started ? 'Pick a planet. Sign the big decisions.' : 'Your chip is ready. Launch your expedition.';
  $('trust-status').textContent = state.started ? 'TRUST M SIGNATURE VERIFIED' : 'AWAITING LAUNCH';
  $('trust-status').className = 'status' + (state.started ? ' verified' : '');
  for (const [id, { node, name, status, action }] of planetNodes) {
    node.hidden = !state.maps.includes(sector(id).map);
    node.classList.toggle('active', id === selected);
    node.classList.toggle('is-here', id === state.location);
    node.classList.toggle('is-collected', state.claims.includes(id));
    name.setAttribute('aria-pressed', String(id === selected));
    name.setAttribute('aria-label', 'Inspect ' + sector(id).name + (id === state.location ? ', current system' : ''));
    const control = planetAction(state, id, deviceReady, busy);
    status.textContent = (id === state.location ? 'Here · ' : state.claims.includes(id) ? '✓ ' : '◇ ') + control.status;
    action.textContent = control.text; action.disabled = control.disabled;
    action.setAttribute('aria-label', control.text + ' at ' + sector(id).name);
    action.title = !deviceReady ? 'Connect your Wedgie first' : !state.started ? 'Launch your expedition first' : control.text;
  }
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
    notice(/failed to open serial port|serial port is already open/i.test(error.message)
      ? 'Could not open Wedgie’s USB port. Close other wedgie.dev and Starproof tabs, or serial tools. Unplug and reconnect your Wedgie, then try Connect Wedgie again.'
      : error.message);
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
    canvas.focus({ preventScroll: true });
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
  select(nearest.id);
  ping = { at: performance.now(), x: ship.x, y: ship.y, target: nearest.id };
  $('scan-readout').textContent = nearest.monster ? nearest.resident + ': “' + nearest.greeting + '”' : nearest.world + ': clear skies. Keep exploring.';
  notice(nearest.monster ? nearest.resident + ' heard your ping. ' + nearest.greeting : 'Signal: ' + nearest.world + '. ' + nearest.description);
}
$('scan').addEventListener('click', scan);
addEventListener('keydown', (event) => {
  if (event.target !== canvas || $('approval').open || event.metaKey || event.ctrlKey || event.altKey) return;
  // event.code ignores Shift/Caps Lock, so a keyup always matches its keydown.
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault(); keys.add(event.code);
    if (event.code === 'Space' && !event.repeat) scan();
  }
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('blur', () => keys.clear());
canvas.addEventListener('click', (event) => {
  const box = canvas.getBoundingClientRect(), x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
  const distance = (star) => { const p = mapPoint(star, view, box.width, box.height); return Math.hypot(p.x - x * box.width, p.y - y * box.height); };
  const nearest = visibleWorlds().sort((a, b) => distance(a) - distance(b))[0];
  if (distance(nearest) < 65) select(nearest.id);
  canvas.focus({ preventScroll: true });
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
  const point = (object) => mapPoint(object, view, w, h);
  const moving = state.started && !busy && !$('approval').open && ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some((key) => keys.has(key));
  if (state.started && !busy && !$('approval').open) {
    const dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    ship.x += (w < 760 ? dy : dx) * dt * .18 * view.width;
    ship.y += (w < 760 ? dx : dy) * dt * .18 * view.height;
    ship.x = Math.max(viewTarget.left + (w < 760 ? .6 : viewTarget.width * .05), Math.min(viewTarget.left + viewTarget.width - (w < 760 ? .6 : viewTarget.width * .05), ship.x));
    ship.y = Math.max(viewTarget.top + (w < 760 ? .65 : viewTarget.height * .08), Math.min(viewTarget.top + viewTarget.height - (w < 760 ? .7 : viewTarget.height * .11), ship.y));
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
    const size = w < 760 ? .85 : 1.2;
    const node = planetNodes.get(star.id).node;
    node.style.transform = `translate(${x}px, ${y + (w < 760 ? 24 : 37 * size)}px) translateX(-50%)`;
    ctx.strokeStyle = active ? '#deff6266' : '#a294fa20'; ctx.lineWidth = active ? 2 : 1; ctx.setLineDash(active ? [3, 7] : []);
    ctx.beginPath(); ctx.ellipse(x, y, (active ? 46 : 34) * size, (active ? 46 : 34) * size, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    drawPlanet(ctx, star, x, y, (active ? 23 : 17) * size, artTime);
    if (star.monster) {
      const mx = x + (w < 760 && x < w / 2 ? -23 : 23) * size, my = y - 13 * size, startled = pingAge < 3.5 && ping.target === star.id;
      ctx.strokeStyle = star.color + '88'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, 34 * size, 26 * size, -.5, 0, Math.PI * 2); ctx.stroke();
      drawMonster(ctx, star.monster, mx, my, (active ? 24 : 21) * size, artTime, startled);
      if (startled) {
        ctx.textAlign = 'center';
        ctx.font = '900 10px "Arial Black", sans-serif'; ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.roundRect(mx - 39, my - 58, 78, 22, 6); ctx.fill(); ctx.fillStyle = '#18152e'; ctx.fillText(star.monster === 'jelly' ? 'BLORP!' : 'SNACK?!', mx, my - 43);
      }
    }
  }
  if (state.started) drawShip(ctx, point(ship).x - 20, point(ship).y - 30, artTime, moving && !reducedMotion);
  portraitContext.clearRect(0, 0, 300, 225);
  drawPlanet(portraitContext, destination, 135, 136, 68, artTime);
  if (destination.monster) drawMonster(portraitContext, destination.monster, 184, 105, 48, artTime, pingAge < 3.5 && ping.target === destination.id);
  else {
    portraitContext.strokeStyle = '#fff9e870'; portraitContext.lineWidth = 2; portraitContext.setLineDash([3, 8]);
    portraitContext.beginPath(); portraitContext.ellipse(143, 126, 112, 44, -.4, 0, Math.PI * 2); portraitContext.stroke(); portraitContext.setLineDash([]);
    drawShip(portraitContext, 235, 62 + Math.sin(artTime / 1300) * 6, 0, false);
  }
  requestAnimationFrame(frame);
}
render(); requestAnimationFrame(frame);
try {
  state = await api('state'); dock();
  if (state.started) selected = state.location;
  view = chartBounds(visibleWorlds());
  render();
}
catch (error) { notice(error.message); }
