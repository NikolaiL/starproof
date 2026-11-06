import { sector } from './protocol.js';

const $ = (id) => document.getElementById(id);
let clock;

export function openApproval(challenge, preview = false) {
  clearInterval(clock);
  const { action, target, cost = 0 } = challenge;
  const destination = sector(target);
  $('approval').dataset.phase = preview ? 'preview' : 'waiting';
  $('approval-title').textContent = 'Press the green button.';
  $('approval-description').textContent = preview ? 'On your physical Wedgie. Red says no.' : 'Check the action on your Wedgie, then confirm on the device.';
  $('approval-action').textContent = action === 'launch' ? 'Launch your expedition' : action === 'jump' ? 'Jump to ' + destination.name : action === 'scavenge' ? 'Scavenge up to 2 fuel at ' + destination.name : action === 'refuel' ? 'Refuel at ' + destination.name + (cost ? ' · ' + cost + ' credits' : ' · free cache') : 'Claim ' + destination.artifact;
  $('device-question').textContent = action === 'launch' ? 'Launch mission?' : action === 'jump' ? 'Commit jump?' : action === 'scavenge' ? 'Gather fuel?' : action === 'refuel' ? 'Refuel tank?' : 'Claim artifact?';
  $('device-target').textContent = action === 'launch' ? 'SOL' : action === 'jump' ? destination.name.toUpperCase() : ['refuel', 'scavenge'].includes(action) ? destination.name.toUpperCase() : destination.artifact;
  $('device-cost').textContent = action === 'scavenge' ? 'Free · up to 2 fuel' : action === 'refuel' ? (cost ? cost + ' credits' : 'Free fuel cache') : action === 'jump' ? 'Fuel: ' + cost : 'Fuel: 0';
  $('approval-status').textContent = preview ? 'BUTTON GUIDE · NO REQUEST SENT' : 'WAITING FOR YOUR BUTTON PRESS';
  $('cancel').textContent = preview ? 'Got it' : 'Cancel request in browser';
  $('cancel').disabled = false;
  $('physical-instructions').hidden = false;
  $('approval-countdown').hidden = preview;
  if (!preview) {
    const deadline = Math.min(challenge.expires * 1000, Date.now() + 60_000);
    const update = () => { const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); $('approval-countdown').textContent = seconds ? seconds + 's to respond' : 'Request expired'; };
    update(); clock = setInterval(update, 1000);
  }
  $('approval').showModal();
}

export function openInstall(version, source) {
  openApproval({ action: 'launch', target: 'sol' }, true);
  $('approval').dataset.phase = 'waiting-install';
  $('approval-title').textContent = 'Install Starproof.';
  $('approval-description').textContent = 'Review the source below. Installation switches the running app and needs FULL CONTROL approval on your Wedgie.';
  $('approval-action').textContent = 'Starproof ' + version + ' · first-time setup';
  $('device-question').textContent = 'FULL CONTROL?';
  $('device-target').textContent = 'STARPROOF';
  $('device-cost').textContent = 'Install app';
  $('approval-source').href = source;
  $('approval-status').textContent = 'PRESS GREEN ON WEDGIE TO INSTALL';
  $('cancel').textContent = 'Cancel installation with the red button on Wedgie';
  $('cancel').disabled = true;
}

export function installProgress(progress, what) {
  $('approval').dataset.phase = 'installing';
  $('approval-title').textContent = 'Installing Starproof.';
  $('approval-description').textContent = 'Keep your Wedgie connected. It will restart into Starproof.';
  $('physical-instructions').hidden = true;
  $('approval-status').textContent = Math.round(progress * 100) + '% · ' + what;
}

export function showVerifying() {
  clearInterval(clock);
  $('approval').dataset.phase = 'verifying';
  $('approval-title').textContent = 'Checking your signature.';
  $('approval-description').textContent = 'The server is verifying the chip and this exact action.';
  $('approval-status').textContent = 'SIGNATURE RECEIVED · VERIFYING';
  $('approval-countdown').hidden = true;
  $('cancel').disabled = true;
}

export function closeApproval() {
  clearInterval(clock);
  $('approval').close();
}
