import { useState, useEffect } from 'react';
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '@/utils/youtube';
import { Icons } from './Icons';
import './learning.css';

export default function HomeView({ user, onStartTraining }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);
  const [recentError, setRecentError] = useState(false);
  useEffect(() => { fetch('/api/lessons').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(rows => setRecent(rows.filter(l => l.created_at).sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0,6))).catch(() => setRecentError(true)); }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.valor) setVideoUrl(getYouTubeEmbedUrl(data.valor));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-view" style={{ padding: '32px' }}>
      <div className="home-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: '2.5fr 1fr', 
        gap: '40px',
        maxWidth: '1200px',
        margin: '0 auto',
        paddingTop: '20px'
      }}>
        {/* Coluna da Esquerda: Vídeo */}
        <div className="home-main-col">
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            marginBottom: '20px', 
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ 
              width: '4px', 
              height: '24px', 
              background: 'var(--orange)', 
              borderRadius: '2px' 
            }}></span>
            Últimas Atualizações
          </h2>
          
          <div className="recent-lessons">
            {recent.map(l => {
              const thumbnail = /^\/material-gestores\/(?:[1-9]|[1-9]\d|1\d\d|2[0-3]\d|24[0-4])\.webp$/.test(l.video_url || '') ? `/api/manual-pagina?lesson=${encodeURIComponent(l.id)}` : getYouTubeThumbnailUrl(l.video_url);
              return <a key={l.id} href={`/platform?lesson=${encodeURIComponent(l.id)}`}>{thumbnail ? <img src={thumbnail} alt="" /> : <span className="recent-lesson-placeholder" aria-hidden="true">{Icons.lessons}</span>}<span>{l.title}<small>Adicionado em {new Date(l.created_at).toLocaleDateString('pt-BR')}</small></span></a>;
            })}
            {!recent.length && <p>{recentError ? 'Não foi possível carregar as atualizações.' : 'As novas aulas cadastradas aparecerão aqui. As aulas antigas continuam no treinamento.'}</p>}
          </div>
          <h3 style={{marginBottom:12}}>Vídeo em destaque</h3>
          <div className="video-wrapper" style={{ 
            background: 'var(--bg-card)', 
            padding: '12px', 
            borderRadius: 'var(--radius-lg)', 
            boxShadow: '0 0 20px rgba(244, 123, 32, 0.15)',
            border: '2px solid var(--orange)'
          }}>
            <div className="video-container" style={{ 
              position: 'relative', 
              paddingBottom: '56.25%', 
              height: 0, 
              overflow: 'hidden', 
              borderRadius: 'var(--radius-md)',
              background: '#000'
            }}>
              {loading ? (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  Carregando vídeo...
                </div>
              ) : videoUrl ? (
                <iframe
                  src={`${videoUrl}?rel=0&modestbranding=1`}
                  title="Vídeo em Destaque"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  Nenhum vídeo em destaque disponível.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Menu Rápido */}
        <div className="home-side-col" style={{ paddingTop: '54px' }}>
          <h3 style={{ 
            fontSize: '11px', 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px', 
            color: 'var(--text-muted)', 
            marginBottom: '16px',
            fontWeight: '700',
            opacity: 0.8
          }}>
            ACESSO RÁPIDO
          </h3>
          <div className="quick-menu" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <a className="btn-ghost" href="/api/manual-aluno" download="Manual-Monalisa-Gestores-Aluno.pdf" style={{ minHeight: 64, padding: '16px 24px', gap: 12, justifyContent: 'flex-start', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, textDecoration: 'none' }}>
              <span style={{ width: 20, height: 20, flexShrink: 0 }}>{Icons.fiscal}</span>Manual Monalisa Gestores · Aluno
            </a>
            <button 
              className="btn-ghost" 
              onClick={() => onStartTraining()}
              style={{ 
                height: '64px', 
                padding: '0 24px', 
                fontSize: '16px', 
                justifyContent: 'flex-start',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.borderColor = 'var(--orange)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  background: 'transparent', 
                  width: '32px', 
                  height: '32px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--orange)'
                }}>
                  <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {Icons.fiscal}
                  </div>
                </div>
                <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>Treinamento</span>
              </div>
            </button>

            <button 
              className="btn-ghost" 
              onClick={() => onStartTraining('myArea')}
              style={{ 
                height: '64px', 
                padding: '0 24px', 
                fontSize: '16px', 
                justifyContent: 'flex-start',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-card)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.borderColor = 'var(--orange)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            >
              <div style={{ 
                background: 'transparent', 
                width: '32px', 
                height: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--orange)',
                marginRight: '12px'
              }}>
                <svg viewBox="0 0 24 24" style={{width: 18, height: 18}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>Minha Área</span>
            </button>

            <button 
              className="btn-ghost" 
              style={{ 
                height: '64px', 
                padding: '0 24px', 
                fontSize: '16px', 
                justifyContent: 'flex-start',
                gap: '12px',
                borderRadius: 'var(--radius-lg)',
                opacity: 0.6,
                cursor: 'not-allowed',
                background: 'var(--bg-card)'
              }}
            >
              <div style={{ 
                background: 'transparent', 
                width: '32px', 
                height: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}>
                <svg viewBox="0 0 24 24" style={{width: 18, height: 18}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-muted)' }}>Em breve</span>
            </button>
          </div>

          <div className="home-stats-card" style={{ 
            marginTop: '32px', 
            padding: '20px', 
            background: 'var(--bg-card)', 
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border-color)'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--orange)' }}>Bons estudos, {user.name}!</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Acompanhe seu progresso e mantenha seu conhecimento sempre atualizado com nossos módulos.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .home-grid {
            grid-template-columns: 1fr !important;
          }
          .home-main-col {
            flex: 1 1 100% !important;
          }
          .home-side-col {
            flex: 1 1 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
