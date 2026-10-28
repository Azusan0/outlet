import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { KnowledgeModuleService } from "../../../../../modules/knowledge/service";
import {
  requireAdminTenant,
  requireOperator,
  sendRouteError,
} from "../../../../../lib/ai/http";

export async function DELETE(
  req: AuthenticatedMedusaRequest<Record<string, never>, { id: string }>,
  res: MedusaResponse,
) {
  try {
    const { tenant, membership } = await requireAdminTenant(req);
    requireOperator(membership.role);
    const service = req.scope.resolve<KnowledgeModuleService>("knowledge");
    await service.removeDocument(tenant.id, req.params.id);
    res.status(204).end();
  } catch (error) {
    sendRouteError(res, error);
  }
}
