import type { FamilyData } from './types'

const DATABASE_NAME = 'kinship-map'
const DATABASE_VERSION = 1
const STORE_NAME = 'families'
const CURRENT_FAMILY_KEY = 'current'

type StoredFamily = {
  version: 1
  data: FamilyData
}

function isFamilyData(value: unknown): value is FamilyData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<FamilyData>
  if (!Array.isArray(candidate.people) || !candidate.people.length || !Array.isArray(candidate.parents) || !Array.isArray(candidate.spouses)) return false
  const validPeople = candidate.people.every((person) => person
    && typeof person.id === 'string' && person.id.length > 0
    && typeof person.name === 'string' && person.name.length > 0
    && (person.gender === 'male' || person.gender === 'female')
    && (person.birthDate === undefined || (typeof person.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(person.birthDate)))
    && Number.isFinite(person.birthYear) && Number.isFinite(person.generation)
    && Number.isFinite(person.x) && Number.isFinite(person.y))
  if (!validPeople) return false
  const personIds = new Set(candidate.people.map((person) => person.id))
  if (personIds.size !== candidate.people.length) return false
  return candidate.parents.every((relation) => relation
    && personIds.has(relation.parentId) && personIds.has(relation.childId))
    && candidate.spouses.every((relation) => relation
      && personIds.has(relation.personAId) && personIds.has(relation.personBId))
}

export function compactFamilyData(data: FamilyData): FamilyData {
  return {
    people: data.people.map((person) => ({
      id: person.id,
      name: person.name,
      gender: person.gender,
      birthYear: person.birthYear,
      ...(person.birthDate ? { birthDate: person.birthDate } : {}),
      generation: person.generation,
      x: person.x,
      y: person.y,
      ...(person.note?.trim() ? { note: person.note.trim() } : {}),
    })),
    parents: data.parents.map(({ parentId, childId }) => ({ parentId, childId })),
    spouses: data.spouses.map(({ personAId, personBId }) => ({ personAId, personBId })),
  }
}

export function serializeFamilyBackup(data: FamilyData): string {
  return JSON.stringify({ version: 1, data: compactFamilyData(data) } satisfies StoredFamily)
}

function mermaidLabel(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

export function serializeFamilyMarkdown(data: FamilyData, exportedAt = new Date()): string {
  const compact = compactFamilyData(data)
  const nodeIds = new Map(compact.people.map((person, index) => [person.id, `person_${index + 1}`]))
  const lines = compact.people.map((person) => {
    const details = person.birthDate ?? String(person.birthYear)
    return `  ${nodeIds.get(person.id)}["${mermaidLabel(person.name)}<br/>${mermaidLabel(details)}"]`
  })

  for (const { parentId, childId } of compact.parents) {
    lines.push(`  ${nodeIds.get(parentId)} -->|亲子| ${nodeIds.get(childId)}`)
  }
  for (const { personAId, personBId } of compact.spouses) {
    lines.push(`  ${nodeIds.get(personAId)} ---|夫妻| ${nodeIds.get(personBId)}`)
  }

  const peopleRows = compact.people.map((person) => [
    person.name,
    person.gender === 'male' ? '男' : '女',
    person.birthDate ?? String(person.birthYear),
    person.note ?? '',
  ].map(markdownCell).join(' | '))

  return `# 亲族图谱\n\n导出日期：${exportedAt.toISOString().slice(0, 10)}\n\n> 此文件用于查看和分享；恢复家谱请使用应用导出的 JSON 备份。\n\n\`\`\`mermaid\nflowchart TB\n${lines.join('\n')}\n\`\`\`\n\n## 人物资料\n\n姓名 | 性别 | 出生日期/年份 | 备注\n--- | --- | --- | ---\n${peopleRows.join('\n')}\n`
}

export function parseFamilyBackup(source: string): FamilyData {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error('备份文件不是有效的 JSON')
  }
  const stored = parsed as Partial<StoredFamily>
  if (stored?.version !== 1 || !isFamilyData(stored.data)) throw new Error('备份文件格式或家谱关系无效')
  return compactFamilyData(stored.data)
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'))
  })
}

export async function loadFamilyData(): Promise<FamilyData | null> {
  if (!('indexedDB' in globalThis)) return null
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(CURRENT_FAMILY_KEY)
      request.onsuccess = () => {
        const stored = request.result as StoredFamily | undefined
        resolve(stored?.version === 1 && isFamilyData(stored.data) ? compactFamilyData(stored.data) : null)
      }
      request.onerror = () => reject(request.error ?? new Error('无法读取本地家谱'))
    })
  } finally {
    database.close()
  }
}

export async function saveFamilyData(data: FamilyData): Promise<void> {
  if (!('indexedDB' in globalThis)) throw new Error('当前浏览器不支持 IndexedDB')
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({ version: 1, data: compactFamilyData(data) } satisfies StoredFamily, CURRENT_FAMILY_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法保存本地家谱'))
      transaction.onabort = () => reject(transaction.error ?? new Error('本地保存已取消'))
    })
  } finally {
    database.close()
  }
}
