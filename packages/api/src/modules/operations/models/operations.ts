import { model } from "@medusajs/framework/utils"

export const ImportBatch = model
  .define("operations_import_batch", {
    id: model.id({ prefix: "impbat" }).primaryKey(),
    tenant_id: model.text(),
    file_name: model.text(),
    file_sha256: model.text(),
    status: model
      .enum(["preview", "committed", "partial", "failed"])
      .default("preview"),
    rows_json: model.json(),
    errors_json: model.json(),
    summary_json: model.json(),
    result_json: model.json().nullable(),
    created_by: model.text(),
  })
  .indexes([
    { on: ["tenant_id", "created_at"] },
    { on: ["tenant_id", "file_sha256"] },
  ])

export const SyncJob = model
  .define("operations_sync_job", {
    id: model.id({ prefix: "syncjob" }).primaryKey(),
    tenant_id: model.text(),
    channel: model.enum(["stock", "price", "erp"]),
    mode: model.enum(["dry_run", "execute"]),
    status: model
      .enum(["preview", "running", "completed", "partial", "failed"])
      .default("preview"),
    idempotency_key: model.text(),
    request_json: model.json(),
    result_json: model.json().nullable(),
    error_message: model.text().nullable(),
    created_by: model.text(),
    completed_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["tenant_id", "idempotency_key"], unique: true },
    { on: ["tenant_id", "created_at"] },
  ])

export const AuditEvent = model
  .define("operations_audit_event", {
    id: model.id({ prefix: "audit" }).primaryKey(),
    tenant_id: model.text(),
    actor_id: model.text(),
    action: model.text(),
    resource_type: model.text(),
    resource_id: model.text().nullable(),
    status: model.enum(["preview", "success", "failure"]),
    details_json: model.json().nullable(),
    error_message: model.text().nullable(),
  })
  .indexes([
    { on: ["tenant_id", "created_at"] },
    { on: ["tenant_id", "resource_type", "resource_id"] },
  ])
