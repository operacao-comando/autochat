import { db } from '../db'
import { env } from '../env'
import { segredo } from '../segredos'
import { ESQUEMA_VERSAO } from './esquema'
import { instalarBanco } from './instalar'

/** O que o Assistente da Meta mostra. Nunca inclui os segredos colados. */
export type DadosAssistente = {
  endereco: string
  dominio: string
  tokenInstagram: string
  tokenFacebook: string
  igAppId: string | null
  temIgSegredo: boolean
  fbAppId: string | null
  temFbSegredo: boolean
  fbLoginConfigId: string | null
}

export async function dadosDoAssistente(): Promise<DadosAssistente> {
  const supa = db()
  const [{ data: inst }, { data: meta }] = await Promise.all([
    supa.from('instalacao').select('endereco').eq('id', 1).maybeSingle(),
    supa.from('meta_app').select('*').eq('id', 1).maybeSingle(),
  ])
  const endereco = inst?.endereco || env.baseUrl()
  const e = process.env

  return {
    endereco,
    dominio: new URL(endereco).hostname,
    tokenInstagram: await segredo('webhook-instagram'),
    tokenFacebook: await segredo('webhook-facebook'),
    igAppId: e.IG_APP_ID || meta?.ig_app_id || null,
    temIgSegredo: Boolean(e.IG_APP_SECRET || meta?.ig_app_secret),
    fbAppId: e.FB_APP_ID || meta?.fb_app_id || null,
    temFbSegredo: Boolean(e.FB_APP_SECRET || meta?.fb_app_secret),
    fbLoginConfigId: e.FB_LOGIN_CONFIG_ID || meta?.fb_login_config_id || null,
  }
}

/**
 * Painel publicado com versao nova do sistema: atualiza o banco sozinho.
 * Roda so quando a versao guardada e menor que a do codigo.
 */
export async function atualizarBancoSePreciso() {
  const { data, error } = await db().from('instalacao').select('esquema_versao, endereco').eq('id', 1).maybeSingle()
  if (error || !data || data.esquema_versao >= ESQUEMA_VERSAO) return
  await instalarBanco(data.endereco || env.baseUrl())
}
