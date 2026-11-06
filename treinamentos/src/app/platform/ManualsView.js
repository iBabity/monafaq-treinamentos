'use client';

import { CopyContentLink, ReviewStamp } from './ContentSharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import './manuals.css';
import ManualWriter from './ManualWriter';

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os manuais.');
  return data;
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const manualCount = count => `${count} ${count === 1 ? 'manual' : 'manuais'}`;
const sizeLabel = bytes => bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
function IconButton({ label, icon, ...props }) {
  return <button type="button" className="manual-icon" title={label} aria-label={label} {...props}>{Icons[icon]}</button>;
}
function Dialog({ title, onClose, children, busy }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} className="manual-dialog" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header><h3>{title}</h3><IconButton label="Fechar" icon="close" onClick={onClose} disabled={busy} /></header>
    {children}
  </dialog>;
}

export default function ManualsView({ admin = false, showToast }) {
  const [tree, setTree] = useState([]);
  const [treeError, setTreeError] = useState('');
  const [treeLoading, setTreeLoading] = useState(true);
  const [systemId, setSystemId] = useState('');
  const [programId, setProgramId] = useState('');
  const [expandedSystem, setExpandedSystem] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState(null);
  const [folder, setFolder] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const resourceKey = JSON.stringify([admin, search, systemId, programId, status, page, refresh]);
  const loading = resource?.key !== resourceKey;
  const result = loading ? { items: [], total: 0 } : resource.data || { items: [], total: 0 };
  const error = loading ? '' : resource.error || '';
  const system = tree.find(item => item.id === systemId);
  const program = system?.programs.find(item => item.id === programId);
  const browsing = !search && !programId && status === 'all';

  const loadTree = useCallback(() => request(`/api/manuals/tree?view=${admin ? 'admin' : 'student'}`)
    .then(systems => { setTree(systems); setTreeError(''); })
    .catch(err => setTreeError(err.message))
    .finally(() => setTreeLoading(false)), [admin]);
  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ view: admin ? 'admin' : 'student', q: search, systemId, programId, status, page: String(page) });
    request(`/api/manuals?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResource({ key: resourceKey, data }); })
      .catch(err => { if (!controller.signal.aborted) setResource({ key: resourceKey, error: err.message }); });
    return () => controller.abort();
  }, [admin, search, systemId, programId, status, page, resourceKey]);
  function select(nextSystem = '', nextProgram = '') { setSystemId(nextSystem); setProgramId(nextProgram); setExpandedSystem(nextSystem); setPage(1); }
  function open(setter, value) { setActionError(''); setter(value); }
  async function editManual(item, clone = false) {
    setActionError('');
    try {
      const full = await request('/api/manuals/' + item.id);
      setEditor(clone ? { ...full, id: undefined, revision: undefined, title: full.title + ' (cópia)', published: false } : full);
    } catch (err) { setActionError(err.message); }
  }
  async function mutate(work, close) {
    setBusy(true); setActionError('');
    try {
      await work(); close();
      await loadTree(); setRefresh(value => value + 1); setPage(1);
      showToast?.('Alteração salva.');
    } catch (err) { setActionError(err.message); }
    finally { setBusy(false); }
  }
  const currentFolder = program ? { kind: 'program', id: program.id, name: program.name, systemId } : system ? { kind: 'system', id: system.id, name: system.name } : null;

  return <section className="manuals" aria-label="Manuais do Sistema">
    <header className="manual-header">
      <div><h2>Manuais do Sistema</h2><span className="manual-muted">Biblioteca de documentos</span></div>
      <div className="manual-actions">
        <IconButton label="Como usar" icon="help" onClick={() => setHelp(true)} />
        {admin && <button className="btn-ghost" onClick={() => open(setEditor, { templateMode: true })}>Modelos</button>}
        {admin && <button className="btn-primary" disabled={!tree.some(s => s.programs.length)} onClick={() => open(setEditor, {})}>{Icons.plus} Novo manual</button>}
      </div>
    </header>
    {actionError && !editor && !folder && !removing && <p role="alert" className="manual-error">{actionError}</p>}
    <div className="manual-toolbar">
      <label className="manual-search">{Icons.search}<input aria-label="Buscar manuais" placeholder="Buscar por título ou palavras-chave" maxLength={120} value={query} onChange={e => setQuery(e.target.value)} />
        {query && <IconButton label="Limpar busca" icon="close" onClick={() => setQuery('')} />}
      </label>
      {admin && <label className="manual-status">Situação<select aria-label="Situação dos manuais" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="all">Todas</option><option value="published">Publicados</option><option value="draft">Rascunhos</option></select></label>}
    </div>
    <div className="manual-layout">
      <nav className="manual-tree" aria-label="Sistemas e programas">
        <div className="manual-tree-title"><strong>Sistemas</strong>{admin && <IconButton label="Novo sistema" icon="plus" onClick={() => open(setFolder, { kind: 'system', name: '' })} />}</div>
        <button className={!systemId ? 'selected' : ''} aria-pressed={!systemId} onClick={() => select()}>{Icons.categories} Todos os sistemas</button>
        {tree.map(item => <div key={item.id}>
          <button className={systemId === item.id && !programId ? 'selected' : ''} aria-expanded={expandedSystem === item.id} onClick={() => { const wasOpen = expandedSystem === item.id; select(item.id); if (wasOpen) setExpandedSystem(''); }}>{Icons[expandedSystem === item.id ? 'down' : 'chevronRight']}<span>{item.name}</span></button>
          {expandedSystem === item.id && <div className="manual-tree-programs">{item.programs.map(p => <button key={p.id} className={programId === p.id ? 'selected' : ''} aria-pressed={programId === p.id} onClick={() => select(item.id, p.id)}>{Icons.pdv}<span>{p.name}</span><small>{p.manual_count}</small></button>)}</div>}
        </div>)}
        {treeLoading && <p className="manual-muted" role="status">Carregando sistemas...</p>}
        {treeError && <div className="manual-error" role="alert">{treeError}<button onClick={loadTree}>Tentar novamente</button></div>}
      </nav>
      <div className="manual-content">
        <div className="manual-path-row">
          <nav className="manual-path" aria-label="Caminho dos manuais"><button onClick={() => select()}>Sistemas</button>{system && <>{Icons.chevronRight}<button onClick={() => select(systemId)}>{system.name}</button></>}{program && <>{Icons.chevronRight}<span>{program.name}</span></>}</nav>
          {admin && <div className="manual-actions">
            {system && !program && <button className="btn-ghost" onClick={() => open(setFolder, { kind: 'program', name: '', systemId })}>{Icons.plus} Programa</button>}
            {currentFolder && <><IconButton label={`Editar ${currentFolder.name}`} icon="edit" onClick={() => open(setFolder, currentFolder)} /><IconButton label={`Excluir ${currentFolder.name}`} icon="delete" onClick={() => open(setRemoving, { type: 'folder', ...currentFolder })} /></>}
          </div>}
        </div>
        {error ? <div role="alert" className="manual-error">{error}<button onClick={() => setRefresh(x => x + 1)}>Tentar novamente</button></div> : browsing ? <>
          <h3>{system ? 'Programas' : 'Sistemas disponíveis'}</h3>
          {(system ? system.programs : tree).map(item => <button className="manual-folder-row" key={item.id} onClick={() => system ? select(systemId, item.id) : select(item.id)}>
            {Icons[system ? 'pdv' : 'categories']}<span><strong>{item.name}</strong><small>{system ? manualCount(item.manual_count) : `${item.programs.length} ${item.programs.length === 1 ? 'programa' : 'programas'}`}</small></span>{Icons.chevronRight}
          </button>)}
          {!treeLoading && !(system ? system.programs.length : tree.length) && <div className="manual-empty">{Icons.categories}<h3>{system ? 'Nenhum programa cadastrado' : 'Nenhum manual disponível'}</h3>{admin && <button className="btn-primary" onClick={() => open(setFolder, system ? { kind: 'program', name: '', systemId } : { kind: 'system', name: '' })}>{Icons.plus} {system ? 'Novo programa' : 'Novo sistema'}</button>}</div>}
        </> : loading ? <p role="status" className="manual-empty">Carregando manuais...</p> : <>
          <div className="manual-results"><h3>{program?.name || 'Resultados da busca'}</h3><span role="status">{manualCount(result.total)}</span></div>
          {!result.items.length && <div className="manual-empty">{Icons.search}<h3>Nenhum manual encontrado</h3>{query && <button className="btn-ghost" onClick={() => setQuery('')}>Limpar busca</button>}</div>}
          {result.items.map(item => <article className="manual-row" key={item.id}>
            <div className="manual-pdf-icon">{Icons.fiscal}<span>{item.content_type === 'html' ? 'GUIA' : 'PDF'}</span></div>
            <div className="manual-details"><div className="manual-row-title"><h4>{item.title}</h4>{admin && <span className={`manual-badge ${item.published ? 'published' : ''}`}>{item.published ? 'Publicado' : 'Rascunho'}</span>}</div>
              <button className="manual-location" onClick={() => { select(item.system_id, item.program_id); setQuery(''); }}>{item.system_name} / {item.program_name}</button>
              {item.description && <p>{item.description}</p>}
              <ReviewStamp name={item.reviewed_by_name} /><CopyContentLink path={`/manuais/${item.id}`} disabled={!item.published} /><div className="manual-meta"><span>{item.content_type === 'html' ? 'Manual digital' : `${item.page_count} pág.`}</span><span>{sizeLabel(item.byte_size)}</span>{item.version && <span>Versão {item.version}</span>}<span>Atualizado em {new Date(item.updated_at).toLocaleDateString('pt-BR')}</span></div>
              {item.keywords && <div className="manual-tags">{item.keywords.split(',').map(s => s.trim()).filter(Boolean).map((tag, i) => <span key={i}>{tag}</span>)}</div>}
            </div>
            <div className="manual-row-actions"><a className="btn-ghost" href={item.published ? `/manuais/${item.id}` : `/api/manuals/${item.id}/file?view=admin`} target="_blank" rel="noopener noreferrer">{item.content_type === 'html' ? 'Ler manual' : 'Abrir PDF'} {Icons.chevronRight}</a><a className="manual-icon" aria-label={`Baixar ${item.title}`} title="Baixar manual" href={`/api/manuals/${item.id}/file?download=1&view=${admin ? 'admin' : 'student'}`}>{Icons.down}</a>{admin && <><>{item.content_type === 'html' && <button type="button" className="btn-ghost" onClick={() => editManual(item, true)}>Clonar manual</button>}</><IconButton label={`Editar ${item.title}`} icon="edit" onClick={() => editManual(item)} /><IconButton label={`Excluir ${item.title}`} icon="delete" onClick={() => open(setRemoving, { type: 'manual', ...item })} /></>}</div>
          </article>)}
          {result.total > 30 && <nav className="manual-pagination" aria-label="Páginas dos manuais"><IconButton label="Página anterior" icon="chevronLeft" disabled={page === 1} onClick={() => setPage(page - 1)} /><span>{page} / {Math.ceil(result.total / 30)}</span><IconButton label="Próxima página" icon="chevronRight" disabled={page * 30 >= result.total} onClick={() => setPage(page + 1)} /></nav>}
        </>}
      </div>
    </div>

    {editor && (editor.content_type === 'pdf' ? <ManualEditor key={editor.id || 'new'} item={editor} tree={tree} initialProgramId={programId} initialSystemId={systemId} busy={busy} error={actionError} onClose={() => setEditor(null)} onSave={(input, file) => mutate(() => {
      const form = new FormData(); form.set('metadata', JSON.stringify(input)); if (file) form.set('file', file);
      return request('/api/manuals', { method: 'POST', body: form });
    }, () => setEditor(null))} /> : <ManualWriter key={editor.id || (editor.templateMode ? 'templates' : 'new')} item={editor} tree={tree} initialProgramId={programId} initialSystemId={systemId} busy={busy} error={actionError} onClose={() => setEditor(null)} onSave={input => mutate(() => {
      const form = new FormData(); form.set('metadata', JSON.stringify(input));
      return request('/api/manuals', { method: 'POST', body: form });
    }, () => setEditor(null))} />)}
    {folder && <Dialog title={folder.id ? 'Editar pasta' : folder.kind === 'system' ? 'Novo sistema' : 'Novo programa'} busy={busy} onClose={() => setFolder(null)}><form onSubmit={e => { e.preventDefault(); mutate(() => request('/api/manuals/tree', json('POST', folder)), () => setFolder(null)); }}>
      <label>Nome<input required maxLength={100} autoFocus value={folder.name} onChange={e => setFolder({ ...folder, name: e.target.value })} /></label>
      {folder.kind === 'program' && <label>Sistema<select required value={folder.systemId} onChange={e => setFolder({ ...folder, systemId: e.target.value })}>{tree.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      {actionError && <p role="alert" className="manual-error">{actionError}</p>}<footer><button type="button" className="btn-ghost" disabled={busy} onClick={() => setFolder(null)}>Cancelar</button><button className="btn-primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button></footer>
    </form></Dialog>}
    {removing && <Dialog title="Excluir item" busy={busy} onClose={() => setRemoving(null)}><p>Excluir <strong>{removing.title || removing.name}</strong>?</p><p>{removing.type === 'manual' ? 'O manual será removido da biblioteca.' : 'A pasta precisa estar vazia.'}</p>{actionError && <p className="manual-error" role="alert">{actionError}</p>}<footer><button className="btn-ghost" disabled={busy} onClick={() => setRemoving(null)}>Cancelar</button><button className="btn-primary manual-danger" disabled={busy} onClick={() => mutate(() => request(removing.type === 'manual' ? '/api/manuals' : '/api/manuals/tree', json('DELETE', removing)), () => { if (removing.type === 'folder') select(removing.kind === 'program' ? systemId : ''); setRemoving(null); })}>{busy ? 'Excluindo...' : 'Excluir'}</button></footer></Dialog>}
    {help && <Dialog title="Manuais do Sistema" onClose={() => setHelp(false)}><p>Escolha o sistema e depois o programa. Use “Ler manual” para abrir o guia digital ou “Abrir PDF” nos documentos anteriores. A seta baixa uma cópia. Você também pode imprimir o guia pelo navegador (Ctrl+P).</p><p>A busca procura no título, na descrição, nas palavras-chave e no nome do arquivo, dentro da pasta selecionada. Escolha “Todos os sistemas” para buscar em toda a biblioteca.</p>{admin && <><p>Cadastre um sistema e um programa antes de criar o primeiro manual. Em “Novo manual”, use o editor para escrever, inserir imagens e links. A biblioteca de Modelos permite criar, editar e clonar bases para novos guias.</p><p>Rascunhos ficam visíveis apenas para administradores. Marque “Publicado” para permitir leitura sem login por quem receber o link. Use “Copiar link” para compartilhar. Ao voltar para rascunho, o link deixa de abrir o manual. “Revisado por” identifica quem salvou a última alteração. Os PDFs anteriores continuam disponíveis e podem ser substituídos sem perder o cadastro.</p></>}<footer><button className="btn-primary" onClick={() => setHelp(false)}>Entendi</button></footer></Dialog>}
  </section>;
}

function ManualEditor({ item, tree, initialSystemId, initialProgramId, busy, error, onClose, onSave }) {
  const [systemId, setSystemId] = useState(item.system_id || initialSystemId || tree[0]?.id || '');
  const [data, setData] = useState({ id: item.id, revision: item.revision, programId: item.program_id || initialProgramId || '', title: item.title || '', description: item.description || '', keywords: item.keywords || '', version: item.version || '', published: item.published || false });
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const programs = tree.find(s => s.id === systemId)?.programs || [];
  const field = name => ({ value: data[name], onChange: e => setData({ ...data, [name]: e.target.value }) });
  return <Dialog title={item.id ? 'Editar manual' : 'Novo manual'} busy={busy} onClose={onClose}><form onSubmit={e => { e.preventDefault(); if (!fileError) onSave(data, file); }}>
    <div className="manual-form-grid"><label>Sistema<select required value={systemId} onChange={e => { setSystemId(e.target.value); setData({ ...data, programId: '' }); }}>{tree.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Programa<select required {...field('programId')}><option value="">Selecione</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
    <label>Título<input required autoFocus maxLength={160} {...field('title')} /></label>
    <label>Descrição<textarea rows={3} maxLength={2000} {...field('description')} /></label>
    <label>Palavras-chave, separadas por vírgula<input maxLength={500} {...field('keywords')} /></label>
    <div className="manual-form-grid"><label>Versão<input maxLength={50} {...field('version')} /></label><label className="manual-publish"><input type="checkbox" checked={data.published} onChange={e => setData({ ...data, published: e.target.checked })} />Publicado — acesso público por link</label></div>
    <label>{item.id ? 'Substituir PDF (opcional)' : 'Arquivo PDF'}<input type="file" accept=".pdf,application/pdf" required={!item.id} onChange={e => { const chosen = e.target.files[0]; setFile(chosen || null); setFileError(chosen && (chosen.size > 20 * 1024 * 1024 || !/\.pdf$/i.test(chosen.name)) ? 'Selecione um PDF de até 20 MB.' : ''); if (chosen && !data.title) setData({ ...data, title: chosen.name.replace(/\.pdf$/i, '').slice(0, 160) }); }} /></label>
    {item.filename && <span className="manual-muted">Atual: {item.filename}</span>}
    {(fileError || error) && <p className="manual-error" role="alert">{fileError || error}</p>}
    <footer><button className="btn-ghost" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || !!fileError}>{busy ? 'Enviando...' : 'Salvar manual'}</button></footer>
  </form></Dialog>;
}
