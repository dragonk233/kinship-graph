import { describe, expect, it } from 'vitest'
import { sampleFamily as initialFamily } from './data'
import { addBasicRelationship, addRelatedPerson, anchorIdsFor, ensureSpouseCoParents, genderLabel, replaceDirectRelations, resolvePersonOverlaps, suggestedPersonPlacement } from './relationEditor'
import { calculateKinship } from './kinship'
import type { Person } from './types'

const newcomer: Person = { id: 'new', name: '新人', gender: 'male', birthYear: 2001, generation: 2, x: 0, y: 0 }

describe('完整关系录入', () => {
  it('通过共同父母录入兄弟姐妹', () => {
    expect(anchorIdsFor(initialFamily, 'me', 'sibling')).toEqual(expect.arrayContaining(['father', 'mother']))
    const data = addRelatedPerson(initialFamily, 'me', newcomer, 'sibling', 'father')
    expect(calculateKinship(data, 'me', 'new').codes).toEqual(['lb'])
  })

  it('同年出生的兄弟姐妹按完整生日判断长幼', () => {
    const olderBrother = { ...newcomer, birthYear: 1999, birthDate: '1999-03-01' }
    const youngerSister = { ...newcomer, id: 'younger', gender: 'female' as const, birthYear: 1999, birthDate: '1999-12-01' }
    const viewer = { ...initialFamily.people.find((person) => person.id === 'me')!, birthDate: '1999-08-06' }
    const family = { ...initialFamily, people: initialFamily.people.map((person) => person.id === 'me' ? viewer : person) }

    expect(calculateKinship(addRelatedPerson(family, 'me', olderBrother, 'sibling', 'father'), 'me', 'new').codes).toEqual(['ob'])
    expect(calculateKinship(addRelatedPerson(family, 'me', youngerSister, 'sibling', 'father'), 'me', 'younger').codes).toEqual(['ls'])
    expect(genderLabel('sibling', 'male', viewer, olderBrother)).toBe('哥哥')
    expect(genderLabel('sibling', 'female', viewer, youngerSister)).toBe('妹妹')
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

  it('连续添加亲属时不会把新人物叠在已有卡片上', () => {
    const sonPlacement = suggestedPersonPlacement(initialFamily, 'sister', 'child')
    const withSon = addRelatedPerson(initialFamily, 'sister', { ...newcomer, id: 'sister-son', ...sonPlacement }, 'child')
    const husbandPlacement = suggestedPersonPlacement(withSon, 'sister', 'spouse')
    const cardsOverlap = withSon.people.some((person) => husbandPlacement.x < person.x + 160
      && husbandPlacement.x + 160 > person.x
      && husbandPlacement.y < person.y + 106
      && husbandPlacement.y + 106 > person.y)

    expect(cardsOverlap).toBe(false)
  })

  it('给已有配偶的人添加子女时同时连接夫妻双方', () => {
    const sisterWithHusband = addRelatedPerson(initialFamily, 'sister', { ...newcomer, id: 'brother-in-law' }, 'spouse')
    const family = addRelatedPerson(sisterWithHusband, 'sister', { ...newcomer, id: 'sister-son', generation: 3 }, 'child')

    expect(family.parents).toContainEqual({ parentId: 'sister', childId: 'sister-son' })
    expect(family.parents).toContainEqual({ parentId: 'brother-in-law', childId: 'sister-son' })
  })

  it('打开旧档案时补全单一配偶缺失的共同子女连接', () => {
    const oldData = {
      ...initialFamily,
      people: [...initialFamily.people, { ...newcomer, id: 'brother-in-law' }, { ...newcomer, id: 'niece', generation: 3 }],
      spouses: [...initialFamily.spouses, { personAId: 'sister', personBId: 'brother-in-law' }],
      parents: [...initialFamily.parents, { parentId: 'sister', childId: 'niece' }],
    }

    expect(ensureSpouseCoParents(oldData).parents).toContainEqual({ parentId: 'brother-in-law', childId: 'niece' })
  })

  it('打开旧档案时会修复已经重叠的人物坐标', () => {
    const broken = {
      ...initialFamily,
      people: [...initialFamily.people, { ...newcomer, id: 'overlap', x: 1140, y: 500 }],
    }
    const repaired = resolvePersonOverlaps(broken)
    const moved = repaired.people.find((person) => person.id === 'overlap')!

    expect([moved.x, moved.y]).not.toEqual([1140, 500])
  })

  it('可一次替换已有人物的父母、配偶和子女关系', () => {
    const data = replaceDirectRelations(initialFamily, 'me', ['mother'], ['sister'], ['daughter'])
    expect(data.parents.filter((item) => item.childId === 'me')).toEqual([{ parentId: 'mother', childId: 'me' }])
    expect(data.parents.filter((item) => item.parentId === 'me')).toEqual([{ parentId: 'me', childId: 'daughter' }])
    expect(data.spouses.some((item) => [item.personAId, item.personBId].includes('me'))).toBe(true)
  })

  it('用支点人物和四种基础关系新增连接', () => {
    const withSibling = addBasicRelationship(initialFamily, 'daughter', 'me', 'sibling')
    const myParents = initialFamily.parents.filter((item) => item.childId === 'me').map((item) => item.parentId)
    expect(withSibling.parents.filter((item) => item.childId === 'daughter').map((item) => item.parentId)).toEqual(expect.arrayContaining(myParents))
    expect(addBasicRelationship(initialFamily, 'daughter', 'me', 'spouse').spouses).toContainEqual({ personAId: 'me', personBId: 'daughter' })
  })
})
