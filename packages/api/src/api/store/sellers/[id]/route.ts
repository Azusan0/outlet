import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { tenantSellerIds } from "../../../../lib/store-tenant-scope";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerIds = new Set(
    await tenantSellerIds(req.scope, req.context!.tenant),
  );
  if (!sellerIds.has(req.params.id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Seller not found");
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "seller",
    fields: req.queryConfig.fields,
    filters: { ...(req.filterableFields ?? {}), id: req.params.id },
  });
  const seller = data[0];
  if (!seller) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Seller not found");
  }
  res.json({ seller });
}
