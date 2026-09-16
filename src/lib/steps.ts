/**
 * Fluxo linear de etapas.
 *
 * Cada automacao guarda um array de etapas em `automations.steps`.
 * Uma etapa pode ter varios botoes de LINK (`links`, cada um com label + url,
 * abre a pagina, nao avanca) mais um botao de AVANCAR (`next_label`, leva
 * para a proxima etapa). O Instagram aceita no maximo 3 botoes por mensagem
 * (`MAX_BOTOES`); se houver avancar, sobra espaco para 2 links, senao 3.
 */

export type LinkBotao = {
  label: string
  url: string
}

export type Step = {
  text: string
  /** Botoes de link desta etapa, na ordem em que aparecem. */
  links?: LinkBotao[] | null
  /** @deprecated formato antigo, um so link. Lido por compatibilidade. */
  button_label?: string | null
  /** @deprecated formato antigo, um so link. Lido por compatibilidade. */
  button_url?: string | null
  /** Rotulo do botao que leva para a proxima etapa. */
  next_label?: string | null
  /**
   * Se true, esta etapa so e liberada para quem realmente segue a conta.
   * A checagem e feita no Instagram, nao no clique do botao.
   */
  require_follow?: boolean | null
  /** Mensagem enviada a quem clicou sem seguir. Tem um padrao se vazia. */
  follow_reminder?: string | null
  /**
   * Audio enviado antes do texto desta etapa (link publico m4a/aac/wav/mp4).
   * Ignorado na primeira etapa: a resposta privada ao comentario so aceita
   * uma mensagem, e ela e o texto com os botoes.
   */
  audio_url?: string | null
}

/** Etapa vale se tiver texto ou audio. Etapa so com audio e permitida. */
export function etapaTemConteudo(e: Step): boolean {
  return !!e.text?.trim() || !!e.audio_url
}

/**
 * A Meta nao aceita botao sem texto. Etapa so com audio que tem botoes
 * manda este sinal apontando para o audio logo acima.
 */
export const TEXTO_SO_AUDIO = '👆'

/** Texto usado quando a etapa exige follow e o dono nao escreveu um proprio. */
export const LEMBRETE_FOLLOW_PADRAO =
  'Ainda nao te encontrei na minha lista de seguidores. Segue o perfil e toca no botao de novo.'

export type Botao =
  | { type: 'web_url'; title: string; url: string }
  | { type: 'postback'; title: string; payload: string }

const PREFIXO = 'STEP'
const MAX_TITULO = 20

export function montarPayload(automationId: string, proximaEtapa: number): string {
  return `${PREFIXO}:${automationId}:${proximaEtapa}`
}

export function lerPayload(payload: string): { automationId: string; step: number } | null {
  const partes = payload.split(':')
  if (partes.length !== 3 || partes[0] !== PREFIXO) return null
  const step = Number(partes[2])
  if (!partes[1] || !Number.isInteger(step) || step < 0) return null
  return { automationId: partes[1], step }
}

function lerLinks(bruto: unknown): LinkBotao[] {
  if (!Array.isArray(bruto)) return []
  return bruto
    .map(l => ({
      label: typeof l?.label === 'string' ? l.label : '',
      url: normalizarUrl(l?.url as string | null) ?? '',
    }))
    .filter(l => l.label.trim() || l.url.trim())
}

export function lerEtapas(bruto: unknown): Step[] {
  if (!Array.isArray(bruto)) return []
  return bruto
    .filter((s): s is Step => !!s && typeof (s as Step).text === 'string')
    .map(s => ({
      text: String(s.text),
      links: lerLinks(s.links),
      button_label: s.button_label ? String(s.button_label) : null,
      button_url: normalizarUrl(s.button_url as string | null),
      next_label: s.next_label ? String(s.next_label) : null,
      require_follow: s.require_follow === true,
      follow_reminder: s.follow_reminder ? String(s.follow_reminder) : null,
      audio_url: /^https:\/\//i.test(String(s.audio_url ?? '')) ? String(s.audio_url) : null,
    }))
}

/** Quantos botoes o Instagram aceita numa mensagem so. */
export const MAX_BOTOES = 3

/**
 * Monta os botoes de uma etapa, na ordem: links primeiro, avancar por
 * ultimo. O botao de avancar so existe se houver uma proxima etapa, e
 * reserva um lugar entre os no maximo `MAX_BOTOES` da mensagem — o resto
 * vai para os botoes de link, na ordem em que foram cadastrados.
 */
export function botoesDaEtapa(etapas: Step[], indice: number, automationId: string): Botao[] {
  const etapa = etapas[indice]
  if (!etapa) return []

  const botoes: Botao[] = []
  const proxima = indice + 1
  const temProxima = proxima < etapas.length

  const linksValidos = (etapa.links?.length ? etapa.links : legadoComoLink(etapa)).filter(
    l => l.label.trim() && normalizarUrl(l.url),
  )

  let rotuloAvancar = etapa.next_label?.trim()

  // Compatibilidade com o formato antigo: rotulo sem link significava avancar.
  if (!rotuloAvancar && !linksValidos.length && etapa.button_label && !etapa.button_url) {
    rotuloAvancar = etapa.button_label.trim()
  }

  const avancaVaiExistir = !!(rotuloAvancar && temProxima)
  const maxLinks = MAX_BOTOES - (avancaVaiExistir ? 1 : 0)

  for (const link of linksValidos.slice(0, maxLinks)) {
    botoes.push({
      type: 'web_url',
      title: link.label.trim().slice(0, MAX_TITULO),
      url: normalizarUrl(link.url) as string,
    })
  }

  if (avancaVaiExistir) {
    botoes.push({
      type: 'postback',
      title: rotuloAvancar!.slice(0, MAX_TITULO),
      payload: montarPayload(automationId, proxima),
    })
  }

  return botoes
}

/** Etapa do formato antigo (um so link) vista como lista de um item. */
function legadoComoLink(etapa: Step): LinkBotao[] {
  if (!etapa.button_label?.trim() || !etapa.button_url) return []
  return [{ label: etapa.button_label, url: etapa.button_url }]
}

/**
 * A Meta so aceita link com esquema. Endereco colado sem "https://"
 * (ex: www.site.com.br) e completado aqui em vez de virar botao quebrado.
 */
export function normalizarUrl(bruto?: string | null): string | null {
  const valor = bruto?.trim()
  if (!valor) return null

  // So o esquema, sem endereco: e o texto de exemplo, nao um link.
  const semEsquema = valor.replace(/^https?:\/\//i, '').replace(/^\/+/, '')
  if (!semEsquema) return null

  return /^https?:\/\//i.test(valor) ? valor : 'https://' + semEsquema
}

/** Modelo pronto de 5 etapas comecando pelo pedido de seguir. */
export function modeloCincoEtapas(usuario: string, link: string): Step[] {
  const perfil = `https://instagram.com/${usuario}`
  return [
    {
      text: `Oi! Vi seu comentario. Antes de te mandar o link, me segue aqui em @${usuario} pra nao perder nada. Ja seguiu?`,
      links: [{ label: 'Abrir meu perfil', url: perfil }],
      next_label: 'Ja segui',
    },
    {
      text: 'Show! Vou te explicar rapidinho o que voce vai receber.',
      links: [{ label: 'Ver a pagina', url: link }],
      next_label: 'Continuar',
    },
    {
      text: 'E um material direto ao ponto, feito pra voce aplicar hoje mesmo.',
      links: [{ label: 'Ver a pagina', url: link }],
      next_label: 'Quero ver',
    },
    {
      text: 'Ultima coisa: salva essa conversa pra conseguir voltar aqui depois.',
      links: [{ label: 'Ver a pagina', url: link }],
      next_label: 'Ja salvei',
    },
    {
      text: 'Prontinho! Aqui esta o seu link:',
      links: [{ label: 'Acessar agora', url: link }],
    },
  ]
}
