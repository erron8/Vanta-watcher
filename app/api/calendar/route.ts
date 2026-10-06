export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const address = query.get("address") || "";
  const month = query.get("month") || "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return Response.json({ error: "Invalid wallet or month." }, { status: 400 });
  }
  const url = `https://portfolio.datapi.meteora.ag/chart/calendar/${address}?month=${month}`;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`Meteora returned ${response.status}.`);
      const data = await response.json() as { data_points?: unknown[] };
      if (!Array.isArray(data.data_points)) throw new Error("Calendar data is unavailable.");
      return Response.json({ days: data.data_points }, { headers: { "Cache-Control": "private, max-age=300" } });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load this month." }, { status: 502 });
  }
  return Response.json({ error: "Could not load this month." }, { status: 502 });
}
