import { CSSProperties, FormEvent, PointerEvent, useCallback, useEffect, useId, useMemo, useRef, useState, WheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { initialFamily, showcaseFamily } from './data'
import { clearFamilyData, loadFamilyData, parseFamilyBackup, saveFamilyData, serializeFamilyBackup, serializeFamilyMarkdown } from './familyStorage'
import { calculateKinship } from './kinship'
import { hasMinnanRecording, speakMinnan, stopMinnanSpeech } from './minnanSpeech'
import { addBasicRelationship, ensureSpouseCoParents, removeBasicRelationship, resolvePersonOverlaps, suggestedBasicPlacement } from './relationEditor'
import type { BasicRelation } from './relationEditor'
import type { FamilyData, Gender, Person } from './types'
import { formatZodiac } from './zodiac'
import { birthYearFromDate, formatLunarBirthday, formatSolarBirthday, isBirthDate } from './lunar'
import { inspectFamilyHealth } from './familyHealth'
import { legalFilterOptions, matchesLegalFilter } from './legalKinship'
import type { LegalFilterId } from './legalKinship'
import { useRegisterSW } from 'virtual:pwa-register/react'

const HOME_ID = 'me'
const CARD_W = 148
const CARD_H = 94
// Connections render behind the cards. The graph is commonly fitted below 50%,
// where a tiny overlap can be rounded into a visible gap at the card border.
const CONNECTION_OVERLAP = 12
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
  const initial = isBirthDate(defaultValue) ? defaultValue.split('-').map(Number) : [2000, 1, 1]
  const [visibleYear, setVisibleYear] = useState(initial[0])
  const [visibleMonth, setVisibleMonth] = useState(initial[1] - 1)
  const [open, setOpen] = useState(false)
  const fieldRef = useRef<HTMLDivElement>(null)
  const calendarId = useId()
  const lunar = formatLunarBirthday(value)
  const selectedParts = isBirthDate(value) ? value.split('-').map(Number) : null
  const daysInMonth = new Date(visibleYear, visibleMonth + 1, 0).getDate()
  const leadingDays = new Date(visibleYear, visibleMonth, 1).getDay()
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - leadingDays + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })
  const today = new Date()

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      if (!fieldRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const chooseDay = (day: number) => {
    setValue(`${visibleYear}-${String(visibleMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    setOpen(false)
  }

  return <label className="birthday-field">公历生日
    <div className="date-picker" ref={fieldRef}>
      <input name="birthDate" type="hidden" value={value}/>
      <button className={`date-trigger ${value ? '' : 'placeholder'}`} type="button" aria-expanded={open} aria-controls={calendarId} onClick={() => setOpen((current) => !current)}>
        <span>{value ? `${selectedParts![0]} 年 ${selectedParts![1]} 月 ${selectedParts![2]} 日` : '请选择出生日期'}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/></svg>
      </button>
      {required && <input className="date-required-proxy" tabIndex={-1} aria-hidden="true" required value={value} onChange={() => undefined}/>}
      {open && <div className="calendar-popover" id={calendarId} role="dialog" aria-label="选择公历生日">
        <div className="calendar-heading">
          <select aria-label="年份" value={visibleYear} onChange={(event) => setVisibleYear(Number(event.target.value))}>
            {Array.from({ length: 301 }, (_, index) => 1800 + index).map((year) => <option key={year} value={year}>{year} 年</option>)}
          </select>
          <select aria-label="月份" value={visibleMonth} onChange={(event) => setVisibleMonth(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{month + 1} 月</option>)}
          </select>
          <span className="calendar-mark">生辰</span>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((day, index) => day ? <button
            type="button"
            key={`${visibleYear}-${visibleMonth}-${day}`}
            className={`${selectedParts?.[0] === visibleYear && selectedParts?.[1] === visibleMonth + 1 && selectedParts?.[2] === day ? 'selected' : ''} ${today.getFullYear() === visibleYear && today.getMonth() === visibleMonth && today.getDate() === day ? 'today' : ''}`}
            onClick={() => chooseDay(day)}
            aria-label={`${visibleYear}年${visibleMonth + 1}月${day}日`}
          >{day}</button> : <span key={`empty-${index}`}/>) }
        </div>
        <div className="calendar-footer"><span>选择后自动换算农历</span>{value && <button type="button" onClick={() => { setValue(''); setOpen(false) }}>清除</button>}</div>
      </div>}
    </div>
    <small className={`lunar-preview ${lunar ? '' : 'empty'}`} aria-live="polite">{lunar ? `农历 · ${lunar}` : '选择后自动换算农历'}</small>
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

function SearchablePersonSelect({ people, value, onChange, label }: { people: Person[]; value: string; onChange: (id: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState({ left: 0, top: 0, width: 240, maxHeight: 280 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = people.find((person) => person.id === value)
  const filtered = people.filter((person) => person.name.includes(query)).sort((a, b) => query ? 0 : a.id === value ? -1 : b.id === value ? 1 : 0).slice(0, 20)
  const toggle = () => {
    if (open) { setOpen(false); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16)
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const opensUp = spaceBelow < 280 && spaceAbove > spaceBelow
      const maxHeight = Math.min(280, Math.max(120, (opensUp ? spaceAbove : spaceBelow) - 8))
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: opensUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4, width, maxHeight })
    }
    setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => { if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const closeOnLayoutChange = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnLayoutChange)
    window.addEventListener('scroll', closeOnLayoutChange, true)
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeOnEscape); window.removeEventListener('resize', closeOnLayoutChange); window.removeEventListener('scroll', closeOnLayoutChange, true) }
  }, [open])
  return <div className="person-select"><button ref={triggerRef} type="button" onClick={toggle} aria-expanded={open} aria-label={label}><span>{selected?.name ?? '选择人物'}</span><i>⌄</i></button>{open && createPortal(<div className="person-select-menu" ref={menuRef} style={position}><label><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索人物" autoFocus/></label><div>{filtered.map((person) => <button type="button" key={person.id} onClick={() => { onChange(person.id); setOpen(false); setQuery('') }}><Avatar person={person} size="small"/><span><strong>{person.name}</strong><small>{person.birthYear} 年</small></span>{person.id === value && <i>✓</i>}</button>)}{!filtered.length && <p>没有找到匹配人物</p>}</div></div>, document.body)}</div>
}

function RelationshipComposer({ data, subjectId, subjectName, defaultAnchorId }: { data: FamilyData; subjectId?: string; subjectName: string; defaultAnchorId?: string }) {
  const candidates = data.people.filter((person) => person.id !== subjectId)
  const [anchorId, setAnchorId] = useState(defaultAnchorId && candidates.some((person) => person.id === defaultAnchorId) ? defaultAnchorId : candidates[0]?.id ?? '')
  const [relation, setRelation] = useState<BasicRelation>('child')
  const anchorHasParents = data.parents.some((item) => item.childId === anchorId)
  return <div className="relationship-composer">
    <input type="hidden" name="anchorId" value={anchorId}/><input type="hidden" name="basicRelation" value={relation}/>
    <span className="relationship-label">基础关系</span>
    <div className="compact-relationship-row"><strong>{subjectName}</strong><span>是</span>
      <SearchablePersonSelect people={candidates} value={anchorId} onChange={setAnchorId} label="选择支点人物"/>
      <span>的</span><select value={relation} onChange={(event) => setRelation(event.target.value as BasicRelation)} aria-label={`${subjectName}与支点人物的关系`}><option value="parent">父母</option><option value="child">子女</option><option value="sibling" disabled={!anchorHasParents}>亲兄弟姐妹</option><option value="spouse">配偶</option></select>
    </div>
    {relation === 'sibling' && !anchorHasParents && <p className="field-warning">所选人物还没有父母资料，暂时无法建立亲兄弟姐妹关系。</p>}
  </div>
}

function rosterRelationshipSeed(data: FamilyData, subjectId: string, viewerId: string): { anchorId: string; relation: BasicRelation | '' } {
  const preferred = viewerId !== subjectId ? viewerId : data.people.find((person) => person.id !== subjectId)?.id ?? ''
  const anchors = [preferred, ...data.people.filter((person) => person.id !== subjectId && person.id !== preferred).map((person) => person.id)]
  for (const anchorId of anchors) {
    if (data.parents.some((item) => item.parentId === subjectId && item.childId === anchorId)) return { anchorId, relation: 'parent' }
    if (data.parents.some((item) => item.parentId === anchorId && item.childId === subjectId)) return { anchorId, relation: 'child' }
    if (data.spouses.some((item) => [item.personAId, item.personBId].includes(subjectId) && [item.personAId, item.personBId].includes(anchorId))) return { anchorId, relation: 'spouse' }
    const anchorParents = new Set(data.parents.filter((item) => item.childId === anchorId).map((item) => item.parentId))
    if (anchorParents.size && data.parents.some((item) => item.childId === subjectId && anchorParents.has(item.parentId))) return { anchorId, relation: 'sibling' }
  }
  return { anchorId: preferred, relation: '' }
}

function RosterRelationshipCell({ data, person, viewerId }: { data: FamilyData; person: Person; viewerId: string }) {
  const seed = rosterRelationshipSeed(data, person.id, viewerId)
  const candidates = data.people.filter((item) => item.id !== person.id)
  const [anchorId, setAnchorId] = useState(seed.anchorId)
  const [relation, setRelation] = useState<BasicRelation | ''>(seed.relation)
  const labels = person.gender === 'female'
    ? { parent: '母亲', child: '女儿', sibling: '亲姐妹', spouse: '配偶' }
    : { parent: '父亲', child: '儿子', sibling: '亲兄弟', spouse: '配偶' }
  return <div className="roster-relationship-cell">
    <input type="hidden" name={`anchor:${person.id}`} value={anchorId}/><input type="hidden" name={`relation:${person.id}`} value={relation}/>
    <input type="hidden" name={`originalAnchor:${person.id}`} value={seed.anchorId}/><input type="hidden" name={`originalRelation:${person.id}`} value={seed.relation}/>
    <SearchablePersonSelect people={candidates} value={anchorId} onChange={setAnchorId} label={`${person.name}的支点人物`}/>
    <select value={relation} onChange={(event) => setRelation(event.target.value as BasicRelation | '')} aria-label={`${person.name}与支点人物的关系`}><option value="">未设置</option><option value="parent">{labels.parent}</option><option value="child">{labels.child}</option><option value="sibling">{labels.sibling}</option><option value="spouse">配偶</option></select>
  </div>
}

function Graph({ data, viewerId, selectedId, onSelect, onMakeViewer, onAdd, onEdit, onDelete }: {
  data: FamilyData; viewerId: string; selectedId: string; onSelect: (id: string) => void; onMakeViewer: (id: string) => void; onAdd: (anchorId?: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ distance: number; centerX: number; centerY: number; camera: { x: number; y: number; scale: number } } | null>(null)
  const restoredCamera = useMemo(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('kinship-map:camera') ?? '')
      return Number.isFinite(stored.x) && Number.isFinite(stored.y) && Number.isFinite(stored.scale) ? stored : null
    } catch { return null }
  }, [])
  const hasInitialCameraRef = useRef(Boolean(restoredCamera))
  const [camera, setCamera] = useState<{ x: number; y: number; scale: number }>(restoredCamera ?? { x: 0, y: 0, scale: .72 })
  const [dragging, setDragging] = useState(false)
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
  const [generationView, setGenerationView] = useState<number | null>(null)
  // Start with the complete family graph visible. Focus is an opt-in reading
  // aid; enabling it by default makes valid relationships look disconnected.
  const [relationshipFocus, setRelationshipFocus] = useState(false)
  const [legalFilter, setLegalFilter] = useState<LegalFilterId | null>(null)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState<'generation' | 'legal'>('generation')
  const filterRef = useRef<HTMLDivElement>(null)
  const people = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people])
  const matchedIds = useMemo(() => new Set(legalFilter ? data.people.filter((person) => matchesLegalFilter(data, viewerId, person.id, legalFilter)).map((person) => person.id) : []), [data, viewerId, legalFilter])
  const generationOptions = ['祖辈', '父辈', '同辈', '晚辈']
  const viewerGeneration = people.get(viewerId)?.generation ?? 0
  const matchesGenerationView = (personGeneration: number, view: number | null = generationView) => {
    if (view === null) return true
    if (view === 0) return personGeneration < viewerGeneration - 1
    if (view === 1) return personGeneration === viewerGeneration - 1
    if (view === 2) return personGeneration === viewerGeneration
    return personGeneration > viewerGeneration
  }
  const focusIds = useMemo(() => {
    const ids = new Set([selectedId])
    data.parents.forEach(({ parentId, childId }) => {
      if (parentId === selectedId) ids.add(childId)
      if (childId === selectedId) ids.add(parentId)
    })
    data.spouses.forEach(({ personAId, personBId }) => {
      if (personAId === selectedId) ids.add(personBId)
      if (personBId === selectedId) ids.add(personAId)
    })
    return ids
  }, [data.parents, data.spouses, selectedId])

  useEffect(() => {
    if (!filterMenuOpen) return
    const closeOutside = (event: MouseEvent) => { if (!filterRef.current?.contains(event.target as Node)) setFilterMenuOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFilterMenuOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [filterMenuOpen])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenActionsId(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  const fitView = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || data.people.length === 0) return
    const left = Math.min(...data.people.map((person) => person.x))
    const right = Math.max(...data.people.map((person) => person.x + CARD_W))
    const top = Math.min(...data.people.map((person) => person.y))
    const bottom = Math.max(...data.people.map((person) => person.y + CARD_H))
    const padding = Math.min(96, viewport.clientWidth * .24, viewport.clientHeight * .2)
    const scale = Math.min(
      (viewport.clientWidth - padding) / Math.max(right - left, CARD_W),
      (viewport.clientHeight - padding) / Math.max(bottom - top, CARD_H),
      1.15,
    )
    setCamera({
      scale,
      x: viewport.clientWidth / 2 - ((left + right) / 2) * scale,
      y: viewport.clientHeight / 2 - ((top + bottom) / 2) * scale,
    })
  }, [data.people])

  useEffect(() => {
    if (hasInitialCameraRef.current) return
    fitView()
    hasInitialCameraRef.current = true
  }, [fitView, restoredCamera])

  useEffect(() => {
    sessionStorage.setItem('kinship-map:camera', JSON.stringify(camera))
  }, [camera])

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

  const showGeneration = (generation: number | null) => {
    if (generation === null || generationView === generation) {
      setGenerationView(null)
      fitView()
      return
    }

    const viewport = viewportRef.current
    const matches = data.people.filter((person) => matchesGenerationView(person.generation, generation))
    setGenerationView(generation)
    setLegalFilter(null)
    setRelationshipFocus(false)
    if (!viewport || matches.length === 0) return

    const left = Math.min(...matches.map((person) => person.x))
    const right = Math.max(...matches.map((person) => person.x + CARD_W))
    const top = Math.min(...matches.map((person) => person.y))
    const bottom = Math.max(...matches.map((person) => person.y + CARD_H))
    const padding = 96
    const scale = Math.min(
      (viewport.clientWidth - padding) / Math.max(right - left, CARD_W),
      (viewport.clientHeight - padding) / Math.max(bottom - top, CARD_H),
      1.15,
    )
    setCamera({
      scale,
      x: viewport.clientWidth / 2 - ((left + right) / 2) * scale,
      y: viewport.clientHeight / 2 - ((top + bottom) / 2) * scale,
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
    if (event.pointerType === 'touch') {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()]
        pinchRef.current = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          centerX: (a.x + b.x) / 2,
          centerY: (a.y + b.y) / 2,
          camera,
        }
        dragRef.current = null
        setDragging(false)
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }
    }
    if ((event.target as HTMLElement).closest('button')) return
    setOpenActionsId(null)
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: camera.x, originY: camera.y }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointersRef.current.size >= 2 && pinchRef.current) {
        const viewport = viewportRef.current
        const [a, b] = [...pointersRef.current.values()]
        if (!viewport) return
        const rect = viewport.getBoundingClientRect()
        const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
        const centerX = (a.x + b.x) / 2 - rect.left
        const centerY = (a.y + b.y) / 2 - rect.top
        const originCenterX = pinchRef.current.centerX - rect.left
        const originCenterY = pinchRef.current.centerY - rect.top
        const scale = Math.min(1.6, Math.max(.3, pinchRef.current.camera.scale * distance / Math.max(1, pinchRef.current.distance)))
        const worldX = (originCenterX - pinchRef.current.camera.x) / pinchRef.current.camera.scale
        const worldY = (originCenterY - pinchRef.current.camera.y) / pinchRef.current.camera.scale
        setCamera({ scale, x: centerX - worldX * scale, y: centerY - worldY * scale })
        return
      }
    }
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setCamera((current) => ({ ...current, x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY }))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      setDragging(false)
    }
  }
  const parentGroups = new Map<string, { parentIds: string[]; childIds: string[] }>()
  const parentsByChild = new Map<string, string[]>()
  const spousePairs = new Set(data.spouses.map(({ personAId, personBId }) => [personAId, personBId].sort().join('|')))
  data.parents.forEach(({ parentId, childId }) => {
    parentsByChild.set(childId, [...(parentsByChild.get(childId) ?? []), parentId])
  })
  parentsByChild.forEach((parentIds, childId) => {
    const sortedParentIds = [...new Set(parentIds)].sort()
    const key = sortedParentIds.join('|')
    const group = parentGroups.get(key) ?? { parentIds: sortedParentIds, childIds: [] }
    group.childIds.push(childId)
    parentGroups.set(key, group)
  })
  const parentLines = [...parentGroups.entries()].map(([key, { parentIds, childIds }]) => {
    const parents = parentIds.map((id) => people.get(id)).filter(Boolean) as Person[]
    const children = childIds.map((id) => people.get(id)).filter(Boolean) as Person[]
    if (!parents.length || !children.length) return null
    const memberIds = [...parentIds, ...childIds]
    const members = [...parents, ...children]
    const parentBottom = Math.max(...parents.map((person) => person.y + CARD_H))
    const childTop = Math.min(...children.map((person) => person.y))
    const railY = parentBottom + Math.max(8, (childTop - parentBottom) / 2)
    const parentCenters = parents.map((person) => person.x + CARD_W / 2)
    const childCenters = children.map((person) => person.x + CARD_W / 2)
    const trunkX = parentCenters.reduce((total, x) => total + x, 0) / parentCenters.length
    const railLeft = Math.min(trunkX, ...childCenters)
    const railRight = Math.max(trunkX, ...childCenters)
    const parentsAreSpouses = parentIds.length === 2 && spousePairs.has([...parentIds].sort().join('|'))
    const spouseY = parents.reduce((total, person) => total + person.y + CARD_H / 2, 0) / parents.length
    const parentBranches = parentsAreSpouses
      ? `M ${trunkX} ${spouseY} V ${railY}`
      : parents.map((person) => `M ${person.x + CARD_W / 2} ${person.y + CARD_H - CONNECTION_OVERLAP} V ${railY}`).join(' ')
    const childBranches = children.map((person) => `M ${person.x + CARD_W / 2} ${railY} V ${person.y + CONNECTION_OVERLAP}`).join(' ')
    const rail = `M ${railLeft} ${railY} H ${railRight}`
    const faded = generationView !== null && members.every((person) => !matchesGenerationView(person.generation))
    const legalFaded = legalFilter !== null && memberIds.every((id) => !matchedIds.has(id) && id !== viewerId)
    const focused = memberIds.includes(selectedId)
    const connectionState = `${faded ? 'generation-faded' : ''} ${legalFaded ? 'view-filtered-out' : ''} ${relationshipFocus ? (focused ? 'relationship-focused' : 'relationship-muted') : ''}`
    return <g key={key} className={`family-connection ${connectionState}`}>
      <path className="blood-line family-rail" d={`${parentBranches} ${rail} ${childBranches}`} />
    </g>
  })
  const spouseLines = data.spouses.map(({ personAId, personBId }) => {
    const a = people.get(personAId)!; const b = people.get(personBId)!
    const faded = generationView !== null && !matchesGenerationView(a.generation) && !matchesGenerationView(b.generation)
    const legalFaded = legalFilter !== null && !matchedIds.has(personAId) && !matchedIds.has(personBId) && personAId !== viewerId && personBId !== viewerId
    const focused = personAId === selectedId || personBId === selectedId
    const [left, right] = a.x <= b.x ? [a, b] : [b, a]
    return <path key={`${personAId}-${personBId}`} className={`spouse-line ${faded ? 'generation-faded' : ''} ${legalFaded ? 'view-filtered-out' : ''} ${relationshipFocus ? (focused ? 'relationship-focused' : 'relationship-muted') : ''}`} d={`M ${left.x + CARD_W - CONNECTION_OVERLAP} ${left.y + CARD_H / 2} L ${right.x + CONNECTION_OVERLAP} ${right.y + CARD_H / 2}`} />
  })
  const actionPlacement = (person: Person) => {
    const gap = 10
    const actionWidth = 153 / camera.scale
    const actionHeight = 44 / camera.scale
    const candidates = [
      { side: 'bottom', x: person.x + CARD_W / 2 - actionWidth / 2, y: person.y + CARD_H + gap },
      { side: 'right', x: person.x + CARD_W + gap, y: person.y + CARD_H / 2 - actionHeight / 2 },
      { side: 'left', x: person.x - gap - actionWidth, y: person.y + CARD_H / 2 - actionHeight / 2 },
      { side: 'top', x: person.x + CARD_W / 2 - actionWidth / 2, y: person.y - gap - actionHeight },
    ] as const
    const overlapScore = (candidate: typeof candidates[number]) => data.people.reduce((score, other) => {
      if (other.id === person.id) return score
      const overlaps = candidate.x < other.x + CARD_W && candidate.x + actionWidth > other.x
        && candidate.y < other.y + CARD_H && candidate.y + actionHeight > other.y
      return score + (overlaps ? 1 : 0)
    }, 0)
    return candidates.reduce((best, candidate) => overlapScore(candidate) < overlapScore(best) ? candidate : best).side
  }
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
    <div className="graph-stage" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`, '--canvas-scale': camera.scale } as CSSProperties}>
      <svg className="connections" viewBox="0 0 1400 830" aria-hidden="true">{parentLines}{spouseLines}</svg>
      {data.people.map((person) => {
        const result = calculateKinship(data, viewerId, person.id)
        const isViewer = person.id === viewerId
        const isSelected = person.id === selectedId
        const filteredOut = legalFilter !== null && !matchedIds.has(person.id) && !isViewer
        const outsideRelationshipFocus = relationshipFocus && !focusIds.has(person.id)
        return <div
          key={person.id}
          className={`person-node-wrap ${openActionsId === person.id ? 'actions-open' : ''} ${isSelected ? 'selected' : ''}`}
          style={{ left: person.x, top: person.y }}
        >
          <button type="button" className={`person-node ${isViewer ? 'viewer' : ''} ${isSelected ? 'selected' : ''} ${outsideRelationshipFocus ? 'relationship-muted' : ''} ${relationshipFocus && focusIds.has(person.id) ? 'relationship-focused' : ''} ${generationView !== null && !matchesGenerationView(person.generation) ? 'generation-faded' : ''} ${generationView !== null && matchesGenerationView(person.generation) ? 'generation-highlighted' : ''} ${filteredOut ? 'legal-filtered-out' : ''} ${legalFilter && matchedIds.has(person.id) ? 'legal-filter-match' : ''}`}
            onClick={() => { onSelect(person.id); setOpenActionsId(null) }} onDoubleClick={() => { setOpenActionsId(null); onMakeViewer(person.id) }} aria-label={`${person.name}，${result.mandarin[0]}`} aria-expanded={openActionsId === person.id}>
            {isViewer && <span className="viewer-pin">我</span>}
            <Avatar person={person}/>
            <span className="node-copy"><strong>{person.name}</strong><small>{result.mandarin[0]}</small></span>
          </button>
          {isSelected && openActionsId !== person.id && <button className="node-more-button" type="button" onClick={() => setOpenActionsId(person.id)} aria-label={`打开${person.name}的操作栏`} title="更多操作">•••</button>}
          {openActionsId === person.id && <div className={`node-actions actions-${actionPlacement(person)}`} role="toolbar" aria-label={`${person.name}的快捷操作`}>
            <button type="button" onClick={() => { setOpenActionsId(null); onAdd(person.id) }} aria-label={`为${person.name}新增亲属`} title="新增亲属"><Icon name="plus"/><span>新增</span></button>
            <button type="button" onClick={() => { setOpenActionsId(null); onEdit(person.id) }} aria-label={`编辑${person.name}`} title="编辑人物"><Icon name="edit"/><span>编辑</span></button>
            <button type="button" disabled={isViewer} onClick={() => { setOpenActionsId(null); onMakeViewer(person.id) }} aria-label={`以${person.name}为主视角`} title={isViewer ? '当前已是主视角' : '设为主视角'}><Icon name="person"/><span>主视角</span></button>
            <button className="node-delete-action" type="button" disabled={data.people.length <= 1} onClick={() => { setOpenActionsId(null); onDelete(person.id) }} aria-label={`删除${person.name}`} title="删除人物"><Icon name="trash"/><span>删除</span></button>
          </div>}
        </div>
      })}
    </div>
    <div className="quick-filter" ref={filterRef}>
      <div className="quick-filter-triggers" aria-label="画布快速筛选">
        <button className={`quick-filter-trigger focus-filter-trigger ${relationshipFocus ? 'active' : ''}`} type="button" aria-pressed={relationshipFocus} onClick={() => { const next = !relationshipFocus; setRelationshipFocus(next); if (next) { setGenerationView(null); setLegalFilter(null); setFilterMenuOpen(false); fitView() } }} title={relationshipFocus ? `已突出与当前人物直接相连的 ${Math.max(0, focusIds.size - 1)} 人，点击关闭` : '突出与当前人物直接相连的人物'}>
          <span>聚焦</span>
        </button>
        <button className={`quick-filter-trigger ${generationView !== null ? 'active' : ''}`} type="button" aria-haspopup="menu" aria-expanded={filterMenuOpen && filterCategory === 'generation'} onClick={() => { setFilterCategory('generation'); setFilterMenuOpen((current) => filterCategory !== 'generation' || !current) }}>
          <span>辈分</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
        </button>
        <button className={`quick-filter-trigger ${legalFilter ? 'active' : ''}`} type="button" aria-haspopup="menu" aria-expanded={filterMenuOpen && filterCategory === 'legal'} onClick={() => { setFilterCategory('legal'); setFilterMenuOpen((current) => filterCategory !== 'legal' || !current) }}>
          <span>法律</span>{legalFilter && <em>{matchedIds.size}</em>}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
        </button>
      </div>
      {filterMenuOpen && <div className="quick-filter-menu" role="menu" aria-label={`${filterCategory === 'generation' ? '辈分' : '法律'}筛选`}>
        {filterCategory === 'generation' ? <div className="view-options">
          <div className="filter-menu-heading"><span>按辈分筛选</span><small>定位并突出画布中的人物</small></div>
          {generationOptions.map((label, generation) => <button key={label} type="button" role="menuitemradio" className={generationView === generation ? 'active' : ''} aria-checked={generationView === generation} onClick={() => { showGeneration(generation); setFilterMenuOpen(false) }}><span><b>{label}</b><small>定位画布中的{label}人物</small></span><i>{generationView === generation ? '✓' : ''}</i></button>)}
        </div> : <div className="view-options">
          <div className="filter-menu-heading"><span>按法律关系筛选</span><small>以 {data.people.find((person) => person.id === viewerId)?.name} 为中心判定</small></div>
          {legalFilterOptions.map((option) => <button key={option.id} type="button" role="menuitemradio" aria-checked={legalFilter === option.id} className={legalFilter === option.id ? 'active' : ''} onClick={() => { setLegalFilter(option.id); setGenerationView(null); setRelationshipFocus(false); setFilterMenuOpen(false) }}><span><b>{option.label}</b><small>{option.description}</small></span><i>{legalFilter === option.id ? '✓' : ''}</i></button>)}
          <div className="filter-data-note">“家庭成员”需要共同生活资料，暂不自动判定</div>
        </div>}
        {(legalFilter || generationView !== null) && <button className="clear-quick-filter" type="button" onClick={() => { setLegalFilter(null); setGenerationView(null); fitView(); setFilterMenuOpen(false) }}>显示全部人物</button>}
      </div>}
    </div>
    <div className="canvas-controls" aria-label="画布控制">
      <button onClick={() => zoomAtCenter(1.2)} aria-label="放大画布">＋</button>
      <span>{Math.round(camera.scale * 100)}%</span>
      <button onClick={() => zoomAtCenter(1 / 1.2)} aria-label="缩小画布">－</button>
      <i />
      <button className="fit-button" onClick={fitView} aria-label="适应全部人物">适应</button>
    </div>
    <div className="pan-hint">按住空白处拖动 · 滚轮或双指缩放</div>
  </div>
}

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
  const [mobileView, setMobileView] = useState<'graph' | 'people' | 'detail'>('graph')
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
  const filtered = data.people.filter((p) => p.name.includes(query) || calculateKinship(data, viewerId, p.id).mandarin.some((term) => term.includes(query)))
  const pathPeople = result.pathIds.map((id) => data.people.find((p) => p.id === id)!).filter(Boolean)
  const hasOfficialRecording = hasMinnanRecording(result.minnanAudioTerms)
  const healthIssues = useMemo(() => inspectFamilyHealth(data), [data])
  const pairForward = calculateKinship(data, pairAId, pairBId)
  const pairReverse = calculateKinship(data, pairBId, pairAId)

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
    const fallback = data.people.find((person) => person.id !== deleteTarget.id)!
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
    <header className="topbar">
      <div className="brand"><span className="brand-seal">亲</span><div><strong>亲族图谱</strong><small>称呼从关系里自然生长</small></div></div>
      <div className="viewpoint-chip"><span>当前主视角</span><strong>{viewer.name}</strong><em>{viewerId === HOME_ID ? '本人' : '代入视角'}</em></div>
      <div className={`header-tools ${mobileToolsOpen ? 'open' : ''}`}>
        <button className="mobile-tools-trigger" type="button" aria-expanded={mobileToolsOpen} onClick={() => setMobileToolsOpen((current) => !current)}>工具<span aria-hidden="true">•••</span></button>
        <div className="header-actions" onClick={() => setMobileToolsOpen(false)}>
        {saveState !== 'saved' && <span className={`save-status ${saveState}`} role="status" aria-live="polite">
          <i/>{saveState === 'loading' ? '读取本地档案' : saveState === 'saving' ? '正在保存' : '本地保存失败'}
        </span>}
        {viewerId !== HOME_ID && data.people.some((person) => person.id === HOME_ID) && <button className="text-button" onClick={() => makeViewer(HOME_ID)}><Icon name="home"/>回到我</button>}
        <button className="backup-button" onClick={undo} disabled={!canUndo}>撤销</button>
        <button className="backup-button" onClick={() => { setPairAId(viewerId); setPairBId(selectedId === viewerId ? data.people.find((person) => person.id !== viewerId)?.id ?? viewerId : selectedId); setShowPair(true) }}>两人关系</button>
        <button className={`backup-button ${healthIssues.length ? 'has-issues' : ''}`} onClick={() => setShowHealth(true)}>检查{healthIssues.length ? ` · ${healthIssues.length}` : ''}</button>
        <button className="backup-button" onClick={() => setShowBackup(true)}>备份</button>
        {!isStandalone && <button className="backup-button" onClick={() => void installApp()}>安装到桌面</button>}
        <button className="backup-button" onClick={() => { setShowAppStatus(true); void refreshStorageStatus() }}>应用状态</button>
        <button className="showcase-button" onClick={() => setShowShowcase(true)}><Icon name="plus"/>生成示例</button>
        <button className="reset-button" onClick={() => setShowReset(true)}><Icon name="trash"/>清空</button>
        </div>
      </div>
    </header>

    {shouldRemindBackup && <aside className="backup-reminder" role="status"><span><strong>给这份家谱留一份本地备份</strong><small>{backedUpAt ? `上次备份：${formatStoredDate(backedUpAt)}` : `已经记录 ${data.people.length} 位亲人，尚未导出恢复文件`}</small></span><button type="button" onClick={() => setShowBackup(true)}>现在备份</button><button className="reminder-dismiss" type="button" aria-label="暂时关闭备份提醒" onClick={() => setBackupReminderDismissed(true)}>×</button></aside>}
    {needRefresh && <aside className="update-reminder" role="status"><span><strong>亲族图谱已有新版本</strong><small>家谱数据会继续保存在本机</small></span><button type="button" onClick={() => void updateServiceWorker(true)}>重新加载</button><button className="reminder-dismiss" type="button" aria-label="稍后更新" onClick={() => setNeedRefresh(false)}>×</button></aside>}

    <main className={`workspace mobile-view-${mobileView}`}>
      <aside className="people-panel">
        <div className="panel-heading"><div><span className="eyebrow">人物索引</span><h2>家中亲人</h2></div><div className="panel-heading-tools"><button className="roster-button" type="button" onClick={() => setShowRoster(true)}><Icon name="edit"/>连续编辑</button><span className="count">{data.people.length}</span></div></div>
        <label className="search"><Icon name="search"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名或称呼"/></label>
        <div className="people-list">
          {filtered.map((person) => {
            const relation = calculateKinship(data, viewerId, person.id)
            return <button key={person.id} className={person.id === selectedId ? 'active' : ''} onClick={() => { setSelectedId(person.id); setMobileView('detail') }}>
              <Avatar person={person} size="small"/>
              <span><strong>{person.name}</strong><small>{birthdaySummary(person)} · {formatZodiac(person.birthYear)}</small></span>
              <em>{relation.mandarin[0]}</em>
            </button>
          })}
        </div>
        <div className="legend"><span><i className="blood-dot"/>血缘</span><span><i className="spouse-dot"/>婚姻</span></div>
      </aside>

      <section className="canvas-panel">
        <div className="canvas-heading"><span className="eyebrow">家族关系画布</span><button className="mobile-selection-link" type="button" onClick={() => setMobileView('detail')}><span>已选</span><strong>{selected.name}</strong><i>›</i></button></div>
        <Graph data={data} viewerId={viewerId} selectedId={selectedId} onSelect={setSelectedId} onMakeViewer={makeViewer} onAdd={openAdd} onEdit={openCanvasEdit} onDelete={setDeleteTargetId}/>
      </section>

      <aside className="detail-panel">
        <div className="detail-profile">
          <Avatar person={selected} size="large"/>
          <div className="profile-copy"><span className="eyebrow">当前查看</span><h2>{selected.name}</h2><p>{birthdaySummary(selected)} · {formatZodiac(selected.birthYear)}</p>{selected.birthDate && <p className="lunar-birthday">农历：{formatLunarBirthday(selected.birthDate)}</p>}</div>
          <button className="edit-profile-button" onClick={openEdit} aria-label={`编辑${selected.name}的资料`}><Icon name="edit"/>编辑</button>
        </div>
        {selected.id !== viewerId && <button className="mobile-viewpoint-button" type="button" onClick={() => { makeViewer(selected.id); setMobileView('graph') }}><Icon name="person"/><span><strong>以 {selected.name} 为主视角</strong><small>重新计算所有称呼并返回图谱</small></span></button>}
        <section className="term-block"><span className="eyebrow">现实中如何称呼</span><div className="main-term">{result.mandarin[0]}</div>{result.standardMandarin && <p>系统标准称呼：{result.standardMandarin.join('、')}</p>}{result.mandarin.length > 1 && <p>也可能称作：{result.mandarin.slice(1).join('、')}</p>}
          {selected.id !== viewerId && <form className="custom-term-form" onSubmit={saveCustomTerm} key={`${viewerId}-${selectedId}-${result.mandarin[0]}`}><label>我们家怎么叫<input name="customTerm" defaultValue={data.customTerms?.find((item) => item.viewerId === viewerId && item.targetId === selectedId)?.label ?? ''} placeholder={result.standardMandarin?.[0] ?? result.mandarin[0]}/></label><button type="submit">保存</button></form>}
        </section>
        <section className="dialect-block"><div><span className="eyebrow">闽南语 · {result.minnanKind === 'term' ? '官方称呼' : '关系路径读法'}</span><strong>{result.minnan}</strong><a href="https://sutian.moe.edu.tw/" target="_blank" rel="noreferrer">音频来源：教育部《臺灣台语常用词辭典》</a></div><button className={`speak-button ${speaking ? 'speaking' : ''}`} onClick={playMinnan} disabled={speaking || !hasOfficialRecording} aria-label={`用闽南语播报${result.minnan}`} title={result.minnanKind === 'term' ? '播放教育部官方真人发音' : '逐段播放官方词条发音'}><Icon name="speaker"/>{speaking ? '播报中' : hasOfficialRecording ? '播报' : '暂无音频'}</button></section>
        <section className="path-block"><div className="section-title"><span className="eyebrow">关系是怎么得出的</span><Icon name="route"/></div><p>{result.pathLabel}</p><div className="path-flow">
          {pathPeople.map((person, index) => <span key={person.id}><b>{person.name}</b>{index < pathPeople.length - 1 && <i>→</i>}</span>)}
        </div></section>
        <button className="manage-relations-button" onClick={() => setRelationEditId(selected.id)}><Icon name="route"/><span><strong>编辑基础关系</strong><small>选择一位亲人作为支点，再说明关系</small></span></button>
        {selected.note && <section className="person-note"><span className="eyebrow">人物备注</span><p>{selected.note}</p></section>}
        <div className="accuracy-note"><strong>准确性提示</strong><p>闽南语称呼因泉州、厦门、漳州及家庭习惯而异。当前为演示词库，正式版允许逐条确认。</p></div>
      </aside>
    </main>

    <nav className="mobile-nav" aria-label="移动端主要页面">
      <button className={mobileView === 'graph' ? 'active' : ''} type="button" aria-current={mobileView === 'graph' ? 'page' : undefined} onClick={() => setMobileView('graph')}><Icon name="route"/><span>图谱</span></button>
      <button className={mobileView === 'people' ? 'active' : ''} type="button" aria-current={mobileView === 'people' ? 'page' : undefined} onClick={() => setMobileView('people')}><Icon name="search"/><span>人物</span><em>{data.people.length}</em></button>
      <button className={mobileView === 'detail' ? 'active' : ''} type="button" aria-current={mobileView === 'detail' ? 'page' : undefined} onClick={() => setMobileView('detail')}><Icon name="person"/><span>称谓</span></button>
    </nav>

    {showAdd && <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}><form className="add-modal relation-modal" onSubmit={addPerson} onMouseDown={(e) => e.stopPropagation()}>
      <div><span className="eyebrow">添加人物</span><h2>创建一位亲人</h2><p>填写基本资料，再用一位已有亲人说明两人的基础关系。</p></div>
      <label>姓名<input name="name" autoFocus placeholder="例如：王小安" required/></label>
      <div className="form-row"><label>性别<select name="gender"><option value="male">男性</option><option value="female">女性</option></select></label><BirthdayField defaultValue="2000-01-01" required/></div>
      <RelationshipComposer data={data} subjectName="新人物" defaultAnchorId={selectedId}/>
      <div className="modal-actions"><button type="button" onClick={() => setShowAdd(false)}>取消</button><button className="primary-button" type="submit">加入图谱</button></div>
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
      <button className="inline-relation-button" type="button" onClick={() => setRelationEditId(selected.id)}><Icon name="route"/><span><strong>添加或调整关系</strong><small>选择一位支点人物，再说明两人的基础关系</small></span><i>›</i></button>
      <div className="modal-actions split-actions">
        <button className="danger-button" type="button" disabled={data.people.length <= 1} title={data.people.length <= 1 ? '图谱中至少需要保留一个人物' : undefined} onClick={() => { setShowEdit(false); setDeleteTargetId(selected.id) }}><Icon name="trash"/>删除人物</button>
        <span className="action-spacer"/>
        <button type="button" onClick={() => setShowEdit(false)}>取消</button><button className="primary-button" type="submit">保存修改</button>
      </div>
    </form></div>}
    {showRoster && <div className="modal-backdrop" onMouseDown={() => setShowRoster(false)}><form className="roster-modal" onSubmit={editRoster} onMouseDown={(event) => event.stopPropagation()}>
      <div className="roster-heading"><div><span className="eyebrow">人物名册</span><h2>连续编辑人物资料</h2><p>资料可统一保存；每一行使用同样的“支点人物 + 基础关系”编辑方式。</p></div><span>{data.people.length} 人</span></div>
      <div className="roster-table-wrap"><table className="roster-table">
        <thead><tr><th>人物</th><th>是谁的什么人</th><th>性别</th><th>公历生日</th><th>备注</th></tr></thead>
        <tbody>{data.people.map((person) => <tr key={person.id}>
          <td data-label="人物"><div className="roster-person"><Avatar person={person} size="small"/><div><input name={`name:${person.id}`} defaultValue={person.name} aria-label={`${person.name}的姓名`} required/></div></div></td>
          <td data-label="基础关系"><RosterRelationshipCell data={data} person={person} viewerId={viewerId}/></td>
          <td data-label="性别"><select name={`gender:${person.id}`} defaultValue={person.gender} aria-label={`${person.name}的性别`}><option value="male">男性</option><option value="female">女性</option></select></td>
          <td data-label="公历生日"><input name={`birthDate:${person.id}`} type="date" defaultValue={person.birthDate ?? ''} aria-label={`${person.name}的公历生日`}/></td>
          <td data-label="备注"><input name={`note:${person.id}`} defaultValue={person.note ?? ''} placeholder="小名、籍贯、家庭记忆" aria-label={`${person.name}的备注`}/></td>
        </tr>)}</tbody>
      </table></div>
      <div className="modal-actions"><button type="button" onClick={() => setShowRoster(false)}>取消</button><button className="primary-button" type="submit">统一保存</button></div>
    </form></div>}
    {relationEditId && <div className="modal-backdrop relation-editor-layer" onMouseDown={() => setRelationEditId(null)}><form className="direct-relation-modal" onSubmit={editDirectRelations} onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">基础关系</span><h2>编辑 {data.people.find((person) => person.id === relationEditId)?.name} 的关系</h2><p>选择一位支点人物，再说明当前人物是对方的什么人。</p></div>
      <RelationshipComposer data={data} subjectId={relationEditId} subjectName={data.people.find((person) => person.id === relationEditId)?.name ?? '当前人物'} defaultAnchorId={viewerId === relationEditId ? data.people.find((person) => person.id !== relationEditId)?.id : viewerId}/>
      <div className="existing-relations"><span className="eyebrow">已记录的基础连接</span>
        {data.parents.filter((item) => item.parentId === relationEditId || item.childId === relationEditId).map((item) => { const otherId = item.parentId === relationEditId ? item.childId : item.parentId; const other = data.people.find((person) => person.id === otherId)!; const label = item.parentId === relationEditId ? `是 ${other.name} 的父母` : `是 ${other.name} 的子女`; return <div key={`${item.parentId}-${item.childId}`}><span><strong>{other.name}</strong><small>{label}</small></span><button type="button" onClick={() => removeDirectRelation('parent', item.parentId, item.childId)}>移除</button></div> })}
        {data.spouses.filter((item) => item.personAId === relationEditId || item.personBId === relationEditId).map((item) => { const otherId = item.personAId === relationEditId ? item.personBId : item.personAId; const other = data.people.find((person) => person.id === otherId)!; return <div key={`${item.personAId}-${item.personBId}`}><span><strong>{other.name}</strong><small>配偶</small></span><button type="button" onClick={() => removeDirectRelation('spouse', item.personAId, item.personBId)}>移除</button></div> })}
      </div>
      <div className="modal-actions"><button type="button" onClick={() => setRelationEditId(null)}>取消</button><button className="primary-button" type="submit">添加关系</button></div>
    </form></div>}
    {showBackup && <div className="modal-backdrop" onMouseDown={() => setShowBackup(false)}><section className="backup-modal" role="dialog" aria-modal="true" aria-labelledby="backup-title" onMouseDown={(e) => e.stopPropagation()}>
      <div><span className="eyebrow">本地档案</span><h2 id="backup-title">备份与恢复家谱</h2><p>数据只保存在当前浏览器。定期导出一份精简备份，可以在清理浏览器或更换设备后恢复。</p></div>
      <div className="backup-options">
        <section><strong>导出 JSON 备份</strong><p>用于完整恢复家谱，不含头像和历史记录。</p><button type="button" onClick={() => void exportBackup()}>导出或分享</button></section>
        <section><strong>导出可读家谱</strong><p>下载或分享含 Mermaid 图和人物资料的 Markdown 文件。</p><button type="button" onClick={() => void exportMarkdown()}>导出或分享</button></section>
        <section><strong>从备份恢复</strong><p>导入会覆盖当前家谱，文件必须来自本应用且不超过 1MB。</p><label className="import-backup-button">选择备份文件<input type="file" accept="application/json,.json" onChange={(event) => { void importBackup(event.target.files?.[0]); event.currentTarget.value = '' }}/></label></section>
      </div>
      <dl className="backup-meta"><div><dt>最近修改</dt><dd>{formatStoredDate(modifiedAt)}</dd></div><div><dt>最近备份</dt><dd>{formatStoredDate(backedUpAt)}</dd></div><div><dt>档案规模</dt><dd>{data.people.length} 人 · {data.parents.length + data.spouses.length} 条关系</dd></div></dl>
      <div className="modal-actions"><button type="button" onClick={() => setShowBackup(false)}>关闭</button></div>
    </section></div>}
    {showAppStatus && <div className="modal-backdrop" onMouseDown={() => setShowAppStatus(false)}><section className="app-status-modal" role="dialog" aria-modal="true" aria-labelledby="app-status-title" onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">运行与存储</span><h2 id="app-status-title">应用状态</h2><p>家谱只保存在这台设备的当前应用空间中。</p></div>
      <dl className="app-status-list"><div><dt>网络</dt><dd className={online ? 'ok' : 'offline'}>{online ? '已联网' : '离线可用'}</dd></div><div><dt>打开方式</dt><dd>{isStandalone ? '桌面应用' : '浏览器网页'}</dd></div><div><dt>本地存储</dt><dd className={storagePersistent ? 'ok' : ''}>{storagePersistent === null ? '正在检查' : storagePersistent ? '已申请持久保留' : '由浏览器管理'}</dd></div><div><dt>存储占用</dt><dd>{storageUsage ? `${Math.max(.1, storageUsage.usage / 1024 / 1024).toFixed(1)} MB` : '暂不可读'}</dd></div><div><dt>应用版本</dt><dd>v{__APP_VERSION__}</dd></div><div><dt>最近修改</dt><dd>{formatStoredDate(modifiedAt)}</dd></div><div><dt>最近备份</dt><dd>{formatStoredDate(backedUpAt)}</dd></div></dl>
      <div className="status-actions">{!isStandalone && <button type="button" onClick={() => void installApp()}>安装到桌面</button>}<button type="button" onClick={() => { setShowAppStatus(false); setShowBackup(true) }}>备份家谱</button>{needRefresh && <button type="button" onClick={() => void updateServiceWorker(true)}>安装更新</button>}</div>
      <div className="modal-actions"><button type="button" onClick={() => setShowAppStatus(false)}>完成</button></div>
    </section></div>}
    {showInstallHelp && <div className="modal-backdrop" onMouseDown={() => setShowInstallHelp(false)}><section className="install-modal" role="dialog" aria-modal="true" aria-labelledby="install-title" onMouseDown={(event) => event.stopPropagation()}>
      <span className="brand-seal">亲</span><div><span className="eyebrow">安装到手机桌面</span><h2 id="install-title">像应用一样打开亲族图谱</h2><p>iPhone：在 Safari 中点“分享”，再选“添加到主屏幕”。Android：打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。</p></div><div className="install-note">安装后仍使用本机档案；请定期导出 JSON 备份。</div>
      <div className="modal-actions"><button type="button" onClick={() => setShowInstallHelp(false)}>知道了</button></div>
    </section></div>}
    {deleteTarget && <div className="modal-backdrop" onMouseDown={() => setDeleteTargetId(null)}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-person-title" onMouseDown={(e) => e.stopPropagation()}>
      <div className="danger-mark"><Icon name="trash"/></div>
      <div><span className="eyebrow">删除人物</span><h2 id="delete-person-title">确认删除 {deleteTarget.name}？</h2><p>人物资料及其父母、子女、配偶关系将一并删除，此操作无法撤销。</p></div>
      <div className="modal-actions"><button type="button" onClick={() => setDeleteTargetId(null)}>取消</button><button className="confirm-delete-button" type="button" onClick={deletePerson}>确认删除</button></div>
    </section></div>}
    {showReset && <div className="modal-backdrop" onMouseDown={() => setShowReset(false)}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-family-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="danger-mark"><Icon name="trash"/></div>
      <div><span className="eyebrow">清空本地数据</span><h2 id="reset-family-title">确认清空整个亲族图谱？</h2><p>当前浏览器中保存的所有人物、关系和自定义称呼都会被删除，只保留一个空白的“我”供你重新开始配置。此操作无法撤销，建议先导出备份。</p></div>
      <div className="modal-actions"><button type="button" onClick={() => setShowReset(false)}>取消</button><button className="confirm-delete-button" type="button" onClick={() => void resetFamily()}>确认清空</button></div>
    </section></div>}
    {showShowcase && <div className="modal-backdrop" onMouseDown={() => setShowShowcase(false)}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="showcase-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="showcase-mark"><Icon name="person"/></div>
      <div><span className="eyebrow">效果预览</span><h2 id="showcase-title">生成七代示例家谱？</h2><p>示例以“我”为中心，包含上三代、下三代，以及配偶、兄弟姐妹和旁系分支，共 {showcaseFamily.people.length} 位人物。它会替换当前画布并保存到本地，建议先备份现有家谱。</p></div>
      <div className="modal-actions"><button type="button" onClick={() => setShowShowcase(false)}>取消</button><button className="primary-button" type="button" onClick={loadShowcase}>生成示例</button></div>
    </section></div>}
    {showPair && <div className="modal-backdrop" onMouseDown={() => setShowPair(false)}><section className="pair-modal" role="dialog" aria-modal="true" aria-labelledby="pair-title" onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">双向称呼查询</span><h2 id="pair-title">两个人是什么关系</h2><p>同时查看双方各自应该如何称呼对方。</p></div>
      <div className="pair-selectors"><label>人物甲<select value={pairAId} onChange={(event) => setPairAId(event.target.value)}>{data.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><span>⇄</span><label>人物乙<select value={pairBId} onChange={(event) => setPairBId(event.target.value)}>{data.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>
      <div className="pair-results"><section><span>{data.people.find((person) => person.id === pairAId)?.name} 称呼 {data.people.find((person) => person.id === pairBId)?.name}</span><strong>{pairForward.mandarin[0]}</strong><p>{pairForward.pathLabel}</p></section><section><span>{data.people.find((person) => person.id === pairBId)?.name} 称呼 {data.people.find((person) => person.id === pairAId)?.name}</span><strong>{pairReverse.mandarin[0]}</strong><p>{pairReverse.pathLabel}</p></section></div>
      <div className="modal-actions"><button type="button" onClick={() => setShowPair(false)}>关闭</button></div>
    </section></div>}
    {showHealth && <div className="modal-backdrop" onMouseDown={() => setShowHealth(false)}><section className="health-modal" role="dialog" aria-modal="true" aria-labelledby="health-title" onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">数据健康检查</span><h2 id="health-title">家谱关系检查</h2><p>检查重复连接、关系循环和明显的出生年份风险。</p></div>
      <div className="health-list">{healthIssues.length === 0 ? <div className="health-ok"><strong>未发现明确问题</strong><span>当前 {data.people.length} 位人物、{data.parents.length + data.spouses.length} 条直接关系通过检查。</span></div> : healthIssues.map((issue, index) => <div className={issue.level} key={`${issue.title}-${index}`}><i>{issue.level === 'error' ? '!' : '?'}</i><span><strong>{issue.title}</strong><small>{issue.detail}</small></span></div>)}</div>
      <div className="modal-actions"><button type="button" onClick={() => setShowHealth(false)}>完成</button></div>
    </section></div>}
    {toast && <div className="toast"><span className="mini-seal">我</span>{toast}</div>}
  </div>
}

export default App
