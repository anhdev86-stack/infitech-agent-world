#!/usr/bin/env node
// Claude Code hook for INFI TECH Agent World.
// Forwards the hook event to the local server (http://127.0.0.1:8765/ingest) and starts the server
// when needed. Prints nothing and always exits 0, so it never changes what Claude does.
'use strict';
const { ensureServer, post, openViewer, PORT } = require('./lib');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', main);
setTimeout(() => process.exit(0), 8000).unref();

async function main() {
  let ev = {};
  try { ev = JSON.parse(input); } catch (e) { process.exit(0); }
  if (ev.hook_event_name === 'SessionStart') {
    const started = await ensureServer();
    if (started && process.env.AGENT_WORLD_AUTO_OPEN !== '0') openViewer();
  }
  if (!(await post(input))) {
    if (await ensureServer()) await post(input);
  }
  process.exit(0);
}
