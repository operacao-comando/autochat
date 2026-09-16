import { donoPublico } from '@/lib/acesso'

// Nome e e-mail vem do dono criado em /configurar.
export const metadata = { title: 'Termos de Uso' }

const ATUALIZADO = '20 de agosto de 2026'

export const dynamic = 'force-dynamic'

export default async function Termos() {
  const dono = await donoPublico()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-neutral-800">
      <h1 className="text-3xl font-semibold">Termos de Uso</h1>
      <p className="mt-2 text-sm text-neutral-500">Atualizado em {ATUALIZADO}</p>

      <section className="mt-8 space-y-4 leading-relaxed">
        <p>
          Esta aplicacao e de uso pessoal do titular da conta do Instagram conectada. O acesso ao
          painel administrativo e restrito e protegido por senha.
        </p>

        <h2 className="pt-4 text-xl font-medium">O que a aplicacao faz</h2>
        <p>
          Monitora comentarios em publicacoes da conta conectada e envia uma mensagem direta
          automatica quando o comentario contem uma palavra-chave configurada pelo titular.
        </p>

        <h2 className="pt-4 text-xl font-medium">Uso aceitavel</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>As mensagens sao enviadas apenas a quem interage voluntariamente com a publicacao.</li>
          <li>Nao e permitido usar a aplicacao para spam ou mensagens nao solicitadas.</li>
          <li>O uso deve respeitar os Termos da Plataforma da Meta e as regras do Instagram.</li>
        </ul>

        <h2 className="pt-4 text-xl font-medium">Limitacao</h2>
        <p>
          A aplicacao depende das APIs da Meta. Interrupcoes, mudancas de politica ou limites de
          envio impostos pela plataforma podem afetar o funcionamento, sem que isso configure
          falha da aplicacao.
        </p>

        <h2 className="pt-4 text-xl font-medium">Contato</h2>
        <p>{dono.nome}{dono.email && ` — ${dono.email}`}</p>
      </section>
    </main>
  )
}
