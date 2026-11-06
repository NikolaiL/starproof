import { WedgieSigner } from './sdk.js';
import { SECTORS, sector, PROTOCOL } from './protocol.js';

const $ = (id) => document.getElementById(id);
const emptyLog = $('receipts').firstElementChild;
const signer = new WedgieSigner('starproof');
let state = { started: false, location: 'sol', fuel: 8, claims: [], receipts: [], sequence: 0 };
let selected = 'kepler', busy = false, deviceReady = false, cancelled = false;
let ship = { x: 0.23, y: 0.54 }, scanned = new Set(), noticeTimer;
const keys = new Set();
const canvas = $('space'), ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
function notice(text) { clearTimeout(noticeTimer); $('notice').textContent = text; $('notice').hidden = false; noticeTimer = setTimeout(() => $('notice').hidden = true, 9000); }
function select(id) { selected = id; render(); }
function dock() { const here = sector(state.location); ship = { x: here.x, y: here.y }; }

for (const star of SECTORS) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'destination-button';
  button.textContent = '✧ ' + star.name.toUpperCase(); button.dataset.id = star.id;
  button.addEventListener('click', () => select(star.id)); $('destinations').append(button);
}

function render() {
  const destination = sector(selected), here = selected === state.location;
  $('fuel').replaceChildren(document.createTextNode(String(state.fuel).padStart(2, '0') + ' '), Object.assign(document.createElement('small'), { textContent: '/ 08' }));
  $('artifact-count').replaceChildren(document.createTextNode(String(state.claims.length).padStart(2, '0') + ' '), Object.assign(document.createElement('small'), { textContent: '/ 04' }));
  $('destination-name').textContent = destination.name;
  $('destination-description').textContent = destination.description;
  $('world-type').textContent = here ? 'CURRENT SYSTEM' : 'UNEXPLORED SYSTEM';
  $('landmark').textContent = destination.world;
  $('destination-state').textContent = state.claims.includes(selected) ? 'Artifact secured' : here && state.started ? 'In range' : 'Uncharted';
  $('jump-cost').textContent = here ? '—' : '01 fuel';
  $('planet').className = 'planet ' + destination.id;
  $('location-tag').textContent = sector(state.location).name.toUpperCase() + ' SYSTEM';
  $('chart-title').textContent = state.started ? 'Chart your own course' : 'The near unknown';
  $('map-overlay').hidden = state.started;
  $('launch').hidden = state.started;
  $('launch').disabled = busy || !deviceReady;
  $('jump').disabled = busy || !deviceReady || !state.started || here || state.fuel < 1;
  $('claim').disabled = busy || !deviceReady || !state.started || !here || state.claims.includes(selected);
  $('connect').disabled = busy;
  $('connect').textContent = signer.port && deviceReady ? 'Disconnect ↗' : 'Connect Wedgie ↗';
  $('mission-hint').textContent = state.started ? 'Mission active. Fly freely; sign your next commitment.' : 'A real Trust M signature is required to leave Sol.';
  $('trust-status').textContent = state.started ? 'TRUST M SIGNATURE VERIFIED' : 'AWAITING LAUNCH';
  $('trust-status').className = 'status' + (state.started ? ' verified' : '');
  for (const button of $('destinations').children) { button.classList.toggle('active', button.dataset.id === selected); button.setAttribute('aria-pressed', String(button.dataset.id === selected)); }
  $('export').disabled = state.receipts.length === 0;
  if (state.receipts.length) {
    $('receipts').replaceChildren(...state.receipts.map((receipt) => {
      const item = document.createElement('li'), number = document.createElement('span'), title = document.createElement('span');
      number.textContent = String(receipt.sequence).padStart(2, '0');
      title.textContent = receipt.action === 'launch' ? 'Expedition authorized · departed Sol' : receipt.action === 'jump' ? 'Jump committed · ' + sector(receipt.target).name : 'Artifact secured · ' + sector(receipt.target).artifact;
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
    await signer.connect();
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
  busy = true; cancelled = false; render();
  let challenge;
  try {
    challenge = await api('challenge', { action, target, cert: signer.cert });
    $('approval-title').textContent = action === 'launch' ? 'Authorize your expedition.' : action === 'jump' ? 'Commit to ' + sector(target).name + '.' : 'Claim ' + sector(target).artifact + '.';
    $('approval-description').textContent = action === 'jump' ? 'Review the destination and 1-fuel cost on the device. Sign with the green button.' : 'Review this action on the device. Sign with the green button to continue.';
    $('cancel').disabled = false;
    $('approval').showModal();
    const proof = await signer.signAction(challenge);
    if (cancelled) return;
    $('cancel').disabled = true;
    const previous = state.location;
    state = await api('commit', { id: challenge.id, ...proof });
    if (state.location !== previous) dock();
    selected = state.location;
    notice(action === 'launch' ? 'Signature verified. The stars are yours.' : action === 'jump' ? 'Jump committed. Welcome to ' + sector(target).name + '.' : sector(target).artifact + ' secured.');
    canvas.focus();
  } catch (error) {
    if (!cancelled) notice(error.message);
    if (challenge) await api('cancel', {}).catch(() => {});
    // The server may have restarted or expired this session; show the game it actually has.
    state = await api('state').catch(() => state);
    if (!state.started) dock();
  } finally { $('approval').close(); busy = false; render(); }
}
$('launch').addEventListener('click', () => commit('launch', 'sol'));
$('jump').addEventListener('click', () => commit('jump', selected));
$('claim').addEventListener('click', () => commit('claim', selected));
async function cancel() {
  if (cancelled || $('cancel').disabled) return;
  cancelled = true;
  try { await api('cancel', {}); notice('Request cancelled. Decline on the Wedgie to clear its screen.'); }
  catch { notice('Could not reach the server. Decline on the device; this request will expire.'); }
  $('approval').close();
}
$('cancel').addEventListener('click', cancel);
$('approval').addEventListener('cancel', (event) => { event.preventDefault(); void cancel(); });
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ protocol: PROTOCOL, receipts: state.receipts }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'starproof-receipts.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function scan() {
  if (!state.started || busy) return;
  let nearest = SECTORS[0];
  for (const star of SECTORS) if (Math.hypot(ship.x - star.x, ship.y - star.y) < Math.hypot(ship.x - nearest.x, ship.y - nearest.y)) nearest = star;
  scanned.add(nearest.id); select(nearest.id);
  notice('Signal: ' + nearest.world + '. ' + nearest.description + ' Scan complete; no signature needed.');
}
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
  const nearest = [...SECTORS].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]; select(nearest.id); canvas.focus();
});
// Deterministic star positions; no remote assets or analytics.
const stars = Array.from({ length: 100 }, (_, i) => ({ x: ((i * 137.508) % 997) / 997, y: ((i * 83.17 + 31) % 991) / 991, r: i % 11 === 0 ? 1.4 : .6 }));
let last = performance.now();
function frame(time) {
  const dt = Math.min((time - last) / 1000, .05); last = time;
  const box = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(box.width * dpr) || canvas.height !== Math.round(box.height * dpr)) { canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr); }
  const w = box.width, h = box.height; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  if (state.started && !busy && !$('approval').open) {
    ship.x += ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)) * dt * .18;
    ship.y += ((keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)) * dt * .18;
    ship.x = Math.max(.04, Math.min(.96, ship.x)); ship.y = Math.max(.08, Math.min(.89, ship.y));
  }
  ctx.strokeStyle = '#23394645'; ctx.lineWidth = .5;
  for (let x = 0; x < w; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 45) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (const star of stars) { ctx.fillStyle = '#9bbcc5'; ctx.globalAlpha = .2 + (reducedMotion ? .3 : (Math.sin(time / 1800 + star.x * 40) + 1) * .2); ctx.beginPath(); ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  const here = sector(state.location), destination = sector(selected);
  if (selected !== state.location) { ctx.setLineDash([4, 7]); ctx.strokeStyle = '#86bba969'; ctx.beginPath(); ctx.moveTo(here.x * w, here.y * h); ctx.lineTo(destination.x * w, destination.y * h); ctx.stroke(); ctx.setLineDash([]); }
  for (const star of SECTORS) {
    const x = star.x * w, y = star.y * h, active = star.id === selected;
    ctx.strokeStyle = active ? '#9be6cd88' : '#58757b45'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, active ? 43 : 31, active ? 43 : 31, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#56707930'; ctx.beginPath(); ctx.ellipse(x, y, 58, 21, -.5, 0, Math.PI * 2); ctx.stroke();
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 21); glow.addColorStop(0, star.color + '77'); glow.addColorStop(1, star.color + '00'); ctx.fillStyle = glow; ctx.fillRect(x - 21, y - 21, 42, 42);
    ctx.fillStyle = star.color; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = active ? '#e5eee9' : '#859da8'; ctx.fillText(star.name.toUpperCase(), x, y + 56);
    if (state.claims.includes(star.id)) { ctx.fillStyle = '#9be6cd'; ctx.fillText('ARTIFACT SECURED', x, y + 70); }
    else if (scanned.has(star.id)) { ctx.fillStyle = '#728d92'; ctx.fillText('SIGNAL FOUND', x, y + 70); }
  }
  if (state.started) {
    const x = ship.x * w, y = ship.y * h;
    ctx.save(); ctx.translate(x, y - 20); ctx.fillStyle = '#e9fff4'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  requestAnimationFrame(frame);
}
render(); requestAnimationFrame(frame);
try { state = await api('state'); dock(); render(); }
catch (error) { notice(error.message); }
