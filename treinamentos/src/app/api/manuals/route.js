import { manuals, manualRoute, manualBody, jsonBody } from '@/utils/manualApi';
export const runtime = 'nodejs';
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  return manualRoute(request, false, user => manuals.list(user.role === 'admin' && params.get('view') !== 'student', params));
}
export async function POST(request) {
  return manualRoute(request, true, async user => {
    const { input, file } = await manualBody(request);
    return manuals.save(user.id, input, file);
  });
}
export async function DELETE(request) {
  return manualRoute(request, true, async user => manuals.remove(user.id, await jsonBody(request)));
}
