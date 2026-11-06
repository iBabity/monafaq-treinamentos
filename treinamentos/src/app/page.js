"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('mnls_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

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

  return (
    <>
      <div className="landing-bg">
        <div className="lbg-blob lb1"></div>
        <div className="lbg-blob lb2"></div>
        <div className="lbg-blob lb3"></div>
      </div>

      {/* Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-brand">
          <div className="brand-logo-sm">
            <img src="/static/uploads/logos/logo.png" alt="Monalisa Logo" />
          </div>
          <span className="landing-nav-name">Monalisa <em>Treinamentos</em></span>
        </div>
        <div className="landing-nav-right">
          <button 
            className="icon-btn landing-icon-btn" 
            onClick={toggleTheme} 
            aria-label="Alternar tema"
          >
            <span className="theme-toggle-icon">
              <svg className="sun-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <svg className="moon-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </span>
          </button>
          <Link href="/login" className="btn-primary">Acessar Plataforma</Link>
        </div>
      </header>

      {/* Hero */}
      <div className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">🎓 Plataforma de Capacitação ERP</div>
          <h1 className="hero-title">Domine o ERP<br/><span className="hero-accent">no seu ritmo</span></h1>
          <p className="hero-desc">Treinamentos estruturados por módulos para capacitar sua equipe na utilização completa do sistema. Do básico ao avançado, com acompanhamento de progresso em tempo real.</p>
          <div className="hero-ctas">
            <Link href="/login" className="btn-primary btn-lg">Começar agora</Link>
            <div className="hero-stat-pills">
              <div className="hsp"><strong>12+</strong><span>Aulas</span></div>
              <div className="hsp-sep"></div>
              <div className="hsp"><strong>5</strong><span>Módulos</span></div>
              <div className="hsp-sep"></div>
              <div className="hsp"><strong>100%</strong><span>Online</span></div>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card">
            <div className="hcard-header">
              <div className="hcard-dots"><span></span><span></span><span></span></div>
              <span className="hcard-title">Monalisa ERP</span>
            </div>
            <div className="hcard-modules">
              <div className="hmod active-mod"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Fiscal<span className="hmod-check">✓</span></div>
              <div className="hmod"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Estoque</div>
              <div className="hmod"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Financeiro</div>
              <div className="hmod"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> RH</div>
              <div className="hmod"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Segurança</div>
            </div>
            <div className="hcp-label"><span>Progresso Fiscal</span><strong>67%</strong></div>
            <div className="hcp-bar"><div className="hcp-fill" style={{width: '67%'}}></div></div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="landing-features">
        <div className="feat-card">
          <div className="feat-icon"><svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>
          <h3>Aulas em Vídeo</h3>
          <p>Conteúdo em vídeo organizado por módulo do ERP, com player integrado e controle de progresso.</p>
        </div>
        <div className="feat-card">
          <div className="feat-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <h3>Acompanhe seu Progresso</h3>
          <p>Marque aulas como concluídas e veja sua evolução em tempo real com barra de progresso por módulo.</p>
        </div>
        <div className="feat-card">
          <div className="feat-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
          <h3>Painel Administrativo</h3>
          <p>Gestão completa de conteúdo, usuários e acompanhamento de engajamento via dashboard analítico.</p>
        </div>
      </div>
    </>
  );
}
