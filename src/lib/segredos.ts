/**
 * Segredos internos, sem ninguem precisar inventar e colar na Vercel.
 *
 * Cada um sai de um HMAC da chave de servico do Supabase, que a integracao
 * da Vercel ja entrega. Sao estaveis (mesmo valor em toda requisicao) e
 * diferentes entre si. Quem nao tem a chave de servico nao consegue calcular.
 *
 * Uma variavel de ambiente com o nome antigo, se existir, tem prioridade:
 * assim uma instalacao feita do jeito antigo continua funcionando.
 *
 * Funciona no Node e no Edge (middleware): usa so Web Crypto.
 */

type Nome = 'sessao' | 'cron' | 'webhook-instagram' | 'webhook-facebook'

const VARIAVEL_ANTIGA: Record<Nome, string> = {
  sessao: 'SESSION_SECRET',
  cron: 'CRON_SECRET',
  'webhook-instagram': 'IG_WEBHOOK_VERIFY_TOKEN',
  'webhook-facebook': 'FB_WEBHOOK_VERIFY_TOKEN',
}

export function chaveDeServico(): string {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!v) throw new Error('Supabase nao conectado: falta SUPABASE_SERVICE_ROLE_KEY')
  return v
}

const cache = new Map<Nome, string>()

export async function segredo(nome: Nome): Promise<string> {
  const antigo = process.env[VARIAVEL_ANTIGA[nome]]
  if (antigo) return antigo

  const pronto = cache.get(nome)
  if (pronto) return pronto

  const enc = new TextEncoder()
  const chave = await crypto.subtle.importKey(
    'raw', enc.encode(chaveDeServico()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', chave, enc.encode(`autochat:${nome}`)))
  const hex = Array.from(assinatura, b => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
  cache.set(nome, hex)
  return hex
}

/** Chamada das tarefas agendadas: cabecalho Bearer ou ?secret=. */
export async function cronAutorizado(req: Request): Promise<boolean> {
  const s = await segredo('cron')
  return req.headers.get('authorization') === `Bearer ${s}` ||
    new URL(req.url).searchParams.get('secret') === s
}
