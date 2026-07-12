import relationship from 'relationship.js'
import type { FamilyData, Gender, KinshipResult, Person } from './types'

interface Edge {
  to: string
  code: string
  label: string
  priority: number
}

const minnanTerms: Record<string, string> = {
  '': '家己（ka-kī）', f: '阿爸（a-pah）', m: '阿母（a-bú）',
  h: '翁（ang）', w: '某（bóo）', s: '后生（hāu-siⁿ）', d: '查某囝（cha-bó͘-kiáⁿ）',
  ob: '阿兄（a-hiann）', lb: '小弟（sió-tī）', os: '阿姊（a-chí）', ls: '小妹（sió-mōe）',
  'f,f': '阿公（a-kong）', 'f,m': '阿嬷（a-má）', 'm,f': '外公（gōa-kong）', 'm,m': '外嬷（gōa-má）',
  'f,ob': '阿伯（a-peh）', 'f,lb': '阿叔（a-chek）', 'f,os': '阿姑（a-ko͘）', 'f,ls': '阿姑（a-ko͘）',
  'm,ob': '阿舅（a-kū）', 'm,lb': '阿舅（a-kū）', 'm,os': '阿姨（a-î）', 'm,ls': '阿姨（a-î）',
  's,d': '孙查某囝（sun cha-bó͘-kiáⁿ）', 'd,d': '外孙女（gōa-sun-lú）',
}

function personById(data: FamilyData, id: string): Person {
  const person = data.people.find((item) => item.id === id)
  if (!person) throw new Error(`找不到人物：${id}`)
  return person
}

function sexCode(gender: Gender): 0 | 1 {
  return gender === 'male' ? 1 : 0
}

function siblingCode(from: Person, to: Person): string {
  const older = to.birthYear < from.birthYear
  if (to.gender === 'male') return older ? 'ob' : 'lb'
  return older ? 'os' : 'ls'
}

export function buildGraph(data: FamilyData): Map<string, Edge[]> {
  const graph = new Map(data.people.map((person) => [person.id, [] as Edge[]]))
  const add = (from: string, edge: Edge) => graph.get(from)?.push(edge)

  data.parents.forEach(({ parentId, childId }) => {
    const parent = personById(data, parentId)
    const child = personById(data, childId)
    add(childId, { to: parentId, code: parent.gender === 'male' ? 'f' : 'm', label: parent.gender === 'male' ? '父亲' : '母亲', priority: 1 })
    add(parentId, { to: childId, code: child.gender === 'male' ? 's' : 'd', label: child.gender === 'male' ? '儿子' : '女儿', priority: 2 })
  })

  data.spouses.forEach(({ personAId, personBId }) => {
    const a = personById(data, personAId)
    const b = personById(data, personBId)
    add(a.id, { to: b.id, code: b.gender === 'male' ? 'h' : 'w', label: b.gender === 'male' ? '丈夫' : '妻子', priority: 0 })
    add(b.id, { to: a.id, code: a.gender === 'male' ? 'h' : 'w', label: a.gender === 'male' ? '丈夫' : '妻子', priority: 0 })
  })

  const childrenByParent = new Map<string, Set<string>>()
  data.parents.forEach(({ parentId, childId }) => {
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
  if (viewerId === targetId) return { codes: [], pathIds: [viewerId], pathLabel: '自己', mandarin: ['自己'], minnan: minnanTerms[''] }
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
  if (!found) return { codes: [], pathIds: [viewerId], pathLabel: '关系暂未连通', mandarin: ['未知关系'], minnan: '待补充' }
  const viewer = personById(data, viewerId)
  const codeText = found.codes.join(',')
  const text = found.labels.join('的')
  const computed = relationship({ text, sex: sexCode(viewer.gender), optimal: true })
  return {
    codes: found.codes,
    pathIds: found.ids,
    pathLabel: text,
    mandarin: computed.length ? computed : [text],
    minnan: minnanTerms[codeText] ?? '待家中长辈确认',
  }
}
