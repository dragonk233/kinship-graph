import { resolvePersonOverlaps } from './relationEditor'
import type { FamilyData, Gender, Person } from './types'

type GedcomRecord = { tag: string; value: string; children: GedcomRecord[] }

function escapeText(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function gedcomDate(value?: string) {
  if (!value) return undefined
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`
}

function isoDate(value?: string) {
  if (!value) return undefined
  const direct = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (direct) return value
  const year = value.match(/\b(\d{4})\b/)?.[1]
  if (!year) return undefined
  const months: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' }
  const month = Object.entries(months).find(([key]) => value.toUpperCase().includes(key))?.[1]
  const day = value.match(/^\s*(\d{1,2})\b/)?.[1]
  return month && day ? `${year}-${month}-${day.padStart(2, '0')}` : `${year}-01-01`
}

export function serializeGedcom(data: FamilyData): string {
  const peopleIds = new Map(data.people.map((person, index) => [person.id, `@I${index + 1}@`]))
  const families = data.spouses.map((spouse, index) => ({ id: `@F${index + 1}@`, spouse, children: data.parents.filter((edge) => edge.parentId === spouse.personAId || edge.parentId === spouse.personBId).map((edge) => edge.childId).filter((id, position, all) => all.indexOf(id) === position && data.parents.some((other) => other.childId === id && ((other.parentId === spouse.personAId || other.parentId === spouse.personBId)))) }))
  const attachedChildren = new Set(families.flatMap((family) => family.children))
  for (const edge of data.parents) {
    if (attachedChildren.has(edge.childId)) continue
    const existing = families.find((family) => family.spouse.personAId === edge.parentId && family.spouse.personBId === edge.parentId)
    if (existing) existing.children.push(edge.childId)
    else families.push({ id: `@F${families.length + 1}@`, spouse: { personAId: edge.parentId, personBId: edge.parentId }, children: [edge.childId] })
    attachedChildren.add(edge.childId)
  }
  const lines = ['0 HEAD', '1 SOUR KINSHIP-GRAPH', '1 CHAR UTF-8', '1 GEDC', '2 VERS 5.5.1']
  for (const person of data.people) {
    lines.push(`0 ${peopleIds.get(person.id)} INDI`, `1 NAME ${escapeText(person.name)}`, `1 SEX ${person.gender === 'male' ? 'M' : 'F'}`)
    if (person.aliases?.length) person.aliases.forEach((alias) => lines.push(`1 _AKA ${escapeText(alias)}`))
    lines.push('1 BIRT')
    if (person.birthDate) lines.push(`2 DATE ${gedcomDate(person.birthDate)}`)
    else lines.push(`2 DATE ${person.birthYear}`)
    if (person.hometown) lines.push(`2 PLAC ${escapeText(person.hometown)}`)
    if (person.living === false || person.deathDate) {
      lines.push('1 DEAT')
      if (person.deathDate) lines.push(`2 DATE ${gedcomDate(person.deathDate)}`)
    }
    if (person.branch) lines.push(`1 _BRANCH ${escapeText(person.branch)}`)
    if (person.note) lines.push(`1 NOTE ${escapeText(person.note)}`)
    person.events?.forEach((event) => {
      lines.push('1 EVEN', `2 TYPE ${escapeText(event.title)}`)
      if (event.date) lines.push(`2 DATE ${gedcomDate(event.date)}`)
      else if (event.year) lines.push(`2 DATE ${event.year}`)
      if (event.place) lines.push(`2 PLAC ${escapeText(event.place)}`)
      if (event.note) lines.push(`2 NOTE ${escapeText(event.note)}`)
    })
  }
  for (const family of families) {
    lines.push(`0 ${family.id} FAM`, `1 HUSB ${peopleIds.get(family.spouse.personAId)}`)
    if (family.spouse.personBId !== family.spouse.personAId) lines.push(`1 WIFE ${peopleIds.get(family.spouse.personBId)}`)
    family.children.forEach((childId) => lines.push(`1 CHIL ${peopleIds.get(childId)}`))
    if (family.spouse.startDate) lines.push('1 MARR', `2 DATE ${gedcomDate(family.spouse.startDate)}`)
    if (family.spouse.status === 'divorced') {
      lines.push('1 DIV')
      if (family.spouse.endDate) lines.push(`2 DATE ${gedcomDate(family.spouse.endDate)}`)
    }
  }
  lines.push('0 TRLR')
  return `${lines.join('\n')}\n`
}

function parseRecords(source: string) {
  const roots: GedcomRecord[] = []
  const stack: { level: number; record: GedcomRecord }[] = []
  source.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z0-9_]+)(?:\s+(.*))?$/i)
    if (!match) return
    const level = Number(match[1])
    const record = { tag: match[3].toUpperCase(), value: match[2] || match[4] || '', children: [] }
    while (stack.length && stack.at(-1)!.level >= level) stack.pop()
    if (stack.length) stack.at(-1)!.record.children.push(record)
    else roots.push(record)
    stack.push({ level, record })
  })
  return roots
}

const child = (record: GedcomRecord | undefined, tag: string) => record?.children.find((item) => item.tag === tag)
const children = (record: GedcomRecord | undefined, tag: string) => record?.children.filter((item) => item.tag === tag) ?? []

export function parseGedcom(source: string): FamilyData {
  const roots = parseRecords(source)
  const individuals = roots.filter((record) => record.tag === 'INDI')
  if (!individuals.length) throw new Error('GEDCOM 文件中没有人物记录')
  const ids = new Map(individuals.map((record, index) => [record.value, `ged-${Date.now()}-${index + 1}`]))
  const people: Person[] = individuals.map((record, index) => {
    const birth = child(record, 'BIRT')
    const death = child(record, 'DEAT')
    const birthDate = isoDate(child(birth, 'DATE')?.value)
    const deathDate = isoDate(child(death, 'DATE')?.value)
    const eventRecords = children(record, 'EVEN')
    return {
      id: ids.get(record.value)!,
      name: child(record, 'NAME')?.value.replace(/\//g, '').trim() || `未命名人物${index + 1}`,
      gender: (child(record, 'SEX')?.value === 'F' ? 'female' : 'male') as Gender,
      birthYear: Number(birthDate?.slice(0, 4) || child(birth, 'DATE')?.value.match(/\d{4}/)?.[0] || 1900),
      ...(birthDate ? { birthDate } : {}),
      ...(death ? { living: false } : {}),
      ...(deathDate ? { deathDate } : {}),
      aliases: children(record, '_AKA').map((item) => item.value).filter(Boolean),
      hometown: child(birth, 'PLAC')?.value,
      branch: child(record, '_BRANCH')?.value,
      note: child(record, 'NOTE')?.value,
      events: eventRecords.map((event, eventIndex) => ({
        id: `event-${Date.now()}-${index}-${eventIndex}`,
        type: 'other' as const,
        title: child(event, 'TYPE')?.value || '家庭事件',
        date: isoDate(child(event, 'DATE')?.value),
        place: child(event, 'PLAC')?.value,
        note: child(event, 'NOTE')?.value,
      })),
      generation: 0,
      x: (index % 6) * 190,
      y: Math.floor(index / 6) * 130,
    }
  })
  const parents: FamilyData['parents'] = []
  const spouses: FamilyData['spouses'] = []
  roots.filter((record) => record.tag === 'FAM').forEach((family) => {
    const first = ids.get(child(family, 'HUSB')?.value ?? '')
    const second = ids.get(child(family, 'WIFE')?.value ?? '')
    if (first && second && first !== second) spouses.push({ personAId: first, personBId: second, status: child(family, 'DIV') ? 'divorced' : 'married', startDate: isoDate(child(child(family, 'MARR'), 'DATE')?.value), endDate: isoDate(child(child(family, 'DIV'), 'DATE')?.value) })
    children(family, 'CHIL').forEach((entry) => {
      const childId = ids.get(entry.value)
      if (!childId) return
      if (first) parents.push({ parentId: first, childId })
      if (second) parents.push({ parentId: second, childId })
    })
  })
  const generations = new Map<string, number>()
  const assign = (id: string, generation: number) => {
    if ((generations.get(id) ?? Infinity) <= generation) return
    generations.set(id, generation)
    parents.filter((edge) => edge.parentId === id).forEach((edge) => assign(edge.childId, generation + 1))
  }
  people.filter((person) => !parents.some((edge) => edge.childId === person.id)).forEach((person) => assign(person.id, 0))
  people.forEach((person) => { person.generation = generations.get(person.id) ?? 0; person.y = person.generation * 130 })
  return resolvePersonOverlaps({ people, parents, spouses })
}
