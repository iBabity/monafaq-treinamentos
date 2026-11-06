import { currentPermissions } from '@/utils/masterAccess';
import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { canAccessUser, requireSession } from '@/utils/auth';

export async function POST(request) {
  try {
    const auth = requireSession(request);
    if (auth.response) return auth.response;

    const { user_id, display_name } = await request.json();

    if (!user_id || !display_name) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }
    if (auth.session.userId !== user_id) { const permission=await currentPermissions(request,true); if(permission.response || !permission.isMaster) return NextResponse.json({error:'Acesso restrito.'},{status:403}); }
    if (!canAccessUser(auth.session, user_id)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [display_name, user_id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
