import path from 'node:path';
import { spawn } from 'node:child_process';
import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { requireSession } from '@/utils/auth';
import { canStudyTrack } from '@/utils/learningRules';
import { readFaqArticles,readFaqImage } from '@/utils/faqLocal';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function render(data) {
  return new Promise((resolve,reject)=>{
    const python=path.join(process.env.USERPROFILE||'', '.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
    const proc=spawn(python,[path.join(process.cwd(),'scripts','manual-aluno-pdf.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    const chunks=[];let size=0,failed=false;
    const timer=setTimeout(()=>{failed=true;proc.kill();reject(Error('Tempo esgotado'))},60000);
    proc.stdout.on('data',chunk=>{size+=chunk.length;if(size>30*1024*1024){failed=true;proc.kill();return}chunks.push(chunk)});
    proc.stderr.resume();proc.on('error',err=>{clearTimeout(timer);reject(err)});
    proc.on('close',code=>{clearTimeout(timer);if(code!==0||failed||!size)reject(Error('Não foi possível gerar o PDF'));else resolve(Buffer.concat(chunks))});
    proc.stdin.on('error',()=>{});proc.stdin.end(JSON.stringify(data));
  });
}
export async function GET(request) {
  try {
    const auth=requireSession(request);if(auth.response)return auth.response;
    const current=await pool.query('SELECT id,name,role,track_id FROM users WHERE id=$1',[auth.session.userId]);
    if(!current.rowCount)return new NextResponse('Acesso restrito',{status:403});
    const user=current.rows[0],cats=await pool.query('SELECT id,name,track_id,sort_order FROM categories ORDER BY sort_order,name');
    const allowed=cats.rows.filter(c=>canStudyTrack(user,c.track_id)),ids=allowed.map(c=>c.id),catById=new Map(allowed.map(c=>[c.id,c]));
    const {rows}=await pool.query(`SELECT t.id,t.title,t.body,t.faq_article_id,t.category_id FROM shared_topics_local t
      JOIN lessons l ON l.id=t.lesson_id AND l.category_id=t.category_id
      WHERE t.audience IN ('student','both') AND t.category_id=ANY($1::text[])
      ORDER BY array_position($1::text[],t.category_id),l.sort_order,t.title`,[ids]);
    const faq=rows.some(x=>x.faq_article_id)?await readFaqArticles():[], byId=new Map(faq.map(a=>[a.id,a]));
    const selected=rows.filter(x=>!x.faq_article_id||byId.has(x.faq_article_id)).map(x=>{const src=byId.get(x.faq_article_id);return {...x,title:src?.title||x.title,body:(src?.body??x.body).replace(/^\[\[ocultar-manual\]\]\n?/,''),images:src?JSON.parse(src.images||'[]'):[],category:catById.get(x.category_id).name}});
    const allowed_titles=Object.fromEntries(selected.filter(x=>x.faq_article_id).map(x=>[x.faq_article_id,x.title]));
    let bytes=0,count=0;
    for(const topic of selected){const images=[];for(const id of topic.images){if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Imagem inválida');if(++count>100)throw Error('Muitas imagens');const image=await readFaqImage(id);bytes+=image.bytes.byteLength;if(bytes>30*1024*1024)throw Error('Imagens excedem limite');images.push(Buffer.from(image.bytes).toString('base64'))}topic.images=images}
    const pdf=await render({topics:selected,allowed_titles});
    return new NextResponse(pdf,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Manual-Monalisa-Gestores-Aluno.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  } catch {return NextResponse.json({error:'Não foi possível gerar o manual do aluno. Tente novamente ou informe ao administrador.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
