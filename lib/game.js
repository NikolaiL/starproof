import { randomBytes } from 'node:crypto';
import { encodeAction } from 'wedgie-actions/protocol';
import { sector, MAPS, MAX_FUEL, FUEL_PRICE, START_CREDITS, SCAVENGE_FUEL, ECONOMY_VERSION, jumpCost, CHALLENGE_MS } from '../public/protocol.js';

const token = () => randomBytes(16).toString('hex');

export class Game {
  constructor(verifier, now = Date.now) {
    this.verifier = verifier;
    this.now = now;
    this.id = token();
    this.started = false;
    this.location = 'sol';
    this.fuel = MAX_FUEL;
    this.credits = START_CREDITS;
    this.economyVersion = ECONOMY_VERSION;
    this.maps = ['home'];
    this.fuelCaches = [];
    this.sequence = 0;
    this.device = null;
    this.claims = [];
    this.receipts = [];
    this.pending = null;
    this.confirmations = { jump: true, claim: true, refuel: true, scavenge: true };
  }

  state() {
    return { started: this.started, location: this.location, fuel: this.fuel, sequence: this.sequence,
      device: this.device, claims: this.claims, receipts: this.receipts,
      confirmations: this.confirmations, credits: this.credits, maps: this.maps, fuelCaches: this.fuelCaches, refuelCost: this.refuelCost() };
  }

  setConfirmations(settings) {
    if (!settings || Array.isArray(settings) || typeof settings !== 'object' || !Object.keys(settings).length) throw new Error('Expected confirmation settings.');
    for (const [action, value] of Object.entries(settings)) {
      if (!Object.hasOwn(this.confirmations, action) || typeof value !== 'boolean') throw new Error('Invalid confirmation setting.');
    }
    Object.assign(this.confirmations, settings);
    this.pending = null;
    return this.state();
  }

  act(action, target) {
    if (!Object.hasOwn(this.confirmations, action) || this.confirmations[action] !== false) throw new Error('This action requires Wedgie confirmation.');
    this.allowed(action, target);
    this.pending = null;
    return this.applyAction({ action, target, cost: this.cost(action, target) }, { verification: 'demo' });
  }

  refuelCost() { return this.fuelCaches.includes(this.location) ? FUEL_PRICE : 0; }
  cost(action, target) { return action === 'jump' ? jumpCost(this.location, target) : action === 'refuel' ? this.refuelCost() : 0; }

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
        if (this.fuel < jumpCost(this.location, target)) throw new Error('Not enough jump fuel. Refuel or scavenge before departing.');
      } else if (action === 'claim') {
        if (target !== this.location) throw new Error('Travel to this system before claiming its artifact.');
        if (this.claims.includes(target)) throw new Error('This artifact is already in your collection.');
      } else if (action === 'refuel') {
        if (target !== this.location) throw new Error('Refuel at the current planet.');
        if (this.fuel >= MAX_FUEL) throw new Error('The fuel tank is already full.');
        if (this.credits < this.refuelCost()) throw new Error('Not enough credits. Claim an artifact or scavenge free fuel.');
      } else if (action === 'scavenge') {
        if (target !== this.location) throw new Error('Scavenge at the current planet.');
        if (this.fuel >= MAX_FUEL) throw new Error('The fuel tank is already full.');
      } else throw new Error('Unknown strategic action.');
    }
  }

  challenge(action, target, cert, origin) {
    this.allowed(action, target);
    const device = this.verifier.identity(cert, this.now());
    if (this.device && this.device !== device.fingerprint) throw new Error('Reconnect the chip that launched this expedition.');
    const fields = { origin, session: this.id, challenge: token(), chip: device.fingerprint, action, from: this.location,
      target, cost: this.cost(action, target), sequence: this.sequence,
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
    if (fields.cost !== this.cost(fields.action, fields.target)) throw new Error('Action price changed. Request a new approval.');
    const device = this.verifier.identity(cert, this.now());
    this.verifier.signature(device, text, proof);
    this.pending = null;
    this.device = device.fingerprint;
    return this.applyAction(fields, { text, r: proof.r, s: proof.s, cert, fingerprint: device.fingerprint, verification: 'trustm' });
  }

  applyAction(fields, evidence) {
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
    if (fields.action === 'scavenge') this.fuel = Math.min(MAX_FUEL, this.fuel + SCAVENGE_FUEL);
    this.sequence++;
    this.receipts.unshift({ action: fields.action, target: fields.target, cost: fields.cost, sequence: this.sequence,
      at: new Date(this.now()).toISOString(), ...evidence });
    return this.state();
  }
}
