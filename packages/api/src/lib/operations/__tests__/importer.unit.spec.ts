import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/core-flows"
import { updateOffersWorkflow } from "@mercurjs/core/workflows"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { TenantRecord } from "../../tenant"
import type { ParsedImportRow } from "../types"
import { commitImportRows } from "../importer"

jest.mock("@medusajs/core-flows", () => ({
  updateInventoryLevelsWorkflow: jest.fn(),
  updateProductVariantsWorkflow: jest.fn(),
  updateProductsWorkflow: jest.fn(),
}))

jest.mock("@mercurjs/core/workflows", () => ({
  updateOffersWorkflow: jest.fn(),
}))

describe("offer spreadsheet updates", () => {
  const updateProductsRun = jest.fn()
  const updateProductVariantsRun = jest.fn()
  const updateOffersRun = jest.fn()
  const updateInventoryRun = jest.fn()
  const tenant: TenantRecord = {
    id: "ten_north",
    slug: "north",
    name: "North",
    description: "",
    sales_channel_id: "sc_north",
    region_id: "reg_default",
    publishable_key: "pk_test",
    default_country: "de",
    status: "active",
  }

  const row: ParsedImportRow = {
    id: "row_2",
    row_number: 2,
    sku: "SKU-001",
    title: "",
    price: 25,
    currency: "eur",
    stock: null,
    barcode: "",
    operation: "update",
    raw: {},
    errors: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(updateProductsWorkflow as unknown as jest.Mock).mockReturnValue({
      run: updateProductsRun,
    })
    ;(updateProductVariantsWorkflow as unknown as jest.Mock).mockReturnValue({
      run: updateProductVariantsRun,
    })
    ;(updateOffersWorkflow as unknown as jest.Mock).mockReturnValue({
      run: updateOffersRun,
    })
    ;(updateInventoryLevelsWorkflow as unknown as jest.Mock).mockReturnValue({
      run: updateInventoryRun,
    })
    updateProductsRun.mockResolvedValue({})
    updateProductVariantsRun.mockResolvedValue({})
    updateOffersRun.mockResolvedValue({})
    updateInventoryRun.mockResolvedValue({})
  })

  it("updates only the tenant Offer price and ignores dangling null price links", async () => {
    const offer = {
      id: "offer_001",
      seller_id: "seller_north",
      variant_id: "variant_001",
      product_id: "prod_001",
      sku: row.sku,
      prices: [
        {
          id: "price_eur",
          amount: 20,
          currency_code: "eur",
          min_quantity: null,
          max_quantity: null,
        },
        null,
        {
          id: "price_usd",
          amount: 22,
          currency_code: "usd",
          min_quantity: null,
          max_quantity: null,
        },
      ],
      product_variant: {
        id: "variant_001",
        product: { id: "prod_001" },
        prices: [],
      },
    }
    const tenantService = {
      listTenantSellers: jest
        .fn()
        .mockResolvedValue([{ seller_id: offer.seller_id }]),
    }
    const query = {
      graph: jest.fn().mockResolvedValue({ data: [offer] }),
    }
    const container = {
      resolve: jest.fn((key: string) =>
        key === "tenant" ? tenantService : query,
      ),
    } as unknown as MedusaContainer

    const result = await commitImportRows(container, tenant, [row])

    expect(result.summary).toMatchObject({ selected: 1, updated: 1, failed: 0 })
    expect(updateProductsWorkflow).not.toHaveBeenCalled()
    expect(updateProductVariantsWorkflow).not.toHaveBeenCalled()
    expect(updateOffersWorkflow).toHaveBeenCalledWith(container)
    expect(updateOffersRun).toHaveBeenCalledWith({
      input: {
        offers: [
          {
            id: offer.id,
            prices: [
              {
                id: "price_eur",
                amount: 25,
                currency_code: "eur",
                min_quantity: null,
                max_quantity: null,
              },
              {
                id: "price_usd",
                amount: 22,
                currency_code: "usd",
                min_quantity: null,
                max_quantity: null,
              },
            ],
          },
        ],
      },
    })
  })

  it("updates product details and Offer inventory without replacing sibling variants", async () => {
    const detailRow: ParsedImportRow = {
      ...row,
      title: "Updated product title",
      price: null,
      stock: 21,
      barcode: "4006381333932",
    }
    const offer = {
      id: "offer_002",
      seller_id: "seller_north",
      variant_id: "variant_002",
      product_id: "prod_002",
      sku: detailRow.sku,
      prices: [],
      product_variant: {
        id: "variant_002",
        barcode: "4006381333931",
        product: { id: "prod_002" },
        prices: [],
      },
      inventory_items: [
        {
          inventory: {
            id: "iitem_002",
            location_levels: [
              {
                id: "ilevel_002",
                location_id: "sloc_002",
              },
            ],
          },
        },
      ],
    }
    const tenantService = {
      listTenantSellers: jest
        .fn()
        .mockResolvedValue([{ seller_id: offer.seller_id }]),
    }
    const query = {
      graph: jest.fn().mockResolvedValue({ data: [offer] }),
    }
    const container = {
      resolve: jest.fn((key: string) =>
        key === "tenant" ? tenantService : query,
      ),
    } as unknown as MedusaContainer

    const result = await commitImportRows(container, tenant, [detailRow])

    expect(result.summary).toMatchObject({ selected: 1, updated: 1, failed: 0 })
    expect(updateProductsRun).toHaveBeenCalledWith({
      input: {
        selector: { id: "prod_002" },
        update: { title: "Updated product title" },
      },
    })
    expect(updateProductVariantsRun).toHaveBeenCalledWith({
      input: {
        product_variants: [
          {
            id: "variant_002",
            barcode: "4006381333932",
          },
        ],
      },
    })
    expect(updateInventoryRun).toHaveBeenCalledWith({
      input: {
        updates: [
          {
            id: "ilevel_002",
            inventory_item_id: "iitem_002",
            location_id: "sloc_002",
            stocked_quantity: 21,
          },
        ],
      },
    })
  })

  it("skips a barcode update when the variant already has that barcode", async () => {
    const unchangedRow: ParsedImportRow = {
      ...row,
      price: null,
      barcode: "4006381333931",
    }
    const offer = {
      id: "offer_003",
      seller_id: "seller_north",
      variant_id: "variant_003",
      product_id: "prod_003",
      sku: unchangedRow.sku,
      prices: [],
      product_variant: {
        id: "variant_003",
        barcode: "4006381333931",
        product: { id: "prod_003" },
        prices: [],
      },
    }
    const tenantService = {
      listTenantSellers: jest
        .fn()
        .mockResolvedValue([{ seller_id: offer.seller_id }]),
    }
    const query = {
      graph: jest.fn().mockResolvedValue({ data: [offer] }),
    }
    const container = {
      resolve: jest.fn((key: string) =>
        key === "tenant" ? tenantService : query,
      ),
    } as unknown as MedusaContainer

    const result = await commitImportRows(container, tenant, [unchangedRow])

    expect(result.summary).toMatchObject({ selected: 1, updated: 1, failed: 0 })
    expect(updateProductVariantsWorkflow).not.toHaveBeenCalled()
  })
})
