'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { DownloadIcon, ShareIcon, PlusSquareIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const STANDALONE_QUERY = '(display-mode: standalone)'

function subscribeStandalone(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(STANDALONE_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function readStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function readIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIosDevice = /iPad|iPhone|iPod/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return isIosDevice && isSafari
}

// Subscription shared by detectors that do not change at runtime.
const noopSubscribe = () => () => {}

export function InstallButton() {
  const standalone = useSyncExternalStore(
    subscribeStandalone,
    readStandalone,
    () => false,
  )
  const iosSafari = useSyncExternalStore(noopSubscribe, readIosSafari, () => false)

  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (standalone || installed) return null

  if (promptEvent) {
    return (
      <Button
        variant="outline"
        size="lg"
        className="w-full justify-start gap-2"
        onClick={async () => {
          await promptEvent.prompt()
          await promptEvent.userChoice
          setPromptEvent(null)
        }}
      >
        <DownloadIcon />
        {"Installer l'application"}
      </Button>
    )
  }

  if (iosSafari) {
    return (
      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-2"
            />
          }
        >
          <DownloadIcon />
          {"Installer l'application"}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Ajouter à l'écran d'accueil"}</DialogTitle>
            <DialogDescription>
              {"Sur iPhone / iPad, l'installation se fait depuis Safari en trois gestes."}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <ShareIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                {"Appuie sur l'icône "}
                <strong>Partager</strong>
                {" dans la barre Safari."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <PlusSquareIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                {'Choisis '}
                <strong>{"Sur l'écran d'accueil"}</strong>
                {'.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-muted-foreground">→</span>
              <span>
                {'Confirme avec '}
                <strong>Ajouter</strong>
                {'.'}
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
