import { requireMaster, sameOrigin } from '@/utils/masterAccess';
import crypto from 'node:crypto';
import { pool } from '@/utils/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const auth = await requireMaster(req);
    if (auth.response) return auth.response;
    if(!sameOrigin(req)) return NextResponse.json({error:'Origem inválida.'},{status:403});

    const { user_id, new_password } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: 'user_id obrigatório.' }, { status: 400 });
    }

    // Ensure column exists (idempotent migration)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false
    `);

    const userRes = await pool.query('SELECT one_user_id FROM users WHERE id = $1', [user_id]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 });
    }
    if (userRes.rows[0].one_user_id) {
      return NextResponse.json({ error: 'Senha e acesso deste usuario sao gerenciados pelo One.' }, { status: 400 });
    }
    if (auth.session.role !== 'admin' && auth.session.userId !== user_id) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    if (new_password && (new_password.length < 8 || new_password.length > 128)) return NextResponse.json({error:'Senha inválida.'},{status:400});
    const salt=crypto.randomBytes(16).toString('hex');
    if (new_password) {
      // Called by the user themselves to set a new password and clear the flag
      await pool.query(
        'UPDATE users SET password = $1, must_change_password = false WHERE id = $2',
        [['scrypt',salt,crypto.scryptSync(new_password,salt,64).toString('hex')].join('$'), user_id]
      );
    } else {
      // Called by admin to mark the user as needing to reset password
      await pool.query(
        'UPDATE users SET must_change_password = true WHERE id = $1',
        [user_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
