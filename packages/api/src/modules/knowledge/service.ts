import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import { createHash } from "node:crypto";
import {
  chunkDocumentText,
  estimateTokens,
  normalizeDocumentText,
} from "./chunking";
import { KnowledgeChunk, KnowledgeDocument } from "./models/knowledge";
import { KnowledgeSearchResult, rankKnowledgeChunks } from "./search";

export type IngestKnowledgeInput = {
  tenantId: string;
  title: string;
  sourceName: string;
  sourceType: "upload" | "text" | "seed";
  mimeType: string;
  content: string;
  sizeBytes: number;
  createdBy: string;
  metadata?: Record<string, unknown>;
};

type KnowledgeDocumentRecord = {
  id: string;
  tenant_id: string;
  title: string;
  source_name: string;
  source_type: string;
  mime_type: string;
  size_bytes: number;
  content_hash: string;
  content: string;
  created_by: string;
  metadata: Record<string, unknown> | null;
  created_at?: string | Date;
  deleted_at?: string | Date | null;
};

type KnowledgeChunkRecord = {
  id: string;
  tenant_id: string;
  document_id: string;
  position: number;
  content: string;
  token_estimate: number;
  deleted_at?: string | Date | null;
};

export class KnowledgeModuleService extends MedusaService({
  KnowledgeDocument,
  KnowledgeChunk,
}) {
  async ingestDocument(input: IngestKnowledgeInput) {
    const content = normalizeDocumentText(input.content);
    if (!content) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Document text is empty",
      );
    }
    if (Buffer.byteLength(content, "utf8") > 5 * 1024 * 1024) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Document text must not exceed 5 MB",
      );
    }

    const contentHash = createHash("sha256").update(content).digest("hex");
    const chunks = chunkDocumentText(content);
    if (!chunks.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Document did not produce any searchable chunks",
      );
    }

    const [duplicate] = (await this.listKnowledgeDocuments(
      { tenant_id: input.tenantId, content_hash: contentHash },
      { take: 1, withDeleted: true },
    )) as unknown as KnowledgeDocumentRecord[];

    if (duplicate) {
      if (duplicate.deleted_at) {
        await this.restoreKnowledgeDocuments([duplicate.id]);
      }
      const existingChunks = (await this.listKnowledgeChunks(
        { tenant_id: input.tenantId, document_id: duplicate.id },
        { take: 5000, withDeleted: true },
      )) as KnowledgeChunkRecord[];
      if (!existingChunks.length) {
        await this.createKnowledgeChunks(
          chunks.map((chunk) => ({
            tenant_id: input.tenantId,
            document_id: duplicate.id,
            position: chunk.position,
            content: chunk.content,
            token_estimate: chunk.token_estimate,
            metadata: { source_name: input.sourceName },
          })),
        );
      } else {
        const deletedChunkIds = existingChunks
          .filter((chunk) => chunk.deleted_at)
          .map((chunk) => chunk.id);
        if (deletedChunkIds.length) {
          await this.restoreKnowledgeChunks(deletedChunkIds);
        }
      }
      return {
        duplicate: true,
        document: this.publicDocument(duplicate),
        chunk_count: existingChunks.length || chunks.length,
      };
    }

    let document: KnowledgeDocumentRecord | undefined;
    try {
      document = (await this.createKnowledgeDocuments({
        tenant_id: input.tenantId,
        title: input.title,
        source_name: input.sourceName,
        source_type: input.sourceType,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        content_hash: contentHash,
        content,
        created_by: input.createdBy,
        metadata: input.metadata ?? null,
      })) as unknown as KnowledgeDocumentRecord;

      await this.createKnowledgeChunks(
        chunks.map((chunk) => ({
          tenant_id: input.tenantId,
          document_id: document!.id,
          position: chunk.position,
          content: chunk.content,
          token_estimate: chunk.token_estimate,
          metadata: {
            source_name: input.sourceName,
          },
        })),
      );

      return {
        duplicate: false,
        document: this.publicDocument(document),
        chunk_count: chunks.length,
      };
    } catch (error) {
      if (document) {
        await this.deleteKnowledgeDocuments(document.id).catch(() => undefined);
      }
      throw error;
    }
  }

  async searchKnowledge(
    tenantId: string,
    query: string,
    limit = 5,
  ): Promise<KnowledgeSearchResult[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const chunks = (await this.listKnowledgeChunks(
      { tenant_id: tenantId },
      { take: 5000 },
    )) as KnowledgeChunkRecord[];
    if (!chunks.length) return [];

    const documentIds = [...new Set(chunks.map((chunk) => chunk.document_id))];
    const documents = (await this.listKnowledgeDocuments(
      { tenant_id: tenantId, id: documentIds },
      { take: documentIds.length },
    )) as unknown as KnowledgeDocumentRecord[];

    return rankKnowledgeChunks(trimmedQuery, chunks, documents, limit);
  }

  async listDocuments(tenantId: string) {
    const documents = (await this.listKnowledgeDocuments(
      { tenant_id: tenantId },
      { take: 50, order: { created_at: "DESC" } },
    )) as unknown as KnowledgeDocumentRecord[];

    return documents.map((document) => ({
      ...this.publicDocument(document),
      preview: document.content.slice(0, 240),
    }));
  }

  async removeDocument(tenantId: string, documentId: string) {
    const document = (await this.retrieveKnowledgeDocument(
      documentId,
    )) as unknown as KnowledgeDocumentRecord;
    if (document.tenant_id !== tenantId) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Document not found");
    }

    await this.deleteKnowledgeChunks({
      tenant_id: tenantId,
      document_id: documentId,
    });
    await this.deleteKnowledgeDocuments(documentId);
  }

  private publicDocument(document: KnowledgeDocumentRecord) {
    return {
      id: document.id,
      title: document.title,
      source_name: document.source_name,
      source_type: document.source_type,
      mime_type: document.mime_type,
      size_bytes: document.size_bytes,
      created_by: document.created_by,
      metadata: document.metadata,
      created_at:
        document.created_at instanceof Date
          ? document.created_at.toISOString()
          : document.created_at,
      token_estimate: estimateTokens(document.content),
    };
  }
}

export default KnowledgeModuleService;
