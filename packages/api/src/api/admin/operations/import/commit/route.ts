import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import type { OperationsModuleService } from "../../../../../modules/operations/service";
import { commitImportRows } from "../../../../../lib/operations/importer";
import {
  isRecord,
  requireOperationsOperator,
  type OperationsRequest,
} from "../../../../../lib/operations/request";
import type {
  ParsedImportRow,
  RowError,
} from "../../../../../lib/operations/types";

function parseCommitBody(body: unknown) {
  if (!isRecord(body)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A JSON body is required",
    );
  }
  if (typeof body.batch_id !== "string" || !body.batch_id.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "batch_id is required",
    );
  }
  let rowIds: string[] | undefined;
  if (body.row_ids !== undefined) {
    if (
      !Array.isArray(body.row_ids) ||
      body.row_ids.length > 2_000 ||
      body.row_ids.some((value) => typeof value !== "string" || !value.trim())
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "row_ids must be an array of at most 2000 non-empty strings",
      );
    }
    rowIds = [...new Set(body.row_ids.map((value: string) => value.trim()))];
  }
  return { batchId: body.batch_id.trim(), rowIds };
}

export async function POST(req: OperationsRequest, res: MedusaResponse) {
  const { tenant, actorId } = await requireOperationsOperator(req);
  const { batchId, rowIds } = parseCommitBody(req.body);
  const service = req.scope.resolve<OperationsModuleService>("operations");
  const [batch] = await service.listImportBatches({
    id: batchId,
    tenant_id: tenant.id,
  });
  if (!batch) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Import batch not found",
    );
  }
  if (batch.status !== "preview") {
    res.json({
      ...(batch.result_json ?? {}),
      batch_id: batch.id,
      idempotent_replay: true,
    });
    return;
  }

  const globalErrors = (batch.errors_json ?? []) as unknown as RowError[];
  if (globalErrors.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Import batch has file-level errors: ${globalErrors
        .map((error) => error.message)
        .join("; ")}`,
    );
  }
  const storedRows = (batch.rows_json ?? []) as unknown as ParsedImportRow[];
  const selected = rowIds
    ? storedRows.filter((row) => rowIds.includes(row.id))
    : storedRows;
  if (rowIds && selected.length !== rowIds.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "row_ids contains one or more rows that are not in this batch",
    );
  }
  if (!selected.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No rows were selected for commit",
    );
  }
  const invalid = selected.filter((row) => row.errors?.length);
  if (invalid.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Commit blocked: ${invalid.length} selected rows have validation errors`,
    );
  }

  const result = await commitImportRows(req.scope, tenant, selected);
  result.batch_id = batch.id;
  await service.updateImportBatches({
    id: batch.id,
    status: result.status,
    result_json: result,
  });
  await service.createAuditEvents(
    result.rows.map((row) => ({
      tenant_id: tenant.id,
      actor_id: actorId,
      action: "operations.import.commit",
      resource_type: "import_batch",
      resource_id: batch.id,
      status: (row.status === "failed" ? "failure" : "success") as
        "failure" | "success",
      details_json: { row },
      error_message: row.error ?? null,
    })),
  );

  res.json(result);
}
