import { useEffect, useState, type ReactNode } from 'react';
import { Car, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { twoFactor, fmtDateTime, type TwoFactorStatus } from '../lib/twoFactor';

const RESEND_SECONDS = 60;

const muted: React.CSSProperties = { color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1rem' };
const errBox: React.CSSProperties = { background: '#3a1a1f', color: '#fca5a5', borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.85rem', marginBottom: '1rem' };
const link: React.CSSProperties = { background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.85rem', padding: 0 };

const REASON_TEXT: Record<string, string> = {
  no_phone: 'Para proteger tu cuenta, añade tu móvil. Te enviaremos un código por WhatsApp. Es el mismo teléfono que usas en gestcab.com.',
  device: 'Es la primera vez que entras desde este móvil, o hace más de 90 días que no lo usas.',
  country: 'Estás entrando desde un país distinto del habitual.',
  recovery: 'Has entrado con el enlace de recuperar la contraseña.',
};

export default function TwoFactorGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [phone, setPhone] = useState('+34 ');
  const [masked, setMasked] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    // Si la comprobación falla se deja pasar: la base de datos sigue bloqueando sin sesión verificada.
    twoFactor.status()
      .then(s => { setStatus(s); setMasked(s.phone_masked); })
      .catch(() => setStatus(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (checking) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}><div className="spinner" /></div>;
  if (!status?.required) return <>{children}</>;

  const needsPhone = status.reason === 'no_phone';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const send = () => run(async () => {
    const r = await twoFactor.send(needsPhone ? 'enroll' : 'login', needsPhone ? phone : undefined);
    setMasked(r.phone_masked); setSent(true); setCode(''); setWait(RESEND_SECONDS);
  });

  const verify = () => run(async () => {
    await twoFactor.verify(code, remember);
    window.location.reload();
  });

  const lost = () => run(async () => {
    if (!confirm('Pediremos quitar tu teléfono de verificación. Se quitará dentro de 3 días y avisaremos por correo y al número antiguo por si no has sido tú. ¿Seguir?')) return;
    const r = await twoFactor.lostRequest();
    setStatus({ ...status, reset_effective_at: r.effective_at });
  });

  const withdraw = () => run(async () => {
    await twoFactor.lostWithdraw();
    setStatus({ ...status, reset_effective_at: null });
  });

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1.5rem', background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a30 100%)' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <Car size={30} color="white" />
        </div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Verificación por WhatsApp</h1>
      </div>

      <p style={muted}>{REASON_TEXT[status.reason || 'device']}</p>

      {!sent && needsPhone && (
        <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel"
          placeholder="+34 600 000 000" style={{ marginBottom: '1rem' }} disabled={busy} />
      )}
      {!sent && !needsPhone && <p style={muted}>Te enviaremos un código al <strong style={{ color: '#f1f5f9', whiteSpace: 'nowrap' }}>{masked}</strong>.</p>}

      {sent && (
        <>
          <p style={muted}>Te hemos enviado un código por WhatsApp al <strong style={{ color: '#f1f5f9', whiteSpace: 'nowrap' }}>{masked}</strong>. Caduca en 10 minutos.</p>
          <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy}
            style={{ fontSize: '1.5rem', letterSpacing: '0.4em', textAlign: 'center', marginBottom: '1rem' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            Recordar este móvil 90 días
          </label>
        </>
      )}

      {error && <div style={errBox}>{error}</div>}

      {sent ? (
        <>
          <button className="btn-primary" onClick={verify} disabled={busy || code.length !== 6}>{busy ? '…' : 'Verificar'}</button>
          <button style={{ ...link, marginTop: '1rem', color: wait > 0 ? '#64748b' : '#818cf8' }} onClick={send} disabled={busy || wait > 0}>
            {wait > 0 ? `Reenviar código en ${wait} s` : 'Reenviar código'}
          </button>
        </>
      ) : (
        <button className="btn-primary" onClick={send} disabled={busy}><MessageCircle size={18} /> {busy ? '…' : 'Enviar código por WhatsApp'}</button>
      )}

      {!needsPhone && (status.reset_effective_at ? (
        <div style={{ ...errBox, background: '#3a2e12', color: '#fcd34d', marginTop: '1rem' }}>
          Has pedido quitar este teléfono. El <strong>{fmtDateTime(status.reset_effective_at)}</strong> podrás poner el número nuevo.
          Si necesitas entrar antes, ponte en contacto con la oficina.{' '}
          <button style={link} onClick={withdraw} disabled={busy}>Cancelar la solicitud</button>
        </div>
      ) : (
        <button style={{ ...link, marginTop: '1rem' }} onClick={lost} disabled={busy}>He perdido este teléfono</button>
      ))}

      <button className="btn-ghost" style={{ marginTop: '2rem' }} onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  );
}
