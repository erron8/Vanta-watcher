import { SOL_MINT, USDC_MINT, shortToken } from "@/lib/pool-label";

const isMint = (value: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
const known = new Map([[SOL_MINT, "SOL"], [USDC_MINT, "USDC"]]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = url.searchParams.get("base") || "", quote = url.searchParams.get("quote") || "";
  if (!isMint(base) || !isMint(quote) || base === quote) return Response.json({ error: "Invalid token pair." }, { status: 400 });
  const symbols = new Map(known);
  if (!symbols.has(base) || !symbols.has(quote)) {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${base},${quote}`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json() as { pairs?: { chainId?: string; baseToken?: { address?: string; symbol?: string }; quoteToken?: { address?: string; symbol?: string } }[] };
        for (const pair of data.pairs || []) {
          if (pair.chainId !== "solana") continue;
          for (const token of [pair.baseToken, pair.quoteToken]) {
            if (token?.address && [base, quote].includes(token.address) && token.symbol) {
              const symbol = token.symbol.trim().slice(0, 20);
              if (symbol) symbols.set(token.address, symbol);
            }
          }
        }
      }
    } catch { /* Fall back to a shortened mint when metadata is unavailable. */ }
  }
  const label = `${symbols.get(base) || shortToken(base)}-${symbols.get(quote) || shortToken(quote)}`;
  return Response.json({ label }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
