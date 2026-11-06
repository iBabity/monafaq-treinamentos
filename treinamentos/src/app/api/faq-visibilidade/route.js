import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { requireMaster } from '@/utils/masterAccess';
import { readFaqArticles } from '@/utils/faqLocal';
import { ensureLearningSchema } from '@/utils/learningApi';

const faqOrigin='http://127.0.0.1:3081';
function response(data,status=200) {return NextResponse.json(data,{status,headers:{'Access-Control-Allow-Origin':faqOrigin,'Access-Control-Allow-Credentials':'true','Cache-Control':'no-store','Vary':'Origin'}})}
function articleId(id) {return typeof id==='string' && /^(m-\d+|[0-9a-f-]{36})$/i.test(id)}
async function authenticate(request) {const auth=await requireMaster(request);return auth.response?null:auth}
export async function GET(request) {
 try {
  const auth=await authenticate(request);if(!auth)return response({error:'Acesso restrito ao master.'},403);
  const id=new URL(request.url).searchParams.get('id');if(!articleId(id))return response({error:'Artigo inválido.'},400);
  await ensureLearningSchema();
  const [links,lessons]=await Promise.all([pool.query('SELECT id,audience,lesson_id FROM shared_topics_local WHERE faq_article_id=$1 ORDER BY updated_at DESC',[id]),pool.query('SELECT l.id,l.title,c.name AS category FROM lessons l JOIN categories c ON c.id=l.category_id ORDER BY c.sort_order,c.name,l.sort_order,l.title')]);
  const enabled=links.rows.some(x=>x.audience==='both'||x.audience==='student');
  return response({configured:links.rowCount>0,enabled,lessonId:links.rows.find(x=>x.lesson_id)?.lesson_id||'',lessons:lessons.rows});
 }catch{return response({error:'Não foi possível carregar a configuração.'},503)}
}
export async function POST(request) {
 let db;
 try {
  const auth=await authenticate(request);if(!auth)return response({error:'Acesso restrito ao master.'},403);
  if(request.headers.get('origin')!==faqOrigin || request.headers.get('sec-fetch-site')==='cross-site')return response({error:'Origem inválida.'},403);
  const body=await request.json();const {id,enabled,lessonId}=body;
  if(!articleId(id)||typeof enabled!=='boolean'||(lessonId!=null && (typeof lessonId!=='string'||lessonId.length>255)))return response({error:'Dados inválidos.'},400);
  const article=(await readFaqArticles()).find(a=>a.id===id);if(!article)return response({error:'Artigo não encontrado.'},404);
  await ensureLearningSchema();db=await pool.connect();await db.query('BEGIN');
  const existing=await db.query('SELECT id,lesson_id,audience FROM shared_topics_local WHERE faq_article_id=$1 FOR UPDATE',[id]);
  const chosen=lessonId||existing.rows.find(x=>x.lesson_id)?.lesson_id||null;
  if(enabled&&!chosen){await db.query('ROLLBACK');return response({error:'Escolha uma aula para exibir o artigo ao aluno.'},400)}
  let lesson=null;if(chosen){lesson=(await db.query('SELECT id,category_id FROM lessons WHERE id=$1',[chosen])).rows[0];if(!lesson){await db.query('ROLLBACK');return response({error:'Aula não encontrada.'},400)}}
  const audience=enabled?'both':'support';
  let topicId=existing.rows[0]?.id;
  if(existing.rowCount){
   await db.query('UPDATE shared_topics_local SET audience=$2,updated_at=now() WHERE faq_article_id=$1',[id,audience]);
   if(enabled && lesson) await db.query('UPDATE shared_topics_local SET category_id=$2,lesson_id=$3 WHERE id=$1',[topicId,lesson.category_id,chosen]);
  }else{
   const category=lesson?.category_id || (await db.query('SELECT id FROM categories ORDER BY sort_order,name LIMIT 1')).rows[0]?.id;
   if(!category){await db.query('ROLLBACK');return response({error:'Cadastre uma categoria primeiro.'},409)}
   topicId=crypto.randomUUID();
   await db.query('INSERT INTO shared_topics_local(id,category_id,title,body,audience,lesson_id,faq_article_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[topicId,category,article.title,article.body||'Consulte o artigo original.',audience,chosen,id]);
  }
  await db.query('INSERT INTO shared_topics_local_audit(id,topic_id,actor_id,action,actor_name,title,before_body,after_body) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),topicId,auth.user.id,'visibilidade alterada',auth.user.name,article.title,existing.rows.map(x=>x.audience).join(', ')||'não configurado',enabled?'alunos e administradores':'somente administradores']);
  await db.query('COMMIT');return response({ok:true,enabled});
 }catch{if(db)await db.query('ROLLBACK').catch(()=>{});return response({error:'Não foi possível salvar a configuração.'},503)}finally{db?.release()}
}
