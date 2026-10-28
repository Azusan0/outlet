import type { MedusaResponse } from "@medusajs/framework/http";
import { previewErpSync } from "../../../../../lib/operations/erp";
import {
  isRecord,
  requireOperationsOperator,
  type OperationsRequest,
} from "../../../../../lib/operations/request";

export async function POST(req: OperationsRequest, res: MedusaResponse) {
  const { tenant, actorId } = await requireOperationsOperator(req);
  if (!isRecord(req.body)) {
    res.status(400).json({ message: "A JSON body is required" });
    return;
  }
  res.json(
    await previewErpSync(
      req.scope,
      tenant,
      { ...req.body, mode: "dry_run" },
      actorId,
    ),
  );
}
