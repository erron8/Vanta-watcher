#!/bin/sh
set -eu

if [ "${VERCEL_ENV:-}" = preview ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "Building preview without a database. Database-backed features require a preview DATABASE_URL."
else
  npm run db:migrate
fi

exec npm run build
