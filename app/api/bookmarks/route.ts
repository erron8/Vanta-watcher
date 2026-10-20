// Retired: bookmarks now stay in each browser's localStorage. Never expose
// the earlier shared database rows to users of the new per-browser interface.
export function GET() {
  return Response.json({ error: 'Bookmarks are stored in your browser.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
export const POST = GET;
export const PATCH = GET;
export const DELETE = GET;
