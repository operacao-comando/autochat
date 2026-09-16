'use client'

import { useState } from 'react'
import type { Step } from '@/lib/steps'
import { personalizar } from '@/lib/texto'

/** Pessoa ficticia da previa: mostra onde {nome} e {usuario} entram. */
const EXEMPLO = { nome: 'Maria', usuario: 'seguidor.exemplo' }

type Aba = 'publicacao' | 'comentario' | 'dm'

/**
 * Previa ao vivo, no formato do ManyChat: tres abas (Publicacao, Comentario,
 * DM) dentro de um celular. Muda conforme o usuario digita, para ele ver a
 * conversa antes de ativar.
 */
export default function PreviewCelular({
  etapas,
  palavras,
  respostaComentario,
  perfil,
}: {
  etapas: Step[]
  palavras: string
  respostaComentario: string
  perfil: string
}) {
  const [aba, setAba] = useState<Aba>('dm')
  const primeiraPalavra = palavras.split(',')[0]?.trim() || 'palavra-chave'

  return (
    <div className="flex flex-col items-center">
      <div className="w-[290px] overflow-hidden rounded-[28px] border-[7px] border-[#1c1e21] bg-black shadow-xl">
        {/* topo do aparelho */}
        <div className="flex items-center justify-between bg-black px-4 pb-1 pt-2 text-[10px] text-white">
          <span>9:41</span>
          <span className="flex gap-1 opacity-70">▪ ▪ ▮</span>
        </div>

        {aba === 'dm' ? <TelaDm etapas={etapas} perfil={perfil} /> : null}
        {aba === 'comentario' ? (
          <TelaComentario palavra={primeiraPalavra} resposta={respostaComentario} perfil={perfil} />
        ) : null}
        {aba === 'publicacao' ? <TelaPublicacao palavra={primeiraPalavra} perfil={perfil} /> : null}
      </div>

      <div className="mt-4 inline-flex rounded-full border border-[#e4e6eb] bg-white p-1 text-xs">
        {(
          [
            ['publicacao', 'Publicação'],
            ['comentario', 'Comentário'],
            ['dm', 'DM'],
          ] as [Aba, string][]
        ).map(([id, nome]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={
              'rounded-full px-3.5 py-1.5 transition-colors ' +
              (aba === id ? 'bg-[#1c1e21] text-white' : 'text-[#65676b] hover:text-[#1c1e21]')
            }
          >
            {nome}
          </button>
        ))}
      </div>
    </div>
  )
}

// Alturas fixas (em px) de uma fala: picos no meio, pontas baixas.
const BARRAS = [3, 5, 8, 6, 10, 7, 4, 9, 12, 8, 5, 11, 14, 9, 6, 12, 16, 11, 7, 13, 10, 6, 9, 12, 7, 4, 8, 6, 3]

/** Desenho de mensagem de voz: barras verticais de alturas variadas. */
function OndaSonora() {
  return (
    <span className="flex h-4 flex-1 items-center justify-between gap-[1.5px]">
      {BARRAS.map((h, i) => (
        <span key={i} className="w-[2px] rounded-full bg-white/85" style={{ height: h }} />
      ))}
    </span>
  )
}

function TelaDm({ etapas, perfil }: { etapas: Step[]; perfil: string }) {
  const visiveis = etapas.filter(e => e.text?.trim() || e.audio_url)

  return (
    <div className="flex h-[430px] flex-col bg-black">
      <div className="flex items-center gap-2 border-b border-[#262626] px-3 py-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-tr from-[#fdc468] via-[#df4996] to-[#5b51d8] text-[9px] font-semibold text-white">
          {perfil.slice(0, 2).toUpperCase()}
        </span>
        <p className="text-[12px] font-semibold text-white">{perfil}</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {visiveis.length === 0 ? (
          <p className="pt-10 text-center text-[12px] text-[#a8a8a8]">
            Escreva a mensagem para ver a prévia
          </p>
        ) : null}

        {visiveis.map((e, i) => (
          <div key={i} className="space-y-1">
            {/* Na primeira etapa o audio nao sai (resposta privada), entao nao aparece. */}
            {e.audio_url && i > 0 ? (
              <div className="flex justify-end">
                <div className="flex w-[66%] items-center gap-2 rounded-[16px] rounded-br-[5px] bg-[#3797f0] px-3 py-2">
                  <span className="h-0 w-0 shrink-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
                  <OndaSonora />
                </div>
              </div>
            ) : null}

            {e.text?.trim() ? (
              <div className="flex justify-end">
                <div className="max-w-[82%] whitespace-pre-line rounded-[16px] rounded-br-[5px] bg-[#3797f0] px-3 py-1.5 text-[12px] leading-snug text-white">
                  {personalizar(e.text, EXEMPLO)}
                </div>
              </div>
            ) : null}

            {(e.links?.length ? e.links : e.button_label?.trim() ? [{ label: e.button_label, url: e.button_url ?? '' }] : [])
              .filter(l => l.label?.trim())
              .map((link, li) => (
                <div key={li} className="flex justify-end">
                  <div className="w-[82%] rounded-[16px] border border-[#363636] bg-[#1a1a1a] px-3 py-1.5 text-center text-[12px] font-semibold text-[#3797f0]">
                    {link.label}
                  </div>
                </div>
              ))}

            {e.next_label?.trim() && i < visiveis.length - 1 ? (
              <>
                <div className="flex justify-end">
                  <div className="w-[82%] rounded-[16px] border border-[#363636] bg-[#1a1a1a] px-3 py-1.5 text-center text-[12px] font-semibold text-[#3797f0]">
                    {e.next_label}
                  </div>
                </div>
                <div className="flex justify-start pt-1">
                  <div className="rounded-[16px] rounded-bl-[5px] bg-[#262626] px-3 py-1.5 text-[12px] text-white">
                    {e.next_label}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>

      <div className="border-t border-[#262626] px-3 py-2">
        <div className="rounded-full border border-[#363636] px-3 py-1 text-[11px] text-[#a8a8a8]">
          Mensagem...
        </div>
      </div>
    </div>
  )
}

function TelaComentario({
  palavra,
  resposta,
  perfil,
}: {
  palavra: string
  resposta: string
  perfil: string
}) {
  return (
    <div className="h-[430px] bg-white">
      <div className="border-b border-[#dbdbdb] px-3 py-2 text-[12px] font-semibold">Comentários</div>
      <div className="space-y-3 p-3">
        <div className="flex gap-2">
          <span className="h-7 w-7 shrink-0 rounded-full bg-[#dbdbdb]" />
          <div className="text-[12px]">
            <p>
              <strong>seguidor.exemplo</strong> {palavra}
            </p>
            <p className="mt-0.5 text-[10px] text-[#8e8e8e]">agora · Responder</p>
          </div>
        </div>

        {resposta.trim() ? (
          <div className="ml-9 flex gap-2">
            <span className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-tr from-[#fdc468] via-[#df4996] to-[#5b51d8]" />
            <div className="text-[12px]">
              <p>
                <strong>{perfil}</strong> {personalizar(resposta, { nome: null, usuario: EXEMPLO.usuario })}
              </p>
              <p className="mt-0.5 text-[10px] text-[#8e8e8e]">agora</p>
            </div>
          </div>
        ) : (
          <p className="ml-9 text-[11px] text-[#8e8e8e]">
            Sem resposta pública configurada
          </p>
        )}
      </div>
    </div>
  )
}

function TelaPublicacao({ palavra, perfil }: { palavra: string; perfil: string }) {
  return (
    <div className="h-[430px] bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-7 w-7 rounded-full bg-gradient-to-tr from-[#fdc468] via-[#df4996] to-[#5b51d8]" />
        <p className="text-[12px] font-semibold">{perfil}</p>
      </div>
      <div className="grid h-[240px] place-items-center bg-[#efefef] text-[11px] text-[#8e8e8e]">
        seu post ou reels
      </div>
      <div className="space-y-1.5 p-3 text-[12px]">
        <p className="text-[16px]">♡ ○ ▷</p>
        <p>
          <strong>{perfil}</strong> comente <strong>{palavra}</strong> que eu te mando no direct
        </p>
        <p className="text-[10px] text-[#8e8e8e]">ver todos os comentários</p>
      </div>
    </div>
  )
}
