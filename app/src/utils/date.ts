const chinaTimeZone = 'Asia/Shanghai'

function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function todayInChina() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: chinaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function addDays(date: string, days: number) {
  const next = parseDate(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

export function daysUntil(date: string, fromDate = todayInChina()) {
  const target = parseDate(date).getTime()
  const from = parseDate(fromDate).getTime()
  return Math.round((target - from) / 86_400_000)
}

export function formatDisplayDate(date?: string) {
  if (!date) return ''
  return date
}

export function formatDisplayDateWithWeekday(date?: string) {
  if (!date) return ''
  const weekday = new Intl.DateTimeFormat('zh-CN', {
    timeZone: chinaTimeZone,
    weekday: 'short',
  }).format(parseDate(date))
  return `${date} ${weekday}`
}

export function formatDueStatus(date?: string) {
  if (!date) return '日期待补充'
  const diff = daysUntil(date)
  if (diff === 0) return '今天到期'
  if (diff > 0) return `剩余 ${diff} 天`
  return `已逾期 ${Math.abs(diff)} 天`
}
