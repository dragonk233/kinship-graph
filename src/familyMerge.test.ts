import { describe, expect, it } from 'vitest'
import { findDuplicatePeople, mergePeople } from './familyMerge'
import type { FamilyData } from './types'

const data: FamilyData = {
  people: [
    { id: 'a', name: '王小明', gender: 'male', birthYear: 1999, birthDate: '1999-08-06', generation: 1, x: 0, y: 0, note: '资料甲' },
    { id: 'b', name: '王小明', gender: 'male', birthYear: 1999, birthDate: '1999-08-06', generation: 1, x: 10, y: 0, note: '资料乙' },
    { id: 'father', name: '王建国', gender: 'male', birthYear: 1970, generation: 0, x: 0, y: 0 },
  ],
  parents: [{ parentId: 'father', childId: 'a' }, { parentId: 'father', childId: 'b' }], spouses: [],
}

describe('duplicate people', () => {
  it('finds strong candidates and rewires relationships when merged', () => {
    expect(findDuplicatePeople(data)).toHaveLength(1)
    const merged = mergePeople(data, 'a', 'b')
    expect(merged.people).toHaveLength(2)
    expect(merged.parents).toEqual([{ parentId: 'father', childId: 'a' }])
    expect(merged.people.find((person) => person.id === 'a')?.note).toContain('资料乙')
  })
})

