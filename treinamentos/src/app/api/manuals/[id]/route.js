import { manuals, manualRoute } from '@/utils/manualApi';
export const runtime = 'nodejs';
export async function GET(request, { params }) {
  return manualRoute(request, false, async user => manuals.content(user.role === 'admin' && new URL(request.url).searchParams.get('view') !== 'student', (await params).id));
}
