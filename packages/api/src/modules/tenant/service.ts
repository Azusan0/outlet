import { MedusaService } from "@medusajs/framework/utils"
import {
  StorefrontPage,
  Tenant,
  TenantDomain,
  TenantMembership,
  TenantSeller,
  TenantTheme,
} from "./models/tenant"

export class TenantModuleService extends MedusaService({
  Tenant,
  TenantSeller,
  TenantDomain,
  TenantTheme,
  StorefrontPage,
  TenantMembership,
}) {}

export default TenantModuleService
