import type { Person } from '../types'
import { Icon } from './Icon'

export type SaveState = 'loading' | 'saving' | 'saved' | 'error'

export function AppHeader({ viewer, isHomeViewer, canReturnHome, saveState, mobileToolsOpen, canUndo, healthIssueCount, isStandalone, onToggleTools, onCloseTools, onReturnHome, onUndo, onPair, onHealth, onBackup, onInstall, onStatus, onShowcase, onReset }: {
  viewer: Person
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
  onHealth: () => void
  onBackup: () => void
  onInstall: () => void
  onStatus: () => void
  onShowcase: () => void
  onReset: () => void
}) {
  return <header className="topbar">
    <div className="brand"><span className="brand-seal">亲</span><div><strong>亲族图谱</strong><small>称呼从关系里自然生长</small></div></div>
    <div className="viewpoint-chip"><span>当前主视角</span><strong>{viewer.name}</strong><em>{isHomeViewer ? '本人' : '代入视角'}</em></div>
    <div className={`header-tools ${mobileToolsOpen ? 'open' : ''}`}>
      <button className="mobile-tools-trigger" type="button" aria-expanded={mobileToolsOpen} onClick={onToggleTools}>工具<span aria-hidden="true">•••</span></button>
      <div className="header-actions" onClick={onCloseTools}>
        {saveState !== 'saved' && <span className={`save-status ${saveState}`} role="status" aria-live="polite"><i/>{saveState === 'loading' ? '读取本地档案' : saveState === 'saving' ? '正在保存' : '本地保存失败'}</span>}
        {canReturnHome && <button className="text-button" onClick={onReturnHome}><Icon name="home"/>回到我</button>}
        <button className="backup-button" onClick={onUndo} disabled={!canUndo}>撤销</button>
        <button className="backup-button" onClick={onPair}>两人关系</button>
        <button className={`backup-button ${healthIssueCount ? 'has-issues' : ''}`} onClick={onHealth}>检查{healthIssueCount ? ` · ${healthIssueCount}` : ''}</button>
        <button className="backup-button" onClick={onBackup}>备份</button>
        {!isStandalone && <button className="backup-button" onClick={onInstall}>安装到桌面</button>}
        <button className="backup-button" onClick={onStatus}>应用状态</button>
        <button className="showcase-button" onClick={onShowcase}><Icon name="plus"/>生成示例</button>
        <button className="reset-button" onClick={onReset}><Icon name="trash"/>清空</button>
      </div>
    </div>
  </header>
}

