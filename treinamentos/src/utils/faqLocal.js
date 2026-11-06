import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LearningError } from '@/utils/learningApi';

function localHeaders() {
  if(process.env.NODE_ENV==='production'||!process.env.TRAINING_SESSION_SECRET)throw new LearningError('FAQ local indisponível.',503);
  const email=(process.env.FAQ_MASTER_EMAILS || '').split(',')[0].trim().toLowerCase();
  if(!email) throw new LearningError('Configure FAQ_MASTER_EMAILS para a integração local.',503);
  return {cookie:'__sites_local_auth=1','x-local-actor':email,'x-local-proof':crypto.createHmac('sha256',process.env.TRAINING_SESSION_SECRET).update(email).digest('hex')};
}
export async function readFaqImage(id) {
  try {const r=await fetch(`http://127.0.0.1:5173/api/imagem?id=${encodeURIComponent(id)}`,{headers:localHeaders(),cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return {bytes:await r.arrayBuffer(),type:r.headers.get('content-type')||'application/octet-stream'};} catch {throw new LearningError('Imagem indisponível.',503)}
}

async function manualItems() {
  const source=await readFile(path.join(process.env.MONAFAQ_PUBLIC_DIR || path.resolve(process.cwd(),'../faq/public'),'manual.js'),'utf8');
  const match=source.match(/^\s*const\s+manual\s*=\s*([\s\S]*?)\s*;\s*$/);
  if(!match) throw Error('Manual indisponível');
  return JSON.parse(match[1]);
}

export async function restrictedImportedLessonIds(db) {
  const restricted=await db.query("SELECT faq_article_id FROM shared_topics_local WHERE audience='support' AND faq_article_id LIKE 'm-%'");
  if(!restricted.rowCount)return new Set();
  const items=await manualItems();
  return new Set(restricted.rows.map(({faq_article_id})=>{
    const index=Number(faq_article_id.slice(2)), item=items[index];
    if(!item)throw Error('Vínculo de artigo inválido');
    return 'gestores_pdf_'+crypto.createHash('sha256').update(`${item.category}\0${item.title}\0${item.page}\0${index}`).digest('hex').slice(0,24);
  }));
}

// Somente protótipo local; a identidade é assinada entre os serviços no computador.
export async function readFaqArticles() {
  if (process.env.NODE_ENV === 'production' || !process.env.TRAINING_SESSION_SECRET) throw new LearningError('FAQ local indisponível.',503);
  try {
    const response=await fetch('http://127.0.0.1:5173/api/conteudo',{headers:localHeaders(),cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw Error();
    const saved=await response.json();
    const originals=(await manualItems()).map((item,index)=>({...item,id:`m-${index}`,system:'gestores',body:item.text||'',images:'[]'}));
    const removed=new Set(saved.deleted), overrides=new Map(saved.articles.map(item=>[item.id,item]));
    return [...originals.map(item=>({...item,...overrides.get(item.id)})),...saved.articles.filter(item=>!item.id.startsWith('m-'))].filter(item=>!removed.has(item.id));
  } catch { throw new LearningError('Não foi possível consultar os artigos do FAQ.',503); }
}
