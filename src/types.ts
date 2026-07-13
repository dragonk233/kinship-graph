export type Gender = 'male' | 'female'

export type ParentRelationKind = 'biological' | 'adoptive' | 'step'
export type SpouseRelationStatus = 'married' | 'divorced' | 'widowed' | 'former'
export type LifeEventType = 'birth' | 'education' | 'career' | 'residence' | 'marriage' | 'milestone' | 'death' | 'other'

export interface LifeEvent {
  id: string
  type: LifeEventType
  title: string
  date?: string
  year?: number
  place?: string
  note?: string
}

export interface Person {
  id: string
  name: string
  gender: Gender
  birthYear: number
  birthDate?: string
  deathDate?: string
  living?: boolean
  aliases?: string[]
  hometown?: string
  branch?: string
  generation: number
  x: number
  y: number
  note?: string
  avatar?: string
  events?: LifeEvent[]
}

export interface ParentRelation {
  parentId: string
  childId: string
  kind?: ParentRelationKind
}

export interface SpouseRelation {
  personAId: string
  personBId: string
  status?: SpouseRelationStatus
  startDate?: string
  endDate?: string
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

export interface FamilyArchiveSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  peopleCount: number
}

export interface FamilySnapshot {
  id: string
  archiveId: string
  createdAt: string
  label: string
  data: FamilyData
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
