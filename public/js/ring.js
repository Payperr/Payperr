// "Fig. 1 · Family register": a printed wheel for the Greenbar desk. One annular segment per
// strategy family, sized by its agent count. Every family has its own HATCH PATTERN and GLYPH
// (shape, not colour, identifies it), matching the .gl glyphs in the lists. It is a static drawing:
// it redraws only on resize, hover, selection and on vote / quorum stamps (skipped when the
// user prefers reduced motion). API kept from the earlier ring: createRing(canvas, fams, { onHover, onPick })
// returns { pulse(familyId, big), clear(), select(ids) }.
export const GLYPH_COUNT = 6;
export function createRing(cv, fams, { onHover, onPick } = {}) {
  const css = (v, d) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d;
  const INK = css('--tx', '#1f231d'), PAPER = '#fbfbf6', BAR = '#dcebd6', RED = css('--dn', '#a2372e');
  const FONT = "'Courier Prime','Courier New',monospace";
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const ctx = cv.getContext('2d'); const stage = cv.parentElement;
  let W = 0, H = 0, dpr = 1, hover = -1; const sel = new Set(); let stamps = []; let raf = 0; let pats = [];
  const tot = fams.reduce((a, f) => a + f.agents, 0) || 1;
  const GAP = 0.018; const segs = []; { let a = 0; for (const f of fams) { const d = (f.agents / tot) * Math.PI * 2; segs.push({ f, a0: a, a1: a + d }); a += d; } }
  const count = (f) => (f.agents >= 1 ? Math.round(f.agents) : 0);

  // ---- hatch patterns, one per family (drawn once per DPR)
  function makePatterns() {
    pats = fams.map((_, i) => {
      const s = Math.round(8 * dpr), o = document.createElement('canvas'); o.width = s; o.height = s; const p = o.getContext('2d'); if (!p) return null;
      p.strokeStyle = INK; p.fillStyle = INK; p.lineWidth = Math.max(1, 1.1 * dpr); p.beginPath();
      const k = i % GLYPH_COUNT;
      if (k === 0) { p.moveTo(0, s); p.lineTo(s, 0); p.moveTo(-s / 2, s / 2); p.lineTo(s / 2, -s / 2); p.moveTo(s / 2, s * 1.5); p.lineTo(s * 1.5, s / 2); }   // ////
      if (k === 1) { p.moveTo(0, s / 2); p.lineTo(s, s / 2); }                                                                                          // ====
      if (k === 2) { p.moveTo(0, s); p.lineTo(s, 0); p.moveTo(0, 0); p.lineTo(s, s); }                                                                   // xxxx
      if (k === 3) { p.moveTo(0, 0); p.lineTo(s, s); p.moveTo(s / 2, -s / 2); p.lineTo(s * 1.5, s / 2); p.moveTo(-s / 2, s / 2); p.lineTo(s / 2, s * 1.5); } // \\\\
      if (k === 4) { p.arc(s / 2, s / 2, 1.3 * dpr, 0, 7); p.fill(); }                                                                                  // ....
      if (k === 5) { p.moveTo(s / 2, 0); p.lineTo(s / 2, s); }                                                                                          // ||||
      p.stroke(); const pat = ctx.createPattern?.(o, 'repeat'); pat?.setTransform?.(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, 0, 0])); return pat || null;
    });
  }
  // ---- glyph shapes (same set as .gl.g0 … .gl.g5 in greenbar.css)
  function glyph(i, x, y, s, fill = INK) {
    const k = i % GLYPH_COUNT, h = s / 2; ctx.save(); ctx.fillStyle = fill; ctx.beginPath();
    if (k === 0) { ctx.moveTo(x, y - h); ctx.lineTo(x + h, y + h); ctx.lineTo(x - h, y + h); }
    else if (k === 1) ctx.rect(x - h, y - h, s, s);
    else if (k === 2) { ctx.moveTo(x, y - h); ctx.lineTo(x + h, y); ctx.lineTo(x, y + h); ctx.lineTo(x - h, y); }
    else if (k === 3) { ctx.moveTo(x - h, y - h); ctx.lineTo(x + h, y - h); ctx.lineTo(x, y + h); }
    else if (k === 4) ctx.arc(x, y, h, 0, 7);
    else { const t = s * 0.17; ctx.rect(x - t, y - h, 2 * t, s); ctx.rect(x - h, y - t, s, 2 * t); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // Room for the printed legend: the widest label + glyph + leader on each side. If the wheel would get
  // too small (phones, narrow columns) the labels are dropped and only glyphs are printed; the Families
  // list next to the wheel is the full legend either way.
  const labelW = () => { ctx.font = `700 11px ${FONT}`; return Math.max(60, ...fams.map((f) => ctx.measureText?.(`${String(f.name || f.id).toUpperCase()} ${count(f)}`)?.width || 0)); };
  let LW = 100; const geo = () => { const full = Math.min(H * 0.36, W / 2 - 26 - 23 - LW - 8); const compact = full < 84; const R = Math.max(56, compact ? Math.min(H * 0.36, W * 0.36) : full); return { cx: W / 2, cy: H / 2 + 6, R, r: R * 0.6, compact }; };
  const ang = (a) => a - Math.PI / 2; // 0 = twelve o'clock, clockwise
  function sector(g, s, grow = 0) { const a0 = ang(s.a0 + GAP), a1 = ang(s.a1 - GAP); ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R + grow, a0, a1); ctx.arc(g.cx, g.cy, g.r, a1, a0, true); ctx.closePath(); }

  function size() { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform?.(dpr, 0, 0, dpr, 0, 0); LW = labelW(); makePatterns(); draw(); }
  function draw(now = performance.now()) {
    if (!W || !H) return; const g = geo(); ctx.clearRect(0, 0, W, H);
    stage?.style.setProperty('--hole', Math.round(g.r * 2) + 'px');
    // protractor ticks
    ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R + 9, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 72; i++) { const a = ang((i / 72) * Math.PI * 2), L = i % 6 === 0 ? 7 : 3; ctx.beginPath(); ctx.moveTo(g.cx + Math.cos(a) * (g.R + 9), g.cy + Math.sin(a) * (g.R + 9)); ctx.lineTo(g.cx + Math.cos(a) * (g.R + 9 + L), g.cy + Math.sin(a) * (g.R + 9 + L)); ctx.stroke(); }
    ctx.setLineDash?.([2, 3]); ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r - 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash?.([]);
    // segments
    segs.forEach((s, i) => {
      const on = sel.has(s.f.id), dimmed = sel.size && !on, hv = i === hover;
      sector(g, s, hv ? 4 : 0); ctx.fillStyle = on ? BAR : PAPER; ctx.fill();
      if (pats[i]) { ctx.save(); ctx.globalAlpha = dimmed ? 0.28 : 1; ctx.fillStyle = pats[i]; ctx.fill(); ctx.restore(); }
      ctx.lineWidth = on || hv ? 3 : 1.5; ctx.strokeStyle = INK; ctx.stroke();
    });
    // legend labels with leader lines, in two printed columns
    ctx.font = `700 11px ${FONT}`; ctx.textBaseline = 'middle';
    const L = [], Rr = [];
    segs.forEach((s, i) => { const m = ang((s.a0 + s.a1) / 2); (Math.cos(m) >= 0 ? Rr : L).push({ s, i, m, y: g.cy + Math.sin(m) * (g.R + 18) }); });
    for (const col of [L, Rr]) {
      col.sort((a, b) => a.y - b.y); const top = 64, bot = H - 30; let prev = -1e9;
      for (const it of col) { it.y = Math.max(top, it.y, prev + 18); prev = it.y; }
      const over = prev - bot; if (over > 0) for (const it of col) it.y -= over;
      for (const it of col) {
        const right = col === Rr, ox = g.cx + Math.cos(it.m) * (g.R + 10), oy = g.cy + Math.sin(it.m) * (g.R + 10);
        const on = sel.has(it.s.f.id), dimmed = sel.size && !on;
        ctx.globalAlpha = dimmed ? 0.45 : 1;
        if (g.compact) { glyph(it.i, g.cx + Math.cos(it.m) * (g.R + 22), g.cy + Math.sin(it.m) * (g.R + 22), 9); ctx.globalAlpha = 1; continue; }
        const ex = right ? Math.max(ox + 12, g.cx + g.R + 26) : Math.min(ox - 12, g.cx - g.R - 26);
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, it.y); ctx.lineTo(ex + (right ? 6 : -6), it.y); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
        const label = `${String(it.s.f.name || it.s.f.id).toUpperCase()} ${count(it.s.f)}`;
        const gx = right ? ex + 14 : ex - 14; glyph(it.i, gx, it.y, 8);
        ctx.fillStyle = INK; ctx.textAlign = right ? 'left' : 'right'; ctx.fillText(label, right ? gx + 9 : gx - 9, it.y + 0.5);
        if (on) { const w = ctx.measureText(label).width; ctx.fillRect(right ? gx + 9 : gx - 9 - w, it.y + 7, w, 1.5); }
        ctx.globalAlpha = 1;
      }
    }
    // vote / quorum stamps
    stamps = stamps.filter((p) => now - p.t0 < p.d);
    for (const p of stamps) {
      const s = segs[p.i]; if (!s) continue; const k = (now - p.t0) / p.d, m = ang((s.a0 + s.a1) / 2), rr = (g.R + g.r) / 2;
      ctx.save(); ctx.globalAlpha = 1 - k; sector(g, s, 2); ctx.lineWidth = 4; ctx.strokeStyle = RED; ctx.stroke();
      ctx.translate(g.cx + Math.cos(m) * rr, g.cy + Math.sin(m) * rr); ctx.rotate(-0.14); ctx.font = `700 ${p.big ? 13 : 11}px ${FONT}`; ctx.textAlign = 'center';
      const txt = p.big ? 'QUORUM' : 'VOTE', w = ctx.measureText(txt).width + 10, h = p.big ? 20 : 17;
      ctx.fillStyle = PAPER; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.fillStyle = RED; ctx.fillText(txt, 0, 1); ctx.restore();
    }
    if (stamps.length && !raf) raf = requestAnimationFrame((t) => { raf = 0; draw(t); });
  }
  // ---- interaction
  function segAt(x, y) { const g = geo(); const dx = x - g.cx, dy = y - g.cy, d = Math.hypot(dx, dy); if (d < g.r - 4 || d > g.R + 10) return -1; const a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 4) % (Math.PI * 2); return segs.findIndex((s) => a >= s.a0 && a < s.a1); }
  const pos = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.addEventListener('pointermove', (e) => { const [x, y] = pos(e); const i = segAt(x, y); if (i !== hover) { hover = i; draw(); } onHover?.(i >= 0 ? segs[i].f : null, x, y); });
  cv.addEventListener('pointerleave', () => { hover = -1; draw(); onHover?.(null); });
  cv.addEventListener('click', (e) => { const [x, y] = pos(e); const i = segAt(x, y); if (i < 0) return; const id = segs[i].f.id; sel.has(id) ? sel.delete(id) : sel.add(id); draw(); onPick?.([...sel]); });
  new ResizeObserver(size).observe(cv); size(); document.fonts?.ready?.then(() => { LW = labelW(); draw(); });
  return {
    pulse(id, big) { if (RM.matches) return; const i = segs.findIndex((s) => s.f.id === id); if (i < 0) return; stamps.push({ i, big: !!big, t0: performance.now(), d: big ? 1600 : 900 }); if (stamps.length > 12) stamps.shift(); draw(); },
    clear() { sel.clear(); draw(); onPick?.([]); },
    select(ids) { sel.clear(); for (const id of ids || []) sel.add(id); draw(); },
  };
}
