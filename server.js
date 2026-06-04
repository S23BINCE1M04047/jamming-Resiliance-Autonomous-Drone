/**
 * ════════════════════════════════════════════════════════════════
 *  AEGIS-7  |  server.js  |  Backend Server
 *  Node.js HTTP Server — Serves the simulation over WiFi
 *  Includes: API endpoints, session tracking, request logging
 * ════════════════════════════════════════════════════════════════
 *
 *  HOW TO RUN:
 *    1. Install Node.js from nodejs.org
 *    2. Open terminal in this folder (AEGIS7-FullStack/)
 *    3. Run:  node server.js
 *    4. Open: http://localhost:3000
 *    5. Share with fellows: http://YOUR_IP:3000
 *
 *  FIND YOUR IP:
 *    Windows:  ipconfig (look for IPv4 Address)
 *    Mac/Linux: ifconfig or ip a
 * ════════════════════════════════════════════════════════════════
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Configuration ─────────────────────────────────────────────
const PORT    = 3000;
const HOST    = '0.0.0.0'; // All network interfaces
const STATIC  = path.join(__dirname, '..', 'frontend');

// ── MIME Types ─────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.txt':  'text/plain; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

// ── Session store (in-memory — use Redis/DB in production) ─────
const sessions = new Map();

// ── Request log ────────────────────────────────────────────────
const requestLog = [];
function logReq(method, url, status, ip) {
  const entry = { ts: new Date().toISOString(), method, url, status, ip };
  requestLog.push(entry);
  if (requestLog.length > 500) requestLog.shift();
  console.log(`[${entry.ts}] ${method} ${url} → ${status} (${ip})`);
}

// ── Helper: parse request body ─────────────────────────────────
function parseBody(req) {
  return new Promise((res, rej) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      try { res(JSON.parse(body)); } catch { res({}); }
    });
    req.on('error', rej);
  });
}

// ── Helper: get client IP ──────────────────────────────────────
function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.socket?.remoteAddress || 'unknown';
}

// ── Get local network IP ───────────────────────────────────────
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces()))
    for (const i of ifaces)
      if (i.family === 'IPv4' && !i.internal) return i.address;
  return 'localhost';
}

// ════════════════════════════════════════════════════════════════
//  API ROUTES
// ════════════════════════════════════════════════════════════════
async function handleAPI(req, res, urlPath, ip) {

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── POST /api/login ──────────────────────────────────────────
  if (urlPath === '/api/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const { username, password } = body;

    // Validate
    if (!username || !password) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: 'Username and password required' }));
      logReq('POST', '/api/login', 400, ip);
      return;
    }

    // Simulated auth (in real app: check hashed password in DB)
    const users = { operator:'aegis2024', admin:'admin123', viewer:'view123' };
    const roles  = { operator:'OPERATOR', admin:'ADMIN', viewer:'VIEWER' };

    if (users[username] && users[username] === password) {
      const token = Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString('base64');
      sessions.set(token, { username, role: roles[username], loginTime: Date.now(), ip });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, token, username, role: roles[username] }));
      logReq('POST', '/api/login', 200, ip);
    } else {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, error: 'Invalid credentials' }));
      logReq('POST', '/api/login', 401, ip);
    }
    return;
  }

  // ── POST /api/logout ─────────────────────────────────────────
  if (urlPath === '/api/logout' && req.method === 'POST') {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token) sessions.delete(token);
    res.writeHead(200); res.end(JSON.stringify({ success: true }));
    logReq('POST', '/api/logout', 200, ip); return;
  }

  // ── GET /api/status ──────────────────────────────────────────
  if (urlPath === '/api/status' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      server: 'AEGIS-7 Backend',
      version: '2.0.0',
      uptime: process.uptime(),
      activeSessions: sessions.size,
      totalRequests: requestLog.length,
      timestamp: new Date().toISOString(),
    }));
    logReq('GET', '/api/status', 200, ip); return;
  }

  // ── GET /api/sessions ────────────────────────────────────────
  if (urlPath === '/api/sessions' && req.method === 'GET') {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    const sess = sessions.get(token);
    if (!sess || sess.role !== 'ADMIN') {
      res.writeHead(403); res.end(JSON.stringify({ error: 'Admin access required' }));
      logReq('GET', '/api/sessions', 403, ip); return;
    }
    const list = Array.from(sessions.entries()).map(([t, s]) => ({
      token: t.slice(-8)+'...', username: s.username, role: s.role,
      loginTime: new Date(s.loginTime).toISOString(), ip: s.ip,
    }));
    res.writeHead(200); res.end(JSON.stringify({ sessions: list }));
    logReq('GET', '/api/sessions', 200, ip); return;
  }

  // ── GET /api/logs ────────────────────────────────────────────
  if (urlPath === '/api/logs' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ logs: requestLog.slice(-50) }));
    logReq('GET', '/api/logs', 200, ip); return;
  }

  // ── GET /api/mission-data ────────────────────────────────────
  if (urlPath === '/api/mission-data' && req.method === 'GET') {
    // Read from data folder
    const dataPath = path.join(__dirname, '..', 'data', 'missions.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
      if (err) { res.writeHead(200); res.end(JSON.stringify({ missions: [] })); return; }
      res.writeHead(200); res.end(data);
    });
    logReq('GET', '/api/mission-data', 200, ip); return;
  }

  // ── POST /api/save-mission ───────────────────────────────────
  if (urlPath === '/api/save-mission' && req.method === 'POST') {
    const body = await parseBody(req);
    const dataPath = path.join(__dirname, '..', 'data', 'missions.json');
    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(dataPath,'utf8')).missions || []; } catch {}
    existing.push({ id: Date.now(), savedAt: new Date().toISOString(), ...body });
    if (existing.length > 100) existing = existing.slice(-100);
    fs.writeFileSync(dataPath, JSON.stringify({ missions: existing }, null, 2));
    res.writeHead(200); res.end(JSON.stringify({ success: true }));
    logReq('POST', '/api/save-mission', 200, ip); return;
  }

  // Unknown API route
  res.writeHead(404); res.end(JSON.stringify({ error: 'API endpoint not found' }));
  logReq(req.method, urlPath, 404, ip);
}

// ════════════════════════════════════════════════════════════════
//  HTTP SERVER
// ════════════════════════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  const ip      = getIP(req);
  const urlPath = req.url.split('?')[0];

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // API routes
  if (urlPath.startsWith('/api/')) {
    await handleAPI(req, res, urlPath, ip);
    return;
  }

  // Serve static files from /frontend/
  const filePath = path.join(STATIC, urlPath === '/' ? 'index.html' : urlPath);
  const ext      = path.extname(filePath).toLowerCase();
  const mime     = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 404 — try index.html (SPA fallback)
      fs.readFile(path.join(STATIC, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('404 Not Found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
    logReq(req.method, urlPath, 200, ip);
  });
});

// ── Start ─────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  const ip = getLocalIP();
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         AEGIS-7 BACKEND SERVER — ONLINE                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Local:    http://localhost:${PORT}                         ║`);
  console.log(`║  Network:  http://${ip}:${PORT}                    ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  API Endpoints:                                          ║');
  console.log('║    POST /api/login          — Authenticate operator      ║');
  console.log('║    POST /api/logout         — End session                ║');
  console.log('║    GET  /api/status         — Server status              ║');
  console.log('║    GET  /api/sessions       — Active sessions (Admin)    ║');
  console.log('║    GET  /api/logs           — Request log                ║');
  console.log('║    GET  /api/mission-data   — Past missions              ║');
  console.log('║    POST /api/save-mission   — Save mission data          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Default Credentials:                                    ║');
  console.log('║    operator / aegis2024  (Operator role)                 ║');
  console.log('║    admin    / admin123   (Admin role)                    ║');
  console.log('║    viewer   / view123    (Viewer role)                   ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Press Ctrl+C to stop                                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[AEGIS-7] Server shutting down...\n');
  server.close(() => process.exit(0));
});
