import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Game } from './lib/game.js';
import { trustM } from 'wedgie-actions/server';

const PUBLIC = new URL('./public/', import.meta.url);
const FILES = { '/': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'],
  '/app.js': ['app.js', 'text/javascript'], '/sdk.js': [new URL(import.meta.resolve('wedgie-actions/browser')), 'text/javascript'], '/protocol.js': ['protocol.js', 'text/javascript'] };
const ROUTES = new Set(['GET /api/state', 'POST /api/device', 'POST /api/challenge', 'POST /api/commit', 'POST /api/cancel']);

// Tests pass an ephemeral test PKI; the running server always uses the production verifier.
export function createApp(verifier = trustM) {
  const sessions = new Map();
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      if (!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host || '')) return json({ error: 'Use localhost or 127.0.0.1.' }, 403);
      const origin = `http://${req.headers.host}`;
      const path = new URL(req.url, origin).pathname;
      if (req.method === 'GET' && FILES[path]) {
        const [file, type] = FILES[path];
        const content = await readFile(new URL(file, PUBLIC));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(content); return;
      }
      if (!path.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
      if (req.headers.origin && req.headers.origin !== origin) return json({ error: 'Cross-origin requests are refused.' }, 403);
      if (req.headers['sec-fetch-site'] === 'cross-site') return json({ error: 'Cross-site requests are refused.' }, 403);
      if (!ROUTES.has(`${req.method} ${path}`)) return json({ error: 'Not found.' }, 404);
      let body = {};
      if (req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json({ error: 'JSON required.' }, 415);
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16_384) { json({ error: 'Request too large.' }, 413); return; }
          chunks.push(chunk);
        }
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json({ error: 'Invalid JSON.' }, 400); }
        if (!body || Array.isArray(body) || typeof body !== 'object') return json({ error: 'Expected an object.' }, 400);
      }
      const now = Date.now();
      for (const [key, session] of sessions) if (now - session.last > 2 * 60 * 60_000) sessions.delete(key);
      const cookie = /(?:^|;\s*)starproof=([0-9a-f]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      let session = cookie && sessions.get(cookie);
      if (!session) {
        if (sessions.size >= 100) {
          // ponytail: evicts the oldest unlaunched game; add per-client limits before serving beyond localhost.
          const idle = [...sessions].find(([, entry]) => !entry.game.started)?.[0];
          if (!idle) return json({ error: 'Too many sessions. Restart the local demo server.' }, 429);
          sessions.delete(idle);
        }
        const id = randomBytes(32).toString('hex');
        session = { game: new Game(verifier), last: now, requests: [] };
        sessions.set(id, session);
        // No Max-Age: the server expires sessions after two idle hours.
        res.setHeader('Set-Cookie', `starproof=${id}; HttpOnly; SameSite=Strict; Path=/`);
      }
      session.last = now;
      if (path === '/api/state') return json(session.game.state());
      session.requests = session.requests.filter((time) => now - time < 60_000);
      if (session.requests.length >= 30) return json({ error: 'Too many requests. Wait a minute.' }, 429);
      session.requests.push(now);
      if (path === '/api/device') {
        const device = verifier.identity(body.cert);
        return json({ fingerprint: device.fingerprint });
      }
      if (path === '/api/challenge') return json(session.game.challenge(body.action, body.target, body.cert, origin));
      if (path === '/api/commit') return json(session.game.complete(body.id, { r: body.r, s: body.s }));
      if (path === '/api/cancel') { session.game.pending = null; return json({ cancelled: true }); }
      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      json({ error: error.message || 'Request failed.' }, 400);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4173);
  const app = createApp();
  app.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  app.listen(port, '127.0.0.1', () => console.log(`Starproof: http://localhost:${port}`));
}
