import { donoPublico } from '@/lib/acesso'

export const metadata = { title: 'Exclusao de Dados' }
export const dynamic = 'force-dynamic'

export default async function ExclusaoDados() {
  const { nome, email: CONTATO } = await donoPublico()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-neutral-800">
      <h1 className="text-3xl font-semibold">Exclusao de Dados</h1>

      <section className="mt-8 space-y-4 leading-relaxed">
        <p>
          Esta aplicacao guarda apenas o necessario para responder comentarios do Instagram:
          o identificador e o nome de usuario de quem comentou, o texto do comentario e o
          registro da mensagem enviada.
        </p>

        <h2 className="pt-4 text-xl font-semibold">Como pedir a exclusao</h2>
        <p>
          Envie um e-mail para <strong>{CONTATO}</strong> com o assunto
          <strong> Exclusao de dados</strong> e informe o seu nome de usuario do Instagram
          (o @). O pedido e atendido em ate 30 dias e voce recebe a confirmacao por e-mail.
        </p>

        <h2 className="pt-4 text-xl font-semibold">Exclusao automatica</h2>
        <p>
          Se voce remover a autorizacao da aplicacao nas configuracoes do seu Instagram,
          em Aplicativos e sites, os dados vinculados aquela conta sao apagados
          automaticamente.
        </p>

        <h2 className="pt-4 text-xl font-semibold">Responsavel</h2>
        <p>{nome}{CONTATO && ` — ${CONTATO}`}</p>
      </section>
    </main>
  )
}
