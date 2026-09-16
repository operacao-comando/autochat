import { env } from './env'

/** Decodifica e valida o signed_request que a Meta envia nos callbacks. */
export async function parseSignedRequest(signed: string): Promise<Record<string, unknown> | null> {
  const [sigPart, payloadPart] = signed.split('.')
  if (!sigPart || !payloadPart) return null

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.igAppSecret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  )
  const sig = b64urlToBytes(sigPart)
  const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payloadPart))
  if (!ok) return null

  const json = new TextDecoder().decode(b64urlToBytes(payloadPart))
  try { return JSON.parse(json) } catch { return null }
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
