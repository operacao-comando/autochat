import pg from 'pg'
import { env } from '../env'
import { segredo } from '../segredos'
import { ESQUEMA, ESQUEMA_VERSAO, tarefasAgendadas } from './esquema'

/**
 * Cria (ou atualiza) o banco e liga as tarefas agendadas.
 *
 * Usa a conexao direta do Postgres que a integracao Vercel + Supabase entrega.
 * Pode rodar quantas vezes precisar: o esquema e todo idempotente e as
 * tarefas sao apagadas e recriadas com o endereco e o segredo atuais.
 */
export async function instalarBanco(endereco: string) {
  // O parametro sslmode da URL faz o pg exigir certificado verificado, e o
  // do Supabase nao passa nessa verificacao. A conexao continua criptografada.
  const url = new URL(env.postgresUrl())
  url.searchParams.delete('sslmode')
  url.searchParams.delete('supa')

  const cliente = new pg.Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  })

  await cliente.connect()
  try {
    await cliente.query(ESQUEMA)

    const segredoCron = await segredo('cron')
    for (const t of tarefasAgendadas(endereco, segredoCron)) {
      await cliente.query(
        'select cron.unschedule($1) where exists (select 1 from cron.job where jobname = $1)',
        [t.nome],
      )
      await cliente.query('select cron.schedule($1, $2, $3)', [t.nome, t.quando, t.comando])
    }

    await cliente.query(
      `insert into instalacao (id, esquema_versao, endereco, atualizado_em)
       values (1, $1, $2, now())
       on conflict (id) do update set esquema_versao = $1, endereco = $2, atualizado_em = now()`,
      [ESQUEMA_VERSAO, endereco],
    )

    // O Supabase guarda em cache a lista de tabelas da API: sem este aviso,
    // a tabela recem-criada da "nao encontrada" por alguns minutos.
    await cliente.query(`notify pgrst, 'reload schema'`)
  } finally {
    await cliente.end()
  }
}
