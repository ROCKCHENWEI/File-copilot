import { ChatService } from "@/llm/ChatService";
import { DEFAULT_SETTINGS } from "@/constants";
import { requestUrl } from "obsidian";

describe("ChatService.testConnection", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.mocked(requestUrl).mockReset();
  });

  it("pings the exact selected model (custom ids included) via fetch", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "pong" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const { latencyMs, reply } = await ChatService.testConnection(
      { ...DEFAULT_SETTINGS, glmApiKey: "glm-key" },
      "glm",
      "glm-custom-x",
    );

    expect(reply).toBe("pong");
    expect(latencyMs).toBeGreaterThanOrEqual(0);

    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("https://open.bigmodel.cn/api/coding/paas/v4/chat/completions");
    const body = JSON.parse(String(init?.body)) as { model: string; max_tokens: number; stream: boolean };
    // 关键：测的就是用户选定的模型 id，不做内置列表回退
    expect(body.model).toBe("glm-custom-x");
    expect(body.stream).toBe(false);
  });

  it("works via requestUrl (Kimi)", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      headers: {},
      text: "",
      json: { choices: [{ message: { content: "pong" } }] },
      arrayBuffer: new ArrayBuffer(0),
    });

    const { reply } = await ChatService.testConnection(
      { ...DEFAULT_SETTINGS, kimiApiKey: "kimi-key" },
      "kimi",
      "kimi-for-coding",
    );

    expect(reply).toBe("pong");
  });

  it("throws a friendly error when the key is missing", async () => {
    await expect(ChatService.testConnection(DEFAULT_SETTINGS, "glm", "glm-5.2")).rejects.toThrow(
      "请先填写 GLM 的 API Key",
    );
  });

  it("throws when the model is blank", async () => {
    await expect(
      ChatService.testConnection({ ...DEFAULT_SETTINGS, glmApiKey: "k" }, "glm", "  "),
    ).rejects.toThrow("请先选择要测试的模型");
  });

  it("treats an empty reply as success (reasoning models may exhaust tokens on thinking)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const { reply } = await ChatService.testConnection({ ...DEFAULT_SETTINGS, glmApiKey: "k" }, "glm", "glm-5.2");

    expect(reply).toBe("");
  });

  it("surfaces auth errors with detail", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "invalid api key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    await expect(
      ChatService.testConnection({ ...DEFAULT_SETTINGS, glmApiKey: "bad" }, "glm", "glm-5.2"),
    ).rejects.toThrow("invalid api key");
  });
});
