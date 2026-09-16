import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Cliente admin: usa a service key. NUNCA importar isto em componente de cliente.
export function db() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function log(
  level: 'info' | 'warn' | 'error',
  source: string,
  message: string,
  payload?: unknown,
) {
  try {
    await db().from('event_log').insert({ level, source, message, payload: payload ?? null })
  } catch {
    // log nunca pode derrubar o fluxo principal
  }
}
