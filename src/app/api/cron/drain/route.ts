import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { env } from '@/lib/env'
import { cronAutorizado } from '@/lib/segredos'
import { sendAudio, sendDirectMessage, sendPrivateReply } from '@/lib/ig'
import { fbAudio, fbErroDePagina, fbMensagem, fbRespostaPrivada } from '@/lib/fb'
import { TEXTO_SO_AUDIO, botoesDaEtapa, type Botao } from '@/lib/steps'
import { etapasDoCanal } from '@/lib/canais'
import { dadosDaPessoa, personalizar, temMarcacao } from '@/lib/personalizar'
import { rastrearBotoes } from '@/lib/tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TENTATIVAS = 5
const AUDIO_OK = '[audio ok] '

export async function GET(req: Request) { return drain(req) }
export async function POST(req: Request) { return drain(req) }

async function drain(req: Request) {
  if (!(await cronAutorizado(req))) return new NextResponse('unauthorized', { status: 401 })

  const supa = db()
  const [{ data: account }, { data: pagina }] = await Promise.all([
    supa.from('ig_account').select('*').eq('id', 1).maybeSingle(),
    supa.from('fb_page').select('page_id, access_token').eq('id', 1).maybeSingle(),
  ])
  if (!account && !pagina) return NextResponse.json({ ok: false, motivo: 'sem conta conectada' })

  // --- teto de envios por hora (protege a conta de bloqueio) ---
  const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString()
  const { count: enviadosNaHora } = await supa
    .from('send_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', umaHoraAtras)

  const vagas = env.maxSendsPerHour() - (enviadosNaHora ?? 0)
  if (vagas <= 0) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: 'teto por hora atingido' })
  }

  const { data: fila } = await supa
    .from('send_queue')
    .select('*, automations(*)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(Math.min(vagas, 25))

  let enviados = 0
  let falhas = 0

  for (const item of fila ?? []) {
    // trava otimista: so processa se ainda estiver 'pending'
    const { data: travado } = await supa
      .from('send_queue')
      .update({ status: 'sending' })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (!travado) continue

    const auto = item.automations
    if (!auto || !auto.active) {
      await supa.from('send_queue').update({ status: 'skipped' }).eq('id', item.id)
      continue
    }

    const canal: 'instagram' | 'facebook' = item.channel === 'facebook' ? 'facebook' : 'instagram'

    // O Facebook pode ter fluxo proprio (fb_steps).
    const etapas = etapasDoCanal(auto, canal)
    const etapa = etapas[item.step_index ?? 0]
    if (!etapa) {
      await supa.from('send_queue').update({ status: 'skipped' }).eq('id', item.id)
      continue
    }

    // O teto por hora e um so para os dois canais; a conexao e por canal.
    // Item de canal desconectado espera a conexao voltar, sem gastar tentativa.
    const envio = canal === 'facebook'
      ? pagina && {
          respostaPrivada: (commentId: string, texto: string, b: Botao[]) =>
            fbRespostaPrivada(pagina.page_id, pagina.access_token, commentId, texto, b),
          mensagem: (texto: string, b: Botao[]) =>
            fbMensagem(pagina.page_id, pagina.access_token, item.recipient_id, texto, b),
          audio: (url: string) => fbAudio(pagina.page_id, pagina.access_token, item.recipient_id, url),
        }
      : account && {
          respostaPrivada: (commentId: string, texto: string, b: Botao[]) =>
            sendPrivateReply(account.ig_user_id, account.access_token, commentId, texto, b),
          mensagem: (texto: string, b: Botao[]) =>
            sendDirectMessage(account.ig_user_id, account.access_token, item.recipient_id, texto, b),
          audio: (url: string) => sendAudio(account.ig_user_id, account.access_token, item.recipient_id, url),
        }

    if (!envio) {
      await supa.from('send_queue').update({
        status: 'pending',
        scheduled_for: new Date(Date.now() + 10 * 60_000).toISOString(),
        last_error: `${canal} sem conexao`,
      }).eq('id', item.id)
      await log('warn', 'cron', 'envio adiado: canal sem conexao', { id: item.id, canal })
      continue
    }

    const botoesBrutos = botoesDaEtapa(etapas, item.step_index ?? 0, auto.id)
    const botoes = await rastrearBotoes(botoesBrutos, auto.id, item.step_index ?? 0, item.recipient_id, canal)

    // Se o audio ja saiu numa tentativa anterior e so o texto falhou, nao reenvia.
    let audioEnviado = String(item.last_error ?? '').startsWith(AUDIO_OK)

    // {nome}/{usuario} e **negrito**. So consulta a pessoa quando o texto pede.
    const pessoa = temMarcacao(etapa.text)
      ? await dadosDaPessoa(item.recipient_id, account?.access_token ?? '', canal)
      : { nome: null, usuario: null }
    const textoFinal = personalizar(etapa.text, pessoa)

    try {
      if (item.kind === 'private_reply' && item.comment_id) {
        await envio.respostaPrivada(item.comment_id, textoFinal, botoes)
      } else {
        const temTexto = !!etapa.text.trim()
        if (etapa.audio_url && !audioEnviado) {
          try {
            await envio.audio(etapa.audio_url)
            audioEnviado = true
          } catch (e) {
            // Etapa so com audio: sem ele nao ha o que mandar, entao tenta de novo.
            if (!temTexto) throw e
            // Com texto, o audio com problema nao pode travar o link.
            await log('error', 'cron', 'audio falhou, texto segue', { id: item.id, erro: String(e) })
          }
        }
        if (temTexto || botoes.length) {
          const texto = temTexto ? textoFinal : TEXTO_SO_AUDIO
          await envio.mensagem(texto, botoes)
        }
      }

      await supa.from('send_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', item.id)

      await supa.rpc('bump_counters', { p_automation: auto.id, p_contact: item.recipient_id })
      enviados++
    } catch (e) {
      falhas++
      const tentativas = (item.attempts ?? 0) + 1
      // Comentario feito por Pagina: a Meta recusa sempre, nao adianta repetir.
      const esgotou = tentativas >= MAX_TENTATIVAS || fbErroDePagina(String(e))
      await supa.from('send_queue').update({
        status: esgotou ? 'failed' : 'pending',
        attempts: tentativas,
        last_error: ((audioEnviado ? AUDIO_OK : '') + String(e)).slice(0, 500),
        scheduled_for: new Date(Date.now() + tentativas * 5 * 60_000).toISOString(),
      }).eq('id', item.id)
      await log('error', 'cron', 'envio falhou', { id: item.id, canal, tentativas, erro: String(e) })
    }
  }

  return NextResponse.json({ ok: true, enviados, falhas, vagas })
}
