import { manuals, manualRoute } from '@/utils/manualApi';
import { renderDocument } from '@/utils/manualHtml';
export const runtime = 'nodejs';
export async function GET(request, { params }) {
  return manualRoute(request, false, async user => {
    const { id } = await params;
    const file = await manuals.file(user.role === 'admin' && new URL(request.url).searchParams.get('view') !== 'student', id);
    const disposition = new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline';
    if (file.content_type === 'html') return new Response(renderDocument(file.html_content), { headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `${disposition}; filename="manual.html"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
    } });
    return new Response(new Uint8Array(file.pdf), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(file.byte_size),
      'Content-Disposition': `${disposition}; filename="manual.pdf"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/'/g, '%27')}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'self'",
    } });
  });
}
