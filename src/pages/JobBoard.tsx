import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Clock, Users, Car, RefreshCw, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { DriverCtx } from '../App';

interface Reservation {
  id: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_datetime: string;
  pax: number;
  vehicle_type: string;
  notes: string | null;
  extras: { name: string; price: number; quantity?: number }[] | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const VEHICLE_LABELS: Record<string, string> = {
  sedan: 'Sedán', executive_sedan: 'Sedán Exec.', van: 'Furgoneta',
  executive_minivan: 'Minivan Exec.', special_vito: 'Vito', small_bus: 'Minibús',
  medium_bus: 'Bus Med.', big_bus: 'Bus Grande', other: 'Otro',
};

export default function JobBoard({ driver }: { driver: DriverCtx }) {
  const [rides, setRides]         = useState<Reservation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [done, setDone]           = useState<string[]>([]);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_available_reservations');
      if (!error) setRides(data || []);
    } finally {
      setLoading(false);
    }
  }, [driver.driverId]);

  useEffect(() => { load(); }, [load]);

  async function accept(rideId: string) {
    setAccepting(rideId);
    try {
      const { data, error } = await supabase.rpc('accept_reservation', { p_reservation_id: rideId });
      if (!error && data?.ok) {
        setDone(d => [...d, rideId]);
        setExpanded(null);
        setTimeout(() => load(), 1500);
      }
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="safe-top safe-bottom page-content">
      <div style={{ padding: '1rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Bolsa de trabajo</h1>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '2px 0 0' }}>Viajes disponibles</p>
        </div>
        <button className="btn-ghost" onClick={load} style={{ padding: '0.4rem 0.75rem' }}>
          <RefreshCw size={14} />
        </button>
      </div>
      <hr className="divider" style={{ margin: '0.5rem 1rem' }} />

      {loading && <div className="spinner" />}

      {!loading && rides.length === 0 && (
        <div className="empty-state">
          <Briefcase size={40} />
          <p>No hay viajes disponibles ahora mismo</p>
          <button className="btn-ghost" onClick={load}>Actualizar</button>
        </div>
      )}

      <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {rides.map(r => {
          const accepted  = done.includes(r.id);
          const isOpen    = expanded === r.id;

          return (
            <div key={r.id} className="card card-accent" style={{ opacity: accepted ? 0.5 : 1 }}>

              {/* Compact header — always visible, tap to expand */}
              <button
                onClick={() => setExpanded(isOpen ? null : r.id)}
                style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6366f1', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Clock size={12} /> {fmtDate(r.pickup_datetime)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: '0.8rem' }}>
                    <Users size={12} /> {r.pax} &nbsp;<Car size={12} /> {VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type}
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <MapPin size={14} color="#4ade80" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', lineHeight: 1.3, color: '#e5e7eb' }}>{r.pickup_location}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <MapPin size={14} color="#f87171" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', lineHeight: 1.3, color: '#e5e7eb' }}>{r.dropoff_location}</span>
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isOpen && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#9ca3af' }}>Vehículo</span>
                    <span>{VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#9ca3af' }}>Pasajeros</span>
                    <span>{r.pax} pax</span>
                  </div>

                  {r.extras && r.extras.filter(e => e.name !== '__hide_tolls__').length > 0 && (
                    <div style={{ fontSize: '0.82rem' }}>
                      <span style={{ color: '#9ca3af' }}>Extras: </span>
                      {r.extras.filter(e => e.name !== '__hide_tolls__').map((e, i) => (
                        <span key={i} style={{ color: '#e5e7eb' }}>• {e.name}{e.quantity && e.quantity > 1 ? ` ×${e.quantity}` : ''} </span>
                      ))}
                    </div>
                  )}

                  {r.notes && (
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', padding: '0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                      📝 {r.notes}
                    </div>
                  )}

                  <div style={{ marginTop: '0.25rem' }}>
                    {accepted ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: '0.85rem' }}>
                        <CheckCircle size={16} /> Viaje aceptado
                      </div>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => accept(r.id)}
                        disabled={accepting === r.id}
                        style={{ fontSize: '0.9rem', padding: '0.7rem', width: '100%' }}
                      >
                        {accepting === r.id
                          ? <span className="spinner" style={{ width: 16, height: 16, margin: 0 }} />
                          : 'Aceptar viaje'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Briefcase({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
}
