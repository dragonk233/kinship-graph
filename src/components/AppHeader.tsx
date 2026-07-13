import { useRef } from 'react'
import type { Person } from '../types'
import { Icon } from './Icon'
import { AdaptiveOverlay } from './AdaptiveOverlay'
import { useCompactInteraction } from './useCompactInteraction'

export type SaveState = 'loading' | 'saving' | 'saved' | 'error'

export function AppHeader({ viewer, archiveName, isHomeViewer, canReturnHome, saveState, mobileToolsOpen, canUndo, healthIssueCount, isStandalone, onToggleTools, onCloseTools, onReturnHome, onUndo, onPair, onCalendar, onArchives, onHistory, onDuplicates, onPrint, onHealth, onBackup, onInstall, onStatus, onShowcase, onReset }: {
  viewer: Person
  archiveName: string
  isHomeViewer: boolean
  canReturnHome: boolean
  saveState: SaveState
  mobileToolsOpen: boolean
  canUndo: boolean
  healthIssueCount: number
  isStandalone: boolean
  onToggleTools: () => void
  onCloseTools: () => void
  onReturnHome: () => void
  onUndo: () => void
  onPair: () => void
  onCalendar: () => void
  onArchives: () => void
  onHistory: () => void
  onDuplicates: () => void
  onPrint: () => void
  onHealth: () => void
  onBackup: () => void
  onInstall: () => void
  onStatus: () => void
  onShowcase: () => void
  onReset: () => void
}) {
  const toolsTriggerRef = useRef<HTMLButtonElement>(null)
  const compact = useCompactInteraction()
  const primaryActions = <>
    {saveState !== 'saved' && <span className={`save-status ${saveState}`} role="status" aria-live="polite"><i/>{saveState === 'loading' ? '读取本地档案' : saveState === 'saving' ? '正在保存' : '本地保存失败'}</span>}
    {canReturnHome && <button className="text-button" onClick={onReturnHome}><Icon name="home"/><span>回到我</span></button>}
    <button className="backup-button" onClick={onUndo} disabled={!canUndo}><Icon name="undo"/><span>撤销</span></button>
    <button className="backup-button" onClick={onPair}><Icon name="pair"/><span>两人关系</span></button>
    <button className="backup-button" onClick={onCalendar}><Icon name="calendar"/><span>家事历</span></button>
    <button className={`backup-button ${healthIssueCount ? 'has-issues' : ''}`} onClick={onHealth}><Icon name="shield"/><span>检查{healthIssueCount ? ` · ${healthIssueCount}` : ''}</span></button>
    <button className="backup-button" onClick={onBackup}><Icon name="archive"/><span>备份</span></button>
  </>
  const secondaryActions = <>
    <button className="backup-button" onClick={onArchives}><Icon name="books"/><span>家谱书架</span></button>
    <button className="backup-button" onClick={onHistory}><Icon name="history"/><span>历史版本</span></button>
    <button className="backup-button" onClick={onDuplicates}><Icon name="merge"/><span>重复人物</span></button>
    <button className="backup-button" onClick={onPrint}><Icon name="print"/><span>打印族谱</span></button>
    {!isStandalone && <button className="backup-button" onClick={onInstall}><Icon name="plus"/><span>安装到桌面</span></button>}
    <button className="backup-button" onClick={onStatus}><Icon name="info"/><span>应用状态</span></button>
    <button className="showcase-button" onClick={onShowcase}><Icon name="plus"/><span>生成示例</span></button>
    <div className="menu-separator" role="separator"/>
    <button className="reset-button destructive-menu-item" onClick={onReset}><Icon name="trash"/><span>清空本地家谱</span></button>
  </>
  const overlayActions = <div className="header-action-list" onClick={onCloseTools}>{compact && primaryActions}{secondaryActions}</div>
  return <header className="topbar">
    <div className="brand"><span className="brand-seal">亲</span><div><strong>亲族图谱</strong><small>{archiveName}</small></div></div>
    <div className="viewpoint-chip"><span>当前主视角</span><strong>{viewer.name}</strong><em>{isHomeViewer ? '本人' : '代入视角'}</em></div>
    <div className={`header-tools ${mobileToolsOpen ? 'open' : ''}`}>
      {!compact && <div className="header-actions">{primaryActions}</div>}
      <button ref={toolsTriggerRef} className="tools-trigger" type="button" aria-haspopup={compact ? 'dialog' : 'menu'} aria-expanded={mobileToolsOpen} onClick={onToggleTools}><span>{compact ? '工具' : '更多'}</span><Icon name="ellipsis"/></button>
      <AdaptiveOverlay open={mobileToolsOpen} anchor={toolsTriggerRef.current} onClose={onCloseTools} label="家谱工具" menuClassName="header-more-menu" sheetClassName="tools-action-sheet" sheetHeader={<div className="sheet-section-heading"><span className="brand-seal">亲</span><span><strong>家谱工具</strong><small>管理、检查和备份当前家谱</small></span></div>}>{overlayActions}</AdaptiveOverlay>
    </div>
  </header>
}
