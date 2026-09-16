import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { segredo } from '@/lib/segredos'
import { etapasDoCanal, lerCanais } from '@/lib/canais'
import { fbAssinaturaValida, fbEhPagina, fbResponderComentario } from '@/lib/fb'
import { keywordMatches } from '@/lib/ig'
import { lerPayload } from '@/lib/steps'
import { personalizar, primeiroNome } from '@/lib/texto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Webhook da Pagina do Facebook.
 *
 * Espelha o webhook do Instagram, com tres diferencas da Meta:
 *  - o comentario chega em `feed` (item "comment", verb "add") e ja traz o
 *    nome de quem comentou;
 *  - nao existe "segue a Pagina": etapa com "so avancar se seguir" passa
 *    direto no Facebook, e isso fica registrado;
 *  - a assinatura usa o segredo do app Meta (FB_APP_SECRET).
 *
 * Tudo o que chega e registrado antes de qualquer filtro, inclusive o que e
 * descartado e o motivo. Nao remover: e o que explica um painel "parado".
 */

export async function GET(req: Request) {
  const u = new URL(req.url)
  const esperado = await segredo('webhook-facebook')
  if (
    esperado &&
    u.searchParams.get('hub.mode') === 'subscribe' &&
    u.searchParams.get('hub.verify_token') === esperado
  ) {
    return new NextResponse(u.searchParams.get('hub.challenge') ?? '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

export async function POST(req: Request) {
  const raw = await req.text()

  await log('info', 'facebook', 'POST recebido da Meta', { bytes: raw.length, corpo: raw.slice(0, 1500) })

  if (!(await fbAssinaturaValida(raw, req.headers.get('x-hub-signature-256')))) {
    await log('warn', 'facebook', 'assinatura invalida')
    return new NextResponse('invalid signature', { status: 401 })
  }

  try {
    await tratar(JSON.parse(raw))
  } catch (e) {
    await log('error', 'facebook', 'erro ao processar', { erro: String(e) })
  }

  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}

type Pagina = { page_id: string; name: string | null; access_token: string }

type Comentario = {
  item?: string
  verb?: string
  comment_id?: string
  post_id?: string
  parent_id?: string
  message?: string
  from?: { id: string; name?: string }
}

async function tratar(body: any) {
  if (body?.object !== 'page') return

  const { data: pagina } = await db()
    .from('fb_page').select('page_id, name, access_token').eq('id', 1).maybeSingle()
  if (!pagina) {
    await log('warn', 'facebook', 'evento recebido sem pagina conectada')
    return
  }

  for (const entry of body.entry ?? []) {
    if (String(entry.id) !== pagina.page_id) {
      await log('warn', 'facebook', 'evento de outra pagina, ignorado', { pagina: entry.id })
      continue
    }

    for (const change of entry.changes ?? []) {
      if (change.field !== 'feed') continue
      const v = change.value as Comentario
      // So comentario novo. Curtida, edicao, post e foto tambem chegam em "feed".
      if (v?.item !== 'comment' || v?.verb !== 'add') continue
      await aoComentar(v, pagina)
    }

    for (const m of entry.messaging ?? []) {
      const psid = m?.sender?.id
      if (!psid || psid === pagina.page_id) continue
      await gravarContato(psid, null)

      const payload = m?.postback?.payload ?? m?.message?.quick_reply?.payload
      if (payload) await aoTocarBotao(psid, String(payload))
    }
  }
}

async function gravarContato(psid: string, nome: string | null) {
  const linha: Record<string, unknown> = {
    ig_user_id: psid,
    channel: 'facebook',
    last_seen_at: new Date().toISOString(),
  }
  // Mensagem e clique chegam sem nome: nunca apagar o que o comentario trouxe.
  if (nome) linha.username = nome
  await db().from('contacts').upsert(linha, { onConflict: 'ig_user_id' })
}

/** Ciclo atual desta pessoa nesta automacao, no Facebook. 0 = nunca entrou. */
async function cicloAtual(automationId: string, psid: string) {
  const { data } = await db()
    .from('send_queue')
    .select('cycle')
    .eq('channel', 'facebook')
    .eq('automation_id', automationId)
    .eq('recipient_id', psid)
    .order('cycle', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.cycle ?? 0
}

async function aoComentar(v: Comentario, pagina: Pagina) {
  const supa = db()
  const psid = v.from?.id
  const texto = v.message ?? ''

  await log('info', 'facebook', 'comentario recebido', {
    de: v.from?.name ?? psid ?? '?', texto, post: v.post_id,
  })

  if (!psid || !v.comment_id) return
  if (psid === pagina.page_id) {
    await log('info', 'facebook', 'comentario da propria pagina, ignorado', { texto })
    return
  }
  if (await fbEhPagina(psid, pagina.access_token)) {
    await log('info', 'facebook', 'comentario feito por uma pagina, ignorado', {
      de: v.from?.name ?? psid, texto, motivo: 'a Meta so deixa responder perfil pessoal',
    })
    return
  }

  await gravarContato(psid, v.from?.name ?? null)

  const { data: autos } = await supa
    .from('automations')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true })

  const doFacebook = (autos ?? []).filter(a => lerCanais(a.channels).includes('facebook'))
  const candidatas = doFacebook.filter(a =>
    (a.fb_post_id === null || a.fb_post_id === v.post_id) &&
    keywordMatches(texto, a.keywords ?? [], a.match_mode),
  )

  // Mesmo criterio do Instagram: post exato, depois correspondencia exata,
  // depois a mais antiga.
  const match = candidatas.sort((a, b) => {
    const posto = (x: typeof a) => (x.fb_post_id ? 0 : 2) + (x.match_mode === 'exact' ? 0 : 1)
    return posto(a) - posto(b)
  })[0]

  if (!match) {
    await log('info', 'facebook', 'nenhuma automacao casou com o comentario', {
      texto,
      ativas: doFacebook.map(a => `${a.name}: ${(a.keywords ?? []).join(', ')}`),
    })
    return
  }

  const ciclo = (await cicloAtual(match.id, psid)) + 1

  // A Meta costuma repetir o aviso do mesmo comentario: a trava unica do
  // comment_id no banco barra a segunda entrada.
  const { error } = await supa.from('send_queue').insert({
    channel: 'facebook',
    automation_id: match.id,
    recipient_id: psid,
    comment_id: v.comment_id,
    media_id: v.post_id ?? null,
    kind: 'private_reply',
    step_index: 0,
    cycle: ciclo,
  })

  if (error) {
    if (error.code === '23505') {
      await log('info', 'facebook', 'duplicata bloqueada pelo banco', { automation: match.name, recipient: psid })
    } else {
      await log('error', 'facebook', 'falha ao enfileirar', { erro: error.message })
    }
    return
  }

  await log('info', 'facebook', 'enfileirado', { automation: match.name, recipient: psid, comment_id: v.comment_id })

  if (match.comment_reply_text) {
    try {
      // No Facebook o aviso ja traz o nome; nao existe @.
      const resposta = personalizar(match.comment_reply_text, {
        nome: primeiroNome(v.from?.name), usuario: null,
      })
      await fbResponderComentario(v.comment_id, pagina.access_token, resposta)
    } catch (e) {
      await log('warn', 'facebook', 'resposta publica falhou', { erro: String(e) })
    }
  }
}

async function aoTocarBotao(psid: string, payload: string) {
  const alvo = lerPayload(payload)
  if (!alvo) return

  const supa = db()
  const { data: automacao } = await supa
    .from('automations')
    .select('id, name, active, steps, fb_steps, channels')
    .eq('id', alvo.automationId)
    .maybeSingle()

  if (!automacao?.active) return
  if (!lerCanais(automacao.channels).includes('facebook')) return

  const etapas = etapasDoCanal(automacao, 'facebook')
  if (alvo.step >= etapas.length) return

  if (etapas[alvo.step]?.require_follow) {
    await log('info', 'facebook', 'follow nao verificavel no facebook, liberado', {
      automation: automacao.name, recipient: psid, etapa: alvo.step + 1,
    })
  }

  const ciclo = (await cicloAtual(automacao.id, psid)) || 1

  const { error } = await supa.from('send_queue').insert({
    channel: 'facebook',
    automation_id: automacao.id,
    recipient_id: psid,
    kind: 'dm',
    step_index: alvo.step,
    cycle: ciclo,
  })

  if (error) {
    if (error.code === '23505') {
      await log('info', 'facebook', 'clique repetido ignorado', {
        automation: automacao.name, recipient: psid, etapa: alvo.step + 1,
      })
    } else {
      await log('error', 'facebook', 'falha ao enfileirar etapa', { erro: error.message })
    }
    return
  }

  await log('info', 'facebook', 'etapa enfileirada', {
    automation: automacao.name, recipient: psid, etapa: alvo.step + 1,
  })
}
