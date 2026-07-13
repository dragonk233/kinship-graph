import type { FamilyData } from './types'

export type LegalFilterId =
  | 'direct-blood'
  | 'collateral-within-three'
  | 'close-relative'
  | 'blood-relative'
  | 'affinal-relative'
  | 'first-order-heir'
  | 'second-order-heir'
  | 'marriage-prohibited'

export interface LegalFilterOption {
  id: LegalFilterId
  label: string
  description: string
}

export const legalFilterOptions: LegalFilterOption[] = [
  { id: 'direct-blood', label: '直系血亲', description: '所有上下直系世代' },
  { id: 'collateral-within-three', label: '三代以内旁系血亲', description: '兄弟姐妹、叔伯姑舅姨、堂表亲等' },
  { id: 'close-relative', label: '近亲属', description: '民法典第1045条范围' },
  { id: 'blood-relative', label: '血亲', description: '由父母子女链连接的亲属' },
  { id: 'affinal-relative', label: '姻亲', description: '因婚姻与配偶血亲形成的亲属' },
  { id: 'first-order-heir', label: '第一顺序法定继承人', description: '配偶、子女、父母' },
  { id: 'second-order-heir', label: '第二顺序法定继承人', description: '兄弟姐妹、祖父母、外祖父母' },
  { id: 'marriage-prohibited', label: '禁止结婚的亲属', description: '直系血亲或三代以内旁系血亲' },
]

function parentIds(data: FamilyData, childId: string) {
  return data.parents.filter((edge) => edge.childId === childId && edge.kind !== 'step').map((edge) => edge.parentId)
}

function childIds(data: FamilyData, parentId: string) {
  return data.parents.filter((edge) => edge.parentId === parentId && edge.kind !== 'step').map((edge) => edge.childId)
}

function spouseIds(data: FamilyData, personId: string) {
  return data.spouses.filter((edge) => edge.status !== 'divorced' && edge.status !== 'former').flatMap((edge) => edge.personAId === personId ? [edge.personBId] : edge.personBId === personId ? [edge.personAId] : [])
}

function biologicalParentIds(data: FamilyData, childId: string) {
  return data.parents.filter((edge) => edge.childId === childId && (edge.kind ?? 'biological') === 'biological').map((edge) => edge.parentId)
}

function biologicalChildIds(data: FamilyData, parentId: string) {
  return data.parents.filter((edge) => edge.parentId === parentId && (edge.kind ?? 'biological') === 'biological').map((edge) => edge.childId)
}

function walk(startId: string, next: (id: string) => string[]) {
  const distances = new Map<string, number>([[startId, 0]])
  const queue = [startId]
  while (queue.length) {
    const current = queue.shift()!
    for (const id of next(current)) {
      if (distances.has(id)) continue
      distances.set(id, distances.get(current)! + 1)
      queue.push(id)
    }
  }
  return distances
}

function ancestors(data: FamilyData, personId: string) {
  return walk(personId, (id) => parentIds(data, id))
}

function descendants(data: FamilyData, personId: string) {
  return walk(personId, (id) => childIds(data, id))
}

function bloodDistances(data: FamilyData, personId: string) {
  return walk(personId, (id) => [...biologicalParentIds(data, id), ...biologicalChildIds(data, id)])
}

function isSibling(data: FamilyData, viewerId: string, targetId: string) {
  const viewerParents = new Set(parentIds(data, viewerId))
  return viewerId !== targetId && parentIds(data, targetId).some((id) => viewerParents.has(id))
}

function isCollateralWithinThree(data: FamilyData, viewerId: string, targetId: string) {
  if (viewerId === targetId) return false
  const viewerAncestors = walk(viewerId, (id) => biologicalParentIds(data, id))
  const targetAncestors = walk(targetId, (id) => biologicalParentIds(data, id))
  if (viewerAncestors.has(targetId) || targetAncestors.has(viewerId)) return false
  return [...viewerAncestors].some(([ancestorId, viewerDepth]) => {
    const targetDepth = targetAncestors.get(ancestorId)
    return targetDepth !== undefined && viewerDepth > 0 && targetDepth > 0 && Math.max(viewerDepth, targetDepth) + 1 <= 3
  })
}

function isAffinal(data: FamilyData, viewerId: string, targetId: string) {
  if (viewerId === targetId || spouseIds(data, viewerId).includes(targetId) || bloodDistances(data, viewerId).has(targetId)) return false
  const reachable = walk(viewerId, (id) => [...parentIds(data, id), ...childIds(data, id), ...spouseIds(data, id)])
  return reachable.has(targetId)
}

export function matchesLegalFilter(data: FamilyData, viewerId: string, targetId: string, filterId: LegalFilterId) {
  if (viewerId === targetId) return false
  const viewerAncestors = walk(viewerId, (id) => biologicalParentIds(data, id))
  const viewerDescendants = walk(viewerId, (id) => biologicalChildIds(data, id))
  const directBlood = viewerAncestors.has(targetId) || viewerDescendants.has(targetId)
  const collateralWithinThree = isCollateralWithinThree(data, viewerId, targetId)
  const parents = parentIds(data, viewerId)
  const children = childIds(data, viewerId)
  const spouses = spouseIds(data, viewerId)
  const parentAncestors = new Set(parents.flatMap((id) => parentIds(data, id)))
  const grandchildren = new Set(children.flatMap((id) => childIds(data, id)))

  switch (filterId) {
    case 'direct-blood': return directBlood
    case 'collateral-within-three': return collateralWithinThree
    case 'blood-relative': return bloodDistances(data, viewerId).has(targetId)
    case 'affinal-relative': return isAffinal(data, viewerId, targetId)
    case 'first-order-heir': return spouses.includes(targetId) || parents.includes(targetId) || children.includes(targetId)
    case 'second-order-heir': return isSibling(data, viewerId, targetId) || parentAncestors.has(targetId)
    case 'close-relative': return spouses.includes(targetId) || parents.includes(targetId) || children.includes(targetId) || isSibling(data, viewerId, targetId) || parentAncestors.has(targetId) || grandchildren.has(targetId)
    case 'marriage-prohibited': return directBlood || collateralWithinThree
  }
}
