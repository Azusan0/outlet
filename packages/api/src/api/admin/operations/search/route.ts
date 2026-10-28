import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { KnowledgeModuleService } from "../../../../modules/knowledge/service";
import { requireAdminTenant, sendRouteError } from "../../../../lib/ai/http";

type SearchBody = {
  query?: string;
  limit?: number;
};

function normalizedLimit(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed)
    ? Math.min(20, Math.max(1, Math.trunc(parsed)))
    : 5;
}

function validateQuery(value: unknown): string {
  const query = typeof value === "string" ? value.trim() : "";
  if (!query) throw new Error("Search query is required");
  if (query.length > 500)
    throw new Error("Search query must not exceed 500 characters");
  return query;
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  try {
    const { tenant } = await requireAdminTenant(req);
    const query = validateQuery(req.query.query);
    const service = req.scope.resolve<KnowledgeModuleService>("knowledge");
    const results = await service.searchKnowledge(
      tenant.id,
      query,
      normalizedLimit(req.query.limit),
    );
    res.json({ query, count: results.length, retrieval: "bm25", results });
  } catch (error) {
    sendRouteError(res, error);
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  try {
    const { tenant } = await requireAdminTenant(req);
    const body = (req.body ?? {}) as SearchBody;
    const query = validateQuery(body.query);
    const service = req.scope.resolve<KnowledgeModuleService>("knowledge");
    const results = await service.searchKnowledge(
      tenant.id,
      query,
      normalizedLimit(body.limit),
    );
    res.json({ query, count: results.length, retrieval: "bm25", results });
  } catch (error) {
    sendRouteError(res, error);
  }
}
