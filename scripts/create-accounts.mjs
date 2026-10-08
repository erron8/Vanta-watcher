import { randomBytes, scryptSync } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const password = () => randomBytes(24).toString('base64url');
const hash = value => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 32).toString('hex')}`;
};
const admin = password(), guest = password();
const env = [
  'VANTA_DOMAIN=vanta.example.com',
  `POSTGRES_PASSWORD=${password()}`,
  `VANTA_SESSION_SECRET=${randomBytes(48).toString('base64url')}`,
  `VANTA_ADMIN_PASSWORD_HASH=${hash(admin)}`,
  `VANTA_GUEST_PASSWORD_HASH=${hash(guest)}`,
  '',
].join('\n');
await writeFile('.env', env, { flag: 'wx', mode: 0o600 });
await writeFile('.vanta-initial-credentials', `admin: ${admin}\nguest: ${guest}\n`, { flag: 'wx', mode: 0o600 });
process.stdout.write('Created private .env and .vanta-initial-credentials files. Set VANTA_DOMAIN in .env before deployment.\n');
