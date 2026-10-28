import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261028060945 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "operations_sync_job" drop constraint if exists "operations_sync_job_tenant_id_idempotency_key_unique";`);
    this.addSql(`create table if not exists "operations_audit_event" ("id" text not null, "tenant_id" text not null, "actor_id" text not null, "action" text not null, "resource_type" text not null, "resource_id" text null, "status" text check ("status" in ('preview', 'success', 'failure')) not null, "details_json" jsonb null, "error_message" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "operations_audit_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operations_audit_event_deleted_at" ON "operations_audit_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operations_audit_event_tenant_id_created_at" ON "operations_audit_event" ("tenant_id", "created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operations_audit_event_tenant_id_resource_type_resource_id" ON "operations_audit_event" ("tenant_id", "resource_type", "resource_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "operations_import_batch" ("id" text not null, "tenant_id" text not null, "file_name" text not null, "file_sha256" text not null, "status" text check ("status" in ('preview', 'committed', 'partial', 'failed')) not null default 'preview', "rows_json" jsonb not null, "errors_json" jsonb not null, "summary_json" jsonb not null, "result_json" jsonb null, "created_by" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "operations_import_batch_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operations_import_batch_deleted_at" ON "operations_import_batch" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operations_import_batch_tenant_id_created_at" ON "operations_import_batch" ("tenant_id", "created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operations_import_batch_tenant_id_file_sha256" ON "operations_import_batch" ("tenant_id", "file_sha256") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "operations_sync_job" ("id" text not null, "tenant_id" text not null, "channel" text check ("channel" in ('stock', 'price', 'erp')) not null, "mode" text check ("mode" in ('dry_run', 'execute')) not null, "status" text check ("status" in ('preview', 'running', 'completed', 'partial', 'failed')) not null default 'preview', "idempotency_key" text not null, "request_json" jsonb not null, "result_json" jsonb null, "error_message" text null, "created_by" text not null, "completed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "operations_sync_job_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operations_sync_job_deleted_at" ON "operations_sync_job" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_operations_sync_job_tenant_id_idempotency_key_unique" ON "operations_sync_job" ("tenant_id", "idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_operations_sync_job_tenant_id_created_at" ON "operations_sync_job" ("tenant_id", "created_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "operations_audit_event" cascade;`);

    this.addSql(`drop table if exists "operations_import_batch" cascade;`);

    this.addSql(`drop table if exists "operations_sync_job" cascade;`);
  }

}
