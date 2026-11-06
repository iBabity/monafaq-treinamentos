"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trainingReturnPath } from '@/utils/trainingLinks';

export default function LoginPage() {
  const router = useRouter();
  const [theme, setTheme] = useState(() => (typeof window === 'undefined' ? 'light' : localStorage.getItem('mnls_theme') || 'light'));
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = (e) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    
    if (!document.startViewTransition) {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('mnls_theme', nextTheme);
      return;
    }

    const x = e?.clientX ?? window.innerWidth / 2;
    const y = e?.clientY ?? window.innerHeight / 2;
    document.documentElement.style.setProperty('--x', `${x}px`);
    document.documentElement.style.setProperty('--y', `${y}px`);

    document.documentElement.classList.add('theme-transitioning');
    
    const transition = document.startViewTransition(() => {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('mnls_theme', nextTheme);
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove('theme-transitioning');
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas.');
        return;
      }
      localStorage.setItem('mnls_session', JSON.stringify({ userId: data.id, role: data.role, name: data.name, email: data.email }));
      router.push(trainingReturnPath(new URLSearchParams(window.location.search).get('next')));
    } catch (err) {
      setError('Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="page-login" className="page active">
      <div className="login-bg">
        <div className="brush-stroke bs-1"></div>
        <div className="brush-stroke bs-2"></div>
        <div className="brush-stroke bs-3"></div>
      </div>
      <div className="login-container">
        <div className="login-brand">
          <div className="brand-logo">
            <img src="/static/uploads/logos/logo.png" alt="Monalisa Logo" />
          </div>
          <h1 className="brand-name">Monalisa</h1>
          <p className="brand-subtitle">Treinamentos</p>
        </div>
        
        <div className="login-card">
          <Link href="/" className="login-back-btn" aria-label="Voltar ao início">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </Link>
          <h2 className="login-title">Bem-vindo(a)</h2>
          <p className="login-desc">Acesse sua plataforma de capacitação ERP</p>
          
          <form id="login-form" noValidate onSubmit={handleLogin}>
            <div className="field-group">
              <label htmlFor="login-email">E-mail</label>
              <input 
                id="login-email" 
                type="email" 
                placeholder="seu@email.com" 
                autoComplete="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="login-password">Senha</label>
              <div className="password-wrap">
                <input 
                  id="login-password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  autoComplete="current-password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button" 
                  id="toggle-password" 
                  aria-label="Mostrar senha"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg className="eye-icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            
            {error && <p id="login-error" className="login-error">{error}</p>}
            
            <button type="submit" className="btn-primary btn-block" id="btn-login" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <div className="login-theme-toggle">
          <button 
            className="icon-btn landing-icon-btn" 
            id="login-theme-toggle" 
            aria-label="Alternar tema"
            onClick={toggleTheme}
          >
            <span className="theme-toggle-icon">
              <svg className="sun-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <svg className="moon-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
