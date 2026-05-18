import Dexie, { type Table } from 'dexie'
import type { AppSettings, Baby, BackupPayload, PositionPlan, SleepRecord } from '../types'
import { nowIso } from './time'

class BabySleepDb extends Dexie {
  babies!: Table<Baby, string>
  plans!: Table<PositionPlan, string>
  records!: Table<SleepRecord, string>
  settings!: Table<AppSettings, string>

  constructor() {
    super('baby_sleep_position_tracker')
    this.version(1).stores({
      babies: 'id, createdAt',
      plans: 'id, babyId, status, createdAt',
      records: 'id, babyId, planId, positionId, startedAt, endedAt',
      settings: 'id',
    })
  }
}

export const db = new BabySleepDb()

export async function loadSettings() {
  let settings = await db.settings.get('settings')
  if (!settings) {
    settings = { id: 'settings', darkMode: false }
    await db.settings.put(settings)
  }
  return settings
}

export async function seedIfEmpty() {
  await loadSettings()
}

export async function exportBackup(): Promise<BackupPayload> {
  const settings = await loadSettings()
  return {
    version: 1,
    exportedAt: nowIso(),
    babies: await db.babies.toArray(),
    plans: await db.plans.toArray(),
    records: await db.records.toArray(),
    settings,
  }
}

export async function importBackup(payload: BackupPayload) {
  if (payload.version !== 1) throw new Error('暂不支持这个备份版本')
  let babiesAdded = 0
  let plansAdded = 0
  let recordsAdded = 0
  let recordsSkipped = 0

  await db.transaction('rw', db.babies, db.plans, db.records, db.settings, async () => {
    for (const baby of payload.babies || []) {
      const existing = await db.babies.get(baby.id)
      if (!existing) {
        await db.babies.add(baby)
        babiesAdded += 1
      } else if (new Date(baby.updatedAt) > new Date(existing.updatedAt)) {
        await db.babies.put(baby)
      }
    }

    for (const plan of payload.plans || []) {
      const existing = await db.plans.get(plan.id)
      if (!existing) {
        await db.plans.add(plan)
        plansAdded += 1
      } else if (new Date(plan.updatedAt) > new Date(existing.updatedAt)) {
        await db.plans.put(plan)
      }
    }

    for (const record of payload.records || []) {
      const byId = await db.records.get(record.id)
      if (byId) {
        recordsSkipped += 1
        continue
      }
      const duplicate = await db.records
        .where('startedAt')
        .equals(record.startedAt)
        .filter(
          (item) =>
            item.babyId === record.babyId &&
            item.planId === record.planId &&
            item.positionId === record.positionId &&
            item.endedAt === record.endedAt,
        )
        .first()
      if (duplicate && duplicate.endedAt === record.endedAt) {
        recordsSkipped += 1
        continue
      }
      await db.records.add(record)
      recordsAdded += 1
    }

    await db.settings.put({
      id: 'settings',
      selectedBabyId: payload.settings?.selectedBabyId,
      lastBackupAt: nowIso(),
      darkMode: payload.settings?.darkMode ?? false,
    })
  })

  return { babiesAdded, plansAdded, recordsAdded, recordsSkipped }
}
