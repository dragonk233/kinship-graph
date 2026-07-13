import { type CSSProperties, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { computeOverlayPosition, type OverlayPlacement } from './overlayPosition'
import { useCompactInteraction } from './useCompactInteraction'

function useDismiss(open: boolean, onClose: () => void, surfaceRef: RefObject<HTMLElement | null>, anchor?: HTMLElement | null) {
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!surfaceRef.current?.contains(target) && !anchor?.contains(target)) onClose()
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [anchor, onClose, open, surfaceRef])
}

function focusFirst(surface: HTMLElement | null) {
  window.requestAnimationFrame(() => surface?.querySelector<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')?.focus())
}

export function AnchoredMenu({ open, anchor, onClose, children, label, className = '', reserved = {} }: {
  open: boolean
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  label: string
  className?: string
  reserved?: { top?: number; right?: number; bottom?: number; left?: number }
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number; placement: OverlayPlacement; arrow: number }>({ left: 0, top: 0, placement: 'bottom', arrow: 24 })
  useDismiss(open, onClose, surfaceRef, anchor)

  useLayoutEffect(() => {
    if (!open || !anchor) return
    const update = () => {
      const surface = surfaceRef.current
      if (!surface || !anchor.isConnected) return onClose()
      setPosition(computeOverlayPosition({
        anchor: anchor.getBoundingClientRect(),
        overlay: { width: surface.offsetWidth, height: surface.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        reserved,
      }))
    }
    update()
    const observer = new ResizeObserver(update)
    if (surfaceRef.current) observer.observe(surfaceRef.current)
    observer.observe(anchor)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const frame = window.requestAnimationFrame(update)
    focusFirst(surfaceRef.current)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchor, onClose, open, reserved.bottom, reserved.left, reserved.right, reserved.top])

  if (!open || !anchor) return null
  const style = { left: position.left, top: position.top, '--overlay-arrow': `${position.arrow}px` } as CSSProperties
  return createPortal(<div ref={surfaceRef} className={`anchored-menu placement-${position.placement} ${className}`} style={style} role="menu" aria-label={label} onKeyDown={(event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"]), button:not(:disabled)')]
    if (!items.length) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length
    items[next].focus()
  }}>{children}</div>, document.body)
}

export function ActionSheet({ open, onClose, children, label, className = '' }: {
  open: boolean
  onClose: () => void
  children: ReactNode
  label: string
  className?: string
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  useDismiss(open, onClose, surfaceRef)
  useEffect(() => { if (open) focusFirst(surfaceRef.current) }, [open])
  if (!open) return null
  return createPortal(<div className="sheet-backdrop" role="presentation">
    <section ref={surfaceRef} className={`action-sheet ${className}`} role="dialog" aria-modal="true" aria-label={label} onKeyDown={(event) => {
      if (event.key !== 'Tab') return
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }} onPointerDown={(event) => { if ((event.target as HTMLElement).closest('.sheet-handle')) startY.current = event.clientY }} onPointerUp={(event) => { if (startY.current !== null && event.clientY - startY.current > 48) onClose(); startY.current = null }}>
      <button className="sheet-handle" type="button" aria-label="向下滑动或点击以关闭" onClick={onClose}><span/></button>
      {children}
    </section>
  </div>, document.body)
}

export function AdaptiveOverlay({ open, anchor, onClose, children, sheetHeader, label, menuClassName = '', sheetClassName = '', reserved }: {
  open: boolean
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  sheetHeader?: ReactNode
  label: string
  menuClassName?: string
  sheetClassName?: string
  reserved?: { top?: number; right?: number; bottom?: number; left?: number }
}) {
  const compact = useCompactInteraction()
  useEffect(() => {
    if (!open) return
    const trigger = anchor
    return () => { if (trigger?.isConnected) window.requestAnimationFrame(() => trigger.focus()) }
  }, [anchor, open])
  return compact
    ? <ActionSheet open={open} onClose={onClose} label={label} className={sheetClassName}>{sheetHeader}{children}</ActionSheet>
    : <AnchoredMenu open={open} anchor={anchor} onClose={onClose} label={label} className={menuClassName} reserved={reserved}>{children}</AnchoredMenu>
}
