import { createHash } from "crypto"
import * as XLSX from "xlsx"
import { MedusaError } from "@medusajs/framework/utils"
import type {
  ImportOperation,
  ImportSummary,
  OperationsField,
  ParsedImportRow,
  ParsedSpreadsheet,
  RowError,
} from "./types"

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ROWS = 2_000

type CellValue = string | number | boolean | null

const HEADER_ALIASES: Record<OperationsField, string[]> = {
  sku: [
    "sku",
    "商品sku",
    "商家sku",
    "规格编码",
    "商品编码",
    "商品货号",
    "商品编号",
    "货号",
    "款号",
    "编码",
  ],
  title: [
    "title",
    "商品名称",
    "商品标题",
    "产品名称",
    "品名",
    "款名",
    "名称",
  ],
  price: [
    "price",
    "价格",
    "售价",
    "销售价",
    "零售价",
    "吊牌价",
    "供货价",
    "标准售价",
  ],
  currency: ["currency", "币种", "货币", "货币代码"],
  stock: [
    "stock",
    "库存",
    "库存数量",
    "可售库存",
    "可用库存",
    "现货库存",
    "数量",
  ],
  barcode: [
    "barcode",
    "条码",
    "条形码",
    "商品条码",
    "国际条码",
    "ean",
    "upc",
    "gtin",
  ],
  operation: ["operation", "操作", "操作类型", "更新类型", "动作", "类型"],
}

const HEADER_LOOKUP = new Map<string, OperationsField>()
for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
  for (const alias of aliases) {
    HEADER_LOOKUP.set(normalizeHeader(alias), field as OperationsField)
  }
}

const OPERATION_LOOKUP = new Map<string, ImportOperation>([
  ["update", "update"],
  ["更新", "update"],
  ["修改", "update"],
  ["upsert", "upsert"],
  ["新增或更新", "upsert"],
  ["create", "create"],
  ["add", "create"],
  ["新增", "create"],
  ["创建", "create"],
  ["delete", "delete"],
  ["remove", "delete"],
  ["删除", "delete"],
])

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") {
    return value.replace(/\u0000/g, "").trim()
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim()
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Unsupported cell value. Please remove merged or rich object cells"
  )
}

function isDangerousFormula(value: string): boolean {
  const normalized = value.replace(/^[\s\u0009\u000D]+/, "")
  return (
    /^[=@]/.test(normalized) ||
    /^\+/.test(normalized) ||
    /^-(?!\d+(?:\.\d+)?$)/.test(normalized)
  )
}

function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
  const delimiter = [",", ";", "\t"]
    .map((candidate) => ({
      candidate,
      count: (firstLine.match(new RegExp(`\\${candidate}`, "g")) ?? []).length,
    }))
    .sort((a, b) => b.count - a.count)[0]?.candidate

  if (!delimiter) return [[firstLine]]

  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index++
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
      continue
    }
    if (character === '"') {
      quoted = true
    } else if (character === delimiter) {
      row.push(cell)
      cell = ""
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += character
    }
  }

  if (quoted) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "CSV contains an unterminated quoted field"
    )
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function detectFormat(buffer: Buffer, fileName: string): "xlsx" | "xls" | "csv" {
  const extension = fileName.split(".").pop()?.toLowerCase()
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  ) {
    return "xlsx"
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  ) {
    return "xls"
  }
  if (extension === "csv") return "csv"
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Unsupported file content. Upload a valid .xlsx, .xls or UTF-8 .csv file"
  )
}

function readWorkbookTable(buffer: Buffer, format: "xlsx" | "xls" | "csv") {
  if (format === "csv") {
    let text: string
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
    } catch {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "CSV must be UTF-8 encoded. Re-export it as UTF-8 and retry"
      )
    }
    return {
      sheetName: "CSV",
      rows: parseDelimited(text.replace(/^\uFEFF/, "")),
      formulas: new Map<string, string>(),
    }
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellFormula: true,
      cellDates: true,
      dense: false,
    })
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The spreadsheet is corrupt or cannot be parsed"
    )
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The spreadsheet does not contain a worksheet"
    )
  }
  const sheet = workbook.Sheets[sheetName]!
  const formulas = new Map<string, string>()
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null
  if (range) {
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let column = range.s.c; column <= range.e.c; column++) {
        const address = XLSX.utils.encode_cell({ r: row, c: column })
        const cell = sheet[address]
        if (cell?.f) formulas.set(address, `=${cell.f}`)
      }
    }
  }
  return {
    sheetName,
    rows: XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    }),
    formulas,
  }
}

function findHeader(
  rows: unknown[][]
): { index: number; mapping: Partial<Record<OperationsField, string>>; errors: RowError[] } {
  let best:
    | {
        index: number
        mapping: Partial<Record<OperationsField, string>>
        score: number
      }
    | undefined

  for (let index = 0; index < Math.min(rows.length, 10); index++) {
    const mapping: Partial<Record<OperationsField, string>> = {}
    let score = 0
    for (const header of rows[index] ?? []) {
      const field = HEADER_LOOKUP.get(normalizeHeader(header))
      if (field && !mapping[field]) {
        mapping[field] = cleanText(header)
        score++
      }
    }
    if (!best || score > best.score) best = { index, mapping, score }
  }

  if (!best || best.score < 2 || !best.mapping.sku) {
    return {
      index: -1,
      mapping: best?.mapping ?? {},
      errors: [
        {
          field: "file",
          code: "INVALID_HEADER",
          message:
            "Cannot identify a header row. Include SKU plus at least one business column",
        },
      ],
    }
  }

  const errors: RowError[] = []
  if (best.mapping.price === undefined && best.mapping.stock === undefined) {
    errors.push({
      field: "file",
      code: "INVALID_HEADER",
      message: "The file must contain a price or stock column",
    })
  }
  return { index: best.index, mapping: best.mapping, errors }
}

function cellAt(row: unknown[], index: number): unknown {
  return index >= 0 ? row[index] : undefined
}

function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("must be a number")
  }
  const normalized =
    typeof value === "number"
      ? String(value)
      : value.replace(/[,\s￥¥€$]/g, "").replace(/^(EUR|USD|CNY|RMB)/i, "")
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("must be a positive amount with at most 2 decimals")
  }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10_000_000) {
    throw new Error("must be greater than 0 and no more than 10000000")
  }
  return parsed
}

function parseStock(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("must be an integer")
  }
  const normalized =
    typeof value === "number" ? String(value) : value.replace(/[,\s]/g, "")
  if (!/^\d+$/.test(normalized)) {
    throw new Error("must be a non-negative integer")
  }
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed > 1_000_000) {
    throw new Error("must be no more than 1000000")
  }
  return parsed
}

function parseBarcode(value: unknown): string {
  if (value === null || value === undefined || value === "") return ""
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("must be an EAN/UPC/GTIN value")
  }
  const normalized =
    typeof value === "number" ? String(value) : value.replace(/[\s-]/g, "")
  if (/e/i.test(normalized) || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(normalized)) {
    throw new Error("must contain 8, 12, 13 or 14 digits")
  }
  return normalized
}

function parseOperation(value: unknown): ImportOperation {
  if (value === null || value === undefined || value === "") return "update"
  const operation = OPERATION_LOOKUP.get(cleanText(value).toLowerCase())
  if (!operation) throw new Error("must be update, upsert, create or delete")
  return operation
}

function buildRawRow(
  row: unknown[],
  headerRow: unknown[],
  mapping: Partial<Record<OperationsField, string>>
): Record<string, CellValue> {
  const raw: Record<string, CellValue> = {}
  for (const [field, header] of Object.entries(mapping) as [
    OperationsField,
    string,
  ][]) {
    const column = headerRow.findIndex(
      (candidate) => normalizeHeader(candidate) === normalizeHeader(header)
    )
    const value = cellAt(row, column)
    if (value === null || value === undefined || value === "") {
      raw[field] = ""
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      raw[field] = value
    } else {
      raw[field] = cleanText(value)
    }
  }
  return raw
}

function summarize(rows: ParsedImportRow[]): ImportSummary {
  const invalid = rows.filter((row) => row.errors.length > 0).length
  return {
    total: rows.length,
    valid: rows.length - invalid,
    invalid,
    error_count: rows.reduce((sum, row) => sum + row.errors.length, 0),
  }
}

export function parseImportSpreadsheet(
  buffer: Buffer,
  fileName: string
): ParsedSpreadsheet {
  if (!buffer.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The uploaded file is empty"
    )
  }
  if (buffer.length > MAX_IMPORT_FILE_BYTES) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The uploaded file exceeds the 5 MB limit"
    )
  }

  const format = detectFormat(buffer, fileName)
  const table = readWorkbookTable(buffer, format)
  const header = findHeader(table.rows)
  if (header.index < 0) {
    return {
      sheet_name: table.sheetName,
      headers: [],
      mapping: header.mapping,
      rows: [],
      errors: header.errors,
      summary: summarize([]),
    }
  }

  const headerRow = table.rows[header.index] ?? []
  const headers = headerRow.map(cleanText).filter(Boolean)
  const dataRows = table.rows
    .slice(header.index + 1)
    .filter((row) => row.some((cell) => cleanText(cell) !== ""))

  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `The file contains more than ${MAX_IMPORT_ROWS} data rows`
    )
  }

  const columnIndex = (field: OperationsField) => {
    const headerName = header.mapping[field]
    return headerName === undefined
      ? -1
      : headerRow.findIndex(
          (candidate) => normalizeHeader(candidate) === normalizeHeader(headerName)
        )
  }
  const columns = {
    sku: columnIndex("sku"),
    title: columnIndex("title"),
    price: columnIndex("price"),
    currency: columnIndex("currency"),
    stock: columnIndex("stock"),
    barcode: columnIndex("barcode"),
    operation: columnIndex("operation"),
  }

  const parsedRows: ParsedImportRow[] = dataRows.map((row, index) => {
    const rowNumber = header.index + index + 2
    const errors: RowError[] = []
    const raw = buildRawRow(row, headerRow, header.mapping)

    for (const [field, column] of Object.entries(columns)) {
      if (column < 0) continue
      const address = XLSX.utils.encode_cell({
        r: header.index + index + 1,
        c: column,
      })
      const formula = table.formulas.get(address)
      if (formula) {
        errors.push({
          field: field as OperationsField,
          code: "DANGEROUS_FORMULA",
          message: `Formula cells are not allowed: ${formula.slice(0, 120)}`,
        })
      }
    }

    const sku = cleanText(cellAt(row, columns.sku))
    const title = cleanText(cellAt(row, columns.title))
    const currency =
      cleanText(cellAt(row, columns.currency)).toUpperCase() || "EUR"
    const barcode = (() => {
      try {
        return parseBarcode(cellAt(row, columns.barcode))
      } catch (error) {
        errors.push({
          field: "barcode",
          code: "INVALID_BARCODE",
          message: (error as Error).message,
        })
        return ""
      }
    })()
    const price = (() => {
      try {
        return parseMoney(cellAt(row, columns.price))
      } catch (error) {
        errors.push({
          field: "price",
          code: "INVALID_PRICE",
          message: (error as Error).message,
        })
        return null
      }
    })()
    const stock = (() => {
      try {
        return parseStock(cellAt(row, columns.stock))
      } catch (error) {
        errors.push({
          field: "stock",
          code: "INVALID_STOCK",
          message: (error as Error).message,
        })
        return null
      }
    })()
    const operation = (() => {
      try {
        return parseOperation(cellAt(row, columns.operation))
      } catch (error) {
        errors.push({
          field: "operation",
          code: "INVALID_OPERATION",
          message: (error as Error).message,
        })
        return "update" as const
      }
    })()

    if (!sku) {
      errors.push({
        field: "sku",
        code: "REQUIRED",
        message: "SKU is required",
      })
    }
    if (price === null && stock === null) {
      errors.push({
        field: "price",
        code: "REQUIRED",
        message: "At least one of price or stock is required",
      })
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push({
        field: "currency",
        code: "INVALID_NUMBER",
        message: "Currency must be a 3-letter ISO code such as EUR or USD",
      })
    }
    if (operation === "create" || operation === "delete") {
      errors.push({
        field: "operation",
        code: "UNSUPPORTED_OPERATION",
        message:
          "This release only updates existing SKUs; create/delete requires a dedicated workflow",
      })
    }

    for (const [field, value] of Object.entries(raw)) {
      if (
        typeof value === "string" &&
        isDangerousFormula(value) &&
        !errors.some(
          (error) =>
            error.field === field && error.code === "DANGEROUS_FORMULA"
        )
      ) {
        errors.push({
          field: field as OperationsField,
          code: "DANGEROUS_FORMULA",
          message: "Spreadsheet formula prefixes are not allowed",
        })
      }
    }

    return {
      id: `row_${rowNumber}`,
      row_number: rowNumber,
      sku,
      title,
      price,
      currency,
      stock,
      barcode,
      operation,
      raw,
      errors,
    }
  })

  const bySku = new Map<string, ParsedImportRow[]>()
  for (const row of parsedRows) {
    if (!row.sku) continue
    const key = row.sku.toUpperCase()
    bySku.set(key, [...(bySku.get(key) ?? []), row])
  }
  for (const rows of bySku.values()) {
    if (rows.length < 2) continue
    for (const row of rows) {
      row.errors.push({
        field: "sku",
        code: "DUPLICATE_SKU",
        message: `SKU appears ${rows.length} times in this file`,
      })
    }
  }

  return {
    sheet_name: table.sheetName,
    headers,
    mapping: header.mapping,
    rows: parsedRows,
    errors: header.errors,
    summary: summarize(parsedRows),
  }
}

export function hashImportFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}
