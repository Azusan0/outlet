import {
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework"
import { authenticate } from "@medusajs/framework/http"
import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MedusaStoreRequest,
  PublishableKeyContext,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { assertSellerInTenant, resolveTenant, tenantForUser } from "../lib/tenant"
import type { TenantModuleService } from "../modules/tenant/service"

async function storeTenant(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const storeRequest = req as MedusaStoreRequest
  storeRequest.publishable_key_context ??= {} as PublishableKeyContext
  storeRequest.publishable_key_context.sales_channel_ids ??= []
  const tenant = await resolveTenant(storeRequest)
  req.context = { ...req.context, tenant }
  next()
}

// Mercur's shared catalog route needs the same sales-channel filter as
// Medusa's native route. Without it, offers alone do not bound product reads.
async function tenantOfferForCart(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const tenant = req.context?.tenant
  const body = (req.validatedBody || req.body) as { offer_id?: string; variant_id?: string } | undefined
  if (!body?.offer_id) {
    if (body && "variant_id" in body) {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: [variant] } = await query.graph({
        entity: "variant",
        fields: ["product.sellers.id"],
        filters: { id: body.variant_id! },
      })
      const sellerIds = (variant?.product?.sellers ?? []).flatMap((seller) => seller ? [seller.id] : [])
      for (const sellerId of sellerIds) {
        await assertSellerInTenant(req.scope, tenant.id, sellerId)
      }
    }
    return next()
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [offer] } = await query.graph({
    entity: "offer",
    fields: ["id", "seller_id", "product.sales_channels.id"],
    filters: { id: body.offer_id },
  })
  if (!offer) return next()
  await assertSellerInTenant(req.scope, tenant.id, offer.seller_id)
  if (
    !offer.product?.sales_channels?.some(
      (salesChannel) => salesChannel?.id === tenant.sales_channel_id
    )
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Resource not found")
  }
  next()
}

async function tenantCart(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (!req.params.id) return next()
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [cart] } = await query.graph({
    entity: "cart",
    fields: ["id", "sales_channel_id"],
    filters: { id: req.params.id },
  })
  if (!cart || cart.sales_channel_id !== req.context!.tenant.sales_channel_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }
  next()
}

async function vendorTenant(req: MedusaRequest & { seller_context?: { seller_id: string } }, _res: MedusaResponse, next: MedusaNextFunction) {
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return next()
  const tenantService = req.scope.resolve<TenantModuleService>("tenant")
  const [mapping] = await tenantService.listTenantSellers({ seller_id: sellerId })
  if (!mapping) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Seller not found")
  }
  const tenant = await tenantService.retrieveTenant(mapping.tenant_id)
  if (tenant.status !== "active") {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Seller not found")
  }
  req.context = { ...req.context, tenant }
  next()
}

const adminThemeBody = z.object({
  tenant_id: z.string().min(1),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  paper: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ink: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  announcement: z.string().max(240),
  page: z.object({
    eyebrow: z.string().max(100),
    headline: z.string().min(1).max(180),
    subheading: z.string().max(600),
    hero_image: z.string().max(1000),
  }),
})

async function tenantAdmin(req: AuthenticatedMedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const tenant = await tenantForUser(
    req.scope,
    req.auth_context!.actor_id,
    req.get("x-outlet-tenant-id")
  )
  req.context = { ...req.context, tenant }
  next()
}

async function operatorOnly(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const actorId = (req as AuthenticatedMedusaRequest).auth_context!.actor_id
  const service = req.scope.resolve<TenantModuleService>("tenant")
  const [membership] = await service.listTenantMemberships({
    tenant_id: req.context!.tenant.id,
    user_id: actorId,
  })
  if (membership.role === "viewer") {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Viewer role cannot modify tenant data")
  }
  next()
}

export default defineMiddlewares({
  routes: [
    { matcher: "/store/products*", method: ["GET"], middlewares: [storeTenant] },
    { matcher: "/store/offers*", method: ["GET"], middlewares: [storeTenant] },
    { matcher: "/store/sellers*", method: ["GET"], middlewares: [storeTenant] },
    { matcher: "/store/carts/:id/line-items", method: ["POST"], middlewares: [storeTenant, tenantCart, tenantOfferForCart] },
    { matcher: "/store/carts/:id/line-items/:line_id", method: ["POST", "DELETE"], middlewares: [storeTenant, tenantCart] },
    { matcher: "/store/carts/:id*", method: ["GET", "POST", "DELETE"], middlewares: [storeTenant, tenantCart] },
    { matcher: "/store/carts", method: ["GET", "POST"], middlewares: [storeTenant] },
    { matcher: "/store/order-groups*", method: ["GET"], middlewares: [storeTenant] },
    { matcher: "/store/storefront*", method: ["GET"], middlewares: [storeTenant] },
    { matcher: "/vendor/*", middlewares: [vendorTenant] },
    {
      matcher: "/admin/tenants",
      method: ["GET"],
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
    {
      matcher: "/admin/operations/*",
      middlewares: [authenticate("user", ["session", "bearer", "api-key"]), tenantAdmin],
    },
    {
      matcher: "/admin/operations/*",
      method: ["POST", "PUT", "PATCH", "DELETE"],
      middlewares: [operatorOnly],
    },
    {
      matcher: "/admin/tenant/storefront",
      method: ["GET", "POST"],
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"]),
        tenantAdmin,
      ],
    },
    {
      matcher: "/admin/tenant/storefront",
      method: ["POST"],
      middlewares: [validateAndTransformBody(adminThemeBody)],
    },
  ],
})
