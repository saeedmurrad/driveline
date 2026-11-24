/**
 * Makes the key pair that signs DriveLine's notifications (VAPID).
 *
 *   node scripts/make-vapid-keys.mjs <private-key-file>
 *
 * Writes the private key (JWK JSON) to the file you name, for
 * `wrangler secret put VAPID_PRIVATE_JWK < file`, and prints only the public key,
 * which goes in wrangler.toml (VAPID_PUBLIC_KEY) and the site's environment files.
 * The private key is never printed. Making a new pair signs out every device that
 * has alerts turned on, so only do it once.
 */
import { writeFileSync, existsSync } from 'node:fs';
const out = process.argv[2];
if (!out) { console.error('Give a file to write the private key to.'); process.exit(1); }
if (existsSync(out)) { console.error(`${out} already exists; not overwriting it.`); process.exit(1); }
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
writeFileSync(out, JSON.stringify(jwk), { mode: 0o600 });
console.log(Buffer.from(raw).toString('base64url'));
