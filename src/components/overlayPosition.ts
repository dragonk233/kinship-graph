export type OverlayPlacement = 'top' | 'bottom' | 'left' | 'right'

export type RectLike = { left: number; top: number; right: number; bottom: number; width: number; height: number }

export function computeOverlayPosition({ anchor, overlay, viewport, reserved = {}, gap = 8, margin = 12 }: {
  anchor: RectLike
  overlay: { width: number; height: number }
  viewport: { width: number; height: number }
  reserved?: { top?: number; right?: number; bottom?: number; left?: number }
  gap?: number
  margin?: number
}) {
  const bounds = {
    left: margin + (reserved.left ?? 0),
    top: margin + (reserved.top ?? 0),
    right: viewport.width - margin - (reserved.right ?? 0),
    bottom: viewport.height - margin - (reserved.bottom ?? 0),
  }
  const spaces = {
    bottom: bounds.bottom - anchor.bottom,
    top: anchor.top - bounds.top,
    right: bounds.right - anchor.right,
    left: anchor.left - bounds.left,
  }
  const needs = { bottom: overlay.height + gap, top: overlay.height + gap, right: overlay.width + gap, left: overlay.width + gap }
  const order: OverlayPlacement[] = ['bottom', 'top', 'right', 'left']
  const placement = order.find((side) => spaces[side] >= needs[side]) ?? order.reduce((best, side) => spaces[side] > spaces[best] ? side : best)
  let left = placement === 'right' ? anchor.right + gap : placement === 'left' ? anchor.left - overlay.width - gap : anchor.left + anchor.width / 2 - overlay.width / 2
  let top = placement === 'bottom' ? anchor.bottom + gap : placement === 'top' ? anchor.top - overlay.height - gap : anchor.top + anchor.height / 2 - overlay.height / 2
  left = Math.max(bounds.left, Math.min(left, bounds.right - overlay.width))
  top = Math.max(bounds.top, Math.min(top, bounds.bottom - overlay.height))
  const arrow = placement === 'top' || placement === 'bottom'
    ? Math.max(14, Math.min(overlay.width - 14, anchor.left + anchor.width / 2 - left))
    : Math.max(14, Math.min(overlay.height - 14, anchor.top + anchor.height / 2 - top))
  return { left, top, placement, arrow, bounds }
}
