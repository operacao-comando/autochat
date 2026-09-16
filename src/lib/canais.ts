import { lerEtapas, type Step } from './steps'

/**
 * Fluxo que vale em cada canal. O Facebook usa `fb_steps` quando a automacao
 * tem fluxo proprio; vazio, usa o mesmo fluxo do Instagram (`steps`).
 */
export function etapasDoCanal(
  auto: { steps?: unknown; fb_steps?: unknown },
  canal: Canal,
): Step[] {
  if (canal === 'facebook') {
    const proprio = lerEtapas(auto.fb_steps)
    if (proprio.length) return proprio
  }
  return lerEtapas(auto.steps)
}

/** Canais em que uma automacao responde. */
export type Canal = 'instagram' | 'facebook'

export const CANAIS: Canal[] = ['instagram', 'facebook']

/** Lista de canais valida, sem repeticao. Vazia ou invalida vira so Instagram. */
export function lerCanais(bruto: unknown): Canal[] {
  const lista = Array.isArray(bruto) ? bruto : []
  const validos = CANAIS.filter(c => lista.includes(c))
  return validos.length ? validos : ['instagram']
}
