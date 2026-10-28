import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261028060927 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "tenant_theme" drop constraint if exists "tenant_theme_tenant_id_unique";`);
    this.addSql(`alter table if exists "tenant_seller" drop constraint if exists "tenant_seller_seller_id_unique";`);
    this.addSql(`alter table if exists "tenant_seller" drop constraint if exists "tenant_seller_tenant_id_seller_id_unique";`);
    this.addSql(`alter table if exists "tenant_membership" drop constraint if exists "tenant_membership_tenant_id_user_id_unique";`);
    this.addSql(`alter table if exists "tenant_domain" drop constraint if exists "tenant_domain_hostname_unique";`);
    this.addSql(`alter table if exists "tenant" drop constraint if exists "tenant_sales_channel_id_unique";`);
    this.addSql(`alter table if exists "tenant" drop constraint if exists "tenant_slug_unique";`);
    this.addSql(`alter table if exists "storefront_page" drop constraint if exists "storefront_page_tenant_id_slug_unique";`);
    this.addSql(`create table if not exists "storefront_page" ("id" text not null, "tenant_id" text not null, "slug" text not null default 'home', "eyebrow" text not null default '', "headline" text not null, "subheading" text not null default '', "hero_image" text not null default '', "config" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "storefront_page_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_storefront_page_deleted_at" ON "storefront_page" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_storefront_page_tenant_id_slug_unique" ON "storefront_page" ("tenant_id", "slug") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant" ("id" text not null, "slug" text not null, "name" text not null, "description" text not null default '', "status" text check ("status" in ('active', 'disabled')) not null default 'active', "sales_channel_id" text not null, "region_id" text not null, "publishable_key" text not null default '', "default_country" text not null default 'de', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_slug_unique" ON "tenant" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_deleted_at" ON "tenant" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_sales_channel_id_unique" ON "tenant" ("sales_channel_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant_domain" ("id" text not null, "tenant_id" text not null, "hostname" text not null, "is_primary" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_domain_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_domain_hostname_unique" ON "tenant_domain" ("hostname") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_domain_deleted_at" ON "tenant_domain" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant_membership" ("id" text not null, "tenant_id" text not null, "user_id" text not null, "role" text check ("role" in ('viewer', 'operator', 'owner')) not null default 'viewer', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_membership_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_membership_deleted_at" ON "tenant_membership" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_membership_tenant_id_user_id_unique" ON "tenant_membership" ("tenant_id", "user_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant_seller" ("id" text not null, "tenant_id" text not null, "seller_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_seller_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_seller_deleted_at" ON "tenant_seller" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_seller_tenant_id_seller_id_unique" ON "tenant_seller" ("tenant_id", "seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_seller_seller_id_unique" ON "tenant_seller" ("seller_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tenant_theme" ("id" text not null, "tenant_id" text not null, "accent" text not null default '#ee4d2d', "paper" text not null default '#f4f2ec', "ink" text not null default '#20211e', "announcement" text not null default '', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_theme_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_theme_tenant_id_unique" ON "tenant_theme" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tenant_theme_deleted_at" ON "tenant_theme" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "storefront_page" cascade;`);

    this.addSql(`drop table if exists "tenant" cascade;`);

    this.addSql(`drop table if exists "tenant_domain" cascade;`);

    this.addSql(`drop table if exists "tenant_membership" cascade;`);

    this.addSql(`drop table if exists "tenant_seller" cascade;`);

    this.addSql(`drop table if exists "tenant_theme" cascade;`);
  }

}
