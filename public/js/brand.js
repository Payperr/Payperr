// Applies config to the static shell: theme tokens, fonts, title, logo, nav, socials, copy, footer, hidden pages.
import { CFG, t, fill, pagesOn } from './config.js';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICONS = {
  x: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.9 3h6.4l4.4 5.8zM16.7 19.2h1.7L7.3 4.7H5.5z',
  telegram: 'M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-7.9c.4-.3-.1-.5-.6-.2L6.7 13l-4.7-1.5c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3z',
  discord: 'M19.3 5.3A17 17 0 0 0 15 4l-.5 1a15.7 15.7 0 0 0-5 0L9 4a17 17 0 0 0-4.3 1.3C2 9.4 1.3 13.4 1.6 17.3A17 17 0 0 0 6.9 20l1.1-1.8c-.6-.2-1.2-.5-1.7-.9l.4-.3a12 12 0 0 0 10.6 0l.4.3c-.5.4-1.1.7-1.7.9l1.1 1.8a17 17 0 0 0 5.3-2.7c.4-4.6-.7-8.5-3.1-12zM8.5 14.9c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1zm7 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1z',
  github: 'M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z',
  docs: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8', web: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
};
export function applyBrand() {
  const r = document.documentElement.style, th = CFG.theme;
  for (const k of ['bg', 'pn', 'pn2', 'bg3', 'ln', 'ln2', 'ln3', 'tx', 'ink2', 'mu', 'dim', 'acc', 'acc2', 'up', 'dn', 'warn', 'glow', 'glow2']) if (th[k]) r.setProperty('--' + k, th[k]);
  if (th.radius) r.setProperty('--r', th.radius); if (th.onAcc) r.setProperty('--on-acc', th.onAcc);
  // fonts
  const F = CFG.fonts; let css = '';
  for (const f of [F.mono, F.sans]) if (f?.src) css += `@font-face{font-family:'${f.family}';src:url(${f.src}) format('woff2');font-weight:100 900;font-display:swap}`;
  if (F.mono) r.setProperty('--mono', `'${F.mono.family}',${F.mono.stack}`); if (F.sans) r.setProperty('--sans', `'${F.sans.family}',${F.sans.stack}`);
  document.head.insertAdjacentHTML('beforeend', `<style id="cfg-fonts">${css}</style>`);
  if (F.stylesheet) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${esc(F.stylesheet)}">`);
  // head
  document.title = `${CFG.brand.name} · ${CFG.brand.tagline}`;
  document.querySelector('meta[name=description]')?.setAttribute('content', CFG.brand.description);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', th.bg);
  const ic = document.querySelector('link[rel=icon]'); if (ic) ic.href = CFG.brand.favicon;
  // brand
  const L = CFG.brand.logo; $('brand-logo').innerHTML = L.type === 'text' ? `<span class="tmark">${esc(L.text)}</span>` : `<img src="${esc(L.src)}" alt="">`;
  $('brand-name').textContent = CFG.brand.name; $('brand-sym').textContent = CFG.brand.ticker;
  // nav + hidden pages
  // Greenbar nav = a printed table of contents: "01 DESK ........ P.001"; unavailable pages read N/A.
  const nn = (i) => String(i + 1).padStart(2, '0');
  $('nav').setAttribute('data-nav', ''); $('nav').innerHTML = `<ul>${pagesOn.map((p, i) => `<li><button data-go="${p.id}"><span class="nno" aria-hidden="true">${nn(i)}</span><span class="nl">${esc(p.label)}</span><span class="nlead" aria-hidden="true"></span>${p.na ? '<span class="nna">N/A</span><span class="sr"> (unavailable in this version)</span>' : `<span class="npg" aria-hidden="true">P.${String(i + 1).padStart(3, '0')}</span>`}</button></li>`).join('')}</ul>`;
  // mobile tab strip: the first four AVAILABLE pages + "More" (opens the sidebar drawer with every page)
  const tabs = pagesOn.filter((p) => !p.na).slice(0, 4); document.body.insertAdjacentHTML('beforeend', `<nav class="tabbar" data-nav aria-label="Pages (mobile)">${tabs.map((p) => `<button data-go="${p.id}"><span class="tno" aria-hidden="true">${nn(pagesOn.indexOf(p))}</span><span>${esc(p.short || p.label)}</span></button>`).join('')}${pagesOn.length > tabs.length ? `<button id="tab-more" aria-controls="side" aria-expanded="false"><span class="tno" aria-hidden="true">≡</span><span>More</span></button>` : ''}</nav>`);
  initDrawer();
  for (const p of CFG.pages) if (p.enabled === false) document.getElementById('pg-' + p.id)?.classList.add('is-disabled'); // kept in the DOM (hidden) so shared code never hits a missing node
  document.querySelectorAll('a[data-go]').forEach((a) => { if (!pagesOn.find((p) => p.id === a.dataset.go) && !a.classList.contains('brand')) a.hidden = true; });
  const home = document.querySelector('a.brand'); if (home) home.dataset.go = pagesOn[0]?.id || 'desk';
  // socials
  $('socials').innerHTML = CFG.social.map((s) => `<a class="xb" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.label)}"><svg viewBox="0 0 24 24" ${s.type === 'docs' || s.type === 'web' ? 'fill="none" stroke="currentColor" stroke-width="1.8"' : ''}><path d="${ICONS[s.type] || ICONS.web}"/></svg></a>`).join('');
  document.querySelectorAll('[data-unit]').forEach((e) => (e.textContent = CFG.chain.unit));
  // copy
  document.querySelectorAll('[data-c]').forEach((el) => { if (CFG.copy[el.dataset.c] != null) el.innerHTML = t(el.dataset.c); });
  // footer
  const ft = $('footer'); if (CFG.footer?.enabled) { ft.hidden = false; ft.innerHTML = `<span>${fill(CFG.footer.text)}</span>${(CFG.footer.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}`; }
}

// Off-canvas sidebar on small screens: menu button / More tab open it, Esc / scrim / navigation close it, focus is managed.
function initDrawer() {
  const side = $('side'), scrim = $('scrim'), openers = [$('menu-btn'), $('tab-more')].filter(Boolean); let last = null;
  const set = (open) => { side.classList.toggle('open', open); document.body.classList.toggle('drawer-open', open); scrim.hidden = !open; openers.forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) { last = document.activeElement; side.querySelector('[data-go], button')?.focus(); } else last?.focus?.(); };
  openers.forEach((b) => b.addEventListener('click', () => set(!side.classList.contains('open'))));
  $('side-close').addEventListener('click', () => set(false)); scrim.addEventListener('click', () => set(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && side.classList.contains('open')) set(false); });
  document.addEventListener('page:change', () => side.classList.contains('open') && set(false));
}
