import { useState, useEffect, useRef, useMemo } from 'react';

export default function ProfileModal({ user, showToast, refreshUser, onClose }) {
  const [displayName, setDisplayName] = useState(user?.display_name || user?.name || '');
  const [password, setPassword] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const isOneManaged = user?.auth_source === 'one' || Boolean(user?.one_user_id);

  // Fetch progress percentage on mount
  useEffect(() => {
    if (!user?.id) return;
    const trackId = user.track_id || 'track_padrao';
    fetch(`/api/user/track-progress?user_id=${user.id}&track_id=${encodeURIComponent(trackId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setProgressPct(data.progresso_geral ?? 0);
        }
      })
      .catch((err) => console.error('Error fetching progress:', err));
  }, [user?.id, user?.track_id]);

  // Handle local file preview for instantaneous UX feedback
  const avatarUrl = useMemo(() => {
    if (previewUrl) return previewUrl;
    return user?.profile_picture || null;
  }, [previewUrl, user?.profile_picture]);

  // Cleanup local blob URL to avoid leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (saving) return;

    if (!displayName.trim()) {
      showToast('Nome não pode estar vazio.', 'orange');
      return;
    }

    if (!isOneManaged && password && password.length < 4) {
      showToast('A senha deve ter pelo menos 4 caracteres.', 'orange');
      return;
    }

    setSaving(true);
    try {
      // 1. Save display name if changed
      const originalName = user?.display_name || user?.name || '';
      if (displayName.trim() !== originalName) {
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, display_name: displayName.trim() })
        });
        if (!res.ok) {
          throw new Error('Erro ao atualizar nome.');
        }
      }

      // 2. Upload avatar photo if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('user_id', user.id);
        const res = await fetch('/api/user/upload', {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          throw new Error('Erro ao enviar foto de perfil.');
        }
      }

      // 3. Update password if filled
      if (!isOneManaged && password) {
        const res = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, new_password: password })
        });
        if (!res.ok) {
          throw new Error('Erro ao atualizar senha.');
        }
      }

      showToast('Perfil atualizado com sucesso!', 'success');
      refreshUser();
      onClose();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Erro ao atualizar dados.', 'orange');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-modal-backdrop" onClick={(e) => { if (e.target.className === 'profile-modal-backdrop') onClose(); }}>
      <div className="profile-modal-card">
        {/* Header */}
        <div className="profile-modal-header">
          <h3 className="profile-modal-title">Editar Usuário</h3>
          <button className="profile-modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="profile-modal-body">
          <div className="profile-modal-grid">
            {/* Column 1: Profile Image Pick */}
            <div className="profile-avatar-wrapper" onClick={() => fileInputRef.current?.click()} title="Clique para alterar a foto">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="profile-avatar-overlay">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span>Alterar Foto</span>
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />

            {/* Column 2: Form Inputs */}
            <div className="profile-modal-fields">
              <div className="profile-field-group">
                <label>Nome</label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  className="profile-input" 
                  placeholder="Nome completo"
                />
              </div>

              <div className="profile-field-group">
                <label>E-mail</label>
                <input 
                  type="email" 
                  value={user?.email || ''} 
                  disabled 
                  readOnly
                  className="profile-input" 
                  title="O e-mail não pode ser alterado"
                />
              </div>

              {!isOneManaged && (
                <div className="profile-field-group">
                  <label>Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="profile-input"
                    placeholder="Nova senha (deixe em branco para manter)"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="profile-modal-divider"></div>

          {/* Progress bar section */}
          {user?.role !== 'admin' && (
            <div className="profile-progress-section">
              <span className="profile-progress-label">Progresso Atual</span>
              <div className="profile-progress-track">
                <div className="profile-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
                <span className="profile-progress-text">{Math.round(progressPct)}% concluído</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="profile-modal-footer">
          <button className="profile-btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="profile-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
