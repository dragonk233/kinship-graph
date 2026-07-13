import { describe, expect, it } from 'vitest'
import { sampleFamily as initialFamily } from './data'
import { inspectFamilyHealth } from './familyHealth'

describe('家谱健康检查', () => {
  it('示例家谱没有明确问题', () => {
    expect(inspectFamilyHealth(initialFamily)).toEqual([])
  })

  it('发现重复关系和异常年龄差', () => {
    const data = {
      ...initialFamily,
      parents: [...initialFamily.parents, initialFamily.parents[0], { parentId: 'me', childId: 'sister' }],
    }
    const issues = inspectFamilyHealth(data)
    expect(issues.some((issue) => issue.title === '重复的亲子关系')).toBe(true)
    expect(issues.some((issue) => issue.title === '出生年份可能有误')).toBe(true)
  })

  it('检查扩展人物与婚姻日期事实', () => {
    const data = {
      ...initialFamily,
      people: initialFamily.people.map((person) => person.id === 'me' ? { ...person, birthDate: '1999-01-01', deathDate: '1998-01-01' } : person),
      spouses: initialFamily.spouses.map((relation, index) => index === 0 ? { ...relation, startDate: '2000-01-01', endDate: '1990-01-01' } : relation),
    }
    const issues = inspectFamilyHealth(data)
    expect(issues.some((issue) => issue.title === '逝世日期早于出生日期')).toBe(true)
    expect(issues.some((issue) => issue.title === '婚姻结束日期早于开始日期')).toBe(true)
  })
})
