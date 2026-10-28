import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createHash } from "node:crypto";
import type { KnowledgeModuleService } from "../../modules/knowledge/service";
import { previewErpSync } from "../operations/erp";
import type { ToolContext, ToolDefinition } from "./types";

type ProductVariant = {
  id: string;
  sku?: string | null;
  title?: string | null;
  prices?: Array<{
    currency_code?: string | null;
    amount?: number | string | { value?: string };
  }>;
  inventory_items?: Array<{
    inventory?: {
      id: string;
      sku?: string | null;
      title?: string | null;
      location_levels?: Array<{
        stocked_quantity?: number | string;
        reserved_quantity?: number | string;
        stock_locations?: Array<{
          name?: string | null;
          sales_channels?: Array<{ id: string }>;
        }>;
      }>;
    } | null;
  }>;
};

type ProductRecord = {
  id: string;
  title: string;
  handle?: string | null;
  thumbnail?: string | null;
  status?: string | null;
  variants?: ProductVariant[];
  sales_channels?: Array<{ id: string }>;
};

type ProductChannelLink = {
  product_id: string;
  sales_channel_id: string;
};

type InventoryLevelRecord = {
  stocked_quantity?: number | string;
  reserved_quantity?: number | string;
  stock_locations?: Array<{
    name?: string | null;
    sales_channels?: Array<{ id: string }>;
  }>;
};

type OfferInventoryRecord = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  seller_id: string;
  inventory_items?: Array<{
    inventory?: {
      id: string;
      sku?: string | null;
      title?: string | null;
      location_levels?: InventoryLevelRecord[];
    } | null;
  }>;
};

function numberValue(value: number | string | undefined): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(parsed) ? Number(parsed) : 0;
}

function safeLimit(value: unknown, fallback: number, max = 20): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

async function loadProducts(
  context: ToolContext,
  knownProductIds?: string[],
): Promise<ProductRecord[]> {
  const query = context.scope.resolve(ContainerRegistrationKeys.QUERY);
  let productIds = knownProductIds;
  if (!productIds) {
    const { data: links } = await query.graph({
      entity: "product_sales_channel",
      fields: ["product_id", "sales_channel_id"],
      filters: {
        sales_channel_id: [context.tenant.sales_channel_id],
      },
    });
    productIds = [
      ...new Set((links as ProductChannelLink[]).map((link) => link.product_id)),
    ];
  }
  if (!productIds.length) return [];

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "thumbnail",
      "status",
      "sales_channels.id",
      "variants.id",
      "variants.sku",
      "variants.title",
      "variants.prices.*",
    ],
    filters: {
      id: productIds,
    },
  });
  return data as ProductRecord[];
}

async function catalogSearch(
  context: ToolContext,
  args: Record<string, unknown>,
) {
  const queryText = textValue(args.query).toLocaleLowerCase();
  const limit = safeLimit(args.limit, 8);
  const products = await loadProducts(context);
  const filtered = queryText
    ? products.filter((product) => {
        const haystack = [
          product.title,
          product.handle,
          ...(product.variants ?? []).flatMap((variant) => [
            variant.sku,
            variant.title,
          ]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return queryText
          .split(/\s+/)
          .filter(Boolean)
          .every((term) => haystack.includes(term));
      })
    : products;

  return {
    query: queryText,
    count: filtered.length,
    products: filtered.slice(0, limit).map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      thumbnail: product.thumbnail,
      status: product.status,
      variants: (product.variants ?? []).slice(0, 8).map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        title: variant.title,
        prices: (variant.prices ?? []).map((price) => ({
          currency_code: price.currency_code,
          amount: price.amount,
        })),
      })),
    })),
    note: "Results are restricted to the authenticated tenant sales channel.",
  };
}

async function orderDiagnose(context: ToolContext, args: Record<string, unknown>) {
  const rawQuery = textValue(args.query || args.order_id)
  const numericDisplayId = /^\d+$/.test(rawQuery) ? Number(rawQuery) : undefined
  if (!rawQuery) {
    return { query: "", count: 0, orders: [], note: "Provide an order id, display id or search term." }
  }
  const query = context.scope.resolve(ContainerRegistrationKeys.QUERY)
  const filters: Record<string, unknown> = {
    sales_channel_id: context.tenant.sales_channel_id,
  }
  if (/^order_/.test(rawQuery)) filters.id = rawQuery
  else if (numericDisplayId !== undefined) filters.display_id = numericDisplayId
  else filters.q = rawQuery
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "payment_status",
      "fulfillment_status",
      "total",
      "currency_code",
      "created_at",
      "sales_channel_id",
      "items.title",
      "items.quantity",
      "fulfillments.id",
      "fulfillments.status",
      "fulfillments.shipped_at",
      "fulfillments.tracking_numbers",
    ],
    filters,
  })
  return {
    query: rawQuery,
    count: data.length,
    orders: (data as Array<Record<string, unknown>>).slice(0, 10).map((order) => ({
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      total: order.total,
      currency_code: order.currency_code,
      created_at: order.created_at,
      items: order.items,
      fulfillments: order.fulfillments,
    })),
    note: "Read-only results restricted to the current tenant sales channel. Use the order id/display id for a precise diagnosis.",
  }
}

async function inventoryHealth(
  context: ToolContext,
  args: Record<string, unknown>,
) {
  const threshold = Math.max(0, Number(args.threshold ?? 10) || 10);
  const limit = safeLimit(args.limit, 15);
  const query = context.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: links } = await query.graph({
    entity: "product_sales_channel",
    fields: ["product_id", "sales_channel_id"],
    filters: {
      sales_channel_id: [context.tenant.sales_channel_id],
    },
  });
  const productIds = [
    ...new Set((links as ProductChannelLink[]).map((link) => link.product_id)),
  ];
  if (!productIds.length) {
    return {
      threshold,
      scanned_levels: 0,
      low_stock_count: 0,
      total_available: 0,
      items: [],
      note: "Only inventory attached to the tenant sales channel is included.",
    };
  }

  const products = await loadProducts(context, productIds);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const { data: offers } = await query.graph({
    entity: "offer",
    fields: [
      "id",
      "product_id",
      "variant_id",
      "seller_id",
      "inventory_items.inventory.id",
      "inventory_items.inventory.sku",
      "inventory_items.inventory.title",
      "inventory_items.inventory.location_levels.stocked_quantity",
      "inventory_items.inventory.location_levels.reserved_quantity",
      "inventory_items.inventory.location_levels.stock_locations.name",
      "inventory_items.inventory.location_levels.stock_locations.sales_channels.id",
    ],
    filters: {
      product_id: productIds,
    },
  });

  const items: Array<{
    offer_id: string;
    seller_id: string;
    product_id: string;
    product_title: string;
    variant_id: string;
    sku: string | null;
    location: string | null;
    stocked_quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    low_stock: boolean;
  }> = [];

  for (const offer of offers as OfferInventoryRecord[]) {
    const product = productsById.get(offer.product_id);
    const variant = product?.variants?.find((item) => item.id === offer.variant_id);
    for (const link of offer.inventory_items ?? []) {
      const inventory = link.inventory;
      for (const level of inventory?.location_levels ?? []) {
        const belongsToTenant = (level.stock_locations ?? []).some(
          (location) =>
            (location.sales_channels ?? []).some(
              (channel) => channel.id === context.tenant.sales_channel_id,
            ),
        );
        if (!belongsToTenant) continue;

        const stocked = numberValue(level.stocked_quantity);
        const reserved = numberValue(level.reserved_quantity);
        const available = stocked - reserved;
        items.push({
          offer_id: offer.id,
          seller_id: offer.seller_id,
          product_id: offer.product_id,
          product_title: product?.title ?? offer.product_id,
          variant_id: offer.variant_id ?? variant?.id ?? "",
          sku: inventory?.sku ?? variant?.sku ?? null,
          location: level.stock_locations?.[0]?.name ?? null,
          stocked_quantity: stocked,
          reserved_quantity: reserved,
          available_quantity: available,
          low_stock: available <= threshold,
        });
      }
    }
  }

  items.sort(
    (left, right) => left.available_quantity - right.available_quantity,
  );
  const lowStock = items.filter((item) => item.low_stock);
  return {
    threshold,
    scanned_levels: items.length,
    low_stock_count: lowStock.length,
    total_available: items.reduce(
      (total, item) => total + item.available_quantity,
      0,
    ),
    items: (lowStock.length ? lowStock : items).slice(0, limit),
    note: "Only inventory attached to the tenant sales channel is included.",
  };
}

function localErpPreview(args: Record<string, unknown>) {
  const rawItems = Array.isArray(args.items) ? args.items : [];
  const items = rawItems.slice(0, 100).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const sku = textValue(item.sku);
    const quantity = Number(item.stock ?? item.quantity ?? 0);
    if (!sku || !Number.isFinite(quantity) || quantity <= 0) return [];
    return [
      {
        sku,
        quantity: Math.trunc(quantity),
        supplier: textValue(item.supplier) || null,
      },
    ];
  });

  const payload = {
    operation: "purchase_order.preview",
    items,
    reason: textValue(args.reason) || "Inventory replenishment review",
  };
  const idempotencyKey = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);

  return {
    status: "preview_only",
    destructive: false,
    approval_required: true,
    idempotency_key: idempotencyKey,
    ...payload,
    validation: {
      item_count: items.length,
      rejected_item_count: rawItems.length - items.length,
      valid: items.length > 0,
    },
    note: "No ERP record was created or changed. A human must approve this preview.",
  };
}

async function erpPreview(context: ToolContext, args: Record<string, unknown>) {
  try {
    context.scope.resolve("operations");
  } catch {
    return localErpPreview(args);
  }

  const target = ["stock", "price", "erp"].includes(String(args.target))
    ? (String(args.target) as "stock" | "price" | "erp")
    : "stock";
  const rawItems = Array.isArray(args.items) ? args.items.slice(0, 100) : [];
  const items = rawItems.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const sku = textValue(item.sku);
    if (!sku) return [];
    const stock = Number(item.stock ?? item.quantity);
    const price = Number(item.price);
    return [
      {
        row_id: `agent_${index + 1}`,
        sku,
        stock: Number.isFinite(stock) ? Math.max(0, Math.trunc(stock)) : null,
        price: Number.isFinite(price) && price > 0 ? price : null,
        currency: (textValue(item.currency) || "EUR").toUpperCase(),
        ...(textValue(item.barcode)
          ? { barcode: textValue(item.barcode) }
          : {}),
      },
    ];
  });
  const request = {
    target,
    mode: "dry_run" as const,
    idempotency_key: `agent:${createHash("sha256")
      .update(
        JSON.stringify({
          tenant: context.tenant.id,
          target,
          items,
          reason: textValue(args.reason),
        }),
      )
      .digest("hex")
      .slice(0, 32)}`,
    items,
  };

  return previewErpSync(
    context.scope,
    context.tenant,
    request,
    context.actorId,
  );
}

async function knowledgeSearch(
  context: ToolContext,
  args: Record<string, unknown>,
) {
  const query = textValue(args.query);
  if (!query) return { query, results: [] };
  const service = context.scope.resolve<KnowledgeModuleService>("knowledge");
  const results = await service.searchKnowledge(
    context.tenant.id,
    query,
    safeLimit(args.limit, 5, 10),
  );
  return {
    query,
    results: results.map((result) => ({
      document_id: result.document_id,
      chunk_id: result.chunk_id,
      title: result.title,
      snippet: result.snippet,
      score: result.score,
    })),
  };
}

// OpenAI-compatible providers restrict function names to letters, numbers,
// underscores, and hyphens. Keep dotted names internally for readable audit
// events, but expose provider-safe aliases at the protocol boundary.
const PROVIDER_TOOL_NAMES: Record<string, string> = {
  order_diagnose: "order.diagnose",
  catalog_search: "catalog.search",
  inventory_health: "inventory.health",
  erp_preview: "erp.preview",
  knowledge_search: "knowledge.search",
};

export function toInternalToolName(name: string): string {
  return PROVIDER_TOOL_NAMES[name] ?? name;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "order_diagnose",
      description:
        "Read an order and its fulfillment state in the current tenant. Use for order, shipment, delivery, and tracking diagnosis. Never changes an order.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Order id, numeric display id, or search term." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "catalog_search",
      description:
        "Search products in the current tenant catalog. Use for product, SKU, price, or assortment questions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Product title, SKU, or free-text query.",
          },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inventory_health",
      description:
        "Read stock levels for the current tenant and identify low-stock or overstocked variants.",
      parameters: {
        type: "object",
        properties: {
          threshold: {
            type: "integer",
            minimum: 0,
            description:
              "Available quantity at or below this value is considered low stock.",
          },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "erp_preview",
      description:
        "Create a persisted dry-run ERP sync preview and audit record for stock, price, or ERP review. This tool always forces dry_run and never writes to the ERP.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["stock", "price", "erp"],
            description: "The data domain to preview.",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                stock: { type: "integer", minimum: 0 },
                price: { type: "number", exclusiveMinimum: 0 },
                currency: { type: "string" },
                barcode: { type: "string" },
              },
              required: ["sku"],
            },
          },
          reason: { type: "string" },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "knowledge_search",
      description:
        "Search the tenant knowledge base for SOPs, policies, supplier notes, and operational documents. Always cite returned document_id and chunk_id.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["query"],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  switch (toInternalToolName(name)) {
    case "catalog.search":
      return catalogSearch(context, args);
    case "inventory.health":
      return inventoryHealth(context, args);
    case "order.diagnose":
      return orderDiagnose(context, args);
    case "erp.preview":
      return erpPreview(context, args);
    case "knowledge.search":
      return knowledgeSearch(context, args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
