import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { TENANT_MODULE } from "../modules/tenant"
import type { TenantModuleService } from "../modules/tenant/service"

export type TenantSeed = {
  slug: string
  name: string
  description: string
  regionId: string
  salesChannelId: string
  publishableKey: string
  sellerIds: string[]
  theme: { accent: string; paper: string; ink: string; announcement: string }
  page: { eyebrow: string; headline: string; subheading: string; hero_image: string }
}

export async function provisionTenant(container: MedusaContainer, input: TenantSeed) {
  const service = container.resolve<TenantModuleService>(TENANT_MODULE)
  const [existing] = await service.listTenants({ slug: input.slug })
  const values = {
    slug: input.slug,
    name: input.name,
    description: input.description,
    region_id: input.regionId,
    sales_channel_id: input.salesChannelId,
    publishable_key: input.publishableKey,
    default_country: "de",
  }
  const tenant = existing
    ? await service.updateTenants({ id: existing.id, ...values })
    : await service.createTenants(values)

  for (const sellerId of input.sellerIds) {
    const [mapping] = await service.listTenantSellers({ seller_id: sellerId })
    if (mapping && mapping.tenant_id !== tenant.id) {
      throw new Error(`Seller ${sellerId} already belongs to another tenant`)
    }
    if (!mapping) await service.createTenantSellers({ tenant_id: tenant.id, seller_id: sellerId })
  }

  const [theme] = await service.listTenantThemes({ tenant_id: tenant.id })
  if (theme) await service.updateTenantThemes({ id: theme.id, ...input.theme })
  else await service.createTenantThemes({ tenant_id: tenant.id, ...input.theme })

  const [page] = await service.listStorefrontPages({ tenant_id: tenant.id, slug: "home" })
  if (page) await service.updateStorefrontPages({ id: page.id, ...input.page })
  else await service.createStorefrontPages({ tenant_id: tenant.id, slug: "home", ...input.page })

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: users } = await query.graph({ entity: "user", fields: ["id", "email"] })
  for (const user of users as { id: string; email?: string }[]) {
    const demoEmail = process.env.DEMO_ADMIN_EMAIL
    if (demoEmail && user.email?.toLowerCase() !== demoEmail.toLowerCase()) continue
    const [membership] = await service.listTenantMemberships({ tenant_id: tenant.id, user_id: user.id })
    if (!membership) {
      await service.createTenantMemberships({ tenant_id: tenant.id, user_id: user.id, role: "owner" })
    }
  }
  return tenant
}
