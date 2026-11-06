import { randomBytes } from 'node:crypto';
import { encodeAction } from 'wedgie-actions/protocol';
import { sector, CHALLENGE_MS } from '../public/protocol.js';

const token = () => randomBytes(16).toString('hex');

export class Game {
  constructor(verifier, now = Date.now) {
    this.verifier = verifier;
    this.now = now;
    this.id = token();
    this.started = false;
    this.location = 'sol';
    this.fuel = 8;
    this.sequence = 0;
    this.device = null;
    this.claims = [];
    this.receipts = [];
    this.pending = null;
  }

  state() {
    return { started: this.started, location: this.location, fuel: this.fuel, sequence: this.sequence,
      device: this.device, claims: this.claims, receipts: this.receipts };
  }

  allowed(action, target) {
    if (!sector(target)) throw new Error('Unknown destination.');
    if (action === 'launch') {
      if (this.started || target !== 'sol') throw new Error('This expedition has already launched.');
    } else {
      if (!this.started) throw new Error('Sign the launch before making strategic decisions.');
      if (action === 'jump') {
        if (target === this.location) throw new Error('Choose another star system.');
        if (this.fuel < 1) throw new Error('No jump fuel remains.');
      } else if (action === 'claim') {
        if (target !== this.location) throw new Error('Travel to this system before claiming its artifact.');
        if (this.claims.includes(target)) throw new Error('This artifact is already in your collection.');
      } else throw new Error('Unknown strategic action.');
    }
  }

  challenge(action, target, cert, origin) {
    this.allowed(action, target);
    const device = this.verifier.identity(cert, this.now());
    if (this.device && this.device !== device.fingerprint) throw new Error('Reconnect the chip that launched this expedition.');
    const fields = { origin, session: this.id, challenge: token(), chip: device.fingerprint, action, from: this.location,
      target, cost: action === 'jump' ? 1 : 0, sequence: this.sequence,
      expires: Math.floor((this.now() + CHALLENGE_MS) / 1000), nonce: randomBytes(32).toString('hex') };
    const text = encodeAction('starproof', fields);
    this.pending = { fields, text, device, cert };
    return { id: fields.challenge, text, expires: fields.expires, action, target };
  }

  complete(id, proof) {
    const pending = this.pending;
    if (!pending || pending.fields.challenge !== id) throw new Error('Challenge is unknown, cancelled or already used.');
    const { fields, text, cert } = pending;
    if (this.now() >= fields.expires * 1000) { this.pending = null; throw new Error('Approval expired. Request a new action.'); }
    if (fields.sequence !== this.sequence || fields.from !== this.location) throw new Error('Game state changed. Request a new action.');
    this.allowed(fields.action, fields.target);
    const device = this.verifier.identity(cert, this.now());
    this.verifier.signature(device, text, proof);
    this.pending = null;
    this.device = device.fingerprint;
    if (fields.action === 'launch') this.started = true;
    if (fields.action === 'jump') { this.location = fields.target; this.fuel -= fields.cost; }
    if (fields.action === 'claim') this.claims.push(fields.target);
    this.sequence++;
    this.receipts.unshift({ action: fields.action, target: fields.target, sequence: this.sequence,
      at: new Date(this.now()).toISOString(), text, r: proof.r, s: proof.s, cert,
      fingerprint: device.fingerprint });
    return this.state();
  }
}
