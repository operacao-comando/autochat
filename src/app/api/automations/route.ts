import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logado } from '@/lib/guard'
import { etapaTemConteudo, lerEtapas } from '@/lib/steps'
import { lerCanais } from '@/lib/canais'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await logado())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })
  const { data, error } = await db()
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  if (!(await logado())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })
  const b = await req.json()

  // Rascunho: cria pausado e ja abre no editor, como o ManyChat faz.
  // Sem isto o usuario precisa preencher tudo antes de ver a tela.
  if (b.rascunho) {
    const { data, error } = await db()
      .from('automations')
      .insert({
        name: 'Automação sem título',
        keywords: [],
        match_mode: 'contains',
        steps: [{ text: '', links: [{ label: '', url: '' }], next_label: '' }],
        dm_text: '',
        active: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  // Duplicar: copia uma automacao existente para servir de molde.
  // Nasce pausada e SEM palavra-chave de proposito. Duas automacoes ativas
  // disputando a mesma palavra tornam o disparo imprevisivel; e uma copia
  // ativa por engano manda DM antes de alguem revisar o texto.
  if (b.duplicar) {
    const { data: origem, error: erroLeitura } = await db()
      .from('automations')
      .select('*')
      .eq('id', b.duplicar)
      .single()

    if (erroLeitura || !origem) {
      return NextResponse.json({ erro: 'automação de origem não encontrada' }, { status: 404 })
    }

    const { data, error } = await db()
      .from('automations')
      .insert({
        name: String(origem.name || 'Automação').slice(0, 110) + ' (cópia)',
        // Vazia: o dono digita a palavra nova antes de ativar.
        keywords: [],
        match_mode: origem.match_mode,
        media_id: origem.media_id,
        comment_reply_text: origem.comment_reply_text,
        steps: origem.steps,
        dm_text: origem.dm_text,
        button_label: origem.button_label,
        button_url: origem.button_url,
        once_per_user: origem.once_per_user,
        channels: lerCanais(origem.channels),
        fb_post_id: origem.fb_post_id,
        fb_steps: origem.fb_steps,
        // Contador e historico nao vem junto: a copia comeca zerada e com
        // trava anti-duplicata propria.
        active: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  const keywords: string[] = String(b.keywords || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)

  const etapas = lerEtapas(b.steps).filter(etapaTemConteudo)

  if (!b.name || keywords.length === 0 || etapas.length === 0) {
    return NextResponse.json(
      { erro: 'nome, palavras-chave e pelo menos uma etapa com mensagem sao obrigatorios' },
      { status: 400 },
    )
  }

  const primeira = etapas[0]
  const ultima = etapas[etapas.length - 1]

  const { data, error } = await db()
    .from('automations')
    .insert({
      name: String(b.name).slice(0, 120),
      keywords,
      match_mode: b.match_mode === 'exact' ? 'exact' : 'contains',
      media_id: b.media_id ? String(b.media_id) : null,
      fb_post_id: b.fb_post_id ? String(b.fb_post_id) : null,
      channels: lerCanais(b.channels),
      comment_reply_text: b.comment_reply_text || null,
      steps: etapas,
      // Espelho da primeira etapa: mantem as colunas antigas coerentes
      dm_text: primeira.text,
      button_label: primeira.links?.[0]?.label || primeira.button_label || null,
      button_url: ultima.links?.[0]?.url || ultima.button_url || null,
      active: b.active !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
