import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC = ['/login', '/register'];
const STAFF_ONLY = ['/ops', '/analytics'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get('skydesk_session')?.value;
  let session = null;
  if (token && process.env.JWT_SECRET) {
    try {
      session = (await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET))).payload;
    } catch { /* invalid or expired */ }
  }
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (STAFF_ONLY.some((p) => pathname.startsWith(p)) && session.role !== 'ADMIN') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// API routes do their own checks via route(); skip static files and API here.
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
