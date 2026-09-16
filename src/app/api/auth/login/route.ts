import { NextResponse } from 'next/server'
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { lerDono, senhaConfere } from '@/lib/acesso'
import { segredo } from '@/lib/segredos'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const form = await req.formData()
  const email = String(form.get('email') || '').trim().toLowerCase()
  const senha = String(form.get('senha') || '')

  // Painel ainda sem dono: a primeira abertura e na tela de configurar.
  const dono = await lerDono().catch(() => null)
  if (!dono) return NextResponse.redirect(new URL('/configurar', req.url), { status: 303 })

  if (email !== dono.email || !(await senhaConfere(senha, dono.senha_hash))) {
    return NextResponse.redirect(new URL('/login?erro=1', req.url), { status: 303 })
  }

  const res = NextResponse.redirect(new URL('/painel', req.url), { status: 303 })
  res.cookies.set(SESSION_COOKIE, await createSession(await segredo('sessao')), sessionCookieOptions)
  return res
}
