import { db } from '@/lib/db'
import { env } from '@/lib/env'
import type { Botao } from '@/lib/steps'

/**
 * Cliques em botao de link.
 *
 * O Instagram NAO avisa quando alguem toca num botao que abre uma pagina.
 * Para existir esse numero, o botao precisa apontar para um endereco nosso,
 * que registra a passagem e manda a pessoa para o destino em seguida.
 *
 * Cada botao enviado vira uma linha em `links`, com o destino real guardado.
 * Cada abertura vira uma linha em `link_clicks`. Sao dois numeros diferentes:
 * quantas pessoas clicaram e quantos cliques houve.
 */

const ALFABETO = 'abcdefghijkmnopqrstuvwxyz23456789'

function codigo(tamanho = 8): string {
  const bytes = new Uint8Array(tamanho)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => ALFABETO[b % ALFABETO.length]).join('')
}

/**
 * Troca a URL dos botoes de link por um endereco rastreavel.
 *
 * Se o registro falhar, devolve o botao com o link original: perder a
 * medicao e aceitavel, perder a mensagem nao.
 */
export async function rastrearBotoes(
  botoes: Botao[],
  automationId: string,
  stepIndex: number,
  recipientId: string | null,
  canal: 'instagram' | 'facebook' = 'instagram',
): Promise<Botao[]> {
  if (!botoes.some(b => b.type === 'web_url')) return botoes

  const supa = db()
  const base = env.baseUrl()

  return Promise.all(
    botoes.map(async botao => {
      if (botao.type !== 'web_url') return botao
      try {
        const code = codigo()
        const { error } = await supa.from('links').insert({
          code,
          automation_id: automationId,
          step_index: stepIndex,
          recipient_id: recipientId,
          url: botao.url,
          channel: canal,
        })
        if (error) return botao
        return { ...botao, url: `${base}/r/${code}` }
      } catch {
        return botao
      }
    }),
  )
}
