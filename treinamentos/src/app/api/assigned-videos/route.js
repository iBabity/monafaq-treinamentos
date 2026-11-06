import crypto from 'node:crypto';
import { pool } from '@/utils/db';
import { NextResponse } from 'next/server';
import { getYouTubeVideoId } from '@/utils/youtube';
import { currentPermissions,sameOrigin } from '@/utils/masterAccess';

export async function GET(req) {
  try {
    const auth=await currentPermissions(req);if(auth.response)return auth.response;
    const userId=new URL(req.url).searchParams.get('user_id');
    if((!userId&&auth.user.role!=='admin')||(userId&&auth.user.role!=='admin'&&userId!==auth.user.id))return NextResponse.json({error:'Acesso restrito.'},{status:403});
    const result=await pool.query(`SELECT av.*,u.name AS user_name FROM assigned_videos av JOIN users u ON u.id=av.user_id
      WHERE ($1::text IS NULL OR av.user_id=$1) ORDER BY av.data_atribuicao DESC`,[userId]);
    return NextResponse.json(result.rows,{headers:{'Cache-Control':'no-store'}});
  } catch{return NextResponse.json({error:'Não foi possível carregar os vídeos.'},{status:503})}
}
export async function POST(req) {
  let db;
  try {
    const auth=await currentPermissions(req,true);if(auth.response)return auth.response;
    if(!sameOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
    const {user_id,youtube_url,titulo,descricao=''}=await req.json();
    if(typeof user_id!=='string'||!user_id||user_id.length>255||typeof titulo!=='string'||!titulo.trim()||titulo.trim().length>200||typeof descricao!=='string'||descricao.length>12000||typeof youtube_url!=='string'||youtube_url.length>2048)return NextResponse.json({error:'Dados inválidos.'},{status:400});
    let url;try{url=new URL(youtube_url)}catch{return NextResponse.json({error:'Informe uma URL do YouTube.'},{status:400})}
    const host=url.hostname.toLowerCase().replace(/^www\./,'');const videoId=getYouTubeVideoId(youtube_url);
    if(url.protocol!=='https:'||!['youtube.com','m.youtube.com','youtu.be'].includes(host)||!/^[a-zA-Z0-9_-]{11}$/.test(videoId))return NextResponse.json({error:'Informe uma URL válida do YouTube.'},{status:400});
    const embed=`https://www.youtube.com/embed/${videoId}`,id=crypto.randomUUID();
    db=await pool.connect();await db.query('BEGIN');
    if(!(await db.query("SELECT id FROM users WHERE id=$1 AND role='student'",[user_id])).rowCount){await db.query('ROLLBACK');return NextResponse.json({error:'Aluno não encontrado.'},{status:400})}
    if(auth.isMaster){
      const video=`av_${id}`;
      await db.query('INSERT INTO assigned_videos(id,user_id,youtube_url,titulo,descricao) VALUES($1,$2,$3,$4,$5)',[video,user_id,embed,titulo.trim(),descricao]);
      await db.query('INSERT INTO admin_logs(acao,admin_id) VALUES($1,$2)',[`Vídeo atribuído: ${titulo.trim()}`.slice(0,255),auth.user.id]);
      await db.query('COMMIT');return NextResponse.json({success:true,id:video,status:'published'});
    }
    await db.query('INSERT INTO assigned_video_requests(id,user_id,requester_id,youtube_url,title,description) VALUES($1,$2,$3,$4,$5,$6)',[id,user_id,auth.user.id,embed,titulo.trim(),descricao]);
    await db.query('INSERT INTO admin_logs(acao,admin_id) VALUES($1,$2)',[`Vídeo enviado para aprovação: ${titulo.trim()}`.slice(0,255),auth.user.id]);
    await db.query('COMMIT');return NextResponse.json({success:true,id,status:'pending'});
  } catch{if(db)await db.query('ROLLBACK').catch(()=>{});return NextResponse.json({error:'Não foi possível enviar o vídeo.'},{status:503})}finally{db?.release()}
}
export async function DELETE(req) {
  let db;
  try {
    const auth=await currentPermissions(req,true);if(auth.response)return auth.response;
    if(!sameOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
    const {id}=await req.json();if(typeof id!=='string'||!id||id.length>255)return NextResponse.json({error:'Identificador inválido.'},{status:400});
    db=await pool.connect();await db.query('BEGIN');const result=await db.query('DELETE FROM assigned_videos WHERE id=$1 RETURNING titulo',[id]);
    if(!result.rowCount){await db.query('ROLLBACK');return NextResponse.json({error:'Vídeo não encontrado.'},{status:404})}
    await db.query('INSERT INTO admin_logs(acao,admin_id) VALUES($1,$2)',[`Vídeo removido: ${result.rows[0].titulo}`.slice(0,255),auth.user.id]);await db.query('COMMIT');return NextResponse.json({success:true});
  }catch{if(db)await db.query('ROLLBACK').catch(()=>{});return NextResponse.json({error:'Não foi possível remover o vídeo.'},{status:503})}finally{db?.release()}
}
