import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { parseSignedRequest } from '@/lib/signed-request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Chamado pela Meta quando o usuario remove o app. Apaga o token guardado. */
export async function POST(req: Request) {
  const form = await req.formData()
  const dados = await parseSignedRequest(String(form.get('signed_request') || ''))
  if (!dados) return new NextResponse('assinatura invalida', { status: 400 })

  await db().from('ig_account').delete().eq('id', 1)
  await log('warn', 'meta', 'app desautorizado, token apagado', dados)
  return NextResponse.json({ ok: true })
}
