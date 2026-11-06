import { randomBytes } from 'node:crypto';
import { encodeAction } from 'wedgie-actions/protocol';
import { sector, MAPS, MAX_FUEL, FUEL_PRICE, CHALLENGE_MS } from '../public/protocol.js';

const token = () => randomBytes(16).toString('hex');

export class Game {
  constructor(verifier, now = Date.now) {
    this.verifier = verifier;
    this.now = now;
    this.id = token();
    this.started = false;
    this.location = 'sol';
    this.fuel = MAX_FUEL;
    this.credits = 6;
    this.maps = ['home'];
    this.fuelCaches = [];
    this.sequence = 0;
    this.device = null;
    this.claims = [];
    this.receipts = [];
    this.pending = null;
  }

  state() {
    return { started: this.started, location: this.location, fuel: this.fuel, sequence: this.sequence,
      device: this.device, claims: this.claims, receipts: this.receipts,
      credits: this.credits, maps: this.maps, fuelCaches: this.fuelCaches, refuelCost: this.refuelCost() };
  }

  refuelCost() { return this.fuelCaches.includes(this.location) ? FUEL_PRICE : 0; }

  allowed(action, target) {
    if (!sector(target)) throw new Error('Unknown destination.');
    if (action === 'launch') {
      if (this.started) throw new Error('This expedition has already launched.');
      if (target !== 'sol') throw new Error('Expeditions launch from Sol.');
    } else {
      if (!this.started) throw new Error('Sign the launch before making strategic decisions.');
      if (action === 'jump') {
        if (!this.maps.includes(sector(target).map)) throw new Error('Find this region’s star map before travelling there.');
        if (target === this.location) throw new Error('Choose another star system.');
        if (this.fuel < 1) throw new Error('No jump fuel remains.');
      } else if (action === 'claim') {
        if (target !== this.location) throw new Error('Travel to this system before claiming its artifact.');
        if (this.claims.includes(target)) throw new Error('This artifact is already in your collection.');
      } else if (action === 'refuel') {
        if (target !== this.location) throw new Error('Refuel at the current planet.');
        if (this.fuel >= MAX_FUEL) throw new Error('The fuel tank is already full.');
        if (this.credits < this.refuelCost()) throw new Error('Not enough credits. Claim an artifact or use an untouched fuel cache.');
      } else throw new Error('Unknown strategic action.');
    }
  }

  challenge(action, target, cert, origin) {
    this.allowed(action, target);
    const device = this.verifier.identity(cert, this.now());
    if (this.device && this.device !== device.fingerprint) throw new Error('Reconnect the chip that launched this expedition.');
    const fields = { origin, session: this.id, challenge: token(), chip: device.fingerprint, action, from: this.location,
      target, cost: action === 'jump' ? 1 : action === 'refuel' ? this.refuelCost() : 0, sequence: this.sequence,
      expires: Math.floor((this.now() + CHALLENGE_MS) / 1000), nonce: randomBytes(32).toString('hex') };
    const text = encodeAction('starproof', fields);
    this.pending = { fields, text, cert };
    return { id: fields.challenge, text, expires: fields.expires, action, target, cost: fields.cost };
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
    if (fields.action === 'claim') {
      this.claims.push(fields.target);
      this.credits += 4;
      const found = MAPS.find((map) => map.foundAt === fields.target);
      if (found && !this.maps.includes(found.id)) this.maps.push(found.id);
    }
    if (fields.action === 'refuel') {
      this.credits -= fields.cost;
      if (!this.fuelCaches.includes(this.location)) this.fuelCaches.push(this.location);
      this.fuel = MAX_FUEL;
    }
    this.sequence++;
    this.receipts.unshift({ action: fields.action, target: fields.target, cost: fields.cost, sequence: this.sequence,
      at: new Date(this.now()).toISOString(), text, r: proof.r, s: proof.s, cert,
      fingerprint: device.fingerprint });
    return this.state();
  }
}
