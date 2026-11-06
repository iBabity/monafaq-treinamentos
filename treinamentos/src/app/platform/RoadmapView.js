import { useState, useEffect } from 'react';
import { Icons } from './Icons';

export default function RoadmapView({ user, onContinue, onEditProfile, onSelectModule }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('RoadmapView: Init for user', user?.id);
    if (!user?.id) {
      setError('ID de usuário não encontrado.');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const r = await fetch(`/api/user/roadmap?user_id=${user.id}`);
        if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
        const data = await r.json();
        setModules(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('RoadmapView Error:', err);
        setError('Erro ao carregar os dados da trilha.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div className="loading-spinner" style={{ marginBottom: '16px' }}></div>
      Carregando sua trilha de aprendizado...
    </div>
  );

  if (error) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--orange)' }}>
      <p>{error}</p>
      <button className="btn-ghost" onClick={() => window.location.reload()}>Tentar Novamente</button>
    </div>
  );

  return (
    <div className="roadmap-container">
      <header className="roadmap-header">
        <div className="user-profile-summary">
          <div className="profile-img-lg">
            {user.profile_picture ? (
              <img src={user.profile_picture} alt={user.name} />
            ) : (
              <span>{user.name?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="profile-info-summary">
            <h2 style={{ color: 'var(--text-primary)', fontSize: '28px', fontWeight: '800' }}>
              Olá, {user.display_name || user.name}!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
              Acompanhe seu progresso e domine o sistema.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn-primary" onClick={onContinue}>
            Continuar Treinamento
          </button>
          <button
            className="btn-ghost"
            onClick={onEditProfile}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}
          >
            Editar Perfil
          </button>
        </div>
      </header>

      <div className="roadmap-content">
        {modules.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
            Nenhum módulo encontrado na trilha.
          </p>
        ) : (
          <div className="roadmap-grid">
            {modules.map((mod) => (
              <div 
                key={mod.id} 
                className={`module-card ${mod.status}`}
                onClick={() => onSelectModule && onSelectModule(mod.id)}
                style={{
                  background: 'var(--bg-card)',
                  padding: '24px',
                  borderRadius: 'var(--radius-lg)',
                  border: mod.status === 'concluido' ? '2px solid var(--orange)' : '1px solid var(--border-color)',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: mod.status === 'concluido' ? '0 8px 24px rgba(244, 123, 32, 0.15)' : 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    color: 'var(--text-muted)', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Módulo {mod.sort_order || '-'}
                  </span>
                  {mod.status === 'concluido' ? (
                    <div style={{ color: 'var(--orange)' }}>{Icons.check}</div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{Icons.lock}</div>
                  )}
                </div>

                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '700', 
                  color: 'var(--text-primary)',
                  margin: '8px 0'
                }}>
                  {mod.title}
                </h3>

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {mod.completedLessons} / {mod.totalLessons} aulas
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--orange)' }}>
                      {mod.progressPct}%
                    </span>
                  </div>
                  <div style={{ 
                    height: '6px', 
                    background: 'var(--border-color)', 
                    borderRadius: '3px', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      width: `${mod.progressPct}%`, 
                      height: '100%', 
                      background: 'linear-gradient(90deg, var(--orange), var(--orange-light))',
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
