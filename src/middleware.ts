import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'
import { segredo } from '@/lib/segredos'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  // Sem Supabase ligado nao ha segredo: cai no login, que explica o que falta.
  const ok = await segredo('sessao').then(s => verifySession(token, s), () => false)
  if (ok) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

// Protege so o painel. Webhook, OAuth e cron ficam de fora de proposito.
export const config = { matcher: ['/painel/:path*'] }
