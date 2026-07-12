import { describe, expect, it } from 'vitest'
import { formatZodiac, getZodiac } from './zodiac'

describe('生肖计算', () => {
  it.each([
    [1940, '龙', '🐲'],
    [1999, '兔', '🐰'],
    [2000, '龙', '🐲'],
    [2025, '蛇', '🐍'],
  ])('%i 年对应生肖%s', (year, name, emoji) => {
    expect(getZodiac(year)).toEqual({ name, emoji })
  })

  it('每十二年循环一次', () => {
    expect(getZodiac(1984)).toEqual(getZodiac(2020))
  })

  it('生成带 emoji 的人物描述', () => {
    expect(formatZodiac(1999)).toBe('🐰 属兔')
  })
})
