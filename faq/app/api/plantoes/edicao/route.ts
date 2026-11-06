import {env} from 'cloudflare:workers';
import {authorized,actor,auditStatement} from '../../../../lib/audit';
export const dynamic='force-dynamic';

async function prepare(){
  if(!env.DB)throw Error('Banco indisponível');
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS local_plantao_edicoes (data TEXT PRIMARY KEY, responsavel TEXT NOT NULL, atualizado_em TEXT NOT NULL)').run();
  return env.DB;
}
export async function GET(req:Request){
  if(!req.headers.get('oai-authenticated-user-id'))return Response.json({error:'Acesso necessário'},{status:401});
  try{const db=await prepare();const result=await db.prepare('SELECT data,responsavel,atualizado_em FROM local_plantao_edicoes ORDER BY data').all();return Response.json({edicoes:result.results||[]},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Não foi possível carregar as edições.'},{status:503})}
}
export async function PUT(req:Request){
  if(!authorized(req)||!(env as unknown as { FAQ_MASTER_EMAILS?: string }).FAQ_MASTER_EMAILS?.split(',').map(v=>v.trim().toLowerCase()).includes(actor(req).id.toLowerCase()))return Response.json({error:'Acesso exclusivo do master.'},{status:403});
  try{
    const body=await req.json() as {data?:unknown,responsavel?:unknown};
    const date=typeof body.data==='string'?body.data:'',name=typeof body.responsavel==='string'?body.responsavel.trim():null;
    if(!/^202[67]-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||name===null||name.length>100)return Response.json({error:'Confira a data e o responsável.'},{status:400});
    const db=await prepare(),previous=await db.prepare('SELECT responsavel FROM local_plantao_edicoes WHERE data=?').bind(date).first<{responsavel:string}>();
    const now=new Date().toISOString();
    await db.batch([db.prepare('INSERT INTO local_plantao_edicoes(data,responsavel,atualizado_em) VALUES(?,?,?) ON CONFLICT(data) DO UPDATE SET responsavel=excluded.responsavel,atualizado_em=excluded.atualizado_em').bind(date,name,now),auditStatement(req,'Plantão alterado',`${date} · ${previous?previous.responsavel||'sem responsável':'valor da planilha'} → ${name||'sem responsável'}`)]);
    return Response.json({data:date,responsavel:name,atualizado_em:now});
  }catch{return Response.json({error:'Não foi possível salvar o plantão.'},{status:503})}
}
export async function DELETE(req:Request){
  if(!authorized(req)||!(env as unknown as { FAQ_MASTER_EMAILS?: string }).FAQ_MASTER_EMAILS?.split(',').map(v=>v.trim().toLowerCase()).includes(actor(req).id.toLowerCase()))return Response.json({error:'Acesso exclusivo do master.'},{status:403});
  try{const body=await req.json() as {data?:unknown};const date=typeof body.data==='string'?body.data:'';if(!/^202[67]-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return Response.json({error:'Data inválida.'},{status:400});const db=await prepare();await db.batch([db.prepare('DELETE FROM local_plantao_edicoes WHERE data=?').bind(date),auditStatement(req,'Plantão restaurado',`${date} · valor original`)]);return Response.json({ok:true})}catch{return Response.json({error:'Não foi possível restaurar o plantão.'},{status:503})}
}
