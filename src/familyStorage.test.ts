import { describe, expect, it } from 'vitest'
import { compactFamilyData, parseFamilyBackup, serializeFamilyBackup, serializeFamilyMarkdown } from './familyStorage'
import type { FamilyData } from './types'

describe('compactFamilyData', () => {
  it('drops archived avatar data and empty notes while preserving relationships', () => {
    const data: FamilyData = {
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 2, x: 10, y: 20, note: '  ', avatar: 'data:image/png;base64,large' }],
      parents: [{ parentId: 'father', childId: 'me' }],
      spouses: [],
    }

    expect(compactFamilyData(data)).toEqual({
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 2, x: 10, y: 20 }],
      parents: [{ parentId: 'father', childId: 'me' }],
      spouses: [],
    })
  })

  it('trims useful notes', () => {
    const data: FamilyData = {
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 2, x: 10, y: 20, note: '  家庭记忆  ' }],
      parents: [],
      spouses: [],
    }

    expect(compactFamilyData(data).people[0].note).toBe('家庭记忆')
  })

  it('preserves a complete Gregorian birthday in backups', () => {
    const data: FamilyData = {
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, birthDate: '1999-08-06', generation: 2, x: 10, y: 20 }],
      parents: [],
      spouses: [],
    }

    expect(parseFamilyBackup(serializeFamilyBackup(data)).people[0].birthDate).toBe('1999-08-06')
  })

  it('round-trips a compact versioned backup', () => {
    const data: FamilyData = {
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 2, x: 10, y: 20, avatar: 'data:image/png;base64,large' }],
      parents: [],
      spouses: [],
    }
    const serialized = serializeFamilyBackup(data)

    expect(serialized).not.toContain('avatar')
    expect(parseFamilyBackup(serialized)).toEqual(compactFamilyData(data))
  })

  it('round-trips trimmed family-specific terms in version 3 backups', () => {
    const data: FamilyData = {
      people: [
        { id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 2, x: 10, y: 20 },
        { id: 'uncle', name: '林志强', gender: 'male', birthYear: 1976, generation: 1, x: 30, y: 20 },
      ],
      parents: [], spouses: [], customTerms: [{ viewerId: 'me', targetId: 'uncle', label: '  阿舅  ' }],
    }
    const serialized = serializeFamilyBackup(data)
    expect(JSON.parse(serialized).version).toBe(3)
    expect(parseFamilyBackup(serialized).customTerms?.[0].label).toBe('阿舅')
  })

  it('accepts old backups and preserves a branch field that is supported again', () => {
    const legacy = JSON.stringify({
      version: 1,
      data: {
        people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, branch: '本家', generation: 2, x: 10, y: 20 }],
        parents: [],
        spouses: [],
      },
    })

    expect(parseFamilyBackup(legacy).people[0].branch).toBe('本家')
  })

  it('round-trips life facts and typed relationships without media', () => {
    const data: FamilyData = {
      people: [
        { id: 'mother', name: '林秀英', aliases: ['阿英'], gender: 'female', birthYear: 1972, birthDate: '1972-02-03', hometown: '泉州', branch: '母系林氏', generation: 1, x: 0, y: 0 },
        { id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 2, x: 10, y: 20, events: [{ id: 'e1', type: 'residence', title: '迁居厦门', date: '2010-06-01' }] },
      ],
      parents: [{ parentId: 'mother', childId: 'me', kind: 'adoptive' }],
      spouses: [{ personAId: 'mother', personBId: 'me', status: 'former', startDate: '1990-01-01', endDate: '1991-01-01' }],
    }

    expect(parseFamilyBackup(serializeFamilyBackup(data))).toEqual(compactFamilyData(data))
  })

  it('rejects relationships that reference missing people', () => {
    const invalid = JSON.stringify({
      version: 1,
      data: {
        people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 2, x: 10, y: 20 }],
        parents: [{ parentId: 'missing', childId: 'me' }],
        spouses: [],
      },
    })

    expect(() => parseFamilyBackup(invalid)).toThrow('备份文件格式或家谱关系无效')
  })

  it('exports a readable Markdown family tree without exposing internal ids', () => {
    const data: FamilyData = {
      people: [
        { id: 'father-private-id', name: '王建国', gender: 'male', birthYear: 1970, generation: 1, x: 10, y: 20, note: '祖籍|泉州' },
        { id: 'me-private-id', name: '王晓明', gender: 'male', birthYear: 1999, birthDate: '1999-08-06', generation: 2, x: 10, y: 20 },
      ],
      parents: [{ parentId: 'father-private-id', childId: 'me-private-id' }],
      spouses: [{ personAId: 'father-private-id', personBId: 'me-private-id' }],
    }

    const markdown = serializeFamilyMarkdown(data, new Date('2026-07-12T00:00:00Z'))

    expect(markdown).toContain('导出日期：2026-07-12')
    expect(markdown).toContain('```mermaid\nflowchart TB')
    expect(markdown).toContain('person_1 -->|亲子| person_2')
    expect(markdown).toContain('person_1 ---|夫妻| person_2')
    expect(markdown).toContain('王晓明 | 男 | 1999-08-06')
    expect(markdown).toContain('祖籍\\|泉州')
    expect(markdown).not.toContain('father-private-id')
  })
})
