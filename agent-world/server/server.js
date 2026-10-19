#!/usr/bin/env node
// INFI TECH Agent World local server: serves the page, receives Claude Code hook events
// (POST /ingest) and streams them to the page (GET /events, Server-Sent Events).
// Listens on 127.0.0.1 only. No dependencies; works on macOS and Windows.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.AGENT_WORLD_PORT) || 8765;
const DATA = process.env.AGENT_WORLD_DATA || path.join(os.homedir(), '.agent-world');
const EV = path.join(DATA, 'events.jsonl');
const PAGE = process.env.AGENT_WORLD_PAGE || path.join(__dirname, 'index.html');
const HIST_MS = 7 * 24 * 3600e3;
const HIST_MAX = 40000;
const MAX_BYTES = 24e6;
const KEYS = ['command', 'file_path', 'notebook_path', 'path', 'pattern', 'url', 'query', 'description', 'skill', 'subagent_type', 'prompt'];
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

fs.mkdirSync(DATA, { recursive: true });
const clients = new Set();
// The Mac app and the Claude Code plugin can both forward the same hook event; keep only the first copy.
const recent = new Map();
function duplicate(rec) {
  const now = Date.now();
  const key = [rec.ev, rec.sid, rec.tid || '', rec.tid ? '' : Math.round(rec.ts / 3000), rec.prompt || ''].join('|');
  for (const [k, t] of recent) if (now - t > 15000) recent.delete(k); else break;
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

function compact(d) {
  const ti = d.tool_input && typeof d.tool_input === 'object' ? d.tool_input : {};
  let k = null, v = null;
  for (const key of KEYS) {
    const val = ti[key];
    if (typeof val === 'string' && val.trim()) { k = key; v = val.trim(); break; }
  }
  const rec = {
    ts: Date.now(), ev: d.hook_event_name || null, sid: String(d.session_id || '').slice(0, 40),
    cwd: d.cwd || '', tool: d.tool_name || null, tid: d.tool_use_id || null, k, v: (v || '').slice(0, 240),
  };
  if (d.prompt) rec.prompt = String(d.prompt).slice(0, 400);
  if (d.message) rec.msg = String(d.message).slice(0, 200);
  if (d.source) rec.src = d.source;
  if (rec.ev === 'PostToolUse') {
    const tr = d.tool_response;
    rec.ok = !(tr && typeof tr === 'object' && (tr.is_error || tr.interrupted));
  }
  return rec;
}

// Claude's final reply for a turn, read from the session transcript Claude Code already keeps on disk.
function lastReply(file) {
  try {
    const root = path.join(os.homedir(), '.claude');
    const real = fs.realpathSync(file);
    if (!real.startsWith(root + path.sep) || !real.endsWith('.jsonl')) return '';
    const st = fs.statSync(real), len = Math.min(st.size, 3e6), buf = Buffer.alloc(len);
    const fd = fs.openSync(real, 'r'); fs.readSync(fd, buf, 0, len, st.size - len); fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n'), parts = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      let d; try { d = JSON.parse(lines[i]); } catch (e) { continue; }
      const c = d.message && d.message.content;
      if (d.type === 'user' && !d.isSidechain && (typeof c === 'string' || (Array.isArray(c) && c.some(x => x.type === 'text')))) break;
      if (d.type === 'assistant' && !d.isSidechain && Array.isArray(c)) {
        // Keep only the closing message: stop at the last tool call once some text was collected.
        if (parts.length && c.some(x => x.type === 'tool_use')) break;
        const t = c.filter(x => x.type === 'text').map(x => x.text).join('\n').trim();
        if (t) parts.unshift(t);
      }
    }
    return parts.join('\n\n').slice(0, 8000);
  } catch (e) { return ''; }
}

function append(rec) {
  try {
    if (fs.existsSync(EV) && fs.statSync(EV).size > MAX_BYTES) {
      const buf = fs.readFileSync(EV);
      let tail = buf.subarray(buf.length - MAX_BYTES / 2);
      tail = tail.subarray(tail.indexOf(10) + 1);
      fs.writeFileSync(EV, tail);
    }
    fs.appendFileSync(EV, JSON.stringify(rec) + '\n');
  } catch (e) { /* disk full or locked: still stream it */ }
  const msg = 'data: ' + JSON.stringify(rec) + '\n\n';
  for (const res of clients) res.write(msg);
}

function history() {
  let text = '';
  try {
    const st = fs.statSync(EV);
    const fd = fs.openSync(EV, 'r');
    const len = Math.min(st.size, 16e6);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.size - len);
    fs.closeSync(fd);
    text = buf.toString('utf8');
  } catch (e) { return []; }
  const cutoff = Date.now() - HIST_MS, out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try { const e = JSON.parse(line); if (e.ts >= cutoff && e.sid) out.push(e); } catch (e) { /* partial line */ }
  }
  return out.slice(-HIST_MAX);
}

const server = http.createServer((req, res) => {
  if (!HOSTS.has(req.headers.host || '')) { res.writeHead(403); return res.end(); }
  const url = (req.url || '/').split('?')[0];

  if (req.method === 'POST' && url === '/ingest') {
    // Hooks post with curl (no Origin header). A web page cannot: it would send Origin and need a CORS preflight.
    if (req.headers.origin || !/application\/json/.test(req.headers['content-type'] || '')) { res.writeHead(403); return res.end(); }
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size <= 30e6) chunks.push(c); });
    req.on('end', () => {
      res.writeHead(204); res.end();
      try {
        const d = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const rec = compact(d);
        if (duplicate(rec)) return;
        if (rec.ev === 'Stop' && d.transcript_path) {
          // Give Claude Code a moment to flush the final message before reading it.
          return setTimeout(() => { rec.reply = lastReply(d.transcript_path); append(rec); }, 400);
        }
        append(rec);
      } catch (e) { /* ignore bad input */ }
    });
    return;
  }
  if (req.method === 'POST' && url === '/shutdown') {
    if (req.headers.origin || !/application\/json/.test(req.headers['content-type'] || '')) { res.writeHead(403); return res.end(); }
    res.writeHead(204); res.end();
    return setTimeout(() => process.exit(0), 100);
  }
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }

  if (url === '/' || url === '/index.html') {
    return fs.readFile(PAGE, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('index.html not found'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  }
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 2000\nevent: history\ndata: ' + JSON.stringify(history()) + '\n\n');
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  res.writeHead(404); res.end();
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error(`Port ${PORT} is already in use; another INFI TECH Agent World server is probably running.`); process.exit(0); }
  throw e;
});
server.listen(PORT, '127.0.0.1', () => console.log(`INFI TECH Agent World: http://127.0.0.1:${PORT}/`));
