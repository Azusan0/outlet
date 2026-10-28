import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { assertTenantUser, type TenantRecord } from "../tenant"

export type OperationsRequest = (MedusaRequest | AuthenticatedMedusaRequest) & {
  context?: Record<string, unknown> & { tenant?: TenantRecord }
  auth_context?: { actor_id?: string; actor_type?: string }
}

export function requireOperationsTenant(req: OperationsRequest): TenantRecord {
  const tenant = req.context?.tenant as
    | (TenantRecord & { status?: string })
    | undefined
  if (!tenant?.id || tenant.status === "disabled") {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "An active tenant context is required"
    )
  }
  return tenant
}

export async function requireOperationsOperator(req: OperationsRequest) {
  const tenant = requireOperationsTenant(req)
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Authenticated operations user is required"
    )
  }
  const membership = await assertTenantUser(req.scope, tenant.id, actorId)
  if (membership.role === "viewer") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Viewer role cannot run operations"
    )
  }
  return { tenant, actorId }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength: number
): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string" || !value.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${field} must be a non-empty string`
    )
  }
  const normalized = value.trim()
  if (normalized.length > maxLength) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${field} must be at most ${maxLength} characters`
    )
  }
  return normalized
}

export function parseIdempotencyKey(value: unknown): string {
  const key = optionalString(value, "idempotency_key", 128)
  if (!key) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "idempotency_key is required"
    )
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "idempotency_key may only contain letters, numbers, dot, underscore, colon and hyphen"
    )
  }
  return key
}
