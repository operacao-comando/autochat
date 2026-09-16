'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import type { DadosAssistente } from '@/lib/instalacao/assistente'

/**
 * Assistente da Meta: o passo a passo para criar o aplicativo, com cada
 * valor pronto para copiar, e os campos para colar as chaves de volta.
 *
 * A ordem dos passos importa: a Meta so entrega comentario com o app
 * publicado, e so deixa publicar com as Configuracoes Basicas preenchidas.
 */

const cartao = 'rounded-xl border border-[var(--rule)] bg-[var(--surface)]'
const campo =
  'w-full rounded-lg border border-[var(--rule-strong)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)] md:py-2 md:text-sm'

export default function AssistenteMeta({
  dados,
  igConectado,
  fbConectado,
}: {
  dados: DadosAssistente
  igConectado: boolean
  fbConectado: boolean
}) {
  const igPronto = Boolean(dados.igAppId && dados.temIgSegredo)
  const fbPronto = Boolean(dados.fbAppId && dados.temFbSegredo && dados.fbLoginConfigId)
  const u = dados.endereco

  return (
    <div className={`${cartao} mt-6 p-6`}>
      <h2 className="font-semibold">Aplicativo da Meta</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        O Autochat conversa com o Instagram e o Facebook por um aplicativo seu, criado uma vez só no
        site de desenvolvedores da Meta. Siga os passos na ordem: leva uns 20 minutos.
      </p>

      <ul className="mt-4 space-y-1.5 text-sm">
        <Situacao ok={igPronto} texto="Chaves do Instagram coladas" />
        <Situacao ok={igConectado} texto="Instagram conectado" />
        <Situacao ok={fbPronto} texto="Chaves do Facebook coladas (opcional)" />
        <Situacao ok={fbConectado} texto="Página do Facebook conectada (opcional)" />
      </ul>

      <Parte titulo="1. Criar o aplicativo" aberta={!igPronto}>
        <Passo n={1} titulo="Entre no site de desenvolvedores">
          Abra <Link href="https://developers.facebook.com/apps" />. Se for a primeira vez, clique em{' '}
          <b>Começar</b> e conclua o cadastro. O código de confirmação chega no e-mail da sua conta do
          Facebook, que pode ser diferente do e-mail que você usa no dia a dia.
        </Passo>
        <Passo n={2} titulo="Crie o app">
          Clique em <b>Criar aplicativo</b>. O nome <b>não pode</b> ter “insta”, “gram”, “face” nem
          “book” (use, por exemplo, “Autochat Loja”). Em <b>Casos de uso</b>, marque{' '}
          <b>Gerenciar mensagens e conteúdo no Instagram</b>. Avance até criar.
        </Passo>
        <Passo n={3} titulo="Preencha as Configurações Básicas">
          No menu da esquerda: <b>Configurações do app → Básico</b>. Copie e cole:
          <Valor rotulo="Domínios do aplicativo" valor={dados.dominio} />
          <Valor rotulo="URL da Política de Privacidade" valor={`${u}/privacidade`} />
          <Valor rotulo="URL dos Termos de Serviço" valor={`${u}/termos`} />
          <Valor rotulo="Exclusão de dados — escolha “URL de retorno de chamada”" valor={`${u}/api/meta/data-deletion`} />
          Em <b>Categoria</b>, escolha <b>Negócios e páginas</b>. Clique em <b>Salvar alterações</b>, no fim
          da página.
        </Passo>
        <Passo n={4} titulo="Publique o app">
          No menu da esquerda, <b>Publicar</b> → <b>Publicar</b>.{' '}
          <span className="text-[var(--aviso-ink)]">
            Sem publicar, a Meta não avisa nenhum comentário e o Autochat fica parado, sem erro.
          </span>
        </Passo>
      </Parte>

      <Parte titulo="2. Instagram" aberta={!igConectado}>
        <Passo n={5} titulo="Abra a configuração do Instagram">
          Menu <b>Casos de uso</b> → <b>Personalizar</b> → <b>Configuração da API com login do Instagram</b>.
          No bloco 1, clique em <b>Adicionar todas as permissões necessárias</b>.
        </Passo>
        <Passo n={6} titulo="Cole as chaves do Instagram aqui">
          No topo dessa tela ficam o <b>ID do app do Instagram</b> e a <b>Chave secreta do app do
          Instagram</b> (clique em Mostrar e copie). Atenção: não é o número do app do Facebook.
          <FormChaves
            campos={[
              { nome: 'igAppId', rotulo: 'ID do app do Instagram', atual: dados.igAppId },
              { nome: 'igAppSecret', rotulo: 'Chave secreta do app do Instagram', segredo: true, salvo: dados.temIgSegredo },
            ]}
          />
        </Passo>
        <Passo n={7} titulo="Configure o webhook">
          No bloco <b>Configurar webhooks</b>:
          <Valor rotulo="URL de callback" valor={`${u}/api/webhook/instagram`} />
          <Valor rotulo="Verificar token" valor={dados.tokenInstagram} />
          Clique em <b>Verificar e salvar</b>. Depois, na lista de campos, ative <b>comments</b> e{' '}
          <b>messages</b>. Se os campos ficarem em branco depois de salvar, o app ainda não está publicado
          (passo 4).
        </Passo>
        <Passo n={8} titulo="Configure o login">
          No bloco <b>Configurar login da empresa do Instagram</b> → <b>Configurar</b>:
          <Valor rotulo="URL de redirecionamento" valor={`${u}/api/oauth/instagram/callback`} />
          Salve.
        </Passo>
        <Passo n={9} titulo="Adicione a sua conta como testadora">
          Menu <b>Funções do app → Funções → Adicionar pessoas</b>. Embaixo, marque{' '}
          <b>Testador do Instagram</b>, digite o seu @ e confirme. Depois aceite o convite em{' '}
          <Link href="https://www.instagram.com/accounts/manage_access/" />, aba <b>Convites do testador</b>,
          com a sua conta logada.
        </Passo>
        <Passo n={10} titulo="Conecte">
          Confira que o Instagram logado neste navegador é a conta certa e clique em{' '}
          <b>Conectar Instagram</b>, logo abaixo.
        </Passo>
      </Parte>

      <Parte titulo="3. Facebook (opcional)" aberta={igConectado && !fbConectado}>
        <p className="text-sm text-[var(--ink-soft)]">
          Para responder no Messenger quem comenta nos posts da sua Página. É o mesmo aplicativo.
        </p>
        <Passo n={11} titulo="Adicione o caso de uso do Messenger">
          Menu <b>Casos de uso → Adicionar caso de uso</b>. Escolha o de <b>Messenger</b> (engajar com
          clientes) e, se aparecer, o de <b>gerenciar a Página</b>. Nas permissões, adicione:{' '}
          <code className="text-xs">pages_messaging</code>, <code className="text-xs">pages_manage_metadata</code>,{' '}
          <code className="text-xs">pages_read_engagement</code>, <code className="text-xs">pages_read_user_content</code>,{' '}
          <code className="text-xs">pages_manage_engagement</code>, <code className="text-xs">pages_show_list</code> e{' '}
          <code className="text-xs">business_management</code>.
        </Passo>
        <Passo n={12} titulo="Cadastre o site">
          <b>Configurações do app → Básico</b> → <b>Adicionar plataforma</b> → <b>Site</b>:
          <Valor rotulo="URL do site" valor={u} />
          Clique em <b>Salvar alterações</b>.
        </Passo>
        <Passo n={13} titulo="Configure o Login do Facebook para Empresas">
          Menu <b>Login do Facebook para Empresas → Configurações</b>:
          <Valor rotulo="URIs de redirecionamento do OAuth válidos" valor={`${u}/api/oauth/facebook/callback`} />
          Clique no botão <b>Salvar alterações</b> no fim da página (o aviso de salvamento automático não
          grava). Depois, em <b>Configurações</b> desse mesmo menu, clique em <b>Criar configuração</b>,
          escolha <b>token de acesso do usuário</b>, marque as permissões do passo 11 e crie. Copie o{' '}
          <b>ID da configuração</b>.
        </Passo>
        <Passo n={14} titulo="Configure o webhook da Página">
          Menu <b>Webhooks</b> → no seletor do topo, escolha <b>Page</b> (Página) →{' '}
          <b>Assinar este objeto</b>:
          <Valor rotulo="URL de callback" valor={`${u}/api/webhook/facebook`} />
          <Valor rotulo="Verificar token" valor={dados.tokenFacebook} />
          Clique em <b>Verificar e salvar</b> e ative <b>feed</b>, <b>messages</b> e{' '}
          <b>messaging_postbacks</b>.
        </Passo>
        <Passo n={15} titulo="Cole as chaves do Facebook aqui">
          O <b>ID do app</b> e a <b>Chave secreta do app</b> ficam em <b>Configurações do app → Básico</b>.
          <FormChaves
            campos={[
              { nome: 'fbAppId', rotulo: 'ID do app', atual: dados.fbAppId },
              { nome: 'fbAppSecret', rotulo: 'Chave secreta do app', segredo: true, salvo: dados.temFbSegredo },
              { nome: 'fbLoginConfigId', rotulo: 'ID da configuração (passo 13)', atual: dados.fbLoginConfigId },
            ]}
          />
        </Passo>
        <Passo n={16} titulo="Conecte">
          Clique em <b>Conectar Página do Facebook</b>, logo abaixo, e marque <b>só</b> a Página que o
          Autochat vai usar. Para testar, comente com o seu <b>perfil pessoal</b>: o Facebook não deixa
          responder comentário feito por uma Página.
        </Passo>
      </Parte>
    </div>
  )
}

function Situacao({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-[var(--ok-ink)]' : 'text-[var(--ink-soft)]'}`}>
      {ok ? <Check size={15} /> : <span className="inline-block h-[15px] w-[15px] rounded-full border border-[var(--rule-strong)]" />}
      {texto}
    </li>
  )
}

function Parte({ titulo, aberta, children }: { titulo: string; aberta: boolean; children: React.ReactNode }) {
  return (
    <details open={aberta} className="mt-5 rounded-lg border border-[var(--rule)] p-4">
      <summary className="cursor-pointer font-semibold">{titulo}</summary>
      <div className="mt-3 space-y-5">{children}</div>
    </details>
  )
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)]">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-semibold">{titulo}</p>
        <div className="mt-1 text-[var(--ink-soft)]">{children}</div>
      </div>
    </div>
  )
}

function Link({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-[var(--accent)] hover:underline">
      {href.replace('https://', '')} <ExternalLink size={12} />
    </a>
  )
}

function Valor({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // navegador sem permissao de copiar: o valor continua selecionavel
    }
  }
  return (
    <div className="my-2">
      <p className="text-xs font-semibold text-[var(--ink)]">{rotulo}</p>
      <div className="mt-1 flex items-stretch gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-md border border-[var(--rule)] bg-[var(--ground)] px-2.5 py-1.5 text-xs text-[var(--ink)]">
          {valor}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--rule-strong)] px-2.5 text-xs font-semibold hover:bg-[var(--ground)]"
        >
          {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

type CampoForm = {
  nome: 'igAppId' | 'igAppSecret' | 'fbAppId' | 'fbAppSecret' | 'fbLoginConfigId'
  rotulo: string
  atual?: string | null
  segredo?: boolean
  salvo?: boolean
}

function FormChaves({ campos }: { campos: CampoForm[] }) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(campos.map(c => [c.nome, c.segredo ? '' : c.atual ?? ''])),
  )
  const [estado, setEstado] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setEstado(null)
    const r = await fetch('/api/meta/chaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valores),
    })
    const j = await r.json().catch(() => ({}))
    setSalvando(false)
    if (!r.ok) return setEstado({ tom: 'erro', texto: j.erro || 'Não foi possível salvar.' })
    setEstado({ tom: 'ok', texto: 'Chaves salvas.' })
    setValores(v => Object.fromEntries(campos.map(c => [c.nome, c.segredo ? '' : v[c.nome]])))
    router.refresh()
  }

  return (
    <form onSubmit={salvar} className="mt-3 space-y-3 rounded-lg border border-[var(--rule)] p-3">
      {campos.map(c => (
        <label key={c.nome} className="block">
          <span className="text-xs font-semibold text-[var(--ink)]">{c.rotulo}</span>
          <input
            className={`${campo} mt-1`}
            value={valores[c.nome]}
            onChange={e => setValores(v => ({ ...v, [c.nome]: e.target.value }))}
            placeholder={c.segredo && c.salvo ? 'Já salva. Deixe em branco para manter.' : ''}
            autoComplete="off"
            spellCheck={false}
            type={c.segredo ? 'password' : 'text'}
            inputMode={c.segredo ? undefined : 'numeric'}
          />
        </label>
      ))}
      {estado ? (
        <p className={`text-sm ${estado.tom === 'ok' ? 'text-[var(--ok-ink)]' : 'text-[var(--erro-ink)]'}`}>{estado.texto}</p>
      ) : null}
      <button
        type="submit"
        disabled={salvando}
        className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-hover)] disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Salvar chaves'}
      </button>
    </form>
  )
}
