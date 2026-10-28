import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261028060946 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "knowledge_document" drop constraint if exists "knowledge_document_tenant_id_content_hash_unique";`);
    this.addSql(`alter table if exists "knowledge_chunk" drop constraint if exists "knowledge_chunk_tenant_id_document_id_position_unique";`);
    this.addSql(`create table if not exists "knowledge_chunk" ("id" text not null, "tenant_id" text not null, "document_id" text not null, "position" integer not null, "content" text not null, "token_estimate" integer not null default 0, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "knowledge_chunk_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_knowledge_chunk_deleted_at" ON "knowledge_chunk" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_knowledge_chunk_tenant_id" ON "knowledge_chunk" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_knowledge_chunk_tenant_id_document_id" ON "knowledge_chunk" ("tenant_id", "document_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_knowledge_chunk_tenant_id_document_id_position_unique" ON "knowledge_chunk" ("tenant_id", "document_id", "position") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "knowledge_document" ("id" text not null, "tenant_id" text not null, "title" text not null, "source_name" text not null, "source_type" text check ("source_type" in ('upload', 'text', 'seed')) not null default 'text', "mime_type" text not null default 'text/plain', "size_bytes" integer not null default 0, "content_hash" text not null, "content" text not null, "created_by" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "knowledge_document_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_knowledge_document_deleted_at" ON "knowledge_document" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_knowledge_document_tenant_id" ON "knowledge_document" ("tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_knowledge_document_tenant_id_content_hash_unique" ON "knowledge_document" ("tenant_id", "content_hash") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "knowledge_chunk" cascade;`);

    this.addSql(`drop table if exists "knowledge_document" cascade;`);
  }

}
