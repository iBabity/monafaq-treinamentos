import { pool } from '@/utils/db';
import { learningRoute, learningBody, requiredText, LearningError } from '@/utils/learningApi';
import { canStudyTrack } from '@/utils/learningRules';
import { getYouTubeVideoId } from '@/utils/youtube';
import { restrictedImportedLessonIds } from '@/utils/faqLocal';
export async function GET(req) {
  return learningRoute(req, false, async user => {
    const { rows } = await pool.query(`SELECT l.*,c.track_id FROM lessons l JOIN categories c ON c.id=l.category_id ORDER BY l.sort_order,l.title`);
    const hidden=user.role==='admin'?new Set():await restrictedImportedLessonIds(pool);
    return rows.filter(l => canStudyTrack(user,l.track_id)&&!hidden.has(l.id));
  });
}
export async function POST(req) {
  return learningRoute(req, true, async user => {
    const d = await learningBody(req);
    const id = requiredText(d.id,'Identificador'), title = requiredText(d.title,'Título');
    const category = requiredText(d.category_id,'Categoria');
    const video = requiredText(d.video_url,'URL',2048);
    if (!/^[a-zA-Z0-9_-]{11}$/.test(getYouTubeVideoId(video)) && !/^\/material-gestores\/(?:[1-9]|[1-9]\d|1\d\d|2[0-3]\d|24[0-4])\.webp$/.test(video)) throw new LearningError('Informe um vídeo válido do YouTube ou uma página válida do manual.');
    if (typeof (d.description || '') !== 'string' || (d.description || '').length > 30000) throw new LearningError('Descrição muito extensa.');
    if (!Number.isInteger(d.sort_order ?? 0)) throw new LearningError('Ordem inválida.');
    await pool.query(`INSERT INTO lessons(id,title,subtitle,category_id,video_url,duration,description,views,sort_order,updated_by,reviewed_by_name,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,now()) ON CONFLICT(id) DO UPDATE SET title=$2,subtitle=$3,category_id=$4,video_url=$5,duration=$6,description=$7,sort_order=$8,updated_by=$9,reviewed_by_name=$10,updated_at=now()`,
      [id,title,d.subtitle || '',category,video,d.duration || '',d.description || '',d.sort_order ?? 0,user.id,user.name]);
    return {success:true};
  });
}
export async function DELETE(req) {
  return learningRoute(req,true,async () => {
    const {id} = await learningBody(req);
    await pool.query('DELETE FROM lessons WHERE id=$1',[requiredText(id,'Identificador')]);
    return {success:true};
  });
}
