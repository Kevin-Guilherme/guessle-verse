import { describe, it, expect } from 'vitest'
import { computeFeedback } from './feedback'
import type { FeedbackType } from '../types/game.types'

describe('computeFeedback', () => {
  describe('exact', () => {
    it('returns correct when values match', () => {
      expect(computeFeedback('fire', 'fire', 'exact')).toBe('correct')
    })
    it('returns wrong when values differ', () => {
      expect(computeFeedback('fire', 'water', 'exact')).toBe('wrong')
    })
  })

  describe('partial', () => {
    it('returns correct when arrays fully overlap', () => {
      expect(computeFeedback(['fire', 'flying'], ['fire', 'flying'], 'partial')).toBe('correct')
    })
    it('returns partial when arrays partially overlap', () => {
      expect(computeFeedback(['fire', 'poison'], ['fire', 'flying'], 'partial')).toBe('partial')
    })
    it('returns wrong when no overlap', () => {
      expect(computeFeedback(['water'], ['fire'], 'partial')).toBe('wrong')
    })
    it('handles scalar equality', () => {
      expect(computeFeedback('red', 'red', 'partial')).toBe('correct')
    })
    it('returns correct when guess is superset of target', () => {
      expect(computeFeedback(['fire', 'flying', 'poison'], ['fire', 'flying'], 'partial')).toBe('correct')
    })
  })

  describe('arrow', () => {
    it('returns correct when equal', () => {
      expect(computeFeedback(5, 5, 'arrow')).toBe('correct')
    })
    it('returns higher when guess is less than target', () => {
      expect(computeFeedback(3, 7, 'arrow')).toBe('higher')
    })
    it('returns lower when guess is greater than target', () => {
      expect(computeFeedback(9, 5, 'arrow')).toBe('lower')
    })
    it('returns wrong for non-numeric input', () => {
      expect(computeFeedback('abc', 5, 'arrow')).toBe('wrong')
    })
  })
})
