import { requireMaster } from '@/utils/masterAccess';
import { pool } from '@/utils/db';
import { ensureTrackProgressSchema, syncTrackProgressSummary } from '@/utils/trackProgress';
import { learningRoute, learningBody, studyContent, LearningError } from '@/utils/learningApi';
import { canStudyTrack } from '@/utils/learningRules';

async function targetUser(current, id) {
  if (!id || (current.id !== id && current.role !== 'admin')) throw new LearningError('Acesso restrito.',403);
  const {rows} = await pool.query('SELECT id,role,track_id FROM users WHERE id=$1',[id]);
  if (!rows[0]) throw new LearningError('Usuário não encontrado.',404);
  return rows[0];
}
export async function POST(req) {
  return learningRoute(req,false,async current => {
    const d = await learningBody(req);
    if (current.id !== d.user_id) { const master=await requireMaster(req); if(master.response) throw new LearningError('Acesso restrito.',403); }
    const user = await targetUser(current,d.user_id);
    if (typeof d.completed !== 'boolean') throw new LearningError('Conclusão inválida.');
    const track = await studyContent(user,'lesson',d.lesson_id);
    await ensureTrackProgressSchema();
    if (d.completed) await pool.query(`INSERT INTO user_progress(user_id,video_id,track_id) VALUES($1,$2,$3)
      ON CONFLICT(user_id,video_id) DO UPDATE SET track_id=$3`,[user.id,d.lesson_id,track]);
    else await pool.query('DELETE FROM user_progress WHERE user_id=$1 AND video_id=$2',[user.id,d.lesson_id]);
    const progresso_geral = await syncTrackProgressSummary(user.id,track);
    return {success:true,track_id:track,progresso_geral};
  });
}
export async function GET(req) {
  return learningRoute(req,false,async current => {
    const params = new URL(req.url).searchParams;
    const user = await targetUser(current,params.get('user_id'));
    await ensureTrackProgressSchema();
    const {rows} = await pool.query(`SELECT p.video_id,c.track_id FROM user_progress p JOIN lessons l ON l.id=p.video_id
      JOIN categories c ON c.id=l.category_id WHERE p.user_id=$1`,[user.id]);
    const track = params.get('track_id');
    return rows.filter(p => canStudyTrack(user,p.track_id) && (!track || (p.track_id || 'track_padrao') === track)).map(p => p.video_id);
  });
}
