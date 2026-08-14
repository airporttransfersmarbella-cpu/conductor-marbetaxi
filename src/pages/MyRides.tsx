import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Clock, Users, Car, Phone, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { DriverCtx } from '../App';

interface Assignment {
  id: string;
  assignment_status: string;
  driver_cost: number;
  reservation: {
    id: string;
    guest_name: string | null;
    guest_phone: string | null;
    pickup_location: string;
    dropoff_location: string;
    pickup_datetime: string;
    return_datetime: string | null;
    pax: number;
    vehicle_type: string;
    flight_number: string | null;
    notes: string | null;
    price_total: number;
    payment_method: string;
    extras: { name: string; price: number; quantity?: number }[] | null;
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pendiente',  cls: 'badge-pending' },
    completed: { label: 'Completado', cls: 'badge-done' },
    invoiced:  { label: 'Facturado',  cls: 'badge-paid' },
    cancelled: { label: 'Cancelado',  cls: 'badge-done' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'badge-done' };
  return <span className={`badge ${cls}`}>{label}</span>;
}

function RideCard({ a }: { a: Assignment }) {
  const [open, setOpen] = useState(false);
  const r = a.reservation;
  const isPast = new Date(r.pickup_datetime) < new Date();

  return (
    <div className="card" style={{ borderLeft: `3px solid ${isPast ? '#374151' : '#6366f1'}` }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isPast ? '#6b7280' : '#6366f1', fontSize: '0.78rem', fontWeight: 600 }}>
          <Clock size={11} /> {fmtDate(r.pickup_datetime)}
        </span>
        <StatusBadge status={a.assignment_status} />
      </div>

      {/* Route */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <MapPin size={13} color="#4ade80" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', lineHeight: 1.3 }}>{r.pickup_location}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <MapPin size={13} color="#f87171" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', lineHeight: 1.3 }}>{r.dropoff_location}</span>
        </div>
      </div>

      {/* Pax & vehicle */}
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={11} /> {r.pax} pax</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Car size={11} /> {r.vehicle_type}</span>
        {r.flight_number && <span>✈ {r.flight_number}</span>}
      </div>

      {/* Expand toggle */}
      <button
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer', padding: 0, marginTop: '0.25rem' }}
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {open ? 'Menos detalles' : 'Ver detalles'}
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
          <hr className="divider" style={{ margin: '0 0 0.5rem' }} />
          {r.guest_name && <p style={{ margin: 0 }}>👤 <strong>Pasajero:</strong> {r.guest_name}</p>}
          {r.guest_phone && (
            <a href={`tel:${r.guest_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa', textDecoration: 'none' }}>
              <Phone size={13} /> {r.guest_phone}
            </a>
          )}
          {r.return_datetime && <p style={{ margin: 0 }}>↩ Vuelta: {fmtDate(r.return_datetime)}</p>}
          {r.notes && <p style={{ margin: 0, color: '#9ca3af', fontStyle: 'italic' }}>📝 {r.notes}</p>}
          {r.extras && r.extras.filter(e => e.name !== '__hide_tolls__').length > 0 && (
            <div>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>Extras:</p>
              {r.extras.filter(e => e.name !== '__hide_tolls__').map((e, i) => (
                <p key={i} style={{ margin: '0 0 0.1rem', color: '#9ca3af' }}>• {e.name} ×{e.quantity ?? 1}</p>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <span>Pago cliente:</span>
            <strong style={{ color: r.payment_method === 'PAO' ? '#4ade80' : '#f59e0b' }}>
              {r.payment_method === 'PAO' ? 'Pagado online' : 'Cobrar en destino'}
            </strong>
          </div>
          {a.driver_cost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tu importe:</span>
              <strong style={{ color: '#4ade80' }}>{a.driver_cost.toFixed(2)} €</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyRides({ driver }: { driver: DriverCtx }) {
  const [upcoming, setUpcoming] = useState<Assignment[]>([]);
  const [past, setPast]         = useState<Assignment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('driver_assignments')
        .select('id,assignment_status,driver_cost,reservation:reservations(id,guest_name,guest_phone,pickup_location,dropoff_location,pickup_datetime,return_datetime,pax,vehicle_type,flight_number,notes,price_total,payment_method,extras)')
        .eq('driver_id', driver.driverId)
        .in('assignment_status', ['pending', 'completed', 'invoiced'])
        .limit(100);
      const all: Assignment[] = (data || []).filter((a: any) => a.reservation);
      setUpcoming(all.filter(a => new Date(a.reservation.pickup_datetime) >= new Date()));
      setPast(all.filter(a => new Date(a.reservation.pickup_datetime) < new Date()));
    } finally {
      setLoading(false);
    }
  }, [driver.driverId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="safe-top safe-bottom page-content">
      <div style={{ padding: '1rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Mis viajes</h1>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '2px 0 0' }}>{upcoming.length} próximos · {past.length} realizados</p>
        </div>
        <button className="btn-ghost" onClick={load} style={{ padding: '0.4rem 0.75rem' }}>
          <RefreshCw size={14} />
        </button>
      </div>
      <hr className="divider" style={{ margin: '0.5rem 1rem' }} />

      {loading && <div className="spinner" />}

      {!loading && (
        <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {upcoming.length === 0 && !showPast && (
            <div className="empty-state">
              <Calendar size={40} />
              <p>No tienes viajes próximos asignados</p>
            </div>
          )}
          {upcoming.map(a => <RideCard key={a.id} a={a} />)}

          {past.length > 0 && (
            <button
              className="btn-ghost"
              onClick={() => setShowPast(v => !v)}
              style={{ marginTop: '0.5rem' }}
            >
              {showPast ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showPast ? 'Ocultar realizados' : `Ver ${past.length} viajes realizados`}
            </button>
          )}

          {showPast && past.map(a => <RideCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}

function Calendar({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
