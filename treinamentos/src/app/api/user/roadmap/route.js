import { ensureLearningSchema } from '@/utils/learningApi';
import { canStudyTrack, orderedCategories } from '@/utils/learningRules';
import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import { ensureTrackProgressSchema } from '@/utils/trackProgress';
import { canAccessUser, requireSession } from '@/utils/auth';
import { restrictedImportedLessonIds } from '@/utils/faqLocal';

export async function GET(request) {
  const auth = requireSession(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }
  if (!canAccessUser(auth.session, userId)) {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
  }

  try {
    await ensureTrackProgressSchema();
    await ensureLearningSchema();
    console.log('Roadmap API: Fetching for user', userId);
    
    // Fetch user track and role
    const userRes = await pool.query('SELECT role, track_id FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { role, track_id } = userRes.rows[0];

    const categoriesRes = await pool.query('SELECT id,name,sort_order,parent_id,track_id FROM categories ORDER BY sort_order');
    const categories = orderedCategories(categoriesRes.rows.filter(c => canStudyTrack({role,track_id},c.track_id)));
    const lessonsRes = await pool.query('SELECT id,title,category_id FROM lessons');
    const hidden=role==='admin'?new Set():await restrictedImportedLessonIds(pool);
    const allLessons = lessonsRes.rows.filter(l=>!hidden.has(l.id));
    const progressRes = await pool.query('SELECT video_id FROM user_progress WHERE user_id=$1',[userId]);
    const completedIds = new Set(progressRes.rows.map(r => r.video_id));

    // Calculate progress for each category
    const roadmap = categories.map(cat => {
      const catLessons = allLessons.filter(l => l.category_id === cat.id);
      const total = catLessons.length;
      const completed = catLessons.filter(l => completedIds.has(l.id)).length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: cat.id,
        title: cat.name,
        sort_order: cat.sort_order,
        totalLessons: total,
        completedLessons: completed,
        progressPct: pct,
        status: (total > 0 && pct === 100) ? 'concluido' : (pct > 0 ? 'em_progresso' : 'pendente')
      };
    });

    console.log('Roadmap API: Success');
    return NextResponse.json(roadmap);
  } catch (err) {
    console.error('Roadmap API Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
