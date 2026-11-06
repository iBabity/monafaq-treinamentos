import { requireMaster, sameOrigin } from '@/utils/masterAccess';
import { ensureLearningSchema } from '@/utils/learningApi';
import { pool } from '@/utils/db';
import { NextResponse } from 'next/server';
import { ensureTrackProgressSchema, syncTrackProgressSummary } from '@/utils/trackProgress';

export async function POST(req) {
  try {
    const auth=await requireMaster(req); if(auth.response)return auth.response;
    if(!sameOrigin(req)) return NextResponse.json({error:"Origem inválida."},{status:403});
    await ensureTrackProgressSchema();
    await ensureLearningSchema();
    const { user_id, track_id } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: 'user_id obrigatório.' }, { status: 400 });
    }

    const userRes = await pool.query('SELECT track_id FROM users WHERE id = $1', [user_id]);
    const resolvedTrackId = track_id || userRes.rows[0]?.track_id || 'track_padrao';

    await pool.query(
      'DELETE FROM user_progress WHERE user_id = $1 AND track_id = $2',
      [user_id, resolvedTrackId]
    );

    await pool.query(`DELETE FROM learning_playback p USING lessons l,categories c WHERE p.user_id=$1 AND p.content_type='lesson' AND p.content_id=l.id AND l.category_id=c.id AND COALESCE(c.track_id,'track_padrao')=$2`, [user_id,resolvedTrackId]);

    await pool.query(
      `INSERT INTO user_track_progress (user_id, track_id, progresso_geral)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, track_id) DO UPDATE SET progresso_geral = 0`,
      [user_id, resolvedTrackId]
    );

    if (userRes.rows[0]?.track_id === resolvedTrackId) {
      await pool.query('UPDATE users SET progresso_geral = 0 WHERE id = $1', [user_id]);
    }

    return NextResponse.json({ success: true, track_id: resolvedTrackId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
