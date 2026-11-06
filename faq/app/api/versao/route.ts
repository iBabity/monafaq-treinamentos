import {env} from 'cloudflare:workers';
import {eq} from 'drizzle-orm';
import {getDb} from '../../../db';
import {versionInfo} from '../../../db/schema';
import {authorized,auditStatement} from '../../../lib/audit';
export const dynamic='force-dynamic';
const initial={version:'1.0.2.254',date:'2026-09-30'};
export async function GET(req:Request){if(!req.headers.get('oai-authenticated-user-id'))return Response.json({error:'Acesso necessário'},{status:401});try{const row=(await getDb().select().from(versionInfo).where(eq(versionInfo.id,'gestores')).limit(1))[0];return Response.json(row?{version:row.version,date:row.date}:initial,{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Dados indisponíveis'},{status:503})}}
export async function PUT(req:Request){if(!authorized(req))return Response.json({error:'Acesso necessário'},{status:403});try{const body=await req.json() as {version?:unknown,date?:unknown};const version=typeof body.version==='string'?body.version.trim():'';const date=typeof body.date==='string'?body.date:'';if(!version||version.length>40||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return Response.json({error:'Dados inválidos'},{status:400});if(!env.DB)throw Error();await env.DB.batch([env.DB.prepare('INSERT INTO version_info (id,version,date) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,date=excluded.date').bind('gestores',version,date),auditStatement(req,'Versão atualizada',`${version} · ${date}`)]);return Response.json({version,date},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Não foi possível salvar'},{status:503})}}
