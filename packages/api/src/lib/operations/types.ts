export const IMPORT_OPERATIONS = [
  "update",
  "upsert",
  "create",
  "delete",
] as const

export type ImportOperation = (typeof IMPORT_OPERATIONS)[number]

export type OperationsField =
  | "sku"
  | "title"
  | "price"
  | "currency"
  | "stock"
  | "barcode"
  | "operation"

export type RowErrorCode =
  | "INVALID_FILE"
  | "INVALID_HEADER"
  | "REQUIRED"
  | "DUPLICATE_SKU"
  | "INVALID_NUMBER"
  | "INVALID_PRICE"
  | "INVALID_STOCK"
  | "INVALID_BARCODE"
  | "INVALID_OPERATION"
  | "DANGEROUS_FORMULA"
  | "UNSUPPORTED_OPERATION"
  | "SKU_NOT_FOUND"
  | "SKU_AMBIGUOUS"
  | "TENANT_MISMATCH"
  | "INVENTORY_LEVEL_NOT_FOUND"
  | "PRODUCT_UPDATE_FAILED"
  | "OFFER_UPDATE_FAILED"
  | "INVENTORY_UPDATE_FAILED"

export type RowError = {
  field: OperationsField | "file" | "row"
  code: RowErrorCode
  message: string
}

export type ParsedImportRow = {
  id: string
  row_number: number
  sku: string
  title: string
  price: number | null
  currency: string
  stock: number | null
  barcode: string
  operation: ImportOperation
  raw: Record<string, string | number | boolean | null>
  errors: RowError[]
}

export type ImportSummary = {
  total: number
  valid: number
  invalid: number
  error_count: number
}

export type ParsedSpreadsheet = {
  sheet_name: string
  headers: string[]
  mapping: Partial<Record<OperationsField, string>>
  rows: ParsedImportRow[]
  errors: RowError[]
  summary: ImportSummary
}

export type BatchRowResult = {
  row_id: string
  sku: string
  status: "updated" | "skipped" | "failed"
  product_id?: string
  variant_id?: string
  offer_ids?: string[]
  price_updated?: boolean
  stock_updated?: boolean
  error?: string
}

export type ImportCommitResult = {
  batch_id: string
  status: "committed" | "partial" | "failed"
  rows: BatchRowResult[]
  summary: {
    selected: number
    updated: number
    skipped: number
    failed: number
  }
}

export type ErpTarget = "stock" | "price" | "erp"
export type ErpMode = "dry_run" | "execute"

export type ErpItem = {
  row_id: string
  sku: string
  price?: number | null
  currency?: string
  stock?: number | null
  barcode?: string
}

export type ErpPreviewInput = {
  target: ErpTarget
  mode: ErpMode
  idempotency_key: string
  items: ErpItem[]
}

export type ErpRowResult = {
  row_id: string
  sku: string
  action: "would_update" | "updated" | "skipped" | "failed"
  changed_fields: string[]
  message: string
  remote_status?: number
  simulated?: boolean
}

export type ErpResult = {
  job_id: string
  target: ErpTarget
  mode: ErpMode
  idempotent_replay: boolean
  rows: ErpRowResult[]
  summary: {
    total: number
    changed: number
    skipped: number
    failed: number
  }
}
