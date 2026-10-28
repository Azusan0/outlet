import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { assertTenantUser, tenantTheme } from "../../../../lib/tenant"
import type { TenantModuleService } from "../../../../modules/tenant/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assertTenantUser(req.scope, req.context!.tenant.id, req.auth_context.actor_id)
  res.json(await tenantTheme(req.scope, req.context!.tenant))
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const tenant = req.context!.tenant
  const membership = await assertTenantUser(req.scope, tenant.id, req.auth_context.actor_id)
  if (membership.role === "viewer") {
    res.status(403).json({ message: "Viewer role cannot edit storefront settings" })
    return
  }
  const body = req.validatedBody as {
    tenant_id: string
    accent: string
    paper: string
    ink: string
    announcement: string
    page: { eyebrow: string; headline: string; subheading: string; hero_image: string }
  }
  if (body.tenant_id !== tenant.id) {
    res.status(404).json({ message: "Tenant not found" })
    return
  }
  const service = req.scope.resolve<TenantModuleService>("tenant")
  const [existing] = await service.listTenantThemes({ tenant_id: tenant.id })
  const theme = await service.updateTenantThemes({
    id: existing.id,
    accent: body.accent,
    paper: body.paper,
    ink: body.ink,
    announcement: body.announcement,
  })
  const [page] = await service.listStorefrontPages({ tenant_id: tenant.id, slug: "home" })
  await service.updateStorefrontPages({ id: page.id, ...body.page })
  if (process.env.STOREFRONT_REVALIDATE_URL && process.env.STOREFRONT_REVALIDATE_SECRET) {
    try {
      await fetch(`${process.env.STOREFRONT_REVALIDATE_URL.replace(/\/$/, "")}/api/revalidate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-revalidate-secret": process.env.STOREFRONT_REVALIDATE_SECRET,
        },
        body: JSON.stringify({ tags: ["products"], tenant: tenant.slug }),
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // Saving authoritative data must not roll back when the cache is down.
    }
  }
  res.json({ tenant, theme, page: await service.retrieveStorefrontPage(page.id) })
}
