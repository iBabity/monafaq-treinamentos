import { orderedCategories } from './learningRules';
/**
 * Ordena aulas da trilha (categorias → aulas por sort_order).
 */
export function getOrderedLessons(categories, lessons) {
  if (!Array.isArray(categories) || !Array.isArray(lessons)) return [];

  return orderedCategories(categories)
    .flatMap((cat) =>
      lessons
        .filter((l) => l.category_id === cat.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );
}

/**
 * 0% (nenhuma aula concluída na trilha) → primeira aula.
 * Progresso > 0% → primeira aula ainda não concluída; se todas concluídas, volta à primeira.
 */
export function getTargetLesson(categories, lessons, completedLessonIds = []) {
  const ordered = getOrderedLessons(categories, lessons);
  if (ordered.length === 0) return null;

  const completed = new Set(
    (completedLessonIds || []).filter((id) => ordered.some((l) => l.id === id))
  );

  if (completed.size === 0) {
    return ordered[0];
  }

  return ordered.find((l) => !completed.has(l.id)) ?? ordered[0];
}
