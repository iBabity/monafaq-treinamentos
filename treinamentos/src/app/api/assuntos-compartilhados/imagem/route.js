import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { requireSession } from '@/utils/auth';
import { studyContent } from '@/utils/learningApi';
import { readFaqArticles,readFaqImage } from '@/utils/faqLocal';

export async function GET(request) {
  try {
    const auth=requireSession(request);if(auth.response)return auth.response;
    const params=new URL(request.url).searchParams, id=params.get('id')||'', lesson=params.get('lesson')||'';
    if(!/^[0-9a-f-]{36}$/i.test(id)||!lesson||lesson.length>255)return new NextResponse('Não encontrada',{status:404});
    const u=await pool.query('SELECT id,name,role,track_id FROM users WHERE id=$1',[auth.session.userId]);
    if(!u.rowCount)return new NextResponse('Acesso restrito',{status:403});
    const user=u.rows[0];await studyContent(user,'lesson',lesson);
    const audiences=user.role==='admin'?['student','support','both']:['student','both'];
    const rows=await pool.query('SELECT faq_article_id FROM shared_topics_local WHERE lesson_id=$1 AND audience=ANY($2::text[]) AND faq_article_id IS NOT NULL',[lesson,audiences]);
    const faq=await readFaqArticles(), allowed=new Set(rows.rows.map(x=>x.faq_article_id));
    if(!faq.some(a=>allowed.has(a.id)&&JSON.parse(a.images||'[]').includes(id)))return new NextResponse('Não encontrada',{status:404});
    const image=await readFaqImage(id);return new NextResponse(image.bytes,{headers:{'Content-Type':image.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return new NextResponse('Imagem indisponível',{status:503})}
}
