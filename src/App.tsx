import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState, WheelEvent } from 'react'
import { initialFamily } from './data'
import { calculateKinship } from './kinship'
import { speakMinnan } from './minnanSpeech'
import type { FamilyData, Gender, Person } from './types'

const HOME_ID = 'me'
const CARD_W = 148
const CARD_H = 94

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

function Avatar({ person, size }: { person: Person; size?: 'small' | 'large' }) {
  return <span className={`portrait ${size ?? ''} ${person.gender} ${person.avatar ? 'has-image' : ''}`}>
    {person.avatar ? <img src={person.avatar} alt=""/> : initials(person.name)}
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
  const [avatarDraft, setAvatarDraft] = useState<string | undefined>()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [speaking, setSpeaking] = useState(false)

  const viewer = data.people.find((p) => p.id === viewerId)!
  const selected = data.people.find((p) => p.id === selectedId)!
  const result = calculateKinship(data, viewerId, selectedId)
  const filtered = data.people.filter((p) => p.name.includes(query) || calculateKinship(data, viewerId, p.id).mandarin.some((term) => term.includes(query)))
  const pathPeople = result.pathIds.map((id) => data.people.find((p) => p.id === id)!).filter(Boolean)

  const makeViewer = (id: string) => {
    setViewerId(id); setSelectedId(id)
    const name = data.people.find((p) => p.id === id)?.name
    setToast(`现在从 ${name} 的视角看整个家族`)
    window.setTimeout(() => setToast(''), 2200)
  }


  const playMinnan = () => {
    if (result.minnan === '待补充' || result.minnan === '待家中长辈确认') {
      setToast('这个称呼还没有确认闽南语读音')
      window.setTimeout(() => setToast(''), 2200)
      return
    }
    setSpeaking(true)
    const status = speakMinnan(result.minnan, () => setSpeaking(false))
    if (status === 'unsupported') {
      setSpeaking(false)
      setToast('当前设备未安装台湾闽南语（nan-TW）语音')
      window.setTimeout(() => setToast(''), 2800)
    }
  }

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const addPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const relation = String(form.get('relation'))
    const gender = String(form.get('gender')) as Gender
    if (!name) return
    const id = `custom-${Date.now()}`
    const base: Person = { id, name, gender, birthYear: Number(form.get('birthYear')) || 2000, branch: '本家', generation: 3, x: 1020, y: 710 }
    setData((current) => {
      const next = { ...current, people: [...current.people, base], parents: [...current.parents], spouses: [...current.spouses] }
      if (relation === 'child') next.parents.push({ parentId: viewerId, childId: id })
      if (relation === 'parent') next.parents.push({ parentId: id, childId: viewerId })
      if (relation === 'spouse') next.spouses.push({ personAId: viewerId, personBId: id })
      return next
    })
    setSelectedId(id); setShowAdd(false)
  }

  const editPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    if (!name) return
    const updated: Partial<Person> = {
      name,
      gender: String(form.get('gender')) as Gender,
      birthYear: Number(form.get('birthYear')) || selected.birthYear,
      branch: String(form.get('branch')) as Person['branch'],
      note: String(form.get('note') || '').trim(),
      avatar: avatarDraft,
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

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-seal">亲</span><div><strong>亲族图谱</strong><small>称呼从关系里自然生长</small></div></div>
      <div className="viewpoint-chip"><span>当前主视角</span><strong>{viewer.name}</strong><em>{viewerId === HOME_ID ? '本人' : '代入视角'}</em></div>
      <div className="header-actions">
        {viewerId !== HOME_ID && data.people.some((person) => person.id === HOME_ID) && <button className="text-button" onClick={() => makeViewer(HOME_ID)}><Icon name="home"/>回到我</button>}
        <button className="primary-button" onClick={() => setShowAdd(true)}><Icon name="plus"/>添加亲人</button>
      </div>
    </header>

    <main className="workspace">
      <aside className="people-panel">
        <div className="panel-heading"><div><span className="eyebrow">人物索引</span><h2>家中亲人</h2></div><span className="count">{data.people.length}</span></div>
        <label className="search"><Icon name="search"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名或称呼"/></label>
        <div className="people-list">
          {filtered.map((person) => {
            const relation = calculateKinship(data, viewerId, person.id)
            return <button key={person.id} className={person.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(person.id)}>
              <Avatar person={person} size="small"/>
              <span><strong>{person.name}</strong><small>{person.birthYear} · {person.branch}</small></span>
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
          <div className="profile-copy"><span className="eyebrow">当前查看</span><h2>{selected.name}</h2><p>{selected.birthYear}年 · {selected.branch}</p></div>
          <button className="edit-profile-button" onClick={openEdit} aria-label={`编辑${selected.name}的资料`}><Icon name="edit"/>编辑</button>
        </div>
        {selected.id !== viewerId && <button className="perspective-button" onClick={() => makeViewer(selected.id)}><span>以此人为我</span><small>全图称呼将同步刷新</small></button>}
        <section className="term-block"><span className="eyebrow">现实中如何称呼</span><div className="main-term">{result.mandarin[0]}</div>{result.mandarin.length > 1 && <p>也可能称作：{result.mandarin.slice(1).join('、')}</p>}</section>
        <section className="dialect-block"><div><span className="eyebrow">闽南语 · 示范词库</span><strong>{result.minnan}</strong></div><button className={`speak-button ${speaking ? 'speaking' : ''}`} onClick={playMinnan} disabled={speaking} aria-label={`用闽南语播报${result.minnan}`}><Icon name="speaker"/>{speaking ? '播报中' : '播报'}</button></section>
        <section className="path-block"><div className="section-title"><span className="eyebrow">关系是怎么得出的</span><Icon name="route"/></div><p>{result.pathLabel}</p><div className="path-flow">
          {pathPeople.map((person, index) => <span key={person.id}><b>{person.name}</b>{index < pathPeople.length - 1 && <i>→</i>}</span>)}
        </div></section>
        <section className="facts"><div><span>关系编码</span><strong>{result.codes.join(' · ') || 'self'}</strong></div><div><span>出生年份</span><strong>{selected.birthYear}</strong></div></section>
        {selected.note && <section className="person-note"><span className="eyebrow">人物备注</span><p>{selected.note}</p></section>}
        <div className="accuracy-note"><strong>准确性提示</strong><p>闽南语称呼因泉州、厦门、漳州及家庭习惯而异。当前为演示词库，正式版允许逐条确认。</p></div>
      </aside>
    </main>

    {showAdd && <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}><form className="add-modal" onSubmit={addPerson} onMouseDown={(e) => e.stopPropagation()}>
      <div><span className="eyebrow">快速录入</span><h2>添加与 {viewer.name} 有关的亲人</h2><p>最小模型支持父母、配偶和子女，复杂关系会在下一阶段加入。</p></div>
      <label>姓名<input name="name" autoFocus placeholder="例如：王小安" required/></label>
      <div className="form-row"><label>性别<select name="gender"><option value="male">男性</option><option value="female">女性</option></select></label><label>出生年份<input name="birthYear" type="number" defaultValue="2000"/></label></div>
      <label>相对于当前主视角<select name="relation"><option value="child">子女</option><option value="parent">父母</option><option value="spouse">配偶</option></select></label>
      <div className="modal-actions"><button type="button" onClick={() => setShowAdd(false)}>取消</button><button className="primary-button" type="submit">加入图谱</button></div>
    </form></div>}
    {showEdit && <div className="modal-backdrop" onMouseDown={() => setShowEdit(false)}><form className="add-modal edit-modal" onSubmit={editPerson} onMouseDown={(e) => e.stopPropagation()}>
      <div><span className="eyebrow">人物档案</span><h2>编辑 {selected.name}</h2><p>修改后会同步更新人物列表、家族画布和亲属称呼。</p></div>
      <div className="avatar-editor">
        <Avatar person={{ ...selected, avatar: avatarDraft }} size="large"/>
        <div className="avatar-editor-copy"><strong>人物头像</strong><small>支持 JPG、PNG、WebP，文件不超过 5MB</small>
          <div className="avatar-editor-actions"><label className="upload-avatar-button">{avatarDraft ? '更换图片' : '上传图片'}<input type="file" accept="image/*" onChange={(event) => { uploadAvatar(event.target.files?.[0]); event.currentTarget.value = '' }}/></label>{avatarDraft && <button type="button" onClick={() => setAvatarDraft(undefined)}>移除头像</button>}</div>
        </div>
      </div>
      <label>姓名<input name="name" autoFocus defaultValue={selected.name} placeholder="请输入真实姓名" required/></label>
      <div className="form-row">
        <label>性别<select name="gender" defaultValue={selected.gender}><option value="male">男性</option><option value="female">女性</option></select></label>
        <label>出生年份<input name="birthYear" type="number" min="1800" max="2100" defaultValue={selected.birthYear}/></label>
      </div>
      <label>所属支系<select name="branch" defaultValue={selected.branch}><option value="父系">父系</option><option value="母系">母系</option><option value="本家">本家</option></select></label>
      <label>人物备注<textarea name="note" rows={3} defaultValue={selected.note ?? ''} placeholder="籍贯、小名、家庭记忆等"/></label>
      <div className="form-scope-note"><Icon name="person"/><span>此处编辑人物资料；父母、配偶、子女等关系将在“编辑关系”中单独维护。</span></div>
      <div className="modal-actions split-actions">
        <button className="danger-button" type="button" disabled={data.people.length <= 1} title={data.people.length <= 1 ? '图谱中至少需要保留一个人物' : undefined} onClick={() => { setShowEdit(false); setDeleteTargetId(selected.id) }}><Icon name="trash"/>删除人物</button>
        <span className="action-spacer"/>
        <button type="button" onClick={() => setShowEdit(false)}>取消</button><button className="primary-button" type="submit">保存修改</button>
      </div>
    </form></div>}
    {deleteTarget && <div className="modal-backdrop" onMouseDown={() => setDeleteTargetId(null)}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-person-title" onMouseDown={(e) => e.stopPropagation()}>
      <div className="danger-mark"><Icon name="trash"/></div>
      <div><span className="eyebrow">删除人物</span><h2 id="delete-person-title">确认删除 {deleteTarget.name}？</h2><p>人物资料及其父母、子女、配偶关系将一并删除，此操作无法撤销。</p></div>
      <div className="modal-actions"><button type="button" onClick={() => setDeleteTargetId(null)}>取消</button><button className="confirm-delete-button" type="button" onClick={deletePerson}>确认删除</button></div>
    </section></div>}
    {toast && <div className="toast"><span className="mini-seal">我</span>{toast}</div>}
  </div>
}

export default App
