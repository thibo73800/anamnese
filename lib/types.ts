import type { Card as FsrsCard } from 'ts-fsrs'

export type CardMode = 'qcm' | 'typing'
export type Rating = 1 | 2 | 3 | 4 // 1=Again 2=Hard 3=Good 4=Easy
export type ImageSource = 'wikimedia' | 'unsplash' | 'google'

export interface QcmChoices {
  distractors: string[]
}

export interface AnamneseCard {
  id: string
  user_id: string
  term: string
  definition: string
  image_url: string | null
  image_source: ImageSource | null
  image_attribution: string | null
  tags: string[]
  theme: string | null
  explanation: string | null
  qcm_choices: QcmChoices
  fsrs_state: FsrsCard
  created_at: string
  updated_at: string
}

export interface ReviewRecord {
  id: string
  card_id: string
  user_id: string
  rating: Rating
  mode_used: CardMode
  response_text: string | null
  reviewed_at: string
  previous_state: FsrsCard
  new_state: FsrsCard
}

export interface ImageHit {
  url: string
  source: ImageSource
  attribution: string | null
}

export interface ThemeExplanation {
  explanation: string
  needsImage: boolean
  imageQuery: string | null
  card: {
    term: string
    definition: string
    suggestedTags: string[]
    distractors: string[]
  }
}

export interface DraftCard {
  localId: string
  term: string
  definition: string
  distractors: [string, string, string]
  image: ImageHit | null
}

export interface DisplayMessage {
  role: 'user' | 'assistant'
  text: string
}
