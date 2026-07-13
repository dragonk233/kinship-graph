import type { FamilyData, LifeEventType } from './types'
import { formatLunarBirthday } from './lunar'

export interface FamilyCalendarEntry {
  id: string
  personId: string
  personName: string
  title: string
  kind: LifeEventType | 'birthday' | 'memorial'
  date: string
  monthDay: string
  nextDate: Date
  age?: number
  place?: string
  lunar?: string
}

function nextOccurrence(date: string, now: Date) {
  const [, month, day] = date.split('-').map(Number)
  let next = new Date(now.getFullYear(), month - 1, day, 12)
  if (next.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) next = new Date(now.getFullYear() + 1, month - 1, day, 12)
  return next
}

export function buildFamilyCalendar(data: FamilyData, now = new Date()): FamilyCalendarEntry[] {
  const entries: FamilyCalendarEntry[] = []
  data.people.forEach((person) => {
    if (person.birthDate) entries.push({ id: `birthday:${person.id}`, personId: person.id, personName: person.name, title: `${person.name}生日`, kind: 'birthday', date: person.birthDate, monthDay: person.birthDate.slice(5), nextDate: nextOccurrence(person.birthDate, now), age: nextOccurrence(person.birthDate, now).getFullYear() - person.birthYear, lunar: formatLunarBirthday(person.birthDate) ?? undefined })
    if (person.deathDate) entries.push({ id: `memorial:${person.id}`, personId: person.id, personName: person.name, title: `${person.name}纪念日`, kind: 'memorial', date: person.deathDate, monthDay: person.deathDate.slice(5), nextDate: nextOccurrence(person.deathDate, now) })
    person.events?.filter((event) => event.date).forEach((event) => entries.push({ id: event.id, personId: person.id, personName: person.name, title: event.title, kind: event.type, date: event.date!, monthDay: event.date!.slice(5), nextDate: nextOccurrence(event.date!, now), place: event.place }))
  })
  return entries.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
}
