import { NextResponse } from 'next/server'
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { db, log } from '@/lib/db'
import { hashDaSenha, situacao } from '@/lib/acesso'
import { instalarBanco } from '@/lib/instalacao/instalar'
import { segredo } from '@/lib/segredos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Primeira abertura do painel: cria o banco, liga as tarefas agendadas e
 * grava o dono. So funciona enquanto o painel nao tem dono; depois disso,
 * esta rota recusa tudo.
 */
export async function POST(req: Request) {
  const voltar = (erro: string) =>
    NextResponse.redirect(new URL(`/configurar?erro=${erro}`, req.url), { status: 303 })

  const form = await req.formData()
  const nome = String(form.get('nome') || '').trim()
  const email = String(form.get('email') || '').trim().toLowerCase()
  const senha = String(form.get('senha') || '')
  const confirmacao = String(form.get('confirmacao') || '')

  if (!nome || !/^\S+@\S+\.\S+$/.test(email)) return voltar('dados')
  if (senha.length < 8) return voltar('senha-curta')
  if (senha !== confirmacao) return voltar('senha-diferente')

  const estado = await situacao()
  if (estado === 'sem-supabase') return voltar('sem-supabase')
  if (estado === 'pronto') return NextResponse.redirect(new URL('/login', req.url), { status: 303 })

  // Endereco fixo de producao, e nao o do navegador: as tarefas agendadas
  // precisam de um endereco que nao muda a cada publicacao.
  const endereco = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : new URL(req.url).origin

  try {
    await instalarBanco(endereco)
  } catch (e) {
    console.error('instalacao do banco falhou', e)
    return voltar('banco')
  }

  // "on conflict do nothing": se duas abas enviarem juntas, so a primeira vira dona.
  const { data, error } = await db()
    .from('painel_acesso')
    .upsert({ id: 1, nome, email, senha_hash: await hashDaSenha(senha) }, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error('gravar dono falhou', error)
    return voltar('banco')
  }
  if (!data?.length) return NextResponse.redirect(new URL('/login', req.url), { status: 303 })

  await log('info', 'instalacao', 'painel configurado', { email, endereco })

  const res = NextResponse.redirect(new URL('/painel', req.url), { status: 303 })
  res.cookies.set(SESSION_COOKIE, await createSession(await segredo('sessao')), sessionCookieOptions)
  return res
}
