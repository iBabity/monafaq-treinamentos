import { NextResponse } from 'next/server';
import { currentPermissions } from '@/utils/masterAccess';
export async function GET(request) {
  try {const auth=await currentPermissions(request);if(auth.response)return auth.response;return NextResponse.json({admin:auth.user.role==='admin',master:auth.isMaster},{headers:{'Cache-Control':'no-store'}})}
  catch{return NextResponse.json({error:'Permissões indisponíveis.'},{status:503})}
}
