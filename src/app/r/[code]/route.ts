import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Redirecionador que conta cliques.
 *
 * A pessoa toca no botao da DM, passa por aqui e segue para o destino real.
 * O registro do clique nunca pode atrasar nem impedir o redirecionamento:
 * se o banco falhar, ela vai para a pagina do mesmo jeito.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params
  const supa = db()

  const { data: link } = await supa.from('links').select('url').eq('code', code).maybeSingle()

  // Codigo desconhecido (link velho, automacao apagada, endereco digitado
  // errado): manda para a raiz em vez de mostrar erro para o visitante.
  if (!link?.url) return NextResponse.redirect(new URL('/', req.url), 302)

  try {
    await supa.from('link_clicks').insert({
      code,
      user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    })
  } catch {
    // medicao perdida, visita preservada
  }

  return NextResponse.redirect(link.url, 302)
}
