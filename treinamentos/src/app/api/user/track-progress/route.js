import { NextResponse } from 'next/server';
import {
  ensureTrackProgressSchema,
  getTrackProgressSummary,
} from '@/utils/trackProgress';
import { canAccessUser, requireSession } from '@/utils/auth';

export async function GET(request) {
  const auth = requireSession(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const trackId = searchParams.get('track_id');

  if (!userId || !trackId) {
    return NextResponse.json({ error: 'user_id e track_id são obrigatórios.' }, { status: 400 });
  }
  if (!canAccessUser(auth.session, userId)) {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
  }

  try {
    await ensureTrackProgressSchema();
    const progresso_geral = await getTrackProgressSummary(userId, trackId);
    return NextResponse.json({ progresso_geral });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
