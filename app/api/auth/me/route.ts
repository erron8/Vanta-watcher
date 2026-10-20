import { authenticateRequest } from '@/lib/authorize';

export async function GET(request: Request) {
  const identity = await authenticateRequest(request);
  if (!identity) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return Response.json(identity, { headers: { 'Cache-Control': 'no-store' } });
}
