import { Icon } from './Icon'

export type MobileView = 'graph' | 'people' | 'detail'

export function MobileNavigation({ view, peopleCount, onChange }: {
  view: MobileView
  peopleCount: number
  onChange: (view: MobileView) => void
}) {
  return <nav className="mobile-nav" aria-label="移动端主要页面">
    <button className={view === 'graph' ? 'active' : ''} type="button" aria-current={view === 'graph' ? 'page' : undefined} onClick={() => onChange('graph')}><Icon name="route"/><span>图谱</span></button>
    <button className={view === 'people' ? 'active' : ''} type="button" aria-current={view === 'people' ? 'page' : undefined} onClick={() => onChange('people')}><Icon name="search"/><span>人物</span><em>{peopleCount}</em></button>
    <button className={view === 'detail' ? 'active' : ''} type="button" aria-current={view === 'detail' ? 'page' : undefined} onClick={() => onChange('detail')}><Icon name="person"/><span>称谓</span></button>
  </nav>
}

