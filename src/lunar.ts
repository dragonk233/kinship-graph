const lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const lunarDays = [
  '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

export function isBirthDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function birthYearFromDate(value: string): number {
  return Number(value.slice(0, 4))
}

export function formatSolarBirthday(value: string): string {
  const [year, month, day] = value.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}

export function formatLunarBirthday(value?: string): string | null {
  if (!value || !isBirthDate(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const parts = lunarFormatter.formatToParts(new Date(year, month - 1, day, 12))
  const yearName = parts.find((part) => String(part.type) === 'yearName')?.value
  const lunarMonth = parts.find((part) => part.type === 'month')?.value
  const lunarDay = Number(parts.find((part) => part.type === 'day')?.value)
  if (!yearName || !lunarMonth || !lunarDays[lunarDay]) return null
  return `${yearName}年${lunarMonth}${lunarDays[lunarDay]}`
}
