import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/core-flows"
import { updateOffersWorkflow } from "@mercurjs/core/workflows"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { TenantRecord } from "../../tenant"
import type { ParsedImportRow } from "../types"
import { commitImportRows } from "../importer"

jest.mock("@medusajs/core-flows", () => ({
  updateInventoryLevelsWorkflow: jest.fn(),
  updateProductsWorkflow: jest.fn(),
}))

jest.mock("@mercurjs/core/workflows", () => ({
  updateOffersWorkflow: jest.fn(),
}))

describe("offer spreadsheet updates", () => {
  const updateProductsRun = jest.fn()
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
    ;(updateOffersWorkflow as unknown as jest.Mock).mockReturnValue({
      run: updateOffersRun,
    })
    ;(updateInventoryLevelsWorkflow as unknown as jest.Mock).mockReturnValue({
      run: updateInventoryRun,
    })
    updateProductsRun.mockResolvedValue({})
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
})
