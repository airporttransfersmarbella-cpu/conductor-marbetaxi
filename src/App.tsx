import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './pages/Login';
import JobBoard from './pages/JobBoard';
import MyRides from './pages/MyRides';
import Billing from './pages/Billing';
import Integrations from './pages/Integrations';
import BottomNav from './components/BottomNav';

export type Tab = 'jobboard' | 'myrides' | 'billing' | 'integrations';

export interface DriverCtx {
  driverId: string;
  driverName: string;
  userId: string;
}

export default function App() {
  const [session, setSession]     = useState<Session | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('jobboard');
  const [driver, setDriver]       = useState<DriverCtx | null>(null);
  const [driverError, setDriverError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setDriver(null); setDriverError(''); return; }
    linkDriver();
  }, [session?.user?.id]);

  async function linkDriver() {
    setDriverError('');
    try {
      // Calls SECURITY DEFINER function: finds driver by user_id, or auto-links by email
      const { data, error } = await supabase.rpc('link_my_driver_account');
      if (error) throw error;
      if (data?.error === 'driver_not_found') {
        setDriverError('Tu cuenta de Google no está registrada como conductor. Contacta con el administrador.');
        return;
      }
      if (data?.error) throw new Error(data.error);
      setDriver({ driverId: data.id, driverName: data.name, userId: session!.user.id });
    } catch (e: any) {
      setDriverError('Error al cargar tu perfil. Intenta de nuevo.');
      console.error(e);
    }
  }

  if (loading) return <Spinner />;
  if (!session) return <Login />;
  if (driverError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '2rem', gap: '1rem', textAlign: 'center' }}>
      <p style={{ color: '#f87171', maxWidth: 300 }}>{driverError}</p>
      <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  );
  if (!driver) return <Spinner />;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {tab === 'jobboard'     && <JobBoard driver={driver} />}
      {tab === 'myrides'      && <MyRides driver={driver} />}
      {tab === 'billing'      && <Billing driver={driver} />}
      {tab === 'integrations' && <Integrations driver={driver} />}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="spinner" />
    </div>
  );
}
