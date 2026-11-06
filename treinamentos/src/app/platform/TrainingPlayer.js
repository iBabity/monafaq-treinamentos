import { useEffect, useRef, useState } from 'react';
import { getYouTubeVideoId } from '@/utils/youtube';

let apiPromise;
function youtubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { apiPromise = null; reject(new Error('Player indisponível.')); }, 20000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); previous?.(); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); apiPromise = null; reject(new Error('Player indisponível.')); };
    document.head.appendChild(script);
  });
  return apiPromise;
}
export const playbackKey = (userId, type, id) => `mnls_playback:${userId}:${type}:${id}`;
export function formatPosition(seconds = 0) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export default function TrainingPlayer({ userId, type = 'lesson', contentId, url, title, saved, onProgress }) {
  const host = useRef(null), callback = useRef(onProgress), initial = useRef(saved);
  const [message, setMessage] = useState('Carregando player…');
  useEffect(() => { callback.current = onProgress; }, [onProgress]);
  useEffect(() => {
    let disposed = false, player, timer, started = false, ready = false;
    const key = playbackKey(userId, type, contentId);
    let record = initial.current;
    try {
      const local = JSON.parse(localStorage.getItem(key));
      if (local?.pending && (!record || new Date(local.updated_at) > new Date(record.updated_at))) record = local;
    } catch { /* Storage may be unavailable; server progress still works. */ }
    let queue = Promise.resolve();
    const persist = (leaving = false) => {
      if (!ready || !started) return;
      const duration = player.getDuration(), position = player.getCurrentTime();
      if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
      const data = { content_type: type, content_id: contentId, position_seconds: Math.min(position, duration), duration_seconds: duration, updated_at: new Date().toISOString() };
      try { localStorage.setItem(key, JSON.stringify({ ...data, pending: true })); } catch { /* Best effort fallback. */ }
      callback.current?.(data);
      const send = async () => {
        try {
          const response = await fetch('/api/user/playback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true });
          if (!response.ok) throw new Error();
          try {
            const latest = JSON.parse(localStorage.getItem(key));
            if (latest?.updated_at === data.updated_at) localStorage.removeItem(key);
          } catch { /* Server saved successfully. */ }
          if (!disposed) setMessage(`Posição salva: ${formatPosition(position)}. Você pode sair e continuar depois.`);
        } catch {
          if (!disposed) setMessage('Sem sincronização. A posição foi mantida neste navegador; tentaremos salvar novamente.');
        }
      };
      if (leaving) void send(); else queue = queue.then(send);
    };
    const hidden = () => { if (document.visibilityState === 'hidden') persist(true); };
    const leaving = () => persist(true);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leaving);
    youtubeApi().then(YT => {
      if (disposed || !host.current) return;
      const mount = document.createElement('div');
      host.current.replaceChildren(mount);
      player = new YT.Player(mount, {
        videoId: getYouTubeVideoId(url),
        playerVars: { origin: window.location.origin, playsinline: 1, rel: 0, start: Math.floor(record?.position_seconds || 0) },
        events: {
          onReady: () => {
            if (disposed) return;
            ready = true;
            player.getIframe().title = title;
            setMessage(record?.position_seconds ? `Continuar de ${formatPosition(record.position_seconds)}. Pressione reproduzir.` : 'Pressione reproduzir para iniciar. Sua posição será salva automaticamente.');
          },
          onStateChange: event => {
            if (disposed) return;
            if (event.data === 1) { started = true; persist(); }
            if (event.data === 2 || event.data === 0) persist();
          },
          onError: () => { if (!disposed) setMessage('O YouTube não conseguiu reproduzir este vídeo. Tente novamente ou avise o administrador.'); },
        },
      });
      timer = setInterval(() => { if (ready && player.getPlayerState() === 1) persist(); }, 5000);
    }).catch(() => { if (!disposed) setMessage('Não foi possível carregar o YouTube. Verifique sua conexão e recarregue a página.'); });
    return () => {
      persist(true); disposed = true; clearInterval(timer);
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leaving);
      player?.destroy?.();
    };
  }, [userId, type, contentId, url, title]);
  return <div className="training-player"><div ref={host} className="video-container" /><p role="status">{message}</p></div>;
}
