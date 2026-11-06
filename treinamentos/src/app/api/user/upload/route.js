import { currentPermissions } from '@/utils/masterAccess';
import { NextResponse } from 'next/server';
import { pool } from '@/utils/db';
import fs from 'fs';
import path from 'path';
import { canAccessUser, requireSession } from '@/utils/auth';

export async function POST(request) {
  try {
    const auth = requireSession(request);
    if (auth.response) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file');
    const userId = formData.get('user_id');

    if (!file || !userId) {
      return NextResponse.json({ error: 'File and User ID required' }, { status: 400 });
    }
    if (auth.session.userId !== userId) { const permission=await currentPermissions(request,true); if(permission.response || !permission.isMaster) return NextResponse.json({error:'Acesso restrito.'},{status:403}); }
    if (!canAccessUser(auth.session, userId)) {
      return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${userId}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'static', 'uploads', 'profiles');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    const publicPath = `/static/uploads/profiles/${filename}`;

    // Update database
    await pool.query('UPDATE users SET profile_picture = $1 WHERE id = $2', [publicPath, userId]);

    return NextResponse.json({ success: true, path: publicPath });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
