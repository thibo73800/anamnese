'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SearchBar({ initialValue = '' }: { initialValue?: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const q = value.trim()
        if (!q) return
        router.push(`/search?q=${encodeURIComponent(q)}`)
      }}
      className="mx-auto flex w-full max-w-xl gap-2"
    >
      <Input
        name="q"
        placeholder="Ex: Renaissance italienne, photosynthèse, empathie…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <Button type="submit" aria-label="Rechercher">
        <Search className="size-4" />
      </Button>
    </form>
  )
}
