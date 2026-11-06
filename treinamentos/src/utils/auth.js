import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'mnls_training_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function getSessionSecret() {
  const secret = process.env.TRAINING_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TRAINING_SESSION_SECRET is required in production');
  }
  return 'dev-only-training-session-secret';
}

function sign(payload) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const requestedExp = Date.parse(user.oneExpiresAt || user.expiresAt || '');
  const oneExp = Number.isNaN(requestedExp) ? null : Math.floor(requestedExp / 1000);
  const exp = oneExp ? Math.min(oneExp, now + SESSION_TTL_SECONDS) : now + SESSION_TTL_SECONDS;
  const payload = Buffer.from(
    JSON.stringify({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      trackId: user.track_id,
      authSource: user.authSource || user.auth_source || 'local',
      oneUserId: user.oneUserId || user.one_user_id || null,
      oneBusinessGroupId: user.oneBusinessGroupId || user.one_business_group_id || null,
      oneStoreId: user.oneStoreId || user.one_store_id || null,
      iat: now,
      exp,
    }),
    'utf8'
  ).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature || '');

  if (
    expectedBytes.length !== signatureBytes.length ||
    !crypto.timingSafeEqual(expectedBytes, signatureBytes)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function getRequestSession(request) {
  const cookieToken = request.cookies?.get(SESSION_COOKIE)?.value;
  const authHeader = request.headers?.get('authorization') || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  return verifySessionToken(cookieToken || bearerToken);
}

export function requireSession(request) {
  const session = getRequestSession(request);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Sessao expirada. Entre novamente.' }, { status: 401 }),
    };
  }
  return { session, response: null };
}

export function requireAdmin(request) {
  const auth = requireSession(request);
  if (auth.response) return auth;
  if (auth.session.role !== 'admin') {
    return {
      session: auth.session,
      response: NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 }),
    };
  }
  return auth;
}

export function canAccessUser(session, userId) {
  return session?.role === 'admin' || session?.userId === userId;
}

export function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
