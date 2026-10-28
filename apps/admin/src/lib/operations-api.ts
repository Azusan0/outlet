import { getAuthHeaders } from "@mercurjs/admin"
import { client } from "./client"

declare const __BACKEND_URL__: string

type QueryCall<T> = (
  input?: Record<string, unknown> & { fetchOptions?: RequestInit }
) => Promise<T>

type MutationCall<T> = (
  input: Record<string, unknown> & { fetchOptions?: RequestInit }
) => Promise<T>

type PlannedOperationsClient = {
  admin: {
    tenant: {
      storefront: {
        query: QueryCall<unknown>
        mutate: MutationCall<unknown>
      }
    }
    operations: {
      import: {
        preview: { mutate: MutationCall<unknown> }
        commit: { mutate: MutationCall<unknown> }
      }
      documents: {
        query: QueryCall<unknown>
        mutate: MutationCall<unknown>
      }
      search: { mutate: MutationCall<unknown> }
      erp: {
        preview: { mutate: MutationCall<unknown> }
        execute: { mutate: MutationCall<unknown> }
      }
      audit: { query: QueryCall<unknown> }
    }
  }
}

const operationsSdk = client as unknown as PlannedOperationsClient

export type TenantSummary = {
  id: string
  slug: string
  name: string
  description: string
  status: string
}

export type TenantOption = TenantSummary & {
  role: string
}

export type StorefrontTheme = {
  id?: string
  tenant_id?: string
  accent: string
  paper: string
  ink: string
  announcement: string
}

export type StorefrontPage = {
  id?: string
  tenant_id?: string
  slug: string
  eyebrow: string
  headline: string
  subheading: string
  hero_image: string
  config?: unknown
}

export type StorefrontResponse = {
  tenant: TenantSummary
  theme: StorefrontTheme
  page: StorefrontPage
}

export type SaveStorefrontInput = {
  tenant_id: string
  accent: string
  paper: string
  ink: string
  announcement: string
  page: {
    eyebrow: string
    headline: string
    subheading: string
    hero_image: string
  }
}

export type ImportRowStatus = "valid" | "warning" | "invalid" | "unknown"

export type ImportIssue = {
  field: string
  code: string
  message: string
}

export type ImportPreviewRow = {
  key: string
  rowId: string
  rowNumber: number
  status: ImportRowStatus
  errors: ImportIssue[]
  warnings: ImportIssue[]
  values: Record<string, unknown>
  raw: Record<string, unknown>
}

export type ImportPreview = {
  batchId: string
  fileName: string
  headers: string[]
  mapping: Record<string, string>
  rows: ImportPreviewRow[]
  summary: {
    total: number
    valid: number
    warning: number
    invalid: number
  }
  globalErrors: ImportIssue[]
  warnings: ImportIssue[]
}

export type ImportCommitResult = {
  imported: number
  skipped: number
  failed: number
  message: string
  raw: unknown
}

export type KnowledgeDocument = {
  id: string
  title: string
  content: string
  status: string
  updated_at: string
  chunk_count?: number
}

export type SearchHit = {
  id: string
  documentId: string
  title: string
  snippet: string
  score?: number
  metadata: Record<string, unknown>
}

export type ErpTarget = "stock" | "price" | "erp"

export type ErpItemInput = {
  row_id: string
  sku: string
  price: number
  stock: number
  currency: string
}

export type ErpRequest = {
  target: ErpTarget
  idempotency_key: string
  items: ErpItemInput[]
}

export type ErpRowResult = {
  rowId: string
  sku: string
  price?: number
  stock?: number
  currency: string
  status: string
  message: string
  before?: unknown
  after?: unknown
}

export type ErpPreview = {
  jobId: string
  summary: Record<string, unknown>
  rows: ErpRowResult[]
  raw: unknown
}

export type ErpExecuteResult = {
  jobId: string
  message: string
  summary: Record<string, unknown>
  rows: ErpRowResult[]
  raw: unknown
}

export type AuditEvent = {
  id: string
  action: string
  status: string
  actor: string
  target: string
  createdAt: string
  durationMs?: number
  detail: Record<string, unknown>
}

export type AgentToolTrace = {
  id: string
  name: string
  status: "running" | "completed" | "error"
  input?: unknown
  output?: unknown
  error?: string
}

export type AgentStreamEvent =
  | { type: "message"; text: string }
  | { type: "tool"; tool: AgentToolTrace }
  | { type: "error"; message: string }
  | { type: "done" }

type RecordLike = Record<string, unknown>

const DEFAULT_THEME: StorefrontTheme = {
  accent: "#df4b2b",
  paper: "#f4f0e7",
  ink: "#1d2822",
  announcement: "",
}

const DEFAULT_PAGE: StorefrontPage = {
  slug: "home",
  eyebrow: "NEW SEASON / 2026",
  headline: "为日常留一点锋芒",
  subheading: "多品牌精选、独立库存与快速履约。",
  hero_image: "",
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): RecordLike {
  return isRecord(value) ? value : {}
}

function firstArray(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) return value
  }
  return []
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return ""
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return undefined
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => stringValue(item))
      .map((item) => item.trim())
      .filter(Boolean)
  }
  const text = stringValue(value)
  return text
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toIssue(value: unknown): ImportIssue | null {
  if (typeof value === "string") {
    const message = value.trim()
    return message ? { field: "", code: "", message } : null
  }
  if (!isRecord(value)) return null
  const message = stringValue(value.message, value.detail, value.error)
  const code = stringValue(value.code, value.type)
  const field = stringValue(value.field, value.path, value.property)
  if (!message && !code && !field) return null
  return { field, code, message }
}

function normalizeIssues(value: unknown): ImportIssue[] {
  if (Array.isArray(value)) {
    return value
      .map(toIssue)
      .filter((item): item is ImportIssue => Boolean(item))
  }
  const issue = toIssue(value)
  return issue ? [issue] : []
}

export function formatImportIssue(issue: ImportIssue): string {
  const field = issue.field ? `${issue.field}: ` : ""
  const code = issue.code ? ` [${issue.code}]` : ""
  return `${field}${issue.message || "未提供错误详情"}${code}`
}

function normalizeStatus(value: unknown): ImportRowStatus {
  const status = stringValue(value).toLowerCase()
  if (["valid", "ok", "ready", "success"].includes(status)) return "valid"
  if (["warning", "warn", "review"].includes(status)) return "warning"
  if (["invalid", "error", "failed", "blocked"].includes(status)) return "invalid"
  return "unknown"
}

function pickValues(row: RecordLike): Record<string, unknown> {
  if (isRecord(row.values)) return row.values
  if (isRecord(row.data)) return row.data
  const meta = new Set([
    "id",
    "key",
    "row",
    "row_number",
    "rowNumber",
    "status",
    "errors",
    "warnings",
    "message",
    "values",
    "data",
  ])
  return Object.fromEntries(Object.entries(row).filter(([key]) => !meta.has(key)))
}

function extractErrorMessage(value: unknown, depth = 0): string {
  if (depth > 4 || value === null || value === undefined) return ""
  if (typeof value === "string") {
    const text = value.trim()
    if (!text) return ""
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        return extractErrorMessage(JSON.parse(text), depth + 1) || text
      } catch {
        return text
      }
    }
    return text
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => extractErrorMessage(item, depth + 1))
      .filter(Boolean)
      .join("；")
  }
  if (isRecord(value)) {
    const direct = stringValue(
      value.message,
      value.error,
      value.detail,
      value.reason,
      value.description
    )
    if (direct) return direct
    const nested = extractErrorMessage(
      value.errors ?? value.issues ?? value.cause ?? value.data,
      depth + 1
    )
    if (nested) return nested
  }
  return ""
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return extractErrorMessage(error.message) || "请求失败，请稍后重试。"
  }
  return extractErrorMessage(error) || "请求失败，请稍后重试。"
}

export function normalizeStorefront(raw: unknown): StorefrontResponse {
  const root = asRecord(raw)
  const tenant = asRecord(root.tenant)
  const theme = asRecord(root.theme)
  const page = asRecord(root.page)

  return {
    tenant: {
      id: stringValue(tenant.id),
      slug: stringValue(tenant.slug),
      name: stringValue(tenant.name, tenant.slug, "当前租户"),
      description: stringValue(tenant.description),
      status: stringValue(tenant.status, "active"),
    },
    theme: {
      id: stringValue(theme.id) || undefined,
      tenant_id: stringValue(theme.tenant_id) || undefined,
      accent: stringValue(theme.accent, DEFAULT_THEME.accent),
      paper: stringValue(theme.paper, DEFAULT_THEME.paper),
      ink: stringValue(theme.ink, DEFAULT_THEME.ink),
      announcement: stringValue(theme.announcement),
    },
    page: {
      id: stringValue(page.id) || undefined,
      tenant_id: stringValue(page.tenant_id) || undefined,
      slug: stringValue(page.slug, DEFAULT_PAGE.slug),
      eyebrow: stringValue(page.eyebrow, DEFAULT_PAGE.eyebrow),
      headline: stringValue(page.headline, DEFAULT_PAGE.headline),
      subheading: stringValue(page.subheading, DEFAULT_PAGE.subheading),
      hero_image: stringValue(page.hero_image),
      config: page.config,
    },
  }
}

export function normalizeImportPreview(raw: unknown, fallbackFileName = ""): ImportPreview {
  const root = asRecord(raw)
  const preview = asRecord(root.preview)
  const data = asRecord(root.data)
  const rawRows = firstArray(root.rows, root.items, preview.rows, data.rows)
  const rows: ImportPreviewRow[] = rawRows.map((item, index) => {
    const row = asRecord(item)
    const errors = normalizeIssues(row.errors)
    const warnings = normalizeIssues(row.warnings)
    const status = normalizeStatus(
      row.status ?? (errors.length > 0 ? "invalid" : warnings.length > 0 ? "warning" : "valid")
    )
    const rowNumber =
      numberValue(row.row_number, row.rowNumber, row.row, index + 1) ?? index + 1
    const rowId = stringValue(row.row_id, row.rowId, row.id, row.key, `${rowNumber}-${index}`)
    return {
      key: rowId,
      rowId,
      rowNumber,
      status,
      errors,
      warnings,
      values: pickValues(row),
      raw: row,
    }
  })
  const mappingValue = root.mapping ?? root.column_mapping ?? preview.mapping
  const mapping = isRecord(mappingValue)
    ? Object.fromEntries(
        Object.entries(mappingValue).map(([key, value]) => [key, stringValue(value)])
      )
    : {}
  const summaryValue = asRecord(root.summary ?? preview.summary)

  return {
    batchId: stringValue(
      root.batch_id,
      root.batchId,
      preview.batch_id,
      preview.batchId,
      data.batch_id
    ),
    fileName: stringValue(root.file_name, root.fileName, preview.file_name, fallbackFileName),
    headers: normalizeTags(root.headers ?? preview.headers),
    mapping,
    rows,
    summary: {
      total: numberValue(summaryValue.total, summaryValue.rows, rows.length) ?? rows.length,
      valid:
        numberValue(summaryValue.valid, summaryValue.valid_rows) ??
        rows.filter((row) => row.status === "valid").length,
      warning:
        numberValue(summaryValue.warning, summaryValue.warnings) ??
        rows.filter((row) => row.status === "warning").length,
      invalid:
        numberValue(summaryValue.invalid, summaryValue.errors) ??
        rows.filter((row) => row.status === "invalid").length,
    },
    globalErrors: normalizeIssues(
      root.errors ?? root.global_errors ?? preview.errors ?? data.errors
    ),
    warnings: normalizeIssues(root.warnings ?? preview.warnings ?? data.warnings),
  }
}

export function normalizeImportResult(raw: unknown): ImportCommitResult {
  const root = asRecord(raw)
  const result = asRecord(root.result ?? root.data)
  return {
    imported: numberValue(result.imported, result.created, result.updated, root.imported) ?? 0,
    skipped: numberValue(result.skipped, root.skipped) ?? 0,
    failed: numberValue(result.failed, result.errors, root.failed) ?? 0,
    message: stringValue(
      result.message,
      root.message,
      "导入任务已提交，可在审计记录中查看结果。"
    ),
    raw,
  }
}

export function normalizeDocuments(raw: unknown): KnowledgeDocument[] {
  const root = asRecord(raw)
  const data = asRecord(root.data)
  return firstArray(root.documents, root.items, root.results, data.documents).map((item) => {
    const document = asRecord(item)
    return {
      id: stringValue(document.id, document.document_id),
      title: stringValue(document.title, document.name, "未命名资料"),
      content: stringValue(document.content, document.text, document.body),
      status: stringValue(document.status, "ready"),
      updated_at: stringValue(
        document.updated_at,
        document.updatedAt,
        document.created_at
      ),
      chunk_count: numberValue(document.chunk_count, document.chunks),
    }
  })
}

export function normalizeSearchHits(raw: unknown): SearchHit[] {
  const root = asRecord(raw)
  const data = asRecord(root.data)
  return firstArray(root.results, root.hits, root.matches, root.items, data.results).map(
    (item, index) => {
      const hit = asRecord(item)
      const document = asRecord(hit.document)
      return {
        id: stringValue(hit.id, hit.chunk_id, `${index}`),
        documentId: stringValue(hit.document_id, document.id, hit.source_id),
        title: stringValue(hit.title, document.title, hit.source, "未命名片段"),
        snippet: stringValue(
          hit.snippet,
          hit.content,
          hit.text,
          hit.chunk,
          document.content
        ),
        score: numberValue(hit.score, hit.similarity, hit.rank),
        metadata: asRecord(hit.metadata),
      }
    }
  )
}

function normalizeErpRows(value: unknown): ErpRowResult[] {
  return (Array.isArray(value) ? value : []).map((item, index) => {
    const row = asRecord(item)
    return {
      rowId: stringValue(row.row_id, row.rowId, row.id, `${index}`),
      sku: stringValue(row.sku, row.SKU, row.code),
      price: numberValue(row.price),
      stock: numberValue(row.stock, row.inventory, row.quantity),
      currency: stringValue(row.currency, "EUR"),
      status: stringValue(row.status, row.result, "pending"),
      message: stringValue(row.message, row.detail, row.error),
      before: row.before,
      after: row.after,
    }
  })
}

export function normalizeErpPreview(raw: unknown): ErpPreview {
  const root = asRecord(raw)
  const preview = asRecord(root.preview)
  const data = asRecord(root.data)
  const summaryValue = asRecord(root.summary ?? preview.summary ?? data.summary)

  return {
    jobId: stringValue(root.job_id, root.jobId, preview.job_id, data.job_id),
    summary: summaryValue,
    rows: normalizeErpRows(firstArray(root.rows, preview.rows, data.rows)),
    raw,
  }
}

export function normalizeErpResult(raw: unknown): ErpExecuteResult {
  const root = asRecord(raw)
  const result = asRecord(root.result ?? root.data)
  const summaryValue = asRecord(root.summary ?? result.summary)
  return {
    jobId: stringValue(root.job_id, root.jobId, result.job_id),
    message: stringValue(result.message, root.message, "ERP 同步已完成。"),
    summary: summaryValue,
    rows: normalizeErpRows(firstArray(root.rows, result.rows)),
    raw,
  }
}

function parseDetail(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value
  if (typeof value !== "string" || !value.trim()) return {}
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return { raw: value }
  }
}

export function normalizeAuditEvents(raw: unknown): AuditEvent[] {
  const root = asRecord(raw)
  const data = asRecord(root.data)
  return firstArray(root.events, root.logs, root.audit, root.items, data.events).map(
    (item, index) => {
      const event = asRecord(item)
      return {
        id: stringValue(event.id, `${index}`),
        action: stringValue(event.action, event.event, event.type, "unknown"),
        status: stringValue(event.status, event.result, "unknown"),
        actor: stringValue(event.actor, event.actor_id, event.user_id, "system"),
        target: stringValue(
          event.target,
          event.resource,
          event.entity_id,
          event.target_id,
          "—"
        ),
        createdAt: stringValue(
          event.created_at,
          event.createdAt,
          event.timestamp,
          event.occurred_at
        ),
        durationMs: numberValue(event.duration_ms, event.durationMs, event.duration),
        detail: parseDetail(
          event.details_json ?? event.details ?? event.detail ?? event.metadata
        ),
      }
    }
  )
}

export async function getStorefront(): Promise<StorefrontResponse> {
  return normalizeStorefront(
    await operationsSdk.admin.tenant.storefront.query({
      fetchOptions: tenantFetchOptions(),
    })
  )
}

export async function saveStorefront(
  input: SaveStorefrontInput
): Promise<StorefrontResponse> {
  return normalizeStorefront(
    await operationsSdk.admin.tenant.storefront.mutate({
      ...input,
      fetchOptions: tenantFetchOptions(),
    })
  )
}

let activeTenantId = ""

export function setActiveTenantId(tenantId: string) {
  activeTenantId = tenantId
}

export function getActiveTenantId() {
  return activeTenantId
}

function tenantFetchOptions(options: RequestInit = {}): RequestInit {
  const headers = new Headers(options.headers)
  if (activeTenantId) headers.set("x-outlet-tenant-id", activeTenantId)
  return { ...options, headers }
}

function tenantRequestHeaders(): Record<string, string> {
  return {
    ...getAuthHeaders(),
    ...(activeTenantId ? { "x-outlet-tenant-id": activeTenantId } : {}),
  }
}

export async function listTenants(): Promise<TenantOption[]> {
  const response = await fetch(backendUrl("/admin/tenants"), {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
    },
  })
  if (!response.ok) throw await responseError(response)
  const payload = asRecord(await response.json())
  return firstArray(payload.tenants).map((item) => {
    const tenant = asRecord(item)
    return {
      id: stringValue(tenant.id),
      slug: stringValue(tenant.slug),
      name: stringValue(tenant.name, tenant.slug, "当前租户"),
      description: stringValue(tenant.description),
      status: stringValue(tenant.status, "active"),
      role: stringValue(tenant.role, "viewer"),
    }
  })
}

export async function previewImport(file: File): Promise<ImportPreview> {
  const body = new FormData()
  body.append("file", file)
  const response = await fetch(backendUrl("/admin/operations/import/preview"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...tenantRequestHeaders(),
    },
    body,
  })
  if (!response.ok) throw await responseError(response)
  return normalizeImportPreview(await response.json(), file.name)
}

export async function commitImport(
  batchId: string,
  rowIds: string[]
): Promise<ImportCommitResult> {
  return normalizeImportResult(
    await operationsSdk.admin.operations.import.commit.mutate({
      batch_id: batchId,
      row_ids: rowIds,
      fetchOptions: tenantFetchOptions(),
    })
  )
}

export async function listDocuments(): Promise<KnowledgeDocument[]> {
  return normalizeDocuments(
    await operationsSdk.admin.operations.documents.query({
      fetchOptions: tenantFetchOptions(),
    })
  )
}

export async function createDocument(input: {
  title: string
  text: string
}): Promise<KnowledgeDocument | null> {
  const raw = await operationsSdk.admin.operations.documents.mutate({
    title: input.title,
    text: input.text,
    fetchOptions: tenantFetchOptions(),
  })
  return normalizeDocuments({ documents: [asRecord(raw).document ?? raw] })[0] ?? null
}

export async function searchKnowledge(input: {
  query: string
  limit?: number
}): Promise<SearchHit[]> {
  return normalizeSearchHits(
    await operationsSdk.admin.operations.search.mutate({
      query: input.query,
      limit: input.limit ?? 8,
      fetchOptions: tenantFetchOptions(),
    })
  )
}

export async function previewErp(input: ErpRequest): Promise<ErpPreview> {
  return normalizeErpPreview(
    await operationsSdk.admin.operations.erp.preview.mutate({
      ...input,
      fetchOptions: tenantFetchOptions(),
    })
  )
}

export async function executeErp(input: ErpRequest): Promise<ErpExecuteResult> {
  return normalizeErpResult(
    await operationsSdk.admin.operations.erp.execute.mutate({
      ...input,
      fetchOptions: tenantFetchOptions(),
    })
  )
}

export async function listAuditEvents(limit = 30): Promise<AuditEvent[]> {
  return normalizeAuditEvents(
    await operationsSdk.admin.operations.audit.query({
      limit,
      fetchOptions: tenantFetchOptions(),
    })
  )
}

function backendUrl(path: string): string {
  const base = new URL(__BACKEND_URL__ || "/", window.location.origin)
  const basePath = base.pathname.replace(/\/+$/, "")
  base.pathname = `${basePath}/${path.replace(/^\/+/, "")}`
  base.search = ""
  base.hash = ""
  return base.toString()
}

async function responseError(response: Response): Promise<Error> {
  const text = await response.text().catch(() => "")
  if (text) {
    try {
      const body: unknown = JSON.parse(text)
      const message =
        extractErrorMessage(body) || response.statusText || `请求失败（${response.status}）`
      return new Error(message)
    } catch {
      return new Error(text)
    }
  }
  return new Error(`请求失败（${response.status} ${response.statusText}）`)
}

function eventData(payload: unknown): RecordLike {
  return isRecord(payload) ? payload : {}
}

function toolTraceFrom(
  eventName: string,
  payload: unknown
): AgentToolTrace | null {
  const data = eventData(payload)
  const tool = isRecord(data.tool) ? data.tool : data
  const name = stringValue(
    tool.name,
    tool.tool_name,
    tool.tool,
    data.name,
    data.tool_name
  )
  const looksLikeTool =
    name ||
    eventName.startsWith("tool") ||
    Array.isArray(data.tool_calls) ||
    isRecord(data.tool)
  if (!looksLikeTool) return null

  const statusText = stringValue(tool.status, data.status).toLowerCase()
  let status: AgentToolTrace["status"] = "running"
  if (eventName.includes("result") || statusText === "completed" || statusText === "success") {
    status = "completed"
  }
  if (eventName.includes("error") || statusText === "error" || statusText === "failed") {
    status = "error"
  }

  return {
    id: stringValue(tool.id, data.id, data.call_id, name, "tool"),
    name: name || "未知工具",
    status,
    input:
      tool.arguments ??
      tool.input ??
      tool.args ??
      data.arguments ??
      data.input,
    output:
      tool.result ??
      tool.output ??
      data.result ??
      data.output ??
      data.response,
    error: stringValue(tool.error, data.error, data.message) || undefined,
  }
}

function answerFrom(payload: unknown): string {
  if (typeof payload === "string") return payload
  const data = eventData(payload)
  const nested = eventData(data.data)
  return stringValue(
    data.delta,
    data.text,
    data.content,
    data.message,
    data.answer,
    data.output_text,
    nested.delta,
    nested.text,
    nested.content
  )
}

export async function streamAgent(
  input: {
    message: string
    history?: Array<{ role: "user" | "assistant"; content: string }>
    context?: Record<string, unknown>
  },
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(backendUrl("/admin/operations/agent"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "text/event-stream, application/json",
      "Content-Type": "application/json",
      ...tenantRequestHeaders(),
    },
    body: JSON.stringify(input),
    signal,
  })

  if (!response.ok) throw await responseError(response)

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("text/event-stream")) {
    const text = await response.text()
    let payload: unknown = text
    try {
      payload = JSON.parse(text)
    } catch {
      // Plain-text responses are valid fallbacks.
    }
    const answer = answerFrom(payload)
    if (answer) onEvent({ type: "message", text: answer })
    const fallback = eventData(payload)
    const toolCalls = Array.isArray(fallback.tool_calls) ? fallback.tool_calls : []
    for (const toolCall of toolCalls) {
      const trace = toolTraceFrom("tool_call", toolCall)
      if (trace) onEvent({ type: "tool", tool: trace })
    }
    onEvent({ type: "done" })
    return
  }

  if (!response.body) throw new Error("浏览器无法读取 Agent 响应流。")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let doneEmitted = false

  const emit = (event: AgentStreamEvent) => {
    if (event.type === "done") {
      if (doneEmitted) return
      doneEmitted = true
    }
    onEvent(event)
  }

  const dispatch = (eventName: string, payload: unknown) => {
    const data = eventData(payload)
    const type = stringValue(data.type, data.event, eventName).toLowerCase()

    if (type === "done" || type === "complete" || type === "completed") {
      emit({ type: "done" })
      return
    }
    if (type === "error" || type === "failed") {
      emit({
        type: "error",
        message: stringValue(data.message, data.error, answerFrom(payload), "Agent 执行失败。"),
      })
      return
    }
    if (type.includes("tool")) {
      const trace = toolTraceFrom(type, payload)
      if (trace) emit({ type: "tool", tool: trace })
      return
    }

    const answer = answerFrom(payload)
    if (answer) emit({ type: "message", text: answer })
    const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls : []
    for (const toolCall of toolCalls) {
      const trace = toolTraceFrom("tool_call", toolCall)
      if (trace) emit({ type: "tool", tool: trace })
    }
  }

  const processEvent = (rawEvent: string) => {
    let eventName = "message"
    const dataLines: string[] = []
    for (const line of rawEvent.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue
      const separator = line.indexOf(":")
      const field = separator >= 0 ? line.slice(0, separator) : line
      let value = separator >= 0 ? line.slice(separator + 1) : ""
      if (value.startsWith(" ")) value = value.slice(1)
      if (field === "event") eventName = value
      if (field === "data") dataLines.push(value)
    }
    if (dataLines.length === 0) return
    const rawData = dataLines.join("\n")
    if (rawData.trim() === "[DONE]") {
      emit({ type: "done" })
      return
    }
    let payload: unknown = rawData
    try {
      payload = JSON.parse(rawData)
    } catch {
      // Keep the raw text so plain-text SSE chunks still render.
    }
    dispatch(eventName, payload)
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.match(/\r?\n\r?\n/)
    while (boundary?.index !== undefined) {
      const rawEvent = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary[0].length)
      processEvent(rawEvent)
      boundary = buffer.match(/\r?\n\r?\n/)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) processEvent(buffer)
  emit({ type: "done" })
}
