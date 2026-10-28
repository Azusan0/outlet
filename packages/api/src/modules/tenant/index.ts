import { Module } from "@medusajs/framework/utils"
import TenantModuleService from "./service"

export type { TenantModuleService } from "./service"

export const TENANT_MODULE = "tenant"

export default Module(TENANT_MODULE, { service: TenantModuleService })
