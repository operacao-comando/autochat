import { db } from './db'
import { perfilPorId } from './ig'
import { primeiroNome, type Pessoa } from './texto'

export { personalizar, temMarcacao } from './texto'

/**
 * Nome e @ de quem vai receber. Usa o que ja esta em `contacts`.
 *
 * Instagram: quando falta o nome ou o @, pergunta ao Instagram e guarda a
 * resposta para a proxima etapa.
 * Facebook: o nome chega no proprio aviso do comentario e fica em `username`;
 * a Meta nao libera consulta de perfil por aqui, e Facebook nao tem @.
 */
export async function dadosDaPessoa(
  id: string,
  token: string,
  canal: 'instagram' | 'facebook' = 'instagram',
): Promise<Pessoa> {
  const supa = db()
  const { data: contato } = await supa
    .from('contacts')
    .select('name, username')
    .eq('ig_user_id', id)
    .maybeSingle()

  if (canal === 'facebook') {
    return { nome: primeiroNome(contato?.username), usuario: null }
  }

  let nome = contato?.name ?? null
  let usuario = contato?.username ?? null

  // O @ tambem pode faltar: clique em botao grava o contato sem username.
  if (!nome || !usuario) {
    const perfil = await perfilPorId(id, token)
    if (perfil) {
      nome = nome ?? perfil.name ?? null
      usuario = usuario ?? perfil.username ?? null
      if (nome || usuario) {
        await supa.from('contacts').update({ name: nome, username: usuario }).eq('ig_user_id', id)
      }
    }
  }

  return { nome: primeiroNome(nome), usuario }
}
