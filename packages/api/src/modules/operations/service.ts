import { MedusaService } from "@medusajs/framework/utils"
import { AuditEvent, ImportBatch, SyncJob } from "./models/operations"

export class OperationsModuleService extends MedusaService({
  ImportBatch,
  SyncJob,
  AuditEvent,
}) {}

export default OperationsModuleService
