import { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { TenantModuleService } from "../../../modules/tenant/service"

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const token = req.get("x-publishable-api-key")
  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: { token, type: "publishable", revoked_at: null },
  })
  if (!keys.length) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid bootstrap key")
  const service = req.scope.resolve<TenantModuleService>("tenant")
  const tenants = await service.listTenants({ status: "active" })
  res.json({ tenants })
}
