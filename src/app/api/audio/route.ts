import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logado } from '@/lib/guard'

export const runtime = 'nodejs'

const BUCKET = 'audios'
// Limite da Meta para anexo de audio na DM.
const MAX_BYTES = 25 * 1024 * 1024
// Formatos que a Meta aceita. Audio do WhatsApp (.ogg/.opus) nao entra.
const EXTENSOES = ['m4a', 'aac', 'wav', 'mp4']

/**
 * Devolve um endereco assinado para o navegador subir o arquivo direto no
 * Supabase. O arquivo nao passa pela Vercel, que corta corpo acima de 4,5 MB.
 */
export async function POST(req: Request) {
  if (!(await logado())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const nome = String(b.nome ?? '')
  const tamanho = Number(b.tamanho ?? 0)
  const ext = nome.split('.').pop()?.toLowerCase() ?? ''

  if (!EXTENSOES.includes(ext)) {
    return NextResponse.json(
      { erro: 'formato não aceito pelo Instagram. Use m4a, aac, wav ou mp4.' },
      { status: 400 },
    )
  }
  if (!tamanho || tamanho > MAX_BYTES) {
    return NextResponse.json({ erro: 'o áudio precisa ter até 25 MB' }, { status: 400 })
  }

  const caminho = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
  const storage = db().storage.from(BUCKET)

  const { data, error } = await storage.createSignedUploadUrl(caminho)
  if (error || !data) {
    return NextResponse.json({ erro: error?.message ?? 'falha ao preparar o envio' }, { status: 500 })
  }

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    publicUrl: storage.getPublicUrl(caminho).data.publicUrl,
  })
}
