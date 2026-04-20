'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, signup, type AuthState } from '@/app/actions/auth'

type Mode = 'login' | 'signup'

const COPY: Record<Mode, { title: string; submit: string; altHref: string; altLabel: string }> = {
  login: {
    title: 'Connexion',
    submit: 'Se connecter',
    altHref: '/signup',
    altLabel: "Pas encore de compte ? S'inscrire",
  },
  signup: {
    title: 'Créer un compte',
    submit: "S'inscrire",
    altHref: '/login',
    altLabel: 'Déjà un compte ? Se connecter',
  },
}

export function AuthForm({ mode }: { mode: Mode }) {
  const action = mode === 'login' ? login : signup
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null)
  const copy = COPY[mode]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Anamnèse · culture générale</p>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
        </div>
        {state?.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? '…' : copy.submit}
        </Button>
      </form>
      <Link
        href={copy.altHref}
        className="block text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {copy.altLabel}
      </Link>
    </div>
  )
}
