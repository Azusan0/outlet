import type {
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import {
  splitComputedOfferFields,
  type EnrichableOffer,
  wrapOffersWithCalculatedPrices,
  wrapOffersWithInventoryQuantityForSalesChannel,
  wrapOffersWithTaxPrices,
} from "@mercurjs/core/api/store/offers/helpers";
import {
  tenantProductIds,
  tenantSellerIds,
} from "../../../../lib/store-tenant-scope";

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const { fields, withCalculatedPrice, withInventoryQuantity } =
    splitComputedOfferFields(req.queryConfig.fields);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "offer",
    fields,
    filters: {
      ...(req.filterableFields ?? {}),
      id: req.params.id,
      product_id: await tenantProductIds(req.scope, req.context!.tenant),
      seller_id: await tenantSellerIds(req.scope, req.context!.tenant),
    },
  });
  const offer = data[0];
  if (!offer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Offer not found");
  }
  const offers = [offer] as unknown as EnrichableOffer[];
  if (withCalculatedPrice) {
    await wrapOffersWithCalculatedPrices(req, offers);
    await wrapOffersWithTaxPrices(req, offers);
  }
  if (withInventoryQuantity) {
    await wrapOffersWithInventoryQuantityForSalesChannel(req, offers);
  }
  res.json({ offer });
}
