import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { TenantModuleService } from "../../../modules/tenant/service"

type Membership = {
  tenant_id: string
  role: string
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const userId = req.auth_context?.actor_id
  if (!userId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  const service = req.scope.resolve<TenantModuleService>("tenant")
  const memberships = (await service.listTenantMemberships({
    user_id: userId,
  })) as Membership[]
  const tenants = await Promise.all(
    memberships.map((membership) =>
      service.retrieveTenant(membership.tenant_id).catch(() => null)
    )
  )
  const roleByTenant = new Map(
    memberships.map((membership) => [membership.tenant_id, membership.role])
  )

  res.json({
    tenants: tenants
      .filter((tenant) => tenant && tenant.status === "active")
      .map((tenant) => ({
        id: tenant!.id,
        slug: tenant!.slug,
        name: tenant!.name,
        description: tenant!.description,
        status: tenant!.status,
        role: roleByTenant.get(tenant!.id) || "viewer",
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })
}
