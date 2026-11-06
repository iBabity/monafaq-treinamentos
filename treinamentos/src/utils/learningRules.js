// Padrão is the existing store track. Preserve explicitly assigned custom tracks.
export function allowedTrackIds(user) {
  if (user.role === 'admin') return null;
  if (user.track_id === 'track_suporte') return ['track_padrao', 'track_suporte'];
  return [user.track_id || 'track_padrao'];
}

export function canStudyTrack(user, trackId) {
  const ids = allowedTrackIds(user);
  return ids === null || ids.includes(trackId || 'track_padrao');
}

export function orderedCategories(categories) {
  const sorted = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
  const result = [], visited = new Set();
  const visit = (cat, depth) => {
    if (visited.has(cat.id)) return;
    visited.add(cat.id);
    result.push({ ...cat, depth });
    sorted.filter(c => c.parent_id === cat.id).forEach(c => visit(c, depth + 1));
  };
  sorted.filter(c => !c.parent_id || !sorted.some(p => p.id === c.parent_id)).forEach(c => visit(c, 0));
  sorted.forEach(c => visit(c, 0));
  return result;
}

export function categoryLabel(category, categories) {
  const names = [category.name], seen = new Set([category.id]);
  let parent = categories.find(c => c.id === category.parent_id);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id); names.unshift(parent.name);
    parent = categories.find(c => c.id === parent.parent_id);
  }
  return names.join(' › ');
}

export function validParent(categories, id, parentId, trackId) {
  if (!parentId) return true;
  const seen = new Set([id]);
  let parent = categories.find(c => c.id === parentId);
  if (!parent || (parent.track_id || 'track_padrao') !== trackId) return false;
  while (parent) {
    if (seen.has(parent.id)) return false;
    seen.add(parent.id);
    parent = categories.find(c => c.id === parent.parent_id);
  }
  return true;
}

export function safeDescriptionHref(value) {
  if (/^\/platform\?lesson=[a-zA-Z0-9_%.-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
