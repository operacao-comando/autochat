import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logado } from '@/lib/guard'
import { etapaTemConteudo, lerEtapas } from '@/lib/steps'
import { lerCanais } from '@/lib/canais'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await logado())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })
  const { id } = await params
  const b = await req.json()

  const patch: Record<string, unknown> = {}
  if (typeof b.active === 'boolean') patch.active = b.active
  if (typeof b.name === 'string') patch.name = b.name
  if (typeof b.comment_reply_text === 'string') patch.comment_reply_text = b.comment_reply_text || null
  if (typeof b.media_id === 'string') patch.media_id = b.media_id.trim() || null
  if (b.match_mode === 'exact' || b.match_mode === 'contains') patch.match_mode = b.match_mode
  if (b.channels !== undefined) patch.channels = lerCanais(b.channels)
  if (typeof b.fb_post_id === 'string') patch.fb_post_id = b.fb_post_id.trim() || null
  // Rascunho pode ficar incompleto: a trava vale na hora de ATIVAR.
  let keywords: string[] | null = null
  if (typeof b.keywords === 'string') {
    keywords = b.keywords.split(',').map((s: string) => s.trim()).filter(Boolean)
    patch.keywords = keywords
  }

  let etapas: ReturnType<typeof lerEtapas> | null = null
  if (b.steps !== undefined) {
    etapas = lerEtapas(b.steps).filter(etapaTemConteudo)
    patch.steps = etapas
    patch.dm_text = etapas[0]?.text ?? ''
    patch.button_label = etapas[0]?.links?.[0]?.label || etapas[0]?.button_label || null
    patch.button_url = etapas[etapas.length - 1]?.links?.[0]?.url || etapas[etapas.length - 1]?.button_url || null
  }

  // Fluxo proprio do Facebook. Nulo ou vazio = o Facebook usa o mesmo fluxo.
  let etapasFb: ReturnType<typeof lerEtapas> | null | undefined
  if (b.fb_steps !== undefined) {
    etapasFb = b.fb_steps === null ? null : lerEtapas(b.fb_steps).filter(etapaTemConteudo)
    if (etapasFb && etapasFb.length === 0) etapasFb = null
    patch.fb_steps = etapasFb
  }

  if (patch.active === true) {
    const supa = db()
    const { data: atual } = await supa
      .from('automations')
      .select('keywords, steps')
      .eq('id', id)
      .maybeSingle()

    const palavrasFinais = keywords ?? atual?.keywords ?? []
    const etapasFinais = etapas ?? lerEtapas(atual?.steps).filter(etapaTemConteudo)

    if (palavrasFinais.length === 0) {
      return NextResponse.json(
        { erro: 'para ativar, informe ao menos uma palavra-chave' },
        { status: 400 },
      )
    }
    if (etapasFinais.length === 0) {
      return NextResponse.json(
        { erro: 'para ativar, escreva a mensagem de pelo menos uma etapa' },
        { status: 400 },
      )
    }
    // A primeira etapa e a resposta privada ao comentario: so aceita texto.
    if (!etapasFinais[0].text.trim()) {
      return NextResponse.json(
        { erro: 'para ativar, a etapa 1 precisa de texto (ela não leva áudio)' },
        { status: 400 },
      )
    }
    if (etapasFb?.length && !etapasFb[0].text.trim()) {
      return NextResponse.json(
        { erro: 'para ativar, a etapa 1 do fluxo do Facebook precisa de texto' },
        { status: 400 },
      )
    }
  }

  const { data, error } = await db()
    .from('automations')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await logado())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })
  const { id } = await params
  const { error } = await db().from('automations').delete().eq('id', id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
