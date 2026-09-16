import { env } from './env'

/**
 * Facebook (Pagina + Messenger).
 *
 * Fica separado de ig.ts de proposito: sao dois apps diferentes na Meta, com
 * ID e segredo proprios. O Instagram usa o app "Autochat-IG" (IG_APP_ID); a
 * Pagina usa o app Meta "Autochat" (FB_APP_ID), do tipo Empresa, que exige
 * login pela configuracao de Login do Facebook para Empresas (FB_LOGIN_CONFIG_ID).
 */

export const FB_GRAPH = 'https://graph.facebook.com/v26.0'

/** Campos da Pagina que o webhook recebe. */
export const FB_CAMPOS_WEBHOOK = 'feed,messages,messaging_postbacks'

const need = (nome: string) => {
  const v = process.env[nome]
  if (!v) throw new Error(`Variavel de ambiente faltando: ${nome}`)
  return v
}

export const fbEnv = {
  appId: () => need('FB_APP_ID'),
  appSecret: () => need('FB_APP_SECRET'),
  loginConfigId: () => need('FB_LOGIN_CONFIG_ID'),
  redirectUri: () => `${env.baseUrl()}/api/oauth/facebook/callback`,
}

async function graph<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${FB_GRAPH}/${caminho}`, init)
  const j = await r.json()
  if (!r.ok || j?.error) throw new Error(`facebook ${caminho.split('?')[0]}: ${JSON.stringify(j?.error ?? j)}`)
  return j as T
}

// ---------- Login ----------

export function fbAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: fbEnv.appId(),
    redirect_uri: fbEnv.redirectUri(),
    config_id: fbEnv.loginConfigId(),
    response_type: 'code',
    override_default_response_type: 'true',
    state,
  })
  return `https://www.facebook.com/v26.0/dialog/oauth?${p}`
}

/** Codigo do login -> token de usuario curto -> token de usuario longo (60 dias). */
export async function fbTokenDeUsuario(code: string): Promise<string> {
  const base = { client_id: fbEnv.appId(), client_secret: fbEnv.appSecret() }
  const curto = await graph<{ access_token: string }>(
    `oauth/access_token?${new URLSearchParams({ ...base, redirect_uri: fbEnv.redirectUri(), code })}`,
  )
  const longo = await graph<{ access_token: string }>(
    `oauth/access_token?${new URLSearchParams({
      ...base, grant_type: 'fb_exchange_token', fb_exchange_token: curto.access_token,
    })}`,
  )
  return longo.access_token
}

/**
 * Paginas que a pessoa liberou no login.
 *
 * `me/accounts` volta vazio quando a Pagina e de um portfolio empresarial
 * (foi o caso da Inteligencia Artificial). O `debug_token` sempre lista as
 * Paginas concedidas em `granular_scopes`, entao ele e a fonte principal.
 */
export async function fbPaginasConcedidas(userToken: string): Promise<string[]> {
  const appToken = `${fbEnv.appId()}|${fbEnv.appSecret()}`
  const dbg = await graph<{ data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>(
    `debug_token?${new URLSearchParams({ input_token: userToken, access_token: appToken })}`,
  )
  const ids = dbg.data?.granular_scopes?.find(s => s.scope === 'pages_messaging')?.target_ids ?? []
  if (ids.length) return ids

  const contas = await graph<{ data: { id: string }[] }>(
    `me/accounts?${new URLSearchParams({ fields: 'id', access_token: userToken })}`,
  )
  return contas.data.map(c => c.id)
}

/** Token da Pagina. Vindo de um token de usuario longo, ele nao vence. */
export async function fbDadosDaPagina(pageId: string, userToken: string) {
  return graph<{ id: string; name: string; access_token: string }>(
    `${pageId}?${new URLSearchParams({ fields: 'id,name,access_token', access_token: userToken })}`,
  )
}

export async function fbAssinarPagina(pageId: string, pageToken: string) {
  return graph<{ success: boolean }>(
    `${pageId}/subscribed_apps?${new URLSearchParams({ subscribed_fields: FB_CAMPOS_WEBHOOK })}`,
    { method: 'POST', headers: { Authorization: `Bearer ${pageToken}` } },
  )
}

/**
 * Quem comentou e uma Pagina? A Meta nao deixa responder Pagina no Messenger
 * (erro 1893062). So Pagina tem `category`; perfil de pessoa devolve erro.
 * Na duvida (falha de rede), trata como pessoa: o envio decide.
 */
export async function fbEhPagina(id: string, token: string): Promise<boolean> {
  try {
    const r = await graph<{ category?: string }>(
      `${id}?${new URLSearchParams({ fields: 'category', access_token: token })}`,
    )
    return Boolean(r.category)
  } catch {
    return false
  }
}

/** Erro da Meta que nao adianta repetir: comentario feito por uma Pagina. */
export const fbErroDePagina = (erro: string) => erro.includes('1893062')

// ---------- Envio (Messenger) ----------

type Btn = Array<
  | { type: 'web_url'; title: string; url: string }
  | { type: 'postback'; title: string; payload: string }
>

function mensagem(texto: string, botoes?: Btn) {
  if (!botoes?.length) return { text: texto.slice(0, 2000) }
  return {
    attachment: {
      type: 'template',
      payload: { template_type: 'button', text: texto.slice(0, 640), buttons: botoes.slice(0, 3) },
    },
  }
}

async function enviar(pageId: string, token: string, corpo: Record<string, unknown>) {
  return graph<{ message_id: string; recipient_id: string }>(`${pageId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  })
}

/** Resposta privada ao comentario: abre a conversa no Messenger (uma por comentario). */
export function fbRespostaPrivada(pageId: string, token: string, commentId: string, texto: string, botoes?: Btn) {
  return enviar(pageId, token, { recipient: { comment_id: commentId }, message: mensagem(texto, botoes) })
}

/** Mensagem na conversa (janela de 24h depois de a pessoa falar com a Pagina). */
export function fbMensagem(pageId: string, token: string, psid: string, texto: string, botoes?: Btn) {
  return enviar(pageId, token, {
    recipient: { id: psid }, messaging_type: 'RESPONSE', message: mensagem(texto, botoes),
  })
}

export function fbAudio(pageId: string, token: string, psid: string, url: string) {
  return enviar(pageId, token, {
    recipient: { id: psid },
    messaging_type: 'RESPONSE',
    message: { attachment: { type: 'audio', payload: { url, is_reusable: false } } },
  })
}

/** Resposta publica embaixo do comentario. */
export function fbResponderComentario(commentId: string, token: string, texto: string) {
  return graph<{ id: string }>(`${commentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: texto }),
  })
}

// ---------- Assinatura do webhook ----------

/** Avisos da Pagina sao assinados com o segredo do app Meta, nao o do Instagram. */
export async function fbAssinaturaValida(raw: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(fbEnv.appSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
  const esperado = header.slice(7)
  if (hex.length !== esperado.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ esperado.charCodeAt(i)
  return diff === 0
}
