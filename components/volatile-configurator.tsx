'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'

const MIN_COUNT = 10
const MAX_COUNT = 30
const DEFAULT_COUNT = 15

export function VolatileConfigurator({ theme }: { theme: string }) {
  const router = useRouter()
  const [count, setCount] = useState(DEFAULT_COUNT)
  const [starting, setStarting] = useState(false)

  const start = () => {
    setStarting(true)
    router.push(
      `/explore/session?theme=${encodeURIComponent(theme)}&count=${count}`,
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Test volatile
        </p>
        <h1 className="text-2xl font-semibold leading-tight">{theme}</h1>
        <p className="text-sm text-muted-foreground">
          Un test QCM à la volée. Les cartes sont générées par Claude et ne sont
          pas sauvegardées.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="count" className="text-sm font-medium">
            Nombre de cartes
          </label>
          <span className="text-lg font-semibold tabular-nums">{count}</span>
        </div>
        <input
          id="count"
          type="range"
          min={MIN_COUNT}
          max={MAX_COUNT}
          step={1}
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value, 10))}
          className="w-full accent-foreground"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{MIN_COUNT}</span>
          <span>{MAX_COUNT}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href="/"
          className={buttonVariants({ variant: 'outline' }) + ' flex-1'}
        >
          Annuler
        </Link>
        <Button className="flex-1" onClick={start} disabled={starting}>
          {starting ? 'Génération…' : 'Lancer le test'}
        </Button>
      </div>
    </div>
  )
}
