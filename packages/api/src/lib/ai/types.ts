import type { MedusaContainer } from "@medusajs/framework/types";
import type { TenantRecord } from "../tenant";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: LlmToolCall[];
};

export type LlmToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolContext = {
  scope: MedusaContainer;
  tenant: TenantRecord;
  actorId: string;
  role?: "viewer" | "operator" | "owner";
};

export type AgentEvent =
  | { type: "token"; content: string }
  | { type: "status"; mode: "fallback"; message: string }
  | { type: "tool_start"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | {
      type: "done";
      mode: "ai" | "demo";
      citations?: Array<{
        document_id: string;
        chunk_id: string;
        title: string;
        snippet: string;
      }>;
    }
  | { type: "error"; message: string };

export type AgentHistoryItem = {
  role: "user" | "assistant";
  content: string;
};
