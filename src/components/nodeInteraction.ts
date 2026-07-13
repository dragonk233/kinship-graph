export type NodeActivation = 'single-click' | 'double-click'
export type NodeAction = 'select' | 'edit'

/** Stable product contract for direct interaction with a person node. */
export function nodeActionForActivation(activation: NodeActivation): NodeAction {
  return activation === 'double-click' ? 'edit' : 'select'
}
