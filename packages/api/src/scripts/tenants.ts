import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  linkProductsToSalesChannelWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/core-flows"
import { provisionTenant } from "../lib/tenant-config"
import type { KnowledgeModuleService } from "../modules/knowledge/service"

const configs = [
  {
    slug: "north",
    name: "North Archive",
    description: "Independent sellers, considered design, and a second life for good things.",
    sellerNames: ["Sole Society", "Kickz Corner"],
    theme: { accent: "#ed4c2d", paper: "#f3f0e8", ink: "#20211e", announcement: "MULTI-SELLER EDIT / COMPLIMENTARY SHIPPING OVER EUR 120" },
    page: {
      eyebrow: "THE INDEPENDENT EDIT / 01",
      headline: "Good design.\nAnother chapter.",
      subheading: "A considered marketplace of new, nearly-new and hard-to-find pieces from independent sellers.",
      hero_image: "/images/editorial/north-hero.jpg",
    },
  },
  {
    slug: "field",
    name: "Field Notes",
    description: "Everyday objects and outdoor essentials, selected for how they are used.",
    sellerNames: ["Trailhead Outfitters"],
    theme: { accent: "#315e49", paper: "#edf0e7", ink: "#22332a", announcement: "FIELD SUPPLY / SMALL RUNS / READY FOR EVERY DAY" },
    page: {
      eyebrow: "OUTDOOR OBJECTS / 02",
      headline: "Made to go.\nBuilt to stay.",
      subheading: "Useful things for daily movement, from a small group of independent outdoor sellers.",
      hero_image: "/images/editorial/field-hero.jpg",
    },
  },
]

const sopDocuments = [
  {
    slug: "north",
    title: "North Archive 运营 SOP",
    text: "# 店铺运营规则\n\n## 库存复核\n每日开店前检查可售库存，可售数量为库存数量减去预留数量。低于 10 件时生成补货预览，运营负责人审批后才能同步 ERP。\n\n## 商品发布\n商品必须具备 SKU、中文或英文标题、价格和库存。导入文件先校验，存在重复 SKU、非法价格或负库存时禁止提交。\n\n## 多卖家订单\n一个购物车可以包含多个卖家的商品，结账后按卖家拆分子订单。物流轨迹以各子订单的履约记录为准。",
  },
  {
    slug: "field",
    title: "Field Notes 户外履约 SOP",
    text: "# Field Notes 履约规则\n\n## 发货\n付款后的现货订单应在 48 小时内创建履约记录。户外大件商品需要独立检查包装，不能把尚未发货的订单标记为已送达。\n\n## 缺货处理\n缺货 SKU 不允许通过导入创建虚假库存。先登记供应商补货计划，确认到货后再更新库存。\n\n## 知识库\n本规则仅适用于 Field Notes 租户，其他租户不能引用。",
  },
]

export default async function seedTenants({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannels = container.resolve(Modules.SALES_CHANNEL)
  const { data: sellers } = await query.graph({ entity: "seller", fields: ["id", "name"] })
  const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
  const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id", "seller.id", "sales_channels.id"] })
  const { data: keys } = await query.graph({ entity: "api_key", fields: ["id", "title", "token"], filters: { type: "publishable" } })

  const sellerTenant = new Map<string, string>()
  for (const config of configs) {
    for (const seller of sellers as { id: string; name: string }[]) {
      if (config.sellerNames.includes(seller.name)) sellerTenant.set(seller.id, config.slug)
    }
  }
  const { data: offers } = await query.graph({
    entity: "offer",
    fields: ["product_id", "seller_id", "product.handle"],
    pagination: { take: 10000 },
  })
  const candidatesByProduct = new Map<string, { handle: string; slugs: Set<string> }>()
  for (const offer of offers as { product_id: string; seller_id: string; product?: { handle?: string } }[]) {
    const slug = sellerTenant.get(offer.seller_id)
    if (!slug) continue
    const candidate = candidatesByProduct.get(offer.product_id) ?? {
      handle: offer.product?.handle || offer.product_id,
      slugs: new Set<string>(),
    }
    candidate.slugs.add(slug)
    candidatesByProduct.set(offer.product_id, candidate)
  }
  const productsByTenant = new Map(configs.map((config) => [config.slug, [] as string[]]))
  for (const [productId, candidate] of [...candidatesByProduct].sort((a, b) => a[1].handle.localeCompare(b[1].handle))) {
    const slugs = [...candidate.slugs].sort()
    if (!slugs.length) continue
    const hash = [...candidate.handle].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 0)
    productsByTenant.get(slugs[hash % slugs.length])!.push(productId)
  }

  for (const config of configs) {
    const assignedSellers = (sellers as { id: string; name: string }[]).filter((seller) => config.sellerNames.includes(seller.name))
    if (assignedSellers.length !== config.sellerNames.length) {
      throw new Error(`Missing expected sellers for ${config.slug}. Run the catalog seed first.`)
    }
    const sellerIds = assignedSellers.map((seller) => seller.id)
    const productIds = productsByTenant.get(config.slug) ?? []
    if (!productIds.length) {
      throw new Error(`No products were assigned to tenant ${config.slug}.`)
    }

    const name = `Outlet / ${config.slug}`
    let [channel] = await salesChannels.listSalesChannels({ name })
    if (!channel) {
      const { result } = await createSalesChannelsWorkflow(container).run({ input: { salesChannelsData: [{ name }] } })
      channel = result[0]
    }
    let key = (keys as { id: string; title: string; token: string }[]).find((item) => item.title === name)
    if (!key) {
      const { result } = await createApiKeysWorkflow(container).run({ input: { api_keys: [{ title: name, type: "publishable", created_by: "" }] } })
      key = result[0]
    }
    try {
      await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: key.id, add: [channel.id] } })
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("already"))) throw error
    }
    const { data: linkedProducts } = await query.graph({
      entity: "product_sales_channel",
      fields: ["product_id"],
      filters: { sales_channel_id: [channel.id] },
    })
    const linkedProductIds = new Set((linkedProducts as { product_id: string }[]).map((link) => link.product_id))
    const productsToLink = productIds.filter((productId) => !linkedProductIds.has(productId))
    const productsToUnlink = [...linkedProductIds].filter((productId) => !productIds.includes(productId))
    if (productsToLink.length || productsToUnlink.length) {
      await linkProductsToSalesChannelWorkflow(container).run({
        input: { id: channel.id, add: productsToLink, remove: productsToUnlink },
      })
    }

    const sellerLocations = (locations as { id: string; seller?: { id: string }; sales_channels?: { id: string }[] }[])
      .filter((location) => location.seller && sellerIds.includes(location.seller.id))
      .filter((location) => !location.sales_channels?.some((salesChannel) => salesChannel.id === channel.id))
    for (const location of sellerLocations) {
      try {
        await linkSalesChannelsToStockLocationWorkflow(container).run({
          input: { id: location.id, add: [channel.id] },
        })
      } catch (error) {
        if (!(error instanceof Error && error.message.includes("already"))) throw error
      }
    }
    const tenant = await provisionTenant(container, {
      ...config,
      sellerIds,
      regionId: (regions[0] as { id: string }).id,
      salesChannelId: channel.id,
      publishableKey: key.token,
    })
    console.log(`TENANT_KEY ${config.slug} ${key.token}`)
    console.log(`TENANT_READY ${tenant.slug} sellers=${sellerIds.length} products=${productIds.length}`)
    const knowledge = container.resolve<KnowledgeModuleService>("knowledge")
    const document = sopDocuments.find((item) => item.slug === config.slug)
    if (document) {
      await knowledge.ingestDocument({
        tenantId: tenant.id,
        title: document.title,
        sourceName: `${config.slug}-operations.md`,
        sourceType: "seed",
        mimeType: "text/markdown",
        content: document.text,
        sizeBytes: Buffer.byteLength(document.text),
        createdBy: "outlet-seed",
      })
    }
  }
}
