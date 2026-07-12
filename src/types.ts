export type Gender = 'male' | 'female'

export interface Person {
  id: string
  name: string
  gender: Gender
  birthYear: number
  branch: '父系' | '母系' | '本家'
  generation: number
  x: number
  y: number
  note?: string
  avatar?: string
}

export interface ParentRelation {
  parentId: string
  childId: string
}

export interface SpouseRelation {
  personAId: string
  personBId: string
}

export interface FamilyData {
  people: Person[]
  parents: ParentRelation[]
  spouses: SpouseRelation[]
}

export interface KinshipResult {
  codes: string[]
  pathIds: string[]
  pathLabel: string
  mandarin: string[]
  minnan: string
  minnanAudioTerms: string[]
  minnanKind: 'term' | 'path'
}
