import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession } from './auth'
import { segredo } from './segredos'

/** true se a requisicao tem sessao valida do painel. */
export async function logado(): Promise<boolean> {
  const jar = await cookies()
  return verifySession(jar.get(SESSION_COOKIE)?.value, await segredo('sessao'))
}
