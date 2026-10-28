import type {
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { enrichProductAttributes } from "@mercurjs/core/api/utils/format-product-attributes";
import { wrapProductVariantsWithOfferPrice } from "@mercurjs/core/api/utils/offers";
import { splitComputedVariantFields } from "@mercurjs/core/api/store/products/helpers";
import { tenantProductIds } from "../../../../lib/store-tenant-scope";

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const allowed = new Set(
    await tenantProductIds(req.scope, req.context!.tenant),
  );
  if (!allowed.has(req.params.id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found");
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { fields, withCalculatedPrice } = splitComputedVariantFields(
    req.queryConfig.fields,
  );
  req.queryConfig.fields = fields;
  const {
    region_id: _regionId,
    currency_code: _currencyCode,
    ...productFilters
  } = req.filterableFields ?? {};
  const { data } = await query.graph({
    entity: "product",
    fields,
    filters: { ...productFilters, id: req.params.id },
  });
  const product = data[0];
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found");
  }

  await enrichProductAttributes(req.scope, [product]);
  if (withCalculatedPrice) {
    await wrapProductVariantsWithOfferPrice(req, [product]);
  }
  res.json({ product });
}
