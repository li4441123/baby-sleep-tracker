import type { PositionPlan, SleepRecord } from '../types'
import { addDays, dateKey, endOfDay, formatDuration, startOfDay } from './time'

export interface PositionStat {
  id: string
  name: string
  color: string
  targetPercent: number
  durationMs: number
  actualPercent: number
  deltaPercent: number
  completed: boolean
}

export interface StatsResult {
  from: Date
  to: Date
  totalMs: number
  days: Record<string, number>
  positions: PositionStat[]
}

export function assignRecordToEndDay(record: SleepRecord, rangeStart: Date, rangeEnd: Date) {
  const endedAt = record.endedAt || new Date().toISOString()
  const end = new Date(endedAt)
  if (end < rangeStart || end >= rangeEnd) return []
  const ms = Math.max(0, end.getTime() - new Date(record.startedAt).getTime())
  return [{ day: dateKey(end), ms, positionId: record.positionId, recordId: record.id }]
}

export function calculateStats(plan: PositionPlan | undefined, records: SleepRecord[], days: number): StatsResult {
  const today = startOfDay(new Date())
  const from = addDays(today, -(days - 1))
  const to = endOfDay(today)
  const relevant = records.filter((record) => record.planId === plan?.id && record.startedAt && record.endedAt)
  const byPosition = new Map<string, number>()
  const byDay: Record<string, number> = {}

  for (const record of relevant) {
    for (const chunk of assignRecordToEndDay(record, from, to)) {
      byPosition.set(chunk.positionId, (byPosition.get(chunk.positionId) || 0) + chunk.ms)
      byDay[chunk.day] = (byDay[chunk.day] || 0) + chunk.ms
    }
  }

  const totalMs = Array.from(byPosition.values()).reduce((sum, ms) => sum + ms, 0)
  const positions = (plan?.positions || []).map((position) => {
    const durationMs = byPosition.get(position.id) || 0
    const actualPercent = totalMs ? Math.round((durationMs / totalMs) * 1000) / 10 : 0
    const deltaPercent = Math.round((actualPercent - position.targetPercent) * 10) / 10
    return {
      ...position,
      durationMs,
      actualPercent,
      deltaPercent,
      completed: totalMs > 0 && actualPercent >= position.targetPercent,
    }
  })

  return { from, to, totalMs, days: byDay, positions }
}

export function targetHint(stats: StatsResult) {
  if (!stats.totalMs) return '今天还没有睡眠记录'
  const mostBehind = stats.positions
    .filter((item) => !item.completed)
    .sort((a, b) => a.deltaPercent - b.deltaPercent)[0]
  if (!mostBehind) return '当前方案目标已完成'
  const expectedMs = stats.totalMs * (mostBehind.targetPercent / 100)
  const missingMs = Math.max(0, expectedMs - mostBehind.durationMs)
  return `${mostBehind.name}还差约 ${formatDuration(missingMs)}`
}
