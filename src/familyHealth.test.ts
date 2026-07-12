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
})
