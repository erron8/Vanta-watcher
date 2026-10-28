import { NextResponse, type NextRequest } from 'next/server';
import { readSession, sessionCookie } from '@/lib/access';

export function proxy(request: NextRequest) {
  if (readSession(request.cookies.get(sessionCookie)?.value)) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/screener/:path*', '/bookmarks/:path*', '/admin/:path*', '/profile/:path*', '/api/profile/:path*', '/api/admin/:path*', '/api/bookmarks/:path*', '/api/scans/:path*', '/api/labels/:path*', '/api/wallet/:path*', '/api/calendar/:path*', '/api/history/:path*', '/api/pool-label/:path*', '/api/pool-search/:path*'],
};
