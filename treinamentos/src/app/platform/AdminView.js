import { CopyContentLink, ReviewStamp } from './ContentSharing';
import { lessonPath } from '@/utils/trainingLinks';
import { useState, useEffect, useCallback, Fragment, useRef, useMemo } from 'react';
import { Icons } from './Icons';
import { getYouTubeThumbnailUrl, getYouTubeWatchUrl } from '../../utils/youtube';
import ManualsView from './ManualsView';
import { categoryLabel, validParent, orderedCategories } from '@/utils/learningRules';
import StudentPicker from './StudentPicker';
import { DescriptionHelp } from './LessonDescription';

// ─── helpers ────────────────────────────────────────────────────────────────
const api = {
  get:    (url)       => fetch(url).then(r => r.json()),
  post:   (url, body) => fetch(url, { method:'POST',   headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json()),
  delete: (url, body) => fetch(url, { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json()),
};

async function fetchAdminData() {
  const [cats, lsns, usrs, trks] = await Promise.all([
    api.get('/api/categories'),
    api.get('/api/lessons'),
    api.get('/api/users'),
    api.get('/api/tracks'),
  ]);

  return {
    categories: Array.isArray(cats) ? cats : [],
    lessons: Array.isArray(lsns) ? lsns : [],
    users: Array.isArray(usrs) ? usrs : [],
    tracks: Array.isArray(trks) ? trks : [],
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminView({ user, toggleTheme, handleLogout, showToast, onBackToHome, theme, onEditProfile, initialSection, modeControl }) {
  const [tab, setTab] = useState(initialSection === 'manuals' ? 'manuals' : 'dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [users, setUsers] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [permissions, setPermissions] = useState({master:false});

  useEffect(() => {
    let active=true;
    fetch('/api/permissions',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(p=>{if(active&&p)setPermissions(p)}).catch(()=>{});
    return ()=>{active=false};
  }, []);

  const [modal, setModal] = useState({ visible: false, title: '', content: null, onSave: null, className: '' });

  const loadData = useCallback(async () => {
    const data = await fetchAdminData();
    setCategories(data.categories);
    setLessons(data.lessons);
    setUsers(data.users);
    setTracks(data.tracks);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const data = await fetchAdminData();
      if (cancelled) return;
      setCategories(data.categories);
      setLessons(data.lessons);
      setUsers(data.users);
      setTracks(data.tracks);
    }

    hydrate();
    return () => { cancelled = true; };
  }, []);

  const openModal = (title, content, onSave, className = '') => setModal({ visible: true, title, content, onSave, className });
  const closeModal = () => setModal(prev => ({ ...prev, visible: false }));

  const titles = { 
    dashboard:'Dashboard', 
    categories:'Categorias',
    manuals:'Manuais do Sistema',
    users:'Usuários', 
    assignedVideos:'Vídeos Designados',
    settings: 'Configurações'
  };

  const handleLessonEdit = (lesson, initialData = {}) => {
    let data = lesson
      ? { ...lesson }
      : { title:'', subtitle:'', category_id: initialData.category_id || '', video_url:'', duration:'', description:'' };
    const content = (
      <div className="form-group-list" style={{display:'flex',flexDirection:'column',gap:15}}>
        <div className="form-group"><label>Título</label><input defaultValue={data.title} onChange={e=>data.title=e.target.value} /></div>
        <div className="form-group"><label>Subtítulo</label><input defaultValue={data.subtitle} onChange={e=>data.subtitle=e.target.value} /></div>
        <div className="form-group">
          <label>Categoria</label>
          <select defaultValue={data.category_id} onChange={e=>data.category_id=e.target.value} className="custom-select">
            <option value="">Selecione...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{categoryLabel(c, categories)}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Vídeo do YouTube ou página do manual</label><input defaultValue={data.video_url} onChange={e=>data.video_url=e.target.value} /></div>
        <div className="form-group"><label>Duração</label><input defaultValue={data.duration} onChange={e=>data.duration=e.target.value} /></div>
        <div className="form-group"><label>Descrição e roteiro da aula</label><DescriptionHelp lessons={lessons} /><textarea rows={7} placeholder="Objetivo da aula, conhecimentos necessários, passos demonstrados e o que praticar ao terminar." defaultValue={data.description} onChange={e=>data.description=e.target.value} /></div>
      </div>
    );
    openModal(lesson ? 'Editar Aula' : 'Nova Aula', content, async () => {
      if (!data.title.trim()) { showToast('Informe o título.', 'error'); return false; }
      if (!data.category_id) { showToast('Selecione a categoria.', 'error'); return false; }
      if (!data.video_url.trim()) { showToast('Informe a URL.', 'error'); return false; }
      const id = lesson ? lesson.id : `id_${Date.now()}`;
      const result = await api.post('/api/lessons', { id, ...data, sort_order: lesson?.sort_order ?? lessons.length });
      if (result.error) { showToast(result.error, 'error'); return false; }
      loadData(); showToast(`Aula ${lesson?'atualizada':'criada'}!`);
      return true;
    });
  };

  return (
    <section id="page-admin" className={`page active ${tab === 'manuals' ? 'manuals-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Topbar contínuo */}
      <header className="topbar" style={{ 
        position: 'relative', 
        width: '100%', 
        justifyContent: 'space-between', 
        padding: '0 32px',
        zIndex: 110,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <button className="hamburger" aria-label="Menu de navegação" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}>{Icons.hamburger}</button>
          <div className="sidebar-brand" onClick={onBackToHome} style={{ cursor: 'pointer', border: 'none', padding: 0 }}>
            <div className="brand-logo-sm">
              <img src="/static/uploads/logos/logo.png" alt="Monalisa Logo" />
            </div>
            <span className="sidebar-brand-name" style={{ color: 'var(--text-primary)' }}>Monalisa</span>
          </div>
          
          <h1 className="admin-page-title" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{titles[tab]}</h1>
        </div>

        <div className="topbar-right" style={{ gap: '24px' }}>
          <a href={`http://127.0.0.1:3081/faq.html?tema=${theme === 'dark' ? 'dark' : 'light'}`} className="btn-ghost student-mode-control" style={{ textDecoration: 'none' }}>{Icons.fiscal} MonaFAQ</a>
          {modeControl}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div 
              className="student-info" 
              style={{ color: 'var(--text-primary)', cursor: 'pointer' }}
              onClick={onEditProfile}
              title="Configurações de Perfil"
            >
              <div className="avatar is-admin" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (user.display_name || user.name).charAt(0).toUpperCase()
                )}
              </div>
              <div className="student-meta">
                <span className="student-name" style={{ color: 'var(--text-primary)' }}>{user.display_name || user.name}</span>
                <span className="student-role" style={{ color: 'var(--text-muted)' }}>{permissions.master ? 'Administrador master' : 'Administrador'}</span>
              </div>
            </div>
            <div className="sidebar-actions">
              <button className="icon-btn" onClick={toggleTheme} title="Alternar tema" style={{ color: 'var(--text-secondary)' }}>
              <span className="theme-toggle-icon">
                {Icons.sun}
                {Icons.moon}
              </span>
            </button>
              <button className="icon-btn" onClick={handleLogout} title="Sair" style={{ color: 'var(--text-secondary)' }}>
                {Icons.logout}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="admin-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} style={{ height: '100%', borderTop: 'none' }}>
          <nav className="admin-nav" style={{ padding: '20px 12px' }}>
            {Object.entries(titles).filter(([key]) => key !== 'manuals' && (key !== 'settings' || permissions.master)).map(([key, label]) => (
              <a key={key} href="#" className={`admin-nav-item ${tab === key ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setTab(key); setSidebarOpen(false); }}>
                {Icons[key] || (key === 'manuals' ? Icons.fiscal : Icons.dashboard)} {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="admin-body" style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>

          <div className="admin-tab active">
            {tab === 'dashboard'       && <DashboardTab categories={categories} lessons={lessons} users={users} tracks={tracks} />}
            {tab === 'manuals'         && <ManualsView admin showToast={showToast} />}
            {tab === 'categories'      && (
              <CategoriesTab 
                categories={categories} 
                lessons={lessons} 
                tracks={tracks}
                refresh={loadData} 
                openModal={openModal} 
                showToast={showToast} 
                onAddLesson={(catId) => handleLessonEdit(null, { category_id: catId })} 
                onEditLesson={handleLessonEdit}
              />
            )}
            {tab === 'users'           && <UsersTab users={users} tracks={tracks} currentUser={user} refresh={loadData} openModal={openModal} showToast={showToast} isMaster={permissions.master} />}
            {tab === 'assignedVideos'  && <AssignedVideosTab users={users} adminId={user.id} showToast={showToast} isMaster={permissions.master} />}
            {tab === 'settings' && permissions.master && <SettingsTab showToast={showToast} />}
          </div>

          <div className={`sidebar-overlay ${!sidebarOpen ? 'hidden' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        </div>
      </div>

      {modal.visible && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target.className === 'modal-backdrop') closeModal(); }}>
          <div className={`modal ${modal.className || ''}`.trim()}>
            <div className="modal-header">
              <h3 className="modal-title">{modal.title}</h3>
              <button className="modal-close" onClick={closeModal}>{Icons.close}</button>
            </div>
            <div className="modal-body">{modal.content}</div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn-primary" onClick={async () => { const ok = await modal.onSave(); if (ok !== false) closeModal(); }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({ showToast }) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [backupDir, setBackupDir] = useState('');
  const [backupDirInput, setBackupDirInput] = useState('');
  const [backingUp, setBackingUp] = useState(false);
  const [backupIntervalDays, setBackupIntervalDays] = useState(2);
  const [backupsList, setBackupsList] = useState([]);
  const [restoringFile, setRestoringFile] = useState(null);
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const backupUploadRef = useRef(null);

  const fetchBackupStatus = useCallback(() => {
    fetch('/api/admin/backup')
      .then(r => r.json())
      .then(data => {
        if (data.lastBackup) {
          setLastBackup(new Date(data.lastBackup).toLocaleString('pt-BR'));
        } else {
          setLastBackup(null);
        }
        if (data.backupDir) {
          setBackupDir(data.backupDir);
          setBackupDirInput(data.backupDir);
        }
        if (data.backupsList) {
          setBackupsList(data.backupsList);
        }
        if (data.backupIntervalDays) {
          setBackupIntervalDays(data.backupIntervalDays);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => setUrl(data.valor || ''));
    fetchBackupStatus();
  }, [fetchBackupStatus]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.post('/api/settings', { url });
    setSaving(false);
    if (res.error) showToast(res.error, 'error');
    else showToast('Configurações salvas!');
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast(`Backup concluído: ${data.filename}`);
        fetchBackupStatus();
      }
    } catch (err) {
      showToast('Erro ao realizar backup.', 'error');
    }
    setBackingUp(false);
  };

  const handleIntervalChange = async (e) => {
    const value = parseInt(e.target.value, 10);
    setBackupIntervalDays(value);
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_interval', days: value })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast(`Frequência de backup alterada para ${value} dias.`);
      }
    } catch (err) {
      showToast('Erro ao alterar frequência de backup.', 'error');
    }
  };

  const handleSaveDirectory = async () => {
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_directory', directory: backupDirInput })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast('Diretório de backups atualizado com sucesso!');
        if (data.backupDir) {
          setBackupDir(data.backupDir);
          setBackupDirInput(data.backupDir);
        }
        if (data.backupsList) {
          setBackupsList(data.backupsList);
        }
      }
    } catch (err) {
      showToast('Erro ao atualizar diretório de backups.', 'error');
    }
  };

  const handleRestore = async (filename) => {
    const confirmed = confirm(
      `ATENÇÃO: Você tem certeza que deseja restaurar o backup "${filename}"?\n\n` +
      `Isso irá importar somente trilhas, categorias, aulas, módulos e configurações seguras do backup.\n` +
      `Usuários, senhas, progresso individual, vídeos designados e logs continuarão fora da restauração.`
    );
    if (!confirmed) return;

    setRestoringFile(filename);
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', filename })
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast('Conteúdo de treinamento importado com sucesso!');
        fetchBackupStatus();
      }
    } catch (err) {
      showToast('Erro crítico ao restaurar backup.', 'error');
    }
    setRestoringFile(null);
  };

  const handleUploadBackup = async () => {
    if (!selectedBackupFile) {
      showToast('Selecione um arquivo .sql de backup.', 'error');
      return;
    }

    const confirmed = confirm(
      `Importar o arquivo "${selectedBackupFile.name}"?\n\n` +
      `Ele será enviado para a pasta de backups e importado somente como conteúdo de treinamento.`
    );
    if (!confirmed) return;

    setUploadingBackup(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedBackupFile);
      fd.append('restore', 'true');

      const res = await fetch('/api/admin/backup', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'Erro ao enviar backup.', 'error');
      } else {
        showToast(`Backup enviado e importado: ${data.uploaded?.filename || selectedBackupFile.name}`);
        setSelectedBackupFile(null);
        if (backupUploadRef.current) backupUploadRef.current.value = '';
        if (data.backupsList) setBackupsList(data.backupsList);
        fetchBackupStatus();
      }
    } catch (err) {
      showToast('Erro crítico ao enviar backup.', 'error');
    }
    setUploadingBackup(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="dash-card" style={{ maxWidth: 600 }}>
        <h3 className="dash-card-title">Configurações do Site</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label>URL do Vídeo em Destaque (Início)</label>
            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="Ex: https://www.youtube.com/watch?v=..."
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Este vídeo será exibido para todos os usuários na página inicial após o login.
            </p>
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      <div className="dash-card" style={{ maxWidth: 600 }}>
        <h3 className="dash-card-title">Backup do Banco de Dados</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Diretório de Destino dos Backups</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                value={backupDirInput} 
                onChange={e => setBackupDirInput(e.target.value)}
                placeholder="Diretório de backup"
                style={{ flex: 1 }}
              />
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleSaveDirectory}
                disabled={restoringFile !== null || backingUp || uploadingBackup || !backupDirInput.trim() || backupDirInput === backupDir}
                style={{ whiteSpace: 'nowrap', padding: '0 16px' }}
              >
                Salvar
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Frequência Automática</label>
              <select 
                value={backupIntervalDays} 
                onChange={handleIntervalChange}
                className="custom-select"
                disabled={restoringFile !== null || backingUp || uploadingBackup}
                style={{ width: '100%' }}
              >
                <option value="1">A cada 1 dia</option>
                <option value="2">A cada 2 dias</option>
                <option value="3">A cada 3 dias</option>
                <option value="5">A cada 5 dias</option>
                <option value="7">A cada 7 dias</option>
                <option value="15">A cada 15 dias</option>
                <option value="30">A cada 30 dias</option>
              </select>
            </div>

            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
              <div>
                <strong>Último Backup:</strong>
              </div>
              <div style={{ color: lastBackup ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12 }}>
                {lastBackup || 'Nenhum backup registrado'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 4 }}>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleBackupNow} 
              disabled={backingUp || restoringFile !== null || uploadingBackup}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {backingUp ? 'Gerando Backup...' : 'Fazer Backup Manual Agora'}
            </button>
          </div>

          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Enviar Arquivo de Backup</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                ref={backupUploadRef}
                type="file"
                accept=".sql,text/plain,application/sql"
                onChange={(e) => setSelectedBackupFile(e.target.files?.[0] || null)}
                disabled={uploadingBackup || backingUp || restoringFile !== null}
                style={{ flex: '1 1 260px' }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleUploadBackup}
                disabled={!selectedBackupFile || uploadingBackup || backingUp || restoringFile !== null}
                style={{ whiteSpace: 'nowrap', padding: '0 16px' }}
              >
                {uploadingBackup ? 'Enviando...' : 'Enviar e Importar'}
              </button>
            </div>
          </div>

          {/* Lista de backups para restauração */}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Importar Conteúdo do Backup
            </label>
            {backupsList.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                Nenhum arquivo de backup encontrado na pasta local.
              </p>
            ) : (
              <div style={{ 
                maxHeight: 180, 
                overflowY: 'auto', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                padding: '0 12px',
                background: 'var(--bg-secondary)'
              }}>
                {backupsList.map((b, idx) => (
                  <div key={b.filename} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '10px 0', 
                    borderBottom: idx === backupsList.length - 1 ? 'none' : '1px solid var(--border-color)',
                    gap: 12 
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ 
                        fontSize: 12, 
                        fontWeight: 600, 
                        color: 'var(--text-primary)', 
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }} title={b.filename}>
                        {b.filename}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(b.createdAt).toLocaleString('pt-BR')} • {b.sizeFormatted}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      className="btn-ghost" 
                      onClick={() => handleRestore(b.filename)}
                      disabled={restoringFile !== null || backingUp || uploadingBackup}
                      style={{ 
                        fontSize: 11, 
                        padding: '4px 10px', 
                        height: 'auto', 
                        borderColor: 'var(--orange)', 
                        color: 'var(--orange)' 
                      }}
                    >
                      {restoringFile === b.filename ? 'Importando...' : 'Importar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}


// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ categories, lessons, users, tracks }) {
  const [progresses, setProgresses] = useState({});
  const [filterUserId, setFilterUserId] = useState('');
  const [filterTrackId, setFilterTrackId] = useState('');

  useEffect(() => {
    const students = users.filter(u => u.role === 'student');
    Promise.all(students.map(u => {
      const trackId = u.track_id || 'track_padrao';
      return fetch(`/api/user/progress?user_id=${encodeURIComponent(u.id)}`)
        .then(r => r.json())
        .then(ids => ({ id: u.id, ids }));
    }))
      .then(results => {
        const map = {};
        results.forEach(r => { map[r.id] = Array.isArray(r.ids) ? r.ids : []; });
        setProgresses(map);
      });
  }, [users]);

  let totalCompletions = 0;
  users.filter(u => u.role === 'student').forEach(u => {
    totalCompletions += (progresses[u.id]?.length || 0);
  });

  const topLessons = [...lessons].sort((a,b) => (b.views||0) - (a.views||0)).slice(0,5);
  const students = users.filter(u => u.role === 'student');

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon stat-orange">{Icons.users}</div><div className="stat-info"><span className="stat-value">{students.length}</span><span className="stat-label">Alunos Cadastrados</span></div></div>
        <div className="stat-card"><div className="stat-icon stat-teal">{Icons.lessons}</div><div className="stat-info"><span className="stat-value">{lessons.length}</span><span className="stat-label">Aulas Disponíveis</span></div></div>
        <div className="stat-card"><div className="stat-icon stat-green">{Icons.categories}</div><div className="stat-info"><span className="stat-value">{categories.length}</span><span className="stat-label">Categorias</span></div></div>
        <div className="stat-card"><div className="stat-icon stat-purple">{Icons.check}</div><div className="stat-info"><span className="stat-value">{totalCompletions}</span><span className="stat-label">Conclusões Totais</span></div></div>
      </div>
      <div className="dashboard-grid">
        <div className="dash-card">
          <h3 className="dash-card-title">Aulas Mais Acessadas</h3>
          <div>
            {topLessons.length === 0 || topLessons.every(l => (l.views||0)===0) ? (
              <p className="empty-hint">Nenhuma aula acessada ainda.</p>
            ) : topLessons.map((l,i) => (
              <div key={l.id} className="lesson-rank-item">
                <div className="rank-num">{i+1}</div>
                <div className="rank-name">{l.title}</div>
                <div className="rank-count">{l.views||0} acesso(s)</div>
              </div>
            ))}
          </div>
        </div>
        <div className="dash-card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, flexWrap:'wrap', gap:10}}>
            <h3 className="dash-card-title" style={{margin:0}}>Progresso por Categoria</h3>
            <div style={{display:'flex', gap:'10px'}}>
              <select 
                value={filterTrackId} 
                onChange={e => setFilterTrackId(e.target.value)} 
                className="custom-select"
                style={{minWidth: 150}}
              >
                <option value="">Todas as trilhas</option>
                {tracks?.map(t => <option key={t.id} value={t.id}>{t.id === 'track_padrao' ? 'Loja (Padrão)' : t.id === 'track_suporte' ? 'Suporte + Loja' : t.name}</option>)}
              </select>
              <select 
                value={filterUserId} 
                onChange={e => setFilterUserId(e.target.value)} 
                className="custom-select"
                style={{minWidth: 180}}
              >
                <option value="">Todos os usuários</option>
                {students.filter(u => !filterTrackId || u.track_id === filterTrackId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            {categories.filter(c => !filterTrackId || c.track_id === filterTrackId).length === 0 ? <p className="empty-hint">Nenhuma categoria encontrada.</p> : categories.filter(c => !filterTrackId || c.track_id === filterTrackId).map(cat => {
              const catLessons = lessons.filter(l => l.category_id === cat.id);
              let done = 0;
              
              const targetStudents = filterUserId 
                ? students.filter(u => u.id === filterUserId)
                : students;

              catLessons.forEach(l => {
                targetStudents.forEach(u => {
                  const onTrack = !filterTrackId || (u.track_id || 'track_padrao') === (cat.track_id || 'track_padrao');
                  if (onTrack && (progresses[u.id] || []).includes(l.id)) done++;
                });
              });
              
              const maxPossible = catLessons.length * Math.max(targetStudents.length, 1);
              const pct = maxPossible > 0 ? Math.round((done / maxPossible) * 100) : 0;
              return (
                <div key={cat.id} className="cat-progress-row">
                  <div className="cat-progress-header">
                    <span className="cat-progress-name">{categoryLabel(cat, categories)}</span>
                    <span className="cat-progress-pct">{pct}% de conclusão</span>
                  </div>
                  <div className="cat-progress-bar"><div className="cat-progress-fill" style={{width:`${pct}%`}}></div></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────
function CategoriesTab({ categories, lessons, tracks, refresh, openModal, showToast, onAddLesson, onEditLesson }) {
  const [expandedCats, setExpandedCats] = useState({});
  const [helpOpen, setHelpOpen] = useState(false);
  const currentTrackId = 'track_padrao';

  const toggleExpand = (catId) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const filteredCategories = orderedCategories(categories).filter(cat => {
    const trackId = cat.track_id || 'track_padrao';
    return trackId === currentTrackId;
  });

  const moveCat = async (id, direction) => {
    const parentId = filteredCategories.find(c => c.id === id)?.parent_id || null;
    const siblings = filteredCategories.filter(c => (c.parent_id || null) === parentId);
    const idx = siblings.findIndex(c => c.id === id);
    if (idx === -1) return;

    let targetIdx = -1;
    if (direction === 'up' && idx > 0) targetIdx = idx - 1;
    else if (direction === 'down' && idx < siblings.length - 1) targetIdx = idx + 1;
    
    if (targetIdx === -1) return;

    const catA = siblings[idx];
    const catB = siblings[targetIdx];

    const sortA = catA.sort_order ?? idx;
    const sortB = catB.sort_order === sortA ? sortA + (direction === 'up' ? -1 : 1) : catB.sort_order;

    await Promise.all([
      api.post('/api/categories', { ...catA, sort_order: sortB }),
      api.post('/api/categories', { ...catB, sort_order: sortA })
    ]);

    refresh();
    showToast('Ordem atualizada!');
  };

  const removeCat = async (id) => {
    if (!confirm('Excluir esta categoria e todas as suas aulas?')) return;
    const result = await api.delete('/api/categories', { id });
    if (result.error) { showToast(result.error, 'error'); return; }
    refresh(); showToast('Categoria excluída.', 'orange');
  };

  const handleEditCat = (cat) => {
    let data = cat ? { ...cat } : { name: '', track_id: currentTrackId, parent_id: '' };
    const content = (
      <div className="form-group-list" style={{display:'flex',flexDirection:'column',gap:15}}>
        <div className="form-group">
          <label>Nome da Categoria</label>
          <input type="text" defaultValue={data.name} onChange={e => data.name = e.target.value} placeholder="Ex: Fiscal..." />
        </div>
        <div className="form-group">
          <label>Sistema</label>
          <select defaultValue={data.track_id} className="custom-select" disabled>
            <option value="track_padrao">Monalisa Gestores</option>
          </select>
        </div>
        <div className="form-group"><label>Categoria superior (opcional)</label>
          <select defaultValue={data.parent_id || ''} onChange={e => data.parent_id = e.target.value} className="custom-select">
            <option value="">Categoria principal</option>
            {categories.filter(c => (c.track_id || 'track_padrao') === currentTrackId && validParent(categories, cat?.id, c.id, currentTrackId)).map(c => <option key={c.id} value={c.id}>Monalisa Gestores / {categoryLabel(c, categories)}</option>)}
          </select>
          <small>Escolha uma categoria da mesma trilha. Subcategorias aparecem abaixo da categoria principal.</small>
        </div>
      </div>
    );
    openModal(cat ? 'Editar Categoria' : 'Nova Categoria', content, async () => {
      if (!data.name.trim()) { showToast('Informe o nome.', 'error'); return false; }
      const id = cat ? cat.id : `id_${Date.now()}`;
      const result = await api.post('/api/categories', { id, name: data.name.trim(), track_id: data.track_id, parent_id: data.parent_id || null, icon: cat?.icon || 'fiscal', sort_order: cat?.sort_order ?? categories.length });
      if (result.error) { showToast(result.error, 'error'); return false; }
      refresh(); showToast(`Categoria ${cat?'atualizada':'criada'}!`);
      return true;
    });
  };

  const moveLesson = async (id, direction) => {
    const lesson = lessons.find(l => l.id === id);
    if (!lesson) return;
    const catLessons = lessons.filter(l => l.category_id === lesson.category_id);
    const idx = catLessons.findIndex(l => l.id === id);
    if (idx === -1) return;

    let targetIdx = -1;
    if (direction === 'up' && idx > 0) targetIdx = idx - 1;
    else if (direction === 'down' && idx < catLessons.length - 1) targetIdx = idx + 1;

    if (targetIdx === -1) return;

    const lessonA = catLessons[idx];
    const lessonB = catLessons[targetIdx];

    const sortA = lessonA.sort_order;
    const sortB = lessonB.sort_order;

    await Promise.all([
      api.post('/api/lessons', { ...lessonA, sort_order: sortB }),
      api.post('/api/lessons', { ...lessonB, sort_order: sortA })
    ]);

    refresh();
    showToast('Ordem das aulas atualizada!');
  };

  const removeLesson = async (id) => {
    if (!confirm('Excluir esta aula?')) return;
    await api.delete('/api/lessons', { id });
    refresh(); showToast('Aula excluída.', 'orange');
  };

  return (
    <>
      <div className="tab-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={() => handleEditCat(null)}>+ Nova Categoria</button>
        <div className="track-tabs" aria-label="Sistemas">
          <button type="button" className="track-tab-btn active" aria-pressed="true">Monalisa Gestores</button>
          <button type="button" className="track-tab-btn" disabled title="Monalisa ERP em breve">Monalisa ERP · Em breve</button>
        </div>
        <button className="btn-icon-sm categories-help-button" onClick={() => setHelpOpen(true)} title="Como usar" aria-label="Como usar a listagem de aulas">
          {Icons.help}
        </button>
      </div>
      <div className="data-table-wrapper">
        {filteredCategories.length === 0 ? (
          <div className="empty-state">{Icons.categories}<p>Nenhuma categoria cadastrada no Monalisa Gestores.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th style={{width:40}}></th><th>Nome da Categoria</th><th>Sistema</th><th>Aulas</th><th>Ações</th></tr></thead>
            <tbody>
              {filteredCategories.map((cat, i) => {
                const isExpanded = expandedCats[cat.id];
                const catLessons = lessons.filter(l => l.category_id === cat.id);
                return (
                  <Fragment key={cat.id}>
                    <tr className={isExpanded ? 'expanded-row-master' : ''} style={{cursor:'pointer'}} onClick={() => toggleExpand(cat.id)}>
                      <td style={{textAlign:'center', color:'var(--text-muted)'}}>
                        <span style={{display:'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition:'0.2s'}}>
                          {Icons.chevron}
                        </span>
                      </td>
                      <td><strong>{categoryLabel(cat, categories)}</strong></td>
                      <td><span className="badge" style={{background:'var(--bg-secondary)', color:'var(--text-secondary)'}}>Monalisa Gestores</span></td>
                      <td><span className="badge">{catLessons.length}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="actions-cell">
                          <button className="btn-icon-sm" onClick={()=>onAddLesson(cat.id)} title="Adicionar aula nesta categoria" style={{color:'var(--accent-primary)'}}>{Icons.plus}</button>
                          <div style={{width:1,height:20,background:'var(--border-color)',margin:'0 4px'}}></div>
                          <button className="btn-icon-sm" onClick={()=>moveCat(cat.id,'up')} disabled={i===0}>{Icons.up}</button>
                          <button className="btn-icon-sm" onClick={()=>moveCat(cat.id,'down')} disabled={i===filteredCategories.length-1}>{Icons.down}</button>
                          <div style={{width:1,height:20,background:'var(--border-color)',margin:'0 4px'}}></div>
                          <button className="btn-icon-sm" onClick={()=>handleEditCat(cat)}>{Icons.edit}</button>
                          <button className="btn-icon-sm danger" onClick={()=>removeCat(cat.id)}>{Icons.delete}</button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-row-details">
                        <td colSpan="5" style={{padding: '0 0 20px 40px', background: 'var(--bg-secondary-alt)'}}>
                          <div className="sub-table-wrapper" style={{background:'var(--bg-primary)', borderRadius:'0 0 8px 8px', border:'1px solid var(--border-color)', borderTop:'none', padding:'16px'}}>
                            {catLessons.length === 0 ? (
                              <p className="empty-hint" style={{padding:'20px', textAlign:'center'}}>Nenhuma aula cadastrada nesta categoria.</p>
                            ) : (
                              <table className="data-table is-subtable lessons-admin-table">
                                <thead><tr><th>Miniatura</th><th>Título</th><th>Duração</th><th>Ações</th></tr></thead>
                                <tbody>
                                  {catLessons.map((l, li) => {
                                    const thumbnailUrl = getYouTubeThumbnailUrl(l.video_url);
                                    const watchUrl = getYouTubeWatchUrl(l.video_url);
                                    return (
                                      <tr key={l.id}>
                                        <td className="lesson-thumbnail-cell">
                                          {thumbnailUrl ? (
                                            <a
                                              className="lesson-video-thumb"
                                              href={watchUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              title="Abrir vídeo no YouTube"
                                              aria-label={`Abrir vídeo ${l.title} no YouTube`}
                                              style={{ backgroundImage: `url("${thumbnailUrl}")` }}
                                            >
                                              <span className="lesson-video-play">{Icons.youtube}</span>
                                            </a>
                                          ) : (
                                            <div className="lesson-video-thumb is-empty" title="Miniatura indisponível">
                                              {Icons.lessons}
                                            </div>
                                          )}
                                        </td>
                                        <td>
                                          <strong>{l.title}</strong><div><ReviewStamp name={l.reviewed_by_name} /><CopyContentLink path={lessonPath(l.id)} /></div>
                                          <div style={{color:'var(--text-muted)', fontSize:11}}>{l.subtitle}</div>
                                        </td>
                                        <td>{l.duration || '—'}</td>
                                        <td>
                                          <div className="actions-cell">
                                            <button className="btn-icon-sm" onClick={()=>moveLesson(l.id,'up')} disabled={li===0}>{Icons.up}</button>
                                            <button className="btn-icon-sm" onClick={()=>moveLesson(l.id,'down')} disabled={li===catLessons.length-1}>{Icons.down}</button>
                                            <div style={{width:1,height:20,background:'var(--border-color)',margin:'0 4px'}}></div>
                                            {watchUrl && !watchUrl.startsWith('/material-gestores/') && <a className="btn-icon-sm lesson-youtube-button" href={watchUrl} target="_blank" rel="noreferrer" title="Abrir vídeo no YouTube" aria-label={`Abrir ${l.title} no YouTube`}>
                                              {Icons.youtube}
                                            </a>}
                                            <button className="btn-icon-sm" onClick={()=>onEditLesson(l)}>{Icons.edit}</button>
                                            <button className="btn-icon-sm danger" onClick={()=>removeLesson(l.id)}>{Icons.delete}</button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {helpOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target.className === 'modal-backdrop') setHelpOpen(false); }}>
          <div className="modal categories-help-modal">
            <div className="modal-header">
              <h3 className="modal-title">Como usar categorias e aulas</h3>
              <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="Fechar ajuda">{Icons.close}</button>
            </div>
            <div className="modal-body"><p>Para criar subcategorias, selecione uma categoria superior. As setas organizam categorias que estão no mesmo nível.</p>
              <ul className="category-help-list">
                <li>Monalisa Gestores mostra as categorias disponíveis; Monalisa ERP estará disponível em breve.</li>
                <li>Abra uma categoria para revisar as aulas, duração, miniatura e ações.</li>
                <li>A miniatura é gerada automaticamente a partir da URL do YouTube cadastrada na aula.</li>
                <li>Use o botão do YouTube para conferir o vídeo em nova guia antes de salvar novas mudanças.</li>
                <li>Ao salvar uma aula, título, categoria e URL do vídeo precisam estar preenchidos.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ─── User Edit Form ─────────────────────────────────────────────────────────────
function UserEditForm({ user, tracks, showToast, onRegisterSave }) {
  const isNew = !user;
  const userId = user?.id ?? '';
  const fileRef = useRef(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'student',
    track_id: user?.track_id ?? 'track_padrao',
    progresso_geral: user?.progresso_geral ?? 0,
    profile_picture: user?.profile_picture ?? null,
  });
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resettingProgress, setResettingProgress] = useState(false);
  const isOneManaged = Boolean(user?.one_user_id);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const previewUrl = useMemo(() => {
    if (pendingPhoto) return URL.createObjectURL(pendingPhoto);
    return form.profile_picture;
  }, [pendingPhoto, form.profile_picture]);

  useEffect(() => {
    if (!pendingPhoto || !previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [pendingPhoto, previewUrl]);

  const uploadPhoto = async (file, targetId) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('user_id', targetId);
    const res = await fetch('/api/user/upload', { method: 'POST', body: fd });
    return res.json();
  };

  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (isNew) {
      setPendingPhoto(file);
      return;
    }

    setUploading(true);
    const result = await uploadPhoto(file, userId);
    setUploading(false);
    if (result.error || !result.success) {
      showToast(result.error || 'Falha no upload da foto.', 'error');
      return;
    }
    set('profile_picture', result.path);
    showToast('Foto atualizada.');
  };

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/user/track-progress?user_id=${userId}&track_id=${encodeURIComponent(form.track_id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) set('progresso_geral', data.progresso_geral ?? 0);
      })
      .catch(() => {});
  }, [form.track_id, userId, isNew]);

  const handleResetProgress = async () => {
    if (isNew) return;
    const trackName = tracks.find((t) => t.id === form.track_id)?.name || 'esta trilha';
    if (!confirm(`Reiniciar o progresso de "${form.name}" na trilha "${trackName}"?\n\nEsta ação não pode ser desfeita.`)) return;
    setResettingProgress(true);
    const res = await fetch('/api/admin/reset-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, track_id: form.track_id }),
    });
    const result = await res.json();
    setResettingProgress(false);
    if (result.error) { showToast(result.error, 'error'); return; }
    set('progresso_geral', 0);
    showToast('Progresso reiniciado.', 'orange');
  };

  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(async () => {
      if (isNew) {
        showToast('Usuarios do Treinamentos devem entrar primeiro pelo One.', 'error');
        return false;
      }

      const payload = {
        id: userId,
        role: form.role,
        track_id: form.track_id,
        profile_picture: form.profile_picture,
        progresso_geral: form.progresso_geral,
      };

      const res = await api.post('/api/users', payload);
      if (res.error) { showToast(res.error, 'error'); return false; }

      if (pendingPhoto) {
        const up = await uploadPhoto(pendingPhoto, userId);
        if (up.error || !up.success) showToast('Usuário salvo, mas a foto não foi enviada.', 'orange');
      }

      return true;
    });
  }, [form, isNew, userId, pendingPhoto, onRegisterSave, showToast]);

  const progressPct = Math.min(100, Math.max(0, Number(form.progresso_geral) || 0));

  return (
    <div className="user-edit-form">
      <div className="user-edit-help-bar">
        <button
          type="button"
          className="btn-icon-sm"
          onClick={() => setHelpOpen((open) => !open)}
          title="Como usar"
          aria-label="Como usar a edição de usuário"
          aria-expanded={helpOpen}
        >
          {Icons.help}
        </button>
      </div>
      {helpOpen && (
        <div className="user-edit-help-panel">
          <strong>Editar usuario</strong>
          <p>Nome e e-mail continuam sincronizados pelo Monalisa One. Aqui voce ajusta apenas o perfil no Treinamentos, a trilha, a foto e o progresso deste usuario.</p>
          <p>Salve para aplicar a troca entre Aluno e Admin. A mudanca vale para o acesso ao Treinamentos.</p>
          <p>Usuarios marcados como equipe/admin no One continuam entrando como Admin.</p>
        </div>
      )}
      <div className="user-edit-top">
        <div className="user-edit-photo-col">
          <button
            type="button"
            className="user-edit-photo"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Clique para alterar a foto"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" />
            ) : (
              <span className="user-edit-photo-placeholder">{uploading ? '...' : 'Foto'}</span>
            )}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhotoPick} />

        <div className="user-edit-fields">
          <div className="form-group user-edit-field">
            <label>Nome</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome completo" disabled={isOneManaged} />
          </div>
          <div className="form-group user-edit-field">
            <label>E-mail</label>
            <input
              value={form.email}
              type="email"
              onChange={(e) => set('email', e.target.value)}
              placeholder="email@exemplo.com"
              disabled={isOneManaged}
            />
          </div>
        </div>
      </div>

      <div className="user-edit-bottom">
        <div className="form-group">
          <label>Perfil</label>
          <select value={form.role} onChange={(e) => set('role', e.target.value)} className="custom-select">
            <option value="student">Aluno</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="form-group">
          <label>Trilha vinculada ao cadastro</label>
          <p className="empty-hint">Loja: trilha Padrão. Suporte: Suporte + Loja. Admin: todas as trilhas.</p>
          <select value={form.track_id} onChange={(e) => set('track_id', e.target.value)} className="custom-select">
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>{t.id === 'track_padrao' ? 'Loja (Padrão)' : t.id === 'track_suporte' ? 'Suporte + Loja' : t.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group user-edit-progress-group">
          <label>Progresso Atual</label>
          <div className="user-edit-progress-row">
            <div className="progress-pill user-edit-progress-pill">
              <div className="progress-bar-inner" style={{ width: `${progressPct}%` }} />
              <span className="progress-text">{progressPct}% concluído</span>
            </div>
            {!isNew && (
              <button
                type="button"
                className="btn-reset-progress"
                onClick={handleResetProgress}
                disabled={resettingProgress}
                title="Zera o progresso e apaga o histórico de aulas concluídas"
              >
                {resettingProgress ? 'Reiniciando...' : 'Reiniciar progresso'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewStudentForm({onRegisterSave, isAdmin = false}) {
  const [form,setForm]=useState({name:'',email:'',password:''});
  useEffect(()=>{onRegisterSave(()=>api.post('/api/users',{...(isAdmin ? {createAdmin:true} : {createStudent:true}),...form}));},[form,onRegisterSave,isAdmin]);
  return <div className="form-group-list">{[['name','Nome','text'],['email','E-mail','email'],['password','Senha inicial (mínimo 8 caracteres)','password']].map(([key,label,type])=><div className="form-group" key={key}><label htmlFor={'student-'+key}>{label}</label><input id={'student-'+key} type={type} autoComplete="off" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></div>)}</div>;
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({ users, tracks, currentUser, refresh, openModal, showToast, isMaster }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const getTrackName = useCallback((trackId) => (
    tracks.find(t => t.id === trackId)?.name || '-'
  ), [tracks]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (trackFilter && (u.track_id || 'track_padrao') !== trackFilter) return false;
      if (!term) return true;

      const roleLabel = u.role === 'admin' ? 'admin administrador' : 'aluno student';
      const trackName = getTrackName(u.track_id).toLowerCase();
      const searchable = [
        u.name,
        u.email,
        roleLabel,
        trackName,
        `${u.progresso_geral ?? 0}%`,
        `${u.completed_lessons ?? 0}/${u.total_lessons ?? 0}`,
        `${u.assigned_videos ?? 0}`,
        `${u.seen_assigned_videos ?? 0}`,
      ].join(' ').toLowerCase();

      return searchable.includes(term);
    });
  }, [users, searchTerm, roleFilter, trackFilter, getTrackName]);

  const createStudent = (isAdmin = false) => {
    let save = null;
    openModal(isAdmin ? 'Cadastrar administrador' : 'Cadastrar aluno', <NewStudentForm isAdmin={isAdmin} onRegisterSave={fn => { save = fn; }} />, async () => {
      if (!save) return false; const result = await save();
      if (result.error) { showToast(result.error, 'error'); return false; }
      refresh(); showToast(isAdmin ? 'Administrador cadastrado.' : 'Aluno cadastrado.'); return true;
    });
  };
  const remove = async (id) => {
    if (id === currentUser.id) { showToast('Não pode se excluir.', 'error'); return; }
    if (!confirm('Excluir este usuário?')) return;
    await api.delete('/api/users', { id });
    refresh(); showToast('Usuário excluído.', 'orange');
  };

  const handleEdit = (u) => {
    let saveHandler = null;
    const content = (
      <UserEditForm
        user={u}
        tracks={tracks}
        showToast={showToast}
        onRegisterSave={(fn) => { saveHandler = fn; }}
      />
    );
    openModal(u ? 'Editar Usuário' : 'Novo Usuário', content, async () => {
      if (!saveHandler) return false;
      const ok = await saveHandler();
      if (ok !== false) {
        refresh();
        showToast(`Usuário ${u ? 'atualizado' : 'criado'}!`);
      }
      return ok;
    }, 'modal--user-edit');
  };


  return (
    <>
      <div className="tab-toolbar users-toolbar">
        <div className="users-toolbar-title">
          <span className="badge" style={{background:'var(--bg-secondary)', color:'var(--text-secondary)'}}>
            Usuários cadastrados
          </span>
          <span className="users-result-count">{filteredUsers.length} de {users.length}</span>
        </div>
        <div className="users-filters"><button className="btn-primary" onClick={() => createStudent(false)}>+ Cadastrar aluno</button>{isMaster && <button className="btn-primary" onClick={() => createStudent(true)}>+ Cadastrar administrador</button>}
          <input
            className="users-search-input"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por nome, e-mail, perfil, trilha ou métrica"
            aria-label="Filtrar usuários"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="custom-select users-filter-select" aria-label="Filtrar por perfil">
            <option value="">Todos os perfis</option>
            <option value="student">Alunos</option>
            {isMaster && <option value="admin">Admins</option>}
          </select>
          <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)} className="custom-select users-filter-select" aria-label="Filtrar por trilha">
            <option value="">Todas as trilhas</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>{t.id === 'track_padrao' ? 'Loja (Padrão)' : t.id === 'track_suporte' ? 'Suporte + Loja' : t.name}</option>
            ))}
          </select>
          <button className="btn-icon-sm" onClick={() => setHelpOpen(true)} title="Como usar" aria-label="Como usar usuários">
            {Icons.help}
          </button>
        </div>
      </div>
      {helpOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target.className === 'modal-backdrop') setHelpOpen(false); }}>
          <div className="modal users-help-modal">
            <div className="modal-header">
              <h3 className="modal-title">Como usar usuários</h3>
              <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="Fechar ajuda">{Icons.close}</button>
            </div>
            <div className="modal-body">
              <ul className="category-help-list">
                <li>Use a busca para localizar por nome, e-mail, perfil, trilha ou números de progresso.</li>
                <li>Os filtros de perfil e trilha reduzem a lista sem alterar dados.</li>
                <li>Para alunos, a coluna de métricas mostra progresso, aulas concluídas e vídeos designados.</li>
                <li>O master pode cadastrar administradores, além de editar e excluir usuários. O administrador pode consultar e cadastrar alunos.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr><th>#</th><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Trilha</th><th>Métricas</th>{isMaster && <th>Ações</th>}</tr></thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={isMaster ? 7 : 6}>
                  <p className="empty-hint">Nenhum usuário encontrado com estes filtros.</p>
                </td>
              </tr>
            ) : filteredUsers.map((u, i) => (
              <tr key={u.id}>
                <td>{i+1}</td><td><strong>{u.name}</strong></td><td>{u.email}</td>
                <td><span className={`role-badge ${u.role}`}>{u.role==='admin'?'Admin':'Aluno'}</span></td>
                <td><span className="badge" style={{background:'var(--bg-secondary)', color:'var(--text-secondary)'}}>{getTrackName(u.track_id)}</span></td>
                <td><StudentMetrics user={u} /></td>
                {isMaster && <td>
                  <div className="actions-cell">
                    <button className="btn-icon-sm" onClick={()=>handleEdit(u)}>{Icons.edit}</button>
                    <button className="btn-icon-sm danger" onClick={()=>remove(u.id)}>{Icons.delete}</button>
                  </div>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StudentMetrics({ user }) {
  if (user.role !== 'student') {
    return <span className="student-metrics-empty">Perfil administrativo</span>;
  }

  const progress = Math.min(100, Math.max(0, Number(user.progresso_geral) || 0));
  const completed = Number(user.completed_lessons) || 0;
  const total = Number(user.total_lessons) || 0;
  const assigned = Number(user.assigned_videos) || 0;
  const seenAssigned = Number(user.seen_assigned_videos) || 0;
  const lastCompleted = user.last_completed_at
    ? new Date(user.last_completed_at).toLocaleDateString('pt-BR')
    : '';
  const lastAssigned = user.last_assigned_at
    ? new Date(user.last_assigned_at).toLocaleDateString('pt-BR')
    : '';

  return (
    <div className="student-metrics">
      <div className="student-metric-main">
        <span className="student-metric-progress">{progress}%</span>
        <div className="student-metric-bar" aria-hidden="true">
          <div style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="student-metric-chips">
        <span title="Aulas concluídas na trilha atual">{completed}/{total} aulas</span>
        <span title="Vídeos designados vistos">{seenAssigned}/{assigned} designados</span>
      </div>
      {(lastCompleted || lastAssigned) && (
        <div className="student-metric-dates">
          {lastCompleted && <span>Última aula: {lastCompleted}</span>}
          {lastAssigned && <span>Último designado: {lastAssigned}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Assigned Videos Tab ──────────────────────────────────────────────────────
function AssignedVideosTab({ users, adminId, showToast, isMaster }) {
  const [assignedVideos, setAssignedVideos] = useState([]);
  const [filterUserId, setFilterUserId] = useState('');
  const [form, setForm] = useState({ user_id:'', youtube_url:'', titulo:'', descricao:'' });
  const [loading, setLoading] = useState(false);
  const [requests,setRequests] = useState([]);
  const [requestError,setRequestError] = useState('');

  const students = users.filter(u => u.role === 'student');

  const loadRequests=useCallback(async()=>{
    try {const r=await fetch('/api/assigned-videos/requests',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível carregar as solicitações.');setRequests(d.requests);setRequestError('')}
    catch(e){setRequestError(e.message)}
  },[]);
  useEffect(()=>{loadRequests()},[loadRequests]);

  async function decide(id,decision){
    setLoading(true);
    try {const r=await fetch('/api/assigned-videos/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,decision})});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível analisar.');showToast(decision==='approve'?'Vídeo aprovado e designado.':'Solicitação rejeitada.');await Promise.all([loadRequests(),loadVideos()])}
    catch(e){showToast(e.message,'error')}finally{setLoading(false)}
  }

  const loadVideos = useCallback(async () => {
    const url = filterUserId ? `/api/assigned-videos?user_id=${filterUserId}` : '/api/assigned-videos';
    const data = await api.get(url);
    setAssignedVideos(Array.isArray(data) ? data : []);
  }, [filterUserId]);

  useEffect(() => {
    let cancelled = false;
    const url = filterUserId ? `/api/assigned-videos?user_id=${filterUserId}` : '/api/assigned-videos';

    async function hydrate() {
      const data = await api.get(url);
      if (!cancelled) setAssignedVideos(Array.isArray(data) ? data : []);
    }

    hydrate();
    return () => { cancelled = true; };
  }, [filterUserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.user_id || !form.youtube_url || !form.titulo) {
      showToast('Preencha todos os campos obrigatórios.', 'error'); return;
    }
    setLoading(true);
    const res = await api.post('/api/assigned-videos', { ...form, admin_id: adminId });
    setLoading(false);
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast(res.status==='pending'?'Solicitação enviada para aprovação do master.':'Vídeo designado com sucesso!');
    setForm({ user_id:'', youtube_url:'', titulo:'', descricao:'' });
    loadVideos();
    loadRequests();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este vídeo designado?')) return;
    await api.delete('/api/assigned-videos', { id });
    showToast('Vídeo removido.', 'orange');
    loadVideos();
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:28}}>
      {/* Form */}
      <div className="dash-card">
        <h3 className="dash-card-title">Atribuir Novo Vídeo</h3>
        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:14}}>
          <div className="form-group">
            <label>Usuário *</label>
            <StudentPicker users={students} value={form.user_id} onChange={id => setForm(f => ({...f, user_id:id}))} />
          </div>
          <div className="form-group">
            <label>URL do YouTube *</label>
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=... ou youtu.be/..."
              value={form.youtube_url}
              onChange={e => setForm(f=>({...f, youtube_url: e.target.value}))}
              required
            />
          </div>
          <div className="form-group">
            <label>Título *</label>
            <input type="text" placeholder="Título do vídeo" value={form.titulo} onChange={e => setForm(f=>({...f, titulo: e.target.value}))} required />
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <DescriptionHelp /><textarea placeholder="Objetivo, pré-requisitos, passos e links de apoio para o aluno..." value={form.descricao} onChange={e => setForm(f=>({...f, descricao: e.target.value}))} rows={3}/>
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : isMaster ? '+ Designar Vídeo' : 'Enviar para aprovação'}
            </button>
          </div>
        </form>
      </div>

      <div className="dash-card">
        <h3 className="dash-card-title">{isMaster?'Solicitações de vídeo':'Minhas solicitações'}</h3>
        {requestError && <p role="alert">{requestError}</p>}
        {!requestError && requests.length===0 && <p className="empty-hint">Nenhuma solicitação.</p>}
        {requests.map(r=><div key={r.id} style={{borderTop:'1px solid var(--border-color)',padding:'14px 0'}}>
          <strong>{r.title}</strong><p>Aluno: {r.user_name} · Solicitado por: {r.requester_name}</p>
          <p>Situação: {r.status==='pending'?'Aguardando aprovação':r.status==='approved'?'Aprovado':'Rejeitado'}</p>
          <a href={r.youtube_url} target="_blank" rel="noreferrer">Ver vídeo ↗</a>
          {isMaster && r.status==='pending' && <div style={{display:'flex',gap:8,marginTop:10}}><button type="button" className="btn-primary" disabled={loading} onClick={()=>decide(r.id,'approve')}>Aprovar</button><button type="button" className="btn-ghost" disabled={loading} onClick={()=>decide(r.id,'reject')}>Rejeitar</button></div>}
        </div>)}
      </div>

      {/* List */}
      <div className="dash-card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10}}>
          <h3 className="dash-card-title" style={{margin:0}}>Vídeos Designados</h3>
          <StudentPicker users={students} value={filterUserId} onChange={setFilterUserId} emptyLabel="Todos os alunos" />
        </div>
        {assignedVideos.length === 0 ? (
          <p className="empty-hint">Nenhum vídeo designado{filterUserId ? ' para este aluno' : ''}.</p>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead><tr><th>Aluno</th><th>Título</th><th>Atribuído em</th><th style={{textAlign:'right'}}>Ações</th></tr></thead>
              <tbody>
                {assignedVideos.map(v => (
                  <tr key={v.id}>
                    <td><strong>{v.user_name}</strong></td>
                    <td>{v.titulo}<br/><span style={{color:'var(--text-muted)',fontSize:11}}>{v.descricao?.slice(0,60)}{v.descricao?.length > 60 ? '…' : ''}</span></td>
                    <td style={{fontSize:12}}>{new Date(v.data_atribuicao).toLocaleDateString('pt-BR')}</td>
                    <td style={{textAlign:'right'}}>
                      <div className="actions-cell">
                        <button className="btn-icon-sm danger" onClick={() => handleDelete(v.id)}>{Icons.delete}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
