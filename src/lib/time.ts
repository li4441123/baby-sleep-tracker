export function nowIso() {
  return new Date().toISOString()
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export function dateKey(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfDay(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date | string) {
  const d = startOfDay(date)
  d.setDate(d.getDate() + 1)
  return d
}

export function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function formatTime(iso?: string) {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

export function formatDateTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} ${formatTime(iso)}`
}

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0分钟'
  const minutes = Math.floor(ms / 60000)
  if (minutes <= 0) return '不足1分钟'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}分钟`
  if (m <= 0) return `${h}小时`
  return `${h}小时${m}分钟`
}

export function toDateTimeLocalValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDateTimeLocalValue(value: string) {
  return new Date(value).toISOString()
}

export function overlapMs(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const start = Math.max(new Date(aStart).getTime(), new Date(bStart).getTime())
  const end = Math.min(new Date(aEnd).getTime(), new Date(bEnd).getTime())
  return Math.max(0, end - start)
}
