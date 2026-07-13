import relationship from 'relationship.js'
import type { FamilyData, Gender, KinshipResult, Person } from './types'
import { resolveMinnan } from './minnan'

interface Edge {
  to: string
  code: string
  label: string
  priority: number
}

function personById(data: FamilyData, id: string): Person {
  const person = data.people.find((item) => item.id === id)
  if (!person) throw new Error(`找不到人物：${id}`)
  return person
}

function sexCode(gender: Gender): 0 | 1 {
  return gender === 'male' ? 1 : 0
}

function birthdayKey(person: Person): string {
  return person.birthDate ?? `${person.birthYear}-01-01`
}

function siblingCode(from: Person, to: Person): string {
  const older = birthdayKey(to) < birthdayKey(from)
  if (to.gender === 'male') return older ? 'ob' : 'lb'
  return older ? 'os' : 'ls'
}

function narrowBySeniority(candidates: string[], viewer: Person, relative: Person): string[] {
  if (candidates.length < 2 || viewer.generation !== relative.generation) return candidates
  const older = candidates.filter((label) => /哥|姐|姊|嫂/.test(label) && !/弟|妹/.test(label))
  const younger = candidates.filter((label) => /弟|妹/.test(label) && !/哥|姐|姊|嫂/.test(label))
  if (!older.length || !younger.length || birthdayKey(viewer) === birthdayKey(relative)) return candidates
  return birthdayKey(relative) < birthdayKey(viewer) ? older : younger
}

export function buildGraph(data: FamilyData): Map<string, Edge[]> {
  const graph = new Map(data.people.map((person) => [person.id, [] as Edge[]]))
  const add = (from: string, edge: Edge) => graph.get(from)?.push(edge)

  data.parents.forEach(({ parentId, childId, kind = 'biological' }) => {
    const parent = personById(data, parentId)
    const child = personById(data, childId)
    const prefix = kind === 'adoptive' ? '养' : kind === 'step' ? '继' : ''
    add(childId, { to: parentId, code: parent.gender === 'male' ? 'f' : 'm', label: `${prefix}${parent.gender === 'male' ? '父亲' : '母亲'}`, priority: 1 })
    add(parentId, { to: childId, code: child.gender === 'male' ? 's' : 'd', label: `${prefix}${child.gender === 'male' ? '儿子' : '女儿'}`, priority: 2 })
  })

  data.spouses.filter(({ status }) => status !== 'divorced' && status !== 'former').forEach(({ personAId, personBId }) => {
    const a = personById(data, personAId)
    const b = personById(data, personBId)
    add(a.id, { to: b.id, code: b.gender === 'male' ? 'h' : 'w', label: b.gender === 'male' ? '丈夫' : '妻子', priority: 0 })
    add(b.id, { to: a.id, code: a.gender === 'male' ? 'h' : 'w', label: a.gender === 'male' ? '丈夫' : '妻子', priority: 0 })
  })

  const childrenByParent = new Map<string, Set<string>>()
  data.parents.filter(({ kind }) => kind !== 'step').forEach(({ parentId, childId }) => {
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, new Set())
    childrenByParent.get(parentId)?.add(childId)
  })
  childrenByParent.forEach((children) => {
    const ids = [...children]
    ids.forEach((fromId) => ids.forEach((toId) => {
      if (fromId === toId) return
      const exists = graph.get(fromId)?.some((edge) => edge.to === toId && ['ob', 'lb', 'os', 'ls'].includes(edge.code))
      if (!exists) {
        const from = personById(data, fromId)
        const to = personById(data, toId)
        const code = siblingCode(from, to)
        const labels: Record<string, string> = { ob: '哥哥', lb: '弟弟', os: '姐姐', ls: '妹妹' }
        add(fromId, { to: toId, code, label: labels[code], priority: 0 })
      }
    }))
  })
  graph.forEach((edges) => edges.sort((a, b) => a.priority - b.priority))
  return graph
}

export function calculateKinship(data: FamilyData, viewerId: string, targetId: string): KinshipResult {
  if (viewerId === targetId) {
    const minnan = resolveMinnan([])
    return { codes: [], pathIds: [viewerId], pathLabel: '自己', mandarin: ['自己'], minnan: minnan.label, minnanAudioTerms: minnan.audioTerms, minnanKind: minnan.kind }
  }
  const graph = buildGraph(data)
  const queue: Array<{ id: string; codes: string[]; ids: string[]; labels: string[] }> = [{ id: viewerId, codes: [], ids: [viewerId], labels: [] }]
  const visited = new Map<string, number>([[viewerId, 0]])
  let found: typeof queue[number] | undefined

  while (queue.length) {
    const current = queue.shift()!
    if (current.codes.length >= 6) continue
    for (const edge of graph.get(current.id) ?? []) {
      const depth = current.codes.length + 1
      if ((visited.get(edge.to) ?? Infinity) < depth) continue
      const next = { id: edge.to, codes: [...current.codes, edge.code], ids: [...current.ids, edge.to], labels: [...current.labels, edge.label] }
      if (edge.to === targetId) { found = next; queue.length = 0; break }
      visited.set(edge.to, depth)
      queue.push(next)
    }
  }
  if (!found) return { codes: [], pathIds: [viewerId], pathLabel: '关系暂未连通', mandarin: ['未知关系'], minnan: '关系暂未连通', minnanAudioTerms: [], minnanKind: 'path' }
  const viewer = personById(data, viewerId)
  const text = found.labels.join('的')
  const computed = relationship({ text, sex: sexCode(viewer.gender), optimal: true })
  // If the target is a spouse of a same-generation blood relative, the blood
  // relative's age determines 嫂/弟媳、姐夫/妹夫 rather than the spouse's own age.
  const finalCode = found.codes.at(-1)
  const seniorityId = (finalCode === 'h' || finalCode === 'w') && found.ids.length > 1
    ? found.ids.at(-2)!
    : targetId
  const directFactLabel = found.codes.length === 1 && /^(养|继)/.test(found.labels[0]) ? found.labels[0] : null
  const mandarin = directFactLabel ? [directFactLabel] : narrowBySeniority(computed, viewer, personById(data, seniorityId))
  const minnan = resolveMinnan(found.codes)
  const custom = data.customTerms?.find((item) => item.viewerId === viewerId && item.targetId === targetId)?.label.trim()
  return {
    codes: found.codes,
    pathIds: found.ids,
    pathLabel: text,
    mandarin: custom ? [custom] : (mandarin.length ? mandarin : [text]),
    ...(custom ? { standardMandarin: mandarin.length ? mandarin : [text] } : {}),
    minnan: minnan.label,
    minnanAudioTerms: minnan.audioTerms,
    minnanKind: minnan.kind,
  }
}
