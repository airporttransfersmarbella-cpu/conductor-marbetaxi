import { useState, useEffect } from 'react';
import { supabase, dbFetch } from '../lib/supabase';
import { Calendar, Link, Unlink, RefreshCw, CheckCircle, LogOut, User } from 'lucide-react';
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
    // Check if google tokens exist for this driver
    dbFetch(`app_settings?key=eq.driver_google_tokens_${driver.driverId}&select=value`).then(async res => {
      const rows = await res.json();
      if (rows?.[0]?.value?.access_token) setCalendarLinked(true);
    });

    // Get user email
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || '');
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
        body: { code, redirect_uri: REDIRECT_URI, driver_id: driver.driverId },
      });
      if (error || !data?.access_token) throw new Error('Error al conectar');
      // Store tokens for driver
      await dbFetch(`app_settings?key=eq.driver_google_tokens_${driver.driverId}`, {
        method: 'DELETE',
      });
      await dbFetch('app_settings', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          key: `driver_google_tokens_${driver.driverId}`,
          value: data,
          description: `Google Calendar tokens for driver ${driver.driverId}`,
        }),
      });
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
      const res = await dbFetch(
        `driver_assignments?driver_id=eq.${driver.driverId}&assignment_status=eq.pending` +
        '&select=reservation(id,pickup_datetime,dropoff_datetime,pickup_location,dropoff_location,pax,guest_name)&limit=50'
      );
      const assignments = await res.json();
      let synced = 0;
      for (const a of assignments) {
        if (!a.reservation) continue;
        const r = a.reservation;
        await supabase.functions.invoke('calendar-create-event', {
          body: {
            driver_id: driver.driverId,
            title: `Viaje: ${r.pickup_location.split(',')[0]} → ${r.dropoff_location?.split(',')[0] || ''}`,
            start: r.pickup_datetime,
            end: r.pickup_datetime, // fallback
            description: `Pasajero: ${r.guest_name || '—'}\nRecogida: ${r.pickup_location}\nDestino: ${r.dropoff_location}`,
          },
        });
        synced++;
      }
      setSyncMsg(`${synced} viajes sincronizados con Google Calendar`);
    } catch (e: any) {
      setSyncMsg('Error al sincronizar: ' + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    await dbFetch(`app_settings?key=eq.driver_google_tokens_${driver.driverId}`, { method: 'DELETE' });
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

        {/* App version */}
        <p style={{ textAlign: 'center', color: '#374151', fontSize: '0.72rem', marginTop: '1rem' }}>
          Marbetaxi Conductor v1.0 · <a href="https://gestcab.com" style={{ color: '#4b5563' }}>gestcab.com</a>
        </p>
      </div>
    </div>
  );
}
