// Crash-safe JSON persistence: write to a temp file, flush it to disk, then atomically
// rename over the real file (the previous good copy is kept as .bak). On start, a corrupt
// file is moved aside (never deleted) and the backup is tried.
import fs from 'node:fs';
import path from 'node:path';

export function saveJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp'; const data = JSON.stringify(obj);
  const fd = fs.openSync(tmp, 'w'); try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (fs.existsSync(file)) { try { fs.copyFileSync(file, file + '.bak'); } catch {} }
  // Windows: rename over an existing file can fail briefly if an antivirus holds it; retry.
  for (let i = 0; ; i++) { try { fs.renameSync(tmp, file); break; } catch (e) { if (i >= 4) throw e; const until = Date.now() + 50 * (i + 1); while (Date.now() < until) {} } }
}

export function loadJson(file, validate = (x) => !!x && typeof x === 'object') {
  const warnings = [];
  for (const f of [file, file + '.bak']) {
    if (!fs.existsSync(f)) continue;
    try { const v = JSON.parse(fs.readFileSync(f, 'utf8')); if (validate(v)) { if (f !== file) warnings.push(`Main state file was unreadable; restored from ${path.basename(f)}.`); return { value: v, warnings }; } throw new Error('failed validation'); }
    catch (e) { const aside = `${f}.corrupt-${Date.now()}`; try { fs.renameSync(f, aside); } catch {} warnings.push(`${path.basename(f)} could not be read (${e.message}); moved to ${path.basename(aside)}.`); }
  }
  return { value: null, warnings };
}
