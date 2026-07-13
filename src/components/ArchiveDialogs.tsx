import { useState, type FormEvent } from 'react'
import { buildFamilyCalendar } from '../familyCalendar'
import type { DuplicateCandidate } from '../familyMerge'
import type { FamilyArchiveSummary, FamilyData, FamilySnapshot, LifeEvent } from '../types'
import { Icon } from './Icon'

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

const eventTypeLabel: Record<LifeEvent['type'], string> = {
  birth: '出生', education: '求学', career: '职业', residence: '迁居', marriage: '婚姻', milestone: '里程碑', death: '逝世', other: '其他',
}

export function ArchiveDialogs({ data, currentArchiveId, archives, snapshots, showArchives, showHistory, showCalendar, showDuplicates, showPrint, printLayout, printIncludeNotes, timelinePersonId, onCloseArchives, onCloseHistory, onCloseCalendar, onCloseDuplicates, onClosePrint, onCloseTimeline, onCreateArchive, onSwitchArchive, onRenameArchive, onDeleteArchive, onRestoreSnapshot, onSelectCalendarPerson, duplicateCandidates, onMergeDuplicate, onAddLifeEvent, onDeleteLifeEvent, onPrintLayoutChange, onPrintIncludeNotesChange, onPrint, onExportSvg }: {
  data: FamilyData
  currentArchiveId: string
  archives: FamilyArchiveSummary[]
  snapshots: FamilySnapshot[]
  showArchives: boolean
  showHistory: boolean
  showCalendar: boolean
  showDuplicates: boolean
  showPrint: boolean
  printLayout: 'compact' | 'detailed'
  printIncludeNotes: boolean
  timelinePersonId: string | null
  onCloseArchives: () => void
  onCloseHistory: () => void
  onCloseCalendar: () => void
  onCloseDuplicates: () => void
  onClosePrint: () => void
  onCloseTimeline: () => void
  onCreateArchive: (name: string) => void
  onSwitchArchive: (id: string) => void
  onRenameArchive: (id: string, name: string) => void
  onDeleteArchive: (id: string) => void
  onRestoreSnapshot: (snapshot: FamilySnapshot) => void
  onSelectCalendarPerson: (id: string) => void
  duplicateCandidates: DuplicateCandidate[]
  onMergeDuplicate: (keepId: string, removeId: string) => void
  onAddLifeEvent: (personId: string, event: Omit<LifeEvent, 'id'>) => void
  onDeleteLifeEvent: (personId: string, eventId: string) => void
  onPrintLayoutChange: (value: 'compact' | 'detailed') => void
  onPrintIncludeNotesChange: (value: boolean) => void
  onPrint: () => void
  onExportSvg: () => void
}) {
  const [archiveDeleteId, setArchiveDeleteId] = useState<string | null>(null)
  const [archiveRenameId, setArchiveRenameId] = useState<string | null>(null)
  const [archiveRenameDraft, setArchiveRenameDraft] = useState('')
  const calendar = buildFamilyCalendar(data)
  const timelinePerson = timelinePersonId ? data.people.find((person) => person.id === timelinePersonId) : undefined
  const submitArchive = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('archiveName') || '').trim()
    if (name) { onCreateArchive(name); event.currentTarget.reset() }
  }
  const submitLifeEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!timelinePerson) return
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') || '').trim()
    const date = String(form.get('date') || '')
    if (!title) return
    onAddLifeEvent(timelinePerson.id, {
      type: String(form.get('type')) as LifeEvent['type'], title,
      ...(date ? { date } : {}),
      ...(String(form.get('place') || '').trim() ? { place: String(form.get('place')).trim() } : {}),
      ...(String(form.get('note') || '').trim() ? { note: String(form.get('note')).trim() } : {}),
    })
    event.currentTarget.reset()
  }

  return <>
    {showArchives && <div className="modal-backdrop" onMouseDown={onCloseArchives}><section className="archive-manager-modal" role="dialog" aria-modal="true" aria-labelledby="archives-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><span className="eyebrow">家谱书架</span><h2 id="archives-title">管理本机家谱</h2><p>每份家谱独立保存在当前浏览器，可用于不同家庭、支系或整理草稿。</p></header>
      <div className="archive-list">{archives.map((archive) => <article className={archive.id === currentArchiveId ? 'active' : ''} key={archive.id}><span className="archive-seal">谱</span><div><strong>{archive.name}</strong><small>{archive.peopleCount} 人 · 最近整理 {formatTime(archive.updatedAt)}</small></div>{archive.id === currentArchiveId ? <em>正在使用</em> : <button type="button" onClick={() => onSwitchArchive(archive.id)}>打开</button>}<details><summary>管理</summary><div><button type="button" onClick={() => { setArchiveRenameId(archive.id); setArchiveRenameDraft(archive.name) }}>重命名</button><button type="button" disabled={archives.length <= 1} onClick={() => setArchiveDeleteId(archive.id)}>删除</button></div></details></article>)}</div>
      <form className="new-archive-form" onSubmit={submitArchive}><label>新建家谱<input name="archiveName" placeholder="例如：王氏家谱整理稿" required/></label><button className="primary-button" type="submit"><Icon name="plus"/>新建空白家谱</button></form>
      <div className="modal-actions"><button type="button" onClick={onCloseArchives}>完成</button></div>
    </section></div>}

    {archiveDeleteId && <div className="modal-backdrop archive-delete-layer" onMouseDown={() => setArchiveDeleteId(null)}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="archive-delete-title" onMouseDown={(event) => event.stopPropagation()}><div className="danger-mark"><Icon name="trash"/></div><div><span className="eyebrow">删除家谱</span><h2 id="archive-delete-title">确认删除“{archives.find((archive) => archive.id === archiveDeleteId)?.name}”？</h2><p>这份家谱及其本机历史版本会一并删除，此操作无法撤销。</p></div><div className="modal-actions"><button type="button" onClick={() => setArchiveDeleteId(null)}>取消</button><button className="confirm-delete-button" type="button" onClick={() => { onDeleteArchive(archiveDeleteId); setArchiveDeleteId(null) }}>确认删除</button></div></section></div>}

    {archiveRenameId && <div className="modal-backdrop archive-delete-layer" onMouseDown={() => setArchiveRenameId(null)}><form className="archive-rename-modal" onSubmit={(event) => { event.preventDefault(); if (archiveRenameDraft.trim()) onRenameArchive(archiveRenameId, archiveRenameDraft.trim()); setArchiveRenameId(null) }} onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">家谱题名</span><h2>重命名家谱</h2><label>家谱名称<input autoFocus value={archiveRenameDraft} onChange={(event) => setArchiveRenameDraft(event.target.value)} required/></label><div className="modal-actions"><button type="button" onClick={() => setArchiveRenameId(null)}>取消</button><button className="primary-button" type="submit">保存名称</button></div></form></div>}

    {showHistory && <div className="modal-backdrop" onMouseDown={onCloseHistory}><section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><span className="eyebrow">版本卷宗</span><h2 id="history-title">家谱历史版本</h2><p>修改前会自动留下本机快照，最多保留最近 40 个版本。</p></header>
      <div className="history-list">{snapshots.length ? snapshots.map((snapshot) => <article key={snapshot.id}><i/><span><strong>{snapshot.label}</strong><small>{formatTime(snapshot.createdAt)} · {snapshot.data.people.length} 人</small></span><button type="button" onClick={() => onRestoreSnapshot(snapshot)}>恢复此版本</button></article>) : <div className="empty-archive-state"><strong>还没有历史版本</strong><span>下一次修改家谱前会自动建立快照。</span></div>}</div>
      <div className="modal-actions"><button type="button" onClick={onCloseHistory}>关闭</button></div>
    </section></div>}

    {showCalendar && <div className="modal-backdrop" onMouseDown={onCloseCalendar}><section className="family-calendar-modal" role="dialog" aria-modal="true" aria-labelledby="family-calendar-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><span className="eyebrow">家事历</span><h2 id="family-calendar-title">接下来的家庭纪念日</h2><p>从人物生日、纪念日和带日期的生平事件中自动整理。</p></header>
      <div className="calendar-ledger">{calendar.length ? calendar.map((entry) => <button type="button" key={entry.id} onClick={() => onSelectCalendarPerson(entry.personId)}><time><b>{entry.nextDate.getMonth() + 1}</b><span>月</span><b>{entry.nextDate.getDate()}</b><span>日</span></time><span><strong>{entry.title}</strong><small>{entry.age ? `${entry.age} 岁${entry.age % 10 === 0 ? ' · 整岁' : ''} · ` : ''}{entry.place ?? entry.personName}{entry.lunar ? ` · 农历 ${entry.lunar}` : ''}</small></span><em>{entry.nextDate.getFullYear() === new Date().getFullYear() ? '今年' : '明年'}</em></button>) : <div className="empty-archive-state"><strong>暂无可排列的日期</strong><span>在人物档案中补充完整生日，或添加带日期的生平事件。</span></div>}</div>
      <div className="modal-actions"><button type="button" onClick={onCloseCalendar}>关闭</button></div>
    </section></div>}

    {showDuplicates && <div className="modal-backdrop" onMouseDown={onCloseDuplicates}><section className="duplicate-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><span className="eyebrow">人物校勘</span><h2 id="duplicate-title">合并疑似重复人物</h2><p>系统只提出候选，合并前由你决定保留哪一份人物档案。</p></header>
      <div className="duplicate-list">{duplicateCandidates.length ? duplicateCandidates.map(({ first, second, reasons }) => <article key={`${first.id}:${second.id}`}><div><strong>{first.name}</strong><small>{first.birthDate ?? first.birthYear}</small></div><span>可能与</span><div><strong>{second.name}</strong><small>{second.birthDate ?? second.birthYear}</small></div><p>{reasons.join('、')}</p><div className="duplicate-actions"><button type="button" onClick={() => onMergeDuplicate(first.id, second.id)}>保留 {first.name}</button><button type="button" onClick={() => onMergeDuplicate(second.id, first.id)}>保留 {second.name}</button></div></article>) : <div className="empty-archive-state"><strong>没有发现明确的重复人物</strong><span>同名且出生信息相近的人物会出现在这里。</span></div>}</div>
      <div className="modal-actions"><button type="button" onClick={onCloseDuplicates}>完成</button></div>
    </section></div>}

    {showPrint && <div className="modal-backdrop" onMouseDown={onClosePrint}><section className="print-settings-modal" role="dialog" aria-modal="true" aria-labelledby="print-settings-title" onMouseDown={(event) => event.stopPropagation()}><header><span className="eyebrow">刊印家谱</span><h2 id="print-settings-title">打印或导出族谱</h2><p>浏览器打印可保存为 PDF；SVG 适合继续排版或制作长卷。</p></header><fieldset><legend>版式密度</legend><label><input type="radio" name="printLayout" checked={printLayout === 'compact'} onChange={() => onPrintLayoutChange('compact')}/><span><strong>紧凑图谱</strong><small>适合 A4 横向或人物较少的家谱</small></span></label><label><input type="radio" name="printLayout" checked={printLayout === 'detailed'} onChange={() => onPrintLayoutChange('detailed')}/><span><strong>详细图谱</strong><small>适合 A3 横向和大型家谱</small></span></label></fieldset><label className="print-note-option"><input type="checkbox" checked={printIncludeNotes} onChange={(event) => onPrintIncludeNotesChange(event.target.checked)}/><span><strong>在人物名录中包含备注</strong><small>关闭后可隐藏家庭记忆等私密文字</small></span></label><div className="print-export-actions"><button className="primary-button" type="button" onClick={onPrint}><Icon name="print"/>打开打印 / PDF</button><button type="button" onClick={onExportSvg}>导出 SVG 图谱</button></div><div className="modal-actions"><button type="button" onClick={onClosePrint}>取消</button></div></section></div>}

    {timelinePerson && <div className="modal-backdrop" onMouseDown={onCloseTimeline}><section className="timeline-modal" role="dialog" aria-modal="true" aria-labelledby="timeline-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><span className="eyebrow">人物生平</span><h2 id="timeline-title">{timelinePerson.name} 的时间线</h2><p>记录迁居、求学、职业、婚姻与家庭记忆，不涉及照片或大文件。</p></header>
      <div className="life-event-list">{[...(timelinePerson.events ?? [])].sort((a, b) => (a.date ?? String(a.year ?? '')).localeCompare(b.date ?? String(b.year ?? ''))).map((event) => <article key={event.id}><time>{event.date ?? event.year ?? '日期待考'}</time><i/><span><small>{eventTypeLabel[event.type]}</small><strong>{event.title}</strong>{event.place && <em>{event.place}</em>}{event.note && <p>{event.note}</p>}</span><button type="button" aria-label={`删除${event.title}`} onClick={() => onDeleteLifeEvent(timelinePerson.id, event.id)}>×</button></article>)}{!timelinePerson.events?.length && <div className="empty-archive-state"><strong>尚未记录生平事件</strong><span>先写下一个家庭里值得记住的时间点。</span></div>}</div>
      <form className="life-event-form" onSubmit={submitLifeEvent}><div className="form-row"><label>事件类型<select name="type" defaultValue="milestone">{Object.entries(eventTypeLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>日期<input type="date" name="date"/></label></div><label>事件标题<input name="title" placeholder="例如：举家迁居厦门" required/></label><div className="form-row"><label>地点<input name="place" placeholder="可留空"/></label><label>补充说明<input name="note" placeholder="家庭记忆或资料来源"/></label></div><button className="primary-button" type="submit">加入时间线</button></form>
      <div className="modal-actions"><button type="button" onClick={onCloseTimeline}>完成</button></div>
    </section></div>}
  </>
}

export function PrintableFamily({ data, archiveName, layout = 'detailed', includeNotes = true }: { data: FamilyData; archiveName: string; layout?: 'compact' | 'detailed'; includeNotes?: boolean }) {
  if (!data.people.length) return null
  const left = Math.min(...data.people.map((person) => person.x))
  const top = Math.min(...data.people.map((person) => person.y))
  const width = Math.max(...data.people.map((person) => person.x + 148)) - left
  const height = Math.max(...data.people.map((person) => person.y + 94)) - top
  const byId = new Map(data.people.map((person) => [person.id, person]))
  return <article className={`print-family-sheet print-layout-${layout}`}>
    <header><span>亲族图谱</span><h1>{archiveName}</h1><p>共 {data.people.length} 位人物 · {data.parents.length} 条亲子关系 · {data.spouses.length} 条婚姻关系</p></header>
    <svg viewBox={`${left - 30} ${top - 30} ${width + 60} ${height + 60}`} role="img" aria-label={`${archiveName}关系图`}>
      {data.parents.map((edge) => { const parent = byId.get(edge.parentId)!; const child = byId.get(edge.childId)!; return <path key={`${edge.parentId}-${edge.childId}`} d={`M ${parent.x + 74} ${parent.y + 94} V ${(parent.y + child.y + 94) / 2} H ${child.x + 74} V ${child.y}`} className={edge.kind && edge.kind !== 'biological' ? 'special-parent' : ''}/> })}
      {data.spouses.map((edge) => { const a = byId.get(edge.personAId)!; const b = byId.get(edge.personBId)!; return <line key={`${edge.personAId}-${edge.personBId}`} x1={a.x + 148} y1={a.y + 47} x2={b.x} y2={b.y + 47}/> })}
      {data.people.map((person) => <g key={person.id} transform={`translate(${person.x} ${person.y})`}><rect width="148" height="74"/><text x="74" y="28" textAnchor="middle">{person.name}</text><text className="print-meta" x="74" y="50" textAnchor="middle">{person.birthYear}{person.living === false ? ' — 已故' : ''}</text></g>)}
    </svg>
    <section><h2>人物名录</h2><table><thead><tr><th>姓名</th><th>别名</th><th>生卒</th><th>籍贯 / 支系</th>{includeNotes && <th>备注</th>}</tr></thead><tbody>{data.people.map((person) => <tr key={person.id}><td>{person.name}</td><td>{person.aliases?.join('、') || '—'}</td><td>{person.birthDate ?? person.birthYear}{person.deathDate ? ` — ${person.deathDate}` : ''}</td><td>{[person.hometown, person.branch].filter(Boolean).join(' · ') || '—'}</td>{includeNotes && <td>{person.note || '—'}</td>}</tr>)}</tbody></table></section>
    <footer>由亲族图谱生成 · {new Date().toLocaleDateString('zh-CN')}</footer>
  </article>
}
