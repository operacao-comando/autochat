import { db } from '../db'
import { env } from '../env'
import { ESQUEMA_VERSAO } from './esquema'
import { instalarBanco } from './instalar'

/**
 * Painel publicado com versao nova do sistema: atualiza o banco sozinho.
 * Roda so quando a versao guardada e menor que a do codigo.
 */
export async function atualizarBancoSePreciso() {
  const { data, error } = await db().from('instalacao').select('esquema_versao, endereco').eq('id', 1).maybeSingle()
  if (error || !data || data.esquema_versao >= ESQUEMA_VERSAO) return
  await instalarBanco(data.endereco || env.baseUrl())
}
