import { donoPublico } from '@/lib/acesso'

// Nome e e-mail vem do dono criado em /configurar. A Meta exige esta pagina.
export const metadata = { title: 'Politica de Privacidade' }

const ATUALIZADO = '20 de agosto de 2026'

export const dynamic = 'force-dynamic'

export default async function Privacidade() {
  const dono = await donoPublico()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-neutral-800">
      <h1 className="text-3xl font-semibold">Politica de Privacidade</h1>
      <p className="mt-2 text-sm text-neutral-500">Atualizado em {ATUALIZADO}</p>

      <section className="mt-8 space-y-4 leading-relaxed">
        <p>
          Esta aplicacao e de uso pessoal e privado do titular da conta do Instagram conectada.
          Ela existe para responder automaticamente a comentarios em publicacoes do proprio
          titular, enviando uma mensagem direta a quem comenta uma palavra-chave escolhida.
        </p>

        <h2 className="pt-4 text-xl font-medium">Quais dados sao tratados</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Identificador e nome de usuario de quem comenta na publicacao.</li>
          <li>Identificador do comentario e da publicacao que gerou o disparo.</li>
          <li>Registro de qual mensagem foi enviada e quando.</li>
          <li>Token de acesso da conta do Instagram do titular, usado apenas para enviar as mensagens.</li>
        </ul>
        <p>
          Nao sao coletados conteudo de conversas privadas anteriores, dados de pagamento,
          documentos, localizacao ou qualquer dado sensivel.
        </p>

        <h2 className="pt-4 text-xl font-medium">Para que os dados sao usados</h2>
        <p>
          Exclusivamente para entregar a mensagem automatica solicitada pela propria pessoa ao
          comentar a palavra-chave, e para evitar envios duplicados a mesma pessoa. Os dados nao
          sao vendidos, alugados, cedidos nem usados para publicidade de terceiros.
        </p>

        <h2 className="pt-4 text-xl font-medium">Onde os dados ficam</h2>
        <p>
          Em banco de dados Postgres hospedado no Supabase, com acesso restrito ao servidor da
          aplicacao. O acesso publico as tabelas esta bloqueado.
        </p>

        <h2 className="pt-4 text-xl font-medium">Por quanto tempo</h2>
        <p>
          Os registros sao mantidos enquanto a automacao estiver ativa e podem ser apagados a
          qualquer momento pelo titular. O token de acesso e apagado assim que o app e removido
          da conta do Instagram.
        </p>

        <h2 className="pt-4 text-xl font-medium">Como pedir exclusao dos seus dados</h2>
        <p>
          Envie um e-mail para <strong>{dono.email}</strong> com o seu nome de usuario
          do Instagram e o pedido de exclusao. Os dados sao apagados em ate 7 dias. A remocao do
          app nas configuracoes do Instagram tambem dispara a exclusao automatica do token.
        </p>

        <h2 className="pt-4 text-xl font-medium">Contato</h2>
        <p>{dono.nome}{dono.email && ` — ${dono.email}`}</p>
      </section>
    </main>
  )
}
