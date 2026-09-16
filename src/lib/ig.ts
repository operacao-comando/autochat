import { env } from './env'
import { chave } from './meta-chaves'

export const IG_GRAPH = 'https://graph.instagram.com/v25.0'
export const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
].join(',')

// ---------- OAuth ----------

export async function authorizeUrl(state: string): Promise<string> {
  const p = new URLSearchParams({
    client_id: await chave('igAppId'),
    redirect_uri: `${env.baseUrl()}/api/oauth/instagram/callback`,
    response_type: 'code',
    scope: IG_SCOPES,
    state,
  })
  return `https://www.instagram.com/oauth/authorize?${p}`
}

export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: await chave('igAppId'),
    client_secret: await chave('igAppSecret'),
    grant_type: 'authorization_code',
    redirect_uri: `${env.baseUrl()}/api/oauth/instagram/callback`,
    code,
  })
  const r = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body })
  const j = await r.json()
  if (!r.ok) throw new Error(`troca de code falhou: ${JSON.stringify(j)}`)
  return j as { access_token: string; user_id: string | number; permissions?: string[] }
}

/** Troca o token curto (1h) por um longo (60 dias). */
export async function toLongLived(shortToken: string) {
  const p = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: await chave('igAppSecret'),
    access_token: shortToken,
  })
  const r = await fetch(`${IG_GRAPH}/access_token?${p}`)
  const j = await r.json()
  if (!r.ok) throw new Error(`token longo falhou: ${JSON.stringify(j)}`)
  return j as { access_token: string; token_type: string; expires_in: number }
}

/** Renova o token longo (usar antes dos 60 dias). */
export async function refreshLongLived(token: string) {
  const p = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })
  const r = await fetch(`${IG_GRAPH}/refresh_access_token?${p}`)
  const j = await r.json()
  if (!r.ok) throw new Error(`refresh falhou: ${JSON.stringify(j)}`)
  return j as { access_token: string; expires_in: number }
}

export async function me(token: string) {
  const p = new URLSearchParams({ fields: 'user_id,username,name', access_token: token })
  const r = await fetch(`${IG_GRAPH}/me?${p}`)
  const j = await r.json()
  if (!r.ok) throw new Error(`me falhou: ${JSON.stringify(j)}`)
  return j as { user_id: string; username: string; name?: string }
}

/**
 * Total de seguidores da conta conectada, agora.
 *
 * A API do Instagram nao guarda historico: so responde o numero de hoje.
 * Por isso o dashboard tira uma leitura por dia e monta a curva a partir
 * dai -- o passado anterior a instalacao nao existe em lugar nenhum.
 */
export async function seguidores(token: string): Promise<number | null> {
  try {
    const p = new URLSearchParams({ fields: 'followers_count', access_token: token })
    const r = await fetch(`${IG_GRAPH}/me?${p}`)
    const j = await r.json()
    if (!r.ok) return null
    const n = Number((j as { followers_count?: number }).followers_count)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Nome de usuario de quem falou com voce, a partir do codigo (IGSID).
 * A Meta so manda o @ junto nos eventos de comentario; em mensagem e em
 * clique de botao vem so o numero. Sem esta busca a lista de contatos fica
 * cheia de codigo cru, que nao diz nada a quem le.
 *
 * Devolve null em vez de estourar: nome bonito nao vale travar um envio.
 */
export async function usernamePorId(igsid: string, token: string): Promise<string | null> {
  try {
    const p = new URLSearchParams({ fields: 'username', access_token: token })
    const r = await fetch(`${IG_GRAPH}/${igsid}?${p}`)
    const j = await r.json()
    return r.ok && j?.username ? String(j.username) : null
  } catch {
    return null
  }
}

/**
 * Nome e @ de quem interagiu, a partir do codigo (IGSID).
 * Antes de a pessoa falar com a conta a Meta pode negar: devolve null.
 */
export async function perfilPorId(
  igsid: string, token: string,
): Promise<{ name?: string; username?: string } | null> {
  try {
    const p = new URLSearchParams({ fields: 'name,username', access_token: token })
    const r = await fetch(`${IG_GRAPH}/${igsid}?${p}`)
    const j = await r.json()
    return r.ok ? (j as { name?: string; username?: string }) : null
  } catch {
    return null
  }
}

/** Assina o app aos webhooks de comentarios e mensagens. */
export async function subscribeWebhooks(igUserId: string, token: string) {
  const p = new URLSearchParams({
    subscribed_fields: 'comments,messages,live_comments,message_reactions',
    access_token: token,
  })
  const r = await fetch(`${IG_GRAPH}/${igUserId}/subscribed_apps?${p}`, { method: 'POST' })
  const j = await r.json()
  if (!r.ok) throw new Error(`subscribe falhou: ${JSON.stringify(j)}`)
  return j
}

// ---------- Envio ----------

/** Botoes da mensagem: ate 3, podendo misturar link e avancar. */
type Btn = Array<
  | { type: 'web_url'; title: string; url: string }
  | { type: 'postback'; title: string; payload: string }
>

function messagePayload(text: string, botoes?: Btn) {
  if (!botoes?.length) return { text }

  return {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text: text.slice(0, 640),
        buttons: botoes.slice(0, 3),
      },
    },
  }
}

/**
 * Primeiro toque: "resposta privada" ao comentario.
 * Fura a janela de 24h porque o gatilho e o proprio comentario.
 */
export async function sendPrivateReply(
  igUserId: string, token: string, commentId: string, text: string, btn?: Btn,
) {
  return post(igUserId, token, { recipient: { comment_id: commentId }, message: messagePayload(text, btn) })
}

/** DM normal (so vale dentro da janela de 24h apos a pessoa falar com voce). */
export async function sendDirectMessage(
  igUserId: string, token: string, recipientId: string, text: string, btn?: Btn,
) {
  return post(igUserId, token, { recipient: { id: recipientId }, message: messagePayload(text, btn) })
}

/** Audio por DM (mesma janela de 24h). A Meta aceita m4a, aac, wav e mp4 ate 25 MB. */
export async function sendAudio(igUserId: string, token: string, recipientId: string, url: string) {
  return post(igUserId, token, {
    recipient: { id: recipientId },
    message: { attachment: { type: 'audio', payload: { url } } },
  })
}

/** Resposta publica no proprio comentario. */
export async function replyToComment(commentId: string, token: string, message: string) {
  const p = new URLSearchParams({ message, access_token: token })
  const r = await fetch(`${IG_GRAPH}/${commentId}/replies?${p}`, { method: 'POST' })
  const j = await r.json()
  if (!r.ok) throw new Error(`reply comentario falhou: ${JSON.stringify(j)}`)
  return j
}

async function post(igUserId: string, token: string, body: unknown) {
  const r = await fetch(`${IG_GRAPH}/${igUserId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`envio falhou: ${JSON.stringify(j)}`)
  return j
}

// ---------- Assinatura do webhook ----------

export async function validSignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false
  const expected = header.slice(7)
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(await chave('igAppSecret')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
  if (hex.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

// ---------- Palavra-chave ----------

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Deixa so letras/numeros, separados por um espaco, com espaco nas pontas. */
function tokenized(s: string): string {
  return ' ' + normalize(s).replace(/[^a-z0-9]+/g, ' ').trim() + ' '
}

export function keywordMatches(text: string, keywords: string[], mode: 'contains' | 'exact'): boolean {
  const t = tokenized(text)
  return keywords.some(k => {
    const n = tokenized(k)
    if (n.trim() === '') return false
    if (mode === 'exact') return t === n
    return t.includes(n)
  })
}

// ---------- Verificacao de seguidor ----------

/**
 * Pergunta ao Instagram se esta pessoa segue a conta conectada.
 *
 *   true  = segue
 *   false = nao segue
 *   null  = nao deu para saber (a pessoa ainda nao interagiu, ou a API falhou)
 *
 * O null e importante: quando a consulta nao e possivel, o fluxo deve seguir
 * em frente. Travar um lead por causa de erro nosso e pior do que deixar
 * passar alguem que nao seguiu.
 */
export async function usuarioSegue(igsid: string, token: string): Promise<boolean | null> {
  const url =
    `${IG_GRAPH}/${igsid}?fields=is_user_follow_business` +
    `&access_token=${encodeURIComponent(token)}`

  try {
    const r = await fetch(url)
    const j = await r.json()
    if (typeof j?.is_user_follow_business === 'boolean') return j.is_user_follow_business
    return null
  } catch {
    return null
  }
}
