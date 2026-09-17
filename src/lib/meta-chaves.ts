import { db } from './db'

/**
 * Chaves do aplicativo da Meta.
 *
 * O dono cola no painel (Configuracoes -> Assistente da Meta) e elas ficam na
 * tabela meta_app, que so a chave de servico le. Variavel de ambiente com o
 * nome antigo, se existir, vale no lugar do banco: instalacao feita a mao
 * continua funcionando.
 *
 * Instagram e Facebook tem ID e segredo DIFERENTES, mesmo no mesmo app:
 * o do Instagram fica em "Configuracao da API com login do Instagram"; o do
 * Facebook, em Configuracoes do app -> Basico.
 */

export type ChavesMeta = {
  igAppId: string | null
  igAppSecret: string | null
  fbAppId: string | null
  fbAppSecret: string | null
  fbLoginConfigId: string | null
}

type Linha = {
  ig_app_id: string | null
  ig_app_secret: string | null
  fb_app_id: string | null
  fb_app_secret: string | null
  fb_login_config_id: string | null
}

let cache: { chaves: ChavesMeta; ate: number } | null = null

export function esquecerChavesMeta() {
  cache = null
}

export async function chavesMeta(): Promise<ChavesMeta> {
  if (cache && cache.ate > Date.now()) return cache.chaves

  let linha: Linha | null = null
  try {
    const { data } = await db()
      .from('meta_app')
      .select('ig_app_id, ig_app_secret, fb_app_id, fb_app_secret, fb_login_config_id')
      .eq('id', 1)
      .maybeSingle()
    linha = data
  } catch {
    // banco fora do ar: segue so com as variaveis de ambiente
  }

  const e = process.env
  const chaves: ChavesMeta = {
    igAppId: e.IG_APP_ID || linha?.ig_app_id || null,
    igAppSecret: e.IG_APP_SECRET || linha?.ig_app_secret || null,
    fbAppId: e.FB_APP_ID || linha?.fb_app_id || null,
    fbAppSecret: e.FB_APP_SECRET || linha?.fb_app_secret || null,
    fbLoginConfigId: e.FB_LOGIN_CONFIG_ID || linha?.fb_login_config_id || null,
  }
  // Curto de proposito: chave colada no painel vale em ate 30 s.
  cache = { chaves, ate: Date.now() + 30_000 }
  return chaves
}

/** O que a tela de Configuracoes pode mostrar: IDs sim, segredos nunca. */
export type ChavesSalvas = {
  igAppId: string | null
  temIgSegredo: boolean
  fbAppId: string | null
  temFbSegredo: boolean
  fbLoginConfigId: string | null
}

export async function chavesSalvas(): Promise<ChavesSalvas> {
  const c = await chavesMeta()
  return {
    igAppId: c.igAppId,
    temIgSegredo: Boolean(c.igAppSecret),
    fbAppId: c.fbAppId,
    temFbSegredo: Boolean(c.fbAppSecret),
    fbLoginConfigId: c.fbLoginConfigId,
  }
}

/** Pega uma chave obrigatoria ou explica o que falta. */
export async function chave(nome: keyof ChavesMeta): Promise<string> {
  const v = (await chavesMeta())[nome]
  if (!v) throw new Error(`Chave da Meta faltando (${nome}). Cole em Configuracoes -> Assistente da Meta.`)
  return v
}
