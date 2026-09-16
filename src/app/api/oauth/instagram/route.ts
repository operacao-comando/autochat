import { NextResponse } from 'next/server'
import { authorizeUrl } from '@/lib/ig'
import { logado } from '@/lib/guard'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!(await logado())) return NextResponse.redirect(new URL('/login', req.url))

  const state = crypto.randomUUID()
  const res = NextResponse.redirect(authorizeUrl(state))
  res.cookies.set('ig_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600,
  })
  return res
}
