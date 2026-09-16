import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { cronAutorizado } from '@/lib/segredos'
import { seguidores } from '@/lib/ig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) { return run(req) }
export async function POST(req: Request) { return run(req) }

/**
 * Uma leitura por dia do total de seguidores.
 *
 * A API do Instagram so responde o numero de agora, sem historico. O ganho
 * diario do dashboard e a diferenca entre duas leituras -- por isso a curva
 * comeca no dia em que esta tarefa e ligada, e nao antes.
 *
 * Grava por dia (upsert): rodar duas vezes no mesmo dia apenas atualiza.
 */
async function run(req: Request) {
  if (!(await cronAutorizado(req))) return new NextResponse('unauthorized', { status: 401 })

  const supa = db()
  const { data: conta } = await supa.from('ig_account').select('access_token').eq('id', 1).maybeSingle()
  if (!conta?.access_token) return NextResponse.json({ ok: false, motivo: 'sem conta conectada' })

  const total = await seguidores(conta.access_token)
  if (total === null) {
    await log('warn', 'cron', 'nao deu para ler seguidores')
    return NextResponse.json({ ok: false, motivo: 'api nao respondeu' })
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const { error } = await supa
    .from('follower_snapshots')
    .upsert({ day: hoje, followers: total, captured_at: new Date().toISOString() }, { onConflict: 'day' })

  if (error) {
    await log('error', 'cron', 'falha ao gravar seguidores', { erro: error.message })
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dia: hoje, seguidores: total })
}
