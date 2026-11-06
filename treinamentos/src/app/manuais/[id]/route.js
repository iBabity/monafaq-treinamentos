import { manuals } from '@/utils/manualApi';
import { publicManualDocument, publicHeaders } from '@/utils/publicManual';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  try {
    const manual = await manuals.content(false, (await params).id);
    return new Response(publicManualDocument(manual), { headers: { ...publicHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    const missing = error.status === 400 || error.status === 404;
    return new Response(missing ? 'Manual não encontrado ou não publicado.' : 'Não foi possível abrir o manual. Tente novamente.', { status: missing ? 404 : 503, headers: publicHeaders });
  }
}
