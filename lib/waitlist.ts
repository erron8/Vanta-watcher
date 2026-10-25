export function normalizeTelegramHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const handle = value.trim().toLowerCase();
  const normalized = handle.startsWith('@') ? handle : `@${handle}`;
  return /^@[a-z0-9_]{5,32}$/.test(normalized) ? normalized : null;
}
