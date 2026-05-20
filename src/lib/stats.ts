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
  catchUpPercent: number
  catchUpMs: number
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
  return calculateStatsBetween(plan, records, from, to)
}

export function calculateStatsForDate(plan: PositionPlan | undefined, records: SleepRecord[], day: string): StatsResult {
  const from = startOfDay(day)
  const to = endOfDay(day)
  return calculateStatsBetween(plan, records, from, to)
}

function calculateStatsBetween(plan: PositionPlan | undefined, records: SleepRecord[], from: Date, to: Date): StatsResult {
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
    const actualPercent = totalMs ? (durationMs / totalMs) * 100 : 0
    const deltaPercent = actualPercent - position.targetPercent
    const targetRatio = position.targetPercent / 100
    const targetMsAtCurrentTotal = totalMs * targetRatio
    const catchUpMs =
      totalMs > 0 && durationMs < targetMsAtCurrentTotal && targetRatio < 1
        ? Math.max(0, (targetMsAtCurrentTotal - durationMs) / (1 - targetRatio))
        : 0
    const catchUpPercent = totalMs ? (catchUpMs / totalMs) * 100 : 0
    return {
      ...position,
      durationMs,
      actualPercent,
      deltaPercent,
      catchUpPercent,
      catchUpMs,
      completed: totalMs > 0 && actualPercent >= position.targetPercent,
    }
  })

  return { from, to, totalMs, days: byDay, positions }
}

export function targetHint(stats: StatsResult) {
  if (!stats.totalMs) return '今天还没有睡眠记录'
  const mostBehind = stats.positions
    .filter((item) => !item.completed)
    .sort((a, b) => b.catchUpMs - a.catchUpMs)[0]
  if (!mostBehind) return '当前方案目标已完成'
  return `${mostBehind.name}还差约 ${formatDuration(mostBehind.catchUpMs)}`
}

export function formatPercent(value: number, digits = 1) {
  if (!Number.isFinite(value)) return '0'
  const factor = 10 ** digits
  const truncated = Math.trunc(value * factor) / factor
  return truncated.toFixed(digits).replace(/\.?0+$/, '')
}
