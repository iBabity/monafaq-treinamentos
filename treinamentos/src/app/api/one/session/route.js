import { NextResponse } from 'next/server';
import { createSessionToken, setSessionCookie } from '@/utils/auth';
import { verifyPortalHandoffToken } from '@/utils/handoff';
import {
  ensureTrainingUserFromOne,
  fetchOnePortalContext,
  oneSessionFields,
  readJwtExpiresAt,
  readJwtPayload,
} from '@/utils/oneAuth';

export async function POST(req) {
  try {
    const { handoff } = await req.json();
    const payload = verifyPortalHandoffToken(handoff);
    const portalContext = await fetchOnePortalContext(payload.accessToken, payload.businessGroupId);
    const tokenPayload = readJwtPayload(payload.accessToken) || {};
    const oneAuth = {
      accessToken: payload.accessToken,
      expiresAt: null,
      user: {
        id: portalContext.userId,
        email: portalContext.email,
        role: tokenPayload.role || tokenPayload.Role || tokenPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
      },
      expiresAt: readJwtExpiresAt(payload.accessToken),
      portalContext,
      licensedApps: [],
    };

    const user = await ensureTrainingUserFromOne(oneAuth, portalContext, payload.businessGroupId);
    const sessionUser = {
      ...user,
      ...oneSessionFields(oneAuth, portalContext, payload.businessGroupId),
    };
    const response = NextResponse.json(user);
    setSessionCookie(response, createSessionToken(sessionUser));
    return response;
  } catch (err) {
    console.error('[one-session]', err);
    return NextResponse.json(
      { error: err.message || 'Nao foi possivel entrar com a sessao do One.' },
      { status: err.status || 401 }
    );
  }
}
