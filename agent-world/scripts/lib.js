'use strict';
// Shared helpers: talk to the local server, start it in the background, open the viewer.
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const PORT = Number(process.env.AGENT_WORLD_PORT) || 8765;
const URL = `http://127.0.0.1:${PORT}/`;
const ROOT = path.resolve(__dirname, '..');
const DATA = process.env.AGENT_WORLD_DATA || path.join(os.homedir(), '.agent-world');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function request(method, p, body, timeout) {
  return new Promise(resolve => {
    const headers = body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {};
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers, timeout }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(body);
  });
}
const health = () => request('GET', '/health', null, 600);
const post = body => request('POST', '/ingest', body, 1500);

// Returns true when this call started the server, false when it was already running or could not start.
async function ensureServer() {
  if (await health()) return false;
  fs.mkdirSync(DATA, { recursive: true });
  const lock = path.join(DATA, 'server.starting');
  try {
    const st = fs.statSync(lock);
    if (Date.now() - st.mtimeMs < 5000) { for (let i = 0; i < 20; i++) { await sleep(150); if (await health()) return false; } return false; }
  } catch (e) { /* no recent start */ }
  fs.writeFileSync(lock, String(Date.now()));
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    detached: true, stdio: 'ignore', windowsHide: true,
    env: { ...process.env, AGENT_WORLD_PAGE: path.join(ROOT, 'server', 'index.html') },
  });
  child.unref();
  for (let i = 0; i < 25; i++) { await sleep(150); if (await health()) return true; }
  return false;
}

function openViewer() {
  const opts = { detached: true, stdio: 'ignore', windowsHide: true };
  let child;
  if (process.platform === 'darwin') child = spawn('open', [URL], opts);
  else if (process.platform === 'win32') child = spawn('cmd', ['/c', 'start', '', URL], opts);
  else child = spawn('xdg-open', [URL], opts);
  child.on('error', () => {});
  child.unref();
}

module.exports = { ensureServer, post, openViewer, health, PORT, URL };
