import { useState, useEffect, useCallback } from 'react';
import { dbFetch } from '../lib/supabase';
import { RefreshCw, FileText } from 'lucide-react';
import type { DriverCtx } from '../App';

interface Assignment {
  id: string;
  assignment_status: string;
  driver_cost: number;
  company_commission: number;
  total_amount: number;
  assigned_at: string;
  completed_at: string | null;
  invoiced_at: string | null;
  liquidation_id: string | null;
  reservation: {
    pickup_location: string;
    dropoff_location: string;
    pickup_datetime: string;
    guest_name: string | null;
    price_total: number;
    payment_method: string;
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pendiente',  cls: 'badge-pending' },
    completed: { label: 'Completado', cls: 'badge-assigned' },
    invoiced:  { label: 'Liquidado',  cls: 'badge-paid' },
    cancelled: { label: 'Cancelado',  cls: 'badge-done' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'badge-done' };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function Billing({ driver }: { driver: DriverCtx }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dbFetch(
        `driver_assignments?driver_id=eq.${driver.driverId}` +
        '&assignment_status=in.(pending,completed,invoiced)' +
        '&select=id,assignment_status,driver_cost,company_commission,total_amount,assigned_at,completed_at,invoiced_at,liquidation_id,' +
        'reservation(pickup_location,dropoff_location,pickup_datetime,guest_name,price_total,payment_method)' +
        '&order=assigned_at.desc&limit=200'
      );
      const data: Assignment[] = await res.json();
      setAssignments(data.filter(a => a.reservation));
    } finally {
      setLoading(false);
    }
  }, [driver.driverId]);

  useEffect(() => { load(); }, [load]);

  // Summary stats
  const total        = assignments.reduce((s, a) => s + (a.driver_cost || 0), 0);
  const pending      = assignments.filter(a => a.assignment_status === 'pending').reduce((s, a) => s + (a.driver_cost || 0), 0);
  const paid         = assignments.filter(a => a.assignment_status === 'invoiced').reduce((s, a) => s + (a.driver_cost || 0), 0);
  const countDone    = assignments.filter(a => a.assignment_status !== 'cancelled').length;

  return (
    <div className="safe-top safe-bottom page-content">
      <div style={{ padding: '1rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Facturación</h1>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '2px 0 0' }}>{countDone} trabajos registrados</p>
        </div>
        <button className="btn-ghost" onClick={load} style={{ padding: '0.4rem 0.75rem' }}>
          <RefreshCw size={14} />
        </button>
      </div>
      <hr className="divider" style={{ margin: '0.5rem 1rem' }} />

      {loading && <div className="spinner" />}

      {!loading && (
        <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total generado</p>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#4ade80' }}>{total.toFixed(2)} €</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liquidado</p>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#c084fc' }}>{paid.toFixed(2)} €</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendiente cobro</p>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>{pending.toFixed(2)} €</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trabajos</p>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{countDone}</p>
            </div>
          </div>

          <hr className="divider" />

          {/* List */}
          {assignments.length === 0 && (
            <div className="empty-state">
              <FileText size={40} />
              <p>Sin trabajos registrados todavía</p>
            </div>
          )}

          {assignments.map(a => {
            const isOpen = expanded === a.id;
            const r = a.reservation;
            return (
              <div key={a.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : a.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.82rem', color: '#9ca3af' }}>{fmtDate(r.pickup_datetime)}</p>
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.pickup_location.split(',')[0]} → {r.dropoff_location.split(',')[0]}
                    </p>
                    {r.guest_name && <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>👤 {r.guest_name}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: a.driver_cost > 0 ? '#4ade80' : '#6b7280' }}>
                      {a.driver_cost > 0 ? `${a.driver_cost.toFixed(2)} €` : '—'}
                    </p>
                    <StatusBadge status={a.assignment_status} />
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <hr className="divider" style={{ margin: '0 0 0.5rem' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Precio total viaje</span>
                      <span>{r.price_total.toFixed(2)} €</span>
                    </div>
                    {a.company_commission > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Comisión empresa</span>
                        <span style={{ color: '#f87171' }}>-{a.company_commission.toFixed(2)} €</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Tu importe</span>
                      <span style={{ color: '#4ade80' }}>{a.driver_cost.toFixed(2)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Pago cliente</span>
                      <span style={{ color: r.payment_method === 'PAO' ? '#4ade80' : '#f59e0b' }}>
                        {r.payment_method === 'PAO' ? 'Pagado online' : 'Cobrar en destino'}
                      </span>
                    </div>
                    {a.liquidation_id && (
                      <p style={{ margin: '0.25rem 0 0', color: '#c084fc', fontSize: '0.75rem' }}>
                        ✓ Incluido en liquidación
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
