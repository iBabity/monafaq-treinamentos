import { pool } from '@/utils/db';
import { NextResponse } from 'next/server';

// POST /api/assigned-videos/progress — toggle visto/não visto
export async function POST(req) {
  try {
    const { id, visto } = await req.json();
    await pool.query('UPDATE assigned_videos SET visto = $1 WHERE id = $2', [visto, id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
