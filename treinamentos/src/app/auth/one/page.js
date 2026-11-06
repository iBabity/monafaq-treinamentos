"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OneAuthPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Entrando com sua sessao do One...');

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const handoff = params.get('handoff');
        window.history.replaceState(null, '', '/auth/one');

        if (!handoff) {
          setMessage('Sessao do Portal nao encontrada. Entre novamente.');
          setTimeout(() => router.replace('/login'), 1200);
          return;
        }

        const response = await fetch('/api/one/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handoff }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Nao foi possivel entrar pelo One.');
        }

        localStorage.setItem(
          'mnls_session',
          JSON.stringify({ userId: data.id, role: data.role, name: data.name, email: data.email })
        );
        router.replace('/platform');
      } catch (error) {
        setMessage(error.message || 'Nao foi possivel entrar pelo One.');
        setTimeout(() => router.replace('/login'), 1800);
      }
    };

    run();
  }, [router]);

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
          <h2 className="login-title">Validando acesso</h2>
          <p className="login-desc">{message}</p>
        </div>
      </div>
    </section>
  );
}
