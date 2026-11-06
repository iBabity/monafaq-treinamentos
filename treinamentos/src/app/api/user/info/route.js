import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { canAccessUser, requireSession } from '@/utils/auth';

export async function GET(request) {
  const auth = requireSession(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }
  if (!canAccessUser(auth.session, userId)) {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, display_name, profile_picture, track_id,
              COALESCE(must_change_password, false) AS must_change_password,
              one_user_id,
              CASE WHEN one_user_id IS NULL THEN 'local' ELSE 'one' END AS auth_source
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
