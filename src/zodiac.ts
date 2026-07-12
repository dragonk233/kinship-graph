export interface ZodiacSign {
  name: string
  emoji: string
}

const ZODIAC_SIGNS: ZodiacSign[] = [
  { name: '鼠', emoji: '🐭' },
  { name: '牛', emoji: '🐮' },
  { name: '虎', emoji: '🐯' },
  { name: '兔', emoji: '🐰' },
  { name: '龙', emoji: '🐲' },
  { name: '蛇', emoji: '🐍' },
  { name: '马', emoji: '🐴' },
  { name: '羊', emoji: '🐐' },
  { name: '猴', emoji: '🐵' },
  { name: '鸡', emoji: '🐔' },
  { name: '狗', emoji: '🐶' },
  { name: '猪', emoji: '🐷' },
]

// 2020 年是鼠年，以此为基准循环计算十二生肖。
export function getZodiac(birthYear: number): ZodiacSign {
  const index = ((birthYear - 2020) % ZODIAC_SIGNS.length + ZODIAC_SIGNS.length) % ZODIAC_SIGNS.length
  return ZODIAC_SIGNS[index]
}

export function formatZodiac(birthYear: number): string {
  const zodiac = getZodiac(birthYear)
  return `${zodiac.emoji} 属${zodiac.name}`
}
