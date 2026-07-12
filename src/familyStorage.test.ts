import { describe, expect, it } from 'vitest'
import { compactFamilyData, parseFamilyBackup, serializeFamilyBackup } from './familyStorage'
import type { FamilyData } from './types'

describe('compactFamilyData', () => {
  it('drops archived avatar data and empty notes while preserving relationships', () => {
    const data: FamilyData = {
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, branch: '本家', generation: 2, x: 10, y: 20, note: '  ', avatar: 'data:image/png;base64,large' }],
      parents: [{ parentId: 'father', childId: 'me' }],
      spouses: [],
    }

    expect(compactFamilyData(data)).toEqual({
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, branch: '本家', generation: 2, x: 10, y: 20 }],
      parents: [{ parentId: 'father', childId: 'me' }],
      spouses: [],
    })
  })

  it('trims useful notes', () => {
    const data: FamilyData = {
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, branch: '本家', generation: 2, x: 10, y: 20, note: '  家庭记忆  ' }],
      parents: [],
      spouses: [],
    }

    expect(compactFamilyData(data).people[0].note).toBe('家庭记忆')
  })

  it('preserves a complete Gregorian birthday in backups', () => {
    const data: FamilyData = {
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, birthDate: '1999-08-06', branch: '本家', generation: 2, x: 10, y: 20 }],
      parents: [],
      spouses: [],
    }

    expect(parseFamilyBackup(serializeFamilyBackup(data)).people[0].birthDate).toBe('1999-08-06')
  })

  it('round-trips a compact versioned backup', () => {
    const data: FamilyData = {
      people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, branch: '本家', generation: 2, x: 10, y: 20, avatar: 'data:image/png;base64,large' }],
      parents: [],
      spouses: [],
    }
    const serialized = serializeFamilyBackup(data)

    expect(serialized).not.toContain('avatar')
    expect(parseFamilyBackup(serialized)).toEqual(compactFamilyData(data))
  })

  it('rejects relationships that reference missing people', () => {
    const invalid = JSON.stringify({
      version: 1,
      data: {
        people: [{ id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, branch: '本家', generation: 2, x: 10, y: 20 }],
        parents: [{ parentId: 'missing', childId: 'me' }],
        spouses: [],
      },
    })

    expect(() => parseFamilyBackup(invalid)).toThrow('备份文件格式或家谱关系无效')
  })
})
