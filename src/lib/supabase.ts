import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabase.gestcab.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1MzY2Nzk2LCJleHAiOjIxMTA3MjY3OTZ9.F0EZ019vvJGwNS-oI4_OLird77TJ4S25OInME1kGRKQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, flowType: 'pkce' },
});

let lastKnownToken: string | null = null;
supabase.auth.onAuthStateChange((_e, session) => {
  lastKnownToken = session?.access_token ?? null;
});

function getToken(): string {
  if (lastKnownToken) return lastKnownToken;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '');
        if (parsed.access_token) return parsed.access_token;
      } catch {}
    }
  }
  return SUPABASE_ANON_KEY;
}

export async function dbFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
}
