import { useState } from 'react';
import { formatPosition } from './TrainingPlayer';

export default function StudyRoadmap({ lessons, completed, playback, onSelect }) {
  const [filter, setFilter] = useState('all');
  const status = lesson => completed.includes(lesson.id) ? 'done' : playback.some(p => p.content_type === 'lesson' && p.content_id === lesson.id) ? 'started' : 'new';
  const counts = { all: lessons.length, started: lessons.filter(l => status(l) === 'started').length, done: lessons.filter(l => status(l) === 'done').length, new: lessons.filter(l => status(l) === 'new').length };
  const next = lessons.find(l => status(l) !== 'done');
  return <section className="study-roadmap">
    <div className="study-heading"><h2>Meu roteiro de estudos</h2><details><summary title="Como usar">Como usar</summary><p>Siga as aulas na ordem. Ao terminar cada etapa e praticar, marque Concluído. A posição do vídeo é salva automaticamente; assistir não marca a aula como concluída.</p></details></div>
    <p>{counts.done} de {counts.all} etapas concluídas · {counts.all ? Math.round(counts.done / counts.all * 100) : 0}%</p>
    <progress value={counts.done} max={counts.all || 1} aria-label="Progresso do roteiro" />
    {next ? <div className="study-next"><strong>Próxima etapa: {next.title}</strong><p>Conclua cada etapa antes de avançar para manter a sequência do treinamento.</p><button className="btn-primary" onClick={() => onSelect(next)}>Continuar treinamento</button></div> : <p>{lessons.length ? 'Você concluiu todas as etapas disponíveis. Revise as aulas sempre que precisar.' : 'Nenhuma aula disponível nesta trilha.'}</p>}
    <div className="study-filters">{[['all','Todas'],['started','Em andamento'],['done','Finalizadas'],['new','Não iniciadas']].map(([key,label]) => <button key={key} className={filter === key ? 'btn-primary' : 'btn-ghost'} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} ({counts[key]})</button>)}</div>
    <ol className="study-steps">{lessons.map((l,index) => ({l,index})).filter(({l}) => filter === 'all' || status(l) === filter).map(({l,index}) => {
      const saved = playback.find(p => p.content_type === 'lesson' && p.content_id === l.id);
      return <li key={l.id}><button className="study-step" onClick={() => onSelect(l)}><span>Etapa {index + 1} · {l.title}</span><small>{status(l) === 'done' ? 'Finalizada' : status(l) === 'started' ? `Em andamento · ${formatPosition(saved?.position_seconds)}` : 'Não iniciada'}{l.id === next?.id ? ' · Próxima etapa' : ''}</small></button></li>;
    })}</ol>
    {counts[filter] === 0 && <p>Nenhuma aula neste filtro.</p>}
  </section>;
}
