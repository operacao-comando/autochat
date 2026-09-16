import { NextResponse } from 'next/server'
import { db, log } from '@/lib/db'
import { logado } from '@/lib/guard'
import { esquecerChavesMeta } from '@/lib/meta-chaves'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CAMPOS = {
  igAppId: 'ig_app_id',
  igAppSecret: 'ig_app_secret',
  fbAppId: 'fb_app_id',
  fbAppSecret: 'fb_app_secret',
  fbLoginConfigId: 'fb_login_config_id',
} as const

type Campo = keyof typeof CAMPOS

const SO_NUMEROS: Campo[] = ['igAppId', 'fbAppId', 'fbLoginConfigId']

/**
 * Grava as chaves coladas no Assistente da Meta. Campo vazio = manter o que
 * ja estava (o segredo nunca volta para a tela, entao ele chega vazio).
 */
export async function POST(req: Request) {
  if (!(await logado())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })

  const corpo = (await req.json().catch(() => ({}))) as Partial<Record<Campo, string>>
  const linha: Record<string, string> = {}

  for (const campo of Object.keys(CAMPOS) as Campo[]) {
    const valor = String(corpo[campo] ?? '').trim()
    if (!valor) continue
    if (SO_NUMEROS.includes(campo) && !/^\d{5,25}$/.test(valor)) {
      return NextResponse.json({ erro: `O campo ${rotulo(campo)} deve ter só números.` }, { status: 400 })
    }
    if (!SO_NUMEROS.includes(campo) && !/^[a-f0-9]{20,64}$/i.test(valor)) {
      return NextResponse.json({ erro: `A ${rotulo(campo)} parece incompleta. Copie de novo pelo botão da Meta.` }, { status: 400 })
    }
    linha[CAMPOS[campo]] = valor
  }

  if (!Object.keys(linha).length) return NextResponse.json({ erro: 'Nada para salvar.' }, { status: 400 })

  const supa = db()
  const { data: atual } = await supa.from('meta_app').select('fb_app_id, fb_app_secret').eq('id', 1).maybeSingle()

  // O par ID + segredo do Facebook da para conferir na hora com a Meta.
  // O do Instagram so se confere no login, ao conectar a conta.
  const fbId = linha.fb_app_id ?? atual?.fb_app_id
  const fbSegredo = linha.fb_app_secret ?? atual?.fb_app_secret
  if ((linha.fb_app_id || linha.fb_app_secret) && fbId && fbSegredo) {
    const p = new URLSearchParams({ client_id: fbId, client_secret: fbSegredo, grant_type: 'client_credentials' })
    const r = await fetch(`https://graph.facebook.com/oauth/access_token?${p}`)
    if (!r.ok) {
      return NextResponse.json(
        { erro: 'A Meta recusou o ID e a chave secreta do app (Facebook). Confira os dois em Configurações do app → Básico.' },
        { status: 400 },
      )
    }
  }

  const { error } = await supa
    .from('meta_app')
    .upsert({ id: 1, ...linha, atualizado_em: new Date().toISOString() }, { onConflict: 'id' })
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  esquecerChavesMeta()
  await log('info', 'meta', 'chaves do app salvas', { campos: Object.keys(linha) })
  return NextResponse.json({ ok: true })
}

function rotulo(campo: Campo) {
  return {
    igAppId: 'ID do app do Instagram',
    igAppSecret: 'chave secreta do Instagram',
    fbAppId: 'ID do app',
    fbAppSecret: 'chave secreta do app',
    fbLoginConfigId: 'ID da configuração',
  }[campo]
}
