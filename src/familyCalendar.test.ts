import { describe, expect, it } from 'vitest'
import { buildFamilyCalendar } from './familyCalendar'
import type { FamilyData } from './types'

describe('family calendar', () => {
  it('orders recurring family dates from the current day', () => {
    const data: FamilyData = { people: [
      { id: 'a', name: '甲', gender: 'male', birthYear: 1990, birthDate: '1990-01-01', generation: 0, x: 0, y: 0 },
      { id: 'b', name: '乙', gender: 'female', birthYear: 1992, birthDate: '1992-08-01', generation: 0, x: 0, y: 0 },
    ], parents: [], spouses: [] }
    const result = buildFamilyCalendar(data, new Date('2026-07-13T12:00:00'))
    expect(result.map((entry) => entry.personName)).toEqual(['乙', '甲'])
    expect(result[0].age).toBe(34)
  })
})
