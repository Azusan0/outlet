export function normalizeCacheId(
  value: string | null | undefined,
  createId: () => string
): string

export function buildCacheTag(
  tag: string,
  tenantSlug: string,
  cacheId: string
): string
