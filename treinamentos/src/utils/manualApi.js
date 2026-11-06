import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { requireSession } from '@/utils/auth';
import { createManualService } from '@/utils/manualService';
import { ManualError, readBody } from '@/utils/manualValidation';

export const manuals = createManualService(pool);
const writes = new Map();
export async function manualRoute(request, write, operation) {
  try {
    const auth = requireSession(request);
    if (auth.response) return auth.response;
    const current = await pool.query('SELECT id,role FROM users WHERE id=$1', [auth.session.userId]);
    const user = current.rows[0];
    if (!user) throw new ManualError('Sessao expirada. Entre novamente.', 401);
    if (write) {
      if (user.role !== 'admin') throw new ManualError('Acesso restrito ao administrador.', 403);
      const origin = request.headers.get('origin');
      if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && new URL(origin).host !== request.headers.get('host'))) {
        throw new ManualError('Origem da requisicao nao permitida.', 403);
      }
      const now = Date.now();
      for (const [key, entry] of writes) if (entry.expires <= now) writes.delete(key);
      const entry = writes.get(user.id) || { count: 0, expires: now + 60000 };
      if (++entry.count > 20) throw new ManualError('Muitas alteracoes. Aguarde um minuto.', 429);
      writes.set(user.id, entry);
    }
    const value = await operation(user);
    const response = value instanceof Response ? value : NextResponse.json(value);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    let status = error instanceof ManualError ? error.status : 500;
    let message = error instanceof ManualError ? error.message : 'Nao foi possivel concluir a operacao com os manuais.';
    if (error.code === '23505') { status = 409; message = 'Ja existe uma pasta com esse nome neste local.'; }
    if (error.code === '23503') { status = 409; message = 'A pasta contem itens ou o destino nao existe mais. Atualize a lista.'; }
    if (status === 500) console.error('[manuals]', { code: error.code || 'internal', type: error.name });
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
export async function jsonBody(request) {
  try {
    const input = await (await readBody(request, 16 * 1024)).json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ManualError('Dados invalidos.');
    return input;
  }
  catch (error) { if (error instanceof ManualError) throw error; throw new ManualError('Dados invalidos.'); }
}
export async function manualBody(request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new ManualError('Envie o formulario com o PDF.');
  try {
    const form = await (await readBody(request)).formData();
    const input = JSON.parse(form.get('metadata'));
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('metadata');
    return { input, file: form.get('file') || null };
  } catch (error) { if (error instanceof ManualError) throw error; throw new ManualError('Formulario invalido.'); }
}
