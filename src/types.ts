export type Gender = 'male' | 'female'

export interface Person {
  id: string
  name: string
  gender: Gender
  birthYear: number
  birthDate?: string
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

export interface CustomTerm {
  viewerId: string
  targetId: string
  label: string
}

export interface FamilyData {
  people: Person[]
  parents: ParentRelation[]
  spouses: SpouseRelation[]
  customTerms?: CustomTerm[]
}

export interface KinshipResult {
  codes: string[]
  pathIds: string[]
  pathLabel: string
  mandarin: string[]
  standardMandarin?: string[]
  minnan: string
  minnanAudioTerms: string[]
  minnanKind: 'term' | 'path'
}
