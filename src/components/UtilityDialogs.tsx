import { showcaseFamily } from '../data'
import type { inspectFamilyHealth } from '../familyHealth'
import { calculateKinship } from '../kinship'
import type { FamilyData, Person } from '../types'
import { Icon } from './Icon'

type HealthIssues = ReturnType<typeof inspectFamilyHealth>

function formatStoredDate(value: string | null) {
  if (!value) return '尚未记录'
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function UtilityDialogs({ data, showBackup, showAppStatus, showInstallHelp, showReset, showShowcase, showPair, showHealth, deleteTarget, modifiedAt, backedUpAt, online, isStandalone, storagePersistent, storageUsage, needRefresh, pairAId, pairBId, healthIssues, onCloseBackup, onCloseAppStatus, onCloseInstallHelp, onCloseReset, onCloseShowcase, onClosePair, onCloseHealth, onCloseDelete, onExportBackup, onExportMarkdown, onExportGedcom, onImportBackup, onImportGedcom, onInstall, onOpenBackupFromStatus, onUpdate, onDeletePerson, onReset, onLoadShowcase, onPairAChange, onPairBChange }: {
  data: FamilyData
  showBackup: boolean
  showAppStatus: boolean
  showInstallHelp: boolean
  showReset: boolean
  showShowcase: boolean
  showPair: boolean
  showHealth: boolean
  deleteTarget?: Person
  modifiedAt: string | null
  backedUpAt: string | null
  online: boolean
  isStandalone: boolean
  storagePersistent: boolean | null
  storageUsage: { usage: number; quota: number } | null
  needRefresh: boolean
  pairAId: string
  pairBId: string
  healthIssues: HealthIssues
  onCloseBackup: () => void
  onCloseAppStatus: () => void
  onCloseInstallHelp: () => void
  onCloseReset: () => void
  onCloseShowcase: () => void
  onClosePair: () => void
  onCloseHealth: () => void
  onCloseDelete: () => void
  onExportBackup: () => void
  onExportMarkdown: () => void
  onExportGedcom: () => void
  onImportBackup: (file?: File) => void
  onImportGedcom: (file?: File) => void
  onInstall: () => void
  onOpenBackupFromStatus: () => void
  onUpdate: () => void
  onDeletePerson: () => void
  onReset: () => void
  onLoadShowcase: () => void
  onPairAChange: (id: string) => void
  onPairBChange: (id: string) => void
}) {
  const pairForward = calculateKinship(data, pairAId, pairBId)
  const pairReverse = calculateKinship(data, pairBId, pairAId)

  return <>
    {showBackup && <div className="modal-backdrop" onMouseDown={onCloseBackup}><section className="backup-modal" role="dialog" aria-modal="true" aria-labelledby="backup-title" onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">本地档案</span><h2 id="backup-title">备份与恢复家谱</h2><p>数据只保存在当前浏览器。定期导出一份精简备份，可以在清理浏览器或更换设备后恢复。</p></div>
      <div className="backup-options"><section><strong>导出 JSON 备份</strong><p>用于完整恢复家谱，不含照片和历史记录。</p><button type="button" onClick={onExportBackup}>导出或分享</button></section><section><strong>导出可读家谱</strong><p>下载含 Mermaid 图和人物资料的 Markdown 文件。</p><button type="button" onClick={onExportMarkdown}>导出或分享</button></section><section><strong>GEDCOM 通用家谱</strong><p>可迁移到其他家谱软件，也可导入外部 GEDCOM。</p><div className="inline-file-actions"><button type="button" onClick={onExportGedcom}>导出 GEDCOM</button><label className="import-backup-button">导入并合并<input type="file" accept=".ged,.gedcom,text/plain" onChange={(event) => { onImportGedcom(event.target.files?.[0]); event.currentTarget.value = '' }}/></label></div></section><section><strong>从 JSON 恢复</strong><p>导入会覆盖当前家谱，文件必须来自本应用且不超过 1MB。</p><label className="import-backup-button">选择备份文件<input type="file" accept="application/json,.json" onChange={(event) => { onImportBackup(event.target.files?.[0]); event.currentTarget.value = '' }}/></label></section></div>
      <dl className="backup-meta"><div><dt>最近修改</dt><dd>{formatStoredDate(modifiedAt)}</dd></div><div><dt>最近备份</dt><dd>{formatStoredDate(backedUpAt)}</dd></div><div><dt>档案规模</dt><dd>{data.people.length} 人 · {data.parents.length + data.spouses.length} 条关系</dd></div></dl>
      <div className="modal-actions"><button type="button" onClick={onCloseBackup}>关闭</button></div>
    </section></div>}

    {showAppStatus && <div className="modal-backdrop" onMouseDown={onCloseAppStatus}><section className="app-status-modal" role="dialog" aria-modal="true" aria-labelledby="app-status-title" onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">运行与存储</span><h2 id="app-status-title">应用状态</h2><p>家谱只保存在这台设备的当前应用空间中。</p></div>
      <dl className="app-status-list"><div><dt>网络</dt><dd className={online ? 'ok' : 'offline'}>{online ? '已联网' : '离线可用'}</dd></div><div><dt>打开方式</dt><dd>{isStandalone ? '桌面应用' : '浏览器网页'}</dd></div><div><dt>本地存储</dt><dd className={storagePersistent ? 'ok' : ''}>{storagePersistent === null ? '正在检查' : storagePersistent ? '已申请持久保留' : '由浏览器管理'}</dd></div><div><dt>存储占用</dt><dd>{storageUsage ? `${Math.max(.1, storageUsage.usage / 1024 / 1024).toFixed(1)} MB` : '暂不可读'}</dd></div><div><dt>应用版本</dt><dd>v{__APP_VERSION__}</dd></div><div><dt>最近修改</dt><dd>{formatStoredDate(modifiedAt)}</dd></div><div><dt>最近备份</dt><dd>{formatStoredDate(backedUpAt)}</dd></div></dl>
      <div className="status-actions">{!isStandalone && <button type="button" onClick={onInstall}>安装到桌面</button>}<button type="button" onClick={onOpenBackupFromStatus}>备份家谱</button>{needRefresh && <button type="button" onClick={onUpdate}>安装更新</button>}</div>
      <div className="modal-actions"><button type="button" onClick={onCloseAppStatus}>完成</button></div>
    </section></div>}

    {showInstallHelp && <div className="modal-backdrop" onMouseDown={onCloseInstallHelp}><section className="install-modal" role="dialog" aria-modal="true" aria-labelledby="install-title" onMouseDown={(event) => event.stopPropagation()}><span className="brand-seal">亲</span><div><span className="eyebrow">安装到手机桌面</span><h2 id="install-title">像应用一样打开亲族图谱</h2><p>iPhone：在 Safari 中点“分享”，再选“添加到主屏幕”。Android：打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。</p></div><div className="install-note">安装后仍使用本机档案；请定期导出 JSON 备份。</div><div className="modal-actions"><button type="button" onClick={onCloseInstallHelp}>知道了</button></div></section></div>}

    {deleteTarget && <div className="modal-backdrop" onMouseDown={onCloseDelete}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-person-title" onMouseDown={(event) => event.stopPropagation()}><div className="danger-mark"><Icon name="trash"/></div><div><span className="eyebrow">删除人物</span><h2 id="delete-person-title">确认删除 {deleteTarget.name}？</h2><p>人物资料及其父母、子女、配偶关系将一并删除，此操作无法撤销。</p></div><div className="modal-actions"><button type="button" onClick={onCloseDelete}>取消</button><button className="confirm-delete-button" type="button" onClick={onDeletePerson}>确认删除</button></div></section></div>}

    {showReset && <div className="modal-backdrop" onMouseDown={onCloseReset}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-family-title" onMouseDown={(event) => event.stopPropagation()}><div className="danger-mark"><Icon name="trash"/></div><div><span className="eyebrow">清空本地数据</span><h2 id="reset-family-title">确认清空整个亲族图谱？</h2><p>当前浏览器中保存的所有人物、关系和自定义称呼都会被删除，只保留一个空白的“我”供你重新开始配置。此操作无法撤销，建议先导出备份。</p></div><div className="modal-actions"><button type="button" onClick={onCloseReset}>取消</button><button className="confirm-delete-button" type="button" onClick={onReset}>确认清空</button></div></section></div>}

    {showShowcase && <div className="modal-backdrop" onMouseDown={onCloseShowcase}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="showcase-title" onMouseDown={(event) => event.stopPropagation()}><div className="showcase-mark"><Icon name="person"/></div><div><span className="eyebrow">效果预览</span><h2 id="showcase-title">生成七代示例家谱？</h2><p>示例以“我”为中心，包含上三代、下三代，以及配偶、兄弟姐妹和旁系分支，共 {showcaseFamily.people.length} 位人物。它会替换当前画布并保存到本地，建议先备份现有家谱。</p></div><div className="modal-actions"><button type="button" onClick={onCloseShowcase}>取消</button><button className="primary-button" type="button" onClick={onLoadShowcase}>生成示例</button></div></section></div>}

    {showPair && <div className="modal-backdrop" onMouseDown={onClosePair}><section className="pair-modal" role="dialog" aria-modal="true" aria-labelledby="pair-title" onMouseDown={(event) => event.stopPropagation()}>
      <div><span className="eyebrow">双向称呼查询</span><h2 id="pair-title">两个人是什么关系</h2><p>同时查看双方各自应该如何称呼对方。</p></div>
      <div className="pair-selectors"><label>人物甲<select value={pairAId} onChange={(event) => onPairAChange(event.target.value)}>{data.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><span>⇄</span><label>人物乙<select value={pairBId} onChange={(event) => onPairBChange(event.target.value)}>{data.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>
      <div className="pair-results"><section><span>{data.people.find((person) => person.id === pairAId)?.name} 称呼 {data.people.find((person) => person.id === pairBId)?.name}</span><strong>{pairForward.mandarin[0]}</strong><p>{pairForward.pathLabel}</p></section><section><span>{data.people.find((person) => person.id === pairBId)?.name} 称呼 {data.people.find((person) => person.id === pairAId)?.name}</span><strong>{pairReverse.mandarin[0]}</strong><p>{pairReverse.pathLabel}</p></section></div>
      <div className="modal-actions"><button type="button" onClick={onClosePair}>关闭</button></div>
    </section></div>}

    {showHealth && <div className="modal-backdrop" onMouseDown={onCloseHealth}><section className="health-modal" role="dialog" aria-modal="true" aria-labelledby="health-title" onMouseDown={(event) => event.stopPropagation()}><div><span className="eyebrow">数据健康检查</span><h2 id="health-title">家谱关系检查</h2><p>检查重复连接、关系循环和明显的出生年份风险。</p></div><div className="health-list">{healthIssues.length === 0 ? <div className="health-ok"><strong>未发现明确问题</strong><span>当前 {data.people.length} 位人物、{data.parents.length + data.spouses.length} 条直接关系通过检查。</span></div> : healthIssues.map((issue, index) => <div className={issue.level} key={`${issue.title}-${index}`}><i>{issue.level === 'error' ? '!' : '?'}</i><span><strong>{issue.title}</strong><small>{issue.detail}</small></span></div>)}</div><div className="modal-actions"><button type="button" onClick={onCloseHealth}>完成</button></div></section></div>}
  </>
}
