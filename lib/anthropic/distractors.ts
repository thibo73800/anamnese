import { z } from 'zod'
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages'
import { ANAMNESE_MODEL, getAnthropic } from './client'

const DISTRACTORS_SYSTEM = `Tu génères 3 distracteurs QCM pour une flashcard de culture générale.

Règles :
- Retourne **uniquement** un objet JSON de la forme {"distractors": ["...", "...", "..."]}.
- Exactement 3 distracteurs, tous en français.
- Chaque distracteur est un **terme** (pas une phrase), de longueur et de style similaires au terme correct, plausible mais faux : synonyme partiel, concept voisin du même domaine, faux-ami.
- Pas de répétition du terme correct. Tous distincts entre eux.
- Pas d'émoji, pas de markdown, pas de commentaire autour du JSON.`

const distractorsOutputSchema = z.object({
  distractors: z
    .array(z.string().min(1).max(80))
    .length(3),
})

export async function generateDistractors(input: {
  term: string
  definition: string
  theme?: string | null
}): Promise<[string, string, string]> {
  const client = getAnthropic()
  const userText =
    `Terme: ${input.term}\n` +
    `Définition: ${input.definition}` +
    (input.theme ? `\nThème: ${input.theme}` : '')

  const response = await client.messages.create({
    model: ANAMNESE_MODEL,
    max_tokens: 400,
    system: DISTRACTORS_SYSTEM,
    messages: [{ role: 'user', content: userText }],
  })

  const text = response.content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Distractors LLM: JSON introuvable dans la réponse')
  }
  const parsed = distractorsOutputSchema.parse(
    JSON.parse(text.slice(jsonStart, jsonEnd + 1)),
  )
  const [a, b, c] = parsed.distractors.map((d) => d.trim())
  if (!a || !b || !c) {
    throw new Error('Distractors LLM: distracteur vide')
  }
  return [a, b, c]
}
