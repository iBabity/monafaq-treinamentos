import { pool } from '@/utils/db';
import { NextResponse } from 'next/server';
import { ensureTrackProgressSchema, setTrackProgressSummary } from '@/utils/trackProgress';
import crypto from 'node:crypto';
import { currentPermissions, requireMaster, sameOrigin } from '@/utils/masterAccess';

export async function GET(req) {
  try {
    const auth = await currentPermissions(req, true);
    if (auth.response) return auth.response;

    await ensureTrackProgressSchema();
    const result = await pool.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.role,
              u.track_id,
              u.profile_picture,
              u.one_user_id,
              CASE WHEN COALESCE(track_metrics.total_lessons,0)>0 THEN ROUND(100.0*COALESCE(progress_metrics.completed_lessons,0)/track_metrics.total_lessons)::int ELSE 0 END AS progresso_geral,
              COALESCE(track_metrics.total_lessons, 0)::int AS total_lessons,
              COALESCE(progress_metrics.completed_lessons, 0)::int AS completed_lessons,
              progress_metrics.last_completed_at,
              COALESCE(assigned_metrics.assigned_videos, 0)::int AS assigned_videos,
              COALESCE(assigned_metrics.seen_assigned_videos, 0)::int AS seen_assigned_videos,
              assigned_metrics.last_assigned_at
       FROM users u
       LEFT JOIN user_track_progress utp
         ON utp.user_id = u.id AND utp.track_id = COALESCE(u.track_id, 'track_padrao')
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total_lessons
         FROM lessons l
         JOIN categories c ON c.id = l.category_id
         WHERE (u.role='admin' OR (u.track_id='track_suporte' AND COALESCE(c.track_id,'track_padrao') IN ('track_padrao','track_suporte')) OR COALESCE(c.track_id,'track_padrao')=COALESCE(u.track_id,'track_padrao'))
       ) track_metrics ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS completed_lessons,
                MAX(up.completed_at) AS last_completed_at
         FROM user_progress up
         JOIN lessons l ON l.id = up.video_id
         JOIN categories c ON c.id = l.category_id
         WHERE up.user_id = u.id
           AND (u.role='admin' OR (u.track_id='track_suporte' AND COALESCE(c.track_id,'track_padrao') IN ('track_padrao','track_suporte')) OR COALESCE(c.track_id,'track_padrao')=COALESCE(u.track_id,'track_padrao'))
       ) progress_metrics ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS assigned_videos,
                COUNT(*) FILTER (WHERE av.visto IS TRUE) AS seen_assigned_videos,
                MAX(av.data_atribuicao) AS last_assigned_at
         FROM assigned_videos av
         WHERE av.user_id = u.id
       ) assigned_metrics ON TRUE
       WHERE ($1::boolean OR u.role='student') ORDER BY u.name`, [auth.isMaster]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await currentPermissions(req, true);
    if (auth.response) return auth.response;

    if (!sameOrigin(req)) return NextResponse.json({error:'Origem inválida.'},{status:403});
    const data = await req.json();
    if (data.createStudent === true || data.createAdmin === true) {
      if (data.createStudent === true && data.createAdmin === true) return NextResponse.json({error:'Perfil inválido.'},{status:400});
      if (data.createAdmin === true && !auth.isMaster) return NextResponse.json({error:'Somente o master pode cadastrar administradores.'},{status:403});
      if (data.role && data.role !== (data.createAdmin ? 'admin' : 'student')) return NextResponse.json({error:'Perfil inválido.'},{status:400});
      const role = data.createAdmin ? 'admin' : 'student';
      const name=String(data.name||'').trim(), email=String(data.email||'').trim().toLowerCase(), password=String(data.password||'');
      if (!name || name.length>120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>200 || password.length<8 || password.length>128) return NextResponse.json({error:'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.'},{status:400});
      const salt=crypto.randomBytes(16).toString('hex'), hash=crypto.scryptSync(password,salt,64).toString('hex'), client=await pool.connect();
      try { await client.query('BEGIN');
        if ((await client.query('SELECT 1 FROM users WHERE lower(email)=lower($1)',[email])).rowCount) { await client.query('ROLLBACK'); return NextResponse.json({error:'Já existe uma conta com esse e-mail.'},{status:409}); }
        const id='local_'+crypto.randomUUID();
        await client.query("INSERT INTO users(id,name,email,password,role,track_id) VALUES($1,$2,$3,$4,$5,'track_padrao')",[id,name,email,['scrypt',salt,hash].join('$'),role]);
        await client.query('INSERT INTO admin_logs(acao,admin_id) VALUES($1,$2)',[((role === 'admin' ? 'Administrador cadastrado: ' : 'Aluno cadastrado: ')+name).slice(0,255),auth.user.id]);
        await client.query('COMMIT'); return NextResponse.json({success:true,id});
      } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    }
    if (!auth.isMaster) return NextResponse.json({error:'Somente o master pode alterar usuários.'},{status:403});
    await ensureTrackProgressSchema();
    const { id, role, track_id, profile_picture, progresso_geral } = data;
    if (!id) {
      return NextResponse.json({ error: 'Usuario obrigatorio.' }, { status: 400 });
    }
    if (role && !['admin', 'student'].includes(role)) {
      return NextResponse.json({ error: 'Perfil invalido.' }, { status: 400 });
    }

    const exists = await pool.query('SELECT role FROM users WHERE id = $1 AND one_user_id IS NOT NULL', [id]);
    if (exists.rowCount === 0) {
      return NextResponse.json(
        { error: 'Usuarios do Treinamentos devem entrar primeiro pelo One.' },
        { status: 409 }
      );
    }

    const resolvedTrackId = track_id || 'track_padrao';
    const pct = progresso_geral != null ? Math.min(100, Math.max(0, Number(progresso_geral) || 0)) : 0;

    await pool.query(
      `UPDATE users
       SET role = $2,
           track_id = $3,
           profile_picture = COALESCE($4, profile_picture),
           progresso_geral = $5
       WHERE id = $1 AND one_user_id IS NOT NULL`,
      [
        id,
        role || exists.rows[0].role,
        resolvedTrackId,
        profile_picture || null,
        pct,
      ]
    );

    await setTrackProgressSummary(id, resolvedTrackId, pct);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const auth = await requireMaster(req);
    if (auth.response) return auth.response;
    if (!sameOrigin(req)) return NextResponse.json({error:'Origem inválida.'},{status:403});

    const { id } = await req.json();
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
