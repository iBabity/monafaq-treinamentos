import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { requireSession } from '@/utils/auth';
import { studyContent } from '@/utils/learningApi';
import { restrictedImportedLessonIds } from '@/utils/faqLocal';

export async function GET(request) {
  try {
    const auth=requireSession(request);if(auth.response)return auth.response;
    const id=new URL(request.url).searchParams.get('lesson')||'';
    if(!id||id.length>255)return new NextResponse('Aula inválida',{status:400});
    const users=await pool.query('SELECT id,name,role,track_id FROM users WHERE id=$1',[auth.session.userId]);
    if(!users.rowCount)return new NextResponse('Acesso restrito',{status:403});
    const user=users.rows[0];await studyContent(user,'lesson',id);
    const result=await pool.query('SELECT video_url FROM lessons WHERE id=$1',[id]);
    const match=result.rows[0]?.video_url?.match(/^\/material-gestores\/([1-9]\d{0,2})\.webp$/);
    if(!match||Number(match[1])>244)return new NextResponse('Página não encontrada',{status:404});
    if(user.role!=='admin') {
      const restricted=await restrictedImportedLessonIds(pool);
      if(restricted.size) return new NextResponse('Página original indisponível enquanto há conteúdo restrito.',{status:403});
    }
    const image=await readFile(path.join(process.cwd(),'public','material-gestores',`${match[1]}.webp`));
    return new NextResponse(image,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return new NextResponse('Página indisponível',{status:503})}
}
