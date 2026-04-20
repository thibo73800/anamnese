'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MenuIcon } from 'lucide-react'

import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { InstallButton } from '@/components/pwa/install-button'

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/create', label: 'Créer un set' },
  { href: '/cards', label: 'Cartes' },
  { href: '/review', label: 'Révision' },
  { href: '/settings/api-keys', label: 'Paramètres' },
]

export function AppNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 p-4">
        <Link href="/" className="font-semibold">
          Anamnèse
        </Link>

        <div className="hidden items-center gap-4 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Déconnexion
            </Button>
          </form>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Ouvrir le menu"
              />
            }
          >
            <MenuIcon />
          </SheetTrigger>
          <SheetContent side="left" className="gap-6">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base text-foreground transition-colors hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-2 border-t pt-4">
              <InstallButton />
              <form action={logout} onSubmit={() => setOpen(false)}>
                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  className="w-full justify-start"
                >
                  Déconnexion
                </Button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
