'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ChavesSalvas } from '@/lib/meta-chaves'

/**
 * Campos das chaves do aplicativo da Meta. So os campos: o passo a passo
 * fica no guia e nas aulas da area de membros, de proposito.
 *
 * O segredo salvo nunca volta para a tela; o campo dele chega vazio e,
 * vazio, mantem o que ja estava.
 */

const cartao = 'rounded-xl border border-[var(--rule)] bg-[var(--surface)]'
const campo =
  'w-full rounded-lg border border-[var(--rule-strong)] bg-[var(--surface)] px-3 py-2.5 text-base outline-none focus:border-[var(--accent)] md:py-2 md:text-sm'

export default function ChavesMeta({ chaves }: { chaves: ChavesSalvas }) {
  return (
    <div className={`${cartao} mt-6 p-6`}>
      <h2 className="font-semibold">Chaves do aplicativo da Meta</h2>

      <h3 className="mt-5 text-sm font-semibold">Instagram</h3>
      <FormChaves
        campos={[
          { nome: 'igAppId', rotulo: 'ID do app do Instagram', atual: chaves.igAppId },
          { nome: 'igAppSecret', rotulo: 'Chave secreta do app do Instagram', segredo: true, salvo: chaves.temIgSegredo },
        ]}
      />

      <h3 className="mt-6 text-sm font-semibold">Facebook (opcional)</h3>
      <FormChaves
        campos={[
          { nome: 'fbAppId', rotulo: 'ID do app', atual: chaves.fbAppId },
          { nome: 'fbAppSecret', rotulo: 'Chave secreta do app', segredo: true, salvo: chaves.temFbSegredo },
          { nome: 'fbLoginConfigId', rotulo: 'ID da configuração', atual: chaves.fbLoginConfigId },
        ]}
      />
    </div>
  )
}

type CampoForm = {
  nome: 'igAppId' | 'igAppSecret' | 'fbAppId' | 'fbAppSecret' | 'fbLoginConfigId'
  rotulo: string
  atual?: string | null
  segredo?: boolean
  salvo?: boolean
}

function FormChaves({ campos }: { campos: CampoForm[] }) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(campos.map(c => [c.nome, c.segredo ? '' : c.atual ?? ''])),
  )
  const [estado, setEstado] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setEstado(null)
    const r = await fetch('/api/meta/chaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valores),
    })
    const j = await r.json().catch(() => ({}))
    setSalvando(false)
    if (!r.ok) return setEstado({ tom: 'erro', texto: j.erro || 'Não foi possível salvar.' })
    setEstado({ tom: 'ok', texto: 'Chaves salvas.' })
    setValores(v => Object.fromEntries(campos.map(c => [c.nome, c.segredo ? '' : v[c.nome]])))
    router.refresh()
  }

  return (
    <form onSubmit={salvar} className="mt-2 space-y-3">
      {campos.map(c => (
        <label key={c.nome} className="block">
          <span className="text-xs font-semibold text-[var(--ink)]">{c.rotulo}</span>
          <input
            className={`${campo} mt-1`}
            value={valores[c.nome]}
            onChange={e => setValores(v => ({ ...v, [c.nome]: e.target.value }))}
            placeholder={c.segredo && c.salvo ? 'Já salva. Deixe em branco para manter.' : ''}
            autoComplete="off"
            spellCheck={false}
            type={c.segredo ? 'password' : 'text'}
            inputMode={c.segredo ? undefined : 'numeric'}
          />
        </label>
      ))}
      {estado ? (
        <p className={`text-sm ${estado.tom === 'ok' ? 'text-[var(--ok-ink)]' : 'text-[var(--erro-ink)]'}`}>{estado.texto}</p>
      ) : null}
      <button
        type="submit"
        disabled={salvando}
        className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-hover)] disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  )
}
