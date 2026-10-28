const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeCacheId(value, createId) {
  return value && UUID_PATTERN.test(value) ? value : createId()
}

export function buildCacheTag(tag, tenantSlug, cacheId) {
  return `${tenantSlug}-${tag}-${cacheId}`
}
