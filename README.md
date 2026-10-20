# Vanta Watcher

Vanta is a Meteora DLMM wallet screener for Solana. The homepage is public. The screener, bookmarks, and their data APIs require sign-in.

**Live site:** [vanta-walletscreener.vercel.app](https://vanta-walletscreener.vercel.app/). Open the [screener](https://vanta-walletscreener.vercel.app/screener) or [bookmarks](https://vanta-walletscreener.vercel.app/bookmarks) and sign in to use them.

Import a Solscan activity CSV to scan its unique wallets, then filter the saved results by average invested, active days, largest daily loss, and monthly profit. Vanta shows daily USD/SOL P&L calendars, loads position history when requested, and keeps named and categorized bookmarks. It uses Meteora portfolio and DLMM endpoints; no paid API key is needed for the current features.

## Accounts and data

Two built-in accounts are configured: `admin` and `guest`. After signing in as `admin`, open the **Admin** tab beside Bookmarks to create individual accounts for friends. The admin can rename, reset passwords, disable, re-enable, and delete these managed accounts. The circular profile icon in the header opens **Profile** and **Logout**. On Profile, the admin can change their own username and password after entering their current password; guest and managed users can only view their username. The admin's first successful profile change stores its credentials in PostgreSQL and supersedes the initial `VANTA_ADMIN_PASSWORD_HASH`; old admin sessions are revoked. All signed-in users can use the screener and bookmarks and edit shared scans and wallet profiles; only the admin can manage accounts. Passwords are stored as salted scrypt hashes. Session cookies are HTTP-only and expire after seven days. Disabling, editing, or deleting a managed account revokes its existing sessions.

Scans, wallet metrics, wallet profiles, and managed user accounts are stored in PostgreSQL. Bookmarks, names, and custom categories are stored in each browser's `localStorage`, separately for each sign-in. They do not sync across browsers or devices, and clearing site data removes them. Browser storage is also tied to the exact hostname: bookmarks saved on an older Vanta URL will not automatically appear on the current live site. The old shared bookmark API is disabled; existing shared database bookmarks are not copied into any user's browser. The previous hosted Site's Cloudflare D1 database is separate. A fresh VPS deployment starts with an empty database unless that data is exported and migrated. Do not commit CSV exports, database dumps, `.env`, or `.vanta-initial-credentials`.

## Current deployment

Vanta is hosted on Vercel at [vanta-walletscreener.vercel.app](https://vanta-walletscreener.vercel.app/). The project needs a PostgreSQL `DATABASE_URL`, a 32+ character `VANTA_SESSION_SECRET`, and salted scrypt hashes in `VANTA_ADMIN_PASSWORD_HASH` and `VANTA_GUEST_PASSWORD_HASH`. The admin hash is a bootstrap credential only; after a change on Profile, the database record becomes authoritative. Keep these values in private Vercel environment variables, never in Git. Vercel runs the idempotent database migration before each build. The public homepage is at `/`; `/screener`, `/bookmarks`, and `/profile` require sign-in, and `/admin` additionally requires the admin account.

The [VPS deployment guide](DEPLOY_VPS.md) remains available if you later move the app to your own server.

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

The previous hosted Site remains a separate deployment until it is retired. Restrict or remove it after a VPS cutover if the screener must only be reachable through this login gate.

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
