'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  url: string
  alt?: string
  attribution?: string | null
  heightClass?: string
  className?: string
}

export function ImagePreview({
  url,
  alt = '',
  attribution,
  heightClass = 'h-56',
  className,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <figure className={`overflow-hidden rounded-lg border ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`group relative flex w-full items-center justify-center bg-muted/30 ${heightClass} cursor-zoom-in`}
          aria-label="Agrandir l'image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
          />
        </button>
        {attribution && (
          <figcaption className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
            {attribution}
          </figcaption>
        )}
      </figure>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(95vw,1200px)] p-2 sm:max-w-[min(95vw,1200px)]">
          <DialogTitle className="sr-only">{alt || 'Image'}</DialogTitle>
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              className="max-h-[85vh] w-auto max-w-full rounded-md object-contain"
            />
            {attribution && (
              <p className="text-center text-xs text-muted-foreground">
                {attribution}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
