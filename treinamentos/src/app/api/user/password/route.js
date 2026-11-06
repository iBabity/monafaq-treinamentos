import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { canAccessUser, requireSession } from '@/utils/auth';

export async function POST(request) {
  try {
    const auth = requireSession(request);
    if (auth.response) return auth.response;

    const { user_id, current_password, new_password } = await request.json();

    if (!user_id || !current_password || !new_password) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }
    if (auth.session.userId !== user_id) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    // Verify current password
    const userRes = await pool.query('SELECT password, one_user_id FROM users WHERE id = $1', [user_id]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (userRes.rows[0].one_user_id) {
      return NextResponse.json({ error: 'Senha e acesso sao gerenciados pelo One.' }, { status: 400 });
    }

    const stored=userRes.rows[0].password; const [,salt,hash]=stored.split('$');
    const valid=stored.startsWith('scrypt$') && salt && /^[0-9a-f]{128}$/i.test(hash||'') ? crypto.timingSafeEqual(crypto.scryptSync(current_password,salt,64),Buffer.from(hash,'hex')) : stored===current_password;
    if (!valid) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 403 });
    }

    // Update to new password
    if (new_password.length<8 || new_password.length>128) return NextResponse.json({error:'Senha inválida.'},{status:400});
    const newSalt=crypto.randomBytes(16).toString('hex'); const secured=['scrypt',newSalt,crypto.scryptSync(new_password,newSalt,64).toString('hex')].join('$');
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [secured, user_id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
