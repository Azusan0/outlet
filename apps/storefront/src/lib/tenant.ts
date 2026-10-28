import 'server-only'

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

export type Tenant = {
  id: string
  slug: string
  name: string
  description: string
  publishable_key: string
  sales_channel_id: string
  region_id: string
  default_country: string
}

export type StorefrontConfig = {
  tenant: Tenant
  theme: { accent: string; paper: string; ink: string; announcement: string }
  page: { eyebrow: string; headline: string; subheading: string; hero_image: string }
}

export type TenantDirectoryItem = {
  slug: string
  name: string
}

const backendUrl = () => process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'

export function tenantKey(tenant: Tenant) {
  return tenant.publishable_key
}

export async function getTenant(): Promise<Tenant> {
  const requestHeaders = await headers()
  const id = requestHeaders.get('x-outlet-tenant-id')
  const slug = requestHeaders.get('x-outlet-tenant')
  if (!id || !slug) notFound()
  return {
    id,
    slug,
    name: requestHeaders.get('x-outlet-tenant-name') || slug,
    description: '',
    publishable_key: requestHeaders.get('x-outlet-publishable-key') || '',
    sales_channel_id: requestHeaders.get('x-outlet-channel') || '',
    region_id: requestHeaders.get('x-outlet-region') || '',
    default_country: 'de',
  }
}

export async function getTenantDirectory(): Promise<TenantDirectoryItem[]> {
  const tenant = await getTenant()
  try {
    const response = await fetch(`${backendUrl()}/store/tenants`, {
      headers: { 'x-publishable-api-key': tenantKey(tenant) },
      cache: 'no-store',
    })
    if (!response.ok) return [{ slug: tenant.slug, name: tenant.name }]
    const body = (await response.json()) as {
      tenants?: Array<{ slug?: string; name?: string; status?: string }>
    }
    const items = (body.tenants || [])
      .filter((item) => item.slug && item.name && item.status === 'active')
      .map((item) => ({ slug: item.slug!, name: item.name! }))
    return items.some((item) => item.slug === tenant.slug)
      ? items
      : [{ slug: tenant.slug, name: tenant.name }, ...items]
  } catch {
    return [{ slug: tenant.slug, name: tenant.name }]
  }
}

export async function getStorefrontConfig(): Promise<StorefrontConfig> {
  const tenant = await getTenant()
  try {
    const response = await fetch(`${backendUrl()}/store/storefront`, {
      headers: { 'x-publishable-api-key': tenantKey(tenant) },
      cache: 'no-store',
    })
    if (response.ok) return response.json()
  } catch {
    // Keep the storefront renderable while the API container is restarting.
  }

  return {
    tenant,
    theme: {
      accent: '#ed4c2d',
      paper: '#f3f0e8',
      ink: '#20211e',
      announcement: `${tenant.name.toUpperCase()} / INDEPENDENT SELLERS / ONE CHECKOUT`,
    },
    page: {
      eyebrow: 'THE INDEPENDENT EDIT',
      headline: `Selected by\n${tenant.name}.`,
      subheading:
        'A considered marketplace of new, nearly-new and hard-to-find pieces from independent sellers.',
      hero_image: '/images/hero/Image.jpg',
    },
  }
}
