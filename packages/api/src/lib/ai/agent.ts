import { getAiConfig } from "./config";
import { streamChatCompletion } from "./llm";
import { executeTool, TOOL_DEFINITIONS } from "./tools";
import type {
  AgentEvent,
  AgentHistoryItem,
  ChatMessage,
  LlmToolCall,
  ToolContext,
} from "./types";

const SYSTEM_PROMPT = `You are Outlet Operations Copilot, an AI operations assistant for a multi-tenant commerce platform.

Rules:
1. Use tools for factual catalog, inventory, ERP preview, and knowledge-base questions. Never invent stock, SKU, order, or SOP facts.
2. Every knowledge-base answer must cite the returned document title and document_id/chunk_id.
3. ERP tools are preview-only. Never claim that a purchase order or external ERP record was created.
4. Keep answers concise, operational, and explicit about uncertainty.
5. The tenant is already enforced by the server. Never ask for or trust a tenant_id from the user.
6. Respond in the same language as the user unless they ask otherwise.`;

const TOOL_TIMEOUT_MS = 10_000;

function parseArguments(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function executeToolWithTimeout(
  call: LlmToolCall,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      executeTool(call.function.name, args, context),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Tool ${call.function.name} timed out`)),
          TOOL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sanitizeHistory(
  history: AgentHistoryItem[] | undefined,
): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim(),
    )
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 4_000),
    }));
}

function extractCitations(result: unknown) {
  if (!result || typeof result !== "object") return [];
  const results = (result as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const citation = item as Record<string, unknown>;
    if (
      typeof citation.document_id !== "string" ||
      typeof citation.chunk_id !== "string" ||
      typeof citation.title !== "string" ||
      typeof citation.snippet !== "string"
    ) {
      return [];
    }
    return [
      {
        document_id: citation.document_id,
        chunk_id: citation.chunk_id,
        title: citation.title,
        snippet: citation.snippet,
      },
    ];
  });
}

async function* runDemoAgent(
  message: string,
  context: ToolContext,
  fallbackReason?: string,
): AsyncGenerator<AgentEvent> {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: "knowledge.search", args: { query: message, limit: 3 } },
  ];
  if (/商品|产品|sku|catalog|product|price|价格/i.test(message)) {
    calls.push({ name: "catalog.search", args: { query: message, limit: 5 } });
  }
  if (/库存|补货|缺货|inventory|stock|erp/i.test(message)) {
    calls.push({
      name: "inventory.health",
      args: { threshold: 10, limit: 10 },
    });
  }
  if (/订单|物流|发货|order|shipment|tracking/i.test(message)) {
    calls.push({ name: "order.diagnose", args: { query: message.slice(0, 120) } })
  }

  const results: Array<{ name: string; result: unknown }> = [];
  for (const call of calls) {
    yield { type: "tool_start", name: call.name, arguments: call.args };
    try {
      const result = await executeTool(call.name, call.args, context);
      results.push({ name: call.name, result });
      yield { type: "tool_result", name: call.name, result };
    } catch (error) {
      const result = {
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
      results.push({ name: call.name, result });
      yield { type: "tool_result", name: call.name, result };
    }
  }
  const lowStock = results.find((item) => item.name === "inventory.health")?.result as
    | { items?: Array<{ sku?: string | null }> }
    | undefined
  const sku = lowStock?.items?.find((item) => item.sku)?.sku
  if (sku && /补货|采购|erp|purchase/i.test(message)) {
    const call = {
      name: "erp.preview",
      args: {
        reason: message.slice(0, 240),
        target: "erp",
        items: [{ sku, quantity: 10 }],
      },
    }
    yield { type: "tool_start", name: call.name, arguments: call.args }
    try {
      const result = await executeTool(call.name, call.args, context)
      results.push({ name: call.name, result })
      yield { type: "tool_result", name: call.name, result }
    } catch (error) {
      const result = { error: error instanceof Error ? error.message : "Tool execution failed" }
      yield { type: "tool_result", name: call.name, result }
    }
  }

  const knowledge = results.find((item) => item.name === "knowledge.search")
    ?.result as
    { results?: Array<{ title: string; snippet: string }> } | undefined;
  const inventory = results.find((item) => item.name === "inventory.health")
    ?.result as
    { low_stock_count?: number; total_available?: number } | undefined;
  const catalog = results.find((item) => item.name === "catalog.search")
    ?.result as { count?: number } | undefined;

  const lines = [
    fallbackReason
      ? "AI 服务暂时不可用，已切换到本地工具模式；以下回答基于已执行的只读工具结果。"
      : "当前为本地演示模式（未配置 AI_API_KEY），以下回答基于已执行的只读工具结果，不调用外部模型。",
  ];
  if (catalog) lines.push(`目录检索命中 ${catalog.count ?? 0} 个商品。`);
  if (inventory) {
    lines.push(
      `库存扫描发现 ${inventory.low_stock_count ?? 0} 个低库存层级，可售总量 ${inventory.total_available ?? 0}。`,
    );
  }
  if (knowledge?.results?.length) {
    lines.push(
      `知识库最相关文档：${knowledge.results
        .slice(0, 3)
        .map((item) => item.title)
        .join("、")}。`,
    );
  } else {
    lines.push("知识库未检索到可引用内容，可先上传 SOP 或运营文档。");
  }
  lines.push("ERP 工具只生成待审批预览，不会创建采购单或修改外部系统。");

  for (const line of lines) {
    yield { type: "token", content: `${line}\n` };
  }

  const citations = results.flatMap((item) => extractCitations(item.result));
  yield { type: "done", mode: "demo", citations };
}

export async function* runOperationsAgent(input: {
  message: string;
  history?: AgentHistoryItem[];
  context: ToolContext;
}): AsyncGenerator<AgentEvent> {
  const config = getAiConfig();
  if (!config.apiKey) {
    yield* runDemoAgent(input.message, input.context);
    return;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...sanitizeHistory(input.history),
    { role: "user", content: input.message },
  ];
  const citations: Array<{
    document_id: string;
    chunk_id: string;
    title: string;
    snippet: string;
  }> = [];

  try {
    for (let iteration = 0; iteration < config.maxIterations; iteration += 1) {
      let assistantContent = "";
      let toolCalls: LlmToolCall[] = [];

      for await (const event of streamChatCompletion({
        messages,
        tools: TOOL_DEFINITIONS,
        signal: timeoutSignal(config.timeoutMs),
      })) {
        if (event.type === "token") {
          assistantContent += event.content;
          yield { type: "token", content: event.content };
        } else {
          toolCalls = event.toolCalls;
          if (!assistantContent && event.content)
            assistantContent = event.content;
        }
      }

      if (!toolCalls.length) {
        yield { type: "done", mode: "ai", citations };
        return;
      }

      messages.push({
        role: "assistant",
        content: assistantContent || null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = parseArguments(call.function.arguments);
          yield {
            type: "tool_start",
            name: call.function.name,
            arguments: args,
          };
          const result = await executeToolWithTimeout(
            call,
            args,
            input.context,
          );
          citations.push(...extractCitations(result));
          yield { type: "tool_result", name: call.function.name, result };
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result).slice(0, 24_000),
          });
        } catch (error) {
          const result = {
            error:
              error instanceof Error ? error.message : "Tool execution failed",
          };
          yield { type: "tool_result", name: call.function.name, result };
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result),
          });
        }
      }
    }

    const warning = "\n\n已达到最大工具调用轮次，请缩小问题范围后重试。";
    yield { type: "token", content: warning };
    yield { type: "done", mode: "ai", citations };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI provider request failed";
    yield {
      type: "status",
      mode: "fallback",
      message: `AI 服务请求失败，已切换到本地工具模式：${message.slice(0, 300)}`,
    };
    yield* runDemoAgent(input.message, input.context, message);
  }
}
