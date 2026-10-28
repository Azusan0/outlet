import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { assertTenantUser } from "../tenant";
import type { TenantRecord } from "../tenant";
import type { AgentEvent } from "./types";

type AdminTenantRequest = AuthenticatedMedusaRequest & {
  context: {
    tenant?: TenantRecord;
  };
};

export async function requireAdminTenant(req: AuthenticatedMedusaRequest) {
  const tenant = (req as AdminTenantRequest).context?.tenant;
  const actorId = req.auth_context?.actor_id;
  if (!tenant?.id || !actorId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Tenant authentication required",
    );
  }
  const membership = await assertTenantUser(req.scope, tenant.id, actorId);
  return { tenant, membership, actorId };
}

export function requireOperator(role: string) {
  if (role === "viewer") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Viewer role cannot modify operations data",
    );
  }
}

export function sendRouteError(res: MedusaResponse, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const medusaStatus =
    error instanceof MedusaError
      ? {
          [MedusaError.Types.UNAUTHORIZED]: 401,
          [MedusaError.Types.NOT_ALLOWED]: 403,
          [MedusaError.Types.NOT_FOUND]: 404,
          [MedusaError.Types.INVALID_DATA]: 400,
          [MedusaError.Types.DUPLICATE_ERROR]: 409,
        }[error.type]
      : undefined;
  const status =
    medusaStatus ??
    (/5 MB|exceed/i.test(message)
      ? 413
      : /PDF|multipart|JSON|empty|unsupported|must|required/i.test(message)
        ? 400
        : 500);
  res.status(status).json({ message });
}

export function initializeSse(res: MedusaResponse) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function writeSse(res: MedusaResponse, event: AgentEvent) {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
