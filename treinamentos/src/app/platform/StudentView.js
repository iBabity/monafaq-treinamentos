import { CopyContentLink, ReviewStamp } from './ContentSharing';
import { lessonPath } from '@/utils/trainingLinks';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Icons, getCategoryIcon } from './Icons';
import { getYouTubeThumbnailUrl } from '../../utils/youtube';
import { getTargetLesson } from '../../utils/trainingNavigation';
import StudyRoadmap from './StudyRoadmap';
import TrainingPlayer from './TrainingPlayer';
import LessonDescription from './LessonDescription';
import { orderedCategories, categoryLabel } from '@/utils/learningRules';
import { getOrderedLessons } from '@/utils/trainingNavigation';
import './learning.css';
import ManualsView from './ManualsView';

export default function StudentView({
  user,
  toggleTheme,
  handleLogout,
  showToast,
  onBackToHome,
  theme,
  refreshUser,
  initialSection,
  openTrainingLesson = false,
  onTrainingLessonOpened,
  onEditProfile,
  modeControl,
}) {
  const [categories, setCategories] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState([]);  // array of completed lesson IDs
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLesson, setCurrentLesson] = useState(null);
  const [activeSection, setActiveSection] = useState(initialSection || 'lessons'); // 'lessons' | 'myVideos' | 'myArea' | 'settings'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const [dataReady, setDataReady] = useState(false);
  const [playback, setPlayback] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [navDirection, setNavDirection] = useState('');
  const [related, setRelated] = useState({ lesson:'', topics:[] });

  useEffect(() => {
    if (!currentLesson?.id) return;
    const lesson=currentLesson.id, controller=new AbortController();
    fetch(`/api/assuntos-compartilhados?lesson=${encodeURIComponent(lesson)}`, {signal:controller.signal,cache:'no-store'})
      .then(r=>{if(!r.ok)throw Error();return r.json()})
      .then(data=>setRelated({lesson,topics:data.topics,links:data.links||[]}))
      .catch(err=>{if(err.name!=='AbortError')setRelated({lesson,topics:[]})});
    return ()=>controller.abort();
  }, [currentLesson?.id]);

  const recordPlayback = useCallback(record => setPlayback(prev => [...prev.filter(p => p.content_type !== record.content_type || p.content_id !== record.content_id), record]), []);

  // The parent remounts this view when the requested section changes.
  const pendingOpen = useRef(openTrainingLesson);
  const openedCallback = useRef(onTrainingLessonOpened);

  const applyTargetLesson = useCallback((cats, lsns, prog) => {
    const trackCategoryIds = new Set(cats.map((c) => c.id));
    const trackLessons = lsns.filter((l) => trackCategoryIds.has(l.category_id));
    const linkedId = new URLSearchParams(window.location.search).get('lesson');
    const target = linkedId ? trackLessons.find(l => l.id === linkedId) : getTargetLesson(cats, trackLessons, prog);
    if (linkedId && !target) setLoadError('Esta aula não está disponível para sua trilha. Volte ao início ou tente carregar seu roteiro.');
    if (linkedId) window.history.replaceState(null, '', '/platform');
    if (!target) return false;

    setNavDirection('');
    setCurrentLesson(target);
    setActiveSection('lessons');
    setSidebarOpen(false);
    window.scrollTo(0, 0);
    if (target.category_id) {
      setOpenCats((prev) => ({ ...prev, [target.category_id]: true }));
    }
    return true;
  }, []);

  // Assigned videos state
  const [assignedVideos, setAssignedVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [assignedFilter, setAssignedFilter] = useState('all');
  const assignedStatus = v => v.visto ? 'done' : playback.some(p => p.content_type === 'assigned' && p.content_id === v.id) ? 'started' : 'new';


  const loadData = useCallback(() => {
      const read = async url => { const response = await fetch(url); if (!response.ok) throw new Error(); return response.json(); };
      return Promise.all([
        read('/api/categories'), read('/api/lessons'),
        read(`/api/user/progress?user_id=${encodeURIComponent(user.id)}`),
        read(`/api/assigned-videos?user_id=${encodeURIComponent(user.id)}`), read('/api/user/playback'),
      ]).then(([cats, lsns, prog, vids, positions]) => {
      setLoadError('');
      try { setSidebarCollapsed(localStorage.getItem('mnls_sidebar_collapsed') === 'true'); } catch {}
      const ordered = orderedCategories(cats);
      setCategories(ordered); setLessons(lsns); setProgress(prog); setAssignedVideos(vids); setPlayback(positions); setDataReady(true);
      if (pendingOpen.current) {
        pendingOpen.current = false;
        applyTargetLesson(ordered, lsns, prog);
        openedCallback.current?.();
      }
      }).catch(() => setLoadError('Não foi possível carregar o treinamento. Tente novamente.'));
  }, [user.id, applyTargetLesson]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLessonClick = async (lesson, direction = '') => {
    try {
      setNavDirection(direction);
      setCurrentLesson(lesson);
      setActiveSection('lessons');
      setSidebarOpen(false);
      window.scrollTo(0, 0);
      
      // Update views background
      fetch('/api/lessons/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lesson.id }),
      }).catch(err => console.error('Error tracking view:', err));

      setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, views: (l.views || 0) + 1 } : l));
    } catch (err) {
      console.error('handleLessonClick Error:', err);
    }
  };

  const toggleComplete = async (lesson = currentLesson) => {
    if (!lesson || savingCompletion) return;
    setSavingCompletion(true);
    try {
    const isDone = progress.includes(lesson.id);
    const newDone = !isDone;

    const response = await fetch('/api/user/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        lesson_id: lesson.id,
        completed: newDone,
        track_id: user.track_id || 'track_padrao',
      }),
    });
    if (!response.ok) { showToast('Não foi possível salvar a conclusão. Tente novamente.', 'error'); return; }
    setProgress(prev => newDone ? [...prev, lesson.id] : prev.filter(id => id !== lesson.id));
    showToast(newDone ? 'Aula marcada como concluída!' : 'Marcação removida.', newDone ? 'success' : 'orange');
    } catch { showToast('Não foi possível salvar a conclusão. Tente novamente.', 'error'); }
    finally { setSavingCompletion(false); }
  };

  const isSearch = searchQuery.trim().length > 0;
  const q = searchQuery.toLowerCase();
  const toggleCat = (catId) => { if (!isSearch) setOpenCats(prev => ({ ...prev, [catId]: !prev[catId] })); };

  const trackLessonIds = new Set(
    categories.flatMap((cat) =>
      lessons.filter((l) => l.category_id === cat.id).map((l) => l.id)
    )
  );
  const trackProgress = progress.filter((id) => trackLessonIds.has(id));
  const totalLessons = trackLessonIds.size;
  const doneLessons = trackProgress.length;
  const pct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
  const currentCat = currentLesson ? categories.find(c => c.id === currentLesson.category_id) : null;
  
  // Navigation logic
  const flattenedLessons = getOrderedLessons(categories, lessons);
  const nextTopic = flattenedLessons.find(l => !progress.includes(l.id));

  const currentIndex = activeSection === 'lessons' 
    ? flattenedLessons.findIndex(l => l.id === currentLesson?.id)
    : assignedVideos.findIndex(v => v.id === currentVideo?.id);

  const canGoPrev = currentIndex > 0;
  const canGoNext = activeSection === 'lessons' 
    ? currentIndex < flattenedLessons.length - 1 
    : currentIndex < assignedVideos.length - 1;

  const goToNext = () => {
    if (activeSection === 'lessons') {
      if (currentIndex < flattenedLessons.length - 1) handleLessonClick(flattenedLessons[currentIndex + 1], 'next');
    } else {
      if (currentIndex < assignedVideos.length - 1) {
        setNavDirection('next');
        setCurrentVideo(assignedVideos[currentIndex + 1]);
        window.scrollTo(0, 0);
      }
    }
  };

  const goToPrev = () => {
    if (activeSection === 'lessons') {
      if (currentIndex > 0) handleLessonClick(flattenedLessons[currentIndex - 1], 'prev');
    } else {
      if (currentIndex > 0) {
        setNavDirection('prev');
        setCurrentVideo(assignedVideos[currentIndex - 1]);
        window.scrollTo(0, 0);
      }
    }
  };

  const renderSidebarContent = () => {
    if (activeSection === 'myVideos') {
      return (
        <div style={{padding:'8px 0'}}>
          {assignedVideos.length === 0 ? (
            <p className="sidebar-no-results">Nenhum vídeo designado ainda.</p>
          ) : assignedVideos.map(v => (
            <div
              key={v.id}
              className={`lesson-link ${currentVideo?.id === v.id ? 'active' : ''}`}
              onClick={() => { setCurrentVideo(v); setSidebarOpen(false); window.scrollTo(0,0); }}
              role="button" tabIndex="0"
            >
              <div className="check-circle" style={{opacity: 0.6}}>{Icons.play}</div>
              <span className="lesson-name">{v.titulo}</span>
            </div>
          ))}
        </div>
      );
    }

    let anyResult = false;
    const items = orderedCategories(categories).map(cat => {
      const allCatLessons = lessons
        .filter(l => l.category_id === cat.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const catLessons = isSearch
        ? allCatLessons.filter(l => l.title.toLowerCase().includes(q) || (l.subtitle || '').toLowerCase().includes(q))
        : allCatLessons;
      if (isSearch && catLessons.length === 0) return null;
      anyResult = true;
      const isOpen = isSearch || openCats[cat.id] || catLessons.some(l => l.id === currentLesson?.id);
      return (
        <div key={cat.id} className="accordion-item" style={{ marginLeft: Math.min(cat.depth || 0, 4) * 12 }}>
          <div className={`accordion-header ${isOpen ? 'open' : ''}`} onClick={() => toggleCat(cat.id)}>
            <div className="accordion-cat-icon">{getCategoryIcon(cat)}</div>
            <span className="accordion-cat-name">{categoryLabel(cat, categories)}</span>
            <span className="accordion-count">{catLessons.length}</span>
            <div className={`accordion-chevron ${isOpen ? 'open' : ''}`}>{Icons.chevron}</div>
          </div>
          <div className={`accordion-lessons ${isOpen ? 'open' : ''}`}>
            {catLessons.map(l => {
              const done = trackProgress.includes(l.id);
              const active = currentLesson?.id === l.id;
              return (
                <div key={l.id} className={`lesson-link ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                  <button type="button" className="lesson-open" onClick={() => handleLessonClick(l)}>
                    <span className="lesson-bullet-icon">{Icons.chevronRight}</span>
                    <span className="lesson-name">{l.title}</span>
                  </button>
                  <button type="button" className="check-circle" disabled={savingCompletion} aria-label={`${done ? "Desmarcar conclusão" : "Marcar como concluída"}: ${l.title}`} onClick={e => { e.stopPropagation(); toggleComplete(l); }}>{done ? Icons.check : null}</button>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
    if (isSearch && !anyResult) return <p className="sidebar-no-results">Nenhuma aula encontrada.</p>;
    return items;
  };

  return (
    <section id="page-student" className={`page active ${activeSection === 'manuals' ? 'manuals-active' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header className="topbar" style={{ 
        position: 'relative', 
        width: '100%', 
        justifyContent: 'space-between', 
        padding: '0 32px',
        zIndex: 110,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <button className="icon-btn learning-menu-toggle" title="Expandir ou recolher menu" aria-label="Expandir ou recolher menu" aria-expanded={sidebarOpen || !sidebarCollapsed} onClick={() => {
            if (window.innerWidth <= 900) setSidebarOpen(!sidebarOpen);
            else { setSidebarCollapsed(!sidebarCollapsed); try { localStorage.setItem('mnls_sidebar_collapsed', String(!sidebarCollapsed)); } catch {} }
          }}>{Icons.hamburger}</button>
          <div className="sidebar-brand" onClick={onBackToHome} style={{ cursor: 'pointer', border: 'none', padding: 0 }}>
            <div className="brand-logo-sm">
              <img src="/static/uploads/logos/logo.png" alt="Monalisa Logo" />
            </div>
            <span className="sidebar-brand-name" style={{ color: 'var(--text-primary)' }}>Monalisa</span>
          </div>
          
          <nav className="breadcrumb" style={{ margin: 0 }}>
            {activeSection === 'myVideos' ? (
              currentVideo ? (
                <><span>Meus Vídeos</span><span className="sep">›</span><span className="current">{currentVideo.titulo}</span></>
              ) : <span>Meus Vídeos</span>
            ) : activeSection === 'manuals' ? (
              <span>Manuais do Sistema</span>
            ) : activeSection === 'myArea' ? (
              <span>Minha Área</span>
            ) : activeSection === 'settings' ? (
              <span>Configurações</span>
            ) : currentLesson ? (
              <><span>{currentCat?.name}</span><span className="sep">›</span><span className="current">{currentLesson.title}</span></>
            ) : <span>Início</span>}
          </nav>
        </div>

        <div className="topbar-right" style={{ gap: '24px' }}>
          <button className="icon-btn" title="Como usar o treinamento" aria-label="Como usar o treinamento" onClick={() => { setActiveSection('myArea'); setSidebarOpen(false); }}>{Icons.help}</button>
          {modeControl}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeSection === 'lessons' && (
              <div className="progress-pill">
                <div className="progress-bar-inner" style={{ width: `${pct}%` }}></div>
                <span className="progress-text">{pct}% concluído</span>
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border-color)', opacity: 0.5 }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="student-info" style={{ color: 'var(--text-primary)' }}>
              <div 
                className="avatar" 
                style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                onClick={onEditProfile}
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
                onClick={() => setActiveSection('myArea')}
                title="Minha Área (Progresso)"
              >
                <span className="student-name" style={{ color: 'var(--text-primary)' }}>{user.display_name || user.name}</span>
                <span className="student-role" style={{ color: 'var(--text-muted)' }}>Estudante</span>
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

      <div className="lms-layout" style={{ flex: 1, height: 'calc(100vh - 64px)' }}>
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ height: '100%', borderTop: 'none' }}>
          <div style={{padding:'20px 16px 0', display:'flex', gap:8}}>
            <button
              className={activeSection === 'lessons' ? 'btn-primary' : 'btn-ghost'}
              style={{
                flex: 1, 
                fontSize: 12, 
                padding: '6px 4px', 
                justifyContent: 'center',
                color: activeSection === 'lessons' ? '#fff' : 'rgba(255,255,255,0.8)',
                border: activeSection === 'lessons' ? 'none' : '1px solid rgba(255,255,255,0.2)'
              }}
              onClick={() => {
                setActiveSection('lessons');
                setCurrentVideo(null);
                setCurrentLesson(null);
              }}
            >
              Aulas
            </button>
            <button
              className={activeSection === 'myVideos' ? 'btn-primary' : 'btn-ghost'}
              style={{
                flex: 1, 
                fontSize: 12, 
                padding: '6px 4px', 
                justifyContent: 'center',
                color: activeSection === 'myVideos' ? '#fff' : 'rgba(255,255,255,0.8)',
                border: activeSection === 'myVideos' ? 'none' : '1px solid rgba(255,255,255,0.2)'
              }}
              onClick={() => { setActiveSection('myVideos'); setCurrentLesson(null); setCurrentVideo(null); }}
            >
              Meus Vídeos
            </button>
          </div>

          <div style={{padding:'12px 16px'}}><button className="btn-primary" onClick={() => { setActiveSection('myArea'); setSidebarOpen(false); }}>Meu roteiro e progresso</button></div>
          {activeSection === 'lessons' && (
            <div className="sidebar-search-wrap">
              <div className="sidebar-search-box">
                {Icons.search}
                <input id="sidebar-search" type="text" placeholder="Buscar aula..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {isSearch && <button className="search-clear" onClick={() => setSearchQuery('')}>{Icons.close}</button>}
              </div>
            </div>
          )}

          {activeSection !== 'manuals' && <nav className="sidebar-nav">
            <p className="sidebar-nav-label">
              {activeSection === 'myVideos' ? 'Meus Vídeos' : (isSearch ? `Resultados para "${searchQuery}"` : 'Módulos')}
            </p>
            {renderSidebarContent()}
          </nav>}
        </aside>

        <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          <div key={activeSection} className="animate-page" style={{ width: '100%', height: '100%' }}>
            {loadError ? <div role="alert" className="study-roadmap">{loadError}<button className="btn-primary" onClick={loadData}>Tentar novamente</button></div> : !dataReady ? <p>Carregando treinamento…</p> : activeSection === 'manuals' ? (
              <div className="manual-host"><ManualsView showToast={showToast} /></div>
            ) : activeSection === 'myArea' ? (
            <StudyRoadmap lessons={flattenedLessons} completed={progress} playback={playback} onSelect={handleLessonClick} />
          ) : activeSection === 'settings' ? (
            null
          ) : activeSection === 'lessons' && !currentLesson ? (
            <StudyRoadmap lessons={flattenedLessons} completed={progress} playback={playback} onSelect={handleLessonClick} />
          ) : (activeSection === 'lessons' && currentLesson) ? (
            <div key={currentLesson.id} className={`lesson-view slide-anim-${navDirection}`}>
              <div style={{ position: 'absolute', right: 32, top: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <button className={`complete-btn ${progress.includes(currentLesson.id) ? 'is-done' : ''}`} onClick={() => toggleComplete()} disabled={savingCompletion} style={{ margin: 0, stroke: 'currentColor' }}>
                  <span>Concluído</span>
                  {progress.includes(currentLesson.id) ? Icons.check : Icons.circle}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="icon-btn" onClick={goToPrev} disabled={!canGoPrev} title="Anterior" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', stroke: 'currentColor', opacity: canGoPrev ? 1 : 0.4 }}>{Icons.chevronLeft}</button>
                  <button className="icon-btn" onClick={goToNext} disabled={!canGoNext} title="Próximo" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', stroke: 'currentColor', opacity: canGoNext ? 1 : 0.4 }}>{Icons.chevronRight}</button>
                </div>
              </div>
              <div className="lesson-info">
                <div className="lesson-meta-top">
                  <span className="lesson-category-tag">{currentCat?.name}</span>
                  <span className="lesson-duration-tag">{Icons.duration}<span>{currentLesson.duration || '—'}</span></span>
                </div>
                <h2 className="lesson-title">{currentLesson.title}</h2>
                <p className="lesson-subtitle">{currentLesson.subtitle}</p><div className="content-sharing-row"><ReviewStamp name={currentLesson.reviewed_by_name} /><CopyContentLink path={lessonPath(currentLesson.id)} /></div>
                <div className="lesson-divider"></div>
                <div className="lesson-description" style={{ marginBottom: 24 }}>
                  <LessonDescription text={currentLesson.description} />
                </div>
              </div>
              {currentLesson.video_url?.startsWith('/material-gestores/') ? (
                <div className="lesson-description" style={{ margin: '0 0 24px' }}>
                  <p>Página original do manual. Ela pode conter outros assuntos além deste tópico.</p>
                  <img src={`/api/manual-pagina?lesson=${encodeURIComponent(currentLesson.id)}`} alt={`Página do manual sobre ${currentLesson.title}`} onError={e=>{e.currentTarget.style.display='none';e.currentTarget.nextElementSibling.hidden=false}} style={{ display: 'block', width: '100%', maxWidth: 1100, height: 'auto', borderRadius: 8 }} /><p hidden>A página original está indisponível; ela pode conter material restrito. Consulte o texto autorizado da aula.</p>
                </div>
              ) : <TrainingPlayer key={`${user.id}:lesson:${currentLesson.id}`} userId={user.id} contentId={currentLesson.id} url={currentLesson.video_url} title={currentLesson.title} saved={playback.find(p => p.content_type === 'lesson' && p.content_id === currentLesson.id)} onProgress={recordPlayback} />}

              <section className="study-next" aria-label="Material de consulta"><strong>Material de consulta</strong>{related.lesson === currentLesson.id && related.topics.length ? related.topics.map(topic =>  <div key={topic.id} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><h3>{topic.title}</h3>{topic.body.split(/(\[\[(?:artigo:(?:m-\d+|[0-9a-f-]{36})|imagem:\d+)\]\])/gi).map((part,index)=>{const id=part.match(/^\[\[artigo:(m-\d+|[0-9a-f-]{36})\]\]$/i)?.[1];if(id){const target=related.links?.find(link=>link.id===id);return target?<a key={index} href={lessonPath(target.lesson_id)}>{target.title}</a>:<span key={index}>Artigo não disponível para esta aula.</span>}const n=Number(part.match(/^\[\[imagem:(\d+)\]\]$/)?.[1]);if(n){const image=topic.images?.[n-1];return image?<img key={index} src={`/api/assuntos-compartilhados/imagem?lesson=${encodeURIComponent(currentLesson.id)}&id=${encodeURIComponent(image)}`} alt={`Imagem ${n} do artigo`} style={{display:'block',maxWidth:'100%',height:'auto',margin:'12px 0'}} />:<span key={index}>Imagem indisponível.</span>}return <LessonDescription key={index} text={part} />})}</div>) : <p>Nenhum artigo liberado e vinculado a esta aula.</p>}</section>
              <div className="study-next"><strong>Etapa {currentIndex + 1} de {flattenedLessons.length}</strong>
                <p>{progress.includes(currentLesson.id) ? 'Etapa concluída.' : currentLesson.video_url?.startsWith('/material-gestores/') ? 'Ao terminar a leitura e praticar, marque Concluído antes de seguir.' : 'Ao terminar o vídeo e praticar, marque Concluído antes de seguir.'}</p>
                {canGoNext && <p>Próximo tópico: {flattenedLessons[currentIndex + 1]?.title}</p>}
                {nextTopic && nextTopic.id !== currentLesson.id && <button className="btn-ghost" onClick={() => handleLessonClick(nextTopic)}>Retomar etapa pendente: {nextTopic.title}</button>}
                <button className="btn-ghost" onClick={() => setActiveSection('myArea')}>Ver roteiro completo</button>
              </div>
            </div>
          ) : activeSection === 'myVideos' && !currentVideo ? (
            <div style={{padding:'32px 24px'}}>
              <h2 style={{marginBottom:8}}>Meus Vídeos Designados</h2>
              <p style={{color:'var(--text-muted)', marginBottom:24}}>
                {assignedVideos.length === 0
                  ? 'Nenhum vídeo foi designado para você ainda.'
                  : 'Selecione um vídeo abaixo ou no menu lateral para assistir.'}
              </p>
              <div className="study-filters">{[['all','Todos'],['started','Em andamento'],['done','Finalizados'],['new','Não iniciados']].map(([key,label]) => <button key={key} className={assignedFilter === key ? 'btn-primary' : 'btn-ghost'} aria-pressed={assignedFilter === key} onClick={() => setAssignedFilter(key)}>{label}</button>)}</div>
              {!assignedVideos.some(v => assignedFilter === 'all' || assignedStatus(v) === assignedFilter) && <p>Nenhum vídeo neste filtro.</p>}
              {assignedVideos.length > 0 && (
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:20}}>
                  {assignedVideos.filter(v => assignedFilter === 'all' || assignedStatus(v) === assignedFilter).map(v => (
                    <div key={v.id} className="dash-card" style={{cursor:'pointer', transition:'transform .2s'}}
                      onClick={() => setCurrentVideo(v)}
                    >
                      <div style={{position:'relative', paddingBottom:'56.25%', borderRadius:8, overflow:'hidden', marginBottom:12, background:'var(--bg-secondary)'}}>
                        <img src={getYouTubeThumbnailUrl(v.youtube_url)} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8}}>
                        <div>
                          <strong style={{display:'block', marginBottom:4}}>{v.titulo}</strong><small>{assignedStatus(v) === 'done' ? 'Finalizado' : assignedStatus(v) === 'started' ? 'Em andamento' : 'Não iniciado'}</small>
                          {v.descricao && <p style={{color:'var(--text-muted)', fontSize:13, margin:0}}>{v.descricao}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeSection === 'myVideos' && currentVideo ? (
            <div className="lesson-view">
              <div className="lesson-info">
                <div className="lesson-meta-top">
                  <span className="lesson-category-tag">Vídeo Designado</span>
                </div>
                <h2 className="lesson-title">{currentVideo.titulo}</h2>
                <button className="btn-primary" onClick={async () => {
                  try {
                    const response = await fetch('/api/user/assigned-progress', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:currentVideo.id,completed:!currentVideo.visto})});
                    if (!response.ok) throw new Error();
                    const updated = {...currentVideo,visto:!currentVideo.visto}; setCurrentVideo(updated); setAssignedVideos(prev => prev.map(v => v.id === updated.id ? updated : v));
                    showToast(updated.visto ? 'Vídeo concluído!' : 'Marcação removida.');
                  } catch {showToast('Não foi possível salvar a conclusão.', 'error');}
                }}>{currentVideo.visto ? 'Desmarcar conclusão' : 'Marcar como concluído'}</button>
                <div className="lesson-divider"></div>
                <div className="lesson-description" style={{ marginBottom: 24 }}>
                  <LessonDescription text={currentVideo.descricao} />
                </div>
                <p style={{color:'var(--text-muted)', fontSize:12, marginTop:12, marginBottom: 12 }}>
                  Atribuído em: {new Date(currentVideo.data_atribuicao).toLocaleDateString('pt-BR')}
                </p>
                <button style={{marginBottom:24}} onClick={() => setCurrentVideo(null)} className="btn-ghost">← Voltar para Meus Vídeos</button>
              </div>
              <TrainingPlayer key={`${user.id}:assigned:${currentVideo.id}`} userId={user.id} type="assigned" contentId={currentVideo.id} url={currentVideo.youtube_url} title={currentVideo.titulo} saved={playback.find(p => p.content_type === 'assigned' && p.content_id === currentVideo.id)} onProgress={recordPlayback} />

            </div>
          ) : null}
          </div>
        </main>
      </div>
    </section>
  );
}
