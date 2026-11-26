import { fnCall } from './supabase';

// Mismo sistema que la web (gestcab.com): mismo teléfono, mismos dispositivos recordados.
const DEVICE_KEY = 'gestcab_mfa_device';

export interface TwoFactorStatus {
  active: boolean;
  exempt: boolean;
  has_phone: boolean;
  phone_masked: string | null;
  required: boolean;
  reason?: 'no_phone' | 'device' | 'country' | 'recovery';
  reset_effective_at: string | null;
}

export type CodePurpose = 'login' | 'enroll';

function getDeviceToken(): string | null {
  try { return localStorage.getItem(DEVICE_KEY); } catch { return null; }
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : '';
  return os ? `App conductor en ${os}` : 'App conductor';
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fnCall<T & { error?: string }>('two-factor', body);
  if (!r.ok) throw new Error(r.data?.error || `Error ${r.status}`);
  return r.data;
}

export const twoFactor = {
  status: () => call<TwoFactorStatus>({ action: 'status', device_token: getDeviceToken() }),
  send: (purpose: CodePurpose, phone?: string) => call<{ ok: true; phone_masked: string }>({ action: 'send', purpose, phone }),
  async verify(code: string, remember: boolean) {
    const r = await call<{ ok: true; device_token?: string | null }>({ action: 'verify', code, remember, device_label: deviceLabel() });
    if (r.device_token) { try { localStorage.setItem(DEVICE_KEY, r.device_token); } catch { } }
    return r;
  },
  lostRequest: () => call<{ ok: true; effective_at: string }>({ action: 'lost_request' }),
  lostWithdraw: () => call({ action: 'lost_withdraw' }),
};

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
