import { describe, expect, it } from 'vitest'
import { parseGedcom, serializeGedcom } from './gedcom'
import type { FamilyData } from './types'

describe('GEDCOM portability', () => {
  it('exports and imports people, parent links, marriage facts and life details', () => {
    const data: FamilyData = {
      people: [
        { id: 'father', name: '王建国', gender: 'male', birthYear: 1970, birthDate: '1970-04-03', hometown: '泉州', generation: 0, x: 0, y: 0 },
        { id: 'mother', name: '林秀英', aliases: ['阿英'], gender: 'female', birthYear: 1972, generation: 0, x: 180, y: 0 },
        { id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 1, x: 90, y: 130, events: [{ id: 'e1', type: 'education', title: '大学毕业', date: '2021-06-20', place: '厦门' }] },
      ],
      parents: [{ parentId: 'father', childId: 'me' }, { parentId: 'mother', childId: 'me' }],
      spouses: [{ personAId: 'father', personBId: 'mother', status: 'married', startDate: '1995-01-02' }],
    }
    const source = serializeGedcom(data)
    const imported = parseGedcom(source)

    expect(source).toContain('1 SOUR KINSHIP-GRAPH')
    expect(imported.people.map((person) => person.name)).toEqual(expect.arrayContaining(['王建国', '林秀英', '王晓明']))
    expect(imported.parents).toHaveLength(2)
    expect(imported.spouses[0].startDate).toBe('1995-01-02')
    expect(imported.people.find((person) => person.name === '王晓明')?.events?.[0].title).toBe('大学毕业')
  })
})

