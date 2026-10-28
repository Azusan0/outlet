export function formatDate(value: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatDuration(value?: number): string {
  if (value === undefined) return "—"
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(1)} s`
}

export function formatScore(value?: number): string {
  if (value === undefined) return "—"
  const percentage = value <= 1 ? value * 100 : value
  return `${Math.round(percentage)}%`
}

export function firstValue(
  values: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = values[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return "—"
}

export function summarize(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
