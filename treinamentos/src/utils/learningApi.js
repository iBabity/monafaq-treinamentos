import { pool } from '@/utils/db';
import { requireSession } from '@/utils/auth';
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canStudyTrack } from './learningRules';

let schema;
export function ensureLearningSchema() {
  if (!schema) schema = readFile(path.join(process.cwd(), 'scripts/learning-schema.sql'), 'utf8')
    .then(sql => pool.query(sql)).catch(error => { schema = null; throw error; });
  return schema;
}
export class LearningError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const writes = new Map();
export async function learningRoute(request, admin, operation) {
  try {
    const auth = requireSession(request);
    if (auth.response) return auth.response;
    const { rows } = await pool.query('SELECT id,name,role,track_id FROM users WHERE id=$1', [auth.session.userId]);
    const user = rows[0];
    if (!user) throw new LearningError('Sessão expirada. Entre novamente.', 401);
    if (admin && user.role !== 'admin') throw new LearningError('Acesso restrito.', 403);
    if (request.method !== 'GET') {
      const origin = request.headers.get('origin');
      if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && new URL(origin).host !== request.headers.get('host')))
        throw new LearningError('Origem não permitida.', 403);
      const now = Date.now();
      for (const [key, entry] of writes) if (entry.until < now) writes.delete(key);
      const entry = writes.get(user.id) || { count: 0, until: now + 60000 };
      if (++entry.count > 180) throw new LearningError('Aguarde um momento e tente novamente.', 429);
      writes.set(user.id, entry);
    }
    await ensureLearningSchema();
    return NextResponse.json(await operation(user), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = error.status || (['23503','23505'].includes(error.code) ? 409 : 500);
    return NextResponse.json({ error: error.status ? error.message : status === 409 ? 'Existem vínculos com este registro. Revise as categorias e aulas.' : 'Não foi possível salvar ou carregar os treinamentos.' }, { status });
  }
}
export async function learningBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new LearningError('Dados obrigatórios.');
  let size = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) { await reader.cancel(); throw new LearningError('Dados muito extensos.', 413); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new LearningError('Dados inválidos.'); }
}
export function requiredText(value, label, max = 255) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new LearningError(`${label} inválido.`);
  return value.trim();
}
export async function studyContent(user, type, id) {
  if (type === 'assigned') {
    const { rows } = await pool.query('SELECT id FROM assigned_videos WHERE id=$1 AND user_id=$2', [id, user.id]);
    if (!rows.length) throw new LearningError('Vídeo não disponível.', 403);
    return null;
  }
  if (type !== 'lesson') throw new LearningError('Tipo de vídeo inválido.');
  const { rows } = await pool.query('SELECT c.track_id FROM lessons l JOIN categories c ON c.id=l.category_id WHERE l.id=$1', [id]);
  if (!rows.length || !canStudyTrack(user, rows[0].track_id)) throw new LearningError('Aula não disponível para sua trilha.', 403);
  return rows[0].track_id || 'track_padrao';
}
