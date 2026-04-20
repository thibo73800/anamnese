'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/markdown'

export function ExplanationInfo({
  term,
  explanation,
}: {
  term: string
  explanation: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label="Afficher l'explication détaillée"
      >
        <Info className="text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(95vw,640px)] sm:max-w-[min(95vw,640px)]">
          <DialogHeader>
            <DialogTitle>{term}</DialogTitle>
            <DialogDescription className="sr-only">
              Explication détaillée du concept
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <Markdown>{explanation}</Markdown>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
