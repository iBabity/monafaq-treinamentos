// Conta interna somente nesta cópia local de teste.
import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { createSessionToken, setSessionCookie } from '@/utils/auth';
export async function POST(req) {
  const { email, password } = await req.json();
  const normalized = String(email || '').trim().toLowerCase();
  const result = await pool.query('SELECT id, name, email, role, track_id, password FROM users WHERE lower(email) = $1', [normalized]);
  const row = result.rows[0];
  let valid = false;
  if (row?.password?.startsWith('scrypt$')) {
    const [,salt,hash] = row.password.split('$');
    if (salt && /^[0-9a-f]{128}$/i.test(hash || '')) { const actual=crypto.scryptSync(String(password || ''),salt,64); const expected=Buffer.from(hash,'hex'); valid=crypto.timingSafeEqual(actual,expected); }
  }
  if (!valid) return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  delete row.password;
  const user = result.rows[0]; const response = NextResponse.json(user);
  setSessionCookie(response, createSessionToken(user)); return response;
}
