// Creates the Ed25519 key the trial server signs its replies with.
// Private key: ~/.idcraft-license/server-private.pem (keep secret, back up).
// Public key: written into electron/license-server.cjs (ships with the app).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW = process.argv.includes('--raw'); // print only the secret (for piping into wrangler)
const log = (m) => (RAW ? console.error(m) : console.log(m));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.env.IDCRAFT_LICENSE_DIR || path.join(os.homedir(), '.idcraft-license');
const PEM = path.join(DIR, 'server-private.pem');
const CFG = path.join(ROOT, 'electron', 'license-server.cjs');

fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
let priv;
if (fs.existsSync(PEM)) priv = crypto.createPrivateKey(fs.readFileSync(PEM));
else {
  priv = crypto.generateKeyPairSync('ed25519').privateKey;
  fs.writeFileSync(PEM, priv.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  log(`New server key saved to ${PEM}`);
}
const pub = crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');
let cfg = fs.readFileSync(CFG, 'utf8');
cfg = cfg.replace(/publicKey: '[^']*'/, `publicKey: '${pub}'`);
fs.writeFileSync(CFG, cfg);
log('Public key written to electron/license-server.cjs');
if (!RAW) console.log('\nValue for "wrangler secret put SIGNING_KEY" (keep it secret):\n');
console.log(priv.export({ type: 'pkcs8', format: 'der' }).toString('base64'));
