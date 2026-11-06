import { manuals } from '@/utils/manualApi';
import { publicHeaders } from '@/utils/publicManual';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  try {
    const manual = await manuals.file(false, (await params).id);
    if (manual.content_type !== 'pdf') return new Response('Arquivo não encontrado.', { status: 404, headers: publicHeaders });
    const disposition = new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline';
    return new Response(new Uint8Array(manual.pdf), { headers: { ...publicHeaders,
      'Content-Type': 'application/pdf',
      'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'self'",
      'Content-Disposition': `${disposition}; filename="manual.pdf"; filename*=UTF-8''${encodeURIComponent(manual.filename)}`,
    } });
  } catch (error) {
    const missing = error.status === 400 || error.status === 404;
    return new Response(missing ? 'Manual não encontrado ou não publicado.' : 'Não foi possível abrir o manual.', { status: missing ? 404 : 503, headers: publicHeaders });
  }
}
