import { readRequestSession } from '@/lib/access';

export async function GET(request: Request) {
  const account = readRequestSession(request);
  if (!account) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return Response.json({ account }, { headers: { 'Cache-Control': 'no-store' } });
}
