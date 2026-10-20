# Vanta Watcher

Vanta is a Meteora DLMM wallet screener for Solana. The homepage is public. The screener, bookmarks, and their data APIs require sign-in.

For a new server, follow the [step-by-step VPS deployment guide](DEPLOY_VPS.md).

Import a Solscan activity CSV to scan its unique wallets, then filter the saved results by average invested, active days, largest daily loss, and monthly profit. Vanta shows daily USD/SOL P&L calendars, loads position history when requested, and keeps named and categorized bookmarks. It uses Meteora portfolio and DLMM endpoints; no paid API key is needed for the current features.

## Accounts and data

Two accounts are configured: `admin` and `guest`. Both can use the protected app and edit shared scans and wallet profiles. Passwords are stored as salted scrypt hashes. The signed session cookie is HTTP-only and expires after seven days. Sign-in attempts are rate-limited per IP; changing a password hash invalidates that account's existing sessions.

Scans, wallet metrics, and wallet profiles are stored in PostgreSQL. Bookmarks, names, and custom categories are stored in each browser's `localStorage`, separately for the `admin` and `guest` sign-ins. They do not sync across browsers or devices, and clearing site data removes them. The old shared bookmark API is disabled; existing shared database bookmarks are not copied into any user's browser. The previous hosted Site's Cloudflare D1 database is separate. A fresh VPS deployment starts with an empty database unless that data is exported and migrated. Do not commit CSV exports, database dumps, `.env`, or `.vanta-initial-credentials`.

## Deploy on a VPS

Requirements: a Linux VPS with Docker Engine and the Docker Compose plugin, a domain with an A/AAAA record pointing to the VPS, and inbound TCP 80/443 (plus UDP 443 if using HTTP/3). Caddy obtains and renews HTTPS certificates after DNS resolves and those ports are reachable.

```sh
git clone https://github.com/erron8/Vanta-watcher.git
cd Vanta-watcher
node scripts/create-accounts.mjs
# Edit VANTA_DOMAIN in .env to your real domain.
docker compose up -d --build
```

`create-accounts.mjs` creates an ignored `.env` with a random PostgreSQL password, session secret, and password hashes. It also writes the initial plaintext passwords to the ignored `.vanta-initial-credentials` file. Keep both files private. The Compose stack includes PostgreSQL, a schema migration job, the Next.js app, and Caddy. Only Caddy publishes ports. The PostgreSQL data and Caddy certificates live in persistent Docker volumes.

Check startup with `docker compose ps` and `docker compose logs --tail=100 app caddy`. Open `https://<your-domain>/` for the public homepage. Open `/screener` or `/bookmarks` to sign in. Back up the database with `docker compose exec -T db pg_dump -U vanta -d vanta > vanta-backup.sql`, and store that file privately.

To update, pull the new source and run `docker compose up -d --build`. The schema job reruns safely. For password rotation, generate a new salted scrypt hash, replace the relevant `VANTA_*_PASSWORD_HASH` in `.env`, then recreate the app container. For a new server, copy your private `.env` securely or generate fresh accounts.

The old Sites URL remains a separate deployment until it is retired. Restrict or remove it after the VPS cutover if the screener must only be reachable through this login gate.

## Local development

Requires Node.js 22.13+ and PostgreSQL. Copy `.env.example` to `.env` and set `DATABASE_URL`, a 32+ character `VANTA_SESSION_SECRET`, and salted scrypt hashes for both accounts. Alternatively, run `node scripts/create-accounts.mjs`, then add a local `DATABASE_URL` to `.env`.

```sh
npm ci
npm run db:migrate
npm run dev
```

`DATABASE_URL` is read by both the app and the migration script. The production Compose file sets it automatically for the app and runs the SQL migration using `psql`.

## Checks

```sh
npm run lint
node --test lib/*.test.mjs
npm run build
```

## License

MIT; see [LICENSE](LICENSE).
