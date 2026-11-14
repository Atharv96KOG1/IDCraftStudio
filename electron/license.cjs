// Licence checking for IDCraft Studio (runs in the Electron main process).
//
// A licence key is a payload signed with the vendor's Ed25519 PRIVATE key.
// The app only contains the PUBLIC key, so keys cannot be forged from the app.
// Keys can be locked to one PC (machine ID) and can have an expiry date.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Always the real Windows reg.exe, never one found via the current folder or PATH.
const REG = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');

const TRIAL_DAYS = 15;
const DAY = 86400000;
const EPOCH = Date.UTC(2024, 0, 1);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid typos
const PREFIX = 'IDCS';

// ------------------------------------------------------------ base32 (custom alphabet)

function encode32(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function decode32(str) {
  const clean = str.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('bad character');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ------------------------------------------------------------ machine ID

let cachedMachine = null;
function rawMachineId() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync(REG, ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
      if (m) return m[1];
    } else if (process.platform === 'darwin') {
      const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8' });
      const m = out.match(/"IOPlatformUUID" = "([^"]+)"/);
      if (m) return m[1];
    } else if (fs.existsSync('/etc/machine-id')) {
      return fs.readFileSync('/etc/machine-id', 'utf8').trim();
    }
  } catch {
    /* fall through */
  }
  return `${os.hostname()}|${os.cpus()[0]?.model}|${os.totalmem()}`;
}

/** 10-byte machine fingerprint (a hash, never the raw Windows ID). */
function machineHash() {
  if (!cachedMachine) {
    cachedMachine = crypto.createHash('sha256').update(`idcraft-studio:${rawMachineId()}`).digest().subarray(0, 10);
  }
  return cachedMachine;
}

/** Machine ID shown to the customer: 16 characters, e.g. "K7QM-X2PA-9RTD-H4WB". */
function machineId() {
  return encode32(machineHash()).match(/.{4}/g).join('-');
}

/** Converts a Machine ID typed by the vendor back into the 10-byte hash. */
function machineIdToBytes(id) {
  const b = decode32(id);
  if (b.length !== 10) throw new Error('Machine ID must be 16 characters, like K7QM-X2PA-9RTD-H4WB');
  return b;
}

// ------------------------------------------------------------ key parsing

let publicKeyObj = null;
function publicKey() {
  if (!publicKeyObj) {
    publicKeyObj = crypto.createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(require('./license-public.cjs'), 'base64')]),
      format: 'der',
      type: 'spki',
    });
  }
  return publicKeyObj;
}

/**
 * Payload layout:
 *  [0] version=1  [1] edition  [2..3] issued day  [4..5] expiry day (0 = never)
 *  [6..15] machine hash (all zero = any PC)  [16] name length  [17..] name (UTF-8)
 * followed by a 64-byte Ed25519 signature.
 */
function parseKey(key) {
  const text = String(key || '').trim();
  const body = text.toUpperCase().startsWith(PREFIX) ? text.slice(PREFIX.length) : text;
  let buf;
  try {
    buf = decode32(body);
  } catch {
    return { ok: false, error: 'This licence key is not valid. Please check it was copied completely.' };
  }
  if (buf.length < 17 + 64) return { ok: false, error: 'This licence key is incomplete.' };
  const nameLen = buf[16];
  const payloadLen = 17 + nameLen;
  if (buf.length < payloadLen + 64) return { ok: false, error: 'This licence key is incomplete.' };
  const payload = buf.subarray(0, payloadLen);
  const sig = buf.subarray(payloadLen, payloadLen + 64);
  let valid = false;
  try {
    valid = crypto.verify(null, payload, publicKey(), sig);
  } catch {
    valid = false;
  }
  if (!valid || payload[0] !== 1) return { ok: false, error: 'This licence key is not valid.' };
  const issued = EPOCH + payload.readUInt16BE(2) * DAY;
  const expiryDay = payload.readUInt16BE(4);
  const machine = payload.subarray(6, 16);
  const anyMachine = machine.every((b) => b === 0);
  return {
    ok: true,
    edition: payload[1] === 2 ? 'Business' : 'Standard',
    issued,
    expires: expiryDay ? EPOCH + expiryDay * DAY : null,
    anyMachine,
    machineMatches: anyMachine || machine.equals(machineHash()),
    licensee: payload.subarray(17, payloadLen).toString('utf8'),
  };
}

// ------------------------------------------------------------ trial & storage

function regRead(name) {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync(REG, ['query', 'HKCU\\Software\\IDCraftStudio', '/v', name], { encoding: 'utf8', windowsHide: true });
    return out.match(new RegExp(`${name}\\s+REG_SZ\\s+(\\S+)`))?.[1] ?? null;
  } catch {
    return null;
  }
}
function regWrite(name, value) {
  if (process.platform !== 'win32') return;
  try {
    execFileSync(REG, ['add', 'HKCU\\Software\\IDCraftStudio', '/v', name, '/t', 'REG_SZ', '/d', String(value), '/f'], { windowsHide: true });
  } catch {
    /* ignore */
  }
}

function sealKey() {
  return crypto.createHash('sha256').update(Buffer.concat([Buffer.from('idcraft-state-v1'), machineHash()])).digest();
}
function seal(obj) {
  const json = JSON.stringify(obj);
  const mac = crypto.createHmac('sha256', sealKey()).update(json).digest('hex');
  return Buffer.from(JSON.stringify({ json, mac })).toString('base64');
}
function unseal(text) {
  try {
    const { json, mac } = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
    const expect = crypto.createHmac('sha256', sealKey()).update(json).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expect, 'hex'))) return { tampered: true };
    return JSON.parse(json);
  } catch {
    return { tampered: true };
  }
}

// Extra copies of the trial start date in places an uninstall does not remove,
// so deleting the app (or its data folder) and reinstalling does not restart the trial.
const REG_SHADOW = 'HKCU\\Software\\Classes\\IDCraftStudio.Template\\Shell';
function regShadowRead() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync(REG, ['query', REG_SHADOW, '/v', 'State'], { encoding: 'utf8', windowsHide: true });
    return out.match(/State\s+REG_SZ\s+(\S+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}
function regShadowWrite(value) {
  if (process.platform !== 'win32') return;
  try {
    execFileSync(REG, ['add', REG_SHADOW, '/v', 'State', '/t', 'REG_SZ', '/d', value, '/f'], { windowsHide: true });
  } catch {
    /* ignore */
  }
}
function shadowFiles() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const shared = process.env.ProgramData || 'C:\\ProgramData';
    return [path.join(local, 'ICSRuntime', 'cache.bin'), path.join(shared, 'ICSRuntime', 'cache.bin')];
  }
  if (process.platform === 'darwin') {
    return [path.join(home, 'Library', 'Preferences', '.com.idcraft.runtime'), path.join(home, 'Library', 'Caches', '.ics-runtime.bin')];
  }
  return [path.join(home, '.config', '.ics-runtime.bin')];
}
/** Reads every shadow copy. Returns the earliest start date, or 'tampered' if any copy was edited. */
function readShadows() {
  const values = [regShadowRead()];
  for (const f of shadowFiles()) {
    try {
      values.push(fs.readFileSync(f, 'utf8'));
    } catch {
      values.push(null);
    }
  }
  let first = null;
  let tampered = false;
  for (const v of values) {
    if (!v) continue;
    const st = unseal(v);
    if (st.tampered || !Number.isFinite(st.first)) tampered = true;
    else first = first === null ? st.first : Math.min(first, st.first);
  }
  return { first, tampered };
}
function writeShadows(first) {
  const value = seal({ first });
  regShadowWrite(value);
  for (const f of shadowFiles()) {
    try {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, value);
    } catch {
      /* ignore: some folders may not be writable */
    }
  }
}

class LicenseManager {
  constructor(userDataDir) {
    this.dir = userDataDir;
    this.stateFile = path.join(userDataDir, 'state.dat');
    this.keyFile = path.join(userDataDir, 'license.key');
  }

  readState() {
    let state = null;
    if (fs.existsSync(this.stateFile)) state = unseal(fs.readFileSync(this.stateFile, 'utf8'));
    const regFirst = Number(regRead('Installed')) || null;
    const shadow = readShadows();
    if (state?.tampered || shadow.tampered) return { tampered: true };
    if (!state) state = { first: Date.now(), last: Date.now() };
    for (const f of [regFirst, shadow.first]) if (f && f < state.first) state.first = f;
    return state;
  }

  writeState(state) {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      // Write-then-rename so a power cut never leaves a half-written file.
      const tmp = `${this.stateFile}.tmp`;
      fs.writeFileSync(tmp, seal(state));
      fs.renameSync(tmp, this.stateFile);
    } catch {
      /* ignore */
    }
    if (!regRead('Installed')) regWrite('Installed', state.first);
    const shadow = readShadows();
    if (shadow.first !== state.first) writeShadows(Math.min(state.first, shadow.first ?? state.first));
  }

  /** A valid licence key on this PC wins over everything else. */
  keyStatus(now) {
    if (!fs.existsSync(this.keyFile)) return null;
    const lic = parseKey(fs.readFileSync(this.keyFile, 'utf8'));
    if (!lic.ok || !lic.machineMatches) return null;
    if (lic.expires && now >= lic.expires) return { expired: true, licensee: lic.licensee };
    return {
      state: 'licensed',
      licensee: lic.licensee,
      edition: lic.edition,
      expires: lic.expires,
      daysLeft: lic.expires ? Math.ceil((lic.expires - now) / DAY) : null,
    };
  }

  status() {
    const now = Date.now();
    const base = { machineId: machineId(), trialDays: TRIAL_DAYS };
    const state = this.readState();
    const key = this.keyStatus(now);

    if (key && !key.expired) {
      // Clock rollback only matters for keys that expire.
      if (key.expires && !state.tampered && now < state.last - DAY) {
        return { ...base, state: 'clock', reason: 'Your computer clock is set in the past. Correct the date and time, then restart.' };
      }
      this.writeState({ first: state.tampered ? now : state.first, last: Math.max(state.tampered ? 0 : state.last, now) });
      return { ...base, ...key };
    }
    if (key?.expired) return { ...base, state: 'expired', reason: `Your licence for ${key.licensee} expired. Please renew it.` };

    if (state.tampered) {
      // Damaged or edited trial data: end the trial (re-sealed so a later key activation works normally).
      this.writeState({ first: now - (TRIAL_DAYS + 1) * DAY, last: now });
      return { ...base, state: 'expired', reason: 'Your free trial has ended. Enter a licence key to continue.' };
    }
    if (now < state.last - DAY) return { ...base, state: 'clock', reason: 'Your computer clock is set in the past. Correct the date and time, then restart.' };
    this.writeState({ first: state.first, last: Math.max(state.last, now) });
    const daysLeft = TRIAL_DAYS - Math.floor(Math.max(0, now - state.first) / DAY);
    if (daysLeft > 0) return { ...base, state: 'trial', daysLeft };
    return { ...base, state: 'expired', reason: 'Your free trial has ended. Enter a licence key to continue.' };
  }

  activate(key) {
    const lic = parseKey(key);
    if (!lic.ok) return { ok: false, error: lic.error };
    if (!lic.machineMatches) return { ok: false, error: `This key is for a different computer. Your Machine ID is ${machineId()}.` };
    if (lic.expires && Date.now() >= lic.expires) return { ok: false, error: 'This licence key has expired.' };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.keyFile, String(key).trim());
    const status = this.status();
    if (status.state !== 'licensed') return { ok: false, error: status.reason || 'Activation failed. Please contact your seller.' };
    return { ok: true, status };
  }

  deactivate() {
    try {
      fs.unlinkSync(this.keyFile);
    } catch {
      /* ignore */
    }
    return this.status();
  }
}

module.exports = { LicenseManager, parseKey, machineId, machineIdToBytes, encode32, decode32, EPOCH, DAY, PREFIX };
