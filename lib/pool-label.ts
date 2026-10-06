export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type PoolPair = { base: string; quote: string };

export function primaryPool(csv: string[][]): PoolPair | null {
  const headers = csv[0]?.map(header => header.trim().toLowerCase().replace(/[\s_-]/g, "")) || [];
  const first = headers.indexOf("token1"), second = headers.indexOf("token2"), action = headers.indexOf("action");
  if (first < 0 || second < 0) return null;
  const counts = new Map<string, { count: number; pair: PoolPair }>();
  for (const row of csv.slice(1)) {
    if (action >= 0 && !/(add|remove).*liq|liq.*(add|remove)/i.test(row[action] || "")) continue;
    const a = (row[first] || "").trim(), b = (row[second] || "").trim();
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join(":");
    const quote = a === USDC_MINT || b === USDC_MINT ? USDC_MINT
      : a === SOL_MINT || b === SOL_MINT ? SOL_MINT : b;
    const pair = { base: quote === a ? b : a, quote };
    const current = counts.get(key);
    counts.set(key, { pair: current?.pair || pair, count: (current?.count || 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.pair || null;
}

export function shortToken(token: string) {
  if (token === SOL_MINT) return "SOL";
  if (token === USDC_MINT) return "USDC";
  return token.length > 12 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token;
}
