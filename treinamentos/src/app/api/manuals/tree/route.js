import { manuals, manualRoute, jsonBody } from '@/utils/manualApi';
export const runtime = 'nodejs';
export async function GET(request) {
  return manualRoute(request, false, user => manuals.tree(user.role === 'admin' && new URL(request.url).searchParams.get('view') !== 'student'));
}
export async function POST(request) {
  return manualRoute(request, true, async user => manuals.saveFolder(user.id, await jsonBody(request)));
}
export async function DELETE(request) {
  return manualRoute(request, true, async user => manuals.deleteFolder(user.id, await jsonBody(request)));
}
