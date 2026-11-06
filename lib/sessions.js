import { randomBytes, createHash } from 'node:crypto';
import { Game } from './game.js';
import { ECONOMY_VERSION, MAX_FUEL, START_CREDITS, MAPS } from '../public/protocol.js';

const TTL = 7200;
const fresh = (verifier) => ({ game: new Game(verifier), last: Date.now(), requests: [] });
const restore = (raw, verifier) => {
  const session = JSON.parse(raw);
  const previousVersion = session.game.economyVersion;
  session.game = Object.assign(new Game(verifier), session.game);
  for (const map of MAPS) {
    if (session.game.claims.includes(map.foundAt) && !session.game.maps.includes(map.id)) session.game.maps.push(map.id);
  }
  if (previousVersion !== ECONOMY_VERSION) {
    session.game.economyVersion = ECONOMY_VERSION;
    session.game.fuel = MAX_FUEL;
    session.game.credits = Math.max(session.game.credits, START_CREDITS);
    session.game.pending = null;
  }
  return session;
};
const encode = (session) => JSON.stringify(session, (key, value) => ['verifier', 'now'].includes(key) ? undefined : value);

export class MemorySessions {
  constructor() { this.sessions = new Map(); }
  async run(cookie, verifier, update) {
    const now = Date.now();
    for (const [key, session] of this.sessions) if (now - session.last > TTL * 1000) this.sessions.delete(key);
    let id = cookie, session = this.sessions.get(id), created = !session;
    if (!session) {
      if (this.sessions.size >= 100) {
        const idle = [...this.sessions].find(([, entry]) => !entry.game.started)?.[0];
        if (!idle) throw new Error('Too many sessions. Try again later.');
        this.sessions.delete(idle);
      }
      id = randomBytes(32).toString('hex'); session = fresh(verifier);
      this.sessions.set(id, session);
    }
    return { id, created, result: update(session) };
  }
}

// Compare-and-set keeps nonce consumption atomic across independent Vercel instances.
const CAS = `if (redis.call('GET',KEYS[1]) or '') ~= ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1`;
const LIMIT = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n`;

export class RedisSessions {
  constructor(url, token) { this.url = url; this.token = token; }
  async command(...command) {
    const response = await fetch(this.url, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(8000) });
    const reply = await response.json();
    if (!response.ok || reply.error) throw Object.assign(new Error('Mission storage is unavailable. Try again shortly.'), { status: 503 });
    return reply.result;
  }
  async run(cookie, verifier, update, client = '') {
    let id = cookie, raw = id ? await this.command('GET', 'starproof:session:' + id) : null;
    const created = !raw;
    if (created) {
      const key = createHash('sha256').update(client).digest('hex');
      if (await this.command('EVAL', LIMIT, 1, 'starproof:new:' + key) > 10) throw Object.assign(new Error('Too many new missions. Wait a minute.'), { status: 429 });
      id = randomBytes(32).toString('hex');
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const session = raw ? restore(raw, verifier) : fresh(verifier);
      const result = update(session);
      if (await this.command('EVAL', CAS, 1, 'starproof:session:' + id, raw || '', encode(session), TTL)) return { id, created, result };
      raw = await this.command('GET', 'starproof:session:' + id);
    }
    throw Object.assign(new Error('Mission changed in another tab. Try again.'), { status: 409 });
  }
}
