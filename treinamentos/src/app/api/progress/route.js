import { pool } from '@/utils/db';
import { NextResponse } from 'next/server';
import {
  ensureTrackProgressSchema,
  getLessonTrackId,
  syncTrackProgressSummary,
} from '@/utils/trackProgress';
import { canAccessUser, requireSession } from '@/utils/auth';

export async function GET(req) {
  try {
    const auth = requireSession(req);
    if (auth.response) return auth.response;

    await ensureTrackProgressSchema();
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');
    let track_id = searchParams.get('track_id');
    if (!user_id) return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 });
    if (!canAccessUser(auth.session, user_id)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    if (!track_id) {
      const userRes = await pool.query('SELECT track_id FROM users WHERE id = $1', [user_id]);
      track_id = userRes.rows[0]?.track_id || 'track_padrao';
    }

    const result = await pool.query(
      'SELECT video_id AS lesson_id FROM user_progress WHERE user_id = $1 AND track_id = $2',
      [user_id, track_id]
    );
    return NextResponse.json(result.rows.map((r) => r.lesson_id));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = requireSession(req);
    if (auth.response) return auth.response;

    await ensureTrackProgressSchema();
    const { user_id, lesson_id, done, track_id } = await req.json();
    if (!user_id || !lesson_id) {
      return NextResponse.json({ error: 'Dados obrigatorios ausentes.' }, { status: 400 });
    }
    if (!canAccessUser(auth.session, user_id)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }
    const resolvedTrackId = track_id || (await getLessonTrackId(lesson_id));

    if (done) {
      await pool.query(
        `INSERT INTO user_progress (user_id, video_id, track_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, video_id) DO UPDATE SET track_id = $3`,
        [user_id, lesson_id, resolvedTrackId]
      );
    } else {
      await pool.query(
        'DELETE FROM user_progress WHERE user_id = $1 AND video_id = $2 AND track_id = $3',
        [user_id, lesson_id, resolvedTrackId]
      );
    }

    const progresso_geral = await syncTrackProgressSummary(user_id, resolvedTrackId);
    return NextResponse.json({ success: true, progresso_geral, track_id: resolvedTrackId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
