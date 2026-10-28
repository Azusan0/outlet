import { getAiConfig } from "./config";
import type { ChatMessage, LlmToolCall, ToolDefinition } from "./types";

type LlmStreamEvent =
  | { type: "token"; content: string }
  | {
      type: "complete";
      content: string;
      toolCalls: LlmToolCall[];
      finishReason: string | null;
    };

type ToolCallAccumulator = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

function completionEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

function splitForDisplay(content: string): string[] {
  if (!content) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < content.length) {
    const end = Math.min(content.length, cursor + 18);
    chunks.push(content.slice(cursor, end));
    cursor = end;
  }
  return chunks;
}

function normalizeToolCalls(value: unknown): LlmToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const call = item as {
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    };
    if (!call.function?.name) return [];
    return [
      {
        id: call.id || `tool_${index}`,
        type: "function" as const,
        function: {
          name: call.function.name,
          arguments: call.function.arguments || "{}",
        },
      },
    ];
  });
}

async function providerError(response: Response): Promise<Error> {
  let detail = "";
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    detail = payload.error?.message || payload.message || "";
  } catch {
    // Avoid returning provider HTML or echoing credentials.
  }
  return new Error(
    `AI provider returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
  );
}

export async function* streamChatCompletion(input: {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  signal: AbortSignal;
}): AsyncGenerator<LlmStreamEvent> {
  const config = getAiConfig();
  const response = await fetch(completionEndpoint(config.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: "auto",
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    }),
    signal: input.signal,
  });

  if (!response.ok) throw await providerError(response);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: unknown;
        };
        finish_reason?: string | null;
      }>;
    };
    const message = payload.choices?.[0]?.message;
    const content = message?.content ?? "";
    for (const chunk of splitForDisplay(content)) {
      yield { type: "token", content: chunk };
    }
    yield {
      type: "complete",
      content,
      toolCalls: normalizeToolCalls(message?.tool_calls),
      finishReason: payload.choices?.[0]?.finish_reason ?? null,
    };
    return;
  }

  if (!response.body) throw new Error("AI provider returned an empty stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const toolCalls = new Map<number, ToolCallAccumulator>();
  let content = "";
  let finishReason: string | null = null;
  let buffer = "";
  let completed = false;

  const consumePayload = (data: string) => {
    const payload = JSON.parse(data) as {
      error?: { message?: string };
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        finish_reason?: string | null;
      }>;
    };
    if (payload.error?.message) {
      throw new Error(
        `AI provider stream error: ${payload.error.message.slice(0, 300)}`,
      );
    }

    const choice = payload.choices?.[0];
    if (!choice) return null;
    const token = choice.delta?.content ?? "";
    if (token) content += token;

    for (const fragment of choice.delta?.tool_calls ?? []) {
      const index = fragment.index ?? 0;
      const existing = toolCalls.get(index) ?? {
        id: "",
        type: "function" as const,
        function: { name: "", arguments: "" },
      };
      if (fragment.id) existing.id = fragment.id;
      if (fragment.type === "function") existing.type = "function";
      if (fragment.function?.name)
        existing.function.name += fragment.function.name;
      if (fragment.function?.arguments) {
        existing.function.arguments += fragment.function.arguments;
      }
      toolCalls.set(index, existing);
    }

    if (choice.finish_reason) finishReason = choice.finish_reason;
    return token;
  };

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") {
          completed = true;
          break;
        }
        const token = consumePayload(data);
        if (token) yield { type: "token", content: token };
      }
    }

    if (buffer.startsWith("data:")) {
      const data = buffer.slice(5).trim();
      if (data && data !== "[DONE]") {
        const token = consumePayload(data);
        if (token) yield { type: "token", content: token };
      }
    }
  } finally {
    reader.releaseLock();
  }

  const normalizedCalls = [...toolCalls.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([index, call]) =>
      call.function.name
        ? [
            {
              id: call.id || `tool_${index}`,
              type: "function" as const,
              function: call.function,
            },
          ]
        : [],
    );

  yield {
    type: "complete",
    content,
    toolCalls: normalizedCalls,
    finishReason,
  };
}
