import * as XLSX from "xlsx"
import { parseImportSpreadsheet } from "../../../lib/operations/spreadsheet"

describe("operations spreadsheet parser", () => {
  it("maps Chinese headers and reports duplicate SKUs and formulas", () => {
    const csv = [
      "SKU,商品名称,售价,库存,条码,操作",
      "SHOE-001,Canvas Runner,699.00,12,6901234567890,更新",
      "SHOE-001,=HYPERLINK(\"https://example.invalid\"),699.00,8,123,更新",
    ].join("\n")

    const parsed = parseImportSpreadsheet(
      Buffer.from(csv, "utf8"),
      "products.csv"
    )

    expect(parsed.mapping).toMatchObject({
      sku: "SKU",
      title: "商品名称",
      price: "售价",
      stock: "库存",
      barcode: "条码",
      operation: "操作",
    })
    expect(parsed.summary).toEqual({
      total: 2,
      valid: 0,
      invalid: 2,
      error_count: 4,
    })
    expect(parsed.rows[0]!.errors.map((error) => error.code)).toContain(
      "DUPLICATE_SKU"
    )
    expect(parsed.rows[1]!.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        "DUPLICATE_SKU",
        "DANGEROUS_FORMULA",
        "INVALID_BARCODE",
      ])
    )
  })

  it("rejects formula cells in xlsx files", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["SKU", "价格", "库存"],
      ["SHOE-002", { t: "n", f: "1+1", v: 2 }, 5],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "货单")
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer

    const parsed = parseImportSpreadsheet(buffer, "products.xlsx")

    expect(parsed.sheet_name).toBe("货单")
    expect(parsed.rows[0]!.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DANGEROUS_FORMULA", field: "price" }),
      ])
    )
  })

  it("returns a file-level error when required headers are missing", () => {
    const parsed = parseImportSpreadsheet(
      Buffer.from("名称,备注\nRunner,hello", "utf8"),
      "products.csv"
    )

    expect(parsed.rows).toEqual([])
    expect(parsed.errors[0]).toMatchObject({
      field: "file",
      code: "INVALID_HEADER",
    })
  })
})
