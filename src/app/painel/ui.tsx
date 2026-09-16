'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChartNoAxesColumn,
  Check,
  ChevronLeft,
  Home,
  Inbox,
  AtSign,
  ListChecks,
  LogOut,
  Mic,
  Copy,
  Plus,
  RotateCcw,
  Settings,
  Square,
  Trash2,
  Upload,
  Users,
  Zap,
} from 'lucide-react'

import AlternarTema from './tema'
import type { Step } from '@/lib/steps'
import { lerCanais } from '@/lib/canais'
import { MAX_SEGUNDOS, iniciarGravacao, type Gravacao } from './gravador'
import PreviewCelular from './previewcelular'
import { Dashboard, Filtros, type Dash } from './dashboard'

type Conta = {
  ig_user_id: string
  username: string | null
  token_expires_at: string | null
  webhook_subscribed: boolean
} | null

type Pagina = {
  page_id: string
  name: string | null
  webhook_subscribed: boolean
  connected_at: string
} | null

type Canal = 'instagram' | 'facebook'

type Auto = {
  id: string
  name: string
  keywords: string[]
  match_mode: string
  media_id: string | null
  fb_post_id: string | null
  fb_steps: Step[] | null
  channels: string[] | null
  comment_reply_text: string | null
  steps: Step[] | null
  dm_text: string
  active: boolean
  sent_count: number
}

type FilaItem = {
  id: string
  recipient_id: string
  status: string
  step_index: number | null
  created_at: string
  channel?: string
  automations?: { name: string } | null
}

type LogItem = {
  id: number
  created_at: string
  source: string
  message: string | null
  payload: Record<string, unknown> | null
}

type Contato = {
  ig_user_id: string
  username: string | null
  first_seen_at: string
  last_seen_at: string
  dm_count: number
  channel?: string
}

/** Como mostrar a pessoa: no Instagram vem o @, no Facebook vem o nome. */
function nomeDoContato(c: { username: string | null; ig_user_id: string; channel?: string }) {
  if (!c.username) return c.ig_user_id
  return c.channel === 'facebook' ? c.username : '@' + c.username
}

function rotuloCanais(canais: string[] | null | undefined) {
  const lista = lerCanais(canais)
  return lista.map(c => (c === 'facebook' ? 'Facebook' : 'Instagram')).join(' + ')
}

type Metricas = {
  enviados7d: number
  contatos7d: number
  contatosTotal: number
  ativas: number
  totalEnvios: number
}

type Tela = 'inicio' | 'dados' | 'automacoes' | 'contatos' | 'historico' | 'config'

const campo =
  'w-full rounded-lg border border-[var(--rule-strong)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none transition-colors focus:border-[var(--accent)] md:py-2 md:text-sm'
const rotulo = 'block text-[13px] font-semibold text-[var(--ink)]'
const cartao = 'rounded-xl border border-[var(--rule)] bg-[var(--surface)]'

const etapaVazia = (): Step => ({ text: '', links: [{ label: '', url: '' }], next_label: '' })

export default function Painel({
  conta,
  pagina,
  automacoes,
  fila,
  logs,
  contatos,
  metricas,
  dias,
  autoFiltro,
  canalFiltro,
  dash,
  erroDash,
  erro,
  conectado,
}: {
  conta: Conta
  pagina: Pagina
  automacoes: Auto[]
  fila: FilaItem[]
  logs: LogItem[]
  contatos: Contato[]
  metricas: Metricas
  dias: number
  autoFiltro: string | null
  canalFiltro: string | null
  dash: Dash
  erroDash: string | null
  erro?: string
  conectado: Canal | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [tela, setTela] = useState<Tela>('inicio')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const recarregar = () => startTransition(() => router.refresh())
  const editando = automacoes.find(a => a.id === editandoId) ?? null

  useEffect(() => {
    if (editandoId && !editando) setEditandoId(null)
  }, [editandoId, editando])

  async function novaAutomacao() {
    const r = await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rascunho: true }),
    })
    const j = await r.json()
    if (!r.ok) return setAviso(j.erro || 'Erro ao criar.')
    setEditandoId(j.id)
    setTela('automacoes')
    recarregar()
  }

  return (
    <div className="flex min-h-dvh bg-[var(--ground)] text-[var(--ink)]">
      <Menu tela={tela} irPara={(t) => { setTela(t); setEditandoId(null) }} conta={conta} pagina={pagina} metricas={metricas} />

      <main className="min-w-0 flex-1">
        <TopoCelular conta={conta} />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-6 md:py-7 md:pb-7">
          {erro ? <Faixa tom="erro">Erro: {erro}</Faixa> : null}
          {conectado === 'instagram' ? <Faixa tom="ok">Instagram conectado com sucesso.</Faixa> : null}
          {conectado === 'facebook' ? (
            <Faixa tom="ok">Página do Facebook conectada com sucesso.</Faixa>
          ) : null}
          {aviso ? <Faixa tom="ok">{aviso}</Faixa> : null}

          {editando ? (
            <Editor
              key={editando.id}
              auto={editando}
              perfil={conta?.username || 'seuperfil'}
              temInstagram={!!conta}
              temFacebook={!!pagina}
              paginaNome={pagina?.name ?? null}
              paginaUrl={pagina ? `https://www.facebook.com/${pagina.page_id}` : null}
              aoFechar={() => setEditandoId(null)}
              aoSalvar={recarregar}
            />
          ) : (
            <>
              {tela === 'inicio' ? (
                <Inicio
                  conta={conta}
                  metricas={metricas}
                  automacoes={automacoes}
                  aoCriar={novaAutomacao}
                  irPara={setTela}
                />
              ) : null}
              {tela === 'dados' ? (
                <Dashboard
                  dash={dash}
                  erro={erroDash}
                  dias={dias}
                  autoFiltro={autoFiltro}
                  canalFiltro={canalFiltro}
                  automacoes={automacoes}
                />
              ) : null}
              {tela === 'automacoes' ? (
                <Automacoes
                  automacoes={automacoes}
                  aoCriar={novaAutomacao}
                  aoEditar={setEditandoId}
                  aoMudar={recarregar}
                />
              ) : null}
              {tela === 'contatos' ? (
                <Contatos contatos={contatos} total={metricas.contatosTotal} />
              ) : null}
              {tela === 'historico' ? (
                <Historico
                  fila={fila}
                  logs={logs}
                  contatos={contatos}
                  dias={dias}
                  autoFiltro={autoFiltro}
                  canalFiltro={canalFiltro}
                  automacoes={automacoes}
                />
              ) : null}
              {tela === 'config' ? <Config conta={conta} pagina={pagina} /> : null}
            </>
          )}
        </div>
      </main>

      <BarraCelular tela={tela} irPara={(t) => { setTela(t); setEditandoId(null) }} />
    </div>
  )
}

// ------------------------------------------------ celular: topo e barra

const ITENS_MENU: [Tela, string, typeof Home][] = [
  ['inicio', 'Inicial', Home],
  ['dados', 'Dados', ChartNoAxesColumn],
  ['automacoes', 'Automações', Zap],
  ['contatos', 'Contatos', Users],
  ['historico', 'Histórico', Inbox],
  ['config', 'Ajustes', Settings],
]

/** Cabecalho que substitui o menu lateral no celular. */
function TopoCelular({ conta }: { conta: Conta }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-[var(--rule)] bg-[var(--surface)] px-4 py-3 md:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.png" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-tight">Autochat</p>
        <p className="truncate text-[12px] text-[var(--ink-soft)]">
          {conta?.username ? '@' + conta.username : 'sem conta conectada'}
        </p>
      </div>
      <form action="/api/auth/logout" method="post">
        <button
          aria-label="Sair"
          className="grid h-10 w-10 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--ground)]"
        >
          <LogOut size={18} />
        </button>
      </form>
    </header>
  )
}

/**
 * Barra inferior com os mesmos cinco destinos do menu lateral.
 * Alvo de toque de 44px: abaixo disso o dedo erra o icone.
 */
function BarraCelular({ tela, irPara }: { tela: Tela; irPara: (t: Tela) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-[var(--rule)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:hidden">
      {ITENS_MENU.map(([id, nome, Icone]) => (
        <button
          key={id}
          type="button"
          onClick={() => irPara(id)}
          className={
            'flex h-[58px] flex-col items-center justify-center gap-1 px-0.5 text-[10px] leading-tight ' +
            (tela === id ? 'font-semibold text-[var(--accent)]' : 'text-[var(--ink-soft)]')
          }
        >
          <Icone size={20} />
          {nome}
        </button>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------- menu

/** "f" do Facebook em SVG, pelo mesmo motivo do icone do Instagram. */
function IconeFacebook({ tamanho = 16 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.4V14h2.7v8h3.4z" />
    </svg>
  )
}

/** Camera do Instagram em SVG: o pacote de icones desta versao nao traz. */
function IconeInstagram({ tamanho = 16 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Menu({
  tela,
  irPara,
  conta,
  pagina,
  metricas,
}: {
  tela: Tela
  irPara: (t: Tela) => void
  conta: Conta
  pagina: Pagina
  metricas: Metricas
}) {
  const itens: [Tela, string, typeof Home][] = [
    ['inicio', 'Inicial', Home],
    ['dados', 'Dados', ChartNoAxesColumn],
    ['automacoes', 'Automações', Zap],
    ['contatos', 'Contatos', Users],
    ['historico', 'Histórico', Inbox],
    ['config', 'Configurações', Settings],
  ]

  return (
    <aside className="sticky top-0 hidden h-dvh w-[230px] shrink-0 flex-col border-r border-[var(--rule)] bg-[var(--surface)] md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="" className="h-8 w-8 rounded-lg" />
        <span className="font-semibold">Autochat</span>
      </div>

      <div className="mx-3 mb-2 flex items-center gap-2.5 rounded-lg bg-[var(--ground)] px-3 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-tr from-[#fdc468] via-[#df4996] to-[#5b51d8] text-white">
          <IconeInstagram />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">
            {conta?.username ? '@' + conta.username : 'sem conta'}
          </p>
          <p className="text-[11px] text-[var(--ink-soft)]">
            {conta?.webhook_subscribed ? 'conectada' : 'desconectada'}
          </p>
        </div>
      </div>

      <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-lg bg-[var(--ground)] px-3 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#1877f2] text-white">
          <IconeFacebook />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{pagina?.name ?? 'sem Página'}</p>
          <p className="text-[11px] text-[var(--ink-soft)]">
            {pagina?.webhook_subscribed ? 'conectada' : 'desconectada'}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {itens.map(([id, nome, Icone]) => (
          <button
            key={id}
            type="button"
            onClick={() => irPara(id)}
            className={
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ' +
              (tela === id
                ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                : 'text-[var(--ink-soft)] hover:bg-[var(--ground)]')
            }
          >
            <Icone size={17} />
            {nome}
          </button>
        ))}
      </nav>

      <div className="border-t border-[var(--rule)] p-3">
        <div className="rounded-lg bg-[var(--ground)] px-3 py-2.5 text-[12px] text-[var(--ink-soft)]">
          <p className="font-medium text-[var(--ink)]">Plano gratuito</p>
          <p className="mt-0.5">{metricas.totalEnvios} mensagens enviadas</p>
          <p>sem mensalidade</p>
        </div>
        <form action="/api/auth/logout" method="post" className="mt-2">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--ink-soft)] hover:bg-[var(--ground)]">
            <LogOut size={17} />
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}

function Faixa({ tom, children }: { tom: 'ok' | 'erro'; children: React.ReactNode }) {
  const cor =
    tom === 'erro'
      ? 'border-[var(--erro-rule)] bg-[var(--erro-bg)] text-[var(--erro-ink)]'
      : 'border-[var(--ok-rule)] bg-[var(--ok-bg)] text-[var(--ok-ink)]'
  return <p className={`mb-5 rounded-lg border px-4 py-3 text-sm ${cor}`}>{children}</p>
}

// ---------------------------------------------------------------- inicio

function Inicio({
  conta,
  metricas,
  automacoes,
  aoCriar,
  irPara,
}: {
  conta: Conta
  metricas: Metricas
  automacoes: Auto[]
  aoCriar: () => void
  irPara: (t: Tela) => void
}) {
  return (
    <>
      <h1 className="text-[22px] font-bold md:text-[28px]">
        Olá{conta?.username ? ', ' + conta.username : ''}!
      </h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        {metricas.ativas} automação(ões) ativa(s) · {metricas.contatosTotal} contatos
      </p>

      {!conta ? (
        <div className={`${cartao} mt-6 p-6`}>
          <h2 className="font-semibold">Conecte o seu Instagram</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Sem a conexão, nenhuma automação dispara.
          </p>
          <a
            href="/api/oauth/instagram"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
          >
            <AtSign size={16} /> Conectar Instagram
          </a>
        </div>
      ) : null}

      <h2 className="mt-8 text-[17px] font-semibold">Comece aqui</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <CardAcao
          titulo="Enviar links por DM a partir dos comentários"
          texto="Alguém comenta a palavra-chave e recebe o seu link no direct."
          etiqueta="Popular"
          aoClicar={aoCriar}
        />
        <CardAcao
          titulo="Pedir para seguir antes do link"
          texto="Primeira mensagem pede o follow. O link só sai depois do clique."
          aoClicar={aoCriar}
        />
        <CardAcao
          titulo="Ver quem já recebeu"
          texto="Histórico com cada envio, etapa e horário."
          aoClicar={() => irPara('historico')}
        />
      </div>

      <h2 className="mt-8 text-[17px] font-semibold">Seus últimos 7 dias</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <CardMetrica
          titulo="Mensagens enviadas"
          valor={metricas.enviados7d}
          icone={ChartNoAxesColumn}
          aoClicar={() => irPara('historico')}
        />
        <CardMetrica
          titulo="Contatos novos"
          valor={metricas.contatos7d}
          icone={Users}
          aoClicar={() => irPara('contatos')}
        />
        <CardMetrica
          titulo="Automações ativas"
          valor={metricas.ativas}
          icone={Zap}
          aoClicar={() => irPara('automacoes')}
        />
      </div>

      {automacoes.length > 0 ? (
        <>
          <h2 className="mt-8 text-[17px] font-semibold">Suas automações</h2>
          <div className={`${cartao} mt-3 divide-y divide-[var(--rule)]`}>
            {automacoes.slice(0, 4).map(a => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-[12px] text-[var(--ink-soft)]">
                    {a.keywords.length ? a.keywords.join(', ') : 'sem palavra-chave'}
                  </p>
                </div>
                <Selo ativo={a.active} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  )
}

function CardAcao({
  titulo,
  texto,
  etiqueta,
  aoClicar,
}: {
  titulo: string
  texto: string
  etiqueta?: string
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={`${cartao} p-5 text-left transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{titulo}</p>
        {etiqueta ? (
          <span className="shrink-0 rounded bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--brand-ink)]">
            {etiqueta}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">{texto}</p>
    </button>
  )
}

function CardMetrica({
  titulo,
  valor,
  icone: Icone,
  aoClicar,
}: {
  titulo: string
  valor: number
  icone: typeof Users
  aoClicar?: () => void
}) {
  const corpo = (
    <>
      <div className="flex items-center gap-2 text-[var(--ink-soft)]">
        <Icone size={16} />
        <p className="text-[13px]">{titulo}</p>
      </div>
      <p className="mt-2 text-3xl font-bold">{valor}</p>
      {aoClicar ? <p className="mt-1 text-[12px] text-[var(--accent)]">Ver detalhes</p> : null}
    </>
  )

  if (!aoClicar) return <div className={`${cartao} p-5`}>{corpo}</div>

  return (
    <button
      type="button"
      onClick={aoClicar}
      className={`${cartao} p-5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-2)]`}
    >
      {corpo}
    </button>
  )
}

function Selo({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={
        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
        (ativo ? 'bg-[var(--ok-bg)] text-[var(--ok-ink)]' : 'bg-[var(--ground)] text-[var(--ink-soft)]')
      }
    >
      {ativo ? 'Ativa' : 'Pausada'}
    </span>
  )
}

// ---------------------------------------------------------------- automacoes

function Automacoes({
  automacoes,
  aoCriar,
  aoEditar,
  aoMudar,
}: {
  automacoes: Auto[]
  aoCriar: () => void
  aoEditar: (id: string) => void
  aoMudar: () => void
}) {
  async function excluir(a: Auto) {
    if (!confirm(`Excluir "${a.name}"? Não dá para desfazer.`)) return
    await fetch('/api/automations/' + a.id, { method: 'DELETE' })
    aoMudar()
  }

  /**
   * Copia uma automacao para servir de molde. A copia nasce pausada e sem
   * palavra-chave: so falta digitar a palavra nova e ativar.
   */
  async function duplicar(a: Auto) {
    const r = await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duplicar: a.id }),
    })
    const j = await r.json()
    if (!r.ok) return alert(j.erro || 'Não foi possível duplicar.')
    // Recarrega a lista: sem isto a copia nasce no banco e a tela nao muda,
    // o que faz a pessoa clicar de novo e criar varias copias iguais.
    aoMudar()
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold md:text-[28px]">Automações</h1>
        <button
          type="button"
          onClick={aoCriar}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
        >
          <Plus size={16} /> Nova automação
        </button>
      </div>

      {automacoes.length === 0 ? (
        <div className={`${cartao} mt-6 p-10 text-center`}>
          <p className="text-sm text-[var(--ink-soft)]">Nenhuma automação ainda.</p>
        </div>
      ) : (
        <div className={`${cartao} mt-6 divide-y divide-[var(--rule)]`}>
          {automacoes.map(a => (
            <div
              key={a.id}
              /* No celular o nome fica em cima e as acoes embaixo: em uma
                 linha so, o nome era espremido ate virar "Autoc...".
                 md:contents devolve os botoes para a linha unica no
                 computador, onde ha largura de sobra. */
              className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-5 md:py-3.5"
            >
              <button
                type="button"
                onClick={() => aoEditar(a.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="font-medium leading-snug md:truncate">{a.name}</p>
                <p className="text-[12px] leading-snug text-[var(--ink-soft)] md:truncate">
                  {rotuloCanais(a.channels)} ·{' '}
                  {a.keywords.length ? a.keywords.join(', ') : 'sem palavra-chave'} ·{' '}
                  {(a.steps?.length ?? 0) || 1} etapa(s) · {a.sent_count} envio(s)
                </p>
              </button>
              <div className="flex items-center gap-2 md:contents">
              <Selo ativo={a.active} />
              <button
                type="button"
                onClick={() => aoEditar(a.id)}
                className="rounded-lg border border-[var(--rule-strong)] px-3 py-1.5 text-[13px] hover:bg-[var(--ground)]"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => duplicar(a)}
                aria-label={`Duplicar ${a.name}`}
                title="Duplicar: copia as etapas, sem a palavra-chave"
                className="grid h-9 w-9 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--ground)] md:h-auto md:w-auto md:p-2"
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                onClick={() => excluir(a)}
                aria-label={`Excluir ${a.name}`}
                className="grid h-9 w-9 place-items-center rounded-lg text-[var(--erro-ink)] hover:bg-[var(--erro-bg)] md:h-auto md:w-auto md:p-2"
              >
                <Trash2 size={16} />
              </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------- editor

function Editor({
  auto,
  perfil,
  temInstagram,
  temFacebook,
  paginaNome,
  paginaUrl,
  aoFechar,
  aoSalvar,
}: {
  auto: Auto
  perfil: string
  temInstagram: boolean
  temFacebook: boolean
  paginaNome: string | null
  paginaUrl: string | null
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const [nome, setNome] = useState(auto.name)
  const [palavras, setPalavras] = useState(auto.keywords.join(', '))
  const [modo, setModo] = useState(auto.match_mode)
  const [canais, setCanais] = useState<Canal[]>(lerCanais(auto.channels))
  const [mediaId, setMediaId] = useState(auto.media_id ?? '')
  const [fbPostId, setFbPostId] = useState(auto.fb_post_id ?? '')
  const noInstagram = canais.includes('instagram')
  const noFacebook = canais.includes('facebook')

  /** Marca ou desmarca um canal. Pelo menos um fica sempre marcado. */
  function alternarCanal(c: Canal) {
    setCanais(atual => {
      if (atual.includes(c)) return atual.length > 1 ? atual.filter(x => x !== c) : atual
      return lerCanais([...atual, c])
    })
  }
  const [respostaComentario, setRespostaComentario] = useState(auto.comment_reply_text ?? '')

  // Dois fluxos por automacao: o do Instagram (com trava de seguir) e o do
  // Facebook (sem trava, porque a Meta nao informa quem segue a Pagina).
  // Automacao antiga, sem fluxo do Facebook, comeca com uma copia sem trava.
  const [etapasIg, setEtapasIg] = useState<Step[]>(
    auto.steps?.length ? auto.steps.map(e => ({ ...e })) : [etapaVazia()],
  )
  const [etapasFb, setEtapasFb] = useState<Step[]>(() => {
    const base = auto.fb_steps?.length ? auto.fb_steps : auto.steps?.length ? auto.steps : [etapaVazia()]
    return base.map(e => ({ ...e, require_follow: false, follow_reminder: null }))
  })
  const [followIg, setFollowIg] = useState((auto.steps?.length ?? 0) > 1)
  const [followFb, setFollowFb] = useState(
    ((auto.fb_steps?.length ? auto.fb_steps : auto.steps)?.length ?? 0) > 1,
  )
  const [aba, setAba] = useState<Canal>(lerCanais(auto.channels)[0])
  const abaFb = aba === 'facebook'

  // O resto do editor mexe no fluxo da aba aberta.
  const etapas = abaFb ? etapasFb : etapasIg
  const setEtapas = abaFb ? setEtapasFb : setEtapasIg
  const pedirFollow = abaFb ? followFb : followIg
  const setPedirFollow = abaFb ? setFollowFb : setFollowIg

  const [salvando, setSalvando] = useState(false)
  const [abaCelular, setAbaCelular] = useState<'editar' | 'previa'>('editar')
  const [msg, setMsg] = useState<string | null>(null)

  // Retrato dos campos. Se mudou desde o ultimo save, o botao Salvar fica verde.
  const instantaneo = JSON.stringify({ nome, palavras, modo, canais, mediaId, fbPostId, respostaComentario, etapasIg, etapasFb })
  const [salvo, setSalvo] = useState(instantaneo)
  const sujo = instantaneo !== salvo

  /** Voltar com alteracao pendente pede confirmacao antes de descartar. */
  function fechar() {
    if (sujo && !confirm('Você tem alterações não salvas.\n\nSair agora descarta essas alterações. Continuar?')) return
    aoFechar()
  }

  // Fechar a aba / recarregar tambem avisa quando ha alteracao pendente.
  useEffect(() => {
    if (!sujo) return
    function avisar(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sujo])

  function mudarEtapa(i: number, chave: keyof Step, valor: string | boolean) {
    setEtapas(a => a.map((e, idx) => (idx === i ? { ...e, [chave]: valor } : e)))
  }

  /** Links desta etapa, migrando o formato antigo (um so par) na primeira leitura. */
  function linksDaEtapa(e: Step): { label: string; url: string }[] {
    if (e.links?.length) return e.links
    if (e.button_label || e.button_url) return [{ label: e.button_label ?? '', url: e.button_url ?? '' }]
    return [{ label: '', url: '' }]
  }

  function mudarLink(i: number, li: number, campo: 'label' | 'url', valor: string) {
    setEtapas(a =>
      a.map((e, idx) => {
        if (idx !== i) return e
        const links = linksDaEtapa(e).map((l, j) => (j === li ? { ...l, [campo]: valor } : l))
        return { ...e, links, button_label: null, button_url: null }
      }),
    )
  }

  function adicionarLink(i: number) {
    setEtapas(a =>
      a.map((e, idx) => (idx === i ? { ...e, links: [...linksDaEtapa(e), { label: '', url: '' }] } : e)),
    )
  }

  function removerLink(i: number, li: number) {
    setEtapas(a =>
      a.map((e, idx) =>
        idx === i ? { ...e, links: linksDaEtapa(e).filter((_, j) => j !== li) } : e,
      ),
    )
  }

  // O fluxo de varios passos e a chave do produto: as primeiras DMs pedem o
  // follow e so o clique no botao libera o link. Desligado, o link vai direto.
  function alternarFollow(ligado: boolean) {
    if (!ligado && etapas.length > 1) {
      const quantas = etapas.length - 1
      const ok = confirm(
        `Desligar apaga ${quantas} etapa(s) e deixa só a DM com o link.\n\n` +
          'Isso não dá para desfazer depois de salvar. Continuar?',
      )
      if (!ok) return
    }

    setPedirFollow(ligado)
    setEtapas(a => {
      if (ligado && a.length === 1) {
        // No Facebook o convite e para curtir a Pagina, sem trava.
        const primeira: Step = abaFb
          ? {
              text: 'Oi! Separei o material pra você 👇',
              links: [{ label: 'Curtir a Página', url: paginaUrl ?? '' }],
              next_label: 'Quero o material',
            }
          : {
              text: 'Oi! Antes de te mandar o link, me segue aqui pra não perder nada. Já seguiu?',
              links: [{ label: '', url: '' }],
              next_label: 'Já segui',
            }
        return [primeira, a[0]]
      }
      if (!ligado && a.length > 1) return [a[a.length - 1]]
      return a
    })
  }

  /** Nova etapa entra antes da ultima: a DM com o link continua sendo o fim. */
  function adicionarEtapa() {
    setEtapas(a => {
      const copia = [...a]
      copia.splice(copia.length - 1, 0, { ...etapaVazia(), next_label: 'Continuar' })
      return copia
    })
  }

  function removerEtapa(i: number) {
    setEtapas(a => a.filter((_, idx) => idx !== i))
  }

  function moverEtapa(i: number, dir: -1 | 1) {
    setEtapas(a => {
      const j = i + dir
      if (j < 0 || j > a.length - 2) return a // a ultima fica sempre no fim
      const copia = [...a]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })
  }

  async function salvar(ativar?: boolean) {
    setSalvando(true)
    setMsg(null)
    const r = await fetch('/api/automations/' + auto.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nome,
        keywords: palavras,
        match_mode: modo,
        channels: canais,
        media_id: mediaId,
        fb_post_id: fbPostId,
        comment_reply_text: respostaComentario,
        steps: etapasIg,
        fb_steps: etapasFb,
        ...(ativar === undefined ? {} : { active: ativar }),
      }),
    })
    const j = await r.json()
    setSalvando(false)
    if (!r.ok) return setMsg(j.erro || 'Erro ao salvar.')
    setSalvo(JSON.stringify({ nome, palavras, modo, canais, mediaId, fbPostId, respostaComentario, etapasIg, etapasFb }))
    setMsg(ativar === true ? 'Automação ativada.' : ativar === false ? 'Pausada.' : 'Salvo.')
    aoSalvar()
  }

  const ultima = etapas.length - 1

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={fechar}
            aria-label="Voltar"
            className="rounded-lg border border-[var(--rule-strong)] p-2 hover:bg-[var(--ground)]"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[22px] font-bold outline-none hover:border-[var(--rule-strong)] focus:border-[var(--accent)]"
          />
          <Selo ativo={auto.active} />
        </div>

        <div className="flex items-center gap-2">
          {sujo ? (
            <span className="text-[13px] font-medium text-[var(--brand-ink)]">Alterações não salvas</span>
          ) : msg ? (
            <span className="text-[13px] text-[var(--ink-soft)]">{msg}</span>
          ) : null}
          <button
            type="button"
            disabled={salvando}
            onClick={() => salvar()}
            className={
              'rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50 ' +
              (sujo
                ? 'bg-[var(--brand)] font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]'
                : 'border border-[var(--rule-strong)] hover:bg-[var(--ground)]')
            }
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => salvar(!auto.active)}
            className={
              'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ' +
              (auto.active
                ? 'border border-[var(--rule-strong)] hover:bg-[var(--ground)]'
                : 'bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]')
            }
          >
            {auto.active ? 'Pausar' : 'Ativar'}
          </button>
        </div>
      </div>

      {/* No celular formulario e previa nao cabem lado a lado: viram abas. */}
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-[var(--rule)] p-1 lg:hidden">
        {(['editar', 'previa'] as const).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setAbaCelular(a)}
            className={
              'rounded-md py-2 text-[13px] font-semibold transition-colors ' +
              (abaCelular === a ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)]')
            }
          >
            {a === 'editar' ? 'Editar' : 'Prévia'}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-[1fr_320px]">
        <div className={(abaCelular === 'editar' ? 'block' : 'hidden') + ' space-y-4 lg:block'}>
          <Bloco titulo="Onde responder">
            {/* Canais em que a automacao responde. */}
            <div className="flex flex-wrap gap-2">
              {([
                ['instagram', 'Instagram'],
                ['facebook', 'Facebook'],
              ] as const).map(([c, rotuloCanal]) => (
                <label
                  key={c}
                  className={
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm ' +
                    (canais.includes(c)
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold'
                      : 'border-[var(--rule-strong)]')
                  }
                >
                  <input
                    type="checkbox"
                    checked={canais.includes(c)}
                    onChange={() => alternarCanal(c)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {rotuloCanal}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-soft)]">
              Pelo menos um fica marcado. A palavra-chave e a resposta no comentário valem para os dois.
            </p>
            {noInstagram && !temInstagram ? (
              <p className="mt-2 text-[12px] text-[var(--aviso-ink)]">
                O Instagram ainda não está conectado (Configurações).
              </p>
            ) : null}
            {noFacebook && !temFacebook ? (
              <p className="mt-2 text-[12px] text-[var(--aviso-ink)]">
                A Página do Facebook ainda não está conectada (Configurações).
              </p>
            ) : null}

            {/* Seletor de fluxo: escolhe qual dos dois fluxos aparece para editar. */}
            <div className="mt-4 border-t border-[var(--rule)] pt-4">
              <p className={rotulo}>Editar o fluxo do</p>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-[var(--rule)] p-1">
                {([
                  ['instagram', 'Instagram'],
                  ['facebook', 'Facebook'],
                ] as const).map(([c, rotuloCanal]) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAba(c)}
                    className={
                      'flex items-center justify-center gap-2 rounded-md py-2 text-[13px] font-semibold transition-colors ' +
                      (aba === c
                        ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                        : 'text-[var(--ink-soft)]')
                    }
                  >
                    <span
                      className={
                        'grid h-5 w-5 place-items-center rounded text-white ' +
                        (c === 'facebook'
                          ? 'bg-[#1877f2]'
                          : 'bg-gradient-to-tr from-[#fdc468] via-[#df4996] to-[#5b51d8]')
                      }
                    >
                      {c === 'facebook' ? <IconeFacebook tamanho={12} /> : <IconeInstagram tamanho={12} />}
                    </span>
                    {rotuloCanal}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-soft)]">
                {abaFb
                  ? 'Fluxo do Messenger. Sem trava de seguir: a Meta não informa quem segue a Página.'
                  : 'Fluxo do Direct. Pode usar a trava "só avançar se estiver seguindo".'}
              </p>
              {!canais.includes(aba) ? (
                <p className="mt-1 text-[12px] text-[var(--aviso-ink)]">
                  {abaFb ? 'Facebook' : 'Instagram'} desmarcado acima: este fluxo fica guardado, mas não é enviado.
                </p>
              ) : null}
            </div>
          </Bloco>

          <Bloco titulo="Quando alguém comentar">
            <div className="space-y-3">
              <Radio
                marcado={modo === 'contains'}
                aoMarcar={() => setModo('contains')}
                titulo="uma palavra ou expressão específica"
              />
              {modo === 'contains' ? (
                <div className="pl-6">
                  <input
                    value={palavras}
                    onChange={e => setPalavras(e.target.value)}
                    className={campo}
                    placeholder="Digite uma ou mais palavras, separadas por vírgula"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['quero', 'link', 'preço', 'eu quero'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setPalavras(atual => (atual.trim() ? atual + ', ' + p : p))
                        }
                        className="rounded-full border border-[var(--rule-strong)] px-3 py-1 text-[12px] hover:bg-[var(--ground)]"
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <Radio
                marcado={modo === 'exact'}
                aoMarcar={() => setModo('exact')}
                titulo="o comentário exatamente igual à palavra"
              />

              <div className="border-t border-[var(--rule)] pt-3">
                <label className={rotulo}>Responder no comentário (opcional)</label>
                <input
                  value={respostaComentario}
                  onChange={e => setRespostaComentario(e.target.value)}
                  className={campo + ' mt-1.5'}
                  placeholder="Te mandei no direct!"
                />
              </div>

              {/* Instagram e Facebook sao publicacoes diferentes: o campo segue a aba. */}
              {abaFb ? (
                <div>
                  <label className={rotulo}>Só neste post do Facebook (opcional)</label>
                  <input
                    value={fbPostId}
                    onChange={e => setFbPostId(e.target.value)}
                    className={campo + ' mt-1.5'}
                    placeholder="ID do post, ex.: 1040518285812181_1054917434200060. Vazio = todos"
                  />
                </div>
              ) : (
                <div>
                  <label className={rotulo}>Só neste post do Instagram (opcional)</label>
                  <input
                    value={mediaId}
                    onChange={e => setMediaId(e.target.value)}
                    className={campo + ' mt-1.5'}
                    placeholder="ID do post. Vazio = vale para todos"
                  />
                </div>
              )}
            </div>
          </Bloco>

          <Bloco titulo={abaFb ? 'No Facebook, eles receberão' : 'No Instagram, eles receberão'}>
            <Chave
              ligada={pedirFollow}
              aoMudar={alternarFollow}
              titulo={
                abaFb
                  ? 'mensagens antes do link (convite para curtir a Página)'
                  : 'uma DM pedindo que sigam seu perfil antes do link'
              }
              texto={
                abaFb
                  ? 'Com a chave ligada, o link só é enviado depois que a pessoa toca no botão. Sem trava: quem não curtiu a Página passa do mesmo jeito.'
                  : 'Com a chave ligada, o link só é enviado depois que a pessoa toca no botão. Filtra curioso e conta como engajamento na conversa.'
              }
            />

            {pedirFollow ? (
              <div className="mt-4 space-y-4">
                {/* Todas as etapas antes da ultima ficam editaveis aqui.
                    Antes so a primeira aparecia e as do meio ficavam invisiveis. */}
                {etapas.slice(0, ultima).map((etapa, i) => (
                  <CartaoEtapa
                    key={i}
                    indice={i}
                    total={ultima}
                    etapa={etapa}
                    perfil={perfil}
                    aoMudar={(chave, valor) => mudarEtapa(i, chave, valor)}
                    links={linksDaEtapa(etapa)}
                    aoMudarLink={(li, campo, valor) => mudarLink(i, li, campo, valor)}
                    aoAdicionarLink={() => adicionarLink(i)}
                    aoRemoverLink={li => removerLink(i, li)}
                    proxima={etapas[i + 1]}
                    aoMudarProxima={(chave, valor) => mudarEtapa(i + 1, chave, valor)}
                    aoRemover={etapas.length > 2 ? () => removerEtapa(i) : undefined}
                    aoMover={(dir) => moverEtapa(i, dir)}
                    semTrava={abaFb}
                  />
                ))}

                <button
                  type="button"
                  onClick={adicionarEtapa}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--rule-strong)] py-2.5 text-[13px] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Plus size={15} /> Adicionar etapa
                </button>
              </div>
            ) : null}
          </Bloco>

          <Bloco titulo="E então, eles vão receber">
            <div className="space-y-3 rounded-lg bg-[var(--surface-2)] p-4">
              <div>
                <label className={rotulo}>DM com o seu link</label>
                <textarea
                  rows={3}
                  value={etapas[ultima]?.text ?? ''}
                  onChange={e => mudarEtapa(ultima, 'text', e.target.value)}
                  className={campo + ' mt-1.5'}
                  placeholder="Prontinho! Aqui está o seu acesso:"
                />
                <AtalhosTexto
                  texto={etapas[ultima]?.text ?? ''}
                  aoMudar={valor => mudarEtapa(ultima, 'text', valor)}
                />
                {/* Com uma etapa so, esta mensagem e a resposta privada ao
                    comentario, que nao comporta audio. */}
                {ultima > 0 ? (
                  <CampoAudio
                    url={etapas[ultima]?.audio_url ?? ''}
                    aoMudar={valor => mudarEtapa(ultima, 'audio_url', valor)}
                  />
                ) : null}
              </div>
              <div>
                <label className={rotulo}>Botões</label>
                <div className="mt-1.5 space-y-2">
                  {linksDaEtapa(etapas[ultima]).map((link, li) => (
                    <div key={li} className="flex items-start gap-1.5 sm:grid sm:flex-none sm:grid-cols-2 sm:gap-3">
                      <input
                        value={link.label}
                        maxLength={20}
                        onChange={e => mudarLink(ultima, li, 'label', e.target.value)}
                        className={campo}
                        placeholder="Acessar agora"
                      />
                      <div className="flex flex-1 items-start gap-1.5">
                        <input
                          value={link.url}
                          onChange={e => mudarLink(ultima, li, 'url', e.target.value)}
                          className={campo + ' flex-1'}
                          placeholder="https://sua-pagina.com"
                        />
                        {linksDaEtapa(etapas[ultima]).length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removerLink(ultima, li)}
                            aria-label="Remover botão de link"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded text-[var(--erro-ink)] hover:bg-[var(--erro-bg)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {linksDaEtapa(etapas[ultima]).length < 3 ? (
                    <button
                      type="button"
                      onClick={() => adicionarLink(ultima)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--rule-strong)] py-2 text-[12px] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <Plus size={13} /> Adicionar botão de link
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </Bloco>

          <div className={`${cartao} flex items-start gap-3 p-4 text-[13px] text-[var(--ink-soft)]`}>
            <ListChecks size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            <p>
              Cada pessoa recebe cada etapa uma única vez. Clicar de novo no mesmo botão não
              reenvia nada, e existe um teto de envios por hora para proteger a conta.
            </p>
          </div>
        </div>

        <div className={(abaCelular === 'previa' ? 'block' : 'hidden') + ' lg:sticky lg:top-7 lg:block lg:self-start'}>
          <p className="mb-3 hidden text-[13px] font-semibold text-[var(--ink-soft)] lg:block">Visualização</p>
          <PreviewCelular
            etapas={etapas}
            palavras={palavras}
            respostaComentario={respostaComentario}
            perfil={abaFb ? paginaNome ?? 'Sua Página' : perfil}
          />
        </div>
      </div>
    </>
  )
}

function CartaoEtapa({
  indice,
  total,
  etapa,
  perfil,
  aoMudar,
  links,
  aoMudarLink,
  aoAdicionarLink,
  aoRemoverLink,
  proxima,
  aoMudarProxima,
  aoRemover,
  aoMover,
  semTrava = false,
}: {
  /** Fluxo do Facebook: a trava de seguir nao existe e some da tela. */
  semTrava?: boolean
  indice: number
  total: number
  etapa: Step
  perfil: string
  aoMudar: (chave: keyof Step, valor: string | boolean) => void
  links: { label: string; url: string }[]
  aoMudarLink: (li: number, campo: 'label' | 'url', valor: string) => void
  aoAdicionarLink: () => void
  aoRemoverLink: (li: number) => void
  proxima?: Step
  aoMudarProxima: (chave: keyof Step, valor: string | boolean) => void
  aoRemover?: () => void
  aoMover: (dir: -1 | 1) => void
}) {
  const primeira = indice === 0
  // Reserva um lugar pro botao de avancar: no maximo 2 links aqui.
  const maxLinks = 2

  return (
    <div className="rounded-lg bg-[var(--surface-2)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-[var(--ink-soft)]">
          Etapa {indice + 1} de {total + 1}
          {primeira ? ' · chega logo após o comentário' : ''}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => aoMover(-1)}
            disabled={indice === 0}
            aria-label="Mover para cima"
            className="grid h-10 w-10 place-items-center rounded text-[var(--ink-soft)] hover:bg-[var(--rule)] disabled:opacity-30 md:h-auto md:w-auto md:p-1"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => aoMover(1)}
            disabled={indice >= total - 1}
            aria-label="Mover para baixo"
            className="grid h-10 w-10 place-items-center rounded text-[var(--ink-soft)] hover:bg-[var(--rule)] disabled:opacity-30 md:h-auto md:w-auto md:p-1"
          >
            <ArrowDown size={14} />
          </button>
          {aoRemover ? (
            <button
              type="button"
              onClick={aoRemover}
              aria-label="Remover etapa"
              className="grid h-10 w-10 place-items-center rounded text-[var(--erro-ink)] hover:bg-[var(--erro-bg)] md:h-auto md:w-auto md:p-1"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <textarea
        rows={3}
        value={etapa.text ?? ''}
        onChange={e => aoMudar('text', e.target.value)}
        className={campo}
        placeholder={
          primeira ? 'Me segue aqui pra eu te mandar o link. Já seguiu?' : 'Mensagem desta etapa'
        }
      />
      <AtalhosTexto texto={etapa.text ?? ''} aoMudar={valor => aoMudar('text', valor)} />

      {primeira ? null : (
        <CampoAudio url={etapa.audio_url ?? ''} aoMudar={valor => aoMudar('audio_url', valor)} />
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={rotulo}>Botões que abrem um link</label>
          <div className="mt-1.5 space-y-2">
            {links.map((link, li) => (
              <div key={li} className="flex items-start gap-1.5">
                <div className="flex-1 space-y-1.5">
                  <input
                    value={link.label}
                    maxLength={20}
                    onChange={e => aoMudarLink(li, 'label', e.target.value)}
                    className={campo}
                    placeholder={primeira && li === 0 ? 'Abrir meu perfil' : 'Ver a página'}
                  />
                  <input
                    value={link.url}
                    onChange={e => aoMudarLink(li, 'url', e.target.value)}
                    className={campo}
                    placeholder={primeira && li === 0 ? `https://instagram.com/${perfil}` : 'https://...'}
                  />
                </div>
                {links.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => aoRemoverLink(li)}
                    aria-label="Remover botão de link"
                    className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded text-[var(--erro-ink)] hover:bg-[var(--erro-bg)]"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            ))}
            {links.length < maxLinks ? (
              <button
                type="button"
                onClick={aoAdicionarLink}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--rule-strong)] py-2 text-[12px] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Plus size={13} /> Adicionar botão de link
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <label className={rotulo}>Botão que avança a conversa</label>
          <input
            value={etapa.next_label ?? ''}
            maxLength={20}
            onChange={e => aoMudar('next_label', e.target.value)}
            className={campo + ' mt-1.5'}
            placeholder={primeira ? 'Já segui' : 'Continuar'}
          />
          <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
            É o toque neste botão que dispara a etapa {indice + 2}.
          </p>
        </div>
      </div>

      {proxima && !semTrava ? (
        <div className="mt-3 rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={proxima.require_follow === true}
              onChange={e => aoMudarProxima('require_follow', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-[13px]">
              <span className="font-semibold">Só avançar se a pessoa estiver me seguindo</span>
              <span className="block text-[12px] text-[var(--ink-soft)]">
                Antes de liberar a etapa {indice + 2}, o sistema pergunta ao Instagram se essa
                pessoa segue você. Clicar no botão sem seguir não passa.
              </span>
            </span>
          </label>

          {proxima.require_follow ? (
            <textarea
              rows={2}
              value={etapa.follow_reminder ?? ''}
              onChange={e => aoMudar('follow_reminder', e.target.value)}
              className={campo + ' mt-2.5'}
              placeholder="Ainda não te encontrei na minha lista de seguidores. Segue o perfil e toca no botão de novo."
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Atalhos de personalizacao abaixo da mensagem. Acrescentam no fim do texto. */
function AtalhosTexto({ texto, aoMudar }: { texto: string; aoMudar: (valor: string) => void }) {
  const inserir = (marca: string) => aoMudar((texto.trimEnd() + ' ' + marca).trimStart())
  const chip =
    'rounded-full border border-[var(--rule-strong)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]'

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => inserir('{nome}')} className={chip}>+ Nome</button>
      <button type="button" onClick={() => inserir('{usuario}')} className={chip}>+ @usuário</button>
      <span className="text-[12px] text-[var(--ink-soft)]">
        Negrito: escreva entre <code>**asteriscos**</code>
      </span>
    </div>
  )
}

const AUDIO_ACEITO ='.m4a,.aac,.wav,.mp4,audio/mp4,audio/x-m4a,audio/aac,audio/wav'

/** Sobe o arquivo direto no Supabase e devolve o link publico. */
async function subirAudio(arquivo: File): Promise<string> {
  const r = await fetch('/api/audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: arquivo.name, tamanho: arquivo.size }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.erro ?? 'falha ao preparar o envio')

  // Mesmo formato do uploadToSignedUrl do supabase-js.
  const corpo = new FormData()
  corpo.append('cacheControl', '3600')
  corpo.append('', arquivo)
  const envio = await fetch(j.uploadUrl, { method: 'PUT', body: corpo, headers: { 'x-upsert': 'false' } })
  if (!envio.ok) throw new Error('o arquivo não subiu. Tente de novo.')
  return j.publicUrl
}

function relogio(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

/**
 * Audio que sai antes do texto da etapa: anexar arquivo ou gravar na hora.
 * A gravacao passa por uma revisao (ouvir, excluir, regravar) antes de subir,
 * para nao encher o armazenamento de tentativa.
 */
function CampoAudio({ url, aoMudar }: { url: string; aoMudar: (valor: string) => void }) {
  const [estado, setEstado] = useState<'livre' | 'gravando' | 'revisando' | 'enviando'>('livre')
  const [segundos, setSegundos] = useState(0)
  const [rascunho, setRascunho] = useState<{ blob: Blob; url: string } | null>(null)
  const [erro, setErro] = useState('')
  const gravacao = useRef<Gravacao | null>(null)

  // Cronometro e parada automatica no limite.
  useEffect(() => {
    if (estado !== 'gravando') return
    const inicio = Date.now()
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000)
      setSegundos(s)
      if (s >= MAX_SEGUNDOS) parar()
    }, 250)
    return () => clearInterval(t)
  }, [estado])

  // Fecha o microfone e libera a previa se o cartao sumir no meio (so ao desmontar).
  const previa = useRef<string | null>(null)
  previa.current = rascunho?.url ?? null
  useEffect(() => () => {
    gravacao.current?.cancelar()
    if (previa.current) URL.revokeObjectURL(previa.current)
  }, [])

  async function gravar() {
    setErro('')
    try {
      gravacao.current = await iniciarGravacao()
      setSegundos(0)
      setEstado('gravando')
    } catch {
      setErro('Não consegui usar o microfone. Libere o acesso nas permissões do navegador.')
    }
  }

  async function parar() {
    const g = gravacao.current
    if (!g) return
    gravacao.current = null
    const blob = await g.parar()
    setRascunho({ blob, url: URL.createObjectURL(blob) })
    setEstado('revisando')
  }

  function descartar() {
    if (rascunho) URL.revokeObjectURL(rascunho.url)
    setRascunho(null)
    setEstado('livre')
  }

  async function enviar(arquivo: File) {
    setErro('')
    setEstado('enviando')
    try {
      aoMudar(await subirAudio(arquivo))
      descartar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setEstado(rascunho ? 'revisando' : 'livre')
    }
  }

  const botaoSecundario =
    'flex h-10 items-center justify-center gap-1.5 rounded-md border border-[var(--rule-strong)] px-3 text-[13px] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
  // Texto na cor da superficie: branco no tema claro, escuro no escuro (acento fica claro).
  const botaoPrincipal =
    'flex h-10 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] text-[13px] font-semibold text-[var(--surface)] hover:opacity-90'

  return (
    <div className="mt-3 rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-3">
      <label className={rotulo}>Áudio antes da mensagem (opcional)</label>

      {url && estado === 'livre' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <audio controls src={url} className="h-10 min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => aoMudar('')}
            className="flex h-10 items-center gap-1.5 rounded-md px-3 text-[13px] text-[var(--erro-ink)] hover:bg-[var(--erro-bg)]"
          >
            <Trash2 size={14} /> Remover
          </button>
        </div>
      ) : null}

      {!url && estado === 'livre' ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={gravar} className={botaoPrincipal}>
            <Mic size={15} /> Gravar
          </button>
          <label className={botaoSecundario + ' cursor-pointer border-dashed'}>
            <Upload size={15} /> Anexar
            <input
              type="file"
              accept={AUDIO_ACEITO}
              className="hidden"
              onChange={e => {
                const arquivo = e.target.files?.[0]
                e.target.value = ''
                if (arquivo) enviar(arquivo)
              }}
            />
          </label>
        </div>
      ) : null}

      {estado === 'gravando' ? (
        <div className="mt-2 flex items-center gap-3 rounded-md bg-[var(--erro-bg)] px-3 py-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e41e3f]" />
          <span className="flex-1 text-[13px] font-semibold tabular-nums text-[var(--erro-ink)]">
            Gravando {relogio(segundos)}
            <span className="font-normal text-[var(--ink-soft)]"> / {relogio(MAX_SEGUNDOS)}</span>
          </span>
          <button
            type="button"
            onClick={parar}
            className="flex h-10 items-center gap-1.5 rounded-md bg-[#e41e3f] px-4 text-[13px] font-semibold text-white"
          >
            <Square size={13} fill="currentColor" /> Parar
          </button>
        </div>
      ) : null}

      {(estado === 'revisando' || estado === 'enviando') && rascunho ? (
        <div className="mt-2 space-y-2">
          <audio controls src={rascunho.url} className="h-10 w-full" />
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={descartar}
              disabled={estado === 'enviando'}
              className="flex h-10 items-center justify-center gap-1.5 rounded-md text-[13px] text-[var(--erro-ink)] hover:bg-[var(--erro-bg)] disabled:opacity-40"
            >
              <Trash2 size={14} /> Excluir
            </button>
            <button
              type="button"
              onClick={() => { descartar(); gravar() }}
              disabled={estado === 'enviando'}
              className={botaoSecundario + ' disabled:opacity-40'}
            >
              <RotateCcw size={14} /> Regravar
            </button>
            <button
              type="button"
              onClick={() => enviar(new File([rascunho.blob], 'gravacao.wav', { type: 'audio/wav' }))}
              disabled={estado === 'enviando'}
              className={botaoPrincipal + ' disabled:opacity-60'}
            >
              <Check size={14} /> {estado === 'enviando' ? 'Salvando...' : 'Usar'}
            </button>
          </div>
        </div>
      ) : null}

      {estado === 'enviando' && !rascunho ? (
        <p className="mt-2 text-[13px] text-[var(--ink-soft)]">Enviando áudio...</p>
      ) : null}

      {erro ? <p className="mt-2 text-[12px] text-[var(--erro-ink)]">{erro}</p> : null}
      <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
        Grave até 8 minutos ou anexe m4a, aac, wav ou mp4 de até 25 MB. Áudio do WhatsApp (.ogg) não
        é aceito pelo Instagram.
      </p>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className={`${cartao} p-5`}>
      <h2 className="mb-4 text-[15px] font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

function Radio({
  marcado,
  aoMarcar,
  titulo,
}: {
  marcado: boolean
  aoMarcar: () => void
  titulo: string
}) {
  return (
    <button type="button" onClick={aoMarcar} className="flex w-full items-center gap-3 text-left">
      <span
        className={
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ' +
          (marcado ? 'border-[var(--accent)]' : 'border-[var(--rule-strong)]')
        }
      >
        {marcado ? <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> : null}
      </span>
      <span className="text-sm">{titulo}</span>
    </button>
  )
}

function Chave({
  ligada,
  aoMudar,
  titulo,
  texto,
}: {
  ligada: boolean
  aoMudar: (v: boolean) => void
  titulo: string
  texto: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{titulo}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{texto}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligada}
        onClick={() => aoMudar(!ligada)}
        className={
          'relative h-6 w-11 shrink-0 rounded-full transition-colors ' +
          (ligada ? 'bg-[var(--accent)]' : 'bg-[var(--rule-strong)]')
        }
      >
        <span
          className={
            'absolute top-0.5 h-5 w-5 rounded-full bg-[var(--surface)] transition-all ' +
            (ligada ? 'left-[22px]' : 'left-0.5')
          }
        />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- contatos

function Contatos({ contatos, total }: { contatos: Contato[]; total: number }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold md:text-[28px]">Contatos</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {total} pessoa(s) que interagiram.
            {contatos.length < total ? ` Mostrando as ${contatos.length} mais recentes.` : ''}
          </p>
        </div>

        {total > 0 ? (
          <a
            href="/api/contatos/export"
            className="shrink-0 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition-opacity hover:opacity-90"
          >
            Baixar lista (CSV)
          </a>
        ) : null}
      </div>

      {contatos.length === 0 ? (
        <div className={`${cartao} mt-6 p-10 text-center text-sm text-[var(--ink-soft)]`}>
          Ninguém interagiu ainda.
        </div>
      ) : (
        <>
          {/* Celular: cartoes empilhados. Tabela de tres colunas obrigaria
              rolagem lateral, que some com a ultima coluna sem avisar. */}
          <div className={`${cartao} mt-6 divide-y divide-[var(--rule)] md:hidden`}>
            {contatos.map(c => (
              <div key={c.ig_user_id} className="px-4 py-3">
                <p className="truncate text-[15px] font-medium">
                  {nomeDoContato(c)}
                  {c.channel === 'facebook' ? (
                    <span className="ml-1.5 text-[11px] font-normal text-[var(--ink-soft)]">Facebook</span>
                  ) : null}
                </p>
                <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  {c.dm_count} mensagem(ns) · {new Date(c.last_seen_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>

          <div className={`${cartao} mt-6 hidden overflow-hidden md:block`}>
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-[12px] uppercase tracking-wide text-[var(--ink-soft)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Pessoa</th>
                  <th className="px-5 py-3 font-medium">Mensagens</th>
                  <th className="px-5 py-3 font-medium">Última vez</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {contatos.map(c => (
                  <tr key={c.ig_user_id}>
                    <td className="px-5 py-3">
                      {nomeDoContato(c)}
                      {c.channel === 'facebook' ? (
                        <span className="ml-1.5 text-[11px] text-[var(--ink-soft)]">Facebook</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">{c.dm_count}</td>
                    <td className="px-5 py-3 text-[var(--ink-soft)]">
                      {new Date(c.last_seen_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------- historico

/** Resume o payload do log em uma linha legivel, sem despejar JSON cru. */
function detalhe(payload: Record<string, unknown> | null) {
  if (!payload) return ''
  return Object.entries(payload)
    .filter(([chave]) => chave !== 'corpo' && chave !== 'id')
    .map(([chave, valor]) => `${chave}: ${String(valor).slice(0, 80)}`)
    .join(' · ')
}

function Historico({
  fila,
  logs,
  contatos,
  dias,
  autoFiltro,
  canalFiltro,
  automacoes,
}: {
  fila: FilaItem[]
  logs: LogItem[]
  contatos: Contato[]
  dias: number
  autoFiltro: string | null
  canalFiltro: string | null
  automacoes: Auto[]
}) {
  // Mostrar @usuario (Instagram) ou nome (Facebook) em vez do numero cru.
  const porId = new Map(contatos.map(c => [c.ig_user_id, c]))
  const quem = (id: string) => {
    const c = porId.get(id)
    return c ? nomeDoContato(c) : id
  }

  const cor: Record<string, string> = {
    sent: 'bg-[var(--ok-bg)] text-[var(--ok-ink)]',
    failed: 'bg-[var(--erro-bg)] text-[var(--erro-ink)]',
    pending: 'bg-[var(--aviso-bg)] text-[var(--aviso-ink)]',
  }

  return (
    <>
      <h1 className="text-[22px] font-bold md:text-[28px]">Histórico</h1>
      <Filtros dias={dias} autoFiltro={autoFiltro} canalFiltro={canalFiltro} automacoes={automacoes} />

      <h2 className="mt-6 text-[15px] font-semibold">Envios</h2>
      <div className={`${cartao} mt-3 divide-y divide-[var(--rule)]`}>
        {fila.length === 0 ? (
          <p className="p-6 text-sm text-[var(--ink-soft)]">Nenhum envio ainda.</p>
        ) : (
          fila.map(f => (
            <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{quem(f.recipient_id)}</p>
                <p className="truncate text-[12px] text-[var(--ink-soft)]">
                  {f.channel === 'facebook' ? 'Facebook' : 'Instagram'} ·{' '}
                  {f.automations?.name ?? 'automação removida'} · etapa {(f.step_index ?? 0) + 1} ·{' '}
                  {new Date(f.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <span
                className={
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
                  (cor[f.status] ?? 'bg-[var(--ground)] text-[var(--ink-soft)]')
                }
              >
                {f.status}
              </span>
            </div>
          ))
        )}
      </div>

      <h2 className="mt-8 text-[15px] font-semibold">Log do sistema</h2>
      <div className={`${cartao} mt-3 p-5`}>
        <ul className="space-y-1 font-mono text-[12px] text-[var(--ink-soft)]">
          {logs.map(l => (
            <li key={l.id} className="break-words">
              [{new Date(l.created_at).toLocaleString('pt-BR')}] {l.source}: {l.message}
              {detalhe(l.payload) ? (
                <span className="text-[var(--ink)]"> · {detalhe(l.payload)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- config

function Config({ conta, pagina }: { conta: Conta; pagina: Pagina }) {
  return (
    <>
      <h1 className="text-[22px] font-bold md:text-[28px]">Configurações</h1>

      <div className={`${cartao} mt-6 p-6`}>
        <h2 className="font-semibold">Aparência</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Vale só neste aparelho. Em <strong>Sistema</strong>, o painel segue o tema do celular ou
          do computador.
        </p>
        <div className="mt-4">
          <AlternarTema />
        </div>
      </div>

      <div className={`${cartao} mt-6 p-6`}>
        <h2 className="font-semibold">Conta do Instagram</h2>
        {conta ? (
          <div className="mt-3 space-y-1.5 text-sm text-[var(--ink-soft)]">
            <p>
              Conectada como <strong>@{conta.username}</strong>
            </p>
            <p className="flex items-center gap-1.5">
              Webhook:
              {conta.webhook_subscribed ? (
                <span className="inline-flex items-center gap-1 text-[var(--ok-ink)]">
                  <Check size={14} /> assinado
                </span>
              ) : (
                <span className="text-[var(--aviso-ink)]">não assinado</span>
              )}
            </p>
            {conta.token_expires_at ? (
              <p className="text-[var(--ink-soft)]">
                Token vale até {new Date(conta.token_expires_at).toLocaleDateString('pt-BR')}, e
                renova sozinho.
              </p>
            ) : null}
            <a
              href="/api/oauth/instagram"
              className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
            >
              Reconectar
            </a>
          </div>
        ) : (
          <a
            href="/api/oauth/instagram"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
          >
            <AtSign size={16} /> Conectar Instagram
          </a>
        )}
      </div>

      <div className={`${cartao} mt-6 p-6`}>
        <h2 className="font-semibold">Página do Facebook</h2>
        {pagina ? (
          <div className="mt-3 space-y-1.5 text-sm text-[var(--ink-soft)]">
            <p>
              Conectada: <strong>{pagina.name ?? pagina.page_id}</strong>
            </p>
            <p className="flex items-center gap-1.5">
              Webhook:
              {pagina.webhook_subscribed ? (
                <span className="inline-flex items-center gap-1 text-[var(--ok-ink)]">
                  <Check size={14} /> assinado
                </span>
              ) : (
                <span className="text-[var(--aviso-ink)]">não assinado</span>
              )}
            </p>
            <p>O acesso da Página não vence.</p>
            <a
              href="/api/oauth/facebook"
              className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
            >
              Reconectar ou trocar de Página
            </a>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Responde no Messenger quem comenta nos posts da sua Página. Na tela da Meta, marque só
              a Página que o Autochat vai usar.
            </p>
            <a
              href="/api/oauth/facebook"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1877f2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166fe5]"
            >
              <IconeFacebook /> Conectar Página do Facebook
            </a>
          </>
        )}
      </div>
    </>
  )
}
