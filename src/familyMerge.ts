import type { FamilyData, Person } from './types'

export interface DuplicateCandidate { first: Person; second: Person; reasons: string[] }

const normalizedName = (value: string) => value.replace(/[·\s]/g, '').toLowerCase()

export function findDuplicatePeople(data: FamilyData): DuplicateCandidate[] {
  const result: DuplicateCandidate[] = []
  for (let index = 0; index < data.people.length; index += 1) {
    for (let next = index + 1; next < data.people.length; next += 1) {
      const first = data.people[index]
      const second = data.people[next]
      const reasons: string[] = []
      const namesA = [first.name, ...(first.aliases ?? [])].map(normalizedName)
      const namesB = [second.name, ...(second.aliases ?? [])].map(normalizedName)
      if (namesA.some((name) => namesB.includes(name))) reasons.push('姓名或别名相同')
      if (first.birthDate && first.birthDate === second.birthDate) reasons.push('出生日期相同')
      else if (first.birthYear === second.birthYear) reasons.push('出生年份相同')
      if ((reasons.includes('姓名或别名相同') && reasons.length > 1) || (first.birthDate && first.birthDate === second.birthDate && first.gender === second.gender)) result.push({ first, second, reasons })
    }
  }
  return result
}

export function mergePeople(data: FamilyData, keepId: string, removeId: string): FamilyData {
  const keep = data.people.find((person) => person.id === keepId)
  const remove = data.people.find((person) => person.id === removeId)
  if (!keep || !remove || keepId === removeId) return data
  const merged: Person = {
    ...remove,
    ...keep,
    aliases: [...new Set([...(keep.aliases ?? []), remove.name, ...(remove.aliases ?? [])])].filter((name) => name !== keep.name),
    note: [keep.note, remove.note].filter(Boolean).join('\n'),
    events: [...(keep.events ?? []), ...(remove.events ?? [])].filter((event, index, all) => all.findIndex((item) => item.title === event.title && item.date === event.date) === index),
  }
  const replace = (id: string) => id === removeId ? keepId : id
  const parents = data.parents.map((edge) => ({ ...edge, parentId: replace(edge.parentId), childId: replace(edge.childId) })).filter((edge) => edge.parentId !== edge.childId).filter((edge, index, all) => all.findIndex((item) => item.parentId === edge.parentId && item.childId === edge.childId && item.kind === edge.kind) === index)
  const spouses = data.spouses.map((edge) => ({ ...edge, personAId: replace(edge.personAId), personBId: replace(edge.personBId) })).filter((edge) => edge.personAId !== edge.personBId).filter((edge, index, all) => all.findIndex((item) => [item.personAId, item.personBId].sort().join(':') === [edge.personAId, edge.personBId].sort().join(':')) === index)
  const customTerms = data.customTerms?.map((term) => ({ ...term, viewerId: replace(term.viewerId), targetId: replace(term.targetId) })).filter((term, index, all) => all.findIndex((item) => item.viewerId === term.viewerId && item.targetId === term.targetId) === index)
  return { people: data.people.filter((person) => person.id !== removeId).map((person) => person.id === keepId ? merged : person), parents, spouses, ...(customTerms?.length ? { customTerms } : {}) }
}

export function mergeFamilyData(current: FamilyData, incoming: FamilyData): FamilyData {
  const used = new Set(current.people.map((person) => person.id))
  const idMap = new Map<string, string>()
  incoming.people.forEach((person, index) => {
    let id = person.id
    while (used.has(id)) id = `${person.id}-import-${index + 1}-${Math.random().toString(36).slice(2, 5)}`
    used.add(id); idMap.set(person.id, id)
  })
  return {
    people: [...current.people, ...incoming.people.map((person) => ({ ...person, id: idMap.get(person.id)! }))],
    parents: [...current.parents, ...incoming.parents.map((edge) => ({ ...edge, parentId: idMap.get(edge.parentId)!, childId: idMap.get(edge.childId)! }))],
    spouses: [...current.spouses, ...incoming.spouses.map((edge) => ({ ...edge, personAId: idMap.get(edge.personAId)!, personBId: idMap.get(edge.personBId)! }))],
    customTerms: [...(current.customTerms ?? []), ...(incoming.customTerms ?? []).map((term) => ({ ...term, viewerId: idMap.get(term.viewerId)!, targetId: idMap.get(term.targetId)! }))],
  }
}

