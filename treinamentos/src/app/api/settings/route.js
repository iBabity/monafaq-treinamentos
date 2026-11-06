import { pool } from '@/utils/db';
import { NextResponse } from 'next/server';
import { requireMaster, sameOrigin } from '@/utils/masterAccess';

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT valor FROM site_settings WHERE chave = 'featured_video_url'"
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ valor: '' });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth=await requireMaster(req);
    if(auth.response)return auth.response;
    if(!sameOrigin(req))return NextResponse.json({error:'Origem inválida.'},{status:403});
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 });
    }

    await pool.query(
      "INSERT INTO site_settings (chave, valor) VALUES ('featured_video_url', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1",
      [url]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
