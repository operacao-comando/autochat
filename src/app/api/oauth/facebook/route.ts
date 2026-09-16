import { NextResponse } from 'next/server'
import { fbAuthorizeUrl } from '@/lib/fb'
import { logado } from '@/lib/guard'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!(await logado())) return NextResponse.redirect(new URL('/login', req.url))

  const state = crypto.randomUUID()
  const res = NextResponse.redirect(fbAuthorizeUrl(state))
  res.cookies.set('fb_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600,
  })
  return res
}
