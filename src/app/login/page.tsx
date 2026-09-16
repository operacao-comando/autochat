import { redirect } from 'next/navigation'
import { situacao } from '@/lib/acesso'

export const metadata = { title: 'Entrar' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  // Primeira abertura (ou Supabase ainda nao ligado): vai para a configuracao.
  if ((await situacao().catch(() => 'sem-dono' as const)) !== 'pronto') redirect('/configurar')

  const { erro } = await searchParams

  const campo =
    'mt-2 w-full rounded-lg border border-[var(--rule-strong)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--accent)]'

  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--ground)] p-6 text-[var(--ink)]">
      <form
        action="/api/auth/login"
        method="post"
        className="w-full max-w-sm rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-8 shadow-xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="Autochat" className="h-14 w-14 rounded-xl" />
        <h1 className="mt-4 text-2xl font-semibold">Autochat</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Painel de automações</p>

        <label className="mt-8 block text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoFocus
          required
          className={campo}
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="senha">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className={campo} />

        {erro && (
          <p className="mt-3 text-sm text-[var(--erro-ink)]">E-mail ou senha incorretos. Tente de novo.</p>
        )}

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-[var(--brand)] py-2.5 font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
        >
          Entrar
        </button>
      </form>
    </main>
  )
}
