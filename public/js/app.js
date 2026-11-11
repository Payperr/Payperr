// Payper · Greenbar browser client. Reads ONLY its own server (same origin). No simulator:
// anything the server does not provide is shown as UNAVAILABLE, and an empty desk stays empty.
import { CFG, t, fill, pagesOn } from './config.js';
import { applyBrand } from './brand.js';
import { createAdapter } from './adapter.js';
import { createRing, GLYPH_COUNT } from './ring.js';
applyBrand();
const A = await createAdapter();
let D = await A.load();                 // { MARKET, QUORUMS, AGENTS, ACCOUNT, LEDGER }
let ST = await A.status();              // /api/status
let FIELDS = await A.fields();
// Project metadata: run mode (local / public read-only) and the PAYPER contract address, which is set
// ONLY by the site owner on the server (TOKEN_MINT or contractAddress), never from the browser.
const PROJ = await fetch('/api/project', { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const RO = PROJ ? PROJ.readOnly !== false : false; // public deployment = read-only
const FAMS = (await A.families()).map((f, i) => ({ ...f, lin: f.lineage, gi: i % GLYPH_COUNT, w: 1 }));
const FAM = Object.fromEntries(FAMS.map((f) => [f.id, f]));
// Greenbar: each family is identified by a printed glyph shape (▲ ■ ◆ ▼ ● ✚), never by colour alone.
const gl = (fid) => `<span class="gl g${FAM[fid] ? FAM[fid].gi : 6}" aria-hidden="true"></span>`;

const $ = (id) => document.getElementById(id);
const cssv = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
const tl = (ts) => ts ? new Date(ts).toLocaleTimeString('en-GB', { hour12: false }) : '—';
const td = (ts) => ts ? new Date(ts).toLocaleString('en-CA', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '') : '—';
const usd = (v, d = 2) => v == null || !Number.isFinite(v) ? '—' : (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const susd = (v) => v == null || !Number.isFinite(v) ? '—' : (v > 0 ? '+' : '') + usd(v);
const big = (v) => v == null || !Number.isFinite(v) ? 'n/a' : v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'K' : '$' + v.toFixed(0);
const px = (v) => v == null || !Number.isFinite(v) ? '—' : '$' + (v >= 1 ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : v.toPrecision(4));
const pct = (v, d = 2) => v == null || !Number.isFinite(v) ? '—' : (v > 0 ? '+' : '') + v.toFixed(d) + ' %';
const cl = (v) => v > 0 ? 'up' : v < 0 ? 'dn' : '';
const ago = (ts) => { if (!ts) return '—'; const s = Math.max(0, Math.round((Date.now() - ts) / 1000)); return s < 90 ? s + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h'; };
const sum = (a, f) => a.reduce((x, y) => x + (f(y) || 0), 0);
const FONT = "'Courier Prime','Courier New',monospace";
const median = (a) => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
function toast(m) { const e = $('toast'); e.textContent = m; e.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('show'), 2600); }
const SRC = A.sources;
// Greenbar keyboard support: clickable list rows are role=button + tabindex=0; Enter/Space activates them,
// and re-rendering a list (every few seconds) keeps keyboard focus on the same row.
document.addEventListener('keydown', (e) => { const li = e.target.closest?.('li[role="button"]'); if (!li || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); li.click(); });
function paintList(id, attr, html) { const el = $(id); const a = document.activeElement; const k = a && el.contains(a) ? a.getAttribute(attr) : null; el.innerHTML = html; if (k != null) [...el.querySelectorAll(`[${attr}]`)].find((x) => x.getAttribute(attr) === k)?.focus(); }

// ---------------------------------------------------------------- provenance badges
const SRC_TXT = { live: 'common.srcLive', paper: 'common.srcPaper', unavailable: 'common.srcUnavailable' };
const SRC_TITLE = { live: 'Market data from DexScreener, fetched by this site\'s own server', paper: 'Virtual account data. No real money, no real orders.', unavailable: 'Not part of this version' };
function paintSources() {
  document.querySelectorAll('[data-src]').forEach((el) => { const v = SRC[el.dataset.src] || 'unavailable'; el.className = 'src src-' + v; el.textContent = t(SRC_TXT[v]); el.title = SRC_TITLE[v];
    const pn = el.closest('.pn, .group'); if (!pn) return; pn.classList.toggle('is-unavail', v === 'unavailable');
    let n = pn.querySelector(':scope > .unavail'); if (v === 'unavailable' && !n) { n = document.createElement('div'); n.className = 'unavail'; n.setAttribute('role', 'note'); n.textContent = A.reasons[el.dataset.src] || t('common.unavailable'); (pn.querySelector(':scope > .ph, :scope > .gh') || pn.firstChild)?.after(n); } else if (v !== 'unavailable' && n) n.remove(); });
  const down = ['market', 'quorums', 'agents', 'paper', 'stream'].filter((k) => SRC[k] === 'unavailable');
  const mx = $('mixed'); mx.hidden = !down.length; mx.textContent = fill(t('common.mixed'), { n: down.length }); mx.title = down.join(', ');
  $('mode-card').className = 'mode-card ' + (down.length ? 'is-mixed' : 'is-live'); $('mode-card').innerHTML = t(RO ? 'common.modeShared' : 'common.modeLive');
}

// ---------------------------------------------------------------- router
const PAGES = pagesOn.map((p) => p.id); const shown = new Set();
function go(p, push = true) {
  let q = null; if (p.startsWith('q/')) { q = decodeURIComponent(p.slice(2)); p = 'proof'; }
  if (!PAGES.includes(p)) p = PAGES[0];
  document.querySelectorAll('.pg').forEach((s) => s.classList.toggle('is-on', s.id === 'pg-' + p));
  document.querySelectorAll('[data-nav] [data-go]').forEach((b) => { const on = b.dataset.go === p; b.classList.toggle('is-on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  const meta = pagesOn.find((x) => x.id === p) || {}; $('pg-title').textContent = meta.label || p; $('pg-sub').textContent = meta.description ? fill(meta.description) : CFG.brand.tagline;
  const no = PAGES.indexOf(p) + 1; $('run-pg').textContent = `Report ${String(no).padStart(2, '0')} · ${meta.label || p}${meta.na ? ' · unavailable' : ''}`; $('run-no').textContent = `Page ${String(no).padStart(3, '0')}`; $('run-date').textContent = `Run ${td(Date.now()).slice(0, 10)}`;
  document.dispatchEvent(new CustomEvent('page:change', { detail: p })); window.scrollTo?.({ top: 0 });
  if (push) history.pushState(null, '', (p === PAGES[0] ? '/' : '/' + p) + (location.search || ''));
  shown.add(p); RENDER[p]?.();
  if (q) openQuorum(q);
}
const current = () => PAGES.find((p) => $('pg-' + p)?.classList.contains('is-on'));
document.addEventListener('click', (e) => { const a = e.target.closest('[data-go]'); if (!a) return; e.preventDefault(); go(a.dataset.go); });
addEventListener('popstate', () => go(location.pathname.slice(1) || PAGES[0], false));
setInterval(() => { $('clock').innerHTML = `${tl(Date.now())} <em>${esc(TZ)}</em>`; }, 1000);

// ---------------------------------------------------------------- canvases
const series = {}; const pushS = (k, v, n = 60) => { if (!Number.isFinite(v)) return; (series[k] ||= []).push(v); if (series[k].length > n) series[k].shift(); };
function canvas(id) { const c = $(id); if (!c) return null; const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return null; c.width = w * 2; c.height = h * 2; const x = c.getContext('2d'); x.scale(2, 2); return { x, w, h }; }
function spark(id, k, color = cssv('--acc')) { const g = canvas(id); if (!g) return; const d = series[k] || []; if (d.length < 2) return; const mn = Math.min(...d), mx = Math.max(...d); g.x.beginPath(); d.forEach((v, i) => { const X = (i / (d.length - 1)) * g.w, Y = g.h - 2 - ((v - mn) / (mx - mn || 1)) * (g.h - 4); i ? g.x.lineTo(X, Y) : g.x.moveTo(X, Y); }); g.x.strokeStyle = color; g.x.lineWidth = 1.2; g.x.stroke(); }
// Greenbar gauge: a printed 20-cell bar; filled cells = used share of the limit, cells past 80 % are hatched.
function gauge(id, f, color) { const g = canvas(id); if (!g) return; const n = 20, gap = 2, cw = (g.w - gap * (n - 1)) / n, on = Math.round(Math.max(0, Math.min(1, f || 0)) * n); for (let i = 0; i < n; i++) { const X = i * (cw + gap); g.x.lineWidth = 1; g.x.strokeStyle = cssv('--tx'); g.x.strokeRect(X + 0.5, 0.5, cw - 1, g.h - 1); if (i >= on) continue; g.x.fillStyle = color; if (i >= n * 0.8) { g.x.save(); g.x.beginPath(); g.x.rect(X, 0, cw, g.h); g.x.clip(); g.x.lineWidth = 1.5; g.x.strokeStyle = color; for (let d = -g.h; d < cw; d += 3) { g.x.beginPath(); g.x.moveTo(X + d, g.h); g.x.lineTo(X + d + g.h, 0); g.x.stroke(); } g.x.restore(); } else g.x.fillRect(X, 0, cw, g.h); } }

// ---------------------------------------------------------------- status, feed, banner, controls
function applyStatus(s) {
  if (!s) { const b = $('banner'); b.hidden = false; b.className = 'banner'; b.textContent = RO ? 'The Payper server is not responding. Figures on this page may be out of date; the page reconnects on its own.' : 'The local server is not responding. Check that the Payper START window is still open. Figures on this page may be out of date.'; $('feed').className = 'feedpill down'; $('feed').textContent = 'SERVER OFFLINE'; return; }
  ST = s; const f = s.feed; const fp = $('feed'); fp.className = 'feedpill ' + f.state;
  fp.textContent = `FEED ${f.state.toUpperCase()} · ${f.validQuotes}/${f.tracked}`; fp.title = `${f.provider}\nlast good poll: ${td(f.lastOkAt)}\noldest quote: ${f.oldestQuoteSec ?? '—'} s (stale after ${f.maxQuoteAgeSeconds} s)${f.lastError ? '\nlast error: ' + f.lastError.message : ''}`;
  const b = $('banner'); let msg = '', cls = 'banner warn';
  if (f.state === 'down') { msg = `Market feed unavailable (${f.lastError?.message || 'no successful poll yet'}). No paper buys can be made until it returns. The server retries automatically, at increasing intervals.`; cls = 'banner'; }
  else if (f.state === 'stale') msg = `Quotes are stale: last good poll ${ago(f.lastOkAt)} ago. New paper buys are halted. Open positions are held at their last known price, marked stale, and exits wait for a newer quote.`;
  else if (s.desk.dayPaused) msg = `Daily loss limit reached for ${s.desk.dayKey} (${s.desk.dayTimeZone}). New paper buys resume at midnight, ${s.desk.dayTimeZone} time.`;
  else if (s.desk.paused) msg = 'Desk paused by you. No new paper buys; exits on open positions continue.';
  b.hidden = !msg; b.className = cls; b.textContent = msg;
  for (const id of ['ctl-pause', 'ctl-pause2']) { const e = $(id); e.textContent = s.desk.paused ? 'Resume buys' : id === 'ctl-pause' ? 'Pause buys' : 'Pause new buys'; e.classList.toggle('on', s.desk.paused); }
  $('ctl-state').textContent = RO ? (s.desk.paused ? 'paused · read-only public site' : 'running · public site is read-only') : s.desk.paused ? 'paused by you' : s.desk.dayPaused ? 'daily-loss pause' : 'running';
}
async function togglePause() { if (RO) return; const r = await A.control(ST?.desk?.paused ? 'resume' : 'pause'); if (!r.ok) return toast(r.errors[0]); applyStatus(await A.status()); toast(r.paused ? 'Paused. No new paper buys.' : 'Resumed. New paper buys are allowed.'); }
$('ctl-pause').onclick = togglePause; $('ctl-pause2').onclick = togglePause;
$('ctl-reset').onclick = () => { if (RO) return; $('reset-in').value = ''; $('reset-dlg').showModal(); $('reset-in').focus(); };
$('reset-dlg').addEventListener('close', async () => { if ($('reset-dlg').returnValue !== 'ok') return; const v = $('reset-in').value.trim(); if (v !== 'RESET') return toast('Not reset. Type RESET to confirm.'); const r = await A.control('reset', { confirm: v }); toast(r.ok ? 'Paper account reset to starting cash.' : r.errors[0]); await refresh(true); });

// ---------------------------------------------------------------- DESK
const S = { checks: 0, votes: new Map(), mx: [], sel: [], logF: '' };
const STAGES = CFG.labels.stages.map(([a, b]) => [fill(a), fill(b)]);
$('pipe').innerHTML = STAGES.map(([n, s], i) => `<li class="pc" id="pc${i}"><div class="pt"><span class="no">0${i + 1}</span>${n}<b class="chip" id="pc${i}-c">IDLE</b></div><div class="pv"><b id="pc${i}-v">0</b><span>${s}</span><canvas id="pc${i}-k" aria-hidden="true"></canvas></div></li>`).join('');
const KP = Object.entries(CFG.labels.kpis).map(([k, v]) => [k, fill(v)]);
$('kpis').innerHTML = KP.map(([k, l]) => `<div class="kp"><div class="kl">${l} ${k === 'pnl' || k === 'eq' || k === 'cash' ? '<span class="tag paper">PAPER</span>' : ''}</div><b id="k-${k}">—</b><canvas id="k-${k}-k"></canvas></div>`).join('');
const MK = [['trk', 'Tracked', 'Tokens with a valid quote / tokens requested'], ['h1', 'Median 1h', 'Median 1-hour price change across tracked tokens (priceChange.h1)'], ['m5', 'Median 5m', 'Median 5-minute price change (priceChange.m5)'], ['buy', 'Buy share 5m', 'Median buys ÷ (buys + sells), last 5 minutes'], ['vol', 'Volume 1h', 'Sum of 1-hour volume across tracked tokens, USD'], ['age', 'Oldest quote', 'Age of the oldest quote; observed time = HTTP Date − Age']];
$('mkt').innerHTML = MK.map(([k, l, tt]) => `<div class="mk" title="${tt}"><span class="kl">${l}</span><b id="mk-${k}">—</b><canvas id="mk-${k}-k"></canvas></div>`).join('') + `<div class="mk" title="Where these figures come from"><span class="kl">Source</span><div class="mk-w" id="mk-src"></div></div>`;

const totAgents = () => D.AGENTS.filter((a) => a.enabled).length;
const ringFams = FAMS.map((f) => ({ ...f, agents: Math.max(0.4, D.AGENTS.filter((a) => a.fam === f.id && a.enabled).length) }));
const ring = createRing($('ring'), ringFams, {
  onHover(f, x, y) { const e = $('dtip'); if (!f) { e.hidden = true; return; } e.hidden = false; e.style.left = x + 14 + 'px'; e.style.top = y + 10 + 'px'; e.innerHTML = `${gl(f.id)}<b>${esc(f.name)}</b><br>${esc(f.about)}<br>${D.AGENTS.filter((a) => a.fam === f.id && a.enabled).length} agents · reads ${esc(f.lin)}<br><span class="dim">select to filter</span>`; },
  onPick: (a) => setSel(a),
});
function setSel(a) { S.sel = a; ring.select(a); $('dl-x').hidden = !a.length; $('dl-sel').textContent = a.length ? a.map((x) => FAM[x]?.name).join(' + ') + ' · filtered view' : ''; renderFams(); }
$('dl-x').onclick = () => ring.clear();
const famToggle = (li) => { const id = li.dataset.f; setSel(S.sel.includes(id) ? S.sel.filter((x) => x !== id) : [...S.sel, id]); $('fam-list').querySelector(`li[data-f="${id}"]`)?.focus(); };
$('fam-list').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) famToggle(li); });
function renderFams() {
  $('fam-n').textContent = `${totAgents()} agents · ${FAMS.length} families`; $('st-agents').textContent = totAgents(); $('st-lins').textContent = FAMS.length;
  const q = ST?.limits?.quorum; $('st-rule').innerHTML = q ? `quorum: <b>${q.minVotes}</b> votes, <b>${q.minFamilies}</b>+ families, one recent quote` : '';
  paintList('fam-list', 'data-f', FAMS.map((f) => { const ag = D.AGENTS.filter((a) => a.fam === f.id); const v = sum(ag, (a) => a.votes), c = sum(ag, (a) => a.checks);
    const on = S.sel.includes(f.id); return `<li data-f="${f.id}" class="${on ? 'is-on' : ''}" tabindex="0" role="button" aria-pressed="${on}" title="${esc(f.about)}">${gl(f.id)}<span>${esc(f.name)}</span><span class="n">${ag.filter((a) => a.enabled).length}</span><span class="n">${v.toLocaleString()}</span><span class="n">${c ? ((100 * v) / c).toFixed(1) + '%' : '—'}</span></li>`; }).join(''));
}
const bars = (id, n, ok, bad = 0) => { $(id).innerHTML = Array.from({ length: Math.min(n, 12) }, (_, i) => `<i class="${i < ok ? 'ok' : i < ok + bad ? 'no' : ''}"></i>`).join(''); };
const hot = (id) => { const e = $(id); e.classList.remove('hot'); void e.offsetWidth; e.classList.add('hot'); };
const flash = (i) => { const e = $('pc' + i); e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); };
const LOG = [];
const logRow = (r) => `<li class="${r.kind === 'q' || r.kind === 'trade' ? 'q' : ''}"><span class="dim">${tl(r.at)}</span><span>${r.fam ? gl(r.fam) : ''}${esc(r.who)}</span><span>${esc(r.sym)}</span><span class="${r.bad ? 'f' : ''}">${esc(r.msg)}</span></li>`;
function log(kind, row, render = true) { LOG.unshift({ kind, ...row }); if (LOG.length > 300) LOG.pop(); if (render) renderLog(); }
function renderLog() { const rows = LOG.filter((r) => (!S.logF || r.kind === S.logF) && (!S.sel.length || !r.fam || S.sel.includes(r.fam))).slice(0, 120); $('log').innerHTML = rows.map(logRow).join(''); $('log-empty').hidden = rows.length > 0; }
$('fd-seg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.logF = b.dataset.f; [...$('fd-seg').children].forEach((x) => x.classList.toggle('is-on', x === b)); renderLog(); };
function seedLog() {
  LOG.length = 0;
  for (const q of D.QUORUMS.slice(0, 60)) LOG.push({ kind: 'q', at: q.at, fam: q.fams[0], who: `QUORUM ${q.n}/${q.need}`, sym: q.sym, msg: `${q.fams.map((f) => FAM[f]?.name || f).join(' + ')} · ${q.state === 'buy' ? 'paper order' : 'denied: ' + q.why}`, bad: q.state !== 'buy' });
  for (const l of D.LEDGER.filter((r) => r.kind === 'buy' || r.kind === 'sell').slice(0, 60)) LOG.push({ kind: 'trade', at: l.at, fam: null, who: 'PAPER ' + l.kind.toUpperCase(), sym: l.coin, msg: l.kind === 'sell' ? `${usd(l.usd)} · P&L ${susd(l.pnl)} · simulated fill` : `${usd(-l.usd)} · simulated fill` });
  LOG.sort((a, b) => b.at - a.at); renderLog();
}
function onEvent(k, e) {
  if (k === 'check') { S.checks++; if (S.sel.length && !S.sel.includes(e.fam)) return; const ok = e.n - e.fail, bad = e.fail - e.missing;
    S.mx.unshift(Array.from({ length: 8 }, (_, i) => i < Math.min(8, ok) ? 'ok' : i < Math.min(8, ok + bad) ? 'f' : i < Math.min(8, e.n) ? 'm' : 'e')); S.mx.length = Math.min(S.mx.length, 12);
    $('cc-v').textContent = `${ok}/${e.n} ${e.ok ? '✓' : '✗'}`; $('cc-s').textContent = `${e.agent} on ${e.sym}: ${e.ok ? 'all conditions held' : `${bad} failed${e.missing ? ', ' + e.missing + ' missing data' : ''}`}`; bars('cc-b', e.n, ok, bad); }
  if (k === 'prop') { if (S.sel.length && !S.sel.includes(e.fam)) return; ring.pulse(e.fam); flash(1); $('cp-sym').textContent = e.sym; $('cp-s').textContent = `${e.agent} “${e.note}” · ${e.claims} conditions held`; bars('cp-b', e.claims, e.claims); hot('co-prop');
    log('prop', { at: e.at, fam: e.fam, who: e.agent, sym: e.sym, msg: `votes · ${e.note} · ${e.claims} conditions` }); }
  if (k === 'tick') { S.votes.set(e.mint, e); const c = (series['px:' + e.mint] ||= []); if (Number.isFinite(e.price)) { c.push(e.price); if (c.length > 120) c.shift(); } }
  if (k === 'quorum') { D.QUORUMS.unshift(e); ring.pulse(e.fams[0], true); flash(2); const ok = e.state === 'buy';
    $('cq-v').textContent = `${e.n}/${e.need} · ${e.fams.length} fam`; $('cq-s').textContent = `${e.sym} · ${e.fams.map((f) => FAM[f]?.name || f).join(' + ')}`; bars('cq-b', e.need, Math.min(e.need, e.n)); hot('co-q');
    const passed = e.risk.filter((c) => c.ok).length; $('cr-v').textContent = ok ? 'PASS' : 'DENY'; $('cr-s').textContent = ok ? `${passed}/${e.risk.length} checks passed · paper order placed` : e.why; bars('cr-b', e.risk.length, passed, e.risk.length - passed); hot('co-risk'); flash(3);
    setHero(e); log('q', { at: e.at, fam: e.fams[0], who: `QUORUM ${e.n}/${e.need}`, sym: e.sym, msg: ok ? 'risk passed · paper order placed' : 'denied: ' + e.why, bad: !ok });
    if (shown.has('proof')) renderProofList(); }
  if (k === 'trade') { flash(e.kind === 'BUY' ? 4 : 5); const tr = $('trade'); $('tr-k').textContent = 'PAPER ' + e.kind; $('tr-s').textContent = `${e.sym} · ${usd(e.usd)} · simulated fill${e.pnl != null ? ' · P&L ' + susd(e.pnl) : ''}`; tr.classList.add('show'); clearTimeout(tr.h); tr.h = setTimeout(() => tr.classList.remove('show'), 3200);
    log('trade', { at: e.at, fam: null, who: 'PAPER ' + e.kind, sym: e.sym, msg: `${usd(e.usd)}${e.pnl != null ? ' · P&L ' + susd(e.pnl) : ''} · ${e.reason}` }); refresh(); }
  if (k === 'status') { applyStatus(e); deskTick(); }
  if (k === 'ledger' && shown.has('ledger')) { D.LEDGER.unshift(e); if (current() === 'ledger') renderLedger(); }
}
function setHero(q) { if (!q) return; $('hero-sym').textContent = q.sym; $('hero-s').textContent = `quorum ${q.n}/${q.need} at ${px(q.priceUsd)} · ${q.state === 'buy' ? (q.order?.status === 'filled' ? 'paper position opened' : q.order?.status === 'cancelled' ? 'order cancelled: ' + (q.order.why || '') : 'paper order pending') : 'denied: ' + q.why}`; }
function deskTick() {
  if (!ST) return; const a = ST.account, f = ST.feed;
  const checks = Math.max(sum(D.AGENTS, (x) => x.checks), S.checks);
  const vals = [`${f.validQuotes}/${f.tracked}`, checks.toLocaleString(), D.QUORUMS.length, D.QUORUMS.filter((q) => q.state === 'buy').length, a.openPositions, D.LEDGER.filter((l) => l.kind === 'sell').length];
  vals.forEach((v, i) => { $(`pc${i}-v`).textContent = v; const c = $(`pc${i}-c`); const st = i === 0 ? (f.state === 'live' ? 'RUN' : f.state.toUpperCase()) : i === 1 ? (f.state === 'live' ? 'RUN' : 'WAIT') : i === 4 && a.openPositions ? 'RUN' : i === 3 && (ST.desk.paused || ST.desk.dayPaused) ? 'PAUSED' : 'IDLE'; c.textContent = st; c.className = 'chip ' + (st === 'RUN' ? 'run' : ''); });
  [f.validQuotes, checks, D.QUORUMS.length, D.QUORUMS.filter((q) => q.state === 'buy').length, a.openPositions, D.LEDGER.filter((l) => l.kind === 'sell').length].forEach((v, i) => { pushS('p' + i, v); spark(`pc${i}-k`, 'p' + i); });
  const kv = { pnl: [susd(a.pnlUsd), a.pnlUsd], eq: [usd(a.equity), a.equity], cash: [usd(a.cash), a.cash], open: [`${a.openPositions}${a.pendingOrders ? ' +' + a.pendingOrders + ' pend.' : ''}`, a.openPositions], age: [f.oldestQuoteSec == null ? '—' : f.oldestQuoteSec + ' s', f.oldestQuoteSec], dec: [checks.toLocaleString(), checks] };
  for (const [k] of KP) { const e = $('k-' + k); if (!e || !kv[k]) continue; e.textContent = kv[k][0]; e.className = k === 'pnl' ? cl(a.pnlUsd) : k === 'age' && f.oldestQuoteSec > f.maxQuoteAgeSeconds ? 'dn' : ''; pushS('k' + k, kv[k][1]); spark(`k-${k}-k`, 'k' + k, k === 'pnl' && a.pnlUsd < 0 ? cssv('--dn') : cssv('--acc')); }
  if (a.equityStaleMarks) $('k-eq').innerHTML += ` <span class="stale" title="${a.equityStaleMarks} position(s) valued at their last known price">stale</span>`;
  // evidence matrix
  $('mx').style.gridTemplateColumns = 'repeat(8,1fr)'; $('mx').innerHTML = S.mx.flat().map((c) => `<i class="${c === 'e' ? '' : c}"></i>`).join('');
  renderCoins(); renderPositionsMini(); renderMarket(); drawEquity(); renderFams();
  const L = ST.limits; const exp = a.exposureUsd; $('g-exp-v').textContent = `${usd(exp, 0)} / ${usd(L.maxExposureUsd, 0)}`; gauge('g-exp', exp / L.maxExposureUsd, cssv('--acc2'));
  $('g-buy-v').textContent = `${a.buysLastHour} / ${L.maxBuysPerHour}`; gauge('g-buy', a.buysLastHour / L.maxBuysPerHour, cssv('--acc2'));
  const loss = Math.max(0, ST.desk.dayLossUsd); $('g-day-k').textContent = `Today's loss (${ST.desk.dayTimeZone})`; $('g-day-v').textContent = `${usd(loss, 0)} / ${usd(L.dailyLossLimitUsd, 0)}`; gauge('g-day', loss / L.dailyLossLimitUsd, cssv('--dn'));
}
function renderCoins() {
  const rows = D.MARKET.map((m) => ({ ...m, v: S.votes.get(m.mint) })).sort((a, b) => (b.v?.votes || 0) - (a.v?.votes || 0) || (b.metrics.liquidityUsd || 0) - (a.metrics.liquidityUsd || 0)).slice(0, 12);
  const need = ST?.limits?.quorum?.minVotes || 3; $('play-n').textContent = `${D.MARKET.length} tracked · quorum ${need}`; $('play-empty').hidden = rows.length > 0;
  paintList('play-list', 'data-m', rows.map((c) => { const v = c.v?.votes || 0; return `<li data-m="${esc(c.mint)}" tabindex="0" role="button" aria-label="${esc(c.sym)}: ${v} of ${need} votes, open price chart" title="${esc(c.name)} · ${c.watch} · quote ${c.ageSec}s old"><span>${esc(c.sym)}${c.fresh ? '' : ' <span class="stale">stale</span>'}</span><span class="bar"><i style="width:${Math.min(100, (v * 100) / need)}%"></i></span><span class="n">${v}/${need}</span><span class="n">${px(c.priceUsd)}</span></li>`; }).join(''));
}
$('play-list').onclick = (e) => { const li = e.target.closest('li'); if (!li) return; openCoin(li.dataset.m); };
function openCoin(mint) {
  const c = D.MARKET.find((m) => m.mint === mint); if (!c) return; const v = S.votes.get(mint); const m = c.metrics;
  $('qc').hidden = false; $('qc-sym').textContent = c.sym; $('qc-q').textContent = `${v?.votes || 0}/${ST?.limits?.quorum?.minVotes ?? '?'} votes${v?.fams?.length ? ' · ' + v.fams.map((f) => FAM[f]?.name || f).join(', ') : ''}`; $('qc-mc').textContent = px(c.priceUsd);
  $('qc-meta').innerHTML = `liquidity ${big(m.liquidityUsd)} · market cap ${m.marketCap == null ? 'not reported' : big(m.marketCap)} · FDV ${big(m.fdv)}<br>1h ${pct(m.chgH1)} · 5m ${pct(m.chgM5)} · buy share 5m ${m.buyShareM5 == null ? '—' : (m.buyShareM5 * 100).toFixed(0) + ' %'} · pair age ${m.pairAgeMin == null ? '—' : m.pairAgeMin > 2880 ? (m.pairAgeMin / 1440).toFixed(0) + ' d' : m.pairAgeMin.toFixed(0) + ' min'}<br>observed ${tl(c.observedAt)} (${c.ageSec} s ago) · ${esc(c.source)}${c.problems.length ? '<br><span class="stale">' + esc(c.problems.join('; ')) + '</span>' : ''}${c.url ? ` · <a class="tx" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">DexScreener ↗</a>` : ''}`;
  const g = canvas('qc-c'); if (!g) return; const d = series['px:' + mint] || []; if (d.length < 2) { g.x.fillStyle = cssv('--mu'); g.x.font = '12px ' + FONT; g.x.fillText('price history accumulates while this page is open', 8, g.h / 2); return; }
  const mn = Math.min(...d), mx = Math.max(...d); g.x.beginPath(); d.forEach((v, i) => { const X = (i / (d.length - 1)) * g.w, Y = g.h - 8 - ((v - mn) / (mx - mn || 1)) * (g.h - 16); i ? g.x.lineTo(X, Y) : g.x.moveTo(X, Y); }); g.x.strokeStyle = cssv('--acc'); g.x.lineWidth = 1.5; g.x.stroke();
}
$('qc-close').onclick = () => { $('qc').hidden = true; };
function renderPositionsMini() {
  const P = D.ACCOUNT?.positions || []; $('op-n').textContent = P.length ? `${P.length} open` : ''; $('op-empty').hidden = P.length > 0;
  $('op-list').innerHTML = P.map((p) => `<li title="entry ${px(p.entryPrice)} (simulated) · mark ${px(p.mark)}"><span>${esc(p.sym)}</span><span class="bar" aria-hidden="true"><i style="width:${Math.min(100, Math.max(4, 50 + (p.gainPct || 0) * 2))}%;${(p.gainPct || 0) < 0 ? 'background:repeating-linear-gradient(45deg,var(--dn) 0 1.5px,transparent 1.5px 4px)' : ''}"></i></span><span class="n ${cl(p.gainPct)}">${pct(p.gainPct, 1)}</span><span class="${p.markStale ? 'stale' : 'dim'}">${p.pendingSell ? 'selling' : p.markStale ? 'stale' : 'holding'}</span></li>`).join('');
}
function renderMarket() {
  const M = D.MARKET.filter((m) => m.fresh); const f = ST?.feed;
  const v = { trk: [`${f?.validQuotes ?? 0}/${f?.tracked ?? 0}`, f?.validQuotes], h1: [pct(median(M.map((m) => m.metrics.chgH1))), median(M.map((m) => m.metrics.chgH1))], m5: [pct(median(M.map((m) => m.metrics.chgM5))), median(M.map((m) => m.metrics.chgM5))],
    buy: [(() => { const x = median(M.map((m) => m.metrics.buyShareM5)); return x == null ? '—' : (x * 100).toFixed(0) + ' %'; })(), median(M.map((m) => m.metrics.buyShareM5))], vol: [big(sum(M, (m) => m.metrics.volH1)), sum(M, (m) => m.metrics.volH1)], age: [f?.oldestQuoteSec == null ? '—' : f.oldestQuoteSec + ' s', f?.oldestQuoteSec] };
  for (const k in v) { const e = $('mk-' + k); e.textContent = v[k][0]; e.className = k === 'h1' || k === 'm5' ? cl(v[k][1]) : k === 'age' && v[k][1] > (f?.maxQuoteAgeSeconds || 90) ? 'dn' : ''; pushS('mk' + k, v[k][1]); spark(`mk-${k}-k`, 'mk' + k); }
  $('mk-src').innerHTML = `<span>DexScreener</span><span>${f?.watchlist ?? 0} watch</span><span>${f?.discovered ?? 0} discovered</span>`;
}
function drawEquity() {
  const g = canvas('pnl'); if (!g) return; const d = (D.ACCOUNT?.equity || []).slice().reverse(); const base = ST?.account?.startingCash || 0;
  const vals = d.map((p) => p.eq); const mn = Math.min(base, ...vals), mx = Math.max(base + 1, ...vals); const Y = (v) => g.h - 10 - ((v - mn) / (mx - mn || 1)) * (g.h - 20);
  g.x.strokeStyle = cssv('--ln2'); g.x.setLineDash([3, 3]); g.x.beginPath(); g.x.moveTo(0, Y(base)); g.x.lineTo(g.w, Y(base)); g.x.stroke(); g.x.setLineDash([]); g.x.fillStyle = cssv('--mu'); g.x.font = '11px ' + FONT; g.x.fillText('start ' + usd(base, 0) + ' (virtual)', 6, Y(base) - 3);
  if (d.length < 2) return; g.x.beginPath(); d.forEach((p, i) => { const X = (i / (d.length - 1)) * g.w; i ? g.x.lineTo(X, Y(p.eq)) : g.x.moveTo(X, Y(p.eq)); }); g.x.strokeStyle = (ST?.account?.pnlUsd || 0) < 0 ? cssv('--dn') : cssv('--up'); g.x.lineWidth = 1.5; g.x.stroke();
}
function renderTrades() {
  const rows = D.LEDGER.filter((l) => l.kind === 'buy' || l.kind === 'sell').slice(0, 40); $('trl-empty').hidden = rows.length > 0;
  $('trl').innerHTML = rows.map((l) => `<li title="${esc(l.note)}"><span class="dim">${tl(l.at).slice(0, 5)}</span><span class="${l.kind === 'buy' ? 'warn' : 'acc'}">${l.kind.toUpperCase()}</span><span>${esc(l.coin)}</span><span class="n">${usd(Math.abs(l.usd))}</span><span class="n ${cl(l.pnl)}">${l.pnl != null ? susd(l.pnl) : ''}</span><span><span class="tag paper" title="simulated paper fill: no transaction exists">sim.</span></span></li>`).join('');
}

// ---------------------------------------------------------------- PROOF
let pfF = '', pfSel = null;
function renderProofList() {
  const rows = D.QUORUMS.filter((q) => !pfF || q.state === pfF).slice(0, 300); const ordered = D.QUORUMS.filter((q) => q.state === 'buy');
  const pnl = sum(ordered, (q) => q.pnl);
  $('pf-tot').innerHTML = `<div><span class="kl">Quorums</span><b>${D.QUORUMS.length}</b></div><div><span class="kl">Ordered · denied</span><b>${ordered.length} · ${D.QUORUMS.length - ordered.length}</b></div><div><span class="kl">Realized <span class="tag paper">PAPER</span></span><b class="${cl(pnl)}">${susd(pnl)}</b></div>`;
  $('pf-empty').hidden = D.QUORUMS.length > 0;
  paintList('pf-list', 'data-q', rows.map((q) => `<li data-q="${esc(q.id)}" class="${q.id === pfSel ? 'is-on' : ''}" tabindex="0" role="button" aria-pressed="${q.id === pfSel}"><span class="dim">${tl(q.at)}</span><span>${esc(q.sym)}<small>${q.n} votes · ${q.fams.length} families · quote ${q.quoteAgeSec}s old</small></span><span class="k ${q.state === 'buy' ? 'acc' : 'dn'}">${q.state === 'buy' ? (q.order?.status || 'order').toUpperCase() : 'DENIED'}</span></li>`).join(''));
}
$('pf-seg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; pfF = b.dataset.f; [...$('pf-seg').children].forEach((x) => x.classList.toggle('is-on', x === b)); renderProofList(); };
$('pf-list').onclick = (e) => { const li = e.target.closest('[data-q]'); if (!li) return; openQuorum(li.dataset.q); history.replaceState(null, '', '/q/' + encodeURIComponent(li.dataset.q)); };
async function openQuorum(id) {
  const q = D.QUORUMS.find((x) => x.id === id) || await A.fetchQuorum(id); if (!q) { $('pf-title').textContent = 'Quorum not found'; $('pf-body').innerHTML = '<div class="empty">This quorum is no longer in the history; the account may have been reset.</div>'; return; }
  pfSel = q.id; renderProofList();
  $('pf-title').innerHTML = `Quorum ${esc(q.sym)} ${q.url ? `<a class="tx" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">DexScreener pair ↗</a>` : ''}`; $('pf-when').textContent = td(q.at) + ' ' + TZ;
  const o = q.order, f = o?.fill;
  const orderTxt = q.state !== 'buy' ? '—' : !o ? 'none' : o.status === 'filled' ? `filled ${px(f.fillPrice)} (sim.)` : o.status === 'cancelled' ? 'cancelled · ' + esc(o.why || '') : 'pending next quote';
  $('pf-body').innerHTML = `<div class="tiles5">
    <div><span class="kl">Votes</span><b>${q.n} (need ${q.need}) · ${q.fams.length} families (need ${q.needFams})</b></div>
    <div><span class="kl">Price at decision</span><b>${px(q.priceUsd)}</b></div>
    <div><span class="kl">Quote age at decision</span><b class="${q.quoteAgeSec > (ST?.feed?.maxQuoteAgeSeconds || 90) ? 'dn' : ''}">${q.quoteAgeSec} s</b></div>
    <div><span class="kl">Liquidity · market cap</span><b>${big(q.liquidity)} · ${q.mc == null ? 'not reported' : big(q.mc)}</b></div>
    <div><span class="kl">Risk desk</span><b class="${q.state === 'buy' ? 'up' : 'dn'}">${q.state === 'buy' ? `pass · ${q.risk.length}/${q.risk.length}` : 'deny'}</b></div>
    <div><span class="kl">Paper order <span class="tag paper">PAPER</span></span><b>${orderTxt}</b></div>
    ${f ? `<div><span class="kl">Simulated fill costs</span><b>fees ${usd(f.feeUsd)} · slippage ${f.slipBps} bps</b></div>` : ''}
    <div><span class="kl">Realized P&amp;L <span class="tag paper">PAPER</span></span><b class="${cl(q.pnl)}">${q.pnl == null ? '—' : susd(q.pnl)}</b></div></div>
  <div class="why">${q.fams.length} families (${q.fams.map((x) => esc(FAM[x]?.name || x)).join(', ')}) voted on one DexScreener observation of ${esc(q.sym)}${q.state === 'buy' ? '. Every risk check passed, and a paper order was placed to fill at the next newer quote, at the worse of the two prices.' : `. The risk desk declined it: ${esc(q.why)}.`}</div>
  <div class="cards">${q.fams.map((fid) => `<div class="card"><div class="ch">${gl(fid)}<b>${esc(FAM[fid]?.name || fid)}</b><span class="sub">${(q.voters[fid] || []).length} agent(s) voted</span></div>${(q.checks[fid] || []).map((k) => `<div class="cl"><span class="${k.ok ? 'up' : 'dn'}" aria-label="${k.ok ? 'held' : 'failed'}">${k.ok ? '✓' : '✗'}</span><span title="${esc(k.agent)}">${esc(k.c)}</span><span>${esc(k.v)}</span><span class="dim" title="${esc(k.src)}">${esc(k.src)}</span></div>`).join('')}<div class="vids">${esc((q.voters[fid] || []).join(' · '))}</div></div>`).join('')}</div>
  <div class="card"><div class="ch"><b>Risk checks</b><span class="sub">all evaluated, in order</span></div><table class="risk-t">${q.risk.map((c) => `<tr><td class="${c.ok ? 'up' : 'dn'}">${c.ok ? '✓' : '✗'}</td><td>${esc(c.label)}</td><td>${esc(c.v)}</td><td class="dim">${esc(c.limit)}</td></tr>`).join('')}</table></div>
  <p class="note">Data: ${esc(q.source)} · observed ${td(q.observedAt)} (HTTP Date − Age) · fetched ${td(q.fetchedAt)}. The price is DexScreener's reference price, not an executable quote. A paper order has no transaction.</p>`;
}

// ---------------------------------------------------------------- AGENTS
const TPL = { Momentum: [['chgH1', '>=', 2], ['chgM5', '>=', 0.3]], 'Volume pace': [['volAccel', '>=', 1.5], ['volM5', '>=', 5000]], 'Buyers lead': [['buyShareM5', '>=', 0.6], ['txnsM5', '>=', 30]], 'Dip rebound': [['chgH24', '<=', -8], ['chgH1', '>=', 1]], 'Deep pool': [['liquidityUsd', '>=', 250000], ['chgH1', '>', 0]] };
let COND = [];
const OPS = () => FIELDS?.ops || ['>=', '<=', '>', '<'];
function blConds() {
  const F = FIELDS?.fields || {}; $('bl-conds').innerHTML = COND.map((c, i) => `<div class="cond"><select data-i="${i}" data-k="field" aria-label="Metric">${Object.entries(F).map(([k, f]) => `<option value="${k}" ${k === c.field ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select><select data-i="${i}" data-k="op" aria-label="Operator">${OPS().map((o) => `<option ${o === c.op ? 'selected' : ''}>${o}</option>`).join('')}</select><input class="num" data-i="${i}" data-k="value" value="${esc(c.value)}" inputmode="decimal" aria-label="Value"><button class="btn" data-rm="${i}" aria-label="Remove condition">×</button><small>${esc(F[c.field]?.unit || '')} · ${esc(F[c.field]?.src || '')}</small></div>`).join('') || '<div class="note">No conditions yet.</div>';
}
$('bl-conds').addEventListener('input', (e) => { const i = e.target.dataset.i; if (i == null) return; COND[i][e.target.dataset.k] = e.target.value; if (e.target.dataset.k === 'field') blConds(); blUpdate(); });
$('bl-conds').addEventListener('click', (e) => { const i = e.target.dataset.rm; if (i == null) return; COND.splice(+i, 1); blConds(); blUpdate(); });
$('bl-add').onclick = () => { COND.push({ field: 'chgH1', op: '>=', value: 1 }); blConds(); blUpdate(); };
$('bl-tpl').innerHTML = Object.keys(TPL).map((k) => `<button data-t="${esc(k)}">${esc(k)}</button>`).join('');
$('bl-tpl').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; [...$('bl-tpl').children].forEach((x) => x.classList.toggle('is-on', x === b)); COND = TPL[b.dataset.t].map(([field, op, value]) => ({ field, op, value })); if (!$('bl-name').value) $('bl-name').value = b.dataset.t.toLowerCase(); blConds(); blUpdate(); };
$('bl-new').onclick = () => { $('bl-name').value = ''; COND = []; [...$('bl-tpl').children].forEach((x) => x.classList.remove('is-on')); blConds(); blUpdate(); };
$('bl-name').oninput = blUpdate;
const CMP = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b };
function blUpdate() {
  const F = FIELDS?.fields || {}; const parts = COND.map((c) => `${F[c.field]?.label || c.field} ${c.op} ${c.value}`);
  $('bl-line').textContent = parts.length ? `Votes when ${parts.join(' AND ')}, on a recently retrieved quote. It votes as the “Your agents” family.` : 'Add at least one condition.';
  const ok = COND.length && COND.every((c) => Number.isFinite(Number(c.value)) && String(c.value).trim() !== '');
  const fresh = D.MARKET.filter((m) => m.fresh);
  const n = ok ? fresh.filter((m) => COND.every((c) => { const v = m.metrics[c.field]; return Number.isFinite(v) && CMP[c.op](v, Number(c.value)); })).length : null;
  $('bl-match').textContent = n == null ? '—' : n; $('bl-match-s').textContent = `of ${fresh.length} tracked tokens with recent quotes match (latest poll)`;
  $('bl-err').textContent = COND.some((c) => !Number.isFinite(Number(c.value)) || String(c.value).trim() === '') ? 'Every value must be a number.' : '';
}
$('bl-save').onclick = async () => {
  if (RO) return;
  const name = $('bl-name').value.trim(); if (!name) return ($('bl-err').textContent = 'Give the agent a name first.');
  const ex = D.AGENTS.find((a) => !a.builtin && a.name.toLowerCase() === name.toLowerCase());
  const r = await A.saveAgent({ ...(ex ? { id: ex.id } : {}), name, conditions: COND.map((c) => ({ field: c.field, op: c.op, value: Number(c.value) })) });
  if (!r.ok) { $('bl-err').textContent = r.errors.join(' '); return; }
  $('bl-err').textContent = ''; toast(`${r.agent.name} saved. It votes from the next poll.`); await refresh(true);
};
function renderMine() {
  const mine = D.AGENTS.filter((a) => !a.builtin); const slots = FIELDS?.slots ?? 3; $('bl-slots').textContent = `${mine.filter((a) => a.enabled).length} of ${slots} slots running`; $('mb-empty').hidden = mine.length > 0;
  $('mb-rows').innerHTML = mine.map((a) => `<tr><td title="${esc(a.rule)}"><b>${esc(a.name)}</b> <span class="dim">${esc(a.rule)}</span></td><td class="${a.enabled ? 'up' : 'dim'}">${a.enabled ? 'voting' : 'stopped'}</td><td class="n">${a.votes}</td><td class="n">${a.quorums}</td><td class="n">${a.fills}</td><td class="n ${cl(a.pnl)}">${susd(a.pnl)}</td><td>${RO ? '<span class="dim">read-only</span>' : `<button class="btn sm" data-act="${a.enabled ? 'stop' : 'start'}" data-id="${esc(a.id)}">${a.enabled ? 'Stop' : 'Start'}</button> <button class="btn sm danger" data-act="delete" data-id="${esc(a.id)}" aria-label="Delete ${esc(a.name)}">Delete</button>`}</td></tr>`).join('');
}
$('mb-rows').onclick = async (e) => { if (RO) return; const b = e.target.closest('button[data-act]'); if (!b) return; if (b.dataset.act === 'delete' && !confirm('Delete this agent? Its history stays in the ledger.')) return; const r = await A.agentAction(b.dataset.id, b.dataset.act); if (!r.ok) return toast(r.errors[0]); await refresh(true); };
$('ea-fam').innerHTML += FAMS.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
function renderEvery() {
  const f = $('ea-fam').value, q = $('ea-q').value.toLowerCase(); const rows = D.AGENTS.filter((a) => (!f || a.fam === f) && (!q || (a.key + a.name + (FAM[a.fam]?.name || '') + a.rule).toLowerCase().includes(q)));
  $('ea-sub').textContent = `${D.AGENTS.length} agents · ${rows.length} shown`;
  $('ea-rows').innerHTML = rows.map((a) => `<tr><td title="${esc(a.rule)}">${gl(a.fam)}<b>${esc(a.key)}</b> ${esc(a.name)} <span class="dim">${esc(a.rule)}</span>${a.enabled ? '' : ' <span class="tag">stopped</span>'}</td><td>${esc(FAM[a.fam]?.name || a.fam)} · ${esc(a.lin)}</td><td class="n">${a.checks.toLocaleString()}</td><td class="n">${a.votes.toLocaleString()}</td><td class="n">${a.quorums}</td><td class="n">${a.missing}</td><td class="n ${cl(a.pnl)}">${susd(a.pnl)}</td></tr>`).join('') || '<tr><td colspan="7" class="note">No agents match.</td></tr>';
}
$('ea-fam').onchange = renderEvery; $('ea-q').oninput = renderEvery;
let agentsInit = false;
function renderAgents() {
  if (!agentsInit) { agentsInit = true; COND = TPL.Momentum.map(([field, op, value]) => ({ field, op, value })); $('bl-tpl').children[0].classList.add('is-on');
    $('bl-unsup').innerHTML = Object.entries(FIELDS?.unsupported || {}).map(([k, v]) => `<li><code>${esc(k)}</code>: ${esc(v)}</li>`).join(''); blConds(); }
  blUpdate(); renderMine(); renderEvery();
}

// ---------------------------------------------------------------- LEDGER
const KINDS = [['', 'All'], ['buy', 'Paper buys'], ['sell', 'Paper sells'], ['cancel', 'Cancelled'], ['control', 'Desk'], ['agent', 'Agents']]; let ledK = '';
function ledRows() { const q = $('led-q').value.toLowerCase(); return D.LEDGER.filter((r) => (!ledK || r.kind === ledK) && (!q || [r.who, r.coin, r.note].join(' ').toLowerCase().includes(q))); }
function renderLedger() {
  const a = ST?.account || {};
  $('led-tiles').innerHTML = [['Virtual cash', usd(a.cash), 'PAPER · not real money'], ['Realized P&L', susd(a.realizedUsd), 'after estimated fees + slippage'], ['Estimated fees', usd(a.feesUsd), 'assumed rates, see settings'], ['Paper buys', D.LEDGER.filter((r) => r.kind === 'buy').length, 'simulated fills'], ['Paper sells', D.LEDGER.filter((r) => r.kind === 'sell').length, 'simulated fills']].map(([k, v, s]) => `<div class="tile"><div class="kl">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  $('led-kinds').innerHTML = KINDS.map(([k, l]) => `<button class="chip2 ${k === ledK ? 'is-on' : ''}" data-k="${k}" aria-pressed="${k === ledK}">${l}<em>${k ? D.LEDGER.filter((r) => r.kind === k).length : D.LEDGER.length}</em></button>`).join('');
  const rows = ledRows();
  $('led-rows').innerHTML = rows.slice(0, 800).map((r) => `<tr><td class="dim">${td(r.at)}</td><td class="k">${esc(r.kind)}</td><td>${esc(r.who)}</td><td>${esc(r.coin)}</td><td class="n ${cl(r.usd)}">${r.usd == null ? '' : usd(r.usd)}</td><td class="n ${cl(r.pnl)}">${r.pnl == null ? '' : susd(r.pnl)}</td><td class="note" title="${esc(r.note)}">${esc(r.note)}</td></tr>`).join('') || `<tr><td colspan="7" class="note">${D.LEDGER.length ? 'No entries match.' : 'The ledger is empty. Entries appear when the desk places, fills or cancels a paper order.'}</td></tr>`;
}
$('led-kinds').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; ledK = b.dataset.k; renderLedger(); }; $('led-q').oninput = renderLedger;
$('led-csv').onclick = () => { const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; const csv = ['time_utc,paper,kind,who,coin,mint,usd,pnl_usd,note', ...ledRows().map((r) => [new Date(r.at).toISOString(), 'true', r.kind, r.who, r.coin, r.mint, r.usd, r.pnl, r.note].map(q).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'paper-ledger.csv'; document.body.append(a); a.click(); a.remove(); toast('paper-ledger.csv downloaded'); };

// ---------------------------------------------------------------- PAPER ACCOUNT
function renderAccount() {
  const a = ST?.account || {}; const L = ST?.limits || {}; const X = D.ACCOUNT || { positions: [], pending: [], closed: [] };
  $('acct-tiles').innerHTML = [['Equity', usd(a.equity), `start ${usd(a.startingCash, 0)} · ${susd(a.pnlUsd)}${a.equityStaleMarks ? ' · ' + a.equityStaleMarks + ' stale mark(s)' : ''}`], ['Virtual cash', usd(a.cash), `reserve kept: ${usd(L.reserveUsd, 0)}`], ['Exposure (cost)', usd(a.exposureUsd), `limit ${usd(L.maxExposureUsd, 0)}`], ['Unrealized', susd(a.unrealizedUsd), 'est. exit value − cost'], ['Realized', susd(a.realizedUsd), `fees est. ${usd(a.feesUsd)}`]].map(([k, v, s]) => `<div class="tile"><div class="kl">${k} <span class="tag paper">PAPER</span></div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  $('pos-empty').hidden = X.positions.length > 0;
  $('pos-rows').innerHTML = X.positions.map((p) => `<tr><td><b>${esc(p.sym)}</b></td><td class="dim">${td(p.openedAt)}</td><td class="n">${p.qty.toPrecision(6)}</td><td class="n">${px(p.entryPrice)}</td><td class="n">${px(p.mark)}</td><td class="${p.markStale ? 'stale' : 'dim'}">${ago(p.markAt)}${p.markStale ? ' · stale' : ''}</td><td class="n">${usd(p.cost)}</td><td class="n">${usd(p.estExitUsd)}</td><td class="n ${cl(p.unrealizedUsd)}">${susd(p.unrealizedUsd)}</td><td>${p.tpDone.map((d) => d ? '●' : '○').join(' ')}${p.pendingSell ? ' · selling' : ''}</td><td>${p.url ? `<a class="tx" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">pair ↗</a>` : ''}</td></tr>`).join('');
  $('pend-empty').hidden = X.pending.length > 0;
  $('pend-rows').innerHTML = X.pending.map((o) => `<tr><td class="${o.side === 'buy' ? 'warn' : 'acc'}">${o.side.toUpperCase()}</td><td>${esc(o.sym)}</td><td class="dim">${td(o.decidedAt)}</td><td class="n">${px(o.decisionPrice)}</td><td class="note">${esc(o.reason || 'quorum ' + o.quorumId)}</td><td class="n">${o.waits}</td></tr>`).join('');
  $('cl-empty').hidden = X.closed.length > 0;
  $('cl-rows').innerHTML = X.closed.map((p) => `<tr><td><b>${esc(p.sym)}</b></td><td class="dim">${td(p.openedAt)}</td><td class="dim">${td(p.closedAt)}</td><td class="n">${usd(p.cost0)}</td><td class="n ${cl(p.pnl)}">${susd(p.pnl)}</td><td class="n ${cl(p.pnl)}">${pct((p.pnl / p.cost0) * 100, 1)}</td></tr>`).join('');
  if (L.exits) {
    $('lanegrid').innerHTML = [['Trade size (incl. fees)', usd(L.tradeSizeUsd, 0)], ['Quorum', `${L.quorum.minVotes} votes · ${L.quorum.minFamilies} families`], ['Max open', L.maxOpenPositions], ['Exposure cap', usd(L.maxExposureUsd, 0)], ['Buys / hour', L.maxBuysPerHour], ['Daily loss limit', `${usd(L.dailyLossLimitUsd, 0)} (${ST.desk.dayTimeZone} day)`], ['Min liquidity', big(L.minLiquidityUsd)], ['Token cooldown', L.cooldownMinutes + ' min'], ['Take profit', L.exits.takeProfit.map((s) => `${s.sellPct}% at +${s.atPct}%`).join(', ') || 'none'], ['Stop loss', '−' + L.exits.stopLossPct + ' %'], ['Trailing stop', `${L.exits.trailingPct} % from peak, armed at +${L.exits.trailingArmPct} %`], ['Max hold', L.exits.maxHoldMinutes + ' min']].map(([k, v]) => `<div><div class="kl">${k}</div><div class="v">${esc(v)}</div></div>`).join('');
    $('fill-model').textContent = `Simulated fill model (assumptions, not venue fees): orders fill at the next newer DexScreener quote, at the worse of the decision price and that quote; slippage = max(${L.slippageBps} bps${L.priceImpactModel ? ', 2 × trade ÷ pool liquidity' : ''}); fee ${L.feeBps} bps of notional + ${usd(L.flatFeeUsd)} flat per order, on buys and sells. A trade larger than ${L.maxPctOfLiquidity} % of pool liquidity is refused.`;
  }
}

// ---------------------------------------------------------------- unavailable pages
const whyPage = (id, sec, extra) => () => { $(id).innerHTML = `<p>${esc(A.reasons[sec] || t('common.unavailable'))}</p><p class="note">${extra}</p>`; };
const RENDER = {
  desk: () => { deskTick(); renderTrades(); }, proof: () => { renderProofList(); if (!pfSel && D.QUORUMS[0] && !location.pathname.startsWith('/q/')) openQuorum(D.QUORUMS[0].id); },
  backtest: whyPage('why-backtest', 'backtest', 'No results are shown. A backtest needs recorded price history, which this version does not keep.'),
  agents: renderAgents, narr: whyPage('why-narr', 'metas', 'No results are shown. This feature is not available.'), devhunt: whyPage('why-devhunt', 'devhunt', 'No results are shown. This feature is not available.'),
  lab: whyPage('why-lab', 'lab', 'No results are shown. This feature is not available.'), ledger: renderLedger, wallets: renderAccount,
};

// ---------------------------------------------------------------- refresh loop
let refreshing = null;
async function refresh(force = false) {
  if (refreshing && !force) return refreshing;
  refreshing = (async () => { const [d, s] = await Promise.all([A.load(), A.status()]); D = d; applyStatus(s); paintSources(); const p = current(); if (p) RENDER[p]?.(); else deskTick(); })().finally(() => { refreshing = null; });
  return refreshing;
}
setInterval(() => refresh(), Math.max(3000, CFG.data.pollMs || 10000));
setInterval(() => { if (current() === 'desk') deskTick(); }, 3000);
A.subscribe(onEvent, (st) => { paintSources(); $('state').classList.toggle('live', st === 'live'); $('state-t').textContent = st === 'live' ? 'stream live' : st; });
// ---------------------------------------------------------------- project: read-only mode + PAYPER token line
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // format only; the server already checked it decodes to 32 bytes
function applyProject() {
  if (RO) {
    document.body.classList.add('is-readonly'); $('ro-note').hidden = false; $('ro-ctl').hidden = false;
    for (const id of ['ctl-pause', 'ctl-pause2', 'ctl-reset']) $(id).hidden = true;
    $('ctl-state').textContent = 'public site is read-only';
    const sv = $('bl-save'); sv.disabled = true; sv.textContent = 'Saving is disabled on the public site'; sv.title = 'This public site is read-only. Run Payper on your own computer to define agents.';
  }
  const tk = PROJ?.token; const mint = tk?.status === 'address-set' && MINT_RE.test(tk.mint || '') ? tk.mint : null;
  if (!mint) return; // stays "NOT LAUNCHED YET" with no address, no copy button and no link
  $('token').classList.add('is-set'); $('token-state').textContent = 'CONTRACT ADDRESS'; $('token-state').removeAttribute('title');
  $('token-body').textContent = 'Address configured by the site operator and checked for format only. Verify it against the official announcement before trading.';
  $('token-mint').textContent = mint; $('token-pump').href = `https://pump.fun/coin/${mint}`; $('token-act').hidden = false;
  $('token-copy').onclick = async () => { try { await navigator.clipboard.writeText(mint); toast('Address copied.'); } catch { const r = document.createRange(); r.selectNodeContents($('token-mint')); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Address selected. Press Ctrl+C to copy.'); } };
}
applyProject();
applyStatus(ST); paintSources(); seedLog(); setHero(D.QUORUMS[0]);
go(location.pathname.slice(1) || PAGES[0], false);
document.addEventListener('click', (e) => { const b = e.target.closest('.seg button'); if (!b) return; const g = b.parentElement; requestAnimationFrame(() => g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x.classList.contains('is-on') ? 'true' : 'false'))); });
