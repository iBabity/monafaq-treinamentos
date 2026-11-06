import { pool } from '@/utils/db';
import { learningRoute, learningBody, LearningError } from '@/utils/learningApi';

export async function POST(request) {
  return learningRoute(request, true, async user => {
    const {rows:users}=await pool.query('SELECT email FROM users WHERE id=$1',[user.id]);
    if(process.env.NODE_ENV==='production' || users[0]?.email?.toLowerCase()!==(process.env.FAQ_MASTER_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)[0]) throw new LearningError('Histórico restrito ao master.',403);
    const {password}=await learningBody(request);
    if(typeof password!=='string'||!password||password.length>256) throw new LearningError('Senha inválida.');
    let upstream;
    try {
      upstream=await fetch('http://127.0.0.1:3081/api/auditoria',{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://127.0.0.1:3081','Cookie':request.headers.get('cookie')||''},body:JSON.stringify({password,offset:0}),cache:'no-store'});
    } catch { throw new LearningError('Histórico do FAQ indisponível.',503); }
    const source=await upstream.json().catch(()=>({}));
    if(!upstream.ok) throw new LearningError(source.error||'Não foi possível acessar o histórico.',upstream.status);
    const {rows}=await pool.query(`SELECT at AS created_at,actor_name AS actor_email,actor_id,action,title,before_body,after_body
      FROM shared_topics_local_audit ORDER BY at DESC,id DESC LIMIT 100`);
    const shared=rows.map(x=>({...x,action:`Assunto compartilhado: ${x.action}`,details:x.title||''}));
    const adminLog=await pool.query(`SELECT l."timestamp" AS created_at,l.admin_id AS actor_id,u.name AS actor_email,l.acao AS action
      FROM admin_logs l LEFT JOIN users u ON u.id=l.admin_id ORDER BY l."timestamp" DESC,l.id DESC LIMIT 100`);
    const entries=[...(source.entries||[]),...shared,...adminLog.rows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,100);
    return {entries};
  });
}
