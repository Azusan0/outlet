import type { MedusaContainer } from "@medusajs/framework/types";

import { executeTool } from "../tools";
import type { TenantRecord } from "../../tenant";

jest.mock("../../operations/erp", () => ({
  previewErpSync: jest.fn(),
}));

describe("operations tools", () => {
  it("reads marketplace inventory through tenant offers", async () => {
    const graph = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ product_id: "prod_1", sales_channel_id: "sc_1" }],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "prod_1",
            title: "Trail Runner",
            handle: "trail-runner",
            status: "published",
            sales_channels: [{ id: "sc_1" }],
            variants: [
              {
                id: "var_1",
                sku: "TRAIL-41",
                title: "EU 41",
                prices: [],
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "offer_1",
            product_id: "prod_1",
            variant_id: "var_1",
            seller_id: "sel_1",
            inventory_items: [
              {
                inventory: {
                  id: "iitem_1",
                  sku: "OFFER-TRAIL-41",
                  location_levels: [
                    {
                      stocked_quantity: 7,
                      reserved_quantity: 2,
                      stock_locations: [
                        {
                          name: "Seller Warehouse",
                          sales_channels: [{ id: "sc_1" }],
                        },
                      ],
                    },
                    {
                      stocked_quantity: 99,
                      reserved_quantity: 0,
                      stock_locations: [
                        {
                          name: "Other Tenant Warehouse",
                          sales_channels: [{ id: "sc_other" }],
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
    const scope = {
      resolve: jest.fn(() => ({ graph })),
    } as unknown as MedusaContainer;
    const tenant: TenantRecord = {
      id: "ten_1",
      slug: "north",
      name: "North",
      description: "",
      sales_channel_id: "sc_1",
      region_id: "reg_1",
      publishable_key: "pk_test",
      default_country: "de",
      status: "active",
    };

    const result = (await executeTool(
      "inventory_health",
      { threshold: 10 },
      { scope, tenant, actorId: "user_1" },
    )) as {
      scanned_levels: number;
      total_available: number;
      items: Array<{
        offer_id: string;
        sku: string;
        available_quantity: number;
      }>;
    };

    expect(result.scanned_levels).toBe(1);
    expect(result.total_available).toBe(5);
    expect(result.items[0]).toMatchObject({
      offer_id: "offer_1",
      sku: "OFFER-TRAIL-41",
      available_quantity: 5,
    });
    expect(graph).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entity: "offer",
        filters: { product_id: ["prod_1"] },
      }),
    );
  });
});
