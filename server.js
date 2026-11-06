import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { MemorySessions, RedisSessions } from './lib/sessions.js';
import { trustM } from 'wedgie-actions/server';

const PUBLIC = new URL('./public/', import.meta.url);
const FILES = { '/': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/favicon.ico': ['favicon.ico', 'image/x-icon'],
  '/favicon-16.png': ['favicon-16.png', 'image/png'], '/favicon-32.png': ['favicon-32.png', 'image/png'],
  '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'],
  '/media/starproof-cover.png': ['media/starproof-cover.png', 'image/png'], '/media/starproof-cover.svg': ['media/starproof-cover.svg', 'image/svg+xml'],
  '/media/starproof-og.png': ['media/starproof-og.png', 'image/png'], '/media/starproof-og.svg': ['media/starproof-og.svg', 'image/svg+xml'],
  '/media/starproof-token.png': ['media/starproof-token.png', 'image/png'], '/media/starproof-token.svg': ['media/starproof-token.svg', 'image/svg+xml'],
  '/launch-crew.svg': ['launch-crew.svg', 'image/svg+xml'],
  '/app.js': ['app.js', 'text/javascript'], '/graphics.js': ['graphics.js', 'text/javascript'], '/navigation.js': ['navigation.js', 'text/javascript'], '/approval.js': ['approval.js', 'text/javascript'],
  '/device-install.json': ['device-install.json', 'application/json'], '/vendor/installer.js': ['vendor/installer.js', 'text/javascript'],
  '/wedgie-model.js': ['wedgie-model.js', 'text/javascript'], '/vendor/wedgie3d.js': ['vendor/wedgie3d.js', 'text/javascript'],
  '/3d/wedgie.json': ['3d/wedgie.json', 'application/json'], '/3d/wedgie.bin': ['3d/wedgie.bin', 'application/octet-stream'],
  '/sdk.js': [new URL(import.meta.resolve('wedgie-actions/browser')), 'text/javascript'], '/protocol.js': ['protocol.js', 'text/javascript'] };
const ROUTES = new Set(['GET /api/state', 'POST /api/device', 'POST /api/challenge', 'POST /api/commit', 'POST /api/cancel', 'POST /api/settings', 'POST /api/act']);

// Tests pass an ephemeral test PKI; the running server always uses the production verifier.
export function createHandler(verifier = trustM, { store, origin: configuredOrigin = process.env.APP_ORIGIN } = {}) {
  if (process.env.VERCEL && !store && !(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) throw new Error('Shared mission storage is required on Vercel.');
  const sessions = store || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? new RedisSessions(process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN) : new MemorySessions());
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      const host = req.headers.host || '';
      const origin = configuredOrigin || `http://${host}`;
      if (configuredOrigin ? host !== new URL(configuredOrigin).host : !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) return json({ error: 'Use the configured Starproof origin.' }, 403);
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
        if (req.body !== undefined) {
          if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) > 16_384) return json({ error: 'Request too large.' }, 413);
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } else {
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 16_384) { json({ error: 'Request too large.' }, 413); return; }
            chunks.push(chunk);
          }
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json({ error: 'Invalid JSON.' }, 400); }
        }
        if (!body || Array.isArray(body) || typeof body !== 'object') return json({ error: 'Expected an object.' }, 400);
      }
      const cookie = /(?:^|;\s*)starproof=([0-9a-f]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      const transaction = await sessions.run(cookie, verifier, (session) => {
        const reply = (data, code = 200) => ({ data, code });
        const now = Date.now(); session.last = now;
        if (path === '/api/state') return reply(session.game.state());
        session.requests = session.requests.filter((time) => now - time < 60_000);
        if (session.requests.length >= 30) return reply({ error: 'Too many requests. Wait a minute.' }, 429);
        session.requests.push(now);
        try {
          if (path === '/api/settings') return reply(session.game.setConfirmations(body));
          if (path === '/api/act') return reply(session.game.act(body.action, body.target));
          if (path === '/api/device') return reply({ fingerprint: verifier.identity(body.cert).fingerprint });
          if (path === '/api/challenge') return reply(session.game.challenge(body.action, body.target, body.cert, origin));
          if (path === '/api/commit') return reply(session.game.complete(body.id, { r: body.r, s: body.s }));
          if (path === '/api/cancel') { session.game.pending = null; return reply({ cancelled: true }); }
        } catch (error) { return reply({ error: error.message || 'Request failed.' }, 400); }
      }, process.env.VERCEL ? req.headers['x-forwarded-for'] || '' : 'local');
      if (transaction.created) res.setHeader('Set-Cookie', `starproof=${transaction.id}; HttpOnly; SameSite=Strict; Path=/${origin.startsWith('https:') ? '; Secure' : ''}`);
      json(transaction.result.data, transaction.result.code);
    } catch (error) {
      json({ error: error.message || 'Request failed.' }, error.status || 400);
    }
  };
}

export function createApp(verifier, options) { return createServer(createHandler(verifier, options)); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4173);
  const app = createApp();
  app.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  app.listen(port, '127.0.0.1', () => console.log(`Starproof: http://localhost:${port}`));
}
