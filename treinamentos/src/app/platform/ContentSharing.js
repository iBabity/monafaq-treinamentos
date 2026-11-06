'use client';
import { useState } from 'react';

export function ReviewStamp({ name }) {
  return <span className="content-review">Revisado por: {name || 'Não informado'}</span>;
}

export function CopyContentLink({ path, disabled = false }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState('');
  async function copy() {
    const url = new URL(path, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { setFallback(url); }
  }
  return <span className="content-share">
    <button type="button" className="btn-ghost" disabled={disabled} onClick={copy} title={disabled ? 'Publique o manual para compartilhar o link' : 'Copiar link direto'}>Copiar link</button>
    <span role="status">{copied ? 'Link copiado' : ''}</span>
    {fallback && <label>Selecione e copie o link<input aria-label="Link direto" readOnly value={fallback} onFocus={event => event.target.select()} /></label>}
  </span>;
}
