import { pool } from '@/utils/db';
import { learningRoute, learningBody, requiredText, studyContent, LearningError } from '@/utils/learningApi';
import { canStudyTrack } from '@/utils/learningRules';

export async function GET(req) {
  return learningRoute(req, false, async user => {
    const { rows } = await pool.query(`SELECT p.*, c.track_id FROM learning_playback p
      LEFT JOIN lessons l ON p.content_type='lesson' AND l.id=p.content_id
      LEFT JOIN categories c ON c.id=l.category_id
      LEFT JOIN assigned_videos a ON p.content_type='assigned' AND a.id=p.content_id AND a.user_id=p.user_id
      WHERE p.user_id=$1 AND (l.id IS NOT NULL OR a.id IS NOT NULL)`, [user.id]);
    return rows.filter(p => p.content_type === 'assigned' || canStudyTrack(user, p.track_id));
  });
}
export async function POST(req) {
  return learningRoute(req, false, async user => {
    const d = await learningBody(req);
    requiredText(d.content_id, 'Vídeo');
    await studyContent(user, d.content_type, d.content_id);
    if (![d.position_seconds, d.duration_seconds].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 604800))
      throw new LearningError('Posição do vídeo inválida.');
    if (d.duration_seconds > 0 && d.position_seconds > d.duration_seconds + 1) throw new LearningError('Posição maior que a duração.');
    const sampled = Date.parse(d.updated_at);
    if (!Number.isFinite(sampled) || Math.abs(Date.now() - sampled) > 86400000) throw new LearningError('Horário de reprodução inválido.');
    await pool.query(`INSERT INTO learning_playback(user_id,content_type,content_id,position_seconds,duration_seconds,sampled_at)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,content_type,content_id) DO UPDATE
      SET position_seconds=$4,duration_seconds=$5,updated_at=CURRENT_TIMESTAMP,sampled_at=$6
      WHERE learning_playback.sampled_at IS NULL OR learning_playback.sampled_at <= $6`,
      [user.id,d.content_type,d.content_id,d.position_seconds,d.duration_seconds,new Date(sampled).toISOString()]);
    return { success: true };
  });
}
