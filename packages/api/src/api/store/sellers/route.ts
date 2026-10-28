import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  intersectFilter,
  tenantSellerIds,
} from "../../../lib/store-tenant-scope";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerIds = intersectFilter(
    await tenantSellerIds(req.scope, req.context!.tenant),
    req.filterableFields?.id,
  );
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: sellers, metadata } = await query.graph({
    entity: "seller",
    fields: req.queryConfig.fields,
    filters: { ...(req.filterableFields ?? {}), id: sellerIds },
    pagination: req.queryConfig.pagination,
  });
  res.json({
    sellers,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  });
}
