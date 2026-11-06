import { pool } from '@/utils/db';
import { learningRoute, learningBody, studyContent } from '@/utils/learningApi';
export async function POST(req) {
  return learningRoute(req, false, async user => {
    const { lesson_id } = await learningBody(req);
    await studyContent(user, 'lesson', lesson_id);
    await pool.query('UPDATE lessons SET views=COALESCE(views,0)+1 WHERE id=$1',[lesson_id]);
    return {success:true};
  });
}
