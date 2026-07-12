import { describe, expect, it } from 'vitest'
import { initialFamily } from './data'
import { addRelatedPerson, anchorIdsFor, suggestedPersonPlacement } from './relationEditor'
import { calculateKinship } from './kinship'
import type { Person } from './types'

const newcomer: Person = { id: 'new', name: '新人', gender: 'male', birthYear: 2001, generation: 2, x: 0, y: 0 }

describe('完整关系录入', () => {
  it('通过共同父母录入兄弟姐妹', () => {
    expect(anchorIdsFor(initialFamily, 'me', 'sibling')).toEqual(expect.arrayContaining(['father', 'mother']))
    const data = addRelatedPerson(initialFamily, 'me', newcomer, 'sibling', 'father')
    expect(calculateKinship(data, 'me', 'new').codes).toEqual(['lb'])
  })

  it('通过父母录入祖辈', () => {
    const data = addRelatedPerson(initialFamily, 'me', { ...newcomer, birthYear: 1930 }, 'grandparent', 'father')
    expect(calculateKinship(data, 'me', 'new').codes).toEqual(['f', 'f'])
  })

  it('支持任选人物进行精确连接', () => {
    const data = addRelatedPerson(initialFamily, 'me', newcomer, 'custom', 'aunt', 'child')
    expect(data.parents).toContainEqual({ parentId: 'aunt', childId: 'new' })
  })

  it('按事实连接计算新人物所在世代', () => {
    expect(suggestedPersonPlacement(initialFamily, 'me', 'sibling', 'father').generation).toBe(2)
    expect(suggestedPersonPlacement(initialFamily, 'me', 'pibling', 'p-gf').generation).toBe(1)
    expect(suggestedPersonPlacement(initialFamily, 'me', 'custom', 'daughter', 'child').generation).toBe(3)
  })
})
