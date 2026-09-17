/**
 * Segredos internos, sem ninguem precisar inventar e colar na Vercel.
 *
 * Sessao e cron. Cada um sai de um HMAC da chave de servico do Supabase, que a integracao
 * da Vercel ja entrega. Sao estaveis (mesmo valor em toda requisicao) e
 * diferentes entre si. Quem nao tem a chave de servico nao consegue calcular.
 *
 * Uma variavel de ambiente com o nome antigo, se existir, tem prioridade:
 * assim uma instalacao feita do jeito antigo continua funcionando.
 *
 * Funciona no Node e no Edge (middleware): usa so Web Crypto.
 */

type Nome = 'sessao' | 'cron'

const VARIAVEL_ANTIGA: Record<Nome, string> = {
  sessao: 'SESSION_SECRET',
  cron: 'CRON_SECRET',
}

/**
 * Token de verificacao do webhook, igual em toda instalacao e escrito no guia.
 *
 * Ele so serve para a Meta confirmar que o endereco existe, no cadastro do
 * webhook. Nao protege nada: cada aviso que chega e conferido pela assinatura
 * com a chave secreta do app do cliente (validSignature / fbAssinaturaValida).
 */
export const TOKEN_DE_VERIFICACAO = 'autochat'

export function tokenDeVerificacao(canal: 'instagram' | 'facebook'): string {
  const antigo = canal === 'instagram' ? process.env.IG_WEBHOOK_VERIFY_TOKEN : process.env.FB_WEBHOOK_VERIFY_TOKEN
  return antigo || TOKEN_DE_VERIFICACAO
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
