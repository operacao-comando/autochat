import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { logado } from '@/lib/guard'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Apaga o historico de envios desta automacao.
 * Serve para testar de novo com a mesma conta: sem historico, a trava
 * de duplicata deixa a pessoa entrar no fluxo outra vez.
 */
export async function POST(_req: Request, { params }: Ctx) {
  if (!(await logado())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })
  const { id } = await params

  const { error, count } = await db()
    .from('send_queue')
    .delete({ count: 'exact' })
    .eq('automation_id', id)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  await log('warn', 'painel', 'historico de envios apagado', { automation_id: id, apagados: count })
  return NextResponse.json({ ok: true, apagados: count ?? 0 })
}
