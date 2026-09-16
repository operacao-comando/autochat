import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { exchangeCode, me, subscribeWebhooks, toLongLived } from '@/lib/ig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const u = new URL(req.url)
  const erro = u.searchParams.get('error_description') || u.searchParams.get('error')
  if (erro) return NextResponse.redirect(new URL(`/painel?erro=${encodeURIComponent(erro)}`, req.url))

  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  const esperado = req.headers.get('cookie')?.match(/ig_oauth_state=([^;]+)/)?.[1]

  if (!code) return NextResponse.redirect(new URL('/painel?erro=sem_code', req.url))
  if (!state || state !== esperado) {
    return NextResponse.redirect(new URL('/painel?erro=state_invalido', req.url))
  }

  try {
    const curto = await exchangeCode(code)
    const longo = await toLongLived(curto.access_token)
    const perfil = await me(longo.access_token)

    const expira = new Date(Date.now() + longo.expires_in * 1000).toISOString()

    await db().from('ig_account').upsert({
      id: 1,
      ig_user_id: String(perfil.user_id),
      username: perfil.username,
      access_token: longo.access_token,
      token_expires_at: expira,
      webhook_subscribed: false,
    })

    let assinado = false
    try {
      await subscribeWebhooks(String(perfil.user_id), longo.access_token)
      assinado = true
    } catch (e) {
      await log('warn', 'oauth', 'assinatura do webhook falhou', { erro: String(e) })
    }

    await db().from('ig_account').update({ webhook_subscribed: assinado }).eq('id', 1)
    await log('info', 'oauth', 'conta conectada', { username: perfil.username, assinado })

    return NextResponse.redirect(new URL('/painel?conectado=1', req.url))
  } catch (e) {
    await log('error', 'oauth', 'falha ao conectar', { erro: String(e) })
    return NextResponse.redirect(new URL(`/painel?erro=${encodeURIComponent(String(e).slice(0, 200))}`, req.url))
  }
}
