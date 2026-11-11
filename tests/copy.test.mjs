// COPY DISCIPLINE: the website text stays plain, specific and honest. Static checks only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../server/app.mjs';
import CFG from '../public/site.config.js';

const read = (r) => fs.readFileSync(path.join(ROOT, r), 'utf8');
const SITE = ['public/index.html', 'public/site.config.js', 'public/js/app.js', 'public/js/brand.js', 'preview.html', 'server/app.mjs', 'server/strategies.mjs'];
const text = (r) => read(r).replace(/<[^>]+>/g, ' ');

test('no marketing hype, autonomy or performance language in website text', () => {
  const hype = /\b(unlock\w*|elevat\w*|redefin\w*|revolution\w*|game[- ]chang\w*|cutting[- ]edge|next[- ]gen\w*|supercharg\w*|turbocharg\w*|seamless\w*|effortless\w*|world[- ]class|best[- ]in[- ]class|state[- ]of[- ]the[- ]art|empower\w*|harness\w*|leverag\w*|AI[- ]powered|autonomous|self[- ]learning|smart[- ]money|alpha|moonshot|explosive|skyrocket\w*|guarantee\w*|risk[- ]free|passive income|financial freedom)\b|the future of/i;
  for (const f of SITE) { const m = text(f).match(hype); assert.ok(!m, `${f}: "${m?.[0]}"`); }
});

test('title, description and social metadata are present, static and within search-result lengths', () => {
  const html = read('public/index.html');
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  assert.equal(title, `${CFG.brand.name} · ${CFG.brand.tagline}`, 'static title matches what brand.js sets');
  assert.ok(title.length <= 60, 'title ≤ 60 characters');
  const desc = html.match(/<meta name="description" content="([^"]+)">/)[1];
  assert.equal(desc, CFG.brand.description, 'static description matches config');
  assert.ok(desc.length >= 120 && desc.length <= 200, 'description 120–200 characters');
  assert.match(desc, /paper/i); assert.match(desc, /virtual/i);
  assert.match(html, /<meta property="og:title" content="[^"]+">/); assert.match(html, /<meta property="og:description" content="[^"]+">/);
  assert.match(read('preview.html'), /<meta name="description" content="Design preview[^"]*example data/);
});

test('page intros fit the one-line header slot and unavailable pages say so first', () => {
  for (const p of CFG.pages) {
    assert.ok(p.description.length <= 80, `${p.id}: ${p.description.length} chars`);
    if (p.na) assert.match(p.description, /^Unavailable/);
  }
  assert.ok(CFG.brand.tagline.length <= 48);
});

test('short status slots stay within their clamp (two lines in the decision cards)', () => {
  const html = read('public/index.html');
  for (const id of ['cp-s', 'cc-s', 'cq-s', 'cr-s']) { const m = html.match(new RegExp(`id="${id}">([^<]*)<`)); assert.ok(m && m[1].length <= 56, id); }
  for (const [a, b] of CFG.labels.stages) assert.ok(a.length <= 10 && b.length <= 14, a);
});

test('the paper and virtual labels survive the rewrite', () => {
  const html = read('public/index.html'); const app = read('public/js/app.js');
  assert.match(html, /PAPER<small>VIRTUAL USD · NOT REAL MONEY<\/small>/);
  assert.match(html, /simulated fills · virtual USD/);
  assert.match(html, /Every row is a PAPER entry\. Amounts are virtual USD; fills are simulated estimates, not executions\./);
  assert.match(html, /not your wallet/); assert.match(html, /NOT LAUNCHED YET/);
  assert.match(app, /not an executable quote/);
  assert.match(CFG.footer.text, /Real trading is not implemented/); assert.match(CFG.footer.text, /Not investment advice/);
});

test('token copy is limited to this site\'s configuration; unavailable pages do not deny simulation', () => {
  const claims = /no PAYPER token exists|token exists|not from this project|does not come from this project|nothing (here|on this page) is simulated|left blank on purpose|fresh quote/i;
  for (const f of SITE) { const m = text(f).match(claims); assert.ok(!m, `${f}: "${m?.[0]}"`); }
  const html = read('public/index.html');
  assert.match(html, /id="token-body">No token address has been published on this site\. Verify the official address before trading\.</);
  assert.match(html, /title="No token address is configured on this site" id="token-state">NOT LAUNCHED YET</);
  assert.match(read('public/js/app.js'), /No results are shown\. This feature is not available\./);
});
