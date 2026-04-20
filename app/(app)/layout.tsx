import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Le proxy redirige déjà mais on double-check ici (defense in depth).
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <nav className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 p-4">
          <Link href="/" className="font-semibold">
            Anamnèse
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/create" className="text-muted-foreground hover:text-foreground">
              Créer un set
            </Link>
            <Link href="/cards" className="text-muted-foreground hover:text-foreground">
              Cartes
            </Link>
            <Link href="/review" className="text-muted-foreground hover:text-foreground">
              Révision
            </Link>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Déconnexion
              </Button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}
