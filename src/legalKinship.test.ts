import { describe, expect, it } from 'vitest'
import { matchesLegalFilter } from './legalKinship'
import type { FamilyData } from './types'

const people = ['me', 'spouse', 'father', 'grandfather', 'sister', 'uncle', 'cousin', 'nephew', 'fatherInLaw'].map((id) => ({ id, name: id, gender: 'male' as const, birthYear: 1980, generation: 0, x: 0, y: 0 }))
const data: FamilyData = {
  people,
  parents: [
    { parentId: 'grandfather', childId: 'father' },
    { parentId: 'grandfather', childId: 'uncle' },
    { parentId: 'father', childId: 'me' },
    { parentId: 'father', childId: 'sister' },
    { parentId: 'uncle', childId: 'cousin' },
    { parentId: 'sister', childId: 'nephew' },
    { parentId: 'fatherInLaw', childId: 'spouse' },
  ],
  spouses: [{ personAId: 'me', personBId: 'spouse' }],
}

describe('legal kinship filters', () => {
  it('separates direct and collateral blood relatives', () => {
    expect(matchesLegalFilter(data, 'me', 'grandfather', 'direct-blood')).toBe(true)
    expect(matchesLegalFilter(data, 'me', 'sister', 'direct-blood')).toBe(false)
    expect(matchesLegalFilter(data, 'me', 'sister', 'collateral-within-three')).toBe(true)
    expect(matchesLegalFilter(data, 'me', 'cousin', 'collateral-within-three')).toBe(true)
    expect(matchesLegalFilter(data, 'me', 'nephew', 'collateral-within-three')).toBe(true)
  })

  it('matches civil-code close relatives and inheritance orders', () => {
    expect(matchesLegalFilter(data, 'me', 'spouse', 'close-relative')).toBe(true)
    expect(matchesLegalFilter(data, 'me', 'grandfather', 'second-order-heir')).toBe(true)
    expect(matchesLegalFilter(data, 'me', 'cousin', 'close-relative')).toBe(false)
    expect(matchesLegalFilter(data, 'me', 'father', 'first-order-heir')).toBe(true)
  })

  it('keeps spouses separate from affinity and detects in-laws', () => {
    expect(matchesLegalFilter(data, 'me', 'spouse', 'affinal-relative')).toBe(false)
    expect(matchesLegalFilter(data, 'me', 'fatherInLaw', 'affinal-relative')).toBe(true)
  })
})
