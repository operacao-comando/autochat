import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { fbAssinarPagina, fbDadosDaPagina, fbPaginasConcedidas, fbTokenDeUsuario } from '@/lib/fb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const voltar = (req: Request, qs: string) => NextResponse.redirect(new URL(`/painel?${qs}`, req.url))

export async function GET(req: Request) {
  const u = new URL(req.url)
  const erro = u.searchParams.get('error_description') || u.searchParams.get('error')
  if (erro) return voltar(req, `erro=${encodeURIComponent(erro)}`)

  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  const esperado = req.headers.get('cookie')?.match(/fb_oauth_state=([^;]+)/)?.[1]

  if (!code) return voltar(req, 'erro=sem_code')
  if (!state || state !== esperado) return voltar(req, 'erro=state_invalido')

  try {
    const userToken = await fbTokenDeUsuario(code)
    const paginas = await fbPaginasConcedidas(userToken)

    // Uma Pagina por instalacao, como uma conta de Instagram por instalacao.
    if (paginas.length === 0) return voltar(req, `erro=${encodeURIComponent('Nenhuma Página foi liberada no login do Facebook.')}`)
    if (paginas.length > 1) {
      await log('warn', 'oauth', 'mais de uma pagina liberada, usando a primeira', { paginas })
    }

    const pagina = await fbDadosDaPagina(paginas[0], userToken)

    await db().from('fb_page').upsert({
      id: 1,
      page_id: pagina.id,
      name: pagina.name,
      access_token: pagina.access_token,
      webhook_subscribed: false,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    let assinado = false
    try {
      await fbAssinarPagina(pagina.id, pagina.access_token)
      assinado = true
    } catch (e) {
      await log('warn', 'oauth', 'assinatura da pagina falhou', { erro: String(e) })
    }

    await db().from('fb_page').update({ webhook_subscribed: assinado }).eq('id', 1)
    await log('info', 'oauth', 'pagina do facebook conectada', { pagina: pagina.name, assinado })

    return voltar(req, 'conectado=facebook')
  } catch (e) {
    await log('error', 'oauth', 'falha ao conectar facebook', { erro: String(e) })
    return voltar(req, `erro=${encodeURIComponent(String(e).slice(0, 200))}`)
  }
}
