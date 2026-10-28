import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireOperationsTenant, type OperationsRequest } from "../../../../lib/operations/request"
import type { OperationsModuleService } from "../../../../modules/operations/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const tenant = requireOperationsTenant(req as OperationsRequest)
  const service = req.scope.resolve<OperationsModuleService>("operations")
  const events = await service.listAuditEvents(
    { tenant_id: tenant.id },
    { order: { created_at: "DESC" }, take: Math.min(Number(req.query.limit) || 50, 200) }
  )
  res.json({ events })
}
