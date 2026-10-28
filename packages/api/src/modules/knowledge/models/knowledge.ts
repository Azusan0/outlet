import { model } from "@medusajs/framework/utils";

export const KnowledgeDocument = model
  .define("knowledge_document", {
    id: model.id({ prefix: "kdoc" }).primaryKey(),
    tenant_id: model.text(),
    title: model.text(),
    source_name: model.text(),
    source_type: model.enum(["upload", "text", "seed"]).default("text"),
    mime_type: model.text().default("text/plain"),
    size_bytes: model.number().default(0),
    content_hash: model.text(),
    content: model.text(),
    created_by: model.text(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ["tenant_id"] },
    { on: ["tenant_id", "content_hash"], unique: true },
  ]);

export const KnowledgeChunk = model
  .define("knowledge_chunk", {
    id: model.id({ prefix: "kchunk" }).primaryKey(),
    tenant_id: model.text(),
    document_id: model.text(),
    position: model.number(),
    content: model.text(),
    token_estimate: model.number().default(0),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ["tenant_id"] },
    { on: ["tenant_id", "document_id"] },
    { on: ["tenant_id", "document_id", "position"], unique: true },
  ]);
