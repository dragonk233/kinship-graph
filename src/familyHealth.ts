import type { FamilyData } from './types'

export type HealthIssue = { level: 'error' | 'warning'; title: string; detail: string }

export function inspectFamilyHealth(data: FamilyData): HealthIssue[] {
  const issues: HealthIssue[] = []
  const people = new Map(data.people.map((person) => [person.id, person]))
  const parentKeys = new Set<string>()
  const spouseKeys = new Set<string>()

  for (const relation of data.parents) {
    const key = `${relation.parentId}:${relation.childId}`
    if (parentKeys.has(key)) issues.push({ level: 'error', title: '重复的亲子关系', detail: '同一条亲子连接被记录了多次。' })
    parentKeys.add(key)
    if (relation.parentId === relation.childId) issues.push({ level: 'error', title: '人物不能是自己的父母', detail: people.get(relation.parentId)?.name ?? relation.parentId })
    const parent = people.get(relation.parentId)
    const child = people.get(relation.childId)
    if (parent && child && child.birthYear - parent.birthYear < 12) {
      issues.push({ level: 'warning', title: '出生年份可能有误', detail: `${parent.name}与${child.name}的年龄差小于12岁。` })
    }
  }

  for (const relation of data.spouses) {
    const key = [relation.personAId, relation.personBId].sort().join(':')
    if (spouseKeys.has(key)) issues.push({ level: 'error', title: '重复的配偶关系', detail: '同一对配偶被记录了多次。' })
    spouseKeys.add(key)
    if (relation.personAId === relation.personBId) issues.push({ level: 'error', title: '人物不能与自己结为配偶', detail: people.get(relation.personAId)?.name ?? relation.personAId })
  }

  const parentsByChild = new Map<string, string[]>()
  data.parents.forEach(({ parentId, childId }) => parentsByChild.set(childId, [...(parentsByChild.get(childId) ?? []), parentId]))
  for (const person of data.people) {
    const seen = new Set<string>()
    const visit = (id: string): boolean => {
      if (id === person.id && seen.size) return true
      if (seen.has(id)) return false
      seen.add(id)
      return (parentsByChild.get(id) ?? []).some(visit)
    }
    if ((parentsByChild.get(person.id) ?? []).some(visit)) {
      issues.push({ level: 'error', title: '亲子关系形成循环', detail: `${person.name}出现在自己的祖先链中。` })
      break
    }
  }

  return issues
}
