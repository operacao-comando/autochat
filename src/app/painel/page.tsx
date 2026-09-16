import { db } from '@/lib/db'
import { atualizarBancoSePreciso, dadosDoAssistente } from '@/lib/instalacao/assistente'
import Painel from './ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Painel' }

/** Janelas oferecidas no filtro. Qualquer outro valor cai em 7. */
const PERIODOS = [1, 7, 14, 30, 90]

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; conectado?: string; dias?: string; auto?: string; canal?: string }>
}) {
  const sp = await searchParams
  // Versao nova publicada: o banco se atualiza antes de ler qualquer coisa.
  await atualizarBancoSePreciso().catch(e => console.error('atualizar banco falhou', e))
  const supa = db()

  const dias = PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 7
  const autoFiltro = sp.auto && sp.auto !== 'todas' ? sp.auto : null
  const canalFiltro = sp.canal === 'instagram' || sp.canal === 'facebook' ? sp.canal : null

  // Corte do periodo. Vale para o dashboard e tambem para as listas de
  // historico -- o filtro e um so, para nao existirem duas "verdades"
  // diferentes na mesma tela.
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()

  let filaBase = supa
    .from('send_queue')
    .select('*, automations(name)')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(200)
  if (canalFiltro) filaBase = filaBase.eq('channel', canalFiltro)

  const [conta, pagina, autos, fila, logs, contatos, totalContatos, metricas, meta] = await Promise.all([
    supa.from('ig_account').select('*').eq('id', 1).maybeSingle(),
    // Sem o token: o painel e um componente de navegador.
    supa.from('fb_page').select('page_id, name, webhook_subscribed, connected_at').eq('id', 1).maybeSingle(),
    supa.from('automations').select('*').order('created_at', { ascending: false }),
    autoFiltro ? filaBase.eq('automation_id', autoFiltro) : filaBase,
    supa
      .from('event_log')
      .select('*')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(200),
    supa.from('contacts').select('*').order('last_seen_at', { ascending: false }).limit(500),
    supa.from('contacts').select('ig_user_id', { count: 'exact', head: true }),
    supa.rpc('dashboard_metricas', { p_dias: dias, p_automation: autoFiltro, p_canal: canalFiltro }),
    dadosDoAssistente(),
  ])

  const automacoes = autos.data ?? []
  const m = (metricas.data ?? {}) as Record<string, unknown>

  const envios = (m.envios ?? {}) as { enviados?: number }
  const contatosM = (m.contatos ?? {}) as { novos?: number }

  return (
    <Painel
      conta={conta.data}
      pagina={pagina.data}
      meta={meta}
      automacoes={automacoes}
      fila={fila.data ?? []}
      logs={logs.data ?? []}
      contatos={contatos.data ?? []}
      dias={dias}
      autoFiltro={autoFiltro}
      canalFiltro={canalFiltro}
      dash={m}
      erroDash={metricas.error?.message ?? null}
      metricas={{
        enviados7d: envios.enviados ?? 0,
        contatos7d: contatosM.novos ?? 0,
        contatosTotal: totalContatos.count ?? 0,
        ativas: automacoes.filter(a => a.active).length,
        totalEnvios: automacoes.reduce((soma, a) => soma + (a.sent_count ?? 0), 0),
      }}
      erro={sp.erro}
      conectado={sp.conectado === '1' ? 'instagram' : sp.conectado === 'facebook' ? 'facebook' : null}
    />
  )
}
