// IDCraft Studio trial server (Cloudflare Worker).
//
// Remembers when the free trial started on each computer, keyed by a hash of
// the computer's hardware ID (which survives a Windows reinstall). Every reply
// is signed with an Ed25519 key, so the app can tell a real reply from a fake
// server. Stores nothing else about the user.
//
// Bindings (see wrangler.toml): KV namespace TRIALS, secret SIGNING_KEY
// (PKCS#8 Ed25519 private key, base64).

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

let keyPromise = null;
function signingKey(env) {
  keyPromise ??= crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(env.SIGNING_KEY), (c) => c.charCodeAt(0)),
    { name: 'Ed25519' },
    false,
    ['sign'],
  );
  return keyPromise;
}

async function signed(env, body) {
  const msg = `${body.hw}|${body.first}|${body.ts}`;
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, await signingKey(env), new TextEncoder().encode(msg));
  return json({ ...body, sig: btoa(String.fromCharCode(...new Uint8Array(sig))) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'idcraft-trial' });
    if (request.method !== 'POST' || url.pathname !== '/v1/trial') return json({ error: 'not found' }, 404);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad request' }, 400);
    }
    const hw = String(body.hw ?? '');
    if (!/^[a-f0-9]{64}$/.test(hw)) return json({ error: 'bad id' }, 400);
    const start = body.start === true;
    const now = Date.now();

    // First time this computer is seen: record the start only when the user asks to start the trial.
    const stored = await env.TRIALS.get(hw);
    let first = stored ? Number(stored) : null;
    if (!first && start) {
      first = now;
      await env.TRIALS.put(hw, String(first));
    }
    return signed(env, { hw, first: first ?? 0, ts: now });
  },
};
