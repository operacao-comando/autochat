/**
 * Grava o microfone direto em WAV.
 *
 * Nao usa MediaRecorder de proposito: cada navegador grava num formato
 * (webm no Firefox, mp4 fragmentado no Chrome) e a Meta so aceita
 * m4a/aac/wav/mp4 "normais". WAV sai igual em qualquer aparelho.
 *
 * Mono, 24 kHz, 16 bits: cerca de 2,9 MB por minuto.
 */

export const TAXA_SAIDA = 24000
/** 8 minutos cabem folgados no limite de 25 MB da Meta. */
export const MAX_SEGUNDOS = 8 * 60

export type Gravacao = {
  parar: () => Promise<Blob>
  cancelar: () => void
}

export async function iniciarGravacao(): Promise<Gravacao> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  })

  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  // iPhone cria o contexto suspenso ate um gesto; o toque em Gravar ja valeu.
  if (ctx.state === 'suspended') await ctx.resume()

  const fonte = ctx.createMediaStreamSource(stream)
  // ScriptProcessor esta obsoleto, mas e o unico que roda igual no Safari do iPhone.
  const processador = ctx.createScriptProcessor(4096, 1, 1)
  const pedacos: Float32Array[] = []

  processador.onaudioprocess = e => {
    pedacos.push(new Float32Array(e.inputBuffer.getChannelData(0)))
  }
  fonte.connect(processador)
  processador.connect(ctx.destination)

  const taxaEntrada = ctx.sampleRate

  function encerrar() {
    processador.disconnect()
    fonte.disconnect()
    stream.getTracks().forEach(t => t.stop())
    ctx.close().catch(() => {})
  }

  return {
    async parar() {
      encerrar()
      return codificarWav(reamostrar(juntar(pedacos), taxaEntrada, TAXA_SAIDA), TAXA_SAIDA)
    },
    cancelar: encerrar,
  }
}

function juntar(pedacos: Float32Array[]): Float32Array {
  const total = pedacos.reduce((s, p) => s + p.length, 0)
  const saida = new Float32Array(total)
  let pos = 0
  for (const p of pedacos) {
    saida.set(p, pos)
    pos += p.length
  }
  return saida
}

function reamostrar(entrada: Float32Array, de: number, para: number): Float32Array {
  if (de === para) return entrada
  const razao = de / para
  const saida = new Float32Array(Math.floor(entrada.length / razao))
  for (let i = 0; i < saida.length; i++) {
    // Media do trecho: evita chiado ao reduzir a taxa.
    const ini = Math.floor(i * razao)
    const fim = Math.min(entrada.length, Math.floor((i + 1) * razao))
    let soma = 0
    for (let j = ini; j < fim; j++) soma += entrada[j]
    saida[i] = fim > ini ? soma / (fim - ini) : entrada[ini] ?? 0
  }
  return saida
}

function codificarWav(amostras: Float32Array, taxa: number): Blob {
  const buffer = new ArrayBuffer(44 + amostras.length * 2)
  const v = new DataView(buffer)
  const texto = (pos: number, s: string) => [...s].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)))

  texto(0, 'RIFF')
  v.setUint32(4, 36 + amostras.length * 2, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, taxa, true)
  v.setUint32(28, taxa * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  texto(36, 'data')
  v.setUint32(40, amostras.length * 2, true)

  let pos = 44
  for (const a of amostras) {
    const s = Math.max(-1, Math.min(1, a))
    v.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    pos += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}
