'use client'

import { useRouter } from 'next/navigation'

/**
 * Tela de dados e o filtro de periodo.
 *
 * Fica em arquivo separado do ui.tsx de proposito: o painel ja e grande e
 * estas duas pecas sao usadas em mais de uma tela.
 */

export type Dash = {
  periodo?: { dias: number; inicio: string; fim: string }
  comentarios?: { recebidos: number; sem_automacao: number; follow_ok: number; follow_bloqueado: number }
  envios?: { enviados: number; falhados: number; pulados: number; pendentes: number; pessoas: number }
  funil?: { etapa: number; pessoas: number; envios: number }[]
  cliques?: { total: number; pessoas: number; links_enviados: number }
  cliques_por_etapa?: { etapa: number; cliques: number; pessoas: number }[]
  contatos?: { novos: number; total: number }
  seguidores?: { serie: { dia: string; total: number }[]; inicio: number | null; fim: number | null; ganho: number }
  por_dia?: { dia: string; enviados: number; cliques: number; contatos: number }[]
}

type AutoLite = { id: string; name: string }

const cartao = 'rounded-xl border border-[var(--rule)] bg-[var(--surface)]'

const PERIODOS: [number, string][] = [
  [1, 'Hoje'],
  [7, '7 dias'],
  [14, '14 dias'],
  [30, '30 dias'],
  [90, '90 dias'],
]

/**
 * Periodo e automacao ficam na URL, nao no estado do componente.
 * Assim o filtro sobrevive a recarregar a pagina e o servidor ja devolve os
 * dados certos, sem uma segunda consulta no navegador.
 */
export function Filtros({
  dias,
  autoFiltro,
  canalFiltro,
  automacoes,
}: {
  dias: number
  autoFiltro: string | null
  canalFiltro: string | null
  automacoes: AutoLite[]
}) {
  const router = useRouter()

  const ir = (novosDias: number, novaAuto: string | null, novoCanal: string | null = canalFiltro) => {
    const p = new URLSearchParams()
    p.set('dias', String(novosDias))
    if (novaAuto) p.set('auto', novaAuto)
    if (novoCanal) p.set('canal', novoCanal)
    router.push(`/painel?${p}`)
  }

  return (
    <div className="mb-4 mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {PERIODOS.map(([n, rotulo]) => (
          <button
            key={n}
            onClick={() => ir(n, autoFiltro)}
            className={
              'rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors md:py-1.5 ' +
              (n === dias
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--rule-strong)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--ground)]')
            }
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={canalFiltro ?? 'todos'}
          onChange={e => ir(dias, autoFiltro, e.target.value === 'todos' ? null : e.target.value)}
          className="rounded-lg border border-[var(--rule-strong)] bg-[var(--surface)] px-3 py-2.5 text-base md:py-1.5 md:text-[13px]"
        >
          <option value="todos">Instagram + Facebook</option>
          <option value="instagram">Só Instagram</option>
          <option value="facebook">Só Facebook</option>
        </select>
        <select
          value={autoFiltro ?? 'todas'}
          onChange={e => ir(dias, e.target.value === 'todas' ? null : e.target.value)}
          className="rounded-lg border border-[var(--rule-strong)] bg-[var(--surface)] px-3 py-2.5 text-base md:py-1.5 md:text-[13px]"
        >
          <option value="todas">Todas as automações</option>
          {automacoes.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function Numero({
  valor,
  rotulo,
  ajuda,
  destaque,
}: {
  valor: number | string
  rotulo: string
  ajuda?: string
  destaque?: boolean
}) {
  return (
    <div className={cartao + ' p-4'}>
      <div className={'text-[26px] font-bold leading-none ' + (destaque ? 'text-[var(--accent)]' : '')}>
        {valor}
      </div>
      <div className="mt-1.5 text-[13px] font-semibold text-[var(--ink)]">{rotulo}</div>
      {ajuda ? <div className="mt-0.5 text-[12px] leading-snug text-[var(--ink-soft)]">{ajuda}</div> : null}
    </div>
  )
}

/** Barra horizontal simples: evita carregar uma biblioteca de grafico inteira. */
function Barra({ valor, maximo, cor = 'var(--accent)' }: { valor: number; maximo: number; cor?: string }) {
  const pct = maximo > 0 ? Math.round((valor / maximo) * 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--rule)]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
    </div>
  )
}

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function Dashboard({
  dash,
  erro,
  dias,
  autoFiltro,
  canalFiltro,
  automacoes,
}: {
  dash: Dash
  erro: string | null
  dias: number
  autoFiltro: string | null
  canalFiltro: string | null
  automacoes: AutoLite[]
}) {
  const com = dash.comentarios ?? { recebidos: 0, sem_automacao: 0, follow_ok: 0, follow_bloqueado: 0 }
  const env = dash.envios ?? { enviados: 0, falhados: 0, pulados: 0, pendentes: 0, pessoas: 0 }
  const cli = dash.cliques ?? { total: 0, pessoas: 0, links_enviados: 0 }
  const seg = dash.seguidores ?? { serie: [], inicio: null, fim: null, ganho: 0 }
  const funil = dash.funil ?? []
  const porEtapa = dash.cliques_por_etapa ?? []
  const porDia = dash.por_dia ?? []

  const cliquesEtapa = new Map(porEtapa.map(e => [e.etapa, e]))
  const baseFunil = funil[0]?.pessoas ?? 0
  const maxDia = Math.max(1, ...porDia.map(d => Math.max(d.enviados, d.cliques)))
  const maxSeg = Math.max(1, ...seg.serie.map(x => x.total))

  // Quem clicou, sobre quem recebeu. E a pergunta que interessa: a mensagem
  // convence ou nao.
  const taxaClique = env.pessoas > 0 ? Math.round((cli.pessoas / env.pessoas) * 100) : 0

  return (
    <>
      <h1 className="text-[22px] font-bold md:text-[28px]">Dados</h1>
      <Filtros dias={dias} autoFiltro={autoFiltro} canalFiltro={canalFiltro} automacoes={automacoes} />

      {erro ? (
        <div className={cartao + ' mb-4 border-[var(--erro-rule)] bg-[var(--erro-bg)] p-4 text-[13px] text-[var(--erro-ink)]'}>
          Não consegui carregar as métricas: {erro}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero valor={env.pessoas} rotulo="Pessoas alcançadas" ajuda="receberam ao menos uma DM" destaque />
        <Numero valor={env.enviados} rotulo="Mensagens enviadas" ajuda="somando todas as etapas" />
        <Numero valor={cli.pessoas} rotulo="Clicaram no link" ajuda={`${taxaClique}% de quem recebeu`} />
        <Numero
          valor={seg.ganho > 0 ? '+' + seg.ganho : seg.ganho}
          rotulo="Seguidores no período"
          // A leitura mais recente, nao o `fim` da funcao (que e o maior valor do periodo).
          ajuda={seg.serie.length ? `hoje: ${seg.serie[seg.serie.length - 1].total}` : 'primeira leitura ainda não aconteceu'}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero valor={com.recebidos} rotulo="Comentários recebidos" ajuda="da conta inteira" />
        <Numero valor={com.sem_automacao} rotulo="Sem palavra-chave" ajuda="comentário não casou" />
        <Numero valor={com.follow_bloqueado} rotulo="Barrados por não seguir" />
        <Numero valor={env.falhados} rotulo="Falhas de envio" />
      </div>

      <div className={cartao + ' mt-5 p-4 md:p-5'}>
        <h2 className="text-[15px] font-bold">Onde as pessoas param</h2>
        <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
          Cada linha é uma etapa da conversa. A queda de uma para a outra é quem desistiu no caminho.
        </p>

        {funil.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--ink-soft)]">Nenhum envio no período.</p>
        ) : (
          <div className="mt-4 space-y-3.5">
            {funil.map(f => {
              const cl = cliquesEtapa.get(f.etapa)
              const pct = baseFunil > 0 ? Math.round((f.pessoas / baseFunil) * 100) : 0
              return (
                <div key={f.etapa}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-semibold">Etapa {f.etapa + 1}</span>
                    <span className="text-[var(--ink-soft)]">
                      {f.pessoas} {f.pessoas === 1 ? 'pessoa' : 'pessoas'} · {pct}%
                      {cl && cl.pessoas > 0 ? ` · ${cl.pessoas} clicaram` : ''}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Barra valor={f.pessoas} maximo={baseFunil} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className={cartao + ' mt-4 p-4 md:p-5'}>
        <h2 className="text-[15px] font-bold">Dia a dia</h2>
        <div className="mt-4 space-y-2">
          {porDia.map(d => (
            <div key={d.dia} className="flex items-center gap-3 text-[12px]">
              <span className="w-12 shrink-0 text-[var(--ink-soft)]">{diaMes(d.dia)}</span>
              <div className="flex-1">
                <Barra valor={d.enviados} maximo={maxDia} />
              </div>
              <span className="w-7 shrink-0 text-right font-semibold">{d.enviados}</span>
              <div className="hidden flex-1 sm:block">
                <Barra valor={d.cliques} maximo={maxDia} cor="var(--ok-ink)" />
              </div>
              <span className="hidden w-7 shrink-0 text-right font-semibold text-[var(--ok-ink)] sm:inline">
                {d.cliques}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[var(--ink-soft)]">
          Azul: mensagens enviadas. Verde: cliques no link.
        </p>
      </div>

      <div className={cartao + ' mt-4 p-4 md:p-5'}>
        <h2 className="text-[15px] font-bold">Seguidores</h2>
        {seg.serie.length === 0 ? (
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
            Ainda não há leitura. O total de seguidores é lido uma vez por dia, e a curva começa
            na primeira leitura — o Instagram não fornece o histórico anterior.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {seg.serie.map(s => (
              <div key={s.dia} className="flex items-center gap-3 text-[12px]">
                <span className="w-12 shrink-0 text-[var(--ink-soft)]">{diaMes(s.dia)}</span>
                <div className="flex-1">
                  <Barra valor={s.total} maximo={maxSeg} cor="var(--brand)" />
                </div>
                <span className="w-14 shrink-0 text-right font-semibold">{s.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {cli.links_enviados === 0 ? (
        <p className="mt-4 text-[12px] leading-relaxed text-[var(--ink-soft)]">
          Nenhum link rastreável foi enviado no período. O clique só passa a ser contado nas
          mensagens enviadas a partir desta atualização.
        </p>
      ) : null}
    </>
  )
}
