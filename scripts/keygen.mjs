#!/usr/bin/env node
// IDCraft Studio licence key generator — for the vendor only. Never ship this
// file's private key with the app.
//
//   node scripts/keygen.mjs init
//       Creates your signing key pair (once). Private key: ~/.idcraft-license/private.pem
//       BACK THIS FOLDER UP. If you lose it you cannot issue keys for existing installs.
//
//   node scripts/keygen.mjs issue --name "Sunrise School" --machine K7QM-X2PA-9RTD-H4WB [--days 365] [--business]
//   node scripts/keygen.mjs issue --name "Sunrise School" --any-pc [--days 365]
//       Prints a licence key. --machine locks it to one PC (customer sees the
//       Machine ID on the activation screen). --any-pc works on every PC.
//
//   node scripts/keygen.mjs verify <KEY>
//       Shows what a key contains.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lic = require(path.join(ROOT, 'electron', 'license.cjs'));
const DIR = process.env.IDCRAFT_LICENSE_DIR || path.join(os.homedir(), '.idcraft-license');
const PRIV = path.join(DIR, 'private.pem');
const LOG = path.join(DIR, 'issued.csv');
const PUB_MODULE = path.join(ROOT, 'electron', 'license-public.cjs');

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(`--${name}`);

function die(msg) {
  console.error(`\n  ✖ ${msg}\n`);
  process.exit(1);
}

if (cmd === 'init') {
  if (fs.existsSync(PRIV) && !flag('force')) die(`A key pair already exists at ${PRIV}. Use --force only if you really want a NEW pair (old keys stop working in new builds).`);
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(12).toString('base64');
  fs.writeFileSync(PUB_MODULE, `// Public key used to verify licence keys. Safe to ship.\nmodule.exports = '${raw}';\n`);
  console.log(`\n  ✔ Private key saved to ${PRIV}  (keep it secret, back it up)\n  ✔ Public key written to electron/license-public.cjs\n`);
  process.exit(0);
}

if (cmd === 'issue') {
  if (!fs.existsSync(PRIV)) die('No private key found. Run: node scripts/keygen.mjs init');
  const name = opt('name');
  if (!name) die('Give the customer name with --name "..."');
  const nameBuf = Buffer.from(name, 'utf8');
  if (nameBuf.length > 60) die('Name is too long (max 60 bytes).');
  let machine = Buffer.alloc(10);
  if (opt('machine')) {
    try {
      machine = lic.machineIdToBytes(opt('machine'));
    } catch (e) {
      die(e.message);
    }
  } else if (!flag('any-pc')) {
    die('Add --machine <MACHINE-ID> (from the customer\'s activation screen) or --any-pc');
  }
  const days = opt('days') ? Number(opt('days')) : 0;
  if (Number.isNaN(days) || days < 0) die('--days must be a number');
  const today = Math.floor((Date.now() - lic.EPOCH) / lic.DAY);
  const payload = Buffer.alloc(17 + nameBuf.length);
  payload[0] = 1;
  payload[1] = flag('business') ? 2 : 1;
  payload.writeUInt16BE(today, 2);
  payload.writeUInt16BE(days ? today + days : 0, 4);
  machine.copy(payload, 6);
  payload[16] = nameBuf.length;
  nameBuf.copy(payload, 17);
  const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIV));
  const sig = crypto.sign(null, payload, privateKey);
  const body = lic.encode32(Buffer.concat([payload, sig]));
  const key = `${lic.PREFIX}-${body.match(/.{1,5}/g).join('-')}`;
  const check = lic.parseKey(key);
  if (!check.ok) die('Self-check failed: the public key in electron/license-public.cjs does not match your private key.');
  fs.appendFileSync(LOG, `${new Date().toISOString()},"${name.replace(/"/g, '""')}",${opt('machine') ?? 'ANY'},${days || 'never'}\n`);
  console.log(`\nLicence for: ${name}\nPC: ${opt('machine') ?? 'any PC'}\nExpires: ${days ? new Date(lic.EPOCH + (today + days) * lic.DAY).toDateString() : 'never'}\n\n${key}\n`);
  process.exit(0);
}

if (cmd === 'verify') {
  const r = lic.parseKey(args.slice(1).join(''));
  console.log(r);
  process.exit(r.ok ? 0 : 1);
}

console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
