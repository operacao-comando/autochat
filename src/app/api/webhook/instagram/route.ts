import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { env } from '@/lib/env'
import { tokenDeVerificacao } from '@/lib/segredos'
import { keywordMatches, replyToComment, sendDirectMessage, usernamePorId, usuarioSegue, validSignature } from '@/lib/ig'
import { LEMBRETE_FOLLOW_PADRAO, botoesDaEtapa, lerEtapas, lerPayload } from '@/lib/steps'
import { rastrearBotoes } from '@/lib/tracking'
import { lerCanais } from '@/lib/canais'
import { dadosDaPessoa, personalizar, temMarcacao } from '@/lib/personalizar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---- 1) Verificacao do webhook (a Meta chama isto uma vez, com GET) ----
export async function GET(req: Request) {
  const u = new URL(req.url)
  const mode = u.searchParams.get('hub.mode')
  const token = u.searchParams.get('hub.verify_token')
  const challenge = u.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === tokenDeVerificacao('instagram')) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

// ---- 2) Recebimento de eventos ----
export async function POST(req: Request) {
  const raw = await req.text()

  // Registro cru, antes de qualquer filtro. Serve para distinguir "a Meta nao
  // mandou" de "chegou e o nosso lado descartou".
  await log('info', 'webhook', 'POST recebido da Meta', {
    bytes: raw.length, corpo: raw.slice(0, 900),
  })

  if (!(await validSignature(raw, req.headers.get('x-hub-signature-256')))) {
    await log('warn', 'webhook', 'assinatura invalida')
    return new NextResponse('invalid signature', { status: 401 })
  }

  try {
    await handle(JSON.parse(raw))
  } catch (e) {
    await log('error', 'webhook', 'erro ao processar', { erro: String(e) })
  }

  // A Meta exige 200 rapido, mesmo se algo der errado do nosso lado.
  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}

type CommentValue = {
  id: string
  text?: string
  from?: { id: string; username?: string }
  media?: { id: string }
}

async function handle(body: any) {
  if (body?.object !== 'instagram') return

  const supa = db()
  const { data: account } = await supa.from('ig_account').select('*').eq('id', 1).maybeSingle()
  if (!account) {
    await log('warn', 'webhook', 'evento recebido sem conta conectada')
    return
  }

  for (const entry of body.entry ?? []) {
    // --- comentarios ---
    for (const change of entry.changes ?? []) {
      if (change.field !== 'comments') continue
      await onComment(change.value as CommentValue, account)
    }
    // --- mensagens diretas e cliques em botao ---
    for (const m of entry.messaging ?? []) {
      const senderId = m?.sender?.id
      if (!senderId || senderId === account.ig_user_id) continue
      await upsertContact(senderId, null, account.access_token)

      const payload = m?.postback?.payload ?? m?.message?.quick_reply?.payload
      if (payload) await onPostback(senderId, String(payload), account)
    }
  }
}

/**
 * Numero do ciclo em que esta pessoa esta no momento nesta automacao.
 * Cada comentario novo abre um ciclo; 0 significa que ela nunca entrou.
 */
async function cicloAtual(automationId: string, recipientId: string) {
  const supa = db()
  const { data } = await supa
    .from('send_queue')
    .select('cycle')
    .eq('channel', 'instagram')
    .eq('automation_id', automationId)
    .eq('recipient_id', recipientId)
    .order('cycle', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.cycle ?? 0
}

/** A pessoa clicou no botao de uma etapa: enfileira a etapa seguinte. */
async function onPostback(senderId: string, payload: string, account: any) {
  const alvo = lerPayload(payload)
  if (!alvo) return

  const supa = db()
  const { data: automacao } = await supa
    .from('automations')
    .select('id, name, active, steps, channels')
    .eq('id', alvo.automationId)
    .maybeSingle()

  if (!automacao?.active) return
  // Automacao que deixou de valer no Instagram nao continua o fluxo aqui.
  if (!lerCanais(automacao.channels).includes('instagram')) return

  const etapas = lerEtapas(automacao.steps)
  if (alvo.step >= etapas.length) return

  // --- portao de seguidor ---
  // Quando a etapa de destino exige follow, o Instagram e quem responde se a
  // pessoa segue. O clique no botao sozinho nao vale.
  if (etapas[alvo.step]?.require_follow && alvo.step > 0) {
    const segue = await usuarioSegue(senderId, account.access_token)

    if (segue === false) {
      const anterior = alvo.step - 1
      const bruto = etapas[anterior]?.follow_reminder?.trim() || LEMBRETE_FOLLOW_PADRAO
      const texto = personalizar(
        bruto,
        temMarcacao(bruto) ? await dadosDaPessoa(senderId, account.access_token) : { nome: null, usuario: null },
      )
      try {
        await sendDirectMessage(
          account.ig_user_id, account.access_token, senderId, texto,
          await rastrearBotoes(botoesDaEtapa(etapas, anterior, automacao.id), automacao.id, anterior, senderId),
        )
      } catch (e) {
        await log('warn', 'webhook', 'lembrete de follow falhou', { erro: String(e) })
      }
      await log('info', 'webhook', 'bloqueado: ainda nao segue', {
        automation: automacao.name, recipient: senderId, etapa: alvo.step + 1,
      })
      return
    }

    // segue === null: nao deu para verificar. Deixa passar de proposito, para
    // nao travar um lead por causa de falha nossa.
    await log('info', 'webhook', segue ? 'follow confirmado' : 'follow nao verificavel, liberado', {
      recipient: senderId,
    })
  }

  // O clique pertence ao ciclo que a pessoa esta vivendo agora.
  const ciclo = (await cicloAtual(automacao.id, senderId)) || 1

  const { error } = await supa.from('send_queue').insert({
    channel: 'instagram',
    automation_id: automacao.id,
    recipient_id: senderId,
    kind: 'dm',
    step_index: alvo.step,
    cycle: ciclo,
  })

  if (error) {
    // 23505 = a trava do banco barrou: esta pessoa ja recebeu esta etapa.
    // Vale para clique repetido no mesmo botao.
    if (error.code === '23505') {
      await log('info', 'webhook', 'clique repetido ignorado', {
        automation: automacao.name, recipient: senderId, etapa: alvo.step + 1,
      })
    } else {
      await log('error', 'webhook', 'falha ao enfileirar etapa', { erro: error.message })
    }
    return
  }

  await log('info', 'webhook', 'etapa enfileirada', {
    automation: automacao.name, recipient: senderId, etapa: alvo.step + 1,
  })
}

async function upsertContact(igUserId: string, username: string | null, token?: string) {
  const supa = db()

  // Busca o @ quando o evento nao trouxe (mensagem e clique de botao nunca
  // trazem). So consulta se ainda nao temos o nome guardado, para nao gastar
  // chamada a cada toque de botao.
  let nome = username
  if (!nome && token) {
    const { data: atual } = await supa
      .from('contacts').select('username').eq('ig_user_id', igUserId).maybeSingle()
    if (!atual?.username) nome = await usernamePorId(igUserId, token)
  }

  const linha: Record<string, unknown> = {
    ig_user_id: igUserId,
    last_seen_at: new Date().toISOString(),
  }
  // Nunca gravar null por cima de um nome que ja existe.
  if (nome) linha.username = nome

  await supa.from('contacts').upsert(linha, { onConflict: 'ig_user_id' })
}

async function onComment(v: CommentValue, account: any) {
  const supa = db()
  const commenterId = v.from?.id
  const text = v.text ?? ''
  const mediaId = v.media?.id ?? null

  // Registra tudo que chega. Sem isto, um comentario descartado some sem deixar
  // rastro e o painel parece "morto" sem motivo aparente.
  await log('info', 'webhook', 'comentario recebido', {
    de: v.from?.username ?? commenterId ?? '?', texto: text, media: mediaId,
  })

  if (!commenterId) return
  if (commenterId === account.ig_user_id) {
    await log('info', 'webhook', 'comentario do proprio dono, ignorado', { texto: text })
    return
  }

  await upsertContact(commenterId, v.from?.username ?? null, account.access_token)

  const { data: autos } = await supa
    .from('automations')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true })

  const candidatas = (autos ?? []).filter(a =>
    lerCanais(a.channels).includes('instagram') &&
    (a.media_id === null || a.media_id === mediaId) &&
    keywordMatches(text, a.keywords ?? [], a.match_mode),
  )

  // Quando mais de uma automacao casa, vence a mais especifica:
  // 1) a que aponta para este post exato   2) a de correspondencia exata
  // 3) a mais antiga (criterio estavel de desempate)
  const match = candidatas.sort((a, b) => {
    const posto = (x: typeof a) => (x.media_id ? 0 : 2) + (x.match_mode === 'exact' ? 0 : 1)
    return posto(a) - posto(b)
  })[0]

  if (!match) {
    await log('info', 'webhook', 'nenhuma automacao casou com o comentario', {
      texto: text,
      ativas: (autos ?? []).map(a => `${a.name}: ${(a.keywords ?? []).join(', ')}`),
    })
    return
  }

  // Comentario novo abre um ciclo novo: quem ja passou pelo fluxo antes
  // volta a receber, sem perder o historico das passagens anteriores.
  const ciclo = (await cicloAtual(match.id, commenterId)) + 1

  // Enfileira a primeira etapa. As travas UNIQUE do banco impedem duplicata:
  //  - mesmo comment_id nunca entra duas vezes (reenvio da Meta)
  //  - dentro do mesmo ciclo, a mesma etapa nao entra duas vezes
  const { error } = await supa.from('send_queue').insert({
    channel: 'instagram',
    automation_id: match.id,
    recipient_id: commenterId,
    comment_id: v.id,
    media_id: mediaId,
    kind: 'private_reply',
    step_index: 0,
    cycle: ciclo,
  })

  if (error) {
    if (error.code === '23505') {
      await log('info', 'webhook', 'duplicata bloqueada pelo banco', {
        automation: match.name, recipient: commenterId,
      })
    } else {
      await log('error', 'webhook', 'falha ao enfileirar', { erro: error.message })
    }
    return
  }

  await log('info', 'webhook', 'enfileirado', {
    automation: match.name, recipient: commenterId, comment_id: v.id,
  })

  // Resposta publica no comentario (opcional, feita na hora)
  if (match.comment_reply_text) {
    try {
      // No comentario publico so ha o @ (o nome exige a pessoa ter interagido).
      const resposta = personalizar(match.comment_reply_text, {
        nome: null, usuario: v.from?.username ?? null,
      })
      await replyToComment(v.id, account.access_token, resposta)
    } catch (e) {
      await log('warn', 'webhook', 'resposta publica falhou', { erro: String(e) })
    }
  }
}
