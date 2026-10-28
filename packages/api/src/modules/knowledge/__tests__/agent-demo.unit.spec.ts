import type { MedusaContainer } from "@medusajs/framework/types";
import { runOperationsAgent } from "../../../lib/ai/agent";
import { streamChatCompletion } from "../../../lib/ai/llm";
import type { AgentEvent } from "../../../lib/ai/types";
import type { TenantRecord } from "../../../lib/tenant";

// The ERP workflow has a runtime dependency on Mercur patches. The separate
// HTTP tests verify its integration; this unit test only covers the fallback.
jest.mock("../../../lib/operations/erp", () => ({
  previewErpSync: jest.fn(),
}));

jest.mock("../../../lib/ai/llm", () => ({
  streamChatCompletion: jest.fn(),
}));

describe("operations agent local fallback", () => {
  const originalAiKey = process.env.AI_API_KEY;
  const originalDeepseekKey = process.env.DEEPSEEK_API_KEY;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (originalAiKey) process.env.AI_API_KEY = originalAiKey;
    if (originalDeepseekKey) process.env.DEEPSEEK_API_KEY = originalDeepseekKey;
    if (originalOpenAiKey) process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  it("emits tool events, a deterministic answer, and citations without a model key", async () => {
    const knowledgeService = {
      searchKnowledge: jest.fn().mockResolvedValue([
        {
          document_id: "doc_sop",
          chunk_id: "chunk_sop",
          title: "Warehouse SOP",
          snippet: "Verify inbound stock twice a day.",
          score: 1.2,
          position: 0,
        },
      ]),
    };
    const scope = {
      resolve: jest.fn((name: string) => {
        if (name === "knowledge") return knowledgeService;
        throw new Error(`Unexpected dependency: ${name}`);
      }),
    } as unknown as MedusaContainer;
    const tenant: TenantRecord = {
      id: "ten_test",
      slug: "test",
      name: "Test",
      description: "",
      sales_channel_id: "sc_test",
      region_id: "reg_test",
        publishable_key: "pk_test",
      default_country: "de",
      status: "active",
    };

    const events: AgentEvent[] = [];
    for await (const event of runOperationsAgent({
      message: "仓库 SOP 是什么？",
      context: { scope, tenant, actorId: "user_test" },
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "tool_start")).toBe(true);
    expect(events.some((event) => event.type === "tool_result")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "token" && event.content.includes("本地演示模式"),
      ),
    ).toBe(true);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      mode: "demo",
      citations: [
        {
          document_id: "doc_sop",
          chunk_id: "chunk_sop",
        },
      ],
    });
  });

  it("falls back to local tools when the configured provider fails", async () => {
    process.env.AI_API_KEY = "test-only-key";
    (streamChatCompletion as jest.Mock).mockImplementation(async function* () {
      throw new Error("AI provider returned HTTP 401");
    });
    const knowledgeService = {
      searchKnowledge: jest.fn().mockResolvedValue([]),
    };
    const scope = {
      resolve: jest.fn((name: string) => {
        if (name === "knowledge") return knowledgeService;
        throw new Error(`Unexpected dependency: ${name}`);
      }),
    } as unknown as MedusaContainer;
    const tenant: TenantRecord = {
      id: "ten_test",
      slug: "test",
      name: "Test",
      description: "",
      sales_channel_id: "sc_test",
      region_id: "reg_test",
      publishable_key: "pk_test",
      default_country: "de",
      status: "active",
    };

    const events: AgentEvent[] = [];
    for await (const event of runOperationsAgent({
      message: "仓库 SOP 是什么？",
      context: { scope, tenant, actorId: "user_test" },
    })) {
      events.push(event);
    }

    expect(events).toContainEqual(
      expect.objectContaining({ type: "status", mode: "fallback" }),
    );
    expect(events.some((event) => event.type === "tool_start")).toBe(true);
    expect(events.some((event) => event.type === "tool_result")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "token" && event.content.includes("本地工具模式"),
      ),
    ).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "done", mode: "demo" });
  });
});
