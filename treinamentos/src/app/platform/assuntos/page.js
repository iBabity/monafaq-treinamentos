'use client';
import { useEffect, useState } from 'react';

const audiences = { student:'Alunos', support:'Administradores', both:'Alunos e administradores' };
const initial = { title:'',body:'',category_id:'',audience:'support' };
export default function Assuntos() {
  const [data,setData]=useState(null), [form,setForm]=useState(null), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false), [historyPassword,setHistoryPassword]=useState(''), [history,setHistory]=useState(null), [historyError,setHistoryError]=useState('');
  async function load() {
    const res=await fetch('/api/assuntos-compartilhados',{cache:'no-store'});
    if(!res.ok) throw Error('Não foi possível carregar os assuntos.');
    setData(await res.json());
  }
  useEffect(()=>{load().catch(e=>setError(e.message))},[]);
  useEffect(()=>{if(!data?.master)return;function onKey(e){if(e.ctrlKey&&!e.altKey&&!e.metaKey&&e.key.toLowerCase()==='m'){e.preventDefault();setHistoryOpen(true)}}window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey)},[data?.master]);
  function closeHistory(){setHistoryOpen(false);setHistory(null);setHistoryPassword('');setHistoryError('')}
  async function openHistory(e){e.preventDefault();setHistoryError('');try{const r=await fetch('/api/assuntos-compartilhados/historico',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:historyPassword})});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível consultar o histórico.');setHistory(d.entries);setHistoryPassword('')}catch(err){setHistoryError(err.message)}}
  async function save(e) {
    e.preventDefault();setBusy(true);setError('');
    try {const payload=data.master?form:{id:form.id,body:form.body};const r=await fetch('/api/assuntos-compartilhados',{method:data.master?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível salvar.');setForm(null);await load()}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  async function remove(id) {
    if(!confirm('Excluir este assunto compartilhado?'))return;
    setBusy(true);setError('');
    try {const r=await fetch('/api/assuntos-compartilhados',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível excluir.');await load()}catch(err){setError(err.message)}finally{setBusy(false)}
  }
  const card={background:'var(--bg-card,#fff)',border:'1px solid var(--border-color,#dce6e8)',borderRadius:12,padding:20,margin:'14px 0'};
  return <main style={{maxWidth:1050,margin:'0 auto',padding:'30px 20px',fontFamily:'system-ui,sans-serif',color:'var(--text-primary,#193640)'}}>
    <a href="/platform" style={{color:'#327483'}}>← Voltar ao Treinamentos</a>
    <h1>Assuntos compartilhados</h1><p>Conteúdos organizados pelas categorias do Treinamentos.</p>
    {data?.master && <button onClick={()=>setForm({...initial})}>+ Novo assunto</button>}
    {error && <p role="alert">{error}</p>}
    {data?.master && historyOpen && <div role="dialog" aria-modal="true" aria-label="Histórico de ações" style={{position:'fixed',inset:0,background:'#0009',zIndex:500,display:'grid',placeItems:'center',padding:20}}><div style={{...card,width:'min(850px, 100%)',maxHeight:'85vh',overflow:'auto',color:'#193640',background:'#fff'}}><button type="button" onClick={closeHistory} style={{float:'right'}}>Fechar</button><h2>Histórico de ações</h2>{!history && <form onSubmit={openHistory}><label>Senha do histórico<br/><input type="password" value={historyPassword} onChange={e=>setHistoryPassword(e.target.value)} required autoFocus /></label>{' '}<button type="submit">Acessar</button></form>}{historyError && <p role="alert">{historyError}</p>}{history && (history.length?history.map((entry,i)=><div key={i} style={{borderTop:'1px solid #ddd',padding:'12px 0'}}><strong>{entry.action}</strong><p>{new Date(entry.created_at).toLocaleString('pt-BR')} · {entry.actor_email||entry.actor_id}</p>{entry.details && <p>{entry.details}</p>}{(entry.before_body||entry.after_body) && <details><summary>Ver alteração</summary>{entry.before_body && <p style={{whiteSpace:'pre-wrap'}}>Antes: {entry.before_body}</p>}{entry.after_body && <p style={{whiteSpace:'pre-wrap'}}>Depois: {entry.after_body}</p>}</details>}</div>):<p>Nenhuma ação registrada.</p>)}</div></div>}
    {form && <form onSubmit={save} style={card}>
      <h2>{form.id?'Editar assunto':'Novo assunto'}</h2>
      {data.master && <><label>Artigo do FAQ (opcional)<br/><select value={form.faq_article_id||''} onChange={e=>{const id=e.target.value,article=data.faqArticles.find(a=>a.id===id);setForm({...form,faq_article_id:id,title:article?.title||form.title,body:form.body||'Conteúdo do FAQ'})}} style={{width:'100%',padding:10}}><option value="">Texto criado nesta tela</option>{data.faqArticles.map(a=><option key={a.id} value={a.id}>{a.category} · {a.title}</option>)}</select></label><br/><br/>
      <label>Título<br/><input required readOnly={!!form.faq_article_id} maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={{width:'100%',padding:10}} /></label><br/><br/>
      <label>Categoria<br/><select required value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value,lesson_id:''})} style={{width:'100%',padding:10}}><option value="">Selecione</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><br/><br/>
      <label>Aula relacionada<br/><select value={form.lesson_id || ''} onChange={e=>setForm({...form,lesson_id:e.target.value})} style={{width:'100%',padding:10}}><option value="">Nenhuma aula selecionada</option>{data.lessons.filter(l=>l.category_id===form.category_id).map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</select></label><br/><br/>
      <label>Quem pode ver<br/><select value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})} style={{width:'100%',padding:10}}>{Object.entries(audiences).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><br/><br/></>}
      <label>Texto<br/><textarea required readOnly={!!form.faq_article_id} maxLength={30000} rows={12} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} style={{width:'100%',padding:10}} /></label>{form.faq_article_id && <p>Este texto vem do FAQ e deve ser editado no artigo original.</p>}<br/>
      <button disabled={busy} type="submit">Salvar</button>{' '}<button type="button" disabled={busy} onClick={()=>setForm(null)}>Cancelar</button>
    </form>}
    {!data && !error && <p>Carregando…</p>}
    {data && !data.topics.length && <p>Nenhum assunto disponível para seu perfil.</p>}
    {data?.topics.map(t=><article key={t.id} style={card}><small>{data.categories.find(c=>c.id===t.category_id)?.name}{data.admin?' · '+audiences[t.audience]:''}</small><h2>{t.title}</h2><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{t.body}</p>{t.faq_article_id && data.admin && <a href={`http://127.0.0.1:3081/faq.html#assunto-${t.faq_article_id}`}>Editar artigo no FAQ</a>}{data.admin && (data.master||(!t.faq_article_id&&t.audience!=='support')) && <>{' '}<button onClick={()=>setForm({...t})}>{t.faq_article_id?'Editar vínculo e público':'Editar texto'}</button></>}{data.master && <>{' '}<button disabled={busy} onClick={()=>remove(t.id)}>Excluir</button></>}</article>)}
  </main>;
}
