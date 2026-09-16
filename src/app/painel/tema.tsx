'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

/**
 * Alternador de tema.
 *
 * Tres estados, nao dois. "Sistema" existe porque a maioria das pessoas
 * deixa o aparelho decidir -- e quem escolhe claro quer claro mesmo de
 * noite, quando o celular vira sozinho.
 *
 * A escolha fica no proprio aparelho (localStorage), nao no banco: e
 * preferencia de quem esta olhando a tela, nao da conta.
 */

export type Tema = 'sistema' | 'claro' | 'escuro'

export const CHAVE_TEMA = 'autochat:tema'

/**
 * Roda antes da primeira pintura, no <head>. Sem isto a tela pisca branca
 * antes de ficar escura -- o React so assume o controle depois.
 */
export const SCRIPT_TEMA = `
(function () {
  try {
    var t = localStorage.getItem('${CHAVE_TEMA}');
    if (t === 'claro') document.documentElement.setAttribute('data-theme', 'light');
    if (t === 'escuro') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
`

function aplicar(tema: Tema) {
  const raiz = document.documentElement
  if (tema === 'claro') raiz.setAttribute('data-theme', 'light')
  else if (tema === 'escuro') raiz.setAttribute('data-theme', 'dark')
  else raiz.removeAttribute('data-theme')
}

const OPCOES: [Tema, string, typeof Sun][] = [
  ['claro', 'Claro', Sun],
  ['escuro', 'Escuro', Moon],
  ['sistema', 'Sistema', Monitor],
]

export default function AlternarTema({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>('sistema')

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_TEMA) as Tema | null
      if (salvo === 'claro' || salvo === 'escuro') setTema(salvo)
    } catch {
      // navegador sem armazenamento: segue no tema do sistema
    }
  }, [])

  function escolher(novo: Tema) {
    setTema(novo)
    aplicar(novo)
    try {
      if (novo === 'sistema') localStorage.removeItem(CHAVE_TEMA)
      else localStorage.setItem(CHAVE_TEMA, novo)
    } catch {
      // sem armazenamento a escolha vale so ate recarregar
    }
  }

  return (
    <div
      role="group"
      aria-label="Tema do painel"
      className="inline-flex rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-0.5"
    >
      {OPCOES.map(([valor, rotulo, Icone]) => {
        const ativo = valor === tema
        return (
          <button
            key={valor}
            type="button"
            onClick={() => escolher(valor)}
            aria-pressed={ativo}
            title={rotulo}
            className={
              'inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ' +
              (ativo
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]')
            }
          >
            <Icone size={14} />
            {compacto ? null : rotulo}
          </button>
        )
      })}
    </div>
  )
}
