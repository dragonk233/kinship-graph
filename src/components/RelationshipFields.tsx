import { useState } from 'react'
import type { BasicRelation } from '../relationEditor'
import type { FamilyData, Person } from '../types'
import { SearchablePersonSelect } from './PersonFields'

export function RelationshipComposer({ data, subjectId, subjectName, defaultAnchorId }: { data: FamilyData; subjectId?: string; subjectName: string; defaultAnchorId?: string }) {
  const candidates = data.people.filter((person) => person.id !== subjectId)
  const [anchorId, setAnchorId] = useState(defaultAnchorId && candidates.some((person) => person.id === defaultAnchorId) ? defaultAnchorId : candidates[0]?.id ?? '')
  const [relation, setRelation] = useState<BasicRelation>('child')
  const anchorHasParents = data.parents.some((item) => item.childId === anchorId)
  return <div className="relationship-composer">
    <input type="hidden" name="anchorId" value={anchorId}/><input type="hidden" name="basicRelation" value={relation}/>
    <span className="relationship-label">基础关系</span>
    <div className="compact-relationship-row"><strong>{subjectName}</strong><span>是</span><SearchablePersonSelect people={candidates} value={anchorId} onChange={setAnchorId} label="选择支点人物"/><span>的</span><select value={relation} onChange={(event) => setRelation(event.target.value as BasicRelation)} aria-label={`${subjectName}与支点人物的关系`}><option value="parent">父母</option><option value="child">子女</option><option value="sibling" disabled={!anchorHasParents}>亲兄弟姐妹</option><option value="spouse">配偶</option></select></div>
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

export function RosterRelationshipCell({ data, person, viewerId }: { data: FamilyData; person: Person; viewerId: string }) {
  const seed = rosterRelationshipSeed(data, person.id, viewerId)
  const candidates = data.people.filter((item) => item.id !== person.id)
  const [anchorId, setAnchorId] = useState(seed.anchorId)
  const [relation, setRelation] = useState<BasicRelation | ''>(seed.relation)
  const labels = person.gender === 'female' ? { parent: '母亲', child: '女儿', sibling: '亲姐妹' } : { parent: '父亲', child: '儿子', sibling: '亲兄弟' }
  return <div className="roster-relationship-cell">
    <input type="hidden" name={`anchor:${person.id}`} value={anchorId}/><input type="hidden" name={`relation:${person.id}`} value={relation}/><input type="hidden" name={`originalAnchor:${person.id}`} value={seed.anchorId}/><input type="hidden" name={`originalRelation:${person.id}`} value={seed.relation}/>
    <SearchablePersonSelect people={candidates} value={anchorId} onChange={setAnchorId} label={`${person.name}的支点人物`}/>
    <select value={relation} onChange={(event) => setRelation(event.target.value as BasicRelation | '')} aria-label={`${person.name}与支点人物的关系`}><option value="">未设置</option><option value="parent">{labels.parent}</option><option value="child">{labels.child}</option><option value="sibling">{labels.sibling}</option><option value="spouse">配偶</option></select>
  </div>
}
