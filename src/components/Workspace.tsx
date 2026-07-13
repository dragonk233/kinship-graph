import type { FormEvent } from 'react'
import { calculateKinship } from '../kinship'
import { hasMinnanRecording } from '../minnanSpeech'
import { formatLunarBirthday } from '../lunar'
import type { FamilyData } from '../types'
import { formatZodiac } from '../zodiac'
import type { MobileView } from './AppNavigation'
import { FamilyGraph } from './FamilyGraph'
import { Icon } from './Icon'
import { Avatar, birthdaySummary } from './PersonFields'

export function Workspace({ data, viewerId, selectedId, query, mobileView, speaking, onQueryChange, onMobileViewChange, onSelect, onMakeViewer, onAdd, onCanvasEdit, onDelete, onRoster, onEditProfile, onSaveCustomTerm, onSpeak, onEditRelations }: {
  data: FamilyData
  viewerId: string
  selectedId: string
  query: string
  mobileView: MobileView
  speaking: boolean
  onQueryChange: (query: string) => void
  onMobileViewChange: (view: MobileView) => void
  onSelect: (id: string) => void
  onMakeViewer: (id: string) => void
  onAdd: (anchorId?: string) => void
  onCanvasEdit: (id: string) => void
  onDelete: (id: string) => void
  onRoster: () => void
  onEditProfile: () => void
  onSaveCustomTerm: (event: FormEvent<HTMLFormElement>) => void
  onSpeak: () => void
  onEditRelations: (id: string) => void
}) {
  const selected = data.people.find((person) => person.id === selectedId)!
  const result = calculateKinship(data, viewerId, selectedId)
  const filtered = data.people.filter((person) => person.name.includes(query) || calculateKinship(data, viewerId, person.id).mandarin.some((term) => term.includes(query)))
  const pathPeople = result.pathIds.map((id) => data.people.find((person) => person.id === id)!).filter(Boolean)
  const hasOfficialRecording = hasMinnanRecording(result.minnanAudioTerms)

  return <main className={`workspace mobile-view-${mobileView}`}>
    <aside className="people-panel">
      <div className="panel-heading"><div><span className="eyebrow">人物索引</span><h2>家中亲人</h2></div><div className="panel-heading-tools"><button className="roster-button" type="button" onClick={onRoster}><Icon name="edit"/>连续编辑</button><span className="count">{data.people.length}</span></div></div>
      <label className="search"><Icon name="search"/><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索姓名或称呼"/></label>
      <div className="people-list">{filtered.map((person) => {
        const relation = calculateKinship(data, viewerId, person.id)
        return <button key={person.id} className={person.id === selectedId ? 'active' : ''} onClick={() => { onSelect(person.id); onMobileViewChange('detail') }}><Avatar person={person} size="small"/><span><strong>{person.name}</strong><small>{birthdaySummary(person)} · {formatZodiac(person.birthYear)}</small></span><em>{relation.mandarin[0]}</em></button>
      })}</div>
      <div className="legend"><span><i className="blood-dot"/>血缘</span><span><i className="spouse-dot"/>婚姻</span></div>
    </aside>

    <section className="canvas-panel">
      <div className="canvas-heading"><span className="eyebrow">家族关系画布</span><button className="mobile-selection-link" type="button" onClick={() => onMobileViewChange('detail')}><span>已选</span><strong>{selected.name}</strong><i>›</i></button></div>
      <FamilyGraph data={data} viewerId={viewerId} selectedId={selectedId} onSelect={onSelect} onMakeViewer={onMakeViewer} onAdd={onAdd} onEdit={onCanvasEdit} onDelete={onDelete}/>
    </section>

    <aside className="detail-panel">
      <div className="detail-profile"><Avatar person={selected} size="large"/><div className="profile-copy"><span className="eyebrow">当前查看</span><h2>{selected.name}</h2><p>{birthdaySummary(selected)} · {formatZodiac(selected.birthYear)}</p>{selected.birthDate && <p className="lunar-birthday">农历：{formatLunarBirthday(selected.birthDate)}</p>}</div><button className="edit-profile-button" onClick={onEditProfile} aria-label={`编辑${selected.name}的资料`}><Icon name="edit"/>编辑</button></div>
      <section className="term-block"><span className="eyebrow">现实中如何称呼</span><div className="main-term">{result.mandarin[0]}</div>{result.standardMandarin && <p>系统标准称呼：{result.standardMandarin.join('、')}</p>}{result.mandarin.length > 1 && <p>也可能称作：{result.mandarin.slice(1).join('、')}</p>}{selected.id !== viewerId && <form className="custom-term-form" onSubmit={onSaveCustomTerm} key={`${viewerId}-${selectedId}-${result.mandarin[0]}`}><label>我们家怎么叫<input name="customTerm" defaultValue={data.customTerms?.find((item) => item.viewerId === viewerId && item.targetId === selectedId)?.label ?? ''} placeholder={result.standardMandarin?.[0] ?? result.mandarin[0]}/></label><button type="submit">保存</button></form>}</section>
      <section className="dialect-block"><div><span className="eyebrow">闽南语 · {result.minnanKind === 'term' ? '官方称呼' : '关系路径读法'}</span><strong>{result.minnan}</strong><a href="https://sutian.moe.edu.tw/" target="_blank" rel="noreferrer">音频来源：教育部《臺灣台语常用词辭典》</a></div><button className={`speak-button ${speaking ? 'speaking' : ''}`} onClick={onSpeak} disabled={speaking || !hasOfficialRecording} aria-label={`用闽南语播报${result.minnan}`} title={result.minnanKind === 'term' ? '播放教育部官方真人发音' : '逐段播放官方词条发音'}><Icon name="speaker"/>{speaking ? '播报中' : hasOfficialRecording ? '播报' : '暂无音频'}</button></section>
      <section className="path-block"><div className="section-title"><span className="eyebrow">关系是怎么得出的</span><Icon name="route"/></div><p>{result.pathLabel}</p><div className="path-flow">{pathPeople.map((person, index) => <span key={person.id}><b>{person.name}</b>{index < pathPeople.length - 1 && <i>→</i>}</span>)}</div></section>
      <button className="manage-relations-button" onClick={() => onEditRelations(selected.id)}><Icon name="route"/><span><strong>编辑基础关系</strong><small>选择一位亲人作为支点，再说明关系</small></span></button>
      {selected.note && <section className="person-note"><span className="eyebrow">人物备注</span><p>{selected.note}</p></section>}
      <div className="accuracy-note"><strong>准确性提示</strong><p>闽南语称呼因泉州、厦门、漳州及家庭习惯而异。当前为演示词库，正式版允许逐条确认。</p></div>
    </aside>
  </main>
}
