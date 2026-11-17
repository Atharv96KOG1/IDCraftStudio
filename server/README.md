# Trial server

Remembers, per computer, when the 15-day trial started, so reinstalling Windows or the app does not give a new trial.
The app sends only a SHA-256 hash of the computer's hardware ID. Replies are signed with Ed25519; the app holds the public key.

One-time setup (free Cloudflare account):

```bash
cd server
npx wrangler@3 login                      # opens the browser
npx wrangler@3 kv namespace create TRIALS # put the printed id into wrangler.toml
node ../scripts/server-keys.mjs --raw | npx wrangler@3 secret put SIGNING_KEY   # makes the signing key and stores it
npx wrangler@3 deploy                     # prints the https://idcraft-trial.<you>.workers.dev URL
```

Put the URL in `electron/license-server.cjs`, then build the app.

The signing private key is kept in `~/.idcraft-license/server-private.pem` (never in this repo). Back it up with `private.pem`.
