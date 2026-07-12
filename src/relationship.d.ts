declare module 'relationship.js' {
  interface RelationshipOptions {
    text?: string
    target?: string
    sex?: -1 | 0 | 1
    type?: 'default' | 'chain' | 'pair'
    reverse?: boolean
    mode?: string
    optimal?: boolean
  }
  interface RelationshipFunction {
    (options: RelationshipOptions | string): string[]
    setMode(name: string, data: Record<string, string[]>): void
  }
  const relationship: RelationshipFunction
  export default relationship
}
