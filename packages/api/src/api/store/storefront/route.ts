import { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { tenantTheme } from "../../../lib/tenant"

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const { tenant, theme, page } = await tenantTheme(req.scope, req.context!.tenant)
  res.json({ tenant, theme, page })
}
