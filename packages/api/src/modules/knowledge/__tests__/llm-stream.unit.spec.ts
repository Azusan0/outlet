import { streamChatCompletion } from "../../../lib/ai/llm";

describe("OpenAI-compatible stream decoding", () => {
  const originalKey = process.env.AI_API_KEY;
  const originalBaseUrl = process.env.AI_BASE_URL;

  beforeEach(() => {
    process.env.AI_API_KEY = "test-only-key";
    process.env.AI_BASE_URL = "https://example.invalid/v1";
  });

  afterAll(() => {
    if (originalKey) process.env.AI_API_KEY = originalKey;
    else delete process.env.AI_API_KEY;
    if (originalBaseUrl) process.env.AI_BASE_URL = originalBaseUrl;
    else delete process.env.AI_BASE_URL;
  });

  it("assembles content and fragmented tool calls from SSE", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Checking "}}]}',
      'data: {"choices":[{"delta":{"content":"SOP."}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"knowledge.","arguments":"{\\"query\\":"}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"search","arguments":"\\"stock\\"}"}}]},"finish_reason":"tool_calls"}]}',
      "data: [DONE]",
      "",
    ].join("\n");
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(sse, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const tokens: string[] = [];
    let completed:
      | {
          content: string;
          toolCalls: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        }
      | undefined;

    for await (const event of streamChatCompletion({
      messages: [{ role: "user", content: "Check SOP" }],
      tools: [],
      signal: AbortSignal.timeout(5_000),
    })) {
      if (event.type === "token") tokens.push(event.content);
      else completed = event;
    }

    expect(tokens.join("")).toBe("Checking SOP.");
    expect(completed?.content).toBe("Checking SOP.");
    expect(completed?.toolCalls[0]).toMatchObject({
      id: "call_1",
      function: {
        name: "knowledge.search",
        arguments: '{"query":"stock"}',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.invalid/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
    fetchMock.mockRestore();
  });
});
