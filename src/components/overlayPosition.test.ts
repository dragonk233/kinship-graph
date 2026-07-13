import { describe, expect, it } from 'vitest'
import { computeOverlayPosition } from './overlayPosition'

const rect = (left: number, top: number, width = 44, height = 44) => ({ left, top, width, height, right: left + width, bottom: top + height })
const viewport = { width: 390, height: 844 }
const overlay = { width: 188, height: 207 }

describe('computeOverlayPosition', () => {
  it('prefers bottom and shifts inside the left edge', () => {
    const result = computeOverlayPosition({ anchor: rect(2, 100), overlay, viewport })
    expect(result.placement).toBe('bottom')
    expect(result.left).toBe(12)
    expect(result.top).toBe(152)
  })

  it('flips above an anchor near the bottom navigation reserve', () => {
    const result = computeOverlayPosition({ anchor: rect(170, 760), overlay, viewport, reserved: { bottom: 64 } })
    expect(result.placement).toBe('top')
    expect(result.top).toBe(545)
    expect(result.top + overlay.height).toBeLessThanOrEqual(result.bounds.bottom)
  })

  it('shifts inside the right edge while preserving the anchor arrow', () => {
    const result = computeOverlayPosition({ anchor: rect(370, 200), overlay, viewport })
    expect(result.left + overlay.width).toBeLessThanOrEqual(result.bounds.right)
    expect(result.arrow).toBeGreaterThan(overlay.width / 2)
  })

  it('respects top and bottom reserved controls when vertical space is tight', () => {
    const result = computeOverlayPosition({ anchor: rect(170, 320), overlay: { width: 188, height: 300 }, viewport: { width: 390, height: 640 }, reserved: { top: 80, bottom: 96 } })
    expect(result.top).toBeGreaterThanOrEqual(result.bounds.top)
    expect(result.top + 300).toBeLessThanOrEqual(result.bounds.bottom)
  })
})
