import { type CSSProperties, type PointerEvent, type WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { calculateKinship } from '../kinship'
import { legalFilterOptions, matchesLegalFilter } from '../legalKinship'
import type { LegalFilterId } from '../legalKinship'
import type { FamilyData, Person } from '../types'
import { Avatar } from './PersonFields'
import { Icon } from './Icon'
import { AdaptiveOverlay } from './AdaptiveOverlay'
import { nodeActionForActivation } from './nodeInteraction'

const CARD_W = 148
const CARD_H = 94
const CONNECTION_OVERLAP = 12

export function FamilyGraph({ data, viewerId, selectedId, onSelect, onMakeViewer, onAdd, onEdit, onDelete }: {
  data: FamilyData; viewerId: string; selectedId: string; onSelect: (id: string) => void; onMakeViewer: (id: string) => void; onAdd: (anchorId?: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ distance: number; centerX: number; centerY: number; camera: { x: number; y: number; scale: number } } | null>(null)
  const longPressRef = useRef<{ timer: number; personId: string } | null>(null)
  const suppressClickRef = useRef<string | null>(null)
  const knownPeopleRef = useRef(new Set(data.people.map((person) => person.id)))
  const previousViewerRef = useRef(viewerId)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [showPanHint, setShowPanHint] = useState(() => sessionStorage.getItem('kinship-map:pan-hint-seen') !== 'true')
  const restoredCamera = useMemo(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('kinship-map:camera') ?? '')
      return Number.isFinite(stored.x) && Number.isFinite(stored.y) && Number.isFinite(stored.scale) ? stored : null
    } catch { return null }
  }, [])
  const hasInitialCameraRef = useRef(Boolean(restoredCamera))
  const [camera, setCamera] = useState<{ x: number; y: number; scale: number }>(restoredCamera ?? { x: 0, y: 0, scale: .72 })
  const [cameraSettling, setCameraSettling] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
  const [generationView, setGenerationView] = useState<number | null>(null)
  // Start with the complete family graph visible. Focus is an opt-in reading
  // aid; enabling it by default makes valid relationships look disconnected.
  const [relationshipFocus, setRelationshipFocus] = useState(false)
  const [legalFilter, setLegalFilter] = useState<LegalFilterId | null>(null)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState<'generation' | 'legal'>('generation')
  const actionTriggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null)
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

  const centerPerson = useCallback((person: Person) => {
    const viewport = viewportRef.current
    if (!viewport) return
    setCameraSettling(true)
    setCamera((current) => ({
      ...current,
      x: viewport.clientWidth / 2 - (person.x + CARD_W / 2) * current.scale,
      y: viewport.clientHeight / 2 - (person.y + CARD_H / 2) * current.scale,
    }))
    window.setTimeout(() => setCameraSettling(false), 320)
  }, [])

  useEffect(() => {
    if (hasInitialCameraRef.current) return
    fitView()
    hasInitialCameraRef.current = true
  }, [fitView, restoredCamera])

  useEffect(() => {
    sessionStorage.setItem('kinship-map:camera', JSON.stringify(camera))
  }, [camera])

  useEffect(() => {
    const known = knownPeopleRef.current
    const added = data.people.find((person) => !known.has(person.id))
    knownPeopleRef.current = new Set(data.people.map((person) => person.id))
    if (added && added.id === selectedId) {
      centerPerson(added)
      setHighlightedId(added.id)
      window.setTimeout(() => setHighlightedId(null), 900)
    }
  }, [centerPerson, data.people, selectedId])

  useEffect(() => {
    if (!showPanHint) return
    const timer = window.setTimeout(() => {
      setShowPanHint(false)
      sessionStorage.setItem('kinship-map:pan-hint-seen', 'true')
    }, 5200)
    return () => window.clearTimeout(timer)
  }, [showPanHint])

  const dismissPanHint = () => {
    if (!showPanHint) return
    setShowPanHint(false)
    sessionStorage.setItem('kinship-map:pan-hint-seen', 'true')
  }

  useEffect(() => {
    if (previousViewerRef.current === viewerId) return
    previousViewerRef.current = viewerId
    const viewer = people.get(viewerId)
    if (viewer) centerPerson(viewer)
  }, [centerPerson, people, viewerId])

  const zoomAtCenter = (factor: number) => {
    setOpenActionsId(null)
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
    dismissPanHint()
    setCameraSettling(false)
    setOpenActionsId(null)
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
    dismissPanHint()
    setCameraSettling(false)
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
    setFilterMenuOpen(false)
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
  const openActionPerson = openActionsId ? people.get(openActionsId) ?? null : null
  const closeActions = useCallback(() => setOpenActionsId(null), [])
  const actionItems = openActionPerson && <div className="person-action-list">
    <button type="button" role="menuitem" onClick={() => { closeActions(); onAdd(openActionPerson.id) }}><Icon name="plus"/><span>新增亲属</span></button>
    <button type="button" role="menuitem" onClick={() => { closeActions(); onEdit(openActionPerson.id) }}><Icon name="edit"/><span>编辑人物</span></button>
    <button type="button" role="menuitemcheckbox" aria-checked={openActionPerson.id === viewerId} onClick={() => { closeActions(); if (openActionPerson.id !== viewerId) onMakeViewer(openActionPerson.id) }}><Icon name={openActionPerson.id === viewerId ? 'check' : 'person'}/><span>{openActionPerson.id === viewerId ? '当前主视角' : '设为主视角'}</span></button>
    <div className="menu-separator" role="separator"/>
    <button className="destructive-menu-item" type="button" role="menuitem" disabled={data.people.length <= 1} onClick={() => { closeActions(); onDelete(openActionPerson.id) }}><Icon name="trash"/><span>删除人物</span></button>
  </div>
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
    <div className={`graph-stage ${cameraSettling ? 'camera-settling' : ''}`} style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`, '--canvas-scale': camera.scale } as CSSProperties}>
      <svg className="connections" viewBox="0 0 1400 830" aria-hidden="true">{parentLines}{spouseLines}</svg>
      {data.people.map((person) => {
        const result = calculateKinship(data, viewerId, person.id)
        const isViewer = person.id === viewerId
        const isSelected = person.id === selectedId
        const filteredOut = legalFilter !== null && !matchedIds.has(person.id) && !isViewer
        const outsideRelationshipFocus = relationshipFocus && !focusIds.has(person.id)
        return <div
          key={person.id}
          className={`person-node-wrap ${openActionsId === person.id ? 'actions-open' : ''} ${isSelected ? 'selected' : ''} ${highlightedId === person.id ? 'just-added' : ''}`}
          style={{ left: person.x, top: person.y }}
        >
          <button type="button" className={`person-node ${isViewer ? 'viewer' : ''} ${isSelected ? 'selected' : ''} ${outsideRelationshipFocus ? 'relationship-muted' : ''} ${relationshipFocus && focusIds.has(person.id) ? 'relationship-focused' : ''} ${generationView !== null && !matchesGenerationView(person.generation) ? 'generation-faded' : ''} ${generationView !== null && matchesGenerationView(person.generation) ? 'generation-highlighted' : ''} ${filteredOut ? 'legal-filtered-out' : ''} ${legalFilter && matchedIds.has(person.id) ? 'legal-filter-match' : ''}`}
            onClick={() => { if (suppressClickRef.current === person.id) { suppressClickRef.current = null; return }; if (nodeActionForActivation('single-click') === 'select') onSelect(person.id); setOpenActionsId(null) }} onDoubleClick={() => { setOpenActionsId(null); if (nodeActionForActivation('double-click') === 'edit') onEdit(person.id) }} onPointerDown={(event) => { if (event.pointerType !== 'touch') return; const timer = window.setTimeout(() => { suppressClickRef.current = person.id; onSelect(person.id); setOpenActionsId(person.id) }, 460); longPressRef.current = { timer, personId: person.id } }} onPointerUp={() => { if (longPressRef.current?.personId === person.id) window.clearTimeout(longPressRef.current.timer); longPressRef.current = null }} onPointerCancel={() => { if (longPressRef.current?.personId === person.id) window.clearTimeout(longPressRef.current.timer); longPressRef.current = null }} onPointerLeave={() => { if (longPressRef.current?.personId === person.id) window.clearTimeout(longPressRef.current.timer); longPressRef.current = null }} aria-label={`${person.name}，${result.mandarin[0]}`}>
            {isViewer && <span className="viewer-pin">我</span>}
            <Avatar person={person}/>
            <span className="node-copy"><strong>{person.name}</strong><small>{result.mandarin[0]}</small></span>
          </button>
          {isSelected && <button ref={(element) => { if (element) actionTriggerRefs.current.set(person.id, element); else actionTriggerRefs.current.delete(person.id) }} className="node-more-button" type="button" onClick={(event) => { event.stopPropagation(); setOpenActionsId((current) => current === person.id ? null : person.id) }} aria-label={`打开${person.name}的操作菜单`} aria-haspopup="menu" aria-expanded={openActionsId === person.id} title="更多操作"><Icon name="ellipsis"/></button>}
        </div>
      })}
    </div>
    <AdaptiveOverlay open={Boolean(openActionPerson)} anchor={openActionPerson ? actionTriggerRefs.current.get(openActionPerson.id) ?? null : null} onClose={closeActions} label={openActionPerson ? `${openActionPerson.name}的操作` : '人物操作'} menuClassName="person-action-menu" sheetClassName="person-action-sheet" reserved={{ top: 56, right: 12, bottom: 64, left: 8 }} sheetHeader={openActionPerson && <header className="sheet-person-header"><Avatar person={openActionPerson}/><span><small>当前选择</small><strong>{openActionPerson.name}</strong><em>{calculateKinship(data, viewerId, openActionPerson.id).mandarin[0]}</em></span></header>}>{actionItems}</AdaptiveOverlay>
    <div className="quick-filter">
      <div className="quick-filter-triggers" aria-label="画布快速筛选">
        <button className={`quick-filter-trigger focus-filter-trigger ${relationshipFocus ? 'active' : ''}`} type="button" aria-pressed={relationshipFocus} onClick={() => { const next = !relationshipFocus; setRelationshipFocus(next); if (next) { setGenerationView(null); setLegalFilter(null); setFilterMenuOpen(false); fitView() } }} title={relationshipFocus ? `已突出与当前人物直接相连的 ${Math.max(0, focusIds.size - 1)} 人，点击关闭` : '突出与当前人物直接相连的人物'}>
          <span>聚焦</span>
        </button>
        <button className={`quick-filter-trigger ${generationView !== null ? 'active' : ''}`} type="button" aria-haspopup="menu" aria-expanded={filterMenuOpen && filterCategory === 'generation'} onClick={(event) => { setFilterAnchor(event.currentTarget); setFilterCategory('generation'); setFilterMenuOpen((current) => filterCategory !== 'generation' || !current) }}>
          <span>辈分</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
        </button>
        <button className={`quick-filter-trigger ${legalFilter ? 'active' : ''}`} type="button" aria-haspopup="menu" aria-expanded={filterMenuOpen && filterCategory === 'legal'} onClick={(event) => { setFilterAnchor(event.currentTarget); setFilterCategory('legal'); setFilterMenuOpen((current) => filterCategory !== 'legal' || !current) }}>
          <span>法律</span>{legalFilter && <em>{matchedIds.size}</em>}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
        </button>
      </div>
      <AdaptiveOverlay open={filterMenuOpen} anchor={filterAnchor} onClose={() => setFilterMenuOpen(false)} label={`${filterCategory === 'generation' ? '辈分' : '法律'}筛选`} menuClassName="quick-filter-menu" sheetClassName="filter-action-sheet" reserved={{ top: 56, right: 8, bottom: 64, left: 8 }} sheetHeader={<div className="sheet-section-heading"><Icon name="filter"/><span><strong>筛选画布人物</strong><small>选择一种查看范围</small></span></div>}>
        {filterCategory === 'generation' ? <div className="view-options">
          <div className="filter-menu-heading"><span>按辈分筛选</span><small>定位并突出画布中的人物</small></div>
          {generationOptions.map((label, generation) => <button key={label} type="button" role="menuitemradio" className={generationView === generation ? 'active' : ''} aria-checked={generationView === generation} onClick={() => { showGeneration(generation); setFilterMenuOpen(false) }}><span><b>{label}</b><small>定位画布中的{label}人物</small></span><i>{generationView === generation ? '✓' : ''}</i></button>)}
        </div> : <div className="view-options">
          <div className="filter-menu-heading"><span>按法律关系筛选</span><small>以 {data.people.find((person) => person.id === viewerId)?.name} 为中心判定</small></div>
          {legalFilterOptions.map((option) => <button key={option.id} type="button" role="menuitemradio" aria-checked={legalFilter === option.id} className={legalFilter === option.id ? 'active' : ''} onClick={() => { setLegalFilter(option.id); setGenerationView(null); setRelationshipFocus(false); setFilterMenuOpen(false) }}><span><b>{option.label}</b><small>{option.description}</small></span><i>{legalFilter === option.id ? '✓' : ''}</i></button>)}
          <div className="filter-data-note">“家庭成员”需要共同生活资料，暂不自动判定</div>
        </div>}
        {(legalFilter || generationView !== null) && <button className="clear-quick-filter" type="button" onClick={() => { setLegalFilter(null); setGenerationView(null); fitView(); setFilterMenuOpen(false) }}>显示全部人物</button>}
      </AdaptiveOverlay>
    </div>
    <div className="canvas-controls" aria-label="画布控制">
      <button onClick={() => zoomAtCenter(1.2)} aria-label="放大画布">＋</button>
      <span>{Math.round(camera.scale * 100)}%</span>
      <button onClick={() => zoomAtCenter(1 / 1.2)} aria-label="缩小画布">－</button>
      <i />
      <button className="fit-button" onClick={fitView} aria-label="适应全部人物">适应</button>
    </div>
    {showPanHint && <div className="pan-hint" role="status">按住空白处拖动 · 滚轮或双指缩放</div>}
  </div>
}
