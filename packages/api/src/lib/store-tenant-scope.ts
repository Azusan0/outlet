import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { TenantRecord } from "./tenant";
import type { TenantModuleService } from "../modules/tenant/service";

export async function tenantProductIds(
  container: MedusaContainer,
  tenant: TenantRecord,
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "product_sales_channel",
    fields: ["product_id"],
    filters: { sales_channel_id: [tenant.sales_channel_id] },
  });
  return [
    ...new Set(
      (data as { product_id: string }[]).map((link) => link.product_id),
    ),
  ];
}

export async function tenantSellerIds(
  container: MedusaContainer,
  tenant: TenantRecord,
) {
  const service = container.resolve<TenantModuleService>("tenant");
  const mappings = await service.listTenantSellers({ tenant_id: tenant.id });
  return mappings.map((mapping: { seller_id: string }) => mapping.seller_id);
}

export function intersectFilter(
  allowedValues: string[],
  requested: unknown,
) {
  if (
    typeof requested !== "string" &&
    !(
      Array.isArray(requested) &&
      requested.every((value) => typeof value === "string")
    )
  ) {
    return allowedValues;
  }
  const allowed = new Set(allowedValues);
  const requestedValues = Array.isArray(requested) ? requested : [requested];
  return requestedValues.filter(
    (value): value is string =>
      typeof value === "string" && allowed.has(value),
  );
}
