import { describe, it, expect } from 'vitest'
import { calculateScore, shouldRevealHint } from './score'

describe('calculateScore', () => {
  it('returns 1000 on first attempt with no hints', () => {
    expect(calculateScore(1, 0)).toBe(1000)
  })
  it('deducts 40 per wrong attempt', () => {
    expect(calculateScore(3, 0)).toBe(920)
  })
  it('deducts 150 for first hint', () => {
    expect(calculateScore(1, 1)).toBe(850)
  })
  it('deducts 350 for both hints', () => {
    expect(calculateScore(1, 2)).toBe(650)
  })
  it('never returns below 50', () => {
    expect(calculateScore(100, 2)).toBe(50)
  })
})

describe('shouldRevealHint', () => {
  it('returns null before 5 attempts', () => {
    expect(shouldRevealHint(4)).toBeNull()
  })
  it('returns 1 at 5 attempts', () => {
    expect(shouldRevealHint(5)).toBe(1)
  })
  it('returns 2 at 10 attempts', () => {
    expect(shouldRevealHint(10)).toBe(2)
  })
  it('returns 1 between 5 and 9 attempts', () => {
    expect(shouldRevealHint(9)).toBe(1)
  })
})
