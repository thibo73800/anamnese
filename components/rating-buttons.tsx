'use client'

import { Button } from '@/components/ui/button'
import type { Rating } from '@/lib/types'

const BUTTONS: Array<{
  value: Rating
  label: string
  hint: string
  variant: 'destructive' | 'outline' | 'secondary' | 'default'
}> = [
  { value: 1, label: 'Encore', hint: '< 1 min', variant: 'destructive' },
  { value: 2, label: 'Difficile', hint: '', variant: 'outline' },
  { value: 3, label: 'Bien', hint: '', variant: 'secondary' },
  { value: 4, label: 'Facile', hint: '', variant: 'default' },
]

export function RatingButtons({
  onRate,
}: {
  onRate: (rating: Rating) => void | Promise<void>
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {BUTTONS.map((b) => (
        <Button
          key={b.value}
          variant={b.variant}
          onClick={() => {
            void onRate(b.value)
          }}
          className="flex flex-col gap-0.5 h-auto min-h-[44px] py-3"
        >
          <span className="font-medium">{b.label}</span>
        </Button>
      ))}
    </div>
  )
}
