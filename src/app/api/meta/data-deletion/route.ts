import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { env } from '@/lib/env'
import { parseSignedRequest } from '@/lib/signed-request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pedido de exclusao de dados. Apaga contato, fila e conta ligados ao usuario. */
export async function POST(req: Request) {
  const form = await req.formData()
  const dados = await parseSignedRequest(String(form.get('signed_request') || ''))
  if (!dados) return new NextResponse('assinatura invalida', { status: 400 })

  const userId = String(dados.user_id || '')
  const supa = db()

  if (userId) {
    await supa.from('send_queue').delete().eq('recipient_id', userId)
    await supa.from('contacts').delete().eq('ig_user_id', userId)
    await supa.from('ig_account').delete().eq('ig_user_id', userId)
  }

  await log('warn', 'meta', 'exclusao de dados solicitada', { userId })

  return NextResponse.json({
    url: `${env.baseUrl()}/privacidade`,
    confirmation_code: `del-${userId || 'anon'}-${Math.floor(Date.now() / 1000)}`,
  })
}
