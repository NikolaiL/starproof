import { mountCollectibles } from './collectibles.js';
import { mountAirdrop } from './airdrop.js';
import { WedgieSigner } from './sdk.js';
import { SECTORS, MAPS, MAX_FUEL, START_CREDITS, SCAVENGE_FUEL, jumpCost, DEVICE_VERSION, sector, PROTOCOL, chartedWorlds, chartBounds } from './protocol.js';
import { drawPlanet, drawMonster, drawShip, drawBackdrop, drawJourney, journeyFrame, drawConfetti, shipHeading, journeyHeading } from './graphics.js';
import { mapPoint, planetAction, focusCamera, smoothCamera, followCamera, planetControls } from './navigation.js';
import { openApproval, showVerifying, closeApproval, openInstall, installProgress } from './approval.js';
import { showModel, stopModelPress, closeModel } from './wedgie-model.js';

const $ = (id) => document.getElementById(id);
const emptyLog = $('receipts').firstElementChild;
const signer = new WedgieSigner('starproof');
let state = { started: false, location: 'sol', fuel: MAX_FUEL, credits: START_CREDITS, maps: ['home'], refuelCost: 0, claims: [], receipts: [], sequence: 0 };
const collectibles = mountCollectibles({ api, getState: () => state });
let view = chartBounds(chartedWorlds(state.maps)), viewTarget = view;
let selected = 'kepler', busy = false, deviceReady = false, cancelled = false;
let ship = { x: 0.23, y: 0.54, heading: 0 }, noticeTimer;
let deviceInput = null, infoOpenFor = null, infoPointer = false;
let ping = null, journey = null, celebration = null;
let camera = { x: view.left + view.width / 2, y: view.top + view.height / 2, zoom: 1 };
let mapView = { ...camera };
let followingShip = false;
let knownCount = chartedWorlds(state.maps).length, overview = false, drag = null, dragged = false;
let cancellation;
const keys = new Set();
const planetNodes = new Map();
const canvas = $('space'), ctx = canvas.getContext('2d');
const rocketLayer = $('rocket-layer'), rocketContext = rocketLayer.getContext('2d');
const flightHeader = document.querySelector('.flight-header'), resourceBar = document.querySelector('.resource-bar');
const portrait = $('planet'), portraitContext = portrait.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
let statsUpdate = null;
function syncDeviceStats() {
  if (!deviceReady) return Promise.resolve();
  if (statsUpdate) return statsUpdate;
  statsUpdate = signer.request('starproof_state', { location: state.location, fuel: state.fuel, credits: state.credits, artifacts: state.claims.length }, 1500)
    .catch(error => { if (deviceReady) notice('Device status screen could not update. ' + error.message); })
    .finally(() => { statsUpdate = null; });
  return statsUpdate;
}
setInterval(() => { if (deviceReady && !busy) void syncDeviceStats(); }, 2000);
function notice(text) { clearTimeout(noticeTimer); $('notice').textContent = text; $('notice').classList.add('is-visible'); noticeTimer = setTimeout(() => $('notice').classList.remove('is-visible'), 9000); }
function select(id) { if (state.maps.includes(sector(id).map)) { selected = id; focusMap(id); render(); } }
function togglePlanetInfo(id = selected) {
  const close = infoOpenFor === id;
  infoPointer = false;
  infoOpenFor = close ? null : id;
  select(id);
  if (close) $('planet-info').hidePopover(); else $('planet-info').showPopover();
}
function focusMap(id) { followingShip = false; const box = canvas.getBoundingClientRect(); camera = focusCamera(sector(id), viewTarget, box.width, box.height); }
function visibleWorlds() { return chartedWorlds(state.maps); }
function dock() { const here = sector(state.location); ship = { x: here.x, y: here.y, heading: ship.heading ?? 0 }; }

for (const star of SECTORS) {
  const node = document.createElement('div'); node.className = 'planet-node'; node.dataset.id = star.id;
  node.style.setProperty('--planet-color', star.color);
  const name = document.createElement('button'); name.type = 'button'; name.className = 'planet-name'; name.textContent = star.name;
  name.addEventListener('click', () => select(star.id));
  const status = document.createElement('span'); status.className = 'planet-loot';
  const action = document.createElement('button'); action.type = 'button'; action.className = 'planet-action';
  action.addEventListener('click', () => { selected = star.id; render(); void commit(planetAction(state, star.id, deviceReady, busy).action, star.id); });
  const info = document.createElement('button'); info.type = 'button'; info.className = 'planet-info-button'; info.textContent = 'i';
  info.setAttribute('aria-controls', 'planet-info'); info.setAttribute('aria-label', 'About ' + star.name);
  info.addEventListener('click', () => togglePlanetInfo(star.id));
  const title = document.createElement('div'); title.className = 'planet-title'; title.append(name, info);
  node.append(title, status, action); $('destinations').append(node);
  planetNodes.set(star.id, { node, name, status, action, info });
}

function render() {
  collectibles.update();
  if (!state.maps.includes(sector(selected).map)) selected = state.location;
  viewTarget = chartBounds(visibleWorlds());
  canvas.parentElement.dataset.worlds = visibleWorlds().length;
  canvas.parentElement.dataset.started = state.started;
  if (knownCount !== visibleWorlds().length) { knownCount = visibleWorlds().length; focusMap(state.location); }
  const destination = sector(selected), here = selected === state.location;
  $('fuel').replaceChildren(document.createTextNode(String(state.fuel).padStart(2, '0') + ' '), Object.assign(document.createElement('small'), { textContent: '/ 0' + MAX_FUEL }));
  $('artifact-count').textContent = state.claims.length;
  $('credits').textContent = state.credits;
  $('fuel-meter').value = state.fuel;
  $('fuel-meter').setAttribute('aria-valuetext', state.fuel + ' of ' + MAX_FUEL + ' fuel');
  $('refuel').textContent = state.refuelCost ? 'Refuel · ' + state.refuelCost + ' credits' : 'Refuel · free cache';
  $('refuel').disabled = busy || (!deviceReady && state.confirmations?.refuel !== false) || !state.started || state.fuel >= MAX_FUEL || state.credits < state.refuelCost;
  $('fuel-hint').textContent = state.started ? (state.refuelCost ? 'Jumps use 2–8 fuel. Refill for ' + state.refuelCost + ' credits, or scavenge for free.' : 'Free full-tank cache at ' + sector(state.location).name + '. Jumps use 2–8 fuel.') : 'Approve launch on your Wedgie. Then collect artifacts to chart new stars.';
  $('scavenge').textContent = 'Scavenge +' + SCAVENGE_FUEL + ' fuel';
  $('scavenge').disabled = busy || (!deviceReady && state.confirmations?.scavenge !== false) || !state.started || state.fuel >= MAX_FUEL;
  const found = MAPS.find((map) => map.foundAt === selected);
  $('loot-note').textContent = state.claims.includes(selected) ? 'Artifact recovered. This planet’s loot is yours.' : 'Artifact loot: +4 credits' + (found ? ' + ' + found.name + ' star map.' : '.');
  $('charted-count').textContent = visibleWorlds().length + ' stars charted';
  const next = MAPS.find((map) => !state.maps.includes(map.id));
  $('map-hint').textContent = next ? 'Recover the artifact on ' + sector(next.foundAt).name + ' to chart the next stars.' : 'Every star is charted. The whole universe is on this map.';
  $('destination-name').textContent = destination.name;
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
  $('launch').disabled = busy;
  $('start-exploring').disabled = busy;
  $('start-exploring').textContent = busy ? 'Preparing your adventure…' : 'Start exploring ↗';
  $('start-hint').textContent = deviceReady ? 'Choose Start exploring, then press green to confirm.' : 'Connect your Wedgie, then start exploring.';
  $('refuel').hidden = !state.started;
  $('scavenge').hidden = !state.started;
  $('scan').hidden = !state.started;
  $('connect').disabled = busy;
  $('signing-help').disabled = busy;
  $('scan').disabled = !state.started || busy;
  const connected = !!signer.port && deviceReady;
  $('connect').textContent = connected ? 'Connected ▾' : 'Connect Wedgie ↗';
  $('connect').classList.toggle('is-connected', connected);
  $('connect').setAttribute('aria-haspopup', connected ? 'dialog' : 'false');
  $('disconnect').disabled = busy;
  $('dock-location').textContent = (state.started ? 'Docked at ' : 'Ready at ') + sector(state.location).name;
  $('mission-hint').textContent = !deviceReady && state.started && Object.values(state.confirmations || {}).some(value => !value) ? 'Demo actions work without device confirmation.' : !deviceReady ? 'Connect your Wedgie to ' + (state.started ? 'continue.' : 'launch.') : state.started ? 'Pick a planet. Sign the big decisions.' : 'Your chip is ready. Launch your expedition.';
  const demoActions = Object.values(state.confirmations || {}).some(required => !required);
  $('trust-status').textContent = state.started ? (demoActions ? 'DEMO · SOME ACTIONS UNSIGNED' : 'TRUST M SIGNATURE VERIFIED') : 'AWAITING LAUNCH';
  for (const input of document.querySelectorAll('[data-confirmation]')) { input.checked = state.confirmations?.[input.dataset.confirmation] !== false; input.disabled = busy; }
  $('settings-status').textContent = demoActions ? 'Unconfirmed actions are recorded as unsigned demo actions.' : 'All strategic actions require Wedgie confirmation.';
  $('trust-status').className = 'status' + (state.started && !demoActions ? ' verified' : '');
  for (const [id, { node, name, status, action, info }] of planetNodes) {
    node.hidden = !state.maps.includes(sector(id).map);
    node.classList.toggle('active', id === selected);
    node.classList.toggle('is-here', id === state.location);
    node.classList.toggle('is-collected', state.claims.includes(id));
    name.setAttribute('aria-pressed', String(id === selected));
    name.setAttribute('aria-label', 'Inspect ' + sector(id).name + (id === state.location ? ', current system' : ''));
    info.setAttribute('aria-expanded', String($('planet-info').matches(':popover-open') && selected === id));
    const control = planetAction(state, id, deviceReady, busy);
    status.textContent = (id === state.location ? 'Here · ' : state.claims.includes(id) ? '✓ ' : '◇ ') + control.status;
    action.textContent = control.text; action.disabled = control.disabled;
    action.setAttribute('aria-label', control.text + ' at ' + sector(id).name);
    action.title = state.confirmations?.[control.action] === false ? 'Demo action · no Wedgie prompt' : !deviceReady ? 'Connect your Wedgie first' : !state.started ? 'Launch your expedition first' : control.text;
  }
  $('export').disabled = state.receipts.length === 0;
  if (state.receipts.length) {
    $('receipts').replaceChildren(...state.receipts.map((receipt) => {
      const item = document.createElement('li'), number = document.createElement('span'), title = document.createElement('span');
      number.textContent = String(receipt.sequence).padStart(2, '0');
      title.textContent = receipt.action === 'launch' ? 'Expedition authorized · departed Sol' : receipt.action === 'jump' ? 'Jump committed · ' + sector(receipt.target).name : receipt.action === 'refuel' ? 'Tank filled · ' + (receipt.cost ? receipt.cost + ' credits' : 'planet cache') : receipt.action === 'scavenge' ? 'Fuel scavenged · ' + sector(receipt.target).name : 'Artifact secured · ' + sector(receipt.target).artifact;
      const proof = Object.assign(document.createElement('span'), { className: 'receipt-proof', textContent: receipt.fingerprint ? 'CHIP ' + receipt.fingerprint.slice(0, 10) + '…' : 'UNSIGNED · DEMO' });
      const time = document.createElement('time'); time.dateTime = receipt.at; time.textContent = new Date(receipt.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.append(number, title, proof, time); return item;
    }));
  } else $('receipts').replaceChildren(emptyLog);
}

async function connectDevice() {
  if (signer.port && deviceReady) return true;
  if (busy) return false;
  busy = true; render();
  try {
    await signer.connect({ version: DEVICE_VERSION, install: async (port) => {
      const response = await fetch('/device-install.json');
      if (!response.ok) throw new Error('Could not load the device installer. Reload and try again.');
      const bundle = await response.json();
      const { installDevice } = await import('/vendor/installer.js');
      openInstall(bundle.version, bundle.source);
      void showModel({ action: 'install', target: 'sol' });
      try {
        return await installDevice(port, bundle, (progress, what) => { stopModelPress(); installProgress(progress, what); });
      } finally { closeModel(); closeApproval(); }
    } });
    if (!signer.canCancel) throw new Error('Install the updated Starproof device app for refuelling and browser cancellation, then reconnect.');
    const identity = await api('device', { cert: signer.cert });
    deviceReady = true;
    $('device-status').textContent = 'Trust M certificate accepted';
    $('device-detail').textContent = 'Chip ' + identity.fingerprint.slice(0, 16) + '… · prove possession at launch';
    await syncDeviceStats();
    notice('Connected. Start exploring, then press green on your Wedgie.');
    return true;
  } catch (error) {
    await signer.disconnect();
    notice(/failed to open serial port|serial port is already open/i.test(error.message)
      ? 'Could not open Wedgie’s USB port. Close other wedgie.dev and Starproof tabs, or serial tools. Unplug and reconnect your Wedgie, then try Connect Wedgie again.'
      : error.message);
    return false;
  } finally { busy = false; render(); }
}
for (const input of document.querySelectorAll('[data-confirmation]')) input.addEventListener('change', async () => {
  const settings = { [input.dataset.confirmation]: input.checked };
  const previous = state.confirmations || { jump: true, claim: true, refuel: true, scavenge: true };
  state.confirmations = { ...previous, ...settings };
  busy = true; render();
  try { state = await api('settings', settings); }
  catch (error) { state.confirmations = previous; notice(error.message); }
  finally { busy = false; render(); }
});
async function deviceJob(work) {
  if (busy) return;
  if (!deviceReady && !await connectDevice()) return;
  busy = true; deviceInput = null; render();
  try { if (statsUpdate) await statsUpdate; await work(); }
  catch (error) { notice(error.message); }
  finally { busy = false; render(); void syncDeviceStats(); }
}
mountAirdrop({ signer, api, deviceJob, notice });
$('connect').addEventListener('click', () => {
  if (busy) return;
  if (!signer.port || !deviceReady) { void connectDevice(); return; }
  const box = $('connect').getBoundingClientRect(), menu = $('device-menu');
  menu.style.top = box.bottom + 8 + 'px';
  menu.style.right = Math.max(12, innerWidth - box.right) + 'px';
  $('connection-status').textContent = $('device-status').textContent;
  $('connection-app').textContent = 'Starproof app ' + DEVICE_VERSION + ' · USB';
  $('connection-detail').textContent = $('device-detail').textContent;
  menu.togglePopover();
});
$('device-menu').addEventListener('toggle', event => $('connect').setAttribute('aria-expanded', String(event.newState === 'open')));
$('disconnect').addEventListener('click', async () => {
  if (busy) return;
  busy = true; $('device-menu').hidePopover(); render();
  try { if (statsUpdate) await statsUpdate; await signer.disconnect(); }
  catch (error) { notice(error.message); }
  finally { busy = false; render(); }
});
signer.addEventListener('disconnect', () => {
  $('device-menu').hidePopover();
  $('connect').setAttribute('aria-expanded', 'false');
  deviceInput = null;
  deviceReady = false; $('device-status').textContent = 'No Wedgie connected';
  $('device-detail').textContent = 'Reconnect the same chip to commit another decision.'; render();
});

signer.addEventListener('input', event => {
  if (!deviceReady || busy || $('approval').open) return;
  if (event.detail.action === 'go') { deviceInput = null; togglePlanetInfo(); return; }
  if ($('planet-info').matches(':popover-open')) return;
  if (!state.started) return;
  if (event.detail.action === 'refuel' || event.detail.action === 'scavenge') { void commit(event.detail.action, state.location); return; }
  deviceInput = { ...event.detail, at: performance.now() };
  if (event.detail.scan) scan();
});

async function commit(action, target) {
  if (busy) return;
  deviceInput = null;
  busy = true; cancelled = false; cancellation = null; render();
  let challenge;
  try {
    if (statsUpdate) await statsUpdate;
    const previous = state.location;
    const cameraBox = canvas.getBoundingClientRect();
    const cameraFrom = focusCamera(sector(previous), viewTarget, cameraBox.width, cameraBox.height);
    if (action === 'launch' || state.confirmations?.[action] !== false) {
      challenge = await api('challenge', { action, target, cert: signer.cert });
      if ($('planet-info').matches(':popover-open')) $('planet-info').hidePopover();
      openApproval(challenge);
      void showModel(challenge);
      const proof = await signer.signAction(challenge);
      if (cancelled) return;
      showVerifying(); stopModelPress();
      state = await api('commit', { id: challenge.id, ...proof });
    } else {
      if ($('planet-info').matches(':popover-open')) $('planet-info').hidePopover();
      state = await api('act', { action, target });
    }
    if (state.location !== previous) dock();
    selected = state.location;
    await syncDeviceStats();
    closeModel(); closeApproval();
    render();
    if (action === 'launch' || action === 'jump') {
      const box = canvas.getBoundingClientRect();
      journey = { from: previous, target, at: performance.now(), action, cameraFrom, cameraTo: focusCamera(sector(target), viewTarget, box.width, box.height) };
      if (reducedMotion) camera = journey.cameraTo;
      $('journey-banner').hidden = false;
      await new Promise(resolve => setTimeout(resolve, reducedMotion ? 350 : 1500));
      const fromPoint = mapPoint(sector(previous), view, box.width, box.height, mapView), toPoint = mapPoint(sector(target), view, box.width, box.height, mapView);
      ship.heading = reducedMotion ? 0 : journeyHeading(fromPoint, toPoint, 1);
      camera = journey.cameraTo; journey = null; $('journey-banner').hidden = true;
    }
    if (action === 'claim') {
      celebration = { target, at: performance.now() };
      $('journey-banner').textContent = '✦ ' + sector(target).artifact + ' collected! +4 credits';
      $('journey-banner').hidden = false;
      setTimeout(() => { if (!journey) $('journey-banner').hidden = true; }, 2600);
    }
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
async function startExploring() {
  if (busy || state.started) return;
  if (!deviceReady && !await connectDevice()) return;
  await commit('launch', 'sol');
}
$('launch').addEventListener('click', startExploring);
$('start-exploring').addEventListener('click', startExploring);
document.addEventListener('pointerdown', event => {
  infoPointer = !!event.target.closest('.planet-info-button');
  if (!event.target.closest('.planet-info-button, #planet-info')) infoOpenFor = null;
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') infoOpenFor = null; });
$('close-planet-info').addEventListener('click', () => { infoOpenFor = null; });
$('planet-info').addEventListener('toggle', event => {
  if (event.newState === 'closed' && !infoPointer) infoOpenFor = null;
  for (const [id, { info }] of planetNodes) info.setAttribute('aria-expanded', String($('planet-info').matches(':popover-open') && selected === id));
});
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
  if (dragged) { dragged = false; return; }
  const box = canvas.getBoundingClientRect(), x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
  const distance = (star) => { const p = mapPoint(star, view, box.width, box.height, mapView); return Math.hypot(p.x - x * box.width, p.y - y * box.height); };
  const nearest = visibleWorlds().sort((a, b) => distance(a) - distance(b))[0];
  if (distance(nearest) < (overview ? 30 : 65)) select(nearest.id);
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointerdown', event => {
  followingShip = false;
  drag = { x: event.clientX, y: event.clientY, camera: { ...camera } }; dragged = false;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!drag) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) dragged = true;
  const box = canvas.getBoundingClientRect();
  const scale = Math.min(box.width / view.width, box.height / view.height) * mapView.zoom;
  camera.x = drag.camera.x - dx / scale;
  camera.y = drag.camera.y - dy / scale;
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
$('zoom-in').addEventListener('click', () => { followingShip = false; camera.zoom = Math.min(6, camera.zoom * 1.35); });
$('zoom-out').addEventListener('click', () => { followingShip = false; camera.zoom = Math.max(.6, camera.zoom / 1.35); });
$('fit-map').addEventListener('click', () => { followingShip = false; camera = { x: viewTarget.left + viewTarget.width / 2, y: viewTarget.top + viewTarget.height / 2, zoom: 1 }; });
$('center-map').addEventListener('click', () => { followingShip = true; const box = canvas.getBoundingClientRect(); camera = focusCamera(ship, viewTarget, box.width, box.height); });
$('minimap').addEventListener('click', event => {
  followingShip = false;
  const box = $('minimap').getBoundingClientRect();
  const scale = Math.min(box.width / viewTarget.width, box.height / viewTarget.height);
  camera.x = viewTarget.left + viewTarget.width / 2 + (event.clientX - box.left - box.width / 2) / scale;
  camera.y = viewTarget.top + viewTarget.height / 2 + (event.clientY - box.top - box.height / 2) / scale;
});
// Keep procedural scenery local; effects begin only after the server accepts an action.
let last = performance.now();
function frame(time) {
  const dt = Math.min((time - last) / 1000, .05); last = time;
  const artTime = reducedMotion ? 0 : time;
  const box = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(box.width * dpr), pixelHeight = Math.round(box.height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = rocketLayer.width = pixelWidth;
    canvas.height = rocketLayer.height = pixelHeight;
  }
  const w = box.width, h = box.height; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  rocketContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  rocketContext.clearRect(0, 0, w, h);
  const controlsTop = Math.max(0, Math.max(flightHeader.getBoundingClientRect().bottom, resourceBar.getBoundingClientRect().bottom) - box.top);
  const controlsHeight = Math.max(0, Math.min(h, innerHeight - box.top) - controlsTop);
  for (const key of ['left', 'top', 'width', 'height']) view[key] += (viewTarget[key] - view[key]) * (reducedMotion ? 1 : Math.min(1, dt * 4));
  if (journey && !reducedMotion) {
    const f = journeyFrame(time - journey.at);
    for (const key of ['x', 'y', 'zoom']) camera[key] = journey.cameraFrom[key] + (journey.cameraTo[key] - journey.cameraFrom[key]) * f.progress;
  }
  mapView = journey ? { ...camera } : smoothCamera(mapView, camera, dt, reducedMotion);
  const point = (object) => mapPoint(object, view, w, h, mapView);
  overview = Math.min(w / view.width, h / view.height) * mapView.zoom < 90;
  canvas.parentElement.dataset.overview = overview;
  const stick = deviceInput && time - deviceInput.at < 250 ? deviceInput : { dx: 0, dy: 0 };
  const moving = state.started && !busy && !$('approval').open && (stick.dx || stick.dy || ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some((key) => keys.has(key)));
  if (state.started && !busy && !$('approval').open) {
    const dx = Math.max(-1, Math.min(1, stick.dx + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)));
    const dy = Math.max(-1, Math.min(1, stick.dy + (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)));
    const scale = Math.min(w / view.width, h / view.height) * mapView.zoom;
    ship.x += dx * dt * 180 / scale;
    ship.y += dy * dt * 180 / scale;
    if (dx || dy) { const target = shipHeading(dx, dy); ship.heading += Math.atan2(Math.sin(target - ship.heading), Math.cos(target - ship.heading)) * (reducedMotion ? 1 : Math.min(1, dt * 14)); }
    ship.x = Math.max(viewTarget.left + (w < 760 ? .6 : viewTarget.width * .05), Math.min(viewTarget.left + viewTarget.width - (w < 760 ? .6 : viewTarget.width * .05), ship.x));
    ship.y = Math.max(viewTarget.top + (w < 760 ? .65 : viewTarget.height * .08), Math.min(viewTarget.top + viewTarget.height - (w < 760 ? .7 : viewTarget.height * .11), ship.y));
  }
  if (moving) followingShip = true;
  if (followingShip && state.started && !busy && !journey) {
    camera = followCamera(ship, view, w, h, camera);
    mapView = followCamera(ship, view, w, h, mapView);
  }
  drawBackdrop(ctx, w, h, artTime, camera);
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
    const size = overview ? .55 : w < 760 ? 1 : 1.45;
    const node = planetNodes.get(star.id).node;
    const radius = (active ? 23 : 17) * size;
    const label = planetControls({ x, y: y - controlsTop }, radius * 2.3, w, controlsHeight, radius + 8);
    node.style.visibility = label.visible ? '' : 'hidden';
    node.style.transform = `translate(${label.x}px, ${label.y + controlsTop}px) translateX(-50%)`;
    ctx.strokeStyle = active ? '#deff6266' : '#a294fa20'; ctx.lineWidth = active ? 2 : 1; ctx.setLineDash(active ? [3, 7] : []);
    ctx.beginPath(); ctx.ellipse(x, y, (active ? 46 : 34) * size, (active ? 46 : 34) * size, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    drawPlanet(ctx, star, x, y, radius, artTime);
    if (star.monster && !overview) {
      const mx = x + (w < 760 && x < w / 2 ? -23 : 23) * size, my = y - 13 * size, startled = pingAge < 3.5 && ping.target === star.id;
      ctx.strokeStyle = star.color + '88'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, 34 * size, 26 * size, -.5, 0, Math.PI * 2); ctx.stroke();
      drawMonster(ctx, star.monster, mx, my, (active ? 14 : 12) * size, artTime, startled);
      if (startled) {
        ctx.textAlign = 'center';
        ctx.font = '900 10px "Arial Black", sans-serif'; ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.roundRect(mx - 39, my - 58, 78, 22, 6); ctx.fill(); ctx.fillStyle = '#18152e'; ctx.fillText(star.monster === 'jelly' ? 'BLORP!' : 'SNACK?!', mx, my - 43);
      }
    }
  }
  if (journey) {
    const age = reducedMotion ? 1400 : time - journey.at;
    const f = journeyFrame(age);
    const text = f.phase === 'departure' ? 'Leaving ' + sector(journey.from).name + '…' : f.phase === 'warp' ? '✦ Hyperspace. Hold onto your snacks.' : 'Welcome to ' + sector(journey.target).name + '!';
    if ($('journey-banner').textContent !== text) $('journey-banner').textContent = text;
    drawJourney(ctx, point(sector(journey.from)), point(sector(journey.target)), w, h, age, reducedMotion, rocketContext);
  } else if (state.started) {
    const { x, y } = point(ship);
    drawShip(moving ? rocketContext : ctx, x - 25, y - 31, artTime, moving && !reducedMotion, ship.heading);
  }
  if (celebration && !reducedMotion) drawConfetti(ctx, point(sector(celebration.target)), time - celebration.at, w < 760 ? 42 : 80);
  const radar = $('minimap').getContext('2d'); radar.clearRect(0, 0, 160, 92);
  for (const world of visibleWorlds()) {
    const p = mapPoint(world, viewTarget, 160, 92); radar.fillStyle = world.id === state.location ? '#e3ff88' : world.color;
    radar.beginPath(); radar.arc(p.x, p.y, world.id === state.location ? 3.5 : 2, 0, Math.PI * 2); radar.fill();
  }
  const cp = mapPoint(mapView, viewTarget, 160, 92);
  const radarScale = Math.min(160 / viewTarget.width, 92 / viewTarget.height), mainScale = Math.min(w / view.width, h / view.height) * mapView.zoom;
  const rw = w / mainScale * radarScale, rh = h / mainScale * radarScale;
  radar.strokeStyle = '#faf6e8aa'; radar.strokeRect(cp.x - rw / 2, cp.y - rh / 2, rw, rh);
  if ($('planet-info').matches(':popover-open')) {
  portraitContext.clearRect(0, 0, 300, 225);
  drawPlanet(portraitContext, destination, 135, 136, 68, artTime);
  if (destination.monster) drawMonster(portraitContext, destination.monster, 184, 105, 32, artTime, pingAge < 3.5 && ping.target === destination.id);
  else {
    portraitContext.strokeStyle = '#fff9e870'; portraitContext.lineWidth = 2; portraitContext.setLineDash([3, 8]);
    portraitContext.beginPath(); portraitContext.ellipse(143, 126, 112, 44, -.4, 0, Math.PI * 2); portraitContext.stroke(); portraitContext.setLineDash([]);
    drawShip(portraitContext, 235, 62 + Math.sin(artTime / 1300) * 6, 0, false);
  }
  }
  requestAnimationFrame(frame);
}
render(); requestAnimationFrame(frame);
try {
  state = await api('state'); dock();
  if (state.started) selected = state.location;
  view = chartBounds(visibleWorlds());
  if (state.started) focusMap(state.location);
  mapView = { ...camera };
  render();
}
catch (error) { notice(error.message); }
