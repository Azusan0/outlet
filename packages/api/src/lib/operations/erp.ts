import { createHash } from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import type { TenantRecord } from "../tenant"
import type { OperationsModuleService } from "../../modules/operations/service"
import { commitImportRows, previewImportRows } from "./importer"
import type {
  ErpItem,
  ErpPreviewInput,
  ErpResult,
  ErpRowResult,
  ErpTarget,
  ParsedImportRow,
} from "./types"

const MAX_ERP_ITEMS = 500

function requestHash(input: ErpPreviewInput): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
}

function validateErpInput(input: unknown): ErpPreviewInput {
  if (typeof input !== "object" || input === null) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A JSON body is required"
    )
  }
  const body = input as Record<string, unknown>
  const target = body.target
  if (target !== "stock" && target !== "price" && target !== "erp") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "target must be stock, price or erp"
    )
  }
  if (body.mode !== "dry_run" && body.mode !== "execute") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "mode must be dry_run or execute"
    )
  }
  const idempotencyKey = body.idempotency_key
  if (
    typeof idempotencyKey !== "string" ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "idempotency_key is required and must contain only letters, numbers, dot, underscore, colon and hyphen"
    )
  }
  if (!Array.isArray(body.items) || body.items.length < 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "items must be a non-empty array"
    )
  }
  if (body.items.length > MAX_ERP_ITEMS) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `items cannot contain more than ${MAX_ERP_ITEMS} rows`
    )
  }

  const seen = new Set<string>()
  const items = body.items.map((raw, index): ErpItem => {
    if (typeof raw !== "object" || raw === null) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `items[${index}] must be an object`
      )
    }
    const item = raw as Record<string, unknown>
    const sku = typeof item.sku === "string" ? item.sku.trim() : ""
    if (!sku || sku.length > 160) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `items[${index}].sku is required and must be at most 160 characters`
      )
    }
    if (seen.has(sku.toUpperCase())) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Duplicate SKU in ERP request: ${sku}`
      )
    }
    seen.add(sku.toUpperCase())
    const rowId =
      typeof item.row_id === "string" && item.row_id.trim()
        ? item.row_id.trim()
        : `row_${index + 1}`
    const price =
      item.price === undefined || item.price === null
        ? null
        : Number(item.price)
    const stock =
      item.stock === undefined || item.stock === null
        ? null
        : Number(item.stock)
    if (price !== null && (!Number.isFinite(price) || price <= 0)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `items[${index}].price must be greater than 0`
      )
    }
    if (
      stock !== null &&
      (!Number.isSafeInteger(stock) || stock < 0)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `items[${index}].stock must be a non-negative integer`
      )
    }
    const currency =
      typeof item.currency === "string"
        ? item.currency.trim().toUpperCase()
        : "EUR"
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `items[${index}].currency must be a 3-letter ISO code`
      )
    }
    if (target === "price" && price === null) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `items[${index}].price is required for a price sync`
      )
    }
    if (target === "stock" && stock === null) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `items[${index}].stock is required for a stock sync`
      )
    }
    if (target === "erp" && price === null && stock === null) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `items[${index}] must include price or stock for an ERP sync`
      )
    }
    return {
      row_id: rowId,
      sku,
      price,
      currency,
      stock,
      ...(typeof item.barcode === "string"
        ? { barcode: item.barcode.trim() }
        : {}),
    }
  })

  return {
    target,
    mode: body.mode,
    idempotency_key: idempotencyKey,
    items,
  }
}

function toParsedRows(
  items: ErpItem[],
  target: ErpTarget
): ParsedImportRow[] {
  return items.map((item, index) => ({
    id: item.row_id || `row_${index + 1}`,
    row_number: index + 2,
    sku: item.sku,
    title: "",
    price: target === "stock" ? null : item.price ?? null,
    currency: item.currency ?? "EUR",
    stock: target === "price" ? null : item.stock ?? null,
    barcode: item.barcode ?? "",
    operation: "update",
    raw: {},
    errors: [],
  }))
}

function localRowsToErpResult(
  rows: Awaited<ReturnType<typeof previewImportRows>>,
  mode: "dry_run" | "execute",
  target: ErpTarget
): ErpRowResult[] {
  return rows.map((row) => ({
    row_id: row.row_id,
    sku: row.sku,
    action:
      row.status === "invalid"
        ? "failed"
        : mode === "dry_run"
          ? "would_update"
          : "updated",
    changed_fields:
      row.status === "invalid" || target === "erp"
        ? []
        : [target],
    message:
      row.status === "invalid"
        ? row.errors.map((error) => error.message).join("; ")
        : mode === "dry_run"
          ? "Validation passed; no data was written"
          : "Updated",
  }))
}

async function sendErpWebhook(
  tenant: TenantRecord,
  input: ErpPreviewInput,
  items: ErpItem[]
): Promise<ErpRowResult[]> {
  const simulate = process.env.ERP_SIMULATE === "true"
  const url = process.env.ERP_WEBHOOK_URL
  if (!url && simulate) {
    return items.map((item) => ({
      row_id: item.row_id,
      sku: item.sku,
      action: "updated",
      changed_fields: [
        ...(item.price != null ? ["price"] : []),
        ...(item.stock != null ? ["stock"] : []),
      ],
      message: "ERP_SIMULATE=true: request accepted by the simulation layer",
      remote_status: 202,
      simulated: true,
    }))
  }
  if (!url) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "ERP_WEBHOOK_URL is not configured; use mode=dry_run or set ERP_SIMULATE=true for a simulation"
    )
  }
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "ERP_WEBHOOK_URL is not a valid URL"
    )
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "ERP_WEBHOOK_URL must use http or https"
    )
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "idempotency-key": input.idempotency_key,
    "x-outlet-event": "operations.sync",
  }
  if (process.env.ERP_WEBHOOK_TOKEN) {
    headers.authorization = `Bearer ${process.env.ERP_WEBHOOK_TOKEN}`
  }
  let response: Response
  try {
    response = await fetch(parsedUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "operations.sync",
        tenant: tenant.slug,
        target: input.target,
        idempotency_key: input.idempotency_key,
        items,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `ERP webhook request failed: ${(error as Error).message}`
    )
  }
  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `ERP webhook returned HTTP ${response.status}`
    )
  }
  return items.map((item) => ({
    row_id: item.row_id,
    sku: item.sku,
    action: "updated",
    changed_fields: [
      ...(item.price != null ? ["price"] : []),
      ...(item.stock != null ? ["stock"] : []),
    ],
    message: `ERP webhook accepted the request with HTTP ${response.status}`,
    remote_status: response.status,
  }))
}

export async function previewErpSync(
  container: MedusaContainer,
  tenant: TenantRecord,
  body: unknown,
  actorId: string
): Promise<ErpResult> {
  const input = validateErpInput(body)
  const service = container.resolve<OperationsModuleService>("operations")
  const hash = requestHash(input)
  const [existing] = await service.listSyncJobs({
    tenant_id: tenant.id,
    idempotency_key: input.idempotency_key,
  })
  if (existing) {
    const stored = existing.request_json as { hash?: string }
    if (stored.hash !== hash) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "idempotency_key was already used with a different payload"
      )
    }
    if (existing.result_json) {
      return {
        ...(existing.result_json as Omit<ErpResult, "idempotent_replay">),
        idempotent_replay: true,
      }
    }
    if (existing.status === "running") {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "This idempotency_key is already running"
      )
    }
  }

  const job =
    existing ??
    (await service.createSyncJobs({
      tenant_id: tenant.id,
      channel: input.target,
      mode: input.mode,
      status: "running",
      idempotency_key: input.idempotency_key,
      request_json: { ...input, hash },
      result_json: null,
      error_message: null,
      created_by: actorId,
      completed_at: null,
    }))

  let rows: ErpRowResult[]
  try {
    if (input.target === "erp") {
      rows =
        input.mode === "dry_run"
          ? input.items.map((item) => ({
              row_id: item.row_id,
              sku: item.sku,
              action: "would_update",
              changed_fields: [
                ...(item.price != null ? ["price"] : []),
                ...(item.stock != null ? ["stock"] : []),
              ],
              message: "Validation passed; no remote request was sent",
            }))
          : await sendErpWebhook(tenant, input, input.items)
    } else {
      const parsedRows = toParsedRows(input.items, input.target)
      const local = await previewImportRows(container, tenant, parsedRows)
      if (input.mode === "dry_run") {
        rows = localRowsToErpResult(local, "dry_run", input.target)
      } else {
        const invalid = local.filter((row) => row.status === "invalid")
        if (invalid.length) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `ERP execute blocked for ${invalid.length} invalid rows`
          )
        }
        const committed = await commitImportRows(container, tenant, parsedRows)
        rows = committed.rows.map((row) => ({
          row_id: row.row_id,
          sku: row.sku,
          action:
            row.status === "updated"
              ? "updated"
              : row.status === "skipped"
                ? "skipped"
                : "failed",
          changed_fields: [
            ...(row.price_updated ? ["price"] : []),
            ...(row.stock_updated ? ["stock"] : []),
          ],
          message: row.error ?? "Updated",
        }))
      }
    }
  } catch (error) {
    const message = (error as Error).message
    await service.updateSyncJobs({
      id: job.id,
      status: "failed",
      error_message: message,
      completed_at: new Date(),
    })
    await service.createAuditEvents(
      input.items.map((item) => ({
        tenant_id: tenant.id,
        actor_id: actorId,
        action: "operations.erp.execute",
        resource_type: "sync_job",
        resource_id: job.id,
        status: "failure" as const,
        details_json: {
          target: input.target,
          row_id: item.row_id,
          sku: item.sku,
        },
        error_message: message,
      }))
    )
    throw error
  }

  const changed = rows.filter(
    (row) => row.action === "updated" || row.action === "would_update"
  ).length
  const failed = rows.filter((row) => row.action === "failed").length
  const skipped = rows.filter((row) => row.action === "skipped").length
  const status = failed
    ? changed
      ? "partial"
      : "failed"
    : input.mode === "dry_run"
      ? "preview"
      : "completed"
  const result: ErpResult = {
    job_id: job.id,
    target: input.target,
    mode: input.mode,
    idempotent_replay: false,
    rows,
    summary: { total: rows.length, changed, skipped, failed },
  }
  await service.updateSyncJobs({
    id: job.id,
    status,
    result_json: result,
    error_message: null,
    completed_at: new Date(),
  })
  await service.createAuditEvents(
    rows.map((row) => ({
      tenant_id: tenant.id,
      actor_id: actorId,
      action:
        input.mode === "dry_run"
          ? "operations.erp.preview"
          : "operations.erp.execute",
      resource_type: "sync_job",
      resource_id: job.id,
      status: (row.action === "failed"
        ? "failure"
        : input.mode === "dry_run"
          ? "preview"
          : "success") as "failure" | "preview" | "success",
      details_json: { target: input.target, row },
      error_message: row.action === "failed" ? row.message : null,
    }))
  )
  return result
}
