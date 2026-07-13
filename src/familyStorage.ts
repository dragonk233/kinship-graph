import type { FamilyArchiveSummary, FamilyData, FamilySnapshot, LifeEvent, ParentRelationKind, SpouseRelationStatus } from './types'

const DATABASE_NAME = 'kinship-map'
const DATABASE_VERSION = 2
const STORE_NAME = 'families'
const CURRENT_FAMILY_KEY = 'current'
const ARCHIVE_INDEX_KEY = 'archive-index'
const ACTIVE_ARCHIVE_KEY = 'kinship-map:active-archive'
const DEFAULT_ARCHIVE_ID = 'default'

type StoredFamily = {
  version: 1 | 2 | 3
  data: FamilyData
}

type StoredArchive = StoredFamily & { id: string; name: string; createdAt: string; updatedAt: string }

const validDate = (value: unknown) => value === undefined || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))

function isLifeEvent(value: unknown): value is LifeEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<LifeEvent>
  return typeof event.id === 'string' && typeof event.title === 'string' && event.title.trim().length > 0
    && ['birth', 'education', 'career', 'residence', 'marriage', 'milestone', 'death', 'other'].includes(event.type ?? '')
    && validDate(event.date) && (event.year === undefined || Number.isFinite(event.year))
}

function isFamilyData(value: unknown): value is FamilyData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<FamilyData>
  if (!Array.isArray(candidate.people) || !candidate.people.length || !Array.isArray(candidate.parents) || !Array.isArray(candidate.spouses)) return false
  const validPeople = candidate.people.every((person) => person
    && typeof person.id === 'string' && person.id.length > 0
    && typeof person.name === 'string' && person.name.length > 0
    && (person.gender === 'male' || person.gender === 'female')
    && validDate(person.birthDate) && validDate(person.deathDate)
    && (person.living === undefined || typeof person.living === 'boolean')
    && (person.aliases === undefined || (Array.isArray(person.aliases) && person.aliases.every((alias) => typeof alias === 'string')))
    && (person.events === undefined || (Array.isArray(person.events) && person.events.every(isLifeEvent)))
    && Number.isFinite(person.birthYear) && Number.isFinite(person.generation)
    && Number.isFinite(person.x) && Number.isFinite(person.y))
  if (!validPeople) return false
  const personIds = new Set(candidate.people.map((person) => person.id))
  if (personIds.size !== candidate.people.length) return false
  const validCustomTerms = candidate.customTerms === undefined || (Array.isArray(candidate.customTerms) && candidate.customTerms.every((term) => term
    && personIds.has(term.viewerId) && personIds.has(term.targetId)
    && typeof term.label === 'string' && term.label.trim().length > 0))
  return validCustomTerms && candidate.parents.every((relation) => relation
    && personIds.has(relation.parentId) && personIds.has(relation.childId)
    && (relation.kind === undefined || ['biological', 'adoptive', 'step'].includes(relation.kind as ParentRelationKind)))
    && candidate.spouses.every((relation) => relation
      && personIds.has(relation.personAId) && personIds.has(relation.personBId)
      && (relation.status === undefined || ['married', 'divorced', 'widowed', 'former'].includes(relation.status as SpouseRelationStatus))
      && validDate(relation.startDate) && validDate(relation.endDate))
}

export function compactFamilyData(data: FamilyData): FamilyData {
  return {
    people: data.people.map((person) => ({
      id: person.id,
      name: person.name,
      gender: person.gender,
      birthYear: person.birthYear,
      ...(person.birthDate ? { birthDate: person.birthDate } : {}),
      ...(person.deathDate ? { deathDate: person.deathDate } : {}),
      ...(person.living === false ? { living: false } : {}),
      ...(person.aliases?.filter(Boolean).length ? { aliases: person.aliases.map((alias) => alias.trim()).filter(Boolean) } : {}),
      ...(person.hometown?.trim() ? { hometown: person.hometown.trim() } : {}),
      ...(person.branch?.trim() ? { branch: person.branch.trim() } : {}),
      generation: person.generation,
      x: person.x,
      y: person.y,
      ...(person.note?.trim() ? { note: person.note.trim() } : {}),
      ...(person.events?.length ? { events: person.events.map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title.trim(),
        ...(event.date ? { date: event.date } : {}),
        ...(event.year ? { year: event.year } : {}),
        ...(event.place?.trim() ? { place: event.place.trim() } : {}),
        ...(event.note?.trim() ? { note: event.note.trim() } : {}),
      })) } : {}),
    })),
    parents: data.parents.map(({ parentId, childId, kind }) => ({ parentId, childId, ...(kind && kind !== 'biological' ? { kind } : {}) })),
    spouses: data.spouses.map(({ personAId, personBId, status, startDate, endDate }) => ({ personAId, personBId, ...(status && status !== 'married' ? { status } : {}), ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) })),
    ...(data.customTerms?.length ? { customTerms: data.customTerms.map(({ viewerId, targetId, label }) => ({ viewerId, targetId, label: label.trim() })) } : {}),
  }
}

export function serializeFamilyBackup(data: FamilyData): string {
  return JSON.stringify({ version: 3, data: compactFamilyData(data) } satisfies StoredFamily)
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
  if (![1, 2, 3].includes(stored?.version ?? 0) || !isFamilyData(stored.data)) throw new Error('备份文件格式或家谱关系无效')
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

function requestValue<T>(database: IDBDatabase, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error ?? new Error('无法读取本地档案'))
  })
}

function putValue(database: IDBDatabase, key: IDBValidKey, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('无法保存本地档案'))
  })
}

function archiveKey(id: string) { return `archive:${id}` }
function snapshotKey(id: string) { return `snapshots:${id}` }
export function getActiveArchiveId() { return localStorage.getItem(ACTIVE_ARCHIVE_KEY) || DEFAULT_ARCHIVE_ID }
export function setActiveArchiveId(id: string) { localStorage.setItem(ACTIVE_ARCHIVE_KEY, id) }

export async function listFamilyArchives(): Promise<FamilyArchiveSummary[]> {
  const database = await openDatabase()
  try {
    const stored = await requestValue<FamilyArchiveSummary[]>(database, ARCHIVE_INDEX_KEY)
    if (stored?.length) return stored
    const legacy = await requestValue<StoredFamily>(database, CURRENT_FAMILY_KEY)
    const now = new Date().toISOString()
    const data = legacy && isFamilyData(legacy.data) ? compactFamilyData(legacy.data) : null
    const summary: FamilyArchiveSummary = { id: DEFAULT_ARCHIVE_ID, name: '我的家谱', createdAt: now, updatedAt: now, peopleCount: data?.people.length ?? 1 }
    if (data) await putValue(database, archiveKey(DEFAULT_ARCHIVE_ID), { version: 3, id: DEFAULT_ARCHIVE_ID, name: summary.name, createdAt: now, updatedAt: now, data } satisfies StoredArchive)
    await putValue(database, ARCHIVE_INDEX_KEY, [summary])
    return [summary]
  } finally { database.close() }
}

async function updateArchiveIndex(database: IDBDatabase, summary: FamilyArchiveSummary) {
  const index = await requestValue<FamilyArchiveSummary[]>(database, ARCHIVE_INDEX_KEY) ?? []
  await putValue(database, ARCHIVE_INDEX_KEY, [...index.filter((item) => item.id !== summary.id), summary].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
}

export async function createFamilyArchive(name: string, data: FamilyData): Promise<FamilyArchiveSummary> {
  const database = await openDatabase()
  try {
    const now = new Date().toISOString()
    const id = `family-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const summary = { id, name: name.trim() || '未命名家谱', createdAt: now, updatedAt: now, peopleCount: data.people.length }
    await putValue(database, archiveKey(id), { version: 3, ...summary, data: compactFamilyData(data) } satisfies StoredArchive)
    await updateArchiveIndex(database, summary)
    return summary
  } finally { database.close() }
}

export async function renameFamilyArchive(id: string, name: string): Promise<void> {
  const database = await openDatabase()
  try {
    const archive = await requestValue<StoredArchive>(database, archiveKey(id))
    if (!archive) throw new Error('找不到这份家谱')
    const updated = { ...archive, name: name.trim() || archive.name, updatedAt: new Date().toISOString() }
    await putValue(database, archiveKey(id), updated)
    await updateArchiveIndex(database, { id, name: updated.name, createdAt: updated.createdAt, updatedAt: updated.updatedAt, peopleCount: updated.data.people.length })
  } finally { database.close() }
}

export async function deleteFamilyArchive(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const index = await requestValue<FamilyArchiveSummary[]>(database, ARCHIVE_INDEX_KEY) ?? []
    if (index.length <= 1) throw new Error('至少需要保留一份家谱')
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(archiveKey(id))
      transaction.objectStore(STORE_NAME).delete(snapshotKey(id))
      transaction.objectStore(STORE_NAME).put(index.filter((item) => item.id !== id), ARCHIVE_INDEX_KEY)
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error)
    })
  } finally { database.close() }
}

export async function loadFamilyArchive(id: string): Promise<FamilyData | null> {
  const database = await openDatabase()
  try {
    const archive = await requestValue<StoredArchive>(database, archiveKey(id))
    return archive && isFamilyData(archive.data) ? compactFamilyData(archive.data) : null
  } finally { database.close() }
}

export async function listFamilySnapshots(archiveId: string): Promise<FamilySnapshot[]> {
  const database = await openDatabase()
  try { return await requestValue<FamilySnapshot[]>(database, snapshotKey(archiveId)) ?? [] }
  finally { database.close() }
}

export async function saveFamilySnapshot(archiveId: string, data: FamilyData, label: string): Promise<void> {
  const database = await openDatabase()
  try {
    const snapshots = await requestValue<FamilySnapshot[]>(database, snapshotKey(archiveId)) ?? []
    const compact = compactFamilyData(data)
    if (snapshots[0] && JSON.stringify(snapshots[0].data) === JSON.stringify(compact)) return
    const snapshot: FamilySnapshot = { id: `snapshot-${Date.now()}`, archiveId, createdAt: new Date().toISOString(), label, data: compact }
    await putValue(database, snapshotKey(archiveId), [snapshot, ...snapshots].slice(0, 40))
  } finally { database.close() }
}

export async function loadFamilyData(archiveId = getActiveArchiveId()): Promise<FamilyData | null> {
  if (!('indexedDB' in globalThis)) return null
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(archiveKey(archiveId))
      request.onsuccess = () => {
        const stored = request.result as StoredArchive | undefined
        if (stored && [1, 2, 3].includes(stored.version) && isFamilyData(stored.data)) resolve(compactFamilyData(stored.data))
        else {
          const legacyRequest = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(CURRENT_FAMILY_KEY)
          legacyRequest.onsuccess = () => { const legacy = legacyRequest.result as StoredFamily | undefined; resolve(legacy && isFamilyData(legacy.data) ? compactFamilyData(legacy.data) : null) }
          legacyRequest.onerror = () => resolve(null)
        }
      }
      request.onerror = () => reject(request.error ?? new Error('无法读取本地家谱'))
    })
  } finally {
    database.close()
  }
}

export async function saveFamilyData(data: FamilyData, archiveId = getActiveArchiveId()): Promise<void> {
  if (!('indexedDB' in globalThis)) throw new Error('当前浏览器不支持 IndexedDB')
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const now = new Date().toISOString()
      const compact = compactFamilyData(data)
      const existingRequest = transaction.objectStore(STORE_NAME).get(archiveKey(archiveId))
      existingRequest.onsuccess = () => {
        const existing = existingRequest.result as StoredArchive | undefined
        const createdAt = existing?.createdAt ?? now
        const name = existing?.name ?? '我的家谱'
        transaction.objectStore(STORE_NAME).put({ version: 3, id: archiveId, name, createdAt, updatedAt: now, data: compact } satisfies StoredArchive, archiveKey(archiveId))
        const indexRequest = transaction.objectStore(STORE_NAME).get(ARCHIVE_INDEX_KEY)
        indexRequest.onsuccess = () => {
          const index = (indexRequest.result as FamilyArchiveSummary[] | undefined) ?? []
          const summary = { id: archiveId, name, createdAt, updatedAt: now, peopleCount: compact.people.length }
          transaction.objectStore(STORE_NAME).put([...index.filter((item) => item.id !== archiveId), summary].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), ARCHIVE_INDEX_KEY)
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法保存本地家谱'))
      transaction.onabort = () => reject(transaction.error ?? new Error('本地保存已取消'))
    })
  } finally {
    database.close()
  }
}

export async function clearFamilyData(archiveId = getActiveArchiveId()): Promise<void> {
  if (!('indexedDB' in globalThis)) throw new Error('当前浏览器不支持 IndexedDB')
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(archiveKey(archiveId))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法清空本地家谱'))
      transaction.onabort = () => reject(transaction.error ?? new Error('清空本地家谱已取消'))
    })
  } finally {
    database.close()
  }
}
