import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { currentPermissions,requireMaster,sameOrigin } from '@/utils/masterAccess';

export async function GET(request) {
  try {
    const auth=await currentPermissions(request,true);if(auth.response)return auth.response;
    const {rows}=await pool.query(`SELECT r.id,r.user_id,r.title,r.description,r.youtube_url,r.status,r.created_at,r.decided_at,
      u.name AS user_name,requester.name AS requester_name FROM assigned_video_requests r
      JOIN users u ON u.id=r.user_id JOIN users requester ON requester.id=r.requester_id
      WHERE ($1::boolean OR r.requester_id=$2) ORDER BY r.created_at DESC LIMIT 300`,[auth.isMaster,auth.user.id]);
    return NextResponse.json({requests:rows,master:auth.isMaster},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Solicitações indisponíveis.'},{status:503})}
}
export async function POST(request) {
  let db;
  try {
    const auth=await requireMaster(request);if(auth.response)return auth.response;
    if(!sameOrigin(request))return NextResponse.json({error:'Origem inválida.'},{status:403});
    const {id,decision}=await request.json();
    if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!['approve','reject'].includes(decision))return NextResponse.json({error:'Dados inválidos.'},{status:400});
    db=await pool.connect();await db.query('BEGIN');
    const result=await db.query('SELECT * FROM assigned_video_requests WHERE id=$1 FOR UPDATE',[id]);
    const item=result.rows[0];
    if(!item){await db.query('ROLLBACK');return NextResponse.json({error:'Solicitação não encontrada.'},{status:404})}
    if(item.status!=='pending'){await db.query('ROLLBACK');return NextResponse.json({error:'Esta solicitação já foi analisada.'},{status:409})}
    let videoId=null;
    if(decision==='approve'){
      if(!(await db.query("SELECT id FROM users WHERE id=$1 AND role='student'",[item.user_id])).rowCount){await db.query('ROLLBACK');return NextResponse.json({error:'O aluno não está disponível.'},{status:409})}
      videoId=`av_${item.id}`;
      await db.query('INSERT INTO assigned_videos(id,user_id,youtube_url,titulo,descricao) VALUES($1,$2,$3,$4,$5)',[videoId,item.user_id,item.youtube_url,item.title,item.description]);
    }
    const status=decision==='approve'?'approved':'rejected';
    await db.query('UPDATE assigned_video_requests SET status=$2,decided_by=$3,decided_at=now(),published_video_id=$4 WHERE id=$1',[id,status,auth.user.id,videoId]);
    await db.query('INSERT INTO admin_logs(acao,admin_id) VALUES($1,$2)',[`Vídeo ${decision==='approve'?'aprovado':'rejeitado'}: ${item.title}`.slice(0,255),auth.user.id]);
    await db.query('COMMIT');return NextResponse.json({success:true,status});
  }catch{if(db)await db.query('ROLLBACK').catch(()=>{});return NextResponse.json({error:'Não foi possível analisar a solicitação.'},{status:503})}finally{db?.release()}
}
