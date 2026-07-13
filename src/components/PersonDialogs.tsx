import type { FormEvent } from 'react'
import type { FamilyData } from '../types'
import { Icon } from './Icon'
import { Avatar, BirthdayField } from './PersonFields'
import { RelationshipComposer, RosterRelationshipCell } from './RelationshipFields'

const AVATAR_FEATURE_ENABLED = false

export function PersonDialogs({ data, viewerId, selectedId, showAdd, showRelations, showEdit, showRoster, relationEditId, avatarDraft, onCloseAdd, onCloseRelations, onCloseEdit, onCloseRoster, onCloseRelationEditor, onAddPerson, onEditPerson, onEditRoster, onEditDirectRelations, onRemoveDirectRelation, onUploadAvatar, onAvatarDraftChange, onOpenRelationEditor }: {
  data: FamilyData
  viewerId: string
  selectedId: string
  showAdd: boolean
  showRelations: boolean
  showEdit: boolean
  showRoster: boolean
  relationEditId: string | null
  avatarDraft?: string
  onCloseAdd: () => void
  onCloseRelations: () => void
  onCloseEdit: () => void
  onCloseRoster: () => void
  onCloseRelationEditor: () => void
  onAddPerson: (event: FormEvent<HTMLFormElement>) => void
  onEditPerson: (event: FormEvent<HTMLFormElement>) => void
  onEditRoster: (event: FormEvent<HTMLFormElement>) => void
  onEditDirectRelations: (event: FormEvent<HTMLFormElement>) => void
  onRemoveDirectRelation: (type: 'parent' | 'spouse', firstId: string, secondId: string) => void
  onUploadAvatar: (file?: File) => void
  onAvatarDraftChange: (value?: string) => void
  onOpenRelationEditor: (id: string) => void
}) {
  const selected = data.people.find((person) => person.id === selectedId)!
  const relationSubject = relationEditId ? data.people.find((person) => person.id === relationEditId) : undefined
  const directParents = data.parents.filter((item) => item.parentId === selected.id || item.childId === selected.id)
  const directSpouses = data.spouses.filter((item) => item.personAId === selected.id || item.personBId === selected.id)

  return <>
    {showAdd && <div className="modal-backdrop" onMouseDown={onCloseAdd}><form className="add-modal relation-modal" onSubmit={onAddPerson} onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">添加人物</span><h2>创建一位亲人</h2><p>填写基本资料，再用一位已有亲人说明两人的基础关系。</p></div>
      <label>姓名<input name="name" autoFocus placeholder="例如：王小安" required/></label>
      <div className="form-row"><label>性别<select name="gender"><option value="male">男性</option><option value="female">女性</option></select></label><BirthdayField defaultValue="2000-01-01" required/></div>
      <RelationshipComposer data={data} subjectName="新人物" defaultAnchorId={selectedId}/>
      <div className="modal-actions"><button type="button" onClick={onCloseAdd}>取消</button><button className="primary-button" type="submit">加入图谱</button></div>
    </form></div>}

    {showRelations && <div className="modal-backdrop" onMouseDown={onCloseRelations}><section className="relations-modal" role="dialog" aria-modal="true" aria-labelledby="relations-title" onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">关系维护</span><h2 id="relations-title">{selected.name} 的直接关系</h2><p>这里只显示家谱中实际保存的基础连接；移除连接不会删除人物。</p></div>
      <div className="direct-relations">
        {directParents.map((item) => { const otherId = item.parentId === selected.id ? item.childId : item.parentId; const other = data.people.find((person) => person.id === otherId)!; const label = item.parentId === selected.id ? `${other.name}的父母` : `${other.name}的子女`; return <div key={`${item.parentId}-${item.childId}`}><span><strong>{other.name}</strong><small>{label}</small></span><button type="button" onClick={() => onRemoveDirectRelation('parent', item.parentId, item.childId)}>移除</button></div> })}
        {directSpouses.map((item) => { const otherId = item.personAId === selected.id ? item.personBId : item.personAId; const other = data.people.find((person) => person.id === otherId)!; return <div key={`${item.personAId}-${item.personBId}`}><span><strong>{other.name}</strong><small>配偶</small></span><button type="button" onClick={() => onRemoveDirectRelation('spouse', item.personAId, item.personBId)}>移除</button></div> })}
        {!directParents.length && !directSpouses.length && <div className="empty-relations">这个人物暂时没有直接关系</div>}
      </div>
      <div className="modal-actions"><button type="button" onClick={onCloseRelations}>完成</button></div>
    </section></div>}

    {showEdit && <div className="modal-backdrop" onMouseDown={onCloseEdit}><form className="add-modal edit-modal" onSubmit={onEditPerson} onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">人物档案</span><h2>编辑 {selected.name}</h2><p>修改后会同步更新人物列表、家族画布和亲属称呼。</p></div>
      {AVATAR_FEATURE_ENABLED && <div className="avatar-editor"><Avatar person={{ ...selected, avatar: avatarDraft }} size="large"/><div className="avatar-editor-copy"><strong>人物头像</strong><small>支持 JPG、PNG、WebP，文件不超过 5MB</small><div className="avatar-editor-actions"><label className="upload-avatar-button">{avatarDraft ? '更换图片' : '上传图片'}<input type="file" accept="image/*" onChange={(event) => { onUploadAvatar(event.target.files?.[0]); event.currentTarget.value = '' }}/></label>{avatarDraft && <button type="button" onClick={() => onAvatarDraftChange(undefined)}>移除头像</button>}</div></div></div>}
      <label>姓名<input name="name" autoFocus defaultValue={selected.name} placeholder="请输入真实姓名" required/></label>
      <div className="form-row"><label>性别<select name="gender" defaultValue={selected.gender}><option value="male">男性</option><option value="female">女性</option></select></label><BirthdayField defaultValue={selected.birthDate}/></div>
      <label>人物备注<textarea name="note" rows={3} defaultValue={selected.note ?? ''} placeholder="籍贯、小名、家庭记忆等"/></label>
      <button className="inline-relation-button" type="button" onClick={() => onOpenRelationEditor(selected.id)}><Icon name="route"/><span><strong>添加或调整关系</strong><small>选择一位支点人物，再说明两人的基础关系</small></span><i>›</i></button>
      <div className="modal-actions"><button type="button" onClick={onCloseEdit}>取消</button><button className="primary-button" type="submit">保存修改</button></div>
    </form></div>}

    {showRoster && <div className="modal-backdrop" onMouseDown={onCloseRoster}><form className="roster-modal" onSubmit={onEditRoster} onMouseDown={(event) => event.stopPropagation()}>
      <div className="roster-heading"><div><span className="eyebrow">人物名册</span><h2>连续编辑人物资料</h2><p>资料可统一保存；每一行使用同样的“支点人物 + 基础关系”编辑方式。</p></div><span>{data.people.length} 人</span></div>
      <div className="roster-table-wrap"><table className="roster-table"><thead><tr><th>人物</th><th>是谁的什么人</th><th>性别</th><th>公历生日</th><th>备注</th></tr></thead><tbody>{data.people.map((person) => <tr key={person.id}>
        <td data-label="人物"><div className="roster-person"><Avatar person={person} size="small"/><div><input name={`name:${person.id}`} defaultValue={person.name} aria-label={`${person.name}的姓名`} required/></div></div></td>
        <td data-label="基础关系"><RosterRelationshipCell data={data} person={person} viewerId={viewerId}/></td>
        <td data-label="性别"><select name={`gender:${person.id}`} defaultValue={person.gender} aria-label={`${person.name}的性别`}><option value="male">男性</option><option value="female">女性</option></select></td>
        <td data-label="公历生日"><input name={`birthDate:${person.id}`} type="date" defaultValue={person.birthDate ?? ''} aria-label={`${person.name}的公历生日`}/></td>
        <td data-label="备注"><input name={`note:${person.id}`} defaultValue={person.note ?? ''} placeholder="小名、籍贯、家庭记忆" aria-label={`${person.name}的备注`}/></td>
      </tr>)}</tbody></table></div>
      <div className="modal-actions"><button type="button" onClick={onCloseRoster}>取消</button><button className="primary-button" type="submit">统一保存</button></div>
    </form></div>}

    {relationEditId && <div className="modal-backdrop relation-editor-layer" onMouseDown={onCloseRelationEditor}><form className="direct-relation-modal" onSubmit={onEditDirectRelations} onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">基础关系</span><h2>编辑 {relationSubject?.name} 的关系</h2><p>选择一位支点人物，再说明当前人物是对方的什么人。</p></div>
      <RelationshipComposer data={data} subjectId={relationEditId} subjectName={relationSubject?.name ?? '当前人物'} defaultAnchorId={viewerId === relationEditId ? data.people.find((person) => person.id !== relationEditId)?.id : viewerId}/>
      <div className="existing-relations"><span className="eyebrow">已记录的基础连接</span>
        {data.parents.filter((item) => item.parentId === relationEditId || item.childId === relationEditId).map((item) => { const otherId = item.parentId === relationEditId ? item.childId : item.parentId; const other = data.people.find((person) => person.id === otherId)!; const label = item.parentId === relationEditId ? `是 ${other.name} 的父母` : `是 ${other.name} 的子女`; return <div key={`${item.parentId}-${item.childId}`}><span><strong>{other.name}</strong><small>{label}</small></span><button type="button" onClick={() => onRemoveDirectRelation('parent', item.parentId, item.childId)}>移除</button></div> })}
        {data.spouses.filter((item) => item.personAId === relationEditId || item.personBId === relationEditId).map((item) => { const otherId = item.personAId === relationEditId ? item.personBId : item.personAId; const other = data.people.find((person) => person.id === otherId)!; return <div key={`${item.personAId}-${item.personBId}`}><span><strong>{other.name}</strong><small>配偶</small></span><button type="button" onClick={() => onRemoveDirectRelation('spouse', item.personAId, item.personBId)}>移除</button></div> })}
      </div>
      <div className="modal-actions"><button type="button" onClick={onCloseRelationEditor}>取消</button><button className="primary-button" type="submit">添加关系</button></div>
    </form></div>}
  </>
}
