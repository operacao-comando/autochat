import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { cronAutorizado } from '@/lib/segredos'
import { refreshLongLived } from '@/lib/ig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) { return run(req) }
export async function POST(req: Request) { return run(req) }

/**
 * Renova o token de 60 dias. O Instagram so permite renovar depois de 24h de uso,
 * entao rodamos todo dia e so agimos quando falta menos de 20 dias para vencer.
 */
async function run(req: Request) {
  if (!(await cronAutorizado(req))) return new NextResponse('unauthorized', { status: 401 })

  const supa = db()
  const { data: conta } = await supa.from('ig_account').select('*').eq('id', 1).maybeSingle()
  if (!conta) return NextResponse.json({ ok: false, motivo: 'sem conta conectada' })

  const vence = conta.token_expires_at ? new Date(conta.token_expires_at).getTime() : 0
  const diasRestantes = Math.floor((vence - Date.now()) / 86_400_000)
  if (diasRestantes > 20) {
    return NextResponse.json({ ok: true, renovado: false, diasRestantes })
  }

  try {
    const novo = await refreshLongLived(conta.access_token)
    await supa.from('ig_account').update({
      access_token: novo.access_token,
      token_expires_at: new Date(Date.now() + novo.expires_in * 1000).toISOString(),
    }).eq('id', 1)
    await log('info', 'cron', 'token renovado', { dias: Math.round(novo.expires_in / 86400) })
    return NextResponse.json({ ok: true, renovado: true })
  } catch (e) {
    await log('error', 'cron', 'falha ao renovar token', { erro: String(e) })
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 })
  }
}
