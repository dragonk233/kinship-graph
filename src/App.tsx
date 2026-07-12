import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState, WheelEvent } from 'react'
import { initialFamily } from './data'
import { loadFamilyData, parseFamilyBackup, saveFamilyData, serializeFamilyBackup } from './familyStorage'
import { calculateKinship } from './kinship'
import { hasMinnanRecording, speakMinnan, stopMinnanSpeech } from './minnanSpeech'
import { addRelatedPerson, anchorIdsFor, genderLabel, relationOptions, relationPreview, resolvePersonOverlaps, suggestedPersonPlacement } from './relationEditor'
import type { DirectRelation, RelationKind } from './relationEditor'
import type { FamilyData, Gender, Person } from './types'
import { formatZodiac } from './zodiac'
import { birthYearFromDate, formatLunarBirthday, formatSolarBirthday, isBirthDate } from './lunar'

const HOME_ID = 'me'
const CARD_W = 148
const CARD_H = 94
const AVATAR_FEATURE_ENABLED = false

function Icon({ name }: { name: 'search' | 'home' | 'plus' | 'route' | 'person' | 'edit' | 'speaker' | 'trash' }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></>,
    person: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    edit: <><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></>,
    speaker: <><path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function initials(name: string) { return name.slice(-2) }

function BirthdayField({ defaultValue, required = false }: { defaultValue?: string; required?: boolean }) {
  const [value, setValue] = useState(defaultValue ?? '')
  const lunar = formatLunarBirthday(value)
  return <label>公历生日
    <input name="birthDate" type="date" min="1800-01-01" max="2100-12-31" value={value} required={required} onChange={(event) => setValue(event.target.value)}/>
    <small className={`lunar-preview ${lunar ? '' : 'empty'}`}>{lunar ? `农历生日：${lunar}` : '选择公历日期后，将自动显示农历生日'}</small>
  </label>
}

function birthdaySummary(person: Person) {
  return person.birthDate && isBirthDate(person.birthDate) ? formatSolarBirthday(person.birthDate) : `${person.birthYear}年`
}

function Avatar({ person, size }: { person: Person; size?: 'small' | 'large' }) {
  const avatar = AVATAR_FEATURE_ENABLED ? person.avatar : undefined
  return <span className={`portrait ${size ?? ''} ${person.gender} ${avatar ? 'has-image' : ''}`}>
    {avatar ? <img src={avatar} alt=""/> : initials(person.name)}
  </span>
}

function Graph({ data, viewerId, selectedId, onSelect, onMakeViewer }: {
  data: FamilyData; viewerId: string; selectedId: string; onSelect: (id: string) => void; onMakeViewer: (id: string) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: .72 })
  const [dragging, setDragging] = useState(false)
  const people = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people])

  const fitView = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const scale = Math.min((viewport.clientWidth - 48) / 1400, (viewport.clientHeight - 48) / 830, 1)
    setCamera({
      scale,
      x: (viewport.clientWidth - 1400 * scale) / 2,
      y: (viewport.clientHeight - 830 * scale) / 2,
    })
  }, [])

  useEffect(() => {
    fitView()
    const observer = new ResizeObserver(fitView)
    if (viewportRef.current) observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [fitView])

  const zoomAtCenter = (factor: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const centerX = viewport.clientWidth / 2
    const centerY = viewport.clientHeight / 2
    setCamera((current) => {
      const scale = Math.min(1.6, Math.max(.3, current.scale * factor))
      const ratio = scale / current.scale
      return { scale, x: centerX - (centerX - current.x) * ratio, y: centerY - (centerY - current.y) * ratio }
    })
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    setCamera((current) => {
      const scale = Math.min(1.6, Math.max(.3, current.scale * Math.exp(-event.deltaY * .0012)))
      const ratio = scale / current.scale
      return { scale, x: pointerX - (pointerX - current.x) * ratio, y: pointerY - (pointerY - current.y) * ratio }
    })
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: camera.x, originY: camera.y }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setCamera((current) => ({ ...current, x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY }))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
  }
  const parentLines = data.parents.map(({ parentId, childId }) => {
    const p = people.get(parentId)!; const c = people.get(childId)!
    return <path key={`${parentId}-${childId}`} className="blood-line" d={`M ${p.x + CARD_W / 2} ${p.y + CARD_H} C ${p.x + CARD_W / 2} ${p.y + 145}, ${c.x + CARD_W / 2} ${c.y - 50}, ${c.x + CARD_W / 2} ${c.y}`} />
  })
  const spouseLines = data.spouses.map(({ personAId, personBId }) => {
    const a = people.get(personAId)!; const b = people.get(personBId)!
    return <path key={`${personAId}-${personBId}`} className="spouse-line" d={`M ${a.x + CARD_W} ${a.y + CARD_H / 2} L ${b.x} ${b.y + CARD_H / 2}`} />
  })
  return <div
    ref={viewportRef}
    className={`graph-viewport ${dragging ? 'dragging' : ''}`}
    data-testid="free-canvas"
    onWheel={onWheel}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={endDrag}
    onPointerCancel={endDrag}
  >
    <div className="graph-stage" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}>
      <svg className="connections" viewBox="0 0 1400 830" aria-hidden="true">{parentLines}{spouseLines}</svg>
      {data.people.map((person) => {
        const result = calculateKinship(data, viewerId, person.id)
        const isViewer = person.id === viewerId
        const isSelected = person.id === selectedId
        return <button
          key={person.id}
          className={`person-node ${isViewer ? 'viewer' : ''} ${isSelected ? 'selected' : ''}`}
          style={{ left: person.x, top: person.y }}
          onClick={() => onSelect(person.id)}
          onDoubleClick={() => onMakeViewer(person.id)}
          aria-label={`${person.name}，${result.mandarin[0]}`}
        >
          {isViewer && <span className="viewer-pin">我</span>}
          <Avatar person={person}/>
          <span className="node-copy"><strong>{person.name}</strong><small>{result.mandarin[0]}</small></span>
        </button>
      })}
      <div className="generation-label g0">祖辈</div><div className="generation-label g1">父辈</div>
      <div className="generation-label g2">同辈</div><div className="generation-label g3">晚辈</div>
    </div>
    <div className="canvas-controls" aria-label="画布控制">
      <button onClick={() => zoomAtCenter(1.2)} aria-label="放大画布">＋</button>
      <span>{Math.round(camera.scale * 100)}%</span>
      <button onClick={() => zoomAtCenter(1 / 1.2)} aria-label="缩小画布">－</button>
      <i />
      <button className="fit-button" onClick={fitView} aria-label="适应全部人物">适应</button>
    </div>
    <div className="pan-hint">按住空白处拖动 · 滚轮缩放</div>
  </div>
}

function App() {
  const [data, setData] = useState(initialFamily)
  const [viewerId, setViewerId] = useState(HOME_ID)
  const [selectedId, setSelectedId] = useState('father')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showBackup, setShowBackup] = useState(false)
  const [showRelations, setShowRelations] = useState(false)
  const [relationKind, setRelationKind] = useState<RelationKind>('parent')
  const [relationAnchorId, setRelationAnchorId] = useState('')
  const [directRelation, setDirectRelation] = useState<DirectRelation>('child')
  const [avatarDraft, setAvatarDraft] = useState<string | undefined>()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [saveState, setSaveState] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading')

  const viewer = data.people.find((p) => p.id === viewerId)!
  const selected = data.people.find((p) => p.id === selectedId)!
  const result = calculateKinship(data, viewerId, selectedId)
  const filtered = data.people.filter((p) => p.name.includes(query) || calculateKinship(data, viewerId, p.id).mandarin.some((term) => term.includes(query)))
  const pathPeople = result.pathIds.map((id) => data.people.find((p) => p.id === id)!).filter(Boolean)
  const hasOfficialRecording = hasMinnanRecording(result.minnanAudioTerms)
  const relationAnchors = anchorIdsFor(data, viewerId, relationKind)
  const effectiveAnchorId = relationAnchors.includes(relationAnchorId) ? relationAnchorId : (relationAnchors[0] ?? '')

  useEffect(() => {
    let active = true
    loadFamilyData()
      .then((stored) => {
        if (!active) return
        if (stored) {
          setData(resolvePersonOverlaps(stored))
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
    if (!name || !isBirthDate(birthDate)) return
    const id = `custom-${Date.now()}`
    const placement = suggestedPersonPlacement(data, viewerId, relationKind, effectiveAnchorId, directRelation)
    const base: Person = { id, name, gender, birthYear: birthYearFromDate(birthDate), birthDate, ...placement }
    setData((current) => addRelatedPerson(current, viewerId, base, relationKind, effectiveAnchorId, directRelation))
    setSelectedId(id); setShowAdd(false)
    setToast(`已添加${genderLabel(relationKind, gender, viewer, base)} ${name}`)
    window.setTimeout(() => setToast(''), 2200)
  }

  const openAdd = () => {
    setRelationKind('parent')
    setRelationAnchorId('')
    setDirectRelation('child')
    setShowAdd(true)
  }

  const removeDirectRelation = (type: 'parent' | 'spouse', firstId: string, secondId: string) => {
    setData((current) => type === 'parent'
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
    setData((current) => ({
      ...current,
      people: current.people.map((person) => person.id === selectedId ? { ...person, ...updated } : person),
    }))
    setShowEdit(false)
    setToast(`已更新 ${name} 的人物资料`)
    window.setTimeout(() => setToast(''), 2200)
  }

  const openEdit = () => {
    setAvatarDraft(selected.avatar)
    setShowEdit(true)
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
    const fallback = data.people.find((person) => person.id !== deleteTarget.id)!
    setData((current) => ({
      people: current.people.filter((person) => person.id !== deleteTarget.id),
      parents: current.parents.filter(({ parentId, childId }) => parentId !== deleteTarget.id && childId !== deleteTarget.id),
      spouses: current.spouses.filter(({ personAId, personBId }) => personAId !== deleteTarget.id && personBId !== deleteTarget.id),
    }))
    if (viewerId === deleteTarget.id) setViewerId(fallback.id)
    if (selectedId === deleteTarget.id) setSelectedId(fallback.id)
    setDeleteTargetId(null)
    setToast(`已删除 ${deleteTarget.name}，相关亲属关系也已清理`)
    window.setTimeout(() => setToast(''), 2400)
  }

  const exportBackup = () => {
    const blob = new Blob([serializeFamilyBackup(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `亲族图谱-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setToast('家谱备份已导出')
    window.setTimeout(() => setToast(''), 2200)
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
      setData(resolvePersonOverlaps(imported))
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

  if (!storageReady) {
    return <div className="app-loading" role="status" aria-live="polite" aria-label="正在读取本地档案">
      <span className="brand-seal">亲</span>
      <strong>亲族图谱</strong>
      <span className="loading-copy"><i/>正在读取本地档案</span>
    </div>
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-seal">亲</span><div><strong>亲族图谱</strong><small>称呼从关系里自然生长</small></div></div>
      <div className="viewpoint-chip"><span>当前主视角</span><strong>{viewer.name}</strong><em>{viewerId === HOME_ID ? '本人' : '代入视角'}</em></div>
      <div className="header-actions">
        <span className={`save-status ${saveState}`} role="status" aria-live="polite">
          <i/>{saveState === 'loading' ? '读取本地档案' : saveState === 'saving' ? '正在保存' : saveState === 'saved' ? '已保存到本机' : '本地保存失败'}
        </span>
        {viewerId !== HOME_ID && data.people.some((person) => person.id === HOME_ID) && <button className="text-button" onClick={() => makeViewer(HOME_ID)}><Icon name="home"/>回到我</button>}
        <button className="primary-button" onClick={openAdd}><Icon name="plus"/>添加亲人</button>
      </div>
    </header>

    <main className="workspace">
      <aside className="people-panel">
        <div className="panel-heading"><div><span className="eyebrow">人物索引</span><h2>家中亲人</h2></div><div className="panel-heading-tools"><button className="backup-button" onClick={() => setShowBackup(true)}>备份</button><span className="count">{data.people.length}</span></div></div>
        <label className="search"><Icon name="search"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名或称呼"/></label>
        <div className="people-list">
          {filtered.map((person) => {
            const relation = calculateKinship(data, viewerId, person.id)
            return <button key={person.id} className={person.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(person.id)}>
              <Avatar person={person} size="small"/>
              <span><strong>{person.name}</strong><small>{birthdaySummary(person)} · {formatZodiac(person.birthYear)}</small></span>
              <em>{relation.mandarin[0]}</em>
            </button>
          })}
        </div>
        <div className="legend"><span><i className="blood-dot"/>血缘</span><span><i className="spouse-dot"/>婚姻</span><small>双击人物也可切换视角</small></div>
      </aside>

      <section className="canvas-panel">
        <div className="canvas-heading"><div><span className="eyebrow">家族关系画布</span><h1>从 <b>{viewer.name}</b> 看这个家</h1></div><div className="canvas-note"><span>提示</span>点击查看，双击设为主视角</div></div>
        <Graph data={data} viewerId={viewerId} selectedId={selectedId} onSelect={setSelectedId} onMakeViewer={makeViewer}/>
      </section>

      <aside className="detail-panel">
        <div className="detail-profile">
          <Avatar person={selected} size="large"/>
          <div className="profile-copy"><span className="eyebrow">当前查看</span><h2>{selected.name}</h2><p>{birthdaySummary(selected)} · {formatZodiac(selected.birthYear)}</p>{selected.birthDate && <p className="lunar-birthday">农历：{formatLunarBirthday(selected.birthDate)}</p>}</div>
          <button className="edit-profile-button" onClick={openEdit} aria-label={`编辑${selected.name}的资料`}><Icon name="edit"/>编辑</button>
        </div>
        {selected.id !== viewerId && <button className="perspective-button" onClick={() => makeViewer(selected.id)}><span>以此人为我</span><small>全图称呼将同步刷新</small></button>}
        <section className="term-block"><span className="eyebrow">现实中如何称呼</span><div className="main-term">{result.mandarin[0]}</div>{result.mandarin.length > 1 && <p>也可能称作：{result.mandarin.slice(1).join('、')}</p>}</section>
        <section className="dialect-block"><div><span className="eyebrow">闽南语 · {result.minnanKind === 'term' ? '官方称呼' : '关系路径读法'}</span><strong>{result.minnan}</strong><a href="https://sutian.moe.edu.tw/" target="_blank" rel="noreferrer">音频来源：教育部《臺灣台语常用词辭典》</a></div><button className={`speak-button ${speaking ? 'speaking' : ''}`} onClick={playMinnan} disabled={speaking || !hasOfficialRecording} aria-label={`用闽南语播报${result.minnan}`} title={result.minnanKind === 'term' ? '播放教育部官方真人发音' : '逐段播放官方词条发音'}><Icon name="speaker"/>{speaking ? '播报中' : hasOfficialRecording ? '播报' : '暂无音频'}</button></section>
        <section className="path-block"><div className="section-title"><span className="eyebrow">关系是怎么得出的</span><Icon name="route"/></div><p>{result.pathLabel}</p><div className="path-flow">
          {pathPeople.map((person, index) => <span key={person.id}><b>{person.name}</b>{index < pathPeople.length - 1 && <i>→</i>}</span>)}
        </div></section>
        <button className="manage-relations-button" onClick={() => setShowRelations(true)}><Icon name="route"/><span><strong>维护直接关系</strong><small>查看或移除父母、子女与配偶连接</small></span></button>
        {selected.note && <section className="person-note"><span className="eyebrow">人物备注</span><p>{selected.note}</p></section>}
        <div className="accuracy-note"><strong>准确性提示</strong><p>闽南语称呼因泉州、厦门、漳州及家庭习惯而异。当前为演示词库，正式版允许逐条确认。</p></div>
      </aside>
    </main>

    {showAdd && <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}><form className="add-modal relation-modal" onSubmit={addPerson} onMouseDown={(e) => e.stopPropagation()}>
      <div><span className="eyebrow">完整关系录入</span><h2>添加与 {viewer.name} 有关的亲人</h2><p>先选择现实中的称谓；系统会把它转换成可验证的父母、子女或配偶关系。</p></div>
      <fieldset className="relation-picker"><legend>相对于 {viewer.name} 的关系</legend>
        {[...new Set(relationOptions.map((option) => option.group))].map((group) => <div className="relation-group" key={group}><span>{group}</span><div>{relationOptions.filter((option) => option.group === group).map((option) => <button type="button" key={option.id} className={relationKind === option.id ? 'active' : ''} onClick={() => { setRelationKind(option.id); setRelationAnchorId('') }}><strong>{option.label}</strong><small>{option.description}</small></button>)}</div></div>)}
      </fieldset>
      {!['parent', 'child', 'spouse'].includes(relationKind) && <label>用于建立关系的已有亲人
        <select value={effectiveAnchorId} onChange={(event) => setRelationAnchorId(event.target.value)} required>
          {!relationAnchors.length && <option value="">暂无可连接人物</option>}
          {relationAnchors.map((id) => { const person = data.people.find((item) => item.id === id)!; return <option key={id} value={id}>{person.name} · {calculateKinship(data, viewerId, id).mandarin[0]}</option> })}
        </select>
        {!relationAnchors.length && relationKind !== 'custom' && <small className="field-warning">图中还缺少建立此关系所需的中间亲人，请先添加或使用“精确连接”。</small>}
      </label>}
      {relationKind === 'custom' && <label>新人物是所选亲人的
        <select value={directRelation} onChange={(event) => setDirectRelation(event.target.value as DirectRelation)}><option value="parent">父母</option><option value="child">子女</option><option value="spouse">配偶</option></select>
      </label>}
      <div className="relation-preview"><span>将写入的关系链</span><strong>{relationPreview(data, viewerId, relationKind, effectiveAnchorId, directRelation)}</strong></div>
      <label>姓名<input name="name" autoFocus placeholder="例如：王小安" required/></label>
      <div className="form-row"><label>性别<select name="gender"><option value="male">男性</option><option value="female">女性</option></select></label><BirthdayField defaultValue="2000-01-01" required/></div>
      <div className="modal-actions"><button type="button" onClick={() => setShowAdd(false)}>取消</button><button className="primary-button" type="submit" disabled={!['parent', 'child', 'spouse'].includes(relationKind) && !effectiveAnchorId}>加入图谱</button></div>
    </form></div>}
    {showRelations && <div className="modal-backdrop" onMouseDown={() => setShowRelations(false)}><section className="relations-modal" role="dialog" aria-modal="true" aria-labelledby="relations-title" onMouseDown={(e) => e.stopPropagation()}>
      <div><span className="eyebrow">关系维护</span><h2 id="relations-title">{selected.name} 的直接关系</h2><p>这里只显示家谱中实际保存的基础连接；移除连接不会删除人物。</p></div>
      <div className="direct-relations">
        {data.parents.filter((item) => item.parentId === selected.id || item.childId === selected.id).map((item) => { const otherId = item.parentId === selected.id ? item.childId : item.parentId; const other = data.people.find((person) => person.id === otherId)!; const label = item.parentId === selected.id ? `${other.name}的父母` : `${other.name}的子女`; return <div key={`${item.parentId}-${item.childId}`}><span><strong>{other.name}</strong><small>{label}</small></span><button type="button" onClick={() => removeDirectRelation('parent', item.parentId, item.childId)}>移除</button></div> })}
        {data.spouses.filter((item) => item.personAId === selected.id || item.personBId === selected.id).map((item) => { const otherId = item.personAId === selected.id ? item.personBId : item.personAId; const other = data.people.find((person) => person.id === otherId)!; return <div key={`${item.personAId}-${item.personBId}`}><span><strong>{other.name}</strong><small>配偶</small></span><button type="button" onClick={() => removeDirectRelation('spouse', item.personAId, item.personBId)}>移除</button></div> })}
        {!data.parents.some((item) => item.parentId === selected.id || item.childId === selected.id) && !data.spouses.some((item) => item.personAId === selected.id || item.personBId === selected.id) && <div className="empty-relations">这个人物暂时没有直接关系</div>}
      </div>
      <div className="modal-actions"><button type="button" onClick={() => setShowRelations(false)}>完成</button></div>
    </section></div>}
    {showEdit && <div className="modal-backdrop" onMouseDown={() => setShowEdit(false)}><form className="add-modal edit-modal" onSubmit={editPerson} onMouseDown={(e) => e.stopPropagation()}>
      <div><span className="eyebrow">人物档案</span><h2>编辑 {selected.name}</h2><p>修改后会同步更新人物列表、家族画布和亲属称呼。</p></div>
      {AVATAR_FEATURE_ENABLED && <div className="avatar-editor">
        <Avatar person={{ ...selected, avatar: avatarDraft }} size="large"/>
        <div className="avatar-editor-copy"><strong>人物头像</strong><small>支持 JPG、PNG、WebP，文件不超过 5MB</small>
          <div className="avatar-editor-actions"><label className="upload-avatar-button">{avatarDraft ? '更换图片' : '上传图片'}<input type="file" accept="image/*" onChange={(event) => { uploadAvatar(event.target.files?.[0]); event.currentTarget.value = '' }}/></label>{avatarDraft && <button type="button" onClick={() => setAvatarDraft(undefined)}>移除头像</button>}</div>
        </div>
      </div>}
      <label>姓名<input name="name" autoFocus defaultValue={selected.name} placeholder="请输入真实姓名" required/></label>
      <div className="form-row">
        <label>性别<select name="gender" defaultValue={selected.gender}><option value="male">男性</option><option value="female">女性</option></select></label>
        <BirthdayField defaultValue={selected.birthDate}/>
      </div>
      <label>人物备注<textarea name="note" rows={3} defaultValue={selected.note ?? ''} placeholder="籍贯、小名、家庭记忆等"/></label>
      <div className="form-scope-note"><Icon name="person"/><span>此处编辑人物资料；父母、配偶、子女等关系将在“编辑关系”中单独维护。</span></div>
      <div className="modal-actions split-actions">
        <button className="danger-button" type="button" disabled={data.people.length <= 1} title={data.people.length <= 1 ? '图谱中至少需要保留一个人物' : undefined} onClick={() => { setShowEdit(false); setDeleteTargetId(selected.id) }}><Icon name="trash"/>删除人物</button>
        <span className="action-spacer"/>
        <button type="button" onClick={() => setShowEdit(false)}>取消</button><button className="primary-button" type="submit">保存修改</button>
      </div>
    </form></div>}
    {showBackup && <div className="modal-backdrop" onMouseDown={() => setShowBackup(false)}><section className="backup-modal" role="dialog" aria-modal="true" aria-labelledby="backup-title" onMouseDown={(e) => e.stopPropagation()}>
      <div><span className="eyebrow">本地档案</span><h2 id="backup-title">备份与恢复家谱</h2><p>数据只保存在当前浏览器。定期导出一份精简备份，可以在清理浏览器或更换设备后恢复。</p></div>
      <div className="backup-options">
        <section><strong>导出当前家谱</strong><p>下载不含头像和历史记录的紧凑 JSON 文件。</p><button type="button" onClick={exportBackup}>导出备份</button></section>
        <section><strong>从备份恢复</strong><p>导入会覆盖当前家谱，文件必须来自本应用且不超过 1MB。</p><label className="import-backup-button">选择备份文件<input type="file" accept="application/json,.json" onChange={(event) => { void importBackup(event.target.files?.[0]); event.currentTarget.value = '' }}/></label></section>
      </div>
      <div className="modal-actions"><button type="button" onClick={() => setShowBackup(false)}>关闭</button></div>
    </section></div>}
    {deleteTarget && <div className="modal-backdrop" onMouseDown={() => setDeleteTargetId(null)}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-person-title" onMouseDown={(e) => e.stopPropagation()}>
      <div className="danger-mark"><Icon name="trash"/></div>
      <div><span className="eyebrow">删除人物</span><h2 id="delete-person-title">确认删除 {deleteTarget.name}？</h2><p>人物资料及其父母、子女、配偶关系将一并删除，此操作无法撤销。</p></div>
      <div className="modal-actions"><button type="button" onClick={() => setDeleteTargetId(null)}>取消</button><button className="confirm-delete-button" type="button" onClick={deletePerson}>确认删除</button></div>
    </section></div>}
    {toast && <div className="toast"><span className="mini-seal">我</span>{toast}</div>}
  </div>
}

export default App
