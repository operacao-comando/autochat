// Sessao simples por cookie assinado (HMAC-SHA256 via Web Crypto).
// Funciona tanto no runtime Node quanto no Edge (middleware).

const enc = new TextEncoder()

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

export const SESSION_COOKIE = 'insta_dm_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 dias

export async function createSession(secret: string): Promise<string> {
  const exp = Date.now() + MAX_AGE * 1000
  const payload = b64url(enc.encode(JSON.stringify({ exp })))
  return `${payload}.${await hmac(secret, payload)}`
}

export async function verifySession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  if (sig !== (await hmac(secret, payload))) return false
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' && json.exp > Date.now()
  } catch {
    return false
  }
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE,
}

// Comparacao de senha em tempo constante
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
