import type { FamilyData, Gender, Person } from './types'

export type RelationKind = 'parent' | 'child' | 'spouse' | 'sibling' | 'grandparent' | 'grandchild' | 'pibling' | 'nibling' | 'parentInLaw' | 'custom'
export type DirectRelation = 'parent' | 'child' | 'spouse'

export interface RelationOption {
  id: RelationKind
  group: '直系亲人' | '同辈旁系' | '隔代亲人' | '姻亲' | '精确连接'
  label: string
  description: string
}

export const relationOptions: RelationOption[] = [
  { id: 'parent', group: '直系亲人', label: '父母', description: '新人物是当前主视角的父亲或母亲' },
  { id: 'child', group: '直系亲人', label: '子女', description: '新人物是当前主视角的儿子或女儿' },
  { id: 'spouse', group: '直系亲人', label: '配偶', description: '新人物是当前主视角的丈夫或妻子' },
  { id: 'sibling', group: '同辈旁系', label: '兄弟姐妹', description: '通过当前主视角的一位父母建立共同父母关系' },
  { id: 'pibling', group: '同辈旁系', label: '叔伯姑姨舅', description: '通过当前主视角的一位祖辈建立父母关系' },
  { id: 'nibling', group: '同辈旁系', label: '侄子侄女／外甥', description: '作为当前主视角一位兄弟姐妹的子女' },
  { id: 'grandparent', group: '隔代亲人', label: '祖父母／外祖父母', description: '作为当前主视角一位父母的父母' },
  { id: 'grandchild', group: '隔代亲人', label: '孙辈／外孙辈', description: '作为当前主视角一位子女的子女' },
  { id: 'parentInLaw', group: '姻亲', label: '岳父母／公婆', description: '作为当前主视角配偶的父母' },
  { id: 'custom', group: '精确连接', label: '通过已有亲人连接', description: '任选一位已有亲人，明确新人物与他的直接关系' },
]

function parentIds(data: FamilyData, id: string) {
  return data.parents.filter((item) => item.childId === id).map((item) => item.parentId)
}

function childIds(data: FamilyData, id: string) {
  return data.parents.filter((item) => item.parentId === id).map((item) => item.childId)
}

function spouseIds(data: FamilyData, id: string) {
  return data.spouses.flatMap((item) => item.personAId === id ? [item.personBId] : item.personBId === id ? [item.personAId] : [])
}

export function anchorIdsFor(data: FamilyData, viewerId: string, kind: RelationKind): string[] {
  if (kind === 'sibling' || kind === 'grandparent') return parentIds(data, viewerId)
  if (kind === 'grandchild') return childIds(data, viewerId)
  if (kind === 'parentInLaw') return spouseIds(data, viewerId)
  if (kind === 'pibling') return [...new Set(parentIds(data, viewerId).flatMap((id) => parentIds(data, id)))]
  if (kind === 'nibling') {
    const parents = new Set(parentIds(data, viewerId))
    return data.people.filter((person) => person.id !== viewerId && parentIds(data, person.id).some((id) => parents.has(id))).map((person) => person.id)
  }
  if (kind === 'custom') return data.people.map((person) => person.id)
  return []
}

export function relationPreview(data: FamilyData, viewerId: string, kind: RelationKind, anchorId?: string, direct: DirectRelation = 'child') {
  const viewer = data.people.find((person) => person.id === viewerId)
  const anchor = data.people.find((person) => person.id === anchorId)
  if (!viewer) return ''
  if (kind === 'parent') return `新人物 → 是 ${viewer.name} 的父母`
  if (kind === 'child') return `${viewer.name} → 是新人物的父母`
  if (kind === 'spouse') return `${viewer.name} ⇄ 新人物（配偶）`
  if (!anchor) return '请选择用于建立关系的已有亲人'
  if (kind === 'custom') {
    if (direct === 'parent') return `新人物 → 是 ${anchor.name} 的父母`
    if (direct === 'child') return `${anchor.name} → 是新人物的父母`
    return `${anchor.name} ⇄ 新人物（配偶）`
  }
  if (kind === 'sibling') return `${anchor.name} → 同时是 ${viewer.name} 与新人物的父母`
  if (kind === 'grandparent') return `新人物 → 是 ${anchor.name} 的父母 → ${viewer.name} 的祖辈`
  if (kind === 'grandchild') return `${anchor.name} → 是新人物的父母 → ${viewer.name} 的孙辈`
  if (kind === 'pibling') return `${anchor.name} → 是新人物的父母 → ${viewer.name} 的叔伯姑姨舅`
  if (kind === 'nibling') return `${anchor.name} → 是新人物的父母 → ${viewer.name} 的侄甥辈`
  return `新人物 → 是 ${anchor.name} 的父母 → ${viewer.name} 的姻亲长辈`
}

export function addRelatedPerson(data: FamilyData, viewerId: string, person: Person, kind: RelationKind, anchorId?: string, direct: DirectRelation = 'child'): FamilyData {
  const next: FamilyData = { ...data, people: [...data.people, person], parents: [...data.parents], spouses: [...data.spouses] }
  const addDirect = (relativeId: string, relation: DirectRelation) => {
    if (relation === 'parent') next.parents.push({ parentId: person.id, childId: relativeId })
    if (relation === 'child') next.parents.push({ parentId: relativeId, childId: person.id })
    if (relation === 'spouse') next.spouses.push({ personAId: relativeId, personBId: person.id })
  }
  if (kind === 'parent') addDirect(viewerId, 'parent')
  else if (kind === 'child') addDirect(viewerId, 'child')
  else if (kind === 'spouse') addDirect(viewerId, 'spouse')
  else if (anchorId) {
    if (kind === 'grandparent' || kind === 'parentInLaw') addDirect(anchorId, 'parent')
    else if (kind === 'custom') addDirect(anchorId, direct)
    else addDirect(anchorId, 'child')
  }
  return next
}

export function suggestedPersonPlacement(data: FamilyData, viewerId: string, kind: RelationKind, anchorId?: string, direct: DirectRelation = 'child') {
  const viewer = data.people.find((person) => person.id === viewerId)!
  const anchor = data.people.find((person) => person.id === anchorId) ?? viewer
  const up = kind === 'parent' || kind === 'grandparent' || kind === 'parentInLaw' || (kind === 'custom' && direct === 'parent')
  const down = kind === 'child' || kind === 'grandchild' || kind === 'nibling' || kind === 'sibling' || kind === 'pibling' || (kind === 'custom' && direct === 'child')
  const generation = Math.max(0, Math.min(3, anchor.generation + (up ? -1 : down ? 1 : 0)))
  return { generation, ...findVacantPosition(data.people, anchor.x, 80 + generation * 210) }
}

const CARD_WIDTH = 148
const CARD_HEIGHT = 94
const STAGE_WIDTH = 1400
const STAGE_HEIGHT = 830
const CARD_GAP = 12

function overlapsAny(people: Person[], x: number, y: number) {
  return people.some((person) => x < person.x + CARD_WIDTH + CARD_GAP
    && x + CARD_WIDTH + CARD_GAP > person.x
    && y < person.y + CARD_HEIGHT + CARD_GAP
    && y + CARD_HEIGHT + CARD_GAP > person.y)
}

function findVacantPosition(people: Person[], preferredX: number, preferredY: number) {
  const maxX = STAGE_WIDTH - CARD_WIDTH - 20
  const maxY = STAGE_HEIGHT - CARD_HEIGHT - 20
  const xCandidates = Array.from({ length: Math.floor((maxX - 20) / 10) + 1 }, (_, index) => 20 + index * 10)
    .sort((a, b) => Math.abs(a - preferredX) - Math.abs(b - preferredX))
  const yCandidates = [preferredY, preferredY + 110, preferredY - 110, preferredY + 220, preferredY - 220]
    .filter((y) => y >= 20 && y <= maxY)

  for (const y of yCandidates) {
    for (const x of xCandidates) {
      if (!overlapsAny(people, x, y)) return { x, y }
    }
  }

  // 极端拥挤时仍保证不会再次返回一个已有坐标。
  const fallbackX = Math.max(20, Math.min(maxX, preferredX))
  const used = new Set(people.map((person) => `${person.x}:${person.y}`))
  for (let y = 20; y <= maxY; y += 10) {
    for (let x = 20; x <= maxX; x += 10) {
      if (!used.has(`${x}:${y}`)) return { x, y }
    }
  }
  return { x: fallbackX, y: Math.max(20, Math.min(maxY, preferredY)) }
}

/** Repairs positions saved by older versions whose capped x coordinate caused cards to overlap. */
export function resolvePersonOverlaps(data: FamilyData): FamilyData {
  const placed: Person[] = []
  let changed = false
  const people = data.people.map((person) => {
    if (!overlapsAny(placed, person.x, person.y)) {
      placed.push(person)
      return person
    }
    const position = findVacantPosition(placed, person.x, person.y)
    const moved = { ...person, ...position }
    placed.push(moved)
    changed = true
    return moved
  })
  return changed ? { ...data, people } : data
}

export function genderLabel(kind: RelationKind, gender: Gender) {
  const labels: Partial<Record<RelationKind, [string, string]>> = {
    parent: ['父亲', '母亲'], child: ['儿子', '女儿'], spouse: ['丈夫', '妻子'],
    sibling: ['兄弟', '姐妹'], grandparent: ['祖父／外祖父', '祖母／外祖母'],
    grandchild: ['孙子／外孙', '孙女／外孙女'], pibling: ['叔伯／舅舅', '姑姑／姨妈'],
    nibling: ['侄子／外甥', '侄女／外甥女'], parentInLaw: ['岳父／公公', '岳母／婆婆'],
  }
  return labels[kind]?.[gender === 'male' ? 0 : 1] ?? '亲人'
}
