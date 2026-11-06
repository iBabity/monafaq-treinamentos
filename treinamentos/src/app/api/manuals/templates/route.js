import { manuals, manualRoute } from '@/utils/manualApi';
import { ManualError, readBody } from '@/utils/manualValidation';
export const runtime = 'nodejs';
export async function GET(request) {
  return manualRoute(request, false, async user => {
    if (user.role !== 'admin') throw new ManualError('Acesso restrito ao administrador.', 403);
    const id = new URL(request.url).searchParams.get('id');
    return id ? manuals.template(id) : manuals.templates();
  });
}
async function body(request) {
  try {
    const data = await (await readBody(request, 9 * 1024 * 1024)).json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch (error) { if (error instanceof ManualError) throw error; throw new ManualError('Dados do modelo inválidos.'); }
}
export async function POST(request) { return manualRoute(request, true, async user => manuals.saveTemplate(user.id, await body(request))); }
export async function DELETE(request) { return manualRoute(request, true, async user => manuals.deleteTemplate(user.id, await body(request))); }
