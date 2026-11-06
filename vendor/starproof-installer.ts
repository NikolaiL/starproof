import { Repl } from './repl';
import { busy, writeFile, unb64 } from './files';
import { FREE_PY } from './free-app';

export async function validateBundle(bundle: any) {
  if (bundle.app?.mod !== 'starproof' || bundle.version !== '0.5.0' || !/^[a-f0-9]{40}$/.test(bundle.commit) || !Array.isArray(bundle.files) || bundle.files.length !== 5) throw new Error('Invalid Starproof install bundle.');
  const names = new Set(); let total = 0;
  for (const file of bundle.files) {
    if (!['starproof.py', 'starproof_protocol.py', 'starproof_art.py', 'starproof_actions.py', 'starproof_claim.py'].includes(file.name) || names.has(file.name)) throw new Error('Unsafe install filename.');
    names.add(file.name);
    const bytes = unb64(file.data); total += bytes.length;
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((v) => v.toString(16).padStart(2, '0')).join('');
    if (digest !== file.sha256) throw new Error('Install bundle checksum failed. Reload the page.');
  }
  if (!names.has('starproof.py') || total > 256 * 1024) throw new Error('Invalid app size or entry point.');
}

export async function runInstall(r: Repl, bundle: any, onProgress: (p: number, what: string) => void) {
  await validateBundle(bundle);
  const hello = await r.hello(2000);
  const version = String(hello?.version || '').split('.').map(Number);
  if (!hello?.fw?.startsWith('wedgie-') || version.length !== 3 || version.some(Number.isNaN) || version[0] === 0 && version[1] === 3 && version[2] < 76 || version[0] === 0 && version[1] < 3) throw new Error('Update Wedgie firmware at wedgie.dev/connect first (0.3.76+ required).');
  // Firmware leaves hello.chip null until its first chip check after boot.
  let chip = hello.chip;
  if (chip == null) {
    onProgress(0, 'Checking the secure chip');
    const proof = await r.request({ type: 'chip' }, 15000);
    if (proof.busy) throw new Error('Wedgie’s secure chip is busy. Finish the current device action, then connect again.');
    if (proof.type !== 'chip' || proof.error) throw new Error('Could not check Wedgie’s secure chip. Reconnect it and try again.');
    chip = proof.chip;
  }
  if (chip !== 'OPTIGA Trust M') throw new Error('Starproof requires an OPTIGA Trust M chip.');
  if (hello.sealed && !hello.open) {
    const reply = await r.request({ type: 'open', for: 'Install Starproof' }, 65000);
    if (reply.type !== 'open') throw new Error('Installation declined or timed out. Nothing was installed.');
  }
  onProgress(0, 'Preparing the device');
  await r.request({ type: 'stop' }, 800).catch(() => {});
  await r.enter({ reset: false });
  try {
  await r.exec(FREE_PY, 10000);
  await busy(r, 'Installing Starproof');
  const free = Number((await r.exec('import os\n_s=os.statvfs("/")\nprint(_s[0]*_s[3])')).trim());
  const bytesNeeded = bundle.files.reduce((n: number, file: any) => n + unb64(file.data).length, 0);
  if (!Number.isFinite(free) || free < bytesNeeded + 32768) throw new Error('Not enough device flash space to install Starproof.');
  for (const [index, file] of bundle.files.entries()) {
    onProgress(index / bundle.files.length, file.name);
    await writeFile(r, '/' + file.name, unb64(file.data), { sha: file.sha256, span: [index / bundle.files.length, (index + 1) / bundle.files.length] });
  }
  const app = { ...bundle.app, files: bundle.files.map((file: any) => file.name), repo: 'NikolaiL/wedgie-starproof', sha: bundle.commit, unreviewed: true, v: bundle.commit.slice(0, 12) };
  await writeFile(r, '/apps.json', new TextEncoder().encode(JSON.stringify([app])));
  } finally { await r.leave({ reset: false }); }
  onProgress(1, 'Installed. Connecting to Starproof');
  return hello.uid;
}

export async function waitForApp(port: SerialPort, uid: string, onProgress: (p: number, what: string) => void) {
  if (typeof uid !== 'string' || !uid) throw new Error('Starproof was installed, but the device identity is unavailable. Click Connect Wedgie again.');
  onProgress(1, 'Installed. Waiting for Starproof to start');
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    // A reboot may replace the port. Only return the originally selected board, already running our app.
    const ports = [port, ...await navigator.serial.getPorts()];
    for (const candidate of new Set(ports)) {
      if (Date.now() >= deadline) break;
      if (candidate.getInfo().usbVendorId !== 0x2e8a || candidate.connected === false) continue;
      const probe = new Repl(candidate);
      let ready = false;
      try {
        await probe.open();
        const hello = await probe.hello(700);
        ready = hello?.uid === uid && hello.running === 'starproof';
      } catch { /* The USB port can disappear briefly while the app restarts. */ }
      finally { await probe.close(); }
      if (ready) return candidate;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Starproof was installed, but it has not responded after restarting. Reconnect the device and click Connect Wedgie again.');
}

export async function installDevice(port: SerialPort, bundle: any, onProgress: (p: number, what: string) => void) {
  const r = new Repl(port);
  let uid: string;
  try { await r.open(); uid = await runInstall(r, bundle, onProgress); }
  finally { await r.close(); }
  return waitForApp(port, uid, onProgress);
}
