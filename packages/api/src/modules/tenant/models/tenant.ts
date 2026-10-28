import { model } from "@medusajs/framework/utils"

export const Tenant = model
  .define("tenant", {
    id: model.id({ prefix: "ten" }).primaryKey(),
    slug: model.text().unique(),
    name: model.text(),
    description: model.text().default(""),
    status: model.enum(["active", "disabled"]).default("active"),
    sales_channel_id: model.text(),
    region_id: model.text(),
    publishable_key: model.text().default(""),
    default_country: model.text().default("de"),
  })
  .indexes([{ on: ["sales_channel_id"], unique: true }])

export const TenantSeller = model
  .define("tenant_seller", {
    id: model.id({ prefix: "tensel" }).primaryKey(),
    tenant_id: model.text(),
    seller_id: model.text(),
  })
  .indexes([
    { on: ["tenant_id", "seller_id"], unique: true },
    { on: ["seller_id"], unique: true },
  ])

export const TenantDomain = model
  .define("tenant_domain", {
    id: model.id({ prefix: "tendom" }).primaryKey(),
    tenant_id: model.text(),
    hostname: model.text().unique(),
    is_primary: model.boolean().default(false),
  })

export const TenantTheme = model.define("tenant_theme", {
  id: model.id({ prefix: "tenthm" }).primaryKey(),
  tenant_id: model.text().unique(),
  accent: model.text().default("#ee4d2d"),
  paper: model.text().default("#f4f2ec"),
  ink: model.text().default("#20211e"),
  announcement: model.text().default(""),
})

export const StorefrontPage = model
  .define("storefront_page", {
    id: model.id({ prefix: "tenpage" }).primaryKey(),
    tenant_id: model.text(),
    slug: model.text().default("home"),
    eyebrow: model.text().default(""),
    headline: model.text(),
    subheading: model.text().default(""),
    hero_image: model.text().default(""),
    config: model.json().nullable(),
  })
  .indexes([{ on: ["tenant_id", "slug"], unique: true }])

export const TenantMembership = model
  .define("tenant_membership", {
    id: model.id({ prefix: "tenmem" }).primaryKey(),
    tenant_id: model.text(),
    user_id: model.text(),
    role: model.enum(["viewer", "operator", "owner"]).default("viewer"),
  })
  .indexes([{ on: ["tenant_id", "user_id"], unique: true }])
