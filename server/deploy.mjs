// Runtime settings that differ between the LOCAL desk (START.bat) and a PUBLIC read-only deployment.
// Everything here comes from environment variables (set in a hosting dashboard) or the
// contractAddress setting in paper.config.json. Nothing in this file talks to a wallet or a chain.
import path from 'node:path';

// ---------------------------------------------------------------- Solana address format check
// FORMAT ONLY: base58 text that decodes to exactly 32 bytes. This proves the value is shaped
// like a Solana public key; it does NOT prove the token exists, who created it, or that it is
// the official PAYPER token.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58Decode(s) {
  if (typeof s !== 'string' || !s.length || s.length > 64) return null;
  const bytes = []; // little-endian accumulator
  for (const ch of s) {
    let carry = B58.indexOf(ch); if (carry < 0) return null;
    for (let i = 0; i < bytes.length; i++) { carry += bytes[i] * 58; bytes[i] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (const ch of s) { if (ch !== '1') break; bytes.push(0); } // each leading "1" is a leading zero byte
  return Uint8Array.from(bytes.reverse());
}
export function checkContractAddress(raw) {
  const v = typeof raw === 'string' ? raw.trim() : raw;
  if (v === undefined || v === null || v === '') return { ok: true, mint: null };
  if (typeof v !== 'string') return { ok: false, error: 'The contract address must be text, for example "TokenMintAddress..." in quotes.' };
  if (/^[a-z][a-z0-9+.-]*:|\/|pump\.fun/i.test(v)) return { ok: false, error: 'Paste only the mint address, not a web link. On the pump.fun page, copy the contract address (CA) itself: 32 to 44 letters and digits, no "https://" and no slashes.' };
  if (/\s/.test(v)) return { ok: false, error: 'The contract address must not contain spaces or line breaks. Paste one address only.' };
  if (v.length < 32 || v.length > 44) return { ok: false, error: `The contract address must be 32 to 44 characters long (got ${v.length}). Copy the whole mint address, nothing else.` };
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(v)) return { ok: false, error: 'The contract address may only contain Solana base58 letters and digits (no 0, O, I, l, spaces, slashes or "https://"). Paste only the mint address, not a web link.' };
  const b = base58Decode(v);
  if (!b || b.length !== 32) return { ok: false, error: 'This text is not a valid Solana address (it does not decode to 32 bytes). Check that it was copied completely.' };
  return { ok: true, mint: v };
}
export const pumpFunUrl = (mint) => `https://pump.fun/coin/${mint}`;

// ---------------------------------------------------------------- origin / host rules
function parseOrigin(s) {
  let u; try { u = new URL(s); } catch { return { error: `PUBLIC_ORIGIN "${s}" is not a valid URL. Example: https://payper.example.com` }; }
  if (s.includes('*')) return { error: 'PUBLIC_ORIGIN must be one exact origin; wildcards are not allowed.' };
  if (u.username || u.password) return { error: 'PUBLIC_ORIGIN must not contain a user name or password.' };
  if ((u.pathname && u.pathname !== '/') || u.search || u.hash) return { error: 'PUBLIC_ORIGIN must be only scheme + host (+ port), with no path, for example https://payper.example.com' };
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return { error: 'PUBLIC_ORIGIN must start with https:// (plain http:// is only accepted for localhost testing).' };
  return { origin: u.origin, host: u.host.toLowerCase() };
}
const hostRe = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$|^\[[0-9a-f:]+\](?::\d{1,5})?$/;

/**
 * Resolve the run mode from the environment.
 *   PAYPER_MODE      local (default) | public
 *   PUBLIC_ORIGIN    public mode: the exact https origin visitors use. On Render, if it is not set,
 *                    the platform's own RENDER_EXTERNAL_URL (https://<name>.onrender.com) is used.
 *   TRUSTED_HOSTS    public mode, optional: extra exact Host header values (comma separated).
 *                    On Render, RENDER_EXTERNAL_HOSTNAME (<name>.onrender.com) is trusted automatically.
 *   PORT             port to listen on (public default 8080; local default from paper.config.json)
 *   BIND_HOST        public mode only, default 0.0.0.0; local mode always binds 127.0.0.1
 *   DATA_DIR         where the paper account file is stored (default ./data)
 *   TOKEN_MINT       the PAYPER contract (mint) address; overrides contractAddress in paper.config.json
 *   MAX_STREAMS      max simultaneous live-update connections (default 20 local / 200 public)
 */
export function resolveRuntime(env, cfg, root) {
  const errors = [], warnings = [];
  const mode = String(env.PAYPER_MODE || 'local').trim().toLowerCase();
  if (!['local', 'public'].includes(mode)) errors.push(`PAYPER_MODE must be "local" or "public" (got "${env.PAYPER_MODE}").`);
  const pub = mode === 'public';
  // port
  const portRaw = env.PORT ?? (pub ? '8080' : String(cfg.port));
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push(`PORT must be a whole number 1–65535 (got "${portRaw}").`);
  // bind address
  let bindHost = '127.0.0.1';
  if (pub) bindHost = (env.BIND_HOST || '0.0.0.0').trim();
  else if (env.BIND_HOST && !['127.0.0.1', 'localhost'].includes(env.BIND_HOST.trim())) errors.push('BIND_HOST can only be changed in public mode (PAYPER_MODE=public). The local desk always listens on 127.0.0.1 so nobody else on your network can control it.');
  // origin + hosts
  let publicOrigin = null; const trustedHosts = new Set();
  if (pub) {
    const originRaw = String(env.PUBLIC_ORIGIN || '').trim() || String(env.RENDER_EXTERNAL_URL || '').trim();
    if (!originRaw) errors.push('Public mode needs PUBLIC_ORIGIN, the exact address visitors type, for example https://payper.example.com');
    else { const o = parseOrigin(originRaw); if (o.error) errors.push(o.error); else { publicOrigin = o.origin; trustedHosts.add(o.host); } }
    const rh = String(env.RENDER_EXTERNAL_HOSTNAME || '').trim().toLowerCase();
    if (rh && hostRe.test(rh)) trustedHosts.add(rh);
    for (const h of String(env.TRUSTED_HOSTS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) {
      if (h.includes('*')) errors.push('TRUSTED_HOSTS must list exact host names; wildcards are not allowed.');
      else if (!hostRe.test(h)) errors.push(`TRUSTED_HOSTS entry "${h}" is not a host name (use e.g. payper.example.com or payper.example.com:8443, no https://).`);
      else trustedHosts.add(h);
    }
  }
  // data directory
  const dataDir = path.resolve(root, env.DATA_DIR ? String(env.DATA_DIR) : 'data');
  if (pub && !env.DATA_DIR) warnings.push('DATA_DIR is not set: the shared paper account is stored inside the app folder. On most hosts that disk is wiped on every redeploy/restart; attach a persistent volume and set DATA_DIR to it if the paper record should survive.');
  // token contract address
  const fromEnv = env.TOKEN_MINT !== undefined && String(env.TOKEN_MINT).trim() !== '';
  const ca = checkContractAddress(fromEnv ? env.TOKEN_MINT : cfg.contractAddress);
  if (!ca.ok) errors.push(`${fromEnv ? 'TOKEN_MINT' : 'contractAddress in paper.config.json'}: ${ca.error}`);
  // streams
  const ms = Number(env.MAX_STREAMS ?? (pub ? 200 : 20));
  if (!Number.isInteger(ms) || ms < 1 || ms > 5000) errors.push('MAX_STREAMS must be a whole number 1–5000.');
  return { errors, warnings, mode, readOnly: pub, port, bindHost, publicOrigin, trustedHosts, dataDir, maxStreams: ms,
    tokenMint: ca.ok ? ca.mint : null, tokenSource: ca.ok && ca.mint ? (fromEnv ? 'TOKEN_MINT' : 'paper.config.json') : null };
}
