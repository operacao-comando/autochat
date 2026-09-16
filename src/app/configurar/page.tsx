import { redirect } from 'next/navigation'
import { situacao } from '@/lib/acesso'

export const metadata = { title: 'Configurar o painel' }
export const dynamic = 'force-dynamic'

const ERROS: Record<string, string> = {
  dados: 'Preencha o seu nome e um e-mail válido.',
  'senha-curta': 'A senha precisa ter pelo menos 8 caracteres.',
  'senha-diferente': 'As duas senhas não são iguais.',
  'sem-supabase': 'O banco de dados ainda não está ligado. Veja o aviso acima.',
  banco: 'Não foi possível preparar o banco de dados. Espere 1 minuto e tente de novo.',
}

export default async function ConfigurarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const estado = await situacao().catch(() => 'sem-dono' as const)
  if (estado === 'pronto') redirect('/login')

  const { erro } = await searchParams

  const campo =
    'mt-2 w-full rounded-lg border border-[var(--rule-strong)] bg-[var(--surface)] px-3 py-2 outline-none focus:border-[var(--accent)]'

  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--ground)] p-6 text-[var(--ink)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-8 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="Autochat" className="h-14 w-14 rounded-xl" />
        <h1 className="mt-4 text-2xl font-semibold">Bem-vindo ao seu Autochat</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Falta só criar o seu acesso. O banco de dados é preparado junto, sozinho.
        </p>

        {estado === 'sem-supabase' ? (
          <div className="mt-6 rounded-lg border border-[var(--rule-strong)] p-4 text-sm leading-relaxed">
            <p className="font-semibold">O banco de dados ainda não está ligado.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Na Vercel, abra este projeto e clique em <strong>Storage</strong>.</li>
              <li>Crie um banco <strong>Supabase</strong> (plano Free) e ligue a este projeto.</li>
              <li>Em <strong>Deployments</strong>, clique nos três pontinhos da última publicação e em <strong>Redeploy</strong>.</li>
              <li>Quando terminar, recarregue esta página.</li>
            </ol>
          </div>
        ) : (
          <form action="/api/configurar" method="post" className="mt-6">
            <label className="block text-sm font-medium" htmlFor="nome">Seu nome completo</label>
            <input id="nome" name="nome" autoComplete="name" required className={campo} />
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              Aparece na política de privacidade, que a Meta exige.
            </p>

            <label className="mt-4 block text-sm font-medium" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" required className={campo} />

            <label className="mt-4 block text-sm font-medium" htmlFor="senha">Senha</label>
            <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required className={campo} />

            <label className="mt-4 block text-sm font-medium" htmlFor="confirmacao">Repita a senha</label>
            <input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required className={campo} />

            {erro && ERROS[erro] && (
              <p className="mt-3 text-sm text-[var(--erro-ink)]">{ERROS[erro]}</p>
            )}

            <button
              type="submit"
              className="mt-6 w-full rounded-lg bg-[var(--brand)] py-2.5 font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-hover)]"
            >
              Criar acesso e preparar o painel
            </button>
            <p className="mt-2 text-center text-xs text-[var(--ink-soft)]">Leva cerca de 20 segundos.</p>
          </form>
        )}
      </div>
    </main>
  )
}
