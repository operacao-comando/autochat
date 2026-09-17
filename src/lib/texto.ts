/**
 * Personalizacao do texto das etapas. Sem banco nem rede: roda tambem na
 * previa do painel.
 *
 *   {nome}     -> primeiro nome do perfil ("Maria")
 *   {usuario}  -> @ da pessoa ("@maria.silva")
 *   **texto**  -> letras em negrito Unicode (a DM da API nao tem formatacao)
 *
 * Dado que falta nunca aparece cru: a marcacao some e a frase e ajeitada
 * ("Oi, {nome}!" vira "Oi!").
 */

export type Pessoa = { nome: string | null; usuario: string | null }

const MARCA_NOME = /\{\s*nome\s*\}/gi
const MARCA_USUARIO = /\{\s*usu[aá]rio\s*\}/gi

export function temMarcacao(texto: string): boolean {
  return /\{\s*(nome|usu[aá]rio)\s*\}/i.test(texto)
}

export function personalizar(texto: string, pessoa: Pessoa): string {
  const saida = texto
    .replace(MARCA_NOME, pessoa.nome ?? '')
    .replace(MARCA_USUARIO, pessoa.usuario ? '@' + pessoa.usuario : '')
    // Conserto de pontuacao quando o dado faltou.
    .replace(/[ \t]+([,.!?;:])/g, '$1')
    .replace(/,([!?.])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]*,[ \t]*/gm, '')
  return negrito(saida)
}

/**
 * Primeiro nome com inicial maiuscula ("maria silva" -> "Maria").
 * Pega a primeira palavra feita de letras, ignorando emoji e simbolo na frente.
 * Tudo em caixa alta vira normal ("MARIA" -> "Maria"); nome misto so ganha a
 * inicial ("deAndre" -> "DeAndre"). Sem letra nenhuma, fica sem nome.
 */
export function primeiroNome(nome: string | null | undefined): string | null {
  const palavra = nome?.match(/\p{L}[\p{L}'’-]*/u)?.[0]
  if (!palavra) return null
  const base = palavra === palavra.toUpperCase() ? palavra.toLowerCase() : palavra
  return base.charAt(0).toUpperCase() + base.slice(1)
}

// Sans-serif bold do bloco "Mathematical Alphanumeric Symbols".
const A_MAIUSCULO = 0x1d5d4
const A_MINUSCULO = 0x1d5ee
const ZERO = 0x1d7ec

function letraNegrito(c: string): string {
  const n = c.charCodeAt(0)
  if (n >= 65 && n <= 90) return String.fromCodePoint(A_MAIUSCULO + n - 65)
  if (n >= 97 && n <= 122) return String.fromCodePoint(A_MINUSCULO + n - 97)
  if (n >= 48 && n <= 57) return String.fromCodePoint(ZERO + n - 48)
  return c
}

/** **texto** vira negrito. Acento vira letra base em negrito + acento combinado. */
export function negrito(texto: string): string {
  return texto.replace(/\*\*([^*\n]+?)\*\*/g, (_, trecho: string) =>
    [...trecho.normalize('NFD')].map(letraNegrito).join(''),
  )
}
