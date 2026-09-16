function need(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Variavel de ambiente faltando: ${name}`)
  return v
}

/**
 * Configuracao que vem da Vercel.
 *
 * As do Supabase sao criadas pela integracao Vercel + Supabase, com os nomes
 * dela. Os nomes antigos continuam valendo para instalacao feita a mao.
 * Senhas internas (sessao, cron, tokens de webhook) nao ficam aqui: ver
 * lib/segredos.ts.
 */
export const env = {
  supabaseUrl: () =>
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || need('SUPABASE_URL'),
  supabaseServiceKey: () =>
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || need('SUPABASE_SERVICE_ROLE_KEY'),
  /** Conexao direta ao Postgres, so para criar o banco na configuracao. */
  postgresUrl: () =>
    process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || need('POSTGRES_URL'),
  igAppId: () => need('IG_APP_ID'),
  igAppSecret: () => need('IG_APP_SECRET'),
  baseUrl: () =>
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000'),
  maxSendsPerHour: () => Number(process.env.MAX_SENDS_PER_HOUR || 40),
}

/** O Supabase ja foi ligado na Vercel? Sem isto nada funciona. */
export function supabaseConectado(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY) &&
    (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL),
  )
}
