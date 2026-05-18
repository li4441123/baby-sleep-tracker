export type SourceType = 'live' | 'manual'

export interface Baby {
  id: string
  name: string
  birthday: string
  gestationalWeeks: number
  gestationalDays: number
  currentPlanId?: string
  createdAt: string
  updatedAt: string
}

export interface PositionItem {
  id: string
  name: string
  targetPercent: number
  color: string
}

export interface PositionPlan {
  id: string
  babyId: string
  name: string
  positions: PositionItem[]
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface SleepRecord {
  id: string
  babyId: string
  planId: string
  positionId: string
  startedAt: string
  endedAt?: string
  source: SourceType
  note?: string
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id: 'settings'
  selectedBabyId?: string
  lastBackupAt?: string
  darkMode: boolean
}

export interface BackupPayload {
  version: 1
  exportedAt: string
  babies: Baby[]
  plans: PositionPlan[]
  records: SleepRecord[]
  settings: AppSettings
}
