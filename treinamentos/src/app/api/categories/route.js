import { pool } from '@/utils/db';
import { learningRoute, learningBody, requiredText, LearningError } from '@/utils/learningApi';
import { canStudyTrack, validParent } from '@/utils/learningRules';

export async function GET(req) {
  return learningRoute(req, false, async user => {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY sort_order, name');
    return rows.filter(c => canStudyTrack(user, c.track_id));
  });
}
export async function POST(req) {
  return learningRoute(req, true, async () => {
    const data = await learningBody(req);
    const id = requiredText(data.id, 'Identificador');
    const name = requiredText(data.name, 'Nome');
    const track = data.track_id || 'track_padrao';
    const parent = data.parent_id || null;
    if (!Number.isInteger(data.sort_order ?? 0)) throw new LearningError('Ordem inválida.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE');
      const { rows } = await client.query('SELECT id,parent_id,track_id FROM categories');
      if (!validParent(rows, id, parent, track)) throw new LearningError('Selecione uma categoria superior da mesma trilha, sem criar ciclos.');
      if (rows.some(c => c.parent_id === id && (c.track_id || 'track_padrao') !== track)) throw new LearningError('Mova primeiro as subcategorias para alterar a trilha.');
      await client.query(`INSERT INTO categories(id,name,icon,sort_order,track_id,parent_id) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(id) DO UPDATE SET name=$2,icon=$3,sort_order=$4,track_id=$5,parent_id=$6`,
        [id,name,data.icon || 'fiscal',data.sort_order ?? 0,track,parent]);
      await client.query('COMMIT');
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return { success: true };
  });
}
export async function DELETE(req) {
  return learningRoute(req, true, async () => {
    const { id } = await learningBody(req);
    await pool.query('DELETE FROM categories WHERE id=$1', [requiredText(id, 'Identificador')]);
    return { success: true };
  });
}
