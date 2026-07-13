import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState } from 'react'
import { formatLunarBirthday, formatSolarBirthday, isBirthDate } from '../lunar'
import type { Person } from '../types'
import { Icon } from './Icon'

const AVATAR_FEATURE_ENABLED = false

function initials(name: string) { return name.slice(-2) }

export function birthdaySummary(person: Person) {
  return person.birthDate && isBirthDate(person.birthDate) ? formatSolarBirthday(person.birthDate) : `${person.birthYear}年`
}

export function Avatar({ person, size }: { person: Person; size?: 'small' | 'large' }) {
  const avatar = AVATAR_FEATURE_ENABLED ? person.avatar : undefined
  return <span className={`portrait ${size ?? ''} ${person.gender} ${avatar ? 'has-image' : ''}`}>
    {avatar ? <img src={avatar} alt=""/> : initials(person.name)}
  </span>
}

export function BirthdayField({ defaultValue, required = false }: { defaultValue?: string; required?: boolean }) {
  const [value, setValue] = useState(defaultValue ?? '')
  const initial = isBirthDate(defaultValue) ? defaultValue.split('-').map(Number) : [2000, 1, 1]
  const [visibleYear, setVisibleYear] = useState(initial[0])
  const [visibleMonth, setVisibleMonth] = useState(initial[1] - 1)
  const [open, setOpen] = useState(false)
  const fieldRef = useRef<HTMLDivElement>(null)
  const calendarId = useId()
  const lunar = formatLunarBirthday(value)
  const selectedParts = isBirthDate(value) ? value.split('-').map(Number) : null
  const daysInMonth = new Date(visibleYear, visibleMonth + 1, 0).getDate()
  const leadingDays = new Date(visibleYear, visibleMonth, 1).getDay()
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - leadingDays + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })
  const today = new Date()

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      if (!fieldRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const chooseDay = (day: number) => {
    setValue(`${visibleYear}-${String(visibleMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    setOpen(false)
  }

  return <label className="birthday-field">公历生日
    <div className="date-picker" ref={fieldRef}>
      <input name="birthDate" type="hidden" value={value}/>
      <button className={`date-trigger ${value ? '' : 'placeholder'}`} type="button" aria-expanded={open} aria-controls={calendarId} onClick={() => setOpen((current) => !current)}>
        <span>{value ? `${selectedParts![0]} 年 ${selectedParts![1]} 月 ${selectedParts![2]} 日` : '请选择出生日期'}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/></svg>
      </button>
      {required && <input className="date-required-proxy" tabIndex={-1} aria-hidden="true" required value={value} onChange={() => undefined}/>} 
      {open && <div className="calendar-popover" id={calendarId} role="dialog" aria-label="选择公历生日">
        <div className="calendar-heading">
          <select aria-label="年份" value={visibleYear} onChange={(event) => setVisibleYear(Number(event.target.value))}>{Array.from({ length: 301 }, (_, index) => 1800 + index).map((year) => <option key={year} value={year}>{year} 年</option>)}</select>
          <select aria-label="月份" value={visibleMonth} onChange={(event) => setVisibleMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{month + 1} 月</option>)}</select>
          <span className="calendar-mark">生辰</span>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{cells.map((day, index) => day ? <button type="button" key={`${visibleYear}-${visibleMonth}-${day}`} className={`${selectedParts?.[0] === visibleYear && selectedParts?.[1] === visibleMonth + 1 && selectedParts?.[2] === day ? 'selected' : ''} ${today.getFullYear() === visibleYear && today.getMonth() === visibleMonth && today.getDate() === day ? 'today' : ''}`} onClick={() => chooseDay(day)} aria-label={`${visibleYear}年${visibleMonth + 1}月${day}日`}>{day}</button> : <span key={`empty-${index}`}/>)}</div>
        <div className="calendar-footer"><span>选择后自动换算农历</span>{value && <button type="button" onClick={() => { setValue(''); setOpen(false) }}>清除</button>}</div>
      </div>}
    </div>
    <small className={`lunar-preview ${lunar ? '' : 'empty'}`} aria-live="polite">{lunar ? `农历 · ${lunar}` : '选择后自动换算农历'}</small>
  </label>
}

export function SearchablePersonSelect({ people, value, onChange, label }: { people: Person[]; value: string; onChange: (id: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState({ left: 0, top: 0, width: 240, maxHeight: 280 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = people.find((person) => person.id === value)
  const filtered = people.filter((person) => person.name.includes(query)).sort((a, b) => query ? 0 : a.id === value ? -1 : b.id === value ? 1 : 0).slice(0, 20)
  const toggle = () => {
    if (open) { setOpen(false); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16)
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const opensUp = spaceBelow < 280 && spaceAbove > spaceBelow
      const maxHeight = Math.min(280, Math.max(120, (opensUp ? spaceAbove : spaceBelow) - 8))
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: opensUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4, width, maxHeight })
    }
    setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => { if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const closeOnLayoutChange = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnLayoutChange)
    window.addEventListener('scroll', closeOnLayoutChange, true)
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeOnEscape); window.removeEventListener('resize', closeOnLayoutChange); window.removeEventListener('scroll', closeOnLayoutChange, true) }
  }, [open])
  return <div className="person-select"><button ref={triggerRef} type="button" onClick={toggle} aria-expanded={open} aria-label={label}><span>{selected?.name ?? '选择人物'}</span><i>⌄</i></button>{open && createPortal(<div className="person-select-menu" ref={menuRef} style={position}><label><Icon name="search"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索人物" autoFocus/></label><div>{filtered.map((person) => <button type="button" key={person.id} onClick={() => { onChange(person.id); setOpen(false); setQuery('') }}><Avatar person={person} size="small"/><span><strong>{person.name}</strong><small>{person.birthYear} 年</small></span>{person.id === value && <i>✓</i>}</button>)}{!filtered.length && <p>没有找到匹配人物</p>}</div></div>, document.body)}</div>
}
