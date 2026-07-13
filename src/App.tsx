import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { initialFamily, showcaseFamily } from './data'
import { clearFamilyData, loadFamilyData, parseFamilyBackup, saveFamilyData, serializeFamilyBackup, serializeFamilyMarkdown } from './familyStorage'
import { calculateKinship } from './kinship'
import { speakMinnan, stopMinnanSpeech } from './minnanSpeech'
import { addBasicRelationship, ensureSpouseCoParents, removeBasicRelationship, resolvePersonOverlaps, suggestedBasicPlacement } from './relationEditor'
import type { BasicRelation } from './relationEditor'
import type { FamilyData, Gender, Person } from './types'
import { birthYearFromDate, isBirthDate } from './lunar'
import { inspectFamilyHealth } from './familyHealth'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { MobileNavigation, type MobileView } from './components/AppNavigation'
import { AppHeader } from './components/AppHeader'
import { PersonDialogs } from './components/PersonDialogs'
import { UtilityDialogs } from './components/UtilityDialogs'
import { Workspace } from './components/Workspace'

const HOME_ID = 'me'
const AVATAR_FEATURE_ENABLED = false
const MODIFIED_AT_KEY = 'kinship-map:last-modified-at'
const BACKED_UP_AT_KEY = 'kinship-map:last-backed-up-at'

function storedDate(key: string) {
  const value = localStorage.getItem(key)
  return value && !Number.isNaN(Date.parse(value)) ? value : null
}

function formatStoredDate(value: string | null) {
  if (!value) return '尚未记录'
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/* Domain fields live in components/PersonFields and components/RelationshipFields. */
function App() {
  const [data, setData] = useState(initialFamily)
  const [viewerId, setViewerId] = useState(HOME_ID)
  const [selectedId, setSelectedId] = useState(HOME_ID)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showBackup, setShowBackup] = useState(false)
  const [showRelations, setShowRelations] = useState(false)
  const [showPair, setShowPair] = useState(false)
  const [showHealth, setShowHealth] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [showShowcase, setShowShowcase] = useState(false)
  const [showRoster, setShowRoster] = useState(false)
  const [showAppStatus, setShowAppStatus] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [relationEditId, setRelationEditId] = useState<string | null>(null)
  const [pairAId, setPairAId] = useState(HOME_ID)
  const [pairBId, setPairBId] = useState(HOME_ID)
  const [avatarDraft, setAvatarDraft] = useState<string | undefined>()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [saveState, setSaveState] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading')
  const historyRef = useRef<FamilyData[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('graph')
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [isStandalone, setIsStandalone] = useState(window.matchMedia('(display-mode: standalone)').matches)
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null)
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [modifiedAt, setModifiedAt] = useState(() => storedDate(MODIFIED_AT_KEY))
  const [backedUpAt, setBackedUpAt] = useState(() => storedDate(BACKED_UP_AT_KEY))
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(false)
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError: () => setToast('离线功能注册失败，请联网后重试'),
  })

  const viewer = data.people.find((p) => p.id === viewerId)!
  const selected = data.people.find((p) => p.id === selectedId)!
  const result = calculateKinship(data, viewerId, selectedId)
  const healthIssues = useMemo(() => inspectFamilyHealth(data), [data])

  const updateData = (updater: (current: FamilyData) => FamilyData) => {
    historyRef.current = [...historyRef.current.slice(-19), data]
    setCanUndo(true)
    setData(updater(data))
    const now = new Date().toISOString()
    localStorage.setItem(MODIFIED_AT_KEY, now)
    setModifiedAt(now)
  }

  const undo = () => {
    const previous = historyRef.current.at(-1)
    if (!previous) return
    historyRef.current = historyRef.current.slice(0, -1)
    setData(previous)
    const now = new Date().toISOString()
    localStorage.setItem(MODIFIED_AT_KEY, now)
    setModifiedAt(now)
    setCanUndo(historyRef.current.length > 0)
    setToast('已撤销上一步家谱修改')
    window.setTimeout(() => setToast(''), 2200)
  }

  useEffect(() => {
    let active = true
    loadFamilyData()
      .then((stored) => {
        if (!active) return
        if (stored) {
          setData(ensureSpouseCoParents(resolvePersonOverlaps(stored)))
          const fallbackId = stored.people.some((person) => person.id === HOME_ID) ? HOME_ID : stored.people[0].id
          setViewerId(fallbackId)
          setSelectedId(stored.people.some((person) => person.id === 'father') ? 'father' : fallbackId)
        }
        setStorageReady(true)
        setSaveState('saved')
      })
      .catch(() => {
        if (!active) return
        setStorageReady(true)
        setSaveState('error')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const setConnected = () => setOnline(true)
    const setDisconnected = () => setOnline(false)
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateDisplayMode = () => setIsStandalone(displayMode.matches)
    const captureInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('online', setConnected)
    window.addEventListener('offline', setDisconnected)
    window.addEventListener('beforeinstallprompt', captureInstall)
    window.addEventListener('appinstalled', updateDisplayMode)
    displayMode.addEventListener('change', updateDisplayMode)
    return () => {
      window.removeEventListener('online', setConnected)
      window.removeEventListener('offline', setDisconnected)
      window.removeEventListener('beforeinstallprompt', captureInstall)
      window.removeEventListener('appinstalled', updateDisplayMode)
      displayMode.removeEventListener('change', updateDisplayMode)
    }
  }, [])

  const refreshStorageStatus = useCallback(async () => {
    if (!navigator.storage) return
    try {
      const persistent = await navigator.storage.persisted()
      const granted = persistent || await navigator.storage.persist()
      setStoragePersistent(granted)
      const estimate = await navigator.storage.estimate()
      setStorageUsage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 })
    } catch {
      setStoragePersistent(false)
    }
  }, [])

  useEffect(() => { void refreshStorageStatus() }, [refreshStorageStatus])

  const shouldRemindBackup = useMemo(() => {
    if (backupReminderDismissed || data.people.length <= 5) return false
    if (!backedUpAt) return true
    if (!modifiedAt || Date.parse(modifiedAt) <= Date.parse(backedUpAt)) return false
    return Date.now() - Date.parse(backedUpAt) > 30 * 24 * 60 * 60 * 1000
  }, [backedUpAt, backupReminderDismissed, data.people.length, modifiedAt])

  useEffect(() => {
    if (!storageReady) return
    setSaveState('saving')
    let active = true
    const timer = window.setTimeout(() => {
      saveFamilyData(data)
        .then(() => { if (active) setSaveState('saved') })
        .catch(() => { if (active) setSaveState('error') })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [data, storageReady])

  const makeViewer = (id: string) => {
    setViewerId(id); setSelectedId(id)
    const name = data.people.find((p) => p.id === id)?.name
    setToast(`现在从 ${name} 的视角看整个家族`)
    window.setTimeout(() => setToast(''), 2200)
  }


  const playMinnan = async () => {
    if (!result.minnanAudioTerms.length) {
      setToast('这个称呼还没有确认闽南语读音')
      window.setTimeout(() => setToast(''), 2200)
      return
    }
    setSpeaking(true)
    try {
      await speakMinnan(result.minnanAudioTerms, () => setSpeaking(false))
    } catch {
      setSpeaking(false)
      setToast('这个称呼暂未收录官方真人音频')
      window.setTimeout(() => setToast(''), 2800)
    }
  }

  useEffect(() => () => stopMinnanSpeech(), [])

  const addPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const gender = String(form.get('gender')) as Gender
    const birthDate = String(form.get('birthDate') || '')
    const anchorId = String(form.get('anchorId') || '')
    const basicRelation = String(form.get('basicRelation')) as BasicRelation
    if (!name || !isBirthDate(birthDate) || !anchorId) return
    if (basicRelation === 'sibling' && !data.parents.some((item) => item.childId === anchorId)) {
      setToast('请先为支点人物补充父母，再建立亲兄弟姐妹关系')
      window.setTimeout(() => setToast(''), 2600)
      return
    }
    const id = `custom-${Date.now()}`
    const placement = suggestedBasicPlacement(data, anchorId, basicRelation)
    const base: Person = { id, name, gender, birthYear: birthYearFromDate(birthDate), birthDate, ...placement }
    updateData((current) => ensureSpouseCoParents(addBasicRelationship({ ...current, people: [...current.people, base] }, id, anchorId, basicRelation)))
    setSelectedId(id); setShowAdd(false)
    setToast(`已添加 ${name}，并写入基础关系`)
    window.setTimeout(() => setToast(''), 2200)
  }

  const openAdd = (anchorId?: string) => {
    if (anchorId) setSelectedId(anchorId)
    setShowAdd(true)
  }

  const openCanvasEdit = (personId: string) => {
    const person = data.people.find((item) => item.id === personId)
    if (!person) return
    setSelectedId(personId)
    setAvatarDraft(person.avatar)
    setShowEdit(true)
  }

  const removeDirectRelation = (type: 'parent' | 'spouse', firstId: string, secondId: string) => {
    updateData((current) => type === 'parent'
      ? { ...current, parents: current.parents.filter((item) => !(item.parentId === firstId && item.childId === secondId)) }
      : { ...current, spouses: current.spouses.filter((item) => !((item.personAId === firstId && item.personBId === secondId) || (item.personAId === secondId && item.personBId === firstId))) })
    setToast('关系已移除，人物资料仍然保留')
    window.setTimeout(() => setToast(''), 2200)
  }

  const editPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    if (!name) return
    const birthDate = String(form.get('birthDate') || '')
    const updated: Partial<Person> = {
      name,
      gender: String(form.get('gender')) as Gender,
      birthYear: isBirthDate(birthDate) ? birthYearFromDate(birthDate) : selected.birthYear,
      ...(isBirthDate(birthDate) ? { birthDate } : {}),
      note: String(form.get('note') || '').trim(),
      ...(AVATAR_FEATURE_ENABLED ? { avatar: avatarDraft } : {}),
    }
    updateData((current) => ({
      ...current,
      people: current.people.map((person) => person.id === selectedId ? { ...person, ...updated } : person),
    }))
    setShowEdit(false)
    setToast(`已更新 ${name} 的人物资料`)
    window.setTimeout(() => setToast(''), 2200)
  }

  const editDirectRelations = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!relationEditId) return
    const form = new FormData(event.currentTarget)
    const name = data.people.find((person) => person.id === relationEditId)?.name
    const anchorId = String(form.get('anchorId') || '')
    const relation = String(form.get('basicRelation')) as BasicRelation
    if (!anchorId) return
    if (relation === 'sibling' && !data.parents.some((item) => item.childId === anchorId)) {
      setToast('请先为支点人物补充父母，再建立亲兄弟姐妹关系')
      window.setTimeout(() => setToast(''), 2600)
      return
    }
    updateData((current) => ensureSpouseCoParents(addBasicRelationship(current, relationEditId, anchorId, relation)))
    setRelationEditId(null)
    setToast(`已为 ${name} 添加基础关系，其他关系将自动生成`)
    window.setTimeout(() => setToast(''), 2400)
  }

  const editRoster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const updates = new Map<string, Partial<Person>>()
    for (const person of data.people) {
      const name = String(form.get(`name:${person.id}`) || '').trim()
      if (!name) {
        setToast('姓名不能为空，请检查人物名册')
        window.setTimeout(() => setToast(''), 2200)
        return
      }
      const birthDate = String(form.get(`birthDate:${person.id}`) || '')
      updates.set(person.id, {
        name,
        gender: String(form.get(`gender:${person.id}`)) as Gender,
        ...(isBirthDate(birthDate) ? { birthDate, birthYear: birthYearFromDate(birthDate) } : {}),
        note: String(form.get(`note:${person.id}`) || '').trim(),
      })
    }
    const relationshipUpdates = data.people.map((person) => ({
      personId: person.id,
      anchorId: String(form.get(`anchor:${person.id}`) || ''),
      relation: String(form.get(`relation:${person.id}`) || '') as BasicRelation | '',
      originalAnchorId: String(form.get(`originalAnchor:${person.id}`) || ''),
      originalRelation: String(form.get(`originalRelation:${person.id}`) || '') as BasicRelation | '',
    }))
    const invalidSibling = relationshipUpdates.find((item) => item.relation === 'sibling' && !data.parents.some((relation) => relation.childId === item.anchorId))
    if (invalidSibling) {
      const anchor = data.people.find((person) => person.id === invalidSibling.anchorId)
      setToast(`${anchor?.name ?? '支点人物'}还没有父母资料，无法建立亲兄弟姐妹关系`)
      window.setTimeout(() => setToast(''), 2800)
      return
    }
    updateData((current) => {
      let next: FamilyData = { ...current, people: current.people.map((person) => ({ ...person, ...updates.get(person.id) })) }
      relationshipUpdates.forEach((item) => {
        if (item.originalRelation && (item.originalAnchorId !== item.anchorId || item.originalRelation !== item.relation)) next = removeBasicRelationship(next, item.personId, item.originalAnchorId, item.originalRelation)
        if (item.relation) next = addBasicRelationship(next, item.personId, item.anchorId, item.relation)
      })
      return ensureSpouseCoParents(next)
    })
    setShowRoster(false)
    setToast(`已一次更新 ${data.people.length} 位人物资料`)
    window.setTimeout(() => setToast(''), 2400)
  }

  const openEdit = () => {
    setAvatarDraft(selected.avatar)
    setShowEdit(true)
  }

  const saveCustomTerm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const label = String(new FormData(event.currentTarget).get('customTerm') || '').trim()
    updateData((current) => ({
      ...current,
      customTerms: [
        ...(current.customTerms ?? []).filter((item) => !(item.viewerId === viewerId && item.targetId === selectedId)),
        ...(label ? [{ viewerId, targetId: selectedId, label }] : []),
      ],
    }))
    setToast(label ? `已记住：${viewer.name}叫${selected.name}“${label}”` : '已恢复系统标准称呼')
    window.setTimeout(() => setToast(''), 2400)
  }

  const uploadAvatar = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setToast('请选择 JPG、PNG、WebP 等图片文件')
      window.setTimeout(() => setToast(''), 2200)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast('头像图片不能超过 5MB')
      window.setTimeout(() => setToast(''), 2200)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAvatarDraft(String(reader.result))
    reader.onerror = () => {
      setToast('图片读取失败，请重新选择')
      window.setTimeout(() => setToast(''), 2200)
    }
    reader.readAsDataURL(file)
  }

  const deleteTarget = deleteTargetId ? data.people.find((person) => person.id === deleteTargetId) : undefined

  const deletePerson = () => {
    if (!deleteTarget || data.people.length <= 1) return
    const relatedIds = [
      ...data.parents.flatMap(({ parentId, childId }) => parentId === deleteTarget.id ? [childId] : childId === deleteTarget.id ? [parentId] : []),
      ...data.spouses.flatMap(({ personAId, personBId }) => personAId === deleteTarget.id ? [personBId] : personBId === deleteTarget.id ? [personAId] : []),
    ]
    const fallback = relatedIds.map((id) => data.people.find((person) => person.id === id)).find(Boolean)
      ?? data.people.find((person) => person.id === HOME_ID && person.id !== deleteTarget.id)
      ?? data.people.find((person) => person.id !== deleteTarget.id)!
    updateData((current) => ({
      people: current.people.filter((person) => person.id !== deleteTarget.id),
      parents: current.parents.filter(({ parentId, childId }) => parentId !== deleteTarget.id && childId !== deleteTarget.id),
      spouses: current.spouses.filter(({ personAId, personBId }) => personAId !== deleteTarget.id && personBId !== deleteTarget.id),
      customTerms: current.customTerms?.filter(({ viewerId, targetId }) => viewerId !== deleteTarget.id && targetId !== deleteTarget.id),
    }))
    if (viewerId === deleteTarget.id) setViewerId(fallback.id)
    if (selectedId === deleteTarget.id) setSelectedId(fallback.id)
    setDeleteTargetId(null)
    setToast(`已删除 ${deleteTarget.name}，相关亲属关系也已清理`)
    window.setTimeout(() => setToast(''), 2400)
  }

  const shareOrDownload = async (contents: string, type: string, filename: string) => {
    const file = new File([contents], filename, { type })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
        return 'shared'
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
    downloadBlob(file, filename)
    return 'downloaded'
  }

  const exportBackup = async () => {
    const filename = `亲族图谱-${new Date().toISOString().slice(0, 10)}.json`
    const result = await shareOrDownload(serializeFamilyBackup(data), 'application/json', filename)
    if (result === 'cancelled') return
    const now = new Date().toISOString()
    localStorage.setItem(BACKED_UP_AT_KEY, now)
    setBackedUpAt(now)
    setBackupReminderDismissed(true)
    setToast(result === 'shared' ? '家谱备份已发送到系统分享' : '家谱备份已导出')
    window.setTimeout(() => setToast(''), 2200)
  }

  const exportMarkdown = async () => {
    const filename = `亲族图谱-${new Date().toISOString().slice(0, 10)}.md`
    const result = await shareOrDownload(serializeFamilyMarkdown(data), 'text/markdown;charset=utf-8', filename)
    if (result === 'cancelled') return
    setToast(result === 'shared' ? '可读家谱已发送到系统分享' : '可读家谱已导出')
    window.setTimeout(() => setToast(''), 2200)
  }

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') setIsStandalone(true)
      setInstallPrompt(null)
      return
    }
    setShowInstallHelp(true)
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    if (file.size > 1024 * 1024) {
      setToast('备份文件不能超过 1MB')
      window.setTimeout(() => setToast(''), 2600)
      return
    }
    try {
      const imported = parseFamilyBackup(await file.text())
      const nextViewerId = imported.people.some((person) => person.id === HOME_ID) ? HOME_ID : imported.people[0].id
      updateData(() => resolvePersonOverlaps(imported))
      setViewerId(nextViewerId)
      setSelectedId(imported.people.some((person) => person.id === 'father') ? 'father' : nextViewerId)
      setShowBackup(false)
      setToast(`已恢复 ${imported.people.length} 位亲人的家谱备份`)
      window.setTimeout(() => setToast(''), 2600)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '无法读取备份文件')
      window.setTimeout(() => setToast(''), 2800)
    }
  }

  const resetFamily = async () => {
    try {
      await clearFamilyData()
      historyRef.current = []
      setCanUndo(false)
      setData(initialFamily)
      setViewerId(HOME_ID)
      setSelectedId(HOME_ID)
      setQuery('')
      setPairAId(HOME_ID)
      setPairBId(HOME_ID)
      const now = new Date().toISOString()
      localStorage.setItem(MODIFIED_AT_KEY, now)
      setModifiedAt(now)
      setShowReset(false)
      setToast('本地家谱已清空，可以重新配置')
      window.setTimeout(() => setToast(''), 2600)
    } catch (error) {
      setShowReset(false)
      setToast(error instanceof Error ? error.message : '无法清空本地家谱')
      window.setTimeout(() => setToast(''), 2800)
    }
  }

  const loadShowcase = () => {
    updateData(() => showcaseFamily)
    setViewerId(HOME_ID)
    setSelectedId(HOME_ID)
    setQuery('')
    setPairAId(HOME_ID)
    setPairBId('father')
    setShowShowcase(false)
    setToast(`已生成七代示例家谱，共 ${showcaseFamily.people.length} 位人物`)
    window.setTimeout(() => setToast(''), 2800)
  }

  if (!storageReady) {
    return <div className="app-loading" role="status" aria-live="polite" aria-label="正在读取本地档案">
      <span className="brand-seal">亲</span>
      <strong>亲族图谱</strong>
      <span className="loading-copy"><i/>正在读取本地档案</span>
    </div>
  }

  return <div className="app-shell">
    <AppHeader viewer={viewer} isHomeViewer={viewerId === HOME_ID} canReturnHome={viewerId !== HOME_ID && data.people.some((person) => person.id === HOME_ID)} saveState={saveState} mobileToolsOpen={mobileToolsOpen} canUndo={canUndo} healthIssueCount={healthIssues.length} isStandalone={isStandalone} onToggleTools={() => setMobileToolsOpen((current) => !current)} onCloseTools={() => setMobileToolsOpen(false)} onReturnHome={() => makeViewer(HOME_ID)} onUndo={undo} onPair={() => { setPairAId(viewerId); setPairBId(selectedId === viewerId ? data.people.find((person) => person.id !== viewerId)?.id ?? viewerId : selectedId); setShowPair(true) }} onHealth={() => setShowHealth(true)} onBackup={() => setShowBackup(true)} onInstall={() => void installApp()} onStatus={() => { setShowAppStatus(true); void refreshStorageStatus() }} onShowcase={() => setShowShowcase(true)} onReset={() => setShowReset(true)}/>

    {shouldRemindBackup && <aside className="backup-reminder" role="status"><span><strong>给这份家谱留一份本地备份</strong><small>{backedUpAt ? `上次备份：${formatStoredDate(backedUpAt)}` : `已经记录 ${data.people.length} 位亲人，尚未导出恢复文件`}</small></span><button type="button" onClick={() => setShowBackup(true)}>现在备份</button><button className="reminder-dismiss" type="button" aria-label="暂时关闭备份提醒" onClick={() => setBackupReminderDismissed(true)}>×</button></aside>}
    {needRefresh && <aside className="update-reminder" role="status"><span><strong>亲族图谱已有新版本</strong><small>家谱数据会继续保存在本机</small></span><button type="button" onClick={() => void updateServiceWorker(true)}>重新加载</button><button className="reminder-dismiss" type="button" aria-label="稍后更新" onClick={() => setNeedRefresh(false)}>×</button></aside>}

    <Workspace data={data} viewerId={viewerId} selectedId={selectedId} query={query} mobileView={mobileView} speaking={speaking} onQueryChange={setQuery} onMobileViewChange={setMobileView} onSelect={setSelectedId} onMakeViewer={makeViewer} onAdd={openAdd} onCanvasEdit={openCanvasEdit} onDelete={setDeleteTargetId} onRoster={() => setShowRoster(true)} onEditProfile={openEdit} onSaveCustomTerm={saveCustomTerm} onSpeak={() => void playMinnan()} onEditRelations={setRelationEditId}/>

    <MobileNavigation view={mobileView} peopleCount={data.people.length} onChange={setMobileView}/>

    <PersonDialogs data={data} viewerId={viewerId} selectedId={selectedId} showAdd={showAdd} showRelations={showRelations} showEdit={showEdit} showRoster={showRoster} relationEditId={relationEditId} avatarDraft={avatarDraft} onCloseAdd={() => setShowAdd(false)} onCloseRelations={() => setShowRelations(false)} onCloseEdit={() => setShowEdit(false)} onCloseRoster={() => setShowRoster(false)} onCloseRelationEditor={() => setRelationEditId(null)} onAddPerson={addPerson} onEditPerson={editPerson} onEditRoster={editRoster} onEditDirectRelations={editDirectRelations} onRemoveDirectRelation={removeDirectRelation} onUploadAvatar={uploadAvatar} onAvatarDraftChange={setAvatarDraft} onOpenRelationEditor={setRelationEditId}/>
    <UtilityDialogs data={data} showBackup={showBackup} showAppStatus={showAppStatus} showInstallHelp={showInstallHelp} showReset={showReset} showShowcase={showShowcase} showPair={showPair} showHealth={showHealth} deleteTarget={deleteTarget} modifiedAt={modifiedAt} backedUpAt={backedUpAt} online={online} isStandalone={isStandalone} storagePersistent={storagePersistent} storageUsage={storageUsage} needRefresh={needRefresh} pairAId={pairAId} pairBId={pairBId} healthIssues={healthIssues} onCloseBackup={() => setShowBackup(false)} onCloseAppStatus={() => setShowAppStatus(false)} onCloseInstallHelp={() => setShowInstallHelp(false)} onCloseReset={() => setShowReset(false)} onCloseShowcase={() => setShowShowcase(false)} onClosePair={() => setShowPair(false)} onCloseHealth={() => setShowHealth(false)} onCloseDelete={() => setDeleteTargetId(null)} onExportBackup={() => void exportBackup()} onExportMarkdown={() => void exportMarkdown()} onImportBackup={(file) => void importBackup(file)} onInstall={() => void installApp()} onOpenBackupFromStatus={() => { setShowAppStatus(false); setShowBackup(true) }} onUpdate={() => void updateServiceWorker(true)} onDeletePerson={deletePerson} onReset={() => void resetFamily()} onLoadShowcase={loadShowcase} onPairAChange={setPairAId} onPairBChange={setPairBId}/>
    {toast && <div className="toast"><span className="mini-seal">我</span>{toast}</div>}
  </div>
}

export default App
