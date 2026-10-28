import { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import type { TenantModuleService } from "../modules/tenant/service"
import { TENANT_MODULE } from "../modules/tenant"

export type TenantRecord = {
  id: string
  slug: string
  name: string
  description: string
  sales_channel_id: string
  region_id: string
  publishable_key: string
  default_country: string
  status: "active" | "disabled"
}

export async function tenantFromScope(container: MedusaContainer): Promise<TenantRecord> {
  const tenantService = container.resolve<TenantModuleService>(TENANT_MODULE)
  const [tenant] = await tenantService.listTenants({ status: "active" }, { take: 1 })
  if (!tenant) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No active tenant is configured")
  }
  return tenant as TenantRecord
}

export async function tenantForUser(
  container: MedusaContainer,
  userId: string,
  requestedTenantId?: string
): Promise<TenantRecord> {
  const service = container.resolve<TenantModuleService>(TENANT_MODULE)
  const memberships = await service.listTenantMemberships({ user_id: userId })
  const membership = requestedTenantId
    ? memberships.find((item: { tenant_id: string }) => item.tenant_id === requestedTenantId)
    : memberships[0]
  if (!membership) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "User is not assigned to this tenant")
  }
  const tenant = await service.retrieveTenant(membership.tenant_id)
  if (tenant.status !== "active") {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Storefront not found")
  }
  return tenant as TenantRecord
}

export async function resolveTenant(req: {
  scope: MedusaContainer
  publishable_key_context?: { sales_channel_ids: string[] }
}): Promise<TenantRecord> {
  const channels = req.publishable_key_context?.sales_channel_ids ?? []
  if (channels.length !== 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A tenant publishable key must have exactly one sales channel"
    )
  }
  const tenantService = req.scope.resolve<TenantModuleService>(TENANT_MODULE)
  const [tenant] = await tenantService.listTenants({
    sales_channel_id: channels[0],
    status: "active",
  })
  if (!tenant) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Storefront not found")
  }
  return tenant as TenantRecord
}

export async function assertSellerInTenant(
  container: MedusaContainer,
  tenantId: string,
  sellerId: string
) {
  const service = container.resolve<TenantModuleService>(TENANT_MODULE)
  const [membership] = await service.listTenantSellers({ tenant_id: tenantId, seller_id: sellerId })
  if (!membership) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found")
  }
}

export async function assertTenantUser(
  container: MedusaContainer,
  tenantId: string,
  userId: string
) {
  const service = container.resolve<TenantModuleService>(TENANT_MODULE)
  const [membership] = await service.listTenantMemberships({ tenant_id: tenantId, user_id: userId })
  if (!membership) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "User is not assigned to this tenant")
  }
  return membership
}

export async function tenantTheme(container: MedusaContainer, tenant: TenantRecord) {
  const service = container.resolve<TenantModuleService>(TENANT_MODULE)
  const [theme] = await service.listTenantThemes({ tenant_id: tenant.id })
  const [page] = await service.listStorefrontPages({ tenant_id: tenant.id, slug: "home" })
  return { tenant, theme, page }
}
