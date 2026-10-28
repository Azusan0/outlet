import type { MedusaContainer } from "@medusajs/framework/types"
import {
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/core-flows"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { updateOffersWorkflow } from "@mercurjs/core/workflows"
import type { UpdateOfferDTO } from "@mercurjs/types"
import type { TenantRecord } from "../tenant"
import type { TenantModuleService } from "../../modules/tenant/service"
import type {
  BatchRowResult,
  ImportCommitResult,
  ParsedImportRow,
  RowError,
} from "./types"

type Price = {
  id?: string
  amount?: number | string | { value?: string }
  currency_code?: string
  min_quantity?: number | null
  max_quantity?: number | null
}

type Variant = {
  id: string
  sku?: string | null
  title?: string | null
  barcode?: string | null
  prices?: Price[]
  product?: { id?: string; title?: string | null }
}

type InventoryLevel = {
  id: string
  location_id: string
}

type Offer = {
  id: string
  seller_id: string
  variant_id: string
  product_id: string
  sku?: string | null
  prices?: Array<Price | null>
  product_variant?: Variant | null
  inventory_items?: Array<{
    inventory_item_id?: string
    inventory_item?: {
      id?: string
      location_levels?: InventoryLevel[]
    } | null
    inventory?: {
      id?: string
      location_levels?: InventoryLevel[]
    } | null
  }>
}

type ResolvedOffer = {
  offer: Offer
  variant: Variant
}

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function rowValidationErrors(matches: Offer[]): RowError[] {
  if (matches.length === 0) {
    return [
      {
        field: "sku",
        code: "SKU_NOT_FOUND",
        message: "No Offer with this SKU belongs to the current tenant",
      },
    ]
  }
  if (matches.length > 1) {
    return [
      {
        field: "sku",
        code: "SKU_AMBIGUOUS",
        message: `SKU matches ${matches.length} tenant Offers; make the SKU unique before importing`,
      },
    ]
  }
  return []
}

async function queryOffersForSkus(
  container: MedusaContainer,
  skus: string[]
): Promise<Offer[]> {
  if (!skus.length) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: {
      entity: string
      fields: string[]
      filters: Record<string, unknown>
    }) => Promise<{ data: unknown }>
  }
  const { data } = await query.graph({
    entity: "offer",
    fields: [
      "id",
      "seller_id",
      "variant_id",
      "product_id",
      "sku",
      "prices.*",
      "product_variant.id",
      "product_variant.sku",
      "product_variant.title",
      "product_variant.barcode",
      "product_variant.prices.*",
      "product_variant.product.id",
      "product_variant.product.title",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.id",
      "inventory_items.inventory.location_levels.id",
      "inventory_items.inventory.location_levels.location_id",
    ],
    filters: { sku: skus },
  })
  return asRows<Offer>(data)
}

function updatePriceRows(prices: Array<Price | null>, row: ParsedImportRow) {
  const currency = row.currency.toUpperCase()
  const resolvedPrices = prices.filter(
    (price): price is Price =>
      !!price && typeof price.currency_code === "string"
  )
  const existing = resolvedPrices.filter(
    (price) => price.currency_code?.toUpperCase() === currency
  )
  const target = existing.find(
    (price) => price.min_quantity == null && price.max_quantity == null
  )
  if (existing.length && !target) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `The ${currency} price uses quantity tiers; replace those tiers through the admin pricing editor`
    )
  }

  const toAmount = (amount: Price["amount"]) => {
    const value =
      typeof amount === "object" && amount !== null ? amount.value : amount
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "An existing price row has an invalid amount"
      )
    }
    return parsed
  }
  const updated: NonNullable<UpdateOfferDTO["prices"]> = resolvedPrices.map(
    (price) => ({
      id: price.id,
      amount: price.id === target?.id ? row.price! : toAmount(price.amount),
      currency_code: price.currency_code ?? currency,
      min_quantity: price.min_quantity,
      max_quantity: price.max_quantity,
    })
  )
  if (!target) {
    updated.push({
      amount: row.price!,
      currency_code: currency,
      min_quantity: null,
      max_quantity: null,
    })
  }
  if (!updated.length) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "An Offer must contain at least one price row"
    )
  }
  return updated
}

function resolveOffers(offers: Offer[]): ResolvedOffer[] {
  return offers.map((offer) => {
    if (!offer.product_variant?.id || !offer.product_variant.product?.id) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Offer ${offer.id} has no resolvable product variant`
      )
    }
    return { offer, variant: offer.product_variant }
  })
}

async function updateResolvedRow(
  container: MedusaContainer,
  row: ParsedImportRow,
  resolved: ResolvedOffer
): Promise<BatchRowResult> {
  const { offer, variant } = resolved
  const result: BatchRowResult = {
    row_id: row.id,
    sku: row.sku,
    status: "updated",
    product_id: variant.product!.id!,
    variant_id: variant.id,
    offer_ids: [offer.id],
    price_updated: false,
    stock_updated: false,
  }

  if (row.title) {
    try {
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: variant.product!.id! },
          update: {
            title: row.title,
          },
        },
      })
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Product details update failed: ${(error as Error).message}`
      )
    }
  }

  if (row.barcode && row.barcode !== variant.barcode) {
    try {
      await updateProductVariantsWorkflow(container).run({
        input: {
          product_variants: [
            {
              id: variant.id,
              barcode: row.barcode,
            },
          ],
        },
      })
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Variant barcode update failed: ${(error as Error).message}`
      )
    }
  }

  if (row.price !== null) {
    try {
      await updateOffersWorkflow(container).run({
        input: {
          offers: [
            {
              id: offer.id,
              prices: updatePriceRows(offer.prices ?? [], row),
            },
          ],
        },
      })
      result.price_updated = true
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Offer price update failed: ${(error as Error).message}`
      )
    }
  }

  if (row.stock !== null) {
    const inventoryItems = (offer.inventory_items ?? [])
      .map((link) => link.inventory ?? link.inventory_item)
      .filter(
        (
          item
        ): item is NonNullable<NonNullable<Offer["inventory_items"]>[number]["inventory"]> =>
          Boolean(item?.id)
      )
    const levels = inventoryItems.flatMap((item) =>
      (item.location_levels ?? []).map((level) => ({
        ...level,
        inventory_item_id: item.id!,
      }))
    )
    if (levels.length === 0) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Offer ${offer.id} has no inventory level to update`
      )
    }
    try {
      await updateInventoryLevelsWorkflow(container).run({
        input: {
          updates: levels.map((level) => ({
            id: level.id,
            inventory_item_id: level.inventory_item_id,
            location_id: level.location_id,
            stocked_quantity: row.stock!,
          })),
        },
      })
      result.stock_updated = true
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Inventory update failed: ${(error as Error).message}`
      )
    }
  }

  return result
}

export async function commitImportRows(
  container: MedusaContainer,
  tenant: TenantRecord,
  rows: ParsedImportRow[]
): Promise<ImportCommitResult> {
  const tenantService = container.resolve<TenantModuleService>("tenant")
  const mappings = await tenantService.listTenantSellers({
    tenant_id: tenant.id,
  })
  const allowedSellers = new Set<string>(
    mappings.map((mapping: { seller_id: string }) => mapping.seller_id)
  )
  const offers = await queryOffersForSkus(
    container,
    [...new Set(rows.map((row) => row.sku))]
  )
  const offersBySku = new Map<string, Offer[]>()
  for (const offer of offers) {
    if (!allowedSellers.has(offer.seller_id)) continue
    const key = (offer.sku ?? "").toUpperCase()
    offersBySku.set(key, [...(offersBySku.get(key) ?? []), offer])
  }

  const invalid: Array<{ row: ParsedImportRow; errors: RowError[] }> = []
  const resolved = new Map<string, ResolvedOffer>()
  for (const row of rows) {
    const errors = [
      ...row.errors,
      ...rowValidationErrors(offersBySku.get(row.sku.toUpperCase()) ?? []),
    ]
    if (errors.length) {
      invalid.push({ row, errors })
    } else {
      resolved.set(row.id, resolveOffers(offersBySku.get(row.sku.toUpperCase())!)[0]!)
    }
  }
  if (invalid.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Import commit blocked for ${invalid.length} rows: ${invalid
        .slice(0, 5)
        .map(
          ({ row, errors }) =>
            `row ${row.row_number} (${row.sku}): ${errors
              .map((error) => error.message)
              .join("; ")}`
        )
        .join(" | ")}`
    )
  }

  const results: BatchRowResult[] = []
  for (const row of rows) {
    try {
      results.push(
        await updateResolvedRow(container, row, resolved.get(row.id)!)
      )
    } catch (error) {
      results.push({
        row_id: row.id,
        sku: row.sku,
        status: "failed",
        error: (error as Error).message,
      })
    }
  }

  const updated = results.filter((result) => result.status === "updated").length
  const failed = results.filter((result) => result.status === "failed").length
  const skipped = results.filter((result) => result.status === "skipped").length
  return {
    batch_id: "",
    status: failed ? (updated ? "partial" : "failed") : "committed",
    rows: results,
    summary: { selected: rows.length, updated, skipped, failed },
  }
}

export type ImportPreviewRow = {
  row_id: string
  sku: string
  status: "would_update" | "invalid"
  errors: RowError[]
}

export async function previewImportRows(
  container: MedusaContainer,
  tenant: TenantRecord,
  rows: ParsedImportRow[]
): Promise<ImportPreviewRow[]> {
  const tenantService = container.resolve<TenantModuleService>("tenant")
  const mappings = await tenantService.listTenantSellers({
    tenant_id: tenant.id,
  })
  const allowedSellers = new Set<string>(
    mappings.map((mapping: { seller_id: string }) => mapping.seller_id)
  )
  const offers = await queryOffersForSkus(
    container,
    [...new Set(rows.map((row) => row.sku))]
  )
  const offersBySku = new Map<string, Offer[]>()
  for (const offer of offers) {
    if (!allowedSellers.has(offer.seller_id)) continue
    const key = (offer.sku ?? "").toUpperCase()
    offersBySku.set(key, [...(offersBySku.get(key) ?? []), offer])
  }
  return rows.map((row) => {
    const errors = [
      ...row.errors,
      ...rowValidationErrors(offersBySku.get(row.sku.toUpperCase()) ?? []),
    ]
    return {
      row_id: row.id,
      sku: row.sku,
      status: errors.length ? "invalid" : "would_update",
      errors,
    }
  })
}
