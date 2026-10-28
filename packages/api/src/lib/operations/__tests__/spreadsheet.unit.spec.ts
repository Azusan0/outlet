import * as XLSX from "xlsx"
import { parseImportSpreadsheet } from "../spreadsheet"

function workbook(rows: unknown[][]) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Inventory")
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer
}

describe("spreadsheet import", () => {
  it("maps Chinese headers and keeps long barcodes as text", () => {
    const result = parseImportSpreadsheet(
      workbook([
        ["Outlet 库存更新表"],
        ["商家SKU", "商品名称", "售价", "库存数量", "条码"],
        ["NORTH-001", "测试商品", "129.90", "42", "6901234567892"],
      ]),
      "sample.xlsx"
    )
    expect(result.summary).toEqual({ total: 1, valid: 1, invalid: 0, error_count: 0 })
    expect(result.rows[0]).toMatchObject({ sku: "NORTH-001", price: 129.9, stock: 42, barcode: "6901234567892" })
  })

  it("rejects duplicate SKU, invalid stock, negative price and formulas", () => {
    const result = parseImportSpreadsheet(
      workbook([
        ["SKU", "Price", "Stock", "Barcode"],
        ["DUP-001", 99, 4, "6901234567892"],
        ["dup-001", -2, "2.5", "=1+cmd|' /C calc'!A0"],
      ]),
      "invalid.xlsx"
    )
    expect(result.summary.invalid).toBeGreaterThan(0)
    expect(result.rows.flatMap((row) => row.errors).map((error) => error.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_SKU", "INVALID_PRICE", "INVALID_STOCK", "DANGEROUS_FORMULA"])
    )
  })

  it("uses a real CSV parser for quoted values", () => {
    const csv = Buffer.from('SKU,Title,Price,Stock\nA-001,"Sample, comma",20,3\n', "utf8")
    const result = parseImportSpreadsheet(csv, "sample.csv")
    expect(result.rows[0].title).toBe("Sample, comma")
    expect(result.rows[0].stock).toBe(3)
  })
})
