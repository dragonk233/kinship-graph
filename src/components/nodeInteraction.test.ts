import { describe, expect, it } from 'vitest'
import { nodeActionForActivation } from './nodeInteraction'

describe('person node interaction contract', () => {
  it('selects a person on a single click', () => {
    expect(nodeActionForActivation('single-click')).toBe('select')
  })

  it('opens editing on a double click instead of changing viewpoint', () => {
    expect(nodeActionForActivation('double-click')).toBe('edit')
  })
})
