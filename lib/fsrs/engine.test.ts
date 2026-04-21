import { describe, it, expect } from 'vitest'
import { initCard, reviewCard } from './engine'
import { deriveMastery, deriveMode, TYPING_MODE_STABILITY_THRESHOLD_DAYS } from './mode'

describe('FSRS engine', () => {
  it('initialise une carte neuve avec état New', () => {
    const c = initCard()
    expect(c.reps).toBe(0)
    expect(c.lapses).toBe(0)
    expect(c.state).toBe(0) // New
  })

  it('applique les 4 ratings sans crasher', () => {
    const base = initCard()
    for (const rating of [1, 2, 3, 4] as const) {
      const { card, previous } = reviewCard(base, rating)
      expect(previous.reps).toBe(0)
      expect(card.reps).toBe(1)
      expect(card.due.getTime()).toBeGreaterThan(Date.now())
    }
  })

  it('Again (1) incrémente lapses après plusieurs reviews', () => {
    let state = initCard()
    // Monter en Review state via Good x2
    state = reviewCard(state, 3).card
    state = reviewCard(state, 3, new Date(Date.now() + 86400_000)).card
    const before = state.lapses
    state = reviewCard(state, 1, new Date(Date.now() + 2 * 86400_000)).card
    expect(state.lapses).toBe(before + 1)
  })

  it('Easy (4) donne une stabilité supérieure à Good (3)', () => {
    const base = initCard()
    const good = reviewCard(base, 3).card
    const easy = reviewCard(base, 4).card
    expect(easy.stability).toBeGreaterThan(good.stability)
  })

  it('sérialisation/désérialisation JSON préserve le comportement', () => {
    let state = initCard()
    state = reviewCard(state, 3).card
    const serialized = JSON.parse(JSON.stringify(state))
    // Après round-trip JSON, les dates sont des strings — normalize doit gérer ça.
    const { card: next } = reviewCard(serialized, 3, new Date(Date.now() + 86400_000))
    expect(next.reps).toBe(state.reps + 1)
  })
})

describe('deriveMode', () => {
  it('retourne "qcm" pour une carte neuve (stability ≈ 0)', () => {
    const c = initCard()
    expect(deriveMode(c)).toBe('qcm')
  })

  it('bascule en "typing" quand stability >= seuil', () => {
    const c = initCard()
    const stubHigh = { ...c, stability: TYPING_MODE_STABILITY_THRESHOLD_DAYS }
    const stubLow = { ...c, stability: TYPING_MODE_STABILITY_THRESHOLD_DAYS - 0.01 }
    expect(deriveMode(stubHigh)).toBe('typing')
    expect(deriveMode(stubLow)).toBe('qcm')
  })
})

describe('deriveMastery', () => {
  const base = initCard()
  it.each([
    [0, 'new'],
    [1.99, 'new'],
    [2, 'learning'],
    [13.99, 'learning'],
    [14, 'consolidated'],
    [29.99, 'consolidated'],
    [30, 'mastered'],
    [365, 'mastered'],
  ])('stability=%s → %s', (stability, level) => {
    expect(deriveMastery({ ...base, stability }).level).toBe(level)
  })
})
