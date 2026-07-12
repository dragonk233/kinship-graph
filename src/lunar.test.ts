import { describe, expect, it } from 'vitest'
import { birthYearFromDate, formatLunarBirthday, formatSolarBirthday, isBirthDate } from './lunar'

describe('公历与农历生日', () => {
  it('将春节当天换算为农历正月初一', () => {
    expect(formatLunarBirthday('2024-02-10')).toBe('甲辰年正月初一')
    expect(formatLunarBirthday('2000-02-05')).toBe('庚辰年正月初一')
  })

  it('格式化公历生日并提取出生年份', () => {
    expect(formatSolarBirthday('1999-08-06')).toBe('1999年8月6日')
    expect(birthYearFromDate('1999-08-06')).toBe(1999)
  })

  it('拒绝不存在的日期', () => {
    expect(isBirthDate('2024-02-30')).toBe(false)
    expect(formatLunarBirthday('not-a-date')).toBeNull()
  })
})
