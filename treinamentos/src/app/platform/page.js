"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StudentView from './StudentView';
import AdminView from './AdminView';
import HomeView from './HomeView';
import { Icons } from './Icons';
import ProfileModal from './SettingsView';
import './student-mode.css';
import { trainingReturnPath } from '@/utils/trainingLinks';

export default function PlatformPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [currentTab, setCurrentTab] = useState('home'); // 'home' | 'training'
  const [initialSection, setInitialSection] = useState('lessons');
  const [openTrainingLesson, setOpenTrainingLesson] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [studentMode, setStudentMode] = useState(false);

  // Force-change-password state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      let session = null;
      try {
        const sessionRes = await fetch('/api/session', { cache: 'no-store' });
        if (!sessionRes.ok) {
          localStorage.removeItem('mnls_session');
          router.push('/login?next=' + encodeURIComponent(trainingReturnPath(window.location.pathname + window.location.search)));
          return;
        }
        const restored = await sessionRes.json();
        session = { userId: restored.id, role: restored.role, name: restored.name, email: restored.email };
        localStorage.setItem('mnls_session', JSON.stringify(session));

        const res = await fetch(`/api/user/info?user_id=${session.userId}`);
        if (res.ok) {
          const fullUser = await res.json();
          session.role = fullUser.role;
          setUser(fullUser);
          if (fullUser.must_change_password) setMustChangePassword(true);
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          localStorage.removeItem('mnls_session');
          router.push('/login?next=' + encodeURIComponent(trainingReturnPath(window.location.pathname + window.location.search)));
          return;
        } else {
          // Fallback to session data if API fails
          setUser({ id: session.userId, role: session.role, name: session.name, email: session.email });
        }
      } catch (err) {
        localStorage.removeItem('mnls_session');
        router.push('/login?next=' + encodeURIComponent(trainingReturnPath(window.location.pathname + window.location.search)));
        return;
      }

      if (session.role === 'admin') {
        setCurrentTab('training');
      }
      if (new window.URLSearchParams(window.location.search).has('lesson')) {
        setStudentMode(session.role === 'admin');
        setCurrentTab('training'); setInitialSection('lessons'); setOpenTrainingLesson(true);
      }

      const incomingTheme = new URLSearchParams(window.location.search).get('tema');
      const savedTheme = ['dark','light'].includes(incomingTheme) ? incomingTheme : (localStorage.getItem('mnls_theme') || 'light');
      localStorage.setItem('mnls_theme', savedTheme);
      if (incomingTheme) { const url = new URL(window.location.href); url.searchParams.delete('tema'); window.history.replaceState(null, '', url.pathname + url.search + url.hash); }
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    };

    loadSession();
  }, [router]);

  const toggleTheme = (e) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';

    if (!document.startViewTransition) {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('mnls_theme', nextTheme);
      return;
    }

    const x = e?.clientX ?? window.innerWidth / 2;
    const y = e?.clientY ?? window.innerHeight / 2;
    document.documentElement.style.setProperty('--x', `${x}px`);
    document.documentElement.style.setProperty('--y', `${y}px`);

    document.documentElement.classList.add('theme-transitioning');

    const transition = document.startViewTransition(() => {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('mnls_theme', nextTheme);
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove('theme-transitioning');
    });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // O redirecionamento local ainda deve acontecer se o servidor estiver indisponivel.
    }
    localStorage.removeItem('mnls_session');
    router.push('/login');
  };

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const handleForceChangePassword = async (e) => {
    e.preventDefault();
    if (!newPwd || newPwd.length < 4) {
      showToast('A senha deve ter pelo menos 4 caracteres.', 'error');
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast('As senhas não coincidem.', 'error');
      return;
    }
    setPwdSaving(true);
    try {
      // Set new password and clear must_change_password flag via the admin route
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, new_password: newPwd }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); setPwdSaving(false); return; }

      // Refresh user info to get the cleared flag
      const infoRes = await fetch(`/api/user/info?user_id=${user.id}`);
      if (infoRes.ok) setUser(await infoRes.json());

      setMustChangePassword(false);
      setNewPwd('');
      setConfirmPwd('');
      showToast('Senha atualizada com sucesso!');
    } catch {
      showToast('Erro ao atualizar senha.', 'error');
    }
    setPwdSaving(false);
  };

  if (!user) return <div className="p-8 text-center">Carregando...</div>;

  const viewingAsStudent = user.role === 'admin' && studentMode;
  const viewUser = viewingAsStudent ? { ...user, role: 'student' } : user;
  const modeControl = user.role === 'admin' ? (
    <button type="button" className="btn-ghost student-mode-control" aria-pressed={viewingAsStudent}
      title={viewingAsStudent ? 'Voltar à administração' : 'Ver como aluno com a trilha desta conta'}
      onClick={() => {
        setStudentMode(!viewingAsStudent);
        setCurrentTab(viewingAsStudent ? 'training' : 'home');
        setInitialSection(viewingAsStudent ? 'dashboard' : 'lessons');
        setOpenTrainingLesson(false);
        setIsProfileModalOpen(false);
      }}>
      {viewingAsStudent ? Icons.dashboard : Icons.users}
      {viewingAsStudent ? 'Voltar ao admin' : 'Modo aluno'}
    </button>
  ) : null;

  // ── Forced password change screen ──────────────────────────────────────────
  if (mustChangePassword) {
    return (
      <>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '24px',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            padding: '40px 36px',
            width: '100%',
            maxWidth: '420px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}>
            {/* Icon + heading */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 60, height: 60,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, var(--accent-primary)))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 26,
              }}>
                🔐
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Crie uma nova senha
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
                Por segurança, o administrador solicitou que você defina uma nova senha antes de continuar.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleForceChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Nova Senha</label>
                <input
                  type="password"
                  placeholder="Mínimo 4 caracteres"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Confirmar Nova Senha</label>
                <input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={pwdSaving}
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              >
                {pwdSaving ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </div>
        </div>

        {/* Toast */}
        <div className={`toast ${!toast.visible ? 'hidden' : ''} ${toast.type === 'error' ? 'toast-error' : ''}`} id="toast">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          <span>{toast.message}</span>
        </div>
      </>
    );
  }

  // ── Normal platform ─────────────────────────────────────────────────────────
  const renderContent = () => {
    if (currentTab === 'home') {
      return (
        <div className="platform-container">
          <header className="topbar" style={{
            padding: '0 32px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            justifyContent: 'space-between'
          }}>
            <div className="sidebar-brand">
              <div className="brand-logo-sm">
                <img src="/static/uploads/logos/logo.png" alt="Monalisa Logo" />
              </div>
              <span className="sidebar-brand-name" style={{ color: 'var(--text-primary)' }}>Monalisa</span>
            </div>
            <div className="topbar-right" style={{ gap: '24px' }}>
              {modeControl}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="student-info" style={{ color: 'var(--text-primary)' }}>
                  <div
                    className="avatar"
                    style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setIsProfileModalOpen(true)}
                    title="Configurações de Perfil"
                  >
                    {user.profile_picture ? (
                      <img src={user.profile_picture} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div
                    className="student-meta"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setInitialSection('myArea'); setCurrentTab('training'); }}
                    title="Minha Área (Progresso)"
                  >
                    <span className="student-name" style={{ color: 'var(--text-primary)' }}>{user.display_name || user.name}</span>
                    <span className="student-role" style={{ color: 'var(--text-muted)' }}>{viewingAsStudent ? 'Modo aluno' : user.role === 'admin' ? 'Administrador' : 'Estudante'}</span>
                  </div>
                </div>
                <div className="sidebar-actions" style={{ display: 'flex', gap: 8 }}>
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
          <main style={{ height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
            <HomeView
              user={viewUser}
              onStartTraining={(section = 'lessons') => {
                setInitialSection(section);
                setOpenTrainingLesson(section === 'lessons');
                setCurrentTab('training');
              }}
            />
          </main>
        </div>
      );
    }

    return user.role === 'admin' && !viewingAsStudent ? (
      <AdminView
        modeControl={modeControl}
        initialSection={initialSection}
        user={user}
        toggleTheme={toggleTheme}
        handleLogout={handleLogout}
        showToast={showToast}
        onBackToHome={() => setCurrentTab('home')}
        theme={theme}
        onEditProfile={() => setIsProfileModalOpen(true)}
      />
    ) : (
      <StudentView key={initialSection}
        modeControl={modeControl}
        user={viewUser}
        toggleTheme={toggleTheme}
        handleLogout={handleLogout}
        showToast={showToast}
        onBackToHome={() => {
          setCurrentTab('home');
          setOpenTrainingLesson(false);
        }}
        theme={theme}
        initialSection={initialSection}
        openTrainingLesson={openTrainingLesson}
        onTrainingLessonOpened={() => setOpenTrainingLesson(false)}
        refreshUser={() => {
          const session = JSON.parse(localStorage.getItem('mnls_session'));
          fetch(`/api/user/info?user_id=${session.userId}`)
            .then(r => r.json())
            .then(data => setUser(data));
        }}
        onEditProfile={() => setIsProfileModalOpen(true)}
      />
    );
  };

  return (
    <>
      <div key={`${currentTab}-${viewingAsStudent}`} className={`animate-page ${user.role === 'admin' ? 'has-student-mode' : ''}`} style={{ width: '100%', height: '100%' }}>
        {renderContent()}
      </div>

      {isProfileModalOpen && (
        <ProfileModal
          user={user}
          showToast={showToast}
          refreshUser={() => {
            const session = JSON.parse(localStorage.getItem('mnls_session'));
            fetch(`/api/user/info?user_id=${session.userId}`)
              .then(r => r.json())
              .then(data => setUser(data));
          }}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}

      {/* Toast */}
      <div className={`toast ${!toast.visible ? 'hidden' : ''} ${toast.type === 'error' ? 'toast-error' : toast.type === 'orange' ? 'toast-orange' : ''}`} id="toast">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        <span>{toast.message}</span>
      </div>
    </>
  );
}
