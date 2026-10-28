import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import multer from "multer";
import type { OperationsModuleService } from "../../../../../modules/operations/service";
import {
  MAX_IMPORT_FILE_BYTES,
  hashImportFile,
  parseImportSpreadsheet,
} from "../../../../../lib/operations/spreadsheet";
import {
  requireOperationsOperator,
  type OperationsRequest,
} from "../../../../../lib/operations/request";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMPORT_FILE_BYTES,
    files: 1,
    fields: 5,
  },
});

type UploadRequest = OperationsRequest & {
  file?: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
};

function parseMultipart(req: OperationsRequest, res: MedusaResponse) {
  return new Promise<void>((resolve, reject) => {
    upload.single("file")(req as never, res as never, (error: unknown) => {
      if (!error) {
        resolve();
        return;
      }
      const multerError = error as { code?: string; message?: string };
      reject(
        new MedusaError(
          MedusaError.Types.INVALID_DATA,
          multerError.code === "LIMIT_FILE_SIZE"
            ? "The uploaded file exceeds the 5 MB limit"
            : `Invalid multipart upload: ${multerError.message ?? "unknown error"}`,
        ),
      );
    });
  });
}

export async function POST(req: OperationsRequest, res: MedusaResponse) {
  const { tenant, actorId } = await requireOperationsOperator(req);
  await parseMultipart(req, res);
  const file = (req as UploadRequest).file;
  if (!file) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'A multipart field named "file" is required',
    );
  }
  if (!file.size || !file.buffer.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The uploaded file is empty",
    );
  }

  const fileName = file.originalname.replace(/[\\/]/g, "_").slice(0, 255);
  const parsed = parseImportSpreadsheet(file.buffer, fileName);
  const service = req.scope.resolve<OperationsModuleService>("operations");
  const rowsJson = parsed.rows as unknown as Record<string, unknown>;
  const errorsJson = parsed.errors as unknown as Record<string, unknown>;
  const summaryJson = parsed.summary as unknown as Record<string, unknown>;
  const [batch] = await service.createImportBatches([
    {
      tenant_id: tenant.id,
      file_name: fileName,
      file_sha256: hashImportFile(file.buffer),
      status: "preview",
      rows_json: rowsJson,
      errors_json: errorsJson,
      summary_json: summaryJson,
      result_json: null,
      created_by: actorId,
    },
  ]);
  if (!batch) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Failed to persist the import batch",
    );
  }
  await service.createAuditEvents({
    tenant_id: tenant.id,
    actor_id: actorId,
    action: "operations.import.preview",
    resource_type: "import_batch",
    resource_id: batch.id,
    status: "preview",
    details_json: {
      file_name: fileName,
      sheet_name: parsed.sheet_name,
      summary: parsed.summary,
    },
    error_message: null,
  });

  res.status(201).json({
    batch_id: batch.id,
    file_name: fileName,
    sheet_name: parsed.sheet_name,
    headers: parsed.headers,
    mapping: parsed.mapping,
    rows: parsed.rows.map((row) => ({
      ...row,
      row_id: row.id,
      status: row.errors.length ? "invalid" : "valid",
    })),
    errors: parsed.errors,
    summary: parsed.summary,
  });
}
