import { pool } from '@/utils/db';
import { learningRoute, learningBody, studyContent, LearningError } from '@/utils/learningApi';
export async function POST(req) {
  return learningRoute(req, false, async user => {
    const data = await learningBody(req);
    if (typeof data.completed !== 'boolean') throw new LearningError('Conclusão inválida.');
    await studyContent(user, 'assigned', data.id);
    await pool.query('UPDATE assigned_videos SET visto=$1 WHERE id=$2 AND user_id=$3', [data.completed, data.id, user.id]);
    return { success: true };
  });
}
