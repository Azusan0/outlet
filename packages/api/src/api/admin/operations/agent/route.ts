import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { runOperationsAgent } from "../../../../lib/ai/agent";
import {
  initializeSse,
  requireAdminTenant,
  sendRouteError,
  writeSse,
} from "../../../../lib/ai/http";
import type { AgentHistoryItem } from "../../../../lib/ai/types";

type AgentBody = {
  message?: string;
  history?: AgentHistoryItem[];
};

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  try {
    const { tenant, membership, actorId } = await requireAdminTenant(req);
    const body = (req.body ?? {}) as AgentBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) throw new Error("Agent message is required");
    if (message.length > 4_000) {
      throw new Error("Agent message must not exceed 4,000 characters");
    }

    initializeSse(res);
    for await (const event of runOperationsAgent({
      message,
      history: body.history,
      context: {
        scope: req.scope,
        tenant,
        actorId,
        role: membership.role,
      },
    })) {
      writeSse(res, event);
    }
    res.end();
  } catch (error) {
    if (res.headersSent) {
      writeSse(res, {
        type: "error",
        message:
          error instanceof Error ? error.message.slice(0, 500) : "Agent failed",
      });
      res.end();
      return;
    }
    sendRouteError(res, error);
  }
}
