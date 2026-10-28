import type {
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { enrichProductAttributes } from "@mercurjs/core/api/utils/format-product-attributes";
import { wrapProductVariantsWithOfferPrice } from "@mercurjs/core/api/utils/offers";
import { splitComputedVariantFields } from "@mercurjs/core/api/store/products/helpers";
import {
  intersectFilter,
  tenantProductIds,
  tenantSellerIds,
} from "../../../lib/store-tenant-scope";

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const allowedProductIds = await tenantProductIds(req.scope, req.context!.tenant);
  let visibleProductIds = intersectFilter(
    allowedProductIds,
    req.filterableFields?.id,
  );

  const sellerFilter = req.query.seller_id;
  if (typeof sellerFilter === "string" || Array.isArray(sellerFilter)) {
    const allowedSellers = new Set(
      await tenantSellerIds(req.scope, req.context!.tenant),
    );
    const requestedSellers = (Array.isArray(sellerFilter)
      ? sellerFilter
      : [sellerFilter]
    ).filter((sellerId): sellerId is string =>
      typeof sellerId === "string" && allowedSellers.has(sellerId),
    );
    const { data: sellers } = await query.graph({
      entity: "seller",
      fields: ["products.id"],
      filters: { id: requestedSellers },
    });
    const sellerProducts = new Set(
      (sellers as { products?: { id: string }[] }[]).flatMap((seller) =>
        (seller.products ?? []).map((product) => product.id),
      ),
    );
    visibleProductIds = visibleProductIds.filter((id) => sellerProducts.has(id));
  }

  const { fields, withCalculatedPrice } = splitComputedVariantFields(
    req.queryConfig.fields,
  );
  req.queryConfig.fields = fields;
  const {
    region_id: _regionId,
    currency_code: _currencyCode,
    seller_id: _sellerId,
    ...productFilters
  } = req.filterableFields ?? {};
  const { data: products, metadata } = await query.graph({
    entity: "product",
    fields,
    filters: { ...productFilters, id: visibleProductIds },
    pagination: req.queryConfig.pagination,
  });

  await enrichProductAttributes(req.scope, products);
  if (withCalculatedPrice) {
    await wrapProductVariantsWithOfferPrice(req, products);
  }
  res.json({
    products,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  });
}
