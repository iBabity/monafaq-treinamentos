import { safeDescriptionHref } from '@/utils/learningRules';
export default function LessonDescription({ text }) {
  if (!text) return <p>Esta aula ainda não possui descrição.</p>;
  const parts = text.split(/(\[[^\]\n]+\]\([^\s)]+\)|https?:\/\/[^\s<>]+)/g);
  return <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    const href = safeDescriptionHref(match ? match[2] : part);
    return href ? <a key={i} href={href} target={href.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">{match ? match[1] : part}</a> : <span key={i}>{part}</span>;
  })}</div>;
}
export function DescriptionHelp({ lessons = [] }) {
  return <details><summary title="Como escrever a descrição">Como usar descrições e links</summary>
    <p>Explique o objetivo, o que o aluno precisa saber antes, os passos apresentados e o exercício ao terminar. Cole uma URL ou use [nome do link](https://exemplo.com).</p>
    {lessons.length > 0 && <><p>Para outra aula, copie o link abaixo e cole na descrição:</p><select aria-label="Gerar link para outra aula" defaultValue="" onChange={e => { if (e.target.value) e.target.nextElementSibling.value = `[${lessons.find(l => l.id === e.target.value)?.title}](/platform?lesson=${encodeURIComponent(e.target.value)})`; }}>
      <option value="">Escolha a aula</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
    </select><input aria-label="Link da aula para copiar" readOnly onFocus={e => e.target.select()} /></>}
  </details>;
}
