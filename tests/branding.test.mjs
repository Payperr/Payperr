// BRANDING + HONESTY: the Payper name is used everywhere, the PAYPER token defaults to NOT LAUNCHED,
// no contract address is hard-coded, and no shipped text promises earnings or real trading.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PROJECT } from '../server/app.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'fonts']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (/\.(mjs|js|json|html|css|svg|md|bat|sh|yaml|txt)$|^Dockerfile$|^\.dockerignore$/.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}
const files = walk(ROOT);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const read = (r) => fs.readFileSync(path.join(ROOT, r), 'utf8');
const shipped = files.filter((f) => !rel(f).startsWith('tests/'));
// Text a visitor or the owner reads: the site, the preview, the docs and the console/START strings.
const userFacing = shipped.filter((f) => /^(public\/|preview\.html|README\.md|docs\/(DEPLOY|CONTRACT-ADDRESS)\.md|START\.bat|server\/(server|app)\.mjs|paper\.config\.json|render\.yaml|Dockerfile)/.test(rel(f)));

test('the old project name appears nowhere in the package', () => {
  assert.ok(files.length > 30);
  for (const f of files) if (!rel(f).endsWith('branding.test.mjs')) assert.ok(!/swarm\s*desk/i.test(fs.readFileSync(f, 'utf8')), rel(f));
});

test('Payper / PAYPER is the name in the title config, logo, header stamp, console and package', () => {
  assert.deepEqual(PROJECT, { name: 'Payper', ticker: 'PAYPER' });
  const sc = read('public/site.config.js'); assert.match(sc, /name: 'Payper'/); assert.match(sc, /ticker: 'PAYPER'/);
  assert.match(read('public/img/mark.svg'), /<title>Payper<\/title>/);
  assert.match(read('public/css/greenbar.css'), /content:'PAYPER PAPER DESK — PRINTED REPORT'/);
  assert.match(read('public/index.html'), /<span>Payper · paper desk<\/span>/);
  assert.match(read('preview.html'), /<title>Payper \(PAYPER\) · DESIGN PREVIEW/);
  assert.match(read('START.bat'), /title Payper \(PAYPER\) - PAPER TRADING/);
  assert.match(read('START.bat'), /\r\n/, 'CRLF for Windows');
  assert.match(read('server/server.mjs'), /Payper \(PAYPER\) is running/);
  assert.equal(JSON.parse(read('package.json')).name, 'payper-greenbar');
  assert.match(read('README.md'), /^# Payper \(PAYPER\)/);
});

test('PAYPER token defaults to NOT LAUNCHED with no address and no trading links', () => {
  const cfg = JSON.parse(read('paper.config.json')); assert.equal(cfg.contractAddress, '');
  const html = read('public/index.html');
  assert.match(html, /id="token-state">NOT LAUNCHED YET</); assert.match(html, /<span class="token-act" id="token-act" hidden>/);
  assert.match(html, /<a class="btn sm" id="token-pump" target="_blank" rel="noopener noreferrer">/, 'link has no href until the client sets a checked address');
  assert.match(read('preview.html'), /NOT LAUNCHED YET/);
  const app = read('public/js/app.js');
  assert.match(app, /MINT_RE\.test\(tk\.mint/, 'client re-checks the format before showing links');
  assert.match(app, /\$\('token-mint'\)\.textContent = mint/, 'address inserted as text, never HTML');
  assert.ok(!/token-mint'\)\.innerHTML/.test(app));
  // No real-looking pump.fun / explorer / DEX trading link for any token in shipped files (docs use placeholders).
  for (const f of shipped) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!/pump\.fun\/(coin\/)?[1-9A-HJ-NP-Za-km-z]{32,44}/.test(s), rel(f) + ' hard-codes a pump.fun token link');
    assert.ok(!/(jup\.ag\/swap|raydium\.io\/swap|birdeye\.so\/token|solscan\.io\/token)/i.test(s), rel(f) + ' has a trading/explorer link');
  }
  assert.ok(!/TOKEN_MINT\s*=\s*\S/.test(read('Dockerfile')) && !/key: TOKEN_MINT/.test(read('render.yaml')), 'no mint baked into deploy files');
});

test('no shipped text promises earnings, shares, guaranteed returns, wallet sign-in or real trading', () => {
  const banned = /dividend|revenue[ -]?shar|profit[ -]?shar|passive income|guaranteed (return|profit|gain)|staking reward|airdrop|(?<![\d.])\d{2,}x\b|to the moon|risk[- ]free/i;
  const negated = /\b(not|no|never|nothing|isn't|is not|does not|cannot|without|n\/a)\b/i;
  for (const f of userFacing) {
    const s = fs.readFileSync(f, 'utf8').replace(/<[^>]+>/g, ' ');
    assert.ok(!banned.test(s), rel(f) + ': ' + (s.match(banned) || [])[0]);
    // every sentence that mentions earnings, real trading, wallet connection or token benefits must be a negation
    for (const sent of s.split(/(?<=[.!?])\s+|\n+/)) {
      if (/\bearnings?\b|real[- ]trading|connect (your )?wallet|wallet sign-?in|sign in with/i.test(sent)) assert.match(sent, negated, `${rel(f)}: "${sent.trim().slice(0, 140)}"`);
    }
  }
});

test('read-only UI and shared-demo labels are present for the public site', () => {
  const html = read('public/index.html'); const app = read('public/js/app.js'); const sc = read('public/site.config.js');
  assert.match(html, /id="ro-note" role="note" hidden><b>SHARED DEMONSTRATION · READ-ONLY<\/b>/);
  assert.match(html, /not your wallet/);
  assert.match(sc, /'common\.modeShared': '<b>Shared demonstration<\/b>[^']*not your wallet/);
  for (const id of ['ctl-pause', 'ctl-pause2', 'ctl-reset']) assert.match(app, new RegExp(`'${id}'`));
  assert.match(app, /for \(const id of \['ctl-pause', 'ctl-pause2', 'ctl-reset'\]\) \$\(id\)\.hidden = true/);
  assert.match(app, /sv\.disabled = true/);
  assert.match(app, /\$\{RO \? '<span class="dim">read-only<\/span>'/);
  assert.match(app, /async function togglePause\(\) \{ if \(RO\) return;/);
});
