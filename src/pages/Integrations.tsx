import { useState, useEffect } from 'react';
import { supabase, dbFetch } from '../lib/supabase';
import { Calendar, Link, Unlink, RefreshCw, CheckCircle, LogOut, User, Trash2 } from 'lucide-react';
import type { DriverCtx } from '../App';

const GOOGLE_CLIENT_ID = '805460437524-6schok0tpra1nh5o59lagjvla01phclp.apps.googleusercontent.com';
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/integrations` : '';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

function getGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: 'driver_calendar',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export default function Integrations({ driver }: { driver: DriverCtx }) {
  const [calendarLinked, setCalendarLinked] = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [syncMsg, setSyncMsg]               = useState('');
  const [email, setEmail]                   = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: userData }) => {
      const userEmail = userData.user?.email || '';
      setEmail(userEmail);
      // Check if google integration exists for this user
      dbFetch(`google_integrations?user_id=eq.${userData.user?.id}&select=is_active`).then(async res => {
        const rows = await res.json();
        if (rows?.[0]?.is_active) setCalendarLinked(true);
      });
    });

    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'driver_calendar') {
      window.history.replaceState({}, '', '/');
      handleOAuthCode(code);
    }
  }, [driver.driverId]);

  async function handleOAuthCode(code: string) {
    setSyncing(true);
    setSyncMsg('Conectando con Google Calendar...');
    try {
      const { data, error } = await supabase.functions.invoke('oauth-google', {
        body: { code, redirect_uri: REDIRECT_URI },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Error al conectar');
      setCalendarLinked(true);
      setSyncMsg('¡Google Calendar conectado!');
    } catch (e: any) {
      setSyncMsg('Error al conectar: ' + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function syncCalendar() {
    setSyncing(true);
    setSyncMsg('Sincronizando viajes...');
    try {
      const { data: rides, error: rErr } = await supabase.rpc('get_my_rides', { p_driver_id: driver.driverId });
      if (rErr) throw new Error(rErr.message);
      if (!rides?.length) { setSyncMsg('No tienes viajes asignados'); return; }
      let synced = 0;
      for (const ride of rides) {
        if (!ride.reservation_id) continue;
        const { error } = await supabase.functions.invoke('calendar-create-event', {
          body: { reservation_id: ride.reservation_id },
        });
        if (!error) synced++;
      }
      setSyncMsg(`${synced} viajes sincronizados con Google Calendar`);
    } catch (e: any) {
      setSyncMsg('Error al sincronizar: ' + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    const { data: userData } = await supabase.auth.getUser();
    await dbFetch(`google_integrations?user_id=eq.${userData.user?.id}`, { method: 'DELETE' });
    setCalendarLinked(false);
    setSyncMsg('Google Calendar desconectado');
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="safe-top safe-bottom page-content">
      <div style={{ padding: '1rem 1rem 0.5rem' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Integraciones</h1>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '2px 0 0' }}>Conecta herramientas externas</p>
      </div>
      <hr className="divider" style={{ margin: '0.5rem 1rem' }} />

      <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Profile info */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#1e1e50', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={20} color="#6366f1" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{driver.driverName}</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</p>
          </div>
          <button className="btn-ghost" onClick={signOut} style={{ padding: '0.4rem 0.6rem', flexShrink: 0 }}>
            <LogOut size={14} />
          </button>
        </div>

        {/* Google Calendar */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1a2a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={20} color="#4ade80" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Google Calendar</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>
                {calendarLinked ? 'Conectado — tus viajes se sincronizan' : 'Sincroniza tus viajes asignados'}
              </p>
            </div>
            {calendarLinked && <CheckCircle size={16} color="#4ade80" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
          </div>

          {calendarLinked ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" onClick={syncCalendar} disabled={syncing} style={{ flex: 1 }}>
                <RefreshCw size={14} /> Sincronizar ahora
              </button>
              <button className="btn-ghost" onClick={disconnect} style={{ flexShrink: 0 }}>
                <Unlink size={14} />
              </button>
            </div>
          ) : (
            <a href={getGoogleAuthUrl()} className="btn-primary" style={{ textDecoration: 'none' }}>
              <Link size={14} /> Conectar Google Calendar
            </a>
          )}

          {syncMsg && (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: syncMsg.includes('Error') ? '#f87171' : '#4ade80', textAlign: 'center' }}>
              {syncMsg}
            </p>
          )}
        </div>

        {/* Clear cache */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trash2 size={20} color="#f87171" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Borrar caché</p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>Fuerza la actualización de la app</p>
          </div>
          <button
            className="btn-ghost"
            style={{ flexShrink: 0, color: '#f87171' }}
            onClick={async () => {
              if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
              }
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
              }
              window.location.reload();
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* App version */}
        <p style={{ textAlign: 'center', color: '#374151', fontSize: '0.72rem', marginTop: '0.5rem' }}>
          Marbetaxi Conductor v1.0 · <a href="https://gestcab.com" style={{ color: '#4b5563' }}>gestcab.com</a>
        </p>
      </div>
    </div>
  );
}
