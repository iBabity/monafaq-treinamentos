/**
 * Converte links do YouTube para o formato embed.
 * Suporta formatos:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
export function getYouTubeVideoId(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || '';
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/shorts/')[1]?.split('/')[0] || '';
    }
    if (host === 'youtu.be') {
      return parsed.pathname.replace('/', '').split('/')[0] || '';
    }
  } catch (err) {
    if (url.includes('watch?v=')) return url.split('v=')[1].split('&')[0];
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
    if (url.includes('/embed/')) return url.split('/embed/')[1].split('?')[0].split('/')[0];
  }

  return '';
}

export function getYouTubeEmbedUrl(url) {
  if (!url) return '';
  if (url.includes('/embed/')) return url;

  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  return url;
}

export function getYouTubeThumbnailUrl(url) {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
}

export function getYouTubeWatchUrl(url) {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : (url || '');
}

// Alias para compatibilidade
export const toEmbedUrl = getYouTubeEmbedUrl;
