import { useState, useEffect, useCallback } from 'react';
import { supabase, dbFetch } from '../lib/supabase';
import { MapPin, Clock, Users, Car, RefreshCw, CheckCircle } from 'lucide-react';
import type { DriverCtx } from '../App';

interface Reservation {
  id: string;
  guest_name: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_datetime: string;
  pax: number;
  vehicle_type: string;
  price_total: number;
  notes: string | null;
  status: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function VehicleLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    sedan: 'Sedán', executive_sedan: 'Sedán Exec.', van: 'Furgoneta',
    executive_minivan: 'Minivan Exec.', special_vito: 'Vito', small_bus: 'Minibús',
    medium_bus: 'Bus Med.', big_bus: 'Bus Grande', other: 'Otro',
  };
  return <span>{labels[type] || type}</span>;
}

export default function JobBoard({ driver }: { driver: DriverCtx }) {
  const [rides, setRides]       = useState<Reservation[]>([]);
  const [loading, setLoading]   = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [done, setDone]         = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_available_reservations');
      if (error) {
        console.error('RPC error:', error);
        setRides([{ id: 'err', guest_name: `Error: ${error.message}`, pickup_location: '', dropoff_location: '', pickup_datetime: '', pax: 0, vehicle_type: '', price_total: 0, notes: null, status: '' } as any]);
      } else {
        setRides(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [driver.driverId]);

  useEffect(() => { load(); }, [load]);

  async function accept(rideId: string) {
    setAccepting(rideId);
    try {
      const res = await dbFetch('driver_assignments', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          reservation_id: rideId,
          driver_id: driver.driverId,
          assignment_status: 'pending',
          total_amount: 0,
          driver_cost: 0,
          company_commission: 0,
          locked: false,
        }),
      });
      if (res.ok) {
        // Also update reservation status to assigned
        await dbFetch(`reservations?id=eq.${rideId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'assigned' }),
        });
        setDone(d => [...d, rideId]);
        setTimeout(() => load(), 1500);
      }
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="safe-top safe-bottom page-content">
      {/* Header */}
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
          const accepted = done.includes(r.id);
          return (
            <div key={r.id} className="card card-accent" style={{ opacity: accepted ? 0.5 : 1 }}>
              {/* Date & pax */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6366f1', fontSize: '0.8rem', fontWeight: 600 }}>
                  <Clock size={12} /> {fmtDate(r.pickup_datetime)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#9ca3af', fontSize: '0.8rem' }}>
                  <Users size={12} /> {r.pax} pax &nbsp;<Car size={12} />&nbsp;<VehicleLabel type={r.vehicle_type} />
                </span>
              </div>

              {/* Route */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <MapPin size={14} color="#4ade80" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', lineHeight: 1.3 }}>{r.pickup_location}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <MapPin size={14} color="#f87171" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', lineHeight: 1.3 }}>{r.dropoff_location}</span>
                </div>
              </div>

              {r.notes && (
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 0.75rem', fontStyle: 'italic' }}>{r.notes}</p>
              )}

              {/* Accept button */}
              {accepted ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: '0.85rem' }}>
                  <CheckCircle size={16} /> Viaje aceptado
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => accept(r.id)}
                  disabled={accepting === r.id}
                  style={{ fontSize: '0.85rem', padding: '0.6rem' }}
                >
                  {accepting === r.id
                    ? <span className="spinner" style={{ width: 16, height: 16, margin: 0 }} />
                    : 'Aceptar viaje'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Fix missing import
function Briefcase({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
}
