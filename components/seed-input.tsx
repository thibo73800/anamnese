'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SeedInput({ initialValue = '' }: { initialValue?: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const seed = value.trim()
        if (seed.length < 2) return
        router.push(`/explore/angles?seed=${encodeURIComponent(seed)}`)
      }}
      className="mx-auto flex w-full max-w-xl gap-2"
    >
      <Input
        name="seed"
        placeholder="Ex: planètes du système solaire, histoire de l'imprimerie…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" aria-label="Explorer">
        <Compass className="size-4" />
      </Button>
    </form>
  )
}
