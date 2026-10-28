export type TenantRequestContext = {
  slug: string
  publishable_key: string
}

export type TenantFetchOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit
  next?: {
    revalidate?: number | false
    tags?: string[]
  }
  [key: string]: unknown
}

export type TenantClientInput = Record<string, unknown> & {
  fetchOptions?: TenantFetchOptions
}

export function withTenantRequestContext(
  input: TenantClientInput,
  tenant: TenantRequestContext
): TenantClientInput

export function createTenantScopedClient<T>(
  client: T,
  resolveTenant: () => Promise<TenantRequestContext>
): T
