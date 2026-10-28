import type {
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  splitComputedOfferFields,
  type EnrichableOffer,
  wrapOffersWithCalculatedPrices,
  wrapOffersWithInventoryQuantityForSalesChannel,
  wrapOffersWithTaxPrices,
} from "@mercurjs/core/api/store/offers/helpers";
import {
  intersectFilter,
  tenantProductIds,
  tenantSellerIds,
} from "../../../lib/store-tenant-scope";

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const productIds = intersectFilter(
    await tenantProductIds(req.scope, req.context!.tenant),
    req.filterableFields?.product_id,
  );
  const sellerIds = intersectFilter(
    await tenantSellerIds(req.scope, req.context!.tenant),
    req.filterableFields?.seller_id,
  );
  const { fields, withCalculatedPrice, withInventoryQuantity } =
    splitComputedOfferFields(req.queryConfig.fields);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: offers, metadata } = await query.graph({
    entity: "offer",
    fields,
    filters: {
      ...(req.filterableFields ?? {}),
      product_id: productIds,
      seller_id: sellerIds,
    },
    pagination: req.queryConfig.pagination,
  });
  const enrichableOffers = offers as unknown as EnrichableOffer[];
  if (withCalculatedPrice) {
    await wrapOffersWithCalculatedPrices(req, enrichableOffers);
    await wrapOffersWithTaxPrices(req, enrichableOffers);
  }
  if (withInventoryQuantity) {
    await wrapOffersWithInventoryQuantityForSalesChannel(req, enrichableOffers);
  }
  res.json({
    offers,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  });
}
