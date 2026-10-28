import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const requireFromApi = createRequire(resolve(root, "packages/api/package.json"))
const XLSX = requireFromApi("xlsx")

const rows = [
  ["SKU", "Title", "Price", "Currency", "Stock", "Barcode", "Operation"],
  ["DEMO-TEE-001", "Canvas Tee / Sand", 29.9, "EUR", 120, "4006381333931", "update"],
  ["DEMO-BAG-002", "Transit Bag / Ink", 49.5, "EUR", 45, "4006381333931", "update"],
]

const workbook = XLSX.utils.book_new()
const worksheet = XLSX.utils.aoa_to_sheet(rows)
worksheet["!cols"] = [
  { wch: 18 },
  { wch: 28 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 18 },
  { wch: 14 },
]
XLSX.utils.book_append_sheet(workbook, worksheet, "Import")

const output = resolve(root, "examples/outlet-import-template.xlsx")
mkdirSync(dirname(output), { recursive: true })
XLSX.writeFile(workbook, output)
console.log(`Generated ${output}`)
