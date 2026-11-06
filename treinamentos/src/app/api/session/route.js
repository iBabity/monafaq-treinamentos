import { NextResponse } from 'next/server';
import { requireSession } from '@/utils/auth';

export async function GET(request) {
  const auth = requireSession(request);
  if (auth.response) return auth.response;

  return NextResponse.json({
    id: auth.session.userId,
    role: auth.session.role,
    name: auth.session.name,
    email: auth.session.email,
    track_id: auth.session.trackId,
    auth_source: auth.session.authSource,
    one_user_id: auth.session.oneUserId,
  });
}
