import { NextResponse } from 'next/server'
import { authorizeUrl } from '@/lib/ig'
import { logado } from '@/lib/guard'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!(await logado())) return NextResponse.redirect(new URL('/login', req.url))

  const state = crypto.randomUUID()
  let destino: string
  try {
    destino = await authorizeUrl(state)
  } catch {
    // Chaves da Meta ainda nao coladas: volta ao painel explicando.
    return NextResponse.redirect(new URL('/painel?erro=' + encodeURIComponent('Cole antes as chaves do aplicativo da Meta em Configurações.'), req.url))
  }
  const res = NextResponse.redirect(destino)
  res.cookies.set('ig_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600,
  })
  return res
}
