import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { db } from './db'

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>

/**
 * Dono do painel: nome, e-mail e senha criados na tela /configurar.
 * A senha fica so como hash scrypt, nunca em texto.
 */

export type Dono = { nome: string; email: string }

export async function hashDaSenha(senha: string): Promise<string> {
  const sal = randomBytes(16)
  const hash = await scrypt(senha, sal, 64)
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`
}

export async function senhaConfere(senha: string, guardado: string): Promise<boolean> {
  const [tipo, salHex, hashHex] = guardado.split('$')
  if (tipo !== 'scrypt' || !salHex || !hashHex) return false
  const esperado = Buffer.from(hashHex, 'hex')
  const calculado = await scrypt(senha, Buffer.from(salHex, 'hex'), esperado.length)
  return timingSafeEqual(esperado, calculado)
}

/**
 * Situacao da instalacao:
 *  - 'sem-supabase': a integracao ainda nao foi ligada na Vercel;
 *  - 'sem-dono': banco vazio ou sem acesso criado -> tela /configurar;
 *  - 'pronto': ja tem dono -> tela /login.
 */
export async function situacao(): Promise<'sem-supabase' | 'sem-dono' | 'pronto'> {
  const { supabaseConectado } = await import('./env')
  if (!supabaseConectado()) return 'sem-supabase'
  const { data, error } = await db().from('painel_acesso').select('id').eq('id', 1).maybeSingle()
  // Tabela inexistente (banco recem-criado) tambem e "sem dono".
  if (error || !data) return 'sem-dono'
  return 'pronto'
}

export async function lerDono(): Promise<(Dono & { senha_hash: string }) | null> {
  const { data } = await db().from('painel_acesso').select('nome, email, senha_hash').eq('id', 1).maybeSingle()
  return data ?? null
}

/** Nome e e-mail publicos do dono, para privacidade, termos e exclusao de dados. */
export async function donoPublico(): Promise<Dono> {
  try {
    const d = await lerDono()
    if (d) return { nome: d.nome, email: d.email }
  } catch {}
  return { nome: 'Responsável por este painel', email: '' }
}
