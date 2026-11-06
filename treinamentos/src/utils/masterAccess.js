import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { requireAdmin,requireSession } from '@/utils/auth';

export async function currentPermissions(request, adminRequired = false) {
  const auth=adminRequired?requireAdmin(request):requireSession(request);
  if(auth.response)return auth;
  const {rows}=await pool.query('SELECT id,name,email,role FROM users WHERE id=$1',[auth.session.userId]);
  const user=rows[0];
  if(!user || (adminRequired && user.role!=='admin'))return {response:NextResponse.json({error:'Acesso restrito.'},{status:403})};
  const configured=process.env.FAQ_MASTER_EMAILS || '';
  const masters=configured.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return {session:auth.session,user,isMaster:user.role==='admin'&&masters.includes(String(user.email||'').toLowerCase())};
}
export async function requireMaster(request) {
  const auth=await currentPermissions(request,true);
  if(auth.response)return auth;
  if(!auth.isMaster)return {response:NextResponse.json({error:'Acesso exclusivo do master.'},{status:403})};
  return auth;
}
export function sameOrigin(request) {
  const origin=request.headers.get('origin');
  return request.headers.get('sec-fetch-site')!=='cross-site' && (!origin || new URL(origin).host===request.headers.get('host'));
}
