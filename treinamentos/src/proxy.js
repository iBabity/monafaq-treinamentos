import { NextResponse } from 'next/server';
import { trainingReturnPath } from './utils/trainingLinks';

const SESSION_COOKIE = 'mnls_training_session';
const PUBLIC_API_PATHS = new Set(['/api/login', '/api/logout', '/api/one/session']);
const ADMIN_PATH_PREFIXES = ['/api/admin', '/api/users'];
const ADMIN_WRITE_PREFIXES = ['/api/categories', '/api/lessons', '/api/tracks', '/api/assigned-videos'];

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function decodePayload(value) {
  const bytes = base64UrlToBytes(value);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const secret = process.env.TRAINING_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') return null;

  const [payload, signature] = token.split('.');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret || 'dev-only-training-session-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(signature || ''),
    new TextEncoder().encode(payload)
  );
  if (!valid) return null;

  const session = decodePayload(payload);
  if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

function requiresAdmin(pathname, method) {
  if (pathname === '/api/lessons/views' && method === 'POST') return false;
  if (ADMIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (method !== 'GET' && ADMIN_WRITE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/') && !PUBLIC_API_PATHS.has(pathname)) {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
    if (!session) {
      return NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401 });
    }
    if (requiresAdmin(pathname, request.method) && session.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }
  }

  if (pathname.startsWith('/platform') || pathname.startsWith('/material-gestores/')) {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', trainingReturnPath(pathname.startsWith('/material-gestores/') ? '/platform' : request.nextUrl.pathname + request.nextUrl.search));
      return NextResponse.redirect(loginUrl);
    }
    if (pathname === '/platform/assuntos' && session.role !== 'admin') {
      return NextResponse.redirect(new URL('/platform', request.url));
    }
    if (pathname.startsWith('/material-gestores/') && session.role !== 'admin') {
      return new NextResponse('Material original restrito.', {status:403});
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/platform/:path*', '/material-gestores/:path*'],
};
