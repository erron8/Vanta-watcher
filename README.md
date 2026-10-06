# Vanta Watcher

A Meteora DLMM wallet screener for Solana. Import an activity CSV, scan each unique wallet once, and compare performance from the saved results. The dashboard includes a daily P&L calendar, investment and risk filters, position history on demand, wallet labels, and a named bookmark list.

Live Site: [Vanta Wallet Screener](https://vanta-wallet-screener.void-space-4951.chatgpt.site/) (access is controlled by the Site owner).

## What it does

- Extracts unique Solana wallet addresses from an activity CSV, names the primary liquidity pool from its token mints, and fetches Meteora calendar and 30-day performance data.
- Saves USD and native SOL results in Cloudflare D1 so switching currency, sorting, and filtering do not refetch every wallet. Older scans may need one refresh for SOL 30-day metrics.
- Filters by average invested, active days, maximum daily loss, and minimum or maximum monthly profit; sorts the wallet table by each metric.
- Shows daily P&L and loads closed-position details only when a calendar date is selected. A separate position finder can narrow candidate wallets using TVL, P&L, holding time, pair, and close date.
- Stores bookmarks and optional wallet names in D1. Wallet labels use the latest 30 closed positions: **Quote only** for a majority of SOL/USDC-only deposits, **Multi** for average hold over one hour, and **Degen** for average hold under 15 minutes with no more than 30 bins.

The app uses React 19, Vinext/Next.js, Cloudflare Workers, D1, Tailwind CSS, and Drizzle migrations. Performance data comes from Meteora's portfolio and DLMM APIs; wallet links open Fabriq.

## Run locally

Requires Node.js 22.13 or newer and npm. No API key is needed for the Meteora endpoints currently used by the app.

```sh
npm ci
npm run build
```

The build creates `dist/server/wrangler.json`. Apply the D1 migrations to the local Wrangler database in order:

```sh
for migration in drizzle/0*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$migration"
done
```

Then run the built Worker:

```sh
npm start
```

Open the local URL printed by Wrangler. For hot reloading during development, use `npm run dev` after installing dependencies and applying migrations. Local scan and bookmark data lives in the ignored `.wrangler/` directory.

## Project notes

- `app/` contains the pages, UI, and API routes.
- `db/schema.ts` and `drizzle/` define the D1 schema and migrations.
- `lib/` contains the Meteora history, wallet-label, and address logic.
- `.openai/hosting.json` identifies the original hosted Site and its D1 binding; its project ID is not a credential. Use your own Site project ID if you deploy a fork.
- This repository contains source code, not the live D1 database or imported CSV files. Generated wallet data, CSV exports, local databases, environment files, and credentials are ignored.

## Checks

```sh
npm run lint
node --test lib/*.test.mjs
npm run build
```

## License

MIT; see [LICENSE](LICENSE).
