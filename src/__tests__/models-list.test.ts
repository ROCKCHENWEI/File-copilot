import { ChatService } from "@/llm/ChatService";
import { DEFAULT_SETTINGS } from "@/constants";
import { requestUrl } from "obsidian";

describe("ChatService.listAvailableModels", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.mocked(requestUrl).mockReset();
  });

  it("fetches and dedupes model ids via fetch (GLM)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ id: "glm-5.2" }, { id: "glm-5.1" }, { id: "glm-5.2" }, { id: " " }, {}] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    const models = await ChatService.listAvailableModels(
      { ...DEFAULT_SETTINGS, glmApiKey: "glm-key" },
      "glm",
    );

    expect(models).toEqual(["glm-5.1", "glm-5.2"]);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("https://open.bigmodel.cn/api/coding/paas/v4/models");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer glm-key");
  });

  it("fetches model ids via requestUrl (Kimi)", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      headers: {},
      text: "",
      json: { data: [{ id: "kimi-for-coding" }, { id: "kimi-k2.5" }] },
      arrayBuffer: new ArrayBuffer(0),
    });

    const models = await ChatService.listAvailableModels(
      { ...DEFAULT_SETTINGS, kimiApiKey: "kimi-key" },
      "kimi",
    );

    expect(models).toEqual(["kimi-for-coding", "kimi-k2.5"]);
    const [param] = vi.mocked(requestUrl).mock.calls[0];
    const req = (typeof param === "string" ? {} : param) as { url?: string };
    expect(req.url).toBe("https://api.kimi.com/coding/v1/models");
  });

  it("throws a friendly error when the key is missing", async () => {
    await expect(ChatService.listAvailableModels(DEFAULT_SETTINGS, "glm")).rejects.toThrow("请先填写 GLM 的 API Key");
  });

  it("surfaces API error details", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "invalid api key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    await expect(
      ChatService.listAvailableModels({ ...DEFAULT_SETTINGS, glmApiKey: "bad" }, "glm"),
    ).rejects.toThrow("invalid api key");
  });
});
