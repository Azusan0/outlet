import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { basename, extname } from "node:path";
import { extractPdfText } from "../../../../modules/knowledge/pdf";
import {
  parseMultipartRequest,
  type MultipartFile,
} from "../../../../modules/knowledge/multipart";
import type { KnowledgeModuleService } from "../../../../modules/knowledge/service";
import {
  requireAdminTenant,
  requireOperator,
  sendRouteError,
} from "../../../../lib/ai/http";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type JsonDocumentBody = {
  title?: string;
  text?: string;
  metadata?: Record<string, unknown>;
};

function safeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 16 * 1024) {
    throw new Error("Document metadata must not exceed 16 KB");
  }
  return value as Record<string, unknown>;
}

function inferMime(file: MultipartFile): string {
  const extension = extname(file.fileName).toLocaleLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".md" || extension === ".markdown") return "text/markdown";
  if (extension === ".txt") return "text/plain";
  if (file.contentType && file.contentType !== "application/octet-stream") {
    return file.contentType.toLocaleLowerCase();
  }
  return "";
}

function decodeTextFile(file: MultipartFile): string {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(file.data);
  if (text.includes("\u0000")) {
    throw new Error("Text document contains binary data");
  }
  return text;
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  try {
    const { tenant } = await requireAdminTenant(req);
    const service = req.scope.resolve<KnowledgeModuleService>("knowledge");
    res.json({ documents: await service.listDocuments(tenant.id) });
  } catch (error) {
    sendRouteError(res, error);
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  try {
    const { tenant, membership, actorId } = await requireAdminTenant(req);
    requireOperator(membership.role);
    const service = req.scope.resolve<KnowledgeModuleService>("knowledge");
    const contentType = req.get("content-type") ?? "";

    if (contentType.startsWith("multipart/form-data")) {
      const parsed = await parseMultipartRequest(req);
      const file =
        parsed.files.find((item) => item.fieldName === "file") ??
        parsed.files[0];
      if (!file) throw new Error("Multipart upload must include a file field");
      if (!file.fileName) throw new Error("Uploaded file must have a filename");
      if (file.data.length > MAX_FILE_BYTES) {
        throw new Error("Upload exceeds the 5 MB file limit");
      }

      const mimeType = inferMime(file);
      const supported = new Set([
        "text/plain",
        "text/markdown",
        "text/x-markdown",
        "application/pdf",
      ]);
      if (!supported.has(mimeType)) {
        throw new Error(
          "Unsupported file type. Upload txt, md, or a text-based PDF",
        );
      }

      let content = "";
      try {
        content =
          mimeType === "application/pdf"
            ? extractPdfText(file.data)
            : decodeTextFile(file);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not parse file";
        res.status(422).json({ message });
        return;
      }

      const result = await service.ingestDocument({
        tenantId: tenant.id,
        title:
          parsed.fields.title?.trim().slice(0, 180) ||
          basename(file.fileName, extname(file.fileName)).slice(0, 180) ||
          "Uploaded document",
        sourceName: file.fileName.slice(0, 255),
        sourceType: "upload",
        mimeType,
        content,
        sizeBytes: file.data.length,
        createdBy: actorId,
        metadata: safeMetadata(parsed.fields.metadata),
      });

      res.status(result.duplicate ? 200 : 201).json(result);
      return;
    }

    const body = (req.body ?? {}) as JsonDocumentBody;
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim())
      throw new Error("JSON document body must include a non-empty text field");
    if (Buffer.byteLength(text, "utf8") > MAX_FILE_BYTES) {
      throw new Error("Document text must not exceed 5 MB");
    }

    const firstLine = text.trim().split(/\r?\n/, 1)[0]?.slice(0, 180);
    const result = await service.ingestDocument({
      tenantId: tenant.id,
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim().slice(0, 180)
          : firstLine || "Text note",
      sourceName: "manual-entry.txt",
      sourceType: "text",
      mimeType: "text/plain",
      content: text,
      sizeBytes: Buffer.byteLength(text, "utf8"),
      createdBy: actorId,
      metadata: safeMetadata(body.metadata),
    });

    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    sendRouteError(res, error);
  }
}
