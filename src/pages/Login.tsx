import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Car, Download } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
    } else {
      window.open('https://conductor.gestcab.com', '_blank');
    }
  }

  async function loginWithGoogle() {
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
    if (err) {
      setError('Error al conectar con Google. Inténtalo de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a30 100%)',
    }}>
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
          boxShadow: '0 8px 40px rgba(99,102,241,0.4)',
        }}>
          <Car size={40} color="white" />
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Marbetaxi</h1>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', margin: '0.3rem 0 0' }}>Portal del Conductor</p>
      </div>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button
          onClick={loginWithGoogle}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            width: '100%', padding: '0.9rem 1.25rem',
            background: 'white', color: '#111', border: 'none', borderRadius: 12,
            fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
            transition: 'opacity 0.15s',
          }}
        >
          {loading
            ? <span className="spinner" style={{ width: 20, height: 20, margin: 0, borderTopColor: '#6366f1' }} />
            : <GoogleIcon />}
          {loading ? 'Conectando...' : 'Iniciar sesión con Google'}
        </button>

        {!installed && (
          <button
            onClick={handleInstall}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              width: '100%', padding: '0.9rem 1.25rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
              border: 'none', borderRadius: 12,
              fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 16px rgba(99,102,241,0.4)',
            }}
          >
            <Download size={20} />
            Instalar App
          </button>
        )}

        {error && <p style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>{error}</p>}
      </div>

      <p style={{ color: '#374151', fontSize: '0.75rem', marginTop: '3rem', textAlign: 'center', maxWidth: 280 }}>
        Acceso exclusivo para conductores registrados en Marbetaxi
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
