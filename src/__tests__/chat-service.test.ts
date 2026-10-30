import { ChatService } from "@/llm/ChatService";
import { DEFAULT_SETTINGS } from "@/constants";
import { requestUrl } from "obsidian";

describe("ChatService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.mocked(requestUrl).mockReset();
  });

  it("reads non-streaming OpenAI-compatible responses", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      headers: {},
      text: JSON.stringify({
        choices: [
          {
            message: {
              content: "hello world",
            },
          },
        ],
      }),
      json: {
        choices: [
          {
            message: {
              content: "hello world",
            },
          },
        ],
      },
      arrayBuffer: new ArrayBuffer(0),
    });

    const service = ChatService.fromSettings(
      {
        ...DEFAULT_SETTINGS,
        kimiApiKey: "kimi-key",
      },
      "kimi",
    );

    const result = await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 200,
      stream: false,
    });

    expect(result.content).toBe("hello world");
    expect(requestUrl).toHaveBeenCalledTimes(1);
    const [param] = vi.mocked(requestUrl).mock.calls[0];
    const req = typeof param === "string" ? { url: param } : param;
    expect(req.url).toBe("https://api.kimi.com/coding/v1/chat/completions");
  });

  it("parses Kimi streaming via requestUrl (no browser fetch)", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"hello "}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"world"}}]}\n\n' +
      "data: [DONE]\n\n";

    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      headers: {},
      text: sse,
      json: null,
      arrayBuffer: new ArrayBuffer(0),
    });

    const service = ChatService.fromSettings(
      {
        ...DEFAULT_SETTINGS,
        kimiApiKey: "kimi-key",
      },
      "kimi",
    );

    const chunks: string[] = [];
    const result = await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 200,
      stream: true,
      onChunk(chunk) {
        chunks.push(chunk);
      },
    });

    expect(result.content).toBe("hello world");
    expect(chunks).toEqual(["hello ", "world"]);
    expect(requestUrl).toHaveBeenCalledTimes(1);
    const [param] = vi.mocked(requestUrl).mock.calls[0];
    const body = typeof param === "string" ? {} : JSON.parse(String(param.body));
    expect(body.stream).toBe(true);
  });

  it("aggregates streaming chunks", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"hello "}}]}\n\n'),
        );
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"world"}}]}\n\n'),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
        },
      }),
    ) as typeof fetch;

    const service = ChatService.fromSettings(
      {
        ...DEFAULT_SETTINGS,
        glmApiKey: "glm-key",
      },
      "glm",
    );

    const chunks: string[] = [];
    const result = await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 200,
      stream: true,
      onChunk(chunk) {
        chunks.push(chunk);
      },
    });

    expect(result.content).toBe("hello world");
    expect(chunks).toEqual(["hello ", "world"]);
  });

  it("uses the GLM Coding Plan endpoint and canonical model id", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "ok",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    ) as typeof fetch;

    const service = ChatService.fromSettings(
      {
        ...DEFAULT_SETTINGS,
        glmApiKey: "glm-key",
      },
      "glm",
      "GLM-5.1",
    );

    await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 200,
      stream: false,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(String(init?.body)) as { model: string };

    expect(url).toBe("https://open.bigmodel.cn/api/coding/paas/v4/chat/completions");
    expect(body.model).toBe("glm-5.1");
  });

  it("normalizes cumulative MiniMax streaming chunks", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'),
        );
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'),
        );
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"你好呀"}}]}\n\n'),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
        },
      }),
    ) as typeof fetch;

    const service = ChatService.fromSettings(
      {
        ...DEFAULT_SETTINGS,
        minimaxApiKey: "minimax-key",
      },
      "minimax",
    );

    const chunks: string[] = [];
    const result = await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 200,
      stream: true,
      onChunk(chunk) {
        chunks.push(chunk);
      },
    });

    expect(result.content).toBe("你好呀");
    expect(chunks).toEqual(["你", "好", "呀"]);
  });

  it("clamps provider temperature before sending request", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      headers: {},
      text: JSON.stringify({
        choices: [{ message: { content: "ok" } }],
      }),
      json: { choices: [{ message: { content: "ok" } }] },
      arrayBuffer: new ArrayBuffer(0),
    });

    const service = ChatService.fromSettings(
      {
        ...DEFAULT_SETTINGS,
        kimiApiKey: "kimi-key",
      },
      "kimi",
    );

    await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 1.9,
      maxTokens: 200,
      stream: false,
    });

    expect(requestUrl).toHaveBeenCalledTimes(1);
    const [param] = vi.mocked(requestUrl).mock.calls[0];
    const req = typeof param === "string" ? null : param;
    const body = JSON.parse(String(req?.body)) as { temperature: number };
    expect(body.temperature).toBe(1);
  });

  it("throws when api key is missing", async () => {
    const service = ChatService.fromSettings(DEFAULT_SETTINGS, "minimax");

    await expect(
      service.complete({
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.7,
        maxTokens: 200,
        stream: false,
      }),
    ).rejects.toThrow("API Key");
  });

  it("includes API error detail on fetch failures", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const service = ChatService.fromSettings({ ...DEFAULT_SETTINGS, glmApiKey: "k" }, "glm");

    await expect(
      service.complete({
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.7,
        maxTokens: 50,
        stream: false,
      }),
    ).rejects.toThrow("quota exceeded");
  });

  it("includes API error detail on Kimi requestUrl failures", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 403,
      headers: {},
      text: JSON.stringify({ error: { message: "forbidden" } }),
      json: null,
      arrayBuffer: new ArrayBuffer(0),
    });

    const service = ChatService.fromSettings({ ...DEFAULT_SETTINGS, kimiApiKey: "k" }, "kimi");

    await expect(
      service.complete({
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.7,
        maxTokens: 50,
        stream: false,
      }),
    ).rejects.toThrow("forbidden");
  });

  it("parses non-streaming tool_calls (Kimi requestUrl)", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      headers: {},
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "search_notes", arguments: '{"query":"周报"}' },
                },
              ],
            },
          },
        ],
      },
      arrayBuffer: new ArrayBuffer(0),
    });

    const service = ChatService.fromSettings({ ...DEFAULT_SETTINGS, kimiApiKey: "kimi-key" }, "kimi");

    const result = await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 200,
      stream: false,
      tools: [
        {
          name: "search_notes",
          description: "search",
          parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
        },
      ],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe("search_notes");

    const [param] = vi.mocked(requestUrl).mock.calls[0];
    const req = typeof param === "string" ? null : param;
    const body = JSON.parse(String(req?.body)) as { tools?: unknown[]; tool_choice?: string };
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "search_notes",
          description: "search",
          parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
        },
      },
    ]);
    expect(body.tool_choice).toBe("auto");
  });

  it("maps tool-role messages to wire format and streams tool_calls (GLM fetch)", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"read_note","arguments":""}}]}}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\\"path\\\":\\\"a.md\\\"}"}}]}}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    ) as typeof fetch;

    const service = ChatService.fromSettings({ ...DEFAULT_SETTINGS, glmApiKey: "glm-key" }, "glm");

    const result = await service.complete({
      messages: [
        { role: "user", content: "读一下" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "c1", type: "function", function: { name: "read_note", arguments: '{"path":"a.md"}' } }],
        },
        { role: "tool", content: "笔记内容", toolCallId: "c1", name: "read_note" },
      ],
      temperature: 0.7,
      maxTokens: 200,
      stream: true,
    });

    expect(result.toolCalls[0].function.arguments).toBe('{"path":"a.md"}');

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const body2 = JSON.parse(String(init?.body)) as {
      messages: Array<Record<string, unknown>>;
    };
    expect(body2.messages[1]).toMatchObject({ role: "assistant", tool_calls: expect.any(Array) });
    expect(body2.messages[2]).toMatchObject({ role: "tool", tool_call_id: "c1", content: "笔记内容" });
  });
});

describe("fetch → requestUrl fallback (CORS/网络拦截)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.mocked(requestUrl).mockReset();
  });

  function okRequestUrlJson(content: string) {
    return {
      status: 200,
      headers: {},
      json: { choices: [{ message: { content } }] },
      text: "",
      arrayBuffer: new ArrayBuffer(0),
    };
  }

  it("retries via requestUrl when fetch is blocked before any output", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as typeof fetch;
    vi.mocked(requestUrl).mockResolvedValue(okRequestUrlJson("via-requestUrl"));

    const service = ChatService.fromSettings({ ...DEFAULT_SETTINGS, glmApiKey: "glm-key" }, "glm");
    const result = await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 100,
      stream: false,
    });

    expect(result.content).toBe("via-requestUrl");
    expect(requestUrl).toHaveBeenCalledTimes(1);
    const [param] = vi.mocked(requestUrl).mock.calls[0];
    const req = (typeof param === "string" ? {} : param) as { url?: string };
    expect(req.url).toBe("https://open.bigmodel.cn/api/coding/paas/v4/chat/completions");
  });

  it("falls back for streaming requests too (requestUrl replays chunks)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as typeof fetch;
    const sse = 'data: {"choices":[{"delta":{"content":"回放"}}]}\n\n';
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      headers: {},
      json: null,
      text: sse,
      arrayBuffer: new ArrayBuffer(0),
    });

    const service = ChatService.fromSettings({ ...DEFAULT_SETTINGS, minimaxApiKey: "mm" }, "minimax");
    const chunks: string[] = [];
    const result = await service.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 100,
      stream: true,
      onChunk(chunk) {
        chunks.push(chunk);
      },
    });

    expect(result.content).toBe("回放");
    expect(chunks).toEqual(["回放"]);
  });

  it("does NOT fall back on HTTP errors (server was reached)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "身份验证失败" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const service = ChatService.fromSettings({ ...DEFAULT_SETTINGS, glmApiKey: "bad" }, "glm");

    await expect(
      service.complete({
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.7,
        maxTokens: 100,
        stream: false,
      }),
    ).rejects.toThrow("身份验证失败");
    expect(requestUrl).not.toHaveBeenCalled();
  });

  it("does NOT retry when the stream already emitted content", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n'));
        // 延迟报错：保证已入队的帧先被读取（立即 error 会清空队列）
        setTimeout(() => controller.error(new TypeError("Failed to fetch")), 0);
      },
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    ) as typeof fetch;

    const service = ChatService.fromSettings({ ...DEFAULT_SETTINGS, glmApiKey: "glm-key" }, "glm");
    const chunks: string[] = [];

    await expect(
      service.complete({
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.7,
        maxTokens: 100,
        stream: true,
        onChunk(chunk) {
          chunks.push(chunk);
        },
      }),
    ).rejects.toThrow(TypeError);

    expect(chunks).toEqual(["部分"]);
    expect(requestUrl).not.toHaveBeenCalled();
  });
});
