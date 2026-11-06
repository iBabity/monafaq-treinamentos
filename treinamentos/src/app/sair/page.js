"use client";
import { useEffect, useState } from 'react';
export default function Sair() {
  const [failed, setFailed] = useState(false);
  useEffect(() => { let cancelled = false; (async () => {
    try { const r = await fetch('/api/logout', { method:'POST', cache:'no-store' }); if (!r.ok) throw new Error(); localStorage.removeItem('mnls_session'); window.location.replace('/login'); }
    catch { if (!cancelled) setFailed(true); }
  })(); return () => { cancelled = true; }; }, []);
  return <main style={{padding:32,fontFamily:'system-ui'}}>{failed ? <p>Não foi possível sair. <a href="/sair">Tentar novamente</a></p> : <p>Saindo…</p>}</main>;
}
