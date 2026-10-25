# Vanta Watcher

Vanta is a private workspace for researching Solana liquidity-provider wallets. It combines wallet scans, performance calendars, position research, and personal bookmarks in one app.

This repository is shared with invited collaborators. Access to the running app is managed separately; ask the maintainer for an account if you need one.

## What it does

- Imports activity CSV files and scans unique wallets.
- Filters wallet results by investment size, active days, daily losses, and monthly profit.
- Shows daily P&L in USD or SOL and loads position details when requested.
- Keeps each account's saved scans and analyzed wallet labels separate. Bookmarks stay in that browser's storage for the signed-in account.
- Lets visitors request access with a Telegram handle; only the admin can view requests and mark them done.

When upgrading an existing installation, the latest previously shared scan and automatic labels are copied to the admin account. Other accounts start with their own empty scan and label history; browser bookmarks are unaffected.

## Development

Use Node.js 22.13 or newer. Install dependencies with `npm ci`, create a local `.env` from `.env.example`, and provide your own development configuration. Ask the maintainer for access to shared development services through a private channel. Then run:

```sh
npm run db:migrate
npm run dev
```

Before opening a pull request, run:

```sh
npm run lint
node --test lib/*.test.mjs
npm run build
```

Never commit credentials, environment files, wallet exports, database backups, or user data. Do not paste them into issues or pull requests. Production configuration and deployment access are managed outside this repository.

## License

MIT; see [LICENSE](LICENSE).
