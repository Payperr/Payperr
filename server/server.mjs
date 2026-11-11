#!/usr/bin/env node
// Entry point:  node server/server.mjs   (START.bat runs this for you on Windows)
// Options: --port 8787   --open (open the browser on Windows/macOS/Linux)
// Public read-only deployment: set PAYPER_MODE=public and PUBLIC_ORIGIN (see docs/DEPLOY.md).
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { loadConfig } from './config.mjs';
import { createMarket } from './market.mjs';
import { createApp, ROOT } from './app.mjs';
import { resolveRuntime } from './deploy.mjs';

const [maj] = process.versions.node.split('.').map(Number);
if (maj < 18) { console.error(`Node.js ${process.versions.node} is too old. Install the current LTS from https://nodejs.org/ (version 18 or newer).`); process.exit(1); }

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const cfgFile = path.join(ROOT, 'paper.config.json');
const loaded = loadConfig(cfgFile);
if (!loaded.ok) { console.error('\n  Settings problem in ' + cfgFile + ':\n'); for (const e of loaded.errors) console.error('   - ' + e); console.error('\n  Fix the file and start again.\n'); process.exit(1); }
const cfg = loaded.config;
const rt = resolveRuntime(process.env, cfg, ROOT);
if (rt.errors.length) { console.error('\n  Payper cannot start. Please fix:\n'); for (const e of rt.errors) console.error('   - ' + e); console.error('\n  Then start again (or redeploy).\n'); process.exit(1); }
for (const w of rt.warnings) console.warn('  WARNING: ' + w);
const port = rt.readOnly ? rt.port : Number(arg('--port') || process.env.PORT || cfg.port);
const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const log = (scope, msg) => console.log(`[${stamp()}] ${scope}: ${msg}`);
// Single instance: two servers must never share one paper-state file.
const lockFile = path.join(rt.dataDir, 'server.lock');
try { fs.mkdirSync(rt.dataDir, { recursive: true }); fs.accessSync(rt.dataDir, fs.constants.W_OK); }
catch (e) { console.error(`\n  Payper cannot write to its data folder (${rt.dataDir}): ${e.code || e.message}.\n  Check DATA_DIR and that the disk mounted there is writable by this app.\n`); process.exit(1); }
try { const old = JSON.parse(fs.readFileSync(lockFile, 'utf8')); let alive = false; try { process.kill(old.pid, 0); alive = old.pid !== process.pid; } catch (e) { alive = e.code === 'EPERM'; }
  if (alive && !rt.readOnly) { console.error(`\n  Payper is already running (process ${old.pid}).\n  Open http://127.0.0.1:${old.port}/ in your browser, or close the other window first.\n`); process.exit(1); } } catch {}
const writeLock = (p) => fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, port: p, at: new Date().toISOString() }));
writeLock(port);
const dropLock = () => { try { if (JSON.parse(fs.readFileSync(lockFile, 'utf8')).pid === process.pid) fs.unlinkSync(lockFile); } catch {} };
process.on('exit', dropLock);
const market = createMarket({ timeoutMs: cfg.market.requestTimeoutMs, log });
const app = createApp({ cfg, market, stateFile: path.join(rt.dataDir, 'paper-state.json'), log,
  readOnly: rt.readOnly, trustedHosts: rt.readOnly ? rt.trustedHosts : null, bindHost: rt.bindHost, publicOrigin: rt.publicOrigin, tokenMint: rt.tokenMint, maxStreams: rt.maxStreams });

app.listen(port).then((p) => {
  writeLock(p); const url = rt.readOnly ? rt.publicOrigin + '/' : `http://127.0.0.1:${p}/`;
  console.log('\n  ==============================================================');
  console.log('   Payper (PAYPER) is running  (PAPER TRADING - virtual money only)');
  if (rt.readOnly) console.log(`   PUBLIC READ-ONLY mode: listening on ${rt.bindHost}:${p}, all changes refused`);
  else console.log('   LOCAL mode: private paper controls on, this computer only');
  console.log(`   ${rt.readOnly ? 'Public address' : 'Open in your browser'}:  ${url}`);
  console.log(`   Token contract address: ${rt.tokenMint ? rt.tokenMint + ' (from ' + rt.tokenSource + ', format checked only)' : 'not set (site shows NOT LAUNCHED YET)'}`);
  console.log('   Market data: DexScreener public API (read-only, no key)');
  console.log('   To stop: close this window or press Ctrl + C');
  console.log('  ==============================================================\n');
  if (p !== port) console.log(`  (port ${port} was busy, using ${p} instead)\n`);
  if (app.restored) log('state', 'restored the paper account from ' + path.join(rt.dataDir, 'paper-state.json'));
  if (process.argv.includes('--open') && !rt.readOnly) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {}
  }
}).catch((e) => { console.error(`Could not start the server: ${e.message}`); dropLock(); process.exit(1); });

let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; console.log('\n  Saving and stopping…'); try { await app.close(); } catch {} process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('SIGBREAK', stop); process.on('SIGHUP', stop); // SIGHUP = console window closed on Windows
