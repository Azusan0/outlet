export function safeInternalPath(
  value: string | null | undefined,
  fallback = '/user'
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }

  return value
}

export function tenantInternalPath(
  tenantSlug: string,
  value: string | null | undefined,
  fallback = '/user'
): string {
  const path = safeInternalPath(value, fallback)
  const tenantRoot = `/${tenantSlug}`

  if (path === tenantRoot || path.startsWith(`${tenantRoot}/`)) {
    return path
  }

  return path === '/' ? tenantRoot : `${tenantRoot}${path}`
}
