import Anthropic from '@anthropic-ai/sdk'

let cached: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY manquante')
    }
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return cached
}

export const ANAMNESE_MODEL = 'claude-sonnet-4-6'
