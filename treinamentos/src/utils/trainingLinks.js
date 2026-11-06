function lessonPath(id) {
  return `/platform?lesson=${encodeURIComponent(id)}`;
}
function trainingReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/platform') || value.includes('\\')) return '/platform';
  try {
    const url = new URL(value, 'https://training.invalid');
    if (url.origin !== 'https://training.invalid' || url.pathname !== '/platform') return '/platform';
    const id = url.searchParams.get('lesson');
    return id && id.length <= 255 ? lessonPath(id) : '/platform';
  } catch { return '/platform'; }
}
module.exports = { lessonPath, trainingReturnPath };
