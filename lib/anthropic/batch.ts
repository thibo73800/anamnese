import type {
  ContentBlockParam,
  MessageParam,
  TextBlock,
  Tool,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages'
import { z } from 'zod'
import { ANAMNESE_MODEL, getAnthropic } from './client'
import { BATCH_SYSTEM, formatState } from './prompts/batch'
import type { DraftCard } from '@/lib/types'

export const BATCH_TOOLS: Tool[] = [
  {
    name: 'create_cards',
    description:
      'Ajoute une ou plusieurs flashcards au set. Chaque carte contient un terme, une définition, et 3 distracteurs QCM plausibles. Retourne les localId assignés.',
    input_schema: {
      type: 'object',
      properties: {
        cards: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: {
            type: 'object',
            properties: {
              term: { type: 'string', minLength: 1, maxLength: 120 },
              definition: { type: 'string', minLength: 1, maxLength: 600 },
              distractors: {
                type: 'array',
                items: { type: 'string', minLength: 1, maxLength: 80 },
                minItems: 3,
                maxItems: 3,
              },
            },
            required: ['term', 'definition', 'distractors'],
          },
        },
      },
      required: ['cards'],
    },
  },
  {
    name: 'edit_card',
    description:
      "Modifie une carte existante. Utilise le localId fourni dans l'état courant. Tu peux modifier term, definition, et/ou distractors.",
    input_schema: {
      type: 'object',
      properties: {
        localId: { type: 'string', minLength: 1 },
        patch: {
          type: 'object',
          properties: {
            term: { type: 'string', minLength: 1, maxLength: 120 },
            definition: { type: 'string', minLength: 1, maxLength: 600 },
            distractors: {
              type: 'array',
              items: { type: 'string', minLength: 1, maxLength: 80 },
              minItems: 3,
              maxItems: 3,
            },
          },
        },
      },
      required: ['localId', 'patch'],
    },
  },
  {
    name: 'delete_card',
    description:
      "Supprime une carte du set via son localId (présent dans l'état courant).",
    input_schema: {
      type: 'object',
      properties: {
        localId: { type: 'string', minLength: 1 },
      },
      required: ['localId'],
    },
  },
  {
    name: 'propose_tags',
    description:
      'Remplace la liste des tags partagés du set par celle fournie. Tags courts, en minuscules, 1 à 8.',
    input_schema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 40 },
          minItems: 1,
          maxItems: 8,
        },
      },
      required: ['tags'],
    },
  },
]

const createCardsInput = z.object({
  cards: z
    .array(
      z.object({
        term: z.string().min(1).max(120),
        definition: z.string().min(1).max(600),
        distractors: z
          .array(z.string().min(1).max(80))
          .length(3),
      }),
    )
    .min(1)
    .max(20),
})

const editCardInput = z.object({
  localId: z.string().min(1),
  patch: z.object({
    term: z.string().min(1).max(120).optional(),
    definition: z.string().min(1).max(600).optional(),
    distractors: z.array(z.string().min(1).max(80)).length(3).optional(),
  }),
})

const deleteCardInput = z.object({
  localId: z.string().min(1),
})

const proposeTagsInput = z.object({
  tags: z.array(z.string().min(1).max(40)).min(1).max(8),
})

type State = { draftCards: DraftCard[]; sharedTags: string[] }
type ToolOutcome = { text: string; isError?: boolean; state: State }

function applyTool(
  name: string,
  rawInput: unknown,
  state: State,
): ToolOutcome {
  try {
    switch (name) {
      case 'create_cards': {
        const { cards } = createCardsInput.parse(rawInput)
        const newCards: DraftCard[] = cards.map((c) => ({
          localId: crypto.randomUUID(),
          term: c.term.trim(),
          definition: c.definition.trim(),
          distractors: [
            c.distractors[0].trim(),
            c.distractors[1].trim(),
            c.distractors[2].trim(),
          ],
          image: null,
        }))
        const next = [...state.draftCards, ...newCards]
        const ids = newCards.map((c) => `[${c.localId}] ${c.term}`).join('\n')
        return {
          text: `OK, ${newCards.length} carte(s) ajoutée(s). Le set contient maintenant ${next.length} carte(s).\nNouvelles cartes:\n${ids}`,
          state: { ...state, draftCards: next },
        }
      }
      case 'edit_card': {
        const { localId, patch } = editCardInput.parse(rawInput)
        const idx = state.draftCards.findIndex((c) => c.localId === localId)
        if (idx === -1) {
          return {
            text: `Erreur: aucune carte avec localId="${localId}". Cartes actuelles: ${state.draftCards.map((c) => c.localId).join(', ') || '(vide)'}`,
            isError: true,
            state,
          }
        }
        const current = state.draftCards[idx]
        const updated: DraftCard = {
          ...current,
          term: patch.term?.trim() ?? current.term,
          definition: patch.definition?.trim() ?? current.definition,
          distractors: patch.distractors
            ? [
                patch.distractors[0].trim(),
                patch.distractors[1].trim(),
                patch.distractors[2].trim(),
              ]
            : current.distractors,
        }
        const next = [...state.draftCards]
        next[idx] = updated
        return {
          text: `OK, carte [${localId}] modifiée. Nouveau term: "${updated.term}".`,
          state: { ...state, draftCards: next },
        }
      }
      case 'delete_card': {
        const { localId } = deleteCardInput.parse(rawInput)
        const exists = state.draftCards.some((c) => c.localId === localId)
        if (!exists) {
          return {
            text: `Erreur: aucune carte avec localId="${localId}".`,
            isError: true,
            state,
          }
        }
        const next = state.draftCards.filter((c) => c.localId !== localId)
        return {
          text: `OK, carte [${localId}] supprimée. Il reste ${next.length} carte(s).`,
          state: { ...state, draftCards: next },
        }
      }
      case 'propose_tags': {
        const { tags } = proposeTagsInput.parse(rawInput)
        const clean = Array.from(
          new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
        )
        return {
          text: `OK, tags partagés mis à jour: ${clean.join(', ')}.`,
          state: { ...state, sharedTags: clean },
        }
      }
      default:
        return {
          text: `Erreur: outil inconnu "${name}".`,
          isError: true,
          state,
        }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      text: `Erreur de validation: ${msg}`,
      isError: true,
      state,
    }
  }
}

const MAX_ITERATIONS = 5

export async function runBatchTurn(input: {
  history: MessageParam[]
  userText: string
  draftCards: DraftCard[]
  sharedTags: string[]
}): Promise<{
  assistantText: string
  draftCards: DraftCard[]
  sharedTags: string[]
}> {
  const client = getAnthropic()

  const userContent: ContentBlockParam[] = [
    { type: 'text', text: formatState(input.draftCards, input.sharedTags) },
    { type: 'text', text: `Message: ${input.userText}` },
  ]

  const apiMessages: MessageParam[] = [
    ...input.history,
    { role: 'user', content: userContent },
  ]

  let state: State = {
    draftCards: [...input.draftCards],
    sharedTags: [...input.sharedTags],
  }
  let assistantText = ''

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: ANAMNESE_MODEL,
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: BATCH_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: BATCH_TOOLS,
      messages: apiMessages,
    })

    apiMessages.push({ role: 'assistant', content: response.content })

    const textBlocks = response.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text.trim())
      .filter(Boolean)
    if (textBlocks.length > 0) assistantText = textBlocks.join('\n\n')

    if (response.stop_reason !== 'tool_use') break

    const toolUses = response.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use',
    )
    if (toolUses.length === 0) break

    const toolResults: ContentBlockParam[] = []
    for (const tu of toolUses) {
      const outcome = applyTool(tu.name, tu.input, state)
      state = outcome.state
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: outcome.text,
        is_error: outcome.isError ?? false,
      })
    }
    apiMessages.push({ role: 'user', content: toolResults })
  }

  if (!assistantText) {
    assistantText = 'Modifications appliquées.'
  }

  return {
    assistantText,
    draftCards: state.draftCards,
    sharedTags: state.sharedTags,
  }
}
