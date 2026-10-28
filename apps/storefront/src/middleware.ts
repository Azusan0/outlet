import { NextRequest, NextResponse } from 'next/server'

type TenantIndexItem = {
  id: string
  slug: string
  name: string
  sales_channel_id: string
  publishable_key: string
  region_id: string
}

type TenantIndexResponse = { tenants: TenantIndexItem[] }

async function loadPrivateIndex(): Promise<TenantIndexItem[] | null> {
  if (process.env.OUTLET_TENANT_INDEX) {
    try {
      return (JSON.parse(process.env.OUTLET_TENANT_INDEX) as TenantIndexResponse).tenants
    } catch {
      throw new Error('Invalid OUTLET_TENANT_INDEX configuration')
    }
  }
  return null
}

const backendUrl = () => process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'
const bootstrapKey = () => process.env.OUTLET_BOOTSTRAP_KEY || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ''
const defaultTenant = () => process.env.OUTLET_DEFAULT_TENANT || 'north'
const basePath = () => (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '')
let cached: { expires: number; tenants: TenantIndexItem[] } = { expires: 0, tenants: [] }

async function tenantIndex() {
  if (cached.expires > Date.now()) return cached.tenants
  const privateIndex = await loadPrivateIndex()
  if (privateIndex) return privateIndex
  const response = await fetch(`${backendUrl()}/store/tenants`, {
    headers: { 'x-publishable-api-key': bootstrapKey() },
    next: { revalidate: 60 },
  })
  if (!response.ok) throw new Error('Unable to resolve storefront tenants')
  const body = await response.json()
  cached = { expires: Date.now() + 60_000, tenants: body.tenants }
  return cached.tenants
}

export async function middleware(request: NextRequest) {
  const configuredBasePath = basePath()
  const pathname =
    configuredBasePath && request.nextUrl.pathname.startsWith(configuredBasePath)
      ? request.nextUrl.pathname.slice(configuredBasePath.length) || '/'
      : request.nextUrl.pathname
  const first = pathname.split('/')[1]
  let tenant: TenantIndexItem | undefined
  let rewritePath = pathname

  if (first === 'de') {
    const slug = pathname.split('/')[2] || defaultTenant()
    tenant = (await tenantIndex()).find((item) => item.slug === slug)
    rewritePath = pathname.replace(/^\/de\/[^/]+/, '/de') || '/de'
  } else {
    const tenants = await tenantIndex()
    tenant = tenants.find((item) => item.slug === first)
    if (tenant) {
      rewritePath = `/de${pathname.slice(first.length + 1)}`
    } else {
      tenant = tenants.find((item) => item.slug === defaultTenant())
      rewritePath = `/de${pathname === '/' ? '' : pathname}`
    }
  }

  if (!tenant) return new NextResponse('Storefront not found', { status: 404 })
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-outlet-tenant', tenant.slug)
  requestHeaders.set('x-outlet-tenant-id', tenant.id)
  requestHeaders.set('x-outlet-tenant-name', tenant.name)
  requestHeaders.set('x-outlet-publishable-key', tenant.publishable_key)
  requestHeaders.set('x-outlet-channel', tenant.sales_channel_id)
  requestHeaders.set('x-outlet-region', tenant.region_id)

  const rewriteUrl = request.nextUrl.clone()
  rewriteUrl.pathname = rewritePath
  rewriteUrl.search = request.nextUrl.search
  const response = NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  })
  const cacheId = request.cookies.get('_medusa_cache_id')?.value || crypto.randomUUID()
  response.cookies.set('_medusa_cache_id', `${tenant.slug}-${cacheId}`, {
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
  })
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images|assets|.*\\..*).*)'],
}
