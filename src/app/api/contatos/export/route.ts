import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logado } from '@/lib/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Exporta todos os contatos em CSV, para abrir no Excel ou subir como
 * publico personalizado no Gerenciador de Anuncios.
 */
export async function GET() {
  if (!await logado()) return new NextResponse('nao autorizado', { status: 401 })

  const supa = db()
  const { data, error } = await supa
    .from('contacts')
    .select('ig_user_id, username, dm_count, first_seen_at, last_seen_at')
    .order('last_seen_at', { ascending: false })

  if (error) return new NextResponse('erro: ' + error.message, { status: 500 })

  // Ponto e virgula: e o separador que o Excel em portugues entende sozinho.
  const cabecalho = 'usuario;id_instagram;mensagens_recebidas;primeiro_contato;ultimo_contato'

  const linhas = (data ?? []).map(c =>
    [
      c.username ? '@' + c.username : '',
      c.ig_user_id,
      c.dm_count ?? 0,
      dataBr(c.first_seen_at),
      dataBr(c.last_seen_at),
    ].map(campo).join(';'),
  )

  // BOM na frente, senao o Excel abre os acentos errados.
  const csv = '﻿' + [cabecalho, ...linhas].join('\r\n')
  const hoje = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contatos-${hoje}.csv"`,
    },
  })
}

function campo(v: unknown) {
  const s = String(v ?? '')
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function dataBr(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : ''
}
