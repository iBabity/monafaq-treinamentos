import crypto from 'node:crypto';
import { pool } from '@/utils/db';
import { learningRoute, learningBody, requiredText, studyContent, LearningError } from '@/utils/learningApi';
import { canStudyTrack } from '@/utils/learningRules';
import { readFaqArticles } from '@/utils/faqLocal';

async function master(user) {
  const { rows } = await pool.query('SELECT email FROM users WHERE id=$1 AND role=$2', [user.id,'admin']);
  return process.env.NODE_ENV !== 'production' && rows[0]?.email?.toLowerCase() === (process.env.FAQ_MASTER_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)[0];
}
export async function GET(request) {
  return learningRoute(request, false, async user => {
    const isMaster = await master(user);
    const categories = (await pool.query('SELECT id,name,track_id,sort_order FROM categories ORDER BY sort_order,name')).rows
      .filter(category => canStudyTrack(user,category.track_id));
    const allowed = categories.map(category => category.id);
    const audiences = user.role === 'admin' ? ['student','support','both'] : ['student','both'];
    const lesson = new URL(request.url).searchParams.get('lesson');
    if(user.role !== 'admin' && !lesson) throw new LearningError('Acesse o conteúdo pela aula.',403);
    if (lesson) await studyContent(user,'lesson',requiredText(lesson,'Aula'));
    const { rows } = await pool.query(`SELECT t.id,t.category_id,t.lesson_id,t.faq_article_id,t.title,t.body,t.audience,t.updated_at
      FROM shared_topics_local t WHERE t.category_id=ANY($1::text[]) AND t.audience=ANY($2::text[])
      AND ($3::text IS NULL OR t.lesson_id=$3) ORDER BY t.updated_at DESC,t.id`, [allowed,audiences,lesson]);
    const lessons = isMaster ? (await pool.query('SELECT id,title,category_id FROM lessons ORDER BY title')).rows : [];
    let faqArticles=(isMaster || rows.some(row=>row.faq_article_id)) ? await readFaqArticles() : [];
    const byId=new Map(faqArticles.map(article=>[article.id,article]));
    const topics=rows.filter(row=>!row.faq_article_id||byId.has(row.faq_article_id)).map(row=>row.faq_article_id?{...row,title:byId.get(row.faq_article_id).title,body:(byId.get(row.faq_article_id).body||'').replace(/^\[\[ocultar-manual\]\]\n?/,''),images:JSON.parse(byId.get(row.faq_article_id).images||'[]')}:row);
    const mentions=[...new Set(topics.flatMap(t=>[...t.body.matchAll(/\[\[artigo:(m-\d+|[0-9a-f-]{36})\]\]/gi)].map(m=>m[1])))];
    let links=[];
    if(mentions.length){
      const targets=await pool.query(`SELECT faq_article_id,lesson_id FROM shared_topics_local WHERE faq_article_id=ANY($1::text[]) AND category_id=ANY($2::text[]) AND audience=ANY($3::text[]) AND lesson_id IS NOT NULL`,[mentions,allowed,audiences]);
      if(targets.rowCount&&!faqArticles.length)faqArticles=await readFaqArticles();
      const available=new Map(faqArticles.map(article=>[article.id,article]));
      links=targets.rows.filter(t=>available.has(t.faq_article_id)).map(t=>({id:t.faq_article_id,lesson_id:t.lesson_id,title:available.get(t.faq_article_id).title}));
    }
    return { topics,categories,lessons,links,faqArticles:isMaster?faqArticles.map(a=>({id:a.id,title:a.title,category:a.category})):[],master:isMaster,admin:user.role === 'admin' };
  });
}
export async function POST(request) {
  return learningRoute(request, false, async user => {
    if (!await master(user)) throw new LearningError('Apenas o master pode editar estes assuntos.',403);
    const data=await learningBody(request);
    let title=requiredText(data.title,'Título',200), body=requiredText(data.body,'Texto',30000);
    const category=requiredText(data.category_id,'Categoria');
    if (!['student','support','both'].includes(data.audience)) throw new LearningError('Público inválido.');
    const lessonId=data.lesson_id || null;
    const faqId=data.faq_article_id || null;
    if(faqId!==null && (typeof faqId!=='string'||!/^(m-\d+|[0-9a-f-]{36})$/.test(faqId))) throw new LearningError('Artigo inválido.');
    if(faqId){const source=(await readFaqArticles()).find(article=>article.id===faqId);if(!source)throw new LearningError('Artigo do FAQ não encontrado.',404);title=source.title;body=source.body||'Consulte o artigo original.';}
    if (lessonId !== null && (typeof lessonId !== 'string' || lessonId.length>255)) throw new LearningError('Aula inválida.');
    if (data.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)) throw new LearningError('Identificador inválido.');
    const db=await pool.connect();
    try {
      await db.query('BEGIN');
      if (!(await db.query('SELECT id FROM categories WHERE id=$1',[category])).rowCount) throw new LearningError('Categoria não encontrada.');
      if (lessonId && !(await db.query('SELECT id FROM lessons WHERE id=$1 AND category_id=$2',[lessonId,category])).rowCount) throw new LearningError('A aula deve pertencer à categoria escolhida.');
      const id=data.id || crypto.randomUUID();
      const exists=await db.query('SELECT id,title,body FROM shared_topics_local WHERE id=$1 FOR UPDATE',[id]);
      if(data.id && !exists.rowCount) throw new LearningError('Assunto não encontrado.',404);
      await db.query(`INSERT INTO shared_topics_local(id,category_id,title,body,audience,lesson_id,faq_article_id) VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(id) DO UPDATE SET category_id=$2,title=$3,body=$4,audience=$5,lesson_id=$6,faq_article_id=$7,updated_at=now()`,[id,category,title,body,data.audience,lessonId,faqId]);
      await db.query('INSERT INTO shared_topics_local_audit(id,topic_id,actor_id,action,actor_name,title,before_body,after_body) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),id,user.id,exists.rowCount?'editado':'criado',user.name,title,exists.rows[0]?.body || null,body]);
      await db.query('COMMIT'); return {id};
    } catch(error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  });
}
export async function PATCH(request) {
  return learningRoute(request, true, async user => {
    const {id,body:rawBody}=await learningBody(request), body=requiredText(rawBody,'Texto',30000);
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new LearningError('Identificador inválido.');
    const isMaster=await master(user), db=await pool.connect();
    try {
      await db.query('BEGIN');
      const result=await db.query('SELECT id,title,body,audience,faq_article_id FROM shared_topics_local WHERE id=$1 FOR UPDATE',[id]);
      const item=result.rows[0];
      if(!item) throw new LearningError('Assunto não encontrado.',404);
      if(item.faq_article_id) throw new LearningError('Edite o texto no artigo original do FAQ.',400);
      if(!isMaster && !['student','both'].includes(item.audience)) throw new LearningError('Este assunto só pode ser editado pelo master.',403);
      await db.query('UPDATE shared_topics_local SET body=$2,updated_at=now() WHERE id=$1',[id,body]);
      await db.query('INSERT INTO shared_topics_local_audit(id,topic_id,actor_id,action,actor_name,title,before_body,after_body) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),id,user.id,'texto editado',user.name,item.title,item.body,body]);
      await db.query('COMMIT');return {ok:true};
    } catch(error) {await db.query('ROLLBACK');throw error} finally {db.release()}
  });
}
export async function DELETE(request) {
  return learningRoute(request, false, async user => {
    if (!await master(user)) throw new LearningError('Apenas o master pode excluir estes assuntos.',403);
    const {id}=await learningBody(request);
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new LearningError('Identificador inválido.');
    const db=await pool.connect();
    try {
      await db.query('BEGIN');
      const result=await db.query('DELETE FROM shared_topics_local WHERE id=$1 RETURNING id,title,body',[id]);
      if (!result.rowCount) throw new LearningError('Assunto não encontrado.',404);
      await db.query('INSERT INTO shared_topics_local_audit(id,topic_id,actor_id,action,actor_name,title,before_body) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),id,user.id,'excluído',user.name,result.rows[0].title,result.rows[0].body]);
      await db.query('COMMIT'); return {ok:true};
    } catch(error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  });
}
