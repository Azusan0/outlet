import { Module } from "@medusajs/framework/utils"
import OperationsModuleService from "./service"

export type { OperationsModuleService } from "./service"

export const OPERATIONS_MODULE = "operations"

export default Module(OPERATIONS_MODULE, { service: OperationsModuleService })
