import crypto from 'crypto';

function getHandoffSecret() {
  const secret = process.env.PORTAL_APP_HANDOFF_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PORTAL_APP_HANDOFF_SECRET is required in production');
  }
  return 'dev-only-portal-app-handoff-secret';
}

function sign(payload) {
  return crypto.createHmac('sha256', getHandoffSecret()).update(payload).digest('base64url');
}

export function verifyPortalHandoffToken(token) {
  if (!token || !token.includes('.')) {
    throw new Error('Token de entrada do Portal ausente.');
  }

  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature || '');

  if (
    expectedBytes.length !== signatureBytes.length ||
    !crypto.timingSafeEqual(expectedBytes, signatureBytes)
  ) {
    throw new Error('Token de entrada do Portal invalido.');
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (data.appId !== 'treinamentos') {
    throw new Error('Token emitido para outro aplicativo.');
  }
  if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token de entrada do Portal expirado.');
  }
  if (!data.accessToken) {
    throw new Error('Token do One ausente no handoff.');
  }

  return data;
}
